// E10: four pieces of live run state were in the engine and in neither half of the save, so
// pressing F5 mid-run changed the run.
//
// saveGameState was one object literal and loadGameState was another picking it apart, with
// nothing making the two agree. activeContracts was in neither. Measured through a real reload,
// with DRY RUN, SHORT HANDED and NO FALLBACK signed for:
//
//                          before F5                          after
//   activeContracts        the three                          []
//   totalRegroups()        0                                  2
//   canCarry()             false                              true
//   runStats.contractMult  1.70                               1.70
//
// The handicaps lifted and the score kept charging for them, because newRunStats snapshots
// contractMult() at run start and computeScore multiplies by the snapshot. An F5 was a cheat
// code with a 70% score bonus attached.
//
// The same reload emptied fightLog, so a fight that had already spent an item, taken damage and
// run nine turns came back clean - FLAWLESS, BLITZ and FRUGAL all payable again. It emptied
// vacatedRanks, so an operator lost that fight left a hole closeRanks had nothing to close, and
// the squad walked the rest of the run a rank short. And it dropped momentumFocus, a x1.3 the
// player had already paid momentum for.
//
// The three fight-scoped ones live in COMBAT_STATE now - one table read by both halves, so a
// field cannot be added to one and forgotten by the other - and activeContracts is in the
// payload with a validator in the migrateRelics idiom.
module.exports = {
  name: 'What the save keeps',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── The two halves are one list now ─────────────────────────────────────────────
    const drift = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5;
      initiateCombat('RAIDERS', false);
      const snap = buildCombatSnapshot();
      const keys = COMBAT_STATE.map(f => f.key);
      return { keys, missing: keys.filter(k => !(k in snap)),
               shape: COMBAT_STATE.filter(f => typeof f.get !== 'function' || typeof f.set !== 'function'
                                            || typeof f.load !== 'function').map(f => f.key),
               dupes: keys.length !== new Set(keys).size };
    });
    ok(`the snapshot writes every field the table declares (${drift.keys.length})`,
      drift.missing.length === 0 && !drift.dupes);
    ok(`and every one of them can be read, written and validated (${drift.shape.join(', ') || 'all three each'})`,
      drift.shape.length === 0);

    // Both halves read the same table, so a renamed key stays consistent and a drift check on
    // the names proves nothing. What is worth proving is that each entry is a closed loop: put a
    // distinctive value in, snapshot it, wipe the global, restore, and get the value back. That
    // catches a get and a set pointing at different things, or a load quietly discarding data
    // that was perfectly valid.
    const loop = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5;
      initiateCombat('RAIDERS', false);
      const probes = {
        nodeType: 'RAIDERS', isElite: true, weather: 'ASHFALL', terrain: 'TUNNELS',
        formation: null, bgFile: 'bg_highway.webp', bondSaves: ['p1|p2'],
        fightLog: { turns: 7, hurt: true, spent: true, chased: true },
        vacated: [2], focus: 1, press: true
      };
      const broken = [];
      COMBAT_STATE.forEach(f => {
        if (!(f.key in probes)) { broken.push(`${f.key}: no probe written for it`); return; }
        f.set(probes[f.key]);
        const snap = JSON.parse(JSON.stringify(f.get() === undefined ? null : f.get()));
        f.set(f.load(undefined));
        f.set(f.load(snap));
        const back = JSON.stringify(f.get());
        if (back !== JSON.stringify(probes[f.key])) broken.push(`${f.key}: ${back} not ${JSON.stringify(probes[f.key])}`);
      });
      return { broken, count: COMBAT_STATE.length };
    });
    ok(`all ${loop.count} round-trip through get, snapshot, load and set (${loop.broken.join('; ') || 'clean'})`,
      loop.broken.length === 0);

    // ── Every field survives a real reload, not a simulated one ────────────────────
    await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      openContracts(1.0);
      toggleContract('SHORT_HANDED'); toggleContract('NO_REGROUPS'); toggleContract('NO_CONSUMABLES');
      beginExpedition();
      sectorFront = null; currentSector = 2; currentTier = 5;
      initiateCombat('RAIDERS', false);
      fightLog.turns = 9; fightLog.hurt = true; fightLog.spent = true; fightLog.chased = true;
      const victim = activeEntities.find(e => e.isPlayer && e.gridPos > 0);
      loseOperator(victim, 'COMBAT');
      momentumFocus = 1; pressExtra = true;
      window.__was = { contracts: [...activeContracts], regroups: totalRegroups(), carry: canCarry(),
                       mult: runStats.contractMult, vacated: [...vacatedRanks], bg: combatBgFile,
                       names: contractNames() };
      saveGameState();
    });
    const was = await page.evaluate(() => window.__was);
    await page.reload();
    await page.waitForTimeout(600);
    const now = await page.evaluate(() => {
      currentSlot = 1; loadGameState();
      if (pendingCombat) resumeCombat(pendingCombat);
      return { contracts: [...activeContracts], regroups: totalRegroups(), carry: canCarry(),
               mult: runStats.contractMult, names: contractNames(),
               log: fightLog ? { ...fightLog } : null, vacated: [...vacatedRanks],
               focus: momentumFocus, press: pressExtra, bg: combatBgFile, resumed: combatActive };
    });
    ok('the fight comes back up at all', now.resumed === true);
    ok(`the handicaps signed for are still signed for (${now.contracts.join(', ')})`,
      JSON.stringify(now.contracts) === JSON.stringify(was.contracts) && was.contracts.length === 3);
    ok(`so NO FALLBACK still means no fallback (${was.regroups} -> ${now.regroups})`,
      now.regroups === 0 && was.regroups === 0);
    ok(`and DRY RUN still means an empty bag (${was.carry} -> ${now.carry})`,
      now.carry === false && was.carry === false);
    ok(`with the score charging for what is actually being carried (x${now.mult})`,
      now.mult === was.mult && now.mult > 1 && now.names.length === was.names.length);
    ok(`a fight that lost FLAWLESS, BLITZ and FRUGAL has still lost them (${JSON.stringify(now.log)})`,
      now.log && now.log.hurt === true && now.log.spent === true && now.log.turns >= 9 && now.log.chased === true);
    ok(`the rank a fallen operator left is still a rank to close (${JSON.stringify(now.vacated)})`,
      JSON.stringify(now.vacated) === JSON.stringify(was.vacated) && was.vacated.length === 1);
    ok('and the momentum already spent on FOCUS and PRESS is still spent on them',
      now.focus === 1 && now.press === true);
    ok(`the fight's own background comes back with it (${now.bg})`, now.bg === was.bg);

    // ── The rank actually closes, which is what vacatedRanks is for ────────────────
    const closed = await page.evaluate(() => {
      const gap = vacatedRanks[0];
      const filled = closeRanks();
      return { gap, filled, standing: playerRoster.some(c => c.gridPos === gap) };
    });
    ok(`closeRanks steps somebody into the gap after the reload (${closed.filled.join(', ') || 'nobody'})`,
      closed.filled.length === 1 && closed.standing === true);

    // ── An old save has none of this, and must not fall over ─────────────────────
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    const old = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5;
      initiateCombat('RAIDERS', false);
      saveGameState();
      // Strip the phase's fields the way a save written before it would be, and put a couple of
      // ids in that no longer resolve while we are here.
      const raw = Store.getJSON(BASE_SAVE_KEY + currentSlot);
      delete raw.activeContracts;
      COMBAT_STATE.forEach(f => { if (raw.combat) delete raw.combat[f.key]; });
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw));
      let threw = null;
      try { loadGameState(); if (pendingCombat) resumeCombat(pendingCombat); }
      catch (e) { threw = e.message; }
      return { threw, contracts: [...activeContracts], log: fightLog ? { ...fightLog } : null,
               vacated: [...vacatedRanks], focus: momentumFocus, press: pressExtra,
               weather: currentWeather, terrain: currentTerrain, bg: combatBgFile };
    });
    ok(`a save from before this phase loads without throwing (${old.threw || 'no throw'})`, old.threw === null);
    // resumeCombat ends in processTurn, which counts the turn it is resuming into when it is a
    // player's - so a rebuilt log reads 0 or 1 depending on whose turn the fight was saved on,
    // and pinning it to 0 is a coin flip on the speed roll rather than an assertion.
    ok(`and lands on what a fresh fight would have, rather than on undefined (turns ${old.log && old.log.turns})`,
      old.contracts.length === 0 && old.log !== null && old.log.turns <= 1 && old.log.hurt === false
      && old.vacated.length === 0 && old.focus === 0 && old.press === false);
    ok(`with the scene falling back rather than blanking (${old.weather} / ${old.terrain} / ${old.bg})`,
      old.weather === 'CLEAR' && old.terrain === 'OPEN_ROAD' && old.bg === 'bg_combat.webp');

    // ── And nothing tampered with is trusted ────────────────────────────────────
    const junk = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5;
      initiateCombat('RAIDERS', false);
      saveGameState();
      const raw = Store.getJSON(BASE_SAVE_KEY + currentSlot);
      raw.activeContracts = ['SHORT_HANDED', 'A_CONTRACT_THAT_NEVER_WAS', 42, null];
      raw.combat.vacated = [1, 9, -3, 'two'];
      raw.combat.terrain = 'NOWHERE';
      raw.combat.weather = 'SUNSHOWER';
      raw.combat.focus = 99;
      raw.combat.fightLog = { turns: -5, hurt: 'yes' };
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw));
      loadGameState(); if (pendingCombat) resumeCombat(pendingCombat);
      return { contracts: [...activeContracts], vacated: [...vacatedRanks], terrain: currentTerrain,
               weather: currentWeather, focus: momentumFocus, log: { ...fightLog } };
    });
    ok(`a contract id that no longer resolves is dropped, not carried (${junk.contracts.join(', ')})`,
      junk.contracts.length === 1 && junk.contracts[0] === 'SHORT_HANDED');
    ok(`a rank off the board is dropped too (${JSON.stringify(junk.vacated)})`,
      JSON.stringify(junk.vacated) === '[1]');
    ok(`ground and weather that do not exist fall back (${junk.terrain} / ${junk.weather})`,
      junk.terrain === 'OPEN_ROAD' && junk.weather === 'CLEAR');
    ok(`and a tampered focus is clamped rather than believed (${junk.focus})`, junk.focus === 1);
    ok(`a half-written fight log is rebuilt whole (${JSON.stringify(junk.log)})`,
      junk.log.turns <= 1 && junk.log.hurt === true && junk.log.spent === false && junk.log.chased === false);
  }
};

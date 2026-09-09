// I02: initiateCombat ends in processTurn(), so a fight does not start with nobody's turn - it
// starts with the first actor's turn already open. Turn-start effects have been applied to them,
// and if they are a player the fight log has already counted the turn.
//
// That is correct for the game and invisible in it, because the engine's own walk delivers every
// other turn the same way. It matters to the harness, which re-implements that walk - see F03 -
// and so was delivering the opening actor a SECOND turn-start on its first pass. Measured over
// 210 fights across seven depths and three factions: 49 of them (23%) open on a player, the
// Scavenger 46 times and the Medic 3, and in every one the lead's cooldown had already stepped
// and fightLog.turns already read 1 before the harness ran a single pass. One fight in four was
// handing the fastest operator a free cooldown step and reading a turn longer than it was.
//
// simulate.js compensates now. This suite pins the contract it compensates against, so that if
// the engine ever stops opening that turn - or starts resolving it outright - the red lands here,
// next to the note explaining what depends on it, rather than as a drift in a balance figure
// nobody can source.
module.exports = {
  name: 'The turn a fight opens with',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── The opening turn is already open ─────────────────────────────────────────────
    const open = await page.evaluate(() => {
      const rows = [];
      for (const [s, t] of [[1, 2], [3, 5], [5, 10], [7, 10]]) {
        for (const type of ['RAIDERS', 'BEASTS', 'MECH']) {
          for (let i = 0; i < 8; i++) {
            currentSlot = 1; confirmNewGame(1.0); sectorFront = null; activeContracts = [];
            currentSector = s; currentTier = t;
            // A cooldown a previous fight would have left behind. They are never reset at the
            // door - nothing in the engine clears them between fights - so this is the state an
            // operator really walks in carrying.
            playerRoster.forEach(c => { if (c.cooldowns) for (const k in c.cooldowns) c.cooldowns[k] = 3; });
            initiateCombat(type, false);
            const lead = turnQueue[activeIndex];
            if (!lead) continue;
            rows.push({ player: !!lead.isPlayer, cls: lead.classType || null,
                        cd: lead.isPlayer ? Object.values(lead.cooldowns || {})[0] : null,
                        turns: fightLog ? fightLog.turns : null });
          }
        }
      }
      return { rows, step: cooldownStep() };
    });
    const led = open.rows.filter(r => r.player), foes = open.rows.filter(r => !r.player);
    ok(`a fight sometimes opens on a player, so this is not a corner case (${led.length} of ${open.rows.length}, ${[...new Set(led.map(r => r.cls))].join('/')})`,
      led.length > 0 && foes.length > 0);
    ok(`and when it does, their turn-start has already run (cooldown 3 -> ${led.length ? led[0].cd : '?'}, step ${open.step})`,
      led.length > 0 && led.every(r => r.cd === 3 - open.step));
    ok('and the fight log has already counted that turn',
      led.length > 0 && led.every(r => r.turns === 1));
    ok('while a fight opening on a hostile has counted none of the squad',
      foes.length > 0 && foes.every(r => r.turns === 0));

    // ── But it is not RESOLVED, which is what lets a synchronous walk drive a fight ───
    // processTurn hands an opening hostile to setTimeout rather than acting outright. The
    // harness runs a whole expedition inside one synchronous page.evaluate, so those timers
    // cannot fire while a fight is live - and executeEnemyAi guards on combatActive besides.
    // If opening a fight ever started dealing damage on the spot, every simulated fight would
    // silently gain a free hostile turn; this is the assertion that would catch it.
    const quiet = await page.evaluate(() => {
      let checked = 0, acted = 0;
      for (let i = 0; i < 24; i++) {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null; activeContracts = [];
        currentSector = 4; currentTier = 6;
        initiateCombat('RAIDERS', false);
        const lead = turnQueue[activeIndex];
        if (!lead || lead.isPlayer) continue;
        checked++;
        // Nobody has been hit, and the squad is whole, at the moment the fight opens.
        if (playerRoster.some(c => c.gridPos > 0 && c.hp < c.maxHp)) acted++;
      }
      return { checked, acted };
    });
    ok(`a hostile that opens the fight has not swung yet (${quiet.checked} such fights, ${quiet.acted} with a hurt squad)`,
      quiet.checked > 0 && quiet.acted === 0);

    // ── And a second application really would step it again ─────────────────────────
    // Which is what gives the assertion above its teeth. If applyTurnStartEffects were
    // idempotent, "cooldown 3 -> 2" would hold whether the harness applied it a second time or
    // not, and the whole finding would be unfalsifiable. It is not idempotent: this is the
    // second step the harness was taking, shown rather than argued.
    //
    // nextTurn is deliberately not driven here - it is not on the engine's export surface, so a
    // walk would have to hand-roll the queue advance, which is the copy this whole item is about.
    // The opener is the only actor the engine pre-opens, and the opener is what this pins.
    const twice = await page.evaluate(() => {
      const step = cooldownStep();
      for (let i = 0; i < 60; i++) {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null; activeContracts = [];
        currentSector = 3; currentTier = 6;
        playerRoster.forEach(c => { if (c.cooldowns) for (const k in c.cooldowns) c.cooldowns[k] = 3; });
        initiateCombat('RAIDERS', false);
        const lead = turnQueue[activeIndex];
        if (!lead || !lead.isPlayer) continue;
        const key = Object.keys(lead.cooldowns || {})[0];
        if (!key) continue;
        const afterEngine = lead.cooldowns[key];
        applyTurnStartEffects(lead);
        return { found: true, afterEngine, afterHarness: lead.cooldowns[key], step };
      }
      return { found: false, step };
    });
    ok('a player-led fight is reachable to demonstrate it on', twice.found === true);
    ok(`the engine's own opening leaves it stepped once (3 -> ${twice.afterEngine})`,
      twice.afterEngine === 3 - twice.step);
    ok(`and applying turn-start again steps it a second time, which is the bug (${twice.afterEngine} -> ${twice.afterHarness})`,
      twice.afterHarness === twice.afterEngine - twice.step);
  }
};

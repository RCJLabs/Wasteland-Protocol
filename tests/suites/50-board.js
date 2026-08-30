// Four contracts, and every one of them counted something the squad was going to do anyway:
// kill hostiles, craft items, trigger combos. The board never asked for a decision, it just
// watched. These ask for a fight won a particular way, a road taken on purpose, or a resource
// held that you would rather have spent.
module.exports = {
  name: 'A living board',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the pools ----
    const pools = await page.evaluate(() => {
      const wellFormed = pool => pool.every(b => {
        if (!b.type || typeof b.label !== 'function' || !Array.isArray(b.range) || !(b.reward > 0)) return false;
        if (!(b.range[0] >= 1 && b.range[1] >= b.range[0])) return false;
        for (let n = b.range[0]; n <= b.range[1]; n++) {
          const s = b.label(n);
          if (typeof s !== 'string' || s.length < 6) return false;
        }
        return true;
      });
      return {
        board: BOUNTY_POOL.map(b => b.type), standing: STANDING_POOL.map(b => b.type),
        boardOk: wellFormed(BOUNTY_POOL), standingOk: wellFormed(STANDING_POOL),
        uniqueBoard: new Set(BOUNTY_POOL.map(b => b.type)).size,
        uniqueStanding: new Set(STANDING_POOL.map(b => b.type)).size,
        gated: BOUNTY_POOL.filter(b => (b.minSector || 1) > 1).map(b => b.type),
        prefixed: STANDING_POOL.every(b => b.type.startsWith('S_'))
      };
    });
    ok(`${pools.board.length} contracts in the rotation, each labelled across its whole range`,
      pools.board.length >= 12 && pools.boardOk && pools.uniqueBoard === pools.board.length);
    ok(`and ${pools.standing.length} that run the length of an expedition`,
      pools.standing.length >= 4 && pools.standingOk && pools.uniqueStanding === pools.standing.length);
    ok('the standing ones are named apart from the board', pools.prefixed);

    // ---- nothing on either board is a contract nobody can settle ----
    const reachable = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const fired = t => src.includes(`checkBountyProgress('${t}')`);
      const advances = [];
      BOUNTY_POOL.forEach(spec => {
        currentSlot = 1; confirmNewGame(1.0); currentSector = 3;
        activeBounties = [{ type: spec.type, desc: 'x', current: 0, target: 9, reward: 1, claimed: false }];
        checkBountyProgress(spec.type);
        if (activeBounties[0].current !== 1) advances.push(spec.type);
      });
      STANDING_POOL.forEach(spec => {
        currentSlot = 1; confirmNewGame(1.0);
        standingBounty = { type: spec.type, desc: 'x', current: 0, target: 9, reward: 1, standing: true };
        checkBountyProgress(spec.type.slice(2));
        if (standingBounty.current !== 1) advances.push(spec.type);
      });
      return { unfiredBoard: BOUNTY_POOL.map(b => b.type).filter(t => !fired(t)),
               unfiredStanding: STANDING_POOL.map(b => b.type.slice(2)).filter(t => !fired(t)),
               deaf: advances };
    });
    ok('every contract the board can post is raised somewhere in the engine',
      reachable.unfiredBoard.length === 0 && reachable.unfiredStanding.length === 0);
    if (reachable.unfiredBoard.length) console.log('        never fired: ' + reachable.unfiredBoard.join(', '));
    ok('and every one of them advances when its moment comes', reachable.deaf.length === 0);

    // A contract that needs a system the opening sector has not shown yet waits for it.
    const gate = await page.evaluate(() => {
      const sample = s => { currentSector = s; const seen = new Set();
        for (let i = 0; i < 600; i++) seen.add(rollBounty([]).type); return [...seen]; };
      currentSlot = 1; confirmNewGame(1.0);
      const shallow = sample(1), deep = sample(3);
      return { shallow, deep, gated: BOUNTY_POOL.filter(b => (b.minSector || 1) > 1).map(b => b.type) };
    });
    ok(`the gated contracts stay out of sector 1 (${gate.gated.join(', ')})`,
      gate.gated.length > 0 && gate.gated.every(t => !gate.shallow.includes(t)));
    ok(`and every contract is drawable once the run is deep enough (${gate.deep.length})`,
      gate.deep.length === pools.board.length);

    // ---- the board no longer pays for merely existing ----
    // A plain blow that does not kill, from a rank that costs reach, should settle nothing at
    // all. That is the whole difference between this board and the one before it.
    const idle = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 3; currentTier = 6;
      initiateCombat('RAIDERS', false);
      currentTerrain = 'OPEN_ROAD';
      activeBounties = BOUNTY_POOL.map(b => ({ type: b.type, desc: b.type, current: 0, target: 9, reward: 1, claimed: false }));
      const hero = playerRoster.find(p => p.gridPos > 0);
      hero.gridPos = 3;                                  // reaching, so REACH cannot fire
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.hp = 9999; foe.maxHp = 9999; foe.isHeavy = false;
      applyDamageHit(hero, foe, 10, 'phys', 'PISTOL');
      const moved = activeBounties.filter(b => b.current > 0).map(b => b.type);
      combatActive = false;
      return { moved };
    });
    ok(`a blow that kills nothing settles nothing (${idle.moved.join(', ') || 'nothing moved'})`,
      idle.moved.length === 0);

    // ---- how a fight was won, not what happened in it ----
    const won = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 3; currentTier = 6;
      initiateCombat('RAIDERS', false);
      const fresh = JSON.parse(JSON.stringify(fightLog));
      const board = () => { activeBounties = ['FLAWLESS', 'BLITZ', 'FRUGAL', 'GROUND', 'CHASED']
        .map(t => ({ type: t, desc: t, current: 0, target: 9, reward: 1, claimed: false })); };
      const read = () => Object.fromEntries(activeBounties.map(b => [b.type, b.current]));

      board(); currentTerrain = 'OPEN_ROAD';
      fightLog = newFightLog(); fightLog.turns = BLITZ_TURNS - 1;
      noteFightWon(); const clean = read();

      board();
      fightLog = newFightLog(); fightLog.turns = BLITZ_TURNS + 20; fightLog.hurt = true; fightLog.spent = true;
      noteFightWon(); const messy = read();

      board(); currentTerrain = 'TUNNELS';
      fightLog = newFightLog(); fightLog.turns = 99; fightLog.hurt = true; fightLog.spent = true; fightLog.chased = true;
      noteFightWon(); const hardRoad = read();

      currentTerrain = 'OPEN_ROAD'; combatActive = false;
      return { fresh, clean, messy, hardRoad };
    });
    // The squad's first turn has already begun by the time the fight is on screen, so the turn
    // count opens at one, not nought. Nothing about how the fight went is recorded yet.
    ok(`a fight opens with a clean sheet (turn ${won.fresh.turns})`,
      won.fresh.turns <= 1 && !won.fresh.hurt && !won.fresh.spent && !won.fresh.chased);
    ok('an untouched, quick, unspent win settles all three',
      won.clean.FLAWLESS === 1 && won.clean.BLITZ === 1 && won.clean.FRUGAL === 1);
    ok('a slow, bloody, expensive one settles none of them',
      won.messy.FLAWLESS === 0 && won.messy.BLITZ === 0 && won.messy.FRUGAL === 0);
    ok('and the road it was fought on counts separately',
      won.hardRoad.GROUND === 1 && won.hardRoad.CHASED === 1 && won.hardRoad.FLAWLESS === 0);

    // The log is per fight, not per run: the next node starts over.
    const perFight = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 3; currentTier = 6;
      initiateCombat('RAIDERS', false);
      fightLog.hurt = true; fightLog.spent = true; fightLog.turns = 40;
      initiateCombat('RAIDERS', false);
      const out = JSON.parse(JSON.stringify(fightLog));
      combatActive = false;
      return out;
    });
    ok(`and it is wiped when the next fight opens (turn ${perFight.turns} after a 40-turn fight)`,
      !perFight.hurt && !perFight.spent && perFight.turns <= 1);

    // ---- the board rotates, the standing contract does not ----
    const rotation = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); currentSector = 2;
      activeBounties = [
        { type: 'KILL', desc: 'k', current: 0, target: 1, reward: 7, claimed: false },
        { type: 'CRAFT', desc: 'c', current: 0, target: 9, reward: 1, claimed: false },
        { type: 'COMBO', desc: 'm', current: 0, target: 9, reward: 1, claimed: false }];
      const before = scrap;
      checkBountyProgress('KILL');
      const replaced = activeBounties[0];
      return { paid: scrap - before, slots: activeBounties.length,
               replacedType: replaced.type, fresh: replaced.current === 0,
               noRepeat: new Set(activeBounties.map(b => b.type)).size === 3 };
    });
    ok(`a settled contract pays and a new one takes its slot (+${rotation.paid} scrap)`,
      rotation.paid === 7 && rotation.slots === 3 && rotation.fresh);
    ok('and the board never hands back a type it is already carrying', rotation.noRepeat);

    const standing = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); currentSector = 4;
      // Flat, not sector-scaled: it is paid for the whole run rather than for where the run
      // happened to be standing when it settled.
      const spec = STANDING_POOL.find(b => b.type === 'S_ELITE');
      const rolled = rollStanding(() => 0);
      const flat = STANDING_POOL[0].reward * STANDING_POOL[0].range[0];
      standingBounty = { type: 'S_BOSS', desc: 'x', current: 1, target: 2, reward: 900, standing: true };
      const was = standingBounty.type;
      const before = scrap;
      checkBountyProgress('BOSS');
      const after = standingBounty;
      // Clearing an ordinary node must not rotate it.
      const held = { ...after };
      checkBountyProgress('KILL');
      return { rolledFlat: rolled.reward === flat, paid: scrap - before, was,
               reposted: after.current === 0 && after.target > 0,
               stillThere: standingBounty.desc === held.desc, spec: !!spec };
    });
    ok(`the standing contract pays flat, not by sector (+${standing.paid} at sector 4)`,
      standing.paid === 900 && standing.rolledFlat);
    ok('a fresh one is posted the moment it settles', standing.reposted);
    ok('and clearing an ordinary node does not rotate it', standing.stillThere);

    // One hook feeds both, so no call site has to remember to fire twice.
    const shadow = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); currentSector = 2;
      activeBounties = [{ type: 'ELITE', desc: 'e', current: 0, target: 9, reward: 1, claimed: false }];
      standingBounty = { type: 'S_ELITE', desc: 's', current: 0, target: 9, reward: 1, standing: true };
      checkBountyProgress('ELITE');
      return { board: activeBounties[0].current, standing: standingBounty.current };
    });
    ok('one moment advances the board and the standing contract together',
      shadow.board === 1 && shadow.standing === 1);

    // ---- it is on the screen ----
    const shown = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); renderMap();
      const rows = [...document.querySelectorAll('#bounty-list .bounty-item')];
      const mark = rows.filter(r => r.classList.contains('bounty-standing'));
      return { rows: rows.length, marked: mark.length,
               tells: mark.length === 1 && /Scrap/.test(mark[0].title) && mark[0].title.length > 40,
               counted: rows.every(r => /\[\d+\/\d+\]/.test(r.innerText)) };
    });
    ok(`the board shows three contracts and the standing one (${shown.rows} rows)`,
      shown.rows === 4 && shown.marked === 1);
    ok('each with its progress, and the standing one saying what it pays',
      shown.counted && shown.tells);

    // ---- through a reload, and gone by the next run ----
    await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      standingBounty.current = 2; activeBounties[0].current = 1;
      saveGameState();
    });
    const kept = await page.evaluate(() => ({ desc: standingBounty.desc, at: standingBounty.current }));
    await page.reload();
    await page.waitForTimeout(600);
    const back = await page.evaluate(() => {
      currentSlot = 1; loadGameState();
      const after = { desc: standingBounty.desc, at: standingBounty.current, board: activeBounties[0].current };
      currentSlot = 1; confirmNewGame(1.0);
      return { after, fresh: standingBounty.current, freshBoard: activeBounties.every(b => b.current === 0) };
    });
    ok(`the standing contract survives a reload (${back.after.desc} at ${back.after.at})`,
      back.after.desc === kept.desc && back.after.at === kept.at && back.after.board === 1);
    ok('and a new expedition posts a fresh board', back.fresh === 0 && back.freshBoard);

    // ---- and the game says the board exists ----
    const taught = await page.evaluate(() => {
      const text = CODEX.map(e => e.body().join(' ')).join(' ');
      const p = PROMPTS.find(x => x.id === 'STANDING');
      return { manual: /standing contract/i.test(text) && text.includes(String(BOUNTY_POOL.length)),
               prompt: !!p && /expedition/i.test(p.body) };
    });
    ok('the manual counts the rotation and names the standing contract', taught.manual);
    ok('and the prompt explains it the first time one settles', taught.prompt);
  }
};

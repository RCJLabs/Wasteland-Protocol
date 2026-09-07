// G02. The Ossuary is the one commander nothing had ever measured. It stands at the top of
// sector 7, it is not in the rotation that holds the road, and G01 found 0 of 150 runs reaching
// it against 1102 fights with the seven below it - which is how a defect that let a single
// casualty cap its tally survived an eight-reader audit and fifteen phases. G13 then ruled out
// the harness's play as the cause, so the fix was a staged arm rather than a longer sample.
//
// This suite pins the engine-side facts that arm rests on. `--stage 7` in tests/simulate.js is
// only honest while the last sector really is where this commander is dealt and while its
// learned move really is gated the way the readout says - and a staged measurement that quietly
// stopped meeting the thing it was built to meet would still print a number.
//
// It also drives victoryWalk and victoryPress, which G11's coverage line named as two of the
// exports no suite touched, and which are the two ways a run can end well.
module.exports = {
  name: 'The last warlord',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── Where it is dealt, and where it is not ────────────────────────────────────
    const dealt = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const out = { bySector: {}, finalId: FINAL_BOSS ? FINAL_BOSS.id : null, finalSector: FINAL_SECTOR };
      for (let s = 1; s <= FINAL_SECTOR; s++) out.bySector[s] = bossForSector(s).id;
      out.inRotation = BOSS_ROTATION.some(b => (b.id || b) === out.finalId);
      out.rotationSize = BOSS_ROTATION.length;
      return out;
    });
    ok(`the road ends at sector ${dealt.finalSector} and a last warlord holds it (${dealt.finalId})`,
      dealt.finalId && dealt.finalSector > 1);
    ok(`it is dealt at the last sector (${dealt.bySector[dealt.finalSector]})`,
      dealt.bySector[dealt.finalSector] === dealt.finalId);
    const elsewhere = Object.entries(dealt.bySector).filter(([s, id]) => Number(s) !== dealt.finalSector && id === dealt.finalId);
    ok(`and at no other depth${elsewhere.length ? ' — also at ' + elsewhere.map(([s]) => s).join(', ') : ''}`,
      elsewhere.length === 0);
    ok(`it is not one of the ${dealt.rotationSize} that hold the road`, dealt.inRotation === false);

    // ── The move G01 fixed without ever seeing it fire ────────────────────────────
    const learned = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const b = FINAL_BOSS;
      const at = LEARNED_AT;
      return {
        gate: at,
        declares: b.learned ? b.learned.sig : null,
        replaces: b.learned ? b.learned.replaces : null,
        below: learnedMove(b, at - 1),
        atGate: learnedMove(b, at) ? learnedMove(b, at).sig : null,
        above: learnedMove(b, at + 5) ? learnedMove(b, at + 5).sig : null,
        inSigTable: !!ENEMY_SIGS[b.learned && b.learned.sig]
      };
    });
    ok(`the last warlord brings a move of its own (${learned.declares}, in place of its ${learned.replaces})`,
      learned.declares === 'COUNT_YOURS');
    ok(`and it is a real signature, not a dangling name`, learned.inSigTable);
    ok(`it is withheld below the grudge gate (${learned.gate - 1} stacks -> ${learned.below})`,
      learned.below === null);
    ok(`brought at the gate (${learned.gate} stacks -> ${learned.atGate})`, learned.atGate === 'COUNT_YOURS');
    ok(`and kept above it (${learned.gate + 5} stacks -> ${learned.above})`, learned.above === 'COUNT_YOURS');
    // The gate is on the GRUDGE, which is earned by felling it - not on depth. That is why a
    // staged sample sees nothing until it has already won twice, and why the simulator prints
    // the grudge range beside the count instead of a bare "not seen".
    ok(`the gate is a count of stacks rather than a sector (${learned.gate})`,
      Number.isInteger(learned.gate) && learned.gate > 0);

    // ── The counting rule, at the commander that carries it ──────────────────────
    // 124 already drives the whole branch through executeEnemyAi. What belongs here is the pair
    // of helpers G01 added and the one thing 124 cannot say: that they are what the LAST
    // warlord's move reads, which is the reason the defect was unreachable in the first place.
    const counting = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const keeper = { id: 'ossuary-test', sig: 'COUNT_YOURS' };
      activeEntities = [];
      runStats.fallen = [];
      const out = { steps: [] };
      const step = () => out.steps.push([yoursDown(), uncountedYours(keeper)]);
      step();                                             // nobody gone
      runStats.fallen.push({ name: 'A' }, { name: 'B' });
      step();                                             // two gone, none counted yet
      keeper.countedYours = yoursDown();                  // it counts them
      step();                                             // and does not count them twice
      runStats.fallen.push({ name: 'C' });
      step();                                             // a third falls: exactly one new
      out.branchReads = /uncountedYours\(enemy\)/.test(String(WP.executeEnemyAi || ''));
      return out;
    });
    ok(`with nobody lost there is nothing to count (${counting.steps[0].join('/')})`,
      counting.steps[0][0] === 0 && counting.steps[0][1] === 0);
    ok(`two lost are two uncounted (${counting.steps[1].join('/')})`,
      counting.steps[1][0] === 2 && counting.steps[1][1] === 2);
    ok(`once counted they are not counted again (${counting.steps[2].join('/')})`,
      counting.steps[2][0] === 2 && counting.steps[2][1] === 0);
    ok(`and a fresh death is one more, not the whole list over (${counting.steps[3].join('/')})`,
      counting.steps[3][0] === 3 && counting.steps[3][1] === 1);

    // ── The two ways a run ends well ──────────────────────────────────────────────
    // G11 named victoryWalk and victoryPress as exports no suite reached. Both refuse outright
    // unless the run was actually won - which is the first thing to assert, because a test that
    // forgot to win would otherwise report the refusal as the feature working.
    const refused = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      currentSector = FINAL_SECTOR;
      runStats.deepestSector = FINAL_SECTOR;   // deep, but the warlord is still standing
      const before = { skulls: bossSkulls, extracted: !!runStats.extracted, screen: currentScreen() };
      victoryWalk();
      return { before, skulls: bossSkulls, extracted: !!runStats.extracted, screen: currentScreen() };
    });
    // careerWins is the wrong thing to watch here - victoryWalk never touches it either way, so
    // an assertion on it would pass whether or not the guard exists. What the guard protects is
    // the payout and the ending: a run that reached the last sector without felling what stands
    // there must not be able to cash it in.
    ok(`a run that was not won pays no skulls for walking (${refused.before.skulls} -> ${refused.skulls})`,
      refused.skulls === refused.before.skulls);
    ok('and is not marked as walked out of', refused.extracted === false);
    ok(`nor is the run closed by it (${refused.screen})`, refused.screen === refused.before.screen);
    // The win itself is banked where it is earned - careerWins++ sits in the block that fells
    // the last warlord, not here. By the time these two are offered the run is already won, and
    // they are the choice of what to do about it. What victoryWalk does is pay the depth out in
    // skulls and close the run.
    const walk = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      currentSector = FINAL_SECTOR;
      runStats.won = true; runStats.wonAtSector = FINAL_SECTOR; runStats.deepestSector = FINAL_SECTOR;
      const before = { skulls: bossSkulls, wins: careerWins };
      const due = extractSkulls(runStats);
      victoryWalk();
      return { before, due, skulls: bossSkulls, wins: careerWins, extracted: !!runStats.extracted };
    });
    ok(`walking a won road pays the road out in skulls (+${walk.skulls - walk.before.skulls}, ${walk.due} due)`,
      walk.due > 0 && walk.skulls === walk.before.skulls + walk.due);
    ok('and the run is marked as walked out of rather than lost', walk.extracted === true);
    ok(`it does not bank the win a second time — that was banked when the warlord fell (${walk.before.wins} -> ${walk.wins})`,
      walk.wins === walk.before.wins);
    const press = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      currentSector = FINAL_SECTOR;
      runStats.won = true;
      const winsBefore = careerWins;
      victoryPress();
      return { sector: currentSector, winsBefore, winsAfter: careerWins, over: !!(runStats && runStats.extracted) };
    });
    ok(`pressing on leaves the run open rather than ending it (sector ${press.sector}, extracted ${press.over})`,
      press.over === false);
    ok(`and it does not bank a second win for the same road (${press.winsBefore} -> ${press.winsAfter})`,
      press.winsAfter === press.winsBefore);

    // ── What the staged arm relies on the harness still doing ─────────────────────
    const path = require('path');
    const fs = require('fs');
    const sim = fs.readFileSync(path.join(__dirname, '..', 'simulate.js'), 'utf8');
    ok('the harness can stage a run at a deeper sector at all', /const STAGE = /.test(sim));
    ok('it stages through crossSector rather than assigning the sector',
      /while \(currentSector < stagePolicy\) crossSector\(\);/.test(sim));
    ok('it levels through awardXp and buys the bar through buyUpgrade, not onto the stat block',
      /awardXp\(c, Math\.max\(1, c\.xpToNext - c\.xp\)\)/.test(sim) && /buyUpgrade\(c\.id, 'HP', 0\)/.test(sim));
    ok('and its profile is keyed by sector, so sector 7 is not standing in for sector 2',
      /STAGE_PROFILE = \{[\s\S]*?7: \{/.test(sim));
  }
};

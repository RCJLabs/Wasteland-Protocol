// ── R02: EVERY FIGHT IN THE GAME HAS ONE WIN CONDITION ────────────────────────────────
//
// checkWinState ends a fight on `!pA` or `!eA` and on nothing else. There is no rout, no
// reinforcement, no clock, no objective, and no way to FAIL a fight while still standing. Set
// against 22 formations, 6 grounds, 9 skies, 5 factions and 19 commanders, the game has enormous
// variety in what a fight IS and none at all in what a fight is FOR.
//
// THE R-AUDIT'S OWN SENTENCE IS ONE ITEM OUT OF DATE and this suite is where that was found. It
// wrote "the eight intents are ATTACK, AOE, HEAVY, STATUS, DEFEND, FLANK, CHARGE, SALVO - all of
// them verbs for fighting, none for leaving". True when written; there are nine now, and the
// ninth is BREAK, which R03 added and which is exactly a verb for leaving. The correction makes
// the finding stronger, not weaker: R03 shipped a way for a BODY to leave a fight and the
// TERMINAL CONDITION still did not move. What is missing was never an exit for a hostile.
//
// THIS SUITE IS NOT THE FEATURE. It is the census that decides what the feature can be, built
// and held before anything is designed - the order H02 used, where the Reckoning was refuted
// twice by its own feasibility measurement before a line of it shipped. Three numbers nobody
// here has ever read: how long a fight runs in SQUAD turns, where in that span the squad takes
// its damage, and how much is still on its feet at each mark. If damage is front-loaded, a
// fight that ends early costs the player little and an objective is cheap content; if it
// accumulates, ending early IS a difficulty cut and any objective has to be priced as one.
//
// WHAT THIS FILE IS REALLY GUARDING is the seam the census nearly died on. The first cut hooked
// processTurn's own turn branch and read one sample per FIGHT instead of one per turn, because
// the SIMULATOR re-implements the turn walk (I02) and processTurn runs once per fight, at
// initiateCombat's tail. An instrument wired to a path the instrument does not take is D05's
// trap, and it reported a plausible number rather than nothing at all. So the count and the
// census now sit behind one function, noteSquadTurn, and this suite asserts that BOTH the
// engine's loop and any re-implementation reach it - by holding that processTurn calls it and
// that calling it is what moves the count.
const { engineUp } = require('../boot');

module.exports = {
  name: 'The shape of a fight',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`); await engineUp(page);

    // ── The premise, asserted at the function rather than described ──────────────────────
    const terminal = await page.evaluate(() => {
      const src = checkWinState.toString();
      return {
        src,
        pA: /const pA = activeEntities\.some\(e => e\.isPlayer && e\.hp > 0\)/.test(src),
        eA: /const eA = activeEntities\.some\(e => !e\.isPlayer && e\.hp > 0\)/.test(src),
        branches: (src.match(/if \(!pA\)|else if \(!eA\)/g) || []).length,
        intents: Object.keys(INTENT_WORDS),
        scored: Object.keys(INTENT_THREAT),
        threatBreak: INTENT_THREAT.BREAK,
        threatAttack: INTENT_THREAT.ATTACK,
      };
    });
    ok('a fight ends on one side being entirely down, read off both sides',
      terminal.pA && terminal.eA);
    ok(`and there are exactly two such branches and no third`, terminal.branches === 2);
    // THE OTHER HALF OF THE PREMISE, AND THE R-AUDIT GOT IT WRONG BY ONE ITEM. It wrote "the
    // eight intents are ATTACK, AOE, HEAVY, STATUS, DEFEND, FLANK, CHARGE, SALVO - all of them
    // verbs for fighting, none for leaving". That was true when written and is not true now:
    // R03 added BREAK, which is a hostile pulling out, so there are nine and one of them is a
    // verb for leaving. This assertion is written against the live table for that reason - the
    // first draft copied the audit's sentence, asserted eight, and went red on the ninth.
    //
    // The correction STRENGTHENS the finding rather than denting it. R03 proved a body can
    // leave a fight, shipped the intent for it, and the terminal condition still did not move:
    // a side that breaks still ends the fight by every body reaching zero. What is missing is
    // not a way OUT for a hostile - that exists - it is any way for a fight to END other than
    // by one side's last body going down.
    ok(`nine intents, and BREAK is the only one that is not a verb for fighting (${terminal.intents.join(', ')})`,
      terminal.intents.length === 9 && terminal.intents.includes('BREAK') &&
      !terminal.intents.some(i => /HOLD|GUARD|ESCORT|OBJECTIVE|TIMER/.test(i)));
    // A body pulling out threatens nobody, which is what lets the threat read stay honest while
    // R03's exit exists. Asserted off the scored table, not asserted `true` - the first draft of
    // this line passed a literal true with an undefined name interpolated into its label, which
    // is a free pass that would have survived the constant being deleted.
    ok(`BREAK is scored at no threat, unlike every verb for fighting`,
      terminal.scored.includes('BREAK') && terminal.threatBreak === 0 &&
      terminal.threatAttack > 0);

    // ── One door, and the engine goes through it ─────────────────────────────────────────
    const door = await page.evaluate(() => ({
      calls: /noteSquadTurn\(\)/.test(processTurn.toString()),
      noRaw: !/fightLog\.turns\+\+/.test(processTurn.toString()),
      body: noteSquadTurn.toString(),
    }));
    ok('processTurn counts a squad turn by calling noteSquadTurn', door.calls);
    ok('and does not increment the count itself - one door, so a second loop cannot drift',
      door.noRaw);
    ok('and that door does the counting AND the census together',
      /fightLog\.turns\+\+/.test(door.body) && /upAt/.test(door.body) && /nAt/.test(door.body));

    // ── What the door books ──────────────────────────────────────────────────────────────
    const booked = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      initiateCombat('RAIDERS', false);
      // Whatever the opening turn did, start the census from a known place.
      runStats.fightShape = null; fightLog.turns = 0;
      const up = () => activeEntities.filter(e => !e.isPlayer && e.hp > 0).length;
      const seen = [];
      for (let i = 0; i < 3; i++) { seen.push(up()); noteSquadTurn(); }
      const fs = runStats.fightShape;
      // Kill one and take another turn: the census should follow the field down.
      const first = activeEntities.find(e => !e.isPlayer && e.hp > 0);
      first.hp = 0;
      seen.push(up()); noteSquadTurn();
      return { turns: fightLog.turns, nAt: fs.nAt, upAt: fs.upAt, seen };
    });
    ok(`four calls make four squad turns (${booked.turns})`, booked.turns === 4);
    ok('and each one is sampled exactly once',
      [1, 2, 3, 4].every(k => booked.nAt[k] === 1));
    ok(`what was standing is booked per turn (${booked.seen.join(', ')})`,
      [1, 2, 3, 4].every((k, i) => booked.upAt[k] === booked.seen[i]));
    ok('and the count follows the field down when a body falls',
      booked.upAt[4] === booked.upAt[3] - 1);


    // ── Damage is booked where it landed, not where the fight ended ──────────────────────
    const dmg = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      initiateCombat('RAIDERS', false);
      runStats.fightShape = null; fightLog.turns = 0;
      const hero = activeEntities.find(e => e.isPlayer && e.hp > 0);
      const foe = activeEntities.find(e => !e.isPlayer && e.hp > 0);
      hero.maxHp = 9999; hero.hp = 9999;
      noteSquadTurn();                       // turn 1
      applyDamageHit(foe, hero, 10, 'kinetic', 'STRIKE');
      noteSquadTurn(); noteSquadTurn();       // turns 2, 3
      applyDamageHit(foe, hero, 25, 'kinetic', 'STRIKE');
      const fs = runStats.fightShape;
      return { dmgAt: fs.dmgAt, turns: fightLog.turns };
    });
    ok('a blow is filed under the squad turn it landed in',
      dmg.dmgAt[1] > 0 && dmg.dmgAt[3] > 0 && !dmg.dmgAt[2]);
    ok('and the later blow is the larger one, so the buckets are not swapped',
      dmg.dmgAt[3] > dmg.dmgAt[1]);

    // ── Only the squad's damage, and only a fight's own turns ────────────────────────────
    const sides = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      initiateCombat('RAIDERS', false);
      runStats.fightShape = null; fightLog.turns = 0;
      const hero = activeEntities.find(e => e.isPlayer && e.hp > 0);
      const foe = activeEntities.find(e => !e.isPlayer && e.hp > 0);
      foe.maxHp = 9999; foe.hp = 9999;
      noteSquadTurn();
      applyDamageHit(hero, foe, 30, 'kinetic', 'STRIKE');   // squad hitting THEM
      const only = JSON.parse(JSON.stringify(runStats.fightShape.dmgAt));
      return { only };
    });
    ok('damage the squad DEALS is not booked as damage it took',
      Object.keys(sides.only).length === 0);

    // ── Both endings are counted, and kept apart ─────────────────────────────────────────
    const ends = await page.evaluate(() => {
      const run = wipeSquad => {
        currentSlot = 1; confirmNewGame(1.0);
        initiateCombat('RAIDERS', false);
        runStats.fightShape = null; fightLog.turns = 0;
        noteSquadTurn(); noteSquadTurn();
        activeEntities.forEach(e => {
          if (wipeSquad ? e.isPlayer : !e.isPlayer) e.hp = 0;
        });
        checkWinState();
        const fs = runStats.fightShape;
        return { len: JSON.parse(JSON.stringify(fs.len)), lost: JSON.parse(JSON.stringify(fs.lenLost)),
                 blitz: JSON.parse(JSON.stringify(fs.blitz || {})) };
      };
      return { won: run(false), lost: run(true) };
    });
    ok('a fight the squad won is filed under its length', ends.won.len[2] === 1);
    // The engine's verdict on its own quick-win threshold, booked rather than the threshold
    // itself: suite 132's dead-field scan caught the bare constant as the one field in this
    // engine written and never read here, and it was right - every other census field self-reads
    // through `(x || 0) + 1`. A two-turn win is inside the window and counts.
    ok(`a quick win is counted against the engine's own window (${ends.won.blitz.won} of 1, window ${ends.won.blitz.turns})`,
      ends.won.blitz.won === 1 && ends.won.blitz.turns > 2);
    ok('and a fight the squad lost never counts as a quick win',
      ends.lost.blitz.won === 0);
    ok('and not under the losses', Object.keys(ends.won.lost).length === 0);
    ok('a fight the squad lost is filed separately', ends.lost.lost[2] === 1);
    ok('and not under the wins', Object.keys(ends.lost.len).length === 0);

    // ── And the exit that books NEITHER, which is the finding itself ─────────────────────
    // A fight the squad walks out of never reaches checkWinState, so it takes turns and is
    // counted in nAt while appearing in neither histogram. That gap is not a defect: it is the
    // one non-body-count exit this game already has, and the report prints it as a row rather
    // than letting it show up as a share over a hundred - which is exactly how it was found.
    const walked = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      initiateCombat('RAIDERS', false);
      runStats.fightShape = null; fightLog.turns = 0;
      noteSquadTurn(); noteSquadTurn(); noteSquadTurn();
      const fs = runStats.fightShape;
      // No terminal condition reached: nobody is down on either side.
      const pA = activeEntities.some(e => e.isPlayer && e.hp > 0);
      const eA = activeEntities.some(e => !e.isPlayer && e.hp > 0);
      return { started: fs.nAt[1], won: Object.keys(fs.len).length,
               lost: Object.keys(fs.lenLost).length, pA, eA };
    });
    ok('a fight still running counts as started', walked.started === 1 && walked.pA && walked.eA);
    ok('and is in neither histogram, so "still running" needs the started denominator',
      walked.won === 0 && walked.lost === 0);
  }
};

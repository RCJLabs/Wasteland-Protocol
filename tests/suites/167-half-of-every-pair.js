// M-audit. Two findings, both of the same kind: a reading this file could not make and did not
// say so.
//
// ONE. Every class has TWO overdrives and keeps the first one it ever fires for the rest of the
// run. overdriveFor falls back to pair[0] when nothing has chosen, and the simulator has never
// chosen - `odChoices` appeared nowhere in tests/simulate.js. Measured before the fix: 175
// overdrives fired across 40 expeditions, every one of them the first of its pair, nine of
// eighteen variants reached. P02 was a phase called "momentum worth spending - tactics and
// OVERDRIVE CHOICE", and no reading in this project has ever come off the second half of one.
// OVERWATCH - the sniper's, which marks everything it hits - is why this surfaced: M09's mark
// census listed SPOTTERS_MARK as the only source of a mark in 150 expeditions, and OVERWATCH
// should have been the other. It was not rare. It was unreachable.
//
// `--overdrive second` opens the other half: 0 vs 77 on the same sample, and the nine that had
// never fired all do. No dial moves here - which of the two halves is better is a measurement,
// and this is the door it needs rather than the answer.
//
// TWO. The report's census accumulators kept their key lists apart from their seeds, and the
// mismatch shipped three items running. That one is held in suite 163, beside M07's nums().
module.exports = {
  name: 'Half of every pair',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', '..');
    const sim = fs.readFileSync(path.join(root, 'tests', 'simulate.js'), 'utf8');

    // ── There are two of everything, and one door to the second ────────────────
    const pool = await page.evaluate(() => {
      const classes = Object.keys(OVERDRIVES);
      return { classes: classes.length,
               variants: classes.reduce((a, c) => a + OVERDRIVES[c].length, 0),
               singles: classes.filter(c => OVERDRIVES[c].length !== 2),
               // What overdriveFor hands back with nothing chosen, which is what every career
               // measured before this audit ran on.
               unchosen: (() => { odChoices = {}; return classes.map(c => overdriveFor(c).id); })(),
               firsts: classes.map(c => OVERDRIVES[c][0].id) };
    });
    ok(`${pool.classes} classes carry ${pool.variants} overdrives between them`, pool.variants === pool.classes * 2);
    ok(`and every one of them is a pair (${pool.singles.length} odd ones${pool.singles.length ? ': ' + pool.singles.join(', ') : ''})`,
      pool.singles.length === 0);
    // THE FINDING, as an assertion rather than a story: with nothing chosen the engine hands back
    // the first of every pair, so a harness that never chooses measures exactly half the content.
    ok('with nothing chosen the engine hands back the first of every pair, all nine of them',
      JSON.stringify(pool.unchosen) === JSON.stringify(pool.firsts));

    // ── The choice is a real one, and taking it reaches the other half ──────────
    const chosen = await page.evaluate(() => {
      odChoices = Object.fromEntries(Object.entries(OVERDRIVES)
        .filter(([, p]) => p.length > 1).map(([cls, p]) => [cls, p[1].id]));
      const got = Object.keys(OVERDRIVES).map(c => overdriveFor(c).id);
      const seconds = Object.keys(OVERDRIVES).map(c => OVERDRIVES[c][1].id);
      odChoices = {};
      return { got, seconds };
    });
    ok('choosing the second of each pair is what odChoices is for, and overdriveFor honours it',
      JSON.stringify(chosen.got) === JSON.stringify(chosen.seconds));

    // ── The simulator can now do that, and does it at the right moment ──────────
    // The first cut of the arm set odChoices BEFORE confirmNewGame, which zeroes it, so the flag
    // silently did nothing - the same shape as every other harness bug this phase turned up. The
    // ordering is the assertion, not the assignment.
    const flagAt = sim.indexOf("const OVERDRIVE_POLICY = flag('overdrive', 'first')");
    const setAt = sim.indexOf("if (odPolicy === 'second') {");
    const newGameAt = sim.indexOf('confirmNewGame(difficulty);');
    ok('the simulator has a flag for it, defaulting to what every earlier career ran', flagAt > 0
      && /flag\('overdrive', 'first'\)/.test(sim));
    ok(`and it takes the choice AFTER confirmNewGame, which zeroes it (${newGameAt} then ${setAt})`,
      setAt > newGameAt && newGameAt > 0);
    ok('confirmNewGame really does zero it, which is why the order matters',
      /odChoices = \{\}; pendingOverdrive = null;/.test(fs.readFileSync(path.join(root, 'game.js'), 'utf8')));

    // ── And the census says which half fired, so this cannot go quiet again ─────
    const census = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);      // runStats does not exist before a run does
      runStats.od = null;
      const bump = (id, at, cls) => {
        runStats.od = runStats.od || {};
        const row = runStats.od[id] = runStats.od[id] || { fired: 0, _at: at, _cls: cls };
        row.fired++;
      };
      bump('EARTHSHAKER', 0, 'BRUISER'); bump('EARTHSHAKER', 0, 'BRUISER');
      bump('OVERWATCH', 1, 'SNIPER');
      return JSON.parse(JSON.stringify(runStats.od));
    });
    ok(`the census counts firings per variant (${Object.keys(census).join(', ')})`,
      census.EARTHSHAKER.fired === 2 && census.OVERWATCH.fired === 1);
    ok('and records which HALF of the pair each one was, which is the whole finding',
      census.EARTHSHAKER._at === 0 && census.OVERWATCH._at === 1);
    // Position is a label, not a count - three careers of `_at: 1` must not read as slot 3. The
    // report's fold carries _-prefixed keys instead of summing them, which suite 163 holds.
    // The stamp lives in game.js, where the overdrive resolves - not in the report that reads it.
    ok('the position is marked as a label so the report does not add it up',
      /_at: at, _cls: cls/.test(fs.readFileSync(path.join(root, 'game.js'), 'utf8')));
    ok('the report says plainly when a whole half of the content never fired',
      /THE SECOND HALF OF EVERY PAIR HAS NEVER FIRED HERE/.test(sim));

    // ── M10: and what the damage column is not ─────────────────────────────────
    // M10 measured the fork with both halves firing and found the wall unmoved, then found its
    // own sensitive measure useless for ranking them: the window is the overdrive's own
    // resolution, and the second half of nearly every pair spends its value after that - burns,
    // bleeds, corrode, a cleanse, a cost to its holder. The bias runs one way. A column that
    // reads like a ranking and is not one has to say so where it prints, not only in a header
    // nobody scrolls to, so these rows hold the caveat on the line itself.
    ok('the per-firing column names itself as something other than a ranking',
      /NOT a ranking - see above/.test(sim));
    ok('and the note above it names the mechanism rather than just warning',
      /BACKBURNER's three turns of burning/.test(sim) && /the bias runs one way/.test(sim));
    const delayed = await page.evaluate(() => {
      const second = Object.values(OVERDRIVES).filter(p => p.length > 1).map(p => p[1]);
      // The claim the caveat rests on: the second halves really are the delayed ones.
      return { total: second.length,
               delayed: second.filter(o => /burning|bleed|corrode|oil|cleanse|heal|costs/i.test(o.desc)).map(o => o.id) };
    });
    ok(`${delayed.delayed.length} of ${delayed.total} second halves spend their value after the turn they fire in (${
        delayed.delayed.map(i => i.toLowerCase()).join(', ')})`,
      delayed.delayed.length >= 5);
  }
};

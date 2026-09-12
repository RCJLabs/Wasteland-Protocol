// M07. M06 ended on a number it could not interpret: basic attacks at "4.4-4.7% of moves". Three
// things were wrong with it and all three are the same mistake, which is why they get a suite.
//
//   1. THE DENOMINATOR WAS NOT TURNS. stat.moves counts a tactic purchase beside an ability, and
//      a tactic is FREE - buy() does not return, the actor still picks a move afterwards. A
//      fifth of that tally never cost anybody a turn. turnsPlayer has counted turns correctly
//      the whole time and no readout had ever divided by it.
//   2. THE NUMERATOR CAME OFF A DIFFERENT PATH. Basic attacks are picked by the ranking, which
//      only runs on the turns no earlier case claimed - four turns in five. Dividing a
//      ranking-path count by every turn understates it.
//   3. AND A MISSING COUNTER READ AS NaN RATHER THAN ZERO, because nums() returned undefined for
//      a key a run never touched. That only shows up the day some run scores zero, and then it
//      reads as a broken report rather than as a missing initialiser.
//
// Corrected, the answer is different in kind: about a tenth of turns, and seven in ten of those
// thrown with nothing else off cooldown. This suite holds the arithmetic, because a share
// reported against the wrong denominator is how D05, D06 and M06 each went wrong.
module.exports = {
  name: 'What a share is a share of',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    const fs = require('fs');
    const path = require('path');
    const sim = fs.readFileSync(path.join(__dirname, '..', 'simulate.js'), 'utf8');

    // ── A missing counter is zero, not NaN ──────────────────────────────────────
    // The fix is in nums() rather than in each new counter's initialiser, because relying on
    // everybody remembering to declare a key is how this got here. Exercised rather than
    // grepped: the same expression the report uses, run against a result set with a hole in it.
    const holed = await page.evaluate(() => {
      const results = [{ a: 3 }, {}, { a: 4 }];
      const safe = key => results.map(r => Number(r[key]) || 0).sort((x, y) => x - y);
      const naive = key => results.map(r => r[key]).sort((x, y) => x - y);
      const tot = a => a.reduce((x, y) => x + y, 0);
      return { safe: tot(safe('a')), naive: tot(naive('a')), missing: tot(safe('nope')) };
    });
    ok(`a counter one run never touched sums to ${holed.safe}, not NaN (the naive read gives ${holed.naive})`,
      holed.safe === 7 && Number.isNaN(holed.naive));
    ok(`and a counter NO run touched is zero rather than nothing (${holed.missing})`, holed.missing === 0);
    ok('the simulator reads its tallies that way, so the next counter cannot repeat it',
      /const nums = key => results\.map\(r => Number\(r\[key\]\) \|\| 0\)/.test(sim));

    // ── A free action is not a turn ──────────────────────────────────────────────
    // buy() spends momentum and returns to the same turn - the actor goes on to pick a move. So
    // the tactic is real, but it is not a turn, and the two cannot share a denominator.
    const free = (() => {
      const at = sim.indexOf('const buy = id =>');
      const body = sim.slice(at, sim.indexOf('\n    };', at));
      return { tallied: /stat\.freeActions/.test(body),
               returnsTrue: /return true;/.test(body),
               // The caller must NOT return on a bought tactic, or it would be a turn after all.
               callerFallsThrough: /if \(tacticPolicy === 'stim'\) \{\n\s*if \(momentum >= 30 && stimTarget\(\)\) buy\('STIM'\);/.test(sim) };
    })();
    ok('a bought tactic is tallied as a free action', free.tallied);
    ok('and the turn carries on past it rather than ending there', free.callerFallsThrough);

    // ── The ranking path has its own denominator ────────────────────────────────
    const ranked = (() => {
      const at = sim.indexOf('stat.ranked = (stat.ranked || 0) + 1;');
      const near = sim.slice(at, at + 700);
      return { exists: at > 0,
               withBasic: /stat\.basicPicked/.test(near),
               withDepth: /stat\.handDepth/.test(near),
               reportDivides: /picked \/ ranked/.test(sim) };
    })();
    ok('the turns that reach the ranking are counted where the ranking happens',
      ranked.exists && ranked.withBasic && ranked.withDepth);
    ok('and the basic-attack share is reported against that, not against every turn',
      ranked.reportDivides);

    // ── Every turn is counted once, on both paths out of takeTurn ───────────────
    // An operator with everything cooling presses HOLD and returns early; everyone else falls
    // through. Both are turns. If only one incremented, every share here would be wrong again.
    const turns = (() => {
      const at = sim.indexOf('const takeTurn = () => {');
      const body = sim.slice(at, sim.indexOf('\n  };', at));
      return { increments: (body.match(/stat\.turnsPlayer = \(stat\.turnsPlayer \|\| 0\) \+ 1;/g) || []).length,
               heldPath: /stat\.held = \(stat\.held \|\| 0\) \+ 1;[\s\S]{0,120}stat\.turnsPlayer/.test(body) };
    })();
    ok(`takeTurn counts a turn on ${turns.increments} paths out of it`, turns.increments >= 2);
    ok('including the one where there was nothing to press', turns.heldPath);

    // ── The report says which denominator each figure used ──────────────────────
    // The rule this phase exists to enforce, as an assertion on the output rather than a note:
    // a percentage whose denominator is not named is a percentage nobody can check.
    ok('the basic-attack line names all three denominators it could be read against',
      /which is \$\{\(picked \/ turns \* 100\)/.test(sim) && /of the move tally M06 read/.test(sim));
    ok('and the free actions are printed beside the turn count rather than folded into it',
      /plus \$\{free\} tactics bought without spending one/.test(sim));
  }
};

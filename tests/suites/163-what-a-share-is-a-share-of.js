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

    // ── M-audit: the same defect three times, and then the class ────────────────
    // M07 fixed this in nums(): a key a run never touched read as undefined, `a + undefined`
    // came out NaN, and the sums built on it carried that to the page. M08's per-card
    // accumulator then hand-listed its keys and dropped one. M09's mark ledger listed two keys
    // in the SUM and not the SEED - `|| 0` turned the NaN into a believable zero and a working
    // card read as absent for three runs. The audit found five accumulators still carrying that
    // shape, three of which did not coerce at all.
    //
    // The cause every time is a key list kept somewhere other than the thing it counts, so the
    // fix is to have no key list: one fold walks whatever the run actually carried. These rows
    // hold that, because a helper nobody is required to use is a convention rather than a fix.
    const fold = sim.slice(sim.indexOf('const foldStats ='), sim.indexOf('const nums = key =>'));
    ok('there is one fold, and it walks what the run carried rather than a declared list',
      /Object\.entries\(from\)\.forEach/.test(fold) && !/\['\w+', '\w+'/.test(fold));
    ok('it sums numbers, recurses into bags, and carries _-prefixed labels instead of adding them',
      /typeof v === 'number'/.test(fold) && /foldStats\(into\[k\] = into\[k\] \|\| \{\}, v\)/.test(fold)
      && /k\[0\] === '_'/.test(fold));
    // THE ROW THAT STOPS THE FOURTH TIME. Every per-run census the report adds up goes through
    // it; a new one that hand-rolls its own loop is what this catches.
    const folded = (sim.match(/foldAll\('/g) || []).length;
    ok(`${folded} censuses are accumulated through it`, folded >= 8);
    const handRolled = sim.split('\n')
      .filter(l => /\.(seen|fired|tried|moved|atFront|swings|blows|hitDmg) \+=/.test(l) && !/foldStats/.test(l));
    ok(`and none is still hand-rolled (${handRolled.length}${handRolled.length ? ': ' + handRolled[0].trim().slice(0, 60) : ''})`,
      handRolled.length === 0);
    // A ground's multiplier is a label that lives in a counted bag, so the engine marks it and
    // the fold carries it. Three careers of x0.8 must not read as x2.4.
    ok('the one label inside a counted bag is marked so the fold does not add it up',
      /_mult: cover\.mult/.test(fs.readFileSync(path.join(__dirname, '..', '..', 'game.js'), 'utf8')));

    // ── The report says which denominator each figure used ──────────────────────
    // The rule this phase exists to enforce, as an assertion on the output rather than a note:
    // a percentage whose denominator is not named is a percentage nobody can check.
    ok('the basic-attack line names all three denominators it could be read against',
      /which is \$\{\(picked \/ turns \* 100\)/.test(sim) && /of the move tally M06 read/.test(sim));
    ok('and the free actions are printed beside the turn count rather than folded into it',
      /plus \$\{free\} tactics bought without spending one/.test(sim));

    // ── N04: and WHICH SCALE, which is the same question one step further out ───
    // A figure divided by the run count is a per-career figure, and a reader who cannot tell it
    // from a total across the sample cannot use either. #197 tier A found the M11 combo block
    // printing "667 lethal" - a raw total - on a line whose other figures were already divided
    // by 150, so it read as 4.4 a career being 667. The guard tier A shipped was written against
    // the SPELLING (a bare sum()) and missed the same defect in its own bleed block one screen
    // below, where the leak was a bare FIELD instead.
    //
    // Written against the rule rather than the spelling now, and it is a simple rule: a line
    // that divides by n has to say what it divided by, where the reader is looking. A line that
    // names its denominator another way - "of ${n}", "% of runs", "mean" - has already answered
    // the question and is exempt.
    //
    // O-AUDIT: AND THE RULE ITSELF NAMED THE WRONG SCALE, which is why this row never caught
    // the thing it was written for. `n` is results.length - the number of EXPEDITIONS in the
    // sample - so a figure divided by n is per expedition. The rule above used to say it was
    // "a per-career figure", and a career in this file's own vocabulary is the whole sample:
    // every measurement on record is described as "three 150-expedition careers". So the guard
    // accepted "a career" on a line that had just divided the career by 150, and eight lines
    // said exactly that while seventeen others said "per run" for the identical computation -
    // both spellings inside one report, eleven lines apart:
    //
    //   operators put on the floor   125 (12.5 per run)
    //   combos fired                 260 (26.0 a career)     <- same total/n, other word
    //
    // Measured rather than argued: the same line reads 17,109 at --runs 4 and 16,272 at
    // --runs 8. A career total would double; a per-expedition figure does not move, and this
    // does not move.
    //
    // So "a career" is no longer accepted on a line that divides by n - not a style preference,
    // a statement that cannot be true of that computation.
    {
      const names = /a run|per run|\bmean\b|of \$\{n\}|% of runs/;
      const unscaled = [], miscalled = [];
      for (const m of sim.matchAll(/line\((.*?)\);\n/gs)) {
        const c = m[1];
        if (c.length > 1200 || !/\/\s*n\b|per\(/.test(c)) continue;
        const at = sim.slice(0, m.index).split('\n').length;
        if (/a career|each career/.test(c)) miscalled.push(at);
        else if (!names.test(c)) unscaled.push(at);
      }
      ok(`every figure divided by the run count says so${unscaled.length ? ' - line ' + unscaled.join(', ') : ''}`,
        unscaled.length === 0);
      ok(`and none of them calls a per-expedition figure a career${miscalled.length ? ' - line ' + miscalled.join(', ') : ''}`,
        miscalled.length === 0);
    }
  }
};

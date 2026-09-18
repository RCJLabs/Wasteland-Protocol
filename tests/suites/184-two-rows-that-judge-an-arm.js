// S03: the win count was never the only row, and it is the weaker of the two for difficulty.
//
// K06 put `what that count can resolve` directly under `runs that ended the road`, on the
// argument that a floor two thousand lines up gets skipped by exactly the phases that need it.
// That argument applies twice over now. S03 measured every headline row on twelve identical
// careers against six on #230's wall arm, and the wipe count - printed one line ABOVE the win
// count, and read by nobody - separates the same change at 2.6x the win count's margin:
//
//     wins   20.58 -> 28.33   +2.89 sd   base [10..27]   vs arm [22..36]   overlapping
//     wiped 110.08 -> 95.33   -7.41 sd   base [103..118] vs arm [89..97]   disjoint
//
// because the fifteen wipes the easing removed came back as +7.75 wins AND +7.00 recalls, so the
// win count sees about half the movement and the wipe count sees all of it.
//
// WHAT THIS SUITE IS FOR. The two lines fail in opposite directions - a lever that only moves how
// a surviving run ENDS is invisible on the wipe row and visible only on the win row - so the pair
// is the instrument and either one alone is half of it. This holds them together: both present,
// both computed the same way, neither quietly dropped. It is a text pin because the thing at risk
// is the report's wording and arithmetic, not the engine's behaviour.
const fs = require('fs'), path = require('path');
module.exports = {
  name: 'Two rows that judge an arm',
  run: async ({ ok }) => {
    const sim = fs.readFileSync(path.join(__dirname, '..', 'simulate.js'), 'utf8');

    // ── BOTH LINES EXIST ─────────────────────────────────────────────────────────────────
    const winLine  = /line\('  what that count can resolve'/.test(sim);
    const wipeLine = /line\('  what the wipe count can resolve'/.test(sim);
    ok('the win count still prints what it can resolve', winLine);
    ok('and so does the wipe count', wipeLine);

    // ── AND THEY AGREE ON THE CONVENTION, BECAUSE THERE IS ONLY ONE ──────────────────────
    // The first cut of this suite asserted that two separately-written pieces of arithmetic
    // matched, and caught them not matching - the win line held its arm sd in a const and the
    // wipe line computed it inline. Two sites agreeing is a thing that has to be checked forever;
    // one site is a thing that cannot disagree. So the arithmetic moved into a helper and this
    // asserts there is exactly one of it.
    const helper = /const resolves = \(count, of, unit\) => \{[\s\S]{0,400}?Math\.sqrt\(of \* p \* \(1 - p\)\)[\s\S]{0,400}?3 \* arm \* Math\.SQRT2/.test(sim);
    ok('one helper computes the sd of a proportion, its arm mean and the 3-sd bar', helper);
    ok('the win row reads it', /line\('  what that count can resolve', resolves\(wins\.length, n, 'wins'\)\)/.test(sim));
    ok('the wipe row reads it', /line\('  what the wipe count can resolve', resolves\(ends\.wiped \|\| 0, n, 'wipes'\)\)/.test(sim));
    ok('and no row re-derives the bar for itself',
      (sim.match(/Math\.SQRT2/g) || []).length === 1);

    // ── THE WIPE FLOOR IS READ OFF THE CENSUS, NOT RE-DERIVED ────────────────────────────
    // F03's rule. `ends` is the object the `ended by` line itself prints, so the floor and the
    // number it qualifies cannot disagree about how many runs were wiped.
    ok('the wipe floor reads the same census the ended-by line prints',
      /line\('ended by', Object\.entries\(ends\)[\s\S]{0,3000}?resolves\(ends\.wiped \|\| 0, n, 'wipes'\)/.test(sim));

    // ── THE LIMIT IS RECORDED BESIDE THE CLAIM ───────────────────────────────────────────
    // The one way this finding gets misused is as "the wipe count is the better row". It is not:
    // it is the better row FOR A LEVER THAT MOVES HOW OFTEN RUNS DIE. That sentence has to travel
    // with the number, in the file a balance phase actually opens.
    // Matched across the comment's line breaks, since the wording is wrapped prose.
    const flat = sim.replace(/\n\s*\/\/ ?/g, ' ');
    ok('the report says when the wipe row is blind',
      /only changes how a surviving run ends/i.test(flat)
      && /this row is blind while the win count is the only one that can see it/.test(flat));
    ok('and that it was measured on one lever', /Measured on ONE lever/.test(sim));

    // ── THE RECORD CARRIES THE MEASUREMENT, NOT JUST THE CONCLUSION ──────────────────────
    const rec = sim.slice(0, sim.indexOf('── S-AUDIT:'));
    ok('the per-career counts are in the record, both arms',
      /\[10,15,19,19,19,21,22,23,23,23,26,27\]/.test(rec) && /\[89,95,97,97,97,97\]/.test(rec));
    ok('the dispersion test that refuted my own suspicion is in it too',
      /chi-square 13\.57 on 11 df/.test(rec) && /consistent with the model/.test(rec));
    ok('and the prediction I got wrong is recorded as wrong',
      /PREDICTION DOWN FIRST AND IT WAS WRONG/.test(rec));

    // ── THE DEAF ROWS ARE NAMED SO NOBODY REACHES FOR THEM ───────────────────────────────
    // `nodes cleared` is the tightest row on the whole report and needs 297 careers an arm. A
    // reader who sees only the cv would pick it, which is the trap this item was built to avoid.
    ok('the tightest row is recorded as the deaf one',
      /nodes cleared, median\s+75\.67/.test(rec) && /297\s*\n?\s*\/\/ careers an arm|297/.test(rec));
    ok('and the rule is stated, not just the example',
      /A low spread is not an instrument; a low spread against a real effect is\./
        .test(rec.replace(/\n\s*\/\/ ?/g, ' ')));
  }
};

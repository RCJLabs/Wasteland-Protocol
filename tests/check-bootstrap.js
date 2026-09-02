// Does the interval tests/simulate.js prints actually cover what it claims to?
//
// Every median in that file's report carries a bootstrap 90% interval, and a balance decision
// now rests on whether two of those intervals overlap. An error bar nobody checked is the same
// kind of object as the point estimates it replaced, so this runs the same resampling code
// against distributions whose median is known and counts how often the interval contains it.
//
//   node tests/check-bootstrap.js
//
// It asserts nothing and takes about a minute. Re-run it if bootCI changes.
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];

// Kept identical to the copy in simulate.js on purpose: this is a check ON that code, so a
// cleverer version here would be checking something the report does not do.
const bootCI = (a, p = 0.5, draws = 2000) => {
  if (!a.length) return [0, 0];
  const meds = [];
  for (let i = 0; i < draws; i++) {
    const s2 = new Array(a.length);
    for (let j = 0; j < a.length; j++) s2[j] = a[(Math.random() * a.length) | 0];
    s2.sort((x, y) => x - y);
    meds.push(pct(s2, p));
  }
  meds.sort((x, y) => x - y);
  return [meds[(draws * 0.05) | 0], meds[(draws * 0.95) | 0]];
};

// Most expeditions end shallow and a few deep ones carry the score, which is why a median off
// thirty runs has always been the shakiest number this repo prints. Approximated with a
// lognormal, so the check is run against the shape that actually causes the trouble.
const heavy = () => Math.round(Math.exp(8 + 1.4 * ((Math.random() + Math.random() + Math.random()
                                                 + Math.random() + Math.random() + Math.random()) - 3)));
const uniform = () => Math.floor(Math.random() * 100);

const trueMedianOf = (gen) => {
  const big = []; for (let i = 0; i < 400000; i++) big.push(gen());
  big.sort((a, b) => a - b); return pct(big, 0.5);
};

console.log('coverage of the 90% interval, 300 trials each\n');
for (const [name, gen] of [['uniform 0-99', uniform], ['heavy-tailed (score-shaped)', heavy]]) {
  const truth = trueMedianOf(gen);
  for (const n of [30, 40, 60, 150]) {
    let covered = 0, widthSum = 0;
    const TRIALS = 300;
    for (let t = 0; t < TRIALS; t++) {
      const sample = []; for (let i = 0; i < n; i++) sample.push(gen());
      sample.sort((a, b) => a - b);
      const [lo, hi] = bootCI(sample, 0.5, 600);
      if (truth >= lo && truth <= hi) covered++;
      widthSum += (hi - lo) / truth;
    }
    console.log(`  ${name.padEnd(28)} n=${String(n).padStart(3)}   covers ${(covered / TRIALS * 100).toFixed(0)}%` +
                `   width ${(widthSum / TRIALS * 100).toFixed(0)}% of the median`);
  }
}

#!/usr/bin/env node
// ── K03: the instrument for assertions calibrated inside their own noise ────────────────
//
// 83-ground asserted that fights carrying ground land at or above 70.0% against a dial of 75%.
// The measured value has a mean of 71.04% and a standard deviation of 0.38 points, so the floor
// sat 2.7 sd below the mean and the row went red about one battery in three. Nothing was wrong
// with the game and nothing was wrong with the claim - the NUMBER was calibrated inside the
// noise of its own measurement, and the only instrument that could see that was somebody
// noticing the same row fail twice.
//
// D18 was the same shape a year earlier: a staging flake that only showed under load. Both were
// found by hand, after the fact, off a red battery.
//
// This finds them before they fire. It runs the battery N times, groups every assertion by the
// text of its own label, and reads the numbers that label prints back out. An assertion whose
// printed numbers never move cannot be noise-calibrated whatever its bound says; one whose
// numbers DO move is measured - mean, standard deviation, range - and the numeric bounds in its
// own condition are read out of the suite source and lined up against that spread. What comes
// back is the headroom: how many standard deviations sit between what an assertion measures and
// the bound it is judged against.
//
// Under about 4 sd is a row that will fire on somebody eventually. Under 3 is a row that fires
// this month. The pairing of a bound to a printed number is a GUESS - the nearest one by
// magnitude - so both are printed, and a wrong pairing is visible rather than silent.
//
// The pairing is the convenience; the other two lists are the substance. A bound can be on a
// quantity the label never prints - 76-bench prints two salvage rates and judges the DIFFERENCE
// between them against a tolerance - and no pairing will ever reach that. What reaches it is the
// row firing, and the width of what it measures. So: what went red, then what sits close to a
// bound, then what is simply wide, whether or not a bound could be found for it.
//
//   node tests/noise.js --runs 20               run the battery 20 times and report
//   node tests/noise.js --from <dir>            report over runs already captured as run-*.txt
//   node tests/noise.js --runs 20 --keep <dir>  run, and keep what was captured
//   node tests/noise.js --from <dir> --all      print every moving assertion, not just close ones
//
// The battery is the expensive part - a run is minutes, and the standard deviation of a rate
// needs samples before it settles. Twenty resolves a 3 sd margin comfortably and is what the K03
// sweep used; ten will find the rows already firing and not much else.

// ── WHAT THE FIRST SWEEP FOUND ─────────────────────────────────────────────────────────
// Twenty batteries, 4154 assertions, 315 of them printing a number that moves between runs.
// One went red during the sweep itself; twelve more sat inside five standard deviations of
// their own bound. What changed, closest first:
//
//   fired 1/20  76-bench  quartermaster salvage       |diff-1| < 0.25, read 0.75
//               The cause was not the sample size, which an earlier fix had already raised from
//               40 to 150 on eight samples of its own. Two uncontrolled inputs rode along: a
//               sector front pays double on one material, and confirmNewGame rolls a quirk, one
//               of which pockets an extra material per survivor. Front held off and quirks
//               stripped, the engine's rule is exact - so it is asserted as a shifted RANGE now,
//               1/2 becoming 2/3, with no noise in it at all and a smaller sample than before.
//   0.4 sd      101       fight log turns  >= 9       measured 9.15 +/- 0.37
//               A floor set on the median of the thing it judges. Now > BLITZ_TURNS, which is
//               what "lost BLITZ" means, plus the identity that the count survived the save.
//   1.7 sd      101       rebuilt log      <= 1       measured 0.25 +/- 0.44
//   (and 160)   101       fresh log        <= 1       measured 0.06 +/- 0.25
//               Both now >= 0 and < BLITZ_TURNS: the tampered -5 was refused, and the fight is
//               still fresh. Same claims, ten sd of room.
//   1.9 sd      07-pwa    art cached       >= 20      measured 35.8 +/- 8.1, label said "/24"
//               The art set had grown to 48 while the floor and the label stayed where they
//               were, so the row printed a denominator that was half the truth and asked for
//               two fifths of the set. The spread was the harness racing the worker, so it now
//               waits for the whole of ASSET_LIST and reads 48/48 flat.
//   2.6 sd      128       purse            > 2000     measured 2031 +/- 12
//   4.3 sd      128       purse            > 2000     measured 2077 +/- 18
//               Seeded at exactly 2000, so `> 2000` was asserting that the fight PAID, which is
//               a roll. The claim is that the collector took nothing: >= 2000.
//   2.6 sd      28-gear   elite drops      >= 12/60   measured 22.7 +/- 4.2
//               Sixty fights against a coin weighted 0.4 cannot resolve a rate - the first fix
//               here, a ratio band of 0.6 to 1.4 against a newly named ELITE_GEAR_CHANCE, was
//               measured at 1.7 sd by the confirming sweep and replaced. Sixty fights CAN say
//               the drop is a roll and not a rule, which is noise-free; the rate stays as a wide
//               sanity band around the dial rather than as a measurement of it.
//   3.0 sd      83-ground ground spread    < 3        measured 2.61 +/- 0.13
//               3 was never a number about the game: the TABLE is 3:1, because two grounds are
//               listed by three factions and two by one. Read off FACTIONS now, so the bound
//               moves when the table does.
//   3.3 sd      19-pos    fight length     < 60       measured 17.3 +/- 12.9, and it HIT 60
//               The cap was 60 and the row only passed because of an `||` true whenever anything
//               had died. Cap raised to 400, and it asserts the fight actually ended.
//   3.5 sd      96        rig AoE          > 500      of 4000 bare rollIntent calls
//   4.4 sd      124       ossuary intent   > 60       of 400 bare rollIntent calls
//   4.4 sd      30-shop   armory maps      <= 52      of 60 generated maps
//   4.8 sd      34-curses cache curses     >= 8       of 60 offer tables
//               Four cheap loops with bounds tighter than their samples could carry. Samples
//               raised (12000, 2000, 200, 240) and every bound re-expressed as a share of the
//               sample, so the claim reads the same and the room is real.
//   2.8 sd      92        kills            >= 1       redundant beside `after > before`
//               Dropped. A bound that cannot fail is a row this file reports forever for nothing.
//
// And the confirming sweep found one more, in a suite written two phases earlier: 153's
// `stock < worst` tied at 39 against 39. A strict inequality against a randomly levelled line is
// a draw waiting to happen, and a draw was never the claim.
//
// TWO THINGS THIS CANNOT SEE, both worth knowing before trusting a number above.
//
// The standard deviations are estimated from twenty samples of a discrete, lumpy measurement,
// and they are LOWER BOUNDS on the real tail. 83-ground's own note put its floor at 2.7 sd and
// it went red about one battery in three, which no Gaussian would do. Treat four sd as the line
// rather than three, and treat a row that has actually fired as worse than any estimate.
//
// And it cannot tell a bound that guards a defect from a bound that guards noise. 128's purse
// reads 3.3 sd above `>= 2000` after the fix, and always will: the purse cannot go under 2000
// unless the bug this row exists for has fired. A row near its bound is a row to READ, not a row
// to widen.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
    const i = args.indexOf('--' + name);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = name => args.includes('--' + name);
const RUNS = Math.max(2, Number(flag('runs', '20')) || 20);
const FROM = flag('from', null);
const KEEP = flag('keep', null);
const ALL = has('all');
// Where a row stops being worth reading. Set off what 83-ground actually was - 2.7 sd, firing
// about a third of the time - with room for a spread this sample under-measures.
const CLOSE_SD = Number(flag('close', '6')) || 6;

// ── Reading a battery ──────────────────────────────────────────────────────────────────
// The battery prints a bare suite name, then two-space-indented PASS/FAIL lines under it. An
// assertion is keyed by its suite and its POSITION in that suite, not by its text: a first draft
// keyed on the label with numbers blanked, and three-quarters of the battery fell out of the join
// because labels interpolate lists and words too - a roster printed in roll order, a JSON blob, a
// name. Those are the same assertion saying the same thing about a different draw.
//
// Position is only a key while a suite asserts the same number of times every battery, so that is
// checked rather than assumed: a suite whose count moves is dropped from the spread and reported
// on its own, because there the rows after the branch are not each other at all.
const NUM = /-?\d+(?:\.\d+)?/g;

function readBattery(text) {
    const rows = [];
    const nthBySuite = new Map();
    let suite = null;
    for (const raw of text.split('\n')) {
        const line = raw.replace(/\s+$/, '');
        const m = /^ {2}(PASS|FAIL) {2}(.*)$/.exec(line);
        if (m) {
            const label = m[2];
            const nth = (nthBySuite.get(suite) || 0) + 1;
            nthBySuite.set(suite, nth);
            rows.push({ suite, nth, label, verdict: m[1],
                        nums: (label.replace(/,(?=\d)/g, '').match(NUM) || []).map(Number) });
        } else if (line && !/^\s/.test(line)) {
            suite = line.trim();
        }
    }
    return rows;
}
// What every battery printed for this assertion, up to the first character they stop agreeing on.
// That is the fixed part of the label - the part the suite source wrote down - and it is both what
// the row is displayed as and what it is joined to its condition by.
function commonHead(labels) {
    let head = labels[0];
    for (const l of labels.slice(1)) {
        let i = 0;
        while (i < head.length && i < l.length && head[i] === l[i]) i++;
        head = head.slice(0, i);
    }
    return head;
}

// ── Reading a suite ────────────────────────────────────────────────────────────────────
// What each ok() is judged BY, which the battery's own output does not carry. Paren-matched
// rather than regexed: a condition holds parens, template literals and arrow functions, and a
// regex that gets this wrong reports a bound the assertion does not have.
function skipString(src, i) {
    const q = src[i];
    i++;
    while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === q) return i + 1;
        if (q === '`' && src[i] === '$' && src[i + 1] === '{') {
            let d = 1; i += 2;
            while (i < src.length && d) {
                if (src[i] === '{') d++;
                else if (src[i] === '}') d--;
                else if (src[i] === '`' || src[i] === '"' || src[i] === "'") { i = skipString(src, i); continue; }
                i++;
            }
            continue;
        }
        i++;
    }
    return i;
}
function scanCall(src, from) {
    let depth = 1, i = from;
    while (i < src.length && depth) {
        const c = src[i];
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
        else if (c === '`' || c === '"' || c === "'") { i = skipString(src, i); continue; }
        i++;
    }
    return i - 1;
}
function splitArgs(call) {
    let depth = 0, i = 0;
    while (i < call.length) {
        const c = call[i];
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
        else if (c === '`' || c === '"' || c === "'") { i = skipString(call, i); continue; }
        else if (c === ',' && depth === 0) return [call.slice(0, i), call.slice(i + 1)];
        i++;
    }
    return [call, ''];
}
// The literal head of a label - everything before the first thing it interpolates. That is what
// a runtime label and its source can be joined on: the interpolations are the part that differs
// between runs and the head is the part that never does.
function labelHead(expr) {
    const t = expr.trim();
    if (!/^[`'"]/.test(t)) return null;
    const q = t[0];
    let out = '';
    for (let i = 1; i < t.length; i++) {
        if (t[i] === '\\') { out += (t[i + 1] || ''); i++; continue; }
        if (t[i] === q) break;
        if (q === '`' && t[i] === '$' && t[i + 1] === '{') break;
        out += t[i];
    }
    return out;
}
// Line and block comments out of a chunk of source, leaving strings alone - a URL inside a
// string holds a // that is not a comment.
function stripComments(src) {
    let out = '';
    for (let i = 0; i < src.length; ) {
        const c = src[i];
        if (c === '`' || c === '"' || c === "'") {
            const j = skipString(src, i);
            out += src.slice(i, j); i = j; continue;
        }
        if (c === '/' && src[i + 1] === '/') {
            while (i < src.length && src[i] !== '\n') i++;
            continue;
        }
        if (c === '/' && src[i + 1] === '*') {
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i += 2; continue;
        }
        out += c; i++;
    }
    return out;
}
function scanSuite(file) {
    const src = fs.readFileSync(file, 'utf8');
    const out = [];
    const re = /(?<![A-Za-z0-9_.])ok\(/g;
    let m;
    while ((m = re.exec(src))) {
        const end = scanCall(src, re.lastIndex);
        const parts = splitArgs(src.slice(re.lastIndex, end));
        // Comments first. A note written INSIDE an ok() call - which is where this file's suites
        // often put them - carries the very numbers it is explaining, and the first sweep duly
        // reported a bound of `<= 1` that existed only in prose describing why it had been
        // removed. What judges the assertion is code, so only code is read.
        const cond = stripComments(parts[1]).trim().replace(/\s+/g, ' ');
        out.push({
            line: src.slice(0, m.index).split('\n').length,
            head: labelHead(parts[0]),
            cond,
            bounds: Array.from(cond.matchAll(/([<>]=?)\s*(-?\d+(?:\.\d+)?)/g))
                .map(b => ({ op: b[1], n: Number(b[2]) }))
        });
    }
    return out;
}

// ── Running it ─────────────────────────────────────────────────────────────────────────
function capture(n) {
    const runs = [];
    for (let i = 1; i <= n; i++) {
        process.stderr.write('  battery ' + i + '/' + n + '\n');
        const r = spawnSync(process.execPath, [path.join(__dirname, 'run.js')],
            { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        const text = (r.stdout || '') + (r.stderr || '');
        if (KEEP) {
            fs.mkdirSync(KEEP, { recursive: true });
            fs.writeFileSync(path.join(KEEP, 'run-' + i + '.txt'), text);
        }
        runs.push(text);
    }
    return runs;
}

// A battery that did not reach its own total line is a battery still being written, or one that
// died - and either way its suites look like they assert fewer times than the others, which reads
// back as a branch that sometimes runs. Dropped with a word rather than silently: a first draft
// read a half-written capture and reported 43 suites wobbling that were not.
const finished = t => /\n\d+ passed, \d+ failed/.test(t);
const raw = FROM
    ? fs.readdirSync(FROM).filter(f => /^run-\d+\.txt$/.test(f))
        .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))
        .map(f => fs.readFileSync(path.join(FROM, f), 'utf8'))
    : capture(RUNS);
const texts = raw.filter(finished);
if (texts.length !== raw.length) {
    console.error('  skipped ' + (raw.length - texts.length) + ' battery/batteries that never reached a total line');
}

if (texts.length < 2) {
    console.error('noise needs at least two finished batteries to have a spread to measure.');
    process.exit(1);
}

// ── What moved ─────────────────────────────────────────────────────────────────────────
const batteries = texts.map(readBattery);
// Which suites assert the same number of times in every battery. Only those can be keyed by
// position; the rest are a branch that sometimes runs, which is a finding of its own.
const countsBySuite = new Map();
for (const b of batteries) {
    const c = new Map();
    for (const r of b) c.set(r.suite, (c.get(r.suite) || 0) + 1);
    for (const pair of c) {
        if (!countsBySuite.has(pair[0])) countsBySuite.set(pair[0], []);
        countsBySuite.get(pair[0]).push(pair[1]);
    }
}
const steady = new Set();
const wobbly = new Map();
for (const pair of countsBySuite) {
    const counts = pair[1];
    if (counts.length === batteries.length && new Set(counts).size === 1) steady.add(pair[0]);
    else wobbly.set(pair[0], counts);
}

const keyOf = r => r.suite + ' #' + r.nth;
const series = new Map();
for (const b of batteries) {
    for (const r of b) {
        if (!steady.has(r.suite)) continue;
        const k = keyOf(r);
        if (!series.has(k)) series.set(k, { suite: r.suite, labels: [], runs: [], fails: 0 });
        const s = series.get(k);
        s.labels.push(r.label);
        s.runs.push(r.nums);
        if (r.verdict === 'FAIL') s.fails++;
    }
}
// Cut the shared head back to a word boundary: without it a head ends mid-number wherever two
// batteries happen to share a leading digit, and the row reads as though it says "(2".
for (const s of series.values()) {
    let head = commonHead(s.labels).replace(/\s+$/, '');
    if (/[^\s(\[]$/.test(head) && s.labels.some(l => l.length > head.length)) {
        head = head.replace(/[^\s(\[]*$/, '').replace(/\s+$/, '');
    }
    s.norm = head;
}

// ── Joining each assertion to the condition it is judged by ─────────────────────────────
// By the literal head of its label, within its own suite. A head that fits more than one ok() in
// that suite is not a join, so those are left unpaired: an assertion reported against the wrong
// condition is worse than one not reported at all.
const suiteDir = path.join(__dirname, 'suites');
const bySuiteName = new Map();
for (const f of fs.readdirSync(suiteDir).filter(x => x.endsWith('.js'))) {
    let mod = null;
    try { mod = require(path.join(suiteDir, f)); } catch (e) { mod = null; }
    if (mod && mod.name) bySuiteName.set(mod.name, { file: f, calls: scanSuite(path.join(suiteDir, f)) });
}
function conditionFor(suiteName, norm) {
    const s = bySuiteName.get(suiteName);
    if (!s) return null;
    const plain = norm.replace(/#/g, '');
    const hits = s.calls.filter(c => c.head && c.head.length >= 8
        && plain.indexOf(c.head.slice(0, Math.min(c.head.length, 60))) === 0);
    return hits.length === 1 ? Object.assign({ file: s.file }, hits[0]) : null;
}

const stats = col => {
    const mu = col.reduce((a, x) => a + x, 0) / col.length;
    const sd = Math.sqrt(col.reduce((a, x) => a + Math.pow(x - mu, 2), 0) / (col.length - 1));
    return { mu, sd, min: Math.min.apply(null, col), max: Math.max.apply(null, col) };
};

const rows = [];
const ragged = [];
for (const s of series.values()) {
    // Only where every battery printed the same COUNT of numbers. A label that prints a list whose
    // length moves shifts every column after it, and column three of one run is then a different
    // quantity from column three of another.
    if (new Set(s.runs.map(r => r.length)).size !== 1) { ragged.push(s); continue; }
    const width = s.runs[0].length;
    const cols = [];
    for (let i = 0; i < width; i++) {
        const st = stats(s.runs.map(r => r[i]));
        if (st.sd > 0) cols.push(Object.assign({ i }, st));
    }
    if (!cols.length) continue;
    const cond = conditionFor(s.suite, s.norm);
    let closest = null;
    for (const b of (cond ? cond.bounds : [])) {
        for (const c of cols) {
            // Pair a bound with the moving number nearest it in magnitude, and drop pairings that
            // are nowhere near each other: a count of 400 is not what a bound of 0.9 is judging.
            const scale = Math.max(Math.abs(c.mu), Math.abs(b.n), 1e-9);
            if (Math.abs(c.mu - b.n) / scale > 0.75) continue;
            const sd = (c.mu - b.n) / c.sd;
            if (!closest || Math.abs(sd) < Math.abs(closest.sd)) closest = { sd, bound: b, col: c };
        }
    }
    rows.push(Object.assign({}, s, { cols, cond, closest }));
}

// ── The report ─────────────────────────────────────────────────────────────────────────
const paired = rows.filter(r => r.closest);
paired.sort((a, b) => Math.abs(a.closest.sd) - Math.abs(b.closest.sd));
const fired = rows.filter(r => r.fails > 0);

console.log('\nbatteries read                ' + batteries.length);
console.log('suites keyed by position      ' + steady.size
    + (wobbly.size ? ' (' + wobbly.size + ' assert a different number of times between batteries)' : ''));
console.log('assertions compared           ' + series.size);
console.log('printing a number that moves  ' + rows.length);
console.log('  of those, joined to a bound ' + paired.length);
console.log('labels whose number count moves ' + ragged.length);
if (fired.length) {
    console.log('\nRED IN AT LEAST ONE BATTERY (' + fired.length + '):');
    for (const r of fired) {
        console.log('  ' + r.fails + '/' + batteries.length + '  ' + r.suite + ' - ' + r.norm.slice(0, 100));
    }
}

// The widest measurements in the battery, paired or not. A rate whose standard deviation is a
// large share of its own mean is a rate that will eventually walk into whatever bound it is
// judged by, even where the bound is on some quantity derived from it that no join can see.
const WIDEST = Math.max(0, Number(flag('widest', '12')) || 12);
const wide = rows.map(r => {
    let worst = null;
    for (const c of r.cols) {
        const rel = c.sd / Math.max(Math.abs(c.mu), 1e-9);
        if (!worst || rel > worst.rel) worst = Object.assign({ rel }, c);
    }
    return Object.assign({}, r, { worst });
}).filter(r => r.worst).sort((a, b) => b.worst.rel - a.worst.rel).slice(0, WIDEST);

const show = ALL ? paired : paired.filter(r => Math.abs(r.closest.sd) < CLOSE_SD);
console.log('\nHEADROOM, CLOSEST FIRST' + (ALL ? '' : ' (under ' + CLOSE_SD + ' sd)') + ':');
if (!show.length) console.log('  nothing that close.');
for (const r of show) {
    const c = r.closest;
    console.log('\n  ' + Math.abs(c.sd).toFixed(1) + ' sd ' + (c.sd >= 0 ? 'above' : 'below')
        + ' its ' + c.bound.op + ' ' + c.bound.n + '   [' + r.cond.file + ':' + r.cond.line + ']');
    console.log('    ' + r.suite + ' - ' + r.norm.slice(0, 110));
    console.log('    measured ' + c.col.mu.toFixed(4) + ' +/- ' + c.col.sd.toFixed(4)
        + ', seen ' + c.col.min + ' to ' + c.col.max + ' over ' + batteries.length);
    console.log('    judged by ' + r.cond.cond.slice(0, 150));
}

console.log('\nWIDEST MEASUREMENTS, PAIRED OR NOT (top ' + WIDEST + ' by spread against own mean):');
for (const r of wide) {
    const w = r.worst;
    console.log('  ' + (w.rel * 100).toFixed(1).padStart(5) + '%  ' + w.mu.toFixed(3) + ' +/- '
        + w.sd.toFixed(3) + ' (' + w.min + ' to ' + w.max + ')  '
        + (r.cond ? '[' + r.cond.file + ':' + r.cond.line + '] ' : '')
        + r.suite + ' - ' + r.norm.slice(0, 70));
}

// A suite whose assertion count moves between batteries is its own kind of exposure: a branch
// that only sometimes runs is a claim only sometimes made, and the battery total moves with it.
if (wobbly.size) {
    console.log('\nSUITES THAT ASSERT A DIFFERENT NUMBER OF TIMES BETWEEN BATTERIES:');
    console.log('  (a branch that only sometimes runs is a claim only sometimes made)');
    for (const pair of wobbly) console.log('  ' + pair[0] + ' - ' + Array.from(new Set(pair[1])).join(' / '));
}
if (ragged.length && ALL) {
    console.log('\nLABELS WHOSE COUNT OF PRINTED NUMBERS MOVES (not measured):');
    for (const r of ragged) console.log('  ' + r.suite + ' - ' + r.norm.slice(0, 100));
}
console.log('');

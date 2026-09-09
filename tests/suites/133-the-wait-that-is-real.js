// G12. Every suite in the tree opened by navigating and then sleeping a fixed 600ms - 500 in
// the seven oldest, 900 in the runner's own preflight - and there were 157 of those. None of
// them was waiting for the game. They were waiting out a number somebody picked once, and the
// number was wrong in both directions at the same time: measured over 80 loads, the engine
// publishes at p50 122ms idle and p90 284ms with all four cores busy, so the 600 was four to
// five times longer than it needed to be, while the slowest single boot of the eighty was
// 492ms - less headroom than the 500 in the oldest seven had to give. Playwright says as much
// in its own docs: waitForTimeout "should only be used for debugging. Tests using the timer in
// production are going to be flaky."
//
// This suite tests the WAIT, not the game. Two halves: the gate that keeps the count of
// navigation-then-sleep at zero now that it is there, and the readout that says how much fixed
// sleeping is left elsewhere, which is a different and much harder problem - after a click
// there is a real condition to wait on, but it is a different one every time.
const path = require('path');
const fs = require('fs');
const { engineUp, enginePublished, navSleeps, fixedSleeps, BOOT_TIMEOUT_MS } = require('../boot');

module.exports = {
  name: 'The wait that is real',
  run: async ({ page, context, ok, base, engineUp: up, settled }) => {
    await page.goto(`${base}/index.html`);
    await up(page);

    // The fixtures below are assembled rather than written whole, and for a sharper reason than
    // in 132. The gate scans every file in this directory, including this one - so a fixture
    // written as a literal would be found by the very scan it exists to test, and this suite
    // would fail its own gate. Checked, not assumed: dropping one literal copy into the suites
    // directory took the tree's count from 0 to 1.
    const nav = (v, how) => `    await ${v}.${how}(\`\${base}/index.html\`);\n`;
    const nap = (v, ms) => `    await ${v}.` + 'waitFor' + `Timeout(${ms});\n`;
    const wait = v => `    await engineUp(${v});\n`;

    // ── The gate ──────────────────────────────────────────────────────────────────
    const suites = fs.readdirSync(path.join(__dirname));
    const offenders = [];
    let remaining = [];
    for (const f of suites) {
      const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
      navSleeps(src).forEach(s => offenders.push(`${f}: ${s.nav}.${s.how} then ${s.ms}ms`));
      remaining = remaining.concat(fixedSleeps(src));
    }
    // The failure line names the fix as well as the fault. Somebody reading this red for the
    // first time has copied the shape out of a suite written before G12, and needs to be told
    // what to write instead rather than only that they are wrong.
    ok(`no navigation in the tree is followed by a fixed sleep${offenders.length ?
        ` — use engineUp(page) from tests/boot.js instead: ${offenders.join('; ')}` : ''}`,
      offenders.length === 0);
    ok(`and the runner does not do it either${navSleeps(fs.readFileSync(path.join(__dirname, '..', 'run.js'), 'utf8')).length ? ' — it does' : ''}`,
      navSleeps(fs.readFileSync(path.join(__dirname, '..', 'run.js'), 'utf8')).length === 0);

    // ── What the gate catches ─────────────────────────────────────────────────────
    const caught = navSleeps(nav('page', 'goto') + nap('page', 600));
    ok(`a navigation then a sleep is caught, with the handle and the cost (${caught.length ? caught[0].nav + '/' + caught[0].ms : 'nothing'})`,
      caught.length === 1 && caught[0].nav === 'page' && caught[0].how === 'goto' && caught[0].ms === 600);
    const onReload = navSleeps(nav('page', 'reload') + nap('page', 500));
    ok(`a reload counts as a navigation too (${onReload.map(s => s.how).join()})`,
      onReload.length === 1 && onReload[0].how === 'reload');
    // A sleep on a different handle is still a clock next to a navigation. Caught deliberately:
    // the rare honest case is worth reading in a failure line rather than passing in silence.
    const crossed = navSleeps(nav('p2', 'goto') + nap('page', 900));
    ok(`a sleep on another handle is caught, not excused (${crossed.length ? crossed[0].nav + ' then ' + crossed[0].slept : 'missed'})`,
      crossed.length === 1 && crossed[0].nav === 'p2' && crossed[0].slept === 'page');

    // ── What it must not catch ────────────────────────────────────────────────────
    ok('a navigation followed by the real wait is clean', navSleeps(nav('page', 'goto') + wait('page')).length === 0);
    // Prose is stripped first, so an example in a comment does not fail the gate. Two shapes,
    // because only one of them tests the stripping: a line comment puts a // between the two
    // lines and the pattern fails to match either way, while a block comment leaves them
    // adjacent and matches perfectly unless the prose is taken out first.
    const lineProse = '    // ' + nav('page', 'goto').trim() + '\n    // ' + nap('page', 600).trim() + '\n';
    ok('an example written in a line comment does not trip it', navSleeps(lineProse).length === 0);
    const blockProse = '/*\n' + nav('page', 'goto') + nap('page', 600) + '*/\n';
    ok('nor one inside a block comment, where the two lines are still adjacent',
      navSleeps(blockProse).length === 0);
    // Only ADJACENT. A sleep further down a suite is a different problem, counted below rather
    // than gated here - and a gate that reached past the next statement would catch all of them.
    const apart = nav('page', 'goto') + wait('page') + '    await page.click(".x");\n' + nap('page', 300);
    ok('a sleep after some other step is not a boot sleep', navSleeps(apart).length === 0);

    // ── The readout ───────────────────────────────────────────────────────────────
    // Not a gate. This is what is left after the 157, so the next pass at it starts from a
    // measured number instead of an impression.
    // ── The trap that makes a wait pass without waiting ─────────────────────────────
    // settled() reads its predicate's RETURN VALUE for truthiness, and an async function
    // returns a Promise, which is truthy on the very first poll whatever the condition is
    // doing. J03 found it by writing one: a 3000ms sleep replaced with an async settled()
    // came back green in 20ms with the cache it was waiting on still empty. That is the worst
    // shape a test helper can have - it does not fail, it stops checking - so it is refused at
    // the door, and refused here so it stays refused. until() is the form for an async
    // condition; it polls from the runner's side where the Promise is actually awaited.
    let onAsync = 'it did not throw at all';
    try {
      await settled(page, async () => false, 'a condition that is never true', null, 300);
    } catch (e) { onAsync = e.message; }
    ok(`settled() refuses an async predicate instead of passing on a Promise (${onAsync.slice(0, 52)}…)`,
      /async predicate/.test(onAsync));
    // And the synchronous form still fails the way it is supposed to, rather than the guard
    // having swallowed every path to a timeout.
    let onNever = 'it did not throw at all';
    try {
      await settled(page, () => false, 'a condition that is never true', null, 300);
    } catch (e) { onNever = e.message; }
    ok(`a synchronous predicate that never comes true still times out (${onNever.slice(0, 52)}…)`,
      /never came true/.test(onNever));

    const left = remaining.reduce((a, c) => a + c, 0);
    ok(`the fixed sleeps that remain are counted, not forgotten (${remaining.length} left, ${(left / 1000).toFixed(1)}s a battery)`,
      remaining.length > 0 && left > 0);
    ok(`and the boot sleeps are gone from the total (${(left / 1000).toFixed(1)}s, was 133.5s)`, left < 60000);
    ok('a source with no sleeps at all reports none', fixedSleeps(wait('page')).length === 0);
    // Same stripping as the gate, for the same reason: a sleep somebody already commented out
    // is not one the battery is paying for, and counting it would overstate what is left.
    ok('a sleep that is only in a comment is not counted as remaining',
      fixedSleeps('    // ' + nap('page', 700).trim()).length === 0);

    // ── The condition itself, driven for real ─────────────────────────────────────
    const blank = await context.newPage();
    await blank.setContent('<html><body>nothing here</body></html>');
    ok('the condition is false on a page with no engine', (await blank.evaluate(enginePublished)) === false);
    // typeof null is 'object', so the null half of the check is the half that does the work if
    // anything ever hands the page an empty WP rather than none. The bridge run.js installs is
    // an accessor whose setter mirrors the object's descriptors onto globalThis, and it cannot
    // be handed null - so the accessor is removed before the plain value goes on. Nothing in
    // the game does that; the engine assigns WP exactly once and never clears it.
    await blank.evaluate(() => { delete window.WP; window.WP = null; });
    ok('and false on a page whose WP is there but empty', (await blank.evaluate(enginePublished)) === false);
    await blank.evaluate(() => { window.WP = { real: 1 }; });
    ok('and true only once something is actually on it', (await blank.evaluate(enginePublished)) === true);
    await blank.evaluate(() => { delete window.WP; });
    let diagnosis = '';
    const tGave = Date.now();
    try { await engineUp(blank, 250); } catch (e) { diagnosis = e.message; }
    const gaveUpAfter = Date.now() - tGave;
    ok(`and a page that never publishes gets a diagnosis, not a bare timeout (${diagnosis.slice(0, 48)}...)`,
      /never published WP within 250ms/.test(diagnosis) && /readyState/.test(diagnosis));
    // The message is not the behaviour. A wait that reports the timeout it was given while
    // actually sitting on the ceiling would read correct and cost forty times as long.
    ok(`and it gives up when it said it would, not at the ceiling (${gaveUpAfter}ms for a 250ms budget)`,
      gaveUpAfter < 2000);
    await blank.close();

    // The win, measured here rather than claimed: a real boot resolves well inside the sleep it
    // replaced. If this ever creeps up on the machine of the day, the number is in the line.
    const fresh = await context.newPage();
    const t0 = Date.now();
    await fresh.goto(`${base}/index.html`);
    await engineUp(fresh);
    const took = Date.now() - t0;
    ok(`a real boot is waited out in ${took}ms, against the 600 it used to cost`, took < 600);
    ok('and the engine really is up when the wait returns', (await fresh.evaluate(enginePublished)) === true);
    ok(`the ceiling is a diagnosis budget, not a boot budget (${BOOT_TIMEOUT_MS}ms)`, BOOT_TIMEOUT_MS >= 5000);
    await fresh.close();
  }
};

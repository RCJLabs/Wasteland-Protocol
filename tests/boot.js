// G12: what a suite is really waiting for when it waits for the game to start.
//
// Every suite in the tree opened the same way - navigate, then sleep a fixed 600ms (500 in the
// seven oldest, 900 in the harness preflight) - and there are 157 of those navigations. Nothing
// was waiting for the game; they were waiting for a number somebody picked once. Measured over
// 80 loads on this machine: the engine publishes at p50 122ms and p90 170ms idle, p50 198ms and
// p90 284ms with all four cores busy, and the slowest single boot of the eighty was 492ms. So
// the 600 was four to five times longer than it needed to be on nearly every one of the 157,
// and the 500 in the seven oldest suites had less headroom than the worst boot already seen.
// Both wrong in the same breath: too slow to run, too thin to trust.
//
// What "up" is. game.js is an ES module whose last statement publishes globalThis.WP, and
// initEngine() - which ends in renderTitleScreen() - runs immediately before it. So WP is not a
// proxy for the game being ready, it is downstream of it. Checked rather than argued: over 40
// loads, at the exact animation frame WP first existed, the title screen was already display
// flex, its menu already carried five buttons and its text, the settings gear was already up
// and ACTIONS already held all 109 entries. Forty out of forty identical - it is not usually
// sufficient, it is sufficient.
//
// The timeout is a diagnosis, not a limit. A fixed sleep on a game that failed to start hands
// the suite a dead page and lets the first assertion report some unrelated thing as false. This
// says what did not happen and what the page had instead.
const BOOT_TIMEOUT_MS = 10000;

// Declared rather than inlined so the string Playwright ships to the page is this one function
// and nothing from Node's scope closes over it.
function enginePublished() {
    return typeof window.WP === 'object' && window.WP !== null;
}

async function engineUp(page, timeout = BOOT_TIMEOUT_MS) {
    try {
        await page.waitForFunction(enginePublished, null, { polling: 'raf', timeout });
    } catch (e) {
        let seen = '(the page could not be read at all)';
        try {
            seen = JSON.stringify(await page.evaluate(() => ({
                url: location.pathname,
                readyState: document.readyState,
                hasEngineDiv: !!document.getElementById('engine'),
                title: (document.getElementById('screen-title') || {}).style ?
                    getComputedStyle(document.getElementById('screen-title')).display : 'no title screen'
            })));
        } catch (e2) { /* keep the default */ }
        throw new Error(`the engine never published WP within ${timeout}ms - page was ${seen}`);
    }
}

// ── What the other sleeps were waiting for ────────────────────────────────────────────────
// G12 retired the 157 nav-then-sleep openings and left 93 fixed sleeps behind, deliberately:
// after a click there IS a real condition to wait on, but it is a different one each time and
// G06 showed that pulling one blind can change what the assertion was measuring. Read through,
// the overwhelming majority turn out to be the same shape - press a control, sleep, assert the
// screen changed - and the game already answers that question itself. switchScreen sets one
// screen to flex and everything else to none, and currentScreen() reports which, ignoring the
// settings panel that floats over one and the overlays that float over all of them.
//
// So these are not "shorter sleeps". They wait for the thing the next line is about to assert,
// which means they are both faster on a quiet machine and MORE reliable on a busy one - the
// 400ms that passes on an idle core is the one that flakes under load, and a wait on the actual
// condition has neither failure mode.

// The screen the game says is up. Fails with what WAS up instead, because "expected muster, got
// contracts" is a diagnosis and a timeout is not.
async function onScreen(page, screenId, timeout = BOOT_TIMEOUT_MS) {
    try {
        await page.waitForFunction(
            id => typeof currentScreen === 'function' && currentScreen() === id,
            screenId, { polling: 'raf', timeout });
    } catch (e) {
        let seen = '(the page could not be read)';
        try { seen = await page.evaluate(() => (typeof currentScreen === 'function' ? currentScreen() : null) || 'none'); }
        catch (e2) { /* keep the default */ }
        throw new Error(`waited ${timeout}ms for ${screenId}; the screen up was ${seen}`);
    }
}

// Anything else, with a label so a failure says what was being waited for rather than only how
// long. The condition runs in the page, so it can read the engine's own state directly.
async function settled(page, fn, label, arg = null, timeout = BOOT_TIMEOUT_MS) {
    // J03: an async predicate here is a silent pass, not a wait. waitForFunction checks the
    // predicate's RETURN VALUE for truthiness, and an async function returns a Promise, which
    // is truthy on the first poll whatever the condition is doing. Found by writing one: a
    // 3000ms sleep replaced with `settled(page, async () => (await caches.keys()).length ...)`
    // came back green in 20ms with the cache still empty. Refused rather than documented,
    // because the failure mode is a test that passes.
    if (fn && fn.constructor && fn.constructor.name === 'AsyncFunction') {
        throw new Error(`settled() was handed an async predicate for ${label}; a Promise is `
            + 'truthy on the first poll, so it would pass without waiting. Use until() instead.');
    }
    try {
        await page.waitForFunction(fn, arg, { polling: 'raf', timeout });
    } catch (e) {
        throw new Error(`waited ${timeout}ms for ${label} and it never came true`);
    }
}

// Resizing is not instant in the page. setViewportSize returns once the browser has been told,
// not once the document has been laid out at the new size, and seven suites stood a flat 120ms
// in that gap. The condition is the size the page itself reports, plus a frame so anything
// keyed to it has been recomputed - both real, and both faster than the number they replace.
async function resized(page, size, timeout = BOOT_TIMEOUT_MS) {
    await page.setViewportSize(size);
    await settled(page, s => window.innerWidth === s.w && window.innerHeight === s.h,
        `the viewport to report ${size.width}x${size.height}`,
        { w: size.width, h: size.height }, timeout);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

// For a condition that can only be asked asynchronously in the page - caches, storage
// estimates, anything behind an await. Polls from this side, where the Promise is actually
// awaited, instead of handing waitForFunction something it cannot read.
async function until(page, fn, label, timeout = BOOT_TIMEOUT_MS, every = 60) {
    const deadline = Date.now() + timeout;
    let last = null;
    for (;;) {
        try { last = await page.evaluate(fn); } catch (e) { last = `threw: ${e.message}`; }
        if (last) return last;
        if (Date.now() >= deadline) {
            throw new Error(`waited ${timeout}ms for ${label} and it never came true `
                + `(last read: ${JSON.stringify(last)})`);
        }
        await new Promise(r => setTimeout(r, every));
    }
}

// ── Keeping the population at zero ────────────────────────────────────────────────────────
// All 157 of them went at once, which is the easy part. The hard part is that nothing stops
// the next suite from being written the old way, and a sleep costs nothing visible on the day
// it is added - it is only ever a fifth of a battery in aggregate, years later. So the rule is
// checked rather than remembered: 133-the-wait-that-is-real gates on navSleeps being empty
// across the whole tree, and prints what fixedSleeps still finds so the next phase starts from
// a number instead of from my prose.
const { stripComments } = require('./coverage');

// A navigation immediately followed by a fixed sleep. Any sleep, not only one on the same page
// handle: waiting out a clock next to a navigation is the shape being retired, and a genuine
// cross-page case is rare enough to be worth reading in a failure line rather than passing
// silently. Comments go first, so a commented-out example does not trip the gate.
function navSleeps(source) {
    const out = [];
    const src = stripComments(source);
    const re = /await\s+(\w+)\.(goto|reload)\([^\n]*\);[ \t]*\n\s*await\s+(\w+)\.waitForTimeout\(\s*(\d+)\s*\)/g;
    let m;
    while ((m = re.exec(src))) out.push({ nav: m[1], how: m[2], slept: m[3], ms: Number(m[4]) });
    return out;
}

// Every fixed sleep left, whatever precedes it. Not a gate - after a click or an engine
// setTimeout there is a real condition to wait on but it is a different one each time, and
// G06 showed that pulling one can change what the assertion was measuring. This is the count
// that says how much of that is left.
function fixedSleeps(source) {
    const out = [];
    stripComments(source).replace(/\.waitForTimeout\(\s*(\d+)\s*\)/g, (_, ms) => out.push(Number(ms)));
    return out;
}

module.exports = { engineUp, enginePublished, onScreen, settled, until, resized, BOOT_TIMEOUT_MS, navSleeps, fixedSleeps };

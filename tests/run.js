// Runs every suite in tests/suites against a freshly served copy of the game.
// Exits non-zero if any assertion fails or any page throws.
const path = require('path');
const fs = require('fs');
const { serve } = require('./server');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require('playwright-core')); }

const ROOT = path.join(__dirname, '..');
// Every suite by default. Any arguments are substrings matched against the filename, so a
// single suite or a band of them can be run on its own:
//
//   node tests/run.js                 all of them
//   node tests/run.js 81              just 81-augments
//   node tests/run.js 70- 71- 72-     a band
//
// The whole battery is still what a change is judged on - this is for the loop before that,
// and for getting through the gate in pieces when the machine will not hold a long run.
const ONLY = process.argv.slice(2).filter(a => !a.startsWith('-'));
const ALL_SUITES = fs.readdirSync(path.join(__dirname, 'suites')).filter(f => f.endsWith('.js')).sort();
const SUITES = ONLY.length ? ALL_SUITES.filter(f => ONLY.some(o => f.includes(o))) : ALL_SUITES;
if (ONLY.length && !SUITES.length) { console.error(`no suite matches ${ONLY.join(', ')}`); process.exit(2); }

(async () => {
  const { server, port } = await serve(ROOT);
  const base = `http://127.0.0.1:${port}`;
  const launch = {};
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);

  let passed = 0, failed = 0;

  // Preflight, in a context WITHOUT the bridge below - this is the window a real visitor gets.
  // The engine is a module and must not put anything on it but its one namespaced export.
  {
    const clean = await browser.newContext();
    const page = await clean.newPage();
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => {
      const names = ['confirmNewGame','initiateCombat','renderMap','scrap','playerRoster','currentSector',
                     'checkWinState','ACTIONS','BASE_SAVE_KEY','activeEntities','generateEnemies','playSFX',
                     'runStats','bossSkulls','metaUpgrades','turnQueue','initEngine','ASSET_LIST'];
      return { leaked: names.filter(n => n in window),
               wp: typeof window.WP === 'object' && window.WP !== null,
               booted: getComputedStyle(document.getElementById('screen-title')).display };
    });
    console.log('\nGlobal namespace');
    const check = (name, cond) => { cond ? passed++ : failed++; console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`); };
    check('the engine leaks nothing onto window', r.leaked.length === 0);
    check('it exposes exactly one namespaced surface', r.wp);
    check('the game still boots as a module', r.booted === 'flex');
    if (r.leaked.length) console.log('        leaked:', r.leaked.join(', '));
    await clean.close();
  }

  for (const file of SUITES) {
    const suite = require(path.join(__dirname, 'suites', file));
    const context = await browser.newContext({ viewport: { width: 400, height: 800 } });
    // The engine is a module, so its declarations are not globals. Mirror its inspection
    // surface onto globalThis for suite bodies - descriptors are copied, so the state
    // accessors stay live in both directions. Re-applied on every navigation.
    await context.addInitScript(() => {
      // Onboarding prompts are a card over the controls, dismissed by a tap. That is right for
      // a player and wrong for a suite driving those controls, so every suite runs with them
      // off - 42-firstcontact turns them back on for itself.
      try {
        const k = 'wasteland_rpg_core_settings';
        const s = JSON.parse(localStorage.getItem(k) || '{}');
        s.prompts = false;
        localStorage.setItem(k, JSON.stringify(s));
      } catch (e) { /* storage blocked; the boot path handles that on its own */ }
      let engine;
      Object.defineProperty(window, 'WP', {
        configurable: true,
        get: () => engine,
        set: value => {
          engine = value;
          for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
            try { Object.defineProperty(globalThis, key, { ...desc, configurable: true }); }
            catch (e) { /* a read-only host global; the suite can use WP.<name> instead */ }
          }
        }
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // A data-action with no entry in the ACTIONS registry is a dead control: it throws
    // nothing, it just silently does nothing. Treat that warning as a failure.
    page.on('console', m => {
      if (m.type() === 'warning' && /Unmapped action/.test(m.text())) errors.push(m.text());
    });

    // The last assertion to report is remembered so a throw can say where in the suite it got
    // to. A page.evaluate TypeError arrives with a stack that names the evaluate wrapper and
    // nothing about the suite, so without this an intermittent abort has to be reproduced to be
    // located - and one that fires once in twenty batteries may not be reproducible on demand.
    let lastOk = null;
    const ok = (name, cond) => {
      lastOk = name;
      if (cond) { passed++; console.log(`  PASS  ${name}`); }
      else { failed++; console.log(`  FAIL  ${name}`); }
    };

    console.log(`\n${suite.name}`);
    try {
      await suite.run({ page, context, ok, base });
    } catch (e) {
      // The suite's name goes on the throw line itself. It is printed above too, but an
      // intermittent abort is usually read back out of a filtered log where that line is gone.
      failed++; console.log(`  FAIL  [${suite.name}] suite threw: ${e.message}`);
      // Where it threw, not just what: an intermittent throw is otherwise a whole battery of
      // guessing, because the message alone does not say which assertion was in flight.
      console.log(`        got as far as: ${lastOk || '(threw before its first assertion)'}`);
      if (e.stack) console.log('        ' + String(e.stack).split('\n').slice(0, 6).join('\n        '));
    }
    if (errors.length) {
      failed++; console.log(`  FAIL  ${errors.length} uncaught page error(s): ${errors[0]}`);
    } else {
      passed++; console.log('  PASS  no uncaught page errors');
    }
    await context.close();
  }

  await browser.close();
  server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

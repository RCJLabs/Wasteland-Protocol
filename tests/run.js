// Runs every suite in tests/suites against a freshly served copy of the game.
// Exits non-zero if any assertion fails or any page throws.
const path = require('path');
const fs = require('fs');
const { serve } = require('./server');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require('playwright-core')); }

const ROOT = path.join(__dirname, '..');
const SUITES = fs.readdirSync(path.join(__dirname, 'suites')).filter(f => f.endsWith('.js')).sort();

(async () => {
  const { server, port } = await serve(ROOT);
  const base = `http://127.0.0.1:${port}`;
  const launch = {};
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);

  let passed = 0, failed = 0;
  for (const file of SUITES) {
    const suite = require(path.join(__dirname, 'suites', file));
    const context = await browser.newContext({ viewport: { width: 400, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // A data-action with no entry in the ACTIONS registry is a dead control: it throws
    // nothing, it just silently does nothing. Treat that warning as a failure.
    page.on('console', m => {
      if (m.type() === 'warning' && /Unmapped action/.test(m.text())) errors.push(m.text());
    });

    const ok = (name, cond) => {
      if (cond) { passed++; console.log(`  PASS  ${name}`); }
      else { failed++; console.log(`  FAIL  ${name}`); }
    };

    console.log(`\n${suite.name}`);
    try {
      await suite.run({ page, context, ok, base });
    } catch (e) {
      failed++; console.log(`  FAIL  suite threw: ${e.message}`);
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

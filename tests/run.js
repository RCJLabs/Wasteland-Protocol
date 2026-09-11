// Runs every suite in tests/suites against a freshly served copy of the game.
// Exits non-zero if any assertion fails or any page throws.
const path = require('path');
const fs = require('fs');
const { serve } = require('./server');
const { untouchedExports } = require('./coverage');
const { engineUp, onScreen, settled, until, resized } = require('./boot');

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
  // G11: what the battery never reaches. It reported assertions passed and nothing at all
  // about the surface it does not touch, so "3,700 green" read as coverage when it is only a
  // count of the things somebody thought to check. Measured when this was added: 817 symbols
  // on the engine's one export, 141 of them named by no suite - the audit counted 129, so the
  // untouched set was growing faster than suites were closing it. Among them victoryWalk and
  // victoryPress, which are the two ways a run can end well.
  //
  // Named, not exercised. This asks whether a suite mentions the symbol in code at all, which
  // is the weakest useful question and the only one that can be answered without running a
  // coverage instrument over a module the page loads. A name that appears only in a comment
  // does not count - the prose is stripped first - but a name that is mentioned and never
  // pressed does. Read it as a floor on what is untested, never as a ceiling on what is.
  //
  // A readout, not a gate. Failing the battery whenever a new export arrives would turn the
  // number into an obstacle to route around, and the point of it is to be looked at.
  let exportNames = [];


  // Preflight, in a context WITHOUT the bridge below - this is the window a real visitor gets.
  // The engine is a module and must not put anything on it but its one namespaced export.
  {
    const clean = await browser.newContext();
    const page = await clean.newPage();
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    const r = await page.evaluate(() => {
      const names = ['confirmNewGame','initiateCombat','renderMap','scrap','playerRoster','currentSector',
                     'checkWinState','ACTIONS','BASE_SAVE_KEY','activeEntities','generateEnemies','playSFX',
                     'runStats','bossSkulls','metaUpgrades','turnQueue','initEngine','ASSET_LIST'];
      return { leaked: names.filter(n => n in window),
               wp: typeof window.WP === 'object' && window.WP !== null,
               booted: getComputedStyle(document.getElementById('screen-title')).display,
               // Read here rather than from the source: what the suites can reach is what the
               // object actually carries, and a regex over an export statement that long has
               // been wrong before.
               exports: window.WP ? Object.keys(window.WP) : [] };
    });
    console.log('\nGlobal namespace');
    const check = (name, cond) => { cond ? passed++ : failed++; console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`); };
    check('the engine leaks nothing onto window', r.leaked.length === 0);
    check('it exposes exactly one namespaced surface', r.wp);
    check('the game still boots as a module', r.booted === 'flex');
    if (r.leaked.length) console.log('        leaked:', r.leaked.join(', '));
    exportNames = r.exports;
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

      // ── L06: ONE DEFINITION OF "A BODY WITH NOTHING IN THE WAY" ──────────────────
      // This repo had 112 hand-rolled fixture helpers across 70 suites and no shared version
      // of this, so each re-derived what "bare" means and stripped the fields its author
      // thought of. That produced the same defect three times in one session: five assertions
      // found by flaking during K07-K11, one written into suite 158 during L02 and caught only
      // by mutation testing, and L07 - a fixture correct for a year that stopped being bare the
      // moment K08 sent the sky through mitigate, because it had never stripped a quirk.
      // THICK_HIDE takes 3 off every hit and the row went red in 7 batteries of 24.
      //
      // The failure mode is never "somebody forgot entirely". It is that the ENGINE grows a
      // thing mitigate consults and 112 fixtures silently fall one field behind. So the list
      // lives here once, and suite 159 checks it against what mitigate actually reads rather
      // than trusting it to be maintained by hand.
      //
      // Installed from addInitScript rather than at engineUp because it has to survive the
      // reloads that suites like 101 drive.
      //
      // Three kinds of field, neutralised three different ways:
      //   BARE       - stripped off the body itself
      //   FIELD      - not on the body; ambient state that __clearField puts back to neutral
      //   STRUCTURAL - read by mitigate but not a mitigation; a body still has to be somebody
      window.__BARE_FIELDS = ['resistances', 'armor', 'baseArmor', 'plate', 'quirk', 'weaponMod',
        'trinket', 'traits', 'sig', 'venom', 'venomStacks', 'corrodedTurns', 'oiledTurns',
        'wardId', 'wardSoak', 'escortId', 'escortArmor', 'revenantWard'];
      window.__FIELD_FIELDS = ['gridPos'];
      window.__STRUCTURAL_FIELDS = ['isPlayer', 'hp', 'maxHp', 'id', 'name'];

      // Strips a body in place and hands it back, so it composes:
      //   const t = __bare(playerRoster.find(c => c.gridPos > 0)); t.hp = t.maxHp = 400;
      window.__bare = (ent) => {
        if (!ent) return ent;
        ent.resistances = { phys: 0, bio: 0, energy: 0 };
        ent.armor = 0; ent.baseArmor = 0; ent.plate = 0;
        ent.quirk = null; ent.weaponMod = null; ent.trinket = null; ent.traits = [];
        ent.sig = null; ent.venom = null; ent.venomStacks = 0;
        ent.corrodedTurns = 0; ent.oiledTurns = 0;
        ent.wardId = null; ent.wardSoak = 0; ent.escortId = null; ent.escortArmor = 0;
        ent.revenantWard = 0;
        return ent;
      };

      // A body with nothing in the way and nothing interesting about it. Hostile by default;
      // pass { isPlayer: true } for the squad side.
      //
      // Stripped FIRST and overridden second, which is the only order that lets a caller ask for
      // the thing these fixtures usually want: __dummy({ resistances: { bio: 100 } }) is a body
      // sealed against one type and bare in every other way. Merging first and stripping after
      // would silently throw that override away, which is a trap in a helper whose whole job is
      // to stop traps.
      window.__dummy = (over) => Object.assign(window.__bare({
        id: 'dummy1', name: 'Dummy', isPlayer: false, classType: 'RAIDER', range: 'melee',
        hp: 400, maxHp: 400, speed: 1, dmgBase: 10, scale: 1, hpDrop: 0, gridPos: 1,
        cooldowns: {}, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, markedTurns: 0,
        intent: { type: 'ATTACK', icon: '#' }
      }), over || {});

      // The ambient half, and the half a fixture is likeliest to miss: every one of these is a
      // multiplier inside mitigate that lives on the FIELD rather than on a body. ASHFALL adds
      // armour to everyone standing; RUINS gives the front rank cover. A fixture that strips a
      // body and leaves these alone is only half bare.
      window.__clearField = () => {
        currentWeather = 'CLEAR'; currentTerrain = 'OPEN_ROAD'; currentFormation = null;
        activeRelics = []; bonds = {};
      };
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
      await suite.run({ page, context, ok, base, engineUp, onScreen, settled, until, resized });
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

  // ── What the battery never reached ──────────────────────────────────────────────
  // Only on a whole battery: a filtered run reaches a handful of suites and the number it
  // would print is a fact about the filter rather than about the game.
  if (exportNames.length) {
    if (ONLY.length) {
      console.log(`coverage  not measured — ${SUITES.length} of ${ALL_SUITES.length} suites ran`);
    } else {
      const sources = ALL_SUITES.map(f => fs.readFileSync(path.join(__dirname, 'suites', f), 'utf8'));
      const untouched = untouchedExports(exportNames, sources);
      const reached = exportNames.length - untouched.length;
      console.log(`coverage  ${reached} of ${exportNames.length} exports named by a suite`);
      if (untouched.length) {
        console.log(`          ${untouched.length} are not:`);
        for (let i = 0; i < untouched.length; i += 6) {
          console.log('            ' + untouched.slice(i, i + 6).join(', '));
        }
      }
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

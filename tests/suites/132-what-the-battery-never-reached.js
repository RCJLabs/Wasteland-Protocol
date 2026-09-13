// G11. The battery printed assertions passed and nothing about what it never touches, so a
// green run read as coverage when it is only a count of what somebody thought to check.
// Measured when the line was added: 822 exports, 148 named by no suite - the audit counted
// 129, so the untouched set grows faster than suites close it. victoryWalk and victoryPress
// are on that list, and they are the two ways a run can end well.
//
// This suite tests the READOUT, not the game. A number nobody can check is a number nobody
// should believe, which is why the computation lives in tests/coverage.js rather than inside
// the runner: it can be driven with crafted input here.
const path = require('path');
const fs = require('fs');
const { stripComments, namesIn, untouchedExports, deadState } = require('../coverage');

module.exports = {
  name: 'What the battery never reached',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // A suite that spells an engine symbol out in code marks it covered - by this measure,
    // which counts names. So the ones this file talks ABOUT are assembled from pieces rather
    // than written whole: reporting on a gap must not quietly close it. Naming victoryWalk
    // here would have moved the number by three and tested nothing.
    const sym = (...parts) => parts.join('');

    // ── Prose does not count as touching ──────────────────────────────────────────
    const commented = untouchedExports(['alpha', 'beta', 'gamma'], [
      `// alpha is why this exists\n const x = beta;`,
      `/* gamma does the other half */ const y = 1;`,
    ]);
    ok(`a name only ever mentioned in a comment is not reached (${commented.join(', ')})`,
      commented.join() === 'alpha,gamma');

    // ── But a URL is not a comment ────────────────────────────────────────────────
    const url = namesIn([`const u = 'http://example.test/thing'; const v = kept;`]);
    ok('a :// in a string does not swallow the rest of the line', url.has('kept'));

    // ── Whole tokens only ─────────────────────────────────────────────────────────
    // Invented names, not real exports: writing 'hasSig' here as a string literal would have
    // marked the engine's hasSig reached and moved the live number by one. The measure is easy
    // to corrupt from inside a suite about the measure.
    const partial = untouchedExports(['qqFoo', 'qqBar'], [`qqFooLonger(); qqBarrel();`]);
    ok(`a name found inside a longer one is not reached (${partial.join(', ')})`,
      partial.join() === 'qqBar,qqFoo');
    const exact = untouchedExports(['qqFoo'], [`if (qqFoo(u)) {}`]);
    ok('and the same name used whole is', exact.length === 0);

    // ── The list is stable and sorted ─────────────────────────────────────────────
    const sorted = untouchedExports(['zeta', 'alpha', 'mid'], ['nothing here']);
    ok(`the untouched list comes back sorted (${sorted.join(', ')})`,
      sorted.join() === 'alpha,mid,zeta');
    // Caught rather than allowed to throw: a readout that dies on a missing list would abort
    // the battery's last line, and an assertion that reports the fault is worth more than a
    // stack trace where the summary should be.
    const nullSafe = (() => { try { return untouchedExports(null, ['x']).length === 0; }
                              catch (e) { return 'threw: ' + e.message; } })();
    ok(`an empty or missing export list gives an empty answer (${nullSafe})`,
      untouchedExports([], ['whatever']).length === 0 && nullSafe === true);

    // ── Comment stripping does not eat code ───────────────────────────────────────
    const kept = namesIn([`const before = 1; // gone\nconst after = 2;\n/* also gone */ const last = 3;`]);
    ok(`code either side of a comment survives (${['before','after','last'].filter(n => kept.has(n)).join(', ')})`,
      kept.has('before') && kept.has('after') && kept.has('last')
      && !kept.has('gone') && !kept.has('also'));

    // ── Run against the real thing, which is the point of it ──────────────────────
    const live = await page.evaluate(() => Object.keys(window.WP || {}));
    const dir = path.join(__dirname, '..', 'suites');
    const sources = fs.readdirSync(dir).filter(f => f.endsWith('.js'))
      .map(f => fs.readFileSync(path.join(dir, f), 'utf8'));
    const missed = untouchedExports(live, sources);
    ok(`the engine exposes ${live.length} symbols and they are readable off the live object`,
      live.length > 400 && live.includes(sym('render', 'Map')) && live.includes(sym('apply', 'DamageHit')));
    ok(`${live.length - missed.length} of them are named by a suite, ${missed.length} are not`,
      missed.length > 0 && missed.length < live.length);
    ok(`the count is a real subset, not everything or nothing (${(100 * missed.length / live.length).toFixed(0)}% untouched)`,
      missed.length / live.length > 0.02 && missed.length / live.length < 0.6);

    // The two endings were G11's example of the gap: a run can be won or walked out of, and at
    // the time no suite named either function. G02 covered them from 135-the-last-warlord, and
    // this assertion FAILED THREE BATTERIES when it did - because as written it gated on those
    // two staying uncovered, so closing the gap broke the battery.
    //
    // That is the exact failure this file's own header warns about one screen up: "A readout,
    // not a gate. Failing the battery whenever a new export arrives would turn the number into
    // an obstacle to route around, and the point of it is to be looked at." The warning was
    // written and then contradicted eight lines later.
    //
    // Flipped, so it ratchets the way progress goes. Gating on a symbol staying REACHED is a
    // test that only fails if coverage goes backwards; gating on one staying UNREACHED punishes
    // the work the readout exists to prompt. The two endings stay the example either way.
    const endings = [sym('victory', 'Walk'), sym('victory', 'Press')];
    ok(`both ways a run ends well are on the export surface (${endings.join(', ')})`,
      endings.every(n => live.includes(n)));
    ok(`and both are now named by a suite, which they were not when this line was written (${endings.filter(n => !missed.includes(n)).length} of 2 reached)`,
      endings.every(n => !missed.includes(n)));

    // ── This suite naming a symbol is enough to move the number ───────────────────
    // Which is the honest limit of the measure, stated as an assertion rather than a caveat.
    // Assembled too: only COMMENTS are stripped, so a name written as a string literal in a
    // suite counts as named. In practice engine names do not turn up inside strings - screen
    // ids and data-actions are hyphenated and tokenise apart - but the limit is real and this
    // assertion would silently pass on nothing without respecting it.
    const pretend = sym('zzz_no', '_such_export');
    const beforeName = untouchedExports([pretend], sources);
    const afterName = untouchedExports([pretend], sources.concat([pretend + '();']));
    ok(`naming a symbol is all it takes to count as reached (${beforeName.length} → ${afterName.length})`,
      beforeName.length === 1 && afterName.length === 0);

    // ── N05/N06: and the same question one level in - state nothing reads ────────
    // An export nobody names is untested; a field nobody reads is dead. The N-audit found two by
    // hand: boss.learnedSig, which looked like the missing half of C09 and turned out to be a
    // copy of a field that already answered the question, and ent.deathPlayed, a one-shot guard
    // reset before it was ever written. L02's aura.type was the same shape and sat in the engine
    // for four letter-series before anybody looked. Found by a scan, so the scan ships.
    const engine = fs.readFileSync(path.join(__dirname, '..', '..', 'game.js'), 'utf8');
    // The authoritative cooldown list, off the same `cd:` the deck and the sim read. A cooldown
    // key is written by name and read as cooldowns[a.cd], which is a dynamic read this scan
    // cannot see - deriving the list from the tables rather than allowing the pattern keeps the
    // exception exactly as wide as the game actually is.
    const cds = [...new Set([...engine.matchAll(/cd:\s*'(\w+)'/g)].map(m => m[1]))];
    ok(`the cooldown keys come off the ability tables, not a pattern (${cds.length})`, cds.length > 20);
    const dead = deadState(engine, cds);
    ok(`no field is written onto a body and read by nothing${dead.length ? ': ' + dead.join(', ') : ''}`,
      dead.length === 0);
    // And the scan can see one when there is one, driven with crafted input rather than trusted.
    ok('a field written and never read is found',
      deadState('function f(e) { e.ghostField = 1; }', []).join() === 'ghostField');
    ok('and one that is read is not',
      deadState('function f(e) { e.ghostField = 1; if (e.ghostField) g(); }', []).length === 0);
    // The chain case, which this scan got wrong on its first run: the read sat one line above the
    // write and the regex had consumed the middle token before it could see the tail.
    ok('including when the read is the tail of a chain (el.dataset.x)',
      deadState('function f(el) { if (el.dataset.mark) return; el.dataset.mark = 1; }', []).length === 0);
  }
};

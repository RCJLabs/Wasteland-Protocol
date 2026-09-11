// L06. A fixture that stages "a body with nothing in the way" is the most common shape in this
// battery and it had no shared definition: 112 hand-rolled window.__* helpers across 70 suites,
// each stripping the fields its author thought of. The same defect came out of that three times
// in one session - five assertions found by flaking during K07-K11, one written into suite 158
// during L02 and caught only by mutation testing, and L07, where a fixture that had been correct
// for a year stopped being bare the moment K08 sent the sky through mitigate, because it had
// never stripped a quirk. THICK_HIDE takes 3 off every hit; the row went red 7 batteries in 24.
//
// So the list lives in tests/run.js now, installed from addInitScript so it survives a reload.
// But a shared list that has to be maintained by hand is the same defect with fewer copies, and
// the engine is what moves: somebody adds a mitigation to mitigate() and every fixture in the
// repo falls one field behind at once.
//
// THIS SUITE IS THE THING THAT STOPS THAT. It reads mitigate() out of game.js, extracts every
// field the function consults on its TARGET, and requires each one to be accounted for - either
// stripped off the body, neutralised by clearing the field, or named as structural. A new
// mitigation lands here as a red row naming the field, on the commit that introduces it.
//
// The source check is what generalises; the behavioural rows below it are what prove the list is
// not merely complete on paper. Both are needed: a field can be listed and not actually stripped.
module.exports = {
  name: 'A body with nothing in the way',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── The helpers arrive on every page, without a suite asking ──────────────────
    const there = await page.evaluate(() => ({
      bare: typeof window.__bare, dummy: typeof window.__dummy,
      clear: typeof window.__clearField, fields: (window.__BARE_FIELDS || []).length }));
    ok(`__bare, __dummy and __clearField are installed for every suite (${there.fields} fields)`,
      there.bare === 'function' && there.dummy === 'function' && there.clear === 'function');

    // They are installed from addInitScript, so they have to survive a navigation - 101 and 111
    // both reload mid-suite, and a helper that vanished there would be worse than none.
    await page.reload();
    await engineUp(page);
    const survived = await page.evaluate(() => typeof window.__bare === 'function'
      && typeof window.__clearField === 'function');
    ok('and they are still there after a reload', survived);

    // ── THE GUARD: every mitigation mitigate() reads is accounted for ─────────────
    // Read off the engine's source rather than listed here. A second hand-written list of what
    // mitigate consults would be the F03 defect - a copy of engine logic living in a test.
    const cover = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const at = src.indexOf('function mitigate(');
      // The function body, balanced-brace scanned so a later function cannot leak in.
      let d = 0, i = src.indexOf('{', at), end = i;
      for (; end < src.length; end++) {
        if (src[end] === '{') d++;
        else if (src[end] === '}') { d--; if (!d) break; }
      }
      const body = src.slice(i, end);
      // What is the target called in this signature? Read it, do not assume 't'.
      const sig = src.slice(at, src.indexOf(')', at));
      const target = sig.split('(')[1].split(',')[1].trim();
      const read = new Set();
      const re = new RegExp('\\b' + target + '\\.([A-Za-z_$][\\w$]*)', 'g');
      let m; while ((m = re.exec(body))) read.add(m[1]);
      // The three predicates reach through the target to a field of their own, so a call to one
      // of them is a read of that field even though the body never spells it.
      if (new RegExp('hasQuirk\\(\\s*' + target).test(body)) read.add('quirk');
      if (new RegExp('hasSig\\(\\s*' + target).test(body)) read.add('sig');
      if (new RegExp('hasTrait\\(\\s*' + target).test(body)) read.add('traits');
      const known = new Set([].concat(window.__BARE_FIELDS, window.__FIELD_FIELDS,
                                      window.__STRUCTURAL_FIELDS));
      return { target, read: [...read].sort(),
               unaccounted: [...read].filter(f => !known.has(f)).sort(),
               listedNotRead: [...window.__BARE_FIELDS].filter(f => !read.has(f)).sort() };
    });
    ok(`mitigate's target is read for ${cover.read.length} fields (${cover.target}.${cover.read.join(`, ${cover.target}.`)})`,
      cover.read.length > 5);
    ok(`and every one is stripped, cleared or named structural (${cover.unaccounted.length} unaccounted${cover.unaccounted.length ? ': ' + cover.unaccounted.join(', ') : ''})`,
      cover.unaccounted.length === 0);
    // The other direction is a warning rather than a failure: a field can be worth stripping
    // because some OTHER part of the engine reads it, so an over-long list is not a defect. It
    // is printed so the list does not quietly accumulate things nothing has needed for a year.
    ok(`the list carries ${cover.listedNotRead.length} field(s) mitigate does not read, which is allowed${cover.listedNotRead.length ? ': ' + cover.listedNotRead.join(', ') : ''}`,
      true);

    // ── THE PROOF: a bared body takes a blow whole, in every type ────────────────
    // Complete on paper is not the same as stripped in fact. A real mustered operator - the
    // exact thing L07's fixture used and did not strip - run through __bare and then hit.
    const whole = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField();
      const t = window.__bare(playerRoster.find(c => c.gridPos > 0));
      t.hp = t.maxHp = 4000;
      activeEntities = [t];
      return ['phys', 'bio', 'energy'].map(ty => ({ ty, ...mitigate(null, t, 100, ty, null) }));
    });
    ok(`a bared operator takes a blow whole in all three types (${whole.map(r => `${r.ty} ${r.n}`).join(', ')})`,
      whole.every(r => r.n === 100 && r.rv === 0 && r.ac === 0));

    const dummy = await page.evaluate(() => {
      window.__clearField();
      const d = window.__dummy();
      activeEntities = [d];
      return ['phys', 'bio', 'energy'].map(ty => ({ ty, ...mitigate(null, d, 100, ty, null) }));
    });
    ok(`and so does a __dummy hostile (${dummy.map(r => `${r.ty} ${r.n}`).join(', ')})`,
      dummy.every(r => r.n === 100 && r.rv === 0 && r.ac === 0));

    // ── L07's own defect, as a standing row ─────────────────────────────────────
    // The quirk that caused it, forced on rather than waited for: this row would have been red
    // in 7 batteries of 24 before, and is red every time if __bare ever stops taking the quirk.
    const hide = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField();
      const t = playerRoster.find(c => c.gridPos > 0);
      t.quirk = { id: 'THICK_HIDE', name: 'Thick Hide' };
      t.hp = t.maxHp = 4000;
      activeEntities = [t];
      const withQuirk = mitigate(null, t, 100, 'phys', null).n;
      window.__bare(t);
      return { withQuirk, bared: mitigate(null, t, 100, 'phys', null).n };
    });
    ok(`THICK_HIDE is a real mitigation, so the row means something (${hide.withQuirk} of 100)`,
      hide.withQuirk < 100);
    ok(`and __bare takes it off (${hide.bared} of 100)`, hide.bared === 100);

    // ── The ambient half, which is the one a fixture misses ─────────────────────
    // A body can be perfectly bare and still not take a blow whole, because ASHFALL puts armour
    // on everyone standing and RUINS gives the front rank cover. __clearField is the other half
    // of the definition and this is the row that says so.
    const ambient = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const t = window.__bare(playerRoster.find(c => c.gridPos > 0));
      t.hp = t.maxHp = 4000; t.gridPos = 1;
      activeEntities = [t];
      const out = {};
      currentWeather = 'ASHFALL'; currentTerrain = 'OPEN_ROAD';
      out.sky = mitigate(null, t, 100, 'phys', null).n;
      currentWeather = 'CLEAR'; currentTerrain = 'RUINS';
      out.ground = mitigate(null, t, 100, 'phys', null).n;
      window.__clearField();
      out.cleared = mitigate(null, t, 100, 'phys', null).n;
      return out;
    });
    ok(`a bare body under a sky that plates it does NOT take a blow whole (${ambient.sky} of 100)`,
      ambient.sky < 100);
    ok(`nor on ground that covers the front rank (${ambient.ground} of 100)`, ambient.ground < 100);
    ok(`and __clearField is what puts both back (${ambient.cleared} of 100)`, ambient.cleared === 100);

    // ── The residue, counted rather than claimed ────────────────────────────────
    // The helper only protects a fixture that USES it, and this battery still has suites that
    // build or strip a body by hand. Migrating all of them in one change would be a large,
    // silent diff across the whole battery for no behavioural gain, and quietly altering a
    // fixture is exactly the risk this suite exists to reduce. So the number is printed and
    // 45ED instead, in G11's idiom: it may fall, it may not rise. A new suite that hand
    // rolls a body has to either use the helper or move this line on purpose.
    //
    // "Hand-rolled" means building a whole entity literal or zeroing a quirk WITHOUT touching
    // the shared helpers. Passing `resistances:` as an override TO __dummy is the helper being
    // used correctly, not a hand-rolled body, and an earlier draft of this row counted those as
    // defects - which would have made the ratchet penalise the migration it exists to drive.
    const fs = require('fs');
    const path = require('path');
    const dir = __dirname;
    const suites = fs.readdirSync(dir).map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')]);
    const usesShared = suites.filter(([, t]) => /__bare\(|__dummy\(|__clearField\(/.test(t));
    const handRolled = suites.filter(([, t]) =>
      !/__bare\(|__dummy\(|__clearField\(/.test(t)
      && (/quirk\s*=\s*null/.test(t) || (/isPlayer:\s*(true|false)/.test(t) && /maxHp:\s*\d/.test(t))));
    ok(`${usesShared.length} suites take their bare body from the shared helper`,
      usesShared.length >= 2);
    ok(`${handRolled.length} still build one by hand, and that number may fall but not rise (ratchet 45)`,
      handRolled.length <= 45);
  }
};
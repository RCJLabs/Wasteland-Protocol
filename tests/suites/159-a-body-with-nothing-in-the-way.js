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
      const engineSrc = await (await fetch('game.js')).text();
      const scan = (src, entry) => {
      const at = src.indexOf('function ' + entry + '(');
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
      // A predicate called ON the target reads a field of its own, and mitigate's body never
      // spells that field - hasQuirk(t, 'THICK_HIDE') is a read of t.quirk. The first draft of
      // this suite listed the three predicates that existed at the time, which made the guard a
      // hand-maintained list in exactly the way it exists to prevent: M01 then added a fourth,
      // hasScar, and walked straight through it. So they are RESOLVED instead - any function
      // called with the target as its first argument is opened up and read for what IT reads off
      // its own first parameter.
      //
      // TRANSITIVELY, which the first version of that resolver was not: it opened one level and
      // stopped, so a predicate that passes the body on to ANOTHER predicate hid everything the
      // second one read. M04 walked through exactly that gap - mitigate calls perkSoak(t), and
      // perkSoak spells only ent.isPlayer and ent.gridPos itself before handing ent to
      // perkStacks, where the new field actually lives. One level deep, the guard was green on
      // a mitigation whose field no fixture stripped. So it is a worklist now, following the
      // body through as many hands as it is passed through, each function visited once.
      const bodyOf = (at) => {
        let d = 0, i = src.indexOf('{', at), end = i;
        for (; end < src.length; end++) {
          if (src[end] === '{') d++;
          else if (src[end] === '}') { d--; if (!d) break; }
        }
        return src.slice(i, end);
      };
      const seen = new Set();
      const queue = [{ fbody: body, param: target, fn: null, depth: 0 }];
      const resolved = [];
      let deepest = 0;
      while (queue.length) {
        const { fbody, param, fn: from, depth } = queue.shift();
        // Recorded HERE, on the way in, not where the call was spotted - the row below reports
        // what was actually opened and read, and a resolver that stops short has to be able to
        // say so. An earlier draft counted the call site instead, which made the row read the
        // same whether the body was followed or not, and the mutation it exists to catch
        // survived it.
        if (from) { resolved.push(`${from}@${depth}`); deepest = Math.max(deepest, depth); }
        const fre = new RegExp('\\b' + param + '\\.([A-Za-z_$][\\w$]*)', 'g');
        let fm; while ((fm = fre.exec(fbody))) read.add(fm[1]);
        const call = new RegExp('([A-Za-z_$][\\w$]*)\\(\\s*' + param + '\\s*[,)]', 'g');
        let h; while ((h = call.exec(fbody))) {
          const fn = h[1];
          if (seen.has(fn)) continue;
          seen.add(fn);
          const fat = src.indexOf('function ' + fn + '(');
          if (fat < 0) continue;
          const next = src.slice(fat, src.indexOf(')', fat)).split('(')[1].split(',')[0].trim();
          if (!next) continue;
          queue.push({ fbody: bodyOf(fat), param: next, fn, depth: depth + 1 });
        }
      }
      return { target, read, resolved: resolved.sort(), deepest };
      };
      const live = scan(engineSrc, 'mitigate');
      // The resolver, run against a source it cannot have been tuned to: a body handed down
      // two levels, where the field that matters is spelled only at the bottom. This is what
      // the depth assertion is FOR - gating it on the engine's current shape meant the row
      // went red the moment a mitigation moved out of mitigate, which is not a defect, and
      // went green on a one-level resolver whenever the engine happened to be shallow.
      const fake = [
        'function mitigate(attacker, t, calcDmg, atkType, abilityStr) {',
        '  let rv = t.resistances; if (outer(t)) rv = 0; return rv;',
        '}',
        'function outer(a) { return a.shallowField && inner(a); }',
        'function inner(b) { return b.deepField > 0; }'
      ].join('\n');
      const probe = scan(fake, 'mitigate');
      const known = new Set([].concat(window.__BARE_FIELDS, window.__FIELD_FIELDS,
                                      window.__STRUCTURAL_FIELDS));
      return { target: live.target, read: [...live.read].sort(),
               resolved: live.resolved, deepest: live.deepest,
               probeRead: [...probe.read].sort(), probeDeep: probe.deepest,
               unaccounted: [...live.read].filter(f => !known.has(f)).sort(),
               listedNotRead: [...window.__BARE_FIELDS].filter(f => !live.read.has(f)).sort() };
    });
    ok(`mitigate's target is read for ${cover.read.length} fields (${cover.target}.${cover.read.join(`, ${cover.target}.`)})`,
      cover.read.length > 5);
    // The depth is the thing that went wrong once - M04 put a mitigation two levels down, behind
    // a predicate that spelled none of the field itself, and a one-level resolver was green on
    // a field no fixture stripped. So transitivity is asserted against a SYNTHETIC source the
    // resolver cannot have been fitted to, rather than against whatever the engine's current
    // shape happens to be: the engine is allowed to get shallower without turning this red.
    ok(`the body is followed through ${cover.resolved.length} hands in mitigate, ${cover.deepest} deep (${cover.resolved.join(', ')})`,
      cover.resolved.length >= 3);
    ok(`and through two hands on a source built to need it (${cover.probeRead.join(', ')}, ${cover.probeDeep} deep)`,
      cover.probeDeep >= 2 && cover.probeRead.includes('deepField')
      && cover.probeRead.includes('shallowField') && cover.probeRead.includes('resistances'));
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
// G08. N13 put a 44px floor under a combat slot, because a slot is what you tap to pick a
// target. C11 and D15 then made the field shrink to fit the glass - and the floor was written
// as `44px * var(--field-fit)`, so it shrank along with everything else. The floor was not a
// floor; it was a starting size.
//
// Measured over ~1365 sprites on fields the generator really produces, three viewport widths:
// 29% of slots came out under 44px wide at 320px and 5-8% at 400px, the smallest 31.1px, which
// is 44 x 0.706 exactly. And the rule only ever applied to `.team.crowded`, so a team of THREE
// had no floor at all - most of what was left after the scaling was that.
//
// The fix offers the floor to fitField's SEARCH instead of applying it afterwards, and that
// distinction is the whole of it: a wider floor set once the bisection has converged invalidates
// the scale it settled on. Where no fit exists with the floor, the property is dropped and the
// old behaviour runs - so nothing that fits today stops fitting. Measured paired, twice: 400px
// goes 7%/8% to 2%/4% with zero sprites clipped on either side.
//
// 320px is left as it is, deliberately, and this suite says why rather than pretending it is
// fixed: eight sprites at 44px is 352px against 308px of glass, and both ways out are already
// spoken for. Clipping is what C11 fixed; overlapping a crowded row is what D15 removed, because
// at four operators on 320px the health readouts printed over each other. Two of the three can
// hold at that width, and which two is a design call, not a defect.
module.exports = {
  name: 'A target you can hit',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── The floor is one number, not two ─────────────────────────────────────────
    const shared = await page.evaluate(() => ({
      constant: typeof TOUCH_FLOOR === 'number' ? TOUCH_FLOOR : null,
      inCss: [...document.styleSheets].some(sh => {
        try { return [...sh.cssRules].some(r => /--touch-floor/.test(r.cssText)); }
        catch (e) { return false; }
      })
    }));
    ok(`the touch floor is a named constant (${shared.constant})`, shared.constant === 44);
    ok('and the stylesheet reads it from the fit rather than keeping its own copy', shared.inCss);

    // ── Staged fields, driven through the real fit ───────────────────────────────
    const staged = await page.evaluate(async () => {
      const field = () => document.querySelector('.battlefield');
      const stage = async (squadN, foes) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        playerRoster.forEach((c, i) => { c.gridPos = i < squadN ? (i % 3) + 1 : 0; });
        currentSector = 3; currentTier = 5;
        initiateCombat('RAIDERS', false);
        const one = activeEntities.find(e => !e.isPlayer);
        activeEntities = activeEntities.filter(e => e.isPlayer || e === one);
        for (let i = 1; i < foes; i++) {
          const u = JSON.parse(JSON.stringify(one));
          u.id = 'called_' + i; u.intent = rollIntent(u); activeEntities.push(u);
        }
        renderField();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const fit = fitField();
        const set = field().style.getPropertyValue('--touch-floor');
        const widths = [...document.querySelectorAll('.battlefield .entity')]
          .map(el => Math.round(el.getBoundingClientRect().width * 10) / 10);
        const art = [...document.querySelectorAll('.battlefield .portrait')]
          .map(el => el.getBoundingClientRect()).filter(b => b.width);
        return { fit: Math.round(fit * 1000) / 1000, floorSet: set.trim(), widths,
                 min: Math.min(...widths), teams: [...document.querySelectorAll('.team')].length,
                 clipped: art.filter(b => b.left < 0 || b.right > window.innerWidth).length };
      };
      return { light: await stage(3, 2), mid: await stage(3, 4), heavy: await stage(4, 5) };
    });
    ok(`an uncrowded field keeps every slot at the floor (${staged.light.min}px, fit ${staged.light.fit})`,
      staged.light.min >= 44);
    ok(`and it is the fit that says so, not a media query (--touch-floor "${staged.light.floorSet}")`,
      staged.light.floorSet === '44px');
    ok(`a four-hostile field keeps it too (${staged.mid.min}px, fit ${staged.mid.fit})`,
      staged.mid.min >= 44);
    ok(`no sprite is clipped on any of them (${staged.light.clipped}/${staged.mid.clipped}/${staged.heavy.clipped})`,
      staged.light.clipped === 0 && staged.mid.clipped === 0 && staged.heavy.clipped === 0);

    // ── A team of three is not crowded, and used to have no floor at all ─────────
    const three = await page.evaluate(async () => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
      playerRoster.forEach((c, i) => { c.gridPos = i < 3 ? i + 1 : 0; });
      currentSector = 2; currentTier = 3;
      initiateCombat('RAIDERS', false);
      const one = activeEntities.find(e => !e.isPlayer);
      activeEntities = activeEntities.filter(e => e.isPlayer || e === one);
      for (let i = 1; i < 3; i++) {
        const u = JSON.parse(JSON.stringify(one)); u.id = 'u' + i; u.intent = rollIntent(u); activeEntities.push(u);
      }
      renderField();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      fitField();
      const t = [...document.querySelectorAll('.team')].find(x => !x.classList.contains('crowded'));
      if (!t) return null;
      const el = t.querySelector('.entity');
      return el ? { crowded: false, min: getComputedStyle(el).minWidth } : null;
    });
    ok(`an uncrowded team has a floor now (min-width ${three && three.min})`,
      three && parseFloat(three.min) >= 44);

    // ── Where it cannot hold, it yields rather than clipping ────────────────────
    // The narrowest supported glass with the heaviest field. The floor coming off here is the
    // designed behaviour, not a failure - what must never happen is art over the edge.
    const tight = await page.evaluate(async () => {
      const field = document.querySelector('.battlefield');
      const before = field.clientWidth;
      field.style.width = '260px';   // narrower than anything the layout targets
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
      playerRoster.forEach((c, i) => { c.gridPos = i < 4 ? (i % 3) + 1 : 0; });
      currentSector = 5; currentTier = 8;
      initiateCombat('RAIDERS', false);
      const one = activeEntities.find(e => !e.isPlayer);
      activeEntities = activeEntities.filter(e => e.isPlayer || e === one);
      for (let i = 1; i < 6; i++) {
        const u = JSON.parse(JSON.stringify(one)); u.id = 'x' + i; u.intent = rollIntent(u); activeEntities.push(u);
      }
      renderField();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      fitField();
      const set = field.style.getPropertyValue('--touch-floor').trim();
      const art = [...document.querySelectorAll('.battlefield .portrait')]
        .map(el => el.getBoundingClientRect()).filter(b => b.width);
      const span = art.length ? Math.max(...art.map(b => b.right)) - Math.min(...art.map(b => b.left)) : 0;
      // What the same field would have measured with the floor forced on, for the comparison.
      field.style.setProperty('--touch-floor', '44px');
      const heldArt = [...document.querySelectorAll('.battlefield .portrait')]
        .map(el => el.getBoundingClientRect()).filter(b => b.width);
      const heldSpan = heldArt.length
        ? Math.max(...heldArt.map(b => b.right)) - Math.min(...heldArt.map(b => b.left)) : 0;
      field.style.removeProperty('--touch-floor');
      const out = { floorSet: set, span: Math.round(span), heldSpan: Math.round(heldSpan), glass: field.clientWidth };
      field.style.width = '';
      return out;
    });
    ok(`on a glass too narrow to hold the floor it is dropped, not forced ("${tight.floorSet}")`,
      tight.floorSet === '');
    ok(`and dropping it buys back real width rather than being a gesture (${tight.span}px of art in ${tight.glass}px, ${tight.heldSpan}px if the floor is held)`,
      tight.span < tight.heldSpan);

    // ── The order of operations, which is the fix ───────────────────────────────
    const src = await page.evaluate(() => String(WP.fitField));
    ok('the floor is set before the search runs, not after it',
      src.indexOf("--touch-floor") < src.indexOf('search()'));
    ok('and there is a second search for the field that cannot take it',
      (src.match(/search\(\)/g) || []).length >= 2 && /removeProperty\('--touch-floor'\)/.test(src));
  }
};

// Reported from play: raiders calling reinforcements pushed operators off the side of the
// screen. Measured across every composition the game can actually produce - one to six
// hostiles, three and four strong squads, swarms, juggernauts, each commander, the ossuary
// with its raised - at three viewport widths, sixteen of twenty-four compositions clipped at
// 320px and nine of twenty-four at 400px and 480px, by as much as 55px.
//
// Two causes, and neither was the one that looked obvious. The battlefield carried 22px of
// padding on the right and none on the left, so justify-content centred every fight 11px left
// of the actual centre - which is why the sprite going off the screen was nearly always the
// squad's leftmost. And nothing fitted a crowded row at all: fitEnemyRow narrows a commander's
// row against its own half, but only a commander's, so five raiders got no fitting whatsoever.
//
// This suite is written against the requirement rather than the implementation: stage the
// field, and assert every sprite is inside the glass. It does not care how.
const COMPOSITIONS = [
  { label: 'a lone raider',            squad: 3, foes: 1 },
  { label: 'a pair',                   squad: 3, foes: 2 },
  { label: 'a full patrol',            squad: 3, foes: 4 },
  { label: 'reinforcements, capped',   squad: 3, foes: 5 },
  { label: 'a four-strong squad',      squad: 4, foes: 4 },
  { label: 'four against five',        squad: 4, foes: 5 },
  { label: 'four against six',         squad: 4, foes: 6 }
];
module.exports = {
  name: 'A field that fits',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      // Stage a fight of an exact shape, wait for the art to decode, and hand back the span.
      window.__field = async (squadN, foes) => {
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
        await Promise.all([...document.querySelectorAll('.battlefield .portrait')]
          .map(i => i.complete ? Promise.resolve() : i.decode().catch(() => {})));
        renderField();
        await new Promise(r => setTimeout(r, 60));
        const field = document.querySelector('.battlefield');
        // Settle the fit before reading it. The load handler re-fits asynchronously when a
        // portrait decodes, so without this the span is read mid-race and the centring wobbles
        // by a few pixels between runs - which measures the race, not the layout. Whether the
        // render fits on its own is asserted separately, and synchronously, further down.
        fitField();
        const s = fieldSpan(field);
        const glass = field.clientWidth;
        combatActive = false;
        return { glass, l: s.l, r: s.r, w: s.w,
                 fit: parseFloat(field.style.getPropertyValue('--field-fit') || 1),
                 shift: field.style.transform || 'none',
                 p: document.querySelectorAll('#player-team .entity').length,
                 e: document.querySelectorAll('#enemy-team .entity').length,
                 over: Math.max(0, -s.l) + Math.max(0, s.r - glass),
                 offCentre: Math.abs(glass / 2 - (s.l + s.r) / 2) };
      };
    });

    // ---- the reported bug, at three widths ----
    for (const W of [320, 400, 480]) {
      await page.setViewportSize({ width: W, height: 800 });
      await page.waitForTimeout(120);
      const rows = [];
      for (const c of COMPOSITIONS) rows.push({ c, r: await page.evaluate(
        ([s, f]) => __field(s, f), [c.squad, c.foes]) });
      const clipped = rows.filter(x => x.r.over > 2);
      // The width is read back off the page rather than trusted: a suite that thinks it
      // resized and did not is a suite testing one viewport three times.
      const glass = rows[0].r.glass;
      ok(`at ${W}px every fight is on the screen (glass ${glass}, ${rows.length} shapes, worst ${Math.max(...rows.map(x => Math.round(x.r.over)))}px over)`,
        glass === W && clipped.length === 0);
      if (clipped.length) clipped.forEach(x =>
        console.log(`        ${x.c.label} (${x.r.p}v${x.r.e}) ${Math.round(x.r.over)}px over [${Math.round(x.r.l)}..${Math.round(x.r.r)}] of ${x.r.glass}`));
      // Being on the screen is not the same as being centred on it, and the bug was as much
      // about where the field sat as how wide it was.
      const skewed = rows.filter(x => x.r.offCentre > 6);
      ok(`and centred on it (worst ${Math.max(...rows.map(x => Math.round(x.r.offCentre)))}px off)`,
        skewed.length === 0);
    }
    await page.setViewportSize({ width: 400, height: 800 });
    await page.waitForTimeout(120);

    // ---- it only shrinks what it has to ----
    const easy = await page.evaluate(() => __field(3, 1));
    const hard = await page.evaluate(() => __field(4, 6));
    ok(`a fight that fits is not shrunk (${easy.fit})`, easy.fit === 1);
    ok(`a fight that does not is (${hard.fit})`, hard.fit < 1);
    ok('and never past the floor',
      hard.fit >= await page.evaluate(() => FIELD_FIT_MIN));
    ok('the crowd is what costs it, not the screen', hard.fit < easy.fit);

    // ---- the padding that caused half of it ----
    const pad = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.battlefield'));
      return { l: parseFloat(cs.paddingLeft), r: parseFloat(cs.paddingRight) };
    });
    ok(`the field is padded evenly (${pad.l} / ${pad.r})`, Math.abs(pad.l - pad.r) < 0.5);

    // ---- and the fit is measured, not assumed ----
    // The first version cached the result against the shape of the field. That cache was wrong
    // on six of seventy-two compositions, because the span depends on far more than the shape:
    // a dead operator's portrait rotates and takes a much wider box. So it must recompute.
    const dead = await page.evaluate(async () => {
      await __field(4, 5);
      combatActive = true;
      const before = parseFloat(document.querySelector('.battlefield').style.getPropertyValue('--field-fit') || 1);
      // Lay the whole hostile line down, which is what widens their boxes.
      activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; e.deadRendered = true; });
      renderField();
      await new Promise(r => setTimeout(r, 60));
      const field = document.querySelector('.battlefield');
      const s = fieldSpan(field);
      combatActive = false;
      return { before, after: parseFloat(field.style.getPropertyValue('--field-fit') || 1),
               over: Math.max(0, -s.l) + Math.max(0, s.r - field.clientWidth) };
    });
    ok(`a line that goes down is re-fitted rather than remembered (${dead.before} -> ${dead.after})`,
      dead.over <= 2);

    // Removing the fit from renderField hid behind the load handler, which re-fits when a
    // portrait arrives and had already produced a workable number. The two paths only separate
    // when the composition changes and no new art loads - so the field is emptied out and has
    // to get its size back off its own render.
    const emptied = await page.evaluate(async () => {
      await __field(4, 6);
      combatActive = true;
      const crowded = parseFloat(document.querySelector('.battlefield').style.getPropertyValue('--field-fit') || 1);
      const line = activeEntities.filter(e => !e.isPlayer);
      activeEntities = activeEntities.filter(e => e.isPlayer || e === line[0]);
      renderField();
      await new Promise(r => setTimeout(r, 60));
      const alone = parseFloat(document.querySelector('.battlefield').style.getPropertyValue('--field-fit') || 1);
      combatActive = false;
      return { crowded, alone };
    });
    ok(`a field that empties out gets its size back (${emptied.crowded} -> ${emptied.alone})`,
      emptied.crowded < 1 && emptied.alone === 1);

    // Two paths set the fit and they are redundant on purpose: renderField does it inline, and
    // a portrait finishing its decode does it again. The second one masks the first from every
    // test above - renderField rewrites the row, the fresh <img> elements fire load even off
    // the cache, and the field ends up fitted either way. The difference is a frame: without
    // the inline call the fight paints unfitted and snaps. So this reads the fit back with no
    // await between the render and the read, where the handler cannot have run yet.
    const sync = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach((c, i) => { c.gridPos = i < 4 ? (i % 3) + 1 : 0; });
      currentSector = 3; currentTier = 5;
      initiateCombat('RAIDERS', false);
      const one = activeEntities.find(e => !e.isPlayer);
      activeEntities = activeEntities.filter(e => e.isPlayer || e === one);
      for (let i = 1; i < 6; i++) { const u = JSON.parse(JSON.stringify(one)); u.id = 'c' + i; u.intent = rollIntent(u); activeEntities.push(u); }
      const field = document.querySelector('.battlefield');
      field.style.removeProperty('--field-fit');
      renderField();
      const now = parseFloat(field.style.getPropertyValue('--field-fit') || 1);
      combatActive = false;
      return now;
    });
    ok(`the render fits the field itself rather than a frame later (${sync})`, sync < 1);

    // ---- the readouts, which are what the slot widths are for ----
    // The squad's row used to keep its overlap however crowded it got, on the grounds that four
    // operators read fine. They stopped reading fine once the field started fitting itself: at
    // four on a 320px screen the health numbers printed straight over each other.
    const readouts = await page.evaluate(async () => {
      await __field(4, 5);
      const boxes = t => [...document.querySelectorAll(`#${t} .hp-text`)]
        .map(e => e.getBoundingClientRect()).sort((a, b) => a.left - b.left);
      const worst = list => list.reduce((w, b, i) =>
        i === 0 ? w : Math.max(w, Math.round(list[i - 1].right - b.left)), 0);
      return { player: worst(boxes('player-team')), enemy: worst(boxes('enemy-team')) };
    });
    ok(`the squad's health readouts do not print over each other (${readouts.player}px of overlap)`,
      readouts.player <= 1);
    ok(`nor the hostile line's (${readouts.enemy}px)`, readouts.enemy <= 1);

    // ---- the pieces, checked directly ----
    const parts = await page.evaluate(async () => {
      await __field(4, 6);
      const field = document.querySelector('.battlefield');
      const glass = field.clientWidth;
      // Forced wide open, it must clip - which is what proves the fitting is doing the work
      // rather than the layout happening to be small enough.
      field.style.setProperty('--field-fit', '1');
      field.style.transform = '';
      const unfitted = fieldSpan(field);
      const back = fitField();
      const fitted = fieldSpan(field);
      return { glass, unfittedW: unfitted.w, fittedW: fitted.w, back,
               shift: field.style.transform,
               spans: typeof fieldSpan === 'function' };
    });
    ok(`unfitted, six hostiles genuinely do not fit (${Math.round(parts.unfittedW)} of ${parts.glass})`,
      parts.unfittedW > parts.glass);
    ok(`fitting brings them in (${Math.round(parts.fittedW)})`, parts.fittedW <= parts.glass);
    ok('and slides the field to sit centred', /translateX/.test(parts.shift) || parts.shift === '');

    // ---- nothing is broken for the fights that were always fine ----
    const commanders = await page.evaluate(async () => {
      const out = {};
      for (const id of ['MARSHAL', 'BASTION', 'OSSUARY']) {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        let se = 1; while (se <= 40 && bossForSector(se).id !== id) se++;
        currentSector = se; currentTier = TOTAL_TIERS;
        initiateCombat('BOSS', false);
        await new Promise(r => setTimeout(r, 120));
        renderField();
        const field = document.querySelector('.battlefield');
        const s = fieldSpan(field);
        out[id] = { over: Math.max(0, -s.l) + Math.max(0, s.r - field.clientWidth),
                    retinue: document.getElementById('enemy-team').classList.contains('retinue') };
        combatActive = false;
      }
      return out;
    });
    ok(`every commander's fight is on the screen (${Object.entries(commanders).map(([k, v]) => k + ' ' + Math.round(v.over)).join(', ')})`,
      Object.values(commanders).every(v => v.over <= 2));
    ok('and a commander with a retinue still shares its row with it',
      commanders.MARSHAL.retinue && commanders.BASTION.retinue);
  }
};

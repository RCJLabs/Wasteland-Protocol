// C11 fitted the sprites and left the text, and the text is what a crowded field is actually
// made of. At 320px with five hostiles up the health readouts printed as one unbroken run of
// digits - 100/120101/121102/122103/123104/124 - because "100/120" inks 37.9px into a slot that
// is 31.1px wide, and at seven it is 26.4px. The squad's row does it too as soon as an operator
// passes 100 HP. FRONT ran 2.7px past its own chip. RANGING SHOT came out as RANG / ING / SHOT.
//
// The reason it survived C11 is the part worth keeping: that phase DID write an assertion for
// it - "the squad's health readouts do not print over each other" - and the assertion passed on
// a field where the numbers were plainly on top of each other. It measured the BOXES. The box
// of a readout is its slot, by construction, and the text is white-space: nowrap, so the ink
// leaves the box without the box ever changing size. A box can never see this defect. That
// assertion is re-encoded in suite 68 to measure the ink, and the first thing held here is the
// difference between the two, so nothing measures the box again by accident.
//
// The fix is a fitter in the same shape as C11's: measure the requirement, then spend the
// decoration. A row that has run out of room drops the second number in "100/120" - which is
// the bar directly underneath it, drawn again in digits - and the letter-spacing on its chips
// and tags, which is tracking and nothing else. Nothing that is only available in the digits
// is ever dropped: the current value stays at every width and every count.
const WIDTHS = [320, 400, 480];
module.exports = {
  name: 'The field at full density',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      globalSettings.motion = 'off';
      // Stage a fight of an exact width, with the widest readouts a real run produces: three
      // digits each side is what a deep sector prints, and it is the case that breaks.
      window.__dense = async (squadN, foes, hp, sigs) => {
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
        if (hp !== false) activeEntities.forEach((e, i) => { e.maxHp = 120 + i; e.hp = 100 + i; });
        // Which signature a hostile rolls decides how long its badge is, so a badge assertion
        // that takes what the dice give measures the dice. Name the ones being tested.
        if (sigs) activeEntities.filter(e => !e.isPlayer)
          .forEach((e, i) => { if (sigs[i]) e.sig = sigs[i]; });
        renderField();
        await Promise.all([...document.querySelectorAll('.battlefield .portrait')]
          .map(i => i.complete ? Promise.resolve() : i.decode().catch(() => {})));
        renderField(); fitField(); fitSlotText();
        await new Promise(r => setTimeout(r, 40));
        combatActive = false;
      };
      // The gap between one readout's INK and the next one's, which is the requirement itself.
      window.__gap = team => {
        const ink = [...document.querySelectorAll(`#${team} .entity .hp-text`)]
          .map(slotInk).filter(b => b.w).sort((a, b) => a.l - b.l);
        let worst = Infinity;
        for (let i = 1; i < ink.length; i++) worst = Math.min(worst, ink[i].l - ink[i - 1].r);
        return ink.length < 2 ? null : Math.round(worst * 10) / 10;
      };
      window.__over = sel => {
        let worst = -Infinity, text = '';
        document.querySelectorAll('.battlefield .entity').forEach(el => {
          const t = el.querySelector(sel); if (!t) return;
          const ink = slotInk(t); if (!ink.w) return;
          const o = ink.w - el.getBoundingClientRect().width;
          if (o > worst) { worst = o; text = (t.textContent || '').trim(); }
        });
        return worst === -Infinity ? null : { over: Math.round(worst * 10) / 10, text };
      };
    });

    // ── The instrument, before anything it measures ──────────────────────────────────────
    // Why the C11 assertion could not have caught this. If these two ever agree again, the
    // measurement below has stopped being a measurement.
    await page.setViewportSize({ width: 320, height: 800 });
    await page.waitForTimeout(120);
    const instrument = await page.evaluate(async () => {
      await __dense(4, 7, true);
      const el = document.querySelector('#enemy-team .entity');
      const t = el.querySelector('.hp-text');
      const box = t.getBoundingClientRect(), slot = el.getBoundingClientRect();
      // Forced wide open, so the ink genuinely exceeds the box it sits in.
      const team = el.closest('.team'); team.classList.remove('slot-tight');
      const ink = slotInk(t);
      const wide = { boxW: box.width, slotW: slot.width, inkW: ink.w,
                     nowrap: getComputedStyle(t).whiteSpace };
      fitSlotText();
      return wide;
    });
    ok(`a readout's box is exactly its slot (${instrument.boxW.toFixed(1)} vs ${instrument.slotW.toFixed(1)})`,
      Math.abs(instrument.boxW - instrument.slotW) < 0.5);
    ok(`and the text does not wrap, so the ink leaves the box without moving it (${instrument.nowrap})`,
      instrument.nowrap === 'nowrap');
    ok(`which is how the ink ran ${(instrument.inkW - instrument.slotW).toFixed(1)}px past a box that reported nothing`,
      instrument.inkW > instrument.slotW);

    // ── The requirement, at every density and width ──────────────────────────────────────
    const rows = [];
    for (const W of WIDTHS) {
      await page.setViewportSize({ width: W, height: 800 });
      await page.waitForTimeout(120);
      for (const foes of [3, 4, 5, 6, 7]) {
        const r = await page.evaluate(async f => {
          await __dense(4, f, true);
          return { foes: f, enemy: __gap('enemy-team'), squad: __gap('player-team'),
                   hp: __over('.hp-text'), chip: __over('.rank-chip'),
                   threat: __over('.threat-tag'), soak: __over('.soak-tag') };
        }, foes);
        rows.push({ W, ...r });
      }
    }
    const worstGap = Math.min(...rows.map(r => r.enemy).filter(g => g !== null));
    const worstRow = rows.find(r => r.enemy === worstGap);
    ok(`hostile readouts always clear each other (worst ${worstGap}px, at ${worstRow.W}px with ${worstRow.foes})`,
      worstGap >= 4);
    const squadGaps = rows.map(r => r.squad).filter(g => g !== null);
    ok(`so do the squad's (worst ${Math.min(...squadGaps)}px)`, Math.min(...squadGaps) >= 4);
    const worstHp = Math.max(...rows.map(r => r.hp.over));
    ok(`no readout runs past its own slot either (worst ${worstHp}px)`, worstHp <= 0);
    const worstChip = Math.max(...rows.map(r => (r.chip ? r.chip.over : -99)));
    ok(`nor a rank chip (worst ${worstChip}px, was +2.7 at 320 with seven)`, worstChip <= 0);
    const tags = rows.flatMap(r => [r.threat, r.soak]).filter(Boolean);
    ok(`nor an incoming-damage or soak tag (worst ${Math.max(...tags.map(t => t.over))}px)`,
      Math.max(...tags.map(t => t.over)) <= 1);

    // ── What is dropped, and what is never dropped ───────────────────────────────────────
    await page.setViewportSize({ width: 320, height: 800 });
    await page.waitForTimeout(120);
    const spend = await page.evaluate(async () => {
      const look = () => {
        const cell = document.querySelector('#enemy-team .entity');
        const max = cell.querySelector('.hp-max');
        // innerText, not textContent: textContent reads straight through display:none, so it
        // reports "104/124" on a row that is painting "104" and every assertion below it holds
        // whether the fix works or not. Same class of mistake as measuring the box.
        return { tight: cell.closest('.team').classList.contains('slot-tight'),
                 maxShown: !!max && getComputedStyle(max).display !== 'none',
                 text: (cell.querySelector('.hp-text').innerText || '').trim() };
      };
      const out = {};
      await __dense(4, 7, true); out.crowd = look();
      await __dense(4, 2, true); out.loose = look();
      return out;
    });
    ok(`a crowded row spends the half its bar already draws (${spend.crowd.text})`,
      spend.crowd.tight && !spend.crowd.maxShown);
    ok('but never the current value, which is the half nothing else says',
      /^\d+$/.test(spend.crowd.text) && Number(spend.crowd.text) > 0);
    ok(`and a row that comes back out of the crowd gets it back (${spend.loose.text})`,
      !spend.loose.tight && spend.loose.maxShown && /\//.test(spend.loose.text));

    // ── And the renderer does it, not the suite ─────────────────────────────────────────
    // The staging above calls the fitter by hand, so on its own it would hold just as well
    // against a renderField that never called it - which is exactly the hole that let a call
    // site pass the wrong argument for two phases in D08. This asserts the render itself.
    const wired = await page.evaluate(async () => {
      await __dense(4, 7, true);
      // Wipe the fitting and re-render from scratch, touching nothing else.
      document.querySelectorAll('.battlefield .team').forEach(t => t.classList.remove('slot-tight'));
      combatActive = true; renderField(); combatActive = false;
      return { tight: [...document.querySelectorAll('.battlefield .team')]
                 .some(t => t.classList.contains('slot-tight')),
               gap: __gap('enemy-team') };
    });
    ok(`a plain render fits its own slot text (gap ${wired.gap}px)`, wired.tight && wired.gap >= 4);

    // ── Where there is room, nothing is spent ────────────────────────────────────────────
    await page.setViewportSize({ width: 480, height: 800 });
    await page.waitForTimeout(120);
    const roomy = await page.evaluate(async () => {
      await __dense(4, 3, true);
      const cell = document.querySelector('#enemy-team .entity');
      return { text: (cell.querySelector('.hp-text').innerText || '').trim(),
               tight: cell.closest('.team').classList.contains('slot-tight') };
    });
    ok(`three hostiles on a wide screen keep both numbers (${roomy.text})`,
      !roomy.tight && /\d+\/\d+/.test(roomy.text));

    // ── A name is never cut in half ──────────────────────────────────────────────────────
    // The badge wraps rather than truncating, which C11 chose on purpose. What it must not do
    // is wrap INSIDE a word: overflow-wrap: anywhere turned RANGING SHOT into RANG / ING /
    // SHOT. Wrapping at the spaces is the default, and a single word that fits on no line at
    // all overhangs its slot by a few pixels instead of being broken.
    await page.setViewportSize({ width: 320, height: 800 });
    await page.waitForTimeout(120);
    const badge = await page.evaluate(async () => {
      // The longest name in the table that has spaces in it, and the longest that has none.
      await __dense(4, 7, true, ['READ_THE_LINE', 'RESURGENCE']);
      const read = tag => {
        if (!tag) return null;
        const rg = document.createRange(); rg.selectNodeContents(tag);
        const text = (tag.textContent || '').trim();
        return { text, words: text.split(/\s+/).length, lines: rg.getClientRects().length,
                 wrap: getComputedStyle(tag).overflowWrap, brk: getComputedStyle(tag).wordBreak };
      };
      const tags = [...document.querySelectorAll('#enemy-team .entity')]
        .map(el => read(el.querySelector('.sig-tag'))).filter(Boolean);
      return { many: tags.find(t => /READ THE LINE/.test(t.text)),
               one: tags.find(t => /RESURGENCE/.test(t.text)) };
    });
    ok(`a name with spaces wraps at them (${badge.many.text} on ${badge.many.lines} of ${badge.many.words} possible lines)`,
      badge.many.lines <= badge.many.words);
    ok(`a name without them is never cut in half (${badge.one.text} on ${badge.one.lines} line)`,
      badge.one.lines === 1);
    ok(`because the badge wraps at the spaces and nowhere else (overflow-wrap ${badge.one.wrap}, word-break ${badge.one.brk})`,
      badge.one.wrap === 'normal' && badge.one.brk === 'normal');
  }
};

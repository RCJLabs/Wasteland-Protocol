// G10. The settings gear is the only door to the settings panel, and the FIELD MANUAL is
// behind that panel - so the gear's reach is the reach of both. It was on three screens: map,
// outpost, citadel. Not in a fight, which is where a player wants the sound down, the combat
// speed slowed, or a reminder of what a resistance badge means. Not on the title either, where
// there was no way into settings at all.
//
// The audit filed it as "both are title-only today". Measured, it is nearly the opposite - the
// title is one of the screens that CANNOT reach it. What held is the part that matters.
//
// And the manual's CLOSE went to the title. Harmless while the only door was on the map; a trap
// the moment the gear reaches a fight, because looking a rule up would have walked out of the
// run. It goes back to whatever it was opened over now.
module.exports = {
  name: 'Settings where you are',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__gearOn = s => { switchScreen(s);
        return getComputedStyle(document.getElementById('btn-global-settings')).display !== 'none'; };
      window.__screens = () => [...document.querySelectorAll('#engine > div[id^="screen-"]')].map(e => e.id);
    });

    // ── Every screen but the two that are the settings ────────────────────────────
    const reach = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const all = window.__screens();
      const on = [], off = [];
      all.forEach(s => (window.__gearOn(s) ? on : off).push(s));
      return { all: all.length, on: on.length, off, offList: SETTINGS_GEAR_OFF };
    });
    ok(`the gear reaches ${reach.on} of the ${reach.all} screens`, reach.on === reach.all - reach.off.length);
    ok(`and is kept off only the panel and the manual it opens (${reach.off.join(', ')})`,
      reach.off.sort().join() === ['screen-codex', 'screen-settings'].sort().join()
      && reach.offList.length === 2);

    // ── Including the three it never used to reach ────────────────────────────────
    const named = await page.evaluate(() => ({
      combat: window.__gearOn('screen-combat'), title: window.__gearOn('screen-title'),
      event: window.__gearOn('screen-event'), camp: window.__gearOn('screen-camp'),
      shop: window.__gearOn('screen-shop'), map: window.__gearOn('screen-map') }));
    ok(`a fight can reach it (${named.combat}), and so can the title (${named.title})`,
      named.combat === true && named.title === true);
    ok(`so can an event, a camp and a shop (${named.event}, ${named.camp}, ${named.shop})`,
      named.event && named.camp && named.shop && named.map);

    // ── And it is a real target that covers nothing ───────────────────────────────
    const target = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); initiateCombat('RAIDERS', false);
      const g = document.getElementById('btn-global-settings');
      const b = g.getBoundingClientRect();
      const covered = new Set();
      [[b.left + 4, b.top + 4], [b.right - 4, b.bottom - 4],
       [b.left + b.width / 2, b.top + b.height / 2]].forEach(([x, y]) => {
        document.elementsFromPoint(x, y).forEach(el => {
          if (el === g) return;
          if (el.tagName === 'BUTTON' || el.dataset.action) covered.add(el.id || el.dataset.action);
        });
      });
      return { w: Math.round(b.width), h: Math.round(b.height), covered: [...covered] };
    });
    ok(`the gear is ${target.w}x${target.h} and covers no control on the field (${target.covered.join(', ') || 'nothing'})`,
      target.w >= 44 && target.h >= 44 && target.covered.length === 0);

    // ── Opening it mid-fight does not disturb the fight ───────────────────────────
    const midFight = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); initiateCombat('RAIDERS', false);
      const before = { units: activeEntities.length, queue: turnQueue.length,
                       active: combatActive, turn: activeIndex };
      openSettings();
      const up = { panel: getComputedStyle(document.getElementById('screen-settings')).display,
                   fieldStillThere: getComputedStyle(document.getElementById('screen-combat')).display };
      closeSettings();
      return { before, up, after: { units: activeEntities.length, queue: turnQueue.length,
                                    active: combatActive, turn: activeIndex } };
    });
    ok(`the panel opens over the fight rather than instead of it (${midFight.up.panel} over ${midFight.up.fieldStillThere})`,
      midFight.up.panel !== 'none' && midFight.up.fieldStillThere !== 'none');
    ok(`and the fight is exactly where it was (${midFight.after.units} up, queue ${midFight.after.queue}, turn ${midFight.after.turn})`,
      JSON.stringify(midFight.before) === JSON.stringify(midFight.after));

    // ── The manual goes back where it came from ───────────────────────────────────
    const manual = await page.evaluate(() => {
      const out = {};
      ['screen-combat', 'screen-map', 'screen-camp'].forEach(s => {
        currentSlot = 1; confirmNewGame(1.0);
        if (s === 'screen-combat') initiateCombat('RAIDERS', false); else switchScreen(s);
        const from = currentScreen();
        renderCodex();
        const onManual = currentScreen();
        closeCodex();
        out[s.replace('screen-', '')] = { from, onManual, back: currentScreen() };
      });
      return out;
    });
    ok(`closing the manual returns to the fight it was opened from (${manual.combat.from} → ${manual.combat.onManual} → ${manual.combat.back})`,
      manual.combat.onManual === 'screen-codex' && manual.combat.back === 'screen-combat');
    ok(`and to the map, and to a camp (${manual.map.back}, ${manual.camp.back})`,
      manual.map.back === 'screen-map' && manual.camp.back === 'screen-camp');

    // ── Opened from the title, it still goes back to the title ────────────────────
    const fromTitle = await page.evaluate(() => {
      renderTitleScreen();
      const from = currentScreen();
      renderCodex(); closeCodex();
      return { from, back: currentScreen() };
    });
    ok(`the manual opened from the title still closes to it (${fromTitle.from} → ${fromTitle.back})`,
      fromTitle.from === 'screen-title' && fromTitle.back === 'screen-title');

    // ── Closing what is not open does nothing ────────────────────────────────────
    const stray = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); initiateCombat('RAIDERS', false);
      renderCodex(); closeCodex();                 // back on the field
      const settled = currentScreen();
      closeCodex(); closeCodex();                  // and pressed again, off the manual
      return { settled, after: currentScreen(), fight: combatActive };
    });
    ok(`a close with no manual up leaves the screen alone (${stray.settled} → ${stray.after})`,
      stray.settled === 'screen-combat' && stray.after === 'screen-combat' && stray.fight === true);

    // ── The whole route a player takes, pressed rather than called ────────────────
    const pressed = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); initiateCombat('RAIDERS', false);
      const units = activeEntities.length;
      document.getElementById('btn-global-settings').click();
      const panel = getComputedStyle(document.getElementById('screen-settings')).display;
      document.querySelector('#screen-settings [data-action="codex"]').click();
      const onManual = currentScreen();
      document.querySelector('#screen-codex .return-btn').click();
      return { panel, onManual, back: currentScreen(),
               fightIntact: activeEntities.length === units && combatActive === true };
    });
    ok(`gear, manual, close - all pressed (${pressed.panel} → ${pressed.onManual} → ${pressed.back})`,
      pressed.panel !== 'none' && pressed.onManual === 'screen-codex'
      && pressed.back === 'screen-combat');
    ok('and the fight is still standing at the end of it', pressed.fightIntact === true);
  }
};

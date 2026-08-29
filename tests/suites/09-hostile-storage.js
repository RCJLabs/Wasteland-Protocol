// The suites all start from clean, working storage - which is exactly why two boot failures
// went unnoticed. This one starts from storage that is broken in each way a real browser
// breaks it, and asserts the game still starts and stays playable.
module.exports = {
  name: 'Hostile storage',
  run: async ({ page, context, ok, base }) => {
    const boot = async (setup, label) => {
      const p2 = await context.newPage();
      const errs = [];
      p2.on('pageerror', e => errs.push(e.message));
      if (setup) await p2.addInitScript(setup);
      await p2.goto(`${base}/index.html`);
      await p2.waitForTimeout(900);
      const state = await p2.evaluate(() => ({
        title: getComputedStyle(document.getElementById('screen-title')).display,
        menu: document.getElementById('title-menu-container').innerText.trim(),
        buttons: document.querySelectorAll('#title-menu-container [data-action]').length,
        engine: typeof window.WP === 'object' && window.WP !== null
      }));
      return { p2, errs, state, label };
    };

    // ---- 1. a slot truncated mid-write ----
    let r = await boot(() => localStorage.setItem('wasteland_rpg_core_slot_2', '{"scrap":12,'), 'corrupt slot');
    ok('a corrupt slot does not throw at boot', r.errs.length === 0);
    ok('the title screen still renders', r.state.title === 'flex' && r.state.engine);
    ok('the other slots are still offered', r.state.buttons >= 4);
    ok('the damaged slot is labelled, not hidden', /DAMAGED/.test(r.state.menu));
    // and it can be cleared in place
    await r.p2.locator('[data-action="erase-slot"]:visible').first().click();
    await r.p2.waitForTimeout(300);
    const cleared = await r.p2.evaluate(() => ({
      menu: document.getElementById('title-menu-container').innerText,
      raw: localStorage.getItem('wasteland_rpg_core_slot_2')
    }));
    ok('erasing a damaged slot clears it', cleared.raw === null && !/DAMAGED/.test(cleared.menu));
    ok('the slot returns to being usable', /SLOT 2 \[ EMPTY \]/.test(cleared.menu));
    await r.p2.close();

    // ---- 2. corrupt meta blob ----
    r = await boot(() => localStorage.setItem('wasteland_rpg_core_meta', 'not json at all'), 'corrupt meta');
    ok('a corrupt meta blob does not throw at boot', r.errs.length === 0);
    ok('the game still starts with meta defaults',
      r.state.title === 'flex' && await r.p2.evaluate(() => WP.bossSkulls === 0));
    await r.p2.close();

    // ---- 3. corrupt settings ----
    r = await boot(() => localStorage.setItem('wasteland_rpg_core_settings', '{{{'), 'corrupt settings');
    ok('corrupt settings do not throw at boot', r.errs.length === 0);
    ok('settings fall back to defaults',
      await r.p2.evaluate(() => WP.globalSettings.combatSpeed === 1.0 && WP.globalSettings.sfx === true));
    await r.p2.close();

    // ---- 4. writes rejected (private browsing / quota exceeded) ----
    r = await boot(() => {
      Storage.prototype.setItem = function () { throw new DOMException('QuotaExceededError'); };
    }, 'writes rejected');
    ok('a browser that refuses writes does not break the boot', r.errs.length === 0);
    ok('the engine initialises anyway', r.state.engine && r.state.title === 'flex');
    ok('the player is told saving is off', /NOT BE SAVED/.test(r.state.menu));
    const playable = await r.p2.evaluate(() => {
      WP.currentSlot = 1; WP.confirmNewGame(1.0); sectorFront = null;
      const onMap = getComputedStyle(document.getElementById('screen-map')).display === 'flex';
      WP.initiateCombat('RAIDERS', false);
      return { onMap, inCombat: getComputedStyle(document.getElementById('screen-combat')).display === 'flex' };
    });
    ok('a run can still be started without storage', playable.onMap);
    ok('combat still runs without storage', playable.inCombat);
    await r.p2.close();

    // ---- 5. storage entirely unavailable (reads throw too) ----
    r = await boot(() => {
      Storage.prototype.getItem = function () { throw new DOMException('SecurityError'); };
      Storage.prototype.setItem = function () { throw new DOMException('SecurityError'); };
      Storage.prototype.removeItem = function () { throw new DOMException('SecurityError'); };
    }, 'storage blocked');
    ok('fully blocked storage does not break the boot', r.errs.length === 0);
    ok('the game is still reachable', r.state.engine && r.state.title === 'flex' && r.state.buttons >= 4);
    await r.p2.close();
  }
};

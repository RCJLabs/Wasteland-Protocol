// Shakedown findings 08, 09 and 10: no dead state, no native dialogs, and render loops that
// build their markup once.
module.exports = {
  name: 'Housekeeping',
  run: async ({ page, ok, base }) => {
    let sawDialog = false;
    page.on('dialog', async d => { sawDialog = true; await d.dismiss(); });
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- 08: state that was written and never read is gone ----
    const surface = await page.evaluate(() => ({
      prev: 'previousScreen' in window.WP,
      tab: 'outpostTab' in window.WP,
      src: null
    }));
    ok('previousScreen is gone from the engine', !surface.prev);
    ok('outpostTab is gone from the engine', !surface.tab);
    const src = await page.evaluate(async () => await (await fetch('game.js')).text());
    ok('neither name survives anywhere in the source',
      !/previousScreen/.test(src) && !/\boutpostTab\b/.test(src));

    // settings still open and close correctly without the tracking variable
    await page.evaluate(() => { currentSlot = 1; confirmNewGame(1.0); openSettings(); });
    await page.waitForTimeout(200);
    ok('settings still open', await page.$eval('#screen-settings', e => getComputedStyle(e).display) === 'flex');
    await page.evaluate(() => closeSettings());
    await page.waitForTimeout(200);
    ok('settings still close over the screen beneath',
      await page.$eval('#screen-settings', e => getComputedStyle(e).display) === 'none' &&
      await page.$eval('#screen-map', e => getComputedStyle(e).display) === 'flex');

    // ---- 09: no native dialogs ----
    ok('the source contains no alert() or confirm() call',
      !/[^.\w](alert|confirm)\s*\(/.test(src.replace(/\/\/[^\n]*/g, '')));

    // a dead squad is told in-game, not through a modal
    await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      playerRoster.forEach(p => { if (p.gridPos > 0) p.hp = 0; });
      initiateCombat('RAIDERS', false);
    });
    await page.waitForTimeout(400);
    const notice = await page.evaluate(() => ({
      onOutpost: getComputedStyle(document.getElementById('screen-outpost')).display === 'flex',
      inCombat: getComputedStyle(document.getElementById('screen-combat')).display === 'flex',
      text: document.getElementById('outpost-notice').innerText,
      shown: getComputedStyle(document.getElementById('outpost-notice')).display !== 'none'
    }));
    ok('a dead squad is bounced to the outpost', notice.onOutpost && !notice.inCombat);
    ok('and told why, in the game', notice.shown && /operator is down/i.test(notice.text));
    ok('no native dialog was raised', !sawDialog);

    await page.evaluate(() => { playerRoster.forEach(p => { p.hp = p.maxHp; }); renderOutpost(); });
    await page.waitForTimeout(250);
    ok('the notice clears on a normal visit',
      await page.$eval('#outpost-notice', e => getComputedStyle(e).display) === 'none');

    // arming erase then leaving settings must not leave it armed
    await page.evaluate(() => { currentSlot = 2; saveGameState(); openSettings(); });
    await page.waitForTimeout(150);
    await page.locator('[data-action="erase-save"]:visible').first().click();
    await page.waitForTimeout(150);
    const armed = await page.$eval('#btn-erase', e => e.innerText);
    await page.evaluate(() => { closeSettings(); openSettings(); });
    await page.waitForTimeout(150);
    const rearmed = await page.$eval('#btn-erase', e => e.innerText);
    ok('the first press arms the button visibly', /CONFIRM/.test(armed));
    ok('leaving settings disarms it again', !/CONFIRM/.test(rearmed));
    ok('the save survived being armed but not confirmed',
      await page.evaluate(() => localStorage.getItem(BASE_SAVE_KEY + 2)) !== null);

    // ---- 10: containers are written once, and still render correctly ----
    ok('no render loop appends to innerHTML any more', !/innerHTML\s*\+=/.test(src));
    const counts = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); scrap = 999; renderOutpost();
      return {
        roster: document.getElementById('outpost-roster').children.length,
        cyber: document.getElementById('cybernetics-roster').children.length,
        inv: document.getElementById('outpost-inventory').children.length,
        invMax: metaUpgrades.invMax
      };
    });
    ok(`the roster still renders every hero (${counts.roster})`, counts.roster === 7);
    ok(`cybernetics still renders every hero (${counts.cyber})`, counts.cyber === 7);
    ok('the inventory still renders every slot', counts.inv === counts.invMax);

    const field = await page.evaluate(() => {
      initiateCombat('RAIDERS', false);
      return { players: document.getElementById('player-team').children.length,
               enemies: document.getElementById('enemy-team').children.length };
    });
    ok('the combat field still renders both teams', field.players > 0 && field.enemies > 0);
  }
};

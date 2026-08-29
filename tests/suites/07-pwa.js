// Finding 09: the game should install like an app and play with no network.
module.exports = {
  name: 'Installable and offline',
  run: async ({ page, context, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(500);

    const man = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      if (!link) return null;
      const json = await (await fetch(link.href)).json();
      const icons = await Promise.all(json.icons.map(async i => (await fetch(new URL(i.src, link.href))).status));
      return { json, icons, theme: document.querySelector('meta[name="theme-color"]')?.content };
    });
    ok('the manifest is linked and parses', !!man);
    ok('it declares standalone portrait display', man.json.display === 'standalone' && man.json.orientation === 'portrait');
    ok('start_url and scope are relative', man.json.start_url === './' && man.json.scope === './');
    ok('every declared icon resolves', man.icons.every(s => s === 200));
    ok('a maskable icon is provided', man.json.icons.some(i => i.purpose === 'maskable'));
    ok('a theme colour is set', !!man.theme);

    const reg = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      return { active: !!r.active, scope: r.scope };
    });
    ok('the service worker activates', reg.active);

    await page.waitForTimeout(3000);
    const cached = await page.evaluate(async () => {
      const names = await caches.keys();
      const keys = await (await caches.open(names[0])).keys();
      const urls = keys.map(k => k.url.split('/').pop());
      return { art: urls.filter(u => u.endsWith('.webp')).length,
               shell: ['index.html', 'game.js', 'styles.css', ''].filter(f => urls.includes(f)).length };
    });
    ok(`the art set is cached (${cached.art}/24)`, cached.art >= 20);
    ok('the shell is cached for an offline boot', cached.shell >= 3);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const offline = await page.evaluate(() => ({
      title: getComputedStyle(document.getElementById('screen-title')).display,
      menu: document.getElementById('title-menu-container').innerText.trim().length > 0,
      art: getComputedStyle(document.getElementById('screen-title')).backgroundImage.includes('bg_title')
    }));
    ok('the game boots with no network', offline.title === 'flex' && offline.menu);
    ok('the title art is available offline', offline.art);

    await page.evaluate(() => { currentSlot = 1; confirmNewGame(1.0); sectorFront = null; initiateCombat('RAIDERS', false); });
    await page.waitForTimeout(700);
    const fight = await page.evaluate(() => ({
      screen: getComputedStyle(document.getElementById('screen-combat')).display,
      sprites: [...document.querySelectorAll('.portrait')].every(i => i.complete && i.naturalWidth > 0)
    }));
    ok('combat runs offline', fight.screen === 'flex');
    ok('sprites render offline from cache', fight.sprites);
    await context.setOffline(false);
  }
};

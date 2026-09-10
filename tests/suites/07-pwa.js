// Finding 09: the game should install like an app and play with no network.
module.exports = {
  name: 'Installable and offline',
  run: async ({ page, context, ok, base, engineUp, until }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

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

    // J03: this was a flat 3000ms hoping the worker had got round to it. The condition it
    // actually wants is the one the two assertions below check, so it waits for THAT: the art
    // set and the shell present in the cache. Wrapped in a catch on purpose - if the cache
    // never fills, the assertions underneath are a better failure line than a thrown timeout,
    // because they say how much of it arrived.
    // J03: this was a flat 3000ms hoping the worker had got round to it. It waits for the
    // condition the assertions below actually check instead. Two things had to change with it.
    // The wait is asked from the Node side through until(), because the question is behind an
    // await and settled() cannot read a Promise - see the note on it in tests/boot.js. And the
    // count is taken across EVERY cache rather than off names[0]: the shell lands first and the
    // art follows, so a read keyed to one entry is a race the old sleep was papering over.
    // The catch is deliberate - if the cache never fills, the two assertions underneath are a
    // better failure line than a thrown timeout, because they say how much of it arrived.
    const countCache = async () => {
      const names = await caches.keys();
      const urls = [];
      for (const n of names) {
        const keys = await (await caches.open(n)).keys();
        keys.forEach(k => urls.push(k.url.split('/').pop()));
      }
      return { art: urls.filter(u => u.endsWith('.webp')).length,
               shell: ['index.html', 'game.js', 'styles.css', ''].filter(f => urls.includes(f)).length };
    };
    // K03: the wait and the row under it both asked for 20 webp files, against an art set that
    // has since grown to 48 - so the label said "/24" while counting up to 48, and the floor of
    // 20 had quietly become "at least two fifths of it". Measured over twenty batteries the
    // count read 23 to 48, mean 35.8, which put the floor 1.9 sd away: a row that fires on
    // whoever is unlucky, on a build with nothing wrong with it.
    //
    // The spread is the harness racing the worker rather than anything about the game, so the
    // answer is to wait for the whole set rather than to widen the band around a half-filled
    // cache. The size is read off ASSET_LIST, so a phase that adds art moves the wait with it.
    // until() evaluates its predicate in the page with no argument, so the figure is parked on
    // the window rather than baked into the closure - a closed-over value does not survive
    // being serialised across.
    const wanted = await page.evaluate(() => {
      window.__wantArt = ASSET_LIST.filter(a => a.endsWith('.webp')).length;
      return window.__wantArt;
    });
    try {
      await until(page, async () => {
        const names = await caches.keys();
        const urls = [];
        for (const nm of names) {
          const keys = await (await caches.open(nm)).keys();
          keys.forEach(k => urls.push(k.url.split('/').pop()));
        }
        return urls.filter(u => u.endsWith('.webp')).length >= window.__wantArt
            && ['index.html', 'game.js', 'styles.css', ''].filter(f => urls.includes(f)).length >= 3;
      }, `the service worker to cache all ${wanted} pieces of art`);
    } catch (e) { /* the assertions below report what did arrive */ }
    const cached = await page.evaluate(countCache);
    ok(`the art set is cached (${cached.art}/${wanted})`, cached.art >= wanted);
    ok('the shell is cached for an offline boot', cached.shell >= 3);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await engineUp(page);
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

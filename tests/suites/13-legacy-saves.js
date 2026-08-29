// Saves outlive the code that wrote them. Every other suite creates its save with the current
// build, so nothing noticed that the PNG-to-WebP migration left old rosters pointing at files
// that no longer exist. These start from saves written by earlier builds.
module.exports = {
  name: 'Legacy saves',
  run: async ({ page, ok, base }) => {
    const notFound = [];
    page.on('response', r => { if (r.status() === 404) notFound.push(r.url().split('/').pop()); });
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- a roster saved before the WebP migration ----
    await page.evaluate(() => {
      localStorage.clear();
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach(c => { c.img = c.img.replace('.webp', '.png'); });
      saveGameState();
    });
    await page.reload();
    await page.waitForTimeout(600);
    notFound.length = 0;
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(400);
    await page.evaluate(() => initiateCombat('RAIDERS', false));
    await page.waitForTimeout(1000);

    const sprites = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('.portrait')];
      return {
        total: imgs.length,
        broken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')),
        heroSrc: [...document.querySelectorAll('#player-team .portrait')].map(i => i.getAttribute('src')),
        rosterPaths: playerRoster.map(c => c.img)
      };
    });
    ok('a pre-WebP roster renders every sprite', sprites.total > 0 && sprites.broken.length === 0);
    ok('no stale asset is requested', notFound.length === 0);
    ok('hero paths were rewritten to the current format',
      sprites.heroSrc.every(s => s.endsWith('.webp')) && sprites.rosterPaths.every(s => s.endsWith('.webp')));

    // ---- a combat snapshot saved before the migration ----
    await page.evaluate(() => {
      localStorage.clear();
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      saveGameState();
      // rewrite the stored save the way an older build would have left it
      const raw = JSON.parse(localStorage.getItem(BASE_SAVE_KEY + 1));
      raw.roster.forEach(c => { c.img = c.img.replace('.webp', '.png'); });
      raw.combat.enemies.forEach(e => { e.img = e.img.replace('.webp', '.png'); });
      raw.combat.bgFile = raw.combat.bgFile.replace('.webp', '.png');
      localStorage.setItem(BASE_SAVE_KEY + 1, JSON.stringify(raw));
    });
    await page.reload();
    await page.waitForTimeout(600);
    notFound.length = 0;
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(1000);

    const resumed = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('.portrait')];
      return {
        inCombat: getComputedStyle(document.getElementById('screen-combat')).display === 'flex',
        broken: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
        bg: document.getElementById('combat-sky-layer').style.backgroundImage,
        enemyPaths: activeEntities.filter(e => !e.isPlayer).map(e => e.img)
      };
    });
    ok('an old mid-fight save still resumes', resumed.inCombat);
    ok('its enemy sprites render', resumed.broken === 0 && resumed.enemyPaths.every(s => s.endsWith('.webp')));
    ok('its background was migrated too', /\.webp/.test(resumed.bg) && !/\.png/.test(resumed.bg));
    ok('nothing 404s on resume', notFound.length === 0);

    // ---- a roster saved with the single-trait field ----
    const traits = await page.evaluate(() => {
      localStorage.clear();
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      saveGameState();
      const raw = JSON.parse(localStorage.getItem(BASE_SAVE_KEY + 1));
      raw.roster.forEach(c => { delete c.traits; c.trait = 'VETERAN'; });
      localStorage.setItem(BASE_SAVE_KEY + 1, JSON.stringify(raw));
      loadGameState();
      return { traits: playerRoster[0].traits, legacyGone: !('trait' in playerRoster[0]) };
    });
    ok('a single-trait save folds into the traits list', traits.traits.join() === 'VETERAN');
    ok('the legacy trait field is dropped', traits.legacyGone);

    // ---- a sprite that genuinely cannot load is hidden, not left as a broken icon ----
    const hidden = await page.evaluate(async () => {
      initiateCombat('RAIDERS', false);
      const img = document.querySelector('.portrait');
      img.src = 'definitely_not_a_real_sprite.webp';
      await new Promise(r => setTimeout(r, 500));
      return getComputedStyle(img).visibility;
    });
    ok('an unloadable sprite is hidden rather than shown broken', hidden === 'hidden');
  }
};

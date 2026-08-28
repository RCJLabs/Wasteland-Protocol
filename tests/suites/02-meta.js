// Finding 01: skulls and Citadel upgrades are global and must outlive any single run.
module.exports = {
  name: 'Citadel meta-progression persists',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(500);

    const r = await page.evaluate(() => {
      currentSlot = 1;
      bossSkulls = 5; metaUpgrades = { startScrap: 0, startLevel: 1, invMax: 4 }; saveMeta();
      confirmNewGame(1.0);
      const afterNewGame = bossSkulls;
      buyMetaUpgrade('LEVEL');
      const spent = { skulls: bossSkulls, startLevel: metaUpgrades.startLevel };
      confirmNewGame(1.0);
      return { afterNewGame, spent, skullsNow: bossSkulls,
               heroLevel: playerRoster[0].level, perks: playerRoster[0].perkPoints };
    });
    ok('skulls survive starting a new run', r.afterNewGame === 5);
    ok('buying the level upgrade costs 2 skulls', r.spent.skulls === 3 && r.spent.startLevel === 2);
    ok('a new run honours the purchased start level', r.heroLevel === 2 && r.perks === 1);
    ok('a second new run does not wipe skulls', r.skullsNow === 3);

    await page.reload();
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({ skulls: bossSkulls, lvl: metaUpgrades.startLevel }));
    ok('meta survives a page reload', after.skulls === 3 && after.lvl === 2);

    const citadel = await page.$$eval('.title-btn', els =>
      els.map(e => e.textContent.trim()).filter(t => /CITADEL/.test(t)));
    ok('the Citadel is reachable from the title screen', citadel.length === 1);
  }
};

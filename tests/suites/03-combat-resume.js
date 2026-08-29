// Finding 02: a fight must survive a reload, so refreshing cannot undo damage or dodge a loss.
module.exports = {
  name: 'Combat survives a reload',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(500);

    const before = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const hero = playerRoster.find(p => p.gridPos > 0); hero.hp = 17;
      const enemy = activeEntities.find(e => !e.isPlayer); enemy.hp = 9;
      saveGameState();
      return { tier: currentTier, heroHp: hero.hp, enemyHp: enemy.hp };
    });

    await page.reload();
    await page.waitForTimeout(600);
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(700);

    const after = await page.evaluate(() => ({
      screen: getComputedStyle(document.getElementById('screen-combat')).display,
      active: combatActive,
      heroHp: (playerRoster.find(p => p.gridPos > 0) || {}).hp,
      enemyHp: (activeEntities.find(e => !e.isPlayer) || {}).hp,
      tier: currentTier,
      liveRefs: activeEntities.some(e => e.isPlayer && e === playerRoster.find(p => p.id === e.id)),
      log: document.getElementById('log').innerText
    }));
    ok('reload drops back into the fight', after.screen === 'flex' && after.active);
    ok('squad damage persisted', after.heroHp === before.heroHp);
    ok('enemy damage persisted', after.enemyHp === before.enemyHp);
    ok('the refresh did not advance the tier', after.tier === before.tier);
    ok('player entities are live roster references', after.liveRefs);
    ok('the log announces the resume', /COMBAT RESUMED/.test(after.log));

    let outcome = 'timeout';
    for (let i = 0; i < 200; i++) {
      await page.waitForTimeout(220);
      const deck = await page.$eval('#command-deck', e => e.innerText).catch(() => '');
      if (/LOOT/i.test(deck)) { await page.click('#command-deck button'); outcome = 'victory'; break; }
      if (/FAILED/i.test(deck)) { await page.click('#command-deck button'); outcome = 'wipe'; break; }
      const t = await page.$('.targetable-enemy') || await page.$('.targetable-ally');
      if (t) { await t.click().catch(() => {}); continue; }
      for (const b of await page.$$('#command-deck button:not([disabled])')) {
        const tx = ((await b.textContent()) || '').trim();
        if (tx && !/CANCEL|BACK|BAG/i.test(tx)) { await b.click().catch(() => {}); break; }
      }
    }
    ok(`the resumed fight is fully playable (${outcome})`, outcome !== 'timeout');
    const snap = await page.evaluate(() =>
      JSON.parse(localStorage.getItem(BASE_SAVE_KEY + currentSlot) || '{}').combat);
    ok('the snapshot clears once the fight is settled', !snap);
  }
};

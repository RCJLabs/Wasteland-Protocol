// Findings 03, 04 and 06: the bounty board must keep issuing work, XP must not be capped at one
// level per battle, and benched heroes must stay rotatable.
module.exports = {
  name: 'Bounties, levelling and the bench',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(500);

    const bounty = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const beforeType = activeBounties[0].type;
      const beforeDesc = activeBounties[0].desc;
      activeBounties[0].current = activeBounties[0].target - 1;
      const scrapBefore = scrap;
      checkBountyProgress(beforeType);
      return { beforeType, beforeDesc, afterType: activeBounties[0].type,
               afterDesc: activeBounties[0].desc, afterProgress: activeBounties[0].current,
               count: activeBounties.length,
               anyClaimed: activeBounties.some(b => b.claimed), paid: scrap > scrapBefore,
               types: activeBounties.map(b => b.type) };
    });
    ok('the board still holds three contracts', bounty.count === 3);
    ok('a completed contract is replaced by a different one',
      bounty.afterType !== bounty.beforeType && bounty.afterDesc !== bounty.beforeDesc);
    ok('the replacement starts at zero progress', bounty.afterProgress === 0);
    ok('no contract is left permanently claimed', !bounty.anyClaimed);
    ok('completing a contract pays out', bounty.paid);
    ok('contracts stay distinct types', new Set(bounty.types).size === 3);

    const xp = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); initiateCombat('RAIDERS', false);
      const hero = playerRoster.find(p => p.gridPos > 0);
      hero.level = 1; hero.perkPoints = 0; hero.xp = 400; hero.xpToNext = 100;
      activeEntities.filter(e => !e.isPlayer).forEach(e => e.hp = 0);
      checkWinState();
      return { level: hero.level, perks: hero.perkPoints, xp: hero.xp, next: hero.xpToNext };
    });
    ok(`one battle can grant several levels (reached ${xp.level})`, xp.level >= 3);
    ok('perk points match the levels gained', xp.perks === xp.level - 1);
    ok('leftover xp sits below the next threshold', xp.xp < xp.next);

    const bench = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); initiateCombat('RAIDERS', false);
      const deployed = playerRoster.filter(c => c.gridPos > 0);
      const benched = playerRoster.filter(c => c.gridPos === 0);
      [...deployed, ...benched].forEach(c => { c.xp = 0; c.xpToNext = 100000; });
      const downedId = deployed[deployed.length - 1].id;
      deployed[deployed.length - 1].hp = 0;
      activeEntities.filter(e => !e.isPlayer).forEach(e => e.hp = 0);
      checkWinState();
      return { deployed: deployed[0].xp, bench: benched[0].xp,
               downed: playerRoster.find(c => c.id === downedId).xp };
    });
    ok('deployed survivors earn full XP', bench.deployed > 0);
    ok('the bench trains at a reduced rate', bench.bench > 0 && bench.bench < bench.deployed);
    ok('downed units earn nothing', bench.downed === 0);
  }
};

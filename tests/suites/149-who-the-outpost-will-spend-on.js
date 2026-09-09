// I08: the recruit is signed and then never stands anywhere. On the I05-repaired harness 242 of
// 456 offers were signed and 19 reached the line - the card out-rated the worst hand on the
// field in only 89 of 456 - so N08's three classes appeared in 18-27 careers of 150 against the
// Medic's 138.
//
// Reading for the cause turned up four game facts that decide the whole question and that no
// suite named, which is how a harness came to model three of them wrongly. simulate.js gated
// stat upgrades, gear and augments on gridPos > 0 for its whole life; the game gates none of
// them. And the fourth fact bounds what any of it can be worth: a signature lasts one
// expedition, because the roster is rebuilt from ROSTER_TEMPLATE at every new run.
//
// So this pins the affordances rather than the balance - what the Outpost will spend on, what a
// signature closes, and what it does not - because those are the facts a policy has to be
// written against, and they are the ones that were guessed.
module.exports = {
  name: 'Who the Outpost will spend on',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── The bench is not cut off from the shop ───────────────────────────────────────
    // Asked through buyUpgrade, the button's own handler, rather than by reading the markup:
    // a gate added to the function is what would actually strand a benched body, and a gate
    // added to the button is caught by the disabled check below it.
    const bench = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const off = playerRoster.find(c => c.gridPos === 0 && c.hp > 0);
      if (!off) return { none: true };
      scrap = 100000;
      const before = { hp: off.maxHp, dmg: off.dmgBase, n: off.upgradeCount };
      buyUpgrade(off.id, 'HP', upgradeCost(off));
      const mid = { hp: off.maxHp, n: off.upgradeCount };
      buyUpgrade(off.id, 'DMG', upgradeCost(off));
      // And the screen has to offer it too, or the function being reachable proves nothing.
      setOutpostTab('ROSTER');            // calls renderOutpost itself
      const btn = document.querySelector(`[data-action="buy-upg"][data-id="${off.id}"]`);
      return { none: false, name: off.name, before, mid,
               after: { hp: off.maxHp, dmg: off.dmgBase, n: off.upgradeCount },
               offered: !!btn, enabled: !!btn && !btn.disabled };
    });
    ok('somebody is standing off the line to test with', !bench.none);
    ok(`the Outpost sells to a benched operator (${bench.name}: HP ${bench.before.hp} -> ${bench.mid.hp}, DMG ${bench.before.dmg} -> ${bench.after.dmg})`,
      !bench.none && bench.mid.hp > bench.before.hp && bench.after.dmg > bench.before.dmg);
    ok(`and the screen offers the button rather than only the function (${bench.offered ? 'present' : 'absent'}, ${bench.enabled ? 'enabled' : 'disabled'})`,
      !!bench.offered && !!bench.enabled);
    ok(`each purchase counts once against that operator (${bench.before.n} -> ${bench.after.n})`,
      !bench.none && bench.after.n === bench.before.n + 2);

    // ── The price is the body's own, so a fresh one is the cheapest on the menu ──────
    const priced = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      scrap = 100000;
      const a = playerRoster[0], b = playerRoster[1];
      const fresh = upgradeCost(a);
      for (let i = 0; i < 5; i++) buyUpgrade(b.id, 'HP', upgradeCost(b));
      return { fresh, worn: upgradeCost(b), untouched: upgradeCost(a), bought: b.upgradeCount };
    });
    ok(`upgradeCost rides the operator's own count, not the roster's (fresh ${priced.fresh}, after ${priced.bought} purchases ${priced.worn})`,
      priced.worn > priced.fresh);
    ok('and buying for one body does not reprice another', priced.untouched === priced.fresh);

    // ── What a signature closes, and what it leaves open ─────────────────────────────
    const signed = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 4; currentTier = 6;
      playerRoster.forEach(c => { c.level = 7; c.perkPoints = 0; });
      const tpl = recruitables()[0];
      scrap = 100000;
      pendingRecruit = { id: tpl.id, cost: recruitCost(), taken: false };
      const par = Math.round(playerRoster.reduce((a, c) => a + c.level, 0) / playerRoster.length);
      signOnRecruit();
      const me = playerRoster.find(c => c.id === tpl.id);
      return { par, level: me.level, points: me.perkPoints, ups: me.upgradeCount,
               slot: me.gridPos, share: me.hp / me.maxHp, health: RECRUIT_HEALTH };
    });
    // The engine closes the level gap on purpose - its own comment says a fresh recruit six
    // sectors deep would be a body, not a hand - and this asserts the shape of that, not a
    // number, because par moves with whatever the squad has reached.
    ok(`a signature levels the recruit to squad par (par ${signed.par}, arrived at ${signed.level})`,
      signed.level === signed.par);
    ok(`and banks a point for every level it granted (${signed.points})`,
      signed.points >= signed.par - 1);
    // And these are the two it does not close, which is what the fielding decision turns on.
    ok(`it does NOT close the bought-upgrade gap (upgradeCount ${signed.ups})`, signed.ups === 0);
    ok(`and leaves them off the line for the player to place (gridPos ${signed.slot})`, signed.slot === 0);
    ok(`they arrive hurt, at the engine's own share (${(signed.share * 100).toFixed(0)}% of a bar, RECRUIT_HEALTH ${signed.health})`,
      Math.abs(signed.share - signed.health) < 0.05);

    // ── And a signature lasts exactly one expedition ─────────────────────────────────
    const kept = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 4; currentTier = 6;
      const openBefore = recruitables().length;
      const tpl = recruitables()[0];
      scrap = 100000;
      pendingRecruit = { id: tpl.id, cost: recruitCost(), taken: false };
      signOnRecruit();
      const onNow = playerRoster.some(c => c.id === tpl.id);
      const openNow = recruitables().length;
      confirmNewGame(1.0);
      return { id: tpl.id, openBefore, onNow, openNow,
               onNext: playerRoster.some(c => c.id === tpl.id),
               openNext: recruitables().length };
    });
    ok(`signing puts them on the roster and takes them off the shelf (${kept.openBefore} open, then ${kept.openNow})`,
      kept.onNow === true && kept.openNow === kept.openBefore - 1);
    ok('and the next expedition does not know them', kept.onNext === false);
    // Stated as "the shelf is whole again" rather than as a pool size, so growing the pool does
    // not fail this the way H13 failed three suites that had baked a tuning pass into a literal.
    ok(`so the shelf is whole again next run (${kept.openNow} open, then ${kept.openNext})`,
      kept.openNext === kept.openBefore);
  }
};

// H14: the income constant, and what it actually buys.
//
// sectorRewardMult() returns 1.4^(sector-1) and had never been measured. Two notes in game.js
// and one in simulate.js all said the same thing about it - "the purse outgrows the fight by
// about 32% a sector by design, which is what lets player power compound" - and the H13 commit
// repeated it. It is not true, and the reason is visible from the call sites: sectorRewardMult
// is on BOTH sides of the ledger. Four income sources ride it, and so does every price the
// Outpost and the Armory quote. An upgrade grants a flat +10 HP or +3 DMG at a price of
// (30 + 25n) x 1.4^(s-1), paid out of income that is also x 1.4^(s-1). The constant cancels.
//
// Measured over three 40-expedition samples at 1.0, 1.4 and 1.7, stat upgrades bought per run
// read 49.7 / 50.0 / 48.9 while the purse on arrival read 282 / 753 / 1617. The purse grows
// 5.7x across that range and buys the same fifty upgrades. Player power does not compound with
// this constant; it is a denomination.
//
// WHAT IT DOES BUY is everything priced off a curve that is NOT this one, and there are two of
// those. recruitCost() is linear in depthIndex - 90 + 6 a tier - so it grows about 5.6x over a
// road on which income grows 7.5x. And a whole subsystem is flat: the scar clinic, the
// collector, and ten choices in the events and the faces charge sector-one constants that never
// move at all. Against 1.4 a 300-scrap settlement with Vela costs a fifteenth of a sector-7
// node by the end of the road; against 1.0 it costs what it always did. That is E09's finding -
// "anything priced off a sector-one constant stops being a decision about halfway down the
// road" - alive in a subsystem E09 never looked at, and it is what the sweep was really moving.
//
// So this suite pins the three curves apart. It does not assert any of their values: H13 went
// red on three suites that had baked one balance pass into a literal, and the point here is
// which function a price rides, not what the constant is set to this week.
module.exports = {
  name: 'Three prices in one economy',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── One curve, on both sides of the ledger ────────────────────────────────────────
    // Read at the two ends of the road through the engine's own functions rather than by
    // rebuilding the arithmetic here - a hand copy would only prove this file can multiply.
    // fightPayout rolls 0-29 on top, so Math.random is pinned for the pair and put back.
    const ride = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const stub = { upgradeCount: 0 };
      const real = Math.random;
      Math.random = () => 0.5;
      const at = s => {
        currentSector = s; currentTier = TOTAL_TIERS; isCurrentNodeElite = false;
        return { curve: sectorRewardMult(),
                 income: { emptyPool: emptyPoolScrap(), cacheForced: cachePayout(false),
                           cacheClean: cachePayout(true), fight: fightPayout() },
                 price:  { medbay: medBayCost(), upgrade: upgradeCost(stub),
                           breakdown: breakdownCost(), sell: sellValue(),
                           capstone: capstoneCost(), signature: sigBuyCost(),
                           armory: shopPrice(100) } };
      };
      const one = at(1), deep = at(FINAL_SECTOR);
      Math.random = real;
      return { one, deep, span: FINAL_SECTOR };
    });
    // Rounding is real - every one of these ends in floor(), round() or max(1, ...) - so a ratio
    // is allowed to miss by less than one unit of the sector-one price rather than exactly.
    //
    // `b > a` is not decoration. Written without it this check passed on a tree whose curve had
    // been flattened to 1.0 by a sweep still running in another process: every value equalled
    // itself times one, and a suite about which prices ride the curve reported that all of them
    // did on a build where none of them could. A ratio test against a constant that might be the
    // identity has to assert the thing moved as well as where it landed.
    const rides = (side, key) => {
      const a = ride.one[side][key], b = ride.deep[side][key];
      return b > a && Math.abs(b - a * ride.deep.curve) <= Math.max(1, a * 0.02);
    };
    const incomeKeys = Object.keys(ride.one.income), priceKeys = Object.keys(ride.one.price);
    ok(`the curve is 1.0 where the game starts and ${ride.deep.curve.toFixed(2)} at the end of the road`,
      ride.one.curve === 1 && ride.deep.curve > 1);
    ok(`every income source rides it (${incomeKeys.join(', ')})`,
      incomeKeys.every(k => rides('income', k)));
    ok(`and so does every price the Outpost and the Armory quote (${priceKeys.join(', ')})`,
      priceKeys.every(k => rides('price', k)));

    // ── So the exchange rate between them does not move ───────────────────────────────
    // This is the assertion the notes failed. What an upgrade costs measured in cleared nodes -
    // the only unit a player actually spends in - is the same at both ends of the road, because
    // both halves of that fraction ride the same curve. A purse that grows 7.5x against prices
    // that grow 7.5x has not outgrown anything.
    const inNodes = r => r.price.upgrade / r.income.fight;
    const shallow = inNodes(ride.one), deep = inNodes(ride.deep);
    ok(`an upgrade costs the same in cleared nodes at either end (${shallow.toFixed(3)} vs ${deep.toFixed(3)})`,
      Math.abs(shallow - deep) < 0.02);
    ok('so the income curve cannot be what lets player power compound',
      Math.abs(shallow - deep) < 0.02 && ride.deep.curve > 1);

    // ── Two other curves, which is where the constant actually lands ──────────────────
    const others = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const at = s => {
        currentSector = s; currentTier = TOTAL_TIERS;
        return { recruit: recruitCost(), scar: scarTreatCost(), collector: collectorPrice(),
                 depth: depthIndex(), curve: sectorRewardMult() };
      };
      return { one: at(1), deep: at(FINAL_SECTOR) };
    });
    ok(`a recruit gets dearer with depth, but on its own linear curve (${others.one.recruit} -> ${others.deep.recruit})`,
      others.deep.recruit > others.one.recruit
      && others.deep.recruit < others.one.recruit * others.deep.curve);
    // `> 0` guards a vacuous pass: scarTreatCost returns 0 outright while a career holds an
    // unused Chapel, and 0 === 0 would report a flat price on a build that has no price at all.
    ok(`the scar clinic charges sector one all the way down (${others.one.scar} -> ${others.deep.scar})`,
      others.one.scar > 0 && others.deep.scar === others.one.scar);
    ok(`and so does the collector (${others.one.collector} -> ${others.deep.collector})`,
      others.deep.collector === others.one.collector);
    // The consequence, which is the part that matters: a flat price is a shrinking fraction of
    // the money a node pays. If somebody puts these on outpostPrice the way E09 did the medbay,
    // THIS assertion should go red - it is not a balance number, it is the claim that a third
    // curve exists, and fixing that is exactly what would make it false. Rewrite the section
    // then; do not soften it.
    const nodes = (p, r) => p / r.income.fight;
    ok(`so a flat price costs a fraction of the node it used to (${nodes(others.one.collector, ride.one).toFixed(1)} -> ${nodes(others.deep.collector, ride.deep).toFixed(1)} cleared nodes)`,
      nodes(others.deep.collector, ride.deep) < nodes(others.one.collector, ride.one) / 2);

    // ── The flat-priced choices, counted rather than forgotten ────────────────────────
    // A readout, not a gate. E09 fixed four Outpost lines that were sector-one constants and
    // did not look at the events; these are what is left, so the next pass at them starts from
    // a number. The counter is proved on synthetic sources first, because a regex that found
    // nothing would report a clean subsystem in exactly the same words as a fixed one.
    const flat = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      // Comments are stripped INSIDE find, not before it, so the synthetic cases below exercise
      // the same stripping the live count uses. Written the other way - stripping the live source
      // here and handing the synthetic one a pre-stripped string - the comment case tested this
      // suite's own regex instead of the counter's, and a mutant that removed the stripping
      // altogether survived: game.js happens to quote no literal price in prose today, so the
      // live number did not move and nothing else was watching.
      const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      const find = t => (strip(t).match(/scrap -= (\d+)\b/g) || []).map(m => Number(m.slice(9)));
      return { live: find(src),
               finds: find('scrap -= 90; and later scrap -= 250;'),
               ignoresComments: find('// scrap -= 90;\n'),
               ignoresVariables: find('scrap -= price; scrap -= paid; scrap -= owed;') };
    });
    ok(`the counter finds a literal price where there is one (${flat.finds.join(', ')})`,
      flat.finds.length === 2 && flat.finds[0] === 90 && flat.finds[1] === 250);
    ok('and does not count one that is only quoted in a comment', flat.ignoresComments.length === 0);
    ok('nor a price held in a variable, which is the shape that rides a curve',
      flat.ignoresVariables.length === 0);
    ok(`the choices priced at sector one are counted, not forgotten (${flat.live.length} of them, ${flat.live.reduce((a, c) => a + c, 0)} scrap in total)`,
      flat.live.length === flat.live.filter(n => n > 0).length);
  }
};

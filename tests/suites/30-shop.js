// Scrap had three uses and all of them lived at the Outpost, so the route graph sold nothing:
// you walked it to fight. The Armory is a node that competes for the detour - gear, a
// marked-up relic, tempo in a syringe, a quirk do-over, and a prepaid regroup.
module.exports = {
  name: 'The Armory',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the generator places it, uncommonly and in bounds ----
    const gen = await page.evaluate(() => {
      let withShop = 0, twoPlus = 0, badTier = 0, badHost = 0, invalid = 0;
      for (let i = 0; i < 60; i++) {
        const m = generateSectorMap(Math.random);
        if (!validateSectorMap(m)) invalid++;
        const shops = m.nodes.filter(n => n.type === 'SHOP');
        if (shops.length >= 1) withShop++;
        if (shops.length >= 2) twoPlus++;
        shops.forEach(s => {
          if (s.tier < 3 || s.tier > 9) badTier++;
          if (s.elite) badHost++;
        });
      }
      return { withShop, twoPlus, badTier, badHost, invalid };
    });
    ok(`most maps carry one armory, not all (${gen.withShop}/60)`, gen.withShop >= 25 && gen.withShop <= 52);
    ok('never two of them', gen.twoPlus === 0);
    ok('always tiers 3-9, never on an elite', gen.badTier === 0 && gen.badHost === 0);
    ok('shop maps still validate', gen.invalid === 0);

    // ---- the map draws it as its own destination ----
    const mapUi = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
      const n = sectorMap.nodes.find(x => x.tier === 2) || sectorMap.nodes[1];
      n.type = 'SHOP'; n.elite = false;
      renderMap();
      const btn = document.querySelector(`[data-node="${n.id}"]`);
      return { action: btn.dataset.action, label: btn.innerText, cls: btn.className };
    });
    ok('an armory node routes to the shop', mapUi.action === 'node-shop');
    ok('labelled and tinted apart from fights', /ARMORY/.test(mapUi.label) && /shop-node/.test(mapUi.cls));

    // ---- stock: the audit's five shelves at sector prices ----
    const stock = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
      const s1 = rollShopStock();
      currentSector = 3;
      const s3 = rollShopStock();
      currentSector = 1;
      const kinds = s1.map(it => it.kind);
      const relic = s1.find(it => it.kind === 'RELIC');
      const relicTier = relic ? RELIC_POOL.find(r => r.id === relic.id).tier : null;
      return {
        kinds, stims: kinds.filter(k => k === 'STIM').length,
        gearPrice: s1.find(it => it.kind === 'GEAR').price,
        relicPrice: relic ? relic.price : 0, relicTier,
        rerollPrice: s1.find(it => it.kind === 'REROLL').price,
        bondPrice: s1.find(it => it.kind === 'INSURANCE').price,
        deepGearPrice: s3.find(it => it.kind === 'GEAR').price
      };
    });
    ok('the shelf holds gear, a relic, stims, therapy and the bond',
      stock.kinds.includes('GEAR') && stock.kinds.includes('RELIC') && stock.stims === 2 &&
      stock.kinds.includes('REROLL') && stock.kinds.includes('INSURANCE'));
    ok(`sector-1 prices sit on the curve (gear ${stock.gearPrice}, therapy ${stock.rerollPrice}, bond ${stock.bondPrice})`,
      stock.gearPrice === 140 && stock.rerollPrice === 60 && stock.bondPrice === 90);
    ok(`the relic wears a markup (${stock.relicPrice} for a ${stock.relicTier})`,
      stock.relicPrice === (stock.relicTier === 'RARE' ? 320 : 240));
    ok(`sector 3 nearly doubles it (gear ${stock.deepGearPrice})`, stock.deepGearPrice === Math.floor(140 * 1.4 * 1.4));

    // ---- buying, with a pinned shelf ----
    const pinShop = () => page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
      activeShop = { nodeId: 'pin', stock: [
        { kind: 'GEAR', id: 'PLATED_VEST', price: 140, sold: false },
        { kind: 'RELIC', id: 'WHETSTONE', price: 240, sold: false },
        { kind: 'STIM', price: 35, sold: false },
        { kind: 'REROLL', price: 60, sold: false },
        { kind: 'INSURANCE', price: 90, sold: false }
      ] };
      shopRerollPick = false;
    });

    await pinShop();
    const bought = await page.evaluate(() => {
      scrap = 1000; renderShop();
      buyShopItem(0); buyShopItem(1); buyShopItem(2);
      return { scrap, stash: gearStash.includes('PLATED_VEST'), relic: hasRelic('WHETSTONE'),
               stims: inventory.filter(i => i === 'MED_STIM').length,
               sold: activeShop.stock.slice(0, 3).every(it => it.sold),
               soldTags: (document.getElementById('shop-stock').innerHTML.match(/SOLD/g) || []).length };
    });
    ok('gear lands in the stash, the relic goes live, the stim in the bag',
      bought.stash && bought.relic && bought.stims >= 2);
    ok(`and the till is right (1000 - 415 = ${bought.scrap})`, bought.scrap === 585);
    ok('bought rows read SOLD', bought.sold && bought.soldTags === 3);

    await pinShop();
    const guards = await page.evaluate(() => {
      scrap = 5; renderShop();
      const disabled = [...document.querySelectorAll('.shop-buy')].every(b => b.disabled);
      buyShopItem(0);
      const brokeScrap = scrap, brokeSold = activeShop.stock[0].sold;
      scrap = 1000;
      inventory = Array(metaUpgrades.invMax || 4).fill('MED_STIM');
      renderShop();
      const bagFull = /BAG FULL/.test(document.getElementById('shop-stock').innerHTML);
      buyShopItem(2);
      return { disabled, brokeScrap, brokeSold, bagFull, overflow: inventory.length > (metaUpgrades.invMax || 4) };
    });
    ok('an empty pocket buys nothing', guards.disabled && guards.brokeScrap === 5 && !guards.brokeSold);
    ok('a full bag refuses the stim', guards.bagFull && !guards.overflow);

    // ---- quirk therapy: pick who sits down ----
    await pinShop();
    const therapy = await page.evaluate(() => {
      scrap = 500;
      const ch = playerRoster.find(c => c.quirk);
      const before = { id: ch.quirk.id, baseHp: ch.maxHp - ch.quirk.hp, baseDmg: ch.dmgBase - ch.quirk.dmg, baseSpd: ch.speed - ch.quirk.spd };
      buyShopItem(3);
      const picking = shopRerollPick && document.getElementById('shop-stock').innerHTML.includes('WHO SITS DOWN?');
      const unchargedYet = scrap === 500;
      shopRerollQuirk(ch.id);
      return { picking, unchargedYet, scrap,
               changed: ch.quirk.id !== before.id,
               baseKept: (ch.maxHp - ch.quirk.hp) === before.baseHp &&
                         (ch.dmgBase - ch.quirk.dmg) === before.baseDmg &&
                         (ch.speed - ch.quirk.spd) === before.baseSpd,
               hpOk: ch.hp <= ch.maxHp, sold: activeShop.stock[3].sold, pickClosed: !shopRerollPick };
    });
    ok('therapy asks who sits down before charging', therapy.picking && therapy.unchargedYet);
    ok(`the quirk changes and the base stats survive the swap (500 - 60 = ${therapy.scrap})`,
      therapy.changed && therapy.baseKept && therapy.scrap === 440);
    ok('one session per visit, and the picker closes', therapy.sold && therapy.pickClosed && therapy.hpOk);

    // ---- the regroup bond pays out exactly once ----
    await pinShop();
    const bond = await page.evaluate(() => {
      scrap = 1000; buyShopItem(4);
      const insured = regroupInsured, paid = scrap;
      renderSquadBroken();
      const screenNote = document.getElementById('runover-lines').innerText;
      regroupSquad();
      const afterInsured = scrap;
      const flagCleared = !regroupInsured;
      regroupSquad();
      return { insured, paid, screenNote, afterInsured, flagCleared, afterSecond: scrap };
    });
    ok(`the bond costs its price (1000 - 90 = ${bond.paid})`, bond.insured && bond.paid === 910);
    ok('the broken screen says the bond covers it', /BOND COVERS IT/.test(bond.screenNote));
    ok('the insured regroup takes no scrap', bond.afterInsured === 910 && bond.flagCleared);
    ok(`the next one charges as ever (${bond.afterSecond})`, bond.afterSecond === 455);

    // ---- entering and leaving through the real flow ----
    const flow = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
      const n = sectorMap.nodes.find(x => x.tier === 1);
      n.type = 'SHOP';
      enterNode(n.id); initiateShop();
      const open = getComputedStyle(document.getElementById('screen-shop')).display === 'flex';
      const stocked = activeShop && activeShop.nodeId === n.id && activeShop.stock.length >= 5;
      const tierBefore = currentTier;
      finishShop();
      return { open, stocked, cleared: clearedNodeIds.includes(n.id),
               advanced: currentTier === tierBefore + 1, closed: activeShop === null,
               mapBack: getComputedStyle(document.getElementById('screen-map')).display === 'flex' };
    });
    ok('walking in opens the stall over the real node', flow.open && flow.stocked && flow.cleared);
    ok('leaving advances the route and folds the stall', flow.advanced && flow.closed && flow.mapBack);

    // ---- a reload mid-haggle resumes the same shelf ----
    await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
      activeShop = { nodeId: 'persist', stock: [
        { kind: 'GEAR', id: 'GAS_MASK', price: 140, sold: false },
        { kind: 'STIM', price: 35, sold: true }
      ] };
      saveGameState();
    });
    await page.reload();
    await page.waitForTimeout(700);
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(500);
    const resumed = await page.evaluate(() => ({
      open: getComputedStyle(document.getElementById('screen-shop')).display === 'flex',
      gear: activeShop && activeShop.stock[0] && activeShop.stock[0].id === 'GAS_MASK',
      soldKept: activeShop && activeShop.stock[1] && activeShop.stock[1].sold === true
    }));
    ok('a reload mid-haggle reopens the same shelf', resumed.open && resumed.gear);
    ok('with SOLD rows still sold', resumed.soldKept);

    // ---- saves from before the Armory existed ----
    const legacy = await page.evaluate(() => {
      saveGameState();
      const raw = JSON.parse(Store.get(BASE_SAVE_KEY + currentSlot));
      delete raw.activeShop; delete raw.regroupInsured;
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw));
      loadGameState();
      return { shop: activeShop, insured: regroupInsured };
    });
    ok('a pre-armory save loads with no stall and no bond', legacy.shop === null && legacy.insured === false);

    // ---- the field manual has the page ----
    const codex = await page.evaluate(() => {
      const e = CODEX.find(x => x.id === 'ARMORY');
      return e ? e.body().join(' ') : '';
    });
    ok('the field manual explains the armory and the bond', /Regroup Bond/.test(codex) && /reward curve/.test(codex));
  }
};

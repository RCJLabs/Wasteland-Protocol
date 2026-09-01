// Four of the Citadel's buildings carried no maximum - the crane, the barracks, the rigging bay
// and the bunker - so a career could buy its way past anything the game had. Not a theory: the
// simulator's skull-spending policy hit it three separate ways. Preferring the bunker stacked
// unlimited retries and forty-expedition samples stopped terminating; preferring the cheapest
// bought SCRAP CRANE to level 327 and nothing else, which is +16,350 starting Scrap.
//
// Every spot has a ceiling now, and above them an upstairs that is sealed until a career has
// walked the whole road once. This suite holds two things: that nothing on the hillside runs
// forever, and that each of the three new buildings actually does what its card says - which is
// the failure mode a meta screen invites, since a building that does nothing still looks built.
module.exports = {
  name: 'The Citadel',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__wipe = () => {
        careerWins = 0; bossSkulls = 0;
        metaUpgrades = { startScrap: 0, startLevel: 1, invMax: 4, extraRegroups: 0, vault: 0,
                         heirloom: null, heirloomWalked: false, rerolls: 0, discount: 0,
                         archive: 0, warRoom: 0, cache: 0, chapel: 0, footlocker: 0, locker: null, roadCrew: 0 };
      };
    });

    // ---- nothing on the hillside runs forever ----
    const shape = await page.evaluate(() => ({
      n: CITADEL_SPOTS.length,
      uncapped: CITADEL_SPOTS.filter(sp => sp.max === undefined).map(sp => sp.name),
      complete: CITADEL_SPOTS.every(sp => sp.kind && sp.name && sp.pitch && sp.cost > 0 && typeof sp.level === 'function' && typeof sp.apply === 'function'),
      kinds: new Set(CITADEL_SPOTS.map(sp => sp.kind)).size,
      groundCost: CITADEL_SPOTS.filter(sp => !sp.wins).reduce((a, sp) => a + sp.cost * sp.max, 0),
      wholeCost: CITADEL_SPOTS.reduce((a, sp) => a + sp.cost * sp.max, 0),
      upstairs: CITADEL_SPOTS.filter(sp => sp.wins).map(sp => sp.name)
    }));
    ok(`every one of the ${shape.n} spots has a ceiling`, shape.uncapped.length === 0);
    ok('each named, priced and wired', shape.complete && shape.kinds === shape.n);
    ok(`the ground floor is finite (${shape.groundCost} skulls)`, shape.groundCost > 0 && shape.groundCost < 200);
    ok(`and so is the whole hillside (${shape.wholeCost})`, shape.wholeCost > shape.groundCost);
    ok(`there is an upstairs (${shape.upstairs.join(', ')})`, shape.upstairs.length === 3);

    // Buying past a ceiling has to be refused by the engine, not merely by a disabled button.
    const ceilings = await page.evaluate(() => {
      __wipe(); careerWins = 9; bossSkulls = 100000;
      const rows = CITADEL_SPOTS.map(sp => {
        for (let i = 0; i < sp.max + 12; i++) buyMetaUpgrade(sp.kind);
        return { name: sp.name, level: sp.level(), max: sp.max, maxed: spotMaxed(sp) };
      });
      const spent = 100000 - bossSkulls;
      return { rows, over: rows.filter(r => r.level > r.max), spent, all: rows.every(r => r.maxed) };
    });
    ok('no spot can be bought past its ceiling', ceilings.over.length === 0);
    ok('and every one of them reaches it', ceilings.all);
    ok(`the whole hillside costs what the table says (${ceilings.spent})`, ceilings.spent === shape.wholeCost);

    // ---- the upstairs is sealed until the road has been walked ----
    const sealed = await page.evaluate(() => {
      __wipe(); bossSkulls = 500; metaUpgrades.vault = 1;
      const up = CITADEL_SPOTS.filter(sp => sp.wins);
      const before = up.map(sp => ({ name: sp.name, open: spotUnlocked(sp), why: spotBlocker(sp) }));
      up.forEach(sp => buyMetaUpgrade(sp.kind));
      const bought = up.filter(sp => sp.level() > 0).length;
      const skulls = bossSkulls;
      careerWins = 1;
      const after = up.map(sp => ({ name: sp.name, open: spotUnlocked(sp) }));
      up.forEach(sp => buyMetaUpgrade(sp.kind));
      return { before, bought, skulls, after, nowBuilt: up.filter(sp => sp.level() > 0).length };
    });
    ok('an unwalked road seals all three', sealed.before.every(r => !r.open));
    ok('and the card says why', sealed.before.every(r => /ROAD WALKED/i.test(r.why || '')));
    ok('the engine refuses to sell them', sealed.bought === 0 && sealed.skulls === 500);
    ok('walking it once opens all three', sealed.after.every(r => r.open) && sealed.nowBuilt === 3);

    // The Footlocker still wants the Vault under it: a win is not a skeleton key.
    const stacked = await page.evaluate(() => {
      __wipe(); careerWins = 5; bossSkulls = 500;
      const locker = CITADEL_SPOTS.find(sp => sp.kind === 'LOCKER');
      const sealedByVault = { open: spotUnlocked(locker), why: spotBlocker(locker) };
      buyMetaUpgrade('LOCKER');
      const refused = !metaUpgrades.footlocker;
      buyMetaUpgrade('VAULT'); buyMetaUpgrade('LOCKER');
      return { sealedByVault, refused, built: !!metaUpgrades.footlocker };
    });
    ok('the Footlocker is still sealed without the Vault',
      !stacked.sealedByVault.open && /VAULT/i.test(stacked.sealedByVault.why) && stacked.refused);
    ok('and opens once the Vault stands', stacked.built);

    // ---- THE CHAPEL: one treatment an expedition, and only one ----
    const chapel = await page.evaluate(() => {
      const run = withChapel => {
        __wipe(); careerWins = 1; bossSkulls = 50;
        if (withChapel) buyMetaUpgrade('CHAPEL');
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
        const c = playerRoster[0];
        c.scars = []; giveScar(c, () => 0); giveScar(c, () => 0.5);
        scrap = 0;
        const first = { price: scarTreatCost(), took: healScar(c.id, c.scars[0]) };
        const second = { price: scarTreatCost(), took: c.scars.length ? healScar(c.id, c.scars[0]) : false };
        return { first, second, left: c.scars.length };
      };
      const withOut = run(false), withIt = run(true);
      // And the free one comes back on the next expedition, not once a career.
      __wipe(); careerWins = 1; bossSkulls = 50; buyMetaUpgrade('CHAPEL');
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
      const a = playerRoster[0]; a.scars = []; giveScar(a, () => 0);
      scrap = 0; healScar(a.id, a.scars[0]);
      const spentThisRun = scarTreatCost();
      confirmNewGame(1.0);
      const freshRun = scarTreatCost();
      return { withOut, withIt, spentThisRun, freshRun, full: SCAR_TREAT_COST };
    });
    ok(`without the Chapel a treatment costs ${chapel.full}`,
      chapel.withOut.first.price === chapel.full && chapel.withOut.first.took === false);
    ok('with it the first one is free', chapel.withIt.first.price === 0 && chapel.withIt.first.took === true);
    ok('and only the first', chapel.withIt.second.price === chapel.full && chapel.withIt.second.took === false);
    ok('the free one returns with the next expedition',
      chapel.spentThisRun === chapel.full && chapel.freshRun === 0);

    // ---- THE FOOTLOCKER: one piece out, one piece back ----
    const locker = await page.evaluate(() => {
      __wipe(); careerWins = 1; bossSkulls = 50;
      buyMetaUpgrade('VAULT'); buyMetaUpgrade('LOCKER');
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
      gearStash = []; const first = rollGear(), second = rollGear();
      gearStash.push(first, second);
      playerRoster[0].trinket = null;
      stashLocker();
      const held = metaUpgrades.locker;
      confirmNewGame(1.0);
      const deployed = [...gearStash];
      // Worn gear counts as carried, not lost.
      gearStash = []; playerRoster[0].weaponMod = null;
      const worn = rollGear(); playerRoster[0].trinket = worn;
      stashLocker();
      const fromWorn = metaUpgrades.locker;
      // And with the building unbuilt, nothing is kept at all.
      metaUpgrades.footlocker = 0; metaUpgrades.locker = null;
      gearStash = [rollGear()];
      stashLocker();
      return { first, held, deployed, fromWorn, worn, unbuilt: metaUpgrades.locker };
    });
    ok(`the locker keeps the first piece the squad found (${locker.held})`, locker.held === locker.first);
    ok('and hands it back on the next deployment', locker.deployed.includes(locker.held) && locker.deployed.length === 1);
    ok('gear worn on an operator counts as carried', locker.fromWorn === locker.worn);
    ok('and an unbuilt locker keeps nothing', locker.unbuilt === null);

    // ---- THE ROAD CREW: a tier less, every sector ----
    const road = await page.evaluate(() => {
      const walk = withCrew => {
        __wipe(); careerWins = 1; bossSkulls = 50;
        if (withCrew) buyMetaUpgrade('ROADCREW');
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
        const opening = currentTier;
        const offered = [...new Set(availableNodeIds().map(id => nodeById(id).tier))];
        currentTier = TOTAL_TIERS + 1; advanceSector();
        const next = currentTier;
        // A fallback puts them back at the same place the sector opens on.
        currentTier = 5; runStats.regroups = 2; regroupSquad();
        return { opening, offered, next, afterFallback: currentTier, tiers: TOTAL_TIERS - opening + 1 };
      };
      return { without: walk(false), withIt: walk(true), total: TOTAL_TIERS };
    });
    ok(`without it a sector is ${road.total} tiers from the road (opens at ${road.without.opening})`,
      road.without.opening === 1 && road.without.tiers === road.total);
    ok(`with it a sector opens a tier in (${road.withIt.opening})`, road.withIt.opening === 2);
    ok('and the map offers that tier rather than the one they skipped',
      road.withIt.offered.length === 1 && road.withIt.offered[0] === 2);
    ok('every sector after it too', road.withIt.next === 2 && road.without.next === 1);
    ok('and a fallback puts them back where the sector opens', road.withIt.afterFallback === 2);

    // ---- it all survives the meta save ----
    const persist = await page.evaluate(() => {
      __wipe(); careerWins = 1; bossSkulls = 60;
      ['VAULT', 'CHAPEL', 'LOCKER', 'ROADCREW'].forEach(k => buyMetaUpgrade(k));
      saveMeta();
      metaUpgrades = { startScrap: 0, startLevel: 1, invMax: 4, extraRegroups: 0, vault: 0,
                       heirloom: null, heirloomWalked: false, rerolls: 0, discount: 0,
                       archive: 0, warRoom: 0, cache: 0, chapel: 0, footlocker: 0, locker: null, roadCrew: 0 };
      loadMeta();
      return { chapel: metaUpgrades.chapel, locker: metaUpgrades.footlocker, road: metaUpgrades.roadCrew,
               wins: careerWins };
    });
    ok('the upstairs survives a reload', persist.chapel === 1 && persist.locker === 1 && persist.road === 1);
    ok('and so does the clear that opened it', persist.wins === 1);

    // ---- the hillside says where a building can get to ----
    const cards = await page.evaluate(() => {
      __wipe(); careerWins = 0; bossSkulls = 3; renderCitadel();
      const txt = document.getElementById('citadel-list').innerText;
      const crane = CITADEL_SPOTS.find(sp => sp.kind === 'SCRAP');
      buyMetaUpgrade('SCRAP');
      renderCitadel();
      return { states: CITADEL_SPOTS.map(sp => spotState(sp)),
               craneState: spotState(crane), craneMax: crane.max,
               sealedShown: /ROAD WALKED/i.test(txt),
               named: CITADEL_SPOTS.every(sp => txt.includes(sp.name)) };
    });
    ok(`a stacking building prints its ceiling (${cards.craneState})`,
      cards.craneState === `LVL 1/${cards.craneMax}`);
    ok('every spot is on the hillside', cards.named);
    ok('and a sealed one says what it is waiting for', cards.sealedShown);

    // ---- the manual ----
    const manual = await page.evaluate(() => {
      renderCodex();
      const txt = document.getElementById('codex-body').innerText;
      return { has: /THE CITADEL/i.test(txt),
               named: CITADEL_SPOTS.every(sp => txt.includes(sp.name)),
               upstairs: /upstairs/i.test(txt),
               capped: /ceiling/i.test(txt) };
    });
    ok('the manual has an entry for the hillside', manual.has);
    ok('naming every building on it', manual.named);
    ok('and saying both that they are capped and that there is an upstairs',
      manual.capped && manual.upstairs);
  }
};

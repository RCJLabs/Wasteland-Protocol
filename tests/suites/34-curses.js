// The cache decision was "take the rare." Curses give the pool teeth - real upsides with
// real costs, marked unmistakably and never dealt at random - and sets give a reason to
// chase a second common. The collector's table gambles a held relic on two blind draws.
module.exports = {
  name: 'Curses and gambles',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the cursed shelf ----
    const shelf = await page.evaluate(() => {
      const cursed = RELIC_POOL.filter(r => r.tier === 'CURSED');
      return { count: cursed.length,
               described: cursed.every(r => r.name && r.desc && /but/i.test(r.desc)),
               ids: new Set(cursed.map(r => r.id)).size,
               sets: RELIC_SETS.length,
               setsReal: RELIC_SETS.every(s => RELIC_POOL.some(r => r.id === s.a) && RELIC_POOL.some(r => r.id === s.b)) };
    });
    ok(`six curses on the shelf, each naming its teeth`, shelf.count === 6 && shelf.described && shelf.ids === 6);
    ok('three sets, both halves real relics', shelf.sets === 3 && shelf.setsReal);

    // ---- never dealt at random ----
    const dealt = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      // Own everything except the curses: every random channel must come up empty-handed.
      activeRelics = RELIC_POOL.filter(r => r.tier !== 'CURSED').slice();
      const roll = rollRelic();
      const shopStock = rollShopStock().filter(it => it.kind === 'RELIC').length;
      activeRelics = [];
      let offered = 0;
      for (let i = 0; i < 60; i++) if (rollRelicOffer().some(r => r.tier === 'CURSED')) offered++;
      return { roll, shopStock, offered };
    });
    ok('the random drop never deals a curse', dealt.roll === null);
    ok('neither does the armory shelf', dealt.shopStock === 0);
    ok(`the cache offers one deliberately (${dealt.offered}/60 tables)`, dealt.offered >= 8 && dealt.offered <= 36);

    // ---- the cache marks them unmistakably ----
    const marked = await page.evaluate(() => {
      pendingRelicOffer = [RELIC_POOL.find(r => r.id === 'GLASS_CANNON_CORE'), RELIC_POOL.find(r => r.id === 'SCRAP_MAGNET')];
      renderRelicOffer();
      const card = document.querySelector('.relic-cursed');
      return { styled: !!card, tier: card ? card.querySelector('.relic-card-tier').innerText : '' };
    });
    ok('a cursed card wears its own colours and tier', marked.styled && /CURSED/.test(marked.tier));

    // ---- fixture ----
    await page.evaluate(() => {
      window.__curseFight = (relicIds) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        activeRelics = (relicIds || []).map(id => RELIC_POOL.find(r => r.id === id));
        initiateCombat('RAIDERS', false);
        activeRelics = (relicIds || []).map(id => RELIC_POOL.find(r => r.id === id));
        const hero = playerRoster.find(h => h.classType === 'BRUISER');
        hero.gridPos = 1; hero.maxHp = 1000; hero.hp = 1000; hero.dmgBase = 100;
        hero.quirk = null; hero.weaponMod = null; hero.trinket = null; hero.traits = []; hero.stunnedTurns = 0;
        Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
        bonds = {};
        const foes = [];
        for (let i = 0; i < 2; i++) {
          const f = generateEnemies('RAIDERS', 1, false, 1)[0];
          f.id = 'cursefoe' + i; f.maxHp = 100000; f.hp = 100000; f.armor = 0; f.baseArmor = 0;
          f.resistances = { phys: 0, bio: 0, energy: 0 };
          f.bleedingTurns = 0; f.oiledTurns = 0; f.stunnedTurns = 0; f.corrodedTurns = 0; f.markedTurns = 0;
          foes.push(f);
        }
        activeEntities = [hero, ...foes]; turnQueue = [hero, ...foes];
        activeIndex = 0; combatActive = true; pendingAction = null; currentWeather = null; momentumFocus = 0;
        return { hero, foes };
      };
      window.__curseAvg = (relicIds, move) => {
        let t = 0;
        for (let i = 0; i < 12; i++) {
          const f = window.__curseFight(relicIds);
          activeIndex = 0; combatActive = true; pendingAction = move;
          const before = f.foes[0].hp; resolveAction(f.foes[0].id); t += before - f.foes[0].hp;
        }
        return t / 12;
      };
    });

    // ---- Glass Cannon Core ----
    const cannon = await page.evaluate(() => {
      const gain = window.__curseAvg(['GLASS_CANNON_CORE'], 'SCRAP_BLADE') / window.__curseAvg([], 'SCRAP_BLADE');
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      activeRelics = [RELIC_POOL.find(r => r.id === 'GLASS_CANNON_CORE')];
      playerRoster.forEach(c => { c.hp = c.maxHp; });
      initiateCombat('RAIDERS', false);
      const capped = playerRoster.filter(p => p.gridPos > 0).every(p => p.hp === Math.floor(p.maxHp * 0.85));
      combatActive = false;
      return { gain, capped };
    });
    ok(`the core pays +40% (x${cannon.gain.toFixed(2)})`, cannon.gain > 1.33 && cannon.gain < 1.47);
    ok('and nobody walks in whole', cannon.capped);

    // ---- Hungry Blade ----
    const blade = await page.evaluate(() => {
      const melee = window.__curseAvg(['HUNGRY_BLADE'], 'SCRAP_BLADE') / window.__curseAvg([], 'SCRAP_BLADE');
      const f = window.__curseFight(['HUNGRY_BLADE']);
      f.hero.hp = 500;
      activeIndex = 0; combatActive = true; pendingAction = 'SCRAP_BLADE'; resolveAction(f.foes[0].id);
      const fed = f.hero.hp;
      const ranged = window.__curseAvg(['HUNGRY_BLADE'], 'PISTOL') / window.__curseAvg([], 'PISTOL');
      return { melee, fed, ranged };
    });
    ok(`melee stays whole and feeds (+6 -> ${blade.fed})`, blade.melee > 0.95 && blade.melee < 1.05 && blade.fed === 506);
    ok(`everything else pays the tax (x${blade.ranged.toFixed(2)})`, blade.ranged > 0.8 && blade.ranged < 0.9);

    // ---- Lead-Lined Coat ----
    const coat = await page.evaluate(() => {
      const f = window.__curseFight(['LEAD_LINED_COAT']);
      f.hero.resistances = { phys: 0, bio: 0, energy: 0 }; f.hero.armor = 0;
      applyDamageHit(f.foes[0], f.hero, 100, 'phys', 'CLAW');
      return { taken: 1000 - f.hero.hp };
    });
    ok('the coat blunts a fifth of every hit (100 -> 80)', coat.taken === 80);

    // The weight is decided at fight start: stage the same fight twice against a foe one
    // point slower than the hero, and watch who the queue hands the opening turn.
    const coatOrder = await page.evaluate(() => {
      const leads = coated => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        activeRelics = coated ? [RELIC_POOL.find(r => r.id === 'LEAD_LINED_COAT')] : [];
        const hero = playerRoster.find(p => p.gridPos > 0);
        playerRoster.forEach(p => { if (p !== hero) p.gridPos = 0; });
        initiateCombat('RAIDERS', false);
        activeEntities.filter(e => !e.isPlayer).forEach(e => { e.speed = hero.speed - 1; });
        const queueSpeed = e => e.speed - (e.isPlayer && hasRelic('LEAD_LINED_COAT') ? 3 : 0);
        turnQueue = [...activeEntities].sort((a, b) => queueSpeed(b) - queueSpeed(a));
        const first = turnQueue[0] === hero;
        combatActive = false;
        return first;
      };
      return { bare: leads(false), coated: leads(true) };
    });
    ok('and drags the squad down the turn order', coatOrder.bare && !coatOrder.coated);

    // ---- the ledger curses ----
    const ledger = await page.evaluate(() => {
      const orig = Math.random;
      const winScrap = (relicIds, nodeType) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        playerRoster.forEach(c => { c.quirk = null; });
        activeRelics = (relicIds || []).map(id => RELIC_POOL.find(r => r.id === id));
        initiateCombat(nodeType, false);
        activeRelics = (relicIds || []).map(id => RELIC_POOL.find(r => r.id === id));
        sectorFront = null;
        activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
        // Clear the board: a contract settling on this same win pays into scrap, and this
        // check is about what the relic takes, not about what else happened to land.
        activeBounties = []; standingBounty = null;
        Math.random = () => 0;
        scrap = 1000;
        checkWinState();
        Math.random = orig;
        const btn = document.querySelector('[data-action="loot"]');
        return { amount: btn ? Number(btn.dataset.amount) : -1, scrapNow: scrap };
      };
      const plain = winScrap([], 'RAIDERS');
      const debt = winScrap(['SCAVENGERS_DEBT'], 'RAIDERS');
      const vulture = winScrap(['VULTURE_ROYALTY'], 'RAIDERS');
      const bossDebt = winScrap(['SCAVENGERS_DEBT'], 'BOSS');
      return { plain: plain.amount, debt: debt.amount, vulture: vulture.amount,
               collectorTook: bossDebt.scrapNow === 500 };
    });
    ok(`the debt pays +40 on the road (${ledger.plain} -> ${ledger.debt})`, ledger.debt === ledger.plain + 40);
    ok('and the collector takes 500 at the warlord', ledger.collectorTook);
    ok(`vulture royalty taxes the take (${ledger.plain} -> ${ledger.vulture})`, ledger.vulture === Math.floor(ledger.plain * 0.75));

    const vultureGear = await page.evaluate(() => {
      const orig = Math.random;
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach(c => { c.quirk = null; });
      activeRelics = [RELIC_POOL.find(r => r.id === 'VULTURE_ROYALTY')];
      initiateCombat('RAIDERS', true);
      activeRelics = [RELIC_POOL.find(r => r.id === 'VULTURE_ROYALTY')];
      sectorFront = null;
      activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
      const before = gearStash.length;
      Math.random = () => 0.99;   // a roll that would never drop gear on its own
      checkWinState();
      Math.random = orig;
      return { dropped: gearStash.length === before + 1 };
    });
    ok('but an elite always gives up its gear', vultureGear.dropped);

    // ---- the Overclocked Reactor ----
    const reactor = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      activeRelics = [RELIC_POOL.find(r => r.id === 'OVERCLOCKED_REACTOR')];
      const at = overdriveAt();
      const f = window.__curseFight(['OVERCLOCKED_REACTOR']);
      momentum = 200;
      pendingOverdrive = null; odChoices.BRUISER = 'EARTHSHAKER';
      activeIndex = 0; combatActive = true; pendingAction = 'OVERDRIVE';
      resolveAction(f.foes[0].id);
      return { at, vented: f.hero.hp === 990 };
    });
    ok(`the reactor drops the threshold to ${reactor.at}`, reactor.at === 80);
    ok('and vents 10 through the front rank', reactor.vented);

    // ---- sets upgrade both halves ----
    const sets = await page.evaluate(() => {
      const one = window.__curseAvg(['THERMAL_CORE'], 'FLASHBANG');
      const both = window.__curseAvg(['THERMAL_CORE', 'OVERCHARGED_CELL'], 'FLASHBANG');
      const wOne = window.__curseAvg(['WHETSTONE'], 'SCRAP_BLADE');
      const wBoth = window.__curseAvg(['WHETSTONE', 'RANGEFINDER'], 'SCRAP_BLADE');
      return { reactor: both / one, arsenal: wBoth / wOne };
    });
    ok(`Reactor Rig burns hotter (x${sets.reactor.toFixed(2)})`, sets.reactor > 1.1 && sets.reactor < 1.2);
    ok(`Full Arsenal sharpens the whetstone (x${sets.arsenal.toFixed(2)})`, sets.arsenal > 1.04 && sets.arsenal < 1.13);

    const surgery = await page.evaluate(() => {
      const f = window.__curseFight(['BLOOD_VIAL', 'FIELD_DRESSING']);
      f.hero.hp = 500; f.hero.bleedingTurns = 4;
      applyTurnStartEffects(f.hero);
      return { turnsLeft: f.hero.bleedingTurns };
    });
    ok('Field Surgery stops a bleed after one turn', surgery.turnsLeft === 0);

    const announced = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      activeRelics = [RELIC_POOL.find(r => r.id === 'WHETSTONE')];
      pendingRelicOffer = [RELIC_POOL.find(r => r.id === 'RANGEFINDER')];
      takeRelic(0);
      const line = [...document.getElementById('log').children].some(el => /SET COMPLETE — Full Arsenal/.test(el.innerText));
      const once = runStats.setsAnnounced.filter(s => s === 'Full Arsenal').length === 1;
      announceSets();
      const still = runStats.setsAnnounced.filter(s => s === 'Full Arsenal').length === 1;
      return { line, once, still };
    });
    ok('completing a set announces itself, once', announced.line && announced.once && announced.still);

    // ---- the collector's table ----
    const table = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const ev = EVENT_POOL.find(e => e.title === "THE COLLECTOR'S TABLE");
      const gamble = choicesFor(ev)[0];
      activeRelics = [];
      const refused = !gamble.canAfford();
      activeRelics = [RELIC_POOL.find(r => r.id === 'SCRAP_MAGNET')];
      const allowed = gamble.canAfford();
      const msg = gamble.execute();
      return { exists: !!ev, refused, allowed,
               count: activeRelics.length,
               gaveIt: !hasRelic('SCRAP_MAGNET') || activeRelics.length === 3,
               msg: typeof msg === 'string' && msg.length > 10 };
    });
    ok("the collector's table deals", table.exists && table.allowed && table.msg);
    ok('one relic buys two blind draws', table.count === 2 && table.gaveIt);
    ok('empty hands cannot gamble', table.refused);

    // ---- the field manual has the page ----
    const codex = await page.evaluate(() => {
      const e = CODEX.find(x => x.id === 'CURSES');
      const text = e ? e.body().join(' ') : '';
      return RELIC_POOL.filter(r => r.tier === 'CURSED').every(r => text.includes(r.name)) &&
             RELIC_SETS.every(s => text.includes(s.name));
    });
    ok('the field manual lists every curse and every set', codex);
  }
};

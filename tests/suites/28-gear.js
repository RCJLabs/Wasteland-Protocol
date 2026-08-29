// Nothing a player bought, found or earned ever changed what an ability does - every upgrade,
// perk and augment was a flat number, so builds did not exist. Gear is the counter-example:
// two slots per operator, and every weapon mod changes behaviour, never just arithmetic.
module.exports = {
  name: 'Gear',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the pool ----
    const pool = await page.evaluate(() => ({
      total: GEAR_POOL.length,
      mods: GEAR_POOL.filter(g => g.slot === 'mod').length,
      trinkets: GEAR_POOL.filter(g => g.slot === 'trinket').length,
      ids: new Set(GEAR_POOL.map(g => g.id)).size,
      described: GEAR_POOL.every(g => g.name && g.desc),
      modsHaveClass: GEAR_POOL.filter(g => g.slot === 'mod').every(g => Object.keys(ABILITIES).includes(g.cls)),
      twoPerClass: Object.keys(ABILITIES).every(c => GEAR_POOL.filter(g => g.slot === 'mod' && g.cls === c).length === 2)
    }));
    ok(`the pool holds ${pool.total} pieces (${pool.mods} mods, ${pool.trinkets} trinkets)`,
      pool.mods === 14 && pool.trinkets === 8);
    ok('every id unique, every piece described', pool.ids === pool.total && pool.described);
    ok('every mod belongs to a real class, two per class', pool.modsHaveClass && pool.twoPerClass);

    // Every id is referenced by the engine, not just declared - inert gear is worse than none.
    // Counted as a word, not a quoted string: the cooldown mods are wired through an object
    // whose keys are unquoted, and a quote-only scan reported them inert.
    const wired = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      return GEAR_POOL.filter(g => !g.apply &&
        (src.match(new RegExp('\\b' + g.id + '\\b', 'g')) || []).length < 2).map(g => g.id);
    });
    ok('every behaviour mod is wired into the engine', wired.length === 0);
    if (wired.length) console.log('        inert:', wired.join(', '));

    // ---- fixture: a duel with a chosen mod ----
    await page.evaluate(() => {
      window.__gearFight = (cls, gearId, setup) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null; initiateCombat('RAIDERS', false);
        const hero = playerRoster.find(h => h.classType === cls);
        hero.gridPos = 1; hero.maxHp = 9999; hero.hp = 9999; hero.dmgBase = 100;
        hero.quirk = null; hero.stunnedTurns = 0; hero.weaponMod = null; hero.trinket = null; sectorFront = null;
        Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
        if (gearId) {
          const g = gearById(gearId);
          if (g.slot === 'mod') hero.weaponMod = gearId; else { hero.trinket = gearId; if (g.apply) g.apply(hero); }
        }
        const foes = [];
        for (let i = 0; i < 3; i++) {
          const f = generateEnemies('RAIDERS', 1, false, 1)[0];
          f.id = 'g' + i; f.maxHp = 100000; f.hp = 100000; f.armor = 0; f.baseArmor = 0;
          f.resistances = { phys: 0, bio: 0, energy: 0 };
          f.bleedingTurns = 0; f.oiledTurns = 0; f.stunnedTurns = 0; f.corrodedTurns = 0; f.markedTurns = 0;
          foes.push(f);
        }
        activeEntities = [hero, ...foes]; turnQueue = [hero, ...foes];
        activeIndex = 0; combatActive = true; pendingAction = null; currentWeather = null;
        momentumFocus = 0;
        if (setup) setup(hero, foes);
        return { hero, foes };
      };
      window.__cast = (move, foe) => {
        activeIndex = 0; combatActive = true; pendingAction = move;
        const before = foe.hp; resolveAction(foe.id); return before - foe.hp;
      };
    });

    // ---- the mods change the verb ----
    const mods = await page.evaluate(() => {
      const r = {};
      // JAGGED EDGE opens a bleed
      let f = window.__gearFight('BRUISER', 'JAGGED_EDGE');
      window.__cast('SCRAP_BLADE', f.foes[0]);
      r.jagged = f.foes[0].bleedingTurns;
      f = window.__gearFight('BRUISER', null);
      window.__cast('SCRAP_BLADE', f.foes[0]);
      r.jaggedOff = f.foes[0].bleedingTurns;
      // COUNTERWEIGHT shaves the wrench
      f = window.__gearFight('BRUISER', 'COUNTERWEIGHT');
      window.__cast('HEAVY_WRENCH', f.foes[0]);
      r.wrenchCd = f.hero.cooldowns.heavy_wrench;
      // DRUM CHOKE hits the one behind
      f = window.__gearFight('SHOTGUNNER', 'DRUM_CHOKE');
      window.__cast('BUCKSHOT', f.foes[0]);
      r.chokeSecond = 100000 - f.foes[1].hp;
      f = window.__gearFight('SHOTGUNNER', null);
      window.__cast('BUCKSHOT', f.foes[0]);
      r.chokeOff = 100000 - f.foes[1].hp;
      // INCENDIARY SLUGS oil
      f = window.__gearFight('SHOTGUNNER', 'INCENDIARY_SLUGS');
      window.__cast('SLUG_SHOT', f.foes[0]);
      r.slugOil = f.foes[0].oiledTurns;
      // NAPALM MIX oils the molotov's main target
      f = window.__gearFight('PYROMANIAC', 'NAPALM_MIX');
      window.__cast('MOLOTOV', f.foes[0]);
      r.napalm = f.foes[0].oiledTurns;
      // PRESSURE TANK: 4 turns and a splash
      f = window.__gearFight('PYROMANIAC', 'PRESSURE_TANK');
      window.__cast('FLARE_GUN', f.foes[0]);
      r.tank = { main: f.foes[0].oiledTurns, splash: f.foes[1].oiledTurns };
      // SPOTTING SCOPE: 4 turns, cd 2
      f = window.__gearFight('SNIPER', 'SPOTTING_SCOPE');
      window.__cast('SPOTTERS_MARK', f.foes[0]);
      r.scope = { marked: f.foes[0].markedTurns, cd: f.hero.cooldowns.spotters_mark };
      // WIDE LENS: the stun is a certainty
      f = window.__gearFight('SCAVENGER', 'WIDE_LENS');
      let stuns = 0;
      for (let i = 0; i < 10; i++) { f.foes[0].stunnedTurns = 0; f.foes[0].hp = 100000; window.__cast('FLASHBANG', f.foes[0]); if (f.foes[0].stunnedTurns > 0) stuns++; f.hero.cooldowns.flashbang = 0; }
      r.lens = stuns;
      return r;
    });
    ok(`Jagged Edge opens a bleed (${mods.jagged} turns, none without)`, mods.jagged === 2 && mods.jaggedOff === 0);
    ok('Counterweight shaves the wrench to 2', mods.wrenchCd === 2);
    ok(`Drum Choke hits the enemy behind (${mods.chokeSecond} dmg, 0 without)`, mods.chokeSecond > 0 && mods.chokeOff === 0);
    ok('Incendiary Slugs leave oil', mods.slugOil === 2);
    ok('Napalm Mix oils the molotov target', mods.napalm === 3);
    ok('Pressure Tank oils 4 turns and splashes a second enemy',
      mods.tank.main === 4 && mods.tank.splash === 2);
    ok("Spotting Scope: 4-turn mark, 2-turn cooldown", mods.scope.marked === 4 && mods.scope.cd === 2);
    ok('Wide Lens makes the flashbang stun every time', mods.lens === 10);

    // The Bayonet flips a weapon's whole reach identity.
    const bayonet = await page.evaluate(() => {
      const avg = (gear, pos, weather) => {
        let t = 0;
        for (let i = 0; i < 12; i++) {
          const f = window.__gearFight('SCAVENGER', gear);
          f.hero.gridPos = pos; currentWeather = weather;
          t += window.__cast('PIPE_RIFLE', f.foes[0]);
        }
        currentWeather = null;
        return t / 12;
      };
      return { plainFront: avg(null, 1, null), spearFront: avg('BAYONET', 1, null),
               plainBack: avg(null, 3, null), spearBack: avg('BAYONET', 3, null),
               plainStorm: avg(null, 1, 'SANDSTORM'), spearStorm: avg('BAYONET', 1, 'SANDSTORM') };
    });
    ok(`the Bayonet pays +25% from the front (x${(bayonet.spearFront / bayonet.plainFront).toFixed(2)})`,
      bayonet.spearFront / bayonet.plainFront > 1.15);
    ok('and honestly takes the melee back-rank penalty',
      bayonet.spearBack / bayonet.plainBack < 0.72);
    ok('a sandstorm blinds the rifle but not the spear',
      bayonet.plainStorm / bayonet.plainFront < 0.85 && bayonet.spearStorm / bayonet.spearFront > 0.9);

    // LONG BARREL and BLOOD TRACKER
    const more = await page.evaluate(() => {
      const avg = (cls, gear, move, setup) => {
        let t = 0;
        for (let i = 0; i < 12; i++) {
          const f = window.__gearFight(cls, gear, setup);
          t += window.__cast(move, f.foes[0]);
        }
        return t / 12;
      };
      return { deadeyeNear: avg('SNIPER', null, 'DEADEYE') , deadeyeBarrel: avg('SNIPER', 'LONG_BARREL', 'DEADEYE'),
               snap: avg('HOUND', null, 'SNAP', (h, f) => { f[0].bleedingTurns = 3; }),
               tracker: avg('HOUND', 'BLOOD_TRACKER', 'SNAP', (h, f) => { f[0].bleedingTurns = 3; }) };
    });
    ok(`Long Barrel removes Deadeye's close penalty (x${(more.deadeyeBarrel / more.deadeyeNear).toFixed(2)})`,
      more.deadeyeBarrel / more.deadeyeNear > 1.15);
    ok(`Blood Tracker punishes bleeders (x${(more.tracker / more.snap).toFixed(2)})`,
      more.tracker / more.snap > 1.2);

    // ---- trinkets ----
    const trinkets = await page.evaluate(() => {
      // stat trinkets apply and remove cleanly
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const ch = playerRoster[0];
      ch.weaponMod = null; ch.trinket = null;
      const base = { hp: ch.maxHp, spd: ch.speed, dmg: ch.dmgBase, phys: ch.resistances.phys };
      gearStash = ['PLATED_VEST', 'REFLEX_WRAP', 'RIOT_SHIELD'];
      equipGear(ch.id, 'PLATED_VEST');
      const vest = ch.maxHp;
      unequipGear(ch.id, 'trinket');
      equipGear(ch.id, 'RIOT_SHIELD');
      const shield = ch.resistances.phys;
      unequipGear(ch.id, 'trinket');
      const clean = { hp: ch.maxHp, spd: ch.speed, dmg: ch.dmgBase, phys: ch.resistances.phys };
      const stashBack = gearStash.slice().sort().join();
      // tourniquet caps the bleed
      const f = window.__gearFight('BRUISER', 'TOURNIQUET');
      f.hero.maxHp = 200; f.hero.hp = 200; f.hero.bleedingTurns = 4;
      applyTurnStartEffects(f.hero);
      const capped = f.hero.bleedingTurns;
      // war trophy pays out at award time
      const g = window.__gearFight('BRUISER', 'WAR_TROPHY');
      g.hero.xp = 0; g.hero.level = 1; g.hero.xpToNext = 10000;
      awardXp(g.hero, 100);
      return { vestDelta: vest - base.hp, shieldDelta: shield - base.phys,
               reverts: JSON.stringify(clean) === JSON.stringify(base),
               stashBack, capped, trophyXp: g.hero.xp };
    });
    ok('the Plated Vest adds its 15 HP', trinkets.vestDelta === 15);
    ok('the Riot Shield its 6 resist', trinkets.shieldDelta === 6);
    ok('and removal reverts every stat cleanly', trinkets.reverts);
    ok('unequipped gear goes back to the stash', trinkets.stashBack === 'PLATED_VEST,REFLEX_WRAP,RIOT_SHIELD');
    ok(`the Tourniquet leaves at most one turn of bleed (4 -> ${trinkets.capped})`, trinkets.capped === 1);
    ok('the War Trophy pays +25% XP', trinkets.trophyXp === 125);

    // ---- equip rules ----
    const rules = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const bruiser = playerRoster.find(c => c.classType === 'BRUISER');
      const sniper = playerRoster.find(c => c.classType === 'SNIPER');
      gearStash = ['JAGGED_EDGE', 'LONG_BARREL', 'IRON_KNUCKLES'];
      equipGear(sniper.id, 'JAGGED_EDGE');           // a bruiser mod on a sniper: refused
      const refused = sniper.weaponMod === null && gearStash.includes('JAGGED_EDGE');
      equipGear(bruiser.id, 'JAGGED_EDGE');
      const took = bruiser.weaponMod;
      gearStash.push('COUNTERWEIGHT');
      equipGear(bruiser.id, 'COUNTERWEIGHT');        // swapping returns the old mod
      return { refused, took, swapped: bruiser.weaponMod,
               oldBack: gearStash.includes('JAGGED_EDGE') };
    });
    ok('a mod refuses the wrong class', rules.refused);
    ok('and equips its own', rules.took === 'JAGGED_EDGE');
    ok('swapping returns the old piece to the stash', rules.swapped === 'COUNTERWEIGHT' && rules.oldBack);

    // ---- drops ----
    const drops = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach(c => { if (c.gridPos > 0) { c.maxHp = 9999; c.hp = 9999; } });
      let eliteDrops = 0;
      for (let i = 0; i < 60; i++) {
        gearStash = []; pendingRelicOffer = null;
        currentNodeType = 'RAIDERS'; isCurrentNodeElite = true;
        initiateCombat('RAIDERS', true);
        activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
        checkWinState();
        if (gearStash.length) eliteDrops++;
        combatActive = false;
      }
      gearStash = []; pendingRelicOffer = null;
      currentSector = 1; currentTier = TOTAL_TIERS;
      initiateCombat('BOSS', false);
      activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
      checkWinState();
      const bossDrop = gearStash.length;
      combatActive = false; pendingRelicOffer = null;
      return { eliteDrops, bossDrop };
    });
    ok(`elites drop gear at a real rate (${drops.eliteDrops}/60)`, drops.eliteDrops >= 12 && drops.eliteDrops <= 38);
    ok('a commander always yields a piece', drops.bossDrop === 1);

    // ---- the outpost UI ----
    await page.evaluate(() => { combatActive = false; });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      gearStash = ['JAGGED_EDGE', 'PLATED_VEST', 'LONG_BARREL'];
      activeGearSelector = null; renderOutpost();
    });
    const ui = await page.evaluate(() => ({
      slots: document.querySelectorAll('.gear-slot').length,
      empty: [...document.querySelectorAll('.gear-slot')].filter(b => /NO MOD|NO TRINKET/.test(b.innerText)).length
    }));
    ok('every operator card carries two gear slots', ui.slots === 14);
    ok('all empty on a fresh run', ui.empty === 14);

    const bruiserId = await page.evaluate(() => playerRoster.find(c => c.classType === 'BRUISER').id);
    await page.click(`[data-action="gear-menu"][data-id="${bruiserId}"][data-slot="mod"]`);
    await page.waitForTimeout(200);
    const picker = await page.evaluate(() => ({
      options: [...document.querySelectorAll('.gear-pick')].map(b => b.dataset.gear)
    }));
    ok('the picker offers only what fits this class and slot', picker.options.join() === 'JAGGED_EDGE');

    await page.click('.gear-pick');
    await page.waitForTimeout(200);
    const equipped = await page.evaluate(() => ({
      worn: playerRoster.find(c => c.classType === 'BRUISER').weaponMod,
      slotText: [...document.querySelectorAll('.gear-slot')].find(b => /JAGGED EDGE/i.test(b.innerText)) !== undefined,
      stash: gearStash.slice().sort().join()
    }));
    ok('equipping from the picker works end to end', equipped.worn === 'JAGGED_EDGE' && equipped.slotText);
    ok('and the stash gives it up', equipped.stash === 'LONG_BARREL,PLATED_VEST');

    // ---- persistence ----
    const saved = await page.evaluate(() => { saveGameState(); return true; });
    await page.reload();
    await page.waitForTimeout(700);
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(500);
    const back = await page.evaluate(() => ({
      worn: playerRoster.find(c => c.classType === 'BRUISER').weaponMod,
      stash: gearStash.slice().sort().join(),
      works: (() => { const f = window.__gearFight ? null : null; return true; })()
    }));
    ok('equipped gear survives a reload', saved && back.worn === 'JAGGED_EDGE');
    ok('so does the stash', back.stash === 'LONG_BARREL,PLATED_VEST');

    // A save from before gear existed, and a stash entry whose id has since died, both load clean.
    const legacy = await page.evaluate(() => {
      const roster = JSON.parse(JSON.stringify(ROSTER_TEMPLATE));
      roster.forEach(c => { delete c.weaponMod; delete c.trinket; });
      Store.set(BASE_SAVE_KEY + 2, JSON.stringify({ scrap: 50, tier: 2, currentSector: 1, difficultyMult: 1,
        roster, inventory: [], materials: { parts: 0, chems: 0, tech: 0 }, activeBounties: [], momentum: 0,
        activeRelics: [], gearStash: ['JAGGED_EDGE', 'A_MOD_THAT_NO_LONGER_EXISTS'], runStats: null, combat: null }));
      currentSlot = 2; loadGameState();
      return { slots: playerRoster.every(c => c.weaponMod === null && c.trinket === null),
               stash: gearStash.join() };
    });
    ok('a pre-gear save loads with empty slots', legacy.slots);
    ok('and dead ids are dropped from the stash', legacy.stash === 'JAGGED_EDGE');

    // ---- the manual has the page ----
    const codex = await page.evaluate(() => {
      const text = CODEX.find(e => e.id === 'GEAR').body().join(' ');
      return GEAR_POOL.every(g => text.includes(g.name));
    });
    ok('the field manual lists every piece', codex);
  }
};

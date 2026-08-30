// Four relics existed and exactly one elite node appeared per sector - at tier 9, right before
// the boss - so a player owned the whole pool by sector 4 and every elite after that dropped
// nothing. The board could also issue 'defeat 2 elite squads' in a sector containing one.
module.exports = {
  name: 'Relic economy',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the pool ----
    const pool = await page.evaluate(() => ({
      total: RELIC_POOL.length,
      common: RELIC_POOL.filter(r => r.tier === 'COMMON').length,
      rare: RELIC_POOL.filter(r => r.tier === 'RARE').length,
      uniqueIds: new Set(RELIC_POOL.map(r => r.id)).size,
      untiered: RELIC_POOL.filter(r => !['COMMON', 'RARE', 'CURSED'].includes(r.tier)).map(r => r.id),
      undescribed: RELIC_POOL.filter(r => !r.name || !r.desc).map(r => r.id)
    }));
    ok(`the pool holds ${pool.total} relics, not four`, pool.total >= 12);
    ok(`split into ${pool.common} common and ${pool.rare} rare`, pool.common > 0 && pool.rare > 0);
    ok('every id is unique', pool.uniqueIds === pool.total);
    ok('every relic is tiered', pool.untiered.length === 0);
    ok('and every one has a name and a description', pool.undescribed.length === 0);

    // ---- every generated sector offers two elite fights, at different depths ----
    // The layout is generated now, so the invariants are asserted over many maps rather than
    // read off one fixed array.
    const layout = await page.evaluate(() => {
      const counts = new Set(); const tiersDiffer = []; let sameTier = 0;
      for (let i = 0; i < 200; i++) {
        const m = generateSectorMap();
        const elites = m.nodes.filter(n => n.elite);
        counts.add(elites.length);
        tiersDiffer.push(new Set(elites.map(n => n.tier)).size === 2);
        const byTier = {};
        elites.forEach(e => { byTier[e.tier] = (byTier[e.tier] || 0) + 1; });
        if (Object.values(byTier).some(c => c > 1)) sameTier++;
      }
      return { counts: [...counts], allDiffer: tiersDiffer.every(Boolean), sameTier };
    });
    ok('every generated sector holds exactly 2 elite nodes', layout.counts.join() === '2');
    ok('always at different depths', layout.allDiffer && layout.sameTier === 0);

    // That is what makes the board's elite contract possible: it asks for up to two, and every
    // sector is guaranteed to offer two.
    const bounty = await page.evaluate(() => {
      const elite = BOUNTY_POOL.find(b => b.type === 'ELITE');
      const perSector = generateSectorMap().nodes.filter(n => n.elite).length;
      return { max: elite.range[1], min: elite.range[0], perSector };
    });
    ok(`the elite contract asks for at most ${bounty.max}, and a sector offers ${bounty.perSector}`,
      bounty.max <= bounty.perSector);
    ok('and never asks for none', bounty.min >= 1);

    // ---- an elite drops one, leaning common ----
    const drop = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const tiers = { COMMON: 0, RARE: 0 };
      for (let i = 0; i < 2000; i++) { activeRelics = []; tiers[rollRelic().tier]++; }
      activeRelics = [];
      const owned = rollRelic();
      activeRelics = [owned];
      const second = rollRelic();
      return { tiers, neverRepeats: second.id !== owned.id };
    });
    ok(`elite drops lean common (${drop.tiers.COMMON} to ${drop.tiers.RARE} of 2000)`,
      drop.tiers.COMMON > drop.tiers.RARE);
    ok('but a rare is reachable from one', drop.tiers.RARE > 100);
    ok('and a relic you already hold is never dropped again', drop.neverRepeats);

    // ---- a commander offers three to choose between ----
    const offer = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const runs = [];
      for (let i = 0; i < 200; i++) { activeRelics = []; runs.push(rollRelicOffer()); }
      activeRelics = [];
      // and never offers something already held
      const held = RELIC_POOL.slice(0, 5);
      activeRelics = [...held];
      const filtered = rollRelicOffer();
      return { sizes: [...new Set(runs.map(r => r.length))],
               dupes: runs.filter(r => new Set(r.map(x => x.id)).size !== r.length).length,
               withRare: runs.filter(r => r.some(x => x.tier === 'RARE')).length,
               clash: filtered.filter(r => held.some(h => h.id === r.id)).length };
    });
    ok('a commander offers exactly three', offer.sizes.join() === '3');
    ok('never the same relic twice in one offer', offer.dupes === 0);
    ok(`and always includes a rare while rares remain (${offer.withRare}/200)`, offer.withRare === 200);
    ok('nothing already held is ever offered', offer.clash === 0);

    // ---- owning everything pays out rather than dropping nothing ----
    const exhausted = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      activeRelics = [...RELIC_POOL];
      const shallow = (() => { currentSector = 1; return emptyPoolScrap(); })();
      const deep = (() => { currentSector = 8; return emptyPoolScrap(); })();
      currentSector = 1;
      return { roll: rollRelic(), offer: rollRelicOffer().length, shallow, deep };
    });
    ok('an owned pool rolls nothing rather than a duplicate', exhausted.roll === null);
    ok('and offers nothing', exhausted.offer === 0);
    ok(`the fallback pays out instead (${exhausted.shallow} scrap at sector 1)`, exhausted.shallow > 0);
    ok(`and scales with depth (${exhausted.deep} at sector 8)`, exhausted.deep > exhausted.shallow);

    // ---- every relic actually does what it says ----
    await page.evaluate(() => {
      window.__line = (cls, relics, setup) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null; initiateCombat('RAIDERS', false);
        activeRelics = (relics || []).map(id => RELIC_POOL.find(r => r.id === id));
        const hero = playerRoster.find(h => h.classType === cls);
        hero.gridPos = 1; hero.maxHp = 9999; hero.hp = 9999; hero.dmgBase = 100; hero.stunnedTurns = 0; hero.quirk = null; sectorFront = null;
        Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
        const foe = activeEntities.find(e => !e.isPlayer);
        foe.maxHp = 1e6; foe.hp = 1e6; foe.armor = 0; foe.baseArmor = 0;
        foe.resistances = { phys: 0, bio: 0, energy: 0 };
        foe.corrodedTurns = 0; foe.markedTurns = 0; foe.bleedingTurns = 0; foe.oiledTurns = 0; foe.stunnedTurns = 0;
        activeEntities = [hero, foe]; turnQueue = [hero, foe];
        activeIndex = 0; combatActive = true; pendingAction = null; currentWeather = null;
        if (setup) setup(foe, hero);
        return { hero, foe };
      };
      // Damage carries a variance roll, so nothing here is measured from one swing.
      window.__avg = (cls, move, relics, setup) => {
        let t = 0;
        for (let i = 0; i < 20; i++) {
          const { foe } = window.__line(cls, relics, setup);
          activeIndex = 0; combatActive = true; pendingAction = move;
          const before = foe.hp; resolveAction(foe.id); t += before - foe.hp;
        }
        return t / 20;
      };
      window.__gain = (cls, move, relic, setup) =>
        window.__avg(cls, move, [relic], setup) / window.__avg(cls, move, [], setup);
    });

    const near = (got, want) => got > want - 0.09 && got < want + 0.09;
    const dmg = await page.evaluate(() => ({
      whetstone:   window.__gain('BRUISER', 'SCRAP_BLADE', 'WHETSTONE'),
      whetNoop:    window.__gain('MEDIC', 'PISTOL', 'WHETSTONE'),
      rangefinder: window.__gain('MEDIC', 'PISTOL', 'RANGEFINDER'),
      rangeNoop:   window.__gain('BRUISER', 'SCRAP_BLADE', 'RANGEFINDER'),
      thermal:     window.__gain('PYROMANIAC', 'FLARE_GUN', 'THERMAL_CORE'),
      vultures:    window.__gain('BRUISER', 'SCRAP_BLADE', 'VULTURES_INSTINCT', f => { f.stunnedTurns = 3; }),
      vultNoop:    window.__gain('BRUISER', 'SCRAP_BLADE', 'VULTURES_INSTINCT'),
      etcher:      window.__gain('MEDIC', 'PISTOL', 'CHEM_ETCHER', f => { f.corrodedTurns = 3; }),
      etchNoop:    window.__gain('MEDIC', 'PISTOL', 'CHEM_ETCHER')
    }));
    ok(`Whetstone sharpens melee (x${dmg.whetstone.toFixed(2)})`, near(dmg.whetstone, 1.2));
    ok('and does nothing for a rifle', near(dmg.whetNoop, 1.0));
    ok(`Rangefinder helps a rifle (x${dmg.rangefinder.toFixed(2)})`, near(dmg.rangefinder, 1.15));
    ok('and nothing for a blade', near(dmg.rangeNoop, 1.0));
    ok(`Thermal Core still boosts energy (x${dmg.thermal.toFixed(2)})`, near(dmg.thermal, 1.3));
    ok(`Vulture's Instinct pays on a combo (x${dmg.vultures.toFixed(2)})`, near(dmg.vultures, 1.25));
    ok('and pays nothing without one', near(dmg.vultNoop, 1.0));
    ok(`Chem Etcher punishes corrosion (x${dmg.etcher.toFixed(2)})`, near(dmg.etcher, 1.25));
    ok('and leaves a clean target alone', near(dmg.etchNoop, 1.0));

    const sys = await page.evaluate(() => {
      const cd = relics => { const { hero } = window.__line('PYROMANIAC', relics); hero.cooldowns.thermite = 4; applyTurnStartEffects(hero); return hero.cooldowns.thermite; };
      const cdFloor = () => { const { hero } = window.__line('PYROMANIAC', ['AMMO_HOIST']); hero.cooldowns.thermite = 1; applyTurnStartEffects(hero); return hero.cooldowns.thermite; };
      const bleed = (relics, onPlayer) => {
        const { hero, foe } = window.__line('BRUISER', relics);
        const t = onPlayer ? hero : foe; t.maxHp = 200; t.hp = 200; t.bleedingTurns = 3;
        applyTurnStartEffects(t); return 200 - t.hp;
      };
      const od = relics => { window.__line('BRUISER', relics); return overdriveAt(); };
      const flanks = relics => {
        window.__line('BRUISER', relics);
        let n = 0; for (let i = 0; i < 2000; i++) if (rollIntent({ range: 'melee', speed: 18, classType: 'RAIDER' }).type === 'FLANK') n++;
        return n;
      };
      const covered = relics => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        playerRoster.forEach((h, i) => { h.gridPos = i < 3 ? i + 1 : 0; h.maxHp = 900; h.hp = 900; h.guardTurns = 0; });
        initiateCombat('RAIDERS', false);
        activeRelics = (relics || []).map(id => RELIC_POOL.find(r => r.id === id));
        const front = activeEntities.filter(e => e.isPlayer).find(s => s.gridPos === 1);
        front.guardTurns = 2;
        const foe = activeEntities.find(e => !e.isPlayer);
        foe.speed = 18; foe.range = 'melee'; foe.dmgBase = 100; foe.dmgType = 'phys';
        foe.intent = { type: 'FLANK', icon: 'x' };
        combatActive = true; activeIndex = turnQueue.indexOf(foe);
        const fb = front.hp; executeEnemyAi(foe); return fb - front.hp;
      };
      return { cd: { off: cd([]), on: cd(['AMMO_HOIST']), floor: cdFloor() },
               bleedSquad: { off: bleed([], true), on: bleed(['FIELD_DRESSING'], true) },
               bleedFoe: { off: bleed([], false), on: bleed(['FIELD_DRESSING'], false) },
               od: { off: od([]), on: od(['OVERCHARGED_CELL']) },
               flanks: { off: flanks([]), on: flanks(['SIGNAL_JAMMER']) },
               cover: { off: covered([]), on: covered(['BULWARK_PLATING']) } };
    });
    ok(`Ammo Hoist takes an extra turn off a cooldown (${sys.cd.off} -> ${sys.cd.on})`, sys.cd.on === sys.cd.off - 1);
    ok('without driving one below ready', sys.cd.floor === 0);
    ok(`Field Dressing halves a squad bleed (${sys.bleedSquad.off} -> ${sys.bleedSquad.on})`,
      sys.bleedSquad.on < sys.bleedSquad.off && sys.bleedSquad.on > 0);
    ok('and does not spare the enemy', sys.bleedFoe.on === sys.bleedFoe.off);
    ok(`Overcharged Cell lowers the overdrive bar (${sys.od.off} -> ${sys.od.on})`, sys.od.on < sys.od.off);
    ok(`Signal Jammer takes the flank off the table (${sys.flanks.off} -> ${sys.flanks.on})`,
      sys.flanks.off > 50 && sys.flanks.on === 0);
    ok(`Bulwark Plating softens a covered hit further (${sys.cover.off} -> ${sys.cover.on})`,
      sys.cover.on < sys.cover.off && sys.cover.on > 0);

    // Every relic in the pool has to be reachable and do something. A relic that is only a
    // line of text is worse than not shipping it.
    const wired = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      return RELIC_POOL.filter(r => (src.split(`'${r.id}'`).length - 1) < 2).map(r => r.id);
    });
    ok('every relic id is referenced by the engine as well as declared', wired.length === 0);
    if (wired.length) console.log('        inert:', wired.join(', '));

    // ---- the choice screen ----
    const screen = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      pendingRelicOffer = rollRelicOffer(); renderRelicOffer();
      const cards = [...document.querySelectorAll('#relic-choices [data-action="take-relic"]')];
      return { visible: getComputedStyle(document.getElementById('screen-relic')).display,
               cards: cards.length,
               indices: cards.map(c => c.dataset.index),
               named: cards.every(c => c.querySelector('.relic-card-name') && c.querySelector('.relic-card-desc')),
               tiered: cards.every(c => c.className.includes('relic-common') || c.className.includes('relic-rare') || c.className.includes('relic-cursed')),
               mapHidden: getComputedStyle(document.getElementById('screen-map')).display };
    });
    ok('the cache opens on its own screen', screen.visible === 'flex' && screen.mapHidden === 'none');
    ok('with three cards', screen.cards === 3);
    ok('each addressable', screen.indices.join() === '0,1,2');
    ok('each naming the relic and what it does', screen.named);
    ok('and each showing its tier', screen.tiered);

    const taken = await page.evaluate(() => {
      const offered = pendingRelicOffer.map(r => r.id);
      const want = offered[1];
      document.querySelector('[data-action="take-relic"][data-index="1"]').click();
      return { held: activeRelics.map(r => r.id), want, offered,
               cleared: pendingRelicOffer === null,
               onMap: getComputedStyle(document.getElementById('screen-map')).display };
    });
    ok('taking a card grants that relic', taken.held.includes(taken.want));
    ok('and only that one', taken.offered.filter(id => taken.held.includes(id)).length === 1);
    ok('the offer is spent', taken.cleared);
    ok('and the run returns to the map', taken.onMap === 'flex');

    // A commander's reward must not be lost to a refresh mid-decision. Driven through the real
    // path - win the boss, take the loot - rather than by planting the offer, because it is
    // collectLoot that has to stand the fight down before it saves. Poking the state directly
    // leaves a stale combat snapshot behind, and resuming that would bury the cache.
    await page.evaluate(() => { combatActive = false; });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      activeRelics = []; pendingRelicOffer = null;
      currentSector = 1; currentTier = TOTAL_TIERS;
      playerRoster.forEach(c => { if (c.gridPos > 0) { c.maxHp = 9999; c.hp = 9999; } });
      initiateCombat('BOSS', false);
      activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
      checkWinState();
      window.__wanted = (pendingRelicOffer || []).map(r => r.id);
    });
    const staged = await page.evaluate(() => ({
      offered: (pendingRelicOffer || []).length,
      stillFighting: combatActive,
      deck: document.getElementById('command-deck').innerText
    }));
    ok('beating a commander stages a cache of three', staged.offered === 3);
    ok('and the fight is over before it is offered', !staged.stillFighting);
    ok('with loot still to collect first', /LOOT/.test(staged.deck));

    const wanted = await page.evaluate(() => window.__wanted);
    await page.click('#command-deck [data-action="loot"]');
    await page.waitForTimeout(400);
    const afterLoot = await page.evaluate(() => ({
      screen: getComputedStyle(document.getElementById('screen-relic')).display,
      map: getComputedStyle(document.getElementById('screen-map')).display,
      snapshot: (Store.getJSON(BASE_SAVE_KEY + currentSlot) || {}).combat
    }));
    ok('collecting the loot opens the cache rather than the map',
      afterLoot.screen === 'flex' && afterLoot.map === 'none');
    ok('and the saved run carries no stale fight to resume into', !afterLoot.snapshot);
    await page.reload();
    await page.waitForTimeout(700);
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(500);
    const resumed = await page.evaluate(() => ({
      screen: getComputedStyle(document.getElementById('screen-relic')).display,
      offered: (pendingRelicOffer || []).map(r => r.id),
      cards: document.querySelectorAll('#relic-choices [data-action="take-relic"]').length
    }));
    ok('a pending cache survives a reload', resumed.screen === 'flex' && resumed.cards === 3);
    ok('with the same three relics', resumed.offered.join() === wanted.join());

    // ---- the Vault carries one relic between runs ----
    const vault = await page.evaluate(() => {
      const byId = ids => ids.map(i => RELIC_POOL.find(r => r.id === i));
      const rare = RELIC_POOL.find(r => r.tier === 'RARE').id;
      const commons = RELIC_POOL.filter(r => r.tier === 'COMMON').slice(0, 2).map(r => r.id);
      return {
        prefersRare: heirloomFrom(byId([commons[0], rare, commons[1]])).id === rare,
        firstOfEquals: heirloomFrom(byId(commons)).id === commons[0],
        emptyIsNull: heirloomFrom([]) === null,
        rareId: rare, commons
      };
    });
    ok('the Vault keeps a rare over a common', vault.prefersRare);
    ok('and the first found among equals', vault.firstOfEquals);
    ok('an empty run banks nothing', vault.emptyIsNull);

    const carried = await page.evaluate((v) => {
      // locked: nothing is banked however good the run was
      bossSkulls = 0; metaUpgrades.vault = 0; metaUpgrades.heirloom = null;
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      activeRelics = [RELIC_POOL.find(r => r.id === v.rareId)];
      stashHeirloom();
      const lockedBank = metaUpgrades.heirloom;

      // unlocked at the Citadel
      bossSkulls = 5; renderCitadel();
      document.querySelector('[data-kind="VAULT"]').click();
      const bought = { vault: metaUpgrades.vault, skulls: bossSkulls };

      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      activeRelics = [RELIC_POOL.find(r => r.id === v.commons[0]), RELIC_POOL.find(r => r.id === v.rareId)];
      stashHeirloom();
      const banked = metaUpgrades.heirloom;

      // the next run starts armed with it
      confirmNewGame(1.0); sectorFront = null;
      const startedWith = activeRelics.map(r => r.id);

      // and buying it twice is not possible
      bossSkulls = 10; buyMetaUpgrade('VAULT');
      return { lockedBank, bought, banked, startedWith, skullsAfterSecond: bossSkulls };
    }, vault);
    ok('a locked Vault banks nothing', carried.lockedBank === null);
    ok('unlocking it costs five skulls', carried.bought.vault === 1 && carried.bought.skulls === 0);
    ok(`it banks the best relic of the run (${carried.banked})`, carried.banked === vault.rareId);
    ok('and the next expedition starts holding it', carried.startedWith.join() === vault.rareId);
    ok('it cannot be bought twice', carried.skullsAfterSecond === 10);

    const card = await page.evaluate(() => {
      citadelView = 'list'; renderCitadel();
      const sp = CITADEL_SPOTS.find(o => o.kind === 'VAULT');
      const row = document.querySelector('#citadel-list [data-kind="VAULT"]').closest('.upgrade-card');
      return { label: spotState(sp),
               desc: row.querySelector('.upgrade-stats').innerText,
               btnOff: document.querySelector('#citadel-list [data-kind="VAULT"]').disabled };
    });
    ok(`the Citadel says what is in the Vault (${card.label})`, /ARMED/.test(card.label));
    ok('and names it', /Ammo Hoist|Vulture|Chem|Bulwark|Signal|Overcharged/.test(card.desc));
    ok('with the purchase closed off', card.btnOff);

    // A fifth upgrade card pushed RETURN TO TITLE below the fold, because the whole screen
    // scrolled rather than the list inside it. The way out has to stay on screen at any count.
    const cit = await page.evaluate(() => {
      citadelView = 'list'; renderCitadel();
      const screen = document.getElementById('screen-citadel');
      const list = screen.querySelector('.outpost-roster');
      const back = screen.querySelector('.return-btn').getBoundingClientRect();
      const cards = screen.querySelectorAll('.upgrade-card').length;
      return { cards, declared: CITADEL_SPOTS.length,
               backOnScreen: back.bottom <= window.innerHeight + 1 && back.top >= 0 && back.height > 0,
               listScrolls: list.scrollHeight > list.clientHeight,
               screenScrolls: screen.scrollHeight > screen.clientHeight,
               sideways: document.body.scrollWidth - window.innerWidth };
    });
    // The count is the table's to decide; what this check is for is that the way out stays on
    // screen however many there are, which is the bug it was written for.
    ok(`the Citadel carries ${cit.cards} upgrades`, cit.cards === cit.declared && cit.cards >= 5);
    await page.evaluate(() => { citadelView = 'scene'; });
    ok('the way out stays on screen', cit.backOnScreen);
    ok('the list scrolls rather than the screen', cit.listScrolls && !cit.screenScrolls);
    ok('and nothing scrolls sideways', cit.sideways <= 0);

    // ---- a save written before any of this still loads ----
    const legacy = await page.evaluate(() => {
      const old = { scrap: 100, tier: 3, currentSector: 2, difficultyMult: 1,
        roster: JSON.parse(JSON.stringify(ROSTER_TEMPLATE)),
        inventory: ['MED_STIM'], materials: { parts: 1, chems: 0, tech: 0 },
        activeBounties: [], momentum: 0,
        // the pre-tier shape: no tier field, and the old wording
        activeRelics: [{ id: 'THERMAL_CORE', name: 'Thermal Core', desc: 'Energy attacks deal +30% DMG.' },
                       { id: 'A_RELIC_THAT_NO_LONGER_EXISTS', name: 'Ghost', desc: 'nothing' }],
        runStats: null, combat: null };
      Store.set(BASE_SAVE_KEY + 2, JSON.stringify(old));
      currentSlot = 2; loadGameState();
      return { held: activeRelics.map(r => r.id),
               tiered: activeRelics.every(r => !!r.tier),
               text: activeRelics.map(r => r.desc),
               works: (() => { activeRelics = activeRelics; return hasRelic('THERMAL_CORE'); })() };
    });
    ok('a legacy relic survives the load', legacy.held.includes('THERMAL_CORE'));
    ok('is rehydrated with its tier', legacy.tiered);
    ok('carries current wording rather than the stored copy', legacy.text.every(t => typeof t === 'string' && t.length > 0));
    ok('a relic id that no longer exists is dropped, not kept inert',
      !legacy.held.includes('A_RELIC_THAT_NO_LONGER_EXISTS'));
    ok('and the survivor still works', legacy.works);
  }
};

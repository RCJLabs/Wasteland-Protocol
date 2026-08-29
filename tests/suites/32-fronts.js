// A sector used to be a number. Fronts make it a condition: rolled on entry, worn on the
// header, and pressed into the generator, the weather, the loot and the boss - so "sector 3
// was a blood moon" is a sentence a player says about a run.
module.exports = {
  name: 'Sector fronts',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the table ----
    const table = await page.evaluate(() => ({
      count: FRONTS.length,
      ids: new Set(FRONTS.map(f => f.id)).size,
      described: FRONTS.every(f => f.name && f.desc && f.icon),
      rolled: Array.from({ length: 40 }, () => rollFront()).every(id => FRONTS.some(f => f.id === id))
    }));
    ok(`there are ${table.count} fronts, each named and described`, table.count === 5 && table.ids === 5 && table.described);
    ok('rollFront only deals from the table', table.rolled);

    // ---- every sector rolls one ----
    // confirmNewGame ends on renderMap, which consumes the pending flag by showing the
    // splash - so what a fresh run proves is the splash itself.
    const rolled = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
      const first = { valid: !!frontById(sectorFront),
                      splashed: document.getElementById('front-banner').classList.contains('front-banner-show'),
                      consumed: !frontBannerPending };
      advanceSector();
      return { first, nextValid: !!frontById(sectorFront) };
    });
    ok('a new run opens under a front, splash shown once', rolled.first.valid && rolled.first.splashed && rolled.first.consumed);
    ok('and every sector after rolls its own', rolled.nextValid);

    // ---- the generator feels it ----
    const gen = await page.evaluate(() => {
      currentSector = 2;
      const share = (front, faction) => {
        sectorFront = front;
        let hit = 0, total = 0;
        for (let i = 0; i < 25; i++) {
          const m = generateSectorMap(Math.random);
          m.nodes.forEach(n => {
            if (['RAIDERS', 'BEASTS', 'MECH'].includes(n.type)) { total++; if (n.type === faction) hit++; }
          });
        }
        return hit / total;
      };
      const events = front => {
        sectorFront = front;
        let n = 0;
        for (let i = 0; i < 25; i++) n += generateSectorMap(Math.random).nodes.filter(x => x.type === 'EVENT').length;
        return n / 25;
      };
      const smog = front => {
        sectorFront = front;
        let hit = 0, total = 0;
        for (let i = 0; i < 25; i++) generateSectorMap(Math.random).nodes.forEach(n => {
          if (['RAIDERS', 'BEASTS', 'MECH'].includes(n.type)) { total++; if (n.weather === 'TOXIC_SMOG') hit++; }
        });
        return hit / total;
      };
      const earlyMech = (() => {
        sectorFront = 'MACHINE_UPRISING';
        let bad = 0;
        for (let i = 0; i < 25; i++) generateSectorMap(Math.random).nodes.forEach(n => {
          if (n.type === 'MECH' && n.tier < 3) bad++;
        });
        return bad;
      })();
      const r = {
        warband: share('RAIDER_WARBAND', 'RAIDERS'), base: share(null, 'RAIDERS'),
        beasts: share('BLOOD_MOON', 'BEASTS'),
        quiet: events('QUIET_ROADS'), calm: events(null),
        irr: smog('IRRADIATED'), clear: smog(null),
        earlyMech,
        valid: (() => { sectorFront = 'QUIET_ROADS'; let v = 0; for (let i = 0; i < 25; i++) if (validateSectorMap(generateSectorMap(Math.random))) v++; return v; })()
      };
      sectorFront = null; currentSector = 1;
      return r;
    });
    ok(`a warband owns the roads (${(gen.warband * 100).toFixed(0)}% raiders vs ${(gen.base * 100).toFixed(0)}%)`,
      gen.warband > 0.6 && gen.base < 0.55 && gen.warband > gen.base + 0.1);
    ok(`a blood moon crawls with beasts (${(gen.beasts * 100).toFixed(0)}%)`, gen.beasts > 0.55);
    ok('the machines stay out of the shallows', gen.earlyMech === 0);
    ok(`quiet roads trade fights for encounters (${gen.quiet.toFixed(1)} events vs ${gen.calm.toFixed(1)})`,
      gen.quiet > gen.calm + 0.8);
    ok(`an irradiated sector hangs smog on most roads (${(gen.irr * 100).toFixed(0)}% vs ${(gen.clear * 100).toFixed(0)}%)`,
      gen.irr > 0.5 && gen.clear < 0.25);
    ok('fronted maps still validate', gen.valid === 25);

    // ---- the fights feel it ----
    const fights = await page.evaluate(() => {
      const seeded = seed => { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; };
      const orig = Math.random;
      const eliteDmg = front => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
        sectorFront = front;
        Math.random = seeded(7);
        initiateCombat('RAIDERS', true);
        const d = activeEntities.filter(e => !e.isPlayer).map(e => e.dmgBase);
        Math.random = orig;
        combatActive = false;
        return d;
      };
      const plain = eliteDmg(null), hard = eliteDmg('RAIDER_WARBAND');
      const escort = front => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
        // tier 1 / sector 1 skips the scenery-and-weather branch entirely, so stage the
        // warlord where a real one lives.
        currentSector = 2; currentTier = 6;
        sectorFront = front; forecastWeather = null;
        Math.random = seeded(7);
        initiateCombat('BOSS', false);
        const r = { foes: activeEntities.filter(e => !e.isPlayer).length,
                    escort: activeEntities.some(e => e.id === 'front_escort'),
                    weather: currentWeather };
        Math.random = orig;
        combatActive = false;
        return r;
      };
      const alone = escort(null), ridden = escort('BLOOD_MOON'), smogged = escort('IRRADIATED');
      return { plain, hard, alone, ridden, smogged };
    });
    ok(`a warband's raider elites hit a quarter harder (${fights.plain[0]} -> ${fights.hard[0]})`,
      fights.hard.length === fights.plain.length &&
      fights.hard.every((d, i) => d === Math.ceil(fights.plain[i] * 1.25)));
    ok('a blood-moon warlord rides with an escort', fights.ridden.escort && fights.ridden.foes === fights.alone.foes + 1);
    ok('an unfronted warlord comes alone', !fights.alone.escort);
    ok(`an irradiated warlord fights under the smog (${fights.smogged.weather})`,
      fights.smogged.weather === 'TOXIC_SMOG' && fights.alone.weather === 'BLOODLUST');

    // ---- the ledger feels it ----
    const ledger = await page.evaluate(() => {
      const orig = Math.random;
      const winAmount = (front, nodeType) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
        playerRoster.forEach(c => { c.quirk = null; });
        sectorFront = front;
        initiateCombat(nodeType, false);
        sectorFront = front;
        activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
        Math.random = () => 0;
        checkWinState();
        Math.random = orig;
        const btn = document.querySelector('[data-action="loot"]');
        return btn ? Number(btn.dataset.amount) : -1;
      };
      const raidPlain = winAmount(null, 'RAIDERS'), raidRich = winAmount('RAIDER_WARBAND', 'RAIDERS');
      const beastRich = winAmount('RAIDER_WARBAND', 'BEASTS');
      const mats = front => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
        playerRoster.forEach(c => { c.quirk = null; });
        sectorFront = front;
        initiateCombat('MECH', false);
        sectorFront = front;
        activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
        const before = materials.tech;
        Math.random = () => 0.9;
        checkWinState();
        Math.random = orig;
        return materials.tech - before;
      };
      const techPlain = mats(null), techPaired = mats('MACHINE_UPRISING');
      const xp = front => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
        sectorFront = front;
        const ch = playerRoster[0];
        ch.trinket = null; ch.xp = 0; ch.xpToNext = 100000;
        awardXp(ch, 100);
        return ch.xp;
      };
      return { raidPlain, raidRich, beastRich, techPlain, techPaired, lean: xp('QUIET_ROADS'), full: xp(null) };
    });
    ok(`warband raiders carry double (${ledger.raidPlain} -> ${ledger.raidRich})`,
      ledger.raidRich === ledger.raidPlain * 2 && ledger.raidPlain > 0);
    ok('but only the raiders', ledger.beastRich === ledger.raidPlain);
    ok(`an uprising drops tech in pairs (${ledger.techPlain} -> ${ledger.techPaired})`,
      ledger.techPaired === ledger.techPlain * 2 && ledger.techPlain > 0);
    ok(`quiet roads run lean on XP (${ledger.full} -> ${ledger.lean})`, ledger.lean === 85 && ledger.full === 100);

    // ---- the blood moon opens wounds ----
    const bleeds = await page.evaluate(() => {
      const orig = Math.random;
      const hit = (front, ability, roll) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
        sectorFront = front;
        initiateCombat('BEASTS', false);
        sectorFront = front;
        const hero = playerRoster.find(p => p.gridPos > 0);
        hero.quirk = null; hero.trinket = null; hero.bleedingTurns = 0; hero.hp = hero.maxHp = 500;
        const foe = activeEntities.find(e => !e.isPlayer);
        Math.random = () => roll;
        applyDamageHit(foe, hero, 10, 'phys', ability);
        Math.random = orig;
        const r = hero.bleedingTurns;
        combatActive = false;
        return r;
      };
      return { rawMoon: hit('BLOOD_MOON', 'CLAW', 0.1), rawClear: hit(null, 'CLAW', 0.1),
               biteMoon: hit('BLOOD_MOON', 'FERAL_BITE', 0.95), biteClear: hit(null, 'FERAL_BITE', 0.95) };
    });
    ok('under the blood moon a raw hit can open a wound', bleeds.rawMoon === 2 && bleeds.rawClear === 0);
    ok('and every bite bleeds', bleeds.biteMoon === 3 && bleeds.biteClear === 0);

    // ---- the header and the splash ----
    const ui = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
      sectorFront = 'BLOOD_MOON'; frontBannerPending = true;
      renderMap();
      const badge = document.getElementById('front-badge');
      const banner = document.getElementById('front-banner');
      const first = { badge: badge.style.display, text: badge.innerText, tip: badge.title,
                      shown: banner.classList.contains('front-banner-show'),
                      name: banner.querySelector('.front-banner-name').innerText,
                      pending: frontBannerPending };
      renderMap();
      const second = { pending: frontBannerPending };
      sectorFront = null; renderMap();
      const bare = { badge: document.getElementById('front-badge').style.display };
      return { first, second, bare };
    });
    ok('the front rides the map header', ui.first.badge === 'flex' && /BLOOD MOON/.test(ui.first.text) && ui.first.tip.length > 10);
    ok('entering the sector gets the splash, once', ui.first.shown && /BLOOD MOON/.test(ui.first.name) && !ui.first.pending);
    ok('no front, no badge', ui.bare.badge === 'none');

    // ---- persistence ----
    const saved = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
      sectorFront = 'IRRADIATED';
      saveGameState();
      sectorFront = null;
      loadGameState();
      const kept = sectorFront;
      const raw = JSON.parse(Store.get(BASE_SAVE_KEY + currentSlot));
      delete raw.sectorFront;
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw));
      loadGameState();
      const legacy = sectorFront;
      renderMap();
      return { kept, legacy, alive: true };
    });
    ok('the front rides the save', saved.kept === 'IRRADIATED');
    ok('a pre-front save finishes its sector without one', saved.legacy === null && saved.alive);

    // ---- the field manual has the page ----
    const codex = await page.evaluate(() => {
      const e = CODEX.find(x => x.id === 'FRONTS');
      const text = e ? e.body().join(' ') : '';
      return FRONTS.every(f => text.includes(f.name));
    });
    ok('the field manual names every front', codex);
  }
};

// Ten units across three factions meant a deep fight drew from a pool of three or four, and
// every one of those units answered the squad rather than each other. The Choir spends its
// turns on its own - singing, washing, raising - so the dangerous unit is usually not the one
// acting. The Carrion is only dangerous as a pile, which makes spreading damage worth more
// than picking a target.
module.exports = {
  name: 'The Choir and the Carrion',
  run: async ({ page, ok, base }) => {
    const notFound = [];
    page.on('response', r => { if (r.status() === 404) notFound.push(r.url().split('/').pop()); });
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the rosters ----
    const roster = await page.evaluate(() => {
      const shape = e => e.name && e.sig && e.minTier && e.classType && e.range &&
                         e.maxHp > 0 && e.dmgBase > 0 && e.img && e.resistances;
      const both = [...ENEMY_POOL.CHOIR, ...ENEMY_POOL.CARRION];
      return {
        choir: ENEMY_POOL.CHOIR.length, carrion: ENEMY_POOL.CARRION.length,
        complete: both.every(shape),
        sigs: both.map(e => e.sig),
        described: both.every(e => ENEMY_SIGS[e.sig] && ENEMY_SIGS[e.sig].desc),
        classes: [...new Set(both.map(e => e.classType))].sort(),
        // The stand-in era is over: all eight portraits are drawn, so nothing here may be
        // pending, nothing may still name a stand-in, and the field must show the real file.
        drawn: both.every(e => !PENDING_ART.includes(e.img) && !e.stand && portraitFor(e) === e.img),
        inAssets: both.every(e => ASSET_LIST.includes(e.img)),
        imgs: both.map(e => e.img)
      };
    });
    // And the files are genuinely there - a wired-in portrait that 404s would fall to the
    // error-handler fallback and this suite would never know.
    const served = await page.evaluate(async imgs => {
      const out = [];
      for (const f of imgs) { const r = await fetch(f, { method: 'HEAD' }); if (!r.ok) out.push(f); }
      return out;
    }, roster.imgs);
    ok(`eight new hostiles across two factions (${roster.choir} + ${roster.carrion})`,
      roster.choir === 4 && roster.carrion === 4);
    ok('each fully described', roster.complete);
    ok(`each carries a signature, and every signature says what it does (${new Set(roster.sigs).size} distinct)`,
      roster.described && new Set(roster.sigs).size >= 6);
    ok(`and they file under their own classes (${roster.classes.join(', ')})`,
      roster.classes.includes('CULTIST') && roster.classes.includes('VERMIN'));
    ok('every portrait is drawn, listed, and shown for real - the stand-in era is over',
      roster.drawn && roster.inAssets);
    ok(`and every portrait file actually serves (${served.length ? 'missing: ' + served.join(', ') : 'all 8'})`,
      served.length === 0);

    // Both factions fight on their own ground now, not on another faction's backdrop.
    const grounds = await page.evaluate(async () => {
      const own = { CHOIR: FACTIONS.CHOIR.bg, CARRION: FACTIONS.CARRION.bg };
      const borrowed = Object.values(FACTIONS).filter(f => f.bg === own.CHOIR || f.bg === own.CARRION).length;
      const ok1 = (await fetch(own.CHOIR, { method: 'HEAD' })).ok;
      const ok2 = (await fetch(own.CARRION, { method: 'HEAD' })).ok;
      return { ...own, borrowed, served: ok1 && ok2,
               listed: ASSET_LIST.includes(own.CHOIR) && ASSET_LIST.includes(own.CARRION) };
    });
    ok(`the Choir owns its ground (${grounds.CHOIR})`, grounds.CHOIR === 'bg_congregation.webp');
    ok(`and the Carrion owns its own (${grounds.CARRION})`, grounds.CARRION === 'bg_carrionfield.webp');
    ok('nobody else borrows either, both serve, and both are preloaded',
      grounds.borrowed === 2 && grounds.served && grounds.listed);

    // ---- the roads only widen from sector 2 ----
    const roads = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const draw = s => {
        currentSector = s;
        const seen = new Set();
        for (let i = 0; i < 600; i++) seen.add(rollNodeFaction(5, Math.random));
        return [...seen].sort();
      };
      const one = draw(1), two = draw(2);
      currentSector = 1;
      return { one, two, gate: factionsAt(1).sort(), open: factionsAt(2).sort() };
    });
    ok(`sector 1 stays the stock a new squad has answers for (${roads.one.join(', ')})`,
      !roads.one.includes('CHOIR') && !roads.one.includes('CARRION') && roads.one.length === 3);
    ok(`and the roads widen from sector 2 (${roads.two.join(', ')})`,
      roads.two.includes('CHOIR') && roads.two.includes('CARRION') && roads.two.length === 5);
    ok('the gate is the faction table, not a hand-written list', roads.gate.length === 3 && roads.open.length === 5);

    // ---- a swarm arrives as one ----
    const sizes = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const avg = type => {
        currentSector = 3; currentTier = 8;
        let n = 0;
        for (let i = 0; i < 60; i++) n += generateEnemies(type, 2, false, 2).length;
        return n / 60;
      };
      return { raiders: avg('RAIDERS'), carrion: avg('CARRION'), choir: avg('CHOIR') };
    });
    ok(`the Carrion turns up in numbers (${sizes.carrion.toFixed(1)} against ${sizes.raiders.toFixed(1)})`,
      sizes.carrion >= sizes.raiders + 1.5);
    ok(`the Choir does not (${sizes.choir.toFixed(1)})`, Math.abs(sizes.choir - sizes.raiders) < 0.6);

    // ---- nothing that compounds with itself turns up twice ----
    const dupes = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 4; currentTier = 10;
      let worst = 0;
      const uniques = [...ENEMY_POOL.CHOIR, ...ENEMY_POOL.CARRION].filter(e => e.unique).map(e => e.name);
      for (let i = 0; i < 200; i++) {
        for (const t of ['CHOIR', 'CARRION']) {
          const squad = generateEnemies(t, 2, false, 2);
          uniques.forEach(u => { worst = Math.max(worst, squad.filter(e => e.name === u).length); });
        }
      }
      return { worst, uniques };
    });
    ok(`a unit that lays more of itself never arrives doubled (${dupes.uniques.join(', ')})`, dupes.worst <= 1);

    // ---- the pile protects itself, and thinning it breaks that ----
    const teem = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const hero = playerRoster.find(p => p.gridPos > 0);
      hero.quirk = null; hero.trinket = null; hero.traits = []; activeRelics = [];
      const rat = n => Object.assign(JSON.parse(JSON.stringify(ENEMY_POOL.CARRION.find(e => e.name === 'Carrion Rat'))),
        { id: `r${n}`, hp: 200, maxHp: 200, armor: 0, baseArmor: 0, isPlayer: false, sigCd: 0,
          resistances: { phys: 0, bio: 0, energy: 0 } });
      const worm = Object.assign(JSON.parse(JSON.stringify(ENEMY_POOL.CARRION.find(e => e.name === 'Gorge Worm'))),
        { id: 'w1', hp: 200, maxHp: 200, armor: 0, baseArmor: 0, isPlayer: false, sigCd: 0,
          resistances: { phys: 0, bio: 0, energy: 0 } });
      const rats = [rat(1), rat(2)];
      activeEntities = [hero, ...rats, worm];
      const thick = mitigate(hero, rats[0], 100, 'phys', null).n;   // three Carrion standing
      const wormTakes = mitigate(hero, worm, 100, 'phys', null).n;  // props the pile, no cover of its own
      worm.hp = 0;
      const thin = mitigate(hero, rats[0], 100, 'phys', null).n;    // two left
      combatActive = false;
      return { thick, thin, wormTakes, floor: TEEMING_FLOOR };
    });
    ok(`a thick swarm shrugs off a single blow (100 -> ${teem.thick})`, teem.thick < 50 && teem.thick > 0);
    ok(`thinning it past ${teem.floor} opens the rest up (100 -> ${teem.thin})`, teem.thin === 100);
    ok(`the big ones hold the cover up without taking it (100 -> ${teem.wormTakes})`, teem.wormTakes === 100);

    // ---- the Choir spends its turns on itself ----
    const choir = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const heroes = playerRoster.filter(p => p.gridPos > 0);
      heroes.forEach(h => { h.quirk = null; h.trinket = null; h.traits = []; h.maxHp = 300; h.hp = 300; h.corrodedTurns = 0; });
      activeRelics = [];
      const mk = (name, id) => Object.assign(JSON.parse(JSON.stringify(ENEMY_POOL.CHOIR.find(e => e.name === name))),
        { id, hp: 100, maxHp: 100, isPlayer: false, sigCd: 0, baseArmor: 0 });
      const acolyte = mk('Acolyte', 'c1'), censer = mk('Censer Bearer', 'c2');
      const relic = mk('Reliquary', 'c3'), hiero = mk('Hierophant', 'c4');
      const brute = Object.assign(mk('Acolyte', 'c5'), { name: 'Zealot', dmgBase: 99, sig: null });
      activeEntities = [...heroes, acolyte, censer, relic, hiero, brute];
      turnQueue = [...activeEntities]; combatActive = true;

      // LITANY finds the hardest hitter rather than the nearest.
      acolyte.intent = { type: 'SIG', icon: '#', sig: 'LITANY' };
      executeEnemyAi(acolyte);
      const sung = activeEntities.find(e => e.blessedTurns > 0);
      const before = enemyDmgMult(brute);

      // RAD WASH strips the front rank's armour, which is what corrosion does.
      censer.intent = { type: 'SIG', icon: '#', sig: 'RAD_WASH' };
      executeEnemyAi(censer);
      const front = [...heroes].sort((a, b) => a.gridPos - b.gridPos);
      const washed = front.filter(h => h.corrodedTurns > 0).length;

      // MARTYR: dying is the Reliquary's contribution.
      [acolyte, censer, hiero].forEach(e => { e.hp = 40; });
      relic.hp = 1;
      applyDamageHit(heroes[0], relic, 999, 'phys', null);
      const healed = [acolyte, censer, hiero].every(e => e.hp > 40);

      // RESURGENCE raises one of its own, once, and never an operator.
      acolyte.hp = 0;
      hiero.intent = { type: 'SIG', icon: '#', sig: 'RESURGENCE' };
      executeEnemyAi(hiero);
      const risen = acolyte.hp > 0 && acolyte.hp <= acolyte.maxHp * 0.5;
      const fallenHero = heroes[heroes.length - 1]; fallenHero.hp = 0;
      hiero.sigCd = 0; hiero.intent = { type: 'SIG', icon: '#', sig: 'RESURGENCE' };
      executeEnemyAi(hiero);
      const heroStaysDown = fallenHero.hp === 0;

      // And the litany runs out on its own clock.
      const marked = activeEntities.find(e => e.blessedTurns > 0);
      let ticks = 0;
      while (marked && marked.blessedTurns > 0 && ticks < 8) { applyTurnStartEffects(marked); ticks++; }
      combatActive = false;
      return { sungName: sung && sung.name, before, washed, healed, risen, heroStaysDown,
               expired: !marked || (marked.blessedTurns === 0 && !marked.blessed), ticks };
    });
    ok(`the Acolyte sings over the worst thing on the field (${choir.sungName})`, choir.sungName === 'Zealot');
    ok(`and that hostile hits harder for it (x${choir.before.toFixed(2)})`, choir.before > 1.3);
    ok(`the Censer Bearer strips the front rank's armour (${choir.washed} operators)`, choir.washed === 2);
    ok('the Reliquary heals the rest of the Choir by dying', choir.healed);
    ok('the Hierophant raises one of its own at half health', choir.risen);
    ok('and never an operator', choir.heroStaysDown);
    ok(`the litany runs out on its own (${choir.ticks} turns)`, choir.expired && choir.ticks <= 3);

    // ---- under the ground, then on top of you ----
    const worm = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const heroes = playerRoster.filter(p => p.gridPos > 0);
      heroes.forEach(h => { h.quirk = null; h.trinket = null; h.traits = []; h.maxHp = 400; h.hp = 400; });
      activeRelics = [];
      const mk = (name, id) => Object.assign(JSON.parse(JSON.stringify(ENEMY_POOL.CARRION.find(e => e.name === name))),
        { id, hp: 120, maxHp: 120, isPlayer: false, sigCd: 0, baseArmor: 0 });
      const w = mk('Gorge Worm', 'w1'), rat = mk('Carrion Rat', 'r1');
      activeEntities = [...heroes, w, rat]; turnQueue = [...activeEntities]; combatActive = true;

      w.intent = { type: 'SIG', icon: '#', sig: 'BURROW' };
      executeEnemyAi(w);
      const under = w.burrowed > 0;
      pendingAction = 'PISTOL'; renderField();
      const aimable = !!document.querySelector(`#${w.id}.targetable-enemy`);
      const ratAimable = !!document.querySelector(`#${rat.id}.targetable-enemy`);
      pendingAction = null;
      // E05: this used to assert that a buried worm threatens nobody, which the next three
      // lines of this same test disprove - one more call to its AI and the front operator is
      // down health. Its turn IS the surfacing hit, so the board has to price it.
      const fc = forecastFor(w) || {};
      const threatens = (fc.hits || []).reduce((a, h) => a + h.dmg, 0);
      const aimedAt = (fc.hits || [])[0] ? fc.hits[0].target.gridPos : null;

      const front = [...heroes].sort((a, b) => a.gridPos - b.gridPos)[0];
      const hpBefore = front.hp;
      executeEnemyAi(w);
      const surfaced = w.burrowed === 0 && front.hp < hpBefore;

      // With nothing else standing it will not leave the squad aiming at empty ground.
      rat.hp = 0; w.sigCd = 0; w.intent = { type: 'SIG', icon: '#', sig: 'BURROW' };
      executeEnemyAi(w);
      const stayedUp = !w.burrowed;
      combatActive = false;
      return { under, aimable, ratAimable, threatens, aimedAt, surfaced, stayedUp,
               frontRank: [...heroes].sort((a, b) => a.gridPos - b.gridPos)[0].gridPos };
    });
    ok('the Gorge Worm goes under', worm.under);
    ok('and nothing can be aimed at it while it is down', !worm.aimable && worm.ratAimable);
    ok(`but the board still prices what it is about to do (${worm.threatens})`, worm.threatens > 0);
    ok('and aims it at whoever is holding the front, which is where it comes up',
      worm.aimedAt === worm.frontRank);
    ok('it comes up under the front rank and hits on arrival', worm.surfaced);
    ok('and it will not go under if that leaves nothing to shoot at', worm.stayedUp);

    // ---- the Brood Mother keeps laying ----
    const brood = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const heroes = playerRoster.filter(p => p.gridPos > 0);
      const mum = Object.assign(JSON.parse(JSON.stringify(ENEMY_POOL.CARRION.find(e => e.name === 'Brood Mother'))),
        { id: 'bm', hp: 300, maxHp: 300, isPlayer: false, sigCd: 0, baseArmor: 0 });
      activeEntities = [...heroes, mum]; turnQueue = [...activeEntities]; combatActive = true;
      const counts = [];
      for (let i = 0; i < 8; i++) {
        mum.sigCd = 0; mum.intent = { type: 'SIG', icon: '#', sig: 'BROOD' };
        executeEnemyAi(mum);
        counts.push(activeEntities.filter(e => !e.isPlayer && e.hp > 0).length);
      }
      const queued = activeEntities.filter(e => e.id.startsWith('brood_')).every(e => turnQueue.includes(e));
      combatActive = false;
      return { first: counts[0], last: counts[counts.length - 1], queued };
    });
    ok(`the Brood Mother lays another (${brood.first} on the field)`, brood.first === 2);
    ok(`and keeps laying, up to a point (${brood.last})`, brood.last > 2 && brood.last <= 6);
    ok('each one takes its own turn', brood.queued);

    // ---- the fronts ----
    const fronts = await page.evaluate(() => {
      const ids = FRONTS.map(f => f.id);
      const at = s => { const t = new Set(); for (let i = 0; i < 400; i++) t.add(rollFront(Math.random, s)); return [...t]; };
      currentSlot = 1; confirmNewGame(1.0);
      // A front that biases toward a faction the sector cannot field would be an empty promise.
      currentSector = 1; sectorFront = 'THE_CHOIR';
      let leaked = 0;
      for (let i = 0; i < 300; i++) if (frontFactionBias(5, Math.random) === 'CHOIR') leaked++;
      currentSector = 3;
      let bias = 0;
      for (let i = 0; i < 600; i++) if (frontFactionBias(5, Math.random) === 'CHOIR') bias++;
      sectorFront = null; currentSector = 1;
      return { ids, s1: at(1), s3: at(3), leaked, bias: bias / 600 };
    });
    ok(`both new fronts exist (${fronts.ids.length} in all)`,
      fronts.ids.includes('THE_CHOIR') && fronts.ids.includes('CARRION_BLOOM') && fronts.ids.length === 7);
    ok(`neither is dealt in sector 1 (${fronts.s1.length} of ${fronts.ids.length})`,
      !fronts.s1.includes('THE_CHOIR') && !fronts.s1.includes('CARRION_BLOOM') && fronts.s1.length === 5);
    ok(`and both are from sector 2 (${fronts.s3.length})`, fronts.s3.length === 7);
    ok('a front never biases toward a faction the sector cannot field', fronts.leaked === 0);
    ok(`where it can, it tilts half the roads (${(fronts.bias * 100).toFixed(0)}%)`,
      fronts.bias > 0.35 && fronts.bias < 0.65);

    // ---- and the manual picks them all up on its own ----
    const filed = await page.evaluate(() => {
      const roster = bestiaryRoster();
      const both = [...ENEMY_POOL.CHOIR, ...ENEMY_POOL.CARRION].map(e => e.name);
      bestiary = Object.fromEntries(both.map(n => [n, { met: 1, killed: 0, felled: 0 }]));
      return { listed: both.every(n => roster.some(r => r.name === n)),
               files: both.every(n => { const h = dossierHtml(n); return h.includes(n) && !h.includes('No file'); }) };
    });
    ok('all eight file in the bestiary without being told to', filed.listed);
    ok('and each has a readable dossier', filed.files);

    // ---- undrawn art is never requested ----
    await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 3; currentTier = 8; initiateCombat('CARRION', false);
    });
    await page.waitForTimeout(700);
    const drawn = await page.evaluate(() =>
      [...document.querySelectorAll('#enemy-team .portrait')].every(i => i.complete && i.naturalWidth > 0));
    ok('a swarm of undrawn units still renders', drawn);
    ok(`and nothing 404s waiting for the error handler (${notFound.join(', ') || 'none'})`, notFound.length === 0);
  }
};

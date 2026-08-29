// Three warlords on a strict sector-modulo-three rotation meant every commander was seen by
// sector 3 and then repeated in the same order forever - and they differed from each other only
// by intent weights. Seven now, drawn without immediate repeats, each carrying a mechanic the
// squad has to answer rather than out-damage.
module.exports = {
  name: 'Warlords worth meeting',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the roster ----
    const pool = await page.evaluate(() => ({
      count: BOSS_POOL.length,
      ids: new Set(BOSS_POOL.map(b => b.id)).size,
      complete: BOSS_POOL.every(b => b.name && b.short && b.img && b.blurb && b.bg && b.banner && b.intents && b.enrage),
      arted: BOSS_POOL.every(b => ASSET_LIST.includes(b.img)),
      mechanics: BOSS_POOL.filter(b => b.escort || b.ward || b.stormTurn || b.passive ||
        b.enrage.split || b.enrage.summon || b.enrage.plague).length,
      newOnes: BOSS_POOL.filter(b => ['VATBORN', 'MARSHAL', 'STORMCALLER', 'BASTION'].includes(b.id)).length
    }));
    ok(`seven warlords, each with a unique id`, pool.count === 7 && pool.ids === 7);
    ok('each fully described, with its arena and its art declared', pool.complete && pool.arted);
    ok('every one carries a mechanic, not just intent weights', pool.mechanics === 7);
    ok('the four new ones are all present', pool.newOnes === 4);

    // ---- the rotation: stable within a run, and never twice running ----
    const rotation = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const seq = []; for (let s = 1; s <= 28; s++) seq.push(bossForSector(s).id);
      let backToBack = 0;
      for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) backToBack++;
      // asked twice, the same sector must answer the same - the map label, the banner and the
      // fight all ask separately
      const stable = [1, 5, 9, 14].every(s => bossForSector(s).id === seq[s - 1]);
      // every cycle is the whole pool
      const cycle0 = new Set(seq.slice(0, 7)).size, cycle1 = new Set(seq.slice(7, 14)).size;
      // and a different run walks a different order
      const before = seq.join();
      confirmNewGame(1.0);
      const after = []; for (let s = 1; s <= 28; s++) after.push(bossForSector(s).id);
      return { seq, backToBack, stable, cycle0, cycle1, distinct: new Set(seq).size,
               differs: after.join() !== before };
    });
    ok('no warlord is met twice running', rotation.backToBack === 0);
    ok('the same sector always answers with the same warlord', rotation.stable);
    ok('each cycle deals the whole roster', rotation.cycle0 === 7 && rotation.cycle1 === 7);
    ok('and a fresh run walks a different order', rotation.differs);

    const seeded = await page.evaluate(() => {
      const walk = seed => {
        activeContracts = []; currentSlot = 1; runSeed = seed; confirmNewGame(1.0); sectorFront = null;
        runSeed = seed;
        const s = []; for (let i = 1; i <= 14; i++) s.push(bossForSector(i).id);
        return s.join();
      };
      const a = walk('DAILY-TEST'), b = walk('DAILY-TEST'), c = walk('OTHER-SEED');
      runSeed = null;
      return { same: a === b, different: a !== c };
    });
    ok('a seeded protocol deals everyone the same warlords', seeded.same);
    ok('and a different seed deals different ones', seeded.different);

    // ---- a warlord that does not arrive alone ----
    const retinue = await page.evaluate(() => {
      // The rotation decides which warlord a sector holds, so walk to a sector that holds the
      // one under test rather than trying to stub the engine's own lookup.
      const stage = id => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        let s = 1;
        while (s <= 200 && bossForSector(s).id !== id) s++;
        currentSector = s; currentTier = TOTAL_TIERS;
        const pack = generateEnemies('BOSS', 1, false, 1);
        currentSector = 1; currentTier = 1;
        return pack;
      };
      const marshal = stage('MARSHAL');
      const bastion = stage('BASTION');
      const lone = stage('WARLORD');
      return {
        marshalSize: marshal.length, escort: marshal[1] && marshal[1].name,
        escortLinked: marshal[0].escortId === marshal[1].id,
        escortPlated: marshal[1] && marshal[1].sig === 'RIOT_PLATE' && marshal[1].plate > 0,
        bastionSize: bastion.length, ward: bastion[1] && bastion[1].name,
        wardLinked: bastion[0].wardId === bastion[1].id,
        loneSize: lone.length
      };
    });
    ok(`the Marshal rides in with ${retinue.escort}`,
      retinue.marshalSize === 2 && retinue.escort === 'Bulldog' && retinue.escortLinked);
    ok('and the lieutenant carries its own plate', retinue.escortPlated);
    ok(`the Bastion stands behind a ${retinue.ward}`,
      retinue.bastionSize === 2 && retinue.ward === 'Ward Generator' && retinue.wardLinked);
    ok('a warlord with no retinue still arrives alone', retinue.loneSize === 1);

    // ---- the ward and the escort are the fight's first problem ----
    const cover = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const hero = playerRoster.find(p => p.gridPos > 0);
      hero.quirk = null; hero.trinket = null; hero.traits = []; activeRelics = [];
      const mk = (id, extra) => Object.assign({
        id, name: 'T', classType: 'BOSS', range: 'melee', maxHp: 9999, hp: 9999, speed: 5,
        armor: 0, baseArmor: 0, isPlayer: false, dmgBase: 10, img: 'enemy_boss.webp', scale: 2,
        hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0,
        corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 }
      }, extra);
      const warded = mk('w1', { wardId: 'gen1', wardSoak: 0.12 });
      const gen = mk('gen1', { maxHp: 50, hp: 50 });
      const guarded = mk('m1', { escortId: 'lt1', escortArmor: 22 });
      const lt = mk('lt1', { maxHp: 50, hp: 50 });
      activeEntities = [hero, warded, gen, guarded, lt];
      const upWard = mitigate(hero, warded, 100, 'phys', null).n;
      const upEsc = mitigate(hero, guarded, 100, 'phys', null).n;
      gen.hp = 0; lt.hp = 0;
      const downWard = mitigate(hero, warded, 100, 'phys', null).n;
      const downEsc = mitigate(hero, guarded, 100, 'phys', null).n;
      combatActive = false;
      return { upWard, downWard, upEsc, downEsc };
    });
    ok(`a live ward all but stops a blow (100 -> ${cover.upWard})`, cover.upWard <= 12 && cover.upWard > 0);
    ok(`killing the generator drops the ward (100 -> ${cover.downWard})`, cover.downWard === 100);
    ok(`a standing lieutenant is worth heavy plate (100 -> ${cover.upEsc})`, cover.upEsc === 78);
    ok(`and falls away with them (100 -> ${cover.downEsc})`, cover.downEsc === 100);

    // ---- the Vatborn divides what is left rather than adding to it ----
    const split = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const b = BOSS_POOL.find(x => x.id === 'VATBORN');
      const boss = {
        id: 'vb', name: b.name, classType: 'BOSS', range: 'melee', phase: 1,
        maxHp: 400, hp: 180, speed: 8, armor: 8, baseArmor: 8, isPlayer: false, dmgBase: 30,
        img: b.img, scale: b.scale, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0,
        oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { ...b.resistances },
        intents: b.intents, enrage: b.enrage, dmgType: 'bio'
      };
      boss.intent = rollIntent(boss);
      const heroes = playerRoster.filter(p => p.gridPos > 0);
      activeEntities = [...heroes, boss]; turnQueue = [...heroes, boss];
      combatActive = true;
      const poolBefore = boss.hp;
      executeEnemyAi(boss);
      const spawn = activeEntities.filter(e => !e.isPlayer && e.id !== 'vb');
      const poolAfter = boss.hp + spawn.reduce((a, s) => a + s.hp, 0);
      const out = { phase: boss.phase, spawned: spawn.length, named: spawn[0] && spawn[0].name,
                    poolBefore, poolAfter, queued: spawn.every(s => turnQueue.includes(s)),
                    armourGone: boss.armor === 0 };
      combatActive = false;
      return out;
    });
    ok('at half health the Vatborn comes apart', split.phase === 2 && split.spawned === 2);
    ok(`into ${split.named}s that share what it had left (${split.poolBefore} -> ${split.poolAfter})`,
      split.poolAfter === split.poolBefore && split.named === 'Vat-Spawn');
    ok('each taking its own turn, and the husk sheds its plate', split.queued && split.armourGone);

    // ---- the Stormcaller will not let a forecast stand ----
    const storm = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const b = BOSS_POOL.find(x => x.id === 'STORMCALLER');
      const boss = {
        id: 'sc', name: b.name, classType: 'BOSS', range: 'ranged', phase: 2,
        maxHp: 999, hp: 999, speed: 13, armor: 0, baseArmor: 0, isPlayer: false, dmgBase: 5,
        img: b.img, scale: b.scale, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0,
        oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { ...b.resistances },
        intents: b.intents, enrage: b.enrage, dmgType: 'energy',
        stormTurn: b.stormTurn, stormClock: 0, intent: { type: 'ATTACK', icon: '#' }
      };
      const heroes = playerRoster.filter(p => p.gridPos > 0);
      heroes.forEach(h => { h.maxHp = 999; h.hp = 999; });
      activeEntities = [...heroes, boss]; turnQueue = [...heroes, boss];
      combatActive = true; currentWeather = 'CLEAR';
      // Record only the skies it actually turns to - the one it started under is not a rotation.
      const turnedTo = [];
      let last = currentWeather;
      for (let i = 0; i < 9; i++) {
        boss.intent = { type: 'ATTACK', icon: '#' };
        executeEnemyAi(boss);
        if (currentWeather !== last) { turnedTo.push(currentWeather); last = currentWeather; }
      }
      const turns = boss.stormTurn;
      currentWeather = 'CLEAR'; combatActive = false;
      return { turns, rotations: turnedTo.length, skies: new Set(turnedTo).size,
               neverClear: !turnedTo.includes('CLEAR') };
    });
    ok(`the Stormcaller turns the sky every ${storm.turns} turns`, storm.turns === 3);
    ok(`turning it ${storm.rotations} times in nine, never back to clear`,
      storm.rotations === 3 && storm.neverClear && storm.skies >= 2);

    // ---- the bestiary and the manual pick them up on their own ----
    const book = await page.evaluate(() => {
      const roster = bestiaryRoster().filter(r => r.boss);
      bestiary = {}; BOSS_POOL.forEach(b => noteBestiary(b.name, 'met'));
      const text = CODEX.find(e => e.id === 'BESTIARY').body().join(' ');
      const listed = BOSS_POOL.every(b => text.includes(b.name));
      const dossiers = BOSS_POOL.every(b => /WARLORD/.test(dossierHtml(b.name)));
      bestiary = {}; saveMeta();
      return { roster: roster.length, listed, dossiers };
    });
    ok('all seven file in the bestiary', book.roster === 7 && book.dossiers);
    ok('and the manual lists every one', book.listed);

    // ---- a portrait that has not been drawn yet falls back rather than breaking ----
    const art = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const armed = /armPortraitFallback\(\)/.test(src) && src.includes("el.src = PORTRAIT_FALLBACK");
      const inline = /onerror=/.test(src);
      const img = document.createElement('img');
      img.className = 'portrait'; img.src = 'enemy_boss_does_not_exist.webp';
      document.body.appendChild(img);
      await new Promise(r => setTimeout(r, 400));
      const fellBack = img.src.includes(PORTRAIT_FALLBACK);
      img.remove();
      return { armed, inline, fellBack };
    });
    ok('a missing portrait falls back to a stand-in', art.armed && art.fellBack);
    ok('without an inline handler', !art.inline);
  }
};

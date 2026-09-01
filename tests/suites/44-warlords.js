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
      road: BOSS_ROTATION.length,
      finals: BOSS_POOL.filter(b => b.final).length,
      ids: new Set(BOSS_POOL.map(b => b.id)).size,
      complete: BOSS_POOL.every(b => b.name && b.short && b.img && b.blurb && b.bg && b.banner && b.intents && b.enrage),
      arted: BOSS_POOL.every(b => ASSET_LIST.includes(b.img)),
      mechanics: BOSS_POOL.filter(b => b.escort || b.ward || b.stormTurn || b.passive ||
        b.venom || b.enrage.summon || b.enrage.plague || b.enrage.backbreaker || b.tally).length,
      newOnes: BOSS_POOL.filter(b => ['VATBORN', 'MARSHAL', 'STORMCALLER', 'BASTION'].includes(b.id)).length
    }));
    // Seven hold the road and one waits at the end of it. The rotation deals only the seven;
    // the eighth is the ending and is dealt at the last sector alone.
    ok(`${pool.road} warlords hold the road, and one stands at the end of it`,
      pool.road === 7 && pool.finals === 1 && pool.count === pool.road + pool.finals);
    ok('each with a unique id', pool.ids === pool.count);
    ok('each fully described, with its arena and its art declared', pool.complete && pool.arted);
    ok('every one carries a mechanic, not just intent weights', pool.mechanics === pool.count);
    ok('the four new ones are all present', pool.newOnes === 4);
    // The dossier used to read .name off the passive id - a string - and print an empty block
    // headed "Command" for every commander that had one.
    const passives = await page.evaluate(() => {
      const named = BOSS_POOL.filter(b => b.passive);
      return { held: named.map(b => b.passive),
               described: named.every(b => BOSS_PASSIVES[b.passive] && BOSS_PASSIVES[b.passive].name && BOSS_PASSIVES[b.passive].desc),
               inFile: named.every(b => {
                 const h = dossierHtml(b.name);
                 return h.includes(BOSS_PASSIVES[b.passive].name) && !h.includes('Command');
               }) };
    });
    ok(`every named passive is spelled out (${passives.held.join(', ')})`, passives.described);
    ok('and the warlord\u2019s file prints it rather than an empty block', passives.inFile);

    // ---- the opening is dealt gently, without locking anything out ----
    // A flat shuffle made a first-ever commander as likely to be the Bastion - warded to 12%
    // behind a generator - as the Warlord. The first cycle is sorted by threat now, with
    // enough jitter that it stays a bias rather than a gate.
    const shaped = await page.evaluate(() => {
      // The three-point scale rates the road. The last warlord is deliberately off it - it is
      // not a draw the shuffle can make, so rating it against the others would be meaningless.
      const rated = BOSS_ROTATION.every(b => [1, 2, 3].includes(b.threat));
      const above = BOSS_POOL.filter(b => b.final).every(b => b.threat > 3);
      const mix = {};
      // Read off bossOrder rather than off sectors: the last sector hands over the ending
      // rather than a draw, so walking depths would sample a commander the shuffle never deals.
      for (let run = 0; run < 1200; run++) {
        runSeed = null; bossSalt = `shape${run}`;
        bossOrder(0).forEach((idx, i) => {
          const t = BOSS_ROTATION[idx].threat;
          (mix[i + 1] = mix[i + 1] || { 1: 0, 2: 0, 3: 0 })[t]++;
        });
      }
      bossSalt = 'w0';
      const pct = (s, t) => 100 * mix[s][t] / (mix[s][1] + mix[s][2] + mix[s][3]);
      // What an unbiased draw would give, as the yardstick for "flat".
      const flat = t => 100 * BOSS_ROTATION.filter(b => b.threat === t).length / BOSS_ROTATION.length;
      return { rated, above,
               s1light: pct(1, 1), s1heavy: pct(1, 3),
               s4: [pct(4, 1), pct(4, 2), pct(4, 3)], flat: [flat(1), flat(2), flat(3)],
               lastHeavy: pct(BOSS_ROTATION.length, 3) };
    });
    ok('every commander on the road is rated for how much work it is', shaped.rated);
    ok('and the one at the end of it is rated above all of them', shaped.above);
    ok(`the opening sector leans light (${shaped.s1light.toFixed(0)}% against ${shaped.flat[0].toFixed(0)}% flat)`,
      shaped.s1light > shaped.flat[0] * 1.6);
    ok(`but a heavy one can still open a run (${shaped.s1heavy.toFixed(1)}%)`,
      shaped.s1heavy > 0 && shaped.s1heavy < shaped.flat[2] / 2);
    ok(`and by mid-run the draw is flat again (${shaped.s4.map(n => n.toFixed(0) + '%').join(' / ')})`,
      shaped.s4.every((n, i) => Math.abs(n - shaped.flat[i]) < 8));
    ok(`the end of a cycle is where the heavy ones land (${shaped.lastHeavy.toFixed(0)}%)`,
      shaped.lastHeavy > shaped.flat[2] * 1.5);

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
        // If the walk ran out, the pack below is some other commander's and every assertion
        // about this one is meaningless - say so rather than measuring the wrong warlord.
        if (s > 200) return { notFound: id };
        currentSector = s; currentTier = TOTAL_TIERS;
        const pack = generateEnemies('BOSS', 1, false, 1);
        currentSector = 1; currentTier = 1;
        return pack;
      };
      const marshal = stage('MARSHAL');
      const bastion = stage('BASTION');
      const lone = stage('WARLORD');
      const missing = [marshal, bastion, lone].filter(p => p.notFound).map(p => p.notFound);
      if (missing.length) return { missing };
      return { missing: [],
        marshalSize: marshal.length, escort: marshal[1] && marshal[1].name,
        // Guarded like every other read on this line: an absent retinue is a finding, and it
        // should arrive as one named assertion failing rather than the whole suite aborting on
        // a TypeError that says nothing about which commander came up short.
        escortLinked: !!marshal[1] && marshal[0].escortId === marshal[1].id,
        escortPlated: marshal[1] && marshal[1].sig === 'RIOT_PLATE' && marshal[1].plate > 0,
        escortImg: marshal[1] && marshal[1].img, escortClass: marshal[1] && marshal[1].classType,
        escortSpeed: marshal[1] && marshal[1].speed,
        bastionSize: bastion.length, ward: bastion[1] && bastion[1].name,
        wardLinked: !!bastion[1] && bastion[0].wardId === bastion[1].id,
        loneSize: lone.length
      };
    });
    ok(`the rotation reaches every commander under test (${retinue.missing.join(', ') || 'all found'})`,
      retinue.missing.length === 0);
    ok(`the Marshal rides in with ${retinue.escort}`,
      retinue.marshalSize === 2 && retinue.escort === 'Bulldog' && retinue.escortLinked);
    ok('and the lieutenant carries its own plate', retinue.escortPlated);
    ok(`the hound runs on its own art and its own legs (${retinue.escortImg}, SPD ${retinue.escortSpeed})`,
      retinue.escortImg === 'enemy_hound_bulldog.webp' && retinue.escortClass === 'BEAST' &&
      retinue.escortSpeed > 15);
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

    // ---- the Vatborn buys strength with skin ----
    const venom = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const b = BOSS_POOL.find(x => x.id === 'VATBORN');
      const boss = {
        id: 'vb', name: b.name, classType: 'BOSS', range: 'melee', phase: 1,
        maxHp: 400, hp: 400, speed: 8, armor: b.armor, baseArmor: b.armor, isPlayer: false, dmgBase: 100,
        img: b.img, scale: b.scale, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0,
        oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 },
        intents: b.intents, enrage: b.enrage, dmgType: 'bio', bossPassive: b.passive,
        venom: { ...b.venom }, venomStacks: 0, venomClock: 0
      };
      boss.intent = rollIntent(boss);
      const hero = playerRoster.find(p => p.gridPos > 0);
      hero.quirk = null; hero.trinket = null; hero.traits = []; activeRelics = [];
      activeEntities = [hero, boss]; turnQueue = [hero, boss];
      combatActive = true;
      const cold = { dmg: boss.dmgBase, speed: boss.speed, armor: boss.armor,
                     takes: mitigate(hero, boss, 100, 'phys', null).n };
      const steps = [];
      // It doses on its own clock, not on every turn.
      for (let i = 0; i < 12; i++) { boss.venomClock++;
        if (boss.venomClock >= boss.venom.every && boss.venomStacks < boss.venom.max) {
          boss.venomClock = 0; venomDose(boss, true);
        }
        steps.push(boss.venomStacks);
      }
      const hot = { dmg: boss.dmgBase, speed: boss.speed, armor: boss.armor,
                    takes: mitigate(hero, boss, 100, 'phys', null).n };
      renderField();
      const tag = document.querySelector('#enemy-team .sig-tag');
      const card = tag ? tag.innerText.trim() : '';
      combatActive = false;
      return { cold, hot, steps, cap: boss.venom.max, stacks: boss.venomStacks, card };
    });
    ok(`it starts behind real plate (${venom.cold.armor} armour, a 100 blow lands for ${venom.cold.takes})`,
      venom.cold.armor >= 12 && venom.cold.takes < 90);
    ok(`each dose buys damage and speed (${venom.cold.dmg} -> ${venom.hot.dmg} DMG, ${venom.cold.speed} -> ${venom.hot.speed} SPD)`,
      venom.hot.dmg > venom.cold.dmg * 1.5 && venom.hot.speed > venom.cold.speed);
    ok(`and costs it skin (a 100 blow now lands for ${venom.hot.takes})`,
      venom.hot.armor === 0 && venom.hot.takes > venom.cold.takes * 1.5);
    ok(`the pump runs dry (${venom.stacks}/${venom.cap} doses, ticking every other turn)`,
      venom.stacks === venom.cap && venom.steps[0] === 0 && venom.steps[1] === 1);
    ok(`and the card counts the doses out loud (${venom.card})`,
      /VENOM PUMP\s+5\/5/i.test(venom.card));

    // ---- and at half health it opens the tank and breaks somebody over its knee ----
    const back = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const b = BOSS_POOL.find(x => x.id === 'VATBORN');
      const boss = {
        id: 'vb', name: b.name, classType: 'BOSS', range: 'melee', phase: 1,
        maxHp: 400, hp: 180, speed: 8, armor: b.armor, baseArmor: b.armor, isPlayer: false, dmgBase: 20,
        img: b.img, scale: b.scale, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0,
        oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 },
        intents: b.intents, enrage: b.enrage, dmgType: 'bio', bossPassive: b.passive,
        venom: { ...b.venom }, venomStacks: 0, venomClock: 0
      };
      boss.intent = rollIntent(boss);
      const heroes = playerRoster.filter(p => p.gridPos > 0);
      heroes.forEach(h => { h.quirk = null; h.trinket = null; h.traits = []; h.maxHp = 200; h.hp = 200; });
      activeRelics = [];
      // The most broken operator on the field is the one it picks up.
      const mark = heroes[heroes.length - 1]; mark.hp = 120;
      activeEntities = [...heroes, boss]; turnQueue = [...heroes, boss];
      combatActive = true;
      executeEnemyAi(boss);
      const out = { phase: boss.phase, stacks: boss.venomStacks,
                    markHp: mark.hp, markStunned: mark.stunnedTurns,
                    othersWhole: heroes.filter(h => h !== mark).every(h => h.hp === h.maxHp) };
      combatActive = false;
      return out;
    });
    ok('breaking it past half cranks the tank wide open', back.phase === 2 && back.stacks === 2);
    ok(`and the worst-off operator gets picked up and put down (120 -> ${back.markHp} HP)`,
      back.markHp < 120 && back.markStunned >= 1);
    ok('it is one operator, not the whole line', back.othersWhole);

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
      return { roster: roster.length, listed, dossiers, commanders: BOSS_POOL.length };
    });
    ok(`all ${book.commanders} file in the bestiary`, book.roster === book.commanders && book.dossiers);
    ok('and the manual lists every one', book.listed);

    // ---- a portrait that has not been drawn yet falls back rather than breaking ----
    const art = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      // Behaviour, not the exact line: the handler now prefers a per-unit stand-in and falls
      // through to PORTRAIT_FALLBACK, so matching its source text was only ever a proxy.
      const armed = /armPortraitFallback\(\)/.test(src) && /PORTRAIT_FALLBACK/.test(src);
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

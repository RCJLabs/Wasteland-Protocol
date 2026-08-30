// The whole audio design was four blips straight onto the destination node - click, shoot, hit,
// heal - so a shotgun, a rifle and a set of teeth all made the same noise, a scratch landed as
// hard as a boss's opening shell, and a fight happened in silence between them.
module.exports = {
  name: 'Sound and feedback',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the voice table ----
    const table = await page.evaluate(() => ({
      count: Object.keys(SFX).length,
      malformed: Object.entries(SFX).filter(([, v]) => !v.wave || !v.from || !v.to || !v.dur || !v.gain).map(([k]) => k),
      waves: [...new Set(Object.values(SFX).map(v => v.wave))].sort(),
      loud: Object.entries(SFX).filter(([, v]) => v.gain > 0.2).map(([k]) => k)
    }));
    ok(`there are ${table.count} voices, not four`, table.count >= 10);
    ok('each fully specified', table.malformed.length === 0);
    ok('across several waveforms', table.waves.length >= 3);
    ok('and none of them deafening', table.loud.length === 0);

    // ---- every ability speaks with its own weapon ----
    const voices = await page.evaluate(() => {
      const all = Object.values(ABILITIES).flat();
      return {
        mapped: all.map(a => ({ move: a.move, voice: voiceFor(a.move) })),
        allReal: all.every(a => !!SFX[voiceFor(a.move)]),
        distinct: new Set(all.map(a => voiceFor(a.move))).size,
        shotgun: voiceFor('BUCKSHOT'), pistol: voiceFor('PISTOL'),
        wrench: voiceFor('HEAVY_WRENCH'), blade: voiceFor('SCRAP_BLADE'),
        teeth: voiceFor('FERAL_BITE'), fire: voiceFor('MOLOTOV'),
        unknown: voiceFor('A_MOVE_THAT_DOES_NOT_EXIST'),
        unknownIsReal: !!SFX[voiceFor('A_MOVE_THAT_DOES_NOT_EXIST')]
      };
    });
    ok('every ability maps to a voice that exists', voices.allReal);
    ok(`spread over ${voices.distinct} different ones`, voices.distinct >= 5);
    ok('a shotgun does not sound like a pistol', voices.shotgun !== voices.pistol);
    ok('a wrench does not sound like a blade', voices.wrench !== voices.blade);
    ok('and teeth do not sound like fire', voices.teeth !== voices.fire);
    ok(`an unrecognised move still gets a real voice (${voices.unknown})`, voices.unknownIsReal);

    // ---- and that is what actually plays ----
    await page.evaluate(() => {
      initAudio();
      window.__turn = (cls, move, setup) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null; initiateCombat('RAIDERS', false);
        const hero = playerRoster.find(h => h.classType === cls);
        hero.gridPos = 1; hero.maxHp = 9999; hero.hp = 9999; hero.dmgBase = 100; hero.quirk = null; sectorFront = null;
        Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
        const foe = activeEntities.find(e => !e.isPlayer);
        foe.maxHp = 1000; foe.hp = 1000; foe.armor = 0; foe.baseArmor = 0;
        foe.resistances = { phys: 0, bio: 0, energy: 0 };
        foe.corrodedTurns = 0; foe.markedTurns = 0; foe.bleedingTurns = 0; foe.oiledTurns = 0; foe.stunnedTurns = 0;
        activeEntities = [hero, foe]; turnQueue = [hero, foe];
        activeIndex = 0; combatActive = true;
        if (setup) setup(foe, hero);
        sfxLog = []; pendingAction = move; resolveAction(foe.id);
        return { played: sfxLog.map(e => e.type), full: [...sfxLog], foe };
      };
    });

    const turns = await page.evaluate(() => ({
      buckshot: window.__turn('SHOTGUNNER', 'BUCKSHOT').played,
      pistol:   window.__turn('MEDIC', 'PISTOL').played,
      wrench:   window.__turn('BRUISER', 'HEAVY_WRENCH').played,
      molotov:  window.__turn('PYROMANIAC', 'MOLOTOV').played,
      bite:     window.__turn('HOUND', 'FERAL_BITE').played,
      combo:    window.__turn('BRUISER', 'SCRAP_BLADE', f => { f.stunnedTurns = 3; }).played
    }));
    ok(`a shotgun fires a shotgun (${turns.buckshot.join(' > ')})`, turns.buckshot[0] === 'shotgun');
    ok('a pistol fires a pistol', turns.pistol[0] === 'pistol');
    ok('a wrench swings heavy', turns.wrench[0] === 'heavy');
    ok('a molotov burns', turns.molotov[0] === 'flame');
    ok('a bite sounds like an animal', turns.bite[0] === 'beast');
    ok('and a combo gets its own sting', turns.combo.includes('combo'));

    // One weapon, one impact. Two sounds for one hit is the tell that something is firing twice.
    // Which impact voice it is now depends on what the blow was worth, so the set is derived
    // from the table rather than named - adding a band must not need this rewritten.
    const single = await page.evaluate(() => {
      const bands = new Set(IMPACT_TIERS.map(t => t.voice));
      const r = window.__turn('MEDIC', 'PISTOL');
      return { played: r.played, hits: r.played.filter(t => bands.has(t)).length,
               weaponFirst: !bands.has(r.played[0]) };
    });
    ok(`an attack lands exactly one impact (${single.played.join(' > ')})`, single.hits === 1);
    ok('after its weapon, and nothing else', single.weaponFirst && single.played.length === 2);

    // ---- an impact is worth what it took off ----
    const weight = await page.evaluate(() => {
      const at = (dmg, maxHp, scale) => { sfxLog = []; playImpact(dmg, { maxHp }, scale); return sfxLog[0].weight; };
      return { scratch: at(5, 500), solid: at(120, 500), crushing: at(400, 500),
               resisted: at(120, 500, 0.7), weakness: at(120, 500, 1.25) };
    });
    ok(`a scratch lands light (${weight.scratch})`, weight.scratch < 1);
    ok(`a solid hit lands harder (${weight.solid})`, weight.solid > weight.scratch);
    ok(`a crushing one harder still (${weight.crushing})`, weight.crushing > weight.solid);
    ok('a resisted hit is duller than the same damage taken clean', weight.resisted < weight.solid);
    ok('and a weakness is heavier', weight.weakness > weight.solid);

    // A shrugged-off hit and a hit that did nothing used to sound identical - to each other, and
    // to no sound at all. Each now carries a mark layered over the band, so what happened on the
    // way in is audible without costing the weight of what still landed.
    const resistance = await page.evaluate(() => {
      const bands = new Set(IMPACT_TIERS.map(t => t.voice));
      const marks = new Set(['soak', 'weak']);
      const against = (res) => {
        const r = window.__turn('MEDIC', 'PISTOL', f => { f.resistances = { phys: res, bio: 0, energy: 0 }; });
        return { band: r.full.filter(e => bands.has(e.type)), mark: r.full.filter(e => marks.has(e.type)) };
      };
      return { clean: against(0), resisted: against(30), immune: against(100), weak: against(-20) };
    });
    ok('a resisted hit still makes a sound', resistance.resisted.band.length === 1);
    ok('quieter than a clean one', resistance.resisted.band[0].weight < resistance.clean.band[0].weight);
    ok('an immune hit makes the faintest one', resistance.immune.band.length === 1 &&
      resistance.immune.band[0].weight < resistance.resisted.band[0].weight);
    ok('and a weakness the loudest', resistance.weak.band[0].weight > resistance.clean.band[0].weight);
    ok(`armour is marked over the top of it (${resistance.resisted.mark.map(m => m.type).join()})`,
      resistance.resisted.mark.length === 1 && resistance.resisted.mark[0].type === 'soak');
    ok('and so is an immune hit', resistance.immune.mark.length === 1 && resistance.immune.mark[0].type === 'soak');
    ok(`a weakness gets a mark of its own (${resistance.weak.mark.map(m => m.type).join()})`,
      resistance.weak.mark.length === 1 && resistance.weak.mark[0].type === 'weak');
    ok('and a clean hit carries no mark at all', resistance.clean.mark.length === 0);

    // ---- a bed under the fight, keyed to where it is happening ----
    const beds = await page.evaluate(() => ({
      count: Object.keys(AMBIENCE).length,
      names: new Set(Object.values(AMBIENCE).map(a => a.name)).size,
      malformed: Object.entries(AMBIENCE).filter(([, v]) => !v.drone || !v.cutoff || !v.hiss || !v.name).map(([k]) => k),
      distinctDrones: new Set(Object.values(AMBIENCE).map(a => a.drone)).size,
      unknown: ambienceFor('bg_not_a_real_file.webp').name
    }));
    ok(`every backdrop has a bed (${beds.count})`, beds.count >= 6);
    ok('each with its own name', beds.names === beds.count);
    ok('each fully specified', beds.malformed.length === 0);
    ok('and each pitched differently', beds.distinctDrones === beds.count);
    ok('an unknown backdrop falls back rather than going silent', !!beds.unknown);

    const live = await page.evaluate(() => {
      globalSettings.sfx = true; initAudio();
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const enter = (type, sector, tier) => {
        currentSector = sector; currentTier = tier; initiateCombat(type, false);
        return { biome: ambienceBiome, running: !!ambienceNodes };
      };
      const beast = enter('BEASTS', 2, 4);
      const mech = enter('MECH', 2, 4);
      const boss = enter('BOSS', 2, 10);
      renderMap();
      const afterLeaving = { biome: ambienceBiome, running: !!ambienceNodes };
      return { beast, mech, boss, afterLeaving };
    });
    ok(`a beast fight gets its own bed (${live.beast.biome})`, live.beast.running && !!live.beast.biome);
    ok(`a mech fight a different one (${live.mech.biome})`, live.mech.biome !== live.beast.biome);
    ok(`and a commander its own arena (${live.boss.biome})`, live.boss.biome !== live.beast.biome);
    ok('leaving combat stops it', !live.afterLeaving.running && live.afterLeaving.biome === null);

    const ends = await page.evaluate(() => {
      const after = (finish) => {
        globalSettings.sfx = true; initAudio();
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 2; currentTier = 4; initiateCombat('RAIDERS', false);
        const during = !!ambienceNodes;
        finish();
        checkWinState();
        return { during, after: !!ambienceNodes };
      };
      return {
        won: after(() => activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; })),
        lost: after(() => activeEntities.filter(e => e.isPlayer).forEach(e => { e.hp = 0; }))
      };
    });
    ok('winning a fight stops the bed', ends.won.during && !ends.won.after);
    ok('and so does losing one', ends.lost.during && !ends.lost.after);

    const muted = await page.evaluate(() => {
      globalSettings.sfx = false;
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 4; initiateCombat('RAIDERS', false);
      const running = !!ambienceNodes;
      globalSettings.sfx = true;
      return running;
    });
    ok('turning sound off leaves no bed running', !muted);

    // ---- a commander breaking is not the same event as taking a hit ----
    const enrage = await page.evaluate(() => {
      globalSettings.sfx = true;
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach(c => { if (c.gridPos > 0) { c.maxHp = 5000; c.hp = 5000; } });
      currentSector = 1; currentTier = 10; initiateCombat('BOSS', false);
      const boss = activeEntities.find(e => e.id === 'b1');
      boss.hp = Math.floor(boss.maxHp * 0.4);
      sfxLog = []; combatActive = true; executeEnemyAi(boss);
      return { played: sfxLog.map(e => e.type) };
    });
    ok(`a boss breaking past half gets a sting (${enrage.played.join(' > ')})`, enrage.played.includes('enrage'));
    ok('and it comes first, not buried behind the attack', enrage.played[0] === 'enrage');

    // ---- nothing that fires a sound asks for one that does not exist ----
    const named = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const asked = [...src.matchAll(/playSFX\('([a-z]+)'/g)].map(m => m[1]);
      return { asked: [...new Set(asked)], missing: [...new Set(asked)].filter(n => !SFX[n]) };
    });
    ok(`${named.asked.length} sound names are used across the engine`, named.asked.length >= 6);
    ok('and every one of them exists in the table', named.missing.length === 0);
    if (named.missing.length) console.log('        missing:', named.missing.join(', '));

    // A voice declared and never used is dead weight, the same way an inert relic is. Reachable
    // means one of three things now: something asks for it by name, an ability speaks with it,
    // or the impact selector can produce it - and the third is measured by driving the selector
    // across the whole space rather than by reading the table and hoping.
    const unused = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const reachable = new Set();
      for (let share = 0; share <= 1.001; share += 0.01) reachable.add(impactVoice(share));
      for (let scale = 0; scale <= 2.001; scale += 0.05) { const m = impactMark(scale); if (m) reachable.add(m); }
      for (const dead of [{ maxHp: 100, hp: 0, isPlayer: true }, { maxHp: 100, hp: 0, isPlayer: false }]) {
        sfxLog = []; playImpact(60, dead); sfxLog.forEach(e => reachable.add(e.type));
      }
      return { reachable: [...reachable].sort(),
               missing: Object.keys(SFX).filter(n => !src.includes(`playSFX('${n}'`)
                 && !Object.values(CLASS_VOICE).includes(n)
                 && !Object.values(MOVE_VOICE_OVERRIDE).includes(n)
                 && !reachable.has(n)) };
    });
    ok(`and every voice in the table is reachable (${unused.reachable.length} of them through the impact selector)`,
      unused.missing.length === 0);
    if (unused.missing.length) console.log('        unused:', unused.missing.join(', '));

    // ---- none of this may throw when there is no audio to play through ----
    const headless = await page.evaluate(() => {
      const saved = audioCtx;
      audioCtx = null;
      let threw = null;
      try {
        playSFX('shotgun'); playImpact(50, { maxHp: 100 });
        startAmbience('bg_canyon.webp'); stopAmbience();
        window.__turn('SHOTGUNNER', 'BUCKSHOT');
      } catch (e) { threw = e.message; }
      audioCtx = saved;
      return { threw, logged: sfxLog.length };
    });
    ok('the game plays with no audio context at all', headless.threw === null);
    ok('and still records what it would have played', headless.logged > 0);

    const capped = await page.evaluate(() => {
      sfxLog = [];
      for (let i = 0; i < SFX_LOG_MAX * 4; i++) playSFX('click');
      return sfxLog.length;
    });
    const cap = await page.evaluate(() => SFX_LOG_MAX);
    ok(`the sound record stays bounded (${capped} of ${cap})`, capped === cap);
  }
};

// The audit: "The audio is procedurally generated beeps - impressive for what it is, and thin
// over a long run. Layered ambience per biome, a combat bed that thickens as momentum climbs,
// and impacts distinct enough that you can hear a crit without looking."
//
// Three things to hold, and the way each of them fails is quiet rather than loud: a bed that is
// one sine at seven pitches, a heat layer wired to nothing, a crit that is a hit at 1.25x.
module.exports = {
  name: 'A real mix',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- every bed is layered, and no two are the same shape ----
    const beds = await page.evaluate(() => {
      const entries = Object.entries(AMBIENCE);
      const sig = v => [v.drone, v.interval, v.voice, v.mote && v.mote.wave, v.swayRate].join('|');
      return {
        count: entries.length,
        missingVoice: entries.filter(([, v]) => !v.voice || !v.interval).map(([k]) => k),
        missingSway:  entries.filter(([, v]) => !v.sway || !v.swayRate).map(([k]) => k),
        missingMote:  entries.filter(([, v]) => !v.mote).map(([k]) => k),
        malformedMote: entries.filter(([, v]) => v.mote && (!v.mote.wave || !v.mote.from || !v.mote.to
          || !v.mote.dur || !v.mote.gain || !Array.isArray(v.mote.every) || v.mote.every.length !== 2
          || !(v.mote.every[1] > v.mote.every[0]))).map(([k]) => k),
        sigs: new Set(entries.map(([, v]) => sig(v))).size,
        voices: new Set(entries.map(([, v]) => v.voice)).size,
        intervals: new Set(entries.map(([, v]) => v.interval)).size,
        // a bed loud enough to fight the effects over is a bed nobody keeps on
        loud: entries.filter(([, v]) => v.hiss > 0.06 || (v.mote && v.mote.gain > 0.06)).map(([k]) => k)
      };
    });
    ok(`every backdrop still has a bed (${beds.count})`, beds.count >= 7);
    ok('each with a voice above the sub, at its own interval', beds.missingVoice.length === 0);
    ok('each with a filter that sways rather than sitting still', beds.missingSway.length === 0);
    ok('each with a sound only that place makes', beds.missingMote.length === 0);
    ok('and every one of those fully specified', beds.malformedMote.length === 0);
    ok(`no two beds share a shape (${beds.sigs} of ${beds.count} distinct)`, beds.sigs === beds.count);
    ok(`spread over ${beds.voices} waveforms and ${beds.intervals} intervals`,
      beds.voices >= 3 && beds.intervals === beds.count);
    ok('and none of them loud enough to fight the effects', beds.loud.length === 0);

    // A small speaker gives up somewhere below 300Hz, and this is played on a phone. Whatever a
    // bed is pitched at, the layer carrying its character has to land where that speaker can
    // reproduce it - rendered offline before the lift, four of the seven put almost everything
    // they had under 100Hz, which is a bed nobody hears.
    const audible = await page.evaluate(() => {
      globalSettings.sfx = true; globalSettings.ambVol = 0.7; initAudio();
      const rows = Object.entries(AMBIENCE).map(([bg, v]) => {
        startAmbience(bg);
        const p = ambienceNodes.parts;
        const r = { name: v.name, raw: v.drone * v.interval, drone: v.drone,
                    voice: p.voice.frequency.value, heat: p.heat.frequency.value };
        stopAmbience();
        return r;
      });
      const octave = r => Math.log2(r.voice / r.raw);
      return { floor: VOICE_FLOOR, pitches: rows.map(r => Math.round(r.voice)),
               low: rows.filter(r => r.voice < VOICE_FLOOR).map(r => r.name),
               notOctaves: rows.filter(r => Math.abs(octave(r) - Math.round(octave(r))) > 1e-6).map(r => r.name),
               shrill: rows.filter(r => r.voice > VOICE_FLOOR * 4).map(r => r.name),
               heatUnderSub: rows.filter(r => r.heat <= r.drone).map(r => r.name),
               distinct: new Set(rows.map(r => Math.round(r.voice))).size, count: rows.length };
    });
    ok(`every bed's character layer clears ${audible.floor}Hz (${audible.pitches.join(', ')})`,
      audible.low.length === 0);
    ok('lifted by whole octaves, so the interval survives the move', audible.notOctaves.length === 0);
    ok('none of them lifted into a whistle', audible.shrill.length === 0);
    ok(`and no two beds land on the same pitch (${audible.distinct} of ${audible.count})`,
      audible.distinct === audible.count);
    ok('the heat layer sits above the sub rather than under it', audible.heatUnderSub.length === 0);

    // ---- what actually gets built when one starts ----
    const built = await page.evaluate(() => {
      globalSettings.sfx = true; globalSettings.ambVol = 0.7; initAudio();
      startAmbience('bg_foundry.webp');
      const s = ambienceState();
      const n = ambienceNodes;
      const out = { layers: s.layers, biome: s.biome, bg: s.bg, sources: n ? n.sources.length : 0,
                    running: s.running, timer: !!(n && n.moteTimer),
                    // the wind filter is modulated, not fixed: something is connected to it
                    cutoff: n ? n.lp.frequency.value : null,
                    spec: n ? n.spec.cutoff : null };
      stopAmbience();
      out.afterStop = { running: !!ambienceNodes, biome: ambienceBiome, bg: ambienceBg,
                        heat: ambienceHeatLevel };
      return out;
    });
    ok(`a bed builds every layer it declares (${built.layers.join(', ')})`, built.layers.length >= 5);
    ok('the sub, the voice, the wind, the heat and the pulse', ['sub', 'voice', 'wind', 'heat', 'pulse']
      .every(l => built.layers.includes(l)));
    ok(`every one of them stoppable (${built.sources} sources)`, built.sources >= built.layers.length);
    ok('a mote is scheduled with it', built.timer);
    ok('the bed remembers the backdrop, not just the display name',
      built.bg === 'bg_foundry.webp' && built.biome === 'FOUNDRY');
    ok('and stopping it clears all of that', !built.afterStop.running && built.afterStop.biome === null
      && built.afterStop.bg === null && built.afterStop.heat === 0);

    // A mote is the room, not an effect. It goes on the ambience bus, and it must never write to
    // the effects log - a timer firing mid-suite would corrupt every assertion that reads it.
    const motes = await page.evaluate(() => {
      globalSettings.sfx = true; globalSettings.ambVol = 0.7; initAudio();
      startAmbience('bg_nest.webp');
      const before = ambienceMotes; sfxLog = [];
      for (let i = 0; i < 5; i++) playMote();
      const out = { fired: ambienceMotes - before, logged: sfxLog.length };
      stopAmbience();
      sfxLog = []; playMote();                       // with no bed running, nothing happens
      out.afterStop = ambienceMotes - before;
      out.loggedAfter = sfxLog.length;
      return out;
    });
    ok(`the room speaks up on its own (${motes.fired} fired)`, motes.fired === 5);
    ok('without writing a word to the effects log', motes.logged === 0 && motes.loggedAfter === 0);
    ok('and it goes quiet with the bed', motes.afterStop === 5);

    // ---- the bed thickens as momentum climbs ----
    // The heat level is arithmetic and reads back at once; whether the nodes actually follow it
    // is the part that can be quietly wired to nothing, so that is measured on the real
    // parameters after letting the audio clock run.
    const heat = await page.evaluate(async () => {
      globalSettings.sfx = true; globalSettings.ambVol = 0.7; initAudio();
      try { await audioCtx.resume(); } catch (e) {}
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 4; initiateCombat('RAIDERS', false);
      const level = m => { momentum = m; addMomentum(0); return ambienceHeatLevel; };
      const nodes = () => ({ gain: ambienceNodes.heatGain.gain.value,
                             pulse: ambienceNodes.pulse.frequency.value,
                             depth: ambienceNodes.pulseDepth.gain.value,
                             cutoff: ambienceNodes.lp.frequency.value });
      const settle = () => new Promise(r => setTimeout(r, 1100));
      const top = overdriveAt();
      const cold = level(0), floor = level(HEAT_FLOOR), half = level(Math.round((HEAT_FLOOR + top) / 2));
      const coldNodes = nodes();
      const full = level(top);
      await settle();
      const hotNodes = nodes();
      // ...and back down again, so the bed follows the fight in both directions
      level(0);
      await settle();
      const cooledNodes = nodes();
      // Out of combat the bed is the room again, however much momentum is banked.
      combatActive = false;
      const outOfFight = level(top);
      combatActive = true;
      stopAmbience();
      return { cold, floor, half, full, outOfFight, coldNodes, hotNodes, cooledNodes,
               at: HEAT_FLOOR, slow: PULSE_SLOW, fast: PULSE_FAST, spec: 0 };
    });
    ok(`a quiet fight sits at the room's own level (heat ${heat.cold})`, heat.cold === 0);
    ok(`and stays there until momentum passes ${heat.at}`, heat.floor === 0);
    ok(`then climbs (${[heat.cold, heat.floor, heat.half, heat.full].map(h => h.toFixed(2)).join(' > ')})`,
      heat.half > 0 && heat.full > heat.half);
    ok('reaching the top exactly at overdrive', Math.abs(heat.full - 1) < 0.001);
    ok(`the low layer really comes up (${heat.coldNodes.gain.toFixed(4)} > ${heat.hotNodes.gain.toFixed(4)})`,
      heat.hotNodes.gain > heat.coldNodes.gain + 0.01);
    ok(`the pulse under it really speeds up (${heat.coldNodes.pulse.toFixed(2)} > ${heat.hotNodes.pulse.toFixed(2)}Hz)`,
      heat.hotNodes.pulse > heat.coldNodes.pulse + 0.5);
    ok('from a swell to something nearer a heartbeat',
      Math.abs(heat.coldNodes.pulse - heat.slow) < 0.05 && Math.abs(heat.hotNodes.pulse - heat.fast) < 0.2);
    ok('and it is audible, not a silent modulation', heat.hotNodes.depth > 0.01);
    ok(`the wind opens with it (${Math.round(heat.coldNodes.cutoff)} > ${Math.round(heat.hotNodes.cutoff)}Hz)`,
      heat.hotNodes.cutoff > heat.coldNodes.cutoff);
    ok('the pulse is inaudible until there is something to pulse about', heat.coldNodes.depth < 0.005);
    ok(`spending it settles the bed back down (${heat.cooledNodes.gain.toFixed(4)})`,
      heat.cooledNodes.gain < heat.hotNodes.gain / 2);
    ok('and banked momentum outside a fight does not thicken anything', heat.outOfFight === 0);

    // The heat rides on the momentum bar, not on entering a node - so it must move on the same
    // call the bar does, from anywhere in the engine that grants momentum. Momentum carries
    // between fights in a node run, so a bed started with some banked starts warm, not cold:
    // walking into the next fight on a roll is exactly the state worth hearing.
    const live = await page.evaluate(() => {
      globalSettings.sfx = true; globalSettings.ambVol = 0.7; initAudio();
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 4; initiateCombat('RAIDERS', false);
      momentum = 0; addMomentum(0);
      const before = ambienceHeatLevel;
      addMomentum(HEAT_FLOOR + 40);
      const after = ambienceHeatLevel;
      const carried = momentum;
      initiateCombat('RAIDERS', false);       // a fresh bed, with the roll still banked
      const next = ambienceHeatLevel;
      // Walking in can move momentum on its own: initiateCombat ends on processTurn, and a
      // weather tick grants five. Measured at 24 fights in 250, so put it back before comparing.
      const drifted = momentum !== carried;
      momentum = carried; addMomentum(0);
      const matched = ambienceHeatLevel;
      momentum = 0; addMomentum(0);           // ...spent, and it is the room again
      const spent = ambienceHeatLevel;
      stopAmbience();
      return { before, after, next, spent, carried, matched, drifted };
    });
    ok('momentum granted mid-fight is heard at once', live.before === 0 && live.after > 0);
    ok('a fresh bed starts warm rather than cold when the roll is still banked',
      live.carried > 0 && live.next > 0);
    ok('at exactly the level that momentum buys, on the new bed as on the old',
      Math.abs(live.matched - live.after) < 0.001);
    ok('and spending it drops the bed back to the room', live.spent === 0);

    // Cycling the ambience level mid-fight used to restart the bed off the display name, which
    // is not a key in the table - so every restart silently landed on the fallback bed.
    const restart = await page.evaluate(() => {
      globalSettings.sfx = true; globalSettings.ambVol = 0.7; initAudio();
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 1; currentTier = 10; initiateCombat('BOSS', false);
      const before = { biome: ambienceBiome, bg: ambienceBg };
      let after = before, steps = 0;
      // step the level around the ring until it is back above zero
      do { cycleAmbience(); steps++; } while (globalSettings.ambVol <= 0 && steps < 8);
      after = { biome: ambienceBiome, bg: ambienceBg };
      stopAmbience();
      return { before, after, fallback: ambienceFor('bg_not_a_real_file.webp').name };
    });
    ok(`a boss arena keeps its own bed across a volume change (${restart.before.biome} > ${restart.after.biome})`,
      restart.after.biome === restart.before.biome && restart.after.bg === restart.before.bg);
    ok('rather than dropping onto the fallback', restart.before.biome !== restart.fallback);

    // ---- an impact says what it was worth and what happened to it ----
    const bands = await page.evaluate(() => {
      const at = share => { sfxLog = []; playImpact(share * 500, { maxHp: 500 }); return sfxLog[0].type; };
      const seen = {};
      for (let s = 0; s <= 1.001; s += 0.01) { const v = impactVoice(s); (seen[v] = seen[v] || []).push(Number(s.toFixed(2))); }
      return { scratch: at(0.01), light: at(0.08), solid: at(0.20), crushing: at(0.60),
               reachable: Object.keys(seen), widths: Object.fromEntries(
                 Object.entries(seen).map(([k, v]) => [k, v.length])) };
    });
    ok(`a scratch and a shell are different sounds (${bands.scratch} vs ${bands.crushing})`,
      bands.scratch !== bands.crushing);
    ok(`four bands, all of them reachable (${bands.reachable.join(', ')})`, bands.reachable.length === 4);
    ok('each with real width, so none of them is a rounding error',
      Object.values(bands.widths).every(w => w >= 4));
    ok('and they climb in order', bands.scratch !== bands.light && bands.light !== bands.solid
      && bands.solid !== bands.crushing);

    // A kill is a second event, not the tail of whichever hit happened to land last - and one of
    // yours going down does not sound like a raider dropping.
    const deaths = await page.evaluate(() => {
      const drop = isPlayer => { sfxLog = []; playImpact(80, { maxHp: 100, hp: 0, isPlayer }); return [...sfxLog]; };
      const alive = () => { sfxLog = []; playImpact(80, { maxHp: 100, hp: 20, isPlayer: false }); return [...sfxLog]; };
      return { foe: drop(false), hero: drop(true), survived: alive(), delay: DEATH_DELAY };
    });
    ok(`a hostile going down is heard (${deaths.foe.map(e => e.type).join(' > ')})`, deaths.foe.length === 2);
    ok(`one of your own sounds different (${deaths.hero.map(e => e.type).join(' > ')})`,
      deaths.hero[1].type !== deaths.foe[1].type);
    ok('a survivor gets no death sound at all', deaths.survived.length === 1);
    ok('and the death sits behind the impact rather than on top of it', deaths.delay > 0.05);

    // A unit that bled out or choked did it in silence, while one that took a blow got a sound.
    const statusDeath = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 4; initiateCombat('RAIDERS', false);
      const bleedOut = (isPlayer) => {
        const ent = activeEntities.find(e => e.isPlayer === isPlayer && e.hp > 0);
        ent.hp = 1; ent.maxHp = 100; ent.bleedingTurns = 3;
        sfxLog = []; applyTurnStartEffects(ent);
        return { down: ent.hp <= 0, played: sfxLog.map(e => e.type) };
      };
      const survives = () => {
        const ent = activeEntities.find(e => !e.isPlayer && e.hp > 0);
        ent.hp = 900; ent.maxHp = 1000; ent.bleedingTurns = 3;
        sfxLog = []; applyTurnStartEffects(ent);
        return { down: ent.hp <= 0, played: sfxLog.map(e => e.type) };
      };
      const foe = bleedOut(false), hero = bleedOut(true), lived = survives();
      stopAmbience();
      return { foe, hero, lived };
    });
    ok(`bleeding out is heard (${statusDeath.foe.played.join(' > ') || 'silence'})`,
      statusDeath.foe.down && statusDeath.foe.played.includes('downed'));
    ok('and one of your own bleeding out sounds like one of your own',
      statusDeath.hero.down && statusDeath.hero.played.includes('fallen'));
    ok('a unit that survives the tick makes no death sound',
      !statusDeath.lived.down && statusDeath.lived.played.length === 0);

    // ---- and none of it may throw with no audio to play through ----
    const headless = await page.evaluate(() => {
      const saved = audioCtx; let threw = null;
      try {
        audioCtx = null;
        startAmbience('bg_canyon.webp'); playMote(); scheduleMote(); ambienceHeat();
        addMomentum(30); stopAmbience(); ambienceState();
      } catch (e) { threw = e.message; }
      audioCtx = saved;
      return threw;
    });
    ok('the bed survives having no audio context at all', headless === null);

    const muted = await page.evaluate(() => {
      globalSettings.sfx = true; globalSettings.ambVol = 0;
      startAmbience('bg_canyon.webp');
      const s = ambienceState();
      globalSettings.ambVol = 0.7;
      return s;
    });
    ok('a silenced bed builds no layers and no timer', !muted.running && muted.layers.length === 0);
  }
};

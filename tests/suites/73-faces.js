// Four faces came back across the road; the Choir and the Carrion were the only two groups you
// could meet exclusively down the barrel of something. Each gets somebody standing slightly
// outside it who will talk - Sept, who sang in the congregation for nine years, and Grale, who
// keeps the swarm.
//
// Both trade in something the road can feel afterwards rather than in scrap: Sept's standing
// decides which way the word went about you, and Grale's reaches the sector map itself. That
// is the part that can rot quietly - a face whose favour changes nothing is a face who is only
// dialogue, and it looks identical from the outside.
//
// It also needed a gate. EVENT_POOL had no `when` at all, because until now every event was a
// stranger on an empty road; the Choir and the Carrion do not exist before sector 2, so both of
// these would have opened a first-sector run talking about factions nobody had met.
module.exports = {
  name: 'The faces on the road',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__run = (sector = 3) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
        currentSector = sector; currentTier = 5; scrap = 2000;
        materials = { parts: 6, chems: 6, tech: 6 };
        castState = {}; firedEvents = []; recentEvents = []; choirWord = 0;
        sectorMap = generateSectorMap(seededRng('c07:suite:' + sector));
        currentNodeId = null; clearedNodeIds = [];
      };
      window.__stand = (id, n) => { castOf(id).met = 2; castOf(id).standing = n; };
      window.__ev = title => [...EVENT_POOL, ...FOLLOWUPS].find(e => e.title === title);
    });

    // ---- the two of them exist, on the same rails as the other four ----
    const cast = await page.evaluate(() => {
      const ids = Object.keys(CAST);
      const shaped = Object.values(CAST).every(c => c.name && c.epithet && c.note);
      const ev = id => EVENT_POOL.filter(e => e.cast === id).length;
      const fu = id => FOLLOWUPS.filter(f => f.cast === id).length;
      return { ids, shaped, names: new Set(Object.values(CAST).map(c => c.name)).size,
               sept: { ev: ev('SEPT'), fu: fu('SEPT') }, grale: { ev: ev('GRALE'), fu: fu('GRALE') },
               // Nobody may be tagged onto content that does not exist.
               orphanEvents: EVENT_POOL.filter(e => e.cast && !CAST[e.cast]).map(e => e.title),
               orphanFollowups: FOLLOWUPS.filter(f => f.cast && !CAST[f.cast]).map(f => f.title),
               // And every face has to be reachable: one with no ordinary event never appears.
               unreachable: ids.filter(id => ev(id) === 0) };
    });
    ok(`${cast.ids.length} faces on the road, each named and described`,
      cast.ids.length === 6 && cast.shaped && cast.names === cast.ids.length);
    ok('the Choir has one you can talk to, with a thread of their own',
      cast.sept.ev === 1 && cast.sept.fu === 1);
    ok('and so does the Carrion', cast.grale.ev === 1 && cast.grale.fu === 1);
    ok(`every face can actually be met (${cast.unreachable.join(', ') || 'all reachable'})`,
      cast.unreachable.length === 0);
    ok('and nothing is tagged to somebody who does not exist',
      cast.orphanEvents.length === 0 && cast.orphanFollowups.length === 0);

    // ---- the gate ----
    const gate = await page.evaluate(() => {
      const sweep = sector => {
        __run(sector);
        const seen = new Set();
        for (let i = 0; i < 500; i++) { recentEvents = []; firedEvents = []; castState = {}; seen.add(pickEvent().title); }
        return seen;
      };
      const one = sweep(1), two = sweep(2);
      const gated = EVENT_POOL.filter(e => e.when).map(e => e.title);
      // An ordinary event with no condition is unaffected by any of this.
      const ungated = EVENT_POOL.filter(e => !e.when).map(e => e.title);
      return {
        gated, total: EVENT_POOL.length,
        atOne: gated.filter(t => one.has(t)), atTwo: gated.filter(t => two.has(t)),
        ungatedAtOne: ungated.filter(t => one.has(t)).length, ungatedTotal: ungated.length,
        // A pool where nothing is eligible falls back rather than dealing undefined.
        fallback: (() => {
          const kept = EVENT_POOL.map(e => e.when);
          EVENT_POOL.forEach(e => { e.when = () => false; });
          let got = null; try { __run(1); got = pickEvent(); } catch (e) { got = { title: 'THREW: ' + e.message }; }
          EVENT_POOL.forEach((e, i) => { if (kept[i]) e.when = kept[i]; else delete e.when; });
          return got && got.title;
        })()
      };
    });
    ok(`${gate.gated.length} of ${gate.total} events name a condition (${gate.gated.join(', ')})`,
      gate.gated.length === 2);
    ok('neither is dealt in a sector where its faction does not exist yet',
      gate.atOne.length === 0);
    ok('both are dealt once it does', gate.atTwo.length === 2);
    ok(`and the events that name no condition are dealt as they always were (${gate.ungatedAtOne}/${gate.ungatedTotal})`,
      gate.ungatedAtOne === gate.ungatedTotal);
    ok(`a pool with nothing eligible still deals something (${gate.fallback})`,
      !!gate.fallback && !/^THREW/.test(gate.fallback));

    // ---- Sept: the word, and which way it went ----
    const word = await page.evaluate(() => {
      const congregation = w => {
        choirWord = w; currentSector = 3; currentTier = 6;
        const n = Array.from({ length: 60 }, () => generateEnemies('CHOIR', 1, false, 1).length);
        return +(n.reduce((a, b) => a + b, 0) / n.length).toFixed(2);
      };
      const others = w => {
        choirWord = w; currentSector = 3; currentTier = 6;
        const n = Array.from({ length: 60 }, () => generateEnemies('RAIDERS', 1, false, 1).length);
        return +(n.reduce((a, b) => a + b, 0) / n.length).toFixed(2);
      };
      __run(3);
      const quiet = congregation(0), told = congregation(1), warned = congregation(-1);
      // The floor: the kindest possible word still leaves a fight.
      choirWord = -1; currentSector = 2; currentTier = 1;
      const floor = Math.min(...Array.from({ length: 40 }, () => generateEnemies('CHOIR', 1, false, 1).length));
      const raidersTold = others(1), raidersQuiet = others(0);
      choirWord = 0;
      return { quiet, told, warned, floor, raidersTold, raidersQuiet };
    });
    ok(`a congregation that was told you are coming is a body heavier (${word.quiet} -> ${word.told})`,
      word.told > word.quiet + 0.7);
    ok(`one that was sold to you is a body lighter (${word.quiet} -> ${word.warned})`,
      word.warned < word.quiet - 0.7);
    ok(`and it never empties a road out (smallest congregation ${word.floor})`, word.floor >= 2);
    ok(`nobody else on the road hears any of it (${word.raidersQuiet} -> ${word.raidersTold})`,
      Math.abs(word.raidersTold - word.raidersQuiet) < 0.7);

    // ---- Sept's thread turns out by its standing ----
    const sept = await page.evaluate(() => {
      const fu = __ev('WHAT SEPT TOLD THEM');
      const at = n => { __run(3); __stand('SEPT', n); return { due: fu.when(), desc: fu.desc(), labels: fu.choices().map(c => c.label) }; };
      const cold = (() => { __run(3); __stand('SEPT', 0); return fu.when(); })();
      const warm = at(3), bad = at(-3);
      // The warm branch thins them; the bad branch is the one that stacks them up.
      __run(3); __stand('SEPT', 3); fu.choices()[0].execute();
      const afterWarm = choirWord;
      __run(3); __stand('SEPT', -3); fu.choices()[2].execute();
      const afterBad = choirWord;
      // And the silence can be bought back to nothing.
      __run(3); __stand('SEPT', -3); choirWord = 1; scrap = 900;
      const bought = fu.choices()[0].execute();
      const afterPaid = choirWord;
      choirWord = 0;
      return { cold, warm, bad, afterWarm, afterBad, afterPaid, bought: bought.length > 0 };
    });
    ok('the thread does not come due on somebody you barely know', sept.cold === false);
    ok('it comes due both warm and cold, and reads differently either way',
      sept.warm.desc !== sept.bad.desc && sept.warm.labels.join() !== sept.bad.labels.join());
    ok(`kept faith and half the congregation is elsewhere (word ${sept.afterWarm})`, sept.afterWarm === -1);
    ok(`sold out and every Choir road is heavier (word ${sept.afterBad})`, sept.afterBad === 1);
    ok('and the silence can be bought back to nothing', sept.afterPaid === 0 && sept.bought);

    // ---- the word rides the run, and only the run ----
    const kept = await page.evaluate(async () => {
      __run(3); choirWord = 1; saveGameState();
      choirWord = 0; loadGameState();
      const back = choirWord;
      const raw = JSON.parse(Store.get(BASE_SAVE_KEY + currentSlot));
      raw.choirWord = 99; Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw)); loadGameState();
      const clamped = choirWord;
      delete raw.choirWord; Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw)); loadGameState();
      const legacy = choirWord;
      choirWord = 1; currentSlot = 1; confirmNewGame(1.0);
      const fresh = choirWord;
      return { back, clamped, legacy, fresh };
    });
    ok('the word rides the save', kept.back === 1);
    ok('a tampered one clamps to something a road can field', kept.clamped === 1);
    ok('a save written before it loads quiet', kept.legacy === 0);
    ok('and it does not follow the squad into the next expedition', kept.fresh === 0);

    // ---- Grale: the leash reaches the map ----
    const leash = await page.evaluate(() => {
      const seed = () => {
        __run(3);
        // Guarantee something to act on either way rather than trusting the roll.
        const fights = sectorMap.nodes.filter(n => FIGHT_NODES.includes(n.type) && n.type !== 'BOSS');
        fights[0].type = 'CARRION'; fights[1].type = 'RAIDERS';
        return fights;
      };
      seed();
      const before = sectorMap.nodes.filter(n => n.type === 'CARRION').length;
      const off = callOffCarrion();
      const afterOff = sectorMap.nodes.filter(n => n.type === 'CARRION').length;
      const on = setCarrionOn();
      const afterOn = sectorMap.nodes.filter(n => n.type === 'CARRION').length;

      // What is behind the squad is not on offer, and neither is the commander.
      seed();
      clearedNodeIds = sectorMap.nodes.filter(n => n.type === 'CARRION').map(n => n.id);
      const noneBehind = openCarrionNodes().length;
      // The commander's arena is not a faction node, so it is out because of what nestTargets
      // draws from rather than because of a clause naming it.
      const marksSafe = nestTargets().every(n => FIGHT_NODES.includes(n.type) && n.type !== 'BOSS'
        && n.type !== 'CARRION' && !clearedNodeIds.includes(n.id));
      const bossExists = sectorMap.nodes.some(n => n.type === 'BOSS');
      const currentSafe = (() => {
        seed();
        const mine = sectorMap.nodes.find(n => n.type === 'CARRION');
        currentNodeId = mine.id;
        return !openCarrionNodes().some(n => n.id === mine.id) && !nestTargets().some(n => n.id === mine.id);
      })();

      // A node that changes hands cannot keep promises made about the old tenant. Exactly one
      // road is left to the swarm, so the one that gets swapped is the one that was decorated -
      // callOffCarrion picks at random among whatever is open, and decorating a different node
      // than the one it happens to take is a test that passes by not looking.
      seed();
      sectorMap.nodes.filter(n => n.type === 'CARRION').forEach(n => { n.type = 'MECH'; });
      const mark = sectorMap.nodes.find(n => FIGHT_NODES.includes(n.type) && n.type !== 'BOSS'
        && !clearedNodeIds.includes(n.id) && n.id !== currentNodeId);
      mark.type = 'CARRION';
      mark.formation = 'ANY_FORMATION'; mark.weather = 'SANDSTORM'; mark.terrain = 'NEST';
      const swapped = callOffCarrion();
      const tookTheMarked = swapped && swapped.id === mark.id;
      // 'CLEAR' is a sky, and a road under it is already telling the truth about itself.
      const okWeather = w => !w || w === 'CLEAR' || w === FACTIONS[swapped.type].weather;
      const cleaned = tookTheMarked && !swapped.formation && okWeather(swapped.weather)
        && (!swapped.terrain || (FACTIONS[swapped.type].ground || []).includes(swapped.terrain));
      return { before, off: off && off.type, afterOff, on: on && on.type, afterOn,
               noneBehind, marksSafe, bossExists, currentSafe, cleaned, tookTheMarked,
               swappedTo: swapped && swapped.type,
               left: swapped && { f: swapped.formation, w: swapped.weather, t: swapped.terrain } };
    });
    ok(`calling them off takes a road back off the swarm (${leash.before} -> ${leash.afterOff})`,
      leash.afterOff === leash.before - 1 && leash.off !== 'CARRION');
    ok(`putting them on somebody else gives it to them (${leash.afterOff} -> ${leash.afterOn})`,
      leash.on === 'CARRION' && leash.afterOn === leash.afterOff + 1);
    ok('a road already walked is not on offer, and neither is the one under your feet',
      leash.noneBehind === 0 && leash.currentSafe);
    ok('the commander is never handed to the swarm, and there is one on the map to not hand over',
      leash.marksSafe && leash.bossExists);
    ok(`a road that changes hands drops the old tenant's promises (now ${leash.swappedTo}: ${JSON.stringify(leash.left)})`,
      leash.tookTheMarked && leash.cleaned);

    // ---- and the map keeps it ----
    const rides = await page.evaluate(() => {
      __run(3);
      const fights = sectorMap.nodes.filter(n => FIGHT_NODES.includes(n.type) && n.type !== 'BOSS');
      fights[0].type = 'CARRION';
      const target = callOffCarrion();
      const id = target.id, became = target.type;
      saveGameState();
      sectorMap = null; loadGameState();
      const after = sectorMap.nodes.find(n => n.id === id);
      return { became, reloaded: after && after.type };
    });
    ok(`what the handler did to the map survives the session (${rides.became} on both sides)`,
      rides.reloaded === rides.became);

    // ---- Grale's thread, both ways, and it never offers what it cannot do ----
    const grale = await page.evaluate(() => {
      const fu = __ev('GRALE CALLS THEM');
      __run(3); __stand('GRALE', 0);
      const cold = fu.when();
      __run(3); __stand('GRALE', 3);
      const fights = sectorMap.nodes.filter(n => FIGHT_NODES.includes(n.type) && n.type !== 'BOSS');
      fights.forEach(n => { n.type = 'RAIDERS'; });
      const noSwarm = fu.choices()[0].canAfford();     // nothing of theirs to call off
      fights[0].type = 'CARRION';
      const hasSwarm = fu.choices()[0].canAfford();
      // And with the whole sector already theirs there is nobody left to set them on.
      fights.forEach(n => { n.type = 'CARRION'; });
      const noMarks = fu.choices()[1].canAfford();
      __run(3); __stand('GRALE', 3); const warm = fu.choices().map(c => c.label);
      __run(3); __stand('GRALE', -3); const bad = fu.choices().map(c => c.label);
      return { cold, noSwarm, hasSwarm, noMarks, warm, bad, desc: fu.desc() };
    });
    ok('her thread does not come due on somebody she barely knows', grale.cold === false);
    ok('and reads differently warm and cold', grale.warm.join() !== grale.bad.join());
    ok('calling them off is not offered when nothing ahead is theirs',
      grale.noSwarm === false && grale.hasSwarm === true);
    ok('and setting them on is not offered when everything ahead already is', grale.noMarks === false);

    // ---- both of them play, end to end ----
    const played = await page.evaluate(() => {
      const play = (title, standing, idx) => {
        __run(3);
        const ev = __ev(title);
        if (standing !== null) __stand(ev.cast, standing);
        initiateEvent(ev);
        const shown = { title: document.getElementById('event-title').innerText,
                        tag: document.getElementById('event-cast').innerText,
                        buttons: document.querySelectorAll('[data-action="event-choice"]').length };
        document.querySelectorAll('[data-action="event-choice"]')[idx].click();
        return { ...shown,
                 outcome: document.getElementById('event-choices').innerText,
                 stillHere: getComputedStyle(document.getElementById('screen-event')).display,
                 standing: castStanding(ev.cast) };
      };
      return { sept: play('THE ONE WHO LEFT', null, 0),
               grale: play("THE HANDLER'S TOLL", null, 0),
               septThread: play('WHAT SEPT TOLD THEM', 3, 0),
               graleThread: play('GRALE CALLS THEM', 3, 2) };
    });
    ok(`Sept's road plays through (${played.sept.buttons} choices, standing ${played.sept.standing})`,
      played.sept.title === 'THE ONE WHO LEFT' && /SEPT/.test(played.sept.tag)
      && played.sept.outcome.length > 20 && played.sept.standing > 0);
    ok(`Grale's toll plays through (${played.grale.buttons} choices, standing ${played.grale.standing})`,
      played.grale.title === "THE HANDLER'S TOLL" && /GRALE/.test(played.grale.tag)
      && played.grale.outcome.length > 20 && played.grale.standing > 0);
    ok('both threads play through too',
      played.septThread.outcome.length > 20 && played.graleThread.outcome.length > 20);
    ok('and none of them throws the player off the screen before they have read it',
      [played.sept, played.grale, played.septThread, played.graleThread].every(p => p.stillHere === 'flex'));

    // ---- the manual ----
    const codex = await page.evaluate(() => {
      const e = CODEX.find(x => x.id === 'THE_FACES');
      const text = e ? e.body().join(' ') : '';
      return { has: !!e,
               all: Object.values(CAST).every(c => text.includes(c.name) && text.includes(c.note)),
               says: /congregation/i.test(text) && /swarm/i.test(text) };
    });
    ok('the manual has a page for the faces', codex.has);
    ok('naming every one of them', codex.all);
    ok('and saying what the two new ones trade in', codex.says);
  }
};

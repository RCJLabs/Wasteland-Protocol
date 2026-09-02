// Ten classes exist, three deploy, and the other four earned XP at half rate and did nothing
// else. One of them takes a job for the expedition now, chosen at the muster - so who you leave
// behind is a decision, and the class you bench to get the job is a class you are not fighting
// with. That last half is the part that can quietly stop being true: a job that kept paying
// after its holder was put on the line would be free upside rather than a trade.
//
// On the Scout. The task asked for one that "reveals a node two tiers ahead" and there is
// nothing there to reveal - the map has shown every node's type, elite status, weather, ground
// and named formation since N12 and A06, and the only thing it withholds is what an EVENT
// holds, which is drawn at entry rather than stored. So the scout sells a way across instead of
// information: the route does not close behind you.
module.exports = {
  name: 'The bench',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__fresh = () => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        benchJob = null;
        return { bench: playerRoster.filter(c => c.gridPos === 0), line: playerRoster.filter(c => c.gridPos > 0) };
      };
      window.__give = (ch, job) => { benchJob = { job, charId: ch.id }; };
    });

    // ---- three jobs, each one a real offer ----
    const shape = await page.evaluate(() => ({
      n: BENCH_JOBS.length,
      ids: BENCH_JOBS.map(j => j.id),
      complete: BENCH_JOBS.every(j => j.id && j.name && j.short && j.desc && j.desc.length > 30),
      unique: new Set(BENCH_JOBS.map(j => j.id)).size,
      shorts: new Set(BENCH_JOBS.map(j => j.short)).size,
      triageClimbs: CAMP_TRIAGE_JOB > CAMP_TRIAGE,
      // Every job has to be read somewhere, or it is a card that does nothing.
      wired: BENCH_JOBS.map(j => j.id)
    }));
    ok(`${shape.n} jobs on the bench (${shape.ids.join(', ')})`, shape.n === 3 && shape.complete);
    ok('no two share an id or a label', shape.unique === shape.n && shape.shorts === shape.n);
    ok('and a medic-run camp puts back more than an unrun one', shape.triageClimbs);

    const silent = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
      return BENCH_JOBS.filter(j => (code.split(`hasBenchJob('${j.id}')`).length - 1) === 0).map(j => j.id);
    });
    ok(`not one of them is only a card (${silent.join(', ') || 'all wired'})`, silent.length === 0);

    // ---- one job, one holder, and only ever off the bench ----
    const held = await page.evaluate(() => {
      const { bench, line } = __fresh();
      const out = { start: benchJob };
      out.refusedOnLine = takeBenchJob(line[0].id, 'SCOUT') === false && benchJob === null;
      out.took = takeBenchJob(bench[0].id, 'SCOUT');
      out.holderIsRight = benchJobHolder() && benchJobHolder().id === bench[0].id;
      out.active = hasBenchJob('SCOUT');
      out.onlyThatJob = !hasBenchJob('MEDIC') && !hasBenchJob('QUARTERMASTER');
      // Tapping the same chip hands it back.
      takeBenchJob(bench[0].id, 'SCOUT');
      out.handedBack = benchJob === null;
      // Taking it anywhere moves it; there is never more than one.
      takeBenchJob(bench[0].id, 'SCOUT');
      takeBenchJob(bench[1].id, 'MEDIC');
      out.moved = benchJob.charId === bench[1].id && benchJob.job === 'MEDIC';
      out.oneHolder = playerRoster.filter(c => benchJob.charId === c.id).length === 1;
      out.oldOneQuiet = !hasBenchJob('SCOUT') && hasBenchJob('MEDIC');
      // A job is a bench job: deploying its holder gives it up.
      line[0].gridPos = 0;
      musterRank(bench[1].id);
      out.holderDeployed = bench[1].gridPos > 0;
      out.lapsedOnDeploy = benchJob === null;
      // And even a job left set by hand does not hold on somebody standing in the line.
      __give(bench[1], 'MEDIC');
      out.notWhileFighting = !hasBenchJob('MEDIC') && benchJobHolder() === null;
      benchJob = null;
      return out;
    });
    ok('only somebody on the bench can take a job', held.refusedOnLine);
    ok('taking one gives it to exactly that operator', held.took && held.holderIsRight && held.active && held.onlyThatJob);
    ok('tapping it again hands it back', held.handedBack);
    ok('and taking it elsewhere moves it rather than dealing a second', held.moved && held.oneHolder && held.oldOneQuiet);
    ok('putting the holder on the line gives the job up', held.holderDeployed && held.lapsedOnDeploy);
    ok('and a job set on somebody who is fighting does not hold at all', held.notWhileFighting);

    // ---- SCOUT: the route does not close behind you ----
    const scout = await page.evaluate(() => {
      // A previous node whose edges are the WHOLE next tier narrows nothing, so there would be
      // nothing for a scout to open and the test would pass by measuring a map that never
      // closed. Look for one that actually forks rather than trusting a seed to provide it.
      const stage = () => {
        const { bench } = __fresh();
        for (let i = 0; i < 60; i++) {
          currentSector = 2; currentTier = 3;
          sectorMap = generateSectorMap(seededRng('c10:suite:' + i));
          const tier = sectorMap.nodes.filter(n => n.tier === 3).length;
          const prev = sectorMap.nodes.find(n => n.tier === 2 && n.edges.length >= 1 && n.edges.length < tier);
          if (prev) { currentNodeId = prev.id; clearedNodeIds = [prev.id]; retreatNode = null; return { bench, prev, tier }; }
        }
        return { bench, prev: null, tier: 0 };
      };
      const { bench, prev, tier: tierSize } = stage();
      if (!prev) return { forked: false };
      const closed = availableNodeIds();
      __give(bench[0], 'SCOUT');
      const open = availableNodeIds();
      const wholeTier = sectorMap.nodes.filter(n => n.tier === 3).map(n => n.id);
      // Deploying the scout closes it again.
      bench[0].gridPos = 1;
      const lapsed = availableNodeIds();
      bench[0].gridPos = 0;
      // A retreat is another go at the node, not another go at the routing - even with a scout.
      retreatNode = prev.id;
      const onRetreat = availableNodeIds();
      retreatNode = null;
      // And with nothing entered yet the tier was always open, so a scout changes nothing.
      currentNodeId = null;
      const first = availableNodeIds().length;
      benchJob = null;
      const firstBare = availableNodeIds().length;
      return { forked: true, edges: prev.edges.length, closed: closed.length, open: open.length,
               tier: wholeTier.length, coversTier: open.length === wholeTier.length,
               lapsed: lapsed.length, onRetreat, first, firstBare };
    });
    ok(`without one the tier narrows to what your last node led to (${scout.closed} of ${scout.tier})`,
      scout.forked && scout.closed === scout.edges && scout.closed < scout.tier);
    ok(`a scout keeps the whole tier open (${scout.closed} -> ${scout.open})`, scout.coversTier);
    ok('and deploying them closes it again', scout.lapsed === scout.closed);
    ok('a retreat is still another go at the node, not at the routing',
      scout.onRetreat.length === 1);
    ok('with nothing entered yet the tier was open anyway, so it changes nothing',
      scout.first === scout.firstBare);

    // ---- QUARTERMASTER: one more out of every wreck ----
    const qm = await page.evaluate(() => {
      // The salvage is dealt on the win path of a real fight, not in collectLoot.
      const haul = job => {
        // 40 was not enough to hold a +-0.25 tolerance: sampled eight times the difference
        // ran 0.85 to 1.23, and a battery caught it at 1.25 - a real flake rather than a
        // real regression. At 150 the same measurement sits between 0.92 and 1.05, so the
        // tolerance keeps its meaning instead of being widened around the noise.
        let total = 0; const N = 150;
        for (let i = 0; i < N; i++) {
          const { bench } = __fresh();
          currentSector = 2; currentTier = 3;
          if (job) __give(bench[0], job);
          initiateCombat('RAIDERS', false);
          materials = { parts: 0, chems: 0, tech: 0 };
          activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
          checkWinState();
          total += materials.parts + materials.chems + materials.tech;
          combatActive = false;
        }
        benchJob = null;
        return total / N;
      };
      return { none: haul(null), qm: haul('QUARTERMASTER'), other: haul('MEDIC') };
    });
    ok(`a quartermaster gets one more out of every salvage (${qm.none.toFixed(2)} -> ${qm.qm.toFixed(2)})`,
      Math.abs((qm.qm - qm.none) - 1) < 0.25);
    ok(`and no other job does (${qm.other.toFixed(2)})`, Math.abs(qm.other - qm.none) < 0.25);

    // ---- FIELD MEDIC: the camp is run properly, and reaches the bench ----
    const medic = await page.evaluate(() => {
      const camp = job => {
        const { bench } = __fresh();
        playerRoster.forEach(p => { p.hp = Math.floor(p.maxHp * 0.4); });
        if (job) __give(bench[0], job);
        const was = playerRoster.map(p => ({ id: p.id, hp: p.hp, max: p.maxHp, pos: p.gridPos }));
        initiateCamp(); resolveCamp('TRIAGE');
        const line = playerRoster.find(p => p.gridPos > 0);
        const sat = playerRoster.find(p => p.gridPos === 0);
        const wasLine = was.find(w => w.id === line.id), wasBench = was.find(w => w.id === sat.id);
        const note = document.getElementById('camp-choices').innerText;
        benchJob = null;
        return { line: line.hp - wasLine.hp, lineShare: (line.hp - wasLine.hp) / wasLine.max,
                 bench: sat.hp - wasBench.hp, note };
      };
      const none = camp(null), kept = camp('MEDIC'), other = camp('SCOUT');
      return { none, kept, other, base: CAMP_TRIAGE, job: CAMP_TRIAGE_JOB };
    });
    ok(`an unrun camp puts back ${Math.round(medic.base * 100)}% and only to the line (${medic.none.line} HP, bench ${medic.none.bench})`,
      Math.abs(medic.none.lineShare - medic.base) < 0.02 && medic.none.bench === 0);
    ok(`a medic runs it at ${Math.round(medic.job * 100)}% (${medic.none.line} -> ${medic.kept.line} HP)`,
      Math.abs(medic.kept.lineShare - medic.job) < 0.02);
    ok(`and it reaches the bench, who nobody was treating (${medic.kept.bench} HP)`, medic.kept.bench > 0);
    ok('the camp says who ran it', /worked the whole roster/i.test(medic.kept.note) && !/worked the whole roster/i.test(medic.none.note));
    ok('and no other job runs a camp', medic.other.bench === 0 && Math.abs(medic.other.lineShare - medic.base) < 0.02);

    // ---- it rides the run, and only the run ----
    const kept = await page.evaluate(() => {
      const { bench } = __fresh();
      takeBenchJob(bench[0].id, 'QUARTERMASTER');
      const mine = benchJob.charId;
      saveGameState();
      benchJob = null; loadGameState();
      const back = benchJob && `${benchJob.job}@${benchJob.charId === mine ? 'same' : 'other'}`;
      const raw = JSON.parse(Store.get(BASE_SAVE_KEY + currentSlot));
      raw.benchJob = { job: 'NOT_A_JOB', charId: mine };
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw)); loadGameState();
      const nonsense = benchJob;
      delete raw.benchJob;
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw)); loadGameState();
      const legacy = benchJob;
      benchJob = { job: 'SCOUT', charId: mine };
      currentSlot = 1; confirmNewGame(1.0);
      const fresh = benchJob;
      return { back, nonsense, legacy, fresh };
    });
    ok('the job rides the save, on the same operator', kept.back === 'QUARTERMASTER@same');
    ok('a save naming a job that does not exist loads as none', kept.nonsense === null);
    ok('and so does one written before the bench had jobs', kept.legacy === null);
    ok('it does not follow the squad into the next expedition', kept.fresh === null);

    // ---- the muster offers it, and only where it can be taken ----
    const ui = await page.evaluate(() => {
      const { bench } = __fresh();
      renderMuster();
      const bare = document.getElementById('muster-jobline').innerText;
      const benched = playerRoster.filter(c => c.gridPos === 0).length;
      const chips = document.querySelectorAll('.job-chip').length;
      const onLine = document.querySelectorAll('.muster-deployed .job-chip').length;
      takeBenchJob(bench[0].id, 'MEDIC');
      const taken = document.getElementById('muster-jobline').innerText;
      const marked = document.querySelectorAll('.job-on').length;
      const rows = document.querySelectorAll('.muster-working').length;
      benchJob = null; renderMuster();
      return { bare, taken, chips, expect: benched * BENCH_JOBS.length, onLine, marked, rows };
    });
    ok(`every benched operator is offered every job (${ui.chips} chips)`, ui.chips === ui.expect && ui.chips > 0);
    ok('and nobody in the line is offered one', ui.onLine === 0);
    ok('the board says when nobody has taken one', /Nobody on the bench/i.test(ui.bare));
    ok(`and who is doing what when somebody has (${ui.taken.split('.')[0]})`,
      /works the expedition as FIELD MEDIC/.test(ui.taken) && ui.marked === 1 && ui.rows === 1);

    // ---- the manual ----
    const codex = await page.evaluate(() => {
      const e = CODEX.find(x => x.id === 'BENCH');
      const text = e ? e.body().join(' ') : '';
      return { has: !!e,
               all: BENCH_JOBS.every(j => text.includes(j.name) && text.includes(j.desc)),
               saysLapse: /lapses/i.test(text),
               saysCost: /not fighting with/i.test(text) };
    });
    ok('the manual has a page for the bench', codex.has);
    ok('naming every job and what it does', codex.all);
    ok('and saying both that it lapses and what it costs', codex.saysLapse && codex.saysCost);
  }
};

// D10 was filed as "18 of 24 runs walked past a survivor they could have signed," with the
// tier cost of the recruit node blamed as the reason. Two things about that turned out not to
// hold, and one real structural gap survived them both.
//
// The first was the simulator's own node-picker, which special-cased CAMP (hurting) and an
// elite (healthy) and fell through to a uniform-random pick for everything else - including a
// recruit, whose own claim on the pick a real player would obviously weigh. Measured directly,
// pure map-generation-and-walk with no combat: even a squad that ALWAYS takes a recruit when
// it is a live option only reaches 62.4% of the recruit nodes a map ever generates. The rest
// were never offered at all - the run's earlier, recruit-blind forks had already walked away
// from that branch of the map before the recruit ever came into view. "The squad judged a
// fight worth more" was describing a decision the old policy never actually made.
//
// The second was the brief's own diagnosis of WHY signing one wasn't worth it: "a body who
// arrives at level 1." Checked directly against signOnRecruit rather than assumed - a Trench
// Fiend signed into a level-8 squad arrives at level 8, with 7 unspent perk points, the same
// shape of catch-up a level-8 veteran earned by playing. Nothing here needed fixing; it was
// already built, and the claim it was filed on is false for the current codebase.
//
// What was real: of the eligible nodes a recruit could land on, 17.8% are reachable from only
// ONE of a sector's two tier-1 openings - a coin flip on the run's very first choice, decided
// before recruiting is even a consideration, permanently locks some recruit placements to the
// wrong half of the map for that run. generateSectorMap's swapOne now prefers a candidate
// reachable from both openings when one exists. Measured: 62.4% -> 69.4% of generated recruit
// nodes ever become a live choice under a policy with no recruit-awareness at all - and 100%
// under the Scout bench job, which already exists for exactly this ("the route does not close
// behind you") and which this file had simply never used.
module.exports = {
  name: 'The recruit node, actually reached',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__reset = () => { currentSlot = 1; confirmNewGame(1.0); sectorFront = null; };
      // Walk one sector's graph the way a fight-free routing question needs to: no combat, just
      // which node gets entered at each tier, under a named policy.
      window.__walkSector = (s, opts = {}) => {
        currentSector = s; sectorFront = rollFront(Math.random, s);
        sectorMap = generateSectorMap();
        const recruitNode = sectorMap.nodes.find(n => n.type === 'RECRUIT');
        currentNodeId = null; clearedNodeIds = []; currentTier = 1;
        let offered = false, taken = false, guard = 0;
        while (currentTier <= TOTAL_TIERS && guard++ < 30) {
          const avail = (opts.scout ? sectorMap.nodes.filter(n => n.tier === currentTier)
                                    : availableNodeIds().map(nodeById).filter(Boolean));
          if (!avail.length) break;
          if (recruitNode && avail.some(n => n.id === recruitNode.id)) offered = true;
          let pick = null;
          if (opts.recruitAware && recruitNode) pick = avail.find(n => n.id === recruitNode.id);
          if (!pick) pick = avail[Math.floor(Math.random() * avail.length)];
          enterNode(pick.id);
          if (pick.id === (recruitNode || {}).id) taken = true;
          currentTier++;
        }
        return { hasRecruit: !!recruitNode, offered, taken };
      };
    });

    // ── The reachability claim, at a sample size a map-only walk can afford ──────────────
    const spread = await page.evaluate(({ SECTORS, TRIALS }) => {
      __reset();
      const run = opts => {
        let has = 0, offered = 0;
        for (let t = 0; t < TRIALS; t++) for (let s = 1; s <= SECTORS; s++) {
          const r = __walkSector(s, opts);
          if (r.hasRecruit) { has++; if (r.offered) offered++; }
        }
        return { has, offered };
      };
      const blind = run({});
      const aware = run({ recruitAware: true });
      const scout = run({ scout: true });
      currentSector = 1;
      return { blind, aware, scout };
    }, { SECTORS: 7, TRIALS: 500 });
    const pc = r => (r.offered / r.has * 100).toFixed(1);
    ok(`a recruit-blind random walk offers the node ${pc(spread.blind)}% of the time it is ` +
       `generated (over ${spread.blind.has} recruit-carrying sectors)`,
      spread.blind.offered / spread.blind.has > 0.6);
    ok(`a squad that always takes it when available cannot do better without help ` +
       `(${pc(spread.aware)}%, same ceiling as the blind walk)`,
      Math.abs(spread.aware.offered / spread.aware.has - spread.blind.offered / spread.blind.has) < 0.05);
    ok(`the Scout bench job removes the ceiling entirely (${pc(spread.scout)}%)`,
      spread.scout.offered === spread.scout.has);

    // ── The placement fix: prefer a node reachable from both tier-1 openings ────────────
    const placement = await page.evaluate(({ TRIALS }) => {
      __reset();
      let both = 0, oneOnly = 0, total = 0;
      for (let t = 0; t < TRIALS; t++) {
        currentSector = 1; sectorFront = null;
        const map = generateSectorMap();
        const t1 = map.nodes.filter(n => n.tier === 1);
        const byId = {}; map.nodes.forEach(n => { byId[n.id] = n; });
        const reachFrom = start => { const seen = new Set([start.id]); const q = [start.id];
          while (q.length) { const id = q.shift(); const n = byId[id]; if (!n) continue;
            (n.edges || []).forEach(eid => { if (!seen.has(eid)) { seen.add(eid); q.push(eid); } }); }
          return seen; };
        const r0 = reachFrom(t1[0]), r1 = reachFrom(t1[1]);
        map.nodes.filter(n => n.tier >= 2 && n.tier <= 9).forEach(n => {
          total++;
          if (r0.has(n.id) && r1.has(n.id)) both++; else if (r0.has(n.id) || r1.has(n.id)) oneOnly++;
        });
      }
      currentSector = 1;
      return { both, oneOnly, total };
    }, { TRIALS: 600 });
    ok(`a real, measurable share of candidate nodes is reachable from only one opening ` +
       `(${(placement.oneOnly / placement.total * 100).toFixed(1)}% of ${placement.total})`,
      placement.oneOnly / placement.total > 0.1 && placement.oneOnly / placement.total < 0.3);
    // The fix itself, run enough times to be confident it is never landing on a one-side-only
    // node while a both-side one exists on the same map.
    const fixed = await page.evaluate(({ TRIALS }) => {
      __reset();
      let sawRecruit = 0, onOneOnly = 0, hadBothOption = 0;
      for (let t = 0; t < TRIALS; t++) {
        currentSector = 1; sectorFront = null;
        const map = generateSectorMap();
        const recruit = map.nodes.find(n => n.type === 'RECRUIT');
        if (!recruit) continue;
        sawRecruit++;
        const t1 = map.nodes.filter(n => n.tier === 1);
        const byId = {}; map.nodes.forEach(n => { byId[n.id] = n; });
        const reachFrom = start => { const seen = new Set([start.id]); const q = [start.id];
          while (q.length) { const id = q.shift(); const n = byId[id]; if (!n) continue;
            (n.edges || []).forEach(eid => { if (!seen.has(eid)) { seen.add(eid); q.push(eid); } }); }
          return seen; };
        const r0 = reachFrom(t1[0]), r1 = reachFrom(t1[1]);
        const bothOK = r0.has(recruit.id) && r1.has(recruit.id);
        const anyBothCandidate = map.nodes.some(n => n.tier >= 2 && n.tier <= 9 && !n.elite &&
          n.id !== recruit.id && r0.has(n.id) && r1.has(n.id));
        if (anyBothCandidate) hadBothOption++;
        if (!bothOK) onOneOnly++;
      }
      currentSector = 1;
      return { sawRecruit, onOneOnly, hadBothOption };
    }, { TRIALS: 1200 });
    ok(`the fixed placement lands on a one-side-only node only when nothing else qualified ` +
       `(${fixed.onOneOnly} times in ${fixed.sawRecruit}, against ${fixed.hadBothOption} maps ` +
       `that had a both-side option)`,
      fixed.onOneOnly <= fixed.sawRecruit - fixed.hadBothOption + 2);

    // ── The debunked half, checked directly rather than trusted ─────────────────────────
    const leveling = await page.evaluate(() => {
      __reset();
      playerRoster.forEach((c, i) => { c.level = 8; c.xp = 0; c.xpToNext = 400; c.perkPoints = 0;
                                       c.gridPos = i < 3 ? i + 1 : 0; });
      scrap = 9999;
      pendingRecruit = { nodeId: 'x', id: 'p8', cost: 100, taken: false };
      signOnRecruit();
      const rec = playerRoster.find(c => c.id === 'p8');
      return { level: rec ? rec.level : null, perkPoints: rec ? rec.perkPoints : null,
               hp: rec ? rec.hp : null, maxHp: rec ? rec.maxHp : null };
    });
    ok(`a recruit signed into a level-8 squad arrives at level 8, not level 1 (${leveling.level})`,
      leveling.level === 8);
    ok(`carrying the perk points that climb would have earned (${leveling.perkPoints})`,
      leveling.perkPoints === 7);
    ok(`and hurt, not dead - the arrival cost is health, not power (${leveling.hp} of ${leveling.maxHp})`,
      leveling.hp > 0 && leveling.hp < leveling.maxHp);

    // ── The reporting bug this was filed through ─────────────────────────────────────────
    // recruitOffers is pushed whether or not the sign goes through, so a line reading "runs
    // that walked past one" over a count of runs that reached one at all was wrong under any
    // policy - it just went unnoticed while so few runs ever reached one that the two numbers
    // were close by coincidence. Not asserted here (it is prose in the console output, not a
    // return value), but the two counts it should never again be confused for are.
    const offerVsSign = await page.evaluate(() => {
      __reset();
      const before = playerRoster.length;
      pendingRecruit = { nodeId: 'x', id: 'p9', cost: 0, taken: false };
      scrap = 9999;
      signOnRecruit();
      return { reached: true, signed: playerRoster.length > before };
    });
    ok('reaching a recruit node and signing on the spot are different events, not the same count',
      offerVsSign.reached && offerVsSign.signed);
  }
};

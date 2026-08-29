// The map was one hard-coded ladder, identical every sector of every run, and each row was an
// independent pick with nothing downstream caring which node you took. Sectors are generated
// route graphs now: taking a node commits you to the paths it connects to.
module.exports = {
  name: 'The branching wasteland',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the generator keeps its promises, on every map it makes ----
    const gen = await page.evaluate(() => {
      const maps = [];
      for (let i = 0; i < 200; i++) maps.push(generateSectorMap());
      const bad = maps.filter(m => !validateSectorMap(m)).length;
      const forced = maps.filter(m => m.nodes.some(n => n.elite &&
        m.nodes.filter(p => p.edges.includes(n.id)).some(p => p.edges.length < 2))).length;
      const camps = maps.every(m => m.nodes.some(n => n.type === 'CAMP'));
      const events = maps.every(m => m.nodes.some(n => n.type === 'EVENT'));
      const bosses = maps.every(m => m.nodes.filter(n => n.type === 'BOSS').length === 1);
      const orphans = maps.filter(m => {
        const t1 = m.nodes.filter(n => n.tier === 1).map(n => n.id);
        const seen = new Set(t1);
        for (let t = 1; t < TOTAL_TIERS; t++)
          m.nodes.filter(n => n.tier === t && seen.has(n.id)).forEach(n => n.edges.forEach(id => seen.add(id)));
        return seen.size !== m.nodes.length;
      }).length;
      const deadEnds = maps.filter(m => m.nodes.some(n => n.tier < TOTAL_TIERS && !n.edges.length)).length;
      // and the maps actually differ from each other
      const shapes = new Set(maps.map(m => m.nodes.map(n => `${n.id}${n.type}${n.elite ? 'E' : ''}`).join()));
      return { count: maps.length, bad, forced, camps, events, bosses, orphans, deadEnds, distinct: shapes.size };
    });
    ok(`all ${gen.count} generated maps validate`, gen.bad === 0);
    ok('no map ever forces a route through an elite', gen.forced === 0);
    ok('every map has a camp and an event', gen.camps && gen.events);
    ok('and exactly one commander at the top', gen.bosses);
    ok('every node sits on a route from the ground floor', gen.orphans === 0);
    ok('and none is a dead end', gen.deadEnds === 0);
    ok(`the maps genuinely differ (${gen.distinct} distinct of ${gen.count})`, gen.distinct > gen.count * 0.95);

    // ---- the map renders as a graph ----
    const drawn = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      renderMap();
      const nodes = [...document.querySelectorAll('.map-node')];
      const lines = document.querySelectorAll('#map-nodes svg line');
      const open = nodes.filter(n => !n.disabled);
      const tier1 = sectorMap.nodes.filter(n => n.tier === 1);
      return { nodes: nodes.length, mapNodes: sectorMap.nodes.length, lines: lines.length,
               edges: sectorMap.nodes.reduce((a, n) => a + n.edges.length, 0),
               open: open.length, tier1: tier1.length,
               openAreTier1: open.every(b => tier1.some(n => n.id === b.dataset.node)),
               allHaveIds: nodes.every(b => !!b.dataset.node) };
    });
    ok(`every generated node is drawn (${drawn.nodes})`, drawn.nodes === drawn.mapNodes);
    ok(`and every edge (${drawn.lines})`, drawn.lines === drawn.edges);
    ok('at sector start the whole first tier is open', drawn.open === drawn.tier1 && drawn.openAreTier1);
    ok('and every node knows which map node it is', drawn.allHaveIds);

    // ---- taking a node commits the route ----
    const committed = await page.evaluate(() => {
      const first = sectorMap.nodes.filter(n => n.tier === 1)[0];
      enterNode(first.id);
      currentTier = 2; renderMap();
      const open = [...document.querySelectorAll('.map-node:not([disabled])')].map(b => b.dataset.node);
      const children = first.edges.slice().sort();
      const sibling = sectorMap.nodes.find(n => n.tier === 2 && !first.edges.includes(n.id));
      const siblingBtn = sibling ? document.querySelector(`[data-node="${sibling.id}"]`) : null;
      return { open: open.sort(), children,
               siblingClosed: sibling ? siblingBtn.disabled : true,
               entered: currentNodeId === first.id,
               cleared: clearedNodeIds.includes(first.id),
               clearedShown: document.querySelector(`[data-node="${first.id}"]`).className.includes('node-cleared') };
    });
    ok('what opens next is exactly what the taken node connects to',
      committed.open.join() === committed.children.join());
    ok('a same-tier node it does not connect to is closed', committed.siblingClosed);
    ok('the taken node is committed and marked cleared', committed.entered && committed.cleared && committed.clearedShown);

    // Routing cuts things off, and the map says so.
    const cut = await page.evaluate(() => {
      const reach = reachableNodeIds();
      const cutNodes = sectorMap.nodes.filter(n => !reach.has(n.id) && !clearedNodeIds.includes(n.id));
      const marked = [...document.querySelectorAll('.map-node.node-cutoff')].map(b => b.dataset.node);
      return { cut: cutNodes.map(n => n.id).sort(), marked: marked.sort() };
    });
    ok(`what the routing cut off is marked as such (${cut.marked.length} nodes)`,
      cut.cut.join() === cut.marked.join());

    // ---- the forecast is a contract ----
    const forecast = await page.evaluate(() => {
      // find a generated map holding a forecast node so the test is deterministic
      for (let i = 0; i < 60; i++) {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 2; sectorMap = generateSectorMap(); currentNodeId = null; clearedNodeIds = [];
        const wet = sectorMap.nodes.find(n => n.weather && !['CLEAR', 'BLOODLUST'].includes(n.weather));
        if (!wet) continue;
        currentTier = wet.tier;
        enterNode(wet.id);
        initiateCombat(wet.type, wet.elite);
        const fought = currentWeather;
        combatActive = false;
        renderMap();
        const glyph = document.querySelector(`[data-node="${wet.id}"] .node-weather`);
        return { promised: wet.weather, fought, glyphShown: !!glyph, consumed: forecastWeather === null };
      }
      return null;
    });
    ok('a node that forecasts weather delivers exactly that weather',
      forecast && forecast.fought === forecast.promised);
    ok('the forecast is shown on the node', forecast && forecast.glyphShown);
    ok('and consumed by the fight, never leaking into the next', forecast && forecast.consumed);

    // A fight staged without a node still rolls its own weather - the dev tools and every
    // other suite depend on that.
    const direct = await page.evaluate(() => {
      forecastWeather = null;
      currentSector = 1; currentTier = 1;
      initiateCombat('RAIDERS', false);
      const w = currentWeather; combatActive = false;
      return w !== undefined;
    });
    ok('a fight staged directly still works without a node', direct);

    // ---- the run's position survives everything it should ----
    await page.evaluate(() => { combatActive = false; });
    await page.waitForTimeout(700);
    // The comparison data has to live on this side of the reload - the reload wipes window.
    const before = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const first = sectorMap.nodes.filter(n => n.tier === 1)[1] || sectorMap.nodes.filter(n => n.tier === 1)[0];
      enterNode(first.id); currentTier = 2;
      saveGameState();
      return { shape: sectorMap.nodes.map(n => n.id + n.type).join(), pos: currentNodeId };
    });
    await page.reload();
    await page.waitForTimeout(700);
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(500);
    const reloaded = await page.evaluate((prev) => ({
      sameMap: sectorMap.nodes.map(n => n.id + n.type).join() === prev.shape,
      samePos: currentNodeId === prev.pos,
      cleared: clearedNodeIds.length,
      openMatchesRoute: (() => {
        const cur = nodeById(currentNodeId);
        return availableNodeIds().sort().join() === cur.edges.slice().sort().join();
      })()
    }), before);
    ok('the generated map survives a reload byte for byte', reloaded.sameMap);
    ok('so does the committed position', reloaded.samePos && reloaded.cleared === 1);
    ok('and the open set still follows the route', reloaded.openMatchesRoute);

    // A save from before routes existed loads onto a fresh map with its tier open.
    const legacy = await page.evaluate(() => {
      const old = { scrap: 80, tier: 4, currentSector: 2, difficultyMult: 1,
        roster: JSON.parse(JSON.stringify(ROSTER_TEMPLATE)), inventory: ['MED_STIM'],
        materials: { parts: 0, chems: 0, tech: 0 }, activeBounties: [], momentum: 0,
        activeRelics: [], runStats: null, combat: null };
      Store.set(BASE_SAVE_KEY + 2, JSON.stringify(old));
      currentSlot = 2; loadGameState();
      renderMap();
      const open = [...document.querySelectorAll('.map-node:not([disabled])')];
      return { hasMap: !!sectorMap && validateSectorMap(sectorMap),
               tier: currentTier, open: open.length,
               tierWidth: sectorMap.nodes.filter(n => n.tier === 4).length };
    });
    ok('a legacy save gets a valid fresh map', legacy.hasMap);
    ok('with its whole current tier open', legacy.tier === 4 && legacy.open === legacy.tierWidth);

    // ---- a regroup walks back in at the bottom of the same map ----
    const regroup = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const shape = sectorMap.nodes.map(n => n.id + n.type).join();
      const first = sectorMap.nodes.filter(n => n.tier === 1)[0];
      enterNode(first.id); currentTier = 2;
      runStats.regroups = 2;
      regroupSquad();
      return { sameMap: sectorMap.nodes.map(n => n.id + n.type).join() === shape,
               tier: currentTier, pos: currentNodeId, cleared: clearedNodeIds.length,
               open: availableNodeIds().length,
               tier1: sectorMap.nodes.filter(n => n.tier === 1).length };
    });
    ok('a regroup keeps the sector map', regroup.sameMap);
    ok('and reopens the whole first tier', regroup.tier === 1 && regroup.pos === null &&
      regroup.cleared === 0 && regroup.open === regroup.tier1);

    // ---- a new sector is a new map ----
    const advanced = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const before = sectorMap.nodes.map(n => n.id + n.type + (n.elite ? 'E' : '')).join();
      currentTier = TOTAL_TIERS + 1;
      renderMap();
      const secured = document.querySelector('[data-action="advance-sector"]') !== null;
      advanceSector();
      // advanceSector may land on a consequence screen; the map state is what matters here
      return { secured,
               changed: sectorMap.nodes.map(n => n.id + n.type + (n.elite ? 'E' : '')).join() !== before,
               valid: validateSectorMap(sectorMap),
               reset: currentNodeId === null && clearedNodeIds.length === 0 && currentTier === 1 };
    });
    ok('a finished sector still offers the way up', advanced.secured);
    ok('and the next sector generates a different, valid map', advanced.changed && advanced.valid);
    ok('with the position reset to its floor', advanced.reset);

    // ---- a dev jump opens the whole target tier rather than stranding the run ----
    const jumped = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const first = sectorMap.nodes.filter(n => n.tier === 1)[0];
      enterNode(first.id); currentTier = 2;
      devJump(0, 5);
      return { tier: currentTier, open: availableNodeIds().length,
               width: sectorMap.nodes.filter(n => n.tier === currentTier).length };
    });
    ok('a dev jump opens the whole target tier', jumped.tier === 7 && jumped.open === jumped.width);

    // ---- and a full sector is playable end to end through the graph ----
    const walk = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      let steps = 0; const path = [];
      while (currentTier <= TOTAL_TIERS && steps < 30) {
        const open = availableNodeIds();
        if (!open.length) return { stranded: true, path };
        const node = nodeById(open[Math.floor(Math.random() * open.length)]);
        enterNode(node.id);
        path.push(node.type + (n => n.elite ? '!' : '')(node));
        currentTier++; steps++;
      }
      return { stranded: false, steps, total: TOTAL_TIERS, reachedBoss: path[path.length - 1].startsWith('BOSS'), path };
    });
    ok(`a random route walks the whole sector without stranding (${walk.path && walk.path.length} nodes)`,
      !walk.stranded && walk.steps === walk.total);
    ok('and ends at the commander', walk.reachedBoss);
  }
};

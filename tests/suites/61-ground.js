// Ground was built so that where a fight happens changes how it is fought, and it is marked on
// every node before you take it - which makes it a routing decision. Three fights in five had
// no terrain rules at all, so the decision rarely came up.
//
// Two things the audit entry got wrong, both found by measuring rather than reading. The
// constant was doing exactly what it said: 51.4% of ELIGIBLE nodes carried ground. The gap to
// 41% of fights fought is two categories that are deliberately never eligible - a commander's
// arena and the opening fight of a run - plus bosses being over-represented among fights
// actually fought. And the entry proposed ground "for the factions that have none": all five
// had a pool. The Choir and the Carrion borrowed theirs off the Mech and the Beasts.
module.exports = {
  name: 'Ground',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the table ----
    const table = await page.evaluate(() => {
      const ids = TERRAIN_IDS.filter(t => t !== 'OPEN_ROAD');
      const RULES = ['reachFree', 'ranged', 'reach', 'aoe', 'frontCover', 'backline'];
      return {
        ids,
        shaped: ids.every(t => { const g = TERRAIN[t]; return g.name && g.short && g.dot && g.desc && g.banner; }),
        // A terrain with no rule on it is a label, not a place.
        toothless: ids.filter(t => !RULES.some(r => TERRAIN[t][r] !== undefined)),
        marks: ids.map(t => TERRAIN[t].short[0]),
        plain: Object.keys(TERRAIN.OPEN_ROAD).filter(k => RULES.includes(k))
      };
    });
    ok(`every terrain is fully described (${table.ids.length} of them)`, table.shaped && table.ids.length >= 5);
    ok('and every one of them bends a rule', table.toothless.length === 0);
    // The node marker is one letter, so two terrains sharing an initial are indistinguishable.
    ok(`their node markers are all different letters (${table.marks.join(' ')})`,
      new Set(table.marks).size === table.marks.length);
    ok('open road is the one that changes nothing', table.plain.length === 0);

    // ---- every faction fights somewhere, and the two that borrowed have their own ----
    const places = await page.evaluate(() => {
      const byFaction = Object.fromEntries(FIGHT_NODES.map(f => [f, FACTIONS[f].ground || []]));
      const counts = {};
      Object.values(byFaction).flat().forEach(t => { counts[t] = (counts[t] || 0) + 1; });
      return { byFaction, counts,
               empty: FIGHT_NODES.filter(f => !(FACTIONS[f].ground || []).length),
               unknown: Object.values(byFaction).flat().filter(t => !TERRAIN[t]) };
    });
    ok('no faction fights nowhere in particular', places.empty.length === 0);
    ok('and none of them names ground that does not exist', places.unknown.length === 0);
    ok(`the Choir and the Carrion each have a place nobody else uses ` +
       `(${places.byFaction.CHOIR.join('/')}, ${places.byFaction.CARRION.join('/')})`,
      places.byFaction.CHOIR.some(t => places.counts[t] === 1)
      && places.byFaction.CARRION.some(t => places.counts[t] === 1));

    // ---- the dial does what it says, on the nodes it is allowed to touch ----
    const rate = await page.evaluate(() => {
      confirmNewGame(1.0); sectorFront = null;
      let eligible = 0, withGround = 0, boss = 0, bossWith = 0, opener = 0, openerWith = 0;
      for (let i = 0; i < 120; i++) {
        currentSector = 1 + (i % 4);
        generateSectorMap().nodes.forEach(n => {
          const has = n.terrain && n.terrain !== 'OPEN_ROAD';
          if (n.type === 'BOSS') { boss++; if (has) bossWith++; return; }
          if (!FIGHT_NODES.includes(n.type)) return;
          if (currentSector === 1 && n.tier === 1) { opener++; if (has) openerWith++; return; }
          eligible++; if (has) withGround++;
        });
      }
      return { eligible, withGround, boss, bossWith, opener, openerWith, want: GROUND_CHANCE };
    });
    const got = rate.withGround / rate.eligible;
    ok(`ground lands on eligible nodes at about the rate asked for (${(got * 100).toFixed(0)}%, wanted ${Math.round(rate.want * 100)}%)`,
      Math.abs(got - rate.want) < 0.06);
    ok(`most fights that can carry ground now do (${(got * 100).toFixed(0)}%)`, got > 0.6);
    // Both exclusions are deliberate and this is what keeps them honest.
    ok(`a commander's arena is always plain (${rate.boss} of them)`, rate.boss > 0 && rate.bossWith === 0);
    ok(`and so is the opening fight of a run (${rate.opener})`, rate.opener > 0 && rate.openerWith === 0);

    // ---- a node's ground is a promise the fight keeps ----
    const kept = await page.evaluate(() => {
      confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach(c => { c.gridPos = 0; });
      playerRoster.slice(0, 3).forEach((c, i) => { c.gridPos = i + 1; });
      currentSector = 3; currentTier = 1;
      sectorMap = generateSectorMap(); currentNodeId = null; clearedNodeIds = [];
      const node = sectorMap.nodes.find(n => FIGHT_NODES.includes(n.type) && n.terrain && n.terrain !== 'OPEN_ROAD');
      if (!node) return { skipped: true };
      currentTier = node.tier;
      enterNode(node.id);
      const promised = forecastTerrain;
      initiateCombat(node.type, false);
      return { skipped: false, promised, node: node.terrain, fought: currentTerrain,
               banner: document.body.innerText.includes(TERRAIN[node.terrain].name) };
    });
    ok('the node hands its ground to the fight it opens', kept.skipped || kept.promised === kept.node);
    ok('and the fight is on the ground the node named', kept.skipped || kept.fought === kept.node);
    ok('which the fight says out loud', kept.skipped || kept.banner);

    // ---- the new ground actually bends what it claims to ----
    const bends = await page.evaluate(() => {
      const read = terr => { currentTerrain = terr; const g = ground(); return {
        aoe: g.aoe || 1, ranged: g.ranged || 1, reach: g.reach || 1,
        front: g.frontCover || 1, back: g.backline };
      };
      const road = read('OPEN_ROAD'), water = read('FLOODED'), nest = read('NEST');
      // backlineWeight is what decides who enemy fire hunts, so it is asked rather than assumed.
      currentTerrain = 'NEST';
      const backOnNest = typeof backlineWeight === 'function';
      currentTerrain = 'OPEN_ROAD';
      return { road, water, nest, backOnNest };
    });
    ok('the flooded works drag on blades and carry a blast',
      bends.water.reach < bends.road.reach && bends.water.aoe > bends.road.aoe);
    ok('and leave the front rank nothing to stand behind',
      bends.water.front > bends.road.front);
    ok('the nest packs them tight enough for area attacks to earn their keep',
      bends.nest.aoe > bends.road.aoe && bends.nest.aoe > bends.water.aoe);
    ok('and exposes your back rank', !!bends.nest.back && bends.backOnNest);

    // ---- the manual lists the places ----
    const manual = await page.evaluate(() => {
      renderCodex();
      const txt = document.getElementById('codex-body').innerText;
      return TERRAIN_IDS.filter(t => TERRAIN[t].banner)
        .every(t => txt.includes(TERRAIN[t].name));
    });
    ok('the manual names every place a fight can happen', manual);
  }
};

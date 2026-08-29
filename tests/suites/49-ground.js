// Every fight was staged on the same rectangle. The backdrops already varied by faction and
// already meant nothing - a canyon and a refinery floor played identically. Ground bends rules
// the engine already runs rather than adding a system on top of them, and it is forecast on the
// map so routing around it is a decision made before the node is entered.
module.exports = {
  name: 'Ground that matters',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the table ----
    const table = await page.evaluate(() => {
      const bends = k => ['reachFree', 'reach', 'ranged', 'aoe', 'frontCover', 'backline']
        .some(f => TERRAIN[k][f] !== undefined);
      return {
        ids: TERRAIN_IDS, unique: new Set(TERRAIN_IDS).size,
        written: TERRAIN_IDS.every(k => TERRAIN[k].name && TERRAIN[k].short && TERRAIN[k].dot && TERRAIN[k].desc.length > 30),
        bending: TERRAIN_IDS.filter(bends),
        bannered: TERRAIN_IDS.filter(k => TERRAIN[k].banner),
        plain: bends('OPEN_ROAD'),
        offered: TERRAIN_IDS.filter(k => Object.values(FACTIONS).some(f => (f.ground || []).includes(k)))
      };
    });
    ok(`${table.ids.length} grounds, each named and described`, table.unique === table.ids.length && table.written);
    ok('open road is the one that bends nothing', !table.plain);
    ok('and every ground that bends a rule says so on a banner',
      table.bending.length >= 3 && table.bending.every(k => table.bannered.includes(k)));
    // Content nobody can reach is content that does not exist: each ground has to be on some
    // faction's list or it will never be rolled.
    ok(`every bending ground is on a faction's list (${table.offered.join(', ')})`,
      table.bending.every(k => table.offered.includes(k)));

    // ---- reach ----
    const reach = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const back = playerRoster[0]; back.gridPos = 3;
      const front = { gridPos: 1 };
      const at = g => { currentTerrain = g; return {
        backRank: Number(reachMult('HEAVY_WRENCH', back, 0).toFixed(3)),
        pastFront: Number(reachMult('HEAVY_WRENCH', front, 2).toFixed(3)),
        clean: Number(reachMult('HEAVY_WRENCH', front, 0).toFixed(3)),
        rifle: reachMult('PIPE_RIFLE', back, 2) }; };
      const out = Object.fromEntries(TERRAIN_IDS.map(g => [g, at(g)]));
      currentTerrain = 'OPEN_ROAD';
      return out;
    });
    ok(`a tunnel puts everything in arm's reach (back rank ${reach.OPEN_ROAD.backRank} -> ${reach.TUNNELS.backRank})`,
      reach.TUNNELS.backRank === 1 && reach.TUNNELS.pastFront === 1 && reach.OPEN_ROAD.backRank < 1);
    ok(`open flats cost a blade even from the front (${reach.OPEN_ROAD.clean} -> ${reach.OPEN_FLATS.clean})`,
      reach.OPEN_FLATS.clean < reach.OPEN_ROAD.clean && reach.OPEN_FLATS.backRank < reach.OPEN_ROAD.backRank);
    ok('ruins leave reach alone', reach.RUINS.backRank === reach.OPEN_ROAD.backRank);
    // Reach is a melee rule and nothing else: ground bends a rifle through the damage chain,
    // never through this, or a ranged attack would be cut twice for the same reason.
    ok('and reach never touches a rifle', table.ids.every(g => reach[g].rifle === 1));

    const rifles = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 2; currentTier = 6;
      initiateCombat('RAIDERS', false);
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.range = 'ranged'; foe.intent = { type: 'ATTACK' };
      const at = g => { currentTerrain = g; return enemyStrike(foe, foe.intent); };
      const out = Object.fromEntries(TERRAIN_IDS.map(g => [g, at(g)]));
      currentTerrain = 'OPEN_ROAD'; combatActive = false;
      return out;
    });
    ok(`open flats are a rifle's ground (${rifles.OPEN_ROAD} -> ${rifles.OPEN_FLATS})`,
      rifles.OPEN_FLATS > rifles.OPEN_ROAD);
    ok(`and cover is not (tunnels ${rifles.TUNNELS}, ruins ${rifles.RUINS})`,
      rifles.TUNNELS < rifles.OPEN_ROAD && rifles.RUINS < rifles.OPEN_ROAD);
    // A ground that turns one knob is a buff with scenery on it. Each of them has to change how
    // more than one thing about a fight works, or routing onto it is not a decision.
    const knobs = await page.evaluate(() => Object.fromEntries(TERRAIN_IDS.map(k =>
      [k, ['reachFree', 'reach', 'ranged', 'aoe', 'frontCover', 'backline']
        .filter(f => TERRAIN[k][f] !== undefined)])));
    ok(`each ground bends at least two rules (${table.bending.map(k => `${k} ${knobs[k].length}`).join(', ')})`,
      table.bending.every(k => knobs[k].length >= 2));

    // ---- cover, and who it covers ----
    const cover = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 2; currentTier = 6;
      initiateCombat('RAIDERS', false);
      const foe = activeEntities.find(e => !e.isPlayer);
      const front = playerRoster.find(p => p.gridPos === 1);
      const back = playerRoster.find(p => p.gridPos === 3);
      front.resistances = { phys: 0, bio: 0, energy: 0 }; front.armor = 0;
      back.resistances = { phys: 0, bio: 0, energy: 0 }; back.armor = 0;
      foe.gridPos = 1; foe.resistances = { phys: 0, bio: 0, energy: 0 }; foe.armor = 0;
      const at = g => { currentTerrain = g; return {
        front: mitigate(foe, front, 100, 'phys', 'BASIC').n,
        back: mitigate(foe, back, 100, 'phys', 'BASIC').n,
        theirs: mitigate(front, foe, 100, 'phys', 'BASIC').n }; };
      const out = { road: at('OPEN_ROAD'), ruins: at('RUINS'), tunnels: at('TUNNELS') };
      currentTerrain = 'OPEN_ROAD'; combatActive = false;
      return out;
    });
    ok(`ruins cover the front rank (${cover.road.front} -> ${cover.ruins.front})`,
      cover.ruins.front < cover.road.front);
    ok('and only the front rank', cover.ruins.back === cover.road.back);
    ok('it is the ground, not a squad buff - it covers their front rank too',
      cover.ruins.theirs < cover.road.theirs);
    ok('a tunnel is not cover', cover.tunnels.front === cover.road.front);

    // ---- what the enemy can see past your line ----
    const sight = await page.evaluate(() => {
      const at = g => { currentTerrain = g; return [1, 2, 3].map(p => backlineWeight({ gridPos: p })); };
      const out = { road: at('OPEN_ROAD'), flats: at('OPEN_FLATS'), ruins: at('RUINS') };
      currentTerrain = 'OPEN_ROAD';
      return out;
    });
    ok(`open flats expose the ranks behind your front (${sight.road.join('/')} -> ${sight.flats.join('/')})`,
      sight.flats[1] > sight.road[1] && sight.flats[2] > sight.road[2]);
    ok('while the front rank is weighted the same wherever it stands', sight.flats[0] === sight.road[0]);
    ok('and ground that does not open sightlines changes nothing', sight.ruins.join() === sight.road.join());

    // ---- area attacks ----
    // What counts as an area attack is read off the ability declarations, so the second hit and
    // the ground rule cannot disagree about which moves they are.
    const area = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 2; currentTier = 6;
      initiateCombat('RAIDERS', false);
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.intent = { type: 'AOE' };
      const at = g => { currentTerrain = g; return enemyStrike(foe, foe.intent); };
      const out = { road: at('OPEN_ROAD'), tunnels: at('TUNNELS'), ruins: at('RUINS'),
                    declared: Object.keys(MOVE_AOE).filter(m => MOVE_AOE[m]),
                    handList: /'HEAT_WAVE' \|\| pendingAction === 'PIERCING_VOLLEY'/.test(src) };
      currentTerrain = 'OPEN_ROAD'; combatActive = false;
      return out;
    });
    ok(`a tunnel makes a blast worse (${area.road} -> ${area.tunnels})`, area.tunnels > area.road);
    ok(`ruins break one up (${area.road} -> ${area.ruins})`, area.ruins < area.road);
    ok(`the area moves are declared, not hand-listed (${area.declared.join(', ')})`,
      area.declared.length >= 2 && !area.handList);

    // ---- the number on the board is the number that lands ----
    // The forecast and the blow each kept this chain by hand, in different orders. They call one
    // function now, which is the only reason ground can be trusted in a forecast at all.
    const shared = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      return { declared: (src.match(/function enemyStrike\(/g) || []).length,
               calls: (src.match(/enemyStrike\(/g) || []).length,
               strays: (src.match(/currentWeather === 'SANDSTORM'/g) || []).length };
    });
    ok('the outgoing chain lives in one place, used by more than one caller',
      shared.declared === 1 && shared.calls >= 4);
    ok(`and the weather rule is no longer copied around it (${shared.strays} sites)`, shared.strays <= 2);

    const honest = await page.evaluate(() => {
      const bad = [];
      for (const g of TERRAIN_IDS) {
        for (const kind of ['ATTACK', 'HEAVY', 'STATUS']) {
          currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
          currentSector = 2; currentTier = 6; initiateCombat('RAIDERS', false);
          currentTerrain = g;
          const foe = activeEntities.find(e => !e.isPlayer);
          foe.range = 'melee';                      // the case the forecast calls exact
          activeEntities.filter(e => !e.isPlayer && e !== foe).forEach(e => e.hp = 0);
          foe.intent = { type: kind }; foe.lockOn = null;
          playerRoster.filter(p => p.gridPos > 0).forEach(p => { p.hp = 9999; p.maxHp = 9999; });
          const f = forecastFor(foe);
          if (!f.exact) { bad.push(`${g}/${kind} not exact`); continue; }
          const mark = f.hits[0].target, promised = f.hits[0].dmg;
          let lo = Infinity;
          for (let i = 0; i < 40; i++) {
            playerRoster.filter(p => p.gridPos > 0).forEach(p => { p.hp = 9999; });
            foe.intent = { type: kind }; foe.lockOn = null;
            executeEnemyAi(foe);
            lo = Math.min(lo, 9999 - mark.hp);
          }
          if (promised !== lo) bad.push(`${g}/${kind} promised ${promised}, landed ${lo}`);
        }
      }
      currentTerrain = 'OPEN_ROAD'; combatActive = false;
      return bad;
    });
    ok(`the board promises what the swing deals, on every ground (${honest.length} disagreements)`,
      honest.length === 0);
    if (honest.length) console.log('        ' + honest.slice(0, 6).join('\n        '));

    // ---- it is forecast before the node is taken ----
    const forecast = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2;
      const spread = {};
      for (let i = 0; i < 40; i++) {
        sectorMap = generateSectorMap(seededRng('ground:' + i));
        sectorMap.nodes.filter(n => FIGHT_NODES.includes(n.type))
          .forEach(n => { spread[n.terrain] = (spread[n.terrain] || 0) + 1; });
      }
      // The opening fight of a run is plain, for the same reason its sky is.
      currentSector = 1;
      let openers = new Set(), bosses = new Set();
      for (let i = 0; i < 30; i++) {
        const m = generateSectorMap(seededRng('open:' + i));
        m.nodes.filter(n => n.tier === 1).forEach(n => openers.add(n.terrain));
        m.nodes.filter(n => n.type === 'BOSS').forEach(n => bosses.add(n.terrain));
      }
      currentSector = 2;
      sectorMap = generateSectorMap(seededRng('pick'));
      renderMap();
      const chips = [...document.querySelectorAll('.node-ground')];
      const node = sectorMap.nodes.find(n => FIGHT_NODES.includes(n.type) && n.terrain !== 'OPEN_ROAD');
      enterNode(node.id);
      const promised = forecastTerrain;
      initiateCombat(node.type, false);
      const banner = document.getElementById('ground-banner');
      const out = { spread, openers: [...openers], bosses: [...bosses],
                    chips: chips.length, titled: chips.every(c => c.title.length > 20),
                    promised, got: currentTerrain,
                    banner: banner.innerText, shown: banner.style.display !== 'none' };
      combatActive = false; currentTerrain = 'OPEN_ROAD';
      return out;
    });
    ok(`a sector rolls a spread of ground (${Object.entries(forecast.spread).map(([k, v]) => `${k} ${v}`).join(', ')})`,
      Object.keys(forecast.spread).length === table.ids.length);
    ok('the first fight of a run is plain ground', forecast.openers.join() === 'OPEN_ROAD');
    ok("and so is a commander's arena", forecast.bosses.join() === 'OPEN_ROAD');
    ok(`the map marks it, with the whole rule in the tooltip (${forecast.chips} chips)`,
      forecast.chips > 0 && forecast.titled);
    ok(`the node keeps the promise it made (${forecast.promised})`, forecast.promised === forecast.got);
    ok(`and the fight says what it is being fought on (${forecast.banner.slice(0, 40)})`,
      forecast.shown && forecast.banner.length > 10);

    // ---- through a reload, and gone by the next run ----
    await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 2; currentTier = 6;
      initiateCombat('RAIDERS', false); currentTerrain = 'TUNNELS'; saveGameState();
    });
    await page.reload();
    await page.waitForTimeout(600);
    const kept = await page.evaluate(() => {
      currentSlot = 1; loadGameState();
      const had = !!pendingCombat; if (had) resumeCombat(pendingCombat);
      const after = currentTerrain;
      advanceSector();
      const acrossSector = forecastTerrain;
      currentSlot = 1; confirmNewGame(1.0);
      combatActive = false;
      return { had, after, acrossSector, fresh: currentTerrain, freshForecast: forecastTerrain };
    });
    ok('the ground a fight is on survives a reload', kept.had && kept.after === 'TUNNELS');
    ok('nothing is forecast across a sector boundary', kept.acrossSector === null);
    ok('and a new run starts on plain ground', kept.fresh === 'OPEN_ROAD' && kept.freshForecast === null);

    // ---- and the game says the ground exists ----
    const taught = await page.evaluate(() => {
      const text = CODEX.map(e => e.body().join(' ')).join(' ');
      const p = PROMPTS.find(x => x.id === 'GROUND');
      return { manual: TERRAIN_IDS.filter(k => TERRAIN[k].banner).every(k => text.includes(TERRAIN[k].name)),
               prompt: !!p && /tunnel/i.test(p.body) && /flat/i.test(p.body) && /ruin/i.test(p.body) };
    });
    ok('the manual lists every ground that bends a rule', taught.manual);
    ok('and the field prompt explains all three', taught.prompt);
  }
};

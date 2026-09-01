// Three sets across twenty relics, and all three paired two clean halves. A07 had already made
// curses a real bargain - a big upside you pay for rather than a worse card - but nothing on
// the board rewarded COMMITTING to one, so a curse could only ever be a single trade taken on
// its own merits. A build was something only clean relics could have.
//
// Nine now, three of them wanting a cursed half. The thing worth holding is that those three
// PAY BACK what the curse charges rather than stacking a second multiplier on top of it: the
// knife feeds twice as hard for a squad that gave up shooting, the coat weighs a third as much
// for a line that was already slow, and the collector halves his price for a run carrying both
// his debts. A set that just made a curse stronger would be a bigger number, not a build.
module.exports = {
  name: 'Relic sets',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      // confirmNewGame rebuilds the run and empties the relic list, so anything holding relics
      // has to put them on afterwards - a set armed before it is silently unarmed after.
      window.__hold = ids => { activeRelics = ids.map(id => RELIC_POOL.find(r => r.id === id)); };
      window.__fresh = () => { activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null; };
    });

    // ---- the shape of the board ----
    const shape = await page.evaluate(() => {
      const count = {};
      RELIC_SETS.forEach(s => { count[s.a] = (count[s.a] || 0) + 1; count[s.b] = (count[s.b] || 0) + 1; });
      return {
        n: RELIC_SETS.length,
        cursed: RELIC_SETS.filter(setIsCursed).map(s => s.name),
        clean: RELIC_SETS.filter(s => !setIsCursed(s)).map(s => s.name),
        real: RELIC_SETS.every(s => RELIC_POOL.some(r => r.id === s.a) && RELIC_POOL.some(r => r.id === s.b)),
        described: RELIC_SETS.every(s => s.name && s.desc),
        names: new Set(RELIC_SETS.map(s => s.name)).size,
        pairs: new Set(RELIC_SETS.map(s => [s.a, s.b].sort().join('+'))).size,
        selfPaired: RELIC_SETS.filter(s => s.a === s.b).map(s => s.name),
        hubs: Object.entries(count).filter(([, k]) => k > 1).map(([id]) => id)
      };
    });
    ok(`${shape.n} sets on the board, every half a relic that exists`, shape.n >= 8 && shape.real && shape.described);
    ok(`no two share a name or a pairing`, shape.names === shape.n && shape.pairs === shape.n);
    ok('and none of them is a relic paired with itself', shape.selfPaired.length === 0);
    ok(`${shape.cursed.length} of them want a cursed half (${shape.cursed.join(', ')})`, shape.cursed.length >= 2);
    ok(`${shape.clean.length} pair two clean ones`, shape.clean.length >= 5);
    ok(`and some relics sit in more than one, so the board branches (${shape.hubs.join(', ')})`,
      shape.hubs.length >= 2);

    // ---- every set does something, and it is not the announcement ----
    const wired = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
      // Plain string search rather than a built regex: the names carry an apostrophe and a
      // hand-escaped pattern reported every set as silent, including three this suite had
      // already measured working. Both quote styles, because one name needs the double.
      const uses = name => (code.split(`relicSetActive('${name}')`).length - 1)
                         + (code.split(`relicSetActive("${name}")`).length - 1);
      return { silent: RELIC_SETS.filter(s => uses(s.name) === 0).map(s => s.name),
               counts: RELIC_SETS.map(s => `${s.name}:${uses(s.name)}`) };
    });
    ok(`not one of them is only a log line (${wired.silent.join(', ') || 'all wired'})`, wired.silent.length === 0);

    // ---- Hard Cover: the mesh reaches further back ----
    const cover = await page.evaluate(() => {
      const t = pos => ({ isPlayer: true, gridPos: pos, armor: 0, resistances: { phys: 0 }, corrodedTurns: 0, venomStacks: 0 });
      const hit = pos => mitigate(null, t(pos), 100, 'phys', 'BASIC').n;
      __hold(['KINETIC_MESH']); const alone = [hit(1), hit(2), hit(3)];
      __hold(['KINETIC_MESH', 'BULWARK_PLATING']); const set = [hit(1), hit(2), hit(3)];
      __hold(['BULWARK_PLATING']); const plateOnly = [hit(1), hit(2), hit(3)];
      __hold([]);
      return { alone, set, plateOnly };
    });
    ok(`the mesh alone covers only the front (${cover.alone.join('/')})`,
      cover.alone[0] < 100 && cover.alone[1] === 100 && cover.alone[2] === 100);
    ok(`Hard Cover reaches the middle rank as well (${cover.set.join('/')})`,
      cover.set[1] === cover.set[0] && cover.set[1] < cover.alone[1]);
    ok('and still leaves the back rank uncovered', cover.set[2] === 100);
    ok('half a set is not a set', cover.plateOnly.every(n => n === 100));

    // ---- Deep Magazine: cooldowns come off faster still ----
    const mag = await page.evaluate(() => {
      const tick = () => {
        const e = { isPlayer: true, hp: 10, maxHp: 10, name: 'e', cooldowns: { x: 9 } };
        activeEntities = [e]; currentWeather = 'CLEAR'; currentTerrain = 'OPEN_ROAD';
        applyTurnStartEffects(e);
        return 9 - e.cooldowns.x;
      };
      __hold([]); const bare = tick();
      __hold(['AMMO_HOIST']); const hoist = tick();
      __hold(['AMMO_HOIST', 'OVERCHARGED_CELL']); const set = tick();
      __hold(['OVERCHARGED_CELL']); const cellOnly = tick();
      __hold([]);
      return { bare, hoist, set, cellOnly };
    });
    ok(`the hoist takes two turns off a cooldown, the set takes three (${mag.bare}/${mag.hoist}/${mag.set})`,
      mag.bare === 1 && mag.hoist === 2 && mag.set === 3);
    ok('and the other half on its own does nothing to a cooldown', mag.cellOnly === mag.bare);

    // ---- Quartermaster: the haul ----
    const quarter = await page.evaluate(() => {
      __hold(['SCRAP_MAGNET']); const alone = [magnetPay(), salvageBonus()];
      __hold(['SCRAP_MAGNET', 'SALVAGE_RIG']); const set = [magnetPay(), salvageBonus()];
      __hold([]);
      return { alone, set };
    });
    ok(`the magnet pays double under Quartermaster (${quarter.alone[0]} -> ${quarter.set[0]})`,
      quarter.set[0] === quarter.alone[0] * 2);
    ok(`and salvage comes in pairs (${quarter.alone[1]} -> ${quarter.set[1]})`,
      quarter.set[1] === quarter.alone[1] * 2);

    // ---- and the three that want a curse repay what it charges ----
    const knife = await page.evaluate(() => {
      __hold(['HUNGRY_BLADE']); const alone = bladeBite();
      __hold(['HUNGRY_BLADE', 'WHETSTONE']); const set = bladeBite();
      // The curse's own cost is untouched: everything that is not melee still pays for it.
      const nonMelee = relicSetActive('The Long Knife') && hasRelic('HUNGRY_BLADE');
      __hold([]);
      return { alone, set, curseStands: nonMelee };
    });
    ok(`The Long Knife feeds a melee squad twice as hard (${knife.alone} -> ${knife.set} HP a hit)`,
      knife.set === knife.alone * 2);
    ok('while the curse it repays is still being paid', knife.curseStands);

    const collector = await page.evaluate(() => {
      __hold(['SCAVENGERS_DEBT']); const alone = collectorPrice();
      __hold(['SCAVENGERS_DEBT', 'VULTURE_ROYALTY']); const set = collectorPrice();
      // ...and the run is still carrying two curses to get it.
      const both = setIsCursed(RELIC_SETS.find(s => s.name === "The Collector's Terms"))
        && ['SCAVENGERS_DEBT', 'VULTURE_ROYALTY'].every(id => RELIC_POOL.find(r => r.id === id).tier === 'CURSED');
      __hold([]);
      return { alone, set, both };
    });
    ok(`the collector's price falls for a run carrying both his debts (${collector.alone} -> ${collector.set})`,
      collector.set < collector.alone);
    ok('and both halves of that one are curses', collector.both);

    // ---- Deadweight, measured through the order the engine actually produced ----
    const queue = await page.evaluate(() => {
      // queueSpeed is a closure inside initiateCombat, so the only honest way at it is the
      // order it built. A queue is consistent with a penalty p if it is non-increasing in
      // (speed - p for ours, speed for theirs); run enough fights across enough player speeds
      // and the penalties the engine is not using are eliminated.
      const survives = ids => {
        const live = new Set([0, 1, 2, 3, 4]);
        for (let i = 0; i < 120; i++) {
          __fresh(); __hold(ids);
          currentSector = 2; currentTier = 4;
          playerRoster.forEach(p => { p.speed = 8 + (i % 11); });
          initiateCombat('RAIDERS', false);
          const q = turnQueue;
          [...live].forEach(p => {
            const eff = e => e.speed - (e.isPlayer ? p : 0);
            for (let k = 1; k < q.length; k++) if (eff(q[k - 1]) < eff(q[k])) { live.delete(p); break; }
          });
          combatActive = false;
        }
        return [...live].sort((a, b) => a - b);
      };
      const bare = survives([]), coat = survives(['LEAD_LINED_COAT']),
            set = survives(['LEAD_LINED_COAT', 'BULWARK_PLATING']);
      __hold([]);
      return { bare, coat, set };
    });
    ok(`with no coat the queue is the raw order (penalties consistent: ${queue.bare.join(',')})`,
      queue.bare.includes(0) && !queue.bare.includes(3));
    ok(`the coat weighs the line down (${queue.coat.join(',')})`,
      queue.coat.includes(3) && !queue.coat.includes(0) && !queue.coat.includes(1));
    ok(`and Deadweight carries it better (${queue.set.join(',')})`,
      queue.set.includes(1) && !queue.set.includes(3));
    ok('so the two are telling different stories about the same coat',
      !queue.coat.some(p => queue.set.includes(p)));

    // ---- the reveal, once each ----
    const said = await page.evaluate(() => {
      __fresh();
      runStats.setsAnnounced = [];
      document.getElementById('log').innerHTML = '';
      __hold(['HUNGRY_BLADE', 'WHETSTONE', 'SCRAP_MAGNET', 'SALVAGE_RIG', 'RANGEFINDER']);
      announceSets();
      const once = document.getElementById('log').innerText;
      announceSets(); announceSets();
      const again = document.getElementById('log').innerText;
      const names = runStats.setsAnnounced.slice();
      __hold([]);
      return { names, quiet: once === again, text: once };
    });
    ok(`a completed set announces itself (${said.names.join(', ')})`,
      said.names.includes('The Long Knife') && said.names.includes('Quartermaster')
      && said.names.includes('Full Arsenal'));
    ok('and only ever once', said.quiet);
    ok('naming what it changed', /fed for it/.test(said.text) && /salvage comes in pairs/.test(said.text));

    // ---- the manual ----
    const codex = await page.evaluate(() => {
      const e = CODEX.find(x => x.id === 'CURSES');
      const text = e ? e.body().join(' ') : '';
      return { every: RELIC_SETS.every(s => text.includes(s.name) && text.includes(s.desc)),
               separates: /want a cursed half/i.test(text),
               noStaleCount: !/^.*\bThree pairs\b/.test(text) };
    });
    ok('the manual lists every set and what it does', codex.every);
    ok('and says which of them want a curse', codex.separates);
    ok('without still claiming there are three', codex.noStaleCount);
  }
};

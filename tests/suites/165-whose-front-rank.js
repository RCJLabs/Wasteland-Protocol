// M08b. TERRAIN's legend said frontCover applied to "whoever stands in the front rank, whichever
// side they are on". mitigate reads `t.gridPos === 1`, and M08 established that no hostile has a
// gridPos - so it had never applied to one. The legend was wrong twice: it also said "takes less",
// and one of the two grounds carrying the field is FLOODED WORKS at 1.2, which makes the front
// rank take MORE.
//
// THE CODE IS RIGHT AND THE DOCUMENTATION WAS WRONG, which is the opposite of how it looked.
// Measured over 150 expeditions:
//
//   what the squad TAKES on those grounds    85,541 of 227,488 (38%) at its own front rank
//     FLOODED x1.2  +8,671      RUINS x0.8  -8,437      net +234, a wash
//   what the squad would DEAL under symmetry 464,723 of 689,412 (67%) at the enemy front
//     FLOODED x1.2 +38,215      RUINS x0.8 -54,730      net -16,515, one way only
//
// The shipped rule is near enough neutral because the two grounds cancel. Symmetry would not be,
// because the squad's damage CONCENTRATES on one target (67-70%) while what it takes spreads
// across three ranks (38%) - so a front-rank rule always bites the attacker harder.
//
// And the design reason, which is the one that settles it: the squad's ranks are a formation
// committed to at the Outpost and paid for, while the enemy's "front" is index 0 of the living
// and haulForward lets the squad shuffle it mid-fight. Under a symmetric RUINS the harpooner's
// entire kit - Drag Line, Set The Hook, Iron Barb - would be dragging foes INTO cover, and SLACK
// LINE's +25% against the enemy front would be half cancelled by the ground it most often stands
// on. Cover that attaches to a queue position the attacker controls is incoherent.
//
// So the legend and both banners were rewritten and no dial moved. These rows hold the facts that
// decision rests on, and the census that would catch it if somebody re-opened the question.
module.exports = {
  name: 'Whose front rank',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', '..');
    const src = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
    const sim = fs.readFileSync(path.join(root, 'tests', 'simulate.js'), 'utf8');

    // ── The rule is one-sided, and it says so ───────────────────────────────────
    const cover = await page.evaluate(() => {
      const rows = Object.entries(TERRAIN).filter(([, g]) => g.frontCover)
        .map(([id, g]) => ({ id, mult: g.frontCover, banner: g.banner }));
      return { rows, count: Object.keys(TERRAIN).length };
    });
    ok(`${cover.rows.length} of ${cover.count} grounds carry front cover (${
        cover.rows.map(r => `${r.id} x${r.mult}`).join(', ')})`, cover.rows.length === 2);
    // THE ROW THAT KILLED THE OLD LEGEND. "takes less" cannot describe both of them.
    ok('and they point opposite ways, so no single verb describes the field',
      cover.rows.some(r => r.mult < 1) && cover.rows.some(r => r.mult > 1));
    ok('each one says whose front rank it means, the way the two backline grounds already did',
      cover.rows.every(r => /your front rank/i.test(r.banner)));
    // Asserted on the RULE LINE rather than the file, because the note under it quotes the old
    // wording on purpose - a record of what was wrong is not a claim that it still is.
    const legend = src.slice(src.indexOf('//   reachFree'), src.indexOf('const TERRAIN = {'));
    const rule = legend.split('\n').find(l => /^\/\/\s+frontCover/.test(l)) || '';
    ok(`the legend's rule line says whose rank it means ("${rule.replace(/^\/\/\s+frontCover\s+/, '').trim().slice(0, 60)}...")`,
      /YOUR OWN front rank/.test(rule) && !/whichever side/.test(rule));
    ok('and it no longer says "takes less", which only ever described one of the two',
      !/frontCover whoever stands in the front rank takes less/.test(legend));

    // ── It applies to the squad's rank and to nobody else ───────────────────────
    const applied = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField();
      currentWeather = 'CLEAR';
      const hero = window.__bare(playerRoster.find(c => c.gridPos > 0));
      hero.hp = hero.maxHp = 900; hero.armor = 0; hero.resistances = { phys: 0, bio: 0, energy: 0 };
      const mate = window.__bare(playerRoster.filter(c => c.id !== hero.id)[0]);
      mate.hp = mate.maxHp = 900; mate.armor = 0; mate.resistances = { phys: 0, bio: 0, energy: 0 };
      const foes = [window.__dummy({ id: 'f0', hp: 900, maxHp: 900 }),
                    window.__dummy({ id: 'f1', hp: 900, maxHp: 900 })];
      activeEntities = [hero, mate, ...foes];
      const at = (t, ground) => { currentTerrain = ground; return mitigate(null, t, 100, 'phys', null).n; };
      const probe = ground => {
        hero.gridPos = 1; mate.gridPos = 2;
        return { rank1: at(hero, ground), rank2: at(mate, ground),
                 enemyFront: at(foes[0], ground), enemyBack: at(foes[1], ground) };
      };
      const ruins = probe('RUINS'), water = probe('FLOODED'), road = probe('OPEN_ROAD');
      currentTerrain = 'OPEN_ROAD';
      return { ruins, water, road };
    });
    ok(`ruins cover the squad's front rank and nothing else (${applied.ruins.rank1} vs ${
        applied.ruins.rank2} behind it, ${applied.road.rank1} on open road)`,
      applied.ruins.rank1 < applied.road.rank1 && applied.ruins.rank2 === applied.road.rank2);
    ok(`the flooded works expose it instead (${applied.water.rank1} vs ${applied.road.rank1})`,
      applied.water.rank1 > applied.road.rank1);
    // THE FINDING ITSELF, as an assertion: neither ground touches a hostile, front of the line
    // or not. If somebody makes this symmetric these two rows are what will say so.
    ok(`neither ground reaches the enemy front (ruins ${applied.ruins.enemyFront}, water ${
        applied.water.enemyFront}, road ${applied.road.enemyFront})`,
      applied.ruins.enemyFront === applied.road.enemyFront
      && applied.water.enemyFront === applied.road.enemyFront);
    ok('nor anything standing behind it',
      applied.ruins.enemyBack === applied.road.enemyBack
      && applied.water.enemyBack === applied.road.enemyBack);

    // ── The enemy front is a queue position, not a place ────────────────────────
    // The design reason symmetry was declined, exercised rather than asserted from the source:
    // the squad can move which hostile is at the front, and the squad's own ranks it cannot.
    const queue = await page.evaluate(() => {
      window.__clearField();
      const hero = window.__bare(playerRoster.find(c => c.gridPos > 0));
      const a = window.__dummy({ id: 'q0', hp: 100, maxHp: 100 });
      const b = window.__dummy({ id: 'q1', hp: 100, maxHp: 100 });
      activeEntities = [hero, a, b];
      const before = enemyFront().id;
      haulForward(b);
      const after = enemyFront().id;
      // And a corpse at the head of the line is not the front, because the resolver's own
      // `dist` indexes the LIVING. Two definitions that disagreed would make the census unreadable.
      a.hp = 0;
      const afterDeath = enemyFront().id;
      return { before, after, afterDeath, order: activeEntities.filter(e => !e.isPlayer).map(e => e.id) };
    });
    ok(`the squad can choose which hostile is at the front (${queue.before} -> ${queue.after})`,
      queue.before === 'q0' && queue.after === 'q1');
    ok(`and a body on the floor is not it (${queue.order.join(',')} -> ${queue.afterDeath})`,
      queue.afterDeath === 'q1');
    ok('enemyFront reads the same set the resolver indexes with dist',
      /activeEntities\.filter\(e => !e\.isPlayer && e\.hp > 0 && !e\.burrowed\)\[0\]/.test(src)
      && /livingEnemies = activeEntities\.filter\(e => !e\.isPlayer && e\.hp > 0 && !e\.burrowed\)/.test(src));

    // ── The census counts blows, not forecasts ──────────────────────────────────
    // The instrument bug this item found in itself. mitigate is called four times by threatBoard
    // and once by the roster card's resist probe, none of which is a blow - a ledger kept at that
    // line read the squad taking six times what it dealt. The figure goes back with the result
    // and is booked where damage is actually applied.
    ok('mitigate hands the cover state back rather than counting it',
      /return \{ n, rv, ac, cover \};/.test(src) && !/noteCover\([^)]*\);\s*\n\s*if \(cover\.onRank1\)/.test(src));
    ok('and every path that lands damage books it: the blow, the sky tick and the bleed',
      (src.match(/noteCover\(/g) || []).length === 4);
    const forecast = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField();
      currentTerrain = 'RUINS'; currentWeather = 'CLEAR';
      const hero = window.__bare(playerRoster.find(c => c.gridPos > 0));
      hero.gridPos = 1; hero.hp = hero.maxHp = 900;
      activeEntities = [hero, window.__dummy({ id: 'x0', hp: 900, maxHp: 900 })];
      runStats.cv = null;
      const quiet = mitigate(null, hero, 100, 'phys', null);          // a figure, not a blow
      const afterFigure = runStats.cv;
      applyDamageHit(activeEntities[1], hero, 100, 'phys', 'BASIC');  // a blow
      currentTerrain = 'OPEN_ROAD';
      return { afterFigure, booked: runStats.cv && runStats.cv.taken, cover: quiet.cover };
    });
    ok('a figure taken without a blow behind it books nothing', forecast.afterFigure === null);
    ok(`though the figure still carries the cover state (x${forecast.cover.mult}, rank1 ${forecast.cover.onRank1})`,
      forecast.cover.mult === 0.8 && forecast.cover.onRank1 === true);
    ok(`and a blow that lands books one, on the side that took it (${
        forecast.booked ? forecast.booked.hit + ' of ' + forecast.booked.blows : 'none'})`,
      !!forecast.booked && forecast.booked.blows === 1 && forecast.booked.hit === 1);

    // THE ROW MUTATION TESTING BOUGHT. Everything above exercises the squad's side, and the
    // whole finding is that the two sides are different questions - so a ledger that filed both
    // under one heading passed every row here. What the squad TAKES is governed by the read
    // mitigate makes; what it DEALS is governed by the read it does not. Both, separately.
    const sides = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField();
      currentTerrain = 'RUINS'; currentWeather = 'CLEAR';
      const hero = window.__bare(playerRoster.find(c => c.gridPos > 0));
      hero.gridPos = 1; hero.hp = hero.maxHp = 900; hero.armor = 0;
      hero.resistances = { phys: 0, bio: 0, energy: 0 };
      const front = window.__dummy({ id: 'z0', hp: 900, maxHp: 900 });
      const back = window.__dummy({ id: 'z1', hp: 900, maxHp: 900 });
      activeEntities = [hero, front, back];
      runStats.cv = null;
      applyDamageHit(front, hero, 100, 'phys', 'BASIC');    // they hit the squad's front rank
      applyDamageHit(hero, front, 100, 'phys', 'BASIC');    // the squad hits the enemy front
      applyDamageHit(hero, back, 100, 'phys', 'BASIC');     // and the one behind it
      currentTerrain = 'OPEN_ROAD';
      return JSON.parse(JSON.stringify(runStats.cv));
    });
    ok(`what the squad takes is booked apart from what it deals (${
        sides.taken.blows} taken, ${sides.dealt.blows} dealt)`,
      sides.taken.blows === 1 && sides.dealt.blows === 2);
    ok(`and the squad's own front rank is what counts on the taken side (${sides.taken.hit} of 1)`,
      sides.taken.hit === 1);
    // The half the engine does not act on, counted anyway - because it is the whole question,
    // and a number nobody keeps is a question nobody can settle.
    ok(`the enemy front is what counts on the dealt side, one of the two (${sides.dealt.hit} of 2)`,
      sides.dealt.hit === 1);
    ok('and the cover the dealt side is counted for was never applied to it',
      sides.dealt.hitDmg === 100 && sides.taken.hitDmg === 80);

    // ── And the report divides by direction ─────────────────────────────────────
    ok('the simulator reads what the squad takes and what it deals against separate denominators',
      /show\('taken', 'TAKES'/.test(sim) && /show\('dealt', 'DEALS'/.test(sim));
    ok('and names which read each half is about, so neither can be quoted as the other',
      /the read that exists/.test(sim) && /the read the legend promises and mitigate does not make/.test(sim));
  }
};

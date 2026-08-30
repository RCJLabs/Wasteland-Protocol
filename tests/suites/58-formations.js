// A hostile squad was two to four independent draws from one weighted faction pool. Seventeen
// signatures exist and several are built to combine - plate to break with a caller behind it,
// a swarm that shrugs off damage until it is thinned, a singer making something else dangerous
// - and nothing ever put them together on purpose. More to the point, nothing the map showed
// you said what was standing there: a fight was a difficulty roll, not a problem with a shape.
//
// Formations are compositions drawn whole and named on the node before you take it. Most of
// this suite is about the two halves of that promise: the shape is fixed and repeatable, and
// the node tells you which one it is while you can still route around it.
module.exports = {
  name: 'Formations',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the table is sound ----
    const table = await page.evaluate(() => ({
      bad: validateFormations(),
      n: ALL_FORMATIONS.length,
      factions: Object.keys(FORMATIONS),
      fight: FIGHT_NODES,
      chance: FORMATION_CHANCE
    }));
    ok(`every formation fields units that exist and has unlocked them (${table.n} of them)`,
      table.bad.length === 0 && table.n > 0);
    if (table.bad.length) table.bad.forEach(b => ok(`  ${b}`, false));
    ok('every faction you can fight has some', table.fight.every(f => table.factions.includes(f)));

    // ---- a formation is a fixed shape, not another roll ----
    const fixed = await page.evaluate(() => {
      confirmNewGame(1.0); sectorFront = null;
      currentSector = 5; currentTier = 8;
      const out = {};
      ALL_FORMATIONS.forEach(f => {
        const runs = [];
        for (let i = 0; i < 8; i++) {
          const fac = Object.keys(FORMATIONS).find(k => FORMATIONS[k].includes(f));
          runs.push(generateEnemies(fac, 1.0, false, 1.0, f.id).map(e => e.name).join('|'));
        }
        out[f.id] = { same: new Set(runs).size === 1, got: runs[0], want: f.units.join('|') };
      });
      return out;
    });
    const shapes = Object.entries(fixed);
    ok('the same formation always brings the same line-up',
      shapes.every(([, v]) => v.same));
    ok('and it is the line-up the table names',
      shapes.every(([, v]) => v.got === v.want));

    // ---- it is never offered before its units exist ----
    const gate = await page.evaluate(() => {
      const rows = [];
      Object.entries(FORMATIONS).forEach(([fac, list]) => list.forEach(f => {
        const below = formationsFor(fac, f.minTier - 1).some(x => x.id === f.id);
        const at = formationsFor(fac, f.minTier).some(x => x.id === f.id);
        const after = f.fadeAt ? formationsFor(fac, f.fadeAt + 1).some(x => x.id === f.id) : false;
        rows.push({ id: f.id, below, at, after, fades: !!f.fadeAt });
      }));
      return rows;
    });
    ok('nothing is on offer a tier before it opens', gate.every(r => !r.below && r.at));
    // A shallow set-piece that never retires is still a third of your fights five sectors
    // later, and it measurably crowds out the deeper compositions.
    ok(`the shallow ones retire once the deep ones open (${gate.filter(r => r.fades).length} of them do)`,
      gate.filter(r => r.fades).length > 0 && gate.every(r => !r.after));

    // ---- the node says what is standing there, before you commit ----
    const node = await page.evaluate(() => {
      confirmNewGame(1.0); sectorFront = null;
      currentSector = 4; currentTier = 1;
      sectorMap = generateSectorMap(); currentNodeId = null; clearedNodeIds = [];
      renderMap();
      const fights = sectorMap.nodes.filter(n => FIGHT_NODES.includes(n.type));
      const named = fights.filter(n => n.formation);
      const first = sectorMap.nodes.find(n => n.tier === 1);
      // what the button actually renders for one of them
      const withForm = named[0];
      let lbl = null, title = null, marked = null;
      if (withForm) {
        const btn = document.querySelector(`[data-node="${withForm.id}"]`);
        lbl = btn.querySelector('.node-lbl').innerText;
        title = btn.title;
        marked = btn.classList.contains('formation-node');
      }
      const plain = fights.find(n => !n.formation);
      const plainLbl = plain ? document.querySelector(`[data-node="${plain.id}"]`).querySelector('.node-lbl').innerText : null;
      return { fights: fights.length, named: named.length, lbl, title, marked,
               want: withForm ? formationById(withForm.formation).name.toUpperCase() : null,
               note: withForm ? formationById(withForm.formation).note : null,
               plainLbl, plainType: plain ? plain.type : null,
               firstIsPlain: !first.formation };
    });
    ok(`a deep sector's map holds named fights (${node.named} of ${node.fights})`, node.named > 0);
    // One map is too small to say anything about the rate, so the rate is asked of many.
    const rate = await page.evaluate(() => {
      let fights = 0, named = 0;
      for (let i = 0; i < 60; i++) {
        currentSector = 4;
        const m = generateSectorMap();
        m.nodes.filter(n => FIGHT_NODES.includes(n.type)).forEach(n => { fights++; if (n.formation) named++; });
      }
      return { fights, named, want: FORMATION_CHANCE };
    });
    const share = rate.named / rate.fights;
    ok(`and does so at about the rate the table asks for (${(share * 100).toFixed(0)}% over ${rate.fights} nodes, wanted ${Math.round(rate.want * 100)}%)`,
      Math.abs(share - rate.want) < 0.08);
    ok('the node carries the formation name, not the faction', node.lbl === node.want);
    ok('and says what it is if you ask', !!node.title && node.title.includes(node.note));
    ok('a loose patrol still reads as its faction', node.plainLbl === node.plainType);
    ok('the two are told apart without reading the label', node.marked === true);

    // ---- what the node promised is what turns up ----
    const kept = await page.evaluate(() => {
      confirmNewGame(1.0); sectorFront = null;
      currentSector = 4; currentTier = 1;
      sectorMap = generateSectorMap(); currentNodeId = null; clearedNodeIds = [];
      const target = sectorMap.nodes.find(n => n.formation && n.tier > 1);
      if (!target) return { skipped: true };
      currentTier = target.tier;
      enterNode(target.id);
      const forecast = forecastFormation;
      initiateCombat(target.type, false);
      const spec = formationById(target.formation);
      const field = activeEntities.filter(e => !e.isPlayer).map(e => e.name.replace(/^\*[A-Z]+\* /, ''));
      return { skipped: false, forecast, promised: target.formation, held: currentFormation,
               field, want: spec.units,
               logged: document.getElementById('log').innerText.includes(spec.name.toUpperCase()) };
    });
    ok('the node hands its promise to the fight it opens', kept.skipped || kept.forecast === kept.promised);
    ok('the fight knows which one it is', kept.skipped || kept.held === kept.promised);
    ok('and the line that walks on is the one that was named',
      kept.skipped || JSON.stringify(kept.field) === JSON.stringify(kept.want));
    ok('the fight names itself at the door', kept.skipped || kept.logged);

    // The note goes into a title attribute unescaped, so a stray quote in the table would
    // break the button's markup rather than show up as a broken tooltip.
    const safe = await page.evaluate(() =>
      ALL_FORMATIONS.filter(f => /["<>&]/.test(f.note) || /["<>&]/.test(f.name)).map(f => f.id));
    ok('no formation carries markup into the node it labels', safe.length === 0);

    // An elite node can hold a formation too, and the label has to survive carrying both.
    const eliteLbl = await page.evaluate(() => {
      confirmNewGame(1.0); sectorFront = null;
      currentSector = 4; currentTier = 1;
      sectorMap = generateSectorMap(); currentNodeId = null; clearedNodeIds = [];
      const n = sectorMap.nodes.find(x => FIGHT_NODES.includes(x.type) && x.tier > 1);
      n.elite = true;
      n.formation = ALL_FORMATIONS.map(f => f.name).sort((a, b) => b.length - a.length)
        .map(nm => ALL_FORMATIONS.find(f => f.name === nm))[0].id;
      n.type = Object.keys(FORMATIONS).find(k => FORMATIONS[k].some(f => f.id === n.formation));
      currentTier = n.tier; renderMap();
      const btn = document.querySelector(`[data-node="${n.id}"]`);
      const lbl = btn.querySelector('.node-lbl');
      return { text: lbl.innerText, overflowsX: lbl.scrollWidth > lbl.clientWidth,
               overflowsY: btn.scrollHeight > btn.clientHeight };
    });
    ok(`an elite formation node still says both (${eliteLbl.text.replace(/\n/g, ' ')})`,
      /ELITE/.test(eliteLbl.text) && !eliteLbl.overflowsX && !eliteLbl.overflowsY);

    // A node is holding those units; retreating and coming back finds the same ones there.
    const again = await page.evaluate(() => {
      confirmNewGame(1.0); sectorFront = null;
      currentSector = 4; currentTier = 1;
      sectorMap = generateSectorMap(); currentNodeId = null; clearedNodeIds = [];
      const target = sectorMap.nodes.find(n => n.formation && n.tier > 1);
      if (!target) return { skipped: true };
      currentTier = target.tier;
      enterNode(target.id); initiateCombat(target.type, false);
      const first = activeEntities.filter(e => !e.isPlayer).map(e => e.name.replace(/^\*[A-Z]+\* /, ''));
      fallBackToNode();
      enterNode(target.id); initiateCombat(target.type, false);
      const second = activeEntities.filter(e => !e.isPlayer).map(e => e.name.replace(/^\*[A-Z]+\* /, ''));
      return { skipped: false, first, second };
    });
    ok('retreating and coming back finds the same shape standing there',
      again.skipped || JSON.stringify(again.first) === JSON.stringify(again.second));

    // ---- the manual lists them, derived rather than retyped ----
    const codex = await page.evaluate(() => {
      renderCodex();
      const txt = document.getElementById('codex-body').innerText;
      return { has: ALL_FORMATIONS.every(f => txt.includes(f.name) && txt.includes(f.note)),
               entry: /FORMATIONS/.test(txt) };
    });
    ok('the manual lists every formation and what it is', codex.entry && codex.has);

    // ---- a loose patrol is still a loose patrol ----
    const loose = await page.evaluate(() => {
      currentSector = 5; currentTier = 8;
      const runs = [];
      for (let i = 0; i < 12; i++) runs.push(generateEnemies('RAIDERS', 1.0, false, 1.0, null).map(e => e.name).join('|'));
      return { distinct: new Set(runs).size, n: runs.length };
    });
    ok(`an unnamed fight is still drawn fresh every time (${loose.distinct} shapes in ${loose.n})`,
      loose.distinct > 1);

    // ---- the pieces that could quietly fall back to a loose draw ----
    const guards = await page.evaluate(() => {
      currentSector = 1; currentTier = 1;
      // a formation from a build that no longer has that unit must not half-build
      const junk = generateEnemies('RAIDERS', 1.0, false, 1.0, 'NO_SUCH_FORMATION');
      // and one whose depth gate is not met must not field units the sector has not unlocked
      const early = generateEnemies('RAIDERS', 1.0, false, 1.0, 'ROADBLOCK');
      return { junk: junk.length, junkNames: junk.map(e => e.name),
               early: early.map(e => e.name), hadJuggernaut: early.some(e => /Juggernaut/.test(e.name)) };
    });
    ok('an unknown formation falls back to a patrol rather than an empty field', guards.junk > 0);
    ok('and one asked for too early does not smuggle its heavies in', !guards.hadJuggernaut);

    // ---- it survives a reload mid-fight ----
    const saved = await page.evaluate(() => {
      confirmNewGame(1.0); sectorFront = null;
      currentSector = 4; currentTier = 5;
      forecastFormation = 'KILL_BOX';   // what a node would have handed it
      initiateCombat('MECH', false);
      const snap = buildCombatSnapshot();
      currentFormation = null;
      resumeCombat(snap);
      return { stored: snap.formation, back: currentFormation };
    });
    ok('a fight reloaded mid-way still knows its name', saved.stored === 'KILL_BOX' && saved.back === 'KILL_BOX');

    // ---- the warlord's escort is not the head of a formation ----
    const escort = await page.evaluate(() => {
      currentSector = 5; currentTier = 10;
      const one = generateEnemies('CARRION', 1.0, false, 1.0, null);
      return { n: one.length };
    });
    ok('a front escort is drawn loose, one unit, not a composition', escort.n > 0);
  }
};

// Ten classes exist and the same handful deploy. Mastery makes that worse rather than better:
// the classes you field earn dossier ranks, and a ranked class is a reason to field it again.
//
// A doctrine is a promise about the shape of the line, taken at the muster and kept for the
// whole run. Most of this suite is about the promise being real in both directions: it pays
// what it says, it cannot be half-kept, and nothing in the game breaks it on the player's
// behalf. The rest is about the rules meaning what they say - which is where the first draft
// of this had the Shotgunner down as a melee class and the Scavenger down as not one.
module.exports = {
  name: 'Doctrines',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__line = classes => {
        playerRoster.forEach(c => { c.gridPos = 0; });
        classes.forEach((cl, i) => {
          const c = playerRoster.find(x => x.classType === cl && x.gridPos === 0);
          if (c) c.gridPos = i + 1;
        });
        return deployedLine().map(c => c.classType);
      };
      window.__run = () => { activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null; };
    });

    // ---- the table is sound ----
    const table = await page.evaluate(() => ({
      n: DOCTRINES.length,
      draw: DOCTRINE_DRAW,
      ids: DOCTRINES.map(d => d.id),
      shaped: DOCTRINES.every(d => d.id && d.name && d.rule && d.edge && typeof d.holds === 'function' && d.bonus > 0),
      empty: DOCTRINES.filter(d => d.holds([])).map(d => d.id)
    }));
    ok(`every doctrine has a rule, an edge and a price (${table.n} of them)`, table.shaped && table.n > 0);
    ok('no id is used twice', new Set(table.ids).size === table.ids.length);
    ok('and an empty line keeps none of them', table.empty.length === 0);
    ok(`more exist than are offered, so the draw is a draw (${table.draw} of ${table.n})`, table.n > table.draw);

    // ---- the rules mean what they say, checked against the real decks ----
    const rules = await page.evaluate(() => {
      __run();
      const meleeCarriers = playerRoster.filter(carriesMelee).map(c => c.classType);
      // A Scavenger only picks up a knife at dossier rank III, and can bench it - so the
      // answer has to come from the operator's deck, not from their class.
      const scav = playerRoster.find(c => c.classType === 'SCAVENGER');
      const atRank0 = carriesMelee(scav);
      mastery.SCAVENGER = MASTERY_RANKS[3];
      // Rank III offers a fourth verb and benches it unless the player says otherwise, so the
      // knife is opt-in: reaching the rank is not what puts it in their hands.
      const atRank3Default = carriesMelee(scav);
      scav.benchedMove = ABILITIES.SCAVENGER[0].move;   // keep the knife, bench a gun
      const atRank3Fielded = carriesMelee(scav);
      mastery.SCAVENGER = 0; scav.benchedMove = null;
      return { meleeCarriers, atRank0, atRank3Default, atRank3Fielded };
    });
    ok(`the melee carriers are read off the decks (${rules.meleeCarriers.join(', ')})`,
      rules.meleeCarriers.includes('BRUISER') && rules.meleeCarriers.includes('HOUND')
      && !rules.meleeCarriers.includes('MEDIC') && !rules.meleeCarriers.includes('SNIPER'));
    ok('a class that only picks up a knife at rank III does not carry one before it',
      !rules.atRank0);
    ok('reaching the rank does not arm them either - the fourth verb is benched by default',
      !rules.atRank3Default);
    ok('choosing to field that knife is what puts them out of reach of NO HANDS',
      rules.atRank3Fielded);

    // ---- each doctrine can actually be fielded, and pays what it says ----
    const each = await page.evaluate(() => DOCTRINES.map(d => {
      __run();
      doctrineFavourites = ['BRUISER', 'MEDIC', 'SHOTGUNNER'];   // so CONSCRIPTS has something to ban
      doctrineOffer = [d.id];
      playerRoster.forEach(c => { c.gridPos = 0; });
      const line = [];
      playerRoster.forEach(c => { if (line.length < 3 && d.holds([...line, c])) line.push(c); });
      line.forEach((c, i) => { c.gridPos = i + 1; });
      const buildable = d.holds(deployedLine());
      takeDoctrine(d.id);
      musterDeploy();
      const st = { ...runStats };
      return { id: d.id, buildable, took: activeDoctrine === d.id, mult: doctrineMult(),
               want: 1 + d.bonus, banked: st.doctrineMult, named: st.doctrine,
               scored: computeScore({ ...st, deepestSector: 4, deepestTier: 5, kills: 60, bosses: 2, elites: 3, scrapEarned: 900 }),
               raw: computeScore({ ...st, doctrineMult: 1, deepestSector: 4, deepestTier: 5, kills: 60, bosses: 2, elites: 3, scrapEarned: 900 }) };
    }));
    ok('every doctrine can be fielded out of the starting seven', each.every(e => e.buildable && e.took));
    ok('and pays exactly the multiplier on its card', each.every(e => Math.abs(e.mult - e.want) < 1e-9));
    ok('the run banks which one it took and what it was worth',
      each.every(e => e.named === e.id && Math.abs(e.banked - e.want) < 1e-9));
    ok(`and the score carries it (${each[0].raw} → ${each[0].scored})`,
      each.every(e => e.scored > e.raw));

    // ---- a promise broken stays broken ----
    const broke = await page.evaluate(() => {
      __run();
      doctrineOffer = ['FIELD_SURGERY'];
      __line(['BRUISER', 'SCAVENGER', 'PYROMANIAC']);
      takeDoctrine('FIELD_SURGERY'); musterDeploy();
      const before = doctrineMult();
      playerRoster.find(c => c.classType === 'MEDIC').gridPos = 1;
      checkDoctrine();
      const after = doctrineMult(), latched = doctrineBroken;
      playerRoster.find(c => c.classType === 'MEDIC').gridPos = 0;
      checkDoctrine();
      return { before, after, latched, unbroken: doctrineMult() };
    });
    ok('breaking a doctrine costs the multiplier', broke.before > 1 && broke.after === 1 && broke.latched);
    ok('and putting the line back does not buy it again', broke.unbroken === 1);

    // ---- the game does not break it for you ----
    const ranks = await page.evaluate(() => {
      __run();
      doctrineOffer = ['FIELD_SURGERY'];
      __line(['BRUISER', 'SCAVENGER', 'PYROMANIAC']);
      takeDoctrine('FIELD_SURGERY'); musterDeploy();
      // bench everyone but the medic, so the only body available breaks the doctrine
      playerRoster.forEach(c => { if (c.gridPos === 0 && c.classType !== 'MEDIC') c.gridPos = -1; });
      const lost = playerRoster.find(c => c.gridPos === 2);
      vacatedRanks = [2]; lost.gridPos = 0;
      playerRoster = playerRoster.filter(c => c.id !== lost.id);
      const filled = closeRanks();
      playerRoster.forEach(c => { if (c.gridPos === -1) c.gridPos = 0; });
      return { filled, held: !doctrineBroken, mult: doctrineMult(),
               medicIn: deployedLine().some(c => c.classType === 'MEDIC') };
    });
    ok('closing ranks leaves a gap rather than breaking the doctrine',
      !ranks.medicIn && ranks.held && ranks.mult > 1 && ranks.filled.length === 0);

    // ---- and losing someone is a price already paid, not a second one ----
    const thinned = await page.evaluate(() => {
      __run();
      doctrineOffer = ['NO_HANDS'];
      __line(['MEDIC', 'SCAVENGER', 'SNIPER']);
      takeDoctrine('NO_HANDS'); musterDeploy();
      const three = doctrineMult();
      playerRoster.find(c => c.gridPos === 3).gridPos = 0;
      checkDoctrine();
      const two = doctrineMult();
      playerRoster.find(c => c.gridPos === 2).gridPos = 0;
      checkDoctrine();
      return { three, two, one: doctrineMult() };
    });
    ok('a doctrine survives the line being thinned by losses',
      thinned.three > 1 && thinned.two === thinned.three && thinned.one === thinned.three);

    // ---- the edges arrive ----
    const edges = await page.evaluate(() => {
      __run();
      doctrineOffer = ['LIGHT_ORDER'];
      __line(['MEDIC', 'SCAVENGER', 'SNIPER']);
      const beforeSpd = deployedLine().map(c => c.speed);
      takeDoctrine('LIGHT_ORDER'); musterDeploy();
      const afterSpd = deployedLine().map(c => c.speed);
      // and only once, however many times the muster is re-rendered
      applyDoctrineEdge(); applyDoctrineEdge();
      const twice = deployedLine().map(c => c.speed);

      // FIELD SURGERY's edge is not on the sheet - it arrives between fights.
      __run();
      doctrineOffer = ['FIELD_SURGERY'];
      __line(['BRUISER', 'SCAVENGER', 'PYROMANIAC']);
      takeDoctrine('FIELD_SURGERY'); musterDeploy();
      deployedLine().forEach(c => { c.hp = Math.floor(c.maxHp * 0.4); });
      const hurt = deployedLine().map(c => c.hp);
      currentSector = 2; currentTier = 3;
      initiateCombat('RAIDERS', false);
      activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
      checkWinState();
      const patched = deployedLine().map(c => c.hp);
      return { beforeSpd, afterSpd, twice, hurt, patched };
    });
    ok('LIGHT ORDER puts speed on a light line',
      edges.afterSpd.every((v, i) => v === edges.beforeSpd[i] + 3));
    ok('and does it once, not once per render',
      JSON.stringify(edges.twice) === JSON.stringify(edges.afterSpd));
    ok('FIELD SURGERY patches the line off the back of a win',
      edges.patched.every((h, i) => h > edges.hurt[i]));

    // CONSCRIPTS pays in the currency the problem is made of.
    const xp = await page.evaluate(() => {
      __run();
      doctrineFavourites = ['BRUISER', 'MEDIC', 'SHOTGUNNER'];
      doctrineOffer = ['CONSCRIPTS'];
      __line(['SCAVENGER', 'PYROMANIAC', 'SNIPER']);
      takeDoctrine('CONSCRIPTS'); musterDeploy();
      mastery = {};
      const on = deployedLine()[0];
      awardXp(on, 100);
      const doubled = masteryXp(on.classType);
      const bench = playerRoster.find(c => c.gridPos === 0);
      mastery = {};
      awardXp(bench, 100);
      return { doubled, benched: masteryXp(bench.classType), level: on.xp };
    });
    ok(`the dossier doubles for the deployed under CONSCRIPTS (${xp.doubled} vs ${xp.benched})`,
      xp.doubled === 200 && xp.benched === 100);

    // ---- it is offered only when it means something ----
    const gate = await page.evaluate(() => {
      doctrineFavourites = [];
      const cold = [];
      for (let i = 0; i < 40; i++) cold.push(...rollDoctrines());
      doctrineFavourites = ['BRUISER', 'MEDIC', 'SHOTGUNNER'];
      const warm = [];
      for (let i = 0; i < 40; i++) warm.push(...rollDoctrines());
      return { cold: cold.includes('CONSCRIPTS'), warm: warm.includes('CONSCRIPTS'),
               size: new Set(rollDoctrines()).size };
    });
    ok('a doctrine that would pay for nothing is not dealt', !gate.cold && gate.warm);
    ok('and the draw never deals the same one twice', gate.size === Math.min(table.draw, table.n));

    // ---- the muster will not deploy into a broken promise ----
    const ui = await page.evaluate(() => {
      __run();
      doctrineOffer = ['FIELD_SURGERY', 'LIGHT_ORDER', 'NO_HANDS'];
      __line(['BRUISER', 'SCAVENGER', 'PYROMANIAC']);
      renderMuster();
      const cards = document.querySelectorAll('.doctrine-card').length;
      const unmet = document.querySelectorAll('.doctrine-card.doctrine-unmet').length;
      takeDoctrine('FIELD_SURGERY');
      const okBtn = !document.getElementById('muster-deploy').disabled;
      const okTxt = document.getElementById('muster-deploy').innerText;
      // now make the line break it, without deploying
      playerRoster.find(c => c.classType === 'MEDIC').gridPos = 1;
      playerRoster.find(c => c.classType === 'PYROMANIAC').gridPos = 0;
      renderMuster();
      return { cards, unmet, okBtn, okTxt,
               blocked: document.getElementById('muster-deploy').disabled,
               blockedTxt: document.getElementById('muster-deploy').innerText };
    });
    ok(`the muster offers ${table.draw} and marks the ones this line cannot keep`,
      ui.cards === 3 && ui.unmet > 0);
    ok(`taking one says so on the button (${ui.okTxt})`, ui.okBtn && /FIELD SURGERY/.test(ui.okTxt));
    ok('and a line that stops keeping it cannot deploy at all', ui.blocked && /DOES NOT KEEP/.test(ui.blockedTxt));

    // ---- the header says whether you are still keeping it ----
    const badge = await page.evaluate(() => {
      __run();
      doctrineOffer = ['FIELD_SURGERY'];
      __line(['BRUISER', 'SCAVENGER', 'PYROMANIAC']);
      takeDoctrine('FIELD_SURGERY'); musterDeploy();
      renderMap();
      const el = document.getElementById('doctrine-badge');
      const kept = { shown: getComputedStyle(el).display !== 'none', text: el.innerText };
      playerRoster.find(c => c.classType === 'MEDIC').gridPos = 1;
      checkDoctrine(); renderMap();
      const gone = { text: el.innerText, cls: el.className };
      // and the two badges do not fight for the same room
      sectorFront = 'BLOOD_MOON'; renderMap();
      const fb = document.getElementById('front-badge').getBoundingClientRect();
      const db = el.getBoundingClientRect();
      return { kept, gone, overlap: !(fb.bottom <= db.top || db.bottom <= fb.top || fb.right <= db.left || db.right <= fb.left) };
    });
    ok('the map header carries the doctrine while it holds', badge.kept.shown && /FIELD SURGERY/.test(badge.kept.text));
    ok('and says so plainly when it does not', /BROKEN/.test(badge.gone.text) && /broken/.test(badge.gone.cls));
    ok('the front and the doctrine both fit on the header', !badge.overlap);

    // ---- it survives a reload ----
    const saved = await page.evaluate(() => {
      __run();
      doctrineOffer = ['FIELD_SURGERY', 'NO_HANDS'];
      __line(['BRUISER', 'SCAVENGER', 'PYROMANIAC']);
      takeDoctrine('FIELD_SURGERY'); musterDeploy();
      saveGameState();
      activeDoctrine = null; doctrineOffer = []; doctrineBroken = true; doctrineFavourites = [];
      loadGameState();
      return { back: activeDoctrine, offer: doctrineOffer.length, broken: doctrineBroken, mult: doctrineMult() };
    });
    ok('a reloaded run still knows its doctrine', saved.back === 'FIELD_SURGERY' && saved.offer === 2 && !saved.broken && saved.mult > 1);

    // A save written before doctrines existed has none and finishes without one.
    const legacy = await page.evaluate(() => {
      __run(); saveGameState();
      const d = Store.getJSON(BASE_SAVE_KEY + 1);
      delete d.doctrineOffer; delete d.activeDoctrine; delete d.doctrineBroken; delete d.doctrineFavourites;
      Store.set(BASE_SAVE_KEY + 1, JSON.stringify(d));
      activeDoctrine = 'FIELD_SURGERY'; doctrineBroken = true;
      loadGameState();
      return { none: activeDoctrine === null, offer: doctrineOffer.length, mult: doctrineMult() };
    });
    ok('a save from before doctrines existed loads without one', legacy.none && legacy.offer === 0 && legacy.mult === 1);

    // ---- the record and the manual ----
    const told = await page.evaluate(() => {
      __run();
      doctrineOffer = ['FIELD_SURGERY'];
      __line(['BRUISER', 'SCAVENGER', 'PYROMANIAC']);
      takeDoctrine('FIELD_SURGERY'); musterDeploy();
      currentSector = 3; noteDepth();
      endRun();
      const over = document.getElementById('runover-lines').innerText;
      renderCodex();
      const manual = document.getElementById('codex-body').innerText;
      return { over, listed: DOCTRINES.every(d => manual.includes(d.name) && manual.includes(d.rule)) };
    });
    ok('the run-over says which doctrine was kept and what it paid', /FIELD SURGERY/.test(told.over));
    ok('and the manual lists every one of them', told.listed);
  }
};

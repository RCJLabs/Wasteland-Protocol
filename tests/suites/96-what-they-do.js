// E05: every one of the eight commanders has an authored intent table. Not one of the eighteen
// rank-and-file types did - `grep -n 'intents:'` returned nine hits, all of them BOSS_POOL plus
// the copy onto the boss entity - so eighteen units shared one fallback that forks three ways on
// classType and range, with FLANK gated on speed inside it.
//
// Eight of the eighteen carry a passive or an on-death signature and so never roll SIG at all,
// which means the fallback governed 100% of their turns. Measured at 40,000 rolls each, those
// eight collapsed into three tables:
//
//   ATTACK 55 / HEAVY 20 / FLANK 15 / DEFEND 10   Attack Dog, Psycho, Carrion Rat
//   ATTACK 70 / HEAVY 20 / DEFEND 10              Juggernaut, Reliquary
//   ATTACK 70 / STATUS 20 / AOE 10                Drone, Blight Moth, Chem Fiend
//
// A 90hp riot-plated Juggernaut and an 85hp martyr-bomb Reliquary took identical turns. So did a
// gun drone, a spore moth and a walking gas bomb. Eighteen types, four distinct behaviours.
//
// The tables are authored on machinery that already existed and already ran. What keeps eighteen
// new tables from being a balance change wearing a data hat is the band: INTENT_THREAT prices a
// turn of each intent off enemyStrike, and every table has to land within 10% of the expected
// damage of the fallback it replaced. All three fallback branches come out near 1.00, so the
// tables change what a unit does on its turn without changing what the turn is worth.
module.exports = {
  name: 'What they do the other turns',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    const fight = () => page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5;
      initiateCombat('RAIDERS', false);
    });

    // ── Every type carries one, and the validator says so ──────────────────────────────
    const tables = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const pool = Object.values(ENEMY_POOL).flat();
      return { bad: validateIntents(), total: pool.length,
               withTable: pool.filter(u => Array.isArray(u.intents) && u.intents.length).length,
               bossTables: BOSS_POOL.filter(b => Array.isArray(b.intents)).length };
    });
    ok(`the boot validator finds nothing wrong (${tables.bad.join('; ') || 'clean'})`, tables.bad.length === 0);
    ok(`all ${tables.total} rank-and-file types carry a table now (${tables.withTable})`,
      tables.withTable === tables.total && tables.total === 18);
    ok(`and the commanders still carry theirs (${tables.bossTables})`, tables.bossTables === 8);

    // ── Each table is worth what the fallback it replaced was worth ────────────────────
    // Priced through the engine's own model, not one retyped here - a test that carries its own
    // copy of the arithmetic proves the copy, which is the mistake E03 was about.
    const band = await page.evaluate(() => {
      const rows = Object.values(ENEMY_POOL).flat().map(u => ({
        name: u.name, now: intentThreat(u.intents), was: intentThreat(INTENT_FALLBACK[fallbackFor(u)])
      }));
      const drift = rows.map(r => ({ name: r.name, d: (r.now - r.was) / r.was }));
      const worst = drift.reduce((a, b) => Math.abs(b.d) > Math.abs(a.d) ? b : a);
      return { worst, band: INTENT_BAND, over: drift.filter(r => Math.abs(r.d) > INTENT_BAND).map(r => r.name),
               fallbacks: Object.keys(INTENT_FALLBACK).map(k => +intentThreat(INTENT_FALLBACK[k]).toFixed(3)) };
    });
    ok(`the three fallback branches are all worth about one swing (${band.fallbacks.join(', ')})`,
      band.fallbacks.every(v => Math.abs(v - 1) <= 0.035));
    ok(`no table drifts outside the band (worst ${band.worst.name} ${(100 * band.worst.d).toFixed(1)}%)`,
      band.over.length === 0 && Math.abs(band.worst.d) <= band.band);

    // ── The units that used to be each other are not any more ──────────────────────────
    // Rolled through rollIntent on a live field, because the gates only mean anything there.
    const spread = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5; initiateCombat('RAIDERS', false);
      const profile = name => {
        const tpl = Object.values(ENEMY_POOL).flat().find(u => u.name === name);
        const e = JSON.parse(JSON.stringify(tpl));
        e.isPlayer = false; e.hp = e.maxHp;
        const t = {};
        for (let i = 0; i < 20000; i++) { e.sigCd = 0; const it = rollIntent(e); t[it.type] = (t[it.type] || 0) + 1; }
        // Drop the signature roll: it was never the thing the fallback governed.
        const n = 20000 - (t.SIG || 0);
        return ['ATTACK', 'HEAVY', 'AOE', 'STATUS', 'DEFEND', 'FLANK']
          .map(k => Math.round(((t[k] || 0) / n) * 20)).join('/');
      };
      const names = Object.values(ENEMY_POOL).flat().map(u => u.name);
      const shapes = Object.fromEntries(names.map(n => [n, profile(n)]));
      return { shapes, distinct: new Set(Object.values(shapes)).size, of: names.length,
               standing: activeEntities.filter(e => e.isPlayer && e.hp > 0).length };
    });
    ok(`measured with a squad actually standing (${spread.standing})`, spread.standing === 3);
    ok(`all ${spread.of} types now take a different turn (${spread.distinct} distinct profiles)`,
      spread.distinct === spread.of);
    ok(`the Juggernaut and the Reliquary are no longer the same unit (${spread.shapes['Juggernaut']} against ${spread.shapes['Reliquary']})`,
      spread.shapes['Juggernaut'] !== spread.shapes['Reliquary']);
    ok(`nor the gun drone, the spore moth and the gas bomb (${spread.shapes['Drone']}, ${spread.shapes['Blight Moth']}, ${spread.shapes['Chem Fiend']})`,
      new Set([spread.shapes['Drone'], spread.shapes['Blight Moth'], spread.shapes['Chem Fiend']]).size === 3);

    // ── The two conditional intents are still conditional ─────────────────────────────
    const gates = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5; initiateCombat('RAIDERS', false);
      const count = (name, type) => {
        const tpl = Object.values(ENEMY_POOL).flat().find(u => u.name === name);
        const e = JSON.parse(JSON.stringify(tpl)); e.isPlayer = false; e.hp = e.maxHp;
        let n = 0;
        for (let i = 0; i < 4000; i++) { e.sigCd = 0; if (rollIntent(e).type === type) n++; }
        return n;
      };
      const dogFlanks = count('Attack Dog', 'FLANK');
      activeRelics.push({ id: 'SIGNAL_JAMMER' });
      const jammed = count('Attack Dog', 'FLANK');
      activeRelics = activeRelics.filter(r => r.id !== 'SIGNAL_JAMMER');
      const rigAoe = count('War Rig', 'AOE');
      // Take the line down to one. An area attack on a line of one is strictly a wasted turn.
      const line = activeEntities.filter(e => e.isPlayer && e.hp > 0);
      line.slice(1).forEach(p => { p.hp = 0; });
      const aloneAoe = count('War Rig', 'AOE');
      line.forEach(p => { p.hp = p.maxHp; });
      return { dogFlanks, jammed, rigAoe, aloneAoe };
    });
    ok(`a fast beast still goes round the line (${gates.dogFlanks} of 4000)`, gates.dogFlanks > 1200);
    ok('and the relic bought to stop it still stops it', gates.jammed === 0);
    ok(`a rig shells a standing line (${gates.rigAoe} of 4000)`, gates.rigAoe > 500);
    ok('but never a line of one, where the same turn lands less than a plain swing',
      gates.aloneAoe === 0);

    // ── The rider is declared, so a rename cannot lose it ─────────────────────────────
    const rider = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 3; currentTier = 8;
      const tpl = ENEMY_POOL.BEASTS.find(u => u.name === 'Attack Dog');
      const plain = JSON.parse(JSON.stringify(tpl)); plain.isPlayer = false;
      const elite = JSON.parse(JSON.stringify(tpl)); elite.isPlayer = false;
      elite.eliteTypes = ['FRENZIED']; elite.eliteType = 'FRENZIED';
      elite.name = `*${elite.eliteTypes.join(' ')}* ${elite.name}`;
      const oldList = ["Mutant", "Attack Dog", "War Hound", "Chem Fiend"];
      return {
        plain: !!riderOf(plain), elite: !!riderOf(elite),
        oldPlain: oldList.includes(plain.name), oldElite: oldList.includes(elite.name),
        renamed: elite.name,
        // "War Hound" is the player's own class - it sat in a list only ever checked on hostiles.
        deadEntry: !Object.values(ENEMY_POOL).flat().some(u => u.name === 'War Hound')
                   && ROSTER_TEMPLATE.some(t => t.name === 'War Hound'),
        carriers: Object.values(ENEMY_POOL).flat().filter(u => u.rider).map(u => u.name)
      };
    });
    ok(`three types carry the rider (${rider.carriers.join(', ')})`, rider.carriers.length === 3);
    ok(`the old list would still have matched a plain one (${rider.oldPlain})`, rider.plain && rider.oldPlain);
    ok(`but not a renamed one (${rider.renamed})`, rider.oldElite === false);
    ok('the fourth name on that list was the player\u2019s own hound, in a branch that only runs on hostiles',
      rider.deadEntry === true);

    // What actually matters is the hit, not the lookup: send a plain one and an elite one through
    // executeEnemyAi and read the wound off the operator they struck.
    const bit = await page.evaluate(() => {
      const strike = elite => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 3; currentTier = 8; initiateCombat('RAIDERS', false);
        activeEntities = activeEntities.filter(e => e.isPlayer);
        turnQueue = turnQueue.filter(e => e.isPlayer);
        activeEntities.forEach(p => { p.hp = p.maxHp = 9999; p.bleedingTurns = 0; p.stunnedTurns = 0; p.armor = 0; });
        const dog = JSON.parse(JSON.stringify(ENEMY_POOL.BEASTS.find(u => u.name === 'Attack Dog')));
        dog.id = 'bite'; dog.isPlayer = false; dog.hp = dog.maxHp; dog.sigCd = 9; dog.burrowed = 0;
        dog.intent = { type: 'ATTACK', icon: '\u2694\ufe0f' };
        if (elite) { dog.eliteTypes = ['FRENZIED']; dog.eliteType = 'FRENZIED'; dog.name = `*FRENZIED* ${dog.name}`; }
        activeEntities.push(dog); turnQueue.push(dog);
        executeEnemyAi(dog);
        return activeEntities.filter(e => e.isPlayer)
          .some(p => (p.bleedingTurns || 0) > 0 || (p.stunnedTurns || 0) > 0);
      };
      return { plain: strike(false), elite: strike(true) };
    });
    ok('a plain one leaves a mark on whoever it lands on', bit.plain === true);
    ok('and so does the elite version, which is the whole point of taking it off the name',
      bit.elite === true);

    // ── And it is said out loud, in the file and on the card ──────────────────────────
    await fight();
    const said = await page.evaluate(() => {
      // An identical sig tag already on the field renders as an echo, and an echo deliberately
      // carries no tooltip - so this one has to be the only PACK HUNT standing, or the read is a
      // coin flip on whether the draw happened to include a real Attack Dog.
      activeEntities = activeEntities.filter(e => e.isPlayer);
      turnQueue = turnQueue.filter(e => e.isPlayer);
      const dog = JSON.parse(JSON.stringify(ENEMY_POOL.BEASTS.find(u => u.name === 'Attack Dog')));
      dog.id = 'ridertest'; dog.isPlayer = false; dog.hp = dog.maxHp; dog.gridPos = 0;
      dog.intent = { type: 'ATTACK', icon: '⚔️' };
      activeEntities.push(dog); turnQueue.push(dog);
      renderField();
      const tag = document.getElementById('ridertest').querySelector('.sig-tag');
      openDossier('ridertest');
      const kinds = [...document.querySelectorAll('#dossier .dossier-sig-kind')].map(e => e.innerText);
      const body = document.getElementById('dossier').innerText;
      closeDossier();
      activeEntities = activeEntities.filter(e => e.id !== 'ridertest');
      turnQueue = turnQueue.filter(e => e.id !== 'ridertest');
      return { title: tag ? tag.title : '', kinds, mentions: /bleeds/.test(body) };
    });
    ok(`the file gives it a line of its own (${said.kinds.join(', ')})`, said.kinds.includes('RIDER'));
    ok('and says what it does', said.mentions);
    ok('the field tag carries it in the tooltip, without taking a second slot on the card',
      /bleeds/.test(said.title) && said.title.length > 0);

    // ── Two deterministic turns the threat board used to price at nothing ─────────────
    const board = await page.evaluate(() => {
      const read = (build) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 3; currentTier = 8; initiateCombat('RAIDERS', false);
        activeEntities = activeEntities.filter(e => e.isPlayer);
        turnQueue = turnQueue.filter(e => e.isPlayer);
        const foe = build();
        activeEntities.push(foe); turnQueue.push(foe);
        const b = threatBoard();
        const total = Object.values(b).reduce((a, v) => a + v.dmg, 0);
        return { total, forecast: forecastFor(foe) };
      };
      const worm = read(() => {
        const w = JSON.parse(JSON.stringify(ENEMY_POOL.CARRION.find(u => u.name === 'Gorge Worm')));
        w.id = 'w1'; w.isPlayer = false; w.hp = w.maxHp; w.burrowed = 1; w.intent = { type: 'ATTACK' };
        return w;
      });
      const mut = read(() => {
        const m = JSON.parse(JSON.stringify(ENEMY_POOL.BEASTS.find(u => u.name === 'Mutant')));
        m.id = 'm1'; m.isPlayer = false; m.hp = m.maxHp; m.burrowed = 0;
        m.intent = { type: 'SIG', sig: 'DRAG_DOWN' };
        return m;
      });
      const quiet = read(() => {
        const a = JSON.parse(JSON.stringify(ENEMY_POOL.CHOIR.find(u => u.name === 'Acolyte')));
        a.id = 'a1'; a.isPlayer = false; a.hp = a.maxHp; a.intent = { type: 'SIG', sig: 'LITANY' };
        return a;
      });
      return { worm, mut, quiet };
    });
    const aimedAt = f => ((f || {}).hits || [])[0] ? f.hits[0].target.gridPos : null;
    ok(`a hostile under the ground is priced, not skipped (${board.worm.total})`,
      board.worm.total > 0 && board.worm.forecast.kind === 'BURROW' && (board.worm.forecast.hits || []).length === 1);
    ok(`and it is aimed at whoever is holding the front, which is where it comes up (rank ${aimedAt(board.worm.forecast)})`,
      aimedAt(board.worm.forecast) === 1);
    ok(`a drag is priced too (${board.mut.total})`, board.mut.total > 0 && (board.mut.forecast.hits || []).length === 1);
    ok(`and aimed at the operator furthest back, which is the one it reaches past the line for (rank ${aimedAt(board.mut.forecast)})`,
      aimedAt(board.mut.forecast) === 3);
    ok('while a signature that deals nothing still shows nothing, because it deals nothing',
      board.quiet.total === 0 && !board.quiet.forecast.hits);

    // ── The one icon the fallback minted by hand meant something else ─────────────────
    const icon = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5; initiateCombat('RAIDERS', false);
      // A unit built field-by-field rather than copied from a template - a lieutenant, a ward
      // generator - is what still reaches the fallback, so drive one of those.
      const spec = { id: 'spec1', name: 'Lieutenant', classType: 'RAIDER', range: 'ranged',
                     maxHp: 60, hp: 60, speed: 10, dmgBase: 14, isPlayer: false, sigCd: 0 };
      let found = null;
      for (let i = 0; i < 4000 && !found; i++) { const it = rollIntent(spec); if (it.type === 'STATUS') found = it; }
      return { icon: found && found.icon, table: INTENT_ICONS.STATUS, mark: '🎯',
               hasTable: !!spec.intents };
    });
    ok('a spec-built unit still falls back, because it has no table of its own', icon.hasTable === false);
    ok(`its status intent draws the status icon (${icon.icon})`, icon.icon === icon.table);
    ok('and not the mark pin, which already means a target is marked', icon.icon !== icon.mark);
  }
};

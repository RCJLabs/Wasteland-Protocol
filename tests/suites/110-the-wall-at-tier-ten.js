// F01. Sixty careers on the harness put 325 of 383 wipes at tier ten, and the audit that
// counted them found the same fight is where the screen stops telling the truth:
//
//   * the Colossus's OVERLOAD salvo was invisible to the forecast and the threat board, and
//     the icon over a charging Colossus was a HEAVY or an AOE it could not perform - the AI's
//     wind-up branch returned before the intent was ever executed but rolled a fresh one every
//     turn anyway;
//   * DRAG_DOWN's forecast priced the blow at the rank the mark was standing in, and the blow
//     lands after the haul has put them somewhere else;
//   * CALL_IT_IN handed the reinforcement a JSON clone of its caller, so an elite Raider's
//     help arrived wearing both champion affixes, the '*VAMPIRIC ARMORED*' name and the armour
//     ARMORED had bought, at patrol health and patrol damage.
//
// And two changes to the fight itself: a commander's first turn is a read rather than a blow,
// and the generator now always puts a camp within two nodes of the commander.
//
// Every number below is either driven through the real call site and compared against what
// actually landed, or hardcoded from the design - never read back out of the table the engine
// reads, which proves the table rather than the behaviour.
module.exports = {
  name: 'The wall at tier ten',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // buildNewRun re-rolls bossSalt and so reshuffles the rotation: pin it, then look the
    // sector up under the same pin, or the harness asks for one commander and stages another.
    await page.evaluate(() => {
      window.__PIN = 'suite110';
      window.__sectorOf = id => { for (let s = 1; s <= 40; s++) if (bossForSector(s).id === id) return s; return null; };
      window.__stage = (id, g) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        bossSalt = window.__PIN;
        grudges = {}; if (g) grudges[id] = g;
        currentSector = window.__sectorOf(id); currentTier = 10;
        initiateCombat('BOSS', false);
        const boss = activeEntities.find(e => e.classType === 'BOSS');
        // The retinue is a separate problem and its own forecast; every probe here is about
        // one commander, so the field is cut down to the squad and it.
        activeEntities = activeEntities.filter(e => e.isPlayer || e.id === boss.id);
        turnQueue = turnQueue.filter(e => e.isPlayer || e.id === boss.id);
        return boss;
      };
      // Nothing here wants the turn after the one it drove: the AI's wind-up and opening-turn
      // branches both hand the fight on with a timer, and a probe that leaves one armed is a
      // probe that corrupts the next one.
      window.__quiet = () => { combatActive = false; };
    });

    // ── The wind-up, on the board ──────────────────────────────────────────────────────
    const wind = await page.evaluate(() => {
      const boss = window.__stage('COLOSSUS', 2);
      // A grudge phase opens under a quarter health, which is deep into a fight: the opening
      // read was spent many turns ago. Its own probe is below.
      boss.sizeUp = false;
      const rolled = boss.intent.type;
      boss.phase = 2; boss.hp = Math.floor(boss.maxHp * 0.2);
      openGrudgePhase(boss);
      const winding = { type: boss.intent.type, icon: boss.intent.icon,
                        charging: boss.charging, turns: boss.chargeSpec.turns };
      const fWind = forecastFor(boss);
      const boardWind = Object.values(threatBoard()).reduce((a, v) => a + v.dmg, 0);
      renderField();
      const drawnWinding = document.getElementById(boss.id).querySelector('.intent-icon').innerText;

      // Wound all the way up: the next turn is the salvo.
      boss.charging = boss.chargeSpec.turns;
      boss.intent = chargeIntent(boss);
      const ready = { type: boss.intent.type, icon: boss.intent.icon };
      renderField();
      const drawnReady = document.getElementById(boss.id).querySelector('.intent-icon').innerText;
      const fReady = forecastFor(boss);
      const boardReady = Object.values(threatBoard()).reduce((a, v) => a + v.dmg, 0);

      const live = activeEntities.filter(e => e.isPlayer && e.hp > 0);
      // A wide bar so nobody goes down mid-salvo: a downed operator stops at zero and the
      // comparison would be measuring the floor rather than the blow.
      live.forEach(p => { p.maxHp = 99999; p.hp = 99999; });
      const again = forecastFor(boss);
      const said = {}; (again.hits || []).forEach(h => { said[h.target.id] = h.dmg; });
      const before = {}; live.forEach(p => { before[p.id] = p.hp; });
      executeEnemyAi(boss);
      const landed = {}; live.forEach(p => { landed[p.id] = before[p.id] - p.hp; });
      const afterFiring = boss.intent.type;
      window.__quiet();
      return { rolled, winding, fWindKind: fWind.kind, fWindHits: (fWind.hits || []).length, boardWind,
               drawnWinding, ready, drawnReady, fReadyKind: fReady.kind,
               fReadyHits: (fReady.hits || []).length, boardReady, liveCount: live.length,
               said, landed, afterFiring, charging: boss.charging,
               chargeIcon: INTENT_ICONS.CHARGE, salvoIcon: INTENT_ICONS.SALVO };
    });
    ok(`a commander that opens a wind-up wears the wind-up (${wind.winding.type}, was ${wind.rolled})`,
      wind.winding.type === 'CHARGE');
    ok(`the forecast for that turn is the wind-up and it lands nothing (${wind.fWindKind}, ${wind.fWindHits} hits)`,
      wind.fWindKind === 'CHARGE' && wind.fWindHits === 0);
    ok(`so the board asks the squad to survive nothing that turn (${wind.boardWind})`, wind.boardWind === 0);
    ok(`and the icon drawn over it is the wind-up's, not a table roll (${wind.drawnWinding})`,
      wind.drawnWinding === wind.chargeIcon && wind.drawnWinding !== '');
    ok(`wound all the way up, the icon says the salvo is next (${wind.ready.type} ${wind.drawnReady})`,
      wind.ready.type === 'SALVO' && wind.drawnReady === wind.salvoIcon);
    ok(`the forecast is the whole line, one hit per operator standing (${wind.fReadyHits} of ${wind.liveCount})`,
      wind.fReadyKind === 'SALVO' && wind.fReadyHits === wind.liveCount && wind.liveCount > 1);
    ok(`and the board carries it rather than omitting it (${wind.boardReady})`, wind.boardReady > 0);
    const saidIds = Object.keys(wind.said);
    ok(`every operator the board named took exactly what it said (${saidIds.map(i => `${wind.said[i]}/${wind.landed[i]}`).join(' ')})`,
      saidIds.length > 1 && saidIds.every(i => wind.said[i] === wind.landed[i] && wind.said[i] > 0));
    ok(`and having fired, it is winding up again (${wind.afterFiring}, ${wind.charging} of ${wind.winding.turns})`,
      wind.afterFiring === 'CHARGE' && wind.charging === 0);

    // Every turn of a wind-up, taken through the AI rather than set by hand. This is where the
    // lie lived: the branch returns before the intent is ever executed, and rolled a fresh one
    // from the table on the way out, so the icon over a charging commander was a blow it could
    // not make. Driven at the authored turn count and again at three, because a one-turn
    // wind-up never shows an intermediate turn at all.
    const turns = await page.evaluate(() => {
      const drive = count => {
        const boss = window.__stage('COLOSSUS', 2);
        boss.sizeUp = false;
        boss.phase = 2; boss.hp = Math.floor(boss.maxHp * 0.2);
        openGrudgePhase(boss);
        if (count) { boss.chargeSpec = { ...boss.chargeSpec, turns: count }; boss.intent = chargeIntent(boss); }
        const authored = boss.chargeSpec.turns;
        const live = activeEntities.filter(e => e.isPlayer && e.hp > 0);
        live.forEach(p => { p.maxHp = 99999; p.hp = 99999; });
        const pool = live.length * 99999;
        const seen = [];
        for (let i = 0; i < authored; i++) {
          executeEnemyAi(boss);
          renderField();
          seen.push({ charging: boss.charging, type: boss.intent.type,
                      icon: document.getElementById(boss.id).querySelector('.intent-icon').innerText,
                      lost: pool - live.reduce((a, p) => a + p.hp, 0) });
        }
        window.__quiet();
        return { authored, seen };
      };
      return { real: drive(null), long: drive(3),
               chargeIcon: INTENT_ICONS.CHARGE, salvoIcon: INTENT_ICONS.SALVO,
               rolled: Object.keys(INTENT_ICONS).filter(k => k !== 'CHARGE' && k !== 'SALVO') };
    });
    const windUp = r => r.seen.every(t => (t.type === 'CHARGE' || t.type === 'SALVO'));
    const drawn = (r, R) => r.seen.every(t => t.icon === (t.type === 'SALVO' ? R.salvoIcon : R.chargeIcon));
    ok(`a wind-up turn taken through the AI never wears a blow it cannot make (${turns.real.seen.map(t => t.type).join(', ')})`,
      windUp(turns.real) && turns.real.seen.length === turns.real.authored);
    ok(`and at three turns of it, the icon is the wind-up until the counter is full (${turns.long.seen.map(t => `${t.charging}:${t.type}`).join(' ')})`,
      windUp(turns.long) && turns.long.seen.length === 3
      && turns.long.seen.slice(0, 2).every(t => t.type === 'CHARGE') && turns.long.seen[2].type === 'SALVO');
    ok(`the icon drawn on the field matches, every turn (${turns.long.seen.map(t => t.icon).join('')})`,
      drawn(turns.real, turns) && drawn(turns.long, turns));
    ok(`and none of those turns takes anything off the squad (${turns.long.seen.map(t => t.lost).join(',')})`,
      turns.real.seen.every(t => t.lost === 0) && turns.long.seen.every(t => t.lost === 0));

    // BREAK reads the telegraph, not the unit. A wind-up reports no damage on the turn it is
    // winding - correctly - so the one thing on the field worth stunning scored nothing.
    const brk = await page.evaluate(() => {
      const boss = window.__stage('COLOSSUS', 2);
      boss.phase = 2; boss.hp = Math.floor(boss.maxHp * 0.2);
      openGrudgePhase(boss);
      boss.charging = 0;
      const r = JSON.parse(JSON.stringify(ENEMY_POOL.RAIDERS.find(u => u.name === 'Raider')));
      r.id = 'rival'; r.isPlayer = false; r.hp = r.maxHp = 40; r.dmgBase = 6; r.speed = 10;
      r.sig = null; r.sigCd = 0; r.intent = intentFor('ATTACK', r);
      activeEntities.push(r); turnQueue.push(r);
      const rivalThreat = (forecastFor(r).hits || []).reduce((a, h) => a + h.dmg, 0);
      const picked = breakTarget();
      window.__quiet();
      return { picked: picked ? picked.id : null, bossId: boss.id, rivalThreat };
    });
    ok(`a rival with a real swing on the board is a real competitor (${brk.rivalThreat})`,
      brk.rivalThreat > 0 && brk.rivalThreat < 60);
    ok('and BREAK still answers the wind-up over it', brk.picked === brk.bossId);

    // ── A drag is priced where the drag puts them ─────────────────────────────────────
    const drag = await page.evaluate(() => {
      const set = terrain => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 3; currentTier = 8; initiateCombat('BEASTS', false);
        currentTerrain = terrain;
        activeEntities = activeEntities.filter(e => e.isPlayer);
        turnQueue = turnQueue.filter(e => e.isPlayer);
        const live = activeEntities.filter(e => e.isPlayer && e.hp > 0);
        live.forEach(p => { p.maxHp = 99999; p.hp = 99999; p.guardTurns = 0; });
        const m = JSON.parse(JSON.stringify(ENEMY_POOL.BEASTS.find(u => u.name === 'Mutant')));
        m.id = 'm1'; m.isPlayer = false; m.hp = m.maxHp; m.burrowed = 0; m.sigCd = 0;
        m.intent = { type: 'SIG', sig: 'DRAG_DOWN', icon: 'x' };
        activeEntities.push(m); turnQueue.push(m);
        const posBefore = live.map(p => p.gridPos).join(',');
        const f = forecastFor(m);
        const posAfter = live.map(p => p.gridPos).join(',');
        const mark = f.hits[0].target;
        const said = f.hits[0].dmg;
        // What the board used to say: the same blow, priced at the rank the mark is leaving.
        const wasRank = mark.gridPos;
        const old = mitigate(m, mark, Math.floor((m.dmgBase + 4) * enemyDmgMult(m)), m.dmgType || 'phys', 'BASIC').n;
        const hp0 = mark.hp;
        executeEnemyAi(m);
        const landed = hp0 - mark.hp;
        const nowRank = mark.gridPos;
        window.__quiet();
        return { said, old, landed, wasRank, nowRank, posBefore, posAfter, ranks: live.length };
      };
      return { ruins: set('RUINS'), open: set('OPEN_ROAD') };
    });
    ok(`the mark is still the operator furthest back (rank ${drag.ruins.wasRank} of ${drag.ruins.ranks})`,
      drag.ruins.wasRank === drag.ruins.ranks && drag.ruins.ranks >= 3);
    ok(`and the drag really does haul them to the front (rank ${drag.ruins.wasRank} -> ${drag.ruins.nowRank})`,
      drag.ruins.nowRank === 1);
    ok('reading the forecast moves nobody', drag.ruins.posBefore === drag.ruins.posAfter
      && drag.open.posBefore === drag.open.posAfter);
    ok(`in ruins the board now says what lands (said ${drag.ruins.said}, landed ${drag.ruins.landed})`,
      drag.ruins.said === drag.ruins.landed);
    ok(`priced at the rank they are leaving it would have over-promised (${drag.ruins.old} against ${drag.ruins.landed})`,
      drag.ruins.old > drag.ruins.landed);
    ok(`on open ground, where the rank buys nothing, both readings agree (${drag.open.said}/${drag.open.old}/${drag.open.landed})`,
      drag.open.said === drag.open.landed && drag.open.old === drag.open.landed);

    // ── The raider who comes running is a raider ──────────────────────────────────────
    // Stock Raider, hardcoded from the design rather than read back out of ENEMY_POOL: armour
    // 0, speed 10. A test that reads the same row the fix reads proves the row.
    const call = await page.evaluate(() => {
      const whistle = champion => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 3; currentTier = 8; initiateCombat('RAIDERS', false);
        activeEntities = activeEntities.filter(e => e.isPlayer);
        turnQueue = turnQueue.filter(e => e.isPlayer);
        const r = JSON.parse(JSON.stringify(ENEMY_POOL.RAIDERS.find(u => u.name === 'Raider')));
        r.id = 'caller'; r.isPlayer = false; r.hp = r.maxHp; r.sig = 'CALL_IT_IN'; r.sigCd = 0;
        if (champion) {
          r.eliteTypes = ['VAMPIRIC', 'ARMORED']; r.eliteType = 'VAMPIRIC';
          r.name = '*VAMPIRIC ARMORED* Raider'; r.armor = 22; r.baseArmor = 22; r.speed = 14;
        }
        r.intent = { type: 'SIG', sig: 'CALL_IT_IN', icon: 'x' };
        activeEntities.push(r); turnQueue.push(r);
        executeEnemyAi(r);
        const help = activeEntities.find(e => !e.isPlayer && e.id !== 'caller');
        window.__quiet();
        return help ? { name: help.name, affixes: affixesOn(help), vamp: hasAffix(help, 'VAMPIRIC'),
                        armor: help.armor, baseArmor: help.baseArmor, speed: help.speed,
                        sig: help.sig, hp: help.hp, maxHp: help.maxHp, img: help.img,
                        cls: help.classType, range: help.range,
                        callerName: r.name, callerArmor: r.armor, callerAffixes: affixesOn(r).length }
                    : null;
      };
      return { elite: whistle(true), plain: whistle(false) };
    });
    ok('an elite caller does whistle somebody up', !!call.elite && !!call.plain);
    ok(`and what arrives is a Raider, not the champion who called it (${call.elite.name})`,
      call.elite.name === 'Raider');
    ok(`carrying neither affix (${call.elite.affixes.join(', ') || 'none'})`,
      call.elite.affixes.length === 0 && call.elite.vamp === false);
    ok(`nor the armour ARMORED bought (${call.elite.armor}/${call.elite.baseArmor})`,
      call.elite.armor === 0 && call.elite.baseArmor === 0);
    ok(`nor the speed FRENZIED would have (${call.elite.speed})`, call.elite.speed === 10);
    ok(`it is still the same kind of thing, at patrol stats (${call.elite.cls} ${call.elite.range}, ${call.elite.hp}hp)`,
      call.elite.cls === 'RAIDER' && call.elite.range === 'melee' && call.elite.img === 'enemy_raider.webp'
      && call.elite.hp === call.elite.maxHp && call.elite.sig === null);
    ok(`and the champion that called it is untouched (${call.elite.callerName}, armour ${call.elite.callerArmor})`,
      call.elite.callerAffixes === 2 && call.elite.callerArmor === 22);
    ok(`a plain caller still gets its raider, unchanged (${call.plain.name}, armour ${call.plain.armor}, speed ${call.plain.speed})`,
      call.plain.name === 'Raider' && call.plain.armor === 0 && call.plain.speed === 10);

    // ── A commander's first turn is a read ────────────────────────────────────────────
    const open = await page.evaluate(() => {
      const boss = window.__stage('WARLORD', 0);
      const flagged = boss.sizeUp === true;
      const promised = boss.intent.type;
      // Comparing the type alone would let a re-roll that happened to come up the same slip
      // through; the promise is that this object is the one that stands.
      boss.intent.__same = 'kept';
      const live = activeEntities.filter(e => e.isPlayer && e.hp > 0);
      const hp0 = live.reduce((a, p) => a + p.hp, 0);
      document.getElementById('log').innerHTML = '';
      executeEnemyAi(boss);
      const hp1 = live.reduce((a, p) => a + p.hp, 0);
      const kept = boss.intent.type; const same = boss.intent.__same === 'kept';
      const said = document.getElementById('log').innerText;
      const cleared = boss.sizeUp === false;

      // Saved and reloaded, the read is spent: reloading is not a second look.
      saveGameState(); loadGameState();
      const reloaded = (pendingCombat.enemies.find(e => e.classType === 'BOSS') || {}).sizeUp;

      // The turn after is the blow it promised.
      boss.intent = intentFor('ATTACK', boss);
      const hp2 = live.reduce((a, p) => a + p.hp, 0);
      executeEnemyAi(boss);
      const hp3 = live.reduce((a, p) => a + p.hp, 0);
      window.__quiet();
      return { flagged, promised, kept, same, cleared, reloaded, opened: hp0 - hp1, then: hp2 - hp3, said };
    });
    ok('a commander comes onto the field with its opening read still to take', open.flagged);
    ok(`and takes nothing off the squad with it (${open.opened})`, open.opened === 0);
    ok(`the icon it arrived wearing stands through it, and is not re-rolled over (${open.promised} -> ${open.kept})`,
      open.promised === open.kept && open.same === true);
    ok('the log says what it is doing', /reads your line/i.test(open.said));
    ok('the read is spent once taken', open.cleared === true);
    ok(`and a save taken after it does not hand back a second one (${open.reloaded})`, open.reloaded === false);
    ok(`the turn after, the blow lands (${open.then})`, open.then > 0);

    const patrol = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 3; currentTier = 8; initiateCombat('RAIDERS', false);
      const foes = activeEntities.filter(e => !e.isPlayer);
      const anyFlagged = foes.some(e => e.sizeUp);
      const r = foes[0];
      r.intent = intentFor('ATTACK', r);
      const live = activeEntities.filter(e => e.isPlayer && e.hp > 0);
      live.forEach(p => { p.maxHp = 99999; p.hp = 99999; });
      const hp0 = live.reduce((a, p) => a + p.hp, 0);
      executeEnemyAi(r);
      const hit = hp0 - live.reduce((a, p) => a + p.hp, 0);
      window.__quiet();
      return { anyFlagged, hit, foes: foes.length };
    });
    ok(`nothing on the roads gets an opening read (${patrol.foes} hostiles)`, patrol.anyFlagged === false);
    ok(`a patrol swings on the turn it is given (${patrol.hit})`, patrol.hit > 0);

    const escort = await page.evaluate(() => {
      const boss = window.__stage('MARSHAL', 0);
      // __stage cuts the field down to the commander; the hound is raised again by hand from
      // the same path the fight uses, which is the point - the retinue is not a commander.
      const hound = reRaiseRetinue(boss, 'escort');
      window.__quiet();
      return { has: !!hound, flagged: hound ? !!hound.sizeUp : null };
    });
    ok('the retinue is not a commander and gets no read of its own',
      escort.has === true && escort.flagged === false);

    // ── A camp within two nodes of the commander ──────────────────────────────────────
    const roads = await page.evaluate(() => {
      const sample = front => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = front;
        const maps = []; for (let i = 0; i < 80; i++) maps.push(generateSectorMap(Math.random));
        const lateOf = m => m.nodes.filter(n => n.type === 'CAMP' && n.tier >= 8);
        return {
          n: maps.length,
          valid: maps.filter(m => validateSectorMap(m)).length,
          withLate: maps.filter(m => lateOf(m).length > 0).length,
          withMid: maps.filter(m => m.nodes.some(n => n.type === 'CAMP' && n.tier >= 4 && n.tier <= 7)).length,
          tiers: [...new Set(maps.flatMap(m => lateOf(m).map(n => n.tier)))].sort(),
          forced: maps.filter(m => lateOf(m).some(c => m.nodes.filter(n => n.tier === c.tier).length < 2)).length,
          bossKept: maps.filter(m => m.nodes.filter(n => n.tier === TOTAL_TIERS).every(n => n.type === 'BOSS')).length
        };
      };
      // And the contract has teeth: take the late camp back off a good map and it fails.
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      let strippedFails = 0, stillPassed = 0;
      for (let i = 0; i < 20; i++) {
        const m = generateSectorMap(Math.random);
        if (!validateSectorMap(m)) continue;
        stillPassed++;
        m.nodes.filter(n => n.type === 'CAMP' && n.tier >= 8).forEach(n => { n.type = 'RAIDERS'; });
        if (!validateSectorMap(m)) strippedFails++;
      }
      return { plain: sample(null), quiet: sample('QUIET_ROADS'), strippedFails, stillPassed };
    });
    ok(`every map still validates (${roads.plain.valid}/${roads.plain.n} plain, ${roads.quiet.valid}/${roads.quiet.n} quiet roads)`,
      roads.plain.valid === roads.plain.n && roads.quiet.valid === roads.quiet.n);
    ok(`and every one of them has a camp within two nodes of the commander (${roads.plain.withLate}/${roads.plain.n})`,
      roads.plain.withLate === roads.plain.n);
    ok(`including under a front that spends nodes on other things (${roads.quiet.withLate}/${roads.quiet.n})`,
      roads.quiet.withLate === roads.quiet.n);
    ok(`it sits at tier 8 or 9, never on the commander itself (${roads.plain.tiers.join('/')})`,
      roads.plain.tiers.length > 0 && roads.plain.tiers.every(t => t === 8 || t === 9));
    ok(`and never as the only way through, so it is a choice against a fight (${roads.plain.forced} forced)`,
      roads.plain.forced === 0);
    ok(`the mid-road camp is still there too (${roads.plain.withMid}/${roads.plain.n})`,
      roads.plain.withMid === roads.plain.n);
    ok(`the commander still holds tier ${10} alone (${roads.plain.bossKept}/${roads.plain.n})`,
      roads.plain.bossKept === roads.plain.n);
    ok(`and the contract fails a map the camp is taken back out of (${roads.strippedFails}/${roads.stillPassed})`,
      roads.stillPassed > 0 && roads.strippedFails === roads.stillPassed);
  }
};

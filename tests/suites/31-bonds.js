// The roster was seven mercenaries who happened to share a screen. Bonds make pairs of them
// matter: fights survived together buy a damage edge, then a step-in on a killing blow, then
// a shared overdrive discount - and every pair carries a name.
module.exports = {
  name: 'Bonds',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- every pair has a name ----
    const names = await page.evaluate(() => {
      const classes = [...new Set(ROSTER_TEMPLATE.map(c => c.classType))];
      const missing = [];
      for (let i = 0; i < classes.length; i++)
        for (let j = i + 1; j < classes.length; j++) {
          const k = [classes[i], classes[j]].sort().join('|');
          if (!BOND_NAMES[k]) missing.push(k);
        }
      return { count: Object.keys(BOND_NAMES).length, classes: classes.length, missing,
               stray: BOND_NAMES['HOUND|MEDIC'],
               unique: new Set(Object.values(BOND_NAMES)).size };
    });
    ok(`all ${names.count} pairings of ${names.classes} classes are named`, names.count === 21 && names.missing.length === 0);
    ok('every name unique', names.unique === 21);
    ok('the Medic and the Hound are "Stray"', names.stray === 'Stray');

    // ---- levels come from fights together ----
    const levels = await page.evaluate(() => {
      const at = c => { bonds = { 'x|y': c }; return bondLevel('x', 'y'); };
      const r = [at(0), at(3), at(4), at(9), at(10), at(17), at(18), at(40)];
      bonds = {};
      return r.join(',');
    });
    ok(`the thresholds hold (${levels})`, levels === '0,0,1,1,2,2,3,3');

    // ---- victory records every deployed pair ----
    const recorded = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach((c, i) => { c.gridPos = i < 3 ? i + 1 : 0; });
      const [a, b, c] = playerRoster;
      const bench = playerRoster[3];
      recordBonds();
      const pairs = Object.keys(bonds).length;
      const each = bondCount(a.id, b.id) === 1 && bondCount(a.id, c.id) === 1 && bondCount(b.id, c.id) === 1;
      const benchOut = bondCount(a.id, bench.id) === 0;
      bonds[bondKey(a.id, b.id)] = 3;
      recordBonds();
      const levelled = bondLevel(a.id, b.id) === 1;
      const line = [...document.getElementById('log').children].some(el => /Bond deepened/.test(el.innerText));
      return { pairs, each, benchOut, levelled, line };
    });
    ok('a won fight counts once for every deployed pair', recorded.pairs === 3 && recorded.each);
    ok('the bench is not in the fight', recorded.benchOut);
    ok('crossing a threshold announces itself in the log', recorded.levelled && recorded.line);

    // ---- fixture: two operators, a clean enemy ----
    await page.evaluate(() => {
      window.__bondFight = (count) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null; initiateCombat('RAIDERS', false);
        const a = playerRoster.find(h => h.classType === 'BRUISER');
        const b = playerRoster.find(h => h.classType === 'MEDIC');
        [a, b].forEach((h, i) => {
          h.gridPos = i + 1; h.maxHp = 1000; h.hp = 1000;
          h.quirk = null; h.weaponMod = null; h.trinket = null; h.traits = []; h.stunnedTurns = 0;
          Object.keys(h.cooldowns).forEach(k => h.cooldowns[k] = 0);
        });
        a.dmgBase = 100;
        const foes = [];
        for (let i = 0; i < 2; i++) {
          const f = generateEnemies('RAIDERS', 1, false, 1)[0];
          f.id = 'bondfoe' + i; f.maxHp = 100000; f.hp = 100000; f.armor = 0; f.baseArmor = 0;
          f.resistances = { phys: 0, bio: 0, energy: 0 };
          f.bleedingTurns = 0; f.oiledTurns = 0; f.stunnedTurns = 0; f.corrodedTurns = 0; f.markedTurns = 0;
          foes.push(f);
        }
        activeEntities = [a, b, ...foes]; turnQueue = [a, b, ...foes];
        activeIndex = 0; combatActive = true; pendingAction = null; currentWeather = null; momentumFocus = 0;
        bonds = {}; bondSavesUsed = new Set(); sectorFront = null;
        if (count) bonds[bondKey(a.id, b.id)] = count;
        return { a, b, foes };
      };
    });

    // ---- level I: +5% while both stand ----
    const edge = await page.evaluate(() => {
      const avg = (count, dead) => {
        let t = 0;
        for (let i = 0; i < 14; i++) {
          const f = window.__bondFight(count);
          if (dead) f.b.hp = 0;
          activeIndex = 0; combatActive = true; pendingAction = 'SCRAP_BLADE';
          const before = f.foes[0].hp; resolveAction(f.foes[0].id); t += before - f.foes[0].hp;
        }
        return t / 14;
      };
      return { bonded: avg(4) / avg(0), alone: avg(4, true) / avg(0, true) };
    });
    ok(`a standing partner is worth +5% (x${edge.bonded.toFixed(2)})`, edge.bonded > 1.01 && edge.bonded < 1.09);
    ok(`a fallen one is worth nothing (x${edge.alone.toFixed(2)})`, edge.alone > 0.96 && edge.alone < 1.04);

    // ---- level II: the step-in ----
    const stepIn = await page.evaluate(() => {
      let f = window.__bondFight(10);
      f.a.hp = 5;
      runStats.bondSaves = 0;
      applyDamageHit(f.foes[0], f.a, 50, 'phys', 'CLAW');
      const saved = { aHp: f.a.hp, bHp: f.b.hp, spent: bondSavesUsed.has(bondKey(f.a.id, f.b.id)), counted: runStats.bondSaves };
      applyDamageHit(f.foes[0], f.a, 50, 'phys', 'CLAW');
      const second = { aHp: f.a.hp };
      f = window.__bondFight(4);
      f.a.hp = 5;
      applyDamageHit(f.foes[0], f.a, 50, 'phys', 'CLAW');
      const levelOne = f.a.hp;
      f = window.__bondFight(10);
      f.a.hp = 5; f.b.hp = 0;
      applyDamageHit(f.foes[0], f.a, 50, 'phys', 'CLAW');
      const partnerDown = f.a.hp;
      return { saved, second, levelOne, partnerDown };
    });
    ok('a killing blow lands on the partner instead', stepIn.saved.aHp === 5 && stepIn.saved.bHp === 950);
    ok('the pair spends its save, and the run counts it', stepIn.saved.spent && stepIn.saved.counted === 1);
    ok('the second blow kills - one step-in per pair per fight', stepIn.second.aHp === 0);
    ok('level I does not step in', stepIn.levelOne === 0);
    ok('neither does a fallen partner', stepIn.partnerDown === 0);

    // ---- level III: the shared overdrive discount ----
    const od = await page.evaluate(() => {
      const f = window.__bondFight(18);
      const both = overdriveAt();
      f.b.hp = 0;
      const alone = overdriveAt();
      combatActive = false; activeEntities = [];
      const outside = overdriveAt();
      return { both, alone, outside, base: OVERDRIVE_AT };
    });
    ok(`a level-III pair drops the overdrive to ${od.both}`, od.both === od.base - 10);
    ok('the discount dies with the partner', od.alone === od.base && od.outside === od.base);

    // ---- the step-in survives a mid-fight save ----
    const snap = await page.evaluate(() => {
      const f = window.__bondFight(10);
      bondSavesUsed.add(bondKey(f.a.id, f.b.id));
      saveGameState();
      bondSavesUsed = new Set();
      loadGameState();
      resumeCombat(pendingCombat);
      return { restored: bondSavesUsed.has(bondKey(f.a.id, f.b.id)) };
    });
    ok('a spent save stays spent through save and resume', snap.restored);

    // ---- persistence and the fresh start ----
    const persisted = await page.evaluate(() => {
      combatActive = false; activeEntities = [];
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const [a, b] = playerRoster;
      bonds[bondKey(a.id, b.id)] = 7;
      saveGameState();
      bonds = {};
      loadGameState();
      const loaded = bondCount(a.id, b.id) === 7;
      const raw = JSON.parse(Store.get(BASE_SAVE_KEY + currentSlot));
      delete raw.bonds;
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw));
      loadGameState();
      const legacy = Object.keys(bonds).length === 0;
      bonds = { old: 9 };
      confirmNewGame(1.0); sectorFront = null;
      const fresh = Object.keys(bonds).length === 0;
      return { loaded, legacy, fresh };
    });
    ok('bonds ride the save', persisted.loaded);
    ok('a pre-bond save loads with none', persisted.legacy);
    ok('and a new run starts from zero', persisted.fresh);

    // ---- the roster card wears the tie ----
    const card = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const a = playerRoster.find(h => h.classType === 'BRUISER');
      const b = playerRoster.find(h => h.classType === 'MEDIC');
      bonds[bondKey(a.id, b.id)] = 4;
      renderOutpost();
      const html = document.getElementById('outpost-roster').innerHTML;
      return { shown: html.includes('Meat and Mender'), pip: /Meat and Mender I \(/.test(html) };
    });
    ok('the outpost card names the bond at level I', card.shown && card.pip);

    // ---- the muster names what a draft would forge ----
    const muster = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; pendingDifficulty = 1.0; beginExpedition();
      return document.getElementById('muster-note').innerText;
    });
    ok('the muster names the bonds a draft would forge', /Bonds this draft would forge:/.test(muster));

    // ---- the field manual has the page ----
    const codex = await page.evaluate(() => {
      const e = CODEX.find(x => x.id === 'BONDS');
      const text = e ? e.body().join(' ') : '';
      return { every: Object.values(BOND_NAMES).every(n => text.includes(n)), rules: /steps in front/.test(text) };
    });
    ok('the field manual lists every pairing and the rules', codex.every && codex.rules);
  }
};

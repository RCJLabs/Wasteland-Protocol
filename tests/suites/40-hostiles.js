// Ten enemy types shared six generic intents between them: the only per-enemy behaviour in the
// whole engine was one hardcoded name list. Each type now carries a signature - a passive that
// bends how it deals or takes damage, or a telegraphed action rolled alongside the intents -
// built from the statuses, reach and formation rules the squad already plays with.
module.exports = {
  name: 'Hostiles with signatures',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the table, and that every type actually carries one ----
    const table = await page.evaluate(() => {
      const kinds = {};
      Object.values(ENEMY_SIGS).forEach(s => { kinds[s.kind] = (kinds[s.kind] || 0) + 1; });
      const seen = {};
      currentSector = 4; currentTier = 10;
      for (let i = 0; i < 60; i++) ['BEASTS', 'RAIDERS', 'MECH'].forEach(f =>
        generateEnemies(f, 1, false, 1).forEach(e => { seen[e.name] = e.sig || null; }));
      currentSector = 1; currentTier = 1;
      return {
        total: Object.keys(ENEMY_SIGS).length,
        described: Object.values(ENEMY_SIGS).every(s => s.name && s.desc),
        actionsIconed: Object.values(ENEMY_SIGS).filter(s => s.kind === 'action').every(s => s.icon && s.weight > 0 && s.cd > 0),
        kinds,
        types: Object.keys(seen).length,
        unsigned: Object.entries(seen).filter(([, v]) => !v).map(([k]) => k),
        unique: new Set(Object.values(seen)).size
      };
    });
    ok(`ten signatures, each named and described`, table.total === 10 && table.described);
    ok('every telegraphed one has an icon, a weight and a cooldown', table.actionsIconed);
    ok(`a mix of passive, action and death (${JSON.stringify(table.kinds)})`,
      table.kinds.action === 5 && table.kinds.passive === 4 && table.kinds.death === 1);
    ok(`all ${table.types} enemy types carry one, none shared`,
      table.unsigned.length === 0 && table.unique === table.types);

    // ---- wired, not just declared ----
    const wired = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      return Object.keys(ENEMY_SIGS).filter(id =>
        (src.match(new RegExp("'" + id + "'", 'g')) || []).length < 2);
    });
    ok('every signature is wired into the engine', wired.length === 0);
    if (wired.length) console.log('        inert:', wired.join(', '));

    // ---- a fixture that stages one hostile of a chosen kind ----
    await page.evaluate(() => {
      window.__sigFight = (sig, n) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        initiateCombat('RAIDERS', false);
        const heroes = playerRoster.filter(p => p.gridPos > 0);
        heroes.forEach(h => { h.quirk = null; h.weaponMod = null; h.trinket = null; h.traits = [];
                              h.maxHp = 400; h.hp = 400; h.armor = 0; h.resistances = { phys: 0, bio: 0, energy: 0 };
                              Object.keys(h.cooldowns).forEach(k => h.cooldowns[k] = 0); });
        bonds = {}; activeRelics = []; currentWeather = null; momentumFocus = 0;
        const foes = [];
        for (let i = 0; i < (n || 1); i++) {
          foes.push({ id: 'sf' + i, name: 'Test ' + sig, sig: sig, classType: 'RAIDER', range: 'melee',
            maxHp: 500, hp: 500, speed: 1, armor: 0, baseArmor: 0, dmgBase: 40, img: 'enemy_raider.webp',
            scale: 1, hpDrop: 0, isPlayer: false, sigCd: 0, plate: 0,
            stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0,
            resistances: { phys: 0, bio: 0, energy: 0 }, intent: { type: 'ATTACK', icon: '#' } });
        }
        activeEntities = [...heroes, ...foes]; turnQueue = [...heroes, ...foes];
        activeIndex = 0; combatActive = true; pendingAction = null;
        return { heroes, foes };
      };
      // Fires a hostile's signature action on demand, bypassing the weight roll.
      window.__fireSig = (foe) => {
        foe.intent = { type: 'SIG', icon: '#', sig: foe.sig };
        foe.sigCd = 0;
        executeEnemyAi(foe);
      };
    });

    // ---- PACK_HUNT: the pack is worth more than its members ----
    const pack = await page.evaluate(() => {
      const hit = (n) => {
        const f = window.__sigFight('PACK_HUNT', n);
        const mult = enemyDmgMult(f.foes[0]);
        return Math.round(mult * 100) / 100;
      };
      const alone = hit(1), three = hit(3);
      // and it counts only the living
      const f = window.__sigFight('PACK_HUNT', 3);
      f.foes[1].hp = 0; f.foes[2].hp = 0;
      const bereaved = Math.round(enemyDmgMult(f.foes[0]) * 100) / 100;
      combatActive = false;
      return { alone, three, bereaved };
    });
    ok(`a lone packmate hits for its own weight (x${pack.alone})`, pack.alone === 1);
    ok(`three of them hit harder (x${pack.three})`, pack.three === 1.24);
    ok('and the dead stop counting', pack.bereaved === 1);

    // ---- FRENZY: hits harder the closer it is to death ----
    const frenzy = await page.evaluate(() => {
      const f = window.__sigFight('FRENZY', 1);
      const foe = f.foes[0];
      const at = hp => { foe.hp = hp; return Math.round(enemyDmgMult(foe) * 100) / 100; };
      const full = at(500), half = at(250), dying = at(5);
      combatActive = false;
      return { full, half, dying };
    });
    ok(`untouched it is ordinary (x${frenzy.full})`, frenzy.full === 1);
    ok(`at half health it climbs (x${frenzy.half})`, frenzy.half === 1.3);
    ok(`and it is worst when nearly dead (x${frenzy.dying})`, frenzy.dying > 1.55 && frenzy.dying <= 1.6);

    // ---- RIOT_PLATE: halves everything until it is broken through ----
    const plate = await page.evaluate(() => {
      const f = window.__sigFight('RIOT_PLATE', 1);
      const foe = f.foes[0]; foe.plate = 60;
      const hero = f.heroes[0];
      // Walk the whole plate down one 40 at a time: each lands for 20 and takes 20 off the
      // plate, so a 60 plate is worth exactly three blows before the fourth lands whole.
      const steps = [];
      for (let i = 0; i < 4; i++) {
        const hpBefore = foe.hp;
        applyDamageHit(hero, foe, 40, 'phys', null);
        steps.push({ took: hpBefore - foe.hp, plate: foe.plate });
      }
      combatActive = false;
      return { steps };
    });
    ok(`plated, a 40 lands for ${plate.steps[0].took}`,
      plate.steps[0].took === 20 && plate.steps[0].plate === 40);
    ok('the plate drains by what it soaked, blow by blow',
      plate.steps[1].plate === 20 && plate.steps[2].plate === 0);
    ok(`and once broken the same blow lands whole (${plate.steps[3].took})`,
      plate.steps[3].took === 40 && plate.steps[2].took === 20);

    // ---- ROTOR_LIFT: melee cannot reach it ----
    const rotor = await page.evaluate(() => {
      const swing = (sig, move) => {
        let t = 0;
        for (let i = 0; i < 10; i++) {
          const f = window.__sigFight(sig, 1);
          const hero = playerRoster.find(p => p.classType === 'BRUISER');
          hero.gridPos = 1; hero.dmgBase = 100;
          activeIndex = turnQueue.indexOf(hero);
          combatActive = true; pendingAction = move;
          const before = f.foes[0].hp;
          resolveAction(f.foes[0].id);
          t += before - f.foes[0].hp;
        }
        return t / 10;
      };
      const meleeUp = swing('ROTOR_LIFT', 'SCRAP_BLADE');
      const meleeFlat = swing('PACK_HUNT', 'SCRAP_BLADE');
      combatActive = false;
      return { ratio: meleeUp / meleeFlat };
    });
    ok(`a swing at a hovering drone lands at ${(rotor.ratio * 100).toFixed(0)}%`,
      rotor.ratio > 0.34 && rotor.ratio < 0.46);

    // ---- GAS_BLOOM: as dangerous dead as alive ----
    const bloom = await page.evaluate(() => {
      const f = window.__sigFight('GAS_BLOOM', 1);
      const foe = f.foes[0]; foe.hp = 5;
      const hero = f.heroes[0];
      const before = f.heroes.every(h => (h.corrodedTurns || 0) === 0);
      applyDamageHit(hero, foe, 999, 'phys', null);
      const after = f.heroes.filter(h => h.hp > 0).every(h => h.corrodedTurns === 2);
      // and only once
      foe.hp = 0; applyDamageHit(hero, foe, 999, 'phys', null);
      combatActive = false;
      return { before, after, once: foe.bloomed === true };
    });
    ok('the squad is clean before it dies', bloom.before);
    ok('and choking on the cloud after', bloom.after && bloom.once);

    // ---- DRAG_DOWN: hauls the back rank to the front ----
    const drag = await page.evaluate(() => {
      const f = window.__sigFight('DRAG_DOWN', 1);
      const back = f.heroes.find(h => h.gridPos === 3);
      const front = f.heroes.find(h => h.gridPos === 1);
      const beforeHp = back.hp;
      window.__fireSig(f.foes[0]);
      const out = { swapped: back.gridPos === 1 && front.gridPos === 3, mauled: back.hp < beforeHp,
                    cd: f.foes[0].sigCd };
      combatActive = false;
      return out;
    });
    ok('the back rank is dragged to the front', drag.swapped);
    ok('and mauled for the trouble', drag.mauled);
    ok('the signature goes on cooldown', drag.cd === 2);

    // ---- CALL_IT_IN: one whistle each, never into a crowd ----
    const called = await page.evaluate(() => {
      const f = window.__sigFight('CALL_IT_IN', 1);
      const before = activeEntities.filter(e => !e.isPlayer).length;
      window.__fireSig(f.foes[0]);
      const after = activeEntities.filter(e => !e.isPlayer).length;
      const helper = activeEntities.filter(e => !e.isPlayer).pop();
      const inQueue = turnQueue.includes(helper);
      // a crowded field gets no answer
      const g = window.__sigFight('CALL_IT_IN', 5);
      const crowdBefore = activeEntities.filter(e => !e.isPlayer).length;
      window.__fireSig(g.foes[0]);
      const crowdAfter = activeEntities.filter(e => !e.isPlayer).length;
      combatActive = false;
      return { arrived: after === before + 1, inQueue, helperSig: helper.sig,
               helperFresh: helper.hp === helper.maxHp && helper.hp > 0,
               crowded: crowdAfter === crowdBefore };
    });
    ok('the whistle brings another raider, into the queue', called.arrived && called.inQueue);
    ok('who arrives whole and cannot whistle again', called.helperFresh && !called.helperSig);
    ok('and nobody answers a crowded field', called.crowded);

    // ---- RANGING: two beats, and an answer between them ----
    const ranging = await page.evaluate(() => {
      const f = window.__sigFight('RANGING', 1);
      const foe = f.foes[0];
      const mark = f.heroes.reduce((a, b) => (b.gridPos > a.gridPos ? b : a));
      window.__fireSig(foe);
      const locked = foe.lockOn === mark.id;
      const unhurt = mark.hp === 400;
      // the shot comes due on its next ordinary turn
      foe.intent = { type: 'ATTACK', icon: '#' };
      const before = mark.hp;
      executeEnemyAi(foe);
      const hit = before - mark.hp;
      const cleared = !foe.lockOn;
      // an ordinary hit from the same unit, for comparison
      const g = window.__sigFight('RANGING', 1);
      const other = g.heroes.reduce((a, b) => (b.gridPos > a.gridPos ? b : a));
      g.foes[0].intent = { type: 'ATTACK', icon: '#' };
      const b2 = other.hp; executeEnemyAi(g.foes[0]);
      const plain = Math.max(1, b2 - other.hp);
      combatActive = false;
      return { locked, unhurt, hit, plain, cleared };
    });
    ok('ranging marks the back rank without hurting them', ranging.locked && ranging.unhurt);
    ok(`the shot that follows is worth waiting for (${ranging.hit} vs ${ranging.plain})`,
      ranging.hit > ranging.plain * 1.6);
    ok('and the lock clears once spent', ranging.cleared);

    const dodged = await page.evaluate(() => {
      const f = window.__sigFight('RANGING', 1);
      const foe = f.foes[0];
      window.__fireSig(foe);
      const mark = f.heroes.find(h => h.id === foe.lockOn);
      mark.hp = 0;                     // the mark goes down before the shot
      foe.intent = { type: 'ATTACK', icon: '#' };
      executeEnemyAi(foe);
      const out = { cleared: !foe.lockOn };
      combatActive = false;
      return out;
    });
    ok('a mark that falls first takes the lock with them', dodged.cleared);

    // ---- OVERWATCH: acting draws fire ----
    const watch = await page.evaluate(() => {
      const f = window.__sigFight('OVERWATCH', 1);
      const foe = f.foes[0];
      window.__fireSig(foe);
      const armed = foe.overwatch === 2;
      const hero = f.heroes[0];
      activeIndex = turnQueue.indexOf(hero);
      combatActive = true; pendingAction = 'SCRAP_BLADE';
      const before = hero.hp;
      resolveAction(foe.id);
      const shot = hero.hp < before;
      const spent = foe.overwatch === 1;
      // it runs dry
      const hero2 = f.heroes[1];
      activeIndex = turnQueue.indexOf(hero2); combatActive = true; pendingAction = 'PISTOL';
      resolveAction(foe.id);
      const h3 = f.heroes[2];
      activeIndex = turnQueue.indexOf(h3); combatActive = true; pendingAction = 'PISTOL';
      const b3 = h3.hp; resolveAction(foe.id);
      const dry = h3.hp === b3 && foe.overwatch === 0;
      combatActive = false;
      return { armed, shot, spent, dry };
    });
    ok('a locked-down field is armed for two', watch.armed);
    ok('the operator who moves is shot as they move', watch.shot && watch.spent);
    ok('and the lock runs dry after the second', watch.dry);

    // ---- AEGIS: plating for everyone but itself ----
    const aegis = await page.evaluate(() => {
      const f = window.__sigFight('AEGIS', 3);
      const rig = f.foes[0];
      window.__fireSig(rig);
      const out = { escorts: f.foes.slice(1).every(e => e.armor === 8 && e.armorTurns === 2),
                    notItself: rig.armor === 0 };
      combatActive = false;
      return out;
    });
    ok('the rig plates its escorts', aegis.escorts);
    ok('and never itself', aegis.notItself);

    // ---- the card says what it is ----
    const ui = await page.evaluate(() => {
      const f = window.__sigFight('RIOT_PLATE', 1);
      f.foes[0].plate = 30;
      renderField();
      const tag = document.getElementById('sf0').querySelector('.sig-tag');
      const named = tag && /RIOT PLATE/.test(tag.innerText) && /30/.test(tag.innerText);
      f.foes[0].plate = 0; renderField();
      const spent = document.getElementById('sf0').querySelector('.sig-tag');
      const broken = spent && /BROKEN/.test(spent.innerText) && spent.className.includes('sig-spent');
      const described = spent && spent.title.length > 10;
      // players never wear one
      const hero = document.getElementById(f.heroes[0].id).querySelector('.sig-tag');
      combatActive = false;
      return { named, broken, described, clean: hero === null };
    });
    ok('an enemy card names its signature and its live state', ui.named);
    ok('a spent plate reads as spent', ui.broken);
    ok('the badge carries the explanation, and operators never wear one', ui.described && ui.clean);

    // ---- telegraphing: the intent icon says which one is coming ----
    const telegraph = await page.evaluate(() => {
      const f = window.__sigFight('OVERWATCH', 1);
      const foe = f.foes[0];
      let sigRolls = 0, iconOk = true;
      for (let i = 0; i < 400; i++) {
        foe.sigCd = 0;
        const it = rollIntent(foe);
        if (it.type === 'SIG') { sigRolls++; if (it.icon !== ENEMY_SIGS.OVERWATCH.icon || it.sig !== 'OVERWATCH') iconOk = false; }
      }
      // a signature on cooldown never rolls
      foe.sigCd = 3;
      let onCd = 0;
      for (let i = 0; i < 200; i++) if (rollIntent(foe).type === 'SIG') onCd++;
      combatActive = false;
      return { sigRolls, iconOk, onCd };
    });
    ok(`the signature rolls at about its weight (${telegraph.sigRolls}/400)`,
      telegraph.sigRolls > 90 && telegraph.sigRolls < 200);
    ok('carrying its own icon so the squad sees it coming', telegraph.iconOk);
    ok('and never while it is on cooldown', telegraph.onCd === 0);

    // ---- the manual explains them ----
    const codex = await page.evaluate(() => {
      const e = CODEX.find(x => x.id === 'HOSTILES');
      const text = e ? e.body().join(' ') : '';
      return Object.values(ENEMY_SIGS).every(s => text.includes(s.name));
    });
    ok('the field manual names every signature', codex);
  }
};

// A level-up banked a point spent later on one of five flat stats. It is a moment now: three
// perks offered on the spot, and the class signatures among them change what abilities do.
module.exports = {
  name: 'Field promotions',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the signature table ----
    const table = await page.evaluate(() => ({
      count: SIG_PERKS.length,
      ids: new Set(SIG_PERKS.map(p => p.id)).size,
      described: SIG_PERKS.every(p => p.name && p.desc),
      perClass: Object.keys(ABILITIES).every(c => SIG_PERKS.filter(p => p.cls === c).length === 4)
    }));
    ok(`there are ${table.count} signature perks`, table.count === 28);
    ok('four per class, each unique and described', table.perClass && table.ids === 28 && table.described);

    const wired = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      return SIG_PERKS.filter(p => !p.apply &&
        (src.match(new RegExp("'" + p.id + "'", 'g')) || []).length < 2).map(p => p.id);
    });
    ok('every signature is wired into the engine, not just declared', wired.length === 0);
    if (wired.length) console.log('        inert:', wired.join(', '));

    // ---- a level-up queues an offer ----
    const levelled = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      pendingPerkOffers = [];
      const ch = playerRoster[0];
      ch.xp = 0; ch.level = 1; ch.xpToNext = 100; ch.perkPoints = 0;
      awardXp(ch, 100);
      return { offers: pendingPerkOffers.length, char: pendingPerkOffers[0] && pendingPerkOffers[0].charId === ch.id,
               options: pendingPerkOffers[0] ? pendingPerkOffers[0].options.length : 0,
               distinct: pendingPerkOffers[0] ? new Set(pendingPerkOffers[0].options).size : 0,
               point: ch.perkPoints };
    });
    ok('a level-up queues a promotion for that operator', levelled.offers === 1 && levelled.char);
    ok('offering three distinct options', levelled.options === 3 && levelled.distinct === 3);
    ok('alongside the point it always granted', levelled.point === 1);

    const composition = await page.evaluate(() => {
      const ch = playerRoster.find(c => c.classType === 'PYROMANIAC');
      let sigSeen = 0, wrongClass = 0, held = 0;
      ch.traits = ['BACKDRAFT'];
      for (let i = 0; i < 60; i++) {
        const opts = rollPerkOffer(ch);
        opts.forEach(id => {
          const sig = SIG_PERKS.find(p => p.id === id);
          if (sig) { sigSeen++; if (sig.cls !== 'PYROMANIAC') wrongClass++; if (id === 'BACKDRAFT') held++; }
        });
      }
      ch.traits = [];
      return { sigSeen, wrongClass, held };
    });
    ok(`offers lean on the class's signatures (${composition.sigSeen} in 180 slots)`, composition.sigSeen > 100);
    ok("never another class's", composition.wrongClass === 0);
    ok('and never one already held', composition.held === 0);

    // ---- the offer screen: take a signature ----
    await page.evaluate(() => {
      pendingPerkOffers = [{ charId: playerRoster.find(c => c.classType === 'BRUISER').id,
                             options: ['BULWARK', 'VETERAN', 'FORTIFIED'] }];
      playerRoster.find(c => c.classType === 'BRUISER').perkPoints = 1;
      renderPerkOffer();
    });
    const offerUi = await page.evaluate(() => ({
      shown: getComputedStyle(document.getElementById('screen-perk')).display,
      title: document.getElementById('perk-title').innerText,
      cards: document.querySelectorAll('[data-action="take-perk"]').length,
      sig: document.querySelectorAll('.perk-sig').length,
      stat: document.querySelectorAll('.perk-stat').length,
      bank: document.querySelectorAll('[data-action="bank-perk"]').length
    }));
    ok('the promotion opens on its own screen', offerUi.shown === 'flex');
    ok('naming the operator', /BRUISER|FIELD PROMOTION/.test(offerUi.title));
    ok('three cards, signatures marked apart from training', offerUi.cards === 3 && offerUi.sig === 1 && offerUi.stat === 2);
    ok('with the banking escape hatch', offerUi.bank === 1);

    await page.click('.perk-sig');
    await page.waitForTimeout(300);
    const took = await page.evaluate(() => {
      const ch = playerRoster.find(c => c.classType === 'BRUISER');
      return { hasIt: hasTrait(ch, 'BULWARK'), point: ch.perkPoints,
               queueEmpty: pendingPerkOffers.length === 0,
               onMap: getComputedStyle(document.getElementById('screen-map')).display };
    });
    ok('taking a signature grants it and spends the point', took.hasIt && took.point === 0);
    ok('and the run returns to the map', took.queueEmpty && took.onMap === 'flex');

    // Banking keeps the point for the Outpost's stat picker.
    const banked = await page.evaluate(() => {
      const ch = playerRoster.find(c => c.classType === 'MEDIC');
      ch.perkPoints = 1;
      pendingPerkOffers = [{ charId: ch.id, options: ['FIELD_SURGEON', 'VETERAN', 'SWIFT'] }];
      renderPerkOffer();
      document.querySelector('[data-action="bank-perk"]').click();
      return { point: ch.perkPoints, none: !hasTrait(ch, 'FIELD_SURGEON'),
               onMap: getComputedStyle(document.getElementById('screen-map')).display };
    });
    ok('banking keeps the point and grants nothing', banked.point === 1 && banked.none && banked.onMap === 'flex');

    // Two promotions queue and resolve one at a time.
    const queued = await page.evaluate(() => {
      const a = playerRoster[0], b = playerRoster[1];
      a.perkPoints = 1; b.perkPoints = 1;
      pendingPerkOffers = [
        { charId: a.id, options: ['VETERAN', 'FORTIFIED', 'SWIFT'] },
        { charId: b.id, options: ['VETERAN', 'FORTIFIED', 'SWIFT'] }];
      renderPerkOffer();
      const first = document.getElementById('perk-title').innerText;
      document.querySelector('[data-action="take-perk"]').click();
      const second = document.getElementById('perk-title').innerText;
      const still = getComputedStyle(document.getElementById('screen-perk')).display;
      document.querySelector('[data-action="bank-perk"]').click();
      return { differ: first !== second, still, done: pendingPerkOffers.length === 0 };
    });
    ok('stacked promotions resolve one at a time', queued.differ && queued.still === 'flex' && queued.done);

    // ---- the signatures do what they say ----
    await page.evaluate(() => {
      window.__perkFight = (cls, traitId, setup) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null; initiateCombat('RAIDERS', false);
        const hero = playerRoster.find(h => h.classType === cls);
        hero.gridPos = 1; hero.maxHp = 1000; hero.hp = 1000; hero.dmgBase = 100;
        hero.quirk = null; hero.weaponMod = null; hero.trinket = null; hero.stunnedTurns = 0; sectorFront = null;
        hero.traits = traitId ? [traitId] : [];
        Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
        const foes = [];
        for (let i = 0; i < 3; i++) {
          const f = generateEnemies('RAIDERS', 1, false, 1)[0];
          f.id = 'perkfoe' + i; f.maxHp = 100000; f.hp = 100000; f.armor = 0; f.baseArmor = 0;
          f.resistances = { phys: 0, bio: 0, energy: 0 };
          f.bleedingTurns = 0; f.oiledTurns = 0; f.stunnedTurns = 0; f.corrodedTurns = 0; f.markedTurns = 0;
          foes.push(f);
        }
        activeEntities = [hero, ...foes]; turnQueue = [hero, ...foes];
        activeIndex = 0; combatActive = true; pendingAction = null; currentWeather = null; momentumFocus = 0;
        if (setup) setup(hero, foes);
        return { hero, foes };
      };
      window.__perkAvg = (cls, traitId, move, setup) => {
        let t = 0;
        for (let i = 0; i < 12; i++) {
          const f = window.__perkFight(cls, traitId, setup);
          activeIndex = 0; combatActive = true; pendingAction = move;
          const before = f.foes[0].hp; resolveAction(f.foes[0].id); t += before - f.foes[0].hp;
        }
        return t / 12;
      };
    });

    const dmgPerks = await page.evaluate(() => {
      const gain = (cls, traitId, move, setup) =>
        window.__perkAvg(cls, traitId, move, setup) / window.__perkAvg(cls, null, move, setup);
      return {
        grudge: gain('BRUISER', 'GRUDGE', 'SCRAP_BLADE', h => { h.hp = 300; }),
        called: gain('SNIPER', 'CALLED_SHOT', 'QUICK_SHOT', (h, f) => { f[0].markedTurns = 5; }),
        throat: gain('HOUND', 'GO_FOR_THE_THROAT', 'FERAL_BITE', (h, f) => { f[0].bleedingTurns = 3; }),
        iron: gain('SHOTGUNNER', 'IRONSIGHTS', 'SLUG_SHOT'),
        pyro: gain('PYROMANIAC', 'PYROPHILIA', 'FLARE_GUN', (h, f) => { f.forEach(x => x.oiledTurns = 3); })
      };
    });
    const near = (v, want) => v > want - 0.09 && v < want + 0.09;
    ok(`Grudge pays below half health (x${dmgPerks.grudge.toFixed(2)})`, near(dmgPerks.grudge, 1.15));
    ok(`Called Shot punishes marks (x${dmgPerks.called.toFixed(2)})`, dmgPerks.called > 1.15);
    ok(`Go For The Throat punishes bleeds (x${dmgPerks.throat.toFixed(2)})`, near(dmgPerks.throat, 1.3));
    ok(`Ironsights sharpens the slug (x${dmgPerks.iron.toFixed(2)})`, near(dmgPerks.iron, 1.2));
    ok(`Pyrophilia scales with oiled enemies (x${dmgPerks.pyro.toFixed(2)})`, near(dmgPerks.pyro, 1.3));

    const verbs = await page.evaluate(() => {
      const r = {};
      // AFTERSHOCK hits the one behind
      let f = window.__perkFight('BRUISER', 'AFTERSHOCK');
      activeIndex = 0; combatActive = true; pendingAction = 'HEAVY_WRENCH'; resolveAction(f.foes[0].id);
      r.aftershock = 100000 - f.foes[1].hp;
      // UNSHAKEABLE
      f = window.__perkFight('BRUISER', 'UNSHAKEABLE');
      let stuck = 0;
      for (let i = 0; i < 20; i++) { f.hero.stunnedTurns = 0; applyDamageHit(f.foes[0], f.hero, 10, 'phys', 'FLASHBANG'); if (f.hero.stunnedTurns > 0) stuck++; }
      r.unshakeable = stuck;
      // FIELD_SURGEON cleanses
      f = window.__perkFight('MEDIC', 'FIELD_SURGEON');
      const ally = playerRoster.find(c => c.classType === 'BRUISER');
      ally.gridPos = 2; ally.hp = 50; ally.maxHp = 200; ally.bleedingTurns = 3; ally.oiledTurns = 2;
      activeEntities.push(ally); turnQueue.push(ally);
      activeIndex = 0; combatActive = true; pendingAction = 'CAUTERIZE'; resolveAction(ally.id);
      r.surgeon = { bleed: ally.bleedingTurns, oil: ally.oiledTurns };
      // DOUBLE_TAP refunds on the kill
      f = window.__perkFight('SHOTGUNNER', 'DOUBLE_TAP', (h, foes) => { foes[0].maxHp = 10; foes[0].hp = 10; });
      activeIndex = 0; combatActive = true; pendingAction = 'EXECUTE_SHOT'; resolveAction(f.foes[0].id);
      r.doubleTap = f.hero.cooldowns.execute_shot;
      // ACID_RAIN splashes corrosion
      f = window.__perkFight('SCAVENGER', 'ACID_RAIN');
      activeIndex = 0; combatActive = true; pendingAction = 'ACID_FLASK'; resolveAction(f.foes[0].id);
      r.acidRain = f.foes[1].corrodedTurns;
      // STIMS_ON_ME reprices the tactic
      f = window.__perkFight('MEDIC', 'STIMS_ON_ME');
      r.stims = tacticCost(MOMENTUM_TACTICS.find(t => t.id === 'STIM'));
      f = window.__perkFight('MEDIC', null);
      r.stimsOff = tacticCost(MOMENTUM_TACTICS.find(t => t.id === 'STIM'));
      // BACKDRAFT: the molotov's second hit at full weight
      f = window.__perkFight('PYROMANIAC', 'BACKDRAFT');
      activeIndex = 0; combatActive = true; pendingAction = 'MOLOTOV'; resolveAction(f.foes[0].id);
      const full = 100000 - f.foes.slice(1).reduce((m, x) => Math.min(m, x.hp), 100000);
      f = window.__perkFight('PYROMANIAC', null);
      activeIndex = 0; combatActive = true; pendingAction = 'MOLOTOV'; resolveAction(f.foes[0].id);
      const dim = 100000 - f.foes.slice(1).reduce((m, x) => Math.min(m, x.hp), 100000);
      r.backdraft = { full, dim };
      return r;
    });
    ok(`Aftershock carries the wrench through (${verbs.aftershock} to the one behind)`, verbs.aftershock > 0);
    ok('Unshakeable cannot be stunned', verbs.unshakeable === 0);
    ok('Field Surgeon cleanses with the heal', verbs.surgeon.bleed === 0 && verbs.surgeon.oil === 0);
    ok('Double Tap refunds the execute on a kill', verbs.doubleTap === 0);
    ok('Acid Rain splashes corrosion to the next enemy', verbs.acidRain === 2);
    ok(`Stims On Me reprices the tactic (${verbs.stimsOff} -> ${verbs.stims})`, verbs.stims === 20 && verbs.stimsOff === 30);
    ok(`Backdraft makes the second molotov hit full weight (${verbs.backdraft.dim} -> ${verbs.backdraft.full})`,
      verbs.backdraft.full > verbs.backdraft.dim * 1.25);

    // ---- persistence: an unresolved promotion survives a reload ----
    await page.evaluate(() => { combatActive = false; });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const ch = playerRoster[0]; ch.perkPoints = 1;
      pendingPerkOffers = [{ charId: ch.id, options: ['BULWARK', 'VETERAN', 'SWIFT'] }];
      saveGameState();
    });
    await page.reload();
    await page.waitForTimeout(700);
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(500);
    const resumed = await page.evaluate(() => ({
      screen: getComputedStyle(document.getElementById('screen-perk')).display,
      options: pendingPerkOffers[0] ? pendingPerkOffers[0].options.join() : ''
    }));
    ok('an unresolved promotion survives a reload and reopens', resumed.screen === 'flex');
    ok('with the same three options', resumed.options === 'BULWARK,VETERAN,SWIFT');

    // ---- the manual has the page ----
    const codex = await page.evaluate(() => {
      const text = CODEX.find(e => e.id === 'PROMOTIONS').body().join(' ');
      return SIG_PERKS.every(p => text.includes(p.name));
    });
    ok('the field manual lists every signature', codex);
  }
};

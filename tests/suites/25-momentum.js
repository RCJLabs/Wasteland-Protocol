// Momentum was a fuse: the bar filled, and at 100% there was exactly one thing to do with it -
// a fixed overdrive per class. It is a market now, and the overdrive itself is a choice.
module.exports = {
  name: 'The momentum market',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__fight = (cls, mom) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null; initiateCombat('RAIDERS', false);
        const hero = playerRoster.find(h => h.classType === cls);
        hero.gridPos = 1; hero.maxHp = 1000; hero.hp = 1000; hero.dmgBase = 100; hero.stunnedTurns = 0; hero.quirk = null; sectorFront = null;
        Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
        const foes = activeEntities.filter(e => !e.isPlayer);
        foes.forEach(f => { f.maxHp = 100000; f.hp = 100000; f.armor = 0; f.baseArmor = 0;
          f.resistances = { phys: 0, bio: 0, energy: 0 };
          f.corrodedTurns = 0; f.markedTurns = 0; f.bleedingTurns = 0; f.oiledTurns = 0; f.stunnedTurns = 0; });
        activeEntities = [hero, ...foes]; turnQueue = [hero, ...foes];
        activeIndex = 0; combatActive = true; pendingAction = null;
        momentum = mom; momentumFocus = 0; pressExtra = false; renderField();
        return { hero, foes };
      };
    });

    // ---- the market exists ----
    const market = await page.evaluate(() => ({
      count: MOMENTUM_TACTICS.length,
      priced: MOMENTUM_TACTICS.every(t => t.cost > 0 && t.cost < 100),
      described: MOMENTUM_TACTICS.every(t => t.label && t.desc),
      cheapest: Math.min(...MOMENTUM_TACTICS.map(t => t.cost))
    }));
    ok(`there are ${market.count} tactics under the overdrive`, market.count === 3);
    ok('each priced below the full bar', market.priced);
    ok('and each described', market.described);

    // ---- the row renders by affordability ----
    const row = await page.evaluate(() => {
      const read = mom => {
        window.__fight('BRUISER', mom);
        const btns = [...document.querySelectorAll('.tactic-btn')];
        return { shown: btns.length, enabled: btns.filter(b => !b.disabled).map(b => b.dataset.kind) };
      };
      return { broke: read(0), some: read(30), flush: read(100) };
    });
    ok('no momentum, no market', row.broke.shown === 0);
    ok('part of a bar buys part of the market', row.some.shown === 3 &&
      row.some.enabled.includes('FOCUS') && !row.some.enabled.includes('PRESS'));
    // STIM stays dark at any price while nobody needs patching - that is its own guard, and
    // the healthy-squad case below proves it. A full bar opens everything else.
    ok('a full bar buys everything with a use', row.flush.shown === 3 &&
      row.flush.enabled.includes('FOCUS') && row.flush.enabled.includes('PRESS'));

    // The third tactic used to be pushed off the deck's edge on a narrow phone: a grid item
    // and a flex item both default to min-width:auto, so neither would shrink. Measured at
    // the narrowest phone width the game is played at, every button must be fully inside.
    const fits = await page.evaluate(async () => {
      const measure = () => {
        window.__fight('BRUISER', 100);
        const deck = document.getElementById('command-deck').getBoundingClientRect();
        const btns = [...document.querySelectorAll('.tactic-btn')].map(b => b.getBoundingClientRect());
        return {
          overflow: Math.max(...btns.map(b => Math.round(b.right - deck.right))),
          leftOf: Math.round(btns[0].left - deck.left),
          narrowest: Math.round(Math.min(...btns.map(b => b.width))),
          labels: [...document.querySelectorAll('.tactic-btn')].every(b =>
            b.querySelector('.tactic-name') && b.querySelector('.tactic-cost')),
          readable: [...document.querySelectorAll('.tactic-name')].every(s => s.scrollWidth <= s.clientWidth + 1)
        };
      };
      const engine = document.getElementById('engine');
      const before = engine.style.width;
      engine.style.width = '360px';   // the narrow phone the report came from
      const narrow = measure();
      engine.style.width = before;
      const wide = measure();
      return { narrow, wide };
    });
    ok(`all three tactics sit inside the deck at 360px (worst edge ${fits.narrow.overflow}px)`,
      fits.narrow.overflow <= 0 && fits.narrow.leftOf >= 0 && fits.narrow.narrowest > 30);
    ok('and at full width', fits.wide.overflow <= 0 && fits.wide.leftOf >= 0);
    ok('each naming its tactic and its price, unclipped',
      fits.narrow.labels && fits.narrow.readable && fits.wide.readable);

    // ---- FOCUS: the next attack hits harder, once ----
    const focus = await page.evaluate(() => {
      const swing = (focused) => {
        let total = 0;
        for (let i = 0; i < 12; i++) {
          const { hero, foes } = window.__fight('BRUISER', 50);
          if (focused) spendTactic('FOCUS');
          const before = foes[0].hp;
          activeIndex = 0; combatActive = true; pendingAction = 'SCRAP_BLADE'; resolveAction(foes[0].id);
          total += before - foes[0].hp;
        }
        return total / 12;
      };
      const plain = swing(false), focused = swing(true);
      // and it is spent by the hit, not the turn
      const { hero, foes } = window.__fight('BRUISER', 50);
      spendTactic('FOCUS');
      const paid = momentum;
      const armed = momentumFocus;
      activeIndex = 0; combatActive = true; pendingAction = 'SCRAP_BLADE'; resolveAction(foes[0].id);
      return { plain, focused, ratio: focused / plain, paid, armed, spent: momentumFocus === 0 };
    });
    ok(`FOCUS lands the next attack at ~1.3x (x${focus.ratio.toFixed(2)})`, focus.ratio > 1.2 && focus.ratio < 1.4);
    ok('costs 25 momentum and no action', focus.paid === 25 && focus.armed === 1);
    ok('and is consumed by that one hit', focus.spent);

    // ---- STIM: patch the worst-off operator without spending the turn ----
    const stim = await page.evaluate(() => {
      const { hero } = window.__fight('MEDIC', 50);
      const ally = playerRoster.find(h => h.classType === 'BRUISER');
      ally.gridPos = 2; ally.maxHp = 200; ally.hp = 40; ally.bleedingTurns = 3;
      activeEntities = [hero, ally, ...activeEntities.filter(e => !e.isPlayer)];
      turnQueue = [...activeEntities]; activeIndex = 0; combatActive = true; renderField();
      spendTactic('STIM');
      const stillMyTurn = turnQueue[activeIndex] === hero && combatActive;
      const deckLive = document.querySelectorAll('#command-deck [data-move]').length > 0;
      return { healed: ally.hp, cleansed: ally.bleedingTurns === 0, paid: momentum, stillMyTurn, deckLive };
    });
    ok(`STIM patches the worst-off operator (40 -> ${stim.healed})`, stim.healed === 80);
    ok('and cleanses them', stim.cleansed);
    ok('for 30 momentum and no action', stim.paid === 20 && stim.stillMyTurn && stim.deckLive);

    const stimGuard = await page.evaluate(() => {
      window.__fight('BRUISER', 100);
      playerRoster.forEach(h => { if (h.gridPos > 0) { h.hp = h.maxHp; h.bleedingTurns = 0; h.stunnedTurns = 0; h.oiledTurns = 0; } });
      renderField();
      const btn = [...document.querySelectorAll('.tactic-btn')].find(b => b.dataset.kind === 'STIM');
      const before = momentum;
      spendTactic('STIM');
      return { disabled: btn.disabled, refused: momentum === before };
    });
    ok('a healthy squad cannot waste a STIM', stimGuard.disabled && stimGuard.refused);

    // ---- PRESS: the operator acts twice ----
    const press = await page.evaluate(() => {
      const { hero, foes } = window.__fight('SNIPER', 60);
      spendTactic('PRESS');
      const paid = momentum;
      activeIndex = 0; combatActive = true; pendingAction = 'QUICK_SHOT'; resolveAction(foes[0].id);
      const heldFloor = turnQueue[activeIndex] === hero;
      const deckBack = document.querySelectorAll('#command-deck [data-move]').length > 0;
      const flagSpent = pressExtra === false;
      // the second action then hands the turn over normally
      pendingAction = 'QUICK_SHOT'; resolveAction(foes[0].id);
      return { paid, heldFloor, deckBack, flagSpent, handedOver: pendingAction === null };
    });
    ok('PRESS costs 40', press.paid === 20);
    ok('after the attack the operator holds the floor', press.heldFloor && press.deckBack);
    ok('exactly once', press.flagSpent && press.handedOver);

    // A tactic is a player's move: the enemy phase refuses it.
    const enemyPhase = await page.evaluate(() => {
      window.__fight('BRUISER', 100);
      activeIndex = turnQueue.findIndex(e => !e.isPlayer);
      const before = momentum;
      spendTactic('FOCUS');
      return momentum === before;
    });
    ok('the market closes on the enemy phase', enemyPhase);

    // ---- every class carries two overdrives ----
    const pairs = await page.evaluate(() => ({
      classes: Object.keys(OVERDRIVES).length,
      allPaired: Object.values(OVERDRIVES).every(p => p.length === 2),
      allNamed: Object.values(OVERDRIVES).flat().every(o => o.id && o.name && o.desc),
      allDistinct: new Set(Object.values(OVERDRIVES).flat().map(o => o.id)).size ===
                   Object.values(OVERDRIVES).flat().length
    }));
    ok(`all ${pairs.classes} classes carry two overdrives`, pairs.classes === 7 && pairs.allPaired);
    ok('each named and described', pairs.allNamed);
    ok('with no id shared', pairs.allDistinct);

    // ---- the first full bar offers both; using one locks the class ----
    const choice = await page.evaluate(() => {
      window.__fight('SHOTGUNNER', 100);
      odChoices = {}; renderField();
      const offered = [...document.querySelectorAll('[data-move="OVERDRIVE"]')];
      const both = offered.map(b => b.dataset.variant);
      pendingAction = 'OVERDRIVE'; pendingOverdrive = 'SCATTERSTORM';
      const foes = activeEntities.filter(e => !e.isPlayer && e.hp > 0);
      resolveAction(foes[0].id);
      const locked = odChoices.SHOTGUNNER;
      momentum = 100; renderField();
      const after = [...document.querySelectorAll('[data-move="OVERDRIVE"]')];
      return { both: both.sort(), locked, afterCount: after.length,
               afterVariant: after[0] && after[0].dataset.variant, spent: momentum === 0 || after.length >= 0 };
    });
    ok('the first full bar offers both overdrives', choice.both.join() === 'BREACH_CHARGE,SCATTERSTORM');
    ok('using one locks the class to it for the run', choice.locked === 'SCATTERSTORM');
    ok('and later bars offer only the chosen one', choice.afterCount === 1 && choice.afterVariant === 'SCATTERSTORM');

    // ---- the variants do what they say ----
    const variants = await page.evaluate(() => {
      const cast = (cls, variant, prep) => {
        const { hero, foes } = window.__fight(cls, 100);
        odChoices = {}; if (prep) prep(hero, foes);
        activeIndex = 0; combatActive = true;
        pendingAction = 'OVERDRIVE'; pendingOverdrive = variant;
        resolveAction(foes[0].id);
        return { hero, foes };
      };
      const r = {};
      let c = cast('BRUISER', 'SIEGEBREAKER', (h, f) => { f[0].armor = 30; f[0].baseArmor = 30; });
      r.siege = { armour: c.foes[0].armor, corroded: c.foes[0].corrodedTurns, hurt: c.foes[0].hp < 100000 };
      c = cast('SNIPER', 'OVERWATCH');
      r.overwatch = { marked: c.foes.every(f => f.markedTurns === 3), hurtAll: c.foes.every(f => f.hp < 100000) };
      c = cast('SCAVENGER', 'BOOBY_TRAP');
      r.trap = { corroded: c.foes.every(f => f.corrodedTurns === 3), oiled: c.foes.every(f => f.oiledTurns === 3) };
      c = cast('HOUND', 'BLOOD_SCENT');
      r.scent = { bleeding: c.foes.every(f => f.bleedingTurns >= 3) };
      c = cast('MEDIC', 'TRIAGE_PROTOCOL', (h) => {
        playerRoster.forEach(x => { if (x.gridPos > 0) { x.maxHp = 200; x.hp = 60; x.bleedingTurns = 2; } });
        h.maxHp = 200; h.hp = 60; h.bleedingTurns = 2;
      });
      r.triage = { healed: c.hero.hp === 130, cleansed: c.hero.bleedingTurns === 0 };
      return r;
    });
    ok('SIEGEBREAKER strips armour and corrodes',
      variants.siege.armour === 0 && variants.siege.corroded === 3 && variants.siege.hurt);
    ok('OVERWATCH marks the whole line', variants.overwatch.marked && variants.overwatch.hurtAll);
    ok('BOOBY TRAP rigs everything', variants.trap.corroded && variants.trap.oiled);
    ok('BLOOD SCENT opens bleeds everywhere', variants.scent.bleeding);
    ok('TRIAGE PROTOCOL heals and cleanses the squad', variants.triage.healed && variants.triage.cleansed);

    // A caller that never states a variant (the simulator, old buttons) gets the first one,
    // and that use locks the choice like any other.
    const defaulted = await page.evaluate(() => {
      const { foes } = window.__fight('PYROMANIAC', 100);
      odChoices = {};
      activeIndex = 0; combatActive = true;
      pendingAction = 'OVERDRIVE'; pendingOverdrive = null;
      resolveAction(foes[0].id);
      return odChoices.PYROMANIAC;
    });
    ok('a variantless overdrive defaults to the first and locks it', defaulted === 'HELLFIRE');

    // ---- the choice is run state ----
    await page.evaluate(() => { combatActive = false; });
    await page.waitForTimeout(700);
    const persisted = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      odChoices = { SNIPER: 'OVERWATCH' }; saveGameState();
      loadGameState();
      const kept = odChoices.SNIPER;
      confirmNewGame(1.0); sectorFront = null;
      return { kept, cleared: Object.keys(odChoices).length === 0 };
    });
    ok('the locked choice survives a save', persisted.kept === 'OVERWATCH');
    ok('and a new expedition chooses fresh', persisted.cleared);

    // ---- the manual states the market ----
    const codex = await page.evaluate(() => {
      const text = CODEX.find(e => e.id === 'MOMENTUM').body().join(' ');
      return { tactics: MOMENTUM_TACTICS.every(t => text.includes(t.label) && text.includes(String(t.cost))),
               choice: /two Overdrives/i.test(text) };
    });
    ok('the field manual lists every tactic at its price', codex.tactics);
    ok('and explains the overdrive choice', codex.choice);
  }
};

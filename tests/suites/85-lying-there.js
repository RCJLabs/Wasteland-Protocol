// D09 was filed on "567 operators went down and 95 turns were spent saving any of them - one
// rescue turn per six falls", and the ratio did not survive being counted properly. The counter
// behind it added the item rescues to the move rescues and left out the STIM tactic - which is
// the one answer a squad with no medic in the line has, because stimTarget takes the worst off
// first and the worst off is always the body on the floor. Counted properly, across 28
// expeditions and two tactic policies, it is 279 rescues against 241 falls and 278 against 290.
// Roughly one rescue per fall. The squad does not watch its own people bleed out.
//
// So the phase changed nothing about the price of a fall in the end, and this suite holds the
// two things that came out of it. The first is why the premise was wrong, which is a property
// worth keeping: every route to a body on the floor, including the one off the momentum bar
// that no medic is needed for.
//
// The second is that the price is FLAT, deliberately, having been graded once and put back.
// D09 charged both halves - the scar roll and the health they come round on - against how long
// an operator lay there. Seven 14-expedition samples, grouped by whether the scar ladder was
// present, separated perfectly on depth: 3, 3, 3 with it against 5, 5, 6, 7 without, the fourth
// of those being a bisect arm carrying everything else the phase added. Scars dealt per run
// overlapped completely (0.93 to 1.64), so the count was never what moved - the PLACEMENT was.
// An operator lies there longest in the hardest fights, which are the deep ones, so charging
// for the time relocates the same scarring out of the sectors that absorb it and into the ones
// that end a run. Both halves went the same way for the same reason: a mean that holds while
// the distribution shifts is the wrong statistic.
//
// The full account is on SCAR_CHANCE in game.js. What is pinned here is the flatness itself,
// so it is a decision with a reason attached rather than an absence a later phase finishes.
module.exports = {
  name: 'What a fall costs',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__fight = (n = 2) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 2; currentTier = 4; initiateCombat('RAIDERS', false);
        const squad = playerRoster.filter(c => c.gridPos > 0).slice(0, n);
        squad.forEach((h, i) => { h.maxHp = 100; h.hp = 100; h.gridPos = i + 1;
                                  h.quirk = null; h.traits = []; h.scars = []; });
        const foe = activeEntities.find(e => !e.isPlayer);
        foe.maxHp = 100000; foe.hp = 100000; foe.armor = 0; foe.baseArmor = 0;
        foe.resistances = { phys: 0, bio: 0, energy: 0 };
        activeEntities = [...squad, foe]; turnQueue = [...squad, foe];
        activeIndex = 0; combatActive = true; pendingAction = null; bonds = {};
        return { squad, foe };
      };
      window.__drop = ent => { ent.hp = 0; goDown(ent); };
      window.__lie = (ent, n) => { __drop(ent); for (let i = 0; i < n; i++) tickBleedOut(ent); };
    });

    // ── The bar always has an answer ────────────────────────────────────────────────────
    // The premise of the phase was that a fall goes unanswered. It does not, and this is why:
    // the tactic that costs momentum rather than a turn takes the floor before anything else,
    // so a line with no medic in it is not out of options.
    const bar = await page.evaluate(() => {
      const { squad } = __fight(2);
      const [a, b] = squad;
      b.hp = 40;                       // hurt, but standing - the tactic's other kind of target
      const hurtOnly = stimTarget();
      __drop(a);
      const withDown = stimTarget();
      const out = { hurtOnly: hurtOnly && hurtOnly.id, withDown: withDown && withDown.id,
                    aId: a.id, bId: b.id, cost: (MOMENTUM_TACTICS.find(t => t.id === 'STIM') || {}).cost };
      combatActive = false;
      return out;
    });
    ok(`with nobody down the tactic patches whoever is worst off (${bar.hurtOnly === bar.bId ? 'the hurt one' : '?'})`,
      bar.hurtOnly === bar.bId);
    ok('the moment somebody falls it takes them instead', bar.withDown === bar.aId);
    ok(`and it is bought off the momentum bar, not out of a turn (${bar.cost} momentum)`, bar.cost > 0);

    // ── Every route to the floor, including the one no medic is needed for ──────────────
    const routes = await page.evaluate(() => {
      const medic = ABILITIES.MEDIC.map(a => a.move).concat(FOURTH_ABILITIES.MEDIC.move);
      const onlyMedic = REACHES_THE_DOWN.filter(m => !/^ITEM_/.test(m));
      return { reach: REACHES_THE_DOWN,
               // Which of them are a Medic's and nobody else's: the reason the bar matters.
               medicOnly: onlyMedic.every(m => medic.includes(m)),
               items: REACHES_THE_DOWN.filter(m => /^ITEM_/.test(m)),
               classes: Object.keys(ABILITIES).filter(c =>
                 ABILITIES[c].concat(FOURTH_ABILITIES[c] || [])
                   .some(a => REACHES_THE_DOWN.includes(a.move))) };
    });
    ok(`the moves that reach the floor belong to the Medic alone (${routes.classes.join(', ')})`,
      routes.medicOnly && routes.classes.length === 1 && routes.classes[0] === 'MEDIC');
    ok(`so the rest of the line answers with the bag (${routes.items.join(', ')}) or the bar`,
      routes.items.length === 2);

    // ── Picked up before the end, and the roll never happens ────────────────────────────
    const lifted = await page.evaluate(() => {
      const { squad } = __fight(2);
      const [a] = squad;
      __drop(a);
      const down = { down: (a.downTurns || 0) > 0, hp: a.hp };
      a.hp = 25;                        // any heal above zero, however it arrived
      const up = { onClock: bleedingOut().some(e => e.id === a.id), hp: a.hp };
      const ids = recoverDowned('once the field is held');
      combatActive = false;
      return { down, up, inRoll: ids.includes(a.id) };
    });
    ok('a fall starts a clock', lifted.down.down && lifted.down.hp === 0);
    ok('anything that lifts them above zero takes them off it', !lifted.up.onClock);
    ok('and off the scar roll with it, which is what a turn spent on them buys',
      !lifted.inRoll);

    // ── The price is flat, and that is the finding ──────────────────────────────────────
    const flat = await page.evaluate(() => {
      const { squad } = __fight(2);
      const [quick, slow] = squad;
      __lie(quick, 0);                 // fell as the fight was finishing
      __lie(slow, 2);                  // left through two of their own turns
      const clocks = { quick: quick.downTurns, slow: slow.downTurns };
      // Rolled through the real ending, on a value that sits above the flat chance: neither of
      // them should be marked, however long they lay there.
      const real = Math.random;
      Math.random = () => SCAR_CHANCE + 0.01;
      recoverDowned('once the field is held');
      Math.random = real;
      const out = { clocks, hp: { quick: quick.hp, slow: slow.hp }, max: quick.maxHp,
                    scars: { quick: (quick.scars || []).length, slow: (slow.scars || []).length },
                    chance: SCAR_CHANCE, share: DRAGGED_CLEAR };
      combatActive = false;
      return out;
    });
    ok(`the two of them lay there on different clocks (${flat.clocks.quick} and ${flat.clocks.slow} left)`,
      flat.clocks.quick > flat.clocks.slow);
    ok(`and come round on the same ${Math.round(flat.share * 100)}% ` +
       `(${flat.hp.quick} and ${flat.hp.slow} of ${flat.max})`,
      flat.hp.quick === flat.hp.slow && flat.hp.quick === Math.floor(flat.max * flat.share));
    ok(`on the same ${Math.round(flat.chance * 100)}% roll, which a shade above the chance ` +
       `misses for both of them`,
      flat.scars.quick === 0 && flat.scars.slow === 0);

    const graded = await page.evaluate(() => {
      const { squad } = __fight(2);
      const [quick, slow] = squad;
      __lie(quick, 0); __lie(slow, 2);
      const real = Math.random;
      Math.random = () => SCAR_CHANCE - 0.01;   // a shade under: it has to catch BOTH
      recoverDowned('once the field is held');
      Math.random = real;
      const out = { quick: (quick.scars || []).length, slow: (slow.scars || []).length };
      combatActive = false;
      return out;
    });
    ok('and a shade under the chance catches both of them, not just the one who was left',
      graded.quick === 1 && graded.slow === 1);

    // ── The manual says the flat numbers, and says the time does not count ──────────────
    const manual = await page.evaluate(() => {
      const body = CODEX.find(e => e.id === 'SCARS').body().join(' ');
      return { share: body.includes(`${Math.round(DRAGGED_CLEAR * 100)}%`),
               chance: body.includes(`${Math.round(SCAR_CHANCE * 100)}%`),
               flat: /how long they lay there changes neither/i.test(body),
               bar: /STIM tactic/i.test(body),
               prevention: /pick(ing)? them up|any heal/i.test(body) };
    });
    ok('the field manual states both flat numbers', manual.share && manual.chance);
    ok('and says outright that the time on the floor changes neither', manual.flat);
    ok('it names the bar as an answer, not just the medic', manual.bar);
    ok('and still says what skips the roll', manual.prevention);
  }
};

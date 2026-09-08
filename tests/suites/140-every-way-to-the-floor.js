// H05, and the premise it refuted. The brief read "STIM is 72% of every rescue the game has" and
// proposed more ways to pick somebody up. Measured, 87% was the simulator's own ordering - it
// spends the momentum bar in the tactic block and only consults the bag and the medic's hands
// afterwards, so the bar had first refusal on every rescue ever counted. Reversing that order
// (--rescue hands) moves the split to 61-65% / 16-18% / 19-21%, complete separation across three
// samples each way, while what the game OFFERS is identical in both arms.
//
// And reaching for the alternatives first is worse play: depth by third separated completely in
// the first two, half a sector, bar-first deeper. The bar is the renewable tool - spending it
// keeps the bag full and the medic firing, while the bag is finite and a medic's turn has an
// opportunity cost. So the one button is the right answer to a resource question and nothing
// was added to the game.
//
// What this suite pins is the thing that finding RESTS on: that all four routes to a downed
// operator are really wired, so "the bar is 72% of what is available" is a fact about reach
// rather than about three routes being quietly broken. It deliberately does NOT assert how many
// routes there are, or which classes hold them - 112 asserted the requisition shelf had exactly
// three things on it and went red the moment a fourth arrived, which is the anti-pattern 132
// records. A fifth way to pick somebody up should not turn this file red; a BROKEN way should.
module.exports = {
  name: 'Every way to the floor',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── The list is real: every entry is a move somebody fields or an item that exists ───
    const wired = await page.evaluate(() => {
      const deckMoves = new Set();
      Object.values(ABILITIES).forEach(list => list.forEach(a => deckMoves.add(a.move)));
      Object.values(FOURTH_ABILITIES).forEach(a => deckMoves.add(a.move));
      return REACHES_THE_DOWN.map(m => ({
        move: m,
        onADeck: deckMoves.has(m),
        isItem: m.startsWith('ITEM_'),
        // Which classes can field it at all - reported rather than asserted, so the record says
        // what the measurement rested on without forbidding a second class from gaining one.
        classes: Object.keys(ABILITIES).filter(c =>
          (ABILITIES[c] || []).some(a => a.move === m)
          || (FOURTH_ABILITIES[c] && FOURTH_ABILITIES[c].move === m))
      }));
    });
    ok(`the list names something for every entry (${wired.map(w => w.move).join(', ')})`,
      wired.length > 0 && wired.every(w => w.onADeck || w.isItem));
    const deckHalf = wired.filter(w => !w.isItem);
    ok(`its deck half is fielded by somebody (${deckHalf.map(w => `${w.move}:${w.classes.join('/') || 'NOBODY'}`).join(', ')})`,
      deckHalf.length > 0 && deckHalf.every(w => w.classes.length > 0));

    // ── Each one actually reaches a body on the floor ────────────────────────────
    // The engine gates targeting on REACHES_THE_DOWN, so an entry that is in the list but whose
    // resolver cannot pick a downed operator up would leave the reach figures counting a route
    // that does nothing. Driven through the real controls, one route at a time.
    const reaches = await page.evaluate(() => {
      const out = {};
      const stage = () => {
        currentSlot = 1; confirmNewGame(1.0);
        initiateCombat('RAIDERS', false);
        const line = activeEntities.filter(e => e.isPlayer);
        const victim = line[line.length - 1];
        // goDown does not zero the bar - it books the clock for an operator the damage path has
        // already put at zero, and returns without doing anything if they are still standing. A
        // staging that skipped this left the victim upright, and then every "puts them back up"
        // assertion below passed on somebody who had never gone down.
        victim.hp = 0; goDown(victim);
        return { line, victim };
      };
      // A downed operator is targetable by exactly the moves on the list, and not by others.
      const { victim } = stage();
      out.isDown = isDown(victim) && bleedingOut().some(e => e.id === victim.id);

      // The bag: MED_STIM.
      { const { victim } = stage();
        inventory = ['MED_STIM'];
        const wasDown = isDown(victim);
        const before = victim.hp;
        pendingAction = 'ITEM_MED'; resolveConsumableItem(victim.id);
        out.medStim = { wasDown, up: !isDown(victim), hp: victim.hp, before }; }

      // The bag: ADRENALINE.
      { const { victim } = stage();
        inventory = ['ADRENALINE'];
        const wasDown = isDown(victim);
        pendingAction = 'ITEM_ADRENALINE'; resolveConsumableItem(victim.id);
        out.adrenaline = { wasDown, up: !isDown(victim), hp: victim.hp }; }

      // The bar: the STIM tactic, which is the one a squad with no medic in the line has.
      { const { victim } = stage();
        momentum = 100;
        // stimTarget is what decides who the tactic reaches for, and a body on the floor is
        // meant to outrank every merely-hurt operator. That preference is the whole reason the
        // bar reads as a rescue route at all.
        out.stimPicks = stimTarget() && stimTarget().id === victim.id;
        const wasDown = isDown(victim);
        spendTactic('STIM');
        out.bar = { wasDown, up: !isDown(victim), hp: victim.hp }; }
      return out;
    });
    ok('a downed operator is on the bleeding-out list', reaches.isDown === true);
    ok(`a Med-Stim puts them back up (${reaches.medStim.before} -> ${reaches.medStim.hp})`,
      reaches.medStim.wasDown === true && reaches.medStim.up === true && reaches.medStim.hp > 0);
    ok(`so does Adrenaline (${reaches.adrenaline.hp})`,
      reaches.adrenaline.wasDown === true && reaches.adrenaline.up === true && reaches.adrenaline.hp > 0);
    ok('the bar reaches for the body on the floor before anyone merely hurt', reaches.stimPicks === true);
    ok(`and the STIM tactic puts them up (${reaches.bar.hp})`,
      reaches.bar.wasDown === true && reaches.bar.up === true && reaches.bar.hp > 0);

    // ── And a player can actually aim at them ────────────────────────────────────
    // The assertions above call the resolvers directly, which proves the routes WORK and not
    // that they are REACHABLE: renderField gates targeting on REACHES_THE_DOWN, and a mutant
    // that shut that gate left every one of them green. A route nobody can click is not a route,
    // and it is the gate rather than the resolver that decides whether the reach figures this
    // phase rests on mean anything.
    const aimable = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      initiateCombat('RAIDERS', false);
      const line = activeEntities.filter(e => e.isPlayer);
      const victim = line[line.length - 1];
      victim.hp = 0; goDown(victim);
      inventory = ['MED_STIM', 'ADRENALINE'];
      const canAim = move => {
        pendingAction = move; renderField();
        const el = document.querySelector(`[data-id="${victim.id}"].targetable-ally, .targetable-ally [data-id="${victim.id}"]`)
               || [...document.querySelectorAll('.targetable-ally')].find(n => n.innerHTML.includes(victim.id))
               || document.querySelector(`.entity.targetable-ally[data-id="${victim.id}"]`);
        const any = [...document.querySelectorAll('[data-action="target"], [data-action="use-item"]')]
          .some(n => n.getAttribute('data-id') === victim.id);
        pendingAction = null;
        return { marked: !!el, clickable: any };
      };
      const out = { med: canAim('ITEM_MED'), adr: canAim('ITEM_ADRENALINE'),
                    caut: canAim('CAUTERIZE'), dart: canAim('STIM_DART'),
                    // An ordinary attack must NOT offer a body on the floor as a target, which
                    // is the other half of the gate doing its job. REPOSITION is the sharper
                    // case: it is an ALLY move, so the inner branch would happily aim it at a
                    // player - only the REACHES_THE_DOWN check keeps it off somebody who is
                    // lying down. Swapping ranks with a body is the bug that check prevents.
                    attack: canAim('SCRAP_BLADE'), swap: canAim('REPOSITION') };
      renderField();
      return out;
    });
    ok(`a Med-Stim can be aimed at somebody on the floor (${aimable.med.clickable})`, aimable.med.clickable === true);
    ok(`so can Adrenaline (${aimable.adr.clickable})`, aimable.adr.clickable === true);
    ok(`so can Cauterize (${aimable.caut.clickable})`, aimable.caut.clickable === true);
    ok(`so can the Stim Dart (${aimable.dart.clickable})`, aimable.dart.clickable === true);
    ok(`and an attack cannot (${aimable.attack.clickable})`, aimable.attack.clickable === false);
    ok(`nor can a squadmate swap ranks with a body on the floor (${aimable.swap.clickable})`,
      aimable.swap.clickable === false);

    // ── The medic's two, driven from a medic ─────────────────────────────────────
    const hands = await page.evaluate(() => {
      const out = {};
      const stageMedic = move => {
        currentSlot = 1; confirmNewGame(1.0);
        initiateCombat('RAIDERS', false);
        const medic = activeEntities.find(e => e.isPlayer && e.classType === 'MEDIC');
        if (!medic) return null;
        const other = activeEntities.find(e => e.isPlayer && e.id !== medic.id);
        other.hp = 0; goDown(other);
        currentTurnIndex = activeEntities.indexOf(medic);
        medic.cooldowns = {};
        pendingAction = move;
        const before = other.hp;
        const wasDown = isDown(other);
        resolveAction(other.id);
        return { wasDown, up: !isDown(other), hp: other.hp, before };
      };
      out.cauterize = stageMedic('CAUTERIZE');
      out.dart = stageMedic('STIM_DART');
      return out;
    });
    ok(`Cauterize picks a body up (${hands.cauterize && hands.cauterize.before} -> ${hands.cauterize && hands.cauterize.hp})`,
      !!hands.cauterize && hands.cauterize.wasDown === true && hands.cauterize.up === true && hands.cauterize.hp > 0);
    ok(`and so does the Stim Dart (${hands.dart && hands.dart.hp})`,
      !!hands.dart && hands.dart.wasDown === true && hands.dart.up === true && hands.dart.hp > 0);

    // ── Going down is mostly survivable, which is what sets the stakes ───────────
    // Measured: 23.1 downs a run, 21.5 dragged clear at the fight's end, 3.13 lost for good. The
    // engine half of that is DRAGGED_CLEAR - if it ever stopped firing, every rescue in the game
    // would be life-or-death and this phase's conclusion would need revisiting.
    const afterwards = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      initiateCombat('RAIDERS', false);
      const line = activeEntities.filter(e => e.isPlayer);
      const victim = line[line.length - 1];
      victim.hp = 0; goDown(victim);
      const downMid = isDown(victim);
      activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
      checkWinState();
      const back = playerRoster.find(c => c.id === victim.id);
      return { downMid, clear: DRAGGED_CLEAR, hpAfter: back ? back.hp : -1, alive: back ? back.hp > 0 : false };
    });
    ok('an operator on the floor when the fight ends', afterwards.downMid === true);
    ok(`is dragged clear rather than left there (${afterwards.hpAfter} hp)`,
      afterwards.alive === true && afterwards.clear > 0);
  }
};

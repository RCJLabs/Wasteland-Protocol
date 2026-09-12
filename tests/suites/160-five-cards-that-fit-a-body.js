// M04. M02's census settled what these five cards are: 91% of every perk point the game ever
// spends goes on one of them. They are not filler beside the signatures - they ARE long-run
// progression, and they were five flat bumps that landed identically on every body. VETERAN was
// worth exactly as much to the Bruiser holding the line as to the Medic standing behind it, so
// the promotion screen was an ordering rather than a decision, and the ordering never changed
// from one operator to the next.
//
// They read the operator now. A perk is permanent per-operator though - unlike a scar, which M01
// made situational and which can be treated - so the condition must not be the sector or the
// sky: a card you cannot re-pick when the road turns would be a trap, not a choice. Each keys on
// the body's own job on the line, set at the Outpost and legible on the card you decide from:
//
//   VETERAN / FORTIFIED   how it lives:    unhurt, or hanging on.        Opposed.
//   SWIFT   / HARDENED    where it stands: off the front rank, or on it. Opposed.
//   HONED                 what it reaches: anything not already in arm's reach.
//
// THE ROWS ALL GO THROUGH THE ENGINE, not through the helpers. D05, D06 and K06 were each the
// same defect three times over - content measured by a harness that could not reach the decision
// - so a swing is a swing here (resolveAction, with the randomness in baseDmg pinned), a blow
// taken goes through mitigate, and SWIFT is read off the turn queue initiateCombat actually
// builds. The helpers are named too, but only where a row needs to say WHY a figure moved.
module.exports = {
  name: 'Five cards that fit a body',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      // A staged line, built from the shared helpers so this file does not become the 46th
      // hand-rolled fixture suite 159 is counting. The hero is bared - no quirk, no gear, no
      // traits - so the only thing separating two arms is the stack under test.
      window.__m04 = (cls, over) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        window.__clearField();
        activeDoctrine = null;
        const hero = window.__bare(playerRoster.find(c => c.classType === cls));
        hero.gridPos = 1; hero.dmgBase = 100; hero.maxHp = 9999; hero.hp = 9999;
        hero.stunnedTurns = 0; hero.perkStacks = {};
        Object.keys(hero.cooldowns || {}).forEach(k => { hero.cooldowns[k] = 0; });
        const foes = [0, 1, 2].map(i => window.__dummy(
          { id: 'e' + i, gridPos: i + 1, hp: 1e7, maxHp: 1e7 }));
        activeEntities = [hero, ...foes]; turnQueue = [hero, ...foes];
        activeIndex = 0; combatActive = true; pendingAction = null;
        Object.assign(hero, over || {});
        return { hero, foes };
      };
      // baseDmg carries a 0-5 roll. Pinned for the swing only - staging a new game needs its
      // randomness - so two arms differ by the perk and by nothing else. K03's whole finding was
      // assertions sitting inside their own noise; this one is not allowed to have any.
      window.__swing = (cls, move, dist, over) => {
        const { foes } = window.__m04(cls, over);
        activeIndex = 0; combatActive = true; pendingAction = move;
        const t = foes[dist], before = t.hp;
        const roll = Math.random;
        Math.random = () => 0;
        try { resolveAction(t.id); } finally { Math.random = roll; }
        return before - t.hp;
      };
    });

    // ── The card says what it wants, because you cannot take it back ─────────────
    // A situational effect the player cannot read before choosing is a trap rather than a
    // decision, and these are permanent. Both surfaces that show a stat card are checked: the
    // field promotion, and the Outpost's picker, which shows the short label alone.
    const cards = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const shelf = buyableFor(playerRoster[0]);
      return PERK_POOL.map(p => ({ id: p.id, label: p.label, desc: p.desc || '',
        offered: (shelf.find(b => b.id === p.id) || {}).label }));
    });
    ok(`all five stat cards carry a condition in the label (${cards.map(c => c.label).join(' · ')})`,
      cards.length === 5 && cards.every(c => /\(.*,/.test(c.label)));
    ok('and a sentence saying what it is, distinct per card',
      cards.every(c => c.desc.length > 20) && new Set(cards.map(c => c.desc)).size === 5);
    ok('and the Outpost picker shows the same label the promotion screen does',
      cards.every(c => c.offered === c.label));

    // ── VETERAN: pays on the swing, and only while the body is unhurt ────────────
    const vet = await page.evaluate(() => {
      const base = window.__swing('MEDIC', 'PISTOL', 1, {});
      const unhurt = window.__swing('MEDIC', 'PISTOL', 1, { perkStacks: { VETERAN: 1 } });
      const two = window.__swing('MEDIC', 'PISTOL', 1, { perkStacks: { VETERAN: 2 } });
      const hurt = window.__swing('MEDIC', 'PISTOL', 1, { perkStacks: { VETERAN: 1 }, hp: 100 });
      return { base, unhurt, two, hurt, step: PERK_DMG_FLAT };
    });
    ok(`VETERAN adds its number to a real swing (${vet.base} -> ${vet.unhurt})`,
      vet.unhurt === vet.base + vet.step);
    ok(`and stacks (${vet.base} -> ${vet.two} on two)`, vet.two === vet.base + 2 * vet.step);
    ok(`and pays nothing once the body is under half health (${vet.hurt}, same as ${vet.base})`,
      vet.hurt === vet.base);

    // ── HONED: the edge that wants room ─────────────────────────────────────────
    // A ranged verb, so the reach multiplier is 1 in both arms and the only thing between them
    // is the distance HONED reads. DUELIST pays at dist 0, where this does not - they are exact
    // complements rather than two names for the same bonus.
    const honed = await page.evaluate(() => {
      const farBase = window.__swing('MEDIC', 'PISTOL', 1, {});
      const far = window.__swing('MEDIC', 'PISTOL', 1, { perkStacks: { HONED: 1 } });
      const nearBase = window.__swing('MEDIC', 'PISTOL', 0, {});
      const near = window.__swing('MEDIC', 'PISTOL', 0, { perkStacks: { HONED: 1 } });
      const twice = window.__swing('MEDIC', 'PISTOL', 1, { perkStacks: { HONED: 2 } });
      return { farBase, far, nearBase, near, twice, mult: PERK_DMG_MULT };
    });
    ok(`HONED lands on anything out of arm's reach (${honed.farBase} -> ${honed.far})`,
      honed.far === Math.floor(honed.farBase * honed.mult));
    ok(`and compounds the way the old percentage did (${honed.twice} on two stacks)`,
      honed.twice === Math.floor(honed.farBase * honed.mult * honed.mult));
    ok(`and pays nothing at arm's reach (${honed.near}, same as ${honed.nearBase})`,
      honed.near === honed.nearBase && honed.nearBase > 0);

    // ── FORTIFIED and HARDENED: flat off every blow, through mitigate ────────────
    const soak = await page.evaluate(() => {
      const take = (over) => {
        const { hero } = window.__m04('BRUISER', over);
        return mitigate(null, hero, 100, 'phys', null).n;
      };
      return {
        step: PERK_SOAK,
        bare:       take({}),
        fortUnhurt: take({ perkStacks: { FORTIFIED: 1 } }),
        fortHurt:   take({ perkStacks: { FORTIFIED: 1 }, hp: 100 }),
        fortTwo:    take({ perkStacks: { FORTIFIED: 2 }, hp: 100 }),
        hardFront:  take({ perkStacks: { HARDENED: 1 }, gridPos: 1 }),
        hardBack:   take({ perkStacks: { HARDENED: 1 }, gridPos: 3 }),
        // No number of stacks can make a body untouchable - mitigate's own max(1, ...) floor.
        // That is why neither of these could be a percentage, and the row says so out loud.
        buried:     take({ perkStacks: { HARDENED: 40 }, gridPos: 1 })
      };
    });
    ok(`FORTIFIED pays nothing while the body is whole (${soak.fortUnhurt} of 100)`,
      soak.fortUnhurt === soak.bare && soak.bare === 100);
    ok(`and takes its number off once it is under half (${soak.fortHurt} of 100)`,
      soak.fortHurt === 100 - soak.step);
    ok(`stacking linearly (${soak.fortTwo} of 100 on two)`, soak.fortTwo === 100 - 2 * soak.step);
    ok(`HARDENED holds the front rank (${soak.hardFront} of 100) and nowhere else (${soak.hardBack})`,
      soak.hardFront === 100 - soak.step && soak.hardBack === 100);
    ok(`and forty stacks still cannot make a body untouchable (${soak.buried} of 100)`,
      soak.buried === 1);

    // ── SWIFT: read off the queue initiateCombat actually builds ─────────────────
    const order = await page.evaluate(() => {
      const first = (stacks, pos) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        window.__clearField(); activeDoctrine = null;
        const line = playerRoster.filter(c => c.gridPos > 0).sort((a, b) => a.gridPos - b.gridPos);
        const a = line[0], b = line[1];
        a.speed = 10; b.speed = 12;
        a.perkStacks = stacks ? { SWIFT: stacks } : {};
        b.perkStacks = {};
        a.gridPos = pos; b.gridPos = 2;
        initiateCombat('RAIDERS', false);
        return turnQueue.findIndex(e => e.id === a.id) < turnQueue.findIndex(e => e.id === b.id);
      };
      return { plainBack: first(0, 3), swiftBack: first(1, 3),
               plainFront: first(0, 1), swiftFront: first(1, 1) };
    });
    ok('the slower of two operators goes second without the card, in either rank',
      !order.plainBack && !order.plainFront);
    ok('SWIFT off the front rank moves it ahead of the faster one', order.swiftBack);
    ok('and the same card in the front rank does not', !order.swiftFront);

    // ── The two pairs are opposed, which is what makes them a choice ─────────────
    // Nothing about a body should ever have both halves of a pair live at once: that would make
    // taking both strictly better than taking two of either, and the pair stops being a fork.
    const opposed = await page.evaluate(() => {
      const probe = (hp, pos) => {
        const { hero } = window.__m04('BRUISER', { hp, gridPos: pos,
          perkStacks: { VETERAN: 1, FORTIFIED: 1, SWIFT: 1, HARDENED: 1 } });
        return { vet: perkDmgFlat(hero) > 0, fort: perkHurt(hero),
                 swift: perkSpeed(hero) > 0, hard: hero.gridPos === 1 };
      };
      const rows = [[9999, 1], [9999, 3], [100, 1], [100, 3]].map(([hp, p]) => probe(hp, p));
      return { rows,
        health: rows.every(r => r.vet !== r.fort),
        rank: rows.every(r => r.swift !== r.hard),
        everyCornerReached: new Set(rows.map(r => `${r.vet}${r.swift}`)).size === 4 };
    });
    ok('VETERAN and FORTIFIED are never both live on one body', opposed.health);
    ok('nor SWIFT and HARDENED', opposed.rank);
    ok('and all four corners of the two axes are reachable, so neither is vacuous',
      opposed.everyCornerReached);

    // ── An operator promoted before M04 is not paid twice ────────────────────────
    // The old cards wrote the sheet at purchase. A save from before this carries the raised
    // dmgBase AND the trait id, so a live read off `traits` would hand it the bonus a second
    // time. The stacks are their own field, written only where a card is granted under the new
    // rules - this row is the one that would go red if that ever became a traits read.
    const legacy = await page.evaluate(() => {
      const { hero } = window.__m04('MEDIC', {});
      hero.traits = ['VETERAN', 'VETERAN', 'HONED', 'SWIFT', 'FORTIFIED', 'HARDENED'];
      delete hero.perkStacks;
      return { flat: perkDmgFlat(hero), mult: perkDmgMult(hero, 2),
               spd: perkSpeed(Object.assign(hero, { gridPos: 3 })), soak: perkSoak(hero),
               held: hero.traits.length };
    });
    ok(`an operator carrying ${legacy.held} old trait ids and no stacks is paid nothing new ` +
       `(+${legacy.flat} DMG, x${legacy.mult}, +${legacy.spd} SPD, -${legacy.soak} taken)`,
      legacy.flat === 0 && legacy.mult === 1 && legacy.spd === 0 && legacy.soak === 0);

    // ── Both doors that grant a card bank a stack ────────────────────────────────
    // E08's defect was two spend paths that knew different things. There are still two - the
    // field promotion and the Outpost's picker - and they go through one function now.
    const doors = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster[0];
      c.traits = []; c.perkStacks = {}; c.perkPoints = 1;
      const sheetBefore = { dmg: c.dmgBase, hp: c.maxHp, spd: c.speed };
      assignPerk(c.id, 'SWIFT');
      const viaOutpost = perkStacks(c, 'SWIFT');
      c.perkPoints = 1;
      pendingPerkOffers = [{ charId: c.id, options: ['HARDENED', 'VETERAN', 'HONED'], shown: true }];
      takePerkOffer(0);
      return { viaOutpost, viaOffer: perkStacks(c, 'HARDENED'),
               traits: c.traits.slice(), sheetBefore,
               sheetAfter: { dmg: c.dmgBase, hp: c.maxHp, spd: c.speed } };
    });
    ok(`the Outpost picker banks a stack (SWIFT x${doors.viaOutpost})`, doors.viaOutpost === 1);
    ok(`and so does the field promotion (HARDENED x${doors.viaOffer})`, doors.viaOffer === 1);
    ok(`both still record the trait, which the tally and the dossier read (${doors.traits.join(', ')})`,
      doors.traits.join(',') === 'SWIFT,HARDENED');
    ok(`and neither writes the sheet any more (DMG ${doors.sheetAfter.dmg}, HP ` +
       `${doors.sheetAfter.hp}, SPD ${doors.sheetAfter.spd}, all unmoved)`,
      JSON.stringify(doors.sheetAfter) === JSON.stringify(doors.sheetBefore));

    // ── The stacks survive a save, which is the whole of long-run progression ────
    // E10's finding was a save that forgot things. This field IS the training half of an
    // operator's career now - if it did not round-trip, every reload would wipe 91% of every
    // perk point ever spent and the sheet would show nothing missing, because the sheet is no
    // longer where it lives.
    const saved = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster[0];
      c.traits = []; c.perkStacks = {}; c.perkPoints = 3;
      ['VETERAN', 'VETERAN', 'HONED'].forEach(id => assignPerk(c.id, id));
      const before = JSON.stringify(c.perkStacks);
      saveGameState();
      playerRoster = [];
      loadGameState();
      const back = playerRoster.find(p => p.id === c.id);
      return { before, after: JSON.stringify(back.perkStacks),
               vet: perkStacks(back, 'VETERAN'), honed: perkStacks(back, 'HONED') };
    });
    ok(`the stacks come back off a save exactly as they went in (${saved.after})`,
      saved.after === saved.before && saved.vet === 2 && saved.honed === 1);

    // ── What the two opposed pairs actually guarantee ────────────────────────────
    // Written first as "the front rank has fewer cards that fit it", which the rows below
    // refuted: it does not. The opposition is what does the work - one half of each pair is
    // live in every state a body can be in, so EXACTLY two of the four keyed cards are paying
    // on any operator at any moment, and no promotion screen is ever dead for the body it is
    // offered to. What changes between bodies is WHICH two, and that is the decision.
    //
    // HONED is deliberately outside this: it is the one card whose condition is not about the
    // body at all but about what the body is shooting at, so it is counted separately rather
    // than folded in and miscounted, which is exactly what the first draft of this row did.
    const spread = await page.evaluate(() => {
      const live = (pos, hp) => {
        const { hero } = window.__m04('BRUISER', { gridPos: pos, hp,
          perkStacks: { VETERAN: 1, FORTIFIED: 1, SWIFT: 1, HONED: 1, HARDENED: 1 } });
        return { keyed: [['VETERAN', perkDmgFlat(hero) > 0], ['FORTIFIED', perkHurt(hero)],
                         ['SWIFT', perkSpeed(hero) > 0], ['HARDENED', hero.gridPos === 1]]
                   .filter(([, on]) => on).map(([id]) => id),
                 honedFar: perkDmgMult(hero, 1) > 1, honedNear: perkDmgMult(hero, 0) > 1 };
      };
      return { front: live(1, 9999), frontHurt: live(1, 100),
               back: live(3, 9999), backHurt: live(3, 100) };
    });
    const states = [['front rank, whole', 'front'], ['front rank, hurt', 'frontHurt'],
                    ['behind the line, whole', 'back'], ['behind the line, hurt', 'backHurt']];
    ok(`exactly two of the four keyed cards pay in every state a body can be in (${
        states.map(([n, k]) => `${n}: ${spread[k].keyed.join('+')}`).join('; ')})`,
      states.every(([, k]) => spread[k].keyed.length === 2));
    ok('and the four sets are all different, so which two you get is the choice',
      new Set(states.map(([, k]) => spread[k].keyed.slice().sort().join(','))).size === 4);
    ok('HONED sits outside the four - the same in either rank, decided by what it shoots at',
      states.every(([, k]) => spread[k].honedFar && !spread[k].honedNear));

    // ── None of it reaches a hostile ─────────────────────────────────────────────
    // Every read is gated on isPlayer, and a hostile carrying the same field would otherwise
    // pick up a mitigation nothing in the bestiary names. Forced on rather than assumed off.
    const foe = await page.evaluate(() => {
      const d = window.__dummy({ perkStacks: { VETERAN: 3, HARDENED: 3, FORTIFIED: 3, SWIFT: 3 },
                                 gridPos: 1, hp: 10, maxHp: 400 });
      window.__clearField(); activeEntities = [d];
      // perkDmgMult is named here rather than left to the others: it is the ONE read with no
      // isPlayer check of its own, leaning entirely on the one inside perkStacks. Mutation
      // testing found that - dropping the gate from perkStacks alone survived every other row,
      // because each of them carries its own.
      return { soak: perkSoak(d), flat: perkDmgFlat(d), spd: perkSpeed(d),
               mult: perkDmgMult(d, 2), stacks: perkStacks(d, 'VETERAN'),
               carried: Object.keys(d.perkStacks || {}).length,
               took: mitigate(null, d, 100, 'phys', null).n };
    });
    ok(`the fixture really does put the field on the hostile (${foe.carried} stat perks in it)`,
      foe.carried === 4);
    ok(`and it gets none of it (${foe.took} of 100 taken, x${foe.mult} dealt)`,
      foe.soak === 0 && foe.flat === 0 && foe.spd === 0 && foe.mult === 1
      && foe.stacks === 0 && foe.took === 100);
  }
};

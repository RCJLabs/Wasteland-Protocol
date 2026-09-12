// M04. M02's census settled what these five cards are: 91% of every perk point the game ever
// spends goes on one of them. They are not filler beside the signatures, they ARE long-run
// progression, and they were five flat bumps that landed identically on every body.
//
// THE FIRST CUT OF THIS COST SIXTEEN WINS OF A CAREER and the reason is the shape of the rows
// below. A probe counted how often each condition fired over 14,559 player swings, and three of
// five barely did. Two things came out of it, and both are asserted here:
//
//   1. A CONDITION HAS TO BE A PROPERTY OF THE BODY. HONED first keyed on "the target is further
//      off than arm's reach", and `dist` is the target's index in the living-enemy list - a fact
//      about whichever foe the targeting picked, not about the operator. 81% of swings land on
//      the front of the enemy line, so the only multiplicative offence axis in the game went
//      from always-on to one swing in five. The verb's own reach fires on 60% and IS a body
//      property: a Medic carries a pistol, a Bruiser carries a blade.
//
//   2. MAX HEALTH HAS TO STAY MAX HEALTH. Turning the two HP cards into a flat cut off each blow
//      cost ten of the sixteen wins, and the multiplicative repair measured no better. Health
//      carries BETWEEN fights, so it is buffer no per-hit cut gives back. It is gated on the
//      deployed rank instead - a state that only changes at the Outpost, where stats may move.
//
// THE ROWS GO THROUGH THE ENGINE, not through the helpers: a swing is resolveAction with the
// baseDmg roll pinned, SWIFT is read off the queue initiateCombat builds, and the rank cards are
// driven by assignSlot, the button the player actually presses. D05, D06 and K06 were each
// content measured by a harness that could not reach the decision, and the first cut of M04 was
// the same mistake made one layer up - a condition nothing had measured the firing rate of.
module.exports = {
  name: 'Five cards that fit a body',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      // A staged line from the shared helpers, so this file is not the 46th hand-rolled fixture
      // suite 159 counts. The hero is bared - no quirk, gear or traits - so the only thing
      // between two arms is the stack under test.
      window.__m04 = (cls, over) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        window.__clearField();
        activeDoctrine = null;
        const hero = window.__bare(playerRoster.find(c => c.classType === cls));
        hero.gridPos = 1; hero.dmgBase = 100; hero.maxHp = 9999; hero.hp = 9999;
        hero.stunnedTurns = 0; hero.perkStacks = {}; hero.rankPerked = { hp: 0, spd: 0 };
        Object.keys(hero.cooldowns || {}).forEach(k => { hero.cooldowns[k] = 0; });
        const foes = [0, 1, 2].map(i => window.__dummy(
          { id: 'e' + i, gridPos: i + 1, hp: 1e7, maxHp: 1e7 }));
        activeEntities = [hero, ...foes]; turnQueue = [hero, ...foes];
        activeIndex = 0; combatActive = true; pendingAction = null;
        Object.assign(hero, over || {});
        return { hero, foes };
      };
      // baseDmg carries a 0-5 roll, pinned for the swing only - staging a new game needs its
      // randomness. K03's finding was assertions sitting inside their own noise; these have none.
      window.__swing = (cls, move, over) => {
        const { foes } = window.__m04(cls, over);
        activeIndex = 0; combatActive = true; pendingAction = move;
        const t = foes[0], before = t.hp;
        const roll = Math.random;
        Math.random = () => 0;
        try { resolveAction(t.id); } finally { Math.random = roll; }
        return before - t.hp;
      };
    });

    // ── Four cards name a condition, and the fifth deliberately does not ─────────
    const cards = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const shelf = buyableFor(playerRoster[0]);
      return PERK_POOL.map(p => ({ id: p.id, label: p.label, desc: p.desc || '',
        offered: (shelf.find(b => b.id === p.id) || {}).label }));
    });
    const conditional = cards.filter(c => /\(.*,/.test(c.label));
    ok(`four of five cards carry their condition in the label (${conditional.map(c => c.id).join(', ')})`,
      cards.length === 5 && conditional.length === 4);
    // The plain card is the point, not an omission: four conditional cards and no plain one
    // would mean a screen that can only offer an uncommitted body a mismatch, and a perk is
    // permanent. There has to be something to take when the answer is "not yet".
    ok(`and exactly one asks nothing (${cards.find(c => !/\(.*,/.test(c.label)).label})`,
      cards.filter(c => !/\(.*,/.test(c.label)).length === 1);
    ok('every card says what it wants in a sentence, distinct per card',
      cards.every(c => c.desc.length > 20) && new Set(cards.map(c => c.desc)).size === 5);
    ok('and the Outpost picker shows the same label the promotion screen does',
      cards.every(c => c.offered === c.label));

    // ── The verb axis: VETERAN swings, HONED shoots ──────────────────────────────
    // Two different bodies because a class carries one kind of deck, which is exactly what makes
    // this a body property rather than a turn-by-turn accident. Each is compared against itself.
    const verb = await page.evaluate(() => ({
      step: PERK_DMG_FLAT, mult: PERK_DMG_MULT,
      meleeBase:  window.__swing('BRUISER', 'SCRAP_BLADE', {}),
      meleeVet:   window.__swing('BRUISER', 'SCRAP_BLADE', { perkStacks: { VETERAN: 1 } }),
      meleeVet2:  window.__swing('BRUISER', 'SCRAP_BLADE', { perkStacks: { VETERAN: 2 } }),
      meleeHoned: window.__swing('BRUISER', 'SCRAP_BLADE', { perkStacks: { HONED: 3 } }),
      shotBase:   window.__swing('MEDIC', 'PISTOL', {}),
      shotHoned:  window.__swing('MEDIC', 'PISTOL', { perkStacks: { HONED: 1 } }),
      shotHoned2: window.__swing('MEDIC', 'PISTOL', { perkStacks: { HONED: 2 } }),
      shotVet:    window.__swing('MEDIC', 'PISTOL', { perkStacks: { VETERAN: 3 } })
    }));
    ok(`VETERAN pays on a blade (${verb.meleeBase} -> ${verb.meleeVet}), and stacks (${verb.meleeVet2})`,
      verb.meleeVet > verb.meleeBase && verb.meleeVet2 > verb.meleeVet);
    ok(`and three stacks of it do nothing at all on a pistol (${verb.shotVet}, same as ${verb.shotBase})`,
      verb.shotVet === verb.shotBase && verb.shotBase > 0);
    ok(`HONED pays on a pistol (${verb.shotBase} -> ${verb.shotHoned}) and compounds (${verb.shotHoned2})`,
      verb.shotHoned === Math.floor(verb.shotBase * verb.mult)
      && verb.shotHoned2 === Math.floor(verb.shotBase * verb.mult * verb.mult));
    ok(`and three stacks of it do nothing on a blade (${verb.meleeHoned}, same as ${verb.meleeBase})`,
      verb.meleeHoned === verb.meleeBase && verb.meleeBase > 0);
    // The flat card has to reach the splash and follow-up hits the way `dmgBase += 5` did -
    // several of those are figured off baseDmg with no multiplier on them at all. Asserted by
    // where it is added rather than by a second swing, because the AoE verbs vary by class.
    const flatReach = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      return /baseDmg = actEnt\.dmgBase \+ perkDmgFlat\(actEnt, effReach\)/.test(src);
    });
    ok('VETERAN goes into baseDmg, so it still reaches the splash and follow-up hits', flatReach);

    // ── The rank axis: driven through the button the player presses ──────────────
    const rank = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.gridPos > 0);
      c.perkStacks = { HARDENED: 2, SWIFT: 2 }; c.rankPerked = { hp: 0, spd: 0 };
      assignSlot(c.id, 0);
      const benched = { hp: c.maxHp, spd: c.speed };
      assignSlot(c.id, 1);
      const front = { hp: c.maxHp, spd: c.speed };
      assignSlot(c.id, 3);
      const back = { hp: c.maxHp, spd: c.speed };
      assignSlot(c.id, 1);
      const frontAgain = { hp: c.maxHp, spd: c.speed };
      // Reconciled, not incremented: shuffling the line twenty times must not drift the sheet.
      for (let i = 0; i < 20; i++) { assignSlot(c.id, 1); assignSlot(c.id, 3); assignSlot(c.id, 1); }
      return { benched, front, back, frontAgain, settled: { hp: c.maxHp, spd: c.speed },
               pct: PERK_MAXHP, step: PERK_SPD };
    });
    ok(`HARDENED pays only in the front rank (${rank.back.hp} HP behind the line, ${rank.front.hp} in it)`,
      rank.front.hp > rank.back.hp && rank.back.hp === rank.benched.hp);
    ok(`and it compounds rather than adding twice (two stacks is ${
        Math.round((rank.front.hp / rank.back.hp - 1) * 1000) / 10}%, not ${Math.round(rank.pct * 200)}%)`,
      Math.abs(rank.front.hp / rank.back.hp - Math.pow(1 + rank.pct, 2)) < 0.01);
    ok(`SWIFT pays anywhere but the front rank (${rank.back.spd} SPD behind, ${rank.front.spd} in front)`,
      rank.back.spd === rank.front.spd + 2 * rank.step);
    ok(`moving out and back restores the same sheet, exactly (${rank.front.hp}/${rank.front.spd} -> ${rank.frontAgain.hp}/${rank.frontAgain.spd})`,
      rank.frontAgain.hp === rank.front.hp && rank.frontAgain.spd === rank.front.spd);
    ok(`and sixty more rank changes do not drift it (${rank.settled.hp} HP, ${rank.settled.spd} SPD)`,
      rank.settled.hp === rank.front.hp && rank.settled.spd === rank.front.spd);

    // Moving somebody out of the front rank takes their HARDENED health back off, and a body
    // standing at full is then carrying more hp than it has maxHp - which every bar, every
    // percentage and every "is this operator hurt" read in the engine would then get wrong.
    // Mutation testing found this one: dropping the clamp survived every other row here.
    const clamp = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.gridPos > 0);
      c.perkStacks = { HARDENED: 4 }; c.rankPerked = { hp: 0, spd: 0 };
      assignSlot(c.id, 1);
      c.hp = c.maxHp;
      const full = c.maxHp;
      assignSlot(c.id, 3);
      return { full, hp: c.hp, maxHp: c.maxHp };
    });
    ok(`a body moved off the front rank loses the health and does not end up over its own cap ` +
       `(${clamp.full} -> ${clamp.hp} of ${clamp.maxHp})`,
      clamp.maxHp < clamp.full && clamp.hp === clamp.maxHp);

    // The other direction: buying health hands over the health, the way `c.maxHp += 25; c.hp +=
    // 25` always did. Without it an operator at full who buys a health card reads as wounded the
    // moment they bought it, and the one who is hurt gets a bigger cap and none of the benefit.
    const granted = await page.evaluate(() => {
      const buy = (atFull) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        const c = playerRoster.find(p => p.gridPos > 0);
        c.traits = []; c.perkStacks = {}; c.rankPerked = { hp: 0, spd: 0 }; c.perkPoints = 1;
        assignSlot(c.id, 1);
        c.hp = atFull ? c.maxHp : Math.floor(c.maxHp / 2);
        const hp0 = c.hp, max0 = c.maxHp;
        assignPerk(c.id, 'HARDENED');
        return { gained: c.maxHp - max0, healed: c.hp - hp0, full: c.hp === c.maxHp };
      };
      return { whole: buy(true), hurt: buy(false) };
    });
    ok(`a full body that buys HARDENED stays full (+${granted.whole.gained} HP, +${granted.whole.healed} healed)`,
      granted.whole.gained > 0 && granted.whole.healed === granted.whole.gained && granted.whole.full);
    ok(`and a hurt one gets the same health, still hurt (+${granted.hurt.gained} HP, +${granted.hurt.healed} healed)`,
      granted.hurt.healed === granted.hurt.gained && !granted.hurt.full);

    // SWIFT has to be visible where the turn order is actually decided, not only on the card.
    const order = await page.evaluate(() => {
      const first = (stacks, pos) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        window.__clearField(); activeDoctrine = null;
        const line = playerRoster.filter(c => c.gridPos > 0).sort((a, b) => a.gridPos - b.gridPos);
        const a = line[0], b = line[1];
        a.speed = 10; b.speed = 12;
        a.perkStacks = stacks ? { SWIFT: stacks } : {}; a.rankPerked = { hp: 0, spd: 0 };
        b.perkStacks = {}; b.rankPerked = { hp: 0, spd: 0 };
        assignSlot(b.id, 2); assignSlot(a.id, pos);
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

    // ── A reposition mid-fight does not rewrite anyone's max health ──────────────
    // The reason the rank cards read the DEPLOYED rank. REPOSITION swaps gridPos during a fight,
    // and a health bar that jumps when two operators trade places is the exact thing that made
    // the first cut of this reach for a per-hit cut instead - which cost ten wins.
    // Driven through REPOSITION itself, not by writing gridPos by hand: the hand-written version
    // proves nothing, because it only shows that a raw assignment does not sync. Mutation testing
    // caught that - adding a sync call inside the REPOSITION branch survived the earlier row.
    const shuffle = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField(); activeDoctrine = null;
      const line = playerRoster.filter(p => p.gridPos > 0).sort((a, b) => a.gridPos - b.gridPos);
      const a = line[0], b = line[1];
      [a, b].forEach(c => { c.perkStacks = {}; c.rankPerked = { hp: 0, spd: 0 }; });
      a.perkStacks = { HARDENED: 3 };
      assignSlot(b.id, 2); assignSlot(a.id, 1);
      const before = { a: a.maxHp, b: b.maxHp, rank: a.gridPos };
      const foe = window.__dummy({ id: 'z0', hp: 1e6, maxHp: 1e6 });
      activeEntities = [a, b, foe]; turnQueue = [a, b, foe];
      activeIndex = 0; combatActive = true; pendingAction = 'REPOSITION';
      resolveAction(b.id);
      return { before, after: { a: a.maxHp, b: b.maxHp, rank: a.gridPos },
               banked: a.rankPerked.hp };
    });
    ok(`REPOSITION really does move the operator out of the front rank (${shuffle.before.rank} -> ${shuffle.after.rank})`,
      shuffle.before.rank === 1 && shuffle.after.rank !== 1);
    ok(`and neither health bar moves when it does (${shuffle.before.a} -> ${shuffle.after.a}, ${shuffle.before.b} -> ${shuffle.after.b})`,
      shuffle.after.a === shuffle.before.a && shuffle.after.b === shuffle.before.b
      && shuffle.banked > 0);

    // ── FORTIFIED asks nothing, wherever it stands ───────────────────────────────
    const plain = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.gridPos > 0);
      c.traits = []; c.perkStacks = {}; c.rankPerked = { hp: 0, spd: 0 }; c.perkPoints = 2;
      const before = c.maxHp;
      assignPerk(c.id, 'FORTIFIED');
      const front = (assignSlot(c.id, 1), c.maxHp);
      const back = (assignSlot(c.id, 3), c.maxHp);
      assignPerk(c.id, 'FORTIFIED');
      return { before, front, back, twice: c.maxHp, step: PERK_HP_FLAT };
    });
    ok(`FORTIFIED pays the same in any rank (${plain.before} -> ${plain.front} front, ${plain.back} back)`,
      plain.front === plain.before + plain.step && plain.back === plain.front);
    ok(`and a second one adds again (${plain.twice})`, plain.twice === plain.before + 2 * plain.step);

    // ── An operator promoted before M04 is not paid twice ────────────────────────
    // The old cards wrote the sheet at purchase, so a save from before this carries the raised
    // dmgBase AND the trait id. A live read off `traits` would hand it the bonus a second time.
    const legacy = await page.evaluate(() => {
      const { hero } = window.__m04('MEDIC', {});
      hero.traits = ['VETERAN', 'VETERAN', 'HONED', 'SWIFT', 'FORTIFIED', 'HARDENED'];
      delete hero.perkStacks; delete hero.rankPerked;
      const hp0 = hero.maxHp, spd0 = hero.speed;
      hero.gridPos = 1; syncRankPerks(hero);
      return { flat: perkDmgFlat(hero, 'melee'), mult: perkDmgMult(hero, 'ranged'),
               hp: hero.maxHp - hp0, spd: hero.speed - spd0, held: hero.traits.length };
    });
    ok(`an operator carrying ${legacy.held} old trait ids and no stacks is paid nothing new ` +
       `(+${legacy.flat} DMG, x${legacy.mult}, +${legacy.hp} HP, +${legacy.spd} SPD)`,
      legacy.flat === 0 && legacy.mult === 1 && legacy.hp === 0 && legacy.spd === 0);

    // ── Both doors that grant a card bank a stack ────────────────────────────────
    // E08's defect was two spend paths that knew different things. There are still two - the
    // field promotion and the Outpost's picker - and they go through one function now.
    const doors = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.gridPos > 0);
      c.traits = []; c.perkStacks = {}; c.rankPerked = { hp: 0, spd: 0 }; c.perkPoints = 1;
      assignSlot(c.id, 3);
      const spd0 = c.speed;
      assignPerk(c.id, 'SWIFT');
      const viaOutpost = perkStacks(c, 'SWIFT');
      const paidAtOnce = c.speed - spd0;
      c.perkPoints = 1;
      pendingPerkOffers = [{ charId: c.id, options: ['HARDENED', 'VETERAN', 'HONED'], shown: true }];
      takePerkOffer(0);
      return { viaOutpost, paidAtOnce, viaOffer: perkStacks(c, 'HARDENED'),
               traits: c.traits.slice(), step: PERK_SPD };
    });
    ok(`the Outpost picker banks a stack (SWIFT x${doors.viaOutpost})`, doors.viaOutpost === 1);
    ok(`and it takes effect without waiting for the next rank change (+${doors.paidAtOnce} SPD)`,
      doors.paidAtOnce === doors.step);
    ok(`the field promotion banks one too (HARDENED x${doors.viaOffer})`, doors.viaOffer === 1);
    ok(`both still record the trait, which the tally and the dossier read (${doors.traits.join(', ')})`,
      doors.traits.join(',') === 'SWIFT,HARDENED');

    // ── The stacks survive a save, which is the whole of long-run progression ────
    // E10's finding was a save that forgot things. This field IS the training half of a career
    // now: without the round-trip every reload would wipe 91% of every perk point ever spent.
    const saved = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.gridPos > 0);
      c.traits = []; c.perkStacks = {}; c.rankPerked = { hp: 0, spd: 0 }; c.perkPoints = 3;
      assignSlot(c.id, 1);
      ['HARDENED', 'HARDENED', 'HONED'].forEach(id => assignPerk(c.id, id));
      const before = JSON.stringify(c.perkStacks), hp = c.maxHp, banked = c.rankPerked.hp;
      saveGameState();
      playerRoster = [];
      loadGameState();
      const back = playerRoster.find(p => p.id === c.id);
      return { before, after: JSON.stringify(back.perkStacks), hp, hpAfter: back.maxHp,
               banked, bankedAfter: (back.rankPerked || {}).hp,
               hard: perkStacks(back, 'HARDENED'), honed: perkStacks(back, 'HONED') };
    });
    ok(`the stacks come back off a save exactly as they went in (${saved.after})`,
      saved.after === saved.before && saved.hard === 2 && saved.honed === 1);
    ok(`and so does what the rank paid, so a reload cannot double or drop it (${saved.banked} HP banked, sheet ${saved.hpAfter})`,
      saved.hpAfter === saved.hp && saved.bankedAfter === saved.banked && saved.banked > 0);

    // ── None of it reaches a hostile ─────────────────────────────────────────────
    // perkDmgMult is named here rather than left to the others: it is the one read with no
    // isPlayer check of its own, leaning entirely on the one inside perkStacks. Mutation testing
    // found that - dropping the gate from perkStacks alone survived every other row.
    const foe = await page.evaluate(() => {
      // Every one of the five, HONED included: perkDmgMult is the read with no gate of its own,
      // so a fixture missing the card IT looks at cannot catch the gate going missing. Mutation
      // testing found exactly that - the first version of this row omitted HONED and survived.
      const d = window.__dummy({ perkStacks: { VETERAN: 3, HONED: 3, HARDENED: 3, SWIFT: 3, FORTIFIED: 3 },
                                 gridPos: 1, hp: 400, maxHp: 400 });
      window.__clearField(); activeEntities = [d];
      const hp0 = d.maxHp, spd0 = d.speed;
      syncRankPerks(d);
      return { flat: perkDmgFlat(d, 'melee'), mult: perkDmgMult(d, 'ranged'),
               hp: d.maxHp - hp0, spd: d.speed - spd0,
               carried: Object.keys(d.perkStacks || {}).length };
    });
    ok(`the fixture really does put all five on the hostile (${foe.carried} stat perks in it)`,
      foe.carried === 5);
    ok(`and it gets none of it (+${foe.flat} DMG, x${foe.mult}, +${foe.hp} HP, +${foe.spd} SPD)`,
      foe.flat === 0 && foe.mult === 1 && foe.hp === 0 && foe.spd === 0);
  }
};

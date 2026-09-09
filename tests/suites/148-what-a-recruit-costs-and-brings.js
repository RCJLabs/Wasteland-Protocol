// I03: H10 filed "the recruit you walk past" and could not answer it - the simulator signed 123
// of 123 offers it could afford, because its rule was `scrap >= cost + 80` and nothing else, so
// "the offer is not compelling" was not a finding that instrument could produce in either
// direction. H14 then made the question matter: recruits were the economic row that separated
// across the income sweep, co-moving with the win rate.
//
// simulate.js has a --recruit value arm now, and the answer is that declining is better - wipes
// a career fall from 5.73-6.13 to 4.69-5.39, complete separation, while the win rate moves the
// same way without separating. So the co-movement H14 saw was money moving both, not recruits
// winning runs.
//
// This suite pins the game-side facts that arm is built on, because every one of them shapes
// what "value" can even mean here: the cards are not priced against each other, so a choice
// between them is about fit rather than money; and what a signature actually buys is a body at
// part health, levelled to the squad but carrying none of its bought upgrades. It asserts the
// shape and prints the numbers, rather than pinning a pool size or a stat line - H13 went red on
// three suites that had baked one balance pass into a literal.
module.exports = {
  name: 'What a recruit costs and brings',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── One price, whoever is standing there ─────────────────────────────────────────
    const priced = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 4; currentTier = 6;
      const open = recruitables();
      return { count: open.length, ask: recruitCost(),
               classes: open.map(r => r.classType),
               // Arity zero: recruitCost cannot vary by card because it is handed none. Read
               // off the function rather than asserted in prose, so giving it a parameter -
               // the shape any per-card pricing would take - lands here.
               takesACard: recruitCost.length,
               ranks: open.map(r => r.rank),
               lines: open.map(r => ({ cls: r.classType, dmg: r.dmgBase, hp: r.maxHp, spd: r.speed })) };
    });
    ok(`the shelf offers more than one face (${priced.count}: ${priced.classes.join(', ')})`,
      priced.count > 1);
    ok('and no two of them are the same class', new Set(priced.classes).size === priced.classes.length);
    // recruitCost takes no argument, so this is structural rather than a coincidence of tuning -
    // but it is asserted through the engine so that giving a card its own price would land here.
    ok(`all of them ask the same price at a given depth (${priced.ask}, and the price is handed no card)`,
      priced.ask > 0 && priced.takesACard === 0);
    // They are not stat-ordered either: the cheapest thing to say about this shelf is that a
    // player picks on shape, not on a number that ranks them.
    const byDmg = [...priced.lines].sort((a, b) => b.dmg - a.dmg).map(l => l.cls);
    const byHp = [...priced.lines].sort((a, b) => b.hp - a.hp).map(l => l.cls);
    ok(`and they do not agree on who is best (${byDmg.join('>')} by damage, ${byHp.join('>')} by health)`,
      byDmg.join() !== byHp.join());

    // ── What signing actually buys ──────────────────────────────────────────────────
    const got = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 4; currentTier = 6;
      // Put the squad ahead of where a recruit starts: levels, and bought stat upgrades.
      playerRoster.forEach(c => { c.level = 6; });
      const buyer = playerRoster.find(c => c.gridPos > 0);
      scrap = 100000;
      const before = buyer.dmgBase;
      buyUpgrade(buyer.id, 'DMG', upgradeCost(buyer));
      const par = Math.max(1, Math.round(playerRoster.reduce((a, c) => a + c.level, 0) / playerRoster.length));
      const tpl = recruitables()[0];
      const card = { dmg: tpl.dmgBase, hp: tpl.maxHp, rank: tpl.rank };
      pendingRecruit = { nodeId: currentNodeId, id: tpl.id, cost: recruitCost(), taken: false };
      const paid = scrap;
      signOnRecruit();
      const hired = playerRoster.find(c => c.id === tpl.id);
      return { card, par, spent: paid - scrap, upgraded: buyer.dmgBase - before,
               hp: hired.hp, maxHp: hired.maxHp, level: hired.level, points: hired.perkPoints,
               dmg: hired.dmgBase, keptRank: 'rank' in hired, share: RECRUIT_HEALTH,
               // Counted rather than inferred from damage: signing rolls a random quirk that
               // moves dmgBase, so "their damage is still the card's" is true only when the
               // quirk happens to be damage-neutral. It passed twice and failed the third
               // battery. upgradeCount is what buyUpgrade actually increments, and it is what
               // the claim is about.
               boughtBySquad: buyer.upgradeCount, boughtByRecruit: hired.upgradeCount };
    });
    ok(`signing charges the asking price (${got.spent})`, got.spent > 0);
    ok(`and they walk in hurt, at the written share of their bar (${got.hp}/${got.maxHp})`,
      got.hp === Math.max(1, Math.floor(got.maxHp * got.share)) && got.hp < got.maxHp);
    ok(`levelled to the squad they are joining (level ${got.level}, par ${got.par})`,
      got.level === got.par);
    ok(`with a point banked for each level they were given (${got.points})`, got.points > 0);
    // The card's rank is a label on the shelf and nothing after: it is deleted on signing, so it
    // cannot be what a policy weighs.
    ok('and the rank on the card does not come with them', got.keptRank === false);
    // THE ONE THAT MATTERS FOR VALUE: the squad's bought upgrades do not transfer. A recruit is
    // behind the line they join by whatever the Outpost has sold it, which is why declining can
    // be worth more than the body.
    ok(`while the squad's bought upgrades stay with the squad (${got.boughtBySquad} bought on the line, ${got.boughtByRecruit} on the recruit)`,
      got.boughtBySquad > 0 && got.boughtByRecruit === 0 && got.upgraded > 0);

    // ── The shelf empties as you sign ───────────────────────────────────────────────
    const shrink = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 4; currentTier = 6; scrap = 100000;
      const seen = [recruitables().length];
      for (let i = 0; i < 3; i++) {
        const open = recruitables();
        if (!open.length) break;
        pendingRecruit = { nodeId: 'n' + i, id: open[0].id, cost: recruitCost(), taken: false };
        signOnRecruit();
        seen.push(recruitables().length);
      }
      return { seen };
    });
    ok(`and each signature takes a face off it (${shrink.seen.join(' -> ')})`,
      shrink.seen.every((v, i) => i === 0 || v < shrink.seen[i - 1]));
  }
};

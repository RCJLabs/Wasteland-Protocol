// K01: I08 established that a recruit is signed on 53% of the offers it sees and reaches the
// line on 8% of those, and that the reason is not the price and not a harness gate: the body is
// behind at the one moment anybody asks. Measured at sector five against a line seven upgrades
// deep, the card quoted HP 72 · DMG 21 and what walked in rated 39 against a line whose WORST
// hand rated 69. Nobody could read that off the card, and nobody should have signed it.
//
// The signing is a within-run hire - confirmAtNewGame rebuilds the roster from ROSTER_TEMPLATE,
// so a signature lasts one expedition - and this makes it a decision you can actually take for
// THIS run rather than a body you regret. Three parts:
//
//   the card quotes what ARRIVES, not the template it was cut from;
//   the arrival matches the squad's bought upgrades at the LINE's median, the same thought the
//     engine already applies to levels because "a fresh recruit six sectors deep would be a
//     body, not a hand" - I08 measured that gap at 19-20 points of a 31-33 point rating gap;
//   and the card says what the hand is FOR, against the line behind you and the sector you are
//     standing in.
//
// Elemental matching would have been the obvious hook for that last part and it is not
// available: enemyStrike reads `enemy.dmgType || 'phys'` and exactly three templates in the
// game set it, all commanders, so a bio resist answers two fights in a career. That is filed
// as K02 and is why the answer line talks about holes and reach instead.
module.exports = {
  name: 'The hire you can read',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    const deep = async () => await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 5; currentTier = 6;
      // Uneven on purpose. A line where everybody carries the same count cannot tell a median
      // from a maximum, and a mutant reading the best hand instead of the middle one survived
      // exactly that. 2 / 7 / 12 across the line puts the median at 7 and the best at 12.
      const line = playerRoster.filter(c => c.gridPos > 0);
      const spread = [2, 7, 12];
      playerRoster.forEach(c => { c.level = 8; });
      line.forEach((c, i) => { for (let k = 0; k < spread[i % spread.length]; k++) grantUpgrade(c, k % 2 ? 'DMG' : 'HP'); });
    });

    // ── One grant, whether it is bought or handed over ──────────────────────────────
    const grant = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster[0];
      const before = { hp: c.maxHp, dmg: c.dmgBase, n: c.upgradeCount };
      grantUpgrade(c, 'HP'); grantUpgrade(c, 'DMG');
      const free = { hp: c.maxHp, dmg: c.dmgBase, n: c.upgradeCount };
      // A zero price cannot show a charge, which is how a first pass at this let a mutant
      // that debits BEFORE the dead check walk straight through. Real purse, real price.
      scrap = 100;
      const dead = playerRoster[1]; dead.hp = 0;
      buyUpgrade(dead.id, 'HP', 50);
      return { before, free, purse: scrap, purseKept: scrap === 100, deadN: dead.upgradeCount };
    });
    ok(`a granted upgrade moves the same two stats a bought one does (HP ${grant.before.hp}→${grant.free.hp}, DMG ${grant.before.dmg}→${grant.free.dmg})`,
      grant.free.hp === grant.before.hp + 10 && grant.free.dmg === grant.before.dmg + 3);
    ok(`and counts once each (${grant.before.n} → ${grant.free.n})`, grant.free.n === grant.before.n + 2);
    // The dead check used to sit AFTER the charge, so buying for a body at zero took the scrap
    // and returned. The button is disabled there, so nobody was ever billed - the order was
    // still wrong, and this is the assertion that keeps it right.
    ok(`buying for the dead grants nothing and charges nothing (50 asked of a purse of 100, left at ${grant.purse})`,
      grant.deadN === 0 && grant.purseKept);

    // ── The card quotes the body that walks in ─────────────────────────────────────
    await deep();
    const card = await page.evaluate(() => {
      const tpl = recruitables()[0];
      const a = recruitArrival(tpl);
      const html = recruitCardHtml(tpl);
      return { tplHp: tpl.maxHp, tplDmg: tpl.dmgBase, a,
               spread: playerRoster.filter(c => c.gridPos > 0 && c.hp > 0).map(c => c.upgradeCount),
               quotesArrival: html.includes(`HP ${a.maxHp} · DMG ${a.dmgBase}`),
               quotesTemplate: html.includes(`HP ${tpl.maxHp} · DMG ${tpl.dmgBase}`),
               saysHealth: html.includes(`${a.hp}/${a.maxHp} HP`),
               saysQuirk: /quirk is rolled/.test(html),
               saysUpgrades: html.includes(`${a.upgrades} upgrade`) };
    });
    ok(`the parity taken is the LINE'S MIDDLE, not its best (${card.spread.join(' / ')} on the line, ${card.a.upgrades} handed over)`,
      card.a.upgrades === card.spread.slice().sort((x, y) => x - y)[Math.floor(card.spread.length / 2)]
      && card.a.upgrades < Math.max(...card.spread));
    ok(`the arrival is ahead of the template it was cut from (${card.tplHp}/${card.tplDmg} on the card's stock, ${card.a.maxHp}/${card.a.dmgBase} walking in)`,
      card.a.maxHp > card.tplHp && card.a.dmgBase > card.tplDmg);
    ok('and the card quotes the arrival, not the stock', card.quotesArrival && !card.quotesTemplate);
    ok(`it says what health they land on (${card.a.hp}/${card.a.maxHp}) and how many upgrades they carry (${card.a.upgrades})`,
      card.saysHealth && card.saysUpgrades);
    // The quirk is rolled at signing and moves the bar, so the card promises one rather than
    // inventing a figure it cannot know. Suite 149 pins the same honesty on the other side.
    ok('and admits a quirk is still to be rolled', card.saysQuirk);

    // ── What the card promised is what signs on ───────────────────────────────────
    await deep();
    const signed = await page.evaluate(() => {
      const tpl = recruitables()[0];
      const a = recruitArrival(tpl);
      scrap = 100000;
      pendingRecruit = { id: tpl.id, cost: recruitCost(), taken: false };
      signOnRecruit();
      const me = playerRoster.find(c => c.id === tpl.id);
      const q = me.quirk || { hp: 0, dmg: 0 };
      return { a, ups: me.upgradeCount, level: me.level,
               maxHp: me.maxHp, dmg: me.dmgBase, hp: me.hp, qhp: q.hp, qdmg: q.dmg };
    });
    ok(`the signing hands over the upgrades the card counted (${signed.ups} of ${signed.a.upgrades})`,
      signed.ups === signed.a.upgrades && signed.ups > 0);
    ok(`and lands on the level it named (${signed.level} of ${signed.a.level})`, signed.level === signed.a.level);
    // Read against the quirk the engine rolled rather than against the card's figure, because
    // the quirk is the one thing the card said it could not predict.
    ok(`the bar is the quoted one plus whatever the quirk did (${signed.a.maxHp} quoted, quirk ${signed.qhp >= 0 ? '+' : ''}${signed.qhp}, arrived ${signed.maxHp})`,
      signed.maxHp === signed.a.maxHp + signed.qhp);
    ok(`and the damage likewise (${signed.a.dmgBase} quoted, quirk ${signed.qdmg >= 0 ? '+' : ''}${signed.qdmg}, arrived ${signed.dmg})`,
      signed.dmg === signed.a.dmgBase + signed.qdmg);

    // ── And it is a hand rather than a body ───────────────────────────────────────
    await deep();
    const worth = await page.evaluate(() => {
      const rate = c => c.dmgBase + c.maxHp / 4;
      const tpl = recruitables()[0];
      const a = recruitArrival(tpl);
      const line = playerRoster.filter(c => c.gridPos > 0 && c.hp > 0);
      const worst = line.reduce((x, c) => (rate(c) < rate(x) ? c : x));
      return { stock: rate(tpl), arrived: a.dmgBase + a.maxHp / 4, worst: rate(worst), who: worst.name };
    });
    // K03: `stock < worst` went red in a sweep at 39 against 39. The line it compares against is
    // whatever a deep run happens to have levelled, so a tie is a draw the roll can produce on a
    // build with nothing wrong with it - and a tie is not the claim. What K01 is about is that
    // the PARITY GRANT is what puts the hire on the field: stock does not beat the worst hand,
    // the arrived body does, and the grant is the difference between them.
    ok(`the stock line does not beat the worst hand on the field (${worth.stock} against ${worth.who}'s ${worth.worst})`,
      worth.stock <= worth.worst);
    ok(`and the body that actually arrives does (${worth.arrived} against ${worth.worst})`,
      worth.arrived > worth.worst);
    ok(`which is the grant, not the template (${worth.stock} stock, ${worth.arrived} arrived)`,
      worth.arrived > worth.stock);

    // ── The card says what the hand is for ───────────────────────────────────────
    const answer = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      currentSector = 4; currentTier = 5;
      sectorFront = 'CARRION_BLOOM';
      const tpl = recruitables().find(r => recruitReach(r) === 'ranged') || recruitables()[0];
      const full = recruitAnswer(tpl);
      // Empty the line and the answer has to notice the hole.
      playerRoster.forEach(c => { c.gridPos = 0; });
      const short = recruitAnswer(tpl);
      return { full, short, front: currentFront().name };
    });
    ok(`the answer names the road you are standing on (${answer.front})`,
      answer.full.includes(answer.front));
    ok(`and a line with nobody on it reads as short (${answer.short.split(' · ')[0]})`,
      /short/.test(answer.short));
    ok('while a full line does not', !/is \d+ short/.test(answer.full));
  }
};

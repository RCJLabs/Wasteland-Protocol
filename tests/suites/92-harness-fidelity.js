// E01: tests/simulate.js is the lens every balance claim in this repo is read through, and it
// kept private copies of engine rules that had drifted from the engine. This suite pins the
// engine-side halves of the corrections - the pieces the harness now leans on instead of
// re-implementing - so the two cannot drift apart again without something going red.
//
// The one the audit got wrong is worth recording too. It was filed that stat.recovered and
// stat.clockLeft "read zero on the ~7-in-8 fights that are won", because checkWinState's victory
// block calls recoverDowned before the harness gets to look. Counted over eight expeditions, the
// engine's victory block was entered 354 times against 396 fight ends - the 7-in-8 is right -
// but it found somebody to pick up on only 3 of them, while the harness's own call picked up
// 101. The counters were never structurally zero and were not touched. What the engine really
// was double-banking is noteFightWon, which is what runStats.fightsWon now makes visible.
module.exports = {
  name: 'The harness reads the engine, not a copy of it',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => { currentSlot = 1; confirmNewGame(1.0); sectorFront = null; });

    // ── medBay is reachable, and is the heal the harness now drives ────────────────────
    const heal = await page.evaluate(() => {
      const c = playerRoster.find(p => p.gridPos > 0);
      c.maxHp = 100; c.hp = 10; scrap = 100;
      const exported = typeof WP.medBay === 'function';
      medBay(c.id, 'HEAL');
      const once = { hp: c.hp, scrap };
      medBay(c.id, 'HEAL');
      const twice = { hp: c.hp, scrap };
      // It stops at full rather than overshooting, and stops when the scrap runs out.
      c.hp = 95; scrap = 5;
      medBay(c.id, 'HEAL');
      return { exported, once, twice, brokeHp: c.hp, brokeScrap: scrap };
    });
    ok('medBay is on the export surface at all', heal.exported);
    ok(`one heal charges 10 and restores floor(maxHp*0.4) (hp 10 -> ${heal.once.hp}, scrap ${heal.once.scrap})`,
      heal.once.hp === 50 && heal.once.scrap === 90);
    ok(`and it is repeatable, which the flat +30 copy never was (hp ${heal.twice.hp}, scrap ${heal.twice.scrap})`,
      heal.twice.hp === 90 && heal.twice.scrap === 80);
    ok(`it will not heal on an empty purse (hp stayed ${heal.brokeHp})`, heal.brokeHp === 95 && heal.brokeScrap === 5);

    // ── noteFightWon leaves a record, so a second caller can reconcile instead of adding ──
    const banked = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const before = runStats.fightsWon || 0;
      noteFightWon();
      const after = runStats.fightsWon || 0;
      noteFightWon();
      return { before, after, twice: runStats.fightsWon || 0 };
    });
    ok(`a won fight is banked where the harness can see it (${banked.before} -> ${banked.after})`,
      banked.before === 0 && banked.after === 1);
    ok(`and it counts each call, so a double call is visible rather than silent (${banked.twice})`,
      banked.twice === 2);

    // ── The engine ticks KILL itself, which is why the harness stopped ─────────────────
    const kills = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5; initiateCombat('RAIDERS', false);
      const hero = activeEntities.find(e => e.isPlayer);
      const before = runStats.kills || 0;
      let guard = 0;
      while (activeEntities.some(e => !e.isPlayer && e.hp > 0) && guard++ < 40) {
        const foe = activeEntities.find(e => !e.isPlayer && e.hp > 0);
        applyDamageHit(hero, foe, 9999, 'phys', 'BASIC');
      }
      return { before, after: runStats.kills || 0, foes: guard };
    });
    ok(`the engine counts every hostile it drops, without help (${kills.before} -> ${kills.after})`,
      kills.after > kills.before && kills.after >= 1);

    // ── SECTOR progress exists in exactly one place, and openingTier is what a career buys ──
    const crossing = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      metaUpgrades.roadCrew = 0;
      const plain = openingTier();
      metaUpgrades.roadCrew = 1;
      const bought = openingTier();
      metaUpgrades.roadCrew = 0;
      return { plain, bought, exported: typeof WP.openingTier === 'function' };
    });
    ok('openingTier is reachable by the harness', crossing.exported);
    ok(`the Road Crew is a head start the crossing has to honour (tier ${crossing.plain} -> ${crossing.bought})`,
      crossing.plain === 1 && crossing.bought === 2);

    // ══ F03: the six engine rules the harness stopped keeping copies of ═══════════════
    // Each of these is the engine-side half of a hand copy the simulator was using instead.
    // The numbers are hardcoded from the design rather than read back out of the constant the
    // engine reads, because a test that reads the same table proves the table.

    // ── The Outpost sells ONE stat per purchase, at a price that rides the sector ──────
    const upgrade = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.gridPos > 0);
      c.upgradeCount = 0; c.maxHp = 100; c.hp = 100; c.dmgBase = 20; scrap = 100000;
      currentSector = 1;
      const priceS1 = upgradeCost(c);
      buyUpgrade(c.id, 'HP', priceS1);
      const afterHp = { hp: c.maxHp, dmg: c.dmgBase, count: c.upgradeCount };
      buyUpgrade(c.id, 'DMG', upgradeCost(c));
      const afterDmg = { hp: c.maxHp, dmg: c.dmgBase, count: c.upgradeCount };
      // The SAME click, three sectors deeper: same upgradeCount, so the only thing that can
      // move the number is the sector. Comparing across different counts would let a copy that
      // dropped the sector entirely still look like it was scaling.
      const counted = c.upgradeCount;
      c.upgradeCount = 0;
      const priceS1again = upgradeCost(c);
      currentSector = 4;
      const priceS4 = upgradeCost(c);
      c.upgradeCount = counted;
      // And it will not sell on an empty purse.
      scrap = 1;
      const before = c.maxHp;
      buyUpgrade(c.id, 'HP', upgradeCost(c));
      return { priceS1, priceS1again, priceS4, afterHp, afterDmg, broke: c.maxHp === before,
               exported: typeof WP.buyUpgrade === 'function' && typeof WP.upgradeCost === 'function' };
    });
    ok('buyUpgrade and upgradeCost are both on the export surface', upgrade.exported);
    ok(`one purchase moves one stat, not both (hp ${upgrade.afterHp.hp}, dmg ${upgrade.afterHp.dmg})`,
      upgrade.afterHp.hp === 110 && upgrade.afterHp.dmg === 20 && upgrade.afterHp.count === 1);
    ok(`and the next one moves the other (hp ${upgrade.afterDmg.hp}, dmg ${upgrade.afterDmg.dmg})`,
      upgrade.afterDmg.hp === 110 && upgrade.afterDmg.dmg === 23 && upgrade.afterDmg.count === 2);
    ok(`the price rides the sector, so a flat sector-1 copy under-pays (${upgrade.priceS1again} at sector 1 -> ${upgrade.priceS4} at sector 4, same count)`,
      upgrade.priceS1again === upgrade.priceS1 && upgrade.priceS4 > upgrade.priceS1again * 2);
    ok('and nothing is sold on an empty purse', upgrade.broke);

    // ── The camp's triage knows about the bench medic ─────────────────────────────────
    const triage = await page.evaluate(() => {
      const run = withMedic => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        playerRoster.forEach(p => { p.maxHp = 100; p.hp = 20; });
        const medic = playerRoster.find(p => p.classType === 'MEDIC') || playerRoster[0];
        if (withMedic) { medic.gridPos = 0; benchJob = { job: 'MEDIC', charId: medic.id }; }
        else benchJob = null;
        atCamp = true; campOutcome = null;
        resolveCamp('TRIAGE');
        const line = playerRoster.filter(p => p.gridPos > 0).map(p => p.hp);
        const bench = playerRoster.filter(p => p.gridPos === 0).map(p => p.hp);
        return { line, bench };
      };
      return { plain: run(false), kept: run(true) };
    });
    ok(`a plain camp puts 35% back, on the line only (line ${triage.plain.line.join('/')}, bench ${triage.plain.bench.join('/') || 'none'})`,
      triage.plain.line.every(h => h === 55) && triage.plain.bench.every(h => h === 20));
    ok(`a camp a medic is keeping puts 55% back, and reaches the bench (line ${triage.kept.line.join('/')}, bench ${triage.kept.bench.join('/')})`,
      triage.kept.line.every(h => h === 75) && triage.kept.bench.some(h => h === 75));

    // ── The intent that is executed is the one that was on screen ────────────────────
    // Driven twenty times rather than once, because the claim is that the intent on the board
    // is ALWAYS the one executed. A single trial cannot tell "acts on what it was wearing" from
    // "re-rolls first and happened to land on the same thing"; twenty DEFENDs in a row can.
    const telegraph = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5; initiateCombat('RAIDERS', false);
      playerRoster.forEach(c => { if (c.gridPos > 0) { c.maxHp = 99999; c.hp = 99999; } });
      const foe = activeEntities.find(e => !e.isPlayer && e.hp > 0);
      const spawned = !!foe.intent;
      let braced = 0, rolledNext = 0;
      for (let i = 0; i < 20; i++) {
        foe.armor = 0; foe.armorTurns = 0; foe.hp = foe.maxHp; foe.sigCd = 9;
        foe.intent = intentFor('DEFEND', foe);
        executeEnemyAi(foe);
        if (foe.armor > 0 && foe.armorTurns > 0) braced++;
        if (foe.intent && foe.intent.type) rolledNext++;
      }
      combatActive = false;
      return { spawned, braced, rolledNext };
    });
    ok('a hostile comes onto the field already wearing an intent', telegraph.spawned);
    ok(`and what it does is what it was wearing, every time (${telegraph.braced}/20 braced)`,
      telegraph.braced === 20);
    ok(`with the next one rolled only after the turn is taken (${telegraph.rolledNext}/20)`,
      telegraph.rolledNext === 20);

    // ── A fuse is counted in nodes, and the engine settles it after each one ─────────
    const fuse = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      pendingConsequences = []; runStats.nodes = 0;
      bookConsequence('RESUPPLY', 1);
      const atBooking = consequencesDue().length;
      runStats.nodes = 1;
      const afterOneNode = consequencesDue().length;
      const sector = currentSector;
      const settled = resolveConsequence();
      return { atBooking, afterOneNode, sector, sectorNow: currentSector, settled,
               left: pendingConsequences.length };
    });
    ok(`a fuse is not due the moment it is booked (${fuse.atBooking} due)`, fuse.atBooking === 0);
    ok(`it comes due a node later, not a sector later (${fuse.afterOneNode} due, still sector ${fuse.sectorNow})`,
      fuse.afterOneNode === 1 && fuse.sectorNow === fuse.sector);
    ok('and the engine has a resolver for it that the harness can drive',
      fuse.settled === true && fuse.left === 0);

    // ── A long order is kept by the engine, not by whoever is watching ───────────────
    const order = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      activeOrder = 'LONG'; runStats.order = 'LONG'; runStats.fulfilled = false;
      const before = !!runStats.fulfilled;
      noteVictory();
      return { before, after: !!runStats.fulfilled, won: !!runStats.won };
    });
    ok('an order starts unkept', order.before === false);
    ok('and clearing the road is the engine marking it kept, which is the flag to read',
      order.after === true && order.won === true);

    // ── A recruit joins with no bench set, which is why the policy has to be re-applied ──
    const recruit = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 3; currentTier = 4; scrap = 100000;
      const before = playerRoster.length;
      initiateRecruit();
      if (!pendingRecruit) return { skipped: true };
      const id = pendingRecruit.id;
      signOnRecruit();
      const joined = playerRoster.find(c => c.id === id);
      if (!joined) return { skipped: true };
      // Read before anything below touches it.
      const benchOnJoin = joined.benchedMove === undefined || joined.benchedMove === null;
      // Rank III, so the fourth is in the deck at all - which is where the bench choice bites.
      mastery[joined.classType] = 999999;
      const fourth = FOURTH_ABILITIES[joined.classType];
      const deckDefault = deckFor(joined).map(a => a.move);
      const basic = (ABILITIES[joined.classType] || []).find(a => !a.cd && a.reach !== 'self');
      joined.benchedMove = basic ? basic.move : null;
      const deckBenched = deckFor(joined).map(a => a.move);
      return { skipped: false, grew: playerRoster.length === before + 1, benchOnJoin,
               fourth: fourth ? fourth.move : null, deckDefault, deckBenched,
               basic: basic ? basic.move : null };
    });
    if (recruit.skipped) {
      ok('there was a recruit to sign', false);
    } else {
      ok('signing a recruit puts them on the roster', recruit.grew);
      ok(`carrying no bench choice of their own (${recruit.benchOnJoin})`, recruit.benchOnJoin);
      ok(`so the default deck leaves the fourth out (${recruit.fourth} in ${recruit.deckDefault.join(', ')})`,
        !!recruit.fourth && !recruit.deckDefault.includes(recruit.fourth));
      ok(`and benching the basic is what brings it (${recruit.deckBenched.join(', ')})`,
        recruit.deckBenched.includes(recruit.fourth) && !recruit.deckBenched.includes(recruit.basic));
    }
  }
};

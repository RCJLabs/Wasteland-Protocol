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
  }
};

// G06. Scavenger's Debt pays +40 a fight and the collector takes 500 at each warlord. He was
// taking it out of the purse the squad walked in with, inside the kill branch, before
// collectLoot banked the fight - and capped at whatever happened to be on hand.
//
// So a player who spent down at the shop before the boss node paid almost nothing. Measured
// before the fix: a purse of 10 against a price of 500 paid 10 and kept the other 490. That is
// 98% of a curse dodged by knowing when it fires, which is a decision about the interface
// rather than about the run.
//
// Settled against the payout now, at bankNode - the one choke point the game and the harness
// both bank through - and a shortfall is not a discount. What the scrap cannot cover comes out
// of the squad, in proportion, the same answer VELA FINDS YOU already gives a debtor who
// turns up empty.
module.exports = {
  name: 'The collector comes for it',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      window.__boss = (purse, relics) => {
        currentSlot = 1; confirmNewGame(1.0); currentSector = 1;
        activeRelics = (relics || ['SCAVENGERS_DEBT']).map(id => RELIC_POOL.find(r => r.id === id));
        initiateCombat('BOSS', false);
        // Clear the board first. A contract that settles on this same win pays into scrap, and
        // every reading below is an exact purse - so a BOSS bounty completing on the kill puts
        // 90 in the pocket and the arithmetic stops being about the collector. 34-curses hit
        // this years-of-commits ago and says so; this suite shipped without the guard and
        // failed about one battery in eight until it was added.
        activeBounties = []; standingBounty = null;
        scrap = purse;
        window.__hp = deployed().map(u => ({ id: u.id, hp: u.hp, maxHp: u.maxHp }));
        return collectorPrice();
      };
      window.__fell = () => { activeEntities.filter(e => !e.isPlayer).forEach(e => e.hp = 0);
                              checkWinState(); };
      window.__hurt = () => deployed().map(u => {
        const was = window.__hp.find(h => h.id === u.id);
        return was ? { lost: was.hp - u.hp, share: +((was.hp - u.hp) / was.maxHp).toFixed(3),
                       alive: u.hp > 0 } : null; }).filter(Boolean);
    });

    // ── Paid out of the money the warlord was standing on ─────────────────────────
    const rich = await page.evaluate(() => {
      const price = window.__boss(2000);
      window.__fell();
      const atKill = scrap;
      const loot = pendingLoot;
      collectLoot(pendingLoot);
      return { price, atKill, loot, after: scrap, hurt: window.__hurt().filter(h => h.lost > 0).length };
    });
    ok(`nothing is taken at the kill itself (${rich.atKill} still in the purse)`, rich.atKill === 2000);
    ok(`the price comes out once the fight has paid (2000 + ${rich.loot} - ${rich.price} = ${rich.after})`,
      rich.after === 2000 + rich.loot - rich.price);
    ok('and a squad that can pay pays only in scrap', rich.hurt === 0);

    // ── Arriving empty is the worst way to meet him, not the cheapest ─────────────
    const poor = await page.evaluate(() => {
      const price = window.__boss(10);
      window.__fell();
      const loot = pendingLoot;
      collectLoot(pendingLoot);
      const hurt = window.__hurt();
      return { price, loot, after: scrap, hurt,
               allAlive: hurt.every(h => h.alive), bitten: hurt.filter(h => h.lost > 0).length };
    });
    ok(`an empty purse is emptied first (${poor.after} left of 10 + ${poor.loot})`, poor.after === 0);
    ok(`and the rest comes out of the squad (${poor.bitten} of ${poor.hurt.length} bitten)`,
      poor.bitten === poor.hurt.length && poor.bitten > 0);
    ok('nobody is killed by a debt', poor.allAlive === true);

    // A squad already on its last legs is the case the floor is for: a full bite off a bar
    // they have almost none of left would otherwise take the run rather than the money.
    const nearlyDead = await page.evaluate(() => {
      window.__boss(0);
      deployed().forEach(u => { u.hp = 1; });
      settleCollector();
      const line = deployed();
      return { hp: line.map(u => u.hp), standing: line.filter(u => u.hp > 0).length, of: line.length };
    });
    ok(`a squad at one health each survives the collector (${nearlyDead.hp.join(', ')})`,
      nearlyDead.of > 0 && nearlyDead.standing === nearlyDead.of);

    // ── The bite is proportional to what went unpaid ──────────────────────────────
    const scaled = await page.evaluate(() => {
      const read = () => {
        const price = collectorPrice();
        const before = deployed().map(u => ({ id: u.id, hp: u.hp, maxHp: u.maxHp }));
        const paid = Math.min(scrap, price);
        settleCollector();
        // The bite is floored per operator - Math.floor(maxHp * share) - so the share that
        // comes back out depends on the bar it was taken from. Report the bar too, and let the
        // assertion do the same arithmetic the engine did, instead of allowing a tolerance that
        // only holds for bars the share happens to divide evenly. G05 recorded this exact trap
        // and this suite shipped with it anyway: at 65 maxHp a tenth is floor(6.5)/65 = 0.092,
        // and the +-0.002 that used to be here failed roughly one battery in three.
        const bitten = deployed().map(u => {
          const w = before.find(b => b.id === u.id);
          return w ? { lost: w.hp - u.hp, maxHp: w.maxHp } : { lost: 0, maxHp: 1 };
        });
        const worstIdx = bitten.reduce((best, b, i, a) =>
          (b.lost / b.maxHp) > (a[best].lost / a[best].maxHp) ? i : best, 0);
        const w = bitten[worstIdx];
        return { price, paid, share: +(w.lost / w.maxHp).toFixed(4), lost: w.lost, maxHp: w.maxHp };
      };
      window.__boss(0);   const none = read();
      window.__boss(250); const half = read();
      window.__boss(500); const full = read();
      return { none, half, full, bite: COLLECTOR_BITE };
    });
    // Each expectation is floored the way the engine floors it, against the bar it was actually
    // taken from - so the assertion is exact at every roster the draft can deal.
    const floored = (frac, maxHp) => Math.floor(maxHp * frac) / maxHp;
    ok(`paying none of it costs the full bite (${scaled.none.lost} of ${scaled.none.maxHp}, cap ${scaled.bite})`,
      scaled.none.lost === Math.floor(scaled.none.maxHp * scaled.bite));
    ok(`paying half of it costs half (${scaled.half.lost} of ${scaled.half.maxHp} = ${scaled.half.share}, floored expectation ${floored(scaled.bite / 2, scaled.half.maxHp).toFixed(4)})`,
      scaled.half.lost === Math.floor(scaled.half.maxHp * (scaled.bite / 2)));
    ok(`paying all of it costs none (${scaled.full.lost} of ${scaled.full.maxHp})`, scaled.full.lost === 0);

    // ── The set still discounts it ────────────────────────────────────────────────
    const terms = await page.evaluate(() => {
      const alone = window.__boss(5000);
      const paired = window.__boss(5000, ['SCAVENGERS_DEBT', 'VULTURE_ROYALTY']);
      window.__fell(); collectLoot(pendingLoot);
      return { alone, paired, after: scrap };
    });
    ok(`the Collector's Terms still halves the price and more (${terms.alone} alone, ${terms.paired} paired)`,
      terms.alone === 500 && terms.paired === 200);

    // ── Only when a warlord actually falls ────────────────────────────────────────
    const notOwed = await page.evaluate(() => {
      const out = {};
      // Running from the commander is not felling it.
      window.__boss(2000); withdraw();
      out.ranAway = { purse: scrap, due: collectorDue };
      // And an ordinary node is not a warlord.
      currentSlot = 1; confirmNewGame(1.0);
      activeRelics = [RELIC_POOL.find(r => r.id === 'SCAVENGERS_DEBT')];
      initiateCombat('RAIDERS', false);
      activeBounties = []; standingBounty = null;
      scrap = 2000;
      activeEntities.filter(e => !e.isPlayer).forEach(e => e.hp = 0);
      checkWinState(); collectLoot(pendingLoot);
      out.ordinary = { purse: scrap, due: collectorDue };
      // And a squad without the relic owes nothing.
      window.__boss(2000, ['VULTURE_ROYALTY']); window.__fell(); collectLoot(pendingLoot);
      out.noRelic = { purse: scrap, due: collectorDue };
      return out;
    });
    ok(`running from a warlord owes nothing (${notOwed.ranAway.purse} kept)`,
      notOwed.ranAway.purse >= 2000 && notOwed.ranAway.due === false);
    ok(`an ordinary fight owes nothing (${notOwed.ordinary.purse})`,
      notOwed.ordinary.purse > 2000 && notOwed.ordinary.due === false);
    ok(`and neither does a squad that is not carrying the debt (${notOwed.noRelic.purse})`,
      notOwed.noRelic.purse > 2000);

    // ── And it cannot be walked away from by reloading on the LOOT screen ─────────
    const reload = await page.evaluate(() => {
      window.__boss(2000);
      window.__fell();
      const due = collectorDue;
      saveGameState(); loadGameState();
      const kept = collectorDue;
      collectLoot(pendingLoot);
      return { due, kept, after: scrap };
    });
    ok(`the debt survives a reload between the kill and the loot (${reload.kept})`,
      reload.due === true && reload.kept === true);
    ok(`so reloading does not walk away from it (${reload.after})`, reload.after < 2000);

    // Proved off the file rather than off the variable: cleared in memory after the save, so
    // the value that comes back can only have come from what was written.
    const fromFile = await page.evaluate(() => {
      window.__boss(2000);
      window.__fell();
      saveGameState();
      collectorDue = false;                 // as a fresh session would start
      loadGameState();
      return { restored: collectorDue };
    });
    ok(`and the save is what carries it, not the variable (${fromFile.restored})`,
      fromFile.restored === true);

    // ── Paid once, not at every node after ────────────────────────────────────────
    const onceOnly = await page.evaluate(() => {
      window.__boss(3000);
      window.__fell();
      collectLoot(pendingLoot);
      const afterBoss = scrap;
      const due = collectorDue;
      // The next ordinary node banks too. The collector has been paid and is not still standing
      // there - a flag that settles but never clears would charge every node for the rest of it.
      initiateCombat('RAIDERS', false);
      activeBounties = []; standingBounty = null;
      activeEntities.filter(e => !e.isPlayer).forEach(e => e.hp = 0);
      checkWinState(); collectLoot(pendingLoot);
      return { afterBoss, due, afterNext: scrap };
    });
    ok(`the flag is cleared by the payment (${onceOnly.due})`, onceOnly.due === false);
    ok(`so the next node pays the squad rather than the collector (${onceOnly.afterBoss} → ${onceOnly.afterNext})`,
      onceOnly.afterNext > onceOnly.afterBoss);
  }
};

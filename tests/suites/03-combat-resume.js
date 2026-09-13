// Finding 02: a fight must survive a reload, so refreshing cannot undo damage or dodge a loss.
module.exports = {
  name: 'Combat survives a reload',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    const before = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const hero = playerRoster.find(p => p.gridPos > 0); hero.hp = 17;
      const enemy = activeEntities.find(e => !e.isPlayer); enemy.hp = 9;
      saveGameState();
      return { tier: currentTier, heroHp: hero.hp, enemyHp: enemy.hp };
    });

    await page.reload();
    await engineUp(page);
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(700);

    const after = await page.evaluate(() => ({
      screen: getComputedStyle(document.getElementById('screen-combat')).display,
      active: combatActive,
      heroHp: (playerRoster.find(p => p.gridPos > 0) || {}).hp,
      enemyHp: (activeEntities.find(e => !e.isPlayer) || {}).hp,
      tier: currentTier,
      liveRefs: activeEntities.some(e => e.isPlayer && e === playerRoster.find(p => p.id === e.id)),
      log: document.getElementById('log').innerText
    }));
    ok('reload drops back into the fight', after.screen === 'flex' && after.active);
    ok('squad damage persisted', after.heroHp === before.heroHp);
    ok('enemy damage persisted', after.enemyHp === before.enemyHp);
    ok('the refresh did not advance the tier', after.tier === before.tier);
    ok('player entities are live roster references', after.liveRefs);
    ok('the log announces the resume', /COMBAT RESUMED/.test(after.log));

    let outcome = 'timeout';
    for (let i = 0; i < 200; i++) {
      await page.waitForTimeout(220);
      const deck = await page.$eval('#command-deck', e => e.innerText).catch(() => '');
      if (/LOOT/i.test(deck)) { await page.click('#command-deck button'); outcome = 'victory'; break; }
      if (/FAILED/i.test(deck)) { await page.click('#command-deck button'); outcome = 'wipe'; break; }
      const t = await page.$('.targetable-enemy') || await page.$('.targetable-ally');
      if (t) { await t.click().catch(() => {}); continue; }
      for (const b of await page.$$('#command-deck button:not([disabled])')) {
        const tx = ((await b.textContent()) || '').trim();
        if (tx && !/CANCEL|BACK|BAG/i.test(tx)) { await b.click().catch(() => {}); break; }
      }
    }
    ok(`the resumed fight is fully playable (${outcome})`, outcome !== 'timeout');
    const snap = await page.evaluate(() =>
      JSON.parse(localStorage.getItem(BASE_SAVE_KEY + currentSlot) || '{}').combat);
    ok('the snapshot clears once the fight is settled', !snap);

    // ── A FIGHT THAT COMES BACK WITH NOBODY STANDING STILL HAS TO END ─────────────────
    // Found while checking a loose thread from #209: a resume loaded an operator at 0 hp and the
    // fight came back up ACTIVE with nobody on our side of it. The assumption at the time was
    // that the wipe check fires on the next turn. It does not, and the cost of not checking was
    // an unrecoverable soft-lock.
    //
    // executeEnemyAi picks its targets with
    //     let validTargets = activeEntities.filter(e => e.isPlayer && e.hp > 0);
    //     if (validTargets.length === 0) return;
    // and that bare return was the ONE exit of about nine in that function that neither schedules
    // the next turn nor checks the win state. Every sibling does one or the other. So the chain
    // stopped dead: activeIndex frozen, combatActive true, the deck reading "ENEMY TURN..." and
    // the log holding nothing after "> COMBAT RESUMED." - no SQUAD DOWN, no run over, no way out
    // of the tab. Measured at 12s here and it is not a slow frame, it is forever.
    //
    // WHY RESUME IS THE WAY IN. Nothing else starts a turn without a checkWinState in front of
    // it. applyDamageHit does not call checkWinState itself - its CALLERS do - so in a normal
    // fight the blow that empties the field also ends it. resumeCombat calls processTurn
    // directly, so a fight restored with the field already empty gets a turn nobody checked.
    //
    // WHAT IS NOT ESTABLISHED: that ordinary play writes such a save. saveGameState runs at the
    // top of processTurn, before the turn's effects, so the bytes on disk carry a living squad;
    // no route from real play to a wiped-squad save was found. This holds the engine to the
    // safe behaviour either way, because the cost of being wrong is a save nobody can open.
    await page.reload();
    await engineUp(page);
    const stuck = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      globalSettings.combatSpeed = 0.05;
      initiateCombat('RAIDERS', false);
      // The state the resume has to survive: a snapshot whose squad is already down.
      activeEntities.filter(e => e.isPlayer).forEach(e => { e.hp = 0; });
      playerRoster.forEach(p => { p.hp = 0; });
      saveGameState();
      return localStorage.getItem(BASE_SAVE_KEY + currentSlot);
    });
    await page.reload();
    await engineUp(page);
    const came = await page.evaluate(saved => {
      currentSlot = 1; localStorage.setItem(BASE_SAVE_KEY + currentSlot, saved);
      globalSettings.combatSpeed = 0.05;
      loadGameState();
      if (pendingCombat) resumeCombat(pendingCombat);
      return { active: combatActive,
               oursUp: activeEntities.filter(e => e.isPlayer && e.hp > 0).length,
               foesUp: activeEntities.filter(e => !e.isPlayer && e.hp > 0).length };
    }, stuck);
    ok(`a save whose squad is already down still comes back as a fight (${came.oursUp} up against ${came.foesUp})`,
      came.oursUp === 0 && came.foesUp > 0);
    // The whole point is the DEFERRED chain, so this waits on the engine rather than on a clock.
    let ended = true;
    try { await page.waitForFunction(() => !combatActive, null, { polling: 100, timeout: 12000 }); }
    catch (e) { ended = false; }
    const way = await page.evaluate(() => ({
      active: combatActive, ai: activeIndex,
      down: /squad-down/.test((document.getElementById('command-deck') || {}).innerHTML || ''),
      deck: ((document.getElementById('command-deck') || {}).innerHTML || '').replace(/<[^>]*>/g, '').trim().slice(0, 40)
    }));
    ok(`and it ends rather than hanging on a turn with nothing to swing at `
       + `(${ended ? 'ended' : 'STILL ACTIVE after 12s'}, deck "${way.deck}", index ${way.ai})`,
      ended === true && way.active === false);
    ok(`with SQUAD DOWN on the deck, which is the only way out of that screen (${way.down})`,
      way.down === true);
  }
};

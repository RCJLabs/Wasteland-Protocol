// Losing a fight must never destroy an expedition the player did not choose to end. A wipe
// spends a regroup and gives up ground; only when regroups run out, or they choose to stop,
// does the run end and the slot clear.
//
// The ground given up is the whole sector, and it stays that way on measured evidence rather
// than by default. Falling back three tiers instead was built and reverted: every income
// channel roughly halved (promotions 39.1 -> 21.9, elites 4.60 -> 1.98, relics 6.2 -> 2.9) and
// depth fell with them (mean sector 2.9 -> 1.9, commanders felled 1.93 -> 0.92), because the
// re-walk is not the punishment - it is the levelling curve. See regroupSquad.
module.exports = {
  name: 'Regroup on defeat',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    const wipe = () => page.evaluate(() => {
      initiateCombat('RAIDERS', false);
      playerRoster.forEach(c => c.hp = 0);
      checkWinState();
    });

    // ---- a first defeat offers a regroup and keeps the save ----
    const setup = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta();
      bossSkulls = 5; saveMeta();
      confirmNewGame(1.0); sectorFront = null;
      currentSector = 3; currentTier = 6; scrap = 600; noteDepth(); saveGameState();
      return { regroups: runStats.regroups, slot: !!localStorage.getItem(BASE_SAVE_KEY + 1) };
    });
    ok(`a run starts with regroups banked (${setup.regroups})`, setup.regroups === 2);

    await wipe();
    await page.waitForTimeout(300);
    const prompt = await page.$eval('#command-deck', e => e.innerText);
    ok('the defeat prompt no longer says restart', /SQUAD DOWN/.test(prompt) && !/RESTART/.test(prompt));

    await page.locator('[data-action="squad-down"]:visible').first().click();
    await page.waitForTimeout(400);
    const broken = await page.evaluate(() => ({
      screen: getComputedStyle(document.getElementById('screen-runover')).display,
      title: document.getElementById('runover-title').innerText,
      score: document.getElementById('runover-score').innerText,
      canRegroup: !!document.querySelector('[data-action="regroup"]'),
      canEnd: !!document.querySelector('[data-action="end-run"]'),
      slotAlive: !!localStorage.getItem(BASE_SAVE_KEY + 1)
    }));
    ok('a defeat shows the squad-broken screen, not the run summary', /SQUAD BROKEN/.test(broken.title));
    ok('it reports the regroups remaining', /2 REGROUPS LEFT/.test(broken.score));
    ok('it offers both regrouping and ending the run', broken.canRegroup && broken.canEnd);
    ok('the save is still there at this point', broken.slotAlive);

    await page.locator('[data-action="regroup"]:visible').first().click();
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({
      onMap: getComputedStyle(document.getElementById('screen-map')).display === 'flex',
      tier: currentTier, sector: currentSector, scrap,
      regroups: runStats.regroups,
      alive: playerRoster.filter(c => c.gridPos > 0).every(c => c.hp === c.maxHp),
      slotAlive: !!localStorage.getItem(BASE_SAVE_KEY + 1)
    }));
    ok('regrouping returns to the map', after.onMap);
    ok('it restarts at the first node of the sector', after.tier === 1 && after.sector === 3);
    ok('the squad is revived', after.alive);
    ok(`half the scrap is the price (600 -> ${after.scrap})`, after.scrap === 300);
    ok('a regroup was spent', after.regroups === 1);
    ok('the save survived the defeat', after.slotAlive);
    ok('and the squad comes back with tuned weapons, not just poorer',
      await page.evaluate(() => tuneUpBattles) >= 3);

    // The sector's whole road opens again, which is what makes a re-walk possible - and the
    // re-walk is where a squad that lost to the commander gets strong enough to take it.
    const ground = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 1;
      while (currentTier < TOTAL_TIERS) { const id = availableNodeIds()[0]; if (!id) break; enterNode(id); currentTier++; }
      const walked = clearedNodeIds.length;
      runStats.regroups = 2;
      regroupSquad();
      return { walked, cleared: clearedNodeIds.length, tier: currentTier,
               node: currentNodeId, open: availableNodeIds().map(x => nodeById(x).tier) };
    });
    ok(`a sector's road is given back in full (${ground.walked} cleared -> ${ground.cleared})`,
      ground.walked >= 8 && ground.cleared === 0 && ground.node === null);
    ok('and the squad stands at the bottom of it with the tier-1 nodes on offer',
      ground.tier === 1 && ground.open.length > 0 && ground.open.every(t => t === 1));

    // A retreat is over the moment the squad is dragged off. Left set, it pinned the whole map
    // to one node - and after a wipe that node can be nine tiers above where the fallback put
    // them, which made the map offer a commander to a squad standing at tier 1.
    const stale = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 1;
      while (currentTier < TOTAL_TIERS) { const id = availableNodeIds()[0]; if (!id) break; enterNode(id); currentTier++; }
      const id = availableNodeIds()[0]; enterNode(id);
      fallBackToNode();                      // a retreat, which pins the map to this node
      const pinned = retreatNode;
      runStats.regroups = 2;
      regroupSquad();
      return { pinned, after: retreatNode, tier: currentTier,
               open: availableNodeIds().map(x => nodeById(x).tier) };
    });
    ok('a retreat pins the map to its node', !!stale.pinned);
    ok('but a wipe clears that pin', stale.after === null);
    ok(`so the fallback is not handed a node from the tier it just left (offers tier ${[...new Set(stale.open)].join()})`,
      stale.open.every(t => t === stale.tier));

    // ---- the last regroup, then the run really ends ----
    await wipe(); await page.waitForTimeout(200);
    await page.locator('[data-action="squad-down"]:visible').first().click();
    await page.waitForTimeout(300);
    await page.locator('[data-action="regroup"]:visible').first().click();
    await page.waitForTimeout(400);
    ok('the second regroup is spent', await page.evaluate(() => runStats.regroups) === 0);

    await wipe(); await page.waitForTimeout(200);
    await page.locator('[data-action="squad-down"]:visible').first().click();
    await page.waitForTimeout(500);
    const ended = await page.evaluate(() => ({
      title: document.getElementById('runover-title').innerText,
      offersRegroup: !!document.querySelector('[data-action="regroup"]'),
      slotGone: localStorage.getItem(BASE_SAVE_KEY + 1) === null,
      skulls: bossSkulls, best: bestScore
    }));
    ok('with no regroups left the run ends', /RUN OVER/.test(ended.title) && !ended.offersRegroup);
    ok('only then is the slot cleared', ended.slotGone);
    ok('skulls and the banked score survive', ended.skulls === 5 && ended.best > 0);

    // ---- ending early is a deliberate choice ----
    const early = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 2; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; noteDepth(); saveGameState();
      initiateCombat('RAIDERS', false);
      playerRoster.forEach(c => c.hp = 0); checkWinState();
      handleSquadWipe();
      const hadChoice = !!document.querySelector('[data-action="regroup"]');
      endRun();
      return { hadChoice, slotGone: localStorage.getItem(BASE_SAVE_KEY + 2) === null,
               title: document.getElementById('runover-title').innerText };
    });
    ok('the player can still choose to bank and stop', early.hadChoice && early.slotGone && /RUN OVER/.test(early.title));

    // ---- an in-flight save from before this change gets regroups ----
    const legacy = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 3; loadMeta(); confirmNewGame(1.0); sectorFront = null; saveGameState();
      const raw = JSON.parse(localStorage.getItem(BASE_SAVE_KEY + 3));
      delete raw.runStats.regroups;
      localStorage.setItem(BASE_SAVE_KEY + 3, JSON.stringify(raw));
      loadGameState();
      return runStats.regroups;
    });
    ok('a run saved before regroups existed is topped up', legacy === 2);

    // ---- felling a commander refunds a fallback ----
    // Measured before this, squads entered every new sector with their regroups already spent
    // and died holding nothing.
    const refund = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      runStats.regroups = 0;
      currentSector = 1; currentTier = TOTAL_TIERS;
      playerRoster.forEach(c => { if (c.gridPos > 0) { c.maxHp = 9999; c.hp = 9999; } });
      initiateCombat('BOSS', false);
      activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
      checkWinState();
      const afterBoss = runStats.regroups;
      // and never past the allowance
      runStats.regroups = totalRegroups();
      pendingRelicOffer = null;
      initiateCombat('BOSS', false);
      activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
      checkWinState();
      return { afterBoss, capped: runStats.regroups === totalRegroups() };
    });
    ok('felling a commander refunds a fallback', refund.afterBoss === 1);
    ok('but never past the allowance', refund.capped);
    await page.evaluate(() => { combatActive = false; pendingRelicOffer = null; });

    // ---- the Citadel can buy another ----
    const citadel = await page.evaluate(() => {
      bossSkulls = 4; metaUpgrades.extraRegroups = 0; saveMeta();
      renderCitadel();
      const before = totalRegroups();
      buyMetaUpgrade('REGROUP');
      // The ledger is generated from CITADEL_SPOTS now, so the state is read off the card
      // rather than off an id that used to be written into the markup by hand.
      const sp = CITADEL_SPOTS.find(o => o.kind === 'REGROUP');
      return { before, after: totalRegroups(), skulls: bossSkulls, label: spotState(sp) };
    });
    ok('Fallback Protocol adds a regroup for 4 skulls',
      citadel.before === 2 && citadel.after === 3 && citadel.skulls === 0 && /LVL 1/.test(citadel.label));
  }
};

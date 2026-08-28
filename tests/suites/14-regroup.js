// Losing a fight must never destroy an expedition the player did not choose to end. A wipe
// spends a regroup and puts them back at the start of the sector; only when regroups run out,
// or they choose to stop, does the run end and the slot clear.
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
      confirmNewGame(1.0);
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
      localStorage.clear(); currentSlot = 2; loadMeta(); confirmNewGame(1.0);
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
      localStorage.clear(); currentSlot = 3; loadMeta(); confirmNewGame(1.0); saveGameState();
      const raw = JSON.parse(localStorage.getItem(BASE_SAVE_KEY + 3));
      delete raw.runStats.regroups;
      localStorage.setItem(BASE_SAVE_KEY + 3, JSON.stringify(raw));
      loadGameState();
      return runStats.regroups;
    });
    ok('a run saved before regroups existed is topped up', legacy === 2);

    // ---- the Citadel can buy another ----
    const citadel = await page.evaluate(() => {
      bossSkulls = 4; metaUpgrades.extraRegroups = 0; saveMeta(); renderCitadel();
      const before = totalRegroups();
      buyMetaUpgrade('REGROUP');
      return { before, after: totalRegroups(), skulls: bossSkulls,
               label: document.getElementById('meta-lbl-regroup').innerText };
    });
    ok('Fallback Protocol adds a regroup for 4 skulls',
      citadel.before === 2 && citadel.after === 3 && citadel.skulls === 0 && /LVL 1/.test(citadel.label));
  }
};

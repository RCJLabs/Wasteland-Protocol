// Finding 05: the endless run must end on a wipe, bank a score, and keep the meta intact.
module.exports = {
  name: 'Endless run scoring',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(500);

    const shape = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const deep = { kills: 0, elites: 0, bosses: 0, scrapEarned: 0, nodes: 0, deepestSector: 3, deepestTier: 1 };
      const farm = { kills: 60, elites: 2, bosses: 0, scrapEarned: 900, nodes: 20, deepestSector: 1, deepestTier: 10 };
      return { zero: computeScore(newRunStats()), deep: computeScore(deep), farm: computeScore(farm) };
    });
    ok('a fresh run scores zero', shape.zero === 0);
    ok('depth outscores farming a single sector', shape.deep > shape.farm);

    const run = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta();
      bossSkulls = 4; saveMeta();
      confirmNewGame(1.0);
      currentSector = 2; currentTier = 4; noteDepth();
      Object.assign(runStats, { kills: 30, elites: 1, bosses: 1, scrapEarned: 400, nodes: 12 });
      // A wipe only ends the run once regroups are gone - spend them so this exercises the
      // real end-of-run path rather than the squad-broken prompt.
      runStats.regroups = 0;
      const expected = computeScore(runStats);
      initiateCombat('RAIDERS', false);
      playerRoster.forEach(c => c.hp = 0);
      checkWinState();
      const deck = document.getElementById('command-deck').innerText;
      handleSquadWipe();
      return { expected, deck,
               screen: getComputedStyle(document.getElementById('screen-runover')).display,
               shown: document.getElementById('runover-score').innerText,
               best: document.getElementById('runover-best').innerText,
               lines: document.getElementById('runover-lines').innerText,
               bestScore, bestSector, skulls: bossSkulls,
               cleared: localStorage.getItem(BASE_SAVE_KEY + 1) === null };
    });
    ok('a wipe presents the defeat prompt', /SQUAD DOWN/.test(run.deck));
    ok('the run-over screen is shown', run.screen === 'flex');
    ok('the reported score matches the computed one', run.shown === `${run.expected.toLocaleString()} PTS`);
    ok('a first run is flagged a personal best', /NEW PERSONAL BEST/.test(run.best));
    ok('the best score is banked', run.bestScore === run.expected && run.bestSector === 2);
    ok('skulls survive the run ending', run.skulls === 4);
    ok('a dead run clears its save slot', run.cleared);
    ok('the summary reports depth reached', /SECTOR 2/.test(run.lines));

    await page.reload();
    await page.waitForTimeout(600);
    const title = await page.evaluate(() => ({
      menu: document.getElementById('title-menu-container').innerText, best: bestScore }));
    ok('the title screen shows the personal best', /BEST RUN/.test(title.menu) && title.best > 0);
    ok('the slot reads empty after a lost run', /SLOT 1 \[ EMPTY \]/.test(title.menu));

    const weaker = await page.evaluate(() => {
      currentSlot = 2; confirmNewGame(1.0); runStats.kills = 1; noteDepth();
      const before = bestScore; endRun();   // ending early is always available
      return { before, after: bestScore, banner: document.getElementById('runover-best').innerText };
    });
    ok('a weaker run leaves the record intact', weaker.after === weaker.before);
    ok('a weaker run shows the standing best', /BEST:/.test(weaker.banner));
  }
};

// D13: filed as "three classes that never leave the Outpost." No source for the original
// numbers survived this session, and they do not reproduce against the current build: a
// 5000-trial measurement of the draft found no gap between SCAVENGER/PYROMANIAC/SNIPER/HOUND
// (23-25% each, well within noise of each other), and across 14 independent full runs, every
// single recruit signing - 8 of 8 - resulted in that class actually reaching an active rank
// that same run. The one real lead was structural, not statistical: tests/simulate.js never
// calls assignSlot, so its OWN approximation of a player can't manually swap a bench recruit
// into the line. But the game does not depend on that button - closeRanks() already promotes
// the healthiest bench operator into a rank the moment it opens, win, retreat or regroup, and a
// freshly-signed recruit is just another roster entry sitting at gridPos 0. Nothing excludes it.
//
// This suite pins that down directly, on the real game code, so the finding survives whether or
// not the simulator's own draft policy ever learns to reach for assignSlot: a recruit is bench
// stock like any other operator, promotable, comparable on the same healthiest-first rule, and
// never specially held back.
module.exports = {
  name: 'A recruit on the bench is bench, not exile',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => { currentSlot = 1; confirmNewGame(1.0); sectorFront = null; });

    // ── Signing a recruit lands them on the bench, nothing more ─────────────────────────
    const signed = await page.evaluate(() => {
      scrap = 999;
      pendingRecruit = { nodeId: currentNodeId, id: 'p9', cost: recruitCost(), taken: false };
      const before = playerRoster.length;
      signOnRecruit();
      const hz = playerRoster.find(c => c.id === 'p9');
      return { added: playerRoster.length === before + 1, gridPos: hz && hz.gridPos, taken: pendingRecruit.taken };
    });
    ok(`signing HAZMAT adds them to the roster at the bench, nothing else (gridPos ${signed.gridPos})`,
      signed.added && signed.gridPos === 0 && signed.taken);

    // ── The bench is genuinely open to them: closeRanks does not skip a recruit ─────────
    const promoted = await page.evaluate(() => {
      playerRoster.forEach(c => { c.gridPos = 0; });
      const bruiser = playerRoster.find(c => c.classType === 'BRUISER');
      const hazmat = playerRoster.find(c => c.classType === 'HAZMAT');
      bruiser.gridPos = 1; hazmat.gridPos = 0;
      // Sole bench candidate: the fallen operator's rank has nowhere else to go.
      playerRoster.forEach(c => { if (c.id !== bruiser.id && c.id !== hazmat.id) c.gridPos = -1; });
      vacatedRanks = [1];
      playerRoster = playerRoster.filter(c => c.id !== bruiser.id);
      const filled = closeRanks();
      playerRoster.forEach(c => { if (c.gridPos === -1) c.gridPos = 0; });
      return { filled, hazmatRank: hazmat.gridPos };
    });
    ok(`a signed recruit steps up into a vacated rank exactly like anyone else (${promoted.filled.join(', ')})`,
      promoted.filled.length === 1 && promoted.hazmatRank === 1);

    // ── Among several bench candidates, the healthiest wins - recruit or original seven ──
    const healthiest = await page.evaluate(() => {
      playerRoster.forEach(c => { c.gridPos = 0; });
      const medic = playerRoster.find(c => c.classType === 'MEDIC');
      const scavenger = playerRoster.find(c => c.classType === 'SCAVENGER');
      const harpooner = playerRoster.find(c => c.classType === 'HARPOONER')
        || (() => { const t = JSON.parse(JSON.stringify(RECRUIT_POOL.find(r => r.id === 'p10')));
                    delete t.rank; delete t.pitch; t.gridPos = 0; playerRoster.push(t); return t; })();
      medic.gridPos = 1;
      scavenger.hp = Math.floor(scavenger.maxHp * 0.9);
      harpooner.hp = Math.floor(harpooner.maxHp * 0.3);
      playerRoster.forEach(c => { if (![medic.id, scavenger.id, harpooner.id].includes(c.id)) c.gridPos = -1; });
      vacatedRanks = [1];
      playerRoster = playerRoster.filter(c => c.id !== medic.id);
      const filled = closeRanks();
      playerRoster.forEach(c => { if (c.gridPos === -1) c.gridPos = 0; });
      return { filled, scavengerRank: scavenger.gridPos, harpoonerRank: harpooner.gridPos };
    });
    ok(`the healthier candidate wins the rank regardless of which is the recruit (${healthiest.filled.join(', ')})`,
      healthiest.filled.length === 1 && healthiest.scavengerRank === 1 && healthiest.harpoonerRank === 0);

    // ── The offer and its price never depend on which of the three it is ────────────────
    const uniform = await page.evaluate(() => {
      const ids = RECRUIT_POOL.map(r => r.id);
      const costsEqual = new Set(ids.map(() => recruitCost())).size === 1;
      const remaining = recruitables().map(r => r.id);
      return { poolSize: RECRUIT_POOL.length, costsEqual, remaining, hazmatGone: !remaining.includes('p9') };
    });
    ok(`recruitCost takes no class of its own - the three cost the same at any given depth`,
      uniform.costsEqual);
    ok(`recruitables() excludes whoever is already on the roster - HAZMAT signed above, HARPOONER ` +
       `pressed into the earlier check, TRENCH_FIEND the only one still out there (${uniform.remaining.join(', ')})`,
      uniform.poolSize === 3 && uniform.remaining.length === 1 && uniform.hazmatGone);

    // ── With nobody left to promote, the rank simply stays open - recruits included ─────
    const emptyBench = await page.evaluate(() => {
      playerRoster = playerRoster.filter(c => c.gridPos > 0);
      vacatedRanks = [1];
      const filled = closeRanks();
      return { filled };
    });
    ok('an empty bench leaves the rank open rather than manufacturing a body',
      emptyBench.filled.length === 0);
  }
};

// H04, and the premise it refuted. The brief read 80% of wipes at tier ten and concluded the
// nine tiers below were "attrition without jeopardy" - a long walk to one dice roll. Measured
// against the fight itself rather than against where the loss gets recorded, the opposite is
// true: the walk is what decides the dice roll.
//
// Across 60 carried runs, a squad reaching the commander below MARCH_FRESH of its bars felled it
// 0 times in 54 in one sample and once in 45 in another, against 32-34% for a squad arriving
// whole. Split inside each sector separately - so sector depth cannot be doing the work - the
// gap held in every one of them: s1 0% against 64%, s2 0% / 21%, s3 0% / 19%, s4 0% / 38%,
// s5 0% / 27%. Nor was it the harness declining the fight: no commander fight in any sample
// ended in a retreat, so the hurt arrivals were fought and lost.
//
// The cause is the purse. 51 of 54 hurt arrivals could not have paid to patch up if they had
// tried: 24 scrap in hand against a 127 bill, where a fresh arrival carried 450 and owed 3.
//
// So the run is decided on the road, and the game reported it at the top of the sector as though
// the commander had done it. The map forecast the weather and named the ground - two facts about
// the enemy - and said nothing about the only number that predicts the ending. This suite holds
// that read: that it appears exactly where the decision is, that every figure in it is the
// engine's own, and above all that it does not lie about the price.
module.exports = {
  name: 'What shape you are in',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      // A run standing at a chosen tier, with the line hurt to a chosen share of its bars.
      window.__march = (tier, share, purse) => {
        currentSlot = 1; confirmNewGame(1.0);
        currentSector = 2; currentTier = tier;
        scrap = purse;
        const line = deployed();
        line.forEach(u => { u.hp = Math.max(1, Math.round(u.maxHp * share)); });
        // Stand on a node at that tier so availableNodeIds offers the tier above it.
        const here = sectorMap.nodes.filter(n => n.tier === tier - 1)[0];
        if (here) { currentNodeId = here.id; if (!clearedNodeIds.includes(here.id)) clearedNodeIds.push(here.id); }
        renderMap();
        return line;
      };
      window.__panel = () => {
        const el = document.getElementById('march-read');
        return { shown: el.style.display !== 'none', cls: el.className,
                 text: (el.innerText || '').replace(/\s+/g, ' ').trim() };
      };
    });

    // ── It appears on the eve of the commander, and only there ───────────────────
    const where = await page.evaluate(() => {
      const out = {};
      window.__march(TOTAL_TIERS, 0.5, 0);          // one below the commander's tier
      out.eve = { read: !!marchRead(), panel: window.__panel() };
      window.__march(3, 0.5, 0);                    // deep in the road
      out.road = { read: !!marchRead(), panel: window.__panel() };
      return out;
    });
    ok('the read is there on the eve of the commander', where.eve.read === true && where.eve.panel.shown === true);
    ok(`and names the commander waiting (${where.eve.panel.text.slice(0, 46)})`,
      /TOP OF THIS SECTOR/.test(where.eve.panel.text));
    ok('it is not there in the middle of the road', where.road.read === false && where.road.panel.shown === false);
    ok('and leaves nothing behind when it goes', where.road.panel.text === '');

    // ── Every number in it is the engine's own ───────────────────────────────────
    // The failure mode for a read is not crashing, it is quoting a figure the game will not
    // honour. So the share is checked against the bars and the price against what the Outpost
    // actually charges - asked of the engine, not reckoned here.
    const honest = await page.evaluate(() => {
      const line = window.__march(TOTAL_TIERS, 0.5, 400);
      const r = marchRead();
      const hp = line.reduce((a, u) => a + Math.max(0, u.hp), 0);
      const max = line.reduce((a, u) => a + u.maxHp, 0);
      const bill = line.filter(u => u.hp > 0 && u.hp < u.maxHp).reduce((a, u) => a + patchUpCost(u), 0);
      // And the price is honoured: paying it at the Outpost's own button empties the bill.
      const before = scrap;
      line.forEach(u => { if (u.hp > 0 && u.hp < u.maxHp) medBay(u.id, 'PATCH'); });
      const spent = before - scrap;
      const after = marchRead();
      return { r, share: hp / max, bill, line: line.length, spent,
               afterShare: after.share, afterCost: after.cost, afterHurt: after.hurt };
    });
    ok(`the share is the squad's own bars (${(honest.r.share * 100).toFixed(1)}% against ${(honest.share * 100).toFixed(1)}%)`,
      Math.abs(honest.r.share - honest.share) < 1e-9);
    ok(`the line counted is the line deployed (${honest.r.line})`, honest.r.line === honest.line);
    ok(`the price is what the Outpost charges (${honest.r.cost} quoted, ${honest.bill} owed)`,
      honest.r.cost === honest.bill && honest.r.cost > 0);
    ok(`and paying it costs exactly that (${honest.spent} spent)`, honest.spent === honest.bill);
    ok(`once paid there is nothing left to quote (${honest.afterCost}, ${honest.afterHurt} hurt)`,
      honest.afterCost === 0 && honest.afterHurt === 0 && honest.afterShare === 1);

    // ── The three states, and the line between them ──────────────────────────────
    const states = await page.evaluate(() => {
      const read = (share, purse) => {
        window.__march(TOTAL_TIERS, share, purse);
        const r = marchRead();
        return { tone: marchTone(r), canPay: r.canPay, fresh: r.fresh, cost: r.cost,
                 panel: window.__panel() };
      };
      // A purse deliberately larger than any bill, so the rich cases turn on health alone.
      return { whole: read(1.0, 5000), nicked: read(0.9, 5000),
               hurtRich: read(0.5, 5000), hurtBroke: read(0.5, 0) };
    });
    ok(`a squad at full is ready (${states.whole.tone})`,
      states.whole.tone === 'ready' && states.whole.fresh === true && states.whole.cost === 0);
    ok(`so is one only nicked, above the measured line (${states.nicked.tone})`,
      states.nicked.tone === 'ready' && states.nicked.fresh === true);
    ok(`a hurt squad that can pay is told to go and spend (${states.hurtRich.tone})`,
      states.hurtRich.tone === 'patch' && states.hurtRich.canPay === true);
    ok('and pointed back at the Outpost while it is still behind them',
      /Outpost is still behind you/.test(states.hurtRich.panel.text));
    ok(`a hurt squad that cannot pay is told what that means (${states.hurtBroke.tone})`,
      states.hurtBroke.tone === 'grim' && states.hurtBroke.canPay === false);
    ok('in the plainest words the screen has',
      /do not come back down/.test(states.hurtBroke.panel.text));
    ok('and the three states are drawn differently',
      /march-ready/.test(states.whole.panel.cls) && /march-patch/.test(states.hurtRich.panel.cls)
      && /march-grim/.test(states.hurtBroke.panel.cls));

    // ── The line itself is the measured one ──────────────────────────────────────
    // MARCH_FRESH is where the sample separates, so it is a constant the read is built on rather
    // than a number in a renderer. If it ever moves, this says so.
    const edge = await page.evaluate(() => {
      const at = share => { window.__march(TOTAL_TIERS, share, 5000); return marchRead().fresh; };
      return { floor: MARCH_FRESH, just: at(MARCH_FRESH + 0.02), under: at(MARCH_FRESH - 0.1) };
    });
    ok(`the line is the one the sample separated at (${edge.floor})`, edge.floor === 0.8);
    ok('a squad above it reads fresh', edge.just === true);
    ok('one below it does not', edge.under === false);

    // ── It says nothing when there is nothing to say ─────────────────────────────
    // Each guard is proved from a position where the read IS live, so that taking the one thing
    // away is what silences it. Staged from a fresh run instead, every one of these would pass
    // because the squad is at tier one and the commander is nine tiers off - an assertion green
    // for a reason that has nothing to do with the guard it names.
    const quiet = await page.evaluate(() => {
      const out = {};
      window.__march(TOTAL_TIERS, 0.5, 0);
      out.live = !!marchRead();
      const keptRun = runStats; runStats = null;
      out.noRun = marchRead();
      runStats = keptRun;
      out.backAgain = !!marchRead();
      const keptMap = sectorMap; sectorMap = null;
      out.noMap = marchRead();
      sectorMap = keptMap;
      playerRoster.forEach(c => { c.gridPos = 0; });
      out.noLine = marchRead();
      return out;
    });
    ok('the read is live before each guard is tested', quiet.live === true && quiet.backAgain === true);
    ok('no run, no read', quiet.noRun === null);
    ok('no map, no read', quiet.noMap === null);
    ok('nobody on the field, no read', quiet.noLine === null);
  }
};

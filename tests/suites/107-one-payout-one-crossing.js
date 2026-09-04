// Two engine rules the harness kept private copies of, both because the real one was welded to a
// screen. What a held field pays was computed inline in checkWinState on the way to writing a
// LOOT button, so the only way to find out what a fight was worth was to press that button - and
// the headless simulator, which cannot, carried its own formula: a flat 20 base where the engine
// rolls 0-29, and nothing at all about the front's ledger, the Vulture's cut, the Scrap Magnet
// or the Collector's debt. Worse, bypassing collectLoot meant RATIONING's cut and closeRanks had
// never once run on a won fight in simulation: a career under RATIONING measured being paid in
// full, and a squad that lost somebody fought on short-handed with a bench standing behind it.
//
// The crossing was the same shape. advanceSector ends in resolveConsequence, which switches to
// the event screen and falls through to afterNode when nothing is due, so a headless caller that
// wanted the crossing could not have it without also driving the node flow. It kept a hand copy,
// and a hand copy is a list of whatever somebody remembered.
//
// fightPayout, bankNode and crossSector are those rules with the screens lifted off them.
module.exports = {
  name: 'One payout, one crossing',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    const fresh = () => page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      ascension = 0; activeRelics = []; currentNodeType = 'RAIDERS'; isCurrentNodeElite = false;
    });

    // ---- the payout, at its exact edges ----
    // rand(0..29) is uniform over integers, so 4000 rolls reach both ends. Comparing the observed
    // extremes against the closed form pins every multiplier without averaging anything away.
    const edges = await page.evaluate(() => {
      const sample = (setUp, n = 4000) => {
        activeRelics = []; sectorFront = null; currentNodeType = 'RAIDERS'; isCurrentNodeElite = false;
        currentSector = 2; currentTier = 5;
        setUp();
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < n; i++) { const s = fightPayout(); if (s < lo) lo = s; if (s > hi) hi = s; }
        return { lo, hi, srm: sectorRewardMult(), tier: currentTier };
      };
      const give = id => activeRelics.push(RELIC_POOL.find(r => r.id === id));
      return {
        plain: sample(() => {}),
        elite: sample(() => { isCurrentNodeElite = true; }),
        warband: sample(() => { sectorFront = 'RAIDER_WARBAND'; currentNodeType = 'RAIDERS'; }),
        warbandOther: sample(() => { sectorFront = 'RAIDER_WARBAND'; currentNodeType = 'MECH'; }),
        quietBoss: sample(() => { sectorFront = 'QUIET_ROADS'; currentNodeType = 'BOSS'; }),
        quietOther: sample(() => { sectorFront = 'QUIET_ROADS'; currentNodeType = 'RAIDERS'; }),
        vulture: sample(() => give('VULTURE_ROYALTY')),
        magnet: sample(() => give('SCRAP_MAGNET')),
        quarter: sample(() => { give('SCRAP_MAGNET'); give('SALVAGE_RIG'); }),
        debt: sample(() => give('SCAVENGERS_DEBT')),
        pay: { plain: 15, quarter: 30 }
      };
    });
    // The elite multiplier is applied inside the floor and the front's doubling outside it, so
    // the two are not interchangeable and the closed forms are written separately rather than
    // through one helper that would quietly agree with either.
    const srm = edges.plain.srm, T = edges.plain.tier * 20;
    const flat = v => Math.floor(v * srm);
    const is = (r, lo, hi) => r.lo === lo && r.hi === hi;
    ok(`a plain node pays the tier's twenty a step plus a roll of thirty (${edges.plain.lo}-${edges.plain.hi})`,
      is(edges.plain, flat(T), flat(T + 29)));
    ok(`an elite node pays double, doubled inside the floor (${edges.elite.lo}-${edges.elite.hi})`,
      is(edges.elite, Math.floor(T * 2 * srm), Math.floor((T + 29) * 2 * srm)));
    ok(`a warband's raiders carry double, doubled after it (${edges.warband.lo}-${edges.warband.hi})`,
      is(edges.warband, flat(T) * 2, flat(T + 29) * 2));
    ok('but only the raiders — the same front pays a machine nothing extra',
      is(edges.warbandOther, flat(T), flat(T + 29)));
    ok(`a quiet sector's warlord hoards double (${edges.quietBoss.lo}-${edges.quietBoss.hi})`,
      is(edges.quietBoss, flat(T) * 2, flat(T + 29) * 2));
    ok('but only the warlord — quiet roads pay a raider the ordinary rate',
      is(edges.quietOther, flat(T), flat(T + 29)));
    // Which is not a distinction without a difference: at this tier and sector the two roads to
    // "double" land a scrap apart, and a helper that smoothed it would pass either way.
    ok(`and the two doublings are genuinely different arithmetic (${edges.elite.hi} vs ${edges.warband.hi})`,
      edges.elite.hi !== edges.warband.hi);
    ok(`the Vulture takes a quarter (${edges.vulture.lo}-${edges.vulture.hi})`,
      is(edges.vulture, Math.floor(flat(T) * 0.75), Math.floor(flat(T + 29) * 0.75)));
    ok(`the Scrap Magnet pays its stipend on top (${edges.magnet.lo}-${edges.magnet.hi})`,
      is(edges.magnet, flat(T) + edges.pay.plain, flat(T + 29) + edges.pay.plain));
    ok('and pays the Quartermaster rate when its pair is up',
      is(edges.quarter, flat(T) + edges.pay.quarter, flat(T + 29) + edges.pay.quarter));
    ok(`the Collector's debt adds its forty (${edges.debt.lo}-${edges.debt.hi})`,
      is(edges.debt, flat(T) + 40, flat(T + 29) + 40));

    // ---- and the button offers exactly that, so the extraction did not leave a second formula ----
    const button = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5; activeRelics = []; ascension = 0;
      initiateCombat('RAIDERS', false);
      currentNodeType = 'RAIDERS'; isCurrentNodeElite = false;
      activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
      checkWinState();
      const btn = document.querySelector('[data-action="loot"]');
      const amount = btn ? Number(btn.dataset.amount) : null;
      const srm = sectorRewardMult();
      combatActive = false;
      return { amount, lo: Math.floor(5 * 20 * srm), hi: Math.floor((5 * 20 + 29) * srm) };
    });
    ok(`the LOOT button offers what fightPayout computes (${button.amount} in ${button.lo}-${button.hi})`,
      button.amount !== null && button.amount >= button.lo && button.amount <= button.hi);

    // ---- banking a node: the state change, with no screen in it ----
    const banked = await fresh().then(() => page.evaluate(() => {
      scrap = 0; currentTier = 3; runStats.nodes = 0; runStats.scrapEarned = 0;
      initiateCombat('RAIDERS', false);
      switchScreen('screen-combat');
      const before = { tier: currentTier, screen: [...document.querySelectorAll('[id^=screen-]')]
        .find(s => getComputedStyle(s).display !== 'none').id };
      const got = bankNode(100);
      return { got, scrap, tier: currentTier, nodes: runStats.nodes, earned: runStats.scrapEarned,
               field: activeEntities.length + turnQueue.length, pending: pendingCombat,
               saved: !!Store.getJSON(BASE_SAVE_KEY + 1),
               beforeTier: before.tier, before: before.screen,
               after: [...document.querySelectorAll('[id^=screen-]')]
                 .find(s => getComputedStyle(s).display !== 'none').id };
    }));
    ok(`the pay lands and is reported (${banked.got})`,
      banked.got === 100 && banked.scrap === 100 && banked.earned === 100);
    ok('the node counts as one cleared', banked.nodes === 1);
    ok(`the tier ticks over (${banked.beforeTier} → ${banked.tier})`, banked.tier === banked.beforeTier + 1);
    ok('the field is cleared and the save written', banked.field === 0 && !banked.pending && banked.saved);
    ok(`and nothing is painted — the screen is where it was (${banked.after})`, banked.after === banked.before);

    // ---- RATIONING's cut, which had never run on a won fight in simulation ----
    const cut = await fresh().then(() => page.evaluate(() => {
      careerWins = 1; ascension = 0;
      const rationing = PROTOCOLS.findIndex(p => p.id === 'RATIONING');
      scrap = 0; const full = bankNode(200);
      ascension = rationing + 1;
      const rationed = (() => { scrap = 0; return bankNode(200); })();
      const on = hasProtocol('RATIONING');
      ascension = 0;
      return { full, rationed, on, share: PROTOCOL_CUT, direct: nodeSalvage(200) };
    }));
    ok('RATIONING is on the ladder and reachable from here', cut.on);
    ok(`it takes its cut on the way in (${cut.full} → ${cut.rationed})`,
      cut.full === 200 && cut.rationed === Math.floor(200 * cut.share) && cut.rationed < cut.full);

    // ---- closing a rank, which had never run on a won fight either ----
    const ranks = await fresh().then(() => page.evaluate(() => {
      activeDoctrine = null; doctrineBroken = false;
      const line = playerRoster.filter(c => c.gridPos > 0);
      const bench = playerRoster.filter(c => c.gridPos === 0);
      const gone = line[line.length - 1];
      const pos = gone.gridPos;
      const benchBefore = bench.length;
      // Lose them the way the fight does, then clear the node.
      initiateCombat('RAIDERS', false);
      loseOperator(gone, 'BLED_OUT');
      const owedBefore = vacatedRanks.length;
      bankNode(10);
      const filled = playerRoster.find(c => c.gridPos === pos);
      return { owedBefore, pos, filled: !!filled, name: filled ? filled.name : null,
               owedAfter: vacatedRanks.length,
               benchBefore, benchAfter: playerRoster.filter(c => c.gridPos === 0).length };
    }));
    ok(`a lost operator leaves a rank owed (rank ${ranks.pos})`, ranks.owedBefore === 1);
    ok(`and clearing the node closes it from the bench (${ranks.name})`,
      ranks.filled && ranks.owedAfter === 0 && ranks.benchAfter === ranks.benchBefore - 1);

    // ---- a node run from is not a node cleared ----
    const ran = await fresh().then(() => page.evaluate(() => {
      runStats.nodes = 0; runStats.withdrawals = 0; scrap = 0;
      bankNode(0, true);
      return { nodes: runStats.nodes, withdrawals: runStats.withdrawals };
    }));
    ok('an abandoned node counts as a withdrawal, not a clearance',
      ran.nodes === 0 && ran.withdrawals === 1);

    // ---- collectLoot is bankNode plus the screen chain ----
    const chain = await fresh().then(() => page.evaluate(() => {
      pendingRelicOffer = [RELIC_POOL[0]]; pendingPerkOffers = []; pendingConsequences = [];
      switchScreen('screen-combat');
      collectLoot(50);
      const shown = [...document.querySelectorAll('[id^=screen-]')]
        .find(s => getComputedStyle(s).display !== 'none').id;
      pendingRelicOffer = null;
      return { shown, scrap };
    }));
    ok(`collectLoot banks and then walks the chain (${chain.shown})`,
      chain.shown === 'screen-relic' && chain.scrap > 0);

    // ---- the crossing, with no screen in it ----
    const cross = await fresh().then(() => page.evaluate(() => {
      currentSector = 1; currentTier = 4; pursuit = { units: [] }; retreatNode = 'n1';
      forecastWeather = 'ASHFALL'; forecastTerrain = 'OPEN_ROAD'; forecastFormation = 'x';
      clearedNodeIds = ['a', 'b']; currentNodeId = 'b';
      // A crossed sector has no twin on the board - it settles the STANDING contract, which is
      // exactly the one E01 found unsettleable in every simulated career.
      standingBounty = { type: 'S_SECTOR', desc: 'PUSH THROUGH 3 SECTORS', current: 0, target: 3, reward: 420 };
      Store.remove(BASE_SAVE_KEY + 1);
      switchScreen('screen-combat');
      const mapBefore = sectorMap;
      // The head start Road Crew buys, driven from both sides. Comparing the tier against
      // openingTier() would agree with a hardcoded 1, since a career without Road Crew opens
      // at 1 anyway - so the two careers are crossed separately and read against 1 and 2.
      metaUpgrades.roadCrew = false;
      crossSector();
      const plainOpen = currentTier;
      currentSector = 1; currentTier = 4;
      metaUpgrades.roadCrew = true;
      crossSector();
      const crewOpen = currentTier;
      // Three crossings would settle a three-sector contract and hand back a fresh one reading
      // zero, so the observed crossing gets its own clean fixture.
      metaUpgrades.roadCrew = false;
      currentSector = 1; currentTier = 4; pursuit = { units: [] }; retreatNode = 'n1';
      forecastWeather = 'ASHFALL'; forecastTerrain = 'OPEN_ROAD'; forecastFormation = 'x';
      clearedNodeIds = ['a', 'b']; currentNodeId = 'b';
      standingBounty = { type: 'S_SECTOR', desc: 'PUSH THROUGH 3 SECTORS', current: 0, target: 3, reward: 420 };
      Store.remove(BASE_SAVE_KEY + 1);
      crossSector();
      return { sector: currentSector, tier: currentTier, plainOpen, crewOpen,
               pursuit, retreatNode, front: sectorFront,
               forecast: [forecastWeather, forecastTerrain, forecastFormation],
               cleared: clearedNodeIds.length, node: currentNodeId,
               newMap: sectorMap !== mapBefore && !!sectorMap,
               sectorBounty: standingBounty.current,
               saved: !!Store.getJSON(BASE_SAVE_KEY + 1),
               shown: [...document.querySelectorAll('[id^=screen-]')]
                 .find(s => getComputedStyle(s).display !== 'none').id };
    }));
    ok(`the sector advances (${cross.sector})`, cross.sector === 2);
    ok(`and the tier opens where the career says, not at a fixed one (${cross.plainOpen} without Road Crew, ${cross.crewOpen} with)`,
      cross.plainOpen === 1 && cross.crewOpen === 2);
    ok('nothing follows across', cross.pursuit === null && cross.retreatNode === null);
    ok('a fresh front and a fresh route graph', !!cross.front && cross.newMap && cross.cleared === 0 && cross.node === null);
    ok('the forecast does not cross with you', cross.forecast.every(f => f === null));
    ok(`the standing sector contract ticks — the one place in the engine that ticks it (${cross.sectorBounty})`,
      cross.sectorBounty === 1);
    ok('and the crossing is written to the save', cross.saved);
    ok(`while nothing is painted (${cross.shown})`, cross.shown === 'screen-combat');

    // ---- advanceSector is the crossing plus the consequence chain ----
    const full = await fresh().then(() => page.evaluate(() => {
      const kind = Object.keys(CONSEQUENCE_POOL)[0];
      currentSector = 1;
      pendingConsequences = [{ kind, at: -1 }];
      switchScreen('screen-combat');
      const dueBefore = consequencesDue().length;
      crossSector();
      const afterCross = { due: consequencesDue().length,
        shown: [...document.querySelectorAll('[id^=screen-]')].find(s => getComputedStyle(s).display !== 'none').id };
      advanceSector();
      const afterAdvance = { due: consequencesDue().length,
        shown: [...document.querySelectorAll('[id^=screen-]')].find(s => getComputedStyle(s).display !== 'none').id };
      pendingConsequences = [];
      return { dueBefore, afterCross, afterAdvance };
    }));
    ok('a debt that has come due survives a bare crossing untouched',
      full.dueBefore === 1 && full.afterCross.due === 1 && full.afterCross.shown === 'screen-combat');
    ok(`and advanceSector is the one that collects it (${full.afterAdvance.shown})`,
      full.afterAdvance.due === 0 && full.afterAdvance.shown !== 'screen-combat');

    // ---- the harness no longer keeps a copy of either ----
    const harness = await page.evaluate(async () => {
      const src = await (await fetch('tests/simulate.js')).text();
      const code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
      const has = t => code.includes(t);
      return { ok: src.length > 1000,
               ownPayout: has('20 + currentTier * 20'),
               ownCrossing: has('currentSector++'),
               usesPayout: has('bankNode(fightPayout())'),
               usesCrossing: has('crossSector()') };
    });
    ok('the harness source is readable from here', harness.ok);
    ok('it no longer carries its own payout formula', !harness.ownPayout && harness.usesPayout);
    ok('nor its own crossing', !harness.ownCrossing && harness.usesCrossing);
  }
};

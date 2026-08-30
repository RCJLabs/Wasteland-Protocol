// Withdrawing leaves the node behind for good. Retreating buys another go at it: the squad
// pays in Scrap rather than blood, does not advance a tier, and walks back into a fight rolled
// fresh - and unlike withdrawing it can fail, which is the whole of the risk.
module.exports = {
  name: 'Retreating',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    const stage = (o = {}) => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; armedExit = null; retreatNode = null;
      currentSector = o.sector || 2; currentTier = o.tier || 6;
      sectorMap = generateSectorMap(seededRng('rt' + (o.seed || 1)));
      // A tier can have every one of its nodes swapped out for a camp, an event, the Armory
      // or a survivor, and this then read `.id` off undefined and aborted the whole suite.
      // Take the nearest tier that still has a fight standing on it.
      const fightAt = t => sectorMap.nodes.find(n => n.tier === t && FIGHT_NODES.includes(n.type));
      let node = null;
      for (let d = 0; d < TOTAL_TIERS && !node; d++) node = fightAt(currentTier - d) || fightAt(currentTier + d);
      if (!node) throw new Error('this map has no fight node on it at all');
      currentTier = node.tier;
      enterNode(node.id);
      currentNodeType = node.type;
      forecastWeather = 'CLEAR';
      initiateCombat(node.type, false);
      scrap = o.scrap === undefined ? 9000 : o.scrap;
      activeIndex = turnQueue.findIndex(e => e.isPlayer && e.hp > 0);
      combatActive = true; pendingAction = null;
      renderField(); renderCommandDeck();
      return node.id;
    };
    await page.evaluate(`window.__stage = ${stage.toString()}`);

    // ---- two ways out, and they are not the same way ----
    const offered = await page.evaluate(() => {
      __stage();
      const deck = document.getElementById('command-deck');
      const acts = [...deck.querySelectorAll('[data-action]')].map(b => b.dataset.action);
      const btn = deck.querySelector('[data-action="retreat"]');
      const out = { acts, priced: /\d/.test(btn.innerText), title: btn.title,
                    both: acts.includes('withdraw') && acts.includes('retreat'),
                    canR: canRetreat(), canW: canWithdraw() };
      combatActive = false; return out;
    });
    ok('the deck offers both ways out', offered.both && offered.canR && offered.canW);
    ok(`and the retreat button carries its price (${offered.title})`,
      offered.priced && /Scrap/i.test(offered.title));

    // ---- what it costs, and what it is worth ----
    const price = await page.evaluate(() => {
      __stage({ sector: 1, tier: 1 }); const shallow = retreatCost(); const d0 = depthIndex();
      __stage({ sector: 4, tier: 8 }); const deep = retreatCost(); const d1 = depthIndex();
      combatActive = false;
      return { shallow, deep, d0, d1, base: RETREAT.cost, per: RETREAT.perDepth };
    });
    ok(`the price climbs with the road behind you (${price.shallow} at the start, ${price.deep} deep)`,
      price.deep > price.shallow && price.shallow === price.base + price.per * price.d0
                                 && price.deep === price.base + price.per * price.d1);

    const odds = await page.evaluate(() => {
      __stage();
      const foes = activeEntities.filter(e => !e.isPlayer && e.hp > 0);
      const readings = [];
      for (let n = foes.length; n >= 1; n--) {
        foes.forEach((f, i) => { f.hp = i < n ? f.maxHp : 0; });
        readings.push({ foes: n, odds: Number(retreatOdds().toFixed(3)) });
      }
      // And a crowd cannot drive it below the floor.
      const crowd = activeEntities.filter(e => !e.isPlayer);
      const swarm = Array.from({ length: 20 }, () => ({ isPlayer: false, hp: 10 }));
      activeEntities = [...activeEntities.filter(e => e.isPlayer), ...swarm];
      const floored = retreatOdds();
      combatActive = false;
      return { readings, floored, floor: RETREAT.floor, base: RETREAT.base };
    });
    ok(`breaking from a crowd is harder than from one (${odds.readings.map(r => `${r.foes}:${Math.round(r.odds * 100)}%`).join(' ')})`,
      odds.readings.every((r, i) => i === 0 || r.odds > odds.readings[i - 1].odds));
    ok(`and a swarm cannot push it under the floor (${Math.round(odds.floored * 100)}%)`,
      odds.floored === odds.floor);

    // The number the panel prints has to be the number that is rolled against.
    const honest = await page.evaluate(() => {
      const real = Math.random;
      const run = (offset) => {
        // Staging has to happen under the real RNG: the second call used to run with the stub
        // from the first still installed, so the map it built - and the tier it staged on -
        // came out of a constant. The odds roll is the only thing that wants rigging.
        Math.random = real;
        __stage();
        const shown = retreatOdds();           // read off the fight that is about to be rolled
        const before = scrap, cost = retreatCost();
        Math.random = () => shown + offset;
        retreat(); retreat();
        const out = { broke: !combatActive, paid: before - scrap, shown, cost };
        combatActive = false;
        return out;
      };
      const under = run(-0.01);
      const over = run(0.01);
      Math.random = real;
      return { shown: Number(under.shown.toFixed(3)), under, over };
    });
    ok(`a roll under the stated odds breaks clean, one over does not (${Math.round(honest.shown * 100)}%)`,
      honest.under.broke && !honest.over.broke);
    // Each staging is checked against its own quoted price rather than against the other one's.
    // generateSectorMap here is fed seededRng, which falls back to Math.random when no daily
    // seed is set - so the two stagings can build different maps, land on different tiers and
    // quote different prices. Measured at 3 divergences in 120.
    ok(`and the Scrap goes either way (${honest.under.paid} of ${honest.under.cost}, ${honest.over.paid} of ${honest.over.cost})`,
      honest.under.paid > 0 && honest.under.paid === honest.under.cost
      && honest.over.paid > 0 && honest.over.paid === honest.over.cost);

    // ---- a clean break ----
    const clean = await page.evaluate(() => {
      const real = Math.random;
      const id = __stage();
      const cost = retreatCost(), before = scrap, tier = currentTier, sector = currentSector;
      Math.random = () => 0;
      retreat();
      const armed = armedExit;
      const stillFighting = combatActive;
      retreat();
      Math.random = real;
      return { id, armed, stillFighting, paid: before - scrap, cost,
               ended: !combatActive, tierHeld: currentTier === tier && currentSector === sector,
               uncleared: !clearedNodeIds.includes(id), backAt: retreatNode,
               offered: availableNodeIds(), tallied: runStats.retreats };
    });
    ok('the first press arms it rather than committing', clean.armed === 'RETREAT' && clean.stillFighting);
    ok(`it costs exactly what it quoted (${clean.paid} of ${clean.cost})`, clean.paid === clean.cost);
    ok('the fight ends and the run does not advance', clean.ended && clean.tierHeld);
    ok('the node is not counted as cleared', clean.uncleared);
    ok(`and the squad is put back in front of that node and no other (${clean.offered.join(', ')})`,
      clean.backAt === clean.id && clean.offered.length === 1 && clean.offered[0] === clean.id);
    ok('the run keeps a tally of what it paid to try again', clean.tallied === 1);

    const again = await page.evaluate(() => {
      const id = availableNodeIds()[0];
      enterNode(id); currentNodeType = nodeById(id).type;
      forecastWeather = 'CLEAR'; initiateCombat(currentNodeType, false);
      const out = { cleared: retreatNode === null, foes: activeEntities.filter(e => !e.isPlayer).length,
                    freeAgain: availableNodeIds().length };
      combatActive = false; return out;
    });
    ok(`walking back in rolls the fight fresh (${again.foes} hostiles)`, again.cleared && again.foes > 0);

    // ---- a break that does not come off ----
    const failed = await page.evaluate(() => {
      const real = Math.random;
      __stage();
      const cost = retreatCost(), before = scrap, tier = currentTier;
      const who = (turnQueue[activeIndex] || {}).id;
      Math.random = () => 0.999;
      retreat(); retreat();
      Math.random = real;
      const out = { paid: before - scrap, cost, stillFighting: combatActive,
                    tierHeld: currentTier === tier, moved: (turnQueue[activeIndex] || {}).id !== who,
                    tried: runStats.retreats, lost: runStats.retreatsFailed, disarmed: armedExit === null };
      combatActive = false; return out;
    });
    ok(`a failed break costs the Scrap anyway (${failed.paid})`, failed.paid === failed.cost);
    ok('and leaves the squad in the fight, where it was', failed.stillFighting && failed.tierHeld);
    ok('the turn is gone with it', failed.moved && failed.disarmed);
    ok('both the attempt and the failure are counted', failed.tried === 1 && failed.lost === 1);

    // ---- where it is refused ----
    const refused = await page.evaluate(() => {
      __stage({ sector: 3, tier: 5, scrap: 0 });
      const btn = document.querySelector('[data-action="retreat"]');
      const broke = { can: canRetreat(), shown: !!btn, off: btn ? btn.disabled : null, says: btn ? btn.innerText : '' };
      const before = scrap;
      retreat(); retreat();
      broke.tookNothing = scrap === before && combatActive;

      __stage(); currentNodeType = 'BOSS';
      const boss = { retreat: canRetreat(), withdraw: canWithdraw() };
      __stage(); pendingAction = 'PISTOL';
      const aiming = canRetreat();
      pendingAction = null; combatActive = false;
      return { broke, boss, aiming };
    });
    ok(`an empty purse refuses it but still shows the price (${refused.broke.says})`,
      !refused.broke.can && refused.broke.shown && refused.broke.off && /\d/.test(refused.broke.says));
    ok('and pressing it anyway costs nothing', refused.broke.tookNothing);
    ok('a commander lets you do neither', !refused.boss.retreat && !refused.boss.withdraw);
    ok('and neither is offered mid-aim', !refused.aiming);

    // ---- one question at a time ----
    const single = await page.evaluate(() => {
      __stage();
      retreat(); const first = armedExit;
      withdraw(); const second = armedExit;
      renderCommandDeck();
      const deck = document.getElementById('command-deck');
      const acts = [...deck.querySelectorAll('[data-action]')].map(b => b.dataset.action);
      disarmWithdraw(); renderCommandDeck();
      const backOut = armedExit === null && combatActive &&
                      !!document.querySelector('[data-action="retreat"]');
      combatActive = false;
      return { first, second, acts, backOut };
    });
    ok('arming one disarms the other', single.first === 'RETREAT' && single.second === 'WITHDRAW');
    ok(`and the armed question owns the deck (${single.acts.join(', ')})`,
      single.acts.every(a => a === 'withdraw' || a === 'withdraw-cancel'));
    ok('with a way back to the fight', single.backOut);

    // ---- it survives a reload, and does not outlive the run ----
    await page.evaluate(() => {
      const real = Math.random;
      __stage(); Math.random = () => 0; retreat(); retreat(); Math.random = real;
      saveGameState();
    });
    const held = await page.evaluate(() => ({ node: retreatNode, offered: availableNodeIds().length }));
    await page.reload();
    await page.waitForTimeout(600);
    const reloaded = await page.evaluate(() => {
      currentSlot = 1; loadGameState();
      const after = { node: retreatNode, offered: availableNodeIds() };
      advanceSector();
      const acrossSector = retreatNode;
      currentSlot = 1; confirmNewGame(1.0);
      return { after, acrossSector, fresh: retreatNode, freshArmed: armedExit };
    });
    ok(`the fall-back survives a reload (${reloaded.after.node})`,
      reloaded.after.node === held.node && reloaded.after.offered.length === 1);
    ok('nothing is held across a sector', reloaded.acrossSector === null);
    ok('and a new expedition starts with no debt to a node', reloaded.fresh === null && reloaded.freshArmed === null);

    // ---- the summary owns up to it ----
    const summary = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      runStats.retreats = 3; runStats.retreatsFailed = 1;
      renderRunOver(0, false);
      const withIt = [...document.querySelectorAll('#runover-lines .runover-line')].map(l => l.innerText).join(' | ');
      runStats.retreats = 0; runStats.retreatsFailed = 0;
      renderRunOver(0, false);
      const without = [...document.querySelectorAll('#runover-lines .runover-line')].map(l => l.innerText).join(' | ');
      return { withIt, without };
    });
    ok(`the run summary counts the fallbacks and the failures (${(summary.withIt.match(/FALLBACKS[^|]*/) || [''])[0].trim()})`,
      /FALLBACKS BOUGHT/.test(summary.withIt) && /3/.test(summary.withIt) && /1 failed/.test(summary.withIt));
    ok('and stays quiet on a run that never bought one', !/FALLBACKS/.test(summary.without));

    // ---- and the game says the verb exists ----
    const taught = await page.evaluate(() => {
      const p = PROMPTS.find(x => x.id === 'RETREAT');
      const text = CODEX.map(e => e.body().join(' ')).join(' ');
      return { prompt: !!p && /fail/i.test(p.body) && /Scrap/i.test(p.body),
               manual: /Retreating/.test(text) && text.includes(String(RETREAT.cost)) };
    });
    ok('the field prompt explains that it can fail', taught.prompt);
    ok('and the manual quotes the live price', taught.manual);
  }
};

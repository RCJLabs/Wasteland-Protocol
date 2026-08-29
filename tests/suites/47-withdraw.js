// There was no way out of a fight. Once a node was entered it resolved to a victory or a wipe,
// so a bad opening - the wrong formation against a flanker, two heavies in the first two turns -
// had no answer but to lose the squad and spend a fallback. Routing on the map was the only risk
// decision in a run, and it was made before any information arrived.
module.exports = {
  name: 'Withdrawing from a fight',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // A clean stage: a fight in progress with an operator on the clock, no quirks or relics
    // bending the arithmetic, and the squad wounded enough that leaving is a real question.
    const stage = (opts = {}) => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; pursuit = null; withdrawArmed = false;
      currentSector = opts.sector || 2; currentTier = opts.tier || 6;
      initiateCombat(opts.node || 'RAIDERS', false);
      playerRoster.forEach(c => { c.quirk = null; c.trinket = null; c.traits = []; });
      activeRelics = [];
      playerRoster.filter(p => p.gridPos > 0).forEach(p => { p.hp = Math.floor(p.maxHp * (opts.hp || 0.5)); });
      momentum = opts.momentum === undefined ? 0 : opts.momentum; addMomentum(0);
      activeIndex = turnQueue.findIndex(e => e.isPlayer && e.hp > 0);
      combatActive = true; pendingAction = null;
      renderField(); renderCommandDeck();
    };
    await page.evaluate(`window.__stage = ${stage.toString()}`);

    // ---- the verb exists, and it is offered where it makes sense ----
    const offered = await page.evaluate(() => {
      __stage();
      const inDeck = !!document.querySelector('[data-action="withdraw"]');
      const firstBtn = document.querySelector('#command-deck [data-action]');
      const firstAction = firstBtn ? firstBtn.dataset.action : null;
      const mid = canWithdraw();
      // Not while aiming - the deck is showing targets, not choices.
      pendingAction = 'PISTOL'; const aiming = canWithdraw(); pendingAction = null;
      // And never from a commander: the sector gate cannot be walked past.
      __stage({ node: 'BOSS', tier: TOTAL_TIERS });
      const atBoss = canWithdraw();
      const bossDeck = !!document.querySelector('[data-action="withdraw"]');
      combatActive = false;
      return { inDeck, mid, aiming, atBoss, bossDeck, firstAction };
    });
    ok('the command deck offers a way out', offered.inDeck && offered.mid);
    ok(`and does not put it above the abilities (first control is ${offered.firstAction})`,
      offered.firstAction !== 'withdraw');
    ok('not in the middle of aiming', !offered.aiming);
    ok('and never from a commander', !offered.atBoss && !offered.bossDeck);

    // ---- the price is read before it is paid ----
    const preview = await page.evaluate(() => {
      __stage({ momentum: 0 });
      const first = withdraw();                                   // arms rather than commits
      const armed = withdrawArmed;
      const stillFighting = combatActive && currentTier === 6;
      renderCommandDeck();
      const panel = document.querySelector('.withdraw-cost');
      const text = panel ? panel.innerText : '';
      const cost = withdrawCost();
      const canBack = !!document.querySelector('[data-action="withdraw-cancel"]');
      // Armed, the deck holds two answers and nothing else: a live ability under a confirmation
      // is a misclick trap in both directions.
      const others = [...document.querySelectorAll('#command-deck [data-action]')]
        .map(b => b.dataset.action).filter(a => a !== 'withdraw' && a !== 'withdraw-cancel');
      // Backing out costs nothing at all.
      disarmWithdraw(); renderCommandDeck();
      const backedOut = !withdrawArmed && combatActive && currentTier === 6 &&
                        !document.querySelector('.withdraw-cost');
      combatActive = false;
      return { armed, stillFighting, text, canBack, backedOut, others,
               worst: cost.hits.reduce((a, h) => Math.max(a, h.loss), 0),
               chasers: cost.chasers };
    });
    ok('the first press arms it rather than committing', preview.armed && preview.stillFighting);
    ok(`and states the whole price (${preview.text.replace(/\s+/g, ' ').slice(0, 90)}...)`,
      /no loot/i.test(preview.text) && /health/i.test(preview.text) && /follow/i.test(preview.text));
    ok(`the wound it names is the wound it deals (up to ${preview.worst})`,
      new RegExp(`up to ${preview.worst}`).test(preview.text));
    ok('and there is a way back out of the decision', preview.canBack && preview.backedOut);
    ok(`nothing else is clickable while it is armed (${preview.others.join(', ') || 'nothing else'})`,
      preview.others.length === 0);

    // ---- what it costs ----
    const paid = await page.evaluate(() => {
      __stage({ momentum: 0 });
      const scrap0 = scrap;
      const before = playerRoster.filter(p => p.gridPos > 0).map(p => ({ id: p.id, hp: p.hp, max: p.maxHp }));
      const cost = withdrawCost();
      withdraw(); withdraw();
      const after = playerRoster.filter(p => p.gridPos > 0).map(p => p.hp);
      return {
        scrapGained: scrap - scrap0,
        tier: currentTier, ended: !combatActive,
        wounded: before.every((b, i) => after[i] === b.hp - cost.hits[i].loss),
        allStanding: after.every(h => h > 0),
        pct: cost.pct
      };
    });
    ok(`the node pays nothing (${paid.scrapGained} scrap)`, paid.scrapGained === 0);
    ok('the fight ends and the run moves on', paid.ended && paid.tier === 7);
    ok(`everyone takes the wound that was quoted (${Math.round(paid.pct * 100)}%)`, paid.wounded);
    ok('and everyone is still standing - leaving is not a second way to lose', paid.allStanding);

    // Never lethal, however thin the squad already is.
    const survivable = await page.evaluate(() => {
      __stage({ momentum: 0 });
      playerRoster.filter(p => p.gridPos > 0).forEach(p => { p.hp = 1; });
      withdraw(); withdraw();
      return playerRoster.filter(p => p.gridPos > 0).every(p => p.hp === 1);
    });
    ok('an operator on one health walks out of it', survivable);

    // ---- momentum is the difference between a rout and a fighting withdrawal ----
    const eased = await page.evaluate(() => {
      __stage({ momentum: 0 });   const cold = withdrawCost().pct;
      __stage({ momentum: 50 });  const half = withdrawCost().pct;
      __stage({ momentum: 100 }); const full = withdrawCost().pct;
      __stage({ momentum: 100 });
      withdraw(); withdraw();
      const spent = momentum;
      combatActive = false;
      return { cold, half, full, spent };
    });
    ok(`a rout costs the most (${Math.round(eased.cold * 100)}% health)`, eased.cold > eased.full);
    ok(`momentum buys a cleaner break (${Math.round(eased.full * 100)}% at a full bar)`,
      eased.full < eased.cold && Math.abs(eased.half - (eased.cold + eased.full) / 2) < 0.01);
    ok('and the bar is spent on the way out', eased.spent === 0);

    // ---- they follow ----
    const chase = await page.evaluate(() => {
      __stage({ momentum: 0 });
      const foes = activeEntities.filter(e => !e.isPlayer && e.hp > 0);
      // Wound all of them, differently, and check the whole chase rather than one enemy: the
      // chase takes the toughest three, so wounding an arbitrary one and hoping it is chased
      // passes or fails on how many hostiles the fight happened to roll.
      foes.forEach((f, i) => { f.hp = Math.max(1, Math.floor(f.maxHp * (0.3 + i * 0.13))); });
      const left = Object.fromEntries(foes.map(f => [f.id, f.hp]));
      withdraw(); withdraw();
      const waiting = pursuit ? pursuit.units.length : 0;
      const capped = waiting <= WITHDRAW.pursuers;
      // Captured at the health the squad left them at, every one of them.
      const captured = (pursuit ? pursuit.units : []).every(u => left[u.id] === u.hp);
      const owed = (pursuit ? pursuit.units : []).map(u => u.hp).sort((a, b) => a - b).join();
      // The next fight inherits them, on top of its own. Under a clear sky on purpose: the
      // arriving chase takes its own first turn, and shrapnel landing on it is the weather
      // working, not the chase arriving wrong.
      const plain = generateEnemies('RAIDERS', 1, false, 1).length;
      forecastWeather = 'CLEAR';
      initiateCombat('RAIDERS', false);
      const chasers = activeEntities.filter(e => e.id.startsWith('chase_'));
      const arrived = chasers.map(c => c.hp).sort((a, b) => a - b).join();
      const woundedArrival = captured && owed.length > 0 && owed === arrived;
      const cleared = pursuit === null;
      const total = activeEntities.filter(e => !e.isPlayer).length;
      combatActive = false;
      return { waiting, capped, chasers: chasers.length, woundedArrival, cleared, total, plain, owed, arrived };
    });
    ok(`the survivors follow (${chase.waiting} of them)`, chase.waiting > 0 && chase.capped);
    ok(`and are waiting at the next fight, on top of its own (${chase.total} against about ${chase.plain})`,
      chase.chasers === chase.waiting && chase.total > chase.plain);
    ok(`carrying the wounds the squad already put on them (${chase.owed} left, ${chase.arrived} arrived)`,
      chase.woundedArrival);
    ok('and they are spent on arrival, so running twice does not stack a mob', chase.cleared);

    // ---- the chase does not outlive the sector, or the run ----
    const limits = await page.evaluate(() => {
      __stage({ momentum: 0 });
      withdraw(); withdraw();
      const held = !!pursuit;
      advanceSector();
      const acrossSector = pursuit === null;
      __stage({ momentum: 0 });
      withdraw(); withdraw();
      const again = !!pursuit;
      currentSlot = 1; confirmNewGame(1.0);
      const acrossRun = pursuit === null && !withdrawArmed;
      return { held, acrossSector, again, acrossRun };
    });
    ok('a chase is held between nodes', limits.held && limits.again);
    ok('but nothing follows across a sector', limits.acrossSector);
    ok('and a new run starts with nobody behind it', limits.acrossRun);

    // ---- and it survives a reload, or the chase would be a save-scum away ----
    await page.evaluate(() => {
      __stage({ momentum: 0 });
      withdraw(); withdraw();
      saveGameState();
    });
    const kept = await page.evaluate(() => ({ before: pursuit ? pursuit.units.length : 0 }));
    await page.reload();
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => {
      currentSlot = 1; loadGameState();
      return { after: pursuit ? pursuit.units.length : 0 };
    });
    ok(`the chase survives a reload (${kept.before} -> ${after.after})`,
      kept.before > 0 && after.after === kept.before);

    // ---- the run remembers it happened ----
    const counted = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 6; initiateCombat('RAIDERS', false);
      activeIndex = turnQueue.findIndex(e => e.isPlayer && e.hp > 0); combatActive = true;
      const before = (runStats && runStats.withdrawals) || 0;
      const nodesBefore = runStats.nodes;
      withdraw(); withdraw();
      const summary = () => {
        renderRunOver(0, false);
        return [...document.querySelectorAll('#runover-lines .runover-line')].map(l => l.innerText).join(' | ');
      };
      const shown = summary();
      runStats.withdrawals = 0;
      const hidden = summary();
      return { before, after: runStats.withdrawals === 0 ? before + 1 : runStats.withdrawals,
               nodesBefore, nodes: runStats.nodes, shown, hidden };
    });
    ok('the run keeps a tally of what it ran from', counted.after === counted.before + 1);
    // A node you ran from is not a node you cleared: the two are counted apart, or the summary
    // credits the player with clearing a fight they left standing.
    ok(`and does not credit it as a node cleared (${counted.nodesBefore} -> ${counted.nodes})`,
      counted.nodes === counted.nodesBefore);
    ok('the run summary owns up to it', /ABANDONED/i.test(counted.shown));
    ok('and stays quiet on a run that never ran', !/ABANDONED/i.test(counted.hidden));

    // ---- and the game says the verb exists, the first time a fight turns ----
    const taught = await page.evaluate(() => {
      const p = PROMPTS.find(x => x.id === 'WITHDRAW');
      return { exists: !!p, says: p ? /withdraw/i.test(p.body) : false };
    });
    ok('the field prompt for it exists and explains the cost', taught.exists && taught.says);

    // The manual reads the live numbers, so retuning the wound cannot leave it lying.
    const manual = await page.evaluate(() => {
      const text = CODEX.map(e => e.body().join(' ')).join(' ');
      return { text: /[Ww]ithdraw/.test(text),
               wound: text.includes(`${Math.round(WITHDRAW.wound * 100)}%`),
               floor: text.includes(`${Math.round(WITHDRAW.floor * 100)}%`),
               chase: text.includes(`${WITHDRAW.pursuers} toughest`) };
    });
    ok('the manual covers it', manual.text);
    ok('quoting the live wound, its floor and the size of the chase',
      manual.wound && manual.floor && manual.chase);
  }
};

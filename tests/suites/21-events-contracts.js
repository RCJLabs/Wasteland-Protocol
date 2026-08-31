// Four events, each resolved on the screen that offered it, so the map was a series of fights
// with occasional flavour. And every run had exactly the same shape.
module.exports = {
  name: 'Events and contracts',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the event pool ----
    // An event's description and choice list may each be a literal or a function of the run so
    // far, so both are asked for rather than read off the object. The contract underneath is the
    // same one it always was, and it now covers the follow-up encounters too.
    const pool = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const all = [...EVENT_POOL, ...FOLLOWUPS];
      return {
        count: EVENT_POOL.length, all: all.length,
        titles: new Set(all.map(e => e.title)).size,
        malformed: all.filter(e => !e.title || typeof eventDesc(e) !== 'string' || !eventDesc(e).length
                                || !Array.isArray(choicesFor(e)) || choicesFor(e).length < 2).map(e => e.title),
        choicesWithoutGuards: all.flatMap(e => choicesFor(e).filter(c => typeof c.canAfford !== 'function' || typeof c.execute !== 'function').map(() => e.title)),
        unlabelled: all.flatMap(e => choicesFor(e).filter(c => !c.label).map(() => e.title))
      };
    });
    ok(`the pool holds ${pool.count} events, not four`, pool.count >= 12);
    ok('each with its own title', pool.titles === pool.all);
    ok('each with a description and at least two choices', pool.malformed.length === 0);
    ok('every choice can say whether it is affordable and what it does', pool.choicesWithoutGuards.length === 0);
    ok('and every choice is labelled', pool.unlabelled.length === 0);

    // Every choice has to survive being taken from a plausible run state - an event that throws
    // is an event that strands the player on a dead screen with the node already spent.
    const exercised = await page.evaluate(() => {
      const failures = [];
      let ran = 0, affordable = 0;
      EVENT_POOL.forEach(ev => choicesFor(ev).forEach((c, i) => {
        currentSlot = 1; activeContracts = []; confirmNewGame(1.0); sectorFront = null;
        scrap = 500; materials = { parts: 5, chems: 5, tech: 5 };
        inventory = ['MED_STIM']; currentSector = 2; pendingConsequences = [];
        try {
          const can = c.canAfford();
          if (can) affordable++;
          const text = c.execute();
          ran++;
          if (typeof text !== 'string' || !text.length) failures.push(`${ev.title}[${i}] returned no text`);
        } catch (e) { failures.push(`${ev.title}[${i}] threw ${e.message}`); }
      }));
      return { ran, affordable, failures };
    });
    ok(`all ${exercised.ran} choices resolve without throwing`, exercised.failures.length === 0);
    ok('and every one reports back what happened', exercised.failures.length === 0);
    if (exercised.failures.length) exercised.failures.forEach(f => console.log('        ' + f));
    ok('a well-supplied squad can afford most of them', exercised.affordable > exercised.ran * 0.8);

    // ---- and they stop handing back the same one ----
    // 80 draws left a real chance of missing one of fifteen events outright - a coupon-collector
    // tail, not a bug in the pool - so the run that proves every event is reachable is long
    // enough that missing one would mean the pool is genuinely broken.
    const rotation = await page.evaluate(() => {
      recentEvents = [];
      const seq = []; for (let i = 0; i < 400; i++) seq.push(pickEvent().title);
      let tooSoon = 0;
      for (let i = 1; i < seq.length; i++) if (seq.slice(Math.max(0, i - EVENT_MEMORY), i).includes(seq[i])) tooSoon++;
      return { distinct: new Set(seq).size, tooSoon, memory: EVENT_MEMORY };
    });
    ok(`400 draws reach all ${rotation.distinct} events`, rotation.distinct === pool.count);
    ok(`and none repeats within ${rotation.memory} of itself`, rotation.tooSoon === 0);

    // ---- some choices book something that comes due later ----
    const booking = await page.evaluate(() => {
      const all = [...EVENT_POOL, ...FOLLOWUPS];
      const src = all.map(e => ({ title: e.title, books: choicesFor(e).filter(c => String(c.execute).includes('bookConsequence')).length }));
      return { kinds: Object.keys(CONSEQUENCE_POOL),
               events: src.filter(e => e.books > 0).map(e => e.title),
               allKindsUsed: Object.keys(CONSEQUENCE_POOL).every(k =>
                 all.some(e => choicesFor(e).some(c => String(c.execute).includes(`'${k}'`)))) };
    });
    ok(`there are ${booking.kinds.length} kinds of deferred outcome`, booking.kinds.length >= 3);
    ok(`and ${booking.events.length} events that book one`, booking.events.length >= 3);
    ok('every declared kind is actually reachable from an event', booking.allKindsUsed);

    // The fuse is counted in NODES, not sectors. It used to be booked against a sector and lit
    // only when one was cleared, so a debt "one sector on" needed a whole sector including the
    // commander - and the median run reaches sector 2. Six in seven were never collected.
    const timing = await page.evaluate(() => {
      currentSlot = 1; activeContracts = []; confirmNewGame(1.0); sectorFront = null;
      pendingConsequences = []; runStats.nodes = 0;
      bookConsequence('DEBT', 4, { amount: 400 });
      const at = n => { runStats.nodes = n; return consequencesDue().length; };
      return { n0: at(0), n3: at(3), n4: at(4), n9: at(9), booked: pendingConsequences[0],
               sameSector: (() => { runStats.nodes = 4; currentSector = 1; return consequencesDue().length; })(),
               fuse: CONSEQUENCE_FUSE };
    });
    ok('a debt booked four nodes out is not due yet', timing.n0 === 0 && timing.n3 === 0);
    ok('comes due on the node it was booked against', timing.n4 === 1);
    ok('and stays due once passed', timing.n9 === 1);
    ok('inside the sector that lit it, without waiting for a commander', timing.sameSector === 1);
    ok('carrying whatever the event promised', timing.booked.amount === 400);
    ok(`every kind's term is short enough to land inside a run (${Object.values(timing.fuse).join(', ')} nodes)`,
      Object.values(timing.fuse).every(v => v >= 1 && v <= 8));

    const debt = await page.evaluate(() => {
      const run = (purse) => {
        currentSlot = 1; activeContracts = []; confirmNewGame(1.0); sectorFront = null;
        playerRoster.forEach(u => { if (u.gridPos > 0) { u.maxHp = 100; u.hp = 100; } });
        pendingConsequences = []; runStats.nodes = 0;
        bookConsequence('DEBT', 1, { amount: 400 });
        runStats.nodes = 1; scrap = purse;
        const shown = resolveConsequence();
        return { shown, scrap, hurt: playerRoster.filter(u => u.gridPos > 0 && u.hp < 100).length,
                 left: pendingConsequences.length,
                 screen: getComputedStyle(document.getElementById('screen-event')).display,
                 title: document.getElementById('event-title').innerText,
                 text: document.getElementById('event-choices').innerText };
      };
      return { rich: run(1000), broke: run(50) };
    });
    ok('a due consequence interrupts with its own screen', debt.rich.shown && debt.rich.screen === 'flex');
    ok(`it takes the scrap when you have it (1000 -> ${debt.rich.scrap})`, debt.rich.scrap === 600);
    ok('and nobody gets hurt', debt.rich.hurt === 0);
    ok(`it takes what you have when you do not (50 -> ${debt.broke.scrap})`, debt.broke.scrap === 0);
    ok('and the rest out of the squad', debt.broke.hurt > 0);
    ok('either way the debt is settled once', debt.rich.left === 0 && debt.broke.left === 0);
    ok('and the player is told what happened', /Scrap|short/.test(debt.rich.text) && /CONTINUE/.test(debt.rich.text));

    const others = await page.evaluate(() => {
      const fire = (kind) => {
        currentSlot = 1; activeContracts = []; confirmNewGame(1.0); sectorFront = null;
        playerRoster.forEach(u => { if (u.gridPos > 0) { u.maxHp = 100; u.hp = 60; } });
        scrap = 0; materials = { parts: 0, chems: 0, tech: 0 };
        pendingConsequences = []; runStats.nodes = 0;
        bookConsequence(kind, 0);
        resolveConsequence();
        const squad = playerRoster.filter(u => u.gridPos > 0);
        return { hp: squad.map(u => u.hp), scrap,
                 mats: materials.parts + materials.chems + materials.tech,
                 title: document.getElementById('event-title').innerText };
      };
      return { ambush: fire('AMBUSH'), survivor: fire('SURVIVOR') };
    });
    ok('an ambush hurts the squad', others.ambush.hp.every(h => h < 60));
    ok('but never kills anyone outright', others.ambush.hp.every(h => h >= 1));
    ok(`and says so (${others.ambush.title})`, others.ambush.title.length > 0);
    ok('the survivor you helped heals the squad', others.survivor.hp.every(h => h === 100));
    ok('and brings supplies', others.survivor.scrap > 0 && others.survivor.mats > 0);

    // A consequence must not evaporate on a reload, or the promise the event made is void.
    await page.evaluate(() => {
      currentSlot = 1; activeContracts = []; confirmNewGame(1.0); sectorFront = null;
      pendingConsequences = []; runStats.nodes = 0;
      bookConsequence('DEBT', 4, { amount: 400 });
      recentEvents = ['THE HOARD', 'MINEFIELD'];
      saveGameState();
    });
    await page.reload();
    await page.waitForTimeout(700);
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(400);
    const persisted = await page.evaluate(() => ({
      booked: pendingConsequences.length,
      amount: (pendingConsequences[0] || {}).amount,
      due: (pendingConsequences[0] || {}).dueAt,
      recent: recentEvents.length
    }));
    ok('a booked consequence survives a reload', persisted.booked === 1 && persisted.amount === 400);
    ok('with the node it comes due on intact', persisted.due === 4);
    ok('and the run remembers which events it has already seen', persisted.recent === 2);

    // Clearing the node it is booked against is what fires it - no commander required.
    const arrival = await page.evaluate(() => {
      currentSlot = 1; activeContracts = []; confirmNewGame(1.0); sectorFront = null;
      pendingConsequences = []; currentTier = 3; scrap = 1000;
      runStats.nodes = 0;
      bookConsequence('DEBT', 1, { amount: 400 });
      collectLoot(10, false);   // one node cleared, which is the whole term
      return { sector: currentSector, screen: getComputedStyle(document.getElementById('screen-event')).display,
               map: getComputedStyle(document.getElementById('screen-map')).display, scrap };
    });
    ok('clearing the node it is due on fires it, inside the same sector',
      arrival.sector === 1 && arrival.screen === 'flex');
    ok('ahead of the map', arrival.map === 'none');
    ok('and it is actually applied', arrival.scrap === 610);   // 1000 + 10 looted - 400 owed


    const acknowledged = await page.evaluate(() => {
      document.querySelector('[data-action="consequence-ack"]').click();
      return { map: getComputedStyle(document.getElementById('screen-map')).display,
               left: pendingConsequences.length };
    });
    ok('acknowledging it returns to the map', acknowledged.map === 'flex');

    // The board says what is coming, because a debt you can see is a decision.
    const owedRow = await page.evaluate(() => {
      currentSlot = 1; activeContracts = []; confirmNewGame(1.0); sectorFront = null;
      pendingConsequences = []; runStats.nodes = 0; currentTier = 2;
      renderMap();
      const quiet = document.querySelectorAll('.bounty-owed').length;
      bookConsequence('DEBT', 4, { amount: 400 });
      renderMap();
      const shown = document.querySelector('.bounty-owed');
      runStats.nodes = 4; renderMap();
      const now = document.querySelector('.bounty-owed');
      return { quiet, warned: !!shown, text: shown ? shown.innerText : '',
               nowText: now ? now.innerText : '' };
    });
    ok('nothing owed, nothing on the board', owedRow.quiet === 0);
    ok(`a debt on the way is shown with how far off it is (${owedRow.text.replace(/\n/g, ' ')})`,
      owedRow.warned && /4 nodes/.test(owedRow.text));
    ok(`and reads as due when it is (${owedRow.nowText.replace(/\n/g, ' ')})`, /NOW/.test(owedRow.nowText));
    ok('with nothing outstanding', acknowledged.left === 0);

    const stacked = await page.evaluate(() => {
      currentSlot = 1; activeContracts = []; confirmNewGame(1.0); sectorFront = null;
      pendingConsequences = []; currentSector = 2; scrap = 2000;
      bookConsequence('DEBT', 0, { amount: 100 });
      bookConsequence('AMBUSH', 0);
      resolveConsequence();
      const afterFirst = pendingConsequences.length;
      const firstTitle = document.getElementById('event-title').innerText;
      document.querySelector('[data-action="consequence-ack"]').click();
      const afterSecond = pendingConsequences.length;
      const secondTitle = document.getElementById('event-title').innerText;
      const stillOnEvent = getComputedStyle(document.getElementById('screen-event')).display;
      document.querySelector('[data-action="consequence-ack"]').click();
      return { afterFirst, afterSecond, firstTitle, secondTitle, stillOnEvent,
               onMap: getComputedStyle(document.getElementById('screen-map')).display };
    });
    ok('two due at once are shown one at a time', stacked.afterFirst === 1 && stacked.afterSecond === 0);
    ok('each on its own screen', stacked.firstTitle !== stacked.secondTitle && stacked.stillOnEvent === 'flex');
    ok('and the map waits until both are settled', stacked.onMap === 'flex');

    // ---- expedition contracts ----
    const contracts = await page.evaluate(() => ({
      count: CONTRACT_POOL.length,
      ids: new Set(CONTRACT_POOL.map(c => c.id)).size,
      described: CONTRACT_POOL.every(c => c.name && c.desc && c.bonus > 0),
      none: (activeContracts = [], contractMult()),
      each: CONTRACT_POOL.map(c => { activeContracts = [c.id]; return +contractMult().toFixed(2); }),
      all: (activeContracts = CONTRACT_POOL.map(c => c.id), +contractMult().toFixed(2)),
      names: (activeContracts = ['GLASS'], contractNames()),
      reset: (activeContracts = [], contractMult())
    }));
    ok(`there are ${contracts.count} contracts to sign`, contracts.count >= 5);
    ok('each with a unique id, a name, a description and a bonus', contracts.ids === contracts.count && contracts.described);
    ok('taking none leaves the score alone', contracts.none === 1 && contracts.reset === 1);
    ok('each one on its own raises it', contracts.each.every(m => m > 1));
    ok(`and they stack (all of them: x${contracts.all})`, contracts.all > Math.max(...contracts.each));
    ok('the board can name what is signed', contracts.names.length === 1);

    // Each has to actually change the run, not just the multiplier.
    const effects = await page.evaluate(() => {
      const run = (ids) => { activeContracts = ids; currentSlot = 1; confirmNewGame(1.0); sectorFront = null; };
      const out = {};
      run([]);
      out.normal = { bag: inventory.length, deployed: playerRoster.filter(p => p.gridPos > 0).length,
                     regroups: totalRegroups() };
      run(['NO_CONSUMABLES']);
      out.dryBag = inventory.length;
      run(['SHORT_HANDED']);
      out.short = { deployed: playerRoster.filter(p => p.gridPos > 0).length,
                    back: playerRoster.filter(p => p.gridPos === 3).length };
      const benched = playerRoster.find(p => p.gridPos === 0);
      assignSlot(benched.id, 3);
      out.shortRefusesBackRank = playerRoster.filter(p => p.gridPos === 3).length === 0;
      run(['NO_REGROUPS']);
      out.noRegroups = totalRegroups();
      run([]);
      return out;
    });
    ok(`Dry Run deploys with an empty bag (${effects.dryBag} vs ${effects.normal.bag})`, effects.dryBag === 0 && effects.normal.bag > 0);

    // Events hand out items too, so the rule cannot live at the crafting bench alone.
    const dry = await page.evaluate(() => {
      activeContracts = ['NO_CONSUMABLES']; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      scrap = 500; materials = { parts: 9, chems: 9, tech: 9 };
      const offered = EVENT_POOL.flatMap(e => choicesFor(e)
        .filter(c => String(c.execute).includes('inventory.push'))
        .map(c => ({ title: e.title, can: c.canAfford() })));
      craftItem('MED_STIM');
      const crafted = inventory.length;
      activeContracts = []; confirmNewGame(1.0); sectorFront = null;
      scrap = 500; materials = { parts: 9, chems: 9, tech: 9 };
      const offeredNormally = EVENT_POOL.flatMap(e => choicesFor(e)
        .filter(c => String(c.execute).includes('inventory.push'))
        .map(c => c.canAfford()));
      return { offered, crafted, offeredNormally };
    });
    ok(`no event offers an item under Dry Run (${dry.offered.length} such choices checked)`,
      dry.offered.length >= 3 && dry.offered.every(o => !o.can));
    ok('and the bench refuses to craft one', dry.crafted === 0);
    ok('while all of them are available normally', dry.offeredNormally.some(Boolean));
    ok(`Short Handed deploys one fewer (${effects.short.deployed} vs ${effects.normal.deployed})`,
      effects.short.deployed === effects.normal.deployed - 1);
    ok('leaving the back rank empty', effects.short.back === 0);
    ok('and refusing to fill it later in the run', effects.shortRefusesBackRank);
    ok(`No Fallback takes the regroups (${effects.noRegroups} vs ${effects.normal.regroups})`,
      effects.noRegroups === 0 && effects.normal.regroups > 0);

    const glass = await page.evaluate(() => {
      const tmpl = Object.fromEntries(ROSTER_TEMPLATE.map(t => [t.id, t.maxHp]));
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const normal = playerRoster.map(u => u.maxHp / (tmpl[u.id] + u.quirk.hp));
      activeContracts = ['GLASS']; confirmNewGame(1.0); sectorFront = null;
      const glassed = playerRoster.map(u => u.maxHp / (tmpl[u.id] + u.quirk.hp));
      const full = playerRoster.every(u => u.hp === u.maxHp);
      activeContracts = [];
      return { normal, glassed, full };
    });
    ok('normally an operator deploys at full health', glass.normal.every(r => Math.abs(r - 1) < 0.02));
    ok('Glass Jaw takes a quarter of it', glass.glassed.every(r => r > 0.7 && r < 0.78));
    ok('and they still deploy topped up to that', glass.full);

    const combat = await page.evaluate(() => {
      const opener = (ids) => {
        activeContracts = ids; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 2; currentTier = 4; initiateCombat('RAIDERS', false);
        return turnQueue[activeIndex].isPlayer;
      };
      const weather = (ids) => {
        activeContracts = ids; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        let clear = 0;
        for (let i = 0; i < 120; i++) { currentSector = 2; currentTier = 4; initiateCombat('RAIDERS', false); if (currentWeather === 'CLEAR') clear++; }
        return clear;
      };
      const grace = (ids) => {
        activeContracts = ids; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 1; currentTier = 1; initiateCombat('RAIDERS', false);
        return currentWeather;
      };
      const normalOpeners = []; for (let i = 0; i < 12; i++) normalOpeners.push(opener([]));
      const watchOpeners = []; for (let i = 0; i < 12; i++) watchOpeners.push(opener(['THEY_MOVE_FIRST']));
      const out = { normalOpeners, watchOpeners,
                    clearNormally: weather([]), clearHarsh: weather(['HARSH_SKIES']),
                    graceNormal: grace([]), graceHarsh: grace(['HARSH_SKIES']) };
      activeContracts = [];
      return out;
    });
    // Turn order is decided by speed, so a fast enemy can already open a normal fight - the
    // invariant is that Second Watch takes the decision away from speed entirely.
    ok(`normally the squad usually opens (${combat.normalOpeners.filter(Boolean).length}/12)`,
      combat.normalOpeners.some(Boolean));
    ok('Second Watch always hands the opening turn to the enemy',
      combat.watchOpeners.every(p => p === false));
    ok(`normally some nodes are clear (${combat.clearNormally}/120)`, combat.clearNormally > 20);
    ok('Harsh Skies leaves none of them clear', combat.clearHarsh === 0);
    ok('including the opening node, which is otherwise always calm',
      combat.graceNormal === 'CLEAR' && combat.graceHarsh !== 'CLEAR');

    // ---- the score they buy, banked on the run rather than read live ----
    const scoring = await page.evaluate(() => {
      activeContracts = ['GLASS', 'NO_REGROUPS'];
      const st = { ...newRunStats(), deepestSector: 4, deepestTier: 5, bosses: 3, elites: 4, kills: 60, scrapEarned: 2000 };
      const withContracts = computeScore(st);
      const plain = computeScore({ ...st, contractMult: 1 });
      // a banked run must not be re-scored by what the NEXT expedition signs up for
      activeContracts = [];
      const afterClearing = computeScore(st);
      return { plain, withContracts, afterClearing, banked: st.contractMult, names: st.contracts };
    });
    ok(`contracts multiply the final score (${scoring.plain} -> ${scoring.withContracts})`,
      scoring.withContracts > scoring.plain);
    ok(`by exactly what was signed for (x${scoring.banked.toFixed(2)})`,
      Math.abs(scoring.withContracts / scoring.plain - scoring.banked) < 0.01);
    ok('the multiplier is banked on the run, not read live', scoring.afterClearing === scoring.withContracts);
    ok('and the run records what it signed for', scoring.names.length === 2);

    // ---- the board itself ----
    await page.evaluate(() => { activeContracts = []; renderTitleScreen(); });
    await page.click('.title-btn[data-exists="0"]');
    await page.waitForTimeout(200);
    await page.click('.title-btn[data-diff="1.3"]');
    await page.waitForTimeout(300);
    const board = await page.evaluate(() => ({
      screen: getComputedStyle(document.getElementById('screen-contracts')).display,
      cards: document.querySelectorAll('#contract-list [data-action="toggle-contract"]').length,
      mult: document.getElementById('contract-mult').innerText,
      diffHeld: pendingDifficulty,
      noneOn: document.querySelectorAll('.contract-on').length
    }));
    ok('picking a difficulty opens the contract board', board.screen === 'flex');
    ok('listing every contract', board.cards === contracts.count);
    ok('starting at no multiplier', /x1\.00/.test(board.mult) && board.noneOn === 0);
    ok('with the chosen difficulty held for the deployment', board.diffHeld === 1.3);

    await page.click('[data-id="HARSH_SKIES"]');
    await page.waitForTimeout(150);
    const toggled = await page.evaluate(() => ({
      on: document.querySelectorAll('.contract-on').length,
      mult: document.getElementById('contract-mult').innerText,
      state: [...activeContracts]
    }));
    ok('a contract can be signed', toggled.on === 1 && toggled.state.join() === 'HARSH_SKIES');
    ok(`and the board says what it is worth (${toggled.mult.split('—')[0].trim()})`, /x1\.20/.test(toggled.mult));
    ok('naming it', /HARSH SKIES/.test(toggled.mult));

    await page.click('[data-id="HARSH_SKIES"]');
    await page.waitForTimeout(150);
    const untoggled = await page.evaluate(() => ({ on: document.querySelectorAll('.contract-on').length, mult: document.getElementById('contract-mult').innerText }));
    ok('and unsigned again', untoggled.on === 0 && /x1\.00/.test(untoggled.mult));

    await page.click('[data-id="GLASS"]');
    await page.waitForTimeout(120);
    await page.click('[data-action="begin-expedition"]');
    await page.waitForTimeout(300);
    await page.click('[data-action="muster-deploy"]');
    await page.waitForTimeout(400);
    const deployed = await page.evaluate(() => ({
      map: getComputedStyle(document.getElementById('screen-map')).display,
      signed: [...activeContracts], banked: runStats.contractMult,
      diff: difficultyMult
    }));
    ok('deploying through the muster starts the run', deployed.map === 'flex');
    ok('under what was signed', deployed.signed.join() === 'GLASS' && Math.abs(deployed.banked - 1.3) < 0.01);
    ok('at the difficulty picked before it', deployed.diff === 1.3);

    // ---- and the run-over screen says what the score was earned under ----
    const over = await page.evaluate(() => {
      activeContracts = ['GLASS', 'NO_REGROUPS']; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      runStats = { ...newRunStats(), deepestSector: 3, deepestTier: 4, kills: 20 };
      endRun();
      const text = document.getElementById('runover-lines').innerText;
      activeContracts = [];
      return { text, shown: getComputedStyle(document.getElementById('screen-runover')).display };
    });
    ok('the run-over screen appears', over.shown === 'flex');
    ok('and states the contract bonus', /CONTRACT BONUS/.test(over.text) && /x1\.65/.test(over.text));
    ok('and what was signed for', /GLASS JAW/.test(over.text) && /NO FALLBACK/.test(over.text));

    const plainOver = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      runStats = { ...newRunStats(), deepestSector: 3, deepestTier: 4, kills: 20 };
      endRun();
      return document.getElementById('runover-lines').innerText;
    });
    ok('a run with no contracts says nothing about them', !/CONTRACT BONUS/.test(plainOver));

    // ---- a save from before any of this still loads ----
    const legacy = await page.evaluate(() => {
      const old = { scrap: 100, tier: 3, currentSector: 2, difficultyMult: 1,
        roster: JSON.parse(JSON.stringify(ROSTER_TEMPLATE)), inventory: ['MED_STIM'],
        materials: { parts: 1, chems: 0, tech: 0 }, activeBounties: [], momentum: 0,
        activeRelics: [], runStats: { kills: 5, elites: 0, bosses: 0, scrapEarned: 100, nodes: 4, deepestSector: 2, deepestTier: 3, regroups: 2 },
        combat: null };
      Store.set(BASE_SAVE_KEY + 3, JSON.stringify(old));
      currentSlot = 3; loadGameState();
      return { consequences: pendingConsequences, recent: recentEvents,
               score: computeScore(runStats), mult: runStats.contractMult };
    });
    ok('a save with no consequences loads as none pending', Array.isArray(legacy.consequences) && legacy.consequences.length === 0);
    ok('and no event history', Array.isArray(legacy.recent) && legacy.recent.length === 0);
    ok('its score is unaffected by a multiplier it never had',
      legacy.score > 0 && (legacy.mult === undefined || legacy.mult === 1));
  }
};

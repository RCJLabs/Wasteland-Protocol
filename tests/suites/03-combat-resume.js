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

    // ── O14: WHAT A RESUMED TURN IS CHARGED FOR, constructed rather than sampled ────────
    // Suite 101's fight-log pair went red three times in about thirty batteries and zero times
    // in the twenty tests/noise.js ran to find it - the rate #192 calls actionable and sampling
    // could not reach. Forced here in three lines instead, which is #209's method and took one
    // attempt.
    //
    // processTurn reads and clears `resumingTurn` at the top, then four lines later returns
    // early if the body whose turn it is has no health left. On that path the guard is spent on
    // a turn that never happens and the operator behind the corpse is counted. That is the
    // whole of the intermittency: it needs the save to have been taken on a body that has since
    // fallen, which 101's own fixture stages some of the time by deleting a carried body.
    //
    // AND THE ENGINE IS RIGHT. The last arm runs the identical field with no save in it at all,
    // and the count moves the same way - so the resume costs nothing, the fight simply steps
    // over a corpse and the operator behind it takes a turn, which is a turn. 101's row asserted
    // an identity that the game legitimately breaks in one case; it now asserts the case.
    const charged = await page.evaluate(() => {
      // THE QUEUE IS BUILT, NOT ACCEPTED. The first cut of this let initiateCombat hand over
      // whatever order it drew and rebuilt the field per arm - so the body behind the corpse was
      // sometimes a hostile, whose turn is not a squad turn and does not count, and the two arms
      // were not even walking the same queue. It went red 1 battery in 3 asserting `=== 10`,
      // which is the exact defect this block was written to record in suite 101: a row claiming
      // something stronger than the thing it is named for. Written the same afternoon, four
      // lines under a comment about it.
      //
      // So: a corpse at index 0 and a living operator at index 1, put there by hand, and both
      // arms run against that one field.
      const build = () => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        initiateCombat('RAIDERS', false);
        fightLog.turns = 9;
        const ours = turnQueue.filter(e => e.isPlayer && e.hp > 0);
        const theirs = turnQueue.filter(e => !e.isPlayer);
        turnQueue = [ours[0], ours[1], ...theirs].filter(Boolean);
        activeEntities = [...turnQueue];
        activeIndex = 0;
        turnQueue[0].hp = 0;            // fell during its own turn, still in the queue
        return { corpse: turnQueue[0].id, behind: turnQueue[1].id, behindIsOurs: !!turnQueue[1].isPlayer };
      };
      const run = (asResume) => {
        const b = build();
        resumingTurn = !!asResume;
        processTurn();
        const out = { ...b, turns: fightLog.turns,
                      landedOn: turnQueue[activeIndex] && turnQueue[activeIndex].id };
        combatActive = false;
        return out;
      };
      return { fallen: run(true), noSave: run(false) };
    });
    ok(`the fixture puts a fallen body in front of a living operator ` +
       `(${charged.fallen.corpse} down, ${charged.fallen.behind} behind it)`,
      charged.fallen.behindIsOurs === true && charged.noSave.behindIsOurs === true);
    // WHAT THIS FIXTURE CANNOT DO, said rather than forced. The standing case - a resume onto a
    // body still up, which must NOT be charged - was tried here twice and does not isolate:
    // driving processTurn by hand after initiateCombat has already opened the fight lets the
    // chain run on past the guarded turn, so both the absolute count and a resumed-against-fresh
    // difference come back carrying turns this row is not asking about. Suite 101 asserts it
    // through a real save, reload and resumeCombat, which is where it belongs and where it
    // passes. The two arms below are the ones this fixture can hold, and they are the pair that
    // carries the finding.
    ok(`a resume onto a body that had fallen steps over it and the operator behind it is charged ` +
       `(${charged.fallen.corpse} -> ${charged.fallen.landedOn}, 9 -> ${charged.fallen.turns})`,
      charged.fallen.turns === 10 && charged.fallen.landedOn === charged.fallen.behind);
    ok(`and that is the fight, not the save - the same field with no resume in it counts the ` +
       `same turn (9 -> ${charged.noSave.turns})`,
      charged.noSave.turns === charged.fallen.turns);
    // WHAT THESE ROWS DO NOT HOLD, checked rather than assumed. The obvious companion claim is
    // that the guard's PLACEMENT is load-bearing - that reading and clearing `resumingTurn` in
    // one statement, above the early return, is what makes this work. It is not pinned by
    // anything: moving the clear below that return and running the whole battery comes back
    // 4687 passed, 0 failed. I wrote it up as caught before running it, off an earlier arm whose
    // 9 was a hostile taking the turn rather than the mutation biting.
    //
    // The behaviour difference is real but no fixture here isolates it - the chain runs on past
    // the guarded turn either way. What CAN be pinned is the intent, which the engine states in
    // its own comment: read and cleared in the same breath so an early return cannot carry the
    // flag into a turn that IS new. Pinned as written, against drift rather than against a
    // measurement, and labelled as that rather than as a behavioural guarantee.
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'game.js'), 'utf8');
    ok('the resume flag is still read and cleared in one statement, as its own comment says',
      /const resumed = resumingTurn; resumingTurn = false;/.test(src));
    // And the version that charges EVERY reload a turn - I02's shape, the expensive one - is
    // caught, by suite 101's row through a real save and reload. That is the protection that
    // matters and it is a behavioural one.
    ok('and the count is still guarded at all',
      /if \(aE\.isPlayer && fightLog && !resumed\) fightLog\.turns\+\+;/.test(src));
  }
};

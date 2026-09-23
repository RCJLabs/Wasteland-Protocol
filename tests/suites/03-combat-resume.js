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
      // Y04: SQUAD DOWN is what checkWinState writes on a wipe; 01-boot learned that and this
      // copy of the same walker did not, so a resumed fight that was lost would have run out of passes.
      if (/SQUAD DOWN|FAILED/i.test(deck)) { await page.click('#command-deck button'); outcome = 'wipe'; break; }
      const t = await page.$('.targetable-enemy') || await page.$('.targetable-ally');
      if (t) { await t.click().catch(() => {}); continue; }
      // U01: this asked for the first enabled button whose TEXT was not CANCEL, BACK or BAG -
      // a hand-kept list of the things in a deck that are NOT orders, which is a second
      // definition of "an order" living in a test. It broke the moment a fourth non-order
      // control was added at the head of the deck: the walker pressed it two hundred times
      // and the fight never advanced. Asked structurally instead - an order is a button that
      // carries a move, or a tactic that spends the bar. Both, because the text list admitted
      // tactics and narrowing to moves alone would have quietly changed how this walks a
      // fight: it stops spending momentum, which is a different walk from the one every
      // reading in the record was taken against.
      // Y04: and the skip a stunned operator is left with. On a stunned turn it is the only control
      // the deck offers, and it carries neither a move nor a tactic, so the walker spun on it until
      // it ran out of passes - 5 playthroughs in 20 on the tree before Y04, run alone, and every
      // one caught in the act was a stunned turn. Pressing it is what a player does.
      const ORDERS = '#command-deck button[data-move]:not([disabled]),'
                   + '#command-deck button[data-action="tactic"]:not([disabled]),'
                   + '#command-deck button[data-action="skip-turn"]:not([disabled])';
      for (const b of await page.$$(ORDERS)) {
        const tx = ((await b.textContent()) || '').trim();
        if (tx) { await b.click().catch(() => {}); break; }
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
      const build = (mode) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        initiateCombat('RAIDERS', false);
        fightLog.turns = 9;
        const ours = turnQueue.filter(e => e.isPlayer && e.hp > 0);
        const theirs = turnQueue.filter(e => !e.isPlayer);
        // 'hostile' puts one of theirs behind the corpse instead of one of ours, because a
        // hostile's turn is not a squad turn and the count must not move for it - which 101's
        // row asserts and nothing held until O15.
        turnQueue = mode === 'hostile' ? [ours[0], theirs[0], ours[1], ...theirs.slice(1)].filter(Boolean)
                                       : [ours[0], ours[1], ...theirs].filter(Boolean);
        activeEntities = [...turnQueue];
        activeIndex = 0;
        // 'corpse': fell during its own turn, still in the queue - the case O14 found.
        // 'dies':   up when the fight came back onto it, and killed by its OWN turn-start
        //           tick - the case O14 missed, added by O15. One point of health and a
        //           bleed, because the tick takes 8% of MAXIMUM health and so always lands.
        if (mode === 'corpse' || mode === 'hostile') turnQueue[0].hp = 0;
        if (mode === 'dies') { turnQueue[0].hp = 1; turnQueue[0].bleedingTurns = 3; }
        return { corpse: turnQueue[0].id, behind: turnQueue[1].id, behindIsOurs: !!turnQueue[1].isPlayer };
      };
      const run = (asResume, mode) => {
        const b = build(mode || 'corpse');
        resumingTurn = !!asResume;
        processTurn();
        const body = activeEntities.find(e => e.id === b.corpse);
        const out = { ...b, turns: fightLog.turns,
                      landedOn: turnQueue[activeIndex] && turnQueue[activeIndex].id,
                      hpAfter: body ? body.hp : 'GONE',
                      // The reading suite 101 branched on for one release, kept here so the row
                      // below can show it disagreeing with the queue.
                      liveAfter: activeEntities.some(e => e.id === b.corpse && e.hp > 0) };
        combatActive = false;
        return out;
      };
      return { fallen: run(true), noSave: run(false), diedOnIt: run(true, 'dies'),
               ontoHostile: run(true, 'hostile') };
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
    // ── O15: AND THE THIRD STATE, which O14 did not know was there ─────────────────────
    // O14 closed 101's pair by branching on whether the body the save was taken on was still
    // alive AFTER the resume, and called a dead one "fell before the save, so the fight stepped
    // over it". That is two different states wearing one reading, and the row went red once in
    // three batteries on the second of them:
    //
    //   the fight came back onto it, and it is still up      landed on it       not charged
    //   the fight came back onto it, and its OWN turn-start  landed on it       not charged
    //     tick killed it - 8% of maximum health as bleed
    //   it was already down, so the fight stepped over it    landed on the next   charged
    //
    // The middle row reads as dead afterwards and is not the stepped-over case at all: the
    // guard did its job, the body took the turn it was saved on, and then bled out on it. A
    // health reading taken after the fact cannot tell those two apart. WHERE THE FIGHT LANDED
    // can, and it is what the claim is actually about, so that is what 101 branches on now.
    ok(`a body that dies to its own turn-start tick is still the body the fight came back onto ` +
       `(landed on ${charged.diedOnIt.landedOn}, at ${charged.diedOnIt.hpAfter} health)`,
      charged.diedOnIt.landedOn === charged.diedOnIt.corpse && charged.diedOnIt.hpAfter === 0);
    // AND THE READING THAT COULD NOT TELL THEM APART, shown disagreeing with the queue rather
    // than described. Both of these are "no health left" afterwards; only one of them was
    // stepped over.
    // Each arm against ITS OWN body, not against the other arm's: every arm calls initiateCombat
    // again and gets a fresh draw, so `diedOnIt.landedOn !== fallen.landedOn` was a claim about
    // which ids the two draws happened to deal. It passed when they differed and went red when
    // both dealt p2 - a row depending on a draw, written in the block that exists to record
    // exactly that mistake.
    ok(`which the health reading calls fallen either way (came back onto it: ${charged.diedOnIt.liveAfter}, ` +
       `stepped over: ${charged.fallen.liveAfter})`,
      charged.diedOnIt.liveAfter === false && charged.fallen.liveAfter === false
      && charged.diedOnIt.landedOn === charged.diedOnIt.corpse
      && charged.fallen.landedOn !== charged.fallen.corpse);
    // AND THE FOURTH STATE: stepped over onto a HOSTILE. The +1 above is not "a resume over a
    // corpse costs a turn", it is "the body behind the corpse takes a turn and a squad turn is
    // what fightLog counts". Put one of theirs behind the corpse and the count must not move -
    // which is exactly the defect that made my first cut of the arms above red 1 battery in 3,
    // recorded there, and now held rather than only written down.
    ok(`and stepping over it onto a hostile is not a squad turn (${charged.ontoHostile.corpse} -> ` +
       `${charged.ontoHostile.landedOn}, 9 -> ${charged.ontoHostile.turns})`,
      charged.ontoHostile.behindIsOurs === false && charged.ontoHostile.turns === 9
      && charged.ontoHostile.landedOn === charged.ontoHostile.behind);
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
    // R02 moved the INCREMENT behind noteSquadTurn - one door, so the simulator's own turn walk
    // (I02) reaches the same booking the engine does - and left the GUARD exactly where it was.
    // This pin follows the guard rather than the statement it used to guard, because the guard is
    // what the assertion is about: a version that counts every reload as a turn is still caught.
    // R02 grew the body again - the clock is checked on the same beat, so the turn that runs out
    // is not also taken - and the pin went red for the shape of the statement rather than for
    // anything it guards. Rewritten to test THE GUARD and that noteSquadTurn is what sits behind
    // it, which is what this assertion has always been about; the body is free to grow.
    ok('and the count is still guarded at all',
      /if \(aE\.isPlayer && fightLog && !resumed\)[^\n]*\{?[\s\S]{0,200}?noteSquadTurn\(\);/.test(src));
    ok('and the one door it calls is where the increment now lives',
      /function noteSquadTurn\(\) \{[\s\S]*?fightLog\.turns\+\+;/.test(src));
  }
};

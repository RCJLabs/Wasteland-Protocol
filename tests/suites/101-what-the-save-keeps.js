// E10: four pieces of live run state were in the engine and in neither half of the save, so
// pressing F5 mid-run changed the run.
//
// saveGameState was one object literal and loadGameState was another picking it apart, with
// nothing making the two agree. activeContracts was in neither. Measured through a real reload,
// with DRY RUN, SHORT HANDED and NO FALLBACK signed for:
//
//                          before F5                          after
//   activeContracts        the three                          []
//   totalRegroups()        0                                  2
//   canCarry()             false                              true
//   runStats.contractMult  1.70                               1.70
//
// The handicaps lifted and the score kept charging for them, because newRunStats snapshots
// contractMult() at run start and computeScore multiplies by the snapshot. An F5 was a cheat
// code with a 70% score bonus attached.
//
// The same reload emptied fightLog, so a fight that had already spent an item, taken damage and
// run nine turns came back clean - FLAWLESS, BLITZ and FRUGAL all payable again. It emptied
// vacatedRanks, so an operator lost that fight left a hole closeRanks had nothing to close, and
// the squad walked the rest of the run a rank short. And it dropped momentumFocus, a x1.3 the
// player had already paid momentum for.
//
// The three fight-scoped ones live in COMBAT_STATE now - one table read by both halves, so a
// field cannot be added to one and forgotten by the other - and activeContracts is in the
// payload with a validator in the migrateRelics idiom.
module.exports = {
  name: 'What the save keeps',
  run: async ({ page, ok, base, engineUp, settled }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    // K03: the rows below judge a fight log against the engine's own BLITZ threshold rather
    // than against a number somebody measured once. It is fetched here because ok() runs on
    // the Node side, where the engine's globals do not exist.
    const BLITZ = await page.evaluate(() => BLITZ_TURNS);

    // ── The two halves are one list now ─────────────────────────────────────────────
    const drift = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5;
      initiateCombat('RAIDERS', false);
      const snap = buildCombatSnapshot();
      const keys = COMBAT_STATE.map(f => f.key);
      return { keys, missing: keys.filter(k => !(k in snap)),
               shape: COMBAT_STATE.filter(f => typeof f.get !== 'function' || typeof f.set !== 'function'
                                            || typeof f.load !== 'function').map(f => f.key),
               dupes: keys.length !== new Set(keys).size };
    });
    ok(`the snapshot writes every field the table declares (${drift.keys.length})`,
      drift.missing.length === 0 && !drift.dupes);
    ok(`and every one of them can be read, written and validated (${drift.shape.join(', ') || 'all three each'})`,
      drift.shape.length === 0);

    // Both halves read the same table, so a renamed key stays consistent and a drift check on
    // the names proves nothing. What is worth proving is that each entry is a closed loop: put a
    // distinctive value in, snapshot it, wipe the global, restore, and get the value back. That
    // catches a get and a set pointing at different things, or a load quietly discarding data
    // that was perfectly valid.
    const loop = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5;
      initiateCombat('RAIDERS', false);
      const probes = {
        nodeType: 'RAIDERS', isElite: true, weather: 'ASHFALL', terrain: 'TUNNELS',
        formation: null, bgFile: 'bg_highway.webp', bondSaves: ['p1|p2'],
        fightLog: { turns: 7, hurt: true, spent: true, chased: true },
        vacated: [2], focus: 1, press: true, pressed: 25
      };
      const broken = [];
      COMBAT_STATE.forEach(f => {
        if (!(f.key in probes)) { broken.push(`${f.key}: no probe written for it`); return; }
        f.set(probes[f.key]);
        const snap = JSON.parse(JSON.stringify(f.get() === undefined ? null : f.get()));
        f.set(f.load(undefined));
        f.set(f.load(snap));
        const back = JSON.stringify(f.get());
        if (back !== JSON.stringify(probes[f.key])) broken.push(`${f.key}: ${back} not ${JSON.stringify(probes[f.key])}`);
      });
      return { broken, count: COMBAT_STATE.length };
    });
    ok(`all ${loop.count} round-trip through get, snapshot, load and set (${loop.broken.join('; ') || 'clean'})`,
      loop.broken.length === 0);

    // ── Every field survives a real reload, not a simulated one ────────────────────
    await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      openContracts(1.0);
      toggleContract('SHORT_HANDED'); toggleContract('NO_REGROUPS'); toggleContract('NO_CONSUMABLES');
      beginExpedition();
      sectorFront = null; currentSector = 2; currentTier = 5;
      initiateCombat('RAIDERS', false);
    });
    // K06: THE ROW BELOW WAS RIGHT AND THE ENGINE WAS WRONG, and this is how the difference was
    // found. `turns` came back one higher than it went in, about one battery in ten, and the
    // rate was the tell: whether it happened depended on WHOSE TURN the save was taken on.
    // resumeCombat finishes by calling processTurn to put the field back up, and processTurn
    // counts a squad turn - so coming back on a player's turn counted that turn a second time,
    // and coming back on an enemy's did not. A reload cost the player a turn against BLITZ.
    // Fixed in the engine, and this suite now catches it every time rather than sometimes,
    // because the save is deliberately taken on a stopped clock.
    //
    // Which the probe needs anyway: processTurn also calls saveGameState(), and it is reached
    // through a setTimeout(nextTurn) chain, so a turn still queued when an evaluate returns
    // fires after it and REWRITES the save underneath the probe. loseOperator is the same thing
    // from the other end - taking the active body out of the queue schedules the next turn. On a
    // PLAYER's turn processTurn returns without scheduling anything, so the chain has terminated:
    // a real condition rather than a wait. It is asked for twice, once to reach a stopped clock
    // and again after the operator falls.
    const clockStopped = () => combatActive && turnQueue[activeIndex] && turnQueue[activeIndex].isPlayer;
    await settled(page, clockStopped, 'the fight to reach a player turn, where its clock stops');
    await page.evaluate(() => {
      const victim = activeEntities.find(e => e.isPlayer && e.gridPos > 0);
      loseOperator(victim, 'COMBAT');
    });
    await settled(page, clockStopped, 'the clock to stop again after the operator falls');
    // K09: the save and the read-back are ONE evaluate. They used to be two, and the gap between
    // them is a round trip to the browser - which is exactly the window the note above says a
    // queued nextTurn fires in. When it did, the turn ended the fight and saveGameState() wrote a
    // post-combat state over the probe's, so the reload came back with no fight to resume and
    // `the fight comes back up at all` went red - about one battery in three once K08 made the
    // sky weaker and fights a turn longer. Nothing awaits between writing the save and reading
    // what was written now, so there is no window to lose it in.
    const was = await page.evaluate(() => {
      fightLog.turns = 9; fightLog.hurt = true; fightLog.spent = true; fightLog.chased = true;
      momentumFocus = 1; pressExtra = true;
      const snap = { contracts: [...activeContracts], regroups: totalRegroups(), carry: canCarry(),
                     mult: runStats.contractMult, vacated: [...vacatedRanks], bg: combatBgFile,
                     // K03: the fight log as it stood BEFORE the save, so the row below can
                     // assert the count came back unchanged rather than that it came back
                     // above a number somebody once measured it at.
                     log: fightLog ? { ...fightLog } : null,
                     names: contractNames() };
      saveGameState();
      // And the save itself, carried out of the page as a string. buildCombatSnapshot returns
      // null when the fight is not live and a queue to resume when it is, so a snapshot with
      // bodies in its queue is the condition - checked here, and then the exact bytes are put
      // back after the reload. Closing the gap between saving and reading was not enough on its
      // own: there is a second gap between reading and page.reload(), and a queued nextTurn
      // firing in THAT one ends the fight and writes a post-combat save over the probe's, so the
      // reload came back with nothing to resume. What this suite is for is the load path, so the
      // save under test is pinned rather than raced for.
      snap.saved = Store.get(BASE_SAVE_KEY + currentSlot) || '';
      const raw = JSON.parse(snap.saved || '{}');
      snap.savedLive = !!(raw.combat && (raw.combat.queueIds || []).length > 0);
      // M08b/#193: who is standing on the line, and who the save says is. loseOperator takes
      // the fallen off playerRoster and LEAVES THE BODY ON THE FIELD - yoursDown says so and
      // renderField draws it 'dead settled' - so the snapshot names somebody no roster can hand
      // back. Six saves in six, before this was fixed: combat.playerIds said [p1,p2] while the
      // save's own roster held [p2..p7], and the corpse was gone after a reload.
      snap.field = activeEntities.filter(e => e.isPlayer).map(e => e.id);
      snap.rosterIds = playerRoster.map(c => c.id);
      snap.orphans = snap.field.filter(id => !snap.rosterIds.includes(id));
      snap.carried = ((raw.combat && raw.combat.fallen) || []).map(f => f.id);
      return snap;
    });
    ok('the save the probe took has a live fight in it', was.savedLive === true);
    await page.reload();
    await engineUp(page);
    const now = await page.evaluate(saved => {
      currentSlot = 1;
      Store.set(BASE_SAVE_KEY + currentSlot, saved);   // the save under test, not whatever raced it
      // O14: WHO the save was taken on, read off the save itself rather than off the resumed
      // field, because the question the turn-count rows below ask is whether the fight came back
      // onto that body or had to step over it.
      const rawC = (JSON.parse(saved || '{}').combat) || {};
      const savedOn = (rawC.queueIds || [])[rawC.activeIndex || 0] || null;
      loadGameState();
      if (pendingCombat) resumeCombat(pendingCombat);
      return { savedOn,
               // O15: WHERE THE FIGHT LANDED, which is the thing the turn-count row below is
               // actually about. O14 read the saved body's health instead and it does not
               // separate the cases - see the comment on that row.
               landedOn: turnQueue[activeIndex] ? turnQueue[activeIndex].id : null,
               landedPlayer: turnQueue[activeIndex] ? !!turnQueue[activeIndex].isPlayer : null,
               contracts: [...activeContracts], regroups: totalRegroups(), carry: canCarry(),
               mult: runStats.contractMult, names: contractNames(),
               log: fightLog ? { ...fightLog } : null, vacated: [...vacatedRanks],
               focus: momentumFocus, press: pressExtra, bg: combatBgFile, resumed: combatActive,
               // M08b carried these so the row below could SAY WHY when it went red, and its
               // reading of resumeCombat was right: combatActive is left alone on exactly one
               // path (an empty turnQueue, which renders the map instead) and set true on the
               // other before calling processTurn, WHICH CAN END THE FIGHT. #209 confirmed that
               // second half by construction, on the sister row below rather than on this one -
               // put its last standing operator on 1 hp and it goes red 1 run in 8, reading "no
               // throw" with the queue four deep and the screen still on combat. So the flake
               // was never a failure to come back; it was a fight that came back and was lost on
               // the turn it came back on. This row resumes with the carried body still in the
               // save and so has one or two operators up rather than one - less exposed to the
               // same thing, not immune to it, which is why it takes the same fix.
               //
               // screen: currentScreen was printing `undefined` - currentScreen is a FUNCTION,
               // and JSON.stringify drops it. A diagnostic that has been live since M08b and
               // never once printed the field it was added for.
               why: { pending: !!pendingCombat, queue: turnQueue.length, screen: currentScreen(),
                      standing: activeEntities.filter(e => e.hp > 0).length,
                      oursUp: activeEntities.filter(e => e.isPlayer && e.hp > 0).length,
                      foesUp: activeEntities.filter(e => !e.isPlayer && e.hp > 0).length },
               field: activeEntities.filter(e => e.isPlayer).map(e => e.id),
               rosterIds: playerRoster.map(c => c.id) };
    }, was.saved);
    // ASSERT WHAT IT MEANS. "The fight comes back up" is turnQueue resolving non-empty - that is
    // the one thing resumeCombat's early return does not do, and it is what this row exists to
    // catch. combatActive was a proxy for it and a leaky one, because a resumed fight that ends on
    // its own first turn is a fight that came back. Measured over eleven instrumented runs: the
    // queue resolves 3-5 deep every time, and empty only when forced, so the discriminator is
    // sharp.
    //
    // The wipe clause is the game's own rule, not an escape hatch. If a side is down, combatActive
    // being false is the correct state, and the alternative is a test that demands the engine
    // leave a finished fight running. Both sides, because a resumed turn can as easily kill the
    // last hostile; that direction is not observed, it is the same code path.
    //
    // queue > 0 is EXACT for the real code, not approximate: the bail is `if (turnQueue.length ===
    // 0) { renderMap(); return; }` and turnQueue is assigned above it, so a non-empty queue means
    // the bail was not taken. The screen is carried as well because it is the bail's only other
    // signature, and it catches a second early return if anyone adds one below the first - stated
    // as "not the map" rather than "the combat screen", so it does not also demand that a fight
    // which ended on its resumed turn still be showing the field when we look.
    const back = (w, resumed) => w.queue > 0 && w.screen !== 'screen-map'
                                 && (resumed === true || w.oursUp === 0 || w.foesUp === 0);
    ok(`the fight comes back up at all${now.resumed ? '' : ` (queue ${now.why.queue}, ${
        now.why.standing} standing, ${now.why.oursUp} of ours against ${now.why.foesUp}, on ${
        now.why.screen}, pendingCombat ${now.why.pending})`}`,
      back(now.why, now.resumed));
    // ── #193: the body the roster cannot hand back ──────────────────────────────
    // A fallen operator is off playerRoster by design and on the field by design, which makes
    // them the one thing a snapshot cannot restore by id alone. Carried whole instead, the way
    // `enemies` already are and for the same reason.
    ok(`the save names ${was.orphans.length} operator(s) its own roster no longer holds (${was.orphans.join(', ') || 'none'})`,
      was.orphans.length === 1);
    ok(`and carries the body rather than only the id (${was.carried.join(', ') || 'none'})`,
      JSON.stringify(was.carried) === JSON.stringify(was.orphans));
    // THE ROW THAT WOULD CATCH THE REGRESSION. Before the fix this came back one short and
    // nothing said so - resumeCombat's .filter(Boolean) drops what it cannot resolve in silence.
    ok(`so the line comes back whole, in the order it went down in (${was.field.join(',')} -> ${now.field.join(',')})`,
      JSON.stringify(now.field) === JSON.stringify(was.field));
    ok('with the fallen still off the roster, which is where the dead belong',
      !now.rosterIds.includes(was.orphans[0]) && now.field.includes(was.orphans[0]));
    // And a save written before the field existed. The comment on buildCombatSnapshot claims
    // this is the migrateRelics idiom, so it is exercised rather than asserted: the key is cut
    // out of the bytes and the load has to come back with a fight rather than a throw. It loses
    // the corpse, which is the behaviour every save on disk already has.
    // #209. THIS ROW WENT RED TWICE UNDER A FULL BATTERY and never once in isolation - 19 of 19
    // and then 20 of 20 across the N-sweep, against two sightings in about thirty batteries.
    // Both times the message read "no throw", so the half that failed was `resumed`.
    //
    // IT IS NOT THE setTimeout(nextTurn) RACE this file describes sixty lines up. That one is
    // real and it is why a save and its read-back share one evaluate - but it cannot be this:
    // the load, the resume and the read of combatActive below are a single SYNCHRONOUS evaluate
    // and a queued turn cannot fire inside one. The N-sweep's record attributed this row to that
    // race and was wrong to.
    //
    // The cause, established by construction rather than waited for: resumeCombat ends with
    // processTurn(), which runs the resumed turn INSIDE the same synchronous call. Put the last
    // standing operator on 1 hp and a hostile's resumed turn kills them, the squad is wiped, and
    // combatActive is false before the evaluate returns - 1 run in 8, reading "no throw", queue
    // four deep, screen still on combat. Which is the failure exactly as it was seen.
    //
    // And the fixture sits right on that edge already. Over three unforced runs p2 - the only
    // operator still up once the carried body is deleted - loaded at 0, 50 and 70 hp. It arrives
    // ALREADY DEAD one run in three. A squad of one at arbitrary health, taking a hostile's turn
    // the moment it resumes, is not a stable thing to demand stay standing.
    //
    // So the same fix as the row sixty lines up, for the same reason: assert that the fight came
    // back, which is the queue resolving, and let combatActive be what it is.
    const older = await page.evaluate(saved => {
      const blob = JSON.parse(saved);
      delete blob.combat.fallen;
      currentSlot = 1;
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(blob));
      let threw = null, hadPending = null;
      const why = { pending: false, queue: 0, screen: null, oursUp: 0, foesUp: 0 };
      try {
        loadGameState();
        hadPending = !!pendingCombat;
        if (pendingCombat) resumeCombat(pendingCombat);
        // Read AFTER the resume, because the resolved queue is the thing: queueIds is what the
        // save asked for, turnQueue is what resolved, and deleting `fallen` above is precisely
        // what makes those two differ. currentScreen is a function - called, not referenced.
        why.pending = !!pendingCombat; why.queue = turnQueue.length; why.screen = currentScreen();
        why.oursUp = activeEntities.filter(e => e.isPlayer && e.hp > 0).length;
        why.foesUp = activeEntities.filter(e => !e.isPlayer && e.hp > 0).length;
      } catch (e) { threw = e.message; }
      return { threw, resumed: combatActive, hadPending, why,
               field: activeEntities.filter(e => e.isPlayer).map(e => e.id) };
    }, was.saved);
    ok(`a save from before the body was carried still loads (${older.threw || 'no throw'}`
       + (older.resumed ? '' : `, ended on resume: ${older.why.queue} queued, ${older.why.oursUp}`
          + ` up against ${older.why.foesUp}, on ${older.why.screen}`) + ')',
      older.threw === null && older.hadPending === true && back(older.why, older.resumed));
    ok(`and comes back one short, the way it always did (${older.field.join(',')})`,
      older.field.length === was.field.length - 1 && !older.field.includes(was.orphans[0]));
    ok(`the handicaps signed for are still signed for (${now.contracts.join(', ')})`,
      JSON.stringify(now.contracts) === JSON.stringify(was.contracts) && was.contracts.length === 3);
    ok(`so NO FALLBACK still means no fallback (${was.regroups} -> ${now.regroups})`,
      now.regroups === 0 && was.regroups === 0);
    ok(`and DRY RUN still means an empty bag (${was.carry} -> ${now.carry})`,
      now.carry === false && was.carry === false);
    ok(`with the score charging for what is actually being carried (x${now.mult})`,
      now.mult === was.mult && now.mult > 1 && now.names.length === was.names.length);
    // K03: `turns >= 9` sat 0.4 sd above a measurement of 9.15 +/- 0.37 - the tightest row in
    // the whole battery, and a floor set on the MEDIAN of the thing it judges. 9 is where the
    // engine's own note says a fight lands; what the claim needs is only that the fight ran long
    // enough to have lost BLITZ, which the engine names. Read off BLITZ_TURNS, and paired with
    // the identity that actually matters here: the count came back from the save unchanged.
    // O14: the three flags are the claim; the turn count is the sister row below, which owns the
    // one case where it legitimately moves. Asserting the count here too made this row fire for
    // a reason that has nothing to do with what it is named for.
    ok(`a fight that lost FLAWLESS, BLITZ and FRUGAL has still lost them (${JSON.stringify(now.log)})`,
      now.log && now.log.hurt === true && now.log.spent === true && now.log.chased === true
      && now.log.turns > BLITZ);
    // K08: this row read `now.log.turns === 9 && was.log.turns === 9`, and 9 is the MEDIAN of the
    // quantity it judges - K03 measured this exact fight at 9.15 +/- 0.37 and called it the
    // tightest row in the battery. It went red the moment the sky started meeting resistances,
    // because a weaker sky makes the same fight a turn longer; it would have gone red on any
    // other change with the same effect, and it was one battery in ten from red already. What
    // the row is FOR is that resuming did not add a turn, which is a before-and-after on one
    // fight and needs no literal at all. The count is still printed, so a phase that moves it a
    // long way is still visible to anybody reading the line.
    // O14: AND THE IDENTITY WAS TOO STRONG BY EXACTLY ONE CASE, which is why this pair went red
    // three times in about thirty batteries and zero times in the twenty tests/noise.js ran to
    // find it. processTurn reads and clears `resumingTurn` at the top, and four lines later
    // returns early if the body whose turn it is has no health left - so on that path the guard
    // is spent on a turn that never happens, and the next operator's turn is counted. The
    // guard's own comment says it is cleared early so "an early return below cannot carry it
    // into a turn that IS new", and that is exactly right: the next operator's turn IS new.
    //
    // THE ENGINE IS NOT WRONG AND THE ROW WAS. Run the identical field with no save anywhere -
    // same dead body at the same index, straight into processTurn - and the count goes 9 -> 10
    // as well. The resume costs nothing; the fight simply steps over a corpse and the operator
    // behind it takes a turn, which is a turn.
    //
    // O15: AND O14's REPLACEMENT WAS TOO STRONG BY ONE CASE OF ITS OWN, in the same shape. It
    // branched on whether the saved body still had health after the resume and read a dead one
    // as "fell before the save, so the fight stepped over it" - and that reading covers TWO
    // states, one of which is the opposite of what it says. Red again, once in three batteries,
    // on `9 -> 9, saved on p2 which had fallen ... landed on p2`. Forced in suite 03 rather
    // than sampled, because 40 runs of this suite staged the case twice:
    //
    //   the fight came back onto it, still up          landed on it    9 ->  9
    //   the fight came back onto it and its OWN        landed on it    9 ->  9
    //     turn-start tick killed it (8% of max as bleed)
    //   it was already down and the fight stepped      landed on the   9 -> 10
    //     over it onto a squad operator                  next body
    //   ... and stepped over onto a HOSTILE            landed on the   9 ->  9
    //                                                    next body
    //
    // The second row is the one that reads as fallen and was never stepped over: the guard did
    // its job, the body took the turn it was saved on, and then bled out on it. A health
    // reading taken after the fact cannot tell it from the third. WHERE THE FIGHT LANDED can,
    // and it is what this row is named for, so that is what it branches on. Charged exactly
    // when the fight stepped over the saved body onto a squad operator - a hostile's turn is
    // not a squad turn. All four states are held by construction in suite 03.
    const stepped = now.landedOn !== now.savedOn;
    ok(`and resuming did not charge the fight for the turn it came back on ` +
       `(${was.log.turns} -> ${now.log.turns}, saved on ${now.savedOn}, ` +
       `${stepped ? `stepped over it onto ${now.landedOn}${now.landedPlayer ? '' : ', a hostile'}`
                  : 'came back onto it'})`,
      was.log.turns > BLITZ
      && now.log.turns === was.log.turns + (stepped && now.landedPlayer ? 1 : 0));
    ok(`the rank a fallen operator left is still a rank to close (${JSON.stringify(now.vacated)})`,
      JSON.stringify(now.vacated) === JSON.stringify(was.vacated) && was.vacated.length === 1);
    ok('and the momentum already spent on FOCUS and PRESS is still spent on them',
      now.focus === 1 && now.press === true);
    ok(`the fight's own background comes back with it (${now.bg})`, now.bg === was.bg);

    // ── The rank actually closes, which is what vacatedRanks is for ────────────────
    const closed = await page.evaluate(() => {
      const gap = vacatedRanks[0];
      const filled = closeRanks();
      return { gap, filled, standing: playerRoster.some(c => c.gridPos === gap) };
    });
    ok(`closeRanks steps somebody into the gap after the reload (${closed.filled.join(', ') || 'nobody'})`,
      closed.filled.length === 1 && closed.standing === true);

    // ── An old save has none of this, and must not fall over ─────────────────────
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    const old = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5;
      initiateCombat('RAIDERS', false);
      saveGameState();
      // Strip the phase's fields the way a save written before it would be, and put a couple of
      // ids in that no longer resolve while we are here.
      const raw = Store.getJSON(BASE_SAVE_KEY + currentSlot);
      delete raw.activeContracts;
      COMBAT_STATE.forEach(f => { if (raw.combat) delete raw.combat[f.key]; });
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw));
      let threw = null;
      try { loadGameState(); if (pendingCombat) resumeCombat(pendingCombat); }
      catch (e) { threw = e.message; }
      return { threw, contracts: [...activeContracts], log: fightLog ? { ...fightLog } : null,
               vacated: [...vacatedRanks], focus: momentumFocus, press: pressExtra,
               weather: currentWeather, terrain: currentTerrain, bg: combatBgFile };
    });
    ok(`a save from before this phase loads without throwing (${old.threw || 'no throw'})`, old.threw === null);
    // resumeCombat ends in processTurn, which counts the turn it is resuming into when it is a
    // player's - so a rebuilt log reads 0 or 1 depending on whose turn the fight was saved on,
    // and pinning it to 0 is a coin flip on the speed roll rather than an assertion.
    // K03: this read `turns <= 1` on a value the sweep measured at 0.06 +/- 0.25 - it comes back 0
    // or 1 depending on whether the resume has taken a turn yet, and a 2 would fire it. What a
    // fresh log means is that it has not run long enough to lose anything, which BLITZ_TURNS
    // names. The note lives above the call rather than inside it: a bound written in prose
    // inside an ok() is a bound tests/noise.js will read back as real.
    ok(`and lands on what a fresh fight would have, rather than on undefined (turns ${old.log && old.log.turns})`,
      old.contracts.length === 0 && old.log !== null && old.log.turns >= 0
      && old.log.turns < BLITZ && old.log.hurt === false
      && old.vacated.length === 0 && old.focus === 0 && old.press === false);
    ok(`with the scene falling back rather than blanking (${old.weather} / ${old.terrain} / ${old.bg})`,
      old.weather === 'CLEAR' && old.terrain === 'OPEN_ROAD' && old.bg === 'bg_combat.webp');

    // ── And nothing tampered with is trusted ────────────────────────────────────
    const junk = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5;
      initiateCombat('RAIDERS', false);
      saveGameState();
      const raw = Store.getJSON(BASE_SAVE_KEY + currentSlot);
      raw.activeContracts = ['SHORT_HANDED', 'A_CONTRACT_THAT_NEVER_WAS', 42, null];
      raw.combat.vacated = [1, 9, -3, 'two'];
      raw.combat.terrain = 'NOWHERE';
      raw.combat.weather = 'SUNSHOWER';
      raw.combat.focus = 99;
      raw.combat.fightLog = { turns: -5, hurt: 'yes' };
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw));
      loadGameState(); if (pendingCombat) resumeCombat(pendingCombat);
      return { contracts: [...activeContracts], vacated: [...vacatedRanks], terrain: currentTerrain,
               weather: currentWeather, focus: momentumFocus, log: { ...fightLog } };
    });
    ok(`a contract id that no longer resolves is dropped, not carried (${junk.contracts.join(', ')})`,
      junk.contracts.length === 1 && junk.contracts[0] === 'SHORT_HANDED');
    ok(`a rank off the board is dropped too (${JSON.stringify(junk.vacated)})`,
      JSON.stringify(junk.vacated) === '[1]');
    ok(`ground and weather that do not exist fall back (${junk.terrain} / ${junk.weather})`,
      junk.terrain === 'OPEN_ROAD' && junk.weather === 'CLEAR');
    ok(`and a tampered focus is clamped rather than believed (${junk.focus})`, junk.focus === 1);
    // K03: same shape, and here the tampered value is the point - the save said turns: -5. What
    // is being claimed is that the rebuild REFUSED it, not that the fresh fight is exactly one
    // turn old. A non-negative count still inside a fresh fight says both, with room to say it.
    ok(`a half-written fight log is rebuilt whole (${JSON.stringify(junk.log)})`,
      junk.log.turns >= 0 && junk.log.turns < BLITZ
      && junk.log.hurt === true && junk.log.spent === false && junk.log.chased === false);
  }
};

// S01: the deadline is fight-scoped state, so the save has to carry it.
//
// R02 shipped the clock two commits before this suite and put nothing in COMBAT_STATE. fightLog
// is in there - E10 put it there - so a reload brought back the turn count and left pressedAt at
// its module default of 0. The squad kept every turn it had already spent and lost the limit
// those turns were counting against, and pressedOut can never fire again in that fight.
//
// Measured by construction on a staged save at turn 18 of a 25-turn fight, through the real
// resume path rather than loadGameState alone (which leaves the fight dead):
//     before {clock:25, turns:18, left:7}   after {clock:0, turns:18, left:0, live:true}
//
// The fix is one COMBAT_STATE entry. This suite holds the pair that made it an exploit - the
// clock coming back AND the turn count coming back with it - plus the two edges the entry's
// load() claims: a save written before the field existed, and a fight that never had a clock.
module.exports = {
  name: 'A clock that survives a reload',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── STAGE A CLOCKED FIGHT ────────────────────────────────────────────────────────────
    // The node is found by asking pressedFor rather than by forcing pressedAt, so the clock
    // under test is the one the engine sets for itself at the bell.
    const before = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      let picked = null;
      for (let i = 0; i < 400 && !picked; i++) {
        const id = 'n' + i;
        if (pressedFor(id, 'RAIDERS') > 0) picked = id;
      }
      currentNodeId = picked;
      initiateCombat('RAIDERS', false);
      // Counted UP TO a mark rather than incremented a fixed number of times: the bell opens
      // the first turn itself (I02), so eighteen calls land on nineteen.
      while (fightLog.turns < pressedAt - 7) noteSquadTurn();
      saveGameState();
      const blob = JSON.parse(localStorage.getItem(BASE_SAVE_KEY + currentSlot) || '{}');
      return { node: picked, clock: pressedAt, turns: fightLog.turns, left: pressedLeft(),
               fromNode: pressedFor(picked, 'RAIDERS'),
               saved: blob.combat ? blob.combat.pressed : undefined,
               savedTurns: blob.combat && blob.combat.fightLog ? blob.combat.fightLog.turns : undefined };
    });
    ok('some road node carries a clock', !!before.node);
    ok(`the bell set it off the node (${before.clock} turns)`,
      before.clock > 18 && before.clock === before.fromNode);
    ok(`the fight is most of the way through its clock (${before.turns} turns)`,
      before.turns === before.clock - 7);
    ok(`and there are turns left to lose (${before.left})`, before.left === 7);
    ok(`the snapshot carries the deadline (${before.saved})`, before.saved === before.clock);
    ok(`and the turn count beside it (${before.savedTurns})`, before.savedTurns === before.turns);

    await page.reload();
    await engineUp(page);
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(700);

    const after = await page.evaluate(() => ({
      live: combatActive, clock: pressedAt, turns: fightLog ? fightLog.turns : -1,
      left: pressedLeft(),
      banner: (document.getElementById('clock-banner') || {}).innerText || '',
      shown: (document.getElementById('clock-banner') || {}).style ?
             document.getElementById('clock-banner').style.display : ''
    }));
    ok('the reload drops back into the clocked fight', after.live);
    // THE PIN. This read 0 before the COMBAT_STATE entry existed.
    ok(`the deadline came back with it (${after.clock})`, after.clock === before.clock);
    ok(`so did the turns already spent (${after.turns})`, after.turns >= before.turns);
    ok(`and the fight is still against a live deadline (${after.left} left)`,
      after.left > 0 && after.left === after.clock - after.turns);
    ok(`the banner is drawn and counting (${JSON.stringify(after.banner)})`,
      after.shown === 'block' && after.banner.includes(`${after.left} TURN`));

    // ── THE DEADLINE IS STILL ENFORCEABLE AFTER THE RESUME ───────────────────────────────
    // Coming back with the number is not the same as coming back able to use it: pressedOut
    // reads pressedAt, fightLog and combatActive, and all three have to be live on the far side.
    const fires = await page.evaluate(() => {
      const at = pressedAt;
      while (fightLog.turns < at) noteSquadTurn();
      const out = pressedOut();
      return { out, live: combatActive, ran: (runStats || {}).pressedOut || 0 };
    });
    ok('the clock can still run out on a resumed fight', fires.out === true);
    ok('and running out ends the fight', !fires.live);
    ok('the run books it', fires.ran >= 1);

    // ── A SAVE WRITTEN BEFORE THE FIELD EXISTED ──────────────────────────────────────────
    // load() claims such a save resumes with no clock rather than a NaN one. Staged by
    // deleting the key from a real save, which is exactly what an old save looks like.
    await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      let picked = null;
      for (let i = 0; i < 400 && !picked; i++) { const id = 'n' + i; if (pressedFor(id, 'RAIDERS') > 0) picked = id; }
      currentNodeId = picked;
      initiateCombat('RAIDERS', false);
      noteSquadTurn(); noteSquadTurn();
      saveGameState();
      const blob = JSON.parse(localStorage.getItem(BASE_SAVE_KEY + currentSlot));
      delete blob.combat.pressed;
      localStorage.setItem(BASE_SAVE_KEY + currentSlot, JSON.stringify(blob));
    });
    await page.reload();
    await engineUp(page);
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(700);
    const old = await page.evaluate(() => ({
      live: combatActive, clock: pressedAt, left: pressedLeft(),
      shown: document.getElementById('clock-banner').style.display, out: pressedOut()
    }));
    ok('a save from before the field still resumes its fight', old.live);
    ok(`it resumes without a clock rather than a broken one (${old.clock})`,
      old.clock === 0 && old.left === 0);
    ok('no banner is drawn for a clock it has not got', old.shown === 'none');
    ok('and nothing can time it out', old.out === false);

    // ── A FIGHT THAT NEVER HAD ONE DOES NOT GET ONE BACK ─────────────────────────────────
    // The mirror of the pin: the entry must not invent a deadline where the bell set none.
    await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      let picked = null;
      for (let i = 0; i < 400 && !picked; i++) { const id = 'n' + i; if (pressedFor(id, 'RAIDERS') === 0) picked = id; }
      currentNodeId = picked;
      initiateCombat('RAIDERS', false);
      noteSquadTurn(); noteSquadTurn(); noteSquadTurn();
      saveGameState();
    });
    const clean = await page.evaluate(() =>
      JSON.parse(localStorage.getItem(BASE_SAVE_KEY + currentSlot)).combat.pressed);
    ok(`an unclocked fight saves a zero, not an absence (${clean})`, clean === 0);
    await page.reload();
    await engineUp(page);
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(700);
    const none = await page.evaluate(() => ({
      live: combatActive, clock: pressedAt, turns: fightLog ? fightLog.turns : -1,
      shown: document.getElementById('clock-banner').style.display
    }));
    ok('it comes back unclocked', none.live && none.clock === 0);
    ok('with its turns intact all the same', none.turns >= 3);
    ok('and no banner', none.shown === 'none');

    // ── THE ENTRY IS IN THE TABLE, NOT BOLTED TO resumeCombat ────────────────────────────
    // F02's rule for this shape of state: one table, read by both the writer and the reader.
    const wired = await page.evaluate(() => {
      const e = COMBAT_STATE.find(f => f.key === 'pressed');
      if (!e) return { found: false };
      return { found: true,
               reads: e.get() === pressedAt,
               floors: e.load(-4) === 0 && e.load('25') === 0 && e.load(undefined) === 0 && e.load(NaN) === 0,
               keeps: e.load(25) === 25 && e.load(25.9) === 25,
               distinct: COMBAT_STATE.filter(f => f.key === 'pressed').length === 1 &&
                         COMBAT_STATE.some(f => f.key === 'press') };
    });
    ok('the deadline is a COMBAT_STATE field like the rest', wired.found && wired.reads);
    ok('junk and negatives load as no clock', wired.floors);
    ok('a real deadline loads whole', wired.keeps);
    ok("and it did not collide with pressExtra's key", wired.distinct);

    await page.evaluate(() => { pressedAt = 0; });
  }
};

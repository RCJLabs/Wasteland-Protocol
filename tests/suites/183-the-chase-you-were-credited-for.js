// S02: the chase flag was stamped on the wrong fight, by exactly one fight.
//
// TURN AND BREAK N CHASES asks the squad to win the fight the runners caught them in. The flag
// behind it was relayed through a module-level `chasedIn`: the chase placement set it near the
// bottom of initiateCombat, and `fightLog.chased = chasedIn` read it back near the TOP of the
// same function - twenty-five lines earlier, which means one fight earlier. Every fight carried
// the previous fight's answer.
//
// Measured by construction across three fights before the fix. Fight B had two chasers standing
// on the field and logged chased:false; fight C had none and logged chased:true:
//     {aChased:false, bChased:false, bChasersOnField:2, cChased:true, cChasersOnField:0}
// After: {bChased:true, bChasersOnField:2, cChased:false, cChasersOnField:0}
//
// So the bounty credited a fight nobody was chased into, and a chase that ended the run - an
// extraction, or a wipe - was never credited at all, because the relay had nowhere to hand it.
// The flag now lives on the fightLog it describes, which also puts it inside COMBAT_STATE: a
// reload mid-chase used to drop it, and no longer does.
module.exports = {
  name: 'The chase you were credited for',
  run: async ({ page, ok, base, engineUp, settled }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── THE STAMP LANDS ON THE FIGHT THE CHASERS ARE IN ──────────────────────────────────
    // Walked through the engine's own exit rather than by assigning pursuit, so the chase under
    // test is the one a withdrawal actually leaves behind.
    const walk = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0);
      sectorFront = null; currentSector = 3;
      const out = {};
      currentNodeId = 'nA'; initiateCombat('RAIDERS', false);
      out.a = { chased: fightLog.chased, on: activeEntities.filter(e => /^chase_/.test(e.id)).length };
      forceBreakContact();
      out.pursuit = pursuit && pursuit.units ? pursuit.units.length : 0;
      currentNodeId = 'nB'; initiateCombat('RAIDERS', false);
      out.b = { chased: fightLog.chased, on: activeEntities.filter(e => /^chase_/.test(e.id)).length };
      currentNodeId = 'nC'; initiateCombat('RAIDERS', false);
      out.c = { chased: fightLog.chased, on: activeEntities.filter(e => /^chase_/.test(e.id)).length };
      return out;
    });
    ok('a fight nobody has been chased into opens unchased',
      walk.a.chased === false && walk.a.on === 0);
    ok(`breaking contact leaves runners behind (${walk.pursuit})`, walk.pursuit > 0);
    // THE PIN. This read false before the stamp moved to the placement site.
    ok(`the fight the chasers arrive in is the one flagged (${walk.b.on} on the field)`,
      walk.b.chased === true && walk.b.on === walk.pursuit);
    // THE OTHER HALF OF THE PIN. This read true.
    ok('and the fight after it is not flagged for their chase',
      walk.c.chased === false && walk.c.on === 0);

    // ── AND THE BOUNTY CREDITS THAT FIGHT ────────────────────────────────────────────────
    // End to end through checkBountyProgress, because the stamp is only worth what it pays.
    const paid = await page.evaluate(() => {
      const board = () => { activeBounties = [{ type: 'CHASED', desc: 'CHASED', current: 0,
        target: 9, reward: 1, claimed: false }]; };
      const read = () => activeBounties[0].current;
      const out = {};
      board();
      currentNodeId = 'mA'; initiateCombat('RAIDERS', false);
      noteFightWon(); out.unchased = read();
      forceBreakContact();
      currentNodeId = 'mB'; initiateCombat('RAIDERS', false);
      noteFightWon(); out.chased = read();
      currentNodeId = 'mC'; initiateCombat('RAIDERS', false);
      noteFightWon(); out.after = read();
      combatActive = false;
      return out;
    });
    ok(`winning a fight nobody chased you into pays nothing (${paid.unchased})`, paid.unchased === 0);
    ok(`winning the chase pays once (${paid.chased})`, paid.chased === 1);
    ok(`and the next win does not pay again (${paid.after})`, paid.after === 1);

    // ── THE FLAG TRAVELS WITH THE FIGHT ──────────────────────────────────────────────────
    // The relay was module state and was in nothing the save writes, so a reload mid-chase lost
    // it. fightLog has been in COMBAT_STATE since E10, so moving the stamp closed this for free.
    await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0);
      sectorFront = null; currentSector = 3;
      currentNodeId = 'rA'; initiateCombat('RAIDERS', false);
      forceBreakContact();
      currentNodeId = 'rB'; initiateCombat('RAIDERS', false);
      saveGameState();
    });
    await page.reload();
    await engineUp(page);
    await page.click('.title-btn.btn-continue');
    // S07: the fight being back up, which is prior to the flag this then reads - see suite 182.
    await settled(page, () => combatActive === true && activeEntities.length > 0,
      'the chase to come back up');
    const back = await page.evaluate(() => ({
      live: combatActive, chased: fightLog ? fightLog.chased : null,
      on: activeEntities.filter(e => /^chase_/.test(e.id)).length
    }));
    ok('the chase resumes with its runners', back.live && back.on > 0);
    ok('and the fight still knows it is a chase', back.chased === true);

    // ── NOTHING RELAYS IT ANY MORE ───────────────────────────────────────────────────────
    // The relay is deleted rather than left beside the stamp: two writers for one fact is how
    // the off-by-one got in, and a dead one is an invitation to read it again.
    const gone = await page.evaluate(() => ({
      noRelay: typeof chasedIn === 'undefined',
      notExported: !('chasedIn' in WP),
      stampedAtPlacement: /pursuit = null;[\s\S]{0,900}?fightLog\.chased = true;/.test(initiateCombat.toString()),
      noRelayRead: !/chased = chasedIn/.test(initiateCombat.toString()),
      inTheLog: 'chased' in newFightLog()
    }));
    ok('the module-level relay is gone', gone.noRelay && gone.notExported);
    ok('the stamp is written where the chasers are placed', gone.stampedAtPlacement);
    ok('and read back from nowhere else', gone.noRelayRead);
    ok('the fight log still opens with the field', gone.inTheLog);
  }
};

// F07. Two ways the dead came back, both of them confirmed at source before anything moved.
//
// A bleed-out clock belonged to a person rather than to a fall. goDown refuses to re-clock
// somebody who already carries a number - that is what stops a second hit on the floor from
// resetting the count - but the number was only ever cleared by the two paths that END a fall,
// loseOperator and the drag clear. An operator picked up mid-fight walked away still carrying
// it, and their next fall hit that same guard and returned: never announced, no fresh clock,
// no Hazmat's Dead Man's Switch. A stale 1 killed them on the first tick of their next fall,
// in that fight or in any later one, because the clock rode home in the save.
//
// And FIELD REVIVE could be aimed at somebody already lost for good. loseOperator takes them
// off the roster but deliberately leaves the corpse on the field, because the LOST tag is drawn
// on it; the MEDIC's overdrive target set asked only `ent.isPlayer`. Half health, on the field,
// for the rest of the fight, and not on the roster.
//
// Every assertion below drives real turns rather than calling goDown by hand, because the fix
// is a sweep at the turn boundary and a suite that skips the boundary would be testing nothing.
module.exports = {
  name: 'The dead who come back',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      // A fight, with one operator put on the floor and the queue parked on somebody else so
      // the turns below belong to a third party - which is how a real pick-up happens.
      window.__floor = () => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        initiateCombat('RAIDERS', false);
        const me = activeEntities.find(e => e.isPlayer);
        const other = activeEntities.find(e => e.isPlayer && e.id !== me.id);
        me.hp = 0; goDown(me);
        return { me, other };
      };
      // One whole turn passing, without depending on whose it is.
      window.__turn = () => {
        const idx = turnQueue.findIndex(e => e.hp > 0 && e.isPlayer);
        if (idx >= 0) activeIndex = idx;
        processTurn();
      };
      window.__logText = () => document.getElementById('log').innerText;
    });

    // ── The clock that outlived its fall ────────────────────────────────────────────
    const clock = await page.evaluate(() => {
      const { me } = window.__floor();
      const first = me.downTurns;
      while (me.downTurns > 1) tickBleedOut(me);
      const worn = me.downTurns;
      // Picked up. Any of the paths that reach the floor does this; a plain heal is the shape
      // they all share, and the point is that NONE of them is asked to know about the clock.
      me.hp = Math.floor(me.maxHp * 0.5);
      // A turn passes, which is the earliest a re-fall could possibly arrive.
      window.__turn();
      const swept = me.downTurns;
      // Now knock them down again, the way an enemy would.
      const before = window.__logText();
      me.hp = 0; goDown(me);
      const said = window.__logText().slice(before.length);
      return { first, worn, swept, second: me.downTurns,
               announced: /is down and bleeding out/.test(said), line: said.trim().split('\n').pop() };
    });
    ok(`a fall clocks them (${clock.first})`, clock.first > 0);
    ok(`and ticks wear it down to the last turn (${clock.worn})`, clock.worn === 1);
    ok(`a pick-up ends the clock, whoever did the picking up (${clock.swept})`, clock.swept === 0);
    ok(`so the second fall is announced (${clock.line})`, clock.announced === true);
    ok(`and gets a whole clock, not the stale one (${clock.second} of ${clock.first})`,
      clock.second === clock.first);

    // ── And the stale clock did not ride home in the save ───────────────────────────
    const across = await page.evaluate(() => {
      const { me } = window.__floor();
      while (me.downTurns > 1) tickBleedOut(me);
      me.hp = Math.floor(me.maxHp * 0.5);
      window.__turn();
      const live = me.downTurns;
      saveGameState();
      const disk = JSON.parse(Store.get(BASE_SAVE_KEY + currentSlot) || 'null') || {};
      const saved = (disk.roster || []).find(c => c.id === me.id) || {};
      return { live, onDisk: saved.downTurns || 0 };
    });
    ok(`a picked-up operator carries no clock (${across.live})`, across.live === 0);
    ok(`so none reaches the save, and none rides into the next fight (${across.onDisk})`,
      across.onDisk === 0);

    // ── The clock a second hit on the floor must NOT reset ──────────────────────────
    const reentrant = await page.evaluate(() => {
      const { me } = window.__floor();
      const first = me.downTurns;
      tickBleedOut(me);
      const worn = me.downTurns;
      // A turn passes with them still on the floor - so the sweep runs over a clock that is
      // LIVE, not stale, and must leave it alone. Then they are hit again while still down.
      // This is what goDown's guard is for, and a sweep that took the down with it would hand
      // a fresh count to anybody hit twice: lying there would stop costing anything.
      window.__turn();
      const survived = me.downTurns;
      const before = window.__logText();
      goDown(me);
      const said = window.__logText().slice(before.length);
      return { first, worn, survived, after: me.downTurns,
               reannounced: /is down and bleeding out/.test(said) };
    });
    ok(`a live clock survives the sweep (${reentrant.survived})`, reentrant.survived === reentrant.worn);
    ok(`and a second hit on the floor does not reset it (${reentrant.after}, worn from ${reentrant.first})`,
      reentrant.after === reentrant.worn && reentrant.after < reentrant.first);
    ok(`nor say they went down again (${reentrant.reannounced})`, reentrant.reannounced === false);

    // ── The Dead Man's Switch a silent fall used to skip ────────────────────────────
    const switched = await page.evaluate(() => {
      const { me } = window.__floor();
      me.traits = ['CAP_DEAD_MANS_SWITCH'];
      while (me.downTurns > 1) tickBleedOut(me);
      me.hp = Math.floor(me.maxHp * 0.5);
      window.__turn();
      const foes = activeEntities.filter(e => !e.isPlayer && e.hp > 0);
      const before = foes.map(e => e.hp);
      me.hp = 0; goDown(me);
      const after = foes.map(e => e.hp);
      return { vented: before.filter((h, i) => after[i] < h).length, foes: foes.length };
    });
    ok(`and the tanks let go on the second fall too (${switched.vented} of ${switched.foes})`,
      switched.foes > 0 && switched.vented === switched.foes);

    // ── The body that could be revived ─────────────────────────────────────────────
    const ghost = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      // A MEDIC in the line, so the overdrive that reaches allies is the one being aimed.
      const med = playerRoster.find(p => p.classType === 'MEDIC');
      if (med) med.gridPos = 1;
      initiateCombat('RAIDERS', false);
      const medic = activeEntities.find(e => e.isPlayer && e.classType === 'MEDIC');
      const dead = activeEntities.find(e => e.isPlayer && (!medic || e.id !== medic.id));
      dead.hp = 0; loseOperator(dead, 'COMBAT');
      const onRoster = playerRoster.some(p => p.id === dead.id);
      const onField = activeEntities.some(e => e.id === dead.id);
      let offered = null, tagged = null, live = null;
      if (medic) {
        turnQueue = [medic]; activeIndex = 0; pendingAction = 'OVERDRIVE';
        renderField();
        offered = !!document.querySelector(`[data-action="target"][data-id="${dead.id}"]`);
        live = !!document.querySelector(`[data-action="target"][data-id="${medic.id}"]`);
        tagged = /LOST/.test(document.getElementById('player-team').innerText);
        pendingAction = null;
      }
      return { onRoster, onField, offered, live, tagged, medic: !!medic };
    });
    ok(`a lost operator is off the roster (${ghost.onRoster})`, ghost.onRoster === false);
    ok(`but the corpse stays on the field, which is what the LOST tag is drawn on (${ghost.tagged})`,
      ghost.onField === true && ghost.tagged === true);
    ok(`FIELD REVIVE is not offered them (${ghost.offered})`, ghost.medic && ghost.offered === false);
    ok('while the living are still offered it', ghost.live === true);

    // ── The belt behind that brace ─────────────────────────────────────────────────
    const refused = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const med = playerRoster.find(p => p.classType === 'MEDIC');
      if (med) med.gridPos = 1;
      initiateCombat('RAIDERS', false);
      const medic = activeEntities.find(e => e.isPlayer && e.classType === 'MEDIC');
      const dead = activeEntities.find(e => e.isPlayer && e.id !== medic.id);
      dead.hp = 0; loseOperator(dead, 'COMBAT');
      // A screen that is somehow stale, aiming the overdrive at the lost anyway.
      odChoices = {}; odChoices[medic.classType] = 'FIELD_REVIVE';
      momentum = 100; turnQueue = [medic]; activeIndex = 0;
      queueAction('OVERDRIVE', 'FIELD_REVIVE');
      resolveAction(dead.id);
      return { hp: dead.hp, fallen: dead.fallen,
               onRoster: playerRoster.some(p => p.id === dead.id),
               said: /beyond reviving/.test(document.getElementById('log').innerText) };
    });
    ok(`a stale screen cannot raise the lost (${refused.hp} hp)`, refused.hp <= 0);
    ok(`they stay lost, and stay off the roster (${refused.fallen})`,
      refused.fallen === true && refused.onRoster === false);
    ok(`and the log says why (${refused.said})`, refused.said === true);
  }
};

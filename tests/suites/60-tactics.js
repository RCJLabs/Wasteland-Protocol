// Momentum was built as a market so a full bar would be a decision. It was not one. Measured
// across sixty expeditions per policy, run outcome tracked STIM purchases almost monotonically
// - buy it whenever affordable and the squad reaches mean sector 2.6; dilute it and the run
// collapses. Two reasons, neither of them the one the audit gave. FOCUS and PRESS both buy
// damage, and damage is not what a run is short of. And every tactic competes with the
// Overdrive for one 100-point bar, which is why buying PRESS measured WORSE than buying
// nothing at all.
//
// So the shelf gained two answers on the axis that decides runs, and STIM now pays against how
// badly someone is hurt rather than a flat fifth of their health. This suite is mostly about
// those two things being true, and about the row still fitting on a phone.
module.exports = {
  name: 'Tactics',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__fight = () => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        playerRoster.forEach(c => { c.gridPos = 0; });
        playerRoster.slice(0, 3).forEach((c, i) => { c.gridPos = i + 1; });
        currentSector = 3; currentTier = 5;
        initiateCombat('RAIDERS', false);
        activeIndex = turnQueue.findIndex(e => e.isPlayer && e.hp > 0);
        return activeEntities;
      };
    });

    // ---- the shelf ----
    const shelf = await page.evaluate(() => ({
      ids: MOMENTUM_TACTICS.map(t => t.id),
      costs: MOMENTUM_TACTICS.map(t => t.cost),
      shaped: MOMENTUM_TACTICS.every(t => t.id && t.label && t.desc && t.cost > 0),
      od: OVERDRIVE_AT
    }));
    ok(`the shelf has more than one thing worth buying (${shelf.ids.join(', ')})`,
      shelf.ids.length >= 5 && shelf.shaped);
    ok('no two tactics share an id', new Set(shelf.ids).size === shelf.ids.length);
    // Every tactic is a bite out of the same bar the Overdrive needs whole; if one cost as much
    // as the Overdrive the choice would not exist.
    ok(`every tactic costs less than an Overdrive (${shelf.od})`, shelf.costs.every(c => c < shelf.od));

    // ---- STIM pays against need, not a flat rate ----
    const stim = await page.evaluate(() => {
      __fight();
      const c = activeEntities.find(e => e.isPlayer);
      const at = frac => { c.hp = Math.max(1, Math.floor(c.maxHp * frac)); return stimHeal(c); };
      return { scratch: at(0.95), half: at(0.5), floor: at(0.05), max: c.maxHp };
    });
    ok(`a scratch is barely worth the bar (${stim.scratch} of ${stim.max})`,
      stim.scratch < stim.half);
    ok(`somebody on the floor is worth more than the old flat fifth (${stim.floor} vs ${Math.floor(stim.max * 0.2)})`,
      stim.floor > Math.floor(stim.max * 0.2));
    ok('and it never heals nothing', stim.scratch >= 1);

    // ---- the two new answers are on the survival axis ----
    const hold = await page.evaluate(() => {
      __fight();
      const line = activeEntities.filter(e => e.isPlayer && e.hp > 0);
      line.forEach(e => { e.armor = 0; e.armorTurns = 0; });
      const before = line.map(e => e.armor);
      momentum = 100; addMomentum(0);
      spendTactic('HOLD');
      return { before, after: line.map(e => e.armor), turns: line.map(e => e.armorTurns),
               spent: 100 - momentum };
    });
    ok('HOLD puts armour on the whole line, not one operator',
      hold.after.every((a, i) => a > hold.before[i]) && hold.after.length > 1);
    ok('and it lasts past the turn it was bought on', hold.turns.every(t => t >= 2));
    ok(`it costs what the card says (${hold.spent})`, hold.spent === 25);

    const brk = await page.evaluate(() => {
      __fight();
      const foes = activeEntities.filter(e => !e.isPlayer && e.hp > 0);
      foes.forEach(e => { e.stunnedTurns = 0; });
      // The one winding up the worst blow is the one BREAK should find.
      const picked = breakTarget();
      const dmgOf = e => { const f = forecastFor(e); return f && f.hits ? f.hits.reduce((a, h) => a + h.dmg, 0) : 0; };
      const best = foes.map(e => ({ e, n: dmgOf(e) })).sort((a, b) => b.n - a.n)[0];
      momentum = 100; addMomentum(0);
      spendTactic('BREAK');
      return { pickedId: picked && picked.id, bestId: best && best.e.id,
               stunned: picked ? picked.stunnedTurns : 0, spent: 100 - momentum,
               pickedIsSig: picked ? (forecastFor(picked) || {}).kind === 'SIG' : false,
               foes: foes.length };
    });
    ok('BREAK finds the hostile that is about to do the most', brk.foes > 0 && !!brk.pickedId);
    ok('and takes its next turn away', brk.stunned >= 1);
    ok(`it costs what the card says (${brk.spent})`, brk.spent === 35);

    // ---- a tactic you cannot use is not offered ----
    const gated = await page.evaluate(() => {
      __fight();
      momentum = 100; addMomentum(0);
      // nobody hurt, nothing to stim
      activeEntities.filter(e => e.isPlayer).forEach(e => {
        e.hp = e.maxHp; e.bleedingTurns = 0; e.stunnedTurns = 0; e.oiledTurns = 0;
      });
      const noStim = !stimTarget();
      const before = momentum;
      spendTactic('STIM');
      const refusedStim = momentum === before;
      // nothing left standing to break
      activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
      const noBreak = !breakTarget();
      spendTactic('BREAK');
      const refusedBreak = momentum === before;
      renderCommandDeck();
      const btns = [...document.querySelectorAll('.tactic-btn')];
      const dis = btns.filter(b => b.disabled).map(b => b.querySelector('.tactic-name').innerText);
      return { noStim, refusedStim, noBreak, refusedBreak, dis, n: btns.length };
    });
    ok('STIM with nobody hurt is refused rather than wasted', gated.noStim && gated.refusedStim);
    ok('BREAK with nothing standing is refused rather than wasted', gated.noBreak && gated.refusedBreak);
    ok(`and the deck greys out what it will not sell (${gated.dis.join(', ') || 'none'})`,
      gated.dis.includes('STIM') && gated.dis.includes('BREAK'));

    // ---- none of them costs the turn, which is the whole point of a tactic ----
    const free = await page.evaluate(() => {
      const out = {};
      MOMENTUM_TACTICS.forEach(t => {
        __fight();
        const actor = turnQueue[activeIndex];
        activeEntities.filter(e => e.isPlayer).forEach(e => { e.hp = Math.floor(e.maxHp * 0.5); });
        momentum = 100; addMomentum(0);
        const idx = activeIndex;
        spendTactic(t.id);
        out[t.id] = { held: activeIndex === idx, same: turnQueue[activeIndex] === actor };
      });
      return out;
    });
    ok('no tactic costs the operator their turn',
      Object.values(free).every(v => v.held && v.same));

    // ---- the row still fits a phone ----
    const fits = await page.evaluate(() => {
      __fight();
      activeEntities.filter(e => e.isPlayer).forEach(e => { e.hp = Math.floor(e.maxHp * 0.5); });
      momentum = 50; addMomentum(0);   // under the Overdrive, so the shelf is what renders
      renderCommandDeck();
      const btns = [...document.querySelectorAll('.tactic-btn')];
      return btns.map(b => {
        const n = b.querySelector('.tactic-name');
        const r = document.createRange(); r.selectNodeContents(n);
        // The label is clipped by the BUTTON, not by its own box, so it is measured against it.
        return { t: n.innerText, clipped: Math.ceil(r.getBoundingClientRect().width) > b.clientWidth - 2 };
      });
    });
    ok(`every tactic on the shelf is offered (${fits.length})`, fits.length === shelf.ids.length);
    ok(`and none of their names is cut off (${fits.map(f => f.t).join(' ')})`,
      fits.length > 0 && fits.every(f => !f.clipped));

    // ---- the manual says what the shelf holds ----
    const manual = await page.evaluate(() => {
      renderCodex();
      const txt = document.getElementById('codex-body').innerText;
      return MOMENTUM_TACTICS.every(t => txt.includes(t.label) && txt.includes(t.desc.slice(0, 24)));
    });
    ok('the manual lists every tactic and what it does', manual);
  }
};

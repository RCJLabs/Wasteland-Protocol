// F06. Three things about a promotion, all of them on surfaces the suites had gone around.
//
// The Outpost's CHOOSE PERK menu has thrown for any operator with a capstone open since E08b
// shipped. buyableFor returns the capstone as `{ sig: true, cap: true }` - `sig` is what makes
// it print like a signature - and operatorCardHtml then looked its fork up in SIG_PERKS, where
// a CAP_* id is not. The find returned undefined, reading .fork threw, and the throw happened
// inside `playerRoster.map(operatorCardHtml)` before innerHTML was assigned: the Outpost came
// up stale and threw again on every later render until the selector cleared. The Outpost door
// is the only way a banked point ever becomes a capstone. Neither the harness nor suite 108
// saw it, because both call assignPerk directly and never render the menu - the E03 lesson,
// applied to the surface that was skipped.
//
// Two level-ups in one fight queue two offers, both rolled when the level was awarded and both
// against the same open fork. Taking a signature from the first does not touch the second, so
// the stale screen could hand over the half the first closed - breaking E07's two-of-four - or
// the same signature twice.
//
// And a held capstone was printed twice on the operator card: once as a trait id, once on the
// line that says what it is.
module.exports = {
  name: 'The second offer that reopens the fork',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      // An operator with both forks shut, a point banked and the capstone open - which is
      // exactly the state the Outpost could not draw.
      window.__capReady = () => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 1; scrap = 100000;
        const c = playerRoster.find(p => p.classType === 'BRUISER');
        c.traits = forksFor(c).map(g => g[0].id);      // one half of each fork
        c.level = CAPSTONE_LEVEL; c.perkPoints = 1;
        activePerkSelector = null; activePosSelector = null;
        return c;
      };
      window.__menu = id => {
        const el = document.querySelector(`[data-action="perk-menu"][data-id="${id}"]`);
        if (el) el.click();
        return document.querySelectorAll(`[data-action="assign-perk"][data-id="${id}"]`).length;
      };
    });

    // ── The door that has been shut since E08b ───────────────────────────────────────
    const outpost = await page.evaluate(() => {
      const errs = [];
      const onErr = e => errs.push(String(e.message || e));
      window.addEventListener('error', onErr);
      const c = window.__capReady();
      const open = capstoneOpen(c);
      const cap = capstoneFor(c);
      renderOutpost();
      const rosterBefore = document.getElementById('outpost-roster').children.length;
      activePerkSelector = c.id;
      let threw = null;
      try { renderOutpost(); } catch (e) { threw = String(e.message || e); }
      const buttons = [...document.querySelectorAll(`[data-action="assign-perk"][data-id="${c.id}"]`)];
      const capBtn = buttons.find(b => b.dataset.perk === cap.id);
      const sigBtn = buttons.find(b => b.dataset.perk && b.dataset.perk.indexOf('CAP_') !== 0
                                       && SIG_PERKS.some(s => s.id === b.dataset.perk));
      // And again, which is where the old failure compounded: every later render threw too.
      let threwTwice = null;
      try { renderOutpost(); } catch (e) { threwTwice = String(e.message || e); }
      const rosterAfter = document.getElementById('outpost-roster').children.length;
      window.removeEventListener('error', onErr);
      return { open, capId: cap.id, capName: cap.name, threw, threwTwice, errs,
               rosterBefore, rosterAfter, buttons: buttons.length,
               capLabel: capBtn ? capBtn.innerText : null,
               capTitle: capBtn ? capBtn.getAttribute('title') : 'MISSING',
               sigTitle: sigBtn ? sigBtn.getAttribute('title') : null,
               sigId: sigBtn ? sigBtn.dataset.perk : null };
    });
    ok(`the operator has both forks shut and the capstone open (${outpost.capName})`, outpost.open === true);
    ok(`opening CHOOSE PERK does not throw (${outpost.threw || 'clean'})`, outpost.threw === null);
    ok(`nor does the render after it, which is where it used to compound (${outpost.threwTwice || 'clean'})`,
      outpost.threwTwice === null);
    ok(`and the roster is still drawn rather than left empty (${outpost.rosterBefore} -> ${outpost.rosterAfter})`,
      outpost.rosterAfter > 0 && outpost.rosterAfter === outpost.rosterBefore);
    ok(`the capstone is on the menu (${outpost.capLabel})`,
      outpost.buttons > 1 && !!outpost.capLabel && new RegExp(outpost.capName, 'i').test(outpost.capLabel));
    ok('and it closes nothing, because it is above the forks', outpost.capTitle === null);

    // ── With a fork still open, the twin is still named ──────────────────────────────
    const twin = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      scrap = 100000;
      const c = playerRoster.find(p => p.classType === 'BRUISER');
      c.traits = []; c.level = 5; c.perkPoints = 1;
      activePerkSelector = c.id; renderOutpost();
      const buttons = [...document.querySelectorAll(`[data-action="assign-perk"][data-id="${c.id}"]`)];
      const sigBtn = buttons.find(b => SIG_PERKS.some(s => s.id === b.dataset.perk));
      const mine = SIG_PERKS.find(s => s.id === sigBtn.dataset.perk);
      const other = SIG_PERKS.find(s => s.fork === mine.fork && s.id !== mine.id);
      return { title: sigBtn.getAttribute('title'), expect: other.name, capOnMenu: buttons.some(b => b.dataset.perk.indexOf('CAP_') === 0) };
    });
    ok(`a signature still says what it closes (${twin.title})`,
      !!twin.title && twin.title.indexOf(twin.expect) >= 0);
    ok('and the capstone is not on the menu while a fork is open', twin.capOnMenu === false);

    // ── The point buys it, through the door ─────────────────────────────────────────
    const bought = await page.evaluate(() => {
      const c = window.__capReady();
      const cap = capstoneFor(c);
      const before = { scrap, points: c.perkPoints, had: hasTrait(c, cap.id) };
      activePerkSelector = c.id; renderOutpost();
      const btn = [...document.querySelectorAll(`[data-action="assign-perk"][data-id="${c.id}"]`)]
        .find(b => b.dataset.perk === cap.id);
      const price = capstoneCost();
      btn.click();
      return { before, price, spent: before.scrap - scrap, points: c.perkPoints,
               has: hasTrait(c, cap.id), selector: activePerkSelector,
               roster: document.getElementById('outpost-roster').children.length };
    });
    ok(`the button is a real purchase (${bought.spent} scrap of ${bought.price})`,
      bought.before.had === false && bought.has === true && bought.spent === bought.price);
    ok(`and it spends the point and shuts the menu (${bought.points} left)`,
      bought.points === bought.before.points - 1 && bought.selector === null && bought.roster > 0);

    // ── A held capstone is named once ───────────────────────────────────────────────
    const card = await page.evaluate(() => {
      const c = window.__capReady();
      const cap = capstoneFor(c);
      const openLine = traitSummary(c);
      c.traits.push(cap.id);
      const heldLine = traitSummary(c);
      const times = heldLine.split(cap.id).length - 1;
      const named = heldLine.split(cap.name).length - 1;
      return { openLine, heldLine, times, named, capId: cap.id, capName: cap.name };
    });
    ok(`an open capstone is announced (${card.openLine})`, /capstone open/.test(card.openLine));
    ok(`and a held one is named once, not twice (${card.heldLine})`,
      /capstone: /.test(card.heldLine) && card.times === 0 && card.named === 1);

    // ── Two levels in one fight, and the second offer ───────────────────────────────
    const stacked = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'BRUISER');
      // Exactly one fork open, so both pre-rolls have to reach for the same one - which is the
      // state the defect lives in. With two open they can roll different forks and the second
      // offer is harmless by luck rather than by rule.
      c.traits = [forksFor(c)[0][0].id];
      c.level = 3; c.perkPoints = 0; c.xp = 0; c.xpToNext = 10;
      pendingPerkOffers = [];
      // One award, two thresholds crossed - which is what a boss or an elite payout does at a
      // sector boundary, and what the dev LEVEL grant does. 10 then floor(10 * XP_CURVE) = 13.
      awardXp(c, 23);
      const queued = pendingPerkOffers.filter(o => o.charId === c.id).length;
      // rollPerkOffer shuffles a fork's two halves, so the same fork can come out in either
      // order. Compare the sets, not the sequences.
      const sigSetOf = o => o.options.filter(id => SIG_PERKS.some(p => p.id === id)).slice().sort().join();
      const rolledSame = pendingPerkOffers.length >= 2
        && sigSetOf(pendingPerkOffers[0]) !== ''
        && sigSetOf(pendingPerkOffers[0]) === sigSetOf(pendingPerkOffers[1]);
      // Take a signature off the first screen.
      renderPerkOffer();
      const firstSigs = pendingPerkOffers[0].options.filter(id => SIG_PERKS.some(p => p.id === id));
      const firstIdx = pendingPerkOffers[0].options.indexOf(firstSigs[0]);
      const took = firstSigs[0];
      const shutTwin = (SIG_PERKS.find(p => p.id === took) || {}).fork;
      takePerkOffer(firstIdx);
      // The second screen is drawn by takePerkOffer. What is on it now?
      const secondOpts = pendingPerkOffers.length ? pendingPerkOffers[0].options.slice() : [];
      const offersTwin = secondOpts.some(id => {
        const p = SIG_PERKS.find(x => x.id === id);
        return p && p.fork === shutTwin;
      });
      // Resolve it too, taking a signature if one is on offer.
      const secondSig = secondOpts.find(id => SIG_PERKS.some(p => p.id === id));
      takePerkOffer(secondSig ? secondOpts.indexOf(secondSig) : 0);
      const held = (c.traits || []).filter(t => SIG_PERKS.some(p => p.id === t));
      const forks = new Set(held.map(t => SIG_PERKS.find(p => p.id === t).fork));
      return { queued, rolledSame, took, secondOpts, offersTwin, held, forkCount: forks.size };
    });
    ok(`one award across two thresholds queues two offers (${stacked.queued})`, stacked.queued === 2);
    ok(`both were rolled against the same open fork when the level was awarded (${stacked.rolledSame})`,
      stacked.rolledSame === true);
    ok(`the second offer no longer carries the fork the first closed (${stacked.secondOpts.join(', ')})`,
      stacked.offersTwin === false);
    ok(`so an operator ends with one signature per fork, never both halves (${stacked.held.join(', ')})`,
      stacked.held.length === stacked.forkCount && stacked.held.length <= 2);

    // ── An offer already on screen does not change under the player ─────────────────
    const settled = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'BRUISER');
      c.traits = []; c.level = 4; c.perkPoints = 1;
      pendingPerkOffers = [{ charId: c.id, options: rollPerkOffer(c) }];
      renderPerkOffer();
      const first = pendingPerkOffers[0].options.join();
      const flagged = pendingPerkOffers[0].shown === true;
      renderPerkOffer(); renderPerkOffer();
      const after = pendingPerkOffers[0].options.join();
      return { first, after, flagged };
    });
    ok('an offer is marked once it has been drawn', settled.flagged);
    ok(`and re-drawing it does not re-roll it (${settled.first})`, settled.first === settled.after);

    // The roll happens at the screen, so the screen is what has to reach disk - otherwise a
    // reload on a promotion is a re-roll, which is the whole of F02's complaint.
    const kept = await page.evaluate(() => {
      const disk = JSON.parse(Store.get(BASE_SAVE_KEY + currentSlot) || 'null') || {};
      const on = (disk.pendingPerkOffers || [])[0] || {};
      const wrote = (on.options || []).join();
      const flagged = on.shown === true;
      loadGameState();
      const back = pendingPerkOffers.length ? pendingPerkOffers[0].options.join() : '';
      return { wrote, flagged, back };
    });
    ok(`the drawn offer is on disk exactly as drawn (${kept.wrote})`,
      kept.wrote === settled.first && kept.flagged === true);
    ok('so a reload finds the same three cards, not three new ones', kept.back === settled.first);

    // ── The belt to that brace ──────────────────────────────────────────────────────
    const refused = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'BRUISER');
      const fork = forksFor(c)[0];
      c.traits = [fork[0].id]; c.level = 6; c.perkPoints = 1;
      // A screen that is somehow stale, offering the half this operator just closed.
      pendingPerkOffers = [{ charId: c.id, options: [fork[1].id, 'VETERAN', 'SWIFT'], shown: true }];
      takePerkOffer(0);
      return { held: (c.traits || []).slice(), shut: fork[1].id, points: c.perkPoints };
    });
    ok(`a stale screen cannot hand over the half that was closed (${refused.held.join(', ')})`,
      refused.held.indexOf(refused.shut) === -1);
  }
};

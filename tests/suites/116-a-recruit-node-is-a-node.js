// F08. A RECRUIT node was not a node.
//
// finishEvent and finishShop each carried the same three lines - advance the tier, count the
// node, note the depth - and both recruit exits carried none of them. Walk into a survivor's
// camp, sign them or leave them, and the run came out on the tier it went in on with the
// summary never counting it: free depth, twice over, since the node still cost nothing to
// enter. Those three lines are now one function and all three quiet nodes call it.
//
// bankNode is the fight's version of that exit and was NOT used here, though the audit
// proposed it: it also resets momentum and closes ranks, so routing a quiet node through it
// would wipe the player's bar for walking into a camp. finishShop and finishEvent never did
// that either.
//
// Three more, all on the same screen. An empty camp paid a flat 150 where the exhausted relic
// pool it says it mirrors pays that through emptyPoolScrap, so by sector 5 the camp was worth
// a fifth of the thing it was copying - and the button quoted the base rather than what it
// paid. A recruit signed deep banked one point per level of par levelling and was never asked
// about any of them, which mattered more than it looks: the Outpost door those points were
// left to has been throwing since E08b, and only F06 opened it. And recruitById reads the
// whole pool rather than the unsigned part of it, so a run put back on a node it had already
// taken got the same card and a live SIGN button, which signOnRecruit then refused in silence.
module.exports = {
  name: 'A recruit node is a node',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      // The recruit node is placed on a 0.55 roll, so deal maps until one carries it.
      window.__recruitNode = () => {
        let node = null;
        for (let i = 0; i < 80 && !node; i++) {
          sectorMap = generateSectorMap(); clearedNodeIds = [];
          node = sectorMap.nodes.find(n => n.type === 'RECRUIT');
        }
        return node;
      };
      window.__atCamp = (sector, level) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        const node = window.__recruitNode();
        currentSector = sector; scrap = 100000;
        playerRoster.forEach(c => { c.level = level; });
        pendingPerkOffers = [];
        enterNode(node.id); initiateRecruit();
        return node;
      };
    });

    // ── Signing on is a node cleared ────────────────────────────────────────────────
    const signed = await page.evaluate(() => {
      const node = window.__atCamp(3, 1);
      if (!node) return { none: true };
      const t0 = currentTier, n0 = runStats.nodes, m0 = momentum;
      momentum = 40;
      const before = playerRoster.length;
      signOnRecruit();
      return { none: false, t0, n0, tier: currentTier, nodes: runStats.nodes,
               joined: playerRoster.length - before, momentum, m0 };
    });
    ok('a map with a recruit node was dealt', signed.none === false);
    ok(`signing on adds them (${signed.joined})`, signed.joined === 1);
    ok(`and advances the tier (${signed.t0} -> ${signed.tier})`, signed.tier === signed.t0 + 1);
    ok(`and counts the node (${signed.n0} -> ${signed.nodes})`, signed.nodes === signed.n0 + 1);
    ok(`without wiping the momentum bar, which is what bankNode would have done (${signed.momentum})`,
      signed.momentum === 40);

    // ── And so is walking away ──────────────────────────────────────────────────────
    const left = await page.evaluate(() => {
      const node = window.__atCamp(3, 1);
      if (!node) return { none: true };
      const t0 = currentTier, n0 = runStats.nodes;
      leaveRecruit();
      return { none: false, t0, n0, tier: currentTier, nodes: runStats.nodes,
               roster: playerRoster.length };
    });
    ok(`leaving them to it advances the tier too (${left.t0} -> ${left.tier})`,
      left.tier === left.t0 + 1);
    ok(`and counts the node (${left.n0} -> ${left.nodes})`, left.nodes === left.n0 + 1);

    // ── An empty camp pays what the pool it mirrors pays ────────────────────────────
    const empty = await page.evaluate(() => {
      window.__atCamp(4, 1);
      // Everyone is already signed, which is the state that empties the camp.
      pendingRecruit = { nodeId: currentNodeId, id: null, cost: 0, taken: false };
      renderRecruit();
      const label = document.getElementById('recruit-leave').innerText;
      const signShown = document.getElementById('recruit-sign').style.display !== 'none';
      const s0 = scrap, e0 = runStats.scrapEarned;
      const want = emptyPoolScrap();
      leaveRecruit();
      return { label, signShown, paid: scrap - s0, earned: runStats.scrapEarned - e0,
               want, flat: EMPTY_POOL_SCRAP };
    });
    ok(`an empty camp is worth what an exhausted pool is worth (${empty.paid} of ${empty.want})`,
      empty.paid === empty.want && empty.want > empty.flat);
    ok(`the run ledger is told the same number (${empty.earned})`, empty.earned === empty.want);
    ok(`and the button quotes what it pays (${empty.label})`,
      empty.label.indexOf(String(empty.want)) >= 0 && empty.signShown === false);

    // ── The points a signed recruit used to bank in silence ─────────────────────────
    const par = await page.evaluate(() => {
      const node = window.__atCamp(5, 9);
      if (!node) return { none: true };
      signOnRecruit();
      const rec = playerRoster[playerRoster.length - 1];
      const queued = pendingPerkOffers.filter(o => o.charId === rec.id).length;
      const screen = document.getElementById('screen-perk');
      const onScreen = screen && getComputedStyle(screen).display !== 'none';
      return { none: false, level: rec.level, points: rec.perkPoints, queued, onScreen,
               par: 9 };
    });
    ok(`a recruit signed deep arrives at par (${par.level})`, par.level === par.par);
    ok(`with a point for every level of it (${par.points})`, par.points === par.par - 1);
    ok(`and a promotion screen for each, rather than eight banked in silence (${par.queued})`,
      par.queued === par.points);
    ok('and the first of them is put up at once, not left for the next node', par.onScreen === true);

    // ── But only while there is something left to decide ────────────────────────────
    const nothing = await page.evaluate(() => {
      const node = window.__atCamp(5, 9);
      if (!node) return { none: true };
      const tpl = recruitById(pendingRecruit.id);
      // Everything that class could ever be offered, already held: one half of each fork and
      // the capstone. awardXp banks the point in this state rather than drawing a screen with
      // nothing on it, and sign-on has to agree with it - so the template itself carries them
      // before the levelling runs, which is the only way to reach that state at sign-on.
      const stub = { classType: tpl.classType, traits: [], level: 20 };
      const cap = capstoneFor(stub);
      const shut = forksFor(stub).map(g => g[0].id).concat(cap ? [cap.id] : []);
      const keep = tpl.traits;
      tpl.traits = shut.slice();
      signOnRecruit();
      tpl.traits = keep;
      const rec = playerRoster[playerRoster.length - 1];
      return { none: false, sigsLeft: unheldSigsFor(rec).length, capOpen: capstoneOpen(rec),
               queued: pendingPerkOffers.filter(o => o.charId === rec.id).length,
               points: rec.perkPoints, level: rec.level };
    });
    ok(`a recruit with both forks shut and the capstone held has nothing to be offered (${nothing.sigsLeft})`,
      nothing.sigsLeft === 0 && nothing.capOpen === false);
    ok(`so par levelling banks their points rather than drawing empty screens (${nothing.queued} screens, ${nothing.points} points)`,
      nothing.queued === 0 && nothing.points === nothing.level - 1 && nothing.points > 0);

    // ── The card that came back for somebody already signed ─────────────────────────
    const again = await page.evaluate(() => {
      const node = window.__atCamp(3, 1);
      if (!node) return { none: true };
      const who = pendingRecruit.id;
      signOnRecruit();
      pendingPerkOffers = [];
      const s0 = scrap, t0 = currentTier;
      // A fallback puts the run back on a node it has already taken.
      enterNode(node.id); initiateRecruit();
      const btn = document.getElementById('recruit-sign');
      const leave = document.getElementById('recruit-leave');
      const state = { shown: btn.style.display !== 'none', note: document.getElementById('recruit-note').innerText,
                      leave: leave.innerText, card: document.getElementById('recruit-body').innerHTML };
      leaveRecruit();
      return { none: false, who, state, paid: scrap - s0, tier: currentTier, t0,
               roster: playerRoster.filter(c => c.id === who).length };
    });
    ok(`they are on the roster exactly once (${again.roster})`, again.roster === 1);
    ok(`the camp does not offer them again (${again.state.note})`, again.state.shown === false);
    ok('nor draw a card for somebody standing behind you', again.state.card === '');
    ok(`and the exit does not pay an empty-camp bounty for them (${again.paid})`, again.paid === 0);
    ok(`while still costing the tier it costs (${again.t0} -> ${again.tier})`,
      again.tier === again.t0 + 1);

    // ── The other two quiet nodes still exit the same way ───────────────────────────
    const quiet = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      pendingPerkOffers = [];
      const t0 = currentTier, n0 = runStats.nodes;
      finishEvent();
      const afterEvent = { tier: currentTier, nodes: runStats.nodes };
      finishShop();
      const afterShop = { tier: currentTier, nodes: runStats.nodes };
      finishCamp();
      return { t0, n0, afterEvent, afterShop, tier: currentTier, nodes: runStats.nodes };
    });
    ok(`an event still clears its node (${quiet.t0} -> ${quiet.afterEvent.tier})`,
      quiet.afterEvent.tier === quiet.t0 + 1 && quiet.afterEvent.nodes === quiet.n0 + 1);
    ok(`and so does a shop (${quiet.afterEvent.tier} -> ${quiet.afterShop.tier})`,
      quiet.afterShop.tier === quiet.afterEvent.tier + 1 && quiet.afterShop.nodes === quiet.afterEvent.nodes + 1);
    ok(`and a camp, which is the fourth copy of those three lines (${quiet.afterShop.tier} -> ${quiet.tier})`,
      quiet.tier === quiet.afterShop.tier + 1 && quiet.nodes === quiet.afterShop.nodes + 1);
  }
};

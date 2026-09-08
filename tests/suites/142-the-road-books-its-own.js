// H08. Every consequence in the game was booked by picking an option on an event card - 15
// sites, 10 in EVENT_POOL and 5 in FOLLOWUPS, and not one anywhere else. The system resolves
// correctly at every node type (F08 put a fuse on quiet nodes, G04 fixed the ones that missed
// their moment) and had exactly one thing feeding it.
//
// The rate the item was filed on - 1.09 a run - was the harness rather than the game: --faces
// warm takes the standing-raising option and the booking choices are mostly the greedy ones, so
// the ceiling measured ~2.7 a run against ~0.9 taken. The SOURCE claim is what survived, and it
// needed no sample at all - it is a fact about where bookConsequence is called.
//
// A forced cache is the first road-side source. AMBUSH was written for it years before there was
// a cache to write it for: "Whoever left that cache was waiting for whoever took it." A chance
// rather than a certainty, because 2.2 caches a run at ~75% forced would book 1.6 fuses a run on
// its own and drown every other source in the game.
//
// Measured at 0.35: bookings 0.9 -> 1.3-1.6 a run, sources EVENT 59-70% / CACHE 30-41%, depth
// unmoved across all three thirds, wipes +0.2 and separated. That last one is not a regression
// to be tuned away - H06 added income and had to be neutral; this adds a COST, and a consequence
// that costs nothing does nothing. The test that matters is that runs do not end sooner, and
// they do not.
module.exports = {
  name: 'The road books its own',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      // A cache whose lock wants somebody the STARTING seven contains, so the clean door can
      // actually be driven. Picking any node at all deals a recruit-only lock about a third of
      // the time - HAZMAT, TRENCH_FIEND and HARPOONER are not on the roster at run start - and
      // the clean-door staging then had nobody to field and silently returned null.
      window.__atCache = () => {
        for (let tries = 0; tries < 60; tries++) {
          currentSlot = 1; confirmNewGame(1.0);
          const n = sectorMap.nodes.find(x => x.tier > 1
            && ROSTER_TEMPLATE.some(r => r.classType === lockForNode(x.id).cls));
          if (!n) continue;
          n.type = 'CACHE';
          currentNodeId = n.id; currentTier = n.tier;
          pendingConsequences = [];
          return { id: n.id, lock: lockForNode(n.id) };
        }
        return null;
      };
      // Force the coin, so "it is a chance" is tested as a rule rather than sampled.
      window.__coin = v => { const real = Math.random; Math.random = () => v; return () => { Math.random = real; }; };
    });

    // ── Forcing one can book; opening it clean never does ────────────────────────
    const doors = await page.evaluate(() => {
      const run = (clean, coin) => {
        const at = window.__atCache();
        // Put the right operator on the line for the clean door, nobody for the forced one.
        playerRoster.forEach(c => { c.gridPos = 0; });
        if (clean) { const who = playerRoster.find(c => c.classType === at.lock.cls);
                     if (!who) return null; who.gridPos = 1; who.hp = who.maxHp; }
        else { const other = playerRoster.find(c => c.classType !== at.lock.cls);
               other.gridPos = 1; other.hp = other.maxHp; }
        initiateCache();
        const restore = window.__coin(coin);
        openCache(clean);
        restore();
        return pendingConsequences.map(c => ({ kind: c.kind, dueAt: c.dueAt }));
      };
      return { forcedHit: run(false, 0), forcedMiss: run(false, 0.99),
               cleanHit: run(true, 0), cleanMiss: run(true, 0.99) };
    });
    ok('the map staged a cache whose lock the starting seven can open',
      doors.cleanHit !== null && doors.cleanMiss !== null);
    ok(`forcing a cache can book a fuse (${JSON.stringify(doors.forcedHit)})`,
      doors.forcedHit.length === 1 && doors.forcedHit[0].kind === 'AMBUSH');
    ok(`and on the other side of the coin it does not (${doors.forcedMiss.length} booked)`,
      doors.forcedMiss.length === 0);
    ok('opening it clean never books, whichever way the coin falls',
      doors.cleanHit !== null && doors.cleanHit.length === 0 && doors.cleanMiss.length === 0);

    // ── The chance is the engine's constant, and it is a chance ──────────────────
    const odds = await page.evaluate(() => {
      const at = window.__atCache();
      // Either side of the constant, so the boundary is the constant rather than a number
      // written twice. A rate is not sampled here - the coin is held.
      const fire = coin => {
        window.__atCache();
        playerRoster.forEach(c => { c.gridPos = 0; });
        const other = playerRoster.find(c => c.classType !== at.lock.cls);
        other.gridPos = 1; other.hp = other.maxHp;
        initiateCache();
        const restore = window.__coin(coin);
        openCache(false);
        restore();
        return pendingConsequences.length;
      };
      return { chance: CACHE_AMBUSH_CHANCE,
               under: fire(CACHE_AMBUSH_CHANCE - 0.01),
               over: fire(CACHE_AMBUSH_CHANCE + 0.01) };
    });
    ok(`the chance is a constant the engine owns (${odds.chance})`,
      typeof odds.chance === 'number' && odds.chance > 0 && odds.chance < 1);
    ok('under it, the fuse is booked', odds.under === 1);
    ok('over it, nothing is', odds.over === 0);

    // ── The fuse is the engine's own, counted in nodes ───────────────────────────
    const fuse = await page.evaluate(() => {
      const at = window.__atCache();
      playerRoster.forEach(c => { c.gridPos = 0; });
      const other = playerRoster.find(c => c.classType !== at.lock.cls);
      other.gridPos = 1; other.hp = other.maxHp;
      runStats.nodes = 7;
      initiateCache();
      const restore = window.__coin(0); openCache(false); restore();
      const booked = pendingConsequences[0];
      return { booked, table: CONSEQUENCE_FUSE.AMBUSH, at: 7,
               // finishQuietNode has already advanced the node count by the time this reads.
               cleared: runStats.nodes };
    });
    ok(`the fuse length comes from the table, not a number beside the call (${fuse.table})`,
      fuse.booked && fuse.booked.dueAt === fuse.at + fuse.table);
    ok(`and it is counted from the node that lit it (${fuse.at} + ${fuse.table} = ${fuse.booked.dueAt})`,
      fuse.booked.dueAt > fuse.cleared);

    // ── And it actually comes due and resolves ───────────────────────────────────
    // A booking nothing collects is worse than no booking: G04 is the phase that found fuses
    // landing on nodes that could not deliver them.
    const lands = await page.evaluate(() => {
      const at = window.__atCache();
      playerRoster.forEach(c => { c.gridPos = 0; });
      [0, 1, 2].forEach(i => { const c = playerRoster.filter(x => x.classType !== at.lock.cls)[i];
                               if (c) { c.gridPos = i + 1; c.hp = c.maxHp; } });
      runStats.nodes = 0;
      initiateCache();
      const restore = window.__coin(0); openCache(false); restore();
      const owed = pendingConsequences.length;
      const due0 = consequencesDue().length;
      runStats.nodes = CONSEQUENCE_FUSE.AMBUSH;
      const dueNow = consequencesDue().length;
      const before = deployed().map(c => c.hp);
      resolveConsequence();
      const after = deployed().map(c => c.hp);
      return { owed, due0, dueNow, before, after, left: pendingConsequences.length,
               fuse: CONSEQUENCE_FUSE.AMBUSH };
    });
    ok(`the fuse is not due the moment it is lit (${lands.due0} due at nought nodes)`, lands.due0 === 0);
    ok(`and is due once the road has been walked (${lands.dueNow} due at ${lands.fuse} nodes)`,
      lands.dueNow === 1);
    ok(`resolving it costs the squad (${lands.before.join(',')} -> ${lands.after.join(',')})`,
      lands.after.some((h, i) => h < lands.before[i]));
    ok('and takes the booking off the books', lands.left === 0);

    // ── The point of the phase: more than one source ─────────────────────────────
    // Read off the engine's own source rather than sampled, which is how the single-source
    // finding was established in the first place. Counted, not enumerated: a third source
    // arriving should not turn this red, a drop back to one should.
    const sources = await page.evaluate(() => {
      const src = String(openCache) + String(signOnRecruit) + String(leaveRecruit);
      return { cacheBooks: /bookConsequence\(/.test(String(openCache)),
               kinds: Object.keys(CONSEQUENCE_POOL),
               fuses: Object.keys(CONSEQUENCE_FUSE) };
    });
    ok('a node resolver books a consequence, not only an event card', sources.cacheBooks === true);
    ok(`every kind the pool defines has a fuse length (${sources.kinds.join(', ')})`,
      sources.kinds.every(k => sources.fuses.includes(k)));

    // ── The cache still pays what it paid ────────────────────────────────────────
    // The fuse is a tail on the choice, not a tax on it - if forcing quietly started paying
    // less as well, the decision would have been changed twice and only one of them measured.
    const unchanged = await page.evaluate(() => {
      const at = window.__atCache();
      playerRoster.forEach(c => { c.gridPos = 0; });
      const other = playerRoster.find(c => c.classType !== at.lock.cls);
      other.gridPos = 1; other.hp = other.maxHp;
      initiateCache();
      scrap = 0;
      const expect = cachePayout(false);
      const restore = window.__coin(0); openCache(false); restore();
      return { expect, got: scrap, booked: pendingConsequences.length };
    });
    ok(`a forced cache pays exactly what it always did (${unchanged.got} of ${unchanged.expect})`,
      unchanged.got === unchanged.expect);
    ok('with the fuse on top rather than instead', unchanged.booked === 1);
  }
};

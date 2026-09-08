// H06. Measured across three samples of 100 runs: 62-64% of every routing decision offered
// nothing but a fight, and the median run takes 55-58 of them to reach sector 3. The map has
// camps, events, shops and recruits, but they are 24-26% of what is on offer. The road is a
// corridor with furniture, and that premise - unlike most of this batch - survived measurement.
//
// The cache is one node against it, and the one the brief listed that is solved with the ROSTER
// rather than the action bar: every cache is sealed against a particular trade, and the operator
// who knows that trade opens it clean. Anybody can force one, for less, and it costs a bite.
//
// Held here: that the lock cannot be rerolled, that the clean door is the LINE rather than the
// roster, that both doors pay and only one bites, that the bite cannot end a run, and that a
// reload lands back on the open cache rather than losing the node. Deliberately NOT held: how
// many locks there are. 112 asserted the requisition shelf had exactly three things on it and
// went red the moment H03 added a fourth - the anti-pattern 132 records. An eleventh lock should
// not turn this file red; a lock naming a class nobody can field should.
module.exports = {
  name: 'A cache that wants somebody',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      // Stand a run on a cache node of a chosen lock, with a chosen class on the line.
      // Find a node whose SEEDED lock satisfies a predicate, so nothing here overrides the
      // engine's own derivation - the lock is never assigned, only searched for.
      //
      // The retry is not decoration. A map carries at most 27 eligible nodes and there are ten
      // locks, so a given lock is absent from a fresh map about 6% of the time; the first cut of
      // this helper returned null there, left currentNodeId unset, and the reload assertion
      // failed with no relation to what it was testing. Two mutants died on it by accident and
      // that is what exposed it - a flake worth roughly one battery in seventeen.
      window.__cacheWhere = (pred, opts = {}) => {
        for (let tries = 0; tries < 40; tries++) {
          currentSlot = 1; confirmNewGame(1.0);
          currentSector = opts.sector || 1;
          const want = sectorMap.nodes.find(n => n.tier > 1 && pred(lockForNode(n.id)));
          if (want) {
            want.type = 'CACHE';
            currentNodeId = want.id; currentTier = want.tier;
            return { id: want.id, lock: lockForNode(want.id) };
          }
        }
        return null;
      };
      // Any cache at all, when the test does not care which lock.
      window.__cache = (lockId, opts = {}) =>
        window.__cacheWhere(l => !lockId || l.id === lockId, opts);
      // One whose opener is in the starting seven, for the tests that need to field them.
      window.__cacheStarter = opts =>
        window.__cacheWhere(l => ROSTER_TEMPLATE.some(r => r.classType === l.cls), opts);
      window.__line = classes => {
        playerRoster.forEach(c => { c.gridPos = 0; });
        classes.forEach((cls, i) => {
          const who = playerRoster.find(c => c.classType === cls);
          if (who) { who.gridPos = i + 1; who.hp = who.maxHp; }
        });
        return deployed().map(c => c.classType);
      };
    });

    // ── Every lock names somebody the game can actually field ────────────────────
    const table = await page.evaluate(() => {
      const fieldable = new Set([...ROSTER_TEMPLATE, ...(typeof RECRUIT_POOL !== 'undefined' ? RECRUIT_POOL : [])]
        .map(r => r.classType));
      return CACHE_LOCKS.map(l => ({
        id: l.id, cls: l.cls, fieldable: fieldable.has(l.cls),
        named: classLabel(l.cls),
        prose: !!(l.seal && l.clean && l.forced && l.name)
      }));
    });
    ok(`every lock wants somebody the game can field (${table.map(t => `${t.cls}${t.fieldable ? '' : '!'}`).join(', ')})`,
      table.length > 0 && table.every(t => t.fieldable));
    ok('every lock says how it is sealed, how it opens and what forcing costs',
      table.every(t => t.prose));
    ok(`and names its operator the way the rest of the game does (${table.map(t => t.named).slice(0, 3).join(', ')}...)`,
      table.every(t => t.named && t.named !== t.cls));
    // Not "there are ten" - that a class is a key to at most one thing, so the map's promise is
    // specific. A duplicate would make two different locks read identically to the player.
    const clsList = table.map(t => t.cls);
    ok(`no class is the key to two different locks (${new Set(clsList).size} classes over ${clsList.length} locks)`,
      new Set(clsList).size === clsList.length);

    // ── The lock belongs to the node, and cannot be rerolled ─────────────────────
    const stable = await page.evaluate(() => {
      const at = window.__cache();
      if (!at) return { staged: null, found: false };
      const id = at.id;
      const first = lockForNode(id).id;
      const again = lockForNode(id).id;
      initiateCache();
      const staged = pendingCache.lock;
      // A reload between opening the node and deciding must not deal a different lock.
      saveGameState();
      pendingCache = null;
      loadGameState();
      return { found: true, id, first, again, staged,
               afterLoad: pendingCache && pendingCache.lock,
               node: pendingCache && pendingCache.nodeId };
    });
    ok('the map put a cache somewhere to test on', stable.found === true);
    ok(`the same node gives the same lock twice (${stable.first})`, stable.first === stable.again);
    ok('and the node stages the lock it was drawn with', stable.staged === stable.first);
    ok(`a reload keeps it rather than rerolling (${stable.afterLoad})`,
      stable.afterLoad === stable.first && stable.node === stable.id);

    // ── The clean door is the LINE, not the roster ───────────────────────────────
    // Which is the whole of why it is a decision: everybody owns a medic, and only some lines
    // have brought one.
    const lineOnly = await page.evaluate(() => {
      const at = window.__cacheStarter();
      const lock = at.lock;
      // On the bench: owned, not deployed.
      window.__line(ROSTER_TEMPLATE.map(r => r.classType).filter(c => c !== lock.cls).slice(0, 3));
      const owned = playerRoster.some(c => c.classType === lock.cls);
      const benched = cacheOpener(lock);
      // Now on the line.
      window.__line([lock.cls]);
      const fielded = cacheOpener(lock);
      // And down does not count either - a body on the floor is not opening anything.
      const who = deployed().find(c => c.classType === lock.cls);
      who.hp = 0;
      const downed = cacheOpener(lock);
      return { cls: lock.cls, owned, benched: !!benched, fielded: !!fielded, downed: !!downed };
    });
    ok(`owning the ${lineOnly.cls} is not enough (${lineOnly.owned ? 'on the roster' : 'absent'})`,
      lineOnly.owned === true && lineOnly.benched === false);
    ok('fielding them is', lineOnly.fielded === true);
    ok('and somebody on the floor is not opening anything', lineOnly.downed === false);

    // ── Both doors pay; the engine's own multiplier says how much ────────────────
    const paid = await page.evaluate(() => {
      const run = clean => {
        const at = window.__cacheStarter();
        const lock = at.lock;
        window.__line(clean ? [lock.cls, ...ROSTER_TEMPLATE.map(r => r.classType).filter(c => c !== lock.cls).slice(0, 1)]
                            : ROSTER_TEMPLATE.map(r => r.classType).filter(c => c !== lock.cls).slice(0, 2));
        initiateCache();
        scrap = 0;
        const before = deployed().map(c => ({ id: c.id, hp: c.hp, maxHp: c.maxHp }));
        const tier = currentTier;
        openCache(clean);
        const bit = deployed().map(c => {
          const w = before.find(b => b.id === c.id);
          return w ? w.hp - c.hp : 0;
        });
        return { paid: scrap, bitten: bit.filter(x => x > 0).length, worst: Math.max(0, ...bit),
                 tier, after: currentTier, staged: pendingCache };
      };
      const forced = run(false);
      const cleanly = run(true);
      return { forced, cleanly, base: CACHE_SCRAP, mult: CACHE_CLEAN_MULT, bite: CACHE_FORCE_BITE };
    });
    ok(`forcing pays the base (${paid.forced.paid})`, paid.forced.paid > 0);
    ok(`opening it clean pays the engine's multiple of that (${paid.forced.paid} -> ${paid.cleanly.paid}, x${paid.mult})`,
      paid.cleanly.paid === Math.floor(paid.forced.paid * paid.mult) && paid.cleanly.paid > paid.forced.paid);
    ok(`forcing takes a bite out of exactly one of them (${paid.forced.bitten} bitten, worst ${paid.forced.worst})`,
      paid.forced.bitten === 1 && paid.forced.worst > 0);
    ok('opening it clean takes nothing', paid.cleanly.bitten === 0);
    ok(`both doors finish the node (${paid.forced.tier} -> ${paid.forced.after})`,
      paid.forced.after === paid.forced.tier + 1 && paid.cleanly.after === paid.cleanly.tier + 1);
    ok('and clear the cache behind them',
      paid.forced.staged === null && paid.cleanly.staged === null);

    // ── The bite cannot be the thing that ends a run ─────────────────────────────
    // A node that is not a fight should not be able to kill somebody, and a squad at one health
    // is exactly the squad most tempted to force one.
    const survivable = await page.evaluate(() => {
      const at = window.__cache();
      const lock = at.lock;
      window.__line(ROSTER_TEMPLATE.map(r => r.classType).filter(c => c !== lock.cls).slice(0, 3));
      deployed().forEach(c => { c.hp = 1; });
      initiateCache();
      openCache(false);
      const line = playerRoster.filter(c => c.gridPos > 0);
      return { hp: line.map(c => c.hp), standing: line.filter(c => c.hp > 0).length, of: line.length };
    });
    ok(`a squad at one health each survives forcing one (${survivable.hp.join(', ')})`,
      survivable.of > 0 && survivable.standing === survivable.of);

    // ── The clean door holds when nobody can open it ─────────────────────────────
    // The button is disabled, and the handler refuses too - the keyboard and a replayed action
    // both reach past the DOM, which is the lesson H01 recorded.
    const guarded = await page.evaluate(() => {
      const at = window.__cacheStarter();
      const lock = at.lock;
      window.__line(ROSTER_TEMPLATE.map(r => r.classType).filter(c => c !== lock.cls).slice(0, 2));
      initiateCache();
      const btn = document.getElementById('cache-clean');
      const shown = { disabled: !!btn.disabled, text: (btn.innerText || '').trim() };
      scrap = 0;
      const tier = currentTier;
      // Called the way the keyboard and a replayed action reach it - past the disabled button.
      // Caught rather than allowed to escape, because "it threw" and "it quietly paid out" are
      // different defects and the assertions below have to be able to tell them apart.
      let threw = null;
      try { openCache(true); } catch (e) { threw = e.message; }
      return { shown, threw, scrap, tier, after: currentTier, still: !!pendingCache };
    });
    ok(`the clean door is dead when nobody knows the work (${guarded.shown.text})`,
      guarded.shown.disabled === true);
    ok('and it says whose work it is rather than going blank',
      /[A-Z]/.test(guarded.shown.text) && guarded.shown.text.length > 4);
    ok(`calling it anyway does not throw (${guarded.threw || 'no throw'})`, guarded.threw === null);
    ok(`and pays nothing (${guarded.scrap})`, guarded.scrap === 0);
    ok(`and does not walk the squad past the node (${guarded.tier} -> ${guarded.after})`,
      guarded.after === guarded.tier && guarded.still === true);

    // ── The map says which lock before you step ──────────────────────────────────
    const onMap = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const n = sectorMap.nodes.find(x => x.tier > 1);
      n.type = 'CACHE';
      currentTier = n.tier; currentNodeId = null;
      renderMap();
      const btn = document.querySelector(`[data-node="${n.id}"]`);
      const lk = lockForNode(n.id);
      return { lockName: lk.name, opener: classLabel(lk.cls),
               title: btn ? btn.getAttribute('title') || '' : null,
               action: btn ? btn.getAttribute('data-action') : null,
               label: btn ? (btn.innerText || '').trim() : null };
    });
    ok(`a cache on the map is its own control (${onMap.action})`, onMap.action === 'node-cache');
    ok(`and names the lock before the squad steps (${(onMap.title || '').slice(0, 60)})`,
      !!onMap.title && onMap.title.includes(onMap.lockName));
    ok(`including who opens it clean (${onMap.opener})`,
      (onMap.title || '').includes(onMap.opener));

    // ── It pays deeper the deeper it is ──────────────────────────────────────────
    // Through sectorRewardMult, the same curve every other payout on the road is on - a flat
    // price would make a sector-5 cache worth a fifth of the fight beside it.
    const scaled = await page.evaluate(() => {
      const at = sec => { currentSector = sec; return { forced: cachePayout(false), clean: cachePayout(true) }; };
      currentSlot = 1; confirmNewGame(1.0);
      return { s1: at(1), s5: at(5) };
    });
    ok(`a deep cache is worth more than a shallow one (${scaled.s1.forced} at sector 1, ${scaled.s5.forced} at sector 5)`,
      scaled.s5.forced > scaled.s1.forced);
    ok('and the clean door keeps its edge at depth',
      scaled.s5.clean > scaled.s5.forced && scaled.s1.clean > scaled.s1.forced);
  }
};

// G09. The seed-best table holds twenty, and it was throwing away whatever sorted lowest.
//
//     if (keys.length > 20) keys.sort().slice(0, keys.length - 20).forEach(k => delete all[k]);
//
// So a seed's fate depended on its name. Measured before the fix: a favourite seed played
// first and played again ten runs later was still the first thing evicted, because "AAA-"
// sorts below "zz-". The table threw out the seed the player kept coming back to and kept
// twenty they had touched once each.
//
// The audit filed this as "custom seeds are evicted before any daily". Measured, it is the
// other way round - a daily is date-shaped and a digit sorts below a letter - but the
// substance was right: eviction went by alphabet, not by recency.
module.exports = {
  name: 'The seed you keep coming back to',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      window.__wipe = () => Store.set(SEED_BEST_KEY, JSON.stringify({}));
      window.__fill = (prefix, n, from) => {
        for (let i = 0; i < n; i++) noteSeedBest(prefix + i, (from || 10) + i);
      };
    });

    // ── The case the old rule got wrong ───────────────────────────────────────────
    const favourite = await page.evaluate(() => {
      window.__wipe();
      noteSeedBest('AAA-favourite', 500);        // played early
      window.__fill('zz-', 12);
      noteSeedBest('AAA-favourite', 400);        // come back to, and fell short
      window.__fill('yy-', 12);
      const kept = seedBests();
      return { held: 'AAA-favourite' in kept, score: kept['AAA-favourite'],
               total: Object.keys(kept).length,
               oldestStillThere: Object.keys(kept).filter(k => k.startsWith('zz-')).length };
    });
    ok(`the seed the player keeps returning to survives (${favourite.held})`, favourite.held === true);
    ok(`with its best intact rather than its last run (${favourite.score})`, favourite.score === 500);
    ok(`and the ones touched once and left go instead (${favourite.oldestStillThere} of 12 early seeds left, ${favourite.total} held)`,
      favourite.total === 20 && favourite.oldestStillThere < 12);

    // ── Evicted by when, not by name ──────────────────────────────────────────────
    const byAge = await page.evaluate(() => {
      window.__wipe();
      const order = [];
      // Named so that alphabet and age disagree: the newest sort lowest.
      for (let i = 24; i >= 1; i--) { const s = 'seed-' + String(i).padStart(2, '0');
                                      noteSeedBest(s, 100); order.push(s); }
      const kept = Object.keys(seedBests());
      return { order, kept: kept.length,
               evicted: order.filter(s => !kept.includes(s)),
               firstFour: order.slice(0, 4), lastFour: order.slice(-4) };
    });
    ok(`the four written first are the four dropped (${byAge.evicted.join(', ')})`,
      byAge.kept === 20 && byAge.evicted.join() === byAge.firstFour.join());
    ok(`and not the four that sort lowest (${byAge.lastFour.join(', ')} all kept)`,
      byAge.lastFour.every(s => !byAge.evicted.includes(s)));

    // ── Two writes in the same millisecond still order ────────────────────────────
    const sameMs = await page.evaluate(() => {
      window.__wipe();
      const t0 = Date.now();
      for (let i = 0; i < 24; i++) noteSeedBest('burst-' + String(i).padStart(2, '0'), 50);
      const rows = seedBestRows();
      const stamps = Object.keys(rows).map(k => rows[k].t);
      return { ms: Date.now() - t0, kept: stamps.length,
               distinct: new Set(stamps).size,
               rising: stamps.slice().sort((a, b) => a - b).join() === stamps.join(),
               dropped: ['burst-00', 'burst-01', 'burst-02', 'burst-03']
                 .every(k => !(k in rows)) };
    });
    ok(`a burst of writes inside ${sameMs.ms}ms still gets distinct stamps (${sameMs.distinct} of ${sameMs.kept})`,
      sameMs.distinct === sameMs.kept);
    ok('so the oldest of the burst are still the ones dropped', sameMs.dropped === true);

    // ── A table written before this reads, and evicts oldest-first ────────────────
    const migrate = await page.evaluate(() => {
      // The old shape: bare numbers, no stamps at all.
      const old = {}; for (let i = 0; i < 20; i++) old['legacy-' + i] = 300 + i;
      Store.set(SEED_BEST_KEY, JSON.stringify(old));
      const read = seedBests();
      const rows = seedBestRows();
      const scoresSurvived = Object.keys(old).every(k => read[k] === old[k]);
      const noStamps = Object.keys(rows).every(k => rows[k].t === 0);
      // A single new seed pushes one out, and it must be a legacy one.
      noteSeedBest('brand-new', 999);
      const after = Object.keys(seedBests());
      return { scoresSurvived, noStamps, kept: after.length,
               newHeld: after.includes('brand-new'),
               legacyLeft: after.filter(k => k.startsWith('legacy-')).length };
    });
    ok(`an old table still reads its scores (${migrate.scoresSurvived})`,
      migrate.scoresSurvived === true && migrate.noStamps === true);
    ok(`and the untimestamped rows are what a new seed displaces (${migrate.legacyLeft} legacy left of 20)`,
      migrate.newHeld === true && migrate.kept === 20 && migrate.legacyLeft === 19);

    // ── The contract the rest of the game reads ───────────────────────────────────
    const contract = await page.evaluate(() => {
      window.__wipe();
      noteSeedBest('SHAPE', 777);
      const prevOnReplay = noteSeedBest('SHAPE', 600);
      const raw = Store.getJSON(SEED_BEST_KEY);
      return { read: seedBests().SHAPE, type: typeof seedBests().SHAPE,
               prevOnReplay, rowKeys: Object.keys(raw.SHAPE || {}).sort().join(),
               freeRun: noteSeedBest(null, 999), cap: SEED_BESTS_KEPT };
    });
    ok(`the table still reads as a plain score (${contract.read}, a ${contract.type})`,
      contract.read === 777 && contract.type === 'number');
    ok(`a replay reports the previous best rather than overwriting it (${contract.prevOnReplay})`,
      contract.prevOnReplay === 777);
    ok(`the row underneath carries the score and the stamp (${contract.rowKeys})`,
      contract.rowKeys === 's,t');
    ok(`and a run with no seed still writes nothing (${contract.freeRun}, cap ${contract.cap})`,
      contract.freeRun === null && contract.cap === 20);

    // ── It survives a round trip through the store ────────────────────────────────
    const persists = await page.evaluate(() => {
      window.__wipe();
      noteSeedBest('KEEPER', 1200);
      window.__fill('other-', 5);
      const written = Store.getJSON(SEED_BEST_KEY);
      // Read back exactly as a fresh session would.
      const rows = seedBestRows();
      return { keeperScore: rows.KEEPER.s, keeperStamped: rows.KEEPER.t > 0,
               olderThanOthers: rows.KEEPER.t < rows['other-0'].t,
               onDisk: typeof written.KEEPER === 'object' };
    });
    ok(`what is written is what comes back (${persists.keeperScore}, stamped ${persists.keeperStamped})`,
      persists.keeperScore === 1200 && persists.keeperStamped === true && persists.onDisk === true);
    ok('and the order of writing is preserved on disk', persists.olderThanOthers === true);
  }
};

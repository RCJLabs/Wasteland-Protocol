// "0-3% of runs carried each cursed relic, one never dropped at all, and the other fourteen
// appear in 65-80% of runs each." Three claims, and the instrument was wrong under all three.
//
// The double-count fix made this file defer to the engine's own boss count - but the engine
// stages a commander's relic as pendingRelicOffer and waits for a player to pick a card, and
// the simulator never touched pendingRelicOffer. So 108 boss kills across sixty runs produced
// 11 relics: every commander offer was staged and dropped on the floor. Resolving them moved
// the uncursed pool to 32-57% of runs (not 65-80%, and not inert either), and the Overclocked
// Reactor drops fine.
//
// What survives is sharper than what was claimed. Curses ARE offered - 37 of 108 offers, about
// 0.6 a run. A policy taking the best clean card refused 35 of those 37, and the reason is in
// the construction: the offer is built [rare, common, common] and the curse overwrote the LAST
// card, so a free rare sat beside it every single time. "The good thing, or the good thing with
// a price" is not a bargain. Two changes: the curse displaces the rare, and the camp opens a
// second door when the squad is in no state to keep going, where the alternative is the heal
// it badly needs rather than a free relic.
module.exports = {
  name: 'Curses',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__run = () => { activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
                             activeRelics = []; pendingRelicOffer = null; };
    });

    // ---- every curse is real content: both halves wired, both halves stated ----
    // Read the engine's own source rather than stringifying the WP surface: half of these
    // calls live inside closures and lambdas that never appear on it.
    const wired = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const cursed = RELIC_POOL.filter(r => r.tier === 'CURSED');
      return cursed.map(r => ({
        id: r.id,
        // Both halves of the deal have to be in the text, or the button is a trick.
        twoSided: / — but /.test(r.desc),
        // and both halves have to exist in the code, not just the sentence.
        refs: src.split(`hasRelic('${r.id}')`).length - 1
      }));
    });
    ok(`all ${wired.length} curses state an upside and a cost`, wired.every(w => w.twoSided));
    ok(`and every one is read in at least two places in the engine (${wired.map(w => w.id + ':' + w.refs).join(', ')})`,
      wired.every(w => w.refs >= 2));

    // ---- the curse displaces the rare, which is the whole fix ----
    const table = await page.evaluate(() => {
      // rollRelicOffer reads nothing but activeRelics, so reset that rather than the whole run:
      // confirmNewGame per iteration is what turned this loop into a two-minute suite.
      __run();
      let withCurse = 0, curseAndRare = 0, offers = 0, sizes = {};
      for (let i = 0; i < 4000; i++) {
        activeRelics = [];
        const o = rollRelicOffer();
        if (!o.length) continue;
        offers++;
        sizes[o.length] = (sizes[o.length] || 0) + 1;
        if (o.some(r => r.tier === 'CURSED')) {
          withCurse++;
          if (o.some(r => r.tier === 'RARE')) curseAndRare++;
        }
      }
      return { offers, withCurse, curseAndRare, sizes, chance: CURSE_CHANCE };
    });
    ok(`a curse is on the table about ${(table.withCurse / table.offers * 100).toFixed(0)}% of the time`,
      Math.abs(table.withCurse / table.offers - table.chance) < 0.05);
    // The finding in one assertion: a curse must never be offered beside a free rare.
    ok(`no cursed offer also holds a rare (${table.curseAndRare} of ${table.withCurse})`,
      table.curseAndRare === 0);
    ok('a cursed offer still deals a full table of choices',
      Object.keys(table.sizes).every(k => Number(k) === 3));

    // ---- a curse is never dealt where it cannot be refused ----
    const forced = await page.evaluate(() => {
      __run();
      let drops = 0, cursedDrops = 0;
      for (let i = 0; i < 3000; i++) {
        activeRelics = [];
        const d = rollRelic();
        if (d) { drops++; if (d.tier === 'CURSED') cursedDrops++; }
      }
      // and the shop never stocks one either
      activeRelics = []; currentSector = 3; currentTier = 5;
      let shopCursed = 0;
      for (let i = 0; i < 200; i++) {
        rollShopStock();
        (activeShop && activeShop.stock || []).forEach(it => {
          const r = it.id && RELIC_POOL.find(x => x.id === it.id);
          if (r && r.tier === 'CURSED') shopCursed++;
        });
      }
      return { drops, cursedDrops, shopCursed };
    });
    ok(`an elite drop is never cursed (${forced.cursedDrops} of ${forced.drops})`, forced.cursedDrops === 0);
    ok(`and the Armory never stocks one (${forced.shopCursed})`, forced.shopCursed === 0);

    // The third door, and the only one that can hand over a curse unasked: the Magpie's table
    // trades a held relic for two blind draws. Blind has to mean blind or the gamble is a lie,
    // so this one is pinned deliberately rather than fixed.
    const magpie = await page.evaluate(() => {
      const ev = [...EVENT_POOL, ...FOLLOWUPS].find(e => /COLLECTOR'S TABLE/i.test(e.title));
      if (!ev) return { found: false };
      let cursed = 0, draws = 0;
      for (let i = 0; i < 300; i++) {
        __run();
        activeRelics = [RELIC_POOL[0]];
        const before = activeRelics.length;
        choicesFor(ev)[0].execute();
        draws += activeRelics.length - (before - 1);
        cursed += activeRelics.filter(r => r.tier === 'CURSED').length;
      }
      return { found: true, cursed, draws };
    });
    ok('the Magpie exists and deals two cards for one', magpie.found && magpie.draws > 500);
    ok(`and its draws are genuinely blind - the cursed shelf is in the pool (${magpie.cursed} in 300 sittings)`,
      magpie.cursed > 0);

    // ---- the camp door: only when the squad is in trouble ----
    const gate = await page.evaluate(() => {
      const at = f => { __run(); currentSector = 3; currentTier = 5;
                        playerRoster.forEach(x => { x.hp = x.maxHp; }); f();
                        return { desperate: squadDesperate(), offer: !!cacheOffer() }; };
      const line = () => playerRoster.filter(x => x.gridPos > 0);
      return {
        healthy: at(() => {}),
        oneHurt: at(() => { line()[0].hp = 1; }),
        twoHurt: at(() => { line().slice(0, 2).forEach(x => { x.hp = Math.floor(x.maxHp * 0.3); }); }),
        justUnder: at(() => { line().slice(0, 2).forEach(x => { x.hp = Math.floor(x.maxHp * (CACHE.hurtAt - 0.05)); }); }),
        justOver: at(() => { line().slice(0, 2).forEach(x => { x.hp = Math.ceil(x.maxHp * (CACHE.hurtAt + 0.05)); }); }),
        noFallback: at(() => { runStats.regroups = 0; }),
        outOfCurses: (() => { __run(); currentSector = 3; currentTier = 5;
                              playerRoster.filter(x => x.gridPos > 0).slice(0, 2).forEach(x => { x.hp = 1; });
                              activeRelics = RELIC_POOL.filter(r => r.tier === 'CURSED').slice();
                              return { desperate: squadDesperate(), offer: !!cacheOffer() }; })()
      };
    });
    ok('a squad in good shape is offered nothing', !gate.healthy.desperate && !gate.healthy.offer);
    ok('one operator hurt is not enough', !gate.oneHurt.offer);
    ok('two of the line badly hurt opens it', gate.twoHurt.desperate && gate.twoHurt.offer);
    ok('the health gate bites on both sides', gate.justUnder.offer && !gate.justOver.offer);
    ok('nothing left to fall back on opens it too', gate.noFallback.offer);
    ok('and it closes once every curse is aboard',
      gate.outOfCurses.desperate && !gate.outOfCurses.offer);

    // The offer must not reroll: leaving and re-entering the camp cannot shop for a nicer curse.
    const stable = await page.evaluate(() => {
      __run(); currentSector = 3; currentTier = 5; currentNodeId = 'n7';
      playerRoster.filter(x => x.gridPos > 0).slice(0, 2).forEach(x => { x.hp = 1; });
      const first = cacheOffer().id;
      const same = Array.from({ length: 20 }, () => cacheOffer().id).every(id => id === first);
      currentNodeId = 'n8';   // a different camp is a different bargain
      const moved = cacheOffer().id;
      return { same, first, moved };
    });
    ok('the same camp always offers the same curse', stable.same);

    // ---- taking it costs the camp ----
    const taking = await page.evaluate(() => {
      __run(); currentSector = 3; currentTier = 5;
      playerRoster.filter(x => x.gridPos > 0).slice(0, 2).forEach(x => { x.hp = Math.floor(x.maxHp * 0.3); });
      initiateCamp();
      const btn = document.querySelector('.camp-cache');
      const shown = btn ? btn.innerText : '';
      const offered = cacheOffer();
      const hpBefore = playerRoster.filter(x => x.gridPos > 0).map(x => x.hp);
      const matsBefore = { ...materials }, tuneBefore = tuneUpBattles;
      resolveCamp('CACHE');
      return {
        shown, id: offered.id,
        // both halves on the button, not one behind a hover
        saysGain: shown.includes(offered.desc.split(' — but ')[0]),
        saysCost: /but /i.test(shown),
        saysPrice: /no triage/i.test(shown),
        got: activeRelics.some(r => r.id === offered.id),
        healed: playerRoster.filter(x => x.gridPos > 0).map(x => x.hp).some((h, i) => h > hpBefore[i]),
        mats: JSON.stringify(materials) !== JSON.stringify(matsBefore),
        tuned: tuneUpBattles !== tuneBefore
      };
    });
    ok('the camp names the curse and both halves of it',
      taking.saysGain && taking.saysCost);
    ok('and says what taking it costs', taking.saysPrice);

    // Deep enough that the road out is open: the camp is also where a run gets banked, so the
    // cache has to say it spends that too rather than quietly closing the door behind you.
    const walkPrice = await page.evaluate(() => {
      __run(); currentSector = EXTRACT.minSector; currentTier = 5;
      playerRoster.filter(x => x.gridPos > 0).slice(0, 2).forEach(x => { x.hp = 1; });
      runStats.deepestSector = EXTRACT.minSector; runStats.bosses = 1; runStats.nodes = 20;
      runStats.scrapEarned = 900; scrap = 900;
      initiateCamp();
      const btn = document.querySelector('.camp-cache');
      return { open: canExtract(), said: !!btn && /walking out/i.test(btn.innerText) };
    });
    ok('and names the walk-out among what it spends once the road out is open',
      walkPrice.open && walkPrice.said);
    ok('taking it hands over the relic', taking.got);
    ok('and spends the camp - no heal, no materials, no tune-up',
      !taking.healed && !taking.mats && !taking.tuned);

    // A stale screen must not be able to hand over a relic the squad no longer qualifies for.
    const stale = await page.evaluate(() => {
      __run(); currentSector = 3; currentTier = 5;
      playerRoster.filter(x => x.gridPos > 0).slice(0, 2).forEach(x => { x.hp = 1; });
      initiateCamp();
      playerRoster.forEach(x => { x.hp = x.maxHp; });   // patched up in between
      const before = activeRelics.length;
      resolveCamp('CACHE');
      return { before, after: activeRelics.length };
    });
    ok('a camp screen that has gone stale hands over nothing', stale.after === stale.before);

    // ---- reachability: the two doors together put every curse in play ----
    const reach = await page.evaluate(() => {
      __run();
      currentSector = 3; currentTier = 5;
      playerRoster.filter(x => x.gridPos > 0).slice(0, 2).forEach(x => { x.hp = 1; });
      const seen = new Set();
      for (let i = 0; i < 600; i++) {
        activeRelics = [];
        rollRelicOffer().forEach(r => { if (r.tier === 'CURSED') seen.add(r.id); });
        currentNodeId = 'n' + i;
        const c = cacheOffer(); if (c) seen.add(c.id);
      }
      return { seen: [...seen], all: RELIC_POOL.filter(r => r.tier === 'CURSED').map(r => r.id) };
    });
    ok(`every curse in the pool is reachable (${reach.seen.length} of ${reach.all.length})`,
      reach.all.every(id => reach.seen.includes(id)));

    // ---- the manual ----
    const manual = await page.evaluate(() => {
      renderCodex();
      const txt = document.getElementById('codex-body').innerText;
      return { curses: RELIC_POOL.filter(r => r.tier === 'CURSED').every(r => txt.includes(r.desc)),
               camp: /camp/i.test(txt) && /no triage/i.test(txt),
               rare: /rare/i.test(txt) };
    });
    ok('the manual quotes every curse in full', manual.curses);
    ok('and explains the camp door and what it costs', manual.camp);
  }
};

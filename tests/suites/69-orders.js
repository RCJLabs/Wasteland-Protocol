// An expedition took as long as it took. Measured on a developed career it ran a median 120
// nodes, and the only way to make one shorter was to walk out early and eat the loss of having
// said you would go further. There was no way to ask for a short one - a strange gap in a game
// whose whole shape is a session.
//
// The length is declared before deploying now, next to the contracts and the ascension rung.
// The promise this suite holds is the one that makes orders honest: the road does not know
// which order you signed. Same map, same commanders, same scaling. Only the recall moves, and
// what keeping the order pays.
module.exports = {
  name: 'Orders',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__sign = (id, sector) => {
        activeContracts = []; currentSlot = 1; activeOrder = id; confirmNewGame(1.0); sectorFront = null;
        if (sector) { currentSector = sector; currentTier = TOTAL_TIERS + 1; runStats.deepestSector = sector; }
        return runStats;
      };
    });

    // ---- the table ----
    const table = await page.evaluate(() => ({
      n: ORDERS.length,
      ids: ORDERS.map(o => o.id),
      complete: ORDERS.every(o => o.id && o.name && o.desc && o.sectors > 0 && o.bonus > 0),
      // Longer is further and pays more. A shorter order that paid better would be the only
      // order anyone signed.
      rising: ORDERS.every((o, i) => i === 0 || (o.sectors > ORDERS[i - 1].sectors && o.bonus > ORDERS[i - 1].bonus)),
      longest: ORDERS[ORDERS.length - 1].sectors,
      road: FINAL_SECTOR,
      shortestReachesEnd: ORDERS.filter(o => o.sectors >= FINAL_SECTOR).length,
      fallback: !!orderById(DEFAULT_ORDER),
      unknown: orderById('NOT_AN_ORDER')
    }));
    ok(`${table.n} orders, each named, priced and given a length`, table.n >= 3 && table.complete);
    ok('longer goes further and pays more', table.rising);
    ok(`only the longest reaches the end of the road (sector ${table.road})`,
      table.longest === table.road && table.shortestReachesEnd === 1);
    ok('the default is a real one, and an invented id is not', table.fallback && table.unknown === null);

    // ---- the picker ----
    const picker = await page.evaluate(() => {
      currentSlot = 1; activeOrder = DEFAULT_ORDER; openContracts(1.0);
      const cards = [...document.querySelectorAll('.order-card')];
      const before = { on: document.querySelectorAll('.order-card.order-on').length,
                       foot: document.getElementById('contract-mult').innerText };
      dispatchAction(document.querySelector('[data-action="pick-order"][data-id="SORTIE"]'));
      const after = { order: activeOrder, on: [...document.querySelectorAll('.order-card.order-on')]
                        .map(c => c.dataset.id), foot: document.getElementById('contract-mult').innerText };
      return { count: cards.length, priced: cards.every(c => /% IF KEPT/i.test(c.innerText)), before, after };
    });
    ok(`the pre-deploy screen offers all ${table.n}`, picker.count === table.n);
    ok('with what each pays for being kept on the card', picker.priced);
    ok('exactly one is signed at a time', picker.before.on === 1 && picker.after.on.length === 1);
    ok('picking one signs it', picker.after.order === 'SORTIE' && picker.after.on[0] === 'SORTIE');
    ok(`and the footer reprices ("${picker.after.foot}")`,
      picker.after.foot !== picker.before.foot && /SORTIE/.test(picker.after.foot));

    // ---- the run remembers what it signed, and keeps remembering ----
    const memory = await page.evaluate(() => {
      __sign('SORTIE');
      const onRun = runStats.order;
      saveGameState();
      activeOrder = 'LONG'; runStats = null;
      loadGameState();
      const afterLoad = { setting: activeOrder, onRun: runStats && runStats.order, target: orderSectors() };
      // A score already banked is not re-judged by whatever the next expedition signs for.
      const banked = { order: 'SORTIE', fulfilled: true, deepestSector: 3, deepestTier: 10,
                       bosses: 3, elites: 4, kills: 90, scrapEarned: 1400,
                       contractMult: 1, protocolMult: 1, doctrineMult: 1 };
      const asSortie = computeScore(banked);
      activeOrder = 'LONG';
      const stillSortie = computeScore(banked);
      return { onRun, afterLoad, sameScore: asSortie === stillSortie, bonus: orderBonus(banked) };
    });
    ok('the run records the order it deployed under', memory.onRun === 'SORTIE');
    ok('it survives a save and a reload', memory.afterLoad.setting === 'SORTIE' && memory.afterLoad.onRun === 'SORTIE');
    ok(`and the target comes off the run (${memory.afterLoad.target})`, memory.afterLoad.target === 3);
    ok('a banked score is not re-judged by the next order signed', memory.sameScore);

    // ---- a save from before orders existed ran the whole road ----
    const old = await page.evaluate(() => {
      __sign('SORTIE'); saveGameState();
      const raw = Store.getJSON(BASE_SAVE_KEY + currentSlot);
      delete raw.activeOrder;
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw));
      activeOrder = 'SORTIE'; loadGameState();
      return activeOrder;
    });
    ok('a save from before orders loads on the long road', old === 'LONG');

    // ---- the header counts the order, not the road ----
    const header = await page.evaluate(() => {
      const read = (id, sector) => {
        activeContracts = []; currentSlot = 1; activeOrder = id; confirmNewGame(1.0); sectorFront = null;
        currentSector = sector; currentTier = 1; sectorMap = generateSectorMap();
        currentNodeId = null; clearedNodeIds = [];
        renderMap();
        const el = document.getElementById('map-sector-lbl');
        return { txt: el.innerText.replace(/\s/g, ''), title: el.title, marked: el.classList.contains('sector-last') };
      };
      return { sortie1: read('SORTIE', 1), sortie3: read('SORTIE', 3),
               long1: read('LONG', 1), past: read('SORTIE', 5) };
    });
    ok(`a sortie counts to three (${header.sortie1.txt})`, header.sortie1.txt === '1/3');
    ok(`the long road counts to ${table.road} (${header.long1.txt})`, header.long1.txt === `1/${table.road}`);
    ok('the order’s last sector is marked as last', header.sortie3.marked && /last sector of this order/i.test(header.sortie3.title));
    ok('and a run past its order stops counting', header.past.txt === '5' && /past the order/i.test(header.past.title));

    // ---- the recall ----
    const recall = await page.evaluate(() => {
      const at = (id, sector) => {
        __sign(id, sector);
        renderMap();
        return { panel: document.getElementById('map-nodes').innerText,
                 actions: [...document.querySelectorAll('#map-nodes button')].map(b => b.dataset.action) };
      };
      return { early: at('SORTIE', 2), due: at('SORTIE', 3), past: at('SORTIE', 4),
               patrol: at('PATROL', 3) };
    });
    ok('the recall comes on the order’s last sector', /ORDER FULFILLED/i.test(recall.due.panel));
    ok('with both answers on it',
      recall.due.actions.includes('order-home') && recall.due.actions.includes('advance-sector'));
    ok('not a sector early', !/ORDER FULFILLED/i.test(recall.early.panel) && recall.early.actions.includes('advance-sector'));
    ok('not a sector late', !/ORDER FULFILLED/i.test(recall.past.panel));
    ok('and a longer order is not recalled at a shorter one’s sector', !/ORDER FULFILLED/i.test(recall.patrol.panel));

    // ---- coming home ----
    const home = await page.evaluate(() => {
      __sign('SORTIE', 3);
      runStats.bosses = 3; runStats.kills = 90; runStats.elites = 4; runStats.scrapEarned = 1400;
      const skulls = bossSkulls;
      renderMap();
      dispatchAction(document.querySelector('[data-action="order-home"]'));
      const shown = [...document.querySelectorAll('#engine > div')].find(d => d.style.display === 'flex');
      return { screen: shown && shown.id,
               title: document.getElementById('runover-title').innerText,
               lines: document.getElementById('runover-lines').innerText,
               skulls: bossSkulls - skulls,
               closed: Store.getJSON(BASE_SAVE_KEY + currentSlot) === null };
    });
    ok('coming home ends the expedition', home.screen === 'screen-runover');
    ok(`and says the order was kept ("${home.title}")`, /ORDER FULFILLED/i.test(home.title));
    ok('the tally names the order and what keeping it paid', /ORDER/.test(home.lines) && /KEPT/.test(home.lines));
    ok('it pays the walk-out skulls too', home.skulls > 0);
    ok('and closes the slot behind it', home.closed);

    // Coming home is only on offer where the order says. Reached any other way - a stale button,
    // a re-entered screen - it has to refuse, or the bonus is available from anywhere.
    const refuses = await page.evaluate(() => {
      const tryAt = sector => {
        __sign('SORTIE', sector);
        const before = { slot: !!Store.getJSON(BASE_SAVE_KEY + currentSlot), sector: currentSector };
        orderHome();
        return { fulfilled: !!(runStats && runStats.fulfilled), open: before.slot };
      };
      const early = tryAt(2), late = tryAt(4), due = tryAt(3);
      return { early, late, due };
    });
    ok('coming home a sector early is refused', refuses.early.fulfilled === false);
    ok('and a sector late', refuses.late.fulfilled === false);
    ok('but taken on the sector the order names', refuses.due.fulfilled === true);

    // The run is judged by what it signed, not by what the setting happens to say now. They only
    // diverge if something changes the setting mid-run, which is exactly when reading the live
    // one would be wrong.
    const signed = await page.evaluate(() => {
      __sign('SORTIE', 3);
      activeOrder = 'LONG';                       // the setting drifts; the run does not
      return { target: orderSectors(), last: isLastOrdered(), bonus: orderBonus(),
               live: activeOrder, onRun: runStats.order };
    });
    ok(`the run is measured by the order it signed, not the setting (${signed.onRun} vs ${signed.live})`,
      signed.target === 3 && signed.last === true && Math.abs(signed.bonus - 0.20) < 0.001);

    // ---- pressing on lapses it, and it cannot be got back ----
    const lapsed = await page.evaluate(() => {
      __sign('SORTIE', 3);
      renderMap();
      dispatchAction(document.querySelector('[data-action="advance-sector"]'));
      const after = { sector: currentSector, last: isLastOrdered(), fulfilled: !!runStats.fulfilled };
      // Walked all the way to the end of the road on a Sortie: still not the order that was
      // signed, so still nothing paid for it.
      currentSector = FINAL_SECTOR; runStats.deepestSector = FINAL_SECTOR;
      noteVictory();
      return { after, wonFulfilled: !!runStats.fulfilled, won: !!runStats.won };
    });
    ok('pressing on carries the run past the order', lapsed.after.sector === 4 && !lapsed.after.last);
    ok('and the order is not fulfilled by it', lapsed.after.fulfilled === false);
    ok('nor by going the whole way afterwards', lapsed.won === true && lapsed.wonFulfilled === false);

    // ---- the long road is kept by the ending, not by a recall ----
    const long = await page.evaluate(() => {
      __sign('LONG', FINAL_SECTOR);
      runStats.deepestSector = FINAL_SECTOR;
      noteVictory();
      const won = { fulfilled: !!runStats.fulfilled, won: !!runStats.won };
      // And its recall never fires, because the ending already asked.
      renderMap();
      return { won, panel: document.getElementById('map-nodes').innerText };
    });
    ok('felling what the road ends at keeps the long road', long.won.fulfilled && long.won.won);
    ok('and no recall is put on top of the ending', !/ORDER FULFILLED/i.test(long.panel));

    // ---- what keeping it is worth ----
    const score = await page.evaluate(() => {
      const base = { deepestSector: 3, deepestTier: 10, bosses: 3, elites: 4, kills: 90,
                     scrapEarned: 1400, contractMult: 1, protocolMult: 1, doctrineMult: 1, order: 'SORTIE' };
      return { lapsedS: computeScore({ ...base, extracted: true }),
               keptS: computeScore({ ...base, extracted: true, fulfilled: true }),
               bonus: orderBonus(base),
               // A longer order pays more for the same act.
               longKept: computeScore({ ...base, order: 'LONG', extracted: true, fulfilled: true }) };
    });
    ok(`keeping a sortie pays its +${Math.round(score.bonus * 100)}%`,
      Math.abs(score.keptS / score.lapsedS - (1 + score.bonus)) < 0.01);
    ok('and a longer order pays more for the same run', score.longKept > score.keptS);

    // ---- the promise: the order only moves the recall ----
    // If a short order made the road easier it would be a difficulty setting wearing a hat.
    const sameRoad = await page.evaluate(() => {
      const walk = id => {
        activeContracts = []; currentSlot = 1; activeOrder = id; confirmNewGame(1.0);
        runSeed = 'ORDERS-COMPARE'; bossSalt = 'w0'; sectorFront = null;
        const out = [];
        for (let s = 1; s <= 3; s++) {
          currentSector = s;
          const m = generateSectorMap(seededRng('map:' + s));
          out.push({ boss: bossForSector(s).id,
                     nodes: m.nodes.map(n => `${n.tier}${n.type}${n.elite ? 'E' : ''}`).join(','),
                     hp: Math.round(difficultyMult * Math.pow(SECTOR_HP_SCALE, s - 1) * 1000) });
        }
        return out;
      };
      const a = walk('SORTIE'), b = walk('LONG');
      return { same: JSON.stringify(a) === JSON.stringify(b), sample: a[2] };
    });
    ok('the road is identical whichever order signed for it', sameRoad.same);
    ok(`including the commander waiting on it (${sameRoad.sample.boss})`, !!sameRoad.sample.boss);

    // ---- the manual, and the briefing ----
    const taught = await page.evaluate(() => {
      renderCodex();
      const txt = document.getElementById('codex-body').innerText;
      const p = PROMPTS.find(x => x.id === 'RECALL');
      return { has: /HOW LONG YOU HAVE/i.test(txt),
               named: ORDERS.every(o => txt.includes(o.name)),
               priced: ORDERS.every(o => txt.includes(`+${Math.round(o.bonus * 100)}%`)),
               lapse: /lapse/i.test(txt),
               prompt: !!p && /lapse/i.test(p.body) };
    });
    ok('the manual has an entry for the order', taught.has);
    ok('naming and pricing every one', taught.named && taught.priced);
    ok('and saying what a lapsed order pays', taught.lapse);
    ok('and there is a briefing when the recall comes', taught.prompt);
  }
};

// An event that promises something later is only worth writing if the later arrives. It mostly
// did not: 0.32 consequences resolved per run against 5.3 events seen, and the audit read that
// as a broken fuse. It was booked against a SECTOR and lit only inside advanceSector, so a debt
// "one sector on" needed a whole sector cleared, commander included - and the median run
// reaches sector 2.
//
// Fixing the fuse moved almost nothing, which is what sent me looking underneath it. Measured
// properly, only 0.17 consequences were BOOKED per run - ten across sixty expeditions, eight of
// them the same ambush. The system was not misfiring; it was barely armed. So this suite holds
// both halves: the fuse lands inside the run that lit it, and there is enough being booked, in
// enough different shapes, for that to matter.
module.exports = {
  name: 'Consequences',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__run = () => { activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
                             pendingConsequences = []; runStats.nodes = 0; };
    });

    // ---- supply: enough events book, in enough shapes ----
    const supply = await page.evaluate(() => {
      const all = [...EVENT_POOL, ...FOLLOWUPS];
      const booksOf = e => choicesFor(e).flatMap(c =>
        (String(c.execute).match(/bookConsequence\('(\w+)'/g) || []).map(m => m.match(/'(\w+)'/)[1]));
      const per = all.map(e => ({ title: e.title, kinds: booksOf(e) })).filter(e => e.kinds.length);
      const kinds = Object.keys(CONSEQUENCE_POOL);
      return { events: per.length, total: all.length, kinds,
               reached: [...new Set(per.flatMap(e => e.kinds))],
               fuse: CONSEQUENCE_FUSE,
               titles: per.map(e => e.title) };
    });
    ok(`${supply.events} of ${supply.total} events book something (was 5)`, supply.events >= 8);
    ok(`there are ${supply.kinds.length} kinds of outcome (was 3)`, supply.kinds.length >= 5);
    ok('every kind is reachable from an event', supply.kinds.every(k => supply.reached.includes(k)));
    ok('and every kind names a term', supply.kinds.every(k => supply.fuse[k] > 0));
    // A term longer than a run is a promise the game cannot keep.
    ok(`no term outlives a run (${Object.values(supply.fuse).join(', ')} nodes)`,
      Object.values(supply.fuse).every(v => v <= 8));

    // ---- the fuse is counted in nodes, and lands without a commander ----
    const fuse = await page.evaluate(() => {
      __run();
      bookConsequence('AMBUSH', 3);
      const at = n => { runStats.nodes = n; return consequencesDue().length; };
      const before = at(2), on = at(3), after = at(7);
      // and it does not need the sector to turn over
      runStats.nodes = 3;
      return { before, on, after, sector: currentSector, due: consequencesDue().length };
    });
    ok('a term of three nodes is not due at two', fuse.before === 0);
    ok('is due at three', fuse.on === 1);
    ok('and stays due after', fuse.after === 1);
    ok('without the sector having to turn over', fuse.sector === 1 && fuse.due === 1);

    // ---- what each kind actually does when it lands ----
    const fired = await page.evaluate(() => {
      const out = {};
      Object.keys(CONSEQUENCE_POOL).forEach(kind => {
        __run();
        playerRoster.forEach(u => { if (u.gridPos > 0) { u.maxHp = 100; u.hp = 60; } });
        scrap = 500; inventory = []; pursuit = null;
        materials = { parts: 0, chems: 0, tech: 0 };
        currentSector = 2; currentTier = 4;
        bookConsequence(kind, 0, { amount: 200 });
        resolveConsequence();
        out[kind] = {
          hp: playerRoster.filter(u => u.gridPos > 0).map(u => u.hp),
          scrap, bag: inventory.length,
          chased: !!(pursuit && pursuit.units && pursuit.units.length),
          title: document.getElementById('event-title').innerText,
          text: document.getElementById('event-choices').innerText,
          left: pendingConsequences.length
        };
      });
      return out;
    });
    ok('every kind resolves and clears itself',
      Object.values(fired).every(f => f.left === 0 && f.title.length > 0 && f.text.length > 0));
    ok('the debt takes the scrap', fired.DEBT.scrap < 500);
    ok('the ambush costs blood', fired.AMBUSH.hp.every(h => h < 60) && fired.AMBUSH.hp.every(h => h >= 1));
    ok('the survivor puts the squad back on its feet', fired.SURVIVOR.hp.every(h => h === 100));
    // The two new ones, which exist because eight of ten bookings used to be the same ambush.
    ok(`pursuit puts them in the next fight rather than on a screen (${fired.PURSUIT.chased})`,
      fired.PURSUIT.chased);
    ok('and does not also cost blood on the spot', fired.PURSUIT.hp.every(h => h === 60));
    ok(`resupply fills the bag and pays (${fired.RESUPPLY.bag} items)`,
      fired.RESUPPLY.bag > 0 && fired.RESUPPLY.scrap > 500);

    // Resupply is the one source of the two consumables nobody crafts.
    const stocks = await page.evaluate(() => {
      const seen = {};
      for (let i = 0; i < 200; i++) {
        __run(); inventory = []; scrap = 0;
        bookConsequence('RESUPPLY', 0); resolveConsequence();
        inventory.forEach(it => { seen[it] = (seen[it] || 0) + 1; });
      }
      return seen;
    });
    ok(`a drop can carry any consumable in the game (${Object.keys(stocks).join(', ')})`,
      ['ADRENALINE', 'EMP_CHARGE', 'MED_STIM', 'SCRAP_BOMB'].every(k => stocks[k] > 0));

    // A full bag must not silently swallow the drop.
    const full = await page.evaluate(() => {
      __run();
      inventory = new Array(metaUpgrades.invMax).fill('MED_STIM');
      scrap = 0;
      bookConsequence('RESUPPLY', 0); resolveConsequence();
      return { bag: inventory.length, cap: metaUpgrades.invMax, scrap,
               text: document.getElementById('event-choices').innerText };
    });
    ok('a drop onto a full bag overflows nothing', full.bag === full.cap);
    ok('and still pays, and says why', full.scrap > 0 && /full bag|leave the rest/i.test(full.text));

    // ---- the board shows what is owed ----
    const board = await page.evaluate(() => {
      __run(); currentTier = 2;
      renderMap();
      const quiet = document.querySelectorAll('.bounty-owed').length;
      bookConsequence('PURSUIT', 4);
      bookConsequence('DEBT', 6, { amount: 100 });
      renderMap();
      const row = document.querySelector('.bounty-owed');
      return { quiet, text: row ? row.innerText : '', n: pendingConsequences.length,
               soonest: consequenceIn() };
    });
    ok('nothing owed, nothing shown', board.quiet === 0);
    ok(`two debts read as two, counting down to the nearer (${board.text.replace(/\n/g, ' ')})`,
      board.n === 2 && board.soonest === 4 && /2 debts/.test(board.text) && /4 nodes/.test(board.text));

    // ---- a save from before the fuse moved still settles ----
    const legacy = await page.evaluate(() => {
      __run();
      pendingConsequences = [{ kind: 'AMBUSH', dueSector: 2 }];   // the old shape
      const atOne = consequencesDue().length;
      currentSector = 2;
      const atTwo = consequencesDue().length;
      return { atOne, atTwo };
    });
    ok('a consequence booked under the old sector fuse still comes due',
      legacy.atOne === 0 && legacy.atTwo === 1);

    // ---- the manual ----
    const manual = await page.evaluate(() => {
      renderCodex();
      const txt = document.getElementById('codex-body').innerText;
      return /consequence|comes due|owed/i.test(txt);
    });
    ok('the manual explains that some choices come back', manual);
  }
};

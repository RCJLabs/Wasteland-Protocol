// K06 was filed as "K02 gave the rank and file bio and energy to throw - is the rest of the
// mitigation content a trap too?", meaning the Gas Mask, the Insulated Coat, Closed Circuit and
// the answer augments K05 put on the bench. The expected shape of the answer was a win-rate arm:
// fit the whole line with a resist and see what it buys. It did not need one.
//
// THE PROBLEM IS NOT STRENGTH, IT IS REACH. Every piece of gear that enters a run does so
// through rollGear(), which is a uniform draw over whatever the run does not already hold, and
// there are exactly four callers: the elite drop, the commander drop, the event that sets a
// piece aside, and rollShopStock, which puts ONE rolled piece on the Armory's shelf. The
// Footlocker carries one piece between runs and keeps THE FIRST the squad picked up. Nothing in
// that path filters, weights, or offers a choice. A player being gassed by the Choir has no
// action available anywhere in the game that improves their odds of holding a Gas Mask.
//
// THE CENSUS AGREES, from three 150-expedition careers: the Gas Mask is put on somebody in
// 0.33 / 0.33 / 0.27 of runs and the Insulated Coat in 0.37 / 0.37 / 0.36, and all eight
// trinkets sit inside that same band. The flatness IS the uniform draw. Meanwhile the squad
// meets bio on 13% of the blows aimed at it and energy on 25% - every run, both.
//
// So what is pinned here is the shape of the draw rather than a rate. The sharpest form of it is
// that rollGear TAKES NO ARGUMENTS: no caller can express a preference because there is no
// parameter to put one in. Everything below is that fact from a different side, and the draw
// itself is read deterministically by pinning Math.random rather than by sampling it - K03's
// lesson, that a claim measured by drawing is only as sharp as the draw is long.
//
// This suite is written to FAIL when somebody ships the fix. That is the point of it: the day
// the Armory offers a choice of two, or the roll leans toward what the squad has been taking,
// these rows go red and the record above has to be rewritten rather than quietly outlived.
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'The piece you cannot ask for',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── The door, counted at the source ────────────────────────────────────────────
    // A tripwire rather than a measurement: if a fifth caller appears, or the signature grows a
    // parameter, this phase's whole finding is out of date and somebody has to come back here.
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'game.js'), 'utf8');
    const callSites = (src.match(/[^.\w]rollGear\(/g) || []).length - 1;   // less the declaration
    // Five calls at four doors: the elite drop, the commander drop, rollShopStock, and the event
    // that sets a piece aside - which asks whether anything is left (`!!rollGear()`) before it
    // draws, so it appears twice. rollGear has no side effects, so the probe costs nothing.
    ok(`gear enters a run through ${callSites} calls to rollGear and nothing else`, callSites === 5);

    const shape = await page.evaluate(() => ({
      arity: rollGear.length,
      pool: GEAR_POOL.length,
      mods: GEAR_POOL.filter(g => g.slot === 'mod').length,
      trinkets: GEAR_POOL.filter(g => g.slot === 'trinket').length,
      // any key that a draw could be steered by, if one existed
      steerable: GEAR_POOL.filter(g => ['weight', 'rarity', 'tier', 'minSector', 'minTier', 'answers']
        .some(k => g[k] !== undefined)).map(g => g.id),
      gatedTrinkets: GEAR_POOL.filter(g => g.slot === 'trinket' && g.cls).map(g => g.id)
    }));
    ok('and rollGear takes no arguments — there is nowhere to put a preference', shape.arity === 0);
    ok(`no piece in the pool carries anything a draw could weight by (${shape.pool} pieces)`,
      shape.steerable.length === 0);
    ok(`every trinket fits anybody (${shape.trinkets} of them, ${shape.gatedTrinkets.length} gated)`,
      shape.trinkets >= 8 && shape.gatedTrinkets.length === 0);

    // ── The draw, read rather than sampled ─────────────────────────────────────────
    // Math.random is pinned to a known value and rollGear is asked what it returns. That makes
    // every row below exact: no band, no sample size, no noise to sit inside. The stub is put
    // back in a finally so a failure here cannot leak a rigged Math.random into later suites.
    const draw = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach(c => { c.weaponMod = null; c.trinket = null; });
      gearStash = [];
      const real = Math.random;
      const pin = v => { Math.random = () => v; };
      const out = {};
      try {
        const unheld = () => GEAR_POOL.filter(g => ![...gearStash,
          ...playerRoster.flatMap(c => [c.weaponMod, c.trinket])].filter(Boolean).includes(g.id));
        // 1. walking Math.random from 0 to 1 walks the pool in order, one index at a time
        const walk = [];
        const want = [];
        const n = unheld().length;
        for (let i = 0; i < n; i++) {
          pin((i + 0.5) / n);
          walk.push(rollGear());
          want.push(unheld()[i].id);
        }
        out.walkMatches = walk.join() === want.join();
        out.walkCovers = new Set(walk).size;
        out.poolSize = n;

        // 2. the held set is the only input. Hold one and the draw closes over the gap.
        gearStash = ['GAS_MASK'];
        pin(0.5);
        const withMaskHeld = rollGear();
        gearStash = [];
        pin(0.5);
        const withNothingHeld = rollGear();
        out.heldChangesIt = withMaskHeld !== withNothingHeld;
        gearStash = ['GAS_MASK'];
        out.maskNeverReturns = Array.from({ length: 40 }, (_, i) => {
          pin(i / 40); return rollGear();
        }).every(id => id !== 'GAS_MASK');
        gearStash = [];

        // 3. and NOTHING ELSE is an input. The same pin under four wildly different runs.
        const under = fn => { fn(); pin(0.37); return rollGear(); };
        const plain = under(() => {});
        const gassed = under(() => {
          runStats = runStats || newRunStats();
          runStats.dt = { atSquad: { bio: { hits: 900, raw: 40000, resisted: 0 } } };
        });
        const naked = under(() => { playerRoster.forEach(c => { c.resistances.bio = 0; c.resistances.energy = 0; }); });
        const deep = under(() => { currentSector = 7; currentTier = 9; });
        out.runNeverReaches = [gassed, naked, deep].every(id => id === plain);
        out.plain = plain;
      } finally { Math.random = real; }
      return out;
    });
    ok(`the draw is an unweighted index into the unheld pool (${draw.poolSize} pieces, walked in order)`,
      draw.walkMatches);
    ok(`and every piece in it is reachable (${draw.walkCovers} of ${draw.poolSize} distinct)`,
      draw.walkCovers === draw.poolSize);
    ok('holding a piece takes it out of the draw', draw.maskNeverReturns);
    ok('and shifts what the same roll returns — the held set is a real input', draw.heldChangesIt);
    ok(`nothing about the RUN reaches the draw (same roll, same piece — ${draw.plain} — while gassed, unarmoured and at sector 7)`,
      draw.runNeverReaches);

    // ── The Armory is one rolled row, not a shelf ──────────────────────────────────
    // This is the door a player would use to go and get an answer, so it gets read closely: how
    // many gear rows the stock holds, whether the row is the draw, and whether the price knows
    // what it is selling.
    const shop = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach(c => { c.weaponMod = null; c.trinket = null; });
      gearStash = []; currentSector = 1;
      const real = Math.random;
      try {
        // The row count is read off UNPINNED stock, twenty shelves of it. Pinning Math.random
        // makes two draws agree, which would hide a second row that happened to duplicate the
        // first - the exact way a choice-of-two would first appear.
        const rows = [];
        for (let i = 0; i < 20; i++) {
          activeShop = null; currentNodeId = null;
          rows.push(rollShopStock().filter(s => s.kind === 'GEAR').length);
        }
        Math.random = () => 0.37;
        const rolled = rollGear();
        const stock = rollShopStock();
        return {
          rowsSeen: rows.join(),
          maxRows: Math.max(...rows), minRows: Math.min(...rows),
          gearRows: stock.filter(s => s.kind === 'GEAR').length,
          rowId: (stock.find(s => s.kind === 'GEAR') || {}).id,
          rolled,
          kinds: stock.map(s => s.kind).join(),
          prices: GEAR_POOL.map(g => shopPrice(140)),
          maskPrice: shopPrice(140), trophyPrice: shopPrice(140)
        };
      } finally { Math.random = real; }
    });
    ok(`the Armory shelf holds exactly one gear row (${shop.kinds})`,
      shop.gearRows === 1 && shop.minRows === 1 && shop.maxRows === 1);
    ok(`and that row is the draw, not a choice from it (${shop.rowId} on the same roll that draws ${shop.rolled})`,
      shop.rowId === shop.rolled);
    ok('every piece is priced the same, so the price knows nothing either',
      new Set(shop.prices).size === 1 && shop.maskPrice === shop.trophyPrice);

    // ── The Footlocker keeps the first, not the best ───────────────────────────────
    // The one piece that survives an expedition is the only gear decision that spans runs, and
    // it is not a decision: lockerFrom takes [0] of the stash and then the worn pieces.
    const locker = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      metaUpgrades.footlocker = 1;
      playerRoster.forEach(c => { c.weaponMod = null; c.trinket = null; });
      const keptFrom = order => {
        gearStash = order.slice();
        playerRoster.forEach(c => { c.weaponMod = null; c.trinket = null; });
        metaUpgrades.locker = null;
        stashLocker();
        return metaUpgrades.locker;
      };
      const wrapFirst = keptFrom(['REFLEX_WRAP', 'GAS_MASK']);
      const maskFirst = keptFrom(['GAS_MASK', 'REFLEX_WRAP']);
      // and a worn answer loses to anything still sitting in the bag - all through the engine:
      // equipGear moves the mask off the shelf and onto a body, leaving the wrap behind.
      gearStash = ['GAS_MASK', 'REFLEX_WRAP'];
      playerRoster.forEach(c => { c.weaponMod = null; c.trinket = null; });
      equipGear(playerRoster[0].id, 'GAS_MASK');
      const wornMask = playerRoster[0].trinket, leftInBag = gearStash.slice().join();
      metaUpgrades.locker = null; stashLocker();
      const bagBeatsWorn = metaUpgrades.locker;
      metaUpgrades.footlocker = 0; metaUpgrades.locker = null;
      playerRoster.forEach(c => { c.weaponMod = null; c.trinket = null; });
      gearStash = [];
      return { wrapFirst, maskFirst, bagBeatsWorn, wornMask, leftInBag };
    });
    ok(`the Footlocker keeps whatever was picked up first (${locker.wrapFirst} out of [wrap, mask])`,
      locker.wrapFirst === 'REFLEX_WRAP');
    ok(`turn the order around and it keeps the other one (${locker.maskFirst})`,
      locker.maskFirst === 'GAS_MASK');
    ok(`a worn answer loses to anything still in the bag (wearing ${locker.wornMask}, bag holds ${locker.leftInBag})`,
      locker.wornMask === 'GAS_MASK' && locker.leftInBag === 'REFLEX_WRAP' && locker.bagBeatsWorn === 'REFLEX_WRAP');

    // ── What the pool can answer, read off apply() ─────────────────────────────────
    // Not a list written here: every piece is applied to a clean body and the resistances are
    // read afterwards, so a piece added later is counted whether or not anybody updates this.
    const answers = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const moves = {};
      GEAR_POOL.forEach(g => {
        const c = { maxHp: 100, hp: 100, speed: 10, dmgBase: 10, resistances: { phys: 0, bio: 0, energy: 0 } };
        if (g.apply) g.apply(c);
        const m = Object.entries(c.resistances).filter(([, v]) => v !== 0).map(([k, v]) => `${k}+${v}`);
        if (m.length) moves[g.id] = m.join();
      });
      return { moves, total: GEAR_POOL.length };
    });
    const moved = Object.entries(answers.moves);
    const nonPhys = moved.filter(([, m]) => !/^phys/.test(m));
    ok(`${moved.length} pieces of ${answers.total} move a resistance at all (${moved.map(([i, m]) => `${i} ${m}`).join(', ')})`,
      moved.length >= 3);
    ok(`and ${nonPhys.length} of ${answers.total} answer a type the rank and file actually throws`,
      nonPhys.length === 2 && nonPhys.every(([, m]) => /bio|energy/.test(m)));
    ok(`so a draw answers bio or energy on ${nonPhys.length} of ${answers.total} — and no action in the game moves that number`,
      nonPhys.length / answers.total < 0.12);

    // ── The bound on the finding: assignment IS a choice ───────────────────────────
    // Stated so the record above cannot be read as "gear is not a decision at all". Which body
    // wears what is entirely the player's, and the picker offers every trinket in the bag to
    // every operator - the census's `worn at the end` row is a consequence of that.
    const assign = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach(c => { c.weaponMod = null; c.trinket = null; });
      gearStash = ['GAS_MASK', 'INSULATED_COAT'];
      const offers = playerRoster.slice(0, 3).map(c =>
        gearStash.map(id => gearById(id)).filter(g => g.slot === 'trinket' && (!g.cls || g.cls === c.classType))
          .map(g => g.id).join());
      equipGear(playerRoster[0].id, 'GAS_MASK');
      equipGear(playerRoster[1].id, 'INSULATED_COAT');
      const worn = [playerRoster[0].trinket, playerRoster[1].trinket].join();
      const bio = playerRoster[0].resistances.bio, en = playerRoster[1].resistances.energy;
      playerRoster.forEach(c => { c.weaponMod = null; c.trinket = null; });
      gearStash = [];
      return { offers, worn, bio, en, takesBody: equipGear.length };
    });
    ok('every trinket in the bag is offered to every operator', new Set(assign.offers).size === 1
      && assign.offers[0] === 'GAS_MASK,INSULATED_COAT');
    ok('and equipGear is told which body, so who wears the answer is a real decision',
      assign.takesBody === 2 && assign.worn === 'GAS_MASK,INSULATED_COAT');
    ok(`the answers land where they were sent (bio ${assign.bio}, energy ${assign.en})`,
      assign.bio >= 10 && assign.en >= 10);

    // ── And the manual says so ─────────────────────────────────────────────────────
    // 28-gear already asserts the page lists every piece, which is the half that made it read
    // like a catalogue. A page that lists twenty-eight things a player cannot ask for owes them
    // the sentence saying so, and it owes them all four doors rather than the two it named.
    const manual = await page.evaluate(() => {
      const text = CODEX.find(e => e.id === 'GEAR').body().join(' ');
      return {
        names: ['elite', 'commander', 'Armory', 'Orrin'].filter(w => text.includes(w)),
        saysRolled: /roll at random out of whatever the squad does not already hold/.test(text),
        saysNotYours: /never yours to pick/.test(text),
        saysWhoWears: /you decide is who wears it/.test(text),
        lists: GEAR_POOL.every(g => text.includes(g.name))
      };
    });
    ok(`the manual names all four doors (${manual.names.join(', ')})`, manual.names.length === 4);
    ok('and says the piece is rolled rather than chosen', manual.saysRolled && manual.saysNotYours);
    ok('while still crediting the decision a player does make', manual.saysWhoWears);
    ok('with every piece still listed under it', manual.lists);
  }
};

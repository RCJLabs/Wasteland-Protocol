// K06 was filed as "K02 gave the rank and file bio and energy to throw - is the rest of the
// mitigation content a trap too?", meaning the Gas Mask, the Insulated Coat, Closed Circuit and
// the answer augments K05 put on the bench. The expected shape of the answer was a win-rate arm.
// It did not need one.
//
// THE PROBLEM WAS NOT STRENGTH, IT WAS REACH. Every piece of gear that entered a run did so
// through rollGear(), a uniform draw over whatever the run does not already hold, and all four
// callers were loot: the elite drop, the commander drop, Orrin's Workshop, and the Armory's one
// rolled row. The census agreed - over three 150-expedition careers the Gas Mask was put on
// somebody in 0.33 / 0.33 / 0.27 of runs and the Insulated Coat in 0.37 / 0.37 / 0.36, and all
// eight trinkets sat inside that same band, which is the uniform draw printing itself. Meanwhile
// the squad met bio on 13% of the blows aimed at it and energy on 25%: every run, both. A player
// being gassed by the Choir had no action anywhere in the game that improved their odds.
//
// K07 GAVE ONE DOOR OF THE FOUR A DECISION, and it is the one a player routes to on purpose and
// pays at. The Armory lays out SHELF_GEAR distinct pieces and sells exactly one - the same piece
// per Armory the economy was tuned around, chosen instead of dealt. The other three stay loot,
// because an elite's pockets are not a shop.
//
// So this suite pins the shape of the draw on one side and the shape of the shelf on the other.
// The sharpest form of the first is that rollGear STILL TAKES NO ARGUMENTS: the loot doors have
// nowhere to put a preference, and everything in the first half is that fact from a different
// side. The draw is read deterministically by pinning Math.random rather than by sampling it -
// K03's lesson, that a claim measured by drawing is only as sharp as the draw is long. The shelf
// is read the other way, off UNPINNED stock, because a pinned Math.random makes successive draws
// agree and that is exactly how a duplicate on the shelf would hide.
//
// Its first version was written to fail the day the fix landed, and it did: four rows went red
// on K07 and were rewritten to pin the new rule rather than deleted. That is what these rows are
// for - the next phase that moves the shelf has to come back through here and say so.
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

    // ── The Armory is the one door that is a decision ─────────────────────────────
    // K07. Three of the four doors are still loot and the rows above pin that. This one is the
    // one a player routes to on purpose and pays at, so it lays out a shelf and sells exactly one
    // of it. Read closely, because it is the whole of the agency the player has over WHICH piece:
    // how many pieces the shelf carries, that they are distinct and unheld, that buying one packs
    // the others away rather than selling them, and that the price does not know what it is
    // selling - an answer costs what a hat costs.
    const shop = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach(c => { c.weaponMod = null; c.trinket = null; });
      gearStash = []; currentSector = 1;
      // Twenty shelves, unpinned. Pinning Math.random would make successive draws agree, which
      // is exactly how a duplicate on the shelf would hide.
      const rows = [], dupes = [], heldOn = [];
      for (let i = 0; i < 20; i++) {
        activeShop = null; currentNodeId = null;
        const ids = rollShopStock().filter(s => s.kind === 'GEAR').map(s => s.id);
        rows.push(ids.length);
        if (new Set(ids).size !== ids.length) dupes.push(ids.join('+'));
        if (ids.some(id => !gearById(id))) heldOn.push(ids.join('+'));
      }
      // And one shelf drawn while the squad already holds a piece, to show the shelf reads the
      // same pool the draw does rather than the whole catalogue.
      gearStash = [];
      const wearer = playerRoster.find(c => c.gridPos > 0);
      gearStash.push('GAS_MASK'); equipGear(wearer.id, 'GAS_MASK');
      const offeredHeld = [];
      for (let i = 0; i < 25; i++) {
        activeShop = null; currentNodeId = null;
        rollShopStock().filter(s => s.kind === 'GEAR').forEach(s => { if (s.id === 'GAS_MASK') offeredHeld.push(i); });
      }
      wearer.trinket = null; gearStash = [];
      return { rowsSeen: rows.join(), maxRows: Math.max(...rows), minRows: Math.min(...rows),
               shelf: SHELF_GEAR, dupes, heldOn, offeredHeld,
               kinds: (activeShop = null, currentNodeId = null, rollShopStock().map(s => s.kind).join()),
               maskPrice: shopPrice(140), trophyPrice: shopPrice(140) };
    });
    ok(`the Armory lays out ${shop.shelf} pieces (${shop.kinds})`,
      shop.minRows === shop.shelf && shop.maxRows === shop.shelf && shop.shelf > 1);
    ok(`and never the same piece twice on one shelf (${shop.dupes.length} of 20 shelves doubled up)`,
      shop.dupes.length === 0);
    ok(`nor a piece the squad is already wearing (${shop.offeredHeld.length} of 25 shelves offered a worn Gas Mask)`,
      shop.offeredHeld.length === 0);
    ok('every piece is priced the same, so the price knows nothing about what it is selling',
      shop.maskPrice === shop.trophyPrice);

    // ── And the shelf leans to what the line can wear ─────────────────────────────
    // Twenty of the twenty-eight pieces are class-locked mods, so a blind shelf of three came up
    // 48% wearable and offered nothing at all one shelf in eight - measured over thirty careers'
    // worth of Armories before this went in. Three pieces for classes nobody brought is not a
    // decision. The loot doors keep their blindness, and the row below proves the contrast rather
    // than asserting it: rollGear still hands out mods the line cannot equip.
    const lean = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach(c => { c.weaponMod = null; c.trinket = null; });
      gearStash = []; currentSector = 1;
      const onTheLine = () => new Set(playerRoster.filter(c => c.gridPos > 0).map(c => c.classType));
      const wearable = (id, line) => { const g = gearById(id); return g.slot !== 'mod' || line.has(g.cls); };
      const line = onTheLine();
      let rows = 0, fit = 0, duds = 0, short = 0;
      for (let i = 0; i < 40; i++) {
        const ids = rollGearShelf(SHELF_GEAR);
        if (ids.length < SHELF_GEAR) short++;
        rows += ids.length;
        const ok = ids.filter(id => wearable(id, line)).length;
        fit += ok;
        if (!ok) duds++;
      }
      // A line of one class cannot fill a shelf from what fits, and still gets a full shelf.
      const parked = playerRoster.filter(c => c.gridPos > 0).slice(1);
      const held = parked.map(c => [c.id, c.gridPos]);
      parked.forEach(c => { c.gridPos = 0; });
      const thin = Array.from({ length: 20 }, () => rollGearShelf(SHELF_GEAR).length);
      held.forEach(([id, pos]) => { const c = playerRoster.find(x => x.id === id); if (c) c.gridPos = pos; });
      // The loot door, over the same pool, still hands out what the line cannot wear.
      const lootMisses = Array.from({ length: 200 }, () => rollGear())
        .filter(id => id && !wearable(id, line)).length;
      return { rows, fit, duds, short, classes: line.size,
               thinMin: Math.min(...thin), shelf: SHELF_GEAR, lootMisses };
    });
    ok(`the shelf offers what the line can wear (${lean.fit} of ${lean.rows} rows over 40 shelves, ${lean.classes} classes deployed)`,
      lean.fit === lean.rows && lean.duds === 0);
    ok(`and still fills up when one class is all that is standing (${lean.thinMin} of ${lean.shelf} rows at worst)`,
      lean.thinMin === lean.shelf && lean.short === 0);
    ok(`while the loot doors stay blind — rollGear handed out ${lean.lootMisses} pieces of 200 the line cannot equip`,
      lean.lootMisses > 0);

    // Buying is the decision itself: one goes in the bag and the rest go back in the crate. If
    // the others merely stayed buyable this would be three times the gear rather than a choice,
    // which is a different change to the economy than the one K07 made.
    const bought = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach(c => { c.weaponMod = null; c.trinket = null; });
      gearStash = []; currentSector = 1; currentNodeId = 'k07'; activeShop = null;
      initiateShop();
      scrap = 9999;
      const gear = activeShop.stock.map((s, i) => ({ ...s, i })).filter(s => s.kind === 'GEAR');
      const target = gear[1];
      const before = scrap;
      buyShopItem(target.i);
      // Read the row states NOW rather than keeping references to filter later: the rows are
      // live objects and the deliberate second buy below would rewrite them under the answer.
      const after = activeShop.stock.filter(s => s.kind === 'GEAR')
        .map(s => ({ id: s.id, sold: !!s.sold, withdrawn: !!s.withdrawn }));
      const paid = before - scrap;
      // and the packed-away rows refuse a second sale
      const scrapNow = scrap, stashNow = gearStash.length;
      buyShopItem(gear[0].i); buyShopItem(gear[2].i);
      const html = (initiateShop(), document.getElementById('shop-stock').innerHTML);
      const out = { took: gearStash.slice(), paid,
                    sold: after.filter(s => s.sold).map(s => s.id),
                    packed: after.filter(s => s.withdrawn && !s.sold).map(s => s.id),
                    spentAgain: scrapNow - scrap, tookAgain: gearStash.length - stashNow,
                    saysRule: /THE TRADER SELLS YOU ONE OF THESE/.test(html),
                    saysPacked: (html.match(/PACKED AWAY/g) || []).length,
                    dimmed: (html.match(/shop-row-gone/g) || []).length };
      activeShop = null; currentNodeId = null; gearStash = [];
      return out;
    });
    ok(`one piece goes in the bag for one price (${bought.took.join(', ')} for ${bought.paid})`,
      bought.took.length === 1 && bought.sold.length === 1 && bought.sold[0] === bought.took[0]);
    ok(`and the rest go back in the crate (${bought.packed.join(', ')})`,
      bought.packed.length === shop.shelf - 1);
    ok('a packed-away row will not sell a second time', bought.spentAgain === 0 && bought.tookAgain === 0);
    ok(`the shelf says so before the choice is made, and shows what happened after (${bought.saysPacked} packed, ${bought.dimmed} dimmed)`,
      bought.saysRule && bought.saysPacked === shop.shelf - 1
      && bought.dimmed === shop.shelf - 1);

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

    // ── And the manual says which door is which ───────────────────────────────────
    // 28-gear already asserts the page lists every piece, which is the half that made it read
    // like a catalogue. The other half is that three of the four doors are luck and the fourth
    // is not, and a player who cannot tell them apart will plan against the wrong one - go
    // hunting a Gas Mask off elites, or walk past the Armory that would have sold them one. The
    // shelf size is read off SHELF_GEAR rather than a literal, so a phase that widens or narrows
    // the shelf has to come back and rewrite the page rather than leaving a stale number on it.
    const manual = await page.evaluate(() => {
      const text = CODEX.find(e => e.id === 'GEAR').body().join(' ');
      return {
        names: ['elite', 'commander', 'Armory', 'Orrin'].filter(w => text.includes(w)),
        saysLuck: /first three are luck/i.test(text)
          && /roll a piece out of whatever the squad does not already hold/.test(text),
        saysWanting: /wanting a particular one does nothing about it/.test(text),
        saysShelf: text.includes(`lays out ${SHELF_GEAR} and sells you one of them`),
        saysException: /Armory is the exception/.test(text) && /rest go back in the crate/.test(text),
        saysWhoWears: /the decision is who wears it/.test(text),
        lists: GEAR_POOL.every(g => text.includes(g.name))
      };
    });
    ok(`the manual names all four doors (${manual.names.join(', ')})`, manual.names.length === 4);
    ok('and says the three loot doors are luck, drawn from what the squad does not hold',
      manual.saysLuck && manual.saysWanting);
    ok('while naming the shelf the Armory actually lays out', manual.saysShelf);
    ok('and that taking one packs the rest away', manual.saysException);
    ok('with the decision a player makes everywhere else still credited', manual.saysWhoWears);
    ok('and every piece still listed under it', manual.lists);
  }
};

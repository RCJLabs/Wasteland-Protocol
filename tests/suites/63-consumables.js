// The audit said two of the four consumables had no moment: the simulator used Med-Stims 14
// times a run and never once reached for an EMP or an Adrenaline. It was reading itself back.
// The sim only ever CRAFTED Med-Stims, so the other three were never in the bag to reach for,
// and it called installAugment zero times, hiding the three permanent upgrades that compete
// for the same three materials. Made craftable, all four get used: 8.2 / 8.3 / 6.6 / 4.8 per
// run, with 11.6 augments installed alongside. Nothing in the bag is dead weight.
//
// What IS true is that consumables were the only system in the game that never said what it
// did. Relics, gear, doctrines, tactics and every ability carry a description; these carried a
// name and a price on all three surfaces that show them. A player choosing between four
// buttons that read only "2 💻" makes the one they already understand - which is exactly the
// shape of the usage the audit measured.
//
// So this suite holds the legibility, and it holds it against the code rather than against
// itself: every description is checked by performing the thing it describes.
module.exports = {
  name: 'Consumables',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__run = () => { activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
                             materials = { parts: 9, chems: 9, tech: 9 }; inventory.length = 0; };
    });

    // ---- the table is complete, and it is the only copy of the recipe ----
    const table = await page.evaluate(() => {
      const ids = Object.keys(ITEM_DATA);
      return {
        ids,
        missing: ids.filter(k => { const i = ITEM_DATA[k];
          return !i.label || !i.short || !i.desc || !i.action || !i.mats; }),
        // Nothing in the bag may be craftable without a recipe, and no recipe may be for
        // something the bag cannot hold.
        actions: ids.map(k => ITEM_DATA[k].action),
        resolvable: ids.every(k => String(resolveConsumableItem).includes(ITEM_DATA[k].action)),
        costs: Object.fromEntries(ids.map(k => [k, itemCost(k)])),
        mats: Object.fromEntries(ids.map(k => [k, ITEM_DATA[k].mats])),
        knownMats: ids.every(k => Object.keys(ITEM_DATA[k].mats).every(m => m in materials))
      };
    });
    ok(`all ${table.ids.length} consumables carry a name, an effect and a price`, table.missing.length === 0);
    ok('every one resolves to a real combat effect', table.resolvable);
    ok('and spends only materials that exist', table.knownMats);
    ok('every price prints something', table.ids.every(k => table.costs[k].length > 0));

    // ---- the printed price is the price actually paid ----
    const paid = await page.evaluate(() => {
      const out = {};
      Object.keys(ITEM_DATA).forEach(id => {
        __run();
        const before = { ...materials };
        craftItem(id);
        out[id] = { spent: Object.fromEntries(Object.keys(materials)
                      .map(m => [m, before[m] - materials[m]]).filter(([, n]) => n !== 0)),
                    got: inventory[inventory.length - 1] };
      });
      return out;
    });
    ok('crafting spends exactly what the button says, and nothing else',
      table.ids.every(id => JSON.stringify(paid[id].spent) === JSON.stringify(table.mats[id])));
    ok('and puts the thing crafted in the bag',
      table.ids.every(id => paid[id].got === id));

    // A recipe you cannot afford must do nothing at all - not spend, not part-spend, not stock.
    const broke = await page.evaluate(() => {
      __run(); materials = { parts: 1, chems: 1, tech: 0 };
      const before = JSON.stringify(materials);
      Object.keys(ITEM_DATA).forEach(craftItem);
      return { before, after: JSON.stringify(materials), bag: inventory.length };
    });
    ok('a recipe you cannot afford takes nothing and gives nothing',
      broke.after === broke.before && broke.bag === 0);

    // ---- the workbench says what each one does ----
    const bench = await page.evaluate(() => {
      __run(); setOutpostTab('WORKBENCH');
      const btns = [...document.querySelectorAll('.craft-btn')];
      return btns.map(b => ({
        id: b.dataset.item,
        name: b.querySelector('.craft-name') ? b.querySelector('.craft-name').innerText : '',
        what: b.querySelector('.craft-what') ? b.querySelector('.craft-what').innerText : '',
        cost: b.querySelector('.craft-cost') ? b.querySelector('.craft-cost').innerText : '',
        title: b.getAttribute('title'),
        desc: ITEM_DATA[b.dataset.item].desc,
        // Measured against the BUTTON, which is what clips, not against the span's own box.
        clipped: ['.craft-name', '.craft-what', '.craft-cost'].some(sel => {
          const n = b.querySelector(sel); if (!n) return false;   // a missing line fails above, not here
          const r = document.createRange(); r.selectNodeContents(n);
          return r.getBoundingClientRect().width > b.clientWidth - 16;
        })
      }));
    });
    ok(`the workbench offers all ${table.ids.length} schematics`, bench.length === table.ids.length);
    ok('each one shows what it does, not just what it costs',
      bench.every(b => b.what.length > 0 && b.cost.length > 0));
    ok('the full sentence is on the button as a tooltip',
      bench.every(b => b.title === b.desc && b.desc.length > 20));
    ok('and nothing on a schematic is clipped at phone width', bench.every(b => !b.clipped));

    // An unaffordable schematic must still READ - that is when you are deciding what to save for.
    const greyed = await page.evaluate(() => {
      __run(); materials = { parts: 0, chems: 0, tech: 0 }; setOutpostTab('WORKBENCH');
      const btns = [...document.querySelectorAll('.craft-btn')];
      return { n: btns.length, disabled: btns.filter(b => b.disabled).length,
               readable: btns.every(b => !!b.querySelector('.craft-what')
                                      && b.querySelector('.craft-what').innerText.length > 0
                                      && !!b.getAttribute('title')) };
    });
    ok('with no materials every schematic greys out', greyed.disabled === greyed.n && greyed.n > 0);
    ok('but still says what it would make', greyed.readable);

    // ---- the Outpost bag says it too ----
    const bag = await page.evaluate(() => {
      __run(); Object.keys(ITEM_DATA).forEach(craftItem);
      setOutpostTab('WORKBENCH');
      const cells = [...document.querySelectorAll('#outpost-inventory .inv-slot:not(:disabled)')];
      return cells.map(c => ({ t: c.innerText, what: c.querySelector('.inv-what')
                                 ? c.querySelector('.inv-what').innerText : '' }));
    });
    ok(`a stocked bag lists ${bag.length} items`, bag.length === table.ids.length);
    ok('and each one carries its effect, not just its name', bag.every(b => b.what.length > 0));

    // ---- and so does the bag in combat, which is where the choice is actually made ----
    const deck = await page.evaluate(() => {
      __run(); Object.keys(ITEM_DATA).forEach(craftItem);
      playerRoster.forEach(x => { x.gridPos = 0; });
      playerRoster.slice(0, 3).forEach((x, i) => { x.gridPos = i + 1; });
      currentSector = 2; currentTier = 3;
      initiateCombat('RAIDERS', false);
      activeIndex = turnQueue.findIndex(e => e.isPlayer && e.hp > 0);
      renderCommandDeck();
      openInventoryMenu();
      const d = document.getElementById('command-deck');
      const btns = [...d.querySelectorAll('.bag-btn')];
      const back = [...d.querySelectorAll('button')].find(b => b.innerText.trim() === 'BACK');
      const dr = d.getBoundingClientRect();
      return {
        items: btns.map(b => ({ move: b.dataset.move,
                                what: b.querySelector('.item-what') ? b.querySelector('.item-what').innerText : '',
                                title: b.getAttribute('title'),
                                wide: b.scrollWidth > b.clientWidth + 1 })),
        // The way out of a menu must never be below the fold in the middle of a fight.
        backVisible: !!back && back.getBoundingClientRect().bottom <= dr.bottom + 1
      };
    });
    ok(`the combat bag shows all ${table.ids.length} items`, deck.items.length === table.ids.length);
    ok('each with the effect on the button', deck.items.every(i => i.what.length > 0));
    ok('and the sentence on hover', deck.items.every(i => i.title && i.title.length > 20));
    ok('nothing in the deck overflows its button', deck.items.every(i => !i.wide));
    ok('a full bag still leaves BACK on screen', deck.backVisible);

    // ---- every description is checked by doing the thing it describes ----
    // A wrong description is worse than none: it is the one thing a player cannot verify
    // without spending the item. So each claim below is performed against a live fight.
    const truth = await page.evaluate(() => {
      const use = (id, pick) => {
        __run();
        playerRoster.forEach(x => { x.gridPos = 0; });
        playerRoster.slice(0, 3).forEach((x, i) => { x.gridPos = i + 1; });
        currentSector = 2; currentTier = 3;
        initiateCombat('RAIDERS', false);
        inventory.length = 0; inventory.push(id);
        activeIndex = turnQueue.findIndex(e => e.isPlayer && e.hp > 0);
        const target = pick();
        const before = { hp: target.hp, stun: target.stunnedTurns || 0, bleed: target.bleedingTurns || 0 };
        pendingAction = ITEM_DATA[id].action;
        resolveConsumableItem(target.id);
        return { before, after: { hp: target.hp, stun: target.stunnedTurns || 0,
                                  bleed: target.bleedingTurns || 0 },
                 short: ITEM_DATA[id].short, desc: ITEM_DATA[id].desc,
                 maxHp: target.maxHp, left: inventory.length };
      };
      const hurtAlly = () => { const a = activeEntities.find(e => e.isPlayer && e.id !== turnQueue[activeIndex].id);
                               a.maxHp = 200; a.hp = 100; return a; };
      const foe = () => { const f = activeEntities.find(e => !e.isPlayer && e.hp > 0);
                          f.maxHp = 999; f.hp = 999; f.resistances = { phys: 0, energy: 0, bio: 0 }; return f; };
      return {
        MED_STIM: use('MED_STIM', hurtAlly),
        ADRENALINE: use('ADRENALINE', () => { const a = hurtAlly(); a.stunnedTurns = 2; a.bleedingTurns = 3; return a; }),
        SCRAP_BOMB: use('SCRAP_BOMB', foe),
        EMP_CHARGE: use('EMP_CHARGE', foe)
      };
    });
    // The numbers are read OUT of the description rather than pinned in the test, so the loop
    // closes in both directions: retune the code and the text has to follow it, reword the text
    // and the code has to back it up. A pinned 30 here would let "Heal 45" ship over a 30 heal.
    const num = (t, re) => { const m = String(t).match(re); return m ? Number(m[1]) : NaN; };
    const moved = k => Math.abs(truth[k].after.hp - truth[k].before.hp);
    ok(`"${truth.MED_STIM.short}" heals what it says (${moved('MED_STIM')})`,
      moved('MED_STIM') === num(truth.MED_STIM.short, /(\d+)/)
      && moved('MED_STIM') === num(truth.MED_STIM.desc, /heals (\d+)/i));
    ok(`"${truth.ADRENALINE.short}" clears stun and bleed and heals what it says (${moved('ADRENALINE')})`,
      truth.ADRENALINE.before.stun > 0 && truth.ADRENALINE.before.bleed > 0
      && truth.ADRENALINE.after.stun === 0 && truth.ADRENALINE.after.bleed === 0
      && moved('ADRENALINE') === num(truth.ADRENALINE.short, /\+(\d+)/)
      && moved('ADRENALINE') === num(truth.ADRENALINE.desc, /heals (\d+)/i));
    ok(`"${truth.SCRAP_BOMB.short}" takes that much off an unarmoured hostile (${moved('SCRAP_BOMB')})`,
      moved('SCRAP_BOMB') === num(truth.SCRAP_BOMB.short, /(\d+)/)
      && moved('SCRAP_BOMB') === num(truth.SCRAP_BOMB.desc, /(\d+) physical/i));
    ok(`"${truth.EMP_CHARGE.short}" takes the turn and that much with it (${moved('EMP_CHARGE')})`,
      truth.EMP_CHARGE.after.stun === 1
      && moved('EMP_CHARGE') === num(truth.EMP_CHARGE.short, /\+ ?(\d+)/)
      && moved('EMP_CHARGE') === num(truth.EMP_CHARGE.desc, /(\d+) energy/i));
    ok('and using one spends it', Object.values(truth).every(t => t.left === 0));

    // ---- the Armory, which is the fourth place one can be read ----
    const armory = await page.evaluate(() => {
      __run(); currentSector = 2; currentTier = 3;
      initiateShop();
      const rows = [...document.querySelectorAll('#shop-stock .shop-row')];
      const stim = rows.map(r => r.innerText).find(t => /Med-Stim/i.test(t));
      return { stim: stim || '', n: rows.length, desc: ITEM_DATA.MED_STIM.desc };
    });
    ok(`the Armory stocks a Med-Stim among ${armory.n} lines`, /Med-Stim/i.test(armory.stim));
    ok('and quotes the same effect the workbench does',
      armory.stim.replace(/\s+/g, ' ').includes(armory.desc.replace(/\s+/g, ' ')));

    // ---- the manual ----
    const manual = await page.evaluate(() => {
      renderCodex();
      const txt = document.getElementById('codex-body').innerText;
      return { has: /THE BAG/i.test(txt),
               named: Object.values(ITEM_DATA).every(i => txt.includes(i.desc)),
               // Augments spend the same three materials, which is the real cost of a full bag.
               tradeoff: /augment/i.test(txt) };
    });
    ok('the manual has an entry for the bag', manual.has);
    ok('and it quotes every consumable in full', manual.named);
    ok('and names what the materials are otherwise for', manual.tradeoff);
  }
};

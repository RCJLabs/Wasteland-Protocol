// ── Q02: THE BAG THAT SAT AT THE BOTTOM OF EVERY SCREEN ────────────────────────────────
//
// TACTICAL INVENTORY was a bordered panel pinned below the tab views: a title row and two rows
// of slot buttons, up on the roster tab, the workbench and the cybernetics bench alike, whether
// or not anybody wanted to look in it. On a phone that is a fifth of the screen spent on four
// boxes that mostly say EMPTY SLOT.
//
// IT IS A DRAWER NOW, shut by default, and the handle keeps the count. 44px shut against 167px
// open at 430 wide - and the 44 is suite 46's floor rather than a choice: the first cut was a
// 15px text row that met every goal below and could not be hit with a thumb.
//
// The handle keeps the count. That last part is not
// decoration: the count is what answers "why is that schematic greyed out" - craftItem refuses
// on a full bag - and hiding the count along with the slots would have traded one confusion for
// a worse one. Full turns the handle orange and says FULL on it.
//
// THE SLOTS ARE BUILT EITHER WAY and only their container is hidden, so what is in the bag is
// one style property from the screen rather than one render away from existing. Pinned, because
// the cheaper build - render the cells only when open - is the one that silently breaks every
// reader that counts them.
//
// AND THE STATE IS THE SCREEN'S, NOT THE SAVE'S. renderOutpost runs after every sell, so a
// drawer that reset on each render would be worse than no drawer; but a field in the save is a
// field every reload has to migrate, for a preference with no bearing on the run. A module
// variable, defaulting shut, is the whole of it.
const { engineUp } = require('../boot');

module.exports = {
  name: 'A bag that folds away',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`); await engineUp(page);

    const shut = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      materials = { parts: 9, chems: 9, tech: 9 };
      craftItem('MED_STIM');
      renderOutpost();
      const sect = document.getElementById('inventory-sect');
      const grid = document.getElementById('outpost-inventory');
      const btn = document.getElementById('bag-toggle');
      return {
        open: outpostBagOpen,
        gridShown: getComputedStyle(grid).display,
        cells: grid.children.length, invMax: metaUpgrades.invMax,
        count: document.getElementById('inv-count').innerText,
        held: inventory.length,
        handle: btn.innerText.replace(/\s+/g, ' ').trim(),
        expanded: btn.getAttribute('aria-expanded'),
        controls: btn.getAttribute('aria-controls'),
        boxed: !sect.classList.contains('bag-shut'),
        h: Math.round(sect.getBoundingClientRect().height),
      };
    });
    ok('the bag starts shut', shut.open === false && shut.gridShown === 'none');
    // Read off the bag rather than assumed: a fresh run does not start empty, and the first cut
    // of this row asserted 1/4 against a bag that already held one before anything was crafted.
    ok(`and the handle still carries the count ("${shut.handle}")`,
      shut.held > 0 && shut.count.startsWith(`${shut.held}/${shut.invMax}`)
      && /TACTICAL INVENTORY/.test(shut.handle));
    // THE ROW THAT STOPS THE CHEAPER BUILD. Rendering the cells only when the drawer is open
    // would pass every other row here and break anything that reads the bag without opening it.
    ok(`every slot is built even while it is hidden (${shut.cells} of ${shut.invMax})`,
      shut.cells === shut.invMax);
    ok('the handle says what it controls and whether it is open',
      shut.expanded === 'false' && shut.controls === 'outpost-inventory');
    ok('and shut, the section is the handle and not a box around one row', shut.boxed === false);

    const open = await page.evaluate(() => {
      document.getElementById('bag-toggle').click();
      const sect = document.getElementById('inventory-sect');
      const grid = document.getElementById('outpost-inventory');
      return { open: outpostBagOpen, gridShown: getComputedStyle(grid).display,
               expanded: document.getElementById('bag-toggle').getAttribute('aria-expanded'),
               caret: document.getElementById('bag-caret').innerText,
               boxed: !sect.classList.contains('bag-shut'),
               h: Math.round(sect.getBoundingClientRect().height),
               sellable: [...grid.querySelectorAll('.inv-slot:not(:disabled)')].length };
    });
    ok('pressing the handle opens it', open.open === true && open.gridShown === 'flex'
      && open.expanded === 'true' && open.boxed);
    ok(`and the drawer is the taller half of the trade (${shut.h}px shut, ${open.h}px open)`,
      open.h > shut.h);
    ok(`everything in it is there to sell (${open.sellable} of ${shut.invMax} slots filled)`,
      open.sellable === shut.held);

    // THE ROW THE WHOLE THING IS FOR. Selling re-renders the Outpost, and a drawer that shut on
    // every render would send you back to the handle after each item.
    const kept = await page.evaluate(() => {
      document.querySelector('#outpost-inventory .inv-slot:not(:disabled)').click();
      return { open: outpostBagOpen, held: inventory.length,
               shown: getComputedStyle(document.getElementById('outpost-inventory')).display };
    });
    ok(`selling from it leaves it open (${shut.held} held, ${kept.held} after)`,
      kept.open === true && kept.shown === 'flex' && kept.held === shut.held - 1);

    const closed = await page.evaluate(() => {
      document.getElementById('bag-toggle').click();
      return { open: outpostBagOpen, caret: document.getElementById('bag-caret').innerText,
               shown: getComputedStyle(document.getElementById('outpost-inventory')).display };
    });
    ok('and pressing it again shuts it', closed.open === false && closed.shown === 'none'
      && closed.caret !== open.caret);

    // A FULL BAG SAYS SO ON THE HANDLE, which is the state where the slots being hidden could
    // otherwise cost the player the reason their crafting is dead.
    const full = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      materials = { parts: 99, chems: 99, tech: 99 };
      while (inventory.length < metaUpgrades.invMax) craftItem('MED_STIM');
      renderOutpost();
      setOutpostTab('WORKBENCH');
      const craft = [...document.querySelectorAll('#crafting-grid .craft-btn')];
      return { count: document.getElementById('inv-count').innerText,
               orange: document.getElementById('bag-toggle').classList.contains('bag-full'),
               held: inventory.length, max: metaUpgrades.invMax,
               craftDead: craft.length > 0 && craft.every(b => b.disabled) };
    });
    ok(`a full bag says FULL on the handle ("${full.count}")`,
      full.held === full.max && /FULL/.test(full.count) && full.orange);
    ok('which is the reason every schematic is greyed out, on the screen with them',
      full.craftDead);
  }
};

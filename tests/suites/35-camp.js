// The Outpost was a stack of forms. It is a camp now: the squad's own sprites around a
// fire, state readable in the bodies - the hurt slumped and drained, the dead a cairn by
// the fire, the bench apart - with every form still one tap away.
module.exports = {
  name: 'The camp',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the scene fronts the outpost ----
    const scene = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      outpostView = 'scene'; outpostSheet = null;
      renderOutpost();
      return {
        sceneShown: getComputedStyle(document.getElementById('outpost-scene')).display,
        ledgerHidden: getComputedStyle(document.getElementById('outpost-ledger')).display,
        ops: document.querySelectorAll('#outpost-scene .camp-op').length,
        living: playerRoster.filter(c => c.hp > 0).length,
        fire: !!document.querySelector('#outpost-scene .camp-fire'),
        bg: !!document.querySelector('#outpost-scene .camp-bg'),
        stations: [...document.querySelectorAll('#outpost-scene .camp-station')].map(b => b.dataset.spot).join(),
        toggle: document.getElementById('outpost-view-toggle').innerText,
        returnBtn: getComputedStyle(document.querySelector('#screen-outpost .return-btn')).display
      };
    });
    ok('the camp scene fronts the outpost', scene.sceneShown === 'block' && scene.ledgerHidden === 'none');
    ok(`every living operator stands in it (${scene.ops})`, scene.ops === scene.living && scene.living >= 7);
    ok('around a fire on a real backdrop', scene.fire && scene.bg);
    ok('with three stations', scene.stations === 'WORKBENCH,MEDBAY,CYBER');
    ok('the return button never leaves the screen', scene.returnBtn !== 'none');
    ok('and the toggle offers the ledger', /LEDGER/.test(scene.toggle));

    // ---- state shows in the bodies ----
    const bodies = await page.evaluate(() => {
      const [a, b, c] = playerRoster;
      a.hp = Math.floor(a.maxHp * 0.3);
      b.gridPos = 0;
      c.hp = 0;
      renderOutpost();
      const injured = document.querySelector(`.camp-op.op-injured[data-id="${a.id}"]`);
      const benched = document.querySelector(`.camp-op.op-benched[data-id="${b.id}"]`);
      const cairn = document.querySelector(`.camp-cairn[data-id="${c.id}"]`);
      const noSprite = !document.querySelector(`.camp-op[data-id="${c.id}"]`);
      return { injured: !!injured, benched: !!benched, cairn: !!cairn && cairn.innerText.includes(c.name.toUpperCase()), noSprite };
    });
    ok('the hurt slump, drained', bodies.injured);
    ok('the bench sits apart', bodies.benched);
    ok('the dead are a cairn by the fire, not a sprite', bodies.cairn && bodies.noSprite);

    // ---- tap an operator, get their whole card ----
    const sheet = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      outpostView = 'scene'; renderOutpost();
      scrap = 500;
      const ch = playerRoster[0];
      document.querySelector(`.camp-op[data-id="${ch.id}"]`).click();
      const el = document.getElementById('outpost-sheet');
      const open = getComputedStyle(el).display === 'block';
      const named = el.innerText.includes(ch.name);
      const gearSlots = el.querySelectorAll('.gear-slot').length;
      const before = scrap;
      el.querySelector('[data-action="buy-upg"][data-kind="HP"]').click();
      const bought = scrap === before - 30;
      const stillOpen = getComputedStyle(document.getElementById('outpost-sheet')).display === 'block';
      document.querySelector('[data-action="outpost-sheet-close"]').click();
      const closed = getComputedStyle(document.getElementById('outpost-sheet')).display === 'none';
      return { open, named, gearSlots, bought, stillOpen, closed };
    });
    ok('tapping a sprite opens their full card', sheet.open && sheet.named && sheet.gearSlots === 2);
    ok('the card works from the sheet and survives the purchase', sheet.bought && sheet.stillOpen);
    ok('and closes clean', sheet.closed);

    // ---- the medbay tent ----
    const medbay = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      outpostView = 'scene'; renderOutpost();
      scrap = 500;
      const hurt = playerRoster[0]; hurt.hp = 1;
      const down = playerRoster[1]; down.hp = 0;
      document.querySelector('.camp-station[data-spot="MEDBAY"]').click();
      const el = document.getElementById('outpost-sheet');
      const open = getComputedStyle(el).display === 'block' && el.innerText.includes('MEDBAY');
      const rows = el.querySelectorAll('.medbay-row').length;
      el.querySelector(`[data-action="medbay"][data-id="${hurt.id}"]`).click();
      const healed = hurt.hp > 1;
      const stillOpen = getComputedStyle(document.getElementById('outpost-sheet')).display === 'block';
      document.getElementById('outpost-sheet').querySelector(`[data-action="medbay"][data-id="${down.id}"]`).click();
      const revived = down.hp > 0;
      playerRoster.forEach(c => { c.hp = c.maxHp; });
      outpostSheet = { kind: 'MEDBAY' }; renderOutpost();
      const quiet = document.getElementById('outpost-sheet').innerText.includes('Nobody needs the tent');
      return { open, rows, healed, stillOpen, revived, quiet };
    });
    ok('the medbay tent lists everyone who needs it', medbay.open && medbay.rows === 2);
    ok('triage and the defib work from the tent', medbay.healed && medbay.revived && medbay.stillOpen);
    ok('and a healthy squad gets a quiet night', medbay.quiet);

    // ---- the other stations jump to their ledger pages ----
    const stations = await page.evaluate(() => {
      outpostSheet = null; outpostView = 'scene'; renderOutpost();
      document.querySelector('.camp-station[data-spot="WORKBENCH"]').click();
      const bench = { view: outpostView, tab: getComputedStyle(document.getElementById('outpost-workbench-view')).display };
      outpostView = 'scene'; renderOutpost();
      document.querySelector('.camp-station[data-spot="CYBER"]').click();
      const cyber = { view: outpostView, tab: getComputedStyle(document.getElementById('outpost-cyber-view')).display };
      return { bench, cyber };
    });
    ok('the workbench station opens the workbench page', stations.bench.view === 'list' && stations.bench.tab === 'flex');
    ok('the cyber rig opens cybernetics', stations.cyber.view === 'list' && stations.cyber.tab === 'flex');

    // ---- the toggle, both ways ----
    const toggled = await page.evaluate(() => {
      outpostView = 'scene'; outpostSheet = null; renderOutpost();
      document.getElementById('outpost-view-toggle').click();
      const ledger = {
        view: outpostView,
        shown: getComputedStyle(document.getElementById('outpost-ledger')).display,
        roster: document.getElementById('outpost-roster').children.length,
        label: document.getElementById('outpost-view-toggle').innerText
      };
      document.getElementById('outpost-view-toggle').click();
      return { ledger, back: outpostView };
    });
    ok('the ledger is one tap away, all seven forms intact',
      toggled.ledger.view === 'list' && toggled.ledger.shown === 'flex' && toggled.ledger.roster === 7 && /CAMP/.test(toggled.ledger.label));
    ok('and the camp one tap back', toggled.back === 'scene');

    // ---- nothing in the scene is inert ----
    const wired = await page.evaluate(() => {
      outpostView = 'scene'; renderOutpost();
      const acts = [...document.querySelectorAll('#outpost-scene [data-action], #outpost-sheet [data-action]')]
        .map(b => b.dataset.action);
      return { missing: [...new Set(acts)].filter(a => !ACTIONS[a]) };
    });
    ok('every control in the scene routes to a real action', wired.missing.length === 0);

    // ---- the list stays what the older screens expect ----
    const compat = await page.evaluate(() => {
      outpostView = 'list'; outpostSheet = null; renderOutpost();
      return {
        roster: document.getElementById('outpost-roster').children.length,
        tabs: !!document.getElementById('tab-roster') && !!document.getElementById('tab-workbench'),
        inv: !!document.getElementById('outpost-inventory')
      };
    });
    ok('the ledger keeps every old fixture in place', compat.roster === 7 && compat.tabs && compat.inv);
  }
};

// The Citadel was a list of cards - the place the fantasy is supposed to live between runs,
// rendered as a settings menu. It is a hillside now: every meta-upgrade is a structure that
// visibly grows as it is bought, and the card list survives one toggle away as the ledger.
module.exports = {
  name: 'The Citadel, drawn',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the scene is the default view ----
    const scene = await page.evaluate(() => {
      bossSkulls = 6;
      metaUpgrades = { startScrap: 100, startLevel: 2, invMax: 6, extraRegroups: 1, vault: 0, heirloom: null };
      citadelView = 'scene'; citadelSpot = null;
      renderCitadel();
      const spots = [...document.querySelectorAll('.cit-spot')];
      return { visible: getComputedStyle(document.getElementById('citadel-scene')).display,
               listHidden: getComputedStyle(document.getElementById('citadel-list')).display,
               spots: spots.length,
               kinds: spots.map(b => b.dataset.spot).sort(),
               buttons: spots.every(b => b.tagName === 'BUTTON'),
               labelled: spots.every(b => (b.getAttribute('aria-label') || '').length > 3),
               skulls: document.querySelector('.cit-skulls').innerText,
               drawn: spots.every(b => b.querySelector('svg') !== null),
               declared: CITADEL_SPOTS.length,
               declaredKinds: CITADEL_SPOTS.map(s => s.kind).sort() };
    });
    ok('the scene is the default Citadel view', scene.visible === 'block' && scene.listHidden === 'none');
    // Counts belong in the table, not in here: the hill has to show what the table declares,
    // whatever that is, or a building added to one and not the other goes unnoticed.
    ok(`every upgrade is a structure on the hill (${scene.spots})`, scene.spots === scene.declared);
    ok('covering exactly the kinds the table declares', scene.kinds.join() === scene.declaredKinds.join());
    ok('each a real button with a spoken label', scene.buttons && scene.labelled);
    ok('each actually drawn', scene.drawn);
    ok(`the skull bank is on the hillside (${scene.skulls})`, /6/.test(scene.skulls));

    // ---- levels are visible on the structures ----
    const lit = await page.evaluate(() => {
      const glowsIn = kind => document.querySelectorAll(`.spot-${kind} .glow`).length;
      metaUpgrades.startScrap = 0; renderCitadel();
      const dark = glowsIn('SCRAP');
      metaUpgrades.startScrap = 150; renderCitadel();
      const litUp = glowsIn('SCRAP');
      const barracks = (() => { metaUpgrades.startLevel = 4; renderCitadel(); return glowsIn('LEVEL'); })();
      return { dark, litUp, barracks };
    });
    ok(`an unbought structure sits dark (${lit.dark} lights)`, lit.dark === 0);
    ok(`buying levels lights it up (${lit.litUp})`, lit.litUp === 3);
    ok('the barracks windows count its levels', lit.barracks === 3);

    // ---- affordability reads at a glance ----
    const afford = await page.evaluate(() => {
      bossSkulls = 1; renderCitadel();
      const marked = [...document.querySelectorAll('.spot-afford')].map(b => b.dataset.spot);
      bossSkulls = 200; renderCitadel();
      const flush = [...document.querySelectorAll('.spot-afford')].map(b => b.dataset.spot).sort();
      // With skulls to burn, everything standing open is buyable and everything sealed is not.
      const open = CITADEL_SPOTS.filter(sp => spotUnlocked(sp) && !spotMaxed(sp)).map(sp => sp.kind).sort();
      const sealed = CITADEL_SPOTS.filter(sp => !spotUnlocked(sp)).map(sp => sp.kind).sort();
      const cheapest = CITADEL_SPOTS.filter(sp => sp.cost === 1 && spotUnlocked(sp)).map(sp => sp.kind).sort();
      return { marked, flush, open, sealed, cheapest };
    });
    ok(`one skull marks only what one skull buys (${afford.marked.join() || 'nothing'})`,
      afford.marked.sort().join() === afford.cheapest.join());
    ok(`a full purse marks everything standing open (${afford.flush.length})`,
      afford.flush.join() === afford.open.join());
    ok(`and never a sealed one (${afford.sealed.join(', ')})`,
      afford.sealed.length > 0 && afford.sealed.every(k => !afford.flush.includes(k)));

    // ---- a structure opens its sheet, and the sheet buys ----
    await page.evaluate(() => { bossSkulls = 3; metaUpgrades.startScrap = 0; citadelSpot = null; renderCitadel(); });
    await page.click('[data-action="citadel-spot"][data-spot="SCRAP"]');
    await page.waitForTimeout(200);
    const sheet = await page.evaluate(() => ({
      shown: getComputedStyle(document.getElementById('citadel-sheet')).display,
      text: document.getElementById('citadel-sheet').innerText,
      buyable: !document.querySelector('#citadel-sheet [data-action="buy-meta"]').disabled
    }));
    ok('tapping a structure opens its sheet', sheet.shown === 'block');
    ok('naming it, its level and its price', /SCRAP CRANE/.test(sheet.text) && /LVL 0/.test(sheet.text) && /1 💀/.test(sheet.text));
    ok('with the purchase live', sheet.buyable);

    await page.click('#citadel-sheet [data-action="buy-meta"]');
    await page.waitForTimeout(200);
    const bought = await page.evaluate(() => ({
      skulls: bossSkulls, level: metaUpgrades.startScrap,
      sheetText: document.getElementById('citadel-sheet').innerText,
      glows: document.querySelectorAll('.spot-SCRAP .glow').length
    }));
    ok('buying from the sheet spends the skull and takes the level', bought.skulls === 2 && bought.level === 50);
    ok('the sheet stays open and updates', /LVL 1/.test(bought.sheetText));
    ok('and the crane visibly lights up', bought.glows === 1);

    const closed = await page.evaluate(() => {
      document.querySelector('[data-action="citadel-close"]').click();
      return getComputedStyle(document.getElementById('citadel-sheet')).display;
    });
    ok('the sheet closes', closed === 'none');

    // ---- the Vault reads its state on the hill ----
    const vault = await page.evaluate(() => {
      const read = () => document.querySelector('.spot-VAULT .cit-spot-lvl').innerText;
      metaUpgrades.vault = 0; metaUpgrades.heirloom = null; renderCitadel();
      const locked = { label: read(), bars: document.querySelectorAll('.spot-VAULT .bar').length };
      metaUpgrades.vault = 1; renderCitadel();
      const empty = { label: read(), bars: document.querySelectorAll('.spot-VAULT .bar').length };
      metaUpgrades.heirloom = 'AMMO_HOIST'; renderCitadel();
      const armed = { label: read(), ring: document.querySelectorAll('.spot-VAULT .glowring').length };
      return { locked, empty, armed };
    });
    ok('a locked Vault shows its bars', /LOCKED/.test(vault.locked.label) && vault.locked.bars === 3);
    ok('unlocking it removes them', /EMPTY/.test(vault.empty.label) && vault.empty.bars === 0);
    ok('and an armed Vault glows', /ARMED/.test(vault.armed.label) && vault.armed.ring === 1);

    // ---- the ledger survives, one toggle away ----
    await page.click('[data-action="citadel-view"]');
    await page.waitForTimeout(200);
    const ledger = await page.evaluate(() => ({
      list: getComputedStyle(document.getElementById('citadel-list')).display,
      scene: getComputedStyle(document.getElementById('citadel-scene')).display,
      cards: document.querySelectorAll('#citadel-list .upgrade-card').length,
      declared: CITADEL_SPOTS.length,
      // Each card carries the building's own state and its own buy button - the five label ids
      // that used to be hand-written into the markup are gone with the hand-written cards.
      stated: [...document.querySelectorAll('#citadel-list .upgrade-card')]
        .every(c => c.querySelector('.upgrade-header span:last-child').innerText.length > 2
                 && c.querySelector('[data-action="buy-meta"]') !== null)
    }));
    ok('the ledger view lists the cards', ledger.list !== 'none' && ledger.scene === 'none');
    ok(`one per building on the hill (${ledger.cards})`, ledger.cards === ledger.declared);
    ok('each stating where it stands and how to raise it', ledger.stated);

    await page.click('[data-action="citadel-view"]');
    await page.waitForTimeout(200);
    ok('and toggles back to the hill', await page.evaluate(() =>
      getComputedStyle(document.getElementById('citadel-scene')).display) === 'block');

    // ---- the layout holds on a phone ----
    const layout = await page.evaluate(() => {
      citadelSpot = 'VAULT'; renderCitadel();
      const screen = document.getElementById('screen-citadel');
      const back = screen.querySelector('.return-btn').getBoundingClientRect();
      const spots = [...document.querySelectorAll('.cit-spot')].map(b => b.getBoundingClientRect());
      const sceneBox = document.getElementById('citadel-scene').getBoundingClientRect();
      return { backOn: back.bottom <= window.innerHeight + 1 && back.height > 0,
               inScene: spots.every(r => r.top >= sceneBox.top - 8 && r.bottom <= sceneBox.bottom + 8),
               sideways: document.body.scrollWidth - window.innerWidth };
    });
    ok('the way out stays on screen with the sheet open', layout.backOn);
    ok('every structure sits inside the scene', layout.inScene);
    ok('and nothing scrolls sideways', layout.sideways <= 0);

    // The scene is presentation over the same actions: buying from either view moves the
    // same numbers, so nothing the ledger's suites assert can drift from what the hill shows.
    const parity = await page.evaluate(() => {
      metaUpgrades.extraRegroups = 0; bossSkulls = 8;
      citadelView = 'list'; renderCitadel();
      document.querySelector('#citadel-list [data-kind="REGROUP"]').click();
      const viaLedger = metaUpgrades.extraRegroups;
      citadelView = 'scene'; citadelSpot = 'REGROUP'; renderCitadel();
      document.querySelector('#citadel-sheet [data-kind="REGROUP"]').click();
      return { viaLedger, viaScene: metaUpgrades.extraRegroups, skulls: bossSkulls };
    });
    ok('the ledger and the hill buy through the same action', parity.viaLedger === 1 && parity.viaScene === 2 && parity.skulls === 0);
  }
};

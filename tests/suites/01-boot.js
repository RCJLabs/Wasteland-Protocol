// The regression that made the game unplayable was a set of functions that were called but
// never defined. This suite plays a whole run through the UI, so any such gap throws.
module.exports = {
  name: 'Boot and full playthrough',
  run: async ({ page, ok, base, engineUp, onScreen, settled }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    ok('title screen renders slot buttons',
      (await page.$$eval('.title-btn', els => els.filter(e => e.offsetParent).length)) >= 3);

    // H12: no sleep between these two - page.click already waits for its own target to be
    // actionable, so a fixed wait before a click is time spent proving nothing.
    await page.click('.title-btn:has-text("EMPTY")');
    await page.click('.title-btn:has-text("NORMAL")');
    // A difficulty now opens the contract board rather than deploying straight away.
    await onScreen(page, 'screen-contracts');
    ok('picking a difficulty offers the contract board',
      (await page.$eval('#screen-contracts', e => getComputedStyle(e).display)) === 'flex');
    await page.click('[data-action="begin-expedition"]');
    await onScreen(page, 'screen-muster');
    ok('deploying from it opens the muster',
      (await page.$eval('#screen-muster', e => getComputedStyle(e).display)) === 'flex');
    await page.click('[data-action="muster-deploy"]');
    await onScreen(page, 'screen-map');
    ok('and the muster deploys onto the map',
      (await page.$eval('#screen-map', e => getComputedStyle(e).display)) === 'flex');

    await page.click('.outpost-btn');
    await onScreen(page, 'screen-outpost');
    ok('outpost opens', (await page.$eval('#screen-outpost', e => getComputedStyle(e).display)) === 'flex');
    // The old loop slept 150ms per tab and then asserted `true`, which is not an assertion. Each
    // tab is waited for by the view it is supposed to raise, and that view is what gets checked.
    const TABS = { 'WORKBENCH': 'outpost-workbench-view', 'CYBERNETICS': 'outpost-cyber-view',
                   'SQUAD ROSTER': 'outpost-roster-view' };
    const raised = [];
    for (const [tab, view] of Object.entries(TABS)) {
      await page.click(`.op-tab-btn:has-text("${tab}")`);
      await settled(page, id => { const el = document.getElementById(id);
                                  return !!el && getComputedStyle(el).display !== 'none'; },
                    `the ${tab} view`, view);
      raised.push(tab);
    }
    ok(`every outpost tab raises its own view (${raised.join(', ')})`, raised.length === 3);
    await page.click('#screen-outpost .return-btn');
    await onScreen(page, 'screen-map');

    const nodes = await page.$$('.map-node:not([disabled])');
    ok('map offers a playable node', nodes.length > 0);
    await nodes[0].click();
    await onScreen(page, 'screen-combat');
    ok('combat starts', (await page.$eval('#screen-combat', e => getComputedStyle(e).display)) === 'flex');

    // H13 found this loop reporting `timeout` on two batteries in five, on a fight the retune
    // cannot reach: sector one is the one depth where both sector curves are exactly 1.0. It is
    // H12's own regression, and it is the hazard H12's commit message named and then walked into.
    // The condition it installed - "the command deck says something" - is true from the moment
    // the fight opens and stays true through every enemy turn, so each pass cost a few
    // milliseconds instead of the 220ms it replaced and the loop burned all 250 passes in a
    // couple of seconds while the turn chain was still resolving. A weaker condition than the
    // sleep it replaced, which is exactly what G06 warned about.
    //
    // renderCommandDeck is the engine's own answer to "is it your move": ENEMY TURN... is a
    // div with no button, an order to give is buttons. So wait for a CONTROL, which is the
    // thing the next line acts on. The deadline is a second guard - if the deck ever stops
    // offering one, the suite should fail in a couple of minutes rather than spend 250 waits.
    let outcome = 'timeout';
    const deadline = Date.now() + 180000;
    for (let i = 0; i < 250 && Date.now() < deadline; i++) {
      await settled(page, () => {
        const d = document.getElementById('command-deck');
        return !!d && !!d.querySelector('button:not([disabled])');
      }, 'the deck to offer a control', null, 15000).catch(() => {});
      const deck = await page.$eval('#command-deck', e => e.innerText).catch(() => '');
      if (/LOOT/i.test(deck)) { await page.click('#command-deck button'); outcome = 'victory'; break; }
      // checkWinState writes SQUAD DOWN on a wipe; nothing has ever written FAILED, so the old
      // test could not see one and the loop went on clicking a dead deck until it ran out.
      if (/SQUAD DOWN|FAILED/i.test(deck)) { await page.click('#command-deck button'); outcome = 'wipe'; break; }
      const target = await page.$('.targetable-enemy') || await page.$('.targetable-ally');
      if (target) { await target.click().catch(() => {}); continue; }
      for (const b of await page.$$('#command-deck button:not([disabled])')) {
        const t = ((await b.textContent()) || '').trim();
        if (t && !/CANCEL|BACK|BAG/i.test(t)) { await b.click().catch(() => {}); break; }
      }
    }
    ok(`combat reaches a conclusion (${outcome})`, outcome !== 'timeout');

    await page.reload();
    await engineUp(page);
    const menu = await page.$eval('#title-menu-container', e => e.innerText);
    ok('progress is saved and offered on the title screen', /SLOT 1 \[S\d/.test(menu) || /BEST RUN/.test(menu));
  }
};

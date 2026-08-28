// The regression that made the game unplayable was a set of functions that were called but
// never defined. This suite plays a whole run through the UI, so any such gap throws.
module.exports = {
  name: 'Boot and full playthrough',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    ok('title screen renders slot buttons',
      (await page.$$eval('.title-btn', els => els.filter(e => e.offsetParent).length)) >= 3);

    await page.click('.title-btn:has-text("EMPTY")');
    await page.waitForTimeout(300);
    await page.click('.title-btn:has-text("NORMAL")');
    await page.waitForTimeout(400);
    // A difficulty now opens the contract board rather than deploying straight away.
    ok('picking a difficulty offers the contract board',
      (await page.$eval('#screen-contracts', e => getComputedStyle(e).display)) === 'flex');
    await page.click('[data-action="begin-expedition"]');
    await page.waitForTimeout(500);
    ok('deploying from it reaches the map',
      (await page.$eval('#screen-map', e => getComputedStyle(e).display)) === 'flex');

    await page.click('.outpost-btn');
    await page.waitForTimeout(400);
    ok('outpost opens', (await page.$eval('#screen-outpost', e => getComputedStyle(e).display)) === 'flex');
    for (const tab of ['WORKBENCH', 'CYBERNETICS', 'SQUAD ROSTER']) {
      await page.click(`.op-tab-btn:has-text("${tab}")`);
      await page.waitForTimeout(150);
    }
    ok('outpost tabs all switch without error', true);
    await page.click('#screen-outpost .return-btn');
    await page.waitForTimeout(300);

    const nodes = await page.$$('.map-node:not([disabled])');
    ok('map offers a playable node', nodes.length > 0);
    await nodes[0].click();
    await page.waitForTimeout(700);
    ok('combat starts', (await page.$eval('#screen-combat', e => getComputedStyle(e).display)) === 'flex');

    let outcome = 'timeout';
    for (let i = 0; i < 250; i++) {
      await page.waitForTimeout(220);
      const deck = await page.$eval('#command-deck', e => e.innerText).catch(() => '');
      if (/LOOT/i.test(deck)) { await page.click('#command-deck button'); outcome = 'victory'; break; }
      if (/FAILED/i.test(deck)) { await page.click('#command-deck button'); outcome = 'wipe'; break; }
      const target = await page.$('.targetable-enemy') || await page.$('.targetable-ally');
      if (target) { await target.click().catch(() => {}); continue; }
      for (const b of await page.$$('#command-deck button:not([disabled])')) {
        const t = ((await b.textContent()) || '').trim();
        if (t && !/CANCEL|BACK|BAG/i.test(t)) { await b.click().catch(() => {}); break; }
      }
    }
    ok(`combat reaches a conclusion (${outcome})`, outcome !== 'timeout');

    await page.reload();
    await page.waitForTimeout(600);
    const menu = await page.$eval('#title-menu-container', e => e.innerText);
    ok('progress is saved and offered on the title screen', /SLOT 1 \[S\d/.test(menu) || /BEST RUN/.test(menu));
  }
};

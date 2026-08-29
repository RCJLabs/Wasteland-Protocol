// Nothing in the game explained resistances, momentum, overdrive, combos or what the position
// slots do. A player learned the resistance badges by losing a turn to a bio-immune drone.
module.exports = {
  name: 'Field manual',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    const shape = await page.evaluate(() => ({
      entries: CODEX.length,
      ids: new Set(CODEX.map(e => e.id)).size,
      titled: CODEX.every(e => e.title && e.title.length > 2),
      bodies: CODEX.map(e => ({ id: e.id, lines: e.body().length })),
      allText: CODEX.every(e => e.body().every(l => typeof l === 'string' && l.length > 0))
    }));
    ok(`the manual has ${shape.entries} entries`, shape.entries >= 6);
    ok('each with a unique id', shape.ids === shape.entries);
    ok('and a title', shape.titled);
    ok('none of them empty', shape.bodies.every(b => b.lines >= 3));
    ok('and every line is real text', shape.allText);

    // The point of building it from the live tables is that it cannot describe a system the
    // engine no longer has. Check it actually reads them rather than restating numbers.
    const live = await page.evaluate(() => {
      const text = () => CODEX.map(e => e.body().join(' ')).join(' ');
      const before = text();
      const savedCombos = COMBOS.length, savedContracts = CONTRACT_POOL.length;
      // a pairing that does not exist should not appear
      const invented = 'ABSOLUTELY_NOT_A_REAL_COMBO';
      const mentionsEveryCombo = COMBOS.every(c => before.includes(c.name));
      const mentionsEveryContract = CONTRACT_POOL.every(c => before.includes(c.name));
      const mentionsInvented = before.includes(invented);
      return { mentionsEveryCombo, mentionsEveryContract, mentionsInvented,
               savedCombos, savedContracts,
               quotesReach: before.includes(String(Math.round(REACH_PENALTY[3] * 100))),
               quotesOverdrive: before.includes(String(OVERDRIVE_AT)),
               quotesTiers: before.includes(String(TOTAL_TIERS)) };
    });
    ok(`every one of the ${live.savedCombos} pairings is listed`, live.mentionsEveryCombo);
    ok(`every one of the ${live.savedContracts} contracts is listed`, live.mentionsEveryContract);
    ok('and nothing that does not exist', !live.mentionsInvented);
    ok('the reach penalty is quoted from the engine', live.quotesReach);
    ok('so is the overdrive threshold', live.quotesOverdrive);
    ok('and the sector length', live.quotesTiers);

    // A page that lists combos has to keep listing them when a new one is added.
    const tracks = await page.evaluate(() => {
      const saved = COMBOS.slice();
      COMBOS.push({ move: 'TEST_MOVE', needs: 'oiledTurns', name: 'ZZTESTPAIRING', mult: 9 });
      const withExtra = CODEX.map(e => e.body().join(' ')).join(' ');
      COMBOS.length = 0; saved.forEach(c => COMBOS.push(c));
      const restored = CODEX.map(e => e.body().join(' ')).join(' ');
      return { picksItUp: withExtra.includes('ZZTESTPAIRING'), dropsIt: !restored.includes('ZZTESTPAIRING') };
    });
    ok('a new pairing appears in the manual without being written there', tracks.picksItUp);
    ok('and stops appearing when it is removed', tracks.dropsIt);

    // ---- the screen ----
    const screen = await page.evaluate(() => {
      renderCodex();
      const el = document.getElementById('screen-codex');
      const entries = [...document.querySelectorAll('#codex-body .codex-entry')];
      return { visible: getComputedStyle(el).display,
               entries: entries.length,
               titles: entries.map(e => e.querySelector('.codex-title').innerText),
               lines: entries.reduce((n, e) => n + e.querySelectorAll('.codex-line').length, 0),
               body: document.getElementById('codex-body'),
               scrolls: (() => { const b = document.getElementById('codex-body'); return b.scrollHeight > b.clientHeight; })(),
               screenScrolls: el.scrollHeight > el.clientHeight,
               back: (() => { const r = el.querySelector('.return-btn').getBoundingClientRect();
                              return r.bottom <= window.innerHeight + 1 && r.height > 0; })(),
               sideways: document.body.scrollWidth - window.innerWidth };
    });
    ok('the manual opens on its own screen', screen.visible === 'flex');
    ok(`rendering every entry (${screen.entries})`, screen.entries === shape.entries);
    ok('each with its title', screen.titles.every(t => t.length > 2));
    ok(`and all ${screen.lines} lines`, screen.lines === shape.bodies.reduce((n, b) => n + b.lines, 0));
    ok('the text scrolls rather than the screen', screen.scrolls && !screen.screenScrolls);
    ok('the way out stays on screen', screen.back);
    ok('and nothing scrolls sideways', screen.sideways <= 0);

    // ---- and it is reachable without reading the source ----
    await page.evaluate(() => { renderTitleScreen(); openSettings(); });
    await page.waitForTimeout(150);
    const reachable = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#screen-settings [data-action]')]
        .find(b => b.dataset.action === 'codex');
      return { present: !!btn, label: btn ? btn.innerText.trim() : null,
               inSettings: !!btn && btn.closest('#screen-settings') !== null };
    });
    ok('there is a way into it from the settings panel', reachable.present && reachable.inSettings);
    ok(`labelled for a player, not a developer (${reachable.label})`, /MANUAL|CODEX|HELP/i.test(reachable.label || ''));

    await page.click('[data-action="codex"]');
    await page.waitForTimeout(250);
    const opened = await page.evaluate(() => ({
      codex: getComputedStyle(document.getElementById('screen-codex')).display,
      entries: document.querySelectorAll('#codex-body .codex-entry').length
    }));
    ok('and clicking it opens the manual', opened.codex === 'flex' && opened.entries > 0);
    // The settings panel is an overlay, not a screen, so it survives switchScreen and will sit
    // on top of whatever opened underneath it, swallowing every click meant for the page.
    const overlay = await page.evaluate(() => ({
      settings: getComputedStyle(document.getElementById('screen-settings')).display,
      backClickable: (() => {
        const b = document.querySelector('#screen-codex .return-btn').getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return !!hit && (hit.closest('#screen-codex') !== null);
      })()
    }));
    ok('opening it dismisses the settings overlay', overlay.settings === 'none');
    ok('so the manual is actually clickable', overlay.backClickable);

    await page.click('#screen-codex .return-btn');
    await page.waitForTimeout(250);
    const closed = await page.evaluate(() => ({
      codex: getComputedStyle(document.getElementById('screen-codex')).display,
      title: getComputedStyle(document.getElementById('screen-title')).display
    }));
    ok('closing it leaves the manual', closed.codex === 'none');
    ok('and lands somewhere the player can act', closed.title === 'flex');

    // Opening it mid-run must not disturb the run.
    const midRun = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5; scrap = 321;
      const before = { sector: currentSector, tier: currentTier, scrap, roster: playerRoster.map(p => p.hp) };
      renderCodex();
      const during = getComputedStyle(document.getElementById('screen-codex')).display;
      renderMap();
      return { before, during,
               after: { sector: currentSector, tier: currentTier, scrap, roster: playerRoster.map(p => p.hp) },
               onMap: getComputedStyle(document.getElementById('screen-map')).display };
    });
    ok('the manual opens mid-run', midRun.during === 'flex');
    ok('without touching the run',
      midRun.before.sector === midRun.after.sector && midRun.before.tier === midRun.after.tier &&
      midRun.before.scrap === midRun.after.scrap &&
      midRun.before.roster.join() === midRun.after.roster.join());
    ok('and the map is still there behind it', midRun.onMap === 'flex');
  }
};

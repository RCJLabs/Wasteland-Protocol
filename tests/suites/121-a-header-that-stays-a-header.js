// F13. The map header could not shrink and listed every relic by name, so everything a run
// picked up came off the route graph underneath it. Measured before anything moved, thirteen
// relics on a phone:
//
//   320x568   panel 460px   graph  62px   0.8 node rows
//   360x640   panel 460px   graph  62px   0.8 node rows
//   390x844   panel 460px   graph 209px   2.8 node rows
//   400x800   panel 460px   graph 165px   2.2 node rows
//
// So the audit's "less than a node row" is exactly right on the two shortest phones and
// understates nothing on the taller ones: the map screen was a header with a sliver under it.
// Thirteen is not a corner case either - the harness averages eleven relics held, and the panel
// was built for three.
//
// Two changes, and they are different in kind. The hand folds to one line by default, carrying
// the two facts the list was being read for - how many, and how many pairs are up - so a closed
// panel still answers the question a player opens it with. And the panel is capped at a share
// of the screen with its own scroll and allowed to shrink, while the graph is given a floor: so
// even opened, with every relic and every pair on show, the route graph keeps most of the
// screen. The fold is the comfortable case; the cap is what makes the bad case survivable.
module.exports = {
  name: 'A header that stays a header',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      window.__hand = n => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        activeRelics = RELIC_POOL.slice(0, n).map(r => ({ ...r }));
        renderMap();
      };
      window.__geom = () => {
        const panel = document.getElementById('bounty-panel');
        const view = document.getElementById('map-nodes');
        const screen = document.getElementById('screen-map');
        const rows = [...document.querySelectorAll('#map-nodes .map-node')];
        const cs = getComputedStyle(panel);
        return { panel: Math.round(panel.getBoundingClientRect().height),
                 view: Math.round(view.getBoundingClientRect().height),
                 screen: Math.round(screen.getBoundingClientRect().height),
                 row: rows.length ? Math.round(rows[0].getBoundingClientRect().height) : 0,
                 shrink: cs.flexShrink, maxH: cs.maxHeight, overflow: cs.overflowY,
                 named: document.querySelectorAll('#relic-list .relic-item').length,
                 head: document.getElementById('relic-head').innerText.replace(/\s+/g, ' ').trim(),
                 sets: document.querySelectorAll('#set-list .set-head, #set-list .set-item').length,
                 expanded: document.getElementById('relic-head').getAttribute('aria-expanded') };
      };
    });

    // ── The route graph keeps the screen at a full hand ─────────────────────────────
    const phones = [[320, 568], [360, 640], [390, 844], [400, 800]];
    const held = [];
    for (const [w, h] of phones) {
      await page.setViewportSize({ width: w, height: h });
      held.push({ w, h, ...(await page.evaluate(() => { window.__hand(13); return window.__geom(); })) });
    }
    ok(`at thirteen relics the graph is never squeezed under a node row (${held.map(g => `${g.w}x${g.h}: ${(g.view / g.row).toFixed(1)}`).join(' | ')})`,
      held.every(g => g.row > 0 && g.view > g.row * 2));
    ok(`and keeps most of the screen rather than a sliver (${held.map(g => `${Math.round(100 * g.view / g.screen)}%`).join(' | ')})`,
      held.every(g => g.view / g.screen > 0.45));
    ok(`the panel is a header rather than the page (${held.map(g => g.panel).join(', ')}px)`,
      held.every(g => g.panel < g.screen * 0.4));

    // ── And a full hand costs the graph nothing an empty one does not ───────────────
    await page.setViewportSize({ width: 360, height: 640 });
    const cost = await page.evaluate(() => {
      window.__hand(0); const none = window.__geom();
      window.__hand(3); const few = window.__geom();
      window.__hand(13); const many = window.__geom();
      return { none, few, many };
    });
    ok(`three relics and thirteen leave the graph the same room (${cost.few.view} vs ${cost.many.view})`,
      cost.few.view === cost.many.view);
    ok(`which is what it had carrying nothing (${cost.none.view})`, cost.none.view === cost.many.view);

    // ── Folded by default, and the fold still answers the question ──────────────────
    const folded = await page.evaluate(() => { window.__hand(13); return window.__geom(); });
    ok(`the hand is folded by default (${folded.expanded})`, folded.expanded === 'false');
    ok(`with nothing listed by name (${folded.named} rows)`, folded.named === 0 && folded.sets === 0);
    ok(`but the count is on the line (${folded.head})`, /13/.test(folded.head));
    ok(`and so is what the hand adds up to (${folded.head})`, /SETS? UP/.test(folded.head));

    // ── One tap shows the whole hand ────────────────────────────────────────────────
    const opened = await page.evaluate(() => {
      document.getElementById('relic-head').click();
      const g = window.__geom();
      const names = [...document.querySelectorAll('#relic-list .relic-item')].map(e => e.innerText.trim());
      return { ...g, names, scrollable: document.getElementById('bounty-panel').scrollHeight
                                        > document.getElementById('bounty-panel').clientHeight };
    });
    ok(`tapping the line opens it (${opened.expanded})`, opened.expanded === 'true');
    ok(`every relic is named (${opened.named} of 13)`, opened.named === 13);
    ok(`and the pairs come with it (${opened.sets} rows)`, opened.sets > 0);
    ok(`the panel takes its own scroll rather than the graph's room (${opened.panel}px, scrolls ${opened.scrollable})`,
      opened.scrollable === true);
    ok(`so even opened the graph keeps its floor (${opened.view}px, ${(opened.view / opened.row).toFixed(1)} rows)`,
      opened.view > opened.row * 2);
    ok(`and the panel is still capped (${opened.maxH}, shrink ${opened.shrink}, overflow ${opened.overflow})`,
      opened.maxH !== 'none' && opened.shrink === '1' && opened.overflow === 'auto');

    // ── And folds again ─────────────────────────────────────────────────────────────
    const shut = await page.evaluate(() => {
      document.getElementById('relic-head').click();
      return window.__geom();
    });
    ok(`tapping again folds it away (${shut.expanded}, ${shut.named} named)`,
      shut.expanded === 'false' && shut.named === 0);
    ok(`and the graph is back to its full share (${shut.view}px)`, shut.view === folded.view);

    // ── The floor earns its keep on the shortest phone ─────────────────────────────
    // The cap alone is enough on a tall screen: fold or no fold, there is slack. On a 480-tall
    // one there is not, and this is where min-height on the graph does its work - it pushes the
    // panel further into its own scroll rather than letting an opened hand take the difference.
    await page.setViewportSize({ width: 320, height: 480 });
    const tight = await page.evaluate(() => {
      window.__hand(13);
      const head = document.getElementById('relic-head');
      if (head.getAttribute('aria-expanded') !== 'true') head.click();
      const g = window.__geom();
      const panel = document.getElementById('bounty-panel');
      return { ...g, scrolls: panel.scrollHeight > panel.clientHeight,
               floor: getComputedStyle(document.getElementById('map-nodes')).minHeight };
    });
    // Measured both ways while writing this: with the floor the graph holds 260px of 480 and
    // the panel folds to 49; without it the graph drops to 215 and the panel takes 94. The
    // threshold sits between those with room on each side, so it is the OUTCOME that fails when
    // the floor goes rather than the declaration - a rule that reads right and does nothing is
    // exactly what the splash rule in F12 turned out to be.
    ok(`on the shortest phone, opened, the graph still holds half the screen (${tight.view}px of ${tight.screen}, ${(tight.view / tight.row).toFixed(1)} rows)`,
      tight.expanded === 'true' && tight.view >= tight.screen * 0.5);
    ok(`with the panel pushed into its own scroll to pay for it (${tight.panel}px, scrolls ${tight.scrolls})`,
      tight.scrolls === true && tight.panel < tight.screen * 0.25);
    await page.setViewportSize({ width: 360, height: 640 });

    // ── The control is a control ────────────────────────────────────────────────────
    const a11y = await page.evaluate(() => {
      const h = document.getElementById('relic-head');
      return { role: h.getAttribute('role'), tab: h.getAttribute('tabindex'),
               titled: (h.title || '').length > 0, action: h.dataset.action };
    });
    ok(`the line is announced and reachable from a keyboard (role ${a11y.role}, tabindex ${a11y.tab})`,
      a11y.role === 'button' && a11y.tab === '0');
    ok(`and says what it does (${a11y.titled})`, a11y.titled === true && a11y.action === 'toggle-relics');

    await page.setViewportSize({ width: 1280, height: 800 });
  }
};

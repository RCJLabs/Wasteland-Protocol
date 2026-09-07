// F14. The presentation half of N13: seven things that made the game hard to read or hard to
// reach, measured before anything moved.
//
// TEXT SIZE reached nine rules out of a hundred and ninety-five. 166 fixed pixel sizes overrode
// it, so the setting moved almost nothing and the 8-to-11px text most of this game is set in
// had no working way to get bigger. Every font-size is now a rem against a root the setting
// carries. The conversion was checked the only way a mechanical change to 189 rules can be:
// every rendered element on every screen at 320, 375 and 430 was fingerprinted before and after,
// and at scale 1 nothing moved - 0 material changes, 11 sub-pixel clamp roundings, no overflow.
//
// Pinch-zoom was switched off by the viewport meta, on the game whose body text is 8 to 11px.
//
// The log's two commonest classes failed 4.5:1 against the dashboard's own ground: the base
// text at 2.66 and every damage line in the game at 1.98. The other three cleared it and are
// untouched - the log keeps its palette, and only what could not be read moves.
//
// The explainable log line carries the arithmetic behind a blow and was a plain div: the one
// surface that answers "why did that number happen" was mouse-only.
//
// Focus did not move when the screen did, nothing announced the fight, the intent icons carry
// the game's central read and nothing said what they meant, and the one-time run-locking
// overdrive choice explained itself in a title tooltip, which does not exist on touch.
module.exports = {
  name: 'Text that scales, a log you can read',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      window.__contrast = (fg, bg) => {
        const rgb = c => c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
        const lum = c => { const [r, g, b] = rgb(c).map(v => v / 255);
          const f = x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const a = lum(fg), b = lum(bg);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      };
    });

    // ── The setting reaches the type ────────────────────────────────────────────────
    await page.setViewportSize({ width: 375, height: 800 });
    const scale = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const read = () => { switchScreen('screen-outpost'); renderOutpost();
        return [...document.querySelectorAll('#screen-outpost *')]
          .filter(e => { const b = e.getBoundingClientRect(); return b.width || b.height; })
          .map(e => parseFloat(getComputedStyle(e).fontSize)); };
      globalSettings.textScale = 1; applyTextScale(); const one = read();
      globalSettings.textScale = 1.15; applyTextScale(); const mid = read();
      globalSettings.textScale = 1.3; applyTextScale(); const big = read();
      const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      globalSettings.textScale = 1; applyTextScale();
      const grew = one.filter((v, i) => big[i] > v + 0.01).length;
      const stepped = one.filter((v, i) => mid[i] > v + 0.005 && big[i] > mid[i] + 0.005).length;
      const sum = a => a.reduce((x, y) => x + y, 0);
      return { n: one.length, grew, stepped, over,
               ratio: sum(big) / sum(one), mids: sum(mid) / sum(one), steps: TEXT_STEPS };
    });
    ok(`the setting has three steps (${scale.steps.join(', ')})`, scale.steps.length === 3);
    ok(`at LARGEST almost every rendered element grows (${scale.grew} of ${scale.n})`,
      scale.grew > scale.n * 0.9);
    ok(`by about what the setting says (${scale.ratio.toFixed(2)}x against ${scale.steps[2]})`,
      Math.abs(scale.ratio - scale.steps[2]) < 0.05);
    ok(`and LARGE lands between them (${scale.mids.toFixed(2)}x against ${scale.steps[1]})`,
      Math.abs(scale.mids - scale.steps[1]) < 0.05 && scale.stepped > scale.n * 0.9);
    ok(`with nothing pushed sideways at the largest step (${scale.over}px)`, scale.over === 0);

    // ── And it reaches them because the stylesheet is in rem ────────────────────────
    const css = await page.evaluate(async () => {
      const text = await (await fetch('styles.css')).text();
      const px = (text.match(/font-size: *[\d.]+px/g) || []).length;
      const rem = (text.match(/font-size: *[\d.]+rem/g) || []).length;
      const root = /html *\{[^}]*font-size: *calc\(16px \* var\(--text-scale/.test(text);
      return { px, rem, root, scale: getComputedStyle(document.documentElement).fontSize };
    });
    ok(`no font-size is a fixed pixel value any more (${css.px} left, ${css.rem} in rem)`,
      css.px === 0 && css.rem > 150);
    ok(`and the root is what the setting moves (${css.scale})`, css.root === true);

    // ── Zoom is the player's again ─────────────────────────────────────────────────
    const zoom = await page.evaluate(() => {
      const m = document.querySelector('meta[name="viewport"]').getAttribute('content');
      return { m, blocked: /user-scalable *= *no|maximum-scale *= *1/.test(m) };
    });
    ok(`pinch-zoom is not switched off (${zoom.m})`, zoom.blocked === false);

    // ── Every log class clears 4.5:1 ───────────────────────────────────────────────
    const log = await page.evaluate(() => {
      switchScreen('screen-combat');
      initiateCombat('RAIDERS', false);
      const el = document.getElementById('log');
      const ground = getComputedStyle(document.querySelector('.dashboard')).backgroundColor;
      const probe = cls => { const d = document.createElement('div'); d.className = cls; d.innerText = 'x';
        el.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
      const rows = [['base', getComputedStyle(el).color]].concat(
        ['log-turn', 'log-heal', 'log-dmg', 'log-status', 'log-combo'].map(c => [c, probe(c)]));
      return { ground, rows: rows.map(([n, c]) => ({ n, c, ratio: window.__contrast(c, ground) })) };
    });
    log.rows.forEach(r => ok(`  ${r.n} reads at ${r.ratio.toFixed(2)}:1`, r.ratio >= 4.5));
    ok(`every log class clears 4.5:1 against its own ground (${log.ground})`,
      log.rows.every(r => r.ratio >= 4.5));

    // ── The line that explains a number is reachable ───────────────────────────────
    const explain = await page.evaluate(() => {
      const me = activeEntities.find(e => e.isPlayer);
      const foe = activeEntities.find(e => !e.isPlayer);
      applyDamageHit(foe, me, 12, 'phys', null);
      const lines = [...document.querySelectorAll('#log .log-explainable')];
      const l = lines[lines.length - 1];
      const plain = [...document.querySelectorAll('#log div:not(.log-explainable)')];
      return { n: lines.length, tab: l ? l.tabIndex : null, role: l ? l.getAttribute('role') : null,
               label: l ? (l.getAttribute('aria-label') || '') : '',
               plainTabbed: plain.filter(d => d.tabIndex >= 0).length,
               live: document.getElementById('log').getAttribute('aria-live'),
               logRole: document.getElementById('log').getAttribute('role') };
    });
    ok(`a blow files a line that explains it (${explain.n} on the log)`, explain.n > 0);
    ok(`reachable from a keyboard and announced as a control (tabindex ${explain.tab}, role ${explain.role})`,
      explain.tab === 0 && explain.role === 'button');
    ok(`saying what it will explain (${explain.label.slice(0, 40)}...)`, /^Explain: /.test(explain.label));
    ok('while the lines that explain nothing are not tab stops', explain.plainTabbed === 0);
    ok(`and the log itself is a live region (${explain.logRole}, ${explain.live})`,
      explain.logRole === 'log' && explain.live === 'polite');

    // ── Focus follows the screen ───────────────────────────────────────────────────
    const focus = await page.evaluate(() => {
      const screens = [...document.querySelectorAll('#engine > div[id^="screen-"]')]
        .map(e => e.id).filter(id => id !== 'screen-settings');
      const lost = [];
      screens.forEach(id => {
        document.body.focus();
        switchScreen(id);
        if (document.activeElement !== document.getElementById(id)) lost.push(id);
      });
      return { screens: screens.length, lost };
    });
    ok(`focus lands on the screen it switched to, every time (${focus.lost.join(', ') || 'none lost'})`,
      focus.screens > 8 && focus.lost.length === 0);

    // ── The icons say what they mean ───────────────────────────────────────────────
    const legend = await page.evaluate(() => {
      switchScreen('screen-combat'); initiateCombat('RAIDERS', false);
      const foes = activeEntities.filter(e => !e.isPlayer);
      foes.forEach((e, i) => { e.intent = intentFor(i === 0 ? 'HEAVY' : 'DEFEND', e); });
      const me = activeEntities.find(e => e.isPlayer);
      turnQueue = [me]; activeIndex = 0; pendingAction = null; renderField();
      const box = document.querySelector('.intent-legend');
      const items = [...document.querySelectorAll('.intent-legend-item')].map(e => e.innerText.trim());
      const covered = [...new Set(foes.map(e => e.intent.type))]
        .every(t => items.some(i => i.indexOf(INTENT_WORDS[t]) >= 0));
      // And it is a key to THIS fight, not a table of everything.
      const onlyLive = items.length === new Set(foes.map(e => e.intent.type)).size;
      return { has: !!box, items, covered, onlyLive,
               words: Object.keys(INTENT_WORDS).length, icons: Object.keys(INTENT_ICONS).length };
    });
    ok(`the field carries a legend for its icons (${legend.items.join(' | ')})`, legend.has === true);
    ok('covering every intent actually on the field', legend.covered === true);
    ok(`and only those, so it is a key rather than a manual (${legend.items.length} shown)`,
      legend.onlyLive === true);
    ok(`every icon the game can draw has a word (${legend.words} of ${legend.icons})`,
      legend.words === legend.icons);

    // ── The choice that locks a class explains itself where the thumb is ───────────
    const od = await page.evaluate(() => {
      switchScreen('screen-combat'); initiateCombat('RAIDERS', false);
      const me = activeEntities.find(e => e.isPlayer);
      me.classType = 'BRUISER';
      odChoices = {}; momentum = 100;
      turnQueue = [me]; activeIndex = 0; pendingAction = null; renderField();
      const notes = [...document.querySelectorAll('.od-choice-note')].map(e => e.innerText.trim());
      const btns = [...document.querySelectorAll('[data-move="OVERDRIVE"]')];
      const descs = OVERDRIVES.BRUISER.map(o => o.desc);
      return { notes, buttons: btns.length,
               onScreen: descs.every(d => notes.some(n => n.indexOf(d) >= 0)),
               saysItLocks: notes.some(n => /rest of the expedition/i.test(n)) };
    });
    ok(`the first full bar offers both (${od.buttons} buttons)`, od.buttons === 2);
    ok(`each explained on the screen rather than in a tooltip (${od.notes.length} lines)`,
      od.onScreen === true);
    ok('and the deck says the choice is permanent', od.saysItLocks === true);

    await page.setViewportSize({ width: 1280, height: 800 });
  }
};

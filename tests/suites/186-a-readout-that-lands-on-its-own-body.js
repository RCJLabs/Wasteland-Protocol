// T03 walked the game's twenty screens with a pair of eyes and found this on the second one it
// photographed at phone width: a floating readout cut off mid-word at the right edge, reading
// "!BREAKIN".
//
// TWO DEFECTS, ONE CAUSE. .fct carried `transform: translateX(-50%)` to centre itself on the
// body it belongs to, and `animation: floatUp` - whose own keyframes set `transform` from frame
// zero. An animation's transform REPLACES the element's, so the centring was dead the moment the
// readout appeared. Every floating number in the game was drawn with its LEFT EDGE on the body's
// centre: half a string to the right of the body it was reporting on.
//
// Measured across the 58 distinct strings spawnFCT can print, on five field draws:
//
//               readout sat      landed on the WRONG body        off the screen
//   1280 wide     44px right       44.0% -> 0.0%                  0.2% -> 0.0%
//   390 phone     35px right       77.0% -> 2.7%                  17.8% -> 0.0%
//
// So on a phone three readouts in four were painted over somebody else's card, and one in six
// ran off the glass entirely. On a desktop it was four in ten and nearly none, which is why it
// survived: the overlap is the same but the screen is three times wider, and nobody had looked
// at a phone.
//
// THE FIX IS BOTH HALVES. floatUp now carries translateX(-50%) through both keyframes, which
// restores the centring; and spawnFCT clamps the result to the part of the fx-layer the player
// can actually see, because a 169px "OVER THE TOP" centred on a body 37px from the edge still
// runs off. The residual 2.7% is that clamp doing its job - a readout pulled onto the screen can
// land over a neighbour, and being readable beats being perfectly placed.
//
// THE NUMBERS IN THE TABLE come from a wider sweep than this file runs - five widths, five field
// draws, about two thousand placements each - kept because it is the better measurement. This
// file's own three draws read the same build at 101px off centre on a 110px card, 3 of 1220 off
// the screen at 1280, 190 at 390 and 239 at 320. Same shape, smaller sample; the row you are
// reading is the one that runs.
//
// The strings are read out of game.js rather than listed here, so a call site added tomorrow is
// measured tomorrow and this file does not quietly stop covering the thing it is named for.
const path = require('path');
const fs = require('fs');

// Every spawnFCT call site's literal text, from the source. A template hole stands in at three
// digits, which is the widest a count in this game gets, so what is pinned is the worst case
// rather than the narrowest.
function fctStrings(src) {
  const out = new Set();
  const re = /spawnFCT\(\s*[^,]+,\s*("[^"]*"|'[^']*'|`[^`]*`)\s*,\s*("[^"]*"|'[^']*'|[A-Za-z_][\w.]*[^,)]*)/g;
  let m;
  while ((m = re.exec(src))) {
    const text = m[1].slice(1, -1).replace(/\$\{[^}]*\}/g, '999');
    let cls = m[2].replace(/^['"]|['"]$/g, '');
    if (!/^fct-/.test(cls)) cls = 'fct-status';
    out.add(text + '\u0000' + cls);
  }
  return [...out].map(r => r.split('\u0000'));
}

module.exports = {
  name: 'A readout that lands on its own body',
  run: async ({ page, ok, base, engineUp, resized }) => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'game.js'), 'utf8');
    const strings = fctStrings(src);
    ok(`the source still names a real set of floating readouts (${strings.length} of them)`,
      strings.length >= 40 && strings.some(s => s[0] === 'OVER THE TOP'));

    await page.goto(`${base}/index.html`);
    await engineUp(page);
    // The runner's own viewport is 400x800, so every width below is SET rather than assumed. A
    // first cut of this file labelled its first sweep "at 1280 wide" and measured it at 400,
    // which is F03's rule arriving in a new place: a report is one edit from quoting a number
    // the run did not use.
    await resized(page, { width: 1280, height: 800 });

    // ── The centring is alive ──────────────────────────────────────────────────────
    // The one assertion that fails if floatUp's keyframes lose the translate again. Deliberately
    // NOT a pixel bound: it asks whether the readout's middle is on the body's middle, which is
    // the thing the defect broke, and stays true whatever the field fit does to card widths.
    const centred = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); promptsOn = false;
      confirmNewGame(1.0); sectorFront = null; currentSector = 2; currentTier = 4;
      initiateCombat('RAIDERS', false); renderField();
      const layer = fxLayer();
      // A body in the middle of the line, so the clamp below has nothing to do here and what is
      // measured is the centring alone.
      const cards = activeEntities.filter(e => e.hp > 0 && document.getElementById(e.id))
        .map(e => ({ id: e.id, b: document.getElementById(e.id).getBoundingClientRect() }))
        .sort((a, b) => a.b.left - b.b.left);
      const mid = cards[Math.floor(cards.length / 2)];
      spawnFCT(mid.id, 'OVER THE TOP', 'fct-combo');
      const el = layer.lastElementChild, r = el.getBoundingClientRect();
      const out = { w: Math.round(r.width),
                    off: Math.round((r.left + r.right) / 2 - (mid.b.left + mid.b.right) / 2),
                    card: Math.round(mid.b.width) };
      el.remove(); combatActive = false;
      return out;
    });
    ok(`the widest readout sits on the body it reports, not beside it `
       + `(${centred.off}px off centre on a ${centred.card}px card, string ${centred.w}px)`,
      Math.abs(centred.off) <= 3);

    // ── And every readout stays on the glass ───────────────────────────────────────
    // The whole vocabulary, on every body of several draws, at both widths. Nothing here places
    // anything: spawnFCT does, and this reads back where it put it.
    const sweep = async label => await page.evaluate(async strings => {
      const bad = [];
      let n = 0;
      for (const [faction, elite] of [['RAIDERS', false], ['CARRION', true], ['MECH', true]]) {
        localStorage.clear(); currentSlot = 1; loadMeta(); promptsOn = false;
        confirmNewGame(1.0); sectorFront = null; currentSector = 4; currentTier = 7;
        initiateCombat(faction, elite); renderField();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const layer = fxLayer(), f = layer.getBoundingClientRect();
        const live = activeEntities.filter(e => e.hp > 0 && document.getElementById(e.id));
        for (const [text, cls] of strings) for (const ent of live) {
          spawnFCT(ent.id, text, cls);
          const el = layer.lastElementChild;
          if (!el || !el.classList.contains('fct')) continue;
          const r = el.getBoundingClientRect();
          n++;
          const over = Math.max(r.right - Math.min(f.right, window.innerWidth),
                                Math.max(f.left, 0) - r.left);
          if (over > 0) bad.push(`${text} by ${Math.round(over)}px`);
          el.remove();
        }
        combatActive = false;
      }
      return { n, bad: [...new Set(bad)].slice(0, 5), count: bad.length };
    }, strings);

    const wide = await sweep('wide');
    ok(`at 1280 wide, none of ${wide.n} placements runs off the screen `
       + `(${wide.count}${wide.count ? ': ' + wide.bad.join(', ') : ''})`, wide.count === 0);

    await resized(page, { width: 390, height: 844 });
    const phone = await sweep('phone');
    ok(`at 390 wide either — which is where it was 17.8% before the fix `
       + `(${phone.count} of ${phone.n}${phone.count ? ': ' + phone.bad.join(', ') : ''})`,
      phone.count === 0);

    // The narrowest screen the layout is written for, because a clamp that works at 390 and
    // gives up at 320 is a clamp nobody measured at 320.
    await resized(page, { width: 320, height: 568 });
    const tiny = await sweep('tiny');
    ok(`and at 320, where the string can be half the screen `
       + `(${tiny.count} of ${tiny.n}${tiny.count ? ': ' + tiny.bad.join(', ') : ''})`,
      tiny.count === 0);
    await resized(page, { width: 1280, height: 800 });

    // ── The measurement can see the defect it is named for ─────────────────────────
    // Two rows above are green because the clamp works, and would be green just as loudly if
    // spawnFCT had stopped producing anything at all. This hands the same reader a readout put
    // where the old code put it - left edge on the body's centre - and it must be caught.
    const canSee = await page.evaluate(() => {
      confirmNewGame(1.0); sectorFront = null; currentSector = 4; currentTier = 7;
      initiateCombat('CARRION', true); renderField();
      const layer = fxLayer(), f = layer.getBoundingClientRect();
      const right = activeEntities.filter(e => e.hp > 0 && document.getElementById(e.id))
        .map(e => document.getElementById(e.id).getBoundingClientRect())
        .sort((a, b) => b.right - a.right)[0];
      const el = document.createElement('div');
      el.className = 'fct fct-combo'; el.innerText = 'OVER THE TOP';
      el.style.top = '40px';
      el.style.left = `${Math.round(right.left - f.left + right.width / 2)}px`;
      // The old geometry exactly: the animation ate the centring, so the left edge landed here.
      el.style.transform = 'none'; el.style.animation = 'none';
      layer.appendChild(el);
      const r = el.getBoundingClientRect();
      const over = Math.round(r.right - Math.min(f.right, window.innerWidth));
      el.remove(); combatActive = false;
      return over;
    });
    ok(`and the reader catches a readout placed the old way (${canSee}px off the edge)`, canSee > 0);
  }
};

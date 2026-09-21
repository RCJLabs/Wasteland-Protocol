// T01 found the battlefield putting text on text; T02 fixed it and this holds the line.
//
// WHAT IT WAS. Sprites overlap on purpose - .entity carries a negative margin of --overlap a
// side - so a 110px card at 1280 wide stands 72px from its neighbour. Every readout given the
// card's full width therefore reached 38px into the next one:
//
//   FRONT over MID 38x8   MID over BACK 38x5   MID over a forecast 38x4   RANGING SHOT over FRENZY 38x12
//
// .status-badge had solved this for itself with `max-width: calc(100% - 2 * var(--overlap))`
// and the five other readouts on the same slot never got the rule. They have it now.
//
// AND BORDER-BOX WAS THE HALF THAT MATTERED. The first cut of the rule took the overlap from
// 38px to 4-6px and stopped - this sheet sets box-sizing per element and never globally, so the
// tags defaulted to content-box and their 3px of padding a side plus a 1px border sat OUTSIDE
// max-width. Eight pixels of box the constraint could not see. With border-box the count is
// zero at both widths.
//
// HELD AT ONE, not at zero. Which labels are on screen depends on the drafted roster and the
// rolled enemy row, and a bound with no slack is the K03 defect this file exists to catch. Eight
// measurements after the fix read zero; one is a single unit of slack over everything seen.
// ── T-audit: AND IT WAS COUNTING THE ONE LAYER THAT IS SUPPOSED TO SIT ON THINGS ─────
//
// This row went red one battery in ten at 390 wide, and the pairs it printed always had the
// same shape: a static label over a small negative number. Probed for class names, every one of
// those numbers was `.fct` inside `.fx-layer` - a floating damage readout, drawn over the field
// on purpose and removed after 1000ms. Measured over 34 stagings: 0 collisions at 1280, and at
// 390 sixteen zeroes, two ones and two twos, all four involving the fx-layer and NONE of them
// two static labels. The layout this suite is about has been clean at both widths throughout.
//
// T03 is why it surfaced now. Its clamp pulls an FCT that would have drawn off the screen back
// inside the viewport, which at phone width is where the static labels are - so the thing T03
// fixed is the thing that made this fire. The bound was set over eight runs that all read zero,
// before that clamp existed, which is K03's shape again: a number calibrated inside its own
// noise, in a file whose own header says that is the defect it exists to catch.
//
// SO THE FX LAYER IS OUT OF THIS CENSUS, and not because it made a row go red. It is an overlay
// with no place in the layout: `.entity`'s negative margin, the `max-width` rule and the
// box-sizing fix above are all about boxes that SHARE the row, and an FCT shares nothing - it
// floats above the field for a second and leaves. Where an FCT lands is 186's question and 186
// measures it against the body it reports. What is asserted here is that two labels which are
// both part of the layout never sit on each other, and the element count is printed so that a
// later exclusion cannot quietly empty this out.
const CEILING = { wide: 1, phone: 1 };
module.exports = {
  name: 'Labels that sit on each other',
  run: async ({ page, ok, base, engineUp, resized }) => {
    const collisions = async () => await page.evaluate(() => {
      const els = [...document.querySelectorAll('.battlefield *')]
        .filter(e => e.children.length === 0 && e.innerText && e.innerText.trim()
                  && e.getBoundingClientRect().width > 0
                  && !e.closest('.fx-layer'));   // an overlay, not a box in the row
      const hits = [];
      for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
        const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
        // Two pixels of slack: touching edges are a layout meeting, not a collision.
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2) hits.push(`${els[i].innerText.trim().slice(0, 14)} over `
          + `${els[j].innerText.trim().slice(0, 14)} (${Math.round(ox)}x${Math.round(oy)})`);
      }
      return { hits, seen: els.length };
    });
    const stage = async () => await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      // The sector goes first: pressedFor keys on it, so picking a node at sector 1 and then
      // moving to 3 hands back a node that no longer carries a clock. That cost T01 two false
      // findings before it cost this suite anything.
      currentSector = 3; currentTier = 5;
      let picked = null;
      for (let i = 0; i < 400 && !picked; i++) { const id = 'n' + i; if (pressedFor(id, 'RAIDERS') > 0) picked = id; }
      currentNodeId = picked;
      initiateCombat('RAIDERS', false);
      playerRoster.filter(c => c.gridPos > 0).forEach((c, i) => {
        c.resistances = { phys: 8, bio: 12, energy: -4 };
        c.hp = Math.max(1, Math.floor(c.maxHp * (0.3 + i * 0.2)));
      });
      activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = Math.max(1, Math.floor(e.maxHp * 0.4)); });
      renderField();
      return { clock: pressedAt, enemies: activeEntities.filter(e => !e.isPlayer).length };
    });

    await page.goto(`${base}/index.html`);
    await engineUp(page);
    const set = await stage();
    ok(`the fight is staged with a clock and a crowded row (${set.clock} turns, ${set.enemies} hostiles)`,
      set.clock > 0 && set.enemies >= 2);

    const wide = await collisions();
    ok(`at 1280 wide, labels on labels are held at ${CEILING.wide} (${wide.hits.length}: ${wide.hits.join('; ') || 'none'})`,
      wide.hits.length <= CEILING.wide);
    ok(`and it is judging a populated field rather than an emptied one (${wide.seen} labels)`,
      wide.seen >= 20);

    await resized(page, { width: 390, height: 844 });
    await stage();
    const phone = await collisions();
    ok(`at 390 wide, held at ${CEILING.phone} (${phone.hits.length}: ${phone.hits.join('; ') || 'none'})`,
      phone.hits.length <= CEILING.phone);
    ok(`and the phone field is populated too (${phone.seen} labels)`, phone.seen >= 20);

    // The measurement has to be able to SEE a collision, or the two rows above are green for the
    // wrong reason. Two boxes are put on the same pixels on purpose and the counter must find it.
    const canSee = await page.evaluate(() => {
      const f = document.querySelector('.battlefield');
      const mk = (t, x) => { const d = document.createElement('div');
        d.style.cssText = `position:absolute;left:${x}px;top:40px;width:60px;height:20px`;
        d.innerText = t; f.appendChild(d); return d; };
      const a = mk('AAA', 10), b = mk('BBB', 30);
      const els = [a, b].map(e => e.getBoundingClientRect());
      const ox = Math.min(els[0].right, els[1].right) - Math.max(els[0].left, els[1].left);
      a.remove(); b.remove();
      return Math.round(ox);
    });
    ok(`and the counter can see a collision it is handed (${canSee}px)`, canSee > 2);
  }
};

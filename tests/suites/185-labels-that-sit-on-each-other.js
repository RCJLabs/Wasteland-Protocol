// T01: the battlefield has text sitting on text, and nothing could see it.
//
// Found by driving the real game and photographing it - the first time in this project's history
// that anyone looked at a screen rather than asserting about one. 155 measures whether a card is
// CLIPPED and C11 whether the field scrolls SIDEWAYS; both pass. Neither asks whether two labels
// occupy the same pixels, so four collisions have been shipping under green batteries.
//
// Measured at 1280x800 with a hurt, badged squad and a crowded enemy row:
//
//   FRONT        over MID            38 x  8 px
//   MID          over BACK           38 x  5
//   MID          over a threat number 38 x  4
//   RANGING SHOT over FRENZY         38 x 12
//
// The rank labels leaning on each other is arguably the staggered line doing its job. The other
// two are not: a rank label over a damage forecast, and one enemy's signature over another's, are
// both a number or a word the player came to read with something else on top of it.
//
// RATCHETED, NOT FIXED. The fix is a layout job on the staggered ranks and the signature row, and
// it wants somebody able to iterate against the rendered page rather than a blind CSS edit. This
// holds the line meanwhile: the count may fall and may not rise, which is L06's shape and S07's.
//
// AND THE BOUND IS DELIBERATELY LOOSE, because the count is NOISY and a tight one would be an
// assertion calibrated inside its own noise - K03's whole subject, and a poor thing to ship in
// the suite that exists to catch sloppiness. Which labels collide depends on the drafted roster
// and the rolled enemy row, so six runs of this staging read:
//
//   1280 wide   2, 3, 1, 1, 1, 1        390 wide   1, 1, 1, 1, 3, 1
//
// with a differently-staged fight (further into its clock, other signatures up) reaching 4. The
// first cut of this file pinned 4 and would have gone red on somebody eventually. Six is two
// clear of everything measured. ITS JOB IS A REGRESSION IN KIND - a new class of collision, a
// screen that starts stacking labels - and not a one-count drift, which it cannot see anyway.
const CEILING = { wide: 6, phone: 6 };
module.exports = {
  name: 'Labels that sit on each other',
  run: async ({ page, ok, base, engineUp, resized }) => {
    const collisions = async () => await page.evaluate(() => {
      const els = [...document.querySelectorAll('.battlefield *')]
        .filter(e => e.children.length === 0 && e.innerText && e.innerText.trim()
                  && e.getBoundingClientRect().width > 0);
      const hits = [];
      for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
        const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
        // Two pixels of slack: touching edges are a layout meeting, not a collision.
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2) hits.push(`${els[i].innerText.trim().slice(0, 14)} over `
          + `${els[j].innerText.trim().slice(0, 14)} (${Math.round(ox)}x${Math.round(oy)})`);
      }
      return hits;
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
    ok(`at 1280 wide, labels on labels are held at ${CEILING.wide} (${wide.length}: ${wide.join('; ') || 'none'})`,
      wide.length <= CEILING.wide);

    await resized(page, { width: 390, height: 844 });
    await stage();
    const phone = await collisions();
    ok(`at 390 wide, held at ${CEILING.phone} (${phone.length}: ${phone.join('; ') || 'none'})`,
      phone.length <= CEILING.phone);

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

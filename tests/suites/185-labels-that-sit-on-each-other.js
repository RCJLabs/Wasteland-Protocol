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
const CEILING = { wide: 1, phone: 1 };
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

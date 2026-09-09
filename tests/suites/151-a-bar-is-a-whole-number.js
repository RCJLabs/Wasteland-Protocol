// J02: found by J01's weather ledger rather than by looking for it. The ledger books
// `before - ent.hp` per tick, every weather site floors its own damage, and the career totals
// still came back fractional - 133851.4 hostile, SMOG 296919.8. So something else was leaving
// hit points non-integer.
//
// A scan of every `.hp` and `.maxHp` write in the engine found none doing unfloored arithmetic,
// which is why this needed a trap rather than a read: an hp setter that recorded a stack trace
// on the first fractional write, run inside a real career. It named applyDamageHit, reached
// from resolveAction's overdrive path, and the arithmetic was in the ARGUMENT rather than in
// the assignment - `applyDamageHit(actEnt, e, actEnt.dmgBase * 1.2, 'energy', null)`. Seventeen
// overdrive variants do that, with multipliers from 0.6 to 4.0, and mitigate's whole body is
// integer operations on whatever figure it is handed, so the fraction survived to the bar.
//
// It was never only a bookkeeping smell. netDmg is interpolated into the floating combat text
// and the combat log, so a Scrap Storm from a 58-damage operator showed the player
// `-69.60000000000001`. Floored once at applyDamageHit's entry - the one door damage goes
// through - rather than at the seventeen call sites, which is where the eighteenth variant
// would have missed it.
//
// What is pinned: a bar is a whole number, the figure shown is a whole number, and the door
// itself floors. Asserted through the engine's own damage call, never by recomputing a figure.
module.exports = {
  name: 'A bar is a whole number',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── The door floors what it is handed ────────────────────────────────────────────
    // A fractional figure with no resistance or armour in the way, so the arithmetic is
    // visible: 20.7 has to land as 20, not as 20.7 and not as 21.
    const door = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentWeather = 'CLEAR'; currentTerrain = null;
      const t = { id: 'd1', name: 'Dummy', isPlayer: false, hp: 500, maxHp: 500, armor: 0,
                  resistances: { phys: 0, bio: 0, energy: 0 }, cooldowns: {},
                  stunnedTurns: 0, bleedingTurns: 0, oiledTurns: 0, corrodedTurns: 0, armorTurns: 0 };
      activeEntities = [t];
      const a = playerRoster.find(c => c.gridPos > 0);
      applyDamageHit(a, t, 20.7, 'phys', null);
      const afterFrac = t.hp;
      t.hp = 500;
      applyDamageHit(a, t, 20, 'phys', null);
      return { afterFrac, took: 500 - afterFrac, whole: 500 - t.hp };
    });
    ok(`a fractional figure leaves a whole bar (${door.afterFrac})`, Number.isInteger(door.afterFrac));
    ok(`and it rounds down rather than up (20.7 took ${door.took}, 20 took ${door.whole})`,
      door.took === 20 && door.whole === 20);

    // ── Which is what the seventeen overdrive variants need ─────────────────────────
    // Read off the source rather than asserted in prose: the call sites still hand this a
    // product, and that is fine BECAUSE the door floors. If a future phase floors them
    // individually and drops the guard at the door, the count here moves and the row above
    // is what still holds the line.
    const sites = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      let n = 0;
      src.split('\n').forEach(l => {
        if (l.trim().startsWith('//')) return;
        const m = l.match(/applyDamageHit\s*\([^)]*dmgBase\s*\*\s*[0-9.]+/g);
        if (m) n += m.length;
      });
      return n;
    });
    ok(`the overdrive variants still hand the door a product (${sites} sites)`, sites > 0);

    // ── A real overdrive, through the engine, leaves whole bars ─────────────────────
    const od = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentWeather = 'CLEAR';
      currentSector = 3; currentTier = 5;
      initiateCombat('RAIDERS');
      const a = playerRoster.find(c => c.gridPos > 0 && c.hp > 0);
      a.dmgBase = 58;                                   // the figure that produced 69.6
      const foes = activeEntities.filter(e => !e.isPlayer && e.hp > 0);
      foes.forEach(e => { e.hp = e.maxHp = 500; e.armor = 0; e.resistances = { phys: 0, bio: 0, energy: 0 }; });
      foes.forEach(e => applyDamageHit(a, e, a.dmgBase * 1.2, 'energy', null));
      return { bars: activeEntities.map(e => e.hp), hit: foes.length };
    });
    ok(`an overdrive-shaped hit landed on somebody (${od.hit} foes)`, od.hit > 0);
    ok(`and every bar on the field is a whole number (${od.bars.join(', ')})`,
      od.bars.every(Number.isInteger));

    // ── And the figure the player is shown is whole ─────────────────────────────────
    // The bug was visible, not internal: netDmg goes straight into the floating combat text
    // and the log line. Read back off the log the engine wrote, not off a recomputed number.
    const shown = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentWeather = 'CLEAR'; currentTerrain = null;
      const t = { id: 'd2', name: 'Dummy', isPlayer: false, hp: 500, maxHp: 500, armor: 0,
                  resistances: { phys: 0, bio: 0, energy: 0 }, cooldowns: {},
                  stunnedTurns: 0, bleedingTurns: 0, oiledTurns: 0, corrodedTurns: 0, armorTurns: 0 };
      activeEntities = [t];
      const box = document.getElementById('log');       // #log, the container suite 91 reads
      if (box) box.innerHTML = '';
      const a = playerRoster.find(c => c.gridPos > 0);
      const before = t.hp;
      applyDamageHit(a, t, 58 * 1.2, 'energy', null);
      const text = box ? box.innerText : '';
      const nums = (text.match(/\d+(?:\.\d+)?/g) || []);
      return { text: text.replace(/\s+/g, ' ').trim().slice(0, 140),
               lines: box ? box.querySelectorAll('div').length : 0,
               nums, took: before - t.hp };
    });
    // Asserted in this order deliberately: an empty log has no decimals in it either, so the
    // no-decimals claim below is worthless unless the log is first shown to carry the figure.
    ok(`the hit wrote a log line (${shown.lines}) carrying the figure it dealt (${shown.took})`,
      shown.lines > 0 && shown.nums.includes(String(shown.took)));
    ok(`and every number in it is whole (${shown.nums.join(', ')})`,
      shown.nums.length > 0 && shown.nums.every(n => !n.includes('.')));
  }
};

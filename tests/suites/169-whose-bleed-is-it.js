// #197 tier A. Every timed status in this game is a bare integer on a body, and nothing carried
// where it came from - so a status tick could never be booked back to whatever applied it. The
// bleed is the one that matters: it is the only status that DOES something on its own each turn,
// it is 8% of the victim's maxHp a tick, and M11 measured that 45% to 61% of every combo in the
// game reads one. Nineteen sites apply it - six overdrives, five abilities and mods, a capstone
// pair, a boss passive, an affix, the blood moon, a commander's plague - and the tick could say
// only that a bleed had happened.
//
// The scope for #197 split the statuses three ways and this is tier A, the only one where a
// source stamp gives an exact answer: a bleed ticks on its own, so the whole tick belongs to
// whatever opened the wound. Tier B (oiled, corroded, marked) changes somebody ELSE's hit and
// needs a counterfactual; tier C (heals, cleanses) is damage that never happened and no stamp
// can see it. Neither is built here.
//
// ONE DOOR EACH WAY. bleedFor raises, bleedSet assigns, clearBleed ends - and the source follows
// the counter through all three. M09's markedBy is the cautionary tale this is built against: it
// is set at three sites and cleared at NONE, and is harmless today only because its single
// reader happens to sit behind a markedTurns > 0 guard. The invariant here is asserted instead
// of hoped for.
module.exports = {
  name: 'Whose bleed is it',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', '..');
    const src = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
    const sim = fs.readFileSync(path.join(root, 'tests', 'simulate.js'), 'utf8');

    // ── Every site goes through a door ─────────────────────────────────────────
    // The guard that keeps this true as the game grows. A twentieth site written next year with
    // a bare assignment would apply a bleed nothing can attribute, and the census would quietly
    // book it to UNATTRIBUTED rather than fail - which is the worst kind of instrument bug,
    // because the number still looks like a number.
    const strays = src.split('\n').map((l, i) => [i + 1, l])
      .filter(([, l]) => /\.bleedingTurns\s*=(?!=)/.test(l))
      .filter(([, l]) => !/bleedingTurns = turns/.test(l) && !/target\.bleedingTurns = 0; target\.bleedSrc = null;/.test(l))
      // The two caps below are deliberate and get their own row; everything else is a stray.
      .filter(([, l]) => !/bleedingTurns = Math\.min\(/.test(l));
    ok(`every bleed write goes through bleedFor, bleedSet or clearBleed${strays.length ? ' - stray at line ' + strays.map(s => s[0]).join(', ') : ''}`,
      strays.length === 0);
    const decs = (src.match(/bleedingTurns--/g) || []).length;
    ok(`and the only place that spends one is the tick itself (${decs})`, decs === 1);
    // The two caps are deliberately NOT routed: a TOURNIQUET shortening a bleed does not make the
    // tourniquet the thing that opened the wound, so they change the counter and leave the name.
    ok('the two trinket/relic caps shorten the counter without taking the name',
      (src.match(/bleedingTurns = Math\.min\(/g) || []).length === 2);

    const field = () => page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField();
      const who = window.__bare(playerRoster.find(c => c.classType === 'HOUND'));
      who.gridPos = 1; who.hp = who.maxHp = 900; who.dmgBase = 20;
      Object.keys(who.cooldowns || {}).forEach(k => who.cooldowns[k] = 0);
      const foe = window.__dummy({ id: 'bl0', hp: 4000, maxHp: 4000 });
      activeEntities = [who, foe]; turnQueue = [who, foe];
      combatActive = true; momentum = 0; activeIndex = 0;
      runStats = runStats || {}; runStats.bl = {}; runStats.dt = {};
      return { whoId: who.id };
    });

    // ── The source follows the counter ─────────────────────────────────────────
    await field();
    const own = await page.evaluate(() => {
      const foe = activeEntities.find(e => !e.isPlayer);
      const out = {};
      bleedFor(foe, 5, 'LONG');           out.long = { t: foe.bleedingTurns, s: foe.bleedSrc };
      // Shorter, so it does nothing - and therefore does not get to claim the wound either.
      const took = bleedFor(foe, 2, 'SHORT');
      out.shorter = { t: foe.bleedingTurns, s: foe.bleedSrc, took };
      // Longer, so it does, and the name moves with it.
      bleedFor(foe, 7, 'LONGER');         out.longer = { t: foe.bleedingTurns, s: foe.bleedSrc };
      // An assign shortens AND takes the name, because it really did change the wound.
      bleedSet(foe, 2, 'ASSIGNED');       out.assigned = { t: foe.bleedingTurns, s: foe.bleedSrc };
      clearBleed(foe);                    out.cleared = { t: foe.bleedingTurns, s: foe.bleedSrc };
      out.ledger = JSON.parse(JSON.stringify(runStats.bl));
      return out;
    });
    ok(`applying a bleed records what opened it (${own.long.t} turns, ${own.long.s})`,
      own.long.t === 5 && own.long.s === 'LONG');
    ok('a shorter bleed over a longer one changes nothing and claims nothing',
      own.shorter.t === 5 && own.shorter.s === 'LONG' && own.shorter.took === false);
    ok(`a longer one takes both the counter and the name (${own.longer.t}, ${own.longer.s})`,
      own.longer.t === 7 && own.longer.s === 'LONGER');
    ok(`an assigning site shortens and takes the name with it (${own.assigned.t}, ${own.assigned.s})`,
      own.assigned.t === 2 && own.assigned.s === 'ASSIGNED');
    // THE INVARIANT markedBy does not have. A source outliving its counter is a ghost that would
    // label whatever opens the body next.
    ok('and ending a bleed takes the name off the body with it',
      own.cleared.t === 0 && !own.cleared.s);
    ok(`the shortening is counted rather than corrected (${(own.ledger.atFoe.ASSIGNED || {}).shortened})`,
      (own.ledger.atFoe.ASSIGNED || {}).shortened === 1 && !(own.ledger.atFoe.ASSIGNED || {}).applied);
    ok('and the turns each source actually granted are counted apart from the applications',
      own.ledger.atFoe.LONG.turns === 5 && own.ledger.atFoe.LONGER.turns === 2 && !own.ledger.atFoe.SHORT);

    // ── The tick books to whoever opened the wound ─────────────────────────────
    await field();
    const ticked = await page.evaluate(() => {
      const foe = activeEntities.find(e => !e.isPlayer);
      bleedFor(foe, 3, 'RIPSAW');
      const before = foe.hp;
      // Three ticks: the last one spends the counter, and it still has to book - which is why
      // the source is read at the top of the tick rather than after the decrement.
      for (let i = 0; i < 3; i++) applyTurnStartEffects(foe);
      return { took: before - foe.hp, turns: foe.bleedingTurns, srcAfter: foe.bleedSrc,
               row: runStats.bl.atFoe.RIPSAW, dt: runStats.dt.atFoe };
    });
    ok(`three ticks all book to the source that opened it (${ticked.row.ticks} ticks)`, ticked.row.ticks === 3);
    ok(`including the one that runs the counter out (${ticked.turns} turns left, name ${ticked.srcAfter})`,
      ticked.turns === 0 && !ticked.srcAfter);
    ok(`and the landed column is the health the body actually lost (${ticked.row.dmg} vs ${ticked.took})`,
      ticked.row.dmg === ticked.took && ticked.took > 0);
    // THE RECONCILIATION, and the reason the raw column is kept beside the landed one. M03 routed
    // the bleed through mitigate as phys, so the type ledger already books what each tick ASKED
    // for. On a field where nothing else has swung, the two have to be the same number - and if
    // they ever stop being, one of the two ledgers has drifted and this row says which.
    ok(`the raw column reconciles against the type ledger a line above it (${ticked.row.raw} vs ${(ticked.dt.phys || {}).raw})`,
      ticked.row.raw === (ticked.dt.phys || {}).raw);
    ok('and raw is at or above landed, because mitigation is the gap between them',
      ticked.row.raw >= ticked.row.dmg);

    // And a body that actually resists, because the row above cannot tell the two columns apart
    // on a bare dummy - they are the same number there, so booking the raw as the landed figure
    // would pass it. M03 routed the bleed through mitigate as PHYS on purpose: plate does not
    // stop a wound (armour is zeroed for BLEED) but a physical resistance does, so a resistance
    // is the one thing that opens a gap between what the tick asked for and what the body lost.
    await field();
    const resisted = await page.evaluate(() => {
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.resistances = { phys: 40, bio: 0, energy: 0 };
      bleedFor(foe, 2, 'TOUGH');
      const before = foe.hp;
      applyTurnStartEffects(foe); applyTurnStartEffects(foe);
      return { took: before - foe.hp, row: runStats.bl.atFoe.TOUGH };
    });
    ok(`a resistance opens a gap between raw and landed (${resisted.row.raw} asked, ${resisted.row.dmg} taken)`,
      resisted.row.raw > resisted.row.dmg);
    ok('and the landed column is still exactly the health that left the body',
      resisted.row.dmg === resisted.took);

    // ── A cleanse ends it, and the ledger says so ──────────────────────────────
    await field();
    const cleansed = await page.evaluate(() => {
      const who = activeEntities.find(e => e.isPlayer);
      bleedFor(who, 4, 'SEPTIC');
      const mid = { t: who.bleedingTurns, s: who.bleedSrc };
      // The medic's own cleanse, through the same door every other clear uses.
      clearBleed(who);
      applyTurnStartEffects(who);
      return { mid, after: { t: who.bleedingTurns, s: who.bleedSrc },
               row: runStats.bl.atSquad.SEPTIC };
    });
    ok('a bleed on an operator is booked to the squad side, not the hostiles',
      cleansed.mid.s === 'SEPTIC' && cleansed.row.applied === 1);
    ok('a cleanse ends it before it ever ticks, which is what a cleanse is worth',
      cleansed.after.t === 0 && !cleansed.after.s && !cleansed.row.ticks);

    // ── Wired to the report, and nothing it keeps goes unread ──────────────────
    ok('the report folds the census with the shared fold rather than a hand-rolled loop',
      /foldAll\('bl'\)/.test(sim));
    {
      const block = (sim.match(/const bl = foldAll\('bl'\);[\s\S]*?\n  \}/) || [''])[0];
      const unread = ['applied', 'turns', 'shortened', 'ticks', 'raw', 'dmg', 'kills']
        .filter(f => !block.includes(f));
      ok(`every field the census keeps is read by the report${unread.length ? ': ' + unread.join(', ') + ' unread' : ''}`,
        unread.length === 0);
    }
    ok('and both sides are printed, because the squad and the road bleed for very different amounts',
      /atFoe', 'the squad opens'/.test(sim) && /atSquad', 'the road opens'/.test(sim));
    // One scale per block. The first cut printed a per-career damage figure and a raw tick TOTAL
    // on the same line, so "667 of them lethal" sat next to a number that was already divided by
    // 150 and read as a per-career figure - it is 4.4. Every sum in the block goes through the
    // same per() now, and this row is what keeps a raw sum() from creeping back into a line.
    {
      const block = (sim.match(/const bl = foldAll\('bl'\);[\s\S]*?\n  \}/) || [''])[0];
      const lines = block.split('\n').filter(l => /^\s*line\(/.test(l) || /^\s*`/.test(l) || /^\s*\?/.test(l) || /^\s*:/.test(l));
      const raw = lines.filter(l => /sum\('/.test(l) && !/sum\('applied'\) \+ shortened/.test(l));
      ok(`every figure the bleed block prints is per career${raw.length ? ' - raw sum in: ' + raw[0].trim().slice(0, 60) : ''}`,
        raw.length === 0);
    }
  }
};

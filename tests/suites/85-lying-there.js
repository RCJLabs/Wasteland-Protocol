// D09 was filed on a figure that turned out to be an artefact: "567 operators went down and 95
// turns were spent saving any of them - one rescue turn per six falls". The counter behind it
// added up the item rescues and the move rescues and left out the STIM tactic, which is the one
// answer a squad with no medic in the line has. Counted properly, across 28 expeditions and two
// tactic policies, it is 279 rescues against 241 falls and 278 against 290 - roughly one rescue
// per fall. The squad does not ignore its own people.
//
// What the same measurement did show is this, of the operators still down when the fight ended:
//
//   clock left when picked up      --tactics stim   --tactics smart
//     3 of 3 - never started              60%             54%
//     2 of 3 - one of their turns         32%             38%
//     1 of 3 - one turn from gone          8%              8%
//
// Every one of those paid exactly the same price: an 8% scar roll and 20% of their health back.
// Falling as a fight is already finishing cost what lying on the floor through two of your own
// turns cost, so the clock C02 built - which is a real clock, it takes 1.6 to 1.9 operators a
// run - had no gradient under it at all.
//
// So the SCAR roll is graded rather than raised. Against the spread above the new ladder averages
// 9.8% where the flat roll averaged 8-10%: the same total scarring, moved onto the falls that
// actually cost something.
//
// The health they come round on was graded too, on the same reasoning, and it is not any more:
// it cost two sectors of depth and is pinned flat below with the measurement that killed it.
// What is NOT changed is C02's rule that ending the fight stops the clock - it is the reason a
// fall is a question about THIS fight rather than a flat tax, and the rescue counts say the
// system it drives is working.
module.exports = {
  name: 'What lying there costs',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__fight = (n = 2) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 2; currentTier = 4; initiateCombat('RAIDERS', false);
        const squad = playerRoster.filter(c => c.gridPos > 0).slice(0, n);
        squad.forEach((h, i) => { h.maxHp = 100; h.hp = 100; h.gridPos = i + 1;
                                  h.quirk = null; h.traits = []; h.scars = []; });
        const foe = activeEntities.find(e => !e.isPlayer);
        foe.maxHp = 100000; foe.hp = 100000; foe.armor = 0; foe.baseArmor = 0;
        foe.resistances = { phys: 0, bio: 0, energy: 0 };
        activeEntities = [...squad, foe]; turnQueue = [...squad, foe];
        activeIndex = 0; combatActive = true; pendingAction = null; bonds = {};
        return { squad, foe };
      };
      window.__drop = ent => { ent.hp = 0; goDown(ent); };
      // Put somebody on the floor and leave them there for exactly n of their own turns.
      window.__lie = (ent, n) => { __drop(ent); for (let i = 0; i < n; i++) tickBleedOut(ent); };
    });

    // ── The clock remembers where it started ────────────────────────────────────────────
    // turnsDown is read off the clock rather than counted, which is what lets SLOW TO RISE and
    // MASS GRAVE - both of which start a SHORTER clock - be handled without being mentioned.
    const clock = await page.evaluate(() => {
      const { squad } = __fight(2);
      const [a, b] = squad;
      __drop(a);
      const fresh = { from: a.downFrom, left: a.downTurns, spent: turnsDown(a) };
      tickBleedOut(a);
      const one = { left: a.downTurns, spent: turnsDown(a) };
      tickBleedOut(a);
      const two = { left: a.downTurns, spent: turnsDown(a) };
      // A shorter clock still counts its own turns, not BLEED_OUT's.
      b.scars = ['SLOW_TO_RISE']; __drop(b);
      const short = { from: b.downFrom, left: b.downTurns, spent: turnsDown(b) };
      tickBleedOut(b);
      const shortOne = { left: b.downTurns, spent: turnsDown(b) };
      combatActive = false;
      return { fresh, one, two, short, shortOne, base: BLEED_OUT };
    });
    ok(`a fresh fall has spent none of its clock (${clock.fresh.left} of ${clock.fresh.from})`,
      clock.fresh.from === clock.base && clock.fresh.left === clock.base && clock.fresh.spent === 0);
    ok(`one of their own turns down reads as one (${clock.one.left} left)`, clock.one.spent === 1);
    ok(`two reads as two (${clock.two.left} left)`, clock.two.spent === 2);
    ok(`a shorter clock starts shorter (SLOW TO RISE: ${clock.short.from} of ${clock.base})`,
      clock.short.from === clock.base - 1 && clock.short.spent === 0);
    ok(`and still counts from its own start (${clock.shortOne.spent} spent of ${clock.short.from})`,
      clock.shortOne.spent === 1);

    // ── Both halves of the price are graded ─────────────────────────────────────────────
    const ladder = await page.evaluate(() => {
      const { squad } = __fight(1);
      const [a] = squad;
      const at = n => { a.laidThere = n; a.downFrom = BLEED_OUT; a.downTurns = BLEED_OUT - n;
                        return { scar: scarChanceFor(a) }; };
      const rows = [0, 1, 2].map(at);
      const deep = (() => { a.laidThere = 9; a.downFrom = 12; a.downTurns = 3;
                            return { scar: scarChanceFor(a) }; })();
      a.laidThere = 0; combatActive = false;
      return { rows, deep, base: SCAR_CHANCE, step: SCAR_PER_TURN, clear: DRAGGED_CLEAR };
    });
    const pct = x => `${(x * 100).toFixed(0)}%`;
    ok(`a fall the fight outlives is the cheapest roll there is (${pct(ladder.rows[0].scar)})`,
      Math.abs(ladder.rows[0].scar - ladder.base) < 1e-9);
    ok(`each of their own turns down costs more ` +
       `(${ladder.rows.map(r => pct(r.scar)).join(' / ')})`,
      ladder.rows[1].scar > ladder.rows[0].scar && ladder.rows[2].scar > ladder.rows[1].scar);
    ok(`the worst a live fall can roll is still a chance (${pct(ladder.rows[2].scar)})`,
      ladder.rows[2].scar > 0 && ladder.rows[2].scar < 0.5);
    ok(`and no clock however long makes it a certainty (${pct(ladder.deep.scar)})`,
      ladder.deep.scar < 1);


    // ── The same total, moved onto the falls that cost something ────────────────────────
    // The claim the phase is published on, encoded so it cannot quietly become a tax. Weighted
    // against the measured spread of clocks, the graded ladder has to land near the flat 8%
    // it replaces rather than above it.
    const weighted = await page.evaluate(() => {
      const { squad } = __fight(1);
      const [a] = squad;
      const spread = [[0, 0.57], [1, 0.35], [2, 0.08]];   // the two arms, averaged
      let mean = 0;
      spread.forEach(([n, w]) => { a.laidThere = n; mean += scarChanceFor(a) * w; });
      a.laidThere = 0; combatActive = false;
      return mean;
    });
    ok(`weighted against the clocks actually measured it averages ${pct(weighted)}, ` +
       `where the flat roll it replaces averaged 8-10%`,
      weighted > 0.06 && weighted < 0.13);

    // ── The health they come round on is FLAT, and that is the finding ──────────────────
    // This was graded too, on the same reasoning, and it cost the game two sectors of depth
    // against a paired arm in the same container: 3 sectors and 60 nodes against 7 and 80, with
    // wipes per run up from 3.1 to 4.1. The weighted mean was fine - 21% against this 20% - and
    // the mean was the wrong statistic. A body that comes round on a tenth is one the next node
    // takes straight back down, and the wider scar roll on it can deal CRACKED RIBS or SLOW TO
    // RISE and make the cycle after that worse. It compounds; the scar roll does not, because a
    // scar is carried rather than fed back into the fight that dealt it.
    //
    // So this is pinned as a deliberate flat, with the measurement, rather than left as an
    // absence for a later phase to helpfully "finish".
    const ends = await page.evaluate(() => {
      const { squad } = __fight(2);
      const [quick, slow] = squad;
      __lie(quick, 0);
      __lie(slow, 2);
      const spent = { quick: turnsDown(quick), slow: turnsDown(slow) };
      recoverDowned('once the field is held');
      combatActive = false;
      return { spent, quick: quick.hp, slow: slow.hp, max: quick.maxHp,
               qDown: quick.downTurns, sDown: slow.downTurns, share: DRAGGED_CLEAR };
    });
    ok(`the two of them lay there for ${ends.spent.quick} and ${ends.spent.slow} of their own turns`,
      ends.spent.quick === 0 && ends.spent.slow === 2);
    ok(`and both come round on the same ${Math.round(ends.share * 100)}% ` +
       `(${ends.quick} and ${ends.slow} of ${ends.max})`,
      ends.quick === ends.slow && ends.quick === Math.floor(ends.max * ends.share));
    ok('because grading this compounds into a spiral where grading the scar roll does not',
      ends.quick > 0 && ends.slow > 0);
    ok('and both are up, because only the clock kills', ends.qDown === 0 && ends.sDown === 0);

    // ── The scar roll lands on the one who lay there ────────────────────────────────────
    // Rigged between the two chances: a roll that the graded ladder catches on the operator who
    // was left and misses on the one who was not. Under the flat roll it did both or neither.
    const marked = await page.evaluate(() => {
      const { squad } = __fight(2);
      const [quick, slow] = squad;
      __lie(quick, 0); __lie(slow, 2);
      // The chances the two of them SHOULD be rolling, worked out without touching laidThere -
      // recoverDowned has to set that for itself. Driving markScars directly instead let a
      // version of recoverDowned that never recorded it pass every assertion here.
      const chanceAt = n => SCAR_CHANCE + SCAR_PER_TURN * n;
      const between = (chanceAt(0) + chanceAt(2)) / 2;
      const real = Math.random;
      Math.random = () => between;
      recoverDowned('once the field is held');
      Math.random = real;
      const out = { quick: (quick.scars || []).length, slow: (slow.scars || []).length,
                    qc: chanceAt(0), sc: chanceAt(2), roll: between };
      combatActive = false;
      return out;
    });
    ok(`a roll between the two chances (${(marked.qc * 100).toFixed(0)}% and ${(marked.sc * 100).toFixed(0)}%) ` +
       `marks the one who was left`, marked.slow === 1);
    ok('and not the one who was picked straight up', marked.quick === 0);
    ok('through the real ending, which is what has to know how long they lay there',
      marked.roll > marked.qc && marked.roll < marked.sc);

    // ── The ascension protocol still doubles it ─────────────────────────────────────────
    const grave = await page.evaluate(() => {
      const { squad } = __fight(1);
      const [a] = squad;
      a.laidThere = 1;
      const off = scarChanceFor(a);
      ascension = 7;
      const on = hasProtocol('MASSGRAVE') ? scarChanceFor(a) : null;
      ascension = 0; a.laidThere = 0; combatActive = false;
      return { off, on };
    });
    ok(`MASS GRAVE still doubles whatever the roll would have been ` +
       `(${pct(grave.off)} to ${pct(grave.on)})`,
      grave.on !== null && Math.abs(grave.on - grave.off * 2) < 1e-9);

    // ── And the manual says all of it ───────────────────────────────────────────────────
    // A price the player is meant to weigh mid-fight has to be readable somewhere other than
    // this file, and the numbers in it have to be the ones the code actually charges.
    const manual = await page.evaluate(() => {
      const body = CODEX.find(e => e.id === 'SCARS').body().join(' ');
      const prompt = PROMPTS.find(p => p.id === 'BLEEDOUT').body;
      return { body, prompt,
               clear: body.includes(`${Math.round(DRAGGED_CLEAR * 100)}%`),
               scar: body.includes(`${Math.round(SCAR_CHANCE * 100)}%`),
               worst: body.includes(`${Math.round((SCAR_CHANCE + 2 * SCAR_PER_TURN) * 100)}%`),
               bar: /STIM tactic/i.test(body),
               warned: /every turn they spend down/i.test(prompt) };
    });
    ok('the field manual states what a fall the fight outlives costs', manual.clear && manual.scar);
    ok('and what two turns on the floor costs instead', manual.worst);
    ok('it names the bar as an answer, not just the medic', manual.bar);
    ok('and the mid-fight prompt says getting to them early is worth more', manual.warned);
  }
};

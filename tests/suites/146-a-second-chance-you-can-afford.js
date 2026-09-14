// I01: two prices in this game climb linearly with depth rather than on sectorRewardMult, and
// H14 established why that matters - a price on a different curve from income is the only kind
// that can change what a player can do. Both are exits from trouble: RECRUIT_COST buys a body,
// RETREAT buys a way out of a fight you are losing.
//
// The recruit had been measured and retuned; its own comment records 110 + 22 a tier giving a
// median ask of 506 against a purse of 324, five offers in sixty-nine affordable, and nobody
// ever signed. Retreat sat at 45 + 15 a NODE - 1,080 by sector 7 tier 10 - and had never been
// looked at. Measured on the shipped build over three careers of 150, counting every moment a
// squad was losing and the engine would have let it break away but for the money: affordable
// 25 / 27 / 28% of the time, median ask 300 against a median purse of 150 / 159 / 158.
//
// perDepth is 6 now, which is the recruit's own slope. That is the relationship this suite
// pins: one depth slope in the game rather than two, and breaking off always cheaper than
// signing somebody on, at every depth. It deliberately asserts no rate and no price - H13 went
// red on three suites that had baked one balance pass into a literal - only the shape, and it
// prints the live numbers in the labels so a retune starts from them.
module.exports = {
  name: 'A second chance you can afford',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    const road = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const at = (s, t) => {
        currentSector = s; currentTier = t;
        return { depth: depthIndex(), retreat: retreatCost(), recruit: recruitCost(),
                 reward: sectorRewardMult() };
      };
      return { door: at(1, 1), deep: at(FINAL_SECTOR, TOTAL_TIERS),
               slopes: { retreat: RETREAT.perDepth, recruit: RECRUIT_COST.perDepth },
               bases: { retreat: RETREAT.cost, recruit: RECRUIT_COST.base } };
    });
    ok(`both depth prices climb with the road (retreat ${road.door.retreat} -> ${road.deep.retreat}, recruit ${road.door.recruit} -> ${road.deep.recruit})`,
      road.deep.retreat > road.door.retreat && road.deep.recruit > road.door.recruit);
    ok(`and on one slope between them, not two (${road.slopes.retreat} a node each)`,
      road.slopes.retreat === road.slopes.recruit);
    // The consequence of sharing a slope, which is the part that would go wrong silently: the
    // gap between them is a constant, so an escape never costs more than a body however deep
    // the run goes. At the old 15 it crossed over - 1,080 against a recruit's 504 by sector 7.
    ok(`so breaking off stays cheaper than signing on, by the same margin at either end (${road.deep.recruit - road.deep.retreat})`,
      road.door.recruit - road.door.retreat === road.deep.recruit - road.deep.retreat
      && road.deep.retreat < road.deep.recruit);
    // Neither rides the reward curve, which is what makes them able to move at all - see
    // 145-three-prices. Asserted so that putting one on outpostPrice cannot pass unnoticed.
    ok(`and neither rides the reward curve, which is why they can bind (x${road.deep.reward.toFixed(2)} against x${(road.deep.retreat / road.door.retreat).toFixed(2)})`,
      Math.abs(road.deep.retreat / road.door.retreat - road.deep.reward) > 1
      && Math.abs(road.deep.recruit / road.door.recruit - road.deep.reward) > 1);

    // ── The door is a price, not a hidden gate ───────────────────────────────────────
    // The measurement behind the retune counts moments where every clause of canRetreat held
    // except the money. That is only a fair reading if money is genuinely the last clause, so
    // it is checked here rather than assumed: lift the purse and the same board opens.
    const gate = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 3; currentTier = 5;
      initiateCombat('RAIDERS', false);
      const held = scrap;
      scrap = 0;
      const broke = canRetreat();
      scrap = retreatCost();
      const exact = canRetreat();
      scrap = retreatCost() - 1;
      const penny = canRetreat();
      scrap = held;
      // A commander does not let you leave, whichever way you try it - so the gate is not only
      // about money, and a boss fight must stay shut with a full purse.
      currentNodeType = 'BOSS';
      scrap = Number.MAX_SAFE_INTEGER;
      const atBoss = canRetreat();
      currentNodeType = 'RAIDERS';
      const rich = canRetreat();
      scrap = held;
      return { broke, exact, penny, atBoss, rich };
    });
    ok('an empty purse is what shuts the door', gate.broke === false);
    ok('the exact price opens it', gate.exact === true);
    ok('and a scrap short does not', gate.penny === false);
    ok('a full purse opens it', gate.rich === true);
    ok('but never on a commander, whatever the purse says', gate.atBoss === false);

    // ── What it buys is a second go, not a way past ──────────────────────────────────
    // Retreating and withdrawing are different doors and the prices say so: one is paid in
    // scrap and keeps the node, the other is paid in blood and leaves it behind. If retreating
    // ever advanced the tier it would be a cheaper withdraw, which is not what it is for.
    const keeps = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 4;
      const map = generateSectorMap(seededRng('retreat-keeps'));
      sectorMap = map;
      const node = Object.values(map.nodes).find(n => n.type === 'RAIDERS') ||
                   Object.values(map.nodes).find(n => n.type !== 'BOSS');
      enterNode(node.id);
      initiateCombat(node.type, false);
      scrap = retreatCost() * 4;
      const tierBefore = currentTier, paidBefore = scrap;
      // Arm, then commit, the way the deck does. The break can fail; force the success path so
      // this measures what a break DOES rather than how often it works.
      const real = Math.random; Math.random = () => 0;
      retreat(); retreat();
      Math.random = real;
      return { tierBefore, tierAfter: currentTier, spent: paidBefore - scrap,
               nodeId: node.id, standingAt: retreatNode,
               cleared: (clearedNodeIds || []).includes(node.id), fighting: combatActive };
    });
    ok(`a break costs the scrap it quoted (${keeps.spent})`, keeps.spent > 0);
    ok('and ends the fight', keeps.fighting === false);
    ok(`but does not advance the tier, which is what makes it a second go (${keeps.tierBefore} -> ${keeps.tierAfter})`,
      keeps.tierAfter === keeps.tierBefore);
    ok('and leaves the node un-cleared, standing in front of it',
      keeps.cleared === false && keeps.standingAt === keeps.nodeId);

    // ── O16: THE FAILURE PATH, AND WHY IT BLOCKED A TAKING POLICY FOR TWO PHASES ────────
    // I01 opened this door - perDepth 15 -> 6, affordability 25-28% -> 56-62% - and filed the
    // taking policy as needing "the loop to hand the turn walk back to the engine, a much larger
    // change". The reason is right here: a failed break calls nextTurn(), which OPENS the next
    // actor's turn through the engine - turn-start applied, turn counted - so a harness that
    // walks the queue itself would do both a second time.
    //
    // I02 then built `engineOpened` for exactly that state, on initiateCombat's opening
    // processTurn, and wrote three paragraphs later that "the retreat path stands as I01 left
    // it". It did not have to. These rows pin the state a failed break leaves behind, because
    // that state is the contract the simulator's one-line fix depends on.
    const broke = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      scrap = 100000;
      initiateCombat('RAIDERS', false);
      fightLog.turns = 0;
      // THE QUEUE IS BUILT, NOT ACCEPTED. The first cut took whatever order initiateCombat drew,
      // and the body behind the break was sometimes a HOSTILE - whose turn is not a squad turn
      // and whose cooldowns this fixture does not watch - so both rows below read "nothing
      // happened" and went red. That is the same defect suite 03's O15 block records, made the
      // same afternoon. One of ours breaks off, one of ours stands behind them, by hand.
      {
        const ours = turnQueue.filter(e => e.isPlayer && e.hp > 0);
        const theirs = turnQueue.filter(e => !e.isPlayer);
        turnQueue = [ours[0], ours[1], ...theirs].filter(Boolean);
        activeEntities = [...turnQueue];
        activeIndex = 0;
      }
      // A known cooldown everywhere, so "this actor's turn was opened" reads as a step of one.
      activeEntities.filter(e => e.isPlayer).forEach(e =>
        Object.keys(e.cooldowns || {}).forEach(k => { e.cooldowns[k] = 5; }));
      const cds = () => activeEntities.filter(e => e.isPlayer)
        .map(e => e.id + ':' + Object.values(e.cooldowns || {}).join(','));
      const before = { at: turnQueue[activeIndex].id, idx: activeIndex, cds: cds(),
                       behind: turnQueue[1].id, behindIsOurs: !!turnQueue[1].isPlayer };
      const real = Math.random; Math.random = () => 1;   // the break cannot hold
      retreat(); retreat();
      Math.random = real;
      const out = { before, live: combatActive, idx: activeIndex,
                    at: turnQueue[activeIndex] ? turnQueue[activeIndex].id : null,
                    turns: fightLog.turns, cds: cds(),
                    took: runStats.retreats || 0, failed: runStats.retreatsFailed || 0 };
      combatActive = false;
      return out;
    });
    ok(`a break that fails leaves the fight running and books itself both ways ` +
       `(${broke.took} taken, ${broke.failed} failed)`,
      broke.live === true && broke.took === 1 && broke.failed === 1);
    // THE CONTRACT. The queue moved on, and the actor it moved to has had its turn OPENED by the
    // engine - exactly once. A simulator that re-opens it double-ticks; one that hands it to
    // engineOpened does not.
    ok(`and the queue has moved on to the operator standing behind (${broke.before.at} -> ${broke.at})`,
      broke.before.behindIsOurs === true && broke.idx !== broke.before.idx
      && broke.at === broke.before.behind);
    ok(`whose turn the engine has already opened - one cooldown step, on that body alone ` +
       `(${broke.before.cds.join(' ')} -> ${broke.cds.join(' ')})`,
      (() => {
        const b = Object.fromEntries(broke.before.cds.map(x => x.split(':')));
        const a = Object.fromEntries(broke.cds.map(x => x.split(':')));
        const stepped = Object.keys(a).filter(k => a[k] !== b[k]);
        return stepped.length === 1 && stepped[0] === broke.at;
      })());
    ok(`and counted that turn exactly once (fightLog 0 -> ${broke.turns})`, broke.turns === 1);
    // AND THE SIMULATOR TAKES THAT CONTRACT, rather than only this suite knowing about it.
    const sim = require('fs').readFileSync(require('path').join(__dirname, '..', 'simulate.js'), 'utf8');
    ok('the simulator has an arm that presses the button', /flag\('retreat', 'off'\)/.test(sim));
    ok('and hands the engine-opened turn back rather than re-opening it',
      /stat\.retreatFailed\+\+;\s*\n\s*engineOpened = turnQueue\[activeIndex\];/.test(sim));
    ok('and reads the engine\'s own count back against its own',
      /stat\.engineRetreats = runStats\.retreats/.test(sim) && /MISMATCH/.test(sim));
  }
};

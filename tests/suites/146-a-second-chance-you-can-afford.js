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
  }
};

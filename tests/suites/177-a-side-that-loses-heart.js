// ── R03: NOTHING EVER RETREATED BUT YOU ───────────────────────────────────────────────
//
// The squad has four ways out of a fight - withdraw, retreat, fall back, extract. The road had
// none. Every hostile in the game stood to the last body whatever its losses, whatever its
// commander was doing, and whatever it came for. "Kill that one and the rest lose heart" is the
// oldest idea in squad tactics and this combat model had never had it.
//
// MEASURED BEFORE IT WAS BUILT, because M12 and D06 both died on exactly this question: would
// the condition ever fire? Across twelve expeditions the side's biggest body fell with somebody
// still standing in 78-80% of fights. Reachable. What that census CANNOT say is what the payoff
// will be - it measures play under the old rule, and the whole point of the reward is to move
// the anchor earlier in the fight. The distribution it is read off is the one the change is
// meant to shift, and reading it as a property of the game would be D05's trap in a new coat.
//
// A BROKEN BODY IS NOT A KILLED ONE. It leaves by dropping to zero rather than by being spliced
// out of activeEntities - nothing in this engine is ever removed mid-fight and 148 readers test
// `hp > 0` - and `fled` is what keeps it from paying: noteKill is only ever called off the
// damage path, so a body that leaves this way gives no kill credit, no momentum, no bounty
// progress and nothing to the bestiary. It spends a turn going, which is the squad's one chance
// to take the kill instead. That turn is the decision the item is actually for.
//
// AND NOT IN A COMMANDER FIGHT. Tier 10 takes 89% of every wipe and H13 cut the wall to where
// it is on purpose. A mechanic that eased the one node this record calls a gate would be moving
// that dial sideways while calling itself tactics.
const { engineUp } = require('../boot');

module.exports = {
  name: 'A side that loses heart',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`); await engineUp(page);

    // A constructed field: one big body and three small ones, so the anchor is unambiguous and
    // the survivors are all eligible. Math.random pinned so the break cannot be a coin flip.
    const build = (nodeType, chance) => `
      currentSlot = 1; confirmNewGame(1.0);
      playerRoster.forEach((c, i) => { c.gridPos = i < 3 ? i + 1 : 0; });
      initiateCombat('${nodeType}', false);
      activeEntities = activeEntities.filter(e => e.isPlayer);
      const mk = (id, hp) => ({ id, name: id, isPlayer: false, hp, maxHp: hp, dmgBase: 5,
        speed: 5, gridPos: 1, classType: 'RAIDER', resistances: {}, cooldowns: {},
        stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, intent: null });
      const anchor = mk('BIG', 200);
      const rest = ['a', 'b', 'c'].map(n => mk(n, 10));
      activeEntities.push(anchor, ...rest);
      Math.random = () => ${chance};
      anchor.hp = 0;
      noteKill(anchor, {});
    `;

    const broke = await page.evaluate(new Function(build('RAIDERS', 0.1) + `
      const mob = activeEntities.filter(e => !e.isPlayer && e.id !== 'BIG');
      return { breaking: mob.filter(e => e.breaking).length, of: mob.length,
               intent: mob[0].intent && mob[0].intent.type,
               word: INTENT_WORDS.BREAK, threat: INTENT_THREAT.BREAK,
               booked: (runStats && runStats.broke) || 0,
               bodies: (runStats && runStats.brokeBodies) || 0 };
    `));
    ok(`the survivors break when the anchor falls (${broke.breaking} of ${broke.of})`,
      broke.breaking === broke.of && broke.of === 3);
    ok('and they carry an intent that says so', broke.intent === 'BREAK'
      && /pulling out/.test(broke.word) && broke.threat === 0);
    ok(`the run books it (${broke.booked} sides, ${broke.bodies} bodies)`,
      broke.booked === 1 && broke.bodies === 3);

    // A roll above the chance holds the line, which is what makes it a check rather than a rule.
    const held = await page.evaluate(new Function(build('RAIDERS', 0.99) + `
      const mob = activeEntities.filter(e => !e.isPlayer && e.id !== 'BIG');
      return { breaking: mob.filter(e => e.breaking).length, chance: MORALE.chance,
               booked: (runStats && runStats.broke) || 0 };
    `));
    ok(`a bad roll holds them (chance ${held.chance})`,
      held.breaking === 0 && held.booked === 0);

    // THE ROW THE WALL NEEDS. A commander fight is a gate and nothing in it may break.
    const boss = await page.evaluate(new Function(build('BOSS', 0.1) + `
      const mob = activeEntities.filter(e => !e.isPlayer && e.id !== 'BIG');
      return { breaking: mob.filter(e => e.breaking).length, booked: (runStats && runStats.broke) || 0 };
    `));
    ok('nothing breaks in a commander fight', boss.breaking === 0 && boss.booked === 0);

    const off = await page.evaluate(new Function(`MORALE_ON = false;` + build('RAIDERS', 0.1) + `
      const mob = activeEntities.filter(e => !e.isPlayer && e.id !== 'BIG');
      const out = { breaking: mob.filter(e => e.breaking).length };
      MORALE_ON = true;
      return out;
    `));
    ok('and the control withholds it whole', off.breaking === 0);

    // ── Leaving costs them everything a body is worth dead ──────────────────────────────
    const left = await page.evaluate(new Function(build('RAIDERS', 0.1) + `
      const one = activeEntities.find(e => e.breaking);
      const before = { kills: runStats.kills || 0, momentum,
                       seen: (bestiary[typeNameOf(one)] && bestiary[typeNameOf(one)].killed) || 0 };
      executeEnemyAi(one);
      return { gone: one.hp === 0 && one.fled === true,
               kills: (runStats.kills || 0) - before.kills,
               momentum: momentum - before.momentum,
               tallied: ((bestiary[typeNameOf(one)] && bestiary[typeNameOf(one)].killed) || 0) - before.seen,
               booked: runStats.fled || 0 };
    `));
    ok('a broken body leaves the field on its own turn', left.gone && left.booked === 1);
    ok('and pays nothing on the way out - no kill, no momentum, no bestiary',
      left.kills === 0 && left.momentum === 0 && left.tallied === 0);

    // ── T05: the arm that isolates the momentum term ────────────────────────────────────
    // R03 explained its half-operator-a-run cost by arithmetic through momentum and said plainly
    // that nothing had withheld that term ON ITS OWN. MORALE_PAYS is that term on its own: the
    // break still happens and the body still gives no kill, no bounty and no bestiary, but the
    // squad collects what killing it would have paid. Default false, so the row above is what
    // the shipped game does and this one is what the arm does.
    const paid = await page.evaluate(new Function(`MORALE_PAYS = true;` + build('RAIDERS', 0.1) + `
      const one = activeEntities.find(e => e.breaking);
      const before = { kills: runStats.kills || 0, momentum,
                       seen: (bestiary[typeNameOf(one)] && bestiary[typeNameOf(one)].killed) || 0 };
      executeEnemyAi(one);
      const out = { gone: one.hp === 0 && one.fled === true,
                    kills: (runStats.kills || 0) - before.kills,
                    momentum: momentum - before.momentum,
                    tallied: ((bestiary[typeNameOf(one)] && bestiary[typeNameOf(one)].killed) || 0) - before.seen,
                    worth: KILL_MOMENTUM };
      MORALE_PAYS = false;
      return out;
    `));
    ok(`under the arm a runner pays its momentum (${paid.momentum} of ${paid.worth})`,
      paid.gone && paid.momentum === paid.worth && paid.worth > 0);
    ok('and still nothing else - no kill credit, no bestiary line',
      paid.kills === 0 && paid.tallied === 0);
    // The arm has to be OFF unless somebody turns it on, or every figure measured before it
    // silently changes meaning. Read after the block above put it back.
    ok('and the shipped game does not have it on',
      await page.evaluate(() => MORALE_PAYS === false));

    // THE DECISION. It spends a turn going, so the squad can take the kill instead - and that
    // one IS worth everything, which is the trade the whole item exists to offer.
    const caught = await page.evaluate(new Function(build('RAIDERS', 0.1) + `
      const one = activeEntities.find(e => e.breaking);
      const before = runStats.kills || 0;
      one.hp = 0; noteKill(one, {});
      return { credited: (runStats.kills || 0) - before, fled: !!one.fled };
    `));
    ok('killing one before it goes still counts as a kill',
      caught.credited === 1 && caught.fled === false);

    // And the fight ends when the last of them has gone, without anybody killing anything.
    const ended = await page.evaluate(new Function(build('RAIDERS', 0.1) + `
      activeEntities.filter(e => e.breaking).forEach(e => { e.fled = true; e.hp = 0; });
      const anyLeft = activeEntities.some(e => !e.isPlayer && e.hp > 0);
      checkWinState();
      return { anyLeft, over: combatActive === false || anyLeft === false };
    `));
    ok('a field emptied by flight is a field the squad has won',
      ended.anyLeft === false && ended.over);
  }
};

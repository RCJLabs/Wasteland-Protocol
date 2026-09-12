// M09. CALLED SHOT paid the SNIPER +25% against a marked target, and M06 measured it at 1% of
// that sniper's swings - the lowest rate of any signature in the game. M06 also ruled out the
// obvious artefact (the mark is reachable: 1,061 placed over 150 expeditions, 86% of them
// cashed) and then EXPLAINED the 1% by saying the sniper is almost never the body that swings at
// the marked target next. That explanation was asserted rather than measured, and it is the
// whole question, so M09 measured it.
//
//   marks placed on a hostile                    1,061      all from SPOTTERS_MARK
//   cashed before they ran out                     914      86%, only 25 expired
//   cashed by the body that PLACED it               83      9%
//   cashed by an ally                              831      91%
//
// THE CAUSE IS TEMPO AND IT IS STRUCTURAL. A mark is one-shot: the first damaging move to land
// takes MARK_BONUS and zeroes the timer, whoever swings. The sniper places it on ITS OWN TURN,
// so every other body acts before its next one - and MARK_BONUS is exactly what makes that
// target the obvious thing to hit. Proved rather than argued, with an arm: `--mark own` teaches
// the simulator's targeting to steer a CALLED SHOT holder onto its own mark, and the setter's
// share goes 9% -> 16% and stops. The same run says why - the steer succeeded 186 times out of
// the 204 chances it got, from 1,387 marks placed. Playing deliberately does not help because
// the opportunity is not there.
//
// So the card is paid where its own sibling is paid. SPOTTER_NETWORK gives momentum whenever a
// mark is cashed by ANYBODY; CALLED SHOT now gives damage on the same trigger, off the sniper
// who placed the mark rather than the body that spends it. Measured after: 51 of 54 of its
// holder's marks pay it, against 9% before. The fork is two currencies on one trigger instead of
// one live option and one dead one.
module.exports = {
  name: 'Who cashes the mark',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', '..');
    const src = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
    const sim = fs.readFileSync(path.join(root, 'tests', 'simulate.js'), 'utf8');

    // ── A mark has an owner, and it is one-shot ─────────────────────────────────
    const field = () => page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField();
      // __bare, because a muster hands out quirks and a quirk moves damage. The first cut of
      // this fixture did not, and the same arm came back 47, 51 and 65 on three builds of the
      // field - which reads as three different findings and is one uncontrolled fixture. L06
      // built __bare for exactly this and 45 hand-rolled fixtures are ratcheted onto it.
      const sniper = window.__bare(playerRoster.find(c => c.classType === 'SNIPER'));
      const ally = window.__bare(playerRoster.find(c => c.classType === 'BRUISER'));
      sniper.gridPos = 2; ally.gridPos = 1;
      sniper.hp = sniper.maxHp = 900; ally.hp = ally.maxHp = 900;
      sniper.dmgBase = 28; ally.dmgBase = 20;
      sniper.traits = []; ally.traits = []; sniper.quirk = null; ally.quirk = null;
      Object.keys(sniper.cooldowns).forEach(k => sniper.cooldowns[k] = 0);
      const foe = window.__dummy({ id: 'mk0', hp: 99999, maxHp: 99999 });
      activeEntities = [sniper, ally, foe]; turnQueue = [sniper, ally, foe];
      combatActive = true; momentum = 0;
      window.__swing = (who, move) => {
        activeIndex = turnQueue.indexOf(who); pendingAction = move;
        const before = foe.hp; resolveAction(foe.id); return before - foe.hp;
      };
      return { sniperId: sniper.id, allyId: ally.id };
    });

    const owned = await (async () => { const ids = await field(); return page.evaluate(id => {
      const foe = activeEntities.find(e => !e.isPlayer);
      const sniper = activeEntities.find(e => e.id === id);
      window.__swing(sniper, 'SPOTTERS_MARK');
      const afterMark = { turns: foe.markedTurns, by: foe.markedBy };
      const ally = activeEntities.find(e => e.isPlayer && e.id !== id);
      window.__swing(ally, 'HEAVY_WRENCH');
      return { afterMark, afterCash: { turns: foe.markedTurns, by: foe.markedBy } };
    }, ids.sniperId); })();
    ok(`placing a mark records who placed it (${owned.afterMark.turns} turns, by ${owned.afterMark.by})`,
      owned.afterMark.turns > 0 && !!owned.afterMark.by);
    ok(`and the first damaging hit spends it, whoever swings (${owned.afterCash.turns} turns left)`,
      owned.afterCash.turns === 0);

    // ── The card is paid off the setter, not the swinger ────────────────────────
    // The whole re-key in four numbers. The ally's swing is the one that lands in every arm;
    // what changes is who was holding the card when the mark went down.
    // ONE field, with everything that carries between swings put back by hand before each arm.
    // Two earlier cuts of this got it wrong in opposite directions: reusing a field without
    // resets let momentum and cooldowns drift the numbers upward across the arms, and rebuilding
    // the field per arm swapped that for build-to-build variance the fixture could not pin. The
    // arms differ in the card and the mark's owner and in nothing else, which is the only way
    // four numbers are comparable.
    const ids = await field();
    const arms = await page.evaluate(({ sniperId, allyId }) => {
      const foe = activeEntities.find(e => !e.isPlayer);
      const sniper = activeEntities.find(e => e.id === sniperId);
      const ally = activeEntities.find(e => e.id === allyId);
      // AVERAGED, because a single swing is not a measurement. Resetting momentum, cooldowns and
      // the target got the arms comparable in kind and they still came back 45/70/49/54/56 - the
      // damage roll itself varies per swing. Suite 29 solved this before I did, with __perkAvg
      // over twelve swings, and the right move was to read that rather than re-derive it badly.
      const AVG = 24;
      const runOnce = (setterHolds, swingerHolds, ownMark) => {
        momentum = 0; momentumFocus = 0; pressExtra = false;
        Object.keys(sniper.cooldowns).forEach(k => sniper.cooldowns[k] = 0);
        Object.keys(ally.cooldowns).forEach(k => ally.cooldowns[k] = 0);
        foe.hp = foe.maxHp = 99999; foe.markedTurns = 0; foe.markedBy = null;
        foe.bleedingTurns = 0; foe.corrodedTurns = 0; foe.oiledTurns = 0; foe.stunnedTurns = 0;
        sniper.traits = setterHolds ? ['CALLED_SHOT'] : [];
        ally.traits = swingerHolds ? ['CALLED_SHOT'] : [];
        window.__swing(sniper, 'SPOTTERS_MARK');
        if (!ownMark) foe.markedBy = null;
        return window.__swing(ally, 'HEAVY_WRENCH');
      };
      const run = (a, b, c) => {
        let t = 0;
        for (let i = 0; i < AVG; i++) t += runOnce(a, b, c);
        return t / AVG;
      };
      return { plain: run(false, false, true), setterHolds: run(true, false, true),
               swingerHolds: run(false, true, true),
               orphan: run(true, false, false), orphanControl: run(false, false, false),
               mult: CALLED_SHOT_MULT };
    }, ids);
    const paid = arms;
    const near = (v, want, tol) => Math.abs(v - want) <= tol;
    ok(`the setter holding it pays (${paid.plain.toFixed(1)} -> ${paid.setterHolds.toFixed(1)}, x${(paid.setterHolds / paid.plain).toFixed(2)})`,
      paid.setterHolds > paid.plain);
    ok(`and lands on the multiplier it advertises (want x${paid.mult})`,
      Math.abs(paid.setterHolds / paid.plain - paid.mult) < 0.06);
    // THE ROW THAT SAYS WHICH BODY IT READS. Under the old card this was the arm that paid and
    // the one above was the arm that did not; they have swapped, and asserting both is what
    // makes that a fact rather than a claim.
    ok(`the body that SWINGS holding it pays nothing (${paid.swingerHolds.toFixed(1)} against ${paid.plain.toFixed(1)})`,
      near(paid.swingerHolds / paid.plain, 1, 0.06));
    ok(`and a mark with no owner pays the holder nothing (${paid.orphan.toFixed(1)} against ${paid.orphanControl.toFixed(1)} unheld)`,
      near(paid.orphan / paid.orphanControl, 1, 0.06));

    // ── A setter who has fallen still owns the mark ─────────────────────────────
    // loseOperator takes the fallen off playerRoster and leaves the body on the field, so the
    // lookup is against activeEntities. A roster lookup would quietly stop paying the moment the
    // sniper went down - the turn its last mark matters most.
    const dead = await (async () => { const ids = await field(); return page.evaluate(({ sniperId, allyId }) => {
      const foe = activeEntities.find(e => !e.isPlayer);
      const sniper = activeEntities.find(e => e.id === sniperId);
      const ally = activeEntities.find(e => e.id === allyId);
      sniper.traits = ['CALLED_SHOT']; ally.traits = [];
      foe.markedTurns = 0; foe.markedBy = null;
      window.__swing(sniper, 'SPOTTERS_MARK');
      loseOperator(sniper, 'COMBAT');
      const onRoster = playerRoster.some(c => c.id === sniperId);
      const onField = activeEntities.some(e => e.id === sniperId);
      // Averaged like the arms above, and re-marked by hand each pass because the sniper who
      // would have re-marked it is dead - which is the point of the row. A single swing here
      // would be one more assertion sitting inside its own noise, which K03 spent a phase on.
      const avg = own => {
        let t = 0;
        for (let i = 0; i < 24; i++) {
          momentum = 0; Object.keys(ally.cooldowns).forEach(k => ally.cooldowns[k] = 0);
          foe.hp = foe.maxHp = 99999;
          foe.markedTurns = 3; foe.markedBy = own ? sniperId : null;
          t += window.__swing(ally, 'HEAVY_WRENCH');
        }
        return t / 24;
      };
      return { onRoster, onField, cashed: avg(true), control: avg(false) };
    }, ids); })();
    ok(`a fallen sniper is off the roster and still on the field (roster ${dead.onRoster}, field ${dead.onField})`,
      dead.onRoster === false && dead.onField === true);
    ok(`and its last mark still pays (${dead.cashed.toFixed(1)} against ${dead.control.toFixed(1)} for an unowned mark)`,
      dead.cashed / dead.control > 1.15);
    ok('because the lookup is the field, not the roster',
      /activeEntities\.find\(e => e\.isPlayer && e\.id === target\.markedBy\)/.test(src));

    // ── The ledger counts all three endings ─────────────────────────────────────
    const census = await page.evaluate(() => {
      runStats.mk = null;
      const foe = { isPlayer: false }, op = { isPlayer: true };
      noteMark('set', 'SPOTTERS_MARK', foe, { isPlayer: true, traits: ['CALLED_SHOT'] });
      noteMark('set', 'SPOTTERS_MARK', foe, { isPlayer: true, traits: [] });
      noteMark('set', 'CARRION_CALL', op, null);          // an operator: a different mark entirely
      noteMark('cash', { classType: 'BRUISER', id: 'x' }, { isPlayer: false, markedBy: 'x' });
      noteMark('cash', { classType: 'MEDIC', id: 'y' }, { isPlayer: false, markedBy: 'x' });
      noteMark('called', { isPlayer: true }, foe);
      noteMark('expire', null, foe);
      noteMark('expire', null, op);                        // the operator's, which must not count
      return JSON.parse(JSON.stringify(runStats.mk));
    });
    ok(`marks on hostiles and marks on operators are separate tallies (${census.set} and ${census.onSquad})`,
      census.set === 2 && census.onSquad === 1);
    ok(`the holder's share of what was placed is counted (${census.setByHolder} of ${census.set})`,
      census.setByHolder === 1);
    ok(`cashing is split by whether the casher placed it (${census.own} own, ${census.ally} ally)`,
      census.own === 1 && census.ally === 1);
    ok(`and an expiry on an operator is not an expiry of this kind (${census.expired})`, census.expired === 1);
    ok(`what the card was actually paid on is its own count (${census.called})`, census.called === 1);

    // ── The instrument that was wrong three times ───────────────────────────────
    // M07 fixed this class in nums(), M08's per-card accumulator hand-listed its keys and
    // printed NaN, and M09's first cut listed two keys in the SUM and not the SEED - so a working
    // card read as a clean zero for three runs. A zero is worse than a NaN because it is
    // believable. The seed is the schema now, and this row is what stops the fourth time.
    ok('the mark accumulator sums the keys its seed declares rather than a hand-written list',
      /const SEED = \{ set: 0,/.test(sim) && /Object\.keys\(SEED\)\.forEach\(k => \{ a\[k\] \+= Number/.test(sim));
    ok('and the report names the holder denominator beside the payout, so a zero can be read',
      /placed by a CALLED SHOT holder/.test(sim) && /an absent fork, not a broken card/.test(sim));
    ok('the arm that steers a holder onto its own mark exists and is not the default',
      /const MARK_POLICY = flag\('mark', 'blind'\)/.test(sim)
      && /markPolicy === 'own' && typeof hasTrait === 'function' && hasTrait\(actor, 'CALLED_SHOT'\)/.test(sim));

    // ── And the card says what it now does ──────────────────────────────────────
    const card = await page.evaluate(() => {
      const c = SIG_PERKS.find(p => p.id === 'CALLED_SHOT');
      const sib = SIG_PERKS.filter(p => p.fork === (c || {}).fork).map(p => p.id);
      return { desc: (c || {}).desc, fork: (c || {}).fork, sib };
    });
    ok(`CALLED SHOT's card describes the mark rather than the swing ("${card.desc}")`,
      /mark this sniper places/i.test(card.desc) && !/to marked targets/i.test(card.desc));
    ok(`and it still forks against SPOTTER_NETWORK, one trigger and two currencies (${card.sib.join(' / ')})`,
      card.sib.includes('SPOTTER_NETWORK') && card.sib.includes('CALLED_SHOT'));
  }
};

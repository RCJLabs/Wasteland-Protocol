// ── R02: THE FIRST WAY TO LOSE A FIGHT WITH THE WHOLE SQUAD ON ITS FEET ───────────────
//
// checkWinState ends a fight on `!pA` or `!eA` and on nothing else - one win condition, one
// loss condition, and they are the same predicate with the sides swapped. R03 gave a hostile a
// way OUT of a fight and the terminal condition did not move; what was missing was never an
// exit for a body.
//
// SIZED OFF R02's CENSUS RATHER THAN GUESSED. 26,186 fights say a win takes a median of 9 squad
// turns and a LOSS takes 19, p90 57, worst 227; and the histogram says a deadline at squad turn
// 12 would catch 39% of fights, at 16 27%, at 20 19%, at 25 14%, at 30 10%. PRESSED.at is 20 -
// well past the median win, so a squad playing normally never sees the clock and only a fight
// already going badly does.
//
// AND IT CUTS BOTH WAYS, which is why it ships behind an arm and not on a conviction. The same
// census says damage is LINEAR in turns, so ending a fight early hands damage back in
// proportion. This adds a loss condition and removes damage in one stroke. Which dominates is
// the measurement's business, not this file's.
//
// WHAT THIS SUITE HOLDS is the part that has to be true whatever the careers say: that the
// clock is visible, that it never touches a commander, that it ends the fight through the exit
// the game already has rather than a second one with its own rules about pursuit, and that
// NOBODY DIES OF IT. A clock that killed people would not be a failure, it would be a
// punishment, and "fail while standing" would mean nothing.
const { engineUp } = require('../boot');

module.exports = {
  name: 'A fight you can fail standing',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`); await engineUp(page);

    // ── Who carries a clock ──────────────────────────────────────────────────────────────
    const roll = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); currentSector = 3;
      const ids = Array.from({ length: 400 }, (_, i) => 'n' + i);
      const on = ids.filter(id => pressedFor(id, 'RAIDERS') > 0).length;
      return {
        share: Math.round(on / ids.length * 100), want: PRESSED.share, at: PRESSED.at,
        // Seeded, so the same node reads the same way every time it is asked.
        stable: ids.every(id => pressedFor(id, 'RAIDERS') === pressedFor(id, 'RAIDERS')),
        boss: ids.every(id => pressedFor(id, 'BOSS') === 0),
        nameless: pressedFor(null, 'RAIDERS'),
        off: (() => { PRESSED_ON = false; const n = ids.filter(id => pressedFor(id, 'RAIDERS')).length;
                      PRESSED_ON = true; return n; })(),
      };
    });
    ok(`about the share the table asks for (${roll.share}% against ${roll.want}%)`,
      Math.abs(roll.share - roll.want) <= 7);
    ok('and the same node always reads the same way', roll.stable);
    // A commander is the one node a squad cannot withdraw from, so a clock there would be a
    // fight you are forced into and then forced out of.
    ok('never on a commander - the one node you cannot walk away from', roll.boss);
    ok('a fight staged with no node behind it carries none', roll.nameless === 0);
    ok('and the arm takes it away whole', roll.off === 0);

    // ── The clock is on screen, counting down ────────────────────────────────────────────
    // A deadline the player cannot read is not tension, it is an ambush at turn 20.
    const seen = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      initiateCombat('RAIDERS', false);
      pressedAt = 10; fightLog.turns = 0;
      renderField();
      const b = document.getElementById('clock-banner');
      const at0 = { text: b.innerText, shown: b.style.display, cls: b.className, left: pressedLeft() };
      fightLog.turns = 8; renderField();
      const at8 = { text: b.innerText, cls: b.className, left: pressedLeft() };
      pressedAt = 0; renderField();
      const none = { shown: b.style.display, text: b.innerText };
      return { at0, at8, none };
    });
    ok(`the clock is on screen while one is running ("${seen.at0.text}")`,
      seen.at0.shown === 'block' && /10 TURNS/.test(seen.at0.text));
    ok('it counts DOWN, which is the number a decision is made against',
      seen.at0.left === 10 && seen.at8.left === 2 && /2 TURNS/.test(seen.at8.text));
    ok('and goes urgent inside the last three', seen.at0.cls === 'clock-on' && seen.at8.cls === 'clock-out');
    ok('a fight with no clock shows no banner at all',
      seen.none.shown === 'none' && seen.none.text === '');

    // ── It ends the fight, through the exit the game already has ─────────────────────────
    const ran = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      initiateCombat('RAIDERS', false);
      pressedAt = 5; fightLog.turns = 0;
      const foes = () => activeEntities.filter(e => !e.isPlayer && e.hp > 0).length;
      const squadUp = () => activeEntities.filter(e => e.isPlayer && e.hp > 0).length;
      const before = { foes: foes(), up: squadUp(), scrapWas: scrap };
      // Short of the clock: nothing happens.
      fightLog.turns = 4;
      const early = { fired: pressedOut(), live: combatActive };
      // On the clock: it ends.
      fightLog.turns = 5;
      const fired = pressedOut();
      return { before, early, fired, live: combatActive,
               up: playerRoster.filter(c => c.hp > 0).length,
               chased: !!pursuit, booked: (runStats && runStats.pressedOut) || 0 };
    });
    ok('a turn short of the clock, nothing happens', !ran.early.fired && ran.early.live);
    ok('on the clock, the fight ends', ran.fired && !ran.live);
    ok('NOBODY DIES OF IT - the squad walks out standing', ran.up >= 1);
    ok('the hostiles give chase, through withdraw\'s own path', ran.chased);
    ok('and it books itself', ran.booked === 1);

    // ── One exit, not two ────────────────────────────────────────────────────────────────
    // The clock and the button leave a fight the same way. A second exit written beside the
    // first would be a second set of rules about pursuit, momentum and who gets picked up.
    const shared = await page.evaluate(() => ({
      clockCalls: /forceBreakContact\(\)/.test(pressedOut.toString()),
      buttonCalls: /forceBreakContact\(\)/.test(withdraw.toString()),
      bodyHasPursuit: /pursuit = /.test(forceBreakContact.toString()),
      bodyPaysNothing: /collectLoot\(0, true\)/.test(forceBreakContact.toString()),
      buttonKeepsArming: /armedExit/.test(withdraw.toString()),
      clockDoesNotArm: !/armedExit/.test(pressedOut.toString()),
    }));
    ok('the clock leaves through forceBreakContact', shared.clockCalls);
    ok('and so does the button - one exit, not two', shared.buttonCalls);
    ok('the shared body is the one that sets pursuit and pays nothing',
      shared.bodyHasPursuit && shared.bodyPaysNothing);
    ok('the button still asks twice, and the clock never does',
      shared.buttonKeepsArming && shared.clockDoesNotArm);

    // ── The turn that runs out is not also taken ─────────────────────────────────────────
    const order = await page.evaluate(() => ({
      engine: /noteSquadTurn\(\);[\s\S]{0,120}?if \(pressedOut\(\)\) return;/.test(processTurn.toString()),
    }));
    ok('the engine checks the clock on the same beat it counts the turn, and returns',
      order.engine);

    await page.evaluate(() => { PRESSED_ON = true; pressedAt = 0; });
  }
};

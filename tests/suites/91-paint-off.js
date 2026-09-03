// E01: the engine paints because somebody is watching it. The balance simulator is not, and a
// CDP sampling profile of one full expedition found 73% of the run going into work that no
// reported number reads: getBoundingClientRect 45.0%, fitField 13.7%, log 13.4%, triggerHitFlash
// 5.5%, renderField 5.8%. Nearly all of it is forced synchronous layout - a fit pass that
// bisects while measuring, a log line that reads scrollHeight to stay pinned to the bottom, a
// hit flash that reads offsetWidth to restart its own animation, a tracer that measures two
// sprites and the field to draw a line between them.
//
// Measured on the same machine, an expedition of ~100 nodes went from 63-73s to 7.8-8.7s - the
// per-node cost from 631-734ms to 73-78ms. That is the difference between this file's own
// default of 60 runs costing an hour and costing six minutes, and it is why every balance
// baseline in this repo has been taken at whatever N was affordable rather than whatever N the
// question needed.
//
// The whole claim rests on paintOff being INERT to outcomes, so that is what this suite pins.
// It can be argued from the code - every getBoundingClientRect, offsetWidth, clientWidth and
// scrollHeight in game.js is inside a render or a fit pass, and isOutOfDepth, the one place
// reach could plausibly have been geometric, is `isMelee(move) && dist >= FRONT_RANKS` - but an
// argument is not a measurement. So: the same fight, seeded, played twice, and the two states
// compared. If painting ever starts deciding anything, this fails.
module.exports = {
  name: 'Painting decides nothing',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── It is off unless a harness asks for it ─────────────────────────────────────────
    const def = await page.evaluate(() => ({ v: paintOff, t: typeof paintOff }));
    ok(`paintOff is off for anyone who did not ask (${def.v})`, def.v === false && def.t === 'boolean');

    // ── The same fight, seeded, played twice ──────────────────────────────────────────
    // Math.random is the only entropy the fight path draws on that runSeed does not cover, so it
    // is pinned outright rather than approximated. Everything else is the real engine.
    const twice = await page.evaluate(() => {
      const play = (paint) => {
        const real = Math.random;
        Math.random = mulberry32(seedFromString('E01-PAINT-OFF'));
        try {
          currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
          paintOff = paint;
          currentSector = 2; currentTier = 5;
          initiateCombat('RAIDERS', false);
          let turns = 0;
          while (combatActive && turns < 200) {
            turns++;
            const actor = turnQueue[activeIndex];
            if (!actor) break;
            if (actor.hp <= 0) { activeIndex = (activeIndex + 1) % turnQueue.length; continue; }
            if (!activeEntities.some(e => e.isPlayer && e.hp > 0)) break;
            if (!activeEntities.some(e => !e.isPlayer && e.hp > 0)) break;
            if (actor.isPlayer) {
              // A fixed swing, so the comparison is about the engine and not about a policy.
              const foe = activeEntities.find(e => !e.isPlayer && e.hp > 0);
              if (foe) applyDamageHit(actor, foe, 18, 'phys', 'BASIC');
            } else {
              executeEnemyAi(actor);
            }
            renderField();
            activeIndex = (activeIndex + 1) % turnQueue.length;
          }
          // The fingerprint: everything the fight decided, and nothing about how it looked.
          // Keyed on name and turn order rather than on id - generateEnemies stamps Date.now()
          // into an enemy's id (e0_1788478808035), so two identical fights carry different ids
          // for a reason that has nothing to do with what either of them decided.
          const key = (e, i) => `${i}:${e.name}`;
          return {
            turns,
            hp: activeEntities.map((e, i) => `${key(e, i)}:${e.hp}`).join('|'),
            momentum, scrap,
            statuses: activeEntities.map((e, i) =>
              `${key(e, i)}:${e.bleedingTurns || 0},${e.stunnedTurns || 0},${e.armorTurns || 0}`).join('|'),
            logLines: document.querySelectorAll('#log > div').length,
          };
        } finally { Math.random = real; paintOff = false; }
      };
      return { painted: play(false), headless: play(true) };
    });

    ok(`the fight runs the same number of turns either way (${twice.painted.turns} vs ${twice.headless.turns})`,
      twice.painted.turns === twice.headless.turns && twice.painted.turns > 3);
    ok('every combatant ends on the same hit points', twice.painted.hp === twice.headless.hp);
    ok('and carrying the same statuses', twice.painted.statuses === twice.headless.statuses);
    ok(`momentum and scrap land identically (${twice.painted.momentum}/${twice.painted.scrap})`,
      twice.painted.momentum === twice.headless.momentum && twice.painted.scrap === twice.headless.scrap);
    ok(`the log is still written with the painting off (${twice.headless.logLines} lines)`,
      twice.headless.logLines === twice.painted.logLines && twice.headless.logLines > 0);

    // ── And the work really is being skipped, not merely surviving it ──────────────────
    const skipped = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5; initiateCombat('RAIDERS', false);
      const field = document.querySelector('.battlefield');
      const read = () => field.style.getPropertyValue('--field-fit');
      paintOff = false; field.style.removeProperty('--field-fit'); fitField();
      const painted = read();
      paintOff = true; field.style.removeProperty('--field-fit');
      const ret = fitField();
      const headless = read();
      paintOff = false;
      return { painted, headless, ret };
    });
    ok(`with the painting on the fit pass still sizes the field (--field-fit ${skipped.painted || '(unset)'})`,
      skipped.painted !== '');
    ok('with it off the fit pass returns 1 and never measures', skipped.headless === '' && skipped.ret === 1);
  }
};

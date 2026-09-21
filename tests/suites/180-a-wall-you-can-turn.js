// ── #230: THE ONE DIAL WITH A TARGET BEHIND IT WAS THE ONE DIAL NOBODY COULD TURN ─────
//
// SECTOR_HP_SCALE and SECTOR_DMG_SCALE are the wall. I06 cut them to 1.08 / 1.10 against a
// stated 30% win-rate target; H13 had them at 1.06 / 1.08 and before that 1.25 / 1.28; S05 turned
// them to 1.06 / 1.075 at the owner's target of about 19%. Every
// one of those re-cuts was done by editing game.js, running careers, and editing it again -
// the only tuning question in this project without a `--flag`, and the one with a number it is
// supposed to hit. They are an arm now, defaulted to the shipped values.
//
// WHY THAT MATTERS RIGHT NOW: the game has been running at roughly half its stated target since
// M03, which typed bleed as a correctness fix and measured it landing as a one-sided nerf -
// "the win rate goes from about 30% to about 16%", said at the time, in the record. Every item
// since has correctly DECLINED to compensate, because buffing something unrelated to offset one
// change is how a curve stops meaning anything. So the re-cut belongs to no item and was never
// done, and the dial needs to be turnable before anyone can decide whether to turn it.
//
// WHAT THIS SUITE IS FOR is the half that could go wrong silently: an arm that defaults to
// something other than the shipped value would move the game while claiming not to, and every
// balance figure taken after it would be measured against a wall nobody chose. So the defaults
// are asserted against the shipped pair, the setter is asserted to actually reach the
// scaling, and sector 1 is asserted NOT to move - because the scale is an exponent on
// (sector - 1) and a dial that changed the first sector would be a different dial.
// ^^ T-audit: that first clause read "the numbers I06 left" until now. S05 turned the dial to
//    1.06 / 1.075, moved the assertion below and moved the history line above with it, and not
//    this sentence - the one a reader checks to learn WHICH value the suite guards.
const { engineUp } = require('../boot');

module.exports = {
  name: 'A wall you can turn',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`); await engineUp(page);

    const shipped = await page.evaluate(() => ({ hp: SECTOR_HP_SCALE, dmg: SECTOR_DMG_SCALE }));
    // S05: the owner set the target at about 19% and the dial moved one step down #230's curve.
    // The ratio is the part worth pinning rather than the pair: I06 cut damage in 1.25x the
    // health increment and that is what keeps this one dial instead of two numbers chosen apart.
    ok(`the wall ships where the owner set it (hp ${shipped.hp}, dmg ${shipped.dmg})`,
      shipped.hp === 1.06 && shipped.dmg === 1.075);
    ok('damage still moves in I06\'s 1.25x ratio on the increment',
      Math.abs((shipped.dmg - 1) / (shipped.hp - 1) - 1.25) < 1e-9);

    // ── The dial reaches the scaling, and only where it should ───────────────────────────
    const reach = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const at = s => { currentSector = s; currentTier = 5; return { hp: fightMult(), dmg: fightDmgMult() }; };
      const before = { s1: at(1), s4: at(4), s7: at(7) };
      // S05: the shipped pair is READ and put back, not restored to a literal. The first cut
      // wrote 1.08 / 1.10 in three places, so turning the dial broke this suite in two ways that
      // had nothing to do with what it tests - and a restore-to-literal silently leaves the
      // engine on the OLD value for every suite that runs after it.
      const was = { hp: SECTOR_HP_SCALE, dmg: SECTOR_DMG_SCALE };
      SECTOR_HP_SCALE = 1.02; SECTOR_DMG_SCALE = 1.03;
      const after = { s1: at(1), s4: at(4), s7: at(7) };
      SECTOR_HP_SCALE = was.hp; SECTOR_DMG_SCALE = was.dmg;
      const restored = { s7: at(7) };
      return { before, after, restored };
    });
    ok('sector one does not move - the scale is an exponent on (sector - 1)',
      reach.after.s1.hp === reach.before.s1.hp && reach.after.s1.dmg === reach.before.s1.dmg);
    ok(`cutting the scale cuts health at depth (s7 ${reach.before.s7.hp.toFixed(2)} -> ${reach.after.s7.hp.toFixed(2)})`,
      reach.after.s7.hp < reach.before.s7.hp);
    ok(`and damage at depth (s7 ${reach.before.s7.dmg.toFixed(2)} -> ${reach.after.s7.dmg.toFixed(2)})`,
      reach.after.s7.dmg < reach.before.s7.dmg);
    ok('and it bites harder the deeper it goes, which is what a depth curve is',
      (reach.before.s7.hp - reach.after.s7.hp) > (reach.before.s4.hp - reach.after.s4.hp));
    ok('putting it back puts the curve back exactly',
      reach.restored.s7.hp === reach.before.s7.hp);

    // ── The arm's default is the shipped value, asserted at the harness ──────────────────
    // THE FAILURE THIS CATCHES is an arm that quietly re-tunes the game: a default of anything
    // but "" would write a number over the shipped constant on every run, and every figure taken
    // afterwards would be measured against a wall nobody chose. Read off simulate.js rather than
    // trusted, because the whole point of the flag is that it is easy to change.
    const sim = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'simulate.js'), 'utf8');
    ok("--wallhp defaults to empty, meaning 'leave the shipped value alone'",
      /flag\('wallhp', ''\)/.test(sim));
    ok('--walldmg does too', /flag\('walldmg', ''\)/.test(sim));
    ok('and both are only written when the flag is non-empty',
      /if \(wallHp\) SECTOR_HP_SCALE = Number\(wallHp\);/.test(sim) &&
      /if \(wallDmg\) SECTOR_DMG_SCALE = Number\(wallDmg\);/.test(sim));

    // ── The engine is the only copy ──────────────────────────────────────────────────────
    // F03: a report or a suite holding its own copy of the wall is one edit from quoting a
    // number the game does not use. The accessor is the single definition - it was briefly BOTH
    // a plain export and an accessor on the same object literal, which JavaScript permits and
    // which leaves two spellings of one constant for a reader to pick between.
    const once = await page.evaluate(() => {
      const d = Object.getOwnPropertyDescriptor(WP, 'SECTOR_HP_SCALE');
      return { hasGet: typeof d.get === 'function', hasSet: typeof d.set === 'function',
               notPlain: d.value === undefined };
    });
    ok('the wall is exposed as one accessor, not a value and an accessor both',
      once.hasGet && once.hasSet && once.notPlain);
    const writeThrough = await page.evaluate(() => {
      const was = SECTOR_HP_SCALE;
      WP.SECTOR_HP_SCALE = 1.11;
      const seen = SECTOR_HP_SCALE;
      WP.SECTOR_HP_SCALE = was;
      return { seen, back: SECTOR_HP_SCALE, was };
    });
    ok('and writing through it reaches the engine, which is what an arm needs',
      writeThrough.seen === 1.11 && writeThrough.back === writeThrough.was);
  }
};

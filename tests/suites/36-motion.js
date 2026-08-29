// Fights resolved as simultaneous spreadsheet updates. Now melee lunges to contact, ranged
// flashes and draws a tracer, the struck recoil, the dead fall once and stay fallen, and an
// enemy's intent pulses through the beat before it acts - all transforms, no new art, and
// every effect stilled behind prefers-reduced-motion.
module.exports = {
  name: 'Combat that moves',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the framework is wired where the blows land ----
    const wired = await page.evaluate(async () => {
      const js = await (await fetch('game.js')).text();
      const css = await (await fetch('styles.css')).text();
      return {
        anims: (js.match(/playAttackAnim\(/g) || []).length,
        pulse: /pulseIntent\(aE\)/.test(js),
        recoil: /anim-recoil-left/.test(js) && /anim-recoil-right/.test(js),
        keyframes: ['lungeRight', 'lungeLeft', 'recoilLeft', 'recoilRight', 'muzzle', 'tracer', 'intentPulse', 'deathFall']
          .every(k => css.includes(`@keyframes ${k}`)),
        reduced: /prefers-reduced-motion/.test(css) &&
          ['anim-lunge-right', 'muzzle-flash', 'tracer-line', 'intent-pulse'].every(c =>
            css.slice(css.indexOf('prefers-reduced-motion')).includes(c))
      };
    });
    ok('the swing animates from both sides of the field', wired.anims >= 3);
    ok('the intent pulses through the pre-swing beat', wired.pulse);
    ok('the struck recoil away from the blow', wired.recoil);
    ok('every keyframe is declared', wired.keyframes);
    ok('and every one is stilled for reduced motion', wired.reduced);

    // ---- a staged fight to move in ----
    const stage = () => page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const hero = playerRoster.find(p => p.gridPos > 0);
      hero.quirk = null; hero.weaponMod = null; hero.trinket = null; hero.traits = [];
      const foes = activeEntities.filter(e => !e.isPlayer);
      renderField();
      return { heroId: hero.id, foeIds: foes.map(f => f.id) };
    });

    const f1 = await stage();
    const swing = await page.evaluate(({ heroId, foeIds }) => {
      const hero = playerRoster.find(p => p.id === heroId);
      const foe = activeEntities.find(e => e.id === foeIds[0]);
      const melee = playAttackAnim(hero, foe, 'SCRAP_BLADE');
      const meleeClass = document.getElementById(heroId).className.includes('anim-lunge-right');
      const ranged = playAttackAnim(hero, foe, 'QUICK_SHOT');
      return {
        melee, meleeClass, ranged,
        flash: !!document.querySelector('.muzzle-flash'),
        tracer: !!document.querySelector('.battlefield .tracer-line'),
        tracerSized: (document.querySelector('.tracer-line') || {}).style ?
          parseFloat(document.querySelector('.tracer-line').style.width) > 20 : false
      };
    }, f1);
    ok('melee lunges toward its target', swing.melee === 'lunge' && swing.meleeClass);
    ok('ranged flashes at the muzzle and draws a tracer', swing.ranged === 'tracer' && swing.flash && swing.tracer);
    ok('the tracer actually spans the field', swing.tracerSized);

    const struck = await page.evaluate(({ heroId, foeIds }) => {
      const hero = playerRoster.find(p => p.id === heroId);
      const foe = activeEntities.find(e => e.id === foeIds[0]);
      foe.maxHp = 100000; foe.hp = 100000; foe.resistances = { phys: 0, bio: 0, energy: 0 }; foe.armor = 0;
      applyDamageHit(hero, foe, 50, 'phys', 'CLAW');
      const foeRecoils = document.getElementById(foe.id).className.includes('anim-recoil-right');
      hero.maxHp = 1000; hero.hp = 1000;
      applyDamageHit(foe, hero, 30, 'phys', 'CLAW');
      const heroRecoils = document.getElementById(heroId).className.includes('anim-recoil-left');
      return { foeRecoils, heroRecoils };
    }, f1);
    ok('a struck enemy recoils away', struck.foeRecoils);
    ok('a struck operator recoils the other way', struck.heroRecoils);

    // ---- the dead fall once and stay fallen ----
    const death = await page.evaluate(({ foeIds }) => {
      const foe = activeEntities.find(e => e.id === foeIds[0]);
      foe.hp = 0;
      renderField();
      const first = document.getElementById(foe.id).className;
      renderField();
      const second = document.getElementById(foe.id).className;
      const stillThere = !!document.getElementById(foe.id).querySelector('.portrait');
      return { first, second, stillThere };
    }, f1);
    ok('the first render after death plays the fall', /dead/.test(death.first) && /dying/.test(death.first));
    ok('every render after holds the settled corpse', /settled/.test(death.second) && !/dying/.test(death.second));
    ok('the body stays on the field instead of vanishing', death.stillThere);

    const reentry = await page.evaluate(() => {
      const dead = playerRoster.find(p => p.gridPos > 0);
      dead.hp = 0;
      initiateCombat('RAIDERS', false);
      const el = document.getElementById(dead.id);
      return { settled: el ? el.className.includes('settled') && !el.className.includes('dying') : true };
    });
    ok('a squadmate already down does not re-die at the next fight', reentry.settled);

    // ---- the intent pulse ----
    const pulse = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.intent = rollIntent(foe);
      renderField();
      pulseIntent(foe);
      return document.getElementById(foe.id).querySelector('.intent-icon').className.includes('intent-pulse');
    });
    ok("the enemy's intent pulses before it acts", pulse);

    // ---- reduced motion stills all of it ----
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const stilled = await page.evaluate(({ heroId, foeIds }) => {
      combatActive = false;
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      renderField();
      const hero = playerRoster.find(p => p.gridPos > 0);
      const foe = activeEntities.find(e => !e.isPlayer);
      document.querySelectorAll('.tracer-line, .muzzle-flash').forEach(n => n.remove());
      const result = playAttackAnim(hero, foe, 'QUICK_SHOT');
      const noTracer = !document.querySelector('.tracer-line');
      foe.hp = 0; renderField();
      const corpse = document.getElementById(foe.id).querySelector('.portrait');
      const anim = getComputedStyle(corpse).animationName;
      const pose = getComputedStyle(corpse).transform;
      return { result, noTracer, anim, posed: pose !== 'none' };
    }, f1);
    await page.emulateMedia({ reducedMotion: null });
    ok('reduced motion refuses the theatrics', stilled.result === 'still' && stilled.noTracer);
    ok('yet the dead still lie settled, without the fall', stilled.anim === 'none' && stilled.posed);
  }
};

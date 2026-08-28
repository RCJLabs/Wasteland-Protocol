// Shakedown findings 06 and 07: the game must be operable without a pointer, and its
// screen-level effects must respect a reduced-motion preference.
module.exports = {
  name: 'Keyboard and motion',
  run: async ({ page, context, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- every control is reachable ----
    const survey = async setup => {
      await page.evaluate(setup); await page.waitForTimeout(350);
      return page.evaluate(() => {
        const vis = [...document.querySelectorAll('[data-action]')].filter(e => e.offsetParent);
        return {
          total: vis.length,
          unreachable: vis.filter(e => e.tagName !== 'BUTTON' && !(e.tabIndex >= 0))
                          .map(e => `${e.tagName.toLowerCase()}[${e.dataset.action}]`)
        };
      });
    };
    let r = await survey(() => { currentSlot = 1; confirmNewGame(1.0); scrap = 999; renderOutpost(); });
    ok(`every outpost control is focusable (${r.total})`, r.unreachable.length === 0);
    r = await survey(() => renderMap());
    ok(`every map control is focusable (${r.total})`, r.unreachable.length === 0);

    ok('the settings gear is a real button',
      await page.$eval('#btn-global-settings', e => e.tagName === 'BUTTON' && !!e.getAttribute('aria-label')));
    ok('the gear meets the 44px touch target',
      await page.$eval('#btn-global-settings', e => { const r = e.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }));

    // ---- combat targets are announced and operable ----
    // Resolving an action queues the next turn on a timer, and when that timer lands it clears
    // the pending order and re-renders - leaving no target to aim at. Standing combat down first
    // lets any queued turn fire as a no-op, so each scenario below starts from a settled field.
    const aimAt = async (move) => {
      await page.evaluate(() => { combatActive = false; });
      await page.waitForTimeout(1200);
      await page.evaluate((m) => {
        const hero = playerRoster.find(p => p.gridPos > 0);
        const foes = activeEntities.filter(e => !e.isPlayer);
        foes.forEach(e => { e.hp = e.maxHp; });
        hero.hp = hero.maxHp; hero.stunnedTurns = 0;
        activeEntities = [hero, ...foes]; turnQueue = [hero, ...foes];
        activeIndex = 0; combatActive = true; pendingAction = m; renderField();
      }, move);
      await page.waitForFunction(() => document.querySelector('.targetable-enemy') !== null, null, { timeout: 5000 });
    };

    await page.evaluate(() => { initiateCombat('RAIDERS', false); });
    await aimAt('PISTOL');
    const targets = await page.evaluate(() => {
      const t = [...document.querySelectorAll('.targetable-enemy')];
      return { count: t.length, focusable: t.every(e => e.tabIndex === 0),
               role: t.every(e => e.getAttribute('role') === 'button'),
               labelled: t.every(e => (e.getAttribute('aria-label') || '').startsWith('Target ')) };
    });
    ok('combat targets exist to aim at', targets.count > 0);
    ok('targets are focusable', targets.focusable);
    ok('targets announce themselves as buttons', targets.role && targets.labelled);

    // drive an attack entirely from the keyboard
    const before = await page.evaluate(() => activeEntities.find(e => !e.isPlayer).hp);
    await page.evaluate(() => document.querySelector('.targetable-enemy').focus());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => activeEntities.find(e => !e.isPlayer).hp);
    ok('Enter on a focused target resolves the attack', after < before);

    // Space works too, and does not scroll the page
    await aimAt('PISTOL');
    const b2 = await page.evaluate(() => activeEntities.find(e => !e.isPlayer).hp);
    await page.evaluate(() => document.querySelector('.targetable-enemy').focus());
    await page.keyboard.press(' ');
    await page.waitForTimeout(400);
    ok('Space also activates a target',
      (await page.evaluate(() => activeEntities.find(e => !e.isPlayer).hp)) < b2);

    ok('a focus indicator is defined',
      await page.evaluate(async () => (await (await fetch('styles.css')).text()).includes(':focus-visible')));

    // ---- reduced motion ----
    const motion = await context.newPage();
    await motion.emulateMedia({ reducedMotion: 'reduce' });
    await motion.goto(`${base}/index.html`);
    await motion.waitForTimeout(600);
    const anim = await motion.evaluate(() => {
      const probe = (cls) => {
        const el = document.createElement('div');
        el.className = cls; document.body.appendChild(el);
        const name = getComputedStyle(el).animationName;
        el.remove(); return name;
      };
      return { shake: probe('fx-shake'), glitch: probe('fx-glitch'), fct: probe('fct') };
    });
    ok('screen shake is suppressed under reduced motion', anim.shake === 'none');
    ok('the glitch pass is suppressed', anim.glitch === 'none');
    ok('informational damage numbers still animate', anim.fct !== 'none');

    const normal = await context.newPage();
    await normal.emulateMedia({ reducedMotion: 'no-preference' });
    await normal.goto(`${base}/index.html`);
    await normal.waitForTimeout(500);
    ok('shake still plays for everyone else',
      await normal.evaluate(() => {
        const el = document.createElement('div'); el.className = 'fx-shake';
        document.body.appendChild(el);
        const n = getComputedStyle(el).animationName; el.remove(); return n !== 'none';
      }));
    await motion.close(); await normal.close();
  }
};

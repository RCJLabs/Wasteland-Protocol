// E02: P15 shipped an animation pass - floating damage numbers, hit flashes, melee lunges,
// recoils - and almost none of it had ever been seen in ordinary play.
//
// renderField replaces both team containers wholesale (`pTeam.innerHTML = pCells.join('')`).
// spawnFCT appended INTO the entity it belonged to; triggerHitFlash puts a class on the portrait
// inside that entity; flashClass puts one on the entity itself. Every action path ends in
// checkWinState, whose first statement is renderField, and all of it runs inside one synchronous
// task - so the effect was created and destroyed before the browser could paint. The 1000ms
// lifetime on a damage number never meant anything.
//
// Measured before the fix, with a MutationObserver counting .fct nodes: applyDamageHit on its
// own left 1 of 1 connected; the same hit followed by checkWinState left 0 of 1; and a real
// SCRAP_BLADE through resolveAction left 0 of 1. The tracer was the sole survivor of the whole
// pass, and only because it mounts on .battlefield instead of inside a team.
//
// The fix is that trick generalised - a layer inside .battlefield that renderField never
// rebuilds - plus carrying the entity-scoped classes across the rebuild. The helper signatures
// did not change, so the 117 spawnFCT call sites are untouched.
module.exports = {
  name: 'The hits you can see',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    const fight = () => page.evaluate(async () => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5;
      initiateCombat('RAIDERS', false);
      await new Promise(r => setTimeout(r, 250));
    });

    // ── A damage number outlives the render that follows the blow ──────────────────────
    await fight();
    const survives = await page.evaluate(async () => {
      const seen = [];
      const obs = new MutationObserver(m => m.forEach(r => r.addedNodes.forEach(n => {
        if (n.nodeType === 1 && n.classList && n.classList.contains('fct')) seen.push(n);
      })));
      obs.observe(document.body, { childList: true, subtree: true });
      const hero = activeEntities.find(e => e.isPlayer && e.hp > 0);
      const foe = activeEntities.find(e => !e.isPlayer && e.hp > 0);
      applyDamageHit(hero, foe, 12, 'phys', 'BASIC');
      checkWinState();                       // its first statement is renderField
      await Promise.resolve();
      const out = { spawned: seen.length, connected: seen.filter(n => n.isConnected).length,
                    inLayer: seen.filter(n => n.closest && n.closest('.fx-layer')).length };
      obs.disconnect();
      return out;
    });
    ok(`a damage number is spawned at all (${survives.spawned})`, survives.spawned >= 1);
    ok(`and survives the render that follows it (${survives.connected} of ${survives.spawned})`,
      survives.connected === survives.spawned);
    ok('because it is mounted on the layer rather than inside the entity', survives.inLayer === survives.spawned);

    // ── The layer is not in the way of anything ───────────────────────────────────────
    const layer = await page.evaluate(() => {
      const l = document.querySelector('.battlefield .fx-layer');
      const cs = l ? getComputedStyle(l) : null;
      return { exists: !!l, pointer: cs && cs.pointerEvents, pos: cs && cs.position,
               inField: !!(l && l.parentElement && l.parentElement.classList.contains('battlefield')) };
    });
    ok('the layer lives inside the battlefield', layer.exists && layer.inField && layer.pos === 'absolute');
    ok('and never swallows a tap meant for a sprite', layer.pointer === 'none');

    // ── An entity rebuild no longer throws the swing away ─────────────────────────────
    await fight();
    const kept = await page.evaluate(() => {
      const hero = activeEntities.find(e => e.isPlayer && e.hp > 0);
      const foe = activeEntities.find(e => !e.isPlayer && e.hp > 0);
      globalSettings.motion = 'full'; applyTextScale();   // the helpers no-op under reduced motion
      flashClass(hero.id, 'anim-lunge-right', 430);
      triggerHitFlash(foe.id);
      const before = {
        lunge: !!document.getElementById(hero.id).classList.contains('anim-lunge-right'),
        flash: !!document.getElementById(foe.id).querySelector('.portrait.fx-flash'),
      };
      renderField();
      const after = {
        lunge: !!document.getElementById(hero.id).classList.contains('anim-lunge-right'),
        flash: !!document.getElementById(foe.id).querySelector('.portrait.fx-flash'),
      };
      globalSettings.motion = 'auto'; applyTextScale();
      return { before, after };
    });
    ok('a lunge and a hit flash are applied in the first place',
      kept.before.lunge && kept.before.flash);
    ok('and both are still there after the containers are rebuilt',
      kept.after.lunge && kept.after.flash);

    // ── None of it runs for a harness that is not watching ────────────────────────────
    await fight();
    const headless = await page.evaluate(async () => {
      paintOff = true;
      const before = document.querySelectorAll('.fct').length;
      const hero = activeEntities.find(e => e.isPlayer && e.hp > 0);
      const foe = activeEntities.find(e => !e.isPlayer && e.hp > 0);
      applyDamageHit(hero, foe, 12, 'phys', 'BASIC');
      const after = document.querySelectorAll('.fct').length;
      paintOff = false;
      return { before, after };
    });
    ok(`with the painting off no floating text is built at all (${headless.before} -> ${headless.after})`,
      headless.after === headless.before);
  }
};

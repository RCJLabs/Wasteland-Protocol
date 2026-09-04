// E03: the combat screen previews a swing in three places, and each one used to work it out
// with different arithmetic than the swing itself.
//
// The soak tag probed a literal 'phys' while the ability it describes rode through beside it as
// mitigate's 5th argument. Measured against a Turret (phys 10, bio 100, energy -10) it read 82%
// for every move on the deck: correct for BASIC, and wrong for SPRAY_GUN and CAUSTIC_BURST,
// which land 0 into the immunity, and for MOLOTOV, which lands 102. So a card could show a
// percentage and a struck-through IMMUNE badge one row below it, and the badge was the honest
// one. damageTypeOf is what the resolver asks; the readouts ask it now too.
//
// The deck's REACH tag kept its own copy of the rank arithmetic and read REACH_PENALTY raw, so
// ground applied to the swing and not to the button describing it - the exact thing the
// resolver's own note says must not happen. And the FAR tag counted burrowed enemies when
// working out a target's rank, while the resolver's livingEnemies excludes them, so the tag
// could be measured against a different line than the swing would reach.
module.exports = {
  name: 'Every readout points at the same swing',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── The soak tag and the resolver now agree, whatever the move is made of ──────────
    const typed = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5;
      initiateCombat('MECH', false);                 // the bio-immune faction
      const hero = activeEntities.find(e => e.isPlayer && e.hp > 0);
      const foe = activeEntities.find(e => !e.isPlayer && e.hp > 0);
      const rows = ['SPRAY_GUN', 'MOLOTOV', 'BASIC'].map(move => {
        const type = damageTypeOf(move);
        // What the card computes, now that it asks the resolver's question...
        const shown = Math.round(mitigate(hero, foe, 100, type, move).n);
        // ...against what the old literal produced, and what the swing really does.
        const legacy = Math.round(mitigate(hero, foe, 100, 'phys', move).n);
        return { move, type, shown, legacy };
      });
      return { res: foe.resistances, rows };
    });
    const bio = typed.rows.find(r => r.type === 'bio');
    const energy = typed.rows.find(r => r.type === 'energy');
    const phys = typed.rows.find(r => r.type === 'phys');
    ok(`the target really is immune to bio and weak to energy (${JSON.stringify(typed.res)})`,
      typed.res.bio >= 100 && typed.res.energy < 0);
    ok(`a bio move into an immunity reads nothing through, not ${bio.legacy}% (${bio.shown}%)`,
      bio.shown === 0 && bio.legacy > 50);
    ok(`an energy move into a weakness reads over 100, not ${energy.legacy}% (${energy.shown}%)`,
      energy.shown > 100 && energy.legacy < 100);
    ok(`and a physical move is unchanged, which is the one the literal ever got right (${phys.shown}%)`,
      phys.shown === phys.legacy);

    // ── The card no longer contradicts its own badge ──────────────────────────────────
    const card = await page.evaluate(() => {
      const foe = activeEntities.find(e => !e.isPlayer && e.hp > 0);
      const hero = activeEntities.find(e => e.isPlayer && e.hp > 0);
      activeIndex = turnQueue.findIndex(e => e && e.id === hero.id);
      pendingAction = 'SPRAY_GUN';
      renderField();
      const el = document.getElementById(foe.id);
      const soak = el.querySelector('.soak-tag');
      const immune = el.querySelector('.res-immune');
      pendingAction = null;
      return { soak: soak && soak.innerText.trim(), title: soak && soak.title, immune: !!immune };
    });
    ok(`the soak tag on an immune target reads 0% (${card.soak})`, card.soak === '0%');
    ok('and its title names the type it actually probed', /bio/.test(card.title || ''));
    ok('so the number and the struck-through badge on the same card agree', card.immune);

    // ── The deck's REACH tag reads the ground, because the swing does ─────────────────
    // Read off the rendered button, not off the helper - the helper was always right, and it was
    // the deck keeping its own copy of the arithmetic that was wrong.
    const reach = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5;
      initiateCombat('RAIDERS', false);
      const hero = activeEntities.find(e => e.isPlayer && e.classType === 'BRUISER')
                || activeEntities.find(e => e.isPlayer);
      hero.gridPos = 3;                              // the back rank: REACH_PENALTY 0.6
      activeIndex = turnQueue.findIndex(e => e && e.id === hero.id);
      const at = t => {
        currentTerrain = t;
        renderCommandDeck();
        const btn = [...document.querySelectorAll('#command-deck button')]
          .find(b => /SCRAP BLADE/i.test(b.innerText));
        const tag = btn && btn.querySelector('.reach-tag');
        return tag ? tag.innerText.replace(/REACH\s*/i, '').trim() : null;
      };
      return { open: at('OPEN_ROAD'), tunnels: at('TUNNELS'), flats: at('OPEN_FLATS'),
               raw: REACH_PENALTY[3] };
    });
    ok(`swinging from the back rank on open road is the bare rank penalty (${reach.open})`,
      reach.open === `-${Math.round((1 - reach.raw) * 100)}%`);
    ok('a tunnel puts everything in arm’s reach, so the tag says nothing at all',
      reach.tunnels === null);
    ok(`open flats make the same swing worse than the rank alone (${reach.flats} against ${reach.open})`,
      reach.flats !== null && parseInt(reach.flats, 10) < parseInt(reach.open, 10));

    // ── The FAR tag counts the line the swing would actually reach ────────────────────
    const far = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 3; currentTier = 6;
      initiateCombat('RAIDERS', false);
      // Three hostiles, the front one underground. The resolver skips it; the tag used not to.
      while (activeEntities.filter(e => !e.isPlayer && e.hp > 0).length < 3) {
        const proto = JSON.parse(JSON.stringify(activeEntities.find(e => !e.isPlayer)));
        proto.id = `x${activeEntities.length}`; proto.burrowed = 0; activeEntities.push(proto);
      }
      const foes = activeEntities.filter(e => !e.isPlayer && e.hp > 0);
      const third = foes[2];
      // Read the tag off the rendered card, not off a filter re-typed in the test: the filter
      // was never the thing that was wrong, the card's copy of it was.
      const hero = activeEntities.find(e => e.isPlayer && e.hp > 0);
      activeIndex = turnQueue.findIndex(e => e && e.id === hero.id);
      const tagOn = id => {
        pendingAction = 'SCRAP_BLADE';
        renderField();
        const el = document.getElementById(id);
        const far = !!(el && el.classList.contains('out-of-reach'));
        pendingAction = null;
        return far;
      };
      foes[0].burrowed = 0;
      const buriedNone = tagOn(third.id);
      foes[0].burrowed = 1;
      const buriedFront = tagOn(third.id);
      return { buriedNone, buriedFront, frontRanks: FRONT_RANKS };
    });
    ok(`with everybody above ground the third hostile is out of reach (FRONT_RANKS ${far.frontRanks})`,
      far.buriedNone === true);
    ok('and burying the front one brings it back into reach, because the swing does not cross a hole',
      far.buriedFront === false);
  }
};

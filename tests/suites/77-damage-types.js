// A swing lands as physical, biological or energy, and which one it is decides which of the
// three resistances on the enemy card eats it. That classification lived as two inline
// .includes() checks in the middle of resolveAction, reachable from nowhere else - and the
// cost of that showed up in the balance simulator, which is under standing orders never to
// copy engine arithmetic. Unable to ask what a move lands as, it ranked the Medic's RAD_SHOT
// and her PISTOL identically (both ranged, neither on a cooldown) and a stable sort gave the
// tie to the earlier one forever. RAD_SHOT was reported as never fired in every sample the
// file has ever printed, and was filed as content nobody uses.
//
// So what this suite holds is not the lookup table - a table agrees with itself. It holds the
// two things that made the bug possible: that damageTypeOf is reachable at all, and that the
// answer it gives is the one the damage pipeline actually applies.
module.exports = {
  name: 'Damage types',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── The classification is reachable, total, and sound ────────────────────────────────
    const t = await page.evaluate(() => ({
      bio: BIO_MOVES, energy: ENERGY_MOVES,
      declared: [...new Set(Object.values(ABILITIES).flat().map(a => a.move))],
      map: Object.fromEntries([...new Set(Object.values(ABILITIES).flat().map(a => a.move))]
        .map(m => [m, damageTypeOf(m)])),
      bioMapped: BIO_MOVES.map(m => damageTypeOf(m)),
      energyMapped: ENERGY_MOVES.map(m => damageTypeOf(m)),
      pistol: damageTypeOf('PISTOL'), rad: damageTypeOf('RAD_SHOT'),
      blade: damageTypeOf('SCRAP_BLADE'), molotov: damageTypeOf('MOLOTOV'),
      unknown: damageTypeOf('NOT_A_MOVE'), nothing: damageTypeOf(undefined)
    }));

    ok('the bio list is exported, not buried inside a function', Array.isArray(t.bio) && t.bio.length > 0);
    ok('the energy list is exported too', Array.isArray(t.energy) && t.energy.length > 0);
    ok('no move sits in both lists - one that did would take whichever branch ran first',
       !t.bio.some(m => t.energy.includes(m)));
    ok(`every one of the ${t.bio.length} bio moves lands as bio`,
       t.bioMapped.length === t.bio.length && t.bioMapped.every(x => x === 'bio'));
    ok(`every one of the ${t.energy.length} energy moves lands as energy`,
       t.energyMapped.length === t.energy.length && t.energyMapped.every(x => x === 'energy'));
    ok('every declared ability lands as one of the three types the resistances cover',
       t.declared.length > 0 && t.declared.every(m => ['phys', 'bio', 'energy'].includes(t.map[m])));
    ok('a plain swing is physical', t.blade === 'phys' && t.pistol === 'phys');
    ok('a firebomb is energy', t.molotov === 'energy');
    ok('anything unclassified falls back to physical rather than to undefined',
       t.unknown === 'phys' && t.nothing === 'phys');

    // The tie that could not be broken. These two sit in the same deck, share a reach and
    // neither has a cooldown; the type is the ONLY thing separating them.
    ok('RAD_SHOT and PISTOL land as different types - the difference the ranking could not see',
       t.rad !== t.pistol);
    ok('RAD_SHOT lands as bio', t.rad === 'bio');

    // ── The pipeline applies that answer ─────────────────────────────────────────────────
    // A lookup table nothing consults would satisfy every assertion above, and so would a
    // resolveAction that went back to deciding the type inline. So the shots are fired for
    // real, through the same call the deck button makes, and each move is compared against
    // ITSELF on two different walls - one plated, one bio-hardened. That cancels whatever
    // per-move scaling either has and leaves only the question being asked: which wall stops
    // it. Resistance is a flat subtraction, so the gap should be about the size of the wall.
    await page.evaluate(() => {
      window.__wall = (kind) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null; activeRelics = [];
        initiateCombat('RAIDERS', false);
        const hero = playerRoster.find(h => h.classType === 'MEDIC');
        const foe = activeEntities.find(e => !e.isPlayer);
        hero.gridPos = 1; hero.maxHp = 9999; hero.hp = 9999; hero.dmgBase = 200;
        hero.stunnedTurns = 0; hero.quirk = null; hero.traits = []; hero.augments = [];
        Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
        foe.maxHp = 1e7; foe.hp = 1e7; foe.armor = 0; foe.baseArmor = 0; foe.plate = 0;
        foe.resistances = { phys: 0, bio: 0, energy: 0 }; foe.resistances[kind] = 40;
        foe.corrodedTurns = 0; foe.markedTurns = 0; foe.bleedingTurns = 0;
        foe.oiledTurns = 0; foe.stunnedTurns = 0; foe.venomStacks = 0; foe.quirk = null;
        activeEntities = [hero, foe]; turnQueue = [hero, foe];
        combatActive = true; pendingAction = null;
        return { hero, foe };
      };
      // The median of a run of shots, because the roll carries a few points of jitter and
      // RAD_SHOT leaves a bleed that would otherwise tick into the next reading.
      window.__volley = (kind, move, n = 25) => {
        const { foe } = window.__wall(kind);
        const hits = [];
        for (let i = 0; i < n; i++) {
          foe.hp = 1e7; foe.bleedingTurns = 0; foe.markedTurns = 0;
          activeIndex = 0; combatActive = true; pendingAction = move;
          resolveAction(foe.id);
          hits.push(1e7 - foe.hp);
        }
        return hits.sort((a, b) => a - b)[Math.floor(n / 2)];
      };
    });

    const shot = await page.evaluate(() => ({
      radOnBio:     window.__volley('bio', 'RAD_SHOT'),
      radOnPhys:    window.__volley('phys', 'RAD_SHOT'),
      pistolOnBio:  window.__volley('bio', 'PISTOL'),
      pistolOnPhys: window.__volley('phys', 'PISTOL')
    }));

    ok(`every volley landed something (${JSON.stringify(shot)})`,
       shot.radOnBio > 0 && shot.radOnPhys > 0 && shot.pistolOnBio > 0 && shot.pistolOnPhys > 0);
    ok(`a bio-hardened target stops RAD_SHOT and plate does not (${shot.radOnBio} vs ${shot.radOnPhys})`,
       shot.radOnBio < shot.radOnPhys);
    ok(`plate stops PISTOL and bio hardening does not (${shot.pistolOnPhys} vs ${shot.pistolOnBio})`,
       shot.pistolOnPhys < shot.pistolOnBio);
    ok(`the gap on RAD_SHOT is the size of the wall, not a rounding artefact (${shot.radOnPhys - shot.radOnBio})`,
       Math.abs((shot.radOnPhys - shot.radOnBio) - 40) <= 6);
    ok(`the gap on PISTOL is the size of the wall too (${shot.pistolOnBio - shot.pistolOnPhys})`,
       Math.abs((shot.pistolOnBio - shot.pistolOnPhys) - 40) <= 6);
  }
};

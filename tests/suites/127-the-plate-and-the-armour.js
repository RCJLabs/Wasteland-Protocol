// G05. RIOT PLATE is a second bar that only soaks, and it is meant to be half the unit's
// health. It was sized at generation, eleven lines before the elite affixes went on, and one
// of those affixes - ARMORED - is half again the health. So an up-armoured Juggernaut fought
// behind a plate worth a third of its bar rather than half, every single time.
//
// Not a rare interaction: measured over 300 elite rolls before the fix, 57 of the 183 plated
// units drawn were wearing ARMORED and every one of them read 0.333. The other three affixes
// leave health alone and read 0.500, which is what says this was the ordering rather than the
// arithmetic. Sized after the affixes now, from one helper the three build sites share.
module.exports = {
  name: 'The plate and the armour',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── Half the bar it actually fights on, affix or no affix ─────────────────────
    const drawn = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); currentSector = 4; currentTier = 12;
      const seen = { plain: [], armored: [], other: [] };
      for (let i = 0; i < 300; i++) {
        generateEnemies('RAIDERS', 1, true, 1, null)
          .filter(u => u.sig === 'RIOT_PLATE')
          .forEach(u => {
            const row = { right: u.plate === Math.floor(u.maxHp * RIOT_PLATE_SHARE),
                          plate: u.plate, maxHp: u.maxHp };
            const types = u.eliteTypes || [];
            (types.includes('ARMORED') ? seen.armored
              : types.length ? seen.other : seen.plain).push(row);
          });
      }
      const tally = a => ({ n: a.length, wrong: a.filter(r => !r.right).length, eg: a[0] || null });
      return { plain: tally(seen.plain), armored: tally(seen.armored), other: tally(seen.other),
               want: RIOT_PLATE_SHARE };
    });
    // Half of the bar it fights on, floored - an odd bar rounds to 0.496 and that is the rule
    // working, not the defect. So the rule is what is asserted rather than a rounded share.
    ok(`a plain plated unit carries half its bar (${drawn.plain.n} drawn, ${drawn.plain.wrong} wrong)`,
      drawn.plain.n > 10 && drawn.plain.wrong === 0);
    ok(`so does an up-armoured one (${drawn.armored.n} drawn, ${drawn.armored.wrong} wrong${drawn.armored.eg ? `, e.g. ${drawn.armored.eg.plate} of ${drawn.armored.eg.maxHp}` : ''})`,
      drawn.armored.n > 10 && drawn.armored.wrong === 0);
    ok(`and the affixes that leave health alone were never the problem (${drawn.other.n} drawn, ${drawn.other.wrong} wrong)`,
      drawn.other.n > 10 && drawn.other.wrong === 0);

    // ── ARMORED really does move the bar, so this is a live interaction ───────────
    const affix = await page.evaluate(() => {
      const armored = ELITE_AFFIXES.find(a => a.id === 'ARMORED');
      const u = { maxHp: 90, hp: 90, armor: 5, sig: 'RIOT_PLATE', resistances: {} };
      sizePlate(u);
      const before = { maxHp: u.maxHp, plate: u.plate };
      armored.apply(u, 1, 1);
      const midway = { maxHp: u.maxHp, plate: u.plate, share: +(u.plate / u.maxHp).toFixed(3),
                       right: u.plate === Math.floor(u.maxHp * RIOT_PLATE_SHARE) };
      sizePlate(u);
      const after = { maxHp: u.maxHp, plate: u.plate, share: +(u.plate / u.maxHp).toFixed(3),
                      right: u.plate === Math.floor(u.maxHp * RIOT_PLATE_SHARE) };
      const movers = ELITE_AFFIXES.filter(a => {
        const x = { maxHp: 100, hp: 100, armor: 0, resistances: {}, dmgBase: 10 };
        a.apply(x, 1, 1); return x.maxHp !== 100;
      }).map(a => a.id);
      return { before, midway, after, movers };
    });
    ok(`ARMORED is the one affix that moves health (${affix.movers.join() || 'none'})`,
      affix.movers.join() === 'ARMORED');
    ok(`sizing before it leaves a third of a bar (${affix.midway.plate} of ${affix.midway.maxHp}, ${affix.midway.share})`,
      affix.midway.share === 0.333);
    ok(`sizing after it leaves a half (${affix.after.plate} of ${affix.after.maxHp}, ${affix.after.share})`,
      affix.after.right === true && affix.midway.right === false);

    // ── The other two build sites read the same helper ────────────────────────────
    const others = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); currentSector = 1;
      // The Marshal is the commander whose escort is a plated hound. Called in by name rather
      // than waited for, so this reads the retinue path and not the rotation.
      const spec = BOSS_POOL.find(b => b.escort && b.escort.sig === 'RIOT_PLATE');
      grudgeCall = spec.id;
      const built = generateEnemies('BOSS', 1, false, 1, null);
      const hound = built.find(u => u.sig === 'RIOT_PLATE');
      // And a bare unit put together field-by-field, the way a mid-fight spawn is.
      const spawned = { maxHp: 60, hp: 60, sig: 'RIOT_PLATE', isPlayer: false };
      sizePlate(spawned);
      // And a hound put back mid-fight by a commander's grudge phase - the spawn path.
      const boss = built.find(u => u.classType === 'BOSS') || built[0];
      const wasThere = activeEntities.length;
      activeEntities = built.slice();
      reRaiseRetinue(boss, 'escort');
      const raised = activeEntities.find(u => u.id === boss.escortId);
      return { escortName: spec ? spec.escort.name : null,
               hound: hound ? { plate: hound.plate, maxHp: hound.maxHp,
                                right: hound.plate === Math.floor(hound.maxHp * RIOT_PLATE_SHARE) } : null,
               raised: raised ? { sig: raised.sig, plate: raised.plate, maxHp: raised.maxHp,
                                  right: raised.sig !== 'RIOT_PLATE'
                                    || raised.plate === Math.floor(raised.maxHp * RIOT_PLATE_SHARE) } : null,
               spawned: { plate: spawned.plate, share: spawned.plate / spawned.maxHp } };
    });
    ok(`a spawned plated unit is sized the same way (${others.spawned.plate} of 60)`,
      others.spawned.share === 0.5);
    ok(`a commander's plated escort arrives with one (${others.escortName}: ${others.hound ? `${others.hound.plate} of ${others.hound.maxHp}` : 'none built'})`,
      !!others.hound && others.hound.plate > 0 && others.hound.right === true);
    ok(`and so does the one its grudge phase puts back (${others.raised ? `${others.raised.plate} of ${others.raised.maxHp}` : 'none raised'})`,
      !!others.raised && others.raised.sig === 'RIOT_PLATE'
      && others.raised.plate > 0 && others.raised.right === true);

    // ── Sized off the bar, not off what is left of it ─────────────────────────────
    // Every build site hands it a unit at full health, so this is intent rather than a live
    // case - but the plate is half of what the unit HAS, and a wounded one re-sized off its
    // remaining health would quietly get a smaller budget for having been hit.
    const wounded = await page.evaluate(() => {
      const u = { maxHp: 200, hp: 40, sig: 'RIOT_PLATE', isPlayer: false };
      sizePlate(u);
      return { plate: u.plate, maxHp: u.maxHp, hp: u.hp };
    });
    ok(`a wounded plated unit is still sized off its bar (${wounded.plate} of ${wounded.maxHp}, at ${wounded.hp} health)`,
      wounded.plate === 100);
    ok(`and nothing that is not plated is given one`, await page.evaluate(() => {
      const u = { maxHp: 100, sig: 'FRENZY', isPlayer: false }; sizePlate(u);
      const p = { maxHp: 100, isPlayer: true, sig: 'RIOT_PLATE' }; sizePlate(p);
      return u.plate === undefined && p.plate === undefined; }));

    // ── What the plate actually is, which is why the sizing matters ───────────────
    // Not a shield in front of the health: a budget. While it has charge every blow lands for
    // half, and the plate is spent by what it softened. So its size is how LONG the halving
    // lasts - and an up-armoured Juggernaut was getting a third of a bar's worth of it on the
    // unit with the most health to protect.
    const soak = await page.evaluate(() => {
      const hit = plate => {
        currentSlot = 1; confirmNewGame(1.0); initiateCombat('RAIDERS', false);
        const foe = activeEntities.find(e => !e.isPlayer);
        foe.sig = 'RIOT_PLATE'; foe.maxHp = 400; foe.hp = 400;
        foe.armor = 0; foe.baseArmor = 0; foe.resistances = { phys: 0, bio: 0, energy: 0 };
        foe.plate = plate;
        const before = foe.hp;
        applyDamageHit(activeEntities.find(e => e.isPlayer), foe, 60, 'phys', 'TEST');
        return { took: before - foe.hp, left: foe.plate };
      };
      return { holding: hit(200), broken: hit(0) };
    });
    ok(`a blow lands for half while the plate holds (${soak.holding.took} against ${soak.broken.took})`,
      soak.holding.took > 0 && soak.broken.took > soak.holding.took
      && Math.abs(soak.holding.took * 2 - soak.broken.took) <= 1);
    ok(`and the plate is spent by exactly what it softened (200 → ${soak.holding.left})`,
      soak.holding.left === 200 - soak.holding.took);
  }
};

// J01: the sky was the one damage source in the game with no ledger. The report could say which
// sky a fight was fought under and nothing at all about what it did there, so E06's complaint
// about the two weather sites - that they hand-roll `1 + (currentTier - 1) * 0.4`, the same
// expression it removed from five spawn sites - had never been costed. Suite 97 pins that they
// still do and calls it a phase of its own. This is that phase.
//
// The expression ignores currentSector entirely and currentTier resets to openingTier() at every
// sector boundary, so weather is a sawtooth: it ramps 1.0x to 4.6x across a sector and starts
// over. Measured over 25 careers with a ledger added to the engine, that comes out as a FLAT
// 6.1-7.3 damage a turn at every depth, and as a share of the bar it lands on it decays from
// 9-10% at sector one to about 4% at sector seven - for BOTH sides, within a point of each
// other. So the divergence is real in form and mild in effect: it does not tilt the fight
// either way, and the curve was left alone.
//
// What is pinned here is the shape, so the next phase can see it without re-deriving it: the
// multiplier is a function of tier alone, it resets between sectors, and the sky damages
// whoever is standing rather than one side. Read off the engine, never recomputed here - a
// second copy of that expression in a test is the F03 defect wearing a different hat.
module.exports = {
  name: 'What the sky takes',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // A turn under a chosen sky, driven through the engine's own turn-start path, with the
    // ledger read back afterwards. Nothing here computes what the damage ought to be.
    // K08: the dummies carry `armor` and `resistances` now. The sky's tick goes through mitigate
    // since K08, so a body without them is not shaped like anything the engine puts on a field -
    // and these rows are about what the SKY does, so they are set to zero rather than to a
    // template's numbers: nothing in the way, and the tick arrives whole.
    const tick = await page.evaluate(() => {
      window.__tick = (sector, tier, weather, who) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = sector; currentTier = tier; currentWeather = weather;
        runStats = newRunStats();
        const ent = who === 'player'
          ? playerRoster.find(c => c.gridPos > 0)
          : { id: 'x1', name: 'Dummy', isPlayer: false, hp: 400, maxHp: 400, cooldowns: {},
              stunnedTurns: 0, bleedingTurns: 0, oiledTurns: 0, corrodedTurns: 0, armorTurns: 0,
              armor: 0, resistances: { phys: 0, bio: 0, energy: 0 } };
        // L07: the hostile here is hand-built with nothing in the way and the player used to be
        // whatever the muster rolled, which was harmless while the sky was a raw subtraction and
        // stopped being harmless the moment K08 sent it through mitigate. THICK_HIDE takes 3 off
        // every hit, the tier-6 chip is 6, and "at the same rate" below then read 3 against 6 in
        // whatever share of batteries drew that quirk into the line - measured at 7 of 24 by
        // tests/noise.js. The body is stripped to match the dummy: this suite is about what the
        // SKY does, and a resistance belongs to the rows that are about resistances.
        if (who === 'player') {
          ent.hp = ent.maxHp = 400;
          ent.armor = 0; ent.baseArmor = 0; ent.plate = 0;
          ent.quirk = null; ent.weaponMod = null; ent.trinket = null; ent.traits = [];
          ent.resistances = { phys: 0, bio: 0, energy: 0 };
          ent.venomStacks = 0; ent.corrodedTurns = 0; ent.oiledTurns = 0;
        }
        const before = ent.hp;
        applyTurnStartEffects(ent);
        return { took: before - ent.hp,
                 ledgerPlayer: runStats.wxTookPlayer || 0,
                 ledgerFoe: runStats.wxTookFoe || 0,
                 turns: runStats.wxTurns || 0 };
      };
      return true;
    });
    ok('the turn-start path is reachable from a test', tick === true);

    // ── The multiplier is a function of tier, and the sector is not in it ────────────
    // SMOG chips every turn with no roll, so it is the site that can be read deterministically.
    const bySector = await page.evaluate(() =>
      [1, 3, 5, 7].map(s => ({ s, took: window.__tick(s, 5, 'TOXIC_SMOG', 'foe').took })));
    const same = bySector.every(r => r.took === bySector[0].took);
    ok(`the same sky at the same tier takes the same amount at every depth (${bySector.map(r => `s${r.s} ${r.took}`).join(', ')})`,
      same);

    // ── And it climbs with the tier, then resets at the sector line ──────────────────
    const byTier = await page.evaluate(() =>
      [1, 5, 10].map(t => ({ t, took: window.__tick(2, t, 'TOXIC_SMOG', 'foe').took })));
    ok(`it climbs across a sector (t1 ${byTier[0].took} -> t10 ${byTier[2].took})`,
      byTier[2].took > byTier[0].took);
    // The sawtooth itself: the last fight of a sector is hit hardest, the first fight of the
    // next is back to the floor. Driven through crossSector rather than by setting currentTier
    // here, because what is being asserted is that THE ENGINE puts the tier back - setting it
    // by hand would only re-assert the formula the row above already covers.
    const reset = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 1; currentTier = 10; currentWeather = 'TOXIC_SMOG';
      runStats = newRunStats();
      const dummy = () => ({ id: 'x3', name: 'Dummy', isPlayer: false, hp: 400, maxHp: 400,
        cooldowns: {}, stunnedTurns: 0, bleedingTurns: 0, oiledTurns: 0, corrodedTurns: 0, armorTurns: 0,
              armor: 0, resistances: { phys: 0, bio: 0, energy: 0 } });
      let e = dummy(); applyTurnStartEffects(e);
      const deep = 400 - e.hp;
      const tierBefore = currentTier, sectorBefore = currentSector;
      crossSector();
      currentWeather = 'TOXIC_SMOG';            // the crossing rolls a new sky; the test picks one
      e = dummy(); applyTurnStartEffects(e);
      return { deep, next: 400 - e.hp, tierBefore, sectorBefore,
               tierAfter: currentTier, sectorAfter: currentSector };
    });
    ok(`crossing a sector puts the tier back (s${reset.sectorBefore} t${reset.tierBefore} -> s${reset.sectorAfter} t${reset.tierAfter})`,
      reset.sectorAfter === reset.sectorBefore + 1 && reset.tierAfter < reset.tierBefore);
    ok(`so the sky starts over with it (took ${reset.deep} at the sector's end, ${reset.next} at the next one's start)`,
      reset.next < reset.deep);

    // ── The sky hits whoever is standing ─────────────────────────────────────────────
    const sides = await page.evaluate(() => ({
      foe: window.__tick(3, 6, 'TOXIC_SMOG', 'foe'),
      pc: window.__tick(3, 6, 'TOXIC_SMOG', 'player') }));
    ok(`a hostile takes it (${sides.foe.took})`, sides.foe.took > 0);
    ok(`and so does the squad, at the same rate (${sides.pc.took})`,
      sides.pc.took > 0 && sides.pc.took === sides.foe.took);

    // ── The ledger records what landed, on the right side ───────────────────────────
    ok(`the ledger books a hostile tick against the hostile column (${sides.foe.ledgerFoe} foe, ${sides.foe.ledgerPlayer} squad)`,
      sides.foe.ledgerFoe === sides.foe.took && sides.foe.ledgerPlayer === 0);
    ok(`and a squad tick against the squad column (${sides.pc.ledgerPlayer} squad, ${sides.pc.ledgerFoe} foe)`,
      sides.pc.ledgerPlayer === sides.pc.took && sides.pc.ledgerFoe === 0);
    ok(`and counts the turn the weather was up (${sides.pc.turns})`, sides.pc.turns === 1);

    // What the ledger exists to prevent is a phase measuring the sky by re-deriving its
    // formula. So it has to book what LANDED, not what was rolled: a tick bigger than the
    // remaining bar takes the bar, and the books say so.
    // The roll is taken from the engine by ticking a body that can absorb all of it, so the
    // sliver below can be compared against it without this file ever computing the formula.
    // One health was the wrong sliver to use: at hp 1 what LANDED and what the bar HELD are
    // both 1, so a ledger booking either reads the same and a mutant that books the roll
    // survived. Three against a roll of nine separates all three numbers.
    const lethal = await page.evaluate(() => {
      const at = hp => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 4; currentTier = 10; currentWeather = 'TOXIC_SMOG';
        runStats = newRunStats();
        const ent = { id: 'x2', name: 'Sliver', isPlayer: false, hp, maxHp: 300, cooldowns: {},
                      stunnedTurns: 0, bleedingTurns: 0, oiledTurns: 0, corrodedTurns: 0, armorTurns: 0,
              armor: 0, resistances: { phys: 0, bio: 0, energy: 0 } };
        applyTurnStartEffects(ent);
        return { hp: ent.hp, booked: runStats.wxTookFoe || 0 };
      };
      const full = at(300);
      return { roll: full.booked, sliver: at(3) };
    });
    ok(`the roll at this depth is bigger than the sliver it is about to hit (${lethal.roll} against 3)`,
      lethal.roll > 3);
    ok(`a tick into three remaining health books three, not the ${lethal.roll} it rolled (${lethal.sliver.booked} booked, left at ${lethal.sliver.hp})`,
      lethal.sliver.hp === 0 && lethal.sliver.booked === 3);

    // ── A clear sky books nothing at all ────────────────────────────────────────────
    const clear = await page.evaluate(() => window.__tick(3, 6, 'CLEAR', 'foe'));
    ok(`a clear sky takes nothing and books no turn (${clear.took} taken, ${clear.turns} turns)`,
      clear.took === 0 && clear.turns === 0);

    // ── K08: the sky is damage of a type, and the ledger can see it ───────────────
    // It used to be `ent.hp = Math.max(0, ent.hp - dmg)`. The banner said "passive Bio DMG",
    // the description said everything in it was being poisoned, and nothing in the game could
    // answer it - not a Gas Mask, not the Hazmat's baked 25, not three Rebreathers stacking a
    // body past a hundred. K02's damage-type ledger could not see it either, so every "13% of
    // blows aimed at the squad are bio" figure this repo quoted excluded the largest bio source
    // in it. Read off the engine: the type comes from the WEATHER table, the arithmetic from
    // mitigate, and the ledger from runStats.
    const typed = await page.evaluate(() => {
      const under = (weather, bio, armor) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 4; currentTier = 8; currentWeather = weather;
        runStats = newRunStats();
        const ent = { id: 'k8', name: 'Lungs', isPlayer: true, hp: 400, maxHp: 400, cooldowns: {},
                      gridPos: 2, armor: armor || 0,
                      stunnedTurns: 0, bleedingTurns: 0, oiledTurns: 0, corrodedTurns: 0, armorTurns: 0,
                      resistances: { phys: 0, bio: bio || 0, energy: 0 } };
        applyTurnStartEffects(ent);
        const bag = (runStats.dt && runStats.dt.atSquad) || {};
        // Flattened rather than handed back raw: a regression that stops booking the tick at all
        // should make these rows go RED, not make the suite throw on a missing key and take the
        // rest of the file down with it.
        const row = bag[Object.keys(bag)[0]] || {};
        return { took: 400 - ent.hp, types: Object.keys(bag),
                 hits: row.hits || 0, raw: row.raw || 0, immune: row.immune || 0 };
      };
      return { bare: under('TOXIC_SMOG', 0), masked: under('TOXIC_SMOG', 10),
               sealed: under('TOXIC_SMOG', 100), clear: under('CLEAR', 0),
               declared: { smog: WEATHER.TOXIC_SMOG.chipType,
                           shrap: WEATHER.SHRAPNEL_WINDS.shrapnel.type } };
    });
    ok(`the smog is declared on the weather table, not at the call site (${typed.declared.smog} / ${typed.declared.shrap})`,
      typed.declared.smog === 'bio' && typed.declared.shrap === 'phys');
    ok(`and a turn under it books a ${typed.declared.smog} blow in the damage-type ledger (${typed.bare.types.join(', ') || 'nothing'})`,
      typed.bare.types.join() === 'bio' && typed.bare.hits === 1 && typed.bare.raw > 0);
    ok(`a bio resist takes it off the sky (${typed.bare.took} bare, ${typed.masked.took} with +10)`,
      typed.masked.took < typed.bare.took && typed.masked.took >= 1);
    ok(`and an immunity stops it dead, still booked as met (${typed.sealed.took} taken, ${typed.sealed.immune} immune)`,
      typed.sealed.took === 0 && typed.sealed.immune === 1);
    ok('a clear sky books nothing at all', typed.clear.types.length === 0 && typed.clear.took === 0);
  }
};

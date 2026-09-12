// Shakedown findings 03, 04 and 05: perk points must stay spendable, the endless curve must
// not terminate in an unwinnable slog, and resistances must be visible before committing.
module.exports = {
  name: 'Perks, curve and resistances',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ---- 03: perks are repeatable ----
    const perks = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster[0];
      c.perkPoints = 3; c.traits = []; renderOutpost();
      const offeredAtStart = !!document.querySelector(`[data-action="perk-menu"][data-id="${c.id}"]`);
      assignPerk(c.id, 'VETERAN');
      const offeredAfterFirst = !!document.querySelector(`[data-action="perk-menu"][data-id="${c.id}"]`);
      assignPerk(c.id, 'VETERAN');
      assignPerk(c.id, 'FORTIFIED');
      const exhausted = !!document.querySelector(`[data-action="perk-menu"][data-id="${c.id}"]`);
      return { offeredAtStart, offeredAfterFirst, exhausted,
               traits: c.traits.slice(), points: c.perkPoints, summary: traitSummary(c) };
    });
    ok('the perk button appears with points banked', perks.offeredAtStart);
    ok('it is still offered after spending one', perks.offeredAfterFirst);
    ok('it disappears only when points run out', !perks.exhausted && perks.points === 0);
    ok('the same perk can be taken more than once', perks.traits.filter(t => t === 'VETERAN').length === 2);
    ok('the tally reads back compactly', /VETERAN x2/.test(perks.summary) && /FORTIFIED/.test(perks.summary));

    // M04: a stat card no longer writes the sheet. It banks a stack that is read live, and only
    // where its condition holds - so dmgBase and maxHp, which these rows used to watch, are
    // exactly the two numbers that stopped moving. What has to hold instead is that the stacks
    // accumulate and that the payoff still compounds the way the old percentages did.
    const stacking = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster[0];
      c.perkPoints = 10; c.traits = []; c.perkStacks = {}; c.rankPerked = { hp: 0, spd: 0 };
      assignSlot(c.id, 1);
      const dmg0 = c.dmgBase, hp0 = c.maxHp;
      for (let i = 0; i < 5; i++) assignPerk(c.id, 'HONED');
      for (let i = 0; i < 5; i++) assignPerk(c.id, 'HARDENED');
      return { dmg0, dmgAfter: c.dmgBase, hp0, hpAfter: c.maxHp,
               honed: perkStacks(c, 'HONED'), hardened: perkStacks(c, 'HARDENED'),
               mult: perkDmgMult(c, 'ranged'),
               expectedMult: Math.pow(PERK_DMG_MULT, 5),
               expectedHp: Math.pow(1 + PERK_MAXHP, 5) };
    });
    ok(`the damage card pays on the swing, not on the sheet (${stacking.dmg0} DMG, unmoved)`,
      stacking.dmgAfter === stacking.dmg0);
    ok(`five picks bank five stacks (HONED x${stacking.honed}, HARDENED x${stacking.hardened})`,
      stacking.honed === 5 && stacking.hardened === 5);
    ok(`percentage perks still compound (x${stacking.mult.toFixed(2)} on a ranged verb)`,
      Math.abs(stacking.mult - stacking.expectedMult) < 1e-9 && stacking.mult > 1.7);
    ok(`health perks compound too, held in the front rank (${stacking.hp0} -> ${stacking.hpAfter} HP)`,
      Math.abs(stacking.hpAfter / stacking.hp0 - stacking.expectedHp) < 0.02);

    const migrated = await page.evaluate(() => {
      const roster = [{ id: 'x', trait: 'VETERAN', perkPoints: 1 }, { id: 'y', trait: null }];
      const out = migrateTraits(roster);
      return { first: out[0].traits, second: out[1].traits, stripped: !('trait' in out[0]) };
    });
    ok('an old single-trait save migrates into the list', migrated.first.join() === 'VETERAN' && migrated.second.length === 0);
    ok('the legacy field is removed', migrated.stripped);

    // ---- 04: the curve no longer ends in an unwinnable slog ----
    const curve = await page.evaluate(() => {
      const rows = [];
      for (let s = 1; s <= 10; s++) {
        currentSector = s; currentTier = 10;
        const hp = (1 + 9 * TIER_HP_GROWTH) * Math.pow(SECTOR_HP_SCALE, s - 1);
        const dm = (1 + 9 * TIER_DMG_GROWTH) * Math.pow(SECTOR_DMG_SCALE, s - 1);
        rows.push({ s, bossHp: Math.floor(300 * hp), bossHit: Math.floor(40 * dm) });
      }
      return { rows, hpScale: SECTOR_HP_SCALE, dmgScale: SECTOR_DMG_SCALE, xpCurve: XP_CURVE };
    });
    ok('enemy damage no longer tracks enemy health', curve.dmgScale !== curve.hpScale);
    ok('lethality outpaces bulk, so a run ends by dying', curve.dmgScale > curve.hpScale);
    // a squad growing at a realistic ~1.21x per sector should keep fights bounded
    const growth = curve.rows.map((r, i) => r.bossHp / Math.pow(1.21, i));
    ok('boss health stays within reach of player damage growth',
      Math.max(...growth) / Math.min(...growth) < 3.5);
    ok('the xp curve was eased so levels keep arriving', curve.xpCurve < 1.5);

    const dmgSplit = await page.evaluate(() => {
      currentSector = 6; currentTier = 10;
      const hpMult = 1 * (1 + 9 * TIER_HP_GROWTH) * Math.pow(SECTOR_HP_SCALE, 5);
      const dmgMult = 1 * (1 + 9 * TIER_DMG_GROWTH) * Math.pow(SECTOR_DMG_SCALE, 5);
      const squad = generateEnemies('RAIDERS', hpMult, false, dmgMult);
      return { hpMult, dmgMult, maxHp: Math.max(...squad.map(e => e.maxHp)), maxDmg: Math.max(...squad.map(e => e.dmgBase)) };
    });
    ok('generateEnemies applies the two multipliers separately',
      dmgSplit.maxHp > 0 && dmgSplit.maxDmg > 0 && dmgSplit.hpMult !== dmgSplit.dmgMult);

    // Heavies used to jump from weight 1 to weight 5 the moment tier 6 arrived, and the
    // simulator showed a sector's deaths clustering exactly there. They ramp in now.
    // Sampled by effTier off HEAVY_RAMP's own bands rather than fixed sector-1 tiers: raising
    // the heavy gates to clear sector 1 once left this test measuring a stretch of the curve
    // where no heavy existed, so the ramp read as flat because the pool was empty.
    const ramp = await page.evaluate(() => {
      const shareAt = (eff) => {
        const d = unlockDepth(eff);
        currentSector = d.sector; currentTier = d.tier;
        let heavy = 0, total = 0;
        for (let i = 0; i < 300; i++) {
          generateEnemies('BEASTS', 1, false, 1).forEach(e => { total++; if (e.isHeavy) heavy++; });
        }
        return { share: heavy / total, at: `S${d.sector} T${d.tier}` };
      };
      const shallowest = Math.min(...ENEMY_POOL.BEASTS.filter(e => e.isHeavy).map(e => e.minTier));
      return { gate: shallowest, bands: HEAVY_RAMP,
               early: shareAt(HEAVY_RAMP.rare - 1),
               mid: shareAt(HEAVY_RAMP.common - 1),
               late: shareAt(HEAVY_RAMP.common + 1) };
    });
    ok(`the ramp has somewhere to act (shallowest heavy gates at ${ramp.gate}, rare band ends at ${ramp.bands.rare})`,
      ramp.gate < ramp.bands.rare);
    ok(`heavies are rare where they first appear (${ramp.early.at}, ${(ramp.early.share * 100).toFixed(0)}%)`,
      ramp.early.share > 0 && ramp.early.share < 0.25);
    ok(`common a band later (${ramp.mid.at}, ${(ramp.mid.share * 100).toFixed(0)}%)`,
      ramp.mid.share > ramp.early.share);
    ok(`and usual past the last band (${ramp.late.at}, ${(ramp.late.share * 100).toFixed(0)}%)`,
      ramp.late.share > ramp.mid.share);

    // ---- 05: resistances are visible on the unit ----
    await page.evaluate(() => { currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 2; currentTier = 6; initiateCombat('MECH', false); });
    await page.waitForTimeout(600);
    const badges = await page.evaluate(() => ({
      rows: document.querySelectorAll('.res-row').length,
      immune: document.querySelectorAll('.res-immune').length,
      weak: document.querySelectorAll('.res-weak').length,
      onPlayers: [...document.querySelectorAll('#player-team .res-row')].length,
      // K04: who on the line has anything to say, read off their own resistances, so the row
      // below compares the badges drawn against the bodies that should be drawing them rather
      // than against a count somebody wrote down.
      shouldShow: playerRoster.filter(c => c.gridPos > 0 && c.hp > 0
        && DMG_TYPES.some(([t]) => (c.resistances[t] || 0) > 5 || (c.resistances[t] || 0) < 0)).length,
      titled: [...document.querySelectorAll('.res')].every(e => e.title.length > 0)
    }));
    ok('enemies show resistance badges', badges.rows > 0);
    ok('bio-immune mechs are marked immune', badges.immune > 0);
    ok('their energy weakness is marked', badges.weak > 0);
    // K04: this used to read `onPlayers === 0`, and that was the rule until K02 gave six of the
    // rank and file a damage type. While everything swung physical, a badge on the squad said
    // nothing worth the row it cost; now a quarter of what lands on the line is energy and an
    // eighth is bio, so the squad carries the same marks the hostiles do - and exactly the
    // operators whose own line has something to say.
    ok(`the squad carries them too, and only where there is something to carry (${badges.onPlayers} of ${badges.shouldShow})`,
      badges.onPlayers === badges.shouldShow);
    ok('each badge carries a readable tooltip', badges.titled);

    const hidden = await page.evaluate(() => {
      activeEntities.filter(e => !e.isPlayer).forEach(e => e.hp = 0);
      renderField();
      return document.querySelectorAll('#enemy-team .res-row').length;
    });
    ok('badges disappear once a unit is dead', hidden === 0);
  }
};

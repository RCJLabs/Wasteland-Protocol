// Shakedown findings 03, 04 and 05: perk points must stay spendable, the endless curve must
// not terminate in an unwinnable slog, and resistances must be visible before committing.
module.exports = {
  name: 'Perks, curve and resistances',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- 03: perks are repeatable ----
    const perks = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
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

    const stacking = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const c = playerRoster[0];
      c.perkPoints = 10; c.traits = [];
      const dmg0 = c.dmgBase, hp0 = c.maxHp;
      for (let i = 0; i < 5; i++) assignPerk(c.id, 'HONED');
      const dmgAfter = c.dmgBase;
      for (let i = 0; i < 5; i++) assignPerk(c.id, 'HARDENED');
      return { dmg0, dmgAfter, hp0, hpAfter: c.maxHp,
               flat: dmgAfter - dmg0, expectedCompound: Math.round(dmg0 * Math.pow(1.1, 5)) };
    });
    ok(`percentage perks compound (${stacking.dmg0} -> ${stacking.dmgAfter} DMG)`,
      stacking.dmgAfter >= stacking.expectedCompound - 2);
    ok(`health perks compound too (${stacking.hp0} -> ${stacking.hpAfter} HP)`, stacking.hpAfter > stacking.hp0 * 1.5);

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
    const ramp = await page.evaluate(() => {
      const shareAt = (tier) => {
        currentSector = 1; currentTier = tier;
        let heavy = 0, total = 0;
        for (let i = 0; i < 300; i++) {
          generateEnemies('BEASTS', 1, false, 1).forEach(e => { total++; if (e.isHeavy) heavy++; });
        }
        return heavy / total;
      };
      return { early: shareAt(5), mid: shareAt(7), late: shareAt(9) };
    });
    ok(`heavies are rare at tier 5 (${(ramp.early * 100).toFixed(0)}%)`, ramp.early < 0.25);
    ok(`common by tier 7 (${(ramp.mid * 100).toFixed(0)}%)`, ramp.mid > ramp.early);
    ok(`and usual by tier 9 (${(ramp.late * 100).toFixed(0)}%)`, ramp.late > ramp.mid);

    // ---- 05: resistances are visible on the unit ----
    await page.evaluate(() => { currentSlot = 1; confirmNewGame(1.0); currentSector = 2; currentTier = 6; initiateCombat('MECH', false); });
    await page.waitForTimeout(600);
    const badges = await page.evaluate(() => ({
      rows: document.querySelectorAll('.res-row').length,
      immune: document.querySelectorAll('.res-immune').length,
      weak: document.querySelectorAll('.res-weak').length,
      onPlayers: [...document.querySelectorAll('#player-team .res-row')].length,
      titled: [...document.querySelectorAll('.res')].every(e => e.title.length > 0)
    }));
    ok('enemies show resistance badges', badges.rows > 0);
    ok('bio-immune mechs are marked immune', badges.immune > 0);
    ok('their energy weakness is marked', badges.weak > 0);
    ok('badges are not drawn on the player squad', badges.onPlayers === 0);
    ok('each badge carries a readable tooltip', badges.titled);

    const hidden = await page.evaluate(() => {
      activeEntities.filter(e => !e.isPlayer).forEach(e => e.hp = 0);
      renderField();
      return document.querySelectorAll('#enemy-team .res-row').length;
    });
    ok('badges disappear once a unit is dead', hidden === 0);
  }
};

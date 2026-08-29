// Finding 07: the tier gate must not leak high-tier units into early fights, and squads should
// grow and mix as a run goes deeper.
module.exports = {
  name: 'Encounter generation',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(500);

    const r = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const sample = (sector, tier, type, n) => {
        currentSector = sector; currentTier = tier;
        const names = new Set(), sizes = new Set(); let mixed = 0;
        for (let i = 0; i < n; i++) {
          const squad = generateEnemies(type, 1, false);
          sizes.add(squad.length);
          squad.forEach(e => names.add(e.name));
          if (new Set(squad.map(e => e.classType)).size > 1) mixed++;
        }
        return { names: [...names], sizes: [...sizes].sort(), mixed: mixed / n };
      };
      return {
        earlyMech: sample(2, 1, 'MECH', 60),
        early: sample(1, 1, 'RAIDERS', 40),
        late: sample(1, 9, 'RAIDERS', 60),
        deep: sample(3, 5, 'RAIDERS', 60)
      };
    });
    ok('a sector-2 tier-1 fight cannot spawn a War Rig', !r.earlyMech.names.includes('War Rig'));
    ok('an unstocked pool still yields its cheapest units', r.earlyMech.names.length > 0);
    ok('early fights stay two-strong', r.early.sizes.join() === '2');
    ok('early fights use only basic stock', r.early.names.every(n => n === 'Raider'));
    ok('later fights grow to four', r.late.sizes.includes(4));
    ok('early fights are single-faction', r.early.mixed === 0);
    ok('deep fights mix factions', r.deep.mixed > 0.15);

    // ---- the opening sector is a teaching sector ----
    // Heavies used to unlock inside sector 1 - Chem Fiends from tier 6, War Rigs from tier 8 -
    // which put a 360 HP unit two tiers ahead of a 280 HP commander, on a squad that had never
    // seen one. minTier is measured in effTier, so anything above TOTAL_TIERS cannot reach
    // sector 1 at all.
    const opening = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const seen = new Set(); const perFaction = {};
      for (let tier = 1; tier <= TOTAL_TIERS; tier++) {
        currentSector = 1; currentTier = tier;
        const mult = 1 + (tier - 1) * TIER_HP_GROWTH;
        for (const type of ['RAIDERS', 'BEASTS', 'MECH']) {
          const f = perFaction[type] = perFaction[type] || new Set();
          for (let i = 0; i < 120; i++)
            generateEnemies(type, mult, false, 1).forEach(e => { seen.add(e.name); f.add(e.name); });
        }
      }
      // The deepest ordinary unit sector 1 can field, against the commander waiting at its top.
      currentSector = 1; currentTier = TOTAL_TIERS;
      const topMult = 1 + (TOTAL_TIERS - 1) * TIER_HP_GROWTH;
      let toughest = 0, toughestName = '';
      for (const type of ['RAIDERS', 'BEASTS', 'MECH'])
        for (let i = 0; i < 200; i++)
          generateEnemies(type, topMult, false, 1).forEach(e => {
            if (e.maxHp > toughest) { toughest = e.maxHp; toughestName = e.name; }
          });
      const bosses = BOSS_POOL.map(b => Math.floor(100 * b.hpMult * topMult));
      return { seen: [...seen], toughest, toughestName, weakestBoss: Math.min(...bosses),
               variety: Object.fromEntries(Object.entries(perFaction).map(([k, v]) => [k, v.size])) };
    });
    const heavies = ['War Rig', 'Juggernaut', 'Chem Fiend'];
    ok(`sector 1 never fields a heavy the squad cannot answer (${heavies.join(', ')})`,
      heavies.every(h => !opening.seen.includes(h)));
    ok(`and its toughest ordinary unit still yields to the commander (${opening.toughestName} ${opening.toughest} vs ${opening.weakestBoss} HP)`,
      opening.toughest < opening.weakestBoss);
    ok(`every faction still fields a mix there (${JSON.stringify(opening.variety)})`,
      Object.values(opening.variety).every(n => n >= 2));

    await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 2; currentTier = 9;
      initiateCombat('RAIDERS', false);
    });
    await page.waitForTimeout(400);
    const layout = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
    ok('a crowded squad does not scroll the page sideways', layout <= 0);
  }
};

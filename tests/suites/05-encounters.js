// Finding 07: the tier gate must not leak high-tier units into early fights, and squads should
// grow and mix as a run goes deeper.
module.exports = {
  name: 'Encounter generation',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(500);

    const r = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
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

    await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); currentSector = 2; currentTier = 9;
      initiateCombat('RAIDERS', false);
    });
    await page.waitForTimeout(400);
    const layout = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
    ok('a crowded squad does not scroll the page sideways', layout <= 0);
  }
};

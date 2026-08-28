// Two things reported from real play: a BEASTS node fielded a mechanical turret, and the map
// header ran its three numbers together so 'SECTOR 1' beside '1,111 PTS' read as 'SECTOR 11,111'.
module.exports = {
  name: 'Node coherence and the stat bar',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- a node only fields units that belong there ----
    const HOME = { BEAST: 'BEASTS', MUTANT: 'BEASTS', RAIDER: 'RAIDERS', DRONE: 'MECH', MECH: 'MECH' };
    const mix = await page.evaluate((home) => {
      currentSlot = 1; confirmNewGame(1.0);
      const sample = (type, sector, tier, n) => {
        currentSector = sector; currentTier = tier;
        const foreign = [];
        for (let i = 0; i < n; i++)
          generateEnemies(type, 2, false, 2).forEach(e => {
            if (home[e.classType] !== type) foreign.push(e.name);
          });
        return [...new Set(foreign)];
      };
      return {
        beastsDeep: sample('BEASTS', 3, 10, 250),
        mechDeep: sample('MECH', 3, 10, 250),
        raidersDeep: sample('RAIDERS', 3, 10, 250),
        beastsEarly: sample('BEASTS', 1, 2, 100)
      };
    }, HOME);
    ok(`a beast node never fields machinery (${mix.beastsDeep.length} foreign)`, mix.beastsDeep.length === 0);
    ok('a mech node never fields wildlife', mix.mechDeep.length === 0);
    ok('early beast nodes are pure too', mix.beastsEarly.length === 0);
    ok(`raiders still bring salvage and war dogs (${mix.raidersDeep.length} kinds)`, mix.raidersDeep.length > 0);

    const allies = await page.evaluate(() => FACTION_ALLIES);
    ok('only raiders have allied factions',
      allies.RAIDERS.length > 0 && allies.BEASTS.length === 0 && allies.MECH.length === 0);

    // ---- the header reads at every magnitude ----
    const fmt = await page.evaluate(() => ({
      zero: formatStat(0), small: formatStat(130), thousands: formatStat(1111),
      big: formatStat(48250), huge: formatStat(125000), massive: formatStat(1240000)
    }));
    ok('small numbers stay exact', fmt.zero === '0' && fmt.small === '130');
    ok('thousands get separators', fmt.thousands === '1,111' && fmt.big === '48,250');
    ok('six figures compact to K', fmt.huge === '125K');
    ok('millions compact to M', fmt.massive === '1.2M');

    const layout = async (score, scrap, sector) => {
      await page.evaluate(([sc, sp, se]) => {
        currentSector = se; scrap = sp;
        Object.assign(runStats, { kills: 900, elites: 40, bosses: 20, scrapEarned: sc, nodes: 400, deepestSector: se, deepestTier: 10 });
        renderMap();
      }, [score, scrap, sector]);
      await page.waitForTimeout(200);
      return page.evaluate(() => {
        const vals = [...document.querySelectorAll('.stat-value')];
        const bar = document.querySelector('.stat-bar').getBoundingClientRect();
        const gear = document.getElementById('btn-global-settings').getBoundingClientRect();
        return {
          clipped: vals.filter(v => v.scrollWidth > v.clientWidth + 1).length,
          labels: [...document.querySelectorAll('.stat-label')].map(l => l.innerText.trim()),
          overlapsGear: bar.right > gear.left,
          pageScroll: document.body.scrollWidth - window.innerWidth
        };
      });
    };

    let l = await layout(1111, 130, 1);
    ok('each value is labelled', l.labels.length === 3 && /sector/i.test(l.labels[0]));
    ok('nothing is clipped at a normal score', l.clipped === 0);
    ok('the bar clears the settings gear', !l.overlapsGear);

    l = await layout(1240000, 125000, 14);
    ok('nothing is clipped at a million-point score', l.clipped === 0);
    ok('the bar still clears the gear', !l.overlapsGear);
    ok('the page never scrolls sideways', l.pageScroll <= 0);

    // narrow phone
    await page.setViewportSize({ width: 320, height: 700 });
    l = await layout(986540, 64200, 12);
    ok('it holds on a 320px screen', l.clipped === 0 && !l.overlapsGear && l.pageScroll <= 0);
    await page.setViewportSize({ width: 400, height: 800 });
  }
};

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
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
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
        // Scope to the map: the outpost has its own stat bar in the DOM at the same time.
        const vals = [...document.querySelectorAll('#screen-map .stat-value')];
        const bar = document.querySelector('#screen-map .stat-bar').getBoundingClientRect();
        const gear = document.getElementById('btn-global-settings').getBoundingClientRect();
        return {
          clipped: vals.filter(v => v.scrollWidth > v.clientWidth + 1).length,
          labels: [...document.querySelectorAll('#screen-map .stat-label')].map(l => l.innerText.trim()),
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

    // ---- the outpost header gets the same treatment ----
    const outpost = async (scrapVal, mats) => {
      await page.evaluate(([sp, m]) => {
        currentSlot = 1; scrap = sp; materials = m; renderOutpost();
      }, [scrapVal, mats]);
      await page.waitForTimeout(200);
      return page.evaluate(() => {
        const gear = document.getElementById('btn-global-settings').getBoundingClientRect();
        const title = document.querySelector('#screen-outpost .screen-title-bar').getBoundingClientRect();
        const bar = document.querySelector('#screen-outpost .stat-bar').getBoundingClientRect();
        const vals = [...document.querySelectorAll('#screen-outpost .stat-value')];
        return {
          cells: vals.length,
          labels: [...document.querySelectorAll('#screen-outpost .stat-label')].map(l => l.innerText.trim().toLowerCase()),
          values: vals.map(v => v.innerText),
          titleClearsGear: title.right <= gear.left,
          barClearsGear: bar.top >= gear.bottom - 2,
          clipped: vals.filter(v => v.scrollWidth > v.clientWidth + 1).length,
          pageScroll: document.body.scrollWidth - window.innerWidth
        };
      });
    };

    let o = await outpost(130, { parts: 7, chems: 3, tech: 12 });
    ok('the outpost header carries four labelled cells', o.cells === 4);
    ok('it shows scrap and all three materials',
      ['scrap', 'parts', 'chems', 'tech'].every(n => o.labels.includes(n)));
    ok('the values are the live totals', o.values.join(',') === '130,7,3,12');
    ok('the title no longer sits under the settings gear', o.titleClearsGear);
    ok('the stat bar clears the gear entirely', o.barClearsGear);

    o = await outpost(486300, { parts: 240, chems: 1850, tech: 99 });
    ok('outpost values compact rather than clip', o.clipped === 0 && o.values[0] === '486K');
    ok('the outpost never scrolls sideways', o.pageScroll <= 0);

    await page.setViewportSize({ width: 320, height: 700 });
    o = await outpost(99999, { parts: 120, chems: 44, tech: 7 });
    ok('the outpost header holds at 320px', o.clipped === 0 && o.pageScroll <= 0 && o.titleClearsGear);
    await page.setViewportSize({ width: 400, height: 800 });

    // materials are no longer duplicated inside the tabs
    const dup = await page.evaluate(async () => {
      const html = await (await fetch('index.html')).text();
      return { wb: /mat-parts-wb/.test(html), cb: /mat-parts-cb/.test(html) };
    });
    ok('the duplicated per-tab material readouts are gone', !dup.wb && !dup.cb);

    // and the tabs still work with those cards removed
    const tabs = await page.evaluate(() => {
      setOutpostTab('WORKBENCH');
      const wb = getComputedStyle(document.getElementById('outpost-workbench-view')).display === 'flex'
              && !!document.getElementById('btn-breakdown');
      setOutpostTab('CYBER');
      const cb = getComputedStyle(document.getElementById('outpost-cyber-view')).display === 'flex'
              && document.getElementById('cybernetics-roster').children.length === 7;
      setOutpostTab('ROSTER');
      return { wb, cb };
    });
    ok('the workbench still works without its material card', tabs.wb);
    ok('cybernetics still lists every hero', tabs.cb);
  }
};

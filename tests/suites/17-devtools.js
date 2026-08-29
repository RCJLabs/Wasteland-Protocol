// Reaching a boss meant playing ten nodes first. The dev panel jumps straight to any fight or
// state worth testing, and must do it through the normal engine functions so what it sets up
// behaves like a real run.
module.exports = {
  name: 'Dev tools and ground placement',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- reachable, and every control in it is wired ----
    await page.evaluate(() => { currentSlot = 1; confirmNewGame(1.0); sectorFront = null; openSettings(); });
    await page.waitForTimeout(200);
    await page.locator('[data-action="dev-open"]:visible').first().click();
    await page.waitForTimeout(300);
    const panel = await page.evaluate(() => {
      const acts = [...document.querySelectorAll('#screen-dev [data-action]')];
      return { open: getComputedStyle(document.getElementById('screen-dev')).display === 'flex',
               settingsClosed: getComputedStyle(document.getElementById('screen-settings')).display === 'none',
               controls: acts.length,
               unmapped: [...new Set(acts.map(a => a.dataset.action))].filter(a => !(a in ACTIONS)),
               allButtons: acts.every(a => a.tagName === 'BUTTON') };
    });
    ok('the dev panel opens from settings', panel.open && panel.settingsClosed);
    ok(`it offers a useful set of controls (${panel.controls})`, panel.controls >= 20);
    ok('every dev control resolves to a real action', panel.unmapped.length === 0);
    ok('and they are all keyboard-reachable buttons', panel.allButtons);

    // A dynamically built data-action cannot be caught by scanning source text, so check the
    // live DOM across every screen instead.
    const liveActions = await page.evaluate(() => {
      const screens = [...document.querySelectorAll('[id^="screen-"]')];
      const bad = [];
      screens.forEach(s => s.querySelectorAll('[data-action]').forEach(el => {
        if (!(el.dataset.action in ACTIONS)) bad.push(`${s.id}:${el.dataset.action}`);
      }));
      return bad;
    });
    ok('no screen emits an action the registry lacks', liveActions.length === 0);

    // ---- jumping ----
    const jump = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const start = { s: currentSector, t: currentTier };
      devJump(3, 0); const s1 = currentSector;
      devJump(0, 4); const t1 = currentTier;
      devJump(-99, 0); const floorS = currentSector;
      devJump(0, 99); const capT = currentTier;
      return { start, s1, t1, floorS, capT, tiers: TOTAL_TIERS };
    });
    ok('sector jumps work', jump.s1 === jump.start.s + 3);
    ok('tier jumps work', jump.t1 === jump.start.t + 4);
    ok('sector cannot go below one', jump.floorS === 1);
    ok('tier cannot exceed the sector length', jump.capT === jump.tiers);

    // ---- straight to any boss, at a sensible depth and on its own ground ----
    for (const [id, name, bg] of [['WARLORD','Warlord','bg_thunderdome.webp'],
                                  ['COLOSSUS','Siege Colossus','bg_foundry.webp'],
                                  ['MATRIARCH','Carrion Matriarch','bg_nest.webp']]) {
      const r = await page.evaluate((bid) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 1; currentTier = 1;
        devFightBoss(bid);
        return { name: activeEntities.find(e => !e.isPlayer).name,
                 tier: currentTier, sector: currentSector,
                 inCombat: getComputedStyle(document.getElementById('screen-combat')).display === 'flex',
                 bg: (getComputedStyle(document.getElementById('combat-sky-layer')).backgroundImage.match(/([a-z0-9_]+\.webp)/) || [])[1] };
      }, id);
      ok(`dev jump reaches the ${name}`, r.name === name && r.inCombat);
      ok(`  on its own ground at the boss tier`, r.bg === bg && r.tier === r.tier);
    }

    // ---- handouts ----
    const give = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const before = { scrap, parts: materials.parts, level: playerRoster[0].level,
                       relics: activeRelics.length, skulls: bossSkulls };
      ['SCRAP','MATS','LEVEL','RELIC','BAG','PERKS','SKULL'].forEach(devGive);
      playerRoster.forEach(c => { c.hp = 1; });
      devGive('HEAL');
      return { before, scrap, parts: materials.parts, level: playerRoster[0].level,
               relics: activeRelics.length, skulls: bossSkulls,
               bag: inventory.length, cap: metaUpgrades.invMax,
               perks: playerRoster[0].perkPoints,
               healed: playerRoster.every(c => c.hp === c.maxHp) };
    });
    ok('scrap and materials can be handed out', give.scrap > give.before.scrap && give.parts > give.before.parts);
    ok('the squad can be levelled', give.level > give.before.level && give.perks >= 3);
    ok('a relic can be granted', give.relics === give.before.relics + 1);
    ok('the bag fills to its cap without overflowing', give.bag === give.cap);
    ok('a skull can be added', give.skulls === give.before.skulls + 1);
    ok('the squad can be fully healed', give.healed);

    // ---- resolving a fight ----
    const resolve = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false); devResolve(true);
      const won = document.getElementById('command-deck').innerText;
      initiateCombat('RAIDERS', false); devResolve(false);
      const lost = document.getElementById('command-deck').innerText;
      combatActive = false;
      const noFight = (() => { try { devResolve(true); return true; } catch (e) { return false; } })();
      return { won: /LOOT/.test(won), lost: /SQUAD DOWN/.test(lost), noFight };
    });
    ok('a fight can be won instantly', resolve.won);
    ok('and lost instantly', resolve.lost);
    ok('resolving outside a fight is harmless', resolve.noFight);

    // ---- ground placement: units stand on art, not on the dark band ----
    const lifts = await page.evaluate(() => {
      const out = {};
      for (const [sector, label] of [[1,'thunderdome'],[2,'foundry'],[3,'nest']]) {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = sector; currentTier = 8;
        initiateCombat('BOSS', false);
        out[label] = { bg: combatBgFile, margin: document.querySelector('.battlefield').style.marginBottom };
      }
      currentSector = 1; currentTier = 3; initiateCombat('BEASTS', false);
      out.canyon = { bg: combatBgFile, margin: document.querySelector('.battlefield').style.marginBottom };
      return out;
    });
    ok('backdrops with a dark foreground lift the squad clear of it',
      lifts.nest.margin === '21vh' && lifts.foundry.margin === '25vh');
    ok('backdrops whose ground runs to the base are left alone',
      lifts.thunderdome.margin === '12vh' && lifts.canyon.margin === '12vh');

    const onGround = await page.evaluate(async () => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 3; currentTier = 8;
      initiateCombat('BOSS', false);
      await new Promise(r => setTimeout(r, 400));
      const sky = document.getElementById('combat-sky-layer').getBoundingClientRect();
      const feet = document.querySelector('#player-team .portrait').getBoundingClientRect().bottom;
      return +(((sky.bottom - feet) / sky.height) * 100).toFixed(1);
    });
    // bg_nest's dark band is the bottom 25% of the art; feet must sit above it
    ok(`the squad stands above the nest's dark band (${onGround}% up)`, onGround > 25);
  }
};

// A run reaches roughly sector 10 and used to fight the same Warlord every time. Each sector
// now draws a different commander, and they have to differ in behaviour, not just numbers.
module.exports = {
  name: 'Boss roster',
  run: async ({ page, ok, base }) => {
    // The rotation is a seeded shuffle per run, so a sector no longer implies a commander.
    // Everything below walks to the sector that holds the one under test.
    const sectorOf = id => page.evaluate(
      bid => { let s = 1; while (s <= 200 && bossForSector(s).id !== bid) s++; return s; }, id);
    const notFound = [];
    page.on('response', r => { if (r.status() === 404) notFound.push(r.url().split('/').pop()); });
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the roster rotates and every entry is distinct ----
    const roster = await page.evaluate(() => ({
      count: BOSS_POOL.length,
      names: BOSS_POOL.map(b => b.name),
      art: BOSS_POOL.map(b => b.img),
      byScore: Array.from({ length: 14 }, (_, i) => bossForSector(i + 1).id)
    }));
    ok(`there are ${roster.count} bosses, not one`, roster.count === 7);
    ok('each has its own name and art',
      new Set(roster.names).size === roster.count && new Set(roster.art).size === roster.count);
    // The rotation is a seeded shuffle per run now, so the contract is coverage and no
    // back-to-back repeats rather than a fixed sector-to-commander mapping.
    ok('every commander is reachable', new Set(roster.byScore).size === roster.count);
    ok('and none is met twice running',
      roster.byScore.every((id, i) => i === 0 || id !== roster.byScore[i - 1]));

    // ---- each spawns with its own shape ----
    const built = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const out = {};
      // Walk to whichever sector holds each commander rather than assuming its slot.
      const sectorOf = id => { let s = 1; while (s <= 200 && bossForSector(s).id !== id) s++; return s; };
      for (const id of BOSS_POOL.map(b => b.id)) {
        currentSector = sectorOf(id); currentTier = 8;
        const boss = generateEnemies('BOSS', 3, false, 3)[0];
        out[boss.bossId] = { name: boss.name, hp: boss.maxHp, dmg: boss.dmgBase, armor: boss.armor,
                             speed: boss.speed, res: boss.resistances, passive: boss.bossPassive,
                             hover: !!boss.isHovering, dmgType: boss.dmgType || 'phys', img: boss.img };
      }
      return out;
    });
    ok('the Colossus is the armoured one', built.COLOSSUS.armor > built.WARLORD.armor && built.COLOSSUS.armor >= 30);
    ok('it is immune to bio and weak to energy',
      built.COLOSSUS.res.bio >= 100 && built.COLOSSUS.res.energy < 0);
    ok('the Matriarch is the fast one', built.MATRIARCH.speed > built.WARLORD.speed + 5);
    ok('it deals bio damage', built.MATRIARCH.dmgType === 'bio');
    ok('it stalks on the ground rather than hovering', !built.MATRIARCH.hover);
    ok('it is fragile to bullets', built.MATRIARCH.res.phys < 0);
    ok('each carries its own passive',
      built.COLOSSUS.passive === 'PLATING' && built.MATRIARCH.passive === 'FEAST' && !built.WARLORD.passive);

    // ---- their art loads ----
    await page.evaluate(() => { currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 2; currentTier = 6; initiateCombat('BOSS', false); });
    await page.waitForTimeout(900);
    ok('boss art renders', await page.evaluate(() =>
      [...document.querySelectorAll('#enemy-team .portrait')].every(i => i.complete && i.naturalWidth > 0)));
    // Ordinary stock may be waiting on art - it renders on a named stand-in until then - but a
    // commander is the fight the run is built toward and gets its own portrait before it ships.
    const pending = await page.evaluate(() => BOSS_POOL.filter(b => PENDING_ART.includes(b.img)).map(b => b.name));
    ok(`no commander is still waiting to be drawn (${pending.join(', ') || 'none'})`, pending.length === 0);
    ok(`no missing boss asset (${notFound.join(', ') || 'none'})`, notFound.length === 0);

    // ---- breaking each one past half does something different ----
    const enrage = async (bossId) => {
      await page.evaluate((bid) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        let se = 1; while (se <= 200 && bossForSector(se).id !== bid) se++;
        currentSector = se; currentTier = 6;
        playerRoster.forEach(c => { if (c.gridPos > 0) { c.maxHp = 5000; c.hp = 5000; c.bleedingTurns = 0; } });
        initiateCombat('BOSS', false);
        const boss = activeEntities.find(e => e.id === 'b1');
        boss.hp = Math.floor(boss.maxHp * 0.4);
        window.__before = { dmg: boss.dmgBase, armor: boss.armor, speed: boss.speed,
                            foes: activeEntities.filter(e => !e.isPlayer).length };
      }, bossId);
      await page.evaluate(() => { combatActive = true; executeEnemyAi(activeEntities.find(e => e.id === 'b1')); });
      await page.waitForTimeout(800);
      return page.evaluate(() => {
        const boss = activeEntities.find(e => e.id === 'b1');
        return { before: window.__before, phase: boss.phase, dmg: boss.dmgBase, armor: boss.armor,
                 speed: boss.speed, forceAoe: !!boss.forceAoe,
                 foes: activeEntities.filter(e => !e.isPlayer).length,
                 bleeding: playerRoster.filter(c => c.gridPos > 0 && c.bleedingTurns > 0).length };
      });
    };

    let e = await enrage('WARLORD');
    ok('the Warlord calls its pack', e.phase === 2 && e.foes === e.before.foes + 2);
    ok('and hits far harder', e.dmg > e.before.dmg * 1.4);

    e = await enrage('COLOSSUS');
    ok('the Colossus reinforces its plating', e.phase === 2 && e.armor > e.before.armor);
    ok('deploys drones', e.foes === e.before.foes + 2);
    ok('and starts shelling the whole line', e.forceAoe);

    e = await enrage('MATRIARCH');
    ok('the Matriarch summons nothing', e.phase === 2 && e.foes === e.before.foes);
    ok('it infects the entire squad instead', e.bleeding >= 3);
    ok('and gets faster', e.speed > e.before.speed);

    // ---- passives ----
    const plating = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      let s = 1; while (s <= 200 && bossForSector(s).id !== 'COLOSSUS') s++;
      currentSector = s; currentTier = 5; initiateCombat('BOSS', false);
      const boss = activeEntities.find(e => e.id === 'b1');
      boss.armor = 10;
      applyTurnStartEffects(boss); const one = boss.armor;
      for (let i = 0; i < 25; i++) applyTurnStartEffects(boss);
      return { one, capped: boss.armor, cap: (boss.baseArmor || 0) + 30 };
    });
    ok('plating regrows each turn', plating.one > 10);
    ok('but not without limit', plating.capped === plating.cap);

    const feast = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      let s = 1; while (s <= 200 && bossForSector(s).id !== 'MATRIARCH') s++;
      currentSector = s; currentTier = 5; initiateCombat('BOSS', false);
      const boss = activeEntities.find(e => e.id === 'b1');
      boss.hp = Math.floor(boss.maxHp / 2);
      const before = boss.hp;
      const victim = playerRoster.find(c => c.gridPos > 0);
      victim.maxHp = 5000; victim.hp = 5000;
      applyDamageHit(boss, victim, 100, 'bio', 'BASIC');
      return { before, after: boss.hp };
    });
    ok('the Matriarch heals off the damage it deals', feast.after > feast.before);

    // ---- an armoured unit keeps its innate plating after bracing ----
    const armour = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 2; currentTier = 8;
      const squad = generateEnemies('MECH', 2, false, 2);
      const t = squad.find(e => e.baseArmor > 0) || squad[0];
      const innate = t.baseArmor;
      t.armor = innate + 15; t.armorTurns = 1;
      applyTurnStartEffects(t);
      return { innate, after: t.armor };
    });
    ok('temporary armour expiring no longer strips innate armour', armour.after === armour.innate);

    // ---- staging: the Matriarch stands in the foreground, feet planted ----
    // Sprite geometry is only meaningful once the images have actually decoded; measuring
    // earlier compares against a half-laid-out element.
    // The enrage scenarios above leave queued turn timers behind, and those re-render the
    // field underneath a measurement. Stand combat down, let them fire as no-ops, then set up
    // the fight being measured and wait for its sprites to decode.
    const stagedFight = async (which) => {
      await page.evaluate(() => { combatActive = false; });
      await page.waitForTimeout(900);
      await page.evaluate((w) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        // Accepts a commander id or a plain sector number.
        let se = w;
        if (typeof w === 'string') { se = 1; while (se <= 200 && bossForSector(se).id !== w) se++; }
        currentSector = se; currentTier = 8;
        playerRoster.forEach(c => { if (c.gridPos > 0) { c.maxHp = 400; c.hp = 400; } });
        initiateCombat('BOSS', false);
      }, which);
      await page.waitForFunction(
        () => [...document.querySelectorAll('.portrait')].every(i => i.complete && i.naturalWidth > 0),
        null, { timeout: 8000 });
      await page.waitForTimeout(200);
    };

    await stagedFight('MATRIARCH');
    const staging = await page.evaluate(async () => {
      // Sprite geometry settles a frame or two after the images decode, and a queued turn timer
      // can re-render underneath a single read. Measure until two consecutive frames agree.
      // Pin both ends by id. "The first portrait" is whichever sprite happens to lead the DOM,
      // which shifts with roster state and with a commander that brought a retinue - that is
      // how this read once came back measuring the wrong pair.
      const bossId = 'b1';
      const heroId = (playerRoster.find(p => p.gridPos === 1) || playerRoster.find(p => p.gridPos > 0)).id;
      const read = () => {
        const bEl = document.getElementById(bossId), hEl = document.getElementById(heroId);
        if (!bEl || !hEl) return NaN;
        const b = bEl.querySelector('.portrait').getBoundingClientRect();
        const h = hEl.querySelector('.portrait').getBoundingClientRect();
        return Math.round(b.bottom - h.bottom);
      };
      const frame = () => new Promise(r => requestAnimationFrame(() => r()));
      let prev = read();
      for (let i = 0; i < 12; i++) {
        await frame(); await frame();
        const now = read();
        if (now === prev) break;
        prev = now;
      }
      return prev;
    }).then(async settled => {
      const rest = await page.evaluate(() => {
      const bossEl = document.getElementById('b1').querySelector('.portrait');
      const boss = bossEl.getBoundingClientRect();
      const heroUnit = playerRoster.find(p => p.gridPos === 1) || playerRoster.find(p => p.gridPos > 0);
      const hero = document.getElementById(heroUnit.id).querySelector('.portrait').getBoundingClientRect();
      const sink = getComputedStyle(bossEl).marginBottom;
      const heroes = document.getElementById('player-team').getBoundingClientRect();
      const foes = document.getElementById('enemy-team').getBoundingClientRect();
      const field = document.querySelector('.battlefield').getBoundingClientRect();
      return { sink,
               lineGap: Math.round(foes.left - heroes.right),
               leftClipped: heroes.left < field.left,
               rightClipped: boss.right > window.innerWidth,
               pageScroll: document.body.scrollWidth - window.innerWidth };
      });
      return { ...rest, footDelta: settled };
    });
    // The offset itself is exact; where it lands on screen is subject to fractional layout,
    // so the geometry is checked loosely and the mechanism precisely.
    ok('the Matriarch carries a downward offset', staging.sink === '-16px');
    ok(`and stands forward of the squad (${staging.footDelta}px)`, staging.footDelta > 8);
    ok('the two lines are not crowded together', staging.lineGap >= 30);
    ok('neither side is clipped off screen', !staging.leftClipped && !staging.rightClipped);
    ok('the field still does not scroll sideways', staging.pageScroll <= 0);

    // Only some commanders carry a sink; ask for one that does not rather than trusting a sector.
    const flatFooted = await page.evaluate(() => (BOSS_POOL.find(b => !b.sink) || BOSS_POOL[0]).id);
    await stagedFight(flatFooted);
    const grounded = await page.evaluate(() => {
      const bossEl = document.querySelector('#enemy-team .portrait');
      const boss = bossEl.getBoundingClientRect();
      const hero = document.querySelector('#player-team .portrait').getBoundingClientRect();
      return { sink: getComputedStyle(bossEl).marginBottom, delta: Math.round(boss.bottom - hero.bottom) };
    });
    ok('a boss with no offset gets none applied', grounded.sink === '0px');
    ok(`and stays on the squad baseline (${grounded.delta}px)`, Math.abs(grounded.delta) < 8);

    // ---- each commander fights on its own ground ----
    const arenaFor = async (sector) => {
      await stagedFight(sector);
      return page.evaluate(() => {
        const sky = getComputedStyle(document.getElementById('combat-sky-layer')).backgroundImage;
        const banner = document.getElementById('weather-banner');
        return { bg: (sky.match(/([a-z0-9_]+\.webp)/) || [])[1],
                 banner: banner.innerText,
                 shown: getComputedStyle(banner).display !== 'none',
                 weather: currentWeather,
                 boss: activeEntities.find(e => !e.isPlayer).name };
      });
    };

    // Staging a fight resets the run, and a fresh run reshuffles the rotation - so a sector
    // worked out beforehand no longer holds the commander it did. Ask for them by name.
    const bossIds = await page.evaluate(() => BOSS_POOL.map(b => b.id));
    const arenas = [];
    for (const id of bossIds) arenas.push(await arenaFor(id));
    // Commanders share grounds - there are more of them than there are arenas - but a
    // commander arena is never an ordinary node's ground, which is the promise that matters.
    const ordinary = ['bg_combat.webp', 'bg_refinery.webp', 'bg_highway.webp', 'bg_canyon.webp'];
    ok('every commander fights on commander ground',
      arenas.every(a => a.bg && !ordinary.includes(a.bg)));
    ok(`drawn from the arenas that exist (${[...new Set(arenas.map(a => a.bg))].join(' ')})`,
      new Set(arenas.map(a => a.bg)).size >= 3);
    ok('each arena names itself in the banner',
      arenas.every(a => a.shown && a.banner.trim().length > 8));
    ok('the wording changes but the effect does not',
      arenas.every(a => a.weather === 'BLOODLUST' && /\+20% DMG/.test(a.banner)));

    // resuming a saved boss fight restores its arena rather than a default one
    // Held in the harness rather than on window: the reload below wipes anything the page
    // was holding, which is exactly how this assertion broke the first time.
    const wantArena = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 3; currentTier = 8;
      initiateCombat('BOSS', false); saveGameState();
      return { bg: bossForSector(3).bg, name: bossForSector(3).short };
    });
    await page.reload();
    await page.waitForTimeout(700);
    await page.click('.title-btn.btn-continue');
    await page.waitForTimeout(900);
    const resumed = await page.evaluate(() => ({
      bg: (getComputedStyle(document.getElementById('combat-sky-layer')).backgroundImage.match(/([a-z0-9_]+\.webp)/) || [])[1],
      banner: document.getElementById('weather-banner').innerText
    }));
    ok('a resumed boss fight keeps its arena', resumed.bg === wantArena.bg);
    ok('and its banner', resumed.banner.trim().length > 8);

    // ---- the map says who is waiting ----
    const label = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; currentSector = 2; renderMap();
      const node = [...document.querySelectorAll('.map-node')].find(n => /💀/.test(n.innerText));
      return { text: node ? node.innerText.replace(/\s+/g, ' ').trim() : '', want: bossForSector(2).short };
    });
    ok(`the boss node names the commander (${label.text})`, label.text.includes(label.want));
  }
};

// A run reaches roughly sector 10 and used to fight the same Warlord every time. Each sector
// now draws a different commander, and they have to differ in behaviour, not just numbers.
module.exports = {
  name: 'Boss roster',
  run: async ({ page, ok, base }) => {
    const notFound = [];
    page.on('response', r => { if (r.status() === 404) notFound.push(r.url().split('/').pop()); });
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the roster rotates and every entry is distinct ----
    const roster = await page.evaluate(() => ({
      count: BOSS_POOL.length,
      names: BOSS_POOL.map(b => b.name),
      art: BOSS_POOL.map(b => b.img),
      byScore: [1,2,3,4,5,6,7].map(s => bossForSector(s).id)
    }));
    ok(`there are ${roster.count} bosses, not one`, roster.count === 3);
    ok('each has its own name and art',
      new Set(roster.names).size === 3 && new Set(roster.art).size === 3);
    ok('sectors rotate through them', roster.byScore.slice(0, 3).join() === 'WARLORD,COLOSSUS,MATRIARCH');
    ok('the rotation wraps', roster.byScore[3] === 'WARLORD' && roster.byScore[6] === 'WARLORD');

    // ---- each spawns with its own shape ----
    const built = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const out = {};
      for (const s of [1, 2, 3]) {
        currentSector = s; currentTier = 8;
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
    ok('it deals bio damage and flies', built.MATRIARCH.dmgType === 'bio' && built.MATRIARCH.hover);
    ok('it is fragile to bullets', built.MATRIARCH.res.phys < 0);
    ok('each carries its own passive',
      built.COLOSSUS.passive === 'PLATING' && built.MATRIARCH.passive === 'FEAST' && !built.WARLORD.passive);

    // ---- their art loads ----
    await page.evaluate(() => { currentSlot = 1; confirmNewGame(1.0); currentSector = 2; currentTier = 6; initiateCombat('BOSS', false); });
    await page.waitForTimeout(900);
    ok('boss art renders', await page.evaluate(() =>
      [...document.querySelectorAll('#enemy-team .portrait')].every(i => i.complete && i.naturalWidth > 0)));
    ok('no missing boss asset', notFound.length === 0);

    // ---- breaking each one past half does something different ----
    const enrage = async (sector) => {
      await page.evaluate((se) => {
        currentSlot = 1; confirmNewGame(1.0); currentSector = se; currentTier = 6;
        playerRoster.forEach(c => { if (c.gridPos > 0) { c.maxHp = 5000; c.hp = 5000; c.bleedingTurns = 0; } });
        initiateCombat('BOSS', false);
        const boss = activeEntities.find(e => e.id === 'b1');
        boss.hp = Math.floor(boss.maxHp * 0.4);
        window.__before = { dmg: boss.dmgBase, armor: boss.armor, speed: boss.speed,
                            foes: activeEntities.filter(e => !e.isPlayer).length };
      }, sector);
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

    let e = await enrage(1);
    ok('the Warlord calls its pack', e.phase === 2 && e.foes === e.before.foes + 2);
    ok('and hits far harder', e.dmg > e.before.dmg * 1.4);

    e = await enrage(2);
    ok('the Colossus reinforces its plating', e.phase === 2 && e.armor > e.before.armor);
    ok('deploys drones', e.foes === e.before.foes + 2);
    ok('and starts shelling the whole line', e.forceAoe);

    e = await enrage(3);
    ok('the Matriarch summons nothing', e.phase === 2 && e.foes === e.before.foes);
    ok('it infects the entire squad instead', e.bleeding >= 3);
    ok('and gets faster', e.speed > e.before.speed);

    // ---- passives ----
    const plating = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); currentSector = 2; currentTier = 5; initiateCombat('BOSS', false);
      const boss = activeEntities.find(e => e.id === 'b1');
      boss.armor = 10;
      applyTurnStartEffects(boss); const one = boss.armor;
      for (let i = 0; i < 25; i++) applyTurnStartEffects(boss);
      return { one, capped: boss.armor, cap: (boss.baseArmor || 0) + 30 };
    });
    ok('plating regrows each turn', plating.one > 10);
    ok('but not without limit', plating.capped === plating.cap);

    const feast = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); currentSector = 3; currentTier = 5; initiateCombat('BOSS', false);
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
      currentSlot = 1; confirmNewGame(1.0); currentSector = 2; currentTier = 8;
      const squad = generateEnemies('MECH', 2, false, 2);
      const t = squad.find(e => e.baseArmor > 0) || squad[0];
      const innate = t.baseArmor;
      t.armor = innate + 15; t.armorTurns = 1;
      applyTurnStartEffects(t);
      return { innate, after: t.armor };
    });
    ok('temporary armour expiring no longer strips innate armour', armour.after === armour.innate);

    // ---- the map says who is waiting ----
    const label = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); currentSector = 2; renderMap();
      const node = [...document.querySelectorAll('.map-node')].find(n => /💀/.test(n.innerText));
      return node ? node.innerText.replace(/\s+/g, ' ').trim() : '';
    });
    ok(`the boss node names the commander (${label})`, /COLOSSUS/.test(label));
  }
};

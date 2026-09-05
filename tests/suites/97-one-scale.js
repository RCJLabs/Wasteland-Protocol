// E06: a commander builds its retinue twice, with two different formulas.
//
// raise() builds the opening retinue at the fight's own mult/dmgMult, and generateEnemies stashes
// those on the entity as __mult/__dmgMult with a comment naming exactly this hazard - "the
// ossuary raises units mid-fight, long after the scale factors this function was called with
// have gone out of scope". raiseFelled was its only consumer. Five other spawn sites hand-rolled
// `1 + (currentTier - 1) * 0.4` instead: the grudge's replacement escort and ward, the
// Matriarch's brood clock, the enrage summon, CALL_IT_IN and BROOD. The three commander sites
// also dropped difficultyMult, so the knob that exists to make a fight harder did not reach the
// reinforcements at all.
//
// It is not a corner case. TOTAL_TIERS is 10 and boss nodes generate at t === TOTAL_TIERS, so
// currentTier is 10 in every commander fight there has ever been and that expression is always
// exactly 4.6 - while the fight around it runs mult 2.80 at sector 1 to 10.68 at sector 7:
//
//   sector      1     2     3     4     5     6     7
//   fight mult  2.80  3.50  4.38  5.47  6.84  8.54 10.68
//   hand-rolled 4.60  4.60  4.60  4.60  4.60  4.60  4.60
//
// So a reinforcement arrived at 1.64x the health and 2.42x the damage of its own fight in sector
// one, and at 0.43x and 0.55x in sector seven. The Marshal's whole passive is about whether its
// hound is standing, and the hound it puts back was less than half the one you had just killed.
//
// And two enrage cries named a mechanic they did not have: the Marshal "CALLS THE COLUMN IN"
// and the Stormcaller "OPENS THE SKY", both carrying only dmgScale and speedBonus - the generic
// pair every other commander's enrage carries in addition to something of its own.
module.exports = {
  name: 'One scale for everything a fight spawns',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── The expression is gone from every spawn site ──────────────────────────────────
    const scan = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const lines = src.split('\n');
      const hits = [];
      lines.forEach((l, i) => {
        if (!/currentTier - 1\)\s*\*\s*0\.4/.test(l)) return;
        if (/^\s*\/\//.test(l)) return;                     // the note explaining why it went
        hits.push({ n: i + 1, weather: /wx\.chip|wx\.shrapnel/.test(l), text: l.trim().slice(0, 60) });
      });
      return { spawn: hits.filter(h => !h.weather), weather: hits.filter(h => h.weather).length };
    });
    ok(`no spawn site rolls its own curve any more (${scan.spawn.map(h => h.n).join(', ') || 'none'})`,
      scan.spawn.length === 0);
    ok(`the two weather sites still do, which is a different thing and its own phase (${scan.weather})`,
      scan.weather === 2);

    // ── A commander is only ever met at the tier that made 4.6 a constant ─────────────
    const tiers = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const seen = new Set();
      for (let i = 0; i < 40; i++) {
        const map = generateSectorMap();
        Object.values(map.nodes || map).forEach(n => { if (n && n.type === 'BOSS') seen.add(n.tier); });
      }
      return { tiers: [...seen], total: TOTAL_TIERS, hand: 1 + (TOTAL_TIERS - 1) * 0.4 };
    });
    ok(`over 40 generated maps a commander is only ever met at tier ${tiers.tiers.join('/')}`,
      tiers.tiers.length === 1 && tiers.tiers[0] === tiers.total);
    ok(`so the expression it replaced was the constant ${tiers.hand}, in every commander fight there has been`,
      Math.abs(tiers.hand - 4.6) < 1e-9);

    // ── One seam: the stash for a commander, the live curve for anything else ─────────
    const seam = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const rows = [];
      for (let s = 1; s <= FINAL_SECTOR; s++) {
        currentSector = s; currentTier = TOTAL_TIERS;
        initiateCombat('BOSS', false);
        const boss = activeEntities.find(e => e.id === 'b1');
        const sc = spawnScale(boss);
        rows.push({ s, stash: boss.__mult, got: sc.mult, dmg: sc.dmg, hand: 1 + (currentTier - 1) * 0.4 });
      }
      currentSector = 3; currentTier = 6;
      const loose = spawnScale({ name: 'a raider with no stash' });
      return { rows, loose, live: { mult: fightMult(), dmg: fightDmgMult() } };
    });
    ok('a commander hands back the factors its own fight was built with',
      seam.rows.every(r => r.got === r.stash));
    ok('and anything without a stash reads the live curve, which is the same number',
      seam.loose.mult === seam.live.mult && seam.loose.dmg === seam.live.dmg);

    // The stash is not decoration. It is there because a fight outlives the scope its factors
    // were computed in - generateEnemies says so in its own comment, and raiseFelled has always
    // read it. Move the world under an open fight and the reinforcements still belong to the
    // fight, not to wherever the globals have got to.
    const stale = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = TOTAL_TIERS;
      initiateCombat('BOSS', false);
      const boss = activeEntities.find(e => e.id === 'b1');
      const own = spawnScale(boss);
      currentSector = 6;                       // the world moves; the fight does not
      return { own, after: spawnScale(boss), live: { mult: fightMult(), dmg: fightDmgMult() } };
    });
    ok(`a fight's reinforcements stay the fight's own (${stale.after.mult.toFixed(2)})`,
      stale.after.mult === stale.own.mult && stale.after.dmg === stale.own.dmg);
    ok(`and not whatever the globals have moved on to (${stale.live.mult.toFixed(2)})`,
      stale.live.mult !== stale.own.mult);
    ok(`which is not what the hand-rolled expression said at any sector but the middle (${seam.rows.map(r => (r.got / r.hand).toFixed(2)).join(', ')})`,
      seam.rows[0].got / seam.rows[0].hand < 0.7 && seam.rows[seam.rows.length - 1].got / seam.rows[0].hand > 2);

    // ── Difficulty reaches the reinforcements now ────────────────────────────────────
    const diff = await page.evaluate(() => {
      const at = d => {
        currentSlot = 1; confirmNewGame(d); sectorFront = null;
        currentSector = 4; currentTier = TOTAL_TIERS;
        initiateCombat('BOSS', false);
        const boss = activeEntities.find(e => e.id === 'b1');
        return spawnScale(boss).mult;
      };
      const normal = at(1.0), hard = at(2.0);
      confirmNewGame(1.0);
      return { normal, hard, hand: 1 + (TOTAL_TIERS - 1) * 0.4 };
    });
    ok(`a harder run builds harder reinforcements (${diff.normal.toFixed(2)} -> ${diff.hard.toFixed(2)})`,
      Math.abs(diff.hard - diff.normal * 2) < 1e-9);
    ok('which the expression it replaced could not do, having no difficulty term in it',
      diff.hand === 4.6);

    // ── The second hound is the first hound ─────────────────────────────────────────
    const hound = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      // The rotation is dealt per run and is longer than the road, so the Marshal is not always
      // on this run's seven sectors. Prefer a sector the player would actually reach - the
      // numbers below are then the ones a real fight produces - and only walk past the road if
      // this run did not deal it one.
      let s = 1; while (s <= FINAL_SECTOR && bossForSector(s).id !== 'MARSHAL') s++;
      if (s > FINAL_SECTOR) { s = 1; while (s <= 200 && bossForSector(s).id !== 'MARSHAL') s++; }
      currentSector = s; currentTier = TOTAL_TIERS;
      initiateCombat('BOSS', false);
      const boss = activeEntities.find(e => e.id === 'b1');
      const first = activeEntities.find(e => e.id === 'boss_escort');
      const opened = { hp: first.maxHp, dmg: first.dmgBase, plate: first.plate, sig: first.sig };
      first.hp = 0;
      const again = reRaiseRetinue(boss, 'escort');
      return { sector: s, onRoad: s <= FINAL_SECTOR, opened,
               again: { hp: again.maxHp, dmg: again.dmgBase, plate: again.plate, sig: again.sig },
               linked: boss.escortId === again.id, armor: boss.escortArmor };
    });
    ok(`at sector ${hound.sector}${hound.onRoad ? '' : ' (not dealt onto this run\u2019s road)'} the Marshal opens with a hound worth ${hound.opened.hp} health and ${hound.opened.dmg} damage`,
      hound.opened.hp > 0 && hound.opened.dmg > 0 && hound.opened.plate > 0);
    ok(`and the one it puts back is the same hound (${hound.again.hp}/${hound.again.dmg})`,
      hound.again.hp === hound.opened.hp && hound.again.dmg === hound.opened.dmg);
    ok(`carrying the same riot plate it opened with (${hound.again.plate})`,
      hound.again.plate === hound.opened.plate && hound.again.plate > 0 && hound.again.sig === 'RIOT_PLATE');
    ok('and the column is pointed at it, so the Marshal is armoured again while it stands',
      hound.linked && hound.armor > 0);

    // ── Two cries that now have something behind them ───────────────────────────────
    const enrage = async (bossId, prep) => {
      await page.evaluate(([bid, p]) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        let se = 1; while (se <= 200 && bossForSector(se).id !== bid) se++;
        currentSector = se; currentTier = 6;
        playerRoster.forEach(c => { if (c.gridPos > 0) { c.maxHp = 5000; c.hp = 5000; } });
        initiateCombat('BOSS', false);
        const boss = activeEntities.find(e => e.id === 'b1');
        boss.hp = Math.floor(boss.maxHp * 0.4);
        boss.sizeUp = false;    // F01: the opening read is not the turn under test here
        if (p === 'killEscort') { const es = activeEntities.find(e => e.id === 'boss_escort'); if (es) es.hp = 0; }
        window.__pre = { sky: currentWeather, clock: boss.stormTurn,
                         escortUp: !!activeEntities.find(e => e.id === boss.escortId && e.hp > 0),
                         foes: activeEntities.filter(e => !e.isPlayer && e.hp > 0).length };
      }, [bossId, prep || null]);
      await page.evaluate(() => { combatActive = true; executeEnemyAi(activeEntities.find(e => e.id === 'b1')); });
      await page.waitForTimeout(700);
      return page.evaluate(() => {
        const boss = activeEntities.find(e => e.id === 'b1');
        return { pre: window.__pre, phase: boss.phase, sky: currentWeather, clock: boss.stormTurn,
                 escortUp: !!activeEntities.find(e => e.id === boss.escortId && e.hp > 0),
                 foes: activeEntities.filter(e => !e.isPlayer && e.hp > 0).length };
      });
    };

    let m = await enrage('MARSHAL', 'killEscort');
    ok('the Marshal enrages with its hound already down', m.phase === 2 && m.pre.escortUp === false);
    ok('and the cry calls the column in, which is now a hound back on the field',
      m.escortUp === true && m.foes === m.pre.foes + 1);

    m = await enrage('MARSHAL');
    ok('but with the hound still standing it calls in nothing, rather than stacking a second',
      m.phase === 2 && m.pre.escortUp === true && m.foes === m.pre.foes);

    let st = await enrage('STORMCALLER');
    ok(`the Stormcaller opens the sky on the spot (${st.pre.sky} -> ${st.sky})`,
      st.phase === 2 && st.sky !== st.pre.sky);
    ok(`and turns it faster from there (every ${st.pre.clock} -> every ${st.clock})`,
      st.clock < st.pre.clock && st.clock >= 1);

    // ── No cry gets to name a mechanic it does not have ─────────────────────────────
    const cries = await page.evaluate(() => {
      // dmgScale and speedBonus are the generic pair every enrage may carry. An enrage that
      // carries nothing else is a battle cry with nothing behind it.
      const generic = ['cry', 'dmgScale', 'speedBonus'];
      return BOSS_POOL.filter(b => b.enrage)
        .map(b => ({ id: b.id, own: Object.keys(b.enrage).filter(k => !generic.includes(k)) }))
        .filter(x => x.own.length === 0).map(x => x.id);
    });
    ok(`every commander's enrage does something of its own (${cries.join(', ') || 'none inert'})`,
      cries.length === 0);
  }
};

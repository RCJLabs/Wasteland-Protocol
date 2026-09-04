// E04: armour is a flat subtraction in a fight where everything else multiplies. mitigate ends
// `Math.max(1, cd - rv - ac)` with every multiplier already folded into cd, so a plate was worth
// its face value against a hit that had grown by the curve. Measured on the mean hostile built
// by generateEnemies: HP grows x14.25 and damage x12.67 from sector 1 tier 1 to sector 7 tier
// 10, while armour does not move at all. A defensive turn worth +8 absorbs 67% of a mean
// incoming hit at the start of a run and 5.3% at the end of one - the same turn, devalued
// twelvefold, with nothing about it changed.
//
// A grant is priced in the currency of the hit it subtracts from now: armourScale() is dmgMult
// without difficultyMult, which is exactly 1.0 at sector 1 tier 1, so every sector-one number is
// what it always was. Difficulty is deliberately left out - it is a knob meant to make the game
// harder, and folding it in here would hand the plate back exactly what the difficulty took.
//
// What is NOT scaled is base armour, the permanent plate baked into a unit's own line. What that
// subtracts from is player damage, which grows through perks rather than along this curve, so
// scaling it by this curve would be arithmetic dressed as balance: the Bastion's 30 would become
// 250 at sector 7 against player hits in the low hundreds, which is the untouchable-champion
// failure this phase was warned about before it started. It stays flat and wants its own phase.
module.exports = {
  name: 'A plate worth what it says',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── The curve: 1.0 where the game starts, and the damage curve thereafter ──────────
    const curve = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const at = (s, t) => { currentSector = s; currentTier = t; return armourScale(); };
      const one = at(1, 1);
      const deep = at(7, 10);
      // The same shape dmgMult is built from, with difficultyMult left out on purpose.
      const want = (1 + (10 - 1) * TIER_DMG_GROWTH) * Math.pow(SECTOR_DMG_SCALE, 7 - 1);
      difficultyMult = 2.0;
      const harder = at(7, 10);
      difficultyMult = 1.0;
      return { one, deep, want, harder, plateOne: (at(1, 1), plate(8)), plateDeep: (at(7, 10), plate(8)) };
    });
    ok(`sector one tier one is exactly unscaled (${curve.one})`, curve.one === 1);
    ok(`and depth follows the damage curve (${curve.deep.toFixed(2)})`,
      Math.abs(curve.deep - curve.want) < 1e-9 && curve.deep > 8);
    ok('difficulty is not handed back to the plate', curve.harder === curve.deep);
    ok(`so a +8 grant is 8 at the door and ${curve.plateDeep} at the end of the road`,
      curve.plateOne === 8 && curve.plateDeep > 60);

    // ── Through the real move, not the helper: IRON GUARD grants what it is worth ──────
    // executeSelfAction is the site that was changed, so drive that and read the operator's own
    // armor off it. Asserting against plate() here would only prove plate() equals itself.
    const guard = await page.evaluate(() => {
      const run = (s, t) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = s; currentTier = t;
        initiateCombat('RAIDERS', false);
        const me = activeEntities.find(e => e.isPlayer && e.classType === 'BRUISER')
                || activeEntities.find(e => e.isPlayer);
        me.armor = 0; me.armorTurns = 0;
        activeIndex = turnQueue.findIndex(e => e && e.id === me.id);
        executeSelfAction('IRON_GUARD');
        return me.armor;
      };
      const shallow = run(1, 1), deep = run(7, 10);
      currentSector = 7; currentTier = 10;
      return { shallow, deep, want: plate(15) };
    });
    ok(`bracing at sector one grants the written number (${guard.shallow})`, guard.shallow === 15);
    ok(`and bracing at the end of the road grants it in that fight's money (${guard.deep})`,
      guard.deep === guard.want && guard.deep > guard.shallow * 6);

    // ── The same rule on the other side of the field ──────────────────────────────────
    // Driven through executeEnemyAi's DEFEND branch rather than plate() - the hostile grants were
    // edited at their own call sites and a helper assertion would not notice one being missed.
    const both = await page.evaluate(() => {
      const brace = (s, t) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = s; currentTier = t;
        initiateCombat('RAIDERS', false);
        const foe = activeEntities.find(e => !e.isPlayer && e.hp > 0);
        foe.armor = 0; foe.armorTurns = 0; foe.burrowed = 0;
        foe.intent = { type: 'DEFEND' };
        executeEnemyAi(foe);
        return foe.armor;
      };
      const shallow = brace(1, 1), deep = brace(7, 10);
      currentSector = 7; currentTier = 10;
      return { shallow, deep, want: plate(15) };
    });
    ok(`a hostile bracing at the door is worth its written number (${both.shallow})`, both.shallow === 15);
    ok(`and the same stance deep in is worth that fight's money (${both.shallow} -> ${both.deep})`,
      both.deep === both.want && both.deep > both.shallow * 6);

    // ── Base plate is deliberately left alone ────────────────────────────────────────
    // Read it per named unit, not as a pool mean: which hostiles are eligible changes with the
    // tier, so a mean over the pool measures composition drift and not the plate at all.
    const flat = await page.evaluate(() => {
      const armourAt = (s, t) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = s; currentTier = t;
        const mult = 1 * (1 + ((t - 1) * TIER_HP_GROWTH)) * Math.pow(SECTOR_HP_SCALE, s - 1);
        const dmgMult = 1 * (1 + ((t - 1) * TIER_DMG_GROWTH)) * Math.pow(SECTOR_DMG_SCALE, s - 1);
        const arm = {}, hp = {};
        for (let i = 0; i < 40; i++) generateEnemies('MECH', mult, false, dmgMult, null)
          .forEach(e => { arm[e.name] = e.baseArmor || 0; (hp[e.name] = hp[e.name] || []).push(e.maxHp); });
        const mean = o => Object.keys(o).length
          ? Object.values(o).reduce((a, v) => a + v.reduce((x, y) => x + y, 0) / v.length, 0) : 0;
        return { arm, hp: mean(hp) };
      };
      const a = armourAt(1, 5), b = armourAt(7, 10);
      const shared = Object.keys(a.arm).filter(n => n in b.arm);
      return {
        shared,
        turret: [a.arm['Turret'], b.arm['Turret']],
        moved: shared.filter(n => a.arm[n] !== b.arm[n]),
        hpGrowth: b.hp / a.hp,
      };
    });
    ok(`a Turret's own plate is the same number at both ends of the road (${flat.turret.join(' -> ')})`,
      flat.turret[0] === 8 && flat.turret[1] === 8);
    ok(`and no hostile line's plate moves with depth (${flat.shared.length} names checked${flat.moved.length ? ': ' + flat.moved.join(', ') : ''})`,
      flat.shared.length >= 2 && flat.moved.length === 0);
    ok(`while the body behind it grows (hp x${flat.hpGrowth.toFixed(1)})`, flat.hpGrowth > 3);

    // ── And every line that quotes a grant quotes the one it is about to make ─────────
    // Read off the rendered log line and the rendered button, not off the helper: the defect
    // this guards against is a readout keeping its own copy of a number the resolver has moved.
    const said = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 7; currentTier = 10;
      initiateCombat('RAIDERS', false);
      const me = activeEntities.find(e => e.isPlayer && e.classType === 'BRUISER')
              || activeEntities.find(e => e.isPlayer);
      activeIndex = turnQueue.findIndex(e => e && e.id === me.id);
      document.getElementById('log').innerHTML = '';
      executeSelfAction('IRON_GUARD');
      const braced = [...document.querySelectorAll('#log div')].map(d => d.innerText)
        .find(t => /braces and covers/.test(t)) || '';

      momentum = 100; pendingAction = null; renderCommandDeck();
      const hold = [...document.querySelectorAll('.tactic-btn')]
        .find(b => /HOLD/.test(b.innerText));
      const held = hold ? hold.title : '';

      document.getElementById('log').innerHTML = '';
      spendTactic('HOLD');
      const dug = [...document.querySelectorAll('#log div')].map(d => d.innerText)
        .find(t => /the line digs in/.test(t)) || '';
      return { braced, held, dug, guard: plate(15), line: plate(12) };
    });
    ok(`the brace log names the plate it just handed over (${said.guard})`,
      said.braced.includes(`+${said.guard} ARMOR`) && said.guard > 15);
    ok(`the HOLD button quotes what pressing it will grant (${said.line})`,
      said.held.includes(`+${said.line} armour`) && said.line > 12);
    ok('and the line it writes afterwards agrees with the button',
      said.dug.includes(`+${said.line} armour`));

    // The commander's own passive says the same thing, in the same money.
    const plating = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      let s = 1; while (s <= 200 && bossForSector(s).id !== 'COLOSSUS') s++;
      currentSector = s; currentTier = 8; initiateCombat('BOSS', false);
      renderField();
      const boss = activeEntities.find(e => e.id === 'b1');
      const tag = document.getElementById(boss.id).querySelector('[title*="Welds"]');
      return { title: tag ? tag.title : '', per: plate(6), cap: plate(30), written: BOSS_PASSIVES.PLATING.desc };
    });
    ok(`the Re-Plating tag reads the regrowth in this fight's money (${plating.per} to a cap of ${plating.cap})`,
      plating.title.includes(`Welds ${plating.per} points`) && plating.title.includes(`up to ${plating.cap} over`));
    ok(`and it is not simply the written line (${plating.written.slice(0, 24)}...)`,
      plating.per > 6 && plating.title !== plating.written);

    // ── The stat the engine never applied is gone from the places that claimed it ─────
    const dead = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const declared = ROSTER_TEMPLATE.concat(RECRUIT_POOL)
        .filter(t => (t.armor || 0) !== 0).map(t => t.classType);
      const card = recruitCardHtml(RECRUIT_POOL[0]);
      currentSector = 2; currentTier = 5; initiateCombat('RAIDERS', false);
      const zeroed = playerRoster.every(p => (p.armor || 0) === 0);
      return { declared, cardMentionsArm: /ARM/.test(card), zeroed };
    });
    ok(`no operator template declares a base plate any more (${dead.declared.join(', ') || 'none'})`,
      dead.declared.length === 0);
    ok('and the recruit card no longer advertises one', !dead.cardMentionsArm);
    ok('the squad still starts every fight unplated, which is what it always did', dead.zeroed);
  }
};

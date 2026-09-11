// Going down had no memory. Measured across sixty simulated expeditions: 850 operators hit the
// floor, and every one who got back up walked into the next node exactly as they walked into
// the last. The only outcome that ever cost anything was the one where they died - so the turns
// the squad spent hauling people up bought the body and nothing else, and a squad that never
// once picked anybody up played the same game as one that always did.
//
// The rule this suite holds is one line: if the fight ends with you still on the floor, you may
// carry something out of it. Being picked up before the end prevents it entirely. Everything
// below checks that rule against the code rather than against itself - the prevention is tested
// by performing the save, the stat deltas by measuring them, and the two behavioural scars by
// starting a fight and by going down in one.
//
// One instrument note, because it cost a measurement here. simulate.js never called
// recoverDowned on a won or lost fight - only withdraw() reached it - so downed operators lay
// at zero health with a live bleed-out clock, walked into the next initiateCombat still down,
// and were ticked to death by the queue. The sim was killing operators the engine had already
// dragged clear, and it would have reported a scar rate of zero whatever the chance was set to.
module.exports = {
  name: 'Scars',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    await page.evaluate(() => {
      window.__run = () => { activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null; };
      // Forcing a roll rather than waiting for one: every scar helper takes its rng, and the
      // two that do not are reached with Math.random pinned for exactly one call.
      window.__pin = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
    });

    // ---- the pool ----
    const pool = await page.evaluate(() => ({
      n: SCAR_POOL.length,
      ids: SCAR_POOL.map(s => s.id),
      complete: SCAR_POOL.every(s => s.id && s.name && s.desc
        && typeof s.hp === 'number' && typeof s.dmg === 'number' && typeof s.spd === 'number'),
      unique: new Set(SCAR_POOL.map(s => s.id)).size === SCAR_POOL.length,
      // A scar is never an upgrade. Every one of them is a cost.
      noUpside: SCAR_POOL.every(s => s.hp <= 0 && s.dmg <= 0 && s.spd <= 0),
      // Earned, not rolled: nothing here may be reachable from the muster draw.
      notQuirks: SCAR_POOL.every(s => !QUIRK_POOL.some(q => q.id === s.id)),
      drawable: (() => { const seen = new Set();
        for (let i = 0; i < 400; i++) quirkPoolFor('BRUISER').forEach(q => seen.add(q.id));
        return SCAR_POOL.some(s => seen.has(s.id)); })(),
      lookup: SCAR_POOL.every(s => scarById(s.id) === s) && scarById('NOT_A_SCAR') === null
    }));
    ok(`${pool.n} scars, every one named and priced`, pool.n >= 5 && pool.complete);
    ok('with no two sharing an id', pool.unique);
    ok('and not one of them an upgrade', pool.noUpside);
    ok('none of them is in the quirk pool', pool.notQuirks);
    ok('and 400 muster draws never deal one', !pool.drawable);
    ok('every id resolves, and a made-up one does not', pool.lookup);

    // ---- the rule: down at the end of the fight ----
    const rule = await page.evaluate(() => {
      __run();
      const line = playerRoster.filter(p => p.gridPos > 0);
      const a = line[0], b = line[1];
      activeEntities = [...line];
      a.hp = 0; goDown(a);
      b.hp = 0; goDown(b);
      // The save: b is picked up before the fight ends, exactly as a Cauterize would.
      b.hp = 20; b.downTurns = 0;
      const up = __pin(0, () => recoverDowned('once the field is held'));
      return { up, aScars: (a.scars || []).length, bScars: (b.scars || []).length,
               aUp: a.hp > 0, aDown: a.downTurns };
    });
    ok('whoever is still on the floor is dragged clear', rule.aUp && rule.aDown === 0);
    ok('and the one left there takes a scar', rule.aScars === 1);
    ok('while the one picked up first takes none', rule.bScars === 0);
    ok('and only the still-down operator is in the recovery list', rule.up.length === 1);

    // ---- prevention is the whole point, so it is checked from the other side too ----
    const saved = await page.evaluate(() => {
      __run();
      const line = playerRoster.filter(p => p.gridPos > 0);
      activeEntities = [...line];
      line.forEach(p => { p.hp = 0; goDown(p); });
      // Every one of them patched up before the end.
      line.forEach(p => { p.hp = p.maxHp; p.downTurns = 0; });
      __pin(0, () => recoverDowned('once the field is held'));
      return line.reduce((a, p) => a + (p.scars || []).length, 0);
    });
    ok('a squad that saves everyone leaves with nothing to show for it', saved === 0);

    // ---- the roll is a roll ----
    const roll = await page.evaluate(() => {
      __run();
      const c = playerRoster[0];
      const never = markScars([c.id], () => 0.999);
      const always = markScars([c.id], () => 0);
      return { never: never.length, always: always.length, chance: SCAR_CHANCE, held: (c.scars || []).length };
    });
    ok(`a failed roll leaves no mark (chance ${roll.chance})`, roll.never === 0);
    ok('a passed one does', roll.always === 1 && roll.held === 1);
    ok('and the chance is a real chance, not a certainty', roll.chance > 0 && roll.chance < 1);

    // ---- the stat deltas, applied and given back exactly ----
    const stats = await page.evaluate(() => {
      __run();
      const out = {};
      SCAR_POOL.forEach(s => {
        const c = JSON.parse(JSON.stringify(playerRoster[0]));
        const was = { hp: c.maxHp, dmg: c.dmgBase, spd: c.speed };
        applyScarStats(c, s);
        const moved = { hp: c.maxHp - was.hp, dmg: c.dmgBase - was.dmg, spd: c.speed - was.spd };
        removeScarStats(c, s);
        out[s.id] = { moved, back: c.maxHp === was.hp && c.dmgBase === was.dmg && c.speed === was.spd,
                      want: { hp: s.hp, dmg: s.dmg, spd: s.spd } };
      });
      return out;
    });
    Object.entries(stats).forEach(([id, r]) => {
      ok(`${id.toLowerCase().replace(/_/g, ' ')} moves exactly what it says`,
        r.moved.hp === r.want.hp && r.moved.dmg === r.want.dmg && r.moved.spd === r.want.spd);
    });
    ok('and treating one gives back precisely what it took',
      Object.values(stats).every(r => r.back));

    // ---- what one body can carry ----
    const carry = await page.evaluate(() => {
      __run();
      const c = playerRoster[0];
      c.maxHp = 200; c.dmgBase = 40; c.speed = 20;   // room for anything the pool holds
      const got = [];
      for (let i = 0; i < 8; i++) { const s = giveScar(c, () => 0); got.push(s ? s.id : null); }
      return { got, held: (c.scars || []).length, max: SCAR_MAX,
               unique: new Set(c.scars || []).size === (c.scars || []).length };
    });
    ok(`at most ${carry.max} to a body`, carry.held === carry.max);
    ok('and the attempts past that deal nothing', carry.got.slice(carry.max).every(g => g === null));
    ok('never the same scar twice', carry.unique);

    // ---- a wound the body could not fight through is not dealt ----
    const floor = await page.evaluate(() => {
      __run();
      const c = playerRoster[0];
      c.maxHp = 22; c.hp = 22;             // -10 max HP would leave 12, under the floor
      const fits = SCAR_POOL.filter(s => scarFits(c, s)).map(s => s.id);
      const dealt = [];
      for (let i = 0; i < 40; i++) {
        const t = JSON.parse(JSON.stringify(c));
        const s = giveScar(t, Math.random);
        if (s) dealt.push(s.id);
      }
      return { fits, dealt: [...new Set(dealt)], hp: c.maxHp };
    });
    ok('cracked ribs are not dealt to somebody who could not take them',
      !floor.fits.includes('CRACKED_RIBS') && !floor.dealt.includes('CRACKED_RIBS'));
    ok('but the rest of the pool still is', floor.dealt.length >= 3);

    // ---- shell shock: the fight starts without them ----
    const shell = await page.evaluate(() => {
      __run();
      const line = playerRoster.filter(p => p.gridPos > 0);
      const a = line[0], b = line[1];
      a.scars = ['SHELL_SHOCK'];
      initiateCombat('RAIDERS', false);
      const after = { a: a.stunnedTurns, b: b.stunnedTurns };
      combatActive = false;
      // And it fires every time, not only the first.
      initiateCombat('RAIDERS', false);
      const again = a.stunnedTurns;
      combatActive = false;
      return { after, again, logged: /shell shock/i.test(document.getElementById('log').innerText) };
    });
    ok('shell shock costs the opening turn', shell.after.a === 1);
    ok('and only for the operator carrying it', shell.after.b === 0);
    ok('every fight, not just the first', shell.again === 1);
    ok('and the log says why', shell.logged);

    // ---- slow to rise: a shorter clock ----
    const slow = await page.evaluate(() => {
      __run();
      const line = playerRoster.filter(p => p.gridPos > 0);
      const a = line[0], b = line[1];
      activeEntities = [...line];
      a.scars = ['SLOW_TO_RISE'];
      a.hp = 0; goDown(a);
      b.hp = 0; goDown(b);
      return { a: a.downTurns, b: b.downTurns, base: BLEED_OUT };
    });
    ok(`slow to rise bleeds out in ${slow.a}, not ${slow.base}`, slow.a === slow.base - 1);
    ok('and nobody else’s clock moves', slow.b === slow.base);

    // ---- treatment at the Outpost ----
    const treat = await page.evaluate(() => {
      __run();
      const c = playerRoster[0];
      c.scars = [];
      const was = { hp: c.maxHp, dmg: c.dmgBase, spd: c.speed };
      giveScar(c, () => 0);
      const worn = scarById(c.scars[0]);
      const marked = c.maxHp !== was.hp || c.dmgBase !== was.dmg || c.speed !== was.spd;
      scrap = SCAR_TREAT_COST - 1;
      const broke = healScar(c.id, worn.id);
      scrap = SCAR_TREAT_COST + 5;
      const paid = healScar(c.id, worn.id);
      return { broke, paid, marked, left: (c.scars || []).length, scrap, cost: SCAR_TREAT_COST,
               restored: c.maxHp === was.hp && c.dmgBase === was.dmg && c.speed === was.spd,
               // Cracked ribs give the capacity back and the blood with it.
               notShort: c.hp <= c.maxHp,
               // Nothing is treated that is not carried.
               phantom: healScar(c.id, 'SHELL_SHOCK') };
    });
    ok(`treatment is refused ${treat.cost - 1} Scrap short`, treat.broke === false);
    ok('and taken at the price', treat.paid === true && treat.left === 0);
    ok('the Scrap actually leaves the pile', treat.scrap === 5);
    ok('the scar moved a stat in the first place', treat.marked);
    ok('and the operator gets back exactly what it took', treat.restored && treat.notShort);
    ok('a scar nobody carries cannot be treated', treat.phantom === false);

    // ---- it lasts the expedition: through a save, a reload and a regroup ----
    const persist = await page.evaluate(() => {
      __run();
      const c = playerRoster[0];
      c.scars = []; giveScar(c, () => 0);
      const worn = c.scars[0];
      const hp = c.maxHp;
      saveGameState();
      playerRoster = [];
      loadGameState();
      const back = playerRoster.find(p => p.id === c.id);
      const afterLoad = { has: hasScar(back, worn), hp: back.maxHp };
      runStats = newRunStats();
      regroupSquad();
      const after = playerRoster.find(p => p.id === c.id);
      return { afterLoad, hp, kept: hasScar(after, worn), maxHp: after.maxHp };
    });
    ok('a scar survives a save and a reload', persist.afterLoad.has);
    ok('and so does the stat it took', persist.afterLoad.hp === persist.hp);
    ok('a fallback does not wash it off', persist.kept && persist.maxHp === persist.hp);

    // ---- old saves, and saves carrying nonsense ----
    const migrate = await page.evaluate(() => {
      const before = [{ id: 'x1', traits: [] }, { id: 'x2', scars: ['TREMOR', 'NOT_A_SCAR'] }];
      const after = migrateTraits(before);
      return { none: Array.isArray(after[0].scars) && after[0].scars.length === 0,
               kept: after[1].scars.includes('TREMOR'),
               dropped: !after[1].scars.includes('NOT_A_SCAR') };
    });
    ok('a save from before scars existed loads with none', migrate.none);
    ok('a real scar in a save is kept', migrate.kept);
    ok('and an id that no longer exists is dropped rather than left inert', migrate.dropped);

    // ---- a recruit arrives unmarked ----
    const recruit = await page.evaluate(() => {
      __run();
      scrap = 9999;
      const t = recruitables()[0];
      pendingRecruit = { id: t.id, cost: 10, nodeId: 'n1', taken: false };
      signOnRecruit();
      const c = playerRoster.find(p => p.id === t.id);
      return { signed: !!c, scars: c ? (c.scars || []).length : -1 };
    });
    ok('a recruit signs on carrying no scars', recruit.signed && recruit.scars === 0);

    // ---- the Outpost says so ----
    const card = await page.evaluate(() => {
      __run();
      const c = playerRoster[0];
      c.scars = []; giveScar(c, () => 0);
      const worn = scarById(c.scars[0]);
      scrap = SCAR_TREAT_COST + 50;
      renderOutpost();
      const txt = document.getElementById('outpost-roster').innerText;
      const btn = document.querySelector(`[data-action="scar-menu"][data-id="${c.id}"]`);
      dispatchAction(btn);
      const menu = document.getElementById('outpost-roster').innerText;
      const pick = document.querySelector(`[data-action="treat-scar"][data-id="${c.id}"]`);
      const hadPick = !!pick;
      if (pick) dispatchAction(pick);
      renderOutpost();
      return { named: txt.includes(worn.name), cost: txt.includes(String(SCAR_TREAT_COST)),
               menu: menu.includes(worn.name), hadPick,
               gone: !document.getElementById('outpost-roster').innerText.includes(worn.name),
               clean: !document.querySelector(`[data-action="scar-menu"][data-id="${c.id}"]`) };
    });
    ok('the operator card names the scar', card.named);
    ok('and prices the treatment on the card', card.cost);
    ok('the treat button opens a menu of what they carry', card.menu && card.hadPick);
    ok('and treating one from it clears it off the card', card.gone);
    ok('and takes the treat button away with it', card.clean);

    // ---- a clean operator is not offered treatment they do not need ----
    const clean = await page.evaluate(() => {
      __run();
      scrap = 9999;
      playerRoster.forEach(c => { c.scars = []; });
      renderOutpost();
      return document.querySelectorAll('[data-action="scar-menu"]').length;
    });
    ok('an unscarred roster is offered no treatment at all', clean === 0);

    // ---- the manual ----
    const manual = await page.evaluate(() => {
      renderCodex();
      const txt = document.getElementById('codex-body').innerText;
      return { has: /GOING DOWN/i.test(txt),
               each: SCAR_POOL.every(s => txt.includes(s.desc)),
               named: SCAR_POOL.every(s => txt.includes(s.name)),
               // The prevention is the part a player has to be told.
               prevention: /pick(ing)? them up|any heal/i.test(txt),
               cost: txt.includes(String(SCAR_TREAT_COST)),
               clock: txt.includes(String(BLEED_OUT)) };
    });
    ok('the manual has an entry for going down', manual.has);
    ok('and quotes every scar in full', manual.each && manual.named);
    ok('and says how to avoid one', manual.prevention);
    ok('and what it costs to be rid of one', manual.cost);
    ok('and how long the clock runs', manual.clock);

    // ── M01: the five situational ones ──────────────────────────────────────────────
    // The point of these is not that they are bad. It is that they are bad IN PLACES, so that
    // paying SCAR_TREAT_COST to be rid of one is a read of the road ahead rather than a question
    // about your purse. So each pair of rows below is "it bites here" and "it costs nothing
    // there" - the second row is the one that would go quiet if a scar were flattened into
    // another -3 DMG.
    const burned = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField();
      const t = window.__bare(playerRoster.find(c => c.gridPos > 0));
      t.hp = t.maxHp = 4000; activeEntities = [t];
      const before = { bio: mitigate(null, t, 100, 'bio', null).n, phys: mitigate(null, t, 100, 'phys', null).n };
      t.scars = ['BURNED_LUNGS'];
      return { before, after: { bio: mitigate(null, t, 100, 'bio', null).n,
                                phys: mitigate(null, t, 100, 'phys', null).n } };
    });
    ok(`BURNED LUNGS opens the bio badge (${burned.before.bio} -> ${burned.after.bio} of 100)`,
      burned.after.bio === burned.before.bio + 25);
    ok(`and costs nothing at all against anything else (${burned.after.phys} of 100)`,
      burned.after.phys === burned.before.phys);

    const stiff = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField();
      const t = window.__bare(playerRoster.find(c => c.gridPos > 0));
      const base = cdFor(t, 'nothing_in_particular', 3);
      t.scars = ['STIFF_JOINTS'];
      return { base, scarred: cdFor(t, 'nothing_in_particular', 3),
               floored: cdFor(t, 'nothing_in_particular', 1) };
    });
    ok(`STIFF JOINTS puts a turn on every cooldown (${stiff.base} -> ${stiff.scarred})`,
      stiff.scarred === stiff.base + 1);
    // Said plainly rather than as a floor check, which is what the first draft of this row
    // claimed and was not: the scar puts a turn on the SHORTEST move too, so the cheapest thing
    // in the deck stops being free. The Math.max(1) in cdFor guards the sky's cdCut, not this.
    ok(`including the cheapest move in the deck (a 1-turn cooldown becomes ${stiff.floored})`,
      stiff.floored === 2);

    const thin = await page.evaluate(() => {
      const tick = (scars, quirk) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        window.__clearField(); runStats = newRunStats();
        const t = window.__bare(playerRoster.find(c => c.gridPos > 0));
        t.hp = t.maxHp = 400; t.bleedingTurns = 3;
        t.scars = scars; t.quirk = quirk;
        activeEntities = [t];
        const before = t.hp;
        applyTurnStartEffects(t);
        return before - t.hp;
      };
      return { plain: tick([], null), thin: tick(['THIN_BLOOD'], null),
               both: tick(['THIN_BLOOD'], { id: 'SLOW_BLEEDER', name: 'Slow Bleeder' }) };
    });
    ok(`THIN BLOOD bleeds half again as much (${thin.plain} -> ${thin.thin})`,
      thin.thin === Math.floor(thin.plain * 1.5));
    ok(`and a slow bleeder carrying it lands back near where they started (${thin.both} against ${thin.plain})`,
      thin.both < thin.thin && thin.both <= thin.plain);

    const shy = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const t = playerRoster.find(c => c.gridPos > 0);
      turnQueue = [t]; activeIndex = 0; combatActive = true;
      momentum = 100;
      pendingAction = null; queueAction('OVERDRIVE', null);
      const refused = pendingAction;
      t.scars = [];
      pendingAction = null; queueAction('OVERDRIVE', null);
      const allowed = pendingAction;
      t.scars = ['GUN_SHY'];
      pendingAction = null; queueAction('OVERDRIVE', null);
      const refusedScarred = pendingAction;
      combatActive = false;
      return { refused, allowed, refusedScarred };
    });
    ok(`an operator without the scar can queue an overdrive (${shy.allowed})`, shy.allowed === 'OVERDRIVE');
    ok(`GUN SHY will not spend a full bar (${shy.refusedScarred})`, shy.refusedScarred === null);

    const grip = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const t = playerRoster.find(c => c.gridPos > 0);
      t.scars = [];
      const mod = GEAR_POOL.find(g => g.slot === 'mod' && g.cls === t.classType);
      if (!mod) return { skip: true };
      gearStash.push(mod.id); equipGear(t.id, mod.id);
      const worn = t.weaponMod;
      // The scar lands on a body already carrying one.
      t.scars.push('RUINED_GRIP');
      if (t.weaponMod) unequipGear(t.id, 'mod');
      const afterScar = t.weaponMod, inStash = gearStash.includes(mod.id);
      equipGear(t.id, mod.id);
      return { worn, afterScar, inStash, refused: t.weaponMod };
    });
    ok(`a mod goes on an unscarred hand (${grip.worn})`, !!grip.worn);
    ok('RUINED GRIP takes it off and puts it back in the stash', grip.afterScar === null && grip.inStash);
    ok('and the hand will not close on another', grip.refused === null);

    // The pool grew, and the manual row above quotes every entry in it - so this is the row that
    // says the growth was real rather than five more names on one list.
    const poolShape = await page.evaluate(() => ({
      n: SCAR_POOL.length,
      flat: SCAR_POOL.filter(s => s.hp || s.dmg || s.spd).length,
      behavioural: SCAR_POOL.filter(s => !s.hp && !s.dmg && !s.spd).length }));
    ok(`the pool carries ${poolShape.n} scars, ${poolShape.behavioural} of them behavioural rather than a stat`,
      poolShape.n >= 10 && poolShape.behavioural >= 7);
  }
};

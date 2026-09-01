// A04 gave every commander a grudge PHASE - a last gear that opens under a quarter health. It
// works, and it arrives after the fight is decided. For the three-quarters before it, a
// Thrice-Risen commander was a fresh one wearing bigger numbers: +20% health, +12% damage, +4
// armour a stack, and nothing a player can read off a field.
//
// From the second meeting a commander now also trades one of its intents for something it
// picked up losing to you - armed from turn one and telegraphed like anything else. The two
// things this suite holds are the two that rot quietly: that the learned move is a TRADE
// rather than an extra action, and that every one of the eight actually changes the fight
// rather than printing a line about changing it.
module.exports = {
  name: 'What commanders learned',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__grudge = (id, n) => { grudges = {}; if (n) grudges[id] = n; };
      // A commander built straight from the pool, so the rotation does not choose for us.
      window.__raise = (b, g, extra = {}) => {
        const boss = {
          id: 'b1', name: b.name, bossId: b.id, classType: 'BOSS', range: b.range,
          maxHp: 800, hp: 500, speed: b.speed, armor: 10, baseArmor: 20, dmgBase: 30,
          img: b.img, scale: b.scale, hpDrop: 0, phase: 1, grudge: g, sigCd: 0,
          stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0,
          resistances: { ...b.resistances }, intents: b.intents, enrage: b.enrage,
          bossPassive: b.passive || null, ...extra
        };
        if (b.tally) { boss.tally = { ...b.tally }; boss.tallyStacks = 0; }
        if (b.venom) { boss.venom = { ...b.venom }; boss.venomStacks = 0; boss.venomClock = 0; }
        const lm = learnedMove(b, g);
        if (lm) { boss.sig = lm.sig; boss.intents = tradeIntents(b.intents, lm.replaces); }
        return boss;
      };
    });

    // ---- one each, and none of them repeats that commander's last gear ----
    const shape = await page.evaluate(() => {
      const withL = BOSS_POOL.filter(b => b.learned);
      return {
        n: withL.length, total: BOSS_POOL.length,
        real: withL.every(b => !!ENEMY_SIGS[b.learned.sig]),
        actions: withL.every(b => ENEMY_SIGS[b.learned.sig].kind === 'action'),
        described: withL.every(b => { const s = ENEMY_SIGS[b.learned.sig]; return s.name && s.desc && s.icon && s.weight > 0 && s.cd > 0; }),
        unique: new Set(withL.map(b => b.learned.sig)).size,
        // The intent it gives up has to be one it actually had.
        tradesReal: withL.every(b => (b.intents || []).some(([t]) => t === b.learned.replaces)),
        // And the learned move must not be the grudge phase wearing a different hat.
        sameAsPhase: withL.filter(b => b.grudge && ENEMY_SIGS[b.learned.sig].name.toUpperCase() === (b.grudge.name || '').toUpperCase()).map(b => b.name),
        marked: Object.values(ENEMY_SIGS).filter(s => s.learned).length,
        // Nothing ordinary may carry one of these.
        leaked: Object.entries(ENEMY_SIGS).filter(([id, s]) => s.learned)
          .filter(([id]) => Object.values(ENEMY_POOL).flat().some(e => e.sig === id)).map(([id]) => id)
      };
    });
    ok(`every one of the ${shape.total} commanders learned something (${shape.n})`,
      shape.n === shape.total && shape.real && shape.actions);
    ok('each named, drawn, weighted and on a cooldown', shape.described && shape.unique === shape.n);
    ok('each gives up an intent it actually had', shape.tradesReal);
    ok(`and none of them is its grudge phase again (${shape.sameAsPhase.join(', ') || 'all distinct'})`,
      shape.sameAsPhase.length === 0);
    ok(`the learned moves are marked as such (${shape.marked}) and nothing ordinary carries one`,
      shape.marked === shape.n && shape.leaked.length === 0);

    // ---- it is a trade, not an extra ----
    const trade = await page.evaluate(() => {
      const rows = BOSS_POOL.filter(b => b.learned).map(b => {
        const after = tradeIntents(b.intents, b.learned.replaces);
        const sum = after.reduce((a, [, w]) => a + w, 0);
        return { name: b.name, gone: !after.some(([t]) => t === b.learned.replaces),
                 sums: Math.abs(sum - 1) < 1e-9, shorter: after.length === b.intents.length - 1,
                 keptOrder: after.map(([t]) => t).join() ===
                            b.intents.filter(([t]) => t !== b.learned.replaces).map(([t]) => t).join() };
      });
      // And a table it cannot take anything from is left alone rather than emptied.
      const empty = tradeIntents([['ATTACK', 1]], 'ATTACK');
      const missing = tradeIntents([['ATTACK', 0.5], ['AOE', 0.5]], 'HEAVY');
      return { rows, emptyKept: empty.length === 1, missingKept: missing.length === 2 };
    });
    ok('the intent it trades away is gone from the table', trade.rows.every(r => r.gone && r.shorter));
    ok('and what is left still sums to one, in the order it was written',
      trade.rows.every(r => r.sums && r.keptOrder));
    ok('a table with nothing to give up is left as it was',
      trade.emptyKept && trade.missingKept);

    // ---- and only from the second meeting ----
    const armed = await page.evaluate(() => {
      const b = BOSS_POOL.find(x => x.id === 'BASTION');
      const at = g => { __grudge('BASTION', g); return (learnedMove(b, grudgeOn(b.id)) || {}).sig || null; };
      const seq = [at(0), at(1), at(2), at(3)];
      // The intents only change when it does.
      __grudge('BASTION', 1); const cold = __raise(b, grudgeOn(b.id));
      __grudge('BASTION', 2); const warm = __raise(b, grudgeOn(b.id));
      __grudge('BASTION', 0);
      return { seq, at: LEARNED_AT,
               coldSig: cold.sig || null, coldIntents: cold.intents.length,
               warmSig: warm.sig, warmIntents: warm.intents.length,
               poolIntents: b.intents.length };
    });
    ok(`nothing is learned before the ${armed.at}nd meeting (${armed.seq.map(x => x || '-').join(', ')})`,
      armed.seq[0] === null && armed.seq[1] === null && armed.seq[2] !== null && armed.seq[3] !== null);
    ok('a commander that has beaten you once fights exactly as it always did',
      armed.coldSig === null && armed.coldIntents === armed.poolIntents);
    ok('and one that has lost twice comes with the move and one fewer intent',
      armed.warmSig === 'FIELD_REPAIR' && armed.warmIntents === armed.poolIntents - 1);

    // ---- the generator arms it, through the real path ----
    const built = await page.evaluate(() => {
      const out = {};
      // confirmNewGame re-rolls bossSalt, so bossForSector can hand back a different commander
      // between two calls. Pin the salt across the pair or the cold reading and the learned one
      // are about two different warlords, and the comparison is not a comparison.
      const build = g => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        bossSalt = 0;
        currentSector = 1; currentTier = 10;
        const b = bossForSector();
        __grudge(b.id, g);
        const boss = generateEnemies('BOSS', 1, false, 1)[0];
        return { id: b.id, sig: boss.sig || null, intents: boss.intents.length,
                 poolIntents: b.intents.length, cd: boss.sigCd,
                 expect: (b.learned || {}).sig || null };
      };
      out.cold = build(0);
      out.learned = build(3);
      out.same = out.cold.id === out.learned.id;
      __grudge(null, 0);
      return out;
    });
    ok(`generateEnemies arms it off the grudge, on the same commander both times (${built.learned.id}: none -> ${built.learned.sig})`,
      built.same && built.cold.sig === null && built.learned.sig === built.learned.expect);
    ok('and takes the traded intent out on the way',
      built.learned.intents === built.learned.poolIntents - 1 && built.cold.intents === built.cold.poolIntents);
    ok('with the cooldown ready so the first turn can carry it', built.learned.cd === 0);

    // ---- rollIntent will actually deal it ----
    const dealt = await page.evaluate(() => {
      const b = BOSS_POOL.find(x => x.id === 'BASTION');
      __grudge('BASTION', 3);
      const boss = __raise(b, 3);
      const seen = {};
      for (let i = 0; i < 400; i++) { boss.sigCd = 0; const it = rollIntent(boss); seen[it.type] = (seen[it.type] || 0) + 1; }
      // On cooldown it falls back to the table rather than doing nothing.
      const cooled = {};
      for (let i = 0; i < 200; i++) { boss.sigCd = 2; const it = rollIntent(boss); cooled[it.type] = (cooled[it.type] || 0) + 1; }
      __grudge(null, 0);
      return { seen, cooled, gave: b.learned.replaces };
    });
    ok(`the learned move comes up in the rotation (${dealt.seen.SIG || 0} of 400)`, (dealt.seen.SIG || 0) > 40);
    ok(`and the intent it traded away never does (${dealt.gave})`, !dealt.seen[dealt.gave]);
    ok('while on cooldown it uses the table instead of stalling',
      !cooledHasSig(dealt.cooled) && Object.keys(dealt.cooled).length > 0);
    function cooledHasSig(o) { return !!o.SIG; }

    // ---- every one of them changes the fight ----
    const resolved = await page.evaluate(() => {
      return BOSS_POOL.filter(b => b.learned).map(b => {
        __grudge(b.id, 3);
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 3; currentTier = 10;
        const extra = b.id === 'MARSHAL' ? { escortId: 'mate' } : b.id === 'BASTION' ? { wardId: 'mate' } : {};
        const boss = __raise(b, 3, extra);
        initiateCombat('RAIDERS', false);
        const squad = activeEntities.filter(e => e.isPlayer);
        const mate = { id: 'mate', name: 'Pack Mate', classType: 'BEAST', range: 'melee', isPlayer: false,
                       hp: b.id === 'MARSHAL' ? 0 : 40, maxHp: 90, speed: 5, armor: 0, baseArmor: 0, dmgBase: 5,
                       resistances: { phys: 0, bio: 0, energy: 0 }, sig: null, sigCd: 0,
                       stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0 };
        activeEntities = [...squad, boss, mate]; turnQueue = [...squad, boss, mate];
        if (b.id === 'OSSUARY') squad[0].hp = 0;
        combatActive = true; activeIndex = 0;
        const snap = () => JSON.stringify({ hp: boss.hp, armor: boss.armor, tally: boss.tallyStacks || 0,
          venom: boss.venomStacks || 0, mate: mate.hp, mateArmor: mate.armor, wx: currentWeather,
          marked: squad.filter(p => (p.markedTurns || 0) > 0).length });
        const before = snap();
        document.getElementById('log').innerHTML = '';
        boss.intent = { type: 'SIG', icon: ENEMY_SIGS[boss.sig].icon, sig: boss.sig };
        executeEnemyAi(boss);
        const line = (document.getElementById('log').innerText.split('\n').filter(Boolean)[0] || '');
        combatActive = false;
        return { name: b.name, sig: boss.sig, changed: before !== snap(),
                 spoke: line.length > 10, cd: boss.sigCd, expectCd: ENEMY_SIGS[boss.sig].cd };
      });
    });
    ok(`all ${resolved.length} learned moves change the fight (${resolved.filter(r => !r.changed).map(r => r.name).join(', ') || 'none inert'})`,
      resolved.every(r => r.changed));
    ok('and every one of them says what it did', resolved.every(r => r.spoke));
    ok('each going onto its own cooldown afterwards', resolved.every(r => r.cd === r.expectCd));

    // ---- the ones that had to be right ----
    const named = await page.evaluate(() => {
      const out = {};
      // The Marshal puts the hound back up, and only when it is down.
      const m = BOSS_POOL.find(b => b.id === 'MARSHAL');
      const stage = (hp) => {
        __grudge('MARSHAL', 3);
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 3; currentTier = 10;
        const boss = __raise(m, 3, { escortId: 'mate' });
        initiateCombat('RAIDERS', false);
        const squad = activeEntities.filter(e => e.isPlayer);
        const hound = { id: 'mate', name: 'Bulldog', classType: 'BEAST', range: 'melee', isPlayer: false,
                        hp, maxHp: 66, speed: 16, armor: 0, baseArmor: 0, dmgBase: 18,
                        resistances: { phys: 0, bio: 0, energy: 0 }, sig: null, sigCd: 0,
                        stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0 };
        activeEntities = [...squad, boss, hound]; turnQueue = [...squad, boss];
        combatActive = true; activeIndex = 0;
        boss.intent = { type: 'SIG', icon: '.', sig: 'WHISTLE' };
        executeEnemyAi(boss);
        combatActive = false;
        return { hp: hound.hp, armor: hound.armor, queued: turnQueue.some(e => e.id === 'mate') };
      };
      out.houndDown = stage(0);
      out.houndUp = stage(50);
      __grudge(null, 0);
      return out;
    });
    ok(`the Marshal puts a dead hound back on its feet (0 -> ${named.houndDown.hp})`,
      named.houndDown.hp > 0 && named.houndDown.queued);
    ok(`and plates a living one instead of raising it twice (${named.houndUp.hp} HP, +${named.houndUp.armor} armour)`,
      named.houndUp.hp === 50 && named.houndUp.armor > 0);

    // ---- the manual, and the file it keeps ----
    const codex = await page.evaluate(() => {
      const hostiles = CODEX.find(x => x.id === 'HOSTILES');
      const text = hostiles ? hostiles.body().join(' ') : '';
      const ordinary = Object.values(ENEMY_SIGS).filter(s => !s.learned);
      __grudge('BASTION', 3);
      const file = bestiaryRoster().find(r => r.name === 'The Bastion');
      __grudge('BASTION', 0);
      const cold = bestiaryRoster().find(r => r.name === 'The Bastion');
      return { names: BOSS_POOL.filter(b => b.learned).every(b => text.includes(ENEMY_SIGS[b.learned.sig].name)),
               saysTrade: /in place of its/i.test(text),
               saysNotThePhase: /quarter health/i.test(text),
               ordinaryStillListed: ordinary.every(s => text.includes(s.name)),
               fileWhenEarned: file.sig, fileWhenNot: cold.sig };
    });
    ok('the manual names every learned move', codex.names);
    ok('says it is traded for an intent, and is not the dying gear', codex.saysTrade && codex.saysNotThePhase);
    ok('and still lists every ordinary signature', codex.ordinaryStillListed);
    ok('the bestiary keeps a file on it only once it has been learned against you',
      codex.fileWhenEarned === 'FIELD_REPAIR' && codex.fileWhenNot === null);
  }
};

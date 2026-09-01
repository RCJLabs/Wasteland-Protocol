// A commander you killed used to be a commander you killed. The rotation dealt it out again a
// few sectors later at exactly the same numbers, fighting exactly the same way, and the fact
// that you had already put it down once was written nowhere and read by nothing.
//
// It is written down now, across expeditions, and the one that comes back is the one you made:
// heavier, faster, better armoured, and holding a third phase it never needed the first time.
module.exports = {
  name: 'The grudge',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // buildNewRun re-rolls bossSalt, which reshuffles the rotation - so every stage pins the
    // salt and then looks the sector up under that same pinned salt. Without this the harness
    // asks for one commander and measures another.
    await page.evaluate(() => {
      window.__PIN = 'suite56';
      window.__sectorOf = id => { for (let s = 1; s <= 40; s++) if (bossForSector(s).id === id) return s; return null; };
      window.__stage = (id, g) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        bossSalt = window.__PIN;
        grudges = {}; if (g) grudges[id] = g;
        currentSector = window.__sectorOf(id); currentTier = 10;
        initiateCombat('BOSS', false);
        return activeEntities.find(e => e.classType === 'BOSS');
      };
    });

    // ---- the ledger ----
    const ledger = await page.evaluate(() => {
      grudges = {};
      const before = grudgeOn('WARLORD');
      noteGrudge('WARLORD'); noteGrudge('WARLORD');
      const after = grudgeOn('WARLORD');
      saveMeta();
      grudges = {};
      loadMeta();
      const reloaded = grudgeOn('WARLORD');
      // and it does not grow without bound
      for (let i = 0; i < 20; i++) noteGrudge('WARLORD');
      return { before, after, reloaded, capped: grudgeOn('WARLORD'), raw: grudges.WARLORD,
               cap: GRUDGE.cap, untouched: grudgeOn('BASTION') };
    });
    ok('a commander nobody has felled carries no grudge', ledger.before === 0 && ledger.untouched === 0);
    ok('felling one writes it down', ledger.after === 2);
    ok('and it survives to the next expedition', ledger.reloaded === 2);
    ok(`the scaling stops at ${ledger.cap} while the tally keeps counting`,
      ledger.capped === ledger.cap && ledger.raw === 22);

    // ---- what comes back ----
    const risen = await page.evaluate(() => {
      const rows = [];
      // The grudge is a promise about the road: a commander shows its third gear only to
      // somebody it already lost to. The last warlord is the stated exception - it always has
      // one - so it is measured on its own line below rather than folded in here.
      for (const b of BOSS_ROTATION) {
        if (window.__sectorOf(b.id) === null) continue;
        const cold = window.__stage(b.id, 0);
        const c = { id: cold.bossId, hp: cold.maxHp, dmg: cold.dmgBase, armor: cold.armor,
                    speed: cold.speed, name: cold.name, move: !!cold.grudgeMove };
        const hot = window.__stage(b.id, 2);
        rows.push({ want: b.id, cold: c,
          hot: { id: hot.bossId, hp: hot.maxHp, dmg: hot.dmgBase, armor: hot.armor,
                 speed: hot.speed, name: hot.name, move: !!hot.grudgeMove } });
      }
      const last = BOSS_POOL.find(b => b.final);
      const lastCold = last && window.__sectorOf(last.id) !== null ? window.__stage(last.id, 0) : null;
      return { rows, hp: GRUDGE.hp, dmg: GRUDGE.dmg, road: BOSS_ROTATION.length,
               lastAlwaysArmed: !!(lastCold && lastCold.grudgeMove) };
    });
    ok(`every commander on the road was measured as itself (${risen.rows.length})`,
      risen.rows.length === risen.road && risen.rows.every(r => r.cold.id === r.want && r.hot.id === r.want));
    ok('a commander meeting you for the first time is unchanged', risen.rows.every(r => !r.cold.move));
    ok('and the last warlord is the one exception - it is armed cold', risen.lastAlwaysArmed);
    ok('one that has lost to you comes back with more of everything',
      risen.rows.every(r => r.hot.hp > r.cold.hp && r.hot.dmg > r.cold.dmg
        && r.hot.armor > r.cold.armor && r.hot.speed > r.cold.speed));
    ok(`by the rate the table declares (+${Math.round(risen.hp * 200)}% health at two)`,
      risen.rows.every(r => Math.abs(r.hot.hp / r.cold.hp - (1 + risen.hp * 2)) < 0.02));
    ok('and holding something it did not bring the first time', risen.rows.every(r => r.hot.move));
    ok(`the name says so (${risen.rows[0].hot.name})`,
      risen.rows.every(r => r.hot.name !== r.cold.name && /Risen/.test(r.hot.name)));

    // ---- every commander has one, and they are all different ----
    const moves = await page.evaluate(() => {
      const g = BOSS_POOL.map(b => b.grudge);
      return { count: g.filter(Boolean).length, total: BOSS_POOL.length,
               named: g.filter(Boolean).every(x => x.cry && x.name && x.tell),
               names: new Set(g.filter(Boolean).map(x => x.name)).size,
               // a grudge move that only changes numbers is an enrage with a new label
               inert: BOSS_POOL.filter(b => b.grudge && Object.keys(b.grudge)
                 .every(k => ['cry', 'name', 'tell', 'armorBonus', 'dmgScale', 'speedBonus'].includes(k))).map(b => b.id) };
    });
    ok(`all ${moves.total} commanders carry a grudge move`, moves.count === moves.total);
    ok('each named, each with a line telling you what it does', moves.named);
    ok('and no two the same', moves.names === moves.count);
    ok('none of them is a stat bump wearing a name', moves.inert.length === 0);

    // ---- it opens where it should, and nowhere else ----
    const gate = await page.evaluate(() => {
      const at = (g, phase, share) => {
        const boss = window.__stage('WARLORD', g);
        boss.phase = phase; boss.hp = Math.max(1, Math.floor(boss.maxHp * share));
        const before = boss.phase;
        executeEnemyAi(boss);
        return { from: before, to: boss.phase, debt: boss.bloodDebt || 0 };
      };
      return {
        firstMeeting: at(0, 2, 0.1),      // never met you: no third gear at any health
        beforeEnrage: at(2, 1, 0.1),      // phase 1 is the ordinary enrage's job
        tooHealthy:   at(2, 2, 0.9),
        opens:        at(2, 2, 0.2),
        at: GRUDGE.phaseAt
      };
    });
    ok('a commander that has never lost to you has no third phase', gate.firstMeeting.to !== 3);
    ok('it does not skip the enrage to get there', gate.beforeEnrage.to !== 3);
    ok(`nor open above ${Math.round(gate.at * 100)}% health`, gate.tooHealthy.to !== 3);
    ok('and under that, on a commander that remembers you, it opens', gate.opens.to === 3 && gate.opens.debt > 0);

    // ---- each move does its own thing ----
    const effects = await page.evaluate(() => {
      const fire = id => {
        const boss = window.__stage(id, 2);
        const foesBefore = activeEntities.filter(e => !e.isPlayer).length;
        const armorBefore = boss.armor, wardBefore = boss.wardId, escortBefore = boss.escortId;
        boss.phase = 2; boss.hp = Math.floor(boss.maxHp * 0.2);
        openGrudgePhase(boss);
        return { newFoes: activeEntities.filter(e => !e.isPlayer).length - foesBefore,
                 armorUp: boss.armor - armorBefore,
                 debt: boss.bloodDebt || 0, charge: !!boss.chargeSpec, lays: !!boss.spawnSpec,
                 aura: !!boss.aura, sky: boss.skyToll || 0, storm: boss.stormTurn || 0,
                 venom: boss.venomStacks || 0,
                 ward: !!boss.wardId && boss.wardId !== wardBefore,
                 escort: !!boss.escortId && boss.escortId !== escortBefore };
      };
      return { warlord: fire('WARLORD'), colossus: fire('COLOSSUS'), matriarch: fire('MATRIARCH'),
               vatborn: fire('VATBORN'), marshal: fire('MARSHAL'),
               storm: fire('STORMCALLER'), bastion: fire('BASTION') };
    });
    ok('the Warlord starts charging you for its own dead', effects.warlord.debt > 0);
    ok('the Colossus starts winding its salvoes up', effects.colossus.charge);
    ok('the Matriarch starts laying', effects.matriarch.lays);
    ok('the Vatborn opens the tank all the way and vents', effects.vatborn.venom > 0 && effects.vatborn.aura);
    ok('the Marshal brings a second hound and the plate goes back up',
      effects.marshal.escort && effects.marshal.newFoes === 1 && effects.marshal.armorUp > 0);
    ok('the Stormcaller stops waiting for the sky', effects.storm.storm === 1 && effects.storm.sky > 0);
    ok('the Bastion had a spare generator', effects.bastion.ward && effects.bastion.newFoes === 1);

    // ---- the ones that run on a clock actually run ----
    const clocks = await page.evaluate(() => {
      const drive = (id, turns) => {
        const boss = window.__stage(id, 2);
        // The squad has to outlast the measurement. A commander this deep can wipe it on its
        // first turn, and a wipe stands combat down - after which every later turn is a no-op
        // and this counts nothing while looking like it counted a mechanic.
        activeEntities.filter(e => e.isPlayer).forEach(e => { e.maxHp = 999999; e.hp = 999999; });
        boss.phase = 2; boss.hp = Math.floor(boss.maxHp * 0.2);
        openGrudgePhase(boss);
        const foes0 = activeEntities.filter(e => !e.isPlayer).length;
        const squad0 = activeEntities.filter(e => e.isPlayer && e.hp > 0).map(e => e.hp);
        for (let i = 0; i < turns; i++) {
          boss.hp = Math.floor(boss.maxHp * 0.2); combatActive = true; executeEnemyAi(boss);
        }
        return { foes: activeEntities.filter(e => !e.isPlayer).length - foes0,
                 hurt: activeEntities.filter(e => e.isPlayer).some((e, i) => e.hp < (squad0[i] ?? Infinity)) };
      };
      return { matriarch: drive('MATRIARCH', 4), vatborn: drive('VATBORN', 2), storm: drive('STORMCALLER', 2),
               every: BOSS_POOL.find(b => b.id === 'MATRIARCH').grudge.spawn.every };
    });
    ok(`the Matriarch lays on her own clock, one every ${clocks.every} turns (+${clocks.matriarch.foes} over four)`,
      clocks.matriarch.foes === Math.floor(4 / clocks.every));
    ok('the Vatborn’s vents cost the front rank health', clocks.vatborn.hurt);
    ok('and the broken sky costs the whole squad', clocks.storm.hurt);

    // Blood Debt is the one that fires on somebody else's death rather than on a clock.
    const debt = await page.evaluate(() => {
      const boss = window.__stage('WARLORD', 2);
      boss.phase = 2; boss.hp = Math.floor(boss.maxHp * 0.2);
      openGrudgePhase(boss);
      // give it a pack member to lose
      const pack = { id: 'pack1', name: 'War Hound', classType: 'BEAST', isPlayer: false, range: 'melee',
                     maxHp: 20, hp: 20, speed: 10, armor: 0, baseArmor: 0, dmgBase: 5, img: 'enemy_dog.webp',
                     scale: 0.8, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0,
                     oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 } };
      activeEntities.push(pack);
      const hero = activeEntities.find(e => e.isPlayer && e.hp > 0);
      const was = boss.hp;
      applyDamageHit(hero, pack, 9999, 'phys', 'BASIC');
      return { was, now: boss.hp, dead: pack.hp <= 0 };
    });
    ok(`killing its pack feeds it (${debt.was} → ${debt.now})`, debt.dead && debt.now > debt.was);

    // ---- and you can see it coming ----
    const seen = await page.evaluate(() => {
      const boss = BOSS_POOL[0];
      grudges = {}; grudges[boss.id] = 2;
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      bossSalt = window.__PIN; grudges = {}; grudges[boss.id] = 2;
      currentSector = window.__sectorOf(boss.id); currentTier = TOTAL_TIERS;
      sectorMap = generateSectorMap(seededRng('grudge')); clearedNodeIds = []; currentNodeId = null;
      renderMap();
      const node = [...document.querySelectorAll('.map-node')]
        .find(b => b.innerText.includes('†'));
      grudges = {};
      renderMap();
      const cold = [...document.querySelectorAll('.map-node')].some(b => b.innerText.includes('†'));
      return { marked: !!node, label: node ? node.innerText.replace(/\n/g, ' ').trim() : null,
               coldMarked: cold, prompt: PROMPTS.some(p => p.id === 'GRUDGE') };
    });
    ok(`the map marks a re-match before you take the node (${seen.label})`, seen.marked);
    ok('and does not mark a commander you have never met', !seen.coldMarked);
    ok('with a prompt explaining the rule the first time', seen.prompt);

    const door = await page.evaluate(() => {
      const read = g => {
        const boss = window.__stage('MARSHAL', g);
        return document.getElementById('log').innerText;
      };
      const cold = read(0), hot = read(2);
      return { cold, hot, spec: BOSS_POOL.find(b => b.id === 'MARSHAL').grudge };
    });
    ok('the fight log names the grudge move at the door, so it can be planned around',
      door.hot.includes(door.spec.name) && !door.cold.includes(door.spec.name));
    ok('and says how many times you have done this', /put this one down/i.test(door.hot));

    // A commander is the one node you can neither withdraw from nor fall back out of, so a
    // risen one is a gate. It has to be worth walking into rather than only more expensive.
    const paid = await page.evaluate(() => {
      const take = g => {
        const boss = window.__stage('WARLORD', g);
        bossSkulls = 0;
        activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
        checkWinState();
        return bossSkulls;
      };
      return { cold: take(0), one: take(1), three: take(3),
               noExit: !canWithdraw() };
    });
    ok('a commander cannot be walked away from', paid.noExit);
    ok(`so felling a risen one pays for it (${paid.cold} / ${paid.one} / ${paid.three} skulls)`,
      paid.one === paid.cold + 1 && paid.three === paid.cold + 3);

    // ---- every commander says what it does, while you are in the fight ----
    // Four of the seven used to show no tag at all. Three of those had a mechanic that was the
    // whole shape of the fight and no line on the card saying so.
    const passives = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const missing = BOSS_POOL.filter(b => !b.passive).map(b => b.id);
      const undeclared = BOSS_POOL.filter(b => b.passive && !BOSS_PASSIVES[b.passive]).map(b => b.id);
      const vague = Object.entries(BOSS_PASSIVES).filter(([, v]) => !v.name || !v.desc || v.desc.length < 40).map(([k]) => k);
      // A passive that claims a mechanic nothing implements is a tag that lies. Backed means
      // one of three things: the engine branches on it by name, it reports live state, or the
      // commanders carrying it declare the data field it runs on (the Vatborn's `venom`).
      const inert = Object.keys(BOSS_PASSIVES).filter(k => {
        if (src.includes(`bossPassive === '${k}'`)) return false;
        if (BOSS_PASSIVES[k].state) return false;
        const carriers = BOSS_POOL.filter(b => b.passive === k);
        return !(carriers.length && carriers.every(b => b[k.toLowerCase()] !== undefined));
      });
      return { total: BOSS_POOL.length, declared: Object.keys(BOSS_PASSIVES).length,
               missing, undeclared, vague, inert,
               used: new Set(BOSS_POOL.map(b => b.passive)).size };
    });
    ok(`all ${passives.total} commanders declare a passive`, passives.missing.length === 0);
    ok('each one a real entry in the table', passives.undeclared.length === 0);
    ok('no two share one, so the tag identifies the fight', passives.used === passives.total);
    ok('each named and explained', passives.vague.length === 0);
    ok('and none of them describes a mechanic nothing implements', passives.inert.length === 0);
    if (passives.inert.length) console.log('        inert:', passives.inert.join(', '));

    // A tag that goes on claiming a ward that is down is worse than no tag at all.
    const live = await page.evaluate(() => {
      const read = id => {
        const boss = window.__stage(id, 0);
        const tagOf = () => { renderField(); const el = document.getElementById(boss.id);
          const t = el && el.querySelector('.sig-tag, .boss-tag, [class*="tag"]');
          return t ? t.innerText.trim() : (el ? el.innerText : ''); };
        const up = tagOf();
        activeEntities.filter(e => !e.isPlayer && e.id !== boss.id).forEach(e => { e.hp = 0; });
        const down = tagOf();
        return { up, down, name: BOSS_PASSIVES[boss.bossPassive].name.toUpperCase() };
      };
      return { marshal: read('MARSHAL'), bastion: read('BASTION'), warlord: read('WARLORD') };
    });
    ok(`the Marshal's card says whether the hound still stands (${live.marshal.up.includes('HOUND UP') ? 'HOUND UP' : '?'})`,
      live.marshal.up.includes('HOUND UP') && live.marshal.down.includes('ALONE'));
    ok(`and the Bastion's whether the ward does (${live.bastion.up.includes('WARD UP') ? 'WARD UP' : '?'})`,
      live.bastion.up.includes('WARD UP') && live.bastion.down.includes('WARD DOWN'));
    ok('a commander with nothing to lose reports no state at all',
      live.warlord.up.includes(live.warlord.name) && live.warlord.up === live.warlord.down);

    // The Warlord's is the one that is genuinely new, so it has to actually happen.
    const bleeds = await page.evaluate(() => {
      const boss = window.__stage('WARLORD', 0);
      const hero = activeEntities.find(e => e.isPlayer && e.hp > 0);
      hero.maxHp = 99999; hero.hp = 99999; hero.bleedingTurns = 0;
      applyDamageHit(boss, hero, 40, 'phys', 'BASIC');
      const after = hero.bleedingTurns;
      // and a commander without it does not
      const other = window.__stage('BASTION', 0);
      const h2 = activeEntities.find(e => e.isPlayer && e.hp > 0);
      h2.maxHp = 99999; h2.hp = 99999; h2.bleedingTurns = 0;
      applyDamageHit(other, h2, 40, 'phys', 'BASIC');
      return { warlord: after, bastion: h2.bleedingTurns };
    });
    ok(`the Warlord opens a wound with every blow (${bleeds.warlord} turns)`, bleeds.warlord === 2);
    ok('and a commander without the passive does not', bleeds.bastion === 0);

    // ---- a new expedition does not wipe the ledger ----
    const kept = await page.evaluate(() => {
      grudges = {}; noteGrudge('BASTION');
      buildNewRun(1.0);
      return { after: grudgeOn('BASTION') };
    });
    ok('starting a fresh expedition does not forgive anything', kept.after === 1);
  }
};

// F09. Seven places where the banner said one thing and the resolver did another. Each is
// closed the same way - the resolver made to do what the text says - and each assertion below
// is driven at the resolver rather than at the helper it reads, which is the E03 lesson and
// the reason the bayonet half of this went unnoticed: isMelee agrees with the manual, and the
// manual was never the thing that was wrong.
//
//  1. HEADSHOT: "execute one target outright" passed target.maxHp through mitigate, so an
//     armoured, resistant non-commander kept armour-plus-resistance of its bar - exactly the
//     targets an overdrive is spent on. It pierces now; a commander is the stated exception.
//  2. ION STORM: "cooldowns a turn shorter" reaches only cooldowns priced through cdFor, and
//     eleven moves set theirs directly - all three self-actions and most of the classic deck.
//  3. A bond partner steps in front of a blow and the log says so, while the tap-to-explain
//     card beside it still named the operator the blow was meant for.
//  4. A bayoneted Pipe Rifle was melee for reach, Rotor Lift and ground, and ranged for the
//     relic hooks: Rangefinder's bonus and Hungry Blade's penalty, and never Whetstone's.
//  5. HARSH_SKIES kept its "never clear" promise by re-rolling inside initiateCombat, which
//     broke the forecast contract - the node showed CLEAR and the fight was not.
//  6. VAMPIRIC says "heals 2 on every hit they land" and sat in the aimed-swing branch, so
//     splash, follow-ups and every overdrive paid nothing.
//  7. The opening fight is plain by a rule keyed on tier 1, and Road Crew opens the run on
//     tier 2 - so the upgrade bought you the dressed first fight the rule forbids.
module.exports = {
  name: 'Every banner keeps its promise',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__fight = () => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        initiateCombat('RAIDERS', false);
      };
      window.__me = cls => {
        const e = activeEntities.find(x => x.isPlayer);
        if (cls) e.classType = cls;
        turnQueue = [e]; activeIndex = 0;
        e.cooldowns = e.cooldowns || {};
        return e;
      };
      window.__foe = () => activeEntities.find(e => !e.isPlayer && e.hp > 0);
    });

    // ── 1. HEADSHOT executes ────────────────────────────────────────────────────────
    const head = await page.evaluate(() => {
      const run = boss => {
        window.__fight();
        const me = window.__me('SNIPER');
        const foe = window.__foe();
        foe.classType = boss ? 'BOSS' : 'MECH';
        foe.maxHp = 300; foe.hp = 300; foe.armor = 40;
        foe.resistances = { phys: 50, bio: 0, energy: 0 };
        me.dmgBase = 10;
        const kills = runStats.kills || 0;
        odChoices = {}; odChoices.SNIPER = 'HEADSHOT'; momentum = 100;
        queueAction('OVERDRIVE', 'HEADSHOT'); resolveAction(foe.id);
        return { hp: foe.hp, killed: (runStats.kills || 0) - kills };
      };
      return { plain: run(false), boss: run(true),
               desc: OVERDRIVES.SNIPER.find(o => o.id === 'HEADSHOT').desc };
    });
    ok(`the banner says outright (${head.desc})`, /outright/.test(head.desc));
    ok(`and an armoured, resistant target dies outright (${head.plain.hp} hp left)`, head.plain.hp <= 0);
    ok(`with the kill on the ledger rather than around it (${head.plain.killed})`, head.plain.killed === 1);
    ok(`while a commander takes the stated 4x through armour, not an execute (${head.boss.hp} of 300)`,
      head.boss.hp > 0);

    // ── 2. ION STORM shortens every cooldown, not a third of them ───────────────────
    const ion = await page.evaluate(() => {
      const MOVES = ['FLASHBANG', 'FERAL_BITE', 'DEADEYE', 'BUCKSHOT', 'ACID_FLASK',
                     'THERMITE', 'EXECUTE_SHOT', 'MOLOTOV'];
      const SELF = ['IRON_GUARD', 'OVER_THE_TOP', 'PURGE_VALVE'];
      const key = m => m.toLowerCase();
      const under = wx => {
        const out = {};
        MOVES.forEach(m => {
          window.__fight();
          const me = window.__me(); const foe = window.__foe();
          foe.maxHp = 9999; foe.hp = 9999;
          currentWeather = wx;
          queueAction(m); resolveAction(foe.id);
          out[m] = me.cooldowns[key(m)];
        });
        SELF.forEach(m => {
          window.__fight();
          const me = window.__me();
          currentWeather = wx;
          executeSelfAction(m);
          out[m] = me.cooldowns[key(m)];
        });
        return out;
      };
      const clear = under('CLEAR'); const storm = under('ION_STORM');
      const all = MOVES.concat(SELF);
      const shorter = all.filter(m => storm[m] === clear[m] - 1);
      const unset = all.filter(m => clear[m] === undefined || storm[m] === undefined);
      return { all, clear, storm, shorter, unset, banner: WEATHER.ION_STORM.banner };
    });
    ok(`the banner promises a shorter cooldown (${ion.banner})`, /cooldowns a turn shorter/.test(ion.banner));
    ok(`every move it names actually set one (${ion.unset.length} unset)`, ion.unset.length === 0);
    ok(`and every one of them is a turn shorter under the storm (${ion.shorter.length} of ${ion.all.length})`,
      ion.shorter.length === ion.all.length);

    // ── 3. the card names whoever took the blow ─────────────────────────────────────
    const bond = await page.evaluate(() => {
      window.__fight();
      const line = activeEntities.filter(e => e.isPlayer);
      const a = line[0], b = line[1];
      bonds = {}; bonds[bondKey(a.id, b.id)] = 99;
      bondSavesUsed = new Set();
      a.hp = 1; b.hp = 300; b.maxHp = 300;
      const foe = window.__foe();
      const saver = bondSavior(a);
      applyDamageHit(foe, a, 50, 'phys', null);
      const filed = hitLog[hitLog.length - 1];
      const log = document.getElementById('log').innerText;
      return { saver: saver ? saver.name : null, meant: a.name,
               filedTarget: filed ? filed.target : null,
               said: new RegExp(`steps in front of the blow meant for ${a.name}`).test(log),
               aHp: a.hp, bHp: b.hp };
    });
    ok(`a partner steps in front of the blow (${bond.saver} for ${bond.meant})`,
      bond.aHp === 1 && bond.bHp < 300 && bond.said === true);
    ok(`and the card explaining the number names who took it (${bond.filedTarget})`,
      bond.filedTarget === bond.saver);

    // ── 4. a bayoneted rifle is one weapon ──────────────────────────────────────────
    const bay = await page.evaluate(() => {
      // The swing rolls, so the roll is pinned: without this the relic multipliers sit under
      // a spread wider than they are and the comparison measures the dice.
      const realRandom = Math.random;
      Math.random = () => 0.5;
      const swing = (relic, bayonet) => {
        window.__fight();
        const me = window.__me('SCAVENGER');
        me.gridPos = 1; me.dmgBase = 1000; me.weaponMod = bayonet ? 'BAYONET' : null;
        me.quirk = null; me.traits = [];
        // hasRelic reads r.id, so a relic is its row from the pool, not its name.
        activeRelics = relic ? [RELIC_POOL.find(r => r.id === relic)] : [];
        currentWeather = 'CLEAR'; currentTerrain = 'OPEN_ROAD';
        const foe = window.__foe();
        foe.maxHp = 10000000; foe.hp = 10000000; foe.armor = 0;
        foe.resistances = { phys: 0, bio: 0, energy: 0 };
        foe.sig = null;
        queueAction('PIPE_RIFLE'); resolveAction(foe.id);
        activeRelics = [];
        return 10000000 - foe.hp;
      };
      const out = { reach: moveReachFor('PIPE_RIFLE', { isPlayer: true, weaponMod: 'BAYONET' }),
                    bayoBase: swing(null, true), bayoWhet: swing('WHETSTONE', true),
                    bayoRange: swing('RANGEFINDER', true), bayoHungry: swing('HUNGRY_BLADE', true),
                    base: swing(null, false), whet: swing('WHETSTONE', false),
                    range: swing('RANGEFINDER', false), hungry: swing('HUNGRY_BLADE', false) };
      Math.random = realRandom;
      return out;
    });
    ok(`a bayoneted rifle swings as melee (${bay.reach})`, bay.reach === 'melee');
    ok(`so Whetstone pays on it (${bay.bayoBase} -> ${bay.bayoWhet})`, bay.bayoWhet > bay.bayoBase);
    ok(`Rangefinder does not (${bay.bayoBase} -> ${bay.bayoRange})`, bay.bayoRange === bay.bayoBase);
    ok(`and Hungry Blade takes nothing off it (${bay.bayoBase} -> ${bay.bayoHungry})`,
      bay.bayoHungry === bay.bayoBase);
    ok(`while a plain rifle is ranged: Rangefinder pays (${bay.base} -> ${bay.range})`,
      bay.range > bay.base);
    ok(`Whetstone does not (${bay.base} -> ${bay.whet})`, bay.whet === bay.base);
    ok(`and Hungry Blade still costs it (${bay.base} -> ${bay.hungry})`, bay.hungry < bay.base);

    // ── 5. HARSH SKIES is a forecast ────────────────────────────────────────────────
    const skies = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      activeContracts = ['HARSH_SKIES']; currentSector = 2;
      sectorMap = generateSectorMap(); clearedNodeIds = [];
      const fights = sectorMap.nodes.filter(n => FIGHT_NODES.includes(n.type));
      const clear = fights.filter(n => (n.weather || 'CLEAR') === 'CLEAR');
      // And what the node shows is what the fight gets.
      const node = fights[0];
      enterNode(node.id);
      const shown = forecastWeather;
      initiateCombat(node.type, false);
      // The contract outranks the opening fight's calm, and always has - only the sky, though.
      currentSector = 1; metaUpgrades.roadCrew = false;
      sectorMap = generateSectorMap();
      const open = sectorMap.nodes.filter(n => n.tier === openingTier() && FIGHT_NODES.includes(n.type));
      const openDressed = open.filter(n => (n.weather || 'CLEAR') !== 'CLEAR').length;
      const openPlain = open.filter(n => !n.formation && (!n.terrain || n.terrain === 'OPEN_ROAD')).length;
      activeContracts = [];
      return { fights: fights.length, clear: clear.length, shown, got: currentWeather,
               open: open.length, openDressed, openPlain };
    });
    ok(`with HARSH SKIES every fight node carries weather (${skies.clear} clear of ${skies.fights})`,
      skies.fights > 0 && skies.clear === 0);
    ok(`and the node shows the sky its fight gets (${skies.shown} -> ${skies.got})`,
      skies.shown === skies.got);
    ok(`the signed contract outranks the opening fight's calm (${skies.openDressed} of ${skies.open})`,
      skies.open > 0 && skies.openDressed === skies.open);
    ok(`but only the sky - its ground and its formation stay plain (${skies.openPlain} of ${skies.open})`,
      skies.openPlain === skies.open);

    // A map dealt before the contract was signed still has CLEAR nodes on it, and that is the
    // case the whole promise turns on: what the node SHOWS is what the fight gets, even when a
    // contract would otherwise have rolled something over the top of it.
    const kept = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      activeContracts = []; currentSector = 2;
      sectorMap = generateSectorMap(); clearedNodeIds = [];
      const node = sectorMap.nodes.find(n => FIGHT_NODES.includes(n.type));
      node.weather = 'CLEAR';
      activeContracts = ['HARSH_SKIES'];       // signed after the map was dealt
      enterNode(node.id);
      const shown = forecastWeather;
      initiateCombat(node.type, false);
      const got = currentWeather;
      // And with no node behind the fight there is nothing that could have been dressed, so the
      // contract is still honoured - which is the path the dev tools and the older suites take.
      forecastWeather = null; currentSector = 2; currentTier = 4;
      initiateCombat('RAIDERS', false);
      const staged = currentWeather;
      activeContracts = [];
      return { shown, got, staged };
    });
    ok(`a node that shows CLEAR is fought under CLEAR, contract or no (${kept.shown} -> ${kept.got})`,
      kept.shown === 'CLEAR' && kept.got === 'CLEAR');
    ok(`while a fight with no node behind it still honours the contract (${kept.staged})`,
      kept.staged !== 'CLEAR');

    // ── 6. VAMPIRIC heals on every hit ──────────────────────────────────────────────
    const vamp = await page.evaluate(() => {
      window.__fight();
      const me = window.__me();
      me.quirk = { id: 'VAMPIRIC' }; me.maxHp = 300; me.hp = 100;
      const foe = window.__foe();
      foe.maxHp = 9999; foe.hp = 9999;
      const before = me.hp;
      applyDamageHit(me, foe, 20, 'phys', null);
      const aimed = me.hp - before;
      // A second, separate blow - the splash half of an area move is exactly this call.
      const mid = me.hp;
      applyDamageHit(me, foe, 20, 'phys', null);
      const splash = me.hp - mid;
      // A hit that lands nothing pays nothing.
      const full = me.hp; me.hp = me.maxHp;
      applyDamageHit(me, foe, 20, 'phys', null);
      const atFull = me.hp - me.maxHp;
      return { aimed, splash, atFull, desc: QUIRK_POOL.find(q => q.id === 'VAMPIRIC').desc };
    });
    ok(`the quirk says every hit (${vamp.desc})`, /every hit/.test(vamp.desc));
    ok(`the aimed swing pays (${vamp.aimed})`, vamp.aimed === 2);
    ok(`and so does the next blow, which is what splash is (${vamp.splash})`, vamp.splash === 2);
    ok('and a full bar is not overfilled', vamp.atFull === 0);

    // ── 7. the opening fight is plain wherever the run opens ────────────────────────
    const road = await page.evaluate(() => {
      const survey = roadCrew => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        activeContracts = []; metaUpgrades.roadCrew = roadCrew; currentSector = 1;
        let dressed = 0, total = 0;
        for (let i = 0; i < 40; i++) {
          const m = generateSectorMap();
          m.nodes.filter(n => n.tier === openingTier() && FIGHT_NODES.includes(n.type))
            .forEach(n => {
              total++;
              if ((n.weather && n.weather !== 'CLEAR') || (n.terrain && n.terrain !== 'OPEN_ROAD') || n.formation) dressed++;
            });
        }
        return { tier: openingTier(), dressed, total };
      };
      const off = survey(false); const on = survey(true);
      metaUpgrades.roadCrew = false;
      return { off, on };
    });
    ok(`without Road Crew the run opens on tier ${road.off.tier} and it is plain (${road.off.dressed} of ${road.off.total})`,
      road.off.tier === 1 && road.off.total > 0 && road.off.dressed === 0);
    ok(`with it the run opens on tier ${road.on.tier}, and that one is plain too (${road.on.dressed} of ${road.on.total})`,
      road.on.tier === 2 && road.on.total > 0 && road.on.dressed === 0);
  }
};

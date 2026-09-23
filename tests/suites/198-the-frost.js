// Y05. Nothing in the game was cold. The sixth faction is a garrison that went into cold storage
// to wait out the war and has been waking up a few at a time ever since, and the region it holds
// opens at sector 3: its own sky, the first that is not fair, and its own ground, the first
// frozen one. Every one of its hostiles asks the same question - can you end it before the cold
// does - on a different instrument: rime that sets on a body every turn it is left standing, a
// turn taken off the squad's hardest hitter, a toll on every operator for as long as the heavy
// stands, and a countdown to shells on the whole line. Heat answers all four.
//
// Its commander's retinue has not woken up yet: two pods on their own counts, which the squad can
// break first, ignore, or leave to go dark by felling the thing keeping them cold. It is staged by
// hand below, because a commander only joins the road once its own portrait and arena have landed
// (suite 16's rule) - and one row holds exactly that.
//
// Every piece of art is commissioned and none has landed, so these rows also hold the stand-ins -
// that a pending portrait is replaced before it is ever requested, that a pending home picture
// falls back to the open road rather than to nothing, and that delivering a file is the whole of
// what it takes to go live. Three rows read the disk and the manual rather than the tables, for
// the reason 196 gives: a table checked against itself passes on a table that is wrong.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const FROST_ART = ['enemy_frost_trooper.webp', 'enemy_frost_gunner.webp', 'enemy_frost_hauler.webp',
  'enemy_frost_signaller.webp', 'enemy_boss_commandant.webp', 'enemy_frost_pod.webp',
  'bg_icefield.webp', 'bg_cryovault.webp', 'bg_blastdoor.webp'];

module.exports = {
  name: 'The Frost',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // A fight to stand things in: the squad bare, the field replaced with whatever a row builds,
    // and nothing in the sky or underfoot unless the row puts it there.
    await page.evaluate(() => {
      window.__y05 = {
        fight: (sector = 3, tier = 8) => {
          localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
          activeContracts = []; currentSector = sector; currentTier = tier;
          initiateCombat('RAIDERS', false);
          const heroes = playerRoster.filter(p => p.gridPos > 0);
          heroes.forEach(h => { __bare(h); h.maxHp = h.hp = 500; h.stunnedTurns = 0; });
          activeRelics = []; currentWeather = 'CLEAR'; currentTerrain = 'OPEN_ROAD';
          return heroes;
        },
        mk: (name, id, extra) => {
          const u = unitByName('FROST', name);
          return Object.assign(JSON.parse(JSON.stringify(u)),
            { id, hp: 200, maxHp: 200, isPlayer: false, sigCd: 0, baseArmor: u.armor || 0, rime: 0 }, extra || {});
        }
      };
    });

    // ---- the faction and the region ----
    const table = await page.evaluate(() => {
      const f = FACTIONS.FROST;
      return {
        f: { bg: f.bg, weather: f.weather, ground: f.ground, minSector: f.minSector, places: f.places },
        at2: factionsAt(2).includes('FROST'), at3: factionsAt(3).includes('FROST'),
        firstNorth: effTierAt(1, 3),
        units: ENEMY_POOL.FROST.map(u => ({ n: u.name, sig: u.sig, known: !!ENEMY_SIGS[u.sig], min: u.minTier,
          energy: u.resistances.energy, bio: u.resistances.bio })),
        forms: FORMATIONS.FROST.map(x => ({ id: x.id, min: x.minTier,
          need: Math.max(...x.units.map(n => (unitByName('FROST', n) || { minTier: 999 }).minTier)) })),
        formErrors: typeof validateFormations === 'function' ? validateFormations() : null
      };
    });
    ok(`the Frost fight on the ice and in their vault, under their own snow (${table.f.ground.join('/')}, ${table.f.weather})`,
      table.f.ground[0] === 'ICE' && table.f.ground[1] === 'TUNNELS' && table.f.weather === 'BLIZZARD'
      && table.f.bg === 'bg_icefield.webp' && table.f.places.TUNNELS === 'bg_cryovault.webp');
    ok('and the roads only turn north from sector 3', !table.at2 && table.at3 && table.f.minSector === 3);
    ok(`four hostiles, each carrying a signature the game knows (${table.units.map(u => u.sig).join(', ')})`,
      table.units.length === 4 && table.units.every(u => u.known));
    ok(`none of them unlocks before the roads turn north (earliest ${Math.min(...table.units.map(u => u.min))}, sector 3 opens at ${table.firstNorth})`,
      table.units.every(u => u.min >= table.firstNorth));
    ok('every one of them weak to heat and hard to poison',
      table.units.every(u => u.energy < 0 && u.bio > 0));
    ok(`four formations, none offered before every unit in it has unlocked (${table.forms.map(x => x.id).join(', ')})`,
      table.forms.length === 4 && table.forms.every(x => x.min >= x.need));

    // ---- the draw: sector 2 as it was, sector 3 with the Frost, and the other five scaled ----
    const draw = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0);
      const share = sector => {
        currentSector = sector; sectorFront = null;
        const rng = mulberry32(seedFromString(`y05|draw|${sector}`)); const c = {}; const n = 20000;
        for (let i = 0; i < n; i++) { const k = rollNodeFaction(5, rng); c[k] = (c[k] || 0) + 1; }
        return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v / n]));
      };
      const s2 = share(2), s3 = share(3);
      // and whole maps, the way a player meets them: which ground a Frost node stands on
      currentSector = 3; const grounds = {}; let frost = 0, fights = 0; const skies = new Set();
      for (let m = 0; m < 200; m++) {
        sectorFront = null;
        generateSectorMap(mulberry32(seedFromString(`y05|map|${m}`))).nodes.forEach(n => {
          if (FIGHT_NODES.includes(n.type)) fights++;
          if (n.type !== 'FROST') return;
          frost++; grounds[n.terrain || 'OPEN_ROAD'] = (grounds[n.terrain || 'OPEN_ROAD'] || 0) + 1;
          skies.add(n.weather || 'CLEAR');
        });
      }
      return { s2, s3, frost, fights, grounds, skies: [...skies] };
    });
    const pct = x => `${(100 * (x || 0)).toFixed(1)}%`;
    ok(`sector 2 is the five-way split it always was (Frost ${pct(draw.s2.FROST)}, Choir ${pct(draw.s2.CHOIR)}, Carrion ${pct(draw.s2.CARRION)})`,
      !draw.s2.FROST && draw.s2.CHOIR > 0.15 && draw.s2.CHOIR < 0.17 && draw.s2.CARRION > 0.13 && draw.s2.CARRION < 0.15);
    ok(`from sector 3 the Frost take about an eighth of the roads (${pct(draw.s3.FROST)})`,
      draw.s3.FROST > 0.12 && draw.s3.FROST < 0.14);
    const ratios = ['RAIDERS', 'BEASTS', 'MECH', 'CHOIR', 'CARRION'].map(k => draw.s3[k] / draw.s2[k]);
    ok(`and the other five give it up in proportion (${ratios.map(r => r.toFixed(2)).join(', ')})`,
      ratios.every(r => r > 0.80 && r < 0.95));
    const onIce = (draw.grounds.ICE || 0) / Math.max(1, draw.frost - (draw.grounds.OPEN_ROAD || 0));
    ok(`on generated maps a Frost node stands on the ice or in the vault, mostly the ice (${draw.frost} of ${draw.fights} fights, ${pct(onIce)} on ice)`,
      draw.frost > 0 && Object.keys(draw.grounds).every(g => ['ICE', 'TUNNELS', 'OPEN_ROAD'].includes(g))
      && onIce > 0.65 && onIce < 0.85);
    ok(`and under the snow or nothing (${draw.skies.join(', ')})`, draw.skies.every(s => ['BLIZZARD', 'CLEAR'].includes(s)));

    // ---- rime ----
    const rime = await page.evaluate(() => {
      const heroes = __y05.fight(); const hero = heroes[0];
      const t = __y05.mk('Frost Trooper', 'ft1');
      activeEntities = [...heroes, t]; turnQueue = [...activeEntities]; combatActive = true;
      const steps = [];
      for (let i = 0; i < 6; i++) { applyTurnStartEffects(t); steps.push(t.rime || 0); }
      const bare = __y05.mk('Frost Trooper', 'ft2'), rimed = __y05.mk('Frost Trooper', 'ft3', { rime: 9 });
      const a = mitigate(hero, bare, 60, 'phys', 'PISTOL').n, b = mitigate(hero, rimed, 60, 'phys', 'PISTOL').n;
      rimed.corrodedTurns = 2; const c = mitigate(hero, rimed, 60, 'phys', 'PISTOL').n; rimed.corrodedTurns = 0;
      const braced = __y05.mk('Frost Trooper', 'ft4', { rime: 6, armorTurns: 1 }); braced.armor = braced.baseArmor + 15;
      const s1 = __y05.mk('Frost Trooper', 'ft5', { rime: 9 }), s2 = __y05.mk('Frost Trooper', 'ft6', { rime: 9 }),
            s3 = __y05.mk('Frost Trooper', 'ft7', { rime: 9 });
      activeEntities.push(braced, s1, s2, s3);
      applyTurnStartEffects(braced);
      applyDamageHit(hero, s1, 12, 'energy', 'FLARE_GUN');
      applyDamageHit(hero, s2, Math.floor(s2.maxHp * RIME.shatter) - 2, 'phys', 'PISTOL');
      applyDamageHit(hero, s3, Math.ceil(s3.maxHp * RIME.shatter) + 1, 'phys', 'PISTOL');
      renderField();
      const tag = (document.querySelector(`#${t.id} .sig-tag`) || {}).innerText || '';
      combatActive = false;
      return { steps, step: plate(RIME.step), cap: plate(RIME.cap), a, b, c, tag, rimeNow: t.rime,
               brace: { armor: braced.armor, base: braced.baseArmor, rime: braced.rime }, s1: s1.rime, s2: s2.rime, s3: s3.rime };
    });
    ok(`rime sets a step at a time on the Trooper's own turns (${rime.steps.join(', ')})`,
      rime.steps.every((r, i) => r === Math.min((i + 1) * rime.step, rime.cap)));
    ok(`and stops at its limit (${rime.cap})`, rime.steps[5] === rime.cap && rime.steps[4] === rime.cap);
    ok(`it is armour: the same blow lands ${rime.a - rime.b} less through 9 rime`, rime.a - rime.b === 9);
    ok(`corrosion takes it off with the rest of the plating (${rime.c} through, against ${rime.b})`, rime.c > rime.a && rime.c > rime.b);
    // Exactly one step on from the 6 it wore: the same turn start that ends the brace grows the
    // rime, so a brace that wiped it would still read 6 - one step from nothing.
    ok(`a brace running out puts the armour back and leaves the rime alone (armour ${rime.brace.armor}/${rime.brace.base}, rime 6 -> ${rime.brace.rime})`,
      rime.brace.armor === rime.brace.base && rime.brace.rime === Math.min(6 + rime.step, rime.cap));
    ok('any fire shatters it, however small the blow', rime.s1 === 0);
    ok('a blow under a quarter of the body\'s health does not', rime.s2 === 9);
    ok('and one over it does', rime.s3 === 0);
    ok(`the card carries the live figure (${rime.tag})`, rime.tag.includes(String(rime.rimeNow)) && /RIME/.test(rime.tag));

    // ---- a turn taken off the hardest hitter ----
    const freeze = await page.evaluate(() => {
      const heroes = __y05.fight();
      heroes[0].dmgBase = 10; heroes[1].dmgBase = 30; heroes[2].dmgBase = 20;
      const g = __y05.mk('Cryo Gunner', 'cg1');
      activeEntities = [...heroes, g]; turnQueue = [...activeEntities]; combatActive = true;
      g.intent = { type: 'SIG', icon: '#', sig: 'FLASH_FREEZE' }; executeEnemyAi(g);
      const first = heroes.filter(h => h.stunnedTurns > 0).map(h => h.id);
      const cd = g.sigCd;
      heroes.forEach(h => { h.stunnedTurns = 0; }); heroes[1].traits = ['UNSHAKEABLE'];
      g.sigCd = 0; g.intent = { type: 'SIG', icon: '#', sig: 'FLASH_FREEZE' }; executeEnemyAi(g);
      const second = heroes.filter(h => h.stunnedTurns > 0).map(h => h.id);
      combatActive = false;
      return { first, second, ids: heroes.map(h => h.id), cd, table: ENEMY_SIGS.FLASH_FREEZE.cd };
    });
    ok('the Cryo Gunner freezes the hardest hitter in the line, and only them',
      freeze.first.length === 1 && freeze.first[0] === freeze.ids[1]);
    ok('somebody who cannot be stunned cannot be frozen, and the next hardest takes it instead',
      freeze.second.length === 1 && freeze.second[0] === freeze.ids[2]);

    // ---- the cold ----
    const cold = await page.evaluate(() => {
      const heroes = __y05.fight(3, 5); const op = heroes[0];
      const h = __y05.mk('Coldhauler', 'ch1'), h2 = __y05.mk('Coldhauler', 'ch2'), t = __y05.mk('Frost Trooper', 'ft1');
      combatActive = true;
      const bite = field => { activeEntities = [...heroes, ...field]; const was = op.hp; applyTurnStartEffects(op); const took = was - op.hp; op.hp = 500; return took; };
      const none = bite([t]), one = bite([h, t]), two = bite([h, h2, t]);
      op.resistances = { phys: 0, bio: 0, energy: 100 }; const sealed = bite([h]);
      op.resistances = { phys: 0, bio: 0, energy: 0 };
      h.hp = 0; const dead = bite([h, t]); h.hp = 200;
      activeEntities = [...heroes, h, t]; const tb = t.hp; applyTurnStartEffects(t); const own = tb - t.hp;
      combatActive = false;
      return { none, one, two, sealed, dead, own };
    });
    ok(`a Coldhauler on the field takes ${cold.one} from each operator as their turn opens`, cold.one > 0 && cold.none === 0);
    ok('one bite however many haulers stand', cold.two === cold.one);
    ok('it is the cold, typed energy: a body sealed against energy takes none of it', cold.sealed === 0);
    ok('kill the hauler and the clock stops', cold.dead === 0);
    ok('and the Frost do not feel it themselves', cold.own === 0);

    // ---- the guns ----
    const guns = await page.evaluate(() => {
      const heroes = __y05.fight(5, 10);
      const built = generateEnemies('FROST', fightMult(), false, fightDmgMult(), 'THE_GUNS');
      const s = built.find(e => e.sig === 'FIRE_MISSION');
      const lead = s.sigCd;
      activeEntities = [...heroes, s]; turnQueue = [...activeEntities]; combatActive = true;
      const landed = [], tags = [], priced = [];
      for (let turn = 1; turn <= 9; turn++) {
        renderField();
        tags.push(((document.querySelector(`#${s.id} .sig-tag`) || {}).innerText || '').replace(/^FIRE MISSION\s*/, ''));
        const board = threatBoard();
        const before = heroes.map(h => h.hp);
        // Read off the intent that was up, not off who got hurt: its own AOE lands on the whole
        // line too, one turn in twenty, and a row that counted that as the guns flaked on it.
        const shells = !!s.intent && s.intent.type === 'SIG';
        executeEnemyAi(s);
        const lost = heroes.map((h, i) => before[i] - h.hp);
        if (shells) { landed.push(turn); priced.push(lost.every(x => x > 0) && heroes.every((h, i) => board[h.id].dmg === lost[i])); }
        heroes.forEach(h => { h.hp = 500; h.stunnedTurns = 0; clearBleed(h); });
      }
      combatActive = false;
      return { lead, table: ENEMY_SIGS.FIRE_MISSION.lead, landed, tags, priced };
    });
    ok(`the Signaller comes onto the field part-way down its count (${guns.lead})`, guns.lead === guns.table && guns.lead > 0);
    ok(`its shells land on its third turn and every third turn after (turns ${guns.landed.join(', ')})`,
      guns.landed.join() === '3,6,9');
    ok(`the card counts it down to the turn (${guns.tags.slice(0, 3).join(' / ')})`,
      /IN 3/.test(guns.tags[0]) && /IN 2/.test(guns.tags[1]) && [2, 5, 8].every(i => /INCOMING/.test(guns.tags[i])));
    ok('the board prices the shells on every operator, and the price is what lands',
      guns.priced.length === 3 && guns.priced.every(Boolean));

    // ---- the sky and the ground ----
    const wx = await page.evaluate(() => {
      const heroes = __y05.fight(); const op = heroes[0];
      const cd = (w, t) => { currentWeather = w; currentTerrain = t || 'OPEN_ROAD'; return cdFor(op, 'iron_guard'); };
      const clear = cd('CLEAR'), snow = cd('BLIZZARD'), both = cd('BLIZZARD', 'ICE'), iceOnly = cd('CLEAR', 'ICE');
      const g = __y05.mk('Cryo Gunner', 'cg1');
      activeEntities = [...heroes, g]; turnQueue = [...activeEntities]; combatActive = true;
      currentWeather = 'BLIZZARD'; currentTerrain = 'ICE';
      g.intent = { type: 'SIG', icon: '#', sig: 'FLASH_FREEZE' }; executeEnemyAi(g);
      const theirs = g.sigCd;
      combatActive = false;
      const strike = (u, type, t) => { currentWeather = 'CLEAR'; currentTerrain = t; return enemyStrike(u, { type }); };
      const gun = __y05.mk('Cryo Gunner', 'x1', { dmgBase: 100 }), troop = __y05.mk('Frost Trooper', 'x2', { dmgBase: 100 });
      return { clear, snow, both, iceOnly, theirs, table: ENEMY_SIGS.FLASH_FREEZE.cd,
               ranged: [strike(gun, 'ATTACK', 'OPEN_ROAD'), strike(gun, 'ATTACK', 'ICE')],
               melee: [strike(troop, 'ATTACK', 'OPEN_ROAD'), strike(troop, 'ATTACK', 'ICE')],
               aoe: [strike(gun, 'AOE', 'OPEN_ROAD'), strike(gun, 'AOE', 'ICE')],
               banners: [WEATHER.BLIZZARD.banner, WEATHER.ION_STORM.banner] };
    });
    ok(`the blizzard puts a turn on the squad's cooldowns (${wx.clear} -> ${wx.snow})`, wx.snow === wx.clear + 1);
    ok(`and out on the ice under it, two (${wx.both})`, wx.both === wx.clear + 2);
    ok('the ice on its own touches no cooldown', wx.iceOnly === wx.clear);
    ok(`an enemy signature keeps its own clock in the snow (${wx.theirs}, its table says ${wx.table})`, wx.theirs === wx.table);
    ok('so both cold and charged skies say whose cooldowns they touch', wx.banners.every(b => /your cooldowns/.test(b)));
    ok(`on the ice a rifle carries, a blade drags and a blast is swallowed (${wx.ranged.join('->')}, ${wx.melee.join('->')}, ${wx.aoe.join('->')})`,
      wx.ranged[1] > wx.ranged[0] && wx.melee[1] < wx.melee[0] && wx.aoe[1] < wx.aoe[0]
      && wx.ranged[1] === Math.floor(wx.ranged[0] * 1.1) && wx.melee[1] === Math.floor(wx.melee[0] * 0.85)
      && wx.aoe[1] === Math.floor(wx.aoe[0] * 0.8));

    // ---- the Commandant ----
    const cmd = await page.evaluate(() => {
      // Staged by hand: until its art lands the rotation does not carry it, so it is put there for
      // the length of this block and taken off again at the end.
      const it = BOSS_POOL.find(b => b.id === 'COMMANDANT');
      const staged = !BOSS_ROTATION.includes(it);
      if (staged) BOSS_ROTATION.push(it);
      const stage = () => {
        localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
        activeContracts = []; grudgeCall = 'COMMANDANT'; currentSector = 1; currentTier = 10;
        initiateCombat('BOSS', false); combatActive = false;
        const heroes = activeEntities.filter(e => e.isPlayer);
        heroes.forEach(h => { __bare(h); h.maxHp = h.hp = 900; });
        const boss = activeEntities.find(e => e.classType === 'BOSS');
        return { heroes, boss, pods: activeEntities.filter(e => e.podOf === boss.id) };
      };
      const out = {};
      let { heroes, boss, pods } = stage();
      out.n = pods.length; out.sealed = pods.every(p => p.sealed); out.thaw = pods.map(p => p.thaw);
      out.intents = pods.map(p => p.intent.type);
      combatActive = true;
      out.forecast = pods.map(p => { const f = forecastFor(p); return f ? `${f.kind}:${(f.hits || []).length}` : null; });
      // A pod's turn is still a turn in the order, so whatever it does it has to hand the floor
      // on, and only once. Read off what the turn schedules rather than by letting the clock run:
      // the hand-off is held back, so nothing a pod leaves behind can fire into the rows below.
      const ids = pods.map(p => p.id); const ticks = [], handed = [];
      const turn = p => {
        if (!p.sealed) return executeEnemyAi(p);
        const st = window.setTimeout, next = [];
        window.setTimeout = (fn, ms, ...a) => { next.push(fn && fn.name); return fn && fn.name === 'nextTurn' ? 0 : st(fn, ms, ...a); };
        try { executeEnemyAi(p); } finally { window.setTimeout = st; }
        handed.push(next.filter(n => n === 'nextTurn').length);
      };
      for (let i = 1; i <= 6; i++) {
        pods.forEach(p => { if (p.hp > 0) turn(p); heroes.forEach(h => { h.hp = 900; h.stunnedTurns = 0; clearBleed(h); }); });
        ticks.push(pods.map(p => p.sealed ? `S${p.thaw}` : p.name));
      }
      out.ticks = ticks; out.sameIds = pods.every((p, i) => p.id === ids[i]); out.handed = handed;
      combatActive = false;

      // broken first, it never wakes - not even when the vault opens, which is the one thing
      // that opens a pod without that pod taking a turn
      ({ heroes, boss, pods } = stage()); combatActive = true;
      applyDamageHit(heroes[0], pods[0], 99999, 'phys', 'PISTOL');
      boss.hp = Math.floor(boss.maxHp * 0.4); openEnragePhase(boss);
      out.broken = { hp: pods[0].hp, name: pods[0].name, hatched: !!pods[0].hatched, other: pods[1].name };
      combatActive = false;

      // the enrage opens the vault
      ({ heroes, boss, pods } = stage()); combatActive = true;
      boss.hp = Math.floor(boss.maxHp * 0.4); openEnragePhase(boss);
      out.enraged = { sealed: sealedPods(boss).length, names: pods.map(p => p.name) };
      combatActive = false;

      // felled, it takes the sealed pods with it - and nobody broke them
      ({ heroes, boss, pods } = stage()); combatActive = true;
      const killedBefore = bestiaryEntry('Cryo Pod').killed;
      applyDamageHit(heroes[0], boss, 999999, 'phys', 'PISTOL');
      out.felled = { pods: pods.map(p => ({ hp: p.hp, sealed: !!p.sealed })), standing: activeEntities.filter(e => !e.isPlayer && e.hp > 0).length,
                     killed: bestiaryEntry('Cryo Pod').killed - killedBefore };
      combatActive = false;

      // what it learned: another pod while one is gone, the rime packed back on while both hold
      ({ heroes, boss, pods } = stage()); combatActive = true;
      boss.sig = 'REFREEZE'; boss.sizeUp = false;
      applyDamageHit(heroes[0], pods[0], 99999, 'phys', 'PISTOL');
      boss.intent = { type: 'SIG', icon: '#', sig: 'REFREEZE' }; executeEnemyAi(boss);
      const fresh = sealedPods(boss);
      out.refreeze = { sealed: fresh.length, holds: fresh.map(p => p.holds), thaw: fresh.map(p => p.thaw) };
      const trooper = Object.assign(JSON.parse(JSON.stringify(unitByName('FROST', 'Frost Trooper'))),
        { id: 'y5t', hp: 100, maxHp: 100, isPlayer: false, rime: 0 });
      activeEntities.push(trooper);
      boss.sigCd = 0; boss.intent = { type: 'SIG', icon: '#', sig: 'REFREEZE' }; executeEnemyAi(boss);
      out.packed = { rime: trooper.rime, cap: plate(RIME.cap), sealed: sealedPods(boss).length };
      combatActive = false;

      // the reserve, on a commander that has lost before
      ({ heroes, boss, pods } = stage()); combatActive = true;
      boss.grudgeMove = BOSS_POOL.find(b => b.id === 'COMMANDANT').grudge; boss.phase = 2;
      openGrudgePhase(boss);
      const reserve = activeEntities.filter(e => e.podOf === boss.id && e.sealed && !pods.includes(e));
      out.reserve = reserve.map(p => `${p.holds}:${p.thaw}`);
      combatActive = false;

      // a pod on its last count is the one worth stunning
      ({ heroes, boss, pods } = stage()); combatActive = true;
      pods[0].thaw = 3; pods[1].thaw = 1; boss.intent = { type: 'DEFEND', icon: '#' }; boss.sizeUp = false;
      const bt = breakTarget();
      out.breakAt = bt && bt.id === pods[1].id;
      combatActive = false;
      grudgeCall = null;
      if (staged) BOSS_ROTATION.splice(BOSS_ROTATION.indexOf(it), 1);
      return out;
    });
    ok(`it arrives with two sealed pods, counting ${cmd.thaw.join(' and ')}`, cmd.n === 2 && cmd.sealed && cmd.thaw.join() === '3,6');
    ok(`a pod lands nothing and says what it is doing (${cmd.intents.join(', ')}; ${cmd.forecast.join(', ')})`,
      cmd.intents.every(t => t === 'THAW') && cmd.forecast.every(f => f === 'THAW:0'));
    // Every turn of the six, not just the two it opens on: a pod that opened a turn early would
    // still read right at 3 and at 6.
    const count = 'S2,S5 | S1,S4 | Frost Trooper,S3 | Frost Trooper,S2 | Frost Trooper,S1 | Frost Trooper,Cryo Gunner';
    ok(`each opens on its own count into what it held (${cmd.ticks.map(t => t.map(x => x.split(' ').pop()).join('/')).join(', ')})`,
      cmd.ticks.map(t => t.join()).join(' | ') === count);
    ok('in the same place: the same body in the same slot', cmd.sameIds);
    ok(`a pod's turn is still a turn: each of its ${cmd.handed.length} sealed ones hands the floor on once (${[...new Set(cmd.handed)].join('/')})`,
      cmd.handed.length === 9 && cmd.handed.every(n => n === 1));
    ok(`a pod broken first never wakes, not even when the vault opens (${cmd.broken.name}, ${cmd.broken.hp} hp; the other: ${cmd.broken.other})`,
      cmd.broken.hp === 0 && cmd.broken.name === 'Cryo Pod' && !cmd.broken.hatched && cmd.broken.other === 'Cryo Gunner');
    ok(`the enrage opens every pod still sealed (${cmd.enraged.names.join(', ')})`,
      cmd.enraged.sealed === 0 && cmd.enraged.names.join() === 'Frost Trooper,Cryo Gunner');
    ok('when it falls the pods it kept cold go dark, and the fight is over',
      cmd.felled.pods.every(p => p.hp === 0 && !p.sealed) && cmd.felled.standing === 0);
    ok(`and nobody is credited with breaking them (${cmd.felled.killed} pod kills)`, cmd.felled.killed === 0);
    ok(`it learned to seal another when one is broken (${cmd.refreeze.holds.join(', ')} counting ${cmd.refreeze.thaw.join(', ')})`,
      cmd.refreeze.sealed === 2 && cmd.refreeze.holds.includes('Frost Trooper'));
    ok(`and with both holding, to pack the rime back onto its line (${cmd.packed.rime}/${cmd.packed.cap})`,
      cmd.packed.rime === cmd.packed.cap && cmd.packed.sealed === 2);
    ok(`the reserve is one more pod with something heavy in it (${cmd.reserve.join(', ')})`,
      cmd.reserve.length === 1 && cmd.reserve[0] === 'Coldhauler:2');
    ok('BREAK aims at the pod on the last turn of its count', cmd.breakAt === true);

    // ---- the art that has not landed ----
    const art = await page.evaluate(files => {
      const portraits = [...ENEMY_POOL.FROST, BOSS_POOL.find(b => b.id === 'COMMANDANT'),
        BOSS_POOL.find(b => b.id === 'COMMANDANT').pods.spec].map(u => ({ img: u.img, stand: u.stand,
          shown: portraitFor(u), standPending: PENDING_ART.includes(u.stand) }));
      const deliver = f => { const i = PENDING_ART.indexOf(f); if (i >= 0) PENDING_ART.splice(i, 1); return i >= 0; };
      const was = PENDING_ART.slice();
      const front = frontById('LONG_WINTER');
      const now = { ice: backdropFor('FROST', 'ICE'), vault: backdropFor('FROST', 'TUNNELS'), map: mapArt(3, front).file };
      // Which commanders hold the road, against which have their face and their ground painted.
      const road = BOSS_POOL.filter(b => !b.final).map(b => ({ id: b.id, dealt: BOSS_ROTATION.includes(b),
        drawn: !PENDING_ART.includes(b.img) && !PENDING_ART.includes(b.bg) }));
      deliver('bg_icefield.webp');
      const home = { ice: backdropFor('FROST', 'ICE'), vault: backdropFor('FROST', 'TUNNELS'), map: mapArt(3, front).file };
      deliver('bg_cryovault.webp'); home.vaultPainted = backdropFor('FROST', 'TUNNELS');
      PENDING_ART.length = 0; was.forEach(f => PENDING_ART.push(f));
      return { listed: files.filter(f => ASSET_LIST.includes(f)).length, pending: files.filter(f => PENDING_ART.includes(f)),
               portraits, now, home, road: ROAD_ART, commanders: road };
    }, FROST_ART);
    ok(`all nine Frost pieces are on ASSET_LIST, so each is preloaded and cached the day it lands (${art.listed})`,
      art.listed === FROST_ART.length);
    const stale = FROST_ART.filter(f => art.pending.includes(f) === fs.existsSync(path.join(ROOT, f)));
    ok(`each is pending exactly when its file is not in the repo (${art.pending.length} pending${stale.length ? '; wrong: ' + stale.join(', ') : ''})`,
      stale.length === 0);
    const badStand = art.portraits.filter(p => art.pending.includes(p.img)
      && (p.shown !== p.stand || p.standPending || !fs.existsSync(path.join(ROOT, p.stand))));
    ok(`until a portrait lands, something already drawn stands in for it${badStand.length ? ' (not: ' + badStand.map(p => p.img).join(', ') + ')' : ''}`,
      badStand.length === 0 && art.portraits.every(p => p.stand));
    ok(`until the ice is painted a Frost fight is drawn on the open road, and so is the map behind a Long Winter (${art.now.ice}, ${art.now.map})`,
      !art.pending.includes('bg_icefield.webp') || (art.now.ice === art.road && art.now.vault === art.road && art.now.map === art.road));
    ok(`once it lands the ice is drawn on it, and the vault falls back to the ice before the road (${art.home.ice}, ${art.home.vault})`,
      art.home.ice === 'bg_icefield.webp' && art.home.map === 'bg_icefield.webp'
      && (art.home.vault === 'bg_icefield.webp' || !art.pending.includes('bg_cryovault.webp'))
      && art.home.vaultPainted === 'bg_cryovault.webp');
    const offRoad = art.commanders.filter(c => c.dealt !== c.drawn);
    const cmdt = art.commanders.find(c => c.id === 'COMMANDANT');
    ok(`a commander holds the road exactly when its face and its ground have landed (the Commandant: ${cmdt.dealt ? 'dealt' : 'waiting'})`,
      offRoad.length === 0 && !!cmdt && cmdt.dealt === cmdt.drawn);

    // ---- the front ----
    const front = await page.evaluate(() => {
      const f = frontById('LONG_WINTER');
      const dealt = sector => { const rng = mulberry32(seedFromString(`y05|front|${sector}`)); let n = 0;
        for (let i = 0; i < 400; i++) if (rollFront(rng, sector) === 'LONG_WINTER') n++; return n; };
      const escort = frontId => {
        localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0);
        currentSector = 3; currentTier = 10; sectorFront = frontId; grudgeCall = null;
        initiateCombat('BOSS', false); combatActive = false;
        const e = activeEntities.find(x => x.id === 'front_escort');
        return e ? Object.keys(ENEMY_POOL).find(k => ENEMY_POOL[k].some(u => u.name === typeNameOf(e))) : null;
      };
      return { f: { minSector: f.minSector, faction: f.faction, sky: f.sky }, s2: dealt(2), s3: dealt(3),
               winter: escort('LONG_WINTER'), warband: escort('RAIDER_WARBAND'), irradiated: escort('IRRADIATED') };
    });
    ok(`the Long Winter opens at sector 3 and leans on the Frost, under their snow (dealt ${front.s2} of 400 at sector 2, ${front.s3} at 3)`,
      front.f.minSector === 3 && front.f.faction === 'FROST' && front.f.sky === 'BLIZZARD' && front.s2 === 0 && front.s3 > 0);
    ok(`its commander does not come alone: the escort is Frost (${front.winter})`, front.winter === 'FROST');
    ok(`and the escort is still read off the front for the rest (${front.warband}, ${front.irradiated || 'none'})`,
      front.warband === 'RAIDERS' && front.irradiated === null);

    // ---- what the player is told ----
    const text = await page.evaluate(() => {
      const page = id => { const c = CODEX.find(x => x.id === id); return c ? [].concat(c.body()).join('\n') : ''; };
      const last = PROMPTS.find(p => p.id === 'LAST');
      return { last: last && last.body, rotation: BOSS_ROTATION.length, sky: page('GROUND_SKY'), hostiles: page('HOSTILES') };
    });
    ok(`the last sector's card counts the ${text.rotation} that hold the road`,
      text.last.includes(`${text.rotation} that hold the road`) && !/seven that hold/.test(text.last));
    ok('the manual carries the ice, the snow, and what the two make together',
      /THE ICE/.test(text.sky) && /BLIZZARD/.test(text.sky) && /Out on the open ice/.test(text.sky));
    ok('and a file on every Frost signature, the pods and the learned one included',
      ['Rime', 'Flash Freeze', 'Deep Cold', 'Fire Mission', 'Sealed', 'Refreeze'].every(n => text.hostiles.includes(n)));
  }
};

// Ground became a table at N12 and grew rules with real weight at A10. Weather never did: three
// rollable skies plus a boss-only BLOODLUST, and most of what they did was nudge accuracy.
//
// Worse, weather was not one thing anywhere. It was four hand-kept lists - a dot map, a banner
// map, the HARSH SKIES pool and the sky-flip passive's pool - with the effects themselves
// written out as `currentWeather === 'SANDSTORM'` at seven call sites. Adding a sky meant
// finding all eleven places first, which is the reason nobody had since the game shipped.
//
// It is a table now, read through sky() the way terrain is read through ground(), with three
// more skies carrying rules of the ground's weight and a confluence table for the case the
// ground rules never covered: a faction's own sky standing over its own ground.
module.exports = {
  name: 'The sky',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__at = (w, t) => { currentWeather = w; currentTerrain = t || 'OPEN_ROAD'; };
      window.__clear = () => { currentWeather = 'CLEAR'; currentTerrain = 'OPEN_ROAD'; };
    });

    // ---- one table, and it is complete ----
    const table = await page.evaluate(() => {
      const named = Object.entries(WEATHER).filter(([id]) => id !== 'CLEAR');
      return {
        n: named.length,
        rollable: WEATHER_IDS,
        complete: named.every(([, w]) => w.name && w.short && w.dot && w.cls && w.desc && w.banner),
        dots: new Set(named.map(([, w]) => w.dot)).size,
        names: new Set(named.map(([, w]) => w.name)).size,
        arenaHeld: WEATHER_IDS.every(id => !WEATHER[id].arena) && !!WEATHER.BLOODLUST.arena,
        clearIsQuiet: !WEATHER.CLEAR.banner && !WEATHER_IDS.includes('CLEAR'),
        // Every sky has to actually do something, or it is a banner with a colour.
        inert: named.filter(([, w]) => !w.ranged && !w.aoe && !w.all && !w.backline
                                    && !w.armor && !w.cdCut && !w.chip && !w.shrapnel).map(([id]) => id)
      };
    });
    ok(`${table.n} skies, each named, drawn and described`, table.n >= 7 && table.complete);
    ok(`${table.rollable.length} of them the roads can deal`, table.rollable.length >= 6);
    ok('no two share a dot or a name', table.dots === table.n && table.names === table.n);
    ok('the arena sky is never dealt, and CLEAR is not a sky', table.arenaHeld && table.clearIsQuiet);
    ok(`and not one of them is only a banner (${table.inert.join(', ') || 'none inert'})`, table.inert.length === 0);

    // ---- the lists that used to be kept by hand are gone ----
    const wiring = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
      return {
        // An effect written as an id comparison. `=== 'CLEAR'` is a state check, not an effect.
        hardcoded: (code.match(/currentWeather === '(?!CLEAR)[A-Z_]+'/g) || []).length,
        // A pool of sky ids written out as an array literal.
        pools: (code.match(/\[\s*'TOXIC_SMOG'[^\]]*\]/g) || []).length,
        derived: /WEATHER_BANNERS = Object\.fromEntries/.test(code) && /WEATHER_DOTS = Object\.fromEntries/.test(code)
      };
    });
    ok(`no effect is written as an id comparison any more (${wiring.hardcoded} left)`, wiring.hardcoded === 0);
    ok(`and no pool of skies is written out beside the table (${wiring.pools} left)`, wiring.pools === 0);
    ok('the dot map and the banner map are built from it', wiring.derived);

    // ---- every sky is drawn: the classes it names have to exist ----
    const css = await page.evaluate(async () => {
      const sheet = await (await fetch('styles.css')).text();
      const missing = [];
      Object.entries(WEATHER).forEach(([id, w]) => {
        if (id === 'CLEAR') return;
        if (!sheet.includes(`.${w.dot} `) && !sheet.includes(`.${w.dot}{`)) missing.push(w.dot);
        if (!sheet.includes(`.${w.cls} `) && !sheet.includes(`.${w.cls}{`)) missing.push(w.cls);
      });
      return { missing, confluence: /\.confluence-banner/.test(sheet) };
    });
    ok(`every sky's dot and banner are styled (${css.missing.join(', ') || 'none missing'})`, css.missing.length === 0);
    ok('and so is the confluence line', css.confluence);

    // ---- ASHFALL: plating, and a blast that cannot breathe ----
    const ash = await page.evaluate(() => {
      const t = { isPlayer: true, gridPos: 2, armor: 0, resistances: { phys: 0 }, corrodedTurns: 0, venomStacks: 0 };
      __at('CLEAR'); const bare = mitigate(null, t, 20, 'phys', 'BASIC').n;
      __at('ASHFALL'); const caked = mitigate(null, t, 20, 'phys', 'BASIC').n;
      t.corrodedTurns = 1; const corroded = mitigate(null, t, 20, 'phys', 'BASIC').n;
      t.corrodedTurns = 0;
      // And it smothers area attacks, on both sides of the field.
      const foe = { dmgBase: 100, range: 'melee', classType: 'RAIDER' };
      __at('CLEAR'); const aoeBare = enemyStrike(foe, { type: 'AOE' });
      __at('ASHFALL'); const aoeAsh = enemyStrike(foe, { type: 'AOE' });
      __clear();
      return { bare, caked, corroded, aoeBare, aoeAsh, armor: WEATHER.ASHFALL.armor };
    });
    ok(`ASHFALL cakes plating onto everything (${ash.bare} -> ${ash.caked} through)`,
      ash.caked === ash.bare - ash.armor);
    ok('and corrosion strips the crust with the rest of the plate', ash.corroded === ash.bare);
    ok(`it smothers area attacks too (${ash.aoeBare} -> ${ash.aoeAsh})`, ash.aoeAsh < ash.aoeBare);

    // ---- ION STORM: cooldowns ----
    const ion = await page.evaluate(() => {
      const e = { weaponMod: null, trinket: null };
      __at('CLEAR'); const plain = cdFor(e, 'ripsaw', 3);
      __at('ION_STORM'); const charged = cdFor(e, 'ripsaw', 3); const floored = cdFor(e, 'ripsaw', 1);
      // A mod that already cut the cooldown and the storm stack rather than one shadowing the other.
      const modded = { weaponMod: 'CHAIN_OILER', trinket: null };
      const both = cdFor(modded, 'ripsaw', 4);
      __at('CLEAR'); const modOnly = cdFor(modded, 'ripsaw', 4);
      const foe = { dmgBase: 100, range: 'melee', classType: 'RAIDER' };
      const hitPlain = enemyStrike(foe, { type: 'ATTACK' });
      __at('ION_STORM'); const hitSoft = enemyStrike(foe, { type: 'ATTACK' });
      __clear();
      return { plain, charged, floored, both, modOnly, hitPlain, hitSoft };
    });
    ok(`ION STORM brings everything back a turn sooner (${ion.plain} -> ${ion.charged})`, ion.charged === ion.plain - 1);
    ok('never below one turn', ion.floored === 1);
    ok(`and stacks with a mod that already cut it (${ion.modOnly} -> ${ion.both})`, ion.both === ion.modOnly - 1);
    ok(`everything lands softer under it (${ion.hitPlain} -> ${ion.hitSoft})`, ion.hitSoft < ion.hitPlain);

    // ---- BLOOD HAZE: nobody can see, including them ----
    const haze = await page.evaluate(() => {
      const back = { gridPos: 3 }, front = { gridPos: 1 };
      __at('CLEAR'); const bare = backlineWeight(back), fBare = backlineWeight(front);
      __at('BLOOD_HAZE'); const hid = backlineWeight(back), fHid = backlineWeight(front);
      const shooter = { dmgBase: 100, range: 'ranged', classType: 'RAIDER' };
      __at('CLEAR'); const shotBare = enemyStrike(shooter, { type: 'ATTACK' });
      __at('BLOOD_HAZE'); const shotHazed = enemyStrike(shooter, { type: 'ATTACK' });
      __clear();
      return { bare, hid, fBare, fHid, shotBare, shotHazed };
    });
    ok(`BLOOD HAZE hides the back rank (weight ${haze.bare} -> ${haze.hid})`, haze.hid < haze.bare);
    ok('and leaves the front rank exactly where it was', haze.fHid === haze.fBare);
    ok(`nothing fired across it arrives (${haze.shotBare} -> ${haze.shotHazed})`, haze.shotHazed < haze.shotBare);

    // ---- the three that were already here still do what they did ----
    const old = await page.evaluate(() => {
      const shooter = { dmgBase: 100, range: 'ranged', classType: 'RAIDER' };
      const melee = { dmgBase: 100, range: 'melee', classType: 'RAIDER' };
      __at('CLEAR'); const base = enemyStrike(shooter, { type: 'ATTACK' }), mBase = enemyStrike(melee, { type: 'ATTACK' });
      __at('SANDSTORM'); const sand = enemyStrike(shooter, { type: 'ATTACK' }), mSand = enemyStrike(melee, { type: 'ATTACK' });
      __at('BLOODLUST'); const blood = enemyStrike(melee, { type: 'ATTACK' });
      __at('TOXIC_SMOG'); const chip = sky().chip;
      __at('SHRAPNEL_WINDS'); const shrap = sky().shrapnel;
      __clear();
      return { base, sand, mBase, mSand, blood, chip, shrap };
    });
    ok(`a sandstorm still blinds what is fired across it (${old.base} -> ${old.sand})`, old.sand < old.base);
    ok('and still leaves a blade alone', old.mSand === old.mBase);
    ok(`the arena still pays everybody (${old.mBase} -> ${old.blood})`, old.blood > old.mBase);
    ok('smog still poisons and shrapnel still bites', old.chip > 0 && old.shrap.chance > 0 && old.shrap.dmg > 0);

    // ---- the confluence: a faction's own sky over its own ground ----
    const conf = await page.evaluate(() => {
      const rows = CONFLUENCE.map(c => {
        __at(c.sky, c.ground);
        const together = JSON.stringify(sky());
        __at(c.sky, 'OPEN_ROAD');
        const apart = JSON.stringify(sky());
        return { pair: `${c.sky}/${c.ground}`, faction: c.faction, note: !!c.note,
                 changed: together !== apart,
                 ownSky: FACTIONS[c.faction].weather === c.sky,
                 ownGround: (FACTIONS[c.faction].ground || []).includes(c.ground) };
      });
      __at('CLEAR');
      const offPair = confluence('SANDSTORM', 'RUINS');
      const noGround = confluence('ASHFALL', 'OPEN_ROAD');
      __clear();
      return { rows, offPair, noGround, factions: new Set(CONFLUENCE.map(c => c.faction)).size };
    });
    ok(`one confluence per faction (${conf.rows.length}), each its own sky over its own ground`,
      conf.rows.length === 5 && conf.factions === 5 && conf.rows.every(r => r.ownSky && r.ownGround));
    ok('every one of them changes the fight, and says why', conf.rows.every(r => r.changed && r.note));
    ok('and a sky over ground that is not its own is just the sky',
      conf.offPair === null && conf.noGround === null);

    // ---- the two the design called for, measured on the real numbers ----
    const named = await page.evaluate(() => {
      __at('TOXIC_SMOG', 'OPEN_ROAD'); const smogPlain = sky().chip;
      __at('TOXIC_SMOG', 'FLOODED');   const smogWater = sky().chip;
      __at('SANDSTORM', 'OPEN_ROAD');  const sandPlain = sky().ranged;
      __at('SANDSTORM', 'NEST');       const sandNest = sky().ranged;
      // And the one that is a relief rather than a punishment.
      __at('SANDSTORM', 'TUNNELS');    const sandUnder = sky().ranged;
      __clear();
      return { smogPlain, smogWater, sandPlain, sandNest, sandUnder };
    });
    ok(`the Choir's smog sits on the water and bites twice (${named.smogPlain} -> ${named.smogWater})`,
      named.smogWater === named.smogPlain * 2);
    const choked = await page.evaluate(() => {
      const breathe = (w, t) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 3; currentTier = 4;
        forecastWeather = w; forecastTerrain = t;
        initiateCombat('CHOIR', false);
        const ent = activeEntities.find(e => e.isPlayer && e.hp > 0);
        const before = ent.hp;
        applyTurnStartEffects(ent);
        const took = before - ent.hp;
        combatActive = false;
        return took;
      };
      const road = breathe('TOXIC_SMOG', 'OPEN_ROAD');
      const water = breathe('TOXIC_SMOG', 'FLOODED');
      const dry = breathe('CLEAR', 'FLOODED');
      __clear();
      return { road, water, dry };
    });
    ok(`and it is the damage that doubles, not just the table (${choked.road} -> ${choked.water} DMG a turn)`,
      choked.road > 0 && choked.water === choked.road * 2 && choked.dry === 0);
    ok(`the Carrion hunt by scent and you cannot see at all (${named.sandPlain} -> ${named.sandNest})`,
      named.sandNest < named.sandPlain);
    ok(`and a storm cannot get into the Beasts' tunnels (${named.sandPlain} -> ${named.sandUnder})`,
      named.sandUnder === 1);

    // ---- the Mech's gas pools where the cover is ----
    const cover = await page.evaluate(() => {
      const front = { isPlayer: true, gridPos: 1, armor: 0, resistances: { phys: 0 }, corrodedTurns: 0, venomStacks: 0 };
      const mid = { ...front, gridPos: 2 };
      const go = (w, t, who) => { __at(w, t); return mitigate(null, who, 100, 'phys', 'BASIC').n; };
      const r = { ruins: go('CLEAR', 'RUINS', front), gassedRuins: go('TOXIC_SMOG', 'RUINS', front),
                  road: go('CLEAR', 'OPEN_ROAD', front),
                  midRuins: go('CLEAR', 'RUINS', mid), midGassed: go('TOXIC_SMOG', 'RUINS', mid) };
      __clear();
      return r;
    });
    ok(`ruins cover the front rank (${cover.road} -> ${cover.ruins})`, cover.ruins < cover.road);
    ok(`and the Mech's gas fills exactly that cover (${cover.ruins} -> ${cover.gassedRuins})`,
      cover.gassedRuins === cover.road);
    ok('the middle rank never had the cover and does not lose it', cover.midGassed === cover.midRuins);

    // ---- where the new skies come from ----
    const fronts = await page.evaluate(() => {
      const carry = FRONTS.filter(f => f.sky);
      return {
        carry: carry.map(f => `${f.name}:${weatherName(f.sky)}`),
        allReal: carry.every(f => !!WEATHER[f.sky] && f.skyChance > 0 && f.skyChance <= 1),
        // Every sky the roads can deal has somewhere to come from: a faction, or a front.
        orphans: WEATHER_IDS.filter(id =>
          !Object.values(FACTIONS).some(f => f.weather === id) && !FRONTS.some(f => f.sky === id)),
        bossSky: FRONTS.filter(f => f.bossSky).map(f => f.id),
        // A front that promises a warlord under its sky in its own description, and only that one.
        promises: FRONTS.filter(f => /boss fights under it/i.test(f.desc)).map(f => f.id)
      };
    });
    ok(`${fronts.carry.length} fronts carry a sky of their own (${fronts.carry.join(', ')})`,
      fronts.carry.length >= 4 && fronts.allReal);
    ok(`every dealable sky has a road that deals it (${fronts.orphans.join(', ') || 'no orphans'})`,
      fronts.orphans.length === 0);
    ok('and only the front whose description promises it puts the warlord under one',
      fronts.bossSky.length === 1 && fronts.promises.join() === fronts.bossSky.join());
    const arena = await page.evaluate(() => {
      const under = front => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
        currentSector = 2; currentTier = 10; sectorFront = front;
        forecastWeather = null; forecastTerrain = null;
        initiateCombat('BOSS', false);
        const w = currentWeather;
        combatActive = false;
        return w;
      };
      const r = { none: under(null), irradiated: under('IRRADIATED'),
                  moon: under('BLOOD_MOON'), raiders: under('RAIDER_WARBAND'),
                  machines: under('MACHINE_UPRISING') };
      sectorFront = null; __clear();
      return r;
    });
    ok(`a warlord's arena has its own sky (${arena.none})`, arena.none === 'BLOODLUST');
    ok(`the irradiated front takes it away, as its description says (${arena.irradiated})`,
      arena.irradiated === 'TOXIC_SMOG');
    ok(`and no other front does (${arena.moon}, ${arena.raiders}, ${arena.machines})`,
      arena.moon === 'BLOODLUST' && arena.raiders === 'BLOODLUST' && arena.machines === 'BLOODLUST');

    // ---- generation actually deals them ----
    const gen = await page.evaluate(() => {
      const sweep = front => {
        sectorFront = front; currentSector = 3;
        const seen = {}; let fights = 0;
        for (let i = 0; i < 60; i++) {
          const m = generateSectorMap(seededRng('c06:' + front + ':' + i));
          m.nodes.filter(n => FIGHT_NODES.includes(n.type)).forEach(n => {
            fights++; if (n.weather && n.weather !== 'CLEAR') seen[n.weather] = (seen[n.weather] || 0) + 1;
          });
        }
        return { seen, fights, any: Object.values(seen).reduce((a, b) => a + b, 0) };
      };
      const moon = sweep('BLOOD_MOON'), quiet = sweep('QUIET_ROADS');
      sectorFront = null; currentSector = 1;
      // Returned rather than read in the assertion: these are page globals, and a template
      // literal in the assertion is evaluated up in Node where they do not exist.
      return { moon, quiet, wxChance: WEATHER_CHANCE, grChance: GROUND_CHANCE };
    });
    ok(`a Blood Moon deals its own haze (${gen.moon.seen.BLOOD_HAZE || 0} of ${gen.moon.fights} fights)`,
      (gen.moon.seen.BLOOD_HAZE || 0) > 0);
    ok('alongside whatever the factions bring', Object.keys(gen.moon.seen).length >= 2);
    ok(`quiet roads deal no sky of their own, only the factions' (${Object.keys(gen.quiet.seen).join(', ')})`,
      !gen.quiet.seen.BLOOD_HAZE && !gen.quiet.seen.ASHFALL && !gen.quiet.seen.ION_STORM && gen.quiet.any > 0);
    ok(`and the sky stays rarer than the ground (${Math.round(gen.wxChance * 100)}% vs ${Math.round(gen.grChance * 100)}%)`,
      gen.wxChance < gen.grChance);

    // ---- the two pools that read the table ----
    const pools = await page.evaluate(() => {
      // HARSH SKIES: over enough draws it must be able to reach every dealable sky.
      const seen = new Set();
      for (let i = 0; i < 600; i++) {
        activeContracts = ['HARSH_SKIES']; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 2; currentTier = 3; forecastWeather = null;
        initiateCombat('MECH', false);
        seen.add(currentWeather);
        combatActive = false;
        if (seen.size >= WEATHER_IDS.length) break;
      }
      activeContracts = [];
      return { reached: [...seen].filter(w => w !== 'CLEAR').sort(), all: WEATHER_IDS.length };
    });
    ok(`HARSH SKIES can deal every sky on the table (${pools.reached.length} of ${pools.all})`,
      pools.reached.length === pools.all);

    // ---- the banners ----
    const banners = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 3; currentTier = 4;
      forecastWeather = 'TOXIC_SMOG'; forecastTerrain = 'FLOODED';
      initiateCombat('CHOIR', false);
      const withConf = {
        wx: document.getElementById('weather-banner').innerText,
        gr: document.getElementById('ground-banner').innerText,
        cf: document.getElementById('confluence-banner').innerText,
        shown: document.getElementById('confluence-banner').style.display
      };
      combatActive = false;
      forecastWeather = 'TOXIC_SMOG'; forecastTerrain = 'TUNNELS';
      initiateCombat('CHOIR', false);
      const without = { cf: document.getElementById('confluence-banner').innerText,
                        shown: document.getElementById('confluence-banner').style.display };
      combatActive = false;
      return { withConf, without };
    });
    ok('the sky and the ground each get their own banner',
      /TOXIC SMOG/.test(banners.withConf.wx) && /FLOODED WORKS/.test(banners.withConf.gr));
    ok(`and the confluence gets a third, naming both (${banners.withConf.cf})`,
      banners.withConf.shown === 'block' && /TOXIC SMOG/.test(banners.withConf.cf)
      && /FLOODED WORKS/.test(banners.withConf.cf) && /water/i.test(banners.withConf.cf));
    ok('which stays down when the two are not a pair',
      banners.without.shown === 'none' && banners.without.cf === '');

    // ---- the manual ----
    const codex = await page.evaluate(() => {
      const e = CODEX.find(x => x.id === 'GROUND_SKY');
      const text = e ? e.body().join(' ') : '';
      return { has: !!e,
               skies: WEATHER_IDS.every(id => text.includes(WEATHER[id].name) && text.includes(WEATHER[id].desc)),
               grounds: TERRAIN_IDS.filter(id => TERRAIN[id].banner).every(id => text.includes(TERRAIN[id].name)),
               confs: CONFLUENCE.every(c => text.includes(c.note)) };
    });
    ok('the manual has a page for the ground and the sky', codex.has);
    ok('naming every sky and what it does', codex.skies);
    ok('every ground with a rule', codex.grounds);
    ok('and every confluence between them', codex.confs);
  }
};

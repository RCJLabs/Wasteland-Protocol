// Y03. Every faction fought all of its grounds on one picture, and for two of the five that
// picture is of a different ground from the one they fight on most. The Raiders' highway is a
// collapsed overpass in a ruined city - RUINS - and 75% of their fights with ground are on the
// OPEN FLATS; the Beasts' canyon is a salt flat - OPEN FLATS - and 75% of theirs are in TUNNELS.
// Counted over 184,823 fight nodes on generated maps, 37% stood on a ground their picture did
// not show. The comment above GROUND_SIGNATURE said the signature was "the one its backdrop is a
// picture of", and the field manual told the player the same.
//
// Five places, one per faction, each for the ground its home picture does not show. None of
// them is painted yet: each is on PENDING_ART, and until it comes off, a fight on that ground is
// drawn exactly as it was. These rows hold both halves - that nothing changes while a picture
// is outstanding, and that taking it off the list is the whole of what delivering it takes.
//
// Three rows read the disk and the briefs rather than the table, because the table checked
// against itself would pass with a place nobody had briefed and a file nobody had un-pended.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

module.exports = {
  name: 'A place for every ground',
  run: async ({ page, ok, base, engineUp, resized }) => {
    // Every file the page or its service worker asks for, from the first request on - so the
    // row that says nothing chased an unpainted picture covers the preloader and the cache too.
    const asked = new Set();
    page.context().on('request', r => asked.add(decodeURIComponent(r.url().split('?')[0].split('/').pop())));
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    await resized(page, { width: 390, height: 844 });

    // ---- the table ----
    const table = await page.evaluate(() => {
      const arenas = new Set([...BOSS_POOL.map(b => b.bg), FINAL_BOSS && FINAL_BOSS.bg, 'bg_combat.webp', 'bg_title.webp'].filter(Boolean));
      const homes = new Set(FIGHT_NODES.map(f => FACTIONS[f].bg));
      const rows = FIGHT_NODES.map(f => {
        const places = FACTIONS[f].places || {};
        return { f, grounds: FACTIONS[f].ground, placed: Object.keys(places), files: Object.values(places) };
      });
      const files = rows.flatMap(r => r.files);
      return { rows, files, pending: PENDING_ART.slice(), listed: ASSET_LIST.slice(),
               distinct: new Set(files).size === files.length,
               reused: files.filter(x => homes.has(x) || arenas.has(x)),
               named: files.every(x => /^bg_[a-z]+\.webp$/.test(x)) };
    });
    const bare = table.rows.filter(r => r.grounds.filter(g => !r.placed.includes(g)).length !== 1);
    ok(`every faction has a place for each of its grounds but the one its own picture shows (${table.rows.map(r => `${r.f.toLowerCase()} ${r.placed.join('+')}`).join(', ')})`,
      bare.length === 0 && table.rows.every(r => r.placed.every(g => r.grounds.includes(g))));
    ok('and none for the open road, which is every faction’s own picture',
      table.rows.every(r => !r.placed.includes('OPEN_ROAD')));
    ok(`each place is a picture of its own - no two share one, none is a home or an arena (${table.files.length} files)`,
      table.files.length === table.rows.length && table.distinct && table.reused.length === 0 && table.named);
    ok('each is on ASSET_LIST, so it is preloaded and cached the day it comes off PENDING_ART',
      table.files.every(f => table.listed.includes(f)) && table.pending.every(f => table.listed.includes(f)));

    // ---- the disk and the briefs, not the table ----
    const onDisk = table.files.filter(f => fs.existsSync(path.join(ROOT, f)));
    const stale = table.files.filter(f => table.pending.includes(f) === onDisk.includes(f));
    ok(`a place is pending exactly when its file is not in the repo (${onDisk.length} painted, ${table.files.length - onDisk.length} pending${stale.length ? '; wrong: ' + stale.join(', ') : ''})`,
      stale.length === 0);
    const briefs = fs.readFileSync(path.join(ROOT, 'ART_PROMPTS.md'), 'utf8').split('\n').filter(l => l.startsWith('### `'));
    const groundName = await page.evaluate(() => Object.fromEntries(TERRAIN_IDS.map(id => [id, TERRAIN[id].name])));
    const unbriefed = table.rows.flatMap(r => r.placed.map((g, i) => ({ f: r.f, g, file: r.files[i] })))
      .filter(p => !briefs.some(h => h.startsWith('### `' + p.file + '`') && h.includes(groundName[p.g]) && h.toLowerCase().includes(p.f.toLowerCase())));
    ok(`each place has a brief in ART_PROMPTS.md that names its faction and its ground${unbriefed.length ? ' (missing: ' + unbriefed.map(p => p.file).join(', ') + ')' : ''}`,
      unbriefed.length === 0);
    const pendingBriefed = table.pending.filter(f => !briefs.some(h => h.startsWith('### `' + f + '`')));
    ok('and so does everything else on PENDING_ART - nothing is outstanding that nobody can paint',
      pendingBriefed.length === 0);

    // ---- while a place is pending, its ground looks as it always has ----
    const stage = (faction, ground, extra = {}) => page.evaluate(({ faction, ground, extra }) => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      globalSettings.sfx = true; initAudio();
      currentSector = extra.sector || 2; currentTier = extra.tier || 4;
      forecastTerrain = ground; initiateCombat(faction, false);
      combatActive = false;
      const layer = document.getElementById('combat-sky-layer');
      const g = groundFxState();
      return { faction, ground, bg: combatBgFile, terrain: currentTerrain,
               painted: getComputedStyle(layer).backgroundImage,
               lift: document.querySelector('.battlefield').style.marginBottom,
               groundLift: layer.style.getPropertyValue('--ground-lift'),
               biome: ambienceBiome, drawn: g.built && g.id === currentTerrain };
    }, { faction, ground, extra });
    const every = async () => {
      const out = [];
      for (const r of table.rows) for (const g of [...r.grounds, 'OPEN_ROAD']) out.push(await stage(r.f, g));
      return out;
    };
    const homeOf = Object.fromEntries(await page.evaluate(() => FIGHT_NODES.map(f => [f, FACTIONS[f].bg])));
    const before = await every();
    const offHome = before.filter(s => s.bg !== homeOf[s.faction] || !s.painted.includes(homeOf[s.faction]));
    ok(`while every place is pending, all ${before.length} faction-and-ground fights are drawn on the faction’s own picture`,
      table.pending.length > 0 && offHome.length === 0);
    const chased = table.pending.filter(f => asked.has(f));
    ok(`and nothing - page, preloader or service worker - asked for a picture that has not been painted (${asked.size} files asked for${chased.length ? '; chased: ' + chased.join(', ') : ''})`,
      asked.size > 20 && chased.length === 0);

    // ---- taking a place off the list is the whole of delivering it ----
    await page.evaluate(() => { window.__heldPending = PENDING_ART.splice(0); });
    const after = await every();
    await page.evaluate(() => { PENDING_ART.push(...window.__heldPending); });
    const placeOf = {};
    table.rows.forEach(r => r.placed.forEach((g, i) => { placeOf[`${r.f}|${g}`] = r.files[i]; }));
    const wrong = after.filter(s => {
      const want = placeOf[`${s.faction}|${s.terrain}`] || homeOf[s.faction];
      return s.bg !== want || !s.painted.includes(want);
    });
    ok(`off the list, each place is drawn on its own ground and nowhere else (${table.files.length} places, ${after.length - table.files.length} fights left on the home picture)`,
      wrong.length === 0 && after.filter(s => s.bg !== homeOf[s.faction]).length === table.files.length);
    ok('and the ground is still drawn over it, as over the home picture',
      after.filter(s => s.terrain !== 'OPEN_ROAD').every(s => s.drawn));

    // The ground line belongs to the PICTURE. A painted foreground on the home picture is not on
    // the place, so reading the home's lift would stand the squad in mid-air on the new one.
    const lift = await page.evaluate(() => {
      const held = PENDING_ART.splice(0);
      const probe = '31vh';
      const out = FIGHT_NODES.map(f => {
        const [g, file] = Object.entries(FACTIONS[f].places)[0];
        localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
        currentSector = 2; currentTier = 4;
        const had = GROUND_LIFT[file];
        GROUND_LIFT[file] = probe;
        forecastTerrain = g; initiateCombat(f, false); combatActive = false;
        const r = { f, margin: document.querySelector('.battlefield').style.marginBottom,
                    lift: document.getElementById('combat-sky-layer').style.getPropertyValue('--ground-lift') };
        if (had === undefined) delete GROUND_LIFT[file]; else GROUND_LIFT[file] = had;
        return r;
      });
      PENDING_ART.push(...held);
      return { probe, out };
    });
    // What that means today, printed rather than asserted: a place that arrives with a painted
    // foreground of its own gets a GROUND_LIFT entry of its own, and that is not a failure.
    const moved = after.filter(s => placeOf[`${s.faction}|${s.terrain}`])
      .map(s => ({ f: s.faction, was: before.find(b => b.faction === s.faction && b.terrain === s.terrain).lift, now: s.lift }))
      .filter(m => m.was !== m.now);
    ok(`a place stands the squad on its own ground line, not its home\u2019s (${lift.out.filter(r => r.margin === lift.probe && r.lift === lift.probe).length}/${lift.out.length}; today that moves ${moved.map(m => `${m.f.toLowerCase()} ${m.was}->${m.now}`).join(', ') || 'nobody'})`,
      lift.out.every(r => r.margin === lift.probe && r.lift === lift.probe));

    // ---- and it keeps the sound of home ----
    const beds = await page.evaluate(() => FIGHT_NODES.map(f => {
      const file = Object.values(FACTIONS[f].places)[0];
      return { f, same: ambienceFor(file) === ambienceFor(FACTIONS[f].bg), own: !!AMBIENCE[FACTIONS[f].bg],
               notWastes: ambienceFor(file).name !== 'WASTES' };
    }));
    ok(`a place sounds like its faction’s home picture until it has a bed of its own (${beds.filter(b => b.same).length}/${beds.length})`,
      beds.every(b => b.same) && beds.filter(b => b.own).every(b => b.notWastes));
    const homeBed = Object.fromEntries(await page.evaluate(() => FIGHT_NODES.map(f => [f, ambienceFor(FACTIONS[f].bg).name])));
    const liveBed = after.filter(s => placeOf[`${s.faction}|${s.terrain}`]).map(s => ({ f: s.faction, biome: s.biome, want: homeBed[s.faction] }));
    ok(`and a fight on one plays it (${liveBed.map(b => `${b.f.toLowerCase()} ${b.biome}`).join(', ')})`,
      liveBed.length === table.files.length && liveBed.every(b => b.biome && b.biome === b.want));
    const own = await page.evaluate(() => {
      const file = FACTIONS.RAIDERS.places.OPEN_FLATS;
      AMBIENCE[file] = { ...AMBIENCE['bg_canyon.webp'], name: 'PROBE' };
      const got = ambienceFor(file).name;
      delete AMBIENCE[file];
      return { got, unknown: ambienceFor('bg_not_a_place.webp').name };
    });
    ok('a bed of its own wins over home, and a picture that is not a place still falls back to the wastes',
      own.got === 'PROBE' && own.unknown === 'WASTES');

    // ---- what a place must not touch ----
    const kept = await page.evaluate(() => {
      const held = PENDING_ART.splice(0);
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      currentSector = 1; currentTier = openingTier();
      forecastTerrain = 'OPEN_FLATS'; initiateCombat('RAIDERS', false); combatActive = false;
      const opening = combatBgFile;
      currentSector = 2; currentTier = 10;
      forecastTerrain = 'TUNNELS'; initiateCombat('BOSS', false); combatActive = false;
      const arena = { bg: combatBgFile, want: bossForSector().bg };
      PENDING_ART.push(...held);
      return { opening, arena };
    });
    ok(`the opening fight keeps its own picture, whatever ground it is handed (${kept.opening})`,
      kept.opening === 'bg_combat.webp');
    ok(`and so does a commander’s arena (${kept.arena.bg})`, kept.arena.bg === kept.arena.want);
    const manual = await page.evaluate(() => {
      return CODEX.find(e => e.id === 'GROUND_SKY').body().join(' ');
    });
    ok('the field manual no longer tells the player a faction’s picture is of its home ground',
      /home ground/i.test(manual) && !/picture of/i.test(manual));
  }
};


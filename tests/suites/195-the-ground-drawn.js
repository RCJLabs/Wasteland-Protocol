// Y02. Five grounds bend real rules - a tunnel frees every blade and punishes every blast, water
// drags a swing and carries the blast, the flats hand the fight to the rifles - and on the field
// each was one line of coloured text. The backdrop is the FACTION's, so a Mech fight on RUINS and
// a Mech fight in TUNNELS stood in the same refinery, and the Beasts' tunnel was a sunlit canyon.
//
// The ground is drawn in two layers either side of the squad: one over the weather and under the
// field, and one over the feet and under everything that has to be read. These rows hold where
// each sits, that neither can take a tap or cover a number, that each ground looks like its own
// description in its own banner's colour, and the same cost shape the sky holds in suite 194.
//
// ONE ROW EXISTS BECAUSE THE FIRST CUT WAS WRONG AT A WIDTH NOBODY HAD LOOKED AT. The ruins' wall
// was placed at a share of the screen's width, which stood it in front of the front rank at 390
// and under the enemy's turret at 1280 - the field does not centre its teams at every width. It
// hangs off the squad now, and the row asks at both widths.
const DRAWN = ['dim', 'gloom', 'walls', 'haze', 'ceiling', 'lamps', 'shimmer', 'floor', 'cover',
  'rubble', 'reflect', 'ripple', 'surface', 'eggs'];
// What each ground was pitched as, in the words it was approved in - "water sheen on FLOODED,
// rubble on RUINS, low ceiling in TUNNELS, heat shimmer on OPEN FLATS, egg-sacs in the NEST" - and
// the kind that draws it. Held against what is DRAWN, not against the table: a row that compared
// the table with itself passed with the tunnel's roof deleted from both.
const PROMISED = { FLOODED: 'surface', RUINS: 'rubble', TUNNELS: 'ceiling', OPEN_FLATS: 'shimmer', NEST: 'eggs' };
// Which faction's backdrop each ground is photographed on: the one it is that faction's signature on.
const HOME = { TUNNELS: 'BEASTS', OPEN_FLATS: 'RAIDERS', RUINS: 'MECH', FLOODED: 'CHOIR', NEST: 'CARRION' };

module.exports = {
  name: 'The ground, drawn',
  run: async ({ page, ok, base, engineUp, resized }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    await resized(page, { width: 390, height: 844 });

    const onGround = (ground, opts = {}) => page.evaluate(({ ground, faction, opts }) => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 4;
      globalSettings.motion = opts.motion || 'full';
      forecastTerrain = ground; initiateCombat(faction, false);
      currentWeather = opts.sky || 'CLEAR'; applyCombatScenery(combatBgFile, null);
      combatActive = false;
      return { ...groundFxState(), bg: combatBgFile, terrain: currentTerrain };
    }, { ground, faction: opts.faction || HOME[ground] || 'RAIDERS', opts });

    // ---- the table: every ground with a rule has a look, read off its own words ----
    const table = await page.evaluate(kinds => {
      const ruled = TERRAIN_IDS.filter(id => TERRAIN[id].banner);
      return { ruled, bare: ruled.filter(id => !TERRAIN[id].fx), roadDrawn: !!TERRAIN.OPEN_ROAD.fx,
               unknown: ruled.flatMap(id => (TERRAIN[id].fx ? TERRAIN[id].fx.layers : [])
                 .filter(L => !kinds.includes(L.kind)).map(L => `${id}:${L.kind}`)) };
    }, DRAWN);
    ok(`every one of the ${table.ruled.length} grounds with a rule has a look (${table.bare.join(', ') || 'none bare'})`,
      table.ruled.length >= 5 && table.bare.length === 0);
    ok('and OPEN ROAD has none, because it is the ground as painted', !table.roadDrawn);
    ok(`every layer is a kind the renderer draws (${table.unknown.join(', ') || 'none unknown'})`,
      table.unknown.length === 0);

    const road = await onGround('OPEN_ROAD', { faction: 'RAIDERS' });
    ok('an open road draws nothing at all', !road.built && !road.cover && road.id === null);

    // ---- each ground draws what its table says, and wears its banner's colour ----
    // The colour is read off the BANNER as the page paints it - the stylesheet's tr-* class - not
    // off the table, so a drawing that drifts from its own line of text is caught.
    const drawn = [];
    for (const g of Object.keys(HOME)) {
      const st = await onGround(g);
      const look = await page.evaluate(id => {
        const want = TERRAIN[id].fx.layers.map(L => L.kind);
        const banner = getComputedStyle(document.getElementById('ground-banner')).color.match(/\d+/g).map(Number).slice(0, 3);
        const worn = TERRAIN[id].fx.layers.some(L => [L.rgb, L.hi].some(c => c && c.every((v, i) => v === banner[i])));
        return { want, banner, worn };
      }, g);
      const have = new Set([...st.back, ...st.front, ...(st.cover ? ['cover'] : [])]);
      drawn.push({ g, ok: st.built && st.id === g && look.want.every(k => have.has(k)), missing: look.want.filter(k => !have.has(k)),
                   worn: look.worn, banner: look.banner, have: [...have] });
    }
    ok(`each of the five draws everything its table says (${drawn.filter(d => !d.ok).map(d => `${d.g} missing ${d.missing.join('+')}`).join('; ') || 'all five'})`,
      drawn.length === 5 && drawn.every(d => d.ok));
    ok(`and each wears its own banner's colour somewhere (${drawn.filter(d => !d.worn).map(d => `${d.g} ${d.banner}`).join('; ') || 'all five'})`,
      drawn.every(d => d.worn));
    ok(`and each draws the thing it was promised as (${Object.entries(PROMISED).filter(([g, k]) => !drawn.find(d => d.g === g).have.includes(k)).map(([g, k]) => `${g} has no ${k}`).join('; ') || 'all five'})`,
      Object.entries(PROMISED).every(([g, k]) => drawn.find(d => d.g === g).have.includes(k)));

    // ---- where it sits ----
    await onGround('FLOODED');
    const stack = await page.evaluate(() => {
      const layer = document.getElementById('combat-sky-layer');
      const back = layer.querySelector(':scope > .ground-fx'), front = layer.querySelector(':scope > .ground-fx-front');
      const z = el => Number(getComputedStyle(el).zIndex) || 0;
      const cards = [...document.querySelectorAll('.battlefield .entity')].map(z);
      // what is drawn over the whole field, read off the stylesheet rather than written here
      const over = [];
      [...document.styleSheets].forEach(sh => { let rules; try { rules = sh.cssRules; } catch (e) { return; }
        [...rules].forEach(r => { if (r.selectorText && /\.(fx-layer|tracer-line)\b/.test(r.selectorText) && r.style.zIndex) over.push(Number(r.style.zIndex)); }); });
      return { afterSky: !!back && back.previousElementSibling === layer.querySelector(':scope > .sky-fx'),
               backZ: z(back), frontZ: z(front), cardsMax: Math.max(...cards), overMin: Math.min(...over), overN: over.length,
               pe: [back, front].map(el => getComputedStyle(el).pointerEvents) };
    });
    ok('the ground is drawn directly over the weather, at the same depth under everything else',
      stack.afterSky && stack.backZ === 0);
    ok(`and what stands in front of the feet is over every card (${stack.frontZ} against ${stack.cardsMax}) and under everything drawn over the field (${stack.overMin})`,
      stack.overN >= 2 && stack.frontZ > stack.cardsMax && stack.frontZ < stack.overMin);

    // A tap on an ankle standing in the water lands exactly where it would with no water at all.
    // The first draft asked that it land on its OWN card, and one did not - a neighbour's sprite
    // is 100px wide, overlaps its ankles and stacks above it, which is the field's layout and was
    // true before any ground was drawn. What the ground owes is to change nothing, so that is what
    // is asked: every ankle, with the ground and with the ground hidden, hits the same element.
    const taps = await page.evaluate(() => {
      const points = [...document.querySelectorAll('.battlefield .entity .portrait')].map(img => {
        const p = img.getBoundingClientRect(); return [p.left + p.width / 2, p.bottom - 3];
      });
      const hits = () => points.map(([x, y]) => document.elementFromPoint(x, y));
      const withGround = hits();
      const layers = [...document.querySelectorAll('.ground-fx, .ground-fx-front')];
      layers.forEach(l => { l.style.display = 'none'; });
      const without = hits();
      layers.forEach(l => { l.style.display = ''; });
      return { n: points.length, moved: withGround.filter((h, i) => h !== without[i]).length,
               swallowed: withGround.filter(h => h && h.closest('.ground-fx, .ground-fx-front')).length };
    });
    ok(`neither layer takes a tap: all ${taps.n} ankles in the water hit what they would hit on dry ground (${taps.moved} moved)`,
      stack.pe.every(p => p === 'none') && taps.n > 0 && taps.moved === 0 && taps.swallowed === 0);

    // Nothing drawn in front of the squad reaches a number, an intent or a flag - at either extreme
    // of the band the front layer can draw: the water's surface and the ruins' rubble.
    const clear = [];
    for (const g of ['FLOODED', 'RUINS']) {
      await onGround(g);
      clear.push(await page.evaluate(g => {
        const parts = [...document.querySelectorAll('.ground-fx-front > *')].map(el => el.getBoundingClientRect());
        const top = Math.min(...parts.map(r => r.top));
        const readable = [...document.querySelectorAll('.battlefield .entity .hp-container, .battlefield .entity .intent-icon')]
          .map(el => el.getBoundingClientRect()).filter(r => r.height > 0);
        const low = Math.max(...readable.map(r => r.bottom));
        const feet = document.querySelector('.battlefield').getBoundingClientRect().bottom;
        return { g, parts: parts.length, gap: Math.round(top - low), reach: Math.round(feet - top) };
      }, g));
    }
    ok(`nothing in front of the feet reaches a card's hit points or intent (${clear.map(c => `${c.g} ${c.gap}px clear`).join(', ')})`,
      clear.every(c => c.parts > 0 && c.gap > 0));
    ok(`and it rises no higher than an ankle (${clear.map(c => `${c.g} ${c.reach}px`).join(', ')})`,
      clear.every(c => c.reach >= 0 && c.reach <= 12));

    // ---- the water is the place itself, upside down ----
    await onGround('FLOODED');
    const water = await page.evaluate(() => {
      const r = document.querySelector('.ground-fx .ground-reflect');
      const cs = getComputedStyle(r);
      const layer = document.getElementById('combat-sky-layer').getBoundingClientRect();
      const feet = document.querySelector('.battlefield').getBoundingClientRect().bottom - layer.top;
      return { m: cs.transform, originY: parseFloat(cs.transformOrigin.split(' ')[1]), feet, img: cs.backgroundImage, bg: combatBgFile };
    });
    ok(`the flooded floor is the fight's own backdrop mirrored about the feet line (${water.originY.toFixed(0)} against ${water.feet.toFixed(0)})`,
      water.m === 'matrix(1, 0, 0, -1, 0, 0)' && Math.abs(water.originY - water.feet) <= 1 && water.img.includes(water.bg));

    // ---- the ruins' wall stands at the squad's front rank, wherever the field puts the squad ----
    const wallAt = async size => {
      await resized(page, size);
      await onGround('RUINS');
      return page.evaluate(() => {
        const team = document.getElementById('player-team'), tr = team.getBoundingClientRect();
        const cs = getComputedStyle(team, '::before');
        const width = parseFloat(cs.width), height = parseFloat(cs.height);
        const right = tr.right - parseFloat(cs.right), left = right - width, top = tr.bottom - parseFloat(cs.bottom) - height;
        const cards = [...team.querySelectorAll('.entity')].map(e => e.getBoundingClientRect());
        const front = cards.reduce((a, b) => (b.right > a.right ? b : a));
        const foes = [...document.querySelectorAll('#enemy-team .entity')].map(e => e.getBoundingClientRect());
        const nearest = foes.reduce((a, b) => (b.left < a.left ? b : a));
        const hp = Math.max(...[...team.querySelectorAll('.hp-container')].map(h => h.getBoundingClientRect().bottom));
        return { content: cs.content, straddles: left < front.right && right > front.right,
                 short: right <= nearest.left, belowHp: top > hp, clearOf: Math.round(nearest.left - right),
                 at: Math.round(right - front.right), w: Math.round(width) };
      });
    };
    const narrow = await wallAt({ width: 390, height: 844 }), wide = await wallAt({ width: 1280, height: 800 });
    await resized(page, { width: 390, height: 844 });
    ok(`the ruins' wall stands at the squad's front rank at 390 and at 1280, out into the gap and short of the enemy's line (${narrow.at}px past it and ${narrow.clearOf}px short; ${wide.at}px and ${wide.clearOf}px)`,
      [narrow, wide].every(w => w.content !== 'none' && w.straddles && w.short));
    ok('and it is cover, not a curtain: its top is below every hit-point bar in the squad',
      narrow.belowHp && wide.belowHp);
    const nestWall = await onGround('NEST');
    const nestContent = await page.evaluate(() => getComputedStyle(document.getElementById('player-team'), '::before').content);
    ok('and no other ground puts it up', !nestWall.cover && nestContent === 'none');
    // Built over another ground without leaving the fight - which nothing does today, and which a
    // commander turning the ground the way the Stormcaller turns the sky would. Leaving the fight
    // clears the wall on its own, so every other row walks past the builder's own clean-up.
    const turned = await page.evaluate(() => {
      forecastTerrain = 'RUINS'; currentSector = 2; currentTier = 4; initiateCombat('MECH', false); combatActive = false;
      const had = groundFxState().cover;
      currentTerrain = 'NEST'; applyCombatScenery(combatBgFile, null);
      return { had, st: groundFxState() };
    });
    ok('and a ground drawn over the ruins without leaving the fight keeps nothing of them',
      turned.had && turned.st.id === 'NEST' && !turned.st.cover);

    // ---- the cost shape, asked of every ground ----
    const cheap = await page.evaluate(async ids => {
      const names = new Set(), bad = [], moving = {};
      let canvases = 0;
      for (const id of ids) {
        forecastTerrain = id; currentSector = 2; currentTier = 4; initiateCombat({ TUNNELS: 'BEASTS', OPEN_FLATS: 'RAIDERS', RUINS: 'MECH', FLOODED: 'CHOIR', NEST: 'CARRION' }[id], false);
        combatActive = false;
        const layers = [...document.querySelectorAll('.ground-fx, .ground-fx-front')];
        canvases += layers.reduce((n, l) => n + l.querySelectorAll('canvas').length, 0);
        const anims = layers.flatMap(l => l.getAnimations({ subtree: true }));
        anims.forEach(a => names.add(a.animationName));
        moving[id] = anims.filter(a => a.playState === 'running').length;
        document.querySelectorAll('.ground-drift').forEach(t => {
          const [tw, th] = getComputedStyle(t).backgroundSize.split(' ').map(parseFloat);
          const dx = parseFloat(t.style.getPropertyValue('--dx')), dy = parseFloat(t.style.getPropertyValue('--dy'));
          if (Math.abs(dx / tw - Math.round(dx / tw)) > 1e-6 || Math.abs(dy / th - Math.round(dy / th)) > 1e-6 || (!dx && !dy)) bad.push(`${id} ${dx}/${tw} ${dy}/${th}`);
        });
      }
      const props = new Set();
      [...document.styleSheets].forEach(sh => { let rules; try { rules = sh.cssRules; } catch (e) { return; }
        [...rules].forEach(r => { if (r.type === CSSRule.KEYFRAMES_RULE && names.has(r.name))
          [...r.cssRules].forEach(k => [...k.style].forEach(p => props.add(p))); }); });
      return { canvases, names: [...names], props: [...props], bad, moving };
    }, Object.keys(HOME));
    ok('nothing in either layer is a canvas redrawn every frame', cheap.canvases === 0);
    ok(`and everything that moves moves on transform or opacity (${cheap.props.join(', ')})`,
      cheap.names.length >= 3 && cheap.props.every(p => p === 'transform' || p === 'opacity'));
    ok(`every drifting tile travels a whole number of tiles, so its end is its start (${cheap.bad.join('; ') || 'all seamless'})`,
      cheap.bad.length === 0);
    ok(`the water, the heat, the lamps and the eggs all move (${['FLOODED', 'OPEN_FLATS', 'TUNNELS', 'NEST'].map(g => `${g} ${cheap.moving[g]}`).join(', ')})`,
      ['FLOODED', 'OPEN_FLATS', 'TUNNELS', 'NEST'].every(g => cheap.moving[g] > 0));

    // ---- the switches ----
    const still = await onGround('FLOODED', { motion: 'off' });
    const stillMoving = await page.evaluate(() => [...document.querySelectorAll('.ground-fx, .ground-fx-front')]
      .flatMap(l => l.getAnimations({ subtree: true })).filter(a => a.playState === 'running').length);
    ok(`with motion off the ground is still there, and nothing in it moves (${stillMoving} running)`,
      still.built && still.still && stillMoving === 0);

    const sim = await page.evaluate(() => {
      paintOff = true;
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      groundFxClear(); currentSector = 2; currentTier = 4; forecastTerrain = 'NEST'; initiateCombat('CARRION', false);
      const st = groundFxState(); paintOff = false; combatActive = false; return st;
    });
    ok('the simulator, which paints nothing, draws no ground', !sim.built && !sim.cover);

    await onGround('RUINS');
    const left = await page.evaluate(() => { renderMap(); return groundFxState(); });
    ok('leaving the fight takes the ground down with it, the wall included', !left.built && !left.cover && left.id === null);
    // what a fight resumed from a save does: the scenery is applied again
    const back = await page.evaluate(() => { switchScreen('screen-combat'); applyCombatScenery(combatBgFile, null); return groundFxState(); });
    ok('and a fight that comes back from a save draws it again', back.built && back.cover && back.id === 'RUINS');
    await page.evaluate(() => { combatActive = false; renderMap(); });

    // ---- a sky over its faction's ground: both are drawn, in that order ----
    const both = await onGround('NEST', { sky: 'SANDSTORM' });
    const order = await page.evaluate(() => {
      const kids = [...document.getElementById('combat-sky-layer').children];
      return { sky: skyFxState().built, conf: !!confluence(), i: kids.findIndex(k => k.classList.contains('sky-fx')), j: kids.findIndex(k => k.classList.contains('ground-fx')) };
    });
    ok('a sandstorm over the nest draws the storm and the nest, the ground over the sky',
      both.built && order.sky && order.conf && order.i >= 0 && order.j === order.i + 1);
  }
};

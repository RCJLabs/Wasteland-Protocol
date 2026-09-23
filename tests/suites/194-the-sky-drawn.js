// Y01. C06 gave seven skies real rules and every one of them looked the same on the field: the
// faction's backdrop under one fixed red gradient, with the sky named in a banner and nowhere else.
// There was no canvas in the game. A sandstorm that blinds the guns and an ion storm that speeds
// every cooldown were a line of text apiece.
//
// MEASURED, THREE TIMES, BEFORE IT SHIPPED. The first cut was a canvas redrawn thirty times a
// second and it cost 460-840 ms of main thread per second at 4x CPU throttle, against 3 for a clear
// sky - on the sandstorm an EMPTY canvas invalidated every frame cost 232 ms/s on its own. The
// shipped version draws each particle field once into a tile and lets CSS slide it on transform.
// The third measurement caught the lightning, which still built a strike per flash at about 35 ms
// each. The rows below hold the SHAPE that makes it cheap rather than a frame-rate, which would be
// a bound inside its own noise.
//
// And twice the first pass of a sky read as nothing at phone size - four of seven indistinguishable
// from CLEAR until each got a pall, and the shrapnel twice more after that. The colour rows pin what
// each sky IS from outside the table, so a pall that drifts to the wrong colour goes red.
const DRAWN = ['bank', 'fall', 'rise', 'streak', 'veil', 'bolt'];

module.exports = {
  name: 'The sky, drawn',
  run: async ({ page, ok, base, engineUp }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    const under = (sky, opts = {}) => page.evaluate(({ sky, opts }) => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      if (opts.motion) globalSettings.motion = opts.motion;
      initiateCombat('RAIDERS', false);
      currentWeather = sky; applyCombatScenery(combatBgFile, null);
      return skyFxState();
    }, { sky, opts });

    // ---- one table, and every sky on it has a look ----
    const table = await page.evaluate(kinds => {
      const named = Object.keys(WEATHER).filter(id => id !== 'CLEAR');
      return { named: named.length,
               bare: named.filter(id => !WEATHER[id].fx),
               clearDrawn: !!WEATHER.CLEAR.fx,
               // a kind the renderer does not know draws nothing, silently
               unknown: named.flatMap(id => (WEATHER[id].fx ? WEATHER[id].fx.layers : [])
                 .filter(L => !kinds.includes(L.kind)).map(L => `${id}:${L.kind}`)),
               noPall: named.filter(id => WEATHER[id].fx && !WEATHER[id].fx.pall) };
    }, DRAWN);
    ok(`every one of the ${table.named} skies has a look (${table.bare.join(', ') || 'none bare'})`,
      table.named >= 7 && table.bare.length === 0);
    ok('and CLEAR has none, because a clear sky is the backdrop as painted', !table.clearDrawn);
    ok(`every layer is a kind the renderer draws (${table.unknown.join(', ') || 'none unknown'})`,
      table.unknown.length === 0);
    // Without a pall, four of seven skies were indistinguishable from CLEAR on the highway: the
    // painted blue sky said "clear day" whatever drifted in front of it.
    ok(`and every sky re-colours the sky itself (${table.noPall.join(', ') || 'all have a pall'})`,
      table.noPall.length === 0);

    // ---- built for a sky, and nothing for a clear one ----
    const clear = await under('CLEAR');
    ok('a clear sky builds nothing at all', !clear.built && clear.planes === 0);
    const skies = await page.evaluate(() => Object.keys(WEATHER).filter(id => id !== 'CLEAR'));
    const built = [];
    for (const sky of skies) { const st = await under(sky); built.push({ sky, ok: st.built && st.id === sky }); }
    ok(`every sky builds its layer when the fight opens under it (${built.filter(b => !b.ok).map(b => b.sky).join(', ') || 'all seven'})`,
      built.every(b => b.ok));

    // ---- where it sits: over the backdrop, under everything drawn on it ----
    await under('SANDSTORM');
    const place = await page.evaluate(() => {
      const layer = document.getElementById('combat-sky-layer'), fx = layer.querySelector('.sky-fx');
      const cs = getComputedStyle(fx);
      const others = [...layer.children].filter(c => c !== fx);
      // every other child must be positioned, or it paints BEFORE a positioned layer and sits under it
      const under = others.filter(c => getComputedStyle(c).position === 'static').map(c => c.id || c.className);
      const banner = document.getElementById('weather-banner').getBoundingClientRect();
      const top = document.elementFromPoint(banner.left + banner.width / 2, banner.top + banner.height / 2);
      const foe = activeEntities.find(e => !e.isPlayer);
      const fel = document.getElementById(foe.id);
      const fb = fel.getBoundingClientRect();
      const hit = document.elementFromPoint(fb.left + fb.width / 2, fb.top + fb.height / 2);
      return { first: layer.firstElementChild === fx, z: cs.zIndex, pe: cs.pointerEvents, under,
               bannerOnTop: !!top && document.getElementById('weather-banner').contains(top),
               foeTakesTap: !!hit && fel.contains(hit) };
    });
    ok('the weather is the first thing over the backdrop', place.first && place.z === '0');
    ok(`and everything else on the field paints above it (${place.under.join(', ') || 'nothing underneath'})`,
      place.under.length === 0);
    ok('the banner naming the sky is on top of the sky it names', place.bannerOnTop);
    ok('and it never takes a tap: a hostile under it is still the thing a tap lands on',
      place.pe === 'none' && place.foeTakesTap);

    // ---- the shape that makes it cheap ----
    // Asked of EVERY sky, not one: the first draft read only the sandstorm, which has no flicker,
    // so the opacity animation - half of what the layer can run - was never looked at.
    const cheap = await page.evaluate(() => {
      const fx = document.querySelector('.sky-fx');
      const names = new Set();
      Object.keys(WEATHER).filter(id => WEATHER[id].fx).forEach(id => {
        currentWeather = id; applyCombatScenery(combatBgFile, null);
        fx.getAnimations({ subtree: true }).forEach(a => names.add(a.animationName));
      });
      // what the stylesheet actually animates under those names, read off the sheet itself
      const props = new Set();
      [...document.styleSheets].forEach(sh => { let rules; try { rules = sh.cssRules; } catch (e) { return; }
        [...rules].forEach(r => { if (r.type === CSSRule.KEYFRAMES_RULE && names.has(r.name))
          [...r.cssRules].forEach(k => [...k.style].forEach(p => props.add(p))); }); });
      return { canvases: fx.querySelectorAll('canvas').length, names: [...names], props: [...props] };
    });
    ok('nothing in it is a canvas redrawn every frame', cheap.canvases === 0);
    ok(`and everything that moves moves on transform or opacity, which the compositor does without `
       + `a repaint (${cheap.props.join(', ')})`,
      cheap.names.length > 0 && cheap.props.every(p => p === 'transform' || p === 'opacity'));

    // ---- seamless, and never leaves a gap ----
    const loops = await page.evaluate(() => {
      const bad = [], gaps = [];
      Object.keys(WEATHER).filter(id => WEATHER[id].fx).forEach(id => {
        currentWeather = id; applyCombatScenery(combatBgFile, null);
        const field = document.querySelector('.sky-fx').getBoundingClientRect();
        document.querySelectorAll('.sky-fx-tile').forEach(t => {
          const cs = getComputedStyle(t);
          const [tw, th] = cs.backgroundSize.split(' ').map(parseFloat);
          const dx = parseFloat(t.style.getPropertyValue('--dx')), dy = parseFloat(t.style.getPropertyValue('--dy'));
          if (Math.abs(dx / tw - Math.round(dx / tw)) > 1e-6 || Math.abs(dy / th - Math.round(dy / th)) > 1e-6)
            bad.push(`${id} ${dx}/${tw} ${dy}/${th}`);
          // the element's box at the start and at the end of one loop, against the field
          const box = { l: t.offsetLeft, t: t.offsetTop, r: t.offsetLeft + t.offsetWidth, b: t.offsetTop + t.offsetHeight };
          const band = t.classList.contains('sky-bank');
          [[0, 0], [dx, dy]].forEach(([ox, oy]) => {
            const covers = box.l + ox <= 0.5 && box.r + ox >= field.width - 0.5
              && (band || (box.t + oy <= 0.5 && box.b + oy >= field.height - 0.5));
            if (!covers) gaps.push(`${id}:${t.className.split(' ')[1]}@${ox ? 'end' : 'start'}`);
          });
        });
      });
      return { bad, gaps };
    });
    ok(`every loop travels a whole number of tiles, so its end is its start (${loops.bad.join('; ') || 'all whole'})`,
      loops.bad.length === 0);
    ok(`and covers the field at both ends of the loop (${loops.gaps.join('; ') || 'no gaps'})`,
      loops.gaps.length === 0);

    // ---- what each sky IS, pinned from outside the table ----
    const colour = async sky => { await under(sky); return page.evaluate(() => {
      const bg = getComputedStyle(document.querySelector('.sky-fx-still')).backgroundImage;
      // The pall is the one gradient with no direction - top to bottom is the default, and a
      // computed style drops a default - fading to nothing. Its first stop is the sky's colour.
      // The first draft of this fell back to "the first colour found", which for blood haze was
      // the veil, not the pall: it passed while testing the wrong gradient.
      const m = /linear-gradient\(rgba\((\d+), (\d+), (\d+), ([\d.]+)\)(?: [\d.]+%)?, rgba\(\d+, \d+, \d+, 0\)/.exec(bg);
      return m ? m.slice(1, 4).map(Number) : null; }); };
    const c = {};
    for (const sky of ['TOXIC_SMOG', 'SANDSTORM', 'ION_STORM', 'BLOOD_HAZE', 'ASHFALL']) c[sky] = await colour(sky);
    const f = rgb => rgb ? rgb.join(',') : 'none';
    ok(`smog is yellow air, as its own description says (${f(c.TOXIC_SMOG)})`,
      !!c.TOXIC_SMOG && c.TOXIC_SMOG[1] >= c.TOXIC_SMOG[0] * 0.9 && c.TOXIC_SMOG[0] > c.TOXIC_SMOG[2] * 2);
    ok(`a sandstorm is warm grit (${f(c.SANDSTORM)})`,
      !!c.SANDSTORM && c.SANDSTORM[0] > c.SANDSTORM[1] && c.SANDSTORM[1] > c.SANDSTORM[2]);
    ok(`an ion storm is cold (${f(c.ION_STORM)})`, !!c.ION_STORM && c.ION_STORM[2] > c.ION_STORM[0] * 2);
    ok(`blood haze is red (${f(c.BLOOD_HAZE)})`,
      !!c.BLOOD_HAZE && c.BLOOD_HAZE[0] > c.BLOOD_HAZE[1] * 3 && c.BLOOD_HAZE[0] > c.BLOOD_HAZE[2] * 3);
    ok(`and ash is grey (${f(c.ASHFALL)})`, !!c.ASHFALL && Math.max(...c.ASHFALL) - Math.min(...c.ASHFALL) < 30);

    // Blood haze's rule is that your back rank is hard to find, so the haze is heaviest over it.
    // Where the back rank stands is measured off the field, not assumed.
    await under('BLOOD_HAZE');
    const veil = await page.evaluate(() => {
      const field = document.querySelector('.sky-fx').getBoundingClientRect();
      const back = playerRoster.find(p => p.gridPos === 3);
      const b = back && document.getElementById(back.id) ? document.getElementById(back.id).getBoundingClientRect() : null;
      const bg = getComputedStyle(document.querySelector('.sky-fx-still')).backgroundImage;
      return { backAt: b ? +((b.left + b.width / 2 - field.left) / field.width).toFixed(2) : null,
               heavyLeft: /linear-gradient\(to right, rgba\(\d+, \d+, \d+, 0\.[1-9]/.test(bg) };
    });
    ok(`and the haze is heaviest over your back rank, which stands ${veil.backAt} of the way across`,
      veil.backAt !== null && veil.backAt < 0.5 && veil.heavyLeft);

    // ---- the three switches ----
    const still = await under('ION_STORM', { motion: 'off' });
    const moving = await page.evaluate(() => ({
      running: document.querySelector('.sky-fx').getAnimations({ subtree: true }).filter(a => a.playState === 'running').length,
      shown: [...document.querySelectorAll('.sky-fx .sky-strike')].filter(b => getComputedStyle(b).display !== 'none').length }));
    ok('with motion off the weather is still there - it is information, not decoration',
      still.built && still.planes > 0 && still.still);
    ok(`but nothing in it moves (${moving.running} running) and none of its ${still.bolts} bolts is on screen (${moving.shown})`,
      moving.running === 0 && still.bolts > 0 && moving.shown === 0);
    await page.evaluate(() => { globalSettings.motion = 'full'; });

    const sim = await page.evaluate(() => {
      paintOff = true;
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      skyFxClear(); initiateCombat('RAIDERS', false);
      currentWeather = 'ASHFALL'; applyCombatScenery(combatBgFile, null);
      const st = skyFxState(); paintOff = false; return st;
    });
    ok('the simulator, which paints nothing, builds nothing', !sim.built);

    await under('ASHFALL');
    const left = await page.evaluate(() => { renderMap(); return skyFxState(); });
    ok('leaving the fight takes the weather down with it', !left.built && left.id === null);

    // ---- the sky changing mid-fight ----
    const turned = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      currentWeather = 'ASHFALL'; applyCombatScenery(combatBgFile, null);
      const boss = activeEntities.find(e => !e.isPlayer);
      turnTheSky(boss);
      return { now: currentWeather, drawn: skyFxState().id };
    });
    ok(`when the Stormcaller turns the sky over, the drawn sky turns with it (${turned.now})`,
      turned.now !== 'ASHFALL' && turned.drawn === turned.now);

    // ---- the lightning, and what a flash costs ----
    // A strike built per flash on a timer cost about 35 ms of main thread each at 4x throttle, and
    // re-lighting one element built in advance cost the same: a one-shot animation takes several
    // full frames to start and to finish. So each bolt is drawn once and runs an endless compositor
    // cycle that flashes in its last sliver, and these rows hold that shape. Where the motion-off
    // player stands is the row above: no bolt on screen.
    const storm = await page.evaluate(async () => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      globalSettings.motion = 'full';
      initiateCombat('RAIDERS', false); currentWeather = 'ION_STORM'; applyCombatScenery(combatBgFile, null);
      const bolts = [...document.querySelectorAll('.sky-fx .sky-strike')];
      const anims = bolts.map(b => b.getAnimations()[0]).filter(Boolean);
      const timing = anims.map(a => a.effect.getComputedTiming());
      const every = WEATHER.ION_STORM.fx.layers.find(L => L.kind === 'bolt').every;
      const meanGap = 1 / timing.reduce((sum, t) => sum + 1000 / t.duration, 0);
      // Each bolt at the top of its flash and halfway through its dark, read off the page rather
      // than the keyframes, so a flash that never reaches the screen is caught. A bolt starts
      // part-way into its cycle on a NEGATIVE delay, and where it is in the cycle is currentTime
      // minus that delay - so the seek adds the delay back, plus one whole cycle to stay positive.
      // The first draft subtracted it, counted it twice, and read every bolt at the wrong moment.
      const seek = (a, p) => { const t = a.effect.getTiming(); a.currentTime = t.duration * (p + 1) + t.delay; };
      const lit = anims.map((a, i) => {
        a.pause(); seek(a, 0.985); const on = +getComputedStyle(bolts[i]).opacity;
        seek(a, 0.5); const off = +getComputedStyle(bolts[i]).opacity; a.play(); return { on, off };
      });
      // Then the storm forty times over, until every bolt has come round at least once, watching
      // the layer the whole time: a flash may not add, remove or rewrite anything in the page.
      let changed = 0;
      const mo = new MutationObserver(ms => { changed += ms.length; });
      mo.observe(document.querySelector('.sky-fx'), { childList: true, subtree: true, attributes: true, characterData: true });
      const from = anims.map(a => a.effect.getComputedTiming().currentIteration);
      anims.forEach(a => { a.playbackRate = 40; });
      const t0 = performance.now();
      await new Promise(done => {
        const tick = () => {
          if (anims.every((a, i) => a.effect.getComputedTiming().currentIteration > from[i])
              || performance.now() - t0 > 8000) return done();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      changed += mo.takeRecords().length; mo.disconnect();
      const cycled = anims.filter((a, i) => a.effect.getComputedTiming().currentIteration > from[i]).length;
      return { bolts: bolts.length, anims: anims.length, endless: timing.filter(t => t.iterations === Infinity).length,
               every, meanGap, lit, cycled, changed };
    });
    ok(`the ion storm carries its lightning: ${storm.bolts} bolts, each on an endless cycle (${storm.endless})`,
      storm.bolts >= 2 && storm.anims === storm.bolts && storm.endless === storm.bolts);
    ok(`and between them they flash as often as the sky says - one every ${storm.meanGap.toFixed(2)}s against ${storm.every}`,
      Math.abs(storm.meanGap - storm.every) / storm.every < 0.03);
    ok(`every bolt lights at the top of its flash and is gone between (${storm.lit.map(l => `${l.on.toFixed(2)}/${l.off.toFixed(2)}`).join(', ')})`,
      storm.lit.length === storm.bolts && storm.lit.every(l => l.on > 0.95 && l.off === 0));
    ok(`and a flash changes nothing in the page: ${storm.cycled} of ${storm.bolts} bolts came round, ${storm.changed} changes`,
      storm.cycled === storm.bolts && storm.changed === 0);
  }
};

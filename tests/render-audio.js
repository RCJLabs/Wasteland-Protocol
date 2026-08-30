// The suites can tell you a bed was built and a voice was asked for. They cannot tell you the
// heat layer sat at 20Hz under a 260Hz filter, or that four of the seven beds put everything
// they had below 100Hz and would have been silent on the phone this is played on. Both of those
// shipped in the first draft of the mix and both were found here.
//
//   node tests/render-audio.js
//
// It renders the real engine's audio through an OfflineAudioContext and measures the samples.
// It asserts nothing. It is a measuring instrument, and it prints what it measured.
//
// ── Reading the output ──────────────────────────────────────────────────────────────────
// rms is loudness over the whole render; peak is the loudest single sample (>= 1.0 is
// clipping). The spectrum bar is a 12-point DFT normalised to its own row, so it compares
// bands within one sound, never across two. It is blind to pure tones that fall between its
// probe frequencies - the per-bed voice table below probes each bed at its own pitch, over a
// band, because the oscillators are detuned a few cents and a single bin reads a real tone as
// near silence.
const path = require('path');
const { serve } = require('./server');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require('playwright-core')); }

const ROOT = path.join(__dirname, '..');

// Everything below runs inside the page, against the engine's own functions.
const RENDER = async () => {
  const SR = 22050;
  const mk = secs => {
    const c = new OfflineAudioContext(1, Math.floor(SR * secs), SR);
    // startAmbience resumes a suspended context; on an offline one that throws before the
    // render has started, which would abort the bed we are here to measure.
    c.__resume = OfflineAudioContext.prototype.resume.bind(c);
    Object.defineProperty(c, 'resume', { value: () => {}, configurable: true });
    return c;
  };
  const bin = (d, f, off, N) => {
    let re = 0, im = 0; const w = 2 * Math.PI * f / SR;
    for (let i = 0; i < N; i++) { re += d[off + i] * Math.cos(w * i); im += d[off + i] * Math.sin(w * i); }
    return Math.sqrt(re * re + im * im) / (N / 2);
  };
  const band = (d, f, off, N) => {          // detune-tolerant: take the peak of a small band
    let m = 0;
    for (let k = -6; k <= 6; k++) m = Math.max(m, bin(d, f * Math.pow(2, k * 2 / 1200), off, N));
    return m;
  };
  const BANDS = [40, 60, 90, 130, 190, 280, 420, 620, 900, 1400, 2100, 3200];
  const measure = buf => {
    const d = buf.getChannelData(0);
    let sum = 0, peak = 0;
    for (let i = 0; i < d.length; i++) { sum += d[i] * d[i]; peak = Math.max(peak, Math.abs(d[i])); }
    // Window the spectrum on where the sound actually is: a 60ms blip in a 1.2s buffer read
    // from the middle of the buffer is a measurement of silence.
    let loud = 0;
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > peak * 0.5) { loud = i; break; }
    const N = Math.min(d.length - loud, SR);
    return { rms: Math.sqrt(sum / d.length), peak, bands: BANDS,
             spec: BANDS.map(f => bin(d, f, loud, N)) };
  };
  const fresh = secs => {
    const c = mk(secs);
    audioCtx = c; sfxBus = null; ambBus = null;
    globalSettings.sfx = true; globalSettings.sfxVol = 1; globalSettings.ambVol = 0.7;
    initAudio();
    return c;
  };
  const renderBed = async (bg, mom, motes) => {
    const c = fresh(6);
    combatActive = true; momentum = 0;
    startAmbience(bg);
    momentum = mom; addMomentum(0);
    // Motes fired at zero land inside the bed's 1.5s fade-in, which is not where they land in
    // play; suspend the render and fire them where a player would hear them.
    if (motes) c.suspend(3).then(() => { for (let i = 0; i < motes; i++) playMote(); c.__resume(); });
    const m = measure(await c.startRendering());
    ambienceNodes = null;
    return m;
  };
  const renderSfx = async (type, weight) => { const c = fresh(1.2); playSFX(type, weight); return measure(await c.startRendering()); };
  const renderImpact = async (dmg, maxHp, scale, hp, isPlayer) => {
    const c = fresh(1.6); playImpact(dmg, { maxHp, hp, isPlayer }, scale);
    return measure(await c.startRendering());
  };

  const out = { beds: {}, voices: [], heat: {}, motes: {}, sfx: {}, impacts: {} };
  for (const bg of Object.keys(AMBIENCE)) out.beds[AMBIENCE[bg].name] = await renderBed(bg, 0, 0);

  // Each bed probed at its own pitches, which is the only way to see the layer that carries
  // its character - it is a pure tone and the 12-point spectrum walks straight past it.
  for (const [bg, spec] of Object.entries(AMBIENCE)) {
    const c = fresh(6);
    combatActive = true; momentum = 0; startAmbience(bg);
    const voice = ambienceNodes.parts.voice.frequency.value;
    const heat = ambienceNodes.parts.heat.frequency.value;
    const d = (await c.startRendering()).getChannelData(0);
    ambienceNodes = null;
    const off = SR * 3, N = SR;
    out.voices.push({ name: spec.name, drone: spec.drone, raw: spec.drone * spec.interval, voice,
                      sub: band(d, spec.drone, off, N), mag: band(d, voice, off, N),
                      heat, heatMag: band(d, heat, off, N) });
  }

  const HOT = 'bg_foundry.webp';
  out.heat.cold = await renderBed(HOT, 0, 0);
  out.heat.half = await renderBed(HOT, 60, 0);
  out.heat.full = await renderBed(HOT, 100, 0);
  out.motes.without = await renderBed(HOT, 0, 0);
  out.motes.with3 = await renderBed(HOT, 0, 3);
  for (const t of Object.keys(SFX)) out.sfx[t] = await renderSfx(t, 1);
  out.impacts.scratch = await renderImpact(5, 500, 1, 495, false);
  out.impacts.clean   = await renderImpact(120, 500, 1, 380, false);
  out.impacts.armour  = await renderImpact(120, 500, 0.7, 380, false);
  out.impacts.crit    = await renderImpact(120, 500, 1.25, 380, false);
  out.impacts.kill    = await renderImpact(120, 500, 1, 0, false);
  out.impacts.ourdead = await renderImpact(120, 500, 1, 0, true);
  out.floor = VOICE_FLOOR;
  return out;
};

(async () => {
  const { server, port } = await serve(ROOT);
  const launch = {};
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const context = await browser.newContext({ viewport: { width: 400, height: 800 } });
  await context.addInitScript(() => {
    let engine;
    Object.defineProperty(window, 'WP', {
      configurable: true,
      get: () => engine,
      set: value => {
        engine = value;
        for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
          try { Object.defineProperty(globalThis, k, { ...d, configurable: true }); } catch (e) {}
        }
      }
    });
  });
  const page = await context.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForTimeout(700);
  const r = await page.evaluate(RENDER);

  const f = n => n.toExponential(2);
  const bar = spec => {
    const m = Math.max(...spec, 1e-12);
    return spec.map(v => ' .:-=+*#%@'[Math.min(9, Math.round(v / m * 9))]).join('');
  };
  const row = (label, m) => console.log(`  ${String(label).padEnd(13)} rms ${f(m.rms)}  peak ${f(m.peak)}  ${bar(m.spec)}`);

  console.log('\n── BEDS, six seconds each, momentum 0 ' + '─'.repeat(24));
  console.log('  spectrum bands: ' + r.beds[Object.keys(r.beds)[0]].bands.join(' ') + ' Hz');
  for (const [name, m] of Object.entries(r.beds)) row(name, m);
  const sigs = new Set(Object.values(r.beds).map(m => bar(m.spec)));
  console.log(`  distinct spectra: ${sigs.size} of ${Object.keys(r.beds).length}`);

  console.log('\n── THE LAYER THAT CARRIES THE BIOME ' + '─'.repeat(26));
  console.log('  bed          drone   interval   lifted to   level vs the sub');
  for (const v of r.voices)
    console.log(`  ${v.name.padEnd(12)} ${String(v.drone).padStart(3)}Hz  ${v.raw.toFixed(0).padStart(6)}Hz  `
      + `${v.voice.toFixed(0).padStart(8)}Hz   ${(v.mag / v.sub).toFixed(2)}x`);
  const low = r.voices.filter(v => v.voice < r.floor).map(v => v.name);
  const thin = r.voices.filter(v => v.mag < v.sub * 0.15).map(v => v.name);
  console.log(`  below ${r.floor}Hz, where a phone speaker gives up: ${low.length ? low.join(', ') : 'none'}`);
  console.log(`  buried under the sub: ${thin.length ? thin.join(', ') : 'none'}`);

  console.log('\n── HEAT: does the bed thicken with momentum ' + '─'.repeat(18));
  for (const [k, m] of Object.entries(r.heat)) row(k, m);
  console.log(`  full/cold rms ${(r.heat.full.rms / r.heat.cold.rms).toFixed(2)}x, `
    + `peak ${(r.heat.full.peak / r.heat.cold.peak).toFixed(2)}x`);

  console.log('\n── MOTES: does the room speak up ' + '─'.repeat(29));
  row('bed alone', r.motes.without);
  row('bed + three', r.motes.with3);
  console.log(`  a mote lifts the peak ${(r.motes.with3.peak / r.motes.without.peak).toFixed(2)}x`);

  console.log('\n── EVERY VOICE IN THE TABLE ' + '─'.repeat(34));
  for (const [k, m] of Object.entries(r.sfx)) row(k, m);

  console.log('\n── IMPACTS AS THE ENGINE FIRES THEM ' + '─'.repeat(26));
  for (const [k, m] of Object.entries(r.impacts)) row(k, m);
  console.log(`  a crit against a clean hit of the same damage: `
    + `rms ${(r.impacts.crit.rms / r.impacts.clean.rms).toFixed(2)}x, peak ${(r.impacts.crit.peak / r.impacts.clean.peak).toFixed(2)}x`);
  console.log(`  a kill against the same hit that did not land it: `
    + `rms ${(r.impacts.kill.rms / r.impacts.clean.rms).toFixed(2)}x`);

  const clipped = [...Object.entries(r.sfx), ...Object.entries(r.impacts), ...Object.entries(r.beds)]
    .filter(([, m]) => m.peak >= 0.99).map(([k]) => k);
  console.log(`\n  clipping: ${clipped.length ? clipped.join(', ') : 'none'}`);

  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });

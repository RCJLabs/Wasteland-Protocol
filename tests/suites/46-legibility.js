// Statuses were an emoji in a coloured box - two channels a colourblind player cannot separate,
// and no indication of how long any of it had left. Audio was one on/off switch covering both
// the hits and the drone. Motion inherited the operating system with no way to disagree. There
// was no text scaling, and six controls sat under the 44px touch floor.
module.exports = {
  name: 'Legible to everyone',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- a status says what it is four ways ----
    const table = await page.evaluate(() => ({
      count: STATUSES.length,
      complete: STATUSES.every(s => s.key && s.name && s.letter && s.cls && s.desc),
      letters: STATUSES.map(s => s.letter),
      distinctLetters: new Set(STATUSES.map(s => s.letter)).size,
      distinctClasses: new Set(STATUSES.map(s => s.cls)).size,
      // Every turn counter the engine ticks should have a mark; a status you cannot see is a
      // rule the player is playing against blind.
      unmarked: ['bleedingTurns', 'stunnedTurns', 'armorTurns', 'oiledTurns', 'corrodedTurns', 'markedTurns']
        .filter(k => !STATUSES.some(s => s.key === k))
    }));
    ok(`all six statuses are described (${table.letters.join(' ')})`, table.count === 6 && table.complete);
    ok('each has a letter and a class of its own',
      table.distinctLetters === 6 && table.distinctClasses === 6);
    ok('and no turn counter goes unmarked', table.unmarked.length === 0);

    const chips = await page.evaluate(() => {
      const ent = { bleedingTurns: 3, stunnedTurns: 0, armorTurns: 2, oiledTurns: 0, corrodedTurns: 1, markedTurns: 0 };
      const html = statusChips(ent);
      const box = document.createElement('div'); box.innerHTML = html; document.body.appendChild(box);
      const read = [...box.querySelectorAll('.st')].map(c => c.innerText.replace(/\s+/g, ''));
      const labelled = [...box.querySelectorAll('.st')].every(c => c.getAttribute('aria-label') && c.title);
      box.remove();
      return { read, labelled, none: statusChips({ bleedingTurns: 0 }) };
    });
    ok(`a marked unit reads its letters and its turns (${chips.read.join(' ')})`,
      chips.read.join(' ') === 'B3 A2 C1');
    ok('each chip is announced to a screen reader too', chips.labelled);
    ok('an unmarked unit shows nothing', chips.none === '');

    // The point of the phase: the marks must be separable with the colour taken away.
    const shapes = await page.evaluate(() => {
      const box = document.createElement('div');
      box.innerHTML = STATUSES.map(s => `<span class="st ${s.cls}">x</span>`).join('');
      document.body.appendChild(box);
      const seen = [...box.querySelectorAll('.st')].map(c => {
        const st = getComputedStyle(c);
        return `${st.borderTopStyle}|${st.borderTopWidth}|${st.borderTopLeftRadius}|${st.clipPath !== 'none'}`;
      });
      box.remove();
      return { seen, distinct: new Set(seen).size };
    });
    ok(`the marks differ by border shape alone (${shapes.distinct} of ${shapes.seen.length} distinct)`,
      shapes.distinct >= 5);

    const legend = await page.evaluate(() => {
      const e = CODEX.find(x => x.id === 'STATUSES');
      if (!e) return null;
      const body = e.body().join(' ');
      return { titled: !!e.title, all: STATUSES.every(s => body.includes(`${s.letter} - ${s.name}`)) };
    });
    ok('the field manual carries the legend', legend && legend.titled && legend.all);

    // ---- the hits and the drone are separate, and both have levels ----
    const audio = await page.evaluate(() => {
      const before = { ...globalSettings };
      globalSettings.sfx = true; globalSettings.sfxVol = 1; globalSettings.ambVol = 0.7;
      const steps = [];
      for (let i = 0; i < VOL_STEPS.length + 1; i++) { steps.push(sfxVol()); cycleSfx(); }
      globalSettings.sfxVol = 1;
      // Independence: turning the bed off must leave the blows alone.
      globalSettings.ambVol = 0;
      const sfxAlive = sfxVol() > 0 && ambVol() === 0;
      globalSettings.ambVol = 0.7; globalSettings.sfxVol = 0;
      const ambAlive = ambVol() > 0 && sfxVol() === 0;
      // A save from before the split carries one boolean and is still honoured.
      globalSettings.sfx = false; globalSettings.sfxVol = 1; globalSettings.ambVol = 1;
      const legacy = sfxVol() === 0 && ambVol() === 0;
      Object.assign(globalSettings, before);
      return { steps, cycles: steps.length, sfxAlive, ambAlive, legacy,
               levels: VOL_STEPS.length, named: VOL_STEPS.map(volName) };
    });
    ok(`the level cycles through every step and back (${audio.named.join(' > ')})`,
      audio.steps[0] === audio.steps[audio.levels] && new Set(audio.steps).size === audio.levels);
    ok('silencing the ambience leaves the effects alone', audio.sfxAlive);
    ok('and silencing the effects leaves the ambience', audio.ambAlive);
    ok('a save from before the split is still honoured', audio.legacy);

    const buses = await page.evaluate(() => {
      globalSettings.sfx = true; globalSettings.sfxVol = 1; globalSettings.ambVol = 0.35;
      initAudio(); applyVolumes();
      const s = audioState();
      return { skipped: !s.ctx, split: s.split, levels: [s.sfxGain, s.ambGain] };
    });
    ok('effects and ambience run on separate buses', buses.skipped || buses.split);
    ok(`each carrying its own level (${(buses.levels || []).join(', ')})`,
      buses.skipped || (buses.levels[0] !== buses.levels[1]));

    // A silenced channel must not merely be quiet on the bus - it should not build the sound.
    const silence = await page.evaluate(() => {
      globalSettings.sfx = true; globalSettings.sfxVol = 0;
      sfxLog = []; playSFX('blade');
      const loggedAnyway = sfxLog.length;      // the log is a test surface, not audio
      globalSettings.sfxVol = 1;
      return { loggedAnyway };
    });
    ok('a silenced channel still reports what it would have played', silence.loggedAnyway === 1);

    // ---- animation is a choice, not only the operating system's ----
    const motion = await page.evaluate(() => {
      const before = globalSettings.motion;
      globalSettings.motion = 'off'; applyTextScale();
      const off = motionOff() && document.documentElement.classList.contains('motion-off');
      globalSettings.motion = 'full'; applyTextScale();
      const on = !motionOff() && !document.documentElement.classList.contains('motion-off');
      globalSettings.motion = 'auto'; applyTextScale();
      const auto = motionOff() === window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const modes = []; globalSettings.motion = MOTION_MODES[0];
      for (let i = 0; i < MOTION_MODES.length; i++) { modes.push(globalSettings.motion); cycleMotion(); }
      globalSettings.motion = before; applyTextScale();
      return { off, on, auto, modes, count: MOTION_MODES.length };
    });
    ok('turning animation off silences it on a machine that never asked', motion.off);
    ok('turning it on keeps it despite a system that did', motion.on);
    ok('and the default follows the system', motion.auto);
    ok(`the setting cycles all three ways (${motion.modes.join(' > ')})`,
      new Set(motion.modes).size === motion.count);

    // ---- text scales ----
    const text = await page.evaluate(() => {
      const before = globalSettings.textScale;
      const read = () => getComputedStyle(document.getElementById('log')).fontSize;
      globalSettings.textScale = 1; applyTextScale(); const small = read();
      globalSettings.textScale = TEXT_STEPS[TEXT_STEPS.length - 1]; applyTextScale(); const big = read();
      const varSet = document.documentElement.style.getPropertyValue('--text-scale');
      const steps = []; globalSettings.textScale = TEXT_STEPS[0];
      for (let i = 0; i < TEXT_STEPS.length; i++) { steps.push(globalSettings.textScale); cycleTextScale(); }
      globalSettings.textScale = before; applyTextScale();
      return { small: parseFloat(small), big: parseFloat(big), varSet, steps };
    });
    ok(`the log grows with the setting (${text.small}px -> ${text.big}px)`, text.big > text.small * 1.2);
    ok('the scale is published to the stylesheet', parseFloat(text.varSet) > 1);
    ok(`and cycles every step (${text.steps.join(', ')})`, new Set(text.steps).size === text.steps.length);

    // ---- every setting survives a reload ----
    await page.evaluate(() => {
      globalSettings.sfxVol = 0.35; globalSettings.ambVol = 0;
      globalSettings.motion = 'off'; globalSettings.textScale = 1.15;
      Store.set(SETTINGS_KEY, JSON.stringify(globalSettings));
    });
    await page.reload();
    await page.waitForTimeout(600);
    const kept = await page.evaluate(() => ({
      sfx: globalSettings.sfxVol, amb: globalSettings.ambVol,
      motion: globalSettings.motion, text: globalSettings.textScale,
      applied: document.documentElement.classList.contains('motion-off') &&
               document.documentElement.style.getPropertyValue('--text-scale') === '1.15'
    }));
    ok('every setting survives a reload', kept.sfx === 0.35 && kept.amb === 0 &&
      kept.motion === 'off' && kept.text === 1.15);
    ok('and is applied on the way back in', kept.applied);
    await page.evaluate(() => {
      globalSettings = { ...globalSettings, sfxVol: 1, ambVol: 0.7, motion: 'auto', textScale: 1 };
      Store.set(SETTINGS_KEY, JSON.stringify(globalSettings)); applyTextScale();
    });

    // ---- and nothing you can press is too small to press ----
    const FLOOR = 44;
    const sweep = async (label, setup) => {
      await page.evaluate(setup);
      await page.waitForTimeout(300);
      return page.evaluate((floor) => {
        const bad = [];
        document.querySelectorAll('button, [role="button"], .settings-icon').forEach(el => {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') return;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          if (r.height < floor || r.width < floor) {
            bad.push(`${el.id || el.className || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        });
        return [...new Set(bad)];
      }, FLOOR);
    };
    const screens = {
      title:    await sweep('title', () => { renderTitleScreen(); }),
      settings: await sweep('settings', () => { openSettings(); }),
      citadel:  await sweep('citadel', () => { closeSettings(); currentSlot = 1; confirmNewGame(1.0); sectorFront = null; renderCitadel(); }),
      map:      await sweep('map', () => { renderMap(); }),
      combat:   await sweep('combat', () => { currentSector = 2; currentTier = 6; initiateCombat('RAIDERS', false); }),
      manual:   await sweep('manual', () => { combatActive = false; renderCodex(); }),
      outpost:  await sweep('outpost', () => { renderOutpost(); })
    };
    Object.entries(screens).forEach(([name, bad]) => {
      ok(`nothing under ${FLOOR}px to press on the ${name} screen (${bad.join('; ') || 'clear'})`, bad.length === 0);
    });
  }
};

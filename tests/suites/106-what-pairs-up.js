// Nine relic pairs upgrade each other. The engine reads that state in seven places - the blade
// bites for 12 instead of 6, the mesh reaches a second rank, cooldowns come off three turns at a
// time, the collector's price falls from 500 to 200 - and the manual described all nine pairs
// with their halves and effects. What no screen ever showed was the state: which pairs YOU had
// up, and, the one that makes a set something to play toward, which pair stood a single relic
// short with that relic named. announceSets wrote one line into the scrolling combat log the
// moment a pair completed, once a run, and that was the whole of it.
//
// Measured over 150 expeditions before the change: 1,655 of 1,676 relics taken - 98.7% - left at
// least one pair standing at exactly one half, and 759 pairs completed, every one of them blind.
//
// The manual had a second hole. It listed all six curses with their effects and all nine pairs,
// and not one clean relic's effect: eleven of the fourteen were named only as the half of a
// pair, and the three clean ones belonging to no pair - Vulture's Instinct, Chem Etcher, Signal
// Jammer - appeared nowhere in the codex at all. Two curses are in no pair either, but a curse
// always had its own line on the curses page; it is the clean fourteen that were never written up.
module.exports = {
  name: 'What pairs up',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    const hand = ids => page.evaluate(list => {
      activeRelics = list.map(id => RELIC_POOL.find(r => r.id === id)).filter(Boolean);
      renderMap();
      const el = document.getElementById('set-list');
      return { text: el.innerText, html: el.innerHTML,
               up: [...el.querySelectorAll('.set-up-name')].map(n => n.innerText),
               upTips: [...el.querySelectorAll('.set-up-name')].map(n => n.title),
               near: [...el.querySelectorAll('.set-near')].map(n => n.innerText.replace(/\s+/g, ' ').trim()),
               // the readout against the thing that actually changes the fight
               engine: RELIC_SETS.filter(s => relicSetActive(s.name)).map(s => s.name) };
    }, ids);

    // ---- the three states, off the rendered panel ----
    await page.evaluate(() => { activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null; });
    const one = await hand(['THERMAL_CORE']);
    ok('one half of a pair is named as one half', one.near.length === 1 && /Reactor Rig/.test(one.near[0]));
    ok(`with the relic that would finish it (${one.near[0]})`, /NEEDS Overcharged Cell/.test(one.near[0]));
    ok('and nothing is claimed to be up', one.up.length === 0 && /0 OF 9 UP/.test(one.text));

    const both = await hand(['THERMAL_CORE', 'OVERCHARGED_CELL']);
    ok('both halves reads as up', both.up.includes('Reactor Rig') && /1 OF 9 UP/.test(both.text));
    ok('and the panel agrees with the engine that the pair is live',
      both.engine.includes('Reactor Rig') && both.up.length === both.engine.length);
    ok('a live pair still says what it does, on the name',
      both.upTips.some(t => /Thermal Core burns at \+50%/.test(t)));
    ok('and it is no longer listed as one short', !both.near.some(n => /Reactor Rig/.test(n)));

    // The cell is half of two pairs, so taking it opens one and half-opens another.
    ok('a relic that is half of two pairs shows in both',
      both.near.some(n => /Deep Magazine/.test(n) && /NEEDS Ammo Hoist/.test(n)));

    // ---- the panel and the engine cannot disagree ----
    const agree = await page.evaluate(() => {
      const ids = RELIC_POOL.map(r => r.id);
      let mismatches = 0, checked = 0;
      for (let t = 0; t < 300; t++) {
        const pool = ids.slice();
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        activeRelics = pool.slice(0, 1 + Math.floor(Math.random() * 12)).map(id => RELIC_POOL.find(r => r.id === id));
        renderMap();
        const shown = new Set([...document.querySelectorAll('.set-up-name')].map(n => n.innerText));
        RELIC_SETS.forEach(s => { checked++; if (shown.has(s.name) !== relicSetActive(s.name)) mismatches++; });
      }
      return { mismatches, checked };
    });
    ok(`across ${agree.checked} readings the screen never claims a pair the engine does not (${agree.mismatches} off)`,
      agree.mismatches === 0 && agree.checked >= 2000);

    // ---- what it does with nothing, and with nothing that pairs ----
    const none = await hand([]);
    ok('no relics, no block at all', none.html === '');
    const lone = await hand(['SIGNAL_JAMMER', 'CHEM_ETCHER', 'VULTURES_INSTINCT']);
    ok('relics that pair with nothing say exactly that',
      lone.up.length === 0 && lone.near.length === 0 && /Nothing you are carrying is half of a pair/.test(lone.text));

    // ---- bounded, because a deep run stands one short of four pairs at once ----
    const deep = await hand(['THERMAL_CORE', 'WHETSTONE', 'KINETIC_MESH', 'SCRAP_MAGNET', 'BLOOD_VIAL', 'HUNGRY_BLADE']);
    ok(`the one-short list is capped at three (${deep.near.length})`, deep.near.length === 3);
    ok('and says how many it did not print', /more one relic short/.test(deep.text));
    const full = await hand(['THERMAL_CORE', 'OVERCHARGED_CELL', 'WHETSTONE', 'RANGEFINDER', 'KINETIC_MESH',
                             'BULWARK_PLATING', 'SCRAP_MAGNET', 'SALVAGE_RIG', 'AMMO_HOIST', 'HUNGRY_BLADE',
                             'LEAD_LINED_COAT', 'BLOOD_VIAL', 'SCAVENGERS_DEBT']);
    ok(`seven live pairs share one line rather than taking seven (${full.up.length} named)`,
      full.up.length === 7 && (full.html.match(/class="set-up"/g) || []).length === 1);
    ok('and the head counts them against the whole table', /7 OF 9 UP/.test(full.text));

    // ---- setState itself, at the boundary ----
    const st = await page.evaluate(() => {
      const read = list => {
        activeRelics = list.map(id => RELIC_POOL.find(r => r.id === id));
        return setState().map(x => `${x.set.name}:${x.live ? 'UP' : x.need}`);
      };
      return { neither: read(['SIGNAL_JAMMER']),
               aOnly: read(['THERMAL_CORE']), bOnly: read(['OVERCHARGED_CELL']),
               named: relicName('OVERCHARGED_CELL'), unknown: relicName('NO_SUCH_RELIC') };
    });
    ok('a pair the squad holds neither half of is not a state', st.neither.length === 0);
    ok('holding either half names the other one',
      st.aOnly.includes('Reactor Rig:OVERCHARGED_CELL') && st.bOnly.includes('Reactor Rig:THERMAL_CORE'));
    ok('the missing half is printed by name, not by id', st.named === 'Overcharged Cell');
    ok('and an id with no relic behind it falls back to itself rather than to nothing',
      st.unknown === 'NO_SUCH_RELIC');

    // ---- the manual now has a page for every relic ----
    const codex = await page.evaluate(() => {
      renderCodex();
      const text = document.getElementById('codex-body').innerText;
      const clean = RELIC_POOL.filter(r => r.tier !== 'CURSED');
      const paired = new Set(RELIC_SETS.flatMap(s => [s.a, s.b]));
      const loose = RELIC_POOL.filter(r => !paired.has(r.id));
      return {
        entry: !!CODEX.find(c => c.id === 'RELICS'),
        allNamed: RELIC_POOL.filter(r => !text.includes(r.name)).map(r => r.name),
        allDescribed: RELIC_POOL.filter(r => !text.includes(r.desc)).map(r => r.name),
        looseNames: loose.map(r => r.name),
        looseDescribed: loose.every(r => text.includes(r.desc)),
        // The three that were nowhere before: clean, and in no pair, so nothing named them.
        // Curses in no pair were still written up on the curses page.
        darkNames: loose.filter(r => r.tier !== 'CURSED').map(r => r.name),
        saysHalf: RELIC_SETS.every(s => new RegExp(`Half of [^\\n]*${s.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`).test(text)),
        cleanCount: clean.length,
        pairedCount: paired.size,
        countLine: text.includes(`${paired.size} of them are half of a pair`),
        tiers: text.includes('(RARE)') && text.includes('(CURSED)') && !text.includes('(COMMON)')
      };
    });
    ok('the manual has a relics page', codex.entry);
    ok(`every relic in the pool is named on it (${codex.allNamed.length} missing)`, codex.allNamed.length === 0);
    ok(`and every one of them says what it does (${codex.allDescribed.length} missing)`, codex.allDescribed.length === 0);
    ok(`including all ${codex.looseNames.length} that belong to no pair`, codex.looseDescribed);
    ok(`and the ${codex.darkNames.length} clean ones the manual named nowhere at all (${codex.darkNames.join(', ')})`,
      codex.darkNames.length === 3 && codex.darkNames.includes('Signal Jammer'));
    ok('a relic that is half of a pair says which pair', codex.saysHalf);
    ok(`the paired count is derived rather than written down (${codex.pairedCount})`, codex.countLine);
    ok('rare and cursed are marked, common is the unmarked default', codex.tiers);

    await page.evaluate(() => { activeRelics = []; });
  }
};

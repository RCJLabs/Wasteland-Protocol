// F12. Four things a new player meets in their first hour, none of which worked.
//
// The first-contact prompts fire from thirty places and fifteen of them are outside combat - a
// promotion, a relic, a curse, the muster, a doctrine, gear, the Armory, a recruit, the recall,
// the route, extraction, a face, a standing contract, a regroup, the last sector. The container
// they render into sat INSIDE screen-combat, which switchScreen had just set to display:none.
// So half the prompts in the game were invisible where they fired and surfaced later, out of
// context, on whatever screen happened to be up when combat came back. They live at the engine
// root now, marked `.overlay`, which is the third thing switchScreen's sweep leaves alone.
//
// The dossier stays inside the combat screen on purpose, and the suite pins that: it reads
// activeEntities and is reachable only by tapping a unit on the field, so it is not the same
// defect and moving it would have been a change with no reason behind it.
//
// The sector-front splash had a reduced-motion rule already, and it never once applied: it was
// written as `.front-banner-show` while the thing it had to override is `#front-banner`, and an
// id beats a class. So the splash was invisible under the exact setting the rule existed for -
// and the game's own motion setting had no rule at all, where the blanket 0.01ms runs the
// animation to its last keyframe, which is opacity 0. Both paths show it statically now, and
// the banner clears itself on a timer, because the animation's last keyframe used to do that.
//
// The event box is width:100% with 25px of padding and a 2px border on a content box: 54px
// wider than whatever holds it, at every width, on every phone the game runs on.
//
// And the screen a run actually ENDS on had no stylesheet rule anywhere, while the screen a run
// ends WELL on had the full treatment.
module.exports = {
  name: 'Prompts where they fire',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── A prompt is visible on the screen it fires on ───────────────────────────────
    const seen = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const screens = [...document.querySelectorAll('#engine > div[id^="screen-"]')].map(el => el.id);
      const hidden = [];
      screens.forEach(id => {
        seenPrompts = []; globalSettings.prompts = true; promptQueue = [];
        switchScreen(id);
        firePrompt('RECRUIT');
        const el = document.getElementById('prompt');
        const box = el.getBoundingClientRect();
        if (getComputedStyle(el).display === 'none' || box.width === 0 || box.height === 0) hidden.push(id);
        dismissPrompt();
      });
      return { screens: screens.length, hidden };
    });
    ok(`the game has ${seen.screens} screens a prompt can be raised on`, seen.screens > 8);
    ok(`and a prompt is on screen for every one of them (${seen.hidden.join(', ') || 'none hidden'})`,
      seen.hidden.length === 0);

    // ── Which is because it is not inside any of them ───────────────────────────────
    const where = await page.evaluate(() => {
      const par = id => (document.getElementById(id).parentElement || {}).id;
      switchScreen('screen-outpost');
      const combat = getComputedStyle(document.getElementById('screen-combat')).display;
      // Stated as the property rather than as a list of names: everything at the engine root
      // is either a screen the sweep hides or a card marked to survive it, and there is no
      // third kind. A frozen list would have to be edited by every phase that adds an overlay,
      // which is exactly the edit that would hide a screen wrongly left unmarked.
      const kids = [...document.getElementById('engine').children]
        .filter(e => e.tagName === 'DIV' && !e.classList.contains('settings-icon'));
      const overlays = kids.filter(e => e.classList.contains('overlay')).map(e => e.id).sort();
      const unaccounted = kids.filter(e => !e.id.startsWith('screen-') && !e.classList.contains('overlay'))
                              .map(e => e.id || '(unnamed)');
      const bothWays = kids.filter(e => e.id.startsWith('screen-') && e.classList.contains('overlay'))
                           .map(e => e.id);
      // What the marking is for. Read as "the sweep wrote nothing on it" rather than "it is
      // visible": explain and prompt are hidden by their own rules until something raises
      // them, so a computed `display: none` says nothing about whether switchScreen hid them.
      // The inline display is cleared first - comparing before against after would be blind to
      // a sweep that had already run and would only be writing the same 'none' a second time.
      overlays.forEach(id => { document.getElementById(id).style.display = ''; });
      switchScreen('screen-map');
      const swept = overlays.filter(id => document.getElementById(id).style.display !== '');
      switchScreen('screen-outpost');
      return { prompt: par('prompt'), explain: par('explain'), dossier: par('dossier'), combat,
               overlays, unaccounted, bothWays, swept, kids: kids.length };
    });
    ok(`the prompt and the explain card sit at the engine root (${where.prompt}, ${where.explain})`,
      where.prompt === 'engine' && where.explain === 'engine');
    ok(`every one of the ${where.kids} things at the engine root is a screen or an overlay (${where.unaccounted.join(', ') || 'nothing unaccounted for'})`,
      where.unaccounted.length === 0 && where.bothWays.length === 0);
    ok(`and being marked one is what spares it the sweep (${where.overlays.join(', ')})`,
      where.overlays.length >= 2 && where.swept.length === 0);
    ok(`while the dossier stays with the field it reads (${where.dossier})`,
      where.dossier === 'screen-combat');
    ok(`and the combat screen is still hidden when another is up (${where.combat})`,
      where.combat === 'none');

    // ── Half the prompts in the game fire outside combat ────────────────────────────
    const off = await page.evaluate(() => {
      // Fired from the screens that raise them, rather than asserted from a list.
      const fired = [];
      [['screen-outpost', 'GEAR'], ['screen-perk', 'PROMOTION'], ['screen-relic', 'RELIC'],
       ['screen-relic', 'CURSE'], ['screen-muster', 'MUSTER'], ['screen-recruit', 'RECRUIT'],
       ['screen-shop', 'ARMORY'], ['screen-map', 'ROUTE']].forEach(([s, id]) => {
        if (!document.getElementById(s)) return;
        seenPrompts = []; promptQueue = []; globalSettings.prompts = true;
        switchScreen(s); firePrompt(id);
        const b = document.getElementById('prompt').getBoundingClientRect();
        fired.push({ s, id, shown: b.width > 0 && b.height > 0 });
        dismissPrompt();
      });
      return { fired, blind: fired.filter(f => !f.shown).map(f => `${f.id}@${f.s}`) };
    });
    ok(`every prompt raised off the field is on screen where it fires (${off.fired.length} checked)`,
      off.fired.length >= 6 && off.blind.length === 0);

    // And in the other order, which is the one the guard is actually for. renderPrompt writes
    // its own inline display, so a prompt raised AFTER the switch survives either way; a prompt
    // already standing when the screen changes is the case the sweep would take down, and
    // several callers fire before they switch.
    const across = await page.evaluate(() => {
      seenPrompts = []; promptQueue = []; globalSettings.prompts = true;
      switchScreen('screen-map');
      firePrompt('RECRUIT');
      const before = document.getElementById('prompt').getBoundingClientRect();
      const moves = [];
      ['screen-outpost', 'screen-perk', 'screen-combat', 'screen-citadel'].forEach(id => {
        switchScreen(id);
        const b = document.getElementById('prompt').getBoundingClientRect();
        moves.push({ id, shown: b.width > 0 && b.height > 0,
                     display: getComputedStyle(document.getElementById('prompt')).display });
      });
      dismissPrompt();
      return { before: before.width > 0, moves, lost: moves.filter(m => !m.shown).map(m => m.id) };
    });
    ok('a prompt raised before a screen change is on screen when it is raised', across.before === true);
    ok(`and survives every screen change under it (${across.lost.join(', ') || 'none lost'})`,
      across.lost.length === 0);

    // ── The splash shows under both reduced-motion paths ────────────────────────────
    // On a fresh page: the blocks above enter sectors and raise prompts, and this is measuring
    // a cascade rather than whatever those left standing.
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const media = await page.evaluate(() => {
      const b = document.getElementById('front-banner');
      b.classList.add('front-banner-show');
      const o = getComputedStyle(b).opacity, a = getComputedStyle(b).animationName;
      b.classList.remove('front-banner-show');
      return { o: Number(o), a };
    });
    await page.emulateMedia({ reducedMotion: null });
    const setting = await page.evaluate(() => {
      const b = document.getElementById('front-banner');
      // Started clean: an earlier block may have entered a sector and left the splash up with
      // its clearing timer still pending, and this is measuring the rule rather than the timer.
      clearTimeout(frontBannerTimer); frontBannerPending = false;
      b.classList.remove('front-banner-show');
      document.documentElement.classList.add('motion-off');
      const before = Number(getComputedStyle(b).opacity);
      b.classList.add('front-banner-show');
      const o = Number(getComputedStyle(b).opacity);
      b.classList.remove('front-banner-show');
      const off = Number(getComputedStyle(b).opacity);
      document.documentElement.classList.remove('motion-off');
      return { before, o, off };
    });
    ok(`under the OS setting the splash is shown rather than animated (opacity ${media.o}, animation ${media.a})`,
      media.o === 1 && media.a === 'none');
    ok(`and under the game's own setting too (opacity ${setting.o})`, setting.o === 1);
    ok(`and nothing showing before it is raised or after it clears (${setting.before} / ${setting.off})`,
      setting.before === 0 && setting.off === 0);

    // ── And it takes itself off again ───────────────────────────────────────────────
    const clears = await page.evaluate(async () => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0);
      sectorFront = 'MACHINE_UPRISING'; frontBannerPending = true;
      renderMap();
      const b = document.getElementById('front-banner');
      const up = b.classList.contains('front-banner-show');
      await new Promise(r => setTimeout(r, 3400));
      return { up, down: !b.classList.contains('front-banner-show') };
    });
    ok('entering a sector raises the splash', clears.up === true);
    ok('and it clears itself rather than standing there', clears.down === true);

    // ── The event box fits what holds it ────────────────────────────────────────────
    const fits = [];
    for (const w of [320, 360, 400]) {
      await page.setViewportSize({ width: w, height: 720 });
      fits.push(await page.evaluate(() => {
        switchScreen('screen-event');
        const box = document.querySelector('#screen-event .event-box');
        const par = document.getElementById('screen-event');
        const r = box.getBoundingClientRect();
        return { w: window.innerWidth, box: r.width, inner: par.clientWidth - 40,
                 sizing: getComputedStyle(box).boxSizing,
                 bodyScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      }));
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    ok(`the event box fits its container at every phone width (${fits.map(f => `${f.w}: ${f.box} in ${f.inner}`).join(' | ')})`,
      fits.every(f => f.box <= f.inner));
    ok(`because the padding is inside the width (${fits[0].sizing})`, fits.every(f => f.sizing === 'border-box'));
    ok('and nothing pushes the page sideways', fits.every(f => f.bodyScroll === false));

    // ── The screen a run ends on is dressed like the one it ends well on ────────────
    const over = await page.evaluate(() => {
      const read = id => { switchScreen(id); const c = getComputedStyle(document.getElementById(id));
        return { flex: c.flexDirection, justify: c.justifyContent, align: c.alignItems,
                 padding: c.padding, sizing: c.boxSizing, ground: c.backgroundImage !== 'none' }; };
      return { vic: read('screen-victory'), run: read('screen-runover'), camp: read('screen-camp') };
    });
    ok(`the run-over screen is laid out like the victory screen (${JSON.stringify(over.run)})`,
      over.run.flex === over.vic.flex && over.run.justify === over.vic.justify
      && over.run.align === over.vic.align && over.run.padding === over.vic.padding
      && over.run.sizing === 'border-box');
    ok('and has the same ground behind it', over.run.ground === true && over.vic.ground === true);
    ok('as does the camp, which shares the rule', over.camp.ground === true);
  }
};

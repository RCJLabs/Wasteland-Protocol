// G04. Two holes with one shape: a consequence that comes due where nothing is listening.
//
// The fuse is counted in nodes, and afterNode - the exit a FIGHT takes - is the only place
// that asks what has come due. So:
//
// A PURSUIT booked on the run and coming due on the commander's node armed its hunters, said
// "N of them will be waiting in the next fight", and was then deleted by crossSector's blanket
// `pursuit = null` a moment later. The commander is always the last tier of its sector, so
// that was every time, not sometimes. A withdrawal's chasers genuinely should stop at the
// sector line; a hunt that took your trail because of what you took is a different animal and
// now says so.
//
// And finishQuietNode went straight to the map, so an event, a camp, a shop or either recruit
// door could not deliver a consequence at all - it waited for the next fight. Quiet nodes count
// toward the fuse, which is exactly what F08 established; they just could not pay it out.
module.exports = {
  name: 'Consequences that land',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__fresh = () => { currentSlot = 1; confirmNewGame(1.0);
                               pendingConsequences = []; pursuit = null; };
      window.__screens = () => [...document.querySelectorAll('#engine > div[id^="screen-"]')]
        .filter(e => getComputedStyle(e).display !== 'none').map(e => e.id);
    });

    // ── The commander's node is the last one, so this is every time ────────────────
    const layout = await page.evaluate(() => {
      window.__fresh();
      const nodes = Array.isArray(sectorMap) ? sectorMap : (sectorMap.nodes || Object.values(sectorMap));
      const boss = nodes.filter(n => n.type === 'BOSS');
      return { maxTier: Math.max(...nodes.map(n => n.tier)),
               bossTiers: [...new Set(boss.map(n => n.tier))] };
    });
    ok(`the commander sits on the last tier of the sector (tier ${layout.bossTiers.join()} of ${layout.maxTier})`,
      layout.bossTiers.length === 1 && layout.bossTiers[0] === layout.maxTier);

    // ── A hunt survives the crossing it was promised across ────────────────────────
    const hunt = await page.evaluate(() => {
      window.__fresh();
      bookConsequence('PURSUIT', 0);
      afterNode();                                    // the fight's exit resolves it
      const promise = document.getElementById('event-choices').innerText;
      const armed = pursuit && pursuit.units ? pursuit.units.length : 0;
      advanceSector();                                // and the commander's node is the last
      const after = pursuit && pursuit.units ? pursuit.units.length : 0;
      return { promise: /waiting in the next fight/.test(promise), armed, after,
               marked: !!(pursuit && pursuit.hunt) };
    });
    ok(`the consequence promises them in the next fight (${hunt.armed} of them)`,
      hunt.promise === true && hunt.armed > 0);
    ok(`and they are still there after the sector is crossed (${hunt.after})`,
      hunt.after === hunt.armed && hunt.marked === true);

    // ── A withdrawal's chasers still stop at the line ──────────────────────────────
    const chase = await page.evaluate(() => {
      window.__fresh();
      pursuit = { units: [{ name: 'a' }, { name: 'b' }], from: 'RAIDERS' };
      const before = pursuit.units.length;
      crossSector();
      return { before, after: pursuit ? pursuit.units.length : 0 };
    });
    ok(`the squad you ran from does not follow across (${chase.before} → ${chase.after || 'none'})`,
      chase.before === 2 && chase.after === 0);

    // ── And a hunt is spent by the fight it was promised for ───────────────────────
    const spent = await page.evaluate(() => {
      window.__fresh();
      bookConsequence('PURSUIT', 0);
      afterNode();
      const armed = pursuit.units.length;
      advanceSector();
      initiateCombat('RAIDERS', false);
      const onField = activeEntities.filter(e => /^chase_/.test(e.id)).length;
      return { armed, onField, cleared: pursuit === null };
    });
    ok(`they turn up in that fight, across the line (${spent.onField} of ${spent.armed})`,
      spent.onField === spent.armed && spent.armed > 0);
    ok('and are spent when they do, so a hunt is not a standing tax', spent.cleared === true);

    // ── A quiet node can pay one out ───────────────────────────────────────────────
    const quiet = await page.evaluate(() => {
      window.__fresh();
      bookConsequence('RESUPPLY', 0);
      const before = { due: consequencesDue().length, purse: scrap };
      initiateEvent(); const ev = activeEvent && activeEvent.title;
      finishEvent();
      return { before, ev, shown: window.__screens(), due: consequencesDue().length,
               paid: scrap > before.purse,
               title: document.getElementById('event-title').innerText };
    });
    ok(`an event node delivers what came due on it (${quiet.title})`,
      quiet.before.due === 1 && quiet.due === 0 && quiet.shown.join() === 'screen-event');
    ok('and it actually resolves rather than only being drawn', quiet.paid === true);

    // ── So do the other three doors that leave a quiet node ────────────────────────
    const doors = await page.evaluate(() => {
      const out = {};
      [['finishShop', () => finishShop()],
       ['finishCamp', () => finishCamp()],
       ['leaveRecruit', () => leaveRecruit()]].forEach(([name, go]) => {
        window.__fresh();
        bookConsequence('RESUPPLY', 0);
        try { go(); } catch (e) { out[name] = 'threw: ' + e.message; return; }
        out[name] = { due: consequencesDue().length, shown: window.__screens().join() };
      });
      return out;
    });
    ok(`the shop delivers one too (${JSON.stringify(doors.finishShop)})`,
      doors.finishShop.due === 0 && doors.finishShop.shown === 'screen-event');
    ok(`so does the camp (${JSON.stringify(doors.finishCamp)})`,
      doors.finishCamp.due === 0 && doors.finishCamp.shown === 'screen-event');
    ok(`and walking away from a recruit (${JSON.stringify(doors.leaveRecruit)})`,
      doors.leaveRecruit.due === 0 && doors.leaveRecruit.shown === 'screen-event');

    // ── Nothing due still goes to the map, and a promotion still interrupts ────────
    const ordinary = await page.evaluate(() => {
      window.__fresh();
      finishShop();
      const plain = window.__screens().join();
      window.__fresh();
      const who = playerRoster.find(c => c.gridPos > 0);
      pendingPerkOffers = [{ charId: who.id }];
      finishShop();
      const withPerk = window.__screens().join();
      return { plain, withPerk };
    });
    ok(`a quiet node with nothing owed still goes to the map (${ordinary.plain})`,
      ordinary.plain === 'screen-map');
    ok(`and a promotion still takes the screen first (${ordinary.withPerk})`,
      ordinary.withPerk === 'screen-perk');

    // ── Acking the last one continues the chain rather than ending it ─────────────
    // resolveConsequence falls through to afterNode when nothing is left, which is what keeps
    // a promotion or a relic offer from being swallowed by the consequence that happened to be
    // in front of it. Going straight to the map here would lose both silently.
    const chain = await page.evaluate(() => {
      window.__fresh();
      const who = playerRoster.find(c => c.gridPos > 0);
      bookConsequence('RESUPPLY', 0);
      pendingPerkOffers = [{ charId: who.id }];
      finishShop();
      const onConsequence = window.__screens().join();
      resolveConsequence();                          // what CONTINUE EXPEDITION presses
      return { onConsequence, after: window.__screens().join(), due: consequencesDue().length };
    });
    ok(`the consequence is shown first (${chain.onConsequence})`, chain.onConsequence === 'screen-event');
    ok(`and acking it hands over to the promotion waiting behind it (${chain.after})`,
      chain.after === 'screen-perk' && chain.due === 0);

    // ── The fuse is still counted in nodes, quiet ones included ────────────────────
    const fuse = await page.evaluate(() => {
      window.__fresh();
      bookConsequence('RESUPPLY', 2);              // two nodes away
      const at = [consequenceIn()];
      finishShop(); at.push(consequenceIn());      // one quiet node
      const midway = window.__screens().join();
      finishShop(); at.push(consequenceIn());
      return { at, midway, shown: window.__screens().join() };
    });
    ok(`a fuse two nodes out is not paid early (${fuse.at.join(' → ')}, ${fuse.midway} at one)`,
      fuse.at[0] === 2 && fuse.midway === 'screen-map');
    ok(`and lands on the node it was booked for (${fuse.shown})`, fuse.shown === 'screen-event');
  }
};

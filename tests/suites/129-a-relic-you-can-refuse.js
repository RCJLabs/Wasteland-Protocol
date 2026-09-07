// G07. rollRelicOffer's own comment says a cursed card is "marked unmistakably, never forced".
// The screen it is dealt on had no way to keep that promise.
//
// The table is built from what the squad does NOT already own, so a career deep enough to hold
// thirteen of the fourteen clean relics is dealt a single card - and the curse roll replaces
// the FIRST card, which is that one. Measured before the fix: offer size 1, tier CURSED, one
// button on the screen, no exit at all. The camp's cache has always been one of four choices;
// the commander's was one of one.
//
// And the Vault banked the wrong thing. heirloomFrom took `find(RARE) || relics[0]`, so a
// squad that picked up a curse before a common banked the curse and armed the next run with it.
module.exports = {
  name: 'A relic you can refuse',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__offer = cards => {
        currentSlot = 1; confirmNewGame(1.0); pendingPerkOffers = [];
        activeRelics = []; pendingRelicOffer = cards; renderRelicOffer();
        return [...document.querySelectorAll('#screen-relic button')]
          .filter(b => getComputedStyle(b).display !== 'none');
      };
      window.__screen = () => [...document.querySelectorAll('#engine > div[id^="screen-"]')]
        .filter(e => getComputedStyle(e).display !== 'none').map(e => e.id).join();
      window.__curse = () => RELIC_POOL.find(r => r.tier === 'CURSED');
      window.__common = () => RELIC_POOL.find(r => r.tier === 'COMMON');
      window.__rare = () => RELIC_POOL.find(r => r.tier === 'RARE');
    });

    // ── The case as filed: one card, and it is cursed ─────────────────────────────
    const forced = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const clean = RELIC_POOL.filter(r => r.tier !== 'CURSED');
      activeRelics = clean.slice(1);                       // thirteen of fourteen
      const dealt = rollRelicOffer();
      const cursed = RELIC_POOL.filter(r => r.tier === 'CURSED' && !hasRelic(r.id));
      const table = dealt.slice(); if (table.length && cursed.length) table[0] = cursed[0];
      const buttons = window.__offer(table);
      return { dealt: dealt.length, tier: table[0] && table[0].tier,
               actions: buttons.map(b => b.dataset.action),
               exits: buttons.filter(b => b.dataset.action !== 'take-relic').length };
    });
    ok(`a deep career is dealt one card and the curse takes its place (${forced.dealt}, ${forced.tier})`,
      forced.dealt === 1 && forced.tier === 'CURSED');
    ok(`and the screen has a way out of it (${forced.actions.join(', ')})`, forced.exits === 1);

    // ── Walking away takes nothing and costs nothing else ─────────────────────────
    const left = await page.evaluate(() => {
      const c = window.__curse();
      window.__offer([c]);
      const purse = scrap, hp = deployed().map(u => u.hp);
      declineRelic();
      return { held: activeRelics.length, offer: pendingRelicOffer, screen: window.__screen(),
               purse: scrap - purse, hurt: deployed().filter((u, i) => u.hp < hp[i]).length };
    });
    ok(`walking away leaves the squad holding nothing (${left.held})`,
      left.held === 0 && left.offer === null);
    ok(`and costs no scrap and no blood (${left.purse}, ${left.hurt} hurt)`,
      left.purse === 0 && left.hurt === 0);
    ok(`then goes back to the map (${left.screen})`, left.screen === 'screen-map');

    // ── Taking one still works, and both answers leave by the same door ───────────
    const taken = await page.evaluate(() => {
      const c = window.__common();
      window.__offer([c]);
      takeRelic(0);
      const afterTake = { held: activeRelics.map(r => r.id), screen: window.__screen() };
      // A promotion waiting behind the offer must be reached whichever answer was given.
      const who = playerRoster.find(p => p.gridPos > 0);
      window.__offer([window.__curse()]);
      pendingPerkOffers = [{ charId: who.id }];
      declineRelic();
      const afterDecline = window.__screen();
      return { afterTake, afterDecline };
    });
    ok(`taking a card still takes it (${taken.afterTake.held.join()})`,
      taken.afterTake.held.length === 1 && taken.afterTake.screen === 'screen-map');
    ok(`and declining still hands over to a promotion waiting behind it (${taken.afterDecline})`,
      taken.afterDecline === 'screen-perk');

    // ── An exhausted pool is no longer a room with no doors ───────────────────────
    const empty = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      activeRelics = RELIC_POOL.filter(r => r.tier !== 'CURSED');
      const dealt = rollRelicOffer();
      const buttons = window.__offer(dealt);
      return { dealt: dealt.length, cards: document.querySelectorAll('#relic-choices button').length,
               exits: buttons.filter(b => b.dataset.action === 'decline-relic').length };
    });
    ok(`a table with nothing left on it still has a door (${empty.cards} cards, ${empty.exits} exit)`,
      empty.cards === 0 && empty.exits === 1);

    // ── The control is a control, and pressing it is what does the work ──────────
    // Pressed rather than called: an unwired button looks identical from the function's side,
    // and the wiring is the half a player actually touches.
    const pressed = await page.evaluate(() => {
      window.__offer([window.__curse()]);
      document.getElementById('relic-decline').click();
      return { held: activeRelics.length, offer: pendingRelicOffer, screen: window.__screen() };
    });
    ok(`pressing it is what leaves the stash (${pressed.screen})`,
      pressed.held === 0 && pressed.offer === null && pressed.screen === 'screen-map');

    // The 44px floor N13 set is for a small screen, and a button's height here comes mostly
    // from `padding: clamp(10px, 3vh, 15px)` - which shrinks with the VIEWPORT, not the width.
    // On a phone held upright there is enough of it; turned on its side there is not, and the
    // floor is the only thing holding the target up. Both are measured, because only the second
    // one can tell whether the floor is doing anything.
    const sizes = [{ w: 320, h: 480, name: 'upright' }, { w: 667, h: 375, name: 'on its side' }];
    const boxes = [];
    for (const v of sizes) {
      await page.setViewportSize({ width: v.w, height: v.h });
      boxes.push(Object.assign({ name: v.name }, await page.evaluate(() => {
        window.__offer([window.__curse()]);
        const b = document.getElementById('relic-decline');
        const r = b.getBoundingClientRect();
        return { h: Math.round(r.height), w: Math.round(r.width), action: b.dataset.action };
      })));
    }
    await page.setViewportSize({ width: 800, height: 600 });
    ok(`the control keeps its tap target on a phone (${boxes.map(b => `${b.name} ${b.w}x${b.h}`).join(', ')})`,
      boxes.every(b => b.h >= 44 && b.w > 40 && b.action === 'decline-relic'));

    // ── What the Vault banks, given the choice ────────────────────────────────────
    const vault = await page.evaluate(() => {
      const c = window.__curse(), m = window.__common(), r = window.__rare();
      const t = a => (heirloomFrom(a) || {}).tier;
      return { curseAlone: t([c]), curseThenCommon: t([c, m]), curseThenRare: t([c, r]),
               commonThenCurse: t([m, c]), rareBeatsCommon: t([m, r]), nothing: heirloomFrom([]) };
    });
    ok(`a rare is still what it takes first (${vault.curseThenRare}, ${vault.rareBeatsCommon})`,
      vault.curseThenRare === 'RARE' && vault.rareBeatsCommon === 'RARE');
    ok(`a curse no longer outranks a clean common (${vault.curseThenCommon}, ${vault.commonThenCurse})`,
      vault.curseThenCommon === 'COMMON' && vault.commonThenCurse === 'COMMON');
    ok(`but a curse is still banked when it is all there is (${vault.curseAlone})`,
      vault.curseAlone === 'CURSED' && vault.nothing === null);

    // ── And it leaves as soon as the next run finds anything cleaner ──────────────
    const sheds = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      metaUpgrades.vault = 1; metaUpgrades.heirloom = null; metaUpgrades.heirloomWalked = false;
      const c = window.__curse(), m = window.__common();
      activeRelics = [c]; runStats = runStats || {}; runStats.extracted = false;
      stashHeirloom(false);
      const banked = metaUpgrades.heirloom;
      buildNewRun();
      const opened = activeRelics.map(r => r.id);
      activeRelics = [c, m];                        // the run finds something clean
      stashHeirloom(false);
      return { banked, opened, next: metaUpgrades.heirloom, curse: c.id, common: m.id };
    });
    ok(`a run holding only a curse banks it (${sheds.banked})`, sheds.banked === sheds.curse);
    ok(`and the next run that finds anything cleaner sheds it (${sheds.next})`,
      sheds.next === sheds.common);
  }
};

// H09. The order is signed at the muster, before the player knows anything, and the item was
// filed on "kept 3 of 150, 2%". That measured THE LONG ROAD alone under a policy that always
// signs it. Measured across all three at 100 runs each, the keep rate is a ladder that
// replicates: SORTIE 34-35%, PATROL 12%, THE LONG ROAD 0-2%. The longest order produced an
// outcome about once in fifty runs.
//
// A NOTE ON WHAT WAS CLAIMED AND WITHDRAWN. On one sample per order the medians read 21,265 /
// 19,648 / 17,666 and this phase was started on the reading that every step up the ladder LOWERS
// the expected score - that the menu was a trap. At three samples THE LONG ROAD reads
// 19,845 / 20,929 / 20,558 against SORTIE's 19,829 / 21,265: completely overlapping. The
// inversion is not established and the claim is withdrawn. This file's own header says 150+
// expeditions before believing a score figure; one of a hundred was believed instead.
//
// What survives is the keep rate, and re-signing moves it: 0-2% -> 8-13%, complete separation
// across three samples each way, with depth and score unmoved and wipes DOWN (6.78-6.97 ->
// 6.26-6.65) because runs end by recall rather than by being pushed into a wipe.
//
// Held here: that an order cannot be cut to a road already run past, that cutting costs and
// extending does not, that the terms are struck at the moment of the trade rather than re-priced
// later, and that the career's own choice for the next expedition is untouched.
module.exports = {
  name: 'An order you can change',
  run: async ({ page, ok, base, engineUp }) => {
    const clean_pct = b => `${Math.round(b * 100)}%`;
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      window.__run = (orderId, sector) => {
        currentSlot = 1;
        activeOrder = orderId;
        confirmNewGame(1.0);
        currentSector = sector || 1;
        return { order: runStats.order, sectors: orderSectors() };
      };
    });

    // ── An order cannot be cut to a road already run past ────────────────────────
    // The recall fires on an exact sector match, so signing a three-sector order at sector four
    // is signing for a recall that can never come - the run would simply never end well.
    const reach = await page.evaluate(() => {
      const at = sec => { window.__run('LONG', sec); return resignable().map(o => `${o.id}:${o.sectors}`); };
      return { s1: at(1), s4: at(4), s6: at(6), s7: at(7), final: FINAL_SECTOR };
    });
    ok(`at sector 1 every other order is on the table (${reach.s1.join(', ')})`, reach.s1.length === 2);
    ok(`at sector 4 the three-sector order is gone (${reach.s4.join(', ')})`,
      !reach.s4.some(x => x.startsWith('SORTIE')) && reach.s4.length === 1);
    ok(`at sector 6 nothing shorter is left (${reach.s6.join(', ') || 'none'})`, reach.s6.length === 0);
    ok(`and the order already signed is never offered back (${reach.s7.join(', ') || 'none'})`,
      !reach.s7.some(x => x.startsWith('LONG')));

    // ── Cutting it costs; extending does not ─────────────────────────────────────
    const terms = await page.evaluate(() => {
      window.__run('LONG', 1);
      const down = { id: 'SORTIE', quoted: resignBonus('SORTIE'), table: orderById('SORTIE').bonus };
      window.__run('SORTIE', 1);
      const up = { id: 'LONG', quoted: resignBonus('LONG'), table: orderById('LONG').bonus };
      return { down, up, cut: RESIGN_CUT };
    });
    ok(`cutting the order forfeits the Citadel's share (${terms.down.table} -> ${terms.down.quoted.toFixed(3)}, cut ${terms.cut})`,
      Math.abs(terms.down.quoted - terms.down.table * (1 - terms.cut)) < 1e-9);
    ok(`extending it costs nothing but the risk (${terms.up.quoted} of ${terms.up.table})`,
      terms.up.quoted === terms.up.table);

    // ── The trade lands on the run, and the score follows it ─────────────────────
    const traded = await page.evaluate(() => {
      window.__run('LONG', 2);
      const before = { order: runStats.order, sectors: orderSectors(), bonus: orderBonus() };
      const ok1 = resignOrder('SORTIE');
      const after = { order: runStats.order, sectors: orderSectors(), bonus: orderBonus(),
                      cut: runStats.orderCut, resigned: !!runStats.resigned };
      // What it is worth kept, through the engine's own scorer rather than reckoned here.
      const kept = computeScore({ ...runStats, fulfilled: true, deepestSector: 3, deepestTier: 10,
                                  bosses: 2, elites: 3, kills: 40, scrapEarned: 800 });
      const lapsed = computeScore({ ...runStats, fulfilled: false, deepestSector: 3, deepestTier: 10,
                                    bosses: 2, elites: 3, kills: 40, scrapEarned: 800 });
      return { ok1, before, after, kept, lapsed };
    });
    ok(`the trade takes (${traded.before.order} ${traded.before.sectors} -> ${traded.after.order} ${traded.after.sectors})`,
      traded.ok1 === true && traded.after.order === 'SORTIE' && traded.after.sectors === 3);
    ok(`and the run carries the cut (${traded.after.cut})`,
      traded.after.resigned === true && traded.after.cut === 0.4);
    ok(`a cut order still pays for being kept (${traded.lapsed} lapsed -> ${traded.kept} kept)`,
      traded.kept > traded.lapsed);

    // And it pays LESS than the same order signed clean, which is the whole economic point.
    // Asserting the cut is stored is not the same as asserting it is charged: a mutant that made
    // orderBonus ignore orderCut left every other assertion here green.
    const charged = await page.evaluate(() => {
      const score = () => computeScore({ ...runStats, fulfilled: true, deepestSector: 3,
        deepestTier: 10, bosses: 2, elites: 3, kills: 40, scrapEarned: 800 });
      window.__run('SORTIE', 1);
      const clean = { bonus: orderBonus(), score: score() };
      window.__run('LONG', 1);
      resignOrder('SORTIE');
      const cut = { bonus: orderBonus(), score: score() };
      return { clean, cut };
    });
    ok(`a cut order pays less than one signed clean (${clean_pct(charged.cut.bonus)} against ${clean_pct(charged.clean.bonus)})`,
      charged.cut.bonus < charged.clean.bonus);
    ok(`and the score follows it down (${charged.cut.score} against ${charged.clean.score})`,
      charged.cut.score < charged.clean.score);

    // ── An order not on the table cannot be taken off it ─────────────────────────
    // The buttons only draw what resignable() allows, and the keyboard, a replayed action and a
    // stale save all reach resignOrder without them - the guard has to hold on its own.
    const offTable = await page.evaluate(() => {
      window.__run('LONG', 4);
      const listed = resignable().map(o => o.id);
      const before = { order: runStats.order, cut: runStats.orderCut || 0 };
      const tried = resignOrder('SORTIE');          // three sectors, and the squad is in four
      const junk = resignOrder('NO_SUCH_ORDER');
      return { listed, tried, junk, before,
               after: { order: runStats.order, cut: runStats.orderCut || 0 } };
    });
    ok(`the three-sector order is off the table at sector 4 (${offTable.listed.join(', ')})`,
      !offTable.listed.includes('SORTIE'));
    ok('and taking it anyway is refused', offTable.tried === false);
    ok('as is an order that does not exist', offTable.junk === false);
    ok(`with the run left exactly as it was (${offTable.after.order}, cut ${offTable.after.cut})`,
      offTable.after.order === offTable.before.order && offTable.after.cut === offTable.before.cut);

    // ── The terms are struck at the trade, not re-priced afterwards ──────────────
    // A second trade must not re-price the first: what a score is worth was decided when the
    // squad shook hands on it.
    const struck = await page.evaluate(() => {
      window.__run('LONG', 1);
      resignOrder('SORTIE');
      const first = { order: runStats.order, cut: runStats.orderCut, bonus: orderBonus() };
      // Now extend again - the cut is latched by the earlier trade down and stays.
      const back = resignOrder('PATROL');
      const second = { order: runStats.order, cut: runStats.orderCut, bonus: orderBonus(),
                       resigned: !!runStats.resigned };
      return { first, second, back };
    });
    ok(`a squad that cut once carries it (${struck.first.cut})`, struck.first.cut === 0.4);
    ok(`and extending afterwards does not buy the cut back (${struck.second.cut})`,
      struck.back === true && struck.second.resigned === true && struck.second.cut === 0.4);

    // ── The career's own choice is untouched ─────────────────────────────────────
    // activeOrder is what the muster signs for NEXT time. A mid-run trade is about this run.
    const career = await page.evaluate(() => {
      window.__run('LONG', 1);
      const before = activeOrder;
      resignOrder('SORTIE');
      return { before, after: activeOrder, onRun: runStats.order };
    });
    ok(`the muster's choice survives a mid-run trade (${career.before} -> ${career.after})`,
      career.after === career.before && career.after === 'LONG');
    ok('while the run itself carries the new one', career.onRun === 'SORTIE');

    // ── And it is shut when there is nothing to decide ───────────────────────────
    const shut = await page.evaluate(() => {
      const out = {};
      window.__run('LONG', 1);
      out.live = canResign();
      runStats.extracted = true; out.walkedOut = canResign();
      runStats.extracted = false; runStats.won = true; out.won = canResign();
      runStats.won = false;
      window.__run('SORTIE', 3);
      out.shortestAtItsEnd = resignable().filter(o => o.sectors < 3).length;
      runStats = null; out.noRun = canResign();
      return out;
    });
    ok('a live run at a camp can re-sign', shut.live === true);
    ok('a squad that has walked out cannot', shut.walkedOut === false);
    ok('nor one that has already won', shut.won === false);
    ok('and nothing shorter than the shortest order is ever offered', shut.shortestAtItsEnd === 0);
    ok('no run, no trade', shut.noRun === false);

    // ── The camp is where the door is ────────────────────────────────────────────
    const atCampScreen = await page.evaluate(() => {
      window.__run('LONG', 2);
      initiateCamp();
      renderCamp();
      const open = document.querySelector('#camp-choices [data-action="camp-resign"]');
      if (open) open.click();
      renderCamp();
      const offers = [...document.querySelectorAll('#camp-choices [data-action="camp-resign-go"]')]
        .map(b => ({ id: b.dataset.id, text: (b.innerText || '').replace(/\s+/g, ' ').trim() }));
      return { hadOpener: !!open, offers };
    });
    ok('the camp offers the order back', atCampScreen.hadOpener === true);
    ok(`with a button per road still open (${atCampScreen.offers.map(o => o.id).join(', ')})`,
      atCampScreen.offers.length === 2);
    ok(`each priced in front of the player (${(atCampScreen.offers[0] || {}).text || ''})`,
      // Case-insensitively: the stylesheet uppercases the button and innerText returns what is
      // rendered, not what was written.
      atCampScreen.offers.every(o => /%/.test(o.text) && /sectors/i.test(o.text)));
  }
};

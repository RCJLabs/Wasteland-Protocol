// H03. The requisition shelf F04 built has been running at 90% utilisation for a long time and
// depth never moved with it. Measured over forty carried runs: 263 skulls earned, 74 to the
// Citadel, 162 to the shelf, 27 left on hand - and mean depth 3.46 / 3.38 / 3.44 across the
// thirds of that career. A shelf nobody uses is a discoverability problem. A shelf everybody
// empties that changes nothing is a different problem, and the ledger says this is the second
// one.
//
// The reason is in what was on it. FRESH FACES is variance. A GRUDGE CALLED IN is difficulty
// asked for. A RUNG ON CREDIT is harder content bought on tick. Three items and not one of them
// makes the squad stronger, so a career's whole skull income was buying re-rolls of the same
// game. ONE MORE FALLBACK is the first item on that shelf that is plainly capability: a second
// chance beyond what the Citadel sells, for one expedition, aimed at the thing that actually
// ends runs.
//
// What is held here is the shape of a shelf item rather than a balance number: it is bought once,
// it arrives on the expedition and only that expedition, it survives a reload at both the places
// a reload can happen, it comes back if the order is cleared, and it does not sell a second
// chance to a squad whose contract has already signed every one of them away.
module.exports = {
  name: 'A second chance you can buy',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // A career at the point the shelf is reachable: skulls in hand, nothing on order, no
    // contract signed and no rung climbed. Everything below stages off this.
    await page.evaluate(() => {
      window.__shelf = (purse = 50) => {
        currentSlot = 1; confirmNewGame(1.0);
        activeContracts = []; ascension = 0; careerWins = 0; bestRung = 0;
        metaUpgrades.extraRegroups = 0;
        pendingReq = newPendingReq(); fallbackCredit = false;
        bossSkulls = purse;
      };
    });

    // ── On the shelf, and priced ────────────────────────────────────────────────
    const shelf = await page.evaluate(() => {
      window.__shelf();
      return { ids: REQUISITIONS.map(r => r.id),
               entry: REQUISITIONS.find(r => r.id === 'FALLBACK'),
               cost: reqCost('FALLBACK'), constant: REQ_FALLBACK_COST,
               open: reqOpen('FALLBACK') };
    });
    ok(`the shelf carries it alongside the other three (${shelf.ids.join(', ')})`,
      shelf.ids.includes('FALLBACK') && shelf.ids.length === 4);
    ok(`it has a name and says what it does (${shelf.entry && shelf.entry.name})`,
      !!shelf.entry && !!shelf.entry.name && /expedition/i.test(shelf.entry.desc));
    ok(`priced off the constant rather than a number in the renderer (${shelf.cost})`,
      shelf.cost === shelf.constant && shelf.cost > 0);
    ok('and open to a career that has not ordered one', shelf.open === true);

    // ── Bought once, and only once ──────────────────────────────────────────────
    const bought = await page.evaluate(() => {
      window.__shelf(50);
      const price = reqCost('FALLBACK');
      const first = buyRequisition('FALLBACK');
      const afterFirst = bossSkulls;
      const openAfter = reqOpen('FALLBACK');
      const second = buyRequisition('FALLBACK');
      return { price, first, afterFirst, openAfter, second, afterSecond: bossSkulls,
               onOrder: pendingReq.fallback };
    });
    ok(`buying it takes the price and nothing else (50 - ${bought.price} = ${bought.afterFirst})`,
      bought.first === true && bought.afterFirst === 50 - bought.price);
    ok('and puts it on the order', bought.onOrder === true);
    ok('a second one is not for sale this expedition', bought.openAfter === false && bought.second === false);
    ok(`so the purse is not charged twice (${bought.afterSecond})`, bought.afterSecond === bought.afterFirst);

    // ── A purse that cannot cover it buys nothing ───────────────────────────────
    const broke = await page.evaluate(() => {
      window.__shelf(0);
      const short = reqCost('FALLBACK') - 1;
      bossSkulls = short;
      const tried = buyRequisition('FALLBACK');
      return { short, tried, purse: bossSkulls, onOrder: pendingReq.fallback };
    });
    ok(`one skull short buys nothing (${broke.short} in hand)`,
      broke.tried === false && broke.onOrder === false && broke.purse === broke.short);

    // ── It arrives on the expedition, and it is exactly one ─────────────────────
    // Both sides read through the engine's own totalRegroups, so the assertion cannot drift
    // away from the sum the game actually deploys with.
    const arrives = await page.evaluate(() => {
      window.__shelf(50);
      const without = totalRegroups(false);
      const with_ = totalRegroups(true);
      buyRequisition('FALLBACK');
      confirmNewGame(1.0);
      const bought = { credit: fallbackCredit, run: runStats.regroups, left: regroupsLeft() };
      // The same career deploying again without buying one.
      window.__shelf(50);
      confirmNewGame(1.0);
      const plain = { credit: fallbackCredit, run: runStats.regroups, left: regroupsLeft() };
      return { without, with_, bought, plain, base: BASE_REGROUPS };
    });
    ok(`the shelf's own arithmetic is one more, not two (${arrives.without} -> ${arrives.with_})`,
      arrives.with_ === arrives.without + 1);
    ok(`an expedition that bought one deploys with it (${arrives.plain.run} without, ${arrives.bought.run} with)`,
      arrives.bought.credit === true && arrives.bought.run === arrives.plain.run + 1);
    ok(`and the count the SQUAD BROKEN screen reads agrees (${arrives.bought.left} left)`,
      arrives.bought.left === arrives.bought.run);
    ok(`one that did not deploys with what the Citadel gave it (${arrives.plain.run} of ${arrives.base})`,
      arrives.plain.credit === false && arrives.plain.run === arrives.base);

    // ── Spent on the expedition it was bought for ───────────────────────────────
    // A purchase that stayed on the shelf would ride every deploy after it for free.
    const spent = await page.evaluate(() => {
      window.__shelf(50);
      buyRequisition('FALLBACK');
      confirmNewGame(1.0);
      const first = { shelf: pendingReq.fallback, run: runStats.regroups };
      confirmNewGame(1.0);
      const next = { shelf: pendingReq.fallback, credit: fallbackCredit, run: runStats.regroups };
      return { first, next, purse: bossSkulls };
    });
    ok('deploying takes it off the shelf', spent.first.shelf === false);
    ok(`so the expedition after it is back to normal (${spent.first.run} then ${spent.next.run})`,
      spent.next.credit === false && spent.next.run === spent.first.run - 1);

    // ── It is a real second chance, not a number on a screen ────────────────────
    // Staged at exactly the boundary H01 is about: a squad wiped with nothing but the bought
    // fallback between it and the end of the run.
    const lastChance = await page.evaluate(() => {
      window.__shelf(50);
      buyRequisition('FALLBACK');
      confirmNewGame(1.0);
      currentSector = 3; currentTier = 5;
      // Spend down to exactly the one the shelf paid for, derived rather than typed - so if the
      // purchase ever stops arriving this stages a squad with nothing left instead of quietly
      // testing a fallback the Citadel would have given it anyway.
      const bought = runStats.regroups - totalRegroups(false);
      runStats.regroups = bought;
      playerRoster.forEach(c => { if (c.gridPos > 0) c.hp = 0; });
      renderSquadBroken();
      const btn = [...document.querySelectorAll('#screen-runover [data-action="regroup"]')][0];
      const offered = { text: (btn.innerText || '').trim(), disabled: !!btn.disabled };
      regroupSquad();
      return { offered, left: regroupsLeft(), bought,
               title: document.getElementById('runover-title').innerText.trim(),
               standing: deployed().filter(u => u.hp > 0).length };
    });
    ok(`the bought fallback is the one left standing between the squad and the end (${lastChance.bought})`,
      lastChance.bought === 1);
    ok(`and it is offered as a fallback (${lastChance.offered.text})`,
      lastChance.offered.disabled === false && /REGROUP/.test(lastChance.offered.text));
    ok(`and taking it puts the squad back up (${lastChance.standing} standing)`,
      lastChance.standing > 0 && lastChance.title !== 'RUN OVER');
    ok(`spending it leaves none (${lastChance.left})`, lastChance.left === 0);

    // ── Handed back if the order is cleared ─────────────────────────────────────
    const cleared = await page.evaluate(() => {
      window.__shelf(50);
      const price = reqCost('FALLBACK');
      buyRequisition('FALLBACK');
      const mid = bossSkulls;
      refundRequisitions();
      return { price, mid, back: bossSkulls, onOrder: pendingReq.fallback };
    });
    ok(`clearing the order returns the price exactly (${cleared.mid} -> ${cleared.back})`,
      cleared.back === cleared.mid + cleared.price && cleared.back === 50);
    ok('and takes it off the order', cleared.onOrder === false);

    // ── A reload cannot lose it, at either end ──────────────────────────────────
    // Two different files carry it at two different moments: the career file while it sits on
    // the shelf, the run save once an expedition has taken it. E10 is the phase that found
    // this class of loss, so both are proved off the file rather than off the variable.
    const reload = await page.evaluate(() => {
      window.__shelf(50);
      buyRequisition('FALLBACK');
      saveMeta();
      pendingReq = newPendingReq();          // as a fresh session would start
      loadMeta();
      const onShelf = pendingReq.fallback;
      window.__shelf(50);
      buyRequisition('FALLBACK');
      confirmNewGame(1.0);
      const wasRegroups = runStats.regroups;
      saveGameState();
      fallbackCredit = false;
      loadGameState();
      return { onShelf, credit: fallbackCredit, wasRegroups, nowRegroups: totalRegroups() };
    });
    ok('a purchase on the shelf survives a reload of the career file', reload.onShelf === true);
    ok(`and one already deployed on survives a reload of the run (${reload.wasRegroups} fallbacks)`,
      reload.credit === true && reload.nowRegroups === reload.wasRegroups);

    // ── Not sold through a door a contract has welded shut ──────────────────────
    // The shelf and the contract board are the same screen and can be worked in either order,
    // so both orders are held: the item is off the shelf under NO_REGROUPS, and signing it
    // afterwards hands the skulls back instead of pocketing them.
    const welded = await page.evaluate(() => {
      window.__shelf(50);
      activeContracts = ['NO_REGROUPS'];
      const shut = { open: reqOpen('FALLBACK'), bought: buyRequisition('FALLBACK'), purse: bossSkulls };
      window.__shelf(50);
      const price = reqCost('FALLBACK');
      buyRequisition('FALLBACK');
      const paid = bossSkulls;
      toggleContract('NO_REGROUPS');
      const signed = { onOrder: pendingReq.fallback, purse: bossSkulls, signed: hasContract('NO_REGROUPS') };
      // And with the contract in force the expedition still deploys with none of them.
      confirmNewGame(1.0);
      const run = runStats.regroups;
      activeContracts = [];
      return { shut, price, paid, signed, run };
    });
    ok(`a signed NO_REGROUPS takes it off the shelf (open: ${welded.shut.open})`,
      welded.shut.open === false && welded.shut.bought === false && welded.shut.purse === 50);
    ok(`signing it afterwards hands the skulls back (${welded.paid} -> ${welded.signed.purse})`,
      welded.signed.signed === true && welded.signed.onOrder === false
      && welded.signed.purse === welded.paid + welded.price);
    ok(`and the expedition deploys with none either way (${welded.run})`, welded.run === 0);

    // ── The rung still takes one off the top ────────────────────────────────────
    // ATTRITION is the ladder's answer to a bought safety net, and it has to keep working on a
    // net bought off the shelf as well as one built at the Citadel - otherwise the shelf is a
    // way to buy back out of the rung being climbed.
    const rung = await page.evaluate(() => {
      window.__shelf(50);
      const idx = PROTOCOLS.findIndex(p => p.id === 'ATTRITION');
      ascension = idx + 1;
      const on = hasProtocol('ATTRITION');
      const without = totalRegroups(false);
      const with_ = totalRegroups(true);
      ascension = 0;
      return { on, without, with_, flat: totalRegroups(false) };
    });
    ok('the rung under test is the one that takes fallbacks', rung.on === true);
    ok(`it still takes one off the top of a bought net (${rung.flat} flat, ${rung.without} under the rung)`,
      rung.without === rung.flat - 1);
    ok(`and the purchase adds to what is left rather than opting out (${rung.without} -> ${rung.with_})`,
      rung.with_ === rung.without + 1);

    // ── The board draws it, and draws the engine's numbers ──────────────────────
    const drawn = await page.evaluate(() => {
      window.__shelf(50);
      renderRequisitions();
      const el = document.getElementById('req-list');
      const btn = el.querySelector('[data-action="buy-req"][data-id="FALLBACK"]');
      const card = [...el.querySelectorAll('.req-card')].find(c => /FALLBACK/i.test(c.innerText));
      const before = btn ? (btn.innerText || '').replace(/\s+/g, ' ').trim() : null;
      // With none in the purse the control is offered but not live, the way every other
      // unaffordable control on this screen is.
      bossSkulls = 0; renderRequisitions();
      const poorBtn = el.querySelector('[data-action="buy-req"][data-id="FALLBACK"]');
      // And with the contract signed the card says so instead of showing a dead button.
      bossSkulls = 50; activeContracts = ['NO_REGROUPS']; renderRequisitions();
      const weldedCard = [...document.querySelectorAll('#req-list .req-card')]
        .find(c => /FALLBACK/i.test(c.innerText));
      activeContracts = [];
      return { hasCard: !!card, before, price: reqCost('FALLBACK'),
               base: totalRegroups(false), bought: totalRegroups(true),
               poorDisabled: poorBtn ? !!poorBtn.disabled : null,
               welded: weldedCard ? weldedCard.innerText.replace(/\s+/g, ' ') : null,
               weldedBtn: !!document.querySelector('#req-list [data-action="buy-req"][data-id="FALLBACK"]') };
    });
    ok('the shelf draws a card for it', drawn.hasCard === true);
    ok(`the button counts the fallbacks rather than saying "one more" (${drawn.before})`,
      drawn.before !== null && drawn.before.includes(`${drawn.base}`) && drawn.before.includes(`${drawn.bought}`));
    ok(`and shows the price (${drawn.price})`, drawn.before.includes(`${drawn.price}`));
    ok('an empty purse leaves it drawn but dead, like the rest of the screen',
      drawn.poorDisabled === true);

    // The board is read between expeditions, when the credit from the LAST one is still sitting
    // in the variable. Pricing the row off the live reader would quote "3 -> 4" to a career that
    // deploys with two, which is why totalRegroups takes the credit rather than reading it.
    const stale = await page.evaluate(() => {
      window.__shelf(50);
      fallbackCredit = true;              // as the expedition just ended would leave it
      renderRequisitions();
      const btn = document.querySelector('#req-list [data-action="buy-req"][data-id="FALLBACK"]');
      const label = (btn.innerText || '').replace(/\s+/g, ' ').trim();
      fallbackCredit = false;
      return { label, base: totalRegroups(false), bought: totalRegroups(true) };
    });
    ok(`a credit left over from the last expedition does not inflate the quote (${stale.label})`,
      stale.label.includes(`${stale.base} \u2192 ${stale.bought}`));

    // CLEAR THE ORDER is the only way back out, so it has to appear for an order that is nothing
    // but a fallback - not just for one with rerolls or a grudge in it.
    const clearable = await page.evaluate(() => {
      window.__shelf(50); renderRequisitions();
      const before = !!document.querySelector('#req-list [data-action="req-clear"]');
      buyRequisition('FALLBACK'); renderRequisitions();
      return { before, after: !!document.querySelector('#req-list [data-action="req-clear"]') };
    });
    ok('an order of nothing but a fallback can still be cleared',
      clearable.before === false && clearable.after === true);
    ok(`a signed contract replaces the control with the reason (${(drawn.welded || '').slice(0, 70)})`,
      drawn.weldedBtn === false && /signed away/i.test(drawn.welded || ''));
  }
};

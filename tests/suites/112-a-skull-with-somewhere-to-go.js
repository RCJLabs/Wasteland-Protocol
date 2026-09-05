// F04. Ninety-five skulls buys every spot in the Citadel, and a career that has bought them out
// keeps earning: a commander is a skull, a grudge is more, an extraction and a victory are more
// again. Measured on the corrected instrument over three samples of 150 careers, 1,136 / 1,160 /
// 1,117 skulls ended the sample unspent with every buyable spot bought. The currency had no sink
// above the cap and stopped being a decision the moment the last building went up.
//
// The shelf sits on the contract board rather than in the Citadel, because these are bought for
// ONE expedition rather than built into the career, and it is priced off the ladder.
//
// The rung is the one worth stating. unlockedProtocols opens nothing at all until a career has a
// win in it, and on the corrected instrument almost no career has one - three of 450 - so the
// whole ascension ladder is content nobody reaches. A rung on credit is the way in.
//
// Numbers below are hardcoded from the design rather than read back out of the constants the
// engine reads: 2 a reroll, three of them an expedition, 3 plus the grudge to call one in, and
// ten times the rung being reached for.
module.exports = {
  name: 'A skull with somewhere to go',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      // A career that has bought the hillside out and is still earning.
      window.__rich = (skulls = 200) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        grudges = {}; careerWins = 0; bestRung = 0; bossSkulls = skulls;
        pendingReq = newPendingReq();
        grudgeCall = null; rungCredit = false;
        saveMeta();
      };
      window.__disk = () => JSON.parse(Store.get(BASE_SAVE_KEY + currentSlot) || 'null');
      window.__meta = () => JSON.parse(Store.get(META_KEY) || 'null');
    });

    // ── The shelf exists, and it is priced ────────────────────────────────────────────
    const shelf = await page.evaluate(() => {
      window.__rich();
      const ids = REQUISITIONS.map(r => r.id);
      const reroll = reqCost('REROLL');
      grudges = { WARLORD: 2 };
      const called = reqCost('GRUDGE', 'WARLORD');
      grudges = { WARLORD: 1 };
      const lighter = reqCost('GRUDGE', 'WARLORD');
      bestRung = 0; const rung1 = reqCost('RUNG');
      bestRung = 3; const rung4 = reqCost('RUNG');
      bestRung = 0;
      return { ids, reroll, called, lighter, rung1, rung4,
               shaped: REQUISITIONS.every(r => r.id && r.name && r.desc) };
    });
    ok(`there are three things on it (${shelf.ids.join(', ')})`,
      shelf.ids.length === 3 && shelf.shaped
      && ['REROLL', 'GRUDGE', 'RUNG'].every(id => shelf.ids.includes(id)));
    ok(`a reroll is a flat price (${shelf.reroll})`, shelf.reroll === 2);
    ok(`calling one in costs what it is carrying (grudge 1 -> ${shelf.lighter}, grudge 2 -> ${shelf.called})`,
      shelf.lighter === 4 && shelf.called === 5);
    ok(`and the rung is priced off the ladder it reaches for (▲1 ${shelf.rung1}, ▲4 ${shelf.rung4})`,
      shelf.rung1 === 10 && shelf.rung4 === 40);

    // ── Nothing you have not earned the right to ask for ─────────────────────────────
    const gates = await page.evaluate(() => {
      window.__rich();
      grudges = {};
      const strangerOpen = reqOpen('GRUDGE', 'WARLORD');
      const boughtStranger = buyRequisition('GRUDGE', 'WARLORD');
      grudges = { WARLORD: 1 };
      const owedOpen = reqOpen('GRUDGE', 'WARLORD');
      // Three rerolls and no more.
      window.__rich(); let took = 0;
      for (let i = 0; i < 6; i++) if (buyRequisition('REROLL')) took++;
      const capped = { took, onOrder: pendingReq.rerolls, open: reqOpen('REROLL') };
      // An empty purse buys nothing.
      window.__rich(1);
      const broke = buyRequisition('REROLL');
      const purse = bossSkulls;
      return { strangerOpen, boughtStranger, owedOpen, capped, broke, purse };
    });
    ok('a commander nobody has felled is not on the shelf',
      gates.strangerOpen === false && gates.boughtStranger === false);
    ok('one that owes you is', gates.owedOpen === true);
    ok(`rerolls stop at three (${gates.capped.took} taken, ${gates.capped.onOrder} on order)`,
      gates.capped.took === 3 && gates.capped.onOrder === 3 && gates.capped.open === false);
    ok(`and an empty purse buys nothing (${gates.purse} left)`, gates.broke === false && gates.purse === 1);

    // ── FRESH FACES reaches the muster ───────────────────────────────────────────────
    const faces = await page.evaluate(() => {
      window.__rich();
      pendingDifficulty = 1.0;
      beginExpedition();
      const plain = musterRerolls;
      window.__rich();
      const before = bossSkulls;
      buyRequisition('REROLL'); buyRequisition('REROLL');
      const paid = before - bossSkulls;
      const onOrder = pendingReq.rerolls;
      beginExpedition();
      return { plain, paid, onOrder, bought: musterRerolls, spent: pendingReq.rerolls,
               diskRerolls: window.__disk().musterRerolls };
    });
    ok(`two rerolls cost four skulls (${faces.paid})`, faces.paid === 4 && faces.onOrder === 2);
    ok(`and the muster opens with two more than it would have (${faces.plain} -> ${faces.bought})`,
      faces.bought === faces.plain + 2 && faces.diskRerolls === faces.bought);
    ok('the order is spent by deploying, not carried into the next expedition', faces.spent === 0);

    // ── A GRUDGE CALLED IN is the commander at the end of this sector ─────────────────
    const call = await page.evaluate(() => {
      window.__rich();
      grudges = { COLOSSUS: 2 }; saveMeta();
      // Which commander this sector would have had, left alone.
      pendingDifficulty = 1.0; beginExpedition();
      const unasked = bossForSector(1).id;
      window.__rich(); grudges = { COLOSSUS: 2 }; saveMeta();
      const before = bossSkulls;
      const bought = buyRequisition('GRUDGE', 'COLOSSUS');
      const paid = before - bossSkulls;
      beginExpedition();
      const atOne = bossForSector(1).id;
      // The rotation is shuffled per bossSalt, so the sector after can legitimately deal the
      // same commander by chance - asserting it is "not the Colossus" would fail about one
      // battery in eight on a coincidence. The claim is that the call changes ONE sector, so
      // it is checked against what that sector deals with the call lifted off.
      const atTwo = bossForSector(2).id;
      const held = grudgeCall; grudgeCall = null;
      const atTwoUncalled = bossForSector(2).id;
      grudgeCall = held;
      const lastBoss = bossForSector(FINAL_SECTOR);
      const last = lastBoss.id, lastIsFinal = !!lastBoss.final;
      // It arrives carrying what it took from you.
      currentSector = 1; currentTier = 10;
      initiateCombat('BOSS', false);
      const foe = activeEntities.find(e => e.classType === 'BOSS');
      const arrived = { id: foe.bossId, grudge: foe.grudge, name: foe.name };
      combatActive = false;
      return { unasked, bought, paid, atOne, atTwo, atTwoUncalled, last, lastIsFinal, arrived,
               diskCall: window.__disk().grudgeCall, live: grudgeCall };
    });
    ok(`calling one in costs its grudge (${call.paid} skulls)`, call.bought === true && call.paid === 5);
    ok(`and it is standing at the end of this sector (${call.unasked} -> ${call.atOne})`,
      call.atOne === 'COLOSSUS');
    ok(`only this one: the sector after is untouched by the call (${call.atTwo})`,
      call.atTwo === call.atTwoUncalled);
    ok(`and the end of the road is not for sale - the last sector is still the last warlord (${call.last})`,
      call.lastIsFinal === true && call.last !== 'COLOSSUS');
    ok(`what arrives is carrying everything it has taken (${call.arrived.name}, grudge ${call.arrived.grudge})`,
      call.arrived.id === 'COLOSSUS' && call.arrived.grudge === 2 && /Risen/.test(call.arrived.name));
    ok('and the run remembers the call across a reload', call.diskCall === 'COLOSSUS' && call.live === 'COLOSSUS');

    // ── A RUNG ON CREDIT is the way into a ladder nobody reaches ─────────────────────
    const rung = await page.evaluate(() => {
      window.__rich();
      careerWins = 0; bestRung = 0;
      const shut = unlockedProtocols();
      const before = bossSkulls;
      const bought = buyRequisition('RUNG');
      const paid = before - bossSkulls;
      const openNow = unlockedProtocols();
      pendingDifficulty = 1.0;
      beginExpedition();
      const afterDeploy = unlockedProtocols();
      const onOrder = pendingReq.rung;
      // Read here, before the second career below writes over the slot.
      const diskCredit = window.__disk().rungCredit;
      // The credit is a way in, not a way up: felling nothing still leaves bestRung alone,
      // and the ladder shuts again on the expedition after it.
      const rungAfter = bestRung;
      window.__rich(); careerWins = 0; bestRung = 0;
      const shutAgain = unlockedProtocols();
      return { shut, bought, paid, openNow, afterDeploy, onOrder, rungAfter, shutAgain, diskCredit };
    });
    ok('a career with no clear in it cannot reach the ladder at all', rung.shut === 0);
    ok(`ten skulls opens the first rung (${rung.paid})`,
      rung.bought === true && rung.paid === 10 && rung.openNow === 1);
    ok('and the expedition it was bought for keeps it',
      rung.afterDeploy === 1 && rung.onOrder === false && rung.diskCredit === true);
    ok('but the ladder is not climbed by paying for it', rung.rungAfter === 0);
    ok('and the next expedition finds the door shut again', rung.shutAgain === 0);

    const openDoor = await page.evaluate(() => {
      window.__rich(); careerWins = 2; bestRung = 1;
      const alreadyOpen = unlockedProtocols();
      const onShelf = reqOpen('RUNG');
      const bought = buyRequisition('RUNG');
      renderContracts();
      const said = document.getElementById('req-list').innerText;
      return { alreadyOpen, onShelf, bought, purse: bossSkulls, said: /already open/i.test(said) };
    });
    ok(`a career that has walked the road already has the rung (▲${openDoor.alreadyOpen})`,
      openDoor.alreadyOpen === 2);
    ok('so it is off the shelf rather than sold for nothing',
      openDoor.onShelf === false && openDoor.bought === false && openDoor.purse === 200);
    ok('and the board says why', openDoor.said);

    // ── The order can be taken back, and it survives the board ──────────────────────
    const board = await page.evaluate(() => {
      window.__rich(); grudges = { WARLORD: 1 }; saveMeta();
      buyRequisition('REROLL'); buyRequisition('GRUDGE', 'WARLORD'); buyRequisition('RUNG');
      const spent = 200 - bossSkulls;
      const onMeta = window.__meta().pendingReq;
      // A reload on the contract board does not eat the purchase.
      pendingReq = newPendingReq(); bossSkulls = 0;
      loadMeta();
      const back = { rerolls: pendingReq.rerolls, grudge: pendingReq.grudge, rung: pendingReq.rung,
                     skulls: bossSkulls };
      refundRequisitions();
      return { spent, onMeta, back, refunded: bossSkulls, cleared: pendingReq };
    });
    ok(`three purchases cost sixteen skulls (${board.spent})`, board.spent === 2 + 4 + 10);
    ok('the order is written into the career file, so a reload on the board keeps it',
      !!board.onMeta && board.back.rerolls === 1 && board.back.grudge === 'WARLORD'
      && board.back.rung === true && board.back.skulls === 200 - 16);
    ok(`and it can be taken back before deploying (${board.refunded})`,
      board.refunded === 200 && board.cleared.rerolls === 0
      && board.cleared.grudge === null && board.cleared.rung === false);

    // ── The board draws it ───────────────────────────────────────────────────────────
    const drawn = await page.evaluate(() => {
      window.__rich(); grudges = { WARLORD: 2, MATRIARCH: 1 }; saveMeta();
      renderContracts();
      const el = document.getElementById('req-list');
      const buys = [...el.querySelectorAll('[data-action="buy-req"]')];
      const chips = buys.filter(b => b.dataset.id === 'GRUDGE').map(b => b.dataset.boss);
      const clearBefore = el.querySelectorAll('[data-action="req-clear"]').length;
      // Read before the purchase below spends two of them.
      const purse = /200/.test(el.innerText);
      const names = el.innerText;
      buyRequisition('REROLL');
      const after = document.getElementById('req-list');
      return { purse, buys: buys.length, chips, clearBefore,
               clearAfter: after.querySelectorAll('[data-action="req-clear"]').length, names };
    });
    ok(`the shelf is on the contract board with the purse on it (${drawn.buys} buttons)`,
      drawn.buys >= 4 && drawn.purse);
    ok(`with one chip per commander that owes you (${drawn.chips.join(', ')})`,
      drawn.chips.length === 2 && drawn.chips.includes('WARLORD') && drawn.chips.includes('MATRIARCH'));
    ok('and all three named', /FRESH FACES/.test(drawn.names) && /GRUDGE CALLED IN/.test(drawn.names)
      && /RUNG ON CREDIT/.test(drawn.names));
    ok(`the take-it-back button appears only once something is on order (${drawn.clearBefore} -> ${drawn.clearAfter})`,
      drawn.clearBefore === 0 && drawn.clearAfter === 1);

    // ── A career file written before the shelf existed opens with it empty ───────────
    const old = await page.evaluate(() => {
      window.__rich(); buyRequisition('REROLL');
      const m = window.__meta(); delete m.pendingReq;
      Store.set(META_KEY, JSON.stringify(m));
      pendingReq = { rerolls: 9, grudge: 'NOBODY', rung: true };
      loadMeta();
      return { rerolls: pendingReq.rerolls, grudge: pendingReq.grudge, rung: pendingReq.rung };
    });
    ok('a career from before the shelf carries an empty one',
      old.rerolls === 0 && old.grudge === null && old.rung === false);
  }
};

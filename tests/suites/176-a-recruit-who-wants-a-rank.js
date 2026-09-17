// ── R04: THE RECRUIT NODE ASKED ONE QUESTION ──────────────────────────────────────────
//
// Every recruit node in the game offered a card and a price. The R-audit measured what that
// question actually lands on: 166 of 187 offers went to a line that was ALREADY FULL, so nine
// times in ten "can you afford this" was really "will you replace somebody", asked in the wrong
// currency. I03 and I05 measured that decision carefully; neither could change that the node
// only knows one way to ask.
//
// A TERM is what the body wants instead. PRICE is the offer that has always been here. LINE
// wants a rank: no scrap, straight into the deployed line over the weakest hand standing in it,
// and they will not sit on a bench afterwards.
//
// THREE THINGS NEEDED CARE AND ALL THREE ARE PINNED BELOW.
//
// The term is a function of the NODE, like the cache's lock, so it cannot be rerolled by walking
// away and coming back - including across a reload, which is where a per-visit roll would leak.
//
// The card NAMES the body that steps down, and the body it names is the body that moves. A card
// promising one thing and moving another is F03's defect wearing a recruit's coat, and the only
// way to hold it is to make both read the same function - handRate.
//
// And the bench rule is enforced AFTER the assignment, not before, because assignSlot SWAPS:
// putting somebody else into a rank-holder's slot hands the rank-holder the other body's old
// slot, which can be the bench. A check on the requested move would miss every one of those.
const { engineUp } = require('../boot');

module.exports = {
  name: 'A recruit who wants a rank',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`); await engineUp(page);

    // ── The term belongs to the node ────────────────────────────────────────────────────
    const stable = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const ids = ['n2_0', 'n3_1', 'n4_2', 'n5_0', 'n6_1', 'n7_2', 'n8_0', 'n9_1'];
      const once = ids.map(id => termForNode(id));
      const twice = ids.map(id => termForNode(id));
      // A different sector is a different road, so the same node id may ask something else.
      currentSector = 4;
      const elsewhere = ids.map(id => termForNode(id));
      currentSector = 1;
      RECRUIT_TERMS_ON = false;
      const withheld = ids.map(id => termForNode(id));
      RECRUIT_TERMS_ON = true;
      return { once, twice, elsewhere, withheld };
    });
    ok(`asking twice gives the same answer (${stable.once.join(',')})`,
      stable.once.every((t, i) => t === stable.twice[i]));
    ok('and both terms are reachable on one road',
      new Set(stable.once).size === 2 || new Set(stable.elsewhere).size === 2);
    ok('the control withholds every one of them',
      stable.withheld.every(t => t === 'PRICE'));

    // ── The card names the body that moves ──────────────────────────────────────────────
    const card = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); scrap = 9999;
      playerRoster.forEach(c => { c.gridPos = 0; });
      const line = playerRoster.slice(0, 3);
      line.forEach((c, i) => { c.gridPos = i + 1; });
      // One of them is plainly the weakest hand, by a margin nothing else can close.
      const weak = line[1];
      weak.dmgBase = 1; weak.maxHp = 4; weak.hp = 4;
      const named = recruitDisplaced();
      pendingRecruit = { nodeId: 'x', id: recruitables()[0].id, cost: 0, term: 'LINE', taken: false };
      const html = recruitTermHtml();
      return { named: named && named.name, weak: weak.name, id: weak.id,
               html, quotesWeak: html.includes(weak.name),
               button: (() => { renderRecruit();
                 return document.getElementById('recruit-sign').innerText; })() };
    });
    ok(`the weakest hand is the one named (${card.named})`, card.named === card.weak);
    ok('and the card says so before the button is pressed', card.quotesWeak
      && /RANK, NOT SCRAP/i.test(card.html));
    ok(`the button asks for the rank rather than a price ("${card.button}")`,
      /RANK ON THE LINE/i.test(card.button) && !/SCRAP/i.test(card.button));

    // ── Signing pays in a rank ──────────────────────────────────────────────────────────
    const signed = await page.evaluate(() => {
      const before = { scrap, roster: playerRoster.length };
      const weak = playerRoster.find(c => c.dmgBase === 1);
      const slot = weak.gridPos;
      signOnRecruit();
      const me = playerRoster.find(c => c.demandsLine);
      return { spent: before.scrap - scrap, grew: playerRoster.length - before.roster,
               took: me && me.gridPos, wanted: slot,
               steppedDown: weak.gridPos, held: !!(me && me.demandsLine),
               levelled: !!(me && me.level >= 1), hurt: !!(me && me.hp < me.maxHp) };
    });
    ok('it costs no scrap', signed.spent === 0 && signed.grew === 1);
    ok(`they take the named body's rank (${signed.took})`,
      signed.took === signed.wanted && signed.took > 0);
    ok('and that body is on the bench', signed.steppedDown === 0);
    ok('they arrive hurt and levelled like any other signing, and hold the term',
      signed.hurt && signed.levelled && signed.held);

    // ── And the bench ends it ───────────────────────────────────────────────────────────
    // THE ROW THE SWAP CASE NEEDS. Benching them outright is the obvious move and the easy one
    // to catch; being displaced BY somebody else is the one a check on the requested slot would
    // walk straight past, because the slot asked for was never theirs.
    const swapped = await page.evaluate(() => {
      const me = playerRoster.find(c => c.demandsLine);
      const rank = me.gridPos;
      const bench = playerRoster.find(c => c.gridPos === 0 && c.id !== me.id);
      const roster = playerRoster.length;
      assignSlot(bench.id, rank);              // somebody else takes their rank
      return { gone: !playerRoster.some(c => c.id === me.id),
               shrank: roster - playerRoster.length,
               holder: playerRoster.some(c => c.gridPos === rank) };
    });
    ok('displaced by somebody else, they leave', swapped.gone && swapped.shrank === 1
      && swapped.holder);

    const benched = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); scrap = 9999;
      pendingRecruit = { nodeId: 'y', id: recruitables()[0].id, cost: 0, term: 'LINE', taken: false };
      signOnRecruit();
      const me = playerRoster.find(c => c.demandsLine);
      const roster = playerRoster.length;
      assignSlot(me.id, 0);                    // benched outright
      return { gone: !playerRoster.some(c => c.id === me.id), shrank: roster - playerRoster.length,
               booked: (runStats && runStats.walkedOff) || 0 };
    });
    ok('benched outright, they leave', benched.gone && benched.shrank === 1);
    ok(`and the run books it (${benched.booked})`, benched.booked > 0);

    // A PRICE offer is untouched, which is the half of this item that must not have moved.
    const priced = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); scrap = 9999;
      const cost = recruitCost();
      pendingRecruit = { nodeId: 'z', id: recruitables()[0].id, cost, term: 'PRICE', taken: false };
      const term = recruitTermHtml();
      signOnRecruit();
      const me = playerRoster.find(c => recruitables().every(r => r.id !== c.id) && c.demandsLine);
      const newest = playerRoster[playerRoster.length - 1];
      return { spent: 9999 - scrap, cost, term, onBench: newest.gridPos === 0,
               held: !!newest.demandsLine, noTermBlock: term === '' };
    });
    ok(`a priced offer still charges scrap (${priced.spent} of ${priced.cost})`,
      priced.spent === priced.cost && priced.cost > 0);
    ok('and still arrives on the bench, holding nothing',
      priced.onBench && priced.held === false && priced.noTermBlock);
  }
};

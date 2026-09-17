// ── Q01: THE MEDBAY YOU HAD TO SCROLL TO, AND THE LINE BURIED IN THE LIST ──────────────
//
// Two complaints, one screen. The Outpost's roster is seven cards long and a card is tall: the
// four operators actually going out are scattered through it in roster order, and healing the
// squad after a bad expedition meant finding each one and clicking TRIAGE six times apiece.
// F10 already cut the second half of that to one click PER BODY - PATCH UP, priced at exactly
// what the clicks would have cost. What it did not do is cut the FINDING.
//
// TWO CHANGES, NEITHER OF THEM A DIAL. The line is rendered first, in slot order, and the bench
// follows in the order the roster already holds it; and a bar above the list heals everyone who
// needs it in one press. game.js's numbers are untouched - same price, same step, same share.
//
// THE ORDER IS A RENDER ORDER AND NOTHING ELSE, which is the part worth pinning. rosterOrder()
// returns a new array; sorting playerRoster itself would have been one character shorter and
// would have moved the save, the muster, the draft and every gridPos-swapping call site with it.
// Assigning a slot has to reorder the screen WITHOUT reordering the roster, and that is a
// property you cannot see by looking at the screen.
//
// AND THE ALL BUTTON QUOTES OR REFUSES. The obvious implementation loops the roster calling
// medBay() until the scrap runs out, which leaves half a squad healed at a price that was never
// on the button. The bill is totalled first and the button is dead below it. Held here at the
// boundary: one scrap short buys nothing and heals nobody.
const { engineUp, newRun } = require('../boot');

module.exports = {
  name: 'The whole squad at once',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`); await engineUp(page);

    // ── The line comes first, and the roster does not move ──────────────────────────────
    const order = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      // Put the line somewhere it cannot be the roster's own order by accident: the last three
      // bodies on the roster take slots 3, 1, 2.
      playerRoster.forEach(c => { c.gridPos = 0; });
      const n = playerRoster.length;
      playerRoster[n - 1].gridPos = 3;
      playerRoster[n - 2].gridPos = 1;
      playerRoster[n - 3].gridPos = 2;
      const rosterIds = playerRoster.map(c => c.id).join(',');
      renderOutpost();
      const cardNames = [...document.querySelectorAll('#outpost-roster .upgrade-card')]
        .map(c => c.querySelector('.upgrade-header span').innerText);
      document.getElementById('outpost-cyber-view').style.display = 'flex';
      const cyberNames = [...document.querySelectorAll('#cybernetics-roster .upgrade-card')]
        .map(c => c.querySelector('.upgrade-header span').innerText);
      return {
        n, rosterIds, cardNames, cyberNames,
        // What the screen should show, derived from gridPos rather than from a remembered list.
        wantTop: [1, 2, 3].map(p => playerRoster.find(c => c.gridPos === p).name),
        rosterStill: playerRoster.map(c => c.id).join(','),
        accentTop: [...document.querySelectorAll('#outpost-roster .upgrade-card')]
          .slice(0, 3).every(c => c.classList.contains('card-on-line')),
        accentRest: [...document.querySelectorAll('#outpost-roster .upgrade-card')]
          .slice(3).every(c => c.classList.contains('card-benched')),
      };
    });
    ok(`the three on the line are the first three cards (${order.cardNames.slice(0, 3).join(', ')})`,
      order.wantTop.every((name, i) => order.cardNames[i].includes(name)));
    ok('and they are in slot order, not roster order',
      order.cardNames[0].includes(order.wantTop[0]) && order.cardNames[2].includes(order.wantTop[2]));
    ok(`every operator is still drawn exactly once (${order.cardNames.length} of ${order.n})`,
      order.cardNames.length === order.n
      && new Set(order.cardNames).size === order.n);
    // THE ROW THAT SAYS WHY rosterOrder COPIES. A sort in place would pass every row above.
    ok('and playerRoster itself is untouched - the order is the screen\'s, not the roster\'s',
      order.rosterStill === order.rosterIds);
    ok('the cybernetics tab lists the same seven in the same order',
      order.cyberNames.length === order.n
      && order.cyberNames.every((nm, i) => nm === order.cardNames[i].split(' (')[0]));
    ok('a card says which half of the list it is in, for when the top has scrolled away',
      order.accentTop && order.accentRest);

    // Moving somebody has to move the screen, which is the whole point of ordering by gridPos
    // rather than by a list built once.
    const moved = await page.evaluate(() => {
      const benched = playerRoster.find(c => c.gridPos === 0);
      assignSlot(benched.id, 1);
      const first = document.querySelector('#outpost-roster .upgrade-card .upgrade-header span').innerText;
      return { name: benched.name, first, pos: benched.gridPos };
    });
    ok(`benching and fielding re-sorts the screen (${moved.name} to the top)`,
      moved.pos === 1 && moved.first.includes(moved.name));

    // ── One press for the whole squad ───────────────────────────────────────────────────
    const bar = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      scrap = 99999;
      renderOutpost();
      const whole = document.getElementById('outpost-medbar').innerText;
      // Three hurt by different amounts, so TRIAGE ALL and PATCH UP ALL cannot quote the same
      // price and the two buttons are answering different questions. Two of them on the line and
      // one on the bench, because the split is the thing the head is for - a first cut hurt
      // three deployed bodies and could not tell the two counts apart.
      const line = playerRoster.filter(c => c.gridPos > 0);
      const bench = playerRoster.filter(c => c.gridPos === 0);
      line[0].hp = 1;
      line[1].hp = line[1].maxHp - 1;
      bench[0].hp = Math.floor(bench[0].maxHp / 2);
      renderOutpost();
      const needy = medBayNeedy().length;
      return { whole, needy, hurt: document.getElementById('outpost-medbar').innerText,
               onLine: medBayNeedy().filter(c => c.gridPos > 0).length,
               tri: triageAllCost(), pat: patchUpAllCost(),
               btns: [...document.querySelectorAll('[data-action="medbay-all"]')].map(b => b.dataset.mode) };
    });
    ok('with nobody hurt the bar says so rather than hiding', /full health/i.test(bar.whole)
      && !/TRIAGE ALL/.test(bar.whole));
    // Case-insensitive on purpose: the head is uppercased by CSS and innerText reports what is
    // RENDERED, so a case-sensitive match here tests the stylesheet rather than the count.
    ok(`and with three hurt it counts them, and says how many are going out - "${
        bar.hurt.replace(/\n/g, ' ')}"`,
      bar.needy === 3 && bar.onLine === 2
      && /3 HURT/i.test(bar.hurt) && /2 ON THE LINE/i.test(bar.hurt));
    ok('both doors are offered when they are worth different money',
      bar.pat > bar.tri && bar.btns.includes('HEAL') && bar.btns.includes('PATCH'));

    // The price is the sum of what the single buttons charge, and not a discount - F10's rule,
    // read off the per-operator functions rather than restated here.
    const priced = await page.evaluate(() => {
      const hurt = medBayNeedy();
      return { pat: patchUpAllCost(), sum: hurt.reduce((a, c) => a + patchUpCost(c), 0),
               tri: triageAllCost(), steps: hurt.length * medBayCost() };
    });
    ok(`PATCH UP ALL bills what the cards would have (${priced.pat} = ${priced.sum})`,
      priced.pat === priced.sum && priced.tri === priced.steps);

    // ── Quoted or nothing ───────────────────────────────────────────────────────────────
    const short = await page.evaluate(() => {
      const cost = patchUpAllCost();
      scrap = cost - 1;
      const before = playerRoster.map(c => c.hp);
      renderOutpost();
      const dead = [...document.querySelectorAll('[data-action="medbay-all"][data-mode="PATCH"]')]
        .every(b => b.disabled);
      medBayAll('PATCH');                       // driven directly, past the disabled button
      return { dead, cost, spent: (cost - 1) - scrap,
               moved: playerRoster.some((c, i) => c.hp !== before[i]) };
    });
    ok(`one scrap short, the button is dead (${short.cost} needed)`, short.dead);
    ok('and calling it anyway heals nobody and charges nothing',
      short.spent === 0 && short.moved === false);

    const paid = await page.evaluate(() => {
      const cost = patchUpAllCost();
      scrap = cost;
      medBayAll('PATCH');
      return { cost, left: scrap, full: playerRoster.every(c => c.hp <= 0 || c.hp === c.maxHp),
               needy: medBayNeedy().length };
    });
    ok(`at the quoted price it patches the whole roster (${paid.cost} scrap)`,
      paid.full && paid.needy === 0 && paid.left === 0);

    // TRIAGE ALL is one step each and not a cure, which is what makes it the cheaper answer
    // rather than a slower one.
    const step = await page.evaluate(() => {
      const c = playerRoster[0], d = playerRoster[1];
      c.hp = 1; d.hp = 1;
      scrap = triageAllCost();
      const want = [c, d].map(x => Math.min(x.maxHp, 1 + medBayStep(x)));
      medBayAll('HEAL');
      return { got: [c.hp, d.hp], want, left: scrap, still: medBayNeedy().length };
    });
    ok(`TRIAGE ALL moves everybody one step (${step.got.join(', ')})`,
      step.got[0] === step.want[0] && step.got[1] === step.want[1] && step.left === 0);

    // The dead are not on the bill. Nothing at the Outpost brings them back, and a body at zero
    // charged for like an injury is the shape of the bug F10's own notes warn about.
    const dead = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      playerRoster.forEach(c => { c.hp = c.maxHp; });
      const gone = playerRoster[0];
      gone.hp = 0;
      playerRoster[1].hp = 1;
      const cost = patchUpAllCost();
      scrap = cost;
      medBayAll('PATCH');
      return { cost, onBill: medBayNeedy().some(c => c.id === gone.id),
               stillDown: gone.hp, other: playerRoster[1].hp === playerRoster[1].maxHp };
    });
    ok('a body at zero is not on the bill and is not raised by it',
      dead.onBill === false && dead.stillDown === 0 && dead.other);
  }
};

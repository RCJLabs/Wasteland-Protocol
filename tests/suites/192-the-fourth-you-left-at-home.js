// E12b found ten abilities the simulator had never fired. E12c settled which three of the four a
// rank III operator brings, kept the engine's default - the muster benches the newly-earned
// fourth - and justified keeping it with one sentence: "a player sees the bench control every
// time they muster". That is true of the muster. It was never true of the fight.
//
// CENSUSED BEFORE BUILDING, with every class at rank III:
//
//   10 of 10 classes have a fourth ability, and 10 of 10 default to benching it
//   the codex's DECK_<CLASS> entry names all four and explains the bench     correct
//   the muster / roster / recruit chips mark the benched one with a cross    correct
//   V01's operator file, mid-fight                          three verbs, no fourth named
//   the Chronicle dossier                     "rank III at 8,000: Stim Dart" - a flat promise
//
// So an operator who earned a move at rank III and is not carrying it read identically to one
// who never earned it, on the one screen you look at while deciding what to do. deckFor drops
// the benched move and V01's file inherited that filter without inheriting the explanation.
//
// Two smaller ones fixed with it. The chip row's cross was explained only by a title attribute,
// which is nothing on a touch screen - game.js already keeps the rule for the tactic buttons,
// "legible without a hover", and this row did not. And the dossier promised the ability flatly
// when what rank III opens is a choice.
//
// PINNED AGAINST THE DECLARATIONS. Every row below checks the shipped HTML against
// ABILITIES + FOURTH_ABILITIES - the tables the abilities are written in - rather than against
// deckFor or benchedFor, so a rule that changes cannot carry the assertions with it.
module.exports = {
  name: 'The fourth you left at home',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    const atRank = rank => page.evaluate(r => {
      localStorage.clear(); currentSlot = 1; loadMeta();
      Object.keys(MASTERY_TITLES).forEach(c => mastery[c] = MASTERY_RANKS[r]);
      confirmNewGame(1.0); sectorFront = null;
      const text = el => { const d = document.createElement('div'); d.innerHTML = el; return d.innerText; };
      return playerRoster.filter(p => p.gridPos > 0).map(ch => {
        const all = [...(ABILITIES[ch.classType] || []), FOURTH_ABILITIES[ch.classType]].filter(Boolean);
        const file = text(operatorFileHtml(ch));
        return { cls: ch.classType, rank: masteryRank(ch.classType),
                 labels: all.map(a => a.label),
                 named: all.filter(a => file.includes(a.label)).map(a => a.label),
                 crossed: all.filter(a => file.includes(`✕ ${a.label}`)).map(a => a.label),
                 saysSittingOut: /sitting this expedition out/.test(file), file };
      });
    }, rank);

    // ---- at rank III the file names all four, and marks the one that is not coming ----
    const three = await atRank(3);
    const missed = three.filter(o => o.named.length !== o.labels.length);
    ok(`a rank III file names every verb the class has - ${three.length} operators `
       + `(${missed.map(o => `${o.cls} ${o.named.length}/${o.labels.length}`).join(', ') || 'none short'})`,
      three.length > 0 && missed.length === 0);
    const badMark = three.filter(o => o.crossed.length !== 1 || !o.saysSittingOut);
    ok(`exactly one of them is marked as staying behind, in words `
       + `(${badMark.map(o => `${o.cls} ${o.crossed.length}`).join(', ') || 'all one'})`,
      badMark.length === 0);
    // The marked one is the one the deck does NOT carry. Checked against the buttons the engine
    // actually draws rather than against benchedFor, which is what picks the mark in the first
    // place - otherwise this row asks the rule whether it agrees with itself.
    const agree = await page.evaluate(() => {
      const out = [];
      playerRoster.filter(p => p.gridPos > 0).forEach(ch => {
        const d = document.createElement('div'); d.innerHTML = operatorFileHtml(ch);
        const marked = d.innerText.match(/✕ ([^·]+) ·/);
        const carried = deckFor(ch).map(a => a.label);
        const name = marked ? marked[1].trim() : null;
        if (!name || carried.includes(name) || carried.length !== 3) out.push(ch.classType);
      });
      return out;
    });
    ok(`and it is never one the deck is carrying (${agree.join(', ') || 'none carried'})`,
      agree.length === 0);

    // ---- below rank III there is no fourth to leave behind ----
    const zero = await atRank(0);
    const early = zero.filter(o => o.crossed.length || o.saysSittingOut);
    ok(`an unranked operator is not told about a move they have not earned `
       + `(${early.map(o => o.cls).join(', ') || 'none told'})`, early.length === 0);
    const threeUp = zero.filter(o => o.named.length !== o.labels.length - 1);
    ok('and their file still names the three they do have', threeUp.length === 0);

    // ---- the choice moves the mark ----
    // Un-bench the fourth and a base verb takes the cross. This is the row that says the file
    // reports the player's decision rather than printing the fourth every time.
    const swapped = await page.evaluate(() => {
      Object.keys(MASTERY_TITLES).forEach(c => mastery[c] = MASTERY_RANKS[3]);
      const ch = playerRoster.find(p => p.gridPos > 0);
      const fourth = FOURTH_ABILITIES[ch.classType], first = ABILITIES[ch.classType][0];
      const read = () => { const d = document.createElement('div');
        d.innerHTML = operatorFileHtml(ch); return d.innerText; };
      const before = read();
      ch.benchedMove = first.move;
      const after = read();
      return { fourth: fourth.label, first: first.label,
               beforeCrossed: before.includes(`✕ ${fourth.label}`),
               afterCrossedFirst: after.includes(`✕ ${first.label}`),
               afterCarriesFourth: after.includes(fourth.label) && !after.includes(`✕ ${fourth.label}`) };
    });
    ok(`by default the file marks the move rank III unlocked (${swapped.fourth})`, swapped.beforeCrossed);
    ok(`and bringing it instead moves the mark onto what it displaced (${swapped.first})`,
      swapped.afterCrossedFirst && swapped.afterCarriesFourth);

    // ---- the bench control explains itself without a pointer ----
    const chips = await page.evaluate(() => {
      const ch = playerRoster.find(p => p.gridPos > 0);
      const d = document.createElement('div');
      d.innerHTML = loadoutChipsHtml(ch.classType, ch.benchedMove, ch.id, 'roster');
      const all = [...(ABILITIES[ch.classType] || []), FOURTH_ABILITIES[ch.classType]].filter(Boolean);
      const head = d.querySelector('.loadout-head');
      return { text: head ? head.innerText : null, n: all.length,
               // and the only other explanation, which a touch screen never shows
               titles: [...d.querySelectorAll('[title]')].length };
    });
    ok(`the chip row says what it is without a hover (${chips.text})`,
      !!chips.text && new RegExp(`${chips.n - 1} OF ${chips.n}`).test(chips.text)
      && /tap|sit/i.test(chips.text));
    ok(`with the tooltips kept as the longer version rather than the only one (${chips.titles})`,
      chips.titles > 0);

    // ---- what the dossier promises is what rank III actually does ----
    const promise = await page.evaluate(() => {
      Object.keys(MASTERY_TITLES).forEach(c => mastery[c] = MASTERY_RANKS[2]);
      mastery.BRUISER = MASTERY_RANKS[3];
      renderChronicle();
      const rows = [...document.querySelectorAll('.dossier-row')].map(r => ({
        cls: r.querySelector('.dossier-cls').innerText,
        next: r.querySelector('.dossier-next').innerText }));
      const below = rows.filter(r => /rank III at/.test(r.next));
      const at = rows.find(r => r.cls === 'BRUISER');
      return { n: below.length,
               flat: below.filter(r => !/in place of/.test(r.next)).map(r => r.cls),
               atThree: at && at.next, atThreeQualified: !!at && /in place of/.test(at.next) };
    });
    ok(`the line that promises the fourth says it costs one of the three - ${promise.n} classes `
       + `(${promise.flat.join(', ') || 'none flat'})`, promise.n > 0 && promise.flat.length === 0);
    ok(`and so does the line for a class that already has it (${promise.atThree})`,
      promise.atThreeQualified);

    // ---- the census that makes this the ordinary case rather than an edge ----
    const census = await page.evaluate(() => {
      // A FRESH squad on purpose: the swap block above un-benched one operator to prove the
      // mark follows the choice, and a census taken on that state reads one short and looks
      // like a defect in buildNewRun. It read 6 of 7 once for exactly that reason.
      localStorage.clear(); currentSlot = 1; loadMeta();
      Object.keys(MASTERY_TITLES).forEach(c => mastery[c] = MASTERY_RANKS[3]);
      confirmNewGame(1.0); sectorFront = null;
      const classes = Object.keys(MASTERY_TITLES);
      return { classes: classes.length,
               withFourth: classes.filter(c => FOURTH_ABILITIES[c]).length,
               // buildNewRun stamps the default; this is what a fresh squad actually carries
               benchTheirFourth: playerRoster.filter(p =>
                 FOURTH_ABILITIES[p.classType] && p.benchedMove === FOURTH_ABILITIES[p.classType].move).length,
               roster: playerRoster.length };
    });
    ok(`every class has a fourth (${census.withFourth} of ${census.classes})`,
      census.withFourth === census.classes && census.classes > 0);
    ok(`and a fresh squad leaves every one of them at home (${census.benchTheirFourth} of ${census.roster})`,
      census.benchTheirFourth === census.roster && census.roster > 0);
  }
};

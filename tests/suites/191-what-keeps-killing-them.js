// E14 gave every operator who does not come home a line of their own - who put them down, with
// what, where, at what level. It has been right for a long time. What it has never done is add
// them up: forty lines in a column, one name each, and no statement anywhere about which of the
// wasteland's ways is actually taking them.
//
// MEASURED BEFORE BUILDING, over 40 expeditions of the simulator: 4.15 operators lost per run,
// 33 of 40 runs losing somebody, 27 distinct killers. The chronicle log holds 50 expeditions and
// the roll draws 40 names off it, so a career buries its people several times faster than the
// panel can name them - and the part a player could act on, which faction keeps doing it and
// which of their own classes keeps dying, was the part not written down.
//
// The same census found something else worth keeping: `cause` came back COMBAT on 121 of 121
// permanent losses. The four non-combat causes are wired, reachable and covered by suite 105 by
// construction, but nothing in 40 expeditions was lost to one. That is why the fold buckets on
// the blow's own fields - warlord, elite, rank and file - and not on `cause` alone, which in
// practice is a constant.
//
// THE ROWS BELOW ARE PINNED AGAINST A FIXTURE, NOT AGAINST THE FOLD. Every count asserted here
// is one this file wrote into the log itself, so a fold that miscounts, drops a branch or
// double-counts goes red rather than agreeing with itself - the trap V02 caught twice.
const KINDS = { rankFile: 'the rank and file', elites: 'elites', warlords: 'warlords',
                sky: 'the sky', wounds: 'their wounds', none: 'nothing recorded' };

module.exports = {
  name: 'What keeps killing them',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // A log built one record at a time, so the expected count of every bucket is known here and
    // not read back out of the thing under test.
    const seed = async plan => page.evaluate(p => {
      [1, 2, 3].forEach(s => { Store.remove(chronicleKey(s)); Store.remove(careerKey(s)); });
      currentSlot = 1;
      const fallen = p.recs.map((r, i) => Object.assign(
        { name: `Op${i}`, classType: 'SCAVENGER', level: 1, sector: 1, tier: 1,
          cause: 'COMBAT', killer: null, elite: null, boss: false }, r));
      Store.set(chronicleKey(1), JSON.stringify([{ when: 1, epitaph: 'x', sector: 1, tier: 1,
        score: 0, kills: 0, relics: [], fallen, deployed: [] }]));
      Store.set(careerKey(1), JSON.stringify({ runs: p.runs || 1, kills: 0, deepestSector: 1,
        lost: p.lost != null ? p.lost : fallen.length, fielded: p.fielded || {} }));
      renderChronicle();
      const el = document.getElementById('chronicle-roll');
      return { text: el.innerText, foldFirst: !!el.querySelector('.fold'),
               foldBeforeRows: [...el.querySelectorAll('.fold, .roll-row')]
                 .map(n => n.className.split(' ')[0]).indexOf('roll-row') };
    }, plan);

    // ---- every death lands in exactly one bucket ----
    const mix = { recs: [
      ...Array.from({ length: 6 }, () => ({ killer: 'Raider Gunner' })),
      ...Array.from({ length: 3 }, () => ({ killer: 'Rad Ghoul', elite: 'FRENZIED' })),
      ...Array.from({ length: 2 }, () => ({ killer: 'The Matriarch', boss: true })),
      { cause: 'SMOG' }, { cause: 'SHRAPNEL' },
      { cause: 'BLEED' }, { cause: 'BLED_OUT' },
      { cause: null },
    ] };
    const m = await seed(mix);
    const count = (t, kind) => { const r = new RegExp(`${kind} (\\d+) · (\\d+)%`).exec(t); return r ? +r[1] : null; };
    ok('the fold is drawn above the names, not under them', m.foldFirst && m.foldBeforeRows > 0);
    ok(`six rank-and-file kills are counted as that (${count(m.text, KINDS.rankFile)})`,
      count(m.text, KINDS.rankFile) === 6);
    ok(`an elite's kill is an elite's, not the rank and file's (${count(m.text, KINDS.elites)})`,
      count(m.text, KINDS.elites) === 3);
    ok(`and a warlord's is a warlord's (${count(m.text, KINDS.warlords)})`,
      count(m.text, KINDS.warlords) === 2);
    ok(`smog and shrapnel are one sky between them (${count(m.text, KINDS.sky)})`,
      count(m.text, KINDS.sky) === 2);
    ok(`both spellings of bleeding out are one end (${count(m.text, KINDS.wounds)})`,
      count(m.text, KINDS.wounds) === 2);
    ok(`and a record with nothing in it says so rather than being dropped (${count(m.text, KINDS.none)})`,
      count(m.text, KINDS.none) === 1);
    // The claim that makes the six above a partition rather than six separate counts: nothing
    // is counted twice and nothing falls through. Summed from the DOM, against the fixture.
    const summed = Object.values(KINDS).reduce((a, k) => a + (count(m.text, k) || 0), 0);
    ok(`every one of the ${mix.recs.length} is in exactly one bucket (${summed})`,
      summed === mix.recs.length);
    // And the panel is drawn from the fold rather than counting a second time of its own: what
    // rollFold makes of the log is what rollFoldHtml put on the screen, bucket for bucket.
    const drawn = await page.evaluate(() => {
      const roll = [];
      [1, 2, 3].forEach(s => readChronicle(s).forEach(e => (e.fallen || []).forEach(f => {
        if (f && f.name) roll.push(f); })));
      const f = rollFold(roll);
      const html = rollFoldHtml(roll, { lost: roll.length, fielded: {} });
      return { n: f.n, buckets: f.kinds.length, unwitnessed: f.unwitnessed,
               missing: f.kinds.filter(([k, v]) => !html.includes(`${k} <b>${v}</b>`)).map(([k]) => k) };
    });
    ok(`the panel prints the fold's own buckets and not a second count `
       + `(${drawn.missing.join(', ') || 'none missing'})`,
      drawn.missing.length === 0 && drawn.n === mix.recs.length
      && drawn.buckets + (drawn.unwitnessed ? 1 : 0) === Object.keys(KINDS).length);

    // ---- the sentence and the bucket are the same decision ----
    // felledPhrase picks its wording from the same table felledKind buckets on. If they ever
    // disagree about whether a record is witnessed, the roll prints a sentence the fold has
    // filed under "nothing recorded" or the reverse.
    const agree = await page.evaluate(() => {
      const shapes = [];
      [null, 'COMBAT', 'SMOG', 'SHRAPNEL', 'BLEED', 'BLED_OUT', 'NOT_A_CAUSE'].forEach(cause =>
        [null, 'Raider Gunner'].forEach(killer =>
          [false, true].forEach(boss =>
            [null, 'FRENZIED'].forEach(elite => shapes.push({ cause, killer, boss, elite })))));
      const split = shapes.filter(f => !!fallenPhrase(f) !== !!fallenKind(f));
      return { n: shapes.length, split: split.map(f => JSON.stringify(f)),
               causes: Object.keys(FELLED_CAUSES).length };
    });
    ok(`what the roll will say and what the fold files it as never disagree - ${agree.n} shapes `
       + `(${agree.split.join(', ') || 'none split'})`, agree.split.length === 0);
    // A fallen record calls the killer `killer`; felledPhrase and felledKind call it `name`.
    // That remap is the whole difference between the two shapes, and both pairs go through it,
    // so the pair a caller reaches for cannot change the answer.
    const remap = await page.evaluate(() => {
      const shapes = [{ cause: 'COMBAT', killer: 'Turret', boss: false, elite: null },
                      { cause: 'COMBAT', killer: 'The Matriarch', boss: true, elite: null },
                      { cause: 'SMOG', killer: null, boss: false, elite: 'FRENZIED' },
                      { cause: null, killer: null, boss: false, elite: null }];
      return shapes.filter(f => {
        const k = { cause: f.cause, name: f.killer, elite: f.elite, boss: f.boss };
        return fallenPhrase(f) !== felledPhrase(k) || fallenKind(f) !== felledKind(k);
      }).length;
    });
    ok('and the fallen-record pair is the killer-shaped pair with one field renamed', remap === 0);
    ok(`and both read one table of ${agree.causes} non-combat ends`, agree.causes === 4);
    // Held against the rows themselves: the count of unwitnessed bodies in the fold is the count
    // of rows that admit to it, so the two halves of the panel cannot drift.
    ok('the unwitnessed tally matches the rows that say so',
      (m.text.match(/No record of what took them/g) || []).length === count(m.text, KINDS.none));

    // ---- who, and how many of yours it cost ----
    const worst = await seed({ recs: [
      ...Array.from({ length: 4 }, () => ({ killer: 'War Hound', classType: 'MEDIC' })),
      { killer: 'War Hound', classType: 'MEDIC' },
      ...Array.from({ length: 2 }, () => ({ killer: 'Turret', classType: 'BREACHER' })),
      ...Array.from({ length: 2 }, () => ({ killer: 'Scrapper', classType: 'BREACHER' })),
    ], fielded: { MEDIC: 9, BREACHER: 30 } });
    ok('the worst of them is named with its tally', /WORST OF THEM\nWar Hound 5/.test(worst.text));
    // How many get named is the engine's number, not a second copy of it here.
    const topN = await page.evaluate(() => FOLD_TOP);
    ok(`and only the worst ${topN} are named, not the whole list`,
      (worst.text.split('WORST OF THEM\n')[1] || '').split('\n')[0].split(' · ').length === topN);
    // The class line is the one read a player can act on, and it only means anything against the
    // deployments - which come off the career file, not off the roll.
    ok('the class buried most is set against how often it was sent out',
      /MOST BURIED\nMEDIC · 5 lost of 9 deployed/.test(worst.text));
    // The heading and the arithmetic have to mean the same thing. BREACHER here is 4 of 30 and
    // MEDIC is 5 of 9; ranked by bodies MEDIC wins, ranked by rate MEDIC wins by further still,
    // so that pair cannot tell them apart. This one can: a class fielded constantly and buried
    // most often is the answer to "most buried" and is NOT the answer to "worst rate".
    const rate = await seed({ recs: [
      ...Array.from({ length: 6 }, () => ({ classType: 'SCAVENGER', killer: 'Turret' })),
      ...Array.from({ length: 5 }, () => ({ classType: 'MEDIC', killer: 'Turret' })),
    ], fielded: { SCAVENGER: 60, MEDIC: 6 } });
    ok('and it is the count of bodies that ranks them, which is what the heading claims',
      /MOST BURIED\nSCAVENGER · 6 lost of 60 deployed/.test(rate.text));

    // ---- ties do not move when the panel is opened twice ----
    const tied = { recs: [{ killer: 'Zeta' }, { killer: 'Zeta' }, { killer: 'Alpha' }, { killer: 'Alpha' }] };
    const first = await seed(tied);
    const again = await page.evaluate(() => { renderChronicle();
      return document.getElementById('chronicle-roll').innerText; });
    const line = t => (t.split('WORST OF THEM\n')[1] || '').split('\n')[0];
    ok(`a tie is broken by name rather than by insertion order (${line(first.text)})`,
      /^Alpha 2 · Zeta 2/.test(line(first.text)));
    ok('and reads the same on the second open', line(first.text) === line(again));

    // ---- proportion, and what it is a proportion OF ----
    // One body in a long roll is still one body. Rounded naively it prints as nothing at all.
    // The roll has to be long enough for that to bite: at one in two hundred the naive rounding
    // still reaches 1%, so the first draft of this row passed with the floor deleted. One in
    // three hundred is 0.33%, which rounds to nothing, and is an ordinary length for a career
    // at the measured loss rate.
    const LONG = 299;
    const rare = await seed({ recs: [{ cause: 'SMOG' },
      ...Array.from({ length: LONG }, () => ({ killer: 'Raider Gunner' }))] });
    const skyPc = /the sky 1 · (\d+)%/.exec(rare.text);
    ok(`one death in ${LONG + 1} is not reported as none of them (${skyPc && skyPc[1]}%)`,
      !!skyPc && +skyPc[1] >= 1);
    ok('the fold says it is reading all of them when it is',
      new RegExp(`WHAT KEEPS KILLING THEM · all ${LONG + 1}`).test(rare.text));
    const short = await seed({ recs: [{ killer: 'Turret' }, { killer: 'Turret' }], lost: 900, runs: 200 });
    ok('and says which part it is reading when the log has dropped the rest',
      /WHAT KEEPS KILLING THEM · the 2 still on the log/.test(short.text)
      && /THE ROLL OF THE DEAD · 900/.test(short.text));

    // ---- nothing to fold ----
    const clean = await seed({ recs: [], lost: 0 });
    ok('a career that has lost nobody gets no summary of how',
      !clean.foldFirst && !/WHAT KEEPS KILLING THEM/.test(clean.text)
      && /Every expedition came home whole/.test(clean.text));
  }
};

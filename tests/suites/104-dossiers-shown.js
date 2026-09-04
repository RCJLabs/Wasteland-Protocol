// E13: lifetime class mastery is a cross-run progression system, and its numbers were only ever
// printed for classes standing in the Outpost at the time.
//
// masteryRank has eight call sites and exactly two render anything - the muster card and the
// Outpost operator card - and both iterate playerRoster, which buildNewRun fills from
// ROSTER_TEMPLATE: seven entries. TRENCH_FIEND, HAZMAT and HARPOONER exist only in
// MASTERY_TITLES, CLASS_QUIRKS, FOURTH_ABILITIES and RECRUIT_POOL, so unless one is signed
// mid-run their rows are unreachable. Measured: set every one of the ten classes to rank III
// lifetime XP and the Outpost renders seven mastery lines. Those three are not among them, and
// their rank can climb for a whole career with no figure ever shown.
//
// The codex's own DOSSIERS entry maps Object.keys(MASTERY_TITLES) and calls neither masteryXp
// nor masteryRank: thresholds and unlock names, and nothing about where this player stands.
//
// One correction to the brief. It says two doctrine conditions read those numbers; only OLD
// GUARD does. CONSCRIPTS gates on doctrineFavourites - the three classes fielded most often -
// and its relationship to mastery runs the other way: its edge pays double dossier XP.
//
// Surfacing only. Nothing here changes what mastery does or when.
module.exports = {
  name: 'The dossiers, shown',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── The gap this closes, still measurable ────────────────────────────────────────
    const gap = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      Object.keys(MASTERY_TITLES).forEach(c => { mastery[c] = MASTERY_RANKS[3]; });
      setOutpostTab('SQUAD'); renderOutpost();
      const html = document.getElementById('screen-outpost').innerHTML;
      const tracked = Object.keys(MASTERY_TITLES);
      const starting = ROSTER_TEMPLATE.map(t => t.classType);
      return { tracked, starting,
               shownInOutpost: tracked.filter(c => html.includes(MASTERY_TITLES[c])),
               offRoster: tracked.filter(c => !starting.includes(c)) };
    });
    ok(`mastery is tracked for ${gap.tracked.length} classes and the roster starts with ${gap.starting.length}`,
      gap.tracked.length === 10 && gap.starting.length === 7);
    ok(`at rank III across the board the Outpost still prints only the rostered (${gap.shownInOutpost.length})`,
      gap.shownInOutpost.length === 7);
    ok(`leaving ${gap.offRoster.join(', ')} with nowhere to be read`,
      gap.offRoster.length === 3 && gap.offRoster.every(c => !gap.shownInOutpost.includes(c)));

    // ── The Chronicle now lists every one of them ───────────────────────────────────
    const shown = await page.evaluate(() => {
      mastery = { BRUISER: 9200, MEDIC: 8100, SCAVENGER: 5200, PYROMANIAC: 4100,
                  SHOTGUNNER: 2600, SNIPER: 1700, HOUND: 900, TRENCH_FIEND: 4300, HAZMAT: 1200 };
      renderChronicle();
      const rows = [...document.querySelectorAll('#chronicle-dossiers .dossier-row')].map(r => ({
        cls: r.querySelector('.dossier-cls').innerText,
        xp: r.querySelector('.dossier-xp').innerText,
        next: r.querySelector('.dossier-next').innerText,
        rank: (r.className.match(/dossier-r(\d)/) || [])[1]
      }));
      return { rows, head: document.querySelector('#chronicle-dossiers .dossier-head').innerText,
               note: document.querySelector('#chronicle-dossiers .dossier-note').innerText,
               titles: Object.keys(MASTERY_TITLES) };
    });
    ok(`every tracked class has a row (${shown.rows.length} of ${shown.titles.length})`,
      shown.rows.length === shown.titles.length);
    ok(`including the three that were never on the roster (${['TRENCH FIEND', 'HAZMAT', 'HARPOONER'].filter(c => shown.rows.some(r => r.cls === c)).join(', ')})`,
      ['TRENCH FIEND', 'HAZMAT', 'HARPOONER'].every(c => shown.rows.some(r => r.cls === c)));
    ok(`a class never touched still shows, at zero (${(shown.rows.find(r => r.cls === 'HARPOONER') || {}).xp})`,
      (shown.rows.find(r => r.cls === 'HARPOONER') || {}).xp === '0 / 1,500');
    ok(`the header counts how many are ranked (${shown.head})`, /7 of 10 RANKED/.test(shown.head));

    // ── Every row agrees with the engine, rather than with a table retyped here ─────
    const agree = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#chronicle-dossiers .dossier-row')];
      const bad = [];
      Object.keys(MASTERY_TITLES).forEach((cls, i) => {
        const r = rows[i];
        if (!r) { bad.push(`${cls}: no row`); return; }
        const rank = masteryRank(cls), xp = masteryXp(cls);
        if (r.querySelector('.dossier-cls').innerText !== cls.replace(/_/g, ' ')) bad.push(`${cls}: wrong name`);
        if (Number((r.className.match(/dossier-r(\d)/) || [])[1]) !== rank) bad.push(`${cls}: says rank ${(r.className.match(/dossier-r(\d)/) || [])[1]}, engine says ${rank}`);
        if (!r.querySelector('.dossier-xp').innerText.startsWith(xp.toLocaleString())) bad.push(`${cls}: xp mismatch`);
        const next = r.querySelector('.dossier-next').innerText;
        if (rank < 3) {
          if (!next.includes(MASTERY_RANKS[rank + 1].toLocaleString())) bad.push(`${cls}: next threshold not named`);
          if (rank === 1 && !next.includes(CLASS_QUIRKS[cls].name)) bad.push(`${cls}: quirk not named at rank I`);
          if (rank === 2 && !next.includes(FOURTH_ABILITIES[cls].label)) bad.push(`${cls}: fourth not named at rank II`);
        } else {
          if (!next.includes(MASTERY_TITLES[cls]) || !next.includes(CLASS_QUIRKS[cls].name)
              || !next.includes(FOURTH_ABILITIES[cls].label)) bad.push(`${cls}: a maxed row does not say what it holds`);
        }
      });
      return bad;
    });
    ok(`every row's rank, XP, threshold and unlock come from the engine (${agree.join('; ') || 'clean'})`,
      agree.length === 0);

    // ── The doctrine that reads these numbers says so, correctly ───────────────────
    const doc = await page.evaluate(() => {
      const note = document.querySelector('#chronicle-dossiers .dossier-note').innerText;
      const vets = Object.keys(MASTERY_TITLES).filter(c => masteryRank(c) >= VETERAN_RANK);
      const og = DOCTRINES.find(d => d.id === 'OLD_GUARD');
      const con = DOCTRINES.find(d => d.id === 'CONSCRIPTS');
      return { note, vets, rank: VETERAN_RANK, need: OLD_GUARD_VETS,
               offerable: og.offerable(), conSrc: con.offerable.toString() };
    });
    ok(`the note names the rank OLD GUARD counts and the number it needs (${doc.rank}, ${doc.need})`,
      doc.note.includes(`rank ${doc.rank}`) && doc.note.includes(`${doc.need} classes`));

    // Both of those come out of the same constants the doctrine reads, so quoting them proves
    // nothing on its own. What is worth proving is that the doctrine actually turns over where
    // the note says it does - drive it to one short of the number and then to the number.
    const edge = await page.evaluate(() => {
      const og = DOCTRINES.find(d => d.id === 'OLD_GUARD');
      const classes = Object.keys(MASTERY_TITLES);
      const set = n => { mastery = {}; classes.slice(0, n).forEach(c => { mastery[c] = MASTERY_RANKS[VETERAN_RANK]; }); return og.offerable(); };
      const below = set(OLD_GUARD_VETS - 1), at = set(OLD_GUARD_VETS);
      // And one short of the rank rather than the count.
      mastery = {}; classes.slice(0, OLD_GUARD_VETS).forEach(c => { mastery[c] = MASTERY_RANKS[VETERAN_RANK] - 1; });
      const shortRank = og.offerable();
      return { below, at, shortRank, need: OLD_GUARD_VETS, rank: VETERAN_RANK };
    });
    ok(`${edge.need - 1} veterans is not enough, and ${edge.need} is`, edge.below === false && edge.at === true);
    ok(`and one XP short of rank ${edge.rank} does not count as a veteran`, edge.shortRank === false);
    ok(`and counts the ones that have got there (${doc.vets.length}: ${doc.vets.join(', ')})`,
      doc.note.includes(`${doc.vets.length} have`) && doc.vets.length >= 3 && doc.offerable === true);
    ok('while saying plainly that CONSCRIPTS feeds these numbers rather than reading them',
      /CONSCRIPTS does not read these numbers/.test(doc.note) && !/masteryRank/.test(doc.conSrc));

    // ── With nothing earned yet it still reads as a thing to earn ─────────────────
    const fresh = await page.evaluate(() => {
      mastery = {};
      renderChronicle();
      const rows = [...document.querySelectorAll('#chronicle-dossiers .dossier-row')];
      return { n: rows.length, head: document.querySelector('#chronicle-dossiers .dossier-head').innerText,
               note: document.querySelector('#chronicle-dossiers .dossier-note').innerText,
               allZero: rows.every(r => r.querySelector('.dossier-xp').innerText.startsWith('0 /')),
               allRank0: rows.every(r => /dossier-r0/.test(r.className)),
               offerable: DOCTRINES.find(d => d.id === 'OLD_GUARD').offerable() };
    });
    ok(`a fresh career lists all ten anyway (${fresh.n}, ${fresh.head})`,
      fresh.n === 10 && /0 of 10 RANKED/.test(fresh.head));
    ok('every one at zero and rank nothing', fresh.allZero && fresh.allRank0);
    ok('and the note says nobody has got there, matching the doctrine refusing to be offered',
      /none/.test(fresh.note) || /0 have/.test(fresh.note));
    ok('which is what OLD GUARD itself reports', fresh.offerable === false);

    // ── Surfacing only ───────────────────────────────────────────────────────────
    const inert = await page.evaluate(() => {
      mastery = { BRUISER: 4200 };
      const before = { rank: masteryRank('BRUISER'), xp: masteryXp('BRUISER'),
                       pool: quirkPoolFor('BRUISER').length,
                       deck: deckFor(playerRoster.find(p => p.classType === 'BRUISER')).length };
      renderChronicle(); renderChronicle();
      const after = { rank: masteryRank('BRUISER'), xp: masteryXp('BRUISER'),
                      pool: quirkPoolFor('BRUISER').length,
                      deck: deckFor(playerRoster.find(p => p.classType === 'BRUISER')).length };
      return { before, after };
    });
    ok(`reading the screen does not move a single number (${inert.after.xp} XP, rank ${inert.after.rank})`,
      JSON.stringify(inert.before) === JSON.stringify(inert.after));
  }
};

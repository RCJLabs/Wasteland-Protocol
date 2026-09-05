// E07: every operator who lived long enough ended a run holding the identical four signatures,
// and it was the code that forced it rather than the player choosing it.
//
// rollPerkOffer put every unheld signature ahead of every stat card and took the first three
// distinct ids. A class has four signatures, so a fresh operator's offer was three signatures
// and no stat card - and after taking one it was still three signatures and no stat card. The
// first two promotions of an operator's life could not offer anything but signatures. The screen
// was an ordering, not a choice.
//
// Measured before the change, 400 Bruisers each taking a uniformly random offered card at every
// promotion: the terminal build was the same one every time - all four of AFTERSHOCK, BULWARK,
// GRUDGE and UNSHAKEABLE. The eleven "different" outcomes in that sample were all subsets of the
// same four, distinguished only by which one an operator had not reached yet. Forty signature
// perks, ten builds, one per class. Nothing anywhere marked two signatures incompatible -
// grepping for exclusiv/conflict/incompat found only unrelated prose - and takePerkOffer simply
// applied whatever was picked.
//
// Each class's four are two forks of two now, and the halves of a fork are opposed: take one and
// the other closes for that operator. Four terminal builds per class instead of one, forty
// across the roster instead of ten, and the two promotions that choose them are real decisions
// because both halves are put on the screen side by side with a stat card to say no with.
module.exports = {
  name: 'Two of four, and which two is yours',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── The data has a shape, and a validator that says so ───────────────────────────
    const shape = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const classes = [...new Set(SIG_PERKS.map(p => p.cls))];
      const forks = {};
      SIG_PERKS.forEach(p => { (forks[p.fork] = forks[p.fork] || []).push(p.id); });
      return { bad: validatePerkForks(), classes: classes.length, perks: SIG_PERKS.length,
               forks: Object.keys(forks).length,
               sizes: [...new Set(Object.values(forks).map(f => f.length))],
               withFork: SIG_PERKS.filter(p => p.fork).length };
    });
    ok(`the fork validator finds nothing wrong (${shape.bad.join('; ') || 'clean'})`, shape.bad.length === 0);
    ok(`all ${shape.perks} signatures carry a fork (${shape.withFork})`, shape.withFork === shape.perks);
    ok(`which makes ${shape.forks} forks of two across ${shape.classes} classes`,
      shape.forks === shape.classes * 2 && shape.sizes.length === 1 && shape.sizes[0] === 2);

    // ── An offer is one fork's two halves and a way to decline ──────────────────────
    const offer = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'BRUISER');
      c.traits = [];
      const seen = [];
      for (let i = 0; i < 200; i++) {
        const opts = rollPerkOffer(c);
        const sigs = opts.filter(id => SIG_PERKS.some(p => p.id === id));
        const stats = opts.filter(id => PERK_POOL.some(p => p.id === id));
        const forks = new Set(sigs.map(id => SIG_PERKS.find(p => p.id === id).fork));
        seen.push({ n: opts.length, sigs: sigs.length, stats: stats.length, forks: forks.size });
      }
      return { always3: seen.every(s => s.n === 3),
               alwaysPair: seen.every(s => s.sigs === 2),
               alwaysOneFork: seen.every(s => s.forks === 1),
               alwaysAStat: seen.every(s => s.stats === 1) };
    });
    ok('every offer is still three cards', offer.always3);
    ok('two of them a fork, both halves on the screen at once', offer.alwaysPair && offer.alwaysOneFork);
    ok('and the third a stat card, so a promotion is never a forced ordering', offer.alwaysAStat);

    // ── Taking one half closes the other, through the real path ────────────────────
    const closes = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'MEDIC');
      c.traits = []; c.perkPoints = 1;
      pendingPerkOffers = [{ charId: c.id, options: rollPerkOffer(c) }];
      const shown = pendingPerkOffers[0].options.filter(id => SIG_PERKS.some(p => p.id === id));
      const taken = SIG_PERKS.find(p => p.id === shown[0]);
      const twin = SIG_PERKS.find(p => p.fork === taken.fork && p.id !== taken.id);
      takePerkOffer(pendingPerkOffers[0].options.indexOf(taken.id));
      const stillOffered = [];
      for (let i = 0; i < 200; i++) rollPerkOffer(c).forEach(id => stillOffered.push(id));
      return { taken: taken.id, twin: twin.id, held: hasTrait(c, taken.id),
               twinBackOnScreen: stillOffered.includes(twin.id),
               openForks: openForksFor(c).length,
               unheld: unheldSigsFor(c).map(p => p.id) };
    });
    ok(`taking ${closes.taken} sticks`, closes.held === true);
    ok(`and ${closes.twin} never comes back, across 200 further offers`, closes.twinBackOnScreen === false);
    ok(`one fork left open, and it is the other one (${closes.unheld.join(', ')})`,
      closes.openForks === 1 && closes.unheld.length === 2 && !closes.unheld.includes(closes.twin));

    // ── So an operator ends on two, and which two is the run's ─────────────────────
    // Driven through takePerkOffer, not by pushing ids into traits: the closing is the thing
    // that changed and it lives on the path a promotion actually takes.
    const builds = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const proto = playerRoster.find(p => p.classType === 'BRUISER');
      const tally = {};
      let maxSigs = 0;
      for (let k = 0; k < 400; k++) {
        proto.traits = []; proto.perkPoints = 8;
        for (let i = 0; i < 6; i++) {
          pendingPerkOffers = [{ charId: proto.id, options: rollPerkOffer(proto) }];
          takePerkOffer(Math.floor(Math.random() * 3));
        }
        const sigs = proto.traits.filter(t => SIG_PERKS.some(p => p.id === t)).sort();
        maxSigs = Math.max(maxSigs, sigs.length);
        tally[sigs.join('+')] = (tally[sigs.join('+')] || 0) + 1;
      }
      proto.traits = [];
      const full = Object.entries(tally).filter(([k]) => k.split('+').filter(Boolean).length === 2);
      return { distinct: full.length, maxSigs, tally: Object.fromEntries(full),
               classes: [...new Set(SIG_PERKS.map(p => p.cls))].length };
    });
    ok(`no operator can hold more than two of its four (${builds.maxSigs})`, builds.maxSigs === 2);
    ok(`and there are ${builds.distinct} of those two, not one (${Object.keys(builds.tally).join(' | ')})`,
      builds.distinct === 4);
    ok(`so the roster carries ${builds.distinct * builds.classes} terminal builds where it carried ${builds.classes}`,
      builds.distinct * builds.classes === 40);

    // ── Nothing is stranded: every half is reachable ───────────────────────────────
    const reach = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const proto = playerRoster.find(p => p.classType === 'BRUISER');
      const missed = [];
      [...new Set(SIG_PERKS.map(p => p.cls))].forEach(cls => {
        const c = { ...proto, classType: cls, traits: [] };
        const seen = new Set();
        for (let i = 0; i < 400; i++) {
          c.traits = [];
          rollPerkOffer(c).forEach(id => seen.add(id));
          const half = SIG_PERKS.filter(p => p.cls === cls)[Math.floor(Math.random() * 4)];
          c.traits = [half.id];
          rollPerkOffer(c).forEach(id => seen.add(id));
        }
        SIG_PERKS.filter(p => p.cls === cls).forEach(p => { if (!seen.has(p.id)) missed.push(p.id); });
      });
      return missed;
    });
    ok(`every one of the forty is still reachable (${reach.join(', ') || 'none stranded'})`,
      reach.length === 0);

    // ── The screen says what the choice costs ─────────────────────────────────────
    const screen = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'HOUND');
      c.traits = []; c.perkPoints = 1;
      pendingPerkOffers = [{ charId: c.id, options: rollPerkOffer(c) }];
      renderPerkOffer();
      const cards = [...document.querySelectorAll('#perk-choices .relic-card')];
      const sigCards = cards.filter(el => el.classList.contains('perk-sig'));
      return { sub: document.getElementById('perk-sub').innerText,
               tiers: sigCards.map(el => el.querySelector('.relic-card-tier').innerText),
               titles: sigCards.map(el => el.title),
               statTier: (cards.find(el => el.classList.contains('perk-stat')) || {}).innerText || '' };
    });
    ok(`the subtitle says the other one closes (${screen.sub})`, /closes/.test(screen.sub));
    ok(`and each signature card names the half it shuts (${screen.tiers.join(' / ')})`,
      screen.tiers.length === 2 && screen.tiers.every(t => /CLOSES /.test(t)));
    ok('with the same warning in its tooltip', screen.titles.every(t => /^Taking this closes /.test(t || '')));
    ok('while the training card claims nothing of the sort', !/CLOSES/.test(screen.statTier));

    // ── The operator's own sheet says what was shut, after the screen is gone ─────
    const sheet = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'BRUISER');
      c.traits = [];
      const fresh = traitSummary(c);
      const fork = forksFor(c)[0];
      c.traits = [fork[0].id];
      const one = traitSummary(c);
      c.traits = [fork[0].id, 'VETERAN', 'VETERAN'];
      const withStats = traitSummary(c);
      c.traits = [];
      return { fresh, one, withStats, took: fork[0].id, shut: fork[1].id };
    });
    ok('a fresh operator\u2019s sheet claims nothing', sheet.fresh === '');
    ok(`one taken names the one it shut (${sheet.one})`,
      sheet.one.includes(sheet.took) && /closed:/.test(sheet.one) && sheet.one.includes(sheet.shut));
    ok(`and it still tallies the repeats beside it (${sheet.withStats})`,
      /VETERAN x2/.test(sheet.withStats) && sheet.withStats.includes(sheet.shut));

    // ── And a closed fork does not stop the levels ────────────────────────────────
    const after = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'SNIPER');
      c.traits = forksFor(c).map(g => g[0].id);        // one half of each: both forks closed
      c.perkPoints = 0; c.level = 6;
      const capId = capstoneFor(c).id;
      const unheld = unheldSigsFor(c).length;
      // E08b: the capstone above the forks is the one thing a closed-fork operator can still be
      // shown, and it keeps being shown until taken - a decision still on the table, not a screen
      // with nothing behind it. Everything below the gate banks, which is the rule this block was
      // written to guard; it just no longer means "everything".
      //
      // Levelled one at a time and recording WHICH levels stopped, rather than counting screens
      // over a lump of XP: a count depends on the gate and silently agrees with a moved one. This
      // asserts the rule - nothing below ten, everything from ten up - and moving the gate is
      // meant to land here.
      const stopped = [], banked = [];
      for (let i = 0; i < 8; i++) {                    // levels 7 through 14
        c.xp = 0; c.xpToNext = 10; pendingPerkOffers = [];
        awardXp(c, 10);
        (pendingPerkOffers.some(o => o.options.includes(capId)) ? stopped : banked).push(c.level);
      }
      return { stopped, banked, points: c.perkPoints, unheld };
    });
    ok('with both forks closed there is no signature left to put on a screen', after.unheld === 0);
    ok(`nothing below level ten stops the run (banked at ${after.banked.join(', ')})`,
      after.banked.join(',') === '7,8,9');
    ok(`and every level from ten up offers the capstone (stopped at ${after.stopped.join(', ')})`,
      after.stopped.join(',') === '10,11,12,13,14');
    ok(`while the point is banked either way (${after.points} points)`, after.points === 8);
  }
};

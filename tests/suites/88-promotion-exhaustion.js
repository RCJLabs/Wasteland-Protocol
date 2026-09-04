// D11: 42.5 promotions per run and 26.4 of them signatures, over a median run's worth of
// fights - a level-up roughly every second fight, each one popping the same three-card screen
// P07 built as a moment. Only four signatures exist per class, so an operator that keeps
// fighting runs out of them fast, and every promotion after that draws three cards from the
// same five flat stat bonuses (VETERAN, FORTIFIED, SWIFT, HONED, HARDENED) with nothing left
// to actually decide between taking one now over any other time. 42.5 - 26.4 = a run's worth
// of these: interrupts with nothing to read.
//
// The fix does not touch the pace of levelling or the size of a stat bonus - only when the
// game stops to ask. Once a class's four signatures are all held, a level-up still happens and
// still grants its point, but the point banks itself instead of popping the interrupt - the
// same place a player-declined BANK THE POINT already sends it, spent later at the Outpost
// through the menu that already exists for exactly this.
module.exports = {
  name: 'A promotion with something left to decide',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => { currentSlot = 1; confirmNewGame(1.0); sectorFront = null; });

    // ── unheldSigsFor: the count a class's exhaustion is measured against ───────────────
    const sigCounts = await page.evaluate(() => {
      const byClass = {};
      SIG_PERKS.forEach(p => { byClass[p.cls] = (byClass[p.cls] || 0) + 1; });
      return byClass;
    });
    ok(`every class carries exactly four signatures (${Object.values(sigCounts).join(', ')})`,
      Object.values(sigCounts).every(n => n === 4) && Object.keys(sigCounts).length >= 10);

    // ── A fresh operator still gets the interrupt, same as before ───────────────────────
    const fresh = await page.evaluate(() => {
      const c = playerRoster.find(p => p.classType === 'BRUISER');
      c.traits = []; c.perkPoints = 0; c.level = 1; c.xp = 0; c.xpToNext = 100;
      pendingPerkOffers = [];
      awardXp(c, 100);
      return { level: c.level, perkPoints: c.perkPoints, pending: pendingPerkOffers.length,
               offeredSig: pendingPerkOffers[0] && pendingPerkOffers[0].options
                 .some(id => SIG_PERKS.some(s => s.id === id)) };
    });
    ok(`a fresh operator's first promotion still pops the interrupt (level ${fresh.level}, ` +
       `${fresh.pending} pending)`, fresh.level === 2 && fresh.pending === 1);
    ok('and a signature is on offer, since four are unheld', fresh.offeredSig);

    // ── An operator with every signature already held banks silently instead ────────────
    const exhausted = await page.evaluate(() => {
      const c = playerRoster.find(p => p.classType === 'MEDIC');
      c.traits = SIG_PERKS.filter(p => p.cls === 'MEDIC').map(p => p.id);
      c.perkPoints = 0; c.level = 5; c.xp = 0; c.xpToNext = 245;
      pendingPerkOffers = [];
      const unheld = unheldSigsFor(c).length;
      awardXp(c, 245);
      return { unheldBefore: unheld, level: c.level, perkPoints: c.perkPoints,
               pending: pendingPerkOffers.length };
    });
    ok(`an operator holding all four signatures has none left to offer (${exhausted.unheldBefore})`,
      exhausted.unheldBefore === 0);
    ok(`their next promotion still lands (level ${exhausted.level}) and still grants the point ` +
       `(${exhausted.perkPoints})`, exhausted.level === 6 && exhausted.perkPoints === 1);
    ok('but does not pop the interrupt - nothing was left to decide', exhausted.pending === 0);

    // ── The banked point is genuinely spendable, through the Outpost's existing menu ────
    const spend = await page.evaluate(() => {
      const c = playerRoster.find(p => p.classType === 'MEDIC');
      const before = c.dmgBase;
      assignPerk(c.id, 'VETERAN');
      return { spent: c.perkPoints, dmgBase: c.dmgBase, before, held: (c.traits || []).includes('VETERAN') };
    });
    ok(`the point silently banked is spendable exactly like a declined one ` +
       `(perkPoints now ${spend.spent}, +5 DMG applied: ${spend.before} -> ${spend.dmgBase})`,
      spend.spent === 0 && spend.dmgBase === spend.before + 5 && spend.held);

    // ── Partial exhaustion: one fork spent, one still open, still worth a screen ────────
    // E07 gave each class two forks of two, so "unheld" is fork-shaped now: taking either half
    // closes the other. One fork spent is half an operator's signatures gone and the other half
    // still on the table, which is exactly the case this was written to cover.
    const partial = await page.evaluate(() => {
      const c = playerRoster.find(p => p.classType === 'SCAVENGER');
      const forks = forksFor(c);
      c.traits = [forks[0][0].id];                   // one half taken, so that whole fork closes
      c.perkPoints = 0; c.level = 4; c.xp = 0; c.xpToNext = 182;
      pendingPerkOffers = [];
      awardXp(c, 182);
      const offer = pendingPerkOffers[0];
      const sigs = offer ? offer.options.filter(id => SIG_PERKS.some(s => s.id === id)) : [];
      return { pending: pendingPerkOffers.length, sigs,
               open: openForksFor(c).map(g => g.map(p => p.id)),
               closedHalf: forks[0][1].id };
    });
    ok(`one fork spent still leaves a screen worth stopping for (${partial.pending} pending)`,
      partial.pending === 1);
    ok(`and it offers the open fork's two halves together (${partial.sigs.join(' / ')})`,
      partial.sigs.length === 2 && partial.open.length === 1
      && partial.open[0].every(id => partial.sigs.includes(id)));
    ok(`never the half closed by the one already taken (${partial.closedHalf})`,
      !partial.sigs.includes(partial.closedHalf));

    // ── Level and XP bookkeeping is identical either way - only the interrupt changes ───
    const parity = await page.evaluate(() => {
      const make = held => { const c = JSON.parse(JSON.stringify(
        playerRoster.find(p => p.classType === 'PYROMANIAC')));
        c.traits = held ? SIG_PERKS.filter(p => p.cls === 'PYROMANIAC').map(p => p.id) : [];
        c.perkPoints = 0; c.level = 1; c.xp = 0; c.xpToNext = 100;
        return c; };
      const a = make(false), b = make(true);
      playerRoster.push(a, b);
      pendingPerkOffers = [];
      awardXp(a, 5000); awardXp(b, 5000);
      const out = { levelA: a.level, levelB: b.level, xpToNextA: a.xpToNext, xpToNextB: b.xpToNext,
                    perkPointsB: b.perkPoints };
      playerRoster = playerRoster.filter(c => c.id !== a.id && c.id !== b.id);
      return out;
    });
    ok(`the same XP produces the same level whether signatures are held or not ` +
       `(${parity.levelA} vs ${parity.levelB})`, parity.levelA === parity.levelB);
    ok('and the same xpToNext curve, since only the interrupt was gated, not the leveling',
      parity.xpToNextA === parity.xpToNextB);
    ok(`the exhausted operator still banked a point for every level climbed (${parity.perkPointsB})`,
      parity.perkPointsB === parity.levelB - 1);

    // ── The log still says what happened, since nothing else will ───────────────────────
    const logged = await page.evaluate(() => {
      const c = playerRoster.find(p => p.classType === 'HOUND');
      c.traits = SIG_PERKS.filter(p => p.cls === 'HOUND').map(p => p.id);
      c.perkPoints = 0; c.level = 1; c.xp = 0; c.xpToNext = 100;
      sfxLog = [];
      const before = document.getElementById('log') ? document.getElementById('log').innerText : '';
      awardXp(c, 100);
      const after = document.getElementById('log') ? document.getElementById('log').innerText : '';
      return { grew: after.length > before.length, mentions: after.includes('already taken') };
    });
    ok('a silently-banked promotion is still written to the log', logged.grew && logged.mentions);
  }
};

// Vela's standing moved in exactly two places: the DEBT consequence coming due, and a shakedown
// that only exists once you are already at BAD BLOOD. From neutral the one thing on her screen
// that could raise her was a single +1 that wanted Tech - the material a run is least likely to
// be holding - so in practice her table did nothing.
//
// It measured exactly like that. Over 30 expeditions she reached a standing gate 0 times in 9
// appearances, and her standing never left -1..+1, while every other face sat between 1.6 and
// 3.0 and reached a gate in most of the runs they showed up in. VELA'S LEDGER, which wants
// standing 2 and no outstanding paper, fired 0 times - it could not be reached from a table
// where the only route to 2 was surviving six nodes for a fuse to land.
//
// So what this suite holds is the shape rather than the numbers: that she can be moved at the
// table, in both directions, from neutral and without a specific material in the bag - and, as
// a property the next face cannot regress past, that every face in the cast can.
module.exports = {
  name: 'Vela, at the table',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__run = () => { currentSlot = 1; confirmNewGame(1.0); castState = {}; firedEvents = [];
                             pendingConsequences = []; };
      window.__swing = (c, who) => { const m = String(c.execute).match(/noteCast\(\s*'(\w+)'\s*,\s*(-?\d+)/);
                                     return m && (!who || m[1] === who) ? Number(m[2]) : 0; };
      window.__vela = () => EVENT_POOL.find(e => e.cast === 'VELA');
      window.__live = (ev) => choicesFor(ev).filter(c => c.canAfford());
    });

    // ── Every face can be moved at their own table ───────────────────────────────────────
    // The general property, and the one Vela was the exception to. Not "for free" - the Tinker
    // sells repairs and the Magpie trades relics, and regard that costs money is fine, the game
    // has money. What has to be true is that an ORDINARY squad, mid-run, has something to offer
    // every one of them. 300 scrap and a component of each is what the simulator's median purse
    // looks like when a recruit is standing in front of it.
    const all = await page.evaluate(() => {
      const out = {};
      Object.keys(CAST).forEach(who => {
        const evs = EVENT_POOL.filter(e => e.cast === who);
        __run(); meetCast(who); scrap = 300;
        materials = { parts: 1, chems: 1, tech: 1 };
        // ...and something in the relic bag, because a mid-run squad has one - the simulator
        // reports a mean of 9.4 held. The Magpie trades relics face down and nothing else, and
        // a fixture that empties the bag is testing a squad that does not exist.
        activeRelics = [RELIC_POOL.find(r => r.tier === 'COMMON')];
        const ordinary = Math.max(0, ...evs.flatMap(e => __live(e)).map(c => __swing(c, who)));
        // And separately: does the offer depend on WHICH component is in the bag? Vela's one
        // route up used to want Tech specifically, which is the one a run is least likely to
        // be carrying, so her table was usually greyed out even when it was not empty.
        const perMaterial = MATERIAL_KINDS.map(k => {
          __run(); meetCast(who); scrap = 0; activeRelics = [];
          materials = { parts: 0, chems: 0, tech: 0 }; materials[k] = 1;
          return Math.max(0, ...evs.flatMap(e => __live(e)).map(c => __swing(c, who)));
        });
        out[who] = { events: evs.length, ordinary, perMaterial };
      });
      return out;
    });
    Object.entries(all).forEach(([who, r]) => {
      ok(`${who} has something an ordinary squad can offer (+${r.ordinary})`, r.ordinary >= 1);
    });
    ok(`Vela no longer wants one specific component (${all.VELA.perMaterial.join('/')})`,
       new Set(all.VELA.perMaterial).size === 1 && all.VELA.perMaterial[0] >= 1);
    ok('and she can be raised by a squad carrying nothing at all, which none of the others need to be',
       all.VELA.perMaterial[0] >= 1);

    // The line above measures the BEST option on her table, and she has one that needs nothing
    // at all - so it cannot see whether the favour itself still wants a particular component.
    // Asked of that one choice directly.
    const favour = await page.evaluate(() => MATERIAL_KINDS.map(k => {
      __run(); meetCast('VELA'); scrap = 0;
      materials = { parts: 0, chems: 0, tech: 0 }; materials[k] = 1;
      return { k, live: __live(__vela()).some(c => /sell her a favour/i.test(c.label)) };
    }));
    ok(`the favour takes whichever component is in the bag (${favour.map(f => f.k + ':' + (f.live ? 'yes' : 'NO')).join(' ')})`,
       favour.every(f => f.live));

    // ── Settling early: the move that was missing ────────────────────────────────────────
    const settle = await page.evaluate(() => {
      const ev = __vela();
      // Nothing owed: she does not offer to be paid.
      __run(); meetCast('VELA'); scrap = 900; materials = { parts: 2, chems: 2, tech: 2 };
      const clean = __live(ev).map(c => c.label);
      // Owing, and able to pay.
      __run(); meetCast('VELA'); scrap = 900; materials = { parts: 2, chems: 2, tech: 2 };
      bookConsequence('DEBT', CONSEQUENCE_FUSE.DEBT, { amount: 400 });
      const owingLabels = __live(ev).map(c => c.label);
      const pay = __live(ev).find(c => /settle up now/i.test(c.label));
      const before = { scrap, standing: castStanding('VELA'), owed: owesVela() };
      if (pay) pay.execute();
      const after = { scrap, standing: castStanding('VELA'), owed: owesVela(),
                      debts: pendingConsequences.filter(c => c.kind === 'DEBT').length };
      // Owing, and broke: offered but not affordable.
      __run(); meetCast('VELA'); scrap = 10;
      bookConsequence('DEBT', CONSEQUENCE_FUSE.DEBT, { amount: 400 });
      const brokeLive = __live(ev).some(c => /settle up now/i.test(c.label));
      const brokeAll = choicesFor(ev).some(c => /settle up now/i.test(c.label));
      return { clean, owingLabels, before, after, brokeLive, brokeAll, hasPay: !!pay };
    });
    ok('with nothing owed she does not offer to be paid', !settle.clean.some(l => /settle up now/i.test(l)));
    ok('with paper outstanding she does', settle.hasPay && settle.owingLabels.some(l => /settle up now/i.test(l)));
    ok(`settling costs exactly what the paper says (${settle.before.scrap} -> ${settle.after.scrap})`,
       settle.before.scrap - settle.after.scrap === 400);
    ok(`and pays standing for it (${settle.before.standing} -> ${settle.after.standing})`,
       settle.after.standing - settle.before.standing === 2);
    ok('the debt is cleared rather than left to come due again', !settle.after.owed && settle.after.debts === 0);
    ok('a squad that cannot cover it sees the offer greyed rather than hidden',
       settle.brokeAll && !settle.brokeLive);

    // Every debt in the fixture above is 400, so a settle hardcoded to 400 would pass it.
    // Vouching books 150, which gives a second figure to check the price against.
    const smallPaper = await page.evaluate(() => {
      const ev = __vela();
      __run(); meetCast('VELA'); scrap = 900; materials = { parts: 0, chems: 0, tech: 0 };
      __live(ev).find(c => /someone else's paper/i.test(c.label)).execute();
      const owed = (pendingConsequences.find(c => c.kind === 'DEBT') || {}).amount;
      const before = scrap;
      const pay = __live(ev).find(c => /settle up now/i.test(c.label));
      const label = pay && pay.label;
      if (pay) pay.execute();
      return { owed, spent: before - scrap, label };
    });
    ok(`settling a smaller card costs the smaller number (owed ${smallPaper.owed}, paid ${smallPaper.spent})`,
       smallPaper.spent === smallPaper.owed);
    ok(`and the button says which number it is (${smallPaper.label})`,
       !!smallPaper.label && smallPaper.label.includes(String(smallPaper.owed)));

    // ── Her regard on credit, for a squad holding nothing ────────────────────────────────
    const paper = await page.evaluate(() => {
      const ev = __vela();
      __run(); meetCast('VELA'); scrap = 0; materials = { parts: 0, chems: 0, tech: 0 };
      const opt = __live(ev).find(c => /someone else's paper/i.test(c.label));
      const before = castStanding('VELA');
      if (opt) opt.execute();
      const after = { standing: castStanding('VELA'), owed: owesVela(),
                      amount: (pendingConsequences.find(c => c.kind === 'DEBT') || {}).amount };
      // Already owing: she will not put a second name on a second card.
      const again = __live(ev).some(c => /someone else's paper/i.test(c.label));
      return { had: !!opt, before, after, again };
    });
    ok('a squad with nothing at all still has something to offer her', paper.had);
    ok(`vouching raises her (${paper.before} -> ${paper.after.standing})`, paper.after.standing - paper.before === 1);
    ok(`and it is bought on credit, not for free (owes ${paper.after.amount})`,
       paper.after.owed && paper.after.amount > 0);
    ok('she will not take a second name while the first is outstanding', !paper.again);

    // ── And it opens the thread that never fired ─────────────────────────────────────────
    const ledger = await page.evaluate(() => {
      const gate = FOLLOWUPS.find(f => f.title === "VELA'S LEDGER");
      const ev = __vela();
      __run(); meetCast('VELA'); scrap = 900;
      const atStart = gate.when();
      bookConsequence('DEBT', CONSEQUENCE_FUSE.DEBT, { amount: 400 });
      const owingGate = gate.when();          // standing is not there yet, and paper is out
      __live(ev).find(c => /settle up now/i.test(c.label)).execute();
      return { atStart, owingGate, afterSettle: gate.when(), standing: castStanding('VELA') };
    });
    ok("VELA'S LEDGER is shut at the start of a run", !ledger.atStart);
    ok('and shut while her paper is outstanding', !ledger.owingGate);
    ok(`settling at the table opens it (standing ${ledger.standing})`, ledger.afterSettle);

    // ── She can still be wronged ─────────────────────────────────────────────────────────
    const cold = await page.evaluate(() => {
      __run(); meetCast('VELA'); scrap = 0;
      bookConsequence('DEBT', 0, { amount: 400 });
      const due = consequencesDue();
      const before = castStanding('VELA');
      if (due.length) resolveConsequence();
      const after = castStanding('VELA');
      const shakedown = FOLLOWUPS.find(f => f.title === 'VELA SENDS MEN');
      return { before, after, opensShakedown: shakedown.when() };
    });
    ok(`defaulting still costs her regard (${cold.before} -> ${cold.after})`, cold.after < cold.before);
    ok('and still opens the shakedown, so the road down is intact', cold.opensShakedown);
  }
};

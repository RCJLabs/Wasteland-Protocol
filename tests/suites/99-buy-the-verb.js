// E08: three separate sources hand out banked level points, and none of them could buy what a
// level point is for. assignPerk resolved against PERK_POOL only:
//
//     const perk = PERK_POOL.find(p => p.id === perkId);
//     if (!perk) return;
//
// so a signature id handed to it fell straight back out - no trait granted, and the point not
// even spent - and the Outpost's menu was built from PERK_POOL.map(...), so a signature could
// not be selected there in the first place. takePerkOffer was the only apply site in the file
// that knew SIG_PERKS existed.
//
// The three sources: the BANK button on a promotion screen, the Barracks head start
// (`p.perkPoints = metaUpgrades.startLevel - 1`, four levels at its cap, so four points, against
// a pitch reading "grants early Perk point"), and the Oracle event's u.perkPoints++.
//
// Instrumented over 60 runs on the current build: an operator reaches level 9.8, and 37.0 of a
// run's level-ups land on an operator with no open fork against 14.5 that get a screen. So the
// banked point is the common case, not the corner one.
//
// And a signed recruit was levelled up to squad par on `xpToNext *= 1.5` - the curve XP_CURVE
// replaced, whose own comment says "levels kept stalling, starving the perk economy". At level 9
// that recruit needed 1702 XP where the squad it joined needed 810.
module.exports = {
  name: 'A point that can buy the verb',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── A banked point buys a signature, and pays for the privilege ──────────────────
    const buy = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 1;
      const c = playerRoster.find(p => p.classType === 'BRUISER');
      c.traits = []; c.perkPoints = 2; scrap = 500;
      const want = unheldSigsFor(c)[0];
      const twin = SIG_PERKS.find(p => p.fork === want.fork && p.id !== want.id);
      const cost = sigBuyCost();
      const purse = scrap;
      assignPerk(c.id, want.id);
      const bought = { held: hasTrait(c, want.id), points: c.perkPoints, spent: purse - scrap, cost };
      // The closed half is not for sale at any price.
      const before = [...c.traits];
      assignPerk(c.id, twin.id);
      const shut = { moved: JSON.stringify(before) !== JSON.stringify(c.traits), scrapNow: scrap };
      return { bought, shut, want: want.id, twin: twin.id };
    });
    ok(`a banked point buys ${buy.want} at the Outpost now`, buy.bought.held === true);
    ok(`and it costs both the point and ${buy.bought.cost} scrap (spent ${buy.bought.spent})`,
      buy.bought.points === 1 && buy.bought.spent === buy.bought.cost && buy.bought.cost > 0);
    ok(`while ${buy.twin}, closed by that choice, is not for sale at any price`,
      buy.shut.moved === false);

    // ── An empty purse refuses cleanly rather than half-charging ────────────────────
    const poor = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'MEDIC');
      c.traits = []; c.perkPoints = 1; scrap = sigBuyCost() - 1;
      const want = unheldSigsFor(c)[0];
      assignPerk(c.id, want.id);
      const refused = { held: hasTrait(c, want.id), points: c.perkPoints, scrap };
      scrap = sigBuyCost();
      assignPerk(c.id, want.id);
      return { refused, then: { held: hasTrait(c, want.id), points: c.perkPoints, scrap } };
    });
    ok(`one scrap short and nothing happens - no trait, no point, no charge (${poor.refused.scrap} left)`,
      poor.refused.held === false && poor.refused.points === 1);
    ok('one scrap more and it goes through', poor.then.held === true && poor.then.points === 0 && poor.then.scrap === 0);

    // ── The promotion screen stays the place a signature is free ────────────────────
    const free = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'SNIPER');
      c.traits = []; c.perkPoints = 1; scrap = 0;
      pendingPerkOffers = [{ charId: c.id, options: rollPerkOffer(c) }];
      const idx = pendingPerkOffers[0].options.findIndex(id => SIG_PERKS.some(p => p.id === id));
      takePerkOffer(idx);
      return { held: c.traits.filter(t => SIG_PERKS.some(p => p.id === t)).length, scrap };
    });
    ok('the offer screen still hands one over with an empty purse, which is what makes it the better place to be',
      free.held === 1 && free.scrap === 0);

    // ── The price tracks the road, like every other price ───────────────────────────
    const prices = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const at = s => { currentSector = s; return sigBuyCost(); };
      return { one: at(1), four: at(4), seven: at(7), base: SIG_BUY_BASE };
    });
    ok(`a signature costs its written price at the door (${prices.one})`, prices.one === prices.base);
    ok(`and more the deeper the purse it is coming out of (${prices.four}, ${prices.seven})`,
      prices.four > prices.one && prices.seven > prices.four);

    // ── The menu that could not offer them, offering them ──────────────────────────
    const menu = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 1;
      const c = playerRoster.find(p => p.classType === 'HOUND');
      c.traits = []; c.perkPoints = 1; scrap = 500;
      activePerkSelector = c.id; renderOutpost();
      const read = () => [...document.querySelectorAll('[data-action="assign-perk"]')].map(el => ({
        perk: el.dataset.perk, text: el.innerText, off: el.disabled, title: el.title,
        sig: el.classList.contains('perk-sig') }));
      const rich = read();
      scrap = 0; renderOutpost();
      const broke = read();
      activePerkSelector = null;
      return { rich, broke, open: unheldSigsFor(c).map(p => p.id), stats: PERK_POOL.map(p => p.id) };
    });
    ok(`the menu lists this operator's open signatures (${menu.rich.filter(b => b.sig).map(b => b.perk).join(', ')})`,
      menu.open.every(id => menu.rich.some(b => b.perk === id && b.sig)));
    ok('alongside all five stat perks, which is what it used to offer alone',
      menu.stats.every(id => menu.rich.some(b => b.perk === id && !b.sig)));
    ok(`each signature button prints its price (${menu.rich.find(b => b.sig).text})`,
      menu.rich.filter(b => b.sig).every(b => /SCRAP/.test(b.text)));
    ok('and says which half it will close', menu.rich.filter(b => b.sig).every(b => /^Closes /.test(b.title || '')));
    ok('an empty purse greys the signatures out rather than letting the click fail',
      menu.broke.filter(b => b.sig).every(b => b.off) && menu.broke.filter(b => !b.sig).every(b => !b.off));

    // ── The Barracks pitch is true now ────────────────────────────────────────────
    const head = await page.evaluate(() => {
      const spot = CITADEL_SPOTS.find(s => s.kind === 'LEVEL');
      metaUpgrades.startLevel = 1 + spot.max;
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 1;
      const c = playerRoster[0];
      scrap = 5000;
      const start = { level: c.level, points: c.perkPoints };
      let bought = 0;
      // Bounded: a spend path that stops spending the point would otherwise hang the suite
      // rather than fail it, which is not a test result, it is a hostage situation.
      for (let guard = 0; guard < 8 && c.perkPoints > 0 && unheldSigsFor(c).length; guard++) {
        const want = unheldSigsFor(c)[0];
        const points = c.perkPoints;
        assignPerk(c.id, want.id);
        if (hasTrait(c, want.id)) bought++;
        if (c.perkPoints === points) break;              // it refused; stop asking
      }
      metaUpgrades.startLevel = 1;
      return { start, bought, max: spot.max, pitch: spot.pitch };
    });
    ok(`the Barracks at its cap still opens an operator at level ${head.start.level} with ${head.start.points} points`,
      head.start.points === head.max);
    ok(`and those points can now buy the class identity the pitch implies (${head.bought} signatures)`,
      head.bought === 2);

    // ── A recruit levels on the curve everyone else levels on ─────────────────────
    const curve = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      // Level the standing squad up so par is high enough for the difference to show.
      // Stepped, not a closed form: awardXp floors xpToNext at every level, so 100 * 1.35^8 is
      // ten XP above what a squad that actually levelled there is carrying.
      const stepped = (mult, levels) => { let n = 100; for (let i = 0; i < levels; i++) n = Math.floor(n * mult); return n; };
      playerRoster.forEach(c => { c.level = 9; c.xpToNext = stepped(XP_CURVE, 8); });
      // pendingRecruit is { id, cost, taken } - signOnRecruit looks the template up by id and
      // returns early on anything else, which is quiet enough to make a test pass on the wrong
      // operator entirely.
      const tpl = RECRUIT_POOL.find(t => !playerRoster.some(c => c.id === t.id));
      pendingRecruit = { id: tpl.id, cost: 0, taken: false };
      scrap = 1000;
      const before = playerRoster.length;
      const par = Math.max(1, Math.round(playerRoster.reduce((a, c) => a + c.level, 0) / playerRoster.length));
      signOnRecruit();
      const rec = playerRoster.find(c => c.id === tpl.id);
      if (!rec || playerRoster.length !== before + 1) return { signed: false };
      const onCurve = stepped(XP_CURVE, rec.level - 1);
      const onOld = stepped(1.5, rec.level - 1);
      // And what those levels are worth: the points, and what they can be turned into.
      scrap = 5000; currentSector = 1;
      let bought = 0;
      for (let g = 0; g < 8 && rec.perkPoints > 0 && unheldSigsFor(rec).length; g++) {
        const want = unheldSigsFor(rec)[0]; const had = rec.perkPoints;
        assignPerk(rec.id, want.id);
        if (hasTrait(rec, want.id)) bought++;
        if (rec.perkPoints === had) break;
      }
      return { signed: true, par, level: rec.level, xpToNext: rec.xpToNext, onCurve, onOld,
               points: rec.perkPoints + bought, bought, squad: playerRoster[0].xpToNext };
    });
    ok('the recruit actually signed on, which is the whole basis of what follows', curve.signed === true);
    ok(`and arrives levelled to the squad it joins (par ${curve.par}, level ${curve.level})`,
      curve.level === curve.par && curve.level > 1);
    ok(`and on the same curve, not the one XP_CURVE replaced (${curve.xpToNext} against the old ${curve.onOld})`,
      Math.abs(curve.xpToNext - curve.onCurve) <= 2 && curve.xpToNext < curve.onOld * 0.6);
    ok(`so it asks what the squad beside it asks (${curve.xpToNext} against ${curve.squad})`,
      Math.abs(curve.xpToNext - curve.squad) <= 2);
    ok(`it banks a point for every level it was brought up (${curve.points} for ${curve.level - 1})`,
      curve.points === curve.level - 1);
    ok(`and those points buy it a class, which is the point of the phase (${curve.bought} signatures)`,
      curve.bought === 2);
  }
};

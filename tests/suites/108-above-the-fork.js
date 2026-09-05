// E07 capped an operator at two signatures, one from each fork, which is what made the two
// promotions that pick them real decisions rather than an ordering. It also meant an operator
// ran out of anything verb-shaped to buy very early. Measured over 60 expeditions on the build
// before this: 37.5 level-ups a run, of which 9.7 reach a promotion screen and 27.9 bank
// silently - 74.2% of all levelling with nothing but a flat stat card behind it. Both forks
// close at mean level 6.55 and operators finish a run at level 12-14, so most of an operator's
// career was levelling into nothing. FOURTH_ABILITIES does not fill that: it is gated on
// lifetime class mastery, not on this operator's level.
//
// One capstone per class, above the forks. Every one is the same shape - a move the class
// already has does a second thing - so each is driven here at the call site it is wired to,
// with and without, rather than asserted against the table that declares it.
module.exports = {
  name: 'Above the fork',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── the table ────────────────────────────────────────────────────────────────────
    const table = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const clean = validateCapstones();
      // A validator that returns nothing is indistinguishable from one that always returns
      // nothing, so it is shown a broken table and has to say so. Restored either way.
      const held = CAPSTONES.BRUISER;
      CAPSTONES.BRUISER = { id: 'CAP_BREAKER', name: '', desc: '' };
      const caughtBlank = validateCapstones().length;
      CAPSTONES.BRUISER = { id: 'AFTERSHOCK', name: 'x', desc: 'x'.repeat(30) };
      const caughtCollision = validateCapstones().some(b => /collides/.test(b));
      delete CAPSTONES.BRUISER;
      const caughtMissing = validateCapstones().some(b => /BRUISER/.test(b));
      CAPSTONES.BRUISER = held;
      return { problems: clean, classes: Object.keys(ABILITIES).length,
               caps: Object.keys(CAPSTONES).length,
               described: Object.values(CAPSTONES).every(c => c.name && c.desc && c.desc.length > 20),
               caughtBlank, caughtCollision, caughtMissing, restored: validateCapstones().length };
    });
    ok(`every class has a capstone and nothing is malformed (${table.problems.join('; ') || 'clean'})`,
      table.problems.length === 0 && table.caps === table.classes && table.described);
    ok('and the validator has teeth: a blank one, a colliding id and a missing class are all reported',
      table.caughtBlank > 0 && table.caughtCollision && table.caughtMissing && table.restored === 0);

    // ── the gate ─────────────────────────────────────────────────────────────────────
    const gate = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'BRUISER');
      const shut = () => { c.traits = forksFor(c).map(g => g[0].id); };
      const out = {};
      c.traits = []; c.level = 20; out.forksOpen = capstoneOpen(c);
      c.traits = [forksFor(c)[0][0].id]; out.oneFork = capstoneOpen(c);
      shut(); c.level = 9; out.below = capstoneOpen(c);
      c.level = 10; out.at = capstoneOpen(c);
      c.traits.push(capstoneFor(c).id); out.taken = capstoneOpen(c);
      return out;
    });
    ok('a capstone is not open while either fork is', !gate.forksOpen && !gate.oneFork);
    // Nine and ten written out rather than read off CAPSTONE_LEVEL: a test that builds its own
    // boundary from the constant agrees with whatever the constant becomes. Moving the gate is
    // a design decision and is meant to land here, which is how the move from eight was caught.
    ok(`nor at level nine with both shut (${gate.below})`, gate.below === false);
    ok('it opens at ten with both shut', gate.at === true);
    ok('and shuts again once taken', gate.taken === false);

    // ── the level-up that used to bank silently ──────────────────────────────────────
    const promo = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'BRUISER');
      c.traits = forksFor(c).map(g => g[0].id);
      c.level = 9; c.xp = 0; c.xpToNext = 10; pendingPerkOffers = [];
      awardXp(c, 10);                       // to 10: the capstone opens on the way
      const first = pendingPerkOffers.length;
      const opts = first ? pendingPerkOffers[0].options.slice() : [];
      const hasCapCard = opts.includes(capstoneFor(c).id);
      const stats = opts.filter(id => PERK_POOL.some(p => p.id === id)).length;
      renderPerkOffer();
      const screen = document.getElementById('perk-choices').innerText;
      const sub = document.getElementById('perk-sub').innerText;
      takePerkOffer(opts.indexOf(capstoneFor(c).id));
      const held = hasTrait(c, capstoneFor(c).id);
      // and the next level up, with nothing left, banks the way it always did
      c.xp = 0; c.xpToNext = 10; pendingPerkOffers = [];
      awardXp(c, 10);
      return { first, hasCapCard, stats, held, quietAfter: pendingPerkOffers.length,
               screen, sub, lvl: c.level };
    });
    ok('the level that opens it stops the run for it', promo.first === 1 && promo.hasCapCard);
    ok(`with the rest of the card a training pick (${promo.stats} stat cards)`, promo.stats === 2);
    ok('the screen says what it is and why it is there',
      /CAPSTONE/.test(promo.screen) && /both forks shut/.test(promo.sub));
    ok('taking it grants it', promo.held);
    ok(`and the level after that banks silently again (level ${promo.lvl})`, promo.quietAfter === 0);

    // ── the Outpost door E08 opened ──────────────────────────────────────────────────
    const till = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'MEDIC');
      c.traits = forksFor(c).map(g => g[0].id); c.level = 11; c.perkPoints = 1;
      const listed = buyableFor(c).find(b => b.id === capstoneFor(c).id);
      scrap = capstoneCost() - 1;
      assignPerk(c.id, capstoneFor(c).id);
      const brokeStill = hasTrait(c, capstoneFor(c).id);
      scrap = capstoneCost() + 500;
      const purse = scrap;
      assignPerk(c.id, capstoneFor(c).id);
      return { listed: !!listed, cost: listed ? listed.cost : 0, price: capstoneCost(),
               brokeStill, held: hasTrait(c, capstoneFor(c).id), paid: purse - scrap,
               points: c.perkPoints };
    });
    ok(`the Outpost lists it at its own price (${till.cost})`, till.listed && till.cost === till.price);
    ok('a purse that cannot cover it buys nothing', till.brokeStill === false);
    ok('and one that can pays and spends the point',
      till.held && till.paid === till.price && till.points === 0);

    // ── the ten hooks, each driven with and without ──────────────────────────────────
    const fight = await page.evaluate(() => {
      const out = {};
      const set = (cls, capOn, at = 1, armour = 0) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentWeather = 'CLEAR'; bonds = {};
        initiateCombat('RAIDERS', false);
        const c = playerRoster.find(p => p.gridPos > 0);
        c.classType = cls; c.quirk = null; c.trinket = null; c.weaponMod = null;
        c.traits = capOn ? [CAPSTONES[cls].id] : [];
        c.gridPos = at; c.hp = c.maxHp;
        // A field with room behind the target, so "the one behind" exists.
        while (activeEntities.filter(e => !e.isPlayer).length < 3) {
          const f = activeEntities.find(e => !e.isPlayer);
          const clone = JSON.parse(JSON.stringify(f));
          clone.id = 'x' + activeEntities.length; activeEntities.push(clone); turnQueue.push(clone);
        }
        const foes = activeEntities.filter(e => !e.isPlayer);
        // Armour off by default: three of these read a damage ratio, and flat armour subtracted
        // after every multiplier flattens a halved hit to the floor of 1 and hides the number.
        foes.forEach(f => { f.hp = 5000; f.maxHp = 5000; f.armor = armour; f.resistances = { phys: 0, bio: 0, energy: 0 }; });
        activeIndex = turnQueue.indexOf(c);
        return { c, foes };
      };
      const swing = (c, move, target) => { pendingAction = move; activeIndex = turnQueue.indexOf(c); resolveAction(target.id); };
      // Damage carries a base roll, so a single swing cannot pin a ratio. The two checks that
      // read one take forty swings an arm and compare the totals. Both moves are cooldown-free
      // basics, and the targets have the health to stand there for it.
      const swingN = (c, move, target, n = 40) => {
        const before = target.hp; for (let i = 0; i < n; i++) swing(c, move, target); return before - target.hp;
      };
      // Paired on ONE field. Two set() calls are two different fights - different draw,
      // different ground, different sky, different rolls - and comparing across them measured
      // the wasteland rather than the capstone. Same operator, same foes, trait toggled between.
      const paired = (cls, move, at, n = 40) => {
        const f = set(cls, false, at);
        const plain = swingN(f.c, move, f.foes[0], n);
        const spill0 = f.foes.slice(1).map(e => 5000 - e.hp);
        f.foes.forEach(e => { e.hp = 5000; });
        f.c.traits = [CAPSTONES[cls].id];
        const capped = swingN(f.c, move, f.foes[0], n);
        return { plain, capped, spillPlain: spill0, spillCapped: f.foes.slice(1).map(e => 5000 - e.hp) };
      };

      // BRUISER · Breaker — armour off the wrench
      let s = set('BRUISER', true, 1, 20);  swing(s.c, 'HEAVY_WRENCH', s.foes[0]); const capArm = s.foes[0].armor;
      s = set('BRUISER', false, 1, 20);     swing(s.c, 'HEAVY_WRENCH', s.foes[0]); out.breaker = [capArm, s.foes[0].armor];

      // MEDIC · Whole Line — the rest of the line patched
      s = set('MEDIC', true);
      activeEntities.filter(e => e.isPlayer).forEach(a => { a.hp = 10; });
      const mate = activeEntities.filter(e => e.isPlayer && e.id !== s.c.id)[0];
      pendingAction = 'CAUTERIZE'; activeIndex = turnQueue.indexOf(s.c); resolveAction(s.c.id);
      const capMate = mate ? mate.hp : 0;
      s = set('MEDIC', false);
      activeEntities.filter(e => e.isPlayer).forEach(a => { a.hp = 10; });
      const mate2 = activeEntities.filter(e => e.isPlayer && e.id !== s.c.id)[0];
      pendingAction = 'CAUTERIZE'; activeIndex = turnQueue.indexOf(s.c); resolveAction(s.c.id);
      out.wholeLine = [capMate, mate2 ? mate2.hp : 0];

      // SCAVENGER · Nail Bomb — a bleed off the flashbang
      s = set('SCAVENGER', true);  swing(s.c, 'FLASHBANG', s.foes[0]); const capBleed = s.foes[0].bleedingTurns || 0;
      s = set('SCAVENGER', false); swing(s.c, 'FLASHBANG', s.foes[0]); out.nailBomb = [capBleed, s.foes[0].bleedingTurns || 0];

      // PYROMANIAC · Flashover — the splash comes up oiled
      s = set('PYROMANIAC', true);  swing(s.c, 'MOLOTOV', s.foes[0]);
      const capOil = s.foes.slice(1).some(f => (f.oiledTurns || 0) > 0);
      s = set('PYROMANIAC', false); swing(s.c, 'MOLOTOV', s.foes[0]);
      out.flashover = [capOil, s.foes.slice(1).some(f => (f.oiledTurns || 0) > 0)];

      // SHOTGUNNER · Punch Through — the one behind takes it too
      const pt = paired('SHOTGUNNER', 'SLUG_SHOT', 1);
      out.punchThrough = [pt.spillCapped[0], pt.spillPlain[0], pt.capped];

      // SNIPER · Range Card — two on the card
      s = set('SNIPER', true);  swing(s.c, 'SPOTTERS_MARK', s.foes[0]); const capMark = s.foes[1].markedTurns || 0;
      s = set('SNIPER', false); swing(s.c, 'SPOTTERS_MARK', s.foes[0]); out.rangeCard = [capMark, s.foes[1].markedTurns || 0];

      // HOUND · Blood Scent — the bleed reaches behind
      s = set('HOUND', true);  swing(s.c, 'FERAL_BITE', s.foes[0]); const capScent = s.foes[1].bleedingTurns || 0;
      s = set('HOUND', false); swing(s.c, 'FERAL_BITE', s.foes[0]); out.bloodScent = [capScent, s.foes[1].bleedingTurns || 0];

      // TRENCH FIEND · Entrenched — twice, and only from the front
      const enFront = paired('TRENCH_FIEND', 'BAYONET_THRUST', 1);
      const enBack = paired('TRENCH_FIEND', 'BAYONET_THRUST', 3);
      out.entrenched = [enFront.capped, enBack.capped, enFront.plain, enBack.plain];

      // HAZMAT · Dead Man's Switch — the tanks let go on the way down
      s = set('HAZMAT', true);  s.c.hp = 0; goDown(s.c); const capVent = 5000 - s.foes[0].hp;
      s = set('HAZMAT', false); s.c.hp = 0; goDown(s.c); out.deadMan = [capVent, 5000 - s.foes[0].hp];

      // HARPOONER · Set The Hook — the basic walks them in
      s = set('HARPOONER', true);
      const before = activeEntities.filter(e => !e.isPlayer).indexOf(s.foes[2]);
      swing(s.c, 'HARPOON', s.foes[2]);
      const capPos = activeEntities.filter(e => !e.isPlayer).indexOf(s.foes[2]);
      s = set('HARPOONER', false);
      const before2 = activeEntities.filter(e => !e.isPlayer).indexOf(s.foes[2]);
      swing(s.c, 'HARPOON', s.foes[2]);
      out.setHook = [before, capPos, before2, activeEntities.filter(e => !e.isPlayer).indexOf(s.foes[2])];

      combatActive = false;
      return out;
    });
    const pair = (r, label) => `${label}: ${r[0]} with, ${r[1]} without`;
    ok(pair(fight.breaker, 'BREAKER caves the plate in'), fight.breaker[0] === fight.breaker[1] - 8);
    ok(pair(fight.wholeLine, 'WHOLE LINE patches the rest of the line'), fight.wholeLine[0] > fight.wholeLine[1]);
    ok(pair(fight.nailBomb, 'NAIL BOMB opens a bleed off the flashbang'),
      fight.nailBomb[0] === 2 && fight.nailBomb[1] === 0);
    ok(pair(fight.flashover, "FLASHOVER oils the molotov's second"),
      fight.flashover[0] === true && fight.flashover[1] === false);
    ok(`PUNCH THROUGH carries half into the one behind (${fight.punchThrough[0]} behind against ${fight.punchThrough[2]} in front, and ${fight.punchThrough[1]} without it)`,
      fight.punchThrough[1] === 0 && fight.punchThrough[0] > 0
      && Math.abs(fight.punchThrough[0] / fight.punchThrough[2] - 0.5) < 0.12);
    ok(pair(fight.rangeCard, 'RANGE CARD puts two on the card'),
      fight.rangeCard[0] > 0 && fight.rangeCard[1] === 0);
    ok(pair(fight.bloodScent, 'BLOOD SCENT reaches the one behind'),
      fight.bloodScent[0] === 3 && fight.bloodScent[1] === 0);
    ok(`ENTRENCHED doubles the thrust from the front (${fight.entrenched[0]} against ${fight.entrenched[2]}) and changes nothing from the back (${fight.entrenched[1]} against ${fight.entrenched[3]})`,
      Math.abs(fight.entrenched[0] / fight.entrenched[2] - 2) < 0.25
      && Math.abs(fight.entrenched[1] / fight.entrenched[3] - 1) < 0.25);
    ok(pair(fight.deadMan, "DEAD MAN'S SWITCH vents on the way down"),
      fight.deadMan[0] > 0 && fight.deadMan[1] === 0);
    ok(`SET THE HOOK walks them in (rank ${fight.setHook[0]} to ${fight.setHook[1]}, against ${fight.setHook[2]} to ${fight.setHook[3]} without)`,
      fight.setHook[1] < fight.setHook[0] && fight.setHook[3] === fight.setHook[2]);

    // ── the surfaces ─────────────────────────────────────────────────────────────────
    const shown = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const c = playerRoster.find(p => p.classType === 'SNIPER');
      c.traits = forksFor(c).map(g => g[0].id); c.level = 11;
      const open = traitSummary(c);
      c.traits.push(capstoneFor(c).id);
      const held = traitSummary(c);
      renderCodex();
      const manual = document.getElementById('codex-body').innerText;
      return { open, held,
               everyCapInManual: Object.values(CAPSTONES).filter(cap => !manual.includes(cap.desc)).map(cap => cap.name),
               saysGate: /Above the forks, at level \d+ with both of them shut/.test(manual) };
    });
    ok(`an open capstone is named on the card (${shown.open.split('·').pop().trim()})`,
      /capstone open: Range Card/.test(shown.open));
    ok('and a held one says so instead', /capstone: Range Card/.test(shown.held) && !/open/.test(shown.held));
    ok(`the manual carries all ten (${shown.everyCapInManual.join(', ') || 'clean'})`,
      shown.everyCapInManual.length === 0 && shown.saysGate);
  }
};

// DAMAGING_MOVES decides three things: whether a swing cashes a Spotter's Mark, whether the deck
// button promises that it will, and whether a Hound's LEAD_THE_PACK builds momentum off it. It
// was a hand-kept list of 26 while the deck holds 40 moves.
//
// Fourteen were absent. Four correctly - IRON_GUARD, CAUTERIZE, OVER_THE_TOP and PURGE_VALVE are
// self-actions and heals that never reach mitigate. Ten by omission: every FOURTH_ABILITIES entry
// was added to its class's deck and to nothing else. Nine of those ten deal damage (STIM_DART is
// an ally move), so a rank-III operator could spend a turn marking a target, strike it with the
// verb their whole dossier was climbing toward, and spend the mark for nothing - with no MARKED
// tag on the button to say otherwise, and no momentum for the hound.
//
// Derived now, from the same two tables the deck is built from. Still a list rather than a
// predicate at the call sites, and this suite guards that: pendingAction also carries 'OVERDRIVE'
// and the consumable ids, and an open-world dealsDamage() answers true for those.
module.exports = {
  name: 'The fourth ability cashes',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── the list, and what it is derived from ────────────────────────────────────────
    const list = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const declared = [...Object.values(ABILITIES).flat(), ...Object.values(FOURTH_ABILITIES)].map(a => a.move);
      // The hand-kept 26 as it stood, written out: the change must be additive, and the only way
      // to know nothing was dropped on the way to deriving it is to hold the old list up.
      const was = ['SCRAP_BLADE','HEAVY_WRENCH','PISTOL','RAD_SHOT','PIPE_RIFLE','FLASHBANG','FLARE_GUN',
        'MOLOTOV','SLUG_SHOT','BUCKSHOT','QUICK_SHOT','DEADEYE','SNAP','FERAL_BITE',
        'ACID_FLASK','THERMITE','EXECUTE_SHOT','SPOTTERS_MARK','RIP_AND_TEAR',
        'BAYONET_THRUST','RIPSAW','SPRAY_GUN','CAUSTIC_BURST','HARPOON','DRAG_LINE','BARBED_SHOT'];
      const fourths = Object.values(FOURTH_ABILITIES).map(a => a.move);
      return {
        n: DAMAGING_MOVES.length, declared: declared.length,
        dropped: was.filter(m => !DAMAGING_MOVES.includes(m)),
        gained: DAMAGING_MOVES.filter(m => !was.includes(m)),
        notDeclared: DAMAGING_MOVES.filter(m => !declared.includes(m)),
        agreesWithPredicate: declared.filter(dealsDamage).every(m => DAMAGING_MOVES.includes(m))
                          && DAMAGING_MOVES.every(m => dealsDamage(m)),
        fourthsIn: fourths.filter(m => DAMAGING_MOVES.includes(m)),
        fourthsOut: fourths.filter(m => !DAMAGING_MOVES.includes(m)),
        selfIn: ['IRON_GUARD','CAUTERIZE','OVER_THE_TOP','PURGE_VALVE'].filter(m => DAMAGING_MOVES.includes(m)),
        // The trap: these are things pendingAction really holds, and none is a declared move.
        openWorld: ['OVERDRIVE','ITEM_MED','ITEM_ADRENALINE','MED_STIM','SCRAP_BOMB','EMP_CHARGE']
          .map(m => ({ m, listed: DAMAGING_MOVES.includes(m), predicate: dealsDamage(m) })),
        comboOnAFourth: COMBOS.filter(c => fourths.includes(c.move)).map(c => c.move)
      };
    });
    ok(`the list is derived from the declarations (${list.n} of ${list.declared} moves)`,
      list.agreesWithPredicate && list.notDeclared.length === 0);
    ok(`nothing that cashed a mark before stopped (${list.dropped.join(', ') || 'nothing dropped'})`,
      list.dropped.length === 0);
    ok(`and the nine that gained it are the damaging fourth abilities (${list.gained.length}: ${list.gained.join(', ')})`,
      list.gained.length === 9 && list.gained.every(m => list.fourthsIn.includes(m)));
    ok(`the one fourth ability left out is the ally move (${list.fourthsOut.join(', ')})`,
      list.fourthsOut.length === 1 && list.fourthsOut[0] === 'STIM_DART');
    ok(`self-actions and heals stay out (${list.selfIn.join(', ') || 'all four out'})`, list.selfIn.length === 0);
    // Why this is a list and not a call to dealsDamage at the three sites.
    ok(`an overdrive and the consumables are still out, though the open predicate calls them damaging (${list.openWorld.filter(o => o.predicate).length} of ${list.openWorld.length})`,
      list.openWorld.every(o => !o.listed) && list.openWorld.every(o => o.predicate));
    ok('and no fourth ability has a named combo that would reach the target first',
      list.comboOnAFourth.length === 0);

    // ── driven: the mark is spent, or it is not ─────────────────────────────────────
    const field = () => page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentWeather = 'CLEAR'; bonds = {};
      initiateCombat('RAIDERS', false);
      const c = playerRoster.find(p => p.gridPos > 0);
      c.quirk = null; c.trinket = null; c.weaponMod = null; c.traits = [];
      const foes = activeEntities.filter(e => !e.isPlayer);
      foes.forEach(f => { f.hp = 99999; f.maxHp = 99999; f.armor = 0; f.resistances = { phys: 0, bio: 0, energy: 0 }; });
      activeIndex = turnQueue.indexOf(c);
      return true;
    });

    const cash = await field().then(() => page.evaluate(() => {
      const c = playerRoster.find(p => p.gridPos > 0);
      const foe = activeEntities.find(e => !e.isPlayer);
      const strike = move => {
        foe.markedTurns = 3;
        pendingAction = move; activeIndex = turnQueue.indexOf(c);
        resolveAction(foe.id);
        return foe.markedTurns;
      };
      const out = {};
      // A mastered verb from a class that has one, an ordinary move, and the ally verb.
      out.harry = strike('HARRY');
      out.sweep = strike('TRENCH_SWEEP');
      out.volley = strike('PIERCING_VOLLEY');
      out.snap = strike('SNAP');
      // STIM_DART is aimed at the line, so it never reaches an enemy at all.
      foe.markedTurns = 3;
      pendingAction = 'STIM_DART'; activeIndex = turnQueue.indexOf(c);
      resolveAction(c.id);
      out.stimDart = foe.markedTurns;
      combatActive = false;
      return out;
    }));
    ok(`a mastered verb spends the mark it was aimed at (HARRY leaves ${cash.harry})`, cash.harry === 0);
    ok(`and so do the others (SWEEP ${cash.sweep}, VOLLEY ${cash.volley})`,
      cash.sweep === 0 && cash.volley === 0);
    ok(`an ordinary move always did (SNAP leaves ${cash.snap})`, cash.snap === 0);
    ok(`the ally verb spends nothing, because it never reaches them (${cash.stimDart} left)`,
      cash.stimDart === 3);

    // ── driven: and it is worth the mark's multiplier ────────────────────────────────
    const worth = await field().then(() => page.evaluate(() => {
      const c = playerRoster.find(p => p.gridPos > 0);
      const foe = activeEntities.find(e => !e.isPlayer);
      // Paired on one field, forty swings an arm: damage carries a base roll and one swing
      // cannot pin a multiplier.
      const run = (marked, n = 40) => {
        const before = foe.hp;
        for (let i = 0; i < n; i++) {
          foe.markedTurns = marked ? 3 : 0;
          pendingAction = 'HARRY'; activeIndex = turnQueue.indexOf(c);
          resolveAction(foe.id);
        }
        return before - foe.hp;
      };
      const plain = run(false), cashed = run(true);
      combatActive = false;
      return { plain, cashed };
    }));
    // 1.5 written out rather than read off MARK_BONUS: a test that builds its expectation from
    // the constant agrees with whatever the constant becomes, and the mark's worth is a design
    // number that should not move quietly.
    ok(`the cashed mark is worth the mark's multiplier (${worth.cashed} against ${worth.plain}, x${(worth.cashed / worth.plain).toFixed(2)})`,
      Math.abs(worth.cashed / worth.plain - 1.5) < 0.15);

    // ── driven: the button says so before it is pressed ──────────────────────────────
    const deck = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      // Rank III, so the fourth verb is actually in the deck to be rendered.
      noteMastery('HOUND', MASTERY_RANKS[3] + 100);
      initiateCombat('RAIDERS', false);
      const c = playerRoster.find(p => p.gridPos > 0);
      c.classType = 'HOUND'; c.benchedMove = 'SNAP';
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.markedTurns = 3;
      activeIndex = turnQueue.indexOf(c);
      renderCommandDeck();
      // The promise is painted on the target once a verb is queued, not on the deck button - so
      // it is read where a player would see it: queue the mastered verb, then look at the enemy
      // the mark is on.
      const paint = move => { queueAction(move); renderField(); return document.getElementById(foe.id).innerText; };
      // The closed list earns its keep here rather than at the resolver: resolveAction handles an
      // overdrive in its own branch and never reaches the mark, but comboHint is called with
      // whatever pendingAction holds while the player is still choosing a target - so an
      // open-world predicate would paint a promise on a marked enemy that the overdrive cannot
      // keep. Driven, because that is the only place the difference is visible.
      const overdrive = { hint: comboHint('OVERDRIVE', foe), painted: paint('OVERDRIVE') };
      const out = { rank: masteryRank('HOUND'), inDeck: deckFor(c).some(a => a.move === 'HARRY'),
                    hint: comboHint('HARRY', foe), hintOrdinary: comboHint('SNAP', foe),
                    hintAlly: comboHint('STIM_DART', foe),
                    onTargetMastered: paint('HARRY'), onTargetOrdinary: paint('SNAP'),
                    overdriveHint: overdrive.hint, overdrivePainted: overdrive.painted };
      foe.markedTurns = 0;
      out.onTargetUnmarked = paint('HARRY');
      pendingAction = null;
      combatActive = false;
      return out;
    });
    ok(`a rank III hound brings the verb (rank ${deck.rank})`, deck.rank === 3 && deck.inDeck);
    ok(`and the deck promises the mark on it (${deck.hint})`, deck.hint === 'MARKED');
    ok(`as it always did on an ordinary move (${deck.hintOrdinary})`, deck.hintOrdinary === 'MARKED');
    ok(`and never on the ally verb (${deck.hintAlly})`, deck.hintAlly === null);
    ok('the target is painted with the promise once the mastered verb is queued',
      /MARKED/.test(deck.onTargetMastered));
    ok('as it is for an ordinary one', /MARKED/.test(deck.onTargetOrdinary));
    ok('and not when there is no mark to cash', !/MARKED/.test(deck.onTargetUnmarked));
    ok(`an overdrive promises nothing, because it resolves before the mark is ever read (${deck.overdriveHint})`,
      deck.overdriveHint === null && !/MARKED/.test(deck.overdrivePainted));

    // ── which three of four a rank III operator brings ───────────────────────────────
    // E12c: the harness now makes this choice, so the engine contract it relies on is pinned
    // here. buildNewRun benches the FOURTH by default and the muster is where that is changed;
    // before E12c nothing in the harness ever changed it, and all ten mastered abilities sat
    // out of every measurement this repo had taken.
    const bench = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const out = { byDefault: [], brought: [], stale: null, belowRank: null };
      Object.keys(ABILITIES).forEach(cls => {
        const c = { classType: cls, benchedMove: FOURTH_ABILITIES[cls].move };
        noteMastery(cls, MASTERY_RANKS[3] + 100);
        // the default the run starts with
        out.byDefault.push({ cls, has: deckFor(c).some(a => a.move === FOURTH_ABILITIES[cls].move),
                             n: deckFor(c).length });
        // and the muster's other answer: bench the free basic instead
        const basic = ABILITIES[cls].find(a => !a.cd && a.reach !== 'self');
        const b = { classType: cls, benchedMove: basic ? basic.move : null };
        const deck = deckFor(b);
        out.brought.push({ cls, has: deck.some(a => a.move === FOURTH_ABILITIES[cls].move),
                           dropped: basic ? !deck.some(a => a.move === basic.move) : null,
                           n: deck.length });
      });
      // a bench naming a move this class does not have falls back to benching the fourth
      const stale = { classType: 'BRUISER', benchedMove: 'WHALE_LINE' };
      out.stale = deckFor(stale).some(a => a.move === 'SHIELD_SLAM');
      // and below rank III there is no fourth to bench at all
      mastery = {}; saveMeta();
      out.belowRank = deckFor({ classType: 'BRUISER', benchedMove: 'SCRAP_BLADE' })
        .map(a => a.move).join(',');
      return out;
    });
    ok(`every class brings three verbs by default, and the fourth is the one benched (${bench.byDefault.filter(d => d.has).map(d => d.cls).join(', ') || 'none brought'})`,
      bench.byDefault.every(d => !d.has && d.n === 3));
    ok(`benching the free basic brings all ten instead (${bench.brought.filter(b => !b.has).map(b => b.cls).join(', ') || 'all ten'})`,
      bench.brought.every(b => b.has && b.dropped && b.n === 3));
    ok('a bench naming a move the class does not have falls back to benching the fourth', bench.stale === false);
    ok(`below rank III the deck is the base three whatever the muster said (${bench.belowRank})`,
      bench.belowRank.split(',').length === 3 && !/SHIELD_SLAM/.test(bench.belowRank));

    // ── driven: and the hound's momentum builds off it ───────────────────────────────
    const pack = await field().then(() => page.evaluate(() => {
      const c = playerRoster.find(p => p.gridPos > 0);
      const foe = activeEntities.find(e => !e.isPlayer);
      c.traits = ['LEAD_THE_PACK'];
      const gain = move => {
        momentum = 0; addMomentum(0); foe.markedTurns = 0;
        pendingAction = move; activeIndex = turnQueue.indexOf(c);
        resolveAction(foe.id);
        return momentum;
      };
      const harry = gain('HARRY');
      const snap = gain('SNAP');
      c.traits = [];
      const none = gain('HARRY');
      combatActive = false;
      return { harry, snap, none };
    }));
    ok(`LEAD THE PACK builds momentum off a mastered verb (${pack.harry})`, pack.harry > 0);
    ok(`as it always did off an ordinary one (${pack.snap})`, pack.snap > 0);
    ok(`and nothing without the trait (${pack.none})`, pack.none === 0);
  }
};

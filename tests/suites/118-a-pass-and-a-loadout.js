// F10. Two things a rank III squad had no control over.
//
// THE LOCKED TURN. The deck had no hold or pass, so an operator whose abilities were all
// cooling had nothing on it that resolved the turn - only WITHDRAW and RETREAT, which are ways
// out of the fight rather than ways through it. That is reachable in the shipped game rather
// than only in the harness: the muster's own loadout chip lets a rank III operator bench their
// only cooldown-free move, and after that a run of cooldowns leaves an empty deck.
//
// One number worth correcting on the way past. The audit filed this as "0.63% of player turns
// are lost outright", which is the simulator's figure and the simulator's own note says what
// it is: that file benches the free BASIC as a policy, so the 0.63% is the cost of the policy
// rather than a property of the game. The gap is real either way - a player can choose the same
// bench, and the game then offers them nothing - but the frequency is not measured here and
// this suite does not repeat the number as if it were.
//
// HOLD is priced to be the worst thing on the deck. A plain swing that does not kill grants NO
// momentum in this game - the bar fills off kills, combos and blows taken - so a pass paying
// five momentum, which is what the audit suggested, would have been the cheapest overdrive
// charge available and worth pressing on purpose. Armour cannot be farmed the same way: set
// rather than added, expiring on the operator's next turn, a third of the Bruiser's own brace.
//
// THE LOADOUT NOBODY COULD REACH. Which three of four a rank III operator brings is chosen on
// exactly one screen, the muster - which a recruit signed at a node three sectors in never
// passes through, and which a class that reaches rank III mid-run is long past. Both now carry
// the same control the muster has, drawn from one helper rather than a second copy of it.
module.exports = {
  name: 'A pass, and a loadout for the recruit',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__rankIII = cls => noteMastery(cls, (MASTERY_RANKS[2] || 3000) * 4);
      // An operator alone on the field with every cooldown running - which is the state the
      // deck used to have no answer for.
      window.__locked = (benchBasic) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        window.__rankIII('BRUISER');
        initiateCombat('RAIDERS', false);
        const me = activeEntities.find(e => e.isPlayer);
        me.classType = 'BRUISER';
        const basic = (ABILITIES.BRUISER || []).find(a => !a.cd && a.reach !== 'self');
        if (benchBasic) me.benchedMove = basic.move;
        activeEntities = activeEntities.filter(e => !e.isPlayer || e.id === me.id);
        deckFor(me).forEach(a => { if (a.cd) me.cooldowns[a.cd] = 3; });
        momentum = 0; inventory = [];
        turnQueue = [me]; activeIndex = 0; pendingAction = null;
        renderField();
        return { me, basic: basic.move };
      };
      window.__deck = () => {
        const d = document.getElementById('command-deck');
        const live = [...d.querySelectorAll('button')].filter(b => !b.disabled);
        return { live: live.map(b => b.dataset.move || b.dataset.action),
                 resolvers: live.filter(b => ['queue', 'self', 'bag', 'tactic'].includes(b.dataset.action))
                                .map(b => b.dataset.move || b.dataset.action) };
      };
    });

    // ── The deck always has something that resolves the turn ────────────────────────
    const lock = await page.evaluate(() => {
      const { me, basic } = window.__locked(true);
      const deck = deckFor(me).map(a => a.move);
      const seen = window.__deck();
      return { basic, deck, resolvers: seen.resolvers, live: seen.live,
               benchedIsBasic: benchedFor(me) === basic };
    });
    ok(`a rank III operator can still bench their only free move (${lock.basic})`,
      lock.benchedIsBasic && lock.deck.indexOf(lock.basic) === -1);
    ok(`and with every cooldown running the deck still resolves the turn (${lock.resolvers.join(', ')})`,
      lock.resolvers.length > 0 && lock.resolvers.indexOf('HOLD') >= 0);

    // ── It is on every deck, not only a locked one ──────────────────────────────────
    const always = await page.evaluate(() => {
      window.__locked(false);
      const me = turnQueue[0];
      me.cooldowns = {};
      renderField();
      const seen = window.__deck();
      return { resolvers: seen.resolvers, hasHold: seen.resolvers.indexOf('HOLD') >= 0,
               moves: deckFor(me).map(a => a.move) };
    });
    ok(`HOLD is on a deck with everything ready too (${always.resolvers.join(', ')})`, always.hasHold);
    ok('and it is not one of the three abilities, so it costs nobody a slot',
      always.moves.indexOf('HOLD') === -1);

    // ── What holding costs, and what it must not pay ───────────────────────────────
    // The phase asked for "a guard tick or five momentum". Both were tried and both were
    // wrong: momentum on inspection, because a plain swing that does not kill grants none, so
    // a pass that paid it would be the cheapest overdrive charge in the game; the guard on
    // measurement, because three arms of 150 put the win rate at 2.30% without it and 0.78%
    // with it. HOLD spends the turn and buys nothing, and these assertions hold it there.
    const held = await page.evaluate(() => {
      const { me } = window.__locked(true);
      me.baseArmor = 4; me.armor = 4; me.armorTurns = 0;
      const before = { momentum, hp: me.hp, armor: me.armor, turns: me.armorTurns,
                       cds: JSON.stringify(me.cooldowns) };
      const logBefore = window.__logText ? window.__logText() : document.getElementById('log').innerText;
      executeSelfAction('HOLD');
      const after = { momentum, hp: me.hp, armor: me.armor, turns: me.armorTurns,
                      cds: JSON.stringify(me.cooldowns) };
      const said = document.getElementById('log').innerText.slice(logBefore.length);
      // Holding twice running is still just two spent turns.
      executeSelfAction('HOLD');
      const twice = { armor: me.armor, momentum, hp: me.hp };
      return { before, after, twice, said: /holds the line/.test(said) };
    });
    ok(`holding pays no momentum, which a pass must not (${held.before.momentum} -> ${held.after.momentum})`,
      held.after.momentum === held.before.momentum);
    ok(`nor any armour, which measured as costing runs (${held.before.armor} -> ${held.after.armor})`,
      held.after.armor === held.before.armor && held.after.turns === held.before.turns);
    ok(`nor health, nor a cooldown (${held.after.hp} hp)`,
      held.after.hp === held.before.hp && held.after.cds === held.before.cds);
    ok('and holding twice running is still just two spent turns',
      held.twice.armor === held.before.armor && held.twice.momentum === held.before.momentum);
    ok('but it says so in the log, so a spent turn is legible', held.said === true);

    // ── The recruit chooses their three of four ─────────────────────────────────────
    const rec = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const tpl = RECRUIT_POOL.find(r => FOURTH_ABILITIES[r.classType]);
      window.__rankIII(tpl.classType);
      scrap = 100000; currentSector = 2; currentNodeId = 'x';
      pendingRecruit = { nodeId: 'x', id: tpl.id, cost: 10, taken: false };
      renderRecruit();
      const chips = [...document.querySelectorAll('[data-action="loadout-bench"]')];
      const fourth = FOURTH_ABILITIES[tpl.classType].move;
      const byDefault = chips.find(c => c.classList.contains('chip-benched'));
      // Bench something else instead - which is the whole point of the control.
      // Guarded: a probe that throws on a missing control tells you the suite broke rather
      // than which promise did.
      const other = chips.find(c => c.dataset.move !== fourth);
      if (other) other.click();
      const afterChips = [...document.querySelectorAll('[data-action="loadout-bench"]')];
      const nowBenched = (afterChips.find(c => c.classList.contains('chip-benched')) || {}).dataset;
      signOnRecruit();
      const ch = playerRoster.find(c => c.id === tpl.id);
      return { chips: chips.length, defaultBenched: byDefault ? byDefault.dataset.move : null,
               fourth, chose: other ? other.dataset.move : null, nowBenched: nowBenched ? nowBenched.move : null,
               carried: ch ? ch.benchedMove : null, deck: ch ? deckFor(ch).map(a => a.move) : [] };
    });
    ok(`the recruit card carries the control (${rec.chips} chips)`, rec.chips === 4);
    ok(`with the fourth sitting out until told otherwise (${rec.defaultBenched})`,
      rec.defaultBenched === rec.fourth);
    ok(`tapping another bench chip moves the choice (${rec.chose})`, rec.nowBenched === rec.chose);
    ok(`signing on carries it onto them (${rec.carried})`, rec.carried === rec.chose);
    ok(`so they bring the fourth after all (${rec.deck.join(', ')})`,
      rec.deck.indexOf(rec.fourth) >= 0 && rec.deck.indexOf(rec.chose) === -1 && rec.deck.length === 3);

    // ── And the Outpost, for a class that reaches rank III mid-run ──────────────────
    const post = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const ch = playerRoster.find(c => FOURTH_ABILITIES[c.classType]);
      window.__rankIII(ch.classType);
      renderOutpost();
      const mine = [...document.querySelectorAll(`[data-action="loadout-bench"][data-id="${ch.id}"]`)];
      const fourth = FOURTH_ABILITIES[ch.classType].move;
      const other = mine.find(c => c.dataset.move !== fourth);
      if (other) other.click();
      const disk = JSON.parse(Store.get(BASE_SAVE_KEY + currentSlot) || 'null') || {};
      const saved = (disk.roster || []).find(c => c.id === ch.id) || {};
      // A class still below rank III has no fourth verb, so it has no control either.
      const low = playerRoster.find(c => masteryRank(c.classType) < 3);
      const lowChips = low ? document.querySelectorAll(`[data-action="loadout-bench"][data-id="${low.id}"]`).length : -1;
      return { chips: mine.length, chose: other ? other.dataset.move : null, benched: ch.benchedMove,
               onDisk: saved.benchedMove || null, deck: deckFor(ch).map(a => a.move),
               fourth, lowChips, screen: document.getElementById('outpost-roster').children.length };
    });
    ok(`the Outpost roster carries it too (${post.chips} chips)`, post.chips === 4);
    ok(`tapping one changes what they bring (${post.deck.join(', ')})`,
      post.benched === post.chose && post.deck.indexOf(post.fourth) >= 0 && post.deck.length === 3);
    ok(`the choice reaches the save rather than living on the screen (${post.onDisk})`,
      post.onDisk === post.chose);
    ok('and the roster is redrawn rather than left stale', post.screen > 0);
    ok(`a class below rank III is offered no control (${post.lowChips} chips)`, post.lowChips === 0);

    // ── One control, one rule ───────────────────────────────────────────────────────
    const shared = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const ch = playerRoster.find(c => FOURTH_ABILITIES[c.classType]);
      window.__rankIII(ch.classType);
      const fourth = FOURTH_ABILITIES[ch.classType].move;
      const out = {};
      // The muster, the Outpost and the recruit card all draw from the same helper, so the
      // three markups agree by construction rather than by three people remembering to.
      out.muster = (loadoutChipsHtml(ch.classType, null, ch.id, 'muster').match(/loadout-chip/g) || []).length;
      out.roster = (loadoutChipsHtml(ch.classType, null, ch.id, 'roster').match(/loadout-chip/g) || []).length;
      out.recruit = (loadoutChipsHtml(ch.classType, null, ch.id, 'recruit').match(/loadout-chip/g) || []).length;
      // And a nonsense bench falls back to the fourth, the same way deckFor always has.
      ch.benchedMove = 'NOT_A_MOVE';
      out.fallback = benchedFor(ch) === fourth;
      out.deck = deckFor(ch).length;
      return out;
    });
    ok(`the three screens draw the same four chips (${shared.muster}/${shared.roster}/${shared.recruit})`,
      shared.muster === 4 && shared.roster === 4 && shared.recruit === 4);
    ok('and a bench naming no real move falls back to the fourth', shared.fallback && shared.deck === 3);
  }
};

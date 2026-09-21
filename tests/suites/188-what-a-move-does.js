// ── U01: WHAT THE MOVE DOES, ON THE MOVE ──────────────────────────────────────────────
//
// E12 found that the one fact deciding whether a swing lands at all was printed on no surface
// in the game, and fixed it by COMPUTING a manual entry per class rather than hand-writing forty
// sentences. G10 then put the gear, and the manual behind it, inside a fight. So the information
// existed and was reachable - three taps deep, on another screen, if you knew which class entry
// to open. It was never on the control.
//
// Measured on a live deck before this: five moves, none carrying any explanation, while the
// three other controls beside them carried two between them. Every other thing in the deck
// already says what it does - tactics through tacticDesc, overdrives and bag items through
// `desc`, WITHDRAW and RETREAT in a sentence each - and the abilities, the thing pressed every
// turn, said only their name and a one-letter type glyph nothing decoded.
//
// WHY A TOGGLE AND NOT A TOOLTIP. F14 settled that one item over: a title does not exist on a
// touch screen, and it moved the overdrive's line into the deck "where the thumb is". Why not
// always-on: at 390 wide the deck is a 188px column and five moves already scroll, so a second
// line on every button every turn pushes half the deck off the screen. It is a VIEW and not a
// mode - a tap still queues the move with the detail showing - so there is no state in which a
// deck button does something other than what it says.
//
// AND MEASURING IT FOUND A BUG. dealsDamage asks `MOVE_REACH[move] !== 'self'`, and MOVE_REACH
// is derived from the ability tables - so a move that is not in them reads back `undefined`,
// which `!== 'self'` answers TRUE for. The deck pushes two moves of its own, declared inline at
// the push site: REPOSITION, which ALLY_MOVES happened to catch, and HOLD, which nothing caught.
// The pass-your-turn button was tagged P, physical damage, on every deck in the game. One of 42.
// It stayed cosmetic because DAMAGING_MOVES is a closed list - and the note beside that list had
// already written the hazard down in as many words. Both are declared in DECK_MOVES now, which
// MOVE_REACH derives from, so the lookups cover every move that can reach a deck.
const { engineUp } = require('../boot');

module.exports = {
  name: 'What a move does',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`); await engineUp(page);

    // ── The two classless moves are declared, not improvised at the push site ────────
    const declared = await page.evaluate(() => ({
      keys: Object.keys(DECK_MOVES).sort(),
      reaches: Object.values(DECK_MOVES).map(m => MOVE_REACH[m.move]),
      holdDeals: dealsDamage('HOLD'),
      repoDeals: dealsDamage('REPOSITION'),
      // The hazard in the general case: every move that can appear on a deck has a row.
      uncovered: [...Object.values(ABILITIES).flat(), ...Object.values(FOURTH_ABILITIES),
                  ...Object.values(DECK_MOVES)].filter(a => !(a.move in MOVE_REACH)).map(a => a.move),
    }));
    ok(`the deck's own moves are declared where the lookups can see them (${declared.keys.join(', ')})`,
      declared.keys.join() === 'HOLD,REPOSITION');
    ok('both read back as self-actions', declared.reaches.join() === 'self,self');
    ok('so the pass button no longer claims to deal damage', declared.holdDeals === false);
    ok('and neither does the reposition', declared.repoDeals === false);
    ok(`no move that can reach a deck is missing a reach (${declared.uncovered.join(', ') || 'none'})`,
      declared.uncovered.length === 0);

    // ── One computation, two callers: the manual's line is this with the label on ────
    const shared = await page.evaluate(() => {
      const all = [...Object.values(ABILITIES).flat(), ...Object.values(FOURTH_ABILITIES)];
      return { total: all.length,
               agree: all.filter(a => moveLine(a) === `${a.label} · ${moveDetail(a)}`).length,
               empty: all.filter(a => !moveDetail(a)).map(a => a.move) };
    });
    ok(`the manual's line is the label plus this detail, for all ${shared.total} moves`,
      shared.agree === shared.total);
    ok(`and no move computes an empty one (${shared.empty.join(', ') || 'none'})`,
      shared.empty.length === 0);

    // ── On a live deck ──────────────────────────────────────────────────────────────
    const stage = () => page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 4; currentNodeId = 'n7';
      initiateCombat('RAIDERS', false);
      activeIndex = turnQueue.findIndex(e => e.isPlayer && e.hp > 0);
      pendingAction = null; renderCommandDeck();
    });
    const readDeck = () => page.evaluate(() => {
      const d = document.getElementById('command-deck');
      const moves = [...d.querySelectorAll('button[data-move]')]
        .filter(b => b.dataset.action === 'queue' || b.dataset.action === 'self');
      return { moves: moves.map(b => ({
                 move: b.dataset.move,
                 title: b.getAttribute('title'),
                 what: (b.querySelector('.move-what') || {}).textContent || null,
                 want: moveDetail([...deckFor(turnQueue[activeIndex]), ...Object.values(DECK_MOVES)]
                        .find(a => a.move === b.dataset.move)),
                 typeTag: !!b.querySelector('.dmg-tag') })),
               toggles: d.querySelectorAll('button[data-action="deck-inspect"]').length };
    });

    await page.evaluate(() => { deckInspect = false; });
    await stage();
    const off = await readDeck();
    ok(`the deck offers one way to ask, and ${off.moves.length} moves to ask about`,
      off.toggles === 1 && off.moves.length >= 3);
    ok('with it off, every move still answers on hover, from the same computation',
      off.moves.every(m => m.title === m.want && m.what === null));
    ok('and the pass button carries no damage glyph',
      off.moves.some(m => m.move === 'HOLD') && !off.moves.find(m => m.move === 'HOLD').typeTag);

    // The toggle is pressed rather than set, so the dispatch entry is what is under test.
    await page.click('button[data-action="deck-inspect"]');
    const on = await readDeck();
    ok('pressing it prints what every move does, on the move',
      on.moves.length === off.moves.length && on.moves.every(m => m.what === m.want));
    ok('and drops the tooltip that would now say the same sentence twice',
      on.moves.every(m => m.title === null));
    ok('the toggle says which way it is set', await page.evaluate(() =>
      document.querySelector('button[data-action="deck-inspect"]').getAttribute('aria-pressed') === 'true'));

    // ── A view, not a mode: the deck still does what it says while explaining itself ─
    const queued = await page.evaluate(() => {
      const before = pendingAction;
      document.querySelector('button[data-move="PIPE_RIFLE"], button[data-action="queue"][data-move]').click();
      return { before, after: pendingAction };
    });
    ok(`a tap still queues the move with the detail showing (${queued.before} -> ${queued.after})`,
      queued.before === null && queued.after !== null);

    // ── And it is sticky, because a player who wanted it once wants it next turn ─────
    await page.evaluate(() => { pendingAction = null; });
    await stage();
    const next = await readDeck();
    ok('a fresh fight still has it on', next.moves.every(m => m.what === m.want));
    await page.click('button[data-action="deck-inspect"]');
    const back = await readDeck();
    ok('and pressing again puts it away', back.moves.every(m => m.what === null && m.title === m.want));
  },
};

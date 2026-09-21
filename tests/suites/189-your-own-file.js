// ── V01: THE FILE ON THE OTHER SIDE OF THE FIELD ──────────────────────────────────────
//
// N02 gave every hostile a tappable file and F11 closed the two holes left in it. The operator
// standing opposite has never had one - and the operator is the one carrying the perks, the
// quirk, the scars, the bonds and the gear that decide what their moves do. Measured on a squad
// three nodes deep, with what the combat screen paints against what the character carries:
//
//   perks    3 of 3 carried, 0 on screen      gear   2 of 2 carried, 0 on screen
//   quirk    3 of 3 carried, 0 on screen      deck   readable for the one whose turn it is
//
// The file is composed from the readers the Outpost's operator card already uses - traitSummary,
// scarsOf, bondLineFor, gearById, resistLine's neighbours - so it is not a second description of
// an operator. It deliberately drops that card's other half, the buy buttons: a fight is not a
// place you spend, and a file you can act from stops being a file.
//
// AND IT FOUND A BUG I SHIPPED ONE ITEM AGO. U01 put what a move does on its button and computed
// the reach from the move's declared row. Reach is a property of a move IN A PAIR OF HANDS: a
// Bayonet turns the Pipe Rifle melee, which is what moveReachFor exists for and what the button's
// own REACH tag already used. So a Scavenger holding one read "ranged" off a line sitting beside
// a tag computed per-operator - two readings of one swing on one control, which is the defect E03
// is named for, in the thing built to end exactly that. moveDetail takes the operator now. The
// manual keeps the declared row, because a class entry has no hands to put a mod in.
//
// AND ONE WORDING WENT WITH IT. The hostile file printed an em-dash for any POSITIVE resistance
// at or under +5 - the badge threshold leaking into the file. A threshold decides what earns a
// mark on a crowded field; a file is the one place the number belongs. Both files read one
// builder now, and the count below is why it was worth doing rather than an aesthetic.
const { engineUp } = require('../boot');

module.exports = {
  name: 'Your own file',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`); await engineUp(page);

    // ── How much of the Archive was one-sided ───────────────────────────────────────
    const band = await page.evaluate(() => {
      const recs = bestiaryRoster();
      let nonZero = 0, hidden = 0;
      recs.forEach(r => ['phys', 'bio', 'energy'].forEach(t => {
        const v = (r.resistances || {})[t] || 0;
        if (v !== 0) nonZero++;
        if (v > 0 && v <= 5) hidden++;          // what the old em-dash swallowed
      }));
      const squad = Object.values(ROSTER_TEMPLATE || {}).length;
      return { recs: recs.length, nonZero, hidden, squad };
    });
    ok(`a positive resistance under the badge threshold is a real population (${band.hidden} of ${band.nonZero} across ${band.recs} hostile files)`,
      band.hidden > 0 && band.nonZero > band.hidden);

    const stage = () => page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      currentSector = 3; currentTier = 5; currentNodeId = 'n9';
      playerRoster.forEach((c, i) => {
        c.traits = c.traits || [];
        PERK_POOL.filter(pk => !pk.cls || pk.cls === c.classType).slice(0, 2).forEach(pk => c.traits.push(pk.id));
        c.quirk = QUIRK_POOL[i % QUIRK_POOL.length];
        c.level = 3 + i;
      });
      // The one pairing the reach fix exists for.
      const scav = playerRoster.find(c => c.classType === 'SCAVENGER');
      if (scav) scav.weaponMod = 'BAYONET';
      initiateCombat('RAIDERS', false);
      activeIndex = turnQueue.findIndex(e => e.isPlayer && e.hp > 0);
      pendingAction = null; inspecting = null; renderField(); renderCommandDeck();
      return { mine: activeEntities.filter(e => e.isPlayer && e.hp > 0).length,
               foes: activeEntities.filter(e => !e.isPlayer && e.hp > 0).length };
    });
    const set = await stage();

    // ── Both sides of the field answer a tap ────────────────────────────────────────
    const taps = await page.evaluate(() => {
      const on = [...document.querySelectorAll('.inspectable')]
        .map(e => (activeEntities.find(a => a.id === e.querySelector('[data-id]')?.dataset.id) || {}));
      const ids = [...document.querySelectorAll('[data-action="inspect"]')].map(e => e.dataset.id);
      const ents = ids.map(id => activeEntities.find(a => a.id === id)).filter(Boolean);
      return { total: ids.length, mine: ents.filter(e => e.isPlayer).length,
               foes: ents.filter(e => !e.isPlayer).length };
    });
    ok(`every body standing opens a file, not just the hostile ones (${taps.mine} squad, ${taps.foes} hostile)`,
      taps.mine === set.mine && taps.foes === set.foes && taps.total === set.mine + set.foes);

    // ── An operator's file is the operator's ────────────────────────────────────────
    const file = await page.evaluate(() => {
      const me = activeEntities.find(e => e.isPlayer && e.classType === 'SCAVENGER' && e.hp > 0)
              || activeEntities.find(e => e.isPlayer && e.hp > 0);
      openDossier(me.id);
      const el = document.getElementById('dossier');
      return { text: el.innerText, shown: el.style.display !== 'none',
               buys: el.querySelectorAll('[data-action^="buy"], [data-action="medbay"], [data-action="perk-menu"], [data-action="scar-menu"]').length,
               perks: traitSummary(me), quirk: me.quirk ? me.quirk.name : '',
               gear: (gearById(me.weaponMod) || {}).name || '',
               deck: deckFor(me).map(a => a.label) };
    });
    ok('tapping your own operator opens a file', file.shown);
    ok(`it carries the perks the field never showed (${file.perks})`,
      !!file.perks && file.text.includes(file.perks));
    ok(`and the quirk (${file.quirk})`, !!file.quirk && file.text.includes(file.quirk));
    ok(`and the gear (${file.gear})`, !!file.gear && file.text.includes(file.gear));
    ok(`and the whole deck, not just the turn's (${file.deck.length} moves)`,
      file.deck.every(l => file.text.includes(l)));
    ok(`it is a file and not a shop - no control on it spends anything (${file.buys})`, file.buys === 0);

    // ── The reach the engine will actually use ──────────────────────────────────────
    const reach = await page.evaluate(() => {
      const me = activeEntities.find(e => e.isPlayer && e.classType === 'SCAVENGER' && e.hp > 0);
      if (!me) return null;
      const pipe = deckFor(me).find(a => a.move === 'PIPE_RIFLE');
      return { engine: moveReachFor('PIPE_RIFLE', me), declared: pipe.reach,
               detail: moveDetail(pipe, me), manual: moveLine(pipe) };
    });
    ok(`a Bayonet makes the Pipe Rifle melee and the line says so (${reach.detail})`,
      reach.engine === 'melee' && reach.declared === 'ranged' && reach.detail.includes('melee'));
    ok(`the manual keeps the declared row, having no hands to put a mod in (${reach.manual})`,
      reach.manual.includes('ranged'));

    // The bug was at the DECK's call site, not in the helper - so read the button that ships.
    // Asserting moveDetail(a, me) alone passes with the deck still calling moveDetail(a), which
    // is exactly how the first cut of this suite let the mutation through.
    const onButton = await page.evaluate(() => {
      const me = activeEntities.find(e => e.isPlayer && e.classType === 'SCAVENGER' && e.hp > 0);
      if (!me) return null;
      closeDossier();
      activeIndex = turnQueue.findIndex(e => e.id === me.id);
      if (activeIndex < 0) { turnQueue.unshift(me); activeIndex = 0; }
      pendingAction = null; deckInspect = true; renderCommandDeck();
      const b = document.querySelector('#command-deck button[data-move="PIPE_RIFLE"]');
      deckInspect = false;
      return b ? (b.querySelector('.move-what') || {}).textContent || '' : null;
    });
    ok(`and the button in the fight says melee too, which is where the defect was (${onButton})`,
      !!onButton && onButton.includes('melee') && !onButton.includes('ranged'));

    // ── A hostile's file is untouched, and both read one resistance row ─────────────
    const both = await page.evaluate(() => {
      const foe = activeEntities.find(e => !e.isPlayer && e.hp > 0);
      openDossier(foe.id);
      const hostile = document.getElementById('dossier').innerText;
      const me = activeEntities.find(e => e.isPlayer && e.hp > 0);
      openDossier(me.id);
      const mine = document.getElementById('dossier').innerText;
      return { hostile, mine, sample: resRowHtml({ phys: 5, bio: 0, energy: -3 }) };
    });
    ok('a hostile still gets its species file', /MET|KILLED|COST YOU/.test(both.hostile));
    ok('and both files carry the same three-axis row',
      ['PHYS', 'BIO', 'ENERGY'].every(t => both.hostile.includes(t) && both.mine.includes(t)));
    ok('a small positive prints its number rather than an em-dash',
      both.sample.includes('+5') && both.sample.includes('WEAK -3'));

    // ── Aiming still owns the tap ───────────────────────────────────────────────────
    const armed = await page.evaluate(() => {
      closeDossier(); pendingAction = 'PIPE_RIFLE'; renderField();
      const n = document.querySelectorAll('[data-action="inspect"]').length;
      pendingAction = null; renderField();
      return { armed: n, free: document.querySelectorAll('[data-action="inspect"]').length };
    });
    ok(`with an order armed nothing reads, so a tap cannot mean two things (${armed.armed} then ${armed.free})`,
      armed.armed === 0 && armed.free > 0);
  },
};

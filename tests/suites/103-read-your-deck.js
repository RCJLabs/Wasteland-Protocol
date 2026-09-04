// E12: the codex documents enemies, grounds, skies, formations, curses, doctrines, factions and
// contracts across thirty-one entries, and the player's own ten classes in none of them.
//
// The one fact that decides whether a move lands at all was printed on no surface in the game.
// Measured: 40 player moves across ABILITIES and FOURTH_ABILITIES, not one of them carrying a
// desc field, and twelve of the forty are not physical -
//
//   MEDIC       Rad Shot            bio        PYROMANIAC  Flare Gun, Molotov, Thermite,
//   SCAVENGER   Flashbang, Acid Flask  energy               Heat Wave        all energy
//   HOUND       Feral Bite, Rip and Tear  bio  HAZMAT      Spray Gun, Caustic Burst,
//                                                          Tank Rupture     all bio
//
// - against eighteen hostile types of which three are outright immune to bio, ten resist it, and
// thirteen of eighteen are weak to energy with none resisting. So a Pyromaniac's entire deck is
// the best answer on the road to most of what walks it, a Hazmat's is useless against three
// types outright, and the deck button said only the label: no title, no type. The RESISTANCE
// entry tells the player to read the P/B/E badges on a hostile and never says which of their own
// moves is which.
//
// Fixed by computing rather than writing. The forty hand-authored sentences are explicitly not
// here - expensive, drift-prone and unearned - and every line of every class entry is read off
// the same tables the resolver reads.
module.exports = {
  name: 'Read your own deck',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── One entry per class, and it cannot be missed ─────────────────────────────────
    const cover = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const classes = Object.keys(ABILITIES);
      const mine = CODEX.filter(c => c.id.startsWith('DECK_'));
      return { classes, entries: mine.map(c => c.id),
               missing: classes.filter(c => !mine.some(e => e.id === `DECK_${c}`)),
               orphan: mine.filter(e => !classes.includes(e.id.slice(5))).map(e => e.id),
               titles: mine.map(c => c.title), total: CODEX.length };
    });
    ok(`every one of the ${cover.classes.length} classes has a manual entry now (${cover.missing.join(', ') || 'none missing'})`,
      cover.missing.length === 0 && cover.entries.length === cover.classes.length);
    ok(`and no entry names a class that does not exist (${cover.orphan.join(', ') || 'none'})`,
      cover.orphan.length === 0);
    // The base was 31 when this phase found the manual with nothing in it about the player, and
    // is 32 since E15 gave the relics a page of their own. The guard is that the base does not
    // quietly shrink and that every class still carries exactly one dossier on top of it.
    ok(`the codex is ${cover.total} entries: a base of 32 plus one per class`,
      cover.total === 32 + cover.classes.length);
    ok(`each is titled by class and mastery (${cover.titles[0]})`,
      cover.titles.every(t => /—/.test(t)));

    // ── Computed, not transcribed ───────────────────────────────────────────────────
    // The drift guard: every move in a class's tables must appear in its entry, and no move
    // from any other class may. A move added, renamed or moved between classes fails here.
    const drift = await page.evaluate(() => {
      const bad = [];
      Object.keys(ABILITIES).forEach(cls => {
        const entry = CODEX.find(c => c.id === `DECK_${cls}`);
        if (!entry) { bad.push(`${cls}: no entry at all`); return; }
        const text = entry.body().join(' | ');
        const mine = [...ABILITIES[cls], FOURTH_ABILITIES[cls]].filter(Boolean);
        mine.forEach(a => { if (!text.includes(a.label)) bad.push(`${cls}: ${a.label} not in its own entry`); });
        Object.keys(ABILITIES).filter(o => o !== cls).forEach(other => {
          [...ABILITIES[other], FOURTH_ABILITIES[other]].filter(Boolean).forEach(a => {
            if (mine.some(m => m.label === a.label)) return;
            if (text.includes(a.label)) bad.push(`${cls}: carries ${other}'s ${a.label}`);
          });
        });
      });
      return bad;
    });
    ok(`every entry lists its own deck and only its own (${drift.join('; ') || 'clean'})`, drift.length === 0);

    // ── The damage type is stated, and only where it means something ────────────────
    const types = await page.evaluate(() => {
      const bad = [];
      let typed = 0, quiet = 0;
      Object.keys(ABILITIES).forEach(cls => {
        const entry = CODEX.find(c => c.id === `DECK_${cls}`);
        if (!entry) { bad.push(`${cls}: no entry at all`); return; }
        const text = entry.body().join(' | ');
        [...ABILITIES[cls], FOURTH_ABILITIES[cls]].filter(Boolean).forEach(a => {
          const line = text.split(' | ').find(l => l.startsWith(a.label));
          if (!line) { bad.push(`${a.move}: no line`); return; }
          if (dealsDamage(a.move)) {
            typed++;
            const want = damageTypeOf(a.move);
            if (!line.includes(want)) bad.push(`${a.move}: line does not say ${want}`);
          } else {
            quiet++;
            if (/\b(phys|bio|energy)\b/.test(line)) bad.push(`${a.move}: claims a type it never uses`);
          }
        });
      });
      return { bad, typed, quiet, total: typed + quiet };
    });
    ok(`${types.typed} damaging moves each say what they are made of (${types.bad.join('; ') || 'clean'})`,
      types.bad.length === 0 && types.typed > 30);
    ok(`and the ${types.quiet} that never reach mitigate claim nothing, across all ${types.total}`,
      types.quiet > 0 && types.total === 40);

    // ── The combo is named where there is one, and not where there is not ───────────
    const combos = await page.evaluate(() => {
      const bad = [];
      Object.keys(ABILITIES).forEach(cls => {
        const e = CODEX.find(c => c.id === `DECK_${cls}`);
        if (!e) { bad.push(`${cls}: no entry at all`); return; }
        const lines = e.body();
        [...ABILITIES[cls], FOURTH_ABILITIES[cls]].filter(Boolean).forEach(a => {
          const line = lines.find(l => l.startsWith(a.label)) || '';
          const c = COMBOS.find(x => x.move === a.move);
          if (c && !line.includes(c.name)) bad.push(`${a.move}: ${c.name} not named`);
          if (!c && COMBOS.some(x => line.includes(x.name))) bad.push(`${a.move}: names a combo it has not got`);
        });
      });
      return { bad, total: COMBOS.length };
    });
    ok(`every combo a move cashes is named on its line (${combos.bad.join('; ') || 'clean'})`, combos.bad.length === 0);

    // ── And the signatures, as the forks E07 made them ──────────────────────────────
    const sigs = await page.evaluate(() => {
      const bad = [];
      Object.keys(ABILITIES).forEach(cls => {
        const e = CODEX.find(c => c.id === `DECK_${cls}`);
        if (!e) { bad.push(`${cls}: no entry at all`); return; }
        const text = e.body().join(' | ');
        SIG_PERKS.filter(p => p.cls === cls).forEach(p => {
          if (!text.includes(p.name)) bad.push(`${cls}: ${p.name} missing`);
        });
        const pairs = e.body().filter(l => l.includes('   OR   ')).length;
        if (pairs !== 2) bad.push(`${cls}: ${pairs} forks shown, not 2`);
      });
      return bad;
    });
    ok(`all forty signatures appear, two forks to a class (${sigs.join('; ') || 'clean'})`, sigs.length === 0);

    // ── The letter on the button, in the vocabulary the badges already use ──────────
    const deck = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5;
      const seen = {};
      // Walk the queue so more than one class's deck gets rendered.
      initiateCombat('RAIDERS', false);
      turnQueue.forEach((e, i) => {
        if (!e || !e.isPlayer) return;
        activeIndex = i; renderCommandDeck();
        [...document.querySelectorAll('#command-deck button[data-move]')].forEach(b => {
          const tag = b.querySelector('.dmg-tag');
          seen[b.dataset.move] = { text: tag ? tag.innerText : null, cls: tag ? tag.className : null,
                                   title: tag ? tag.title : null };
        });
      });
      const bad = [];
      Object.entries(seen).forEach(([move, s]) => {
        const want = dealsDamage(move) ? typeGlyph(damageTypeOf(move)) : null;
        if (s.text !== want) bad.push(`${move}: button says ${s.text}, resolver says ${want}`);
      });
      return { seen, bad, n: Object.keys(seen).length,
               glyphs: DMG_TYPES.map(([t, g]) => `${t}=${g}`) };
    });
    ok(`every rendered button agrees with the resolver about its type (${deck.n} buttons, ${deck.bad.join('; ') || 'clean'})`,
      deck.bad.length === 0 && deck.n >= 4);
    ok(`in the same P/B/E the resist badges use (${deck.glyphs.join(', ')})`,
      Object.values(deck.seen).filter(s => s.text).every(s => ['P', 'B', 'E'].includes(s.text)));
    ok('a self-action carries no letter, because it never reaches mitigate',
      deck.seen['IRON_GUARD'] ? deck.seen['IRON_GUARD'].text === null : true);
    ok('and the chip says the type in full when pointed at',
      Object.values(deck.seen).filter(s => s.text).every(s => /^(phys|bio|energy) damage$/.test(s.title || '')));

    // ── One list of the ally moves, read by the chip and by the targeting ───────────
    const ally = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5; initiateCombat('RAIDERS', false);
      const hero = activeEntities.find(e => e.isPlayer && e.hp > 0);
      activeIndex = turnQueue.findIndex(e => e && e.id === hero.id);
      const aimable = move => {
        pendingAction = move; renderField();
        const n = document.querySelectorAll('.entity.targetable-ally').length;
        pendingAction = null;
        return n;
      };
      return { list: [...ALLY_MOVES], reposition: aimable('REPOSITION'),
               blade: aimable('SCRAP_BLADE'),
               typed: ALLY_MOVES.filter(m => dealsDamage(m)) };
    });
    ok(`the ally moves are one list (${ally.list.join(', ')})`, ally.list.length === 3);
    ok(`and it still aims at your own line (${ally.reposition} allies targetable, ${ally.blade} for a blade)`,
      ally.reposition > 0 && ally.blade === 0);
    ok('none of them claims a damage type', ally.typed.length === 0);
  }
};

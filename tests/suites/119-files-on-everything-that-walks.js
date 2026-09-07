// F11. The Archive had two holes, and both of them were in front of the player.
//
// A commander that has felled you once comes back called "Warlord, Risen", and typeNameOf
// filed it under that - a key bestiaryRoster does not list and bestiaryRecord cannot resolve.
// So the moment a commander became one you had history with, its file stopped counting and
// tapping it on the field opened "No file on this one". The commanders you have fought most
// were exactly the ones the dossier had lost. Identity first now: a commander carries its
// bossId whatever the screen calls it this time.
//
// And everything a commander brings on with it - the pack it whistles up, the lieutenant it
// hides behind, the generator keeping it standing, and the warlords the Ossuary raises off
// your own record - stood on the field with no file at all, because bestiaryRoster read
// ENEMY_POOL and BOSS_POOL and those units live INSIDE the BOSS_POOL rows rather than beside
// them. summonedRoster is the third source, declared once so a summon cannot be added to a
// commander without the Archive learning about it.
//
// A raised commander files separately rather than onto the warlord it was: a third of the
// health and half the damage is a different thing to meet, and folding it in would have
// inflated the commander's own count with kills that were not the commander.
//
// The risk the phase named was old careers. Marks written under names nothing reads any more
// are the same fights, so they are folded onto the file that counts them now, off the pool
// rather than off a regex - a commander renamed later must not strand its history twice.
module.exports = {
  name: 'Files on everything that walks',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── A commander keeps one file however many times it comes back ─────────────────
    const kept = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      bestiary = {}; grudges = {};
      const b = BOSS_POOL.find(x => !x.final);
      const ent = g => ({ name: risenName(b, g), bossId: b.id, classType: 'BOSS', isPlayer: false });
      const marks = [];
      for (let g = 0; g <= 3; g++) {
        noteBestiary(typeNameOf(ent(g)), 'met');
        noteBestiary(typeNameOf(ent(g)), 'killed');
        marks.push({ g, shown: risenName(b, g), filed: typeNameOf(ent(g)) });
      }
      const file = bestiaryEntry(b.name);
      return { plain: b.name, marks, file, keys: Object.keys(bestiary),
               record: !!bestiaryRecord(typeNameOf(ent(2))),
               tap: dossierHtml(typeNameOf(ent(2))) };
    });
    ok(`a commander is named differently every time it comes back (${kept.marks.map(m => m.shown).join(' | ')})`,
      new Set(kept.marks.map(m => m.shown)).size === 4);
    ok(`but files under one name throughout (${kept.marks.map(m => m.filed).join(' | ')})`,
      kept.marks.every(m => m.filed === kept.plain));
    ok(`so the file keeps counting across four meetings (met ${kept.file.met}, killed ${kept.file.killed})`,
      kept.file.met === 4 && kept.file.killed === 4);
    ok(`and nothing is stranded under a name nothing reads (${kept.keys.join(', ')})`,
      kept.keys.length === 1 && kept.keys[0] === kept.plain);
    ok('tapping a risen one on the field opens its file', kept.record === true
      && !/No file on this one/.test(kept.tap));

    // ── Two fellings, the way the phase asked it to be measured ─────────────────────
    const twice = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      bestiary = {}; grudges = {};
      const b = BOSS_POOL.find(x => !x.final);
      const fell = () => {
        currentSector = 1; bossSalt = b.id;
        const g = grudgeOn(b.id);
        const foe = { name: risenName(b, g), bossId: b.id, classType: 'BOSS', isPlayer: false, hp: 0 };
        noteBestiary(typeNameOf(foe), 'killed');
        noteGrudge(b.id);
        return { g, name: foe.name, count: bestiaryEntry(b.name).killed };
      };
      const first = fell(), second = fell();
      return { first, second, entry: bestiaryEntry(b.name) };
    });
    ok(`felled once at grudge ${twice.first.g} (${twice.first.name}) it counts ${twice.first.count}`,
      twice.first.count === 1);
    ok(`felled again at grudge ${twice.second.g} (${twice.second.name}) the SAME file counts ${twice.second.count}`,
      twice.second.count === 2 && twice.second.g > twice.first.g);

    // ── Everything that can stand on the field resolves to a file ───────────────────
    const all = await page.evaluate(() => {
      const roster = new Set(bestiaryRoster().map(e => e.name));
      const walkers = [];
      Object.entries(ENEMY_POOL).forEach(([f, list]) => list.forEach(e =>
        walkers.push({ what: e.name, ent: { name: e.name, isPlayer: false } })));
      BOSS_POOL.forEach(b => {
        for (let g = 0; g <= 3; g++)
          walkers.push({ what: `${b.name} @${g}`, ent: { name: risenName(b, g), bossId: b.id, classType: 'BOSS', isPlayer: false } });
        [b.enrage && b.enrage.summon, b.grudge && b.grudge.spawn, b.escort, b.ward]
          .filter(Boolean).forEach(s => walkers.push({ what: s.name, ent: { name: s.name, isPlayer: false } }));
        if (!b.final) walkers.push({ what: `${b.name} raised`,
          ent: { name: `${b.name}, Raised`, classType: 'REVENANT', isPlayer: false } });
      });
      // And an elite, whose bracket is a modifier on a type rather than a type.
      walkers.push({ what: 'an elite', ent: { name: '*VAMPIRIC* Raider', eliteType: 'VAMPIRIC', isPlayer: false } });
      const homeless = walkers.filter(w => !roster.has(typeNameOf(w.ent))).map(w => w.what);
      return { walkers: walkers.length, homeless, roster: roster.size };
    });
    ok(`every hostile that can stand on the field has a file (${all.walkers} checked against ${all.roster})`,
      all.homeless.length === 0);

    // ── The summoned have files with the fields a file needs ───────────────────────
    const brought = await page.evaluate(() => {
      const rows = summonedRoster();
      const bad = rows.filter(r => !r.name || !r.range || !r.resistances || !r.summonedBy || !r.how);
      const named = rows.map(r => r.name);
      return { rows: rows.length, bad: bad.map(r => r.name), named,
               hasRevenant: named.indexOf(REVENANT_FILE) >= 0,
               tap: dossierHtml('Bulldog'), revTap: dossierHtml(REVENANT_FILE) };
    });
    ok(`the third source lists what commanders bring (${brought.named.join(', ')})`, brought.rows >= 6);
    ok(`each carrying the fields a file is drawn from (${brought.bad.join(', ') || 'all complete'})`,
      brought.bad.length === 0);
    ok('including the warlords the Ossuary raises', brought.hasRevenant === true);
    ok('and tapping one opens a file rather than a blank', !/No file on this one/.test(brought.tap)
      && !/No file on this one/.test(brought.revTap));

    // ── An old career keeps its history ────────────────────────────────────────────
    const old = await page.evaluate(() => {
      const b = BOSS_POOL.find(x => !x.final);
      const book = {};
      book[b.name] = { met: 1, killed: 1, felled: 0 };
      book[risenName(b, 1)] = { met: 2, killed: 1, felled: 1 };
      book[risenName(b, 3)] = { met: 1, killed: 1, felled: 0 };
      book[`${b.name}, Risen ×5`] = { met: 4, killed: 2, felled: 0 };
      book[`${b.name}, Raised`] = { met: 3, killed: 3, felled: 0 };
      book['Raider'] = { met: 9, killed: 8, felled: 1 };
      const was = Object.values(book).reduce((a, v) => a + v.met + v.killed + v.felled, 0);
      const out = foldBestiaryNames(book);
      const now = Object.values(out).reduce((a, v) => a + v.met + v.killed + v.felled, 0);
      // And through the real door: a career blob read off disk.
      bestiary = {}; saveMeta();
      const blob = JSON.parse(Store.get(META_KEY) || '{}');
      blob.bestiary = book;
      Store.set(META_KEY, JSON.stringify(blob));
      loadMeta();
      // Guarded: a fold that eats a key it should not touch must fail the assertion that names
      // it, rather than take the whole suite down on an undefined.
      const nil = { met: 0, killed: 0, felled: 0 };
      return { keys: Object.keys(out).sort(), boss: out[b.name] || nil, rev: out[REVENANT_FILE] || nil,
               raider: out['Raider'] || nil, was, now, plain: b.name,
               onLoad: Object.keys(bestiary).sort(), loaded: bestiaryEntry(b.name) };
    });
    ok(`every mark a commander was ever filed under folds onto its file (met ${old.boss.met}, killed ${old.boss.killed})`,
      old.boss.met === 8 && old.boss.killed === 5 && old.boss.felled === 1);
    ok(`the raised form folds onto the revenant's, not the commander's (killed ${old.rev.killed})`,
      old.rev.killed === 3);
    ok(`ordinary stock is left exactly alone (met ${old.raider.met})`,
      old.raider.met === 9 && old.raider.killed === 8 && old.raider.felled === 1);
    ok(`and not one mark is lost or invented (${old.was} in, ${old.now} out)`, old.was === old.now);
    ok(`a career read off disk comes back folded (${old.onLoad.join(', ')})`,
      old.onLoad.length === 3 && old.loaded.met === 8);
  }
};

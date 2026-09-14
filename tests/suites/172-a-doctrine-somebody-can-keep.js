// O10. The simulator has had a DOCTRINES block since G13 and nobody had ever run it and written
// the numbers down. The first 150-expedition career taken of it says this, under the default
// draft:
//
//   OLD_GUARD        offered 62, live 61     THE_WALL        offered 55, live 50
//   BROAD_SPECTRUM   offered 56, live 22     FIELD_SURGERY   offered 68, live 17
//   CONSCRIPTS       offered 63, live  5     NO_HANDS        offered 76, live  0
//   LIGHT_ORDER      offered 70, live  0     musters with a live offer: 114 of 150
//
// Two of seven never went live in a hundred and fifty expeditions, and of three cards offered
// only 1.03 were takeable on average. Read as a game fact that is two dead doctrines and barely
// a choice at the muster.
//
// IT IS NOT A GAME FACT. It is D05's trap, and this file is the instrument that catches it.
// `--draft line` opens every muster with a BRUISER or a SHOTGUNNER and then takes a MEDIC 70% of
// the time. NO_HANDS forbids melee and both openers carry it; LIGHT_ORDER caps the line at 55
// health and a Bruiser is 80; FIELD_SURGERY forbids a Medic. All three zeroes and near-zeroes
// have the same cause, and it is the policy's first pick rather than anything about the game.
//
// The question a career cannot answer is whether a line EXISTS that keeps each one - and that
// question needs no sampling at all. Every three-class line, at every arrangement of the three
// slots, against each doctrine's own holds(). Ten classes is 120 lines and 720 arrangements,
// which is a loop, not an estimate.
//
// AND THE FIRST CUT OF THIS PROBE FELL INTO THE SAME TRAP FROM THE OTHER SIDE. Built on level-1
// bodies with an empty career it reported OLD_GUARD keepable by NO line and CONSCRIPTS by EVERY
// line - both of which are the fixture, not the game: OLD_GUARD reads masteryRank off career
// mastery and CONSCRIPTS reads doctrineFavourites off fielding history, and an empty save makes
// the first impossible and the second free. Each is judged here at the state its own offerable()
// gate waits for, which is the only state it is ever asked in.
module.exports = {
  name: 'A doctrine somebody can keep',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    const enumerate = () => page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const pool = [...ROSTER_TEMPLATE, ...RECRUIT_POOL];
      const classes = [...new Set(pool.map(t => t.classType))];
      const bodyFor = cl => {
        const t = pool.find(r => r.classType === cl);
        return { id: 'probe_' + cl, name: cl, classType: cl, range: t.range,
                 maxHp: t.maxHp, hp: t.maxHp, level: 1, traits: [], perks: [],
                 gridPos: 0, cooldowns: {}, dossier: {} };
      };
      // The state each gated doctrine's offerable() waits for, set up rather than assumed.
      // OLD_GUARD wants OLD_GUARD_VETS classes at VETERAN_RANK; CONSCRIPTS wants three
      // favourites. Both are set to the MINIMUM that opens the gate - a doctrine that is only
      // keepable once the whole roster is veteran would be a different finding, and this is the
      // state it is first offered in.
      const vets = classes.slice(0, OLD_GUARD_VETS);
      const m = {}; vets.forEach(c => { m[c] = MASTERY_RANKS[VETERAN_RANK]; });
      mastery = m;
      doctrineFavourites = classes.slice(0, 3);
      const perms = [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]];
      const res = {};
      DOCTRINES.forEach(d => { res[d.id] = { ok: 0, total: 0, example: null }; });
      const n = classes.length;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
        const trio = [bodyFor(classes[i]), bodyFor(classes[j]), bodyFor(classes[k])];
        perms.forEach(p => {
          trio.forEach((c, x) => { c.gridPos = p[x]; });
          DOCTRINES.forEach(d => {
            const r = res[d.id];
            r.total++;
            let held = false;
            try { held = !!d.holds(trio); } catch (e) { held = false; }
            if (held) { r.ok++;
              if (!r.example) r.example = trio.map(c => c.classType + '@' + c.gridPos).join(' '); }
          });
        });
      }
      return { res, classes, ids: DOCTRINES.map(d => d.id), vets,
               favourites: doctrineFavourites.slice() };
    });

    const e = await enumerate();
    ok(`every doctrine in the table was enumerated against every line (${e.ids.length} doctrines, ` +
       `${e.classes.length} classes)`,
      e.ids.length === Object.keys(e.res).length && e.classes.length >= 7);

    // ── THE PROPERTY: no card in the table is one nobody can ever keep ──────────────────
    // A doctrine keepable by zero lines is a card the muster can offer and the player can never
    // take, which is the exact thing the table's own mid-file comment says the three composition
    // doctrines were added to fix. Asserted per doctrine so the failure names which one.
    e.ids.forEach(id => {
      const r = e.res[id];
      ok(`${id} is keepable - ${r.ok} of ${r.total} arrangements${r.example ? `, e.g. ${r.example}` : ''}`,
        r.ok > 0);
    });

    // ── AND NOT KEEPABLE BY EVERYTHING, which would make it a free multiplier ───────────
    // CONSCRIPTS and OLD_GUARD are judged at the minimum state that opens their gate, so both
    // are real questions here rather than vacuous ones - the first cut of this file had them at
    // 0 and 720 for exactly that reason. A doctrine that holds for every arrangement asks the
    // player for nothing, which is the other way for a card to stop being a decision.
    e.ids.forEach(id => {
      const r = e.res[id];
      ok(`${id} asks for something - it does not hold on every line (${r.ok} of ${r.total})`,
        r.ok < r.total);
    });

    // ── THE TWO THE CAREER READS AS DEAD, NAMED ────────────────────────────────────────
    // The row that would have caught the misreading. Both are 0 live over 150 expeditions and
    // both are keepable; if a future change makes either genuinely unkeepable the rows above
    // fire, and if a future draft policy reaches them the census moves on its own.
    ['NO_HANDS', 'LIGHT_ORDER'].forEach(id => {
      ok(`${id} reads as dead in a default-draft career and is not (${e.res[id].ok} lines keep it)`,
        e.res[id].ok >= 6);
    });

    // ── WHY THE CAREER NEVER REACHES THEM, stated as the engine's own predicates ────────
    // Not "the policy drafts a Bruiser" as prose, but the two facts that make its first pick
    // fatal to both: the openers carry melee, and one of them is over the health cap.
    const openers = await page.evaluate(({ HP }) => {
      const pool = [...ROSTER_TEMPLATE, ...RECRUIT_POOL];
      const mk = cl => { const t = pool.find(r => r.classType === cl);
        return { id: 'o_' + cl, name: cl, classType: cl, range: t.range, maxHp: t.maxHp,
                 hp: t.maxHp, level: 1, traits: [], perks: [], gridPos: 1, cooldowns: {}, dossier: {} }; };
      return ['BRUISER', 'SHOTGUNNER'].map(cl => {
        const c = mk(cl);
        return { cl, melee: carriesMelee(c), hp: baseHpOf(c), overCap: baseHpOf(c) > HP };
      });
    }, { HP: await page.evaluate(() => LIGHT_ORDER_HP) });
    ok(`both classes the default draft opens with carry melee, which is what NO HANDS forbids ` +
       `(${openers.map(o => `${o.cl} ${o.melee ? 'melee' : 'no melee'}`).join(', ')})`,
      openers.every(o => o.melee));
    ok(`and one of them is over LIGHT ORDER's health cap on its own ` +
       `(${openers.map(o => `${o.cl} ${o.hp}`).join(', ')} against ${await page.evaluate(() => LIGHT_ORDER_HP)})`,
      openers.some(o => o.overCap));

    // ── The gates that make the two career-state doctrines answerable at all ────────────
    const gates = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      mastery = {}; doctrineFavourites = [];
      const shut = DOCTRINES.filter(d => d.offerable && !d.offerable()).map(d => d.id);
      return { shutOnFreshSave: shut };
    });
    ok(`on a save with no history the two that read it are not offered at all ` +
       `(${gates.shutOnFreshSave.join(', ') || 'none'})`,
      gates.shutOnFreshSave.includes('CONSCRIPTS') && gates.shutOnFreshSave.includes('OLD_GUARD'));

    // ── A COUPLING NOTHING SAID OUT LOUD, found by mutating the gate ────────────────────
    // OLD_GUARD_VETS is how many classes must reach veteran before the card is OFFERED, and
    // holds() then asks every one of DEPLOYED line slots to be a veteran. So the gate has to
    // count at least a full line: at OLD_GUARD_VETS = 2 the muster offers a card that a save
    // with exactly two veterans can never keep, which is precisely the offerable-but-unkeepable
    // state the table's own comment says the composition doctrines were added to end. The two
    // constants are three lines apart in game.js and neither mentions the other. They are equal
    // today and that is the only reason the card works.
    const coupling = await page.evaluate(() => ({ vets: OLD_GUARD_VETS, line: DEPLOYED }));
    ok(`OLD GUARD's offer gate counts at least a full line, or it can be offered and never kept ` +
       `(gate ${coupling.vets}, line ${coupling.line})`,
      coupling.vets >= coupling.line);
  }
};

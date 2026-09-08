// H11, filed as "Thirteen shapes, and 56% of fights are an unshaped draw... Tie the shape to who
// is fighting, so raiders read as raiders and the Choir reads as the Choir." Both halves are
// answered by the code as it already stands.
//
// SHAPES ARE ALREADY TIED TO WHO IS FIGHTING. FORMATIONS is keyed by faction - RAIDERS, BEASTS,
// MECH, CHOIR, CARRION, seventeen shapes across five tables - and rollFormation(faction, tier)
// only ever draws from that faction's own list. There is no shared pool to split.
//
// AND THE 56% IS A DIAL, NOT A SHORTAGE. Driven through the engine over 300,000 modelled fights:
// a shape was open on 87% of them, and FORMATION_CHANCE (0.55) declines the rest by design. So
// the unshaped share is roughly 45 points of deliberate coin and 13 of nothing-open-yet, not a
// missing signature. Measured in play at 60 runs the named rate is 44%, which is what the item
// was filed on and what the dial predicts.
//
// WHAT IS REAL is narrower. As a share of their own faction's PLAYED fights, two shapes sit near
// 3% - ROADBLOCK (RAIDERS) and CONVOY (MECH) - against 17-32% for the openers. Both are gated at
// exactly the tier their heaviest unit unlocks at, so neither can be made commoner by retiming:
// the gate is already on the floor. They are rare because they field deep units and runs end at
// sector 3, which is the tier-ten wall again rather than a formations defect.
//
// D14 ASKED A NEIGHBOURING QUESTION WITH A DIFFERENT LENS and its number should not be read as
// this one. Suite 86 walks sectors 1-7 uniformly (SECTORS: 7, RUNS: 400), which is right for
// "is this faction's table internally crowded" and wrong for "does a player ever meet this
// shape": runs do not reach sectors uniformly, so a uniform walk overstates the deep end of
// every table. Both numbers are true of different questions. This suite pins the distinction so
// they cannot be conflated again, and deliberately asserts no percentage of its own - a share is
// a balance reading, and pinning one here would make this file an obstacle to tuning.
module.exports = {
  name: 'The shape you actually meet',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── Every shape belongs to exactly one faction ───────────────────────────────
    const owned = await page.evaluate(() => {
      const seen = {};
      Object.entries(FORMATIONS).forEach(([fac, list]) => list.forEach(f => {
        seen[f.id] = (seen[f.id] || []).concat(fac);
      }));
      return { factions: Object.keys(FORMATIONS),
               shared: Object.entries(seen).filter(([, fs]) => fs.length > 1).map(([id]) => id),
               total: ALL_FORMATIONS.length,
               everyFactionHasOne: Object.values(FORMATIONS).every(l => l.length > 0) };
    });
    ok(`the shapes are split across ${owned.factions.length} faction tables (${owned.total} of them)`,
      owned.factions.length >= 4 && owned.total >= owned.factions.length);
    ok('every faction has at least one of its own', owned.everyFactionHasOne === true);
    ok(`and no shape is shared between two factions (${owned.shared.join(', ') || 'none shared'})`,
      owned.shared.length === 0);

    // ── A faction's roll never reaches another faction's table ───────────────────
    // The structural half of "tie the shape to who is fighting": driven, not read.
    const stayHome = await page.evaluate(() => {
      const wrong = [];
      Object.keys(FORMATIONS).forEach(fac => {
        const mine = new Set(FORMATIONS[fac].map(f => f.id));
        for (let eff = 1; eff <= 20; eff++) {
          for (let i = 0; i < 40; i++) {
            const id = rollFormation(fac, eff);
            if (id && !mine.has(id)) wrong.push(`${fac}@${eff}:${id}`);
          }
        }
      });
      return wrong;
    });
    ok(`a faction only ever rolls its own shapes (${stayHome.length} strays)`, stayHome.length === 0);

    // ── The unshaped share is the dial, not an empty table ───────────────────────
    const dial = await page.evaluate(() => {
      const facs = Object.keys(FORMATIONS);
      let open = 0, shut = 0, N = 0;
      // Across the tiers runs actually reach: sectors 1-4, every tier.
      for (let sec = 1; sec <= 4; sec++) {
        for (let t = 1; t <= TOTAL_TIERS; t++) {
          facs.forEach(f => { N++;
            if (formationsFor(f, t + (sec - 1) * SECTOR_TIER_BONUS).length) open++; else shut++; });
        }
      }
      return { open, shut, N, chance: FORMATION_CHANCE };
    });
    ok(`a shape is open on most of the road (${dial.open} of ${dial.N} faction-tiers)`,
      dial.open > dial.shut * 2);
    ok(`so the unshaped share is mostly the dial (${dial.chance}) rather than an empty table`,
      dial.chance > 0 && dial.chance < 1);

    // ── The deep shapes are on their floor, and cannot be retimed ────────────────
    // This is why the starvation is not a mistiming the way D14's was: RISING_FLIGHT sat at gate
    // 9 against a unit floor of 5 and had four tiers to give back. These have none. Proved by
    // asking validateFormations what would happen, rather than by asserting the gates directly.
    const floors = await page.evaluate(() => {
      const rows = [];
      Object.entries(FORMATIONS).forEach(([fac, list]) => list.forEach(f => {
        const floor = Math.max(...f.units.map(n => (unitByName(fac, n) || { minTier: 1 }).minTier));
        rows.push({ fac, id: f.id, gate: f.minTier, floor, slack: f.minTier - floor });
      }));
      // For every shape with no slack, dropping its gate a tier must be rejected by the engine's
      // own validator - that is what "cannot be made commoner by retiming" means, executably.
      const tight = rows.filter(r => r.slack === 0);
      const rejected = tight.map(r => {
        const f = FORMATIONS[r.fac].find(x => x.id === r.id);
        const was = f.minTier;
        f.minTier = was - 1;
        const bad = validateFormations().filter(m => m.includes(r.id));
        f.minTier = was;
        return { id: r.id, caught: bad.length > 0 };
      });
      return { rows, tight: tight.map(r => r.id), rejected,
               cleanNow: validateFormations() };
    });
    ok(`the tables are valid as they stand (${floors.cleanNow.length} complaints)`,
      floors.cleanNow.length === 0);
    ok(`no shape is offered before a unit it fields exists (${floors.rows.filter(r => r.slack < 0).length} below floor)`,
      floors.rows.every(r => r.slack >= 0));
    ok(`some shapes sit exactly on their unit floor (${floors.tight.join(', ') || 'none'})`,
      floors.tight.length > 0);
    ok('and dropping any of those a tier is refused by the engine’s own validator',
      floors.rejected.length > 0 && floors.rejected.every(r => r.caught === true));

    // ── A shape survives the save that carries it ────────────────────────────────
    // A node stores its formation as an id, so the id is a save-compatible key: a map written by
    // one build and read by another has to resolve every shape it is holding, or the node quietly
    // loses its composition and the fight becomes a loose draw with no sign that anything went
    // wrong. E10 is the phase that found this class of loss.
    const survives = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      currentSector = 3;
      sectorMap = generateSectorMap();
      const held = sectorMap.nodes.filter(n => n.formation).map(n => ({ id: n.id, f: n.formation }));
      saveGameState();
      sectorMap = null;
      loadGameState();
      const back = (sectorMap.nodes || []).filter(n => n.formation).map(n => ({ id: n.id, f: n.formation }));
      const unresolved = back.filter(n => !formationById(n.f));
      return { held: held.length, back: back.length, unresolved: unresolved.map(n => n.f),
               same: held.length === back.length
                  && held.every(h => back.some(b => b.id === h.id && b.f === h.f)) };
    });
    ok(`a generated map holds shapes to test with (${survives.held})`, survives.held > 0);
    ok(`every one of them comes back off the save (${survives.back})`, survives.same === true);
    ok(`and every id a save carries still resolves (${survives.unresolved.join(', ') || 'all resolve'})`,
      survives.unresolved.length === 0);

    // ── The two lenses, and why they disagree ────────────────────────────────────
    // Sampling sectors uniformly is not sampling where runs end. Held as a relationship rather
    // than as numbers: the deep end of a table must read RARER once the weighting reflects that
    // most runs stop early. If that ever stops being true, the two readings have converged and
    // suite 86's figure and this one can safely be quoted for each other.
    const lenses = await page.evaluate(() => {
      const deep = [];
      Object.entries(FORMATIONS).forEach(([fac, list]) => {
        const gates = list.map(f => f.minTier);
        const top = Math.max(...gates);
        list.filter(f => f.minTier === top && top > Math.min(...gates)).forEach(f => deep.push({ fac, id: f.id }));
      });
      const draw = weights => {
        const counts = {}, fights = {};
        Object.keys(FORMATIONS).forEach(f => { fights[f] = 0; FORMATIONS[f].forEach(x => counts[x.id] = 0); });
        const secs = Object.keys(weights).map(Number), ws = secs.map(k => weights[k]);
        const pickSec = () => { let r = Math.random(); for (let i = 0; i < secs.length; i++) { r -= ws[i]; if (r <= 0) return secs[i]; } return secs[secs.length - 1]; };
        const facs = Object.keys(FORMATIONS);
        for (let i = 0; i < 120000; i++) {
          const sec = pickSec(), t = 1 + Math.floor(Math.random() * TOTAL_TIERS);
          const fac = facs[Math.floor(Math.random() * facs.length)];
          fights[fac]++;
          const id = rollFormation(fac, t + (sec - 1) * SECTOR_TIER_BONUS);
          if (id) counts[id]++;
        }
        return { counts, fights };
      };
      const flat = {}; for (let s = 1; s <= 7; s++) flat[s] = 1 / 7;
      const lived = { 1: 0.34, 2: 0.30, 3: 0.22, 4: 0.09, 5: 0.04, 6: 0.008, 7: 0.002 };
      const u = draw(flat), p = draw(lived);
      return deep.map(d => ({ id: d.id,
        uniform: u.counts[d.id] / u.fights[d.fac],
        played: p.counts[d.id] / p.fights[d.fac] }));
    });
    ok(`the deep shapes were found to compare (${lenses.map(l => l.id).join(', ')})`, lenses.length >= 3);
    ok('a uniform walk of the sectors overstates every one of them against a played weighting',
      lenses.every(l => l.played < l.uniform));
    ok(`and materially so, not marginally (${lenses.map(l => `${l.id} ${(l.uniform / Math.max(1e-9, l.played)).toFixed(1)}x`).join(', ')})`,
      lenses.every(l => l.uniform > l.played * 1.5));
  }
};

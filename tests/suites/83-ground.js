// Two grounds in six were nearly never fought on. Measured over expeditions: OPEN_ROAD 34%,
// OPEN_FLATS 21%, RUINS 20%, TUNNELS 19% - and then FLOODED 3% and NEST 2%, the two that
// arrived with the Choir and the Carrion. A six-fold spread across a table whose whole job is
// to vary the fight.
//
// It was two compounding causes, and neither was the ground table.
//
// The first was the faction draw. rollNodeFaction took the RAW tier, so its "the shallow tiers
// stay on the stock a new squad has answers for" guard fired at tiers 1 and 2 of EVERY sector,
// not the opening of a run - which is what its own comment, and the comment on the faction
// table beside it, both say it is for. A fifth of every road in the game was pinned to raiders
// and beasts no matter how deep it was. The guard was also protecting nothing: the enemy POOL
// has always ramped on effective tier, so sector 5 tier 1 was already fielding tier-13 stock
// under a raider banner. Only the banner was held back.
//
// The second was the ground split. Each faction lists two grounds, its own and a neighbouring
// one, and they were drawn 50/50 - so every faction donated half its ground to a NEIGHBOUR's
// signature. That is harmless for the three grounds that have two or three suppliers and fatal
// for the two that have exactly one: FLOODED comes only from the Choir, NEST only from the
// Carrion. Each got half of an already-rare faction.
//
// Both are fixed here, and what this suite holds is the shape: the guard means depth, sector 1
// still opens the way it always did, the signature ground is the majority of a faction's
// ground, and no ground is more than three times rarer than the commonest.
module.exports = {
  name: 'Ground the newest factions actually stand on',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__reset = () => { currentSlot = 1; confirmNewGame(1.0); sectorFront = null; };
      // One modelled route per sector, the way a run walks it: start on a tier-1 node, step to a
      // random child, and record what is underfoot on everything that is a fight.
      window.__walk = (sector, runs) => {
        const ground = {}, faction = {}, shallow = {};
        let fights = 0, carried = 0;
        for (let r = 0; r < runs; r++) {
          currentSector = sector;
          sectorFront = rollFront(Math.random, sector);
          const map = generateSectorMap();
          let node = map.nodes.filter(n => n.tier === 1)[Math.floor(Math.random() * 2)];
          let guard = 0;
          while (node && guard++ < 40) {
            if (FIGHT_NODES.includes(node.type)) {
              fights++;
              if ((node.terrain || 'OPEN_ROAD') !== 'OPEN_ROAD') carried++;
              ground[node.terrain || 'OPEN_ROAD'] = (ground[node.terrain || 'OPEN_ROAD'] || 0) + 1;
              faction[node.type] = (faction[node.type] || 0) + 1;
              if (node.tier <= 2) shallow[node.type] = (shallow[node.type] || 0) + 1;
            }
            if (!node.edges.length) break;
            node = map.nodes.find(n => n.id === node.edges[Math.floor(Math.random() * node.edges.length)]);
          }
        }
        return { ground, faction, shallow, fights, carried };
      };
      window.__share = (o, k) => { const t = Object.values(o).reduce((a, b) => a + b, 0);
                                   return t ? (o[k] || 0) / t : 0; };
    });

    // ── Depth, not tier ──────────────────────────────────────────────────────────────────
    // The unit the guard is written in. A tier number on its own cannot say how deep a node is.
    const depth = await page.evaluate(() => {
      __reset();
      return { s1t1: effTierAt(1, 1), s1t9: effTierAt(9, 1), s2t1: effTierAt(1, 2),
               s5t1: effTierAt(1, 5), bonus: SECTOR_TIER_BONUS };
    });
    ok(`the first node of a run is depth 1 (${depth.s1t1})`, depth.s1t1 === 1);
    ok(`the same tier one sector on is ${depth.bonus} deeper (s1t1 ${depth.s1t1}, s2t1 ${depth.s2t1})`,
      depth.s2t1 === depth.s1t1 + depth.bonus);
    ok(`so a shallow tier deep enough in outranks a deep tier at the start ` +
       `(s5t1 ${depth.s5t1} vs s1t9 ${depth.s1t9})`,
      depth.s5t1 > depth.s1t9 && depth.s5t1 === 1 + 4 * depth.bonus);

    // ── Sector 1 still opens the way it did ──────────────────────────────────────────────
    // The intent the old guard was written for, kept exactly. A new squad's first two roads are
    // raiders and beasts, and its whole sector is the three factions it has tools for.
    const one = await page.evaluate(() => {
      __reset();
      const seen = new Set(), shallow = new Set();
      currentSector = 1;
      for (let i = 0; i < 800; i++) {
        shallow.add(rollNodeFaction(effTierAt(1, 1), Math.random));
        shallow.add(rollNodeFaction(effTierAt(2, 1), Math.random));
        seen.add(rollNodeFaction(effTierAt(5, 1), Math.random));
      }
      return { shallow: [...shallow].sort(), seen: [...seen].sort() };
    });
    ok(`the first two roads of a run are still the starter stock (${one.shallow.join(', ')})`,
      one.shallow.length === 2 && one.shallow.includes('RAIDERS') && one.shallow.includes('BEASTS'));
    ok(`and sector 1 as a whole is still three factions (${one.seen.join(', ')})`,
      one.seen.length === 3 && !one.seen.includes('CHOIR') && !one.seen.includes('CARRION'));

    // ── From sector 2, a shallow tier is not a shallow road ──────────────────────────────
    const deep = await page.evaluate(() => {
      __reset();
      const out = {};
      [2, 5].forEach(s => {
        currentSector = s;
        const seen = new Set();
        for (let i = 0; i < 800; i++) seen.add(rollNodeFaction(effTierAt(1, s), Math.random));
        out[s] = [...seen].sort();
      });
      currentSector = 1;
      return out;
    });
    ok(`tier 1 of sector 2 draws the whole table (${deep[2].join(', ')})`,
      deep[2].length === 5 && deep[2].includes('CHOIR') && deep[2].includes('CARRION'));
    ok(`so does tier 1 of sector 5 (${deep[5].length} factions)`, deep[5].length === 5);

    // And the generator is wired to it. The draw above is the function; this is the maps it
    // actually builds, which is where a call site passing the raw tier would still hide.
    const wired = await page.evaluate(() => {
      __reset();
      const shallowTypes = sector => {
        currentSector = sector; sectorFront = null;
        const seen = new Set();
        for (let i = 0; i < 80; i++) generateSectorMap(Math.random).nodes
          .filter(n => n.tier <= 2 && FIGHT_NODES.includes(n.type))
          .forEach(n => seen.add(n.type));
        return [...seen].sort();
      };
      const one = shallowTypes(1), two = shallowTypes(2);
      currentSector = 1;
      return { one, two };
    });
    ok(`the maps a new run gets keep their first two tiers on the starter stock (${wired.one.join(', ')})`,
      wired.one.length === 2 && wired.one.includes('RAIDERS') && wired.one.includes('BEASTS'));
    ok(`the maps of sector 2 do not (${wired.two.join(', ')})`,
      wired.two.length === 5);

    // ── The guard was holding back a banner, not a difficulty ────────────────────────────
    // Why widening it is a fix and not a difficulty change: the units behind that faction were
    // never sector-1 stock. The pool ramps on the same depth the draw now reads.
    const stock = await page.evaluate(() => {
      __reset();
      const count = (d, f) => Object.keys(ENEMY_POOL)
        .reduce((n, k) => n + ENEMY_POOL[k].filter(e => d >= e.minTier && f(e)).length, 0);
      const at = (tier, sector) => { const d = effTierAt(tier, sector);
        return { d, units: count(d, () => true), heavies: count(d, e => e.isHeavy) }; };
      return { open: at(1, 1), s2: at(1, 2), s5: at(1, 5),
               all: Object.values(ENEMY_POOL).reduce((n, p) => n + p.length, 0),
               heavies: Object.values(ENEMY_POOL).reduce((n, p) => n + p.filter(e => e.isHeavy).length, 0) };
    });
    ok(`the opening of a run fields almost none of the stock ` +
       `(${stock.open.units} of ${stock.all} units, ${stock.open.heavies} of ${stock.heavies} heavies)`,
      stock.open.units < stock.all / 4 && stock.open.heavies === 0);
    ok(`tier 1 of sector 2 already fields more than it (${stock.s2.units} units)`,
      stock.s2.units > stock.open.units);
    ok(`and tier 1 of sector 5 fields nearly all of it ` +
       `(${stock.s5.units} of ${stock.all} units, ${stock.s5.heavies} of ${stock.heavies} heavies)`,
      stock.s5.units >= stock.all - 1 && stock.s5.heavies >= stock.heavies - 1);

    // ── The signature ground is the first entry, everywhere ──────────────────────────────
    // Two tables agree on it and neither says so out loud, so this is where it is written down:
    // a faction's backdrop is a picture of its first ground, and its confluence - its own sky
    // over its own ground - is keyed to the same one.
    const sig = await page.evaluate(() => {
      const rows = FIGHT_NODES.map(f => {
        const c = CONFLUENCE.find(x => x.faction === f);
        return { f, first: FACTIONS[f].ground[0], grounds: FACTIONS[f].ground.length,
                 conf: c ? c.ground : null, confSky: c ? c.sky : null, sky: FACTIONS[f].weather };
      });
      return rows;
    });
    ok(`every faction lists two grounds (${sig.map(r => r.grounds).join('/')})`,
      sig.every(r => r.grounds === 2));
    ok('every confluence stands on its faction’s first ground',
      sig.every(r => r.conf && r.conf === r.first));
    ok('and under its faction’s own sky', sig.every(r => r.confSky === r.sky));
    const supply = await page.evaluate(() => Object.fromEntries(TERRAIN_IDS
      .filter(g => g !== 'OPEN_ROAD')
      .map(g => [g, FIGHT_NODES.filter(f => FACTIONS[f].ground.includes(g)).length])));
    ok(`the two thin grounds have exactly one supplier each ` +
       `(${Object.entries(supply).map(([g, n]) => `${g} ${n}`).join(', ')})`,
      supply.FLOODED === 1 && supply.NEST === 1 &&
      supply.RUINS > 1 && supply.TUNNELS > 1 && supply.OPEN_FLATS > 1);

    // ── A faction mostly fights on its own ground ────────────────────────────────────────
    const split = await page.evaluate(() => {
      __reset();
      const out = {};
      FIGHT_NODES.forEach(f => {
        const g = FACTIONS[f].ground; const seen = {};
        for (let i = 0; i < 4000; i++) {
          const r = Math.random();
          seen[g.length === 1 || r < GROUND_SIGNATURE ? g[0] : g[1]] =
            (seen[g.length === 1 || r < GROUND_SIGNATURE ? g[0] : g[1]] || 0) + 1;
        }
        out[f] = seen[g[0]] / 4000;
      });
      return { out, weight: GROUND_SIGNATURE };
    });
    ok(`the signature is the clear majority of a faction’s ground (weight ${split.weight})`,
      split.weight >= 0.6 && split.weight < 1);
    ok(`and the neighbouring ground still turns up (${Math.round((1 - split.weight) * 100)}% of the time)`,
      split.weight <= 0.85);

    // ── What a squad actually stands on, over modelled runs ──────────────────────────────
    // The measurement the phase was filed off, taken the cheap way: real map generation, one
    // route per sector, no combat. It reproduces the simulator's own figures to within a point.
    const walked = await page.evaluate(() => {
      __reset();
      const tally = { ground: {}, fights: 0, carried: 0 };
      for (let s = 1; s <= 5; s++) {
        const w = __walk(s, 700);
        Object.entries(w.ground).forEach(([k, v]) => tally.ground[k] = (tally.ground[k] || 0) + v);
        tally.fights += w.fights; tally.carried += w.carried;
      }
      currentSector = 1;
      const shares = Object.fromEntries(Object.entries(tally.ground)
        .map(([k, v]) => [k, v / tally.fights]));
      return { shares, carried: tally.carried / tally.fights, fights: tally.fights,
               chance: GROUND_CHANCE };
    });
    const g = walked.shares;
    const named = ['OPEN_FLATS', 'RUINS', 'TUNNELS', 'FLOODED', 'NEST'];
    const pc = k => `${((g[k] || 0) * 100).toFixed(1)}%`;
    ok(`every ground in the table gets fought on (${named.map(k => `${k} ${pc(k)}`).join(', ')})`,
      named.every(k => (g[k] || 0) > 0.02));
    ok(`the two newest are no longer a rounding error (FLOODED ${pc('FLOODED')}, NEST ${pc('NEST')})`,
      g.FLOODED > 0.05 && g.NEST > 0.05);
    ok(`no ground is more than three times rarer than the commonest ` +
       `(${(Math.max(...named.map(k => g[k])) / Math.min(...named.map(k => g[k]))).toFixed(1)}x)`,
      Math.max(...named.map(k => g[k])) / Math.min(...named.map(k => g[k])) < 3);
    // The phase moved WHICH ground, not HOW OFTEN - GROUND_CHANCE is untouched, and the share
    // of fights carrying any ground has to still land on it, less the plain opening node.
    ok(`fights carrying ground still track the dial (${(walked.carried * 100).toFixed(1)}% vs ${walked.chance * 100}%)`,
      walked.carried > walked.chance - 0.05 && walked.carried <= walked.chance + 0.02);

    // ── And the manual says so ───────────────────────────────────────────────────────────
    // A rule the player can plan a route around has to be readable somewhere that is not this
    // file: a sector under one front now leans onto one floor, and that is worth knowing.
    const manual = await page.evaluate(() => {
      const body = CODEX.find(e => e.id === 'GROUND_SKY').body().join(' ');
      return { home: /home ground/i.test(body), share: body.includes(`${Math.round(GROUND_SIGNATURE * 100)}%`) };
    });
    ok('the field manual says a faction has a home ground', manual.home);
    ok('and states how much of its fighting happens there', manual.share);
  }
};

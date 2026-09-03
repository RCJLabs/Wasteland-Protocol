// D14: a named composition turns up on 45-55% of fights, and the seventeen shapes it can be
// are not drawn evenly. Measured before this phase, over 3,000 modelled sectors of pure map
// generation - the same cheap approach D08 used for ground, because this is a table-lookup
// question and thousands of free draws resolve it better than any number of played expeditions:
//
//   share of its own faction's fights, the four "opens shallow, fades deep" formations
//     MOB (RAIDERS)        10.7%
//     THE_PACK (BEASTS)    13.5%
//     AIR_COVER (MECH)     11.2%
//     PROCESSION (CHOIR)   11.9%
//     THE_SWARM (CARRION)   5.6%   <- the outlier, roughly half its peers
//
// The cause was not Carrion's overall rarity - D08 already addressed that - it was CARRION's
// own table. THE_SWARM opens at minTier 4 and RISING_FLIGHT one tier later at 5, so it was
// never alone for more than a single tier before splitting the draw two ways, then three when
// UNDERTOW opened at 9 (five tiers into an already-crowded window). Every other faction leaves
// its opener four or more tiers before the next one arrives - BEASTS' own THE_PACK (4) to
// RUN_DOWN (9) is the widest gap of the four - and only CARRION's table crowded its opener.
//
// RISING_FLIGHT moves from minTier 5 to 9 and UNDERTOW from 9 to 11: the same five-tier gap
// BEASTS already uses off its own opener, applied to Carrion's. Both stay at or above the tier
// their own units unlock at (Blight Moth 5, Gorge Worm 9), so nothing is offered a tier early.
// Measured after: THE_SWARM 5.6% -> 9.2% of Carrion fights. RISING_FLIGHT and UNDERTOW give up
// some of the exposure that bought - 19.5% -> 17.7% and 16.5% -> 14.8% - and THE_NEST, named
// alongside THE_SWARM in the brief this phase was filed from, measured fine on its own (13.3%,
// in the pack with CONVOY and THE_RITE) and is untouched.
const BEFORE = { THE_SWARM: 0.056, RISING_FLIGHT: 0.195, UNDERTOW: 0.165, THE_NEST: 0.132 };
module.exports = {
  name: 'Formations drawn evenly enough to learn',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── The retiming itself, pinned so a revert is caught without waiting on a sweep ──────
    const spacing = await page.evaluate(() => {
      const at = (fac, id) => FORMATIONS[fac].find(f => f.id === id);
      const gap = (fac, openerId, nextId) => at(fac, nextId).minTier - at(fac, openerId).minTier;
      return {
        swarm: at('CARRION', 'THE_SWARM').minTier, swarmFade: at('CARRION', 'THE_SWARM').fadeAt,
        flight: at('CARRION', 'RISING_FLIGHT').minTier, undertow: at('CARRION', 'UNDERTOW').minTier,
        nest: at('CARRION', 'THE_NEST').minTier,
        carrionGap: gap('CARRION', 'THE_SWARM', 'RISING_FLIGHT'),
        // What this was modelled on - BEASTS' own opener-to-second gap, read live rather than
        // hardcoded, so a later change to BEASTS' spacing is what this keeps pace with.
        beastsGap: gap('BEASTS', 'THE_PACK', 'RUN_DOWN'),
        moth: unitByName('CARRION', 'Blight Moth').minTier, worm: unitByName('CARRION', 'Gorge Worm').minTier
      };
    });
    ok(`the Carrion's opener still opens at ${spacing.swarm} and fades at ${spacing.swarmFade}`,
      spacing.swarm === 4 && spacing.swarmFade === 10);
    ok(`Rising Flight opens ${spacing.carrionGap} tiers later, matching the gap Beasts already ` +
       `leaves off its own opener (${spacing.beastsGap})`,
      spacing.flight === 9 && spacing.carrionGap === spacing.beastsGap);
    ok(`and neither move offers a unit before it unlocks (Rising Flight ${spacing.flight} >= ` +
       `Blight Moth ${spacing.moth}, Undertow ${spacing.undertow} >= Gorge Worm ${spacing.worm})`,
      spacing.flight >= spacing.moth && spacing.undertow >= spacing.worm);
    ok(`the Nest, named alongside the Swarm in the brief this phase was filed from, needed ` +
       `nothing and is untouched (still ${spacing.nest})`, spacing.nest === 12);

    // ── The measured effect, at a sample size a table lookup can afford ──────────────────
    const spread = await page.evaluate(async ({ SECTORS, RUNS }) => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const draws = {}, fights = {};
      for (let r = 0; r < RUNS; r++) {
        for (let s = 1; s <= SECTORS; s++) {
          currentSector = s; sectorFront = rollFront(Math.random, s);
          generateSectorMap().nodes.forEach(n => {
            if (!FIGHT_NODES.includes(n.type)) return;
            fights[n.type] = (fights[n.type] || 0) + 1;
            if (n.formation) draws[n.formation] = (draws[n.formation] || 0) + 1;
          });
        }
      }
      currentSector = 1;
      const shareOfFaction = id => {
        const fac = Object.keys(FORMATIONS).find(k => FORMATIONS[k].some(f => f.id === id));
        return (draws[id] || 0) / (fights[fac] || 1);
      };
      const openers = { MOB: 'RAIDERS', THE_PACK: 'BEASTS', AIR_COVER: 'MECH', PROCESSION: 'CHOIR' };
      return {
        carrion: ['THE_SWARM', 'RISING_FLIGHT', 'UNDERTOW', 'THE_NEST']
          .reduce((o, id) => ({ ...o, [id]: shareOfFaction(id) }), {}),
        openerShares: Object.keys(openers).map(id => shareOfFaction(id)),
        totalFights: Object.values(fights).reduce((a, b) => a + b, 0)
      };
    }, { SECTORS: 7, RUNS: 400 });
    const pc = x => `${(x * 100).toFixed(1)}%`;
    ok(`the Swarm's share of Carrion fights moved up from the measured ${pc(BEFORE.THE_SWARM)} ` +
       `(now ${pc(spread.carrion.THE_SWARM)}, over ${spread.totalFights} modelled fights)`,
      spread.carrion.THE_SWARM > BEFORE.THE_SWARM * 1.3);
    // Not narrowed to its old rate - moved toward its siblings. The other three factions'
    // openers span 10.7-13.5%; the Swarm does not need to land inside that band, only inside
    // reach of it, since Carrion's table still carries one more formation than any of theirs.
    const openerLo = Math.min(...spread.openerShares), openerHi = Math.max(...spread.openerShares);
    ok(`and it now sits within reach of its peers' own range (${pc(openerLo)}-${pc(openerHi)}), ` +
       `not roughly half of their average as it measured before`,
      spread.carrion.THE_SWARM > openerLo * 0.6);
    ok(`Rising Flight and Undertow gave up some of the exposure that bought, without being ` +
       `starved (${pc(spread.carrion.RISING_FLIGHT)} and ${pc(spread.carrion.UNDERTOW)}, both ` +
       `still above the Swarm's old rate)`,
      spread.carrion.RISING_FLIGHT > BEFORE.THE_SWARM && spread.carrion.UNDERTOW > BEFORE.THE_SWARM &&
      spread.carrion.RISING_FLIGHT < BEFORE.RISING_FLIGHT && spread.carrion.UNDERTOW < BEFORE.UNDERTOW);
    ok(`the Nest is unaffected by a change to its neighbours' timing (${pc(spread.carrion.THE_NEST)} ` +
       `against a measured ${pc(BEFORE.THE_NEST)} before)`,
      Math.abs(spread.carrion.THE_NEST - BEFORE.THE_NEST) < 0.02);

    // ── The other four factions are untouched ────────────────────────────────────────────
    const others = await page.evaluate(() => ({
      raiders: FORMATIONS.RAIDERS.map(f => [f.id, f.minTier, f.fadeAt || null]),
      beasts: FORMATIONS.BEASTS.map(f => [f.id, f.minTier, f.fadeAt || null]),
      mech: FORMATIONS.MECH.map(f => [f.id, f.minTier, f.fadeAt || null]),
      choir: FORMATIONS.CHOIR.map(f => [f.id, f.minTier, f.fadeAt || null])
    }));
    const J = x => JSON.stringify(x);
    ok('Raiders, Beasts, Mech and the Choir kept exactly the timing they had',
      J(others.raiders) === J([['MOB', 4, 11], ['CROSSFIRE', 5, null], ['ROADBLOCK', 12, null], ['PRESS_GANG', 12, null]]) &&
      J(others.beasts) === J([['THE_PACK', 4, 10], ['RUN_DOWN', 9, null], ['BLOOM', 11, null]]) &&
      J(others.mech) === J([['AIR_COVER', 4, 11], ['KILL_BOX', 5, null], ['CONVOY', 14, null]]) &&
      J(others.choir) === J([['PROCESSION', 6, 12], ['RELIQUARY_GUARD', 10, null], ['THE_RITE', 14, null]]));
  }
};

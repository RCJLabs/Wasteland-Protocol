// J04: E04 scaled defensive GRANTS by armourScale() and deliberately left BASE armour flat -
// the permanent plate baked into a unit's own line. Its reasoning is in 95-armour-scales: base
// armour subtracts from PLAYER damage, which grows through perks and upgrades rather than along
// the enemy curve, so scaling it by that curve would make the Bastion's 30 into 250 at sector
// seven against player hits in the low hundreds. It said so, left it flat, and filed the
// question of whether flat keeps pace.
//
// It had no instrument to answer with. hitLog holds the last 24 hits for the explain panel and
// nothing has ever aggregated them, so the question sat unanswered from E04 to here. Booked now,
// and the answer is the same shape E04 found for grants: player hits grow while the plate does
// not, so its share of a hit falls from about a third in sector one to a twentieth by sector
// seven. Nothing was retuned for it - that lands on the win-rate target I06 set, which is the
// owner's to move.
//
// Finding the ledger also turned up what the explain panel had been printing. mitigate computes
// the armour it subtracts - the unit's plate, plus ASHFALL's 2, plus 20 for a standing escort -
// and threw the figure away, and the panel printed `target.armor` in its place. The soaked TOTAL
// was always right; the breakdown under it credited the escort's plate to nobody. mitigate hands
// the figure back now.
//
// What is pinned here: the plate is flat where the hit is not, the number handed back is the one
// actually subtracted, and an escort's contribution reaches the panel. Read off the engine.
module.exports = {
  name: 'What the plate takes',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── mitigate hands back what it took, not the unit's own line ───────────────────
    const back = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentWeather = 'CLEAR'; currentTerrain = null;
      const a = playerRoster.find(c => c.gridPos > 0);
      const t = { id: 'p1', name: 'Plated', isPlayer: false, hp: 900, maxHp: 900, armor: 12,
                  resistances: { phys: 0, bio: 0, energy: 0 }, cooldowns: {},
                  stunnedTurns: 0, bleedingTurns: 0, oiledTurns: 0, corrodedTurns: 0, armorTurns: 0 };
      activeEntities = [t];
      const plain = mitigate(a, t, 100, 'phys', null);
      // An escort standing adds to what comes off, and it is the escort's plate that the panel
      // used to lose: target.armor never moved, so the extra 20 was subtracted and unexplained.
      const esc = { id: 'p2', name: 'Escort', isPlayer: false, hp: 50, maxHp: 50, armor: 0,
                    resistances: { phys: 0, bio: 0, energy: 0 }, cooldowns: {} };
      activeEntities = [t, esc];
      t.escortId = 'p2';
      const escorted = mitigate(a, t, 100, 'phys', null);
      return { own: t.armor, plainAc: plain.ac, plainN: plain.n,
               escAc: escorted.ac, escN: escorted.n };
    });
    ok(`mitigate reports the armour it subtracted (${back.plainAc} against a plate of ${back.own})`,
      back.plainAc === back.own);
    ok(`and 100 landed as ${back.plainN}, which is the hit less that armour`,
      back.plainN === 100 - back.plainAc);
    ok(`an escort adds to what comes off (${back.plainAc} alone, ${back.escAc} escorted)`,
      back.escAc > back.plainAc);
    ok(`and the escorted hit lands lower for it (${back.plainN} then ${back.escN})`,
      back.escN === 100 - back.escAc && back.escN < back.plainN);

    // ── Which is what the explain panel prints ─────────────────────────────────────
    // The bug was that the panel named the unit's own plate while a larger figure was taken.
    // Read back off the panel the engine renders, not off a number recomputed here.
    const panel = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentWeather = 'CLEAR'; currentTerrain = null;
      const a = playerRoster.find(c => c.gridPos > 0);
      const t = { id: 'p3', name: 'Plated', isPlayer: false, hp: 900, maxHp: 900, armor: 12,
                  resistances: { phys: 0, bio: 0, energy: 0 }, cooldowns: {},
                  stunnedTurns: 0, bleedingTurns: 0, oiledTurns: 0, corrodedTurns: 0, armorTurns: 0 };
      const esc = { id: 'p4', name: 'Escort', isPlayer: false, hp: 50, maxHp: 50, armor: 0,
                    resistances: { phys: 0, bio: 0, energy: 0 }, cooldowns: {} };
      activeEntities = [t, esc];
      t.escortId = 'p4';
      applyDamageHit(a, t, 100, 'phys', null);
      const h = hitLog[hitLog.length - 1];
      return { armor: h.armor, own: t.armor, soaked: h.soaked, raw: h.raw, net: h.net,
               html: explainHtml(hitLog.length - 1) };
    });
    ok(`the filed hit records the armour taken, not the unit's line (${panel.armor} against ${panel.own})`,
      panel.armor > panel.own);
    ok(`the panel names that figure (${(panel.html.match(/armour[^<]*/) || ['none'])[0]})`,
      panel.html.includes(`armour −${panel.armor}`));
    // The total was never the broken part, and it stays right: rolled less soaked is landed.
    ok(`and the arithmetic still reconciles (${panel.raw} − ${panel.soaked} = ${panel.net})`,
      panel.raw - panel.soaked === panel.net);

    // ── And when somebody steps in front, it is THEIR plate that is filed ──────────
    // A bond can put a different body in the way after the figure has been worked out, and the
    // engine re-runs it for whoever actually took the blow. The armour has to come back with
    // that re-run or the panel names the plate that stopped nothing - a regression this phase
    // introduced and only found by re-reading its own diff, because filed.armor used to be read
    // after the swap and was right by accident.
    const stepped = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentWeather = 'CLEAR'; currentTerrain = null;
      const line = playerRoster.filter(c => c.gridPos > 0);
      const mark = line[0], savior = line[1];
      if (!mark || !savior) return { skipped: true };
      // Two very different plates, so a stale figure cannot coincide with a fresh one.
      mark.armor = 3; savior.armor = 21;
      mark.hp = 5; mark.maxHp = 80; savior.hp = savior.maxHp = 400;
      const foe = { id: 'f1', name: 'Shooter', isPlayer: false, hp: 300, maxHp: 300, armor: 0,
                    resistances: { phys: 0, bio: 0, energy: 0 }, cooldowns: {} };
      activeEntities = [mark, savior, foe];
      bonds = {}; bonds[[mark.id, savior.id].sort().join('|')] = 99;
      bondSavesUsed = new Set();
      const before = { mark: mark.hp, savior: savior.hp };
      applyDamageHit(foe, mark, 60, 'phys', null);
      const h = hitLog[hitLog.length - 1];
      return { skipped: false, filedTarget: h.target, filedArmor: h.armor,
               markArmor: mark.armor, saviorArmor: savior.armor,
               markHp: mark.hp, saviorHp: savior.hp, before, saved: h.target === savior.name };
    });
    ok('there are two bodies on the line to test the hand-off with', !stepped.skipped);
    if (!stepped.skipped && stepped.saved) {
      ok(`the blow is filed against whoever took it (${stepped.filedTarget})`, stepped.saved);
      ok(`and the armour filed is theirs, not the one it was meant for (${stepped.filedArmor} against a mark plated ${stepped.markArmor})`,
        stepped.filedArmor === stepped.saviorArmor && stepped.filedArmor !== stepped.markArmor);
    } else if (!stepped.skipped) {
      // Never silently skip: if the bond did not fire, say so rather than passing on nothing.
      ok(`the bond put somebody in front of the blow (filed against ${stepped.filedTarget})`, false);
    }

    // ── The plate is flat where the hit it subtracts from is not ───────────────────
    // The identity E04's phase shipped, applied to the half it left: armourScale climbs and
    // base armour does not move with it. Asserted as a shape rather than a magnitude, the way
    // 95-armour-scales was rewritten to be after H13 went red on three baked literals.
    const flat = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      // Built through the engine's OWN curve. generateEnemies' second argument is the health
      // multiplier, not a count - passing 1 at both ends builds the same unit twice and proves
      // nothing, which is what a first draft of this did.
      const at = (s, t) => {
        currentSector = s; currentTier = t;
        // MECH, because its line is the one that carries plate - Drone 5, Turret 8, War Rig 10 -
        // and a faction with no armour anywhere would pass the claim below whatever the engine
        // did. Held at one tier across two sectors: minTier gates who is eligible, so moving the
        // tier as well would compare a different roster rather than the same one deeper in.
        const built = generateEnemies('MECH', fightMult(), false, fightDmgMult(), null);
        // Compared per TYPE, because the roll picks who turns up: the same line at both depths
        // or the armour column is comparing a Bastion against a Hound.
        const byType = {};
        built.forEach(u => { byType[u.type || u.name] = { armor: u.armor || 0, hp: u.maxHp, dmg: u.dmgBase }; });
        return { byType, scale: armourScale(), mult: fightMult() };
      };
      const one = at(1, 6), deep = at(7, 6);
      for (let i = 0; i < 12; i++) { Object.assign(one.byType, at(1, 6).byType); Object.assign(deep.byType, at(7, 6).byType); }
      // Roll until the same type has been seen at both ends, so there is something to compare.
      let shared = Object.keys(one.byType).filter(k => deep.byType[k]);
      for (let i = 0; i < 40 && !shared.length; i++) {
        const more = at(7, 6);
        Object.assign(deep.byType, more.byType);
        shared = Object.keys(one.byType).filter(k => deep.byType[k]);
      }
      return { one, deep, shared };
    });
    ok(`the same unit type turns up at both ends of the road (${flat.shared.join(', ') || 'none'})`,
      flat.shared.length > 0);
    // The shape, not the magnitude. A first draft asked for a doubling, which was the figure
    // from a tier-1-to-tier-10 comparison and went red the moment the tier was held still to
    // keep the roster comparable - the same way H13 turned three assertions in 95-armour-scales
    // red by retuning a curve none of them was written to catch. What the phase is about is
    // that one of these two moves and the other does not; the numbers print either way.
    ok(`the fight grows around it (mult ${flat.one.mult.toFixed(2)} then ${flat.deep.mult.toFixed(2)}, armourScale ${flat.one.scale.toFixed(2)} then ${flat.deep.scale.toFixed(2)})`,
      flat.deep.mult > flat.one.mult && flat.deep.scale > flat.one.scale);
    const grew = flat.shared.filter(k => flat.deep.byType[k].hp > flat.one.byType[k].hp);
    ok(`and that type's health grows with it (${flat.shared.map(k => `${k} ${flat.one.byType[k].hp}→${flat.deep.byType[k].hp}`).join(', ')})`,
      grew.length === flat.shared.length);
    // The claim itself. Only asserted over types that actually carry a plate - a unit with no
    // armour reads 0 at both ends and would pass this whatever the engine did to armour.
    const plated = flat.shared.filter(k => flat.one.byType[k].armor > 0);
    ok(`at least one of them carries a plate to compare (${plated.map(k => `${k} ${flat.one.byType[k].armor}`).join(', ') || 'none'})`,
      plated.length > 0);
    ok(`and base armour does not move with the fight (${plated.map(k => `${k} ${flat.one.byType[k].armor}→${flat.deep.byType[k].armor}`).join(', ')})`,
      plated.length > 0 && plated.every(k => flat.deep.byType[k].armor === flat.one.byType[k].armor));

    // ── And the same plate takes the same amount off, wherever the fight is ─────────
    // The row above reads what is STORED on the unit. That is not the claim: a build could
    // leave the stored figure alone and scale at subtraction time, and the row above would
    // still pass. Found by mutating exactly that - `t.armor * armourScale()` inside mitigate
    // survived the whole suite. What the phase is about is what comes OFF a hit, so that is
    // asked directly, through mitigate, with the plate and the hit held identical.
    const took = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentWeather = 'CLEAR'; currentTerrain = null;
      const a = playerRoster.find(c => c.gridPos > 0);
      const at = (s, t) => {
        currentSector = s; currentTier = t;
        const u = { id: 'q1', name: 'Plated', isPlayer: false, hp: 9000, maxHp: 9000, armor: 12,
                    resistances: { phys: 0, bio: 0, energy: 0 }, cooldowns: {},
                    stunnedTurns: 0, bleedingTurns: 0, oiledTurns: 0, corrodedTurns: 0, armorTurns: 0 };
        activeEntities = [u];
        return mitigate(a, u, 200, 'phys', null).ac;
      };
      return { one: at(1, 1), deep: at(7, 10) };
    });
    ok(`the same plate takes the same amount off at both ends of the road (s1 −${took.one}, s7 −${took.deep})`,
      took.deep === took.one);
  }
};

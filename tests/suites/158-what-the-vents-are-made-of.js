// L02. K08 found that the smog said "Bio DMG" and delivered a raw HP subtraction that never met
// mitigate, and it fixed the WEATHER table. It left three other in-combat paths to zero behind,
// and the L-audit's exhaustive sweep of nested spec objects turned up the sharpest possible
// evidence that one of them was never wired at all: the Vatborn's grudge declares
//
//     aura: { share: 0.06, type: 'bio', rank: 1 }
//
// and `aura.type` was read ZERO times in the whole file. `aura.rank` and `aura.share` both had
// readers; the damage type was written down once and consulted never. The other two were the
// Stormcaller's skyToll, whose log line is "The sky comes down on the squad", and the Hazmat
// capstone's vent, which is a set of chem tanks letting go.
//
// What made these a broken promise rather than an omission is the codex page K08 itself wrote:
// "The sky counts too. What falls out of it is damage of a type like anything else, and the same
// badge answers it", and "Your own three answer whatever is aimed at you." All three are aimed
// at somebody. None of the three met a badge.
//
// The mechanism rows below drive typedToll directly on bodies with nothing in the way. The
// WIRING rows drive the real engine paths - executeEnemyAi, turnTheSky, goDown - and read the
// damage-type ledger rather than HP, because those paths do other things on the same turn and
// the ledger is keyed by type. Nothing here recomputes what the damage ought to be: the share
// and the expected type are both read off the engine, which is what F03 was about.
module.exports = {
  name: 'What the vents are made of',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // L06: this suite shipped its own __bare and __clearField, which was the 112th copy of a
    // definition that should have had one. Both now come from tests/run.js, installed on every
    // page, and suite 159 holds them against what mitigate actually reads.
    await page.evaluate(() => {
      window.__bareBody = (over) => window.__dummy(Object.assign(
        { id: 'bare1', name: 'Bare', isPlayer: true, gridPos: 1, hp: 400, maxHp: 400,
          downTurns: 0, fallen: false }, over || {}));
      // The shared __clearField neutralises the ambient MITIGATIONS - sky, ground, relics,
      // bonds - and deliberately stops there. Starting a run and opening a fresh ledger is a
      // different concern and belongs to whichever suite needs it, which here is every row.
      window.__fresh = () => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        window.__clearField();
        runStats = newRunStats();
      };
    });

    // ── The mechanism: a type, a badge, and a floor ────────────────────────────────
    const mech = await page.evaluate(() => {
      window.__fresh();
      const one = (res, type) => {
        const t = window.__bareBody({ resistances: res });
        activeEntities = [t];
        const took = typedToll(t, 100, type, 'fct-status');
        return { took, left: t.hp };
      };
      return {
        open:    one({ phys: 0, bio: 0,   energy: 0 }, 'bio'),
        immune:  one({ phys: 0, bio: 100, energy: 0 }, 'bio'),
        partial: one({ phys: 0, bio: 55,  energy: 0 }, 'bio'),
        // The badge that answers a bio vent is the bio one and not either of the others.
        wrong:   one({ phys: 100, energy: 100, bio: 0 }, 'bio')
      };
    });
    ok(`a vent with nothing in the way lands whole (${mech.open.took} of 100)`, mech.open.took === 100);
    ok('a sealed body takes nothing at all from it', mech.immune.took === 0 && mech.immune.left === 400);
    ok(`a resistance blunts it rather than deleting it (bio 55 took ${mech.partial.took})`,
      mech.partial.took === 45 && mech.partial.took > 0);
    ok(`and the other two badges do not answer it (${mech.wrong.took} of 100)`, mech.wrong.took === 100);

    // A resistance bigger than the blow still leaves a mark: mitigate floors at 1, which is the
    // contract K08 gave the sky and the reason a cultist at bio 55 still chokes under smog.
    const floored = await page.evaluate(() => {
      window.__fresh();
      const t = window.__bareBody({ resistances: { phys: 0, bio: 90, energy: 0 } });
      activeEntities = [t];
      return typedToll(t, 20, 'bio', 'fct-status');
    });
    ok(`a resistance larger than the blow still leaves one (${floored})`, floored === 1);

    // ── The ledger sees it, which is the half K09 reads through ───────────────────
    const booked = await page.evaluate(() => {
      window.__fresh();
      const t = window.__bareBody({ resistances: { phys: 0, bio: 20, energy: 0 } });
      activeEntities = [t];
      typedToll(t, 100, 'bio', 'fct-status');
      const sealed = window.__bareBody({ id: 'bare2', resistances: { phys: 0, bio: 100, energy: 0 } });
      activeEntities.push(sealed);
      typedToll(sealed, 100, 'bio', 'fct-status');
      const row = ((runStats.dt || {}).atSquad || {}).bio || {};
      return { hits: row.hits, raw: row.raw, resisted: row.resisted, immune: row.immune || 0,
               types: Object.keys((runStats.dt || {}).atSquad || {}) };
    });
    ok(`the ledger books a vent as bio and nothing else (${booked.types.join(', ')})`,
      booked.types.length === 1 && booked.types[0] === 'bio');
    ok(`both ticks are on the row (${booked.hits} hits, ${booked.raw} raw)`,
      booked.hits === 2 && booked.raw === 200);
    ok(`and what the badges took off is on it too (${booked.resisted} soaked, ${booked.immune} immune)`,
      booked.resisted === 120 && booked.immune === 1);

    // ── WIRING 1: the Vatborn's vent reads its own declared field ─────────────────
    // The row that proves the fix rather than the mechanism. The aura's type is changed on the
    // spec and the ledger has to follow it; if the engine were hardcoded to bio - which is what
    // a plausible fix looks like from the outside - the energy arm would still book bio.
    const vat = await page.evaluate(() => {
      const run = (type) => {
        window.__fresh();
        const t = window.__bareBody({ gridPos: 1 });
        // dmgType phys on the boss, so whatever else the AI does this turn lands on another row
        // and the vent is the only thing that can be booked under its own type.
        const boss = { id: 'vat', name: 'Vatborn', isPlayer: false, classType: 'BOSS', range: 'melee',
                       hp: 900, maxHp: 900, armor: 0, baseArmor: 0, dmgBase: 10, dmgType: 'phys',
                       speed: 1, scale: 1, hpDrop: 0, sigCd: 0, plate: 0, venomStacks: 0,
                       resistances: { phys: 0, bio: 0, energy: 0 }, cooldowns: {},
                       stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0,
                       corrodedTurns: 0, markedTurns: 0,
                       aura: { share: 0.06, type: type, rank: 1 },
                       intent: { type: 'ATTACK', icon: '#' } };
        activeEntities = [t, boss]; turnQueue = [t, boss]; combatActive = true;
        executeEnemyAi(boss);
        const bag = (runStats.dt || {}).atSquad || {};
        return { booked: Object.keys(bag).filter(k => (bag[k].hits || 0) > 0),
                 raw: (bag[type] || {}).raw || 0, share: boss.aura.share, maxHp: t.maxHp };
      };
      return { bio: run('bio'), energy: run('energy') };
    });
    ok(`the vent books under the type its own spec declares (bio arm booked ${vat.bio.booked.join(', ')})`,
      vat.bio.booked.includes('bio'));
    ok(`and follows that field when it changes (energy arm booked ${vat.energy.booked.join(', ')})`,
      vat.energy.booked.includes('energy') && !vat.energy.booked.includes('bio'));
    ok(`for the share the spec names, not a number this test picked (${vat.bio.raw})`,
      vat.bio.raw === Math.floor(vat.bio.maxHp * vat.bio.share));

    // ── WIRING 2: the Stormcaller drops the sky it just turned to ─────────────────
    // The sky it turns to is PINNED, and this is the second thing this suite found. Written
    // against the live roll, the row read the expected type off the engine after the fact - which
    // is sound logic and useless as a test: mutation testing hardcoded the toll to 'phys' and all
    // 28 rows still passed, because the turn had landed on ION_STORM and ION_STORM is phys. Five
    // of six skies carry no type of their own, so an honest-looking row was one roll in six from
    // discriminating anything. That is the L06 defect, in the suite filed to complain about it.
    //
    // Pinned by computing the index off the engine's own list, so nothing here hard-codes the
    // contents or the order of WEATHER_IDS.
    const storm = await page.evaluate(() => {
      const turnTo = (want) => {
        window.__fresh();
        const t = window.__bareBody({ gridPos: 1 });
        const boss = { id: 'storm', name: 'Stormcaller', isPlayer: false, classType: 'BOSS',
                       hp: 900, maxHp: 900, armor: 0, skyToll: 0.05,
                       resistances: { phys: 0, bio: 0, energy: 0 } };
        activeEntities = [t, boss];
        const skies = WEATHER_IDS.filter(w => w !== currentWeather);
        const i = skies.indexOf(want);
        const orig = Math.random;
        Math.random = () => (i + 0.5) / skies.length;
        try { turnTheSky(boss); } finally { Math.random = orig; }
        const bag = (runStats.dt || {}).atSquad || {};
        const booked = Object.keys(bag).filter(k => (bag[k].hits || 0) > 0);
        return { asked: want, after: currentWeather, booked,
                 want: skyDamageType(currentWeather) || 'phys',
                 raw: (bag[booked[0]] || {}).raw || 0,
                 toll: Math.floor(t.maxHp * boss.skyToll) };
      };
      // One sky that carries a type of its own and one that does not, so the two arms have to
      // disagree - which is the thing a hardcoded type cannot do.
      const typed = WEATHER_IDS.find(id => skyDamageType(id));
      const bare  = WEATHER_IDS.find(id => !skyDamageType(id));
      return { typed: turnTo(typed), bare: turnTo(bare) };
    });
    ok(`the sky turns where it is sent (${storm.typed.asked} -> ${storm.typed.after})`,
      storm.typed.after === storm.typed.asked && storm.bare.after === storm.bare.asked);
    ok(`a sky with a type of its own lends it to the toll (${storm.typed.after} is ${storm.typed.want}, booked ${storm.typed.booked.join(', ')})`,
      storm.typed.booked.length === 1 && storm.typed.booked[0] === storm.typed.want);
    ok(`a sky with none leaves it physical (${storm.bare.after}, booked ${storm.bare.booked.join(', ')})`,
      storm.bare.booked.length === 1 && storm.bare.booked[0] === 'phys' && storm.bare.want === 'phys');
    ok(`so the two arms disagree, which a fixed type could not (${storm.typed.want} against ${storm.bare.want})`,
      storm.typed.want !== storm.bare.want);
    ok(`and both take the share the grudge names (${storm.typed.raw})`,
      storm.typed.raw === storm.typed.toll && storm.bare.raw === storm.bare.toll);

    // ── WIRING 3: the Hazmat's tanks ─────────────────────────────────────────────
    const tanks = await page.evaluate(() => {
      window.__fresh();
      const hz = playerRoster.find(c => c.gridPos > 0);
      hz.traits = (hz.traits || []).concat('CAP_DEAD_MANS_SWITCH');
      hz.hp = 0;
      const foe = (id, bio) => ({ id, name: 'Foe ' + id, isPlayer: false, classType: 'RAIDER',
        hp: 500, maxHp: 500, armor: 0, baseArmor: 0, plate: 0, venomStacks: 0, cooldowns: {},
        resistances: { phys: 0, bio: bio, energy: 0 }, stunnedTurns: 0, bleedingTurns: 0,
        armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0 });
      const open = foe('f1', 0), machine = foe('f2', 100);
      activeEntities = [hz, open, machine];
      goDown(hz);
      const bag = (runStats.dt || {}).atFoe || {};
      return { openTook: 500 - open.hp, machineTook: 500 - machine.hp,
               booked: Object.keys(bag).filter(k => (bag[k].hits || 0) > 0),
               want: Math.floor(500 * 0.15) };
    });
    ok(`the tanks let go over everything standing (${tanks.openTook})`, tanks.openTook === tanks.want);
    ok('a machine does not breathe, so it walks out of the cloud', tanks.machineTook === 0);
    ok(`and the vent is booked at the hostiles as bio (${tanks.booked.join(', ')})`,
      tanks.booked.length === 1 && tanks.booked[0] === 'bio');

    // ── One derivation for what a sky is made of ──────────────────────────────────
    // The codex page named the typed skies with an expression copied inline; the Stormcaller
    // needed the same answer, and two copies of a derivation are one drift away from disagreeing.
    const derived = await page.evaluate(() => {
      const typed = WEATHER_IDS.filter(id => skyDamageType(id));
      const page = CODEX.find(p => p.id === 'RESISTANCE').body().join(' ');
      return { typed: typed.map(id => ({ name: WEATHER[id].name, t: skyDamageType(id) })),
               named: typed.every(id => page.includes(`${WEATHER[id].name} is ${skyDamageType(id).toUpperCase()}`)),
               untypedNamed: WEATHER_IDS.filter(id => !skyDamageType(id))
                 .some(id => page.includes(`${WEATHER[id].name} is `)) };
    });
    ok(`the skies that carry a type carry one the engine can name (${derived.typed.map(x => `${x.name} ${x.t}`).join(', ')})`,
      derived.typed.length > 0);
    ok('and the manual names exactly those, off the same derivation', derived.named && !derived.untypedNamed);

    // ── M03: bleed goes through the door too, and the untyped bag is the tripwire ──
    // L03 booked bleed without changing it and left the typing question for the owner. Answered
    // yes: a bleed is a wound, the codex says "Armour subtracts from every hit", and phys is
    // what a wound is made of. These rows replace L03's, which asserted the opposite and failed
    // the moment the change landed - which is what they were for.
    const bleed = await page.evaluate(() => {
      const tick = (over) => {
        window.__fresh();
        const t = window.__bareBody(Object.assign({ maxHp: 400, hp: 400 }, over || {}));
        t.bleedingTurns = 3;
        activeEntities = [t];
        const before = t.hp;
        applyTurnStartEffects(t);
        const bag = (runStats.dt || {}).atSquad || {};
        return { took: before - t.hp,
                 typed: Object.keys(bag).filter(k => (bag[k].hits || 0) > 0),
                 raw: (bag.phys || {}).raw || 0,
                 untyped: Object.keys((runStats.ut || {}).atSquad || {}) };
      };
      return { open: tick(), armoured: tick({ armor: 10 }),
               sealed: tick({ resistances: { phys: 100, bio: 0, energy: 0 } }),
               share: Math.floor(400 * 0.08) };
    });
    ok(`a bleed is booked as a damage type now (${bleed.open.typed.join(', ')})`,
      bleed.open.typed.length === 1 && bleed.open.typed[0] === 'phys');
    ok(`and the raw figure is the share the engine names (${bleed.open.raw} of ${bleed.share})`,
      bleed.open.raw === bleed.share);
    ok(`armour subtracts from it, which is what the manual promised (${bleed.open.took} -> ${bleed.armoured.took})`,
      bleed.armoured.took === bleed.open.took - 10);
    ok(`and a body sealed against physical takes nothing from it (${bleed.sealed.took})`,
      bleed.sealed.took === 0 && bleed.open.took > 0);

    // THE TRIPWIRE. noteUntyped has no callers now, and that is the point: L03 built it to
    // measure a blind spot, M03 closed the only one it had, and the instrument stays so the
    // NEXT unledgered path shows up here instead of hiding. A function with no callers is dead
    // code; a function with no callers and a standing assertion that it stays that way is an
    // instrument. If this row ever goes red, something started reaching zero around the door.
    ok(`nothing reaches a bar without the ledger seeing it (${bleed.open.untyped.length} untyped source(s))`,
      bleed.open.untyped.length === 0 && bleed.armoured.untyped.length === 0);

    // ── No path back to a raw subtraction ─────────────────────────────────────────
    // Read off the source, in suite 157's idiom: the defect this suite exists for was a line of
    // arithmetic, and the way it comes back is somebody writing that line again.
    const src = await page.evaluate(async () => {
      const text = await (await fetch('game.js')).text();
      const near = (marker, span) => {
        const i = text.indexOf(marker);
        return i < 0 ? null : text.slice(i, i + span);
      };
      return {
        aura:  near('const burn = Math.max(1, Math.floor(t.maxHp * enemy.aura.share));', 240),
        toll:  near('const toll = Math.max(1, Math.floor(t.maxHp * enemy.skyToll));', 520),
        tanks: near("const vent = Math.max(1, Math.floor(e.maxHp * 0.15));", 320),
        tolls: (text.match(/typedToll\(/g) || []).length
      };
    });
    ok('the vent goes through the door', !!src.aura && /typedToll\(/.test(src.aura) && !/\.hp = Math\.max\(0/.test(src.aura));
    ok('so does the toll', !!src.toll && /typedToll\(/.test(src.toll) && !/\.hp = Math\.max\(0/.test(src.toll));
    ok('so do the tanks', !!src.tanks && /typedToll\(/.test(src.tanks) && !/\.hp = Math\.max\(0/.test(src.tanks));
    ok(`and there are exactly the three call sites plus the function itself (${src.tolls})`, src.tolls === 4);
  }
};

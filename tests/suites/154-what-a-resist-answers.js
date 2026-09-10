// K02: the player carries three resistance fields and two of them answered almost nothing.
// enemyStrike and every other enemy damage site read `enemy.dmgType || 'phys'`, and before this
// phase exactly three templates in the game set that field - the Carrion Matriarch, the Vatborn
// and the Stormcaller, all commanders. Every one of the rank and file swung physical. Measured
// with a per-type ledger over three 150-expedition careers, the squad met bio on 1.6% of the
// blows aimed at it and energy on 1.2%, while the hostiles met energy on 30% of the blows the
// squad threw and shrugged 61% off the bio ones. The system ran one direction.
//
// That left four pieces of shipped content answering nothing: the Gas Mask (+10 bio), the
// Insulated Coat (+10 energy), the HAZMAT perk Closed Circuit (+40 bio), and the bio 25 baked
// into the Hazmat Specialist's own line. The fix is data, not engine - the damage sites already
// read the field - so six rank-and-file templates now name what they throw: the three the
// bestiary already calls chemical (Chem Fiend, Censer Bearer, Blight Moth) throw bio, and the
// three powered machines (Drone, Turret, War Rig) throw energy.
//
// The second half was a label. The player's own resistances are printed in exactly ONE place in
// the whole game - the recruit card - and it printed `+25% bio` against arithmetic that
// subtracts flat. Gear says "+10 bio resist", the dossier says "RESISTS 10", the badges say
// "Resists bio"; the one surface a player reads their own line off was the one that lied about
// the units. It is quoted in the gear's vocabulary now.
//
// What is pinned here: the rank and file can throw something a resist answers, the arithmetic is
// flat rather than proportional, and the number on the card is the number the engine subtracts.
// Read off the engine - the pools, mitigate and the rendered card - never recomputed here.
module.exports = {
  name: 'What a resist answers',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── The census, off the live pools ──────────────────────────────────────────────
    const census = await page.evaluate(() => {
      const rank = Object.entries(ENEMY_POOL).flatMap(([f, list]) =>
        list.map(e => ({ faction: f, name: e.name, type: e.dmgType || 'phys', minTier: e.minTier,
                         sector: Math.max(unlockDepth(e.minTier).sector,
                                          (FACTIONS[f] && FACTIONS[f].minSector) || 1) })));
      const cmd = BOSS_POOL.map(b => ({ name: b.name, type: b.dmgType || 'phys' }));
      const known = DMG_TYPES.map(([t]) => t);
      const sizes = {};
      Object.entries(ENEMY_POOL).forEach(([f, list]) => { sizes[f] = list.length; });
      return { rank, cmd, known, sizes, totalTiers: TOTAL_TIERS, finalSector: FINAL_SECTOR };
    });
    const ENEMY_POOL_SIZES = census.sizes;
    const bad = census.rank.concat(census.cmd).filter(e => !census.known.includes(e.type));
    ok(`every template throws a type the badges know (${census.known.join('/')}; ${bad.length} stray)`,
      bad.length === 0);

    // The claim the phase was filed on: before this, the answer to "which of these is not phys"
    // was "none of them". Asserted per type, so losing either half fails.
    const byType = t => census.rank.filter(e => e.type === t);
    ok(`the rank and file throws bio (${byType('bio').map(e => e.name).join(', ') || 'nothing'})`,
      byType('bio').length > 0);
    ok(`and energy (${byType('energy').map(e => e.name).join(', ') || 'nothing'})`,
      byType('energy').length > 0);
    // Physical stays the overwhelming majority - the phase was about giving the other two axes
    // something, not about turning the game elemental. A build that flipped everything to bio
    // would pass the two rows above and is not what shipped.
    const phys = byType('phys').length, all = census.rank.length;
    ok(`and physical is still most of what walks (${phys} of ${all})`, phys > all / 2);

    // A source a player never reaches is a source that answers nothing. Depth read through the
    // engine's own unlockDepth AND the faction's own minSector - a first draft asked only the
    // tier, which put the Blight Moth in sector one when the Carrion do not turn up until two.
    const soonest = t => Math.min(...byType(t).map(e => e.sector));
    ok(`the first bio source is met with road left to walk (sector ${soonest('bio')} of ${census.finalSector})`,
      soonest('bio') < census.finalSector);
    ok(`and the first energy source too (sector ${soonest('energy')} of ${census.finalSector})`,
      soonest('energy') < census.finalSector);
    // A resistance that answers one unit in a fight is a coin flip on the roll. One answers a
    // FIGHT when a whole faction's line throws the same thing - which is what a trinket bought
    // at the Armory is being bought against.
    const whole = Object.entries(ENEMY_POOL_SIZES).filter(([f, n]) =>
      n > 1 && census.rank.filter(e => e.faction === f && e.type !== 'phys').length === n);
    ok(`a whole faction's line throws one thing, so a trinket answers a fight (${
      whole.map(([f, n]) => `${f} ${n}/${n} ${census.rank.find(e => e.faction === f).type}`).join(', ') || 'none'})`,
      whole.length > 0);

    // ── The arithmetic the label has to match: flat, not proportional ───────────────
    // Two different blow sizes against one resistance. A flat system takes the same NUMBER off
    // both; a proportional one takes the same SHARE. Asserting only the first would pass on a
    // build that took 10% of everything if the two blows happened to be equal, so both blows
    // and both readings are printed.
    const flat = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentWeather = 'CLEAR'; currentTerrain = null;
      const a = { id: 'r0', name: 'Swinger', isPlayer: false, hp: 10, maxHp: 10, cooldowns: {} };
      const dummy = rv => ({ id: 'r1', name: 'Subject', isPlayer: false, hp: 9000, maxHp: 9000,
        armor: 0, resistances: { phys: 0, bio: rv, energy: 0 }, cooldowns: {},
        stunnedTurns: 0, bleedingTurns: 0, oiledTurns: 0, corrodedTurns: 0, armorTurns: 0 });
      const hit = (rv, dmg) => { const t = dummy(rv); activeEntities = [t]; return mitigate(a, t, dmg, 'bio', null); };
      return { small: hit(10, 50), big: hit(10, 200),
               immune: hit(100, 200), weak: hit(-10, 200), none: hit(0, 200) };
    });
    ok(`the same resistance takes the same amount off two different blows (50 landed ${flat.small.n}, 200 landed ${flat.big.n})`,
      50 - flat.small.n === 200 - flat.big.n);
    ok(`which is not the same share of them (${((50 - flat.small.n) / 50 * 100).toFixed(0)}% of the small, ${((200 - flat.big.n) / 200 * 100).toFixed(0)}% of the large)`,
      (50 - flat.small.n) / 50 !== (200 - flat.big.n) / 200);
    ok(`a hundred and over is a wall, not a subtraction (200 landed ${flat.immune.n})`,
      flat.immune.n === 0);
    ok(`and a negative reading adds to the blow (${flat.none.n} unresisted, ${flat.weak.n} weak)`,
      flat.weak.n > flat.none.n);

    // ── The card names the figure the engine subtracts ──────────────────────────────
    // The bug was a percent sign on a flat number, and 100 is the one blow size where the two
    // readings coincide - so the comparison is made at 200, where a share and a subtraction
    // cannot be confused for each other.
    const card = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentWeather = 'CLEAR'; currentTerrain = null;
      // The recruit whose line carries the largest resistance in the game, so the figure on the
      // card is unmistakable and a rounding coincidence cannot pass this.
      const tpl = RECRUIT_POOL.filter(t => t.resistances)
        .sort((x, y) => Math.max(...Object.values(y.resistances)) - Math.max(...Object.values(x.resistances)))[0];
      const [type, value] = Object.entries(tpl.resistances).sort((x, y) => y[1] - x[1])[0];
      const html = recruitCardHtml(tpl);
      // A hostile attacker, so BROAD_SPECTRUM cannot ease the reading, and a hostile body, so
      // the relics that only soften player hits cannot either. What is being asked is what the
      // resistance itself is worth, with nothing else in the way.
      const a = { id: 'r3', name: 'Swinger', isPlayer: false, hp: 10, maxHp: 10, cooldowns: {} };
      const body = { id: 'r2', name: tpl.name, isPlayer: false, hp: 9000, maxHp: 9000, armor: 0,
        resistances: { ...tpl.resistances }, cooldowns: {},
        stunnedTurns: 0, bleedingTurns: 0, oiledTurns: 0, corrodedTurns: 0, armorTurns: 0 };
      activeEntities = [body];
      const landed = mitigate(a, body, 200, type, null).n;
      // The gear that sells a resistance, so the card's wording can be checked against the
      // vocabulary the game already uses rather than against a phrase this test invented.
      const sold = (GEAR_POOL.find(g => /resist/.test(g.desc)) || {}).desc || '';
      return { name: tpl.name, type, value, html, took: 200 - landed, sold,
               res: (html.match(/class="recruit-res">([^<]*)</) || [null, ''])[1] };
    });
    ok(`the card carries a resistance line for ${card.name} (${card.res || 'nothing'})`,
      card.res.length > 0);
    ok(`the engine takes ${card.took} off a 200 ${card.type} blow, and the card quotes ${card.value}`,
      card.took === card.value);
    ok(`so the line names a subtraction, not a share (${card.res})`,
      !/\d\s*%/.test(card.res));
    ok(`in the words the gear that sells one already uses (${card.sold || 'none'})`,
      /resist/.test(card.sold) && !/%/.test(card.sold) && card.res.includes(`${card.type} resist`));

    // ── And the type survives the spawn path ────────────────────────────────────────
    // A field set on a template is worth nothing if the unit built from it drops it. The pools
    // are rolled, so this rolls until the faction has fielded every one of its own names rather
    // than asserting on a single draw.
    const spawned = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const seen = {};
      const want = f => ENEMY_POOL[f].filter(e => e.dmgType).map(e => e.name);
      const roll = f => {
        currentSector = 7; currentTier = 10;
        generateEnemies(f, fightMult(), false, fightDmgMult(), null)
          .forEach(u => { seen[u.name] = u.dmgType || 'phys'; });
      };
      for (let i = 0; i < 200; i++) { roll('MECH'); roll('CHOIR'); roll('CARRION'); roll('BEASTS'); }
      const named = [].concat(want('MECH'), want('CHOIR'), want('CARRION'), want('BEASTS'));
      const templ = {};
      Object.values(ENEMY_POOL).flat().forEach(e => { templ[e.name] = e.dmgType || 'phys'; });
      return { named, fielded: named.filter(n => seen[n]),
               kept: named.filter(n => seen[n] && seen[n] === templ[n]), seen };
    });
    // Every one of them, not "at least one": with one fielded the row below is trivially true,
    // which is the vacuous-assertion shape this file has been bitten by twice. 200 rolls a
    // faction against a pool of three to four names leaves no realistic room for a miss.
    ok(`the roll fielded every template that names a type (${spawned.fielded.length} of ${spawned.named.length}${
      spawned.named.filter(n => !spawned.seen[n]).length ? `; missing ${spawned.named.filter(n => !spawned.seen[n]).join(', ')}` : ''})`,
      spawned.fielded.length === spawned.named.length && spawned.named.length > 0);
    ok(`and every one of them arrived carrying it (${spawned.fielded.map(n => `${n} ${spawned.seen[n]}`).join(', ')})`,
      spawned.kept.length === spawned.fielded.length);

    // ── The blow is thrown as that type, and the ledger books it as one ─────────────
    // Driven through the engine's own enemy turn, not by handing applyDamageHit a type this
    // test chose - that would assert the test's own argument back at itself. executeEnemyAi is
    // where `enemy.dmgType || 'phys'` is actually read, so that is the path taken.
    const thrown = await page.evaluate(() => {
      const swing = type => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 4; currentTier = 8;
        currentWeather = 'CLEAR'; currentTerrain = null;
        initiateCombat('MECH', false);
        currentWeather = 'CLEAR'; currentTerrain = null;
        activeEntities = activeEntities.filter(e => e.isPlayer);
        turnQueue = turnQueue.filter(e => e.isPlayer);
        activeEntities.forEach(p => { p.maxHp = 99999; p.hp = 99999; p.guardTurns = 0;
                                      p.resistances = { phys: 0, bio: 0, energy: 0 }; });
        const spec = Object.values(ENEMY_POOL).flat().find(e => e.dmgType === type);
        const foe = { ...JSON.parse(JSON.stringify(spec)), id: 'k2foe', isPlayer: false,
                      hp: 400, maxHp: 400, baseArmor: spec.armor || 0, sigCd: 0,
                      intent: { type: 'ATTACK', icon: 'x' } };
        activeEntities.push(foe); turnQueue.push(foe);
        runStats = newRunStats();
        hitLog.length = 0;
        executeEnemyAi(foe);
        combatActive = false;
        const h = hitLog[hitLog.length - 1];
        return { spec: spec.name, declared: spec.dmgType, filed: h && h.atkType,
                 dt: JSON.parse(JSON.stringify(runStats.dt || {})) };
      };
      return { bio: swing('bio'), energy: swing('energy') };
    });
    ['bio', 'energy'].forEach(t => {
      const r = thrown[t];
      ok(`${r.spec} throws what its line says it throws (declared ${r.declared}, filed ${r.filed})`,
        r.filed === r.declared);
      ok(`and the ledger books that blow under that type (${JSON.stringify(r.dt.atSquad || {})})`,
        !!(r.dt.atSquad && r.dt.atSquad[r.declared] && r.dt.atSquad[r.declared].hits > 0));
    });

    // ── The ledger books both directions, and keeps the resisted part separate ──────
    // A single bag would report "the squad met bio" and "the squad threw bio" as one number.
    const ledger = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentWeather = 'CLEAR'; currentTerrain = null;
      runStats = newRunStats();
      const mark = playerRoster.find(c => c.gridPos > 0);
      mark.hp = mark.maxHp = 9000;
      mark.resistances = { phys: 0, bio: 30, energy: 0 };
      const foe = { id: 'f8', name: 'Subject', isPlayer: false, hp: 9000, maxHp: 9000, armor: 0,
                    resistances: { phys: 0, bio: 40, energy: 0 }, cooldowns: {},
                    stunnedTurns: 0, bleedingTurns: 0, oiledTurns: 0, corrodedTurns: 0, armorTurns: 0 };
      activeEntities = [mark, foe];
      applyDamageHit(foe, mark, 200, 'bio', 'BASIC');
      applyDamageHit(mark, foe, 200, 'bio', 'BASIC');
      // A wall and a seam, on a blow far smaller than the readings themselves - which is the
      // case the first draft of the ledger got wrong: it booked the resistance's face value,
      // so an immunity put 100 against a 30-point hit and the report read back more than the
      // blow had ever been worth.
      foe.resistances = { phys: 0, bio: 100, energy: 0 };
      applyDamageHit(mark, foe, 30, 'bio', 'BASIC');
      foe.resistances = { phys: 0, bio: -20, energy: 0 };
      applyDamageHit(mark, foe, 30, 'bio', 'BASIC');
      return { dt: JSON.parse(JSON.stringify(runStats.dt)), doctrine: activeDoctrine };
    });
    // BROAD_SPECTRUM eases a hostile's resistance by 10 for player attackers, which would make
    // every figure below read 10 light. A fresh run holds nothing; said out loud so a change to
    // that fails here rather than quietly shifting the numbers this row asserts.
    ok(`the run holds no doctrine that could ease the reading (${ledger.doctrine || 'none'})`,
      !ledger.doctrine);
    ok(`the two directions are booked apart (at the squad ${ledger.dt.atSquad.bio.raw}, at the hostiles ${ledger.dt.atFoe.bio.raw})`,
      ledger.dt.atSquad.bio.hits === 1 && ledger.dt.atFoe.bio.hits === 3);
    ok(`and each keeps what the resistance took (squad ${ledger.dt.atSquad.bio.resisted} of ${ledger.dt.atSquad.bio.raw})`,
      ledger.dt.atSquad.bio.resisted === 30);
    // 40 off the first, the whole 30 off the immune one, nothing off the weakness: 70.
    ok(`an immunity is booked as the blow it stopped, never as its own face value (${ledger.dt.atFoe.bio.resisted} off ${ledger.dt.atFoe.bio.raw})`,
      ledger.dt.atFoe.bio.resisted === 70 && ledger.dt.atFoe.bio.resisted < ledger.dt.atFoe.bio.raw);
    ok(`the wall and the seam are counted apart (${ledger.dt.atFoe.bio.immune} stopped dead, ${ledger.dt.atFoe.bio.weak} on a weakness)`,
      ledger.dt.atFoe.bio.immune === 1 && ledger.dt.atFoe.bio.weak === 1);


    // ── And what the answer to it is worth ─────────────────────────────────────────
    // The point of the phase is not that bio and energy now land - it is that a player can DO
    // something about it. Four pieces of shipped content were the answer to a question nobody
    // was being asked: the Gas Mask, the Insulated Coat, the HAZMAT perk Closed Circuit, and
    // the bio 25 baked into the Hazmat's own line. Measured against a real blow, built by the
    // engine's own curve at a real depth, rather than against a number chosen here.
    const worth = await page.evaluate(() => {
      const at = (sector, tier) => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = sector; currentTier = tier;
      currentWeather = 'CLEAR'; currentTerrain = null;
      // A real bio thrower and a real energy thrower, at the depth the trinkets are bought at,
      // swinging what the engine says they swing.
      const build = name => {
        const spec = Object.values(ENEMY_POOL).flat().find(e => e.name === name);
        const u = { ...JSON.parse(JSON.stringify(spec)), id: 'w_' + name, isPlayer: false,
                    maxHp: Math.floor(spec.maxHp * fightMult()), hp: 9000,
                    dmgBase: Math.floor(spec.dmgBase * fightDmgMult()), sigCd: 0, cooldowns: {} };
        // Its ordinary swing AND its heavy one. Reading only the ordinary swing would have let
        // the rows below claim a trinket shuts a unit out, when the turn that actually hurts is
        // the one that comes in at 1.5x.
        return { u, raw: enemyStrike(u, { type: 'ATTACK' }),
                 heavy: enemyStrike(u, { type: 'HEAVY' }) };
      };
      const censer = build('Censer Bearer'), turret = build('Turret');
      const mark = playerRoster.find(c => c.gridPos > 0);
      const woreSomething = !!mark.trinket;
      mark.hp = mark.maxHp = 9000;
      mark.resistances = { phys: 0, bio: 0, energy: 0 };
      activeEntities = [mark, censer.u, turret.u];
      const land = (src, key) => mitigate(src.u, mark, src[key], src.u.dmgType || 'phys', 'BASIC').n;
      const read = () => ({ bio: land(censer, 'raw'), bioHeavy: land(censer, 'heavy'),
                            energy: land(turret, 'raw'), energyHeavy: land(turret, 'heavy') });
      const bare = read();
      // Bought and worn through the engine's own path, so what moves is what the shop sells.
      gearStash = gearStash.concat(['GAS_MASK']);
      equipGear(mark.id, 'GAS_MASK');
      const masked = { ...read(), res: { ...mark.resistances } };
      // And the perk on top. assignPerk is class-gated and wants a banked point on a signed
      // HAZMAT, which is a recruit rather than one of the seven - so the pool entry's OWN apply
      // is called instead. That is still the engine's function and not a copy of its arithmetic,
      // which is the part that matters: a test that re-adds 40 itself proves nothing.
      const cc = SIG_PERKS.find(p => p.id === 'CLOSED_CIRCUIT');
      cc.apply(mark);
      const sealed = { ...read(), res: { ...mark.resistances } };
      return { woreSomething, bioRaw: censer.raw, bioHeavyRaw: censer.heavy,
               energyRaw: turret.raw, bare, masked, sealed,
               maskDesc: gearById('GAS_MASK').desc, ccDesc: cc.desc,
               coatDesc: gearById('INSULATED_COAT').desc };
      };
      // Two depths, because a flat subtraction is worth a different share of a growing blow -
      // which is the whole reason the codex now says it is flat. Reading one depth would have
      // let the phase quote whichever share flattered it.
      return { near: at(2, 5), deep: at(7, 10) };
    });
    const near = worth.near, deep = worth.deep;
    ok(`a bio thrower swings ${near.bioRaw} where the Choir first stands and ${deep.bioRaw} at the end of the road`,
      near.bioRaw > 0 && deep.bioRaw > near.bioRaw && !near.woreSomething);
    // A flat 10 against a growing blow: worth a third of it early and a tenth of it late. Both
    // shares are printed, so the phase cannot be read as claiming the trinket keeps pace.
    const off = r => r.bare.bio - r.masked.bio;
    ok(`the Gas Mask (${near.maskDesc}) takes ${off(near)} off either — ${(off(near) / near.bioRaw * 100).toFixed(0)}% of the early blow, ${(off(deep) / deep.bioRaw * 100).toFixed(0)}% of the late one`,
      off(near) === 10 && off(deep) === 10 && off(near) / near.bioRaw > 0.05);
    // The half that makes it a decision rather than a strictly-better hat: the answer to one
    // faction is not the answer to another, and both are sold from the same slot.
    ok(`and nothing at all off an energy blow (${deep.bare.energy} bare, ${deep.masked.energy} masked)`,
      deep.masked.energy === deep.bare.energy && near.masked.energy === near.bare.energy);
    ok(`the coat that answers that instead is sold from the same slot (${near.coatDesc})`,
      /energy/.test(near.coatDesc));
    // Closed Circuit is +40 against blows of 24 and 78, so early it is worth the whole blow
    // and the engine's own floor of 1 is what lands; late it is worth the 40 it says.
    ok(`Closed Circuit (${near.ccDesc}) stacks on the mask: ${near.masked.bio} to ${near.sealed.bio} early, ${deep.masked.bio} to ${deep.sealed.bio} late`,
      near.sealed.bio < near.masked.bio && deep.sealed.bio < deep.masked.bio);
    ok(`early the pair take the blow to the floor a hit can never go under (${near.sealed.bio} of ${near.bioRaw})`,
      near.sealed.bio === 1);
    // An ordinary swing from this unit never grows past the 50 the pair subtract, so at both
    // depths the ordinary turn is shut out entirely. The heavy turn is not, which is the honest
    // half: the answer buys the routine turns and blunts the dangerous one.
    ok(`its ordinary swing never outgrows what the pair subtract (${near.bioRaw} early, ${deep.bioRaw} late, against 50)`,
      near.sealed.bio === 1 && deep.sealed.bio === 1 && deep.bioRaw < 50);
    ok(`its heavy turn does (${deep.bioHeavyRaw} raw, ${deep.bare.bioHeavy} bare, ${deep.sealed.bioHeavy} sealed)`,
      deep.bioHeavyRaw > 50 && deep.sealed.bioHeavy > 1
      && deep.bare.bioHeavy - deep.sealed.bioHeavy === 50);

    // ── The file on a hostile says what it throws ───────────────────────────────────
    // The dossier answered "what does my damage do to this" and never the other direction,
    // which is the half a trinket is bought against. Checked over every name the Archive
    // lists, so a unit added later without a type still reads as physical rather than blank.
    const files = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const pool = {};
      Object.values(ENEMY_POOL).flat().forEach(e => { pool[e.name] = e.dmgType || 'phys'; });
      BOSS_POOL.forEach(b => { pool[b.name] = b.dmgType || 'phys'; });
      return bestiaryRoster().map(r => {
        const html = dossierHtml(r.name);
        const sub = (html.match(/class="dossier-sub">([^<]*)</) || [null, ''])[1];
        return { name: r.name, said: (sub.match(/THROWS (\w+)/) || [null, null])[1],
                 pool: pool[r.name] || null };
      });
    });
    const silent = files.filter(f => !f.said);
    ok(`every file names what its subject throws (${files.length} files, ${silent.length} silent)`,
      files.length > 0 && silent.length === 0);
    const wrong = files.filter(f => f.pool && (f.said || '').toLowerCase() !== f.pool);
    ok(`and names the one the pool gives it (${wrong.map(f => `${f.name} said ${f.said} is ${f.pool}`).join(', ') || 'none wrong'})`,
      wrong.length === 0);
    const nonPhys = files.filter(f => f.said && f.said !== 'PHYS');
    ok(`the ones that throw something else are named as such (${nonPhys.map(f => `${f.name} ${f.said}`).join(', ')})`,
      nonPhys.length > 0);

    // ── And the codex says what the arithmetic is ───────────────────────────────────
    // The entry described the badges qualitatively and never said resistance subtracts, which
    // is the fact the card's percent sign contradicted. It reads the live pools for the second
    // half, so it cannot describe a bestiary the game no longer has.
    const codex = await page.evaluate(() => {
      const e = CODEX.find(c => c.id === 'RESISTANCE');
      const lines = e.body();
      const carriers = Object.values(ENEMY_POOL).flat().filter(x => x.dmgType).map(x => x.name);
      return { lines, carriers };
    });
    // Not just /subtract/: the armour line has said that since the entry was written, so a
    // first draft of this row passed against the entry it was meant to catch. What was missing
    // is that a resistance takes a FLAT number rather than a SHARE - the fact the card's percent
    // sign denied - so both words are required, on one line, about resistance.
    const arith = codex.lines.find(l => /resist/i.test(l) && /flat/i.test(l) && /share/i.test(l));
    ok(`the codex says a resistance takes a flat number rather than a share (${arith || 'nothing'})`,
      !!arith);
    ok(`and names what throws something other than physical (${codex.carriers.length} carriers)`,
      codex.carriers.length > 0 && codex.carriers.every(n => codex.lines.some(l => l.includes(n))));
  }
};

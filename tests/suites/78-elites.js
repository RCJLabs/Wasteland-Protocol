// An elite node is the game's designated harder fight, and it was not one. Measured over 178
// visits a squad wiped on an elite exactly 0 times; with the simulator repaired at D07 so it
// could brace, 3 in 190. The reason was in the numbers rather than in the idea: an elite rolled
// one of three affixes at 60% a unit, and one of those three handed out +30 health and +15
// armour FLAT - figures tuned when a unit carried about 70 health. Everything else in the game
// scales, so by sector five the same unit carries 234 and ARMORED was worth a third of what it
// had been. The designated hard fight got softer the deeper you went.
//
// The queue's other two options - raising tiers 5-9, or charging more for depth - were both
// rejected off prior art rather than taste: every non-boss fight has an exit that is never
// lethal, so lethality in the corridor buys withdrawals rather than deaths, and the retry-cost
// experiment recorded above regroupSquad was built, measured and reverted because those nine
// tiers ARE the levelling curve.
//
// So what this suite holds is the teeth budget: that an affix keeps its weight at any depth,
// that a node fields exactly one champion, and that each affix does the thing its own
// description promises - because a description nobody checks is how ARMORED decayed unnoticed.
module.exports = {
  name: 'Elites with teeth',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── The table ────────────────────────────────────────────────────────────────────────
    const table = await page.evaluate(() => ({
      ids: ELITE_AFFIXES.map(a => a.id),
      names: ELITE_AFFIXES.map(a => a.name),
      descs: ELITE_AFFIXES.map(a => a.desc),
      applies: ELITE_AFFIXES.map(a => typeof a.apply),
      byId: ELITE_AFFIXES.map(a => !!affixById(a.id)),
      missing: affixById('NOT_AN_AFFIX')
    }));
    ok(`${table.ids.length} affixes, in one table (${table.ids.join(', ')})`, table.ids.length >= 4);
    ok('no two affixes share an id', new Set(table.ids).size === table.ids.length);
    ok('every affix is named and described', table.names.every(Boolean) && table.descs.every(d => d && d.length > 12));
    ok('every affix carries an apply, so the table is the whole story', table.applies.every(t => t === 'function'));
    ok('affixById finds each of them and nothing else', table.byId.every(Boolean) && table.missing === null);

    // ── The affix keeps its weight at depth. This is the defect. ─────────────────────────
    // ARMORED is applied to the same unit at sector-1 scale and at a deep-sector scale. What
    // has to match is the SHARE it adds, not the number: a flat bonus passes the first reading
    // and fails the second, which is exactly how this went unnoticed for so long.
    const scale = await page.evaluate(() => {
      const dummy = (hp, dmg) => ({ maxHp: hp, hp: hp, armor: 0, baseArmor: 0, dmgBase: dmg, speed: 10 });
      const armored = affixById('ARMORED');
      const shallow = dummy(70, 12);  armored.apply(shallow, 1, 1);
      const deep    = dummy(420, 72); armored.apply(deep, 6, 6);
      return {
        shallowHpShare: shallow.maxHp / 70, deepHpShare: deep.maxHp / 420,
        shallowArmor: shallow.armor, deepArmor: deep.armor,
        hpTracks: shallow.hp === shallow.maxHp && deep.hp === deep.maxHp,
        baseArmorSet: shallow.baseArmor === shallow.armor
      };
    });
    ok(`ARMORED adds the same share of health at either depth (${scale.shallowHpShare.toFixed(2)}x vs ${scale.deepHpShare.toFixed(2)}x)`,
       Math.abs(scale.shallowHpShare - scale.deepHpShare) < 0.02 && scale.shallowHpShare > 1.2);
    ok(`ARMORED's plate scales with what the player hits for (${scale.shallowArmor} -> ${scale.deepArmor})`,
       scale.deepArmor > scale.shallowArmor * 4);
    ok('an up-armoured unit arrives at full health, not wounded by its own affix', scale.hpTracks);
    ok('baseArmor follows armor, so a stripped unit re-plates to the affixed figure', scale.baseArmorSet);

    const frenzy = await page.evaluate(() => {
      const u = { maxHp: 100, hp: 100, armor: 0, dmgBase: 20, speed: 10 };
      affixById('FRENZIED').apply(u, 3, 3);
      return { dmg: u.dmgBase, spd: u.speed, hp: u.maxHp };
    });
    ok(`FRENZIED multiplies damage rather than adding to it (20 -> ${frenzy.dmg})`, frenzy.dmg === 28);
    ok('FRENZIED is faster', frenzy.spd === 14);
    ok('FRENZIED does not touch health', frenzy.hp === 100);

    // ── One champion a node, and it is carrying two different things ─────────────────────
    const nodes = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null; activeRelics = [];
      currentSector = 3; currentTier = 7;
      const runs = [];
      for (let i = 0; i < 60; i++) {
        const squad = generateEnemies('RAIDERS', 3, true, 3, null);
        runs.push({
          size: squad.length,
          worn: squad.map(u => affixesOn(u)),
          names: squad.map(u => u.name)
        });
      }
      const plain = [];
      for (let i = 0; i < 40; i++) plain.push(generateEnemies('RAIDERS', 3, false, 3, null).map(u => affixesOn(u)));
      return { runs, plain };
    });

    const champCounts = nodes.runs.map(r => r.worn.filter(w => w.length > 1).length);
    ok(`every elite node fields exactly one champion (${new Set(champCounts).size === 1 ? champCounts[0] : champCounts.join(',')} across ${nodes.runs.length} nodes)`,
       champCounts.every(c => c === 1));
    const champs = nodes.runs.flatMap(r => r.worn.filter(w => w.length > 1));
    ok('a champion carries exactly two affixes', champs.every(w => w.length === 2));
    ok('and never the same one twice', champs.every(w => w[0] !== w[1]));
    ok('an ordinary node arms nobody', nodes.plain.every(r => r.every(w => w.length === 0)));

    const affixedShare = nodes.runs.flatMap(r => r.worn).filter(w => w.length).length
                       / nodes.runs.flatMap(r => r.worn).length;
    ok(`most of an elite node is armed, but not all of it - that is what IRONSIDE buys (${Math.round(affixedShare * 100)}%)`,
       affixedShare > 0.6 && affixedShare < 1);

    const wornSeen = new Set(nodes.runs.flatMap(r => r.worn).flat());
    ok(`all ${table.ids.length} affixes actually get handed out (${[...wornSeen].sort().join(', ')})`,
       table.ids.every(id => wornSeen.has(id)));

    // ── The name a champion writes is still a name the file can be found under ───────────
    const naming = await page.evaluate(() => {
      const one = { eliteType: 'FRENZIED', eliteTypes: ['FRENZIED'], name: '*FRENZIED* Raider' };
      const two = { eliteType: 'FRENZIED', eliteTypes: ['FRENZIED', 'ARMORED'], name: '*FRENZIED ARMORED* Raider' };
      const bare = { name: 'Raider' };
      return { one: typeNameOf(one), two: typeNameOf(two), bare: typeNameOf(bare),
               found: !!bestiaryRecord(typeNameOf(two)) };
    });
    ok('a single affix is stripped off the name', naming.one === 'Raider');
    ok(`a champion's double prefix is stripped too (${naming.two})`, naming.two === 'Raider');
    ok('an unaffixed hostile is left alone', naming.bare === 'Raider');
    ok('so a champion still resolves to a species file', naming.found);

    // ── What it does on contact ──────────────────────────────────────────────────────────
    const contact = await page.evaluate(() => {
      const stage = (affixes) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null; activeRelics = [];
        initiateCombat('RAIDERS', false);
        const hero = playerRoster.find(h => h.gridPos > 0);
        const foe = activeEntities.find(e => !e.isPlayer);
        hero.maxHp = 9999; hero.hp = 9999; hero.bleedingTurns = 0; hero.traits = []; hero.augments = [];
        foe.eliteTypes = affixes; foe.eliteType = affixes[0];
        foe.maxHp = 1000; foe.hp = 500; foe.dmgBase = 40; foe.armor = 0;
        activeEntities = [hero, foe]; turnQueue = [foe, hero];
        activeIndex = 0; combatActive = true; pendingAction = null;
        return { hero, foe };
      };
      const out = {};
      // VAMPIRIC: the striker is healed by what it lands.
      let s = stage(['VAMPIRIC']);
      s.foe.intent = { type: 'ATTACK', icon: '' };
      const vBefore = s.foe.hp; executeEnemyAi(s.foe);
      out.vampiricGained = s.foe.hp - vBefore;
      out.vampiricHurtSomebody = s.hero.hp < 9999;
      // SEPTIC: the target is left bleeding.
      s = stage(['SEPTIC']);
      s.foe.intent = { type: 'ATTACK', icon: '' };
      executeEnemyAi(s.foe);
      out.septicBleed = s.hero.bleedingTurns;
      // A plain hostile does neither.
      s = stage([]);
      s.foe.eliteTypes = []; s.foe.eliteType = null;
      s.foe.intent = { type: 'ATTACK', icon: '' };
      const pBefore = s.foe.hp; executeEnemyAi(s.foe);
      out.plainGained = s.foe.hp - pBefore;
      out.plainBleed = s.hero.bleedingTurns;
      return out;
    });
    ok(`a VAMPIRIC hostile hit somebody (${contact.vampiricHurtSomebody})`, contact.vampiricHurtSomebody);
    ok(`VAMPIRIC heals off the hit it landed (+${contact.vampiricGained})`, contact.vampiricGained > 0);
    ok(`SEPTIC leaves the wound bleeding (${contact.septicBleed} turns)`, contact.septicBleed >= 2);
    ok('an unaffixed hostile heals off nothing', contact.plainGained <= 0);
    ok('and leaves no bleed of its own', contact.plainBleed === 0);

    // ── The player can read what is standing there ───────────────────────────────────────
    const card = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      initiateCombat('RAIDERS', false);
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.eliteTypes = ['FRENZIED', 'ARMORED']; foe.eliteType = 'FRENZIED';
      foe.name = '*FRENZIED ARMORED* ' + foe.name;
      openDossier(foe.id);
      const el = document.getElementById('dossier');
      // Both readings are taken while the card is still open: closeDossier() below sets the
      // display back, and an object literal is built at the `return`, not where it is written.
      const html = el ? el.innerHTML : '';
      const shown = !!el && el.style.display !== 'none';
      closeDossier();
      return {
        html, shown,
        hasFrenzied: html.includes('FRENZIED'),
        hasArmored: html.includes('ARMORED'),
        hasChampion: html.includes('CHAMPION'),
        carriesDesc: ELITE_AFFIXES.filter(a => ['FRENZIED', 'ARMORED'].includes(a.id))
                                  .every(a => html.includes(a.desc))
      };
    });
    ok('the dossier opens on an affixed hostile', card.shown);
    ok('it names both of a champion’s affixes', card.hasFrenzied && card.hasArmored);
    ok('and says it is a champion', card.hasChampion);
    ok('and prints what each affix actually does, which nothing did before', card.carriesDesc);

    // ── The turn strip says who, not what they are wearing ──────────────────────────────
    const queue = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      initiateCombat('RAIDERS', false);
      const foes = activeEntities.filter(e => !e.isPlayer);
      const f = foes[0];
      const species = typeNameOf(f);
      f.eliteTypes = ['FRENZIED', 'ARMORED']; f.eliteType = 'FRENZIED';
      f.name = '*FRENZIED ARMORED* ' + species;
      renderField();   // the strip is drawn as part of the field, so this is the real path
      return { strip: document.getElementById('queue-display').innerText,
               want: '*' + species.substring(0, 3).toUpperCase() };
    });
    ok(`the turn strip names the species, not the affix (${queue.strip})`, queue.strip.includes(queue.want));
    ok('and no entry in it is an affix prefix', !/\*(FR|AR|VA|SE)\b/.test(queue.strip.replace(queue.want, '')));

    // The codex carries the same table, so the two cannot drift.
    const codex = await page.evaluate(() => {
      const run = CODEX.find(c => c.id === 'RUN').body().join(' | ');
      return { all: ELITE_AFFIXES.every(a => run.includes(a.name) && run.includes(a.desc)),
               mentionsChampion: /champion/i.test(run) };
    });
    ok('the codex lists every affix and its effect, off the same table', codex.all);
    ok('and explains the champion', codex.mentionsChampion);
  }
};

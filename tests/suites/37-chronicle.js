// Endless mode had no memory: a run ended and left a number. Every ended run now writes an
// entry with an epitaph built from the real fight that ended it, the last fifty keep a
// chronicle off the title, and the careers add up across every slot.
module.exports = {
  name: 'The Chronicle',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the epitaph tells the truth ----
    const words = await page.evaluate(() => {
      const at = k => epitaphFor({ lastKiller: k, deepestSector: 3 });
      return {
        elite: at({ name: 'Juggernaut', elite: 'FRENZIED', boss: false, sector: 2, tier: 8, cause: 'COMBAT' }),
        plain: at({ name: 'Raider', elite: null, boss: false, sector: 1, tier: 3, cause: 'COMBAT' }),
        boss: at({ name: 'The Matriarch', elite: null, boss: true, sector: 4, tier: 10, cause: 'COMBAT' }),
        smog: at({ cause: 'SMOG', sector: 5, tier: 2 }),
        shrap: at({ cause: 'SHRAPNEL', sector: 2, tier: 4 }),
        bleed: at({ cause: 'BLEED', sector: 3, tier: 6 }),
        none: epitaphFor({ deepestSector: 7 }),
        stable: at({ name: 'Juggernaut', sector: 1, tier: 1, cause: 'COMBAT' }).split(' ')[0] ===
                at({ name: 'Juggernaut', sector: 9, tier: 9, cause: 'COMBAT' }).split(' ')[0]
      };
    });
    ok(`an elite death names the elite (${words.elite})`,
      /FRENZIED Juggernaut, Sector 2, Tier 8\.$/.test(words.elite) && / a FRENZIED/.test(words.elite));
    ok('a plain death names the killer', /a Raider, Sector 1, Tier 3\.$/.test(words.plain));
    ok('a warlord death says so', /the warlord The Matriarch, Sector 4, Tier 10\.$/.test(words.boss));
    ok('the weather writes its own lines',
      /smog, Sector 5/.test(words.smog) && /shrapnel winds, Sector 2/.test(words.shrap) && /Bled out.*Sector 3/.test(words.bleed));
    ok('a run with no recorded blow still gets a line', /Vanished.*Sector 7\.$/.test(words.none));
    ok('the same killer always gets the same verb', words.stable);

    // ---- the killer goes on record where the blow lands ----
    const witness = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const hero = playerRoster.find(p => p.gridPos > 0);
      hero.quirk = null; hero.trinket = null;
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.eliteType = 'FRENZIED';
      hero.hp = 1; hero.resistances = { phys: 0, bio: 0, energy: 0 }; hero.armor = 0;
      bonds = {};
      applyDamageHit(foe, hero, 50, 'phys', 'CLAW');
      const combat = runStats.lastKiller;
      const other = playerRoster.filter(p => p.gridPos > 0)[1] || hero;
      other.hp = 1; currentWeather = 'TOXIC_SMOG';
      applyTurnStartEffects(other);
      const smog = runStats.lastKiller;
      currentWeather = 'CLEAR'; combatActive = false;
      return { combatName: combat && combat.name, combatElite: combat && combat.elite,
               combatWhere: combat && `${combat.sector}.${combat.tier}`, smogCause: smog && smog.cause };
    });
    ok('the last blow is on record with its elite mark', witness.combatElite === 'FRENZIED' && !!witness.combatName);
    ok('and where it landed', witness.combatWhere === '1.1');
    ok('a smog death records the weather as the killer', witness.smogCause === 'SMOG');

    // ---- an ended run writes the entry and the career adds up ----
    const written = await page.evaluate(() => {
      Store.remove(chronicleKey(1)); Store.remove(careerKey(1));
      Store.remove(chronicleKey(2)); Store.remove(careerKey(2));
      Store.remove(chronicleKey(3)); Store.remove(careerKey(3));
      activeContracts = ['GLASS']; currentSlot = 1; runSeed = 'ELEGY'; confirmNewGame(1.0); sectorFront = null;
      runStats.kills = 23; runStats.nodes = 9; runStats.deepestSector = 2; runStats.deepestTier = 8;
      runStats.lastKiller = { name: 'Juggernaut', elite: 'FRENZIED', boss: false, sector: 2, tier: 8, cause: 'COMBAT' };
      activeRelics = [RELIC_POOL[0], RELIC_POOL[1]];
      endRun();
      const log = readChronicle(1);
      const c = readCareer(1);
      const e = log[0];
      return {
        one: log.length === 1,
        fields: !!e && e.kills === 23 && e.sector === 2 && e.tier === 8 && e.seed === 'ELEGY' &&
                e.relics.length === 2 && e.contracts.length === 1,
        epitaph: e && /FRENZIED Juggernaut, Sector 2, Tier 8\.$/.test(e.epitaph),
        deployed: e && e.deployed.length >= 1,
        career: c.runs === 1 && c.kills === 23 && c.deepestSector === 2,
        fielded: Object.values(c.fielded).reduce((a, b) => a + b, 0) === (e ? e.deployed.length : -1)
      };
    });
    ok('an ended run writes one entry with the whole story', written.one && written.fields && written.deployed);
    ok('under an honest epitaph', written.epitaph);
    ok('and the career adds up', written.career && written.fielded);

    // ---- bounded at fifty, newest first ----
    const bounded = await page.evaluate(() => {
      Store.remove(chronicleKey(1)); Store.remove(careerKey(1));
      currentSlot = 1;
      for (let i = 0; i < 55; i++) writeChronicle({ when: 1000 + i, score: i, sector: 1, kills: 1, deployed: ['BRUISER'], epitaph: `Run ${i}.` });
      const log = readChronicle(1);
      const c = readCareer(1);
      return { kept: log.length, newest: log[0].score, career: c.runs === 55 && c.kills === 55 };
    });
    ok('the log keeps fifty, newest first', bounded.kept === 50 && bounded.newest === 54);
    ok('while the career remembers all of it', bounded.career);

    // ---- the chronicle screen, off the title ----
    const screen = await page.evaluate(() => {
      currentSlot = 2;
      writeChronicle({ when: Date.now() + 5000, score: 900, sector: 3, tier: 4, kills: 12, deployed: ['MEDIC'], epitaph: 'Broken by a Warbot, Sector 3, Tier 4.', relics: [], contracts: [], seed: null });
      currentSlot = 1;
      renderTitleScreen();
      const btn = !!document.querySelector('[data-action="chronicle"]');
      const titleLine = document.querySelector('.title-epitaph');
      renderChronicle();
      const shown = getComputedStyle(document.getElementById('screen-chronicle')).display === 'flex';
      const career = document.getElementById('chronicle-career').innerText;
      const list = document.getElementById('chronicle-list');
      return { btn, titleLine: titleLine ? titleLine.innerText : '',
               shown, entries: list.querySelectorAll('.chronicle-entry').length,
               merged: list.innerText.includes('Warbot'),
               career: /EXPEDITIONS/.test(career) && /MOST FIELDED/.test(career) && /DEEPEST EVER/.test(career) };
    });
    ok('the title offers the chronicle and speaks the last word', screen.btn && /Warbot/.test(screen.titleLine));
    ok('the screen opens with the career ledger', screen.shown && screen.career);
    ok('and the entries merge across every slot', screen.entries >= 50 && screen.merged);

    // ---- the empty book and the damaged one ----
    const edge = await page.evaluate(() => {
      [1, 2, 3].forEach(s => { Store.remove(chronicleKey(s)); Store.remove(careerKey(s)); });
      renderChronicle();
      const empty = document.getElementById('chronicle-list').innerText;
      Store.set(chronicleKey(1), '{not json');
      const survived = readChronicle(1);
      renderChronicle();
      return { empty: /still waiting/.test(empty), survived: Array.isArray(survived) && survived.length === 0 };
    });
    ok('an empty book says so', edge.empty);
    ok('a damaged one reads as empty instead of crashing', edge.survived);
  }
};

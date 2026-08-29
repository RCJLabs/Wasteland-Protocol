// A losing run left nothing behind. Dossiers make every point of XP count twice: each class
// accrues lifetime XP across all runs, and the ranks unlock OPTIONS, never raw power - a
// title at I, a class quirk in the draw pool at II, and at III a fourth ability with a
// bring-three-of-four loadout picked at the muster.
module.exports = {
  name: 'Dossiers',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the tables cover every class ----
    const tables = await page.evaluate(() => {
      const classes = Object.keys(ABILITIES);
      return {
        titles: classes.every(c => MASTERY_TITLES[c]),
        quirks: classes.every(c => CLASS_QUIRKS[c] && CLASS_QUIRKS[c].id && CLASS_QUIRKS[c].desc),
        fourths: classes.every(c => FOURTH_ABILITIES[c] && FOURTH_ABILITIES[c].move && FOURTH_ABILITIES[c].cd),
        reach: classes.every(c => ['melee', 'ranged'].includes(MOVE_REACH[FOURTH_ABILITIES[c].move])),
        ranks: MASTERY_RANKS.length === 4 && MASTERY_RANKS[1] < MASTERY_RANKS[2] && MASTERY_RANKS[2] < MASTERY_RANKS[3]
      };
    });
    ok('every class has a title, a class quirk and a fourth verb', tables.titles && tables.quirks && tables.fourths);
    ok('the fourth verbs carry real reach', tables.reach);
    ok('three ranks, each further than the last', tables.ranks);

    // ---- rank arithmetic and accrual ----
    const accrual = await page.evaluate(() => {
      mastery = {};
      const at = x => { mastery = { BRUISER: x }; return masteryRank('BRUISER'); };
      const ranks = [at(0), at(1499), at(1500), at(3999), at(4000), at(8000), at(99999)].join(',');
      mastery = {};
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const ch = playerRoster.find(c => c.classType === 'SNIPER');
      ch.trinket = null; ch.xp = 0; ch.xpToNext = 100000;
      awardXp(ch, 300);
      const accrued = masteryXp('SNIPER');
      saveMeta();
      mastery = {};
      loadMeta();
      const persisted = masteryXp('SNIPER');
      const raw = JSON.parse(Store.get(META_KEY));
      delete raw.mastery;
      Store.set(META_KEY, JSON.stringify(raw));
      loadMeta();
      const legacy = Object.keys(mastery).length;
      return { ranks, accrued, persisted, legacy };
    });
    ok(`the thresholds hold (${accrual.ranks})`, accrual.ranks === '0,0,1,1,2,3,3');
    ok('XP earned in the field lands on the dossier', accrual.accrued === 300);
    ok('and rides the meta save', accrual.persisted === 300);
    ok('a pre-dossier meta loads clean', accrual.legacy === 0);

    // ---- the rank gates ----
    const gates = await page.evaluate(() => {
      mastery = {};
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const bruiser = playerRoster.find(c => c.classType === 'BRUISER');
      const r0 = { deck: deckFor(bruiser).map(a => a.move).join(), pool: quirkPoolFor('BRUISER').length };
      mastery = { BRUISER: 99999 };
      const r3 = {
        deckDefault: deckFor(bruiser).map(a => a.move).join(),
        pool: quirkPoolFor('BRUISER').length,
        poolHasClass: quirkPoolFor('BRUISER').some(q => q.id === 'BULLHEADED'),
        otherPool: quirkPoolFor('MEDIC').some(q => q.id === 'CALM_UNDER_FIRE')
      };
      bruiser.benchedMove = 'SCRAP_BLADE';
      const swapped = deckFor(bruiser).map(a => a.move);
      bruiser.benchedMove = null;
      const fallback = deckFor(bruiser).map(a => a.move).join();
      return { r0, r3, swapped: swapped.join(), fallback, base: QUIRK_POOL.length };
    });
    ok('rank 0 fields the classic three from the classic pool',
      gates.r0.deck === 'SCRAP_BLADE,HEAVY_WRENCH,IRON_GUARD' && gates.r0.pool === gates.base);
    ok('rank III still defaults to the classic three - the fourth sits benched',
      gates.r3.deckDefault === 'SCRAP_BLADE,HEAVY_WRENCH,IRON_GUARD');
    ok("rank II widens only that class's quirk pool",
      gates.r3.pool === gates.base + 1 && gates.r3.poolHasClass && !gates.r3.otherPool);
    ok('benching a classic brings the fourth in',
      gates.swapped === 'HEAVY_WRENCH,IRON_GUARD,SHIELD_SLAM');
    ok('and no benched pick ever fields four', gates.fallback === 'SCRAP_BLADE,HEAVY_WRENCH,IRON_GUARD');

    // ---- the muster shows the dossier ----
    const musterUi = await page.evaluate(() => {
      mastery = { BRUISER: 99999, MEDIC: 2000 };
      activeContracts = []; currentSlot = 1; pendingDifficulty = 1.0; beginExpedition();
      const titles = document.querySelectorAll('.muster-title').length;
      const chips = document.querySelectorAll('.loadout-chip').length;
      const benched = document.querySelector('.loadout-chip.chip-benched');
      const bruiser = playerRoster.find(c => c.classType === 'BRUISER');
      document.querySelector(`.loadout-chip[data-id="${bruiser.id}"][data-move="SCRAP_BLADE"]`).click();
      const after = bruiser.benchedMove;
      const rechipped = document.querySelector('.loadout-chip.chip-benched').dataset.move;
      return { titles, chips, benchedMove: benched ? benched.dataset.move : '', after, rechipped };
    });
    ok('titles ride the muster rows at rank I and up', musterUi.titles === 2);
    ok('a rank-III class musters four chips, the fourth benched', musterUi.chips === 4 && musterUi.benchedMove === 'SHIELD_SLAM');
    ok('tapping a classic benches it instead', musterUi.after === 'SCRAP_BLADE' && musterUi.rechipped === 'SCRAP_BLADE');

    const card = await page.evaluate(() => {
      renderOutpost();
      return document.getElementById('outpost-roster').innerHTML.includes('Wall of the Waste');
    });
    ok('the title sits on the outpost card', card);

    // ---- the deck in the fight ----
    const deck = await page.evaluate(() => {
      const bruiser = playerRoster.find(c => c.classType === 'BRUISER');
      bruiser.benchedMove = 'IRON_GUARD'; bruiser.gridPos = 1;
      initiateCombat('RAIDERS', false);
      activeIndex = turnQueue.indexOf(bruiser); pendingAction = null;
      renderCommandDeck();
      const moves = [...document.querySelectorAll('#command-deck [data-move]')].map(b => b.dataset.move);
      combatActive = false;
      return { hasFourth: moves.includes('SHIELD_SLAM'), lacksBenched: !moves.includes('IRON_GUARD') };
    });
    ok('the fight deals the loadout the muster picked', deck.hasFourth && deck.lacksBenched);

    // ---- the seven verbs do what they say ----
    await page.evaluate(() => {
      window.__mFight = (cls) => {
        mastery = { [cls]: 99999 };
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null; initiateCombat('RAIDERS', false);
        const hero = playerRoster.find(h => h.classType === cls);
        hero.gridPos = 1; hero.maxHp = 1000; hero.hp = 1000; hero.dmgBase = 100;
        hero.quirk = null; hero.weaponMod = null; hero.trinket = null; hero.traits = []; hero.stunnedTurns = 0;
        Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
        bonds = {};
        const foes = [];
        for (let i = 0; i < 3; i++) {
          const f = generateEnemies('RAIDERS', 1, false, 1)[0];
          f.id = 'mfoe' + i; f.maxHp = 100000; f.hp = 100000; f.armor = 0; f.baseArmor = 0;
          f.resistances = { phys: 0, bio: 0, energy: 0 };
          f.bleedingTurns = 0; f.oiledTurns = 0; f.stunnedTurns = 0; f.corrodedTurns = 0; f.markedTurns = 0;
          foes.push(f);
        }
        activeEntities = [hero, ...foes]; turnQueue = [hero, ...foes];
        activeIndex = 0; combatActive = true; pendingAction = null; currentWeather = null; momentumFocus = 0;
        return { hero, foes };
      };
      window.__mAvg = (cls, move) => {
        let t = 0;
        for (let i = 0; i < 12; i++) {
          const f = window.__mFight(cls);
          activeIndex = 0; combatActive = true; pendingAction = move;
          const before = f.foes[0].hp; resolveAction(f.foes[0].id); t += before - f.foes[0].hp;
        }
        return t / 12;
      };
    });
    const verbs = await page.evaluate(() => {
      const r = {};
      let f = window.__mFight('BRUISER');
      const armor0 = f.hero.armor;
      activeIndex = 0; combatActive = true; pendingAction = 'SHIELD_SLAM'; resolveAction(f.foes[0].id);
      r.slam = { hit: 100000 - f.foes[0].hp, armor: f.hero.armor - armor0, cd: f.hero.cooldowns.shield_slam };
      f = window.__mFight('MEDIC');
      const ally = f.hero;
      const bruiser = playerRoster.find(c => c.classType === 'BRUISER');
      bruiser.gridPos = 2; bruiser.hp = 50; bruiser.maxHp = 200; bruiser.stunnedTurns = 1; bruiser.quirk = null;
      activeEntities.push(bruiser); turnQueue.push(bruiser);
      activeIndex = 0; combatActive = true; pendingAction = 'STIM_DART'; resolveAction(bruiser.id);
      r.dart = { hp: bruiser.hp, stun: bruiser.stunnedTurns, cd: ally.cooldowns.stim_dart };
      const orig = Math.random;
      f = window.__mFight('SCAVENGER');
      Math.random = () => 0.2;
      activeIndex = 0; combatActive = true; pendingAction = 'SHIV'; resolveAction(f.foes[0].id);
      Math.random = orig;
      r.shiv = f.foes[0].bleedingTurns;
      f = window.__mFight('PYROMANIAC');
      activeIndex = 0; combatActive = true; pendingAction = 'HEAT_WAVE'; resolveAction(f.foes[0].id);
      r.wave = { first: 100000 - f.foes[0].hp, behind: 100000 - f.foes[1].hp };
      f = window.__mFight('SHOTGUNNER');
      Math.random = () => 0.2;
      activeIndex = 0; combatActive = true; pendingAction = 'RIOT_BUTT'; resolveAction(f.foes[0].id);
      Math.random = orig;
      r.butt = f.foes[0].stunnedTurns;
      f = window.__mFight('SNIPER');
      activeIndex = 0; combatActive = true; pendingAction = 'PIERCING_VOLLEY'; resolveAction(f.foes[0].id);
      r.volley = { behind: 100000 - f.foes[1].hp };
      const single = window.__mAvg('HOUND', 'SNAP');
      const harried = window.__mAvg('HOUND', 'HARRY');
      r.harry = harried / single;
      return r;
    });
    ok(`Shield Slam trades weight for plate (+${verbs.slam.armor} armor, cd ${verbs.slam.cd})`,
      verbs.slam.hit > 0 && verbs.slam.armor === 8 && verbs.slam.cd === 2);
    ok('Stim Dart patches an ally from range and shakes the stun loose',
      verbs.dart.hp === 62 && verbs.dart.stun === 0 && verbs.dart.cd === 2);
    ok('the Shiv opens a two-turn bleed', verbs.shiv === 2);
    ok('Heat Wave carries to the one behind', verbs.wave.first > 0 && verbs.wave.behind > 0);
    ok('the Riot Butt can stun', verbs.butt === 1);
    ok('Piercing Volley punches through', verbs.volley.behind > 0);
    ok(`Harry bites twice (x${verbs.harry.toFixed(2)} of a Snap)`, verbs.harry > 1.05 && verbs.harry < 1.4);

    // ---- wired, and in the book ----
    const wired = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const inert = Object.values(FOURTH_ABILITIES).filter(a =>
        (src.match(new RegExp("'" + a.move + "'", 'g')) || []).length < 2).map(a => a.move);
      const e = CODEX.find(x => x.id === 'DOSSIERS');
      const text = e ? e.body().join(' ') : '';
      const listed = Object.keys(MASTERY_TITLES).every(c => text.includes(MASTERY_TITLES[c]));
      mastery = {}; saveMeta();
      return { inert, listed };
    });
    ok('every fourth verb is wired into the engine', wired.inert.length === 0);
    ok('the field manual holds the dossier page', wired.listed);
  }
};

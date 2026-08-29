// Two players could never compare runs: every wasteland was private. A seed fixes what the
// wasteland GENERATES - maps, fronts, quirks, the bounty slate - while the fighting stays
// live, and the date derives a shared seed: the Daily Protocol.
module.exports = {
  name: 'The Daily Protocol',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the generator core ----
    const core = await page.evaluate(() => {
      const a = mulberry32(seedFromString('alpha'));
      const b = mulberry32(seedFromString('alpha'));
      const c = mulberry32(seedFromString('bravo'));
      const seq = r => Array.from({ length: 5 }, () => r());
      const sa = seq(a), sb = seq(b), sc = seq(c);
      return { same: sa.join() === sb.join(), differ: sa.join() !== sc.join(),
               ranged: sa.every(v => v >= 0 && v < 1),
               stableHash: seedFromString('wasteland') === seedFromString('wasteland') };
    });
    ok('the same seed deals the same sequence', core.same && core.stableHash);
    ok('a different seed deals a different one', core.differ && core.ranged);

    // ---- streams are per purpose: one cannot desync another ----
    const streams = await page.evaluate(() => {
      runSeed = 'ISO';
      const m = seededRng('map:1'); m(); m(); m();
      const f1 = seededRng('front:1')();
      const f2 = seededRng('front:1')();
      const live = (() => { runSeed = null; return seededRng('map:1') === Math.random; })();
      return { isolated: f1 === f2, live };
    });
    ok('drawing from one stream never shifts another', streams.isolated);
    ok('with no seed, the channel is live dice', streams.live);

    // ---- the same seed walks the same wasteland ----
    const shape = () => page.evaluate(() =>
      sectorMap.nodes.map(n => n.id + n.type + (n.elite ? 'E' : '') + (n.weather || '')).join() +
      '#' + sectorFront + '#' + playerRoster.map(c => c.quirk ? c.quirk.id : '-').join() +
      '#' + activeBounties.map(b => b.desc + b.target).join('|'));
    await page.evaluate(() => { activeContracts = []; currentSlot = 1; runSeed = 'ALPHA-STRIKE'; confirmNewGame(1.0); });
    const runA = await shape();
    await page.evaluate(() => { activeContracts = []; currentSlot = 1; runSeed = 'ALPHA-STRIKE'; confirmNewGame(1.0); });
    const runB = await shape();
    await page.evaluate(() => { activeContracts = []; currentSlot = 1; runSeed = 'ZULU-DAWN'; confirmNewGame(1.0); });
    const runC = await shape();
    ok('the same seed builds the same map, front, quirks and slate', runA === runB);
    ok('a different seed builds a different wasteland', runA !== runC);

    // ---- and sector N is sector N however the road there went ----
    const deep = await page.evaluate(() => {
      const shapeOf = () => sectorMap.nodes.map(n => n.id + n.type + (n.elite ? 'E' : '')).join() + '#' + sectorFront;
      activeContracts = []; currentSlot = 1; runSeed = 'DEEP-SIX'; confirmNewGame(1.0);
      advanceSector();
      const first = shapeOf();
      activeContracts = []; currentSlot = 1; runSeed = 'DEEP-SIX'; confirmNewGame(1.0);
      for (let i = 0; i < 57; i++) Math.random();
      advanceSector();
      return { first, replay: shapeOf() };
    });
    ok('sector 2 is the same sector 2 however the dice fell on the way', deep.first === deep.replay);

    // ---- the fights stay live ----
    const live = await page.evaluate(() => {
      const rolls = () => {
        activeContracts = []; currentSlot = 1; runSeed = 'ALPHA-STRIKE'; confirmNewGame(1.0);
        initiateCombat('RAIDERS', false);
        const hero = playerRoster.find(p => p.gridPos > 0);
        hero.quirk = null; hero.weaponMod = null; hero.trinket = null; hero.traits = []; hero.dmgBase = 100;
        const foe = activeEntities.find(e => !e.isPlayer);
        foe.maxHp = 100000; foe.hp = 100000; foe.armor = 0; foe.resistances = { phys: 0, bio: 0, energy: 0 };
        const out = [];
        for (let i = 0; i < 8; i++) {
          const before = foe.hp;
          activeIndex = 0; combatActive = true; pendingAction = 'SCRAP_BLADE';
          resolveAction(foe.id);
          out.push(before - foe.hp);
        }
        combatActive = false;
        return out.join();
      };
      return { a: rolls(), b: rolls() };
    });
    ok('the same seed does not script the fighting', live.a !== live.b);

    // ---- the daily derives from the date ----
    const daily = await page.evaluate(() => ({
      seed: dailySeed(),
      today: 'DAILY-' + new Date().toISOString().slice(0, 10),
      shaped: /^DAILY-\d{4}-\d{2}-\d{2}$/.test(dailySeed())
    }));
    ok(`today's protocol is ${daily.seed}`, daily.seed === daily.today && daily.shaped);

    // ---- the contract board carries the seed ----
    const board = await page.evaluate(() => {
      runSeed = null; renderContracts();
      const note = document.getElementById('seed-note').innerText;
      document.getElementById('seed-input').value = '';
      document.querySelector('[data-action="seed-daily"]').click();
      const filled = document.getElementById('seed-input').value;
      pendingDifficulty = 1.0;
      document.getElementById('seed-input').value = '  my raid  ';
      beginExpedition();
      const typed = runSeed;
      const onMuster = getComputedStyle(document.getElementById('screen-muster')).display;
      document.getElementById('seed-input').value = '';
      beginExpedition();
      return { note, filled, typed, onMuster, free: runSeed };
    });
    ok('the board names the daily and its standing', board.note.includes(daily.seed));
    ok("TODAY'S PROTOCOL fills the seed", board.filled === daily.seed);
    ok('a typed seed deploys trimmed and uppercased', board.typed === 'MY RAID' && board.onMuster === 'flex');
    ok('a blank one deploys on live dice', board.free === null);

    // ---- the seed keeps its own best line ----
    const bests = await page.evaluate(() => {
      Store.remove(SEED_BEST_KEY);
      const prev0 = noteSeedBest('TRIAL', 100);
      const kept = seedBests().TRIAL;
      noteSeedBest('TRIAL', 60);
      const held = seedBests().TRIAL;
      noteSeedBest('TRIAL', 140);
      const raised = seedBests().TRIAL;
      const freeRun = noteSeedBest(null, 999);
      const freeStored = Object.keys(seedBests()).length;
      for (let i = 0; i < 25; i++) noteSeedBest('Z' + String(i).padStart(2, '0'), 10 + i);
      const pruned = Object.keys(seedBests()).length;
      return { prev0, kept, held, raised, freeRun, freeStored, pruned };
    });
    ok('a seeded score is kept, only upward', bests.prev0 === 0 && bests.kept === 100 && bests.held === 100 && bests.raised === 140);
    ok('a free run keeps no seed line', bests.freeRun === null && bests.freeStored === 1);
    ok(`the ledger stays pruned (${bests.pruned} seeds kept)`, bests.pruned <= 20);

    // ---- the run-over screen scores the seed ----
    const over = await page.evaluate(() => {
      Store.remove(SEED_BEST_KEY);
      activeContracts = []; currentSlot = 1; runSeed = 'RECKONING'; confirmNewGame(1.0);
      runStats.kills = 30; runStats.nodes = 12; runStats.deepestSector = 2;
      endRun();
      const first = document.getElementById('runover-lines').innerText;
      activeContracts = []; currentSlot = 1; runSeed = 'RECKONING'; confirmNewGame(1.0);
      endRun();
      const second = document.getElementById('runover-lines').innerText;
      return { first, second };
    });
    ok('a seeded run names its protocol', /PROTOCOL SEED/.test(over.first) && /RECKONING/.test(over.first));
    ok('the first cut sets the seed best', /NEW SEED BEST/.test(over.first));
    ok('a weaker try shows the line to beat', !/NEW SEED BEST/.test(over.second) && /SEED BEST/.test(over.second));

    // ---- persistence ----
    const saved = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; runSeed = 'KEEPSAKE'; confirmNewGame(1.0);
      saveGameState();
      runSeed = null;
      loadGameState();
      const kept = runSeed;
      const raw = JSON.parse(Store.get(BASE_SAVE_KEY + currentSlot));
      delete raw.runSeed;
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw));
      loadGameState();
      return { kept, legacy: runSeed };
    });
    ok('the seed rides the save', saved.kept === 'KEEPSAKE');
    ok('a pre-protocol save loads as a free run', saved.legacy === null);

    // ---- the field manual has the page ----
    const codex = await page.evaluate(() => {
      runSeed = null;
      const e = CODEX.find(x => x.id === 'PROTOCOL');
      const text = e ? e.body().join(' ') : '';
      return /seed/i.test(text) && /same wasteland/i.test(text);
    });
    ok('the field manual explains the protocol', codex);
  }
};

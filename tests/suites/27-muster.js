// Every run deployed the same three operators with the only per-run dice being five stat
// quirks nobody was shown. The muster now stands between the contract board and the map:
// who rolled what is visible, rerollable, and the line-up is a decision.
module.exports = {
  name: 'The muster',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the pool tripled, and half of it plays with systems ----
    const pool = await page.evaluate(() => ({
      count: QUIRK_POOL.length,
      ids: new Set(QUIRK_POOL.map(q => q.id)).size,
      described: QUIRK_POOL.every(q => q.name && q.desc),
      statOnly: QUIRK_POOL.filter(q => q.hp || q.dmg || q.spd).length,
      systemic: QUIRK_POOL.filter(q => !q.hp && !q.dmg && !q.spd).length
    }));
    ok(`the quirk pool holds ${pool.count}, not five`, pool.count === 15);
    ok('each unique and described', pool.ids === 15 && pool.described);
    ok(`and ${pool.systemic} of them read the systems rather than the stat sheet`, pool.systemic >= 9);

    // ---- the systemic quirks actually fire ----
    await page.evaluate(() => {
      window.__quirkFight = (quirkId, setup) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null; initiateCombat('RAIDERS', false);
        const hero = playerRoster.find(h => h.classType === 'BRUISER');
        hero.gridPos = 1; hero.maxHp = 1000; hero.hp = 1000; hero.dmgBase = 100;
        hero.quirk = QUIRK_POOL.find(q => q.id === quirkId);
        hero.secondWindUsed = false;
        Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
        const foes = activeEntities.filter(e => !e.isPlayer);
        foes.forEach(f => { f.maxHp = 100000; f.hp = 100000; f.armor = 0;
          f.resistances = { phys: 0, bio: 0, energy: 0 }; f.stunnedTurns = 0; });
        activeEntities = [hero, ...foes]; turnQueue = [hero, ...foes];
        activeIndex = 0; combatActive = true; momentum = 0; momentumFocus = 0;
        if (setup) setup(hero, foes);
        return { hero, foes };
      };
      window.__quirkSwing = (foe) => {
        let total = 0;
        for (let i = 0; i < 12; i++) {
          activeIndex = 0; combatActive = true; pendingAction = 'SCRAP_BLADE';
          const before = foe.hp; resolveAction(foe.id); total += before - foe.hp;
          foe.hp = foe.maxHp;
        }
        return total / 12;
      };
    });

    const fired = await page.evaluate(() => {
      const ratio = (quirkId, setup, base) => {
        const { hero, foes } = window.__quirkFight(quirkId, setup);
        const withQuirk = window.__quirkSwing(foes[0]);
        const h2 = window.__quirkFight('STURDY', setup);
        h2.hero.dmgBase = 100;
        return withQuirk / window.__quirkSwing(h2.foes[0]);
      };
      return {
        loner: ratio('LONER'),
        packAlone: ratio('PACK_HUNTER'),
        pack: ratio('PACK_HUNTER', (h) => {
          const ally = playerRoster.find(x => x.classType === 'MEDIC');
          ally.gridPos = 2; ally.hp = ally.maxHp;
          activeEntities.push(ally); turnQueue.push(ally);
        }),
        firstBlood: ratio('FIRST_BLOOD'),
        duelist: ratio('DUELIST')
      };
    });
    const near = (v, want) => v > want - 0.08 && v < want + 0.08;
    ok(`LONER pays with nobody beside them (x${fired.loner.toFixed(2)})`, near(fired.loner, 1.2));
    ok('PACK HUNTER pays nothing alone', near(fired.packAlone, 1.0));
    ok(`and +15% with an ally in the next rank (x${fired.pack.toFixed(2)})`, near(fired.pack, 1.15));
    ok(`FIRST BLOOD punishes unhurt targets (x${fired.firstBlood.toFixed(2)})`, near(fired.firstBlood, 1.3));
    ok(`DUELIST works the enemy front (x${fired.duelist.toFixed(2)})`, near(fired.duelist, 1.15));

    const defensive = await page.evaluate(() => {
      // THICK HIDE, measured against the same operator without it - innate resistance
      // already shaves the hit, and the quirk's 3 comes off on top.
      let { hero } = window.__quirkFight('THICK_HIDE');
      hero.maxHp = 200; hero.hp = 200;
      applyDamageHit(activeEntities[1], hero, 50, 'phys', 'BASIC');
      const withHide = 200 - hero.hp;
      ({ hero } = window.__quirkFight('STURDY'));
      hero.maxHp = 200; hero.hp = 200;
      applyDamageHit(activeEntities[1], hero, 50, 'phys', 'BASIC');
      const hideTaken = withHide - (200 - hero.hp);
      // SECOND WIND
      ({ hero } = window.__quirkFight('SECOND_WIND'));
      hero.maxHp = 100; hero.hp = 40;
      applyDamageHit(activeEntities[1], hero, 500, 'phys', 'BASIC');
      const stood = hero.hp;
      applyDamageHit(activeEntities[1], hero, 500, 'phys', 'BASIC');
      const second = hero.hp;
      // SLOW BLEEDER
      ({ hero } = window.__quirkFight('SLOW_BLEEDER'));
      hero.maxHp = 200; hero.hp = 200; hero.bleedingTurns = 2;
      applyTurnStartEffects(hero);
      const bled = 200 - hero.hp;
      // OVERCHARGED
      const oc = window.__quirkFight('OVERCHARGED', (h, f) => { f[0].stunnedTurns = 2; });
      momentum = 0; activeIndex = 0; combatActive = true; pendingAction = 'SCRAP_BLADE';
      resolveAction(oc.foes[0].id);
      const charged = momentum;
      return { hideTaken, stood, second, bled, charged };
    });
    ok(`THICK HIDE takes 3 off every hit (delta ${defensive.hideTaken})`, defensive.hideTaken === -3);
    ok('SECOND WIND survives the killing blow at 1', defensive.stood === 1);
    ok('exactly once per fight', defensive.second === 0);
    ok(`SLOW BLEEDER halves the tick (${defensive.bled})`, defensive.bled === 8);
    ok(`OVERCHARGED converts a combo into momentum (${defensive.charged})`, defensive.charged > 10);

    const rat = await page.evaluate(() => {
      const { hero, foes } = window.__quirkFight('SCRAP_RAT');
      materials = { parts: 0, chems: 0, tech: 0 };
      foes.forEach(f => { f.hp = 0; });
      checkWinState();
      const won = materials.parts + materials.chems + materials.tech;
      combatActive = false;
      return won;
    });
    ok('SCRAP RAT pockets a material from a fight they survive', rat >= 1);

    // ---- the muster screen ----
    await page.evaluate(() => { combatActive = false; });
    await page.waitForTimeout(700);
    await page.evaluate(() => { activeContracts = []; currentSlot = 1; pendingDifficulty = 1.0; beginExpedition(); });
    await page.waitForTimeout(300);
    const screen = await page.evaluate(() => ({
      shown: getComputedStyle(document.getElementById('screen-muster')).display,
      rows: document.querySelectorAll('.muster-row').length,
      deployed: document.querySelectorAll('.muster-deployed').length,
      quirksShown: [...document.querySelectorAll('.muster-quirk')].every(e => e.textContent.length > 2),
      descShown: [...document.querySelectorAll('.muster-quirk-desc')].every(e => e.textContent.length > 4),
      rerolls: document.getElementById('muster-rerolls').innerText,
      note: document.getElementById('muster-note').innerText
    }));
    ok('deploying opens the muster', screen.shown === 'flex');
    ok('all seven operators are on it', screen.rows === 7);
    ok('with the default line marked', screen.deployed === 3);
    ok('every quirk named and explained', screen.quirksShown && screen.descShown);
    ok(`the reroll purse is stated (${screen.rerolls})`, /2 REROLLS/.test(screen.rerolls));
    ok('and the reach rules are restated where the decision happens',
      /FRONT/.test(screen.note) && /BACK/.test(screen.note));

    // ---- ranks cycle, within the rules ----
    const ranks = await page.evaluate(() => {
      const front = playerRoster.find(c => c.gridPos === 1);
      musterRank(front.id);                      // front -> tries 2,3 (taken) -> bench
      const benched = front.gridPos;
      const bench = playerRoster.find(c => c.gridPos === 0 && c.id !== front.id);
      musterRank(bench.id);                      // bench -> takes the freed... rank 1
      return { benched, took: bench ? playerRoster.find(c => c.id === bench.id).gridPos : -1,
               deployedNow: playerRoster.filter(c => c.gridPos > 0).length };
    });
    ok('cycling a rank respects occupancy (front -> bench when the rest are taken)', ranks.benched === 0);
    ok('and a benched operator takes the freed slot', ranks.took === 1);
    ok('the line stays at three', ranks.deployedNow === 3);

    // ---- rerolls swap the quirk and spend the token ----
    const rerolled = await page.evaluate(() => {
      const ch = playerRoster[0];
      const before = { id: ch.quirk.id, hp: ch.maxHp - ch.quirk.hp, dmg: ch.dmgBase - ch.quirk.dmg };
      musterReroll(ch.id);
      const after = { id: ch.quirk.id, hp: ch.maxHp - ch.quirk.hp, dmg: ch.dmgBase - ch.quirk.dmg };
      musterReroll(playerRoster[1].id);
      const spent = musterRerolls;
      musterReroll(playerRoster[2].id);
      return { changed: before.id !== after.id, statsClean: before.hp === after.hp && before.dmg === after.dmg,
               spent, refusedThird: musterRerolls === 0,
               btnDead: document.querySelector('.muster-reroll').disabled };
    });
    ok('a reroll always lands a different quirk', rerolled.changed);
    ok('and swaps the stats cleanly, not cumulatively', rerolled.statsClean);
    ok('two tokens per expedition, then the button goes dark',
      rerolled.spent === 0 && rerolled.refusedThird && rerolled.btnDead);

    // ---- deploy guards ----
    const guards = await page.evaluate(() => {
      playerRoster.forEach(c => { c.gridPos = 0; });
      renderMuster();
      const emptyBlocked = document.getElementById('muster-deploy').disabled;
      playerRoster[0].gridPos = 1; renderMuster();
      musterDeploy();
      return { emptyBlocked, onMap: getComputedStyle(document.getElementById('screen-map')).display };
    });
    ok('an empty line cannot deploy', guards.emptyBlocked);
    ok('one operator can', guards.onMap === 'flex');

    // Short Handed keeps its rules on the muster too.
    const short = await page.evaluate(() => {
      activeContracts = ['SHORT_HANDED']; pendingDifficulty = 1.0; beginExpedition();
      const deployed = playerRoster.filter(c => c.gridPos > 0).length;
      const backEmpty = !playerRoster.some(c => c.gridPos === 3);
      // cycling can never land on rank 3
      const someone = playerRoster.find(c => c.gridPos === 0);
      for (let i = 0; i < 4; i++) musterRank(someone.id);
      const everLanded3 = playerRoster.some(c => c.gridPos === 3);
      activeContracts = [];
      return { deployed, backEmpty, everLanded3,
               note: document.getElementById('muster-note').innerText };
    });
    ok('Short Handed deploys two at muster', short.deployed === 2 && short.backEmpty);
    ok('and the back rank cannot be taken there', !short.everLanded3);
    ok('with the cap stated', /\/2 deployed/.test(short.note));

    // ---- the manual mentions the muster ----
    ok('the field manual explains the muster and its tokens', await page.evaluate(() =>
      /muster/i.test(CODEX.find(e => e.id === 'RUN').body().join(' '))));
  }
};

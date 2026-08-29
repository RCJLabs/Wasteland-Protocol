// The engine does a great deal of arithmetic the player never sees: a number lands with no way
// to ask why, and no way to know who is about to die. Three readouts, all built from what the
// fight is already doing rather than from a second model of it that could drift.
module.exports = {
  name: 'Read the room',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    const stage = () => page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      playerRoster.filter(p => p.gridPos > 0).forEach(h => {
        h.quirk = null; h.weaponMod = null; h.trinket = null; h.traits = [];
        h.maxHp = 200; h.hp = 200; h.armor = 0; h.resistances = { phys: 0, bio: 0, energy: 0 };
      });
      bonds = {}; activeRelics = []; currentWeather = null; momentumFocus = 0;
      const hero = playerRoster.find(p => p.gridPos > 0);
      activeIndex = turnQueue.indexOf(hero); pendingAction = null; combatActive = true;
      return hero.id;
    });

    // ---- mitigation is one function, so a preview cannot disagree with a hit ----
    const shared = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      return { calls: (src.match(/mitigate\(/g) || []).length,
               declared: /function mitigate\(/.test(src) };
    });
    ok('mitigation lives in one place, used by more than one caller',
      shared.declared && shared.calls >= 4);

    const agrees = await page.evaluate(() => {
      const heroId = (() => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        initiateCombat('RAIDERS', false);
        return playerRoster.find(p => p.gridPos > 0).id;
      })();
      const hero = playerRoster.find(p => p.id === heroId);
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.hp = 9999; foe.maxHp = 9999; foe.armor = 7; foe.resistances = { phys: 3, bio: 0, energy: 0 };
      const predicted = mitigate(hero, foe, 100, 'phys', null).n;
      const before = foe.hp;
      applyDamageHit(hero, foe, 100, 'phys', null);
      const actual = before - foe.hp;
      combatActive = false;
      return { predicted, actual };
    });
    ok(`the preview and the blow agree exactly (${agrees.predicted} = ${agrees.actual})`,
      agrees.predicted === agrees.actual && agrees.actual > 0);

    // ---- the forecast reads the intents already rolled ----
    const forecast = await page.evaluate(() => {
      const heroId = (() => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        initiateCombat('RAIDERS', false);
        playerRoster.filter(p => p.gridPos > 0).forEach(h => {
          h.quirk = null; h.trinket = null; h.traits = []; h.maxHp = 200; h.hp = 200;
          h.armor = 0; h.resistances = { phys: 0, bio: 0, energy: 0 }; h.guardTurns = 0;
        });
        bonds = {}; activeRelics = []; currentWeather = null;
        return playerRoster.find(p => p.gridPos > 0).id;
      })();
      const foes = activeEntities.filter(e => !e.isPlayer);
      foes.forEach((f, i) => { if (i) f.hp = 0; });
      const foe = foes[0];
      foe.range = 'melee'; foe.dmgBase = 30; foe.sig = null;
      const front = activeEntities.filter(e => e.isPlayer && e.hp > 0).sort((a, b) => a.gridPos - b.gridPos)[0];
      const back = activeEntities.filter(e => e.isPlayer && e.hp > 0).sort((a, b) => b.gridPos - a.gridPos)[0];

      foe.intent = { type: 'ATTACK', icon: '#' };
      const plain = forecastFor(foe);
      foe.intent = { type: 'HEAVY', icon: '#' };
      const heavy = forecastFor(foe);
      foe.intent = { type: 'FLANK', icon: '#' };
      const flank = forecastFor(foe);
      foe.intent = { type: 'DEFEND', icon: '#' };
      const defend = forecastFor(foe);
      foe.intent = { type: 'AOE', icon: '#' };
      const aoe = forecastFor(foe);
      combatActive = false;
      return {
        plainTarget: plain.hits[0].target.id === front.id, plainDmg: plain.hits[0].dmg,
        heavyDmg: heavy.hits[0].dmg, exact: plain.exact === true,
        flankTarget: flank.hits[0].target.id === back.id,
        defend: defend.kind === 'DEFEND' && !defend.hits,
        aoeHits: aoe.hits.length, aoeLower: aoe.hits[0].dmg < plain.hits[0].dmg
      };
    });
    ok('melee is forecast onto the front rank, exactly', forecast.plainTarget && forecast.exact);
    ok(`a heavy telegraph is priced higher (${forecast.plainDmg} -> ${forecast.heavyDmg})`,
      forecast.heavyDmg > forecast.plainDmg);
    ok('a flank is forecast onto the back rank', forecast.flankTarget);
    ok('an area attack is forecast onto everyone, for less each', forecast.aoeHits >= 2 && forecast.aoeLower);
    ok('a bracing enemy threatens nobody', forecast.defend);

    const lockOn = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      playerRoster.filter(p => p.gridPos > 0).forEach(h => {
        h.quirk = null; h.trinket = null; h.traits = []; h.maxHp = 200; h.hp = 200;
        h.armor = 0; h.resistances = { phys: 0, bio: 0, energy: 0 };
      });
      const foes = activeEntities.filter(e => !e.isPlayer);
      foes.forEach((f, i) => { if (i) f.hp = 0; });
      const foe = foes[0]; foe.range = 'ranged'; foe.dmgBase = 20; foe.sig = 'RANGING';
      foe.intent = { type: 'ATTACK', icon: '#' };
      const loose = forecastFor(foe).hits[0].dmg;
      const mark = activeEntities.filter(e => e.isPlayer && e.hp > 0)[1];
      foe.lockOn = mark.id;
      const locked = forecastFor(foe);
      combatActive = false;
      return { loose, lockedDmg: locked.hits[0].dmg, onMark: locked.hits[0].target.id === mark.id, exact: locked.exact };
    });
    ok(`a lined-up shot is forecast at its real weight (${lockOn.loose} -> ${lockOn.lockedDmg})`,
      lockOn.lockedDmg > lockOn.loose * 1.8);
    ok('onto the operator it actually ranged, exactly', lockOn.onMark && lockOn.exact === true);

    // ---- the board totals it, and marks who does not survive ----
    const board = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      playerRoster.filter(p => p.gridPos > 0).forEach(h => {
        h.quirk = null; h.trinket = null; h.traits = []; h.maxHp = 200; h.hp = 200;
        h.armor = 0; h.resistances = { phys: 0, bio: 0, energy: 0 }; h.guardTurns = 0;
      });
      bonds = {}; activeRelics = []; currentWeather = null;
      const foes = activeEntities.filter(e => !e.isPlayer);
      foes.forEach(f => { f.range = 'melee'; f.dmgBase = 30; f.sig = null; f.intent = { type: 'ATTACK', icon: '#' }; });
      const b = threatBoard();
      const front = activeEntities.filter(e => e.isPlayer && e.hp > 0).sort((a, b2) => a.gridPos - b2.gridPos)[0];
      const stacked = b[front.id].dmg;
      const others = Object.entries(b).filter(([id]) => id !== front.id).every(([, v]) => v.dmg === 0);
      // the card says so, and says so loudly when it is fatal
      pendingAction = null; front.hp = 200; renderField();
      const safeTag = document.getElementById(front.id).querySelector('.threat-tag');
      const survives = safeTag && !safeTag.className.includes('threat-fatal');
      front.hp = 5; renderField();
      const doomTag = document.getElementById(front.id).querySelector('.threat-tag');
      const doomed = doomTag && doomTag.className.includes('threat-fatal');
      // and it gets out of the way while aiming
      pendingAction = 'SCRAP_BLADE'; renderField();
      const quietWhileAiming = !document.getElementById(front.id).querySelector('.threat-tag');
      pendingAction = null; combatActive = false;
      return { stacked, foes: foes.length, others, survives, doomed, quietWhileAiming };
    });
    ok(`everything aimed at one operator stacks (${board.foes} attackers -> ${board.stacked})`,
      board.stacked > 0 && board.others);
    ok('a survivable round reads plainly, a fatal one reads fatal', board.survives && board.doomed);
    ok('and the forecast steps aside while aiming', board.quietWhileAiming);

    // ---- aiming shows what the target will absorb ----
    const soak = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const hero = playerRoster.find(p => p.gridPos > 0);
      activeIndex = turnQueue.indexOf(hero);
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.armor = 30; foe.resistances = { phys: 10, bio: 0, energy: 0 };
      pendingAction = 'SCRAP_BLADE'; renderField();
      const tag = document.getElementById(foe.id).querySelector('.soak-tag');
      const shown = tag && /\d+%/.test(tag.innerText);
      const pct = tag ? parseInt(tag.innerText, 10) : -1;
      // a target that soaks nothing says nothing
      foe.armor = 0; foe.resistances = { phys: 0, bio: 0, energy: 0 }; renderField();
      const quiet = !document.getElementById(foe.id).querySelector('.soak-tag');
      pendingAction = null; combatActive = false;
      return { shown, pct, quiet };
    });
    ok(`an armoured target shows what it absorbs (${soak.pct}% lands)`,
      soak.shown && soak.pct === 60);
    ok('a target that soaks nothing stays quiet', soak.quiet);

    // ---- the breakdown is recorded, not recomputed ----
    const trace = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const hero = playerRoster.find(p => p.classType === 'BRUISER');
      hero.gridPos = 1; hero.quirk = null; hero.weaponMod = null; hero.trinket = null; hero.traits = [];
      hero.dmgBase = 100; Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
      bonds = {}; activeRelics = [];
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.hp = 99999; foe.maxHp = 99999; foe.armor = 6;
      foe.resistances = { phys: 4, bio: 0, energy: 0 }; foe.sig = null;
      activeEntities = [hero, foe]; turnQueue = [hero, foe];
      activeIndex = 0; combatActive = true; currentWeather = null;
      momentumFocus = 30;
      hitLog = [];
      pendingAction = 'HEAVY_WRENCH';
      const before = foe.hp;
      resolveAction(foe.id);
      const landed = before - foe.hp;
      const h = hitLog[hitLog.length - 1];
      const labels = h.trace.map(t => t.label);
      const product = h.trace.reduce((a, t) => a * t.f, 1);
      combatActive = false;
      return { logged: hitLog.length, landed, net: h.net, raw: h.raw, soaked: h.soaked,
               labels, product, attacker: h.attacker, target: h.target, ability: h.abilityStr,
               resist: h.resist, armor: h.armor };
    });
    ok('a blow files itself with both ends of the arithmetic',
      trace.logged === 1 && trace.net === trace.landed && trace.raw > 0);
    ok(`the recorded factors are the ones that fired (${trace.labels.join(', ')})`,
      trace.labels.includes('ability') && trace.labels.includes('focus'));
    ok(`and they multiply out to the real swing (x${trace.product.toFixed(2)})`,
      Math.abs(trace.product - 1.95) < 0.02);
    ok(`the mitigation is filed too (${trace.raw} - ${trace.soaked} = ${trace.net})`,
      trace.raw - trace.soaked === trace.net && trace.resist === 4 && trace.armor === 6);
    ok('with who hit whom, and with what', trace.attacker && trace.target && trace.ability === 'HEAVY_WRENCH');

    // ---- and the player can read it back off the log ----
    const readback = await page.evaluate(() => {
      const lines = [...document.getElementById('log').children].filter(e => e.dataset.action === 'explain');
      const line = lines[lines.length - 1];
      const tappable = !!line && line.className.includes('log-explainable');
      line.click();
      const el = document.getElementById('explain');
      const open = getComputedStyle(el).display === 'flex';
      const text = el.innerText;
      const tells = /rolled/.test(text) && /landed/.test(text) && /ability/.test(text);
      document.querySelector('[data-action="explain-close"]').click();
      const closed = getComputedStyle(el).display === 'none' && explaining === null;
      return { tappable, open, tells, closed };
    });
    ok('every logged blow is tappable', readback.tappable);
    ok('and reads back as rolled, bent, soaked, landed', readback.open && readback.tells);
    ok('then closes cleanly', readback.closed);

    const empty = await page.evaluate(() => {
      hitLog = []; explaining = null;
      openExplain(0);
      const nothing = getComputedStyle(document.getElementById('explain')).display === 'none';
      return nothing;
    });
    ok('asking about a blow that is not on file shows nothing', empty);
  }
};

// F05. Everything a hostile's death was worth lived inside applyDamageHit, and three other
// paths reach zero without going through it: a status tick in applyTurnStartEffects, which set
// hp to 0 and played a sound; RECKONING, which sets a packmate's hp to 0 outright to feed on
// it; and the Hazmat's CAP_DEAD_MANS_SWITCH, which vents over the whole field on the way down
// and was written after the ledger it was skipping.
//
// A kill down any of those was worth nothing at all: no runStats.kills, no KILL, EXECUTE or
// HEAVY contract, no bestiary line, no Tally, no Blood Debt, no Gas Bloom, no Martyr, no
// momentum. E12b turned a bleed build into a real build by giving nine more moves a mark to
// cash, and it was the one build whose kills vanished.
//
// The shape of the test is a pair rather than a checklist: the SAME body, killed by a swing and
// killed by a bleed, has to move the same ledgers. A list of "did this go up" would pass on a
// ledger that was already broken for both.
module.exports = {
  name: 'The kill that nobody counted',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      // One hostile on an otherwise empty field, one operator, and a board that counts.
      window.__field = (build) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 2; currentTier = 5;
        initiateCombat('RAIDERS', false);
        currentWeather = 'CLEAR';
        activeEntities = activeEntities.filter(e => e.isPlayer);
        turnQueue = turnQueue.filter(e => e.isPlayer);
        activeEntities.forEach(p => { p.maxHp = 99999; p.hp = 99999; });
        bestiary = {}; runStats.kills = 0; momentum = 0; addMomentum(0);
        comboKill = false; odKills = null;
        activeBounties = ['KILL', 'EXECUTE', 'HEAVY'].map(t =>
          ({ type: t, desc: t, current: 0, target: 99, reward: 0, claimed: false }));
        standingBounty = null;
        const foe = build();
        activeEntities.push(foe); turnQueue.push(foe);
        return foe;
      };
      window.__raider = (over = {}) => {
        const r = JSON.parse(JSON.stringify(ENEMY_POOL.RAIDERS.find(u => u.name === 'Raider')));
        r.id = 'v' + Math.floor(Math.random() * 1e9); r.isPlayer = false;
        r.hp = r.maxHp = 40; r.sig = null; r.sigCd = 0; r.armor = 0; r.baseArmor = 0;
        r.intent = { type: 'ATTACK', icon: 'x' };
        return Object.assign(r, over);
      };
      // Everything the ledger touches, read in one go.
      window.__ledger = () => ({
        kills: runStats.kills || 0,
        kill: activeBounties.find(b => b.type === 'KILL').current,
        execute: activeBounties.find(b => b.type === 'EXECUTE').current,
        heavy: activeBounties.find(b => b.type === 'HEAVY').current,
        bestiary: (bestiaryEntry('Raider') || {}).killed || 0,
        momentum
      });
    });

    // ── The same body, two ways down ─────────────────────────────────────────────────
    const pair = await page.evaluate(() => {
      // Killed by a swing, which is the path that always worked.
      const bySwing = (() => {
        const foe = window.__field(() => window.__raider());
        const hero = activeEntities.find(e => e.isPlayer);
        const before = window.__ledger();
        applyDamageHit(hero, foe, 9999, 'phys', 'BASIC');
        const after = window.__ledger();
        return { dead: foe.hp <= 0, before, after };
      })();
      // Killed by the bleed it was already carrying, which is the path that counted nothing.
      const byBleed = (() => {
        const foe = window.__field(() => window.__raider({ hp: 2, bleedingTurns: 3 }));
        const before = window.__ledger();
        applyTurnStartEffects(foe);
        const after = window.__ledger();
        return { dead: foe.hp <= 0, before, after };
      })();
      combatActive = false;
      const moved = a => ({ kills: a.after.kills - a.before.kills, kill: a.after.kill - a.before.kill,
                            heavy: a.after.heavy - a.before.heavy,
                            bestiary: a.after.bestiary - a.before.bestiary,
                            momentum: a.after.momentum - a.before.momentum });
      return { swing: moved(bySwing), bleed: moved(byBleed),
               swingDead: bySwing.dead, bleedDead: byBleed.dead };
    });
    ok('a raider dies to a swing and a raider bleeds out', pair.swingDead && pair.bleedDead);
    ok(`a swing kill moves the ledger (${JSON.stringify(pair.swing)})`,
      pair.swing.kills === 1 && pair.swing.kill === 1 && pair.swing.bestiary === 1 && pair.swing.momentum === 15);
    ok(`and a bleed kill moves exactly the same one (${JSON.stringify(pair.bleed)})`,
      pair.bleed.kills === pair.swing.kills && pair.bleed.kill === pair.swing.kill
      && pair.bleed.bestiary === pair.swing.bestiary && pair.bleed.momentum === pair.swing.momentum);

    // ── Smog and shrapnel are deaths too ─────────────────────────────────────────────
    const weather = await page.evaluate(() => {
      const run = sky => {
        const foe = window.__field(() => window.__raider({ hp: 1 }));
        currentWeather = sky;
        const before = window.__ledger();
        let guard = 0;
        while (foe.hp > 0 && guard++ < 30) applyTurnStartEffects(foe);
        const after = window.__ledger();
        return { dead: foe.hp <= 0, turns: guard, moved: after.kills - before.kills,
                 bestiary: after.bestiary - before.bestiary };
      };
      const smog = run('TOXIC_SMOG');
      const shrap = run('SHRAPNEL_WINDS');
      combatActive = false;
      return { smog, shrap };
    });
    ok(`a hostile choked by smog is counted (${weather.smog.moved} kill, ${weather.smog.bestiary} filed)`,
      weather.smog.dead && weather.smog.moved === 1 && weather.smog.bestiary === 1);
    ok(`so is one the shrapnel finds (${weather.shrap.turns} turns)`,
      weather.shrap.dead && weather.shrap.moved === 1 && weather.shrap.bestiary === 1);

    // ── A heavy brought down by a bleed is still a heavy ─────────────────────────────
    const heavy = await page.evaluate(() => {
      const foe = window.__field(() => window.__raider({ hp: 2, bleedingTurns: 3, isHeavy: true }));
      const before = window.__ledger();
      applyTurnStartEffects(foe);
      const after = window.__ledger();
      combatActive = false;
      return { heavy: after.heavy - before.heavy, kill: after.kill - before.kill };
    });
    ok(`a heavy bled out ticks the HEAVY contract as well as the KILL one (${heavy.heavy}/${heavy.kill})`,
      heavy.heavy === 1 && heavy.kill === 1);

    // ── But a bleed tick cannot cash an EXECUTE left over from the last swing ────────
    const stale = await page.evaluate(() => {
      const foe = window.__field(() => window.__raider({ hp: 2, bleedingTurns: 3 }));
      comboKill = true;                       // as a combo finish leaves it
      const before = window.__ledger();
      applyTurnStartEffects(foe);
      const after = window.__ledger();
      comboKill = false;
      combatActive = false;
      return { execute: after.execute - before.execute, kill: after.kill - before.kill };
    });
    ok(`the KILL ticks and the EXECUTE does not (${stale.kill}/${stale.execute})`,
      stale.kill === 1 && stale.execute === 0);

    // ── The on-death signatures fire wherever the body falls ────────────────────────
    const sigs = await page.evaluate(() => {
      // A chem fiend bursts over the squad.
      const bloom = (() => {
        const foe = window.__field(() => {
          const f = JSON.parse(JSON.stringify(ENEMY_POOL.RAIDERS.find(u => u.sig === 'GAS_BLOOM')
                                           || Object.values(ENEMY_POOL).flat().find(u => u.sig === 'GAS_BLOOM')));
          f.id = 'fiend'; f.isPlayer = false; f.hp = 2; f.maxHp = 40; f.bleedingTurns = 3; f.sigCd = 0;
          f.intent = { type: 'ATTACK', icon: 'x' };
          return f;
        });
        const line = activeEntities.filter(e => e.isPlayer && e.hp > 0);
        line.forEach(p => { p.corrodedTurns = 0; });
        applyTurnStartEffects(foe);
        return { dead: foe.hp <= 0, bloomed: !!foe.bloomed,
                 choking: line.filter(p => (p.corrodedTurns || 0) > 0).length, of: line.length };
      })();
      // A reliquary breaks open and the Choir takes it up.
      const martyr = (() => {
        const foe = window.__field(() => {
          const f = JSON.parse(JSON.stringify(Object.values(ENEMY_POOL).flat().find(u => u.sig === 'MARTYR')));
          f.id = 'rel'; f.isPlayer = false; f.hp = 2; f.maxHp = 40; f.bleedingTurns = 3; f.sigCd = 0;
          f.intent = { type: 'ATTACK', icon: 'x' };
          return f;
        });
        const flock = Object.values(ENEMY_POOL).flat().filter(u => u.classType === 'CULTIST')[0];
        const friend = JSON.parse(JSON.stringify(flock));
        friend.id = 'cult'; friend.isPlayer = false; friend.maxHp = 100; friend.hp = 20; friend.sigCd = 0;
        friend.intent = { type: 'ATTACK', icon: 'x' };
        activeEntities.push(friend); turnQueue.push(friend);
        applyTurnStartEffects(foe);
        return { dead: foe.hp <= 0, martyred: !!foe.martyred, healed: friend.hp };
      })();
      combatActive = false;
      return { bloom, martyr };
    });
    ok(`a chem fiend bled out still bursts (${sigs.bloom.choking} of ${sigs.bloom.of} choking)`,
      sigs.bloom.dead && sigs.bloom.bloomed && sigs.bloom.choking === sigs.bloom.of && sigs.bloom.of > 0);
    ok(`and a reliquary bled out still breaks open over the Choir (cultist at ${sigs.martyr.healed})`,
      sigs.martyr.dead && sigs.martyr.martyred && sigs.martyr.healed > 20);

    // ── The commander's two ledgers, on a body it did not swing at ──────────────────
    const boss = await page.evaluate(() => {
      const stage = () => {
        const foe = window.__field(() => window.__raider({ hp: 2, bleedingTurns: 3 }));
        const warlord = { id: 'b1', name: 'Warlord', classType: 'BOSS', isPlayer: false,
                          maxHp: 1000, hp: 500, armor: 0, baseArmor: 0, dmgBase: 30, speed: 5,
                          scale: 1, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0,
                          oiledTurns: 0, corrodedTurns: 0, markedTurns: 0,
                          resistances: { phys: 0, bio: 0, energy: 0 },
                          intent: { type: 'ATTACK', icon: 'x' } };
        activeEntities.push(warlord); turnQueue.push(warlord);
        return { foe, warlord };
      };
      const fed = (() => {
        const { foe, warlord } = stage();
        warlord.bloodDebt = 0.05;
        const before = warlord.hp;
        applyTurnStartEffects(foe);
        return { dead: foe.hp <= 0, gained: warlord.hp - before };
      })();
      const tallied = (() => {
        const { foe, warlord } = stage();
        warlord.tally = { max: 4, armor: 4, dmg: 0.06 }; warlord.tallyStacks = 0;
        applyTurnStartEffects(foe);
        return { dead: foe.hp <= 0, stacks: warlord.tallyStacks || 0 };
      })();
      combatActive = false;
      return { fed, tallied };
    });
    ok(`a commander that feeds on its own dead feeds on one that bled out (+${boss.fed.gained} HP)`,
      boss.fed.dead && boss.fed.gained > 0);
    ok(`and one that keeps a tally writes it down (${boss.tallied.stacks})`,
      boss.tallied.dead && boss.tallied.stacks === 1);

    // ── RECKONING: eaten is still killed ────────────────────────────────────────────
    const eaten = await page.evaluate(() => {
      const foe = window.__field(() => window.__raider({ hp: 8, maxHp: 40 }));
      const eater = window.__raider({ hp: 200, maxHp: 400, id: 'eater' });
      eater.sig = 'RECKONING'; eater.sigCd = 0;
      eater.intent = { type: 'SIG', sig: 'RECKONING', icon: 'x' };
      activeEntities.push(eater); turnQueue.push(eater);
      const before = window.__ledger();
      const ateHp = eater.hp;
      executeEnemyAi(eater);
      const after = window.__ledger();
      combatActive = false;
      return { victimDead: foe.hp <= 0, healed: eater.hp > ateHp,
               kills: after.kills - before.kills, kill: after.kill - before.kill,
               bestiary: after.bestiary - before.bestiary };
    });
    ok(`a packmate eaten by RECKONING dies and feeds (${eaten.victimDead}/${eaten.healed})`,
      eaten.victimDead && eaten.healed);
    ok(`and is counted like any other body (${eaten.kills} kill, ${eaten.bestiary} filed)`,
      eaten.kills === 1 && eaten.kill === 1 && eaten.bestiary === 1);

    // ── The Hazmat's last act ───────────────────────────────────────────────────────
    const vent = await page.evaluate(() => {
      const foe = window.__field(() => window.__raider({ hp: 3, maxHp: 40 }));
      const hazmat = activeEntities.find(e => e.isPlayer);
      hazmat.classType = 'HAZMAT';
      hazmat.traits = [...(hazmat.traits || []), 'CAP_DEAD_MANS_SWITCH'];   // hasCap reads traits
      const before = window.__ledger();
      hazmat.hp = 0;
      goDown(hazmat);
      const after = window.__ledger();
      combatActive = false;
      return { foeDead: foe.hp <= 0, kills: after.kills - before.kills,
               bestiary: after.bestiary - before.bestiary };
    });
    ok(`the tanks let go and take a raider with them (${vent.foeDead})`, vent.foeDead);
    ok(`and that one is counted too (${vent.kills} kill, ${vent.bestiary} filed)`,
      vent.kills === 1 && vent.bestiary === 1);

    // ── What the ledger refuses ─────────────────────────────────────────────────────
    const refuses = await page.evaluate(() => {
      const foe = window.__field(() => window.__raider({ hp: 20 }));
      const alive = noteKill(foe, {});
      const hero = activeEntities.find(e => e.isPlayer);
      hero.hp = 0;
      const operator = noteKill(hero, {});
      foe.hp = 0;
      const before = window.__ledger();
      const first = noteKill(foe, {});
      const second = noteKill(foe, {});
      const after = window.__ledger();
      combatActive = false;
      return { alive, operator, first, second,
               kills: after.kills - before.kills, momentum: after.momentum - before.momentum };
    });
    ok('a hostile still standing is not a kill', refuses.alive === false);
    ok('an operator on the floor is not one either', refuses.operator === false);
    ok(`and a body is filed once, however many times it is offered (${refuses.kills} kill, +${refuses.momentum})`,
      refuses.first === true && refuses.second === false && refuses.kills === 1 && refuses.momentum === 15);

    // ── The order it reads in ───────────────────────────────────────────────────────
    const order = await page.evaluate(() => {
      const foe = window.__field(() => {
        const f = JSON.parse(JSON.stringify(Object.values(ENEMY_POOL).flat().find(u => u.sig === 'GAS_BLOOM')));
        f.id = 'fiend2'; f.isPlayer = false; f.hp = f.maxHp = 40; f.sigCd = 0;
        f.intent = { type: 'ATTACK', icon: 'x' };
        return f;
      });
      const hero = activeEntities.find(e => e.isPlayer);
      document.getElementById('log').innerHTML = '';
      applyDamageHit(hero, foe, 9999, 'phys', 'BASIC');
      const lines = document.getElementById('log').innerText.split('\n').filter(Boolean);
      combatActive = false;
      const hit = lines.findIndex(l => /hits/.test(l));
      const burst = lines.findIndex(l => /bursts/.test(l));
      return { hit, burst, lines: lines.slice(0, 4) };
    });
    ok(`the blow is logged before what the blow caused (${order.lines.join(' | ')})`,
      order.hit >= 0 && order.burst > order.hit);

    // ── A body put back on its feet can fall twice ──────────────────────────────────
    // The one-shot guard is what made the ledger safe to call from four places, and it is also
    // what a raise has to clear. The harness's two-way kill count found this within one sample.
    const raised = await page.evaluate(() => {
      const foe = window.__field(() => {
        const f = JSON.parse(JSON.stringify(Object.values(ENEMY_POOL).flat().find(u => u.sig === 'MARTYR')));
        f.id = 'twice'; f.isPlayer = false; f.hp = f.maxHp = 40; f.sigCd = 0;
        f.intent = { type: 'ATTACK', icon: 'x' };
        return f;
      });
      const hero = activeEntities.find(e => e.isPlayer);
      // Its own bestiary line, not the Raider one the shared reader watches.
      const filed = () => (bestiaryEntry(typeNameOf(foe)) || {}).killed || 0;
      const before = window.__ledger(); const bestBefore = filed();
      applyDamageHit(hero, foe, 9999, 'phys', 'BASIC');
      const first = window.__ledger(); const bestFirst = filed();
      const martyredOnce = !!foe.martyred;
      raiseBody(foe, 0.5);
      const up = { hp: foe.hp, tallied: !!foe.tallied, martyred: !!foe.martyred };
      applyDamageHit(hero, foe, 9999, 'phys', 'BASIC');
      const second = window.__ledger(); const bestSecond = filed();
      combatActive = false;
      return { martyredOnce, up,
               firstKill: first.kills - before.kills, secondKill: second.kills - first.kills,
               firstBest: bestFirst - bestBefore, secondBest: bestSecond - bestFirst };
    });
    ok(`a raise puts it back on its feet with the ledger's guard cleared (hp ${raised.up.hp})`,
      raised.up.hp > 0 && raised.up.tallied === false);
    ok('and clears the martyr flag too, so the second death is as loud as the first',
      raised.martyredOnce === true && raised.up.martyred === false);
    ok(`so falling twice is two kills, not one (${raised.firstKill} then ${raised.secondKill})`,
      raised.firstKill === 1 && raised.secondKill === 1
      && raised.firstBest === 1 && raised.secondBest === 1);
  }
};

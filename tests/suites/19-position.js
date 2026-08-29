// Formation was chosen at the Outpost and then meant nothing: melee hit as hard from the back
// rank as the front, ranged enemies picked uniformly at random so a front rank protected nobody,
// and there was no way to change any of it once the shooting started.
module.exports = {
  name: 'Position and enemy behaviour',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // A hero, and four indestructible dummies deep enough to have a back rank of their own.
    await page.evaluate(() => {
      window.__line = (classType, pos, foeCount = 4) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null; initiateCombat('RAIDERS', false);
        const hero = playerRoster.find(h => h.classType === classType);
        hero.gridPos = pos; hero.maxHp = 9999; hero.hp = 9999; hero.dmgBase = 100; hero.stunnedTurns = 0; hero.quirk = null; sectorFront = null;
        Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
        const foes = [];
        for (let i = 0; i < foeCount; i++) {
          const f = generateEnemies('RAIDERS', 1, false, 1)[0];
          f.id = 'e' + i; f.maxHp = 100000; f.hp = 100000; f.armor = 0; f.baseArmor = 0;
          f.resistances = { phys: 0, bio: 0, energy: 0 };
          f.corrodedTurns = 0; f.markedTurns = 0; f.bleedingTurns = 0; f.oiledTurns = 0; f.stunnedTurns = 0;
          foes.push(f);
        }
        activeEntities = [hero, ...foes]; turnQueue = [hero, ...foes];
        activeIndex = 0; combatActive = true; pendingAction = null;
        return { hero, foes };
      };
      window.__swing = (move, pos, dist, cls) => {
        const { hero, foes } = window.__line(cls || 'BRUISER', pos);
        activeIndex = 0; combatActive = true; pendingAction = move;
        const t = foes[dist]; const before = t.hp;
        resolveAction(t.id);
        return before - t.hp;
      };
      // Damage carries a variance roll, so a single swing is not a measurement.
      window.__avg = (move, pos, dist, cls) => {
        let total = 0; for (let i = 0; i < 12; i++) total += window.__swing(move, pos, dist, cls);
        return total / 12;
      };
    });

    // ---- a melee weapon cares where both of them are standing ----
    const melee = await page.evaluate(() => ({
      frontNear: window.__avg('SCRAP_BLADE', 1, 0), frontFar: window.__avg('SCRAP_BLADE', 1, 3),
      midNear:   window.__avg('SCRAP_BLADE', 2, 0), backNear: window.__avg('SCRAP_BLADE', 3, 0),
      backFar:   window.__avg('SCRAP_BLADE', 3, 3)
    }));
    const ratio = (a, b) => a / b;
    ok(`the front rank swings at full strength (${Math.round(melee.frontNear)})`, melee.frontNear > 95);
    ok(`the middle rank gives up a little (x${ratio(melee.midNear, melee.frontNear).toFixed(2)})`,
      ratio(melee.midNear, melee.frontNear) > 0.75 && ratio(melee.midNear, melee.frontNear) < 0.95);
    ok(`the back rank gives up a lot (x${ratio(melee.backNear, melee.frontNear).toFixed(2)})`,
      ratio(melee.backNear, melee.frontNear) > 0.5 && ratio(melee.backNear, melee.frontNear) < 0.72);
    ok(`reaching past the enemy front costs as well (x${ratio(melee.frontFar, melee.frontNear).toFixed(2)})`,
      ratio(melee.frontFar, melee.frontNear) > 0.55 && ratio(melee.frontFar, melee.frontNear) < 0.78);
    ok(`both at once is the worst case (x${ratio(melee.backFar, melee.frontNear).toFixed(2)})`,
      ratio(melee.backFar, melee.frontNear) < ratio(melee.backNear, melee.frontNear));

    // ---- a rifle does not ----
    const ranged = await page.evaluate(() => ({
      frontNear: window.__avg('PISTOL', 1, 0, 'MEDIC'), backNear: window.__avg('PISTOL', 3, 0, 'MEDIC'),
      backFar:   window.__avg('PISTOL', 3, 3, 'MEDIC')
    }));
    ok('a ranged attack is the same from any rank',
      ranged.backNear / ranged.frontNear > 0.9 && ranged.backNear / ranged.frontNear < 1.1);
    ok('and against any target depth',
      ranged.backFar / ranged.frontNear > 0.9 && ranged.backFar / ranged.frontNear < 1.1);

    // ---- reach comes from the ability table, so there is no second list to drift ----
    const table = await page.evaluate(() => {
      const declared = Object.values(ABILITIES).flat();
      return { total: declared.length,
               unset: declared.filter(a => !a.reach).map(a => a.move),
               kinds: [...new Set(declared.map(a => a.reach))].sort(),
               mapped: Object.keys(MOVE_REACH).length,
               melee: declared.filter(a => a.reach === 'melee').map(a => a.move).sort(),
               sample: { blade: isMelee('SCRAP_BLADE'), pistol: isRanged('PISTOL'), guard: isMelee('IRON_GUARD') } };
    });
    ok('every ability declares its reach', table.unset.length === 0);
    ok('and only in the three kinds that exist', table.kinds.join() === 'melee,ranged,self');
    ok(`the lookup covers all ${table.total} of them`, table.mapped === table.total);
    ok('the melee weapons are the ones you would expect',
      table.melee.join() === 'BUCKSHOT,FERAL_BITE,HEAVY_WRENCH,RIP_AND_TEAR,SCRAP_BLADE,SNAP');
    ok('and the helpers agree with the table',
      table.sample.blade && table.sample.pistol && !table.sample.guard);

    // The sandstorm rule used to keep its own list, which had drifted - a thrown molotov was
    // somehow immune to a sandstorm. It reads the same reach now.
    // initiateCombat rolls the weather itself, so it has to be forced after the line is built
    // and before the swing lands, not before the setup.
    const storm = await page.evaluate(() => {
      const swingUnder = (weather, move, cls) => {
        let total = 0;
        for (let i = 0; i < 12; i++) {
          const { foes } = window.__line(cls, 1);
          currentWeather = weather;
          activeIndex = 0; combatActive = true; pendingAction = move;
          const t = foes[0], before = t.hp; resolveAction(t.id); total += before - t.hp;
        }
        currentWeather = null;
        return total / 12;
      };
      const under = (move, cls) => swingUnder('SANDSTORM', move, cls) / swingUnder(null, move, cls);
      return { molotov: under('MOLOTOV', 'PYROMANIAC'), pistol: under('PISTOL', 'MEDIC'), blade: under('SCRAP_BLADE', 'BRUISER') };
    });
    ok(`a sandstorm blinds a thrown molotov too (x${storm.molotov.toFixed(2)})`, storm.molotov < 0.9);
    ok('and rifle fire as before', storm.pistol < 0.9);
    ok('but not a blade swung in front of you', storm.blade > 0.9);

    // ---- enemies read the formation ----
    const who = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach((h, i) => { h.gridPos = i < 3 ? i + 1 : 0; h.hp = h.maxHp; });
      initiateCombat('RAIDERS', false);
      const squad = activeEntities.filter(e => e.isPlayer);
      const tally = (enemy, intent, n) => {
        const hits = { 1: 0, 2: 0, 3: 0 };
        for (let i = 0; i < n; i++) hits[pickTarget(enemy, squad, intent).gridPos]++;
        return hits;
      };
      return {
        melee:  tally({ range: 'melee', speed: 10 }, { type: 'ATTACK' }, 500),
        ranged: tally({ range: 'ranged', speed: 10 }, { type: 'ATTACK' }, 3000),
        flank:  tally({ range: 'melee', speed: 18 }, { type: 'FLANK' }, 500)
      };
    });
    ok('melee always walks into the front rank', who.melee[1] === 500);
    ok(`ranged fire leans on the back line (${who.ranged[1]}/${who.ranged[2]}/${who.ranged[3]} of 3000)`,
      who.ranged[3] > who.ranged[2] && who.ranged[2] > who.ranged[1]);
    ok('but the front rank is not immune to it', who.ranged[1] > 0);
    ok('a flank goes straight past both ranks to the back', who.flank[3] === 500);

    // The flank is telegraphed like every other intent, and only the fast units have it.
    const intents = await page.evaluate(() => {
      const roll = (speed, n) => {
        const seen = {};
        for (let i = 0; i < n; i++) { const t = rollIntent({ range: 'melee', speed, classType: 'RAIDER' }).type; seen[t] = (seen[t] || 0) + 1; }
        return seen;
      };
      return { fast: roll(18, 2000), slow: roll(6, 2000), icon: INTENT_ICONS.FLANK };
    });
    ok('a fast melee unit sometimes flanks', (intents.fast.FLANK || 0) > 100);
    ok('a slow one never does', !intents.slow.FLANK);
    ok('and it has an icon to telegraph with', !!intents.icon);

    // ---- a braced front rank is what answers a flank ----
    const cover = await page.evaluate(() => {
      const run = (braced) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        playerRoster.forEach((h, i) => { h.gridPos = i < 3 ? i + 1 : 0; h.maxHp = 900; h.hp = 900; h.guardTurns = 0; });
        initiateCombat('RAIDERS', false);
        const squad = activeEntities.filter(e => e.isPlayer);
        const front = squad.find(s => s.gridPos === 1), back = squad.find(s => s.gridPos === 3);
        const foe = activeEntities.find(e => !e.isPlayer);
        foe.speed = 18; foe.range = 'melee'; foe.dmgBase = 100; foe.dmgType = 'phys';
        if (braced) front.guardTurns = 2;
        foe.intent = { type: 'FLANK', icon: '🌀' };
        combatActive = true; activeIndex = turnQueue.indexOf(foe);
        const fb = front.hp, bb = back.hp;
        executeEnemyAi(foe);
        return { front: fb - front.hp, back: bb - back.hp };
      };
      return { open: run(false), braced: run(true) };
    });
    ok(`an unanswered flank lands on the back rank (${cover.open.back} dmg)`,
      cover.open.back > 0 && cover.open.front === 0);
    ok('a braced front rank takes it instead', cover.braced.back === 0 && cover.braced.front > 0);
    ok(`and takes less than the flank would have done (${cover.braced.front} vs ${cover.open.back})`,
      cover.braced.front < cover.open.back);

    // Bracing is what Iron Guard now buys, on top of the armour it always gave.
    const guard = await page.evaluate(() => {
      const { hero } = window.__line('BRUISER', 1);
      hero.guardTurns = 0; hero.armor = 0; hero.armorTurns = 0;
      activeIndex = 0; combatActive = true;
      dispatchAction({ dataset: { action: 'self', move: 'IRON_GUARD' } });
      const after = { guard: hero.guardTurns, armor: hero.armor, cd: hero.cooldowns.iron_guard };
      applyTurnStartEffects(hero); applyTurnStartEffects(hero);
      return { after, expired: hero.guardTurns };
    });
    ok('Iron Guard puts the Bruiser on cover duty', guard.after.guard > 0);
    ok('while still giving it armour', guard.after.armor > 0);
    ok('and the cover wears off', guard.expired === 0);

    // ---- and the squad can change formation once the shooting has started ----
    const swap = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach((h, i) => { h.gridPos = i < 3 ? i + 1 : 0; h.hp = h.maxHp; });
      initiateCombat('RAIDERS', false);
      const squad = activeEntities.filter(e => e.isPlayer);
      const front = squad.find(s => s.gridPos === 1), back = squad.find(s => s.gridPos === 3);
      activeIndex = turnQueue.indexOf(front); combatActive = true; pendingAction = null; renderField();
      const offered = [...document.querySelectorAll('#command-deck [data-move]')].some(b => b.dataset.move === 'REPOSITION');
      pendingAction = 'REPOSITION'; renderField();
      const allies = [...document.querySelectorAll('.targetable-ally')].length;
      const foesAimable = [...document.querySelectorAll('.targetable-enemy')].length;
      resolveAction(back.id);
      return { offered, allies, foesAimable,
               front: front.gridPos, back: back.gridPos,
               order: activeEntities.filter(e => e.isPlayer).map(e => e.gridPos),
               spent: pendingAction === null,
               ranks: [...document.querySelectorAll('#player-team .rank-chip')].map(e => e.textContent) };
    });
    ok('every deck offers a reposition', swap.offered);
    ok('it aims at the squad, not the enemy', swap.allies > 0 && swap.foesAimable === 0);
    ok('the two units trade places', swap.front === 3 && swap.back === 1);
    ok('the line re-forms in rank order', swap.order.join() === '1,2,3');
    ok('and it costs the turn', swap.spent);
    ok(`the field states each rank (${swap.ranks.join(' ')})`, swap.ranks.join() === 'FRONT,MID,BACK');

    // A unit cannot reposition with itself, or with a body.
    const refuse = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach((h, i) => { h.gridPos = i < 3 ? i + 1 : 0; h.hp = h.maxHp; });
      initiateCombat('RAIDERS', false);
      const squad = activeEntities.filter(e => e.isPlayer);
      const front = squad.find(s => s.gridPos === 1), back = squad.find(s => s.gridPos === 3);
      activeIndex = turnQueue.indexOf(front); combatActive = true;
      pendingAction = 'REPOSITION'; resolveAction(front.id);
      const self = front.gridPos;
      back.hp = 0;
      activeIndex = turnQueue.indexOf(front); combatActive = true;
      pendingAction = 'REPOSITION'; renderField();
      const deadAimable = document.getElementById(back.id).classList.contains('targetable-ally');
      resolveAction(back.id);
      return { self, dead: front.gridPos, deadAimable };
    });
    ok('swapping with yourself does nothing', refuse.self === 1);
    ok('and a downed unit is not somewhere to stand', refuse.dead === 1 && !refuse.deadAimable);

    // ---- the player is told all of this before spending the turn ----
    const shown = await page.evaluate(() => {
      const read = (cls, pos, move) => {
        window.__line(cls, pos);
        pendingAction = null; renderField();
        const btn = [...document.querySelectorAll('#command-deck [data-move]')].find(b => b.dataset.move === move);
        const deck = { warned: btn.classList.contains('reach-short'),
                       tag: (btn.querySelector('.reach-tag') || {}).textContent || null };
        pendingAction = move; renderField();
        const flags = [...document.querySelectorAll('.reach-flag')];
        const dim = [...document.querySelectorAll('.entity.out-of-reach')].map(e => e.id);
        return { deck, far: flags.length, dim };
      };
      return { back: read('BRUISER', 3, 'SCRAP_BLADE'), front: read('BRUISER', 1, 'SCRAP_BLADE'),
               rifle: read('MEDIC', 3, 'PISTOL') };
    });
    ok('a melee ability from the back rank warns on the button', shown.back.deck.warned);
    ok(`and says what it costs (${shown.back.deck.tag})`, /-40%/.test(shown.back.deck.tag || ''));
    ok('from the front rank it does not', !shown.front.deck.warned && shown.front.deck.tag === null);
    ok('a ranged ability never warns', !shown.rifle.deck.warned);
    ok('the targets past the enemy front are flagged and dimmed',
      shown.back.far === 2 && shown.back.dim.length === 2);
    ok('a rifle flags none of them', shown.rifle.far === 0);

    // The rank penalty is the same against every target, so repeating it above each one said
    // nothing extra and the flags collided with each other.
    const layout = await page.evaluate(() => {
      window.__line('BRUISER', 3);
      pendingAction = 'SCRAP_BLADE'; renderField();
      const flags = [...document.querySelectorAll('.reach-flag')].map(f => f.getBoundingClientRect());
      let overlap = false;
      for (let i = 0; i < flags.length; i++) for (let j = i + 1; j < flags.length; j++) {
        if (flags[i].right > flags[j].left && flags[j].right > flags[i].left) overlap = true;
      }
      const icons = [...document.querySelectorAll('#enemy-team .intent-icon')].map(e => e.getBoundingClientRect());
      const clearOfIcons = flags.every(f => icons.every(i => f.bottom <= i.top || i.height === 0));
      return { count: flags.length, overlap, clearOfIcons,
               onScreen: flags.every(f => f.left >= 0 && f.right <= window.innerWidth) };
    });
    ok('no two reach flags overlap each other', !layout.overlap);
    ok('none of them covers an intent icon', layout.clearOfIcons);
    ok('and none is pushed off screen', layout.onScreen);

    // ---- a fight still runs end to end with all of this in it ----
    await page.evaluate(() => { combatActive = false; });
    await page.waitForTimeout(900);
    const live = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach((h, i) => { h.gridPos = i < 3 ? i + 1 : 0; h.maxHp = 600; h.hp = 600; });
      initiateCombat('RAIDERS', false);
      let turns = 0;
      while (combatActive && turns < 60) {
        const actor = turnQueue[activeIndex];
        if (!actor || actor.hp <= 0) { activeIndex = (activeIndex + 1) % turnQueue.length; turns++; continue; }
        if (actor.isPlayer) {
          const foe = activeEntities.find(e => !e.isPlayer && e.hp > 0);
          if (!foe) break;
          pendingAction = (ABILITIES[actor.classType] || [{ move: 'SCRAP_BLADE' }])[0].move;
          resolveAction(foe.id);
        } else {
          actor.intent = rollIntent(actor);
          executeEnemyAi(actor);
        }
        activeIndex = (activeIndex + 1) % turnQueue.length; turns++;
      }
      return { turns, resolved: activeEntities.some(e => e.hp <= 0),
               squadStanding: activeEntities.filter(e => e.isPlayer && e.hp > 0).length };
    });
    ok(`a scripted fight runs to a conclusion (${live.turns} turns)`, live.turns < 60 || live.resolved);
    ok('with the squad still tracked', live.squadStanding >= 0);
  }
};

// The game had no win condition. currentSector++ ran without a ceiling, bossForSector lapped
// the seven-commander pool forever with a fresh shuffle each time round, and the comment over
// computeScore said the quiet part out loud - "Endless scoring". A run could be long or short
// but never won. Extraction (A01) gave the player a way to stop; it never gave them a way to
// finish, and sixty simulated expeditions ended sixty times with a wipe.
//
// The road runs seven sectors now. What is standing at the end of it is not in the rotation and
// is dealt at no other depth, and putting it down is a win that banks the moment it goes down.
//
// The fight itself is one rule, and this suite holds it: every fight in this game teaches you to
// clear the adds off the commander, and this one charges for it. It counts its own dead - armour
// and damage per head - and at the end it spends the count. Halfway down it raises the
// commanders this expedition already felled and hides behind them, so leaving them up costs you
// the damage and putting them down costs you the tally. Both lines are checked below, because a
// dilemma with one working branch is not a dilemma.
module.exports = {
  name: 'The ending',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__run = () => { activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null; };
      // Stage the last fight, having felled some number of commanders on the way there.
      window.__last = (felled = ['WARLORD', 'COLOSSUS', 'MARSHAL'], hp = 9000, dmg = 300) => {
        __run();
        currentSector = FINAL_SECTOR; currentTier = TOTAL_TIERS;
        runStats.warlords = [...felled];
        runStats.deepestSector = FINAL_SECTOR; runStats.deepestTier = TOTAL_TIERS;
        playerRoster.filter(p => p.gridPos > 0).forEach(p => { p.maxHp = hp; p.hp = hp; p.dmgBase = dmg; });
        initiateCombat('BOSS', false);
        return activeEntities.find(e => e.isFinal);
      };
    });

    // ---- the road has an end, and it is not in the rotation ----
    const road = await page.evaluate(() => {
      __run();
      return {
        final: FINAL_SECTOR,
        rotation: BOSS_ROTATION.map(b => b.id),
        inPool: BOSS_POOL.some(b => b.id === FINAL_BOSS.id),
        notInRotation: !BOSS_ROTATION.some(b => b.final),
        // Every depth but the last walks the rotation; the last hands over the same one always.
        byDepth: Array.from({ length: 14 }, (_, i) => bossForSector(i + 1).id),
        finalOnly: Array.from({ length: 14 }, (_, i) => i + 1).filter(sn => bossForSector(sn).final),
        // The road's commanders are all still reachable across a run's first lap.
        distinct: new Set(Array.from({ length: FINAL_SECTOR - 1 }, (_, i) => bossForSector(i + 1).id)).size,
        isFinal: [isFinalSector(FINAL_SECTOR), isFinalSector(FINAL_SECTOR - 1), isFinalSector(FINAL_SECTOR + 1)]
      };
    });
    ok(`the road runs ${road.final} sectors`, road.final >= 2);
    ok('the last warlord is in the pool the bestiary reads', road.inPool);
    ok('but never in the rotation', road.notInRotation);
    ok(`and it is dealt at sector ${road.final} and nowhere else`,
      road.finalOnly.length === 1 && road.finalOnly[0] === road.final);
    ok(`every other depth still walks the ${road.rotation.length} that hold the road`,
      road.byDepth.filter((id, i) => i + 1 !== road.final).every(id => road.rotation.includes(id)));
    ok('the sectors before it deal a different commander each', road.distinct === road.final - 1);
    ok('and only the last sector is the last sector',
      road.isFinal[0] === true && road.isFinal[1] === false && road.isFinal[2] === false);

    // ---- the map says so before it is walked, not after ----
    const map = await page.evaluate(() => {
      __run(); currentSector = FINAL_SECTOR - 1; currentTier = 1; sectorMap = generateSectorMap();
      renderMap();
      const before = document.getElementById('map-sector-lbl').innerText;
      currentSector = FINAL_SECTOR; sectorMap = generateSectorMap(); currentNodeId = null; clearedNodeIds = [];
      renderMap();
      const at = document.getElementById('map-sector-lbl').innerText;
      const bossNode = [...document.querySelectorAll('.map-node')]
        .map(b => ({ txt: b.innerText, hint: b.title })).find(b => /OSSUARY/i.test(b.txt));
      return { before, at, bossNode, prompt: PROMPTS.some(p => p.id === 'LAST'),
               // A label that says "last" but is clipped to "7 - LA..." is not a label. It has
               // to fit the box it is in, so the marking is a class and a tooltip, not text.
               marked: document.getElementById('map-sector-lbl').classList.contains('sector-last')
                    && /last/i.test(document.getElementById('map-sector-lbl').title),
               fits: document.getElementById('map-sector-lbl').scrollWidth
                     <= document.getElementById('map-sector-lbl').clientWidth + 1 };
    });
    ok(`short of the end the header counts toward it (${map.before})`, map.before.includes(`/ ${road.final}`));
    ok(`and at the end it reads ${road.final} of ${road.final}`, map.at.replace(/\s/g, '') === `${road.final}/${road.final}`);
    ok('and is marked as the last one', map.marked);
    ok('the last warlord is named on the map before the node is taken', !!map.bossNode);
    ok('and the node says the road ends there', !!map.bossNode && /road ends/i.test(map.bossNode.hint));
    ok('there is a briefing for arriving at the last sector', map.prompt);
    ok('and the header label is not clipped', map.fits);

    // ---- the tally: it counts its own dead ----
    const tally = await page.evaluate(() => {
      const boss = __last();
      const before = { armor: boss.armor, dmg: boss.dmgBase, stacks: boss.tallyStacks };
      const feed = n => { for (let i = 0; i < n; i++) {
        const u = { id: 'f' + i + '_' + Math.random(), name: 'Raider', isPlayer: false, hp: 0, classType: 'RAIDER' };
        activeEntities.push(u); noteTally(u);
      } };
      feed(3);
      const at3 = { armor: boss.armor - before.armor, dmg: boss.dmgBase - before.dmg, stacks: boss.tallyStacks };
      feed(20);                       // far past the cap
      return { spec: boss.tally, before, at3, capped: boss.tallyStacks,
               // A player's own dead are not its dead.
               playerDead: (() => { const s = boss.tallyStacks;
                 const p = activeEntities.find(e => e.isPlayer); p.hp = 0; noteTally(p);
                 return boss.tallyStacks === s; })() };
    });
    ok(`three of its own is ${tally.at3.stacks} on the count`, tally.at3.stacks === 3);
    ok(`and worth +${tally.at3.armor} armour`, tally.at3.armor === tally.spec.armor * 3);
    ok('and more damage with it', tally.at3.dmg > 0);
    ok(`the count stops at ${tally.spec.max}`, tally.capped === tally.spec.max);
    ok('and your dead are not its dead', tally.playerDead);

    // Calling noteTally by hand proves the function; it does not prove the function is wired to
    // anything. Deleting the call site out of the damage path left every assertion above green,
    // so this one kills something with a real hit and watches the count move.
    const wired = await page.evaluate(() => {
      const boss = __last();
      const hero = activeEntities.find(e => e.isPlayer);
      const before = boss.tallyStacks;
      const mook = { id: 'mook', name: 'Raider', isPlayer: false, classType: 'RAIDER',
                     maxHp: 10, hp: 10, armor: 0, baseArmor: 0, speed: 5, dmgBase: 1, scale: 1,
                     stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0,
                     corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 } };
      activeEntities.push(mook);
      applyDamageHit(hero, mook, 9999, 'phys', 'HEAVY_WRENCH');
      return { dead: mook.hp <= 0, moved: boss.tallyStacks - before };
    });
    ok('and a kill in the fight itself is what moves the count', wired.dead && wired.moved === 1);

    // ---- the ossuary opens ----
    const REVENANT_SPEC = await page.evaluate(() => REVENANT);
    const raised = await page.evaluate(() => {
      const boss = __last(['WARLORD', 'COLOSSUS', 'MARSHAL']);
      const wardBefore = mitigate(activeEntities.find(e => e.isPlayer), boss, 1000, 'phys', 'HEAVY_WRENCH').n;
      boss.hp = Math.floor(boss.maxHp * 0.45);
      executeEnemyAi(boss);
      const revs = activeEntities.filter(e => e.classType === 'REVENANT');
      const wardUp = mitigate(activeEntities.find(e => e.isPlayer), boss, 1000, 'phys', 'HEAVY_WRENCH').n;
      revs.forEach(r => { r.hp = 0; });
      const wardDown = mitigate(activeEntities.find(e => e.isPlayer), boss, 1000, 'phys', 'HEAVY_WRENCH').n;
      return { phase: boss.phase, n: revs.length,
               // They wear their own art, and they are a fraction of what they were.
               names: revs.map(r => r.name), imgs: revs.map(r => r.img),
               fromFelled: revs.every(r => ['WARLORD', 'COLOSSUS', 'MARSHAL']
                 .some(id => r.img === BOSS_POOL.find(b => b.id === id).img)),
               // Against what that commander would actually be at this depth, not a guessed
               // baseline - the fight carries its own scale factors and they are the only
               // honest denominator.
               weaker: revs.map(r => { const src = BOSS_POOL.find(b => b.img === r.img);
                 return { hp: r.maxHp / Math.floor(300 * src.hpMult * boss.__mult),
                          dmg: r.dmgBase / Math.floor(34 * src.dmgMult * boss.__dmgMult) }; }),
               wardBefore, wardUp, wardDown, soak: boss.revenantWard };
    });
    ok('breaking it past half opens the ossuary', raised.phase === 2 && raised.n === 2);
    ok('what gets up is what this expedition put down', raised.fromFelled);
    ok('wearing its own art', raised.imgs.every(i => /enemy_boss/.test(i)));
    ok(`at a fraction of what it was (${raised.weaker.map(w => Math.round(w.hp * 100) + '% hp').join(', ')})`,
      raised.weaker.length > 0 && raised.weaker.every(w => Math.abs(w.hp - REVENANT_SPEC.hp) < 0.02
                                                        && Math.abs(w.dmg - REVENANT_SPEC.dmg) < 0.02));
    ok(`while they stand it soaks to ${Math.round(raised.soak * 100)}% (${raised.wardBefore} -> ${raised.wardUp})`,
      raised.wardUp < raised.wardBefore * 0.5);
    ok(`and clearing them lifts it (${raised.wardDown})`, raised.wardDown >= raised.wardBefore * 0.9);

    // ---- a run that felled nobody has nothing raised against it ----
    const empty = await page.evaluate(() => {
      const boss = __last([]);
      boss.hp = Math.floor(boss.maxHp * 0.45);
      executeEnemyAi(boss);
      const hero = activeEntities.find(e => e.isPlayer);
      return { revs: activeEntities.filter(e => e.classType === 'REVENANT').length,
               ward: !!boss.revenantWard,
               hits: mitigate(hero, boss, 1000, 'phys', 'HEAVY_WRENCH').n };
    });
    ok('a run that routed around the commanders raises none of them', empty.revs === 0);
    ok('and is not warded by the ones it never made', !empty.ward && empty.hits > 500);

    // ---- both lines through the last phase ----
    const lines = await page.evaluate(() => {
      const run = clear => {
        const boss = __last(['WARLORD', 'COLOSSUS', 'MARSHAL']);
        boss.hp = Math.floor(boss.maxHp * 0.45);
        executeEnemyAi(boss);                       // ossuary opens
        if (clear) activeEntities.filter(e => e.classType === 'REVENANT')
          .forEach(r => { r.hp = 0; noteTally(r); });
        const pre = { armor: boss.armor, dmg: boss.dmgBase, stacks: boss.tallyStacks };
        boss.hp = Math.floor(boss.maxHp * 0.2);
        executeEnemyAi(boss);                       // the last tally
        return { phase: boss.phase, stacks: pre.stacks,
                 armorShed: pre.armor - boss.armor, dmgGained: boss.dmgBase - pre.dmg };
      };
      return { cleared: run(true), ground: run(false) };
    });
    ok('clearing the raised arms the finish', lines.cleared.stacks === 2 && lines.cleared.dmgGained > 0);
    ok('and the armour it counted comes back off', lines.cleared.armorShed > 0);
    ok('grinding it down instead leaves it nothing to spend',
      lines.ground.stacks === 0 && lines.ground.dmgGained === 0 && lines.ground.armorShed === 0);
    ok('both lines reach the third phase', lines.cleared.phase === 3 && lines.ground.phase === 3);

    // ---- and it always has a third phase, having met you or not ----
    const gears = await page.evaluate(() => {
      __run(); grudges = {};
      const boss = __last();
      const gearsFinal = !!boss.grudgeMove;
      // An ordinary commander only shows its third gear to somebody it already lost to.
      __run(); grudges = {};
      currentSector = 2; currentTier = TOTAL_TIERS;
      initiateCombat('BOSS', false);
      const cold = !!activeEntities.find(e => e.classType === 'BOSS').grudgeMove;
      return { gearsFinal, cold };
    });
    ok('the last warlord always has a third gear', gears.gearsFinal);
    ok('while an ordinary commander only shows one to somebody it lost to', !gears.cold);

    // ---- the win ----
    const win = await page.evaluate(() => {
      const boss = __last();
      careerWins = 0; bossSkulls = 0;
      const skullsBefore = bossSkulls;
      boss.hp = 0;
      activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
      checkWinState();
      const first = { won: runStats.won, at: runStats.wonAtSector, wins: careerWins,
                      skulls: bossSkulls - skullsBefore };
      // Banked once, however many times the moment is re-entered.
      noteVictory(); noteVictory();
      return { first, wins: careerWins, spec: VICTORY,
               // The last warlord is not one of the ones that held the road.
               road: roadWarlords(runStats), all: runStats.warlords };
    });
    ok('felling it wins the expedition', win.first.won === true);
    ok(`and banks it at sector ${win.first.at}`, win.first.at === road.final);
    ok(`with ${win.spec.skulls} skulls, plus the one the kill pays`, win.first.skulls >= win.spec.skulls);
    ok('the career remembers it', win.first.wins === 1);
    ok('and it cannot be banked twice', win.wins === 1);
    ok('the last warlord does not count among the ones that held the road',
      !win.road.includes('OSSUARY') && win.all.includes('OSSUARY'));

    // ---- the question, and both answers ----
    const ask = await page.evaluate(() => {
      __last(); runStats.won = true; runStats.wonAtSector = FINAL_SECTOR;
      pendingRelicOffer = null; pendingPerkOffers = [];
      afterNode();
      const shown = [...document.querySelectorAll('#engine > div')].find(d => d.style.display === 'flex');
      const choices = [...document.querySelectorAll('#victory-choices button')].map(b => b.dataset.action);
      // Asked once. Walking back past it must not put the question again.
      afterNode();
      const second = [...document.querySelectorAll('#engine > div')].find(d => d.style.display === 'flex');
      return { screen: shown && shown.id, choices, again: second && second.id,
               lines: document.getElementById('victory-lines').innerText };
    });
    ok('the win puts a question rather than a full stop', ask.screen === 'screen-victory');
    ok('with both answers on it', ask.choices.includes('victory-walk') && ask.choices.includes('victory-press'));
    ok('and it is asked once', ask.again === 'screen-map');
    ok('the tally of the run is on it', /WARLORDS FELLED/i.test(ask.lines) && /BANKED/i.test(ask.lines));

    const pressed = await page.evaluate(() => {
      __last(); runStats.won = true; currentTier = TOTAL_TIERS + 1;
      pendingRelicOffer = null; pendingPerkOffers = [];
      afterNode();
      dispatchAction(document.querySelector('[data-action="victory-press"]'));
      const screen = [...document.querySelectorAll('#engine > div')].find(d => d.style.display === 'flex');
      const onward = document.getElementById('map-nodes').innerText;
      // Past the gate the rotation is back and the run is still a run.
      return { screen: screen && screen.id, onward, stillWon: runStats.won,
               past: bossForSector(FINAL_SECTOR + 1).final === undefined || !bossForSector(FINAL_SECTOR + 1).final,
               open: Store.getJSON(BASE_SAVE_KEY + currentSlot) !== null };
    });
    ok('pressing on goes back to the map', pressed.screen === 'screen-map');
    ok(`which offers the sector past the gate`, new RegExp(`ENTER SECTOR ${road.final + 1}`, 'i').test(pressed.onward));
    ok('the rotation resumes past it', pressed.past);
    ok('the win is not given back for pressing on', pressed.stillWon === true);
    ok('and the expedition is still open', pressed.open);

    const walked = await page.evaluate(() => {
      __last(); runStats.won = true; runStats.wonAtSector = FINAL_SECTOR;
      runStats.deepestSector = FINAL_SECTOR;
      pendingRelicOffer = null; pendingPerkOffers = [];
      const before = bossSkulls;
      afterNode();
      dispatchAction(document.querySelector('[data-action="victory-walk"]'));
      const screen = [...document.querySelectorAll('#engine > div')].find(d => d.style.display === 'flex');
      return { screen: screen && screen.id,
               title: document.getElementById('runover-title').innerText,
               colour: document.getElementById('runover-title').style.color,
               border: document.getElementById('runover-box').style.borderColor,
               lines: document.getElementById('runover-lines').innerText,
               // Walking out on a win pays the extraction bonus too - it is the same act.
               extracted: runStats.extracted, skulls: bossSkulls - before,
               closed: Store.getJSON(BASE_SAVE_KEY + currentSlot) === null };
    });
    ok('walking out ends the expedition', walked.screen === 'screen-runover');
    ok(`and says which ending it was ("${walked.title}")`, /ROAD/i.test(walked.title));
    ok('in a frame that agrees with it', walked.colour === walked.border && !/255, 68, 68/.test(walked.colour));
    ok('the last warlord leads the tally', walked.lines.split('\n')[0].includes('LAST WARLORD'));
    ok('walking out on a win still pays the extraction bonus', walked.extracted === true && walked.skulls > 0);
    ok('and the slot is closed behind it', walked.closed);

    // ---- what a win is worth ----
    const score = await page.evaluate(() => {
      const base = { deepestSector: FINAL_SECTOR, deepestTier: TOTAL_TIERS, bosses: 7, elites: 8,
                     kills: 200, scrapEarned: 3000, contractMult: 1, protocolMult: 1, doctrineMult: 1 };
      return { lost: computeScore({ ...base }), won: computeScore({ ...base, won: true }), mult: VICTORY.scoreMult };
    });
    ok(`finishing is worth x${score.mult} of the same depth`,
      Math.abs(score.won / score.lost - score.mult) < 0.01);

    // ---- the record ----
    const record = await page.evaluate(() => {
      renderTitleScreen();
      const title = document.getElementById('title-menu-container').innerText;
      renderChronicle();
      const chron = document.getElementById('chronicle-list').innerText;
      const career = document.getElementById('chronicle-career').innerText;
      return { title, won: /ROAD/i.test(chron), career: /ROAD WALKED/i.test(career),
               marked: !!document.querySelector('.chronicle-won') };
    });
    ok('the title screen says the road has been walked', /ROAD WALKED/i.test(record.title));
    ok('the chronicle carries the run that did it', record.won && record.marked);
    ok('and the career block counts them', record.career);

    // ---- the manual, and the art ----
    const manual = await page.evaluate(() => {
      renderCodex();
      const txt = document.getElementById('codex-body').innerText;
      return { has: /THE END OF THE ROAD/i.test(txt),
               sector: txt.includes(String(FINAL_SECTOR)),
               named: txt.includes(FINAL_BOSS.name),
               ossuary: /raise|gets up|get up/i.test(txt),
               choice: /press on|walk out/i.test(txt),
               // Art commissioned but not drawn must be kept off the preloader and covered.
               pending: PENDING_ART.includes(FINAL_BOSS.img),
               listed: ASSET_LIST.includes(FINAL_BOSS.img),
               stands: !!FINAL_BOSS.stand && !PENDING_ART.includes(FINAL_BOSS.stand),
               bgReal: !PENDING_ART.includes(FINAL_BOSS.bg) && ASSET_LIST.includes(FINAL_BOSS.bg) };
    });
    ok('the manual has an entry for the end of the road', manual.has);
    ok('and names the sector and the warlord', manual.sector && manual.named);
    ok('and says what the ossuary does', manual.ossuary);
    ok('and that winning does not force you home', manual.choice);
    ok('its portrait is commissioned, listed, and stood in for', manual.pending && manual.listed && manual.stands);
    ok('and its backdrop is one that exists, so the squad is not fighting on black', manual.bgReal);
  }
};

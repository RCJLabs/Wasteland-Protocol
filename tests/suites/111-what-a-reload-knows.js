// F02. One rule: every screen a player can be standing on is a screen a save can restore to.
// E10 built COMBAT_STATE for exactly this shape of problem inside a fight; five screens
// outside it had no representation at all, and two of those were exploits.
//
//   LOOT     the meta is written at the win - skull, grudge skulls, grudge count, mastery -
//            but the run save still held the mid-fight snapshot, so a reload resumed a
//            commander that was alive and killing it again paid all of it a second time.
//   BROKEN   SQUAD BROKEN saves before REGROUP or END RUN is pressed. A reload found no fight
//            to resume and dropped to the map: node cleared, downed picked up, nothing paid.
//   EVENT    the draw spends a follow-up thread, moves recentEvents on and counts a meeting,
//            and none of it reached disk until the event was finished - so a reload dealt a
//            different card and handed the thread back.
//   CAMP     the same trick one screen over: the tier went back on offer.
//   MUSTER   buildNewRun saves while the player is still on the muster, and continueGame had
//            no branch for it, so a reload skipped the line, the rerolls and the doctrine.
//
// And the career file: a corrupt meta blob was replaced with a rebuild that read fields no
// save has written for a long time, so a dossier, the bestiary, every grudge, careerWins and
// the rung went with one console warning.
//
// Every assertion below reads the DISK - what a reload would actually find - rather than the
// live variable that wrote it, and then drives loadGameState to prove the trip back.
module.exports = {
  name: 'What a reload is allowed to know',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      // What is on disk for the current slot, as a reload would find it.
      window.__disk = () => JSON.parse(Store.get(BASE_SAVE_KEY + currentSlot) || 'null');
      // A reload: the save is read back and the game asks itself where the player was.
      window.__reload = () => { loadGameState(); const at = resumePoint(); return at ? at.id : null; };
      // Guarded on purpose: a probe that throws on a missing resume point tells you the suite
      // broke, not which promise did.
      window.__resume = () => { const at = resumePoint(); if (at) at.go(); return at ? at.id : null; };
      window.__shown = id => getComputedStyle(document.getElementById(id)).display !== 'none';
      window.__nodeOfType = t => (sectorMap.nodes.find(n => n.type === t && n.tier > 1) || null);
    });

    // ── The rule itself ──────────────────────────────────────────────────────────────
    const table = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      return { ids: RESUME_POINTS.map(p => p.id),
               shaped: RESUME_POINTS.every(p => typeof p.id === 'string' && typeof p.at === 'function' && typeof p.go === 'function'),
               onTheRoad: resumePoint() };
    });
    ok(`there is a table of them rather than a chain (${table.ids.join(', ')})`,
      table.shaped && table.ids.length >= 10 && new Set(table.ids).size === table.ids.length);
    ok('and a run standing on the map is standing on none of them', table.onTheRoad === null);

    // ── LOOT: the win is written before the button exists ────────────────────────────
    const loot = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      grudges = {}; bossSkulls = 0; mastery = {}; saveMeta();
      currentSector = 2; currentTier = 10;
      playerRoster.forEach(c => { if (c.gridPos > 0) { c.maxHp = 9000; c.hp = 9000; } });
      initiateCombat('BOSS', false);
      const bossId = activeEntities.find(e => e.classType === 'BOSS').bossId;
      const scrapBefore = scrap, tierBefore = currentTier;
      // Kill it the way the game kills it.
      activeEntities.filter(e => !e.isPlayer).forEach(e => { e.hp = 0; });
      checkWinState();
      // Read after the win, not before it: the win branch itself pays out packrats, scrap
      // rats and an empty relic pool, and none of that is the node's payout.
      const won = { skulls: bossSkulls, grudge: grudgeOn(bossId), mastery: masteryXp(playerRoster[0].classType),
                    scrap, earned: runStats.scrapEarned || 0 };
      const d = window.__disk();
      const deck = document.getElementById('command-deck').innerText;
      // Now reload on that screen.
      const at = window.__reload();
      window.__resume();
      return { bossId, scrapBefore, tierBefore, won, at,
               diskCombat: d.combat, diskLoot: d.pendingLoot, deck,
               skullsNow: bossSkulls, grudgeNow: grudgeOn(bossId), masteryNow: masteryXp(playerRoster[0].classType),
               scrapNow: scrap, tierNow: currentTier, lootNow: pendingLoot,
               banked: (runStats.scrapEarned || 0) - won.earned };
    });
    ok(`felling a commander pays its skull once (${loot.won.skulls})`, loot.won.skulls === 1 && loot.won.grudge === 1);
    ok(`and the LOOT button is on the deck (${loot.deck.trim()})`, /LOOT/.test(loot.deck));
    ok('the run is written down at the win, with no fight left to resume', loot.diskCombat === null);
    ok(`and the spoils are on disk instead (${loot.diskLoot})`, typeof loot.diskLoot === 'number' && loot.diskLoot > 0);
    ok('so a reload comes back to the spoils, not to a commander that is alive again', loot.at === 'LOOT');
    ok(`the skull is not paid twice (${loot.won.skulls} -> ${loot.skullsNow})`, loot.skullsNow === loot.won.skulls);
    ok(`nor the grudge stacked twice (${loot.won.grudge} -> ${loot.grudgeNow})`, loot.grudgeNow === loot.won.grudge);
    ok(`nor the dossier filed twice (${loot.won.mastery} -> ${loot.masteryNow})`, loot.masteryNow === loot.won.mastery);
    ok(`the node banks exactly once (${loot.won.scrap} -> ${loot.scrapNow}, ${loot.banked} earned)`,
      loot.banked > 0 && loot.scrapNow === loot.won.scrap + loot.banked);
    ok(`and the road moves on (tier ${loot.tierBefore} -> ${loot.tierNow})`,
      loot.tierNow === loot.tierBefore + 1 && loot.lootNow === null);

    // ── BROKEN: the price is still to pay ────────────────────────────────────────────
    const broken = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 5; scrap = 300;
      initiateCombat('RAIDERS', false);
      activeEntities.filter(e => e.isPlayer).forEach(e => { e.hp = 0; });
      handleSquadWipe();
      const onScreen = document.getElementById('runover-title').innerText;
      const before = { scrap, regroups: runStats.regroups, tier: currentTier };
      const d = window.__disk();
      const at = window.__reload();
      const afterReload = { scrap, regroups: runStats.regroups, tier: currentTier, screen: null };
      window.__resume();
      afterReload.screen = document.getElementById('runover-title').innerText;
      // And now pay for it.
      regroupSquad();
      const paid = { scrap, regroups: runStats.regroups, tier: currentTier, broken: squadBroken };
      const at2 = window.__reload();
      return { onScreen, before, d: { broken: d.squadBroken, combat: d.combat }, at, afterReload, paid, at2,
               opening: openingTier() };
    });
    ok(`a wiped squad is offered the fallback (${broken.onScreen})`, /SQUAD BROKEN/.test(broken.onScreen));
    ok('the screen is written down, with no fight left to resume',
      broken.d.broken === true && broken.d.combat === null);
    ok('so a reload comes back to it', broken.at === 'BROKEN');
    ok(`and nothing has been refunded on the way (scrap ${broken.afterReload.scrap}, ${broken.afterReload.regroups} fallbacks, tier ${broken.afterReload.tier})`,
      broken.afterReload.scrap === broken.before.scrap
      && broken.afterReload.regroups === broken.before.regroups
      && broken.afterReload.tier === broken.before.tier);
    ok(`the screen it comes back to is the same screen (${broken.afterReload.screen})`,
      /SQUAD BROKEN/.test(broken.afterReload.screen));
    ok(`regrouping still costs what it costs (scrap ${broken.before.scrap} -> ${broken.paid.scrap}, fallbacks ${broken.before.regroups} -> ${broken.paid.regroups}, tier ${broken.paid.tier})`,
      broken.paid.scrap === Math.floor(broken.before.scrap / 2)
      && broken.paid.regroups === broken.before.regroups - 1
      && broken.paid.tier === broken.opening && broken.paid.broken === false);
    ok('and once it is paid, a reload is back on the road', broken.at2 === null);

    // ── EVENT: the card that was dealt is the card that comes back ───────────────────
    const ev = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      firedEvents = []; recentEvents = [];
      const node = window.__nodeOfType('EVENT');
      enterNode(node.id);
      initiateEvent();
      const dealt = activeEvent.title;
      const d = window.__disk();
      const at = window.__reload();
      window.__resume();
      const backOn = { title: document.getElementById('event-title').innerText,
                       choices: document.querySelectorAll('#event-choices [data-action="event-choice"]').length,
                       screen: window.__shown('screen-event') };
      // Take one, and reload on the result - if the reload left an event to take one of.
      // Guarded so a promise broken above fails its own assertion rather than throwing here.
      const tierBefore = currentTier;
      let d2 = {}, at2 = null;
      let afterChoice = { choices: -1, cont: -1, text: '' };
      if (activeEvent) {
        resolveEvent(0);
        d2 = window.__disk();
        at2 = window.__reload();
        window.__resume();
        afterChoice = { choices: document.querySelectorAll('#event-choices [data-action="event-choice"]').length,
                        cont: document.querySelectorAll('#event-choices [data-action="event-finish"]').length,
                        text: document.getElementById('event-choices').innerText };
      }
      finishEvent();
      const at3 = window.__reload();
      return { dealt, diskEvent: d.event, diskCleared: (d.clearedNodeIds || []).includes(node.id),
               diskRecent: d.recentEvents, diskFired: d.firedEvents, at, backOn,
               diskOutcome: d2.eventOutcome, at2, afterChoice, at3,
               tierBefore, tierAfter: currentTier, live: activeEvent };
    });
    ok(`entering an event writes the card down (${ev.diskEvent})`, ev.diskEvent === ev.dealt);
    ok('along with the node it was drawn at, and what the draw spent',
      ev.diskCleared === true && Array.isArray(ev.diskRecent) && ev.diskRecent.includes(ev.dealt)
      && Array.isArray(ev.diskFired));
    ok('so a reload comes back to the event', ev.at === 'EVENT');
    ok(`and it is the same card, with its choices still to take (${ev.backOn.title}, ${ev.backOn.choices} choices)`,
      ev.backOn.title === ev.dealt && ev.backOn.choices > 0 && ev.backOn.screen);
    ok(`taking one writes down what it said (${String(ev.diskOutcome).slice(0, 40)}...)`,
      typeof ev.diskOutcome === 'string' && ev.diskOutcome.length > 0);
    ok('so a reload after the choice comes back to the result', ev.at2 === 'EVENT');
    ok(`with the choices spent rather than offered again (${ev.afterChoice.choices} choices, ${ev.afterChoice.cont} continue)`,
      ev.afterChoice.choices === 0 && ev.afterChoice.cont === 1);
    ok('and leaving it puts the run back on the road', ev.at3 === null && ev.live === null
      && ev.tierAfter === ev.tierBefore + 1);

    // ── CAMP: the same rule, one screen over ─────────────────────────────────────────
    const camp = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const node = window.__nodeOfType('CAMP');
      enterNode(node.id);
      initiateCamp();
      const d = window.__disk();
      const at = window.__reload();
      window.__resume();
      const offers = document.querySelectorAll('#camp-choices [data-action="camp-choice"]').length;
      playerRoster.forEach(c => { if (c.gridPos > 0) c.hp = Math.max(1, Math.floor(c.maxHp * 0.4)); });
      const hurt = playerRoster.filter(c => c.gridPos > 0).map(c => c.hp);
      resolveCamp('TRIAGE');
      const healed = playerRoster.filter(c => c.gridPos > 0).map(c => c.hp);
      const d2 = window.__disk();
      const mats = { ...materials };
      resolveCamp('FORAGE');                       // a spent camp cannot be spent again
      const matsAfter = { ...materials };
      const at2 = window.__reload();
      window.__resume();
      const afterChoice = { offers: document.querySelectorAll('#camp-choices [data-action="camp-choice"]').length,
                            cont: document.querySelectorAll('#camp-choices [data-action="camp-finish"]').length,
                            text: document.getElementById('camp-choices').innerText };
      const tierBefore = currentTier;
      finishCamp();
      const at3 = window.__reload();
      return { diskCamp: d.atCamp, diskCleared: (d.clearedNodeIds || []).includes(node.id), at, offers,
               hurt, healed, diskOutcome: d2.campOutcome, at2, afterChoice, at3,
               mats, matsAfter, tierBefore, tierAfter: currentTier, live: atCamp };
    });
    ok('entering a camp writes it down, and the node with it',
      camp.diskCamp === true && camp.diskCleared === true);
    ok(`so a reload comes back to the camp, still offering (${camp.offers} choices)`,
      camp.at === 'CAMP' && camp.offers >= 3);
    ok(`taking triage puts the squad back up (${camp.hurt.join('/')} -> ${camp.healed.join('/')})`,
      camp.healed.every((h, i) => h > camp.hurt[i]));
    ok(`and writes down what was taken (${camp.diskOutcome && camp.diskOutcome.kind})`,
      !!camp.diskOutcome && camp.diskOutcome.kind === 'TRIAGE');
    ok('a camp already spent cannot be spent again',
      camp.matsAfter.parts === camp.mats.parts && camp.matsAfter.chems === camp.mats.chems);
    ok('a reload after the choice comes back to the camp', camp.at2 === 'CAMP');
    ok(`with the offers spent rather than shown again (${camp.afterChoice.offers} offers, ${camp.afterChoice.cont} continue)`,
      camp.afterChoice.offers === 0 && camp.afterChoice.cont === 1 && /patched up/i.test(camp.afterChoice.text));
    ok('and leaving it puts the run back on the road',
      camp.at3 === null && camp.live === false && camp.tierAfter === camp.tierBefore + 1);

    // ── MUSTER: the line, the rerolls and the doctrine ───────────────────────────────
    const muster = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; bossSkulls = 0;
      pendingDifficulty = 1.0;
      beginExpedition();
      const d = window.__disk();
      const rerollsAt = musterRerolls;
      const at = window.__reload();
      window.__resume();
      const onMuster = window.__shown('screen-muster');
      // Spend a reroll and reload: it stays spent.
      const who = playerRoster.find(c => c.gridPos > 0);
      musterReroll(who.id);
      const spent = musterRerolls;
      const at2 = window.__reload();
      const rerollsBack = musterRerolls;
      window.__resume();
      // The line the player arranged is part of the screen too.
      // A deployed operator, because the line is at its cap: cycling one off it is the move
      // that is always available.
      const mover = playerRoster.find(c => c.gridPos > 0);
      const wasAt = mover.gridPos;
      musterRank(mover.id);
      const movedTo = mover.gridPos;
      window.__reload();
      const lineBack = (playerRoster.find(c => c.id === mover.id) || {}).gridPos;
      window.__resume();
      // Take a doctrine the line keeps, deploy, and check the one thing that never ran.
      const takeable = doctrineOffer.find(id => { activeDoctrine = id; return doctrineHolds(); });
      activeDoctrine = takeable || null;
      musterDeploy();
      const d2 = window.__disk();
      const at3 = window.__reload();
      return { diskMuster: d.musterPending, diskRerolls: d.musterRerolls, rerollsAt, at, onMuster,
               spent, at2, rerollsBack, at3, deployedMuster: d2.musterPending,
               wasAt, movedTo, lineBack,
               took: takeable || null, mult: runStats.doctrineMult, onMap: window.__shown('screen-map') };
    });
    ok(`deploying stops at the muster and writes that down (${muster.diskRerolls} rerolls)`,
      muster.diskMuster === true && muster.diskRerolls === muster.rerollsAt);
    ok('so a reload comes back to the muster rather than skipping it',
      muster.at === 'MUSTER' && muster.onMuster);
    ok(`a spent reroll stays spent across it (${muster.rerollsAt} -> ${muster.spent} -> ${muster.rerollsBack})`,
      muster.spent === muster.rerollsAt - 1 && muster.rerollsBack === muster.spent && muster.at2 === 'MUSTER');
    ok(`the line the player arranged comes back with them (rank ${muster.wasAt} -> ${muster.movedTo}, reloads as ${muster.lineBack})`,
      muster.movedTo !== muster.wasAt && muster.lineBack === muster.movedTo);
    ok(`and the doctrine can still be taken, which is the thing that never ran (${muster.took}, x${muster.mult})`,
      !!muster.took && muster.mult > 1);
    ok('once the line is sent in, a reload is on the road',
      muster.deployedMuster === false && muster.at3 === null && muster.onMap);

    // ── The career file ─────────────────────────────────────────────────────────────
    const career = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      bossSkulls = 12; careerWins = 3; bestRung = 2; bestScore = 99; bestSector = 6;
      mastery = { BRUISER: 4200, MEDIC: 900 };
      grudges = { WARLORD: 2 };
      bestiary = { Raider: { met: 9, killed: 4, felled: 1 } };
      seenPrompts = ['INTENT', 'ROUTE'];
      metaUpgrades.startScrap = 150; metaUpgrades.vault = 1;
      saveMeta(); saveGameState();
      const mirrored = window.__disk().meta;
      // Now the career file is unreadable.
      Store.set(META_KEY, '{ this is not json');
      bossSkulls = 0; careerWins = 0; bestRung = 0; mastery = {}; grudges = {}; bestiary = {}; seenPrompts = [];
      metaUpgrades.startScrap = 0; metaUpgrades.vault = 0;
      loadMeta();
      return { mirrored: mirrored ? Object.keys(mirrored).sort() : null,
               blob: Object.keys(metaBlob()).sort(),
               skulls: bossSkulls, wins: careerWins, rung: bestRung, score: bestScore, sector: bestSector,
               mastery: { ...mastery }, grudges: { ...grudges }, bestiary: { ...bestiary },
               prompts: [...seenPrompts], scrap: metaUpgrades.startScrap, vault: metaUpgrades.vault,
               kept: Store.get(META_KEY + ':damaged') };
    });
    ok(`every run slot mirrors the whole career, not a handful of fields (${career.mirrored.length})`,
      career.mirrored && career.mirrored.join() === career.blob.join() && career.blob.length >= 10);
    ok(`an unreadable career file rebuilds its counters (${career.skulls} skulls, ${career.wins} wins, rung ${career.rung})`,
      career.skulls === 12 && career.wins === 3 && career.rung === 2
      && career.score === 99 && career.sector === 6);
    ok(`the dossiers come back (${JSON.stringify(career.mastery)})`,
      career.mastery.BRUISER === 4200 && career.mastery.MEDIC === 900);
    ok(`so do the grudges and the bestiary (${JSON.stringify(career.grudges)}, ${JSON.stringify(career.bestiary)})`,
      career.grudges.WARLORD === 2 && career.bestiary.Raider && career.bestiary.Raider.met === 9
      && career.bestiary.Raider.killed === 4 && career.bestiary.Raider.felled === 1);
    ok(`and the Citadel it was spent on (${career.scrap} start scrap, vault ${career.vault})`,
      career.scrap === 150 && career.vault === 1);
    ok(`the prompts already seen are not shown again (${career.prompts.join(', ')})`,
      career.prompts.includes('INTENT') && career.prompts.includes('ROUTE'));
    ok('and the unreadable blob is kept rather than written over',
      typeof career.kept === 'string' && /this is not json/.test(career.kept));

    // ── A new run is standing on nothing ────────────────────────────────────────────
    const fresh = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      // Everything the last run could have ended holding.
      squadBroken = true; atCamp = true; pendingLoot = 40; musterPending = true;
      campOutcome = { kind: 'TRIAGE', name: null }; eventOutcome = 'something happened';
      activeEvent = EVENT_POOL[0];
      confirmNewGame(1.0); sectorFront = null;
      const at = window.__reload();
      return { at, flags: [pendingLoot, squadBroken, musterPending, atCamp, campOutcome, eventOutcome, activeEvent] };
    });
    ok('a new expedition inherits no screen from the one before it',
      fresh.at === null && fresh.flags.every(f => f === null || f === false));

    // ── A save written before any of this still opens ────────────────────────────────
    const old = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 3; currentTier = 4; scrap = 77;
      atCamp = true; squadBroken = true; musterPending = true; pendingLoot = 40;
      saveGameState();
      // Strip the phase's fields the way a save from before it would have them: absent.
      const d = window.__disk();
      ['pendingLoot', 'squadBroken', 'musterPending', 'musterRerolls', 'atCamp', 'campOutcome',
       'eventOutcome', 'event', 'meta'].forEach(k => { delete d[k]; });
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(d));
      const at = window.__reload();
      return { at, sector: currentSector, tier: currentTier, scrap,
               flags: [pendingLoot, squadBroken, musterPending, atCamp, campOutcome, eventOutcome, activeEvent] };
    });
    ok(`a save from before the phase opens on the road (${old.at})`, old.at === null);
    ok(`carrying the run it was holding (sector ${old.sector}, tier ${old.tier}, ${old.scrap} scrap)`,
      old.sector === 3 && old.tier === 4 && old.scrap === 77);
    ok('and standing on no screen at all, which is what saying nothing means',
      old.flags.every(f => f === null || f === false));
  }
};

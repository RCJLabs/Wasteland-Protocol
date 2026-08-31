// Every balance claim in this repo's history came from arithmetic models, never from play.
// This drives real expeditions headlessly through the real engine - the same functions a player
// touches - and reports where runs actually end, what gets used, and what never fires.
//
//   node tests/simulate.js [runs] [--difficulty 1.0] [--contracts GLASS,NO_REGROUPS]
//
// It asserts nothing. It is a measuring instrument, and it prints what it measured.
//
// ── On sample size ──────────────────────────────────────────────────────────────────────
// Median score is heavy-tailed: a run ends anywhere between sector 1 and sector 10, and the
// deep runs carry most of the score. Thirty expeditions does not resolve it. On identical
// code this printed 10,025, 10,600, 10,545 and 10,560 at thirty, then 16,210 at sixty, then
// 11,455 at a hundred and fifty. Four samples agreeing inside 6% looked like a tight
// instrument and was luck - a phase measured against those baselines came out at +76%, then
// +11%, then -33%, with the sign unstable.
//
// So: 150+ expeditions before believing anything about score, nodes or depth, and a paired
// baseline run in the same session. Wipes per run is the stable figure and sits near 4.5
// across every sample ever taken here; if lethality is the question, thirty will do.
//
// This is written down because a claim was published off a thirty-run pair and was wrong:
// N11 was reported as +49% median score. Re-measured at 150 against its own predecessor it
// is 14,460 -> 11,455, which is not an increase at all.
const path = require('path');
const { serve } = require('./server');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require('playwright-core')); }

const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
const RUNS = Number(args.find(a => /^\d+$/.test(a))) || 60;
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DIFFICULTY = Number(flag('difficulty', '1.0'));
const CONTRACTS = flag('contracts', '').split(',').filter(Boolean);
// The sim used to fight every node to a conclusion, which is one particular player and not the
// only one. With this on it also runs from fights it is losing, so the cost of leaving can be
// measured against the cost of staying. `--withdraw off` is the old behaviour, for comparison.
const WITHDRAW_POLICY = flag('withdraw', 'on') !== 'off';
// The draft policy was hardcoded to a front-liner, usually a medic, and one other - which meant
// "which classes get deployed" reported that policy back rather than anything about the game.
// `--draft random` fields three drawn flat from the roster; `--draft only:PYROMANIAC` forces one
// class into the line and rolls the rest. The cost of an unusual squad is the number doctrines
// have to be priced against, and it cannot be read off a policy that never fields one.
// `--draft doctrine` takes one of the three offered and builds a line that keeps it, which is
// what a player with a free multiplier on the table actually does. It is not the default: the
// default is left alone so runs measured before doctrines existed stay comparable.
const DRAFT = flag('draft', 'line');
// Momentum has three tactics and this simulator only ever bought one of them: spendTactic was
// called exactly once in the whole file, always with STIM, and the strings FOCUS and PRESS did
// not appear at all. So "a third of every action was STIM" was this policy reporting itself
// back. `--tactics focus|press|none|smart` buys something else, so the shelf can be compared
// rather than assumed. `stim` is the old behaviour and stays the default.
const TACTICS = flag('tactics', 'stim');
// A sim that never walks out measures a game with one ending. `--extract N` gives it the
// player who leaves once the run is worth banking: from sector N on, it takes the camp's door
// when the squad is worn down. `off` (the default) is the old behaviour, for comparison.
const EXTRACT_RAW = flag('extract', 'off');
const EXTRACT_AT = EXTRACT_RAW === 'off' ? 99 : Number(EXTRACT_RAW);

// Runs one expedition inside the page. Plays to a real conclusion: the squad wipes out of
// regroups, or the safety cap is hit.
const EXPEDITION = ({ difficulty, contracts, capNodes, withdrawPolicy, EXTRACT_AT, draftPolicy, tacticPolicy }) => {
  const stat = { sector: 1, tier: 1, nodes: 0, fights: 0, rounds: 0, kills: 0, deployed: [],
                 wipedInSector: [], wipedAtTier: [], wipedOnElite: [],
                 wipes: 0, withdrawals: 0, facesMet: {}, threads: [], standings: {}, ground: {}, settled: {}, posted: null, regroupsSpent: 0, bosses: 0, elites: 0, events: 0, camps: 0,
                 moves: {}, items: {}, relics: [], bountiesDone: 0, consequences: 0, crafted: 0,
                 promotions: 0, sigsTaken: 0, gearEquipped: 0, shops: 0, shopScrap: 0, sigsFaced: {},
                 maxBond: 0, bondSaves: 0, frontsSeen: [],
                 endedBy: 'cap', score: 0, contractMult: 1, recruited: [], recruitOffers: [], saves: 0, downs: 0, lost: [], bossMet: [],
                 extracted: false, walkedAt: 0, formations: {}, loose: 0, doctrine: null, doctrineKept: false,
                 booked: 0, bookedKinds: {} };

  activeContracts = [...contracts];
  currentSlot = 1;
  confirmNewGame(difficulty);
  stat.contractMult = runStats.contractMult;
  stat.frontsSeen.push(sectorFront);

  // The template deploys the same three operators every time, so a sim that leaves the formation
  // alone measures three classes and reports the other four as dead content. A player rotates the
  // roster; so does this.
  // A player fields a line, not a lottery: someone to hold the front, usually a medic, and
  // whoever else. The old shuffle regularly deployed three glass cannons and measured the
  // resulting deaths as difficulty.
  const slots = hasContract('SHORT_HANDED') ? [1, 2] : [1, 2, 3];
  playerRoster.forEach(p => { p.gridPos = 0; });
  const byClass = c => playerRoster.filter(p => c.includes(p.classType));
  const pickFrom = list => list[Math.floor(Math.random() * list.length)];
  const draft = [];
  if (draftPolicy === 'random') {
    // No shape at all: whatever the roster hands you. This is the floor.
  } else if (draftPolicy.startsWith('doctrine:')) {
    // One named doctrine, every run, so a pool average cannot hide a single expensive one.
    const want = draftPolicy.slice(9);
    const d = doctrineById(want);
    if (d) {
      doctrineOffer = [want];
      const shuffled = [...playerRoster].sort(() => Math.random() - 0.5);
      shuffled.forEach(c => { if (draft.length < slots.length && d.holds([...draft, c])) draft.push(c); });
      if (d.holds(draft)) { activeDoctrine = want; stat.doctrine = want; }
    }
  } else if (draftPolicy === 'doctrine' && doctrineOffer.length) {
    // Take one at random and field a line that keeps it. Anything the doctrine will not have
    // is simply not drafted, which is the whole of the constraint.
    const want = doctrineOffer[Math.floor(Math.random() * doctrineOffer.length)];
    const d = doctrineById(want);
    const shuffled = [...playerRoster].sort(() => Math.random() - 0.5);
    shuffled.forEach(c => { if (draft.length < slots.length && d.holds([...draft, c])) draft.push(c); });
    if (d.holds(draft)) { activeDoctrine = want; stat.doctrine = want; }
  } else if (draftPolicy.startsWith('only:')) {
    const want = draftPolicy.slice(5);
    const one = byClass([want])[0];
    if (one) draft.push(one);
  } else {
    draft.push(pickFrom(byClass(['BRUISER', 'SHOTGUNNER'])));
    if (slots.length > 2 && Math.random() < 0.7) draft.push(pickFrom(byClass(['MEDIC'])));
  }
  while (draft.length < slots.length) {
    const rest = playerRoster.filter(p => !draft.includes(p));
    const d = doctrineById(activeDoctrine);
    const legal = d ? rest.filter(c => d.holds([...draft, c])) : rest;
    if (!legal.length) break;
    draft.push(pickFrom(legal));
  }
  draft.forEach((p, i) => { p.gridPos = slots[i]; });
  // The real deploy button is what applies a doctrine's edge and banks its multiplier, so the
  // sim goes through it rather than around it.
  musterDeploy();
  stat.deployed = playerRoster.filter(p => p.gridPos > 0).map(p => p.classType);
  stat.doctrineKept = !!activeDoctrine && !doctrineBroken;
  const bountiesAtStart = () => activeBounties.map(b => b.desc).join('|');
  // Which contracts a run actually settles, so one nobody can finish shows as a zero.
  let lastBoard = null;
  const noteBoard = () => {
    const now = activeBounties.map(b => b.type);
    if (lastBoard) lastBoard.forEach((t, i) => { if (now[i] !== t) stat.settled[t] = (stat.settled[t] || 0) + 1; });
    lastBoard = now;
    stat.posted = standingBounty ? standingBounty.type : null;
  };
  let boardBefore = bountiesAtStart();

  // A squad that never spends scrap dies to arithmetic rather than to play, so the sim shops
  // the way a player would: heal the hurt, upgrade when it can afford to.
  const spend = () => {
    // Promotions resolve the way a player would: take a signature when one is on the table,
    // otherwise the first card. Leaving them queued would sim a squad weaker than any real one.
    while (pendingPerkOffers.length) {
      const offer = pendingPerkOffers[0];
      const sigIdx = offer.options.findIndex(id => SIG_PERKS.some(p => p.id === id));
      if (sigIdx >= 0) stat.sigsTaken++;
      takePerkOffer(sigIdx >= 0 ? sigIdx : 0);
      stat.promotions++;
    }
    playerRoster.forEach(c => {
      if (c.hp <= 0 && scrap >= 50) { scrap -= 50; c.hp = Math.floor(c.maxHp * 0.5); }
      else if (c.hp < c.maxHp && scrap >= 10) { scrap -= 10; c.hp = Math.min(c.maxHp, c.hp + 30); }
    });
    // Gear helps nobody in the stash: each piece goes to the first deployed operator it fits.
    gearStash.slice().forEach(id => {
      const g = gearById(id); if (!g) return;
      const fit = playerRoster.find(c => c.gridPos > 0 && (g.slot === 'mod'
        ? (c.classType === g.cls && !c.weaponMod) : !c.trinket));
      if (fit) { equipGear(fit.id, id); stat.gearEquipped++; }
    });
    while (canCarry() && materials.chems >= 2) { craftItem('MED_STIM'); stat.crafted++; }
    playerRoster.forEach(c => {
      const cost = 30 + (c.upgradeCount * 25);
      if (c.gridPos > 0 && scrap >= cost * 2) { scrap -= cost; c.upgradeCount++; c.maxHp += 10; c.hp += 10; c.dmgBase += 3; }
      while (c.perkPoints > 0) { assignPerk(c.id, PERK_POOL[Math.floor(Math.random() * PERK_POOL.length)].id); }
    });
  };

  // Picks the ability with a live combo if there is one, otherwise the first available. This is
  // a competent player, not an optimal one.
  const takeTurn = () => {
    const actor = turnQueue[activeIndex];
    const foes = activeEntities.filter(e => !e.isPlayer && e.hp > 0);
    if (!foes.length) return false;
    const deck = (ABILITIES[actor.classType] || []).filter(a => !a.cd || (actor.cooldowns[a.cd] || 0) === 0);
    if (!deck.length) return false;
    if (momentum >= overdriveAt()) {
      stat.moves.OVERDRIVE = (stat.moves.OVERDRIVE || 0) + 1;
      pendingAction = 'OVERDRIVE'; resolveAction(foes[0].id); return true;
    }
    // Tactics. None of the three costs an action, so the only question is what the bar buys.
    const buy = id => {
      const before = momentum;
      spendTactic(id);
      if (momentum !== before) stat.moves[id] = (stat.moves[id] || 0) + 1;
    };
    if (tacticPolicy === 'stim') {
      if (momentum >= 30 && stimTarget()) buy('STIM');
    } else if (tacticPolicy === 'focus') {
      if (momentum >= 25) buy('FOCUS');
    } else if (tacticPolicy === 'press') {
      if (momentum >= 40) buy('PRESS');
    } else if (tacticPolicy === 'hold') {
      if (momentum >= 25) buy('HOLD');
    } else if (tacticPolicy === 'break') {
      if (momentum >= 35 && breakTarget()) buy('BREAK');
    } else if (tacticPolicy === 'smart') {
      // Survival first, in the order a player would read the board: somebody on the floor, then
      // the blow that is about to land, then the line being ground down, then damage.
      const hurt = stimTarget();
      const incoming = Object.values(threatBoard()).reduce((a, t) => a + t.dmg, 0);
      const linePool = activeEntities.filter(e => e.isPlayer && e.hp > 0).reduce((a, e) => a + e.hp, 0);
      const worst = breakTarget();
      const worstHit = worst ? (forecastFor(worst)?.hits || []).reduce((a, h) => a + h.dmg, 0) : 0;
      if (bleedingOut().length && momentum >= 30 && hurt) buy('STIM');
      else if (momentum >= 35 && worst && worstHit > linePool * 0.22) buy('BREAK');
      else if (momentum >= 30 && hurt && hurt.hp < hurt.maxHp * 0.5) buy('STIM');
      else if (momentum >= 25 && incoming > linePool * 0.25) buy('HOLD');
      else if (momentum >= 40) buy('PRESS');
      else if (momentum >= 25) buy('FOCUS');
    }

    // Somebody on the floor is the turn. A Med-Stim, then the medic's hands - anything else
    // is measuring a squad that watches its own people bleed out, which is not a squad.
    const down = bleedingOut();
    if (down.length) {
      const worst = down.sort((a, b) => (a.downTurns || 0) - (b.downTurns || 0))[0];
      if (inventory.includes('MED_STIM')) {
        stat.items.MED_STIM = (stat.items.MED_STIM || 0) + 1;
        stat.saves++;
        pendingAction = 'ITEM_MED'; resolveConsumableItem(worst.id); return true;
      }
      const patch = deck.find(a => a.move === 'CAUTERIZE' || a.move === 'STIM_DART');
      if (patch) {
        stat.moves[patch.move] = (stat.moves[patch.move] || 0) + 1;
        stat.saves++;
        pendingAction = patch.move; resolveAction(worst.id); return true;
      }
    }

    // A ranged operator caught holding the front rank swaps out - the one formation fix
    // that actually changes what enemy melee reaches.
    if (actor.gridPos === 1 && isRanged((ABILITIES[actor.classType] || [{}])[0].move)) {
      const meleeAlly = activeEntities.find(e => e.isPlayer && e.hp > 0 && e.gridPos > 1 &&
        isMelee((ABILITIES[e.classType] || [{}])[0].move));
      if (meleeAlly) {
        stat.moves.REPOSITION = (stat.moves.REPOSITION || 0) + 1;
        pendingAction = 'REPOSITION'; resolveAction(meleeAlly.id); return true;
      }
    }

    // A player in trouble reaches for the bag before they reach for another attack.
    const badlyHurt = activeEntities.filter(e => e.isPlayer && e.hp > 0 && e.hp < e.maxHp * 0.35)
                                    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (badlyHurt && inventory.includes('MED_STIM')) {
        stat.items.MED_STIM = (stat.items.MED_STIM || 0) + 1;
        pendingAction = 'ITEM_MED'; resolveConsumableItem(badlyHurt.id); return true;
    }
    const stuck = activeEntities.find(e => e.isPlayer && e.hp > 0 && (e.stunnedTurns > 0 || e.bleedingTurns > 0));
    if (stuck && inventory.includes('ADRENALINE')) {
        stat.items.ADRENALINE = (stat.items.ADRENALINE || 0) + 1;
        pendingAction = 'ITEM_ADRENALINE'; resolveConsumableItem(stuck.id); return true;
    }
    const nearlyDead = foes.find(f => f.hp <= 35);
    if (nearlyDead && inventory.includes('SCRAP_BOMB')) {
        stat.items.SCRAP_BOMB = (stat.items.SCRAP_BOMB || 0) + 1;
        pendingAction = 'ITEM_BOMB'; resolveConsumableItem(nearlyDead.id); return true;
    }

    let chosen = null, target = foes[0];
    for (const a of deck) {
      const hit = foes.find(f => comboFor(a.move, f));
      if (hit) { chosen = a; target = hit; break; }
    }
    if (!chosen) chosen = deck[Math.floor(Math.random() * deck.length)];
    if (chosen.act === 'self') { stat.moves[chosen.move] = (stat.moves[chosen.move] || 0) + 1; executeSelfAction(chosen.move); return true; }
    if (chosen.move === 'CAUTERIZE') {
      const hurt = activeEntities.filter(e => e.isPlayer && e.hp > 0 && e.hp < e.maxHp)[0];
      if (!hurt) { chosen = deck.find(a => a.move !== 'CAUTERIZE') || deck[0]; }
      else { stat.moves.CAUTERIZE = (stat.moves.CAUTERIZE || 0) + 1; pendingAction = 'CAUTERIZE'; resolveAction(hurt.id); return true; }
    }
    stat.moves[chosen.move] = (stat.moves[chosen.move] || 0) + 1;
    pendingAction = chosen.move; resolveAction(target.id);
    return true;
  };

  // Drives one fight to its end without any timers - every turn resolved synchronously.
  // Losing badly: half the line is nearly out and the other side has barely been dented. A
  // player reads that off the board in a glance; this is the same read in arithmetic.
  const losing = (enemyStartHp) => {
    const squad = activeEntities.filter(e => e.isPlayer);
    const spent = squad.filter(e => e.hp <= e.maxHp * 0.3).length;
    const foeHp = activeEntities.filter(e => !e.isPlayer).reduce((a, e) => a + Math.max(0, e.hp), 0);
    return spent >= Math.ceil(squad.length / 2) && foeHp > enemyStartHp * 0.5;
  };

  const fight = (nodeType, elite) => {
    initiateCombat(nodeType, elite);
    stat.fights++;
    // A sim that never met a formation would report a game without them and read identically
    // to one that did, so what walked on is counted rather than assumed.
    if (currentFormation) stat.formations[currentFormation] = (stat.formations[currentFormation] || 0) + 1;
    else stat.loose++;
    // Counted at the door rather than at the end: a fight that is run from still happened, and
    // the squad still had to look at whatever was in it.
    activeEntities.filter(e => !e.isPlayer && e.sig).forEach(e => {
      stat.sigsFaced[e.sig] = (stat.sigsFaced[e.sig] || 0) + 1;
    });
    const enemyStartHp = activeEntities.filter(e => !e.isPlayer).reduce((a, e) => a + e.hp, 0);
    let rounds = 0, fled = false;
    while (combatActive && rounds < 400) {
      rounds++;
      const actor = turnQueue[activeIndex];
      // The real loop ticks the bleed-out clock as the queue passes a downed operator; this
      // loop walks the queue itself, so it has to do the same. It has to come before the hp
      // check below, which is where the first version of this sat - and measured zero deaths
      // across sixty runs because it was never reached.
      if (isDown(actor)) { tickBleedOut(actor); activeIndex = (activeIndex + 1) % turnQueue.length; continue; }
      if (!actor || actor.hp <= 0) { activeIndex = (activeIndex + 1) % turnQueue.length; continue; }
      if (actor.stunnedTurns > 0) { actor.stunnedTurns--; activeIndex = (activeIndex + 1) % turnQueue.length; continue; }
      applyTurnStartEffects(actor);
      if (!activeEntities.some(e => e.isPlayer && e.hp > 0)) break;
      if (!activeEntities.some(e => !e.isPlayer && e.hp > 0)) break;
      if (actor.isPlayer && withdrawPolicy && canWithdraw() && losing(enemyStartHp)) {
        stat.kills += activeEntities.filter(e => !e.isPlayer && e.hp <= 0).length;
        withdraw(); withdraw();          // the real thing: arms, then commits
        fled = true;
        break;
      }
      // Count a fall the first time it happens to each operator in this fight.
      activeEntities.forEach(e => { if (isDown(e) && !e.__counted) { e.__counted = true; stat.downs++; } });
      if (actor.isPlayer && fightLog) fightLog.turns++;   // processTurn does this in the real loop
      if (actor.isPlayer) { if (!takeTurn()) { activeIndex = (activeIndex + 1) % turnQueue.length; continue; } }
      else { actor.intent = rollIntent(actor); executeEnemyAi(actor); }
      // A pressed operator holds the floor - nextTurn does this in the real loop, and without
      // it PRESS is momentum spent on nothing and would measure as worthless.
      if (pressExtra && actor.isPlayer && actor.hp > 0) { pressExtra = false; continue; }
      activeIndex = (activeIndex + 1) % turnQueue.length;
    }
    // Whoever the fight ended without is on the record.
    (runStats.fallen || []).slice(stat.lost.length).forEach(f => stat.lost.push(f.name));
    activeEntities.forEach(e => { delete e.__counted; });
    stat.rounds += rounds;
    if (fled) { stat.withdrawals++; return 'fled'; }
    const survived = activeEntities.some(e => e.isPlayer && e.hp > 0);
    const foesLeft = activeEntities.filter(e => !e.isPlayer && e.hp > 0).length;
    stat.kills += activeEntities.filter(e => !e.isPlayer && e.hp <= 0).length;
    const won = survived && foesLeft === 0;
    // checkWinState does this in the real loop, and without it the board's fight-end contracts
    // would read as content nobody ever settles.
    if (won) noteFightWon();
    combatActive = false;
    return won ? 'won' : 'lost';
  };

  while (stat.nodes < capNodes) {
    if (currentTier > TOTAL_TIERS) {
      currentSector++; currentTier = 1; noteDepth();
      pursuit = null;                    // as advanceSector does: nothing follows across a sector
      sectorFront = rollFront(); frontBannerPending = false;
      stat.frontsSeen.push(sectorFront);
      sectorMap = generateSectorMap(); currentNodeId = null; clearedNodeIds = [];
      // consequences that came due
      const due = consequencesDue().length;
      if (due) { stat.consequences += due; while (consequencesDue().length) { const c = consequencesDue()[0]; pendingConsequences = pendingConsequences.filter(o => o !== c); (CONSEQUENCE_POOL[c.kind] || { resolve: () => '' }).resolve(c); } }
      spend();
      continue;
    }
    // Walk the generated route graph the way a player does: only what the last node connects
    // to is on offer, elites preferred when the squad is healthy, camps preferred when it hurts.
    const availIds = availableNodeIds();
    if (!availIds.length) { stat.endedBy = 'stranded'; break; }
    const avail = availIds.map(id => sectorMap.nodes.find(n => n.id === id)).filter(Boolean);
    const healthy = playerRoster.filter(p => p.gridPos > 0 && p.hp > p.maxHp * 0.6).length >= 2;
    const hurting = playerRoster.filter(p => p.gridPos > 0 && p.hp < p.maxHp * 0.5).length >= 2;
    const node = (hurting && avail.find(n => n.type === 'CAMP'))
              || (healthy && avail.find(n => n.elite))
              || avail[Math.floor(Math.random() * avail.length)];
    enterNode(node.id);

    if (node.type === 'EVENT') {
      stat.events++;
      const ev = pickEvent();
      // An event's choice list can depend on standing now, so it is asked for rather than read.
      if (ev.cast) meetCast(ev.cast);
      const options = choicesFor(ev).filter(c => c.canAfford());
      if (ev.cast) stat.facesMet[ev.cast] = (stat.facesMet[ev.cast] || 0) + 1;
      if (FOLLOWUPS.some(f => f.title === ev.title)) stat.threads.push(ev.title);
      const owedBefore = pendingConsequences.length;
      if (options.length) options[Math.floor(Math.random() * options.length)].execute();
      // A resolve rate is meaningless without the booking rate underneath it: six in seven
      // uncollected could be a fuse that never lands, or a debt that was never taken on.
      if (pendingConsequences.length > owedBefore) {
        stat.booked += pendingConsequences.length - owedBefore;
        pendingConsequences.slice(owedBefore).forEach(c => { stat.bookedKinds[c.kind] = (stat.bookedKinds[c.kind] || 0) + 1; });
      }
      currentTier++; stat.nodes++; noteDepth(); runStats.nodes++;
      continue;
    }
    if (node.type === 'CAMP') {
      stat.camps++;
      // The camp is where the door is, so it is where the decision gets made. This player walks
      // once the run is deep enough to be worth banking AND the squad is in no shape to keep
      // going: two of the line badly hurt, the bench gone, or nothing left to regroup with.
      const worn = playerRoster.filter(p => p.gridPos > 0 && p.hp < p.maxHp * 0.5).length >= 2
                || playerRoster.length <= 4
                || regroupsLeft() === 0;
      if (currentSector >= EXTRACT_AT && worn && canExtract()) {
        stat.extracted = true; stat.walkedAt = currentSector;
        stat.endedBy = 'extracted';
        extractRun();
        break;
      }
      playerRoster.forEach(p => { if (p.gridPos > 0 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.35)); });
      currentTier++; stat.nodes++; noteDepth(); runStats.nodes++;
      continue;
    }
    if (node.type === 'RECRUIT') {
      // Signs anyone it can afford while keeping enough back for triage, and then actually
      // fields them - a recruit measured only as a purchase is a recruit nobody ever swung.
      initiateRecruit();
      const tpl = recruitById(pendingRecruit && pendingRecruit.id);
      if (tpl) stat.recruitOffers.push({ cost: pendingRecruit.cost, purse: scrap });
      if (tpl && scrap >= pendingRecruit.cost + 80) {
        signOnRecruit();
        stat.recruited.push(tpl.classType);
        // Put them in the line if their rank is open, so their verbs get used rather than
        // sitting on the bench for the rest of the run.
        const sitting = playerRoster.find(c => c.gridPos === tpl.rank && c.id !== tpl.id);
        const me = playerRoster.find(c => c.id === tpl.id);
        if (me) { if (sitting) sitting.gridPos = 0; me.gridPos = tpl.rank; }
      } else {
        leaveRecruit();
      }
      pendingRecruit = null;
      currentTier++; stat.nodes++; noteDepth(); runStats.nodes++;
      continue;
    }
    if (node.type === 'SHOP') {
      stat.shops++;
      initiateShop();
      // Buys the way a player would: gear first, tempo second, the bond and the marked-up
      // relic only when flush. The keep argument is scrap held back for triage.
      const buy = (kind, keep) => {
        const i = activeShop.stock.findIndex(s => s.kind === kind && !s.sold);
        if (i >= 0 && scrap >= activeShop.stock[i].price + keep) {
          const before = scrap; buyShopItem(i); stat.shopScrap += before - scrap;
        }
      };
      buy('GEAR', 60); buy('STIM', 40); buy('STIM', 40); buy('INSURANCE', 150); buy('RELIC', 400);
      finishShop();
      stat.nodes++;
      continue;
    }

    if (node.type === 'BOSS') {
      const b = bossForSector();
      stat.bossMet.push({ id: b.id, grudge: grudgeOn(b.id) });
    }
    currentNodeType = node.type; isCurrentNodeElite = !!node.elite;
    stat.ground[node.terrain || 'OPEN_ROAD'] = (stat.ground[node.terrain || 'OPEN_ROAD'] || 0) + 1;
    noteBoard();
    const outcome = fight(node.type, !!node.elite);
    if (node.type === 'BOSS') {
      const met = stat.bossMet[stat.bossMet.length - 1];
      if (met) met.won = outcome === 'won';
    }
    stat.nodes++;

    // Leaving already advanced the tier and left the node behind - and the engine deliberately
    // does not count it as one cleared, so neither does this.
    if (outcome === 'fled') { spend(); continue; }
    runStats.nodes++;

    if (outcome === 'lost') {
      stat.wipes++;
      stat.wipedInSector.push(currentSector); stat.wipedAtTier.push(currentTier); stat.wipedOnElite.push(!!node.elite);
      if (regroupsLeft() > 0) { stat.regroupsSpent++; regroupSquad(); spend(); continue; }
      stat.endedBy = 'wiped'; break;
    }

    // The killing blow goes through resolveAction, which calls checkWinState, which is where the
    // engine banks a skull, counts the boss or elite, notes the grudge and rolls the drop. This
    // block used to do all of it AGAIN: bosses, elites, skulls and grudges were counted twice
    // and every run held about double the relics it should. Measured on a staged kill, skulls
    // went 0 -> 1 in the engine and then 1 -> 2 here. Score reads bosses x900 + elites x250, so
    // every figure this file has ever printed was high by roughly a fifth.
    //
    // What stays is only what the engine does NOT do at this point: its scrap is handed out by
    // collectLoot, behind a LOOT button no simulator presses, and stat.* are this file's own
    // counters. Those own counters are checked against the engine's below - if the two ever
    // disagree again the report says so instead of quietly printing a doubled number.
    // Reconcile rather than add. The engine counts the kill inside checkWinState, which
    // resolveAction reaches - but this loop walks the turn queue itself and calls
    // applyTurnStartEffects directly, so a fight ended by a bleed tick or a death effect never
    // gets there. Measured: 55 of 63 bosses and 224 of 233 elites reached it. Adding
    // unconditionally double-counted the 55; skipping entirely lost the 8. So top up only what
    // the engine missed - the check at the end confirmed the two routes then agreed exactly.
    //
    // What the whole correction was worth, over sixty expeditions each:
    //
    //                     doubled   skipped   reconciled
    //   median score       10,650     8,670        8,355
    //   relics held, mean      8.7       3.8          3.4
    //   bosses felled         1.38      1.05         1.02
    //   deepest sector, mean   2.4       2.0          2.0
    //
    // The depth row is the one that matters beyond the arithmetic. Relics are power, so a squad
    // carrying twice as many got deeper: this file was reporting an easier game than the one
    // that exists, and every difficulty figure taken from it before this sat on that baseline.
    if (node.type === 'BOSS') {
      stat.bosses++;
      if (runStats.bosses < stat.bosses) {
        runStats.bosses = stat.bosses; bossSkulls++;
        const felled = activeEntities.find(e => e.classType === 'BOSS');
        if (felled && felled.bossId) noteGrudge(felled.bossId);
        const offer = rollRelicOffer();
        if (offer.length) { const pick = offer.find(r => r.tier === 'RARE') || offer[0]; activeRelics.push(pick); }
      }
    }
    if (node.elite) {
      stat.elites++;
      if (runStats.elites < stat.elites) {
        runStats.elites = stat.elites; checkBountyProgress('ELITE');
        const drop = rollRelic();
        if (drop) activeRelics.push(drop);
      }
    }
    checkBountyProgress('KILL');
    runStats.kills = stat.kills;
    scrap += Math.floor((20 + currentTier * 20) * (node.elite ? 2 : 1) * sectorRewardMult());
    runStats.scrapEarned += 40;
    currentTier++; noteDepth();
    spend();

    noteBoard();
    const boardNow = bountiesAtStart();
    if (boardNow !== boardBefore) { stat.bountiesDone++; boardBefore = boardNow; }
  }

  // The instrument checks itself: these count the same events by different routes, and the
  // whole point of the block above is that they must not diverge.
  stat.engineBosses = runStats.bosses; stat.engineElites = runStats.elites;
  stat.standings = Object.fromEntries(facesMet().map(f => [f.id, f.standing]));
  stat.sector = runStats.deepestSector; stat.tier = runStats.deepestTier;
  stat.relics = activeRelics.map(r => r.id);
  stat.score = computeScore(runStats);
  stat.regroupsLeft = regroupsLeft();
  stat.maxBond = Object.values(bonds).length ? Math.max(...Object.values(bonds)) : 0;
  stat.bondSaves = runStats.bondSaves || 0;
  return stat;
};

(async () => {
  const { server, port } = await serve(ROOT);
  const launch = {};
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const context = await browser.newContext({ viewport: { width: 400, height: 800 } });
  await context.addInitScript(() => {
    let engine;
    Object.defineProperty(window, 'WP', {
      configurable: true,
      get: () => engine,
      set: value => {
        engine = value;
        for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
          if (key in window) continue;
          try { Object.defineProperty(window, key, { ...desc, configurable: true }); } catch (e) {}
        }
      }
    });
  });
  const page = await context.newPage();
  const errors = [];
  let ALL_FORMATION_IDS = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForTimeout(800);
  await page.evaluate(() => { globalSettings.sfx = false; });
  ALL_FORMATION_IDS = await page.evaluate(() => ALL_FORMATIONS.map(f => f.id));

  console.log(`\nSimulating ${RUNS} expeditions at difficulty ${DIFFICULTY}, draft ${DRAFT}, tactics ${TACTICS}` +
              (CONTRACTS.length ? ` under ${CONTRACTS.join(', ')}` : '') +
              (WITHDRAW_POLICY ? ', running from fights it is losing' : ', fighting every node to a finish') + '\n');

  const results = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await page.evaluate(EXPEDITION, { difficulty: DIFFICULTY, contracts: CONTRACTS, capNodes: 400, withdrawPolicy: WITHDRAW_POLICY, EXTRACT_AT, draftPolicy: DRAFT, tacticPolicy: TACTICS });
    results.push(r);
    if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${RUNS}\n`);
  }

  const n = results.length;
  const nums = key => results.map(r => r[key]).sort((a, b) => a - b);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
  const line = (label, v) => console.log(`  ${String(label).padEnd(26)} ${v}`);

  const signed = {};
  let withRecruits = 0;
  results.forEach(r => { if (r.recruited.length) withRecruits++; r.recruited.forEach(c => { signed[c] = (signed[c] || 0) + 1; }); });
  const met = results.flatMap(r => r.bossMet).filter(m => m.won !== undefined);
  const cold = met.filter(m => !m.grudge), risen = met.filter(m => m.grudge > 0);
  const rate = a => a.length ? (a.filter(m => m.won).length / a.length * 100).toFixed(0) + '%' : '-';
  console.log('\n── COMMANDERS ' + '─'.repeat(46));
  line('fights reached, total', met.length);
  line('met for the first time', `${cold.length} fought, ${rate(cold)} won`);
  line('met again, carrying a grudge', `${risen.length} fought, ${rate(risen)} won`);
  [1, 2, 3].forEach(g => { const a = met.filter(m => m.grudge === g);
    if (a.length) line(`  risen ×${g}`, `${a.length} fought, ${rate(a)} won`); });

  console.log('\n── THE DEAD ' + '─'.repeat(48));
  const downs = results.reduce((a, r) => a + r.downs, 0);
  const saves = results.reduce((a, r) => a + r.saves, 0);
  const lost = results.reduce((a, r) => a + r.lost.length, 0);
  const lostPer = results.map(r => r.lost.length).sort((a, b) => a - b);
  line('operators put on the floor', `${downs} (${(downs / n).toFixed(1)} per run)`);
  line('turns spent saving them', saves);
  line('lost for good', `${lost} (${(lost / n).toFixed(2)} per run)`);
  line('  median / worst run', `${lostPer[Math.floor(n / 2)]} / ${lostPer[n - 1]}`);
  line('runs that lost nobody', `${results.filter(r => !r.lost.length).length} of ${n}`);
  line('runs that ran out of squad', results.filter(r => r.endedBy === 'wiped-out').length);

  console.log('\n── RECRUITS ' + '─'.repeat(48));
  const offers = results.flatMap(r => r.recruitOffers);
  const sawOne = results.filter(r => r.recruitOffers.length).length;
  line('runs that walked past one', `${sawOne} of ${n}`);
  line('offers seen in total', offers.length);
  if (offers.length) {
    const afford = offers.filter(o => o.purse >= o.cost).length;
    line('  affordable at the time', `${afford} of ${offers.length}`);
    const med = a => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
    line('  median price asked', med(offers.map(o => o.cost)));
    line('  median purse on hand', med(offers.map(o => o.purse)));
  }
  line('runs that signed anyone', `${withRecruits} of ${n}`);
  Object.entries(signed).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => line('  ' + k, `${v} runs`));
  if (!Object.keys(signed).length) line('  none', 'nobody was ever signed on');

  console.log('\n── WHERE RUNS END ' + '─'.repeat(40));
  const sectors = nums('sector');
  line('deepest sector, median', pct(sectors, 0.5));
  line('  mean / p10 / p90', `${mean(sectors).toFixed(1)} / ${pct(sectors, 0.1)} / ${pct(sectors, 0.9)}`);
  line('range', `${sectors[0]} to ${sectors[sectors.length - 1]}`);
  const ends = {};
  results.forEach(r => { ends[r.endedBy] = (ends[r.endedBy] || 0) + 1; });
  line('ended by', Object.entries(ends).map(([k, v]) => `${k} ${v}`).join(', '));
  const walked = results.filter(r => r.extracted);
  line('walked out', `${walked.length} of ${n}`);
  if (walked.length) {
    const at = walked.map(r => r.walkedAt).sort((a, b) => a - b);
    line('  sector walked at, median', pct(at, 0.5));
    // Comparing walkers against every other run would compare deep runs against shallow ones and
    // credit extraction for the depth. Only runs that got as far as the policy's door can answer
    // the question, so only those are in the comparison.
    const eligible = results.filter(r => r.sector >= EXTRACT_AT);
    const pushedOn = eligible.filter(r => !r.extracted);
    line(`  among runs that reached sector ${EXTRACT_AT}`, `${eligible.length} of ${n}, ${walked.length} walked`);
    line('    walked out, median score', pct(walked.map(r => r.score).sort((a, b) => a - b), 0.5).toLocaleString());
    if (pushedOn.length) line('    pushed on instead, median score',
      pct(pushedOn.map(r => r.score).sort((a, b) => a - b), 0.5).toLocaleString());
  }
  line('nodes cleared, median', pct(nums('nodes'), 0.5));
  line('score, median', pct(nums('score'), 0.5).toLocaleString());

  const withDoc = results.filter(r => r.doctrine);
  if (withDoc.length) {
    console.log('\n── DOCTRINES ' + '─'.repeat(44));
    line('runs that took one', `${withDoc.length} of ${n}`);
    const kept = withDoc.filter(r => r.doctrineKept).length;
    line('  still keeping it at the end', `${kept} of ${withDoc.length}`);
    const byDoc = {};
    withDoc.forEach(r => { byDoc[r.doctrine] = (byDoc[r.doctrine] || 0) + 1; });
    Object.entries(byDoc).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => line('  ' + k, v));
  }

  console.log('\n── FORMATIONS ' + '─'.repeat(43));
  const forms = {};
  results.forEach(r => Object.entries(r.formations).forEach(([k, v]) => { forms[k] = (forms[k] || 0) + v; }));
  const namedN = Object.values(forms).reduce((a, v) => a + v, 0);
  const looseN = results.reduce((a, r) => a + r.loose, 0);
  line('fights that were a named shape', `${namedN} of ${namedN + looseN} (${(100 * namedN / Math.max(1, namedN + looseN)).toFixed(0)}%)`);
  Object.entries(forms).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => line('  ' + k, v));
  const unseen = ALL_FORMATION_IDS.filter(id => !forms[id]);
  line('never met', unseen.length ? unseen.join(', ') : 'none');

  console.log('\n── FIGHTS ' + '─'.repeat(48));
  const roundsPerFight = results.map(r => r.fights ? r.rounds / r.fights : 0).sort((a, b) => a - b);
  line('actor turns per fight', pct(roundsPerFight, 0.5).toFixed(1) + ' (median)');
  line('fights per run, median', pct(nums('fights'), 0.5));
  line('bosses felled, mean', mean(nums('bosses')).toFixed(2));
  line('elites broken, mean', mean(nums('elites')).toFixed(2));
  line('wipes per run, mean', mean(nums('wipes')).toFixed(2));
  line('withdrawals per run, mean', WITHDRAW_POLICY ? mean(nums('withdrawals')).toFixed(2) : 'policy off');
  line('regroups spent, mean', mean(nums('regroupsSpent')).toFixed(2));
  const wipeSectors = {};
  results.forEach(r => r.wipedInSector.forEach(sx => { wipeSectors[sx] = (wipeSectors[sx] || 0) + 1; }));
  line('wipes by sector', Object.entries(wipeSectors).sort((a, b) => a[0] - b[0]).map(([k, v]) => `s${k}:${v}`).join(' ') || 'none');
  const wipeTiers = {};
  results.forEach(r => r.wipedAtTier.forEach(t => { wipeTiers[t] = (wipeTiers[t] || 0) + 1; }));
  line('wipes by tier', Object.entries(wipeTiers).sort((a, b) => a[0] - b[0]).map(([k, v]) => `t${k}:${v}`).join(' ') || 'none');
  const onElite = results.reduce((n, r) => n + r.wipedOnElite.filter(Boolean).length, 0);
  const allWipes = results.reduce((n, r) => n + r.wipedOnElite.length, 0);
  line('wipes on an elite node', allWipes ? `${onElite}/${allWipes} (${(onElite / allWipes * 100).toFixed(0)}%)` : 'none');

  console.log('\n── WHAT GETS USED ' + '─'.repeat(40));
  const moves = {};
  results.forEach(r => Object.entries(r.moves).forEach(([m, c]) => { moves[m] = (moves[m] || 0) + c; }));
  const totalMoves = Object.values(moves).reduce((a, b) => a + b, 0);
  const declared = await page.evaluate(() => Object.values(ABILITIES).flat().map(a => a.move));
  const ranked = Object.entries(moves).sort((a, b) => b[1] - a[1]);
  ranked.forEach(([m, c]) => line(m, `${String(c).padStart(6)}  ${(c / totalMoves * 100).toFixed(1)}%`));
  const never = declared.filter(m => !moves[m]);
  line('never used', never.length ? never.join(', ') : 'none');
  const classCounts = {};
  results.forEach(r => r.deployed.forEach(c => { classCounts[c] = (classCounts[c] || 0) + 1; }));
  line('classes deployed', Object.entries(classCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));

  const items = {};
  results.forEach(r => Object.entries(r.items).forEach(([k, v]) => { items[k] = (items[k] || 0) + v; }));
  line('items used per run', Object.entries(items).map(([k, v]) => `${k} ${(v / n).toFixed(1)}`).join(', ') || 'none');
  line('promotions per run', `${mean(nums('promotions')).toFixed(1)} (${mean(nums('sigsTaken')).toFixed(1)} signatures)`);
  line('gear equipped per run', mean(nums('gearEquipped')).toFixed(1));
  line('armories visited per run', `${mean(nums('shops')).toFixed(1)} (${Math.round(mean(nums('shopScrap')))} scrap spent)`);
  const sigs = {};
  results.forEach(r => Object.entries(r.sigsFaced || {}).forEach(([k, v]) => { sigs[k] = (sigs[k] || 0) + v; }));
  line('hostile signatures met', Object.entries(sigs).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
  line('deepest bond per run', `${mean(nums('maxBond')).toFixed(1)} fights (${mean(nums('bondSaves')).toFixed(1)} step-ins)`);
  const fronts = {};
  results.forEach(r => (r.frontsSeen || []).forEach(f => { if (f) fronts[f] = (fronts[f] || 0) + 1; }));
  line('fronts weathered', Object.entries(fronts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
  line('items crafted per run', (results.reduce((a, r) => a + r.crafted, 0) / n).toFixed(1));
  const faces = {};
  results.forEach(r => Object.entries(r.facesMet || {}).forEach(([k, v]) => { faces[k] = (faces[k] || 0) + v; }));
  line('faces met', Object.entries(faces).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
  const ground = {};
  results.forEach(r => Object.entries(r.ground || {}).forEach(([k, v]) => { ground[k] = (ground[k] || 0) + v; }));
  const groundTotal = Object.values(ground).reduce((a, b) => a + b, 0) || 1;
  line('ground fought on', Object.entries(ground).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${(v / groundTotal * 100).toFixed(0)}%`).join(', ') || 'none');
  const threads = {};
  results.forEach(r => (r.threads || []).forEach(t => { threads[t] = (threads[t] || 0) + 1; }));
  line('threads picked up', Object.entries(threads).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
  const stand = {};
  results.forEach(r => Object.entries(r.standings || {}).forEach(([k, v]) => { (stand[k] = stand[k] || []).push(v); }));
  line('standing at run end', Object.entries(stand).map(([k, v]) => `${k} ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}`).join(', ') || 'none');

  console.log('\n── RELICS ' + '─'.repeat(48));
  const relics = {};
  results.forEach(r => r.relics.forEach(id => { relics[id] = (relics[id] || 0) + 1; }));
  const allRelics = await page.evaluate(() => RELIC_POOL.map(r => ({ id: r.id, tier: r.tier })));
  allRelics.forEach(r => line(`${r.id} (${r.tier})`, `${((relics[r.id] || 0) / n * 100).toFixed(0)}% of runs`));
  line('relics held, mean', (Object.values(relics).reduce((a, b) => a + b, 0) / n).toFixed(1));
  const unreachable = allRelics.filter(r => !relics[r.id]).map(r => r.id);
  line('never dropped', unreachable.length ? unreachable.join(', ') : 'none');

  console.log('\n── THE BOARD ' + '─'.repeat(45));
  line('bounties completed, mean', mean(nums('bountiesDone')).toFixed(2));
  const settled = {};
  results.forEach(r => Object.entries(r.settled || {}).forEach(([k, v]) => { settled[k] = (settled[k] || 0) + v; }));
  const allTypes = await page.evaluate(() => BOUNTY_POOL.map(b => b.type));
  line('contracts settled', allTypes.map(t => `${t} ${settled[t] || 0}`).join(', '));
  const unsettled = allTypes.filter(t => !settled[t]);
  line('never settled', unsettled.length ? unsettled.join(', ') : 'none');
  const bookedN = results.reduce((a, r) => a + (r.booked || 0), 0);
  const doneN = results.reduce((a, r) => a + r.consequences, 0);
  line('consequences booked, mean', (bookedN / n).toFixed(2));
  line('consequences resolved, mean', mean(nums('consequences')).toFixed(2));
  line('  of what was booked', bookedN ? `${doneN} of ${bookedN} (${(100 * doneN / bookedN).toFixed(0)}%)` : 'nothing was booked');
  const kinds = {};
  results.forEach(r => Object.entries(r.bookedKinds || {}).forEach(([k, v]) => { kinds[k] = (kinds[k] || 0) + v; }));
  line('  by kind', Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
  line('events seen, mean', mean(nums('events')).toFixed(1));

  if (errors.length) {
    console.log('\n── PAGE ERRORS ' + '─'.repeat(43));
    [...new Set(errors)].slice(0, 10).forEach(e => console.log('  ' + e));
  }
  // Two independent counts of the same events. They agreed the day this check went in; if they
  // ever stop agreeing, something is being counted twice again and the number above is wrong.
  const simB = results.reduce((a, r) => a + r.bosses, 0), engB = results.reduce((a, r) => a + (r.engineBosses || 0), 0);
  const simE = results.reduce((a, r) => a + r.elites, 0), engE = results.reduce((a, r) => a + (r.engineElites || 0), 0);
  if (simB !== engB || simE !== engE)
    console.log(`\n  !! COUNTED TWICE: bosses ${simB} here vs ${engB} in the engine; elites ${simE} vs ${engE}.`
              + `\n     Every score above is wrong. Fix the post-fight block before believing any of this.`);
  else
    console.log(`\n  counts agree: ${simB} bosses, ${simE} elites, counted two ways.`);

  console.log(`\n${n} expeditions, ${errors.length} page errors.\n`);

  await browser.close();
  server.close();
  process.exit(errors.length ? 2 : 0);
})().catch(e => { console.error(e); process.exit(1); });

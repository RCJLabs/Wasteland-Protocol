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
//
// ── On the depth figures printed before C02 ─────────────────────────────────────────────
// Every one of them is void, and by a wide margin. This file never called recoverDowned on a
// won or a lost fight - only withdraw() reached it, because withdraw() does it for itself - so
// an operator who went down and was not healed mid-fight lay at zero health with a live
// bleed-out clock, walked into the NEXT initiateCombat still down, and was ticked to death by
// the turn queue. The engine drags those operators clear at the end of every fight however it
// ended. This file was killing them.
//
// Fixing it moved the game this file reports by more than any phase ever has:
//
//                              before   after
//   deepest sector, median        2       5
//   nodes cleared, median        ~25     120
//   operators on the floor/run   14.2    21.8   (they get up, so they can fall again)
//   lost for good, per run       2.33    1.92
//
// So: the wall this file has been measuring against was an artefact of the instrument, and no
// difficulty conclusion drawn from a pre-C02 run of it should be carried forward. Re-measure.
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
// `--augments off` measures the materials economy the way this file used to see it: consumables
// only, with the permanent upgrades it never installed left on the shelf.
const AUGMENTS_ON = flag('augments', 'on') !== 'off';
// A sim that never walks out measures a game with one ending. `--extract N` gives it the
// player who leaves once the run is worth banking: from sector N on, it takes the camp's door
// when the squad is worn down. `off` (the default) is the old behaviour, for comparison.
const EXTRACT_RAW = flag('extract', 'off');
const EXTRACT_AT = EXTRACT_RAW === 'off' ? 99 : Number(EXTRACT_RAW);
// What a run does when it reaches the end of the road. 'walk' takes the ending and stops,
// which is what the feature is for; 'press' declines it and carries on into the post-game, so
// the endless half of the game can still be measured.
const ENDING = flag('ending', 'walk');
// Which order the expedition signs for. 'long' is the whole road, which is what every run did
// before orders existed, so it stays the default and the older figures stay comparable.
const ORDER = flag('order', 'long').toUpperCase();
// A commander's offer deals three cards and sometimes one of them is cursed. This file took
// `offer.find(RARE) || offer[0]`, which is two opinions dressed as one: prefer a rare, and
// otherwise take whatever happens to sit first. "Cursed relics are refused" was that policy
// reporting itself back, not a player declining anything - and once the curse moved into the
// first slot the same policy started taking nearly all of them, which is no more a measurement
// than the zero was. So the fallback picks at random now: no opinion between a common and a
// curse, which is the only honest default.
//
// The range is what carries meaning, so both ends are nameable:
//   --relics avoid   never takes a curse while any other card is on the table  (the floor)
//   --relics rare    prefers a rare, otherwise picks blind                     (neutral)
//   --relics random  picks blind always
//   --relics curse   takes the curse every time one is offered                 (the ceiling)
const RELICS = flag('relics', 'rare');
// Meta is never reset between expeditions here, and grudges are meta. So a sixty-run sample is
// one continuous career: the sim fells the sector-1 commander in run 1 and meets it Risen in
// run 2, capped Thrice-Risen soon after - +60% health, +36% damage, +12 armour. Measured, mean
// depth falls 3.45 -> 2.90 -> 2.30 across the thirds while grudge sits pinned at the cap, so a
// single averaged figure blends a first encounter with a nemesis and reports neither.
//
// Both games are real and they are different games. `--meta carry` (the default) is a returning
// player's arc, skulls and Citadel upgrades accumulating against grudges that accumulate back.
// `--meta fresh` wipes the ledger between runs: sixty independent first careers, which is what
// a question about the game a player actually meets has to be asked against.
const META = flag('meta', 'carry');
// Event choices were picked uniformly at random, and standing with the four faces moves only
// through those choices - so "standing barely moves across a run (-1.0 to +0.6)" was a random
// walk by construction, not a reading about the game. It cascades: five of the six follow-up
// threads gate on |standing| >= 2 with one face, so a walk that averages to zero never opens
// them, and "two of six never appeared in sixty runs" follows from the same coin.
//
// A player is not a coin. They help the tinker because they want the tinker to like them, or
// they rob the scavenger because they want the scrap. `--faces warm` takes the choice that
// raises standing with whoever is across the table, `cold` takes the one that lowers it, and
// `random` is the old behaviour. Warm and cold bracket a real player between them.
//
// Which choice is which is read off the game's own source - the noteCast call inside each
// choice's execute - rather than encoded here, so a reworded event cannot leave this file
// preferring a choice that no longer does what it used to.
const FACES = flag('faces', 'warm');

// The three games this file can measure, and why the difference is the whole story:
//
//                              median sector   mean / p90   commanders felled
//   --meta carry, skulls unspent      2          2.9 / 6           1.88
//   --meta fresh                      4          4.1 / 7           3.08
//   --meta carry, skulls spent        6          5.5 / 9           4.55
//
// The first row is what this file reported for its whole life, and it is not a game anybody
// plays. Grudges are meta and were carried, so the commanders escalated permanently to capped
// Thrice-Risen (+60% health, +36% damage, +12 armour) - while buyMetaUpgrade was called nowhere
// at all, so the player's half of that exchange never happened. Skulls piled up unspent: no
// barracks, no bigger bag, no extra fallback. A handicap match, and every "the wall is too
// close" reading came off it.
//
// Played properly, depth climbs across a career - 4.00 / 5.00 / 7.13 by thirds, with grudge
// climbing 1.35 / 2.67 / 3.00 underneath it - and the last third lands at mean sector 7.1,
// p90 9. The engine's stated target is "a run reliably ends somewhere around sector 10", so
// the curve is doing what it was built to do, and the grudge ramp is a counterweight the
// player out-paces rather than a wall.
//
// What this file measured about depth, before the player below could read a board:
//
//   player                                 median sector   nodes   ended
//   random ability, always at foes[0]            2           49    wiped 60/60
//   reads the board (below)                      2           50    wiped 60/60
//   reads the board, and the tactic shelf too    2           50    wiped 60/60
//
// Three materially different players, one wall. Move selection reshaped hard - HEAVY_WRENCH
// 3.9% to 7.0% of all actions, CAUTERIZE 3.3 to 6.5, FLASHBANG 2.0 to 4.5, DEADEYE 1.1 to 2.5
// as specials stopped losing coin flips to basic attacks - and depth did not move at all. So
// the wall is not a readout of this file's play, which is the one thing that had to be ruled
// out before anything was concluded from it.
//
// Where it actually sits: wipes by tier read t8:7 t9:7 t10:238. The commander at tier 10 takes
// 92% of every wipe in the run, and the nine tiers under it produced 20 across sixty runs.
//
// Runs one expedition inside the page. Plays to a real conclusion: the squad wipes out of
// regroups, or the safety cap is hit.
const EXPEDITION = ({ difficulty, contracts, capNodes, withdrawPolicy, EXTRACT_AT, draftPolicy, tacticPolicy, AUGMENTS_ON, relicPolicy, metaPolicy, facePolicy, endingPolicy, orderPolicy }) => {
  const stat = { order: null, fulfilled: false, won: false, wonAt: 0, roadWarlords: 0, raised: 0, stillUp: 0, tallyAtEnd: 0,
                 sector: 1, tier: 1, nodes: 0, fights: 0, rounds: 0, kills: 0, deployed: [],
                 wipedInSector: [], wipedAtTier: [], wipedOnElite: [],
                 wipes: 0, withdrawals: 0, facesMet: {}, threads: [], standings: {}, ground: {}, settled: {}, posted: null, regroupsSpent: 0, bosses: 0, elites: 0, events: 0, camps: 0,
                 moves: {}, items: {}, relics: [], bountiesDone: 0, consequences: 0, crafted: 0,
                 promotions: 0, sigsTaken: 0, gearEquipped: 0, shops: 0, shopScrap: 0, sigsFaced: {},
                 maxBond: 0, bondSaves: 0, frontsSeen: [],
                 endedBy: 'cap', score: 0, contractMult: 1, recruited: [], recruitOffers: [], saves: 0, downs: 0, lost: [], bossMet: [],
                 extracted: false, walkedAt: 0, formations: {}, loose: 0, doctrine: null, doctrineKept: false,
                 booked: 0, bookedKinds: {}, augments: 0,
                 relicOffers: 0, cursedOffered: 0, cursedTaken: 0, cacheOffered: 0, cacheTaken: 0,
                 bossGrudge: [], metGrudge: [], scars: [], recovered: 0 };

  // Skulls were banked and never spent: buyMetaUpgrade was called nowhere in this file. So the
  // carried sample escalated the commanders permanently - grudges are meta - while switching
  // the player's half of that exchange off entirely. No Citadel upgrades, no extra fallback, no
  // bigger bag, no start scrap; skulls just piled up. That is not a career, it is a handicap
  // match, and every depth figure taken from a carried run sat on it.
  //
  // Three of the Citadel's buildings carry no max - SCRAP CRANE, BARRACKS, FALLBACK BUNKER -
  // so any greedy ordering degenerates into one building, and each attempt proved it. Preferring
  // the FALLBACK BUNKER stacked unlimited retries and runs stopped ending: the sample was still
  // on expedition 20 after twenty minutes. Cheapest-first then bought SCRAP CRANE to level 327
  // and nothing else at all, which is +16,350 starting scrap and no barracks, no bag, no
  // fallback.
  //
  // So: breadth-first. Lowest level anywhere on the hillside, ties to the cheaper. That fills
  // the Citadel out the way a player does - a bit of everything, unlocking what is gated -
  // instead of pouring a career into one wall.
  const spendSkulls = () => {
    let guard = 0;
    while (guard++ < 60) {
      const sp = CITADEL_SPOTS.filter(o => !spotMaxed(o) && spotUnlocked(o) && bossSkulls >= o.cost)
                              .sort((a, b) => (a.level() - b.level()) || (a.cost - b.cost))[0];
      if (!sp) break;
      const before = bossSkulls;
      buyMetaUpgrade(sp.kind);
      if (bossSkulls === before) break;
    }
  };

  activeContracts = [...contracts];
  currentSlot = 1;
  // Set before confirmNewGame, which is where newRunStats reads it onto the run.
  if (orderById(orderPolicy)) activeOrder = orderPolicy;
  if (metaPolicy !== 'fresh') spendSkulls();
  if (metaPolicy === 'fresh') {
    // Written out against the real shape rather than mapped over the keys: startLevel is 1 and
    // invMax is 4 at a fresh install, and zeroing every number would quietly deploy level-zero
    // operators with no bag and report that as difficulty.
    grudges = {}; bossSkulls = 0; mastery = {}; bestiary = {};
    metaUpgrades = { startScrap: 0, startLevel: 1, invMax: 4, extraRegroups: 0, vault: 0,
                     heirloom: null, heirloomWalked: false,
                     rerolls: 0, discount: 0, archive: 0, warRoom: 0, cache: 0 };
    saveMeta();
  }
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
    // Augments are the other half of the materials economy and this file never touched them:
    // installAugment was called zero times, which is most of why "the whole economy resolves to
    // make more stims" looked true. They are permanent and per-operator, so they get first call
    // on materials; consumables are what the leftovers buy.
    if (AUGMENTS_ON) {
      let aGuard = 0;
      while (aGuard++ < 8) {
        const who = playerRoster.filter(c => c.gridPos > 0);
        const target = who.find(c => (c.augments || []).length < 3);
        if (!target) break;
        const had = (target.augments || []).length;
        if (materials.parts >= 3) installAugment(target.id, 'PLATING');
        else if (materials.tech >= 2) installAugment(target.id, 'OPTICS');
        else if (materials.chems >= 2) installAugment(target.id, 'PUMP');
        else break;
        if ((target.augments || []).length === had) break;
        stat.augments++;
      }
    }
    // This used to craft Med-Stims and nothing else, which is most of why the audit read the
    // other three as dead content: they were never in the bag to be used. It keeps a Med-Stim
    // or two for the floor and then spends what is left on whatever the materials allow.
    // Affordability is asked of the game (canAfford reads the same recipe craftItem spends), so
    // repricing a schematic cannot leave the simulator buying at yesterday's price.
    const before = () => inventory.length;
    while (canCarry() && canAfford('MED_STIM') && inventory.filter(i => i === 'MED_STIM').length < 2) {
      const n = before(); craftItem('MED_STIM'); if (inventory.length === n) break; stat.crafted++;
    }
    let guard = 0;
    while (canCarry() && guard++ < 12) {
      const n = before();
      const pick = ['EMP_CHARGE', 'ADRENALINE', 'SCRAP_BOMB', 'MED_STIM'].find(canAfford);
      if (!pick) break;
      craftItem(pick);
      if (inventory.length === n) break;
      stat.crafted++;
    }
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
    // deckFor, not ABILITIES: a class at mastery rank 3 fights with a fourth ability, and
    // reading the raw table meant every one of those was measured as never used.
    const deck = deckFor(actor).filter(a => !a.cd || (actor.cooldowns[a.cd] || 0) === 0);
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
      // Adrenaline is on the REACHES_THE_DOWN list too, and getting them up at all beats
      // getting them up well.
      if (inventory.includes('ADRENALINE')) {
        stat.items.ADRENALINE = (stat.items.ADRENALINE || 0) + 1;
        stat.saves++;
        pendingAction = 'ITEM_ADRENALINE'; resolveConsumableItem(worst.id); return true;
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
    // An operator who is stunned or bleeding has already lost the turn; Adrenaline buys it back.
    const fouled = activeEntities.find(e => e.isPlayer && e.hp > 0 && ((e.stunnedTurns || 0) > 0 || (e.bleedingTurns || 0) > 0));
    if (fouled && inventory.includes('ADRENALINE')) {
        stat.items.ADRENALINE = (stat.items.ADRENALINE || 0) + 1;
        pendingAction = 'ITEM_ADRENALINE'; resolveConsumableItem(fouled.id); return true;
    }
    // An EMP denies a turn, which is what BREAK costs 35 momentum to do. Spent on whoever is
    // about to do the most, the same read BREAK uses.
    if (inventory.includes('EMP_CHARGE')) {
        const worstFoe = (typeof breakTarget === 'function' ? breakTarget() : null)
          || foes.slice().sort((a, b) => b.dmgBase - a.dmgBase)[0];
        if (worstFoe && (worstFoe.stunnedTurns || 0) <= 0) {
            const f = forecastFor(worstFoe);
            const hurts = f && f.hits ? f.hits.reduce((a, h) => a + h.dmg, 0) : worstFoe.dmgBase;
            const pool = activeEntities.filter(e => e.isPlayer && e.hp > 0).reduce((a, e) => a + e.hp, 0);
            if (hurts > pool * 0.15) {
                stat.items.EMP_CHARGE = (stat.items.EMP_CHARGE || 0) + 1;
                pendingAction = 'ITEM_EMP'; resolveConsumableItem(worstFoe.id); return true;
            }
        }
    }

    // Attack selection used to be `deck[random]` swung at `foes[0]`, which is not a player, it
    // is a coin. It ignored cooldowns, reach, crowds and health bars, and every depth figure
    // this file has ever reported was a readout of that coin - the same defect that once had a
    // throwaway probe reporting every formation hitting the turn cap.
    //
    // What follows is a competent player, not an optimal one, and deliberately reads only what
    // the game already puts on screen: the health bars, the intent icons, the reach penalty
    // printed on the deck button, and the combo tag. No damage formula is duplicated here - a
    // second copy of the arithmetic would drift from the engine and become the next bad
    // instrument.
    const dist = f => foes.indexOf(f);
    const soft = (mv, f) => reachMult(mv, actor, dist(f)) < 1;   // what the button says
    // What a foe is about to do to you, which is what the intent icon shows.
    const threat = f => {
      const fc = forecastFor(f);
      return fc && fc.hits ? fc.hits.reduce((a, h) => a + h.dmg, 0) : (f.dmgBase || 0);
    };
    // A health bar in the red is the whole reason focus fire exists: a foe removed stops acting,
    // a foe half-removed does not.
    const finishable = f => f.hp <= f.maxHp * 0.25;
    const pickFoe = mv => {
      const reachable = foes.filter(f => !soft(mv, f));
      const pool = reachable.length ? reachable : foes;
      const kill = pool.filter(finishable).sort((a, b) => a.hp - b.hp)[0];
      if (kill) return kill;
      return pool.slice().sort((a, b) => threat(b) - threat(a))[0] || foes[0];
    };

    let chosen = null, target = null;
    // 1. A combo is the game's own signposted best move, and it is signposted on the button.
    for (const a of deck) {
      const hit = foes.find(f => comboFor(a.move, f) && !soft(a.move, f))
               || foes.find(f => comboFor(a.move, f));
      if (hit) { chosen = a; target = hit; break; }
    }
    // 2. Three or more of them standing is what an AoE is for.
    if (!chosen && foes.length >= 3) {
      const blast = deck.find(a => isAoe(a.move));
      if (blast) chosen = blast;
    }
    // 3. Otherwise the best thing available: a special off cooldown beats the basic attack (it
    //    has a cooldown because it is worth more), and a swing that lands soft loses to one
    //    that does not.
    if (!chosen) {
      const usable = deck.filter(a => a.act !== 'self');
      const rank = a => (a.cd ? 2 : 1) + (foes.some(f => !soft(a.move, f)) ? 2 : 0);
      chosen = usable.sort((a, b) => rank(b) - rank(a))[0] || deck[0];
    }
    if (!target) target = pickFoe(chosen.move);
    if (chosen.act === 'self') { stat.moves[chosen.move] = (stat.moves[chosen.move] || 0) + 1; executeSelfAction(chosen.move); return true; }
    if (chosen.move === 'CAUTERIZE') {
      const hurt = activeEntities.filter(e => e.isPlayer && e.hp > 0 && e.hp < e.maxHp)[0];
      if (!hurt) { chosen = deck.find(a => a.move !== 'CAUTERIZE') || deck[0]; }
      else { stat.moves.CAUTERIZE = (stat.moves.CAUTERIZE || 0) + 1; pendingAction = 'CAUTERIZE'; resolveAction(hurt.id); return true; }
    }
    stat.moves[chosen.move] = (stat.moves[chosen.move] || 0) + 1;
    pendingAction = chosen.move; resolveAction((target || foes[0]).id);
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
    // Scars are dealt inside recoverDowned, and every ending reaches it - including withdraw(),
    // which does it for itself. So the snapshot is taken at the door and the diff read at each
    // exit rather than at any one of them.
    const marks = () => playerRoster.flatMap(c => (c.scars || []).map(id => c.id + ':' + id));
    const scarsAtStart = marks();
    const tallyScars = () => marks().filter(m => !scarsAtStart.includes(m))
        .forEach(m => { if (!stat.__seen) stat.__seen = []; if (!stat.__seen.includes(m)) { stat.__seen.push(m); stat.scars.push(m.split(':')[1]); } });
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
        // withdraw() reaches recoverDowned on its own, so the operators it picks up have to be
        // counted here or the scar rate is measured against a denominator missing every one of
        // the five withdrawals a run. That read 12% against a 0.08 chance and looked like a bug
        // in the game rather than a bug in the tally.
        stat.recovered += bleedingOut().length;
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
    if (fled) { tallyScars(); stat.withdrawals++; return 'fled'; }
    const survived = activeEntities.some(e => e.isPlayer && e.hp > 0);
    const foesLeft = activeEntities.filter(e => !e.isPlayer && e.hp > 0).length;
    stat.kills += activeEntities.filter(e => !e.isPlayer && e.hp <= 0).length;
    const won = survived && foesLeft === 0;
    // checkWinState does this in the real loop, and without it the board's fight-end contracts
    // would read as content nobody ever settles.
    if (won) noteFightWon();
    // Nothing here called recoverDowned. The engine calls it on every ending - the victory
    // block, handleSquadWipe, withdraw, fallBackToNode - and this loop reached it only through
    // withdraw(), so a won fight left its casualties lying at zero health with a live bleed-out
    // clock. They walked into the NEXT initiateCombat still down, the queue ticked them, and the
    // sim killed operators the real game had already dragged clear. Every "lost for good" figure
    // this file has printed sat on that. It also meant scars, which are dealt inside
    // recoverDowned, could not be measured at all: the rate would have read zero whatever the
    // chance was set to.
    const up = recoverDowned(won ? 'once the field is held' : 'as the squad is dragged off');
    stat.recovered += up.length;
    tallyScars();
    combatActive = false;
    return won ? 'won' : 'lost';
  };

  while (stat.nodes < capNodes) {
    if (currentTier > TOTAL_TIERS) {
      // The order runs out. The engine puts this on the map as two buttons; here it is taken,
      // because taking it is what the order is for - a run that signs for three sectors and
      // then walks past the transport has not measured a Sortie, it has measured a long road
      // with extra steps.
      if (isLastOrdered() && !runStats.won) {
        stat.fulfilled = true; stat.endedBy = 'recalled';
        orderHome();
        break;
      }
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
      if (options.length) {
        const swing = c => { const m = String(c.execute).match(/noteCast\(\s*'(\w+)'\s*,\s*(-?\d+)/);
                             return m ? Number(m[2]) : 0; };
        const best = facePolicy === 'warm' ? Math.max(...options.map(swing))
                   : facePolicy === 'cold' ? Math.min(...options.map(swing)) : null;
        const pool = best === null ? options : options.filter(c => swing(c) === best);
        pool[Math.floor(Math.random() * pool.length)].execute();
      }
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
      // The camp is the second door a curse can come through, and it only opens when the squad
      // is in trouble. Counted whether or not this policy walks through it, so "how often was
      // the bargain even on the table" has a denominator that does not depend on the taker.
      const cache = cacheOffer();
      if (cache) stat.cacheOffered++;
      if (cache && (relicPolicy === 'curse' || (relicPolicy === 'random' && Math.random() < 0.5))) {
        stat.cacheTaken++; stat.cursedTaken++;
        resolveCamp('CACHE');           // takes the camp: no triage this stop
      } else {
        playerRoster.forEach(p => { if (p.gridPos > 0 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.35)); });
      }
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
      if (node.type === 'BOSS') stat.metGrudge.push(grudgeOn(bossForSector().id));
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
        if (felled && felled.bossId) {
          stat.bossGrudge.push(felled.grudge || 0); noteGrudge(felled.bossId);
          runStats.warlords = runStats.warlords || []; runStats.warlords.push(felled.bossId);
          // The win banks inside checkWinState, and this loop reaches checkWinState for about
          // seven kills in eight - a fight ended by a bleed tick or a death effect never gets
          // there. Reconciled rather than added, exactly as the skull above is: without this,
          // one win in eight would have gone unrecorded and the rate read low.
          if (felled.isFinal) noteVictory();
        }
        // The engine did not count this kill, so it did not stage the offer either. Stage it.
        if (!pendingRelicOffer) { const o = rollRelicOffer(); if (o.length) pendingRelicOffer = o; }
      }
      // What the ossuary raised, and what it was holding when it died - the two numbers that
      // say whether the last fight is doing what it was built to do.
      const last = activeEntities.find(e => e.isFinal);
      if (last) { stat.raised = activeEntities.filter(e => e.classType === 'REVENANT').length;
                  stat.stillUp = activeEntities.filter(e => e.classType === 'REVENANT' && e.hp > 0).length;
                  stat.tallyAtEnd = last.tallyStacks || 0; }
      // The engine stages a commander's relic as pendingRelicOffer and waits for a player to
      // pick a card. This file never touched pendingRelicOffer, so once the double-count fix
      // made it defer to the engine's own count, every commander relic was staged and then
      // dropped on the floor: 108 boss kills across sixty runs produced 11 relics. Everything
      // read off "relics held" since then, the cursed tier included, was measuring that leak.
      if (pendingRelicOffer && pendingRelicOffer.length) {
        const offer = pendingRelicOffer;
        stat.relicOffers++;
        const curse = offer.find(r => r.tier === 'CURSED');
        if (curse) stat.cursedOffered++;
        const any = a => a[Math.floor(Math.random() * a.length)];
        const clean = offer.filter(r => r.tier !== 'CURSED');
        const pick = relicPolicy === 'curse'  ? (curse || offer.find(r => r.tier === 'RARE') || any(offer))
                   : relicPolicy === 'avoid'  ? (offer.find(r => r.tier === 'RARE') || any(clean.length ? clean : offer))
                   : relicPolicy === 'random' ? any(offer)
                   : (offer.find(r => r.tier === 'RARE') || any(offer));
        if (pick.tier === 'CURSED') stat.cursedTaken++;
        takeRelic(offer.indexOf(pick));
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

    // The end of the road. The engine puts this question on a screen with two buttons; here it
    // is a policy, so both answers can be measured. Either way the win is already banked - what
    // the policy decides is only whether the expedition stops on it.
    if (runStats.won && !runStats.winShown) {
      runStats.winShown = true;
      stat.won = true; stat.wonAt = runStats.wonAtSector || currentSector;
      stat.roadWarlords = roadWarlords(runStats).length;
      if (endingPolicy !== 'press') { stat.endedBy = 'won'; victoryWalk(); break; }
    }
    spend();

    noteBoard();
    const boardNow = bountiesAtStart();
    if (boardNow !== boardBefore) { stat.bountiesDone++; boardBefore = boardNow; }
  }

  // The instrument checks itself: these count the same events by different routes, and the
  // whole point of the block above is that they must not diverge.
  stat.order = runStats.order;
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
  let SCAR_IDS = [];
  let FINAL_SECTOR_N = 7;
  let ORDER_NAME = '', ORDER_SECTORS = 7;
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForTimeout(800);
  await page.evaluate(() => { globalSettings.sfx = false; });
  ALL_FORMATION_IDS = await page.evaluate(() => ALL_FORMATIONS.map(f => f.id));
  SCAR_IDS = await page.evaluate(() => SCAR_POOL.map(sc => sc.id));
  FINAL_SECTOR_N = await page.evaluate(() => FINAL_SECTOR);
  const ordSpec = await page.evaluate(id => { const o = orderById(id); return o ? { name: o.name, sectors: o.sectors } : null; }, ORDER);
  ORDER_NAME = ordSpec ? ordSpec.name : ORDER;
  ORDER_SECTORS = ordSpec ? ordSpec.sectors : FINAL_SECTOR_N;

  console.log(`\nSimulating ${RUNS} expeditions at difficulty ${DIFFICULTY}, draft ${DRAFT}, tactics ${TACTICS}, relics ${RELICS}, meta ${META}, faces ${FACES}` +
              (CONTRACTS.length ? ` under ${CONTRACTS.join(', ')}` : '') +
              (WITHDRAW_POLICY ? ', running from fights it is losing' : ', fighting every node to a finish') + '\n');

  const results = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await page.evaluate(EXPEDITION, { difficulty: DIFFICULTY, contracts: CONTRACTS, capNodes: 400, withdrawPolicy: WITHDRAW_POLICY, EXTRACT_AT, draftPolicy: DRAFT, tacticPolicy: TACTICS, AUGMENTS_ON, relicPolicy: RELICS, metaPolicy: META, facePolicy: FACES, endingPolicy: ENDING, orderPolicy: ORDER });
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
  const recovered = results.reduce((a, r) => a + r.recovered, 0);
  line('operators put on the floor', `${downs} (${(downs / n).toFixed(1)} per run)`);
  line('turns spent saving them', saves);
  line('dragged clear at a fight\u2019s end', `${recovered} (${(recovered / n).toFixed(1)} per run)`);
  line('lost for good', `${lost} (${(lost / n).toFixed(2)} per run)`);
  line('  median / worst run', `${lostPer[Math.floor(n / 2)]} / ${lostPer[n - 1]}`);
  line('runs that lost nobody', `${results.filter(r => !r.lost.length).length} of ${n}`);
  line('runs that ran out of squad', results.filter(r => r.endedBy === 'wiped-out').length);

  // What the floor costs the ones who get up. A rate near one a run is the target: often enough
  // that a career accumulates them, rare enough that a single bad node is not a sentence.
  const allScars = results.flatMap(r => r.scars);
  const perRun = results.map(r => r.scars.length).sort((a, b) => a - b);
  line('scars dealt', `${allScars.length} (${(allScars.length / n).toFixed(2)} per run)`);
  line('  median / worst run', `${perRun[Math.floor(n / 2)]} / ${perRun[n - 1]}`);
  line('runs that took none', `${results.filter(r => !r.scars.length).length} of ${n}`);
  line('share of recoveries scarred', recovered ? `${Math.round(allScars.length / recovered * 100)}%` : 'n/a');
  const byScar = {};
  allScars.forEach(id => { byScar[id] = (byScar[id] || 0) + 1; });
  SCAR_IDS.forEach(id => line(`  ${id.toLowerCase().replace(/_/g, ' ')}`, byScar[id] || 'never dealt'));

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

  // This file never resets meta between expeditions, so grudges accumulate: by the end of a
  // sixty-run sample the commanders are Risen and carrying +60% health. That is a real player's
  // arc, but it means a single averaged figure blends a first encounter with a thrice-risen
  // one - so the sample is split and shown drifting, or not, rather than assumed steady.
  const third = Math.max(1, Math.floor(n / 3));
  const band = (a, b) => results.slice(a, b);
  const depthOf = rs => (rs.reduce((x, r) => x + r.sector, 0) / rs.length).toFixed(2);
  const grudgeOf = rs => { const g = rs.flatMap(r => r.metGrudge.concat(r.bossGrudge));
                           return g.length ? (g.reduce((x, y) => x + y, 0) / g.length).toFixed(2) : '-'; };
  console.log('\n── META DRIFT ACROSS THE SAMPLE ' + '─'.repeat(26));
  line('Citadel at the end', await page.evaluate(() => CITADEL_SPOTS.map(sp => `${sp.name.split(' ')[0]} ${sp.level()}`).join(', ')));
  line('skulls left unspent', await page.evaluate(() => bossSkulls));
  line('deepest sector, mean, by third', `${depthOf(band(0, third))} / ${depthOf(band(third, 2 * third))} / ${depthOf(band(2 * third, n))}`);
  line('grudge on commanders met, same', `${grudgeOf(band(0, third))} / ${grudgeOf(band(third, 2 * third))} / ${grudgeOf(band(2 * third, n))}`);

  // How long an order actually takes, which is the question orders exist to answer.
  console.log('\n── THE ORDER ' + '─'.repeat(45));
  line('signed for', `${ORDER_NAME || ORDER} \u00B7 ${ORDER_SECTORS} sectors`);
  const keptN = results.filter(r => r.fulfilled).length;
  line('kept', `${keptN} of ${n} (${Math.round(keptN / n * 100)}%)`);
  if (keptN) {
    const kn = results.filter(r => r.fulfilled).map(r => r.nodes).sort((a, b) => a - b);
    const kf = results.filter(r => r.fulfilled).map(r => r.fights).sort((a, b) => a - b);
    const ks = results.filter(r => r.fulfilled).map(r => r.score).sort((a, b) => a - b);
    line('  nodes to keep it, median', `${pct(kn, 0.5)} (p90 ${pct(kn, 0.9)})`);
    line('  fights to keep it, median', `${pct(kf, 0.5)} (p90 ${pct(kf, 0.9)})`);
    line('  score for keeping it, median', pct(ks, 0.5).toLocaleString());
  }
  line('lost before the recall', `${results.filter(r => !r.fulfilled).length} of ${n}`);

  console.log('\n── WHERE RUNS END ' + '─'.repeat(40));
  const sectors = nums('sector');
  line('deepest sector, median', pct(sectors, 0.5));
  line('  mean / p10 / p90', `${mean(sectors).toFixed(1)} / ${pct(sectors, 0.1)} / ${pct(sectors, 0.9)}`);
  line('range', `${sectors[0]} to ${sectors[sectors.length - 1]}`);
  const ends = {};
  results.forEach(r => { ends[r.endedBy] = (ends[r.endedBy] || 0) + 1; });
  line('ended by', Object.entries(ends).map(([k, v]) => `${k} ${v}`).join(', '));

  // The number the ending exists to be judged on. A win has to be a good run and not a typical
  // one - if every run wins the gate is too shallow, and if none does the content does not
  // exist. Every figure here is measured on a player that barely heals and never rethinks a
  // line, so it is the floor of what a person can do rather than the middle of it.
  const wins = results.filter(r => r.won);
  const reached = results.filter(r => r.sector >= FINAL_SECTOR_N);
  line(`reached sector ${FINAL_SECTOR_N}`, `${reached.length} of ${n} (${Math.round(reached.length / n * 100)}%)`);
  line('  and won it', reached.length ? `${wins.length} of ${reached.length} (${Math.round(wins.length / reached.length * 100)}%)`
                                      : 'no run got that far');
  line('runs that ended the road', `${wins.length} of ${n} (${Math.round(wins.length / n * 100)}%)`);
  if (wins.length) {
    line('  warlords felled on the way, mean', (wins.reduce((a, r) => a + r.roadWarlords, 0) / wins.length).toFixed(1));
    line('  raised by the ossuary, mean', (wins.reduce((a, r) => a + r.raised, 0) / wins.length).toFixed(1));
    // Two ways through the last phase and this says which one the squad took. Clearing the
    // raised lifts the ward and arms the finish; grinding the warlord at 30% leaves it with
    // nothing to spend. Both are real lines - what would be wrong is only one of them existing.
    const ground = wins.filter(r => r.stillUp > 0).length;
    line('  ground through the ward', `${ground} of ${wins.length}`);
    line('  cleared the raised first', `${wins.length - ground} of ${wins.length}`);
    line('  tally it died holding, mean', (wins.reduce((a, r) => a + r.tallyAtEnd, 0) / wins.length).toFixed(1));
    const ws = wins.map(r => r.score).sort((a, b) => a - b);
    line('  score on a won run, median', pct(ws, 0.5).toLocaleString());
  }
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
  line('augments installed per run', (results.reduce((a, r) => a + (r.augments || 0), 0) / n).toFixed(1));
  const faces = {};
  results.forEach(r => Object.entries(r.facesMet || {}).forEach(([k, v]) => { faces[k] = (faces[k] || 0) + v; }));
  line('faces met', Object.entries(faces).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
  const ground = {};
  results.forEach(r => Object.entries(r.ground || {}).forEach(([k, v]) => { ground[k] = (ground[k] || 0) + v; }));
  const groundTotal = Object.values(ground).reduce((a, b) => a + b, 0) || 1;
  line('ground fought on', Object.entries(ground).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${(v / groundTotal * 100).toFixed(0)}%`).join(', ') || 'none');
  // Every thread listed, including the ones that fired zero times - a list of what turned up
  // cannot show you what never did, and "two of six never appeared" is the whole finding.
  const threads = {};
  results.forEach(r => (r.threads || []).forEach(t => { threads[t] = (threads[t] || 0) + 1; }));
  const allThreads = await page.evaluate(() => FOLLOWUPS.map(f => f.title));
  allThreads.forEach(t => line(`  thread: ${t}`, `${threads[t] || 0} of ${n} runs`));
  // A mean is what a random walk hides behind: +1 and -1 average to zero and report as "barely
  // moves". What matters is how far it got, and how often it got far enough to open a door.
  const stand = {};
  results.forEach(r => Object.entries(r.standings || {}).forEach(([k, v]) => { (stand[k] = stand[k] || []).push(v); }));
  Object.entries(stand).forEach(([k, v]) => {
    const mean = (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1);
    const hi = Math.max(...v), lo = Math.min(...v);
    const gated = v.filter(x => Math.abs(x) >= 2).length;
    line(`  standing: ${k}`, `mean ${mean}, range ${lo} to ${hi}, reached a gate in ${gated}/${v.length}`);
  });

  console.log('\n── RELICS ' + '─'.repeat(48));
  const relics = {};
  results.forEach(r => r.relics.forEach(id => { relics[id] = (relics[id] || 0) + 1; }));
  const allRelics = await page.evaluate(() => RELIC_POOL.map(r => ({ id: r.id, tier: r.tier })));
  allRelics.forEach(r => line(`${r.id} (${r.tier})`, `${((relics[r.id] || 0) / n * 100).toFixed(0)}% of runs`));
  line('relics held, mean', (Object.values(relics).reduce((a, b) => a + b, 0) / n).toFixed(1));
  const unreachable = allRelics.filter(r => !relics[r.id]).map(r => r.id);
  line('never dropped', unreachable.length ? unreachable.join(', ') : 'none');
  // A per-run percentage for a curse says nothing without knowing how often one was even on
  // the table: a commander offer is the only place a curse can appear, and the median run
  // does not reach many commanders. Counts, then rates off those counts.
  const tot = k => results.reduce((a, r) => a + (r[k] || 0), 0);
  const relOffers = tot('relicOffers'), cOff = tot('cursedOffered'), cTook = tot('cursedTaken');
  line('relic offers seen', `${relOffers} across ${n} runs (${(relOffers / n).toFixed(2)} per run)`);
  line('offers holding a curse', relOffers ? `${cOff} of ${relOffers} (${(cOff / relOffers * 100).toFixed(0)}%)` : '0 - no offers');
  const cacheOff = tot('cacheOffered'), cacheTk = tot('cacheTaken');
  line('camp caches offered', `${cacheOff} across ${n} runs (${(cacheOff / n).toFixed(2)} per run)`);
  line('camp caches taken', `${cacheTk} (policy: ${RELICS})`);
  line('curses taken', `${cTook} in total \u2014 ${cTook - cacheTk} from ${cOff} commander offers, ${cacheTk} from the camp (policy: ${RELICS})`);

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

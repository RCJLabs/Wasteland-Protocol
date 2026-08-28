// Wasteland Protocol engine. An ES module (strict by default, deferred by default), so
// none of its declarations leak onto window - the markup reaches the engine only through
// data-action attributes, never by calling a global. See the inspection surface at the
// foot of this file for the one deliberate export.

const ASSET_LIST = [
    "bg_title.webp", "bg_combat.webp", "bg_thunderdome.webp", "bg_refinery.webp", "bg_highway.webp", "bg_canyon.webp",
    "hero_bruiser.webp", "hero_medic.webp", "hero_scavenger.webp", "hero_pyro.webp", "hero_shotgunner.webp", "hero_sniper.webp", "hero_hound.webp",
    "enemy_dog.webp", "enemy_mutant.webp", "enemy_chem.webp", "enemy_raider.webp", "enemy_psycho.webp", "enemy_sniper.webp", "enemy_juggernaut.webp", "enemy_drone.webp", "enemy_turret.webp", "enemy_warrig.webp", "enemy_boss.webp"
];
// The title art is fetched immediately; everything else waits until the menu is up so the
// first screen is not stuck behind the whole art set.
function preloadAssets() {
    const TITLE = 'bg_title.webp';
    new Image().src = TITLE;
    const rest = ASSET_LIST.filter(a => a !== TITLE);
    const defer = window.requestIdleCallback || (fn => setTimeout(fn, 400));
    defer(() => rest.forEach(src => { let img = new Image(); img.src = src; }));
}

const BASE_SAVE_KEY = 'wasteland_rpg_core_slot_'; 
const SETTINGS_KEY = 'wasteland_rpg_core_settings';
const META_KEY = 'wasteland_rpg_core_meta';

let audioCtx = null;
let currentSlot = 1;
let globalSettings = { combatSpeed: 1.0, sfx: true };
let previousScreen = '';

let bossSkulls = 0; let metaUpgrades = { startScrap: 0, startLevel: 1, invMax: 4 };
let scrap = 0; let currentTier = 1; let currentSector = 1; let difficultyMult = 1.0; 
let inventory = []; let materials = { parts: 0, chems: 0, tech: 0 }; 
let tuneUpBattles = 0; 
let activeBounties = []; 
let momentum = 0;
let activeRelics = [];

let combatBgFile = 'bg_combat.webp'; let pendingCombat = null;
let runStats = null;
let activeEvent = null;
let outpostTab = 'ROSTER'; let activePosSelector = null; let activePerkSelector = null; let currentWeather = 'CLEAR'; let currentNodeType = '';
let isCurrentNodeElite = false;

const QUIRK_POOL = [
    { id: 'RECKLESS', name: 'RECKLESS (+5 DMG, -15 HP)', dmg: 5, hp: -15, spd: 0 },
    { id: 'TWITCHY', name: 'TWITCHY (+3 SPD, -10 HP)', dmg: 0, hp: -10, spd: 3 },
    { id: 'STURDY', name: 'STURDY (+20 HP, -2 SPD)', dmg: 0, hp: 20, spd: -2 },
    { id: 'VAMPIRIC', name: 'VAMPIRIC (Heal 2 HP on Hit)', dmg: 0, hp: 0, spd: 0 },
    { id: 'LETHARGIC', name: 'LETHARGIC (+8 DMG, -3 SPD)', dmg: 8, hp: 0, spd: -3 }
];

const RELIC_POOL = [
    { id: 'THERMAL_CORE', name: "Thermal Core", desc: "Energy attacks deal +30% DMG." },
    { id: 'KINETIC_MESH', name: "Kinetic Mesh", desc: "Frontline position takes -25% Physical DMG." },
    { id: 'BLOOD_VIAL', name: "Blood Vial", desc: "Bio attacks heal attacker for 5 HP." },
    { id: 'SCRAP_MAGNET', name: "Scrap Magnet", desc: "Gain +15 Scrap after every combat." }
];

const SECTOR_LAYOUT = [
    [{type:'BOSS', elite:false}], 
    [{type:'RAIDERS', elite:true}, {type:'BEASTS', elite:false}], 
    [{type:'MECH', elite:false}, {type:'RAIDERS', elite:false}],   
    [{type:'EVENT', elite:false}, {type:'RAIDERS', elite:false}], 
    [{type:'MECH', elite:false}, {type:'BEASTS', elite:false}], 
    [{type:'CAMP', elite:false}, {type:'BEASTS', elite:false}, {type:'RAIDERS', elite:false}], 
    [{type:'MECH', elite:false}, {type:'RAIDERS', elite:false}],   
    [{type:'EVENT', elite:false}, {type:'CAMP', elite:false}], 
    [{type:'BEASTS', elite:false}, {type:'RAIDERS', elite:false}], 
    [{type:'RAIDERS', elite:false}] 
];
const TOTAL_TIERS = SECTOR_LAYOUT.length;
const SECTOR_TIER_BONUS = 3;

const EVENT_POOL = [
    { title: "WRECKED CARAVAN", desc: "You stumble upon a destroyed merchant rig. The engine block is sparking dangerously, but the cargo hold is partially intact.", choices: [ { label: "Salvage Cargo (+30 Scrap)", canAfford: () => true, execute: () => { scrap += 30; playSFX('heal'); return "Salvaged 30 Scrap from the wreckage."; } }, { label: "Gut the Engine (+1 Tech, +2 Parts, -15 HP to random unit)", canAfford: () => true, execute: () => { materials.tech += 1; materials.parts += 2; let active = playerRoster.filter(p => p.gridPos > 0 && p.hp > 0); let target = active[Math.floor(Math.random() * active.length)]; target.hp = Math.max(1, target.hp - 15); playSFX('hit'); triggerHitFlash(target.id); return `Extracted parts, but an electrical surge shocked ${target.name} for 15 DMG.`; } }, { label: "Leave it", canAfford: () => true, execute: () => { return "You move on safely without risking the sparks."; } } ] },
    { title: "THE CHEM OASIS", desc: "A glowing pool of bio-luminescent fluid sits in a blast crater. It smells like synthetic ozone and iron.", choices: [ { label: "Extract Fluid (+2 Chems)", canAfford: () => true, execute: () => { materials.chems += 2; playSFX('heal'); return "Carefully extracted 2 Chems from the pool."; } }, { label: "Bathe Wounds (Heal All Deployed for 25 HP)", canAfford: () => true, execute: () => { playerRoster.forEach(p => { if(p.gridPos > 0 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + 25); }); playSFX('heal'); return "The fluid burned, but the wounds sealed rapidly."; } } ] },
    { title: "WANDERING TINKER", desc: "A hooded cyborg sits by a campfire. They gesture toward a pile of tactical gear and hold out a mechanical hand.", choices: [ { label: "Trade Scrap for Bomb (Cost: 40 Scrap)", canAfford: () => scrap >= 40 && inventory.length < metaUpgrades.invMax, execute: () => { scrap -= 40; inventory.push('SCRAP_BOMB'); checkBountyProgress('CRAFT'); playSFX('click'); return "Acquired 1 Scrap Bomb."; } }, { label: "Trade Parts for Tech (Cost: 2 Parts)", canAfford: () => materials.parts >= 2, execute: () => { materials.parts -= 2; materials.tech += 1; playSFX('click'); return "Traded 2 Parts for 1 Tech."; } }, { label: "Decline", canAfford: () => true, execute: () => { return "You nod respectfully and continue walking."; } } ] },
    { title: "RADIATION STORM", desc: "The geiger counter screams. A violent wall of radioactive dust is rapidly approaching your position.", choices: [ { label: "Sprint Through (-10 HP to All Deployed)", canAfford: () => true, execute: () => { playerRoster.forEach(p => { if(p.gridPos > 0 && p.hp > 0) p.hp = Math.max(1, p.hp - 10); }); playSFX('hit'); triggerShake(); return "The squad powered through, but took heavy radiation burns."; } }, { label: "Deploy EMP Shield (-1 EMP Charge)", canAfford: () => inventory.includes('EMP_CHARGE'), execute: () => { inventory.splice(inventory.indexOf('EMP_CHARGE'), 1); playSFX('heal'); return "The EMP Charge detonated, creating a localized magnetic shield against the storm."; } } ] }
];

const ROSTER_TEMPLATE = [
    { id: 'p1', name: "Bruiser", classType: "BRUISER", maxHp: 80, hp: 80, speed: 8, armor: 0, isPlayer: true, dmgBase: 20, img: "hero_bruiser.webp", scale: 1.15, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 5, bio: 0, energy: 0 }, upgradeCount: 0, gridPos: 1, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, trait: null, augments: [], quirk: null, cooldowns: { heavy_wrench: 0, iron_guard: 0 } },
    { id: 'p2', name: "Medic", classType: "MEDIC", maxHp: 50, hp: 50, speed: 12, armor: 0, isPlayer: true, dmgBase: 10, img: "hero_medic.webp", scale: 1.6, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 0, bio: 10, energy: 0 }, upgradeCount: 0, gridPos: 2, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, trait: null, augments: [], quirk: null, cooldowns: { cauterize: 0 } },
    { id: 'p3', name: "Scavenger", classType: "SCAVENGER", maxHp: 45, hp: 45, speed: 15, armor: 0, isPlayer: true, dmgBase: 15, img: "hero_scavenger.webp", scale: 1.25, hpDrop: -25, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 0, bio: 0, energy: 5 }, upgradeCount: 0, gridPos: 3, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, trait: null, augments: [], quirk: null, cooldowns: { flashbang: 0 } },
    { id: 'p4', name: "Pyro", classType: "PYROMANIAC", maxHp: 55, hp: 55, speed: 11, armor: 0, isPlayer: true, dmgBase: 12, img: "hero_pyro.webp", scale: 1.1, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 0, bio: 0, energy: 10 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, trait: null, augments: [], quirk: null, cooldowns: { molotov: 0 } },
    { id: 'p5', name: "Breacher", classType: "SHOTGUNNER", maxHp: 65, hp: 65, speed: 9, armor: 5, isPlayer: true, dmgBase: 22, img: "hero_shotgunner.webp", scale: 1.15, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 5, bio: 0, energy: 0 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, trait: null, augments: [], quirk: null, cooldowns: { buckshot: 0 } },
    { id: 'p6', name: "Ghost", classType: "SNIPER", maxHp: 40, hp: 40, speed: 16, armor: 0, isPlayer: true, dmgBase: 28, img: "hero_sniper.webp", scale: 0.9, hpDrop: -10, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, trait: null, augments: [], quirk: null, cooldowns: { deadeye: 0 } },
    { id: 'p7', name: "War Hound", classType: "HOUND", maxHp: 35, hp: 35, speed: 19, armor: 0, isPlayer: true, dmgBase: 16, img: "hero_hound.webp", scale: 0.8, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: -2, bio: 10, energy: 0 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, trait: null, augments: [], quirk: null, cooldowns: { feral_bite: 0 } }
];

let playerRoster = []; let activeEntities = []; let turnQueue = []; let activeIndex = -1; let combatActive = false; let pendingAction = null;

window.addEventListener('click', initAudio, { once: true });

// Every interactive element carries data-action (plus any data-* it needs) and is routed
// through this table, so markup never has to reach for a global.
const ACTIONS = {
    'settings-open':    () => openSettings(),
    'settings-close':   () => closeSettings(),
    'toggle-speed':     () => toggleGameSpeed(),
    'toggle-sfx':       () => toggleSFX(),
    'erase-save':       () => eraseCurrentSave(),
    'return-title':     () => returnToTitle(),
    'title':            () => renderTitleScreen(),
    'citadel':          () => renderCitadel(),
    'map':              () => renderMap(),
    'outpost':          () => renderOutpost(),
    'new-game':         el => confirmNewGame(parseFloat(el.dataset.diff)),
    'slot':             el => selectSlot(Number(el.dataset.slot), el.dataset.exists === '1'),
    'buy-meta':         el => buyMetaUpgrade(el.dataset.kind),
    'advance-sector':   () => advanceSector(),

    'node-event':       () => initiateEvent(),
    'node-camp':        () => initiateCamp(),
    'node-combat':      el => initiateCombat(el.dataset.type, el.dataset.elite === '1'),

    'outpost-tab':      el => setOutpostTab(el.dataset.tab),
    'breakdown':        () => breakdownScrap(),
    'craft':            el => craftItem(el.dataset.item),
    'augment':          el => installAugment(el.dataset.id, el.dataset.kind),
    'sell-item':        el => useOutpostItem(Number(el.dataset.index)),
    'medbay':           el => medBay(el.dataset.id, el.dataset.mode),
    'buy-upg':          el => buyUpgrade(el.dataset.id, el.dataset.kind, Number(el.dataset.cost)),
    'assign-slot':      el => assignSlot(el.dataset.id, Number(el.dataset.slot)),
    'assign-perk':      el => assignPerk(el.dataset.id, el.dataset.perk),
    'pos-menu':         el => { activePosSelector = el.dataset.id; activePerkSelector = null; renderOutpost(); },
    'perk-menu':        el => { activePerkSelector = el.dataset.id; activePosSelector = null; renderOutpost(); },
    'selector-cancel':  () => { activePosSelector = null; activePerkSelector = null; renderOutpost(); },

    'event-choice':     el => resolveEvent(Number(el.dataset.index)),
    'event-finish':     () => finishEvent(),
    'camp-choice':      el => resolveCamp(el.dataset.kind),
    'camp-finish':      () => finishCamp(),

    'queue':            el => queueAction(el.dataset.move),
    'self':             el => executeSelfAction(el.dataset.move),
    'cancel':           () => cancelAction(),
    'skip-turn':        () => skipStunnedTurn(),
    'bag':              () => openInventoryMenu(),
    'target':           el => resolveAction(el.dataset.id),
    'use-item':         el => resolveConsumableItem(el.dataset.id),
    'loot':             el => collectLoot(Number(el.dataset.amount)),
    'end-run':          () => handleSquadWipe()
};

document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    playSFX('click');
    const handler = ACTIONS[el.dataset.action];
    if (handler) handler(el);
    else console.warn('Unmapped action:', el.dataset.action);
});

function initAudio() { if (!audioCtx && globalSettings.sfx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { console.log('Web Audio API not supported.'); } } }

function triggerShake() {
    let el = document.getElementById('combat-sky-layer');
    el.classList.remove('fx-shake');
    void el.offsetWidth;
    el.classList.add('fx-shake');
}

function triggerGlitch() {
    let el = document.getElementById('engine');
    el.classList.remove('fx-glitch');
    void el.offsetWidth;
    el.classList.add('fx-glitch');
}

function triggerHitFlash(id) {
    let el = document.getElementById(id);
    if(el) {
        let img = el.querySelector('.portrait');
        if(img) {
            img.classList.remove('fx-flash');
            void img.offsetWidth;
            img.classList.add('fx-flash');
        }
    }
}

function playSFX(type) {
    if (!globalSettings.sfx || !audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const t = audioCtx.currentTime; const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        if (type === 'click') { osc.type = 'square'; osc.frequency.setValueAtTime(880, t); gain.gain.setValueAtTime(0.03, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06); osc.start(t); osc.stop(t + 0.06); }
        else if (type === 'shoot') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(650, t); osc.frequency.exponentialRampToValueAtTime(120, t + 0.15); gain.gain.setValueAtTime(0.07, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15); osc.start(t); osc.stop(t + 0.15); }
        else if (type === 'hit') { osc.type = 'triangle'; osc.frequency.setValueAtTime(200, t); osc.frequency.exponentialRampToValueAtTime(55, t + 0.12); gain.gain.setValueAtTime(0.09, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12); osc.start(t); osc.stop(t + 0.12); }
        else if (type === 'heal') { osc.type = 'sine'; osc.frequency.setValueAtTime(440, t); osc.frequency.exponentialRampToValueAtTime(880, t + 0.18); gain.gain.setValueAtTime(0.05, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18); osc.start(t); osc.stop(t + 0.18); }
    } catch (e) {}
}

function spawnFCT(id, text, cls) {
    const host = document.getElementById(id); if (!host) return;
    const el = document.createElement('div'); el.className = `fct ${cls}`; el.innerText = text;
    host.appendChild(el); setTimeout(() => el.remove(), 1000);
}

function addMomentum(amt) {
    momentum = Math.max(0, Math.min(100, momentum + amt));
    const fill = document.getElementById('momentum-fill'); const txt = document.getElementById('momentum-txt');
    if (fill) fill.style.width = momentum + '%';
    if (txt) txt.innerText = momentum >= 100 ? 'MOMENTUM: FULL — OVERDRIVE READY' : `MOMENTUM: ${momentum}%`;
}

const BOUNTY_POOL = [
    { type: 'CRAFT', label: n => `CRAFT ${n} ITEMS`,        range: [2, 3], reward: 20 },
    { type: 'COMBO', label: n => `TRIGGER ${n} COMBOS`,     range: [3, 5], reward: 18 },
    { type: 'ELITE', label: n => `DEFEAT ${n} ELITE SQUAD${n > 1 ? 'S' : ''}`, range: [1, 2], reward: 75 },
    { type: 'KILL',  label: n => `DEFEAT ${n} HOSTILES`,    range: [6, 12], reward: 8 }
];

function rollBounty(exclude) {
    let choices = BOUNTY_POOL.filter(b => !exclude.includes(b.type));
    if (choices.length === 0) choices = BOUNTY_POOL;
    let pick = choices[Math.floor(Math.random() * choices.length)];
    let target = pick.range[0] + Math.floor(Math.random() * (pick.range[1] - pick.range[0] + 1));
    return { type: pick.type, desc: pick.label(target), current: 0, target, reward: pick.reward * target * currentSector, claimed: false };
}

function generateBounties() {
    let out = [];
    for (let i = 0; i < 3; i++) out.push(rollBounty(out.map(b => b.type)));
    return out;
}

function checkBountyProgress(type) {
    if (!activeBounties) return;
    activeBounties.forEach((b, idx) => {
        if (b.type !== type || b.claimed) return;
        b.current++;
        if (b.current < b.target) return;
        scrap += b.reward;
        if (combatActive) log(`> BOUNTY COMPLETE: ${b.desc} (+${b.reward} SCRAP)`, "log-combo");
        // Issue a fresh contract in its place so the board never runs dry. Every type currently
        // on the board is excluded - including this slot's - so a finished contract is never
        // handed straight back and the board rotates through the pool.
        activeBounties[idx] = rollBounty(activeBounties.map(o => o.type));
    });
}

function nextTurn() {
    if (!combatActive || turnQueue.length === 0) return;
    let guard = 0;
    do { activeIndex = (activeIndex + 1) % turnQueue.length; guard++; } while (turnQueue[activeIndex].hp <= 0 && guard <= turnQueue.length);
    if (turnQueue[activeIndex].hp <= 0) { checkWinState(); return; }
    processTurn();
}

function executeSelfAction(type) {
    let actEnt = turnQueue[activeIndex];
    if (type === 'IRON_GUARD') {
        actEnt.armor += 15; actEnt.armorTurns = 2; actEnt.cooldowns.iron_guard = 3;
        log(`> ${actEnt.name} braces behind scrap plating (+15 ARMOR).`, "log-status");
        spawnFCT(actEnt.id, "+ARMOR", "fct-heal"); playSFX('heal');
    }
    pendingAction = null; checkWinState();
}

const ITEM_DATA = {
    MED_STIM:   { label: '💉 Med-Stim',   action: 'ITEM_MED' },
    SCRAP_BOMB: { label: '💣 Scrap Bomb', action: 'ITEM_BOMB' },
    ADRENALINE: { label: '⚡ Adrenaline', action: 'ITEM_ADRENALINE' },
    EMP_CHARGE: { label: '🔋 EMP Charge', action: 'ITEM_EMP' }
};

function openInventoryMenu() {
    const d = document.getElementById('command-deck'); let h = '';
    inventory.forEach(it => { let m = ITEM_DATA[it]; if (m) h += `<button style="border-color:#B8860B; color:#B8860B;" data-action="queue" data-move="${m.action}">${m.label}</button>`; });
    h += `<button style="color:#8B0000; border-color:#8B0000" data-action="cancel">BACK</button>`;
    d.innerHTML = h;
}

function resolveConsumableItem(targetId) {
    let actEnt = turnQueue[activeIndex]; let target = activeEntities.find(e => e.id === targetId);
    const itemKey = { ITEM_MED: 'MED_STIM', ITEM_BOMB: 'SCRAP_BOMB', ITEM_ADRENALINE: 'ADRENALINE', ITEM_EMP: 'EMP_CHARGE' }[pendingAction];
    if (!itemKey || !target) { pendingAction = null; renderField(); return; }
    let idx = inventory.indexOf(itemKey); if (idx === -1) { pendingAction = null; renderField(); return; }
    inventory.splice(idx, 1);
    if (pendingAction === 'ITEM_MED') {
        let heal = 30; target.hp = Math.min(target.maxHp, target.hp + heal);
        log(`> ${actEnt.name} injects ${target.name} with a Med-Stim (+${heal} HP).`, "log-heal"); spawnFCT(target.id, `+${heal}`, "fct-heal"); playSFX('heal');
    } else if (pendingAction === 'ITEM_ADRENALINE') {
        target.stunnedTurns = 0; target.bleedingTurns = 0; target.hp = Math.min(target.maxHp, target.hp + 10);
        log(`> ${target.name} surges with Adrenaline (cleansed, +10 HP).`, "log-heal"); spawnFCT(target.id, "CLEANSED", "fct-status"); playSFX('heal');
    } else if (pendingAction === 'ITEM_BOMB') {
        triggerShake(); log(`> ${actEnt.name} hurls a Scrap Bomb!`, "log-dmg"); playSFX('shoot');
        applyDamageHit(actEnt, target, 35, 'phys', null);
    } else if (pendingAction === 'ITEM_EMP') {
        log(`> ${actEnt.name} detonates an EMP Charge!`, "log-dmg"); playSFX('shoot');
        applyDamageHit(actEnt, target, 25, 'energy', null);
        if (target.hp > 0) { target.stunnedTurns = 1; log(`> ${target.name} systems disrupted!`, "log-status"); setTimeout(() => spawnFCT(target.id, "STUNNED", "fct-status"), 300 * globalSettings.combatSpeed); }
    }
    pendingAction = null; checkWinState();
}

function handleSquadWipe() { endRun(); }

// Endless mode: losing the squad ends the run. Skulls and Citadel upgrades are permanent,
// so a lost run still moves the meta forward - only the expedition itself is gone.
function endRun() {
    combatActive = false; activeEntities = []; turnQueue = []; pendingCombat = null;
    momentum = 0; addMomentum(0);
    if (!runStats) runStats = newRunStats();
    noteDepth();
    const score = computeScore(runStats);
    const isBest = score > bestScore;
    if (isBest) bestScore = score;
    if (runStats.deepestSector > bestSector) bestSector = runStats.deepestSector;
    saveMeta();
    localStorage.removeItem(BASE_SAVE_KEY + currentSlot);
    renderRunOver(score, isBest);
}

function renderRunOver(score, isBest) {
    switchScreen('screen-runover');
    const st = runStats;
    document.getElementById('runover-score').innerText = `${score.toLocaleString()} PTS`;
    document.getElementById('runover-best').innerText = isBest ? '\u2605 NEW PERSONAL BEST \u2605' : `BEST: ${bestScore.toLocaleString()} PTS`;
    const lines = [
        ['DEPTH REACHED', `SECTOR ${st.deepestSector} \u00B7 TIER ${st.deepestTier}`],
        ['NODES CLEARED', st.nodes],
        ['HOSTILES KILLED', st.kills],
        ['ELITE SQUADS BROKEN', st.elites],
        ['WARLORDS FELLED', st.bosses],
        ['SCRAP SALVAGED', st.scrapEarned],
        ['SKULLS BANKED', `\uD83D\uDC80 ${bossSkulls}`]
    ];
    document.getElementById('runover-lines').innerHTML = lines.map(l => `<div class="runover-line"><span>${l[0]}</span><span>${l[1]}</span></div>`).join('');
    document.getElementById('runover-choices').innerHTML =
        `<button class="event-btn" style="border-color:#4488ff; color:#4488ff;" data-action="citadel">CITADEL (\uD83D\uDC80 ${bossSkulls})</button>` +
        `<button class="event-btn" data-action="title">RETURN TO TITLE</button>`;
}

function collectLoot(amount) { scrap += amount; if (runStats) { runStats.scrapEarned += amount; runStats.nodes++; } currentTier++; noteDepth(); momentum = 0; addMomentum(0); activeEntities = []; turnQueue = []; pendingCombat = null; saveGameState(); renderMap(); }

let bestScore = 0; let bestSector = 0;

function saveMeta() { localStorage.setItem(META_KEY, JSON.stringify({ bossSkulls, metaUpgrades, bestScore, bestSector })); }

function newRunStats() { return { kills: 0, elites: 0, bosses: 0, scrapEarned: 0, nodes: 0, deepestSector: 1, deepestTier: 1 }; }

// Endless scoring: depth is worth far more than any single haul, so pushing one sector
// deeper always beats farming the one you are on.
function computeScore(st) {
    if (!st) return 0;
    return (st.deepestSector - 1) * 2500
         + ((st.deepestSector - 1) * TOTAL_TIERS + (st.deepestTier - 1)) * 120
         + st.bosses * 900 + st.elites * 250 + st.kills * 15 + Math.floor(st.scrapEarned / 2);
}

function noteDepth() {
    if (!runStats) return;
    if (currentSector > runStats.deepestSector) { runStats.deepestSector = currentSector; runStats.deepestTier = currentTier; }
    else if (currentSector === runStats.deepestSector && currentTier > runStats.deepestTier) { runStats.deepestTier = currentTier; }
}

function loadMeta() {
    let m = localStorage.getItem(META_KEY);
    if (m) {
        let d = JSON.parse(m);
        bossSkulls = d.bossSkulls || 0;
        metaUpgrades = { ...metaUpgrades, ...(d.metaUpgrades || {}) };
        bestScore = d.bestScore || 0; bestSector = d.bestSector || 0;
        return;
    }
    // First run under the global-meta system: adopt the best progress any slot recorded.
    for (let i = 1; i <= 3; i++) {
        let raw = localStorage.getItem(BASE_SAVE_KEY + i); if (!raw) continue;
        let d = JSON.parse(raw); if (!d) continue;
        bossSkulls = Math.max(bossSkulls, d.bossSkulls || 0);
        if (d.metaUpgrades) {
            metaUpgrades.startScrap = Math.max(metaUpgrades.startScrap, d.metaUpgrades.startScrap || 0);
            metaUpgrades.startLevel = Math.max(metaUpgrades.startLevel, d.metaUpgrades.startLevel || 1);
            metaUpgrades.invMax = Math.max(metaUpgrades.invMax, d.metaUpgrades.invMax || 4);
        }
    }
    saveMeta();
}

function migrateOldSaves() {
    for(let i=1; i<=3; i++) {
        let oldSave = localStorage.getItem('wasteland_rpg_v37_slot_' + i);
        if (oldSave && !localStorage.getItem(BASE_SAVE_KEY + i)) { localStorage.setItem(BASE_SAVE_KEY + i, oldSave); }
    }
    let oldSettings = localStorage.getItem('wasteland_rpg_settings');
    if (oldSettings && !localStorage.getItem(SETTINGS_KEY)) { localStorage.setItem(SETTINGS_KEY, oldSettings); }
}

function initEngine() { 
    preloadAssets();
    migrateOldSaves();
    loadMeta();
    let s = localStorage.getItem(SETTINGS_KEY); 
    if (s) { globalSettings = { ...globalSettings, ...JSON.parse(s) }; } 
    updateSettingsUI(); 
    renderTitleScreen(); 
}

function switchScreen(screenId) { document.querySelectorAll('#engine > div:not(.settings-icon):not(#screen-settings)').forEach(el => el.style.display = 'none'); document.getElementById(screenId).style.display = 'flex'; if (screenId === 'screen-map' || screenId === 'screen-outpost' || screenId === 'screen-citadel') { document.getElementById('btn-global-settings').style.display = 'block'; } else { document.getElementById('btn-global-settings').style.display = 'none'; } }
function openSettings() { document.querySelectorAll('#engine > div:not(.settings-icon)').forEach(el => { if (el.style.display === 'flex' && el.id !== 'screen-settings') previousScreen = el.id; }); document.getElementById('screen-settings').style.display = 'flex'; }
function closeSettings() { document.getElementById('screen-settings').style.display = 'none'; }
function toggleGameSpeed() { globalSettings.combatSpeed = globalSettings.combatSpeed === 1.0 ? 0.5 : 1.0; localStorage.setItem(SETTINGS_KEY, JSON.stringify(globalSettings)); updateSettingsUI(); }
function toggleSFX() { globalSettings.sfx = !globalSettings.sfx; if (globalSettings.sfx) initAudio(); localStorage.setItem(SETTINGS_KEY, JSON.stringify(globalSettings)); updateSettingsUI(); }
function updateSettingsUI() { document.getElementById('btn-toggle-speed').innerText = globalSettings.combatSpeed === 1.0 ? "COMBAT SPEED: NORMAL" : "COMBAT SPEED: FAST"; document.getElementById('btn-toggle-sfx').innerText = globalSettings.sfx ? "AUDIO SFX: ON" : "AUDIO SFX: OFF"; }
function returnToTitle() { closeSettings(); renderTitleScreen(); }
function eraseCurrentSave() { if(confirm("Are you sure you want to permanently delete this save slot?")) { localStorage.removeItem(BASE_SAVE_KEY + currentSlot); closeSettings(); renderTitleScreen(); } }

function renderTitleScreen() {
    switchScreen('screen-title'); let menuHTML = '';
    if (bestScore > 0) menuHTML += `<div style="text-align:center; font-size:11px; letter-spacing:2px; color:#B8860B; margin-bottom:6px;">BEST RUN: ${bestScore.toLocaleString()} PTS \u00B7 SECTOR ${bestSector}</div>`;
    for(let i=1; i<=3; i++) {
        let d = JSON.parse(localStorage.getItem(BASE_SAVE_KEY + i));
        if (d) { menuHTML += `<button class="title-btn btn-continue" data-action="slot" data-slot="${i}" data-exists="1">SLOT ${i} [S${d.currentSector||1}-T${d.tier}]${d.combat ? ' ⚔' : ''}</button>`; } 
        else { menuHTML += `<button class="title-btn" data-action="slot" data-slot="${i}" data-exists="0">SLOT ${i} [ EMPTY ]</button>`; }
    }
    menuHTML += `<button class="title-btn btn-meta" style="margin-top:12px;" data-action="citadel">CITADEL (💀 ${bossSkulls})</button>`;
    document.getElementById('title-menu-container').innerHTML = menuHTML;
    document.getElementById('title-menu-container').style.display = 'flex';
    document.getElementById('difficulty-menu-container').style.display = 'none';
}

function selectSlot(slotNum, exists) { currentSlot = slotNum; if (exists) { continueGame(); } else { document.getElementById('title-menu-container').style.display = 'none'; document.getElementById('difficulty-menu-container').style.display = 'flex'; } }

function confirmNewGame(diff) {
    difficultyMult = diff; currentSector = 1; currentTier = 1; tuneUpBattles = 0; momentum = 0;
    scrap = metaUpgrades.startScrap || 0; inventory = ['MED_STIM']; materials = { parts: 0, chems: 0, tech: 0 }; 
    playerRoster = JSON.parse(JSON.stringify(ROSTER_TEMPLATE)); 
    activeBounties = generateBounties(); activeRelics = []; runStats = newRunStats();
    
    playerRoster.forEach(p => { 
        let q = QUIRK_POOL[Math.floor(Math.random() * QUIRK_POOL.length)];
        p.quirk = q; p.maxHp += q.hp; p.hp = p.maxHp; p.dmgBase += q.dmg; p.speed += q.spd;
        p.level = metaUpgrades.startLevel; p.perkPoints = metaUpgrades.startLevel - 1; p.xpToNext = Math.floor(100 * Math.pow(1.5, metaUpgrades.startLevel - 1)); 
    });

    saveGameState(); renderMap(); 
}

function continueGame() { loadGameState(); addMomentum(0); if (pendingCombat) resumeCombat(pendingCombat); else renderMap(); }

// Rebuilds a fight from its snapshot. Player entries are looked up in playerRoster by id so
// damage keeps landing on the live roster objects rather than on detached copies.
function resumeCombat(c) {
    currentNodeType = c.nodeType; isCurrentNodeElite = c.isElite; currentWeather = c.weather || 'CLEAR';
    let players = (c.playerIds || []).map(id => playerRoster.find(p => p.id === id)).filter(Boolean);
    activeEntities = [...players, ...(c.enemies || [])];
    turnQueue = (c.queueIds || []).map(id => activeEntities.find(e => e.id === id)).filter(Boolean);
    pendingCombat = null;
    if (turnQueue.length === 0) { renderMap(); return; }
    activeIndex = Math.min(c.activeIndex || 0, turnQueue.length - 1);
    combatActive = true;
    switchScreen('screen-combat'); document.getElementById('log').innerHTML = '';
    applyCombatScenery(c.bgFile || 'bg_combat.webp');
    log("> COMBAT RESUMED.", "log-turn");
    processTurn();
}
function buildCombatSnapshot() {
    if (!combatActive || turnQueue.length === 0) return null;
    return {
        nodeType: currentNodeType, isElite: isCurrentNodeElite, weather: currentWeather, bgFile: combatBgFile,
        activeIndex,
        playerIds: activeEntities.filter(e => e.isPlayer).map(e => e.id),
        enemies: activeEntities.filter(e => !e.isPlayer),
        queueIds: turnQueue.map(e => e.id)
    };
}

function saveGameState() { localStorage.setItem(BASE_SAVE_KEY + currentSlot, JSON.stringify({ scrap, tier: currentTier, currentSector, difficultyMult, roster: playerRoster, inventory, materials, tuneUpBattles, activeBounties, momentum, activeRelics, runStats, combat: buildCombatSnapshot() })); }
function loadGameState() { let d = JSON.parse(localStorage.getItem(BASE_SAVE_KEY + currentSlot)); if (d) { scrap = d.scrap || 0; currentTier = d.tier || 1; currentSector = d.currentSector || 1; difficultyMult = d.difficultyMult || 1.0; playerRoster = d.roster || JSON.parse(JSON.stringify(ROSTER_TEMPLATE)); inventory = d.inventory || ['MED_STIM']; materials = d.materials || { parts: 0, chems: 0, tech: 0 }; tuneUpBattles = d.tuneUpBattles || 0; activeBounties = d.activeBounties || generateBounties(); momentum = d.momentum || 0; activeRelics = d.activeRelics || []; pendingCombat = d.combat || null; runStats = d.runStats || newRunStats(); } }

function renderCitadel() { switchScreen('screen-citadel'); document.getElementById('citadel-skulls').innerText = `${bossSkulls} 💀`; document.getElementById('meta-lbl-scrap').innerText = `LVL ${metaUpgrades.startScrap / 50}`; document.getElementById('meta-lbl-level').innerText = `LVL ${metaUpgrades.startLevel - 1}`; document.getElementById('meta-lbl-inv').innerText = `LVL ${metaUpgrades.invMax - 4}`; }
function buyMetaUpgrade(type) { if (type === 'SCRAP' && bossSkulls >= 1) { bossSkulls -= 1; metaUpgrades.startScrap += 50; } else if (type === 'LEVEL' && bossSkulls >= 2) { bossSkulls -= 2; metaUpgrades.startLevel += 1; } else if (type === 'INV' && bossSkulls >= 3) { bossSkulls -= 3; metaUpgrades.invMax += 1; } saveMeta(); renderCitadel(); }

function renderMap() {
    switchScreen('screen-map'); 
    document.getElementById('scrap-display').innerText = scrap; 
    document.getElementById('map-sector-lbl').innerText = `SECTOR ${currentSector}`;
    noteDepth();
    document.getElementById('map-score-lbl').innerText = `${computeScore(runStats).toLocaleString()} PTS`;
    
    let bHtml = '';
    if(!activeBounties || activeBounties.length === 0) activeBounties = generateBounties();
    activeBounties.forEach(b => { let cls = b.claimed ? 'bounty-complete' : ''; bHtml += `<div class="bounty-item ${cls}"><span>${b.desc}</span><span>[${b.current}/${b.target}]</span></div>`; });
    document.getElementById('bounty-list').innerHTML = bHtml;

    let rHtml = '';
    if (activeRelics.length === 0) { rHtml = `<div class="bounty-item"><span>No Relics Acquired</span></div>`; }
    else { activeRelics.forEach(r => { rHtml += `<div class="relic-item" title="${r.desc}">♦ ${r.name}</div>`; }); }
    document.getElementById('relic-list').innerHTML = rHtml;

    const mapC = document.getElementById('map-nodes');
    if (currentTier > TOTAL_TIERS) { 
        mapC.innerHTML = `<h3 style="color:#8B0000; text-align:center;">SECTOR ${currentSector} SECURED</h3><button class="return-btn" style="border-color:#6B8E23; color:#6B8E23; margin-bottom:15px;" data-action="advance-sector">ENTER SECTOR ${currentSector + 1}</button><button class="return-btn" data-action="citadel">RETURN TO CITADEL</button>`; 
        return; 
    }
    
    let m = `<div class="map-track">`;
    for (let i = 0; i < TOTAL_TIERS; i++) {
        let t = TOTAL_TIERS - i; let rowStatus = (t === currentTier) ? 'active' : (t < currentTier) ? 'cleared' : 'locked'; let dis = (t !== currentTier) ? 'disabled' : '';
        m += `<div class="map-row">`;
        SECTOR_LAYOUT[i].forEach(n => {
            let icon = '🎯'; let lbl = 'RAIDERS';
            if (n.type === 'BOSS') { icon = '💀'; lbl = 'WARLORD'; } else if (n.type === 'BEASTS') { icon = '☣️'; lbl = 'BEASTS'; } else if (n.type === 'MECH') { icon = '⚙️'; lbl = 'MECH'; } else if (n.type === 'EVENT') { icon = '❓'; lbl = 'UNKNOWN'; } else if (n.type === 'CAMP') { icon = '⛺'; lbl = 'CAMP'; }
            let eCls = n.elite ? 'elite-node' : (n.type === 'EVENT' ? 'event-node' : n.type === 'CAMP' ? 'camp-node' : ''); let eLbl = n.elite ? ' (ELITE)' : '';
            let nodeAction = n.type === 'EVENT' ? `data-action="node-event"` : n.type === 'CAMP' ? `data-action="node-camp"` : `data-action="node-combat" data-type="${n.type}" data-elite="${n.elite ? 1 : 0}"`;
            m += `<button class="map-node node-${rowStatus} ${eCls} ${(n.type === 'BOSS' && t === currentTier) ? 'boss-node' : ''}" ${dis} ${nodeAction}><span class="node-icon">${icon}</span><span class="node-lbl">${lbl}${eLbl}</span></button>`;
        });
        m += `</div>`; if (t > 1) m += `<div class="map-connector ${(t <= currentTier) ? 'connector-cleared' : ''}"></div>`;
    }
    m += `</div>`; mapC.innerHTML = m; setTimeout(() => { mapC.scrollTop = mapC.scrollHeight; }, 10);
}

function advanceSector() { currentSector++; currentTier = 1; noteDepth(); saveGameState(); renderMap(); }

function setOutpostTab(tab) { outpostTab = tab; document.getElementById('tab-roster').className = `op-tab-btn ${tab === 'ROSTER' ? 'op-tab-active' : ''}`; document.getElementById('tab-workbench').className = `op-tab-btn ${tab === 'WORKBENCH' ? 'op-tab-active' : ''}`; document.getElementById('tab-cyber').className = `op-tab-btn ${tab === 'CYBER' ? 'op-tab-active' : ''}`; document.getElementById('outpost-roster-view').style.display = tab === 'ROSTER' ? 'flex' : 'none'; document.getElementById('outpost-workbench-view').style.display = tab === 'WORKBENCH' ? 'flex' : 'none'; document.getElementById('outpost-cyber-view').style.display = tab === 'CYBER' ? 'flex' : 'none'; renderOutpost(); }

function renderOutpost() {
    switchScreen('screen-outpost'); document.getElementById('outpost-scrap').innerText = scrap; 
    const c = document.getElementById('outpost-roster'); c.innerHTML = '';
    playerRoster.forEach(char => {
        let cost = 30 + (char.upgradeCount * 25); let canUpg = scrap >= cost; let isDead = char.hp <= 0; let isInj = char.hp < char.maxHp && char.hp > 0;
        let medHtml = isDead ? `<button class="upg-btn revive-btn" ${scrap < 50 ? 'disabled' : ''} data-action="medbay" data-id="${char.id}" data-mode="REVIVE">DEFIB (50)</button>` : `<button class="upg-btn med-btn" ${!isInj || scrap < 10 ? 'disabled' : ''} data-action="medbay" data-id="${char.id}" data-mode="HEAL">TRIAGE (10)</button>`;
        
        let perkStatus = char.perkPoints > 0 ? `<button class="upg-btn perk-btn" style="padding:2px 5px;" data-action="perk-menu" data-id="${char.id}">CHOOSE PERK (!)</button>` : `LVL ${char.level} (${char.xp}/${char.xpToNext} XP)`;
        let traitDisplay = char.trait ? `TRAIT: ${char.trait}` : perkStatus;
        let quirkDisplay = char.quirk ? `<div style="font-size:9px; color:#ffaa00; text-transform:uppercase; margin-top:2px;">[ ${char.quirk.name} ]</div>` : '';

        let posText = char.gridPos === 1 ? '[1] FRONTLINE' : char.gridPos === 2 ? '[2] MIDLINE' : char.gridPos === 3 ? '[3] BACKLINE' : '[X] BENCHED'; let posClass = `pos-btn-${char.gridPos}`; let btnGroupHtml = '';

        if (activePosSelector === char.id) { btnGroupHtml = `<button class="upg-btn sub-menu-btn pos-btn-1" data-action="assign-slot" data-id="${char.id}" data-slot="1">[1] FRONT</button> <button class="upg-btn sub-menu-btn pos-btn-2" data-action="assign-slot" data-id="${char.id}" data-slot="2">[2] MID</button> <button class="upg-btn sub-menu-btn pos-btn-3" data-action="assign-slot" data-id="${char.id}" data-slot="3">[3] BACK</button> <button class="upg-btn sub-menu-btn pos-btn-0" data-action="assign-slot" data-id="${char.id}" data-slot="0">[X] BENCH</button> <button class="upg-btn sub-menu-btn" style="border-color:#888;" data-action="selector-cancel">CANCEL</button>`; } 
        else if (activePerkSelector === char.id) { btnGroupHtml = `<button class="upg-btn sub-menu-btn perk-btn" data-action="assign-perk" data-id="${char.id}" data-perk="VETERAN">VETERAN (+5 DMG)</button> <button class="upg-btn sub-menu-btn perk-btn" data-action="assign-perk" data-id="${char.id}" data-perk="FORTIFIED">FORTIFIED (+25 HP)</button> <button class="upg-btn sub-menu-btn" style="border-color:#888;" data-action="selector-cancel">CANCEL</button>`; } 
        else { btnGroupHtml = `<button class="upg-btn ${posClass}" data-action="pos-menu" data-id="${char.id}">${posText}</button> <button class="upg-btn" ${!canUpg || isDead ? 'disabled' : ''} data-action="buy-upg" data-id="${char.id}" data-kind="HP" data-cost="${cost}">+10 HP</button> <button class="upg-btn" ${!canUpg || isDead ? 'disabled' : ''} data-action="buy-upg" data-id="${char.id}" data-kind="DMG" data-cost="${cost}">+3 DMG</button> ${medHtml}`; }

        c.innerHTML += `<div class="upgrade-card" style="${isDead ? 'border-color: #8B0000; opacity: 0.8;' : ''}"> <div class="upgrade-header" style="flex-direction:column; align-items:flex-start;"> <div style="display:flex; justify-content:space-between; width:100%;"><span>${char.name} (${char.classType})</span><span>${traitDisplay}</span></div> ${quirkDisplay} </div> <div class="upgrade-stats"><span>HP: ${char.hp}/${char.maxHp}</span><span>DMG: ${char.dmgBase}</span><span>UPG: <span class="cost-txt">${cost}</span></span></div> <div class="upgrade-btn-group">${btnGroupHtml}</div> </div>`;
    });

    document.getElementById('mat-parts-wb').innerText = `⚙️ PARTS: ${materials.parts}`; document.getElementById('mat-chems-wb').innerText = `🧪 CHEMS: ${materials.chems}`; document.getElementById('mat-tech-wb').innerText = `💻 TECH: ${materials.tech}`; document.getElementById('btn-breakdown').disabled = scrap < 25;
    let wbHtml = ''; let invFull = inventory.length >= metaUpgrades.invMax;
    wbHtml += `<button class="upg-btn" ${materials.chems < 2 || invFull ? 'disabled' : ''} data-action="craft" data-item="MED_STIM">CRAFT MED-STIM (2 🧪)</button>`; wbHtml += `<button class="upg-btn" ${materials.parts < 2 || invFull ? 'disabled' : ''} data-action="craft" data-item="SCRAP_BOMB">CRAFT SCRAP BOMB (2 ⚙️)</button>`; wbHtml += `<button class="upg-btn" ${materials.chems < 1 || materials.tech < 1 || invFull ? 'disabled' : ''} data-action="craft" data-item="ADRENALINE">CRAFT ADRENALINE (1 🧪, 1 💻)</button>`; wbHtml += `<button class="upg-btn" ${materials.tech < 2 || invFull ? 'disabled' : ''} data-action="craft" data-item="EMP_CHARGE">CRAFT EMP CHARGE (2 💻)</button>`;
    document.getElementById('crafting-grid').innerHTML = wbHtml;

    document.getElementById('mat-parts-cb').innerText = `⚙️ PARTS: ${materials.parts}`; document.getElementById('mat-chems-cb').innerText = `🧪 CHEMS: ${materials.chems}`; document.getElementById('mat-tech-cb').innerText = `💻 TECH: ${materials.tech}`;
    const cybC = document.getElementById('cybernetics-roster'); cybC.innerHTML = '';
    playerRoster.forEach(char => {
        let augList = char.augments && char.augments.length > 0 ? char.augments.join(', ') : 'NONE'; let canPlating = materials.parts >= 3; let canOptics = materials.tech >= 2; let canPump = materials.chems >= 2;
        cybC.innerHTML += `<div class="upgrade-card"> <div class="upgrade-header"><span>${char.name}</span><span style="color:#4488ff; font-size:10px;">AUGS: ${augList}</span></div> <div class="upgrade-stats"><span>MAX HP: ${char.maxHp}</span><span>BASE DMG: ${char.dmgBase}</span><span>SPEED: ${char.speed}</span></div> <div class="upgrade-btn-group"> <button class="upg-btn" style="border-color:#4488ff;" ${!canPlating ? 'disabled' : ''} data-action="augment" data-id="${char.id}" data-kind="PLATING">SUB-DERMAL PLATING (+20 HP) [3 ⚙️]</button> <button class="upg-btn" style="border-color:#4488ff;" ${!canOptics ? 'disabled' : ''} data-action="augment" data-id="${char.id}" data-kind="OPTICS">OPTICS (+4 DMG) [2 💻]</button> <button class="upg-btn" style="border-color:#4488ff;" ${!canPump ? 'disabled' : ''} data-action="augment" data-id="${char.id}" data-kind="PUMP">ADRENAL PUMP (+3 SPD) [2 🧪]</button> </div> </div>`;
    });

    document.getElementById('inv-count').innerText = `${inventory.length}/${metaUpgrades.invMax}`; const invC = document.getElementById('outpost-inventory'); invC.innerHTML = '';
    for (let i = 0; i < metaUpgrades.invMax; i++) { let item = inventory[i]; if (item) { let label = item === 'MED_STIM' ? '💉 Med-Stim' : item === 'SCRAP_BOMB' ? '💣 Scrap Bomb' : item === 'ADRENALINE' ? '⚡ Adrenaline' : '🔋 EMP Charge'; invC.innerHTML += `<button class="inv-slot" data-action="sell-item" data-index="${i}">${label} [SELL]</button>`; } else { invC.innerHTML += `<button class="inv-slot" disabled>[ EMPTY SLOT ]</button>`; } }
}

function breakdownScrap() { if (scrap < 25) return; scrap -= 25; let m = ['parts', 'chems', 'tech'][Math.floor(Math.random() * 3)]; materials[m]++; saveGameState(); renderOutpost(); }
function craftItem(item) { 
    if (inventory.length >= metaUpgrades.invMax) return; 
    if (item === 'MED_STIM' && materials.chems >= 2) { materials.chems -= 2; inventory.push(item); checkBountyProgress('CRAFT'); } 
    else if (item === 'SCRAP_BOMB' && materials.parts >= 2) { materials.parts -= 2; inventory.push(item); checkBountyProgress('CRAFT'); } 
    else if (item === 'ADRENALINE' && materials.chems >= 1 && materials.tech >= 1) { materials.chems -= 1; materials.tech -= 1; inventory.push(item); checkBountyProgress('CRAFT'); } 
    else if (item === 'EMP_CHARGE' && materials.tech >= 2) { materials.tech -= 2; inventory.push(item); checkBountyProgress('CRAFT'); } 
    saveGameState(); renderOutpost(); 
}
function installAugment(charId, type) { let char = playerRoster.find(c => c.id === charId); if (!char.augments) char.augments = []; if (type === 'PLATING' && materials.parts >= 3) { materials.parts -= 3; char.maxHp += 20; char.hp += 20; char.augments.push('Plating'); } else if (type === 'OPTICS' && materials.tech >= 2) { materials.tech -= 2; char.dmgBase += 4; char.augments.push('Optics'); } else if (type === 'PUMP' && materials.chems >= 2) { materials.chems -= 2; char.speed += 3; char.augments.push('Pump'); } saveGameState(); renderOutpost(); }
function assignSlot(charId, newSlot) { let char = playerRoster.find(c => c.id === charId); let oldSlot = char.gridPos; if (newSlot > 0) { let existingChar = playerRoster.find(c => c.gridPos === newSlot && c.id !== charId); if (existingChar) existingChar.gridPos = oldSlot; } char.gridPos = newSlot; activePosSelector = null; saveGameState(); renderOutpost(); }
function assignPerk(charId, traitName) { let char = playerRoster.find(c => c.id === charId); if (traitName === 'VETERAN') { char.trait = 'VETERAN'; char.dmgBase += 5; } else if (traitName === 'FORTIFIED') { char.trait = 'FORTIFIED'; char.maxHp += 25; char.hp += 25; } char.perkPoints--; activePerkSelector = null; saveGameState(); renderOutpost(); }
function useOutpostItem(index) { inventory.splice(index, 1); scrap += 20; saveGameState(); renderOutpost(); }
function buyUpgrade(charId, type, cost) { if (scrap < cost) return; scrap -= cost; let c = playerRoster.find(c => c.id === charId); if (c.hp <= 0) return; if (type === 'HP') { c.maxHp += 10; c.hp += 10; } else if (type === 'DMG') { c.dmgBase += 3; } c.upgradeCount++; saveGameState(); renderOutpost(); }
function medBay(charId, action) { 
    let c = playerRoster.find(c => c.id === charId); 
    if (action === 'HEAL' && scrap >= 10 && c.hp > 0 && c.hp < c.maxHp) { scrap -= 10; c.hp = Math.min(c.maxHp, c.hp + Math.floor(c.maxHp * 0.4)); playSFX('heal'); } 
    else if (action === 'REVIVE' && scrap >= 50 && c.hp <= 0) { scrap -= 50; c.hp = Math.floor(c.maxHp * 0.25); playSFX('heal'); } 
    saveGameState(); renderOutpost(); 
}

function initiateEvent() {
    switchScreen('screen-event'); activeEvent = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
    document.getElementById('event-title').innerText = activeEvent.title; document.getElementById('event-desc').innerText = activeEvent.desc;
    let cHtml = ''; activeEvent.choices.forEach((c, idx) => { let canAfford = c.canAfford(); cHtml += `<button class="event-btn" ${!canAfford ? 'disabled' : ''} data-action="event-choice" data-index="${idx}">${c.label}</button>`; });
    document.getElementById('event-choices').innerHTML = cHtml;
}

function resolveEvent(idx) {
    let resultText = activeEvent.choices[idx].execute();
    document.getElementById('event-choices').innerHTML = `<div style="color:#6B8E23; font-weight:bold; margin-bottom:15px;">> ${resultText}</div><button class="event-btn" style="border-color:#4488ff; color:#4488ff;" data-action="event-finish">CONTINUE EXPEDITION</button>`;
}
function finishEvent() { currentTier++; if (runStats) runStats.nodes++; noteDepth(); saveGameState(); renderMap(); }

function initiateCamp() {
    switchScreen('screen-camp');
    let cHtml = '';
    cHtml += `<button class="event-btn" data-action="camp-choice" data-kind="TRIAGE">TRIAGE (Heal 35% HP to Deployed Squad)</button>`;
    cHtml += `<button class="event-btn" data-action="camp-choice" data-kind="TUNEUP">WEAPON TUNE-UP (+4 DMG for next 3 Battles)</button>`;
    cHtml += `<button class="event-btn" data-action="camp-choice" data-kind="FORAGE">FORAGE (+1 Parts, +1 Chems, +1 Tech)</button>`;
    document.getElementById('camp-choices').innerHTML = cHtml;
}

function resolveCamp(type) {
    if (type === 'TRIAGE') {
        playerRoster.forEach(p => { if(p.gridPos > 0 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.35)); });
        playSFX('heal'); document.getElementById('camp-choices').innerHTML = `<div style="color:#6B8E23; font-weight:bold; margin-bottom:15px;">> Squad patched up and ready.</div><button class="event-btn" data-action="camp-finish">CONTINUE EXPEDITION</button>`;
    } else if (type === 'TUNEUP') {
        tuneUpBattles = 3; playSFX('click');
        document.getElementById('camp-choices').innerHTML = `<div style="color:#B8860B; font-weight:bold; margin-bottom:15px;">> Weapons cleaned and calibrated. (+4 Base DMG active)</div><button class="event-btn" data-action="camp-finish">CONTINUE EXPEDITION</button>`;
    } else if (type === 'FORAGE') {
        materials.parts++; materials.chems++; materials.tech++; playSFX('click');
        document.getElementById('camp-choices').innerHTML = `<div style="color:#4488ff; font-weight:bold; margin-bottom:15px;">> Salvaged valuable materials from the perimeter.</div><button class="event-btn" data-action="camp-finish">CONTINUE EXPEDITION</button>`;
    }
}
function finishCamp() { currentTier++; if (runStats) runStats.nodes++; noteDepth(); saveGameState(); renderMap(); }

function rollIntent(enemy) {
    let rand = Math.random();
    if (enemy.classType === 'BOSS') {
        if (rand < 0.2) return { type: 'AOE', icon: '🧨' };
        if (rand < 0.4) return { type: 'HEAVY', icon: '💥' };
        if (rand < 0.6) return { type: 'STATUS', icon: '☣️' };
        if (rand < 0.7) return { type: 'DEFEND', icon: '🛡️' };
        return { type: 'ATTACK', icon: '⚔️' };
    } else if (enemy.classType === 'MECH') {
        if (rand < 0.2) return { type: 'DEFEND', icon: '🛡️' };
        if (rand < 0.4) return { type: 'AOE', icon: '🧨' };
        return { type: 'ATTACK', icon: '🔫' };
    } else if (enemy.range === 'ranged') {
        if (rand < 0.2) return { type: 'STATUS', icon: '🎯' };
        if (rand < 0.3) return { type: 'AOE', icon: '🧨' };
        return { type: 'ATTACK', icon: '🔫' };
    } else {
        if (rand < 0.2) return { type: 'HEAVY', icon: '💥' };
        if (rand < 0.3) return { type: 'DEFEND', icon: '🛡️' };
        return { type: 'ATTACK', icon: '⚔️' };
    }
}

// Enemy stats climb 1.5x per sector; rewards climb alongside so player power can compound
// too, and the run ends on a build/skill wall rather than an arithmetic one.
function sectorRewardMult() { return Math.pow(1.4, currentSector - 1); }

function generateEnemies(nodeType, mult, isEliteNode) {
    const pool = {
        'BEASTS': [
            { name: "Attack Dog", minTier: 1, isHeavy: false, classType: "BEAST", range: 'melee', maxHp: 30, speed: 18, armor: 0, dmgBase: 10, img: "enemy_dog.webp", scale: 0.8, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: -2, bio: 0, energy: 0 } }, 
            { name: "Mutant", minTier: 5, isHeavy: true, classType: "MUTANT", range: 'melee', maxHp: 70, speed: 7, armor: 0, dmgBase: 25, img: "enemy_mutant.webp", scale: 1.5, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 0, bio: 20, energy: -5 } }, 
            { name: "Chem Fiend", minTier: 6, isHeavy: true, classType: "MUTANT", range: 'ranged', maxHp: 60, speed: 11, armor: 0, dmgBase: 15, img: "enemy_chem.webp", scale: 1.0, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 0, bio: 50, energy: -5 } }
        ],
        'RAIDERS': [
            { name: "Raider", minTier: 1, isHeavy: false, classType: "RAIDER", range: 'melee', maxHp: 40, speed: 10, armor: 0, dmgBase: 12, img: "enemy_raider.webp", scale: 1.0, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: -2, bio: 2, energy: 0 } }, 
            { name: "Psycho", minTier: 4, isHeavy: false, classType: "RAIDER", range: 'melee', maxHp: 45, speed: 14, armor: 0, dmgBase: 18, img: "enemy_psycho.webp", scale: 1.0, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 } }, 
            { name: "Sniper", minTier: 5, isHeavy: false, classType: "RAIDER", range: 'ranged', maxHp: 35, speed: 16, armor: 0, dmgBase: 25, img: "enemy_sniper.webp", scale: 1.0, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 } }, 
            { name: "Juggernaut", minTier: 7, isHeavy: true, classType: "RAIDER", range: 'melee', maxHp: 90, speed: 6, armor: 5, dmgBase: 18, img: "enemy_juggernaut.webp", scale: 1.8, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 10, bio: 0, energy: -5 } }
        ],
        'MECH': [
            { name: "Drone", minTier: 4, isHeavy: false, classType: "DRONE", range: 'ranged', isHovering: true, maxHp: 25, speed: 18, armor: 5, dmgBase: 8, img: "enemy_drone.webp", scale: 0.7, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 8, bio: 100, energy: -10 } }, 
            { name: "Turret", minTier: 5, isHeavy: false, classType: "MECH", range: 'ranged', maxHp: 50, speed: 2, armor: 8, dmgBase: 18, img: "enemy_turret.webp", scale: 0.9, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 10, bio: 100, energy: -10 } }, 
            { name: "War Rig", minTier: 8, isHeavy: true, classType: "MECH", range: 'ranged', maxHp: 150, speed: 5, armor: 10, dmgBase: 25, img: "enemy_warrig.webp", scale: 1.8, hpDrop: -20, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 15, bio: 100, energy: -15 } }
        ]
    };

    let bossBaseHp = currentSector === 1 ? 100 : 400;
    let bossBaseDmg = currentSector === 1 ? 30 : 40;
    
    if (nodeType === 'BOSS') return [{ id: 'b1', name: "Warlord", classType: "BOSS", range: 'melee', maxHp: Math.floor(bossBaseHp*mult), hp: Math.floor(bossBaseHp*mult), speed: 9, armor: 15, isPlayer: false, dmgBase: Math.floor(bossBaseDmg*mult), img: "enemy_boss.webp", scale: 2.2, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, resistances: { phys: 10, bio: 5, energy: 5 }, phase: 1, intent: {type:'ATTACK', icon:'⚔️'} }];
    
    // Later sectors unlock tougher stock progressively rather than all at once: the old gate
    // was bypassed outright from sector 2, which dropped tier-8 units into tier-1 fights.
    const effTier = currentTier + (currentSector - 1) * SECTOR_TIER_BONUS;

    function poolFor(type) {
        let valid = pool[type].filter(e => effTier >= e.minTier);
        if (valid.length === 0) {
            // Nothing has unlocked yet - fall back to the cheapest stock, never the whole pool.
            let minT = Math.min(...pool[type].map(e => e.minTier));
            valid = pool[type].filter(e => e.minTier === minT);
        }
        let weighted = [];
        valid.forEach(e => { let weight = (e.isHeavy && effTier < 6) ? 1 : 5; for (let j = 0; j < weight; j++) weighted.push(e); });
        return weighted;
    }

    const homePool = poolFor(nodeType);
    const otherTypes = Object.keys(pool).filter(t => t !== nodeType);

    let sZ = effTier >= 8 ? (Math.random() < 0.45 ? 4 : 3)
           : effTier >= 4 ? (Math.random() < 0.5 ? 3 : 2)
           : 2;
    let squad = [];
    for (let i = 0; i < sZ; i++) {
        // Above mid-game, squads can pick up an attached specialist from another faction.
        let usePool = homePool;
        if (effTier >= 6 && i > 0 && Math.random() < 0.25) usePool = poolFor(otherTypes[Math.floor(Math.random() * otherTypes.length)]);
        let t = JSON.parse(JSON.stringify(usePool[Math.floor(Math.random() * usePool.length)])); 
        let hp = Math.floor(t.maxHp * mult); t.hp = hp; t.maxHp = hp; t.dmgBase = Math.floor(t.dmgBase * mult);
        
        if (isEliteNode && Math.random() < 0.6) {
            let affixes = ['FRENZIED', 'ARMORED', 'VAMPIRIC'];
            t.eliteType = affixes[Math.floor(Math.random() * affixes.length)]; t.name = `*${t.eliteType}* ${t.name}`;
            if (t.eliteType === 'FRENZIED') { t.dmgBase = Math.floor(t.dmgBase * 1.4); t.speed += 4; }
            if (t.eliteType === 'ARMORED') { t.maxHp += 30; t.hp += 30; t.armor += 15; }
        }
        t.intent = rollIntent(t);
        squad.push({ ...t, id: `e${i}_${Date.now()}`, isPlayer: false });
    }
    return squad;
}

const WEATHER_BANNERS = {
    TOXIC_SMOG:     ['weather-smog',  '⚠️ TOXIC SMOG: Passive Bio DMG to Active Units ⚠️'],
    SANDSTORM:      ['weather-sand',  '⚠️ SANDSTORM: Ranged Abilities deal -25% DMG ⚠️'],
    SHRAPNEL_WINDS: ['weather-shrap', '⚠️ SHRAPNEL WINDS: 30% chance for random DMG at Turn Start ⚠️'],
    BLOODLUST:      ['weather-blood', '💀 THUNDERDOME BLOODLUST: All units deal +20% DMG 💀']
};

function applyCombatScenery(bgFile) {
    combatBgFile = bgFile;
    document.getElementById('combat-sky-layer').style.backgroundImage = `linear-gradient(to bottom, rgba(43, 10, 10, 0.4) 0%, rgba(0, 0, 0, 0.5) 100%), url('${bgFile}')`;
    const wBanner = document.getElementById('weather-banner'); const w = WEATHER_BANNERS[currentWeather];
    wBanner.className = w ? w[0] : '';
    wBanner.innerText = w ? w[1] : '';
    wBanner.style.display = w ? 'block' : 'none';
}

function initiateCombat(nodeType, isEliteNode) {
    let deployedRoster = playerRoster.filter(p => p.gridPos > 0);
    if (!deployedRoster.some(p => p.hp > 0)) { alert("All deployed units are dead. Adjust squad at Outpost."); renderOutpost(); return; }
    deployedRoster.sort((a, b) => a.gridPos - b.gridPos);

    switchScreen('screen-combat'); combatActive = true; document.getElementById('log').innerHTML = '';

    let bgFile = 'bg_combat.webp'; currentWeather = 'CLEAR'; currentNodeType = nodeType; isCurrentNodeElite = isEliteNode;
    if (currentTier === 1 && currentSector === 1) { bgFile = 'bg_combat.webp'; } else {
        if (nodeType === 'BOSS') { bgFile = 'bg_thunderdome.webp'; currentWeather = 'BLOODLUST'; }
        else if (nodeType === 'MECH') { bgFile = 'bg_refinery.webp'; if (Math.random() < 0.4) currentWeather = 'TOXIC_SMOG'; }
        else if (nodeType === 'RAIDERS') { bgFile = 'bg_highway.webp'; if (Math.random() < 0.4) currentWeather = 'SHRAPNEL_WINDS'; }
        else if (nodeType === 'BEASTS') { bgFile = 'bg_canyon.webp'; if (Math.random() < 0.4) currentWeather = 'SANDSTORM'; }
    }
    applyCombatScenery(bgFile);

    playerRoster.forEach(ent => { ent.stunnedTurns = 0; ent.bleedingTurns = 0; ent.armorTurns = 0; ent.armor = 0; ent.oiledTurns = 0; });
    const mult = difficultyMult * (1 + ((currentTier - 1) * 0.2)) * Math.pow(1.5, currentSector - 1);
    
    activeEntities = [...deployedRoster, ...generateEnemies(nodeType, mult, isEliteNode)];
    turnQueue = [...activeEntities].sort((a, b) => b.speed - a.speed);
    activeIndex = 0; log("> COMBAT INITIATED.", "log-turn"); processTurn();
}

const logEl = document.getElementById('log');
function log(msg, styleClass = "log-dmg") { const el = document.createElement('div'); el.className = styleClass; el.innerText = msg; logEl.appendChild(el); logEl.scrollTop = logEl.scrollHeight; }

function renderQueue() {
    const qStr = turnQueue.map(e => { if (e.hp <= 0) return ''; return (e.stunnedTurns > 0 ? '!' : '') + e.name.substring(0,3).toUpperCase(); }).filter(s => s !== '').join(' > ');
    document.getElementById('queue-display').innerText = `Q: ${qStr}`;
}

function renderField() {
    renderQueue(); const pTeam = document.getElementById('player-team'); const eTeam = document.getElementById('enemy-team'); pTeam.innerHTML = ''; eTeam.innerHTML = '';
    activeEntities.forEach(ent => {
        let isDead = ent.hp <= 0; const isAct = (!isDead && turnQueue.length > 0 && turnQueue[activeIndex]?.id === ent.id) ? 'active' : ''; const dCls = isDead ? 'dead' : '';
        let tCls = ''; let clk = '';
        if (pendingAction) {
            if (pendingAction === 'OVERDRIVE' && turnQueue[activeIndex].classType === 'MEDIC' && ent.isPlayer) {
                tCls = 'targetable-ally'; clk = `data-action="target" data-id="${ent.id}"`;
            } else if (!isDead) {
                if (pendingAction === 'CAUTERIZE' && ent.isPlayer) { tCls = 'targetable-ally'; clk = `data-action="target" data-id="${ent.id}"`; } 
                else if (['ITEM_MED', 'ITEM_BOMB', 'ITEM_ADRENALINE', 'ITEM_EMP'].includes(pendingAction)) {
                    if (pendingAction === 'ITEM_MED' && ent.isPlayer) { tCls = 'targetable-ally'; clk = `data-action="use-item" data-id="${ent.id}"`; }
                    else if (pendingAction === 'ITEM_ADRENALINE' && ent.isPlayer) { tCls = 'targetable-ally'; clk = `data-action="use-item" data-id="${ent.id}"`; }
                    else if (pendingAction === 'ITEM_BOMB' && !ent.isPlayer) { tCls = 'targetable-enemy'; clk = `data-action="use-item" data-id="${ent.id}"`; }
                    else if (pendingAction === 'ITEM_EMP' && !ent.isPlayer) { tCls = 'targetable-enemy'; clk = `data-action="use-item" data-id="${ent.id}"`; }
                }
                else if (pendingAction !== 'CAUTERIZE' && !ent.isPlayer) { tCls = 'targetable-enemy'; clk = `data-action="target" data-id="${ent.id}"`; }
            }
        }
        let eff = ''; if (ent.bleedingTurns > 0 && !isDead) eff += `💧`; if (ent.stunnedTurns > 0 && !isDead) eff += `💫`; if (ent.armorTurns > 0 && !isDead) eff += `🛡️`; if (ent.oiledTurns > 0 && !isDead) eff += `🛢️`;
        let hoverCls = ent.isHovering && !isDead ? 'hovering' : '';
        let eliteGlow = ent.eliteType && !isDead ? 'filter: drop-shadow(0 0 15px #8B0000);' : '';

        const html = `
            <div class="entity ${isAct} ${dCls} ${tCls}" id="${ent.id}" ${clk} style="--sprite-scale: ${ent.scale || 1};">
                <div class="intent-icon" style="display:${ent.intent && !isDead && !ent.isPlayer ? 'flex' : 'none'}">${ent.intent ? ent.intent.icon : ''}</div>
                <div style="width: 100%; position: relative; z-index: 10; transform: translateY(${ent.hpDrop || 0}px);">
                    <div class="hp-text"><span class="status-badge">${eff}</span> ${ent.hp}/${ent.maxHp}</div>
                    <div class="hp-container"><div class="hp-fill ${ent.isPlayer ? 'player-hp' : 'enemy-hp'}" style="width: ${(ent.hp / ent.maxHp) * 100}%"></div></div>
                </div><img class="portrait ${hoverCls}" src="${ent.img}" style="${eliteGlow}">
            </div>`;
        if (ent.isPlayer) pTeam.innerHTML += html; else eTeam.innerHTML += html;
    });
    pTeam.classList.toggle('crowded', pTeam.children.length >= 4);
    eTeam.classList.toggle('crowded', eTeam.children.length >= 4);
    renderCommandDeck();
}

function renderCommandDeck() {
    const d = document.getElementById('command-deck'); d.innerHTML = ''; if (!combatActive) return;
    if (pendingAction) { d.innerHTML = `<button style="color:#8B0000; border-color:#8B0000" data-action="cancel">CANCEL ORDERS</button>`; return; }
    let aE = turnQueue[activeIndex];
    if (!aE.isPlayer) { d.innerHTML = `<div class="dash-msg">ENEMY TURN...</div>`; return; }
    if (aE.stunnedTurns > 0) { d.innerHTML = `<div class="dash-msg">STUNNED</div><button data-action="skip-turn">Skip Turn</button>`; return; }

    let cds = aE.cooldowns; let deckHtml = '';
    
    if (momentum >= 100) {
        let odName = 'ULTIMATE';
        if (aE.classType === 'BRUISER') odName = 'EARTHSHAKER'; else if (aE.classType === 'MEDIC') odName = 'FIELD REVIVE'; else if (aE.classType === 'SCAVENGER') odName = 'SCRAP STORM'; else if (aE.classType === 'PYROMANIAC') odName = 'HELLFIRE'; else if (aE.classType === 'SHOTGUNNER') odName = 'BREACH CHARGE'; else if (aE.classType === 'SNIPER') odName = 'HEADSHOT'; else if (aE.classType === 'HOUND') odName = 'APEX PREDATOR';
        deckHtml += `<button class="title-btn btn-overdrive" data-action="queue" data-move="OVERDRIVE">OVERDRIVE: ${odName}</button>`;
    }

    if (aE.classType === 'BRUISER') {
        deckHtml += `<button data-action="queue" data-move="SCRAP_BLADE">Scrap Blade</button>`;
        deckHtml += `<button ${cds.heavy_wrench > 0 ? 'disabled' : ''} data-action="queue" data-move="HEAVY_WRENCH">Heavy Wrench ${cds.heavy_wrench > 0 ? `[${cds.heavy_wrench}]` : ''}</button>`;
        deckHtml += `<button ${cds.iron_guard > 0 ? 'disabled' : ''} data-action="self" data-move="IRON_GUARD">Iron Guard ${cds.iron_guard > 0 ? `[${cds.iron_guard}]` : ''}</button>`;
    } else if (aE.classType === 'MEDIC') {
        deckHtml += `<button data-action="queue" data-move="PISTOL">Pistol</button>`;
        deckHtml += `<button data-action="queue" data-move="RAD_SHOT">Rad Shot</button>`;
        deckHtml += `<button ${cds.cauterize > 0 ? 'disabled' : ''} data-action="queue" data-move="CAUTERIZE">Cauterize ${cds.cauterize > 0 ? `[${cds.cauterize}]` : ''}</button>`;
    } else if (aE.classType === 'SCAVENGER') {
        deckHtml += `<button data-action="queue" data-move="PIPE_RIFLE">Pipe Rifle</button>`;
        deckHtml += `<button ${cds.flashbang > 0 ? 'disabled' : ''} data-action="queue" data-move="FLASHBANG">Flashbang ${cds.flashbang > 0 ? `[${cds.flashbang}]` : ''}</button>`;
    } else if (aE.classType === 'PYROMANIAC') {
        deckHtml += `<button data-action="queue" data-move="FLARE_GUN">Flare Gun (Oil)</button>`;
        deckHtml += `<button ${cds.molotov > 0 ? 'disabled' : ''} data-action="queue" data-move="MOLOTOV">Molotov (AoE) ${cds.molotov > 0 ? `[${cds.molotov}]` : ''}</button>`;
    } else if (aE.classType === 'SHOTGUNNER') {
        deckHtml += `<button data-action="queue" data-move="SLUG_SHOT">Slug Shot</button>`;
        deckHtml += `<button ${cds.buckshot > 0 ? 'disabled' : ''} data-action="queue" data-move="BUCKSHOT">Buckshot (Front) ${cds.buckshot > 0 ? `[${cds.buckshot}]` : ''}</button>`;
    } else if (aE.classType === 'SNIPER') {
        deckHtml += `<button data-action="queue" data-move="QUICK_SHOT">Quick Shot</button>`;
        deckHtml += `<button ${cds.deadeye > 0 ? 'disabled' : ''} data-action="queue" data-move="DEADEYE">Deadeye (Back) ${cds.deadeye > 0 ? `[${cds.deadeye}]` : ''}</button>`;
    } else if (aE.classType === 'HOUND') {
        deckHtml += `<button data-action="queue" data-move="SNAP">Snap</button>`;
        deckHtml += `<button ${cds.feral_bite > 0 ? 'disabled' : ''} data-action="queue" data-move="FERAL_BITE">Feral Bite (Bleed) ${cds.feral_bite > 0 ? `[${cds.feral_bite}]` : ''}</button>`;
    }

    if (inventory.length > 0) { deckHtml += `<button style="border-color:#B8860B; color:#B8860B;" data-action="bag">BAG (${inventory.length})</button>`; }
    d.innerHTML = deckHtml;
}

function processTurn() {
    if (!combatActive) return; pendingAction = null; let aE = turnQueue[activeIndex]; if (aE.hp <= 0) { nextTurn(); return; }
    saveGameState();
    renderField(); applyTurnStartEffects(aE); if (!combatActive) return; if (!aE.hp > 0) return checkWinState(); 
    if (aE.stunnedTurns > 0) { if (!aE.isPlayer) { log(`> ${aE.name} stunned.`, "log-status"); spawnFCT(aE.id, "STUNNED", "fct-status"); aE.stunnedTurns--; setTimeout(nextTurn, 1000 * globalSettings.combatSpeed); return; } else return; }
    if (!aE.isPlayer) setTimeout(() => executeEnemyAi(aE), 1000 * globalSettings.combatSpeed);
}

function applyTurnStartEffects(ent) {
    let chg = false; if (ent.isPlayer && ent.cooldowns) { for (let s in ent.cooldowns) { if (ent.cooldowns[s] > 0) { ent.cooldowns[s]--; chg = true; } } }
    
    if (currentWeather === 'TOXIC_SMOG') { let sDmg = Math.floor(2 * (1 + ((currentTier - 1) * 0.4))); ent.hp = Math.max(0, ent.hp - sDmg); log(`> ${ent.name} choked by Smog for ${sDmg} DMG.`, "log-dmg"); spawnFCT(ent.id, `-${sDmg}`, "fct-status"); chg = true; addMomentum(5); triggerHitFlash(ent.id); }
    if (currentWeather === 'SHRAPNEL_WINDS' && Math.random() < 0.3) { let shrapDmg = Math.floor(5 * (1 + ((currentTier - 1) * 0.4))); ent.hp = Math.max(0, ent.hp - shrapDmg); log(`> Shrapnel struck ${ent.name} for ${shrapDmg} DMG!`, "log-dmg"); spawnFCT(ent.id, `-${shrapDmg}`, "fct-dmg"); chg = true; addMomentum(5); triggerHitFlash(ent.id); }

    if (ent.bleedingTurns > 0) { let b = Math.max(1, Math.floor(ent.maxHp * 0.08)); ent.hp = Math.max(0, ent.hp - b); log(`> ${ent.name} bleeds for ${b}.`, "log-dmg"); spawnFCT(ent.id, `-${b}`, "fct-dmg"); ent.bleedingTurns--; chg = true; if(ent.isPlayer) addMomentum(5); triggerHitFlash(ent.id); }
    if (ent.armorTurns > 0) { ent.armorTurns--; if (ent.armorTurns === 0) { ent.armor = 0; } chg = true; }
    if (ent.oiledTurns > 0) { ent.oiledTurns--; chg = true; }
    if (chg) renderField();
}

function skipStunnedTurn() { turnQueue[activeIndex].stunnedTurns--; renderField(); setTimeout(nextTurn, 500 * globalSettings.combatSpeed); }
function queueAction(a) { pendingAction = a; renderField(); }
function cancelAction() { pendingAction = null; renderField(); }

function resolveAction(targetId) {
    let actEnt = turnQueue[activeIndex]; let target = activeEntities.find(e => e.id === targetId);
    let livingEnemies = activeEntities.filter(e => !e.isPlayer && e.hp > 0);
    let dist = livingEnemies.findIndex(e => e.id === targetId);

    if (pendingAction === 'OVERDRIVE') {
        momentum = 0; addMomentum(0); playSFX('shoot'); triggerGlitch();
        log(`> ${actEnt.name} unleashed OVERDRIVE!`, "log-combo");

        if (actEnt.classType === 'BRUISER') { 
            triggerShake(); livingEnemies.forEach(e => { applyDamageHit(actEnt, e, actEnt.dmgBase * 1.5, 'phys', null); e.stunnedTurns = 1; spawnFCT(e.id, "STUNNED", "fct-status"); });
        } else if (actEnt.classType === 'MEDIC') { 
            target.hp = Math.floor(target.maxHp * 0.5); target.stunnedTurns = 0; target.bleedingTurns = 0; 
            spawnFCT(target.id, "REVIVED", "fct-heal"); playSFX('heal');
        } else if (actEnt.classType === 'SCAVENGER') { 
            triggerShake(); livingEnemies.forEach(e => { applyDamageHit(actEnt, e, actEnt.dmgBase * 1.2, 'energy', null); });
        } else if (actEnt.classType === 'PYROMANIAC') { 
            triggerShake(); livingEnemies.forEach(e => { applyDamageHit(actEnt, e, actEnt.dmgBase * 2.0, 'energy', null); e.oiledTurns = 3; e.bleedingTurns = 3; });
        } else if (actEnt.classType === 'SHOTGUNNER') { 
            target.armor = 0; target.armorTurns = 0; applyDamageHit(actEnt, target, actEnt.dmgBase * 3.0, 'phys', null);
        } else if (actEnt.classType === 'SNIPER') { 
            let d = target.classType === 'BOSS' ? actEnt.dmgBase * 4.0 : target.maxHp; applyDamageHit(actEnt, target, d, 'phys', null);
        } else if (actEnt.classType === 'HOUND') { 
            actEnt.hp = actEnt.maxHp; applyDamageHit(actEnt, target, actEnt.dmgBase * 2.5, 'bio', null); target.bleedingTurns = 3;
        }
        pendingAction = null; checkWinState(); return;
    }

    if (pendingAction === 'CAUTERIZE') {
        let heal = 20 + Math.floor(Math.random() * 10); target.hp = Math.min(target.maxHp, target.hp + heal); actEnt.cooldowns.cauterize = 3; 
        log(`> ${actEnt.name} heals ${target.name} for ${heal}.`, "log-heal"); spawnFCT(target.id, `+${heal}`, "fct-heal"); playSFX('heal');
    } else {
        let atkType = 'phys'; if(['RAD_SHOT', 'FERAL_BITE'].includes(pendingAction)) atkType = 'bio'; if(['FLASHBANG', 'MOLOTOV', 'FLARE_GUN'].includes(pendingAction)) atkType = 'energy';
        let tuneUpBonus = tuneUpBattles > 0 ? 4 : 0;
        let baseDmg = actEnt.dmgBase + tuneUpBonus + Math.floor(Math.random() * 6); 
        let dmgMult = 1.0; let isCombo = false; let comboType = '';

        if (pendingAction === 'FLASHBANG') { dmgMult = 0.4; actEnt.cooldowns.flashbang = 4; }
        if (pendingAction === 'HEAVY_WRENCH') { dmgMult = 1.5; actEnt.cooldowns.heavy_wrench = 3; }
        if (pendingAction === 'FERAL_BITE') { dmgMult = 1.2; actEnt.cooldowns.feral_bite = 3; }
        if (pendingAction === 'DEADEYE') { if (dist === livingEnemies.length - 1 && dist !== 0) dmgMult = 1.8; else dmgMult = 0.8; actEnt.cooldowns.deadeye = 2; }
        
        if (pendingAction === 'BUCKSHOT' || pendingAction === 'MOLOTOV') { 
            if (target.oiledTurns > 0) { dmgMult *= 2; target.oiledTurns = 0; isCombo = true; comboType = 'IGNITE!'; }
        }
        
        if (pendingAction === 'BUCKSHOT') { 
            if (dist === 0) dmgMult *= 1.5; else dmgMult *= 0.8; 
            actEnt.cooldowns.buckshot = 2; 
        }

        if (pendingAction === 'PIPE_RIFLE' && target.bleedingTurns > 0) { dmgMult *= 1.5; isCombo = true; comboType = 'EXPLOIT!'; }
        if (pendingAction === 'SCRAP_BLADE' && target.stunnedTurns > 0) { dmgMult *= 1.5; isCombo = true; comboType = 'EXECUTE!'; }

        if (activeRelics.some(r => r.id === 'THERMAL_CORE') && atkType === 'energy') { dmgMult *= 1.3; }

        const rangedMoves = ['PISTOL', 'RAD_SHOT', 'PIPE_RIFLE', 'FLASHBANG', 'FLARE_GUN', 'QUICK_SHOT', 'DEADEYE'];
        if (currentWeather === 'SANDSTORM' && rangedMoves.includes(pendingAction)) { dmgMult *= 0.75; }
        if (currentWeather === 'BLOODLUST') { dmgMult *= 1.2; }
        
        playSFX('shoot');
        if (isCombo) { 
            log(`> COMBO ACTIVATED: ${comboType}`, "log-combo"); 
            setTimeout(() => spawnFCT(target.id, comboType, "fct-combo"), 200); 
            checkBountyProgress('COMBO'); addMomentum(25); triggerShake();
        }

        applyDamageHit(actEnt, target, Math.floor(baseDmg * dmgMult), atkType, pendingAction);

        if (actEnt.quirk && actEnt.quirk.id === 'VAMPIRIC' && actEnt.hp < actEnt.maxHp) {
             actEnt.hp = Math.min(actEnt.maxHp, actEnt.hp + 2);
             spawnFCT(actEnt.id, "+2", "fct-heal");
        }

        if (activeRelics.some(r => r.id === 'BLOOD_VIAL') && atkType === 'bio' && actEnt.hp < actEnt.maxHp) {
            actEnt.hp = Math.min(actEnt.maxHp, actEnt.hp + 5);
            spawnFCT(actEnt.id, "+5", "fct-heal");
        }

        if (pendingAction === 'FLARE_GUN') { target.oiledTurns = 3; log(`> ${target.name} is coated in oil!`, "log-dmg"); setTimeout(() => spawnFCT(target.id, "OILED", "fct-weak"), 400); }
        if (pendingAction === 'MOLOTOV') { actEnt.cooldowns.molotov = 3; triggerShake(); let secondaries = livingEnemies.filter(e => e.id !== targetId); if (secondaries.length > 0) { let sTarg = secondaries[Math.floor(Math.random() * secondaries.length)]; applyDamageHit(actEnt, sTarg, Math.floor(baseDmg * 0.7), atkType, null); } }
    }
    pendingAction = null; checkWinState();
}

function applyDamageHit(attacker, target, calcDmg, atkType, abilityStr) {
    if (target.hp <= 0) return; let resistValue = target.resistances[atkType] || 0; let armorCalc = abilityStr === 'FERAL_BITE' ? 0 : target.armor;
    if (target.oiledTurns > 0 && atkType === 'energy') resistValue -= 15; 
    
    if (activeRelics.some(r => r.id === 'KINETIC_MESH') && target.isPlayer && target.gridPos === 1 && atkType === 'phys') {
        calcDmg = Math.floor(calcDmg * 0.75);
    }

    let netDmg = Math.max(1, calcDmg - resistValue - armorCalc); if (resistValue >= 100) netDmg = 0; target.hp = Math.max(0, target.hp - netDmg);
    let logStyle = "log-dmg"; let logMsg = `> ${attacker.name} hits ${target.name} for ${netDmg}`;
    
    triggerHitFlash(target.id);

    if (netDmg === 0 && resistValue >= 100) { logMsg += " (Immune)."; spawnFCT(target.id, "IMMUNE", "fct-status");
    } else if (resistValue > 5) { logMsg += " (Resisted)."; spawnFCT(target.id, `-${netDmg}`, "fct-dmg");
    } else if (resistValue < 0) { logMsg += " (Weakness!)."; logStyle = "log-dmg"; spawnFCT(target.id, `-${netDmg}!`, "fct-weak"); playSFX('hit');
    } else { spawnFCT(target.id, `-${netDmg}`, "fct-dmg"); playSFX('hit'); }
    
    log(logMsg, logStyle);

    if (target.hp <= 0) { addMomentum(15); if (!target.isPlayer) { checkBountyProgress('KILL'); if (runStats) runStats.kills++; } } else if (target.isPlayer) { addMomentum(5); }

    if (abilityStr === 'RAD_SHOT' || abilityStr === 'FERAL_BITE') {
        if (Math.random() < (abilityStr === 'FERAL_BITE' ? 0.9 : 0.6)) { target.bleedingTurns = 3; log(`> ${target.name} bleeding!`, "log-dmg"); setTimeout(() => spawnFCT(target.id, "BLEED", "fct-status"), 300 * globalSettings.combatSpeed); }
    } else if (abilityStr === 'HEAVY_WRENCH' || abilityStr === 'FLASHBANG') {
        let sc = (abilityStr === 'FLASHBANG') ? 0.35 : 0.2; if (abilityStr === 'FLASHBANG' && target.resistances.energy < 0) sc *= 2;
        if (Math.random() < sc) { target.stunnedTurns = 1; log(`> ${target.name} stunned!`, "log-status"); setTimeout(() => spawnFCT(target.id, "STUNNED", "fct-status"), 300 * globalSettings.combatSpeed); }
    }
}

function executeEnemyAi(enemy) {
    if (!combatActive) return;
    
    if (enemy.classType === 'BOSS' && enemy.phase === 1 && enemy.hp <= (enemy.maxHp / 2)) {
        enemy.phase = 2; log(`> WARLORD ENRAGED!`, "log-dmg"); spawnFCT(enemy.id, "ENRAGED!", "fct-status"); enemy.dmgBase = Math.floor(enemy.dmgBase * 1.5); playSFX('hit'); triggerShake();
        const m = 1 + ((currentTier - 1) * 0.4); const d = { name: "War Hound", classType: "BEAST", range: 'melee', maxHp: Math.floor(30*m), hp: Math.floor(30*m), speed: 18, armor: 0, isPlayer: false, dmgBase: Math.floor(12*m), img: "enemy_dog.webp", scale: 0.8, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, resistances: { phys: -2, bio: 0, energy: 0 } };
        for(let i = 0; i < 2; i++) { let n = JSON.parse(JSON.stringify(d)); n.id = `summon_${Date.now()}_${i}`; activeEntities.push(n); turnQueue.push(n); }
        enemy.intent = rollIntent(enemy); renderField(); setTimeout(nextTurn, 1000 * globalSettings.combatSpeed); return;
    }

    let validTargets = activeEntities.filter(e => e.isPlayer && e.hp > 0); 
    if (validTargets.length === 0) return;
    let target;
    if (enemy.range === 'melee') { validTargets.sort((a, b) => a.gridPos - b.gridPos); target = validTargets[0]; } else { target = validTargets.sort(() => 0.5 - Math.random())[0]; }

    let intent = enemy.intent || { type: 'ATTACK' };
    
    if (intent.type === 'DEFEND') {
        enemy.armor += 15; enemy.armorTurns = 2; spawnFCT(enemy.id, "+ARMOR", "fct-heal"); log(`> ${enemy.name} took a defensive stance!`, "log-status"); playSFX('heal');
        enemy.intent = rollIntent(enemy); checkWinState(); return;
    }

    if (intent.type === 'AOE') {
        playSFX('shoot'); triggerShake(); log(`> ${enemy.name} unleashed an area attack!`, "log-dmg");
        let rawDmg = Math.floor(enemy.dmgBase * 0.7); 
        if (currentWeather === 'SANDSTORM') rawDmg = Math.floor(rawDmg * 0.75);
        if (currentWeather === 'BLOODLUST') rawDmg = Math.floor(rawDmg * 1.2);
        validTargets.forEach(targ => { applyDamageHit(enemy, targ, rawDmg, enemy.dmgType || 'phys', 'BASIC'); });
        enemy.intent = rollIntent(enemy); checkWinState(); return;
    }

    if (target) {
        playSFX('shoot');
        let t = enemy.dmgType || 'phys'; 
        let rawDmg = enemy.dmgBase + Math.floor(Math.random() * 5);
        
        if (intent.type === 'HEAVY') { rawDmg = Math.floor(rawDmg * 1.5); triggerShake(); }

        if (currentWeather === 'SANDSTORM' && enemy.range === 'ranged') rawDmg = Math.floor(rawDmg * 0.75);
        if (currentWeather === 'BLOODLUST') rawDmg = Math.floor(rawDmg * 1.2);

        if (intent.type === 'STATUS') { rawDmg = Math.floor(rawDmg * 0.3); }

        applyDamageHit(enemy, target, rawDmg, t, 'BASIC');

        if (enemy.eliteType === 'VAMPIRIC') { let heal = Math.max(1, Math.floor(rawDmg * 0.5)); enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal); setTimeout(() => spawnFCT(enemy.id, `+${heal}`, "fct-heal"), 300); }

        if (intent.type === 'STATUS' || ["Mutant", "Attack Dog", "War Hound", "Chem Fiend"].includes(enemy.name)) { 
            if (Math.random() < 0.5) { target.bleedingTurns = 2; setTimeout(() => spawnFCT(target.id, "BLEED", "fct-status"), 300 * globalSettings.combatSpeed); }
            else { target.stunnedTurns = 1; setTimeout(() => spawnFCT(target.id, "STUNNED", "fct-status"), 300 * globalSettings.combatSpeed); }
        }
    }
    
    enemy.intent = rollIntent(enemy); checkWinState();
}

const RESERVE_XP_RATE = 0.5;

function awardXp(char, amount) {
    if (amount <= 0) return;
    char.xp += amount;
    while (char.xp >= char.xpToNext) {
        char.level++; char.xp -= char.xpToNext; char.xpToNext = Math.floor(char.xpToNext * 1.5); char.perkPoints++;
        log(`> ${char.name} reached Level ${char.level}! Perk point available.`, "log-heal");
    }
}

function checkWinState() {
    renderField();
    const pA = activeEntities.some(e => e.isPlayer && e.hp > 0); const eA = activeEntities.some(e => !e.isPlayer && e.hp > 0);
    if (!pA) { document.getElementById('command-deck').innerHTML = `<button data-action="end-run">EXPEDITION FAILED - RESTART</button>`; combatActive = false; } 
    else if (!eA) { 
        if (currentNodeType === 'BOSS') { bossSkulls++; if (runStats) runStats.bosses++; saveMeta(); log(`> VICTORY! Warlord Skull acquired!`, "log-heal"); }
        if (isCurrentNodeElite) {
            checkBountyProgress('ELITE'); if (runStats) runStats.elites++;
            let availableRelics = RELIC_POOL.filter(r => !activeRelics.some(ar => ar.id === r.id));
            if (availableRelics.length > 0) {
                let rDrop = availableRelics[Math.floor(Math.random() * availableRelics.length)];
                activeRelics.push(rDrop);
                log(`> RELIC ACQUIRED: ${rDrop.name}!`, "log-combo");
            }
        }

        if (tuneUpBattles > 0) tuneUpBattles--; 

        let scrapMult = isCurrentNodeElite ? 2 : 1;
        let s = Math.floor((Math.floor(Math.random() * 30) + (currentTier * 20)) * scrapMult * sectorRewardMult()); 
        if (activeRelics.some(r => r.id === 'SCRAP_MAGNET')) s += 15;
        
        // Deployed survivors earn full XP; the bench trains at half rate so reserves stay
        // rotatable instead of falling permanently behind. Downed units earn nothing.
        playerRoster.forEach(char => {
            const base = Math.floor(35 * scrapMult * sectorRewardMult());
            if (char.gridPos > 0 && char.hp > 0) awardXp(char, base);
            else if (char.gridPos === 0) awardXp(char, Math.floor(base * RESERVE_XP_RATE));
        });

        let matDrops = (1 + Math.floor(Math.random() * 2)) * scrapMult;
        for(let i=0; i<matDrops; i++) { let m = ['parts', 'chems', 'tech'][Math.floor(Math.random() * 3)]; materials[m]++; log(`> Salvaged: 1 ${m.toUpperCase()}`, "log-heal"); }

        document.getElementById('command-deck').innerHTML = `<button data-action="loot" data-amount="${s}">LOOT ${s}</button>`; combatActive = false; 
    } 
    else { if (pendingAction === null) setTimeout(nextTurn, 800 * globalSettings.combatSpeed); }
}

initEngine();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            await navigator.serviceWorker.register('sw.js');
            const reg = await navigator.serviceWorker.ready;
            // Hand the worker the art set so offline play does not depend on the HTTP cache.
            if (reg.active) reg.active.postMessage({ type: 'CACHE_ART', urls: ASSET_LIST });
        } catch (e) { /* offline play is a bonus, never a requirement */ }
    });
}

// --- Inspection surface -------------------------------------------------------------
// game.js is an ES module, so nothing above reaches window on its own. This is the single
// deliberate exception: one namespaced object the headless suites drive the engine through.
// Nothing in the game itself reads it - if you are adding a feature, you do not need it.
globalThis.WP = {
    // entry points and pure helpers the suites exercise
    initEngine, renderTitleScreen, renderCitadel, renderMap, renderOutpost, openSettings, closeSettings, selectSlot, confirmNewGame, continueGame, saveGameState, loadGameState, saveMeta, loadMeta, buyMetaUpgrade, advanceSector, initiateEvent, initiateCamp, initiateCombat, resumeCombat, generateEnemies, renderField, checkWinState, handleSquadWipe, endRun, collectLoot, generateBounties, rollBounty, checkBountyProgress, computeScore, newRunStats, noteDepth, sectorRewardMult, awardXp, log, playSFX, addMomentum, setOutpostTab,
    // engine constants
    BASE_SAVE_KEY, SETTINGS_KEY, META_KEY, TOTAL_TIERS, SECTOR_TIER_BONUS, RESERVE_XP_RATE, ASSET_LIST, ACTIONS, BOUNTY_POOL, ROSTER_TEMPLATE,
    // live run state, readable and writable so a suite can set up a scenario
    get audioCtx() { return audioCtx; }, set audioCtx(v) { audioCtx = v; },
    get currentSlot() { return currentSlot; }, set currentSlot(v) { currentSlot = v; },
    get globalSettings() { return globalSettings; }, set globalSettings(v) { globalSettings = v; },
    get previousScreen() { return previousScreen; }, set previousScreen(v) { previousScreen = v; },
    get bossSkulls() { return bossSkulls; }, set bossSkulls(v) { bossSkulls = v; },
    get metaUpgrades() { return metaUpgrades; }, set metaUpgrades(v) { metaUpgrades = v; },
    get scrap() { return scrap; }, set scrap(v) { scrap = v; },
    get currentTier() { return currentTier; }, set currentTier(v) { currentTier = v; },
    get currentSector() { return currentSector; }, set currentSector(v) { currentSector = v; },
    get difficultyMult() { return difficultyMult; }, set difficultyMult(v) { difficultyMult = v; },
    get inventory() { return inventory; }, set inventory(v) { inventory = v; },
    get materials() { return materials; }, set materials(v) { materials = v; },
    get tuneUpBattles() { return tuneUpBattles; }, set tuneUpBattles(v) { tuneUpBattles = v; },
    get activeBounties() { return activeBounties; }, set activeBounties(v) { activeBounties = v; },
    get momentum() { return momentum; }, set momentum(v) { momentum = v; },
    get activeRelics() { return activeRelics; }, set activeRelics(v) { activeRelics = v; },
    get combatBgFile() { return combatBgFile; }, set combatBgFile(v) { combatBgFile = v; },
    get pendingCombat() { return pendingCombat; }, set pendingCombat(v) { pendingCombat = v; },
    get runStats() { return runStats; }, set runStats(v) { runStats = v; },
    get activeEvent() { return activeEvent; }, set activeEvent(v) { activeEvent = v; },
    get outpostTab() { return outpostTab; }, set outpostTab(v) { outpostTab = v; },
    get activePosSelector() { return activePosSelector; }, set activePosSelector(v) { activePosSelector = v; },
    get activePerkSelector() { return activePerkSelector; }, set activePerkSelector(v) { activePerkSelector = v; },
    get currentWeather() { return currentWeather; }, set currentWeather(v) { currentWeather = v; },
    get currentNodeType() { return currentNodeType; }, set currentNodeType(v) { currentNodeType = v; },
    get isCurrentNodeElite() { return isCurrentNodeElite; }, set isCurrentNodeElite(v) { isCurrentNodeElite = v; },
    get playerRoster() { return playerRoster; }, set playerRoster(v) { playerRoster = v; },
    get activeEntities() { return activeEntities; }, set activeEntities(v) { activeEntities = v; },
    get turnQueue() { return turnQueue; }, set turnQueue(v) { turnQueue = v; },
    get activeIndex() { return activeIndex; }, set activeIndex(v) { activeIndex = v; },
    get combatActive() { return combatActive; }, set combatActive(v) { combatActive = v; },
    get pendingAction() { return pendingAction; }, set pendingAction(v) { pendingAction = v; },
    get bestScore() { return bestScore; }, set bestScore(v) { bestScore = v; },
    get bestSector() { return bestSector; }, set bestSector(v) { bestSector = v; },
};

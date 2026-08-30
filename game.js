// Wasteland Protocol engine. An ES module (strict by default, deferred by default), so
// none of its declarations leak onto window - the markup reaches the engine only through
// data-action attributes, never by calling a global. See the inspection surface at the
// foot of this file for the one deliberate export.

// Art that is commissioned but not yet drawn. Anything listed here is kept out of the
// preloader and the service worker cache so neither chases a file that does not exist, and
// the portrait fallback covers it on the field. Empty is the healthy state.
const PENDING_ART = [
    "enemy_choir_acolyte.webp", "enemy_choir_censer.webp", "enemy_choir_reliquary.webp", "enemy_choir_hierophant.webp",
    "enemy_carrion_rat.webp", "enemy_carrion_moth.webp", "enemy_carrion_worm.webp", "enemy_carrion_brood.webp"
];
const ASSET_LIST = [
    "bg_title.webp", "bg_combat.webp", "bg_thunderdome.webp", "bg_refinery.webp", "bg_highway.webp", "bg_canyon.webp", "bg_foundry.webp", "bg_nest.webp",
    "hero_bruiser.webp", "hero_medic.webp", "hero_scavenger.webp", "hero_pyro.webp", "hero_shotgunner.webp", "hero_sniper.webp", "hero_hound.webp",
    "hero_fiend.webp", "hero_hazmat.webp", "hero_harpooner.webp",
    "enemy_dog.webp", "enemy_hound_bulldog.webp", "enemy_mutant.webp", "enemy_chem.webp", "enemy_raider.webp", "enemy_psycho.webp", "enemy_sniper.webp", "enemy_juggernaut.webp", "enemy_drone.webp", "enemy_turret.webp", "enemy_warrig.webp", "enemy_boss.webp", "enemy_boss_mech.webp", "enemy_boss_vulture.webp",
    "enemy_boss_vatborn.webp", "enemy_boss_marshal.webp", "enemy_boss_stormcaller.webp", "enemy_boss_bastion.webp",
    "enemy_choir_acolyte.webp", "enemy_choir_censer.webp", "enemy_choir_reliquary.webp", "enemy_choir_hierophant.webp",
    "enemy_carrion_rat.webp", "enemy_carrion_moth.webp", "enemy_carrion_worm.webp", "enemy_carrion_brood.webp"
];
// The title art is fetched immediately; everything else waits until the menu is up so the
// first screen is not stuck behind the whole art set.
function preloadAssets() {
    const TITLE = 'bg_title.webp';
    new Image().src = TITLE;
    const rest = ASSET_LIST.filter(a => a !== TITLE && !PENDING_ART.includes(a));
    const defer = window.requestIdleCallback || (fn => setTimeout(fn, 400));
    defer(() => rest.forEach(src => { let img = new Image(); img.src = src; }));
}

const BASE_SAVE_KEY = 'wasteland_rpg_core_slot_'; 
const SETTINGS_KEY = 'wasteland_rpg_core_settings';
const META_KEY = 'wasteland_rpg_core_meta';

// All persistence goes through here. Storage can be missing entirely (private browsing,
// site data blocked), full (quota), or hold something a half-finished write left behind -
// none of which should stop the game from starting. Reads that fail look empty; writes that
// fail flip Store.working so the title screen can say so honestly.
const CORRUPT = Symbol('corrupt');
const Store = {
    working: true,
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    getJSON(key) {
        const raw = this.get(key);
        if (raw === null || raw === '') return null;
        try {
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : CORRUPT;
        } catch (e) {
            console.warn(`Unreadable data at ${key}; treating it as corrupt.`);
            return CORRUPT;
        }
    },
    set(key, value) {
        try { localStorage.setItem(key, value); return true; }
        catch (e) { this.working = false; console.warn(`Could not save to ${key}: ${e.name}.`); return false; }
    },
    remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
    probe() {
        try {
            const k = '__wp_probe__';
            localStorage.setItem(k, '1'); localStorage.removeItem(k);
            this.working = true;
        } catch (e) { this.working = false; }
        return this.working;
    }
};

let audioCtx = null;
let currentSlot = 1;
// One on/off switch covered every sound in the game, so a player who wanted the hits without
// the drone had to choose between all of it and none. Two levels now, and motion is a setting
// rather than only whatever the operating system says.
const VOL_STEPS = [0, 0.35, 0.7, 1];
const VOL_NAMES = ['OFF', 'LOW', 'MED', 'FULL'];
const MOTION_MODES = ['auto', 'full', 'off'];
const MOTION_NAMES = { auto: 'SYSTEM', full: 'ON', off: 'OFF' };
const TEXT_STEPS = [1, 1.15, 1.3];
const TEXT_NAMES = ['NORMAL', 'LARGE', 'LARGEST'];
let globalSettings = { combatSpeed: 1.0, sfx: true, sfxVol: 1, ambVol: 0.7, motion: 'auto', textScale: 1 };
function volName(v) { const i = VOL_STEPS.indexOf(v); return VOL_NAMES[i < 0 ? VOL_STEPS.length - 1 : i]; }
function cycleVol(v) { const i = VOL_STEPS.indexOf(v); return VOL_STEPS[(i < 0 ? 0 : i + 1) % VOL_STEPS.length]; }

let bossSkulls = 0; let metaUpgrades = { startScrap: 0, startLevel: 1, invMax: 4, extraRegroups: 0, vault: 0, heirloom: null, heirloomWalked: false,
                                         rerolls: 0, discount: 0, archive: 0, warRoom: 0, cache: 0 };
let scrap = 0; let currentTier = 1; let currentSector = 1; let difficultyMult = 1.0; 
let inventory = []; let materials = { parts: 0, chems: 0, tech: 0 }; 
let tuneUpBattles = 0; 
let activeBounties = []; 
let momentum = 0;
let activeRelics = []; let pendingRelicOffer = null;

let combatBgFile = 'bg_combat.webp'; let pendingCombat = null;
// What the squad ran from, waiting at the next fight. Persisted, because a run that reloads
// between the withdrawal and the next node should still be followed.
let pursuit = null;
let armedExit = null;      // null | 'WITHDRAW' | 'RETREAT' - only one question can be on screen
let retreatNode = null;    // the node a retreat put the squad back in front of
let runStats = null;
let activeEvent = null; let pendingConsequences = []; let recentEvents = []; let activeContracts = []; let pendingDifficulty = 1.0; let activeGearSelector = null;
let activePosSelector = null; let activePerkSelector = null; let currentWeather = 'CLEAR'; let currentNodeType = '';
let isCurrentNodeElite = false;

// Five stat quirks meant most runs contained most quirks and the draw decided nothing. The
// pool is fifteen now, and the new ten interact with formation, combos and the economy - so
// who rolled what is worth reading at muster, and worth a reroll token when it isn't.
const QUIRK_POOL = [
    { id: 'RECKLESS',   name: 'RECKLESS',   desc: '+5 DMG, -15 HP', dmg: 5, hp: -15, spd: 0 },
    { id: 'TWITCHY',    name: 'TWITCHY',    desc: '+3 SPD, -10 HP', dmg: 0, hp: -10, spd: 3 },
    { id: 'STURDY',     name: 'STURDY',     desc: '+20 HP, -2 SPD', dmg: 0, hp: 20, spd: -2 },
    { id: 'VAMPIRIC',   name: 'VAMPIRIC',   desc: 'Heals 2 on every hit they land', dmg: 0, hp: 0, spd: 0 },
    { id: 'LETHARGIC',  name: 'LETHARGIC',  desc: '+8 DMG, -3 SPD', dmg: 8, hp: 0, spd: -3 },
    { id: 'PACK_HUNTER',name: 'PACK HUNTER',desc: '+15% DMG with an ally in the next rank', dmg: 0, hp: 0, spd: 0 },
    { id: 'LONER',      name: 'LONER',      desc: '+20% DMG with no ally in the next rank', dmg: 0, hp: 0, spd: 0 },
    { id: 'SCRAP_RAT',  name: 'SCRAP RAT',  desc: '+1 material after fights they survive', dmg: 0, hp: 0, spd: 0 },
    { id: 'FIRST_BLOOD',name: 'FIRST BLOOD',desc: '+30% DMG against unhurt targets', dmg: 0, hp: 0, spd: 0 },
    { id: 'CLOSER',     name: 'CLOSER',     desc: '+25% DMG against targets below 30%', dmg: 0, hp: 0, spd: 0 },
    { id: 'THICK_HIDE', name: 'THICK HIDE', desc: 'Every hit taken lands 3 lighter', dmg: 0, hp: 0, spd: 0 },
    { id: 'SECOND_WIND',name: 'SECOND WIND',desc: 'Once per fight, survives a killing blow at 1 HP', dmg: 0, hp: 0, spd: 0 },
    { id: 'SLOW_BLEEDER', name: 'SLOW BLEEDER', desc: 'Bleeding hurts them half as much', dmg: 0, hp: 0, spd: 0 },
    { id: 'OVERCHARGED',name: 'OVERCHARGED',desc: '+10 momentum when they land a combo', dmg: 0, hp: 0, spd: 0 },
    { id: 'DUELIST',    name: 'DUELIST',    desc: '+15% DMG against the enemy front', dmg: 0, hp: 0, spd: 0 }
];

function hasQuirk(ent, id) { return !!(ent && ent.isPlayer && ent.quirk && ent.quirk.id === id); }

// ── Gear ─────────────────────────────────────────────────────────────────────────────────
// Two slots per operator: a weapon mod and a trinket. The rule that makes the system matter:
// weapon mods change what an ability DOES - its reach, its cooldown, who it hits, what it
// leaves behind - never just a number. Trinkets are the flat passives. Found on elites and
// commanders, swapped freely at the Outpost.
const GEAR_POOL = [
    // weapon mods, two per class
    { id: 'JAGGED_EDGE',      slot: 'mod', cls: 'BRUISER',    name: 'Jagged Edge',      desc: 'Scrap Blade opens a 2-turn bleed.' },
    { id: 'COUNTERWEIGHT',    slot: 'mod', cls: 'BRUISER',    name: 'Counterweight',    desc: 'Heavy Wrench cools down in 2 turns, not 3.' },
    { id: 'FIELD_KIT',        slot: 'mod', cls: 'MEDIC',      name: 'Field Kit',        desc: 'Cauterize heals 15 more.' },
    { id: 'PRESSURE_SYRINGE', slot: 'mod', cls: 'MEDIC',      name: 'Pressure Syringe', desc: 'Cauterize cools down in 2 turns, not 3.' },
    { id: 'BAYONET',          slot: 'mod', cls: 'SCAVENGER',  name: 'Bayonet',          desc: 'Pipe Rifle becomes a melee weapon: +25% from the front rank, and sandstorms no longer blind it.' },
    { id: 'WIDE_LENS',        slot: 'mod', cls: 'SCAVENGER',  name: 'Wide Lens',        desc: 'Flashbang always stuns.' },
    { id: 'PRESSURE_TANK',    slot: 'mod', cls: 'PYROMANIAC', name: 'Pressure Tank',    desc: 'Flare Gun oils for 4 turns and splashes a second enemy.' },
    { id: 'NAPALM_MIX',       slot: 'mod', cls: 'PYROMANIAC', name: 'Napalm Mix',       desc: 'Molotov also oils its main target.' },
    { id: 'DRUM_CHOKE',       slot: 'mod', cls: 'SHOTGUNNER', name: 'Drum Choke',       desc: 'Buckshot also hits the enemy behind the target at 60%.' },
    { id: 'INCENDIARY_SLUGS', slot: 'mod', cls: 'SHOTGUNNER', name: 'Incendiary Slugs', desc: 'Slug Shot leaves the target oiled for 2 turns.' },
    { id: 'LONG_BARREL',      slot: 'mod', cls: 'SNIPER',     name: 'Long Barrel',      desc: 'Deadeye loses its close-range penalty.' },
    { id: 'SPOTTING_SCOPE',   slot: 'mod', cls: 'SNIPER',     name: 'Spotting Scope',   desc: "Spotter's Mark lasts 4 turns and cools down in 2." },
    { id: 'BLOOD_TRACKER',    slot: 'mod', cls: 'HOUND',      name: 'Blood Tracker',    desc: 'Snap deals +30% to bleeding targets.' },
    { id: 'WAR_HARNESS',      slot: 'mod', cls: 'HOUND',      name: 'War Harness',      desc: 'Rip and Tear cools down in 2 turns, not 3.' },
    { id: 'SERRATED_EDGE',    slot: 'mod', cls: 'TRENCH_FIEND',name: 'Serrated Edge',    desc: 'Bayonet Thrust opens a 2-turn bleed.' },
    { id: 'CHAIN_OILER',      slot: 'mod', cls: 'TRENCH_FIEND',name: 'Chain Oiler',      desc: 'Ripsaw cools down in 2 turns, not 3.' },
    { id: 'HIGH_PRESSURE',    slot: 'mod', cls: 'HAZMAT',      name: 'High-Pressure Line',desc: 'Spray Gun corrodes for 2 turns.' },
    { id: 'SCRUBBER_UNIT',    slot: 'mod', cls: 'HAZMAT',      name: 'Scrubber Unit',    desc: 'Purge Valve heals 15 more.' },
    { id: 'SWIVEL_MOUNT',     slot: 'mod', cls: 'HARPOONER',   name: 'Swivel Mount',     desc: 'Drag Line cools down in 2 turns, not 3.' },
    { id: 'TOGGLE_HEAD',      slot: 'mod', cls: 'HARPOONER',   name: 'Toggle Head',      desc: 'Harpoon deals +30% to bleeding targets.' },
    // trinkets, anyone can wear one
    { id: 'PLATED_VEST',   slot: 'trinket', name: 'Plated Vest',    desc: '+15 max HP.',            apply: c => { c.maxHp += 15; c.hp += 15; }, remove: c => { c.maxHp -= 15; c.hp = Math.min(c.hp, c.maxHp); } },
    { id: 'REFLEX_WRAP',   slot: 'trinket', name: 'Reflex Wrap',    desc: '+2 SPD.',                apply: c => { c.speed += 2; }, remove: c => { c.speed -= 2; } },
    { id: 'IRON_KNUCKLES', slot: 'trinket', name: 'Iron Knuckles',  desc: '+3 DMG.',                apply: c => { c.dmgBase += 3; }, remove: c => { c.dmgBase -= 3; } },
    { id: 'RIOT_SHIELD',   slot: 'trinket', name: 'Riot Shield',    desc: '+6 physical resist.',    apply: c => { c.resistances.phys += 6; }, remove: c => { c.resistances.phys -= 6; } },
    { id: 'GAS_MASK',      slot: 'trinket', name: 'Gas Mask',       desc: '+10 bio resist.',        apply: c => { c.resistances.bio += 10; }, remove: c => { c.resistances.bio -= 10; } },
    { id: 'INSULATED_COAT',slot: 'trinket', name: 'Insulated Coat', desc: '+10 energy resist.',     apply: c => { c.resistances.energy += 10; }, remove: c => { c.resistances.energy -= 10; } },
    { id: 'TOURNIQUET',    slot: 'trinket', name: 'Tourniquet',     desc: 'Bleeding on the wearer never lasts past 1 turn.' },
    { id: 'WAR_TROPHY',    slot: 'trinket', name: 'War Trophy',     desc: 'The wearer earns +25% XP.' }
];

let gearStash = [];

function gearById(id) { return GEAR_POOL.find(g => g.id === id) || null; }
function hasMod(ent, id) { return !!(ent && ent.isPlayer && ent.weaponMod === id); }
function hasTrinket(ent, id) { return !!(ent && ent.isPlayer && ent.trinket === id); }

// The Bayonet is why reach is asked per-operator: the same move can be melee in one pair of
// hands and ranged in another.
function moveReachFor(move, ent) {
    if (hasMod(ent, 'BAYONET') && move === 'PIPE_RIFLE') return 'melee';
    return MOVE_REACH[move];
}

// A cooldown mod shaves a turn off the listed price, never below 1.
function cdFor(ent, id, base) {
    const mods = { COUNTERWEIGHT: 'heavy_wrench', PRESSURE_SYRINGE: 'cauterize',
                   SPOTTING_SCOPE: 'spotters_mark', WAR_HARNESS: 'rip_and_tear',
                   CHAIN_OILER: 'ripsaw', SWIVEL_MOUNT: 'drag_line' };
    for (const [mod, key] of Object.entries(mods)) {
        if (key === id && hasMod(ent, mod)) return Math.max(1, base - 1);
    }
    return base;
}

// A random piece the run has not already got everywhere; mods lean to classes in the roster.
function rollGear() {
    const held = new Set([...gearStash, ...playerRoster.flatMap(c => [c.weaponMod, c.trinket])].filter(Boolean));
    const pool = GEAR_POOL.filter(g => !held.has(g.id));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)].id;
}

function equipGear(charId, gearId) {
    const ch = playerRoster.find(c => c.id === charId);
    const g = gearById(gearId);
    if (!ch || !g) return;
    const idx = gearStash.indexOf(gearId);
    if (idx === -1) return;
    if (g.slot === 'mod' && g.cls !== ch.classType) return;
    const slotKey = g.slot === 'mod' ? 'weaponMod' : 'trinket';
    if (ch[slotKey]) unequipGear(charId, g.slot);
    gearStash.splice(idx, 1);
    ch[slotKey] = g.id;
    if (g.apply) g.apply(ch);
    saveGameState();
}

function unequipGear(charId, slot) {
    const ch = playerRoster.find(c => c.id === charId);
    if (!ch) return;
    const slotKey = slot === 'mod' ? 'weaponMod' : 'trinket';
    const g = gearById(ch[slotKey]);
    if (!g) return;
    if (g.remove) g.remove(ch);
    gearStash.push(g.id);
    ch[slotKey] = null;
    saveGameState();
}

// The formation- and target-reading quirks, resolved where the damage is figured.
function quirkDmgMult(actEnt, target, dist) {
    if (!actEnt || !actEnt.isPlayer || !actEnt.quirk) return 1;
    let m = 1;
    const neighbour = activeEntities.some(e => e.isPlayer && e.hp > 0 && e.id !== actEnt.id &&
        Math.abs(e.gridPos - actEnt.gridPos) === 1);
    if (hasQuirk(actEnt, 'PACK_HUNTER') && neighbour) m *= 1.15;
    if (hasQuirk(actEnt, 'LONER') && !neighbour) m *= 1.2;
    if (hasQuirk(actEnt, 'FIRST_BLOOD') && target && target.hp === target.maxHp) m *= 1.3;
    if (hasQuirk(actEnt, 'CLOSER') && target && target.hp < target.maxHp * 0.3) m *= 1.25;
    if (hasQuirk(actEnt, 'DUELIST') && dist === 0) m *= 1.15;
    return m;
}

// ── Bonds ───────────────────────────────────────────────────────────────────────────────
// Two operators who fight together accumulate a bond, per run. Level I pays +5% damage
// while both stand; at II, once per fight one steps in front of a killing blow aimed at
// the other; at III the pair shares an overdrive discount. Rotating the squad resets
// nothing but costs the pairs their momentum - the tension the muster is built on.
// Over The Top: the Fiend spends his own health for two turns of everything hitting harder.
// Not called frenzy anywhere: FRENZY is already the Psycho's signature and FRENZIED an elite
// affix, and all three would have shown the same word on the same screen.
const FIEND_CHARGE_COST = 0.12;   // share of his max health
const CHARGE_TURNS = 2;
const CHARGE_MULT = 1.5;
// Drag Line hauls a target out of the enemy back line to the front of it, where melee can
// reach it and where the ground rules stop protecting it.
const HAUL_TO = 0;

const BOND_LEVELS = [4, 10, 18];   // fights together for I / II / III
const BOND_NAMES = {
    'BRUISER|MEDIC':        'Meat and Mender',
    'BRUISER|SCAVENGER':    'Crowbar and Lockpick',
    'BRUISER|PYROMANIAC':   'Anvil and Ember',
    'BRUISER|SHOTGUNNER':   'Door and Doorbell',
    'BRUISER|SNIPER':       'Hammer and Whisper',
    'BRUISER|HOUND':        'Bear and Stray',
    'MEDIC|SCAVENGER':      'Salvage and Sutures',
    'MEDIC|PYROMANIAC':     'Burn Ward',
    'MEDIC|SHOTGUNNER':     'Trauma Team',
    'MEDIC|SNIPER':         'Steady Hands',
    'HOUND|MEDIC':          'Stray',
    'PYROMANIAC|SCAVENGER': 'Acid and Accelerant',
    'SCAVENGER|SHOTGUNNER': 'Scrap and Slug',
    'SCAVENGER|SNIPER':     'Magpie and Hawk',
    'HOUND|SCAVENGER':      'Scent of Rust',
    'PYROMANIAC|SHOTGUNNER':'Muzzle Flash',
    'PYROMANIAC|SNIPER':    'Signal Fire',
    'HOUND|PYROMANIAC':     'Singed Fur',
    'SHOTGUNNER|SNIPER':    'Close and Far',
    'HOUND|SHOTGUNNER':     'Point and Flush',
    'HOUND|SNIPER':         'Spotter and Fang',
    // the three found on the road
    'BRUISER|TRENCH_FIEND':    'Two Walls',
    'HAZMAT|TRENCH_FIEND':     'Filter and Fume',
    'HARPOONER|TRENCH_FIEND':  'Hook and Hack',
    'MEDIC|TRENCH_FIEND':      'Wound and Ward',
    'SCAVENGER|TRENCH_FIEND':  'Scrap and Sawdust',
    'PYROMANIAC|TRENCH_FIEND': 'Smoke and Steel',
    'SHOTGUNNER|TRENCH_FIEND': 'Both Doors',
    'SNIPER|TRENCH_FIEND':     'Long and Short of It',
    'HOUND|TRENCH_FIEND':      'Teeth and Teeth',
    'BRUISER|HAZMAT':          'Shield and Seal',
    'HAZMAT|MEDIC':            'Clean Hands',
    'HAZMAT|SCAVENGER':        'Rust and Rinse',
    'HAZMAT|PYROMANIAC':       'Two Kinds of Burn',
    'HAZMAT|SHOTGUNNER':       'Breach and Bleach',
    'HAZMAT|SNIPER':           'Downwind',
    'HAZMAT|HOUND':            'Muzzle and Mask',
    'HARPOONER|HAZMAT':        'Barb and Bile',
    'BRUISER|HARPOONER':       'Drag and Drop',
    'HARPOONER|MEDIC':         'Line and Lifeline',
    'HARPOONER|SCAVENGER':     'Grapple and Grab',
    'HARPOONER|PYROMANIAC':    'Reel and Roast',
    'HARPOONER|SHOTGUNNER':    'Pulled Close',
    'HARPOONER|SNIPER':        'Two Long Guns',
    'HARPOONER|HOUND':         'Leash and Lunge'
};

let bonds = {};                  // pair key -> fights survived together, this run
let bondSavesUsed = new Set();   // pair keys whose step-in is spent this fight

function bondKey(aId, bId) { return [aId, bId].sort().join('|'); }
function bondName(a, b) { return BOND_NAMES[[a.classType, b.classType].sort().join('|')] || 'Comrades'; }
function bondCount(aId, bId) { return bonds[bondKey(aId, bId)] || 0; }
function bondLevel(aId, bId) {
    const c = bondCount(aId, bId);
    return c >= BOND_LEVELS[2] ? 3 : c >= BOND_LEVELS[1] ? 2 : c >= BOND_LEVELS[0] ? 1 : 0;
}
function bondDmgMult(ent) {
    if (!ent || !ent.isPlayer) return 1;
    return activeEntities.some(e => e.isPlayer && e.hp > 0 && e.id !== ent.id && bondLevel(ent.id, e.id) >= 1)
        ? 1.05 : 1;
}
// Who steps in front of a killing blow aimed at t: the strongest standing level-II+ partner
// whose pair has not already spent its save this fight.
function bondSavior(t) {
    if (!t || !t.isPlayer) return null;
    const c = activeEntities
        .filter(e => e.isPlayer && e.hp > 0 && e.id !== t.id && bondLevel(t.id, e.id) >= 2
            && !bondSavesUsed.has(bondKey(t.id, e.id)))
        .sort((a, b) => bondCount(t.id, b.id) - bondCount(t.id, a.id));
    return c[0] || null;
}
function bondOverdriveDiscount() {
    const ps = activeEntities.filter(e => e.isPlayer && e.hp > 0);
    for (let i = 0; i < ps.length; i++)
        for (let j = i + 1; j < ps.length; j++)
            if (bondLevel(ps[i].id, ps[j].id) >= 3) return 10;
    return 0;
}
// Called on victory: every deployed pair fought together, the fallen included - the fight
// still counts for the pair that carried them out.
function recordBonds() {
    const fought = playerRoster.filter(c => c.gridPos > 0);
    for (let i = 0; i < fought.length; i++)
        for (let j = i + 1; j < fought.length; j++) {
            const a = fought[i], b = fought[j];
            const before = bondLevel(a.id, b.id);
            bonds[bondKey(a.id, b.id)] = bondCount(a.id, b.id) + 1;
            const after = bondLevel(a.id, b.id);
            if (after > before) {
                log(`> Bond deepened: ${a.name} & ${b.name} are "${bondName(a, b)}" ${['', 'I', 'II', 'III'][after]}.`, 'log-heal');
                if (after === 3) checkBountyProgress('BOND');
            }
        }
}
// The strongest ties an operator holds, for the roster cards.
function bondLineFor(char) {
    return playerRoster
        .filter(o => o.id !== char.id && bondLevel(char.id, o.id) >= 1)
        .sort((a, b) => bondCount(char.id, b.id) - bondCount(char.id, a.id))
        .slice(0, 2)
        .map(o => `${bondName(char, o)} ${['', 'I', 'II', 'III'][bondLevel(char.id, o.id)]} (${o.name})`)
        .join(' · ');
}

// Perks are repeatable. The percentage ones compound with each pick, which is the player's
// only multiplicative axis against enemies that scale exponentially - see PERK note in
// initiateCombat.
const PERK_POOL = [
    { id: 'VETERAN',   label: 'VETERAN (+5 DMG)',        apply: c => { c.dmgBase += 5; } },
    { id: 'FORTIFIED', label: 'FORTIFIED (+25 HP)',      apply: c => { c.maxHp += 25; c.hp += 25; } },
    { id: 'SWIFT',     label: 'SWIFT (+3 SPD)',          apply: c => { c.speed += 3; } },
    { id: 'HONED',     label: 'HONED (+10% DMG)',        apply: c => { c.dmgBase = Math.ceil(c.dmgBase * 1.1); } },
    { id: 'HARDENED',  label: 'HARDENED (+10% MAX HP)',  apply: c => { const g = Math.ceil(c.maxHp * 0.1); c.maxHp += g; c.hp += g; } }
];

// A commander's passive is stored as an id on its pool entry; this is what that id means.
// The dossier used to read .name and .desc straight off the id string, which are both
// undefined on a string - so every warlord's file carried an empty block headed "Command".
// Four of the seven commanders showed no tag at all on the field. Three of those were not
// missing a mechanic - the Marshal's hound, the Stormcaller's sky and the Bastion's ward are
// each the whole shape of that fight - they were missing the line that says so while you are
// in it. The blurb at the door said it once and then the card said nothing for the rest of the
// fight, which is the one place a player is actually asking.
//
// A passive may carry `state`, which reports live the way a signature's does: a ward that is
// down has to stop claiming to be up, or the tag is worse than no tag.
const BOSS_PASSIVES = {
    PLATING: { name: 'Re-Plating', desc: 'Welds 6 points of armour back on every turn, up to 30 over its base.' },
    FEAST:   { name: 'Feast',      desc: 'Heals itself off a share of every wound it opens.' },
    VENOM:   { name: 'Venom Pump', desc: 'Doses itself every 2 turns: +14% damage and +2 speed each time, but the pressure sloughs 4 armour and opens it to +15% damage taken. Five doses at most.' },
    // The one that was genuinely missing. The others are declarations of what was already there.
    BLOODLETTER: { name: 'Bloodletter', desc: 'Every blow it lands opens a wound. Its hits bleed for 2 turns.' },
    COLUMN:  { name: 'The Column', desc: 'While its hound stands, the Marshal carries 22 more armour and is barely worth shooting at. Kill the hound first.',
               state: ent => bossRetinueUp(ent, 'escortId') ? ' \u2022 HOUND UP' : ' \u2022 ALONE' },
    STORMBRINGER: { name: 'Stormbringer', desc: 'Turns the sky over on its own clock, whatever the forecast promised. Every change lands on both sides of the field.',
                    state: ent => ent.stormTurn ? ` \u2022 ${Math.max(0, ent.stormTurn - (ent.stormClock || 0))} TO TURN` : '' },
    WARDED:  { name: 'Warded', desc: 'A shield it did not build. While the generator stands, everything you land on the Bastion is soaked to a fraction. Kill the generator first.',
               state: ent => bossRetinueUp(ent, 'wardId') ? ' \u2022 WARD UP' : ' \u2022 WARD DOWN' }
};
// Whether the thing a commander is hiding behind is still standing.
function bossRetinueUp(ent, key) {
    return !!(ent && ent[key] && activeEntities.some(e => e.id === ent[key] && e.hp > 0));
}

// One Warlord fought at every depth made the back half of a run repetitive, so each sector
// now draws a different commander. They differ in more than numbers: what they intend to do,
// what they do passively, and what happens when you break them past half health.
const BOSS_POOL = [
    {
        id: 'WARLORD', threat: 1, name: 'Warlord', short: 'WARLORD', img: 'enemy_boss.webp', scale: 2.2,
        range: 'melee', hpMult: 1.0, dmgMult: 1.0, speed: 9, armor: 15,
        resistances: { phys: 10, bio: 5, energy: 5 },
        passive: 'BLOODLETTER',
        blurb: 'A raider chieftain who fights alongside their pack. Everything it swings is serrated.',
        bg: 'bg_thunderdome.webp',
        banner: '\uD83D\uDC80 THUNDERDOME BLOODLUST: All units deal +20% DMG \uD83D\uDC80',
        intents: [['ATTACK', 0.30], ['AOE', 0.20], ['HEAVY', 0.20], ['STATUS', 0.20], ['DEFEND', 0.10]],
        enrage: { cry: 'WARLORD ENRAGED - THE PACK ANSWERS!', dmgScale: 1.5,
                  summon: { name: 'War Hound', classType: 'BEAST', range: 'melee', hp: 30, dmg: 12, speed: 18,
                            img: 'enemy_dog.webp', scale: 0.8, resistances: { phys: -2, bio: 0, energy: 0 } },
                  summonCount: 2 },
        // It learned what killing its pack costs you, and started charging for it.
        grudge: { cry: 'BLOOD DEBT - THE PACK FEEDS IT!', name: 'BLOOD DEBT',
                  tell: 'Every hostile that dies now heals it.', bloodDebt: 0.12 }
    },
    {
        id: 'COLOSSUS', threat: 2, name: 'Siege Colossus', short: 'COLOSSUS', img: 'enemy_boss_mech.webp', scale: 2.4,
        range: 'ranged', hpMult: 1.3, dmgMult: 0.8, speed: 5, armor: 30,
        resistances: { phys: 18, bio: 100, energy: -15 },
        passive: 'PLATING',
        blurb: 'A walking battery. Immune to toxins, and it re-plates itself between salvoes.',
        bg: 'bg_foundry.webp',
        banner: '\uD83D\uDD25 FOUNDRY HEAT: All units deal +20% DMG \uD83D\uDD25',
        intents: [['AOE', 0.35], ['ATTACK', 0.30], ['DEFEND', 0.20], ['HEAVY', 0.15]],
        // Last time you out-lasted the salvoes. It stopped spacing them out.
        grudge: { cry: 'OVERLOAD - BATTERIES CHARGING', name: 'OVERLOAD',
                  tell: 'Charges a turn, then fires on the whole line.', charge: { turns: 1, mult: 1.1 } },
        enrage: { cry: 'SIEGE PROTOCOL ENGAGED - ALL BATTERIES', dmgScale: 1.15, armorBonus: 20, forceAoe: true,
                  summon: { name: 'Sentry Drone', classType: 'DRONE', range: 'ranged', hp: 25, dmg: 8, speed: 18,
                            img: 'enemy_drone.webp', scale: 0.7, isHovering: true,
                            resistances: { phys: 8, bio: 100, energy: -10 } },
                  summonCount: 2 }
    },
    {
        id: 'MATRIARCH', threat: 1, name: 'Carrion Matriarch', short: 'MATRIARCH', img: 'enemy_boss_vulture.webp', scale: 2.1,
        range: 'melee', hpMult: 0.85, dmgMult: 1.1, speed: 17, armor: 5,
        resistances: { phys: -6, bio: 40, energy: 5 },
        dmgType: 'bio', passive: 'FEAST', sink: 16,
        blurb: 'Fast, diseased, and it grows stronger off every wound it opens.',
        bg: 'bg_nest.webp',
        banner: '\u2620\uFE0F CARRION REEK: All units deal +20% DMG \u2620\uFE0F',
        intents: [['STATUS', 0.35], ['HEAVY', 0.25], ['ATTACK', 0.25], ['AOE', 0.15]],
        enrage: { cry: 'THE MATRIARCH SHRIEKS - PLAGUE WIND!', dmgScale: 1.25, speedBonus: 4, plague: true },
        // You killed her once. This time she does not intend to be the last of them.
        grudge: { cry: 'SHE IS LAYING - THE NEST ANSWERS!', name: 'SPAWNING',
                  tell: 'Lays another of them every other turn.',
                  spawn: { every: 2, name: 'Carrion Brood', classType: 'BEAST', range: 'melee',
                           hp: 26, dmg: 11, speed: 15, img: 'enemy_boss_vulture.webp', scale: 0.75,
                           resistances: { phys: -4, bio: 40, energy: 0 } } }
    },
    // Four more, so a deep run stops meeting the same three in the same order. Each carries a
    // mechanic rather than a different set of intent weights: something the squad has to answer
    // rather than simply out-damage.
    {
        id: 'VATBORN', threat: 2, name: 'The Vatborn', short: 'VATBORN', img: 'enemy_boss_vatborn.webp', scale: 2.2,
        range: 'melee', hpMult: 1.15, dmgMult: 0.82, speed: 8, armor: 16,
        resistances: { phys: 5, bio: 60, energy: -10 },
        dmgType: 'bio', passive: 'VENOM',
        blurb: 'Slab-armoured and slow, until it starts pumping. Every dose buys it strength and costs it skin.',
        bg: 'bg_nest.webp',
        banner: '\u{1F9EA} VAT REEK: All units deal +20% DMG \u{1F9EA}',
        intents: [['ATTACK', 0.35], ['HEAVY', 0.30], ['STATUS', 0.20], ['AOE', 0.15]],
        // The pump is a trade it makes against itself, and the whole fight is a question of
        // timing: chip a wall early, or hold the burst until the tubes are wide open and it is
        // hitting hard enough to matter.
        venom: { every: 2, dmg: 0.14, speed: 2, armorLoss: 4, taken: 0.15, max: 5 },
        // No damage step at the enrage: the two doses it takes are the enrage.
        enrage: { cry: 'THE VATBORN CRANKS THE TANK WIDE OPEN!', venomBurst: 2,
                  backbreaker: { mult: 1.5, stun: 1 } },
        // The tank goes past wide open. It is not trying to survive this one.
        grudge: { cry: 'THE TANK RUPTURES - IT IS VENTING!', name: 'RUPTURE',
                  tell: 'Bleeds toxin over the front rank every turn.',
                  venomBurst: 9, aura: { share: 0.06, type: 'bio', rank: 1 } }
    },
    {
        id: 'MARSHAL', threat: 3, name: 'The Marshal', short: 'MARSHAL', img: 'enemy_boss_marshal.webp', scale: 2.2,
        range: 'ranged', hpMult: 1.0, dmgMult: 1.15, speed: 11, armor: 10,
        resistances: { phys: 8, bio: 0, energy: 8 },
        passive: 'COLUMN',
        blurb: 'Never walks the line alone. While the hound Bulldog stands, the Marshal is barely worth shooting at.',
        bg: 'bg_thunderdome.webp',
        banner: '\u{1F6E1} MARSHAL\u2019S COLUMN: All units deal +20% DMG \u{1F6E1}',
        intents: [['ATTACK', 0.40], ['STATUS', 0.25], ['HEAVY', 0.20], ['DEFEND', 0.15]],
        // The lieutenant is the fight: kill Bulldog or spend the whole fight chipping plate.
        escort: { name: 'Bulldog', classType: 'BEAST', range: 'melee', hp: 66, dmg: 18, speed: 16,
                  img: 'enemy_hound_bulldog.webp', scale: 1.5, armor: 5, sig: 'RIOT_PLATE',
                  resistances: { phys: 10, bio: 0, energy: -5 } },
        escortArmor: 22,
        enrage: { cry: 'THE MARSHAL CALLS THE COLUMN IN!', dmgScale: 1.3, speedBonus: 3 },
        // You went through the hound to get to it. It brought a second hound.
        grudge: { cry: 'THE COLUMN ARRIVES - ANOTHER HOUND!', name: 'THE COLUMN',
                  tell: 'A fresh hound off the wagon, and the plate goes back up.',
                  reEscort: true, armorBonus: 14 }
    },
    {
        id: 'STORMCALLER', threat: 2, name: 'The Stormcaller', short: 'STORM', img: 'enemy_boss_stormcaller.webp', scale: 2.3,
        range: 'ranged', hpMult: 1.05, dmgMult: 0.9, speed: 13, armor: 12,
        resistances: { phys: 0, bio: 10, energy: 25 },
        dmgType: 'energy', passive: 'STORMBRINGER',
        blurb: 'Fights with the sky. Whatever the forecast said, it will not stay true.',
        bg: 'bg_thunderdome.webp',
        banner: '\u26A1 THE SKY TURNS: All units deal +20% DMG \u26A1',
        intents: [['AOE', 0.30], ['ATTACK', 0.30], ['STATUS', 0.25], ['HEAVY', 0.15]],
        // Every third turn the weather changes under everyone, squad and warlord alike.
        stormTurn: 3,
        enrage: { cry: 'THE STORMCALLER OPENS THE SKY!', dmgScale: 1.2, speedBonus: 2 },
        // It waited out your last squad. It is not waiting for this one.
        grudge: { cry: 'THE SKY BREAKS - IT WILL NOT HOLD!', name: 'THE SKY BREAKS',
                  tell: 'The weather turns every turn, and every turn of it hurts.',
                  stormTurn: 1, skyToll: 0.05 }
    },
    {
        id: 'BASTION', threat: 3, name: 'The Bastion', short: 'BASTION', img: 'enemy_boss_bastion.webp', scale: 2.25,
        range: 'ranged', hpMult: 1.45, dmgMult: 0.85, speed: 4, armor: 25,
        resistances: { phys: 20, bio: 100, energy: -10 },
        passive: 'WARDED',
        blurb: 'A fortress on legs behind a shield it did not build. Kill the generator first.',
        bg: 'bg_foundry.webp',
        banner: '\u{1F6A7} BASTION WARD: All units deal +20% DMG \u{1F6A7}',
        intents: [['DEFEND', 0.30], ['AOE', 0.30], ['ATTACK', 0.25], ['HEAVY', 0.15]],
        // Warded to near-invulnerability until the generator standing beside it is destroyed.
        ward: { name: 'Ward Generator', classType: 'MECH', range: 'ranged', hp: 55, dmg: 6, speed: 3,
                img: 'enemy_turret.webp', scale: 1.2, armor: 6,
                resistances: { phys: 5, bio: 100, energy: -20 } },
        wardSoak: 0.12,
        enrage: { cry: 'BASTION WARD COLLAPSING - FULL BATTERIES!', dmgScale: 1.35, forceAoe: true },
        // The generator you shot out was the spare.
        grudge: { cry: 'SECONDARY WARD ONLINE - IT BROUGHT TWO!', name: 'SECOND WARD',
                  tell: 'A second generator drops in, and the soak comes back with it.',
                  reWard: true }
    }
];

// ── The grudge ──────────────────────────────────────────────────────────────────────────
// A commander you have killed does not forget it. Every warlord felled is written down against
// its name and kept across expeditions, and the next time that one is drawn it comes back
// heavier, faster and holding something it did not use the first time: a third phase that only
// opens for somebody it already lost to.
//
// The point is not that it is harder. It is that the meta has an enemy in it - felling the
// Marshal is a thing that happened to you both, and the version that turns up in your next run
// is the version you made.
const GRUDGE = {
    hp: 0.20,        // per grudge, compounding with the sector scale it already carries
    dmg: 0.12,
    armor: 4,
    speed: 1,
    cap: 3,          // beyond this it stops growing; a wall you cannot pass is not a nemesis
    phaseAt: 0.25    // the grudge phase opens under a quarter health, below the ordinary enrage
};
const RISEN_MARK = ['', 'Risen', 'Twice-Risen', 'Thrice-Risen'];
let grudges = {};    // bossId -> times you have put it down, meta-persisted

function grudgeOn(id) { return Math.min(GRUDGE.cap, grudges[id] || 0); }
function noteGrudge(id) { if (id) grudges[id] = (grudges[id] || 0) + 1; }
function risenName(b, g) { return g > 0 ? `${b.name}, ${RISEN_MARK[g] || `Risen ×${g}`}` : b.name; }
// What the map promises before you take the node, so a re-match is a routing decision.
function risenShort(b, g) { return g > 0 ? `${b.short} †${g}` : b.short; }

// Rotates by sector so a run meets a different commander each time rather than the same one
// ten times over.
// The rotation used to be sector modulo three: every warlord seen by sector 3, then the same
// order forever. Each run now walks a shuffled order, reshuffling per cycle and never opening
// a cycle with the commander that closed the last one - so no warlord is met twice running.
// Seeded, so a daily protocol deals everyone the same sequence.
let bossSalt = 'w0';
// How much work a commander is, beyond its raw numbers: 1 is a straight fight, 2 carries a
// mechanic that reshapes the field, 3 arrives with a retinue you have to kill through first.
// A flat shuffle treated all seven as interchangeable, so a first-ever commander was as likely
// to be the Bastion - 406 HP behind a ward that soaks it to 12% until its generator falls - as
// the Warlord's 280 HP behind fifteen armour. Same sector, twice the fight.
// Swept against the threat mix per sector: at 5.0 the opening sector runs roughly 64% light,
// 32% mid, 4% heavy, and by sector 4 the draw is indistinguishable from uniform. Lower values
// turn the bias into a gate - at 2.0 sector 1 was 91% the same two commanders.
const BOSS_THREAT_JITTER = 5.0;
function bossOrder(cycle) {
    // Seeded directly rather than through seededRng, which falls back to Math.random when no
    // daily seed is set - the order has to be stable across every call in a run, or the map
    // would advertise one warlord and the fight would deliver another.
    const rng = mulberry32(seedFromString(`boss:${runSeed || bossSalt}:${cycle}`));
    const idx = BOSS_POOL.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    // The first cycle - a run's first seven sectors, which is every run most people finish -
    // is then sorted by threat plus enough jitter that the order is still a surprise. A heavy
    // commander can still open a run, it is just no longer as likely as a light one. Later
    // cycles keep the flat shuffle: by sector 8 the squad has earned the whole roster.
    if (cycle === 0) {
        const key = new Map(idx.map(i => [i, (BOSS_POOL[i].threat || 2) + rng() * BOSS_THREAT_JITTER]));
        idx.sort((a, b) => key.get(a) - key.get(b));
    }
    if (cycle > 0) {
        const prev = bossOrder(cycle - 1);
        const last = prev[prev.length - 1];
        if (idx[0] === last && idx.length > 1) { [idx[0], idx[1]] = [idx[1], idx[0]]; }
    }
    return idx;
}
function bossForSector(sector = currentSector) {
    const i = Math.max(1, sector) - 1;
    const n = BOSS_POOL.length;
    return BOSS_POOL[bossOrder(Math.floor(i / n))[i % n]];
}

// Four relics and one elite node per sector meant the whole pool was owned by sector four and
// every elite fight after that dropped nothing. Fourteen now, in two tiers: commons are the
// steady multipliers, rares hook into the systems the squad actually plays around.
const RELIC_POOL = [
    { id: 'SCRAP_MAGNET',      tier: 'COMMON', name: "Scrap Magnet",      desc: "Gain +15 Scrap after every combat." },
    { id: 'THERMAL_CORE',      tier: 'COMMON', name: "Thermal Core",      desc: "Energy attacks deal +30% DMG." },
    { id: 'BLOOD_VIAL',        tier: 'COMMON', name: "Blood Vial",        desc: "Bio attacks heal the attacker 5 HP." },
    { id: 'KINETIC_MESH',      tier: 'COMMON', name: "Kinetic Mesh",      desc: "The front rank takes -25% Physical DMG." },
    { id: 'WHETSTONE',         tier: 'COMMON', name: "Whetstone",         desc: "Melee abilities deal +20% DMG." },
    { id: 'RANGEFINDER',       tier: 'COMMON', name: "Rangefinder",       desc: "Ranged abilities deal +15% DMG." },
    { id: 'FIELD_DRESSING',    tier: 'COMMON', name: "Field Dressing",    desc: "Bleeding on your squad deals half damage." },
    { id: 'SALVAGE_RIG',       tier: 'COMMON', name: "Salvage Rig",       desc: "Salvage one extra material after every combat." },
    { id: 'VULTURES_INSTINCT', tier: 'RARE',   name: "Vulture's Instinct", desc: "Combos deal +25% DMG." },
    { id: 'CHEM_ETCHER',       tier: 'RARE',   name: "Chem Etcher",       desc: "Corroded targets take +25% DMG from everything." },
    { id: 'AMMO_HOIST',        tier: 'RARE',   name: "Ammo Hoist",        desc: "Ability cooldowns are one turn shorter." },
    { id: 'BULWARK_PLATING',   tier: 'RARE',   name: "Bulwark Plating",   desc: "A covered hit lands for 35% instead of 60%." },
    { id: 'SIGNAL_JAMMER',     tier: 'RARE',   name: "Signal Jammer",     desc: "Enemies never flank your line." },
    { id: 'OVERCHARGED_CELL',  tier: 'RARE',   name: "Overcharged Cell",  desc: "Overdrive charges at 80% momentum." },
    // The pool learns to bite: real upsides with real teeth, marked unmistakably in the cache.
    // Cursed relics are never dealt at random - they arrive only as a cache decision or a
    // collector's gamble, so every one aboard was chosen.
    { id: 'GLASS_CANNON_CORE',  tier: 'CURSED', name: "Glass Cannon Core",  desc: "All damage dealt +40% — but the squad deploys at 85% health, every fight." },
    { id: 'SCAVENGERS_DEBT',    tier: 'CURSED', name: "Scavenger's Debt",   desc: "+40 Scrap after every fight — but the collector takes 500 at each warlord." },
    { id: 'LEAD_LINED_COAT',    tier: 'CURSED', name: "Lead-Lined Coat",    desc: "The squad takes -20% damage — but moves 3 SPD slower in the turn order." },
    { id: 'HUNGRY_BLADE',       tier: 'CURSED', name: "Hungry Blade",       desc: "Melee hits feed the attacker 6 HP — but everything that is not melee deals -15%." },
    { id: 'VULTURE_ROYALTY',    tier: 'CURSED', name: "Vulture Royalty",    desc: "Elites always drop gear — but every victory pays -25% Scrap." },
    { id: 'OVERCLOCKED_REACTOR',tier: 'CURSED', name: "Overclocked Reactor",desc: "Overdrive threshold -20 — but each overdrive vents 10 HP through your front rank." }
];

// Three pairs upgrade each other when both halves ride together.
const RELIC_SETS = [
    { a: 'THERMAL_CORE', b: 'OVERCHARGED_CELL', name: 'Reactor Rig',   desc: 'Thermal Core burns at +50%.' },
    { a: 'WHETSTONE',    b: 'RANGEFINDER',      name: 'Full Arsenal',  desc: 'Whetstone +30%, Rangefinder +25%.' },
    { a: 'BLOOD_VIAL',   b: 'FIELD_DRESSING',   name: 'Field Surgery', desc: 'Blood Vial heals 10, and squad bleeds never last past 1 turn.' }
];
function relicSetActive(name) {
    const s = RELIC_SETS.find(x => x.name === name);
    return !!s && hasRelic(s.a) && hasRelic(s.b);
}
// Called wherever a relic is gained: a completed pair announces itself exactly once per run.
function announceSets() {
    if (!runStats) return;
    if (!Array.isArray(runStats.setsAnnounced)) runStats.setsAnnounced = [];
    RELIC_SETS.forEach(s => {
        if (relicSetActive(s.name) && !runStats.setsAnnounced.includes(s.name)) {
            runStats.setsAnnounced.push(s.name);
            log(`> SET COMPLETE — ${s.name}: ${s.desc}`, 'log-combo');
        }
    });
}
// A run deep enough to own the whole pool still gets paid for the fight, on the same curve as
// every other reward - a flat figure would be worth nothing by the depth it starts appearing at.
const EMPTY_POOL_SCRAP = 150;
function emptyPoolScrap() { return Math.floor(EMPTY_POOL_SCRAP * sectorRewardMult()); }
const OVERDRIVE_AT = 100;
const OVERDRIVE_AT_CHARGED = 80;

function hasRelic(id) { return activeRelics.some(r => r.id === id); }
function overdriveAt() {
    const base = (hasRelic('OVERCHARGED_CELL') ? OVERDRIVE_AT_CHARGED : OVERDRIVE_AT)
        - bondOverdriveDiscount() - (hasRelic('OVERCLOCKED_REACTOR') ? 20 : 0);
    return Math.max(40, base);
}
function unownedRelics(tier) {
    return RELIC_POOL.filter(r => !hasRelic(r.id) && (!tier || r.tier === tier));
}

// An elite drops one, leaning common; a rare is the thing worth hoping for rather than the norm.
function rollRelic(rareChance = 0.3) {
    const wantRare = Math.random() < rareChance;
    const first = unownedRelics(wantRare ? 'RARE' : 'COMMON');
    // The fallback never deals a curse: those arrive only by choice.
    const pool = first.length ? first : unownedRelics().filter(r => r.tier !== 'CURSED');
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

// A commander is worth a real decision, so it offers three rather than handing over one.
function rollRelicOffer(count = 3) {
    const rares = unownedRelics('RARE'), commons = unownedRelics('COMMON');
    const shuffle = a => [...a].sort(() => Math.random() - 0.5);
    const offer = [...shuffle(rares).slice(0, 1), ...shuffle(commons)];
    const seen = new Set(); const out = [];
    for (const r of [...offer, ...shuffle(rares)]) {
        if (seen.has(r.id)) continue; seen.add(r.id); out.push(r);
        if (out.length === count) break;
    }
    // Sometimes one card on the table is cursed - marked unmistakably, never forced.
    const cursed = unownedRelics('CURSED');
    if (cursed.length && out.length && Math.random() < 0.35)
        out[out.length - 1] = cursed[Math.floor(Math.random() * cursed.length)];
    return out;
}

// ── The sector map ──────────────────────────────────────────────────────────────────────
// The map used to be one hard-coded ladder, identical every sector of every run - ten rows,
// pick a node per row, with nothing downstream caring which. Each sector now generates a
// route graph instead: taking a node commits you to the paths it connects to, so the map is
// a plan with two or three tiers of lookahead rather than a series of coin flips.
const TOTAL_TIERS = 10;
const MAP_COL_X = [18, 50, 82];   // percent across the viewport, up to three abreast
const MAP_ROW_H = 96;             // px per tier row in the rendered graph
const ELITE_TIERS = [5, 6, 7, 8, 9];
const WEATHER_DOTS = { TOXIC_SMOG: 'wx-smog', SANDSTORM: 'wx-sand', SHRAPNEL_WINDS: 'wx-shrap' };

// ── Ground ──────────────────────────────────────────────────────────────────────────────
// Every fight was staged on the same rectangle. The backdrops already varied by faction and
// already meant nothing: a canyon and a refinery floor played identically. Ground bends rules
// the engine already runs - reach, area attacks, who the enemy can see past your front rank -
// rather than adding a new system on top of them, and it is forecast on the map like weather
// so routing around it is a decision made before the node is entered.
//
//   reachFree  melee ignores rank and depth penalties entirely
//   reach      a flat multiplier on every melee swing, however well positioned
//   ranged     a flat multiplier on every ranged attack, both sides
//   aoe        a multiplier on anything that lands on more than one body
//   frontCover whoever stands in the front rank takes less, whichever side they are on
//   backline   how much harder the enemy leans past your front rank when it picks a target
const TERRAIN = {
    OPEN_ROAD:  { name: 'OPEN ROAD', short: 'ROAD', dot: 'tr-road',
                  desc: 'Cracked asphalt and clear sightlines. Nothing to use, nothing in the way.',
                  banner: '' },
    TUNNELS:    { name: 'TUNNELS', short: 'TUNNELS', dot: 'tr-tunnel',
                  desc: 'A service tunnel two ranks wide. Everything is within arm\u2019s reach, there are no firing lanes, and there is nowhere to be when something goes off.',
                  reachFree: true, ranged: 0.85, aoe: 1.3,
                  banner: '\u26CF TUNNELS: melee ignores reach, ranged -15%, area attacks +30% \u26CF' },
    OPEN_FLATS: { name: 'OPEN FLATS', short: 'FLATS', dot: 'tr-flats',
                  desc: 'A hundred metres of hardpan. Rifles own it, and anything carrying a blade has to walk it.',
                  ranged: 1.15, reach: 0.8, backline: 2,
                  banner: '\u25B3 OPEN FLATS: ranged +15%, melee -20%, your back rank is exposed \u25B3' },
    RUINS:      { name: 'RUINS', short: 'RUINS', dot: 'tr-ruins',
                  desc: 'Broken concrete in every direction. The front rank has something to stand behind, a blast has somewhere to stop, and nobody has a clean line at anything.',
                  frontCover: 0.8, ranged: 0.9, aoe: 0.75,
                  banner: '\u25A6 RUINS: front rank -20%, ranged -10%, area attacks -25% \u25A6' }
};
const TERRAIN_IDS = Object.keys(TERRAIN);
// Ground is the place rather than an event, so it is commoner than weather's 0.4 - about half
// the fights in a sector are on something that bends a rule.
const GROUND_CHANCE = 0.5;
let currentTerrain = 'OPEN_ROAD'; let forecastTerrain = null;
// One accessor, so nothing has to remember that an unknown id means "the plain one".
function ground() { return TERRAIN[currentTerrain] || TERRAIN.OPEN_ROAD; }
function terrainName(id) { return (TERRAIN[id] || TERRAIN.OPEN_ROAD).name; }


let sectorMap = null; let currentNodeId = null; let clearedNodeIds = []; let forecastWeather = null;

// The factions the roads can draw from. These used to be enumerated by hand in five places -
// the weather forecast, two map validators, the node whitelist and the backdrop switch - so a
// fourth could not be added without finding all five of them first.
const FACTIONS = {
    RAIDERS: { bg: 'bg_highway.webp',  weather: 'SHRAPNEL_WINDS', ground: ['OPEN_FLATS', 'RUINS'], allies: ['MECH', 'BEASTS'] },
    BEASTS:  { bg: 'bg_canyon.webp',   weather: 'SANDSTORM',      ground: ['TUNNELS', 'OPEN_FLATS'], allies: [] },
    MECH:    { bg: 'bg_refinery.webp', weather: 'TOXIC_SMOG',     ground: ['RUINS', 'TUNNELS'], allies: [] },
    // Irradiated cultists: the first enemies in the game that spend a turn on each other
    // rather than on you. Standing next to one is what makes the rest dangerous.
    CHOIR:   { bg: 'bg_refinery.webp', weather: 'TOXIC_SMOG',     ground: ['TUNNELS', 'RUINS'], allies: ['BEASTS'], minSector: 2 },
    // A swarm. Each one is trivial and the pile is not, and the answer is to spread damage
    // across it rather than pick them off one at a time.
    CARRION: { bg: 'bg_canyon.webp',   weather: 'SANDSTORM',      ground: ['TUNNELS', 'RUINS'], allies: [],         minSector: 2, swarm: 2, heavyCap: 2 }
};
const FIGHT_NODES = Object.keys(FACTIONS);
function factionsAt(sector) { return FIGHT_NODES.filter(f => (FACTIONS[f].minSector || 1) <= sector); }

function rollNodeFaction(tier, rng) {
    const biased = frontFactionBias(tier, rng);
    if (biased) return biased;
    if (tier < 3) return rng() < 0.55 ? 'RAIDERS' : 'BEASTS';
    // The Choir and the Carrion are not what the wasteland shows you first: sector 1 stays the
    // three factions a new squad has tools for, and the roads widen from sector 2.
    const open = factionsAt(currentSector || 1);
    const r = rng();
    if (open.length <= 3) return r < 0.4 ? 'RAIDERS' : r < 0.7 ? 'BEASTS' : 'MECH';
    return r < 0.26 ? 'RAIDERS' : r < 0.50 ? 'BEASTS' : r < 0.70 ? 'MECH' : r < 0.86 ? 'CHOIR' : 'CARRION';
}

// What the generator promises, and validateSectorMap checks: exactly two elite fights at
// different depths, never forced (every parent of an elite has another child to offer);
// at least one camp and one event; every node leads somewhere; every route reaches the
// commander. The bounty board's 'defeat 2 elites' contract depends on the elite count.
// ── The seeded generation channel ───────────────────────────────────────────────────────
// A run can carry a seed. Everything the wasteland GENERATES - maps, fronts, quirk draws,
// the bounty slate - draws from streams derived from that seed, one stream per purpose, so
// two players on the same seed walk the same wasteland however differently they play it.
// Combat stays on Math.random: the fights are live. So do rerolls - those are yours.
function mulberry32(a) {
    return function() {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function seedFromString(s) {
    let h = 2166136261;
    for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
let runSeed = null;   // null = a free run on live dice
// One derived stream per purpose and sector, so no purpose can desync another by
// drawing more, and sector 4 is the same sector 4 however the first three went.
function seededRng(purpose) {
    return runSeed ? mulberry32(seedFromString(`${runSeed}|${purpose}`)) : Math.random;
}
function dailySeed(d = new Date()) { return `DAILY-${d.toISOString().slice(0, 10)}`; }

// Best score per seed, kept outside the run save so the daily has a line to beat.
const SEED_BEST_KEY = 'wp_seed_best';
function seedBests() {
    const v = Store.getJSON(SEED_BEST_KEY);
    return (v && v !== CORRUPT) ? v : {};
}
function noteSeedBest(seed, score) {
    if (!seed) return null;
    const all = seedBests();
    const prev = all[seed] || 0;
    if (score > prev) {
        all[seed] = score;
        const keys = Object.keys(all);
        if (keys.length > 20) keys.sort().slice(0, keys.length - 20).forEach(k => delete all[k]);
        Store.set(SEED_BEST_KEY, JSON.stringify(all));
    }
    return prev;
}

// ── Ascension protocols ─────────────────────────────────────────────────────────────────
// The ladder after the game is beaten in the ordinary sense: named tiers unlocked by real
// depth milestones, each stacking a permanent twist, with a score multiplier above what
// contracts give. Level N applies every twist up to N.
const PROTOCOLS = [
    { name: 'PROTOCOL: IRONSIDE', gate: 3, mult: 1.15, desc: 'Every elite arrives affixed.' },
    { name: 'PROTOCOL: BLOODRITE', gate: 5, mult: 1.3, desc: 'Warlords enrage at 60% health.' },
    { name: 'PROTOCOL: BLACKOUT', gate: 8, mult: 1.5, desc: 'Heavy hitters hide their intent.' }
];
let ascension = 0;   // the chosen rung, 0..unlockedProtocols(), persisted with the run
function unlockedProtocols() { return PROTOCOLS.filter(p => bestSector >= p.gate).length; }
function protocolMult() { return ascension > 0 ? PROTOCOLS[Math.min(ascension, PROTOCOLS.length) - 1].mult : 1; }
function protocolName() { return ascension > 0 ? PROTOCOLS[Math.min(ascension, PROTOCOLS.length) - 1].name : null; }

// ── Sector fronts ───────────────────────────────────────────────────────────────────────
// Every sector rolls a front: a condition that tilts what the generator builds, what the
// weather does, what falls as loot, and what the boss brings. "Sector 3 was a blood moon"
// becomes a sentence a player says about a run.
const FRONTS = [
    { id: 'RAIDER_WARBAND',   name: 'Raider Warband',   icon: '☠',
      desc: 'Raider-heavy roads. Their elites hit a quarter harder; their loot pays double.' },
    { id: 'MACHINE_UPRISING', name: 'Machine Uprising', icon: '⚙',
      desc: 'The machines are walking. Mech-heavy roads past the shallows, and tech falls in pairs.' },
    { id: 'BLOOD_MOON',       name: 'Blood Moon',       icon: '◖',
      desc: 'Beasts everywhere, and every wound wants to bleed.' },
    { id: 'IRRADIATED',       name: 'Irradiated',       icon: '☢',
      desc: 'Smog hangs over most roads, and the boss fights under it. Chems fall in pairs.' },
    { id: 'QUIET_ROADS',      name: 'Quiet Roads',      icon: '~',
      desc: 'Fewer fights, more strange encounters, leaner XP - and a boss hoarding double scrap.' },
    { id: 'THE_CHOIR',        name: 'The Choir',        icon: '\u2670', minSector: 2,
      desc: 'Something is being sung out there. Cultists on half the roads, and the smog follows them.' },
    { id: 'CARRION_BLOOM',    name: 'Carrion Bloom',    icon: '\u2042', minSector: 2,
      desc: 'Something large died, and everything came. Swarms on half the roads, and they come in numbers.' }
];
let sectorFront = null;        // rolled per sector; null on saves from before fronts existed
let frontBannerPending = false;

function frontById(id) { return FRONTS.find(f => f.id === id) || null; }
function currentFront() { return frontById(sectorFront); }
function rollFront(rng = Math.random, sector = currentSector) {
    // Two of the fronts promise a faction the roads only carry from sector 2, so they are not
    // in the deck before then - a front whose whole description is a lie is worse than no front.
    const deck = FRONTS.filter(f => (f.minSector || 1) <= Math.max(1, sector || 1));
    return deck[Math.floor(rng() * deck.length)].id;
}
// The generation tilt: half of everything on the roads is the front's own faction. The
// machines stay out of the first two tiers, same as the base table.
function frontFactionBias(tier, rng) {
    const bias = { RAIDER_WARBAND: 'RAIDERS', MACHINE_UPRISING: 'MECH', BLOOD_MOON: 'BEASTS',
                   THE_CHOIR: 'CHOIR', CARRION_BLOOM: 'CARRION' }[sectorFront];
    if (!bias) return null;
    // The shallow tiers stay on the stock a new squad has answers for, and a faction the
    // sector cannot field yet is never biased toward.
    if (tier < 3 && bias !== 'RAIDERS' && bias !== 'BEASTS') return null;
    if (!factionsAt(currentSector || 1).includes(bias)) return null;
    return rng() < 0.5 ? bias : null;
}

function generateSectorMap(rng = Math.random) {
    const byTier = [];
    const nodes = [];
    for (let t = 1; t <= TOTAL_TIERS; t++) {
        const width = t === TOTAL_TIERS ? 1 : (t === 1 ? 2 : (rng() < 0.6 ? 3 : 2));
        const cols = width === 1 ? [1] : width === 2 ? [0, 2] : [0, 1, 2];
        const tierNodes = cols.map(c => ({
            id: `n${t}_${c}`, tier: t, col: c,
            type: t === TOTAL_TIERS ? 'BOSS' : rollNodeFaction(t, rng),
            elite: false, weather: 'CLEAR', terrain: 'OPEN_ROAD', edges: []
        }));
        byTier.push(tierNodes); nodes.push(...tierNodes);
    }

    // Proportional windows keep edges from crossing; the extensions add the forks that make
    // routing a real decision instead of a corridor.
    for (let t = 0; t < TOTAL_TIERS - 1; t++) {
        const a = byTier[t], b = byTier[t + 1];
        a.forEach((src, i) => {
            const lo = Math.floor(i * b.length / a.length);
            const hi = Math.max(lo, Math.ceil((i + 1) * b.length / a.length) - 1);
            for (let j = lo; j <= hi; j++) src.edges.push(b[j].id);
            if (hi + 1 < b.length && rng() < 0.5) src.edges.push(b[hi + 1].id);
        });
    }

    const parentsOf = n => nodes.filter(p => p.edges.includes(n.id));

    // Elites are placed before camps and events so nothing overwrites them.
    const eliteTiers = [...ELITE_TIERS].sort(() => rng() - 0.5).slice(0, 2);
    eliteTiers.forEach(t => {
        const tierNodes = byTier[t - 1];
        const candidates = tierNodes.filter(n => parentsOf(n).every(p => p.edges.length >= 2));
        const pool = candidates.length ? candidates : tierNodes;
        const pick = pool[Math.floor(rng() * pool.length)];
        pick.elite = true;
        // Never forced: a parent whose only child is the elite gets an edge to a sibling too.
        parentsOf(pick).forEach(p => {
            if (p.edges.length < 2) {
                const sibling = tierNodes.find(n => n.id !== pick.id);
                if (sibling) p.edges.push(sibling.id);
            }
        });
    });

    const swapOne = (type, tierLo, tierHi) => {
        const pool = nodes.filter(n => !n.elite && n.type !== 'BOSS' && n.type !== 'CAMP' && n.type !== 'EVENT'
            && n.type !== 'SHOP' && n.type !== 'RECRUIT' && n.tier > 1 && n.tier >= tierLo && n.tier <= tierHi);
        if (pool.length) pool[Math.floor(rng() * pool.length)].type = type;
    };
    swapOne('CAMP', 4, 7);
    if (rng() < 0.4) swapOne('CAMP', 2, 9);
    swapOne('EVENT', 2, 8);
    if (rng() < 0.35) swapOne('EVENT', 2, 8);
    if (rng() < 0.35) swapOne('EVENT', 2, 8);
    // The Armory is uncommon on purpose: a shop on most maps but not all, so finding one on
    // the route ahead is a reason to steer, not a fixture to tick off.
    if (rng() < 0.65) swapOne('SHOP', 3, 9);
    // Someone worth signing on, if there is anyone left out there to sign. Rarer than the
    // Armory: three exist in a whole run, and a route that passes one is worth steering for.
    if (recruitables().length && rng() < 0.55) swapOne('RECRUIT', 2, 9);
    // Quiet Roads trades two more fights away for strange encounters.
    if (sectorFront === 'QUIET_ROADS') { swapOne('EVENT', 2, 9); swapOne('EVENT', 2, 9); }

    // The forecast is a contract: the weather a node shows is the weather its fight gets.
    nodes.forEach(n => {
        if (n.type === 'BOSS') n.weather = 'BLOODLUST';
        else if (FIGHT_NODES.includes(n.type)) {
            if (currentSector === 1 && n.tier === 1) n.weather = 'CLEAR';
            else if (sectorFront === 'IRRADIATED' && rng() < 0.7) n.weather = 'TOXIC_SMOG';
            else if (rng() < 0.4) n.weather = FACTIONS[n.type].weather;
        }
        // Ground follows the place, so a refinery reliably fights like a refinery. The opening
        // node is plain for the same reason its sky is: nothing new in the first fight. A
        // commander's arena stays plain too - the commander is the variable there.
        if (FIGHT_NODES.includes(n.type) && !(currentSector === 1 && n.tier === 1)) {
            const choices = FACTIONS[n.type].ground || [];
            if (choices.length && rng() < GROUND_CHANCE) n.terrain = choices[Math.floor(rng() * choices.length)];
        }
    });

    return { nodes, cols: 3 };
}

function validateSectorMap(map) {
    if (!map || !Array.isArray(map.nodes)) return false;
    const nodes = map.nodes;
    const byId = {}; nodes.forEach(n => { byId[n.id] = n; });
    const tierOf = t => nodes.filter(n => n.tier === t);
    const top = tierOf(TOTAL_TIERS);
    if (top.length !== 1 || top[0].type !== 'BOSS') return false;
    for (let t = 1; t <= TOTAL_TIERS; t++) if (tierOf(t).length < 1) return false;
    for (const n of nodes) {
        if (n.tier === TOTAL_TIERS) { if (n.edges.length) return false; continue; }
        if (!n.edges.length) return false;
        for (const id of n.edges) { const m = byId[id]; if (!m || m.tier !== n.tier + 1) return false; }
    }
    // every node sits on some route from the ground floor
    const seen = new Set(tierOf(1).map(n => n.id));
    for (let t = 1; t < TOTAL_TIERS; t++) tierOf(t).forEach(n => { if (seen.has(n.id)) n.edges.forEach(id => seen.add(id)); });
    if (seen.size !== nodes.length) return false;
    const elites = nodes.filter(n => n.elite);
    if (elites.length !== 2) return false;
    if (new Set(elites.map(n => n.tier)).size !== 2) return false;
    for (const e of elites) {
        if (!ELITE_TIERS.includes(e.tier)) return false;
        if (tierOf(e.tier).length < 2) return false;
        if (nodes.filter(p => p.edges.includes(e.id)).some(p => p.edges.length < 2)) return false;
    }
    if (!nodes.some(n => n.type === 'CAMP')) return false;
    if (!nodes.some(n => n.type === 'EVENT')) return false;
    if (tierOf(1).some(n => n.elite || !FIGHT_NODES.includes(n.type))) return false;
    return true;
}

function nodeById(id) { return sectorMap ? sectorMap.nodes.find(n => n.id === id) || null : null; }

// Which nodes can be entered right now. With no committed position (sector start, a regroup,
// a dev jump) the whole active tier is open; otherwise only the committed node's connections.
function availableNodeIds() {
    if (!sectorMap || currentTier > TOTAL_TIERS) return [];
    // A retreat buys another go at the node, not another go at the routing decision before it.
    if (retreatNode && nodeById(retreatNode)) return [retreatNode];
    if (currentNodeId) {
        const cur = nodeById(currentNodeId);
        if (cur && cur.tier === currentTier - 1) return cur.edges.slice();
    }
    return sectorMap.nodes.filter(n => n.tier === currentTier).map(n => n.id);
}

// Everything still reachable from the open set - what the routing has not yet cut off.
function reachableNodeIds() {
    const open = availableNodeIds();
    const seen = new Set(open); const queue = [...open];
    while (queue.length) {
        const n = nodeById(queue.shift());
        if (!n) continue;
        n.edges.forEach(id => { if (!seen.has(id)) { seen.add(id); queue.push(id); } });
    }
    return seen;
}

function enterNode(id) {
    const node = nodeById(id);
    if (!node) { forecastWeather = null; return null; }
    currentNodeId = node.id;
    retreatNode = null;
    if (!clearedNodeIds.includes(node.id)) clearedNodeIds.push(node.id);
    forecastWeather = (FIGHT_NODES.includes(node.type) || node.type === 'BOSS') ? (node.weather || 'CLEAR') : null;
    forecastTerrain = (FIGHT_NODES.includes(node.type) || node.type === 'BOSS') ? (node.terrain || 'OPEN_ROAD') : null;
    return node;
}
const SECTOR_TIER_BONUS = 3;
// Heavies phase in rather than arriving all at once: rare, then common, then usual. The bands
// have to sit above the shallowest heavy's gate or the ramp has nowhere to act - raising those
// gates to keep heavies out of sector 1 left these at 6 and 9, below every heavy in the game.
const HEAVY_RAMP = { rare: 11, common: 14 };
// Per-tier growth within a sector. Damage eased from 0.12 after the simulator showed every
// expedition dying in sector 1, stacked on the heavy-unlock cliff at tier 6 - see the heavy
// weight ramp in generateEnemies, which was the other half of that wall.
const TIER_HP_GROWTH = 0.2;
const TIER_DMG_GROWTH = 0.10;
const BASE_REGROUPS = 2;       // second chances per run, before a defeat ends it
// Who turns up alongside whom, read off the faction table so the two stay in step.
const FACTION_ALLIES = Object.fromEntries(Object.entries(FACTIONS).map(([k, v]) => [k, v.allies]));
// Difficulty still climbs hard, but through lethality rather than bullet sponges: health
// tracks player damage growth so a fight stays ~10 rounds at any depth, while damage
// outpaces player health so a run reliably ends somewhere around sector 10.
const SECTOR_HP_SCALE = 1.25;
const SECTOR_DMG_SCALE = 1.28;   // eased from 1.32: measured, lethality still wins the long game
const XP_CURVE = 1.35;         // was 1.5 - levels kept stalling, starving the perk economy

// ── Faces ───────────────────────────────────────────────────────────────────────────────
// The wasteland was full of people who had never met you. You could pay the tinker, stiff the
// fixer and rob the scavenger, and the next one through the door was a stranger with no opinion
// about any of it. These four remember. Standing is a single signed number per run: what you
// did last time is the only thing that decides what they offer this time.
const CAST = {
    ORRIN:  { name: 'Orrin',      epithet: 'the Tinker',    note: 'A hooded cyborg who mends what the road breaks.' },
    VELA:   { name: 'Vela',       epithet: 'the Fixer',     note: 'Lends to anyone. Collects from everyone.' },
    KESS:   { name: 'Kess',       epithet: 'the Scavenger', note: 'Was bleeding out against a wheel rim when you found them.' },
    MAGPIE: { name: 'The Magpie', epithet: 'the Dealer',    note: 'Trades relics face down, and never blinks.' }
};
// Bands rather than a raw number: the player is told where they stand, not shown a score.
// The words have to fit all four of them. "Owes you" is true of the scavenger you saved and
// false of the tinker you keep buying from; trust is what both of those actually bought.
const STANDING_BANDS = [
    { at: -2, key: 'BAD_BLOOD', label: 'BAD BLOOD',     cls: 'cast-bad'  },
    { at: -1, key: 'WARY',      label: 'WARY OF YOU',   cls: 'cast-bad'  },
    { at:  0, key: 'NEUTRAL',   label: 'REMEMBERS YOU', cls: 'cast-idle' },
    { at:  1, key: 'WARM',      label: 'WARM TO YOU',   cls: 'cast-good' },
    { at:  2, key: 'TRUSTS',    label: 'TRUSTS YOU',    cls: 'cast-good' }
];
let castState = {};      // per run: { ORRIN: { met, standing } }
let firedEvents = [];    // follow-ups that have already come due, so a thread resolves once

function castOf(id) { return castState[id] || (castState[id] = { met: 0, standing: 0 }); }
function castStanding(id) { return (castState[id] || {}).standing || 0; }
function hasMetCast(id) { return ((castState[id] || {}).met || 0) > 0; }
function meetCast(id) {
    const c = castOf(id); c.met++;
    // The moment the system first means anything is the second time a face turns up, so that is
    // where it gets explained rather than at the first, where there is nothing to explain.
    if (c.met === 2) firePrompt('FACES');
    return c;
}
// Standing is clamped: one generous choice should not buy a permanent discount, and one bad
// one should not put a character out of reach for the rest of a run.
function noteCast(id, delta) {
    if (!CAST[id]) return 0;
    const c = castOf(id);
    const was = standingBand(id).key;
    c.standing = Math.max(-3, Math.min(3, c.standing + delta));
    // Crossing into trust is a thing the board can be paid for, and it can only be crossed once.
    if (was !== 'TRUSTS' && standingBand(id).key === 'TRUSTS') checkBountyProgress('TRUSTED');
    return c.standing;
}
// The deepest band the standing has reached. Below the lowest band it stays at the lowest.
function standingBand(id) {
    const n = castStanding(id);
    let out = STANDING_BANDS[0];
    for (const b of STANDING_BANDS) if (n >= b.at) out = b;
    return out;
}
function castName(id) { return CAST[id] ? `${CAST[id].name}, ${CAST[id].epithet}` : ''; }
// A debt already on the books. She will not lend into it, and the follow-ups read it too.
function owesVela() { return pendingConsequences.some(c => c.kind === 'DEBT'); }
// Everyone the run has actually met, worst standing first - the run-over screen reads this.
function facesMet() {
    return Object.keys(CAST).filter(hasMetCast)
        .sort((a, b) => castStanding(a) - castStanding(b))
        .map(id => ({ id, name: CAST[id].name, standing: castStanding(id), band: standingBand(id) }));
}

// Some choices should not settle on the screen that offered them. An event can book a
// consequence a sector or two out; it comes due when the run reaches that depth, whether or not
// the player still remembers agreeing to it.
const CONSEQUENCE_POOL = {
    DEBT: {
        title: "VELA FINDS YOU", cast: 'VELA',
        resolve: (c) => {
            const owed = c.amount || 0;
            // The one place standing is not bought with a choice on a screen - it is whether the
            // squad had the scrap when she came looking.
            if (scrap >= owed) { scrap -= owed; noteCast('VELA', 2); return `You settle up. ${owed} Scrap changes hands and Vela writes it down as paid.`; }
            const short = owed - scrap; scrap = 0;
            deployed().forEach(u => { u.hp = Math.max(1, u.hp - Math.floor(u.maxHp * 0.15)); });
            noteCast('VELA', -3);
            return `You are ${short} Scrap short. She takes what you have, and a payment in bruises, and she does not write it down as paid.`;
        }
    },
    AMBUSH: {
        title: "IT WAS BAIT",
        resolve: () => {
            const hit = deployed();
            hit.forEach(u => { u.hp = Math.max(1, u.hp - Math.floor(u.maxHp * 0.2)); });
            return `Whoever left that cache was waiting for whoever took it. The squad fights clear, ${hit.length} of them bleeding.`;
        }
    },
    SURVIVOR: {
        title: "A DEBT REPAID", cast: 'KESS',
        resolve: () => {
            deployed().forEach(u => { u.hp = u.maxHp; });
            const m = ['parts', 'chems', 'tech'][Math.floor(Math.random() * 3)];
            materials[m] += 2; scrap += 60; noteCast('KESS', 1);
            return `Kess finds your camp with a full kit and a working leg. Everyone is treated, and they leave 60 Scrap and 2 ${m}.`;
        }
    }
};

function deployed() { return playerRoster.filter(p => p.gridPos > 0 && p.hp > 0); }

// Booked against a sector rather than a node count, so it reads the same to the player as the
// event that promised it: "one sector on".
function bookConsequence(kind, inSectors, extra = {}) {
    pendingConsequences.push({ kind, dueSector: currentSector + inSectors, ...extra });
}
function consequencesDue() { return pendingConsequences.filter(c => c.dueSector <= currentSector); }

// Shown on the event screen, one at a time, before the sector's map.
function resolveConsequence() {
    const due = consequencesDue();
    if (due.length === 0) { renderMap(); return false; }
    const c = due[0];
    pendingConsequences = pendingConsequences.filter(o => o !== c);
    const spec = CONSEQUENCE_POOL[c.kind];
    if (!spec) { saveGameState(); return resolveConsequence(); }
    activeEvent = null;
    switchScreen('screen-event');
    document.getElementById('event-title').innerText = spec.title;
    document.getElementById('event-desc').innerText = '';
    if (spec.cast) meetCast(spec.cast);
    const text = spec.resolve(c);
    // After resolve, so the badge shows where the debt actually left you rather than where it
    // stood a moment before she counted it.
    renderCastTag(spec.cast);
    document.getElementById('event-choices').innerHTML =
        `<div style="color:#B8860B; font-weight:bold; margin-bottom:15px;">> ${text}</div>` +
        `<button class="event-btn" style="border-color:#4488ff; color:#4488ff;" data-action="consequence-ack">CONTINUE EXPEDITION</button>`;
    saveGameState();
    return true;
}

// Nothing in the game explained resistances, momentum, overdrive, combos or what the position
// slots do. A player learned the resistance badges by losing a turn to a bio-immune drone.
// Every entry below reads from the live tables rather than restating them, so a codex page
// cannot describe a system the engine no longer has.
const CODEX = [
    { id: 'POSITION', title: 'THE LINE', body: () => [
        'Three slots. The front rank is where melee earns its damage and where enemy melee comes for it.',
        `Melee from the middle rank lands at ${Math.round(REACH_PENALTY[2] * 100)}%, from the back at ${Math.round(REACH_PENALTY[3] * 100)}%.`,
        `Reaching past the enemy's front ${FRONT_RANKS} costs another ${Math.round((1 - DEPTH_PENALTY) * 100)}%. Ranged weapons ignore all of it.`,
        'Enemy melee walks into whoever is nearest. Enemy fire leans on the back line. A flank (🌀) ignores both.',
        'Iron Guard covers the ranks behind it: a single-target hit aimed past the guard is taken by the guard, softened.',
        'Reposition swaps two operators and costs the whole turn.'
    ] },
    { id: 'STATUSES', title: 'STATUS MARKS', body: () => [
        'Every mark on a unit reads four ways, so none of them depends on telling one colour from another.',
        'The letter says which it is. The border says it again by shape. The number is how many turns are left.',
        ...STATUSES.map(s => `${s.letter} - ${s.name}: ${s.desc}`),
        'Corroding a target is the answer to anything that re-plates itself. Oiling one is the setup for fire.'
    ] },
    { id: 'RESISTANCE', title: 'ARMOUR AND RESISTANCE', body: () => [
        'Every enemy carries three badges under its health: P physical, B biological, E energy.',
        'Orange means weak to it. Grey means it shrugs it off. Struck through means immune - that attack does nothing at all.',
        'Armour subtracts from every hit. Corroding a target strips its armour outright, which is the answer to anything that re-plates itself.'
    ] },
    { id: 'STATUS', title: 'STATUS', body: () => [
        '💧 bleeding - loses health at the start of its turn.',
        '💫 stunned - loses its turn.',
        '🛢️ oiled - takes far more from energy.',
        '🧪 corroded - armour ignored while it lasts.',
        '🎯 marked - the next hit from anyone lands harder, and spends it.',
        '🛡️ braced - temporary armour.'
    ] },
    { id: 'COMBOS', title: 'COMBOS', body: () => [
        'Setting a status up and then cashing it in is where the damage is.',
        ...COMBOS.map(c => `${c.move.replace(/_/g, ' ')} into ${c.needs.replace('Turns', '')} — ${c.name}, x${c.mult}`),
        `Any damaging move against a marked target lands at x${MARK_BONUS} and spends the mark.`,
        'The deck flags an ability whose pairing is already on the field, and aiming names it above the target.'
    ] },
    { id: 'MOMENTUM', title: 'MOMENTUM AND OVERDRIVE', body: () => [
        'Momentum builds as the squad takes and deals damage, and it is a market, not a fuse.',
        ...MOMENTUM_TACTICS.map(t => `${t.label} (${t.cost}%) — ${t.desc} Costs no action.`),
        `At ${OVERDRIVE_AT}% any operator can spend the lot on an Overdrive instead. Overcharged Cell lowers that to ${OVERDRIVE_AT_CHARGED}%.`,
        'Each class carries two Overdrives. The first full bar offers both; using one locks the class to it for the run.'
    ] },
    { id: 'RUN', title: 'THE EXPEDITION', body: () => [
        `${TOTAL_TIERS} tiers to a sector, laid out as branching routes. Taking a node commits you to the paths it connects to, and a commander waits at the top.`,
        'Nodes show their faction, a weather forecast and the ground, so route around trouble or into it on purpose.',
        ...TERRAIN_IDS.filter(k => TERRAIN[k].banner).map(k => `${TERRAIN[k].name} \u2014 ${TERRAIN[k].desc} ${TERRAIN[k].banner.replace(/[^A-Za-z0-9 :,.%+-]/g, '').trim()}`),
        'Two elite fights per sector, at different depths, never forced - there is always another road. An elite drops a relic.',
        'A commander drops a choice of three.',
        `A wipe spends a regroup - ${BASE_REGROUPS} to start, more from the Citadel - and the squad comes back with tuned weapons. Felling a commander refunds one. Out of regroups ends the run and banks the score.`,
        `Retreating is the other way out of a fight: ${RETREAT.cost} Scrap plus ${RETREAT.perDepth} a node deep, for a ${Math.round(RETREAT.base * 100)}% break that drops ${Math.round(RETREAT.perFoe * 100)}% for every hostile still standing. It buys another go at the same node with the fight rolled fresh; a failed break costs the Scrap and the turn.`,
        `No fight but a commander's has to be finished. Withdrawing forfeits the node - no scrap, no relic, no experience - for a wound of ${Math.round(WITHDRAW.wound * 100)}% health on everyone, eased to ${Math.round(WITHDRAW.floor * 100)}% by a full momentum bar, which it spends. Nobody dies of it, and the ${WITHDRAW.pursuers} toughest survivors follow you to the next fight.`,
        `Some of the people out here come back. ${Object.keys(CAST).length} of them remember what you did last time - pay them, save them, rob them - and what they offer next changes with it. Standing lasts one expedition and starts over on the next.`,
        `Before deploying, the muster shows every operator's quirk. ${MUSTER_REROLLS} reroll tokens per expedition swap the ones that do not fit the plan.`,
        `The board carries three contracts and rotates one in whenever it is settled, plus one standing contract that runs the whole expedition. ${BOUNTY_POOL.length} kinds in the rotation - most of them are ways to win a fight rather than counts of what you were doing anyway.`,
        `Skulls taken from commanders build the Citadel, and it has ${CITADEL_SPOTS.length} places to spend them - two of which need something else standing first.`,
        'Depth is worth far more than any single haul: pushing one sector deeper always beats farming the one you are on.'
    ] },
    { id: 'PROMOTIONS', title: 'FIELD PROMOTIONS', body: () => [
        'A level-up offers three perks on the spot: class signatures that change what an ability does, and repeatable training for flat stats. Banking the point keeps it for the Outpost instead.',
        ...SIG_PERKS.map(p => `${p.name} (${p.cls}) — ${p.desc}`)
    ] },
    { id: 'GEAR', title: 'GEAR', body: () => [
        'Two slots per operator: a weapon mod and a trinket, swapped freely at the Outpost.',
        'Weapon mods change what an ability does - its reach, its cooldown, who it hits, what it leaves behind. Trinkets are worn passives.',
        'Elites sometimes carry a piece; a commander always does.',
        ...GEAR_POOL.filter(g => g.slot === 'mod').map(g => `${g.name} (${g.cls}) — ${g.desc}`),
        ...GEAR_POOL.filter(g => g.slot === 'trinket').map(g => `${g.name} — ${g.desc}`)
    ] },
    { id: 'READING', title: 'READING A FIGHT', body: () => [
        'An operator carries an amber figure when something is aimed at them this round, and a red skull when what is aimed at them would finish them. A question mark means a ranged attacker has not committed to its mark yet.',
        'While an ability is armed, an enemy shows the share of a blow that survives its plating and resistances - 60% means four in ten of every point is soaked before it lands.',
        'Any damage line in the log can be tapped to read the whole arithmetic back: what was rolled, every multiplier that bent it, what the target soaked, and what landed.'
    ] },
    { id: 'BESTIARY', title: 'THE BESTIARY', body: () => [
        'Everything the wasteland fields, and what you know of it. A file fills in the first time you meet its subject.',
        ...bestiaryRoster().map(r => {
            if (!hasMet(r.name)) return `${r.boss ? 'WARLORD' : r.faction} \u00B7 [ NO FILE ]`;
            const t = bestiaryEntry(r.name);
            const s = r.sig ? ENEMY_SIGS[r.sig] : null;
            return `${r.name} (${r.boss ? 'WARLORD' : r.faction}) \u2014 ${s ? s.name + ': ' + s.desc + ' ' : ''}Met ${t.met}, killed ${t.killed}, cost you ${t.felled}.`;
        })
    ] },
    { id: 'HOSTILES', title: 'KNOW THE HOSTILES', body: () => [
        'Every hostile carries a signature. A passive one is always running; an action is telegraphed by its own icon a turn before it lands, so there is always an answer.',
        ...Object.values(ENEMY_SIGS).map(s => `${s.name} (${s.kind === 'action' ? 'telegraphed' : s.kind}) \u2014 ${s.desc}`)
    ] },
    { id: 'ASCENSION', title: 'ASCENSION PROTOCOLS', body: () => [
        'The ladder after the game is beaten in the ordinary sense: named protocols unlocked by your deepest sector ever, chosen on the contract board, each rung stacking every twist below it - with a score multiplier above what contracts give.',
        ...PROTOCOLS.map(p => `${p.name} (Sector ${p.gate}) — ${p.desc} Score x${p.mult.toFixed(2)}.`)
    ] },
    { id: 'DOSSIERS', title: 'DOSSIERS', body: () => [
        `Every point of XP an operator earns also goes on their class's dossier, across every run. Ranks come at ${MASTERY_RANKS[1].toLocaleString()}, ${MASTERY_RANKS[2].toLocaleString()} and ${MASTERY_RANKS[3].toLocaleString()} lifetime XP - and they unlock options, never raw power.`,
        'Rank I: a title on the card. Rank II: a class quirk joins that class\'s draw pool. Rank III: a fourth ability, with the muster picking which three of the four deploy.',
        ...Object.keys(MASTERY_TITLES).map(cls =>
            `${cls} — "${MASTERY_TITLES[cls]}" · quirk: ${CLASS_QUIRKS[cls].name} · fourth: ${FOURTH_ABILITIES[cls].label}`)
    ] },
    { id: 'CURSES', title: 'CURSES AND SETS', body: () => [
        'Cursed relics carry real upsides and real teeth, marked unmistakably in the cache. They are never dealt at random: every curse aboard was chosen - from a cache card, or at the collector\'s table, where a held relic buys two blind draws.',
        ...RELIC_POOL.filter(r => r.tier === 'CURSED').map(r => `${r.name} — ${r.desc}`),
        'Three pairs upgrade each other when both halves ride together:',
        ...RELIC_SETS.map(s => `${s.name} (${RELIC_POOL.find(r => r.id === s.a).name} + ${RELIC_POOL.find(r => r.id === s.b).name}) — ${s.desc}`)
    ] },
    { id: 'PROTOCOL', title: 'THE DAILY PROTOCOL', body: () => [
        'A seed typed on the contract board fixes everything the wasteland generates: the maps, the fronts, the quirk draws, the opening bounty slate. The fighting stays live, and rerolls are yours.',
        "TODAY'S PROTOCOL derives the seed from the date - the same wasteland for everyone who deploys on it that day, scored on its own best line.",
        'Any phrase works as a seed. Trade one with a rival and cut the same roads.'
    ] },
    { id: 'FRONTS', title: 'SECTOR FRONTS', body: () => [
        'Every sector rolls a front, announced as you enter and worn on the map header. A front tilts what the roads hold, what the weather does, what falls as loot, and what the boss brings.',
        ...FRONTS.map(f => `${f.name} — ${f.desc}`)
    ] },
    { id: 'BONDS', title: 'BONDS', body: () => [
        `Two operators who fight together accumulate a bond, named for the pair and levelled by fights survived side by side: I at ${BOND_LEVELS[0]}, II at ${BOND_LEVELS[1]}, III at ${BOND_LEVELS[2]}.`,
        'Level I pays +5% damage while a bonded partner stands. At II, once per fight, a partner steps in front of a killing blow. At III the pair drops the overdrive threshold by 10 while both stand.',
        'Bonds last the run and follow the pair, not the slot - rotate the squad and the old ties wait on the bench.',
        ...Object.entries(BOND_NAMES).map(([k, v]) => `${v} — ${k.replace('|', ' & ')}`)
    ] },
    { id: 'ARMORY', title: 'THE ARMORY', body: () => [
        'A trader node on the route map, on most maps but not all. Stock rolls fresh per visit and prices ride the sector reward curve.',
        'On the shelf: one gear piece, one relic at a steep markup, med-stims, Quirk Therapy (reroll one operator\'s quirk), and the Regroup Bond.',
        'The Regroup Bond prepays your next regroup: when the squad breaks, the bond is spent instead of half your scrap.'
    ] },
    { id: 'CONTRACTS', title: 'CONTRACTS', body: () => [
        'Optional conditions taken before deploying. Each makes the run harder and every point it earns worth more.',
        ...CONTRACT_POOL.map(c => `${c.name} +${Math.round(c.bonus * 100)}% — ${c.desc}`)
    ] }
];

function renderCodex() {
    switchScreen('screen-codex');
    // The settings panel is an overlay rather than a screen, so switchScreen leaves it up - and
    // it sits on top of the manual, swallowing every click meant for it.
    closeSettings();
    document.getElementById('codex-body').innerHTML = CODEX.map(entry =>
        `<div class="codex-entry"><div class="codex-title">${entry.title}</div>` +
        entry.body().map(line => `<div class="codex-line">${line}</div>`).join('') +
        `</div>`).join('');
}

// Optional conditions taken before a run, each buying a share of the final score. A run stops
// being the same shape every time, and a leaderboard entry says how it was earned.
const CONTRACT_POOL = [
    { id: 'NO_CONSUMABLES', name: "DRY RUN",       bonus: 0.15, desc: "Deploy with an empty bag. Nothing can be carried or crafted into it." },
    { id: 'SHORT_HANDED',   name: "SHORT HANDED",  bonus: 0.20, desc: "One fewer operator deploys. The back rank stays empty." },
    { id: 'THEY_MOVE_FIRST',name: "SECOND WATCH",  bonus: 0.15, desc: "The enemy takes the first turn of every fight." },
    { id: 'HARSH_SKIES',    name: "HARSH SKIES",   bonus: 0.20, desc: "Every node carries weather. It is never clear." },
    { id: 'GLASS',          name: "GLASS JAW",     bonus: 0.30, desc: "Every operator deploys with 25% less maximum health." },
    { id: 'NO_REGROUPS',    name: "NO FALLBACK",   bonus: 0.35, desc: "No regroups. The first squad wipe ends the expedition." }
];

function hasContract(id) { return activeContracts.includes(id); }
// Every route into the bag goes through here. Dry Run promises nothing can be carried or
// crafted into it, and events hand out items too - so the rule cannot live at the crafting
// bench alone.
function canCarry() { return !hasContract('NO_CONSUMABLES') && inventory.length < metaUpgrades.invMax; }
function contractMult() {
    return 1 + CONTRACT_POOL.filter(c => hasContract(c.id)).reduce((n, c) => n + c.bonus, 0);
}
function contractNames() {
    return CONTRACT_POOL.filter(c => hasContract(c.id)).map(c => c.name);
}

const EVENT_POOL = [
    { title: "WRECKED CARAVAN", desc: "You stumble upon a destroyed merchant rig. The engine block is sparking dangerously, but the cargo hold is partially intact.", choices: [ { label: "Salvage Cargo (+30 Scrap)", canAfford: () => true, execute: () => { scrap += 30; playSFX('heal'); return "Salvaged 30 Scrap from the wreckage."; } }, { label: "Gut the Engine (+1 Tech, +2 Parts, -15 HP to random unit)", canAfford: () => true, execute: () => { materials.tech += 1; materials.parts += 2; let active = playerRoster.filter(p => p.gridPos > 0 && p.hp > 0); let target = active[Math.floor(Math.random() * active.length)]; target.hp = Math.max(1, target.hp - 15); playSFX('hit'); triggerHitFlash(target.id); return `Extracted parts, but an electrical surge shocked ${target.name} for 15 DMG.`; } }, { label: "Leave it", canAfford: () => true, execute: () => { return "You move on safely without risking the sparks."; } } ] },
    { title: "THE CHEM OASIS", desc: "A glowing pool of bio-luminescent fluid sits in a blast crater. It smells like synthetic ozone and iron.", choices: [ { label: "Extract Fluid (+2 Chems)", canAfford: () => true, execute: () => { materials.chems += 2; playSFX('heal'); return "Carefully extracted 2 Chems from the pool."; } }, { label: "Bathe Wounds (Heal All Deployed for 25 HP)", canAfford: () => true, execute: () => { playerRoster.forEach(p => { if(p.gridPos > 0 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + 25); }); playSFX('heal'); return "The fluid burned, but the wounds sealed rapidly."; } } ] },
    { title: "WANDERING TINKER", cast: 'ORRIN',
      desc: () => hasMetCast('ORRIN') && castOf('ORRIN').met > 1
        ? "A different fire, the same mechanical hand. Orrin has your measure now and lays the good stock out first."
        : "A hooded cyborg sits by a campfire. They gesture toward a pile of tactical gear and hold out a mechanical hand.",
      choices: () => {
        // Trade with him twice and the price comes down. That is the whole of the relationship.
        const bombPrice = castStanding('ORRIN') >= 2 ? 25 : 40;
        const list = [
          { label: `Trade Scrap for Bomb (Cost: ${bombPrice} Scrap)`, canAfford: () => scrap >= bombPrice && canCarry(),
            execute: () => { scrap -= bombPrice; inventory.push('SCRAP_BOMB'); checkBountyProgress('CRAFT'); noteCast('ORRIN', 1); playSFX('click');
              return `Acquired 1 Scrap Bomb for ${bombPrice} Scrap.`; } },
          { label: "Trade Parts for Tech (Cost: 2 Parts)", canAfford: () => materials.parts >= 2,
            execute: () => { materials.parts -= 2; materials.tech += 1; noteCast('ORRIN', 1); playSFX('click');
              return "Traded 2 Parts for 1 Tech."; } }
        ];
        if (castStanding('ORRIN') >= 2) list.push(
          { label: "Let him look at your weapons (free, +4 DMG for 3 battles)", canAfford: () => true,
            execute: () => { tuneUpBattles = 3; playSFX('heal');
              return "He waves the payment away and works down the line, one weapon at a time."; } });
        list.push({ label: "Decline", canAfford: () => true, execute: () => "You nod respectfully and continue walking." });
        return list;
      } },
    { title: "RADIATION STORM", desc: "The geiger counter screams. A violent wall of radioactive dust is rapidly approaching your position.", choices: [ { label: "Sprint Through (-10 HP to All Deployed)", canAfford: () => true, execute: () => { playerRoster.forEach(p => { if(p.gridPos > 0 && p.hp > 0) p.hp = Math.max(1, p.hp - 10); }); playSFX('hit'); triggerShake(); return "The squad powered through, but took heavy radiation burns."; } }, { label: "Deploy EMP Shield (-1 EMP Charge)", canAfford: () => inventory.includes('EMP_CHARGE'), execute: () => { inventory.splice(inventory.indexOf('EMP_CHARGE'), 1); playSFX('heal'); return "The EMP Charge detonated, creating a localized magnetic shield against the storm."; } } ] },

    { title: "THE COLLECTOR'S TABLE", cast: 'MAGPIE',
      desc: () => castOf('MAGPIE').met > 1
        ? "The same velvet cloth, the same tailgate, and The Magpie already has two face down before you sit."
        : "A relic dealer in a lead apron has laid a velvet cloth over a tailgate. 'One of yours, face down. Two of mine, blind. Everyone walks away richer or angrier.'",
      choices: [
        { label: "Trade a held relic for two blind draws", canAfford: () => activeRelics.length >= 1 && unownedRelics().length >= 2,
          execute: () => {
            // Every choice must resolve safely even when its canAfford gate would refuse it.
            if (!activeRelics.length) return "Nothing on your side of the cloth. The dealer's eyes slide past you.";
            const given = activeRelics.splice(Math.floor(Math.random() * activeRelics.length), 1)[0];
            // Blind means blind: the draw pool includes the cursed shelf.
            const pool = unownedRelics().filter(r => r.id !== given.id);
            const draws = [];
            for (let i = 0; i < 2 && pool.length; i++) {
                const p = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
                activeRelics.push(p); draws.push(p.name);
            }
            announceSets(); noteCast('MAGPIE', 1); playSFX('overdrive');
            return `${given.name} slides across the cloth, face down. Back come ${draws.join(' and ')}.`;
          } },
        { label: "Keep what you carry", canAfford: () => true,
          execute: () => "The dealer folds the cloth. 'Attachment. It gets them all killed.'" }
      ] },

    { title: "THE DEBT COLLECTOR", cast: 'VELA',
      desc: () => owesVela()
        ? "Vela is dealing the same hand at a different truck. She lets you stand there a while before she says anything. 'You still owe me.'"
        : castOf('VELA').met > 1
          ? "Vela deals herself a hand and nods at the crate opposite. Whatever you settled last time, she wrote it down."
          : "A fixer in a rebreather deals cards on the hood of a burnt-out truck. She does not look up. 'Everyone out here needs something. I need to be paid back.'",
      choices: () => {
        // She will not lend twice into the same debt, and she lends cheaper to someone who paid.
        const owing = owesVela();
        const owed = castStanding('VELA') >= 1 ? 320 : 400;
        const list = [];
        if (!owing) list.push(
          { label: `Borrow 200 Scrap (owe ${owed} one sector on)`, canAfford: () => true,
            execute: () => { scrap += 200; bookConsequence('DEBT', DEBT_TERM, { amount: owed }); playSFX('click');
              return `She counts out 200 Scrap without looking at you. 'One sector. ${owed}.'`; } });
        else list.push(
          { label: "Ask for more (she refuses)", canAfford: () => false,
            execute: () => "She does not deal you in twice." });
        list.push(
          { label: "Sell her a favour instead (+80 Scrap, -1 Tech)", canAfford: () => materials.tech >= 1,
            execute: () => { materials.tech -= 1; scrap += 80; noteCast('VELA', 1); playSFX('click');
              return "She takes the component, turns it over once, and pays you 80 Scrap for it."; } },
          { label: "Walk away", canAfford: () => true, execute: () => "She deals another hand. 'Smart. Most of them aren't.'" });
        return list;
      } },

    { title: "THE BURIED CACHE", desc: "A sealed military container, half out of the sand, seals intact. Nothing has touched it. Nothing at all, for a very long time.",
      choices: [
        { label: "Crack it open (+1 item, +1 Tech)", canAfford: () => canCarry(),
          execute: () => { inventory.push('SCRAP_BOMB'); materials.tech += 1; checkBountyProgress('CRAFT');
            bookConsequence('AMBUSH', 1); playSFX('heal');
            return "A Scrap Bomb and a clean tech core. Nobody says what everyone is thinking: why was this still here?"; } },
        { label: "Strip the shell for parts (+3 Parts)", canAfford: () => true,
          execute: () => { materials.parts += 3; playSFX('click');
            return "You leave the seals alone and take the plating. Three Parts, and nothing follows you."; } },
        { label: "Leave it buried", canAfford: () => true, execute: () => "You mark it on nobody's map and keep walking." }
      ] },

    { title: "THE SURVIVOR", cast: 'KESS',
      desc: () => castOf('KESS').met > 1
        ? "Kess is upright this time, and walking, and there is someone else propped against the rim beside them. 'Your turn to watch me decide.'"
        : "A scavenger is propped against a wheel rim, one leg opened to the bone. They have a rifle across their lap and no rounds left for it.",
      choices: [
        { label: "Patch them up (-2 Chems)", canAfford: () => materials.chems >= 2,
          execute: () => { materials.chems -= 2; bookConsequence('SURVIVOR', 2); noteCast('KESS', 2); playSFX('heal');
            return "You seal the leg and leave them water. They ask for your route. 'I pay what I owe.'"; } },
        { label: "Take the rifle (+50 Scrap)", canAfford: () => true,
          execute: () => { scrap += 50; noteCast('KESS', -2); playSFX('click');
            return "The rifle is worth 50 Scrap to the right buyer. They watch you take it and say nothing."; } },
        { label: "Leave them the water and go", canAfford: () => true,
          execute: () => { noteCast('KESS', 1);
            return "You set the canteen down within reach and move on."; } }
      ] },

    { title: "THE SIGNAL TOWER", desc: "A relay mast still has power, blinking against the dust. From the top you could see the next stretch of road before it sees you.",
      choices: [
        { label: "Send someone up (-15 HP, next fight starts at 50 momentum)", canAfford: () => deployed().length > 0,
          execute: () => { const u = deployed()[0]; u.hp = Math.max(1, u.hp - 15); momentum = Math.max(momentum, 50); addMomentum(0); playSFX('click');
            return `${u.name} makes the climb and comes down bleeding, with the shape of the next fight in their head.`; } },
        { label: "Strip the transmitter (+2 Tech)", canAfford: () => true,
          execute: () => { materials.tech += 2; playSFX('click'); return "The relay goes dark. You are two Tech richer and slightly less welcome here."; } }
      ] },

    { title: "FIELD HOSPITAL", desc: "Rows of cots, all empty, all made. Someone packed this place up carefully and never came back for it.",
      choices: [
        { label: "Treat the squad (heal 40 to all deployed)", canAfford: () => true,
          execute: () => { deployed().forEach(u => { u.hp = Math.min(u.maxHp, u.hp + 40); }); playSFX('heal');
            return "Clean bandages and working antiseptic. The squad has not been this patched up in weeks."; } },
        { label: "Strip the dispensary (+3 Chems)", canAfford: () => true,
          execute: () => { materials.chems += 3; playSFX('click'); return "Three Chems, and a wall of neatly labelled shelves you leave picked clean."; } }
      ] },

    { title: "THE MINEFIELD", desc: "The shortest way through is a flat stretch of hardpan studded with pressure plates. The long way around loses you most of a day.",
      choices: [
        { label: "Cross it (+70 Scrap, one unit takes 25)", canAfford: () => deployed().length > 0,
          execute: () => { const list = deployed(); const u = list[Math.floor(Math.random() * list.length)];
            u.hp = Math.max(1, u.hp - 25); scrap += 70; playSFX('hit'); triggerShake(); triggerHitFlash(u.id);
            return `A plate goes under ${u.name}. They walk it off. The salvage on the far side is worth 70 Scrap.`; } },
        { label: "Take the long way", canAfford: () => true, execute: () => "Slow, dull, and everyone still has their legs." }
      ] },

    { title: "RIVAL CREW", desc: "Six of them, dug in behind a berm, weapons up but not raised. Their leader spits and waits to see which way this goes.",
      choices: [
        { label: "Trade with them (-2 Parts, +1 item)", canAfford: () => materials.parts >= 2 && canCarry(),
          execute: () => { materials.parts -= 2; inventory.push('MED_STIM'); checkBountyProgress('CRAFT'); playSFX('click');
            return "Two Parts for a sealed Med-Stim. Nobody shoots. Everyone counts it as a win."; } },
        { label: "Face them down (+90 Scrap, -20 HP to your front rank)", canAfford: () => deployed().length > 0,
          execute: () => { const front = deployed().sort((a, b) => a.gridPos - b.gridPos)[0];
            front.hp = Math.max(1, front.hp - 20); scrap += 90; playSFX('hit');
            return `${front.name} walks out alone and does not stop walking. They break, and leave 90 Scrap behind them.`; } },
        { label: "Back out slowly", canAfford: () => true, execute: () => "Both crews walk backwards until the berm is out of sight." }
      ] },

    { title: "THE ORACLE", desc: "A figure wrapped in printed circuit boards sits in the shade of a dead reactor, reciting numbers. Some of them are your kill count.",
      choices: [
        { label: "Pay for a reading (-60 Scrap, +1 Perk Point)", canAfford: () => scrap >= 60 && deployed().length > 0,
          execute: () => { scrap -= 60; const list = deployed(); const u = list[Math.floor(Math.random() * list.length)];
            u.perkPoints++; playSFX('heal');
            return `They speak to ${u.name} for a long time in a language nobody recognises. ${u.name} comes back knowing something new.`; } },
        { label: "Ask about the road ahead (free)", canAfford: () => true,
          execute: () => { tuneUpBattles = Math.max(tuneUpBattles, 2); playSFX('click');
            return "'Two more fights,' they say, 'and then the ground changes.' The squad readies itself accordingly."; } },
        { label: "Leave them to it", canAfford: () => true, execute: () => "The numbers continue behind you for longer than they should be audible." }
      ] },

    { title: "SCRAP GEYSER", desc: "A ruptured line vents superheated slurry every few minutes, and each burst throws up metal that was buried a century ago.",
      choices: [
        { label: "Work the vent (+120 Scrap, -12 HP to all deployed)", canAfford: () => true,
          execute: () => { deployed().forEach(u => { u.hp = Math.max(1, u.hp - 12); }); scrap += 120; playSFX('hit');
            return "Everyone comes away scalded and 120 Scrap heavier."; } },
        { label: "Cap the line (+2 Parts, +1 Chems)", canAfford: () => true,
          execute: () => { materials.parts += 2; materials.chems += 1; playSFX('click');
            return "You seal it properly. Two Parts and a Chem out of the fittings, and the road stays walkable."; } }
      ] },

    { title: "THE HOARD", desc: "Crates stacked three high in an open drainage culvert, unlocked, unguarded, in the middle of raider country.",
      choices: [
        { label: "Take all of it (+180 Scrap)", canAfford: () => true,
          execute: () => { scrap += 180; bookConsequence('AMBUSH', 1); playSFX('heal');
            return "180 Scrap, and not one person in the squad believes this is free."; } },
        { label: "Take a crate and go (+50 Scrap)", canAfford: () => true,
          execute: () => { scrap += 50; playSFX('click');
            return "One crate, 50 Scrap, and out of the culvert before anyone comes to see who is in it."; } },
        { label: "Burn it", canAfford: () => true,
          execute: () => { materials.parts += 1;
            return "Whoever set this will find ash. You keep one salvaged Part out of the fire."; } }
      ] }
];

// ── Threads ─────────────────────────────────────────────────────────────────────────────
// None of these are in the general draw. Each exists only because of something the player
// already did, each names the door it came through in `when`, and each comes due once - a
// thread that repeats is a coincidence, not a thread. `pickEvent` offers them ahead of the
// ordinary pool, so a run that has earned one gets it at the next event node.
//
// N08 hook: three of these are the natural place for a recruit to arrive out of a well-resolved
// event. When the recruit generator and the roster slots exist, the offer attaches here - to
// KESS ON THE ROAD first, which is already the survivor turning up whole.
const FOLLOWUPS = [
    { title: "ORRIN'S WORKSHOP", cast: 'ORRIN',
      when: () => castStanding('ORRIN') >= 2,
      desc: () => "Under a collapsed overpass Orrin has a bench, a generator and a light. 'You keep buying. I keep moving. Easier if I stop for one of us.'",
      choices: () => [
        { label: "Take the piece he set aside (free gear)", canAfford: () => !!rollGear(),
          execute: () => { const g = rollGear(); if (!g) return "The bench is bare by the time you reach it.";
            gearStash.push(g); playSFX('heal');
            return `He puts ${gearById(g).name} in your hand and refuses the scrap. 'Bring it back broken.'`; } },
        { label: "Have him strip your spares (+2 Parts, +2 Tech)", canAfford: () => true,
          execute: () => { materials.parts += 2; materials.tech += 2; playSFX('click');
            return "He works through the squad's dead weight and hands back what is worth carrying."; } },
        { label: "Leave him to it", canAfford: () => true,
          execute: () => { return "'Next fire, then.' The light stays on behind you for a long while."; } }
      ] },

    { title: "VELA SENDS MEN", cast: 'VELA',
      when: () => castStanding('VELA') <= -2,
      desc: () => "Four of them across the road, and none of them are Vela. The one in front holds up a folded card with a number written on it in her hand.",
      choices: () => [
        { label: "Pay it and be done (-300 Scrap)", canAfford: () => scrap >= 300,
          execute: () => { scrap -= 300; noteCast('VELA', 3); playSFX('click');
            return "Three hundred, counted twice, and the card is torn in half in front of you. The slate is clean."; } },
        { label: "Hand over a relic instead", canAfford: () => activeRelics.length > 0,
          execute: () => { if (!activeRelics.length) return "You have nothing on you worth the number on the card.";
            const g = activeRelics.splice(Math.floor(Math.random() * activeRelics.length), 1)[0];
            announceSets(); noteCast('VELA', 2); playSFX('click');
            return `${g.name} goes into a canvas bag. 'She'll take it. She takes most things.'`; } },
        { label: "Take the beating", canAfford: () => true,
          execute: () => { deployed().forEach(u => { u.hp = Math.max(1, u.hp - Math.floor(u.maxHp * 0.25)); });
            playSFX('hit'); triggerShake();
            return "It is short, thorough and entirely professional. Nobody dies. Everybody remembers."; } }
      ] },

    { title: "VELA'S LEDGER", cast: 'VELA',
      when: () => castStanding('VELA') >= 2 && !owesVela(),
      desc: () => "Vela has a folding table this time, and a chair for you. 'You pay. That is rarer than you think. So here is the rate nobody else gets.'",
      choices: () => [
        { label: "Borrow 400 Scrap (owe 480 one sector on)", canAfford: () => true,
          execute: () => { scrap += 400; bookConsequence('DEBT', DEBT_TERM, { amount: 480 }); playSFX('click');
            return "Four hundred, at a rate she does not write down where anyone can see it."; } },
        { label: "Sell her the squad's junk (+180 Scrap, -2 Parts)", canAfford: () => materials.parts >= 2,
          execute: () => { materials.parts -= 2; scrap += 180; playSFX('click');
            return "She pays over the odds and does not pretend otherwise."; } },
        { label: "Nothing today", canAfford: () => true,
          execute: () => "She folds the table up. 'The chair stays out for you.'" }
      ] },

    { title: "KESS ON THE ROAD", cast: 'KESS',
      when: () => castStanding('KESS') >= 2,
      desc: () => "Kess is walking the same road you are, upright, armed, and carrying more kit than one person needs. 'Told you I pay what I owe.'",
      choices: () => [
        { label: "Let them work on the squad (heal everyone to full)", canAfford: () => deployed().length > 0,
          execute: () => { deployed().forEach(u => { u.hp = u.maxHp; }); playSFX('heal');
            return "They empty half the kit into your people and repack the rest without being asked."; } },
        { label: "Ask what is ahead (next fight opens at 50 momentum)", canAfford: () => true,
          execute: () => { momentum = Math.max(momentum, 50); addMomentum(0); playSFX('click');
            return "They draw the next stretch of road in the dirt, including the parts nobody walks."; } },
        { label: "Send them somewhere safer", canAfford: () => true,
          execute: () => { scrap += 120; noteCast('KESS', 1); playSFX('click');
            return "They argue, lose, and leave you 120 Scrap on the way out. 'Then take this instead.'"; } }
      ] },

    { title: "WORD GETS AROUND", cast: 'KESS',
      when: () => castStanding('KESS') <= -2,
      desc: () => "The rifle you sold is leaning against a crate, and the people around the crate already know your squad by description.",
      choices: () => [
        { label: "Buy the story back (-140 Scrap)", canAfford: () => scrap >= 140,
          execute: () => { scrap -= 140; noteCast('KESS', 3); playSFX('click');
            return "Money is a poor apology and an excellent one. The description stops travelling."; } },
        { label: "Let it stand", canAfford: () => true,
          execute: () => { bookConsequence('AMBUSH', 1); playSFX('click');
            return "You walk through and nobody stops you. Somebody leaves ahead of you at a run."; } }
      ] },

    { title: "THE MAGPIE'S BACK SHELF", cast: 'MAGPIE',
      when: () => castStanding('MAGPIE') >= 1 && unownedRelics().length > 0,
      desc: () => "No cloth this time. The Magpie sets one thing on the tailgate face up. 'You play blind well enough that I'll show you this one.'",
      choices: () => {
        // Named rather than blind: the reward for playing their game is being allowed to see.
        const on = rollRelic(0.6);
        return [
          { label: on ? `Buy ${on.name} (-260 Scrap)` : 'The shelf is empty', canAfford: () => !!on && scrap >= 260,
            execute: () => { if (!on) return "The shelf is empty."; scrap -= 260; activeRelics.push(on); announceSets(); noteCast('MAGPIE', 1); playSFX('overdrive');
              return `${on.name} changes hands in daylight, which The Magpie clearly finds distasteful.`; } },
          { label: on ? `Trade a relic for ${on.name}` : 'Nothing to trade', canAfford: () => !!on && activeRelics.length > 0,
            execute: () => { if (!on) return "Nothing on the shelf.";
              if (!activeRelics.length) return "The Magpie looks at your empty hands and puts it back under the tailgate.";
              const given = activeRelics.splice(Math.floor(Math.random() * activeRelics.length), 1)[0];
              activeRelics.push(on); announceSets(); noteCast('MAGPIE', 1); playSFX('overdrive');
              return `${given.name} for ${on.name}, straight across, and no cloth over either of them.`; } },
          { label: "Walk on", canAfford: () => true,
            execute: () => "The thing goes back under the tailgate before you have finished turning." }
        ];
      } }
];

const ROSTER_TEMPLATE = [
    { id: 'p1', name: "Bruiser", classType: "BRUISER", maxHp: 80, hp: 80, speed: 8, armor: 0, isPlayer: true, dmgBase: 20, img: "hero_bruiser.webp", scale: 1.15, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 5, bio: 0, energy: 0 }, upgradeCount: 0, gridPos: 1, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { heavy_wrench: 0, iron_guard: 0 } },
    { id: 'p2', name: "Medic", classType: "MEDIC", maxHp: 50, hp: 50, speed: 12, armor: 0, isPlayer: true, dmgBase: 10, img: "hero_medic.webp", scale: 1.6, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 10, energy: 0 }, upgradeCount: 0, gridPos: 2, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { cauterize: 0 } },
    { id: 'p3', name: "Scavenger", classType: "SCAVENGER", maxHp: 45, hp: 45, speed: 15, armor: 0, isPlayer: true, dmgBase: 15, img: "hero_scavenger.webp", scale: 1.25, hpDrop: -25, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 5 }, upgradeCount: 0, gridPos: 3, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { flashbang: 0, acid_flask: 0 } },
    { id: 'p4', name: "Pyro", classType: "PYROMANIAC", maxHp: 55, hp: 55, speed: 11, armor: 0, isPlayer: true, dmgBase: 12, img: "hero_pyro.webp", scale: 1.1, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 10 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { molotov: 0, thermite: 0 } },
    { id: 'p5', name: "Breacher", classType: "SHOTGUNNER", maxHp: 65, hp: 65, speed: 9, armor: 5, isPlayer: true, dmgBase: 22, img: "hero_shotgunner.webp", scale: 1.15, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 5, bio: 0, energy: 0 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { buckshot: 0, execute_shot: 0 } },
    { id: 'p6', name: "Ghost", classType: "SNIPER", maxHp: 40, hp: 40, speed: 16, armor: 0, isPlayer: true, dmgBase: 28, img: "hero_sniper.webp", scale: 0.9, hpDrop: -10, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { deadeye: 0, spotters_mark: 0 } },
    { id: 'p7', name: "War Hound", classType: "HOUND", maxHp: 35, hp: 35, speed: 19, armor: 0, isPlayer: true, dmgBase: 16, img: "hero_hound.webp", scale: 0.8, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: -2, bio: 10, energy: 0 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { feral_bite: 0, rip_and_tear: 0 } }
];

// ── Recruits ────────────────────────────────────────────────────────────────────────────
// The squad used to be the same seven every expedition: the muster chose who deployed, never
// who existed. These three are not in the template. You find them on the road, out there on
// their own, and what you get for the scrap is a body with a verb none of the seven has - a
// grinder for the front, a decontaminator for the middle, and something that can reach into
// the enemy back line and drag what is hiding there out where the squad can reach it.
const RECRUIT_POOL = [
    { id: 'p8', name: "Trench Fiend", classType: "TRENCH_FIEND", rank: 1,
      pitch: "Dug in at the bottom of somebody else's trench, still holding the saw.",
      maxHp: 72, hp: 72, speed: 7, armor: 3, isPlayer: true, dmgBase: 21, img: "hero_fiend.webp", scale: 1.15, hpDrop: 0,
      stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, chargeTurns: 0,
      resistances: { phys: 5, bio: 5, energy: 0 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100,
      perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { ripsaw: 0, over_the_top: 0 } },
    { id: 'p9', name: "Hazmat", classType: "HAZMAT", rank: 2,
      pitch: "Walked out of the refinery alone, suit still sealed, tanks still green.",
      maxHp: 58, hp: 58, speed: 10, armor: 0, isPlayer: true, dmgBase: 13, img: "hero_hazmat.webp", scale: 1.15, hpDrop: 0,
      stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0,
      resistances: { phys: 0, bio: 25, energy: 5 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100,
      perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { caustic_burst: 0, purge_valve: 0 } },
    { id: 'p10', name: "Harpooner", classType: "HARPOONER", rank: 3,
      pitch: "Sat in the same patch of scrub for two days waiting for something worth the shot.",
      maxHp: 42, hp: 42, speed: 14, armor: 0, isPlayer: true, dmgBase: 25, img: "hero_harpooner.webp", scale: 1.0, hpDrop: -15,
      stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0,
      resistances: { phys: 0, bio: 0, energy: 0 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100,
      perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { drag_line: 0, barbed_shot: 0 } }
];
// Signing one on is the cost. It rides the sector, because a body is worth more the deeper you
// are and because a free one this late would be a reward for surviving rather than a decision.
// Priced off the measured purse, not off a feeling. At 110 + 22 a tier the median ask across
// sixty expeditions was 506 against a median purse of 324 at the moment of the offer: five of
// sixty-nine offers were affordable at all and nobody was ever signed on. This lands the median
// ask near 200, which is most of what a squad is carrying at that depth without being all of it.
const RECRUIT_COST = { base: 90, perDepth: 6 };
function recruitCost() { return RECRUIT_COST.base + RECRUIT_COST.perDepth * depthIndex(); }
// They have been out here on their own, and it shows.
const RECRUIT_HEALTH = 0.6;
let pendingRecruit = null;      // { id, cost, taken } for the node currently being stood in

function recruitables() { return RECRUIT_POOL.filter(r => !playerRoster.some(c => c.id === r.id)); }
function recruitById(id) { return RECRUIT_POOL.find(r => r.id === id) || null; }

let playerRoster = []; let activeEntities = []; let turnQueue = []; let activeIndex = -1; let combatActive = false; let pendingAction = null;

window.addEventListener('click', initAudio, { once: true });

// Every interactive element carries data-action (plus any data-* it needs) and is routed
// through this table, so markup never has to reach for a global.
const ACTIONS = {
    'settings-open':    () => openSettings(),
    'settings-close':   () => closeSettings(),
    'withdraw':         () => withdraw(),
    'retreat':          () => retreat(),
    'withdraw-cancel':  () => { disarmWithdraw(); renderCommandDeck(); },
    'toggle-speed':     () => toggleGameSpeed(),
    'toggle-sfx':       () => cycleSfx(),
    'toggle-amb':       () => cycleAmbience(),
    'toggle-motion':    () => cycleMotion(),
    'toggle-text':      () => cycleTextScale(),
    'erase-save':       () => eraseCurrentSave(),
    'return-title':     () => returnToTitle(),
    'title':            () => renderTitleScreen(),
    'citadel':          () => renderCitadel(),
    'map':              () => renderMap(),
    'outpost':          () => renderOutpost(),
    'new-game':         el => openContracts(parseFloat(el.dataset.diff)),
    'slot':             el => selectSlot(Number(el.dataset.slot), el.dataset.exists === '1'),
    'buy-meta':         el => buyMetaUpgrade(el.dataset.kind),
    'take-relic':       el => takeRelic(Number(el.dataset.index)),
    'take-perk':        el => takePerkOffer(Number(el.dataset.index)),
    'bank-perk':        () => bankPerkOffer(),
    'toggle-contract':  el => toggleContract(el.dataset.id),
    'begin-expedition': () => beginExpedition(),
    'muster-rank':      el => musterRank(el.dataset.id),
    'muster-reroll':    el => musterReroll(el.dataset.id),
    'muster-deploy':    () => musterDeploy(),
    'codex':            () => renderCodex(),
    'erase-slot':       el => { Store.remove(BASE_SAVE_KEY + Number(el.dataset.slot)); renderTitleScreen(); },
    'dev-open':         () => renderDev(),
    'dev-exit':         () => renderMap(),
    'dev-sector':       el => devJump(Number(el.dataset.delta), 0),
    'dev-tier':         el => devJump(0, Number(el.dataset.delta)),
    'dev-boss':         el => devFightBoss(el.dataset.boss),
    'dev-fight':        el => { currentTier = Math.min(currentTier, TOTAL_TIERS); initiateCombat(el.dataset.type, el.dataset.elite === '1'); },
    'dev-node':         el => { el.dataset.kind === 'EVENT' ? initiateEvent() : el.dataset.kind === 'SHOP' ? initiateShop() : initiateCamp(); },
    'dev-give':         el => devGive(el.dataset.kind),
    'dev-win':          () => devResolve(true),
    'dev-lose':         () => devResolve(false),
    'regroup':          () => regroupSquad(),
    'advance-sector':   () => advanceSector(),

    'node-event':       el => { enterNode(el.dataset.node); initiateEvent(); },
    'node-camp':        el => { enterNode(el.dataset.node); initiateCamp(); },
    'node-shop':        el => { enterNode(el.dataset.node); initiateShop(); },
    'node-recruit':     el => { enterNode(el.dataset.node); initiateRecruit(); },
    'shop-buy':         el => buyShopItem(Number(el.dataset.index)),
    'shop-reroll':      el => shopRerollQuirk(el.dataset.id),
    'shop-reroll-cancel': () => { shopRerollPick = false; renderShop(); },
    'shop-finish':      () => finishShop(),
    'seed-daily':       () => { document.getElementById('seed-input').value = dailySeed(); },
    'chronicle':        () => renderChronicle(),
    'inspect':          el => openDossier(el.dataset.id),
    'dossier-close':    () => closeDossier(),
    'explain':          el => openExplain(el.dataset.hit),
    'explain-close':    () => closeExplain(),
    'prompt-ok':        () => dismissPrompt(),
    'prompt-off':       () => disablePrompts(),
    'toggle-prompts':   () => { globalSettings.prompts = globalSettings.prompts === false; Store.set(SETTINGS_KEY, JSON.stringify(globalSettings)); updateSettingsUI(); },
    'ascension-cycle':  () => { ascension = (ascension + 1) % (unlockedProtocols() + 1); renderContracts(); },
    'loadout-bench':    el => {
        const ch = playerRoster.find(c => c.id === el.dataset.id);
        if (ch && masteryRank(ch.classType) >= 3) { ch.benchedMove = el.dataset.move; renderMuster(); }
    },
    'node-combat':      el => { enterNode(el.dataset.node); initiateCombat(el.dataset.type, el.dataset.elite === '1'); },

    'outpost-tab':      el => setOutpostTab(el.dataset.tab),
    'recruit-sign':     () => signOnRecruit(),
    'recruit-leave':    () => leaveRecruit(),
    'breakdown':        () => breakdownScrap(),
    'craft':            el => craftItem(el.dataset.item),
    'augment':          el => installAugment(el.dataset.id, el.dataset.kind),
    'sell-item':        el => useOutpostItem(Number(el.dataset.index)),
    'medbay':           el => medBay(el.dataset.id, el.dataset.mode),
    'buy-upg':          el => buyUpgrade(el.dataset.id, el.dataset.kind, Number(el.dataset.cost)),
    'assign-slot':      el => assignSlot(el.dataset.id, Number(el.dataset.slot)),
    'gear-menu':        el => { activeGearSelector = { charId: el.dataset.id, slot: el.dataset.slot }; renderOutpost(); },
    'equip-gear':       el => { equipGear(el.dataset.id, el.dataset.gear); activeGearSelector = null; renderOutpost(); },
    'unequip-gear':     el => { unequipGear(el.dataset.id, el.dataset.slot); activeGearSelector = null; renderOutpost(); },
    'assign-perk':      el => assignPerk(el.dataset.id, el.dataset.perk),
    'pos-menu':         el => { activePosSelector = el.dataset.id; activePerkSelector = null; renderOutpost(); },
    'perk-menu':        el => { activePerkSelector = el.dataset.id; activePosSelector = null; renderOutpost(); },
    'selector-cancel':  () => { activePosSelector = null; activePerkSelector = null; activeGearSelector = null; renderOutpost(); },

    'event-choice':     el => resolveEvent(Number(el.dataset.index)),
    'consequence-ack':  () => resolveConsequence(),
    'event-finish':     () => finishEvent(),
    'camp-choice':      el => resolveCamp(el.dataset.kind),
    'camp-extract':     () => armExtract(),
    'camp-extract-go':  () => extractRun(),
    'camp-finish':      () => finishCamp(),

    'queue':            el => queueAction(el.dataset.move, el.dataset.variant),
    'self':             el => executeSelfAction(el.dataset.move),
    'cancel':           () => cancelAction(),
    'skip-turn':        () => skipStunnedTurn(),
    'tactic':           el => spendTactic(el.dataset.kind),
    'bag':              () => openInventoryMenu(),
    'target':           el => resolveAction(el.dataset.id),
    'use-item':         el => resolveConsumableItem(el.dataset.id),
    'loot':             el => collectLoot(Number(el.dataset.amount)),
    'end-run':          () => endRun(),
    'squad-down':       () => handleSquadWipe()
};

function dispatchAction(el) {
    if (!el || el.disabled) return;
    playSFX('click');
    const handler = ACTIONS[el.dataset.action];
    if (handler) handler(el);
    else console.warn('Unmapped action:', el.dataset.action);
}

document.addEventListener('click', e => dispatchAction(e.target.closest('[data-action]')));

// Last resort: if a sprite ever fails to load, hide it rather than stamping a broken-image
// icon across the battlefield - the health bar and turn queue still identify the unit. Error
// events do not bubble, so this listens in the capture phase.
document.addEventListener('error', e => {
    const el = e.target;
    if (el && el.tagName === 'IMG' && el.classList.contains('portrait')) el.style.visibility = 'hidden';
}, true);

// Buttons handle Enter and Space themselves; the elements that are not buttons - the combat
// targets - need it wired up so the game is playable without a pointer.
document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'BUTTON') return;
    e.preventDefault();
    dispatchAction(el);
});

// The whole audio design was four blips straight onto the destination node: click, shoot, hit,
// heal, the same shotgun as the same pistol as the same set of teeth. Everything below is one
// table of voices, a bus to mix them through, and a bed underneath so a fight has a room to
// happen in.
const SFX = {
    click:    { wave: 'square',   from: 880, to: 880, dur: 0.06, gain: 0.03 },
    // one per weapon class, so a shotgun does not sound like a rifle
    blade:    { wave: 'square',   from: 1400, to: 300, dur: 0.09, gain: 0.05, noise: 0.35, filter: 2600 },
    heavy:    { wave: 'triangle', from: 260,  to: 60,  dur: 0.22, gain: 0.11, noise: 0.30, filter: 700 },
    pistol:   { wave: 'square',   from: 900,  to: 220, dur: 0.10, gain: 0.06, noise: 0.30, filter: 2200 },
    rifle:    { wave: 'sawtooth', from: 750,  to: 150, dur: 0.14, gain: 0.07, noise: 0.25, filter: 1800 },
    shotgun:  { wave: 'sawtooth', from: 420,  to: 70,  dur: 0.26, gain: 0.12, noise: 0.75, filter: 1100 },
    flame:    { wave: 'sawtooth', from: 180,  to: 420, dur: 0.30, gain: 0.07, noise: 0.85, filter: 900 },
    beast:    { wave: 'sawtooth', from: 520,  to: 90,  dur: 0.16, gain: 0.09, noise: 0.55, filter: 1500 },
    // outcomes. An impact used to be one voice at three volumes; a scratch, a solid landing
    // and a shell that takes a third of somebody off are three different sounds now, and the
    // two results that change a decision - a weakness found, a unit down - have their own.
    graze:    { wave: 'triangle', from: 320,  to: 170, dur: 0.06, gain: 0.05, noise: 0.18, filter: 2600 },
    hit:      { wave: 'triangle', from: 200,  to: 55,  dur: 0.12, gain: 0.09 },
    crunch:   { wave: 'triangle', from: 150,  to: 42,  dur: 0.20, gain: 0.12, noise: 0.40, filter: 1000, chord: [1, 0.5] },
    crush:    { wave: 'sawtooth', from: 120,  to: 30,  dur: 0.34, gain: 0.15, noise: 0.65, filter: 620,  chord: [1, 0.5, 1.5] },
    soak:     { wave: 'square',   from: 280,  to: 230, dur: 0.08, gain: 0.06, noise: 0.22, filter: 1400 },
    weak:     { wave: 'square',   from: 1500, to: 260, dur: 0.24, gain: 0.11, noise: 0.35, filter: 3200, chord: [1, 1.5, 2] },
    downed:   { wave: 'sawtooth', from: 300,  to: 38,  dur: 0.50, gain: 0.13, noise: 0.45, filter: 760,  chord: [1, 0.5] },
    fallen:   { wave: 'sine',     from: 240,  to: 46,  dur: 0.90, gain: 0.10, noise: 0.20, filter: 400,  chord: [1, 0.5, 0.75] },
    heal:     { wave: 'sine',     from: 440,  to: 880, dur: 0.18, gain: 0.05 },
    combo:    { wave: 'square',   from: 660,  to: 1320,dur: 0.20, gain: 0.06 },
    enrage:   { wave: 'sawtooth', from: 90,   to: 40,  dur: 1.10, gain: 0.16, noise: 0.5, filter: 500, chord: [1, 1.5] },
    // the things that are not a weapon class
    blast:    { wave: 'sawtooth', from: 300,  to: 45,  dur: 0.40, gain: 0.13, noise: 0.9, filter: 800 },
    emp:      { wave: 'square',   from: 1800, to: 120, dur: 0.35, gain: 0.07, noise: 0.2, filter: 3000 },
    overdrive:{ wave: 'sawtooth', from: 220,  to: 900, dur: 0.55, gain: 0.12, noise: 0.3, filter: 2400, chord: [1, 1.25, 1.5] }
};

// Which voice an ability speaks with. Derived from the same ABILITIES table the deck and the
// reach rules read, so a new ability cannot end up silent by omission.
const CLASS_VOICE = { BRUISER: 'blade', MEDIC: 'pistol', SCAVENGER: 'rifle',
    PYROMANIAC: 'flame', SHOTGUNNER: 'shotgun', SNIPER: 'rifle', HOUND: 'beast',
    TRENCH_FIEND: 'blade', HAZMAT: 'flame', HARPOONER: 'rifle' };
const MOVE_VOICE_OVERRIDE = { HEAVY_WRENCH: 'heavy', SCRAP_BLADE: 'blade', SLUG_SHOT: 'rifle',
    MOLOTOV: 'flame', THERMITE: 'flame', ACID_FLASK: 'flame', SNAP: 'beast',
    RIPSAW: 'heavy', TRENCH_SWEEP: 'heavy', CAUSTIC_BURST: 'flame', TANK_RUPTURE: 'blast',
    HARPOON: 'rifle', DRAG_LINE: 'heavy', WHALE_LINE: 'shotgun' };

function voiceFor(move) {
    if (MOVE_VOICE_OVERRIDE[move]) return MOVE_VOICE_OVERRIDE[move];
    const owner = Object.keys(ABILITIES).find(c => ABILITIES[c].some(a => a.move === move));
    return CLASS_VOICE[owner] || 'blade';
}

// A short bounded record of what was played. Nothing in the game reads it - it is here so the
// headless suites can tell a shotgun from a rifle without listening to one.
const SFX_LOG_MAX = 40;
let sfxLog = [];

let sfxBus = null, ambBus = null, ambienceNodes = null, ambienceBiome = null;

function initAudio() {
    if (!audioCtx && (sfxVol() > 0 || ambVol() > 0)) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { console.log('Web Audio API not supported.'); }
    }
    if (audioCtx && !sfxBus) {
        try { sfxBus = audioCtx.createGain(); sfxBus.connect(audioCtx.destination);
              ambBus = audioCtx.createGain(); ambBus.connect(audioCtx.destination); }
        catch (e) { sfxBus = null; ambBus = null; }
    }
    applyVolumes();
}

// Live, so turning the bed down mid-fight is heard at once rather than at the next node.
function applyVolumes() {
    try {
        if (sfxBus) sfxBus.gain.value = sfxVol();
        if (ambBus) ambBus.gain.value = ambVol();
    } catch (e) { /* a closed context is not worth throwing over */ }
}
// What the mixer is actually doing, for the suites and for anyone debugging a silent build.
function audioState() {
    return { ctx: !!audioCtx, split: !!(sfxBus && ambBus && sfxBus !== ambBus),
             sfxGain: sfxBus ? sfxBus.gain.value : null,
             ambGain: ambBus ? ambBus.gain.value : null };
}
// A save from before the split carries one boolean; honour it until the player sets a level.
function sfxVol() { return globalSettings.sfx === false ? 0 : (globalSettings.sfxVol ?? 1); }
function ambVol() { return globalSettings.sfx === false ? 0 : (globalSettings.ambVol ?? 0.7); }

// A short burst of filtered noise is what separates a shotgun from a tone at the same pitch.
function noiseBurst(t, dur, level, cutoff) {
    const frames = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    const buf = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff || 1500;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp); lp.connect(g); g.connect(sfxBus);
    src.start(t); src.stop(t + dur);
}

// weight 1 is the voice as written; a heavier hit is louder, lower and longer. delay puts a
// sound just behind the one before it, so a kill reads as a second event rather than a tail.
function playSFX(type, weight = 1, delay = 0) {
    const spec = SFX[type];
    if (spec) { sfxLog.push({ type, weight: Math.round(weight * 100) / 100 }); if (sfxLog.length > SFX_LOG_MAX) sfxLog.shift(); }
    if (sfxVol() <= 0 || !audioCtx || !spec) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (!sfxBus) initAudio();
        if (!sfxBus) return;
        const t = audioCtx.currentTime + Math.max(0, delay);
        const w = Math.max(0.5, Math.min(2.2, weight));
        const dur = spec.dur * (0.85 + w * 0.15);
        const drop = 1 / (0.8 + w * 0.2);
        for (const mult of (spec.chord || [1])) {
            const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
            osc.type = spec.wave;
            osc.frequency.setValueAtTime(Math.max(20, spec.from * mult * drop), t);
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to * mult * drop), t + dur);
            gain.gain.setValueAtTime(Math.min(0.4, spec.gain * (0.7 + w * 0.3)), t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(gain); gain.connect(sfxBus);
            osc.start(t); osc.stop(t + dur);
        }
        if (spec.noise) noiseBurst(t, dur, Math.min(0.35, spec.noise * spec.gain * (0.7 + w * 0.3)), spec.filter);
    } catch (e) {}
}

// "Impacts distinct enough that you can hear a crit without looking." Two things about a blow
// are worth hearing and they are independent, so they are two layers rather than one voice
// picked off a list: the band says what it was worth - the share of a target's health it took
// off - and the mark, a few milliseconds behind so the two fuse into one event, says what
// happened on the way in. Replacing the band with the mark was the first attempt and it threw
// the weight away: measured over twelve expeditions, 27% of all impacts were resisted and 19%
// found a weakness, so nearly half of them would have landed as the same thin clank whether
// they took off two health or two hundred.
const IMPACT_TIERS = [
    { at: 0.34, voice: 'crush'  },
    { at: 0.15, voice: 'crunch' },
    { at: 0.05, voice: 'hit'    },
    { at: 0,    voice: 'graze'  }
];
const SOAK_AT = 0.8;        // scale at or below this: armour or resistance blunted it
const WEAK_AT = 1.2;        // at or above: it went into something soft
const MARK_DELAY = 0.03;    // close enough to fuse with the band, far enough to colour it
const DEATH_DELAY = 0.11;   // far enough behind to read as a second event, not a tail

function impactVoice(share) {
    const tier = IMPACT_TIERS.find(t => share >= t.at);
    return (tier || IMPACT_TIERS[IMPACT_TIERS.length - 1]).voice;
}
function impactMark(scale) {
    if (scale <= SOAK_AT) return 'soak';
    if (scale >= WEAK_AT) return 'weak';
    return null;
}

function playImpact(dmg, target, scale = 1) {
    const share = target && target.maxHp ? dmg / target.maxHp : 0.1;
    playSFX(impactVoice(share), (0.6 + Math.min(1.6, share * 4)) * scale);
    const mark = impactMark(scale);
    if (mark) playSFX(mark, 1, MARK_DELAY);
    // A kill used to be whatever the last hit sounded like. One of your own going down and a
    // raider dropping are not the same event either.
    if (target && typeof target.hp === 'number' && target.hp <= 0)
        playSFX(target.isPlayer ? 'fallen' : 'downed', 1, DEATH_DELAY);
}

// A low bed under the fight, keyed to where it is happening. The first pass was one sine and one
// band of noise with the numbers swapped per backdrop - a room tone, not a room: every biome had
// the same shape at a different pitch, and it sat dead flat for the length of a fight. Each bed
// is layered now: a sub, a voice a fixed interval above it whose waveform carries the character,
// wind whose filter breathes instead of holding still, and a sparse event only that place makes.
// Under all of it sits a heat layer that comes up with momentum.
const AMBIENCE = {
    'bg_canyon.webp':     { drone: 62, interval: 1.50, voice: 'sine',     cutoff: 320, hiss: 0.020,
                            sway: 0.45, swayRate: 0.06, name: 'CANYON',
                            mote: { wave: 'sine',     from: 340, to: 150, dur: 1.9, gain: 0.026, noise: 0.5, filter: 700,  every: [7, 15] } },
    'bg_highway.webp':    { drone: 78, interval: 2.00, voice: 'sawtooth', cutoff: 420, hiss: 0.026,
                            sway: 0.30, swayRate: 0.11, name: 'HIGHWAY',
                            mote: { wave: 'sawtooth', from: 190, to: 88,  dur: 2.4, gain: 0.022, noise: 0.7, filter: 500,  every: [9, 19] } },
    'bg_refinery.webp':   { drone: 48, interval: 1.19, voice: 'square',   cutoff: 260, hiss: 0.032,
                            sway: 0.55, swayRate: 0.24, name: 'REFINERY',
                            mote: { wave: 'square',   from: 620, to: 610, dur: 1.1, gain: 0.018, noise: 1.4, filter: 2600, every: [5, 11] } },
    'bg_foundry.webp':    { drone: 40, interval: 2.51, voice: 'triangle', cutoff: 220, hiss: 0.036,
                            sway: 0.35, swayRate: 0.05, name: 'FOUNDRY',
                            mote: { wave: 'triangle', from: 980, to: 240, dur: 1.5, gain: 0.030, noise: 0.35, filter: 3000, every: [6, 13] } },
    'bg_nest.webp':       { drone: 92, interval: 3.02, voice: 'sawtooth', cutoff: 500, hiss: 0.030,
                            sway: 0.50, swayRate: 0.33, name: 'NEST',
                            mote: { wave: 'sawtooth', from: 1500, to: 820, dur: 0.5, gain: 0.024, noise: 0.3, filter: 3400, every: [4, 9] } },
    'bg_thunderdome.webp':{ drone: 55, interval: 1.26, voice: 'square',   cutoff: 360, hiss: 0.034,
                            sway: 0.60, swayRate: 0.09, name: 'THUNDERDOME',
                            mote: { wave: 'sawtooth', from: 150, to: 210, dur: 2.8, gain: 0.020, noise: 2.2, filter: 1100, every: [8, 16] } },
    'bg_combat.webp':     { drone: 70, interval: 1.40, voice: 'triangle', cutoff: 380, hiss: 0.022,
                            sway: 0.40, swayRate: 0.08, name: 'WASTES',
                            mote: { wave: 'sine',     from: 260, to: 70,  dur: 2.0, gain: 0.024, noise: 0.6, filter: 620,  every: [8, 17] } }
};
const DEFAULT_AMBIENCE = AMBIENCE['bg_combat.webp'];

// "A combat bed that thickens as momentum climbs." Under the floor it is just the room; from
// there to overdrive the low layer comes up, the wind opens, and the pulse beneath it speeds
// from a slow swell to something nearer a heartbeat.
const HEAT_FLOOR = 25;
const PULSE_SLOW = 0.35, PULSE_FAST = 2.4;
// A small speaker gives up somewhere below 300Hz, and a bed pitched at 40 is a bed nobody hears:
// rendered offline, four of the seven put almost everything they had under 100Hz. The character
// layer is lifted by whole octaves until it lands where a phone can reproduce it - octaves, so
// the interval that makes a foundry a foundry rather than a canyon survives the move.
const VOICE_FLOOR = 260;
function voiceLift(hz) { let f = hz; while (f < VOICE_FLOOR) f *= 2; return f; }
let ambienceBg = null;          // the backdrop file, not the display name - restarts read this
let ambienceHeatLevel = 0;      // 0 at rest, 1 at overdrive
let ambienceMotes = 0;          // how many place-sounds have fired, for the suites

function ambienceFor(bg) { return AMBIENCE[bg] || DEFAULT_AMBIENCE; }

function startAmbience(bg) {
    stopAmbience();
    if (ambVol() <= 0) return;
    initAudio();
    if (!audioCtx || !ambBus) return;
    const spec = ambienceFor(bg);
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const t = audioCtx.currentTime;
        const bed = audioCtx.createGain(); bed.gain.setValueAtTime(0, t);
        bed.gain.linearRampToValueAtTime(0.5, t + 1.5);
        bed.connect(ambBus);

        // 1. the sub - the floor of the room
        const sub = audioCtx.createOscillator(); sub.type = 'sine';
        sub.frequency.value = spec.drone;
        const subGain = audioCtx.createGain(); subGain.gain.value = 0.035;
        sub.connect(subGain); subGain.connect(bed); sub.start(t);

        // 2. the voice above it. The interval and the waveform are what make a foundry a foundry
        //    rather than a canyon at another pitch. Detuned a few cents so the two beat slowly
        //    against each other instead of sitting locked and lifeless.
        const voice = audioCtx.createOscillator(); voice.type = spec.voice || 'triangle';
        voice.frequency.value = voiceLift(spec.drone * (spec.interval || 1.5));
        try { voice.detune.value = 7; } catch (e) { /* older param, not worth failing the bed over */ }
        const voiceLp = audioCtx.createBiquadFilter(); voiceLp.type = 'lowpass';
        voiceLp.frequency.value = Math.max(spec.cutoff * 2.5, voice.frequency.value * 2.5);
        const voiceGain = audioCtx.createGain(); voiceGain.gain.value = 0.026;
        voice.connect(voiceLp); voiceLp.connect(voiceGain); voiceGain.connect(bed); voice.start(t);

        // 3. wind - two seconds of noise looped, filtered right down, with the cutoff swaying so
        //    it breathes. A filter that never moves is the tell that a bed is a loop.
        const frames = Math.floor(audioCtx.sampleRate * 2);
        const buf = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
        const wind = audioCtx.createBufferSource(); wind.buffer = buf; wind.loop = true;
        const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = spec.cutoff;
        const windGain = audioCtx.createGain(); windGain.gain.value = spec.hiss;
        wind.connect(lp); lp.connect(windGain); windGain.connect(bed); wind.start(t);

        const sway = audioCtx.createOscillator(); sway.type = 'sine';
        sway.frequency.value = spec.swayRate || 0.08;
        const swayDepth = audioCtx.createGain();
        swayDepth.gain.value = spec.cutoff * (spec.sway || 0.4);
        sway.connect(swayDepth); swayDepth.connect(lp.frequency); sway.start(t);

        // 4. heat - silent at rest. Wired up now rather than started on demand, so momentum is
        //    heard the moment it moves instead of at the next node. An octave above the sub and
        //    not below it: rendered offline, a saw at half the drone put everything it had under
        //    50Hz, moved the mix by 11% and would have been inaudible on the phone speaker this
        //    is played on.
        const heat = audioCtx.createOscillator(); heat.type = 'sawtooth';
        heat.frequency.value = spec.drone * 2;
        const heatLp = audioCtx.createBiquadFilter(); heatLp.type = 'lowpass'; heatLp.frequency.value = 500;
        const heatGain = audioCtx.createGain(); heatGain.gain.value = 0;
        heat.connect(heatLp); heatLp.connect(heatGain); heatGain.connect(bed); heat.start(t);

        // 5. the pulse under the heat, modulating its gain. Depth is zero until momentum moves.
        const pulse = audioCtx.createOscillator(); pulse.type = 'sine';
        pulse.frequency.value = PULSE_SLOW;
        const pulseDepth = audioCtx.createGain(); pulseDepth.gain.value = 0;
        pulse.connect(pulseDepth); pulseDepth.connect(heatGain.gain); pulse.start(t);

        ambienceNodes = { bed, lp, heatLp, heatGain, pulseDepth, pulse, spec, moteTimer: null,
                          parts: { sub, voice, wind, heat, pulse },
                          sources: [sub, voice, wind, sway, heat, pulse] };
        ambienceBiome = spec.name; ambienceBg = bg;
        scheduleMote();
        ambienceHeat();
    } catch (e) { ambienceNodes = null; ambienceBiome = null; ambienceBg = null; }
}

function stopAmbience() {
    if (ambienceNodes && ambienceNodes.moteTimer) clearTimeout(ambienceNodes.moteTimer);
    if (!ambienceNodes) { ambienceBiome = null; ambienceBg = null; ambienceHeatLevel = 0; return; }
    try {
        const t = audioCtx.currentTime;
        ambienceNodes.bed.gain.cancelScheduledValues(t);
        ambienceNodes.bed.gain.setValueAtTime(ambienceNodes.bed.gain.value, t);
        ambienceNodes.bed.gain.linearRampToValueAtTime(0.0001, t + 0.4);
        ambienceNodes.sources.forEach(s => { try { s.stop(t + 0.45); } catch (e) {} });
    } catch (e) {}
    ambienceNodes = null; ambienceBiome = null; ambienceBg = null; ambienceHeatLevel = 0;
}

// The layer you actually notice: every few seconds the place makes a sound of its own. Built
// straight onto the bed rather than through playSFX, because it is the room and not an effect -
// and because the effects log is a test surface that a background timer has no business writing.
function scheduleMote() {
    if (!ambienceNodes || !ambienceNodes.spec.mote) return;
    const [lo, hi] = ambienceNodes.spec.mote.every;
    ambienceNodes.moteTimer = setTimeout(() => { playMote(); scheduleMote(); },
        (lo + Math.random() * (hi - lo)) * 1000);
}

function playMote() {
    if (!ambienceNodes || !audioCtx || !ambBus || ambVol() <= 0) return;
    const m = ambienceNodes.spec.mote; if (!m) return;
    try {
        const t = audioCtx.currentTime;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(m.gain, t + Math.min(0.3, m.dur * 0.25));
        g.gain.exponentialRampToValueAtTime(0.0001, t + m.dur);
        g.connect(ambienceNodes.bed);
        const o = audioCtx.createOscillator(); o.type = m.wave;
        o.frequency.setValueAtTime(Math.max(20, m.from), t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, m.to), t + m.dur);
        o.connect(g); o.start(t); o.stop(t + m.dur + 0.05);
        if (m.noise) {
            const frames = Math.max(1, Math.floor(audioCtx.sampleRate * m.dur));
            const nb = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
            const d = nb.getChannelData(0);
            for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
            const src = audioCtx.createBufferSource(); src.buffer = nb;
            const nlp = audioCtx.createBiquadFilter(); nlp.type = 'lowpass';
            nlp.frequency.value = m.filter || 900;
            const ng = audioCtx.createGain();
            ng.gain.setValueAtTime(Math.min(0.12, m.noise * m.gain), t);
            ng.gain.exponentialRampToValueAtTime(0.0001, t + m.dur);
            src.connect(nlp); nlp.connect(ng); ng.connect(ambienceNodes.bed);
            src.start(t); src.stop(t + m.dur);
        }
        ambienceMotes++;
    } catch (e) {}
}

// Called on every momentum change, so the bed tracks the fight rather than the node.
function ambienceHeat() {
    if (!ambienceNodes || !audioCtx) { return ambienceHeatLevel; }
    const ceiling = Math.max(HEAT_FLOOR + 1, overdriveAt());
    const heat = combatActive
        ? Math.max(0, Math.min(1, (momentum - HEAT_FLOOR) / (ceiling - HEAT_FLOOR)))
        : 0;
    try {
        const t = audioCtx.currentTime, ease = 0.35;
        ambienceNodes.heatGain.gain.setTargetAtTime(0.075 * heat, t, ease);
        ambienceNodes.pulseDepth.gain.setTargetAtTime(0.055 * heat, t, ease);
        ambienceNodes.pulse.frequency.setTargetAtTime(PULSE_SLOW + (PULSE_FAST - PULSE_SLOW) * heat, t, ease);
        ambienceNodes.lp.frequency.setTargetAtTime(ambienceNodes.spec.cutoff * (1 + heat * 1.4), t, ease);
        ambienceNodes.heatLp.frequency.setTargetAtTime(500 + 1100 * heat, t, ease);
    } catch (e) { /* a closed context is not worth throwing over */ }
    ambienceHeatLevel = heat;
    return heat;
}

// What the bed is actually doing, for the suites and for anyone debugging a thin mix.
function ambienceState() {
    const n = ambienceNodes;
    return { biome: ambienceBiome, bg: ambienceBg, running: !!n,
             layers: n ? Object.keys(n.parts) : [], heat: ambienceHeatLevel, motes: ambienceMotes };
}

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

// ── Combat that moves ───────────────────────────────────────────────────────────────────
// All transform-based, no new art, and every effect sits behind prefers-reduced-motion:
// melee lunges to contact, ranged flashes and draws a tracer, the struck recoil, the dead
// fall once and stay fallen, and an enemy's intent pulses through the beat before it acts.
function motionOff() {
    // The operating system's preference is the default, not the only say: a player who wants
    // the animations on a machine set to reduce them can have them, and the reverse.
    if (globalSettings.motion === 'off') return true;
    if (globalSettings.motion === 'full') return false;
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}
// A one-shot class that removes itself - looked up again by id so a renderField rebuild
// between add and remove cannot strand it.
function flashClass(id, cls, ms) {
    if (motionOff()) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add(cls);
    setTimeout(() => { const live = document.getElementById(id); if (live) live.classList.remove(cls); }, ms);
}
function pulseIntent(ent) {
    if (motionOff()) return;
    const el = document.getElementById(ent.id);
    const icon = el && el.querySelector('.intent-icon');
    if (icon) icon.classList.add('intent-pulse');
}
function playAttackAnim(attacker, target, move) {
    if (motionOff()) return 'still';
    const a = document.getElementById(attacker.id);
    if (!a) return 'none';
    const melee = move ? moveReachFor(move, attacker) === 'melee' : attacker.range !== 'ranged';
    if (melee) { flashClass(attacker.id, attacker.isPlayer ? 'anim-lunge-right' : 'anim-lunge-left', 430); return 'lunge'; }
    const flash = document.createElement('div');
    flash.className = `muzzle-flash ${attacker.isPlayer ? 'flash-right' : 'flash-left'}`;
    a.appendChild(flash); setTimeout(() => flash.remove(), 240);
    const t = target ? document.getElementById(target.id) : null;
    const field = document.querySelector('.battlefield');
    if (t && field) {
        const ar = a.getBoundingClientRect(), tr = t.getBoundingClientRect(), br = field.getBoundingClientRect();
        const x1 = ar.left + ar.width / 2 - br.left, y1 = ar.top + ar.height * 0.55 - br.top;
        const x2 = tr.left + tr.width / 2 - br.left, y2 = tr.top + tr.height * 0.55 - br.top;
        const tracer = document.createElement('div');
        tracer.className = 'tracer-line';
        tracer.style.left = `${x1}px`; tracer.style.top = `${y1}px`;
        tracer.style.width = `${Math.hypot(x2 - x1, y2 - y1)}px`;
        tracer.style.transform = `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
        field.appendChild(tracer); setTimeout(() => tracer.remove(), 220);
    }
    return 'tracer';
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

function spawnFCT(id, text, cls) {
    const host = document.getElementById(id); if (!host) return;
    const el = document.createElement('div'); el.className = `fct ${cls}`; el.innerText = text;
    host.appendChild(el); setTimeout(() => el.remove(), 1000);
}

function addMomentum(amt) {
    momentum = Math.max(0, Math.min(100, momentum + amt));
    const fill = document.getElementById('momentum-fill'); const txt = document.getElementById('momentum-txt');
    if (fill) fill.style.width = momentum + '%';
    if (txt) txt.innerText = momentum >= overdriveAt() ? 'MOMENTUM: FULL — OVERDRIVE READY' : `MOMENTUM: ${momentum}%`;
    // The bar is not the only thing that moves. A fight you are winning gets heavier underneath.
    ambienceHeat();
}

// What the fight currently being fought has cost and how long it has run. The board reads it
// at the win; nothing else does.
let fightLog = null;
let chasedIn = false;      // set while the chase is being placed, read when the log is opened
let comboKill = false;     // true only while a combo's own blow is landing
let odKills = null;        // counts kills inside one overdrive, null when none is resolving
const BLITZ_TURNS = 6;     // squad turns, not actor turns - measured at a median of 9
const OVERKILL_AT = 2;     // kills in one overdrive
function newFightLog() { return { turns: 0, hurt: false, spent: false, chased: false }; }

// The original four counted what a squad was going to do anyway: kill things, craft things,
// trigger combos. None of them ever changed a decision. These ask for a fight won a particular
// way, a road taken on purpose, or a resource held that you would rather have spent - and the
// ones that need a system the opening sector has not shown yet wait until it has.
const BOUNTY_POOL = [
    { type: 'CRAFT', label: n => `CRAFT ${n} ITEMS`,        range: [2, 3], reward: 20 },
    { type: 'COMBO', label: n => `TRIGGER ${n} COMBOS`,     range: [3, 5], reward: 18 },
    { type: 'ELITE', label: n => `DEFEAT ${n} ELITE SQUAD${n > 1 ? 'S' : ''}`, range: [1, 2], reward: 75 },
    { type: 'KILL',  label: n => `DEFEAT ${n} HOSTILES`,    range: [6, 12], reward: 8 },

    { type: 'FLAWLESS', label: n => `WIN ${n} FIGHT${n > 1 ? 'S' : ''} UNTOUCHED`,            range: [1, 2], reward: 90 },
    { type: 'BLITZ',    label: n => `WIN ${n} FIGHT${n > 1 ? 'S' : ''} IN UNDER ${BLITZ_TURNS} TURNS`, range: [1, 2], reward: 80 },
    { type: 'FRUGAL',   label: n => `WIN ${n} FIGHT${n > 1 ? 'S' : ''} SPENDING NOTHING`,     range: [2, 3], reward: 50 },
    { type: 'OVERKILL', label: n => `TAKE ${OVERKILL_AT}+ WITH ONE OVERDRIVE, ${n} TIME${n > 1 ? 'S' : ''}`, range: [1, 2], reward: 85 },
    { type: 'EXECUTE',  label: n => `FINISH ${n} HOSTILES WITH A COMBO`,                      range: [3, 5], reward: 22 },
    { type: 'HEAVY',    label: n => `BRING DOWN ${n} HEAV${n > 1 ? 'IES' : 'Y'}`,             range: [2, 3], reward: 45 },
    { type: 'GROUND',   label: n => `WIN ${n} FIGHT${n > 1 ? 'S' : ''} ON BROKEN GROUND`,     range: [2, 3], reward: 40, minSector: 1 },
    { type: 'CHASED',   label: n => `TURN AND BREAK ${n} CHASE${n > 1 ? 'S' : ''}`,           range: [1, 2], reward: 95, minSector: 2 },
    // Always one, never two: measured at thirty expeditions the two-stranger version settled
    // once, which is a contract nobody will see. Earning one person's trust is already a run's
    // worth of deliberate choices.
    { type: 'TRUSTED',  label: () => `EARN A STRANGER'S TRUST`,                               range: [1, 1], reward: 280, minSector: 2 },
    { type: 'REACH',    label: n => `LAND ${n} MELEE BLOWS AT FULL REACH`,                    range: [4, 6], reward: 25 }
];

// One contract that runs the length of an expedition rather than the length of a node. Rarer,
// richer, and flat rather than sector-scaled: it is paid for the whole run, not for where the
// run happened to be standing when it finished.
const STANDING_POOL = [
    { type: 'S_BOSS',     label: n => `FELL ${n} COMMANDERS`,                 range: [2, 3], reward: 550 },
    { type: 'S_SECTOR',   label: n => `PUSH THROUGH ${n} SECTORS`,            range: [3, 4], reward: 420 },
    { type: 'S_BOND',     label: n => `TAKE A PAIRING TO RANK III`,           range: [1, 1], reward: 900 },
    { type: 'S_ELITE',    label: n => `BREAK ${n} ELITE SQUADS`,              range: [5, 7], reward: 130 },
    { type: 'S_FLAWLESS', label: n => `WIN ${n} FIGHTS UNTOUCHED`,            range: [4, 5], reward: 160 }
];
let standingBounty = null;

function rollBounty(exclude, rng = Math.random) {
    const deep = b => (b.minSector || 1) <= currentSector;
    let choices = BOUNTY_POOL.filter(b => !exclude.includes(b.type) && deep(b));
    if (choices.length === 0) choices = BOUNTY_POOL.filter(deep);
    if (choices.length === 0) choices = BOUNTY_POOL;
    let pick = choices[Math.floor(rng() * choices.length)];
    let target = pick.range[0] + Math.floor(rng() * (pick.range[1] - pick.range[0] + 1));
    return { type: pick.type, desc: pick.label(target), current: 0, target, reward: pick.reward * target * currentSector, claimed: false };
}

function rollStanding(rng = Math.random, exclude = []) {
    let choices = STANDING_POOL.filter(b => !exclude.includes(b.type));
    if (!choices.length) choices = STANDING_POOL;
    const pick = choices[Math.floor(rng() * choices.length)];
    const target = pick.range[0] + Math.floor(rng() * (pick.range[1] - pick.range[0] + 1));
    return { type: pick.type, desc: pick.label(target), current: 0, target, reward: pick.reward * target, standing: true };
}

// The opening slate is seeded (a daily is the same board for everyone); the replacements
// that rotate in mid-run depend on play, so they stay on live dice.
function boardSlots() { return BOARD_SLOTS + (metaUpgrades.warRoom ? 1 : 0); }
function generateBounties(rng = Math.random) {
    let out = [];
    for (let i = 0; i < boardSlots(); i++) out.push(rollBounty(out.map(b => b.type), rng));
    return out;
}

function checkBountyProgress(type, times = 1) {
    for (let i = 0; i < times; i++) advanceBounties(type);
}
function advanceBounties(type) {
    if (activeBounties) activeBounties.forEach((b, idx) => {
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
    // A standing contract shadows the board's vocabulary - ELITE on the board is S_ELITE here -
    // so one hook feeds both and no call site has to remember to fire twice. A moment with no
    // board twin (a commander felled, a sector crossed) simply matches nothing above.
    if (standingBounty && standingBounty.type === 'S_' + type) {
        standingBounty.current++;
        if (standingBounty.current >= standingBounty.target) {
            scrap += standingBounty.reward;
            log(`> STANDING CONTRACT SETTLED: ${standingBounty.desc} (+${standingBounty.reward} SCRAP)`, 'log-combo');
            firePrompt('STANDING');
            standingBounty = rollStanding(Math.random, [standingBounty.type]);
        }
    }
}

// What the board reads off a fight that has just been won. Every one of these is a way the
// fight was won rather than a thing that happened during it, which is the whole point of them.
function noteFightWon() {
    const f = fightLog || newFightLog();
    if (!f.hurt) checkBountyProgress('FLAWLESS');
    if (f.turns > 0 && f.turns < BLITZ_TURNS) checkBountyProgress('BLITZ');
    if (!f.spent) checkBountyProgress('FRUGAL');
    if (f.chased) checkBountyProgress('CHASED');
    if (currentTerrain && currentTerrain !== 'OPEN_ROAD') checkBountyProgress('GROUND');
}

// ── The dead stay dead ──────────────────────────────────────────────────────────────────
// An operator at zero used to be an inconvenience: fifty Scrap at the Outpost and they were
// back. Nothing in a run was ever actually lost, so no fight was ever actually dangerous -
// only expensive. They bleed out now.
//
// The shape of it is one rule rather than a table of them: going down starts a clock measured
// in that operator's own turns, and if nobody stops it before it runs out they are gone from
// the expedition. Winning the fight stops it - the squad holds the field and can get to them -
// and so does losing it, because the squad is being dragged off either way. So the danger is
// not "somebody fell", it is "somebody fell and this fight is still going", which is a thing
// the player can see coming and spend a turn on.
const BLEED_OUT = 3;          // their own turns, from falling to gone
const DRAGGED_CLEAR = 0.2;    // the share of health they come round on when the fight ends

// downTurns is only ever read while hp <= 0 and is set fresh on every fall, so any heal that
// lifts them above zero is a save without needing to know about any of this.
function isDown(e) { return !!e && e.isPlayer && !e.fallen && e.hp <= 0; }
// What can be pointed at somebody who is already on the floor. Everything else still stops at
// the living, so a downed operator is not a target for a swing or a swap.
const REACHES_THE_DOWN = ['CAUTERIZE', 'STIM_DART', 'ITEM_MED', 'ITEM_ADRENALINE'];
function bleedingOut() { return activeEntities.filter(e => isDown(e) && (e.downTurns || 0) > 0); }

function goDown(ent) {
    if (!ent || !ent.isPlayer || ent.fallen || (ent.downTurns || 0) > 0) return;
    ent.downTurns = BLEED_OUT;
    log(`> ${ent.name} is down and bleeding out - ${BLEED_OUT} turns.`, 'log-dmg');
}

// Their turn comes round and they spend it dying.
function tickBleedOut(ent) {
    if (!isDown(ent) || (ent.downTurns || 0) <= 0) return;
    ent.downTurns--;
    if (ent.downTurns > 0) {
        log(`> ${ent.name} is bleeding out. ${ent.downTurns} turn${ent.downTurns === 1 ? '' : 's'}.`, 'log-dmg');
        spawnFCT(ent.id, `${ent.downTurns}`, 'fct-dmg');
        return;
    }
    loseOperator(ent, 'BLED_OUT');
}

// Out of the roster, not out of the world: the body stays on the field for the rest of the
// fight, because everything that reads the field already gates on hp and because a squad that
// loses someone should have to look at it.
// A rank nobody is standing in is a hole the next fight walks straight through. Losses are
// replaced one for one from the bench once the fight is over - not to the cap, because running
// two on purpose to deepen a single bond is a real choice and this must not undo it.
let vacatedRanks = [];
function closeRanks() {
    const filled = [];
    const ranks = [...new Set(vacatedRanks)].sort();
    vacatedRanks = [];
    ranks.forEach(pos => {
        if (!pos || pos <= 0 || playerRoster.some(c => c.gridPos === pos)) return;
        const next = playerRoster.filter(c => c.gridPos === 0)
            .sort((a, b) => (b.hp / b.maxHp) - (a.hp / a.maxHp))[0];
        if (!next) return;
        next.gridPos = pos;
        filled.push(next.name);
        log(`> ${next.name} steps up into the ${(RANK_LABELS[pos] || '').toLowerCase()} rank.`, 'log-status');
    });
    return filled;
}

function loseOperator(ent, cause) {
    if (!ent || ent.fallen) return;
    ent.fallen = true; ent.downTurns = 0;
    if (ent.gridPos > 0) vacatedRanks.push(ent.gridPos);
    // Their kit is not buried with them.
    if (ent.trinket) { const g = gearById(ent.trinket); if (g && g.remove) g.remove(ent); gearStash.push(ent.trinket); ent.trinket = null; }
    if (ent.weaponMod) { gearStash.push(ent.weaponMod); ent.weaponMod = null; }
    playerRoster = playerRoster.filter(c => c.id !== ent.id);
    if (runStats) {
        runStats.fallen = runStats.fallen || [];
        runStats.fallen.push({ name: ent.name, classType: ent.classType, level: ent.level || 1,
                               sector: currentSector, tier: currentTier, cause,
                               killer: cause === 'BLED_OUT' && runStats.lastKiller ? runStats.lastKiller.name : null });
    }
    log(`> ${ent.name} is gone.`, 'log-dmg');
    spawnFCT(ent.id, 'LOST', 'fct-dmg');
    playSFX('fallen', 1.6); triggerShake();
}

// The fight is over, however it ended. Whoever was still on the clock is dragged clear.
function recoverDowned(how) {
    const saved = bleedingOut();
    saved.forEach(e => { e.hp = Math.max(1, Math.floor(e.maxHp * DRAGGED_CLEAR)); e.downTurns = 0; });
    if (saved.length) log(`> ${saved.map(e => e.name).join(' and ')} dragged clear${how ? ' ' + how : ''}.`, 'log-heal');
    return saved.map(e => e.id);
}

function nextTurn() {
    if (!combatActive || turnQueue.length === 0) return;
    let guard = 0;
    do {
        activeIndex = (activeIndex + 1) % turnQueue.length;
        guard++;
        // A downed operator keeps their place in the order. Their turn is the clock.
        const at = turnQueue[activeIndex];
        if (isDown(at)) tickBleedOut(at);
    } while (turnQueue[activeIndex] && turnQueue[activeIndex].hp <= 0 && guard <= turnQueue.length);
    if (!turnQueue[activeIndex] || turnQueue[activeIndex].hp <= 0) { checkWinState(); return; }
    processTurn();
}

function executeSelfAction(type) {
    let actEnt = turnQueue[activeIndex];
    if (type === 'IRON_GUARD') {
        actEnt.armor += 15; actEnt.armorTurns = 2; actEnt.guardTurns = 2; actEnt.cooldowns.iron_guard = 3;
        // Armour alone only ever protected the Bruiser. Bracing now covers the ranks behind it,
        // which is what gives the front rank a job beyond absorbing whatever walks into it.
        log(`> ${actEnt.name} braces and covers the line behind (+15 ARMOR).`, "log-status");
        spawnFCT(actEnt.id, "+ARMOR", "fct-heal"); playSFX('heal');
    }
    // The Fiend's opposite of bracing: he climbs out of the hole and pays for it in blood.
    if (type === 'OVER_THE_TOP') {
        const cost = hasTrait(actEnt, 'SECOND_LUNG') ? 0 : Math.max(1, Math.floor(actEnt.maxHp * FIEND_CHARGE_COST));
        actEnt.hp = Math.max(1, actEnt.hp - cost);
        actEnt.chargeTurns = CHARGE_TURNS + 1;   // spent down at the start of his own next turn
        actEnt.cooldowns.over_the_top = 4;
        log(cost > 0
            ? `> ${actEnt.name} goes over the top. -${cost} HP, and everything hits harder.`
            : `> ${actEnt.name} goes over the top without breaking stride.`, "log-status");
        spawnFCT(actEnt.id, "OVER THE TOP", "fct-combo"); playSFX('enrage', 0.7); triggerShake();
    }
    // The Hazmat's suit is a squad asset: the valve vents it over everyone standing.
    if (type === 'PURGE_VALVE') {
        const heal = 10 + (hasMod(actEnt, 'SCRUBBER_UNIT') ? 15 : 0);
        activeEntities.filter(e => e.isPlayer && e.hp > 0).forEach(a => {
            a.bleedingTurns = 0; a.oiledTurns = 0; a.corrodedTurns = 0;
            a.hp = Math.min(a.maxHp, a.hp + heal);
            spawnFCT(a.id, `+${heal}`, "fct-heal");
        });
        actEnt.cooldowns.purge_valve = hasTrait(actEnt, 'SPARE_FILTERS') ? 2 : 3;
        log(`> ${actEnt.name} vents the tanks. The squad is scrubbed clean and patched for ${heal}.`, "log-heal");
        playSFX('heal', 1.4);
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
    if (fightLog) fightLog.spent = true;
    if (pendingAction === 'ITEM_MED') {
        let heal = 30; target.hp = Math.min(target.maxHp, target.hp + heal);
        log(`> ${actEnt.name} injects ${target.name} with a Med-Stim (+${heal} HP).`, "log-heal"); spawnFCT(target.id, `+${heal}`, "fct-heal"); playSFX('heal');
    } else if (pendingAction === 'ITEM_ADRENALINE') {
        target.stunnedTurns = 0; target.bleedingTurns = 0; target.hp = Math.min(target.maxHp, target.hp + 10);
        log(`> ${target.name} surges with Adrenaline (cleansed, +10 HP).`, "log-heal"); spawnFCT(target.id, "CLEANSED", "fct-status"); playSFX('heal');
    } else if (pendingAction === 'ITEM_BOMB') {
        triggerShake(); log(`> ${actEnt.name} hurls a Scrap Bomb!`, "log-dmg"); playSFX('blast');
        applyDamageHit(actEnt, target, 35, 'phys', null);
    } else if (pendingAction === 'ITEM_EMP') {
        log(`> ${actEnt.name} detonates an EMP Charge!`, "log-dmg"); playSFX('emp');
        applyDamageHit(actEnt, target, 25, 'energy', null);
        if (target.hp > 0) { target.stunnedTurns = 1; log(`> ${target.name} systems disrupted!`, "log-status"); setTimeout(() => spawnFCT(target.id, "STUNNED", "fct-status"), 300 * globalSettings.combatSpeed); }
    }
    pendingAction = null; checkWinState();
}

// Losing the squad costs a regroup, not the expedition. Only when regroups run out does the
// run actually end - so a defeat never destroys a session the player did not choose to end.
function handleSquadWipe() {
    if (!runStats) runStats = newRunStats();
    // Being dragged off the field is still being off the field: the clock stops for whoever is
    // still on it. Throwing a fight to save somebody bleeding out is therefore a real move, and
    // it costs half the scrap, a fallback and the sector - which is a price, not an exploit.
    recoverDowned('as the squad is dragged off');
    // Nobody left to regroup is the one ending a fallback cannot buy back.
    if (!playerRoster.length) { endRun(); return; }
    if (regroupsLeft() > 0) renderSquadBroken();
    else endRun();
}

function regroupsLeft() {
    if (!runStats) return 0;
    if (typeof runStats.regroups !== 'number') runStats.regroups = totalRegroups();
    return Math.max(0, runStats.regroups);
}

function totalRegroups() { return hasContract('NO_REGROUPS') ? 0 : BASE_REGROUPS + (metaUpgrades.extraRegroups || 0); }

// Revive the squad, take half the scrap, and put them back at the start of the sector. The
// save is left intact - this is the outcome the player expects from losing a fight.
function regroupSquad() {
    if (regroupsLeft() <= 0) { endRun(); return; }
    runStats.regroups--;
    closeRanks();
    playerRoster.forEach(p => { p.hp = p.maxHp; p.stunnedTurns = 0; p.bleedingTurns = 0; p.armorTurns = 0; p.armor = 0; p.oiledTurns = 0; });
    // A Regroup Bond from the Armory prepays exactly one of these.
    if (regroupInsured) regroupInsured = false;
    else scrap = Math.floor(scrap / 2);
    // The fallback costs half the scrap, but the squad walks back in with tuned weapons -
    // a wipe should sting, not start a death spiral.
    tuneUpBattles = Math.max(tuneUpBattles, 3);
    currentTier = 1;
    // The sector keeps its map; the squad walks back in at the bottom of it.
    currentNodeId = null; clearedNodeIds = []; forecastWeather = null; forecastTerrain = null;
    momentum = 0; addMomentum(0);
    combatActive = false; activeEntities = []; turnQueue = []; pendingCombat = null;
    saveGameState();
    renderMap();
}

function renderSquadBroken() {
    firePrompt('REGROUP');
    combatActive = false; activeEntities = []; turnQueue = []; pendingCombat = null;
    momentum = 0; addMomentum(0);
    noteDepth();
    const left = regroupsLeft();
    switchScreen('screen-runover');
    document.getElementById('runover-title').innerText = 'SQUAD BROKEN';
    document.getElementById('runover-desc').innerText = regroupInsured
        ? `The squad is down but the expedition holds. The Regroup Bond covers this one — no scrap lost, back to the start of Sector ${currentSector}.`
        : `The squad is down but the expedition holds. Regrouping costs half your scrap and pushes you back to the start of Sector ${currentSector}.`;
    document.getElementById('runover-score').innerText = `${left} REGROUP${left === 1 ? '' : 'S'} LEFT`;
    document.getElementById('runover-best').innerText = `RUN SCORE SO FAR: ${computeScore(runStats).toLocaleString()} PTS`;
    document.getElementById('runover-lines').innerHTML = [
        ['SCRAP ON HAND', regroupInsured ? `${scrap} (BOND COVERS IT)` : `${scrap} \u2192 ${Math.floor(scrap / 2)}`],
        ['DEPTH REACHED', `SECTOR ${runStats.deepestSector} \u00B7 TIER ${runStats.deepestTier}`],
        ['SKULLS BANKED', `\uD83D\uDC80 ${bossSkulls}`]
    ].map(l => `<div class="runover-line"><span>${l[0]}</span><span>${l[1]}</span></div>`).join('');
    document.getElementById('runover-choices').innerHTML =
        `<button class="event-btn" style="border-color:#6B8E23; color:#6B8E23;" data-action="regroup">REGROUP (${left} LEFT)</button>` +
        `<button class="event-btn" style="border-color:#8B0000; color:#ff6666;" data-action="end-run">END RUN &amp; BANK SCORE</button>`;
    saveGameState();
}

// The run only ends when the player has no regroups left, or chooses to stop.
// ── The Chronicle ───────────────────────────────────────────────────────────────────────
// Endless mode had no memory: a run ended and left nothing but a best score. Every ended
// run now writes an entry - score, depth, contracts, relics, and an epitaph built from the
// real fight that ended it - into a bounded per-slot log, and the careers add up.
function chronicleKey(slot = currentSlot) { return 'wp_chronicle_' + slot; }
function careerKey(slot = currentSlot) { return 'wp_career_' + slot; }
function readChronicle(slot = currentSlot) {
    const v = Store.getJSON(chronicleKey(slot));
    return Array.isArray(v) ? v : [];
}
function readCareer(slot = currentSlot) {
    const v = Store.getJSON(careerKey(slot));
    return (v && v !== CORRUPT && !Array.isArray(v) && typeof v === 'object')
        ? { runs: v.runs || 0, kills: v.kills || 0, deepestSector: v.deepestSector || 0, fielded: v.fielded || {} }
        : { runs: 0, kills: 0, deepestSector: 0, fielded: {} };
}
function writeChronicle(entry) {
    const log = readChronicle();
    log.unshift(entry);
    if (log.length > 50) log.length = 50;
    Store.set(chronicleKey(), JSON.stringify(log));
    const c = readCareer();
    c.runs++; c.kills += entry.kills || 0;
    c.deepestSector = Math.max(c.deepestSector, entry.sector || 0);
    (entry.deployed || []).forEach(cl => { c.fielded[cl] = (c.fielded[cl] || 0) + 1; });
    Store.set(careerKey(), JSON.stringify(c));
}
// The epitaph tells the truth: whoever landed the last blow, or whatever the weather was.
function epitaphFor(st) {
    const k = st && st.lastKiller;
    if (!k) return `Vanished into the wasteland, Sector ${st ? st.deepestSector : 1}.`;
    const where = `Sector ${k.sector}, Tier ${k.tier}`;
    if (k.cause === 'SMOG') return `Choked out by the smog, ${where}.`;
    if (k.cause === 'SHRAPNEL') return `Cut down by shrapnel winds, ${where}.`;
    if (k.cause === 'BLEED') return `Bled out on the road, ${where}.`;
    const verbs = ['Torn apart by', 'Gunned down by', 'Broken by', 'Dragged down by', 'Finished by'];
    const verb = verbs[seedFromString(k.name || '') % verbs.length];
    const name = `${k.elite ? String(k.elite).toUpperCase() + ' ' : ''}${k.name}`;
    return `${verb} ${k.boss ? 'the warlord ' : 'a '}${name}, ${where}.`;
}
// The latest word across every slot, for the title screen.
function latestEpitaph() {
    let best = null;
    for (let s = 1; s <= 3; s++) readChronicle(s).forEach(e => { if (!best || (e.when || 0) > (best.when || 0)) best = e; });
    return best ? best.epitaph : null;
}

function renderChronicle() {
    switchScreen('screen-chronicle');
    const merged = { runs: 0, kills: 0, deepestSector: 0, fielded: {} };
    let entries = [];
    for (let s = 1; s <= 3; s++) {
        const c = readCareer(s);
        merged.runs += c.runs; merged.kills += c.kills;
        merged.deepestSector = Math.max(merged.deepestSector, c.deepestSector);
        Object.entries(c.fielded).forEach(([k, v]) => { merged.fielded[k] = (merged.fielded[k] || 0) + v; });
        entries = entries.concat(readChronicle(s));
    }
    entries.sort((a, b) => (b.when || 0) - (a.when || 0));
    entries = entries.slice(0, 50);
    const most = Object.entries(merged.fielded).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('chronicle-career').innerHTML = merged.runs === 0 ? '' :
        `<div class="career-line"><span>EXPEDITIONS</span><span>${merged.runs}</span></div>
         <div class="career-line"><span>HOSTILES KILLED</span><span>${merged.kills.toLocaleString()}</span></div>
         <div class="career-line"><span>DEEPEST EVER</span><span>SECTOR ${merged.deepestSector}</span></div>
         <div class="career-line"><span>MOST FIELDED</span><span>${most ? `${most[0]} (${most[1]})` : '—'}</span></div>`;
    // Two kinds of ending are on this list now, so it has to be possible to tell at a glance
    // which runs were walked out of and which the wasteland kept.
    document.getElementById('chronicle-list').innerHTML = entries.length ? entries.map(e =>
        `<div class="chronicle-entry${e.extracted ? ' chronicle-walked' : ''}">
            <div class="chronicle-epitaph">${e.extracted ? '<b>EXTRACTED</b> \u00B7 ' : ''}${e.epitaph || ''}</div>
            <div class="chronicle-facts">
                <span>${(e.score || 0).toLocaleString()} PTS</span>
                <span>S${e.sector || 1}·T${e.tier || 1}</span>
                <span>${e.kills || 0} kills</span>
                <span>${(e.relics || []).length} relics</span>
                ${e.withdrawals ? `<span>${e.withdrawals} abandoned</span>` : ''}
                ${(e.contracts || []).length ? `<span>signed: ${e.contracts.join(', ')}</span>` : ''}
                ${e.seed ? `<span class="chronicle-seed">${e.seed}</span>` : ''}
            </div>
        </div>`).join('')
        : `<div class="chronicle-empty">No expeditions on record. The wasteland is still waiting.</div>`;
}

function endRun() {
    combatActive = false; activeEntities = []; turnQueue = []; pendingCombat = null;
    momentum = 0; addMomentum(0);
    if (!runStats) runStats = newRunStats();
    noteDepth();
    const score = computeScore(runStats);
    const isBest = score > bestScore;
    if (isBest) bestScore = score;
    if (runStats.deepestSector > bestSector) bestSector = runStats.deepestSector;
    const seedPrev = noteSeedBest(runSeed, score);
    writeChronicle({
        when: Date.now(), score, sector: runStats.deepestSector, tier: runStats.deepestTier,
        kills: runStats.kills || 0, nodes: runStats.nodes || 0, withdrawals: runStats.withdrawals || 0,
        contracts: runStats.contracts || [], relics: activeRelics.map(r => r.name),
        seed: runSeed, extracted: !!runStats.extracted,
        epitaph: runStats.extracted
            ? `Walked out at Sector ${runStats.deepestSector}, Tier ${runStats.deepestTier}.`
            : epitaphFor(runStats),
        fallen: (runStats.fallen || []).map(f => ({ name: f.name, sector: f.sector, tier: f.tier })),
        deployed: playerRoster.filter(p => p.gridPos > 0).map(p => p.classType)
    });
    // Walking out carries the relic; the Vault is what keeps one when you do not. One call site,
    // so the two ways home cannot disagree about which relic came back.
    stashHeirloom(!!runStats.extracted);
    saveMeta();
    Store.remove(BASE_SAVE_KEY + currentSlot);
    renderRunOver(score, isBest, seedPrev);
}

// The Vault keeps one relic across the wipe. Which one is not left to chance or to whichever
// happened to drop first: it takes the best you were holding, rares before commons, and among
// equals the one you found first - so chasing a rare is worth doing on a run you expect to lose.
function heirloomFrom(relics) {
    if (!relics || relics.length === 0) return null;
    return relics.find(r => r.tier === 'RARE') || relics[0];
}
function stashHeirloom(walkedOut) {
    // The Vault keeps one through a wipe. Walking out keeps one because you are carrying it -
    // and that has to be remembered, because the reader below gates on the Vault and would
    // otherwise store a relic no Vault-less player could ever collect.
    if (!metaUpgrades.vault && !walkedOut) return;
    const keep = heirloomFrom(activeRelics);
    metaUpgrades.heirloom = keep ? keep.id : null;
    metaUpgrades.heirloomWalked = !!walkedOut && !!keep;
}
function heirloomRelic() {
    if (!metaUpgrades.heirloom) return null;
    if (!metaUpgrades.vault && !metaUpgrades.heirloomWalked) return null;
    return RELIC_POOL.find(r => r.id === metaUpgrades.heirloom) || null;
}

function renderRunOver(score, isBest, seedPrev = null) {
    switchScreen('screen-runover');
    const walked = !!(runStats && runStats.extracted);
    document.getElementById('runover-title').innerText = walked ? 'EXTRACTED' : 'RUN OVER';
    document.getElementById('runover-title').style.color = walked ? '#6B8E23' : '#ff4444';
    // The frame has to agree with the headline - a red box around EXTRACTED reads as a defeat.
    document.getElementById('runover-box').style.borderColor = walked ? '#6B8E23' : '#8B0000';
    document.getElementById('runover-desc').innerText = walked
        ? 'They walked out of it. Everything the expedition earned is banked, and the squad is still standing.'
        : 'The wasteland claimed them. What they salvaged reaches the Citadel.';
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
    // The names first, above the tally. An expedition that came home short says so before it
    // says how much scrap it made.
    if (st.extracted) lines.splice(1, 0, ['WALKED OUT WITH',
        `+${Math.round(extractBonus(st) * 100)}% SCORE \u00B7 \uD83D\uDC80 ${extractSkulls(st)} \u00B7 ${playerRoster.filter(p => p.hp > 0).length} STANDING`]);
    if ((st.fallen || []).length) lines.splice(1, 0, ['OPERATORS LOST',
        st.fallen.map(f => `${f.name} (S${f.sector}\u00B7T${f.tier})`).join(', ')]);
    if (st.withdrawals > 0) lines.splice(2, 0, ['FIGHTS ABANDONED', st.withdrawals]);
    if (st.retreats > 0) lines.splice(2, 0, ['FALLBACKS BOUGHT',
        `${st.retreats}${st.retreatsFailed ? ` (${st.retreatsFailed} failed)` : ''}`]);
    // Who the run met and how it left them. A name with nothing after it is a stranger you
    // happened to pass; the rest is the thread the expedition actually carried.
    const faces = facesMet();
    if (faces.length) lines.push(['FACES MET', faces.map(f => `${f.name} (${f.band.label.toLowerCase()})`).join(', ')]);
    // A score is only comparable if it says what it was earned under.
    if (st.contractMult && st.contractMult > 1) {
        lines.push(['CONTRACT BONUS', `x${st.contractMult.toFixed(2)}`]);
        lines.push(['SIGNED FOR', (st.contracts || []).join(', ')]);
    }
    // A seeded run scores on its own line: the seed, and the best anyone here has cut on it.
    if (runSeed) {
        lines.push(['PROTOCOL SEED', runSeed]);
        lines.push(['SEED BEST', score > (seedPrev || 0) ? '★ NEW SEED BEST ★' : `${(seedBests()[runSeed] || 0).toLocaleString()} PTS`]);
    }
    if (st.ascension > 0 && st.protocolMult > 1) {
        lines.push(['ASCENSION', `${PROTOCOLS[Math.min(st.ascension, PROTOCOLS.length) - 1].name} · x${st.protocolMult.toFixed(2)}`]);
    }
    document.getElementById('runover-lines').innerHTML = lines.map(l => `<div class="runover-line"><span>${l[0]}</span><span>${l[1]}</span></div>`).join('');
    document.getElementById('runover-choices').innerHTML =
        `<button class="event-btn" style="border-color:#4488ff; color:#4488ff;" data-action="citadel">CITADEL (\uD83D\uDC80 ${bossSkulls})</button>` +
        `<button class="event-btn" data-action="title">RETURN TO TITLE</button>`;
}

function collectLoot(amount, abandoned) {
    disarmWithdraw();
    closeRanks();
    // A node you ran from is not a node you cleared, and the run summary should not claim it was.
    scrap += amount;
    if (runStats) {
        runStats.scrapEarned += amount;
        if (abandoned) runStats.withdrawals = (runStats.withdrawals || 0) + 1; else runStats.nodes++;
    }
    currentTier++; noteDepth(); momentum = 0; addMomentum(0);
    activeEntities = []; turnQueue = []; pendingCombat = null; saveGameState();
    // A commander's reward is a decision, so it interrupts the return to the map rather than
    // being resolved silently behind it.
    if (pendingRelicOffer && pendingRelicOffer.length) { renderRelicOffer(); return; }
    if (pendingPerkOffers.length) { renderPerkOffer(); return; }
    renderMap();
}

function renderRelicOffer() {
    firePrompt('RELIC');
    if ((pendingRelicOffer || []).some(r => r.tier === 'CURSED')) firePrompt('CURSE');
    switchScreen('screen-relic');
    const c = document.getElementById('relic-choices');
    c.innerHTML = pendingRelicOffer.map((r, i) =>
        `<button class="relic-card relic-${r.tier.toLowerCase()}" data-action="take-relic" data-index="${i}">
            <span class="relic-card-tier">${r.tier}</span>
            <span class="relic-card-name">♦ ${r.name}</span>
            <span class="relic-card-desc">${r.desc}</span>
        </button>`).join('');
}

function takeRelic(index) {
    const pick = pendingRelicOffer && pendingRelicOffer[index];
    if (pick && !hasRelic(pick.id)) { activeRelics.push(pick); announceSets(); }
    pendingRelicOffer = null; saveGameState();
    if (pendingPerkOffers.length) { renderPerkOffer(); return; }
    renderMap();
}

let bestScore = 0; let bestSector = 0;

function saveMeta() { Store.set(META_KEY, JSON.stringify({ bossSkulls, metaUpgrades, bestScore, bestSector, mastery, bestiary, seenPrompts, grudges })); }

function newRunStats() { return { extracted: false, kills: 0, elites: 0, bosses: 0, scrapEarned: 0, nodes: 0, withdrawals: 0, retreats: 0, retreatsFailed: 0, recruited: 0, fallen: [], deepestSector: 1, deepestTier: 1, regroups: totalRegroups(), contractMult: contractMult(), contracts: contractNames(), protocolMult: protocolMult(), ascension }; }

// Endless scoring: depth is worth far more than any single haul, so pushing one sector
// deeper always beats farming the one you are on.
// ── Walking out ─────────────────────────────────────────────────────────────────────────
// Sixty simulated expeditions ended sixty times the same way: the squad was wiped out. There
// was no other ending in the game. A run could be long or short but never won, and no decision
// anywhere in it was ever "is this enough?" - depth was something that happened to you rather
// than a bet you were sizing.
//
// You can call it at a camp now. Everything the run earned banks with a bonus that grows the
// deeper you went, the Citadel takes a skull for every sector you cleared, and whatever relic
// you are holding comes home with you rather than being left in the dirt. The cost is the rest
// of the run: extraction ends it, and score climbs far faster with depth than the bonus does,
// so pushing on is always worth more if you survive. That is the whole of it - every camp asks
// whether the squad in front of you is worth one more sector.
const EXTRACT = {
    bonusPerSector: 0.06,   // of the run's score, per sector reached beyond the first
    maxBonus: 0.60,
    skullsPerSector: 1,
    minSector: 2            // nothing worth carrying home out of the first one
};
function extractBonus(st) {
    const reached = Math.max(1, (st || runStats || {}).deepestSector || 1);
    return Math.min(EXTRACT.maxBonus, EXTRACT.bonusPerSector * (reached - 1));
}
function extractSkulls(st) {
    const reached = Math.max(1, (st || runStats || {}).deepestSector || 1);
    return EXTRACT.skullsPerSector * (reached - 1);
}
// The offer is only ever made at a camp - the call is made at a fire, on a squad you can look
// at, not from a menu. This is the depth gate; the camp screen is what puts the button in reach.
function canExtract() {
    return !!runStats && currentSector >= EXTRACT.minSector && !combatActive;
}
function extractRun() {
    if (!canExtract()) return;
    noteDepth();
    runStats.extracted = true;
    bossSkulls += extractSkulls(runStats);
    playSFX('overdrive');
    endRun();   // banks the score, carries the relic home, and closes the slot
}

function computeScore(st) {
    if (!st) return 0;
    const base = (st.deepestSector - 1) * 2500
         + ((st.deepestSector - 1) * TOTAL_TIERS + (st.deepestTier - 1)) * 120
         + st.bosses * 900 + st.elites * 250 + st.kills * 15 + Math.floor(st.scrapEarned / 2);
    // The multiplier is stored on the run rather than read live, so a score already banked is
    // not re-scored by whatever the next expedition signs up for.
    // Walking out pays for itself; dying banks the raw figure.
    const out = st.extracted ? 1 + extractBonus(st) : 1;
    return Math.floor(base * (st.contractMult || 1) * (st.protocolMult || 1) * out);
}

function noteDepth() {
    if (!runStats) return;
    if (currentSector > runStats.deepestSector) { runStats.deepestSector = currentSector; runStats.deepestTier = currentTier; }
    else if (currentSector === runStats.deepestSector && currentTier > runStats.deepestTier) { runStats.deepestTier = currentTier; }
}

function loadMeta() {
    let d = Store.getJSON(META_KEY);
    if (d && d !== CORRUPT) {
        bossSkulls = d.bossSkulls || 0;
        metaUpgrades = { ...metaUpgrades, ...(d.metaUpgrades || {}) };
        bestScore = d.bestScore || 0; bestSector = d.bestSector || 0;
        mastery = (d.mastery && typeof d.mastery === 'object') ? d.mastery : {};
        grudges = (d.grudges && typeof d.grudges === 'object' && !Array.isArray(d.grudges)) ? d.grudges : {};
        bestiary = (d.bestiary && typeof d.bestiary === 'object' && !Array.isArray(d.bestiary)) ? d.bestiary : {};
        seenPrompts = Array.isArray(d.seenPrompts) ? d.seenPrompts.filter(id => typeof id === 'string') : [];
        return;
    }
    // No readable meta yet - adopt the best progress any slot recorded. A corrupt meta blob
    // falls through to the same rebuild rather than taking the boot down with it.
    for (let i = 1; i <= 3; i++) {
        let d = Store.getJSON(BASE_SAVE_KEY + i); if (!d || d === CORRUPT) continue;
        bossSkulls = Math.max(bossSkulls, d.bossSkulls || 0);
        if (d.metaUpgrades) {
            metaUpgrades.startScrap = Math.max(metaUpgrades.startScrap, d.metaUpgrades.startScrap || 0);
            metaUpgrades.startLevel = Math.max(metaUpgrades.startLevel, d.metaUpgrades.startLevel || 1);
            metaUpgrades.invMax = Math.max(metaUpgrades.invMax, d.metaUpgrades.invMax || 4);
            metaUpgrades.vault = Math.max(metaUpgrades.vault || 0, d.metaUpgrades.vault || 0);
            metaUpgrades.heirloom = d.metaUpgrades.heirloom || metaUpgrades.heirloom || null;
        }
    }
    saveMeta();
}

function migrateOldSaves() {
    for(let i=1; i<=3; i++) {
        let oldSave = Store.get('wasteland_rpg_v37_slot_' + i);
        if (oldSave && !Store.get(BASE_SAVE_KEY + i)) { Store.set(BASE_SAVE_KEY + i, oldSave); }
    }
    let oldSettings = Store.get('wasteland_rpg_settings');
    if (oldSettings && !Store.get(SETTINGS_KEY)) { Store.set(SETTINGS_KEY, oldSettings); }
}

// Art for a new warlord may not have landed yet, and a broken portrait is worse than a
// stand-in. Delegated rather than inline, because no inline handler survives in this codebase.
const PORTRAIT_FALLBACK = 'enemy_boss.webp';
function armPortraitFallback() {
    document.addEventListener('error', e => {
        const el = e.target;
        if (!el || el.tagName !== 'IMG' || !el.classList.contains('portrait')) return;
        if (el.dataset.fellBack) return;
        el.dataset.fellBack = '1';
        // A unit whose art is commissioned but not drawn yet names the piece to stand in for
        // it, so a rat does not fall back to a warlord portrait.
        el.src = el.dataset.stand || PORTRAIT_FALLBACK;
    }, true);
}

function initEngine() { 
    armPortraitFallback();
    preloadAssets();
    Store.probe();
    migrateOldSaves();
    loadMeta();
    let saved = Store.getJSON(SETTINGS_KEY);
    if (saved && saved !== CORRUPT) { globalSettings = { ...globalSettings, ...saved }; }
    applyTextScale();
    updateSettingsUI(); 
    renderTitleScreen(); 
}

function switchScreen(screenId) { if (screenId !== 'screen-combat') stopAmbience(); document.querySelectorAll('#engine > div:not(.settings-icon):not(#screen-settings)').forEach(el => el.style.display = 'none'); document.getElementById(screenId).style.display = 'flex'; if (screenId === 'screen-map' || screenId === 'screen-outpost' || screenId === 'screen-citadel') { document.getElementById('btn-global-settings').style.display = 'block'; } else { document.getElementById('btn-global-settings').style.display = 'none'; } }
function openSettings() { disarmErase(); document.getElementById('screen-settings').style.display = 'flex'; }
function closeSettings() { disarmErase(); document.getElementById('screen-settings').style.display = 'none'; }
function saveSettings() { Store.set(SETTINGS_KEY, JSON.stringify(globalSettings)); updateSettingsUI(); }
function toggleGameSpeed() { globalSettings.combatSpeed = globalSettings.combatSpeed === 1.0 ? 0.5 : 1.0; saveSettings(); }
// The old single switch stays honoured on load, and is retired the moment a level is chosen.
function cycleSfx() {
    globalSettings.sfx = true;
    globalSettings.sfxVol = cycleVol(sfxVol());
    if (globalSettings.sfxVol > 0) initAudio();
    applyVolumes(); saveSettings();
}
function cycleAmbience() {
    globalSettings.sfx = true;
    globalSettings.ambVol = cycleVol(ambVol());
    if (globalSettings.ambVol > 0) initAudio();
    applyVolumes();
    // A bed already playing is restarted or silenced to match, rather than waiting for the
    // next node to notice.
    // ambienceBiome is the display name; the table is keyed by backdrop. Restarting off the
    // name silently dropped every fight onto the fallback bed.
    if (globalSettings.ambVol <= 0) stopAmbience();
    else if (ambienceBg) startAmbience(ambienceBg);
    saveSettings();
}
function cycleMotion() {
    const i = MOTION_MODES.indexOf(globalSettings.motion);
    globalSettings.motion = MOTION_MODES[(i < 0 ? 0 : i + 1) % MOTION_MODES.length];
    applyTextScale(); saveSettings();
}
function cycleTextScale() {
    const i = TEXT_STEPS.indexOf(globalSettings.textScale);
    globalSettings.textScale = TEXT_STEPS[(i < 0 ? 0 : i + 1) % TEXT_STEPS.length];
    applyTextScale(); saveSettings();
}
// Both of these are read by the stylesheet rather than by the engine, so one place sets them.
function applyTextScale() {
    const r = document.documentElement;
    if (!r) return;
    r.style.setProperty('--text-scale', String(globalSettings.textScale || 1));
    r.classList.toggle('motion-off', motionOff());
}
function updateSettingsUI() {
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
    set('btn-toggle-speed', globalSettings.combatSpeed === 1.0 ? 'COMBAT SPEED: NORMAL' : 'COMBAT SPEED: FAST');
    set('btn-toggle-sfx', `SOUND EFFECTS: ${volName(sfxVol())}`);
    set('btn-toggle-amb', `AMBIENCE: ${volName(ambVol())}`);
    set('btn-toggle-motion', `ANIMATION: ${MOTION_NAMES[globalSettings.motion] || 'SYSTEM'}`);
    set('btn-toggle-text', `TEXT SIZE: ${TEXT_NAMES[Math.max(0, TEXT_STEPS.indexOf(globalSettings.textScale))]}`);
    set('btn-toggle-prompts', globalSettings.prompts === false ? 'FIELD PROMPTS: OFF' : 'FIELD PROMPTS: ON');
}
function returnToTitle() { closeSettings(); renderTitleScreen(); }
// A native confirm() is jarring on a phone, looks nothing like the game, and is suppressed
// outright in some browsers - which would silently erase or silently do nothing. Two-step the
// button instead: the first press arms it, the second commits.
let eraseArmed = false;

function disarmErase() {
    eraseArmed = false;
    const btn = document.getElementById('btn-erase');
    if (btn) { btn.innerText = 'ERASE SAVE DATA'; btn.classList.remove('btn-armed'); }
}

function eraseCurrentSave() {
    const btn = document.getElementById('btn-erase');
    if (!eraseArmed) {
        eraseArmed = true;
        if (btn) { btn.innerText = `CONFIRM — ERASE SLOT ${currentSlot}`; btn.classList.add('btn-armed'); }
        return;
    }
    Store.remove(BASE_SAVE_KEY + currentSlot);
    disarmErase(); closeSettings(); renderTitleScreen();
}

function showOutpostNotice(msg) {
    const el = document.getElementById('outpost-notice');
    if (!el) return;
    el.innerText = msg;
    el.style.display = msg ? 'block' : 'none';
}

function renderTitleScreen() {
    switchScreen('screen-title'); let menuHTML = '';
    if (bestScore > 0) menuHTML += `<div style="text-align:center; font-size:11px; letter-spacing:2px; color:#B8860B; margin-bottom:6px;">BEST RUN: ${bestScore.toLocaleString()} PTS \u00B7 SECTOR ${bestSector}</div>`;
    const lastWord = latestEpitaph();
    if (lastWord) menuHTML += `<div class="title-epitaph">"${lastWord}"</div>`;
    if (!Store.working) menuHTML += `<div class="title-warning">⚠ STORAGE UNAVAILABLE — THIS RUN WILL NOT BE SAVED</div>`;
    for(let i=1; i<=3; i++) {
        let d = Store.getJSON(BASE_SAVE_KEY + i);
        if (d === CORRUPT) {
            // An unreadable slot costs that slot, never the boot: offer to clear it in place.
            menuHTML += `<button class="title-btn btn-corrupt" data-action="erase-slot" data-slot="${i}">SLOT ${i} [ DAMAGED — ERASE ]</button>`;
        } else if (d) {
            menuHTML += `<button class="title-btn btn-continue" data-action="slot" data-slot="${i}" data-exists="1">SLOT ${i} [S${d.currentSector||1}-T${d.tier}]${d.combat ? ' ⚔' : ''}</button>`;
        } else {
            menuHTML += `<button class="title-btn" data-action="slot" data-slot="${i}" data-exists="0">SLOT ${i} [ EMPTY ]</button>`;
        }
    }
    menuHTML += `<button class="title-btn btn-meta" style="margin-top:12px;" data-action="citadel">CITADEL (💀 ${bossSkulls})</button>`;
    menuHTML += `<button class="title-btn" style="border-color:#8a8272; color:#8a8272;" data-action="chronicle">CHRONICLE</button>`;
    document.getElementById('title-menu-container').innerHTML = menuHTML;
    document.getElementById('title-menu-container').style.display = 'flex';
    document.getElementById('difficulty-menu-container').style.display = 'none';
}

function selectSlot(slotNum, exists) { currentSlot = slotNum; if (exists) { continueGame(); } else { document.getElementById('title-menu-container').style.display = 'none'; document.getElementById('difficulty-menu-container').style.display = 'flex'; } }

// Contracts are chosen after the difficulty and before the squad exists, because three of them
// change how that squad is built.
function openContracts(diff) {
    pendingDifficulty = diff; activeContracts = [];
    renderContracts();
}

function renderContracts() {
    switchScreen('screen-contracts');
    document.getElementById('contract-list').innerHTML = CONTRACT_POOL.map(c => {
        const on = hasContract(c.id);
        return `<button class="contract-card ${on ? 'contract-on' : ''}" data-action="toggle-contract" data-id="${c.id}">
            <span class="contract-head"><span class="contract-name">${on ? '☑' : '☐'} ${c.name}</span><span class="contract-bonus">+${Math.round(c.bonus * 100)}%</span></span>
            <span class="contract-desc">${c.desc}</span>
        </button>`;
    }).join('');
    const m = contractMult();
    document.getElementById('contract-mult').innerText =
        `SCORE x${m.toFixed(2)}${activeContracts.length ? ` — ${contractNames().join(', ')}` : ''}`;
    // The daily is the same wasteland for everyone who types it today, scored on its own line.
    const daily = dailySeed();
    const best = seedBests()[daily];
    document.getElementById('seed-note').innerText =
        `${daily} — ${best ? `your best ${best.toLocaleString()} PTS` : 'not yet attempted'}. Seeds fix the map, fronts, quirks and bounty slate; the fighting stays live.`;
    // The ascension rung: the ladder above the contracts, gated by real depth.
    const unlocked = unlockedProtocols();
    if (ascension > unlocked) ascension = unlocked;
    const btn = document.getElementById('ascension-btn');
    const note = document.getElementById('ascension-note');
    if (unlocked === 0) {
        btn.style.display = 'none';
        note.innerText = `Ascension opens at Sector ${PROTOCOLS[0].gate}. Deepest so far: ${bestSector || 1}.`;
    } else {
        btn.style.display = 'block';
        btn.innerText = ascension > 0 ? `▲ ${protocolName()} · SCORE x${protocolMult().toFixed(2)}` : '▲ ASCENSION: OFF';
        const next = PROTOCOLS[unlocked];
        note.innerText = (ascension > 0
            ? PROTOCOLS.slice(0, ascension).map(p => p.desc).join(' ')
            : `${unlocked} protocol${unlocked > 1 ? 's' : ''} earned. Each rung stacks every twist below it.`)
            + (next ? ` Next rung unlocks at Sector ${next.gate}.` : '');
    }
}

function toggleContract(id) {
    if (!CONTRACT_POOL.some(c => c.id === id)) return;
    activeContracts = hasContract(id) ? activeContracts.filter(x => x !== id) : [...activeContracts, id];
    playSFX('click'); renderContracts();
}

// Deploying now passes through the muster: the run is built (quirks rolled, map generated),
// then shown - who rolled what, who stands where - before the first node is taken.
function beginExpedition() {
    const typed = (document.getElementById('seed-input') ? document.getElementById('seed-input').value : '').trim().toUpperCase();
    runSeed = typed || null;
    buildNewRun(pendingDifficulty); renderMuster();
}

let musterRerolls = 0;
const MUSTER_REROLLS = 2;
const RANK_CYCLE = { 0: 1, 1: 2, 2: 3, 3: 0 };

function renderMuster() {
    firePrompt('MUSTER');
    switchScreen('screen-muster');
    document.getElementById('muster-rerolls').innerText = `⟳ ${musterRerolls} REROLLS LEFT`;
    const body = document.getElementById('muster-body');
    body.innerHTML = playerRoster.map(ch => {
        const pos = ch.gridPos;
        const posLbl = pos === 0 ? 'BENCH' : RANK_LABELS[pos];
        const rank = masteryRank(ch.classType);
        const title = rank >= 1 ? `<span class="muster-title" title="Dossier rank ${rank} — ${masteryXp(ch.classType).toLocaleString()} lifetime XP">★ ${MASTERY_TITLES[ch.classType]}</span>` : '';
        // Rank III brings four verbs to a three-slot deck: tap the one that sits out.
        let loadout = '';
        if (rank >= 3 && FOURTH_ABILITIES[ch.classType]) {
            const all = [...(ABILITIES[ch.classType] || []), FOURTH_ABILITIES[ch.classType]];
            const benched = (ch.benchedMove && all.some(a => a.move === ch.benchedMove)) ? ch.benchedMove : FOURTH_ABILITIES[ch.classType].move;
            loadout = `<div class="muster-loadout">` + all.map(a =>
                `<button class="loadout-chip ${a.move === benched ? 'chip-benched' : ''}" data-action="loadout-bench" data-id="${ch.id}" data-move="${a.move}">${a.move === benched ? '✕ ' : ''}${a.label}</button>`).join('') + `</div>`;
        }
        return `<div class="muster-row ${pos > 0 ? 'muster-deployed' : ''}">
            <div class="muster-who">
                <span class="muster-name">${ch.name}</span>
                <span class="muster-class">${ch.classType}</span>
                ${title}
                <span class="muster-quirk" title="${ch.quirk ? ch.quirk.desc : ''}">${ch.quirk ? ch.quirk.name : ''}</span>
                <span class="muster-quirk-desc">${ch.quirk ? ch.quirk.desc : ''}</span>
            </div>
            <div class="muster-stats">HP ${ch.maxHp} · DMG ${ch.dmgBase} · SPD ${ch.speed}</div>
            <div class="muster-ctl">
                <button class="muster-rank rank-btn-${pos}" data-action="muster-rank" data-id="${ch.id}">${posLbl}</button>
                <button class="muster-reroll" ${musterRerolls <= 0 ? 'disabled' : ''} data-action="muster-reroll" data-id="${ch.id}">⟳</button>
            </div>
            ${loadout}
        </div>`;
    }).join('');
    const deployed = playerRoster.filter(c => c.gridPos > 0).length;
    const cap = hasContract('SHORT_HANDED') ? 2 : 3;
    // Every deployed pair is a bond waiting to happen; the muster names them up front so
    // keeping a pair together is a choice, not an accident.
    const picked = playerRoster.filter(c => c.gridPos > 0);
    const pairNames = [];
    for (let i = 0; i < picked.length; i++)
        for (let j = i + 1; j < picked.length; j++) pairNames.push(bondName(picked[i], picked[j]));
    document.getElementById('muster-note').innerText =
        `${deployed}/${cap} deployed. Melee earns full damage in FRONT; ranged fights the same from anywhere. Enemy fire hunts the BACK.` +
        (pairNames.length ? ` Bonds this draft would forge: ${pairNames.join(', ')}.` : '');
    document.getElementById('muster-deploy').disabled = deployed < 1 || deployed > cap;
}

function musterRank(charId) {
    const ch = playerRoster.find(c => c.id === charId);
    if (!ch) return;
    const cap = hasContract('SHORT_HANDED') ? 2 : 3;
    let next = RANK_CYCLE[ch.gridPos] ?? 0;
    // Short Handed keeps the back rank empty for the whole expedition, the muster included.
    while (next !== 0 && (
        (hasContract('SHORT_HANDED') && next === 3) ||
        playerRoster.some(c => c.id !== charId && c.gridPos === next))) {
        next = RANK_CYCLE[next];
    }
    if (next !== 0 && playerRoster.filter(c => c.gridPos > 0 && c.id !== charId).length >= cap) next = 0;
    ch.gridPos = next;
    renderMuster();
}

function musterReroll(charId) {
    if (musterRerolls <= 0) return;
    const ch = playerRoster.find(c => c.id === charId);
    if (!ch || !ch.quirk) return;
    // Strip the old quirk's stats, roll a different one, apply it - health clamped to the new cap.
    ch.maxHp -= ch.quirk.hp; ch.dmgBase -= ch.quirk.dmg; ch.speed -= ch.quirk.spd;
    const pool = quirkPoolFor(ch.classType).filter(q => q.id !== ch.quirk.id);
    const q = pool[Math.floor(Math.random() * pool.length)];
    ch.quirk = q; ch.maxHp += q.hp; ch.dmgBase += q.dmg; ch.speed += q.spd;
    ch.hp = Math.min(ch.maxHp, Math.max(1, ch.hp + q.hp));
    musterRerolls--; playSFX('click');
    renderMuster();
}

function musterDeploy() {
    const deployed = playerRoster.filter(c => c.gridPos > 0).length;
    const cap = hasContract('SHORT_HANDED') ? 2 : 3;
    if (deployed < 1 || deployed > cap) return;
    saveGameState(); renderMap();
}

function confirmNewGame(diff) { buildNewRun(diff); renderMap(); }

function buildNewRun(diff) {
    difficultyMult = diff; currentSector = 1; currentTier = 1; tuneUpBattles = 0; momentum = 0;
    scrap = metaUpgrades.startScrap || 0; inventory = hasContract('NO_CONSUMABLES') ? [] : ['MED_STIM']; materials = { parts: 0, chems: 0, tech: 0 }; 
    playerRoster = migrateTraits(JSON.parse(JSON.stringify(ROSTER_TEMPLATE)));
    activeBounties = generateBounties(seededRng('bounties')); standingBounty = rollStanding(seededRng('standing'));
    runStats = newRunStats(); pendingRelicOffer = null;
    pendingConsequences = []; recentEvents = []; gearStash = []; pendingPerkOffers = [];
    // Nobody out here carries a grudge between expeditions. Every run starts among strangers.
    castState = {}; firedEvents = [];
    currentTerrain = 'OPEN_ROAD'; forecastTerrain = null;
    activeShop = null; regroupInsured = false; shopRerollPick = false;
    // Nobody carries over. Every expedition starts with the seven and finds the rest again.
    pendingRecruit = null;
    bossSalt = 'w' + Math.floor(Math.random() * 1e9);
    pursuit = null; armedExit = null; retreatNode = null; vacatedRanks = [];
    bonds = {}; bondSavesUsed = new Set();
    playerRoster.forEach(c => { c.weaponMod = null; c.trinket = null; });
    sectorFront = rollFront(seededRng('front:1'), 1); frontBannerPending = true;
    sectorMap = generateSectorMap(seededRng('map:1')); currentNodeId = null; clearedNodeIds = []; forecastWeather = null; forecastTerrain = null;
    odChoices = {}; pendingOverdrive = null; momentumFocus = 0; pressExtra = false;
    const kept = heirloomRelic();
    activeRelics = kept ? [kept] : [];
    // The Cache stocks a relic of its own, and never a second copy of what the Vault held.
    if (metaUpgrades.cache) {
        const stocked = rollRelic(0);
        if (stocked && !activeRelics.some(r => r.id === stocked.id)) activeRelics.push(stocked);
    }

    const qRng = seededRng('quirks');
    playerRoster.forEach(p => {
        const qPool = quirkPoolFor(p.classType);
        let q = qPool[Math.floor(qRng() * qPool.length)];
        const fourth = FOURTH_ABILITIES[p.classType];
        p.benchedMove = fourth ? fourth.move : null;
        p.quirk = q; p.maxHp += q.hp; p.hp = p.maxHp; p.dmgBase += q.dmg; p.speed += q.spd;
        p.level = metaUpgrades.startLevel; p.perkPoints = metaUpgrades.startLevel - 1; p.xpToNext = Math.floor(100 * Math.pow(XP_CURVE, metaUpgrades.startLevel - 1)); 
        if (hasContract('GLASS')) { p.maxHp = Math.max(1, Math.floor(p.maxHp * 0.75)); p.hp = p.maxHp; }
    });
    // The back rank stays empty, and stays empty - the Outpost refuses to fill it below.
    if (hasContract('SHORT_HANDED')) playerRoster.forEach(p => { if (p.gridPos === 3) p.gridPos = 0; });

    musterRerolls = MUSTER_REROLLS + (metaUpgrades.rerolls || 0);
    saveGameState(); 
}

function continueGame() {
    loadGameState(); addMomentum(0);
    if (pendingCombat) return resumeCombat(pendingCombat);
    if (pendingRelicOffer && pendingRelicOffer.length) return renderRelicOffer();
    if (pendingPerkOffers.length) return renderPerkOffer();
    if (activeShop) return renderShop();
    if (pendingRecruit && !pendingRecruit.taken) return renderRecruit();
    renderMap();
}

// Rebuilds a fight from its snapshot. Player entries are looked up in playerRoster by id so
// damage keeps landing on the live roster objects rather than on detached copies.
function resumeCombat(c) {
    currentNodeType = c.nodeType; isCurrentNodeElite = c.isElite; currentWeather = c.weather || 'CLEAR';
    currentTerrain = c.terrain || 'OPEN_ROAD';
    let players = (c.playerIds || []).map(id => playerRoster.find(p => p.id === id)).filter(Boolean);
    activeEntities = [...players, ...(c.enemies || [])];
    turnQueue = (c.queueIds || []).map(id => activeEntities.find(e => e.id === id)).filter(Boolean);
    bondSavesUsed = new Set(c.bondSaves || []);
    pendingCombat = null;
    if (turnQueue.length === 0) { renderMap(); return; }
    activeIndex = Math.min(c.activeIndex || 0, turnQueue.length - 1);
    combatActive = true;
    switchScreen('screen-combat'); document.getElementById('log').innerHTML = '';
    applyCombatScenery(c.bgFile || 'bg_combat.webp', currentNodeType === 'BOSS' ? bossForSector().banner : null);
    log("> COMBAT RESUMED.", "log-turn");
    processTurn();
}
function buildCombatSnapshot() {
    if (!combatActive || turnQueue.length === 0) return null;
    return {
        nodeType: currentNodeType, isElite: isCurrentNodeElite, weather: currentWeather, terrain: currentTerrain, bgFile: combatBgFile,
        activeIndex,
        playerIds: activeEntities.filter(e => e.isPlayer).map(e => e.id),
        enemies: activeEntities.filter(e => !e.isPlayer),
        queueIds: turnQueue.map(e => e.id),
        bondSaves: [...bondSavesUsed]
    };
}

function saveGameState() { Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify({ scrap, tier: currentTier, currentSector, difficultyMult, roster: playerRoster, inventory, materials, tuneUpBattles, activeBounties, standingBounty, momentum, odChoices, gearStash, pendingPerkOffers, activeShop, pendingRecruit, regroupInsured, bonds, sectorFront, runSeed, ascension, bossSalt, pendingConsequences, recentEvents, castState, firedEvents, sectorMap, currentNodeId, clearedNodeIds, activeRelics, relicOffer: pendingRelicOffer ? pendingRelicOffer.map(r => r.id) : null, runStats, pursuit, retreatNode, combat: buildCombatSnapshot() })); }

// A relic written to a save before the pool was tiered carries the old wording and no tier, so
// it is looked up again by id rather than trusted as stored. Anything whose id no longer exists
// is dropped rather than left as a relic that does nothing.
function migrateRelics(saved) {
    return (saved || []).map(r => RELIC_POOL.find(p => p.id === (r && r.id))).filter(Boolean);
}
function loadGameState() { let d = Store.getJSON(BASE_SAVE_KEY + currentSlot); if (d && d !== CORRUPT) { scrap = d.scrap || 0; currentTier = d.tier || 1; currentSector = d.currentSector || 1; difficultyMult = d.difficultyMult || 1.0; playerRoster = migrateAssetPaths(migrateTraits(d.roster || JSON.parse(JSON.stringify(ROSTER_TEMPLATE)))); inventory = d.inventory || ['MED_STIM']; materials = d.materials || { parts: 0, chems: 0, tech: 0 }; tuneUpBattles = d.tuneUpBattles || 0; activeBounties = d.activeBounties || generateBounties(); standingBounty = d.standingBounty || rollStanding(); momentum = d.momentum || 0; odChoices = d.odChoices || {};
        gearStash = (Array.isArray(d.gearStash) ? d.gearStash : []).filter(id => gearById(id));
        pendingPerkOffers = Array.isArray(d.pendingPerkOffers) ? d.pendingPerkOffers : [];
        // A shop mid-haggle survives the reload; stock lines whose ids no longer exist are culled.
        activeShop = (d.activeShop && Array.isArray(d.activeShop.stock)) ? d.activeShop : null;
        pendingRecruit = (d.pendingRecruit && d.pendingRecruit.nodeId) ? d.pendingRecruit : null;
        if (activeShop) activeShop.stock = activeShop.stock.filter(it =>
            (it.kind !== 'GEAR' || gearById(it.id)) && (it.kind !== 'RELIC' || RELIC_POOL.some(r => r.id === it.id)));
        regroupInsured = !!d.regroupInsured; shopRerollPick = false;
        bonds = (d.bonds && typeof d.bonds === 'object') ? d.bonds : {};
        // A save from before fronts existed finishes its current sector without one.
        sectorFront = frontById(d.sectorFront) ? d.sectorFront : null;
        frontBannerPending = false;
        runSeed = (typeof d.runSeed === 'string' && d.runSeed) ? d.runSeed : null;
        ascension = Number.isInteger(d.ascension) ? Math.max(0, Math.min(d.ascension, PROTOCOLS.length)) : 0;
        bossSalt = (typeof d.bossSalt === 'string' && d.bossSalt) ? d.bossSalt : 'w0';
        // Gear fields on a roster saved before gear existed, and any id that no longer exists,
        // resolve to empty slots rather than phantom equipment.
        playerRoster.forEach(c => {
            if (c.weaponMod && !gearById(c.weaponMod)) c.weaponMod = null;
            if (c.trinket && !gearById(c.trinket)) c.trinket = null;
            if (c.weaponMod === undefined) c.weaponMod = null;
            if (c.trinket === undefined) c.trinket = null;
        }); pendingConsequences = Array.isArray(d.pendingConsequences) ? d.pendingConsequences : []; recentEvents = Array.isArray(d.recentEvents) ? d.recentEvents : [];
        // A save written before the cast existed has no standings, which is the same thing as
        // having met nobody - the run carries on among strangers rather than breaking.
        castState = (d.castState && typeof d.castState === 'object') ? d.castState : {};
        firedEvents = Array.isArray(d.firedEvents) ? d.firedEvents : [];
        // A save from before routes existed gets a fresh map with its whole current tier open.
        sectorMap = (d.sectorMap && Array.isArray(d.sectorMap.nodes)) ? d.sectorMap : generateSectorMap();
        currentNodeId = d.currentNodeId || null;
        clearedNodeIds = Array.isArray(d.clearedNodeIds) ? d.clearedNodeIds : [];
        forecastWeather = null; activeRelics = migrateRelics(d.activeRelics); pendingRelicOffer = migrateRelics((d.relicOffer || []).map(id => ({ id }))); if (!pendingRelicOffer.length) pendingRelicOffer = null; pendingCombat = d.combat || null; pursuit = (d.pursuit && Array.isArray(d.pursuit.units)) ? d.pursuit : null; retreatNode = d.retreatNode || null;
        if (pendingCombat) {
            migrateAssetPaths(pendingCombat.enemies);
            if (typeof pendingCombat.bgFile === 'string') pendingCombat.bgFile = pendingCombat.bgFile.replace(/\.png$/, '.webp');
        } runStats = d.runStats || newRunStats();
        if (typeof runStats.regroups !== 'number') runStats.regroups = totalRegroups(); } }

// --- Dev tools -----------------------------------------------------------------------------
// Reaching a boss meant playing ten nodes to get there. This jumps straight to any fight or
// state worth testing. It only ever writes through the normal functions, so anything it sets
// up behaves exactly as it would in a real run.
function renderDev() {
    switchScreen('screen-dev');
    closeSettings();
    const inFight = combatActive;
    const group = (title, rows) => `<div class="dev-group"><div class="dev-title">${title}</div>${rows.join('')}</div>`;
    const btn = (label, action, data = '', style = '') =>
        `<button class="upg-btn dev-btn" ${style} data-action="${action}" ${data}>${label}</button>`;

    const body = [
        group(`Position — sector ${currentSector}, tier ${currentTier}/${TOTAL_TIERS}`, [
            `<div class="dev-row">` +
              btn('− Sector', 'dev-sector', 'data-delta="-1"') + btn('+ Sector', 'dev-sector', 'data-delta="1"') +
              btn('− Tier', 'dev-tier', 'data-delta="-1"') + btn('+ Tier', 'dev-tier', 'data-delta="1"') +
            `</div>`,
            `<div class="dev-row">` + btn('Jump to the boss tier', 'dev-tier', `data-delta="${TOTAL_TIERS - currentTier}"`) + `</div>`
        ]),
        group('Fight a boss now', [
            `<div class="dev-row">` + BOSS_POOL.map(b =>
                btn(b.short, 'dev-boss', `data-boss="${b.id}"`, 'style="border-color:#8B0000; color:#ff6666;"')).join('') + `</div>`
        ]),
        group('Fight a node now', [
            `<div class="dev-row">` +
              btn('Raiders', 'dev-fight', 'data-type="RAIDERS" data-elite="0"') +
              btn('Beasts', 'dev-fight', 'data-type="BEASTS" data-elite="0"') +
              btn('Mech', 'dev-fight', 'data-type="MECH" data-elite="0"') +
              btn('Elite', 'dev-fight', 'data-type="RAIDERS" data-elite="1"') +
            `</div>`,
            `<div class="dev-row">` + btn('Event', 'dev-node', 'data-kind="EVENT"') + btn('Camp', 'dev-node', 'data-kind="CAMP"') + btn('Shop', 'dev-node', 'data-kind="SHOP"') + `</div>`
        ]),
        group(`Supplies — ${scrap} scrap, ${bossSkulls} skulls`, [
            `<div class="dev-row">` +
              btn('+500 scrap', 'dev-give', 'data-kind="SCRAP"') +
              btn('+10 materials', 'dev-give', 'data-kind="MATS"') +
              btn('Fill bag', 'dev-give', 'data-kind="BAG"') +
              btn('+1 skull', 'dev-give', 'data-kind="SKULL"') +
            `</div>`
        ]),
        group('Squad', [
            `<div class="dev-row">` +
              btn('Full heal', 'dev-give', 'data-kind="HEAL"') +
              btn('+1 level', 'dev-give', 'data-kind="LEVEL"') +
              btn('+3 perks', 'dev-give', 'data-kind="PERKS"') +
              btn('Grant relic', 'dev-give', 'data-kind="RELIC"') +
            `</div>`,
            `<div class="dev-row">` + btn('Refill regroups', 'dev-give', 'data-kind="REGROUP"') + `</div>`
        ]),
        group('Resolve the current fight', [
            `<div class="dev-row">` +
              btn(inFight ? 'Win it' : 'Win it (not in a fight)', 'dev-win', '', inFight ? 'style="border-color:#6B8E23; color:#9ec24e;"' : 'disabled') +
              btn(inFight ? 'Lose it' : 'Lose it (not in a fight)', 'dev-lose', '', inFight ? 'style="border-color:#8B0000; color:#ff6666;"' : 'disabled') +
            `</div>`
        ]),
        `<button class="return-btn" data-action="dev-exit">BACK TO THE MAP</button>`
    ].join('');
    document.getElementById('dev-body').innerHTML = body;
}

function devJump(deltaSector, deltaTier) {
    currentSector = Math.max(1, currentSector + deltaSector);
    currentTier = Math.min(TOTAL_TIERS, Math.max(1, currentTier + deltaTier));
    // A jump breaks route continuity on purpose: the whole target tier opens up.
    if (deltaSector !== 0 || !sectorMap) { sectorMap = generateSectorMap(); clearedNodeIds = []; }
    currentNodeId = null; forecastWeather = null; forecastTerrain = null;
    noteDepth(); saveGameState(); renderDev();
}

// Steps forward to the next sector that fields the requested commander, so the fight arrives at
// a difficulty that matches how deep the run already is.
function devFightBoss(bossId) {
    if (!BOSS_POOL.some(b => b.id === bossId)) return;
    // The rotation is a seeded shuffle now, not a modulo, so walk it rather than compute it.
    let s = currentSector, guard = 0;
    while (bossForSector(s).id !== bossId && guard++ < 500) s++;
    currentSector = s; currentTier = TOTAL_TIERS;
    noteDepth(); saveGameState();
    initiateCombat('BOSS', false);
}

function devGive(kind) {
    if (kind === 'SCRAP') scrap += 500;
    else if (kind === 'MATS') { materials.parts += 10; materials.chems += 10; materials.tech += 10; }
    else if (kind === 'BAG') { inventory = []; const all = Object.keys(ITEM_DATA); while (inventory.length < metaUpgrades.invMax) inventory.push(all[inventory.length % all.length]); }
    else if (kind === 'SKULL') { bossSkulls++; saveMeta(); }
    else if (kind === 'HEAL') playerRoster.forEach(c => { c.hp = c.maxHp; c.stunnedTurns = 0; c.bleedingTurns = 0; });
    else if (kind === 'LEVEL') playerRoster.forEach(c => awardXp(c, c.xpToNext - c.xp));
    else if (kind === 'PERKS') playerRoster.forEach(c => { c.perkPoints += 3; });
    else if (kind === 'RELIC') { const left = unownedRelics(); if (left.length) activeRelics.push(left[0]); }
    else if (kind === 'OFFER') { pendingRelicOffer = rollRelicOffer(); renderRelicOffer(); return; }
    else if (kind === 'REGROUP') { if (runStats) runStats.regroups = totalRegroups(); }
    saveGameState(); renderDev();
}

function devResolve(win) {
    if (!combatActive) return;
    activeEntities.filter(e => win ? !e.isPlayer : e.isPlayer).forEach(e => { e.hp = 0; });
    checkWinState();
}

// ── The Citadel, drawn ──────────────────────────────────────────────────────────────────
// The hub was a list of cards. It is a hillside now: every meta-upgrade is a structure that
// visibly grows as it is bought, positioned as a tappable hotspot. The card list survives as
// the ledger view - same element ids, same actions - one toggle away.

const ARMORY_CUT = 8;      // percent off Armory stock per level of the contract
const BOARD_SLOTS = 3;     // contracts on the board before the War Room
// Every spot declares its own price, its own ceiling, what buying it does, and what has to be
// standing before it can be built. The ledger, the hillside and the purchase all read this one
// table - the cost used to be written here and again in the buy handler and a third time in the
// markup, where the names had already drifted apart from these.
const CITADEL_SPOTS = [
    { kind: 'SCRAP',   name: 'SCRAP CRANE', cost: 1,
      level: () => (metaUpgrades.startScrap || 0) / 50,
      apply: () => { metaUpgrades.startScrap = (metaUpgrades.startScrap || 0) + 50; },
      effect: l => `Expeditions start with +${l * 50} Scrap.`,
      pitch: 'Start new expeditions with +50 initial Scrap per level.' },
    { kind: 'LEVEL',   name: 'BARRACKS', cost: 2,
      level: () => (metaUpgrades.startLevel || 1) - 1,
      apply: () => { metaUpgrades.startLevel = (metaUpgrades.startLevel || 1) + 1; },
      effect: l => `Operators start ${l ? `+${l} level${l > 1 ? 's' : ''} higher` : 'at level 1'}.`,
      pitch: 'All operators permanently start +1 Level higher (grants early Perk point).' },
    { kind: 'INV',     name: 'RIGGING BAY', cost: 3,
      level: () => (metaUpgrades.invMax || 4) - 4,
      apply: () => { metaUpgrades.invMax = (metaUpgrades.invMax || 4) + 1; },
      effect: l => `${4 + l} tactical inventory slots.`,
      pitch: 'Increase maximum tactical inventory slots by +1.' },
    { kind: 'REGROUP', name: 'FALLBACK BUNKER', cost: 4,
      level: () => metaUpgrades.extraRegroups || 0,
      apply: () => { metaUpgrades.extraRegroups = (metaUpgrades.extraRegroups || 0) + 1; },
      effect: l => `${BASE_REGROUPS + l} regroups per expedition.`,
      pitch: 'Carry +1 extra regroup into every expedition.' },
    { kind: 'VAULT',   name: 'THE VAULT', cost: 5, max: 1,
      level: () => metaUpgrades.vault ? 1 : 0,
      apply: () => { metaUpgrades.vault = 1; },
      effect: () => vaultDescText(),
      pitch: 'Your best relic survives the expedition and arms the next one.' },

    // Five more, and a shallow tree: two of them need something else standing first.
    { kind: 'MUSTER',  name: 'MUSTER TENT', cost: 2, max: 3,
      level: () => metaUpgrades.rerolls || 0,
      apply: () => { metaUpgrades.rerolls = (metaUpgrades.rerolls || 0) + 1; },
      effect: l => `${MUSTER_REROLLS + l} quirk rerolls at the muster.`,
      pitch: 'One more reroll token at every muster, for the quirks that do not fit the plan.' },
    { kind: 'TRADE',   name: 'ARMORY CONTRACT', cost: 3, max: 3,
      level: () => metaUpgrades.discount || 0,
      apply: () => { metaUpgrades.discount = (metaUpgrades.discount || 0) + 1; },
      effect: l => l ? `Armory stock costs ${l * ARMORY_CUT}% less.` : 'Armory stock at full price.',
      pitch: `A standing arrangement: every Armory price drops ${ARMORY_CUT}% per level.` },
    { kind: 'ARCHIVE', name: 'THE ARCHIVE', cost: 4, max: 1,
      level: () => metaUpgrades.archive ? 1 : 0,
      apply: () => { metaUpgrades.archive = 1; },
      effect: l => l ? 'Every hostile file reads as already met.' : 'Files stay sealed until you have met the thing.',
      pitch: 'Files on every hostile in the wasteland, open from the first time you see one.' },
    { kind: 'WARROOM', name: 'WAR ROOM', cost: 5, max: 1, needs: 'ARCHIVE',
      level: () => metaUpgrades.warRoom ? 1 : 0,
      apply: () => { metaUpgrades.warRoom = 1; },
      effect: l => `${BOARD_SLOTS + (l ? 1 : 0)} contracts on the board at once.`,
      pitch: 'A fourth contract on the board. Needs the Archive: you cannot run what you cannot read.' },
    { kind: 'CACHE',   name: 'RELIC CACHE', cost: 7, max: 1, needs: 'VAULT',
      level: () => metaUpgrades.cache ? 1 : 0,
      apply: () => { metaUpgrades.cache = 1; },
      effect: l => l ? 'Every expedition deploys already holding a relic.' : 'Expeditions deploy with nothing.',
      pitch: 'Every expedition starts holding a relic. Needs the Vault - somewhere to keep them first.' }
];

// Whether a spot's prerequisite is standing. A spot with no `needs` is always available.
function spotUnlocked(sp) {
    if (!sp || !sp.needs) return true;
    const req = CITADEL_SPOTS.find(o => o.kind === sp.needs);
    return !!req && req.level() > 0;
}
function spotMaxed(sp) { return sp.max !== undefined && sp.level() >= sp.max; }
// What the hillside and the ledger print next to a name. A one-shot building reads as built or
// not; anything that stacks reads as a level.
function spotState(sp) {
    if (sp.kind === 'VAULT') return metaUpgrades.vault ? (metaUpgrades.heirloom ? 'ARMED' : 'EMPTY') : 'LOCKED';
    if (!spotUnlocked(sp)) return 'SEALED';
    if (sp.max === 1) return sp.level() ? 'BUILT' : 'LOCKED';
    return `LVL ${sp.level()}`;
}

function vaultDescText() {
    const kept = heirloomRelic();
    return !metaUpgrades.vault
        ? 'Your best relic survives the expedition and arms the next one.'
        : kept ? `Holding ${kept.name} — the next expedition starts with it.`
               : 'Unlocked. The next expedition that finds a relic will bank one here.';
}

// Compact silhouette drawings, one per structure. `lvl` lights them up: windows, glints and
// beacons appear as the structure is bought, so progress is visible from the hillside.

function renderCitadel() { switchScreen('screen-citadel'); document.getElementById('citadel-skulls').innerText = `${bossSkulls} 💀`;
    document.getElementById('citadel-list').innerHTML = CITADEL_SPOTS.map(sp => {
        const lvl = sp.level(), maxed = spotMaxed(sp), open = spotUnlocked(sp);
        const req = open ? null : CITADEL_SPOTS.find(o => o.kind === sp.needs);
        const label = maxed ? 'BUILT' : !open ? `NEEDS ${req ? req.name : sp.needs}` : `${sp.max === 1 ? 'UNLOCK' : 'UPGRADE'} [${sp.cost} 💀]`;
        return `<div class="upgrade-card ${open ? '' : 'upg-sealed'}">
            <div class="upgrade-header"><span>${sp.name}</span><span>${spotState(sp)}</span></div>
            <div class="upgrade-stats">${typeof sp.effect === 'function' ? sp.effect(lvl) : ''}</div>
            <div class="upgrade-pitch">${sp.pitch}</div>
            <button class="upg-btn btn-meta" ${maxed || !open || bossSkulls < sp.cost ? 'disabled' : ''} data-action="buy-meta" data-kind="${sp.kind}">${label}</button>
        </div>`;
    }).join('');
}
function buyMetaUpgrade(type) {
    const sp = CITADEL_SPOTS.find(o => o.kind === type);
    if (sp && !spotMaxed(sp) && spotUnlocked(sp) && bossSkulls >= sp.cost) {
        bossSkulls -= sp.cost;
        sp.apply();
    }
    saveMeta(); renderCitadel();
}

function renderMap() {
    switchScreen('screen-map');
    noteDepth();
    document.getElementById('scrap-display').innerText = formatStat(scrap);
    document.getElementById('map-sector-lbl').innerText = currentSector;
    document.getElementById('map-score-lbl').innerText = formatStat(computeScore(runStats));

    // The front rides the header for the whole sector; entering the sector gets the splash.
    const front = currentFront();
    const badge = document.getElementById('front-badge');
    badge.style.display = front ? 'flex' : 'none';
    if (front) { badge.innerHTML = `<span class="front-icon">${front.icon}</span><span>${front.name.toUpperCase()}</span>`; badge.title = front.desc; }
    const banner = document.getElementById('front-banner');
    if (front && frontBannerPending) {
        frontBannerPending = false;
        banner.querySelector('.front-banner-name').innerText = `${front.icon} ${front.name.toUpperCase()}`;
        banner.querySelector('.front-banner-desc').innerText = front.desc;
        banner.classList.remove('front-banner-show');
        void banner.offsetWidth;   // restart the animation when sectors chain quickly
        banner.classList.add('front-banner-show');
    }
    
    let bHtml = '';
    if(!activeBounties || activeBounties.length === 0) activeBounties = generateBounties();
    activeBounties.forEach(b => { let cls = b.claimed ? 'bounty-complete' : ''; bHtml += `<div class="bounty-item ${cls}"><span>${b.desc}</span><span>[${b.current}/${b.target}]</span></div>`; });
    // The run-long contract sits under the three, marked as its own thing: it does not rotate
    // when a node is cleared and it pays a great deal more.
    if (!standingBounty) standingBounty = rollStanding();
    bHtml += `<div class="bounty-item bounty-standing" title="A standing contract: it runs the length of the expedition and pays ${standingBounty.reward} Scrap.">`
           + `<span>\u2726 ${standingBounty.desc}</span><span>[${standingBounty.current}/${standingBounty.target}]</span></div>`;
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
    
    if (!sectorMap) sectorMap = generateSectorMap();
    const avail = new Set(availableNodeIds());
    const reach = reachableNodeIds();
    const cleared = new Set(clearedNodeIds);
    const yOf = t => (TOTAL_TIERS - t) * MAP_ROW_H + MAP_ROW_H / 2;

    // Edges first, under the nodes: gold-dashed where you can go, green where you have been,
    // near-black where the routing has already cut a path off.
    let edges = '';
    sectorMap.nodes.forEach(n => n.edges.forEach(id => {
        const to = nodeById(id); if (!to) return;
        let cls = 'edge-base';
        if (cleared.has(n.id) && cleared.has(to.id)) cls = 'edge-traveled';
        else if (n.id === currentNodeId && avail.has(to.id)) cls = 'edge-open';
        else if (!reach.has(to.id) && !cleared.has(to.id)) cls = 'edge-dim';
        edges += `<line class="${cls}" x1="${MAP_COL_X[n.col]}%" y1="${yOf(n.tier)}" x2="${MAP_COL_X[to.col]}%" y2="${yOf(to.tier)}"></line>`;
    }));

    if (sectorMap.nodes.some(n => n.edges.length > 1)) firePrompt('ROUTE');
    let m = `<div class="map-graph" style="height:${TOTAL_TIERS * MAP_ROW_H}px">`;
    m += `<svg class="map-edges" aria-hidden="true">${edges}</svg>`;
    sectorMap.nodes.forEach(n => {
        let icon = '🎯', lbl = n.type;
        if (n.type === 'BOSS') { const bb = bossForSector(); icon = '💀'; lbl = risenShort(bb, grudgeOn(bb.id)); }
        else if (n.type === 'BEASTS') icon = '☣️';
        else if (n.type === 'MECH') icon = '⚙️';
        else if (n.type === 'EVENT') { icon = '❓'; lbl = 'UNKNOWN'; }
        else if (n.type === 'CAMP') icon = '⛺';
        else if (n.type === 'SHOP') { icon = '◇'; lbl = 'ARMORY'; }
        else if (n.type === 'RECRUIT') { icon = '⛑'; lbl = 'SURVIVOR'; }
        const status = cleared.has(n.id) ? 'cleared' : avail.has(n.id) ? 'active' : 'locked';
        const cutoff = (status === 'locked' && !reach.has(n.id)) ? 'node-cutoff' : '';
        const eCls = n.elite ? 'elite-node' : n.type === 'EVENT' ? 'event-node' : n.type === 'CAMP' ? 'camp-node'
                   : n.type === 'SHOP' ? 'shop-node' : n.type === 'RECRUIT' ? 'recruit-node' : '';
        const act = n.type === 'EVENT' ? `data-action="node-event"` : n.type === 'CAMP' ? `data-action="node-camp"`
                  : n.type === 'SHOP' ? `data-action="node-shop"`
                  : n.type === 'RECRUIT' ? `data-action="node-recruit"`
                  : `data-action="node-combat" data-type="${n.type}" data-elite="${n.elite ? 1 : 0}"`;
        const wx = WEATHER_DOTS[n.weather] || '';
        const gr = (n.terrain && n.terrain !== 'OPEN_ROAD') ? TERRAIN[n.terrain] : null;
        m += `<button class="map-node node-${status} ${cutoff} ${eCls} ${(n.type === 'BOSS' && status === 'active') ? 'boss-node' : ''}" style="left:${MAP_COL_X[n.col]}%; top:${(TOTAL_TIERS - n.tier) * MAP_ROW_H + (MAP_ROW_H - 75) / 2}px" ${status === 'active' ? '' : 'disabled'} ${act} data-node="${n.id}"><span class="node-icon">${icon}</span><span class="node-lbl">${lbl}${n.elite ? ' (ELITE)' : ''}</span>${wx ? `<span class="node-weather ${wx}" title="Forecast: ${n.weather.replace('_', ' ')}"></span>` : ''}${gr ? `<span class="node-ground ${gr.dot}" title="Ground: ${gr.name} \u2014 ${gr.desc}">${gr.short[0]}</span>` : ''}</button>`;
    });
    m += `</div>`; mapC.innerHTML = m;
    const focusY = (TOTAL_TIERS - currentTier) * MAP_ROW_H - mapC.clientHeight * 0.45;
    setTimeout(() => { mapC.scrollTop = Math.max(0, focusY); }, 10);
}

function advanceSector() {
    // A sector's worth of road between you and them is enough. Nothing follows across.
    pursuit = null; retreatNode = null;
    checkBountyProgress('SECTOR');
    currentSector++; currentTier = 1;
    sectorFront = rollFront(seededRng('front:' + currentSector), currentSector); frontBannerPending = true;
    sectorMap = generateSectorMap(seededRng('map:' + currentSector)); currentNodeId = null; clearedNodeIds = []; forecastWeather = null; forecastTerrain = null;
    noteDepth(); saveGameState();
    resolveConsequence();
}

function setOutpostTab(tab) { document.getElementById('tab-roster').className = `op-tab-btn ${tab === 'ROSTER' ? 'op-tab-active' : ''}`; document.getElementById('tab-workbench').className = `op-tab-btn ${tab === 'WORKBENCH' ? 'op-tab-active' : ''}`; document.getElementById('tab-cyber').className = `op-tab-btn ${tab === 'CYBER' ? 'op-tab-active' : ''}`; document.getElementById('outpost-roster-view').style.display = tab === 'ROSTER' ? 'flex' : 'none'; document.getElementById('outpost-workbench-view').style.display = tab === 'WORKBENCH' ? 'flex' : 'none'; document.getElementById('outpost-cyber-view').style.display = tab === 'CYBER' ? 'flex' : 'none'; renderOutpost(); }

// One operator's full command card - the list view stacks seven of these, and the camp
// scene serves the same card as a sheet when a sprite is tapped.
function operatorCardHtml(char) {
        let cost = 30 + (char.upgradeCount * 25); let canUpg = scrap >= cost; let isDead = char.hp <= 0; let isInj = char.hp < char.maxHp && char.hp > 0;
        // The Outpost used to sell a resurrection for fifty Scrap, which is what made every
        // death in the game a bill rather than a loss. Nobody on this roster is at zero any more:
        // they are either dragged clear by the end of the fight or they are not on it.
        let medHtml = `<button class="upg-btn med-btn" ${!isInj || scrap < 10 ? 'disabled' : ''} data-action="medbay" data-id="${char.id}" data-mode="HEAL">TRIAGE (10)</button>`;
        
        // Unspent points always win the slot, however many perks the character already has.
        let traitDisplay = char.perkPoints > 0
            ? `<button class="upg-btn perk-btn" style="padding:2px 5px;" data-action="perk-menu" data-id="${char.id}">CHOOSE PERK (${char.perkPoints})</button>`
            : `LVL ${char.level} (${char.xp}/${char.xpToNext} XP)`;
        let traitLine = traitSummary(char);
        let traitsDisplay = traitLine ? `<div style="font-size:9px; color:#6B8E23; text-transform:uppercase; margin-top:2px;">${traitLine}</div>` : '';
        let quirkDisplay = char.quirk ? `<div style="font-size:9px; color:#ffaa00; text-transform:uppercase; margin-top:2px;" title="${char.quirk.desc || ''}">[ ${char.quirk.name} ]</div>` : '';
        let masteryDisplay = masteryRank(char.classType) >= 1
            ? `<div class="mastery-line" title="Dossier rank ${masteryRank(char.classType)} — ${masteryXp(char.classType).toLocaleString()} lifetime XP">★ ${MASTERY_TITLES[char.classType]} · RANK ${['0','I','II','III'][masteryRank(char.classType)]}</div>` : '';
        let bondLine = bondLineFor(char);
        let bondDisplay = bondLine ? `<div class="bond-line" title="Bonds deepen with every fight this pair survives together.">⚯ ${bondLine}</div>` : '';

        const modG = gearById(char.weaponMod), trkG = gearById(char.trinket);
        let gearHtml = '';
        if (activeGearSelector && activeGearSelector.charId === char.id) {
            const slot = activeGearSelector.slot;
            const options = gearStash.map(id => gearById(id))
                .filter(g => g && g.slot === slot && (slot !== 'mod' || g.cls === char.classType));
            gearHtml = options.length
                ? options.map(g => `<button class="upg-btn sub-menu-btn gear-pick" data-action="equip-gear" data-id="${char.id}" data-gear="${g.id}" title="${g.desc}">${g.name}</button>`).join(' ')
                : `<div class="gear-none">Nothing in the stash fits this slot.</div>`;
            const worn = slot === 'mod' ? modG : trkG;
            if (worn) gearHtml += ` <button class="upg-btn sub-menu-btn" style="border-color:#8B0000; color:#ff6655;" data-action="unequip-gear" data-id="${char.id}" data-slot="${slot}">REMOVE ${worn.name.toUpperCase()}</button>`;
            gearHtml += ` <button class="upg-btn sub-menu-btn" style="border-color:#888;" data-action="selector-cancel">CANCEL</button>`;
        } else {
            gearHtml = `<button class="upg-btn sub-menu-btn gear-slot" data-action="gear-menu" data-id="${char.id}" data-slot="mod" title="${modG ? modG.desc : 'Weapon mods change what an ability does.'}">⚙ ${modG ? modG.name : 'NO MOD'}</button>
                <button class="upg-btn sub-menu-btn gear-slot" data-action="gear-menu" data-id="${char.id}" data-slot="trinket" title="${trkG ? trkG.desc : 'Trinkets are worn passives.'}">◈ ${trkG ? trkG.name : 'NO TRINKET'}</button>`;
        }
        let posText = char.gridPos === 1 ? '[1] FRONTLINE' : char.gridPos === 2 ? '[2] MIDLINE' : char.gridPos === 3 ? '[3] BACKLINE' : '[X] BENCHED'; let posClass = `pos-btn-${char.gridPos}`; let btnGroupHtml = '';

        if (activePosSelector === char.id) { btnGroupHtml = `<button class="upg-btn sub-menu-btn pos-btn-1" data-action="assign-slot" data-id="${char.id}" data-slot="1">[1] FRONT</button> <button class="upg-btn sub-menu-btn pos-btn-2" data-action="assign-slot" data-id="${char.id}" data-slot="2">[2] MID</button> <button class="upg-btn sub-menu-btn pos-btn-3" data-action="assign-slot" data-id="${char.id}" data-slot="3">[3] BACK</button> <button class="upg-btn sub-menu-btn pos-btn-0" data-action="assign-slot" data-id="${char.id}" data-slot="0">[X] BENCH</button> <button class="upg-btn sub-menu-btn" style="border-color:#888;" data-action="selector-cancel">CANCEL</button>`; } 
        else if (activePerkSelector === char.id) { btnGroupHtml = PERK_POOL.map(p => `<button class="upg-btn sub-menu-btn perk-btn" data-action="assign-perk" data-id="${char.id}" data-perk="${p.id}">${p.label}</button>`).join(' ') + ` <button class="upg-btn sub-menu-btn" style="border-color:#888;" data-action="selector-cancel">CANCEL</button>`; } 
        else { btnGroupHtml = `<button class="upg-btn ${posClass}" data-action="pos-menu" data-id="${char.id}">${posText}</button> <button class="upg-btn" ${!canUpg || isDead ? 'disabled' : ''} data-action="buy-upg" data-id="${char.id}" data-kind="HP" data-cost="${cost}">+10 HP</button> <button class="upg-btn" ${!canUpg || isDead ? 'disabled' : ''} data-action="buy-upg" data-id="${char.id}" data-kind="DMG" data-cost="${cost}">+3 DMG</button> ${medHtml}`; }

        return `<div class="upgrade-card" style="${isDead ? 'border-color: #8B0000; opacity: 0.8;' : ''}"> <div class="upgrade-header" style="flex-direction:column; align-items:flex-start;"> <div style="display:flex; justify-content:space-between; width:100%;"><span>${char.name} (${char.classType})</span><span>${traitDisplay}</span></div> ${quirkDisplay}${masteryDisplay}${traitsDisplay}${bondDisplay} </div> <div class="upgrade-stats"><span>HP: ${char.hp}/${char.maxHp}</span><span>DMG: ${char.dmgBase}</span><span>UPG: <span class="cost-txt">${cost}</span></span></div> <div class="upgrade-btn-group">${btnGroupHtml}</div> <div class="upgrade-btn-group gear-row">${gearHtml}</div> </div>`;
}

function renderOutpost() {
    switchScreen('screen-outpost'); showOutpostNotice(''); document.getElementById('outpost-scrap').innerText = formatStat(scrap);
    const c = document.getElementById('outpost-roster');
    c.innerHTML = playerRoster.map(char => operatorCardHtml(char)).join('');
    document.getElementById('mat-parts').innerText = formatStat(materials.parts);
    document.getElementById('mat-chems').innerText = formatStat(materials.chems);
    document.getElementById('mat-tech').innerText = formatStat(materials.tech);
    document.getElementById('btn-breakdown').disabled = scrap < 25;
    let wbHtml = ''; let invFull = inventory.length >= metaUpgrades.invMax;
    wbHtml += `<button class="upg-btn" ${materials.chems < 2 || invFull ? 'disabled' : ''} data-action="craft" data-item="MED_STIM">CRAFT MED-STIM (2 🧪)</button>`; wbHtml += `<button class="upg-btn" ${materials.parts < 2 || invFull ? 'disabled' : ''} data-action="craft" data-item="SCRAP_BOMB">CRAFT SCRAP BOMB (2 ⚙️)</button>`; wbHtml += `<button class="upg-btn" ${materials.chems < 1 || materials.tech < 1 || invFull ? 'disabled' : ''} data-action="craft" data-item="ADRENALINE">CRAFT ADRENALINE (1 🧪, 1 💻)</button>`; wbHtml += `<button class="upg-btn" ${materials.tech < 2 || invFull ? 'disabled' : ''} data-action="craft" data-item="EMP_CHARGE">CRAFT EMP CHARGE (2 💻)</button>`;
    document.getElementById('crafting-grid').innerHTML = wbHtml;

    const cybC = document.getElementById('cybernetics-roster'); const cybCards = [];
    playerRoster.forEach(char => {
        let augList = char.augments && char.augments.length > 0 ? char.augments.join(', ') : 'NONE'; let canPlating = materials.parts >= 3; let canOptics = materials.tech >= 2; let canPump = materials.chems >= 2;
        cybCards.push(`<div class="upgrade-card"> <div class="upgrade-header"><span>${char.name}</span><span style="color:#4488ff; font-size:10px;">AUGS: ${augList}</span></div> <div class="upgrade-stats"><span>MAX HP: ${char.maxHp}</span><span>BASE DMG: ${char.dmgBase}</span><span>SPEED: ${char.speed}</span></div> <div class="upgrade-btn-group"> <button class="upg-btn" style="border-color:#4488ff;" ${!canPlating ? 'disabled' : ''} data-action="augment" data-id="${char.id}" data-kind="PLATING">SUB-DERMAL PLATING (+20 HP) [3 ⚙️]</button> <button class="upg-btn" style="border-color:#4488ff;" ${!canOptics ? 'disabled' : ''} data-action="augment" data-id="${char.id}" data-kind="OPTICS">OPTICS (+4 DMG) [2 💻]</button> <button class="upg-btn" style="border-color:#4488ff;" ${!canPump ? 'disabled' : ''} data-action="augment" data-id="${char.id}" data-kind="PUMP">ADRENAL PUMP (+3 SPD) [2 🧪]</button> </div> </div>`);
    });

    cybC.innerHTML = cybCards.join('');
    document.getElementById('inv-count').innerText = `${inventory.length}/${metaUpgrades.invMax}`; const invC = document.getElementById('outpost-inventory'); const invCells = [];
    for (let i = 0; i < metaUpgrades.invMax; i++) { let item = inventory[i]; if (item) { let label = item === 'MED_STIM' ? '💉 Med-Stim' : item === 'SCRAP_BOMB' ? '💣 Scrap Bomb' : item === 'ADRENALINE' ? '⚡ Adrenaline' : '🔋 EMP Charge'; invCells.push(`<button class="inv-slot" data-action="sell-item" data-index="${i}">${label} [SELL]</button>`); } else { invCells.push(`<button class="inv-slot" disabled>[ EMPTY SLOT ]</button>`); } }
    invC.innerHTML = invCells.join('');
}

function breakdownScrap() { if (scrap < 25) return; scrap -= 25; let m = ['parts', 'chems', 'tech'][Math.floor(Math.random() * 3)]; materials[m]++; saveGameState(); renderOutpost(); }
function craftItem(item) { 
    if (!canCarry()) return; 
    if (item === 'MED_STIM' && materials.chems >= 2) { materials.chems -= 2; inventory.push(item); checkBountyProgress('CRAFT'); } 
    else if (item === 'SCRAP_BOMB' && materials.parts >= 2) { materials.parts -= 2; inventory.push(item); checkBountyProgress('CRAFT'); } 
    else if (item === 'ADRENALINE' && materials.chems >= 1 && materials.tech >= 1) { materials.chems -= 1; materials.tech -= 1; inventory.push(item); checkBountyProgress('CRAFT'); } 
    else if (item === 'EMP_CHARGE' && materials.tech >= 2) { materials.tech -= 2; inventory.push(item); checkBountyProgress('CRAFT'); } 
    saveGameState(); renderOutpost(); 
}
function installAugment(charId, type) { let char = playerRoster.find(c => c.id === charId); if (!char.augments) char.augments = []; if (type === 'PLATING' && materials.parts >= 3) { materials.parts -= 3; char.maxHp += 20; char.hp += 20; char.augments.push('Plating'); } else if (type === 'OPTICS' && materials.tech >= 2) { materials.tech -= 2; char.dmgBase += 4; char.augments.push('Optics'); } else if (type === 'PUMP' && materials.chems >= 2) { materials.chems -= 2; char.speed += 3; char.augments.push('Pump'); } saveGameState(); renderOutpost(); }
function assignSlot(charId, newSlot) {
    // Short Handed is a condition for the whole expedition, not just its first node.
    if (hasContract('SHORT_HANDED') && newSlot === 3) { activePosSelector = null; renderOutpost(); return; }
    let char = playerRoster.find(c => c.id === charId); let oldSlot = char.gridPos; if (newSlot > 0) { let existingChar = playerRoster.find(c => c.gridPos === newSlot && c.id !== charId); if (existingChar) existingChar.gridPos = oldSlot; } char.gridPos = newSlot; activePosSelector = null; saveGameState(); renderOutpost(); }
// ── Signature perks ─────────────────────────────────────────────────────────────────────
// A level-up used to bank a point spent later on a flat stat. It is a moment now: three perks
// offered on the spot, mixing the stat perks with class signatures that change what an
// ability does. Signatures are one-time; the stat perks stay repeatable.
const SIG_PERKS = [
    { id: 'BULWARK',        cls: 'BRUISER',    name: 'Bulwark',          desc: 'Iron Guard intercepts at 45% damage instead of 60%.' },
    { id: 'AFTERSHOCK',     cls: 'BRUISER',    name: 'Aftershock',       desc: 'Heavy Wrench also hits the enemy behind at 40%.' },
    { id: 'GRUDGE',         cls: 'BRUISER',    name: 'Grudge',           desc: '+15% damage while below half health.' },
    { id: 'UNSHAKEABLE',    cls: 'BRUISER',    name: 'Unshakeable',      desc: 'Cannot be stunned.' },
    { id: 'FIELD_SURGEON',  cls: 'MEDIC',      name: 'Field Surgeon',    desc: 'Cauterize also cleanses bleed, stun and oil.' },
    { id: 'COMBAT_MEDIC',   cls: 'MEDIC',      name: 'Combat Medic',     desc: 'Pistol hits patch the most-wounded ally for 5.' },
    { id: 'RAD_SPECIALIST', cls: 'MEDIC',      name: 'Rad Specialist',   desc: 'Rad Shot always opens a bleed.' },
    { id: 'STIMS_ON_ME',    cls: 'MEDIC',      name: 'Stims On Me',      desc: 'The STIM tactic costs 20 while this medic stands.' },
    { id: 'ACID_RAIN',      cls: 'SCAVENGER',  name: 'Acid Rain',        desc: 'Acid Flask splashes 2 turns of corrosion onto the next enemy.' },
    { id: 'SHRAPNEL_LOAD',  cls: 'SCAVENGER',  name: 'Shrapnel Load',    desc: 'Pipe Rifle deals +20% to armoured targets.' },
    { id: 'PACKRAT',        cls: 'SCAVENGER',  name: 'Packrat',          desc: '+10 scrap after fights they survive.' },
    { id: 'QUICK_HANDS',    cls: 'SCAVENGER',  name: 'Quick Hands',      desc: 'Flashbang cools down in 3 turns, not 4.' },
    { id: 'BACKDRAFT',      cls: 'PYROMANIAC', name: 'Backdraft',        desc: "Molotov's second hit lands at full damage." },
    { id: 'LINGERING_BURN', cls: 'PYROMANIAC', name: 'Lingering Burn',   desc: 'Oil this pyro applies lasts a turn longer.' },
    { id: 'PYROPHILIA',     cls: 'PYROMANIAC', name: 'Pyrophilia',       desc: '+10% damage per oiled enemy on the field, up to +30%.' },
    { id: 'CONTROLLED_BURN',cls: 'PYROMANIAC', name: 'Controlled Burn',  desc: 'Thermite cools down in 3 turns, not 4.' },
    { id: 'POINT_BLANK',    cls: 'SHOTGUNNER', name: 'Point Blank',      desc: "Buckshot's front-target bonus rises to 1.8x." },
    { id: 'BREACHING_ROUNDS',cls: 'SHOTGUNNER',name: 'Breaching Rounds', desc: 'Slug Shot ignores armour.' },
    { id: 'DOUBLE_TAP',     cls: 'SHOTGUNNER', name: 'Double Tap',       desc: 'Execute refunds its cooldown on a kill.' },
    { id: 'IRONSIGHTS',     cls: 'SHOTGUNNER', name: 'Ironsights',       desc: 'Slug Shot deals +20%.' },
    { id: 'CALLED_SHOT',    cls: 'SNIPER',     name: 'Called Shot',      desc: 'This sniper deals +25% to marked targets.' },
    { id: 'PIERCING_ROUNDS',cls: 'SNIPER',     name: 'Piercing Rounds',  desc: 'Quick Shot ignores armour.' },
    { id: 'SPOTTER_NETWORK',cls: 'SNIPER',     name: 'Spotter Network',  desc: '+5 momentum whenever a mark is cashed in.' },
    { id: 'PATIENT_HUNTER', cls: 'SNIPER',     name: 'Patient Hunter',   desc: "Deadeye's long-range bonus rises to 2.1x." },
    { id: 'GO_FOR_THE_THROAT', cls: 'HOUND',   name: 'Go For The Throat',desc: 'Feral Bite deals +30% to bleeding targets.' },
    { id: 'RELENTLESS',     cls: 'HOUND',      name: 'Relentless',       desc: 'A Feral Bite kill refunds its cooldown.' },
    { id: 'LEAD_THE_PACK',  cls: 'HOUND',      name: 'Lead The Pack',    desc: "The hound's attacks build +5 momentum." },
    { id: 'THICK_FUR',      cls: 'HOUND',      name: 'Thick Fur',        desc: '+8 physical resist.', apply: c => { c.resistances.phys += 8; } },
    { id: 'SECOND_LUNG',    cls: 'TRENCH_FIEND',name: 'Second Lung',     desc: 'Over The Top costs him nothing.' },
    { id: 'SAWBONES',       cls: 'TRENCH_FIEND',name: 'Sawbones',        desc: "Ripsaw's bleed runs 5 turns instead of 3." },
    { id: 'TRENCH_FOOT',    cls: 'TRENCH_FIEND',name: 'Trench Foot',     desc: '+20% damage while standing in the front rank.' },
    { id: 'NO_MANS_LAND',   cls: 'TRENCH_FIEND',name: "No Man's Land",   desc: 'Cannot be made to bleed.' },
    { id: 'CLOSED_CIRCUIT', cls: 'HAZMAT',     name: 'Closed Circuit',   desc: '+40 bio resist.', apply: c => { c.resistances.bio += 40; } },
    { id: 'WIDE_NOZZLE',    cls: 'HAZMAT',     name: 'Wide Nozzle',      desc: 'Caustic Burst reaches a third enemy.' },
    { id: 'CATALYST',       cls: 'HAZMAT',     name: 'Catalyst',         desc: '+25% damage against anything corroded.' },
    { id: 'SPARE_FILTERS',  cls: 'HAZMAT',     name: 'Spare Filters',    desc: 'Purge Valve cools down in 2 turns, not 3.' },
    { id: 'WINCH_ARM',      cls: 'HARPOONER',  name: 'Winch Arm',        desc: 'Drag Line hauls the enemy behind the target forward too.' },
    { id: 'DEEP_HOOK',      cls: 'HARPOONER',  name: 'Deep Hook',        desc: "Barbed Shot's bleed runs 5 turns instead of 3." },
    { id: 'SLACK_LINE',     cls: 'HARPOONER',  name: 'Slack Line',       desc: '+25% damage against whatever stands at the enemy front.' },
    { id: 'HAND_OVER_HAND', cls: 'HARPOONER',  name: 'Hand Over Hand',   desc: 'A Drag Line kill hands the cooldown straight back.' }
];

function hasTrait(ent, id) { return !!(ent && ent.isPlayer && Array.isArray(ent.traits) && ent.traits.includes(id)); }
function traitOnField(id) { return activeEntities.some(e => e.isPlayer && e.hp > 0 && hasTrait(e, id)); }

let pendingPerkOffers = [];

// Three distinct options for this operator: unheld class signatures first, stat perks filling in.
function rollPerkOffer(char) {
    const sigs = SIG_PERKS.filter(p => p.cls === char.classType && !hasTrait(char, p.id));
    const stats = PERK_POOL.map(p => ({ id: p.id, name: p.label, desc: p.label, stat: true }));
    const shuffled = [...sigs].sort(() => Math.random() - 0.5);
    const pool = [...shuffled, ...stats.sort(() => Math.random() - 0.5)];
    const seen = new Set(); const out = [];
    for (const p of pool) { if (seen.has(p.id)) continue; seen.add(p.id); out.push(p.id); if (out.length === 3) break; }
    return out;
}

function renderPerkOffer() {
    firePrompt('PROMOTION');
    const offer = pendingPerkOffers[0];
    if (!offer) { renderMap(); return; }
    const char = playerRoster.find(c => c.id === offer.charId);
    if (!char) { pendingPerkOffers.shift(); renderPerkOffer(); return; }
    switchScreen('screen-perk');
    document.getElementById('perk-title').innerText = `FIELD PROMOTION — ${char.name.toUpperCase()}`;
    document.getElementById('perk-sub').innerText = `${char.classType} · LEVEL ${char.level}`;
    document.getElementById('perk-choices').innerHTML = offer.options.map((id, i) => {
        const sig = SIG_PERKS.find(p => p.id === id);
        const stat = PERK_POOL.find(p => p.id === id);
        const name = sig ? sig.name : (stat ? stat.label.split(' (')[0] : id);
        const desc = sig ? sig.desc : (stat ? stat.label : '');
        return `<button class="relic-card ${sig ? 'perk-sig' : 'perk-stat'}" data-action="take-perk" data-index="${i}">
            <span class="relic-card-tier">${sig ? 'SIGNATURE' : 'TRAINING'}</span>
            <span class="relic-card-name">${name}</span>
            <span class="relic-card-desc">${desc}</span></button>`;
    }).join('') + `<button class="event-btn perk-bank" data-action="bank-perk">BANK THE POINT (spend it at the Outpost)</button>`;
}

function takePerkOffer(index) {
    const offer = pendingPerkOffers[0];
    if (!offer) { renderMap(); return; }
    const char = playerRoster.find(c => c.id === offer.charId);
    const id = offer.options[index];
    if (char && id) {
        const sig = SIG_PERKS.find(p => p.id === id);
        const stat = PERK_POOL.find(p => p.id === id);
        if (sig) {
            if (sig.apply) sig.apply(char);
            if (!char.traits) char.traits = [];
            char.traits.push(sig.id);
            char.perkPoints = Math.max(0, char.perkPoints - 1);
        } else if (stat) {
            stat.apply(char);
            if (!char.traits) char.traits = [];
            char.traits.push(stat.id);
            char.perkPoints = Math.max(0, char.perkPoints - 1);
        }
        playSFX('heal');
    }
    pendingPerkOffers.shift(); saveGameState();
    if (pendingPerkOffers.length) renderPerkOffer(); else renderMap();
}

function bankPerkOffer() {
    // The point stays banked for the Outpost's stat picker - the old flow, kept honest.
    pendingPerkOffers.shift(); saveGameState();
    if (pendingPerkOffers.length) renderPerkOffer(); else renderMap();
}

function assignPerk(charId, perkId) {
    let char = playerRoster.find(c => c.id === charId);
    if (!char || char.perkPoints <= 0) return;
    const perk = PERK_POOL.find(p => p.id === perkId);
    if (!perk) return;
    perk.apply(char);
    if (!char.traits) char.traits = [];
    char.traits.push(perk.id);
    char.perkPoints--;
    activePerkSelector = null; saveGameState(); renderOutpost();
}

// The art set moved from PNG to WebP, but a saved roster stores each unit's image path, so
// saves written before that migration point at files that no longer exist and render as a
// browser broken-image icon. Rewrite the extension on load. Anything persisting an asset path
// needs the same treatment - enemies inside a combat snapshot, and its background.
function migrateAssetPaths(entities) {
    (entities || []).forEach(e => {
        if (e && typeof e.img === 'string') e.img = e.img.replace(/\.png$/, '.webp');
    });
    return entities;
}

// Older saves carried a single `trait` string; fold it into the list so progress survives.
function migrateTraits(roster) {
    roster.forEach(c => {
        if (!Array.isArray(c.traits)) c.traits = c.trait ? [c.trait] : [];
        delete c.trait;
    });
    return roster;
}

// A compact tally like VETERAN x2, HONED x3 rather than a wall of repeats.
function traitSummary(char) {
    if (!char.traits || char.traits.length === 0) return '';
    const counts = {};
    char.traits.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).map(([t, n]) => n > 1 ? `${t} x${n}` : t).join(', ');
}
function useOutpostItem(index) { inventory.splice(index, 1); scrap += 20; saveGameState(); renderOutpost(); }
function buyUpgrade(charId, type, cost) { if (scrap < cost) return; scrap -= cost; let c = playerRoster.find(c => c.id === charId); if (c.hp <= 0) return; if (type === 'HP') { c.maxHp += 10; c.hp += 10; } else if (type === 'DMG') { c.dmgBase += 3; } c.upgradeCount++; saveGameState(); renderOutpost(); }
function medBay(charId, action) { 
    let c = playerRoster.find(c => c.id === charId); 
    if (action === 'HEAL' && scrap >= 10 && c.hp > 0 && c.hp < c.maxHp) { scrap -= 10; c.hp = Math.min(c.maxHp, c.hp + Math.floor(c.maxHp * 0.4)); playSFX('heal'); } 

    saveGameState(); renderOutpost(); 
}

// Fourteen events repeat far less than four did, but a uniform roll still hands the same one
// back two nodes running. The last few are held out of the draw so the map keeps changing.
const EVENT_MEMORY = 4;
// An event with a face in it does not read the same the second time, and what it offers should
// not either. Both are allowed to be functions of the run so far; everything that reads an
// event goes through these two rather than touching .desc and .choices directly.
function eventDesc(ev) { return typeof ev.desc === 'function' ? ev.desc() : ev.desc; }
function choicesFor(ev) { return typeof ev.choices === 'function' ? ev.choices() : ev.choices; }

// Somebody you have already met is likelier to turn up again than a stranger is. Measured: on a
// flat draw across fourteen events each face appeared about half a run, so nobody ever came back
// twice and every thread that needed two meetings was unreachable content - three of six never
// fired across thirty expeditions. The weight applies only once a face is known, so a first
// sector still meets strangers at the ordinary rate.
const FACE_RETURN_WEIGHT = 3;
// How long Vela's money is yours. It was two sectors, which on a run whose median depth is two
// meant most loans never came due at all: 200 scrap up front and no collection, and weighting
// her to come back made that the most generous thing in the pool. One sector is a loan.
const DEBT_TERM = 1;
function eventWeight(e) { return (e.cast && hasMetCast(e.cast)) ? FACE_RETURN_WEIGHT : 1; }

function pickEvent() {
    // A thread the run has already started outranks a stranger. Follow-ups are not in the
    // general draw at all - they exist only because of something the player already did, and
    // each comes due once.
    const owed = FOLLOWUPS.filter(f => !firedEvents.includes(f.title) && f.when());
    if (owed.length) {
        const pick = owed[Math.floor(Math.random() * owed.length)];
        firedEvents = [...firedEvents, pick.title];
        recentEvents = [pick.title, ...recentEvents].slice(0, EVENT_MEMORY);
        return pick;
    }
    const fresh = EVENT_POOL.filter(e => !recentEvents.includes(e.title));
    const pool = fresh.length ? fresh : EVENT_POOL;
    const total = pool.reduce((n, e) => n + eventWeight(e), 0);
    let roll = Math.random() * total;
    let pick = pool[pool.length - 1];
    for (const e of pool) { roll -= eventWeight(e); if (roll < 0) { pick = e; break; } }
    recentEvents = [pick.title, ...recentEvents].slice(0, EVENT_MEMORY);
    return pick;
}

// The choice list is fixed at render and read back by index when one is pressed, so a list that
// depends on standing cannot shift underneath the button the player is looking at.
let activeChoices = [];

function initiateEvent() {
    switchScreen('screen-event'); activeEvent = pickEvent();
    if (activeEvent.cast) meetCast(activeEvent.cast);
    activeChoices = choicesFor(activeEvent);
    document.getElementById('event-title').innerText = activeEvent.title;
    document.getElementById('event-desc').innerText = eventDesc(activeEvent);
    renderCastTag(activeEvent.cast);
    let cHtml = ''; activeChoices.forEach((c, idx) => { let canAfford = c.canAfford(); cHtml += `<button class="event-btn" ${!canAfford ? 'disabled' : ''} data-action="event-choice" data-index="${idx}">${c.label}</button>`; });
    document.getElementById('event-choices').innerHTML = cHtml;
}

// Who this is, and what they think of you - shown only once there is something to think about,
// so a first meeting reads as a first meeting.
function renderCastTag(id) {
    const el = document.getElementById('event-cast');
    if (!el) return;
    const c = CAST[id];
    if (!c) { el.innerHTML = ''; el.style.display = 'none'; return; }
    const band = standingBand(id);
    const again = (castOf(id).met || 0) > 1;
    el.style.display = 'flex';
    el.innerHTML = `<span class="cast-name">${c.name.toUpperCase()} \u00B7 ${c.epithet.toUpperCase()}</span>` +
        (again ? `<span class="cast-band ${band.cls}">${band.label}</span>` : `<span class="cast-band cast-new">FIRST MEETING</span>`);
}

function resolveEvent(idx) {
    let resultText = activeChoices[idx].execute();
    document.getElementById('event-choices').innerHTML = `<div style="color:#6B8E23; font-weight:bold; margin-bottom:15px;">> ${resultText}</div><button class="event-btn" style="border-color:#4488ff; color:#4488ff;" data-action="event-finish">CONTINUE EXPEDITION</button>`;
    renderCastTag(activeEvent.cast);
}
function finishEvent() { currentTier++; if (runStats) runStats.nodes++; noteDepth(); saveGameState(); renderMap(); }

let extractArmed = false;

function initiateCamp() {
    extractArmed = false;
    switchScreen('screen-camp');
    renderCamp();
}

// The offer has to be priced in front of the player, not described. Both halves of the bet are
// on the button: what walking out banks, and what the run is worth if it keeps going.
function extractPitch() {
    const now = computeScore({ ...runStats, extracted: true });
    const raw = computeScore({ ...runStats, extracted: false });
    return { now, raw, gain: now - raw, skulls: extractSkulls(runStats),
             pct: Math.round(extractBonus(runStats) * 100),
             relic: heirloomFrom(activeRelics) };
}

function renderCamp() {
    let cHtml = '';
    if (extractArmed) {
        const p = extractPitch();
        cHtml += `<div class="camp-extract-panel">`
            + `<div class="camp-extract-head">WALK OUT NOW</div>`
            + `<div class="camp-extract-line">The expedition ends here and everything it earned is banked.</div>`
            + `<div class="camp-extract-row"><span>SCORE</span><b>${formatStat(p.raw)} \u2192 ${formatStat(p.now)} <em>(+${p.pct}%)</em></b></div>`
            + `<div class="camp-extract-row"><span>TO THE CITADEL</span><b>\uD83D\uDC80 +${p.skulls}</b></div>`
            + `<div class="camp-extract-row"><span>CARRIED HOME</span><b>${p.relic ? p.relic.name : 'nothing worth keeping'}</b></div>`
            + `<div class="camp-extract-warn">There is no coming back to this run.</div>`
            + `</div>`
            + `<button class="event-btn camp-walk-go" data-action="camp-extract-go">CONFIRM \u2014 WALK OUT</button>`
            + `<button class="event-btn" data-action="camp-extract">STAY ON THE ROAD</button>`;
        document.getElementById('camp-choices').innerHTML = cHtml;
        return;
    }
    cHtml += `<button class="event-btn" data-action="camp-choice" data-kind="TRIAGE">TRIAGE (Heal 35% HP to Deployed Squad)</button>`;
    cHtml += `<button class="event-btn" data-action="camp-choice" data-kind="TUNEUP">WEAPON TUNE-UP (+4 DMG for next 3 Battles)</button>`;
    cHtml += `<button class="event-btn" data-action="camp-choice" data-kind="FORAGE">FORAGE (+1 Parts, +1 Chems, +1 Tech)</button>`;
    if (canExtract()) {
        const p = extractPitch();
        cHtml += `<button class="event-btn camp-walk" data-action="camp-extract">`
            + `WALK OUT (bank ${formatStat(p.now)} PTS, +${p.pct}%, \uD83D\uDC80 ${p.skulls})</button>`;
    } else if (runStats) {
        cHtml += `<div class="camp-walk-locked">Nothing worth carrying home yet \u2014 the road out opens from Sector ${EXTRACT.minSector}.</div>`;
    }
    document.getElementById('camp-choices').innerHTML = cHtml;
}

function armExtract() {
    if (!extractArmed && !canExtract()) return;
    extractArmed = !extractArmed;
    if (extractArmed) firePrompt('EXTRACT');
    renderCamp();
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

// ── The Armory ──────────────────────────────────────────────────────────────────────────
// Scrap had three rote uses; a shop gives it competing ones, and gives the route graph a
// destination worth a detour. Prices ride the same 1.4^sector curve the rewards do, so a
// piece costs the same share of a fight's loot at any depth.
let activeShop = null;        // { nodeId, stock } while a trader holds the current node
let regroupInsured = false;   // one prepaid regroup: the next one takes no scrap
let shopRerollPick = false;   // the quirk-therapy row is waiting on an operator pick

// The Armory contract comes off the top, after the sector's markup, so the discount is on what
// the stock actually costs here rather than on its list price somewhere else.
const shopPrice = base => Math.max(1, Math.floor(base * sectorRewardMult() * (1 - ARMORY_CUT / 100 * (metaUpgrades.discount || 0))));

function rollShopStock() {
    const stock = [];
    const gearId = rollGear();
    if (gearId) stock.push({ kind: 'GEAR', id: gearId, price: shopPrice(140), sold: false });
    const relics = unownedRelics().filter(r => r.tier !== 'CURSED');
    if (relics.length) {
        const r = relics[Math.floor(Math.random() * relics.length)];
        stock.push({ kind: 'RELIC', id: r.id, price: shopPrice(r.tier === 'RARE' ? 320 : 240), sold: false });
    }
    stock.push({ kind: 'STIM', price: shopPrice(35), sold: false });
    stock.push({ kind: 'STIM', price: shopPrice(35), sold: false });
    stock.push({ kind: 'REROLL', price: shopPrice(60), sold: false });
    stock.push({ kind: 'INSURANCE', price: shopPrice(90), sold: false });
    return stock;
}

function initiateShop() {
    // Stock is rolled once per node and persisted, so a reload mid-haggle resumes the same shelf.
    if (!activeShop || activeShop.nodeId !== currentNodeId)
        activeShop = { nodeId: currentNodeId, stock: rollShopStock() };
    shopRerollPick = false;
    saveGameState();
    renderShop();
}

// ── Signing someone on ──────────────────────────────────────────────────────────────────
// Rolled once per node and persisted, so reloading mid-decision resumes the same face rather
// than rerolling until a better one turns up.
function initiateRecruit() {
    if (!pendingRecruit || pendingRecruit.nodeId !== currentNodeId) {
        const open = recruitables();
        pendingRecruit = open.length
            ? { nodeId: currentNodeId, id: open[Math.floor(Math.random() * open.length)].id, cost: recruitCost(), taken: false }
            : { nodeId: currentNodeId, id: null, cost: 0, taken: false };
    }
    saveGameState();
    renderRecruit();
}

// What the squad gets for the scrap, in the terms the muster and the outpost already use, so
// the decision can be made from this screen rather than from memory.
// How they fight, read off their own deck rather than written down twice.
function recruitReach(tpl) {
    const reaches = (ABILITIES[tpl.classType] || []).map(a => a.reach).filter(r => r !== 'self');
    if (!reaches.length) return 'SUPPORT';
    return reaches.every(r => r === 'melee') ? 'MELEE'
         : reaches.every(r => r === 'ranged') ? 'RANGED' : 'MIXED';
}

function recruitCardHtml(tpl) {
    const deck = [...(ABILITIES[tpl.classType] || [])];
    const verbs = deck.map(a => `<li><b>${a.label}</b> — ${a.reach === 'self' ? 'self' : a.reach}</li>`).join('');
    const res = Object.entries(tpl.resistances).filter(([, v]) => v !== 0)
        .map(([k, v]) => `${v > 0 ? '+' : ''}${v}% ${k}`).join(' · ');
    return `<div class="recruit-card">
        <img class="recruit-portrait portrait" src="${tpl.img}" alt="${tpl.name}">
        <div class="recruit-info">
            <div class="recruit-name">${tpl.name}</div>
            <div class="recruit-class">${RANK_LABELS[tpl.rank]} RANK · ${recruitReach(tpl)}</div>
            <div class="recruit-pitch">${tpl.pitch}</div>
            <div class="recruit-stats">HP ${tpl.maxHp} · DMG ${tpl.dmgBase} · SPD ${tpl.speed}${tpl.armor ? ` · ARM ${tpl.armor}` : ''}</div>
            ${res ? `<div class="recruit-res">${res}</div>` : ''}
            <ul class="recruit-verbs">${verbs}</ul>
        </div>
    </div>`;
}

function renderRecruit() {
    firePrompt('RECRUIT');
    if (!pendingRecruit) { renderMap(); return; }
    switchScreen('screen-recruit');
    const tpl = recruitById(pendingRecruit.id);
    const body = document.getElementById('recruit-body');
    const note = document.getElementById('recruit-note');
    if (!tpl) {
        // Everyone who was out here is already with you. The camp is still worth stripping.
        note.innerText = 'Cold ashes and a bedroll nobody is coming back for. Whoever was here has already thrown in with you.';
        body.innerHTML = '';
        document.getElementById('recruit-sign').style.display = 'none';
        document.getElementById('recruit-leave').innerText = `TAKE WHAT IS LEFT (+${EMPTY_POOL_SCRAP} SCRAP)`;
        return;
    }
    note.innerText = 'Somebody has been holding this position on their own. They will come, for a price.';
    body.innerHTML = recruitCardHtml(tpl);
    const btn = document.getElementById('recruit-sign');
    btn.style.display = 'block';
    btn.disabled = scrap < pendingRecruit.cost;
    btn.innerText = `SIGN THEM ON — ${pendingRecruit.cost} SCRAP`;
    document.getElementById('recruit-leave').innerText = 'LEAVE THEM TO IT';
}

function signOnRecruit() {
    const tpl = pendingRecruit && recruitById(pendingRecruit.id);
    if (!tpl || pendingRecruit.taken || scrap < pendingRecruit.cost) return;
    if (playerRoster.some(c => c.id === tpl.id)) return;
    scrap -= pendingRecruit.cost;
    const ch = migrateTraits([JSON.parse(JSON.stringify(tpl))])[0];
    delete ch.rank; delete ch.pitch;
    // They arrive hurt, carrying a quirk like anyone the muster rolls, and levelled to the
    // squad they are joining - a fresh recruit six sectors deep would be a body, not a hand.
    ch.hp = Math.max(1, Math.floor(ch.maxHp * RECRUIT_HEALTH));
    const pool = quirkPoolFor(ch.classType);
    ch.quirk = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    if (ch.quirk) { ch.maxHp += ch.quirk.hp; ch.dmgBase += ch.quirk.dmg; ch.speed += ch.quirk.spd; ch.hp = Math.min(ch.hp, ch.maxHp); }
    const par = Math.max(1, Math.round(playerRoster.reduce((a, c) => a + c.level, 0) / Math.max(1, playerRoster.length)));
    while (ch.level < par) { ch.level++; ch.perkPoints++; ch.xpToNext = Math.floor(ch.xpToNext * 1.5); }
    playerRoster.push(ch);
    pendingRecruit.taken = true;
    if (runStats) runStats.recruited = (runStats.recruited || 0) + 1;
    playSFX('heal', 1.5);
    saveGameState(); renderMap();
}

function leaveRecruit() {
    // An empty camp still pays out, the same way an exhausted relic pool does.
    if (pendingRecruit && !recruitById(pendingRecruit.id)) {
        scrap += EMPTY_POOL_SCRAP;
        if (runStats) runStats.scrapEarned += EMPTY_POOL_SCRAP;
    }
    pendingRecruit = null;
    saveGameState(); renderMap();
}

function shopItemLabel(it) {
    if (it.kind === 'GEAR') {
        const g = gearById(it.id);
        return { name: `${g.slot === 'mod' ? '⚙' : '◈'} ${g.name}`, desc: `${g.slot === 'mod' ? g.cls + ' mod — ' : ''}${g.desc}` };
    }
    if (it.kind === 'RELIC') {
        const r = RELIC_POOL.find(x => x.id === it.id);
        return { name: `◆ ${r.name}`, desc: `${r.tier} relic at trader markup — ${r.desc}` };
    }
    if (it.kind === 'STIM') return { name: '💉 Med-Stim', desc: 'A combat heal in the pocket.' };
    if (it.kind === 'REROLL') return { name: '↻ Quirk Therapy', desc: "Reroll one operator's quirk. No refunds on who they become." };
    if (it.kind === 'INSURANCE') return { name: '❖ Regroup Bond', desc: 'The next regroup takes none of your scrap.' };
    return { name: it.kind, desc: '' };
}

function renderShop() {
    firePrompt('ARMORY');
    if (!activeShop) { renderMap(); return; }
    switchScreen('screen-shop');
    document.getElementById('shop-scrap').innerText = `SCRAP ON HAND: ${formatStat(scrap)}`;
    const rows = activeShop.stock.map((it, i) => {
        const L = shopItemLabel(it);
        let btn;
        if (it.sold) btn = `<span class="shop-tag">SOLD</span>`;
        else if (it.kind === 'INSURANCE' && regroupInsured) btn = `<span class="shop-tag">INSURED</span>`;
        else if (it.kind === 'STIM' && !canCarry()) btn = `<span class="shop-tag">BAG FULL</span>`;
        else btn = `<button class="shop-buy" data-action="shop-buy" data-index="${i}" ${scrap < it.price ? 'disabled' : ''}>◇ ${it.price}</button>`;
        return `<div class="shop-row"><div class="shop-info"><span class="shop-name">${L.name}</span><span class="shop-desc">${L.desc}</span></div>${btn}</div>`;
    });
    let pick = '';
    if (shopRerollPick) {
        pick = `<div class="shop-pick"><div class="shop-pick-title">WHO SITS DOWN?</div>` +
            playerRoster.filter(c => c.hp > 0 && c.quirk).map(c =>
                `<button class="shop-pick-btn" data-action="shop-reroll" data-id="${c.id}">${c.name} — ${c.quirk.name}</button>`).join('') +
            `<button class="shop-pick-btn shop-pick-cancel" data-action="shop-reroll-cancel">NEVER MIND</button></div>`;
    }
    document.getElementById('shop-stock').innerHTML = rows.join('') + pick;
    document.getElementById('shop-leave').style.display = shopRerollPick ? 'none' : 'block';
}

function buyShopItem(index) {
    const it = activeShop && activeShop.stock[index];
    if (!it || it.sold || scrap < it.price) return;
    if (it.kind === 'REROLL') { shopRerollPick = true; renderShop(); return; }
    if (it.kind === 'GEAR') gearStash.push(it.id);
    else if (it.kind === 'RELIC') {
        const r = RELIC_POOL.find(x => x.id === it.id);
        if (!r || hasRelic(r.id)) return;
        activeRelics.push(r); announceSets();
    }
    else if (it.kind === 'STIM') { if (!canCarry()) return; inventory.push('MED_STIM'); }
    else if (it.kind === 'INSURANCE') { if (regroupInsured) return; regroupInsured = true; }
    else return;
    scrap -= it.price; it.sold = true;
    playSFX('click'); saveGameState(); renderShop();
}

function shopRerollQuirk(charId) {
    const it = activeShop && activeShop.stock.find(s => s.kind === 'REROLL' && !s.sold);
    const ch = playerRoster.find(c => c.id === charId);
    if (!it || !ch || !ch.quirk || scrap < it.price) { shopRerollPick = false; renderShop(); return; }
    // Same strip-and-reapply the muster uses: old stats off, a different quirk on, HP clamped.
    ch.maxHp -= ch.quirk.hp; ch.dmgBase -= ch.quirk.dmg; ch.speed -= ch.quirk.spd;
    const pool = quirkPoolFor(ch.classType).filter(q => q.id !== ch.quirk.id);
    const q = pool[Math.floor(Math.random() * pool.length)];
    ch.quirk = q; ch.maxHp += q.hp; ch.dmgBase += q.dmg; ch.speed += q.spd;
    ch.hp = Math.min(ch.hp, ch.maxHp);
    scrap -= it.price; it.sold = true; shopRerollPick = false;
    playSFX('heal'); saveGameState(); renderShop();
}

function finishShop() {
    activeShop = null; shopRerollPick = false; pendingRecruit = null;
    currentTier++; if (runStats) runStats.nodes++; noteDepth(); saveGameState(); renderMap();
}

// ── Enemies that do things ──────────────────────────────────────────────────────────────
// Ten enemy types shared six generic intents between them, so every fight was the same fight
// with different numbers: the only per-enemy behaviour in the engine was one hardcoded name
// list. Each type now carries a signature - either a passive that bends how it deals or takes
// damage, or a telegraphed action it rolls alongside the ordinary intents, so the squad gets
// a turn's warning and an answer. Every one is built from statuses, reach and formation rules
// the squad already plays with, pointed the other way.
const ENEMY_SIGS = {
    PACK_HUNT:  { name: 'Pack Hunt',    kind: 'passive', desc: 'Deals +12% damage for every other living packmate.' },
    FRENZY:     { name: 'Frenzy',       kind: 'passive', desc: 'Hits harder the closer it is to death, up to +60%.' },
    RIOT_PLATE: { name: 'Riot Plate',   kind: 'passive', desc: 'Bolted plate halves incoming damage until it is broken through.' },
    ROTOR_LIFT: { name: 'Rotor Lift',   kind: 'passive', desc: 'Hovers out of reach: melee lands at 40%.' },
    GAS_BLOOM:  { name: 'Gas Bloom',    kind: 'death',   desc: 'Bursts on death, corroding the whole squad for 2 turns.' },
    DRAG_DOWN:  { name: 'Drag Down',    kind: 'action',  icon: '\u{1FA9D}', weight: 0.30, cd: 2,
                  desc: 'Hauls a back-rank operator to the front and mauls them.' },
    CALL_IT_IN: { name: 'Call It In',   kind: 'action',  icon: '\u{1F4E3}', weight: 0.22, cd: 99,
                  desc: 'Whistles up another raider. Once each.' },
    RANGING:    { name: 'Ranging Shot', kind: 'action',  icon: '\u{1F52D}', weight: 0.40, cd: 2,
                  desc: 'Ranges the back rank, then executes that operator next turn for double.' },
    OVERWATCH:  { name: 'Overwatch',    kind: 'action',  icon: '\u{1F3AF}', weight: 0.35, cd: 3,
                  desc: 'Locks the field down: the next two operators to act are shot as they move.' },
    AEGIS:      { name: 'Aegis Field',  kind: 'action',  icon: '\u{1F4E1}', weight: 0.30, cd: 3,
                  desc: 'Projects plating onto every other enemy for 2 turns.' },
    // The Choir. Every one of these spends the turn on an ally rather than on the squad, which
    // is the point of the faction: the dangerous unit is usually not the one singing.
    LITANY:     { name: 'Litany',       kind: 'action',  icon: '\u{1F4FF}', weight: 0.45, cd: 2,
                  desc: 'Sings over another hostile: it deals 35% more for 2 turns.' },
    RAD_WASH:   { name: 'Rad Wash',     kind: 'action',  icon: '\u2622', weight: 0.40, cd: 2,
                  desc: 'Douses the front two operators, corroding their armour for 2 turns.' },
    MARTYR:     { name: 'Martyrdom',    kind: 'death',
                  desc: 'Dies loudly: every other Choir hostile heals 30% of its health.' },
    RESURGENCE: { name: 'Resurgence',   kind: 'action',  icon: '\u{1F54A}', weight: 0.55, cd: 99,
                  desc: 'Raises one fallen Choir hostile at half health. Once each.' },
    // The Carrion. A pile that is only dangerous as a pile.
    TEEMING:    { name: 'Teeming',      kind: 'passive',
                  desc: 'While three or more Carrion still stand, each takes 45% damage. Thin the swarm to break it.' },
    BURROW:     { name: 'Burrow',       kind: 'action',  icon: '\u{1F573}', weight: 0.35, cd: 3,
                  desc: 'Goes under for a turn, untouchable, then comes up under the front rank.' },
    BROOD:      { name: 'Brood',        kind: 'action',  icon: '\u{1F95A}', weight: 0.40, cd: 2,
                  desc: 'Lays another Carrion Rat. Keeps laying until it is killed.' }
};
// How many of the swarm are still up. Three is the line: at three the pile protects itself,
// at two it is just fast, fragile things. Everything Carrion counts toward the floor, but only
// the small ones get the reduction - so the Brood Mother is a full-damage target who is
// nonetheless holding the swarm's cover up by standing there.
const TEEMING_FLOOR = 3;
function carrionStanding() {
    return activeEntities.filter(e => !e.isPlayer && e.hp > 0 && e.classType === 'VERMIN').length;
}

function sigOf(ent) { return (ent && !ent.isPlayer && ent.sig) ? (ENEMY_SIGS[ent.sig] || null) : null; }
function hasSig(ent, id) { return !!(ent && !ent.isPlayer && ent.sig === id); }

// The passives that change what an enemy's blow is worth, figured where the raw damage is.
function enemyDmgMult(enemy) {
    let m = 1;
    if (hasSig(enemy, 'PACK_HUNT')) {
        const pack = activeEntities.filter(e => !e.isPlayer && e.hp > 0 && e.id !== enemy.id && hasSig(e, 'PACK_HUNT')).length;
        m *= 1 + 0.12 * pack;
    }
    if (hasSig(enemy, 'FRENZY') && enemy.maxHp > 0) {
        m *= 1 + 0.6 * (1 - Math.max(0, enemy.hp) / enemy.maxHp);
    }
    // Sung over by the Choir. The buff sits on the target rather than the singer, so killing
    // the Acolyte does not take it back - it just stops the next one.
    if ((enemy.blessedTurns || 0) > 0) m *= 1 + (enemy.blessed || 0.35);
    return m;
}

const INTENT_ICONS = { AOE: '🧨', HEAVY: '💥', STATUS: '☣️', DEFEND: '🛡️', ATTACK: '⚔️', FLANK: '🌀' };

function intentFor(type, enemy) {
    const icon = (type === 'ATTACK' && enemy.range === 'ranged') ? '🔫' : INTENT_ICONS[type];
    return { type, icon };
}

function rollIntent(enemy) {
    let rand = Math.random();
    // A signature action outranks the generic table when it is off cooldown and its roll comes
    // up - so a turret sometimes covers the field instead of simply shooting again.
    const sig = sigOf(enemy);
    if (sig && sig.kind === 'action' && (enemy.sigCd || 0) <= 0 && Math.random() < sig.weight) {
        return { type: 'SIG', icon: sig.icon, sig: enemy.sig };
    }
    // A boss past its threshold can be locked into one behaviour - the Colossus stops aiming
    // at anyone in particular and just shells the whole line.
    if (enemy.forceAoe) return intentFor('AOE', enemy);
    if (enemy.intents) {
        let roll = Math.random();
        for (const [type, weight] of enemy.intents) { roll -= weight; if (roll <= 0) return intentFor(type, enemy); }
        return intentFor(enemy.intents[enemy.intents.length - 1][0], enemy);
    }
    if (enemy.classType === 'MECH') {
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
        // A fast unit will go round the front rank rather than through it. Telegraphed a turn
        // ahead like every other intent, so the squad gets to answer it.
        if (rand < 0.45 && enemy.speed >= 14 && !hasRelic('SIGNAL_JAMMER')) return intentFor('FLANK', enemy);
        return { type: 'ATTACK', icon: '⚔️' };
    }
}

// Enemy stats climb 1.5x per sector; rewards climb alongside so player power can compound
// too, and the run ends on a build/skill wall rather than an arithmetic one.
function sectorRewardMult() { return Math.pow(1.4, currentSector - 1); }

// Scores run to six figures late in a run and the header is 400px wide on a phone, so keep
// exact values while they fit and fall back to a compact form once they stop.
function formatStat(n) {
    n = Math.floor(n || 0);
    if (n < 100000) return n.toLocaleString();
    if (n < 1000000) return Math.round(n / 1000) + 'K';
    return (n / 1000000).toFixed(1) + 'M';
}

// ── Read the room ───────────────────────────────────────────────────────────────────────
// The engine does a great deal of arithmetic the player never sees: a number lands and there
// is no way to ask why it was that number, and no way to know who is about to die. Three
// readouts, all built from what the fight is already doing rather than a second model of it.
let hitTrace = null;   // the factors of the blow currently being resolved
let hitLog = [];       // the last two dozen blows, each with its whole story
let explaining = null; // index into hitLog of the blow being read

// What a hostile is about to do, priced honestly. Melee and flankers pick their target
// outright, so those are exact; ranged fire is weighted, so the likeliest mark is named.
// The forecast and the blow itself each kept this chain by hand, in two different orders -
// the forecast applied the STATUS cut before the weather, the blow applied it after, and with a
// floor at every step the board could already promise a number the swing did not deal. Ground
// would have made that a third copy, so there is one now and both call it.
//
// `roll` is the random spread the real swing adds and the forecast cannot know; the forecast
// passes nothing and reads the floor of the range, which is what a forecast should promise.
function enemyStrike(enemy, intent, opts = {}) {
    const g = ground();
    const type = (intent || {}).type || 'ATTACK';
    let raw = (enemy.dmgBase + (opts.roll || 0)) * enemyDmgMult(enemy);
    if (type === 'AOE') raw = enemy.dmgBase * 0.7 * enemyDmgMult(enemy) * (g.aoe || 1);
    else {
        if (opts.lockOn) raw *= 2.2;
        if (type === 'HEAVY') raw *= 1.5;
        if (opts.intercepted) raw *= opts.interceptMult;
        if (type === 'STATUS') raw *= 0.3;
        if (enemy.range === 'ranged') { if (currentWeather === 'SANDSTORM') raw *= 0.75; raw *= (g.ranged || 1); }
        else raw *= groundReach(1);
    }
    if (currentWeather === 'BLOODLUST') raw *= 1.2;
    return Math.floor(raw);
}
// How much of a melee swing the ground lets through, before the attacker's own rank is figured.
function groundReach(m) {
    const g = ground();
    return (g.reachFree ? 1 : m) * (g.reach || 1);
}

function forecastFor(enemy) {
    if (!enemy || enemy.isPlayer || enemy.hp <= 0 || !combatActive) return null;
    const intent = enemy.intent || { type: 'ATTACK' };
    const live = activeEntities.filter(e => e.isPlayer && e.hp > 0);
    if (!live.length) return null;
    if (enemy.burrowed > 0) return { kind: 'BURROW', enemy };
    if (intent.type === 'DEFEND' || intent.type === 'SIG') return { kind: intent.type, enemy };
    const atk = enemy.dmgType || 'phys';
    if (intent.type === 'AOE') {
        const raw = enemyStrike(enemy, intent);
        return { kind: 'AOE', enemy, hits: live.map(t => ({ target: t, dmg: mitigate(enemy, t, raw, atk, 'BASIC').n })) };
    }
    // A sniper with a mark already lined up is not choosing again.
    let mark = enemy.lockOn ? live.find(p => p.id === enemy.lockOn) : null;
    const locked = !!mark;
    if (!mark) {
        if (intent.type === 'FLANK') mark = [...live].sort((a, b) => b.gridPos - a.gridPos)[0];
        else if (enemy.range === 'melee') mark = [...live].sort((a, b) => a.gridPos - b.gridPos)[0];
        else mark = [...live].sort((a, b) => (backlineWeight(b) - backlineWeight(a)))[0];
    }
    // Someone braced in front of the mark eats it instead, softened - same rule the AI uses.
    let via = null; let interceptMult = 1;
    if (['ATTACK', 'HEAVY', 'STATUS', 'FLANK'].includes(intent.type)) {
        const cover = live.find(p => (p.guardTurns || 0) > 0 && p.gridPos < mark.gridPos);
        if (cover) { via = mark; mark = cover;
            interceptMult = Math.min(hasRelic('BULWARK_PLATING') ? 0.35 : 1, hasTrait(mark, 'BULWARK') ? 0.45 : 0.6); }
    }
    const raw = enemyStrike(enemy, intent, { lockOn: locked, intercepted: !!via, interceptMult });
    return { kind: intent.type, enemy, exact: enemy.range === 'melee' || intent.type === 'FLANK' || !!enemy.lockOn,
             hits: [{ target: mark, dmg: mitigate(enemy, mark, raw, atk, 'BASIC').n, via }] };
}

// Everything aimed at each operator this round, so the squad can see who will not survive it.
function threatBoard() {
    const board = {};
    activeEntities.filter(e => e.isPlayer && e.hp > 0).forEach(p => { board[p.id] = { dmg: 0, exact: true }; });
    activeEntities.filter(e => !e.isPlayer && e.hp > 0).forEach(e => {
        const f = forecastFor(e);
        if (!f || !f.hits) return;
        f.hits.forEach(h => {
            const slot = board[h.target.id];
            if (!slot) return;
            slot.dmg += h.dmg;
            if (f.exact === false) slot.exact = false;
        });
    });
    return board;
}

function explainHtml(i) {
    const h = hitLog[i];
    if (!h) return '';
    const rows = h.trace.map(t =>
        `<div class="ex-row"><span>${t.label}</span><span class="${t.f >= 1 ? 'ex-up' : 'ex-down'}">\u00D7${t.f.toFixed(2)}</span></div>`).join('');
    const soak = [];
    if (h.resist >= 100) soak.push('immune');
    else {
        if (h.resist > 0) soak.push(`resist \u2212${h.resist}`);
        if (h.resist < 0) soak.push(`weak to ${h.atkType}`);
        if (h.armor > 0) soak.push(`armour \u2212${h.armor}`);
        if (h.plated) soak.push('riot plate halved it');
    }
    return `<div class="ex-head">${h.attacker} \u2192 ${h.target}</div>
        <div class="ex-sub">${h.abilityStr || 'attack'} \u00B7 ${h.atkType}</div>
        <div class="ex-rows">
            <div class="ex-row ex-base"><span>rolled</span><span>${h.raw}</span></div>
            ${rows || '<div class="ex-row ex-none"><span>nothing bent it</span><span></span></div>'}
            <div class="ex-row ex-soak"><span>${soak.length ? soak.join(', ') : (h.soaked > 0 ? 'soaked' : 'nothing soaked it')}</span><span>${h.soaked >= 0 ? '\u2212' + h.soaked : '+' + (-h.soaked)}</span></div>
            <div class="ex-row ex-total"><span>landed</span><span>${h.net}</span></div>
        </div>`;
}
function renderExplain() {
    const el = document.getElementById('explain');
    if (!el) return;
    if (explaining === null || !hitLog[explaining]) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.innerHTML = `<div class="explain-card">${explainHtml(explaining)}
        <button class="dossier-close" data-action="explain-close">CLOSE</button></div>`;
    el.style.display = 'flex';
}
function openExplain(i) { explaining = Number(i); renderExplain(); }
function closeExplain() { explaining = null; renderExplain(); }

// ── First contact ───────────────────────────────────────────────────────────────────────
// Seventeen interlocking systems and nothing ever taught one of them: the manual is good and
// it is behind the settings gear, which is no use to somebody in their first fight. These are
// not a tutorial level - each one fires once, ever, at the moment its system first matters,
// and says the smallest true thing that makes the next decision make sense.
const PROMPTS = [
    { id: 'MUSTER',    title: 'THE MUSTER',      body: 'Pick who deploys and where they stand. Front rank takes the melee; the back rank is where fragile operators survive. Quirks are rolled fresh each expedition - the rerolls are yours to spend.' },
    { id: 'REACH',     title: 'REACH',           body: 'That ability is marked REACH -%. Melee swung from the middle or back rank lands soft. Move the operator forward, or hit something with a weapon that does not care.' },
    { id: 'COMBO',     title: 'A COMBO IS LIVE', body: 'That glowing ability finishes a status something is already carrying. Combos hit far harder and build momentum - lead with the status, then cash it in.' },
    { id: 'INTENT',    title: 'THEY TELEGRAPH',  body: 'The icon over each hostile is what it intends to do next turn. A heavy blow, an area attack, a flank around your line - all of it is announced a turn early, so all of it has an answer.' },
    { id: 'SIGNATURE', title: 'EVERY HOSTILE HAS A TRICK', body: 'The tag under a hostile names what it does - plate that must be broken, a shot it is lining up, a pack that grows stronger together. Tap any hostile when you are not aiming to read its full file.' },
    { id: 'STANDING',  title: 'A CONTRACT SETTLED', body: 'The standing contract at the foot of the board runs the length of an expedition rather than the length of a node, and pays accordingly. A fresh one is posted the moment one is settled, so there is always a long game to play toward.' },
    { id: 'GROUND',    title: 'THE GROUND COUNTS', body: 'This fight is not on open road, and the banner says what that changes. Tunnels put everything in arm\u2019s reach and make area attacks worse for both sides; open flats favour rifles and expose your back rank; ruins give whoever holds the front rank cover. The ground is marked on every node before you take it.' },
    { id: 'FACES',     title: 'THEY REMEMBER YOU', body: 'You have met this one before, and the tag above them says what they made of it. Paying, sparing and trading raise their standing; robbing them lowers it. What they offer next - and what turns up further down the road because of them - follows from that. It lasts one expedition.' },
    { id: 'RETREAT',   title: 'OR BUY ANOTHER GO', body: 'RETREAT is the other way out, and it is not the same one. It costs Scrap rather than blood, it can fail, and if it works you do not leave the node behind - you face it again from the top with the fight rolled fresh. Breaking away from a crowd is harder than breaking away from one, and the odds are on the button before you take them.' },
    { id: 'WITHDRAW',  title: 'YOU CAN LEAVE',   body: 'A fight going badly is not a fight you have to finish. WITHDRAW forfeits this node entirely, wounds everyone on the way out, and the survivors follow you to the next one - but the squad lives. Momentum spent on the way out makes the parting wound lighter.' },
    { id: 'MOMENTUM',  title: 'MOMENTUM IS A MARKET', body: 'Fighting fills the bar. Tactics cost momentum but never cost your action: sharpen the next hit, patch the worst-off operator, or take a second turn on the spot.' },
    { id: 'OVERDRIVE', title: 'OVERDRIVE IS READY', body: 'A full bar buys one devastating move from the operator taking their turn. The first time a class uses one you choose which of its two it fights with for the rest of the expedition.' },
    { id: 'PROMOTION', title: 'FIELD PROMOTION', body: 'A level-up offers three picks on the spot. Signatures change what an ability does and can only be taken once; training is a flat stat you can take again. Banking keeps the point for the Outpost.' },
    { id: 'GEAR',      title: 'SALVAGED GEAR',   body: 'Weapon mods change what an ability does - its reach, its cooldown, who it hits. Trinkets are worn passives anyone can take. Two slots each, fitted at the Outpost.' },
    { id: 'RELIC',     title: "THE COMMANDER'S CACHE", body: 'Relics last the whole expedition and stack with everything. Take the one that suits how this squad already fights, not the rarest card on the table.' },
    { id: 'CURSE',     title: 'A CURSED RELIC',  body: 'Cursed relics carry a real upside and a real cost, and they are never dealt at random - this one is on the table because you can refuse it. Read the second half of the line before you take it.' },
    { id: 'ROUTE',     title: 'THE ROUTE IS A PLAN', body: 'Taking a node commits you to what it connects to. Elites and warlords pay the most; camps and the Armory cost you a node but keep the squad standing. Look two tiers ahead before you step.' },
    { id: 'EXTRACT',   title: 'YOU CAN WALK OUT', body: 'An expedition does not have to end with the squad on the floor. Calling it at a camp banks everything the run earned with a bonus that grows the deeper you got, sends a Skull to the Citadel for every sector you cleared, and brings whatever relic you are carrying home with you. It also ends the run - and score climbs far faster with depth than the bonus does, so pushing on is worth more if you survive it. That is the whole question: is the squad in front of you good for one more sector?' },
    { id: 'GRUDGE',    title: 'IT REMEMBERS YOU', body: 'You have felled this commander before, and it has come back for it - heavier, faster, better armoured, and holding a move it never needed against you the first time. That move opens under a quarter health, after the enrage you already know about, and the fight log names it at the door so you can plan around it. A warlord is the one fight you cannot walk away from, so it pays for the trouble: felling a risen one banks an extra Skull for every grudge it was carrying.' },
    { id: 'BLEEDOUT',  title: 'THEY ARE BLEEDING OUT', body: 'That operator is on the floor with a clock over them, counted in their own turns. Run it out and they are gone for the rest of the expedition - there is no reviving them at the Outpost any more. Heal them where they lie (Cauterize, a Med-Stim, the STIM tactic), or end the fight: winning it, running from it and being dragged off it all get them clear. Only the clock kills.' },
    { id: 'RECRUIT',   title: 'SOMEONE WORTH SIGNING', body: 'The seven you start with are not everyone out here. A survivor brings a verb none of them has - a grinder for the front rank, a decontaminator for the middle, or a line that can haul what is hiding at the back of the enemy out where you can reach it. They cost Scrap, they arrive hurt, and there are only three in the whole wasteland. They join the bench: put them in the line at the Outpost.' },
    { id: 'ARMORY',    title: 'THE ARMORY',      body: 'A trader on the route. Gear, a marked-up relic, stims, a quirk do-over, and a bond that prepays your next regroup. Prices climb with the sector, so scrap spent early is worth more.' },
    { id: 'THREAT',    title: 'SOMEONE IS ABOUT TO DIE', body: 'The red figure over that operator is what lands on them this round if nothing changes, and it is more than they have left. Kill the thing aimed at them, brace in front of them, spend a STIM, or move them - but not nothing.' },
    { id: 'REGROUP',   title: 'THE SQUAD BROKE', body: 'A wipe is not the end of the expedition. Regrouping costs half your scrap and sends you back to the start of this sector with the squad on its feet. You have a limited number - felling a warlord earns one back.' }
];
let seenPrompts = [];      // ids already shown, meta-persisted
let promptQueue = [];

function promptSeen(id) { return seenPrompts.includes(id); }
// Fires at most once ever, and never while the player has turned them off.
function firePrompt(id) {
    if (globalSettings.prompts === false) return;
    if (promptSeen(id) || promptQueue.includes(id)) return;
    if (!PROMPTS.some(p => p.id === id)) return;
    promptQueue.push(id);
    renderPrompt();
}
function renderPrompt() {
    const el = document.getElementById('prompt');
    if (!el) return;
    const p = PROMPTS.find(x => x.id === promptQueue[0]);
    if (!p) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.innerHTML = `<div class="prompt-card">
        <div class="prompt-title">${p.title}</div>
        <div class="prompt-body">${p.body}</div>
        <div class="prompt-row">
            <button class="prompt-ok" data-action="prompt-ok">GOT IT</button>
            <button class="prompt-off" data-action="prompt-off">STOP SHOWING THESE</button>
        </div>
    </div>`;
    el.style.display = 'flex';
}
function dismissPrompt() {
    const id = promptQueue.shift();
    if (id && !seenPrompts.includes(id)) { seenPrompts.push(id); saveMeta(); }
    renderPrompt();
}
function disablePrompts() {
    globalSettings.prompts = false;
    Store.set(SETTINGS_KEY, JSON.stringify(globalSettings));
    promptQueue = [];
    renderPrompt(); updateSettingsUI();
}

// ── Know your enemy ─────────────────────────────────────────────────────────────────────
// A signature the player cannot read is just an unpleasant surprise. The bestiary remembers
// every type met across every run - what it does, what it resists, and what it has cost you -
// and any hostile on the field can be tapped for its dossier whenever you are not mid-aim.
let bestiary = {};   // name -> { met, killed, felled }, meta-persisted

function bestiaryEntry(name) {
    const b = bestiary[name];
    return { met: (b && b.met) || 0, killed: (b && b.killed) || 0, felled: (b && b.felled) || 0 };
}
function noteBestiary(name, field) {
    if (!name) return;
    if (!bestiary[name]) bestiary[name] = { met: 0, killed: 0, felled: 0 };
    bestiary[name][field] = (bestiary[name][field] || 0) + 1;
}
// The Archive is a standing file on everything out here, so nothing reads as a stranger.
function hasMet(name) { return !!metaUpgrades.archive || bestiaryEntry(name).met > 0; }

// Every hostile that exists, ordinary stock first and then the commanders.
function bestiaryRoster() {
    const out = [];
    Object.entries(ENEMY_POOL).forEach(([faction, list]) =>
        list.forEach(e => out.push({ name: e.name, faction, sig: e.sig, minTier: e.minTier,
                                     range: e.range, isHeavy: e.isHeavy, resistances: e.resistances, boss: false })));
    BOSS_POOL.forEach(b => out.push({ name: b.name, faction: 'COMMAND', sig: null, minTier: null,
                                      range: b.range, isHeavy: true, resistances: b.resistances, boss: true,
                                      passive: b.passive || null }));
    return out;
}
function bestiaryRecord(name) { return bestiaryRoster().find(e => e.name === name) || null; }

// The name a unit is filed under: an affix is a modifier on a type, not a type of its own.
function typeNameOf(ent) {
    if (!ent || ent.isPlayer) return null;
    return ent.eliteType ? String(ent.name).replace(`*${ent.eliteType}* `, '') : ent.name;
}

// Where a type first becomes reachable, in the coordinates the player actually navigates.
// minTier lives in effTier space - currentTier + (sector - 1) * SECTOR_TIER_BONUS - so the
// shallowest sector that can reach a given threshold is the one this solves for.
function unlockDepth(minTier) {
    const sector = Math.max(1, Math.ceil((minTier - TOTAL_TIERS) / SECTOR_TIER_BONUS) + 1);
    return { sector, tier: minTier - (sector - 1) * SECTOR_TIER_BONUS };
}

function dossierHtml(name) {
    const rec = bestiaryRecord(name);
    const tally = bestiaryEntry(name);
    if (!rec) return `<div class="dossier-body"><div class="dossier-none">No file on this one.</div></div>`;
    const sig = rec.sig ? ENEMY_SIGS[rec.sig] : null;
    const bp = rec.passive ? BOSS_PASSIVES[rec.passive] : null;
    const res = ['phys', 'bio', 'energy'].map(t => {
        const v = (rec.resistances || {})[t] || 0;
        const word = v >= 100 ? 'IMMUNE' : v > 5 ? `RESISTS ${v}` : v < 0 ? `WEAK ${v}` : '\u2014';
        const cls = v >= 100 ? 'dos-immune' : v > 5 ? 'dos-strong' : v < 0 ? 'dos-weak' : '';
        return `<div class="dos-res ${cls}"><span>${t.toUpperCase()}</span><span>${word}</span></div>`;
    }).join('');
    return `<div class="dossier-body">
        <div class="dossier-name">${name}</div>
        <div class="dossier-sub">${rec.boss ? 'WARLORD' : rec.faction} \u00B7 ${rec.range === 'ranged' ? 'RANGED' : 'MELEE'}${rec.isHeavy && !rec.boss ? ' \u00B7 HEAVY' : ''}${rec.minTier ? (d => ` \u00B7 FROM S${d.sector} T${d.tier}`)(unlockDepth(rec.minTier)) : ''}</div>
        ${sig ? `<div class="dossier-sig"><span class="dossier-sig-name">${sig.name}</span>
            <span class="dossier-sig-kind">${sig.kind === 'action' ? 'TELEGRAPHED' : sig.kind.toUpperCase()}</span>
            <span class="dossier-sig-desc">${sig.desc}</span></div>` : ''}
        ${bp ? `<div class="dossier-sig"><span class="dossier-sig-name">${bp.name}</span>
            <span class="dossier-sig-kind">PASSIVE</span>
            <span class="dossier-sig-desc">${bp.desc}</span></div>` : ''}
        <div class="dos-res-row">${res}</div>
        <div class="dossier-tally">
            <span>MET <b>${tally.met}</b></span>
            <span>KILLED <b>${tally.killed}</b></span>
            <span class="${tally.felled ? 'dos-cost' : ''}">COST YOU <b>${tally.felled}</b></span>
        </div>
    </div>`;
}

let inspecting = null;   // the id of the hostile whose file is open

function renderDossier() {
    const el = document.getElementById('dossier');
    if (!el) return;
    const ent = inspecting ? activeEntities.find(e => e.id === inspecting) : null;
    if (!ent) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.innerHTML = dossierHtml(typeNameOf(ent))
        + `<button class="dossier-close" data-action="dossier-close">CLOSE</button>`;
    el.style.display = 'flex';
}
function openDossier(id) { inspecting = id; renderDossier(); }
function closeDossier() { inspecting = null; renderDossier(); }

// The stock the wasteland draws from. Lifted out of the generator so the bestiary can
// enumerate every type that exists, met or not.
const ENEMY_POOL = {
    'BEASTS': [
    { name: "Attack Dog", sig: 'PACK_HUNT', minTier: 1, isHeavy: false, classType: "BEAST", range: 'melee', maxHp: 30, speed: 18, armor: 0, dmgBase: 10, img: "enemy_dog.webp", scale: 0.8, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: -2, bio: 0, energy: 0 } }, 
    { name: "Mutant", sig: 'DRAG_DOWN', minTier: 9, isHeavy: true, classType: "MUTANT", range: 'melee', maxHp: 70, speed: 7, armor: 0, dmgBase: 25, img: "enemy_mutant.webp", scale: 1.5, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 20, energy: -5 } }, 
    { name: "Chem Fiend", sig: 'GAS_BLOOM', minTier: 11, isHeavy: true, classType: "MUTANT", range: 'ranged', maxHp: 60, speed: 11, armor: 0, dmgBase: 15, img: "enemy_chem.webp", scale: 1.0, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 50, energy: -5 } }
    ],
    'RAIDERS': [
    { name: "Raider", sig: 'CALL_IT_IN', minTier: 1, isHeavy: false, classType: "RAIDER", range: 'melee', maxHp: 40, speed: 10, armor: 0, dmgBase: 12, img: "enemy_raider.webp", scale: 1.0, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: -2, bio: 2, energy: 0 } }, 
    { name: "Psycho", sig: 'FRENZY', minTier: 4, isHeavy: false, classType: "RAIDER", range: 'melee', maxHp: 45, speed: 14, armor: 0, dmgBase: 18, img: "enemy_psycho.webp", scale: 1.0, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 } }, 
    { name: "Sniper", sig: 'RANGING', minTier: 5, isHeavy: false, classType: "RAIDER", range: 'ranged', maxHp: 35, speed: 16, armor: 0, dmgBase: 25, img: "enemy_sniper.webp", scale: 1.0, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 } }, 
    { name: "Juggernaut", sig: 'RIOT_PLATE', minTier: 12, isHeavy: true, classType: "RAIDER", range: 'melee', maxHp: 90, speed: 6, armor: 5, dmgBase: 18, img: "enemy_juggernaut.webp", scale: 1.8, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 10, bio: 0, energy: -5 } }
    ],
    'MECH': [
    { name: "Drone", sig: 'ROTOR_LIFT', minTier: 4, isHeavy: false, classType: "DRONE", range: 'ranged', isHovering: true, maxHp: 25, speed: 18, armor: 5, dmgBase: 8, img: "enemy_drone.webp", scale: 0.7, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 8, bio: 100, energy: -10 } }, 
    { name: "Turret", sig: 'OVERWATCH', minTier: 5, isHeavy: false, classType: "MECH", range: 'ranged', maxHp: 50, speed: 2, armor: 8, dmgBase: 18, img: "enemy_turret.webp", scale: 0.9, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 10, bio: 100, energy: -10 } }, 
    { name: "War Rig", sig: 'AEGIS', minTier: 14, isHeavy: true, classType: "MECH", range: 'ranged', maxHp: 150, speed: 5, armor: 10, dmgBase: 25, img: "enemy_warrig.webp", scale: 1.8, hpDrop: -20, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 15, bio: 100, energy: -15 } }
    ],
    // Two factions built to be answered rather than out-damaged. `stand` names the portrait to
    // show until the real one is drawn - see PENDING_ART.
    'CHOIR': [
    { name: "Acolyte", sig: 'LITANY', minTier: 4, isHeavy: false, classType: "CULTIST", range: 'melee', maxHp: 45, speed: 12, armor: 0, dmgBase: 12, img: "enemy_choir_acolyte.webp", stand: "enemy_chem.webp", scale: 0.9, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 40, energy: -10 } },
    { name: "Censer Bearer", sig: 'RAD_WASH', minTier: 6, isHeavy: false, classType: "CULTIST", range: 'ranged', maxHp: 55, speed: 10, armor: 4, dmgBase: 14, img: "enemy_choir_censer.webp", stand: "enemy_chem.webp", scale: 1.0, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 5, bio: 55, energy: -10 } },
    { name: "Reliquary", sig: 'MARTYR', minTier: 10, isHeavy: true, classType: "CULTIST", range: 'melee', maxHp: 85, speed: 7, armor: 6, dmgBase: 16, img: "enemy_choir_reliquary.webp", stand: "enemy_mutant.webp", scale: 1.4, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 10, bio: 60, energy: -15 } },
    { name: "Hierophant", unique: true, sig: 'RESURGENCE', minTier: 13, isHeavy: true, classType: "CULTIST", range: 'ranged', maxHp: 75, speed: 13, armor: 4, dmgBase: 20, img: "enemy_choir_hierophant.webp", stand: "enemy_psycho.webp", scale: 1.3, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 70, energy: -5 } }
    ],
    'CARRION': [
    { name: "Carrion Rat", sig: 'TEEMING', minTier: 3, isHeavy: false, classType: "VERMIN", range: 'melee', maxHp: 22, speed: 20, armor: 0, dmgBase: 9, img: "enemy_carrion_rat.webp", stand: "enemy_dog.webp", scale: 0.6, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: -5, bio: 25, energy: 0 } },
    { name: "Blight Moth", sig: 'TEEMING', minTier: 5, isHeavy: false, classType: "VERMIN", range: 'ranged', isHovering: true, maxHp: 26, speed: 22, armor: 0, dmgBase: 11, img: "enemy_carrion_moth.webp", stand: "enemy_drone.webp", scale: 0.7, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: -5, bio: 30, energy: -10 } },
    { name: "Gorge Worm", sig: 'BURROW', minTier: 9, isHeavy: true, classType: "VERMIN", range: 'melee', maxHp: 70, speed: 9, armor: 2, dmgBase: 22, img: "enemy_carrion_worm.webp", stand: "enemy_mutant.webp", scale: 1.4, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 8, bio: 35, energy: -10 } },
    { name: "Brood Mother", unique: true, sig: 'BROOD', minTier: 12, isHeavy: true, classType: "VERMIN", range: 'ranged', maxHp: 95, speed: 8, armor: 4, dmgBase: 15, img: "enemy_carrion_brood.webp", stand: "enemy_juggernaut.webp", scale: 1.6, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 5, bio: 45, energy: -15 } }
    ]
};

function generateEnemies(nodeType, mult, isEliteNode, dmgMult = mult) {

    let bossBaseHp = currentSector === 1 ? 100 : 300;
    // Eased from 30/40 when the simulator showed the wall had just moved to tier 10: squads
    // finally reached the commander and its HEAVY telegraph one-shot anyone it touched.
    let bossBaseDmg = currentSector === 1 ? 24 : 34;
    
    if (nodeType === 'BOSS') {
        const b = bossForSector();
        // Everything it took from you last time, it kept.
        const g = grudgeOn(b.id);
        const gHp = 1 + GRUDGE.hp * g, gDmg = 1 + GRUDGE.dmg * g;
        const boss = {
            id: 'b1', name: risenName(b, g), bossId: b.id, classType: 'BOSS', range: b.range,
            maxHp: Math.floor(bossBaseHp * b.hpMult * mult * gHp), hp: Math.floor(bossBaseHp * b.hpMult * mult * gHp),
            speed: b.speed + GRUDGE.speed * g, armor: b.armor + GRUDGE.armor * g,
            baseArmor: b.armor + GRUDGE.armor * g,
            dmgBase: Math.floor(bossBaseDmg * b.dmgMult * dmgMult * gDmg),
            img: b.img, scale: b.scale, hpDrop: 0,
            stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0,
            resistances: { ...b.resistances }, phase: 1,
            grudge: g, grudgeMove: g > 0 ? (b.grudge || null) : null,
            intents: b.intents, bossPassive: b.passive || null, enrage: b.enrage
        };
        if (b.isHovering) boss.isHovering = true;
        if (b.sink) boss.sink = b.sink;
        if (b.dmgType) boss.dmgType = b.dmgType;
        if (b.stormTurn) { boss.stormTurn = b.stormTurn; boss.stormClock = 0; }
        if (b.venom) { boss.venom = { ...b.venom }; boss.venomStacks = 0; boss.venomClock = 0; }
        boss.intent = rollIntent(boss);

        // A warlord that does not arrive alone brings its own: a lieutenant it hides behind, or
        // a generator holding its ward up. Both are the fight's actual first problem.
        const retinue = [];
        const raise = (spec, id, extra) => {
            const u = { id, name: spec.name, classType: spec.classType, range: spec.range,
                maxHp: Math.floor(spec.hp * mult), hp: Math.floor(spec.hp * mult),
                speed: spec.speed, armor: spec.armor || 0, baseArmor: spec.armor || 0, isPlayer: false,
                dmgBase: Math.floor(spec.dmg * dmgMult), img: spec.img, scale: spec.scale, hpDrop: 0,
                stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0,
                resistances: { ...spec.resistances }, sig: spec.sig || null, sigCd: 0, ...(extra || {}) };
            if (u.sig === 'RIOT_PLATE') u.plate = Math.floor(u.maxHp * 0.5);
            if (spec.stand) u.stand = spec.stand;
            u.intent = rollIntent(u);
            retinue.push(u);
            return u;
        };
        if (b.escort) { boss.escortId = 'boss_escort'; boss.escortArmor = b.escortArmor || 20; raise(b.escort, 'boss_escort'); }
        if (b.ward) { boss.wardId = 'boss_ward'; boss.wardSoak = b.wardSoak || 0.15; raise(b.ward, 'boss_ward'); }
        return [boss, ...retinue];
    }
    
    // Later sectors unlock tougher stock progressively rather than all at once: the old gate
    // was bypassed outright from sector 2, which dropped tier-8 units into tier-1 fights.
    const effTier = currentTier + (currentSector - 1) * SECTOR_TIER_BONUS;

    function poolFor(type) {
        let valid = ENEMY_POOL[type].filter(e => effTier >= e.minTier);
        if (valid.length === 0) {
            // Nothing has unlocked yet - fall back to the cheapest stock, never the whole pool.
            let minT = Math.min(...ENEMY_POOL[type].map(e => e.minTier));
            valid = ENEMY_POOL[type].filter(e => e.minTier === minT);
        }
        let weighted = [];
        // Heavies used to jump from weight 1 to weight 5 the moment they unlocked - most of a
        // sector's deaths clustered exactly there. They ramp in now: rare, then common, then usual.
        const cap = (FACTIONS[type] && FACTIONS[type].heavyCap) || 99;
        valid.forEach(e => {
            let weight = !e.isHeavy ? 5 : effTier < HEAVY_RAMP.rare ? 1 : effTier < HEAVY_RAMP.common ? 3 : 5;
            // A swarm made mostly of its own big units is not a swarm, so a faction can hold
            // its heavies down however deep the run gets.
            if (e.isHeavy) weight = Math.min(weight, cap);
            for (let j = 0; j < weight; j++) weighted.push(e);
        });
        return weighted;
    }

    const homePool = poolFor(nodeType);
    // Only raiders bring reinforcements from elsewhere - they are scavengers, so salvaged
    // machinery and war dogs both fit. Beasts are wild and mechs are automated; neither
    // recruits, and a turret standing among a pack of dogs just reads as a bug.
    const allies = (FACTION_ALLIES[nodeType] || []).filter(t => ENEMY_POOL[t]);

    let sZ = effTier >= 9 ? (Math.random() < 0.25 ? 4 : 3)
           : effTier >= 4 ? (Math.random() < 0.5 ? 3 : 2)
           : 2;
    // A swarm that turns up two-strong is not a swarm. The row is fitted to what it holds, so
    // a wide field is a rendering problem the layout already solves rather than a hard cap.
    sZ += (FACTIONS[nodeType] && FACTIONS[nodeType].swarm) || 0;
    let squad = [];
    for (let i = 0; i < sZ; i++) {
        // Above mid-game, squads can pick up an attached specialist from another faction.
        let usePool = homePool;
        if (allies.length && effTier >= 6 && i > 0 && Math.random() < 0.25) usePool = poolFor(allies[Math.floor(Math.random() * allies.length)]);
        // Some units compound with themselves - one that lays more of itself, one that raises
        // the fallen - and a second is not twice the fight, it is a different one.
        let pick = usePool[Math.floor(Math.random() * usePool.length)];
        if (pick.unique && squad.some(s => s.name === pick.name)) {
            const rest = usePool.filter(e => !e.unique || !squad.some(s => s.name === e.name));
            if (rest.length) pick = rest[Math.floor(Math.random() * rest.length)];
        }
        let t = JSON.parse(JSON.stringify(pick)); 
        let hp = Math.floor(t.maxHp * mult); t.hp = hp; t.maxHp = hp; t.dmgBase = Math.floor(t.dmgBase * dmgMult); t.baseArmor = t.armor || 0;
        t.sigCd = 0;
        // Riot Plate is a second bar that only soaks: sized off the unit so it scales with the
        // sector without needing a curve of its own.
        if (hasSig(t, 'RIOT_PLATE')) t.plate = Math.floor(hp * 0.5);
        
        if (isEliteNode && (ascension >= 1 || Math.random() < 0.6)) {
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

// Some backdrops carry a dark foreground band at the bottom - measured at 25% of bg_nest and
// 27% of bg_foundry, against 0-3% for the older, landscape ones. Standing the squad at a fixed
// height put them inside that band rather than on the visible ground, so each backdrop states
// how far up its ground line sits. Anything unlisted keeps the original footing.
const GROUND_LIFT = { 'bg_nest.webp': '21vh', 'bg_foundry.webp': '25vh' };
const DEFAULT_LIFT = '12vh';

// Every pairing lives here so the damage maths and the on-screen prompt read the same table.
const COMBOS = [
    { move: 'BUCKSHOT',     needs: 'oiledTurns',    name: 'IGNITE',    mult: 2.0, consumes: 'oiledTurns' },
    { move: 'MOLOTOV',      needs: 'oiledTurns',    name: 'IGNITE',    mult: 2.0, consumes: 'oiledTurns' },
    { move: 'PIPE_RIFLE',   needs: 'bleedingTurns', name: 'EXPLOIT',   mult: 1.5 },
    { move: 'SCRAP_BLADE',  needs: 'stunnedTurns',  name: 'EXECUTE',   mult: 1.5 },
    { move: 'THERMITE',     needs: 'corrodedTurns', name: 'MELTDOWN',  mult: 2.0 },
    { move: 'EXECUTE_SHOT', needs: 'markedTurns',   name: 'CONFIRMED', mult: 2.0, consumes: 'markedTurns' },
    { move: 'RIP_AND_TEAR', needs: 'bleedingTurns', name: 'REND',      mult: 1.8 },
    { move: 'BAYONET_THRUST', needs: 'bleedingTurns', name: 'GORE',    mult: 1.7 },
    { move: 'SPRAY_GUN',    needs: 'corrodedTurns', name: 'DISSOLVE',  mult: 1.8 },
    // The barb goes through plate that has already been eaten - which is the Hazmat's job.
    { move: 'HARPOON',      needs: 'corrodedTurns', name: 'PUNCH-THROUGH', mult: 1.7 }
];

// One row per ability: who fields it, what the button reads, and which cooldown key it burns.
// The command deck is rendered from this, so an ability exists in exactly one place.
const ABILITIES = {
    BRUISER:    [{ move: 'SCRAP_BLADE',   label: 'Scrap Blade',           reach: 'melee' },
                 { move: 'HEAVY_WRENCH',  label: 'Heavy Wrench',         reach: 'melee', cd: 'heavy_wrench' },
                 { move: 'IRON_GUARD',    label: 'Iron Guard',           reach: 'self',  cd: 'iron_guard', act: 'self' }],
    MEDIC:      [{ move: 'PISTOL',        label: 'Pistol',               reach: 'ranged' },
                 { move: 'RAD_SHOT',      label: 'Rad Shot',             reach: 'ranged' },
                 { move: 'CAUTERIZE',     label: 'Cauterize',            reach: 'self',  cd: 'cauterize' }],
    SCAVENGER:  [{ move: 'PIPE_RIFLE',    label: 'Pipe Rifle',           reach: 'ranged' },
                 { move: 'FLASHBANG',     label: 'Flashbang',            reach: 'ranged', cd: 'flashbang' },
                 { move: 'ACID_FLASK',    label: 'Acid Flask (Corrode)', reach: 'ranged', cd: 'acid_flask' }],
    PYROMANIAC: [{ move: 'FLARE_GUN',     label: 'Flare Gun (Oil)',      reach: 'ranged' },
                 { move: 'MOLOTOV',       label: 'Molotov (AoE)',        reach: 'ranged', cd: 'molotov' },
                 { move: 'THERMITE',      label: 'Thermite',             reach: 'ranged', cd: 'thermite' }],
    SHOTGUNNER: [{ move: 'SLUG_SHOT',     label: 'Slug Shot',            reach: 'ranged' },
                 { move: 'BUCKSHOT',      label: 'Buckshot (Front)',     reach: 'melee', cd: 'buckshot' },
                 { move: 'EXECUTE_SHOT',  label: 'Execute',              reach: 'ranged', cd: 'execute_shot' }],
    SNIPER:     [{ move: 'QUICK_SHOT',    label: 'Quick Shot',           reach: 'ranged' },
                 { move: 'DEADEYE',       label: 'Deadeye (Back)',       reach: 'ranged', cd: 'deadeye' },
                 { move: 'SPOTTERS_MARK', label: "Spotter's Mark",       reach: 'ranged', cd: 'spotters_mark' }],
    HOUND:      [{ move: 'SNAP',          label: 'Snap',                 reach: 'melee' },
                 { move: 'FERAL_BITE',    label: 'Feral Bite (Bleed)',   reach: 'melee', cd: 'feral_bite' },
                 { move: 'RIP_AND_TEAR',  label: 'Rip and Tear (Bleed)', reach: 'melee', cd: 'rip_and_tear' }],
    // The three you find on the road rather than start with.
    TRENCH_FIEND:[{ move: 'BAYONET_THRUST', label: 'Bayonet Thrust',     reach: 'melee' },
                 { move: 'RIPSAW',        label: 'Ripsaw (Bleed)',       reach: 'melee', cd: 'ripsaw' },
                 { move: 'OVER_THE_TOP',  label: 'Over The Top',         reach: 'self',  cd: 'over_the_top', act: 'self' }],
    HAZMAT:     [{ move: 'SPRAY_GUN',     label: 'Spray Gun',            reach: 'ranged' },
                 { move: 'CAUSTIC_BURST', label: 'Caustic Burst (Two)',  reach: 'ranged', cd: 'caustic_burst', aoe: true },
                 { move: 'PURGE_VALVE',   label: 'Purge Valve',          reach: 'self',  cd: 'purge_valve', act: 'self' }],
    HARPOONER:  [{ move: 'HARPOON',       label: 'Harpoon',              reach: 'ranged' },
                 { move: 'DRAG_LINE',     label: 'Drag Line (Pull)',     reach: 'ranged', cd: 'drag_line' },
                 { move: 'BARBED_SHOT',   label: 'Barbed Shot (Bleed)',  reach: 'ranged', cd: 'barbed_shot' }]
};

// Formation used to be decided at the Outpost and then mean nothing once the shooting started.
// A melee weapon swung from the back rank, or at something standing behind the enemy front, is
// reaching further than it wants to; a rifle does not care where either side stands. So the
// front rank is where a melee unit earns its damage - and where the enemy melee comes for it.
const REACH_PENALTY = { 2: 0.85, 3: 0.6 };
const RANK_LABELS = { 1: 'FRONT', 2: 'MID', 3: 'BACK' };
const DEPTH_PENALTY = 0.65;
const FRONT_RANKS = 2;

// ── Dossiers: operator mastery ──────────────────────────────────────────────────────────
// Each class accrues lifetime XP across every run, and the ranks unlock OPTIONS, never raw
// power: a title at I, a class quirk joining that class's draw pool at II, and at III a
// fourth ability with a bring-three-of-four loadout picked at the muster.
const MASTERY_RANKS = [0, 1500, 4000, 8000];
const MASTERY_TITLES = {
    BRUISER: 'Wall of the Waste', MEDIC: 'Last Light', SCAVENGER: 'Magpie Prime',
    PYROMANIAC: 'Firekeeper', SHOTGUNNER: 'The Doorman', SNIPER: 'One Round', HOUND: 'Alpha',
    TRENCH_FIEND: 'The Last Man Over', HAZMAT: 'Decontaminator', HARPOONER: 'The Line Holder'
};
let mastery = {};   // classType -> lifetime XP, meta-persisted
function masteryXp(cls) { return mastery[cls] || 0; }
function masteryRank(cls) {
    const x = masteryXp(cls); let r = 0;
    for (let i = 1; i < MASTERY_RANKS.length; i++) if (x >= MASTERY_RANKS[i]) r = i;
    return r;
}
function noteMastery(cls, amount) { if (cls) mastery[cls] = (mastery[cls] || 0) + amount; }

// Rank II: one more quirk in that class's draw pool - a flavour of the class, not a buff.
const CLASS_QUIRKS = {
    BRUISER:    { id: 'BULLHEADED',     name: 'Bullheaded',     desc: 'Built like a bulkhead. +20 HP, -2 SPD.',  dmg: 0, hp: 20,  spd: -2 },
    MEDIC:      { id: 'CALM_UNDER_FIRE',name: 'Calm Under Fire',desc: 'Never hurries, never late. +3 SPD, -5 HP.', dmg: 0, hp: -5, spd: 3 },
    SCAVENGER:  { id: 'HOARDERS_EYE',   name: "Hoarder's Eye",  desc: 'Sees the angle first. +2 DMG, +1 SPD, -5 HP.', dmg: 2, hp: -5, spd: 1 },
    PYROMANIAC: { id: 'ACCELERANT_BLOOD',name:'Accelerant Blood',desc: 'Burns from the inside. +4 DMG, -10 HP.', dmg: 4, hp: -10, spd: 0 },
    SHOTGUNNER: { id: 'POINT_BLANK_NERVES',name:'Point-Blank Nerves',desc:'Flinches at nothing. +3 DMG, -1 SPD.', dmg: 3, hp: 0, spd: -1 },
    SNIPER:     { id: 'ICE_VEINS',      name: 'Ice Veins',      desc: 'A pulse that never spikes. +5 DMG, -2 SPD, -5 HP.', dmg: 5, hp: -5, spd: -2 },
    HOUND:      { id: 'WAR_BRED',       name: 'War-Bred',       desc: 'Raised on the road. +4 SPD, -5 HP.', dmg: 0, hp: -5, spd: 4 },
    TRENCH_FIEND:{ id: 'SHELL_SHOCKED', name: 'Shell-Shocked',  desc: 'Long past caring. +4 DMG, -8 HP.', dmg: 4, hp: -8, spd: 0 },
    HAZMAT:     { id: 'SEALED_SUIT',    name: 'Sealed Suit',    desc: 'Nothing gets in, nothing gets out. +12 HP, -2 SPD.', dmg: 0, hp: 12, spd: -2 },
    HARPOONER:  { id: 'STEADY_LINE',    name: 'Steady Line',    desc: 'Hands that do not shake. +6 DMG, -6 HP, -1 SPD.', dmg: 6, hp: -6, spd: -1 }
};
function quirkPoolFor(cls) {
    const extra = masteryRank(cls) >= 2 && CLASS_QUIRKS[cls] ? [CLASS_QUIRKS[cls]] : [];
    return [...QUIRK_POOL, ...extra];
}

// Rank III: the fourth ability. The muster picks which three of the four deploy.
const FOURTH_ABILITIES = {
    BRUISER:    { move: 'SHIELD_SLAM',     label: 'Shield Slam',            reach: 'melee',  cd: 'shield_slam' },
    MEDIC:      { move: 'STIM_DART',       label: 'Stim Dart (Ally)',       reach: 'ranged', cd: 'stim_dart' },
    SCAVENGER:  { move: 'SHIV',            label: 'Shiv',                   reach: 'melee',  cd: 'shiv' },
    PYROMANIAC: { move: 'HEAT_WAVE',       label: 'Heat Wave (Two)',        reach: 'ranged', cd: 'heat_wave', aoe: true },
    SHOTGUNNER: { move: 'RIOT_BUTT',       label: 'Riot Butt',              reach: 'melee',  cd: 'riot_butt' },
    SNIPER:     { move: 'PIERCING_VOLLEY', label: 'Piercing Volley (Two)',  reach: 'ranged', cd: 'piercing_volley', aoe: true },
    HOUND:      { move: 'HARRY',           label: 'Harry (Twice)',          reach: 'melee',  cd: 'harry' },
    TRENCH_FIEND:{ move: 'TRENCH_SWEEP',   label: 'Trench Sweep (Two)',     reach: 'melee',  cd: 'trench_sweep', aoe: true },
    HAZMAT:     { move: 'TANK_RUPTURE',   label: 'Tank Rupture',           reach: 'ranged', cd: 'tank_rupture' },
    HARPOONER:  { move: 'WHALE_LINE',     label: 'Whale Line (Two)',       reach: 'ranged', cd: 'whale_line', aoe: true }
};
// The deck an operator actually brings: the classic three below rank III; at III, four
// minus whichever one the muster benched (the fourth sits out by default).
function deckFor(char) {
    const base = ABILITIES[char.classType] || [];
    const fourth = FOURTH_ABILITIES[char.classType];
    if (!fourth || masteryRank(char.classType) < 3) return base;
    const all = [...base, fourth];
    const benched = (char.benchedMove && all.some(a => a.move === char.benchedMove)) ? char.benchedMove : fourth.move;
    return all.filter(a => a.move !== benched);
}

const MOVE_REACH = Object.fromEntries(
    [...Object.values(ABILITIES).flat(), ...Object.values(FOURTH_ABILITIES)].map(a => [a.move, a.reach]));
// Which abilities land on more than one body, read off the same declarations - so the ground
// rule and the second hit can never disagree about what counts as an area attack.
const MOVE_AOE = Object.fromEntries(
    [...Object.values(ABILITIES).flat(), ...Object.values(FOURTH_ABILITIES)].map(a => [a.move, !!a.aoe]));
function isAoe(move) { return !!MOVE_AOE[move]; }

// Every ability an entity can be standing behind, in one place, so nothing needs a second list.
function isMelee(move) { return MOVE_REACH[move] === 'melee'; }
function isRanged(move) { return MOVE_REACH[move] === 'ranged'; }

function reachMult(move, attacker, dist) {
    if (!isMelee(move)) return 1;
    let m = REACH_PENALTY[attacker.gridPos] || 1;
    if (dist >= FRONT_RANKS) m *= DEPTH_PENALTY;
    // A tunnel puts everything in arm's reach; open flats make every swing a walk.
    return groundReach(m);
}

// Two separate things cost a melee swing damage, and they are surfaced separately: the attacker's
// own rank costs the same against every target, so it belongs on the button, while reaching past
// the enemy front rank depends on which one is picked, so it belongs on that target.
function reachNote(move, attacker, dist) {
    const m = reachMult(move, attacker, dist);
    return m < 1 ? `-${Math.round((1 - m) * 100)}%` : null;
}
function isOutOfDepth(move, dist) { return isMelee(move) && dist >= FRONT_RANKS; }

// Momentum used to be a fuse: the bar filled, and at 100% there was exactly one thing to do
// with it. It is a market now - three tactics at low prices, spendable on any operator's turn
// without costing the action, with the full overdrive still waiting at the top.
const MOMENTUM_TACTICS = [
    { id: 'FOCUS', cost: 25, label: 'FOCUS',  desc: "The squad's next attack deals +30% damage." },
    { id: 'STIM',  cost: 30, label: 'STIM',   desc: 'Cleanse and patch the worst-off operator for 20% health.' },
    { id: 'PRESS', cost: 40, label: 'PRESS',  desc: 'The current operator acts twice this turn.' }
];
let momentumFocus = 0; let pressExtra = false;

// Each class carries two overdrives. The first full bar of a run offers both; using one locks
// the class to it for the rest of the expedition, so the choice is exercised, not configured.
const OVERDRIVES = {
    BRUISER: [
        { id: 'EARTHSHAKER', name: 'EARTHSHAKER', desc: 'Hit everything for 1.5x and stun the line.' },
        { id: 'SIEGEBREAKER', name: 'SIEGEBREAKER', desc: 'One target: 3.2x, armour stripped and corroded.' }],
    MEDIC: [
        { id: 'FIELD_REVIVE', name: 'FIELD REVIVE', desc: 'Revive or restore one operator to half health.' },
        { id: 'TRIAGE_PROTOCOL', name: 'TRIAGE PROTOCOL', desc: 'Heal every standing operator 35% and cleanse the squad.' }],
    SCAVENGER: [
        { id: 'SCRAP_STORM', name: 'SCRAP STORM', desc: 'Hit everything for 1.2x energy.' },
        { id: 'BOOBY_TRAP', name: 'BOOBY TRAP', desc: 'Hit everything for 0.6x energy, corrode and oil it all.' }],
    PYROMANIAC: [
        { id: 'HELLFIRE', name: 'HELLFIRE', desc: 'Hit everything for 2x energy, oiled and bleeding.' },
        { id: 'BACKBURNER', name: 'BACKBURNER', desc: 'One target: 3.2x energy, burning for 3 turns.' }],
    SHOTGUNNER: [
        { id: 'BREACH_CHARGE', name: 'BREACH CHARGE', desc: 'One target: armour stripped, 3x damage.' },
        { id: 'SCATTERSTORM', name: 'SCATTERSTORM', desc: 'Hit everything for 1.4x and stun the front.' }],
    SNIPER: [
        { id: 'HEADSHOT', name: 'HEADSHOT', desc: 'Execute one target outright (4x against a commander).' },
        { id: 'OVERWATCH', name: 'OVERWATCH', desc: 'Hit everything for 1.2x and mark it all for 3 turns.' }],
    HOUND: [
        { id: 'APEX_PREDATOR', name: 'APEX PREDATOR', desc: 'Heal to full, savage one target for 2.5x bio.' },
        { id: 'BLOOD_SCENT', name: 'BLOOD SCENT', desc: 'Hit everything for 1.5x bio and open bleeds.' }],
    TRENCH_FIEND: [
        { id: 'MEATGRINDER', name: 'MEATGRINDER', desc: 'Hit everything for 1.6x and open bleeds.' },
        { id: 'LAST_CHARGE', name: 'LAST CHARGE', desc: 'One target: 3.4x, and it costs him a fifth of his health.' }],
    HAZMAT: [
        { id: 'FULL_PURGE', name: 'FULL PURGE', desc: 'Hit everything for 1.5x bio and corrode it all.' },
        { id: 'CLEAN_ROOM', name: 'CLEAN ROOM', desc: 'Cleanse and heal the squad 45%, and corrode the field.' }],
    HARPOONER: [
        { id: 'FULL_HAUL', name: 'FULL HAUL', desc: 'Drag the whole line forward and hit it for 1.3x.' },
        { id: 'IRON_BARB', name: 'IRON BARB', desc: 'One target: 3.5x, hauled to the front and bleeding.' }]
};
let odChoices = {}; let pendingOverdrive = null;

function overdriveFor(classType) {
    const pair = OVERDRIVES[classType] || [];
    return pair.find(o => o.id === odChoices[classType]) || pair[0] || { id: 'ULTIMATE', name: 'ULTIMATE' };
}

// Anything else striking a marked target still gets the mark's smaller bonus and spends it.
const MARK_BONUS = 1.5;
const DAMAGING_MOVES = ['SCRAP_BLADE','HEAVY_WRENCH','PISTOL','RAD_SHOT','PIPE_RIFLE','FLASHBANG','FLARE_GUN',
    'MOLOTOV','SLUG_SHOT','BUCKSHOT','QUICK_SHOT','DEADEYE','SNAP','FERAL_BITE',
    'ACID_FLASK','THERMITE','EXECUTE_SHOT','SPOTTERS_MARK','RIP_AND_TEAR',
    'BAYONET_THRUST','RIPSAW','SPRAY_GUN','CAUSTIC_BURST','HARPOON','DRAG_LINE','BARBED_SHOT'];

// The enemy line is the order they sit in activeEntities: index 0 of the living ones is the
// front. Hauling moves the target there, which is the whole of the Harpooner's verb - every
// reach, ground and targeting rule already reads that order, so nothing else has to change.
function haulForward(ent) {
    if (!ent || ent.isPlayer) return false;
    const foes = activeEntities.filter(e => !e.isPlayer);
    const at = foes.indexOf(ent);
    if (at <= HAUL_TO) return false;
    foes.splice(at, 1); foes.splice(HAUL_TO, 0, ent);
    activeEntities = [...activeEntities.filter(e => e.isPlayer), ...foes];
    return true;
}

function comboFor(move, target) {
    if (!target || target.isPlayer) return null;
    return COMBOS.find(c => c.move === move && (target[c.needs] || 0) > 0) || null;
}

// What the player is shown before committing: the named pairing, or the generic mark payoff.
function comboHint(move, target) {
    const c = comboFor(move, target);
    if (c) return c.name;
    if (target && !target.isPlayer && (target.markedTurns || 0) > 0 && DAMAGING_MOVES.includes(move)) return 'MARKED';
    return null;
}

const WEATHER_BANNERS = {
    TOXIC_SMOG:     ['weather-smog',  '⚠️ TOXIC SMOG: Passive Bio DMG to Active Units ⚠️'],
    SANDSTORM:      ['weather-sand',  '⚠️ SANDSTORM: Ranged Abilities deal -25% DMG ⚠️'],
    SHRAPNEL_WINDS: ['weather-shrap', '⚠️ SHRAPNEL WINDS: 30% chance for random DMG at Turn Start ⚠️'],
    BLOODLUST:      ['weather-blood', '💀 THUNDERDOME BLOODLUST: All units deal +20% DMG 💀']
};

// bannerText only replaces the wording. The weather itself is unchanged, so the +20% damage
// a boss arena applies is identical whichever commander is waiting - only the sign differs.
function applyCombatScenery(bgFile, bannerText) {
    startAmbience(bgFile);
    combatBgFile = bgFile;
    const field = document.querySelector('.battlefield');
    if (field) field.style.marginBottom = GROUND_LIFT[bgFile] || DEFAULT_LIFT;
    document.getElementById('combat-sky-layer').style.backgroundImage = `linear-gradient(to bottom, rgba(43, 10, 10, 0.4) 0%, rgba(0, 0, 0, 0.5) 100%), url('${bgFile}')`;
    const wBanner = document.getElementById('weather-banner'); const w = WEATHER_BANNERS[currentWeather];
    const text = bannerText || (w ? w[1] : '');
    wBanner.className = w ? w[0] : '';
    wBanner.innerText = text;
    wBanner.style.display = text ? 'block' : 'none';
    // The ground gets its own line rather than sharing the sky's: both can be true at once, and
    // a fight in a tunnel under a smog bank should say so twice.
    const gBanner = document.getElementById('ground-banner');
    if (gBanner) {
        const g = ground();
        gBanner.className = g.dot || '';
        gBanner.innerText = g.banner || '';
        gBanner.style.display = g.banner ? 'block' : 'none';
    }
}

function initiateCombat(nodeType, isEliteNode) {
    let deployedRoster = playerRoster.filter(p => p.gridPos > 0);
    if (!deployedRoster.some(p => p.hp > 0)) { renderOutpost(); showOutpostNotice('⚠ Every deployed operator is down. Revive someone, or deploy from the bench, before heading out.'); return; }
    deployedRoster.sort((a, b) => a.gridPos - b.gridPos);

    switchScreen('screen-combat'); combatActive = true; document.getElementById('log').innerHTML = '';

    let bgFile = 'bg_combat.webp'; currentWeather = 'CLEAR'; currentNodeType = nodeType; isCurrentNodeElite = isEliteNode;
    if (currentTier === 1 && currentSector === 1) { bgFile = 'bg_combat.webp'; } else {
        if (nodeType === 'BOSS') { bgFile = bossForSector().bg || 'bg_thunderdome.webp'; currentWeather = 'BLOODLUST'; }
        else if (FACTIONS[nodeType]) {
            bgFile = FACTIONS[nodeType].bg;
            if (Math.random() < 0.4) currentWeather = FACTIONS[nodeType].weather;
        }
    }
    // A fight entered from the map keeps the promise its node made; a fight staged directly
    // (dev tools, suites) still rolls as before.
    if (forecastWeather) { currentWeather = forecastWeather; forecastWeather = null; }
    currentTerrain = forecastTerrain || 'OPEN_ROAD'; forecastTerrain = null;
    if (currentTerrain !== 'OPEN_ROAD') firePrompt('GROUND');
    if (hasContract('HARSH_SKIES') && currentWeather === 'CLEAR') {
        currentWeather = ['TOXIC_SMOG', 'SANDSTORM', 'SHRAPNEL_WINDS'][Math.floor(Math.random() * 3)];
    }
    // An irradiated sector's warlord fights under the smog, not the bloodlust.
    if (nodeType === 'BOSS' && sectorFront === 'IRRADIATED') currentWeather = 'TOXIC_SMOG';
    applyCombatScenery(bgFile, nodeType === 'BOSS' ? bossForSector().banner : null);

    // Enemies are built fresh each fight; the squad persists, so anything left on a unit has to
    // be cleared here or it rides into the next node.
    playerRoster.forEach(ent => { ent.stunnedTurns = 0; ent.bleedingTurns = 0; ent.armorTurns = 0; ent.armor = 0;
        ent.oiledTurns = 0; ent.corrodedTurns = 0; ent.markedTurns = 0; ent.guardTurns = 0; });
    momentumFocus = 0; pressExtra = false; pendingOverdrive = null;
    fightLog = newFightLog(); fightLog.chased = chasedIn; chasedIn = false;
    playerRoster.forEach(ent => { ent.secondWindUsed = false; ent.deadRendered = ent.hp <= 0; });
    inspecting = null;
    bondSavesUsed = new Set();
    // The Glass Cannon Core's teeth: nobody walks in whole.
    if (hasRelic('GLASS_CANNON_CORE'))
        deployedRoster.forEach(p => { if (p.hp > 0) p.hp = Math.min(p.hp, Math.floor(p.maxHp * 0.85)); });
    // HP keeps the steep 1.5x-per-sector curve; damage climbs far more slowly so a deep fight
    // is dangerous rather than an unavoidable one-shot. Player power compounds through
    // repeatable percentage perks, which is what makes the curve climbable at all.
    const mult = difficultyMult * (1 + ((currentTier - 1) * TIER_HP_GROWTH)) * Math.pow(SECTOR_HP_SCALE, currentSector - 1);
    const dmgMult = difficultyMult * (1 + ((currentTier - 1) * TIER_DMG_GROWTH)) * Math.pow(SECTOR_DMG_SCALE, currentSector - 1);
    
    activeEntities = [...deployedRoster, ...generateEnemies(nodeType, mult, isEliteNode, dmgMult)];
    // Whoever the squad ran from is here, carrying the wounds it already put on them. They are
    // spent the moment they arrive, so running twice does not stack a mob.
    if (pursuit && pursuit.units && pursuit.units.length) {
        const caught = pursuit.units.map((u, i) => {
            const e = JSON.parse(JSON.stringify(u));
            e.id = `chase_${Date.now()}_${i}`;
            e.intent = rollIntent(e);
            return e;
        });
        activeEntities.push(...caught);
        log(`> They caught up. ${caught.length} from the last fight ${caught.length === 1 ? 'is' : 'are'} here.`, 'log-dmg');
        pursuit = null;
        chasedIn = true;
    }
    // The front's fingerprints on the fight itself: a warband's elites hit harder, and a
    // faction front's warlord does not arrive alone.
    if (sectorFront === 'RAIDER_WARBAND' && isEliteNode && nodeType === 'RAIDERS')
        activeEntities.filter(e => !e.isPlayer).forEach(e => { e.dmgBase = Math.ceil(e.dmgBase * 1.25); });
    if (nodeType === 'BOSS') {
        const addFaction = { RAIDER_WARBAND: 'RAIDERS', MACHINE_UPRISING: 'MECH', BLOOD_MOON: 'BEASTS',
                             THE_CHOIR: 'CHOIR', CARRION_BLOOM: 'CARRION' }[sectorFront];
        if (addFaction) {
            const escort = generateEnemies(addFaction, mult, false, dmgMult)[0];
            escort.id = 'front_escort';
            activeEntities.push(escort);
            log(`> The warlord does not come alone: ${escort.name} rides with them.`, 'log-dmg');
        }
    }
    // Every distinct type on the field goes into the file, once per fight however many of them
    // showed up. This has to run after the line is built, escort and all.
    [...new Set(activeEntities.filter(e => !e.isPlayer).map(typeNameOf))].forEach(n => noteBestiary(n, 'met'));
    saveMeta();
    firePrompt('INTENT');
    if (activeEntities.some(e => !e.isPlayer && sigOf(e))) firePrompt('SIGNATURE');
    // The Lead-Lined Coat weighs on the turn order without touching the sheet.
    const queueSpeed = e => e.speed - (e.isPlayer && hasRelic('LEAD_LINED_COAT') ? 3 : 0);
    turnQueue = [...activeEntities].sort((a, b) => queueSpeed(b) - queueSpeed(a));
    activeIndex = 0;
    // Second Watch hands the opening turn to whichever enemy is fastest, however quick the squad is.
    if (hasContract('THEY_MOVE_FIRST')) {
        const firstFoe = turnQueue.findIndex(e => !e.isPlayer);
        if (firstFoe > 0) activeIndex = firstFoe;
    }
    log("> COMBAT INITIATED.", "log-turn");
    if (nodeType === 'BOSS') {
        const b = bossForSector(); const g = grudgeOn(b.id);
        log(`> ${risenName(b, g).toUpperCase()}: ${b.blurb}`, "log-combo");
        if (g > 0) {
            firePrompt('GRUDGE');
            log(`> You have put this one down ${g === 1 ? 'once' : `${g} times`}. It came back for it.`, "log-dmg");
            if (b.grudge) log(`> Held in reserve: ${b.grudge.name} — ${b.grudge.tell}`, "log-status");
        }
    } processTurn();
}

const logEl = document.getElementById('log');
function log(msg, styleClass = "log-dmg", hitId = null) {
    const el = document.createElement('div'); el.className = styleClass; el.innerText = msg;
    // A logged blow keeps a handle on its own arithmetic: tap the line to read it back.
    if (hitId !== null) { el.classList.add('log-explainable'); el.dataset.action = 'explain'; el.dataset.hit = String(hitId); }
    logEl.appendChild(el); logEl.scrollTop = logEl.scrollHeight;
}

function renderQueue() {
    const qStr = turnQueue.map(e => { if (e.hp <= 0) return ''; return (e.stunnedTurns > 0 ? '!' : '') + e.name.substring(0,3).toUpperCase(); }).filter(s => s !== '').join(' > ');
    document.getElementById('queue-display').innerText = `Q: ${qStr}`;
}

// The resistance system decides whether an attack lands, is shrugged off, or does nothing at
// all - but it used to be revealed only in the log, after the turn was already spent. Show it
// on the unit so the choice can be made before committing.
// Letters, not symbols: the badges render at 9px, where a monochrome glyph is unreadable
// and an emoji-presentation one ignores our colours entirely.
const DMG_TYPES = [['phys', 'P'], ['bio', 'B'], ['energy', 'E']];

// Art that is commissioned but not drawn yet is never requested. Rendering the missing file
// and letting the error handler swap it afterwards blanks the sprite on every rebuild - and
// renderField rebuilds on every frame of a turn - so the stand-in is chosen up front. The
// error handler stays as the net for art that is genuinely broken rather than merely pending.
function portraitFor(ent) {
    return (ent && ent.stand && PENDING_ART.includes(ent.img)) ? ent.stand : ent.img;
}

// A status was a bare emoji in a coloured box: two channels a colourblind player cannot
// separate - bleed, oil and corrosion are a droplet, a barrel and a flask at ten pixels - and
// it never said how long any of it had left. Each carries a letter, a border shape of its own
// and its remaining turns now, so colour is the last of four cues rather than the only one.
const STATUSES = [
    { key: 'bleedingTurns', name: 'BLEED',    letter: 'B', icon: '\u{1F4A7}', cls: 'st-bleed',
      desc: 'Loses 8% of its health at the start of each of its turns.' },
    { key: 'stunnedTurns',  name: 'STUN',     letter: 'S', icon: '\u{1F4AB}', cls: 'st-stun',
      desc: 'Loses its turn entirely.' },
    { key: 'armorTurns',    name: 'BRACED',   letter: 'A', icon: '\u{1F6E1}\uFE0F', cls: 'st-armor',
      desc: 'Carrying temporary armour on top of its own.' },
    { key: 'oiledTurns',    name: 'OILED',    letter: 'O', icon: '\u{1F6E2}\uFE0F', cls: 'st-oil',
      desc: 'Takes 15 more from energy, and fire ignites it for double.' },
    { key: 'corrodedTurns', name: 'CORRODED', letter: 'C', icon: '\u{1F9EA}', cls: 'st-corrode',
      desc: 'Armour counts as zero against every hit.' },
    { key: 'markedTurns',   name: 'MARKED',   letter: 'M', icon: '\u{1F3AF}', cls: 'st-mark',
      desc: 'Ranged, and lined up to be executed next turn.' }
];
function statusChips(ent) {
    return STATUSES.filter(s => (ent[s.key] || 0) > 0).map(s =>
        `<span class="st ${s.cls}" title="${s.name}: ${s.desc}" aria-label="${s.name}, ${ent[s.key]} turns left">` +
        `<b>${s.letter}</b><i>${ent[s.key]}</i></span>`).join('');
}

function resistBadges(ent) {
    if (ent.isPlayer || !ent.resistances) return '';
    const marks = DMG_TYPES.map(([type, glyph]) => {
        const v = ent.resistances[type] || 0;
        if (v >= 100) return `<span class="res res-immune" title="Immune to ${type}">${glyph}</span>`;
        if (v > 5)    return `<span class="res res-strong" title="Resists ${type}">${glyph}</span>`;
        if (v < 0)    return `<span class="res res-weak" title="Weak to ${type}">${glyph}</span>`;
        return '';
    }).join('');
    return marks ? `<div class="res-row">${marks}</div>` : '';
}

function renderField() {
    renderQueue();
    window.__threatCache = (combatActive && !pendingAction) ? threatBoard() : {}; const pTeam = document.getElementById('player-team'); const eTeam = document.getElementById('enemy-team'); pTeam.innerHTML = ''; eTeam.innerHTML = ''; const pCells = [], eCells = [], eLoad = []; const sigsShown = new Set();
    activeEntities.forEach(ent => {
        let isDead = ent.hp <= 0; const isAct = (!isDead && turnQueue.length > 0 && turnQueue[activeIndex]?.id === ent.id) ? 'active' : '';
        // The first render after death plays the fall; every render after shows the settled corpse.
        const dCls = isDead ? (ent.deadRendered ? 'dead settled' : 'dead dying') : '';
        const bleedCls = (isDown(ent) && (ent.downTurns || 0) > 0) ? 'bleeding-out' : '';
        if (isDead && !ent.deadRendered) ent.deadRendered = true;
        if (!isDead) ent.deadRendered = false;
        let tCls = ''; let clk = '';
        // Targets are divs, so they need to be announced and reachable like the buttons are.
        const targetable = attrs => `${attrs} tabindex="0" role="button" aria-label="Target ${ent.name}"`;
        if (pendingAction) {
            if (pendingAction === 'OVERDRIVE' && turnQueue[activeIndex].classType === 'MEDIC' && ent.isPlayer) {
                tCls = 'targetable-ally'; clk = targetable(`data-action="target" data-id="${ent.id}"`);
            } else if ((!isDead || (isDown(ent) && REACHES_THE_DOWN.includes(pendingAction))) && !ent.burrowed) {
                if ((pendingAction === 'CAUTERIZE' || pendingAction === 'REPOSITION' || pendingAction === 'STIM_DART') && ent.isPlayer) { tCls = 'targetable-ally'; clk = targetable(`data-action="target" data-id="${ent.id}"`); }
                else if (['ITEM_MED', 'ITEM_BOMB', 'ITEM_ADRENALINE', 'ITEM_EMP'].includes(pendingAction)) {
                    if (pendingAction === 'ITEM_MED' && ent.isPlayer) { tCls = 'targetable-ally'; clk = targetable(`data-action="use-item" data-id="${ent.id}"`); }
                    else if (pendingAction === 'ITEM_ADRENALINE' && ent.isPlayer) { tCls = 'targetable-ally'; clk = targetable(`data-action="use-item" data-id="${ent.id}"`); }
                    else if (pendingAction === 'ITEM_BOMB' && !ent.isPlayer) { tCls = 'targetable-enemy'; clk = targetable(`data-action="use-item" data-id="${ent.id}"`); }
                    else if (pendingAction === 'ITEM_EMP' && !ent.isPlayer) { tCls = 'targetable-enemy'; clk = targetable(`data-action="use-item" data-id="${ent.id}"`); }
                }
                else if (pendingAction !== 'CAUTERIZE' && pendingAction !== 'REPOSITION' && !ent.isPlayer) { tCls = 'targetable-enemy'; clk = targetable(`data-action="target" data-id="${ent.id}"`); }
            }
        }
        // Somebody on the floor with a number over them is the whole mechanic. It sits where
        // the threat tag sits, because it is the same question: who is about to be lost.
        let downTag = '';
        if (isDown(ent) && (ent.downTurns || 0) > 0) {
            firePrompt('BLEEDOUT');
            downTag = `<div class="down-tag" title="Bleeding out. Heal them before the clock runs out, or win the fight.">\u2620 ${ent.downTurns}</div>`;
        } else if (ent.isPlayer && ent.fallen) {
            downTag = `<div class="down-tag down-lost" title="Gone for the rest of the expedition.">LOST</div>`;
        }
        // What is aimed at this operator this round, and whether they survive it.
        let threatTag = '';
        if (ent.isPlayer && !isDead && combatActive && !pendingAction) {
            const t = (window.__threatCache || {})[ent.id];
            if (t && t.dmg > 0) {
                const fatal = t.dmg >= ent.hp;
                if (fatal) firePrompt('THREAT');
                threatTag = `<div class="threat-tag${fatal ? ' threat-fatal' : ''}" title="Incoming this round if nothing changes">${fatal ? '\u2620 ' : ''}\u2212${t.dmg}${t.exact ? '' : '?'}</div>`;
            }
        }
        // While an ability is armed, every target shows what it will actually absorb.
        let soakTag = '';
        if (!ent.isPlayer && !isDead && pendingAction && tCls === 'targetable-enemy') {
            const probe = mitigate(turnQueue[activeIndex] || ent, ent, 100, 'phys', pendingAction);
            const pct = Math.round(probe.n);
            if (pct < 95) soakTag = `<div class="soak-tag" title="A 100-damage physical blow lands for this">${pct}%</div>`;
        }
        // A signature is only fair if it is visible: the name rides the card, and plate,
        // overwatch and a pending ranged shot each show their live state. A commander's
        // passive is as much a rule of the fight as a signature is, so it rides the card the
        // same way - and the pump shows the dose it is on.
        let sigTag = '';
        let tagText = '', tagTitle = '', tagSpent = false;
        const bossPas = (!ent.isPlayer && !isDead && !sigOf(ent) && ent.bossPassive) ? BOSS_PASSIVES[ent.bossPassive] : null;
        if (bossPas) {
            const dose = ent.venom ? ` ${ent.venomStacks || 0}/${ent.venom.max}` : '';
            let live = '';
            try { live = bossPas.state ? (bossPas.state(ent) || '') : ''; } catch (e) { live = ''; }
            tagText = `${bossPas.name.toUpperCase()}${dose}${live}`; tagTitle = bossPas.desc;
        }
        if (!ent.isPlayer && !isDead && sigOf(ent)) {
            const s = sigOf(ent);
            let state = '';
            if (ent.sig === 'RIOT_PLATE') state = (ent.plate || 0) > 0 ? ` ${ent.plate}` : ' BROKEN';
            if (ent.sig === 'OVERWATCH' && (ent.overwatch || 0) > 0) state = ' \u2022 LIVE';
            if (ent.sig === 'RANGING' && ent.lockOn) state = ' \u2022 LOCKED';
            if (ent.sig === 'BURROW' && ent.burrowed > 0) state = ' \u2022 UNDER';
            if (ent.sig === 'TEEMING') state = carrionStanding() >= TEEMING_FLOOR ? ' \u2022 THICK' : ' \u2022 THINNED';
            tagText = `${s.name.toUpperCase()}${state}`; tagTitle = s.desc;
            tagSpent = ent.sig === 'RIOT_PLATE' && !(ent.plate > 0);
        }
        // A swarm of six that all read TEEMING . THICK says the same thing six times, in six
        // slots too narrow to hold it. An identical tag is printed once; anything carrying its
        // own state - a plate count, a live overwatch - differs in its text and so still shows.
        // The repeats still occupy their space rather than vanishing, or the cards in a row end
        // up different heights and the whole line goes ragged around them.
        if (tagText) {
            const echo = !ent.isPlayer && sigsShown.has(tagText);
            if (!ent.isPlayer) sigsShown.add(tagText);
            sigTag = `<div class="sig-tag${tagSpent ? ' sig-spent' : ''}${echo ? ' sig-echo' : ''}"${echo ? ' aria-hidden="true"' : ` title="${tagTitle}"`}>${tagText}</div>`;
        }
        // Not aiming at anything? Then a tap on a hostile opens its file rather than doing nothing.
        if (!pendingAction && !ent.isPlayer && !isDead) {
            tCls = 'inspectable';
            clk = `tabindex="0" role="button" aria-label="Inspect ${ent.name}" data-action="inspect" data-id="${ent.id}"`;
        }
        let eff = isDead ? '' : statusChips(ent);
        let hoverCls = ent.isHovering && !isDead ? 'hovering' : '';
        const hint = (pendingAction && !isDead && tCls === 'targetable-enemy') ? comboHint(pendingAction, ent) : null;
        // Rank is currently only legible from the left-to-right ordering, which says nothing
        // about which slot a unit is in once someone is down. Say it outright.
        const rank = (ent.isPlayer && !isDead && ent.gridPos > 0) ? RANK_LABELS[ent.gridPos] : null;
        const guarding = (ent.isPlayer && !isDead && (ent.guardTurns || 0) > 0);
        // Whether this particular target is further back than the swing wants to reach.
        let farTag = false;
        if (pendingAction && !isDead && tCls === 'targetable-enemy') {
            const foes = activeEntities.filter(e => !e.isPlayer && e.hp > 0);
            farTag = isOutOfDepth(pendingAction, foes.findIndex(e => e.id === ent.id));
        }
        let eliteGlow = ent.eliteType && !isDead ? 'filter: drop-shadow(0 0 15px #8B0000);' : '';

        const html = `
            <div class="entity ${isAct} ${dCls} ${bleedCls} ${tCls} ${hint ? 'has-combo' : ''} ${farTag ? 'out-of-reach' : ''} ${guarding ? 'covering' : ''}" id="${ent.id}" ${clk} style="--sprite-scale: ${ent.scale || 1}; --sprite-sink: ${ent.sink || 0}px;">
                <div class="intent-icon" style="display:${ent.intent && !isDead && !ent.isPlayer ? 'flex' : 'none'}">${ent.intent ? (ascension >= 3 && ent.intent.type === 'HEAVY' ? '?' : ent.intent.icon) : ''}</div>
                ${hint ? `<div class="combo-flag">${hint}</div>` : ''}
                ${farTag ? `<div class="reach-flag">FAR</div>` : ''}
                ${guarding ? `<div class="guard-flag">COVERING</div>` : ''}
                <div style="width: 100%; position: relative; z-index: 10; transform: translateY(${ent.hpDrop || 0}px);">
                    ${rank ? `<div class="rank-chip rank-${ent.gridPos}">${rank}</div>` : ''}
                    ${downTag}${threatTag}${soakTag}${sigTag}
                    ${eff ? `<div class="status-badge">${eff}</div>` : ''}
                    <div class="hp-text">${ent.hp}/${ent.maxHp}</div>
                    <div class="hp-container"><div class="hp-fill ${ent.isPlayer ? 'player-hp' : 'enemy-hp'}" style="width: ${(ent.hp / ent.maxHp) * 100}%"></div></div>
                    ${isDead ? '' : resistBadges(ent)}
                </div><img class="portrait ${hoverCls}" src="${portraitFor(ent)}"${ent.stand ? ` data-stand="${ent.stand}"` : ''} style="${eliteGlow}">
            </div>`;
        if (ent.isPlayer) pCells.push(html); else { eCells.push(html); eLoad.push(Math.max(1, ent.scale || 1)); }
    });
    pTeam.innerHTML = pCells.join(''); eTeam.innerHTML = eCells.join('');
    pTeam.classList.toggle('crowded', pTeam.children.length >= 4);
    eTeam.classList.toggle('crowded', eTeam.children.length >= 4);
    fitEnemyRow(eTeam, eLoad);
    // An open file closes itself if its subject dies or the squad starts aiming.
    if (inspecting) {
        const subj = activeEntities.find(e => e.id === inspecting);
        if (!subj || subj.hp <= 0 || pendingAction) inspecting = null;
    }
    renderDossier();
    renderCommandDeck();
}

function renderCommandDeck() {
    const d = document.getElementById('command-deck'); d.innerHTML = ''; if (!combatActive) return;
    if (pendingAction) { d.innerHTML = `<button style="color:#8B0000; border-color:#8B0000" data-action="cancel">CANCEL ORDERS</button>`; return; }
    let aE = turnQueue[activeIndex];
    if (!aE) { d.innerHTML = ''; return; }
    if (!aE.isPlayer) { d.innerHTML = `<div class="dash-msg">ENEMY TURN...</div>`; return; }
    if (aE.stunnedTurns > 0) { d.innerHTML = `<div class="dash-msg">STUNNED</div><button data-action="skip-turn">Skip Turn</button>`; return; }
    // Armed, the question owns the deck. Leaving the abilities live under a confirmation is a
    // misclick trap in both directions: a thumb reaching for CONFIRM lands on a move, or the
    // reverse. There are two answers to this and nothing else on screen.
    if (armedExit === 'RETREAT' && canRetreat()) {
        const paid = retreatCost(), odds = Math.round(retreatOdds() * 100);
        d.innerHTML = `<div class="withdraw-cost">FALL BACK: -${paid} Scrap, and a ${odds}% chance it works. `
            + `Break clean and you face this node again from the top, with the fight rolled fresh. `
            + `Fail and the Scrap is gone anyway, along with the turn.</div>`
            + `<button class="title-btn btn-retreat btn-armed" data-action="retreat">CONFIRM \u2014 FALL BACK</button>`
            + `<button class="title-btn btn-withdraw-back" data-action="withdraw-cancel">HOLD THE LINE</button>`;
        d.scrollTop = 0;
        return;
    }
    if (armedExit === 'WITHDRAW' && canWithdraw()) {
        const c = withdrawCost();
        const worst = c.hits.reduce((a, h) => Math.max(a, h.loss), 0);
        const spend = c.spend > 0 ? `, spends ${c.spend}% momentum` : '';
        d.innerHTML = `<div class="withdraw-cost">LEAVE NOW: no loot from this node, `
            + `-${Math.round(c.pct * 100)}% health on everyone (up to ${worst})${spend}`
            + (c.chasers ? `, and ${c.chasers} follow${c.chasers === 1 ? 's' : ''} you to the next fight.` : '.')
            + `</div>`
            + `<button class="title-btn btn-withdraw btn-armed" data-action="withdraw">CONFIRM \u2014 BREAK CONTACT</button>`
            + `<button class="title-btn btn-withdraw-back" data-action="withdraw-cancel">STAY AND FIGHT</button>`;
        // The deck was scrolled to reach the button at its foot; the price is at the top of what
        // replaced it, so put the panel back where it can be read.
        d.scrollTop = 0;
        return;
    }

    let cds = aE.cooldowns; let deckHtml = '';

    if (momentum >= overdriveAt()) {
        const pair = OVERDRIVES[aE.classType] || [];
        if (!odChoices[aE.classType] && pair.length === 2) {
            // The first full bar of the run: both options on the table, and using one is choosing.
            pair.forEach(o => {
                deckHtml += `<button class="title-btn btn-overdrive" data-action="queue" data-move="OVERDRIVE" data-variant="${o.id}" title="${o.desc}">OVERDRIVE: ${o.name}</button>`;
            });
        } else {
            const o = overdriveFor(aE.classType);
            deckHtml += `<button class="title-btn btn-overdrive" data-action="queue" data-move="OVERDRIVE" data-variant="${o.id}" title="${o.desc}">OVERDRIVE: ${o.name}</button>`;
        }
    }

    // The tactics row: cheap spends that do not cost the action. Rendered whenever any is
    // affordable, so the price of holding for the overdrive is always visible.
    if (momentum >= overdriveAt()) firePrompt('OVERDRIVE');
    if (!pendingAction && MOMENTUM_TACTICS.some(t => momentum >= tacticCost(t))) {
        firePrompt('MOMENTUM');
        deckHtml += `<div class="tactic-row">` + MOMENTUM_TACTICS.map(t =>
            `<button class="tactic-btn" ${momentum < tacticCost(t) ? 'disabled' : ''} ${t.id === 'STIM' && !stimTarget() ? 'disabled' : ''} data-action="tactic" data-kind="${t.id}" title="${t.desc}"><span class="tactic-name">${t.label}</span><span class="tactic-cost">⚡${tacticCost(t)}</span></button>`
        ).join('') + `</div>`;
    }

    // A pairing is only worth surfacing if the player can act on it now, so the button is flagged
    // when some enemy already on the field carries the status the ability cashes in. Only named
    // pairings count here: a mark boosts every move equally, so flagging them all would light the
    // whole deck and say nothing about which one to pick. Aiming still calls the mark out.
    const foes = activeEntities.filter(e => !e.isPlayer && e.hp > 0);
    const liveCombo = move => (foes.map(f => comboFor(move, f)).find(Boolean) || {}).name || null;

    const deck = [...deckFor(aE)];
    // Formation was fixed the moment the fight started, so a medic caught in the front rank
    // stayed there until it died. Swapping costs the whole turn, which is the price of it.
    if (activeEntities.filter(e => e.isPlayer && e.hp > 0 && e.id !== aE.id).length > 0) {
        deck.push({ move: 'REPOSITION', label: '↔ Reposition', reach: 'self' });
    }

    for (const a of deck) {
        const cd = a.cd ? (cds[a.cd] || 0) : 0;
        const ready = cd === 0 ? liveCombo(a.move) : null;
        // A melee ability swung from the second or third rank lands soft wherever it is aimed,
        // and that is worth knowing before the ability is even selected.
        const short = (cd === 0 && isMelee(a.move) && (REACH_PENALTY[aE.gridPos] || 1) < 1)
            ? `-${Math.round((1 - REACH_PENALTY[aE.gridPos]) * 100)}%` : null;
        if (ready) firePrompt('COMBO');
        if (short) firePrompt('REACH');
        const cls = [ready ? 'combo-ready' : '', short ? 'reach-short' : ''].filter(Boolean).join(' ');
        deckHtml += `<button ${cd > 0 ? 'disabled' : ''} ${cls ? `class="${cls}"` : ''} data-action="${a.act || 'queue'}" data-move="${a.move}">`
                  + `${a.label}${cd > 0 ? ` [${cd}]` : ''}${ready ? ` <span class="combo-tag">${ready}</span>` : ''}`
                  + `${short ? ` <span class="reach-tag">REACH ${short}</span>` : ''}</button>`;
    }

    if (inventory.length > 0) { deckHtml += `<button style="border-color:#B8860B; color:#B8860B;" data-action="bag">BAG (${inventory.length})</button>`; }
    // Last in the deck on purpose: the deck is a list of things to do to the enemy, and the way
    // out belongs under them, not above the first ability the eye lands on. One press arms it.
    if (canWithdraw()) {
        deckHtml += `<button class="title-btn btn-withdraw" data-action="withdraw" title="Leave the fight for good. Costs the node's loot, a wound on everyone, and they follow.">WITHDRAW</button>`;
    }
    // The other way out, and the difference is stated on the button: withdrawing gives up the
    // node, retreating buys another go at it. Shown greyed when the purse is short, so the price
    // is learnable rather than the option silently missing.
    if (combatActive && currentNodeType !== 'BOSS' && !pendingAction &&
        activeEntities.some(e => e.isPlayer && e.hp > 0)) {
        const paid = retreatCost(), broke = scrap < paid;
        // The first fight where the purse can actually cover it is the first time the option
        // is real, so that is where it gets explained.
        if (!broke) firePrompt('RETREAT');
        deckHtml += `<button class="title-btn btn-retreat" ${broke ? 'disabled' : ''} data-action="retreat" `
            + `title="Fall back and face this node again. Costs ${paid} Scrap and can fail.">`
            + `RETREAT [${paid} \u2699]${broke ? ' \u2014 SHORT' : ''}</button>`;
    }
    d.innerHTML = deckHtml;
}

function processTurn() {
    if (!combatActive) return; pendingAction = null; let aE = turnQueue[activeIndex]; if (aE.hp <= 0) { nextTurn(); return; }
    if (aE.isPlayer && fightLog) fightLog.turns++;
    saveGameState();
    renderField(); applyTurnStartEffects(aE); if (!combatActive) return; if (!aE.hp > 0) return checkWinState(); 
    if (aE.stunnedTurns > 0) { if (!aE.isPlayer) { log(`> ${aE.name} stunned.`, "log-status"); spawnFCT(aE.id, "STUNNED", "fct-status"); aE.stunnedTurns--; setTimeout(nextTurn, 1000 * globalSettings.combatSpeed); return; } else return; }
    // The beat of air before the swing: the intent icon pulses through the wait.
    if (!aE.isPlayer) { pulseIntent(aE); setTimeout(() => executeEnemyAi(aE), 1000 * globalSettings.combatSpeed); }
}

function applyTurnStartEffects(ent) {
    let chg = false;
    const wasAlive = ent.hp > 0;
    if (ent.isPlayer && ent.cooldowns) {
        const step = hasRelic('AMMO_HOIST') ? 2 : 1;
        for (let s in ent.cooldowns) { if (ent.cooldowns[s] > 0) { ent.cooldowns[s] = Math.max(0, ent.cooldowns[s] - step); chg = true; } }
    }
    
    const noteWeatherDeath = cause => {
        if (ent.hp <= 0 && ent.isPlayer && runStats)
            runStats.lastKiller = { cause, sector: currentSector, tier: currentTier };
    };
    if (currentWeather === 'TOXIC_SMOG') { let sDmg = Math.floor(2 * (1 + ((currentTier - 1) * 0.4))); ent.hp = Math.max(0, ent.hp - sDmg); log(`> ${ent.name} choked by Smog for ${sDmg} DMG.`, "log-dmg"); spawnFCT(ent.id, `-${sDmg}`, "fct-status"); chg = true; addMomentum(5); triggerHitFlash(ent.id); noteWeatherDeath('SMOG'); }
    if (currentWeather === 'SHRAPNEL_WINDS' && Math.random() < 0.3) { let shrapDmg = Math.floor(5 * (1 + ((currentTier - 1) * 0.4))); ent.hp = Math.max(0, ent.hp - shrapDmg); log(`> Shrapnel struck ${ent.name} for ${shrapDmg} DMG!`, "log-dmg"); spawnFCT(ent.id, `-${shrapDmg}`, "fct-dmg"); chg = true; addMomentum(5); triggerHitFlash(ent.id); noteWeatherDeath('SHRAPNEL'); }

    // Over The Top runs on the Fiend's own turns, so it is spent here rather than on the clock.
    if ((ent.chargeTurns || 0) > 0) { ent.chargeTurns--; chg = true; if (ent.chargeTurns > 0) spawnFCT(ent.id, "OVER THE TOP", "fct-combo"); }
    if (hasTrait(ent, 'NO_MANS_LAND')) ent.bleedingTurns = 0;
    if (ent.bleedingTurns > 0) { let b = Math.max(1, Math.floor(ent.maxHp * 0.08));
        if (ent.isPlayer && hasRelic('FIELD_DRESSING')) b = Math.max(1, Math.floor(b / 2));
        if (ent.isPlayer && relicSetActive('Field Surgery')) ent.bleedingTurns = Math.min(ent.bleedingTurns, 1);
        if (hasQuirk(ent, 'SLOW_BLEEDER')) b = Math.max(1, Math.floor(b / 2));
        if (hasTrinket(ent, 'TOURNIQUET')) ent.bleedingTurns = Math.min(ent.bleedingTurns, 2); ent.hp = Math.max(0, ent.hp - b); log(`> ${ent.name} bleeds for ${b}.`, "log-dmg"); spawnFCT(ent.id, `-${b}`, "fct-dmg"); ent.bleedingTurns--; chg = true; if(ent.isPlayer) addMomentum(5); triggerHitFlash(ent.id); noteWeatherDeath('BLEED'); }
    // Bleeding out and choking are deaths too. Now that a unit going down has a voice, dying to
    // a status tick in silence is the odd one out rather than the norm.
    if (wasAlive && ent.hp <= 0) { playSFX(ent.isPlayer ? 'fallen' : 'downed'); if (ent.isPlayer) goDown(ent); }
    // Expiring temporary armour used to zero the unit's innate plating too, so any armoured
    // enemy that braced permanently lost the armour it started with.
    if (ent.armorTurns > 0) { ent.armorTurns--; if (ent.armorTurns === 0) { ent.armor = ent.baseArmor || 0; } chg = true; }
    if (ent.bossPassive === 'PLATING' && ent.hp > 0) {
        const cap = (ent.baseArmor || 0) + 30;
        if (ent.armor < cap) { ent.armor = Math.min(cap, ent.armor + 6); spawnFCT(ent.id, "+PLATE", "fct-heal"); chg = true; }
    }
    if (ent.guardTurns > 0) { ent.guardTurns--; chg = true; }
    if (ent.oiledTurns > 0) { ent.oiledTurns--; chg = true; }
    if (ent.corrodedTurns > 0) { ent.corrodedTurns--; chg = true; }
    if (ent.markedTurns > 0) { ent.markedTurns--; chg = true; }
    if (ent.blessedTurns > 0) { ent.blessedTurns--; if (ent.blessedTurns === 0) ent.blessed = 0; chg = true; }
    if (chg) renderField();
}

// A commander's sprite is two to three slots wide. Standing one beside its retinue drew the
// retinue entirely behind it - and the retinue is the unit these fights are asking you to
// shoot first, so it was hidden behind the one thing you cannot usefully hit. Crowding is a
// question of how much sprite is in the row rather than how many units are in it, so a row
// carrying a commander measures the width it has and fits itself to it. Ordinary rows never
// reach the guard, and a lone commander keeps its full size.
function fitEnemyRow(team, scales) {
    // 2.0 is the line between the heaviest ordinary stock (a Juggernaut at 1.8, which has
    // always overlapped its neighbours and reads fine doing it) and a commander.
    const retinue = scales.length > 1 && scales.some(s => s >= 2);
    team.classList.toggle('retinue', retinue);
    if (!retinue) { team.style.removeProperty('--row-fit'); return; }
    const slot = team.firstElementChild ? team.firstElementChild.getBoundingClientRect().width : 0;
    // Half the field, less the gap the two teams keep between them.
    const room = (team.parentElement ? team.parentElement.clientWidth : 0) * 0.44;
    const want = slot * scales.reduce((a, s) => a + s, 0);
    team.style.setProperty('--row-fit', (want > room && room > 0) ? (room / want).toFixed(3) : '1');
}

// ── Withdrawing ─────────────────────────────────────────────────────────────────────────
// There was no way out of a fight. A bad opening - the wrong formation against a flanker, two
// heavies in the first two turns - had no answer but to lose the squad and spend a fallback,
// and the only risk decision in a run was made on the map before any information arrived.
// Leaving costs the node's whole payout, a wound on everyone, and the survivors at your back.
const WITHDRAW = { wound: 0.30, floor: 0.10, pursuers: 3 };

// What it costs, worked out before it is spent rather than after. Momentum is the difference
// between a rout and a fighting withdrawal, which gives a full bar a second thing to be for.
function withdrawCost() {
    const eased = WITHDRAW.wound - (WITHDRAW.wound - WITHDRAW.floor) * (Math.min(100, momentum) / 100);
    const squad = activeEntities.filter(e => e.isPlayer && e.hp > 0);
    const chasers = activeEntities.filter(e => !e.isPlayer && e.hp > 0)
        .sort((a, b) => (b.dmgBase || 0) - (a.dmgBase || 0)).slice(0, WITHDRAW.pursuers);
    return { pct: eased, spend: Math.min(100, momentum), chasers: chasers.length,
             // Never lethal. Withdrawing is a decision with a price, not a second way to lose
             // the squad - an operator at 1 HP walks out of it.
             hits: squad.map(c => ({ id: c.id, name: c.name, loss: Math.min(c.hp - 1, Math.floor(c.maxHp * eased)) })) };
}
// A commander does not let you leave, and the sector gate cannot be walked past - advancing off
// the boss tier would secure the sector without fighting for it.
function canWithdraw() {
    return combatActive && currentNodeType !== 'BOSS' &&
        activeEntities.some(e => e.isPlayer && e.hp > 0) && !pendingAction;
}
function disarmWithdraw() { armedExit = null; }
function withdraw() {
    if (!canWithdraw()) return;
    if (armedExit !== 'WITHDRAW') { armedExit = 'WITHDRAW'; renderCommandDeck(); return; }
    armedExit = null;
    const cost = withdrawCost();
    // Whoever is still standing follows. They keep the wounds the squad already put on them.
    const chasers = activeEntities.filter(e => !e.isPlayer && e.hp > 0)
        .sort((a, b) => (b.dmgBase || 0) - (a.dmgBase || 0)).slice(0, WITHDRAW.pursuers)
        .map(e => JSON.parse(JSON.stringify(e)));
    pursuit = chasers.length ? { units: chasers, from: currentNodeType } : null;
    cost.hits.forEach(h => {
        const c = playerRoster.find(p => p.id === h.id);
        if (c && h.loss > 0) { c.hp = Math.max(1, c.hp - h.loss); spawnFCT(c.id, `-${h.loss}`, 'fct-dmg'); }
    });
    momentum = 0; addMomentum(0);
    log(`> The squad breaks contact and runs. The node is left behind.`, 'log-status');
    if (pursuit) log(`> ${pursuit.units.length} of them come after you.`, 'log-dmg');
    playSFX('click'); triggerShake();
    // Running is still the squad leaving together. Whoever was on the floor goes with them.
    recoverDowned('as the squad breaks contact');
    combatActive = false; stopAmbience();
    collectLoot(0, true);
}

// ── Retreating ──────────────────────────────────────────────────────────────────────────
// Withdrawing is a decision to leave the node behind. Retreating is a decision to try it again:
// the squad buys its way out with scrap, does not advance a tier, and walks back into a fight
// rolled fresh. It can fail, which is the whole of the risk - the scrap goes either way, and a
// failed break costs the turn as well.
const RETREAT = { base: 0.80, perFoe: 0.09, floor: 0.30, cost: 45, perDepth: 15 };

// How far into the run the squad is, counted in nodes rather than sectors, so the price of a
// second chance climbs with what a second chance is worth.
function depthIndex() { return (currentSector - 1) * TOTAL_TIERS + (currentTier - 1); }
function retreatCost() { return RETREAT.cost + RETREAT.perDepth * depthIndex(); }
// Breaking away from a crowd is harder than breaking away from one. Nothing else bends it: the
// odds are legible before they are taken, and they are the same odds the panel prints.
function retreatOdds() {
    const foes = activeEntities.filter(e => !e.isPlayer && e.hp > 0).length;
    return Math.max(RETREAT.floor, RETREAT.base - foes * RETREAT.perFoe);
}
// The same gate withdrawing has: a commander does not let you leave, whichever way you try it.
function canRetreat() {
    return combatActive && currentNodeType !== 'BOSS' &&
        activeEntities.some(e => e.isPlayer && e.hp > 0) && !pendingAction &&
        scrap >= retreatCost();
}
function retreat() {
    if (!canRetreat()) return;
    if (armedExit !== 'RETREAT') { armedExit = 'RETREAT'; renderCommandDeck(); return; }
    armedExit = null;
    const paid = retreatCost(), odds = retreatOdds();
    scrap = Math.max(0, scrap - paid);
    if (runStats) runStats.retreats = (runStats.retreats || 0) + 1;
    if (Math.random() < odds) {
        log(`> The squad breaks off and falls back. ${paid} Scrap buys the road out.`, 'log-status');
        playSFX('click');
        combatActive = false; stopAmbience();
        fallBackToNode();
        return;
    }
    // It did not work. The scrap is gone, the turn with it, and the fight is still here.
    if (runStats) runStats.retreatsFailed = (runStats.retreatsFailed || 0) + 1;
    log(`> The break fails. ${paid} Scrap gone and nowhere to go.`, 'log-dmg');
    spawnFCT((turnQueue[activeIndex] || {}).id, 'CUT OFF', 'fct-status');
    playSFX('hit'); triggerShake();
    renderField();
    nextTurn();
}
// Back to the map without advancing: the node is un-cleared, the tier does not move, and the
// squad is put in front of the same node rather than back at the fork before it.
// A break that works is the squad walking away, so it gets whoever was down out too.
function fallBackToNode() {
    recoverDowned('as the squad falls back');
    closeRanks();
    clearedNodeIds = clearedNodeIds.filter(id => id !== currentNodeId);
    retreatNode = currentNodeId;
    activeEntities = []; turnQueue = []; pendingCombat = null;
    momentum = 0; addMomentum(0);
    disarmWithdraw();
    saveGameState();
    renderMap();
}

function stimTarget() {
    // Somebody on the floor is the worst-off there is, and a squad with no medic in the line
    // needs an answer to that which is not "hope". The tactic is it.
    const down = bleedingOut();
    if (down.length) return down.sort((a, b) => (a.downTurns || 0) - (b.downTurns || 0))[0];
    const hurt = activeEntities.filter(e => e.isPlayer && e.hp > 0 &&
        (e.hp < e.maxHp || e.bleedingTurns > 0 || e.stunnedTurns > 0 || e.oiledTurns > 0));
    return hurt.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || null;
}

function tacticCost(t) {
    if (t.id === 'STIM' && traitOnField('STIMS_ON_ME')) return 20;
    return t.cost;
}

function spendTactic(kind) {
    const tactic = MOMENTUM_TACTICS.find(t => t.id === kind);
    if (!tactic || !combatActive || momentum < tacticCost(tactic)) return;
    const actor = turnQueue[activeIndex];
    if (!actor || !actor.isPlayer) return;
    if (kind === 'STIM' && !stimTarget()) return;
    momentum -= tacticCost(tactic); addMomentum(0);
    if (fightLog) fightLog.spent = true;
    if (kind === 'FOCUS') {
        momentumFocus = 1;
        log('> FOCUS: the next attack hits harder.', 'log-combo');
        spawnFCT(actor.id, 'FOCUSED', 'fct-combo'); playSFX('click');
    } else if (kind === 'STIM') {
        const t = stimTarget() || actor;
        t.bleedingTurns = 0; t.stunnedTurns = 0; t.oiledTurns = 0;
        const heal = Math.max(1, Math.floor(t.maxHp * 0.2));
        t.hp = Math.min(t.maxHp, t.hp + heal);
        log(`> STIM: ${t.name} cleansed and patched for ${heal}.`, 'log-heal');
        spawnFCT(t.id, `+${heal}`, 'fct-heal'); playSFX('heal');
    } else if (kind === 'PRESS') {
        pressExtra = true;
        log(`> PRESS: ${actor.name} will act twice.`, 'log-combo');
        spawnFCT(actor.id, 'PRESSING', 'fct-combo'); playSFX('combo');
    }
    renderField();
}

function skipStunnedTurn() { turnQueue[activeIndex].stunnedTurns--; renderField(); setTimeout(nextTurn, 500 * globalSettings.combatSpeed); }
function queueAction(a, variant) { pendingAction = a; if (a === 'OVERDRIVE') pendingOverdrive = variant || null; renderField(); }
function cancelAction() { pendingAction = null; renderField(); }

// A turret that has locked the field down shoots whoever moves next, before their action
// resolves. It is what makes killing it first worth a turn.
function fireOverwatch(actor) {
    if (!actor || !actor.isPlayer || actor.hp <= 0) return;
    const watcher = activeEntities.find(e => !e.isPlayer && e.hp > 0 && (e.overwatch || 0) > 0);
    if (!watcher) return;
    watcher.overwatch--;
    log(`> ${watcher.name} fires on ${actor.name} as they move.`, 'log-dmg');
    playAttackAnim(watcher, actor, null);
    applyDamageHit(watcher, actor, Math.floor(watcher.dmgBase * 0.7 * enemyDmgMult(watcher)), watcher.dmgType || 'phys', 'BASIC');
}

function resolveAction(targetId) {
    fireOverwatch(turnQueue[activeIndex]);
    // The covering shot can drop the operator who was about to act; their turn ends with them.
    if (!combatActive || !turnQueue[activeIndex] || turnQueue[activeIndex].hp <= 0) { pendingAction = null; checkWinState(); return; }
    let actEnt = turnQueue[activeIndex]; let target = activeEntities.find(e => e.id === targetId);
    let livingEnemies = activeEntities.filter(e => !e.isPlayer && e.hp > 0 && !e.burrowed);
    let dist = livingEnemies.findIndex(e => e.id === targetId);

    if (pendingAction === 'OVERDRIVE') {
        odKills = 0;
        const cls = actEnt.classType;
        const pair = OVERDRIVES[cls] || [];
        const variant = pair.find(o => o.id === pendingOverdrive) || overdriveFor(cls);
        // First use is the choice: the class fights the rest of the run with this one.
        if (!odChoices[cls] && pair.some(o => o.id === variant.id)) odChoices[cls] = variant.id;
        pendingOverdrive = null;
        momentum = 0; addMomentum(0); playSFX('overdrive'); triggerGlitch();
        log(`> ${actEnt.name} unleashed ${variant.name}!`, "log-combo");
        const all = fn => { triggerShake(); livingEnemies.forEach(fn); };

        if (variant.id === 'EARTHSHAKER') {
            all(e => { applyDamageHit(actEnt, e, actEnt.dmgBase * 1.5, 'phys', null); e.stunnedTurns = 1; spawnFCT(e.id, "STUNNED", "fct-status"); });
        } else if (variant.id === 'SIEGEBREAKER') {
            target.armor = 0; target.armorTurns = 0; target.corrodedTurns = 3;
            applyDamageHit(actEnt, target, actEnt.dmgBase * 3.2, 'phys', null);
        } else if (variant.id === 'FIELD_REVIVE') {
            target.hp = Math.max(target.hp, Math.floor(target.maxHp * 0.5)); target.stunnedTurns = 0; target.bleedingTurns = 0;
            spawnFCT(target.id, "REVIVED", "fct-heal"); playSFX('heal');
        } else if (variant.id === 'TRIAGE_PROTOCOL') {
            activeEntities.filter(e => e.isPlayer && e.hp > 0).forEach(a => {
                a.hp = Math.min(a.maxHp, a.hp + Math.floor(a.maxHp * 0.35));
                a.bleedingTurns = 0; a.stunnedTurns = 0; a.oiledTurns = 0;
                spawnFCT(a.id, "TRIAGED", "fct-heal");
            });
            playSFX('heal');
        } else if (variant.id === 'SCRAP_STORM') {
            all(e => { applyDamageHit(actEnt, e, actEnt.dmgBase * 1.2, 'energy', null); });
        } else if (variant.id === 'BOOBY_TRAP') {
            all(e => { applyDamageHit(actEnt, e, actEnt.dmgBase * 0.6, 'energy', null); e.corrodedTurns = 3; e.oiledTurns = 3; spawnFCT(e.id, "RIGGED", "fct-weak"); });
        } else if (variant.id === 'HELLFIRE') {
            all(e => { applyDamageHit(actEnt, e, actEnt.dmgBase * 2.0, 'energy', null); e.oiledTurns = 3; e.bleedingTurns = 3; });
        } else if (variant.id === 'BACKBURNER') {
            applyDamageHit(actEnt, target, actEnt.dmgBase * 3.2, 'energy', null);
            if (target.hp > 0) { target.bleedingTurns = Math.max(target.bleedingTurns, 3); spawnFCT(target.id, "BURNING", "fct-weak"); }
        } else if (variant.id === 'BREACH_CHARGE') {
            target.armor = 0; target.armorTurns = 0; applyDamageHit(actEnt, target, actEnt.dmgBase * 3.0, 'phys', null);
        } else if (variant.id === 'SCATTERSTORM') {
            all(e => { applyDamageHit(actEnt, e, actEnt.dmgBase * 1.4, 'phys', null); });
            const front = livingEnemies.find(e => e.hp > 0);
            if (front) { front.stunnedTurns = 1; spawnFCT(front.id, "STUNNED", "fct-status"); }
        } else if (variant.id === 'HEADSHOT') {
            let d = target.classType === 'BOSS' ? actEnt.dmgBase * 4.0 : target.maxHp; applyDamageHit(actEnt, target, d, 'phys', null);
        } else if (variant.id === 'OVERWATCH') {
            all(e => { applyDamageHit(actEnt, e, actEnt.dmgBase * 1.2, 'phys', null); if (e.hp > 0) { e.markedTurns = 3; spawnFCT(e.id, "MARKED", "fct-status"); } });
        } else if (variant.id === 'APEX_PREDATOR') {
            actEnt.hp = actEnt.maxHp; applyDamageHit(actEnt, target, actEnt.dmgBase * 2.5, 'bio', null); target.bleedingTurns = 3;
        } else if (variant.id === 'BLOOD_SCENT') {
            all(e => { applyDamageHit(actEnt, e, actEnt.dmgBase * 1.5, 'bio', null); if (e.hp > 0) e.bleedingTurns = Math.max(e.bleedingTurns, 3); });
        } else if (variant.id === 'MEATGRINDER') {
            all(e => { applyDamageHit(actEnt, e, actEnt.dmgBase * 1.6, 'phys', null); if (e.hp > 0) { e.bleedingTurns = Math.max(e.bleedingTurns, 3); spawnFCT(e.id, "BLEED", "fct-status"); } });
        } else if (variant.id === 'LAST_CHARGE') {
            applyDamageHit(actEnt, target, actEnt.dmgBase * 3.4, 'phys', null);
            const paid = Math.max(1, Math.floor(actEnt.maxHp * 0.2));
            actEnt.hp = Math.max(1, actEnt.hp - paid);
            log(`> The charge costs ${actEnt.name} ${paid} HP.`, "log-dmg"); spawnFCT(actEnt.id, `-${paid}`, "fct-dmg");
        } else if (variant.id === 'FULL_PURGE') {
            all(e => { applyDamageHit(actEnt, e, actEnt.dmgBase * 1.5, 'bio', null); if (e.hp > 0) { e.corrodedTurns = 3; spawnFCT(e.id, "CORRODED", "fct-weak"); } });
        } else if (variant.id === 'CLEAN_ROOM') {
            activeEntities.filter(e => e.isPlayer && e.hp > 0).forEach(a => {
                a.hp = Math.min(a.maxHp, a.hp + Math.floor(a.maxHp * 0.45));
                a.bleedingTurns = 0; a.stunnedTurns = 0; a.oiledTurns = 0; a.corrodedTurns = 0;
                spawnFCT(a.id, "SCRUBBED", "fct-heal");
            });
            all(e => { if (e.hp > 0) { e.corrodedTurns = 3; spawnFCT(e.id, "CORRODED", "fct-weak"); } });
            playSFX('heal');
        } else if (variant.id === 'FULL_HAUL') {
            // Hauled from the back forward, so the order they arrive in is the order they stood.
            [...livingEnemies].reverse().forEach(e => haulForward(e));
            all(e => { applyDamageHit(actEnt, e, actEnt.dmgBase * 1.3, 'phys', null); if (e.hp > 0) spawnFCT(e.id, "HAULED", "fct-status"); });
        } else if (variant.id === 'IRON_BARB') {
            haulForward(target);
            applyDamageHit(actEnt, target, actEnt.dmgBase * 3.5, 'phys', null);
            if (target.hp > 0) { target.bleedingTurns = Math.max(target.bleedingTurns, 3); spawnFCT(target.id, "BLEED", "fct-status"); }
        }
        // The Overclocked Reactor's teeth: every overdrive vents through whoever holds the front.
        if (hasRelic('OVERCLOCKED_REACTOR')) {
            const frontman = activeEntities.filter(e => e.isPlayer && e.hp > 0).sort((a, b) => a.gridPos - b.gridPos)[0];
            if (frontman) {
                frontman.hp = Math.max(1, frontman.hp - 10);
                spawnFCT(frontman.id, "-10", "fct-dmg");
                log(`> The reactor vents through ${frontman.name}. -10 HP.`, "log-dmg");
            }
        }
        // Everything the overdrive killed is counted before the fight is allowed to end, so a
        // sweep that wins the node still books the kills it made on the way.
        if (odKills >= OVERKILL_AT) checkBountyProgress('OVERKILL');
        odKills = null;
        pendingAction = null; checkWinState(); return;
    }

    if (pendingAction === 'REPOSITION') {
        if (!target || !target.isPlayer || target.id === actEnt.id || target.hp <= 0) { pendingAction = null; renderField(); return; }

        const mine = actEnt.gridPos; actEnt.gridPos = target.gridPos; target.gridPos = mine;
        const order = (a, b) => (a.isPlayer && b.isPlayer) ? a.gridPos - b.gridPos : 0;
        activeEntities = [...activeEntities.filter(e => e.isPlayer).sort(order), ...activeEntities.filter(e => !e.isPlayer)];
        log(`> ${actEnt.name} and ${target.name} swap positions.`, "log-status");
        spawnFCT(actEnt.id, "MOVED", "fct-status"); playSFX('heal');
        pendingAction = null; checkWinState(); return;
    }

    if (pendingAction === 'CAUTERIZE') {
        let heal = 20 + Math.floor(Math.random() * 10) + (hasMod(actEnt, 'FIELD_KIT') ? 15 : 0);
        target.hp = Math.min(target.maxHp, target.hp + heal); actEnt.cooldowns.cauterize = cdFor(actEnt, 'cauterize', 3);
        if (hasTrait(actEnt, 'FIELD_SURGEON')) { target.bleedingTurns = 0; target.stunnedTurns = 0; target.oiledTurns = 0; spawnFCT(target.id, "CLEANSED", "fct-status"); }
        log(`> ${actEnt.name} heals ${target.name} for ${heal}.`, "log-heal"); spawnFCT(target.id, `+${heal}`, "fct-heal"); playSFX('heal');
    } else if (pendingAction === 'STIM_DART') {
        // The mastered medic's fourth verb: a patch fired across the field, and the jolt
        // shakes a stun loose.
        const heal = 12;
        target.hp = Math.min(target.maxHp, target.hp + heal); target.stunnedTurns = 0;
        actEnt.cooldowns.stim_dart = cdFor(actEnt, 'stim_dart', 2);
        log(`> ${actEnt.name} darts ${target.name} for ${heal}.`, "log-heal"); spawnFCT(target.id, `+${heal}`, "fct-heal"); playSFX('heal');
    } else {
        let atkType = 'phys'; if(['RAD_SHOT', 'FERAL_BITE', 'RIP_AND_TEAR', 'SPRAY_GUN', 'CAUSTIC_BURST', 'TANK_RUPTURE'].includes(pendingAction)) atkType = 'bio'; if(['FLASHBANG', 'MOLOTOV', 'FLARE_GUN', 'ACID_FLASK', 'THERMITE', 'HEAT_WAVE'].includes(pendingAction)) atkType = 'energy';
        let tuneUpBonus = tuneUpBattles > 0 ? 4 : 0;
        let baseDmg = actEnt.dmgBase + tuneUpBonus + Math.floor(Math.random() * 6); 
        let dmgMult = 1.0; let isCombo = false; let comboType = '';
        // The breakdown is recorded as the real chain runs rather than worked out again
        // afterwards, so what the player is shown cannot disagree with what happened.
        hitTrace = []; let traceMark = 1;
        const snap = label => { const f = dmgMult / traceMark;
            if (Math.abs(f - 1) > 0.005) hitTrace.push({ label, f }); traceMark = dmgMult; };

        // Each ability's own profile first - flat rates and positional swings both settle here.
        if (pendingAction === 'FLASHBANG') { dmgMult = 0.4; actEnt.cooldowns.flashbang = hasTrait(actEnt, 'QUICK_HANDS') ? 3 : 4; }
        if (pendingAction === 'HEAVY_WRENCH') { dmgMult = 1.5; actEnt.cooldowns.heavy_wrench = cdFor(actEnt, 'heavy_wrench', 3); }
        if (pendingAction === 'FERAL_BITE') { dmgMult = 1.2; actEnt.cooldowns.feral_bite = 3; }
        if (pendingAction === 'DEADEYE') { if (dist === livingEnemies.length - 1 && dist !== 0) dmgMult = hasTrait(actEnt, 'PATIENT_HUNTER') ? 2.1 : 1.8; else dmgMult = hasMod(actEnt, 'LONG_BARREL') ? 1.0 : 0.8; actEnt.cooldowns.deadeye = 2; }
        if (pendingAction === 'BUCKSHOT') { dmgMult *= (dist === 0 ? (hasTrait(actEnt, 'POINT_BLANK') ? 1.8 : 1.5) : 0.8); actEnt.cooldowns.buckshot = 2; }
        if (pendingAction === 'ACID_FLASK') { dmgMult = 0.5; actEnt.cooldowns.acid_flask = 3; }
        if (pendingAction === 'THERMITE') { dmgMult *= 1.6; actEnt.cooldowns.thermite = hasTrait(actEnt, 'CONTROLLED_BURN') ? 3 : 4; }
        if (pendingAction === 'EXECUTE_SHOT') { dmgMult *= 1.4; actEnt.cooldowns.execute_shot = 3; }
        if (pendingAction === 'SPOTTERS_MARK') { dmgMult = 0.4; actEnt.cooldowns.spotters_mark = cdFor(actEnt, 'spotters_mark', 3); }
        if (pendingAction === 'RIP_AND_TEAR') { dmgMult *= 1.2; actEnt.cooldowns.rip_and_tear = cdFor(actEnt, 'rip_and_tear', 3); }
        // The mastered fourth verbs, priced like the classics.
        if (pendingAction === 'SHIELD_SLAM') { dmgMult *= 0.85; actEnt.cooldowns.shield_slam = cdFor(actEnt, 'shield_slam', 2); }
        if (pendingAction === 'SHIV') { dmgMult *= 0.9; actEnt.cooldowns.shiv = cdFor(actEnt, 'shiv', 2); }
        if (pendingAction === 'HEAT_WAVE') { dmgMult *= 0.7; actEnt.cooldowns.heat_wave = cdFor(actEnt, 'heat_wave', 3); }
        if (pendingAction === 'RIOT_BUTT') { dmgMult *= 0.85; actEnt.cooldowns.riot_butt = cdFor(actEnt, 'riot_butt', 2); }
        if (pendingAction === 'PIERCING_VOLLEY') { dmgMult *= 0.75; actEnt.cooldowns.piercing_volley = cdFor(actEnt, 'piercing_volley', 3); }
        if (pendingAction === 'HARRY') { dmgMult *= 0.6; actEnt.cooldowns.harry = cdFor(actEnt, 'harry', 2); }
        // The three found on the road.
        if (pendingAction === 'RIPSAW') { dmgMult *= 1.5; actEnt.cooldowns.ripsaw = cdFor(actEnt, 'ripsaw', 3); }
        if (pendingAction === 'CAUSTIC_BURST') { dmgMult *= 0.6; actEnt.cooldowns.caustic_burst = cdFor(actEnt, 'caustic_burst', 3); }
        // Hauling something out of the back line is most of the point; the hit is the smaller half.
        if (pendingAction === 'DRAG_LINE') { dmgMult *= 0.8; actEnt.cooldowns.drag_line = cdFor(actEnt, 'drag_line', 3); }
        if (pendingAction === 'BARBED_SHOT') { dmgMult *= 1.35; actEnt.cooldowns.barbed_shot = cdFor(actEnt, 'barbed_shot', 3); }
        if (pendingAction === 'TRENCH_SWEEP') { dmgMult *= 0.7; actEnt.cooldowns.trench_sweep = cdFor(actEnt, 'trench_sweep', 3); }
        if (pendingAction === 'TANK_RUPTURE') { dmgMult *= 1.8; actEnt.cooldowns.tank_rupture = cdFor(actEnt, 'tank_rupture', 4); }
        if (pendingAction === 'WHALE_LINE') { dmgMult *= 0.75; actEnt.cooldowns.whale_line = cdFor(actEnt, 'whale_line', 3); }
        if (pendingAction === 'HARPOON' && hasMod(actEnt, 'TOGGLE_HEAD') && (target.bleedingTurns || 0) > 0) { dmgMult *= 1.3; }
        if (pendingAction === 'SNAP' && hasMod(actEnt, 'BLOOD_TRACKER') && (target.bleedingTurns || 0) > 0) { dmgMult *= 1.3; }
        // The Bayonet turns the rifle into a spear: front-rank bonus in, reach penalties honest.
        if (pendingAction === 'PIPE_RIFLE' && hasMod(actEnt, 'BAYONET') && actEnt.gridPos === 1) { dmgMult *= 1.25; }

        snap('ability');
        if (momentumFocus > 0) { dmgMult *= 1.3; momentumFocus = 0; spawnFCT(actEnt.id, 'FOCUSED', 'fct-combo'); }
        snap('focus');
        dmgMult *= quirkDmgMult(actEnt, target, dist);
        dmgMult *= bondDmgMult(actEnt);
        if (hasTrait(actEnt, 'GRUDGE') && actEnt.hp < actEnt.maxHp / 2) dmgMult *= 1.15;
        if (hasTrait(actEnt, 'CALLED_SHOT') && (target.markedTurns || 0) > 0) dmgMult *= 1.25;
        if (hasTrait(actEnt, 'SHRAPNEL_LOAD') && pendingAction === 'PIPE_RIFLE' && target.armor > 0) dmgMult *= 1.2;
        if (hasTrait(actEnt, 'GO_FOR_THE_THROAT') && pendingAction === 'FERAL_BITE' && (target.bleedingTurns || 0) > 0) dmgMult *= 1.3;
        if (hasTrait(actEnt, 'IRONSIGHTS') && pendingAction === 'SLUG_SHOT') dmgMult *= 1.2;
        if (hasTrait(actEnt, 'TRENCH_FOOT') && actEnt.gridPos === 1) dmgMult *= 1.2;
        if (hasTrait(actEnt, 'CATALYST') && (target.corrodedTurns || 0) > 0) dmgMult *= 1.25;
        if (hasTrait(actEnt, 'SLACK_LINE') && dist === 0) dmgMult *= 1.25;
        snap('perks, quirks & bonds');
        // Over The Top, still burning. Its own layer in the breakdown, because the whole point
        // is that you can see it and time the turns you spend under it.
        if ((actEnt.chargeTurns || 0) > 0) dmgMult *= CHARGE_MULT;
        snap('over the top');
        if (hasTrait(actEnt, 'PYROPHILIA')) {
            const oiled = Math.min(3, livingEnemies.filter(e => (e.oiledTurns || 0) > 0).length);
            dmgMult *= 1 + oiled * 0.1;
        }
        // Where the two of them are standing, and what they are standing on. This used to keep
        // its own copy of the rank arithmetic; it reads the same one the deck and the forecast
        // do, so ground cannot apply to the button's estimate and not to the swing.
        const effReach = moveReachFor(pendingAction, actEnt);
        const reach = effReach === 'melee'
            ? groundReach((REACH_PENALTY[actEnt.gridPos] || 1) * (dist >= FRONT_RANKS ? DEPTH_PENALTY : 1))
            : 1;
        if (reach !== 1) { dmgMult *= reach; if (reach < 1) log(`> ${actEnt.name} is reaching (${Math.round(reach * 100)}% DMG).`, "log-status"); }
        snap('reach');

        // The combo multiplies whatever the ability was already worth. It has to come after every
        // profile above: an ability that assigns dmgMult outright would otherwise throw the bonus
        // away, spending the player's setup for nothing while the prompt still promised a payoff.
        const combo = comboFor(pendingAction, target);
        if (combo) {
            dmgMult *= combo.mult;
            if (combo.consumes === 'markedTurns' && (target.markedTurns || 0) > 0 && traitOnField('SPOTTER_NETWORK')) addMomentum(5);
            if (combo.consumes) target[combo.consumes] = 0;
            isCombo = true; comboType = `${combo.name}!`;
        } else if ((target.markedTurns || 0) > 0 && DAMAGING_MOVES.includes(pendingAction)) {
            dmgMult *= MARK_BONUS; target.markedTurns = 0;
            if (traitOnField('SPOTTER_NETWORK')) addMomentum(5);
            isCombo = true; comboType = 'MARKED!';
        }

        snap('combo');
        if (hasRelic('THERMAL_CORE') && atkType === 'energy') { dmgMult *= relicSetActive('Reactor Rig') ? 1.5 : 1.3; }
        if (hasRelic('WHETSTONE') && isMelee(pendingAction)) { dmgMult *= relicSetActive('Full Arsenal') ? 1.3 : 1.2; }
        if (hasRelic('RANGEFINDER') && isRanged(pendingAction)) { dmgMult *= relicSetActive('Full Arsenal') ? 1.25 : 1.15; }
        if (hasRelic('VULTURES_INSTINCT') && isCombo) { dmgMult *= 1.25; }
        if (hasRelic('GLASS_CANNON_CORE')) { dmgMult *= 1.4; }
        // Rotor Lift: a hovering drone is a ranged problem. Swinging at it is most of a wasted turn.
        if (hasSig(target, 'ROTOR_LIFT') && moveReachFor(pendingAction, actEnt) === 'melee') dmgMult *= 0.4;
        if (hasRelic('HUNGRY_BLADE') && !isMelee(pendingAction)) { dmgMult *= 0.85; }

        // A sandstorm blinds anything fired across the field. This used to be a second hand-kept
        // list that had drifted - a thrown molotov was somehow unaffected - and now reads the
        // same reach the formation rules use.
        snap('relics & curses');
        if (currentWeather === 'SANDSTORM' && moveReachFor(pendingAction, actEnt) === 'ranged') { dmgMult *= 0.75; }
        if (currentWeather === 'BLOODLUST') { dmgMult *= 1.2; }

        snap('weather');
        // The melee half of the ground was already folded into reach above; this is the rest.
        if (moveReachFor(pendingAction, actEnt) === 'ranged') dmgMult *= (ground().ranged || 1);
        if (isAoe(pendingAction)) dmgMult *= (ground().aoe || 1);
        snap('ground');
        playSFX(voiceFor(pendingAction));
        playAttackAnim(actEnt, target, pendingAction);
        if (isCombo) {
            log(`> COMBO ACTIVATED: ${comboType}`, "log-combo"); playSFX('combo'); 
            if (hasQuirk(actEnt, 'OVERCHARGED')) addMomentum(10);
            setTimeout(() => spawnFCT(target.id, comboType, "fct-combo"), 200); 
            checkBountyProgress('COMBO'); addMomentum(25); triggerShake();
        }

        if (effReach === 'melee' && reach >= 1) checkBountyProgress('REACH');
        comboKill = isCombo;
        applyDamageHit(actEnt, target, Math.floor(baseDmg * dmgMult), atkType, pendingAction);
        comboKill = false;

        if (actEnt.quirk && actEnt.quirk.id === 'VAMPIRIC' && actEnt.hp < actEnt.maxHp) {
             actEnt.hp = Math.min(actEnt.maxHp, actEnt.hp + 2);
             spawnFCT(actEnt.id, "+2", "fct-heal");
        }

        if (hasRelic('BLOOD_VIAL') && atkType === 'bio' && actEnt.hp < actEnt.maxHp) {
            const fed = relicSetActive('Field Surgery') ? 10 : 5;
            actEnt.hp = Math.min(actEnt.maxHp, actEnt.hp + fed);
            spawnFCT(actEnt.id, `+${fed}`, "fct-heal");
        }
        if (hasRelic('HUNGRY_BLADE') && isMelee(pendingAction) && actEnt.isPlayer && actEnt.hp < actEnt.maxHp) {
            actEnt.hp = Math.min(actEnt.maxHp, actEnt.hp + 6);
            spawnFCT(actEnt.id, "+6", "fct-heal");
        }

        if (pendingAction === 'FLARE_GUN') {
            target.oiledTurns = (hasMod(actEnt, 'PRESSURE_TANK') ? 4 : 3) + (hasTrait(actEnt, 'LINGERING_BURN') ? 1 : 0);
            log(`> ${target.name} is coated in oil!`, "log-dmg"); setTimeout(() => spawnFCT(target.id, "OILED", "fct-weak"), 400);
            if (hasMod(actEnt, 'PRESSURE_TANK')) {
                const splash = livingEnemies.find(e => e.id !== targetId && e.hp > 0);
                if (splash) { splash.oiledTurns = Math.max(splash.oiledTurns, 2); setTimeout(() => spawnFCT(splash.id, "OILED", "fct-weak"), 500); }
            }
        }
        if (pendingAction === 'SLUG_SHOT' && hasMod(actEnt, 'INCENDIARY_SLUGS') && target.hp > 0) { target.oiledTurns = Math.max(target.oiledTurns, 2); setTimeout(() => spawnFCT(target.id, "OILED", "fct-weak"), 400); }
        if (pendingAction === 'SCRAP_BLADE' && hasMod(actEnt, 'JAGGED_EDGE') && target.hp > 0) { target.bleedingTurns = Math.max(target.bleedingTurns, 2); setTimeout(() => spawnFCT(target.id, "BLEED", "fct-status"), 400); }
        if (pendingAction === 'ACID_FLASK') { target.corrodedTurns = 3; log(`> ${target.name}'s plating is corroding!`, "log-dmg"); setTimeout(() => spawnFCT(target.id, "CORRODED", "fct-weak"), 400); }
        if (pendingAction === 'SPOTTERS_MARK') { target.markedTurns = hasMod(actEnt, 'SPOTTING_SCOPE') ? 4 : 3; log(`> ${target.name} is marked.`, "log-status"); setTimeout(() => spawnFCT(target.id, "MARKED", "fct-status"), 400); }
        if (pendingAction === 'RIP_AND_TEAR' && target.hp > 0) { target.bleedingTurns = Math.max(target.bleedingTurns, 3); setTimeout(() => spawnFCT(target.id, "BLEED", "fct-status"), 400); }
        if (pendingAction === 'MOLOTOV') {
            actEnt.cooldowns.molotov = 3; triggerShake();
            if (hasMod(actEnt, 'NAPALM_MIX') && target.hp > 0) { target.oiledTurns = Math.max(target.oiledTurns, 3); setTimeout(() => spawnFCT(target.id, "OILED", "fct-weak"), 450); }
            let secondaries = livingEnemies.filter(e => e.id !== targetId);
            if (secondaries.length > 0) { let sTarg = secondaries[Math.floor(Math.random() * secondaries.length)]; applyDamageHit(actEnt, sTarg, Math.floor(baseDmg * (hasTrait(actEnt, 'BACKDRAFT') ? 1.0 : 0.7)), atkType, null); }
        }
        if (pendingAction === 'HEAVY_WRENCH' && hasTrait(actEnt, 'AFTERSHOCK')) {
            const behind = livingEnemies[dist + 1];
            if (behind && behind.hp > 0) applyDamageHit(actEnt, behind, Math.floor(baseDmg * 0.4), atkType, null);
        }
        if (pendingAction === 'ACID_FLASK' && hasTrait(actEnt, 'ACID_RAIN')) {
            const next = livingEnemies[dist + 1] || livingEnemies[dist - 1];
            if (next && next.hp > 0) { next.corrodedTurns = Math.max(next.corrodedTurns, 2); setTimeout(() => spawnFCT(next.id, "CORRODED", "fct-weak"), 450); }
        }
        // The refund perks: a kill hands the trigger back.
        if (pendingAction === 'EXECUTE_SHOT' && hasTrait(actEnt, 'DOUBLE_TAP') && target.hp <= 0) actEnt.cooldowns.execute_shot = 0;
        if (pendingAction === 'FERAL_BITE' && hasTrait(actEnt, 'RELENTLESS') && target.hp <= 0) actEnt.cooldowns.feral_bite = 0;
        if (hasTrait(actEnt, 'LEAD_THE_PACK') && DAMAGING_MOVES.includes(pendingAction)) addMomentum(5);
        if (pendingAction === 'PISTOL' && hasTrait(actEnt, 'COMBAT_MEDIC')) {
            const worst = activeEntities.filter(e => e.isPlayer && e.hp > 0 && e.id !== actEnt.id && e.hp < e.maxHp)
                .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
            if (worst) { worst.hp = Math.min(worst.maxHp, worst.hp + 5); spawnFCT(worst.id, "+5", "fct-heal"); }
        }
        if (pendingAction === 'BUCKSHOT' && hasMod(actEnt, 'DRUM_CHOKE')) {
            const behind = livingEnemies[dist + 1];
            if (behind && behind.hp > 0) applyDamageHit(actEnt, behind, Math.floor(baseDmg * 0.6), atkType, null);
        }
        // The mastered verbs' second halves: the wave and the volley carry through, the
        // harry bites twice, and the slam leaves the Bruiser plated behind it.
        if (isAoe(pendingAction)) {
            const behind = livingEnemies[dist + 1];
            if (behind && behind.hp > 0) applyDamageHit(actEnt, behind, Math.floor(baseDmg * dmgMult * (pendingAction === 'HEAT_WAVE' ? 0.9 : 0.6)), atkType, null);
        }
        if (pendingAction === 'HARRY' && target.hp > 0) {
            applyDamageHit(actEnt, target, Math.floor(baseDmg * dmgMult), atkType, null);
        }
        if (pendingAction === 'SHIELD_SLAM') {
            actEnt.armor += 8; actEnt.armorTurns = Math.max(actEnt.armorTurns || 0, 2);
            spawnFCT(actEnt.id, "+ARMOR", "fct-heal");
        }

        // ── the three found on the road ──────────────────────────────────────────────
        if (pendingAction === 'RIPSAW' && target.hp > 0) {
            target.bleedingTurns = Math.max(target.bleedingTurns, hasTrait(actEnt, 'SAWBONES') ? 5 : 3);
            setTimeout(() => spawnFCT(target.id, "BLEED", "fct-status"), 400);
        }
        if (pendingAction === 'BAYONET_THRUST' && hasMod(actEnt, 'SERRATED_EDGE') && target.hp > 0) {
            target.bleedingTurns = Math.max(target.bleedingTurns, 2);
            setTimeout(() => spawnFCT(target.id, "BLEED", "fct-status"), 400);
        }
        if (pendingAction === 'BARBED_SHOT' && target.hp > 0) {
            target.bleedingTurns = Math.max(target.bleedingTurns, hasTrait(actEnt, 'DEEP_HOOK') ? 5 : 3);
            setTimeout(() => spawnFCT(target.id, "BLEED", "fct-status"), 400);
        }
        if (pendingAction === 'SPRAY_GUN' && hasMod(actEnt, 'HIGH_PRESSURE') && target.hp > 0) {
            target.corrodedTurns = Math.max(target.corrodedTurns, 2);
            setTimeout(() => spawnFCT(target.id, "CORRODED", "fct-weak"), 400);
        }
        if (pendingAction === 'CAUSTIC_BURST') {
            // The cloud eats plate on everything it touches, the second and third body included.
            const caught = [target, livingEnemies[dist + 1], hasTrait(actEnt, 'WIDE_NOZZLE') ? livingEnemies[dist + 2] : null];
            caught.forEach(e => { if (e && e.hp > 0) { e.corrodedTurns = Math.max(e.corrodedTurns, 3); setTimeout(() => spawnFCT(e.id, "CORRODED", "fct-weak"), 450); } });
            const third = hasTrait(actEnt, 'WIDE_NOZZLE') ? livingEnemies[dist + 2] : null;
            if (third && third.hp > 0) applyDamageHit(actEnt, third, Math.floor(baseDmg * dmgMult * 0.6), atkType, null);
        }
        if (pendingAction === 'TANK_RUPTURE') {
            const vent = Math.max(1, Math.floor(actEnt.maxHp * 0.10));
            actEnt.hp = Math.max(1, actEnt.hp - vent);
            log(`> The tank vents through ${actEnt.name}. -${vent} HP.`, "log-dmg");
            spawnFCT(actEnt.id, `-${vent}`, "fct-dmg");
        }
        if (pendingAction === 'DRAG_LINE') {
            const behind = hasTrait(actEnt, 'WINCH_ARM') ? livingEnemies[dist + 1] : null;
            if (target.hp > 0 && haulForward(target)) {
                log(`> ${actEnt.name} hauls ${target.name} to the front of the line.`, "log-status");
                spawnFCT(target.id, "HAULED", "fct-status");
            }
            if (behind && behind.hp > 0 && haulForward(behind)) spawnFCT(behind.id, "HAULED", "fct-status");
            if (hasTrait(actEnt, 'HAND_OVER_HAND') && target.hp <= 0) actEnt.cooldowns.drag_line = 0;
        }
    }
    pendingAction = null; checkWinState();
}

// What a blow is actually worth once the victim's plating, resistances, relics and quirks
// have had their say. Lifted out of applyDamageHit so the aiming preview runs the same
// arithmetic the real hit does - a preview that recomputes is a preview that drifts.
function mitigate(attacker, t, calcDmg, atkType, abilityStr) {

    let rv = t.resistances[atkType] || 0;
    // Corrosion eats plating outright - the counter to a unit that re-plates itself each turn.
    let ac = (abilityStr === 'FERAL_BITE' || (t.corrodedTurns || 0) > 0) ? 0 : t.armor;
    if (t.oiledTurns > 0 && atkType === 'energy') rv -= 15;
    let cd = calcDmg;
    if (hasRelic('KINETIC_MESH') && t.isPlayer && t.gridPos === 1 && atkType === 'phys') cd = Math.floor(cd * 0.75);
    if (hasRelic('LEAD_LINED_COAT') && t.isPlayer) cd = Math.floor(cd * 0.8);
    if (hasRelic('CHEM_ETCHER') && !t.isPlayer && (t.corrodedTurns || 0) > 0) cd = Math.floor(cd * 1.25);
    if (hasQuirk(t, 'THICK_HIDE')) cd = Math.max(1, cd - 3);
    // Ruins are cover for whoever is standing in them, and the front rank is where the cover is.
    if (t.gridPos === 1 && ground().frontCover) cd = Math.max(1, Math.floor(cd * ground().frontCover));
    // Every dose the Vatborn takes is another split seam: it hits harder and it takes more.
    if (t.venomStacks > 0) cd = Math.floor(cd * (1 + (t.venom ? t.venom.taken : 0.12) * t.venomStacks));
    // Teeming: a Carrion is only hard to kill while the rest of the pile is standing. Picking
    // them off one at a time is the slow way through; anything that thins several at once
    // breaks the whole swarm open at the same moment.
    if (hasSig(t, 'TEEMING') && carrionStanding() >= TEEMING_FLOOR) cd = Math.max(1, Math.floor(cd * 0.45));
    // Riot Plate: bolted armour soaks half of everything until the plate itself is spent.
    if (hasSig(t, 'RIOT_PLATE') && (t.plate || 0) > 0) cd = Math.max(1, Math.floor(cd * 0.5));
    // A ward holds until its generator falls; a lieutenant's cover is worth heavy plate.
    if (t.wardId && activeEntities.some(e => e.id === t.wardId && e.hp > 0)) cd = Math.max(1, Math.floor(cd * (t.wardSoak || 0.15)));
    if (t.escortId && activeEntities.some(e => e.id === t.escortId && e.hp > 0)) ac += (t.escortArmor || 20);
    if ((abilityStr === 'SLUG_SHOT' && hasTrait(attacker, 'BREACHING_ROUNDS')) ||
        (abilityStr === 'QUICK_SHOT' && hasTrait(attacker, 'PIERCING_ROUNDS'))) ac = 0;
    let n = Math.max(1, cd - rv - ac); if (rv >= 100) n = 0;
    return { n, rv };
}

function applyDamageHit(attacker, target, calcDmg, atkType, abilityStr) {
    if (target.hp <= 0) return;
    // Mitigation is figured per victim, so a bond partner who steps in takes the blow through
    // their own armor and resists rather than the original target's.
    const figure = t => mitigate(attacker, t, calcDmg, atkType, abilityStr);
    let { n: netDmg, rv: resistValue } = figure(target);
    // File the whole story of this number: what it started as, what bent it, what soaked it.
    const filed = { attacker: attacker.name, target: target.name, raw: calcDmg,
                    trace: (hitTrace || []).slice(), atkType, abilityStr };
    hitTrace = null;
    // Bond II: once per pair per fight, a killing blow lands on the partner instead.
    if (netDmg >= target.hp && target.isPlayer) {
        const savior = bondSavior(target);
        if (savior) {
            bondSavesUsed.add(bondKey(target.id, savior.id));
            if (runStats) runStats.bondSaves = (runStats.bondSaves || 0) + 1;
            log(`> ${savior.name} steps in front of the blow meant for ${target.name}!`, 'log-status');
            spawnFCT(savior.id, 'STEPS IN', 'fct-status');
            target = savior;
            ({ n: netDmg, rv: resistValue } = figure(target));
        }
    }
    // Riot Plate drains by what it soaked; breaking it is a moment worth announcing, and it is
    // why a single heavy hit beats chip damage against a Juggernaut.
    if (hasSig(target, 'RIOT_PLATE') && (target.plate || 0) > 0 && netDmg > 0) {
        target.plate -= netDmg;
        if (target.plate <= 0) {
            target.plate = 0;
            log(`> ${target.name}'s riot plate buckles!`, 'log-combo');
            spawnFCT(target.id, 'PLATE BROKEN', 'fct-weak');
        }
    }
    target.hp = Math.max(0, target.hp - netDmg);
    if (target.isPlayer && netDmg > 0 && fightLog) fightLog.hurt = true;
    if (netDmg > 0) flashClass(target.id, target.isPlayer ? 'anim-recoil-left' : 'anim-recoil-right', 320);
    // The first time a fight is genuinely going badly is the only moment worth telling someone
    // they are allowed to leave one.
    if (target.isPlayer && target.hp > 0 && target.hp < target.maxHp * 0.35 && canWithdraw()) firePrompt('WITHDRAW');
    // Gas Bloom: a chem fiend is as dangerous dead as alive.
    if (target.hp <= 0 && hasSig(target, 'GAS_BLOOM') && !target.bloomed) {
        target.bloomed = true;
        activeEntities.filter(p => p.isPlayer && p.hp > 0).forEach(p => {
            p.corrodedTurns = Math.max(p.corrodedTurns || 0, 2);
            spawnFCT(p.id, 'CORRODED', 'fct-status');
        });
        log(`> ${target.name} bursts. The squad is choking on the cloud.`, 'log-dmg');
        playSFX('blast');
    }
    if (target.hp <= 0 && hasSig(target, 'MARTYR') && !target.martyred) {
        target.martyred = true;
        const flock = activeEntities.filter(e => !e.isPlayer && e.hp > 0 && e.classType === 'CULTIST');
        flock.forEach(e => {
            const back = Math.max(1, Math.floor(e.maxHp * 0.3));
            e.hp = Math.min(e.maxHp, e.hp + back);
            spawnFCT(e.id, `+${back}`, 'fct-heal');
        });
        log(flock.length ? `> ${target.name} breaks open, and the Choir takes it up.`
                         : `> ${target.name} breaks open over an empty road.`, 'log-status');
        playSFX('heal');
    }
    // Second Wind: once per fight, a killing blow leaves them standing at 1.
    if (target.hp <= 0 && hasQuirk(target, 'SECOND_WIND') && !target.secondWindUsed) {
        target.secondWindUsed = true; target.hp = 1;
        log(`> ${target.name} refuses to go down!`, 'log-heal');
        spawnFCT(target.id, 'SECOND WIND', 'fct-heal'); playSFX('heal', 1.2);
    }
    if (target.hp <= 0 && !target.isPlayer && !target.tallied) { target.tallied = true; noteBestiary(typeNameOf(target), 'killed'); }
    // Blood Debt: a risen Warlord feeds on its own dead, so clearing the pack off it costs.
    if (target.hp <= 0 && !target.isPlayer) {
        const owed = activeEntities.find(e => e.classType === 'BOSS' && e.hp > 0 && e.bloodDebt && e.id !== target.id);
        if (owed) {
            const fed = Math.max(1, Math.floor(owed.maxHp * owed.bloodDebt));
            owed.hp = Math.min(owed.maxHp, owed.hp + fed);
            log(`> ${owed.name} feeds on ${target.name}. +${fed} HP.`, 'log-dmg');
            setTimeout(() => spawnFCT(owed.id, `+${fed}`, 'fct-heal'), 260);
        }
    }
    if (target.hp <= 0 && target.isPlayer && !attacker.isPlayer) noteBestiary(typeNameOf(attacker), 'felled');
    // The chronicle's witness: whoever lands the blow that drops an operator is on record.
    if (target.hp <= 0 && target.isPlayer && runStats)
        runStats.lastKiller = { name: attacker.name, elite: attacker.eliteType || null,
                               boss: attacker.classType === 'BOSS', sector: currentSector, tier: currentTier, cause: 'COMBAT' };
    if (target.hp <= 0 && target.isPlayer) goDown(target);
    let logStyle = "log-dmg"; let logMsg = `> ${attacker.name} hits ${target.name} for ${netDmg}`;
    
    triggerHitFlash(target.id);

    filed.net = netDmg; filed.soaked = calcDmg - netDmg; filed.resist = resistValue;
    filed.armor = (abilityStr === 'FERAL_BITE' || (target.corrodedTurns || 0) > 0) ? 0 : target.armor;
    filed.plated = hasSig(target, 'RIOT_PLATE') && (target.plate || 0) > 0;
    hitLog.push(filed); if (hitLog.length > 24) hitLog.shift();
    const hitId = hitLog.length - 1;
    if (netDmg === 0 && resistValue >= 100) { logMsg += " (Immune)."; spawnFCT(target.id, "IMMUNE", "fct-status"); playImpact(0, target, 0.5);
    } else if (resistValue > 5) { logMsg += " (Resisted)."; spawnFCT(target.id, `-${netDmg}`, "fct-dmg"); playImpact(netDmg, target, 0.7);
    } else if (resistValue < 0) { logMsg += " (Weakness!)."; logStyle = "log-dmg"; spawnFCT(target.id, `-${netDmg}!`, "fct-weak"); playImpact(netDmg, target, 1.25);
    } else { spawnFCT(target.id, `-${netDmg}`, "fct-dmg"); playImpact(netDmg, target); }
    
    log(logMsg, logStyle, hitId);

    if (target.hp <= 0) {
        addMomentum(15);
        if (!target.isPlayer) {
            checkBountyProgress('KILL'); if (runStats) runStats.kills++;
            // How it died, not just that it did: a combo finish and a heavy brought down are
            // both things the board can ask for, and both are known right here.
            if (comboKill) checkBountyProgress('EXECUTE');
            if (target.isHeavy) checkBountyProgress('HEAVY');
            if (odKills !== null) odKills++;
        }
    } else if (target.isPlayer) { addMomentum(5); }

    // Bloodletter: the chieftain's kit is all serrated, so every blow it lands keeps bleeding.
    // Steady pressure rather than a spike - it is answered by cleansing, not by armour.
    if (attacker.bossPassive === 'BLOODLETTER' && netDmg > 0 && target.hp > 0 && target.isPlayer) {
        target.bleedingTurns = Math.max(target.bleedingTurns || 0, 2);
        setTimeout(() => spawnFCT(target.id, "BLEED", "fct-status"), 300 * globalSettings.combatSpeed);
    }

    // Carrion Feast: the Matriarch grows on what it opens up.
    if (attacker.bossPassive === 'FEAST' && attacker.hp > 0 && netDmg > 0 && attacker.hp < attacker.maxHp) {
        const fed = Math.max(1, Math.floor(netDmg * 0.3));
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + fed);
        setTimeout(() => spawnFCT(attacker.id, `+${fed}`, "fct-heal"), 260);
    }

    if (abilityStr === 'RAD_SHOT' || abilityStr === 'FERAL_BITE' || abilityStr === 'SHIV') {
        let bleedChance = abilityStr === 'FERAL_BITE' ? 0.9 : abilityStr === 'SHIV' ? 0.4 : 0.6;
        if (abilityStr === 'RAD_SHOT' && hasTrait(attacker, 'RAD_SPECIALIST')) bleedChance = 1;
        if (sectorFront === 'BLOOD_MOON') bleedChance = 1;
        if (Math.random() < bleedChance) { target.bleedingTurns = abilityStr === 'SHIV' ? 2 : 3; log(`> ${target.name} bleeding!`, "log-dmg"); setTimeout(() => spawnFCT(target.id, "BLEED", "fct-status"), 300 * globalSettings.combatSpeed); }
    } else if (abilityStr === 'HEAVY_WRENCH' || abilityStr === 'FLASHBANG' || abilityStr === 'RIOT_BUTT') {
        let sc = (abilityStr === 'FLASHBANG') ? 0.35 : abilityStr === 'RIOT_BUTT' ? 0.25 : 0.2; if (abilityStr === 'FLASHBANG' && target.resistances.energy < 0) sc *= 2;
        if (abilityStr === 'FLASHBANG' && hasMod(attacker, 'WIDE_LENS')) sc = 1;
        if (hasTrait(target, 'UNSHAKEABLE')) sc = 0;
        if (Math.random() < sc) { target.stunnedTurns = 1; log(`> ${target.name} stunned!`, "log-status"); setTimeout(() => spawnFCT(target.id, "STUNNED", "fct-status"), 300 * globalSettings.combatSpeed); }
    } else if (sectorFront === 'BLOOD_MOON' && atkType === 'phys' && netDmg > 0 && target.hp > 0 && Math.random() < 0.2) {
        // Under the blood moon any raw hit can open a wound, on either side of the field.
        target.bleedingTurns = Math.max(target.bleedingTurns || 0, 2);
        log(`> The blood moon opens ${target.name}.`, "log-dmg");
        setTimeout(() => spawnFCT(target.id, "BLEED", "fct-status"), 300 * globalSettings.combatSpeed);
    }
}

// Melee walks into whoever is nearest. Ranged fire used to pick uniformly at random, which meant
// a front rank protected nobody and standing a sniper at the back was free. It now leans on the
// back line, where the fragile units are - and a flank ignores the ranks entirely.
const BACKLINE_WEIGHT = { 1: 1, 2: 3, 3: 5 };
// Open ground lets a shooter see past your front rank; the weighting is where that lands.
function backlineWeight(ent) {
    const w = BACKLINE_WEIGHT[ent.gridPos] || 1;
    return ent.gridPos > 1 ? w * (ground().backline || 1) : w;
}

function pickTarget(enemy, candidates, intent) {
    if (candidates.length === 0) return null;
    if (intent && intent.type === 'FLANK') {
        return [...candidates].sort((a, b) => b.gridPos - a.gridPos)[0];
    }
    if (enemy.range === 'melee') {
        return [...candidates].sort((a, b) => a.gridPos - b.gridPos)[0];
    }
    const weighted = [];
    candidates.forEach(t => { const w = Math.round(backlineWeight(t)); for (let i = 0; i < w; i++) weighted.push(t); });
    return weighted[Math.floor(Math.random() * weighted.length)];
}

// One dose of the pump. Loud on the field on purpose: the whole mechanic is a trade the
// player has to be able to read, so each dose says both halves of it at once.
// The third gear. Each commander's is its own answer to how you beat it last time, so this
// is a switchboard rather than a formula: the shared parts (a cry, a tell, armour) are handled
// here and the move itself is whatever that warlord learned.
function openGrudgePhase(enemy) {
    const gm = enemy.grudgeMove; if (!gm || enemy.phase >= 3) return;
    enemy.phase = 3;
    playSFX('enrage', 1.6); triggerShake(); triggerGlitch();
    log(`> ${gm.cry}`, 'log-dmg');
    if (gm.tell) log(`> ${gm.tell}`, 'log-status');
    spawnFCT(enemy.id, gm.name || 'GRUDGE', 'fct-weak');

    if (gm.armorBonus) { enemy.armor += gm.armorBonus; enemy.baseArmor = (enemy.baseArmor || 0) + gm.armorBonus; }
    // The Warlord charges you for every one of its pack you put down.
    if (gm.bloodDebt) enemy.bloodDebt = gm.bloodDebt;
    // The Colossus stops spacing its salvoes and starts winding them up.
    if (gm.charge) { enemy.charging = 0; enemy.chargeSpec = gm.charge; }
    // The Matriarch lays.
    if (gm.spawn) { enemy.spawnSpec = gm.spawn; enemy.spawnClock = 0; }
    // The Vatborn opens the tank all the way and vents over whoever is holding the front.
    if (gm.venomBurst && enemy.venom) {
        for (let i = 0; i < gm.venomBurst && enemy.venomStacks < enemy.venom.max; i++) venomDose(enemy, true);
    }
    if (gm.aura) enemy.aura = gm.aura;
    // The Stormcaller stops waiting for the sky.
    if (gm.stormTurn) { enemy.stormTurn = gm.stormTurn; enemy.stormClock = 0; }
    if (gm.skyToll) enemy.skyToll = gm.skyToll;
    // The Marshal's second hound, and the Bastion's second generator: both are the retinue
    // the fight opened with, put back on the field.
    if (gm.reEscort || gm.reWard) {
        const src = BOSS_POOL.find(x => x.id === enemy.bossId) || {};
        const spec = gm.reEscort ? src.escort : src.ward;
        if (spec) {
            const m = 1 + ((currentTier - 1) * 0.4);
            const unit = {
                id: `grudge_${Date.now()}`, name: spec.name, classType: spec.classType, range: spec.range,
                maxHp: Math.floor(spec.hp * m), hp: Math.floor(spec.hp * m),
                speed: spec.speed, armor: spec.armor || 0, baseArmor: spec.armor || 0, isPlayer: false,
                dmgBase: Math.floor(spec.dmg * m), img: spec.img, scale: spec.scale, hpDrop: 0,
                stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0,
                resistances: { ...spec.resistances }
            };
            if (spec.sig) unit.sig = spec.sig;
            if (gm.reWard) { enemy.wardId = unit.id; enemy.wardSoak = src.wardSoak || 0.15; }
            if (gm.reEscort) { enemy.escortId = unit.id; enemy.escortArmor = src.escortArmor || 20; }
            unit.intent = rollIntent(unit);
            activeEntities.push(unit); turnQueue.push(unit);
            log(`> ${spec.name} takes the field.`, 'log-dmg');
        }
    }
}

function venomDose(enemy, quiet) {
    const v = enemy.venom;
    if (!v || enemy.venomStacks >= v.max) return;
    enemy.venomStacks++;
    enemy.dmgBase = Math.max(1, Math.ceil(enemy.dmgBase * (1 + v.dmg)));
    enemy.speed += v.speed;
    enemy.baseArmor = Math.max(0, (enemy.baseArmor || 0) - v.armorLoss);
    enemy.armor = Math.max(0, (enemy.armor || 0) - v.armorLoss);
    if (!quiet) {
        log(`> ${enemy.name} hits the pump - dose ${enemy.venomStacks}. Stronger, and further open.`, 'log-status');
        spawnFCT(enemy.id, `VENOM ${enemy.venomStacks}`, 'fct-status');
        playSFX('heal');
    }
    renderField();
}

function executeEnemyAi(enemy) {
    if (!combatActive) return;
    if (enemy.sigCd > 0) enemy.sigCd--;

    // Under the ground since its last turn. It comes up in the front rank and hits on arrival,
    // so the turn it spent hidden is paid back in one blow.
    if (enemy.burrowed > 0) {
        enemy.burrowed = 0;
        const live = activeEntities.filter(e => e.isPlayer && e.hp > 0);
        const front = [...live].sort((a, b) => a.gridPos - b.gridPos)[0];
        log(`> ${enemy.name} comes up out of the ground!`, 'log-dmg');
        spawnFCT(enemy.id, 'SURFACED', 'fct-status'); triggerShake(); playSFX('heavy');
        if (front) {
            playAttackAnim(enemy, front, null);
            applyDamageHit(enemy, front, Math.floor(enemy.dmgBase * 1.6 * enemyDmgMult(enemy)), enemy.dmgType || 'phys', 'BASIC');
        }
        enemy.intent = rollIntent(enemy); checkWinState(); return;
    }
    // Whatever the forecast promised, the Stormcaller will not let it stand.
    if (enemy.stormTurn && ++enemy.stormClock >= enemy.stormTurn) {
        enemy.stormClock = 0;
        const skies = ['TOXIC_SMOG', 'SANDSTORM', 'SHRAPNEL_WINDS', 'BLOODLUST'].filter(w => w !== currentWeather);
        currentWeather = skies[Math.floor(Math.random() * skies.length)];
        log(`> ${enemy.name} turns the sky over: ${currentWeather.replace(/_/g, ' ')}.`, 'log-status');
        spawnFCT(enemy.id, 'THE SKY TURNS', 'fct-status');
        applyCombatScenery(combatBgFile, null);
        // A grudge-phase Stormcaller does not just change the sky, it drops it on you.
        if (enemy.skyToll) {
            activeEntities.filter(t => t.isPlayer && t.hp > 0).forEach(t => {
                const toll = Math.max(1, Math.floor(t.maxHp * enemy.skyToll));
                t.hp = Math.max(0, t.hp - toll);
                spawnFCT(t.id, `-${toll}`, 'fct-status'); triggerHitFlash(t.id);
                if (t.hp <= 0) { goDown(t); if (runStats) runStats.lastKiller = { name: enemy.name, boss: true, sector: currentSector, tier: currentTier, cause: 'COMBAT' }; }
            });
            log(`> The sky comes down on the squad.`, 'log-dmg');
        }
        playSFX('enrage'); triggerShake(); renderField();
    }

    // ── the grudge phases that run on a clock ────────────────────────────────────────
    // The Matriarch lays while you are still trying to finish her.
    if (enemy.spawnSpec && enemy.hp > 0 && ++enemy.spawnClock >= enemy.spawnSpec.every) {
        enemy.spawnClock = 0;
        const sp = enemy.spawnSpec, m = 1 + ((currentTier - 1) * 0.4);
        const brood = {
            id: `brood_${Date.now()}`, name: sp.name, classType: sp.classType, range: sp.range,
            maxHp: Math.floor(sp.hp * m), hp: Math.floor(sp.hp * m), speed: sp.speed,
            armor: 0, baseArmor: 0, isPlayer: false, dmgBase: Math.floor(sp.dmg * m),
            img: sp.img, scale: sp.scale, hpDrop: 0,
            stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0,
            resistances: { ...sp.resistances }
        };
        brood.intent = rollIntent(brood);
        activeEntities.push(brood); turnQueue.push(brood);
        log(`> ${enemy.name} lays another. ${sp.name} takes the field.`, 'log-dmg');
        spawnFCT(enemy.id, 'LAYING', 'fct-weak'); renderField();
    }

    // The Vatborn vents over whoever is holding the rank it named.
    if (enemy.aura && enemy.hp > 0) {
        const caught = activeEntities.filter(t => t.isPlayer && t.hp > 0 && t.gridPos <= (enemy.aura.rank || 1));
        caught.forEach(t => {
            const burn = Math.max(1, Math.floor(t.maxHp * enemy.aura.share));
            t.hp = Math.max(0, t.hp - burn);
            spawnFCT(t.id, `-${burn}`, 'fct-status'); triggerHitFlash(t.id);
            if (t.hp <= 0) { goDown(t); if (runStats) runStats.lastKiller = { name: enemy.name, boss: true, sector: currentSector, tier: currentTier, cause: 'COMBAT' }; }
        });
        if (caught.length) log(`> The vents open over the front rank.`, 'log-dmg');
    }

    // The Colossus winds a salvo up in front of you, then lets it go.
    if (enemy.chargeSpec && enemy.hp > 0) {
        if (enemy.charging >= (enemy.chargeSpec.turns || 1)) {
            enemy.charging = 0;
            const hit = activeEntities.filter(t => t.isPlayer && t.hp > 0);
            log(`> ${enemy.name} FIRES. The whole line is under it.`, 'log-dmg');
            spawnFCT(enemy.id, 'SALVO', 'fct-weak'); triggerShake();
            hit.forEach(t => applyDamageHit(enemy, t,
                Math.floor(enemy.dmgBase * (enemy.chargeSpec.mult || 1.1) * enemyDmgMult(enemy)),
                enemy.dmgType || 'phys', 'SALVO'));
            enemy.intent = rollIntent(enemy); checkWinState(); return;
        }
        enemy.charging++;
        log(`> ${enemy.name} is charging its batteries.`, 'log-status');
        spawnFCT(enemy.id, 'CHARGING', 'fct-status'); renderField();
        enemy.intent = rollIntent(enemy);
        setTimeout(nextTurn, 1000 * globalSettings.combatSpeed); return;
    }
    
    // The Vatborn buys strength with skin. Each dose is worth more damage and more speed, and
    // costs it armour and a share of its own resilience - so the wall you opened on gets
    // steadily more dangerous and steadily easier to kill at the same time.
    if (enemy.venom && enemy.hp > 0 && enemy.venomStacks < enemy.venom.max &&
        ++enemy.venomClock >= enemy.venom.every) {
        enemy.venomClock = 0;
        venomDose(enemy);
    }

    // A commander that has lost to you before has one more gear, and it only ever shows it
    // to somebody who has already beaten it. Runs after the ordinary enrage, not instead.
    if (enemy.classType === 'BOSS' && enemy.phase === 2 && enemy.grudgeMove &&
        enemy.hp <= enemy.maxHp * GRUDGE.phaseAt) {
        openGrudgePhase(enemy);
        enemy.intent = rollIntent(enemy); renderField();
        setTimeout(nextTurn, 1000 * globalSettings.combatSpeed); return;
    }

    if (enemy.classType === 'BOSS' && enemy.phase === 1 && enemy.hp <= enemy.maxHp * (ascension >= 2 ? 0.6 : 0.5)) {
        enemy.phase = 2;
        playSFX('enrage');
        const e = enemy.enrage || {};
        log(`> ${e.cry || 'THE COMMANDER ENRAGES!'}`, "log-dmg");
        spawnFCT(enemy.id, "ENRAGED!", "fct-status"); triggerShake();

        if (e.dmgScale) enemy.dmgBase = Math.floor(enemy.dmgBase * e.dmgScale);
        if (e.speedBonus) enemy.speed += e.speedBonus;
        if (e.armorBonus) { enemy.armor += e.armorBonus; enemy.baseArmor = (enemy.baseArmor || 0) + e.armorBonus; }
        if (e.forceAoe) enemy.forceAoe = true;

        // Plague Wind: no reinforcements, it simply infects the whole line at once.
        if (e.plague) {
            activeEntities.filter(t => t.isPlayer && t.hp > 0).forEach(t => {
                t.bleedingTurns = Math.max(t.bleedingTurns, 3);
                spawnFCT(t.id, "PLAGUE", "fct-status");
            });
            log(`> The squad is choking on rot.`, "log-status");
        }

        // The tank goes wide open at once: two doses in a breath, and the most broken operator
        // on the field gets picked up and put back down.
        if (e.venomBurst && enemy.venom) {
            for (let i = 0; i < e.venomBurst && enemy.venomStacks < enemy.venom.max; i++) venomDose(enemy, true);
        }
        if (e.backbreaker) {
            const hurt = activeEntities.filter(t => t.isPlayer && t.hp > 0)
                .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
            if (hurt) {
                log(`> ${enemy.name} picks up ${hurt.name}. BACKBREAKER!`, 'log-dmg');
                spawnFCT(enemy.id, 'BACKBREAKER', 'fct-status');
                applyDamageHit(enemy, hurt, Math.floor(enemy.dmgBase * (e.backbreaker.mult || 1.8)),
                    enemy.dmgType || 'phys', 'BACKBREAKER');
                if (hurt.hp > 0 && e.backbreaker.stun) {
                    hurt.stunnedTurns = Math.max(hurt.stunnedTurns, e.backbreaker.stun);
                    spawnFCT(hurt.id, 'STUNNED', 'fct-status');
                }
            }
        }

        if (e.summon) {
            const m = 1 + ((currentTier - 1) * 0.4);
            const proto = {
                name: e.summon.name, classType: e.summon.classType, range: e.summon.range,
                maxHp: Math.floor(e.summon.hp * m), hp: Math.floor(e.summon.hp * m),
                speed: e.summon.speed, armor: 0, baseArmor: 0, isPlayer: false,
                dmgBase: Math.floor(e.summon.dmg * m), img: e.summon.img, scale: e.summon.scale,
                hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0,
                resistances: { ...e.summon.resistances }
            };
            if (e.summon.isHovering) proto.isHovering = true;
            for (let i = 0; i < (e.summonCount || 2); i++) {
                let n = JSON.parse(JSON.stringify(proto));
                n.id = `summon_${Date.now()}_${i}`;
                n.intent = rollIntent(n);
                activeEntities.push(n); turnQueue.push(n);
            }
            log(`> ${e.summonCount || 2}x ${e.summon.name} joins the fight!`, "log-dmg");
        }

        enemy.intent = rollIntent(enemy); renderField(); setTimeout(nextTurn, 1000 * globalSettings.combatSpeed); return;
    }

    let validTargets = activeEntities.filter(e => e.isPlayer && e.hp > 0); 
    if (validTargets.length === 0) return;
    let intent = enemy.intent || { type: 'ATTACK' };
    let target = pickTarget(enemy, validTargets, intent);

    // A braced unit standing in front of the mark takes the hit instead, softened. This is
    // what makes a formation worth arranging rather than a row of interchangeable slots.
    let intercepted = null;
    if (target && ['ATTACK', 'HEAVY', 'STATUS', 'FLANK'].includes(intent.type)) {
        const cover = validTargets.find(p => (p.guardTurns || 0) > 0 && p.gridPos < target.gridPos);
        if (cover) { intercepted = target; target = cover; }
    }
    
    if (intent.type === 'SIG') {
        const sig = sigOf(enemy);
        enemy.sigCd = (sig && sig.cd) || 2;
        enemy.intentDone = true;

        if (enemy.sig === 'DRAG_DOWN') {
            // Reaches past the line and hauls the furthest operator to the front, then mauls
            // them - the formation answer to a formation game.
            const back = [...validTargets].sort((a, b) => b.gridPos - a.gridPos)[0];
            const front = [...validTargets].sort((a, b) => a.gridPos - b.gridPos)[0];
            if (back && front && back.id !== front.id) {
                const swap = back.gridPos; back.gridPos = front.gridPos; front.gridPos = swap;
                const order = (a, b) => (a.isPlayer && b.isPlayer) ? a.gridPos - b.gridPos : 0;
                activeEntities = [...activeEntities.filter(e => e.isPlayer).sort(order), ...activeEntities.filter(e => !e.isPlayer)];
                log(`> ${enemy.name} drags ${back.name} out of the line!`, 'log-dmg');
                spawnFCT(back.id, 'DRAGGED', 'fct-status');
            }
            if (back) { triggerShake(); playAttackAnim(enemy, back, null); applyDamageHit(enemy, back, Math.floor((enemy.dmgBase + 4) * enemyDmgMult(enemy)), enemy.dmgType || 'phys', 'BASIC'); }
        }

        else if (enemy.sig === 'CALL_IT_IN') {
            // One whistle each, and never into an already-crowded field.
            const crowd = activeEntities.filter(e => !e.isPlayer && e.hp > 0).length;
            if (crowd < 5) {
                const m = 1 + ((currentTier - 1) * 0.4);
                const help = JSON.parse(JSON.stringify(enemy));
                help.id = `called_${Date.now()}_${Math.floor(Math.random() * 999)}`;
                help.hp = help.maxHp = Math.max(10, Math.floor(40 * m * difficultyMult));
                help.dmgBase = Math.max(4, Math.floor(12 * m * difficultyMult));
                help.sig = null; help.sigCd = 0; help.plate = 0;
                help.bleedingTurns = 0; help.stunnedTurns = 0; help.oiledTurns = 0;
                help.corrodedTurns = 0; help.markedTurns = 0; help.armorTurns = 0;
                help.intent = rollIntent(help);
                activeEntities.push(help); turnQueue.push(help);
                log(`> ${enemy.name} whistles. Another raider comes running.`, 'log-dmg');
                playSFX('enrage');
            } else {
                log(`> ${enemy.name} shouts for help. Nobody answers.`, 'log-status');
            }
        }

        else if (enemy.sig === 'RANGING') {
            // Two beats: range someone in the back, then execute them. Killing the sniper,
            // healing the mark or breaking line of sight are all real answers.
            const mark = [...validTargets].sort((a, b) => b.gridPos - a.gridPos)[0];
            if (mark) {
                enemy.lockOn = mark.id;
                log(`> ${enemy.name} ranges ${mark.name}.`, 'log-status');
                spawnFCT(mark.id, 'RANGED', 'fct-weak');
                playSFX('click');
            }
        }

        else if (enemy.sig === 'OVERWATCH') {
            enemy.overwatch = 2;
            log(`> ${enemy.name} locks the field down.`, 'log-status');
            spawnFCT(enemy.id, 'OVERWATCH', 'fct-status');
            playSFX('heal');
        }

        else if (enemy.sig === 'LITANY') {
            // Sings over whoever hits hardest, not whoever is nearest - so the Acolyte makes
            // the worst thing on the field worse.
            const flock = activeEntities.filter(e => !e.isPlayer && e.hp > 0 && e.id !== enemy.id && !(e.blessedTurns > 0));
            const sung = flock.sort((a, b) => (b.dmgBase || 0) - (a.dmgBase || 0))[0];
            if (sung) {
                sung.blessed = 0.35; sung.blessedTurns = 2;
                log(`> ${enemy.name} sings over ${sung.name}.`, 'log-status');
                spawnFCT(sung.id, 'BLESSED', 'fct-heal'); playSFX('heal');
            } else {
                log(`> ${enemy.name} sings over nothing in particular.`, 'log-status');
            }
        }

        else if (enemy.sig === 'RAD_WASH') {
            // Corrosion zeroes armour outright, so this is aimed at whoever is holding the line.
            const front = [...validTargets].sort((a, b) => a.gridPos - b.gridPos).slice(0, 2);
            front.forEach(t => { t.corrodedTurns = Math.max(t.corrodedTurns || 0, 2); spawnFCT(t.id, 'CORRODED', 'fct-weak'); });
            log(front.length ? `> ${enemy.name} washes the front rank down.` : `> ${enemy.name} pours it on empty ground.`, 'log-status');
            playSFX('flame');
        }

        else if (enemy.sig === 'RESURGENCE') {
            // One raising each, and only ever its own - a fallen operator stays fallen.
            const fallen = activeEntities.find(e => !e.isPlayer && e.hp <= 0 && e.classType === 'CULTIST');
            if (fallen) {
                fallen.hp = Math.max(1, Math.floor(fallen.maxHp * 0.5));
                fallen.deathPlayed = false; fallen.bloomed = false;
                fallen.stunnedTurns = 0; fallen.bleedingTurns = 0;
                if (!turnQueue.some(e => e.id === fallen.id)) turnQueue.push(fallen);
                fallen.intent = rollIntent(fallen);
                log(`> ${enemy.name} calls ${fallen.name} back up.`, 'log-dmg');
                spawnFCT(fallen.id, 'RISEN', 'fct-heal'); playSFX('enrage'); triggerShake();
            } else {
                log(`> ${enemy.name} calls, and nothing answers.`, 'log-status');
            }
        }

        else if (enemy.sig === 'BURROW') {
            // A turn of nothing, then it comes up where it hurts. It will not go under if that
            // would leave the squad with nothing on the field to shoot at - a turn spent
            // aiming at empty ground is not a mechanic, it is a pause.
            const others = activeEntities.filter(e => !e.isPlayer && e.hp > 0 && e.id !== enemy.id && !e.burrowed);
            if (others.length > 0) {
                enemy.burrowed = 1;
                log(`> ${enemy.name} goes under the ground.`, 'log-status');
                spawnFCT(enemy.id, 'BURROWED', 'fct-status'); playSFX('heavy');
            } else {
                log(`> ${enemy.name} scrapes at the ground and thinks better of it.`, 'log-status');
            }
        }

        else if (enemy.sig === 'BROOD') {
            const crowd = activeEntities.filter(e => !e.isPlayer && e.hp > 0).length;
            const rat = ENEMY_POOL.CARRION.find(e => e.name === 'Carrion Rat');
            if (crowd < 6 && rat) {
                const m = 1 + ((currentTier - 1) * 0.4);
                const born = JSON.parse(JSON.stringify(rat));
                born.id = `brood_${Date.now()}_${Math.floor(Math.random() * 999)}`;
                born.hp = born.maxHp = Math.max(6, Math.floor(rat.maxHp * m * difficultyMult));
                born.dmgBase = Math.max(3, Math.floor(rat.dmgBase * m * difficultyMult));
                born.baseArmor = born.armor || 0; born.sigCd = 0;
                born.intent = rollIntent(born);
                activeEntities.push(born); turnQueue.push(born);
                log(`> ${enemy.name} lays another.`, 'log-dmg');
                playSFX('beast');
            } else {
                log(`> ${enemy.name} strains, and nothing comes.`, 'log-status');
            }
        }

        else if (enemy.sig === 'AEGIS') {
            const covered = activeEntities.filter(e => !e.isPlayer && e.hp > 0 && e.id !== enemy.id);
            covered.forEach(e => { e.armor = (e.armor || 0) + 8; e.armorTurns = Math.max(e.armorTurns || 0, 2); spawnFCT(e.id, '+ARMOR', 'fct-heal'); });
            log(covered.length ? `> ${enemy.name} throws plating over ${covered.length === 1 ? 'its escort' : 'its escorts'}.`
                               : `> ${enemy.name} projects a field over nobody.`, 'log-status');
            playSFX('heal');
        }

        enemy.intent = rollIntent(enemy); checkWinState(); return;
    }

    if (intent.type === 'DEFEND') {
        enemy.armor += 15; enemy.armorTurns = 2; spawnFCT(enemy.id, "+ARMOR", "fct-heal"); log(`> ${enemy.name} took a defensive stance!`, "log-status"); playSFX('heal');
        enemy.intent = rollIntent(enemy); checkWinState(); return;
    }

    if (intent.type === 'AOE') {
        playSFX('blast'); triggerShake(); log(`> ${enemy.name} unleashed an area attack!`, "log-dmg");
        const rawDmg = enemyStrike(enemy, intent);
        validTargets.forEach(targ => { applyDamageHit(enemy, targ, rawDmg, enemy.dmgType || 'phys', 'BASIC'); });
        enemy.intent = rollIntent(enemy); checkWinState(); return;
    }

    if (target) {
        playSFX(enemy.classType === 'BEAST' || enemy.classType === 'MUTANT' ? 'beast'
              : enemy.range === 'ranged' ? 'rifle' : 'blade');
        playAttackAnim(enemy, target, null);
        let t = enemy.dmgType || 'phys';
        const roll = Math.floor(Math.random() * 5);

        // The ranged shot comes due: if the marked operator still stands, this one hurts.
        let locked = false;
        if (enemy.lockOn) {
            const mark = validTargets.find(p => p.id === enemy.lockOn);
            enemy.lockOn = null;
            if (mark) {
                target = mark; intercepted = null; locked = true;
                log(`> ${enemy.name} takes the shot it lined up.`, 'log-dmg');
                triggerShake();
            }
        }
        if (intent.type === 'HEAVY') triggerShake();
        let interceptMult = 1;
        if (intercepted) {
            interceptMult = Math.min(hasRelic('BULWARK_PLATING') ? 0.35 : 1, hasTrait(target, 'BULWARK') ? 0.45 : 0.6);
            log(`> ${target.name} steps in front of ${intercepted.name}.`, "log-status");
            spawnFCT(target.id, "COVERED", "fct-heal");
        }
        const rawDmg = enemyStrike(enemy, intent, { roll, lockOn: locked, intercepted: !!intercepted, interceptMult });

        applyDamageHit(enemy, target, rawDmg, t, 'BASIC');

        if (enemy.eliteType === 'VAMPIRIC') { let heal = Math.max(1, Math.floor(rawDmg * 0.5)); enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal); setTimeout(() => spawnFCT(enemy.id, `+${heal}`, "fct-heal"), 300); }

        if (intent.type === 'STATUS' || ["Mutant", "Attack Dog", "War Hound", "Chem Fiend"].includes(enemy.name)) { 
            if (Math.random() < 0.5 || hasTrait(target, 'UNSHAKEABLE')) { target.bleedingTurns = 2; setTimeout(() => spawnFCT(target.id, "BLEED", "fct-status"), 300 * globalSettings.combatSpeed); }
            else { target.stunnedTurns = 1; setTimeout(() => spawnFCT(target.id, "STUNNED", "fct-status"), 300 * globalSettings.combatSpeed); }
        }
    }
    
    enemy.intent = rollIntent(enemy); checkWinState();
}

const RESERVE_XP_RATE = 0.5;

function awardXp(char, amount) {
    if (amount <= 0) return;
    if (sectorFront === 'QUIET_ROADS') amount = Math.floor(amount * 0.85);
    if (hasTrinket(char, 'WAR_TROPHY')) amount = Math.floor(amount * 1.25);
    noteMastery(char.classType, amount);
    char.xp += amount;
    while (char.xp >= char.xpToNext) {
        char.level++; char.xp -= char.xpToNext; char.xpToNext = Math.floor(char.xpToNext * XP_CURVE); char.perkPoints++;
        pendingPerkOffers.push({ charId: char.id, options: rollPerkOffer(char) });
        log(`> ${char.name} reached Level ${char.level}! Promotion pending.`, "log-heal");
    }
}

function checkWinState() {
    renderField();
    const pA = activeEntities.some(e => e.isPlayer && e.hp > 0); const eA = activeEntities.some(e => !e.isPlayer && e.hp > 0);
    if (!pA) { document.getElementById('command-deck').innerHTML = `<button data-action="squad-down">SQUAD DOWN</button>`; combatActive = false; stopAmbience(); } 
    else if (!eA) { 
        if (currentNodeType === 'BOSS') {
            bossSkulls++; if (runStats) runStats.bosses++;
            // It remembers this. The next one of these you meet is the one you made.
            const felled = activeEntities.find(e => e.classType === 'BOSS');
            if (felled && felled.bossId) {
                // A commander is the one node on a sector you cannot withdraw from or fall back
                // out of, so a risen one is a gate rather than a fight you can route around.
                // What it took from you it also pays: a skull for every grudge it was carrying.
                const owed = felled.grudge || 0;
                if (owed > 0) {
                    bossSkulls += owed;
                    log(`> It came back for you ${owed === 1 ? 'once' : `${owed} times`} and you put it down anyway. +${owed} extra 💀.`, "log-heal");
                }
                noteGrudge(felled.bossId);
                const g = grudgeOn(felled.bossId);
                log(g > 1 ? `> That is ${g} times you have put it down. It will be worse.`
                          : `> It goes down hard. It will remember that.`, "log-status");
            }
            saveMeta(); log(`> VICTORY! Warlord Skull acquired!`, "log-heal");
            checkBountyProgress('BOSS');
            // Felling a commander refunds a fallback, up to the allowance. Measured before this,
            // squads entered every new sector with their regroups already spent and died holding
            // nothing - a cleared sector should buy a breath.
            if (runStats && runStats.regroups < totalRegroups()) {
                runStats.regroups++;
                log(`> The squad regroups behind the kill. +1 FALLBACK (${regroupsLeft()}/${totalRegroups()}).`, "log-heal");
            }
            // Scavenger's Debt comes due wherever a warlord falls.
            if (hasRelic('SCAVENGERS_DEBT')) {
                const taken = Math.min(scrap, 500);
                scrap -= taken;
                log(`> The collector's men are already here. They take ${taken} Scrap.`, "log-dmg");
            }
        }
        if (isCurrentNodeElite) {
            checkBountyProgress('ELITE'); if (runStats) runStats.elites++;
            if (hasRelic('VULTURE_ROYALTY') || Math.random() < 0.4) {
                const gDrop = rollGear();
                if (gDrop) { gearStash.push(gDrop); firePrompt('GEAR'); log(`> GEAR SALVAGED: ${gearById(gDrop).name} (equip at the Outpost).`, "log-combo"); }
            }
            const rDrop = rollRelic();
            if (rDrop) { activeRelics.push(rDrop); log(`> RELIC ACQUIRED: ${rDrop.name}!`, "log-combo"); announceSets(); }
            else { const b = emptyPoolScrap(); scrap += b; log(`> No relic left to find. Salvaged ${b} Scrap instead.`, "log-heal"); }
        }
        // A commander is worth a decision rather than a die roll, so it hands over three to
        // choose between. The choice is staged and shown once the loot has been collected.
        if (currentNodeType === 'BOSS') {
            const gDrop = rollGear();
            if (gDrop) { gearStash.push(gDrop); log(`> The commander's arsenal yields: ${gearById(gDrop).name}.`, "log-combo"); }
            const offer = rollRelicOffer();
            if (offer.length) pendingRelicOffer = offer;
            else { const b = emptyPoolScrap(); scrap += b; log(`> Nothing left in the pool. Salvaged ${b} Scrap instead.`, "log-heal"); }
        }

        activeEntities.filter(e => hasTrait(e, 'PACKRAT') && e.hp > 0).forEach(e => {
            scrap += 10; log(`> ${e.name} strips 10 extra Scrap.`, 'log-heal');
        });
        activeEntities.filter(e => hasQuirk(e, 'SCRAP_RAT') && e.hp > 0).forEach(e => {
            const m = ['parts', 'chems', 'tech'][Math.floor(Math.random() * 3)];
            materials[m]++; log(`> ${e.name} pockets 1 ${m.toUpperCase()}.`, 'log-heal');
        });
        if (tuneUpBattles > 0) tuneUpBattles--;
        // Holding the field is what buys the time to get to whoever is still on the floor.
        recoverDowned('once the field is held');
        // How the fight was won, before the log is cleared by the next one.
        noteFightWon();
        recordBonds();
        saveMeta();   // mastery accrues per fight and survives whatever the run does next

        let scrapMult = isCurrentNodeElite ? 2 : 1;
        let s = Math.floor((Math.floor(Math.random() * 30) + (currentTier * 20)) * scrapMult * sectorRewardMult());
        // The front's ledger: a warband's raiders carry double, and a quiet sector's boss
        // hoards what the roads never paid.
        if (sectorFront === 'RAIDER_WARBAND' && currentNodeType === 'RAIDERS') s *= 2;
        if (sectorFront === 'QUIET_ROADS' && currentNodeType === 'BOSS') s *= 2;
        if (hasRelic('VULTURE_ROYALTY')) s = Math.floor(s * 0.75);
        if (hasRelic('SCRAP_MAGNET')) s += 15;
        if (hasRelic('SCAVENGERS_DEBT')) s += 40;
        
        // Deployed survivors earn full XP; the bench trains at half rate so reserves stay
        // rotatable instead of falling permanently behind. Downed units earn nothing.
        playerRoster.forEach(char => {
            const base = Math.floor((22 + currentTier * 5) * scrapMult * sectorRewardMult());
            if (char.gridPos > 0 && char.hp > 0) awardXp(char, base);
            else if (char.gridPos === 0) awardXp(char, Math.floor(base * RESERVE_XP_RATE));
        });

        let matDrops = (1 + Math.floor(Math.random() * 2)) * scrapMult + (hasRelic('SALVAGE_RIG') ? 1 : 0);
        for(let i=0; i<matDrops; i++) {
            let m = ['parts', 'chems', 'tech'][Math.floor(Math.random() * 3)];
            const paired = (sectorFront === 'MACHINE_UPRISING' && m === 'tech') || (sectorFront === 'IRRADIATED' && m === 'chems');
            materials[m] += paired ? 2 : 1;
            log(`> Salvaged: ${paired ? 2 : 1} ${m.toUpperCase()}`, "log-heal");
        }

        document.getElementById('command-deck').innerHTML = `<button data-action="loot" data-amount="${s}">LOOT ${s}</button>`; combatActive = false; stopAmbience(); 
    } 
    else if (pressExtra && turnQueue[activeIndex] && turnQueue[activeIndex].isPlayer && turnQueue[activeIndex].hp > 0) {
        // A pressed operator holds the floor: the queue stays put and the deck re-opens.
        pressExtra = false;
        log(`> ${turnQueue[activeIndex].name} presses the advantage.`, 'log-combo');
        renderField();
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
            if (reg.active) reg.active.postMessage({ type: 'CACHE_ART', urls: ASSET_LIST.filter(a => !PENDING_ART.includes(a)) });
        } catch (e) { /* offline play is a bonus, never a requirement */ }
    });
}

// --- Inspection surface -------------------------------------------------------------
// game.js is an ES module, so nothing above reaches window on its own. This is the single
// deliberate exception: one namespaced object the headless suites drive the engine through.
// Nothing in the game itself reads it - if you are adding a feature, you do not need it.
globalThis.WP = {
    // entry points and pure helpers the suites exercise
    EXTRACT, extractBonus, extractSkulls, canExtract, extractRun, extractPitch, armExtract, renderCamp,
    bossRetinueUp, GRUDGE, RISEN_MARK, grudgeOn, noteGrudge, risenName, risenShort, openGrudgePhase,
    BLEED_OUT, DRAGGED_CLEAR, REACHES_THE_DOWN, isDown, bleedingOut, goDown, tickBleedOut,
    loseOperator, recoverDowned, closeRanks,
    RECRUIT_POOL, RECRUIT_COST, RECRUIT_HEALTH, recruitCost, recruitables, recruitById, recruitReach,
    initiateRecruit, renderRecruit, recruitCardHtml, signOnRecruit, leaveRecruit,
    haulForward, HAUL_TO, FIEND_CHARGE_COST, CHARGE_TURNS, CHARGE_MULT,
    initEngine, renderTitleScreen, renderCitadel, renderMap, renderOutpost, openSettings, closeSettings, selectSlot, confirmNewGame, continueGame, saveGameState, loadGameState, saveMeta, loadMeta, buyMetaUpgrade, advanceSector, renderCodex, vaultDescText, executeSelfAction, resolveConsumableItem, spendTactic, stimTarget, overdriveFor, withdraw, withdrawCost, canWithdraw, disarmWithdraw, WITHDRAW, retreat, retreatCost, retreatOdds, canRetreat, fallBackToNode, RETREAT, depthIndex, buildNewRun, renderMuster, musterRank, musterReroll, musterDeploy, generateSectorMap, validateSectorMap, rollNodeFaction, availableNodeIds, reachableNodeIds, enterNode, nodeById, hasContract, canCarry, craftItem, assignSlot, contractMult, contractNames, openContracts, toggleContract, renderContracts, beginExpedition, initiateEvent, pickEvent, initiateCamp, bookConsequence, consequencesDue, resolveConsequence, deployed, initiateCombat, resumeCombat, generateEnemies, renderField, fitEnemyRow, checkWinState, processTurn, executeEnemyAi, applyDamageHit, applyTurnStartEffects, handleSquadWipe, endRun, renderRunOver, collectLoot, CAST, STANDING_BANDS, FOLLOWUPS, castOf, castStanding, hasMetCast, meetCast, noteCast, standingBand, castName, facesMet, owesVela, eventDesc, choicesFor, renderCastTag, eventWeight, FACE_RETURN_WEIGHT, DEBT_TERM, STANDING_POOL, rollStanding, noteFightWon, newFightLog, BLITZ_TURNS, OVERKILL_AT, TERRAIN, TERRAIN_IDS, GROUND_CHANCE, ground, terrainName, groundReach, backlineWeight, enemyStrike, isAoe, MOVE_AOE, emptyPoolScrap, hasRelic, unownedRelics, rollRelic, rollRelicOffer, renderRelicOffer, takeRelic, overdriveAt, heirloomFrom, heirloomRelic, stashHeirloom, generateBounties, rollBounty, checkBountyProgress, assignPerk, comboFor, comboHint, COMBOS, DAMAGING_MOVES, hasQuirk, quirkDmgMult, hasTrait, traitOnField, rollPerkOffer, renderPerkOffer, takePerkOffer, bankPerkOffer, tacticCost, gearById, hasMod, hasTrinket, moveReachFor, cdFor, rollGear, equipGear, unequipGear, shopPrice, rollShopStock, initiateShop, renderShop, buyShopItem, shopRerollQuirk, finishShop, bondKey, bondName, bondCount, bondLevel, bondDmgMult, bondSavior, bondOverdriveDiscount, recordBonds, bondLineFor, BOND_NAMES, BOND_LEVELS, FRONTS, frontById, currentFront, rollFront, frontFactionBias, mulberry32, seedFromString, seededRng, dailySeed, seedBests, noteSeedBest, SEED_BEST_KEY, RELIC_SETS, relicSetActive, announceSets, operatorCardHtml, motionOff, applyTextScale, applyVolumes, audioState, sfxVol, ambVol, volName, cycleVol, VOL_STEPS, VOL_NAMES, MOTION_MODES, TEXT_STEPS, cycleSfx, cycleAmbience, cycleMotion, cycleTextScale, updateSettingsUI, flashClass, pulseIntent, playAttackAnim, armPortraitFallback, PORTRAIT_FALLBACK, sigOf, hasSig, enemyDmgMult, venomDose, carrionStanding, TEEMING_FLOOR, portraitFor, fireOverwatch, bestiaryEntry, noteBestiary, hasMet, firePrompt, renderPrompt, dismissPrompt, disablePrompts, promptSeen, PROMPTS, mitigate, forecastFor, threatBoard, explainHtml, renderExplain, openExplain, closeExplain, bestiaryRoster, bestiaryRecord, unlockDepth, typeNameOf, dossierHtml, renderDossier, openDossier, closeDossier, chronicleKey, careerKey, readChronicle, readCareer, writeChronicle, epitaphFor, latestEpitaph, renderChronicle, masteryXp, masteryRank, noteMastery, quirkPoolFor, deckFor, MASTERY_RANKS, MASTERY_TITLES, CLASS_QUIRKS, FOURTH_ABILITIES, PROTOCOLS, unlockedProtocols, protocolMult, protocolName, bossOrder, reachMult, reachNote, isOutOfDepth, isMelee, isRanged, pickTarget, renderCommandDeck, queueAction, cancelAction, resolveAction, renderDev, devJump, devFightBoss, devGive, devResolve, bossForSector, rollIntent, regroupSquad, regroupsLeft, totalRegroups, renderSquadBroken, migrateAssetPaths, migrateRelics, traitSummary, migrateTraits, buyUpgrade, computeScore, newRunStats, noteDepth, sectorRewardMult, formatStat, awardXp, log, playSFX, playImpact, voiceFor, startAmbience, stopAmbience, ambienceFor, initAudio, addMomentum, setOutpostTab,
    IMPACT_TIERS, SOAK_AT, WEAK_AT, MARK_DELAY, DEATH_DELAY, impactVoice, impactMark, HEAT_FLOOR, PULSE_SLOW, PULSE_FAST,
    ambienceHeat, ambienceState, playMote, scheduleMote, voiceLift, VOICE_FLOOR,
    // engine constants
    Store, CORRUPT, PERK_POOL, ABILITIES, ENEMY_SIGS, ENEMY_POOL, CITADEL_SPOTS, CODEX, SFX, CLASS_VOICE, MOVE_VOICE_OVERRIDE, AMBIENCE, SFX_LOG_MAX, CONTRACT_POOL, EVENT_POOL, CONSEQUENCE_POOL, EVENT_MEMORY, SIG_PERKS, GEAR_POOL, QUIRK_POOL, MUSTER_REROLLS, MOMENTUM_TACTICS, OVERDRIVES, ELITE_TIERS, MAP_COL_X, MAP_ROW_H, WEATHER_DOTS, EMPTY_POOL_SCRAP, OVERDRIVE_AT, OVERDRIVE_AT_CHARGED, MOVE_REACH, RANK_LABELS, INTENT_ICONS, REACH_PENALTY, DEPTH_PENALTY, FRONT_RANKS, BACKLINE_WEIGHT, GROUND_LIFT, RELIC_POOL, BOSS_POOL, BOSS_PASSIVES, resistBadges, STATUSES, statusChips, dispatchAction, SECTOR_HP_SCALE, SECTOR_DMG_SCALE, XP_CURVE, BASE_SAVE_KEY, SETTINGS_KEY, META_KEY, TOTAL_TIERS, SECTOR_TIER_BONUS, HEAVY_RAMP, TIER_HP_GROWTH, TIER_DMG_GROWTH, BASE_REGROUPS, ARMORY_CUT, BOARD_SLOTS, boardSlots, spotUnlocked, spotMaxed, spotState, FACTION_ALLIES, FACTIONS, FIGHT_NODES, factionsAt, RESERVE_XP_RATE, ASSET_LIST, PENDING_ART, ACTIONS, BOUNTY_POOL, ROSTER_TEMPLATE,
    // live run state, readable and writable so a suite can set up a scenario
    get audioCtx() { return audioCtx; }, set audioCtx(v) { audioCtx = v; },
    get sfxLog() { return sfxLog; }, set sfxLog(v) { sfxLog = v; },
    // settable so the mix can be rendered offline and measured rather than guessed at
    get sfxBus() { return sfxBus; }, set sfxBus(v) { sfxBus = v; },
    get ambBus() { return ambBus; }, set ambBus(v) { ambBus = v; },
    get ambienceBiome() { return ambienceBiome; },
    get ambienceNodes() { return ambienceNodes; },
    get ambienceBg() { return ambienceBg; },
    get ambienceHeatLevel() { return ambienceHeatLevel; },
    get ambienceMotes() { return ambienceMotes; }, set ambienceMotes(v) { ambienceMotes = v; },
    get currentSlot() { return currentSlot; }, set currentSlot(v) { currentSlot = v; },
    get globalSettings() { return globalSettings; }, set globalSettings(v) { globalSettings = v; },
    get bossSkulls() { return bossSkulls; }, set bossSkulls(v) { bossSkulls = v; },
    get grudges() { return grudges; }, set grudges(v) { grudges = v; },
    get extractArmed() { return extractArmed; }, set extractArmed(v) { extractArmed = v; },
    get metaUpgrades() { return metaUpgrades; }, set metaUpgrades(v) { metaUpgrades = v; },
    get scrap() { return scrap; }, set scrap(v) { scrap = v; },
    get currentTier() { return currentTier; }, set currentTier(v) { currentTier = v; },
    get sectorMap() { return sectorMap; }, set sectorMap(v) { sectorMap = v; },
    get currentNodeId() { return currentNodeId; }, set currentNodeId(v) { currentNodeId = v; },
    get clearedNodeIds() { return clearedNodeIds; }, set clearedNodeIds(v) { clearedNodeIds = v; },
    get forecastWeather() { return forecastWeather; }, set forecastWeather(v) { forecastWeather = v; },
    get currentSector() { return currentSector; }, set currentSector(v) { currentSector = v; },
    get difficultyMult() { return difficultyMult; }, set difficultyMult(v) { difficultyMult = v; },
    get inventory() { return inventory; }, set inventory(v) { inventory = v; },
    get materials() { return materials; }, set materials(v) { materials = v; },
    get tuneUpBattles() { return tuneUpBattles; }, set tuneUpBattles(v) { tuneUpBattles = v; },
    get activeBounties() { return activeBounties; }, set activeBounties(v) { activeBounties = v; },
    get standingBounty() { return standingBounty; }, set standingBounty(v) { standingBounty = v; },
    get fightLog() { return fightLog; }, set fightLog(v) { fightLog = v; },
    get chasedIn() { return chasedIn; }, set chasedIn(v) { chasedIn = v; },
    get momentum() { return momentum; }, set momentum(v) { momentum = v; },
    get momentumFocus() { return momentumFocus; }, set momentumFocus(v) { momentumFocus = v; },
    get pressExtra() { return pressExtra; }, set pressExtra(v) { pressExtra = v; },
    get odChoices() { return odChoices; }, set odChoices(v) { odChoices = v; },
    get pendingOverdrive() { return pendingOverdrive; }, set pendingOverdrive(v) { pendingOverdrive = v; },
    get activeRelics() { return activeRelics; }, set activeRelics(v) { activeRelics = v; },
    get activeShop() { return activeShop; }, set activeShop(v) { activeShop = v; },
    get pendingRecruit() { return pendingRecruit; }, set pendingRecruit(v) { pendingRecruit = v; },
    get vacatedRanks() { return vacatedRanks; }, set vacatedRanks(v) { vacatedRanks = v; },
    get bonds() { return bonds; }, set bonds(v) { bonds = v; },
    get bondSavesUsed() { return bondSavesUsed; }, set bondSavesUsed(v) { bondSavesUsed = v; },
    get sectorFront() { return sectorFront; }, set sectorFront(v) { sectorFront = v; },
    get runSeed() { return runSeed; }, set runSeed(v) { runSeed = v; },
    get mastery() { return mastery; }, set mastery(v) { mastery = v; },
    get bestiary() { return bestiary; }, set bestiary(v) { bestiary = v; },
    get bossSalt() { return bossSalt; }, set bossSalt(v) { bossSalt = v; },
    get seenPrompts() { return seenPrompts; }, set seenPrompts(v) { seenPrompts = v; },
    get promptQueue() { return promptQueue; }, set promptQueue(v) { promptQueue = v; },
    get hitLog() { return hitLog; }, set hitLog(v) { hitLog = v; },
    get explaining() { return explaining; }, set explaining(v) { explaining = v; },
    get inspecting() { return inspecting; }, set inspecting(v) { inspecting = v; },
    get ascension() { return ascension; }, set ascension(v) { ascension = v; },
    get bestSector() { return bestSector; }, set bestSector(v) { bestSector = v; },
    get frontBannerPending() { return frontBannerPending; }, set frontBannerPending(v) { frontBannerPending = v; },
    get regroupInsured() { return regroupInsured; }, set regroupInsured(v) { regroupInsured = v; },
    get shopRerollPick() { return shopRerollPick; }, set shopRerollPick(v) { shopRerollPick = v; },
    get pendingRelicOffer() { return pendingRelicOffer; }, set pendingRelicOffer(v) { pendingRelicOffer = v; },
    get combatBgFile() { return combatBgFile; }, set combatBgFile(v) { combatBgFile = v; },
    get pendingCombat() { return pendingCombat; }, set pendingCombat(v) { pendingCombat = v; },
    get pursuit() { return pursuit; }, set pursuit(v) { pursuit = v; },
    // Kept as the boolean the withdraw suite reads, derived from the one armed slot so the two
    // ways out cannot both be armed at once.
    get withdrawArmed() { return armedExit === 'WITHDRAW'; }, set withdrawArmed(v) { armedExit = v ? 'WITHDRAW' : null; },
    get armedExit() { return armedExit; }, set armedExit(v) { armedExit = v; },
    get retreatNode() { return retreatNode; }, set retreatNode(v) { retreatNode = v; },
    get runStats() { return runStats; }, set runStats(v) { runStats = v; },
    get activeContracts() { return activeContracts; }, set activeContracts(v) { activeContracts = v; },
    get pendingDifficulty() { return pendingDifficulty; }, set pendingDifficulty(v) { pendingDifficulty = v; },
    get musterRerolls() { return musterRerolls; }, set musterRerolls(v) { musterRerolls = v; },
    get gearStash() { return gearStash; }, set gearStash(v) { gearStash = v; },
    get pendingPerkOffers() { return pendingPerkOffers; }, set pendingPerkOffers(v) { pendingPerkOffers = v; },
    get activeGearSelector() { return activeGearSelector; }, set activeGearSelector(v) { activeGearSelector = v; },
    get activeEvent() { return activeEvent; }, set activeEvent(v) { activeEvent = v; },
    get pendingConsequences() { return pendingConsequences; }, set pendingConsequences(v) { pendingConsequences = v; },
    get recentEvents() { return recentEvents; }, set recentEvents(v) { recentEvents = v; },
    get currentTerrain() { return currentTerrain; }, set currentTerrain(v) { currentTerrain = v; },
    get forecastTerrain() { return forecastTerrain; }, set forecastTerrain(v) { forecastTerrain = v; },
    get castState() { return castState; }, set castState(v) { castState = v; },
    get firedEvents() { return firedEvents; }, set firedEvents(v) { firedEvents = v; },
    get activeChoices() { return activeChoices; }, set activeChoices(v) { activeChoices = v; },
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

// Wasteland Protocol engine. An ES module (strict by default, deferred by default), so
// none of its declarations leak onto window - the markup reaches the engine only through
// data-action attributes, never by calling a global. See the inspection surface at the
// foot of this file for the one deliberate export.

const ASSET_LIST = [
    "bg_title.webp", "bg_combat.webp", "bg_thunderdome.webp", "bg_refinery.webp", "bg_highway.webp", "bg_canyon.webp", "bg_foundry.webp", "bg_nest.webp",
    "hero_bruiser.webp", "hero_medic.webp", "hero_scavenger.webp", "hero_pyro.webp", "hero_shotgunner.webp", "hero_sniper.webp", "hero_hound.webp",
    "enemy_dog.webp", "enemy_mutant.webp", "enemy_chem.webp", "enemy_raider.webp", "enemy_psycho.webp", "enemy_sniper.webp", "enemy_juggernaut.webp", "enemy_drone.webp", "enemy_turret.webp", "enemy_warrig.webp", "enemy_boss.webp", "enemy_boss_mech.webp", "enemy_boss_vulture.webp"
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
let globalSettings = { combatSpeed: 1.0, sfx: true };

let bossSkulls = 0; let metaUpgrades = { startScrap: 0, startLevel: 1, invMax: 4, extraRegroups: 0, vault: 0, heirloom: null };
let scrap = 0; let currentTier = 1; let currentSector = 1; let difficultyMult = 1.0; 
let inventory = []; let materials = { parts: 0, chems: 0, tech: 0 }; 
let tuneUpBattles = 0; 
let activeBounties = []; 
let momentum = 0;
let activeRelics = []; let pendingRelicOffer = null;

let combatBgFile = 'bg_combat.webp'; let pendingCombat = null;
let runStats = null;
let activeEvent = null; let pendingConsequences = []; let recentEvents = []; let activeContracts = []; let pendingDifficulty = 1.0;
let activePosSelector = null; let activePerkSelector = null; let currentWeather = 'CLEAR'; let currentNodeType = '';
let isCurrentNodeElite = false;

const QUIRK_POOL = [
    { id: 'RECKLESS', name: 'RECKLESS (+5 DMG, -15 HP)', dmg: 5, hp: -15, spd: 0 },
    { id: 'TWITCHY', name: 'TWITCHY (+3 SPD, -10 HP)', dmg: 0, hp: -10, spd: 3 },
    { id: 'STURDY', name: 'STURDY (+20 HP, -2 SPD)', dmg: 0, hp: 20, spd: -2 },
    { id: 'VAMPIRIC', name: 'VAMPIRIC (Heal 2 HP on Hit)', dmg: 0, hp: 0, spd: 0 },
    { id: 'LETHARGIC', name: 'LETHARGIC (+8 DMG, -3 SPD)', dmg: 8, hp: 0, spd: -3 }
];

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

// One Warlord fought at every depth made the back half of a run repetitive, so each sector
// now draws a different commander. They differ in more than numbers: what they intend to do,
// what they do passively, and what happens when you break them past half health.
const BOSS_POOL = [
    {
        id: 'WARLORD', name: 'Warlord', short: 'WARLORD', img: 'enemy_boss.webp', scale: 2.2,
        range: 'melee', hpMult: 1.0, dmgMult: 1.0, speed: 9, armor: 15,
        resistances: { phys: 10, bio: 5, energy: 5 },
        blurb: 'A raider chieftain who fights alongside their pack.',
        bg: 'bg_thunderdome.webp',
        banner: '\uD83D\uDC80 THUNDERDOME BLOODLUST: All units deal +20% DMG \uD83D\uDC80',
        intents: [['ATTACK', 0.30], ['AOE', 0.20], ['HEAVY', 0.20], ['STATUS', 0.20], ['DEFEND', 0.10]],
        enrage: { cry: 'WARLORD ENRAGED - THE PACK ANSWERS!', dmgScale: 1.5,
                  summon: { name: 'War Hound', classType: 'BEAST', range: 'melee', hp: 30, dmg: 12, speed: 18,
                            img: 'enemy_dog.webp', scale: 0.8, resistances: { phys: -2, bio: 0, energy: 0 } },
                  summonCount: 2 }
    },
    {
        id: 'COLOSSUS', name: 'Siege Colossus', short: 'COLOSSUS', img: 'enemy_boss_mech.webp', scale: 2.4,
        range: 'ranged', hpMult: 1.3, dmgMult: 0.8, speed: 5, armor: 30,
        resistances: { phys: 18, bio: 100, energy: -15 },
        passive: 'PLATING',
        blurb: 'A walking battery. Immune to toxins, and it re-plates itself between salvoes.',
        bg: 'bg_foundry.webp',
        banner: '\uD83D\uDD25 FOUNDRY HEAT: All units deal +20% DMG \uD83D\uDD25',
        intents: [['AOE', 0.35], ['ATTACK', 0.30], ['DEFEND', 0.20], ['HEAVY', 0.15]],
        enrage: { cry: 'SIEGE PROTOCOL ENGAGED - ALL BATTERIES', dmgScale: 1.15, armorBonus: 20, forceAoe: true,
                  summon: { name: 'Sentry Drone', classType: 'DRONE', range: 'ranged', hp: 25, dmg: 8, speed: 18,
                            img: 'enemy_drone.webp', scale: 0.7, isHovering: true,
                            resistances: { phys: 8, bio: 100, energy: -10 } },
                  summonCount: 2 }
    },
    {
        id: 'MATRIARCH', name: 'Carrion Matriarch', short: 'MATRIARCH', img: 'enemy_boss_vulture.webp', scale: 2.1,
        range: 'melee', hpMult: 0.85, dmgMult: 1.1, speed: 17, armor: 5,
        resistances: { phys: -6, bio: 40, energy: 5 },
        dmgType: 'bio', passive: 'FEAST', sink: 16,
        blurb: 'Fast, diseased, and it grows stronger off every wound it opens.',
        bg: 'bg_nest.webp',
        banner: '\u2620\uFE0F CARRION REEK: All units deal +20% DMG \u2620\uFE0F',
        intents: [['STATUS', 0.35], ['HEAVY', 0.25], ['ATTACK', 0.25], ['AOE', 0.15]],
        enrage: { cry: 'THE MATRIARCH SHRIEKS - PLAGUE WIND!', dmgScale: 1.25, speedBonus: 4, plague: true }
    }
];

// Rotates by sector so a run meets a different commander each time rather than the same one
// ten times over.
function bossForSector(sector = currentSector) { return BOSS_POOL[(Math.max(1, sector) - 1) % BOSS_POOL.length]; }

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
    { id: 'OVERCHARGED_CELL',  tier: 'RARE',   name: "Overcharged Cell",  desc: "Overdrive charges at 80% momentum." }
];
// A run deep enough to own the whole pool still gets paid for the fight, on the same curve as
// every other reward - a flat figure would be worth nothing by the depth it starts appearing at.
const EMPTY_POOL_SCRAP = 150;
function emptyPoolScrap() { return Math.floor(EMPTY_POOL_SCRAP * sectorRewardMult()); }
const OVERDRIVE_AT = 100;
const OVERDRIVE_AT_CHARGED = 80;

function hasRelic(id) { return activeRelics.some(r => r.id === id); }
function overdriveAt() { return hasRelic('OVERCHARGED_CELL') ? OVERDRIVE_AT_CHARGED : OVERDRIVE_AT; }
function unownedRelics(tier) {
    return RELIC_POOL.filter(r => !hasRelic(r.id) && (!tier || r.tier === tier));
}

// An elite drops one, leaning common; a rare is the thing worth hoping for rather than the norm.
function rollRelic(rareChance = 0.3) {
    const wantRare = Math.random() < rareChance;
    const first = unownedRelics(wantRare ? 'RARE' : 'COMMON');
    const pool = first.length ? first : unownedRelics();
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
    return out;
}

// Read bottom-up: the last row is tier 1, the first row is the boss. The only elite sat at
// tier 9, one row below the commander, so a sector offered exactly one elite fight and it came
// right at the end. A second one mid-sector gives a run two chances at a relic - and makes the
// board's 'defeat 2 elite squads' contract possible, which it was not before.
const SECTOR_LAYOUT = [
    [{type:'BOSS', elite:false}], 
    [{type:'RAIDERS', elite:true}, {type:'BEASTS', elite:false}], 
    [{type:'MECH', elite:false}, {type:'RAIDERS', elite:false}],   
    [{type:'EVENT', elite:false}, {type:'RAIDERS', elite:false}], 
    [{type:'MECH', elite:true}, {type:'BEASTS', elite:false}], 
    [{type:'CAMP', elite:false}, {type:'BEASTS', elite:false}, {type:'RAIDERS', elite:false}], 
    [{type:'MECH', elite:false}, {type:'RAIDERS', elite:false}],   
    [{type:'EVENT', elite:false}, {type:'CAMP', elite:false}], 
    [{type:'BEASTS', elite:false}, {type:'RAIDERS', elite:false}], 
    [{type:'RAIDERS', elite:false}] 
];
const TOTAL_TIERS = SECTOR_LAYOUT.length;
const SECTOR_TIER_BONUS = 3;
const BASE_REGROUPS = 2;       // second chances per run, before a defeat ends it
const FACTION_ALLIES = { RAIDERS: ['MECH', 'BEASTS'], BEASTS: [], MECH: [] };
// Difficulty still climbs hard, but through lethality rather than bullet sponges: health
// tracks player damage growth so a fight stays ~10 rounds at any depth, while damage
// outpaces player health so a run reliably ends somewhere around sector 10.
const SECTOR_HP_SCALE = 1.25;
const SECTOR_DMG_SCALE = 1.32;
const XP_CURVE = 1.35;         // was 1.5 - levels kept stalling, starving the perk economy

// Some choices should not settle on the screen that offered them. An event can book a
// consequence a sector or two out; it comes due when the run reaches that depth, whether or not
// the player still remembers agreeing to it.
const CONSEQUENCE_POOL = {
    DEBT: {
        title: "THE COLLECTOR FINDS YOU",
        resolve: (c) => {
            const owed = c.amount || 0;
            if (scrap >= owed) { scrap -= owed; return `You settle up. ${owed} Scrap changes hands and the crew moves on.`; }
            const short = owed - scrap; scrap = 0;
            deployed().forEach(u => { u.hp = Math.max(1, u.hp - Math.floor(u.maxHp * 0.15)); });
            return `You are ${short} Scrap short. They take what you have, and a payment in bruises.`;
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
        title: "A DEBT REPAID",
        resolve: () => {
            deployed().forEach(u => { u.hp = u.maxHp; });
            const m = ['parts', 'chems', 'tech'][Math.floor(Math.random() * 3)];
            materials[m] += 2; scrap += 60;
            return `The scavenger you patched up finds your camp with a full kit. Everyone is treated, and they leave 60 Scrap and 2 ${m}.`;
        }
    }
};

function deployed() { return playerRoster.filter(p => p.gridPos > 0 && p.hp > 0); }

// Booked against a sector rather than a node count, so it reads the same to the player as the
// event that promised it: "two sectors from now".
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
    const text = spec.resolve(c);
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
        'Momentum builds as the squad takes and deals damage.',
        `At ${OVERDRIVE_AT}% any operator can spend it on their Overdrive - a class-specific attack that ends the fight or turns it.`,
        `Overcharged Cell lowers that to ${OVERDRIVE_AT_CHARGED}%.`,
        'Spending it empties the bar.'
    ] },
    { id: 'RUN', title: 'THE EXPEDITION', body: () => [
        `${TOTAL_TIERS} tiers to a sector, one node per tier, and a commander at the top.`,
        'Two elite nodes per sector, each beside a normal one, so taking them is a choice. An elite drops a relic.',
        'A commander drops a choice of three.',
        `A wipe spends a regroup - ${BASE_REGROUPS} to start, more from the Citadel. Out of regroups ends the run and banks the score.`,
        'Depth is worth far more than any single haul: pushing one sector deeper always beats farming the one you are on.'
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
    { title: "WANDERING TINKER", desc: "A hooded cyborg sits by a campfire. They gesture toward a pile of tactical gear and hold out a mechanical hand.", choices: [ { label: "Trade Scrap for Bomb (Cost: 40 Scrap)", canAfford: () => scrap >= 40 && canCarry(), execute: () => { scrap -= 40; inventory.push('SCRAP_BOMB'); checkBountyProgress('CRAFT'); playSFX('click'); return "Acquired 1 Scrap Bomb."; } }, { label: "Trade Parts for Tech (Cost: 2 Parts)", canAfford: () => materials.parts >= 2, execute: () => { materials.parts -= 2; materials.tech += 1; playSFX('click'); return "Traded 2 Parts for 1 Tech."; } }, { label: "Decline", canAfford: () => true, execute: () => { return "You nod respectfully and continue walking."; } } ] },
    { title: "RADIATION STORM", desc: "The geiger counter screams. A violent wall of radioactive dust is rapidly approaching your position.", choices: [ { label: "Sprint Through (-10 HP to All Deployed)", canAfford: () => true, execute: () => { playerRoster.forEach(p => { if(p.gridPos > 0 && p.hp > 0) p.hp = Math.max(1, p.hp - 10); }); playSFX('hit'); triggerShake(); return "The squad powered through, but took heavy radiation burns."; } }, { label: "Deploy EMP Shield (-1 EMP Charge)", canAfford: () => inventory.includes('EMP_CHARGE'), execute: () => { inventory.splice(inventory.indexOf('EMP_CHARGE'), 1); playSFX('heal'); return "The EMP Charge detonated, creating a localized magnetic shield against the storm."; } } ] },

    { title: "THE DEBT COLLECTOR", desc: "A fixer in a rebreather deals cards on the hood of a burnt-out truck. She does not look up. 'Everyone out here needs something. I need to be paid back.'",
      choices: [
        { label: "Borrow 200 Scrap (owe 400 in two sectors)", canAfford: () => true,
          execute: () => { scrap += 200; bookConsequence('DEBT', 2, { amount: 400 }); playSFX('click');
            return "She counts out 200 Scrap without looking at you. 'Two sectors. Four hundred.'"; } },
        { label: "Sell her a favour instead (+80 Scrap, -1 Tech)", canAfford: () => materials.tech >= 1,
          execute: () => { materials.tech -= 1; scrap += 80; playSFX('click');
            return "She takes the component, turns it over once, and pays you 80 Scrap for it."; } },
        { label: "Walk away", canAfford: () => true, execute: () => "She deals another hand. 'Smart. Most of them aren't.'" }
      ] },

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

    { title: "THE SURVIVOR", desc: "A scavenger is propped against a wheel rim, one leg opened to the bone. They have a rifle across their lap and no rounds left for it.",
      choices: [
        { label: "Patch them up (-2 Chems)", canAfford: () => materials.chems >= 2,
          execute: () => { materials.chems -= 2; bookConsequence('SURVIVOR', 2); playSFX('heal');
            return "You seal the leg and leave them water. They ask for your route. 'I pay what I owe.'"; } },
        { label: "Take the rifle (+50 Scrap)", canAfford: () => true,
          execute: () => { scrap += 50; playSFX('click');
            return "The rifle is worth 50 Scrap to the right buyer. They watch you take it and say nothing."; } },
        { label: "Leave them the water and go", canAfford: () => true,
          execute: () => "You set the canteen down within reach and move on." }
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

const ROSTER_TEMPLATE = [
    { id: 'p1', name: "Bruiser", classType: "BRUISER", maxHp: 80, hp: 80, speed: 8, armor: 0, isPlayer: true, dmgBase: 20, img: "hero_bruiser.webp", scale: 1.15, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 5, bio: 0, energy: 0 }, upgradeCount: 0, gridPos: 1, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { heavy_wrench: 0, iron_guard: 0 } },
    { id: 'p2', name: "Medic", classType: "MEDIC", maxHp: 50, hp: 50, speed: 12, armor: 0, isPlayer: true, dmgBase: 10, img: "hero_medic.webp", scale: 1.6, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 10, energy: 0 }, upgradeCount: 0, gridPos: 2, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { cauterize: 0 } },
    { id: 'p3', name: "Scavenger", classType: "SCAVENGER", maxHp: 45, hp: 45, speed: 15, armor: 0, isPlayer: true, dmgBase: 15, img: "hero_scavenger.webp", scale: 1.25, hpDrop: -25, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 5 }, upgradeCount: 0, gridPos: 3, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { flashbang: 0, acid_flask: 0 } },
    { id: 'p4', name: "Pyro", classType: "PYROMANIAC", maxHp: 55, hp: 55, speed: 11, armor: 0, isPlayer: true, dmgBase: 12, img: "hero_pyro.webp", scale: 1.1, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 10 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { molotov: 0, thermite: 0 } },
    { id: 'p5', name: "Breacher", classType: "SHOTGUNNER", maxHp: 65, hp: 65, speed: 9, armor: 5, isPlayer: true, dmgBase: 22, img: "hero_shotgunner.webp", scale: 1.15, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 5, bio: 0, energy: 0 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { buckshot: 0, execute_shot: 0 } },
    { id: 'p6', name: "Ghost", classType: "SNIPER", maxHp: 40, hp: 40, speed: 16, armor: 0, isPlayer: true, dmgBase: 28, img: "hero_sniper.webp", scale: 0.9, hpDrop: -10, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { deadeye: 0, spotters_mark: 0 } },
    { id: 'p7', name: "War Hound", classType: "HOUND", maxHp: 35, hp: 35, speed: 19, armor: 0, isPlayer: true, dmgBase: 16, img: "hero_hound.webp", scale: 0.8, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: -2, bio: 10, energy: 0 }, upgradeCount: 0, gridPos: 0, level: 1, xp: 0, xpToNext: 100, perkPoints: 0, traits: [], augments: [], quirk: null, cooldowns: { feral_bite: 0, rip_and_tear: 0 } }
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
    'new-game':         el => openContracts(parseFloat(el.dataset.diff)),
    'slot':             el => selectSlot(Number(el.dataset.slot), el.dataset.exists === '1'),
    'buy-meta':         el => buyMetaUpgrade(el.dataset.kind),
    'take-relic':       el => takeRelic(Number(el.dataset.index)),
    'toggle-contract':  el => toggleContract(el.dataset.id),
    'begin-expedition': () => beginExpedition(),
    'codex':            () => renderCodex(),
    'erase-slot':       el => { Store.remove(BASE_SAVE_KEY + Number(el.dataset.slot)); renderTitleScreen(); },
    'dev-open':         () => renderDev(),
    'dev-exit':         () => renderMap(),
    'dev-sector':       el => devJump(Number(el.dataset.delta), 0),
    'dev-tier':         el => devJump(0, Number(el.dataset.delta)),
    'dev-boss':         el => devFightBoss(el.dataset.boss),
    'dev-fight':        el => { currentTier = Math.min(currentTier, TOTAL_TIERS); initiateCombat(el.dataset.type, el.dataset.elite === '1'); },
    'dev-node':         el => { el.dataset.kind === 'EVENT' ? initiateEvent() : initiateCamp(); },
    'dev-give':         el => devGive(el.dataset.kind),
    'dev-win':          () => devResolve(true),
    'dev-lose':         () => devResolve(false),
    'regroup':          () => regroupSquad(),
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
    'consequence-ack':  () => resolveConsequence(),
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
    // outcomes
    hit:      { wave: 'triangle', from: 200,  to: 55,  dur: 0.12, gain: 0.09 },
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
    PYROMANIAC: 'flame', SHOTGUNNER: 'shotgun', SNIPER: 'rifle', HOUND: 'beast' };
const MOVE_VOICE_OVERRIDE = { HEAVY_WRENCH: 'heavy', SCRAP_BLADE: 'blade', SLUG_SHOT: 'rifle',
    MOLOTOV: 'flame', THERMITE: 'flame', ACID_FLASK: 'flame', SNAP: 'beast' };

function voiceFor(move) {
    if (MOVE_VOICE_OVERRIDE[move]) return MOVE_VOICE_OVERRIDE[move];
    const owner = Object.keys(ABILITIES).find(c => ABILITIES[c].some(a => a.move === move));
    return CLASS_VOICE[owner] || 'blade';
}

// A short bounded record of what was played. Nothing in the game reads it - it is here so the
// headless suites can tell a shotgun from a rifle without listening to one.
const SFX_LOG_MAX = 40;
let sfxLog = [];

let sfxBus = null, ambienceNodes = null, ambienceBiome = null;

function initAudio() {
    if (!audioCtx && globalSettings.sfx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { console.log('Web Audio API not supported.'); }
    }
    if (audioCtx && !sfxBus) {
        try { sfxBus = audioCtx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(audioCtx.destination); }
        catch (e) { sfxBus = null; }
    }
}

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

// weight 1 is the voice as written; a heavier hit is louder, lower and longer.
function playSFX(type, weight = 1) {
    const spec = SFX[type];
    if (spec) { sfxLog.push({ type, weight: Math.round(weight * 100) / 100 }); if (sfxLog.length > SFX_LOG_MAX) sfxLog.shift(); }
    if (!globalSettings.sfx || !audioCtx || !spec) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (!sfxBus) initAudio();
        if (!sfxBus) return;
        const t = audioCtx.currentTime;
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

// An impact is worth what it took off. A scratch and a boss's opening shell should not land
// with the same thump.
// A low bed under the fight, keyed to where it is happening. Quiet enough to sit behind the
// blips, different enough that a foundry does not sound like a canyon.
const AMBIENCE = {
    'bg_canyon.webp':     { drone: 62,  cutoff: 320, hiss: 0.020, name: 'CANYON' },
    'bg_highway.webp':    { drone: 78,  cutoff: 420, hiss: 0.026, name: 'HIGHWAY' },
    'bg_refinery.webp':   { drone: 48,  cutoff: 260, hiss: 0.032, name: 'REFINERY' },
    'bg_foundry.webp':    { drone: 40,  cutoff: 220, hiss: 0.036, name: 'FOUNDRY' },
    'bg_nest.webp':       { drone: 92,  cutoff: 500, hiss: 0.030, name: 'NEST' },
    'bg_thunderdome.webp':{ drone: 55,  cutoff: 360, hiss: 0.034, name: 'THUNDERDOME' },
    'bg_combat.webp':     { drone: 70,  cutoff: 380, hiss: 0.022, name: 'WASTES' }
};
const DEFAULT_AMBIENCE = AMBIENCE['bg_combat.webp'];

function ambienceFor(bg) { return AMBIENCE[bg] || DEFAULT_AMBIENCE; }

function startAmbience(bg) {
    stopAmbience();
    if (!globalSettings.sfx) return;
    initAudio();
    if (!audioCtx || !sfxBus) return;
    const spec = ambienceFor(bg);
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const t = audioCtx.currentTime;
        const bed = audioCtx.createGain(); bed.gain.setValueAtTime(0, t);
        bed.gain.linearRampToValueAtTime(0.5, t + 1.5);
        bed.connect(sfxBus);

        const osc = audioCtx.createOscillator(); osc.type = 'sine';
        osc.frequency.value = spec.drone;
        const oscGain = audioCtx.createGain(); oscGain.gain.value = 0.035;
        osc.connect(oscGain); oscGain.connect(bed); osc.start(t);

        // Two seconds of noise looped, filtered right down - wind rather than static.
        const frames = Math.floor(audioCtx.sampleRate * 2);
        const buf = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
        const hiss = audioCtx.createBufferSource(); hiss.buffer = buf; hiss.loop = true;
        const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = spec.cutoff;
        const hissGain = audioCtx.createGain(); hissGain.gain.value = spec.hiss;
        hiss.connect(lp); lp.connect(hissGain); hissGain.connect(bed); hiss.start(t);

        ambienceNodes = { bed, osc, hiss };
        ambienceBiome = spec.name;
    } catch (e) { ambienceNodes = null; ambienceBiome = null; }
}

function stopAmbience() {
    if (!ambienceNodes) { ambienceBiome = null; return; }
    try {
        const t = audioCtx.currentTime;
        ambienceNodes.bed.gain.cancelScheduledValues(t);
        ambienceNodes.bed.gain.setValueAtTime(ambienceNodes.bed.gain.value, t);
        ambienceNodes.bed.gain.linearRampToValueAtTime(0.0001, t + 0.4);
        ambienceNodes.osc.stop(t + 0.45);
        ambienceNodes.hiss.stop(t + 0.45);
    } catch (e) {}
    ambienceNodes = null; ambienceBiome = null;
}

function playImpact(dmg, target, scale = 1) {
    const share = target && target.maxHp ? dmg / target.maxHp : 0.1;
    playSFX('hit', (0.6 + Math.min(1.6, share * 4)) * scale);
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
        actEnt.armor += 15; actEnt.armorTurns = 2; actEnt.guardTurns = 2; actEnt.cooldowns.iron_guard = 3;
        // Armour alone only ever protected the Bruiser. Bracing now covers the ranks behind it,
        // which is what gives the front rank a job beyond absorbing whatever walks into it.
        log(`> ${actEnt.name} braces and covers the line behind (+15 ARMOR).`, "log-status");
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
    playerRoster.forEach(p => { p.hp = p.maxHp; p.stunnedTurns = 0; p.bleedingTurns = 0; p.armorTurns = 0; p.armor = 0; p.oiledTurns = 0; });
    scrap = Math.floor(scrap / 2);
    currentTier = 1;
    momentum = 0; addMomentum(0);
    combatActive = false; activeEntities = []; turnQueue = []; pendingCombat = null;
    saveGameState();
    renderMap();
}

function renderSquadBroken() {
    combatActive = false; activeEntities = []; turnQueue = []; pendingCombat = null;
    momentum = 0; addMomentum(0);
    noteDepth();
    const left = regroupsLeft();
    switchScreen('screen-runover');
    document.getElementById('runover-title').innerText = 'SQUAD BROKEN';
    document.getElementById('runover-desc').innerText =
        `The squad is down but the expedition holds. Regrouping costs half your scrap and pushes you back to the start of Sector ${currentSector}.`;
    document.getElementById('runover-score').innerText = `${left} REGROUP${left === 1 ? '' : 'S'} LEFT`;
    document.getElementById('runover-best').innerText = `RUN SCORE SO FAR: ${computeScore(runStats).toLocaleString()} PTS`;
    document.getElementById('runover-lines').innerHTML = [
        ['SCRAP ON HAND', `${scrap} \u2192 ${Math.floor(scrap / 2)}`],
        ['DEPTH REACHED', `SECTOR ${runStats.deepestSector} \u00B7 TIER ${runStats.deepestTier}`],
        ['SKULLS BANKED', `\uD83D\uDC80 ${bossSkulls}`]
    ].map(l => `<div class="runover-line"><span>${l[0]}</span><span>${l[1]}</span></div>`).join('');
    document.getElementById('runover-choices').innerHTML =
        `<button class="event-btn" style="border-color:#6B8E23; color:#6B8E23;" data-action="regroup">REGROUP (${left} LEFT)</button>` +
        `<button class="event-btn" style="border-color:#8B0000; color:#ff6666;" data-action="end-run">END RUN &amp; BANK SCORE</button>`;
    saveGameState();
}

// The run only ends when the player has no regroups left, or chooses to stop.
function endRun() {
    combatActive = false; activeEntities = []; turnQueue = []; pendingCombat = null;
    momentum = 0; addMomentum(0);
    if (!runStats) runStats = newRunStats();
    noteDepth();
    const score = computeScore(runStats);
    const isBest = score > bestScore;
    if (isBest) bestScore = score;
    if (runStats.deepestSector > bestSector) bestSector = runStats.deepestSector;
    stashHeirloom();
    saveMeta();
    Store.remove(BASE_SAVE_KEY + currentSlot);
    renderRunOver(score, isBest);
}

// The Vault keeps one relic across the wipe. Which one is not left to chance or to whichever
// happened to drop first: it takes the best you were holding, rares before commons, and among
// equals the one you found first - so chasing a rare is worth doing on a run you expect to lose.
function heirloomFrom(relics) {
    if (!relics || relics.length === 0) return null;
    return relics.find(r => r.tier === 'RARE') || relics[0];
}
function stashHeirloom() {
    if (!metaUpgrades.vault) return;
    const keep = heirloomFrom(activeRelics);
    metaUpgrades.heirloom = keep ? keep.id : null;
}
function heirloomRelic() {
    if (!metaUpgrades.vault || !metaUpgrades.heirloom) return null;
    return RELIC_POOL.find(r => r.id === metaUpgrades.heirloom) || null;
}

function renderRunOver(score, isBest) {
    switchScreen('screen-runover');
    document.getElementById('runover-title').innerText = 'RUN OVER';
    document.getElementById('runover-desc').innerText = 'The wasteland claimed them. What they salvaged reaches the Citadel.';
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
    // A score is only comparable if it says what it was earned under.
    if (st.contractMult && st.contractMult > 1) {
        lines.push(['CONTRACT BONUS', `x${st.contractMult.toFixed(2)}`]);
        lines.push(['SIGNED FOR', (st.contracts || []).join(', ')]);
    }
    document.getElementById('runover-lines').innerHTML = lines.map(l => `<div class="runover-line"><span>${l[0]}</span><span>${l[1]}</span></div>`).join('');
    document.getElementById('runover-choices').innerHTML =
        `<button class="event-btn" style="border-color:#4488ff; color:#4488ff;" data-action="citadel">CITADEL (\uD83D\uDC80 ${bossSkulls})</button>` +
        `<button class="event-btn" data-action="title">RETURN TO TITLE</button>`;
}

function collectLoot(amount) {
    scrap += amount; if (runStats) { runStats.scrapEarned += amount; runStats.nodes++; }
    currentTier++; noteDepth(); momentum = 0; addMomentum(0);
    activeEntities = []; turnQueue = []; pendingCombat = null; saveGameState();
    // A commander's reward is a decision, so it interrupts the return to the map rather than
    // being resolved silently behind it.
    if (pendingRelicOffer && pendingRelicOffer.length) { renderRelicOffer(); return; }
    renderMap();
}

function renderRelicOffer() {
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
    if (pick && !hasRelic(pick.id)) activeRelics.push(pick);
    pendingRelicOffer = null; saveGameState(); renderMap();
}

let bestScore = 0; let bestSector = 0;

function saveMeta() { Store.set(META_KEY, JSON.stringify({ bossSkulls, metaUpgrades, bestScore, bestSector })); }

function newRunStats() { return { kills: 0, elites: 0, bosses: 0, scrapEarned: 0, nodes: 0, deepestSector: 1, deepestTier: 1, regroups: totalRegroups(), contractMult: contractMult(), contracts: contractNames() }; }

// Endless scoring: depth is worth far more than any single haul, so pushing one sector
// deeper always beats farming the one you are on.
function computeScore(st) {
    if (!st) return 0;
    const base = (st.deepestSector - 1) * 2500
         + ((st.deepestSector - 1) * TOTAL_TIERS + (st.deepestTier - 1)) * 120
         + st.bosses * 900 + st.elites * 250 + st.kills * 15 + Math.floor(st.scrapEarned / 2);
    // The multiplier is stored on the run rather than read live, so a score already banked is
    // not re-scored by whatever the next expedition signs up for.
    return Math.floor(base * (st.contractMult || 1));
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

function initEngine() { 
    preloadAssets();
    Store.probe();
    migrateOldSaves();
    loadMeta();
    let saved = Store.getJSON(SETTINGS_KEY);
    if (saved && saved !== CORRUPT) { globalSettings = { ...globalSettings, ...saved }; }
    updateSettingsUI(); 
    renderTitleScreen(); 
}

function switchScreen(screenId) { if (screenId !== 'screen-combat') stopAmbience(); document.querySelectorAll('#engine > div:not(.settings-icon):not(#screen-settings)').forEach(el => el.style.display = 'none'); document.getElementById(screenId).style.display = 'flex'; if (screenId === 'screen-map' || screenId === 'screen-outpost' || screenId === 'screen-citadel') { document.getElementById('btn-global-settings').style.display = 'block'; } else { document.getElementById('btn-global-settings').style.display = 'none'; } }
function openSettings() { disarmErase(); document.getElementById('screen-settings').style.display = 'flex'; }
function closeSettings() { disarmErase(); document.getElementById('screen-settings').style.display = 'none'; }
function toggleGameSpeed() { globalSettings.combatSpeed = globalSettings.combatSpeed === 1.0 ? 0.5 : 1.0; Store.set(SETTINGS_KEY, JSON.stringify(globalSettings)); updateSettingsUI(); }
function toggleSFX() { globalSettings.sfx = !globalSettings.sfx; if (globalSettings.sfx) initAudio(); Store.set(SETTINGS_KEY, JSON.stringify(globalSettings)); updateSettingsUI(); }
function updateSettingsUI() { document.getElementById('btn-toggle-speed').innerText = globalSettings.combatSpeed === 1.0 ? "COMBAT SPEED: NORMAL" : "COMBAT SPEED: FAST"; document.getElementById('btn-toggle-sfx').innerText = globalSettings.sfx ? "AUDIO SFX: ON" : "AUDIO SFX: OFF"; }
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
}

function toggleContract(id) {
    if (!CONTRACT_POOL.some(c => c.id === id)) return;
    activeContracts = hasContract(id) ? activeContracts.filter(x => x !== id) : [...activeContracts, id];
    playSFX('click'); renderContracts();
}

function beginExpedition() { confirmNewGame(pendingDifficulty); }

function confirmNewGame(diff) {
    difficultyMult = diff; currentSector = 1; currentTier = 1; tuneUpBattles = 0; momentum = 0;
    scrap = metaUpgrades.startScrap || 0; inventory = hasContract('NO_CONSUMABLES') ? [] : ['MED_STIM']; materials = { parts: 0, chems: 0, tech: 0 }; 
    playerRoster = migrateTraits(JSON.parse(JSON.stringify(ROSTER_TEMPLATE)));
    activeBounties = generateBounties(); runStats = newRunStats(); pendingRelicOffer = null;
    pendingConsequences = []; recentEvents = [];
    const kept = heirloomRelic();
    activeRelics = kept ? [kept] : [];
    
    playerRoster.forEach(p => { 
        let q = QUIRK_POOL[Math.floor(Math.random() * QUIRK_POOL.length)];
        p.quirk = q; p.maxHp += q.hp; p.hp = p.maxHp; p.dmgBase += q.dmg; p.speed += q.spd;
        p.level = metaUpgrades.startLevel; p.perkPoints = metaUpgrades.startLevel - 1; p.xpToNext = Math.floor(100 * Math.pow(XP_CURVE, metaUpgrades.startLevel - 1)); 
        if (hasContract('GLASS')) { p.maxHp = Math.max(1, Math.floor(p.maxHp * 0.75)); p.hp = p.maxHp; }
    });
    // The back rank stays empty, and stays empty - the Outpost refuses to fill it below.
    if (hasContract('SHORT_HANDED')) playerRoster.forEach(p => { if (p.gridPos === 3) p.gridPos = 0; });

    saveGameState(); renderMap(); 
}

function continueGame() {
    loadGameState(); addMomentum(0);
    if (pendingCombat) return resumeCombat(pendingCombat);
    if (pendingRelicOffer && pendingRelicOffer.length) return renderRelicOffer();
    renderMap();
}

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
    applyCombatScenery(c.bgFile || 'bg_combat.webp', currentNodeType === 'BOSS' ? bossForSector().banner : null);
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

function saveGameState() { Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify({ scrap, tier: currentTier, currentSector, difficultyMult, roster: playerRoster, inventory, materials, tuneUpBattles, activeBounties, momentum, pendingConsequences, recentEvents, activeRelics, relicOffer: pendingRelicOffer ? pendingRelicOffer.map(r => r.id) : null, runStats, combat: buildCombatSnapshot() })); }

// A relic written to a save before the pool was tiered carries the old wording and no tier, so
// it is looked up again by id rather than trusted as stored. Anything whose id no longer exists
// is dropped rather than left as a relic that does nothing.
function migrateRelics(saved) {
    return (saved || []).map(r => RELIC_POOL.find(p => p.id === (r && r.id))).filter(Boolean);
}
function loadGameState() { let d = Store.getJSON(BASE_SAVE_KEY + currentSlot); if (d && d !== CORRUPT) { scrap = d.scrap || 0; currentTier = d.tier || 1; currentSector = d.currentSector || 1; difficultyMult = d.difficultyMult || 1.0; playerRoster = migrateAssetPaths(migrateTraits(d.roster || JSON.parse(JSON.stringify(ROSTER_TEMPLATE)))); inventory = d.inventory || ['MED_STIM']; materials = d.materials || { parts: 0, chems: 0, tech: 0 }; tuneUpBattles = d.tuneUpBattles || 0; activeBounties = d.activeBounties || generateBounties(); momentum = d.momentum || 0; pendingConsequences = Array.isArray(d.pendingConsequences) ? d.pendingConsequences : []; recentEvents = Array.isArray(d.recentEvents) ? d.recentEvents : []; activeRelics = migrateRelics(d.activeRelics); pendingRelicOffer = migrateRelics((d.relicOffer || []).map(id => ({ id }))); if (!pendingRelicOffer.length) pendingRelicOffer = null; pendingCombat = d.combat || null;
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
            `<div class="dev-row">` + btn('Event', 'dev-node', 'data-kind="EVENT"') + btn('Camp', 'dev-node', 'data-kind="CAMP"') + `</div>`
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
    noteDepth(); saveGameState(); renderDev();
}

// Steps forward to the next sector that fields the requested commander, so the fight arrives at
// a difficulty that matches how deep the run already is.
function devFightBoss(bossId) {
    const idx = BOSS_POOL.findIndex(b => b.id === bossId);
    if (idx < 0) return;
    let s = currentSector;
    while (((s - 1) % BOSS_POOL.length) !== idx) s++;
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

function renderCitadel() { switchScreen('screen-citadel'); document.getElementById('citadel-skulls').innerText = `${bossSkulls} 💀`; document.getElementById('meta-lbl-scrap').innerText = `LVL ${metaUpgrades.startScrap / 50}`; document.getElementById('meta-lbl-level').innerText = `LVL ${metaUpgrades.startLevel - 1}`; document.getElementById('meta-lbl-inv').innerText = `LVL ${metaUpgrades.invMax - 4}`; document.getElementById('meta-lbl-regroup').innerText = `LVL ${metaUpgrades.extraRegroups || 0}`;
    const kept = heirloomRelic();
    document.getElementById('meta-lbl-vault').innerText = metaUpgrades.vault ? (kept ? '♦ ARMED' : 'EMPTY') : 'LOCKED';
    document.getElementById('meta-vault-desc').innerText = !metaUpgrades.vault
        ? 'Your best relic survives the expedition and arms the next one.'
        : kept ? `Holding ${kept.name} — the next expedition starts with it.`
               : 'Unlocked. The next expedition that finds a relic will bank one here.';
    const vBtn = document.querySelector('[data-kind="VAULT"]');
    if (vBtn) { vBtn.disabled = !!metaUpgrades.vault; vBtn.innerText = metaUpgrades.vault ? 'UNLOCKED' : 'UNLOCK [COST: 5 💀]'; } }
function buyMetaUpgrade(type) { if (type === 'SCRAP' && bossSkulls >= 1) { bossSkulls -= 1; metaUpgrades.startScrap += 50; } else if (type === 'LEVEL' && bossSkulls >= 2) { bossSkulls -= 2; metaUpgrades.startLevel += 1; } else if (type === 'INV' && bossSkulls >= 3) { bossSkulls -= 3; metaUpgrades.invMax += 1; } else if (type === 'REGROUP' && bossSkulls >= 4) { bossSkulls -= 4; metaUpgrades.extraRegroups = (metaUpgrades.extraRegroups || 0) + 1; } else if (type === 'VAULT' && bossSkulls >= 5 && !metaUpgrades.vault) { bossSkulls -= 5; metaUpgrades.vault = 1; } saveMeta(); renderCitadel(); }

function renderMap() {
    switchScreen('screen-map'); 
    noteDepth();
    document.getElementById('scrap-display').innerText = formatStat(scrap);
    document.getElementById('map-sector-lbl').innerText = currentSector;
    document.getElementById('map-score-lbl').innerText = formatStat(computeScore(runStats));
    
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
            if (n.type === 'BOSS') { icon = '💀'; lbl = bossForSector().short; } else if (n.type === 'BEASTS') { icon = '☣️'; lbl = 'BEASTS'; } else if (n.type === 'MECH') { icon = '⚙️'; lbl = 'MECH'; } else if (n.type === 'EVENT') { icon = '❓'; lbl = 'UNKNOWN'; } else if (n.type === 'CAMP') { icon = '⛺'; lbl = 'CAMP'; }
            let eCls = n.elite ? 'elite-node' : (n.type === 'EVENT' ? 'event-node' : n.type === 'CAMP' ? 'camp-node' : ''); let eLbl = n.elite ? ' (ELITE)' : '';
            let nodeAction = n.type === 'EVENT' ? `data-action="node-event"` : n.type === 'CAMP' ? `data-action="node-camp"` : `data-action="node-combat" data-type="${n.type}" data-elite="${n.elite ? 1 : 0}"`;
            m += `<button class="map-node node-${rowStatus} ${eCls} ${(n.type === 'BOSS' && t === currentTier) ? 'boss-node' : ''}" ${dis} ${nodeAction}><span class="node-icon">${icon}</span><span class="node-lbl">${lbl}${eLbl}</span></button>`;
        });
        m += `</div>`; if (t > 1) m += `<div class="map-connector ${(t <= currentTier) ? 'connector-cleared' : ''}"></div>`;
    }
    m += `</div>`; mapC.innerHTML = m; setTimeout(() => { mapC.scrollTop = mapC.scrollHeight; }, 10);
}

function advanceSector() {
    currentSector++; currentTier = 1; noteDepth(); saveGameState();
    resolveConsequence();
}

function setOutpostTab(tab) { document.getElementById('tab-roster').className = `op-tab-btn ${tab === 'ROSTER' ? 'op-tab-active' : ''}`; document.getElementById('tab-workbench').className = `op-tab-btn ${tab === 'WORKBENCH' ? 'op-tab-active' : ''}`; document.getElementById('tab-cyber').className = `op-tab-btn ${tab === 'CYBER' ? 'op-tab-active' : ''}`; document.getElementById('outpost-roster-view').style.display = tab === 'ROSTER' ? 'flex' : 'none'; document.getElementById('outpost-workbench-view').style.display = tab === 'WORKBENCH' ? 'flex' : 'none'; document.getElementById('outpost-cyber-view').style.display = tab === 'CYBER' ? 'flex' : 'none'; renderOutpost(); }

function renderOutpost() {
    switchScreen('screen-outpost'); showOutpostNotice(''); document.getElementById('outpost-scrap').innerText = formatStat(scrap); 
    const c = document.getElementById('outpost-roster'); const cards = [];
    playerRoster.forEach(char => {
        let cost = 30 + (char.upgradeCount * 25); let canUpg = scrap >= cost; let isDead = char.hp <= 0; let isInj = char.hp < char.maxHp && char.hp > 0;
        let medHtml = isDead ? `<button class="upg-btn revive-btn" ${scrap < 50 ? 'disabled' : ''} data-action="medbay" data-id="${char.id}" data-mode="REVIVE">DEFIB (50)</button>` : `<button class="upg-btn med-btn" ${!isInj || scrap < 10 ? 'disabled' : ''} data-action="medbay" data-id="${char.id}" data-mode="HEAL">TRIAGE (10)</button>`;
        
        // Unspent points always win the slot, however many perks the character already has.
        let traitDisplay = char.perkPoints > 0
            ? `<button class="upg-btn perk-btn" style="padding:2px 5px;" data-action="perk-menu" data-id="${char.id}">CHOOSE PERK (${char.perkPoints})</button>`
            : `LVL ${char.level} (${char.xp}/${char.xpToNext} XP)`;
        let traitLine = traitSummary(char);
        let traitsDisplay = traitLine ? `<div style="font-size:9px; color:#6B8E23; text-transform:uppercase; margin-top:2px;">${traitLine}</div>` : '';
        let quirkDisplay = char.quirk ? `<div style="font-size:9px; color:#ffaa00; text-transform:uppercase; margin-top:2px;">[ ${char.quirk.name} ]</div>` : '';

        let posText = char.gridPos === 1 ? '[1] FRONTLINE' : char.gridPos === 2 ? '[2] MIDLINE' : char.gridPos === 3 ? '[3] BACKLINE' : '[X] BENCHED'; let posClass = `pos-btn-${char.gridPos}`; let btnGroupHtml = '';

        if (activePosSelector === char.id) { btnGroupHtml = `<button class="upg-btn sub-menu-btn pos-btn-1" data-action="assign-slot" data-id="${char.id}" data-slot="1">[1] FRONT</button> <button class="upg-btn sub-menu-btn pos-btn-2" data-action="assign-slot" data-id="${char.id}" data-slot="2">[2] MID</button> <button class="upg-btn sub-menu-btn pos-btn-3" data-action="assign-slot" data-id="${char.id}" data-slot="3">[3] BACK</button> <button class="upg-btn sub-menu-btn pos-btn-0" data-action="assign-slot" data-id="${char.id}" data-slot="0">[X] BENCH</button> <button class="upg-btn sub-menu-btn" style="border-color:#888;" data-action="selector-cancel">CANCEL</button>`; } 
        else if (activePerkSelector === char.id) { btnGroupHtml = PERK_POOL.map(p => `<button class="upg-btn sub-menu-btn perk-btn" data-action="assign-perk" data-id="${char.id}" data-perk="${p.id}">${p.label}</button>`).join(' ') + ` <button class="upg-btn sub-menu-btn" style="border-color:#888;" data-action="selector-cancel">CANCEL</button>`; } 
        else { btnGroupHtml = `<button class="upg-btn ${posClass}" data-action="pos-menu" data-id="${char.id}">${posText}</button> <button class="upg-btn" ${!canUpg || isDead ? 'disabled' : ''} data-action="buy-upg" data-id="${char.id}" data-kind="HP" data-cost="${cost}">+10 HP</button> <button class="upg-btn" ${!canUpg || isDead ? 'disabled' : ''} data-action="buy-upg" data-id="${char.id}" data-kind="DMG" data-cost="${cost}">+3 DMG</button> ${medHtml}`; }

        cards.push(`<div class="upgrade-card" style="${isDead ? 'border-color: #8B0000; opacity: 0.8;' : ''}"> <div class="upgrade-header" style="flex-direction:column; align-items:flex-start;"> <div style="display:flex; justify-content:space-between; width:100%;"><span>${char.name} (${char.classType})</span><span>${traitDisplay}</span></div> ${quirkDisplay}${traitsDisplay} </div> <div class="upgrade-stats"><span>HP: ${char.hp}/${char.maxHp}</span><span>DMG: ${char.dmgBase}</span><span>UPG: <span class="cost-txt">${cost}</span></span></div> <div class="upgrade-btn-group">${btnGroupHtml}</div> </div>`);
    });

    c.innerHTML = cards.join('');
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
    else if (action === 'REVIVE' && scrap >= 50 && c.hp <= 0) { scrap -= 50; c.hp = Math.floor(c.maxHp * 0.25); playSFX('heal'); } 
    saveGameState(); renderOutpost(); 
}

// Fourteen events repeat far less than four did, but a uniform roll still hands the same one
// back two nodes running. The last few are held out of the draw so the map keeps changing.
const EVENT_MEMORY = 4;
function pickEvent() {
    const fresh = EVENT_POOL.filter(e => !recentEvents.includes(e.title));
    const pool = fresh.length ? fresh : EVENT_POOL;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    recentEvents = [pick.title, ...recentEvents].slice(0, EVENT_MEMORY);
    return pick;
}

function initiateEvent() {
    switchScreen('screen-event'); activeEvent = pickEvent();
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

const INTENT_ICONS = { AOE: '🧨', HEAVY: '💥', STATUS: '☣️', DEFEND: '🛡️', ATTACK: '⚔️', FLANK: '🌀' };

function intentFor(type, enemy) {
    const icon = (type === 'ATTACK' && enemy.range === 'ranged') ? '🔫' : INTENT_ICONS[type];
    return { type, icon };
}

function rollIntent(enemy) {
    let rand = Math.random();
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

function generateEnemies(nodeType, mult, isEliteNode, dmgMult = mult) {
    const pool = {
        'BEASTS': [
            { name: "Attack Dog", minTier: 1, isHeavy: false, classType: "BEAST", range: 'melee', maxHp: 30, speed: 18, armor: 0, dmgBase: 10, img: "enemy_dog.webp", scale: 0.8, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: -2, bio: 0, energy: 0 } }, 
            { name: "Mutant", minTier: 5, isHeavy: true, classType: "MUTANT", range: 'melee', maxHp: 70, speed: 7, armor: 0, dmgBase: 25, img: "enemy_mutant.webp", scale: 1.5, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 20, energy: -5 } }, 
            { name: "Chem Fiend", minTier: 6, isHeavy: true, classType: "MUTANT", range: 'ranged', maxHp: 60, speed: 11, armor: 0, dmgBase: 15, img: "enemy_chem.webp", scale: 1.0, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 50, energy: -5 } }
        ],
        'RAIDERS': [
            { name: "Raider", minTier: 1, isHeavy: false, classType: "RAIDER", range: 'melee', maxHp: 40, speed: 10, armor: 0, dmgBase: 12, img: "enemy_raider.webp", scale: 1.0, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: -2, bio: 2, energy: 0 } }, 
            { name: "Psycho", minTier: 4, isHeavy: false, classType: "RAIDER", range: 'melee', maxHp: 45, speed: 14, armor: 0, dmgBase: 18, img: "enemy_psycho.webp", scale: 1.0, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 } }, 
            { name: "Sniper", minTier: 5, isHeavy: false, classType: "RAIDER", range: 'ranged', maxHp: 35, speed: 16, armor: 0, dmgBase: 25, img: "enemy_sniper.webp", scale: 1.0, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 0, bio: 0, energy: 0 } }, 
            { name: "Juggernaut", minTier: 7, isHeavy: true, classType: "RAIDER", range: 'melee', maxHp: 90, speed: 6, armor: 5, dmgBase: 18, img: "enemy_juggernaut.webp", scale: 1.8, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 10, bio: 0, energy: -5 } }
        ],
        'MECH': [
            { name: "Drone", minTier: 4, isHeavy: false, classType: "DRONE", range: 'ranged', isHovering: true, maxHp: 25, speed: 18, armor: 5, dmgBase: 8, img: "enemy_drone.webp", scale: 0.7, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 8, bio: 100, energy: -10 } }, 
            { name: "Turret", minTier: 5, isHeavy: false, classType: "MECH", range: 'ranged', maxHp: 50, speed: 2, armor: 8, dmgBase: 18, img: "enemy_turret.webp", scale: 0.9, hpDrop: 0, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 10, bio: 100, energy: -10 } }, 
            { name: "War Rig", minTier: 8, isHeavy: true, classType: "MECH", range: 'ranged', maxHp: 150, speed: 5, armor: 10, dmgBase: 25, img: "enemy_warrig.webp", scale: 1.8, hpDrop: -20, stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0, resistances: { phys: 15, bio: 100, energy: -15 } }
        ]
    };

    let bossBaseHp = currentSector === 1 ? 100 : 300;
    let bossBaseDmg = currentSector === 1 ? 30 : 40;
    
    if (nodeType === 'BOSS') {
        const b = bossForSector();
        const boss = {
            id: 'b1', name: b.name, bossId: b.id, classType: 'BOSS', range: b.range,
            maxHp: Math.floor(bossBaseHp * b.hpMult * mult), hp: Math.floor(bossBaseHp * b.hpMult * mult),
            speed: b.speed, armor: b.armor, baseArmor: b.armor, isPlayer: false,
            dmgBase: Math.floor(bossBaseDmg * b.dmgMult * dmgMult),
            img: b.img, scale: b.scale, hpDrop: 0,
            stunnedTurns: 0, bleedingTurns: 0, armorTurns: 0, oiledTurns: 0, corrodedTurns: 0, markedTurns: 0,
            resistances: { ...b.resistances }, phase: 1,
            intents: b.intents, bossPassive: b.passive || null, enrage: b.enrage
        };
        if (b.isHovering) boss.isHovering = true;
        if (b.sink) boss.sink = b.sink;
        if (b.dmgType) boss.dmgType = b.dmgType;
        boss.intent = rollIntent(boss);
        return [boss];
    }
    
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
    // Only raiders bring reinforcements from elsewhere - they are scavengers, so salvaged
    // machinery and war dogs both fit. Beasts are wild and mechs are automated; neither
    // recruits, and a turret standing among a pack of dogs just reads as a bug.
    const allies = (FACTION_ALLIES[nodeType] || []).filter(t => pool[t]);

    let sZ = effTier >= 8 ? (Math.random() < 0.45 ? 4 : 3)
           : effTier >= 4 ? (Math.random() < 0.5 ? 3 : 2)
           : 2;
    let squad = [];
    for (let i = 0; i < sZ; i++) {
        // Above mid-game, squads can pick up an attached specialist from another faction.
        let usePool = homePool;
        if (allies.length && effTier >= 6 && i > 0 && Math.random() < 0.25) usePool = poolFor(allies[Math.floor(Math.random() * allies.length)]);
        let t = JSON.parse(JSON.stringify(usePool[Math.floor(Math.random() * usePool.length)])); 
        let hp = Math.floor(t.maxHp * mult); t.hp = hp; t.maxHp = hp; t.dmgBase = Math.floor(t.dmgBase * dmgMult); t.baseArmor = t.armor || 0;
        
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
    { move: 'RIP_AND_TEAR', needs: 'bleedingTurns', name: 'REND',      mult: 1.8 }
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
                 { move: 'RIP_AND_TEAR',  label: 'Rip and Tear (Bleed)', reach: 'melee', cd: 'rip_and_tear' }]
};

// Formation used to be decided at the Outpost and then mean nothing once the shooting started.
// A melee weapon swung from the back rank, or at something standing behind the enemy front, is
// reaching further than it wants to; a rifle does not care where either side stands. So the
// front rank is where a melee unit earns its damage - and where the enemy melee comes for it.
const REACH_PENALTY = { 2: 0.85, 3: 0.6 };
const RANK_LABELS = { 1: 'FRONT', 2: 'MID', 3: 'BACK' };
const DEPTH_PENALTY = 0.65;
const FRONT_RANKS = 2;

const MOVE_REACH = Object.fromEntries(
    Object.values(ABILITIES).flat().map(a => [a.move, a.reach]));

// Every ability an entity can be standing behind, in one place, so nothing needs a second list.
function isMelee(move) { return MOVE_REACH[move] === 'melee'; }
function isRanged(move) { return MOVE_REACH[move] === 'ranged'; }

function reachMult(move, attacker, dist) {
    if (!isMelee(move)) return 1;
    let m = REACH_PENALTY[attacker.gridPos] || 1;
    if (dist >= FRONT_RANKS) m *= DEPTH_PENALTY;
    return m;
}

// Two separate things cost a melee swing damage, and they are surfaced separately: the attacker's
// own rank costs the same against every target, so it belongs on the button, while reaching past
// the enemy front rank depends on which one is picked, so it belongs on that target.
function reachNote(move, attacker, dist) {
    const m = reachMult(move, attacker, dist);
    return m < 1 ? `-${Math.round((1 - m) * 100)}%` : null;
}
function isOutOfDepth(move, dist) { return isMelee(move) && dist >= FRONT_RANKS; }

const OVERDRIVE_NAMES = { BRUISER: 'EARTHSHAKER', MEDIC: 'FIELD REVIVE', SCAVENGER: 'SCRAP STORM',
    PYROMANIAC: 'HELLFIRE', SHOTGUNNER: 'BREACH CHARGE', SNIPER: 'HEADSHOT', HOUND: 'APEX PREDATOR' };

// Anything else striking a marked target still gets the mark's smaller bonus and spends it.
const MARK_BONUS = 1.5;
const DAMAGING_MOVES = ['SCRAP_BLADE','HEAVY_WRENCH','PISTOL','RAD_SHOT','PIPE_RIFLE','FLASHBANG','FLARE_GUN',
    'MOLOTOV','SLUG_SHOT','BUCKSHOT','QUICK_SHOT','DEADEYE','SNAP','FERAL_BITE',
    'ACID_FLASK','THERMITE','EXECUTE_SHOT','SPOTTERS_MARK','RIP_AND_TEAR'];

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
}

function initiateCombat(nodeType, isEliteNode) {
    let deployedRoster = playerRoster.filter(p => p.gridPos > 0);
    if (!deployedRoster.some(p => p.hp > 0)) { renderOutpost(); showOutpostNotice('⚠ Every deployed operator is down. Revive someone, or deploy from the bench, before heading out.'); return; }
    deployedRoster.sort((a, b) => a.gridPos - b.gridPos);

    switchScreen('screen-combat'); combatActive = true; document.getElementById('log').innerHTML = '';

    let bgFile = 'bg_combat.webp'; currentWeather = 'CLEAR'; currentNodeType = nodeType; isCurrentNodeElite = isEliteNode;
    if (currentTier === 1 && currentSector === 1) { bgFile = 'bg_combat.webp'; } else {
        if (nodeType === 'BOSS') { bgFile = bossForSector().bg || 'bg_thunderdome.webp'; currentWeather = 'BLOODLUST'; }
        else if (nodeType === 'MECH') { bgFile = 'bg_refinery.webp'; if (Math.random() < 0.4) currentWeather = 'TOXIC_SMOG'; }
        else if (nodeType === 'RAIDERS') { bgFile = 'bg_highway.webp'; if (Math.random() < 0.4) currentWeather = 'SHRAPNEL_WINDS'; }
        else if (nodeType === 'BEASTS') { bgFile = 'bg_canyon.webp'; if (Math.random() < 0.4) currentWeather = 'SANDSTORM'; }
    }
    if (hasContract('HARSH_SKIES') && currentWeather === 'CLEAR') {
        currentWeather = ['TOXIC_SMOG', 'SANDSTORM', 'SHRAPNEL_WINDS'][Math.floor(Math.random() * 3)];
    }
    applyCombatScenery(bgFile, nodeType === 'BOSS' ? bossForSector().banner : null);

    // Enemies are built fresh each fight; the squad persists, so anything left on a unit has to
    // be cleared here or it rides into the next node.
    playerRoster.forEach(ent => { ent.stunnedTurns = 0; ent.bleedingTurns = 0; ent.armorTurns = 0; ent.armor = 0;
        ent.oiledTurns = 0; ent.corrodedTurns = 0; ent.markedTurns = 0; ent.guardTurns = 0; });
    // HP keeps the steep 1.5x-per-sector curve; damage climbs far more slowly so a deep fight
    // is dangerous rather than an unavoidable one-shot. Player power compounds through
    // repeatable percentage perks, which is what makes the curve climbable at all.
    const mult = difficultyMult * (1 + ((currentTier - 1) * 0.2)) * Math.pow(SECTOR_HP_SCALE, currentSector - 1);
    const dmgMult = difficultyMult * (1 + ((currentTier - 1) * 0.12)) * Math.pow(SECTOR_DMG_SCALE, currentSector - 1);
    
    activeEntities = [...deployedRoster, ...generateEnemies(nodeType, mult, isEliteNode, dmgMult)];
    turnQueue = [...activeEntities].sort((a, b) => b.speed - a.speed);
    activeIndex = 0;
    // Second Watch hands the opening turn to whichever enemy is fastest, however quick the squad is.
    if (hasContract('THEY_MOVE_FIRST')) {
        const firstFoe = turnQueue.findIndex(e => !e.isPlayer);
        if (firstFoe > 0) activeIndex = firstFoe;
    }
    log("> COMBAT INITIATED.", "log-turn");
    if (nodeType === 'BOSS') { const b = bossForSector(); log(`> ${b.name.toUpperCase()}: ${b.blurb}`, "log-combo"); } processTurn();
}

const logEl = document.getElementById('log');
function log(msg, styleClass = "log-dmg") { const el = document.createElement('div'); el.className = styleClass; el.innerText = msg; logEl.appendChild(el); logEl.scrollTop = logEl.scrollHeight; }

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
    renderQueue(); const pTeam = document.getElementById('player-team'); const eTeam = document.getElementById('enemy-team'); pTeam.innerHTML = ''; eTeam.innerHTML = ''; const pCells = [], eCells = [];
    activeEntities.forEach(ent => {
        let isDead = ent.hp <= 0; const isAct = (!isDead && turnQueue.length > 0 && turnQueue[activeIndex]?.id === ent.id) ? 'active' : ''; const dCls = isDead ? 'dead' : '';
        let tCls = ''; let clk = '';
        // Targets are divs, so they need to be announced and reachable like the buttons are.
        const targetable = attrs => `${attrs} tabindex="0" role="button" aria-label="Target ${ent.name}"`;
        if (pendingAction) {
            if (pendingAction === 'OVERDRIVE' && turnQueue[activeIndex].classType === 'MEDIC' && ent.isPlayer) {
                tCls = 'targetable-ally'; clk = targetable(`data-action="target" data-id="${ent.id}"`);
            } else if (!isDead) {
                if ((pendingAction === 'CAUTERIZE' || pendingAction === 'REPOSITION') && ent.isPlayer) { tCls = 'targetable-ally'; clk = targetable(`data-action="target" data-id="${ent.id}"`); } 
                else if (['ITEM_MED', 'ITEM_BOMB', 'ITEM_ADRENALINE', 'ITEM_EMP'].includes(pendingAction)) {
                    if (pendingAction === 'ITEM_MED' && ent.isPlayer) { tCls = 'targetable-ally'; clk = targetable(`data-action="use-item" data-id="${ent.id}"`); }
                    else if (pendingAction === 'ITEM_ADRENALINE' && ent.isPlayer) { tCls = 'targetable-ally'; clk = targetable(`data-action="use-item" data-id="${ent.id}"`); }
                    else if (pendingAction === 'ITEM_BOMB' && !ent.isPlayer) { tCls = 'targetable-enemy'; clk = targetable(`data-action="use-item" data-id="${ent.id}"`); }
                    else if (pendingAction === 'ITEM_EMP' && !ent.isPlayer) { tCls = 'targetable-enemy'; clk = targetable(`data-action="use-item" data-id="${ent.id}"`); }
                }
                else if (pendingAction !== 'CAUTERIZE' && pendingAction !== 'REPOSITION' && !ent.isPlayer) { tCls = 'targetable-enemy'; clk = targetable(`data-action="target" data-id="${ent.id}"`); }
            }
        }
        let eff = ''; if (ent.bleedingTurns > 0 && !isDead) eff += `💧`; if (ent.stunnedTurns > 0 && !isDead) eff += `💫`; if (ent.armorTurns > 0 && !isDead) eff += `🛡️`; if (ent.oiledTurns > 0 && !isDead) eff += `🛢️`; if (ent.corrodedTurns > 0 && !isDead) eff += `🧪`; if (ent.markedTurns > 0 && !isDead) eff += `🎯`;
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
            <div class="entity ${isAct} ${dCls} ${tCls} ${hint ? 'has-combo' : ''} ${farTag ? 'out-of-reach' : ''} ${guarding ? 'covering' : ''}" id="${ent.id}" ${clk} style="--sprite-scale: ${ent.scale || 1}; --sprite-sink: ${ent.sink || 0}px;">
                <div class="intent-icon" style="display:${ent.intent && !isDead && !ent.isPlayer ? 'flex' : 'none'}">${ent.intent ? ent.intent.icon : ''}</div>
                ${hint ? `<div class="combo-flag">${hint}</div>` : ''}
                ${farTag ? `<div class="reach-flag">FAR</div>` : ''}
                ${guarding ? `<div class="guard-flag">COVERING</div>` : ''}
                <div style="width: 100%; position: relative; z-index: 10; transform: translateY(${ent.hpDrop || 0}px);">
                    ${rank ? `<div class="rank-chip rank-${ent.gridPos}">${rank}</div>` : ''}
                    ${eff ? `<div class="status-badge">${eff}</div>` : ''}
                    <div class="hp-text">${ent.hp}/${ent.maxHp}</div>
                    <div class="hp-container"><div class="hp-fill ${ent.isPlayer ? 'player-hp' : 'enemy-hp'}" style="width: ${(ent.hp / ent.maxHp) * 100}%"></div></div>
                    ${isDead ? '' : resistBadges(ent)}
                </div><img class="portrait ${hoverCls}" src="${ent.img}" style="${eliteGlow}">
            </div>`;
        if (ent.isPlayer) pCells.push(html); else eCells.push(html);
    });
    pTeam.innerHTML = pCells.join(''); eTeam.innerHTML = eCells.join('');
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

    if (momentum >= overdriveAt()) {
        const odName = OVERDRIVE_NAMES[aE.classType] || 'ULTIMATE';
        deckHtml += `<button class="title-btn btn-overdrive" data-action="queue" data-move="OVERDRIVE">OVERDRIVE: ${odName}</button>`;
    }

    // A pairing is only worth surfacing if the player can act on it now, so the button is flagged
    // when some enemy already on the field carries the status the ability cashes in. Only named
    // pairings count here: a mark boosts every move equally, so flagging them all would light the
    // whole deck and say nothing about which one to pick. Aiming still calls the mark out.
    const foes = activeEntities.filter(e => !e.isPlayer && e.hp > 0);
    const liveCombo = move => (foes.map(f => comboFor(move, f)).find(Boolean) || {}).name || null;

    const deck = [...(ABILITIES[aE.classType] || [])];
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
        const cls = [ready ? 'combo-ready' : '', short ? 'reach-short' : ''].filter(Boolean).join(' ');
        deckHtml += `<button ${cd > 0 ? 'disabled' : ''} ${cls ? `class="${cls}"` : ''} data-action="${a.act || 'queue'}" data-move="${a.move}">`
                  + `${a.label}${cd > 0 ? ` [${cd}]` : ''}${ready ? ` <span class="combo-tag">${ready}</span>` : ''}`
                  + `${short ? ` <span class="reach-tag">REACH ${short}</span>` : ''}</button>`;
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
    let chg = false;
    if (ent.isPlayer && ent.cooldowns) {
        const step = hasRelic('AMMO_HOIST') ? 2 : 1;
        for (let s in ent.cooldowns) { if (ent.cooldowns[s] > 0) { ent.cooldowns[s] = Math.max(0, ent.cooldowns[s] - step); chg = true; } }
    }
    
    if (currentWeather === 'TOXIC_SMOG') { let sDmg = Math.floor(2 * (1 + ((currentTier - 1) * 0.4))); ent.hp = Math.max(0, ent.hp - sDmg); log(`> ${ent.name} choked by Smog for ${sDmg} DMG.`, "log-dmg"); spawnFCT(ent.id, `-${sDmg}`, "fct-status"); chg = true; addMomentum(5); triggerHitFlash(ent.id); }
    if (currentWeather === 'SHRAPNEL_WINDS' && Math.random() < 0.3) { let shrapDmg = Math.floor(5 * (1 + ((currentTier - 1) * 0.4))); ent.hp = Math.max(0, ent.hp - shrapDmg); log(`> Shrapnel struck ${ent.name} for ${shrapDmg} DMG!`, "log-dmg"); spawnFCT(ent.id, `-${shrapDmg}`, "fct-dmg"); chg = true; addMomentum(5); triggerHitFlash(ent.id); }

    if (ent.bleedingTurns > 0) { let b = Math.max(1, Math.floor(ent.maxHp * 0.08));
        if (ent.isPlayer && hasRelic('FIELD_DRESSING')) b = Math.max(1, Math.floor(b / 2)); ent.hp = Math.max(0, ent.hp - b); log(`> ${ent.name} bleeds for ${b}.`, "log-dmg"); spawnFCT(ent.id, `-${b}`, "fct-dmg"); ent.bleedingTurns--; chg = true; if(ent.isPlayer) addMomentum(5); triggerHitFlash(ent.id); }
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
        momentum = 0; addMomentum(0); playSFX('overdrive'); triggerGlitch();
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
        let heal = 20 + Math.floor(Math.random() * 10); target.hp = Math.min(target.maxHp, target.hp + heal); actEnt.cooldowns.cauterize = 3; 
        log(`> ${actEnt.name} heals ${target.name} for ${heal}.`, "log-heal"); spawnFCT(target.id, `+${heal}`, "fct-heal"); playSFX('heal');
    } else {
        let atkType = 'phys'; if(['RAD_SHOT', 'FERAL_BITE', 'RIP_AND_TEAR'].includes(pendingAction)) atkType = 'bio'; if(['FLASHBANG', 'MOLOTOV', 'FLARE_GUN', 'ACID_FLASK', 'THERMITE'].includes(pendingAction)) atkType = 'energy';
        let tuneUpBonus = tuneUpBattles > 0 ? 4 : 0;
        let baseDmg = actEnt.dmgBase + tuneUpBonus + Math.floor(Math.random() * 6); 
        let dmgMult = 1.0; let isCombo = false; let comboType = '';

        // Each ability's own profile first - flat rates and positional swings both settle here.
        if (pendingAction === 'FLASHBANG') { dmgMult = 0.4; actEnt.cooldowns.flashbang = 4; }
        if (pendingAction === 'HEAVY_WRENCH') { dmgMult = 1.5; actEnt.cooldowns.heavy_wrench = 3; }
        if (pendingAction === 'FERAL_BITE') { dmgMult = 1.2; actEnt.cooldowns.feral_bite = 3; }
        if (pendingAction === 'DEADEYE') { if (dist === livingEnemies.length - 1 && dist !== 0) dmgMult = 1.8; else dmgMult = 0.8; actEnt.cooldowns.deadeye = 2; }
        if (pendingAction === 'BUCKSHOT') { dmgMult *= (dist === 0 ? 1.5 : 0.8); actEnt.cooldowns.buckshot = 2; }
        if (pendingAction === 'ACID_FLASK') { dmgMult = 0.5; actEnt.cooldowns.acid_flask = 3; }
        if (pendingAction === 'THERMITE') { dmgMult *= 1.6; actEnt.cooldowns.thermite = 4; }
        if (pendingAction === 'EXECUTE_SHOT') { dmgMult *= 1.4; actEnt.cooldowns.execute_shot = 3; }
        if (pendingAction === 'SPOTTERS_MARK') { dmgMult = 0.4; actEnt.cooldowns.spotters_mark = 3; }
        if (pendingAction === 'RIP_AND_TEAR') { dmgMult *= 1.2; actEnt.cooldowns.rip_and_tear = 3; }

        // Where the two of them are standing, before anything else is figured in.
        const reach = reachMult(pendingAction, actEnt, dist);
        if (reach < 1) { dmgMult *= reach; log(`> ${actEnt.name} is reaching (${Math.round(reach * 100)}% DMG).`, "log-status"); }

        // The combo multiplies whatever the ability was already worth. It has to come after every
        // profile above: an ability that assigns dmgMult outright would otherwise throw the bonus
        // away, spending the player's setup for nothing while the prompt still promised a payoff.
        const combo = comboFor(pendingAction, target);
        if (combo) {
            dmgMult *= combo.mult;
            if (combo.consumes) target[combo.consumes] = 0;
            isCombo = true; comboType = `${combo.name}!`;
        } else if ((target.markedTurns || 0) > 0 && DAMAGING_MOVES.includes(pendingAction)) {
            dmgMult *= MARK_BONUS; target.markedTurns = 0;
            isCombo = true; comboType = 'MARKED!';
        }

        if (hasRelic('THERMAL_CORE') && atkType === 'energy') { dmgMult *= 1.3; }
        if (hasRelic('WHETSTONE') && isMelee(pendingAction)) { dmgMult *= 1.2; }
        if (hasRelic('RANGEFINDER') && isRanged(pendingAction)) { dmgMult *= 1.15; }
        if (hasRelic('VULTURES_INSTINCT') && isCombo) { dmgMult *= 1.25; }

        // A sandstorm blinds anything fired across the field. This used to be a second hand-kept
        // list that had drifted - a thrown molotov was somehow unaffected - and now reads the
        // same reach the formation rules use.
        if (currentWeather === 'SANDSTORM' && isRanged(pendingAction)) { dmgMult *= 0.75; }
        if (currentWeather === 'BLOODLUST') { dmgMult *= 1.2; }
        
        playSFX(voiceFor(pendingAction));
        if (isCombo) { 
            log(`> COMBO ACTIVATED: ${comboType}`, "log-combo"); playSFX('combo'); 
            setTimeout(() => spawnFCT(target.id, comboType, "fct-combo"), 200); 
            checkBountyProgress('COMBO'); addMomentum(25); triggerShake();
        }

        applyDamageHit(actEnt, target, Math.floor(baseDmg * dmgMult), atkType, pendingAction);

        if (actEnt.quirk && actEnt.quirk.id === 'VAMPIRIC' && actEnt.hp < actEnt.maxHp) {
             actEnt.hp = Math.min(actEnt.maxHp, actEnt.hp + 2);
             spawnFCT(actEnt.id, "+2", "fct-heal");
        }

        if (hasRelic('BLOOD_VIAL') && atkType === 'bio' && actEnt.hp < actEnt.maxHp) {
            actEnt.hp = Math.min(actEnt.maxHp, actEnt.hp + 5);
            spawnFCT(actEnt.id, "+5", "fct-heal");
        }

        if (pendingAction === 'FLARE_GUN') { target.oiledTurns = 3; log(`> ${target.name} is coated in oil!`, "log-dmg"); setTimeout(() => spawnFCT(target.id, "OILED", "fct-weak"), 400); }
        if (pendingAction === 'ACID_FLASK') { target.corrodedTurns = 3; log(`> ${target.name}'s plating is corroding!`, "log-dmg"); setTimeout(() => spawnFCT(target.id, "CORRODED", "fct-weak"), 400); }
        if (pendingAction === 'SPOTTERS_MARK') { target.markedTurns = 3; log(`> ${target.name} is marked.`, "log-status"); setTimeout(() => spawnFCT(target.id, "MARKED", "fct-status"), 400); }
        if (pendingAction === 'RIP_AND_TEAR' && target.hp > 0) { target.bleedingTurns = Math.max(target.bleedingTurns, 3); setTimeout(() => spawnFCT(target.id, "BLEED", "fct-status"), 400); }
        if (pendingAction === 'MOLOTOV') { actEnt.cooldowns.molotov = 3; triggerShake(); let secondaries = livingEnemies.filter(e => e.id !== targetId); if (secondaries.length > 0) { let sTarg = secondaries[Math.floor(Math.random() * secondaries.length)]; applyDamageHit(actEnt, sTarg, Math.floor(baseDmg * 0.7), atkType, null); } }
    }
    pendingAction = null; checkWinState();
}

function applyDamageHit(attacker, target, calcDmg, atkType, abilityStr) {
    if (target.hp <= 0) return; let resistValue = target.resistances[atkType] || 0;
    // Corrosion eats plating outright - the counter to a unit that re-plates itself each turn.
    let armorCalc = (abilityStr === 'FERAL_BITE' || (target.corrodedTurns || 0) > 0) ? 0 : target.armor;
    if (target.oiledTurns > 0 && atkType === 'energy') resistValue -= 15; 
    
    if (hasRelic('KINETIC_MESH') && target.isPlayer && target.gridPos === 1 && atkType === 'phys') {
        calcDmg = Math.floor(calcDmg * 0.75);
    }
    if (hasRelic('CHEM_ETCHER') && !target.isPlayer && (target.corrodedTurns || 0) > 0) {
        calcDmg = Math.floor(calcDmg * 1.25);
    }

    let netDmg = Math.max(1, calcDmg - resistValue - armorCalc); if (resistValue >= 100) netDmg = 0; target.hp = Math.max(0, target.hp - netDmg);
    let logStyle = "log-dmg"; let logMsg = `> ${attacker.name} hits ${target.name} for ${netDmg}`;
    
    triggerHitFlash(target.id);

    if (netDmg === 0 && resistValue >= 100) { logMsg += " (Immune)."; spawnFCT(target.id, "IMMUNE", "fct-status"); playImpact(0, target, 0.5);
    } else if (resistValue > 5) { logMsg += " (Resisted)."; spawnFCT(target.id, `-${netDmg}`, "fct-dmg"); playImpact(netDmg, target, 0.7);
    } else if (resistValue < 0) { logMsg += " (Weakness!)."; logStyle = "log-dmg"; spawnFCT(target.id, `-${netDmg}!`, "fct-weak"); playImpact(netDmg, target, 1.25);
    } else { spawnFCT(target.id, `-${netDmg}`, "fct-dmg"); playImpact(netDmg, target); }
    
    log(logMsg, logStyle);

    if (target.hp <= 0) { addMomentum(15); if (!target.isPlayer) { checkBountyProgress('KILL'); if (runStats) runStats.kills++; } } else if (target.isPlayer) { addMomentum(5); }

    // Carrion Feast: the Matriarch grows on what it opens up.
    if (attacker.bossPassive === 'FEAST' && attacker.hp > 0 && netDmg > 0 && attacker.hp < attacker.maxHp) {
        const fed = Math.max(1, Math.floor(netDmg * 0.3));
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + fed);
        setTimeout(() => spawnFCT(attacker.id, `+${fed}`, "fct-heal"), 260);
    }

    if (abilityStr === 'RAD_SHOT' || abilityStr === 'FERAL_BITE') {
        if (Math.random() < (abilityStr === 'FERAL_BITE' ? 0.9 : 0.6)) { target.bleedingTurns = 3; log(`> ${target.name} bleeding!`, "log-dmg"); setTimeout(() => spawnFCT(target.id, "BLEED", "fct-status"), 300 * globalSettings.combatSpeed); }
    } else if (abilityStr === 'HEAVY_WRENCH' || abilityStr === 'FLASHBANG') {
        let sc = (abilityStr === 'FLASHBANG') ? 0.35 : 0.2; if (abilityStr === 'FLASHBANG' && target.resistances.energy < 0) sc *= 2;
        if (Math.random() < sc) { target.stunnedTurns = 1; log(`> ${target.name} stunned!`, "log-status"); setTimeout(() => spawnFCT(target.id, "STUNNED", "fct-status"), 300 * globalSettings.combatSpeed); }
    }
}

// Melee walks into whoever is nearest. Ranged fire used to pick uniformly at random, which meant
// a front rank protected nobody and standing a sniper at the back was free. It now leans on the
// back line, where the fragile units are - and a flank ignores the ranks entirely.
const BACKLINE_WEIGHT = { 1: 1, 2: 3, 3: 5 };

function pickTarget(enemy, candidates, intent) {
    if (candidates.length === 0) return null;
    if (intent && intent.type === 'FLANK') {
        return [...candidates].sort((a, b) => b.gridPos - a.gridPos)[0];
    }
    if (enemy.range === 'melee') {
        return [...candidates].sort((a, b) => a.gridPos - b.gridPos)[0];
    }
    const weighted = [];
    candidates.forEach(t => { const w = BACKLINE_WEIGHT[t.gridPos] || 1; for (let i = 0; i < w; i++) weighted.push(t); });
    return weighted[Math.floor(Math.random() * weighted.length)];
}

function executeEnemyAi(enemy) {
    if (!combatActive) return;
    
    if (enemy.classType === 'BOSS' && enemy.phase === 1 && enemy.hp <= (enemy.maxHp / 2)) {
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
    
    if (intent.type === 'DEFEND') {
        enemy.armor += 15; enemy.armorTurns = 2; spawnFCT(enemy.id, "+ARMOR", "fct-heal"); log(`> ${enemy.name} took a defensive stance!`, "log-status"); playSFX('heal');
        enemy.intent = rollIntent(enemy); checkWinState(); return;
    }

    if (intent.type === 'AOE') {
        playSFX('blast'); triggerShake(); log(`> ${enemy.name} unleashed an area attack!`, "log-dmg");
        let rawDmg = Math.floor(enemy.dmgBase * 0.7); 
        if (currentWeather === 'SANDSTORM') rawDmg = Math.floor(rawDmg * 0.75);
        if (currentWeather === 'BLOODLUST') rawDmg = Math.floor(rawDmg * 1.2);
        validTargets.forEach(targ => { applyDamageHit(enemy, targ, rawDmg, enemy.dmgType || 'phys', 'BASIC'); });
        enemy.intent = rollIntent(enemy); checkWinState(); return;
    }

    if (target) {
        playSFX(enemy.classType === 'BEAST' || enemy.classType === 'MUTANT' ? 'beast'
              : enemy.range === 'ranged' ? 'rifle' : 'blade');
        let t = enemy.dmgType || 'phys'; 
        let rawDmg = enemy.dmgBase + Math.floor(Math.random() * 5);
        
        if (intent.type === 'HEAVY') { rawDmg = Math.floor(rawDmg * 1.5); triggerShake(); }
        if (intercepted) {
            rawDmg = Math.floor(rawDmg * (hasRelic('BULWARK_PLATING') ? 0.35 : 0.6));
            log(`> ${target.name} steps in front of ${intercepted.name}.`, "log-status");
            spawnFCT(target.id, "COVERED", "fct-heal");
        }

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
        char.level++; char.xp -= char.xpToNext; char.xpToNext = Math.floor(char.xpToNext * XP_CURVE); char.perkPoints++;
        log(`> ${char.name} reached Level ${char.level}! Perk point available.`, "log-heal");
    }
}

function checkWinState() {
    renderField();
    const pA = activeEntities.some(e => e.isPlayer && e.hp > 0); const eA = activeEntities.some(e => !e.isPlayer && e.hp > 0);
    if (!pA) { document.getElementById('command-deck').innerHTML = `<button data-action="squad-down">SQUAD DOWN</button>`; combatActive = false; stopAmbience(); } 
    else if (!eA) { 
        if (currentNodeType === 'BOSS') { bossSkulls++; if (runStats) runStats.bosses++; saveMeta(); log(`> VICTORY! Warlord Skull acquired!`, "log-heal"); }
        if (isCurrentNodeElite) {
            checkBountyProgress('ELITE'); if (runStats) runStats.elites++;
            const rDrop = rollRelic();
            if (rDrop) { activeRelics.push(rDrop); log(`> RELIC ACQUIRED: ${rDrop.name}!`, "log-combo"); }
            else { const b = emptyPoolScrap(); scrap += b; log(`> No relic left to find. Salvaged ${b} Scrap instead.`, "log-heal"); }
        }
        // A commander is worth a decision rather than a die roll, so it hands over three to
        // choose between. The choice is staged and shown once the loot has been collected.
        if (currentNodeType === 'BOSS') {
            const offer = rollRelicOffer();
            if (offer.length) pendingRelicOffer = offer;
            else { const b = emptyPoolScrap(); scrap += b; log(`> Nothing left in the pool. Salvaged ${b} Scrap instead.`, "log-heal"); }
        }

        if (tuneUpBattles > 0) tuneUpBattles--; 

        let scrapMult = isCurrentNodeElite ? 2 : 1;
        let s = Math.floor((Math.floor(Math.random() * 30) + (currentTier * 20)) * scrapMult * sectorRewardMult()); 
        if (hasRelic('SCRAP_MAGNET')) s += 15;
        
        // Deployed survivors earn full XP; the bench trains at half rate so reserves stay
        // rotatable instead of falling permanently behind. Downed units earn nothing.
        playerRoster.forEach(char => {
            const base = Math.floor(35 * scrapMult * sectorRewardMult());
            if (char.gridPos > 0 && char.hp > 0) awardXp(char, base);
            else if (char.gridPos === 0) awardXp(char, Math.floor(base * RESERVE_XP_RATE));
        });

        let matDrops = (1 + Math.floor(Math.random() * 2)) * scrapMult + (hasRelic('SALVAGE_RIG') ? 1 : 0);
        for(let i=0; i<matDrops; i++) { let m = ['parts', 'chems', 'tech'][Math.floor(Math.random() * 3)]; materials[m]++; log(`> Salvaged: 1 ${m.toUpperCase()}`, "log-heal"); }

        document.getElementById('command-deck').innerHTML = `<button data-action="loot" data-amount="${s}">LOOT ${s}</button>`; combatActive = false; stopAmbience(); 
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
    initEngine, renderTitleScreen, renderCitadel, renderMap, renderOutpost, openSettings, closeSettings, selectSlot, confirmNewGame, continueGame, saveGameState, loadGameState, saveMeta, loadMeta, buyMetaUpgrade, advanceSector, renderCodex, executeSelfAction, resolveConsumableItem, hasContract, canCarry, craftItem, assignSlot, contractMult, contractNames, openContracts, toggleContract, renderContracts, beginExpedition, initiateEvent, pickEvent, initiateCamp, bookConsequence, consequencesDue, resolveConsequence, deployed, initiateCombat, resumeCombat, generateEnemies, renderField, checkWinState, processTurn, executeEnemyAi, applyDamageHit, applyTurnStartEffects, handleSquadWipe, endRun, collectLoot, emptyPoolScrap, hasRelic, unownedRelics, rollRelic, rollRelicOffer, renderRelicOffer, takeRelic, overdriveAt, heirloomFrom, heirloomRelic, stashHeirloom, generateBounties, rollBounty, checkBountyProgress, assignPerk, comboFor, comboHint, COMBOS, DAMAGING_MOVES, reachMult, reachNote, isOutOfDepth, isMelee, isRanged, pickTarget, renderCommandDeck, queueAction, cancelAction, resolveAction, renderDev, devJump, devFightBoss, devGive, devResolve, bossForSector, rollIntent, regroupSquad, regroupsLeft, totalRegroups, renderSquadBroken, migrateAssetPaths, migrateRelics, traitSummary, migrateTraits, buyUpgrade, computeScore, newRunStats, noteDepth, sectorRewardMult, formatStat, awardXp, log, playSFX, playImpact, voiceFor, startAmbience, stopAmbience, ambienceFor, initAudio, addMomentum, setOutpostTab,
    // engine constants
    Store, CORRUPT, PERK_POOL, ABILITIES, CODEX, SFX, CLASS_VOICE, MOVE_VOICE_OVERRIDE, AMBIENCE, SFX_LOG_MAX, CONTRACT_POOL, EVENT_POOL, CONSEQUENCE_POOL, EVENT_MEMORY, SECTOR_LAYOUT, EMPTY_POOL_SCRAP, OVERDRIVE_AT, OVERDRIVE_AT_CHARGED, OVERDRIVE_NAMES, MOVE_REACH, RANK_LABELS, INTENT_ICONS, REACH_PENALTY, DEPTH_PENALTY, FRONT_RANKS, BACKLINE_WEIGHT, GROUND_LIFT, RELIC_POOL, BOSS_POOL, resistBadges, dispatchAction, SECTOR_HP_SCALE, SECTOR_DMG_SCALE, XP_CURVE, BASE_SAVE_KEY, SETTINGS_KEY, META_KEY, TOTAL_TIERS, SECTOR_TIER_BONUS, BASE_REGROUPS, FACTION_ALLIES, RESERVE_XP_RATE, ASSET_LIST, ACTIONS, BOUNTY_POOL, ROSTER_TEMPLATE,
    // live run state, readable and writable so a suite can set up a scenario
    get audioCtx() { return audioCtx; }, set audioCtx(v) { audioCtx = v; },
    get sfxLog() { return sfxLog; }, set sfxLog(v) { sfxLog = v; },
    get ambienceBiome() { return ambienceBiome; },
    get ambienceNodes() { return ambienceNodes; },
    get currentSlot() { return currentSlot; }, set currentSlot(v) { currentSlot = v; },
    get globalSettings() { return globalSettings; }, set globalSettings(v) { globalSettings = v; },
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
    get pendingRelicOffer() { return pendingRelicOffer; }, set pendingRelicOffer(v) { pendingRelicOffer = v; },
    get combatBgFile() { return combatBgFile; }, set combatBgFile(v) { combatBgFile = v; },
    get pendingCombat() { return pendingCombat; }, set pendingCombat(v) { pendingCombat = v; },
    get runStats() { return runStats; }, set runStats(v) { runStats = v; },
    get activeContracts() { return activeContracts; }, set activeContracts(v) { activeContracts = v; },
    get pendingDifficulty() { return pendingDifficulty; }, set pendingDifficulty(v) { pendingDifficulty = v; },
    get activeEvent() { return activeEvent; }, set activeEvent(v) { activeEvent = v; },
    get pendingConsequences() { return pendingConsequences; }, set pendingConsequences(v) { pendingConsequences = v; },
    get recentEvents() { return recentEvents; }, set recentEvents(v) { recentEvents = v; },
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

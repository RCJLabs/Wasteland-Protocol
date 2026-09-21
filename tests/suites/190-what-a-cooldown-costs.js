// ── V02: WHAT A COOLDOWN COSTS ────────────────────────────────────────────────────────
//
// F09 routed every cooldown in the game through cdFor, so ION STORM's banner - "cooldowns a
// turn shorter" - could reach all of them instead of the third that happened to ask. That
// unified who MODIFIES a price. The price itself stayed a literal passed in at each of the 29
// resolve sites: `cdFor(actEnt, 'heavy_wrench', 3)`, a declaration living at its use site.
//
// So nothing could report one. U01 put what a move does on its button and the cooldown bit could
// only say the word "cooldown", because there was no table to read a number off - and a
// COUNTERWEIGHT, which takes a turn off the Heavy Wrench, had no surface anywhere saying so. The
// hostiles' signature cooldowns have been declared as data since they were written (`cd: 2` on
// the sig); the squad's were not. It is the same shape as U01's own two deck moves, declared
// inline where MOVE_REACH could not see them, and as the T-audit's prose: a number that decides
// something, written where only the thing it decides can read it.
//
// AND THREE PERKS WERE DOING cdFor's JOB ON THE WAY IN. QUICK_HANDS, SPARE_FILTERS and
// CONTROLLED_BURN each shortened one move by a ternary at the call site, while six weapon mods,
// the sky and a scar did the same thing inside cdFor. One question, answered in two places. All
// of it is in the one function now, so "what does this move cost this operator" has one answer.
//
// NOTHING ABOUT THE GAME MOVED. Every price resolves to what it did before, which is the first
// thing below - a refactor that changes a number is not a refactor.
const fs = require('fs');
const path = require('path');
const { engineUp } = require('../boot');

const MODS  = { heavy_wrench: 'COUNTERWEIGHT', cauterize: 'PRESSURE_SYRINGE',
                spotters_mark: 'SPOTTING_SCOPE', rip_and_tear: 'WAR_HARNESS',
                ripsaw: 'CHAIN_OILER', drag_line: 'SWIVEL_MOUNT' };
const PERKS = { flashbang: 'QUICK_HANDS', purge_valve: 'SPARE_FILTERS',
                thermite: 'CONTROLLED_BURN' };

module.exports = {
  name: 'What a cooldown costs',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`); await engineUp(page);

    // ── The declaration is the only copy ────────────────────────────────────────────
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'game.js'), 'utf8');
    const carried = (src.match(/cdFor\(actEnt, '[a-z_]+', /g) || []).length;
    ok(`no resolve site carries a price of its own any more (${carried})`, carried === 0);
    // A kill can REFUND a cooldown to zero, which is not a price - so the rule is that nothing
    // but cdFor ever writes a non-zero one.
    const writes = (src.match(/cooldowns\.[a-z_]+ = (?!cdFor|0;)/g) || []);
    ok(`and nothing but cdFor writes a non-zero cooldown (${writes.length})`, writes.length === 0);

    const table = await page.evaluate(([MODS, PERKS]) => {
      const declared = [...Object.values(ABILITIES).flat(), ...Object.values(FOURTH_ABILITIES)]
        .filter(a => a.cd);
      const bare = { id: 'z', isPlayer: true, classType: 'BRUISER', traits: [], scars: [] };
      return {
        declared: declared.length,
        keys: Object.keys(MOVE_CD).length,
        priceless: declared.filter(a => typeof a.cdTurns !== 'number').map(a => a.move),
        // every declared cooldown resolves, bare, to exactly what its table row says
        drift: declared.filter(a => cdFor(bare, a.cd) !== MOVE_CD[a.cd]).map(a => a.move),
        mods: Object.entries(MODS).map(([k, m]) => ({ k, m,
          on: cdFor({ ...bare, weaponMod: m }, k), off: cdFor(bare, k),
          // and it takes a turn off ITS move, not off the deck. IRON_GUARD is in none of the
          // six maps, so its price must be untouched by any of them.
          other: cdFor({ ...bare, weaponMod: m }, 'iron_guard') })),
        otherBare: cdFor(bare, 'iron_guard'),
        anchors: ['heavy_wrench', 'iron_guard', 'over_the_top', 'buckshot', 'stim_dart']
          .reduce((o, k) => (o[k] = MOVE_CD[k], o), {}),
        shape: Object.entries(Object.values(MOVE_CD).reduce((o, v) => (o[v] = (o[v] || 0) + 1, o), {}))
          .sort((a, b) => a[0] - b[0]).map(([v, n]) => `${v}: ${n}`).join(', '),
        perks: Object.entries(PERKS).map(([k, p]) => ({ k, p,
          on: cdFor({ ...bare, traits: [p] }, k), off: cdFor(bare, k) })),
        scarred: cdFor({ ...bare, scars: ['STIFF_JOINTS'] }, 'heavy_wrench'),
        // the floor: everything shortening the same move at once still leaves a turn
        floored: cdFor({ ...bare, weaponMod: 'COUNTERWEIGHT', scars: [] }, 'buckshot'),
      };
    }, [MODS, PERKS]);

    ok(`every move that declares a cooldown declares its price (${table.declared} of them)`,
      table.priceless.length === 0 && table.keys === table.declared);
    ok(`and the price it resolves to is the one declared (${table.drift.join(', ') || 'no drift'})`,
      table.drift.length === 0);
    // THE ROWS ABOVE COMPARE THE TABLE WITH ITSELF, which is worth saying because the first cut
    // of this suite had only those: mutating a price from 3 to 5 passed everything, because the
    // resolver and the assertion were reading the same mutated row. What the move COSTS has to
    // be pinned against something outside the table. Not a roll-call of all 29 - 19-position's
    // header is about exactly that, a copy of a table rather than a claim about it - but the
    // anchors whose number is the point, and the shape of the whole set.
    ok(`the anchors charge what they charged (${Object.entries(table.anchors).map(([k, v]) => k + ' ' + v).join(', ')})`,
      table.anchors.heavy_wrench === 3 && table.anchors.iron_guard === 3
      && table.anchors.over_the_top === 4 && table.anchors.buckshot === 2
      && table.anchors.stim_dart === 2);
    ok(`and the set is the shape it was - a cooldown is 2, 3 or 4 turns (${table.shape})`,
      table.shape === '2: 7, 3: 18, 4: 4');

    // ── The modifiers still modify, from the one place they now live ────────────────
    ok(`each of the six weapon mods still takes a turn off its own move `
       + `(${table.mods.map(m => `${m.k} ${m.off}->${m.on}`).join(', ')})`,
      table.mods.every(m => m.on === m.off - 1));
    // The first cut of this row compared IRON_GUARD's price under each mod against HEAVY
    // WRENCH's bare price. Both are 3, so it passed on a coincidence and would have kept
    // passing if a mod had started shortening the wrong move. It asks the real question now:
    // a move none of the six names costs the same with each of them on as with none.
    ok(`and off nothing else (iron_guard stays ${table.otherBare} under all six)`,
      table.mods.every(m => m.other === table.otherBare));
    ok(`each of the three perks does too, from inside cdFor rather than a ternary at the door `
       + `(${table.perks.map(p => `${p.k} ${p.off}->${p.on}`).join(', ')})`,
      table.perks.every(p => p.on === p.off - 1));
    ok(`a stiff-jointed operator pays a turn more (${table.scarred})`,
      table.scarred === table.mods.find(m => m.k === 'heavy_wrench').off + 1);
    ok(`and the floor holds at one turn (${table.floored})`, table.floored >= 1);

    // ── And the line in the fight says the number ───────────────────────────────────
    const said = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 4; currentNodeId = 'n7';
      const bru = playerRoster.find(c => c.classType === 'BRUISER');
      bru.weaponMod = 'COUNTERWEIGHT';
      initiateCombat('RAIDERS', false);
      const me = activeEntities.find(e => e.isPlayer && e.classType === 'BRUISER');
      const wrench = deckFor(me).find(a => a.move === 'HEAVY_WRENCH');
      activeIndex = turnQueue.findIndex(e => e.id === me.id);
      if (activeIndex < 0) { turnQueue.unshift(me); activeIndex = 0; }
      pendingAction = null; deckInspect = true; renderCommandDeck();
      const b = document.querySelector('#command-deck button[data-move="HEAVY_WRENCH"]');
      const onButton = b ? (b.querySelector('.move-what') || {}).textContent || '' : null;
      deckInspect = false;
      return { onButton, forOperator: moveDetail(wrench, me), manual: moveLine(wrench),
               engine: cdFor(me, 'heavy_wrench'), declared: MOVE_CD.heavy_wrench };
    });
    ok(`the deck names the price rather than the word (${said.onButton})`,
      !!said.onButton && said.onButton.includes(`cooldown ${said.engine}`));
    ok(`and it is the operator's price, not the table's (${said.engine} against ${said.declared})`,
      said.engine === said.declared - 1 && said.forOperator.includes(`cooldown ${said.engine}`));
    ok(`while the manual quotes the declared cost, having no hands to hold a mod (${said.manual})`,
      said.manual.includes(`cooldown ${said.declared}`));
  },
};

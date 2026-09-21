// X-audit. Four sweeps over the tree, two of them empty, two with something in them.
//
//   1  a property declared and never read      -> GRUDGE_CAP.keepsArmour, one occurrence in the
//                                                 whole tree: its own declaration
//   2  grudge/enrage fields, gated or not      -> armorBonus is the only one the cap withholds,
//                                                 and its announcement was not withheld with it
//   3  numbers in player prose vs the dials     -> too noisy to ratchet (248 hits, nearly all
//                                                 coincidence), but it surfaced SLOW TO RISE
//   4  functions declared and never called      -> EMPTY. all 11 candidates are harness or boot
//                                                 entry points called from the page or the suites
//
// FINDING 1: THE PLATE THE CAPPED MARSHAL NEVER RAISES. R01 declared GRUDGE_CAP with three
// fields; phaseAt and refundEnrage have readers and keepsArmour had none, because the behaviour
// it names was written at the use site as `!capShaped(enemy)`. Worse, two of the three places
// that describe it disagreed: the comment at the gate said the plate "comes off", the comment
// above the declaration said "the plate still goes on the Marshal", and the Marshal's own tell
// told the PLAYER "the plate goes back up" every time - including the 426 of 492 commander
// fights that are against a capped commander, where it does not.
//
// Measured before touching it: an uncapped Marshal opens the grudge phase at 10 armour and goes
// to 24; a capped one opens at 10 and stays at 10. The code was right the whole time. The dial,
// one comment and the player-facing line were the three things wrong about it.
//
// FINDING 2: EIGHT CARDS THAT WROTE THEIR NUMBERS TWICE. Seven scar and quirk cards spelled
// their effect out in the desc a player reads AND in the field the engine applies; SLOW TO RISE
// wrote out the bleed-out clock and the result of shortening it while the codex two screens away
// already read BLEED_OUT. PERK_POOL and GEAR_POOL do not do this - 0 of 23 cards with numbers in
// their text echo a field - so it was contained to two tables rather than a habit of the tree.
const POOLS = ['SCAR_POOL', 'QUIRK_POOL'];

module.exports = {
  name: 'What the audit ratcheted',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ---- FINDING 1: the plate, and the dial that decides it ----
    const plate = await page.evaluate(() => {
      const key = Object.keys(BOSS_POOL).find(k => BOSS_POOL[k].grudge && BOSS_POOL[k].grudge.armorBonus);
      const B = BOSS_POOL[key];
      const open = g => {
        localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
        initiateCombat('RAIDERS', false);
        const e = activeEntities.find(x => !x.isPlayer);
        e.classType = 'BOSS'; e.grudge = g; e.phase = 2; e.grudgeMove = B.grudge;
        e.maxHp = 400; e.hp = 400; e.armor = 10; e.baseArmor = 10;
        e.__enrageDmgScale = 1.2; e.dmgBase = 24;
        document.getElementById('log').innerHTML = '';
        openGrudgePhase(e);
        return { capped: capShaped(e), armor: e.armor, dmg: e.dmgBase,
                 log: document.getElementById('log').innerText };
      };
      const off = open(0), on = open(GRUDGE.cap);
      // The row that proves the dial is wired: turn it on and a capped commander keeps its plate.
      const was = GRUDGE_CAP.keepsArmour;
      GRUDGE_CAP.keepsArmour = true;
      const kept = open(GRUDGE.cap);
      GRUDGE_CAP.keepsArmour = was;
      return { plate: B.grudge.armorBonus, tell: B.grudge.tell, base: 10,
               off, on, kept, field: GRUDGE_CAP.keepsArmour };
    });
    ok(`an uncapped commander raises its plate (${plate.base} -> ${plate.off.armor})`,
      !plate.off.capped && plate.off.armor === plate.base + plate.plate);
    ok(`and a capped one does not (${plate.base} -> ${plate.on.armor})`,
      plate.on.capped && plate.on.armor === plate.base);
    // What the item is actually about: the player was told otherwise, in both cases.
    ok('the plate is announced on the turns it goes up',
      /plate goes back up/.test(plate.off.log));
    ok('and not announced on the turns it does not',
      !/plate goes back up/.test(plate.on.log));
    ok('the refund it pays instead is still said out loud',
      /starts spending/.test(plate.on.log) && plate.on.dmg < plate.off.dmg);
    // GRUDGE_CAP.keepsArmour had exactly one occurrence in the tree - its own declaration.
    ok(`and GRUDGE_CAP.keepsArmour is what decides it, not a literal at the use site `
       + `(${plate.base} -> ${plate.kept.armor} with the dial on)`,
      plate.field === false && plate.kept.capped && plate.kept.armor === plate.base + plate.plate);
    // The tell must not promise the half the cap withholds - which is the defect, stated as a rule.
    ok(`no commander's tell promises the plate (${plate.tell})`, !/plate/i.test(plate.tell || ''));

    // ---- what else the cap withholds, asked of the fights rather than of the source ----
    // The first draft of this pair grepped game.js for `capShaped` on the same line as a field,
    // and my own fix broke it: moving the gate onto its own line emptied the result. A source
    // regex was the wrong instrument for a question about behaviour. Every commander with a
    // grudge is opened twice instead, capped and not, and the two entities diffed.
    const diff = await page.evaluate(() => {
      const open = (B, g) => {
        localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
        initiateCombat('RAIDERS', false);
        const e = activeEntities.find(x => !x.isPlayer);
        e.classType = 'BOSS'; e.grudge = g; e.phase = 2; e.grudgeMove = B.grudge;
        e.maxHp = 400; e.hp = 400; e.armor = 10; e.baseArmor = 10; e.speed = 12;
        e.__enrageDmgScale = 1.2; e.dmgBase = 24;
        openGrudgePhase(e);
        return e;
      };
      const moved = new Set(), seen = [];
      Object.values(BOSS_POOL).filter(b => b.grudge).forEach(B => {
        const a = open(B, 0), c = open(B, GRUDGE.cap);
        seen.push(B.name);
        ['armor', 'baseArmor', 'dmgBase', 'speed', 'bloodDebt', 'revenantWard', 'phase']
          .forEach(k => { if (a[k] !== c[k]) moved.add(k); });
      });
      // And what the tells promise, against what the cap can take away. Scoped to the
      // commanders that HAVE a plate: the Ossuary's line says its armour comes off and goes
      // into the swing, which names armour and is exactly right, and a check that flagged it
      // would be reporting a defect that is not there. Only a commander whose plate the cap can
      // withhold can promise one it will not raise.
      const withheld = /arm(our|or)|plate/i;
      const promising = Object.values(BOSS_POOL).filter(b =>
        b.grudge && b.grudge.armorBonus
        && withheld.test(String(b.grudge.tell || b.grudge.cry || ''))).map(b => b.name);
      return { commanders: seen.length, moved: [...moved].sort(), promising };
    });
    ok(`across ${diff.commanders} commanders the cap changes the plate and the swing and `
       + `nothing else (${diff.moved.join(', ')})`,
      diff.commanders > 0
      && diff.moved.every(k => ['armor', 'baseArmor', 'dmgBase'].includes(k))
      && diff.moved.includes('armor') && diff.moved.includes('dmgBase'));
    ok(`and no commander's own words promise the plate the cap takes `
       + `(${diff.promising.join(', ') || 'none promise it'})`, diff.promising.length === 0);

    // ---- FINDING 2: a card's numbers, written once ----
    const cards = await page.evaluate(pools => {
      const out = { authored: [], derived: [], empty: [], echoed: [] };
      pools.forEach(name => {
        (window[name] || []).forEach(e => {
          const own = Object.getOwnPropertyDescriptor(e, 'desc');
          const stat = ['hp', 'dmg', 'spd'].some(k => e[k]) || !!e.bleedOff;
          const where = `${name}.${e.id}`;
          if (!e.desc) out.empty.push(where);
          if (own && typeof own.value === 'string') {
            out.authored.push(where);
            // The defect, as a live check: a card whose numbers are in fields AND spelled out.
            if (stat && /\d/.test(own.value)) out.echoed.push(`${where} "${own.value}"`);
          } else out.derived.push(where);
        });
      });
      return out;
    }, POOLS);
    ok(`no card spells out a number the engine already holds as a field `
       + `(${cards.echoed.join('; ') || 'none spelled out'})`, cards.echoed.length === 0);
    ok(`the ${cards.derived.length} cards whose effect IS a stat field read it back`,
      cards.derived.length >= 8);
    ok(`and the ${cards.authored.length} whose effect lives in a branch still say so in words`,
      cards.authored.length > 0);
    ok(`every card has something to say (${cards.empty.join(', ') || 'none blank'})`,
      cards.empty.length === 0);

    // The text itself, against the fields rather than against the formatter that built it.
    const text = await page.evaluate(() => {
      const find = (pool, id) => pool.find(e => e.id === id);
      const wrong = [];
      const check = (e, want) => { if (e && e.desc !== want) wrong.push(`${e.id}: "${e.desc}" != "${want}"`); };
      const q = id => find(QUIRK_POOL, id), s = id => find(SCAR_POOL, id);
      // Benefit first, cost second - the order every one of these was authored in.
      check(q('RECKLESS'), `+${q('RECKLESS').dmg} DMG, ${q('RECKLESS').hp} max HP`);
      check(q('STURDY'), `+${q('STURDY').hp} max HP, ${q('STURDY').spd} SPD`);
      check(s('TREMOR'), `${s('TREMOR').dmg} DMG. The hand will not hold steady.`);
      return { wrong, bleed: find(SCAR_POOL, 'SLOW_TO_RISE').desc, BLEED_OUT,
               off: find(SCAR_POOL, 'SLOW_TO_RISE').bleedOff,
               codex: (() => { const e = CODEX.find(c => /bleed|down/i.test(c.title) || c.id === 'SCARS');
                 return ''; })() };
    });
    ok(`a card's line is its own fields, in the order they were written `
       + `(${text.wrong.join('; ') || 'all three match'})`, text.wrong.length === 0);
    ok(`and the scar that shortens the clock reads it off the engine (${text.bleed})`,
      text.bleed === `Bleeds out in ${text.BLEED_OUT - text.off} turns instead of ${text.BLEED_OUT}.`);
    // The row above passes on a hardcoded sentence too, because BLEED_OUT is what it is and the
    // card takes one turn off it - the derived string and the written-out one are the same
    // characters today. Turning the dial is the only way to tell them apart, and BLEED_OUT is a
    // const; the card's own bleedOff is not, so that is the one to move.
    const responds = await page.evaluate(() => {
      const e = SCAR_POOL.find(c => c.id === 'SLOW_TO_RISE');
      const was = e.bleedOff;
      e.bleedOff = 2; const deeper = e.desc;
      e.bleedOff = was;  const back = e.desc;
      return { deeper, back, BLEED_OUT };
    });
    ok(`and the sentence moves when the card does (${responds.deeper})`,
      responds.deeper === `Bleeds out in ${responds.BLEED_OUT - 2} turns instead of ${responds.BLEED_OUT}.`
      && responds.back === text.bleed);

    // The manual already derived this one; the card does now too, so the two cannot disagree.
    const manual = await page.evaluate(() => {
      const hit = CODEX.map(c => { const b = typeof c.body === 'function' ? c.body() : c.body;
        return { id: c.id, text: String(b).replace(/<[^>]+>/g, ' ') }; })
        .filter(c => /of their own turns, counted down/.test(c.text));
      return { n: hit.length, says: hit.map(h => (/(\d+) of their own turns/.exec(h.text) || [])[1]) };
    });
    ok(`the manual and the card quote the same clock (${manual.says.join(', ')})`,
      manual.n > 0 && manual.says.every(v => Number(v) === text.BLEED_OUT));
  }
};

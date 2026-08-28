// Two abilities per class meant most turns were "press the one that isn't on cooldown", and the
// only status pairing worth setting up was oil plus fire. Everyone now has a third ability, two
// new statuses exist, and every pairing is declared in one table so the maths and the on-screen
// prompt cannot drift apart.
module.exports = {
  name: 'Statuses and combos',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // Puts one hero and one indestructible dummy on the field with cooldowns clear, so a single
    // ability can be measured without the rest of the squad or the enemy AI interfering.
    const duel = () => page.evaluate(() => {
      window.__duel = (classType, setup) => {
        currentSlot = 1; confirmNewGame(1.0); initiateCombat('RAIDERS', false);
        const hero = playerRoster.find(h => h.classType === classType);
        const foe = activeEntities.find(e => !e.isPlayer);
        hero.gridPos = 1; hero.maxHp = 9999; hero.hp = 9999; hero.dmgBase = 100; hero.stunnedTurns = 0;
        Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
        foe.maxHp = 100000; foe.hp = 100000; foe.armor = 0; foe.baseArmor = 0;
        foe.resistances = { phys: 0, bio: 0, energy: 0 };
        foe.corrodedTurns = 0; foe.markedTurns = 0; foe.bleedingTurns = 0;
        foe.oiledTurns = 0; foe.stunnedTurns = 0;
        activeEntities = [hero, foe]; turnQueue = [hero, foe];
        activeIndex = 0; combatActive = true; pendingAction = null;
        if (setup) setup(foe, hero);
        return { hero, foe };
      };
      // Fires one ability and reports the damage it did.
      window.__hit = (hero, foe, move) => {
        activeIndex = 0; combatActive = true; pendingAction = move;
        const before = foe.hp;
        resolveAction(foe.id);
        return before - foe.hp;
      };
    });
    await duel();

    // ---- every class has a third option ----
    const decks = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const out = {};
      playerRoster.forEach(h => {
        const { hero, foe } = window.__duel(h.classType);
        renderField();
        out[h.classType] = [...document.querySelectorAll('#command-deck [data-move]')]
          .map(b => b.dataset.move).filter(m => m !== 'OVERDRIVE');
      });
      return out;
    });
    const classes = Object.keys(decks);
    ok(`all ${classes.length} classes are represented`, classes.length === 7);
    ok('every class has three abilities, not two',
      classes.every(c => decks[c].length === 3));
    ok('no ability is shared between classes',
      new Set(Object.values(decks).flat()).size === 21);
    ok('the new abilities are the third slot',
      decks.SCAVENGER[2] === 'ACID_FLASK' && decks.PYROMANIAC[2] === 'THERMITE' &&
      decks.SHOTGUNNER[2] === 'EXECUTE_SHOT' && decks.SNIPER[2] === 'SPOTTERS_MARK' &&
      decks.HOUND[2] === 'RIP_AND_TEAR');

    // ---- and the new abilities cost a cooldown, so they are not just a better basic attack ----
    const cooled = await page.evaluate(() => {
      const cases = { SCAVENGER: ['ACID_FLASK', 'acid_flask'], PYROMANIAC: ['THERMITE', 'thermite'],
                      SHOTGUNNER: ['EXECUTE_SHOT', 'execute_shot'], SNIPER: ['SPOTTERS_MARK', 'spotters_mark'],
                      HOUND: ['RIP_AND_TEAR', 'rip_and_tear'] };
      const out = {};
      for (const [cls, [move, key]] of Object.entries(cases)) {
        const { hero, foe } = window.__duel(cls);
        window.__hit(hero, foe, move);
        const cd = hero.cooldowns[key];
        renderField();
        const btn = [...document.querySelectorAll('#command-deck [data-move]')].find(b => b.dataset.move === move);
        out[cls] = { cd, disabled: btn ? btn.disabled : null };
      }
      return out;
    });
    ok('every new ability goes on cooldown when used',
      Object.values(cooled).every(c => c.cd >= 3));

    // ---- the combo table is the single source of truth ----
    const table = await page.evaluate(() => ({
      rows: COMBOS.map(c => ({ move: c.move, needs: c.needs, name: c.name, mult: c.mult, consumes: c.consumes || null })),
      names: [...new Set(COMBOS.map(c => c.name))]
    }));
    ok(`the table declares ${table.rows.length} pairings`, table.rows.length === 7);
    ok('each pairing names a status a unit actually carries',
      table.rows.every(r => ['oiledTurns', 'bleedingTurns', 'stunnedTurns', 'corrodedTurns', 'markedTurns'].includes(r.needs)));
    ok('every pairing is a damage increase', table.rows.every(r => r.mult > 1));
    ok('the two new statuses each have a payoff',
      table.rows.some(r => r.needs === 'corrodedTurns') && table.rows.some(r => r.needs === 'markedTurns'));

    // ---- combos actually pay off in damage ----
    const payoff = await page.evaluate(() => {
      const trial = (cls, move, status) => {
        let { hero, foe } = window.__duel(cls);
        const plain = window.__hit(hero, foe, move);
        ({ hero, foe } = window.__duel(cls, f => { f[status] = 3; }));
        const combo = window.__hit(hero, foe, move);
        return { plain, combo, ratio: combo / Math.max(1, plain) };
      };
      return {
        MELTDOWN:  trial('PYROMANIAC', 'THERMITE', 'corrodedTurns'),
        CONFIRMED: trial('SHOTGUNNER', 'EXECUTE_SHOT', 'markedTurns'),
        REND:      trial('HOUND', 'RIP_AND_TEAR', 'bleedingTurns'),
        IGNITE:    trial('SHOTGUNNER', 'BUCKSHOT', 'oiledTurns'),
        EXPLOIT:   trial('SCAVENGER', 'PIPE_RIFLE', 'bleedingTurns'),
        EXECUTE:   trial('BRUISER', 'SCRAP_BLADE', 'stunnedTurns')
      };
    });
    // Damage carries a variance roll, so each is checked against a band around its multiplier
    // rather than an exact figure.
    const near = (got, want) => got > want * 0.8 && got < want * 1.25;
    ok(`MELTDOWN doubles thermite on a corroded target (x${payoff.MELTDOWN.ratio.toFixed(2)})`, near(payoff.MELTDOWN.ratio, 2.0));
    ok(`CONFIRMED doubles an execute on a marked target (x${payoff.CONFIRMED.ratio.toFixed(2)})`, near(payoff.CONFIRMED.ratio, 2.0));
    ok(`REND rewards tearing into a bleeding target (x${payoff.REND.ratio.toFixed(2)})`, near(payoff.REND.ratio, 1.8));
    ok(`IGNITE still fires oil (x${payoff.IGNITE.ratio.toFixed(2)})`, near(payoff.IGNITE.ratio, 2.0));
    ok(`EXPLOIT still punishes bleed (x${payoff.EXPLOIT.ratio.toFixed(2)})`, near(payoff.EXPLOIT.ratio, 1.5));
    ok(`EXECUTE still punishes stun (x${payoff.EXECUTE.ratio.toFixed(2)})`, near(payoff.EXECUTE.ratio, 1.5));

    // ---- statuses land, and last ----
    const applied = await page.evaluate(() => {
      const land = (cls, move, status) => {
        const { hero, foe } = window.__duel(cls);
        window.__hit(hero, foe, move);
        return foe[status];
      };
      return {
        corroded: land('SCAVENGER', 'ACID_FLASK', 'corrodedTurns'),
        marked:   land('SNIPER', 'SPOTTERS_MARK', 'markedTurns'),
        bleeding: land('HOUND', 'RIP_AND_TEAR', 'bleedingTurns')
      };
    });
    ok(`Acid Flask corrodes for ${applied.corroded} turns`, applied.corroded === 3);
    ok(`Spotter's Mark marks for ${applied.marked} turns`, applied.marked === 3);
    ok('Rip and Tear opens a bleed', applied.bleeding >= 3);

    // ---- the setup abilities trade damage for the status ----
    const tradeoff = await page.evaluate(() => {
      let { hero, foe } = window.__duel('SCAVENGER');
      const rifle = window.__hit(hero, foe, 'PIPE_RIFLE');
      ({ hero, foe } = window.__duel('SCAVENGER'));
      const flask = window.__hit(hero, foe, 'ACID_FLASK');
      ({ hero, foe } = window.__duel('SNIPER'));
      const quick = window.__hit(hero, foe, 'QUICK_SHOT');
      ({ hero, foe } = window.__duel('SNIPER'));
      const mark = window.__hit(hero, foe, 'SPOTTERS_MARK');
      return { rifle, flask, quick, mark };
    });
    ok('Acid Flask hits softer than the basic attack it replaces', tradeoff.flask < tradeoff.rifle);
    ok("Spotter's Mark hits softer than a quick shot", tradeoff.mark < tradeoff.quick);
    ok('but neither is free damage-wise', tradeoff.flask > 0 && tradeoff.mark > 0);

    // ---- corrosion strips armour ----
    const armour = await page.evaluate(() => {
      const { hero, foe } = window.__duel('SCAVENGER', f => { f.armor = 40; f.baseArmor = 40; });
      let before = foe.hp; applyDamageHit(hero, foe, 100, 'phys', null);
      const plated = before - foe.hp;
      foe.corrodedTurns = 3;
      before = foe.hp; applyDamageHit(hero, foe, 100, 'phys', null);
      const eaten = before - foe.hp;
      return { plated, eaten };
    });
    ok(`armour blocks damage normally (${armour.plated} of 100)`, armour.plated < 80);
    ok(`corrosion eats through it (${armour.eaten} of 100)`, armour.eaten > armour.plated + 20);

    // ---- mark is spent, corrosion is not ----
    const spend = await page.evaluate(() => {
      let { hero, foe } = window.__duel('SHOTGUNNER', f => { f.markedTurns = 3; });
      window.__hit(hero, foe, 'EXECUTE_SHOT');
      const markLeft = foe.markedTurns;
      ({ hero, foe } = window.__duel('PYROMANIAC', f => { f.corrodedTurns = 3; }));
      window.__hit(hero, foe, 'THERMITE');
      const corrodeLeft = foe.corrodedTurns;
      return { markLeft, corrodeLeft };
    });
    ok('a confirmed kill shot spends the mark', spend.markLeft === 0);
    ok('corrosion keeps burning after a meltdown', spend.corrodeLeft > 0);

    // ---- a mark any hit can cash in ----
    const generic = await page.evaluate(() => {
      let { hero, foe } = window.__duel('BRUISER');
      const plain = window.__hit(hero, foe, 'SCRAP_BLADE');
      ({ hero, foe } = window.__duel('BRUISER', f => { f.markedTurns = 3; }));
      const marked = window.__hit(hero, foe, 'SCRAP_BLADE');
      return { plain, marked, left: foe.markedTurns };
    });
    ok(`a mark boosts any damaging move (x${(generic.marked / generic.plain).toFixed(2)})`,
      near(generic.marked / generic.plain, 1.5));
    ok('and one hit uses it up', generic.left === 0);

    // ---- statuses tick down ----
    const decay = await page.evaluate(() => {
      const { foe } = window.__duel('SCAVENGER', f => { f.corrodedTurns = 2; f.markedTurns = 2; });
      applyTurnStartEffects(foe);
      const one = { c: foe.corrodedTurns, m: foe.markedTurns };
      applyTurnStartEffects(foe); applyTurnStartEffects(foe);
      return { one, end: { c: foe.corrodedTurns, m: foe.markedTurns } };
    });
    ok('corrosion and mark decay each turn', decay.one.c === 1 && decay.one.m === 1);
    ok('and expire rather than going negative', decay.end.c === 0 && decay.end.m === 0);

    // ---- the field shows what is on a unit ----
    const badges = await page.evaluate(() => {
      const { foe } = window.__duel('SCAVENGER', f => { f.corrodedTurns = 3; f.markedTurns = 3; f.bleedingTurns = 2; });
      pendingAction = null; renderField();
      return document.getElementById(foe.id).innerText;
    });
    ok('a corroded target is badged', badges.includes('🧪'));
    ok('a marked target is badged', badges.includes('🎯'));
    ok('older statuses still show alongside them', badges.includes('💧'));
    // Six statuses can sit on one unit now, and they used to share a nowrap line with the HP
    // numbers - so the row was squeezed and everything but the last badge was cut off.
    const badgeBox = await page.evaluate(() => {
      const read = () => {
        const el = document.querySelector('#enemy-team .status-badge');
        const ent = el.closest('.entity').getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return { shown: el.textContent, w: r.width, h: r.height,
                 clipped: el.scrollWidth > Math.ceil(r.width) || el.scrollHeight > Math.ceil(r.height),
                 spills: r.left < ent.left - 1 || r.right > ent.right + 1 };
      };
      const { foe } = window.__duel('SCAVENGER', f => {
        f.bleedingTurns = 2; f.stunnedTurns = 2; f.armorTurns = 1;
        f.oiledTurns = 2; f.corrodedTurns = 3; f.markedTurns = 3;
      });
      pendingAction = null; renderField();
      const full = read();
      foe.stunnedTurns = 0; foe.armorTurns = 0; foe.oiledTurns = 0; foe.corrodedTurns = 0; foe.markedTurns = 0;
      renderField();
      const one = read();
      foe.bleedingTurns = 0; renderField();
      const none = document.querySelector('#enemy-team .status-badge');
      return { full, one, bare: none === null };
    });
    ok(`all six statuses are shown at once (${badgeBox.full.shown})`,
      [...badgeBox.full.shown].filter(c => c.codePointAt(0) > 0x2000).length >= 6);
    ok('none of them is clipped', !badgeBox.full.clipped);
    ok('and the row stays within the unit', !badgeBox.full.spills);
    // The row is full width, so it is the height that tells you whether it wrapped.
    ok('a single status still fits on one line', badgeBox.one.h <= badgeBox.full.h);
    ok('and a clean unit gets no status row at all', badgeBox.bare);

    // ---- the prompt tells you before you commit, and it does not lie ----
    const hints = await page.evaluate(() => {
      const read = (cls, move, setup) => {
        const { foe } = window.__duel(cls, setup);
        pendingAction = move; renderField();
        const flag = document.querySelector('.combo-flag');
        const glow = document.querySelector('.entity.has-combo');
        return { text: flag ? flag.innerText.trim() : null, glowing: !!glow };
      };
      return {
        meltdown: read('PYROMANIAC', 'THERMITE', f => { f.corrodedTurns = 3; }),
        none:     read('PYROMANIAC', 'FLARE_GUN', f => { f.corrodedTurns = 3; }),
        confirmed: read('SHOTGUNNER', 'EXECUTE_SHOT', f => { f.markedTurns = 3; }),
        marked:   read('BRUISER', 'SCRAP_BLADE', f => { f.markedTurns = 3; }),
        clean:    read('HOUND', 'RIP_AND_TEAR', null)
      };
    });
    ok('a live combo is called out by name', hints.meltdown.text === 'MELTDOWN');
    ok('and the target is highlighted', hints.meltdown.glowing);
    // The flag used to sit at the intent icon's offset and hide it - the one thing the player
    // needs to read while deciding who to hit.
    const overlap = await page.evaluate(() => {
      window.__duel('PYROMANIAC', f => { f.corrodedTurns = 3; f.intent = { type: 'HEAVY', icon: '💥' }; });
      pendingAction = 'THERMITE'; renderField();
      const flag = document.querySelector('.combo-flag').getBoundingClientRect();
      const icon = document.querySelector('.entity.has-combo .intent-icon').getBoundingClientRect();
      const field = document.querySelector('.battlefield').getBoundingClientRect();
      return { clear: flag.bottom <= icon.top, iconShown: icon.height > 0,
               insideField: flag.top >= field.top - 1 };
    });
    ok('the flag sits clear of the intent icon', overlap.clear && overlap.iconShown);
    ok('and stays inside the battlefield', overlap.insideField);
    ok('a move with no pairing shows nothing', hints.none.text === null);
    ok('the mark payoff is named too', hints.confirmed.text === 'CONFIRMED');
    ok('a plain hit on a marked target still flags the bonus', hints.marked.text === 'MARKED');
    ok('a clean target shows no prompt', hints.clean.text === null);

    // The prompt is only worth having if it predicts the outcome. Every declared pairing is
    // checked both ways: the hint must appear, and the damage must actually rise.
    const truthful = await page.evaluate(() => {
      const owner = { SCRAP_BLADE: 'BRUISER', PIPE_RIFLE: 'SCAVENGER', BUCKSHOT: 'SHOTGUNNER',
                      MOLOTOV: 'PYROMANIAC', THERMITE: 'PYROMANIAC', EXECUTE_SHOT: 'SHOTGUNNER',
                      RIP_AND_TEAR: 'HOUND' };
      return COMBOS.map(c => {
        const cls = owner[c.move];
        let { hero, foe } = window.__duel(cls);
        const plain = window.__hit(hero, foe, c.move);
        ({ hero, foe } = window.__duel(cls, f => { f[c.needs] = 3; }));
        pendingAction = c.move; renderField();
        const flag = document.querySelector('.combo-flag');
        const shown = flag ? flag.innerText.trim() : null;
        const combo = window.__hit(hero, foe, c.move);
        return { name: c.name, move: c.move, shown, plain, combo, honest: shown === c.name && combo > plain };
      });
    });
    const lying = truthful.filter(t => !t.honest);
    ok('every declared combo shows its own name and pays out',
      lying.length === 0);
    if (lying.length) lying.forEach(l => console.log(`        ${l.move}: showed ${l.shown}, ${l.plain} -> ${l.combo}`));

    // The same promise has to hold for the generic mark, on every move that can cash it in.
    // An ability that sets its damage outright can silently throw the bonus away after the combo
    // block has already spent the mark, so each one is measured rather than assumed.
    const marked = await page.evaluate(() => {
      const owner = { SCRAP_BLADE: 'BRUISER', HEAVY_WRENCH: 'BRUISER', PISTOL: 'MEDIC', RAD_SHOT: 'MEDIC',
                      PIPE_RIFLE: 'SCAVENGER', FLASHBANG: 'SCAVENGER', ACID_FLASK: 'SCAVENGER',
                      FLARE_GUN: 'PYROMANIAC', MOLOTOV: 'PYROMANIAC', THERMITE: 'PYROMANIAC',
                      SLUG_SHOT: 'SHOTGUNNER', BUCKSHOT: 'SHOTGUNNER', EXECUTE_SHOT: 'SHOTGUNNER',
                      QUICK_SHOT: 'SNIPER', DEADEYE: 'SNIPER', SPOTTERS_MARK: 'SNIPER',
                      SNAP: 'HOUND', FERAL_BITE: 'HOUND', RIP_AND_TEAR: 'HOUND' };
      return Object.entries(owner).map(([move, cls]) => {
        let { hero, foe } = window.__duel(cls);
        const plain = window.__hit(hero, foe, move);
        ({ hero, foe } = window.__duel(cls, f => { f.markedTurns = 3; }));
        pendingAction = move; renderField();
        const flag = document.querySelector('.combo-flag');
        const shown = flag ? flag.innerText.trim() : null;
        const boosted = window.__hit(hero, foe, move);
        // The move may have its own pairing; either way, a flag shown must mean more damage.
        return { move, shown, plain, boosted, honest: shown === null || boosted > plain };
      });
    });
    const unpaid = marked.filter(m => !m.honest);
    ok(`every one of the ${marked.length} damaging moves pays out the bonus it advertises`,
      unpaid.length === 0);
    if (unpaid.length) unpaid.forEach(u => console.log(`        ${u.move}: showed ${u.shown} but ${u.plain} -> ${u.boosted}`));
    ok('and the mark is worth cashing in on every one of them',
      marked.every(m => m.shown !== null));

    // ---- the deck points at a pairing before the player goes hunting for it ----
    const deckFlags = await page.evaluate(() => {
      const read = (cls, setup) => {
        window.__duel(cls, setup);
        pendingAction = null; renderField();
        return [...document.querySelectorAll('#command-deck [data-move]')].map(b => ({
          move: b.dataset.move, lit: b.classList.contains('combo-ready'),
          tag: (b.querySelector('.combo-tag') || {}).textContent || null, off: b.disabled }));
      };
      return {
        corroded: read('PYROMANIAC', f => { f.corrodedTurns = 3; }),
        clean:    read('PYROMANIAC', null),
        marked:   read('BRUISER', f => { f.markedTurns = 3; })
      };
    });
    const thermite = deckFlags.corroded.find(b => b.move === 'THERMITE');
    ok('the ability that cashes in a status is flagged in the deck', thermite.lit);
    ok(`and says which pairing it is (${thermite.tag})`, thermite.tag === 'MELTDOWN');
    ok('the abilities with no pairing available are left alone',
      deckFlags.corroded.filter(b => b.move !== 'THERMITE').every(b => !b.lit));
    ok('a clean field lights nothing', deckFlags.clean.every(b => !b.lit));
    // A mark boosts every move equally, so lighting the whole deck for it would tell the player
    // nothing about which one to pick. The deck stays quiet; aiming is where the mark is called out.
    ok('a bare mark does not light the whole deck', deckFlags.marked.every(b => !b.lit));
    const stunned = await page.evaluate(() => {
      window.__duel('BRUISER', f => { f.stunnedTurns = 2; });
      pendingAction = null; renderField();
      return [...document.querySelectorAll('#command-deck [data-move]')].map(b => ({
        move: b.dataset.move, lit: b.classList.contains('combo-ready'),
        tag: (b.querySelector('.combo-tag') || {}).textContent || null }));
    });
    ok('but a named pairing on the same class does light its button',
      stunned.find(b => b.move === 'SCRAP_BLADE').lit);
    ok('and names it', stunned.find(b => b.move === 'SCRAP_BLADE').tag === 'EXECUTE');
    ok('leaving the rest of that deck alone',
      stunned.filter(b => b.move !== 'SCRAP_BLADE').every(b => !b.lit));

    // A flag on a button you cannot press would be worse than no flag.
    const cooled2 = await page.evaluate(() => {
      const { hero } = window.__duel('PYROMANIAC', f => { f.corrodedTurns = 3; });
      hero.cooldowns.thermite = 3;
      pendingAction = null; renderField();
      const b = [...document.querySelectorAll('#command-deck [data-move]')].find(x => x.dataset.move === 'THERMITE');
      return { off: b.disabled, lit: b.classList.contains('combo-ready'), label: b.textContent };
    });
    ok('an ability on cooldown is not flagged as ready', cooled2.off && !cooled2.lit);
    ok('and still shows its remaining turns', /\[3\]/.test(cooled2.label));

    // ---- the deck is built from the ability table, so a class cannot silently lose a button ----
    const fromTable = await page.evaluate(() => {
      const declared = Object.fromEntries(Object.entries(ABILITIES).map(([c, list]) => [c, list.map(a => a.move)]));
      const rendered = {};
      Object.keys(ABILITIES).forEach(c => {
        window.__duel(c); pendingAction = null; renderField();
        rendered[c] = [...document.querySelectorAll('#command-deck [data-move]')].map(b => b.dataset.move);
      });
      return { declared, rendered, overdrive: Object.keys(OVERDRIVE_NAMES) };
    });
    ok('every class in the table renders exactly what it declares',
      Object.keys(fromTable.declared).every(c => fromTable.declared[c].join() === fromTable.rendered[c].join()));
    ok('and every class has an overdrive name',
      fromTable.overdrive.length === Object.keys(fromTable.declared).length);

    // Iron Guard targets the user rather than an enemy, and the table has to preserve that.
    const selfCast = await page.evaluate(() => {
      window.__duel('BRUISER'); pendingAction = null; renderField();
      const b = [...document.querySelectorAll('#command-deck [data-move]')].find(x => x.dataset.move === 'IRON_GUARD');
      const others = [...document.querySelectorAll('#command-deck [data-move]')].filter(x => x.dataset.move !== 'IRON_GUARD');
      return { guard: b.dataset.action, rest: [...new Set(others.map(x => x.dataset.action))] };
    });
    ok('Iron Guard still casts on the user', selfCast.guard === 'self');
    ok('and everything else still queues a target', selfCast.rest.join() === 'queue');

    // ---- combos are something you do to the enemy, not your own squad ----
    const friendly = await page.evaluate(() => {
      const { hero } = window.__duel('MEDIC');
      hero.bleedingTurns = 3; hero.markedTurns = 3;
      return { combo: comboFor('PIPE_RIFLE', hero), hint: comboHint('PIPE_RIFLE', hero), none: comboHint('PIPE_RIFLE', null) };
    });
    ok('an ally carrying a status is not a combo target', friendly.combo === null && friendly.hint === null);
    ok('and no target at all is handled', friendly.none === null);

    // ---- a real fight still runs end to end with the new abilities in the deck ----
    await page.evaluate(() => { combatActive = false; });
    await page.waitForTimeout(700);
    const live = await page.evaluate(async () => {
      currentSlot = 1; confirmNewGame(1.0);
      playerRoster.forEach((h, i) => { h.gridPos = i < 4 ? i + 1 : 0; h.maxHp = 500; h.hp = 500; });
      initiateCombat('RAIDERS', false);
      const foe = activeEntities.find(e => !e.isPlayer);
      const hero = activeEntities.find(e => e.isPlayer && e.classType === 'SCAVENGER') || activeEntities.find(e => e.isPlayer);
      activeIndex = turnQueue.indexOf(hero); combatActive = true;
      Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
      pendingAction = hero.classType === 'SCAVENGER' ? 'ACID_FLASK' : 'PIPE_RIFLE';
      resolveAction(foe.id);
      return { corroded: foe.corrodedTurns, hurt: foe.hp < foe.maxHp, cleared: pendingAction };
    });
    ok('using a new ability in a live fight applies its status', live.corroded > 0 || live.hurt);
    ok('and clears the pending order afterwards', live.cleared === null);
  }
};

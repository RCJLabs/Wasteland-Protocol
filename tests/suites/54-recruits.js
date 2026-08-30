// The squad was the same seven every expedition: the muster chose who deployed, never who
// existed. Three operators now exist outside that template and are found on the road.
//
// The failure this phase kept producing is worth naming: a class wired into one table and not
// another. It never throws where you added it - the deck renders, the fight runs, and then some
// unrelated screen reads MASTERY_TITLES[cls] and shows undefined, or the class draws an
// overdrive that no branch implements and the button does nothing. So the first thing here
// walks every class anyone can field and demands the whole set, and it names none of them.
module.exports = {
  name: 'Recruits',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- who exists, and who you have to go and find ----
    const pool = await page.evaluate(() => ({
      starters: ROSTER_TEMPLATE.map(c => c.classType),
      recruits: RECRUIT_POOL.map(r => r.classType),
      ranks: RECRUIT_POOL.map(r => r.rank),
      ids: new Set([...ROSTER_TEMPLATE, ...RECRUIT_POOL].map(c => c.id)).size,
      total: ROSTER_TEMPLATE.length + RECRUIT_POOL.length,
      art: RECRUIT_POOL.filter(r => !ASSET_LIST.includes(r.img)).map(r => r.name),
      pitched: RECRUIT_POOL.every(r => r.pitch && r.pitch.length > 20),
      benched: RECRUIT_POOL.every(r => r.gridPos === 0)
    }));
    ok(`three operators exist outside the starting roster (${pool.recruits.join(', ')})`,
      pool.recruits.length === 3 && !pool.recruits.some(c => pool.starters.includes(c)));
    ok('each covering a different rank, front to back', new Set(pool.ranks).size === 3);
    ok('every id unique across the roster and the pool', pool.ids === pool.total);
    ok('every portrait is a real asset the preloader knows about', pool.art.length === 0);
    ok('each of them says who they are', pool.pitched);
    ok('and none of them arrives already deployed', pool.benched);

    // ---- the wiring check: every class, every table ----
    const wired = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const classes = [...new Set([...ROSTER_TEMPLATE, ...RECRUIT_POOL].map(c => c.classType))];
      const gaps = [];
      classes.forEach(c => {
        const deck = ABILITIES[c] || [];
        if (deck.length !== 3) gaps.push(`${c}: ${deck.length} abilities, not three`);
        if (!FOURTH_ABILITIES[c]) gaps.push(`${c}: no fourth verb for rank III`);
        if (!CLASS_QUIRKS[c]) gaps.push(`${c}: no class quirk for rank II`);
        if (!MASTERY_TITLES[c]) gaps.push(`${c}: no mastery title for rank I`);
        if (!CLASS_VOICE[c]) gaps.push(`${c}: no voice`);
        else if (!SFX[CLASS_VOICE[c]]) gaps.push(`${c}: voice "${CLASS_VOICE[c]}" is not in the sound table`);
        if ((OVERDRIVES[c] || []).length !== 2) gaps.push(`${c}: ${(OVERDRIVES[c] || []).length} overdrives, not two`);
        if (SIG_PERKS.filter(p => p.cls === c).length !== 4) gaps.push(`${c}: not four signature perks`);
        if (GEAR_POOL.filter(g => g.slot === 'mod' && g.cls === c).length !== 2) gaps.push(`${c}: not two weapon mods`);
        [...deck, FOURTH_ABILITIES[c]].filter(Boolean).forEach(a => {
          if (!MOVE_REACH[a.move]) gaps.push(`${c}: ${a.move} has no reach`);
          if (!a.label) gaps.push(`${c}: ${a.move} has no label`);
        });
      });
      // An overdrive nobody implements is a button that spends a full bar and does nothing.
      const dead = Object.values(OVERDRIVES).flat().filter(o => !src.includes(`variant.id === '${o.id}'`)).map(o => o.id);
      // A damaging verb left out of the list silently stops paying off a mark.
      const unlisted = Object.values(ABILITIES).flat()
        .filter(a => a.reach !== 'self' && !DAMAGING_MOVES.includes(a.move)).map(a => a.move);
      return { classes, gaps, dead, unlisted };
    });
    ok(`all ${wired.classes.length} playable classes are wired into every table they need`, wired.gaps.length === 0);
    if (wired.gaps.length) wired.gaps.forEach(g => console.log('        gap:', g));
    ok('every overdrive on offer has a branch that resolves it', wired.dead.length === 0);
    if (wired.dead.length) console.log('        unimplemented:', wired.dead.join(', '));
    ok('every attacking verb counts as a damaging move', wired.unlisted.length === 0);
    if (wired.unlisted.length) console.log('        unlisted:', wired.unlisted.join(', '));

    // Wiring is not the same as working: field each of them and drive the real deck.
    await page.evaluate(() => {
      window.__field = (classType) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        const tpl = RECRUIT_POOL.find(r => r.classType === classType);
        if (tpl && !playerRoster.some(c => c.id === tpl.id)) {
          const c = JSON.parse(JSON.stringify(tpl)); delete c.rank; delete c.pitch; playerRoster.push(c);
        }
        initiateCombat('RAIDERS', false);
        const hero = playerRoster.find(h => h.classType === classType);
        hero.gridPos = 1; hero.maxHp = 9999; hero.hp = 9999; hero.dmgBase = 100; hero.quirk = null;
        Object.keys(hero.cooldowns).forEach(k => hero.cooldowns[k] = 0);
        const foes = activeEntities.filter(e => !e.isPlayer).slice(0, 3);
        foes.forEach(f => { f.maxHp = 100000; f.hp = 100000; f.armor = 0; f.baseArmor = 0;
          f.resistances = { phys: 0, bio: 0, energy: 0 };
          f.corrodedTurns = 0; f.markedTurns = 0; f.bleedingTurns = 0; f.oiledTurns = 0; f.stunnedTurns = 0; });
        activeEntities = [hero, ...foes]; turnQueue = [hero, ...foes];
        activeIndex = 0; combatActive = true; pendingAction = null;
        return { hero, foes };
      };
    });

    const decks = await page.evaluate(() => {
      const out = {};
      RECRUIT_POOL.forEach(r => {
        window.__field(r.classType);
        renderField();
        const btns = [...document.querySelectorAll('#command-deck [data-move]')]
          .filter(b => b.dataset.move !== 'OVERDRIVE');
        out[r.classType] = { shown: btns.map(b => b.dataset.move),
                             blocked: btns.filter(b => b.disabled).map(b => b.dataset.move),
                             want: ABILITIES[r.classType].map(a => a.move) };
      });
      return out;
    });
    Object.entries(decks).forEach(([cls, d]) => {
      ok(`${cls} brings its whole deck to the field (${d.shown.join(', ')})`,
        d.want.every(m => d.shown.includes(m)));
      ok(`and none of it starts the fight locked`, d.blocked.length === 0);
    });

    // ---- the verbs that are new, not just renamed ----
    // Over The Top: he pays in health, and it runs out.
    const CHARGE_TURNS_EXPECTED = await page.evaluate(() => CHARGE_TURNS);
    const frenzy = await page.evaluate(() => {
      const { hero, foes } = window.__field('TRENCH_FIEND');
      hero.maxHp = 100; hero.hp = 100;
      const before = hero.hp;
      pendingAction = 'OVER_THE_TOP'; executeSelfAction('OVER_THE_TOP');
      const paid = before - hero.hp, cd = hero.cooldowns.over_the_top;
      const hit = () => { const h0 = foes[0].hp; pendingAction = 'BAYONET_THRUST'; resolveAction(foes[0].id); return h0 - foes[0].hp; };
      // Play it out the way the loop does: his turn starts, the state burns down, then he
      // swings. What is being counted is how many of his swings land under it.
      const swings = [];
      for (let t = 0; t < 5; t++) { applyTurnStartEffects(hero); swings.push({ lit: (hero.chargeTurns || 0) > 0, dmg: hit() }); }
      return { paid, swings, cost: FIEND_CHARGE_COST, mult: CHARGE_MULT, cd,
               under: swings.filter(x => x.lit), cold: swings.filter(x => !x.lit) };
    });
    ok(`going over the top costs him health (-${frenzy.paid} of 100)`,
      frenzy.paid === Math.floor(100 * frenzy.cost));
    ok('it never costs him the last of it', frenzy.paid < 100);
    ok(`and buys exactly ${frenzy.under.length} of his own swings`,
      frenzy.under.length === CHARGE_TURNS_EXPECTED);
    ok(`every one of them lands harder than one without it (${frenzy.under.map(x => x.dmg).join(', ')} vs ${frenzy.cold.map(x => x.dmg).join(', ')})`,
      frenzy.cold.length > 0 && Math.min(...frenzy.under.map(x => x.dmg)) > Math.max(...frenzy.cold.map(x => x.dmg)));
    ok('and then it is over, rather than running for the fight', frenzy.cold.length >= 2);
    ok(`it goes on cooldown (${frenzy.cd})`, frenzy.cd >= 3);

    // Purge Valve: a squad verb, not a self-heal.
    const purge = await page.evaluate(() => {
      const { hero } = window.__field('HAZMAT');
      const mate = playerRoster.find(c => c.id !== hero.id);
      mate.hp = 10; mate.maxHp = 100; mate.bleedingTurns = 3; mate.oiledTurns = 3; mate.corrodedTurns = 3;
      activeEntities.push(mate); hero.hp = 20; hero.maxHp = 100;
      pendingAction = 'PURGE_VALVE'; executeSelfAction('PURGE_VALVE');
      return { mateHp: mate.hp, mateClean: !mate.bleedingTurns && !mate.oiledTurns && !mate.corrodedTurns,
               selfHp: hero.hp, cd: hero.cooldowns.purge_valve };
    });
    ok(`the valve reaches the whole squad, not just the wearer (${purge.mateHp} up from 10)`, purge.mateHp > 10);
    ok('scrubbing bleed, oil and corrosion off them', purge.mateClean);
    ok('and it patches him too', purge.selfHp > 20);
    ok('on a cooldown', purge.cd >= 2);

    // Drag Line: the one verb in the game that moves an enemy.
    const haul = await page.evaluate(() => {
      const { hero, foes } = window.__field('HARPOONER');
      const order = () => activeEntities.filter(e => !e.isPlayer).map(e => e.id);
      const before = order();
      const back = before[before.length - 1];
      pendingAction = 'DRAG_LINE'; resolveAction(back);
      const after = order();
      // and hauling what is already at the front changes nothing
      pendingAction = 'DRAG_LINE'; turnQueue[activeIndex].cooldowns.drag_line = 0;
      resolveAction(after[0]);
      return { before, after, front: after[0], hauled: back, again: order(), n: foes.length };
    });
    ok(`the line hauls the back of the enemy order to the front (${haul.before.join('>')} became ${haul.after.join('>')})`,
      haul.n >= 2 && haul.front === haul.hauled);
    ok('without losing anyone out of the line',
      haul.after.length === haul.before.length && haul.before.every(id => haul.after.includes(id)));
    ok('and hauling the front rank is a no-op, not a shuffle', haul.again.join() === haul.after.join());

    // Bleed and corrosion, from the two that deal in them.
    const statuses = await page.evaluate(() => {
      const land = (cls, move) => {
        const { hero, foes } = window.__field(cls);
        pendingAction = move; resolveAction(foes[0].id);
        return { bleed: foes[0].bleedingTurns, corroded: foes[0].corrodedTurns,
                 behind: foes[1] ? foes[1].corrodedTurns : null };
      };
      return { ripsaw: land('TRENCH_FIEND', 'RIPSAW'), barbed: land('HARPOONER', 'BARBED_SHOT'),
               burst: land('HAZMAT', 'CAUSTIC_BURST') };
    });
    ok(`Ripsaw opens a wound (${statuses.ripsaw.bleed} turns)`, statuses.ripsaw.bleed === 3);
    ok(`Barbed Shot opens one at range (${statuses.barbed.bleed} turns)`, statuses.barbed.bleed === 3);
    ok(`Caustic Burst eats plate (${statuses.burst.corroded} turns)`, statuses.burst.corroded === 3);
    ok('on the body behind it as well', statuses.burst.behind === 3);

    // ---- finding them ----
    const node = await page.evaluate(() => {
      let seen = 0, offered = 0;
      for (let i = 0; i < 60; i++) {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        const map = generateSectorMap(seededRng('rec' + i));
        const n = map.nodes.filter(x => x.type === 'RECRUIT');
        if (n.length) { seen++; offered += n.length; }
        if (n.length && !validateSectorMap(map)) return { broken: i };
      }
      return { seen, offered, of: 60 };
    });
    ok(`a survivor turns up on ${node.seen} maps in ${node.of}`, node.seen > 5 && node.seen < node.of);
    ok('never more than one per map', node.offered === node.seen);
    ok('and a map carrying one is still a valid map', !node.broken);

    // ---- signing on ----
    const sign = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 4;
      const before = playerRoster.length;
      pendingRecruit = { nodeId: 'x', id: RECRUIT_POOL[0].id, cost: recruitCost(), taken: false };
      const cost = pendingRecruit.cost;
      scrap = cost - 1;
      signOnRecruit();
      const brokeResult = playerRoster.length;
      scrap = cost + 500;
      signOnRecruit();
      const ch = playerRoster.find(c => c.id === RECRUIT_POOL[0].id);
      const paid = cost + 500 - scrap;
      // and not twice
      pendingRecruit = { nodeId: 'y', id: RECRUIT_POOL[0].id, cost: 1, taken: false };
      signOnRecruit();
      return { before, brokeResult, after: playerRoster.length, paid, cost,
               benched: ch ? ch.gridPos === 0 : null, hurt: ch ? ch.hp < ch.maxHp : null,
               quirk: ch ? !!ch.quirk : null, alive: ch ? ch.hp > 0 : null,
               left: recruitables().length, dupes: playerRoster.filter(c => c.id === RECRUIT_POOL[0].id).length };
    });
    ok('a purse short of the price signs nobody', sign.brokeResult === sign.before);
    ok(`paying the price adds a body (${sign.before} to ${sign.after})`, sign.after === sign.before + 1);
    ok(`and takes exactly the price for it (${sign.paid} of ${sign.cost})`, sign.paid === sign.cost);
    ok('they join the bench rather than the line', sign.benched);
    ok('carrying what the road did to them, but standing', sign.hurt && sign.alive);
    ok('and a quirk, like anyone the muster rolls', sign.quirk);
    ok('nobody can be signed on twice', sign.dupes === 1);
    ok('and the pool remembers who is already yours', sign.left === 2);

    const cost = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 1; currentTier = 1; const shallow = recruitCost();
      currentSector = 4; currentTier = 8; const deep = recruitCost();
      return { shallow, deep, base: RECRUIT_COST.base };
    });
    ok(`the price rides the sector (${cost.shallow} shallow, ${cost.deep} deep)`, cost.deep > cost.shallow * 2);
    ok('and starts at what the table says', cost.shallow === cost.base);

    const level = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      playerRoster.forEach(c => { c.level = 6; });
      currentSector = 4; currentTier = 5; scrap = 99999;
      pendingRecruit = { nodeId: 'x', id: RECRUIT_POOL[2].id, cost: recruitCost(), taken: false };
      signOnRecruit();
      const ch = playerRoster.find(c => c.id === RECRUIT_POOL[2].id);
      return { level: ch.level, perks: ch.perkPoints };
    });
    ok(`somebody signed on six sectors in arrives at the squad's level (${level.level})`, level.level === 6);
    ok('with the perk points that level is worth', level.perks === level.level - 1);

    // ---- the screen ----
    const screen = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 4; currentNodeId = 'n4_1'; scrap = 5000;
      initiateRecruit();
      const shown = getComputedStyle(document.getElementById('screen-recruit')).display;
      const body = document.getElementById('recruit-body').innerText;
      const tpl = recruitById(pendingRecruit.id);
      const verbs = ABILITIES[tpl.classType].map(a => a.label);
      const signBtn = document.getElementById('recruit-sign');
      return { shown, tpl: tpl.name, has: body.toLowerCase().includes(tpl.name.toLowerCase()),
               wantImg: tpl.img,
               verbs: verbs.filter(v => !body.includes(v)),
               stats: body.includes(String(tpl.maxHp)) && body.includes(String(tpl.dmgBase)),
               priced: signBtn.innerText.includes(String(pendingRecruit.cost)),
               img: (document.querySelector('.recruit-portrait') || {}).getAttribute
                 ? document.querySelector('.recruit-portrait').getAttribute('src') : null };
    });
    ok('standing on the node opens the screen', screen.shown === 'flex');
    ok(`it says who is standing there (${screen.tpl})`, screen.has);
    ok('and what they bring, verb by verb', screen.verbs.length === 0);
    ok('and what they are worth in a fight', screen.stats);
    ok('the price is on the button, not in the fine print', screen.priced);
    ok(`and their portrait is the one from the table (${screen.img})`, screen.img === screen.wantImg);

    // The screens that list the squad were written when the squad was a fixed seven. A recruit
    // that signs on and then does not appear anywhere you could deploy them is a dead purchase.
    const listed = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const seven = playerRoster.length;
      RECRUIT_POOL.forEach(r => { const c = JSON.parse(JSON.stringify(r)); delete c.rank; delete c.pitch; playerRoster.push(c); });
      renderMuster();
      const musterRows = document.querySelectorAll('#muster-body .muster-row').length;
      const musterNames = document.getElementById('muster-body').innerText;
      setOutpostTab('ROSTER');
      const cards = document.getElementById('outpost-roster').innerText;
      const cyber = document.getElementById('cybernetics-roster').innerText;
      return { seven, all: playerRoster.length, musterRows,
               missingMuster: RECRUIT_POOL.filter(r => !musterNames.includes(r.name)).map(r => r.name),
               missingOutpost: RECRUIT_POOL.filter(r => !cards.includes(r.name)).map(r => r.name),
               missingCyber: RECRUIT_POOL.filter(r => !cyber.includes(r.name)).map(r => r.name) };
    });
    ok(`the muster lists every operator, not the first ${listed.seven} (${listed.musterRows} rows)`,
      listed.musterRows === listed.all);
    ok('a recruit can be given a rank at the muster', listed.missingMuster.length === 0);
    ok('and appears on the Outpost roster', listed.missingOutpost.length === 0);
    ok('and can be augmented like anyone else', listed.missingCyber.length === 0);

    const broke = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 2; currentTier = 4; currentNodeId = 'n4_1';
      initiateRecruit();
      scrap = 0; renderRecruit();
      const disabled = document.getElementById('recruit-sign').disabled;
      scrap = 99999; renderRecruit();
      return { disabled, enabled: !document.getElementById('recruit-sign').disabled };
    });
    ok('an empty purse greys the offer out rather than hiding it', broke.disabled);
    ok('and finding the scrap opens it again', broke.enabled);

    // Everyone already signed: the camp is cold, and still worth stripping.
    const empty = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      RECRUIT_POOL.forEach(r => { const c = JSON.parse(JSON.stringify(r)); delete c.rank; delete c.pitch; playerRoster.push(c); });
      currentNodeId = 'n4_1'; scrap = 0;
      initiateRecruit();
      const note = document.getElementById('recruit-note').innerText;
      const signShown = document.getElementById('recruit-sign').style.display;
      leaveRecruit();
      return { none: recruitables().length, note: note.length > 20, signShown, scrap, paid: EMPTY_POOL_SCRAP };
    });
    ok('with everyone signed there is nobody left to find', empty.none === 0);
    ok('the node says so rather than showing an empty card', empty.note && empty.signShown === 'none');
    ok(`and it still pays out (${empty.scrap})`, empty.scrap === empty.paid);

    // ---- the offer survives a reload ----
    const kept = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentNodeId = 'n4_1'; scrap = 5000;
      initiateRecruit();
      const first = pendingRecruit.id;
      saveGameState();
      pendingRecruit = null; playerRoster = [];
      loadGameState();
      const restored = pendingRecruit ? pendingRecruit.id : null;
      initiateRecruit();
      return { first, restored, stable: pendingRecruit.id };
    });
    ok('the survivor you are standing in front of is remembered across a reload',
      kept.restored === kept.first);
    ok('and re-entering the node does not roll a different one', kept.stable === kept.first);

    const fresh = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentNodeId = 'n4_1'; initiateRecruit();
      const mid = !!pendingRecruit;
      buildNewRun(1.0);
      return { mid, after: pendingRecruit, roster: playerRoster.length, template: ROSTER_TEMPLATE.length };
    });
    ok('a new expedition clears whoever was standing on the last one', fresh.mid && fresh.after === null);
    ok('and starts from the seven again', fresh.roster === fresh.template);
  }
};

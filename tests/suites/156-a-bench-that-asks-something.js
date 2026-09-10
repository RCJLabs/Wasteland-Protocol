// K05 was filed as "three augments is the thinnest axis in the game, and materials are the
// currency with almost nowhere to go". Measured before anything was written, that premise came
// apart three times:
//
//   - MATERIALS ARE NOT DEAD. Over three 150-expedition careers, 33 of them went into the bench
//     and 105 into schematics, against 10 left standing at the end of a run - 94% spent.
//   - THE BENCH IS NOT IDLE. 15 augments went in per run, and 45% of bodies ended at the cap.
//   - AND IT IS NOT A CHECKLIST. installAugment caps SLOTS, not repeats, so three of one is
//     legal and the manual has always said so. Of filled bodies, only 20% carried one of each;
//     21% carried three of the same, and eight distinct sets turned up in twenty-five runs.
//
// What was actually true is narrower and it survived the measuring: all three rows were flat
// stat bumps, so nothing about the run ever bore on which one to buy. The spread above is a fact
// about which materials happened to be in the bag, not about a decision anybody made.
//
// So each material now buys a second thing, and the second thing is situational where the first
// is flat: parts buy a bigger bar or a thicker hide, chems buy speed or a sealed suit, tech buys
// damage or an earth strap. K02 gave six of the rank and file a damage type and K04 put the
// badge on the squad, so which answer is worth carrying is now a question the road asks and the
// field answers.
//
// SIZED BY WHAT EACH TYPE THROWS, measured in K02: the squad meets physical on 61% of the blows
// aimed at it, energy on 25%, bio on 13%. A flat subtraction is worth its size times how often
// it is met, so the numbers run the other way to the incidence and all three come out worth
// about five points off an average blow. The rarest is the one a body can wall off completely -
// three rebreathers is 105, over the hundred that makes an immunity.
//
// What is pinned here: the shelf is bigger than the cap, every material asks a question, each
// answer's label is the number its apply() actually moves, and three of one still reaches the
// wall the manual promises. Read off the table and the engine, never restated here.
module.exports = {
  name: 'A bench that asks something',
  run: async ({ page, ok, base, resized, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── The shelf is bigger than the cap ───────────────────────────────────────────
    // Which is the whole difference between choosing three and taking all of them. Asserted
    // against AUGMENT_SLOTS rather than against a number written here, so a phase that widens
    // the cap has to come back to this row.
    const shelf = await page.evaluate(() => ({
      n: AUGMENTS.length, slots: AUGMENT_SLOTS,
      ids: AUGMENTS.map(a => a.id),
      byMat: AUGMENTS.reduce((m, a) => { (m[a.mat] = m[a.mat] || []).push(a.id); return m; }, {}),
      kinds: MATERIAL_KINDS.slice(),
      flat: AUGMENTS.filter(a => !a.answers).map(a => a.id),
      answers: AUGMENTS.filter(a => a.answers).map(a => ({ id: a.id, mat: a.mat, ...a.answers })),
      costs: AUGMENTS.map(a => `${a.id} ${a.cost} ${a.mat}`)
    }));
    ok(`the bench carries more than a body can hold (${shelf.n} rows, ${shelf.slots} slots)`,
      shelf.n > shelf.slots);
    ok(`every id is its own (${shelf.ids.join(', ')})`, new Set(shelf.ids).size === shelf.n);
    // The shape the economy keeps: each material still buys, and now buys a question.
    ok(`every material buys something (${shelf.kinds.map(k => `${k} ${(shelf.byMat[k] || []).length}`).join(', ')})`,
      shelf.kinds.every(k => (shelf.byMat[k] || []).length >= 2));
    ok(`and every material buys both a flat stat and an answer (${JSON.stringify(shelf.byMat)})`,
      shelf.kinds.every(k => (shelf.byMat[k] || []).some(id => shelf.flat.includes(id))
        && (shelf.byMat[k] || []).some(id => shelf.answers.some(a => a.id === id))));
    ok(`the three answers cover the three types the badges know (${shelf.answers.map(a => `${a.id} ${a.type}+${a.by}`).join(', ')})`,
      new Set(shelf.answers.map(a => a.type)).size === 3);

    // ── The label is the number the engine moves ───────────────────────────────────
    // `answers` is what the policy and the manual read; apply() is what the operator gets. A
    // row whose two halves disagree is a bench that lies about its own price, so the claim is
    // asked of apply() directly rather than of the field beside it.
    const honest = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      return AUGMENTS.filter(a => a.answers).map(a => {
        const body = { resistances: { phys: 0, bio: 0, energy: 0 }, maxHp: 100, hp: 100,
                       dmgBase: 10, speed: 10 };
        a.apply(body);
        const moved = Object.entries(body.resistances).filter(([, v]) => v !== 0);
        return { id: a.id, said: `${a.answers.type}+${a.answers.by}`,
                 did: moved.map(([k, v]) => `${k}+${v}`).join(','), n: moved.length };
      });
    });
    honest.forEach(r => {
      ok(`${r.id} moves exactly what it says it moves (says ${r.said}, does ${r.did})`,
        r.n === 1 && r.did === r.said);
    });

    // ── Three of one is still a build, and the rarest one is a wall ────────────────
    // The manual has promised "three of one is a build" since the cap was written, and nothing
    // has ever checked that a body can actually reach one. Driven through installAugment with a
    // real purse, so the slot rule and the price are the game's rather than this test's.
    const build = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const who = playerRoster.find(c => c.gridPos > 0);
      who.augments = []; who.resistances = { phys: 0, bio: 0, energy: 0 };
      const a = AUGMENTS.find(x => x.answers && x.answers.type === 'bio');
      materials = { parts: 99, chems: 99, tech: 99 };
      const took = [0, 1, 2].map(() => installAugment(who.id, a.id));
      const fourth = installAugment(who.id, a.id);
      // What the wall is worth, asked of mitigate rather than of the number on the body.
      const foe = { id: 'k5', name: 'Thrower', isPlayer: false, hp: 50, maxHp: 50, cooldowns: {} };
      activeEntities = [who, foe];
      const landed = mitigate(foe, who, 60, 'bio', null).n;
      const stillPhys = mitigate(foe, who, 60, 'phys', null).n;
      return { took, fourth, bio: who.resistances.bio, worn: [...who.augments],
               landed, stillPhys, spent: 99 - materials.chems, price: a.cost, id: a.id };
    });
    ok(`a body can take three of the same (${build.worn.join(' + ')})`,
      build.took.every(Boolean) && build.worn.length === 3);
    ok(`and pays for every one of them (${build.spent} chems at ${build.price} each)`,
      build.spent === build.price * 3);
    ok('the fourth is refused, whatever is in the bag', build.fourth === false);
    ok(`three of them is a wall rather than a discount (${build.bio} bio, a 60 blow lands ${build.landed})`,
      build.bio >= 100 && build.landed === 0);
    // The cost of building it: a body that shrugs off one thing entirely still stands in front
    // of the other two, which is what stops the wall from being the only build.
    ok(`and the same body takes physical as it always did (60 lands ${build.stillPhys})`,
      build.stillPhys === 60);

    // ── The prices did not move ───────────────────────────────────────────────────
    // The bench got twice the rows at the same cost per material, so nothing about what a run
    // can afford changed - which is what makes this a wider choice rather than a cheaper one.
    const priced = await page.evaluate(() => {
      const by = {};
      AUGMENTS.forEach(a => { (by[a.mat] = by[a.mat] || []).push(a.cost); });
      return by;
    });
    ok(`each material charges one price for its shelf (${Object.entries(priced).map(([k, v]) => `${k} ${v.join('/')}`).join(', ')})`,
      Object.values(priced).every(v => new Set(v).size === 1));

    // ── The Outpost offers all of them, and the manual lists all of them ──────────
    const surfaces = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      materials = { parts: 99, chems: 99, tech: 99 };
      renderOutpost();
      const btns = [...document.querySelectorAll('#cybernetics-roster .aug-btn')];
      const first = playerRoster[0];
      const mine = btns.filter(b => b.getAttribute('data-id') === first.id);
      materials = { parts: 0, chems: 0, tech: 0 };
      renderOutpost();
      const broke = [...document.querySelectorAll('#cybernetics-roster .aug-btn')]
        .filter(b => b.getAttribute('data-id') === first.id);
      const page = CODEX.find(c => c.id === 'BAG').body().join(' ');
      return { offered: mine.map(b => b.getAttribute('data-kind')),
               disabled: broke.filter(b => b.disabled).length, of: broke.length,
               named: AUGMENTS.filter(a => page.includes(a.name)).length, rows: AUGMENTS.length };
    });
    ok(`the bench offers every row to every operator (${surfaces.offered.join(', ')})`,
      surfaces.offered.length === surfaces.rows
      && new Set(surfaces.offered).size === surfaces.rows);
    ok(`and greys out what an empty bag cannot buy (${surfaces.disabled} of ${surfaces.of})`,
      surfaces.disabled === surfaces.of && surfaces.of > 0);
    ok(`the manual names all of them (${surfaces.named} of ${surfaces.rows})`,
      surfaces.named === surfaces.rows);

    // ── And twice the rows still fit the screen they are offered on ───────────────
    // Doubling a button row is the C11/D15 shape, so it is measured rather than assumed. The
    // buttons wrap to two rows and the card grows with them: 189px at desktop and 257-271 on a
    // phone, with nothing pushed past the edge and no sideways scroll at any width.
    for (const [w, h] of [[1280, 800], [400, 700], [360, 640]]) {
      await resized(page, { width: w, height: h });
      const fit = await page.evaluate(() => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        materials = { parts: 99, chems: 99, tech: 99 };
        switchScreen('screen-outpost');
        renderOutpost();
        // The bench lives behind a tab, and a hidden element measures zero - which a first pass
        // read as "nothing overflows" at every width.
        document.getElementById('outpost-cyber-view').style.display = 'flex';
        const cards = [...document.querySelectorAll('#cybernetics-roster .upgrade-card')];
        const btns = [...document.querySelectorAll('.aug-btn')];
        return { cards: cards.length, btns: btns.length,
                 h: cards[0] ? Math.round(cards[0].getBoundingClientRect().height) : 0,
                 past: btns.filter(b => { const x = b.getBoundingClientRect();
                   return x.right > window.innerWidth + 1 || x.left < -1; }).length,
                 clipped: cards.filter(c => c.scrollWidth > c.clientWidth + 1).length,
                 sideways: document.body.scrollWidth > window.innerWidth };
      });
      ok(`at ${w} wide the bench is drawn and measurable (${fit.cards} cards, ${fit.btns} buttons, first card ${fit.h}px)`,
        fit.cards > 0 && fit.btns === fit.cards * 6 && fit.h > 0);
      ok(`and nothing is pushed off it (${fit.past} past the edge, ${fit.clipped} clipped, sideways ${fit.sideways})`,
        fit.past === 0 && fit.clipped === 0 && !fit.sideways);
    }
    await resized(page, { width: 1280, height: 800 });

    // ── And what it bought reads on the operator ──────────────────────────────────
    // The through-line from K02 and K04: the augment moves a resistance, the roster card names
    // it, and the field badge shows it. Bought through the bench, read off the two surfaces.
    const reads = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 3; currentTier = 6;
      const who = playerRoster.find(c => c.gridPos > 0);
      who.augments = []; who.resistances = { phys: 0, bio: 0, energy: 0 };
      initiateCombat('RAIDERS', false); renderField();
      const before = document.querySelectorAll(`#${who.id} .res-row`).length;
      combatActive = false;
      const rod = AUGMENTS.find(a => a.answers && a.answers.type === 'energy');
      materials = { parts: 99, chems: 99, tech: 99 };
      installAugment(who.id, rod.id);
      renderOutpost();
      const card = [...document.querySelectorAll('.upgrade-card')]
        .find(c => c.querySelector(`[data-id="${who.id}"]`));
      const line = card && card.querySelector('.upgrade-res');
      initiateCombat('RAIDERS', false); renderField();
      const after = document.querySelectorAll(`#${who.id} .res-row`).length;
      const r = { before, after, said: line ? line.innerText.trim() : null, id: rod.id };
      combatActive = false;
      return r;
    });
    ok(`before the bench the operator carried nothing to show (${reads.before} badges)`,
      reads.before === 0);
    ok(`${reads.id} puts a badge on them (${reads.after} badges)`, reads.after === 1);
    ok(`and the roster card names what it bought (${reads.said})`,
      /ENERGY RESIST/i.test(reads.said || ''));
  }
};

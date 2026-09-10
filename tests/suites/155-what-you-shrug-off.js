// K04: resistBadges opened with `if (ent.isPlayer || !ent.resistances) return ''`, so an
// operator's own P/B/E marks never rendered on the field. That guard was right when it was
// written: 97% of what came at the squad was physical, and a badge reading "shrugs bio" against
// a bestiary that threw none is noise on a crowded row.
//
// K02 gave six of the rank and file a damage type. The squad now meets bio on about 13% of the
// blows aimed at it and energy on 25%, so which operator is standing in front of a censer bearer
// is a thing to read rather than to remember - and the answers are buyable, which means the
// screen where they are bought has to show what they did. The roster card showed HP, damage and
// the upgrade price and nothing at all about what a body shrugs off.
//
// Both surfaces now say it, and they say it with ONE function rather than two copies of the
// wording, because the recruit card already had its own and a third would have drifted first.
//
// The layout was the reason this was left out of K02 rather than shipped with it. Measured
// before the guard came off and again after, at 1280, 400, 360 and 320 wide, with every
// operator carrying a badge: the cards are bottom-aligned, so a badge row grows a player card
// upward by about twelve pixels - from 36-52px to 48-64px, against enemy cards that already
// reach 102 on the same row. Nothing new clips. One enemy sprite does sit outside the viewport
// at 360 wide, and it does so with the guard IN as well - it is fitEnemyRow's wobble on a
// six-strong Carrion draw, not this.
//
// What is pinned here: the same rule reads both ways, the badge follows the live line rather
// than the class template, the dead carry none, the roster card names what the field shows, and
// the field still fits with the whole line badged.
module.exports = {
  name: 'What you shrug off',
  run: async ({ page, ok, base, resized, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── One rule, read both ways ───────────────────────────────────────────────────
    // The same line handed to resistBadges as an operator and as a hostile. A build that kept a
    // separate rule for the squad - a different threshold, a different glyph - fails here even
    // if both happen to render something.
    const rule = await page.evaluate(() => {
      const line = { phys: 8, bio: 100, energy: -6 };
      const mine = resistBadges({ isPlayer: true, resistances: { ...line } });
      const theirs = resistBadges({ isPlayer: false, resistances: { ...line } });
      const strip = h => h.replace(/\s+/g, ' ');
      return { mine: strip(mine), theirs: strip(theirs), same: strip(mine) === strip(theirs),
               glyphs: DMG_TYPES.map(([, g]) => g) };
    });
    ok(`an operator and a hostile with the same line read the same (${rule.mine || 'nothing'})`,
      rule.same && rule.mine.length > 0);
    ok(`in the glyphs the codex names (${rule.glyphs.join('/')})`,
      rule.glyphs.every(g => rule.mine.includes(`>${g}<`)));
    const silent = await page.evaluate(() =>
      resistBadges({ isPlayer: true, resistances: { phys: 0, bio: 0, energy: 0 } }));
    ok(`a line of zeroes renders no row at all (${JSON.stringify(silent)})`, silent === '');

    // ── On the field, off the LIVE line ────────────────────────────────────────────
    // The badge has to follow what the operator is carrying, not what the class template says -
    // the whole point is that a trinket bought at the Armory shows up on the row it changes.
    const live = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 3; currentTier = 6;
      const ghost = playerRoster.find(c => c.classType === 'SNIPER');
      ghost.gridPos = 1;
      const bare = { ...ghost.resistances };
      initiateCombat('RAIDERS', false); renderField();
      const before = document.querySelectorAll(`#${ghost.id} .res-row`).length;
      // Bought and worn through the engine's own path, so what moves the badge is what the shop
      // sells rather than a field this test set by hand.
      gearStash = gearStash.concat(['GAS_MASK']);
      equipGear(ghost.id, 'GAS_MASK');
      renderField();
      const after = document.querySelectorAll(`#${ghost.id} .res-row`).length;
      const mark = document.querySelector(`#${ghost.id} .res-row .res`);
      // And a fallen operator carries none, which is the row's own isDead guard.
      ghost.hp = 0; renderField();
      const dead = document.querySelectorAll(`#${ghost.id} .res-row`).length;
      const r = { bare, worn: { ...ghost.resistances }, before, after, dead,
                  title: mark ? mark.getAttribute('title') : null,
                  cls: mark ? mark.className : null };
      combatActive = false;
      return r;
    });
    ok(`an operator carrying nothing shows no badge (${JSON.stringify(live.bare)})`,
      live.before === 0);
    ok(`the trinket puts one on the field (${JSON.stringify(live.worn)} — ${live.title})`,
      live.after === 1 && /bio/i.test(live.title || ''));
    ok(`and it reads as a resistance rather than a weakness (${live.cls})`,
      /res-strong/.test(live.cls || ''));
    ok('a fallen operator carries none', live.dead === 0);

    // ── And the whole line badged still fits ───────────────────────────────────────
    // The reason this was not shipped with K02. Measured against the SAME field with the squad
    // carrying nothing, so what is counted is what the badges cost rather than what the enemy
    // roll happened to draw - a first pass compared the two arms separately and read a stray
    // sprite as a regression when it was fitEnemyRow's own wobble.
    const fit = async (w, h) => {
      await resized(page, { width: w, height: h });
      return page.evaluate(() => {
        // ONE fight, measured twice. A first draft built the field separately for each arm, so
        // the two draws brought different swarms and a card came back two pixels SHORTER when
        // badged - which is a fact about the roll, not about the badges. The resistances are
        // changed on the standing squad and the field re-rendered, so the only thing that
        // differs between the two readings is the row this phase adds.
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 5; currentTier = 8;
        playerRoster.forEach((c, i) => { c.gridPos = i < 3 ? i + 1 : 0;
          c.resistances = { phys: 0, bio: 0, energy: 0 }; });
        initiateCombat('CARRION', true);
        const read = () => {
          renderField();
          return { cards: [...document.querySelectorAll('#player-team .entity')].map(e => {
                     const b = e.getBoundingClientRect();
                     return { h: Math.round(b.height), top: Math.round(b.top) }; }),
                   badges: document.querySelectorAll('#player-team .res-row').length,
                   clipped: [...document.querySelectorAll('#player-team .entity')]
                     .filter(e => { const b = e.getBoundingClientRect();
                       return b.top < 0 || b.left < 0 || b.right > window.innerWidth; }).length,
                   sideways: document.body.scrollWidth > window.innerWidth };
        };
        const bare = read();
        playerRoster.filter(c => c.gridPos > 0)
          .forEach(c => { c.resistances = { phys: 8, bio: 12, energy: -4 }; });
        const badged = read();
        combatActive = false;
        return { bare, badged, w: window.innerWidth };
      });
    };
    for (const [w, h] of [[1280, 800], [400, 700], [360, 640]]) {
      const f = await fit(w, h);
      ok(`at ${w} wide the badges arrive (${f.bare.badges} bare, ${f.badged.badges} badged)`,
        f.bare.badges === 0 && f.badged.badges === 3);
      const grew = f.badged.cards.map((c, i) => c.h - f.bare.cards[i].h);
      ok(`and cost the card a row rather than a screen (${grew.join(', ')}px taller at ${w})`,
        grew.length === 3 && grew.every(d => d > 0 && d <= 24));
      ok(`nothing on the line is pushed off at ${w} (${f.badged.clipped} clipped, sideways ${f.badged.sideways})`,
        f.badged.clipped === 0 && !f.badged.sideways);
    }
    await resized(page, { width: 1280, height: 800 });

    // ── The Outpost says it too, in the words the gear uses ────────────────────────
    // The screen where the trinket is actually equipped. Compared against the recruit card for
    // the same body, because the two must not drift: both print resistLine and nothing else.
    const card = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const medic = playerRoster.find(c => c.classType === 'MEDIC');
      renderOutpost();
      const read = id => {
        const el = [...document.querySelectorAll('.upgrade-card')]
          .find(c => c.querySelector(`[data-id="${id}"]`));
        const r = el ? el.querySelector('.upgrade-res') : null;
        return r ? r.innerText.trim() : null;
      };
      const before = read(medic.id);
      gearStash = gearStash.concat(['INSULATED_COAT']);
      equipGear(medic.id, 'INSULATED_COAT');
      renderOutpost();
      const after = read(medic.id);
      // A body with nothing at all says nothing at all, on either surface.
      const blank = resistLine({ phys: 0, bio: 0, energy: 0 });
      // The three branches the wording has, on one line, so a build that loses one of them
      // fails here rather than printing "+100 bio resist" at somebody who cannot be touched.
      const all = resistLine({ phys: 100, bio: 12, energy: -4 });
      // And the recruit card is the same words for the same line, which is the drift this is
      // guarding: one function, two screens.
      const tpl = RECRUIT_POOL.find(t => t.classType === 'HAZMAT');
      const recruitHtml = recruitCardHtml(tpl);
      return { before, after, blank, all, line: resistLine(medic.resistances),
               recruitSays: resistLine(tpl.resistances),
               recruitPrints: (recruitHtml.match(/class="recruit-res">([^<]*)</) || [null, ''])[1],
               coat: gearById('INSULATED_COAT').desc };
    });
    ok(`the roster card names what the body shrugs off (${card.before})`,
      !!card.before && /BIO RESIST/i.test(card.before));
    ok(`and follows the trinket that was just put on (${card.before} → ${card.after})`,
      card.after !== card.before && /ENERGY RESIST/i.test(card.after));
    ok(`in the words the gear itself uses (${card.coat})`, /energy resist/i.test(card.coat));
    ok(`with no percent sign on a flat subtraction (${card.after})`, !/%/.test(card.after));
    ok('a body carrying nothing gets no line', card.blank === '');
    ok(`a wall, a coat and a seam each read as what they are (${card.all})`,
      card.all === 'immune to phys · +12 bio resist · weak to energy (-4)');
    ok(`and the recruit card prints the very same words (${card.recruitPrints})`,
      card.recruitPrints === card.recruitSays && card.recruitSays.length > 0);

    // ── And the manual says whose badges they are ──────────────────────────────────
    // The entry read "Every enemy carries three badges", which was true until this phase and is
    // the sort of line that quietly stops being true and nobody notices.
    const manual = await page.evaluate(() => CODEX.find(c => c.id === 'RESISTANCE').body());
    ok(`the codex says the badges are on both sides (${manual.find(l => /badge/i.test(l)) || 'nothing'})`,
      manual.some(l => /badge/i.test(l) && /(yours|your own|both)/i.test(l))
      && !manual.some(l => /^Every enemy carries three badges/.test(l)));
  }
};

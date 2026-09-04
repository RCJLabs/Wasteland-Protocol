// E11: two of the six faces had no cold side at all.
//
// Rob Orrin or palm from the Magpie and their standing sits at the floor for the rest of the
// run, and every later meeting is the same two-button null screen - "Try to trade anyway" and
// "Leave him be", neither of which calls noteCast, so nothing moves in either direction ever
// again. Every other face had a thread on both sides of zero: VELA at <=-2 and >=2, KESS both,
// SEPT and GRALE both by reading the sign of their own standing. ORRIN's only FOLLOWUP gated at
// >=2 and the MAGPIE's at >=1.
//
// And the draw makes it worse rather than better: eventWeight is
//
//     (e.cast && hasMetCast(e.cast)) ? FACE_RETURN_WEIGHT : 1
//
// which reads whether you have met them and not how it went, so a face you burned comes up
// three times as often as a stranger - the same closed door, more often than the road shows
// anything else. That is left exactly as it is here; a pinned distribution suite depends on it,
// and the fix for a door with nothing behind it is to put something behind it.
//
// The two new threads do not reopen the trade. B03's position is that a trader who is robbed
// stops trading, which is a design decision and not an oversight, so neither thread calls
// noteCast and neither has a way back up. What they have is a scene and a price.
module.exports = {
  name: 'Both sides of every face',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── Every face has a thread on both sides of zero ────────────────────────────────
    // The durable one: a face added later with only one side fails here.
    const sides = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const probe = (id, standing) => {
        castState[id] = { met: 3, standing };
        const out = FOLLOWUPS.filter(f => f.cast === id)
          .filter(f => { try { return f.when(); } catch (e) { return false; } }).map(f => f.title);
        castState[id] = { met: 0, standing: 0 };
        return out;
      };
      return Object.keys(CAST).map(id => ({ id, cold: probe(id, -3), warm: probe(id, 3) }));
    });
    const noCold = sides.filter(s => !s.cold.length).map(s => s.id);
    const noWarm = sides.filter(s => !s.warm.length).map(s => s.id);
    ok(`all ${sides.length} faces have something on the cold side (${noCold.join(', ') || 'none bare'})`,
      noCold.length === 0);
    ok(`and something on the warm side (${noWarm.join(', ') || 'none bare'})`, noWarm.length === 0);
    ok(`the two that had neither now do (${sides.find(s => s.id === 'ORRIN').cold[0]} / ${sides.find(s => s.id === 'MAGPIE').cold[0]})`,
      sides.find(s => s.id === 'ORRIN').cold.length === 1 && sides.find(s => s.id === 'MAGPIE').cold.length === 1);

    // ── Neither thread is a way back up ─────────────────────────────────────────────
    // Driven through every execute() rather than read off the source: the claim is that nothing
    // here moves the standing, and the only proof of that is running all of it.
    const shut = await page.evaluate(() => {
      const drive = (title, id) => {
        const out = [];
        FOLLOWUPS.filter(f => f.title === title).forEach(f => {
          choicesFor(f).forEach((c, i) => {
            currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
            castState[id] = { met: 4, standing: -3 };
            scrap = 5000; materials = { parts: 5, chems: 5, tech: 5 };
            activeRelics = []; pendingConsequences = []; runStats = newRunStats();
            const before = castStanding(id);
            const text = choicesFor(f)[i].execute();
            out.push({ label: c.label, moved: castStanding(id) - before,
                       said: typeof text === 'string' && text.length > 0 });
          });
        });
        return out;
      };
      return { orrin: drive('WHAT ORRIN WELDED', 'ORRIN'),
               magpie: drive('THE WORD ON THE CLOTH', 'MAGPIE') };
    });
    ok(`the tinker's cold thread offers ${shut.orrin.length} answers, and every one says something`,
      shut.orrin.length === 2 && shut.orrin.every(c => c.said));
    ok(`the dealer's offers ${shut.magpie.length}`,
      shut.magpie.length === 3 && shut.magpie.every(c => c.said));
    ok('and not one of them moves the standing an inch, in either direction',
      [...shut.orrin, ...shut.magpie].every(c => c.moved === 0));

    // ── The shut trade is still shut ────────────────────────────────────────────────
    const door = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const read = (castId, standing) => {
        castState[castId] = { met: 4, standing };
        const ev = EVENT_POOL.find(e => e.cast === castId);
        return { desc: eventDesc(ev), n: choicesFor(ev).length,
                 labels: choicesFor(ev).map(c => c.label) };
      };
      return { orrinCold: read('ORRIN', -3), orrinWarm: read('ORRIN', 1),
               magCold: read('MAGPIE', -3), magWarm: read('MAGPIE', 1) };
    });
    ok(`the tinker still will not trade at the floor (${door.orrinCold.labels.join(' / ')})`,
      door.orrinCold.n === 2 && door.orrinWarm.n > door.orrinCold.n);
    ok(`nor will the dealer (${door.magCold.labels.join(' / ')})`,
      door.magCold.n === 2 && door.magWarm.n > door.magCold.n);

    // ── Each thread costs what it says it costs ────────────────────────────────────
    const cost = await page.evaluate(() => {
      const fresh = id => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        castState[id] = { met: 4, standing: -3 };
        scrap = 5000; materials = { parts: 0, chems: 0, tech: 0 };
        activeRelics = []; pendingConsequences = []; runStats = newRunStats();
      };
      const pick = (title, i) => {
        const f = FOLLOWUPS.find(x => x.title === title);
        return choicesFor(f)[i];
      };
      fresh('ORRIN'); pick('WHAT ORRIN WELDED', 0).execute();
      const cut = { parts: materials.parts, tech: materials.tech,
                    booked: pendingConsequences.map(c => c.kind) };
      fresh('ORRIN'); const purse = scrap; pick('WHAT ORRIN WELDED', 1).execute();
      const around = { gained: scrap - purse, booked: pendingConsequences.length };

      fresh('MAGPIE'); const p2 = scrap; pick('THE WORD ON THE CLOTH', 0).execute();
      const bought = { spent: p2 - scrap, held: activeRelics.length, booked: pendingConsequences.length };
      fresh('MAGPIE'); const p3 = scrap; pick('THE WORD ON THE CLOTH', 1).execute();
      const took = { spent: p3 - scrap, held: activeRelics.length,
                     booked: pendingConsequences.map(c => c.kind) };
      fresh('MAGPIE'); const p4 = scrap; pick('THE WORD ON THE CLOTH', 2).execute();
      const past = { spent: p4 - scrap, held: activeRelics.length, booked: pendingConsequences.length };
      return { cut, around, bought, took, past };
    });
    ok(`cutting his plate out pays in parts and tech (${cost.cut.parts}p ${cost.cut.tech}t)`,
      cost.cut.parts === 2 && cost.cut.tech === 1);
    ok(`and puts somebody on your trail for it (${cost.cut.booked.join(', ')})`,
      cost.cut.booked.length === 1 && cost.cut.booked[0] === 'AMBUSH');
    ok(`going around his work pays less and costs nothing (+${cost.around.gained} scrap)`,
      cost.around.gained === 45 && cost.around.booked === 0);
    ok(`buying what the dealer picked costs real money (${cost.bought.spent} scrap, ${cost.bought.held} relic)`,
      cost.bought.spent === 180 && cost.bought.held === 1 && cost.bought.booked === 0);
    ok(`taking it instead costs nothing and books a pursuit (${cost.took.booked.join(', ')})`,
      cost.took.spent === 0 && cost.took.held === 1
      && cost.took.booked.length === 1 && cost.took.booked[0] === 'PURSUIT');
    ok('and walking past leaves you with exactly what you arrived with',
      cost.past.spent === 0 && cost.past.held === 0 && cost.past.booked === 0);

    // ── The dealer sells you what he chose, and it leans cursed ──────────────────────
    const chosen = await page.evaluate(() => {
      let cursed = 0, clean = 0;
      for (let i = 0; i < 300; i++) {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        castState.MAGPIE = { met: 4, standing: -3 };
        scrap = 5000; activeRelics = []; pendingConsequences = []; runStats = newRunStats();
        const f = FOLLOWUPS.find(x => x.title === 'THE WORD ON THE CLOTH');
        choicesFor(f)[0].execute();
        if (activeRelics[0] && activeRelics[0].tier === 'CURSED') cursed++; else clean++;
      }
      return { cursed, clean, base: CURSE_CHANCE, spite: MAGPIE_SPITE };
    });
    ok(`what he picks is cursed more often than an honest table's (${chosen.cursed} of 300, against a ${Math.round(chosen.base * 100)}% baseline)`,
      chosen.cursed > 300 * chosen.base);
    ok(`at about the rate the spite is set to, and not always (${(100 * chosen.cursed / 300).toFixed(0)}% against ${Math.round(chosen.spite * 100)}%)`,
      Math.abs(chosen.cursed / 300 - chosen.spite) < 0.09 && chosen.clean > 30);

    // ── They come due through the ordinary draw, once each ─────────────────────────
    const drawn = await page.evaluate(() => {
      const run = id => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        firedEvents = []; recentEvents = [];
        Object.keys(CAST).forEach(k => { castState[k] = { met: 0, standing: 0 }; });
        castState[id] = { met: 4, standing: -3 };
        const seen = [];
        for (let i = 0; i < 6; i++) seen.push(pickEvent().title);
        return seen;
      };
      return { orrin: run('ORRIN'), magpie: run('MAGPIE') };
    });
    ok(`a burned tinker's thread comes due on its own (${drawn.orrin[0]})`,
      drawn.orrin[0] === 'WHAT ORRIN WELDED');
    ok('and only once, the way every follow-up does',
      drawn.orrin.filter(t => t === 'WHAT ORRIN WELDED').length === 1);
    ok(`a burned dealer's likewise (${drawn.magpie[0]})`,
      drawn.magpie[0] === 'THE WORD ON THE CLOTH'
      && drawn.magpie.filter(t => t === 'THE WORD ON THE CLOTH').length === 1);

    // ── The weighting is untouched, and still reads met rather than well ───────────
    const weight = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const ev = EVENT_POOL.find(e => e.cast === 'ORRIN');
      const at = s => { castState.ORRIN = { met: 4, standing: s }; return eventWeight(ev); };
      castState.ORRIN = { met: 0, standing: 0 };
      const stranger = eventWeight(ev);
      return { stranger, burned: at(-3), liked: at(3), base: FACE_RETURN_WEIGHT };
    });
    ok(`a face you have met is weighted x${weight.base} whichever way it went (${weight.burned} burned, ${weight.liked} liked)`,
      weight.burned === weight.base && weight.liked === weight.base && weight.stranger === 1);
  }
};

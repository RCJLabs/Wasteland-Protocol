// The wasteland was full of people who had never met you. You could pay the tinker, stiff the
// fixer and rob the scavenger, and the next one through the door was a stranger with no opinion
// about any of it. The consequence system already tracked debts, but it tracked them as
// bookkeeping - an anonymous card that fired once and evaporated. These four remember.
module.exports = {
  name: 'Faces that come back',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the table ----
    const shape = await page.evaluate(() => ({
      people: Object.keys(CAST),
      written: Object.values(CAST).every(c => c.name && c.epithet && c.note && c.note.length > 20),
      bands: STANDING_BANDS.map(b => b.at),
      labelled: STANDING_BANDS.every(b => b.key && b.label && b.cls),
      threads: FOLLOWUPS.length,
      castIds: [...EVENT_POOL, ...FOLLOWUPS].map(e => e.cast).filter(Boolean),
      consequenceIds: Object.values(CONSEQUENCE_POOL).map(c => c.cast).filter(Boolean)
    }));
    ok(`${shape.people.length} faces, each with a name and something to say`,
      shape.people.length >= 4 && shape.written);
    ok('the standing bands run low to high without a gap',
      shape.bands.every((n, i) => i === 0 || n === shape.bands[i - 1] + 1) && shape.labelled);
    ok('every cast id an event or consequence names is a real one',
      [...shape.castIds, ...shape.consequenceIds].every(id => shape.people.includes(id)));

    // Standing is clamped so one generous choice cannot buy a permanent discount, and one bad
    // one cannot put a character out of reach for the rest of the run.
    const clamp = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      for (let i = 0; i < 20; i++) noteCast('ORRIN', 1);
      const high = castStanding('ORRIN');
      for (let i = 0; i < 40; i++) noteCast('ORRIN', -1);
      const low = castStanding('ORRIN');
      const unknown = noteCast('NOBODY_AT_ALL', 5);
      return { high, low, unknown, stranger: castStanding('NOBODY_AT_ALL') };
    });
    ok(`standing is bounded at both ends (${clamp.low} to ${clamp.high})`,
      clamp.high <= 3 && clamp.low >= -3 && clamp.high > 0 && clamp.low < 0);
    ok('and a name that is not in the cast changes nothing',
      clamp.unknown === 0 && clamp.stranger === 0);

    // ---- a thread exists only because of something the player did ----
    const threads = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const atStart = FOLLOWUPS.filter(f => f.when()).map(f => f.title);
      // Every follow-up must be reachable: some standing for its own character opens it, or it
      // is content nobody will ever see.
      const reachable = FOLLOWUPS.map(f => {
        let opens = null;
        for (let n = -3; n <= 3; n++) {
          castState = {}; pendingConsequences = [];
          if (f.cast) castState[f.cast] = { met: 1, standing: n };
          if (f.when()) { opens = n; break; }
        }
        return { title: f.title, cast: f.cast, opens };
      });
      castState = {}; pendingConsequences = [];
      return { atStart, reachable, shared: EVENT_POOL.filter(e => FOLLOWUPS.some(f => f.title === e.title)).map(e => e.title) };
    });
    ok('a fresh run has no threads to pick up', threads.atStart.length === 0);
    ok(`every thread has a standing that opens it (${threads.reachable.map(r => `${r.cast}${r.opens > 0 ? '+' : ''}${r.opens}`).join(' ')})`,
      threads.reachable.every(r => r.opens !== null));
    ok('and none of them sit in the ordinary draw', threads.shared.length === 0);

    // Threads outrank strangers, and each comes due exactly once.
    const due = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const kess = EVENT_POOL.find(e => e.cast === 'KESS');
      materials.chems = 5;
      choicesFor(kess)[0].execute();                 // patch them up
      const opened = FOLLOWUPS.filter(f => f.when()).map(f => f.title);
      const first = pickEvent().title;
      const rest = [];
      for (let i = 0; i < 40; i++) rest.push(pickEvent().title);
      return { opened, first, repeats: rest.filter(t => t === first).length, fired: firedEvents.slice() };
    });
    ok(`patching the survivor opens their thread (${due.opened.join(', ')})`, due.opened.length === 1);
    ok('and the next event node is that thread, not a stranger', due.first === due.opened[0]);
    ok('it comes due once and never again', due.repeats === 0 && due.fired.length === 1);

    // Measured, not assumed: on a flat draw each face turned up about half a run, so nobody
    // came back twice and every thread needing two meetings was content nobody would see.
    const returning = await page.evaluate(() => {
      const share = (met) => {
        currentSlot = 1; confirmNewGame(1.0);
        if (met) castState = { ORRIN: { met: 1, standing: 0 } };
        let orrin = 0;
        for (let i = 0; i < 3000; i++) { recentEvents = []; if (pickEvent().cast === 'ORRIN') orrin++; }
        return orrin / 3000;
      };
      const stranger = share(false), known = share(true);
      currentSlot = 1; confirmNewGame(1.0);
      return { stranger, known, weight: FACE_RETURN_WEIGHT,
               unmet: eventWeight({ cast: 'ORRIN' }), plain: eventWeight({ title: 'no face here' }) };
    });
    ok(`a face already met comes back more often than a stranger (${(returning.stranger * 100).toFixed(0)}% -> ${(returning.known * 100).toFixed(0)}%)`,
      returning.known > returning.stranger * 1.5);
    ok('but an unmet face is drawn no more often than anything else',
      returning.unmet === returning.plain && returning.plain === 1);

    // ---- standing changes what is on offer ----
    const offers = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); scrap = 900; materials.parts = 9; materials.tech = 4;
      const orrin = EVENT_POOL.find(e => e.cast === 'ORRIN');
      const cold = choicesFor(orrin).map(c => c.label);
      choicesFor(orrin)[1].execute(); choicesFor(orrin)[1].execute();
      const warm = choicesFor(orrin).map(c => c.label);
      const price = s => Number((s.match(/(\d+) Scrap/) || [])[1]);
      return { cold, warm, coldPrice: price(cold[0]), warmPrice: price(warm[0]),
               standing: castStanding('ORRIN') };
    });
    ok(`trading with the tinker earns a better price (${offers.coldPrice} -> ${offers.warmPrice})`,
      offers.warmPrice < offers.coldPrice);
    ok(`and opens a door that was not there cold (${offers.cold.length} -> ${offers.warm.length} choices)`,
      offers.warm.length > offers.cold.length);

    const lender = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const vela = EVENT_POOL.find(e => e.cast === 'VELA');
      const free = choicesFor(vela).map(c => ({ label: c.label, can: c.canAfford() }));
      // The term is counted in nodes now, and the offer quotes a number - so read the number
      // she says and check it against the node the debt is actually booked against.
      const at = nodesCleared();
      const said = Number((free[0].label.match(/in (\d+) nodes/) || [])[1]) || null;
      choicesFor(vela)[0].execute();                 // borrow
      const owing = choicesFor(vela).map(c => ({ label: c.label, can: c.canAfford() }));
      return { free, owing, owes: owesVela(), term: { said, at, due: pendingConsequences[0].dueAt }, live: DEBT_TERM };
    });
    const DEBT_TERM_EXPECTED = lender.live;
    ok('the fixer lends to a squad that owes her nothing', lender.free[0].can && /Borrow/.test(lender.free[0].label));
    ok(`the term she names is the term she books (${lender.term.said} said, due on node ${lender.term.due} from ${lender.term.at})`,
      lender.term.due - lender.term.at === DEBT_TERM_EXPECTED && lender.term.said === DEBT_TERM_EXPECTED);
    ok('and will not lend into a debt she has not been paid', lender.owes && !lender.owing[0].can);

    // ---- the consequence carries a face, and settles it in both directions ----
    const settled = await page.evaluate(() => {
      const run = (funds) => {
        currentSlot = 1; confirmNewGame(1.0);
        const vela = EVENT_POOL.find(e => e.cast === 'VELA');
        choicesFor(vela)[0].execute();
        scrap = funds;
        const c = pendingConsequences[0];
        const text = CONSEQUENCE_POOL.DEBT.resolve(c);
        return { standing: castStanding('VELA'), text, threads: FOLLOWUPS.filter(f => f.when()).map(f => f.title) };
      };
      return { paid: run(9999), short: run(0), titled: CONSEQUENCE_POOL.DEBT.title, face: CONSEQUENCE_POOL.DEBT.cast };
    });
    ok(`the collection card carries her name (${settled.titled})`,
      /VELA/i.test(settled.titled) && settled.face === 'VELA');
    ok(`paying up earns her trust (${settled.paid.standing})`, settled.paid.standing > 0);
    ok(`coming up short does not (${settled.short.standing})`, settled.short.standing < 0);
    ok(`and only the default sends people after you (${settled.short.threads.join(', ') || 'none'})`,
      settled.short.threads.includes('VELA SENDS MEN') && !settled.paid.threads.includes('VELA SENDS MEN'));

    // ---- the choice list is fixed at render, not re-rolled when it is pressed ----
    const stable = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); scrap = 9999;
      castState = { MAGPIE: { met: 1, standing: 2 } };
      const shelf = FOLLOWUPS.find(f => f.title === "THE MAGPIE'S BACK SHELF");
      activeEvent = shelf; activeChoices = choicesFor(shelf);
      const advertised = (activeChoices[0].label.match(/Buy (.+) \(/) || [])[1];
      const held = activeRelics.length;
      activeChoices[0].execute();
      const got = activeRelics[activeRelics.length - 1];
      return { advertised, delivered: got ? got.name : null, gained: activeRelics.length - held };
    });
    ok(`the relic it names is the relic it hands over (${stable.advertised})`,
      stable.gained === 1 && stable.advertised === stable.delivered);

    // ---- the face is on the screen ----
    const tag = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const read = () => {
        const el = document.getElementById('event-cast');
        return { text: el.innerText.replace(/\s+/g, ' ').trim(), shown: el.style.display !== 'none',
                 band: (el.querySelector('.cast-band') || {}).className || '' };
      };
      meetCast('KESS'); renderCastTag('KESS'); const first = read();
      noteCast('KESS', 2); meetCast('KESS'); renderCastTag('KESS'); const again = read();
      noteCast('KESS', -6); renderCastTag('KESS'); const soured = read();
      renderCastTag(null); const none = read();
      return { first, again, soured, none };
    });
    ok(`a first meeting reads as one (${tag.first.text})`,
      tag.first.shown && /FIRST MEETING/.test(tag.first.text) && /KESS/.test(tag.first.text));
    ok(`a second says where you stand (${tag.again.text})`,
      !/FIRST MEETING/.test(tag.again.text) && /cast-good/.test(tag.again.band));
    ok(`and says it in a word as well as a colour (${tag.soured.text})`,
      /cast-bad/.test(tag.soured.band) && tag.soured.text !== tag.again.text);
    ok('an encounter with nobody in it shows no tag', !tag.none.shown && tag.none.text === '');

    // ---- the run remembers, the next run does not ----
    const memory = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      noteCast('ORRIN', 2); meetCast('ORRIN'); noteCast('KESS', -2); meetCast('KESS');
      firedEvents = ['ORRIN’S WORKSHOP'];
      const summary = () => { renderRunOver(0, false); return [...document.querySelectorAll('#runover-lines .runover-line')].map(l => l.innerText).join(' | '); };
      const withFaces = summary();
      const faces = facesMet().map(f => `${f.id}:${f.standing}`);
      saveGameState();
      return { withFaces, faces, worstFirst: facesMet()[0].id };
    });
    ok(`the run summary names who it met (${memory.faces.join(' ')})`, /FACES MET/.test(memory.withFaces));
    ok('worst standing first, so the summary leads with what it cost', memory.worstFirst === 'KESS');

    await page.reload();
    await page.waitForTimeout(600);
    const reloaded = await page.evaluate(() => {
      currentSlot = 1; loadGameState();
      return { orrin: castStanding('ORRIN'), kess: castStanding('KESS'), fired: firedEvents.length };
    });
    ok(`standing survives a reload (Orrin ${reloaded.orrin}, Kess ${reloaded.kess})`,
      reloaded.orrin === 2 && reloaded.kess === -2 && reloaded.fired === 1);

    const fresh = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      renderRunOver(0, false);
      return { faces: facesMet().length, fired: firedEvents.length,
               summary: [...document.querySelectorAll('#runover-lines .runover-line')].map(l => l.innerText).join(' | ') };
    });
    ok('and a new expedition starts among strangers', fresh.faces === 0 && fresh.fired === 0);
    ok('so the summary stays quiet about faces on a run that met nobody', !/FACES MET/.test(fresh.summary));

    // ---- nothing in either pool can throw ----
    // Every choice has to resolve safely even where its own canAfford would refuse it: the
    // relic table already carried that note, and it is true of all of them.
    const safety = await page.evaluate(() => {
      const broke = [];
      const all = [...EVENT_POOL, ...FOLLOWUPS];
      all.forEach(ev => {
        (choicesFor(ev) || []).forEach((c, i) => {
          [true, false].forEach(rich => {
            currentSlot = 1; confirmNewGame(1.0);
            if (rich) { scrap = 9999; materials.parts = 9; materials.chems = 9; materials.tech = 9; activeRelics = [rollRelic(1)].filter(Boolean); }
            else { scrap = 0; materials.parts = 0; materials.chems = 0; materials.tech = 0; activeRelics = []; inventory = []; }
            try { const out = choicesFor(ev)[i].execute(); if (typeof out !== 'string' || !out.length) broke.push(`${ev.title}[${i}] returned no text`); }
            catch (e) { broke.push(`${ev.title}[${i}] ${rich ? 'flush' : 'broke'}: ${e.message}`); }
          });
        });
      });
      return { broke, events: all.length };
    });
    ok(`every choice in all ${safety.events} encounters resolves either way (${safety.broke.length} broke)`,
      safety.broke.length === 0);
    if (safety.broke.length) console.log('        ' + safety.broke.slice(0, 6).join('\n        '));

    // ---- and the manual says the system exists ----
    const manual = await page.evaluate(() => {
      const text = CODEX.map(e => e.body().join(' ')).join(' ');
      return { mentions: /remember what you did last time/.test(text),
               counts: text.includes(String(Object.keys(CAST).length)) };
    });
    ok('the manual explains that some people come back', manual.mentions && manual.counts);

    // And it is taught in the field, at the moment it first means something: the second meeting.
    const taught = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      seenPrompts = []; promptQueue = []; globalSettings.prompts = true;
      meetCast('ORRIN'); const atFirst = promptQueue.slice();
      meetCast('ORRIN'); const atSecond = promptQueue.slice();
      meetCast('ORRIN'); const atThird = promptQueue.length;
      const p = PROMPTS.find(x => x.id === 'FACES');
      globalSettings.prompts = false;
      return { atFirst, atSecond, atThird, exists: !!p, explains: p ? /standing/i.test(p.body) : false };
    });
    ok('the prompt for it exists and says what standing does', taught.exists && taught.explains);
    ok('it holds off through a first meeting, when there is nothing to explain', taught.atFirst.length === 0);
    ok('and fires on the second, once', taught.atSecond.length === 1 && taught.atThird === 1);
  }
};

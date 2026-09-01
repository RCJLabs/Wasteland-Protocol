// The ladder had three rungs gated on deepest-sector-ever of 3, 5 and 8. Two of those opened
// before the player had finished anything - sector 3 is most of a first evening - so most of
// the "ladder after the ending" sat beside the ending instead of after it. The third was worse:
// it wanted sector 8, and C01 ended the road at 7, so it could only be reached by felling the
// last warlord and then declining to stop.
//
// Eight rungs now, none of them open until the road has been walked once, and each one opened
// by walking the whole road again at the rung below it. This suite holds the two things that
// can rot: that the gate is a clear rather than a depth, and that every rung actually does the
// thing printed on its card - a ladder of named rungs that change nothing is the failure mode,
// and it looks identical from the outside.
module.exports = {
  name: 'The ladder',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__at = rung => { careerWins = 1; bestRung = PROTOCOLS.length; ascension = rung; };
      window.__off = () => { ascension = 0; careerWins = 0; bestRung = 0; };
    });

    // ---- the shape of it ----
    const shape = await page.evaluate(() => ({
      n: PROTOCOLS.length,
      ids: new Set(PROTOCOLS.map(p => p.id)).size,
      named: PROTOCOLS.every(p => p.id && p.name && p.desc && p.mult > 1),
      climbs: PROTOCOLS.every((p, i) => i === 0 || p.mult > PROTOCOLS[i - 1].mult),
      gatesGone: PROTOCOLS.every(p => p.gate === undefined),
      rungs: PROTOCOLS.map(p => p.id).join(',')
    }));
    ok(`${shape.n} rungs, each named and each dearer than the last (${shape.rungs})`,
      shape.n >= 6 && shape.n === shape.ids && shape.named && shape.climbs);
    ok('and none of them carries a depth gate any more', shape.gatesGone);

    // ---- the gate is a clear, not a depth ----
    const gate = await page.evaluate(() => {
      const r = {};
      careerWins = 0; bestRung = 0; bestSector = 1; r.cold = unlockedProtocols();
      bestSector = FINAL_SECTOR; r.deepButUnfinished = unlockedProtocols();
      careerWins = 1; bestSector = 1; r.firstClear = unlockedProtocols();
      bestRung = 3; r.climbed = unlockedProtocols();
      bestRung = PROTOCOLS.length; r.topped = unlockedProtocols();
      bestRung = 99; r.tampered = unlockedProtocols();
      careerWins = 0; bestRung = 0;
      return r;
    });
    ok('walking to the end of the road without finishing it opens nothing',
      gate.cold === 0 && gate.deepButUnfinished === 0);
    ok('finishing it once opens the first rung', gate.firstClear === 1);
    ok(`and each cleared rung opens exactly the next (${gate.climbed} open at 3 cleared)`, gate.climbed === 4);
    ok('the top of the ladder opens nothing above it',
      gate.topped === shape.n && gate.tampered === shape.n);

    // ---- a rung is a stack, not an entry ----
    const stack = await page.evaluate(() => {
      __at(5);
      const on = activeProtocols().map(p => p.id);
      const r = { on, fifth: hasProtocol('RATIONING'), sixth: hasProtocol('LONGSHADOW'), mult: protocolMult() };
      __at(0); r.none = activeProtocols().length; r.anyOff = hasProtocol('IRONSIDE');
      __off();
      return r;
    });
    ok(`rung 5 holds the first five and nothing above them (${stack.on.join(', ')})`,
      stack.on.length === 5 && stack.fifth && !stack.sixth);
    ok('and the multiplier is that rung\'s, not the top of the stack\'s', stack.mult === 1.95);
    ok('off the ladder, nothing is in force', stack.none === 0 && !stack.anyOff);

    // ---- rung 4: one fewer fallback ----
    const attrition = await page.evaluate(() => {
      activeContracts = []; metaUpgrades.extraRegroups = 0;
      __at(3); const plain = totalRegroups();
      __at(4); const cut = totalRegroups();
      metaUpgrades.extraRegroups = 3;
      const bunkered = totalRegroups();
      __at(3); const bunkeredOff = totalRegroups();
      metaUpgrades.extraRegroups = 0;
      // A contract that takes them all still takes them all.
      __at(4); activeContracts = ['NO_REGROUPS']; const none = totalRegroups();
      activeContracts = []; __off();
      return { plain, cut, bunkered, bunkeredOff, none };
    });
    ok(`ATTRITION takes a fallback off the top (${attrition.plain} -> ${attrition.cut})`,
      attrition.cut === attrition.plain - 1);
    ok(`and buying more does not opt out of it (${attrition.bunkeredOff} -> ${attrition.bunkered})`,
      attrition.bunkered === attrition.bunkeredOff - 1);
    ok('it never digs below nothing', attrition.none === 0);

    // ---- rung 5: thinner salvage ----
    const rationing = await page.evaluate(() => {
      __at(4); const full = nodeSalvage(100);
      __at(5); const cut = nodeSalvage(100);
      // The card says salvage off a cleared node. It has to be that and not everything.
      currentSlot = 1; activeContracts = []; confirmNewGame(1.0);
      scrap = 0; collectLoot(200, false); const looted = scrap;
      const before = scrap; scrap += 100; const eventPaid = scrap - before;
      __off();
      return { full, cut, looted, eventPaid };
    });
    ok(`RATIONING cuts a node's salvage by a quarter (${rationing.full} -> ${rationing.cut})`,
      rationing.cut === 75 && rationing.full === 100);
    ok('through the real payout path, not just the helper', rationing.looted === 150);
    ok('and it leaves everything that is not node salvage alone', rationing.eventPaid === 100);

    // ---- rung 6: everyone remembers you ----
    const shadow = await page.evaluate(() => {
      grudges = {};
      __at(5); const cold = grudgeOn('SCRAPLORD');
      __at(6); const marked = grudgeOn('SCRAPLORD');
      grudges = { SCRAPLORD: 3 }; const real = grudgeOn('SCRAPLORD');
      grudges = { SCRAPLORD: 99 }; const capped = grudgeOn('SCRAPLORD');
      grudges = {}; __off();
      return { cold, marked, real, capped };
    });
    ok('below the rung a commander meets you cold', shadow.cold === 0);
    ok('LONG SHADOW puts a grudge under every one of them', shadow.marked === 1);
    ok('without flattening one that is genuinely deeper', shadow.real === 3);
    ok('and still stops at the cap', shadow.capped <= 3);

    // ---- rung 7: the wounded ----
    const grave = await page.evaluate(() => {
      const down = (rung, scars) => {
        __at(rung);
        const e = { isPlayer: true, hp: 0, name: 'Probe', scars: scars || [] };
        goDown(e);
        return e.downTurns;
      };
      const plain = down(6), faster = down(7);
      const slowPlain = down(6, ['SLOW_TO_RISE']), slowBoth = down(7, ['SLOW_TO_RISE']);
      // The scar roll, measured through markScars against a swept roll rather than asserted.
      const rate = rung => {
        __at(rung);
        let hits = 0; const N = 2000;
        for (let i = 0; i < N; i++) {
          playerRoster = [{ id: 1, name: 'A', scars: [], maxHp: 100, hp: 100, dmgBase: 10, speed: 10 }];
          let k = 0; const rng = () => (k++ === 0 ? i / N : 0.5);
          if (markScars([1], rng).length) hits++;
        }
        return hits / N;
      };
      const scarOff = rate(6), scarOn = rate(7);
      __off();
      return { plain, faster, slowPlain, slowBoth, scarOff, scarOn };
    });
    ok(`MASS GRAVE shortens the bleed-out clock (${grave.plain} -> ${grave.faster} turns)`,
      grave.faster === grave.plain - 1);
    ok(`and stacks with SLOW TO RISE down to a floor of one (${grave.slowPlain} -> ${grave.slowBoth})`,
      grave.slowBoth === 1 && grave.slowPlain === 2);
    ok(`it doubles the scars the road leaves (${(grave.scarOff * 100).toFixed(0)}% -> ${(grave.scarOn * 100).toFixed(0)}%)`,
      Math.abs(grave.scarOn - grave.scarOff * 2) < 0.01 && grave.scarOff > 0);

    // ---- rung 8: everything opens the ossuary ----
    const ossuary = await page.evaluate(() => {
      __at(7); const plain = protocolEnrage({ cry: 'RAAA' });
      __at(8); const opened = protocolEnrage({ cry: 'RAAA' });
      const final = protocolEnrage(FINAL_BOSS.enrage);
      const bare = protocolEnrage(undefined);
      __off();
      return { plainRaise: plain.raiseFelled, openedRaise: opened.raiseFelled,
               keptCry: opened.cry, finalRaise: final.raiseFelled, bareRaise: bare.raiseFelled };
    });
    ok('below the rung an ordinary commander raises nothing', ossuary.plainRaise === undefined);
    ok('OSSUARY hands it the last warlord\'s move', ossuary.openedRaise === 1 && ossuary.keptCry === 'RAAA');
    ok('a commander with no enrage of its own gets one too', ossuary.bareRaise === 1);
    ok('and the Ossuary itself keeps raising two, not one', ossuary.finalRaise === 2);

    // ---- the rung goes on the record, and it is the one that was deployed ----
    const record = await page.evaluate(() => {
      careerWins = 0; bestRung = 0; currentSlot = 1;
      activeContracts = []; ascension = 4; confirmNewGame(1.0);
      const onRun = runStats.ascension;
      // The board moves after the muster; the record must not follow it.
      ascension = 8;
      noteVictory();
      const afterWin = bestRung;
      // A run that does not finish leaves the ladder where it was.
      const held = bestRung;
      runStats = newRunStats(); runStats.ascension = 7;
      const noWin = bestRung;
      careerWins = 0; bestRung = 0; ascension = 0;
      return { onRun, afterWin, held, noWin };
    });
    ok('the run is stamped with the rung it deployed at', record.onRun === 4);
    ok('clearing it opens the next one, off the deployed rung not the live board',
      record.afterWin === 4 && record.held === 4);
    ok('and a run that does not finish moves nothing', record.noWin === 4);

    // ---- what is climbed survives the session ----
    const kept = await page.evaluate(() => {
      careerWins = 2; bestRung = 5; saveMeta();
      bestRung = 0; careerWins = 0;
      loadMeta();
      const back = { rung: bestRung, wins: careerWins };
      const raw = JSON.parse(Store.get(META_KEY));
      raw.bestRung = 99; Store.set(META_KEY, JSON.stringify(raw)); loadMeta();
      const clamped = bestRung;
      delete raw.bestRung; Store.set(META_KEY, JSON.stringify(raw)); loadMeta();
      const legacy = bestRung;
      careerWins = 0; bestRung = 0; saveMeta();
      return { back, clamped, legacy };
    });
    ok('the climb rides the ledger', kept.back.rung === 5 && kept.back.wins === 2);
    ok('a tampered rung clamps to the ladder', kept.clamped === shape.n);
    ok('and a ledger written before the ladder loads at the bottom', kept.legacy === 0);

    // ---- the Chronicle carries a line per rung ----
    const chron = await page.evaluate(() => {
      careerWins = 0; bestRung = 0; renderChronicle();
      const sealed = document.getElementById('chronicle-ladder').innerText;
      careerWins = 3; bestRung = 3; currentSlot = 1;
      Store.set('wp_career_1', JSON.stringify({ runs: 9, kills: 400, deepestSector: 7, fielded: { BRUISER: 6 } }));
      renderChronicle();
      const L = document.getElementById('chronicle-ladder');
      const rows = [...L.querySelectorAll('.ladder-rung')];
      const r = {
        sealed,
        rows: rows.length,
        cleared: L.querySelectorAll('.ladder-cleared').length,
        open: L.querySelectorAll('.ladder-open').length,
        locked: L.querySelectorAll('.ladder-locked').length,
        namesEvery: PROTOCOLS.every(p => L.innerText.includes(p.name.replace('PROTOCOL: ', ''))),
        saysEvery: PROTOCOLS.every(p => L.innerText.includes(p.desc)),
        career: document.getElementById('chronicle-career').innerText
      };
      // An entry remembers the rung it was run at.
      Store.set('wp_chronicle_1', JSON.stringify([
        { when: Date.now(), score: 900, sector: 6, tier: 3, kills: 5, relics: [], rung: 6, epitaph: 'Gone.' },
        { when: Date.now() - 10, score: 400, sector: 2, tier: 1, kills: 1, relics: [], rung: 0, epitaph: 'Also gone.' }
      ]));
      renderChronicle();
      const marks = [...document.querySelectorAll('.chronicle-rung')].map(e => e.innerText);
      Store.remove('wp_chronicle_1'); Store.remove('wp_career_1');
      careerWins = 0; bestRung = 0;
      return { ...r, marks };
    });
    ok('with nothing cleared the ladder says it is sealed',
      /SEALED/.test(chron.sealed) && /walk the whole road/i.test(chron.sealed));
    ok(`a line per rung (${chron.rows}), marked cleared, open and locked (${chron.cleared}/${chron.open}/${chron.locked})`,
      chron.rows === shape.n && chron.cleared === 3 && chron.open === 1 && chron.locked === shape.n - 4);
    ok('naming every rung and saying what each one does', chron.namesEvery && chron.saysEvery);
    ok(`and the career block prints the highest one cleared (${chron.career.split('\n').find(l => /RUNG/.test(l)) || '—'})`,
      /HIGHEST RUNG CLEARED/.test(chron.career) && /BLACKOUT/.test(chron.career));
    ok(`an expedition remembers the rung it ran at (${chron.marks.join(', ') || 'none'})`,
      chron.marks.length === 1 && chron.marks[0] === '▲6');

    // ---- the effects are keyed by name, not by rung number ----
    const wiring = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      // Comment lines out: the block explaining why the old `ascension >= 2` form is gone
      // says the old form, and a scan that counts its own explanation never reaches zero.
      const code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
      return { magic: (code.match(/ascension\s*>=\s*\d/g) || []).length,
               keyed: (code.match(/hasProtocol\('[A-Z]+'\)/g) || []).length };
    });
    ok(`no effect is spelled as a rung number any more (${wiring.magic} left)`, wiring.magic === 0);
    ok(`every one reads the ladder by name instead (${wiring.keyed} sites)`, wiring.keyed >= 8);

    // ---- the manual ----
    const codex = await page.evaluate(() => {
      const e = CODEX.find(x => x.id === 'ASCENSION');
      const text = e ? e.body().join(' ') : '';
      return { all: PROTOCOLS.every(p => text.includes(p.name) && text.includes(p.desc)),
               clear: /walked the road once|walked once/i.test(text),
               owns: /deepest sector/i.test(text) };
    });
    ok('the manual names every rung and says what it does', codex.all);
    ok('tells the player the ladder opens on a clear', codex.clear);
    ok('and admits what it used to be gated on', codex.owns);
  }
};

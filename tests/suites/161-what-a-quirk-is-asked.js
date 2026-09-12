// M05. Fifteen quirks in the pool and nothing had ever counted one. Five of them carry a
// CONDITION, and M04 is the reason that is worth a ledger rather than a reading of the source:
// it shipped five perk cards whose conditions were designed and then measured, three of the five
// fired so rarely that the change cost sixteen wins of a career, and the condition that broke it
// - "the target is further off than arm's reach" - is the exact complement of DUELIST's, which
// has described itself as situational since the pool was written.
//
// So the order is the finding from M04: COUNT FIRST. This suite is the guard on the count, not
// on any conclusion drawn from it. What it has to hold is that the census cannot quietly stop
// being complete - a quirk added to the pool, a read site added to the engine, or a condition
// that stops being reachable all have to show up as a number rather than as silence.
module.exports = {
  name: 'What a quirk is asked',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── Every quirk read in the engine is counted ────────────────────────────────
    // Read off game.js rather than listed here. A hand-kept list of read sites is the F03 defect
    // and would fall behind the first time somebody gave a quirk a second moment - which is
    // exactly what happened to VAMPIRIC, whose read spelled hasQuirk out by hand and so was
    // invisible to any search for quirk reads until this phase named it.
    const cover = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const ids = QUIRK_POOL.map(q => q.id);
      const lines = src.split('\n');
      // Which function a line sits in, by scanning back to the nearest declaration. Line
      // proximity was the first draft and it was wrong: the five conditional reads go through a
      // helper, so the noteQuirk for PACK_HUNTER sits three lines above the line naming it and
      // inside a different scope. What matters is not that the count is NEAR the read but that
      // it is in the same function - the unit that either counts what it does or does not.
      const fnAt = (i) => {
        for (let k = i; k >= 0; k--) {
          const m = lines[k].match(/^function ([A-Za-z_$][\w$]*)\(/);
          if (m) return m[1];
        }
        return null;
      };
      const bodyOf = (name) => {
        const at = src.indexOf('function ' + name + '(');
        if (at < 0) return '';
        let d = 0, i = src.indexOf('{', at), end = i;
        for (; end < src.length; end++) {
          if (src[end] === '{') d++;
          else if (src[end] === '}') { d--; if (!d) break; }
        }
        return src.slice(i, end);
      };
      const readIn = {};
      lines.forEach((ln, i) => {
        if (/^\s*\{ id: '/.test(ln)) return;          // the pool's own definition is not a read
        // VAMPIRIC is an ELITE AFFIX as well as a quirk - the same string naming two different
        // systems - so a mention of the id inside hasAffix is not a quirk read at all. Found by
        // this guard rather than by reading: it reported VAMPIRIC unnoted in executeEnemyAi,
        // which is the affix on a hostile and has nothing to do with the pool.
        if (/hasAffix\(/.test(ln)) return;
        ids.forEach(id => {
          if (!ln.includes("'" + id + "'")) return;
          (readIn[id] = readIn[id] || new Set()).add(fnAt(i));
        });
      });
      // Per ID, not per function. Function-scope was the second draft and mutation testing
      // broke it: applyDamageHit holds TWO quirk reads - VAMPIRIC and SECOND_WIND - so deleting
      // VAMPIRIC's count left the function still containing a noteQuirk and the guard green on a
      // quirk nothing counted. An id is accounted for if it is either counted by name, or read
      // through the dispatcher in quirkDmgMult, which passes the id as a variable and is held
      // instead by the behavioural rows below.
      const where = {};
      const byName = ids.filter(id => src.includes(`noteQuirk('${id}'`));
      const viaDispatch = ids.filter(id => src.includes(`on('${id}'`));
      const unnoted = ids.filter(id => {
        if (!readIn[id] || byName.includes(id) || viaDispatch.includes(id)) return false;
        where[id] = [...readIn[id]].join('/') || '(top level)';
        return true;
      });
      return { ids, read: ids.filter(id => readIn[id]), unnoted, where,
               byName: byName.length, viaDispatch: viaDispatch.length };
    });
    ok(`${cover.read.length} of ${cover.ids.length} quirks are read somewhere in the engine (${cover.read.map(i => i.toLowerCase()).join(', ')})`,
      cover.read.length >= 10);
    ok(`and every function that reads one also counts it (${cover.unnoted.length} unnoted${
        cover.unnoted.length ? ': ' + cover.unnoted.map(i => `${i} in ${cover.where[i]}`).join(', ') : ''})`,
      cover.unnoted.length === 0);
    ok(`counted ${cover.byName} by name and ${cover.viaDispatch} through the dispatcher, which is all of them`,
      cover.byName + cover.viaDispatch === cover.read.length);
    // The other five are the pure stat quirks: their whole effect is written onto the sheet the
    // moment they are rolled, so having no read is correct and the census says so separately
    // rather than reporting them as content that never fires.
    const statOnly = await page.evaluate(() =>
      QUIRK_POOL.filter(q => q.dmg || q.hp || q.spd).map(q => q.id));
    ok(`the ones with no read are exactly the ones that are a stat (${statOnly.map(i => i.toLowerCase()).join(', ')})`,
      cover.ids.filter(id => !cover.read.includes(id)).sort().join() === statOnly.slice().sort().join());

    // ── The one id that means two things ────────────────────────────────────────
    // Named rather than quietly filtered out above. VAMPIRIC is in QUIRK_POOL and in
    // ELITE_AFFIXES, so `hasQuirk(e, 'VAMPIRIC')` and `hasAffix(e, 'VAMPIRIC')` are different
    // questions spelled the same way. They do not collide in fact - one gates on isPlayer and
    // the other is only ever put on a hostile - but a reader grepping the id finds both, and a
    // census counting the id rather than the read would have double-counted it.
    const collide = await page.evaluate(() => {
      const q = QUIRK_POOL.map(x => x.id), a = ELITE_AFFIXES.map(x => x.id);
      return { shared: q.filter(id => a.includes(id)),
               quirkGated: /isPlayer/.test(hasQuirk.toString()),
               affixOnFoe: !ELITE_AFFIXES.some(x => x.player) };
    });
    ok(`${collide.shared.length} id is in both the quirk pool and the affix pool (${collide.shared.join(', ') || 'none'})`,
      collide.shared.length === 1 && collide.shared[0] === 'VAMPIRIC');
    ok('and they cannot be confused at runtime, because hasQuirk answers only for a player',
      collide.quirkGated && collide.affixOnFoe);

    // ── The counter counts, and counts the right half ────────────────────────────
    // seen is the times the question was ASKED - a body holding the quirk swung - and fired the
    // times the answer was yes. A body without the quirk must not be counted as a miss, which
    // would drive every rate toward zero and make a live quirk look like dead content.
    const counted = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField();
      runStats.qk = {};
      const hero = window.__bare(playerRoster.find(c => c.gridPos > 0));
      hero.gridPos = 2; hero.hp = hero.maxHp = 900;
      const foe = window.__dummy({ id: 'q0', hp: 400, maxHp: 400 });
      activeEntities = [hero, foe];
      // A quirk that is NOT one of the conditional five, so the body gets past quirkDmgMult's
      // own early return and every one of the five is genuinely offered the question and
      // declines it. The first draft used a body with no quirk at all, which returns before the
      // counter is reached - so it proved nothing, and mutation testing said so.
      hero.quirk = { id: 'STURDY', name: 'STURDY' };
      quirkDmgMult(hero, foe);
      const none = JSON.parse(JSON.stringify(runStats.qk));
      // DUELIST, asked twice and answered differently: one foe standing is a duel, two is not.
      hero.quirk = { id: 'DUELIST', name: 'DUELIST' };
      const alone = quirkDmgMult(hero, foe);
      activeEntities = [hero, foe, window.__dummy({ id: 'q1', hp: 400, maxHp: 400 })];
      const crowd = quirkDmgMult(hero, foe);
      return { none, duelist: runStats.qk.DUELIST, alone, crowd };
    });
    ok('a body carrying a different quirk is never counted as having missed these',
      Object.keys(counted.none).length === 0);
    ok(`DUELIST asked twice and answered once (${counted.duelist.fired} of ${counted.duelist.seen})`,
      counted.duelist.seen === 2 && counted.duelist.fired === 1);
    ok(`and the count did not change what the quirk pays (x${counted.alone.toFixed(2)} one-on-one, x${counted.crowd.toFixed(2)} against two)`,
      counted.alone > 1 && counted.crowd === 1);

    // ── M08: what DUELIST is a duel WITH ─────────────────────────────────────────
    // It used to read `dist === 0` - the target is the first foe still standing - and M08
    // measured that at 80% of its holder's swings against a pool whose other four conditions sit
    // at 10-17%. The rate was not fixable by threshold: 29% of all swings have one foe left, and
    // even a player picking targets at random fires "the front" 57% of the time. So the question
    // changed rather than the dial. These rows pin the new one and prove the old one is gone:
    // the count must not move with WHICH foe is hit, only with HOW MANY are up.
    const duel = await page.evaluate(() => {
      const probe = (n, hit) => {
        window.__clearField();
        const hero = window.__bare(playerRoster.find(c => c.gridPos > 0));
        hero.gridPos = 2; hero.hp = hero.maxHp = 900;
        hero.quirk = { id: 'DUELIST', name: 'DUELIST' };
        const foes = [];
        for (let i = 0; i < n; i++) foes.push(window.__dummy({ id: `d${i}`, hp: 400, maxHp: 400 }));
        activeEntities = [hero, ...foes];
        return quirkDmgMult(hero, foes[hit]);
      };
      // A corpse is not an opponent, so a line of three with two down is still a duel.
      const dead = (() => {
        window.__clearField();
        const hero = window.__bare(playerRoster.find(c => c.gridPos > 0));
        hero.gridPos = 2; hero.hp = hero.maxHp = 900;
        hero.quirk = { id: 'DUELIST', name: 'DUELIST' };
        const live = window.__dummy({ id: 'dl', hp: 400, maxHp: 400 });
        const down = [window.__dummy({ id: 'dd0', hp: 0, maxHp: 400 }),
                      window.__dummy({ id: 'dd1', hp: 0, maxHp: 400 })];
        activeEntities = [hero, ...down, live];
        return quirkDmgMult(hero, live);
      })();
      return { one: probe(1, 0), twoFront: probe(2, 0), twoBack: probe(2, 1), three: probe(3, 0), dead,
               mult: DUELIST_MULT };
    });
    ok(`one left standing pays (x${duel.one.toFixed(2)})`, duel.one === duel.mult && duel.mult > 1);
    ok(`two standing pays nothing, whichever of them is hit (x${duel.twoFront.toFixed(2)} front, x${duel.twoBack.toFixed(2)} behind)`,
      duel.twoFront === 1 && duel.twoBack === 1);
    // THE ROW THAT WOULD CATCH A REVERT. Under the old condition twoFront would pay and twoBack
    // would not; under the new one neither does. Asserting they are EQUAL is what makes this a
    // guard on the question rather than on the answer.
    ok('and the card no longer reads which foe was hit at all',
      duel.twoFront === duel.twoBack && duel.three === 1);
    ok(`a corpse is not an opponent - two down and one up is still a duel (x${duel.dead.toFixed(2)})`,
      duel.dead === duel.mult);

    // ── The pair that used to share one condition ────────────────────────────────
    // PACK_HUNTER and LONER read the SAME neighbour test from opposite sides, and M05's census
    // is what that was worth: 98% and 2%. A three-deep line is three adjacent ranks, so nobody
    // is ever alone. M05b split them onto two conditions that are genuinely different questions
    // - who is beside you, and how many are in front of you - and these rows are the guard on
    // that: they must no longer be complements, because a complementary pair is one fact.
    const pair = await page.evaluate(() => {
      const probe = (mates, foes) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        window.__clearField();
        const line = playerRoster.filter(c => c.gridPos > 0).sort((a, b) => a.gridPos - b.gridPos);
        const hero = window.__bare(line[0]);
        hero.gridPos = 2; hero.hp = hero.maxHp = 900;
        const beside = mates.map((pos, i) => {
          const m = window.__bare(line[i + 1]);
          m.gridPos = pos; m.hp = m.maxHp = 500;
          return m;
        });
        const hostiles = [];
        for (let i = 0; i < foes; i++) hostiles.push(window.__dummy({ id: 'q' + i, hp: 400, maxHp: 400 }));
        activeEntities = [hero, ...beside, ...hostiles];
        const read = (id) => {
          hero.quirk = { id, name: id };
          runStats.qk = {};
          quirkDmgMult(hero, hostiles[0]);
          return (runStats.qk[id] || {}).fired || 0;
        };
        return { pack: read('PACK_HUNTER'), loner: read('LONER') };
      };
      return { flankedAndEven: probe([1, 3], 2),     // both sides held, not outnumbered
               flankedAndOut:  probe([1, 3], 9),     // both sides held AND outnumbered
               oneSide:        probe([1], 1),        // an ally, but only on one side
               aloneAndEven:   probe([], 1) };       // nobody beside, nobody spare either
    });
    ok(`an ally on both sides pays PACK HUNTER and nothing else (${pair.flankedAndEven.pack}/${pair.flankedAndEven.loner})`,
      pair.flankedAndEven.pack === 1 && pair.flankedAndEven.loner === 0);
    ok(`an ally on one side pays neither, which is the change (${pair.oneSide.pack}/${pair.oneSide.loner})`,
      pair.oneSide.pack === 0 && pair.oneSide.loner === 0);
    ok(`being outnumbered pays LONER (${pair.flankedAndOut.loner}) and standing alone against one does not (${pair.aloneAndEven.loner})`,
      pair.flankedAndOut.loner === 1 && pair.aloneAndEven.loner === 0);
    // THE POINT OF THE SPLIT, as an assertion rather than a comment: there is now a state where
    // BOTH pay and a state where NEITHER does. Under the old pair neither was reachable, because
    // one condition was the other's negation and exactly one always held.
    ok(`and the two are no longer one fact - both pay at once here (${pair.flankedAndOut.pack}/${pair.flankedAndOut.loner}), neither there (${pair.aloneAndEven.pack}/${pair.aloneAndEven.loner})`,
      pair.flankedAndOut.pack === 1 && pair.flankedAndOut.loner === 1
      && pair.aloneAndEven.pack === 0 && pair.aloneAndEven.loner === 0);

    // LONER counts what is LEFT of the squad, not what was deployed - which is most of the point
    // of it. A body on the floor is not standing between anybody and anything, so it has to stop
    // counting the moment it goes down. Mutation testing found this: dropping the health filter
    // from the count survived every row above, because none of them had a casualty in it.
    const casualty = await page.evaluate(() => {
      const probe = (down) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        window.__clearField();
        const line = playerRoster.filter(c => c.gridPos > 0);
        const hero = window.__bare(line[0]);
        hero.gridPos = 2; hero.hp = hero.maxHp = 900;
        const mates = [1, 3].map((pos, i) => {
          const m = window.__bare(line[i + 1]);
          m.gridPos = pos; m.maxHp = 500; m.hp = i < down ? 0 : 500;
          return m;
        });
        const foes = [0, 1, 2].map(i => window.__dummy({ id: 'f' + i, hp: 400, maxHp: 400 }));
        activeEntities = [hero, ...mates, ...foes];
        // Both halves of the pair read "is this body still up", so both are probed on the same
        // field: a casualty turns LONER on and PACK HUNTER off, and each direction has to be
        // measured or one of them keeps counting the dead.
        const read = (id) => {
          hero.quirk = { id, name: id };
          runStats.qk = {};
          quirkDmgMult(hero, foes[0]);
          return (runStats.qk[id] || {}).fired || 0;
        };
        return { loner: read('LONER'), pack: read('PACK_HUNTER') };
      };
      return { whole: probe(0), oneDown: probe(1), twoDown: probe(2) };
    });
    ok(`three standing against three does not pay LONER (${casualty.whole.loner}), and does pay PACK HUNTER (${casualty.whole.pack})`,
      casualty.whole.loner === 0 && casualty.whole.pack === 1);
    ok(`the moment one is on the floor LONER pays (${casualty.oneDown.loner}, ${casualty.twoDown.loner} with two down)`,
      casualty.oneDown.loner === 1 && casualty.twoDown.loner === 1);
    ok(`and PACK HUNTER stops, because a body on the floor is not standing beside anybody (${casualty.oneDown.pack})`,
      casualty.oneDown.pack === 0 && casualty.twoDown.pack === 0);

    // ── An operator rolled before a rewording does not carry the old promise ─────
    // A quirk is stored as the whole pool object, not as an id, so a save written before M05b
    // carries "+15% DMG with an ally in the next rank" on the card while hasQuirk - which
    // matches on id - applies the new rule. That is the M03 defect exactly: a surface left
    // saying something the engine stopped doing. The WORDS are re-resolved on load; the stats
    // deliberately are not, because those were applied to the sheet when the quirk was rolled
    // and re-resolving them would either double them or silently drop them.
    const worded = await page.evaluate(() => {
      const live = QUIRK_POOL.find(q => q.id === 'PACK_HUNTER');
      const roster = [{ id: 'x', traits: [], hp: 80, maxHp: 80, dmgBase: 20, speed: 9,
                        quirk: { id: 'PACK_HUNTER', name: 'PACK HUNTER',
                                 desc: '+15% DMG with an ally in the next rank',
                                 dmg: 0, hp: 0, spd: 0 } },
                     { id: 'y', traits: [], hp: 80, maxHp: 80,
                        quirk: { id: 'RECKLESS', name: 'RECKLESS', desc: 'stale words',
                                 dmg: 5, hp: -15, spd: 0 } },
                     { id: 'z', traits: [], hp: 80, maxHp: 80, quirk: null }];
      const out = migrateTraits(JSON.parse(JSON.stringify(roster)));
      const reck = QUIRK_POOL.find(q => q.id === 'RECKLESS');
      return { desc: out[0].quirk.desc, want: live.desc,
               stats: JSON.stringify([out[0].quirk.dmg, out[0].quirk.hp, out[0].quirk.spd]),
               reckDesc: out[1].quirk.desc, reckWant: reck.desc,
               // The stored stats are left exactly as the save had them.
               reckStats: JSON.stringify([out[1].quirk.dmg, out[1].quirk.hp, out[1].quirk.spd]),
               noQuirk: out[2].quirk };
    });
    ok(`a quirk rolled before the rewording reads the current promise ("${worded.desc}")`,
      worded.desc === worded.want && !/next rank/.test(worded.desc));
    ok(`and so does one whose words were never the point ("${worded.reckDesc}")`,
      worded.reckDesc === worded.reckWant);
    ok(`while the stats the save banked are left alone (${worded.reckStats})`,
      worded.reckStats === '[5,-15,0]' && worded.stats === '[0,0,0]');
    ok('and an operator with no quirk is not given one', worded.noQuirk === null);

    // ── Every draw site files what it drew ───────────────────────────────────────
    // Four places roll a quirk - the muster, a muster reroll, the Armory's reroll and a recruit
    // signing on. A census that missed one would read as a pool with a hole in it, and the hole
    // would look exactly like content nobody reaches.
    const drawn = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const sites = (src.match(/\.quirk = /g) || []).length;
      const noted = (src.match(/noteQuirkDrawn\(/g) || []).length - 1;  // less the definition
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const fromMuster = Object.values(runStats.qkDrawn || {}).reduce((a, b) => a + b, 0);
      return { sites, noted, fromMuster, line: playerRoster.length };
    });
    ok(`all ${drawn.sites} sites that roll a quirk file what they rolled (${drawn.noted} noted)`,
      drawn.noted === drawn.sites);
    ok(`and a fresh muster files one per operator (${drawn.fromMuster} of ${drawn.line})`,
      drawn.fromMuster === drawn.line && drawn.line > 0);

    // ── The ledger reaches the report ────────────────────────────────────────────
    // L03's shape: a counter the engine keeps and nothing reads is the same as no counter. The
    // simulator copies runStats onto its own per-run object, and that hand-off is the join.
    const fs = require('fs');
    const path = require('path');
    const sim = fs.readFileSync(path.join(__dirname, '..', 'simulate.js'), 'utf8');
    ok('the simulator carries the quirk ledger off the run and into the report',
      /stat\.qk\s*=\s*runStats\.qk/.test(sim) && /stat\.qkDrawn\s*=\s*runStats\.qkDrawn/.test(sim));
    ok('and reads the pool and the conditional set off the engine rather than keeping a copy',
      /QUIRK_POOL\.map\(q => q\.id\)/.test(sim) && /quirkDmgMult/.test(sim));
  }
};

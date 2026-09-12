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
      quirkDmgMult(hero, foe, 0);
      const none = JSON.parse(JSON.stringify(runStats.qk));
      // DUELIST, asked twice and answered differently: dist 0 is the enemy front, dist 2 is not.
      hero.quirk = { id: 'DUELIST', name: 'DUELIST' };
      const near = quirkDmgMult(hero, foe, 0);
      const far = quirkDmgMult(hero, foe, 2);
      return { none, duelist: runStats.qk.DUELIST, near, far };
    });
    ok('a body carrying a different quirk is never counted as having missed these',
      Object.keys(counted.none).length === 0);
    ok(`DUELIST asked twice and answered once (${counted.duelist.fired} of ${counted.duelist.seen})`,
      counted.duelist.seen === 2 && counted.duelist.fired === 1);
    ok(`and the count did not change what the quirk pays (x${counted.near.toFixed(2)} at the front, x${counted.far.toFixed(2)} behind it)`,
      counted.near > 1 && counted.far === 1);

    // ── The pair that shares one condition ───────────────────────────────────────
    // PACK_HUNTER and LONER read the same neighbour test from opposite sides, so on any given
    // swing exactly one of them would pay. Asserted because it is what makes the census reading
    // of the two a single fact rather than two: whatever rate one fires at, the other is its
    // complement, and a pool cannot hold both as live choices unless that rate is near half.
    const pair = await page.evaluate(() => {
      const probe = (alone) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        window.__clearField();
        const line = playerRoster.filter(c => c.gridPos > 0).sort((a, b) => a.gridPos - b.gridPos);
        const hero = window.__bare(line[0]);
        hero.gridPos = 1; hero.hp = hero.maxHp = 900;
        const mate = window.__bare(line[1]);
        mate.gridPos = 2; mate.hp = alone ? 0 : 500; mate.maxHp = 500;
        const foe = window.__dummy({ id: 'q0', hp: 400, maxHp: 400 });
        activeEntities = [hero, mate, foe];
        const read = (id) => {
          hero.quirk = { id, name: id };
          runStats.qk = {};
          quirkDmgMult(hero, foe, 0);
          return (runStats.qk[id] || {}).fired || 0;
        };
        return { pack: read('PACK_HUNTER'), loner: read('LONER') };
      };
      return { together: probe(false), alone: probe(true) };
    });
    ok(`with the next rank standing, PACK HUNTER pays and LONER does not (${pair.together.pack}/${pair.together.loner})`,
      pair.together.pack === 1 && pair.together.loner === 0);
    ok(`with it down, the other way round (${pair.alone.pack}/${pair.alone.loner})`,
      pair.alone.pack === 0 && pair.alone.loner === 1);

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

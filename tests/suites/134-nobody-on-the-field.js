// G13. Chasing a balance question, the simulator crashed twice in about 900 runs inside an
// event choice, reading .hp of undefined. Two things came out of it and they are not the same
// kind of thing, so this suite keeps them apart.
//
// The GAME half is small and was never reachable. WRECKED CARAVAN's "Gut the Engine" picks a
// random deployed operator and hurts them, and was offered unconditionally - while its two
// siblings, THE MINEFIELD and THE ORACLE, both guard the identical pick with
// `deployed().length > 0`. One of three written the same way, guarded differently. But a player
// cannot get there: musterDeploy refuses to start a run with fewer than one on the line,
// recoverDowned floors every survivor at 1, loseOperator takes the fallen out of the roster
// entirely, and every consequence and the withdrawal clamp at 1 as well. So the guard is a
// consistency fix and a floor under a future change, NOT a crash anybody could hit.
//
// The HARNESS half is the real defect and is fixed in tests/simulate.js: its doctrine draft
// built a line one legal member at a time, asking holds() of every prefix, and three of the
// seven doctrines are whole-line predicates that no prefix satisfies. It fielded nobody on 6 of
// 30 runs and reported depth, score and a win rate for squads that were not there.
//
// What this suite can hold on to is the pair of invariants underneath both: the engine will not
// let the field empty, and no event choice throws if it somehow does.
const path = require('path');
const fs = require('fs');

module.exports = {
  name: 'Nobody on the field',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── The door that will not open ───────────────────────────────────────────────
    const muster = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const startLine = deployedLine().length;
      // Bench everybody through the real control, then try to deploy from the muster screen.
      playerRoster.forEach(c => { let guard = 0; while (c.gridPos !== 0 && guard++ < 8) musterRank(c.id); });
      const emptied = deployedLine().length;
      renderMuster();
      const screenBefore = currentScreen();
      musterDeploy();
      return { startLine, emptied, screenBefore, screenAfter: currentScreen() };
    });
    ok(`a fresh run starts with a line (${muster.startLine})`, muster.startLine > 0);
    ok(`the muster can be emptied (${muster.emptied} standing)`, muster.emptied === 0);
    ok(`but deploying an empty line does not start the run (${muster.screenBefore} -> ${muster.screenAfter})`,
      muster.screenBefore === 'screen-muster' && muster.screenAfter === 'screen-muster');

    // ── And the three ways a line empties mid-run, which all floor at one ──────────
    const floors = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const out = {};
      // recoverDowned: the one exit every fight funnels through
      const line = deployedLine();
      activeEntities = line.map(c => Object.assign(c, { hp: 0, downTurns: 2, isPlayer: true }));
      recoverDowned('for the test');
      out.afterRecover = line.map(c => c.hp);
      out.recoverFloor = line.every(c => c.hp >= 1);
      // loseOperator: gone from the roster, not left standing at zero
      const victim = deployedLine()[0];
      const before = playerRoster.length;
      loseOperator(victim, 'the test');
      out.rosterShrank = playerRoster.length === before - 1;
      out.victimGone = !playerRoster.some(c => c.id === victim.id);
      out.stillSomebody = deployed().length > 0;
      return out;
    });
    ok(`a fight end picks everybody up off the floor (${floors.afterRecover.join('/')})`, floors.recoverFloor);
    ok('and an operator lost for good leaves the roster rather than standing at zero',
      floors.rosterShrank && floors.victimGone);
    ok('so somebody is still on the field afterwards', floors.stillSomebody);

    // ── The sweep: no choice in any pool throws on an empty field ─────────────────
    // Every choice, not the one that was found. A guard added to one event says nothing about
    // the next one written the same way, and this is the assertion that does.
    const sweep = await page.evaluate(() => {
      const bad = [];
      let offered = 0, choices = 0;
      EVENT_POOL.forEach(ev => {
        let chs = [];
        try { chs = choicesFor(ev) || []; } catch (e) { bad.push(`${ev.title} :: choicesFor threw ${e.message}`); return; }
        chs.forEach(ch => {
          choices++;
          currentSlot = 1; confirmNewGame(1.0);
          scrap = 9999; materials = { tech: 99, parts: 99, chem: 99 };
          playerRoster.forEach(p => { p.gridPos = 0; });   // the state the engine will not produce
          let can = false;
          try { can = !!ch.canAfford(); } catch (e) { bad.push(`${ev.title} :: ${ch.label} :: canAfford threw ${e.message}`); return; }
          if (!can) return;
          offered++;
          try { ch.execute(); } catch (e) { bad.push(`${ev.title} :: ${ch.label} :: ${e.message}`); }
        });
      });
      return { events: EVENT_POOL.length, choices, offered, bad };
    });
    ok(`no event choice throws with nobody on the field (${sweep.events} events, ${sweep.choices} choices, ${sweep.offered} still offered)${sweep.bad.length ? ' — ' + sweep.bad.join('; ') : ''}`,
      sweep.bad.length === 0);
    // A guard that withheld everything would also pass the line above, and would be a different
    // bug: an event screen with no way off it.
    ok(`and most of them are still offered rather than all withheld (${sweep.offered} of ${sweep.choices})`,
      sweep.offered > sweep.choices * 0.5);

    // ── The one that was wrong, and the two it should have matched ────────────────
    const caravan = await page.evaluate(() => {
      const guardOf = (title, match) => {
        const ev = EVENT_POOL.find(e => e.title === title);
        const ch = choicesFor(ev).find(c => match.test(c.label));
        return { src: String(ch.canAfford).replace(/\s+/g, ' '), ch };
      };
      currentSlot = 1; confirmNewGame(1.0);
      const gut = guardOf('WRECKED CARAVAN', /Gut the Engine/);
      const mine = guardOf('THE MINEFIELD', /Cross it/);
      const oracle = guardOf('THE ORACLE', /Pay for a reading/);
      const withLine = { deployed: deployed().length, offered: gut.ch.canAfford() };
      let ran = null;
      try { ran = !!gut.ch.execute(); } catch (e) { ran = 'threw: ' + e.message; }
      playerRoster.forEach(p => { p.gridPos = 0; });
      const withoutLine = { deployed: deployed().length, offered: gut.ch.canAfford() };
      return { gut: gut.src, mine: mine.src, oracle: oracle.src, withLine, withoutLine, ran };
    });
    ok(`with a line the caravan choice is offered and works (${caravan.withLine.deployed} deployed)`,
      caravan.withLine.offered === true && caravan.ran === true);
    ok(`with nobody on the field it is not offered (deployed ${caravan.withoutLine.deployed})`,
      caravan.withoutLine.offered === false);
    ok(`and it now asks what its siblings ask (${caravan.gut})`, /deployed\(\)\.length > 0/.test(caravan.gut));
    ok(`the same question THE MINEFIELD asks (${caravan.mine})`, /deployed\(\)\.length > 0/.test(caravan.mine));
    ok(`and THE ORACLE (${caravan.oracle})`, /deployed\(\)\.length > 0/.test(caravan.oracle));

    // ── What the harness's draft has to respect ──────────────────────────────────
    // The simulator's doctrine draft assembled a line member by member and asked holds() at each
    // step. These are the engine-side facts that made that wrong, pinned here so a doctrine
    // reworked into something incrementally buildable does not quietly change the requirement
    // the harness was fixed to meet.
    const doctrines = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const out = {};
      DOCTRINES.forEach(d => {
        const singles = playerRoster.filter(c => d.holds([c])).length;
        let triples = 0;
        const r = playerRoster;
        for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) for (let k = j + 1; k < r.length; k++) {
          [r[i], r[j], r[k]].forEach((c, n) => { c.gridPos = n + 1; });
          if (d.holds([r[i], r[j], r[k]])) triples++;
        }
        playerRoster.forEach(c => { c.gridPos = 0; });
        out[d.id] = { singles, triples };
      });
      return out;
    });
    const wholeLine = Object.entries(doctrines).filter(([, v]) => v.singles === 0);
    ok(`some doctrines are whole-line predicates no single operator satisfies (${wholeLine.map(([k]) => k).join(', ') || 'none'})`,
      wholeLine.length > 0);
    const fieldable = wholeLine.filter(([, v]) => v.triples > 0);
    ok(`and at least one of those is still fieldable by a complete line (${fieldable.map(([k, v]) => `${k} ${v.triples}`).join(', ') || 'none'})`,
      fieldable.length > 0);
    // Both of the two that broke the harness are named, not just counted. Asking only whether
    // SOME doctrine is whole-line lets either of these be reworked into something a prefix
    // satisfies without anything going red, and the harness's draft was fixed for these two.
    ok('THE WALL is one of them, because it reads the rank a member is standing in',
      doctrines.THE_WALL && doctrines.THE_WALL.singles === 0);
    ok(`BROAD SPECTRUM is the other, because no one operator answers in all three damage types (${doctrines.BROAD_SPECTRUM && doctrines.BROAD_SPECTRUM.singles} single-member lines hold it)`,
      doctrines.BROAD_SPECTRUM && doctrines.BROAD_SPECTRUM.singles === 0);

    // ── And the harness no longer asks the question that way ─────────────────────
    // O12 MOVED WHERE THIS LIVES, and this row is why that was noticed rather than assumed. G13
    // fixed the pooled `--draft doctrine` branch in place, and these two rows read that branch's
    // own slice of the source. They were correct and they were narrow: `--draft doctrine:<id>`
    // ten lines above kept the prefix test for another whole phase, and no row here looked at it
    // because the slice stopped short of it. O12 found that by pointing an arm at THE WALL and
    // getting 150 of 150 runs fielding nobody.
    //
    // The search is one helper both policies call now, so the assertion moves up with it - and
    // the prefix test is checked against the WHOLE FILE rather than one branch's slice, which is
    // the narrowness that let the second copy sit there.
    const sim = fs.readFileSync(path.join(__dirname, '..', 'simulate.js'), 'utf8');
    ok('no doctrine draft anywhere grows a line asking holds() of every prefix',
      !/d\.holds\(\[\.\.\.draft, c\]\)/.test(sim));
    const helper = sim.slice(sim.indexOf('const lineKeeping = d =>'),
                             sim.indexOf("if (draftPolicy === 'random')"));
    ok('it places a whole candidate line before asking', /place\(cand\);\s*if \(d\.holds\(cand\)\)/.test(helper));
    ok('and every doctrine policy goes through that one search',
      (sim.match(/lineKeeping\(d\)/g) || []).length === 2);
    // And BOTH of them say so when nothing this roster can field keeps the doctrine. The pooled
    // branch always did; the named one fielded nobody instead, silently, which is what O12 walked
    // into. Counted rather than merely present, so a future edit cannot drop one of the two.
    ok('and both of them say so when no line this roster can field keeps the doctrine',
      (sim.match(/stat\.doctrineUnfieldable = want;/g) || []).length === 2);
  }
};

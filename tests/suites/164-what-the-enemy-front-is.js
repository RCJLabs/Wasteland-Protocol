// M08. Two cards said "the enemy front" and read `dist === 0` - DUELIST in the quirk pool at 80%
// of its holder's swings, SLACK LINE in the harpooner's signatures at 66%. M05 and M06 filed them
// together as one problem. They were two.
//
//   THE STRUCTURE. `dist` is an INDEX into the living-enemy list, not a rank, because hostiles
//   have no rank: every site that writes gridPos writes it to a playerRoster member and no enemy
//   constructor sets one. So "the enemy front" can only mean the first one still standing. That
//   is not a defect in the cards - it is the only referent the engine has - but it does mean one
//   unguarded read of t.gridPos in mitigate has never applied to a hostile, which TERRAIN's own
//   documentation says it should.
//
//   THE RATE. 79% of all swings land on the front. 29% of swings have one foe left, where the
//   front is the only thing there is. Of the rest, 70% still take the front against 39% under a
//   random draw - a real preference, and not the harness's, since its targeting never consults
//   position. A player picking at random would still fire "the front" 57% of the time, so the
//   condition could not be fixed by moving a threshold.
//
//   THE SPLIT. DUELIST rides that baseline: 1% of its firings were against something the squad
//   hauled to the front. SLACK LINE does not: 30% of its firings were, because Drag Line, Set The
//   Hook and Iron Barb all call haulForward. One card is a flat bonus in conditional clothing;
//   the other is a class synergy that happens to share its words.
//
// So DUELIST was re-keyed to what its name promised and SLACK LINE was left alone. This suite
// holds the structural facts the decision rests on, because every one of them was a thing I had
// assumed rather than checked at some point in getting here.
module.exports = {
  name: 'What the enemy front is',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', '..');
    const src = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
    const sim = fs.readFileSync(path.join(root, 'tests', 'simulate.js'), 'utf8');

    // ── Hostiles have no rank ────────────────────────────────────────────────────
    // The premise everything else rests on, proved two ways, because a probe agreeing with my
    // reading of the source is not independent of it. First the source: every assignment.
    const writes = src.split('\n')
      .map((l, i) => ({ n: i + 1, l: l.trim() }))
      .filter(x => /\.gridPos\s*=[^=]/.test(x.l) && !x.l.startsWith('//'));
    // A write is player-side if the thing written is drawn from playerRoster, guarded on
    // isPlayer, or is one of the two locals the drag/swap blocks take off a player-only list.
    const hostileWrite = writes.filter(x =>
      !/playerRoster|isPlayer|\bchar\b|\bch\.|\bnext\.|\bback\.|\bfront\.|actEnt|target\.gridPos = mine|\bp\.gridPos\b/.test(x.l));
    ok(`${writes.length} sites write gridPos and none of them writes it to a hostile${
        hostileWrite.length ? ': ' + hostileWrite.map(x => `game.js:${x.n}`).join(', ') : ''}`,
      hostileWrite.length === 0);

    // And then the runtime, which does not care what I think the source says.
    const ranks = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const seen = new Set();
      let built = 0;
      // Every faction the pool holds, at every depth band the generator will serve, so this is
      // not one draw. Elite and boss nodes too: those build through different constructors.
      // Boss nodes go down a different constructor entirely - a commander plus the escort or
      // ward it hides behind - so the list is the pool's factions and BOSS beside them.
      const factions = [...Object.keys(ENEMY_POOL), 'BOSS'];
      factions.forEach(f => {
        [1, 5, 9, 13].forEach(tier => {
          currentTier = tier;
          [false, true].forEach(elite => {
            const squad = generateEnemies(f, 1.0, elite) || [];
            squad.forEach(e => { built++; seen.add(typeof e.gridPos); });
          });
        });
      });
      return { built, kinds: [...seen], factions };
    });
    ok(`${ranks.built} hostiles built across four depths and both node kinds of ${ranks.factions.join(', ')}`,
      ranks.built > 100 && ranks.factions.length >= 5 && ranks.factions.includes('BOSS'));
    ok(`and not one of them carries a rank (gridPos is ${ranks.kinds.join('/')})`,
      ranks.kinds.length === 1 && ranks.kinds[0] === 'undefined');

    // ── Which makes one terrain read dead, and the codex says it should not be ──
    // Filed rather than fixed here: it is a terrain question with its own difficulty cost, and
    // this row exists so it cannot be quietly forgotten. If somebody guards or re-keys that
    // line, this row is what tells them the doc above it was the reason.
    const cover = src.slice(src.indexOf('let ac = ('), src.indexOf('// Every dose the Vatborn takes'));
    ok('the ruins front-cover read is the one gridPos test in mitigate with no isPlayer guard',
      /if \(t\.gridPos === 1 && ground\(\)\.frontCover/.test(cover)
      && /t\.isPlayer && t\.gridPos <= meshRanks\(\)/.test(cover)
      && /t\.isPlayer && t\.gridPos === 1/.test(cover));
    ok('and TERRAIN still documents it as applying to both sides, which it cannot',
      /frontCover whoever stands in the front rank takes less, whichever side they are on/.test(src));

    // ── DUELIST asks how many, not which ────────────────────────────────────────
    const duel = await page.evaluate(() => {
      const q = QUIRK_POOL.find(x => x.id === 'DUELIST');
      const fn = quirkDmgMult.toString();
      return { desc: q.desc, name: q.name,
               readsDist: /dist/.test(fn), arity: quirkDmgMult.length };
    });
    ok(`DUELIST's card says what it now does ("${duel.desc}")`,
      /only one enemy is left standing/.test(duel.desc) && !/enemy front/.test(duel.desc));
    ok('and quirkDmgMult no longer takes a distance at all, so the old question cannot come back by accident',
      !duel.readsDist && duel.arity === 2);

    // ── SLACK LINE still asks which, because its class can answer ───────────────
    ok('SLACK LINE was left reading the front, deliberately',
      /sig\('SLACK_LINE', dist === 0\)/.test(src));
    ok('and the three abilities that set that condition up all haul',
      (src.match(/haulForward\(/g) || []).length >= 5
      && /pendingAction === 'DRAG_LINE'/.test(src)
      && /CAP_SET_THE_HOOK/.test(src));

    // ── The haul moves a foe to the front, and says who put them there ──────────
    // The flag is what separates a synergy from a coincidence, so it has to be exclusive: the
    // last thing hauled is the only thing that can claim it.
    const haul = await page.evaluate(() => {
      window.__clearField();
      runStats.hl = null;
      const hero = window.__bare(playerRoster.find(c => c.gridPos > 0));
      const a = window.__dummy({ id: 'h0', hp: 100, maxHp: 100 });
      const b = window.__dummy({ id: 'h1', hp: 100, maxHp: 100 });
      const c = window.__dummy({ id: 'h2', hp: 100, maxHp: 100 });
      activeEntities = [hero, a, b, c];
      const order = () => activeEntities.filter(e => !e.isPlayer).map(e => e.id).join(',');
      const before = order();
      const movedC = haulForward(c);
      const afterC = order();
      const flagsC = [a, b, c].map(e => !!e.hauledIn);
      const movedB = haulForward(b);
      const flagsB = [a, b, c].map(e => !!e.hauledIn);
      const already = haulForward(activeEntities.filter(e => !e.isPlayer)[0]);
      return { before, afterC, movedC, movedB, already, flagsC, flagsB,
               order: order(), tally: JSON.parse(JSON.stringify(runStats.hl)) };
    });
    ok(`a haul walks the target to the head of the line (${haul.before} -> ${haul.afterC})`,
      haul.movedC && haul.afterC === 'h2,h0,h1');
    ok('and it is the only one flagged as having been put there', String(haul.flagsC) === 'false,false,true');
    ok(`hauling somebody else in front takes the claim off the first (${haul.order})`,
      haul.movedB && String(haul.flagsB) === 'false,true,false');
    ok('hauling whoever is already at the front moves nothing', haul.already === false);
    ok(`and the ledger counts the attempt either way (${haul.tally.moved} moved of ${haul.tally.tried} tried)`,
      haul.tally.tried === 3 && haul.tally.moved === 2);

    // ── The census divides by the right thing ───────────────────────────────────
    // M07's whole lesson in one row. A swing with one foe left cannot say whether anybody chose
    // the front, so it must not sit in the numerator of a figure about choosing.
    const census = await page.evaluate(() => {
      runStats.rch = null; runStats.frt = null;
      noteReach(0, 1); noteReach(0, 3); noteReach(2, 3); noteReach(0, 9);
      noteReach(0, 0);                       // nothing standing: not a swing at anybody
      noteFront('X', 0, 1, false);           // fired, but on a lone survivor
      noteFront('X', 0, 4, true);            // fired against a line, on something hauled there
      noteFront('X', 3, 4, false);           // did not fire
      // The row mutation testing bought: the squad hauled somebody in and then hit somebody
      // else. Without it, counting the haul off every swing rather than off the firings scores
      // exactly the same, and the distinction the whole finding rests on is untested.
      noteFront('X', 2, 4, true);            // hauled, but the swing went elsewhere
      return { rch: JSON.parse(JSON.stringify(runStats.rch)), frt: JSON.parse(JSON.stringify(runStats.frt.X)) };
    });
    ok(`a swing with nobody standing is not counted at all (${census.rch.swings} of 5 offered)`,
      census.rch.swings === 4);
    ok('the line depth is banded at five, so a crowd does not spread the tail',
      census.rch.byStanding['5'] === 1 && census.rch.byStanding['9'] === undefined);
    ok(`the front is counted per band as well as in total (${census.rch.atFront} of ${census.rch.swings})`,
      census.rch.atFront === 3 && census.rch.frontByStanding['3'] === 1 && census.rch.byStanding['3'] === 2);
    ok(`a card's firings and its firings-against-a-line are separate tallies (${
        census.frt.fired}/${census.frt.seen} and ${census.frt.firedLine}/${census.frt.seenLine})`,
      census.frt.seen === 4 && census.frt.fired === 2 && census.frt.seenLine === 3 && census.frt.firedLine === 1);
    ok(`and the hauled share is counted off the firings, not off the swings (${census.frt.firedHauled})`,
      census.frt.firedHauled === 1);

    // ── The report carries it off the run ───────────────────────────────────────
    ok('the simulator takes the reach census, the per-card split and the haul off runStats',
      /stat\.rch = runStats\.rch/.test(sim) && /stat\.frt = runStats\.frt/.test(sim) && /stat\.hl = runStats\.hl/.test(sim));
    ok('and prints the random-draw baseline beside the measured share, which is what makes it readable',
      /if the target were drawn at random from the living/.test(sim));
    ok('the per-card accumulator sums every key it declares rather than a hand-written list',
      /Object\.keys\(t\)\.forEach\(k => \{ t\[k\] \+= Number\(row\[k\]\) \|\| 0; \}\)/.test(sim));
    ok('and says so plainly when the harness never reached the haul at all',
      /NEVER ATTEMPTED - the harness cannot reach the one verb/.test(sim));

    // ── An operator who banked the old card reads the new one ───────────────────
    const migrated = await page.evaluate(() => {
      const c = playerRoster[0];
      c.quirk = { id: 'DUELIST', name: 'DUELIST', desc: '+15% DMG against the enemy front' };
      migrateTraits(playerRoster);
      return c.quirk.desc;
    });
    ok(`a save carrying the old wording reads the current promise ("${migrated}")`,
      /only one enemy is left standing/.test(migrated));
  }
};

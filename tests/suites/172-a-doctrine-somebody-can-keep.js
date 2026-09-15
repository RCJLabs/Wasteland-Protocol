// O10. The simulator has had a DOCTRINES block since G13 and nobody had ever run it and written
// the numbers down. The first 150-expedition career taken of it says this, under the default
// draft:
//
//   OLD_GUARD        offered 62, live 61     THE_WALL        offered 55, live 50
//   BROAD_SPECTRUM   offered 56, live 22     FIELD_SURGERY   offered 68, live 17
//   CONSCRIPTS       offered 63, live  5     NO_HANDS        offered 76, live  0
//   LIGHT_ORDER      offered 70, live  0     musters with a live offer: 114 of 150
//
// Two of seven never went live in a hundred and fifty expeditions, and of three cards offered
// only 1.03 were takeable on average. Read as a game fact that is two dead doctrines and barely
// a choice at the muster.
//
// IT IS NOT A GAME FACT. It is D05's trap, and this file is the instrument that catches it.
// `--draft line` opens every muster with a BRUISER or a SHOTGUNNER and then takes a MEDIC 70% of
// the time. NO_HANDS forbids melee and both openers carry it; LIGHT_ORDER caps the line at 55
// health and a Bruiser is 80; FIELD_SURGERY forbids a Medic. All three zeroes and near-zeroes
// have the same cause, and it is the policy's first pick rather than anything about the game.
//
// The question a career cannot answer is whether a line EXISTS that keeps each one - and that
// question needs no sampling at all. Every three-class line, at every arrangement of the three
// slots, against each doctrine's own holds(). Ten classes is 120 lines and 720 arrangements,
// which is a loop, not an estimate.
//
// AND THE FIRST CUT OF THIS PROBE FELL INTO THE SAME TRAP FROM THE OTHER SIDE. Built on level-1
// bodies with an empty career it reported OLD_GUARD keepable by NO line and CONSCRIPTS by EVERY
// line - both of which are the fixture, not the game: OLD_GUARD reads masteryRank off career
// mastery and CONSCRIPTS reads doctrineFavourites off fielding history, and an empty save makes
// the first impossible and the second free. Each is judged here at the state its own offerable()
// gate waits for, which is the only state it is ever asked in.
module.exports = {
  name: 'A doctrine somebody can keep',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    const enumerate = () => page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const pool = [...ROSTER_TEMPLATE, ...RECRUIT_POOL];
      const classes = [...new Set(pool.map(t => t.classType))];
      const bodyFor = cl => {
        const t = pool.find(r => r.classType === cl);
        return { id: 'probe_' + cl, name: cl, classType: cl, range: t.range,
                 maxHp: t.maxHp, hp: t.maxHp, level: 1, traits: [], perks: [],
                 gridPos: 0, cooldowns: {}, dossier: {} };
      };
      // The state each gated doctrine's offerable() waits for, set up rather than assumed.
      // OLD_GUARD wants OLD_GUARD_VETS classes at VETERAN_RANK; CONSCRIPTS wants three
      // favourites. Both are set to the MINIMUM that opens the gate - a doctrine that is only
      // keepable once the whole roster is veteran would be a different finding, and this is the
      // state it is first offered in.
      const vets = classes.slice(0, OLD_GUARD_VETS);
      const m = {}; vets.forEach(c => { m[c] = MASTERY_RANKS[VETERAN_RANK]; });
      mastery = m;
      doctrineFavourites = classes.slice(0, 3);
      const perms = [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]];
      const res = {};
      DOCTRINES.forEach(d => { res[d.id] = { ok: 0, total: 0, example: null }; });
      const n = classes.length;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
        const trio = [bodyFor(classes[i]), bodyFor(classes[j]), bodyFor(classes[k])];
        perms.forEach(p => {
          trio.forEach((c, x) => { c.gridPos = p[x]; });
          DOCTRINES.forEach(d => {
            const r = res[d.id];
            r.total++;
            let held = false;
            try { held = !!d.holds(trio); } catch (e) { held = false; }
            if (held) { r.ok++;
              if (!r.example) r.example = trio.map(c => c.classType + '@' + c.gridPos).join(' '); }
          });
        });
      }
      return { res, classes, ids: DOCTRINES.map(d => d.id), vets,
               favourites: doctrineFavourites.slice() };
    });

    const e = await enumerate();
    ok(`every doctrine in the table was enumerated against every line (${e.ids.length} doctrines, ` +
       `${e.classes.length} classes)`,
      e.ids.length === Object.keys(e.res).length && e.classes.length >= 7);

    // ── THE PROPERTY: no card in the table is one nobody can ever keep ──────────────────
    // A doctrine keepable by zero lines is a card the muster can offer and the player can never
    // take, which is the exact thing the table's own mid-file comment says the three composition
    // doctrines were added to fix. Asserted per doctrine so the failure names which one.
    e.ids.forEach(id => {
      const r = e.res[id];
      ok(`${id} is keepable - ${r.ok} of ${r.total} arrangements${r.example ? `, e.g. ${r.example}` : ''}`,
        r.ok > 0);
    });

    // ── AND NOT KEEPABLE BY EVERYTHING, which would make it a free multiplier ───────────
    // CONSCRIPTS and OLD_GUARD are judged at the minimum state that opens their gate, so both
    // are real questions here rather than vacuous ones - the first cut of this file had them at
    // 0 and 720 for exactly that reason. A doctrine that holds for every arrangement asks the
    // player for nothing, which is the other way for a card to stop being a decision.
    e.ids.forEach(id => {
      const r = e.res[id];
      ok(`${id} asks for something - it does not hold on every line (${r.ok} of ${r.total})`,
        r.ok < r.total);
    });

    // ── THE TWO THE CAREER READS AS DEAD, NAMED ────────────────────────────────────────
    // The row that would have caught the misreading. Both are 0 live over 150 expeditions and
    // both are keepable; if a future change makes either genuinely unkeepable the rows above
    // fire, and if a future draft policy reaches them the census moves on its own.
    ['NO_HANDS', 'LIGHT_ORDER'].forEach(id => {
      ok(`${id} reads as dead in a default-draft career and is not (${e.res[id].ok} lines keep it)`,
        e.res[id].ok >= 6);
    });

    // ── WHY THE CAREER NEVER REACHES THEM, stated as the engine's own predicates ────────
    // Not "the policy drafts a Bruiser" as prose, but the two facts that make its first pick
    // fatal to both: the openers carry melee, and one of them is over the health cap.
    const openers = await page.evaluate(({ HP }) => {
      const pool = [...ROSTER_TEMPLATE, ...RECRUIT_POOL];
      const mk = cl => { const t = pool.find(r => r.classType === cl);
        return { id: 'o_' + cl, name: cl, classType: cl, range: t.range, maxHp: t.maxHp,
                 hp: t.maxHp, level: 1, traits: [], perks: [], gridPos: 1, cooldowns: {}, dossier: {} }; };
      return ['BRUISER', 'SHOTGUNNER'].map(cl => {
        const c = mk(cl);
        return { cl, melee: carriesMelee(c), hp: baseHpOf(c), overCap: baseHpOf(c) > HP };
      });
    }, { HP: await page.evaluate(() => LIGHT_ORDER_HP) });
    ok(`both classes the default draft opens with carry melee, which is what NO HANDS forbids ` +
       `(${openers.map(o => `${o.cl} ${o.melee ? 'melee' : 'no melee'}`).join(', ')})`,
      openers.every(o => o.melee));
    ok(`and one of them is over LIGHT ORDER's health cap on its own ` +
       `(${openers.map(o => `${o.cl} ${o.hp}`).join(', ')} against ${await page.evaluate(() => LIGHT_ORDER_HP)})`,
      openers.some(o => o.overCap));

    // ── The gates that make the two career-state doctrines answerable at all ────────────
    const gates = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      mastery = {}; doctrineFavourites = [];
      const shut = DOCTRINES.filter(d => d.offerable && !d.offerable()).map(d => d.id);
      return { shutOnFreshSave: shut };
    });
    ok(`on a save with no history the two that read it are not offered at all ` +
       `(${gates.shutOnFreshSave.join(', ') || 'none'})`,
      gates.shutOnFreshSave.includes('CONSCRIPTS') && gates.shutOnFreshSave.includes('OLD_GUARD'));

    // ── A COUPLING NOTHING SAID OUT LOUD, found by mutating the gate ────────────────────
    // OLD_GUARD_VETS is how many classes must reach veteran before the card is OFFERED, and
    // holds() then asks every one of DEPLOYED line slots to be a veteran. So the gate has to
    // count at least a full line: at OLD_GUARD_VETS = 2 the muster offers a card that a save
    // with exactly two veterans can never keep, which is precisely the offerable-but-unkeepable
    // state the table's own comment says the composition doctrines were added to end. The two
    // constants are three lines apart in game.js and neither mentions the other. They are equal
    // today and that is the only reason the card works.
    const coupling = await page.evaluate(() => ({ vets: OLD_GUARD_VETS, line: DEPLOYED }));
    ok(`OLD GUARD's offer gate counts at least a full line, or it can be offered and never kept ` +
       `(gate ${coupling.vets}, line ${coupling.line})`,
      coupling.vets >= coupling.line);

    // ── O11: the control arm, and the one property that makes it a control ─────────────
    // Asking what a doctrine is WORTH needs a run that does not have one, and until O11 this
    // file had no such policy. `--draft line` banks one opportunistically on 114 of 150 runs, so
    // the default is not a doctrine-free arm; `--draft random` skips the bank but changes the
    // draft too, which puts a different line in the comparison as well as a missing multiplier.
    //
    // `--doctrine off` withholds the TAKE and nothing else. What makes it a control rather than
    // a second policy is that the OFFER is still rolled and still read - doctrineOffered and
    // doctrineLive are the same numbers either way - so the census above stays a census and the
    // only thing that moved between the arms is whether the card was banked. Read off the
    // simulator's source the way suite 166 reads its own arm: a lever nobody can see is the
    // failure G13 went looking for a balance answer and found instead.
    const fs = require('fs');
    const path = require('path');
    const sim = fs.readFileSync(path.join(__dirname, '..', '..', 'tests', 'simulate.js'), 'utf8');
    ok('the doctrine control arm exists and is not the default',
      /const DOCTRINE_POLICY = flag\('doctrine', 'on'\)/.test(sim));
    ok('it withholds the take',
      /if \(take && doctrinePolicy !== 'off'\) \{ activeDoctrine = take/.test(sim));
    ok('and leaves the offer to be rolled and read, so the census is the same either way',
      /stat\.doctrineOffered = doctrineOffer\.slice\(\);/.test(sim)
      && sim.indexOf("if (take && doctrinePolicy !== 'off')")
         < sim.indexOf('stat.doctrineOffered = doctrineOffer.slice();'));
    // AND THE REPORT NAMES ITS ARM. O10 nearly filed two dead doctrines off a line that was
    // reporting the draft policy back; the sentence that stops the next reader doing it is part
    // of the instrument, not a comment in a commit message.
    ok('the census line says whose line "live" is measured against',
      /live = the offer THIS draft policy's line could keep/.test(sim));

    // ── O12: THE PREFIX BUG, IN THE SECOND DOOR G13 DID NOT CLOSE ──────────────────────
    // A doctrine is a predicate on the WHOLE line. G13 found that building a line one legal
    // member at a time asks holds() of every PREFIX, that three of the seven cannot be true of
    // one, and that the failure is silent and total - the draft comes back empty and the run
    // plays out with nobody standing. It rewrote the pooled `--draft doctrine` branch to build,
    // place, then ask, and wrote a comment naming THE WALL as the case that breaks.
    //
    // It left the identical prefix test in `--draft doctrine:<id>`, ten lines above its own fix.
    // That sat there until O12 aimed a control arm at `--draft doctrine:THE_WALL` and got the
    // guard G13 built firing on every line of three whole careers: 150 of 150 RUNS FIELDED
    // NOBODY, reporting a deepest sector of 1 and zero commanders. The guard was perfect. The
    // thing it guards had two doors and one was open.
    //
    // The rows above already hold the GAME's half - every doctrine is keepable by some line. This
    // holds the HARNESS's: one helper, both callers, no prefix test anywhere. A property about
    // duplicated logic is worth asserting on the source, because the second copy is exactly what
    // nobody re-reads.
    ok('the line-keeping search is written once',
      (sim.match(/const lineKeeping = d => \{/g) || []).length === 1);
    ok('and both doctrine draft policies go through it',
      (sim.match(/lineKeeping\(d\)/g) || []).length === 2);
    ok('neither of them asks holds() of a partial line any more',
      !/d\.holds\(\[\.\.\.draft, c\]\)/.test(sim));
    // And the named-doctrine arm reports an unfieldable card rather than fielding nobody, which
    // is what the pooled branch already did and this one did not.
    ok('a named doctrine this roster cannot keep is recorded, not silently skipped',
      (sim.match(/stat\.doctrineUnfieldable = want;/g) || []).length === 2);

    // ── O13: WHICH satisfying line, which is a third of what O12 measured ──────────────
    // A doctrine that constrains MEMBERSHIP leaves the arrangement free, and the first satisfying
    // line off a shuffled list regularly fronts a Sniper. THE WALL is the exception - its own rule
    // demands a tough melee front - which is why it made a clean control and why comparing the
    // other two against it was unfair. Arranged as well as that rule allows, they gain 4.33 and
    // 2.67 wins; THE WALL, which already forced it, gains 1.00. A third of O12's charge was the
    // draft, and the remaining seven wins each are the cards.
    //
    // The arm is held here so the default cannot drift: every number in the O12 record was taken
    // under `any`, and a changed default would silently re-baseline them.
    ok('the arrangement arm exists and the default is the one the records were taken under',
      /const ARRANGE = flag\('arrange', 'any'\)/.test(sim));
    ok('it ranks by the front rank rather than rejecting on it',
      /carriesMelee\(f\) \? 1e6 : 0\) \+ baseHpOf\(f\)/.test(sim));
    ok('and it still places every candidate before asking, which is the whole point of the helper',
      /if \(!d\.holds\(cand\)\) continue;/.test(sim));

    // ── O21: WHEN THE FILE READS THE PROMISE, AND WHAT THE LINE WAS HOLDING WHEN IT ASKED ──
    // Three items were spent on a question this file created. `doctrineKept` was set in the
    // MUSTER TAIL, four lines below the take, and printed under the heading "still keeping it at
    // the end" - so it could only ever come back 100%, and it did: 150 of 150 on the careers O18
    // and O20 read. Instrumented at the fight door instead, the same arm ran 553 of 689 doors
    // with the doctrine BROKEN. O18 priced NO HANDS believing the card was carried the whole way;
    // O20 found a quarter of that career's damage thrown in melee and, trusting the same row,
    // concluded a Bruiser must be standing in a line that cannot draft one. It was not. The card
    // was dark, and a dark card forbids nothing.
    //
    // The cause of the darkness was this file too, and in the same shape: applyBench - the policy
    // that picks which three of four abilities a rank III operator brings - ran in the muster
    // tail, BELOW the draft and below the take. So the draft asked holds() of decks it was about
    // to change. The Scavenger is the clean case: their fourth is a SHIV, the engine benches the
    // fourth by default, NO HANDS signs off on a deck that reads clean, and then this policy
    // benches the basic instead and the SHIV comes off the bench. First breach at sector 1,
    // fight 1. Moved above the draft, the same arm runs 678 of 733 doors live, breaches ZERO,
    // and ends 16 runs of 20 still keeping the card.
    //
    // Both rows are about WHERE a line sits, which is exactly what nobody re-reads, so both are
    // pinned by position rather than by presence.
    const at = re => { const m = sim.match(re); return m ? sim.indexOf(m[0]) : -1; };
    const benchPolicy = at(/const applyBench = c => \{/);
    const draftStarts = at(/const draft = \[\];/);
    const takeAsks    = at(/if \(take && doctrinePolicy !== 'off'\)/);
    ok('the bench policy is written once', (sim.match(/const applyBench = c => \{/g) || []).length === 1);
    ok(`and it runs before the draft, so a doctrine is asked of the deck the run will carry ` +
       `(${benchPolicy} < ${draftStarts})`,
      benchPolicy > 0 && draftStarts > 0 && benchPolicy < draftStarts && benchPolicy < takeAsks);

    const keptRead  = at(/stat\.doctrineKept = !!activeDoctrine && !doctrineBroken;/);
    const fightDoor = at(/stat\.docDoorAll\+\+;/);
    ok('the keep is read once', (sim.match(/stat\.doctrineKept = !!activeDoctrine/g) || []).length === 1);
    ok(`and it is read after the last fight door rather than at the muster (${keptRead} > ${fightDoor})`,
      keptRead > 0 && fightDoor > 0 && keptRead > fightDoor);
    // The door census itself, which is what turned an inference into a reading.
    ok('every fight door is counted, and separately the ones under a live doctrine',
      /stat\.docDoorAll\+\+;/.test(sim) && /stat\.docDoor\+\+;/.test(sim));
    ok('a live doctrine whose own rule is false at the door is recorded with the line that failed it',
      /if \(d && !d\.holds\(line\)\) \{[\s\S]{0,200}?stat\.docBreach\+\+;/.test(sim));
    ok('and a dark one records whether it was never taken or broken, and where',
      /\(!activeDoctrine \? 'never taken' : 'broken'\) \+ ' s' \+ currentSector/.test(sim));

    // ── O22: THE SIZE OF THE LINE, WHICH IS WHAT THE CARD ACTUALLY CHARGES ──────────────
    // The control arm priced the card alone at -4.34 wins and half the score median, which a
    // +15% multiplier cannot do. closeRanks is where it goes - it leaves a vacated rank empty
    // rather than step a forbidden class into it - so the cost is bodies, and bodies are counted
    // at the door. Suite 79 holds the mechanism by construction; this holds the instrument that
    // priced it, and the name it had to be given.
    // O23 REDDENED THIS ROW BY REFACTORING THE LINE IT NAMED, which is the row's fault and not
    // the refactor's: it pinned one exact spelling of a count instead of the rule that the count
    // reads who is STANDING. Hoisting the filter into a local so the live-only census could share
    // it broke the literal and changed nothing about the behaviour. Written against the rule now,
    // the way N04 rewrote its own guard after the same lesson.
    ok('bodies standing are counted at every fight door',
      /const standing = playerRoster\.filter\(p => p\.gridPos > 0\)\.length;/.test(sim) &&
      /stat\.doorBodies\.push\(standing\);/.test(sim));
    ok('and the report says what share of doors were fought under strength',
      /doors fought under strength/.test(sim) && /sizes\.filter\(v => v < 3\)\.length/.test(sim));
    // lineSize is G13's field, booked once per run as a NUMBER and read as `r.lineSize === 0` to
    // find runs that fielded nobody. Seeding it as an array for this census turned that guard's
    // own field into a list and the arm died at the first door. Cheap to catch, and the reason
    // the row below exists: a census that quietly answers a different question is not cheap.
    ok('the empty-line guard still reads its own field as a number',
      /r\.lineSize === 0/.test(sim) && !/lineSize\.push/.test(sim));
    ok('and the door census does not share a name with it',
      /doorBodies: \[\]/.test(sim) && !/lineSize: \[\]/.test(sim));

    // ── O23: AND THE SAME COUNT ON LIVE DOORS ONLY, WHICH IS WHAT CHANGED THE ANSWER ────
    // Counting every door blends "the card is refusing step-ins" with "the card is dark and
    // refusing nothing", and it understates exactly the cards whose rule is hardest to keep -
    // THE WALL and BROAD SPECTRUM ran live at about a third of their doors. THE WALL read 7.2%
    // on the blended count and 0.0% on the live-only one, which is the difference between a mild
    // finding and a structural one.
    ok('the door census is split by whether the card was live',
      /if \(activeDoctrine && !doctrineBroken\) stat\.doorBodiesLive\.push\(standing\);/.test(sim));
    ok('and the report prints the live-only row whenever the two differ',
      /and on live-doctrine doors only/.test(sim) && /liveSizes\.length !== sizes\.length/.test(sim));
  }
};

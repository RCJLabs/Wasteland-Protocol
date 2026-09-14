// N01, out of the N-audit. Two halves of one defect, and they are mirror images.
//
// ONE. mitigate carried `noteQuirk('THICK_HIDE', true)` inside itself. mitigate is reached by
// five paths that are not blows - four threatBoard forecasts, which are the AI previewing its
// own damage against every living target every turn, and the roster card's resist probe - so the
// quirk census counted a hit every time anything WONDERED about a hit. M05 published that as a
// count of firings, "THICK_HIDE 182,859 and 189,321" beside VAMPIRIC's 3,414 and 5,519, and the
// fifty-fold gap read as a hit-taken quirk being common rather than as a broken instrument.
// Measured on the fix: the old counter ran about twenty times the real one.
//
// TWO, and nobody had noticed this half at all. noteCover was wired to three landing points by
// hand and typedToll is a FOURTH - the vents, the turned tank, the chem spill. Those run their
// damage through mitigate like everything else, so the ground's front cover reduces them, and
// the cover ledger M08b built had never seen a single one.
//
// Same cause both ways: the bookings were spread across sites that nothing held together. One
// counted blows nobody threw, the other missed blows that landed. noteLanding is the door, and
// the rule it enforces is the one M08b stated and could not make stick - MITIGATE COMPUTES, AND
// MUST NOT COUNT.
module.exports = {
  name: 'What a landing owes',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', '..');
    const src = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
    const sim = fs.readFileSync(path.join(root, 'tests', 'simulate.js'), 'utf8');

    // ── mitigate computes and does not count ───────────────────────────────────
    const mit = (src.match(/function mitigate\([\s\S]*?\n\}/) || [''])[0];
    ok('mitigate books nothing to the quirk census any more',
      !/noteQuirk\(/.test(mit));
    ok('and it hands the hide back with the figure instead, beside ac and cd',
      /return \{ n, rv, ac, cd, cover, thick[,}]/.test(src));
    // NO note* CALL AT ALL, not just no noteQuirk - that is the rule the audit turned into a
    // sentence and this row is what holds it. The two counters mitigate does keep are its own
    // call count and the deliberate copy of what the old counter saw, and both self-seed, which
    // is the M-audit's lesson: the first cut of these seeded {calls:0, blows:0} and incremented
    // with ++, which is undefined + 1 into NaN and then a believable zero.
    ok('mitigate makes no census call of any kind now', !/\bnote[A-Z]\w*\(/.test(mit));
    ok('and the two counters it does keep both seed themselves rather than trusting a literal',
      /m\.calls = \(m\.calls \|\| 0\) \+ 1/.test(src) && /m\.hideSeen = \(m\.hideSeen \|\| 0\) \+ 1/.test(src)
      && /m\.blows = \(m\.blows \|\| 0\) \+ 1/.test(src));

    // ── A forecast must not move the census ────────────────────────────────────
    // The behavioural half, and the one that actually proves the bug is gone. A source guard
    // alone would pass against a counter moved three lines down and still inside the function.
    const field = () => page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField();
      const who = window.__bare(playerRoster.find(c => c.classType === 'BRUISER'));
      who.gridPos = 1; who.hp = who.maxHp = 900; who.dmgBase = 40;
      Object.keys(who.cooldowns || {}).forEach(k => who.cooldowns[k] = 0);
      // THICK_HIDE is an OPERATOR quirk - hasQuirk gates on ent.isPlayer - so it fires when the
      // squad TAKES a hit, and the forecasts that inflated it are the AI pricing its own attacks
      // against every operator every turn. It also wants the quirk object, not its id.
      who.quirk = CLASS_QUIRKS ? { id: 'THICK_HIDE' } : { id: 'THICK_HIDE' };
      const foe = window.__dummy({ id: 'ln0', hp: 9000, maxHp: 9000 });
      foe.dmgBase = 40; foe.intent = { type: 'ATTACK', icon: '#' };
      activeEntities = [who, foe]; turnQueue = [who, foe];
      combatActive = true; momentum = 0; activeIndex = 0;
      runStats = runStats || {}; runStats.qk = {}; runStats.mit = {}; runStats.cv = {};
      return { whoId: who.id };
    });
    await field();
    const asked = await page.evaluate(() => {
      const foe = activeEntities.find(e => !e.isPlayer);
      // Ten forecasts and a resist probe: everything the AI and the roster card do every turn.
      const who = activeEntities.find(e => e.isPlayer);
      for (let i = 0; i < 10; i++) threatBoard();
      mitigate(foe, who, 100, 'phys', null);
      return { hide: (runStats.qk.THICK_HIDE || {}).fired || 0,
               calls: runStats.mit.calls || 0, blows: runStats.mit.blows || 0,
               seen: runStats.mit.hideSeen || 0 };
    });
    ok(`forecasts and probes ask mitigate plenty (${asked.calls} calls)`, asked.calls > 1);
    ok(`and every one of them used to book a hit - ${asked.seen} of them here`, asked.seen > 0);
    ok('but the quirk census does not move for a blow nobody threw', asked.hide === 0);
    ok('and neither does the blow count', asked.blows === 0);

    // ── A landed blow does move it ─────────────────────────────────────────────
    const landed = await page.evaluate(() => {
      const who = activeEntities.find(e => e.isPlayer);
      const foe = activeEntities.find(e => !e.isPlayer);
      runStats.qk = {}; runStats.mit = {};
      applyDamageHit(foe, who, 100, 'phys', null);
      return { hide: (runStats.qk.THICK_HIDE || {}).fired || 0, blows: runStats.mit.blows || 0,
               calls: runStats.mit.calls || 0 };
    });
    ok('a blow that lands books the hide exactly once', landed.hide === 1);
    ok('and counts as one landing', landed.blows === 1);
    // AND THE CALL COUNT IS ITS DENOMINATOR, so the door must not touch it. One ordinary blow is
    // one call and one landing; the whole 8x figure the report prints is meaningless if the
    // landing can inflate the number it is measured against. A mutation that added m.calls++ to
    // noteLanding passed every other row in this suite.
    ok(`one ordinary blow is exactly one call and one landing (${landed.calls}/${landed.blows})`,
      landed.calls === 1 && landed.blows === 1);

    // ── O15: the reach census, booked at the same door and for the same reason ──────────
    // NO HANDS asks the line to give up every melee ability and pays a fifth off enemy melee
    // that reaches the front rank. O12/O13 measured the card at about seven wins below a default
    // line; nothing had ever counted what either half of that trade is worth. The census that
    // answers it rides back on mitigate's own figure and is booked HERE, which is this suite's
    // whole subject: mitigate is asked by four forecasts and a resist probe every turn, and a
    // ledger kept at that line counts damage nobody took. N01 shipped that bug once already.
    const reach = await page.evaluate(() => {
      const who = activeEntities.find(e => e.isPlayer);
      const foe = activeEntities.find(e => !e.isPlayer);
      const sum = r => Object.values(r || {}).reduce((a, v) => a + v.blows, 0);
      runStats.reach = {}; runStats.out = {}; runStats.mit = {};
      // Everything that is not a blow, first.
      for (let i = 0; i < 10; i++) threatBoard();
      mitigate(foe, who, 100, 'phys', null);
      const asked = { inb: sum(runStats.reach), outb: sum(runStats.out) };
      // Then one blow each way, on a field where the reach of both is known.
      foe.range = 'melee'; who.gridPos = 1;
      applyDamageHit(foe, who, 100, 'phys', null);
      activeIndex = turnQueue.indexOf(who); pendingAction = 'SCRAP_BLADE';
      applyDamageHit(who, foe, 100, 'phys', null);
      return { asked, inb: { ...runStats.reach }, outb: { ...runStats.out },
               blows: runStats.mit.blows || 0 };
    });
    ok(`forecasts and probes book nothing in the reach census (${reach.asked.inb} in, ${reach.asked.outb} out)`,
      reach.asked.inb === 0 && reach.asked.outb === 0);
    ok(`a melee blow onto the front rank lands in the bucket NO HANDS pays on ` +
       `(${JSON.stringify(reach.inb)})`,
      (reach.inb.meleeFront || {}).blows === 1 && Object.keys(reach.inb).length === 1);
    ok(`and the squad's own swing is counted on the other side, not this one ` +
       `(${JSON.stringify(reach.outb)})`,
      (reach.outb.melee || {}).blows === 1 && Object.keys(reach.outb).length === 1);
    // The two sides share the landing count, so a bucket that drifts from it is a bucket that
    // is counting something else.
    ok(`every landed blow is in exactly one bucket (${reach.blows} landings)`,
      Object.values(reach.inb).reduce((a, v) => a + v.blows, 0)
      + Object.values(reach.outb).reduce((a, v) => a + v.blows, 0) === reach.blows);
    const pierced = await page.evaluate(() => {
      const who = activeEntities.find(e => e.isPlayer);
      const foe = activeEntities.find(e => !e.isPlayer);
      who.hp = who.maxHp;
      runStats.qk = {}; runStats.mit = {};
      applyDamageHit(foe, who, 100, 'phys', null, { pierce: true });
      return { calls: runStats.mit.calls || 0, blows: runStats.mit.blows || 0,
               hide: (runStats.qk.THICK_HIDE || {}).fired || 0 };
    });
    ok(`a pierced blow lands without asking mitigate at all (${pierced.calls} calls, ${pierced.blows} landing)`,
      pierced.calls === 0 && pierced.blows === 1);
    ok('and pays no hide, because nothing mitigated it', pierced.hide === 0);

    // ── All four landing points, including the one that was missing ────────────
    // typedToll is the finding's second half: it takes health off a body through mitigate and
    // the cover ledger had never seen it. Asserted on the ledger rather than on the source, so a
    // future fifth path that forgets the door fails here rather than in a census six months on.
    const vent = await page.evaluate(() => {
      const who = activeEntities.find(e => e.isPlayer);
      who.hp = who.maxHp;
      runStats.qk = {}; runStats.mit = {}; runStats.cv = {};
      const took = typedToll(who, 200, 'bio', 'fct-status');
      return { took, hide: (runStats.qk.THICK_HIDE || {}).fired || 0,
               blows: runStats.mit.blows || 0, cover: JSON.stringify(runStats.cv) };
    });
    ok(`a vent takes health off a body (${vent.took})`, vent.took > 0);
    ok('and books as a landing like every other path that does', vent.blows === 1);
    ok('and pays the hide, which it was already applying and never counting', vent.hide === 1);

    // ── The door is the only way through ───────────────────────────────────────
    ok('noteCover has exactly one caller, and it is the door',
      (src.match(/noteCover\(/g) || []).length === 2);
    ok('and all four landings plus the door itself go through noteLanding',
      (src.match(/noteLanding\(/g) || []).length === 5);
    // A pierced blow is the one landing that never meets mitigate at all - HEADSHOT executes
    // outright - so it carries no cover and no hide, and calls may legitimately trail blows by
    // exactly that many. Stated here so the report's ratio is not read as an error.
    // O15 MADE THIS A PROPERTY RATHER THAN A LITERAL, and the literal is why. Two spellings of
    // the same figure kept in step by hand is the thing buildCombatSnapshot and resumeCombat were
    // caught doing, and this row was one of the two halves - so adding a field to mitigate's
    // figure reddened it correctly and would have let the pierce shortcut fall behind silently if
    // it had only been re-pinned. Compared as key SETS now: whatever mitigate hands back, the
    // pierce shortcut hands back the same names, because the door reads both.
    const keysOf = block => (block.match(/([A-Za-z_]\w*)\s*[:,}]/g) || [])
      .map(x => x.replace(/[\s:,}]/g, '')).filter(Boolean);
    const ret = keysOf((src.match(/return \{ n, rv, ac, cd, cover, thick[^}]*\}/) || [''])[0]);
    const pierceFig = (src.match(/pierce \? \{ n: Math\.max\(1, t\.hp\)[\s\S]*?\}/) || [''])[0];
    const pk = keysOf(pierceFig).filter(k => !['Math', 'max', 't', 'hp', 'isPlayer', 'attacker',
      'range', 'gridPos', 'moveReachFor', 'pendingAction', 'null', 'false', 'true'].includes(k));
    ok(`a pierced blow is built with the same shape so the door can take it ` +
       `(${ret.join(',')} against ${pk.join(',')})`,
      ret.length > 0 && ret.every(k => pk.includes(k)) && pk.every(k => ret.includes(k)));

    // ── Wired to the report ────────────────────────────────────────────────────
    ok('the report folds the call census with the shared fold', /foldAll\('mit'\)/.test(sim));
    ok('and prints the old counter against the real one, so the size of the error is a number',
      /hideSeen/.test(sim) && /the published figure was/.test(sim));
  }
};

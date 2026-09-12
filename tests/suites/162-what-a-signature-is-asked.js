// M06. The promotion screen has two halves. M02 measured the split - 91% of perk points buy a
// stat card, 9% buy a signature - and M04 then took the stat cards apart and found three of
// their five conditions firing so rarely the change cost sixteen wins. M05 did the same to the
// quirks and found one condition holding on 98% of swings and its own partner on 2%.
//
// Eight signatures carry a condition of exactly that shape and not one had ever been counted.
// Two were already suspect from measurements taken for other reasons: SLACK LINE reads dist 0,
// which M04 measured at 81% of all swings, and TRENCH FOOT reads the front rank, which M05's
// candidate probe put at about a third.
//
// This suite guards the COUNT, not any conclusion from it. What it has to hold is that the
// census cannot quietly stop being complete: a signature that gains a condition, or one whose
// id is misspelled at the read, has to show up as a number rather than as silence.
module.exports = {
  name: 'What a signature is asked',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    // ── Every id the resolver asks about is a signature that exists ──────────────
    // A misspelled id is the worst failure this census can have, because hasTrait would simply
    // never match and the row would read as content nobody reaches - indistinguishable from a
    // real finding. Checked against the pool rather than against a list here.
    const named = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const asked = [...src.matchAll(/(?:sig|gate)\('([A-Z_]+)'/g)].map(m => m[1]);
      const pool = SIG_PERKS.map(p => p.id);
      return { asked, unknown: asked.filter(id => !pool.includes(id)),
               dupes: asked.filter((id, i) => asked.indexOf(id) !== i) };
    });
    ok(`the resolver asks after ${named.asked.length} signatures by name (${named.asked.map(i => i.toLowerCase()).join(', ')})`,
      named.asked.length >= 8);
    ok(`and every one of them is a signature that exists (${named.unknown.length} unknown${named.unknown.length ? ': ' + named.unknown.join(', ') : ''})`,
      named.unknown.length === 0);
    ok(`each asked once, so no rate is two conditions added together (${named.dupes.length} repeated)`,
      named.dupes.length === 0);

    // ── THE COMPLETENESS GUARD: no conditional damage signature is left uncounted ─
    // The census is only worth reading if it covers the layer it claims to. Every line in the
    // perk layer that multiplies dmgMult off a hasTrait must go through the counting dispatcher;
    // one that does not is a condition nobody is measuring, which is how the pool got here.
    const layer = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const from = src.indexOf("dmgMult *= quirkDmgMult(");
      const to = src.indexOf("snap('perks, quirks & bonds')", from);
      const body = src.slice(from, to);
      const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
      return { total: lines.length,
               // A hasTrait read that moves dmgMult and is not wrapped by the dispatcher.
               uncounted: lines.filter(l => /hasTrait\(actEnt/.test(l) && /dmgMult \*=/.test(l)),
               counted: lines.filter(l => /(?:sig|gate)\('/.test(l) && /dmgMult \*=/.test(l)).length };
    });
    ok(`${layer.counted} conditional signatures in the perk layer go through the counter`,
      layer.counted >= 8);
    ok(`and none is left reading hasTrait straight into the multiplier (${layer.uncounted.length} uncounted${
        layer.uncounted.length ? ': ' + layer.uncounted.join(' | ') : ''})`,
      layer.uncounted.length === 0);

    // ── Two kinds of condition, and the split is read off the source ─────────────
    // A STATE condition asks about the world, so a low rate means the state does not happen. A
    // MOVE-GATED one asks which ability was used, so a low rate means the holder picked
    // something else - D06's question, not M04's. Reporting them as one list would hide which.
    const kinds = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      return { move: [...src.matchAll(/gate\('([A-Z_]+)'/g)].map(m => m[1]),
               state: [...src.matchAll(/sig\('([A-Z_]+)'/g)].map(m => m[1]) };
    });
    ok(`${kinds.state.length} ask about the world (${kinds.state.map(i => i.toLowerCase()).join(', ')})`,
      kinds.state.length >= 4);
    ok(`and ${kinds.move.length} are gated on using one named ability (${kinds.move.map(i => i.toLowerCase()).join(', ')})`,
      kinds.move.length >= 2 && kinds.move.every(id => !kinds.state.includes(id)));
    // A CONJUNCTION IS COUNTED IN TWO PARTS, which is the whole reason `gate` exists. One rate
    // over "used the ability AND the state held" cannot say which half failed, and the halves
    // mean opposite things: a low state rate is a fact about the game, a low ABILITY rate is a
    // fact about whoever is choosing the moves. D06 was filed on exactly that confusion.
    const twoPart = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const body = src.slice(src.indexOf('const gate = (id, used, state)'));
      return { filesGate: /noteSigGate\(id, used\)/.test(body),
               skipsStateWhenUnused: /if \(!used\) return false;/.test(body),
               filesStateAfter: body.indexOf('noteSig(id, state)') > body.indexOf('if (!used) return false;') };
    });
    ok('a conjunction files the ability half and the state half separately',
      twoPart.filesGate && twoPart.filesStateAfter);
    ok('and never asks the state on a swing that did not use the ability at all',
      twoPart.skipsStateWhenUnused);

    // ── The whole pool is accounted for, not just the eight ─────────────────────
    // So the census can never be read as "the signatures" when it is eight of forty. Every
    // signature is one of: written onto the sheet when bought, a change to one named ability,
    // a question asked at the moment of use, or read some other way.
    const shape = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const cond = new Set([...src.matchAll(/sig\('([A-Z_]+)'/g)].map(m => m[1]));
      const out = { applied: [], conditional: [], other: [] };
      SIG_PERKS.forEach(p => {
        if (cond.has(p.id)) out.conditional.push(p.id);
        else if (p.apply) out.applied.push(p.id);
        else out.other.push(p.id);
      });
      return { ...out, total: SIG_PERKS.length,
               unread: SIG_PERKS.filter(p => !p.apply &&
                 !src.split('\n').some(l => l.includes(`'${p.id}'`) && !/^\s*\{ id:/.test(l))).map(p => p.id) };
    });
    ok(`all ${shape.total} signatures are accounted for (${shape.conditional.length} conditional, ${
        shape.applied.length} written on the sheet, ${shape.other.length} read some other way)`,
      shape.conditional.length + shape.applied.length + shape.other.length === shape.total);
    // The L02 shape, as a standing row: a signature with no apply and no read anywhere is a
    // promise on a card that nothing in the engine keeps.
    ok(`and none of them is a promise with no reader at all (${shape.unread.length}${shape.unread.length ? ': ' + shape.unread.join(', ') : ''})`,
      shape.unread.length === 0);

    // ── The counter counts, through a real swing ─────────────────────────────────
    // GRUDGE is a self-state condition and SLACK LINE a distance one, so between them they
    // exercise both halves of the split. Driven through resolveAction rather than by calling a
    // helper, because the dispatcher is a closure inside it and cannot be reached any other way.
    const counted = await page.evaluate(() => {
      const swing = (trait, hurt, dist) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        window.__clearField(); activeDoctrine = null;
        const hero = window.__bare(playerRoster.find(c => c.classType === 'BRUISER'));
        hero.gridPos = 2; hero.dmgBase = 100; hero.maxHp = 1000;
        hero.hp = hurt ? 100 : 1000;
        hero.traits = trait ? [trait] : [];
        Object.keys(hero.cooldowns || {}).forEach(k => { hero.cooldowns[k] = 0; });
        const foes = [0, 1].map(i => window.__dummy({ id: 'g' + i, gridPos: i + 1, hp: 1e7, maxHp: 1e7 }));
        activeEntities = [hero, ...foes]; turnQueue = [hero, ...foes];
        activeIndex = 0; combatActive = true; pendingAction = 'SCRAP_BLADE';
        runStats.sg = {};
        const t = foes[dist], before = t.hp;
        const roll = Math.random; Math.random = () => 0;
        try { resolveAction(t.id); } finally { Math.random = roll; }
        return { dealt: before - t.hp, book: JSON.parse(JSON.stringify(runStats.sg)) };
      };
      return { none:   swing(null, true, 0),
               whole:  swing('GRUDGE', false, 0),
               hurt:   swing('GRUDGE', true, 0),
               slackNear: swing('SLACK_LINE', false, 0),
               slackFar:  swing('SLACK_LINE', false, 1) };
    });
    ok('a body holding no signature is never counted as having missed one',
      Object.keys(counted.none.book).length === 0);
    ok(`GRUDGE is asked whether it pays or not (${counted.whole.book.GRUDGE.fired} of ${counted.whole.book.GRUDGE.seen} whole, ${counted.hurt.book.GRUDGE.fired} of ${counted.hurt.book.GRUDGE.seen} hurt)`,
      counted.whole.book.GRUDGE.seen === 1 && counted.whole.book.GRUDGE.fired === 0
      && counted.hurt.book.GRUDGE.seen === 1 && counted.hurt.book.GRUDGE.fired === 1);
    ok(`and counting it did not change what it pays (${counted.whole.dealt} whole, ${counted.hurt.dealt} hurt)`,
      counted.hurt.dealt > counted.whole.dealt);
    ok(`SLACK LINE the same, on distance rather than health (${counted.slackNear.book.SLACK_LINE.fired}/${counted.slackNear.book.SLACK_LINE.seen} at the front, ${counted.slackFar.book.SLACK_LINE.fired}/${counted.slackFar.book.SLACK_LINE.seen} behind it)`,
      counted.slackNear.book.SLACK_LINE.fired === 1 && counted.slackFar.book.SLACK_LINE.fired === 0
      && counted.slackFar.book.SLACK_LINE.seen === 1);

    // ── The ledger reaches the report ────────────────────────────────────────────
    const fs = require('fs');
    const path = require('path');
    const sim = fs.readFileSync(path.join(__dirname, '..', 'simulate.js'), 'utf8');
    ok('the simulator carries the signature ledger off the run and into the report',
      /stat\.sg\s*=\s*runStats\.sg/.test(sim));
    ok('and reads both the conditional set and the move-gated half off the engine, not a copy',
      /sig\\\('\(\[A-Z_\]\+\)'/.test(sim) && /pendingAction/.test(sim));
  }
};

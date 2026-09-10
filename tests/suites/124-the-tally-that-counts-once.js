// G01. The Ossuary's learned signature counted your dead, and counted them again every time
// it fired.
//
// Two defects in one reading. It added the bodies on the field to the names in
// runStats.fallen - but loseOperator pushes the name AND leaves the body in activeEntities,
// so one permanent loss was two marks. And it kept no record of what it had already counted,
// so on a two-turn cooldown it re-read the whole casualty list every firing. One loss filled
// the eight-stack tally by itself inside four firings: +32 armour, x1.59 damage, and the
// Ossuary's grudge phase spends 0.12 of the swing per stack. It is the last fight in the game
// and it hardened fastest against the runs that were already losing.
//
// Counted once now, and remembered. A firing with nothing new to count does not happen at all,
// because a signature that cannot cash is not a turn.
module.exports = {
  name: 'The tally that counts once',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      window.__keeper = () => {
        currentSlot = 1; confirmNewGame(1.0); initiateCombat('RAIDERS', false);
        const k = activeEntities.find(e => !e.isPlayer);
        k.sig = 'COUNT_YOURS'; k.tally = { armor: 4, dmg: 0.06, max: 8 };
        k.tallyStacks = 0; k.countedYours = 0; k.name = 'THE OSSUARY';
        return k;
      };
      // Fire the signature the way a turn does, through the AI's own resolver.
      window.__fire = k => { k.sigCd = 0; k.intentDone = false; k.intent = { type: 'SIG' };
                            executeEnemyAi(k); return k.tallyStacks || 0; };
      // Kill an operator for good - the real door, so the body and the ledger both get it.
      window.__lose = () => { const op = activeEntities.find(e => e.isPlayer && e.hp > 0 && !e.fallen);
                              op.hp = 0; loseOperator(op, 'test'); return op.name; };
    });

    // ── One death is one mark ──────────────────────────────────────────────────────
    const once = await page.evaluate(() => {
      const k = window.__keeper();
      const who = window.__lose();
      const onField = activeEntities.filter(e => e.isPlayer && e.hp <= 0).length;
      const inLedger = (runStats.fallen || []).length;
      const counts = yoursDown();
      const after = window.__fire(k);
      return { who, onField, inLedger, counts, after,
               bodyStillThere: !!activeEntities.find(e => e.name === who) };
    });
    ok(`a permanent loss is on the field and in the ledger at once (${once.onField} body, ${once.inLedger} name)`,
      once.onField === 1 && once.inLedger === 1 && once.bodyStillThere === true);
    ok(`but it is one person, and the count says one (${once.counts})`, once.counts === 1);
    ok(`so one death writes one mark, not two (tally ${once.after})`, once.after === 1);

    // ── A body that is down but not gone is counted too, and also once ─────────────
    const downed = await page.evaluate(() => {
      const k = window.__keeper();
      const op = activeEntities.find(e => e.isPlayer && e.hp > 0);
      op.hp = 0;                                  // down this fight, not lost for good
      return { fallen: !!op.fallen, counts: yoursDown(), after: window.__fire(k) };
    });
    ok(`a squadmate down but not lost still counts (${downed.counts})`,
      downed.fallen === false && downed.counts === 1 && downed.after === 1);

    // ── A loss from an earlier fight has no body here, only a name ────────────────
    const earlier = await page.evaluate(() => {
      const k = window.__keeper();
      // Nobody is down on this field. The run has still cost two people, two nodes ago.
      runStats.fallen = [{ name: 'Vex' }, { name: 'Kessler' }];
      const bodies = activeEntities.filter(e => e.isPlayer && e.hp <= 0).length;
      return { bodies, counts: yoursDown(), after: window.__fire(k) };
    });
    ok(`the dead from earlier nodes still count, with no body on this field (${earlier.counts})`,
      earlier.bodies === 0 && earlier.counts === 2 && earlier.after === 2);

    // ── Firing again counts nothing again ──────────────────────────────────────────
    const again = await page.evaluate(() => {
      const k = window.__keeper();
      window.__lose(); window.__lose();
      const reads = [window.__fire(k), window.__fire(k), window.__fire(k), window.__fire(k)];
      return { losses: (runStats.fallen || []).length, reads, uncounted: uncountedYours(k) };
    });
    ok(`two losses, four firings, and the tally stops at two (${again.reads.join(' → ')})`,
      again.losses === 2 && again.reads.every(r => r === 2));
    ok('with nothing left uncounted after the first', again.uncounted === 0);

    // ── A new death between firings is the one thing that moves it ─────────────────
    const fresh = await page.evaluate(() => {
      const k = window.__keeper();
      window.__lose();
      const first = window.__fire(k);
      const flat = window.__fire(k);
      window.__lose();
      const moved = window.__fire(k);
      return { first, flat, moved };
    });
    ok(`a loss moves it, a repeat does not, the next loss does again (${fresh.first} → ${fresh.flat} → ${fresh.moved})`,
      fresh.first === 1 && fresh.flat === 1 && fresh.moved === 2);

    // ── The ledger has a floor of its own ──────────────────────────────────────────
    const capped = await page.evaluate(() => {
      const k = window.__keeper();
      k.tally = { armor: 4, dmg: 0.06, max: 2 };
      runStats.fallen = [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }];
      const before = document.getElementById('log').innerText.length;
      const after = window.__fire(k);
      const said = document.getElementById('log').innerText.slice(before);
      return { after, seen: k.countedYours, full: /already full|adds your dead/.test(said) };
    });
    ok(`the tally stops at its own cap (${capped.after} of a max of 2)`, capped.after === 2);
    ok(`while the count still knows what it saw (${capped.seen})`, capped.seen === 4);

    // ── A full ledger still has to remember, or it counts into it forever ─────────
    // The tally caps, but the counting does not stop being a turn: if a death that could not
    // be written is left uncounted, the intent gate keeps raising COUNT YOURS every cooldown
    // and the Ossuary spends the rest of the fight writing into a full book.
    const overflow = await page.evaluate(() => {
      const k = window.__keeper();
      k.tally = { armor: 4, dmg: 0.06, max: 1 };
      window.__lose(); window.__fire(k);            // fills it
      const full = { stacks: k.tallyStacks, counted: k.countedYours };
      window.__lose();                              // a death it has no room for
      const added = window.__fire(k) - full.stacks;
      k.intents = [['ATTACK', 1.0]];
      let raised = 0; for (let i = 0; i < 400; i++) { k.sigCd = 0;
        if (rollIntent(k).type === 'SIG') raised++; }
      return { full, added, seen: k.countedYours, raised };
    });
    ok(`a death the ledger has no room for adds nothing (${overflow.added})`,
      overflow.full.stacks === 1 && overflow.added === 0);
    ok(`but is still counted as seen, so it is not counted into a full book forever (seen ${overflow.seen}, raised ${overflow.raised} of 400)`,
      overflow.seen === 2 && overflow.raised === 0);

    // ── Its own dead and yours are two different numbers ───────────────────────────
    const mixed = await page.evaluate(() => {
      const k = window.__keeper();
      k.classType = 'BOSS';
      noteTally(activeEntities.filter(e => !e.isPlayer && e.id !== k.id)[0]);
      const afterItsOwn = k.tallyStacks;             // 1, and none of them yours
      window.__lose();
      const afterYours = window.__fire(k);
      return { afterItsOwn, afterYours, counted: k.countedYours };
    });
    ok(`one of its own then one of yours is two marks, not one (${mixed.afterItsOwn} → ${mixed.afterYours})`,
      mixed.afterItsOwn === 1 && mixed.afterYours === 2 && mixed.counted === 1);

    // ── What it counted survives a reload ──────────────────────────────────────────
    const reload = await page.evaluate(() => {
      const k = window.__keeper();
      window.__lose();
      window.__fire(k);
      const before = { stacks: k.tallyStacks, counted: k.countedYours };
      saveGameState(); loadGameState();
      const kept = (pendingCombat && pendingCombat.enemies || []).find(e => e.sig === 'COUNT_YOURS');
      return { before, after: kept ? { stacks: kept.tallyStacks, counted: kept.countedYours } : null };
    });
    ok(`a reload does not hand it the same death again (counted ${(reload.after || {}).counted})`,
      !!reload.after && reload.after.counted === reload.before.counted && reload.after.counted === 1);

    // ── It does not raise an intent it cannot cash ─────────────────────────────────
    const intent = await page.evaluate(() => {
      const k = window.__keeper();
      k.intents = [['ATTACK', 1.0]];
      const roll = n => { let sig = 0; for (let i = 0; i < n; i++) { k.sigCd = 0;
        if (rollIntent(k).type === 'SIG') sig++; } return sig; };
      // K03: 400 rolls put the floor below 3.5 sd from what it measures. These are bare
      // rollIntent calls, so the sample is nearly free and five times as many settles it.
      const N = 2000;
      const nothingToCount = roll(N);
      window.__lose();
      const somethingToCount = roll(N);
      window.__fire(k);
      const countedAlready = roll(N);
      return { nothingToCount, somethingToCount, countedAlready, rolls: N, weight: sigOf(k).weight };
    });
    ok(`with nothing to count the Ossuary does not stand there counting (${intent.nothingToCount} of ${intent.rolls} rolls)`,
      intent.nothingToCount === 0);
    ok(`with a death to write down it comes up at its own weight (${intent.somethingToCount} of ${intent.rolls}, weight ${intent.weight})`,
      intent.somethingToCount > intent.rolls * 0.15);
    ok(`and once that death is written it stops coming up again (${intent.countedAlready} of ${intent.rolls})`,
      intent.countedAlready === 0);

    // ── Its own dead still work the way they always did ────────────────────────────
    const own = await page.evaluate(() => {
      const k = window.__keeper();
      k.classType = 'BOSS';
      const other = activeEntities.filter(e => !e.isPlayer && e.id !== k.id)[0];
      const before = k.tallyStacks || 0;
      noteTally(other);
      return { before, after: k.tallyStacks || 0, yours: k.countedYours || 0 };
    });
    ok(`one of its own falling is still one mark (${own.before} → ${own.after})`,
      own.after === own.before + 1);
    ok('and is kept apart from the count of yours', own.yours === 0);
  }
};

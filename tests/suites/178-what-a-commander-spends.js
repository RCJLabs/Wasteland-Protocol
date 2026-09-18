// ── R01: A COMMANDER THAT HAS STOPPED GROWING ─────────────────────────────────────────
//
// GRUDGE.cap is 3, on purpose - "a wall you cannot pass is not a nemesis" - and LEARNED_AT
// hands over exactly one new move. The R-audit measured what that means across a career: 426
// of 492 commander fights are against a Thrice-Risen, and the grudge drift reads 2.27 / 3.00 /
// 3.00 across career thirds. From roughly expedition 20 of 150, the most memorable opponent in
// the game stops changing in any way at all.
//
// MEASURED BEFORE ANYTHING WAS BUILT, the way R03 was, because the proposed shape only means
// something if the grudge phase is a slice somebody plays: it opens in 45% of commander fights
// reached, runs a median of 6 commander turns, and only 18% of openings are a two-turn death
// rattle. That census had to be fixed once on its way in - the first cut divided by commanders
// FELLED and printed 116%, because a phase can open in a fight the squad then loses.
//
// THE CONSTRAINT IS THE WHOLE ITEM. Tier 10 already takes 89% of every wipe and H13 cut that
// wall to where it is deliberately. So the capped commander does not get MORE; it gets
// DIFFERENT, and pays for it. It opens the grudge phase at 45% health instead of 25%, and in
// exchange hands back the damage multiplier its enrage put on the swing.
//
// WHAT THIS SUITE IS REALLY FOR is that the first cut of this was a buff wearing a trade's
// clothes. It opened the phase early and withheld `armorBonus`, written up as "the plate" as
// though every commander had one - and `armorBonus` sits on exactly ONE of the eight grudge
// blocks. Seven commanders in eight were getting a fifth of a health bar more charging, laying
// and venting for free. So the file asserts the SHELF, not just the function: that the thing
// being taken away is on enough of the roster to be a price at all.
const { engineUp } = require('../boot');

module.exports = {
  name: 'What a commander spends',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`); await engineUp(page);

    // ── The shelf: is the price on enough commanders to be a price ───────────────────────
    const shelf = await page.evaluate(() => {
      const armed = BOSS_POOL.filter(b => b.grudge);
      return {
        armed: armed.length,
        plate: armed.filter(b => b.grudge.armorBonus).map(b => b.id),
        scaled: armed.filter(b => b.enrage && b.enrage.dmgScale > 1).map(b => b.id),
        scales: armed.filter(b => b.enrage && b.enrage.dmgScale > 1).map(b => b.enrage.dmgScale),
      };
    });
    ok(`every commander on the shelf carries a grudge move (${shelf.armed})`, shelf.armed === 8);
    // The finding that rebuilt this item, pinned so it cannot be forgotten a second time.
    ok(`the plate is on ONE of them, not the shelf (${shelf.plate.join(', ') || 'none'})`,
      shelf.plate.length === 1);
    ok(`the enrage multiplier is on ${shelf.scaled.length} of ${shelf.armed} - that is why it is the price`,
      shelf.scaled.length >= 6);
    ok(`and it is a real multiplier everywhere it appears (${shelf.scales.join(', ')})`,
      shelf.scales.every(x => x >= 1.1));

    // ── The predicate: who is capped, and what the arm does ──────────────────────────────
    const pred = await page.evaluate(() => {
      const mk = (cls, g) => ({ classType: cls, grudge: g });
      const on = {
        capped: capShaped(mk('BOSS', GRUDGE.cap)),
        over: capShaped(mk('BOSS', GRUDGE.cap + 5)),
        under: capShaped(mk('BOSS', GRUDGE.cap - 1)),
        cold: capShaped(mk('BOSS', 0)),
        notBoss: capShaped(mk('RAIDER', GRUDGE.cap)),
        nothing: capShaped(null),
      };
      CAP_SHAPE_ON = false;
      const off = { capped: capShaped(mk('BOSS', GRUDGE.cap)), at: grudgePhaseAt(mk('BOSS', GRUDGE.cap)) };
      CAP_SHAPE_ON = true;
      return { on, off, atCapped: grudgePhaseAt(mk('BOSS', GRUDGE.cap)),
               atCold: grudgePhaseAt(mk('BOSS', 0)), base: GRUDGE.phaseAt, cap: GRUDGE_CAP.phaseAt };
    });
    ok('a commander at the cap is shaped, and past it too', pred.on.capped && pred.on.over);
    ok('one below the cap is not, nor a cold one', !pred.on.under && !pred.on.cold);
    ok('nor anything that is not a commander, nor nothing at all',
      !pred.on.notBoss && !pred.on.nothing);
    ok(`the threshold moves ${Math.round(pred.base * 100)}% -> ${Math.round(pred.atCapped * 100)}% at the cap`,
      pred.atCapped === pred.cap && pred.atCold === pred.base && pred.cap > pred.base);
    ok('and the arm puts both back exactly', !pred.off.capped && pred.off.at === pred.base);

    // ── The engine reads the threshold through the function, not a literal ───────────────
    // F03's rule at the source: the phase check and anything that explains it come off one
    // reader, so a report or a suite cannot end up quoting a number the game does not use.
    const src = await page.evaluate(() => ({
      raw: executeEnemyAi.toString(),
    }));
    ok('the phase check calls grudgePhaseAt rather than reading GRUDGE.phaseAt directly',
      /grudgePhaseAt\(enemy\)/.test(src.raw) && !/maxHp \* GRUDGE\.phaseAt/.test(src.raw));

    // ── The phase itself: what a capped commander gives and gets ─────────────────────────
    // Staged rather than played: a commander is put on the field at a chosen grudge, walked
    // through its enrage, then dropped to a chosen share of health and asked to take its turn.
    await page.evaluate(() => {
      // confirmNewGame RE-ROLLS bossSalt, and bossSalt is what decides which sector holds which
      // commander - the trap suite 56 pins itself against. Without this the harness stages the
      // same commander at a different sector every call and then compares its stats across two
      // different fights. It cost two failing assertions here before it was found, and one of
      // them looked exactly like the item under test having a side effect it does not have.
      window.__stage = (bossId, g, hpShare, capOn) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        bossSalt = 'suite178';
        CAP_SHAPE_ON = capOn;
        grudges = {}; grudges[bossId] = g;
        for (let s = 1; s <= 40; s++) if (bossForSector(s).id === bossId) { currentSector = s; break; }
        currentTier = 10;
        initiateCombat('BOSS', false);
        const boss = activeEntities.find(e => e.classType === 'BOSS');
        if (!boss) return null;
        boss.sizeUp = false;
        const cold = { dmg: boss.dmgBase, armor: boss.armor, hp: boss.maxHp, speed: boss.speed };
        openEnragePhase(boss);
        const enraged = { dmg: boss.dmgBase, armor: boss.armor };
        boss.hp = Math.floor(boss.maxHp * hpShare);
        openGrudgePhase(boss);
        return { cold, enraged, phase: boss.phase, sector: currentSector,
                 after: { dmg: boss.dmgBase, armor: boss.armor },
                 scale: boss.__enrageDmgScale || 0, grudge: boss.grudge };
      };
    });

    // The Marshal is the one commander that carries both halves - a plate on its grudge and a
    // multiplier on its enrage - so it is where the whole trade can be read on one body.
    const marshal = await page.evaluate(() => ({
      capped: window.__stage('MARSHAL', GRUDGE.cap, 0.40, true),
      plain:  window.__stage('MARSHAL', GRUDGE.cap, 0.20, false),
      bonus:  BOSS_POOL.find(b => b.id === 'MARSHAL').grudge.armorBonus,
    }));
    ok('an uncapped-shape commander takes the plate onto its armour',
      marshal.plain.after.armor === marshal.plain.enraged.armor + marshal.bonus);
    ok('and keeps every point the enrage put on its swing',
      marshal.plain.after.dmg === marshal.plain.enraged.dmg);
    ok('the capped shape takes no plate', marshal.capped.after.armor === marshal.capped.enraged.armor);
    ok(`and hands the enrage multiplier back (${marshal.capped.enraged.dmg} -> ${marshal.capped.after.dmg}, cold ${marshal.capped.cold.dmg})`,
      marshal.capped.after.dmg < marshal.capped.enraged.dmg &&
      Math.abs(marshal.capped.after.dmg - marshal.capped.cold.dmg) <= 1);
    ok('both reached the third phase all the same',
      marshal.capped.phase === 3 && marshal.plain.phase === 3);

    // ── It opens EARLIER, which is the half the player is buying ─────────────────────────
    // At 40% health a capped commander's phase is open and an ordinary one's is not. Read off
    // the live turn path rather than by calling openGrudgePhase directly, because the whole
    // claim is about the threshold the turn loop tests.
    const timing = await page.evaluate(async () => {
      const walk = capOn => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        bossSalt = 'suite178';
        CAP_SHAPE_ON = capOn; grudges = { MARSHAL: GRUDGE.cap };
        for (let s = 1; s <= 40; s++) if (bossForSector(s).id === 'MARSHAL') { currentSector = s; break; }
        currentTier = 10; initiateCombat('BOSS', false);
        const boss = activeEntities.find(e => e.classType === 'BOSS');
        boss.sizeUp = false;
        openEnragePhase(boss);
        boss.hp = Math.floor(boss.maxHp * 0.40);   // between the two thresholds
        executeEnemyAi(boss);
        return boss.phase;
      };
      return { capped: walk(true), plain: walk(false) };
    });
    ok('at 40% health the capped commander has already opened its phase', timing.capped === 3);
    ok('and an ordinary one has not - the threshold is what moved', timing.plain === 2);

    // ── A commander with no multiplier to give back still opens early ────────────────────
    // The Vatborn's enrage buys doses rather than a damage scale, so there is nothing to refund
    // and the refund path must not invent one or leave it half applied. Read as ARM AGAINST ARM
    // at the same staging: the first cut of this compared the Vatborn's swing after the phase
    // against its own swing before it and failed, because its GRUDGE doses again - 125 to 187 -
    // and that is the move doing its job, not the trade touching something it should not.
    const vat = await page.evaluate(() => ({
      on: window.__stage('VATBORN', GRUDGE.cap, 0.40, true),
      off: window.__stage('VATBORN', GRUDGE.cap, 0.40, false),
    }));
    ok('the Vatborn has no enrage multiplier to hand back', !vat.on.scale);
    ok(`so the trade leaves its swing alone (${vat.on.after.dmg} either way) and still opens the phase`,
      vat.on.after.dmg === vat.off.after.dmg && vat.on.phase === 3 && vat.off.phase === 3);
    ok('and its grudge still vents, which is the half that was never for sale',
      vat.on.after.dmg > vat.on.enraged.dmg);

    // ── The books ────────────────────────────────────────────────────────────────────────
    // What the report reads. The threshold is booked by the ENGINE and read back, so the report
    // cannot print a number the game did not use.
    const books = await page.evaluate(() => {
      const run = capOn => {
        window.__stage('MARSHAL', GRUDGE.cap, 0.40, capOn);
        return { gp: runStats.grudgePhase, shaped: runStats.capShaped || 0,
                 refund: runStats.capRefund || 0 };
      };
      const hot = run(true), cold = run(false);
      return { hot, cold, cap: Math.round(GRUDGE_CAP.phaseAt * 100),
               base: Math.round(GRUDGE.phaseAt * 100) };
    });
    ok('an opening is counted, and filed under the grudge that opened it',
      books.hot.gp.opened === 1 && books.hot.gp.byGrudge[3] === 1);
    ok(`the capped opening books the threshold the engine used (${Object.keys(books.hot.gp.at)}%)`,
      books.hot.gp.at[books.cap] === 1 && books.hot.gp.at[books.base] === undefined);
    ok(`an unshaped one books the ordinary threshold (${Object.keys(books.cold.gp.at)}%)`,
      books.cold.gp.at[books.base] === 1 && books.cold.gp.at[books.cap] === undefined);
    ok('the shape counts itself only when it fires',
      books.hot.shaped === 1 && books.cold.shaped === 0);
    ok(`and books what it handed back (${books.hot.refund} damage)`,
      books.hot.refund > 0 && books.cold.refund === 0);

    // ── The tail: how much fight is left below the threshold ─────────────────────────────
    const tail = await page.evaluate(() => {
      window.__stage('MARSHAL', GRUDGE.cap, 0.40, true);
      const boss = activeEntities.find(e => e.classType === 'BOSS');
      const opened = boss.__phaseOpenedAtTurn;
      fightLog.turns = opened + 7;
      boss.hp = 0; noteKill(boss, {});
      return { opened, turnsAfter: runStats.grudgePhase.turnsAfter };
    });
    ok('the turn the phase opened on is written down', tail.opened !== undefined);
    ok(`and the tail is measured when the commander falls (${tail.turnsAfter.join(', ')})`,
      tail.turnsAfter.length === 1 && tail.turnsAfter[0] === 7);

    // ── Nothing else about the commander moved ───────────────────────────────────────────
    // The constraint stated at the top: this item is not allowed to raise raw numbers. Health,
    // speed and cold damage are the grudge ladder's business and the shape must not touch them.
    const untouched = await page.evaluate(() => {
      const a = window.__stage('MARSHAL', GRUDGE.cap, 0.99, true);
      const b = window.__stage('MARSHAL', GRUDGE.cap, 0.99, false);
      return { a: a.cold, b: b.cold, sameSector: a.sector === b.sector };
    });
    ok('both arms staged the same commander in the same sector', untouched.sameSector);
    ok(`the shape changes no commander stat before the phase opens (${untouched.a.hp} hp, ${untouched.a.dmg} dmg either way)`,
      untouched.a.hp === untouched.b.hp && untouched.a.dmg === untouched.b.dmg &&
      untouched.a.armor === untouched.b.armor && untouched.a.speed === untouched.b.speed);

    await page.evaluate(() => { CAP_SHAPE_ON = true; });
  }
};

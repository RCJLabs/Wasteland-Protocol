// After the wall is climbed the curve stops threatening, so the ladder keeps going: named
// protocols chosen on the contract board, each rung stacking every twist below it, and paying
// a score multiplier above what contracts give.
//
// Re-encoded at C05, which took the ladder off deepest-sector-ever and put it behind a clear.
// This suite keeps the ladder's MACHINERY - the board cycles it, the score pays for it, the
// save carries it, the manual documents it - and 71-ladder owns the gate and what each of the
// eight rungs does. The three assertions that read the old gates are re-encoded against the
// new one rather than dropped: the question "does this open when it should" is still the
// question, only the answer to "when" has changed.
module.exports = {
  name: 'Ascension protocols',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the ladder itself ----
    const ladder = await page.evaluate(() => ({
      count: PROTOCOLS.length,
      named: PROTOCOLS.every(p => p.name && p.desc),
      climbs: PROTOCOLS.every((p, i) => i === 0 || p.mult > PROTOCOLS[i - 1].mult)
    }));
    ok(`${ladder.count} named rungs, each richer than the last`, ladder.count >= 6 && ladder.named && ladder.climbs);

    const gates = await page.evaluate(() => {
      // The gate is a clear now, so the sweep is over the ladder rather than over the map.
      const at = (wins, cleared) => { careerWins = wins; bestRung = cleared; return unlockedProtocols(); };
      const r = [at(0, 0), at(0, 3), at(1, 0), at(1, 1), at(1, 4), at(1, PROTOCOLS.length)].join(',');
      careerWins = 1; bestRung = PROTOCOLS.length; ascension = 2;
      // Read off the table, not written out again: the ladder was repriced once already and
      // a suite carrying its own copy of the numbers fails the reprice rather than the rung.
      const mult = protocolMult(); const name = protocolName(); const table = PROTOCOLS[1].mult;
      ascension = 0; careerWins = 0; bestRung = 0;
      return { r, mult, name, table, off: protocolMult() === 1 && protocolName() === null };
    });
    ok(`the gate opens on a clear and climbs one rung at a time (${gates.r})`,
      gates.r === `0,0,1,2,5,${ladder.count}`);
    ok(`each rung names itself and prices the score (x${gates.mult})`,
      gates.mult === gates.table && /BLOODRITE/.test(gates.name) && gates.off);

    // ---- the contract board offers the climb ----
    const board = await page.evaluate(() => {
      careerWins = 0; bestRung = 0; bestSector = 7; ascension = 0; renderContracts();
      const locked = { shown: document.getElementById('ascension-btn').style.display,
                       note: document.getElementById('ascension-note').innerText };
      // Two cleared, so three are open: the cycle is 1,2,3 and off again, not the whole table.
      careerWins = 1; bestRung = 2; renderContracts();
      const open = document.getElementById('ascension-btn').style.display;
      const walk = [];
      for (let i = 0; i < 4; i++) {
        document.getElementById('ascension-btn').click();
        walk.push(ascension);
      }
      bestRung = PROTOCOLS.length;
      const stacked = (() => { ascension = 3; renderContracts(); return document.getElementById('ascension-note').innerText; })();
      ascension = 0; careerWins = 0; bestRung = 0; renderContracts();
      return { locked, open, walk: walk.join(','), stacked };
    });
    ok('the ladder stays out of reach until the road has been walked',
      board.locked.shown === 'none' && /walked once/i.test(board.locked.note));
    ok('and cycles through every earned rung and off again - and no further',
      board.open === 'block' && board.walk === '1,2,3,0');
    ok('a rung names every twist below it',
      /elite arrives affixed/.test(board.stacked) && /enrage at 60%/.test(board.stacked) && /hide their intent/.test(board.stacked));

    // ---- rung I: every elite arrives affixed ----
    const affixed = await page.evaluate(() => {
      const orig = Math.random;
      const count = a => {
        ascension = a;
        Math.random = () => 0.99;   // a roll that never affixes on its own
        const pack = generateEnemies('RAIDERS', 1, true, 1);
        Math.random = orig;
        return { affixed: pack.filter(e => e.eliteType).length, size: pack.length };
      };
      const base = count(0), risen = count(1);
      ascension = 0;
      return { base, risen };
    });
    ok('below the rung, a cold roll leaves elites plain', affixed.base.affixed === 0);
    ok('on it, every elite arrives affixed', affixed.risen.affixed === affixed.risen.size && affixed.risen.size > 0);

    // ---- rung II: warlords enrage at 60% ----
    const enrage = await page.evaluate(() => {
      const stage = a => {
        ascension = a;
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        initiateCombat('RAIDERS', false);
        const boss = { id: 'testboss', name: 'Test Warlord', classType: 'BOSS', phase: 1,
                       maxHp: 100, hp: 58, dmgBase: 10, speed: 5, armor: 0, baseArmor: 0,
                       resistances: { phys: 0, bio: 0, energy: 0 }, enrage: {},
                       bleedingTurns: 0, oiledTurns: 0, stunnedTurns: 0, corrodedTurns: 0, markedTurns: 0 };
        activeEntities.push(boss); turnQueue.push(boss);
        executeEnemyAi(boss);
        const phase = boss.phase;
        combatActive = false;
        return phase;
      };
      const calm = stage(0), early = stage(2);
      ascension = 0;
      return { calm, early };
    });
    ok('at 58% health a warlord holds its temper below the rung', enrage.calm === 1);
    ok('and boils over on it', enrage.early === 2);

    // ---- rung III: heavy hitters hide their intent ----
    const blackout = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.intent = { type: 'HEAVY', icon: '⚔' };
      ascension = 3; renderField();
      const hidden = document.getElementById(foe.id).querySelector('.intent-icon').innerText;
      foe.intent = { type: 'ATTACK', icon: '🗡' };
      renderField();
      const attackShown = document.getElementById(foe.id).querySelector('.intent-icon').innerText;
      ascension = 0; foe.intent = { type: 'HEAVY', icon: '⚔' };
      renderField();
      const plainShown = document.getElementById(foe.id).querySelector('.intent-icon').innerText;
      combatActive = false;
      return { hidden, attackShown, plainShown };
    });
    ok('on the top rung a heavy blow reads as a question mark', blackout.hidden === '?');
    ok('ordinary intents stay honest', blackout.attackShown !== '?' && blackout.plainShown === '⚔');

    // ---- the score pays for the climb, at the rate the run was started on ----
    const score = await page.evaluate(() => {
      const st = { deepestSector: 3, deepestTier: 5, bosses: 2, elites: 4, kills: 50, scrapEarned: 1000, contractMult: 1.2, protocolMult: 1.5 };
      const risen = computeScore(st);
      const flat = computeScore({ ...st, protocolMult: 1 });
      ascension = 2; careerWins = 1; bestRung = PROTOCOLS.length;
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const banked = { mult: runStats.protocolMult, rung: runStats.ascension, want: PROTOCOLS[1].mult };
      ascension = 0;
      runStats.deepestSector = 2; runStats.kills = 10;
      runStats.protocolMult = PROTOCOLS[1].mult; runStats.ascension = 2;
      endRun();
      const line = document.getElementById('runover-lines').innerText;
      return { risen, flat, banked, line };
    });
    ok('the multiplier stacks above the contracts', score.risen === Math.floor(score.flat * 1.5));
    ok(`and is banked when the run starts, not re-read later (x${score.banked.mult})`,
      score.banked.mult === score.banked.want && score.banked.rung === 2);
    ok(`the run-over screen names the rung and its price (x${score.banked.want.toFixed(2)})`,
      /BLOODRITE/.test(score.line) && score.line.includes(`x${score.banked.want.toFixed(2)}`));

    // ---- persistence ----
    const saved = await page.evaluate(() => {
      ascension = 2; careerWins = 1; bestRung = PROTOCOLS.length;
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      saveGameState();
      ascension = 0;
      loadGameState();
      const kept = ascension;
      const raw = JSON.parse(Store.get(BASE_SAVE_KEY + currentSlot));
      raw.ascension = 999;
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw));
      loadGameState();
      const clamped = ascension;
      delete raw.ascension;
      Store.set(BASE_SAVE_KEY + currentSlot, JSON.stringify(raw));
      loadGameState();
      const legacy = ascension;
      ascension = 0;
      return { kept, clamped, legacy };
    });
    ok('the rung rides the save', saved.kept === 2);
    ok('a tampered rung clamps to the ladder', saved.clamped === ladder.count);
    ok('a pre-ascension save loads flat', saved.legacy === 0);

    // ---- the field manual has the page ----
    const codex = await page.evaluate(() => {
      const e = CODEX.find(x => x.id === 'ASCENSION');
      const text = e ? e.body().join(' ') : '';
      return PROTOCOLS.every(p => text.includes(p.name));
    });
    ok('the field manual names every rung', codex);
  }
};

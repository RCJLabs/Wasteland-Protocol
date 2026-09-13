// N02, out of the N-audit, and it grew by one on measurement and then by one more.
//
// The badges are the surface K04 put on the field so a player can read a fight off it, and three
// of the six were describing rules the code does not have:
//
//   MARKED    said "Ranged, and lined up to be executed next turn". M09 established that
//             MARK_BONUS reads ANY damaging move by ANYONE - that was its whole finding - and
//             rewrote the CALLED SHOT card to say "whoever cashes it" while leaving this badge
//             on the rule as it stood before. It is also the one badge that means OPPOSITE
//             things on the two sides: a mark on an operator is the Carrion's, no MARK_BONUS
//             reads it at all, and the steering lives in `lockOn`.
//   BLEED     said "8% of its health". The tick is floor(maxHp * 0.08) - MAXIMUM health, five
//             times gentler as written on a body at a fifth of its bar, which is exactly the
//             moment somebody reads the badge to decide whether to spend a turn on it.
//   CORRODED  said "Armour counts as zero against every hit". mitigate zeroes `ac` for a
//             corroded body and then adds an escort's plate back on the very next line, so a
//             guarded lieutenant keeps twenty of it.
//
// THE ROWS BELOW TEST THE PROMISE, NOT THE STRING. A suite that greps the new wording would pass
// against copy that is wrong in some fresh way; what these do is stage the situation each
// sentence describes and check the number the player was told to expect.
module.exports = {
  name: 'What the badges promise',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'game.js'), 'utf8');

    // ── The table is still six, and every row still renders as text ────────────
    const table = await page.evaluate(() => ({
      rows: STATUSES.length,
      keys: STATUSES.map(s => s.key),
      // A description may be a function of the body it sits on. Whatever it is, both surfaces
      // that render one have to end up with a sentence rather than a function's source.
      chips: STATUSES.map(s => typeof statusDesc(s, { isPlayer: false })),
      squad: STATUSES.map(s => typeof statusDesc(s, { isPlayer: true })),
      codex: CODEX.find(e => e.id === 'STATUSES').body().filter(l => / - /.test(l))
    }));
    ok(`six badges, one per timed status the field shows (${table.rows})`, table.rows === 6);
    ok('every one renders a sentence on a hostile', table.chips.every(t => t === 'string'));
    ok('and on an operator', table.squad.every(t => t === 'string'));
    ok('and the codex prints six sentences, not a function body',
      table.codex.length === 6 && !table.codex.some(l => /=>/.test(l)));

    const field = () => page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField();
      const hitter = window.__bare(playerRoster.find(c => c.classType === 'BRUISER'));
      hitter.gridPos = 1; hitter.hp = hitter.maxHp = 900; hitter.dmgBase = 40;
      Object.keys(hitter.cooldowns || {}).forEach(k => hitter.cooldowns[k] = 0);
      const foe = window.__dummy({ id: 'bg0', hp: 99999, maxHp: 99999 });
      const guard = window.__dummy({ id: 'bg1', hp: 99999, maxHp: 99999 });
      activeEntities = [hitter, foe, guard]; turnQueue = [hitter, foe, guard];
      combatActive = true; momentum = 0; activeIndex = 0;
      runStats = runStats || {};
      window.__hit = (marked) => {
        foe.hp = foe.maxHp; foe.markedTurns = marked ? 3 : 0; foe.markedBy = null;
        activeIndex = 0; pendingAction = 'HEAVY_WRENCH';
        Object.keys(hitter.cooldowns).forEach(k => hitter.cooldowns[k] = 0);
        const before = foe.hp; resolveAction(foe.id); return before - foe.hp;
      };
      return true;
    });

    // ── MARKED: "the next damaging blow from ANYONE lands 50% harder" ──────────
    // The Bruiser is the point. A melee operator with no sniper training swinging a wrench is
    // the case the old badge said could not cash a mark, and M09's rule says it can.
    await field();
    const mark = await page.evaluate(() => {
      let wet = 0, dry = 0, n = 24;
      for (let i = 0; i < n; i++) { wet += window.__hit(true); dry += window.__hit(false); }
      const foe = activeEntities.find(e => e.id === 'bg0');
      window.__hit(true);
      return { wet: wet / n, dry: dry / n, spent: foe.markedTurns };
    });
    ok(`a melee swing from a Bruiser cashes a mark at all (${Math.round(mark.wet)} vs ${Math.round(mark.dry)})`,
      mark.wet > mark.dry);
    ok(`and it lands 50% harder, which is what the badge now promises (${(mark.wet / mark.dry).toFixed(2)}x)`,
      Math.abs(mark.wet / mark.dry - 1.5) < 0.08);
    ok('and spends the mark, so it is the NEXT blow and only that one', mark.spent === 0);
    // The other half of the sentence.
    const exec = await page.evaluate(() => {
      const row = COMBOS.find(c => c.move === 'EXECUTE_SHOT' && c.needs === 'markedTurns');
      return { mult: row && row.mult, eats: row && row.consumes };
    });
    ok(`an Execute doubles instead (x${exec.mult})`, exec.mult === 2.0 && exec.eats === 'markedTurns');

    // ── MARKED on an operator is the other thing entirely ──────────────────────
    // Same counter, same chip, and no MARK_BONUS reads it: the Carrion's call steers the field
    // with `lockOn`, which is what the squad-side sentence describes.
    const sided = await page.evaluate(() => {
      const s = STATUSES.find(x => x.key === 'markedTurns');
      return { foe: statusDesc(s, { isPlayer: false }), squad: statusDesc(s, { isPlayer: true }) };
    });
    ok('the badge says different things on the two sides of the field',
      sided.foe !== sided.squad && sided.squad.length > 10);
    ok('and neither of them says "ranged", which stopped being true at M09',
      !/ranged/i.test(sided.foe) && !/ranged/i.test(sided.squad));

    // ── BLEED: 8% of MAXIMUM health, and the difference is the whole point ─────
    const bleed = await page.evaluate(() => {
      const who = activeEntities.find(e => e.isPlayer);
      who.maxHp = 500; who.hp = 100;          // a fifth of the bar, where the two readings split
      bleedFor(who, 3, 'TEST');
      const before = who.hp;
      applyTurnStartEffects(who);
      return { took: before - who.hp, ofMax: Math.floor(500 * 0.08), ofCurrent: Math.floor(100 * 0.08) };
    });
    ok(`a bleed on a body at a fifth of its bar takes ${bleed.took}, which is 8% of its MAXIMUM (${bleed.ofMax})`,
      bleed.took === bleed.ofMax);
    ok(`and not 8% of what it has left (${bleed.ofCurrent}) - a five-fold difference the old badge got backwards`,
      bleed.took !== bleed.ofCurrent && bleed.ofMax > bleed.ofCurrent * 2);

    // ── CORRODED: its OWN armour, and an escort's plate is not its own ─────────
    await field();
    const acid = await page.evaluate(() => {
      const foe = activeEntities.find(e => e.id === 'bg0');
      const probe = () => mitigate(null, foe, 500, 'phys', null).ac;
      foe.armor = 30; foe.baseArmor = 30;
      const plain = probe();
      foe.corrodedTurns = 3;
      const eaten = probe();
      foe.escortId = 'bg1'; foe.escortArmor = 20;
      const guarded = probe();
      foe.corrodedTurns = 0; foe.escortId = null;
      return { plain, eaten, guarded };
    });
    ok(`corroding a body eats its own plate (${acid.plain} -> ${acid.eaten})`,
      acid.plain === 30 && acid.eaten === 0);
    ok(`but a living escort still shields it (${acid.guarded}), which "zero against every hit" denied`,
      acid.guarded === 20);

    // ── And the three sentences are actually on the rows ───────────────────────
    // Last and least: the behaviour above is what matters, but a row whose text drifted back
    // would leave every assertion here passing and the player still misinformed.
    ok('the bleed row names maximum health', /MAXIMUM health/.test(src));
    ok('the corroded row names the escort', /A living escort still shields it/.test(src));
    ok('and no badge anywhere still calls a mark ranged',
      !/desc:[^\n]*[Rr]anged, and lined up/.test(src));
  }
};

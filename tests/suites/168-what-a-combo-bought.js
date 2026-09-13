// M11. COMBOS has been in this game since Phase 1 - ten pairings, a status on the target and a
// move that exploits it, 1.5x to 2.0x - and until now nothing counted any of it. The simulator
// booked a combo turn as "claimed" and nothing else, so a pairing nobody can reach and a pairing
// everybody reaches read identically. That is the shape M06 found in the signatures (CALLED SHOT
// at 1% of swings) and M-audit found in the overdrives (nine of eighteen never fired), and it
// came out of the #197 scope as the largest unmeasured channel the statuses feed.
//
// The census books at the LANDING POINT, in applyDamageHit, and not at the branch in
// resolveAction that decides a combo fired. M08b's rule: mitigate is reached five times over by
// forecasts and a roster-card probe, and a ledger kept up there counts damage nobody took.
//
// The premium column is the point of it, and it is a genuine ranking - which the overdrive
// damage column M10 shipped explicitly is not. The difference is the window. An overdrive's
// value leaks into the turns after it; a combo multiplies one swing and resolves inside it.
// mitigate hands back cd, rv and ac, so the counterfactual is exact arithmetic rather than a
// model of the formula, and no second mitigate call is made - that would re-fire its own side
// effects (THICK_HIDE's noteQuirk among them) for a number nobody was ever dealt.
module.exports = {
  name: 'What a combo bought',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', '..');
    const src = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
    const sim = fs.readFileSync(path.join(root, 'tests', 'simulate.js'), 'utf8');

    // ── The table, and the keys the census builds off it ────────────────────────
    const table = await page.evaluate(() => ({
      rows: COMBOS.length,
      shaped: COMBOS.filter(c => c.move && c.needs && c.name && c.mult > 1).length,
      keys: COMBOS.map(c => `${c.move}>${c.needs.replace('Turns', '')}`),
      dupes: COMBOS.length - new Set(COMBOS.map(c => `${c.move}>${c.needs}`)).size,
      // Every `needs` has to be a status the badge registry knows, or the prompt promises a
      // pairing off a field nothing ever sets.
      unknown: COMBOS.filter(c => !STATUSES.some(s => s.key === c.needs)).map(c => c.needs),
      aoe: COMBOS.filter(c => isAoe(c.move)).map(c => c.move)
    }));
    ok(`${table.rows} pairings in the table, every one of them shaped`, table.rows === table.shaped && table.rows === 10);
    ok('and no two rows are the same move against the same status', table.dupes === 0);
    ok(`every pairing needs a status the badge registry knows${table.unknown.length ? ': ' + table.unknown.join(', ') : ''}`,
      table.unknown.length === 0);

    // A combo is squad-only. comboFor refuses a player target outright, which is why the census
    // has one side and the mark ledger beside it has two.
    const sided = await page.evaluate(() => ({
      atFoe: !!comboFor('SCRAP_BLADE', { isPlayer: false, stunnedTurns: 2 }),
      atSquad: !!comboFor('SCRAP_BLADE', { isPlayer: true, stunnedTurns: 2 }),
      cold: !!comboFor('SCRAP_BLADE', { isPlayer: false, stunnedTurns: 0 })
    }));
    ok('a pairing reads on a hostile carrying the status', sided.atFoe);
    ok('and never on an operator carrying the same one - combos are squad-only', !sided.atSquad);
    ok('and not at all when the status is not there', !sided.cold);

    // ── One field, one swing, one booking ───────────────────────────────────────
    // Everything bare: L06 built __bare because a muster hands out quirks and a quirk moves
    // damage, and a premium is a difference between two swings. An uncontrolled fixture makes
    // that difference meaningless. __clearField for the ambient half - ASHFALL's armour and the
    // ruins' cover are multipliers inside mitigate that live on the field, not on a body.
    const field = () => page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      window.__clearField();
      const breacher = window.__bare(playerRoster.find(c => c.classType === 'SHOTGUNNER'));
      breacher.gridPos = 1; breacher.hp = breacher.maxHp = 900; breacher.dmgBase = 40;
      breacher.traits = []; breacher.quirk = null; breacher.weaponMod = null;
      Object.keys(breacher.cooldowns).forEach(k => breacher.cooldowns[k] = 0);
      const front = window.__dummy({ id: 'cb0', hp: 99999, maxHp: 99999 });
      const behind = window.__dummy({ id: 'cb1', hp: 99999, maxHp: 99999 });
      activeEntities = [breacher, front, behind]; turnQueue = [breacher, front, behind];
      combatActive = true; momentum = 0;
      runStats = runStats || {};
      window.__swingAt = (move, oiled) => {
        runStats.cb = {};
        front.oiledTurns = oiled ? 3 : 0;
        front.hp = front.maxHp; behind.hp = behind.maxHp;
        breacher.cooldowns.buckshot = 0;
        activeIndex = 0; pendingAction = move;
        const a = front.hp, b = behind.hp;
        resolveAction(front.id);
        return { dealt: a - front.hp, splash: b - behind.hp, cb: JSON.parse(JSON.stringify(runStats.cb)) };
      };
      return breacher.id;
    });

    await field();
    const one = await page.evaluate(() => window.__swingAt('BUCKSHOT', true));
    const key = 'BUCKSHOT>oiled';
    ok(`an aimed combo books exactly one firing (${JSON.stringify(Object.keys(one.cb))})`,
      Object.keys(one.cb).length === 1 && one.cb[key] && one.cb[key].fired === 1);
    ok(`and the row carries the multiplier as a label, not a count (x${one.cb[key] && one.cb[key]._mult})`,
      one.cb[key]._mult === 2.0);

    // THE DENOMINATOR ASSERTION, and the reason this suite stages a body behind the target.
    // applyDamageHit is called a second and third time inside the same resolver - the DRUM CHOKE
    // splash, the AoE follow-through, HARRY's second bite - and comboHit is live for whichever
    // of those still sees it. Booking every landing while the flag is up would count one combo
    // as two or three firings and credit the splash a multiplier it never received: DRUM CHOKE's
    // follow-up is `baseDmg * 0.6` with no dmgMult in it at all. The flag is cleared on the line
    // after the aimed blow for exactly this reason, and this row is what holds it there.
    const choked = await page.evaluate(() => {
      const breacher = activeEntities.find(e => e.isPlayer);
      breacher.weaponMod = 'DRUM_CHOKE';
      const r = window.__swingAt('BUCKSHOT', true);
      breacher.weaponMod = null;
      return r;
    });
    ok(`the splash lands (${choked.splash} onto the body behind)`, choked.splash > 0);
    ok('and it is NOT booked as a second firing of the pairing - the aimed blow is the combo',
      choked.cb[key] && choked.cb[key].fired === 1);

    // The belt to that brace: the flag is taken and spent in the same breath at the door, so it
    // is one-shot whatever happens downstream of it. Without this, anything that threw between
    // the aimed blow and the line that clears it would leave a live flag sitting there and the
    // next blow through - an enemy's included - would be booked as a combo nobody fired.
    const oneShot = await page.evaluate(() => {
      const [who, front] = [activeEntities.find(e => e.isPlayer), activeEntities.find(e => e.id === 'cb0')];
      runStats.cb = {}; front.hp = front.maxHp;
      comboHit = COMBOS.find(c => c.move === 'BUCKSHOT');
      applyDamageHit(who, front, 40, 'phys', null);
      const first = JSON.parse(JSON.stringify(runStats.cb));
      applyDamageHit(who, front, 40, 'phys', null);
      return { first: (first['BUCKSHOT>oiled'] || {}).fired, second: (runStats.cb['BUCKSHOT>oiled'] || {}).fired };
    });
    ok('a riding combo row is spent by the first blow through the damage door', oneShot.first === 1);
    ok('and the blow after it books nothing - the flag cannot survive its own swing', oneShot.second === 1);

    // ── The premium is the difference, measured rather than modelled ────────────
    // Same swing twice against the same body, oiled and dry. What the census claims the pairing
    // added has to be what taking the oil away actually costs. Averaged, because a single swing
    // is not a measurement - suite 29's __perkAvg has averaged since P07 and M09 re-derived it
    // worse by comparing singles.
    const paired = await page.evaluate(() => {
      let wet = 0, dry = 0, claimed = 0, n = 24;
      for (let i = 0; i < n; i++) {
        const a = window.__swingAt('BUCKSHOT', true);
        wet += a.dealt; claimed += (a.cb['BUCKSHOT>oiled'] || {}).premium || 0;
        dry += window.__swingAt('BUCKSHOT', false).dealt;
      }
      return { wet: wet / n, dry: dry / n, claimed: claimed / n };
    });
    // OILED does two things, and only one of them is the pairing: the 2.0x here, and a flat -15
    // off the target's resistance that mitigate applies to ENERGY only. BUCKSHOT is phys, which
    // is why this arm is a clean read - the -15 never fires, so the gap between the two swings is
    // the multiplier and nothing else, and the three figures below agree to the point. A pairing
    // whose move IS energy (MOLOTOV) would show a gap wider than the premium, and correctly so.
    ok(`the pairing claims ${Math.round(paired.claimed)} points a swing`, paired.claimed > 0);
    ok(`and taking the oil away costs ${Math.round(paired.wet - paired.dry)}, which is at least that much`,
      paired.wet - paired.dry >= paired.claimed - 2);
    // The multiplier's own share, computed off the wet swing: a 2.0x that lands n took n/2 from
    // the pairing. Within flooring of what the census booked.
    ok(`and the claim matches half of the swing it multiplied (${Math.round(paired.claimed)} vs ${Math.round(paired.wet / 2)})`,
      Math.abs(paired.claimed - paired.wet / 2) <= Math.max(3, paired.wet * 0.06));

    // ── Every pairing in the table can be made to fire ─────────────────────────
    // WHY THIS ROW EXISTS, and the mistake it caught. One 150-expedition career reported nine of
    // ten pairings firing and HARPOON>corroded at zero, and I read that as the M06 shape - not
    // weak, unreached. A twenty-career run then fired HARPOON thirty-two times and SPRAY GUN at
    // zero, which is the opposite pairing cold. Both are corrode moves belonging to N08 RECRUIT
    // classes, so which of the two ever fires is decided by which recruits a career happened to
    // sign. A per-pairing count off one career is a roster history, not a property of the game.
    //
    // So the reading a cold column supports is exactly this one: can the pairing fire at all.
    // A pairing that fires here and not in a given career is a composition question. A pairing
    // that cannot fire HERE is broken, and that is worth knowing the day it is written. Staged
    // one at a time off the table itself, so a pairing added later is tested the day it lands.
    const each = await page.evaluate(() => {
      const out = {};
      COMBOS.forEach(c => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        window.__clearField();
        // Whoever carries the move, found off the same tables the command deck renders from -
        // ABILITIES for the three a class starts with, FOURTH_ABILITIES for the one E12b added
        // above them. BAYONET THRUST lives in the second table and the first cut of this row
        // missed it entirely.
        const cls = Object.keys(ABILITIES).find(k => ABILITIES[k].some(a => a.move === c.move))
                 || Object.keys(FOURTH_ABILITIES).find(k => FOURTH_ABILITIES[k].move === c.move);
        if (!cls) { out[c.move] = 'no class carries it'; return; }
        // Three of the ten belong to N08's recruit classes, which a fresh roster does not carry -
        // the HARPOONER among them, which is the whole reason this row exists. The deck is chosen
        // by classType, so a bared body re-badged to the class is the same body the engine would
        // hand that deck to. Cooldowns emptied rather than zeroed per key: the keys are the old
        // class's, and cdFor reads a missing one as ready.
        const who = window.__bare(playerRoster.find(p => p.classType === cls) || playerRoster[0]);
        who.classType = cls; who.cooldowns = {};
        who.gridPos = 1; who.hp = who.maxHp = 900; who.dmgBase = 40;
        const foe = window.__dummy({ id: 'cbx', hp: 99999, maxHp: 99999 });
        foe[c.needs] = 3; foe.markedBy = who.id;
        activeEntities = [who, foe]; turnQueue = [who, foe];
        combatActive = true; momentum = 0; activeIndex = 0;
        runStats = runStats || {}; runStats.cb = {};
        pendingAction = c.move;
        resolveAction(foe.id);
        const key = `${c.move}>${c.needs.replace('Turns', '')}`;
        out[c.move] = (runStats.cb[key] || {}).fired === 1 ? 'fired' : JSON.stringify(Object.keys(runStats.cb));
      });
      return out;
    });
    const misses = Object.entries(each).filter(([, v]) => v !== 'fired');
    ok(`all ten pairings fire when the status is on the target and the holder swings${misses.length ? ': ' + misses.map(([k, v]) => k + ' ' + v).join(', ') : ''}`,
      misses.length === 0);
    // Named rather than folded into the row above, because these three are the recruit classes'
    // moves - the ones a career may simply never field, and therefore the ones whose absence from
    // a census column says the least.
    ok('the three that belong to recruit classes included, which is where a cold column comes from',
      each.HARPOON === 'fired' && each.SPRAY_GUN === 'fired' && each.BAYONET_THRUST === 'fired');

    // ── What the census must not book ───────────────────────────────────────────
    // The MARKED! branch of the resolver also sets isCombo and has no COMBOS row behind it -
    // that payoff is the mark's, and noteMark has counted set/cash/called since M09. Booking it
    // here would put the same swing in two ledgers and make either of them wrong to add up.
    // The block above rebuilt the field ten times over, once per pairing. Re-staged rather than
    // reached for: the bodies this arm names are not on it any more.
    await field();
    const marked = await page.evaluate(() => {
      const front = activeEntities.find(e => e.id === 'cb0');
      runStats.cb = {}; runStats.mk = null;
      front.oiledTurns = 0; front.markedTurns = 3; front.markedBy = 'nobody';
      front.hp = front.maxHp;
      activeIndex = 0; pendingAction = 'SLUG_SHOT';
      resolveAction(front.id);
      return { cb: Object.keys(runStats.cb).length, cashed: (runStats.mk || {}).cash || 0 };
    });
    ok('a MARKED! payoff books nothing in the combo census', marked.cb === 0);
    ok('and is counted by the mark ledger instead, where it belongs', marked.cashed === 1);

    // ── The instrument is wired to the report, and folds like every other census ─
    ok('mitigate hands cd back with the figure, which is what the counterfactual is built from',
      /return \{ n, rv, ac, cd, cover \}/.test(src));
    ok('the census reads it rather than re-running mitigate for a second opinion',
      /Math\.floor\(cd \/ c\.mult\) - rv - ac/.test(src) && !/mitigate\([^)]*\)[\s\S]{0,200}mitigate\(/.test(
        (src.match(/function noteCombo[\s\S]*?\n\}/) || [''])[0]));
    ok('the flag is cleared on the same line the aimed blow ends, before any splash',
      /comboKill = false; comboHit = null;/.test(src));
    ok('the report folds the census with the shared fold rather than a hand-rolled loop',
      /foldAll\('cb'\)/.test(sim));
    // L02's lesson as a row: aura.type sat in the engine for four letter-series with no reader,
    // and a column nobody prints is a column nobody can be wrong about. Every field this census
    // keeps has to turn up in the block that reports it.
    {
      const block = (sim.match(/const cb = foldAll\('cb'\);[\s\S]*?\n  \}/) || [''])[0];
      const unread = ['fired', 'dmg', 'premium', 'kills', 'pierced', '_mult', '_eats']
        .filter(f => !block.includes(f));
      ok(`every field the census keeps is read by the report${unread.length ? ': ' + unread.join(', ') + ' unread' : ''}`,
        unread.length === 0);
    }
    ok('and carries the pairing keys out of the page so it can name the ones that never fired',
      /stat\.cbAll = \(COMBOS \|\| \[\]\)\.map/.test(sim) && /all\.filter\(k => !cb\[k\]\)/.test(sim));
    // The correction, held in place. A cold pairing belonging to a recruit class says nothing
    // about the game, and the report has to say so on the line rather than leave the reader to
    // know it - which is precisely what the first version of that line failed to do.
    ok('and marks a cold pairing that belongs to a recruit class, where a zero means nothing',
      /stat\.cbRecruit/.test(sim) && /\(recruit class\)/.test(sim) && /roster history, not a finding/.test(sim));

    // The pierce guard. Nothing reaches it today - the only pierced blow in the game is the
    // HEADSHOT overdrive, and comboHit is null throughout the overdrive block - so this asserts
    // the guard exists and says plainly that it is defensive rather than measured.
    ok('a pierced blow is guarded against taking a premium it never received',
      /if \(pierced\) \{ row\.pierced\+\+; return; \}/.test(src));
    ok('and the one pierced path in the game is an overdrive, which never carries a combo row',
      (src.match(/pierce: true/g) || []).length === 1);
  }
};

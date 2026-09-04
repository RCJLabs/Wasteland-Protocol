// E09: income compounds x1.4 a sector through sectorRewardMult, and four of the Outpost's lines
// were sector-one constants, so the till stopped being a decision about halfway down the road.
//
// Measured before the change, three operators from a quarter health back to full:
//
//   sector          1     2     3     4     5     6     7
//   a node pays   120   168   235   329   460   645   903
//   full heal      60    60    60    60    60    60    60
//   as a share    50%   36%   26%   18%   13%    9%  6.6%
//
// So attrition - which is what the game is about - had an off switch, and the switch got cheaper
// the longer you played. Meanwhile a 30-scrap line in the Armory cost 225 at sector 7, because
// shopPrice has been on the curve since it was built and E08's signature price joined it. This
// is that same rule applied to the four lines left behind - TRIAGE, the operator upgrade, the
// breakdown and the sell - with every sector-one price unchanged.
//
// And the note above sectorRewardMult said "Enemy stats climb 1.5x per sector", which they have
// not for a long time: SECTOR_HP_SCALE is 1.25 and SECTOR_DMG_SCALE is 1.28.
module.exports = {
  name: 'Prices from sector one',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ── Sector one is byte-identical to what it always charged ───────────────────────
    const door = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 1;
      const c = playerRoster[0];
      return { step: medBayCost(), upg0: upgradeCost({ upgradeCount: 0 }),
               upg3: upgradeCost({ upgradeCount: 3 }), bd: breakdownCost(), sell: sellValue(),
               mult: sectorRewardMult(), share: medBayStep(c), maxHp: c.maxHp };
    });
    ok(`the curve is exactly 1 where the game starts (${door.mult})`, door.mult === 1);
    ok(`so TRIAGE is still ${door.step}, the upgrade still ${door.upg0} rising to ${door.upg3}, breakdown ${door.bd}, a sold item ${door.sell}`,
      door.step === 10 && door.upg0 === 30 && door.upg3 === 105 && door.bd === 25 && door.sell === 20);
    ok(`and a click still buys the same share of the bar (${door.share} of ${door.maxHp})`,
      door.share === Math.floor(door.maxHp * 0.4));

    // ── And every one of them rides the curve the Armory already rides ──────────────
    const curve = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const at = s => {
        currentSector = s;
        return { m: sectorRewardMult(), step: medBayCost(), upg: upgradeCost({ upgradeCount: 0 }),
                 bd: breakdownCost(), sell: sellValue(), shop: shopPrice(30), sig: sigBuyCost() };
      };
      return [1, 4, 7].map(at);
    });
    ok(`a deep sector charges by the same multiplier for all of them (x${curve[2].m.toFixed(2)})`,
      curve.every(r => r.step === Math.round(10 * r.m) && r.upg === Math.round(30 * r.m)
                    && r.bd === Math.round(25 * r.m) && r.sell === Math.round(20 * r.m)));
    ok(`which is the multiplier the Armory has always used (${curve[2].shop} for a 30-scrap line)`,
      curve[2].shop === Math.floor(30 * curve[2].m) && curve[2].sig === Math.round(60 * curve[2].m));

    // ── A full heal is worth the same fraction of a fight at every depth ───────────
    const share = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const squad = playerRoster.slice(0, 3);
      const rows = [];
      for (let s = 1; s <= FINAL_SECTOR; s++) {
        currentSector = s; currentTier = 5;
        const payout = Math.floor((20 + currentTier * 20) * sectorRewardMult());
        squad.forEach(c => { c.hp = Math.floor(c.maxHp * 0.25); });
        const cost = squad.reduce((a, c) => a + patchUpCost(c), 0);
        const wasFlat = squad.reduce((a, c) => a + patchUpClicks(c), 0) * 10;
        rows.push({ s, pct: 100 * cost / payout, wasPct: 100 * wasFlat / payout });
      }
      return rows;
    });
    const spread = Math.max(...share.map(r => r.pct)) - Math.min(...share.map(r => r.pct));
    ok(`putting the squad back together costs the same slice of a fight all the way down (${share.map(r => r.pct.toFixed(0) + '%').join(' ')})`,
      spread < 3);
    ok(`where the flat price fell from ${share[0].wasPct.toFixed(0)}% to ${share[share.length-1].wasPct.toFixed(1)}% of one node`,
      share[share.length - 1].wasPct < 8 && share[0].wasPct > 45);

    // ── PATCH UP buys the thumb back, not a discount ─────────────────────────────
    // Driven through medBay both ways rather than compared against the helper, because the
    // claim is about what the two buttons charge, not what the helper computes.
    const patch = await page.evaluate(() => {
      // confirmNewGame re-musters, so playerRoster[0] is not the same operator between two
      // setups and its maxHp is not the same number. Both arms are pinned to one bar here, or
      // the comparison is between two different operators' bills.
      const BAR = 120;
      const setup = () => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 4;
        const c = playerRoster[0];
        c.maxHp = BAR; c.hp = 1; scrap = 100000;
        return c;
      };
      const a = setup(); const startA = scrap;
      let clicks = 0;
      while (a.hp < a.maxHp && clicks < 40) { medBay(a.id, 'HEAL'); clicks++; }
      const byClick = { spent: startA - scrap, hp: a.hp, full: a.maxHp, clicks };
      const b = setup(); const startB = scrap;
      const quoted = patchUpCost(b);
      medBay(b.id, 'PATCH');
      const byPatch = { spent: startB - scrap, hp: b.hp, full: b.maxHp, quoted };
      return { byClick, byPatch, full: BAR };
    });
    ok(`${patch.byClick.clicks} clicks of TRIAGE fills the bar for ${patch.byClick.spent}`,
      patch.byClick.hp === patch.full && patch.byClick.full === patch.full && patch.byClick.spent > 0);
    ok(`and PATCH UP charges exactly that, in one (${patch.byPatch.spent})`,
      patch.byPatch.spent === patch.byClick.spent && patch.byPatch.hp === patch.full
      && patch.byPatch.full === patch.full);
    ok('quoting the price it then charges', patch.byPatch.quoted === patch.byPatch.spent);

    // ── It refuses rather than part-healing ─────────────────────────────────────
    const short = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 4;
      const c = playerRoster[0];
      c.hp = 1;
      scrap = patchUpCost(c) - 1;
      const before = { hp: c.hp, scrap };
      medBay(c.id, 'PATCH');
      const after = { hp: c.hp, scrap };
      // Dead and already-full are both no-ops, at either button.
      c.hp = 0; scrap = 100000; const deadScrap = scrap;
      medBay(c.id, 'PATCH'); medBay(c.id, 'HEAL');
      const dead = { hp: c.hp, charged: deadScrap - scrap };
      c.hp = c.maxHp; const fullScrap = scrap;
      medBay(c.id, 'HEAL'); medBay(c.id, 'PATCH');
      return { before, after, dead, fullCharged: fullScrap - scrap };
    });
    ok(`one scrap short and it does nothing at all (${short.after.hp} hp, ${short.after.scrap} scrap)`,
      short.after.hp === short.before.hp && short.after.scrap === short.before.scrap);
    ok('an operator on the floor cannot be bought back up', short.dead.hp === 0 && short.dead.charged === 0);
    ok('and neither button charges for healing somebody already whole', short.fullCharged === 0);

    // ── The screen quotes the live price ───────────────────────────────────────
    const screen = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      currentSector = 5;
      const c = playerRoster.find(p => p.gridPos > 0);
      c.hp = 1; scrap = 100000;
      renderOutpost();
      const read = mode => {
        const el = [...document.querySelectorAll(`[data-action="medbay"][data-id="${c.id}"]`)]
          .find(b => b.dataset.mode === mode);
        return el ? { text: el.innerText, off: el.disabled } : null;
      };
      const hurt = { triage: read('HEAL'), patch: read('PATCH'), step: medBayCost(), cost: patchUpCost(c) };
      // One click from full: PATCH UP would quote the same price for the same thing, so it goes.
      c.hp = c.maxHp - 1; renderOutpost();
      const nearly = { patch: read('PATCH'), clicks: patchUpClicks(c) };
      const bd = document.getElementById('btn-breakdown');
      return { hurt, nearly, breakdown: bd ? bd.innerText : '', bdCost: breakdownCost() };
    });
    ok(`TRIAGE prints this sector's price (${screen.hurt.triage.text})`,
      screen.hurt.triage.text.includes(`(${screen.hurt.step})`) && screen.hurt.step > 10);
    ok(`PATCH UP prints what the whole bar costs (${screen.hurt.patch.text})`,
      screen.hurt.patch.text.includes(`(${screen.hurt.cost})`) && screen.hurt.cost > screen.hurt.step);
    ok(`and stands down when one TRIAGE would finish it (${screen.nearly.clicks} click)`,
      screen.nearly.clicks === 1 && screen.nearly.patch === null);
    ok(`the breakdown button quotes its price too (${screen.breakdown})`,
      screen.breakdown.includes(String(screen.bdCost)) && screen.bdCost > 25);

    // ── The note above the curve says what the curve is ───────────────────────
    const note = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      return { stale: /climb 1\.5x per sector/.test(src), hp: SECTOR_HP_SCALE, dmg: SECTOR_DMG_SCALE,
               income: sectorRewardMult.toString().includes('1.4') };
    });
    ok('the note no longer claims the enemy curve is 1.5 a sector', note.stale === false);
    ok(`because it is ${note.hp} in health and ${note.dmg} in damage, against 1.4 in income`,
      note.hp === 1.25 && note.dmg === 1.28 && note.income);
  }
};

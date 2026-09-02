// installAugment pushed onto char.augments and asked nothing except whether the materials were
// there, so Plating, Optics and the Pump could each be bought as many times as the wasteland
// handed out parts - +20 health a time, forever, on every operator. That is the defect C04
// fixed on the Citadel: an uncapped power source a long run buys its way past.
//
// It survived this long because the SIMULATOR capped itself at three a head from the day it
// first installed one, so every balance figure this repo has taken was measured against a
// ceiling the game did not have, and the uncapped game never appeared in a report. The cap is
// three to match what those readings already assumed, and the simulator now asks the game for
// the number instead of keeping its own copy.
//
// What this suite holds: that the ceiling is real at the function rather than only on the
// button, that a save carrying more than three is not robbed of what it already paid for, and
// that the screen says how much room is left - because a list that only ever grew could not.
module.exports = {
  name: 'Augments have a ceiling',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    const table = await page.evaluate(() => ({
      slots: AUGMENT_SLOTS,
      ids: AUGMENTS.map(a => a.id),
      complete: AUGMENTS.every(a => a.id && a.name && a.short && a.mat && a.cost > 0
                                 && a.tag && typeof a.apply === 'function'),
      mats: AUGMENTS.map(a => a.mat),
      byId: AUGMENTS.every(a => !!augmentById(a.id)),
      missing: augmentById('NOPE')
    }));
    ok(`${table.ids.length} augments, ${table.slots} slots an operator`, table.ids.length === 3 && table.slots === 3);
    ok('each is named, costed and does something', table.complete);
    ok('no two share an id', new Set(table.ids).size === table.ids.length);
    ok('each spends a different material', new Set(table.mats).size === table.mats.length);
    ok('augmentById finds each and nothing else', table.byId && table.missing === null);

    // ── The ceiling is at the function, not the button ───────────────────────────────────
    const fill = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const ch = playerRoster[0];
      materials = { parts: 999, chems: 999, tech: 999 };
      const before = { hp: ch.maxHp, dmg: ch.dmgBase, spd: ch.speed };
      const took = [];
      for (let i = 0; i < 10; i++) took.push(installAugment(ch.id, 'PLATING'));
      const partsSpent = 999 - materials.parts;
      return { took, worn: augmentsOn(ch).length, left: augmentSlotsLeft(ch),
               hpGain: ch.maxHp - before.hp, partsSpent,
               canMore: canAugment(ch, 'PLATING'), canOther: canAugment(ch, 'OPTICS'),
               dmg: ch.dmgBase - before.dmg, spd: ch.speed - before.spd };
    });
    ok(`ten installs on one operator land ${fill.worn}`, fill.worn === table.slots);
    ok('the first three are taken and the rest refused', fill.took.filter(Boolean).length === table.slots);
    ok(`and the refused ones cost no materials (${fill.partsSpent} parts for ${table.slots})`, fill.partsSpent === 9);
    ok(`the health that was paid for is there (+${fill.hpGain})`, fill.hpGain === 60);
    ok('and nothing else moved', fill.dmg === 0 && fill.spd === 0);
    ok('a full operator has no slots left', fill.left === 0);
    ok('and cannot take a different augment either - slots, not one of each', !fill.canMore && !fill.canOther);

    // Three of the same is a build. Check the other two apply what they claim.
    const each = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      materials = { parts: 999, chems: 999, tech: 999 };
      const out = {};
      AUGMENTS.forEach((a, i) => {
        const ch = playerRoster[i + 1];
        const b = { hp: ch.maxHp, dmg: ch.dmgBase, spd: ch.speed };
        installAugment(ch.id, a.id);
        out[a.id] = { hp: ch.maxHp - b.hp, dmg: ch.dmgBase - b.dmg, spd: ch.speed - b.spd,
                      tagged: augmentsOn(ch)[0] };
      });
      return out;
    });
    ok(`PLATING is health only (+${each.PLATING.hp} HP)`, each.PLATING.hp === 20 && !each.PLATING.dmg && !each.PLATING.spd);
    ok(`OPTICS is damage only (+${each.OPTICS.dmg} DMG)`, each.OPTICS.dmg === 4 && !each.OPTICS.hp && !each.OPTICS.spd);
    ok(`PUMP is speed only (+${each.PUMP.spd} SPD)`, each.PUMP.spd === 3 && !each.PUMP.hp && !each.PUMP.dmg);
    ok('each one names itself in the list it joins',
       Object.values(each).every(v => typeof v.tagged === 'string' && v.tagged.length > 2));

    // ── Materials still have to be there ─────────────────────────────────────────────────
    const broke = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const ch = playerRoster[0];
      materials = { parts: 2, chems: 0, tech: 0 };
      const tookPoor = installAugment(ch.id, 'PLATING');
      materials.parts = 3;
      const tookRich = installAugment(ch.id, 'PLATING');
      return { tookPoor, tookRich, worn: augmentsOn(ch).length, parts: materials.parts };
    });
    ok('one part short buys nothing', broke.tookPoor === false && broke.worn === 1);
    ok('and the price is exact - three parts, none left', broke.tookRich === true && broke.parts === 0);

    // ── A save from before the cap keeps what it paid for ────────────────────────────────
    const legacy = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      const ch = playerRoster[0];
      ch.augments = ['Plating', 'Plating', 'Plating', 'Optics', 'Optics'];   // an old, uncapped save
      ch.maxHp += 60; ch.dmgBase += 8;
      materials = { parts: 999, chems: 999, tech: 999 };
      const hp = ch.maxHp, dmg = ch.dmgBase;
      const took = installAugment(ch.id, 'PLATING');
      return { took, worn: augmentsOn(ch).length, left: augmentSlotsLeft(ch),
               keptHp: ch.maxHp === hp, keptDmg: ch.dmgBase === dmg };
    });
    ok('an over-capped save cannot buy a sixth', legacy.took === false && legacy.worn === 5);
    ok('but keeps every stat it already paid for', legacy.keptHp && legacy.keptDmg);
    ok('and reports no slots left rather than a negative number', legacy.left === 0);

    // ── The screen says how much room is left ────────────────────────────────────────────
    const screen = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      materials = { parts: 999, chems: 999, tech: 999 };
      const ch = playerRoster[0];
      renderOutpost();
      const cardOf = id => [...document.querySelectorAll('#cybernetics-roster .upgrade-card')]
        .find(c => c.querySelector('.upgrade-header').innerText.includes(
          playerRoster.find(p => p.id === id).name));
      const empty = cardOf(ch.id).innerText;
      const emptyEnabled = [...cardOf(ch.id).querySelectorAll('.aug-btn')].filter(b => !b.disabled).length;
      for (let i = 0; i < AUGMENT_SLOTS; i++) installAugment(ch.id, 'OPTICS');
      renderOutpost();
      const full = cardOf(ch.id).innerText;
      const fullEnabled = [...cardOf(ch.id).querySelectorAll('.aug-btn')].filter(b => !b.disabled).length;
      // Somebody else with room is still buyable, so it is the operator that is full and not the shop.
      const otherEnabled = [...cardOf(playerRoster[1].id).querySelectorAll('.aug-btn')].filter(b => !b.disabled).length;
      return { empty, full, emptyEnabled, fullEnabled, otherEnabled, slots: AUGMENT_SLOTS };
    });
    ok(`an empty operator shows the count (${/AUGS [^:]*:/.exec(screen.empty)?.[0] || '??'})`,
       screen.empty.includes(`AUGS 0/${screen.slots}`));
    ok('and offers every augment', screen.emptyEnabled === 3);
    ok('a full one says so instead of listing a fourth', /AUGS FULL/.test(screen.full));
    ok('and offers none of them', screen.fullEnabled === 0);
    ok('while an operator with room is still buyable', screen.otherEnabled === 3);

    // The codex carries the ceiling, off the same constant.
    const codex = await page.evaluate(() => {
      const body = CODEX.find(c => /craft|material|bag/i.test(c.title) ||
                                   c.body().join(' ').includes('augments')).body().join(' | ');
      return { hasSlots: body.includes(`${AUGMENT_SLOTS} augment slots`),
               names: AUGMENTS.every(a => body.includes(a.name)) };
    });
    ok('the codex states the ceiling', codex.hasSlots);
    ok('and names every augment off the table', codex.names);
  }
};

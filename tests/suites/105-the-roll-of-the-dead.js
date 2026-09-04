// Permadeath is the sharpest thing the game does and it had no memory outside the run that
// caused it. loseOperator built a full record - name, class, level, where, and what took them -
// endRun threw four of its seven fields away on the way to localStorage, and nothing anywhere
// read the three that survived: every surface that named the dead (OPERATORS LOST on the run
// summary, PAID FOR IT on the victory and recall screens) read runStats, which dies with the
// run. A career could lose thirty operators and the Chronicle would not know one name.
//
// It also got the one informative field wrong. The killer was read off runStats.lastKiller at
// bleed-out time - the last blow landed anywhere in the run - so if a second operator went down
// while the first was still on the clock, the first was recorded as killed by the second's
// killer. The record is per-person now, stamped when the blow lands.
module.exports = {
  name: 'The roll of the dead',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    const wipe = () => page.evaluate(() => {
      [1, 2, 3].forEach(s => { Store.remove(chronicleKey(s)); Store.remove(careerKey(s)); });
    });

    // ---- the blow that dropped THEM, not the blow that dropped last ----
    const witness = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const heroes = playerRoster.filter(p => p.gridPos > 0);
      const a = heroes[0], b = heroes[1];
      const foes = activeEntities.filter(e => !e.isPlayer);
      const x = foes[0], y = foes[1] || foes[0];
      x.name = 'FIRST KILLER'; x.eliteType = 'FRENZIED'; y.name = 'SECOND KILLER'; y.eliteType = null;
      bonds = {};
      const strip = e => { e.resistances = { phys: 0, bio: 0, energy: 0 }; e.armor = 0; e.plate = 0; e.quirk = null; e.trinket = null; };
      strip(a); strip(b);
      a.hp = 1; applyDamageHit(x, a, 99, 'phys', 'CLAW');
      b.hp = 1; applyDamageHit(y, b, 99, 'phys', 'CLAW');
      const runLast = runStats.lastKiller && runStats.lastKiller.name;
      // A is still on the clock and B's killer landed the more recent blow. A's clock runs out.
      a.downTurns = 1; tickBleedOut(a);
      const recA = (runStats.fallen || []).find(f => f.name === a.name);
      b.downTurns = 1; tickBleedOut(b);
      const recB = (runStats.fallen || []).find(f => f.name === b.name);
      combatActive = false;
      return { runLast, a: recA || null, b: recB || null };
    });
    ok(`the run's last word is still the last blow anywhere (${witness.runLast})`,
      witness.runLast === 'SECOND KILLER');
    ok('but the one who bled out first is recorded against the one who dropped THEM',
      !!witness.a && witness.a.killer === 'FIRST KILLER');
    ok('with the elite mark that blow carried', !!witness.a && witness.a.elite === 'FRENZIED');
    ok('and the second against theirs', !!witness.b && witness.b.killer === 'SECOND KILLER' && !witness.b.elite);
    ok('both carry the class and the level they died at',
      !!witness.a && !!witness.a.classType && witness.a.level >= 1 &&
      !!witness.b && !!witness.b.classType && witness.b.level >= 1);

    // The stamp lives on the operator, and the operator is a roster entry, so it has to make it
    // through a save the same way the bleed-out clock does - an F5 while somebody is on the
    // floor must not cost the record of who put them there.
    const reloaded = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const a = playerRoster.filter(p => p.gridPos > 0)[0];
      a.resistances = { phys: 0, bio: 0, energy: 0 }; a.armor = 0; a.plate = 0; a.quirk = null; a.trinket = null;
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.name = 'THE ONE THAT DID IT'; foe.eliteType = null;
      bonds = {};
      a.hp = 1; applyDamageHit(foe, a, 99, 'phys', 'CLAW');
      saveGameState();
      playerRoster = []; activeEntities = []; turnQueue = [];
      loadGameState();
      const back = playerRoster.find(c => c.id === a.id);
      back.downTurns = 1; tickBleedOut(back);
      combatActive = false;
      const rec = (runStats.fallen || []).find(f => f.name === back.name);
      return { killer: rec ? rec.killer : null };
    });
    ok(`a reload while they are still on the floor keeps who put them there (${reloaded.killer})`,
      reloaded.killer === 'THE ONE THAT DID IT');

    // ---- and the whole of it reaches disk ----
    const disk = await page.evaluate(() => {
      [1, 2, 3].forEach(s => { Store.remove(chronicleKey(s)); Store.remove(careerKey(s)); });
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const a = playerRoster.filter(p => p.gridPos > 0)[0];
      a.level = 4; a.resistances = { phys: 0, bio: 0, energy: 0 }; a.armor = 0; a.plate = 0; a.quirk = null; a.trinket = null;
      const foe = activeEntities.find(e => !e.isPlayer);
      foe.name = 'Juggernaut'; foe.eliteType = 'FRENZIED';
      bonds = {}; currentSector = 3; currentTier = 6;
      a.hp = 1; applyDamageHit(foe, a, 99, 'phys', 'CLAW');
      a.downTurns = 1; tickBleedOut(a);
      const inRun = (runStats.fallen || [])[0];
      combatActive = false;
      runStats.deepestSector = 3; runStats.deepestTier = 6;
      endRun();
      const kept = readChronicle(1)[0].fallen[0];
      return { inRun, kept, career: readCareer(1).lost };
    });
    ok(`the class survives the write (${disk.kept && disk.kept.classType})`,
      !!disk.kept && disk.kept.classType === disk.inRun.classType && !!disk.kept.classType);
    ok(`so does the level (L${disk.kept && disk.kept.level})`, !!disk.kept && disk.kept.level === 4);
    ok(`so does what took them (${disk.kept && disk.kept.killer})`,
      !!disk.kept && disk.kept.killer === 'Juggernaut' && disk.kept.elite === 'FRENZIED');
    ok(`and where they fell (S${disk.kept && disk.kept.sector}·T${disk.kept && disk.kept.tier})`,
      !!disk.kept && disk.kept.sector === 3 && disk.kept.tier === 6);
    ok('nothing live follows them onto the disk',
      !!disk.kept && Object.keys(disk.kept).sort().join(',') ===
        'boss,cause,classType,elite,killer,level,name,sector,tier');
    ok('and the career counts the loss', disk.career === 1);

    // ---- the roll, read off the screen ----
    await wipe();
    const shown = await page.evaluate(() => {
      currentSlot = 1;
      writeChronicle({ when: 2000, score: 900, sector: 4, tier: 7, kills: 30, deployed: ['BRUISER'],
        epitaph: epitaphFor({ lastKiller: { name: 'Juggernaut', elite: 'FRENZIED', sector: 4, tier: 7, cause: 'COMBAT' } }),
        relics: [], contracts: [], seed: null,
        fallen: [
          { name: 'Kesh', classType: 'TRENCH_FIEND', level: 5, sector: 4, tier: 7, cause: 'COMBAT', killer: 'Juggernaut', elite: 'FRENZIED', boss: false },
          { name: 'Vann', classType: 'MEDIC', level: 3, sector: 4, tier: 6, cause: 'SMOG', killer: null, elite: null, boss: false },
          { name: 'Rook', classType: 'HARPOONER', level: 2, sector: 4, tier: 5, cause: 'BLED_OUT', killer: null, elite: null, boss: false },
          { name: 'Sela', classType: 'SNIPER', level: 6, sector: 4, tier: 7, cause: 'COMBAT', killer: 'The Matriarch', elite: null, boss: true }
        ] });
      renderChronicle();
      const el = document.getElementById('chronicle-roll');
      return { text: el.innerText, rows: el.querySelectorAll('.roll-row').length,
               career: document.getElementById('chronicle-career').innerText,
               entry: document.querySelector('.chronicle-entry').innerText };
    });
    ok(`the roll has a row for every one of them (${shown.rows})`, shown.rows === 4);
    ok('an operator killed in a fight is named, ranked and placed',
      /Kesh/.test(shown.text) && /TRENCH FIEND/.test(shown.text) && /L5/.test(shown.text) && /S4·T7/.test(shown.text));
    ok('with the elite that did it', /FRENZIED Juggernaut/.test(shown.text));
    ok('the weather gets its own line', /Vann[\s\S]*Choked out by the smog/.test(shown.text));
    ok('a death nobody witnessed says only that', /Rook[\s\S]*Bled out on the road/.test(shown.text));
    ok('and a warlord is called one', /the warlord The Matriarch/.test(shown.text));
    ok('the career ledger carries the lifetime tally', /OPERATORS LOST\n4/.test(shown.career));
    // The epitaph and the roll describe the same blow, so they must word it the same way.
    const verb = (shown.entry.match(/(Torn apart by|Gunned down by|Broken by|Dragged down by|Finished by) a FRENZIED Juggernaut/) || [])[1];
    ok(`the run's epitaph and the roll use one vocabulary (${verb})`,
      !!verb && shown.text.includes(`${verb} a FRENZIED Juggernaut.`));

    // ---- an entry written before any of this still opens ----
    await wipe();
    const old = await page.evaluate(() => {
      currentSlot = 1;
      // Exactly the shape endRun wrote until now, plus everything a damaged one could be.
      writeChronicle({ when: 1000, score: 400, sector: 2, tier: 3, kills: 8, deployed: ['MEDIC'],
        epitaph: 'Broken by a Warbot, Sector 2, Tier 3.', relics: [], contracts: [], seed: null,
        fallen: [{ name: 'Otho', sector: 2, tier: 3 }] });
      writeChronicle({ when: 900, score: 100, sector: 1, tier: 1, kills: 1, deployed: ['MEDIC'],
        epitaph: 'Vanished into the wasteland, Sector 1.', relics: [], contracts: [], seed: null,
        fallen: [null, 'Otho', {}, { sector: 9 }] });
      writeChronicle({ when: 800, score: 50, sector: 1, tier: 1, kills: 0, deployed: ['MEDIC'],
        epitaph: 'Vanished into the wasteland, Sector 1.', relics: [], contracts: [], seed: null });
      let threw = null;
      try { renderChronicle(); } catch (e) { threw = String(e); }
      const el = document.getElementById('chronicle-roll');
      return { threw, text: el.innerText, rows: el.querySelectorAll('.roll-row').length,
               career: document.getElementById('chronicle-career').innerText };
    });
    ok('a career that predates the roll opens instead of crashing', old.threw === null);
    ok('the one name it kept is on the roll', /Otho/.test(old.text) && /S2·T3/.test(old.text));
    ok('and the roll says plainly what was never written down',
      /No record of what took them/.test(old.text) && !/undefined/.test(old.text));
    ok(`rubbish in the list is skipped rather than printed (${old.rows} row)`, old.rows === 1);
    ok('while the lifetime tally still counts every one of them', /OPERATORS LOST\n5/.test(old.career));

    // A career file written before any of this has no counter at all: it reads zero while its
    // own log is full of names. The ledger must not print a nought over a list of the dead.
    await wipe();
    const migrated = await page.evaluate(() => {
      currentSlot = 1;
      writeChronicle({ when: 1000, score: 400, sector: 2, tier: 3, kills: 8, deployed: ['MEDIC'],
        epitaph: 'x.', relics: [], contracts: [], seed: null,
        fallen: [{ name: 'Otho', sector: 2, tier: 3 }, { name: 'Wren', sector: 2, tier: 2 }] });
      // ...and then the counter is scrubbed back out, which is exactly how it arrives.
      const c = readCareer(1); delete c.lost; Store.set(careerKey(1), JSON.stringify(c));
      const asRead = readCareer(1).lost;
      renderChronicle();
      return { asRead, career: document.getElementById('chronicle-career').innerText,
               roll: document.getElementById('chronicle-roll').innerText,
               rows: document.querySelectorAll('.roll-row').length };
    });
    ok('a career file with no counter reads as zero rather than undefined', migrated.asRead === 0);
    ok('but the ledger counts the names the log still holds', /OPERATORS LOST\n2/.test(migrated.career));
    ok('and the roll head agrees with its own list',
      /THE ROLL OF THE DEAD · 2/.test(migrated.roll) && migrated.rows === 2);

    // ---- what the tally knows that the log has forgotten ----
    await wipe();
    const beyond = await page.evaluate(() => {
      currentSlot = 1;
      for (let i = 0; i < 55; i++) writeChronicle({ when: 1000 + i, score: i, sector: 1, tier: 1,
        kills: 0, deployed: ['BRUISER'], epitaph: `Run ${i}.`,
        fallen: i < 5 ? [{ name: `Ghost${i}`, classType: 'BRUISER', level: 1, sector: 1, tier: 1, cause: 'BLED_OUT', killer: null, elite: null, boss: false }] : [] });
      renderChronicle();
      const el = document.getElementById('chronicle-roll');
      return { text: el.innerText, rows: el.querySelectorAll('.roll-row').length, lost: readCareer(1).lost };
    });
    ok(`the tally remembers losses the log has dropped (${beyond.lost})`, beyond.lost === 5);
    ok('and the roll says so rather than showing an empty list',
      beyond.rows === 0 && /THE ROLL OF THE DEAD · 5/.test(beyond.text) && /off the end of it/.test(beyond.text));

    // ---- a career that has not lost anyone, and one that has not started ----
    await wipe();
    const clean = await page.evaluate(() => {
      currentSlot = 1;
      writeChronicle({ when: 1, score: 10, sector: 1, tier: 1, kills: 1, deployed: ['MEDIC'], epitaph: 'Out.', fallen: [] });
      renderChronicle();
      const whole = document.getElementById('chronicle-roll').innerText;
      const career = document.getElementById('chronicle-career').innerText;
      [1, 2, 3].forEach(s => { Store.remove(chronicleKey(s)); Store.remove(careerKey(s)); });
      renderChronicle();
      return { whole, career, fresh: document.getElementById('chronicle-roll').innerHTML };
    });
    ok('an expedition that came home whole is said so, not left blank', /came home whole/.test(clean.whole));
    ok('and the ledger still prints the zero', /OPERATORS LOST\n0/.test(clean.career));
    ok('a career with no expeditions on it shows no roll at all', clean.fresh === '');

    // ---- bounded, and honest about the bound ----
    await wipe();
    const capped = await page.evaluate(() => {
      currentSlot = 1;
      const dead = n => Array.from({ length: n }, (_, i) => ({ name: `N${i}`, classType: 'BRUISER',
        level: 1, sector: 1, tier: 1, cause: 'BLED_OUT', killer: null, elite: null, boss: false }));
      writeChronicle({ when: 1, score: 1, sector: 1, tier: 1, kills: 0, deployed: [], epitaph: 'x.', fallen: dead(50) });
      renderChronicle();
      const el = document.getElementById('chronicle-roll');
      return { rows: el.querySelectorAll('.roll-row').length, text: el.innerText };
    });
    // Forty is written out here rather than read off ROLL_SHOWN: a test that reads the same
    // constant the code reads agrees with whatever the constant becomes, which is no test.
    ok(`the roll prints at most forty of them (${capped.rows})`, capped.rows === 40);
    ok('and says how many it did not', /and 10 more still on the log/.test(capped.text));

    // ---- the tally adds up across every slot ----
    await wipe();
    const merged = await page.evaluate(() => {
      const one = n => ({ when: n, score: 1, sector: 1, tier: 1, kills: 0, deployed: [], epitaph: 'x.',
        fallen: [{ name: `S${n}`, classType: 'MEDIC', level: 1, sector: 1, tier: 1, cause: 'BLED_OUT', killer: null, elite: null, boss: false }] });
      currentSlot = 2; writeChronicle(one(10)); writeChronicle(one(11));
      currentSlot = 3; writeChronicle(one(12));
      currentSlot = 1; renderChronicle();
      return { career: document.getElementById('chronicle-career').innerText,
               text: document.getElementById('chronicle-roll').innerText };
    });
    ok('the memorial adds up across every slot', /OPERATORS LOST\n3/.test(merged.career));
    ok('and the roll names them wherever they were lost',
      /S10/.test(merged.text) && /S11/.test(merged.text) && /S12/.test(merged.text));

    await wipe();
  }
};

// A signature the player cannot read is just an unpleasant surprise. The bestiary remembers
// every type met across every run - what it does, what it resists, what it has cost you - and
// any hostile on the field opens its file on a tap, whenever the squad is not mid-aim.
module.exports = {
  name: 'Know your enemy',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- the roster covers everything the wasteland fields ----
    const roster = await page.evaluate(() => {
      const r = bestiaryRoster();
      const stock = Object.values(ENEMY_POOL).flat();
      return {
        total: r.length, stock: stock.length, bosses: r.filter(e => e.boss).length,
        // Read off the pool rather than pinned: the last warlord joined it and files like the
        // rest, and a new commander should file itself rather than need this line edited.
        commanders: BOSS_POOL.length, road: BOSS_ROTATION.length,
        named: r.every(e => e.name && e.faction && e.resistances),
        sigsOnStock: r.filter(e => !e.boss).every(e => e.sig && ENEMY_SIGS[e.sig]),
        factions: [...new Set(r.map(e => e.faction))].sort().join(),
        expected: [...Object.keys(ENEMY_POOL), 'COMMAND'].sort().join(),
        found: !!bestiaryRecord('Juggernaut'), missing: bestiaryRecord('Nobody')
      };
    });
    ok(`every hostile has a file (${roster.total} = ${roster.stock} stock + ${roster.bosses} warlords)`,
      roster.total === roster.stock + roster.bosses && roster.stock >= 10
      && roster.bosses === roster.commanders && roster.commanders === roster.road + 1);
    ok('each named, factioned and with resistances', roster.named);
    ok('every ordinary type carries a real signature', roster.sigsOnStock);
    // Read off the pools, so a new faction files itself rather than needing this line edited.
    ok(`filed under the factions that exist (${roster.factions})`, roster.factions === roster.expected);
    ok('lookup finds a real one and refuses an invented one', roster.found && roster.missing === null);

    // ---- an affix is a modifier on a type, not a type of its own ----
    const naming = await page.evaluate(() => {
      const plain = { name: 'Juggernaut', isPlayer: false };
      const elite = { name: '*FRENZIED* Juggernaut', eliteType: 'FRENZIED', isPlayer: false };
      return { plain: typeNameOf(plain), elite: typeNameOf(elite), hero: typeNameOf({ isPlayer: true }) };
    });
    ok('an elite files under its own type, not a new one',
      naming.plain === 'Juggernaut' && naming.elite === 'Juggernaut' && naming.hero === null);

    // ---- the file fills in from play ----
    const filling = await page.evaluate(() => {
      bestiary = {};
      const before = hasMet('Raider');
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const metOnSight = bestiaryEntry('Raider').met;
      const foe = activeEntities.find(e => !e.isPlayer);
      const hero = playerRoster.find(p => p.gridPos > 0);
      // A rolled Second Wind keeps an operator standing through the killing blow, which is
      // exactly what this measures - pin the quirk off, the way every precision fixture does.
      hero.quirk = null; hero.trinket = null; hero.traits = []; hero.secondWindUsed = false;
      // killing one is recorded once, however many times it is hit afterwards
      foe.hp = 1;
      applyDamageHit(hero, foe, 999, 'phys', null);
      applyDamageHit(hero, foe, 999, 'phys', null);
      const killed = bestiaryEntry(typeNameOf(foe)).killed;
      // and what it costs you is recorded too
      hero.hp = 1; hero.resistances = { phys: 0, bio: 0, energy: 0 }; hero.armor = 0;
      const killer = activeEntities.find(e => !e.isPlayer && e.hp > 0) || foe;
      killer.hp = 100;
      applyDamageHit(killer, hero, 999, 'phys', null);
      const felled = bestiaryEntry(typeNameOf(killer)).felled;
      combatActive = false;
      return { before, metOnSight, killed, felled };
    });
    ok('an unmet type has no file', filling.before === false);
    ok('meeting one opens it', filling.metOnSight === 1);
    ok('a kill is tallied once, not per hit', filling.killed === 1);
    ok('and what it costs you is on the file', filling.felled === 1);

    const perFight = await page.evaluate(() => {
      bestiary = {};
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const n = activeEntities.filter(e => !e.isPlayer).length;
      const met = bestiaryEntry('Raider').met;
      combatActive = false;
      return { n, met };
    });
    ok(`a fight of ${perFight.n} counts as one meeting, not ${perFight.n}`, perFight.met === 1);

    // ---- the file survives the run that wrote it ----
    const persist = await page.evaluate(() => {
      bestiary = { Raider: { met: 9, killed: 4, felled: 2 } };
      saveMeta();
      bestiary = {};
      loadMeta();
      const kept = bestiaryEntry('Raider');
      const raw = JSON.parse(Store.get(META_KEY));
      delete raw.bestiary;
      Store.set(META_KEY, JSON.stringify(raw));
      loadMeta();
      const legacy = Object.keys(bestiary).length;
      Store.set(META_KEY, JSON.stringify({ ...raw, bestiary: 'rubbish' }));
      loadMeta();
      const junk = Object.keys(bestiary).length;
      bestiary = {}; saveMeta();
      return { kept, legacy, junk };
    });
    ok('the file rides the meta save', persist.kept.met === 9 && persist.kept.killed === 4 && persist.kept.felled === 2);
    ok('a pre-bestiary save loads empty rather than breaking', persist.legacy === 0 && persist.junk === 0);

    // ---- the dossier says what it does ----
    const dossier = await page.evaluate(() => {
      bestiary = { Juggernaut: { met: 3, killed: 1, felled: 2 } };
      const html = dossierHtml('Juggernaut');
      const boss = dossierHtml(BOSS_POOL[0].name);
      const unknown = dossierHtml('Nobody At All');
      return {
        names: /JUGGERNAUT|Juggernaut/.test(html),
        sig: html.includes(ENEMY_SIGS.RIOT_PLATE.name) && html.includes(ENEMY_SIGS.RIOT_PLATE.desc),
        tally: /MET/.test(html) && html.includes('>3<') && html.includes('>1<') && html.includes('>2<'),
        resists: /PHYS/.test(html) && /BIO/.test(html) && /ENERGY/.test(html),
        weakness: /dos-weak/.test(html),
        boss: /WARLORD/.test(boss),
        unknown: /No file/.test(unknown)
      };
    });
    ok('the file names the hostile and its signature', dossier.names && dossier.sig);
    ok('carries the tally of met, killed and cost', dossier.tally);
    ok('and reads out its resistances, weaknesses marked', dossier.resists && dossier.weakness);
    ok('warlords file as warlords, strangers as no file', dossier.boss && dossier.unknown);

    // ---- tapping a hostile, but never while aiming ----
    const tap = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const hero = playerRoster.find(p => p.gridPos > 0);
      activeIndex = turnQueue.indexOf(hero);
      pendingAction = null; renderField();
      const foe = activeEntities.find(e => !e.isPlayer);
      const card = document.getElementById(foe.id);
      const idle = { cls: card.className.includes('inspectable'), act: card.dataset.action };
      // aiming turns the same card back into a target
      pendingAction = 'SCRAP_BLADE'; renderField();
      const aiming = document.getElementById(foe.id);
      const aimed = { cls: aiming.className.includes('targetable-enemy'), act: aiming.dataset.action,
                      notInspectable: !aiming.className.includes('inspectable') };
      // operators are never inspectable
      const heroCard = document.getElementById(hero.id);
      const heroClean = heroCard.dataset.action !== 'inspect';
      pendingAction = null; renderField();
      combatActive = false;
      return { idle, aimed, heroClean };
    });
    ok('an idle hostile invites a tap', tap.idle.cls && tap.idle.act === 'inspect');
    ok('aiming turns it back into a target', tap.aimed.cls && tap.aimed.act === 'target' && tap.aimed.notInspectable);
    ok('and operators are never files', tap.heroClean);

    // ---- the panel opens, and closes when it should ----
    const panel = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      pendingAction = null; renderField();
      const foe = activeEntities.find(e => !e.isPlayer);
      document.getElementById(foe.id).click();
      const el = document.getElementById('dossier');
      // The card uppercases through CSS, so innerText never matches the stored name's case.
      const opened = getComputedStyle(el).display === 'flex' &&
        el.innerText.toLowerCase().includes(typeNameOf(foe).toLowerCase());
      document.querySelector('[data-action="dossier-close"]').click();
      const closed = getComputedStyle(el).display === 'none' && inspecting === null;
      // it also gets out of the way when the squad starts aiming
      openDossier(foe.id);
      pendingAction = 'SCRAP_BLADE'; renderField();
      const yielded = inspecting === null && getComputedStyle(el).display === 'none';
      // and closes itself when its subject dies
      pendingAction = null; openDossier(foe.id);
      foe.hp = 0; renderField();
      const buried = inspecting === null;
      combatActive = false;
      return { opened, closed, yielded, buried };
    });
    ok('tapping opens the file over the fight', panel.opened);
    ok('and it closes on the way out', panel.closed);
    ok('aiming takes it off the screen', panel.yielded);
    ok('so does the death of its subject', panel.buried);

    // ---- a fresh fight starts with nothing open ----
    const fresh = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      const foe = activeEntities.find(e => !e.isPlayer);
      openDossier(foe.id);
      initiateCombat('BEASTS', false);
      const clean = inspecting === null;
      combatActive = false;
      return clean;
    });
    ok('a new fight starts with no file open', fresh);

    // ---- the manual keeps the same book, redacted until met ----
    const codex = await page.evaluate(() => {
      bestiary = {};
      const blind = CODEX.find(e => e.id === 'BESTIARY').body().join(' ');
      const hidden = !blind.includes('Juggernaut') && /NO FILE/.test(blind);
      bestiary = { Juggernaut: { met: 2, killed: 1, felled: 0 } };
      const known = CODEX.find(e => e.id === 'BESTIARY').body().join(' ');
      const shown = known.includes('Juggernaut') && known.includes(ENEMY_SIGS.RIOT_PLATE.name)
                 && /Met 2, killed 1/.test(known);
      const lines = CODEX.find(e => e.id === 'BESTIARY').body().length;
      bestiary = {}; saveMeta();
      // One line per hostile plus the book's own heading, derived rather than restated.
      return { hidden, shown, lines, expected: bestiaryRoster().length + 1 };
    });
    ok('the manual redacts what you have never met', codex.hidden);
    ok('and fills the entry in once you have', codex.shown);
    ok(`the book has a line for every hostile (${codex.lines - 1})`, codex.lines === codex.expected);
  }
};

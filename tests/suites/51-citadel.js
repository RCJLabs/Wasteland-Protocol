// Five upgrades, and skulls came in faster than the Citadel could spend them: once the Vault
// was open every further commander topped up a counter that added fifty starting scrap. The
// cost of each was also written three times - in the spot table, again in the buy handler and
// a third time in the markup, where the names had already drifted apart from the table's.
module.exports = {
  name: 'The Citadel, stocked',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // ---- one table, and everything reads it ----
    const table = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      const html = await (await fetch('index.html')).text();
      const shaped = CITADEL_SPOTS.every(sp => {
        if (!sp.kind || !sp.name || !(sp.cost > 0) || !sp.pitch) return false;
        if (typeof sp.level !== 'function' || typeof sp.apply !== 'function') return false;
        const top = sp.max === undefined ? 3 : sp.max;
        for (let l = 0; l <= top; l++) if (typeof sp.effect(l) !== 'string') return false;
        return true;
      });
      return {
        spots: CITADEL_SPOTS.map(s => s.kind), names: CITADEL_SPOTS.map(s => s.name), shaped,
        unique: new Set(CITADEL_SPOTS.map(s => s.kind)).size,
        uniqueNames: new Set(CITADEL_SPOTS.map(s => s.name)).size,
        // The old ledger was five hand-written cards carrying their own costs and names.
        markupCards: (html.match(/data-action="buy-meta"/g) || []).length,
        buyLiterals: (src.match(/bossSkulls >= \d/g) || []).length,
        needs: CITADEL_SPOTS.filter(s => s.needs).map(s => ({ kind: s.kind, needs: s.needs }))
      };
    });
    ok(`${table.spots.length} places to spend a skull, each with a price and a ceiling`,
      table.spots.length >= 8 && table.shaped && table.unique === table.spots.length);
    ok('no two of them share a name', table.uniqueNames === table.spots.length);
    ok('the ledger is built from the table rather than written out beside it',
      table.markupCards === 0);
    ok('and the price is not written a second time in the buy handler', table.buyLiterals === 0);
    ok(`every gate points at a real building (${table.needs.map(n => `${n.kind}<-${n.needs}`).join(', ')})`,
      table.needs.length >= 2 && table.needs.every(n => table.spots.includes(n.needs)));

    // ---- buying ----
    const buying = await page.evaluate(() => {
      const out = [];
      const career = careerWins; careerWins = 9;
      CITADEL_SPOTS.forEach(sp => {
        metaUpgrades = { startScrap: 0, startLevel: 1, invMax: 4, extraRegroups: 0, vault: 0, heirloom: null,
                         rerolls: 0, discount: 0, archive: 0, warRoom: 0, cache: 0,
                         chapel: 0, footlocker: 0, locker: null, roadCrew: 0 };
        // Stand up whatever it needs first, so the gate is not what is being measured here.
        if (sp.needs) CITADEL_SPOTS.find(o => o.kind === sp.needs).apply();
        bossSkulls = sp.cost;
        const before = sp.level();
        buyMetaUpgrade(sp.kind);
        out.push({ kind: sp.kind, rose: sp.level() === before + 1, spent: bossSkulls === 0 });
        // And refused outright with nothing banked.
        bossSkulls = 0;
        const at = sp.level();
        buyMetaUpgrade(sp.kind);
        out[out.length - 1].brokeIsRefused = sp.level() === at;
      });
      careerWins = career;
      return out;
    });
    ok('every building can be bought, and takes exactly its price',
      buying.every(b => b.rose && b.spent));
    ok('and none of them can be bought with nothing banked',
      buying.every(b => b.brokeIsRefused));
    if (buying.some(b => !b.rose)) console.log('        never rose: ' + buying.filter(b => !b.rose).map(b => b.kind).join(', '));

    const ceiling = await page.evaluate(() => {
      const capped = CITADEL_SPOTS.filter(s => s.max !== undefined);
      const career = careerWins; careerWins = 9;
      const rows = capped.map(sp => {
        metaUpgrades = { startScrap: 0, startLevel: 1, invMax: 4, extraRegroups: 0, vault: 0, heirloom: null,
                         rerolls: 0, discount: 0, archive: 0, warRoom: 0, cache: 0,
                         chapel: 0, footlocker: 0, locker: null, roadCrew: 0 };
        if (sp.needs) CITADEL_SPOTS.find(o => o.kind === sp.needs).apply();
        bossSkulls = sp.cost * (sp.max + 4);
        for (let i = 0; i < sp.max + 3; i++) buyMetaUpgrade(sp.kind);
        return { kind: sp.kind, at: sp.level(), max: sp.max, left: bossSkulls,
                 wasted: bossSkulls < sp.cost * 4 };
      });
      careerWins = career;
      return rows;
    });
    ok(`a building stops at its ceiling (${ceiling.map(c => `${c.kind} ${c.at}/${c.max}`).join(', ')})`,
      ceiling.every(c => c.at === c.max));
    ok('and a maxed one never takes another skull', ceiling.every(c => !c.wasted));

    // ---- the gates ----
    const gates = await page.evaluate(() => {
      const career = careerWins; careerWins = 9;
      const rows = CITADEL_SPOTS.filter(s => s.needs).map(sp => {
        metaUpgrades = { startScrap: 0, startLevel: 1, invMax: 4, extraRegroups: 0, vault: 0, heirloom: null,
                         rerolls: 0, discount: 0, archive: 0, warRoom: 0, cache: 0,
                         chapel: 0, footlocker: 0, locker: null, roadCrew: 0 };
        bossSkulls = sp.cost * 3;
        const sealedBefore = !spotUnlocked(sp);
        buyMetaUpgrade(sp.kind);
        const refused = sp.level() === 0 && bossSkulls === sp.cost * 3;
        const state = spotState(sp);
        CITADEL_SPOTS.find(o => o.kind === sp.needs).apply();
        const openNow = spotUnlocked(sp);
        buyMetaUpgrade(sp.kind);
        return { kind: sp.kind, sealedBefore, refused, state, openNow, built: sp.level() === 1 };
      });
      careerWins = career;
      return rows;
    });
    ok('a sealed building refuses the purchase and banks the skulls',
      gates.every(g => g.sealedBefore && g.refused));
    ok(`and says so rather than looking merely unaffordable (${gates.map(g => g.state).join(', ')})`,
      gates.every(g => g.state === 'SEALED'));
    ok('once its prerequisite is standing it can be built', gates.every(g => g.openNow && g.built));

    // ---- and each of them does the thing it promises ----
    const effects = await page.evaluate(() => {
      const wipe = () => { metaUpgrades = { startScrap: 0, startLevel: 1, invMax: 4, extraRegroups: 0, vault: 0,
                                            heirloom: null, rerolls: 0, discount: 0, archive: 0, warRoom: 0, cache: 0,
                                            chapel: 0, footlocker: 0, locker: null, roadCrew: 0 }; };
      currentSlot = 1; wipe(); confirmNewGame(1.0);

      wipe(); const rerollsBefore = (currentSlot = 1, confirmNewGame(1.0), musterRerolls);
      metaUpgrades.rerolls = 2; currentSlot = 1; confirmNewGame(1.0);
      const rerollsAfter = musterRerolls;

      wipe(); currentSector = 2; const fullPrice = shopPrice(100);
      metaUpgrades.discount = 2; const cutPrice = shopPrice(100);

      wipe(); const sealedFile = hasMet('Nothing In The Bestiary At All');
      metaUpgrades.archive = 1; const openFile = hasMet('Nothing In The Bestiary At All');

      wipe(); const slotsBefore = generateBounties().length;
      metaUpgrades.warRoom = 1; const slotsAfter = generateBounties().length;

      wipe(); currentSlot = 1; confirmNewGame(1.0); const bare = activeRelics.length;
      metaUpgrades.cache = 1; currentSlot = 1; confirmNewGame(1.0); const stocked = activeRelics.length;
      const named = activeRelics.map(r => r.name);
      wipe();
      return { rerollsBefore, rerollsAfter, fullPrice, cutPrice, sealedFile, openFile,
               slotsBefore, slotsAfter, bare, stocked, named };
    });
    ok(`the muster tent buys reroll tokens (${effects.rerollsBefore} -> ${effects.rerollsAfter})`,
      effects.rerollsAfter === effects.rerollsBefore + 2);
    ok(`the armory contract comes off the price (${effects.fullPrice} -> ${effects.cutPrice})`,
      effects.cutPrice < effects.fullPrice && effects.cutPrice >= 1);
    ok('the archive opens a file on something never met',
      !effects.sealedFile && effects.openFile);
    ok(`the war room adds a contract slot (${effects.slotsBefore} -> ${effects.slotsAfter})`,
      effects.slotsAfter === effects.slotsBefore + 1);
    ok(`and the cache deploys holding one (${effects.bare} -> ${effects.stocked}: ${effects.named.join(', ')})`,
      effects.stocked === effects.bare + 1);

    // ---- the ledger is the Citadel, and all of it can be reached ----
    const views = await page.evaluate(() => {
      bossSkulls = 40; renderCitadel();
      const L = document.getElementById('citadel-list');
      const cards = [...L.querySelectorAll('.upgrade-card')];
      const costs = [...L.querySelectorAll('.upg-btn')].map(b => (b.innerText.match(/(\d+)\s*💀/) || [])[1]);
      const declared = CITADEL_SPOTS.map(s => String(s.cost));
      L.scrollTop = L.scrollHeight;
      const last = cards[cards.length - 1].getBoundingClientRect(), box = L.getBoundingClientRect();
      const btnH = [...L.querySelectorAll('.upg-btn')].map(b => b.getBoundingClientRect().height);
      return { cards: cards.length, costs, declared,
               scrolls: L.scrollHeight > L.clientHeight,
               lastReachable: last.bottom <= box.bottom + 2,
               floor: Math.min(...btnH),
               sealed: [...L.querySelectorAll('.upg-sealed')].length };
    });
    ok(`the ledger lists every building (${views.cards})`, views.cards === table.spots.length);
    ok('at the price the table declares', views.costs.every((c, i) => c === undefined || c === views.declared[i]));
    ok(`and scrolls to the last of them (${Math.round(views.floor)}px buttons)`,
      views.scrolls && views.lastReachable && views.floor >= 44);

    // ---- what is built survives ----
    await page.evaluate(() => {
      metaUpgrades.archive = 1; metaUpgrades.rerolls = 2; metaUpgrades.discount = 1;
      bossSkulls = 12; saveMeta();
    });
    await page.reload();
    await page.waitForTimeout(600);
    const kept = await page.evaluate(() => {
      loadMeta();
      return { archive: metaUpgrades.archive, rerolls: metaUpgrades.rerolls,
               discount: metaUpgrades.discount, skulls: bossSkulls };
    });
    ok(`the hill stands between sessions (archive ${kept.archive}, rerolls ${kept.rerolls}, ${kept.skulls} skulls)`,
      kept.archive === 1 && kept.rerolls === 2 && kept.discount === 1 && kept.skulls === 12);

    const manual = await page.evaluate(() => {
      const text = CODEX.map(e => e.body().join(' ')).join(' ');
      return /Citadel/.test(text) && text.includes(String(CITADEL_SPOTS.length));
    });
    ok('and the manual counts what is up there', manual);
  }
};

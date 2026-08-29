// Seventeen interlocking systems and nothing ever taught one of them. These fire once, ever,
// at the moment their system first matters - and the player can shut them off for good.
module.exports = {
  name: 'First contact',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    // The harness runs every suite with onboarding off so a teaching card never sits over a
    // control another suite is driving. This is the one suite that wants it on.
    await page.evaluate(() => {
      globalSettings.prompts = true;
      Store.set(SETTINGS_KEY, JSON.stringify(globalSettings));
    });

    const reset = () => page.evaluate(() => {
      seenPrompts = []; promptQueue = [];
      globalSettings.prompts = true;
      Store.set(SETTINGS_KEY, JSON.stringify(globalSettings));
      renderPrompt();
    });

    // ---- the table ----
    const table = await page.evaluate(() => ({
      total: PROMPTS.length,
      ids: new Set(PROMPTS.map(p => p.id)).size,
      written: PROMPTS.every(p => p.title && p.body && p.body.length > 60),
      shouty: PROMPTS.filter(p => p.title !== p.title.toUpperCase()).map(p => p.id)
    }));
    ok(`${table.total} prompts, each with a unique id`, table.total === 15 && table.ids === 15);
    ok('each says something worth reading', table.written);
    ok('and titles are titles', table.shouty.length === 0);

    // every prompt is actually reachable from the engine
    const wired = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      // A plain substring beats a regex here: the escaping needed to survive the layers between
      // this file and the page is exactly where the last version of this check went wrong.
      return PROMPTS.filter(p => !src.includes("firePrompt('" + p.id + "')")).map(p => p.id);
    });
    ok('every prompt has a trigger in the engine', wired.length === 0);
    if (wired.length) console.log('        unreachable:', wired.join(', '));

    // ---- fires once, ever ----
    await reset();
    const once = await page.evaluate(() => {
      firePrompt('COMBO');
      const queued = promptQueue.length;
      firePrompt('COMBO'); firePrompt('COMBO');
      const noDupes = promptQueue.length === 1;
      const shown = getComputedStyle(document.getElementById('prompt')).display === 'flex';
      document.querySelector('[data-action="prompt-ok"]').click();
      const gone = getComputedStyle(document.getElementById('prompt')).display === 'none';
      const remembered = promptSeen('COMBO');
      firePrompt('COMBO');
      const staysGone = promptQueue.length === 0 &&
        getComputedStyle(document.getElementById('prompt')).display === 'none';
      return { queued, noDupes, shown, gone, remembered, staysGone };
    });
    ok('a trigger raises the prompt', once.queued === 1 && once.shown);
    ok('firing it again while queued adds nothing', once.noDupes);
    ok('dismissing clears it and remembers', once.gone && once.remembered);
    ok('and it never returns', once.staysGone);

    // ---- several at once queue rather than pile up ----
    await reset();
    const queueing = await page.evaluate(() => {
      firePrompt('COMBO'); firePrompt('REACH'); firePrompt('MOMENTUM');
      const depth = promptQueue.length;
      const first = document.querySelector('.prompt-title').innerText;
      document.querySelector('[data-action="prompt-ok"]').click();
      const second = document.querySelector('.prompt-title').innerText;
      document.querySelector('[data-action="prompt-ok"]').click();
      document.querySelector('[data-action="prompt-ok"]').click();
      const drained = promptQueue.length === 0 &&
        getComputedStyle(document.getElementById('prompt')).display === 'none';
      return { depth, first, second, drained, seen: seenPrompts.length };
    });
    ok('three triggers queue three deep, one on screen', queueing.depth === 3 && queueing.first !== queueing.second);
    ok('and they drain in order, each remembered', queueing.drained && queueing.seen === 3);

    // ---- the player can shut them off for good ----
    await reset();
    const off = await page.evaluate(() => {
      firePrompt('COMBO');
      document.querySelector('[data-action="prompt-off"]').click();
      const cleared = promptQueue.length === 0 &&
        getComputedStyle(document.getElementById('prompt')).display === 'none';
      firePrompt('REACH'); firePrompt('MOMENTUM');
      const stayQuiet = promptQueue.length === 0;
      const stored = JSON.parse(Store.get(SETTINGS_KEY)).prompts === false;
      const label = document.getElementById('btn-toggle-prompts').innerText;
      // and back on from settings
      document.querySelector('[data-action="toggle-prompts"]').click();
      firePrompt('REACH');
      const backOn = promptQueue.length === 1 &&
        document.getElementById('btn-toggle-prompts').innerText.includes('ON');
      return { cleared, stayQuiet, stored, label, backOn };
    });
    ok('stopping them clears the one on screen', off.cleared);
    ok('and nothing fires afterwards', off.stayQuiet && off.stored);
    ok(`settings shows the state (${off.label}) and turns them back on`,
      /OFF/.test(off.label) && off.backOn);

    // ---- what is seen rides the meta save ----
    await reset();
    const persist = await page.evaluate(() => {
      seenPrompts = ['COMBO', 'REACH']; saveMeta();
      seenPrompts = []; loadMeta();
      const kept = seenPrompts.slice().sort().join();
      const raw = JSON.parse(Store.get(META_KEY));
      delete raw.seenPrompts; Store.set(META_KEY, JSON.stringify(raw)); loadMeta();
      const legacy = seenPrompts.length;
      Store.set(META_KEY, JSON.stringify({ ...raw, seenPrompts: 'nonsense' })); loadMeta();
      const junk = seenPrompts.length;
      seenPrompts = []; saveMeta();
      return { kept, legacy, junk };
    });
    ok('what has been taught rides the meta save', persist.kept === 'COMBO,REACH');
    ok('a save from before them teaches everything afresh', persist.legacy === 0 && persist.junk === 0);

    // ---- they fire where the systems actually are ----
    await reset();
    const inPlay = await page.evaluate(() => {
      const fired = () => promptQueue.concat(seenPrompts);
      activeContracts = []; currentSlot = 1; pendingDifficulty = 1.0; beginExpedition();
      const atMuster = fired().includes('MUSTER');
      seenPrompts = [...new Set(fired())]; promptQueue = []; renderPrompt();
      musterDeploy();
      const onMap = fired().includes('ROUTE');
      seenPrompts = [...new Set(fired())]; promptQueue = []; renderPrompt();
      initiateCombat('RAIDERS', false);
      const inFight = { intent: fired().includes('INTENT'), sig: fired().includes('SIGNATURE') };
      seenPrompts = [...new Set(fired())]; promptQueue = []; renderPrompt();
      const hero = playerRoster.find(p => p.gridPos > 0);
      activeIndex = turnQueue.indexOf(hero); pendingAction = null;
      momentum = 100; renderCommandDeck();
      const atBar = { momentum: fired().includes('MOMENTUM'), overdrive: fired().includes('OVERDRIVE') };
      combatActive = false;
      return { atMuster, onMap, inFight, atBar };
    });
    ok('the muster teaches the muster', inPlay.atMuster);
    ok('a forking map teaches routing', inPlay.onMap);
    ok('the first fight teaches intents and signatures', inPlay.inFight.intent && inPlay.inFight.sig);
    ok('a full bar teaches the market and the overdrive', inPlay.atBar.momentum && inPlay.atBar.overdrive);

    await reset();
    const screens = await page.evaluate(() => {
      const fired = () => promptQueue.concat(seenPrompts);
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const ch = playerRoster[0]; ch.perkPoints = 1;
      pendingPerkOffers = [{ charId: ch.id, options: rollPerkOffer(ch) }];
      renderPerkOffer();
      const promo = fired().includes('PROMOTION');
      pendingRelicOffer = [RELIC_POOL.find(r => r.tier === 'CURSED'), RELIC_POOL[0]];
      renderRelicOffer();
      const cache = { relic: fired().includes('RELIC'), curse: fired().includes('CURSE') };
      pendingRelicOffer = null;
      activeShop = { nodeId: 'x', stock: rollShopStock() }; renderShop();
      const shop = fired().includes('ARMORY');
      activeShop = null;
      renderSquadBroken();
      const broke = fired().includes('REGROUP');
      return { promo, cache, shop, broke };
    });
    ok('a level-up teaches promotions', screens.promo);
    ok('the cache teaches relics, and a cursed card its own warning', screens.cache.relic && screens.cache.curse);
    ok('the Armory and the first wipe teach themselves', screens.shop && screens.broke);

    // ---- a clean cache never fires the curse warning ----
    await reset();
    const noCurse = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      pendingRelicOffer = RELIC_POOL.filter(r => r.tier !== 'CURSED').slice(0, 3);
      renderRelicOffer();
      const out = !promptQueue.concat(seenPrompts).includes('CURSE');
      pendingRelicOffer = null;
      return out;
    });
    ok('an ordinary cache says nothing about curses', noCurse);

    // ---- the card never blocks the fight underneath it ----
    const clickThrough = await page.evaluate(() => {
      seenPrompts = []; promptQueue = []; globalSettings.prompts = true;
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      initiateCombat('RAIDERS', false);
      firePrompt('COMBO');
      const container = getComputedStyle(document.getElementById('prompt')).pointerEvents;
      const card = getComputedStyle(document.querySelector('.prompt-card')).pointerEvents;
      combatActive = false;
      return { container, card };
    });
    ok('the prompt layer lets clicks through', clickThrough.container === 'none');
    ok('while its own card still takes them', clickThrough.card === 'auto');

    await page.evaluate(() => { seenPrompts = []; promptQueue = []; globalSettings.prompts = false;
      Store.set(SETTINGS_KEY, JSON.stringify(globalSettings)); saveMeta(); renderPrompt(); });
  }
};

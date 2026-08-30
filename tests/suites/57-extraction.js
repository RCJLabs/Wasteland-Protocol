// Sixty simulated expeditions ended sixty times the same way: the squad was wiped out. There
// was no other ending in the game. A run could be long or short and never won, and no decision
// anywhere in it was ever "is this enough?" - depth was something that happened to you rather
// than a bet you were sizing.
//
// You can call it at a camp now. The whole design is one trade, so most of this suite is about
// whether that trade is real: banking has to be worth something, pushing has to be worth more
// while you are shallow, and everything the panel promises has to actually arrive.
module.exports = {
  name: 'Walking out',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.__run = (sec, tier = 5) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = sec; currentTier = tier; noteDepth();
        runStats.kills = sec * 18; runStats.bosses = Math.max(0, sec - 1);
        runStats.elites = sec; runStats.scrapEarned = sec * 500; runStats.nodes = sec * 9;
        return runStats;
      };
    });

    // ---- the offer ----
    const gate = await page.evaluate(() => {
      const at = s => { window.__run(s); return canExtract(); };
      const shallow = at(1), deep = at(3);
      window.__run(3);
      combatActive = true; const inFight = canExtract(); combatActive = false;
      return { shallow, deep, inFight, min: EXTRACT.minSector };
    });
    ok(`the road out opens from sector ${gate.min}, not before`, !gate.shallow && gate.deep);
    ok('and never in the middle of a fight', !gate.inFight);

    // ---- the trade ----
    const curve = await page.evaluate(() => {
      const rows = [];
      for (let s = 1; s <= 8; s++) {
        window.__run(s);
        const raw = computeScore({ ...runStats, extracted: false });
        const out = computeScore({ ...runStats, extracted: true });
        rows.push({ s, raw, out, gain: out - raw, pct: extractBonus(runStats), skulls: extractSkulls(runStats) });
      }
      const push = rows.map((r, i) => i < rows.length - 1 ? rows[i + 1].raw - r.raw : null);
      return { rows, push, cap: EXTRACT.maxBonus };
    });
    ok('walking out of the first sector banks no bonus at all', curve.rows[0].gain === 0);
    ok('the bonus grows with every sector reached',
      curve.rows.every((r, i) => i === 0 || r.pct > curve.rows[i - 1].pct || r.pct === curve.cap));
    ok(`and stops at the cap (${Math.round(curve.cap * 100)}%)`, curve.rows.every(r => r.pct <= curve.cap + 1e-9));
    ok('a skull for every sector cleared', curve.rows.every(r => r.skulls === r.s - 1));
    // The whole point: shallow, pushing has to beat banking, or nobody ever goes anywhere.
    const shallow = curve.rows.slice(1, 4);
    ok(`while the run is shallow, pushing is worth more than banking (${shallow.map((r, i) => (r.gain / curve.push[i + 1]).toFixed(2)).join(', ')}x)`,
      shallow.every((r, i) => r.gain < curve.push[i + 1]));
    // ...and deep, banking has to start winning, or extraction is a button nobody presses.
    const deep = curve.rows.slice(5, 8);
    ok('and deep, banking starts to win', deep.every((r, i) => r.gain > curve.push[i + 5]));
    const cross = curve.rows.findIndex((r, i) => i > 0 && i < curve.push.length && r.gain >= curve.push[i]);
    ok(`so the bet turns over somewhere in the middle of a run (sector ${curve.rows[cross].s})`,
      cross > 2 && cross < 7);

    // ---- what actually arrives ----
    const banked = await page.evaluate(() => {
      window.__run(4);
      activeRelics = [RELIC_POOL.find(r => r.tier === 'RARE')];
      metaUpgrades.vault = 0; metaUpgrades.heirloom = null; metaUpgrades.heirloomWalked = false;
      bossSkulls = 0; bestScore = 0;
      const expect = { score: computeScore({ ...runStats, extracted: true }),
                       skulls: extractSkulls(runStats), relic: activeRelics[0].id };
      extractRun();
      return { expect, skulls: bossSkulls, best: bestScore,
               heirloom: metaUpgrades.heirloom,
               // the promise is that it comes home, which means the next run can read it
               readable: heirloomRelic() ? heirloomRelic().id : null,
               title: document.getElementById('runover-title').innerText,
               frame: document.getElementById('runover-box').style.borderColor,
               saveGone: Store.getJSON(BASE_SAVE_KEY + 1) === null || Store.getJSON(BASE_SAVE_KEY + 1) === undefined };
    });
    ok(`the skulls arrive (${banked.skulls})`, banked.skulls === banked.expect.skulls);
    ok(`the score banks with the bonus on it (${banked.best})`, banked.best === banked.expect.score);
    ok('the relic is carried home', banked.heirloom === banked.expect.relic);
    ok('and the next expedition can actually pick it up without owning the Vault',
      banked.readable === banked.expect.relic);
    ok('the run ends', banked.saveGone);

    // Skulls and a carried relic are only worth anything if they are still there next session.
    const persisted = await page.evaluate(() => {
      bossSkulls = 0; metaUpgrades = { ...metaUpgrades, heirloom: null, heirloomWalked: false };
      loadMeta();
      return { skulls: bossSkulls, relic: heirloomRelic() ? heirloomRelic().id : null };
    });
    ok('and what it banked is still there after a reload',
      persisted.skulls === banked.expect.skulls && persisted.relic === banked.expect.relic);

    // A wipe is still a wipe: no bonus, no skulls, and the relic stays in the dirt.
    const died = await page.evaluate(() => {
      window.__run(4);
      activeRelics = [RELIC_POOL.find(r => r.tier === 'RARE')];
      metaUpgrades.vault = 0; metaUpgrades.heirloom = null; metaUpgrades.heirloomWalked = false;
      bossSkulls = 0; bestScore = 0;
      const raw = computeScore({ ...runStats, extracted: false });
      endRun();
      return { raw, skulls: bossSkulls, best: bestScore, kept: heirloomRelic(),
               title: document.getElementById('runover-title').innerText,
               frame: document.getElementById('runover-box').style.borderColor };
    });
    ok('dying banks the raw figure and no more', died.best === died.raw);
    ok('with nothing extra for the Citadel', died.skulls === 0);
    ok('and the relic left where it fell', died.kept === null);
    ok(`the two endings read differently (${died.title} / ${banked.title})`,
      died.title !== banked.title && banked.title === 'EXTRACTED');
    // A red box around EXTRACTED would read as a defeat whatever the headline said.
    ok(`and the frame agrees with the headline (${died.frame} / ${banked.frame})`,
      !!died.frame && !!banked.frame && died.frame !== banked.frame);

    // The Vault is still worth buying: it is what keeps one when you do not walk out.
    const vault = await page.evaluate(() => {
      window.__run(4);
      activeRelics = [RELIC_POOL.find(r => r.tier === 'RARE')];
      metaUpgrades.vault = 1; metaUpgrades.heirloom = null; metaUpgrades.heirloomWalked = false;
      endRun();
      return heirloomRelic() ? heirloomRelic().id : null;
    });
    ok('and the Vault still keeps one through a wipe, which is what it is for', !!vault);

    // ---- the camp says what it is worth, and asks twice ----
    const camp = await page.evaluate(() => {
      window.__run(4); currentNodeId = 'n5_1';
      initiateCamp();
      const listed = document.getElementById('camp-choices').innerText;
      const offered = !!document.querySelector('[data-action="camp-extract"]');
      armExtract();
      const armedTxt = document.getElementById('camp-choices').innerText;
      const commit = !!document.querySelector('[data-action="camp-extract-go"]');
      const stillThere = !!document.querySelector('[data-action="camp-choice"]');
      armExtract();   // stay on the road
      const backOut = !!document.querySelector('[data-action="camp-choice"]')
        && !document.querySelector('[data-action="camp-extract-go"]');
      const p = extractPitch();
      return { listed, offered, armedTxt, commit, stillThere, backOut, p };
    });
    ok('a camp offers the road out alongside the other three', camp.offered);
    ok('priced on the button rather than described', camp.listed.includes(String(camp.p.skulls)));
    ok('the first press arms it rather than ending the run', camp.commit && !camp.stillThere);
    ok('the panel says what is banked, what the Citadel gets and what comes home',
      camp.armedTxt.includes('SCORE') && camp.armedTxt.includes('CITADEL') && camp.armedTxt.includes('CARRIED HOME'));
    ok('and it says there is no coming back', /no coming back/i.test(camp.armedTxt));
    ok('backing out returns to the camp with the run intact', camp.backOut);

    const locked = await page.evaluate(() => {
      window.__run(1); currentNodeId = 'n5_1';
      initiateCamp();
      const txt = document.getElementById('camp-choices').innerText;
      return { offered: !!document.querySelector('[data-action="camp-extract"]'), txt };
    });
    ok('in the first sector it says why it is not on offer',
      !locked.offered && /road out opens/i.test(locked.txt));

    // ---- the record knows the difference ----
    const chron = await page.evaluate(() => {
      Store.remove(chronicleKey());
      window.__run(4); activeRelics = []; extractRun();
      window.__run(3); activeRelics = []; endRun();
      const log = readChronicle();
      renderChronicle();
      return { walked: log.find(e => e.extracted), died: log.find(e => !e.extracted), n: log.length,
               marked: document.querySelectorAll('.chronicle-walked').length,
               rows: document.querySelectorAll('.chronicle-entry').length };
    });
    ok('the chronicle records both endings', chron.n === 2 && !!chron.walked && !!chron.died);
    ok('and the list shows which is which without reading the text',
      chron.marked === 1 && chron.rows === 2);
    ok(`and a run that was walked out of does not get an epitaph (${chron.walked.epitaph})`,
      /walked out/i.test(chron.walked.epitaph) && !/walked out/i.test(chron.died.epitaph));

    const summary = await page.evaluate(() => {
      window.__run(5); activeRelics = []; extractRun();
      return document.getElementById('runover-lines').innerText;
    });
    ok('the run-over names what walking out was worth', /WALKED OUT WITH/.test(summary));

    // ---- a fresh expedition is a fresh expedition ----
    const fresh = await page.evaluate(() => {
      window.__run(4); extractRun();
      const mid = runStats.extracted;
      buildNewRun(1.0);
      return { mid, after: !!runStats.extracted, armed: extractArmed };
    });
    ok('the next expedition does not start already walked out', fresh.mid && !fresh.after && !fresh.armed);
  }
};

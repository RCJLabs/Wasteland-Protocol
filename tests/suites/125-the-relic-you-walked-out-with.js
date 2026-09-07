// G03. Walking out with a relic armed every run afterwards, for the rest of the career.
//
// Two doors keep a relic across the wipe and they are not the same door. The Vault banks one:
// it re-reads what you were holding at every run's end, so it is refreshed, and it is a
// building you buy. Walking out keeps one because you are physically carrying it - which had
// to be remembered separately, since heirloomRelic gates on the Vault and would otherwise
// store a relic no Vault-less player could collect.
//
// The remembering had no forgetting. stashHeirloom returns early for a player without the
// Vault, so a wipe could never overwrite what an extraction wrote, and nothing else cleared
// it. One successful walk-out and every run after it opened with that relic - the Vault's
// whole function, free, from a building the player does not own. Carried now, and spent by the
// run that receives it.
module.exports = {
  name: 'The relic you walked out with',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      window.__career = vault => {
        currentSlot = 1; confirmNewGame(1.0);
        metaUpgrades.vault = vault; metaUpgrades.cache = 0;
        metaUpgrades.heirloom = null; metaUpgrades.heirloomWalked = false;
        saveMeta();
      };
      // End a run the way the engine does, then start the next one the way it does.
      window.__endRun = (holding, walked) => {
        activeRelics = holding ? [holding] : [];
        runStats = runStats || {}; runStats.extracted = !!walked;
        stashHeirloom(!!walked);
      };
      window.__nextRun = () => { buildNewRun(); return activeRelics.map(r => r.id); };
    });

    // ── Walking out carries it into the next run ───────────────────────────────────
    const carried = await page.evaluate(() => {
      window.__career(0);
      const relic = RELIC_POOL.find(r => r.tier === 'COMMON');
      window.__endRun(relic, true);
      return { relic: relic.id, armed: !!heirloomRelic(),
               opensWith: window.__nextRun() };
    });
    ok(`a relic you walked out with arms the next run (${carried.opensWith.join(', ') || 'nothing'})`,
      carried.armed === true && carried.opensWith.join() === carried.relic);

    // ── And is spent there, not banked ─────────────────────────────────────────────
    const spent = await page.evaluate(() => {
      window.__career(0);
      const relic = RELIC_POOL.find(r => r.tier === 'COMMON');
      window.__endRun(relic, true);
      const runs = [window.__nextRun()];
      // Wipes from here on, holding nothing. A Vault-less career banks nothing.
      for (let i = 0; i < 3; i++) { window.__endRun(null, false); runs.push(window.__nextRun()); }
      return { relic: relic.id, runs, flag: metaUpgrades.heirloomWalked, held: metaUpgrades.heirloom };
    });
    ok(`the run after that opens with nothing (${spent.runs.map(r => r.join('+') || '—').join(' | ')})`,
      spent.runs[0].join() === spent.relic && spent.runs.slice(1).every(r => r.length === 0));
    ok('with the flag cleared and nothing left held', spent.flag === false && spent.held === null);

    // ── Walking out again arms it again ────────────────────────────────────────────
    const twice = await page.evaluate(() => {
      window.__career(0);
      const a = RELIC_POOL.find(r => r.tier === 'COMMON');
      const b = RELIC_POOL.filter(r => r.tier === 'COMMON')[1];
      window.__endRun(a, true);  const first = window.__nextRun();
      window.__endRun(null, false); const gap = window.__nextRun();
      window.__endRun(b, true);  const second = window.__nextRun();
      return { a: a.id, b: b.id, first, gap, second };
    });
    ok(`earning it again arms it again (${twice.first.join()} → ${twice.gap.join() || 'nothing'} → ${twice.second.join()})`,
      twice.first.join() === twice.a && twice.gap.length === 0 && twice.second.join() === twice.b);

    // ── The Vault is the one that banks, and still does ────────────────────────────
    const vault = await page.evaluate(() => {
      window.__career(1);
      const relic = RELIC_POOL.find(r => r.tier === 'RARE');
      window.__endRun(relic, false);                   // died holding it
      const runs = [window.__nextRun()];
      // It re-reads what you were holding at every run's end - that is what makes it a bank
      // rather than a leak. Wiping while holding it keeps it.
      window.__endRun(relic, false); runs.push(window.__nextRun());
      return { relic: relic.id, runs, held: metaUpgrades.heirloom };
    });
    ok(`the Vault keeps what you died holding, run after run (${vault.runs.map(r => r.join('+')).join(' | ')})`,
      vault.runs.every(r => r.join() === vault.relic));

    // ── But only what you were actually holding ────────────────────────────────────
    const empties = await page.evaluate(() => {
      window.__career(1);
      const relic = RELIC_POOL.find(r => r.tier === 'RARE');
      window.__endRun(relic, false); const armed = window.__nextRun();
      window.__endRun(null, false);  const empty = window.__nextRun();
      return { armed, empty, held: metaUpgrades.heirloom, desc: vaultDescText() };
    });
    ok(`and empties when a run finds nothing (${empties.empty.join() || 'nothing'})`,
      empties.armed.length === 1 && empties.empty.length === 0 && empties.held === null);
    ok(`saying so on the Citadel (${empties.desc})`, /bank one here|Unlocked/.test(empties.desc));

    // ── Walking out while owning the Vault does not empty the Vault ────────────────
    const both = await page.evaluate(() => {
      window.__career(1);
      const relic = RELIC_POOL.find(r => r.tier === 'RARE');
      window.__endRun(relic, true);                    // walked out, and owns the bank
      const first = window.__nextRun();
      // Read before the wipe: spending the walked flag must not empty the bank underneath it.
      const desc = vaultDescText();
      const held = metaUpgrades.heirloom;
      window.__endRun(null, false);                    // then a wipe holding nothing
      return { relic: relic.id, first, held, desc,
               walked: metaUpgrades.heirloomWalked };
    });
    ok(`a walk-out by a Vault owner still banks (${both.first.join()})`,
      both.first.join() === both.relic && both.walked === false);
    ok(`and the Citadel still reads the Vault as holding it (${both.desc})`,
      both.held === both.relic && /Holding/.test(both.desc));

    // ── What the career file carries between sessions ──────────────────────────────
    const persists = await page.evaluate(() => {
      window.__career(0);
      const relic = RELIC_POOL.find(r => r.tier === 'COMMON');
      window.__endRun(relic, true);
      saveMeta(); loadMeta();
      const acrossSession = !!heirloomRelic();
      const opened = window.__nextRun();
      // loadMeta ONLY - no saveMeta of our own. Writing the file here would hide a spend that
      // the engine never wrote, which is exactly the defect this asserts against: a player who
      // closes the game the moment a run starts would be handed the relic a second time.
      loadMeta();
      return { acrossSession, opened, afterSpending: !!heirloomRelic(),
               flag: metaUpgrades.heirloomWalked };
    });
    ok('the carried relic survives closing the game before it is spent', persists.acrossSession === true);
    ok(`and is gone from the career file once it has been (${persists.opened.join()})`,
      persists.opened.length === 1 && persists.afterSpending === false && persists.flag === false);
  }
};

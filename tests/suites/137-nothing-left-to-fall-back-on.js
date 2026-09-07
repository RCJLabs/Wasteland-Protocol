// H01, from the audit at c4364e6. The SQUAD BROKEN screen offers two buttons. With fallbacks
// left they do different things. With none left they did the SAME thing, and one of them was
// labelled as if it did not: regroupSquad guards with `if (regroupsLeft() <= 0) { endRun();
// return; }`, so pressing REGROUP (0 LEFT) did not fail quietly - it ended the expedition, with
// no confirmation, under a label that reads as the way to carry on. Driven at the engine:
// SQUAD BROKEN became RUN OVER, "The wasteland claimed them."
//
// The convention it needed already existed everywhere else. Swept across their edge states, the
// Citadel disables 13 controls it cannot honour and relabels them MAXED or BUILT, and the
// Outpost disables 21 the purse will not cover. 34 controls, and the one that ends an
// expedition was not among them.
//
// This suite holds the shape of the screen at both ends, and the guard underneath it - because
// the guard is what made the defect quiet rather than loud, and removing the button without
// keeping the guard would trade a mislabelled door for a crash on the keyboard path.
module.exports = {
  name: 'Nothing left to fall back on',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    const broken = await page.evaluate(async () => {
      const stage = n => {
        currentSlot = 1; confirmNewGame(1.0);
        currentSector = 3; currentTier = 5;
        runStats.regroups = n;
        playerRoster.forEach(c => { if (c.gridPos > 0) c.hp = 0; });
        renderSquadBroken();
        const el = document.getElementById('screen-runover');
        return {
          left: regroupsLeft(),
          title: document.getElementById('runover-title').innerText.trim(),
          desc: document.getElementById('runover-desc').innerText.replace(/\s+/g, ' '),
          btns: [...el.querySelectorAll('[data-action]')].map(b => ({
            act: b.getAttribute('data-action'),
            text: (b.innerText || '').trim(),
            disabled: !!b.disabled
          }))
        };
      };
      return { some: stage(2), none: stage(0) };
    });

    const regroupOf = s => s.btns.find(b => b.act === 'regroup');
    const endOf = s => s.btns.find(b => b.act === 'end-run');

    // ── With something to fall back on ───────────────────────────────────────────
    ok(`with fallbacks left the screen still offers both (${broken.some.btns.map(b => b.text).join(' | ')})`,
      broken.some.btns.length === 2 && !!regroupOf(broken.some) && !!endOf(broken.some));
    ok(`and the regroup is live, counting what is left (${regroupOf(broken.some).text})`,
      regroupOf(broken.some).disabled === false && /2/.test(regroupOf(broken.some).text));
    ok('the description still names the price of taking it',
      /costs half your scrap|Bond covers/.test(broken.some.desc));

    // ── With none ────────────────────────────────────────────────────────────────
    ok(`with none left the regroup is disabled (${regroupOf(broken.none).text})`,
      regroupOf(broken.none).disabled === true);
    ok(`and no longer says a verb it cannot perform (${regroupOf(broken.none).text})`,
      !/^REGROUP/.test(regroupOf(broken.none).text));
    ok('the way out is still live beside it',
      endOf(broken.none) && endOf(broken.none).disabled === false);
    ok(`and the screen stops describing a regroup that cannot happen (${broken.none.desc.slice(0, 60)}...)`,
      !/costs half your scrap/.test(broken.none.desc) && /nothing left to fall back on/.test(broken.none.desc));

    // ── The guard underneath, which is what kept it quiet ────────────────────────
    // Disabling a button is a fact about the DOM. The keyboard, a replayed action and a stale
    // save all reach the handler without it, so the guard has to hold on its own.
    const guarded = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      currentSector = 3; currentTier = 5;
      runStats.regroups = 0;
      playerRoster.forEach(c => { if (c.gridPos > 0) c.hp = 0; });
      renderSquadBroken();
      const before = { scrap, sector: currentSector, title: document.getElementById('runover-title').innerText.trim() };
      let threw = null;
      try { regroupSquad(); } catch (e) { threw = e.message; }
      return { before, threw,
               after: { scrap, sector: currentSector,
                        title: document.getElementById('runover-title').innerText.trim() } };
    });
    ok(`calling it anyway does not throw (${guarded.threw || 'no throw'})`, guarded.threw === null);
    ok(`it ends the run rather than half-regrouping (${guarded.before.title} -> ${guarded.after.title})`,
      guarded.after.title === 'RUN OVER');
    ok(`and charges nothing for a fallback it did not give (${guarded.before.scrap} -> ${guarded.after.scrap})`,
      guarded.after.scrap === guarded.before.scrap);
    ok(`nor moves the squad back a sector (${guarded.before.sector} -> ${guarded.after.sector})`,
      guarded.after.sector === guarded.before.sector);

    // ── The convention this was the exception to ─────────────────────────────────
    // Named rather than described: if the Citadel ever stops disabling what it cannot sell,
    // the argument for this fix has gone and somebody should know.
    const elsewhere = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0);
      bossSkulls = 0;
      renderCitadel();
      const cit = [...document.querySelectorAll('#screen-citadel [data-action]')];
      scrap = 0; materials = { parts: 0, chems: 0, tech: 0 };
      renderOutpost();
      const out = [...document.querySelectorAll('#screen-outpost [data-action]')];
      const off = list => list.filter(b => b.disabled).length;
      return { citadel: off(cit), outpost: off(out) };
    });
    ok(`the Citadel disables what it cannot sell (${elsewhere.citadel} controls at nought skulls)`,
      elsewhere.citadel > 5);
    ok(`and the Outpost what the purse will not cover (${elsewhere.outpost} at nought scrap)`,
      elsewhere.outpost > 5);
  }
};

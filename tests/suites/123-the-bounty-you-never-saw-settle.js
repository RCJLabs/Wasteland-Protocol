// F15, the last of the fifteen. The board settled in silence everywhere except in combat.
//
// advanceBounties announced a completion with `if (combatActive) log(...)`, so a contract that
// finished anywhere else finished without a word - and CRAFT, the commonest contract on the
// board, completes at the WORKBENCH. So do a bond formed at the Outpost, a face reaching
// TRUSTS, and a sector crossed. A log line is the wrong instrument for those anyway: there is
// no log on those screens to read it in.
//
// And the settled row was never drawn. `claimed` was written false at creation, read in two
// places, and set true nowhere - so the flag and the struck-through style it drives were both
// dead code, and a finished contract was swapped out between renders with nothing to see. It
// is marked now and rotated on the render AFTER the one that shows it settled.
module.exports = {
  name: 'The bounty you never saw settle',
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

    await page.evaluate(() => {
      window.__board = type => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        combatActive = false;
        activeBounties = [{ type, desc: `TEST ${type}`, current: 0, target: 1,
                            reward: 42, claimed: false }];
        standingBounty = null;
        const el = document.getElementById('settle-banner');
        el.classList.remove('settle-banner-show'); el.innerHTML = '';
        return activeBounties[0];
      };
      window.__notice = () => {
        const el = document.getElementById('settle-banner');
        return { shown: el.classList.contains('settle-banner-show'),
                 text: el.innerText.replace(/\s+/g, ' ').trim(),
                 role: el.getAttribute('role'), live: el.getAttribute('aria-live'),
                 parent: (el.parentElement || {}).id };
      };
    });

    // ── It settles out loud at the workbench ───────────────────────────────────────
    const craft = await page.evaluate(() => {
      window.__board('CRAFT');
      switchScreen('screen-outpost');
      const purse = scrap;
      const before = window.__notice();
      // The real door: the workbench, which is where CRAFT is actually finished.
      materials.parts = 99; materials.chems = 99; materials.tech = 99;
      craftItem('MED_STIM');
      const after = window.__notice();
      return { before, after, paid: scrap - purse, screen: 'screen-outpost',
               combat: combatActive, bag: inventory.length };
    });
    ok(`crafting at the workbench finishes the contract (+${craft.paid} scrap, ${craft.bag} in the bag)`,
      craft.paid > 0 && craft.combat === false);
    ok(`nothing was showing before it settled (${craft.before.text || 'empty'})`, craft.before.shown === false);
    ok(`and the settlement says so on the screen it happened on (${craft.after.text})`,
      craft.after.shown === true && /CONTRACT SETTLED/.test(craft.after.text));
    ok(`naming the contract and what it paid (${craft.after.text})`,
      /TEST CRAFT/.test(craft.after.text) && /42/.test(craft.after.text));

    // ── On any screen, because it can settle on any of them ────────────────────────
    const anywhere = await page.evaluate(() => {
      const out = [];
      [['screen-outpost', 'CRAFT'], ['screen-map', 'SECTOR'], ['screen-event', 'CRAFT'],
       ['screen-citadel', 'BOND'], ['screen-shop', 'CRAFT']].forEach(([scr, type]) => {
        window.__board(type);
        switchScreen(scr);
        checkBountyProgress(type);
        const n = window.__notice();
        const box = document.getElementById('settle-banner').getBoundingClientRect();
        out.push({ scr, type, shown: n.shown, sized: box.width > 0 && box.height > 0 });
      });
      return { out, blind: out.filter(o => !o.shown || !o.sized).map(o => `${o.type}@${o.scr}`) };
    });
    ok(`a contract settles visibly wherever it settles (${anywhere.out.length} screens checked)`,
      anywhere.blind.length === 0);
    ok(`the notice is an overlay rather than one screen's furniture (${(await page.evaluate(() => window.__notice())).parent})`,
      (await page.evaluate(() => window.__notice())).parent === 'engine');
    ok('and is announced, not only drawn', await page.evaluate(() => {
      const n = window.__notice(); return n.role === 'status' && n.live === 'polite'; }));

    // ── The board shows it settled before rotating it out ──────────────────────────
    const board = await page.evaluate(() => {
      const b = window.__board('CRAFT');
      const desc = b.desc;
      checkBountyProgress('CRAFT');
      const marked = activeBounties[0].claimed;
      const stillThere = activeBounties[0].desc === desc;
      switchScreen('screen-map'); renderMap();
      const firstDraw = document.getElementById('bounty-list').innerHTML;
      const struck = document.querySelectorAll('#bounty-list .bounty-complete').length;
      renderMap();
      const secondDraw = document.getElementById('bounty-list').innerHTML;
      return { marked, stillThere, struck, desc,
               shownSettled: firstDraw.indexOf(desc) >= 0,
               rotated: secondDraw.indexOf(desc) === -1,
               n: activeBounties.length };
    });
    ok(`a finished contract is marked rather than swapped out (${board.marked})`,
      board.marked === true && board.stillThere === true);
    ok(`the board draws it settled once, struck through (${board.struck} row)`,
      board.struck === 1 && board.shownSettled === true);
    ok(`and rotates it out on the next draw (${board.rotated})`, board.rotated === true);
    ok(`leaving the board the same size (${board.n})`, board.n === 1);

    // ── The belt: a board nobody draws still has to rotate ─────────────────────────
    // renderMap is the natural rotator, but a CRAFT contract settles at the workbench and the
    // workbench never draws a map - and the balance simulator draws nothing at all. Without a
    // second rotator the slot would sit claimed forever and every later event of that type
    // would earn nothing, which would make the sim quietly stop modelling the game.
    const unseen = await page.evaluate(() => {
      const b = window.__board('CRAFT');
      const desc = b.desc;
      switchScreen('screen-outpost');
      const seen = [];
      for (let i = 0; i < 3; i++) { checkBountyProgress('CRAFT'); seen.push(activeBounties[0].desc); }
      return { desc, seen, held: seen[0] === desc, claimed: activeBounties[0].claimed,
               n: activeBounties.length,
               idle: (() => { const before = activeBounties.map(o => o.desc).join('|');
                              const r = rotateSettled();
                              return { r, same: activeBounties.map(o => o.desc).join('|') === before }; })() };
    });
    ok(`the settled contract is still on the board for the render that never came (${unseen.seen[0]})`,
      unseen.held === true);
    ok(`but the next contract event rotates it rather than leaving the slot claimed (${unseen.seen[1]})`,
      unseen.seen[1] !== unseen.desc && unseen.claimed === false && unseen.n === 1);
    ok(`and rotating a board with nothing settled on it changes nothing (${unseen.idle.r})`,
      unseen.idle.r === false && unseen.idle.same === true);

    // ── Two on one event ──────────────────────────────────────────────────────────
    // A board of three carries duplicate types all the time - a KILL at 1 of 2 beside another
    // at 2 of 3 - so one kill can settle both. The rotation has to roll them one at a time or
    // the second sees the board as it was and can hand back the type the first just took.
    const doubled = await page.evaluate(() => {
      activeContracts = []; currentSlot = 1; confirmNewGame(1.0); combatActive = false;
      currentSector = 3;                        // the whole pool, so distinctness is reachable
      activeBounties = [
        { type: 'KILL', desc: 'A', current: 0, target: 1, reward: 10, claimed: false },
        { type: 'KILL', desc: 'B', current: 0, target: 1, reward: 10, claimed: false },
        { type: 'CRAFT', desc: 'C', current: 0, target: 9, reward: 10, claimed: false }];
      standingBounty = null;
      checkBountyProgress('KILL');
      const both = activeBounties.filter(b => b.claimed).length;
      // Rolled from one pool, two slots collide about one time in twelve, so one rotation
      // proves nothing either way. Sixty of them: under a board that rolls slot by slot a
      // duplicate is not merely unlikely, it is unreachable, because the second roll excludes
      // what the first was handed.
      const dupes = [];
      let sample = null;
      for (let i = 0; i < 60; i++) {
        activeBounties = [
          { type: 'KILL', desc: 'A', current: 1, target: 1, reward: 10, claimed: true },
          { type: 'KILL', desc: 'B', current: 1, target: 1, reward: 10, claimed: true },
          { type: 'CRAFT', desc: 'C', current: 0, target: 9, reward: 10, claimed: false }];
        rotateSettled();
        const t = activeBounties.map(b => b.type);
        if (!sample) sample = t;
        if (new Set(t).size !== 3) dupes.push(t.join('/'));
      }
      return { both, sample, dupes: dupes.length, first: dupes[0] || null,
               pool: new Set(BOUNTY_POOL.filter(b => (b.minSector || 1) <= 3).map(b => b.type)).size };
    });
    ok(`one kill can settle two contracts at once (${doubled.both} of three)`, doubled.both === 2);
    ok(`and the board hands back a different one for each, sixty times over out of ${doubled.pool} (e.g. ${doubled.sample.join(', ')})`,
      doubled.dupes === 0 && doubled.sample.indexOf('KILL') === -1);

    // ── A standing contract settles the same way ───────────────────────────────────
    const standing = await page.evaluate(() => {
      window.__board('KILL');
      standingBounty = { type: 'S_KILL', desc: 'TEST STANDING', current: 0, target: 1, reward: 500 };
      switchScreen('screen-outpost');
      checkBountyProgress('KILL');
      return window.__notice();
    });
    ok(`a standing contract settles out loud too (${standing.text})`,
      standing.shown === true && /STANDING CONTRACT SETTLED/.test(standing.text));

    // ── And the combat log still says it, where there is a log ─────────────────────
    const inFight = await page.evaluate(() => {
      window.__board('KILL');
      switchScreen('screen-combat'); initiateCombat('RAIDERS', false);
      activeBounties = [{ type: 'KILL', desc: 'TEST KILL', current: 0, target: 1, reward: 42, claimed: false }];
      const before = document.getElementById('log').innerText.length;
      checkBountyProgress('KILL');
      const said = document.getElementById('log').innerText.slice(before);
      return { logged: /BOUNTY COMPLETE/.test(said), banner: window.__notice().shown };
    });
    ok(`in a fight the log still carries it (${inFight.logged})`, inFight.logged === true);
    ok('and the banner carries it as well, so neither screen is silent', inFight.banner === true);

    // ── It clears itself ───────────────────────────────────────────────────────────
    const clears = await page.evaluate(async () => {
      window.__board('CRAFT');
      switchScreen('screen-outpost');
      checkBountyProgress('CRAFT');
      const up = window.__notice().shown;
      await new Promise(r => setTimeout(r, 3000));
      return { up, down: !window.__notice().shown };
    });
    ok('the notice arrives', clears.up === true);
    ok('and leaves again rather than standing there', clears.down === true);
  }
};

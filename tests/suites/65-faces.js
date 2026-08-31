// Two readings the audit measured and left off: follow-up threads fire rarely - two of six
// never appeared in sixty runs - and standing with the four faces barely moves across a run,
// -1.0 to +0.6. Both were the same artifact. The simulator picked event choices uniformly at
// random, and standing moves ONLY through those choices, so it was a random walk that averages
// to nothing by construction; five of the six threads gate on |standing| >= 2 with one face,
// so a walk that averages to zero never opens them.
//
// Given a policy that actually wants something, all six fire - but not for the same player.
// Warm play opens Orrin's Workshop and Vela's Ledger and closes Word Gets Around; cold play
// does the reverse. That is the system working: standing is a choice with consequences, and no
// single way of playing sees all of it.
//
// What was genuinely broken sat underneath. Measured with a player trying to burn them, Orrin
// and the Magpie ranged 0 to 0: every choice either raised them or left them alone, so half
// the cast could not be wronged at all. The BAD BLOOD and WARY bands were unreachable for two
// of four faces, and nothing read them if they had been. Orrin was worse still - both his
// choices moved +1, his only event is one event, and his discount, his free tune-up and his
// workshop all gate at +2, so the whole tier needed meeting him twice in one run.
module.exports = {
  name: 'Faces',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__run = () => { activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
                             castState = {}; activeRelics = []; };
      // Every standing move any choice in the game can make, read off the engine rather than
      // pinned here, so a reworded event moves these assertions with it.
      window.__swings = async () => {
        const src = await (await fetch('game.js')).text();
        const out = {};
        (src.match(/noteCast\(\s*'(\w+)'\s*,\s*(-?\d+)/g) || []).forEach(m => {
          const [, id, n] = m.match(/'(\w+)'\s*,\s*(-?\d+)/);
          (out[id] = out[id] || []).push(Number(n));
        });
        return out;
      };
    });

    // ---- every face can be moved in both directions ----
    const swings = await page.evaluate(() => __swings());
    const faces = await page.evaluate(() => Object.keys(CAST));
    ok(`all ${faces.length} faces are moved by some choice`, faces.every(f => (swings[f] || []).length));
    // The finding, as one assertion: a face nobody can wrong is not a relationship.
    ok(`every face can be wronged (${faces.map(f => f + ':' + Math.min(...(swings[f] || [0]))).join(' ')})`,
      faces.every(f => Math.min(...(swings[f] || [0])) < 0));
    ok(`and every face can be won over (${faces.map(f => f + ':' + Math.max(...(swings[f] || [0]))).join(' ')})`,
      faces.every(f => Math.max(...(swings[f] || [0])) > 0));

    // The bottom band is the one that was unreachable, so it is asserted exactly rather than
    // loosely: a single choice must be able to put any face into BAD BLOOD. The top band is
    // deliberately not asserted the same way - the Magpie's largest single move is +1 and his
    // door opens there, so TRUSTS costing him two visits is the design, not a gap.
    const worst = await page.evaluate(() => Math.min(...STANDING_BANDS.map(b => b.at)));
    ok(`one choice can put any face into the bottom band (${worst})`,
      faces.every(f => Math.min(...swings[f]) <= worst));

    // ---- every follow-up's gate can be reached from a single event ----
    // A thread whose gate needs two meetings of a one-event face is content behind a coincidence.
    const gates = await page.evaluate(() => FOLLOWUPS.map(f => ({
      title: f.title, cast: f.cast, when: String(f.when)
    })));
    const reach = await page.evaluate(async () => {
      const src = await (await fetch('game.js')).text();
      // How many ordinary (non-follow-up) events each face owns.
      const titles = EVENT_POOL.filter(e => e.cast).map(e => ({ cast: e.cast, title: e.title }));
      const own = {};
      titles.forEach(t => { own[t.cast] = (own[t.cast] || 0) + 1; });
      return own;
    });
    const need = g => { const m = g.when.match(/(-?\d+)/); return m ? Math.abs(Number(m[1])) : 0; };
    const single = gates.filter(g => {
      const best = Math.max(...(swings[g.cast] || [0]).map(Math.abs));
      return best >= need(g);
    });
    ok(`every follow-up gate is reachable from one meeting (${single.length} of ${gates.length})`,
      single.length === gates.length);
    ok('and every face with a follow-up owns an ordinary event to meet them at',
      gates.every(g => (reach[g.cast] || 0) >= 1));

    // ---- the tinker, in both directions, on a live run ----
    const orrin = await page.evaluate(() => {
      const ev = EVENT_POOL.find(e => e.title === 'WANDERING TINKER');
      const at = (setup) => {
        __run(); meetCast('ORRIN'); scrap = 500;
        materials = { parts: 5, chems: 5, tech: 5 };
        if (setup) setup();
        return choicesFor(ev).filter(c => c.canAfford());
      };
      const fresh = at();
      const swing = c => { const m = String(c.execute).match(/noteCast\(\s*'ORRIN'\s*,\s*(-?\d+)/); return m ? Number(m[1]) : 0; };
      // buy the relationship outright
      __run(); meetCast('ORRIN'); scrap = 500; materials = { parts: 5, chems: 5, tech: 5 };
      const buy = choicesFor(ev).filter(c => c.canAfford()).find(c => swing(c) === 2);
      if (buy) buy.execute();
      const afterBuy = castStanding('ORRIN');
      // and rob him
      __run(); meetCast('ORRIN'); scrap = 500; materials = { parts: 0, chems: 0, tech: 0 };
      const rob = choicesFor(ev).filter(c => c.canAfford()).find(c => swing(c) === -2);
      const matsBefore = { ...materials };
      if (rob) rob.execute();
      const afterRob = castStanding('ORRIN');
      const robbed = JSON.stringify(materials) !== JSON.stringify(matsBefore);
      const shutOut = choicesFor(ev).filter(c => c.canAfford());
      return {
        swings: fresh.map(swing),
        afterBuy, afterRob, robbed,
        trades: shutOut.filter(c => swing(c) !== 0).length,
        shutText: shutOut.map(c => c.label).join(' | '),
        shutDesc: /rolling the tarp|heard you coming/i.test(eventDesc(ev))
      };
    });
    ok(`the tinker offers a way up and a way down (${orrin.swings.join(', ')})`,
      orrin.swings.some(v => v > 0) && orrin.swings.some(v => v < 0));
    ok(`one visit can buy his trust outright (standing ${orrin.afterBuy})`, orrin.afterBuy >= 2);
    ok(`and one visit can lose it (standing ${orrin.afterRob})`, orrin.afterRob <= -2);
    ok('robbing him actually pays', orrin.robbed);
    // The consequence: a trader you robbed stops trading. Without this the downside is cosmetic.
    ok(`at bad blood he will not trade (${orrin.shutText})`, orrin.trades === 0);
    // The buttons and the prose have to agree. Before this the description still said he was
    // laying the good stock out first while the only choices were to walk away.
    ok('and the scene says so rather than still welcoming you', orrin.shutDesc);

    // ---- the dealer, the same ----
    const magpie = await page.evaluate(() => {
      const ev = EVENT_POOL.find(e => /COLLECTOR'S TABLE/i.test(e.title));
      const swing = c => { const m = String(c.execute).match(/noteCast\(\s*'MAGPIE'\s*,\s*(-?\d+)/); return m ? Number(m[1]) : 0; };
      __run(); meetCast('MAGPIE'); activeRelics = [RELIC_POOL[0]];
      const fresh = choicesFor(ev).filter(c => c.canAfford());
      const palm = fresh.find(c => swing(c) === -2);
      const held = activeRelics.length;
      if (palm) palm.execute();
      const took = activeRelics.length - held;
      const gotCursed = activeRelics[activeRelics.length - 1].tier === 'CURSED';
      const after = castStanding('MAGPIE');
      const shutOut = choicesFor(ev).filter(c => c.canAfford());
      return { swings: fresh.map(swing), took, after, gotCursed,
               deals: shutOut.filter(c => swing(c) !== 0).length,
               shutText: shutOut.map(c => c.label).join(' | '),
               shutDesc: /already folded|does not put it down/i.test(eventDesc(ev)) };
    });
    ok(`the dealer offers a way up and a way down (${magpie.swings.join(', ')})`,
      magpie.swings.some(v => v > 0) && magpie.swings.some(v => v < 0));
    ok('palming one takes a relic without giving one', magpie.took === 1);
    ok('and it is an ordinary one, not a free rare off the top', !magpie.gotCursed);
    ok(`it costs the relationship (standing ${magpie.after})`, magpie.after <= -2);
    ok(`and he will not deal after it (${magpie.shutText})`, magpie.deals === 0);
    ok('and his table says so too', magpie.shutDesc);

    // ---- a thread opens the moment its gate is met ----
    const opens = await page.evaluate(() => {
      const out = {};
      FOLLOWUPS.forEach(f => {
        __run(); meetCast(f.cast);
        const shut = f.when();
        // Set standing to each end in turn; a gate must be shut at neutral and open at one end.
        __run(); meetCast(f.cast); castOf(f.cast).standing = 3;
        const hi = f.when();
        __run(); meetCast(f.cast); castOf(f.cast).standing = -3;
        const lo = f.when();
        out[f.title] = { shut, hi, lo };
      });
      return out;
    });
    ok('no follow-up is open at neutral standing',
      Object.values(opens).every(o => !o.shut));
    ok(`every follow-up opens at one end of the scale (${Object.entries(opens).filter(([, o]) => o.hi || o.lo).length} of ${Object.keys(opens).length})`,
      Object.values(opens).every(o => o.hi || o.lo));

    // ---- the manual ----
    const manual = await page.evaluate(() => {
      renderCodex();
      const txt = document.getElementById('codex-body').innerText;
      return /standing/i.test(txt);
    });
    ok('the manual explains standing', manual);
  }
};

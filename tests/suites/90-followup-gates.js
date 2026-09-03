// D16: filed as "four of eight follow-up threads have never fired," read off a simulator batch
// run under its default policy. All eight gates check out fine on inspection and against direct
// tests: VELA'S own asymmetric pair (VELA SENDS MEN at standing <=-2, VELA'S LEDGER at >=2) has
// had a passing check since D04 (tests/suites/82-vela.js, "opensShakedown"), and the two-sided
// threads (WHAT SEPT TOLD THEM, GRALE CALLS THEM) gate on Math.abs(standing) >= 2, which cannot
// prefer a sign by construction.
//
// What actually explains "never fired": tests/simulate.js's own --faces policy. Warm (its
// default) always takes the option with the largest positive noteCast swing among the ones it
// can afford; cold always takes the smallest. Under warm, a squad that can pay Vela back always
// does, so it is never seen defaulting, and the same shape holds for Kess: THE SURVIVOR event
// offers "Take the rifle" as a direct -2 that a warm policy will simply never pick while a
// kinder option is on the table. Four threads gated on bad standing looking unreached in a
// warm-only sample is the policy exploring one branch of the story, not a broken gate - and
// --faces cold already exists in the harness for reading the other one.
//
// Vela's pair got its own direct proof when D04 shipped. Kess's never did - no suite asserts
// WORD GETS AROUND's gate or KESS ON THE ROAD's the same way. This closes that gap, and pins
// the one thing worth pinning: THE SURVIVOR's "Take the rifle" is Kess's actual road down, not
// a decorative flavour choice with no consequence.
module.exports = {
  name: "Kess's road down is as real as her road up",
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => { currentSlot = 1; confirmNewGame(1.0); sectorFront = null; });

    // ── Both Kess follow-ups gate exactly where they claim to, and nowhere else ─────────
    const gates = await page.evaluate(() => {
      const onRoad = FOLLOWUPS.find(f => f.title === 'KESS ON THE ROAD');
      const wordOut = FOLLOWUPS.find(f => f.title === 'WORD GETS AROUND');
      const at = n => { castState.KESS = { met: 1, standing: 0 }; noteCast('KESS', n);
                         return { onRoad: onRoad.when(), wordOut: wordOut.when() }; };
      return { neutral: at(0), good: at(2), bad: at(-2), justShy: at(1), justOver: at(-1) };
    });
    ok(`neutral standing opens neither (${JSON.stringify(gates.neutral)})`,
      !gates.neutral.onRoad && !gates.neutral.wordOut);
    ok(`standing 2 opens the good thread and only the good thread (${JSON.stringify(gates.good)})`,
      gates.good.onRoad && !gates.good.wordOut);
    ok(`standing -2 opens the bad thread and only the bad thread (${JSON.stringify(gates.bad)})`,
      gates.bad.wordOut && !gates.bad.onRoad);
    ok(`one short of either threshold opens neither (+1: ${JSON.stringify(gates.justShy)}, ` +
       `-1: ${JSON.stringify(gates.justOver)})`,
      !gates.justShy.onRoad && !gates.justShy.wordOut && !gates.justOver.onRoad && !gates.justOver.wordOut);

    // ── THE SURVIVOR really does carry a road down, not just a road up ──────────────────
    const survivor = await page.evaluate(() => {
      const ev = EVENT_POOL.find(e => e.title === 'THE SURVIVOR');
      const choices = typeof ev.choices === 'function' ? ev.choices() : ev.choices;
      const rifle = choices.find(c => /Take the rifle/.test(c.label));
      castState.KESS = { met: 1, standing: 0 };
      const before = castStanding('KESS');
      const text = rifle.execute();
      return { before, after: castStanding('KESS'), scrap: typeof text === 'string' && text.length > 0 };
    });
    ok(`taking the rifle costs standing on the spot (${survivor.before} -> ${survivor.after})`,
      survivor.after === survivor.before - 2 && survivor.scrap);

    // ── And it is enough on its own to open the thread it feeds - the road down is one turn ──
    const chain = await page.evaluate(() => {
      const ev = EVENT_POOL.find(e => e.title === 'THE SURVIVOR');
      const wordOut = FOLLOWUPS.find(f => f.title === 'WORD GETS AROUND');
      castState.KESS = { met: 1, standing: 0 };
      const choices = () => (typeof ev.choices === 'function' ? ev.choices() : ev.choices);
      const before = wordOut.when();
      choices().find(c => /Take the rifle/.test(c.label)).execute();
      return { before, after: wordOut.when(), standing: castStanding('KESS') };
    });
    ok(`one bad turn at THE SURVIVOR is the whole road down (${chain.before} -> ${chain.after}, ` +
       `standing ${chain.standing})`, !chain.before && chain.after && chain.standing === -2);
  }
};

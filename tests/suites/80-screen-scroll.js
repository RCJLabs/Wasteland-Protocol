// A screen that is a fixed-height flex column with ONE inner scroller only works while the
// blocks around that scroller are small. When they are not, the scroller does not overflow -
// it is allocated less and less height until it is allocated none, and its content is clipped
// silently. Nothing looks broken: the page renders, the cards are in the DOM, and the feature
// is simply not on screen.
//
// It shipped that way twice. The expedition contracts screen put three order cards above the
// optional conditions, which left the conditions 220px of their 418px on a tall handset, 35px
// at 400px wide, and exactly zero at 320 - where the DEPLOY button was below the fold too,
// behind `overflow: hidden`, so neither could be reached at all. The muster had the same shape
// and was worse: three doctrine cards, a reroll line and a job line left the squad list 24px
// of its 733px, on the screen where you choose who deploys.
//
// Both scroll as a page now, with the deploy control pinned. What this suite holds is the
// property rather than the pixel counts: every screen listed below shows all of its content at
// every width, and the way out of it is always on screen.
const SCREENS = [
  { id: 'screen-contracts', open: 'contracts', body: '#contract-list', exit: '.contract-footer' },
  { id: 'screen-muster',    open: 'muster',    body: '#muster-body',   exit: '#muster-deploy' }
];

module.exports = {
  name: 'Screens that fit what is on them',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    const sizes = [[412, 915], [400, 800], [360, 740], [320, 640]];
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(120);

      const read = await page.evaluate((SCREENS) => {
        globalSettings.sfx = false;
        currentSlot = 1; confirmNewGame(1.0);
        careerWins = 2; bestRung = 2;          // so the ascension control is on the contracts screen
        doctrineOffer = rollDoctrines(); noteFavourites();
        const out = {};
        for (const s of SCREENS) {
          if (s.open === 'contracts') openContracts(); else renderMuster();
          const screen = document.getElementById(s.id);
          const body = document.querySelector(s.body);
          const exit = document.querySelector(s.exit);
          const cs = getComputedStyle(screen);
          const eb = exit.getBoundingClientRect();
          out[s.open] = {
            // The content block is never clipped: it is as tall as what is inside it.
            bodyClient: Math.round(body.clientHeight),
            bodyContent: Math.round(body.scrollHeight),
            // The screen is the thing that scrolls, and is allowed to.
            canScroll: cs.overflowY === 'auto' || cs.overflowY === 'scroll',
            screenClient: Math.round(screen.clientHeight),
            screenContent: Math.round(screen.scrollHeight),
            // The way out is on screen without scrolling for it.
            exitTop: Math.round(eb.top), exitBottom: Math.round(eb.bottom),
            vh: window.innerHeight
          };
        }
        return out;
      }, SCREENS);

      for (const s of SCREENS) {
        const r = read[s.open];
        ok(`${w}x${h} ${s.open}: nothing clipped inside ${s.body} (${r.bodyClient}px for ${r.bodyContent}px)`,
           r.bodyClient >= r.bodyContent - 1);
        ok(`${w}x${h} ${s.open}: the screen is what scrolls`, r.canScroll);
        ok(`${w}x${h} ${s.open}: the way out is on screen (${r.exitTop}-${r.exitBottom} of ${r.vh})`,
           r.exitTop >= 0 && r.exitBottom <= r.vh + 1);
      }
    }

    // And the content really is reachable by scrolling: at the tightest width, scroll to the
    // end and the last thing on the page has to be above the pinned control rather than under it.
    await page.setViewportSize({ width: 320, height: 640 });
    await page.waitForTimeout(120);
    const bottom = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); careerWins = 2; bestRung = 2;
      openContracts();
      const s = document.getElementById('screen-contracts');
      s.scrollTop = s.scrollHeight;
      const r = el => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
      const seed = r(document.querySelector('.seed-panel'));
      const foot = r(document.querySelector('.contract-footer'));
      const cards = [...document.getElementById('contract-list').children];
      return { seed, foot, cards: cards.length, last: r(cards[cards.length - 1]), vh: window.innerHeight };
    });
    ok(`the conditions list has every condition in it (${bottom.cards})`, bottom.cards >= 5);
    ok(`scrolled to the end, the seed panel is fully on screen (${bottom.seed.top}-${bottom.seed.bottom})`,
       bottom.seed.top >= 0 && bottom.seed.bottom <= bottom.foot.top + 1);
    ok(`and the last condition is clear of the pinned footer (${bottom.last.bottom} vs ${bottom.foot.top})`,
       bottom.last.bottom <= bottom.foot.top + 1);

    await page.setViewportSize({ width: 400, height: 800 });
  }
};

// ── O17: THE CLOSING SENTENCE THAT WENT STALE, AND THE FIFTH TIME IT HAPPENED ─────────
//
// tests/simulate.js keeps its record newest-first, so an item's block sits ABOVE the items that
// followed it. An item closes by naming what it did not settle, and the next item along settles
// exactly that - while the closing sentence stays in the present tense, unread, telling whoever
// lands on the older block that the question is open.
//
// Found by hand, one at a time, each while checking the record before pitching something:
//
//   O10's    "what a doctrine is WORTH is still unmeasured"      answered by O11
//   O-audit  "NOTHING HAS EVER TAKEN A RETREAT ... NOT BUILT"    answered by O16
//   M-audit  "WHICH HALF IS BETTER IS NOT MEASURED HERE"         answered by M10
//   I01      "does walking through it change anything? - is not" answered by O16
//   K06/P02  "no reading has ever come off the second half"      answered by M10
//
// The last two the scan found; I had only known about three when I built it. The O-audit ran
// three structural sweeps - the arms, the dead fields, the denominators - and caught none of
// them, because staleness in prose is a property of the RECORD rather than of the code.
//
// WHAT THE INSTRUMENT DOES NOT DO is guess which item answered which claim. That was built
// first and thrown away: scoring a claim's words against newer item titles gave nine candidates
// with one right answer, and widening it to the claim's paragraph gave twelve with two. The rest
// matched on `policy`, `work`, `engine`, `runs` - words a 95-item record uses everywhere. A list
// that is three-quarters wrong trains you to skim it. tests/stale.js enumerates instead, and the
// bar is that every open claim has been READ: marked ^^ with what settled it, or with why it
// still stands. Fifteen of them is ten minutes.
const { engineUp } = require('../boot');
const { scan } = require('../stale');

module.exports = {
  name: 'A record that reads itself',
  run: async ({ page, ok, base }) => {
    // The page is not needed, but every suite in this tree boots one and the harness's own
    // error hook is attached to it - a suite that skips the boot also skips that check.
    await page.goto(`${base}/index.html`); await engineUp(page);

    const r = scan();
    ok(`the record carries ${r.total} present-tense open claims`, r.total >= 10);
    // THE RATCHET. Not "no claim may be open" - open claims are how this file says what it does
    // not know, and there should be plenty of them. The bar is that none sits unread. A new item
    // that closes on an open question marks it in the same breath, which costs one line.
    ok(`and every one has been read against what followed it${r.live ? ' - unread at line ' +
        r.found.filter(f => !f.marked).map(f => f.line).join(', ') : ''}`,
      r.live === 0);
    // AND WHAT THE MARKS SAY, pinned. The O17 write-up put "five of the fifteen are marked STILL
    // OPEN" into the record and it was four of seventeen - a miscount in the item about
    // miscounts, written an hour after the marking. A number that lives only in prose drifts;
    // these are read off the file, so the paragraph and the record cannot disagree again.
    ok(`${r.answered} answered by a later item, ${r.open} still open, ${r.notaclaim} not a claim`,
      r.answered + r.open + r.notaclaim === r.total);
    ok(`the record says the same four numbers the file does`,
      new RegExp(`${r.answered} answered by a later item\\s+${r.open} still open\\s+` +
                 `${r.notaclaim} not an open claim`).test(
        require('fs').readFileSync(require('path').join(__dirname, '..', 'simulate.js'), 'utf8'))
      && new RegExp(`TWO of the eighteen`).test(
        require('fs').readFileSync(require('path').join(__dirname, '..', 'simulate.js'), 'utf8'))
      // This went to three for one commit and came back, and the round trip is the point. The
      // P-audit READ one of the markers instead of trusting it. F10's said
      // STILL OPEN over a claim that is false as written - the line is re-drafted every
      // expedition - so the claim became a correction rather than an answer. This row went red
      // for exactly the right reason: the prose and the file disagreed, and the prose was the
      // half that had to move. But the correction then settled the WHOLE entry while saying the
      // capstone half still stood, so a live claim stopped being counted - which is the second
      // gap and the worse one. The scanner cannot check a marker's CONTENT, and it cannot check
      // that a marker covers only what it claims to. A count that falls without an item
      // answering anything is the signature of both.
      && r.open === 2 && r.total === 18);
    // The five known stale ones, by the words that were wrong, so a rewrite that quietly drops
    // the marker without settling the claim is caught rather than passing as tidied prose.
    const fs = require('fs'), path = require('path');
    const sim = fs.readFileSync(path.join(__dirname, '..', 'simulate.js'), 'utf8');
    const settled = [
      ['O10 -> O11', /is WORTH is still unmeasured[\s\S]{0,400}?\^\^ ANSWERED BY O11/],
      ['O-audit -> O16', /NOT BUILT HERE[\s\S]{0,200}?\^\^ BUILT AND ANSWERED BY O16/],
      ['M-audit -> M10', /WHICH HALF IS BETTER IS NOT MEASURED HERE[\s\S]{0,400}?\^\^ ANSWERED BY M10/],
      ['I01 -> O16', /does walking through it change anything\?" is not\.\s*\n\/\/\s*\^\^ ANSWERED BY O16/],
      ['K06 -> M-audit\/M10', /no reading in this project has ever come off the second half[\s\S]{0,200}?\^\^ ANSWERED/],
    ];
    settled.forEach(([who, re]) => ok(`${who} is marked at the claim, not just in a commit message`,
      re.test(sim)));
    // AND THE INSTRUMENT SAYS WHAT IT CANNOT DO, which is the row that stops the next person
    // rebuilding the nomination scorer and believing it.
    const tool = fs.readFileSync(path.join(__dirname, '..', 'stale.js'), 'utf8');
    ok('tests/stale.js records the approach that was tried and discarded',
      /WHAT I TRIED FIRST AND THREW AWAY/.test(tool) && /three-quarters wrong/.test(tool));
  }
};

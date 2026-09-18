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
    ok(`the record says the same numbers the file does`,
      new RegExp(`${r.answered} answered by a later item\\s+${r.open} still open\\s+` +
                 `${r.notaclaim} not an open claim`).test(
        require('fs').readFileSync(require('path').join(__dirname, '..', 'simulate.js'), 'utf8'))
      && new RegExp(`and ${r.conflict} carrying two verdicts that disagree`).test(
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
      && r.open === 2 && r.total === 21);
    // AND NO CLAIM CARRIES TWO VERDICTS THAT DISAGREE. K11's did for two commits: K11b wrote its
    // answer ABOVE the marker already there and left the old one standing, so the last word a
    // reader got was the stale one. The scan passed it, because it tested the window for an
    // answer, took the first hit and stopped. This is the row that would have caught it, and
    // nothing above it would have - the total stayed whole, every claim stayed marked, and the
    // verdict it reported was the true one arrived at by the wrong reading.
    ok(`no claim reads answered and then open again${r.conflict ? ' - line ' +
        r.found.filter(f => f.conflict).map(f => f.line).join(', ') : ''}`, r.conflict === 0);
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
      // The last two the record ever carried, pinned for the same reason as the five above: an
      // item that answers a claim says so AT THE CLAIM, not in a commit message nobody reads
      // twice. Both needed a door built before the question could be asked at all.
      ['O05 -> O05b', /its own piece of work rather than a line in the elite branch\.\s*\n\/\/\s*\^\^ ANSWERED by O05b/],
      ['F10 -> F10b', /no policy banks one to take later\.\s*\n\/\/\s*\^\^ ANSWERED by F10b/],
    ];
    settled.forEach(([who, re]) => ok(`${who} is marked at the claim, not just in a commit message`,
      re.test(sim)));
    // AND THE INSTRUMENT SAYS WHAT IT CANNOT DO, which is the row that stops the next person
    // rebuilding the nomination scorer and believing it.
    const tool = fs.readFileSync(path.join(__dirname, '..', 'stale.js'), 'utf8');
    ok('tests/stale.js records the approach that was tried and discarded',
      /WHAT I TRIED FIRST AND THREW AWAY/.test(tool) && /three-quarters wrong/.test(tool));
    // AND HOW IT READS A MARKER, held on constructed windows rather than on the record, because
    // both corrections that made it right are invisible in the output while they work. Fed by
    // hand so the rows say what the rule IS, not that today's file happens to satisfy it.
    const { read } = require('../stale');
    const w = t => t.trim().split('\n').map(x => x.trim());
    ok('the claim\'s own prose is not a verdict - only a ^^ marker is', (() => {
      // The F10 shape: the claim says "still open" in its own words and the marker answers it.
      const a = read(w(`
        // no policy here banks a capstone to take later.
        //   ^^ ANSWERED by F10b, and the reason nobody had is that the play does not exist.`));
      return a.kind === 'answered' && a.conflict === false;
    })());
    ok('a later marker overrules an earlier one, and the stale half is reported', (() => {
      // The K11 shape, which is what went wrong: answer written ABOVE, old marker left below.
      const bad = read(w(`
        // It would take about twelve.
        //   ^^ ANSWERED by K11b, and the estimate was wrong.
        //   ^^ READ: STILL OPEN, and priced - twelve careers an arm.`));
      // And the healthy direction, which must still pass: open first, answered after.
      const good = read(w(`
        // It would take about twelve.
        //   ^^ READ: STILL OPEN, and priced - twelve careers an arm.
        //   ^^ ANSWERED by K11b, and the estimate was wrong.`));
      return bad.kind === 'open' && bad.conflict === true
          && good.kind === 'answered' && good.conflict === false;
    })());
    ok('a marker quoting what it used to say is not still saying it', (() => {
      // How every correction in this record is written. Without the strip, the quotation reads
      // as a live verdict and the claim goes back to open - which is the trap this file has
      // fallen into three times in other clothes.
      const q = read(w(`
        // It would take about twelve.
        //   ^^ ANSWERED by K11b, and the estimate was wrong.
        //   ^^ AND THIS MARKER USED TO SAY "STILL OPEN, and priced - twelve careers an arm."`));
      return q.kind === 'answered' && q.conflict === false;
    })());
  }
};

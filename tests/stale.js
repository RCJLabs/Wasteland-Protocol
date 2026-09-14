// ── THE CLOSING SENTENCE THAT WENT STALE, AND THE THIRD TIME IT HAPPENED ──────────────
//
// tests/simulate.js keeps its record newest-first: an item's block sits ABOVE the items it
// followed. An item closes by saying what it did not settle - "what a doctrine is WORTH is still
// unmeasured", "nothing has ever taken a retreat", "which half is better is NOT MEASURED HERE" -
// and the next item along routinely settles exactly that. The closing sentence stays in the
// present tense, nothing re-reads it, and a reader landing on the older block is told the
// question is open by a file that answered it one screen higher.
//
// Three found by hand, each by accident, each while checking the record before pitching an item:
//
//   O10's   "what a doctrine is WORTH is still unmeasured"   answered by O11, 11 lines above
//   O-audit "NOTHING HAS EVER TAKEN A RETREAT ... NOT BUILT" answered by O16, directly above
//   M-audit "WHICH HALF IS BETTER IS NOT MEASURED HERE"      answered by M10, 70 lines above
//
// The O-audit ran three structural sweeps over the instrument - the arms, the dead fields, the
// denominators - and caught none of them, because staleness in prose is not a structural
// property of the code. It is a property of the record, and this is the instrument for it.
//
// WHAT IT DOES: it finds every present-tense open claim in the header and reports which have
// been READ since - marked ^^ with what settled them, or with why they still stand. It does not
// decide staleness. That needs somebody to read two blocks and think, and the ratchet is simply
// that no claim may sit in the record unread.
//
// WHAT I TRIED FIRST AND THREW AWAY, recorded because the next person will think of it too. The
// obvious version nominates the answer: score each claim's words against the titles of every
// NEWER item and report the best matches. Built, run, and useless. Scoring the claim's line gave
// nine candidates of which one was right; widening to the claim's paragraph to catch the M-audit
// case - whose subject word "overdrive" is three lines above the claim - gave twelve, of which
// two were. The rest matched on `policy`, `work`, `read`, `engine`, `runs`, `never`: words a
// 95-item record uses everywhere. Filtering to words in three titles or fewer did not save it.
// A list that is three-quarters wrong trains you to skim it, which is worse than no list.
//
// So the nomination is gone and the enumeration stays. Fifteen claims is ten minutes of reading,
// and all three known stale lines were on that list with nothing marking them.
//
//   node tests/stale.js            the unread claims
//   node tests/stale.js --all      every open claim, read or not
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'simulate.js');
const ALL = process.argv.includes('--all');

// The phrases an item actually closes on, taken from the file rather than imagined. Every one of
// these is a PRESENT-TENSE statement that something is not known, which is what goes stale; a
// past-tense "was not measured" describes the item's own history and does not.
const OPEN = new RegExp([
  'still unmeasured', 'NOT MEASURED HERE', 'not measured here',
  'NOT BUILT HERE', 'not built here', 'is its own item', 'its own piece of work',
  'nothing has ever', 'no reading in this project', 'has never had',
  'is still unresolved', 'is not measured', 'cannot say', 'left open',
].join('|'));

// A marker put on a claim once somebody has read it against what came later. Either spelling of
// the outcome counts - what matters is that a human has been here since.
const MARK = /\^\^/;

const lines = fs.readFileSync(SRC, 'utf8').split('\n');

// Items, newest first, which is the order they are written in.
const items = [];
lines.forEach((l, i) => {
  const m = l.match(/^\/\/ ── (.+?) ─*$/);
  if (m) items.push({ title: m[1].trim(), at: i, tokens: null });
});
items.forEach((it, k) => { it.end = k + 1 < items.length ? items[k + 1].at : lines.length; });

const STOP = new Set(('the and for that this with what which from have been than they them into ' +
  'here there when where more most much less only just also does done what when than then ' +
  'about after again against because before between both cannot could each every file item ' +
  'items measured measure measures reading readings claim claims thing things something ' +
  'nothing anything project repo file line lines number numbers figure figures').split(/\s+/));
const tokensOf = s => new Set((s.toLowerCase().match(/[a-z_]{4,}/g) || []).filter(w => !STOP.has(w)));
items.forEach(it => { it.tokens = tokensOf(it.title); });

const itemAt = i => { for (let k = items.length - 1; k >= 0; k--) if (items[k].at <= i) return k; return -1; };

const found = [];
lines.forEach((l, i) => {
  if (!l.startsWith('//')) return;
  if (!OPEN.test(l)) return;
  const k = itemAt(i);
  if (k < 0) return;
  // Already read and marked? The marker sits within a few lines of the claim it settles.
  const marked = lines.slice(i, i + 10).some(x => MARK.test(x));
  // WHAT THE MARK SAYS, not just that there is one. The O17 write-up put "five of the fifteen
  // are marked STILL OPEN" into the record and the answer was four - a miscount in the very item
  // about miscounts, written an hour after the marks went in. A number in prose drifts; this one
  // is read off the file so the suite can pin it.
  const near = lines.slice(i, i + 12).join(' ');
  const kind = !marked ? 'unread'
             : /\^\^[^\n]*ANSWERED/i.test(near) ? 'answered'
             : /STILL OPEN/i.test(near) ? 'open'
             : 'notaclaim';
  found.push({ line: i + 1, text: l.replace(/^\/\/\s*/, '').trim(), item: items[k].title, marked, kind });
});

const live = found.filter(f => !f.marked);
const show = ALL ? found : live;

console.log(`\n${found.length} present-tense open claims in the record`);
console.log(`  ${found.length - live.length} read since, and marked`);
const by = k => found.filter(f => f.kind === k).length;
console.log(`    ${by('answered')} answered by a later item   ${by('open')} still open   ` +
            `${by('notaclaim')} not an open claim after reading`);
console.log(`  ${live.length} unread\n`);

show.forEach(f => {
  console.log(`  ${SRC.split('/').pop()}:${f.line}${f.marked ? '  [read]' : ''}`);
  console.log(`    in   ${f.item.slice(0, 74)}`);
  console.log(`    says ${f.text.slice(0, 96)}\n`);
});

// The ratchet. NOT "no claim may be open" - open claims are how this file says what it does not
// know, and there should be plenty. The bar is that every one has been read against what came
// after it, and carries a mark saying so. A new item that closes on an open question has to
// mark it in the same breath, which costs a line and is the whole of the fix.
if (!ALL) {
  console.log(live.length === 0
    ? 'CLEAN: every open claim in the record has been read against what followed it.'
    : `${live.length} unread. Mark each ^^ with what settled it, or with why it still stands.`);
}
module.exports = { scan: () => ({ total: found.length, live: live.length, found,
  answered: by('answered'), open: by('open'), notaclaim: by('notaclaim') }) };

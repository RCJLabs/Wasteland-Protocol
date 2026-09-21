// ── T-audit: THE NUMBER THAT WAS SAID TWICE, AND DRIFTED ON THE SECOND COPY ───────────
//
// F03's rule is that the engine books and the harness reads back, because a second copy of a
// constant is one edit from quoting a number the game does not use. This repo enforces that in
// CODE and has for a long time - 180 asserts the wall is exposed as one accessor rather than a
// value and an accessor both, precisely so there is one spelling of it. It has never enforced
// it in PROSE, and prose is where it happened three times, each time to the same two dials:
//
//   game.js     the note explaining the clock named PRESSED_AT - a name that has never existed
//               in this file, since the dial is PRESSED = { at, share } - and gave its value as
//               20. R02b re-cut the clock to 25 eight lines below and left the case for 20
//               standing above it, citing the 19% row of a histogram printed two lines earlier.
//
//   suite 100   E09 wrote one sentence in two places, here and above sectorRewardMult. H13 cut
//               the wall from 1.25 to 1.06 in the very commit that also edited this file, and
//               fixed only the game.js copy. I06 and S05 then moved the pair twice more. The
//               second copy sat at E09's figures through all three.
//
//   suite 180   "the defaults are asserted against the numbers I06 left" - S05 turned the dial,
//               moved the assertion, moved the history line above it, and not that sentence:
//               the one a reader checks to learn WHICH value the suite guards.
//
// THE RULE PINNED HERE IS NARROW ON PURPOSE, because a wide one is not keepable. Prose in this
// tree routinely names a dial that no longer exists - T04's three deletions are recorded by
// name, and should be - and routinely writes a hypothetical, "at OLD_GUARD_VETS = 2 the muster
// offers a card a two-veteran save cannot". Both are correct writing. Of 176 upper-snake names
// this tree mentions in prose, 12 are absent from all of its code and 11 of those are the
// record doing its job in the past tense. What is never correct is the flat present-tense
// claim: a name, then "is", then a number. That form is checkable, and now it is checked.
//
// A CORRECTION QUOTES THE SENTENCE IT CORRECTS. That is how this record is written, from H14's
// paragraph down to the ^^ markers - "corrected below rather than quietly edited out". So text
// inside double quotes is an exhibit and not a claim, and the scan steps over it across line
// breaks, which is where such a quote usually lands.
//
// AND THE SCAN READS ITSELF, which 132 hit first: a suite reporting on a gap must not close the
// gap by mentioning it. Every string this file would otherwise match is assembled from pieces,
// so the crafted input below exercises the checker without becoming a hit in the tree.
const fs = require('fs');
const path = require('path');

const SAYS = /\b([A-Z][A-Z0-9_]{2,})(\.[a-z][\w$]*)?\s+is\s+(-?\d+(?:\.\d+)?)\b/g;

// The numeric dials game.js declares: plain constants, and one-line object literals of numbers
// like the clock's own. Anything else is not a value a sentence can be checked against.
function dialsIn(src) {
  const flat = new Map(), dotted = new Map();
  for (const m of src.matchAll(/^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(-?\d+(?:\.\d+)?)\s*[;,]/gm))
    flat.set(m[1], Number(m[2]));
  for (const m of src.matchAll(/^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\{([^{}]*)\}\s*;/gm))
    for (const f of m[2].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(-?\d+(?:\.\d+)?)\s*(?:,|$)/g))
      dotted.set(`${m[1]}.${f[1]}`, Number(f[2]));
  return { flat, dotted };
}

// files: { name -> source }. Returns the claims that are false, and how many were checkable.
function saidTwice(files) {
  const { flat, dotted } = dialsIn(files['game.js'] || '');
  const inCode = new Set();
  for (const src of Object.values(files))
    for (const line of src.split('\n')) {
      const s = line.indexOf('//');
      for (const m of (s < 0 ? line : line.slice(0, s)).matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) inCode.add(m[1]);
    }
  const bad = [];
  let checked = 0;
  for (const [f, src] of Object.entries(files)) {
    let quoted = false;
    src.split('\n').forEach((line, i) => {
      const s = line.indexOf('//');
      if (s < 0) { quoted = false; return; }   // a quotation does not span a line of code
      let bare = '';
      for (const ch of line.slice(s)) {
        if (ch === '"') { quoted = !quoted; bare += ' '; } else bare += quoted ? ' ' : ch;
      }
      for (const m of bare.matchAll(SAYS)) {
        const name = m[1] + (m[2] || ''), said = Number(m[3]);
        const known = m[2] ? dotted : flat;
        if (known.has(name)) {
          checked++;
          if (known.get(name) !== said) bad.push({ f, line: i + 1, name, said, real: known.get(name) });
        } else if (!inCode.has(m[1])) {
          checked++;                                  // a claim about a name nothing declares
          bad.push({ f, line: i + 1, name, said, real: null });
        }
      }
    });
  }
  return { bad, checked };
}

function treeFiles(root) {
  const out = {};
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|html)$/.test(e.name)) out[path.relative(root, p)] = fs.readFileSync(p, 'utf8');
    }
  })(root);
  return out;
}

module.exports = {
  name: 'A number said twice',
  run: async ({ ok }) => {
    // ── The tree ─────────────────────────────────────────────────────────────────────
    const files = treeFiles(path.join(__dirname, '..', '..'));
    const tree = saidTwice(files);
    const say = v => `${v.f}:${v.line} "${v.name} ${'i' + 's'} ${v.said}"` +
      (v.real === null ? ' - no such name' : ` - it ${'i' + 's'} ${v.real}`);
    ok(`no comment states a dial's value wrongly (${tree.bad.length ? tree.bad.map(say).join('; ') : 'none'})`,
      tree.bad.length === 0);
    // And the check is not passing because it found nothing to check. Twelve when written:
    // GRUDGE.cap four times, PRESSED.at twice, and the wall, the road's end, the tier
    // ceiling, the recruit share and the commander's learning rate once each.
    ok(`and it had ${tree.checked} live claims to check across ${Object.keys(files).length} files`,
      tree.checked >= 10);

    // ── The checker, driven with crafted input ───────────────────────────────────────
    // Assembled from pieces so that naming these cases here does not put them in the tree.
    const C = '/'.repeat(2);
    const LIVE = 'FIXTURE' + '_DIAL';
    const DEAD = 'GHOST' + '_DIAL';
    const game = `const ${LIVE} = 7;\nconst PAIR = { at: 25 };\n`;
    const probe = body => saidTwice({ 'game.js': game, 'note.js': body });

    const wrong = probe(`${C} ${LIVE} ${'i' + 's'} 9, which it never was`);
    ok('a stated value that disagrees with the constant is caught',
      wrong.bad.length === 1 && wrong.bad[0].real === 7 && wrong.bad[0].said === 9);
    ok('the same sentence with the right number is not',
      probe(`${C} ${LIVE} ${'i' + 's'} 7, as it happens`).bad.length === 0);
    const dotted = probe(`${C} PAIR.at ${'i' + 's'} 30 now`);
    ok('a dial written as an object field is checked the same way',
      dotted.bad.length === 1 && dotted.bad[0].real === 25);
    const ghost = probe(`${C} ${DEAD} ${'i' + 's'} 3 and always has been`);
    ok('a claim about a name that nothing in the tree declares is caught',
      ghost.bad.length === 1 && ghost.bad[0].real === null);

    // ── And the three things that are correct writing ────────────────────────────────
    ok('a correction may quote the sentence it corrects',
      probe(`${C} it read "${DEAD} ${'i' + 's'} 3" until today`).bad.length === 0);
    ok('including when the quote wraps, which is where such a quote lands',
      probe(`${C} it read "${DEAD} ${'i' + 's'} 3\n${C} and stayed that way" until today`).bad.length === 0);
    ok('a hypothetical written with = is left alone',
      probe(`${C} at ${LIVE} = 9 the muster offers a card it cannot fill`).bad.length === 0);
    ok('and so is the past tense, which is how the record names what it deleted',
      probe(`${C} ${LIVE} was 9 before T04 took it out`).bad.length === 0);
  },
};

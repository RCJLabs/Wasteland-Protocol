// G11: what the battery never reached.
//
// The runner reported assertions passed and nothing at all about the surface it does not
// touch, so "3,700 green" read as coverage when it is only a count of the things somebody
// thought to check. Measured when this was written: 822 symbols on the engine's one export,
// 148 of them named by no suite - the audit counted 129, so the untouched set grows faster
// than suites close it. Among them victoryWalk and victoryPress, which are the two ways a run
// can end well.
//
// NAMED, NOT EXERCISED. This asks whether a suite mentions the symbol in code at all. That is
// the weakest useful question and the only one answerable without running a coverage
// instrument over a module the page loads. Read the number as a floor on what is untested and
// never as a ceiling on what is tested: a symbol named once and never pressed counts as
// reached, and plenty are.
//
// It lives here rather than inside run.js so it can be driven with crafted input. A readout
// nobody can test is a readout nobody should believe.

// Prose is stripped first. The comments in these suites carry a great many engine names -
// saying WHY a thing exists is most of what they do - and mentioning a symbol there is not
// touching it. The `[^:]` guard keeps `http://` out of the line-comment rule.
function stripComments(src) {
    return String(src)
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// Every identifier-shaped token in the code, as a set. String CONTENTS are included - only
// comments are removed - so a name written as a literal counts as named. Engine names do not
// generally appear inside strings (screen ids and data-actions are hyphenated and tokenise
// apart), but a suite that spells an export out in a string will mark it reached without
// touching it, which is the same weakness as naming it in code and is stated for the same
// reason: this is a floor, not a measure of exercise. Whole tokens only, so `hasSig` is not
// found inside `hasSignal` and a partial name cannot report itself as covered.
function namesIn(sources) {
    const seen = new Set();
    [].concat(sources).forEach(src => {
        stripComments(src).replace(/[A-Za-z_$][\w$]*/g, m => { seen.add(m); return m; });
    });
    return seen;
}

// The exports no suite names, sorted, so two runs of the same tree print the same list.
function untouchedExports(exports, sources) {
    const seen = namesIn(sources);
    return (exports || []).filter(n => !seen.has(n)).sort();
}

// ── N05/N06: state written onto a body and read by nothing ──────────────────────────────
//
// The same question as untouchedExports, one level in: an export nobody NAMES is untested, and
// a field nobody READS is dead. The N-audit found two by hand - boss.learnedSig, which looked
// like the missing half of C09 and turned out to be a copy of a field that already answered the
// question, and ent.deathPlayed, a one-shot guard reset before it was written and then never
// written. L02's aura.type was the same shape and sat in the engine for four letter-series.
//
// A write is `<something>.<field> =`; a read is that field appearing anywhere else. Whole tokens
// only, and comments stripped first, for the same reasons namesIn gives: prose in this file
// mentions engine fields constantly and saying why a thing exists is not reading it.
//
// THE ALLOWLIST IS THE HONEST PART OF THIS. Two kinds of field are written and never read by
// name and are not dead: DOM and canvas properties, which the browser reads; and a cooldown key,
// which is written as `cooldowns.buckshot = 0` and read as `cooldowns[a.cd]` - a dynamic read
// this scan cannot see and should not pretend to. Everything else on the list is a real finding
// or a new exception somebody has to justify in writing, which is the point.
const DOM_WRITTEN = new Set([
    'innerText', 'innerHTML', 'textContent', 'style', 'className', 'id', 'onclick', 'src', 'href',
    'value', 'checked', 'disabled', 'width', 'height', 'transform', 'scrollTop', 'buffer',
    'display', 'title', 'alt', 'type', 'loop', 'volume', 'currentTime', 'opacity', 'gain',
    'placeholder', 'tabIndex', 'dataset', 'ariaLabel', 'textAlign', 'cssText', 'autoplay',
    'muted', 'crossOrigin', 'decoding', 'loading', 'role', 'hidden', 'open', 'selected',
    'visibility', 'borderColor', 'marginBottom', 'backgroundImage', 'onended', 'onkeydown',
    'onchange', 'oninput', 'onmouseenter', 'onmouseleave', 'onerror', 'onload', 'onblur',
    'onfocus', 'onsubmit'
]);

// The one engine field written here and read entirely outside this file: the namespace the page
// hands the harness. Named rather than allowed through a pattern, so it stays a single exception.
const EXTERNAL = ['WP'];

function deadState(src, cooldownKeys) {
    const code = stripComments(String(src));
    const skip = new Set([...DOM_WRITTEN, ...EXTERNAL, ...(cooldownKeys || [])]);
    const written = new Map();
    for (const m of code.matchAll(/\b(\w+)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) {
        if (skip.has(m[2])) continue;
        written.set(m[2], (written.get(m[2]) || 0) + 1);
    }
    // The dot alone, with nothing required in front of it. Requiring `\w+\.` ahead of the name
    // loses the tail of a chain: in `el.dataset.fellBack` the engine matches `el.dataset`,
    // consumes through `dataset`, and never sees `dataset.fellBack` - so fellBack reported as
    // written-and-never-read while the read sat on the line above the write.
    const read = new Set();
    for (const m of code.matchAll(/\.([A-Za-z_$][\w$]*)\b(?!\s*=(?!=))/g)) read.add(m[1]);
    return [...written.keys()].filter(f => !read.has(f)).sort();
}

module.exports = { stripComments, namesIn, untouchedExports, deadState, DOM_WRITTEN, EXTERNAL };

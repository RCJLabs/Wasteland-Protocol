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

module.exports = { stripComments, namesIn, untouchedExports };

# Issue #500 log: pivotLonger's zero-width namesSep splits a surrogate pair

GitHub Issue #500. Session 14, group A1. Fixed: after a zero-width match the split goes on one code point later, so an astral character (two UTF-16 code units) stays whole.

## Plan

- Intent: `separated()` in `src/descriptive/pivot.ts` went on `m.index + 1` code units after a zero-width match (#441), which lands between the halves of a surrogate pair.
- Method: go on by the length of the code point at `m.index` (2 for a high surrogate followed by a low one, else 1). The `u` flag is not used: it changes how JavaScript reads the user's pattern.
- Why: BMP characters, and so every ASCII name, take the same steps as before; only names with astral characters change.

## Reproduction (main `45616ce`, R 4.5.2, tidyr 1.3.2, stringr)

`pivotLonger({ "A😀B": [1] }, { cols: ["A😀B"], namesTo: ["p1", ..., "p5"], namesSep: "(?=.)" })`:

| | p1..p5 |
|---|---|
| rStats.js before | "", "A", "\ud83d", "\ude00", "B" |
| stringr `str_split("A😀B", "(?=.)")` | "", "A", "😀", "B" (then NA) |
| tidyr `pivot_longer` (`gregexpr(perl = TRUE)`, `regmatches(invert = TRUE)`) | "", "A", "😀", "", "" (all pieces: "", "A", "😀", "", "", "", "B"; matches at characters 1 2 3 3 3 3) |
| rStats.js after | "", "A", "😀", "B", null |

tidyr's split goes on inside the four UTF-8 bytes of the emoji and gives empty pieces, which no reading of the separator gives. The correct split is stringr's; "AxB" gives "", "A", "x", "B", NA in tidyr and in rStats.js, before and after.

## Fix

- `src/descriptive/pivot.ts`: `codePointLength(name, i)`; `separated()` advances by it after a zero-width match.
- `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`: the difference from tidyr in the `pivotLonger` entry.

## Tests

- `test/issue500.test.ts`: the issue's call (with tidyr's warning for the missing piece), `"😀😁"` with `""`, and `"AxB"` as before. With `src/` stashed, the first test fails.
- `test/issue441.test.ts` and `test/pivot.test.ts` pass.

## Out of scope (recorded)

- Patterns that can match a lone low surrogate (for example a lookbehind on a high surrogate) can still split a pair; JavaScript's regular expressions without `u` read code units. Not changed.

## close comment

Fixed in <commit of #500, see git log --grep='#500'>. After a zero-width match of `namesSep`, the split now goes on one code point later instead of one UTF-16 code unit, so `"A😀B"` with `"(?=.)"` gives "", "A", "😀", "B", null, as stringr's `str_split`. ASCII and other BMP names are split as before. tidyr 1.3.2 on R 4.5.2 gives "", "A", "😀", "", "" here (`gregexpr(perl = TRUE)` goes on inside the emoji's UTF-8 bytes); the difference is recorded in docs/differences-from-r.md. A test was added: test/issue500.test.ts. (Not pushed yet.)

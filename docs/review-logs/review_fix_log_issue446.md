# Issue #446 log: pivotLonger namesTransform on an unmatched optional capture

GitHub Issue #446. Session 13, judging of the issues classified C. Verdict: not planned (does not reproduce). No code changed.

## Plan

- Intent: run the issue's call on the current main (pivot.ts after #436, #441, #442, #444) through the public API and in tidyr 1.3.2.
- Why: classified C (the quoted line `transform(p[j] ?? null)` is not in the current code).

## Check (main `dfe8bd6`, R 4.5.2, tidyr 1.3.2)

- `pivotLonger({ x1: [10], x: [20] }, { cols: ["x1", "x"], namesTo: ["prefix", "index"], namesPattern: "(x)(\\d+)?", namesTransform: { index: Number } })`: prefix `["x", "x"]`, index `[1, null]`, value `[10, 20]`. Without the transform: index `["1", null]`.
- The issue expects `[1, null]`; that is what main gives. The transform of a `namesTo` column is not called on a missing part (`src/descriptive/pivot.ts`, `p === null || transform === undefined ? p : transform(p)`; the `.value` part likewise since #444). The option's documentation says "missing parts stay missing".
- tidyr: `pivot_longer(d, c(x1, x), names_to = c("prefix", "index"), names_pattern = "(x)(\\d+)?")` gives index `"1"`, `""` (an unmatched optional group is the empty string, not `NA_character_` as the issue says); with `names_transform = list(index = as.integer)` it gives `1`, `NA`. So with a numeric transform the result is the same as main's.

## Earlier decision

- "Missing parts stay missing" is the design of `pivotLonger` since its first version (`ad5391f`), in the JSDoc of `namesTransform`; kept by #444 (`review_fix_log_issue444.md`).

## Fix

- None.

## Tests

- `test/issue446.test.ts`: the issue's call gives index `[1, null]` (and `["1", null]` without the transform).

## Out of scope (recorded)

- Without a transform, tidyr gives `""` for an unmatched optional group and rStats.js gives `null`. A missing part is the more natural value for "this part is absent", and a numeric transform gives the same result (NA) in both. Not listed in `docs/differences-from-r.md`; left as it is unless asked.

## close comment

Not planned: this does not reproduce on the current main. The transform of a namesTo column is not called on a missing part (the line `transform(p[j] ?? null)` quoted in the issue is not in the code; the option is documented as "missing parts stay missing"), so the issue's call gives index [1, null], which is the expected result. tidyr 1.3.2 gives 1, NA with names_transform = list(index = as.integer); note that tidyr itself represents the unmatched optional group as "" rather than NA_character_ before the transform. Added test/issue446.test.ts to keep this. (Not pushed yet.)

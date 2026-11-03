# Issue #242 log: the triangular skewness at a scale of 1e-200 (already fixed in #144)

GitHub Issue #242. Session 11, judging of the issues classified C. Verdict: completed, fixed by #144 (and #243 since). No code changed; a test of the issue's example added.

## Plan

- Intent: confirm that `distSummary("triang", { a: 0, b: 1e-200, c: 5e-201 })` no longer gives a NaN skewness, and find the fixing commit.
- Method: run the example and an asymmetric one at the same scale on the current main; `git log --grep='#144'`.
- Why: the triage found it fixed by #144, which formed the skewness from the parameters scaled by a power of 2.

## Check (main `6152a25`)

| Parameters | sd | skewness | kurtosis |
|---|---|---|---|
| a 0, b 1e-200, c 5e-201 (the issue) | 2.0412414523193148e-201 | 0 | -0.6 |
| a 0, b 1e-200, c 2e-201 | 2.1602468994692866e-201 | 0.476136051311598 | -0.6 |
| a 0, b 1, c 0.2 | 0.21602468994692867 | 0.476136051311598 | -0.6 |
| a 0, b 1e200, c 2e199 | 2.1602468994692866e199 | 0.4761360513115978 | -0.6 |

The skewness is 0 for the symmetric example, as the issue expects, and does not depend on the scale. The variance is 0 at 1e-200 (its true value 4.2e-402 is below the double range) and Infinity at 1e200, as expected; the sd is computed directly.

## The fix

- `d94b9a7` "distSummary triang: the skewness from the scaled parameters where their cubes are out of range (#144)" (pushed; on origin/main). test/issue144.test.ts checks the skewness of (0, 3s, s) for s = 2^k from k = -1072 to 1022.
- Since then `c2d7b75` (#243) forms q from differences, q = (b - a)(b - c) + (c - a)^2, so it no longer cancels.

## Tests

- `test/issue242.test.ts`: the issue's example (skewness 0, sd 2.0412414523193148e-201) and the asymmetric example at 1e-200 (the skewness of the same shape on [0, 1]).

## close comment

Fixed by #144 (commit d94b9a7): the triangular skewness is formed from the parameters scaled by a power of 2, so it no longer depends on the scale. distSummary("triang", { a: 0, b: 1e-200, c: 5e-201 }) now gives skewness 0 and sd 2.0412414523193148e-201 (kurtosis -0.6; the variance itself, 4.2e-402, is below the double range and is 0). With c = 2e-201 the skewness is 0.476136051311598, the same as on [0, 1] with mode 0.2. A test of the issue's example was added: test/issue242.test.ts. (Not pushed yet.)

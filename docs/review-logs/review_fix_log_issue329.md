# Issue #329 log: flignerTest with a group whose median is infinite

GitHub Issue #329. Session 12.

## Plan

- Intent: a group whose median is infinite (half its values Infinity, or both infinities) has deviations Inf - Inf = NaN. `rank()` assumes no NaN, so the NaN got an ordinary rank from the index tie-break and the test returned a finite statistic.
- Method: throw "a group has an infinite median: its deviations are undefined" when a deviation is NaN. Only that case is rejected: an infinite value about a finite median has deviation Inf, which ranks last, and R gives the same value (rejecting every infinite value would change results that R and the old code agree on). R ranks the NaN last and returns a value, so the case is added to "Input that has no meaning is an error" in `docs/differences-from-r.md` (policy, as #304).

## Check (main `7815130`, R 4.5.2)

| call | R's `fligner.test` | before |
|---|---|---|
| `flignerTest([1, Infinity, 2, 3], ["a", "a", "b", "b"])` | 2.4760775195993685, p 0.11559020321652083 (NaN ranked last) | 2.758358769480958, p 0.09674744412948381 |
| `flignerTest([1, Infinity, 5, 2, 3], ["a", "a", "a", "b", "b"])` | 0.54581122989749336, p 0.46003429246081247 | 0.5458112298974939, p 0.4600342924608123 (unchanged) |
| `flignerTest([1, 4, 5, 2, 3, -Infinity], [a, a, a, b, b, b])` | 0.12200868985373261, p 0.7268660327638667 | 0.12200868985373306, p 0.7268660327638662 (unchanged) |

No fixture has an infinite value.

## Fix

- `src/htest/rankTests.ts` (`flignerTest`): the check after the deviations are formed.

## Tests

- `test/issue329.test.ts`: the error for a median of Infinity and of NaN (`[-Infinity, Infinity]`); R's value with Infinity about a finite median. With `src/` stashed, the error test fails.
- `test/htest-basic.test.ts`, `test/review59.test.ts`, `test/formulaTests.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #329, see git log --grep='#329'>. `flignerTest` now throws "a group has an infinite median: its deviations are undefined" when a group's median is infinite (for example `flignerTest([1, Infinity, 2, 3], ["a", "a", "b", "b"])`). The deviations were Inf - Inf = NaN, and the NaN got an ordinary rank (2.758, p 0.0967; R ranks it last and gives 2.476, p 0.116). An infinite value about a finite median still ranks last and gives R's value; recorded in docs/differences-from-r.md. (Not pushed yet.)

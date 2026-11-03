# Issue #303 log: chisqTest rescaleP with weights whose total overflows

GitHub Issue #303. Session 12.

## Plan

- Intent: with `rescaleP: true`, `goodnessOfFit` divides each weight by `ddSum(p)`. For finite weights whose total overflows (p = [1e308, 1e308]) the total is Inf, every probability 0, the expected counts 0 and the statistic Inf.
- Method: only where the total is not finite, divide the weights by 2^e (2^e >= k) first, an exact rescaling, then sum and divide. Where the total is finite the code is the old one (same bits).
- Why a power of 2 rather than the largest weight: the rescaled probabilities are then the same bits as those of the weights divided by 2^e, i.e. of an ordinary input.

## Check (main `e78a658`)

| call | R 4.5.2 | before | after |
|---|---|---|---|
| `chisqTest([1, 1], { p: [1e308, 1e308], rescaleP: true })` | Inf, 0 | Inf, 0 | 0, 1, expected [1, 1] |
| `chisqTest([1, 3], { p: [1e308, 1.5e308], rescaleP: true })` | Inf, 0 | Inf, 0 | 0.3750000000000001, 0.5402913746074199 |
| `chisqTest([1, 3], { p: [1e300, 1.5e300], rescaleP: true })` | 0x1.8000000000002p-2, 0x1.14a112307fdf9p-1 | same as R | unchanged |

R returns the same wrong value, so the overflow case differs from R (docs rows added).

## Fix

- `src/htest/chisqTest.ts`, `goodnessOfFit`: the rescaling above.

## Tests

- `test/issue303.test.ts`: the issue's call, and [1e308, 1.5e308] equal to [1e300, 1.5e300] (R's value). With `src/` stashed it fails.
- chisqTest tests and `npx tsc --noEmit -p .`: pass, no errors.
- Docs: `docs/differences-from-r.md`, `docs/ja/differences-from-r.md` (overflow table).

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #303, see git log --grep='#303'>: with `rescaleP: true`, where the total of the finite weights overflows, chisqTest divides the weights by a power of 2 (at least the number of cells) before normalizing, so `chisqTest([1, 1], { p: [1e308, 1e308], rescaleP: true })` gives statistic 0, p-value 1 (was Inf, 0; R gives Inf, 0 as well, recorded in docs/differences-from-r.md). Weights with a finite total are unchanged. Test: test/issue303.test.ts. (Not pushed yet.)

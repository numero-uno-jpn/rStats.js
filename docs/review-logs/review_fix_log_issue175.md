# Issue #175 log: glmPredict's standard-error norm overflows before the small dispersion is applied

GitHub Issue #175. Session 11, judging of the issues classified C, then user decision 6 (option A). The issue's own example does not reproduce (the triage was right about it), but the mechanism it describes does with a slightly larger newdata. Fixed.

## Plan

- Intent: check the issue's example on the current main, then the mechanism: in the fallback for a sum of squares out of the normal range, `top * Math.sqrt(sum((z / top)^2)) * Math.sqrt(disp)` (src/models/glm.ts, glmPredict) is evaluated left to right, so the norm of z can overflow before sqrt(disp) brings it back.
- Method: run the issue's call and newdata [1.5e308, 1.5e308], [1.7e308, +-1.7e308]; compare with the same newdata divided by 2^100 and multiplied back (the standard error is linear in newdata), and with R.
- Why: a C verdict needs the defect not to be reachable; if it is, the fix is written up with options instead of changed.

## Check (main `cb44f6a`, R 4.5.2)

`fit = glm([[0, 0], [1, 0], [0, 1], [1, 1]], [0, 1, 1, 2], { family: "gaussian" })`, `glmPredict(fit, { newdata: [nd], dispersion: 1e-300 })`:

| nd | seFit (rStats.js) | true (nd / 2^100, times 2^100) | R 4.5.2 se.fit |
|---|---|---|---|
| [1e308, 1e308] (the issue) | 1.4142135623730952e158 | 1.4142135623730952e158 | Inf |
| [1.5e308, 1.5e308] | **Infinity** | 2.1213203435596427e158 | Inf |
| [1.7e308, 1.7e308] | **Infinity** | 2.4041630560342617e158 | |
| [1.7e308, -1.7e308] | **Infinity** | 2.4041630560342617e158 | |
| [1.7e308, 0] | 1.7e158 | 1.7e158 | |
| [1e154, 1e154] | 14142.135623730954 | 14142.13562373095 | |

- The issue's example is fine: the norm of z there is about 1.414e308, below Number.MAX_VALUE, so the product in the fallback stays finite. The triage's "#63 rescaling already handles it" holds for that input only.
- For a norm of z above Number.MAX_VALUE, `top * sqrt(...)` overflows and the standard error is Infinity while its true value is about 2e158. R gives Inf (its `rowSums((X %*% Rinv)^2)` overflows already at [1e308, 1e308]).

## Decision (user decision 6)

Option A of the judging, which was recommended (the others were B: always order the fallback as top (sqrt(sum) sqrt(disp)), which may change the last bit of fallback results that are right now; C: not planned). R gives Inf, so the docs record the difference.

## Fix

- `src/models/glm.ts`, `glmPredict`: in the fallback for a sum of squares out of the normal range, where `top * norm * sqrt(disp)` is not finite, the standard error is `top * (norm * sqrt(disp))`. Every result that was finite keeps its bits.
- `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`: a row after issue #196's.

| newdata (dispersion 1e-300) | before | after | newdata / 2^100, times 2^100 | R 4.5.2 |
|---|---|---|---|---|
| [1.5e308, 1.5e308] | Infinity | 2.1213203435596427e158 | 2.1213203435596427e158 | Inf |
| [1.7e308, 1.7e308], [1.7e308, -1.7e308] | Infinity | 2.4041630560342617e158 | 2.4041630560342617e158 | |
| [1e308, 1e308], [1.7e308, 0], [1e154, 1e154] | 1.4142135623730952e158, 1.7e158, 14142.135623730954 | unchanged | | |

## Tests

- `test/issue175.test.ts`: the three newdata above against the scaled values, and the unchanged values. With `src/` stashed, the first block fails.
- `test/glm.test.ts`, `test/review63.test.ts`, `test/issue174.test.ts`, `test/scaleInvarianceModels.test.ts` pass; `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #175, see git log --grep='#175'>. The issue's own example ([1e308, 1e308] with dispersion 1e-300) already gave the right 1.4142135623730952e158, as the norm of z (about 1.41e308) stays below the largest double. With newdata [1.5e308, 1.5e308] the norm exceeds it, and the fallback's top * sqrt(sum) overflowed before sqrt(dispersion) brought it back: Infinity for 2.1213203435596427e158. Now, only where that product is not finite, sqrt(dispersion) is applied to the norm first; the values for [1.5e308, 1.5e308], [1.7e308, 1.7e308] and [1.7e308, -1.7e308] equal those for the newdata divided by 2^100, times 2^100, and every finite result keeps its bits. R 4.5.2 gives Inf (its sums of squares overflow already at [1e308, 1e308]); the difference is recorded in docs/differences-from-r.md. A test was added: test/issue175.test.ts. (Not pushed yet.)

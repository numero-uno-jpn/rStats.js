# Issue #175 log: glmPredict's standard-error norm overflows before the small dispersion is applied

GitHub Issue #175. Session 11, judging of the issues classified C. Verdict: **Awaiting decision.** The issue's own example does not reproduce (the triage was right about it), but the mechanism it describes does with a slightly larger newdata. No code was changed.

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

## Options

- **A (recommended):** in the fallback only, where `top * sqrt(sum) * sqrt(disp)` is not finite, multiply as `top * (sqrt(sum) * sqrt(disp))` (or put sqrt(disp) on top first). Values that are finite now keep their bits; [1.5e308, 1.5e308] gives about 2.12e158. R differs (Inf), so the docs record it with the other glmPredict overflow fallbacks.
  - Pros: local, one line, ordinary values unchanged. Cons: none beyond the R difference.
- **B:** always order the fallback as `top * (sqrt(sum) * sqrt(disp))`.
  - Pros: no extra test. Cons: may change the last bit of the fallback's results where the squares underflowed (z below 1e-154), which are now right.
- **C:** not planned: the issue's example already works; only newdata within a factor of about 1.3 of Number.MAX_VALUE with a tiny dispersion reaches it.

## close comment

Awaiting a decision; see review_fix_log_issue175.md. (Not pushed yet.)

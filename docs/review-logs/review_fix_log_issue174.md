# Issue #174 log: glmPredict gives NaN where the products of the linear predictor overflow and cancel

GitHub Issue #174. Session 11, group P7 (user decision of the fourth round: the NaN of `glmPredict`'s eta from new data is fixed under #174 if it is the place the issue describes, otherwise as a follow-up of #195).

## Plan

- Intent: `glmPredict` with `newdata` sums x_j b_j left to right (in the units of the fit's scaled view). With finite new data and coefficients, the products can overflow and cancel, so the linear predictor is NaN although x'b is in range.
- Same place as the issue: the issue describes exactly this line (`s + v * coefficient` for the new-data predictor in `glmPredict`), so the fix is committed under #174. The triage had classified #174 as C because the issue's own example no longer gives NaN (see below); the line itself still does for other data.
- Method: only where the plain sum is not finite, take x'b again with the exact inner product of `src/linalg/dot.ts` (`rescaledDot`, #208) over the coefficients that are not NaN, as `predict` for lm (#195) and the rows of weight 0 of `fitLm` (#193). The offset is added afterwards as before.
- Why this: the plain sum is kept wherever it is finite (the same bits); inside the fallback the value is the correctly rounded exact x'b. A NaN or infinite entry keeps the plain sum.
- R gives NaN (R 4.5.2), so the new value is recorded in docs/differences-from-r.md and docs/ja (a row next to #195 and #193).

## The issue's example

`glm([[1, 0], [0, 1], [1, 1]], [2, -2, 0], { family: "gaussian" })` with newdata (1e308, 1e308):

- On main the prediction is already finite: 3.99168061906944e292 (`0x1p+972`). A gaussian fit is stored on y / 2^k (`scaledView`, k = 1 here), so in its units the slopes are about 1 and -1 and the products do not overflow. The value is unchanged by this fix (the plain sum is finite). Its `seFit` is NaN because the residual degrees of freedom are 0 (the dispersion is NaN; correct).
- The issue expects 0, which is wrong: the least-squares coefficients are not exactly (0, 2, -2). In rStats.js they are -0, 2 + 2 ulp (`0x1.0000000000002p+1`) and -(2 + 1 ulp) (`-0x1.0000000000001p+1`); in R `0x1.279a74590331dp-52`, `0x1.0000000000001p+1`, `-0x1.0000000000001p+1`. The exact x'b for the rStats.js coefficients is 1e308 * 2^-51 = 4.4408920985006262105e292 (`0x1.1ccf385ebc8ap+972`, Rmpfr). The plain sum 0x1p+972 differs from it by the rounding of the products (the same size of error as for newdata 1e300, where nothing overflows), as R would give where it does not overflow. R gives NaN for this example.

## Check (main `12b8aea`)

Data where the products overflow in the units of the fit: `glm([[0.5, 0], [0, 0.5], [0.5, 0.5]], [2, -2, 0], { family: "gaussian" })` (k = 1; coefficients -0, 4 + 2 ulp, -(4 + 1 ulp); R `0x1.279a74590331dp-52`, `0x1.0000000000001p+2`, `-0x1.0000000000001p+2`).

| newdata | R 4.5.2 | Before | After | True value (Rmpfr) |
|---|---|---|---|---|
| (1e308, 1e308), link and response | NaN | NaN | 8.881784197001252e292 (`0x1.1ccf385ebc8ap+973`) | `0x1.1ccf385ebc8ap+973` (8.8817841970012524209e292, for these coefficients) |
| (1e308, 1e308), newoffset 2^973 | | NaN | `0x1.0e679c2f5e45p+974` (exact) | |
| (1e300, 1e300) (plain sum finite) | | 1.1896135267822265e285 | the same bits | |
| (1, 2) | | -4 | -4 | |
| (1e308, NaN), (1e308, Inf) | | NaN | NaN | |

A poisson fit (not scaled) with newdata 1e300 and 1e308 gives the same values as before (3.0081547934585976e300 and Infinity on the link scale).

## Fix

- `src/models/glm.ts` (`glmPredict`): the new-data eta of a row whose plain sum is not finite is `rescaledDot` of the row and the coefficients restricted to the columns whose coefficient is not NaN, plus the offset.

## Tests

- `test/issue174.test.ts`: the prediction above (link, response, with an offset), and unchanged values where the plain sum is finite, for NaN and Inf entries, and for the issue's own example. With `src/` stashed the first test fails and the second passes.
- `npx vitest run`: 328 files passed (2736 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- The standard errors of the 0.5 example are NaN because the residual degrees of freedom are 0 (as the issue's example); unchanged.

## close comment

Fixed in <commit of #174, see git log --grep='#174'>: where the plain sum of a new-data row's linear predictor is not finite, `glmPredict` now takes x'b again with the exact inner product used by `matMul` and `predict` for lm (#208, #195): each product as an integer times a power of 2, summed exactly and rounded once. The issue's own example was already finite on main (a gaussian fit is stored on y / 2, so its products do not overflow): it gives 3.99168061906944e292, unchanged. The expected 0 is not right: the least-squares coefficients are 2 + 2 ulp and -(2 + 1 ulp) (in R too they are not exactly 2 and -2), and the exact x'b for them is 4.4408920985006262e292 (Rmpfr); the plain sum differs from it by the rounding of the products, as in the normal range. With data where the products do overflow, e.g. `glm([[0.5, 0], [0, 0.5], [0.5, 0.5]], [2, -2, 0], { family: "gaussian" })` and newdata (1e308, 1e308), the prediction was NaN (R too) and is now 8.881784197001252e292, the exact value for the coefficients (Rmpfr agrees to the bit). Rows whose plain sum is finite keep their values, and a NaN or infinite entry still gives NaN. Recorded in docs/differences-from-r.md.

Test: test/issue174.test.ts. (Not pushed yet.)

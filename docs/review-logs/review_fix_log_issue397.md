# Issue #397 log: the monoH.FC limiter where the slope ratios overflow

GitHub Issue #397. Session 13, group 5b (interpolation fallbacks).

## Plan

- Intent: `fritschCarlsonSlopes` tests (alpha, beta) = (m_k, m_{k+1}) / S_k against the Fritsch-Carlson region with `alpha * (a + b) < a * a` and normalises with sqrt(alpha^2 + beta^2). For secants 1e-200 and 1e200, beta = 5e399 overflows, the test is `Inf < Inf` (false), the limiter is skipped and the spline overshoots to -6.25e198.
- Method (fallback only): where alpha (a + b), a^2 or alpha^2 + beta^2 is not finite with finite slopes and secant, alpha and beta are formed divided by 2^g, the power of 2 of the larger (by `scaledProduct`, #400), and 3 by the same 2^g. The test is homogeneous of degree 2 in (alpha, beta, 3) and the limited slopes 3 S_k (alpha, beta) / sqrt(alpha^2 + beta^2) of degree 0, so this is the same test and the same slopes. Elsewhere the same expressions as before (the same bits).

## Check (main after #401, R 4.5.2)

| call | R | before | after |
|---|---|---|---|
| `splinefun([0, 1, 2], [0, 1e-200, 1e200], monoH.FC)([0.5, 1.5])` | -0x1.4e718d7d7625dp+660 (-6.25e198), 4.375e199 | the same | 1.25e-201, 3.75e199 |
| `splinefun([0, 1, 2], [0, 1, 10], monoH.FC)([0.5, 1.5])` | 0.20582579729272399, 4.7427177533840954 | 0.205825797292724, 4.742717753384095 | the same |

In exact arithmetic the limited slopes of the first interval are 3 S_0 / sqrt(1 + beta^2) (about 6e-600, 0 in doubles) and 3 S_0 beta / sqrt(1 + beta^2) (3e-200 up to a relative 1e-800); the second interval is then not limited (alpha about 3e-400). The new values equal `splinefunH([0, 1, 2], [0, 1e-200, 1e200], [0, 3e-200, 1e200])` and are increasing on [0, 1].

## Fix

- `src/numerics/interp.ts` `fritschCarlsonSlopes`.
- docs (en, ja): a row in the overflow table.

## Tests

- `test/issue397.test.ts`: the rows above, monotonicity on [0, 1]. With `src/` stashed the first test fails.
- `issue398` to `issue401`, `issue125`, `issue380`, `numerics`, `jstat-replacement`: pass. `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #397, see git log --grep='#397'>: where the Fritsch-Carlson ratios or their products overflow, the monoH.FC limiter now tests and normalises (alpha, beta) divided by a common power of 2 (the test is homogeneous in (alpha, beta, 3), the limited slopes do not depend on the scale). `splinefun([0, 1, 2], [0, 1e-200, 1e200], { method: "monoH.FC" })([0.5])` is 1.25e-201 and the spline is monotone (was -6.25e198, R gives the same -6.25e198; recorded in docs/differences-from-r.md). Where the products are in range the slopes are unchanged. Test: test/issue397.test.ts. (Not pushed yet.)

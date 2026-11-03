# Issue #189 log: the gaussian AIC overflows in 2 pi deviance although it is finite

GitHub Issue #189. Session 11, group A3.

## Plan

- Intent: `familyAic` for gaussian evaluates `nPos * (log(2 pi dev / nPos) + 1) + 2 - sum log w`, R's form. For `glm([[]], [1e154], gaussian, log, no intercept)` the deviance is 1e308, `2 pi dev` overflows to Infinity, and the AIC is Infinity although it is about 714.
- Method: keep `log(2 pi dev / nPos)` wherever `2 pi dev / nPos` is finite; only where it is Infinity while the deviance is finite, use `log(2 pi) + log(dev / nPos)`.
- Why: the fallback is reached only where the old value was Infinity, so every finite AIC keeps its bits (R's values). `dev / nPos` is finite for a finite deviance and nPos >= 1. Gaussian fits on the identity link are already scaled (`scaledView`, the 2 n k log 2 term), so this concerns the other links.

## Check (main after #188; R 4.5.2, Rmpfr with 200 bits)

| Fit | R 4.5.2 | Rmpfr | Before | After |
|---|---|---|---|---|
| Issue's example, deviance 1e308 | Inf | 714.03408570857541617 | Infinity | 714.0340857085754 |
| y = (1e154, 1e153), no parameters, deviance 1.01e308 | | 1424.7017777177372778 | Infinity | 1424.7017777177373 |
| gaussian log, x = 1..5, y = (1.3, 3.1, 2.2, 5.7, 4.1) | | | 20.69517852756981 | unchanged |
| gaussian identity, same data, weights (1, 2, 3, 0, 1) | | | 13.951501536503502 | unchanged |
| gaussian identity, y times 1e200 | | | 4625.282987799578 | unchanged |

(The Rmpfr references take the deviance's double from JS as a hex float.)

## Fix

- `src/models/glmFamily.ts` (`familyAic`, gaussian): the fallback for an overflowing `2 pi dev / nPos`.
- Docs: a row in "Where R fails and rStats.js returns a value" (English and Japanese).

## Tests

- `test/issue189.test.ts`: the two fits above against the Rmpfr values rounded to double, and the unchanged AICs of the three other fits. With src stashed the first test fails.
- Full `npx vitest run`: 306 files passed. `npx tsc --noEmit -p .`: exit 0.

## Out of scope

- The inverse.gaussian branch of `familyAic` has the same form, `sw * (log(2 pi dev / sw) + 1) + ...` (already recorded under #164), and overflows the same way. Not in this issue; not changed.

## close comment

Fixed in <commit of #189, see git log --grep='#189'>: the gaussian AIC now takes log(2 pi) + log(dev / n) where 2 pi × dev overflows although the deviance is finite. The issue's example gives AIC 714.0340857085754 (Rmpfr 714.034085708575416; was Infinity, R 4.5.2 also gives Inf, recorded in docs/differences-from-r.md). AICs where 2 pi × dev / n is finite are unchanged. Test: test/issue189.test.ts. (Not pushed yet.)

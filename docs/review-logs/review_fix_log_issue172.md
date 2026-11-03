# Issue #172 log: scoreStatistic squares residuals before applying small weights

GitHub Issue #172. Session 11, judging of the issues classified C. Verdict: **Awaiting decision.** The triage classified it C (internal function, not reached from the public API), but it is reached: glmAnova's Rao test on a Poisson fit with tiny fitted means gives Infinity for a finite statistic. No code was changed.

## Plan

- Intent: check whether the overflow of `v[i] * (r[i] - centre) ** 2` in `scoreStatistic` (src/models/glmConfint.ts) can be reached through the public API, as the triage said it could not.
- Method: `scoreStatistic` is not exported (src/index.ts and src/entries/*.ts). Its callers are glmAnova (`test: "Rao"`, the smaller fit's working residuals and weights) and glmConfint (`test: "Rao"`, the restricted fit's). Look for a family where the working residual is huge and the working weight tiny: Poisson with the log link has r = (y - mu) / mu and v = w mu, so a tiny mu with y = 1 gives r about 1/mu and v about mu.
- Why: a C verdict needs the public API not to reach the defect; if it does, the fix needs a decision (the form of the sum of squares), so it is written up with options instead of changed.

## Check (main `b0dcd2d`, R 4.5.2)

The triage's Gaussian example (y = +-1e200, weights 1e-200) gives the right 4e200 through glmAnova, because the Gaussian fit is computed on the scaled response. But:

```ts
const y = [1, 0, 0, 0];
const off = [-460, -460, -460, -460];
const f0 = glm([[], [], [], []], y, { family: "poisson", intercept: false, offset: off }); // y ~ 0 + offset
const f1 = glm([[], [], [], []], y, { family: "poisson", intercept: true, offset: off });  // y ~ 1 + offset
glmAnova([f0, f1], { test: "Rao" });
```

| | rStats.js | true value |
|---|---|---|
| f1 | converged, intercept 458.61370564815866, deviance 2.772588722239782 | |
| Rao (offset -460) | **Infinity**, p 0 | (1 - 4 mu)^2 / (4 mu) = 1.4907392428523152e199, mu = e^-460 |
| Rao (offset -40) | 58846316709254940 | 58846316709255000 (same formula) |

The score statistic of the intercept added to an offset-only Poisson model is (sum (y - mu))^2 / sum mu, finite here. With mu = e^-460 the working residual of the row y = 1 is about e^460 = 1.5e199; its square overflows before the weight mu multiplies it, so the total is Infinity while the QR residual sum of squares (formed from sqrt(v) r) is finite.

R 4.5.2 (`anova(f0, f1, test = "Rao")`) gives Rao 1.1259e15 (0x1.ffffffffffffp+49) for both offsets, because R's poisson linkinv clips mu at .Machine$double.eps (the deviance of f0 is 70.087 instead of 918). rStats.js does not clip (review 62, user decision), so R is no reference here.

## Options

- **A (recommended):** only where `total` is not finite for finite inputs, form it again as the sum of (sqrt(v) (r - centre))^2, the same form as the residual sum of squares, with the terms scaled by a power of 2 if those overflow too (and the result scaled back). Every finite total keeps its bits; the example gives about 1.49e199. The same guard can cover the weighted centre (sw and swr summed after dividing the weights by a power of 2), which is #173's mechanism.
  - Pros: local, ordinary values unchanged, consistent with the rss.
  - Cons: one more branch in a helper used only by the Rao tests.
- **B:** always form the total as sum of (sqrt(v)(r - centre))^2.
  - Pros: one form for both sums.
  - Cons: changes the last bits of every Rao statistic (the existing fixtures of glmAnova would need checking).
- **C:** not planned (record only): the case needs fitted means below about 1e-154 at an observation y > 0, a very poor fit.
  - Pros: no change. Cons: Infinity and p 0 for a finite statistic stay.

## Out of scope

- glmConfint's Rao profile uses the same helper on the restricted fits; not probed separately.

## close comment

Awaiting a decision; see review_fix_log_issue172.md. (Not pushed yet.)

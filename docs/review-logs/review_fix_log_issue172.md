# Issue #172 log: scoreStatistic squares residuals before applying small weights

GitHub Issue #172. Session 11, judging of the issues classified C, then user decision 6 (option A). The triage classified it C (internal function, not reached from the public API), but it is reached: glmAnova's Rao test on a Poisson fit with tiny fitted means gave Infinity for a finite statistic. Fixed.

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

## Decision (user decision 6)

Option A of the judging, which was recommended (the other options were B: always form the total as the sum of (sqrt(v) (r - centre))^2, changing the last bits of every Rao statistic; C: not planned). Only where the total sum of squares is not finite is it formed again from sqrt(v) (r - centre), the form of the residual sum of squares.

## Fix

- `src/models/glmConfint.ts`, `scoreStatistic`: where `total` is not finite and the terms sqrt(v) (r - centre) and the QR residuals are finite, both sums of squares are formed from those terms divided by 2^k (2^k at most their largest size) and the difference is multiplied back by 2^k twice. Every finite total keeps its value (the old expression is returned).
- No docs entry: the statistic was Infinity and is now the true value; R's 1.1259e15 differs because R clips the Poisson mean at 2.2e-16, a difference already recorded (`glm` with the log link where eta < -36).

| offset | before | after | true (Rmpfr, (1 - 4 mu)^2 / (4 mu)) |
|---|---|---|---|
| -460 | Infinity | 1.4907392428523158e199 | 1.4907392428523152e199 (0x1.8edac1ace3095p+661) |
| -700 | Infinity | 2.5355801368375118e303 | 2.5355801368375113e303 (0x1.d945df4f8ec8ep+1007) |
| -40 | 58846316709254940 | 58846316709254940 (unchanged) | |

The 3 to 4 ulp left come from the fitted mean (the fit's intercept), not from the sums.

## Tests

- `test/issue172.test.ts`: the two offsets above (within 1e-14 of Rmpfr, p value 0) and the unchanged value at offset -40. With `src/` stashed, the first fails (Infinity).
- `test/glmAnova.test.ts`, `test/glmConfint.test.ts`, `test/issue173.test.ts` pass; `npx tsc --noEmit -p .`: no errors.

## Out of scope

- glmConfint's Rao profile uses the same helper on the restricted fits; not probed separately.

## close comment

Fixed in <commit of #172, see git log --grep='#172'>. The helper is internal, but glmAnova's Rao test reaches it: for y = (1, 0, 0, 0) with offset -460, the score statistic of an intercept added to the offset-only Poisson model was Infinity, as the working residual of the first row (about e^460) was squared before its weight (about e^-460) applied. Where the weighted total sum of squares is not finite, it is now formed again from sqrt(v) (r - centre), the form of the residual sum of squares, with both sums scaled by a power of 2 when those squares overflow too. The example gives 1.4907392428523158e199 (true 1.4907392428523152e199), offset -700 gives 2.5355801368375118e303, and finite totals keep their values (offset -40: 58846316709254940 as before). R 4.5.2 gives 1.1259e15 here because its Poisson link clips the mean at 2.2e-16, which rStats.js does not do. A test was added: test/issue172.test.ts. (Not pushed yet.)

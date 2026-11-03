# Issue #480 log: inverse Gaussian deviance contribution where (y - mu)/mu overflows

GitHub Issue #480. Session 13, group A2 (the case after #164's fallback).

## Plan

- Intent: `inverseGaussianDev` computes w (y - mu)² / (y mu²) and, where that leaves the doubles, w ((d d) / y) with d = (y - mu)/mu (#164). When d, d² or d²/y overflows, that fallback is Infinity too, although a small weight brings the value back into range.
- Method: only where the fallback is not finite (w, y, mu positive and finite), w, y - mu, y and mu are brought to [1, 2) by their powers of 2 and the product is formed from the mantissas, the exponents added back last (`exponentOf` and `ldexp`, as the poisson and Gamma fallbacks of #371 and #372). Where either earlier form is finite, the same bits. Also serves quasi with variance `mu^3`.

## Reproduction (main `c06f1de`, R 4.5.2, Rmpfr)

| devContribution(y, mu, w) | R 4.5.2 | before | after | Rmpfr |
|---|---|---|---|---|
| (1e200, 1e-200, 1e-300) (issue) | Inf | Inf | 9.999999999999999e299 | 0x1.7e43c8800759cp+996 (1e300, one ulp above) |
| (1e200, 1e-50, 1e-300) (d finite, d² overflows) | Inf | Inf | 1 - 2^-53 | 0.99999999999999997956 (rounds to 1) |
| (1e-308, 1e308, 1) (#164) | NaN | 1e308 | the same | |
| (2, 3, 0.5) | | 2001599834386887 2^-56 | the same | |

Doubles passed to Rmpfr as mantissa times power of 2. R's `dev.resids` is Inf; recorded in docs.

## Cause

`src/models/glmFamily.ts` `inverseGaussianDev`: the fallback `w * ((d * d) / y)` overflows before the weight is applied.

## Fix

- `inverseGaussianDev`: the mantissa and exponent form above, after the two existing forms.
- docs (en, ja): the inverse Gaussian deviance row (#164) extended.

## Tests

- `test/issue480.test.ts`: the two cases (within 2 ulp of Rmpfr) and two earlier values (bit for bit). With `src/` stashed the first test fails.
- `glm`, `issue164`, `issue189`, `issue479`, `review62`, `review63`, `scaleInvarianceModels` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- A weight of 0 with an overflowing contribution stays NaN here (0 × Inf); the callers leave rows of weight 0 out (65th decision). Not changed.

## close comment

Fixed in <commit of #480, see git log --grep='#480'>: where (y - mu)/mu, its square or the square over y overflows, the inverse Gaussian deviance contribution (also quasi with variance mu^3) is formed from the mantissas of w, y - mu, y and mu with their powers of 2 added back last, so `devContribution(1e200, 1e-200, 1e-300)` is 1e300 (was Infinity; R 4.5.2 Inf, recorded in docs/differences-from-r.md). Where the direct form or #164's fallback is finite, the values are unchanged. Test: test/issue480.test.ts. (Not pushed yet.)

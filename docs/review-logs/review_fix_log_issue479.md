# Issue #479 log: inverse Gaussian AIC where 2 pi dev overflows

GitHub Issue #479. Session 13, group A2 (out of scope of #164, recorded there).

## Plan

- Intent: `familyAic` for inverse.gaussian computes log((2 pi dev) / sw); 2 pi dev overflows for a finite dev above MAX / (2 pi) although dev / sw and the AIC are finite.
- Method: as the gaussian AIC of #189, only where 2 pi dev overflows and dev is finite, log(2 pi) + log(dev / sw); where dev / sw overflows as well (sw < 1), log(dev) - log(sw). R's order dev / sw × 2 pi was not taken: it would change the last bit of ordinary AICs, which keep their bits this way.

## Reproduction (main `1e150d6`, R 4.5.2, Rmpfr)

| familyAic(inverse.gaussian, y, mu, w, dev) | R 4.5.2 | before | after | Rmpfr |
|---|---|---|---|---|
| y = 1, w = 1e308, dev = 3e307 (issue) | 0x1.d159f41411c0cp+1023 | Inf | 0x1.d159f41411c0bp+1023 | 0x1.d159f41411c0cp+1023 |
| y = 1, w = 1e-10, dev = 1e308 | Inf | Inf | 0x1.0000009dda58fp+1 (2.0000000735) | the same |
| y = (1.5, 2.5), w = (3, 4), dev = 0.7 | 0x1.46447ab0cae94p+4 | the same | the same | |

Doubles passed to R as mantissa times power of 2. The first case is one ulp below R and the exact value (the rounding of log(2 pi) + log(dev / sw) against log(2 pi dev / sw)). The second differs from R (Inf); recorded in docs.

## Cause

`src/models/glmFamily.ts` `familyAic`: `sw * (Math.log((2 * Math.PI * dev) / sw) + 1) + 3 * sly + 2`.

## Fix

- `familyAic` (inverse.gaussian): the fallback above.
- docs (en, ja): a row after the gaussian AIC row of #189.

## Tests

- `test/issue479.test.ts`: the two cases (within one ulp of R for the first, bit for bit with Rmpfr for the second) and the ordinary case (bit for bit with R). With `src/` stashed the first test fails.
- `glm`, `issue164`, `issue189`, `review62`, `review63` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- 2 pi dev / sw underflowing (dev tiny, sw huge) gives log(0) or a subnormal's lost bits, as in the gaussian AIC. Not reported; not changed.

## close comment

Fixed in <commit of #479, see git log --grep='#479'>: where 2 pi × deviance overflows although the deviance is finite, the inverse Gaussian AIC takes log(2 pi) + log(dev / sum(w)) (as the gaussian AIC of #189), and log(dev) - log(sum(w)) where dev / sum(w) overflows too. The issue's case (sum(w) = 1e308, dev = 3e307) is 1.634e308 (was Infinity; R 4.5.2 gives the same value, one ulp apart), and sum(w) = 1e-10, dev = 1e308 is 2.0000000735 where R gives Inf (recorded in docs/differences-from-r.md). Other inputs are unchanged. Test: test/issue479.test.ts. (Not pushed yet.)

# Issue #347 log: car's Anova with weights whose sum overflows

GitHub Issue #347. Session 12, group A6 (lm and anova weights).

## Plan

- Intent: `Anova` (`src/models/carAnova.ts`) formed the weighted mean and TSS of the response (for the "residual sum of squares is 0" check) with the original weights. Five weights of 1e308 make the sum of the weights Inf, the mean NaN and the check throws. The issue's example is the matrix form, which `Anova` does not take; it reproduces with the formula form.
- Method: a fallback that acts only on overflow. Where the TSS is not finite (the sum of the weights or a weighted sum overflows), the weights are divided by an even power of 2 2^kw and the RSS is compared in the same units. Where a term's sum of squares is not finite, the term rows are recomputed with the same kw (the square roots of the weights scale exactly, as kw is even). Sums of squares are scaled back by 2^(2k + kw). With kw = 0 the code is the old one (the same bits).
- Differs from the triage plan: the triage expected the TSS alone to fix it. With only the TSS fixed, the check passed but the term sums of squares were NaN (the effects sqrt(w) y / 2^k squared overflow), so the weights are scaled in `addedSS` as well.

## Reproduction (main `05e7eb2`, R 4.5.2)

`lm("y ~ x", { x: [0, 1, 2, 3, 4], y: [1e-154, 2e-154, 1e-154, 3e-154, 1e-154] }, { weights: 1e308 x 5 })`

| call | R (car) | before | after | exact (Fraction) |
|---|---|---|---|---|
| type II | error "system is computationally singular" | error "residual sum of squares is 0" | SS 0.10000000000000006, RSS 3.1000000000000005, F 0.09677419354838715, p 0.7760987652032669 | 0.10000000000000006, 3.1000000000000005, 0.09677419354838714 |
| type III | the same error | the same error | (Intercept) 3.2666666666666666 | 3.2666666666666666 |

R's `anova(f)` on the same fit: SS 0.1 and 3.1, F 0.0968, p 0.7761.

## Fix

- `src/models/carAnova.ts`: `addedSS` takes kw; `Anova` chooses kw on overflow of the TSS or of a term's sum of squares.
- docs (en, ja): a row in "Where R fails and rStats.js returns a value".

## Tests

- `test/issue347.test.ts`: types II and III against the exact values, p equal to the unweighted fit's. Fail with `src/` stashed.
- The 26 test files that call `Anova`: pass.

## Out of scope (recorded)

- `anova(f)` of the same fit gives the right table but adds the warning "ANOVA F-tests on an essentially perfect fit are unreliable"; R gives no warning. Not examined.

## close comment

Fixed in <commit of #347, see git log --grep='#347'>: where a sum over the weights overflows (five weights of 1e308), car's `Anova` now divides the weights by an even power of 2 for the weighted TSS and the term sums of squares, and scales the sums of squares back. The formula form of the example gives SS 0.1 and 3.1, F 0.0968, p 0.776 (exact to the last bits; type III intercept 3.27); it threw "residual sum of squares is 0". car's `Anova` fails there with "computationally singular" (recorded in docs/differences-from-r.md). Fits without overflow are unchanged. Test: test/issue347.test.ts. (Not pushed yet.)

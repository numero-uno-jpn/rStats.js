# Revision of review 4 (F-02): carAnova's residual sum of squares 0

## Plan
- Intent: `Anova` (types II and III) reported "residual sum of squares is 0 (within rounding error)" when rss was
  below sqrt(eps) times the centred total sum of squares, i.e. for any data with R^2 above 1 - 1.5e-8, eight digits
  coarser than rounding; car computes such data (precise calibration lines, for instance). Criterion K2 (where car is
  right, the same result).
- Decision: D11 (session 14, `prep/misc.md` question 2, recommended option (a)). aovStrata and aovEz are unchanged.
- Form: rss < 1e-24 times the weighted, uncentred sum of squares of the response (residuals below 1e-12 of the
  response's size; the level of aovEz's dataSS). Scale-free, as before. The weight exponent kw used by the term sums
  of squares is still taken from the centred total (same bits); the uncentred sum takes its own even power of 2 only
  where it overflows.

## Original decision
- Review 4, F-02 (no user decision): car's absolute sqrt(eps) replaced by sqrt(eps) times the centred total, to remove
  the dependence on the units.

## Gap with the current criteria
- K2: data that car computes correctly, with residuals far above rounding, were an error.

## Reproduction (x = 1..10, e = 3, -1, 4, -1, -5, 9, -2, 6, -5, 3; car 3.1.5, R 4.5.2)
| data | car | rStats.js before | now |
|---|---|---|---|
| `y = 1000 x + e / 100` (rss / TSS 2.4e-10) | table: Sum Sq 0x1.3ab65680003e8p+26, 0x1.3f14b4b5e400ep-6; F 0x1.f8fd74f23d49ap+34 | error | table; Sum Sq x 3 ulp, residual and F within 3e-12 relative (the residuals carry 12 digits) |
| same divided by 1e6 | error (units) | error | the same table in the new units (F within 1e-10) |
| `y = 1000 x + e / 10` | table | table | unchanged bits |
| `y = 2 x + 1` | error | error | error |

## Fix
- `src/models/carAnova.ts`: the comparison and its comment.
- Docs (en, ja): the Anova paragraph of the model differences.

## Tests
- `test/rev4.test.ts`: the cases above. Fails with src stashed.
- carAnova (the fixture's 2 error cases, rss / sum y^2 4.7e-65, still error), etaSquared, glm, glmAnova, the issue tests
  08, 10, 172, 173, 178, 188, 300, 347, 349, 350, lmerCompare, lmerReport014, lmerTest, rNames, reviews 15, 16, 28, 32,
  39, 48, 64, 66, reviewModels14, scaleInvarianceModels pass.

## Out of scope (recorded)
- None.

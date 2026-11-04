# Revision of issue 102: qbinom with a non-integer size

## Plan
- Intent: `qbinom` was the only discrete quantile function of the library to give NaN for a non-integer parameter;
  R's `qbinom` rounds the size half to even (`R_forceint`), as rStats.js already does in `qhyper`, `qsignrank` and
  `qwilcox`. Criterion K9 (integer conversion as R).
- Decision: D17 (session 14, `prep/errors.md` question 3, recommended option (a)).
- Form: in `qbinom1`, the size is rounded with the shared `roundHalfEven` (`src/internal/integer.ts`) before the
  checks, in R's order (finite size and prob, then `n < 0` on the rounded size). Integer sizes are unchanged.
  `dbinom` and `pbinom` stay NaN for a non-integer size, as R.

## Original decision
- Issue 102 (user's decision): keep NaN so that d, p and q agree; the docs' description of R was corrected.

## Gap with the current criteria
- K9: the conversion of a parameter to an integer follows R. The note that distribution NaN are not counted under K1
  does not apply to K9.

## Reproduction (R 4.5.2)
| call | R | rStats.js before | now |
|---|---|---|---|
| `qbinom(0.5, 10.2, 0.3)` | 3 | NaN | 3 |
| `qbinom(0.5, 10.5, 0.3)`, `qbinom(0.5, 11.5, 0.3)` | 3, 4 | NaN, NaN | 3, 4 |
| `qbinom(1, 10.5, 0.3)` | 10 | 10 | 10 |
| `qbinom(0.5, -0.1, 0.3)`, `qbinom(1, -0.1, 0.3)` | 0, -0 | NaN, NaN | 0, -0 |
| `qbinom(0.5, -0.6, 0.3)` | NaN | NaN | NaN |
| `dbinom(3, 10.2, 0.3)`, `pbinom(3, 10.2, 0.3)` | NaN, NaN | NaN, NaN | NaN, NaN |

## Fix
- `src/distributions/binomial.ts`: `qbinom1` rounds the size first; the local copy of `roundHalfEven` is replaced by the
  shared one (same values for finite input).
- `test/beta.test.ts`: the qbinom fixture's knownDifference "size is not an integer" (1372 cases) is removed; all of
  them now agree with R.
- Docs (en, ja): the qbinom row of the Distributions differences is removed.

## Tests
- `test/issue102_rev.test.ts`: the values above. Fails with src stashed.
- beta (qbinom fixture, 19292 cases), issue486, audit_q, extremeAccuracy, issue145, issue31, review54, thresholds pass.

## Out of scope (recorded)
- None.

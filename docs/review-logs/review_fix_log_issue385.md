# Issue #385 log: distSummary("beta") kurtosis with the closed form's terms overflowing

GitHub Issue #385. Session 12, group A3 (distSummary).

## Plan

- Intent: the beta skewness and kurtosis take the closed forms wherever a b is a normal number, and the ratio forms in pa = a / s, pb = b / s otherwise (#244 era). a b in range does not keep (a - b)^2 (s + 1) or a b (s + 2)(s + 3) in range: beta(1e-3, 1e155) has kurtosis Inf / Inf = NaN for 6000.
- Method: the closed form only where its numerator (or 0) and denominator are themselves normal and finite; otherwise the existing ratio form. Where the old closed form was in range, the bits are unchanged.
- The same check on the skewness: its numerator 2 (b - a) sqrt(s + 1) overflows for beta(1e-3, 1e250) (skewness NaN). It also catches a finite numerator over an overflowed denominator, which gave 0 instead of NaN: beta(1e100, 1e100) had kurtosis 0 for -3e-100.

## Check (main `b5e3573`)

| call | before | after | Rmpfr (2000 bits) |
|---|---|---|---|
| `beta(1e-3, 1e155)` kurtosis | NaN | 6000 | 6000 |
| `beta(1e-3, 1e250)` skewness, kurtosis | NaN, NaN | 63.24555320336758, 6000 | 63.245553203367585 (1 ulp), 6000 |
| `beta(1e100, 1e100)` kurtosis | 0 | -3e-100 | -0x1.4ff632b6a83e4p-331, the same |
| `beta(5e102, 5e102)` kurtosis | NaN | -6e-103 | -0x1.580658cb6ccbp-340, the same |
| `beta(1e100, 3e100)` kurtosis | 0 | 4.9999999999999995e-101 | 0x1.bff2ee48e052cp-334 (3 ulp) |
| `beta(2, 3)`, `beta(1e-3, 1e100)` | | unchanged | |

## Fix

- `src/distributions/summary.ts`, `case "beta"`: a helper `direct(num, den)` gives the closed form only where both parts are in range; the ratio forms otherwise.

## Tests

- `test/issue385.test.ts`: the calls above (fail with `src/` stashed) and unchanged values.
- The distSummary test files and `npx tsc --noEmit -p .` pass.

## Out of scope (recorded)

- The ratio form's skewness takes sqrt(pa * pb); where pa * pb is subnormal (a / s below about 1e-308) it loses digits. Not reached by the issue's inputs; not checked further.

## close comment

Fixed in <commit of #385, see git log --grep='#385'>. The beta skewness and kurtosis now use the closed forms only where their numerators and denominators are themselves in range, and the ratio forms in a / (a + b) and b / (a + b) otherwise: beta(1e-3, 1e155) has kurtosis 6000, beta(1e-3, 1e250) skewness 63.2456 and kurtosis 6000 (both were NaN), and beta(1e100, 1e100) kurtosis -3e-100 (was 0). Values where the closed forms were in range are unchanged. (Not pushed yet.)

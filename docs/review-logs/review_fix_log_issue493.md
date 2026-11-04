# Issue #493 log: df at x = Inf, and df1 = Inf at extreme x

GitHub Issue #493. Session 14, group B2. Fixed: the density at x = Inf is 0 for every df1 (central and noncentral), and for df1 = Inf the linear density comes from its log where the quotient leaves the normal range. 155 fixture cases (all R's NaN) are known differences.

## Plan

- User decision (2026-11-04): E2 #493: df at x = Inf is 0 for every df1; for df1 = Inf the 0 / 0 and the silent 0 are formed from the log. The noncentral F's df(Inf, ..., ncp) NaN also becomes 0. Fixture 47 cases (R's NaN to the correct value). The "Behaviour matched to R" entry moves to the intended differences.
- User decision (2026-11-04): E6 #493: take all 155 fixture cases (central F 47, noncentral F 108, all R's NaN to the correct value); option (a) below.
- Intent: the F density tends to 0 as x -> Inf (x^(-df2/2 - 1)) for every df1, as `dt(Inf, 1)` (F(1, 1) = t_1^2) and the other densities, R included. R gives NaN for df1 < 2, for df1 = Inf with df2 < 2 (Inf / Inf) and for the noncentral F with a finite df2. For df1 = Inf (n / chi2_n) the linear density dgamma(1/x) / x^2 is 0 / 0 where x^2 underflows, and 0 where dgamma underflows or x^2 overflows, while the log is finite.
- Method (K2, K3 fallback): `x === Infinity` returns 0 (log -Inf) in `dfDensity1` (before the df1 = Inf branch) and in `dnf1`; for df1 = Inf the quotient is kept where dgamma and x^2 are both normal, and otherwise `exp` of the log form. Ordinary values keep their bits.

## Reproduction (main `414503b`, R 4.5.2)

| Call | R | rStats.js before | now |
|---|---|---|---|
| `df(Inf, Inf, 1)`, log | NaN, NaN | NaN, NaN | 0, -Inf |
| `df(Inf, 1, 1)`, `df(Inf, 1.5, 5)` | NaN | NaN | 0 |
| `df(Inf, 1, 3, ncp = 1)`, `df(Inf, 3, 3, ncp = 1)` | NaN | NaN | 0 |
| `df(1e-300, Inf, 5)` | NaN | NaN | 0 (log -2.5e300) |
| `df(1e160, Inf, 1)` | 0 | 0 | 3.989422804014256e-241 (Rmpfr 0x1.547fe3c2b78afp-799 = 3.98942280401433e-241) |
| `df(1e200, Inf, 1)` | 0 | 0 | 3.989422804014274e-301 (Rmpfr 0x1.1194b2f793d22p-998) |
| `df(1e-100, Inf, 1e-300)` | - | 0 | 5.0000000000001645e-201 (Rmpfr 0x1.87e92154ef7acp-666) |
| `df(1e-170, Inf, 1e-290)` | - | NaN | 4.999999999999754e-121 (Rmpfr 0x1.4a8729fc3ddb8p-400) |
| `df(2, Inf, 3)` | | 0.17309961315613717 | unchanged |

Rmpfr: (n/2)^(n/2) / Gamma(n/2) x^(-n/2 - 1) exp(-n / (2x)) at 200 bits. The exp of a log of size 280 to 690 keeps about 13 to 14 digits (relative errors 2e-14 to 5e-14).

## Fixture count (decided by E6)

The fixture changes are 155, not the estimated 47: `df.json` 47 (as estimated: 44 at x = Inf with df1 < 2 or df1 = Inf, and `df(1e-300, Inf, 1, 5, 30)`), and `dnf.json` **108** (the preparation counted 0 for the noncentral part). All 155 are R's NaN; no R value other than NaN changes. The 108 are `df(Inf, df1, finite df2, ncp)` with every df1 and ncp of the fixture grid (log and linear), R NaN, now 0 / -Inf: exactly the E2 category "the noncentral F's df(Inf, ..., ncp) NaN also becomes 0", but the count was above the 60 at which the brief asks to stop, so it was asked first.

- (a) Apply the prepared patch as it is (155 fixture cases as known differences, one rule per suite: R's NaN at x = Inf, and R's 0 / 0 for df1 = Inf from the log). Advantage: the decision E2 in full; the 108 are the same rule as the central 44. Disadvantage: none beyond the count. **Recommended; chosen (E6).**
- (b) Only the central part (47 cases); keep `df(Inf, df1, finite, ncp)` NaN as R and its "Behaviour matched to R" line. Advantage: the count as estimated. Disadvantage: the central F with ncp = 0 given goes another way at x = Inf (ncp = 0 takes the central density only for finite x), and the noncentral density is NaN where its limit is 0.
- (c) Leave both as R.

## Fix

- `src/distributions/f.ts`, `dfDensity1()`: `x === Infinity` returns `d0(log)` after the df1 = df2 = Inf case (the df2 = Inf branch gave dgamma(Inf) = 0 there already); in the df1 = Inf branch the quotient is kept where dgamma and x^2 are in [DBL_MIN, Inf), otherwise exp of the log. The old `m < 2 ? NaN` line is removed.
- `src/distributions/nbeta.ts`, `dnf1()`: `x === Infinity` returns 0 (log -Inf) instead of NaN.
- `test/beta.test.ts` (df), `test/nf.test.ts` (dnf): knownDifference for R's NaN as above (47 and 108 cases).
- `test/helpers/distributionKnown.ts`: the two known violations (df at Infinity is NaN for f and nf; df1 = Infinity at tiny x is NaN) are removed: no longer violations.
- `test/issue202.test.ts`: `df(Infinity, 2, 1e308, { ncp: 1 })` is now 0 (was `toBeNaN`).
- `docs/differences-from-r.md`, `docs/ja/`: two rows in "Where R fails and rStats.js returns a value"; the line "`df(Inf, df1, df2)` is NaN for df1 < 2" and "`df(Inf, df1, finite, ncp)` is NaN" removed from "Behaviour matched to R".

## Tests

- `test/issue493.test.ts`: x = Inf for several df1 and df2, the noncentral F at x = Inf, the Rmpfr values within 1e-12, and `df(2, Inf, 3)` keeping its bits. With `src/` stashed, 3 of 4 tests fail (the bit test passes, as intended).
- Full `npx vitest run`: 545 files, 3296 passed, 38 skipped. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- `df(x, Inf, n, log = TRUE)` at subnormal x where 1/x overflows (e.g. x = 1e-320) is -Inf by dgamma(Inf); the true log can be finite for a tiny n. Not changed (the linear value is 0 there anyway unless n is tiny).

## close comment

Fixed in <commit of #493, see git log --grep='#493'>. `df(Infinity, Infinity, 1)` was NaN (log NaN; R 4.5.2 the same) and is now 0 (log -Infinity). The density tends to 0 at x = Infinity for every df1 (x^(-df2/2 - 1)), so `df(Infinity, df1, df2)` is now 0 also for finite df1 < 2 (`df(Infinity, 1, 1)`, R NaN, although `dt(Inf, 1)` is 0 in R) and for the noncentral F with a finite df2. For df1 = Infinity the linear density dgamma(1/x) / x^2 was 0 / 0 or silently 0 where x^2 or the gamma density leaves the normal range; it is now formed from the log there: `df(1e-300, Infinity, 5)` is 0 (was NaN) and `df(1e160, Infinity, 1)` is 3.989422804014256e-241 (was 0; Rmpfr 3.98942280401433e-241). Ordinary values keep their bits. The fixture cases where R gives NaN are recorded as known differences, and docs/differences-from-r.md moves the entry from "Behaviour matched to R" to "Where R fails". A test was added: test/issue493.test.ts. (Not pushed yet.)

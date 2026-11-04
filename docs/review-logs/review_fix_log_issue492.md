# Issue #492 log: besselI and besselK of large orders by Debye's expansion

GitHub Issue #492. Session 14, group B (B4 (4)). Fixed: the RangeError beyond 2^28 steps of the recurrence of K (also where the value is finite, the issue's example), and a silent error of the scaled besselI where its continued fraction stopped at 1e6 terms.

## Plan

- User decision (2026-11-04): E5 (#492 and the silent error of besselI scaled): for v > 1000, only where the recurrence of K now throws its RangeError (2^28 steps) and where the continued fraction of I reaches its limit, values from Debye's uniform expansion (u1 to u4); ordinary values keep their bits (prep `b_issue.md` B4 (4), recommended (a)).
- Intent: the issue's `besselI(1e308, 1e154, scaled)` and `besselK` are finite (v^2 / (2x) = 0.5) but threw (the bounds on the log do not decide where x^2 overflows, and kScaled rejects 1e154 steps). Separately, `cf1IK` stops at MAX_ITER = 1e6 terms without notice; for x above about 5e10 the Wronskian then gives a scaled I that is 25% (1e12, 2e5) to 99.8% (1e16, 1e7) low.
- Form: fallback only (K3): Debye is taken where `Math.round(v) > MAX_K_STEPS` (the place of the old RangeError) or where `cf1IK` did not converge and v > 1000. The convergence is reported by `cf1IK` itself rather than judged beforehand from x / v, so the fallback acts exactly where the fraction was cut off.
- My additions (not in the prep): (1) a RangeError remains where the exponent v eta - x (plus x for the unscaled values) is formed from terms above 2^26 and the result is in range; this is the same bound as MAX_ASYM_PHASE of besselJ (#490) and reaches only unscaled I and K near x = 0.66 v (the Laplace limit) with v > 2^28, which threw before as well. (2) The prep's "x / v" pre-check was replaced by the convergence flag (above).

## Reproduction (main `3c9b9a1`, R 4.5.2; references from Rmpfr, 2000 bits, Debye's expansion with u0 to u8 from the recurrence DLMF 10.41.9 in exact rationals (gmp), inputs as mantissa and power of 2)

| Call (scaled) | R | rStats.js before | Rmpfr |
|---|---|---|---|
| `besselI(1e308, 1e154)` (the issue) | warning "ncalc ... Arg. out of range?"; with the warning suppressed R segfaults | RangeError (2^28 steps) | 2.4197072451914341e-155 |
| `besselK(1e308, 1e154)` | warning "precision lost in result"; segfault as above | RangeError | 2.0663656770612473e-154 |
| `besselI(1e20, 1e10)`, `besselK` | the same warnings and segfault | RangeError | 2.4197072451914337e-11, 2.0663656770612464e-10 |
| `besselI(1e11, 1e5)` | 0 | 1.2000315751371857e-6 (-6.1e-6) | 1.2000389484313410e-6 |
| `besselI(1e12, 2e5)` | 0 | 2.9461275286960356e-7 (-25%) | 3.9104269397550087e-7 |
| `besselI(1e16, 1e7)` | 0 | 8.327256817092183e-12 (-99.8%) | 3.9695254747701178e-9 |
| `besselI(1e308, 1e154)` unscaled, `besselK` | | RangeError | Inf, 0 |
| `besselI(3e9, 3e8)`, `besselK(3e9, 3e8)` | | RangeError | 0, Inf (exponent -1.5e7) |

K at (1e12, 2e5), (1e13, 1e6), (1e16, 1e7) was already right (its recurrence is fine) and is unchanged.

## Fix (`src/special/besselIK.ts`)

- `cf1IK` returns `[f, converged]`.
- `debyeIK(v, x, "I" | "K", what)`: DLMF 10.41.3/4 with u1 to u4 (10.41.10; coefficients checked against the rational recurrence). z = x / v, s = sqrt(1 + z^2) (as z sqrt(1 + 1/z^2) for z > 1), and the exponent v eta - x = v / (s + z) - v log1p((1 + 1 / (s + z)) / z) without forming v eta. The omitted u5 / v^5 is at most 2e-17 (abs(u5) <= 0.021). The prefactor takes sqrt(v) sqrt(s) apart (2 pi v overflows).
- `Scaled` gets an optional `debye: {y, size, what}`; `resolve` applies e^(ex x + y) through `mulExp` (0 or Inf at once out of range) and throws "besselI: x = ..., nu = ... has an exponent in Debye's expansion formed from terms of about 2.40e+9, which double precision does not resolve (at most 2^26)" only for a finite non-zero result.
- `iPos`: Debye for `Math.round(v) > MAX_K_STEPS`, or for an unconverged `cf1IK` with v > 1000; `cf1IK` now runs before `kScaled` (no side effects; the values are the same). `kPos`: Debye for `Math.round(v) > MAX_K_STEPS`. kScaled's own RangeError stays as a guard (no longer reached).
- JSDoc of `besselI` and `besselK`; docs (en, ja): the I and K sentence of the Bessel bounds bullet, and two rows in the table of values where R is wrong.

## Values after the fix (relative to Rmpfr)

(1e308, 1e154), (1e200, 1e100), (1e60, 1e30), (1e20, 1e10), (3e16, 1e9), I and K scaled: within 1.1e-15. (1e11, 1e5), (1e12, 2e5), (1e13, 1e6), (1e16, 1e7), I scaled: within 1e-15. (2e14, 5e8), exponent -625: 1.5e-13, about eps times the exponent (formed in double; R and the prep have nothing better there).

## Tests

- `test/issue492.test.ts`: the Rmpfr values above (hex), Inf / 0 out of range, the RangeError near the Laplace limit, and four ordinary values that keep their bits. With `src/` stashed, the first three tests fail.
- `test/rev47.test.ts`: the three I / K rejections beyond 2^28 steps (review 47) now expect 0, 0, Infinity within 100 ms (the intended change of this issue); the J / Y rejections are unchanged.
- bessel (fixtures), issue490, rev47, review47, review52, review53, thresholds pass. The besselI and besselK fixtures (6047 cases incl. scaled, json, mpmath, random, regions) compared with main's code: 0 bits changed.

## Out of scope (recorded)

- Just below the cut-off the converged continued fraction has accumulated rounding: scaled `besselI(1e10, 1e4)` is -1.2e-13 and `besselI(1e9, 1000)` -6.6e-14 relative to Debye (prep b4g). Not touched (ordinary range, bits kept by the decision).
- R 4.5.2 on Windows segfaults in `besselI(1e308, 1e154, TRUE)` and `besselK` (also 1e20, 1e10) once the warning is suppressed (`suppressWarnings`); recorded only.

## close comment

Fixed in <commit of #492, see git log --grep='#492'>. For orders above 2^28 the recurrence of K threw a RangeError, also where the value is finite: the issue's besselI(1e308, 1e154, {exponScaled: true}) is 2.42e-155 (nu^2 / (2x) = 0.5). A second, silent error showed up nearby: the continued fraction of I_(nu+1) / I_nu stopped at 1e6 terms for x above about 5e10, and the scaled besselI was low (1e12, 2e5: -25%; 1e16, 1e7: -99.8%; R gives 0). By the user's decision, both places (and only these, for orders above 1000) now use Debye's uniform expansion with u1 to u4: besselI(1e308, 1e154, scaled) = 2.419707245191434e-155 and besselK = 2.0663656770612464e-154 (Rmpfr to 5e-16), besselI(1e12, 2e5, scaled) = 3.910426939755009e-7. Results out of range are Inf or 0 at once; a RangeError remains only where the exponent of the expansion cannot be resolved in double and the result is in range (unscaled, near x = 0.66 nu). Ordinary values keep their bits (the 6047 fixture cases of besselI and besselK unchanged). Recorded in docs/differences-from-r.md. A test was added: test/issue492.test.ts. (Not pushed yet.)

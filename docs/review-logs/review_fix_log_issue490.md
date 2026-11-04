# Issue #490 log: besselJ and besselY in the large-x asymptotic expansion

GitHub Issue #490. Session 14, group B (B4 (1)(2)). Fixed: NaN where the powers of the order overflow, a phase off by pi/4 for orders of 2^52 and above, and a RangeError where the phase correction nu^2 / (2x) exceeds 2^26.

## Plan

- User decision (2026-11-04): E4 (#490): the NaN from overflow by the ratio form; for v >= 2^52 the phase from v mod 4 (also besselJ(1e40, 1e17)); a phase correction v^2 / (2x) > 2^26 is a RangeError (prep `b_issue.md` B4, recommended (1) and (2)(a)).
- Intent: (1) `asymAmplitude` and `asymPhaseMx` form mu = 4 v^2 and powers of x directly; for large orders these overflow and the sums are NaN. (2) `cospi(v / 2 + 0.25)` loses the 1/4 for v >= 2^52 (v / 2 has an ulp of 0.5), a silent pi/4 error. (3) The phase correction, about v^2 / (2x), is formed in double with an absolute error of a few eps times itself; J and Y have relative errors of about 1e-16 times it, and no digit is left beyond about 1e13 (the issue's example is 5e107 rad).
- Form: (1) a fallback that acts only where the original sum is not finite (K3); (2) the reduction only for v >= 2^52 (v is an integer there; for all v it moved one fixture case by 1 ulp); (3) a check before the computation, in the form and wording of 84ed31c's bounds (K4-like: valid input, a precision limit; R gives NaN there).

## Reproduction (main `5865c49`, R 4.5.2; references from Rmpfr, 1400 bits, Debye's expansion with u1 (DLMF 10.19.6), inputs as mantissa and power of 2)

| Call | R | rStats.js before | Rmpfr |
|---|---|---|---|
| `besselJ(1e200, 1e154)`, `besselY` (the issue; v^2 / (2x) = 5e107) | NaN, "nu=1e+154 too large for bessel_j() algorithm" | NaN, NaN | (no digit in double) |
| `besselJ(1e200, 1e50)`, `besselY` | NaN (warning) | NaN, NaN | 6.8313825419983605e-102, -7.9495471168115595e-101 |
| `besselJ(1e100, 1e45)`, `besselY` | NaN (warning) | NaN, NaN | 3.0696794025650305e-51, -7.3647162608091108e-51 |
| `besselJ(1e40, 1e17)`, `besselY` (v >= 2^52) | NaN (warning) | -6.085250558572357e-21 (8.3 relative off), 5.1605913300854335e-21 (-0.35) | -6.5383281074982520e-22, 7.9520110596216549e-21 |
| `besselJ(1e14, 1e12)`, `besselY` (v^2 / (2x) = 5e9) | NaN (warning) | -7.896100360493117e-8, -1.1475014908019734e-8 (prep: 1.1e-7 and 5.4e-6 relative off) | |

## Fix (`src/special/besselJY.ts`)

- `asymAmplitude`: where the sum is not finite, the terms as products of (mu - c) / (2x)^2 = r^2 - c / (4x^2), r = v / x.
- `asymPhaseMx`: where the sum is not finite, (mu - 1) / (4x) = v r - 1 / (4x) times the polynomials in rho = r^2 / 4 and 1 / (4x)^2.
- `quarterPhase(v)`: v / 2 + 0.25, and (v mod 4) / 2 + 0.25 for v >= 2^52; used by `asymJY` and the Hankel path's `modV` (which v >= 2^52 does not reach: it needs v^2 < 2x, so x is above 90 v and the asymptotic path is taken first).
- `asymJY` throws before the computation where (v (v / x)) / 2 > 2^26: "besselJ: x = 1e+200, nu = 1e+154 has a phase correction nu^2 / (2x) of about 5.00e+107, which double precision does not resolve (at most 2^26)". Below the bound the relative error is about 1e-9 at most (prep: 1.3e-9 at 5e7). With the bound, the terms that the original sums drop as finite / Inf are negligible (r is below 1e-17 wherever the denominators overflow).
- JSDoc of `besselJ` and `besselY`; docs (en, ja): a sentence in the Bessel bounds bullet, and a row in the table of values where R is wrong (R's NaN for every nu above 1e7).

## Values after the fix (relative to Rmpfr)

1e40, 1e17: J and Y within 1.3e-16 and 4e-17. 1e200, 1e50; 1e100, 1e45; 1e200, 1e100; 1e300, 1e150; 3e307, 1e153: within 3e-16 (hex in the test).

## Tests

- `test/issue490.test.ts`: the five overflow points and 1e40, 1e17 against Rmpfr (relative 1e-15); the RangeError (the issue's example, a negative order, 1e14, 1e12 and 1e22, 1e18); values below the bound (1e18, 1e13, s = 5e7) and ordinary points keep their bits. With `src/` stashed, the first three tests fail.
- bessel (fixtures), rev47, review47, review52, review53, thresholds pass. The fixtures of besselJ and besselY (3040 cases, json, mpmath, random) compared with the code before: 0 bits changed (the prep's `b4fix.ts` rerun on this code).

## Out of scope (recorded)

- #492 (besselI and besselK at large x and order, Debye) is the next group, not touched.

## close comment

Fixed in <commit of #490, see git log --grep='#490'>. In the large-x asymptotic expansion of besselJ and besselY, the powers of mu = 4 nu^2 and of x overflowed for large orders and the sums became NaN (besselJ(1e200, 1e50); R gives NaN as well): where a sum is not finite it is now formed from the ratio nu / x, and besselJ(1e200, 1e50) is 6.831382541998361e-102 (Rmpfr to 3e-16). A second error showed up there: for nu >= 2^52 the 1/4 of the phase pi (nu/2 + 1/4) rounded away, and besselJ(1e40, 1e17) was 8.3 relative off; nu is now reduced modulo 4 first. The issue's example besselJ(1e200, 1e154) has a phase correction nu^2 / (2x) of 5e107 rad, which double precision cannot resolve (the relative error of J and Y is about 1e-16 times this correction); by the user's decision, a correction beyond 2^26 now throws a RangeError before the computation (R gives NaN). Ordinary values keep their bits (the 3040 fixture cases unchanged). Recorded in docs/differences-from-r.md. A test was added: test/issue490.test.ts. (Not pushed yet.)

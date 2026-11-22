# Distributions at extreme parameters: the behaviour to reach

What the F, noncentral F, noncentral beta, negative binomial (mu form) and noncentral t functions must return where
their parameters are huge (and, in part D, tiny). Unlike the other files in this directory this is not a description
of R: R fails or is inaccurate in most of these regions, and the target is the mathematically correct value, as for
the work in 2c48c0c, b7ed09a, 60caa9c, f8fe960, 2680abb and f2e1af8 (read those commits for the approach and the test
layout). Where R returns a different value, record it in `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`.

Points that are easy to get wrong:
- Every switch to a limit or an approximation needs an error bound written next to it (as for `HUGE_DF` in
  `src/distributions/nt.ts`): the neglected terms must be below the documented accuracy of the function (1e-14
  relative for the central distributions, 1e-13 for the noncentral t, the existing figures in `docs/accuracy.md` for
  the others), on the scale that is returned. A bound that holds for the linear value near the centre often fails for
  the log value far out in a tail: check both, and the upper tail separately from the lower.
- The noncentral t at a large ncp is NOT approximately normal unless df is also large: T = (Z + δ)/sqrt(V/ν) inherits
  the skewness of 1/sqrt(V). Its limit for large δ is a gamma (χ²) tail in t, not a normal one (see part C).
- A probability computed as 1 - (something) is only as good as that something: where the result is a tail, compute
  the tail directly.
- Every new method-switching threshold goes into `test/thresholds.test.ts` with a continuity check or, where the two
  sides legitimately differ, a validity check, as before.
- `test/helpers/distributionKnown.ts` lists the regions below as known violations. The goal is to delete those
  entries (or the huge-parameter half of them); an entry may stay only for a cause that is shown to be out of reach,
  with its reason updated.

## A. Central F, and the negative binomial with mu, at huge parameters

Current state (main at 6b653eb), all from the fuzzer without the allow-list or from direct calls:
- `pf(1, d, d)` is 0 for d ≥ about 1e290, although it is 1/2 for every d (it is 0.5 at d = 1e20). The fallback in
  `fRatios` (`src/distributions/f.ts`) for m·x beyond 1e290 assumes m·x ≫ n and forms q ≈ n/(m x), p ≈ 1 - q, which
  is wrong when m·x and n are of the same size.
- `pf(21.1657504452142, 8.249357668663052, 8.516163941329254e+303)` is NaN; `qf(3.5108864369271596e-19,
  3.0400907891218185e+61, 0.010709433216885547)` is 1, while p at 1 is 0.0247 (the answer is far below 1);
  `df(1, 3.486422648032203e+36, 100.41585055598716)` does not match the differences of `pf`. Over 400 parameter sets
  about 400 calls fail with one df above 1e10.
- `pnbinom(1e10, 1e300, { mu: 1e300 })` and `pnbinom(1e300, 1e300, { mu: 1e300 })` are NaN (from size ≈ mu ≈ 8e299);
  `dnbinom(0, 6.230757839003209e+301, { mu: 1 })`, `pnbinom(0, ...)` and `qnbinom(...)` there are NaN, although this
  is the Poisson(1) distribution to the double. The NaN does not come from size + mu overflowing (2e300 is finite)
  but from the splitting of a divisor above about 1.3e300 in the double-double division in `fromMu`, as found
  elsewhere in the earlier commits.

Required:
1. p = m x/(n + m x) and q = n/(n + m x) (and for the negative binomial p = size/(size + mu), q = mu/(size + mu))
   must be formed from the ratio r = m x / n (or mu/size) without forming a sum or a product that can overflow, in
   double-double where they are now, so that p = q = 1/2 exactly for m x = n at every magnitude. The smaller of p and
   q is the one computed directly.
2. Limits where one df is huge: as n → ∞, F → χ²_m/m, so P[F ≤ x] → P[χ²_m ≤ m x]; as m → ∞, F → n/χ²_n, so
   P[F ≤ x] → P[χ²_n ≥ n/x]. The existing code already uses these at Infinity; extend them to finite huge df where the neglected terms
   are below the accuracy above (derive the bound: the relative error is of order (1 + x m)/n, resp. (1 + n/x)/m, and
   grows in the far tails). `df` likewise.
3. Both df huge: the distribution of log F is normal with variance 2/m + 2/n to leading order, with a skewness term of
   order 1/sqrt(min(m, n)). Where both are so large that F's spread is below the resolution of x near 1 (spread about
   sqrt(2/m + 2/n)), the result is decided by rounding: give the correct value for every representable x (0 or 1 away
   from 1 if the true tail is below the smallest subnormal, the true tail otherwise, with its log).
4. Negative binomial with a huge size: Poisson(mu) is the limit as size → ∞ with mu fixed (error of order mu²/size,
   and x²/size for the far upper tail); with size and mu both huge the distribution is normal with mean mu and variance
   mu + mu²/size to leading order. Use the existing path wherever it is accurate, the limits only beyond.
5. Quantiles (`qf`, `qnbinom`) must follow their distribution functions and return within the usual time.

Anchors (verify each independently, to high precision, before using it in a test): `pf(1, d, d)` = 0.5 for every d;
`dnbinom(0, 6.230757839003209e+301, { mu: 1 })` = e^-1 to the double; `pf(21.1657504452142, 8.249357668663052,
8.516163941329254e+303)` = `pchisq(21.1657504452142 * 8.249357668663052, 8.249357668663052)` to the double.

## B. Noncentral F (and noncentral beta) at huge df

Current state:
- `qf(0.5, 1e40, 1e40, { ncp: 1 })` is Infinity and `pf(1, 1e40, 1e40, { ncp: 1 })` is 0 (the centre of the
  distribution, which lies at about 1 + ncp/m).
- `qf(0.5, 1e30, 1e30, { ncp: 1 })` is right (about 1) but takes 9.3 s; `qf` at df2 ≥ 1e15 with ncp > 0 takes about
  2 s (`qf(exp(-3.79), 314, 5.2e16, { ncp: 2393 })`).
- From the fuzzer: `pf(5.151253477738577e-57, 3.521976902252538e+133, 5.879017611208649e+305, { ncp:
  2.2529715184644043e+121, logP: true })` is NaN; `qf(4.251629089489512e-133, 7.314062465962935e+213,
  6945.705057547896, { ncp: 0 })` is 1 while p at 1 is 0.4977; noncentral `pbeta` with one shape above 1e130 and a
  large ncp has both tails 0 (`pbeta(2.92430123526782e-298, 3643.6257654214796, 1.0088577788171954e+130, { ncp:
  1.9609586934057862e+123 })`).

Required:
1. With ncp = 0 these must agree with the central F of part A.
2. df2 huge: F → χ²_{m}(λ)/m (noncentral χ², which is accurate at every size after b7ed09a/f8fe960); df1 huge with
   λ/m bounded: the numerator χ²_m(λ)/m concentrates at c = 1 + λ/m, so P[F ≤ x] → P[χ²_n ≥ n c/x] (derive the error
   bound, which involves both 1/m and λ/m²); both huge: log F is normal with mean log(1 + λ/m) and variance (2 + 4λ/m)/(m (1 + λ/m)²) + 2/n
   to leading order. As in A, each switch with an error bound valid in both tails and on the log scale.
3. Noncentral beta: the same limits through the beta-F relation; the case of one huge shape with a large ncp must
   have tails that add to 1.
4. Speed: no call in this region may take more than about 100 ms (the 9.3 s and 2 s cases included).

## C. Noncentral t at a large ncp

Current state: the property tests draw ncp only up to 1e4 (`test/helpers/properties.ts`, the nt family). A scan of
ncp from 1e5 to 1e300, df from 1e-300 to 1e250 and t = r·ncp (r in 0, 1e-10, 0.5, 0.999, 1, 1.001, 2, 1e10, -1)
found 252 failing calls of `pt`/`dt` (NaN, Infinity on a linear scale, or a positive log) and 10 calls over 100 ms:
- `pt(10, 10, { ncp: 1e9, logP: true })` NaN; `pt(1e300, 100, { ncp: 1e20 })` NaN;
- `pt(0.001, 1e-5, { ncp: 1e7, logP: true })` = Infinity;
- `pt(9.99e49, 1e-300, { ncp: 1e50 }, log)` NaN, and `dt(0, 1e-300, { ncp: 1e9 }, log)` NaN;
- `qt(0.3, df, { ncp: 1e50 })` and with ncp 1e300 return values where `pt` is 0 (df 1, 10, 1000), so the quantiles
  are wrong from some ncp between 1e15 and 1e50; at ncp = 1e15 they take 20–60 ms and round-trip to 1.6e-14 only.
- Already right, to keep: `pt(1e9, 10, { ncp: 1e9 })` = 0.44049328506521235 (= P[χ²_10 ≥ 10] in the limit),
  `qt(0.5, 10, { ncp: 1e9 })` = 1034628183.3696445, and the small-ncp results everywhere.

The earlier analysis of the NaN (f2e1af8 report): the log of the integrand is of the order of -δ²/2 (about -5e17 at
δ = 1e9) and the low part of its double-double value made a factor (1 + v[1]) negative in the trapezoid sum. A fix
that only caps the far-tail limit `farLimit` does not address that.

Required:
1. The structure for large |δ|: P[T ≤ t] = E[Φ(t sqrt(V/ν) - δ)] with V ~ χ²_ν. For t of the sign of δ, Φ is a step
   at V = ν (δ/t)² of relative width about 1/|δ|, so P[T ≤ t] = Q(ν/2, ν δ²/(2 t²)) (upper regularized gamma) plus a
   correction of order 1/δ² that can be written down (expand Φ around the step); for t of the other sign or 0, the
   value is Φ(-|δ|)-sized and its log is about -δ²/2 plus lower-order terms. Use these forms where their neglected
   terms are below 1e-13 relative on the returned scale (the log scale far out included), and the existing integral
   elsewhere; or rescale the integral so that it works at any δ (subtract the log of its peak before exponentiating,
   in double-double). Either way the switch or the rescaling needs an error bound.
2. `dt` likewise (the density of the same mixture).
3. `qt`: correct and fast (well under 100 ms) at any ncp, starting from the limit of 1. Large df together with large
   δ: (Z + δ)/sqrt(V/ν) is then close to N(δ, 1 + δ²/(2ν)) only when both the gamma skewness (order 1/sqrt(ν)) and
   δ's influence are accounted for; do not use that normal approximation without a bound.
4. Widen the nt family's ncp range in `test/helpers/properties.ts` to the whole double range (both signs), and add the
   examples above as regression tests.

## D. The tiny side of the same entries (to decide after A–C)

The allow-list entries also cover tiny df and shapes (below 1e-10). The fuzzer finds, for example, `qf(2.9981268429306854e-186,
1.63e-322, 0.012141268572098511)` = 1 with p at 1 equal to 1, `pf(1.7976931348623157e+308, 3.716767e-318,
1.8750878059230611, { ncp: 0.1393594053357755 })` NaN, and noncentral `qf` with a subnormal df1 returning Infinity
where p at the answer is NaN. Report how many remain after A–C; whether to fix them is decided then.

## Tests and finishing (for each part)

- Regression tests with every example above, the expected values from an independent high-precision computation
  (mpmath or Rmpfr; say which and how in a comment), never from rStats.js itself.
- The fuzzer with the allow-list entries of the part deleted: `node scripts/fuzz-distributions.mjs <seed> 1000
  '<families>' out.json --known` for at least three seeds, zero violations and no slow calls; and one run over all
  families to show that shared code changed nothing elsewhere.
- `npm test`, `npm run typecheck`, `npm run build`; the existing R fixtures unchanged.
- CHANGELOG under `## Unreleased` / `### Fixed`; the differences-from-R tables (both languages) where R differs.

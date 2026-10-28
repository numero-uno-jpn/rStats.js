import { type DD } from "./dd.js";
/**
 * Below this smaller shape the prefactor is formed by the small-shape form of prefactorParts. Loader's stirlerr of a
 * shape s < 1 is lgamma1p(s) - (s + 1/2) log s + ..., whose rounding (absolute, about ε |log s| / 2) cancels against the
 * log of the denominator: the prefactor was off by 2e-15 to 1e-14 relative for shapes from 1e-8 to 1e-30 (2e-14 at
 * 1e-130: pbeta(1.08e-285, 1.56e-130, 2) was 1.0000000000000195). Against mpmath, the small-shape form was within 4e-16
 * for smaller shapes from 1e-30 to 0.3 (Loader's 1.5e-15), and from 0.3 to 1 within 1.3e-15 with an rms error of
 * 2.6e-16 (Loader's 1.1e-15 and 3.8e-16); from 1 on Loader's form is the better one where both shapes grow. Up to 1
 * rather than 0.3: tails of a moderate shape from both forms disagreed by 1.6e-15 (pnbinom(0, 0.818, { prob: 0.0821 })
 * and its upper tail), enough to move qnbinom of that upper tail to 1
 */
export declare const SMALL_SHAPE = 1;
/**
 * From this larger shape on (with the smaller one at most HUGE_SHAPE_MAX_SMALL), the huge-shape form of
 * prefactorParts. Loader's form was off by up to 2e-14 relative from 1e15 on and 8e-14 near 1e300 (against mpmath, the
 * smaller shape from 1e-3 to 40 and 1 - x around it divided by the larger: pbeta(5.6e-161, 0.82, 1.5e160) and its
 * upper tail added up to 1 + 3e-14); the huge-shape form stayed within 3.4e-15 from 1e15 on (the rounding of Γ(s)),
 * but neglects terms of order s³/l² (see lgammaRatioHuge), which matter below about 1e10
 */
export declare const HUGE_SHAPE: number;
/** Largest smaller shape for the huge-shape form (Γ(s) is finite and accurate to a few ulps up to there) */
export declare const HUGE_SHAPE_MAX_SMALL = 100;
/**
 * x^a (1-x)^b / B(a, b) = c exp(e) as [c, e] (e in double-double) where Loader's form loses digits: for
 * min(a, b) < SMALL_SHAPE, or max(a, b) >= HUGE_SHAPE with min(a, b) <= HUGE_SHAPE_MAX_SMALL; undefined elsewhere.
 * With s = min(a, b), l = max(a, b):
 * - small shape: 1/B(a, b) = ab/(a + b) Γ(1+a+b)/(Γ(1+a) Γ(1+b)), c = ab/(a + b) = s/(1 + s/l) (no underflow of the
 *   product ab), and the log of the ratio of gamma functions from smallShapeG, of the size of s log l or less
 * - huge shape: 1/B(a, b) = Γ(l + s)/(Γ(l) Γ(s)), c = 1/Γ(s), and log Γ(l + s) - log Γ(l) from lgammaRatioHuge
 * a log x and b log(1-x) are formed in double-double (b log(1-x) can be large), each logarithm from the smaller of x and
 * 1 - x: x may have rounded to 1 even in double-double (pf(2.5e-97, 1.7e80, 2.7e-95) passes 1 - x = 6.3e-79 with
 * x = [1, 0]), and a log x, about -a (1 - x), then still matters for a huge a
 */
export declare function prefactorParts(a: number, b: number, x: DD, xc: DD): [number, DD] | undefined;
/**
 * log Γ(l + s) - log Γ(l) in double-double for l >= HUGE_SHAPE and s <= HUGE_SHAPE_MAX_SMALL. From Stirling's series,
 *   log Γ(l + s) - log Γ(l) = s log l + [(l + s - 1/2) log1p(s/l) - s] + [stirlerr(l + s) - stirlerr(l)]
 *                           = s log l + s (s - 1) / (2 l) + O(s³/l²)
 * (the stirlerr terms differ by about -s/(12 l²)); the neglected terms are below 1e-25 here. s log l is formed in
 * double-double. lgammaDiff loses s itself where s/l underflows (it forms (l - 1/2) log1p(s/l) - s, which is then -s, not
 * about 0): pbeta(2.2e-292, 2.4e-69, 4.5e290, { lowerTail: false }) was 6.87e-69, 4.44e-69 expected
 */
export declare function lgammaRatioHuge(s: number, l: number): DD;
/**
 * log Γ(1+a+b)/(Γ(1+a) Γ(1+b)) for min(a, b) < SMALL_SHAPE (see prefactorParts), with s = min(a, b), l = max(a, b), as
 * [lgamma(1+l+s) - lgamma(1+l)] - lgamma1p(s), or for l >= 1 with Γ(1+s+l)/Γ(1+l) = (s + l)/l Γ(s+l)/Γ(l). Each term
 * is of the size of s (log l) and accurate relative to that: the result is about s (ψ(1+l) + γ), and where it decides
 * 1 - I_x(a, b) = -expm1(...) it must be (with lgamma1p(a + b) for the first term, a + b dropped s at s = 5.9e-87,
 * b = 0.0845, and pf(1e300, 0.169, 1.18e-86) came out 1.5e-4 too large). For l >= HUGE_SHAPE, lgamma(s+l) - lgamma(l)
 * from lgammaRatioHuge (lgammaDiff loses s where s/l underflows)
 */
export declare function smallShapeG(a: number, b: number): DD;

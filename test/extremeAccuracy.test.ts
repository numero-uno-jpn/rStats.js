// Values at extreme parameters that were off (0.15.1), found by the property tests and the fuzz script
// (test/helpers/distributionKnown.ts): above 1, tails not adding up, NaN, or a few digits wrong. The expected values come
// from closed forms, limiting distributions or mpmath (as noted); where R's behaviour is kept, from R 4.5.2.

import { describe, expect, it } from "vitest";
import { df, dgeom, pbeta, pbinom, pf, pgamma, pgeom, pnbinom, qbeta, qbinom, qcauchy, qf, qgeom, qnbinom } from "../src/index.js";
import { nextDown } from "./helpers/float.js";

const rel = (a: number, b: number): number => (a === b ? 0 : Math.abs(a - b) / Math.abs(b));

describe("pbeta's continued fraction for a just below a power of two", () => {
  // I_x(a, b) = Q(b, u) (1 + O(b²/a²)), u = (a + (b - 1)/2)(-log x) (DiDonato & Morris eq. 9). The steps a + 1, a + 2, ...
  // were rounded in double for a non-integer a near the top of its binade (log P off by 3e-8 at 2^40, 1.3e-4 at 2^52)
  it.each([40, 45, 48, 50, 51, 52])("log pbeta(1 - 4000/a, nextDown(2^%d), 100) is log Q(b, u)", (k) => {
    const a = nextDown(2 ** k);
    const x = 1 - 4000 / a;
    const u = (a + 99 / 2) * -Math.log1p(-(1 - x));
    expect(rel(pbeta(x, a, 100, { logP: true }), pgamma(u, 100, { lowerTail: false, logP: true }))).toBeLessThan(1e-13);
  });
});

describe("pbeta and qbeta with a tiny shape", () => {
  it("pbeta(1.08e-285, 1.56e-130, 2) is 1, not above (its upper tail 1.02e-127 from mpmath)", () => {
    const [x, a, b] = [1.078577302826644e-285, 1.5597941463167979e-130, 2];
    expect(pbeta(x, a, b)).toBe(1);
    expect(rel(pbeta(x, a, b, { lowerTail: false }), 1.0219164621554364e-127)).toBeLessThan(1e-14);
  });

  // mpmath: I_x(a, b) = x^a (1-x)^b / (a B(a, b)) 2F1(a + b, 1; a + 1; x) at 900 digits
  it.each([
    [0.3, 0.0678, 2.97e-263, 4.129101450735629e-262, 1],
    [5.252978793830399e-183, 3.200960481616968e-184, 0.002379192827599108, 1, 2.6888739755841036e-181],
    [0.12640898116725474, 5.396457858926967e-144, 2.337523286635989e-109, 1, 2.3086220743893408e-35],
    [0.26631649194309526, 1.0746857066173856e-72, 2.3587830572190325e-244, 2.1948584992754694e-172, 1],
    [1.3423692208933005e-44, 3.166771964643457e-120, 7.76675797676218e-193, 2.4525788605800764e-73, 1],
    [0.006597260440513453, 1.4450693502978578e-166, 317.18859523835096, 1, 6.190161462211357e-168],
  ])("pbeta(%d, %d, %d): both tails (mpmath)", (x, a, b, lo, up) => {
    expect(rel(pbeta(x, a, b), lo)).toBeLessThan(1e-14);
    expect(rel(pbeta(x, a, b, { lowerTail: false }), up)).toBeLessThan(1e-14);
  });

  it("qbeta(2.25e-265, 5.68e-37, 5643.4, { lowerTail: false }) (0; R gives 1) is 0.08797712670529832 (mpmath)", () => {
    expect(rel(qbeta(2.2494962730964562e-265, 5.678021384252186e-37, 5643.443546400099, { lowerTail: false }), 0.0879771267052983169)).toBeLessThan(
      1e-14,
    );
  });

  it("the upper tail at x = 5e-324 is 1 - x^a ... (-Infinity on the log scale)", () => {
    // 1 - I ≈ a (-log x + ψ(b) - ψ(1)) for a tiny a
    const v = pbeta(Number.MIN_VALUE, 5.678021384252186e-37, 5643.443546400099, { lowerTail: false, logP: true });
    expect(v).toBeGreaterThan(-77);
    expect(v).toBeLessThan(-76.8);
  });

  it("the upper tail with one shape tiny and the other huge, either side of b x = 0.1 (6.87e-69 on one side; mpmath)", () => {
    // (lgamma(b + a) - lgamma(b) lost a where a/b underflows)
    const [a, b] = [2.4348681639403677e-69, 4.527148372908966e290];
    expect(rel(pbeta(2.2066871189337275e-292, a, b, { lowerTail: false }), 4.4407838840122558e-69)).toBeLessThan(1e-14);
    expect(rel(pbeta(2.2091169045501708e-292, a, b, { lowerTail: false }), 4.4383592077738253e-69)).toBeLessThan(1e-14);
  });

  it("the upper tail far out with one shape tiny and the other huge is -b x on the log scale (-Infinity)", () => {
    // 1 - I_x(a, b) ≈ a Γ(0, b x) ≈ a e^(-b x) / (b x)
    const [x, a, b] = [4.186777838006567e-24, 2.454599188178181e-209, 1.992821892795784e213];
    expect(rel(pbeta(x, a, b, { lowerTail: false, logP: true }), -b * x)).toBeLessThan(1e-12);
  });
});

describe("pbeta and qbeta with a huge shape", () => {
  // The gamma limit: I_x(a, b) = P(a, u) (1 + O(1/b²)), u = (b + (a - 1)/2)(-log(1 - x)); mpmath
  it.each([
    [5.568715649011509e-161, 0.8196597876645552, 1.4719009540558086e160, 0.64534551198867662, 0.35465448801132338],
    [2.88007449148925e-168, 0.5365242212099378, 1.8628831399861048e167, 0.67699169437158954, 0.32300830562841046],
    [1.3724450464794152e-272, 0.05413966775245392, 3.944760330574441e270, 0.87658049171296526, 0.12341950828703474],
  ])("pbeta(%d, %d, %d): both tails (the gamma limit)", (x, a, b, lo, up) => {
    expect(rel(pbeta(x, a, b), lo)).toBeLessThan(1e-14);
    expect(rel(pbeta(x, a, b, { lowerTail: false }), up)).toBeLessThan(1e-14);
  });

  it.each([
    [1.4701666282708656e-15, 1.6931854251429734e160, 1.6168490723157686e175, false],
    [Math.exp(-226.36263116445122), 2.7104014961914993e43, 8.255594876328312e95, true],
    [0.3, 1.3e32, 1.3e32, true],
  ])("qbeta(%d, %d, %d) (0, or far off) lies at the mean, where pbeta steps from 0 to 1", (p, a, b, lowerTail) => {
    const x = qbeta(p, a, b, { lowerTail });
    expect(rel(x, a / (a + b))).toBeLessThan(1e-14);
  });
});

describe("pf, qf and df with extreme df", () => {
  // mpmath (I_p(m/2, n/2) at 600 digits)
  it("pf(6.6e-112, 3.2e-173, 1868) is 1, not above, and its upper tail 1.04e-170", () => {
    const [x, m, n] = [6.616261056709485e-112, 3.193376520741174e-173, 1867.9657047120206];
    expect(pf(x, m, n)).toBe(1);
    expect(rel(pf(x, m, n, { lowerTail: false }), 1.0431206066005557e-170)).toBeLessThan(1e-14);
    expect(rel(df(x, m, n, { log: true }), -141.87928944106619)).toBeLessThan(1e-14);
  });

  it("pf(1e300, 0.169, 1.18e-86) (upper tail 0, 1 expected): n/(m x) underflows", () => {
    expect(pf(1e300, 0.169, 1.18e-86, { lowerTail: false })).toBe(1);
    expect(rel(pf(1e300, 0.169, 1.18e-86), 5.3014908800441184e-84)).toBeLessThan(1e-14);
  });

  it("pf at subnormal x (off by 4.5e-14, or 0) and the quantile there", () => {
    expect(rel(pf(5.43275e-319, 1.0433869454565992, 206159.4104536305), 7.3761595842019731e-167)).toBeLessThan(1e-14);
    expect(rel(pf(6.285951506639373e-197, 3, 7.633744494745758e127, { logP: true }), -677.332904352286)).toBeLessThan(1e-14);
    // m x underflowed in the double-double product: 0 below pf(2.6e-269) = 1
    expect(pf(1.2874798969157023e-232, 1.782462300900609e-123, 2.1846223351973428e-48)).toBeGreaterThan(1 - 1e-15);
    expect(rel(pf(1.2874798969157023e-232, 1.782462300900609e-123, 2.1846223351973428e-48, { lowerTail: false }), 8.1591324604835846e-76)).toBeLessThan(
      1e-14,
    );
    // (5.4e-319, where pf is 1e-166; the quantile is 1.3e-322, 27 times the smallest subnormal, so it brackets p within
    // the next subnormals, 4% apart)
    const q = qf(9.593069285029728e-169, 1.0433869454565992, 206159.4104536305);
    expect(pf(q * 0.9, 1.0433869454565992, 206159.4104536305)).toBeLessThan(9.593069285029728e-169);
    expect(pf(q * 1.1, 1.0433869454565992, 206159.4104536305)).toBeGreaterThan(9.593069285029728e-169);
    // (1 after 15 s)
    const r = qf(7.683051278860931e-296, 3, 7.633744494745758e127);
    expect(rel(pf(r, 3, 7.633744494745758e127, { logP: true }), Math.log(7.683051278860931e-296))).toBeLessThan(1e-14);
  });

  it("df at subnormal x (NaN, as in R) and far out", () => {
    // f(x) = (m/n)^(m/2) x^(m/2 - 1) (1 + m x/n)^(-(m+n)/2) / B(m/2, n/2); mpmath
    expect(rel(df(1e-310, 3, 5), 2.3669930651961556e-155)).toBeLessThan(1e-14);
    expect(rel(df(1.33e-322, 1.0433869454565992, 206159.4104536305, { log: true }), 353.62376812203799)).toBeLessThan(1e-14);
  });

  it("qf beyond the largest double", () => {
    // pf(Number.MAX_VALUE, 0.754, 4.56e-152) is 2.4e-149: a larger p is beyond the doubles (1.8e308 before)
    expect(qf(8.826886207108775e-131, 0.754212044156398, 4.555794521226085e-152)).toBe(Infinity);
    // the leading term of the upper tail said overflow (Infinity), but pf(1.797e308, ..., upper) is 5.9504e-155, below p
    const x = qf(5.952019837978998e-155, 2875.527004651195, 1, { lowerTail: false });
    expect(x).toBeLessThan(Infinity);
    expect(rel(pf(x, 2875.527004651195, 1, { lowerTail: false }), 5.952019837978998e-155)).toBeLessThan(1e-12);
  });
});

describe("pnbinom, pbinom and pgeom: closed forms at the edges", () => {
  it("pnbinom with size and x both huge (NaN) is the Poisson limit, 1", () => {
    expect(pnbinom(2.6329019116607608e200, 3.102992688838784e287, { mu: 195.56831659259922 })).toBe(1);
  });

  // P[X = 0] = prob^size, so P[X > 0] = -expm1(size log prob)
  it.each([
    [3.67089151234586e-241, 0.6815368835814297],
    [1.4999593749554572e-5, 0.5658403073903173],
    [16.7480243029891, 0.9105234742164612],
  ])("pnbinom(0, %d, { prob: %d }) (0.9999999999999597 for the tiny size; tails off by 2e-15)", (size, prob) => {
    const up = -Math.expm1(size * Math.log(prob));
    expect(rel(pnbinom(0, size, { prob, lowerTail: false }), up)).toBeLessThan(2e-15);
    expect(rel(pnbinom(0, size, { prob }), Math.exp(size * Math.log(prob)))).toBeLessThan(2e-15);
  });

  it("pnbinom's upper series with a tiny size (off by 5e-14; mpmath), and the probability as the difference of tails", () => {
    const [size, mu] = [5.634901181742926e-245, 4.6011526194028554e-241];
    const a = pnbinom(1544, size, { mu, lowerTail: false });
    const b = pnbinom(1545, size, { mu, lowerTail: false });
    expect(rel(a, 7.1485267479128554e-245)).toBeLessThan(2e-15);
    expect(rel(b, 7.1455082615079089e-245)).toBeLessThan(2e-15);
  });

  it("pnbinom with a tiny size does not decrease further out", () => {
    expect(pnbinom(1.7e60, 3.67089151234586e-241, { prob: 0.6815368835814297 })).toBe(1);
  });

  it("pbinom(20, 21, prob) is 1 - prob^21 (2e-15 above), and qbinom inverts it", () => {
    const prob = 0.9265496833249927;
    const p = pbinom(20, 21, prob);
    expect(rel(p, 0.79851489259107768)).toBeLessThan(1e-15);
    expect(qbinom(p, 21, prob)).toBe(20);
    // A p one rounding above P[X <= 20] needs 21, as R gives too
    expect(qbinom(0.7985148925910792, 21, prob)).toBe(21);
    const pu = pnbinom(0, 16.7480243029891, { prob: 0.9105234742164612, lowerTail: false });
    expect(qnbinom(pu, 16.7480243029891, { prob: 0.9105234742164612, lowerTail: false })).toBe(0);
  });

  it("pgeom and dgeom at x around 1e300 (NaN): 1 - (1 - prob)^(x+1) and prob (1 - prob)^x", () => {
    const [x, prob] = [8.663961183897879e299, 1.1060325197469172e-300];
    expect(rel(pgeom(x, prob), -Math.expm1(x * Math.log1p(-prob)))).toBeLessThan(1e-14);
    expect(rel(dgeom(x, prob), prob * Math.exp(x * Math.log1p(-prob)))).toBeLessThan(1e-14);
  });

  it("qgeom keeps R's closed form (R 4.5.2: 112065 and 147)", () => {
    expect(qgeom(0.8757104766401955, 0.0000011843097327690854, { lowerTail: false })).toBe(112065);
    expect(qgeom(0.9999999998246265, 0.14171325019560754)).toBe(147);
  });
});

describe("qcauchy in the far tail", () => {
  // For p < 1e-200 the quantile is scale / (π p) (tan(π p) = π p to relative (π p)²/3). scale / p overflowed before the
  // division by π (Infinity for p in (1/(π MAX_VALUE), 1/MAX_VALUE), 0.15.2). The reference (1/π)/p takes two roundings and
  // the result at most three, so they agree to a few ulps (4 ulps = 8.9e-16)
  it.each([5.5e-309, 2.2e-309, 2.0e-309, 1.8e-309])("qcauchy(%s) in either tail is finite and ∓1/(π p)", (p) => {
    const ref = 1 / Math.PI / p;
    const upper = qcauchy(p, { lowerTail: false });
    const lower = qcauchy(p);
    expect(Number.isFinite(upper) && upper > 0).toBe(true);
    expect(Number.isFinite(lower) && lower < 0).toBe(true);
    expect(rel(upper, ref)).toBeLessThan(4 * Number.EPSILON);
    expect(rel(lower, -ref)).toBeLessThan(4 * Number.EPSILON);
  });

  it("qcauchy(1.7e-309) is ∓Infinity (1/(π p) = 1.87e308 is beyond the largest double)", () => {
    expect(qcauchy(1.7e-309, { lowerTail: false })).toBe(Infinity);
    expect(qcauchy(1.7e-309)).toBe(-Infinity);
  });

  it("a subnormal scale still divides by p before π (scale / π would lose bits)", () => {
    // Value before the fix: 5e-324 / 1e-300 / π
    expect(qcauchy(1e-300, { scale: 5e-324, lowerTail: false })).toBe(1.5726597949504821e-24);
  });

  it("location and scale in the tiny tail: location ± scale / (π p)", () => {
    const ref = 2 / Math.PI / 1e-250; // location 3 is far below one ulp of the result
    expect(rel(qcauchy(1e-250, { location: 3, scale: 2, lowerTail: false }), ref)).toBeLessThan(4 * Number.EPSILON);
    expect(rel(qcauchy(1e-250, { location: 3, scale: 2 }), -ref)).toBeLessThan(4 * Number.EPSILON);
  });
});

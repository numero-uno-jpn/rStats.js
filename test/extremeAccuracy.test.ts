// Values at extreme parameters that were off (0.15.1), found by the property tests and the fuzz script
// (test/helpers/distributionKnown.ts): above 1, tails not adding up, NaN, or a few digits wrong. The expected values come
// from closed forms, limiting distributions or mpmath (as noted); where R's behaviour is kept, from R 4.5.2.

import { describe, expect, it } from "vitest";
import {
  df,
  dgeom,
  dnorm,
  dt,
  pbeta,
  pbinom,
  pf,
  pgamma,
  pgeom,
  pnbinom,
  pnorm,
  pt,
  qbeta,
  qbinom,
  qcauchy,
  qf,
  qgeom,
  qnbinom,
  qnorm,
  qt,
} from "../src/index.js";
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

describe("pt, dt and qt with a huge df", () => {
  // Above df = 1e200 the t is the normal to the double where t^2/df < 1e-17, and beyond that its log tail and log density
  // are -(df/2) log1p(t^2/df) (src/distributions/nt.ts, HUGE_DF). NaN from df = 1.34e300 (dt) and 3e300 (pt) before
  const flags = [
    { lowerTail: true, logP: false },
    { lowerTail: false, logP: false },
    { lowerTail: true, logP: true },
    { lowerTail: false, logP: true },
  ];

  it("R 4.5.2: pt(10, 1e305) = 1, dt(0, 1e305) = 0.3989422804014327, pt(-6.78e140, 7.19e301) = 0", () => {
    expect(pt(10, 1e305)).toBe(1);
    expect(dt(0, 1e305)).toBe(0.3989422804014327);
    expect(pt(-6.78e140, 7.19e301)).toBe(0);
  });

  it.each([-1e10, -40, -3, -1e-300, 0.5, 10, 38])("pt(%d, df) and dt are pnorm and dnorm at df = 1e305 and 7.19e301", (x) => {
    for (const n of [1e305, 7.19e301, 1e308]) {
      for (const o of flags) expect(pt(x, n, o)).toBe(pnorm(x, o));
      expect(dt(x, n)).toBe(dnorm(x));
      expect(dt(x, n, { log: true })).toBe(dnorm(x, { log: true }));
    }
    // (dt(1.48e-132, 7.19e301, log) was NaN)
    expect(dt(1.48e-132, 7.19e301, { log: true })).toBe(dnorm(1.48e-132, { log: true }));
  });

  it("the far tail -(df/2) log1p(t^2/df), continuous with the general code at df = 1e200", () => {
    // t^2/df = 1e-8 at df = 1e300: -(t^2/2)(1 - y/2 + y^2/3)
    const y = 1e-8;
    expect(rel(pt(1e146, 1e300, { lowerTail: false, logP: true }), -0.5e292 * (1 - y / 2 + (y * y) / 3))).toBeLessThan(1e-14);
    // (t^2/df = 1e-16: -(t^2/2)(1 - 5e-17))
    expect(rel(pt(-1e146, 1e308, { logP: true }), -5e291)).toBeLessThan(4 * Number.EPSILON);
    expect(pt(1e146, 1e308, { lowerTail: false })).toBe(0);
    expect(pt(1e146, 1e308)).toBe(1);
    expect(rel(dt(1e146, 1e308, { log: true }), -5e291)).toBeLessThan(4 * Number.EPSILON);
    // Beyond the doubles: the log is -Infinity (the true value is -2.3e308)
    expect(pt(-1e155, 1e308, { logP: true })).toBe(-Infinity);
    const above = 1.0000000000000002e200;
    for (const x of [0.3, 3, 30, 1e10, 1e91, 1e95, 1e100, 1e150]) {
      expect(rel(pt(-x, above, { logP: true }), pt(-x, 1e200, { logP: true }))).toBeLessThan(1e-14);
      expect(rel(dt(x, above, { log: true }), dt(x, 1e200, { log: true }))).toBeLessThan(1e-14);
    }
  });

  it("qt is qnorm (R 4.5.2: qt(1.31e-295, 7.19e301, lower.tail = FALSE) = 36.727901113286414; 36.72783758590317 before)", () => {
    expect(qt(1.31e-295, 7.19e301, { lowerTail: false })).toBe(36.727901113286414);
    expect(pt(36.727901113286414, 7.19e301, { lowerTail: false })).toBe(pnorm(36.727901113286414, { lowerTail: false }));
    // (took about 1 s)
    const start = performance.now();
    expect(qt(1.68e-35, 7.19e301)).toBe(qnorm(1.68e-35));
    expect(performance.now() - start).toBeLessThan(50);
    // Far out the tail is not the normal: t = sqrt(df expm1(-2 log p / df))
    const q = -qt(-1e300, 1e308, { logP: true });
    expect(rel(q, Math.sqrt(1e308 * Math.expm1(2e-8)))).toBeLessThan(1e-15);
    expect(rel(pt(q, 1e308, { lowerTail: false, logP: true }), -1e300)).toBeLessThan(1e-15);
  });

  it("qt(-1e100, 1e150, log) (the Cornish-Fisher start overflowed: -1)", () => {
    expect(rel(qt(-1e100, 1e150, { logP: true }), qnorm(-1e100, { logP: true }))).toBeLessThan(1e-15);
  });
});

describe("pt, dt and qt with a tiny df", () => {
  it("qt at a subnormal df is ±Infinity, as at df = 1e-300 (R 4.5.2: Inf for qt(1.0877e-5, 8.832105e-318, lower.tail = FALSE))", () => {
    // P[T > t] is 1/2 - (df/2) asinh(t / sqrt(df)): 1/2 to the double at every finite t. 4.26 and 0.2533 before
    expect(qt(1e-5, 1e-310, { lowerTail: false })).toBe(Infinity);
    expect(qt(0.4, 1e-310, { lowerTail: false })).toBe(Infinity);
    expect(qt(1.0877e-5, 8.832105e-318, { lowerTail: false })).toBe(Infinity);
    expect(qt(1.0877e-5, 8.832105e-318)).toBe(-Infinity);
    expect(qt(-700, 5e-324, { logP: true })).toBe(-Infinity);
    expect(pt(-3, 1e-310)).toBe(0.5);
    expect(pt(-3, 5e-324, { lowerTail: false, logP: true })).toBe(-Math.LN2);
  });

  it("qt inverts 1/2 - (df/2) asinh(t / sqrt(df)) near 1/2", () => {
    const p = 0.4999999999999999;
    expect(rel(qt(p, 1e-16, { lowerTail: false }), 1e-8 * Math.sinh(2 * (0.5 - p) * 1e16))).toBeLessThan(1e-14);
    // (the solver stepped to t = Infinity, where the tail was NaN, and stopped at 0.59)
    const q = qt(0.499999999, 1e-10, { lowerTail: false });
    expect(rel(0.5 - pt(q, 1e-10, { lowerTail: false }), 0.5 - 0.499999999)).toBeLessThan(1e-6);
  });

  it("dt at a tiny df is sqrt(df) / (2 sqrt(1 + x^2/df)) (NaN at df = 5e-324; 1e-14 off at df = 1e-80)", () => {
    expect(dt(0, 5e-324)).toBe(Math.sqrt(5e-324) / 2);
    expect(rel(dt(3, 1e-80), 1e-40 / 2 / Math.sqrt(9e80))).toBeLessThan(4 * Number.EPSILON);
    expect(rel(dt(3, 1e-310, { log: true }), Math.log(1e-310 / 6))).toBeLessThan(1e-15);
    expect(rel(dt(1e300, 5e-324, { log: true }), Math.log(5e-324) - Math.log(2e300))).toBeLessThan(1e-15);
  });
});

describe("noncentral pt and dt at the ends of df", () => {
  it("pt(-4.05e269, 3.586e307, ncp = 1) is 0 (NaN; R 4.5.2 gives 0.5, but T is N(1, 1) to the double there)", () => {
    expect(pt(-4.05e269, 3.586e307, { ncp: 1 })).toBe(0);
    expect(pt(-4.05e269, 3.586e307, { ncp: 1, logP: true })).toBe(-Infinity);
    expect(pt(-4.05e269, 3.586e307, { ncp: 1, lowerTail: false })).toBe(1);
    expect(dt(-4.05e269, 3.586e307, { ncp: 1 })).toBe(0);
    expect(dt(-4.05e269, 3.586e307, { ncp: 1, log: true })).toBe(-Infinity);
    // The far tail of the central t where ncp is negligible
    expect(pt(1e146, 1e308, { ncp: 1, lowerTail: false, logP: true })).toBe(pt(1e146, 1e308, { lowerTail: false, logP: true }));
  });

  it.each([1e201, 1e305, 1e308, Infinity])("at df = %d, ordinary x give pnorm(x - ncp) and dnorm(x - ncp)", (n) => {
    expect(pt(1, n, { ncp: 1 })).toBe(0.5);
    expect(pt(3, n, { ncp: 1 })).toBe(pnorm(2));
    expect(pt(-30, n, { ncp: 1, logP: true })).toBe(pnorm(-31, { logP: true }));
    expect(rel(dt(3, n, { ncp: 1 }), dnorm(2))).toBeLessThan(2 * Number.EPSILON);
    expect(qt(1e-300, n, { ncp: 1 })).toBe(1 + qnorm(1e-300));
  });

  it("at the smallest subnormal df (NaN: df/2 rounds to 0) and below 1e-308 (the far tails lost their digits)", () => {
    expect(pt(1e-300, 5e-324, { ncp: 1 })).toBe(pnorm(-1));
    expect(Number.isFinite(dt(0, 5e-324, { ncp: 1, log: true }))).toBe(true);
    // A tail of order df (Φ(-δ) underflows): 0 and Infinity on the log scale before
    const [n, ncp] = [2.64786573e-316, 51.602876797164654];
    expect(pt(51.6475084516575, n, { ncp })).toBeGreaterThan(pt(49.76970539722677, n, { ncp }));
    // P is about df times terms in log(df), which change little from df to 1e10 df
    const diff = pt(1, n, { ncp, logP: true }) - Math.log(n) - (pt(1, n * 1e10, { ncp, logP: true }) - Math.log(n * 1e10));
    expect(Math.abs(diff)).toBeLessThan(0.05);
  });
});

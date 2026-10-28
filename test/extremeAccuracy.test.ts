// Values at extreme parameters that were off (0.15.1), found by the property tests and the fuzz script
// (test/helpers/distributionKnown.ts): above 1, tails not adding up, NaN, or a few digits wrong. The expected values come
// from closed forms, limiting distributions or mpmath (as noted); where R's behaviour is kept, from R 4.5.2.

import { describe, expect, it } from "vitest";
import {
  beta,
  dbeta,
  dcauchy,
  dchisq,
  df,
  dgamma,
  dgeom,
  dinvgamma,
  dkumar,
  dlaplace,
  dlnorm,
  dlogis,
  dnbinom,
  dnorm,
  dpareto,
  dt,
  dtriang,
  dweibull,
  lbeta,
  lgamma,
  pbeta,
  pbinom,
  pcauchy,
  pchisq,
  pf,
  pgamma,
  pgeom,
  pinvgamma,
  pkumar,
  plnorm,
  pnbinom,
  pnorm,
  ppareto,
  ppois,
  pt,
  ptriang,
  ptukey,
  qbeta,
  qbinom,
  qcauchy,
  qchisq,
  qexp,
  qf,
  qgamma,
  qgeom,
  qkumar,
  qlnorm,
  qnbinom,
  qnorm,
  qt,
  qtriang,
  qtukey,
  qweibull,
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

describe("gamma, chisq, invgamma, weibull and lnorm with a huge parameter", () => {
  // NaN from a shape (df, alpha) or sdlog of about 1e301 on: double-double products of numbers above 1e300 overflowed
  // in their splitting, and sums with an overflowed term were Inf - Inf
  it("pgamma(1.4e-284, 4.2e301) (R 4.5.2: log -5.643831101470294e304; mpmath -5.6438311014702939e304)", () => {
    const o = { rate: 0.0013796161711058558 };
    expect(rel(pgamma(1.3913836039305888e-284, 4.169202345291529e301, { ...o, logP: true }), -5.643831101470294e304)).toBeLessThan(1e-15);
    expect(pgamma(1.3913836039305888e-284, 4.169202345291529e301, o)).toBe(0);
    expect(pgamma(1.3913836039305888e-284, 4.169202345291529e301, { ...o, lowerTail: false })).toBe(1);
  });

  it("dgamma at a shape of 9.2e305 (R 4.5.2)", () => {
    const o = { rate: 0.44272583475376925 };
    // log density about -5.9e308, beyond the doubles
    expect(dgamma(1.327296847098002e27, 9.153352708527047e305, o)).toBe(0);
    expect(dgamma(1.327296847098002e27, 9.153352708527047e305, { ...o, log: true })).toBe(-Infinity);
    // (ill-conditioned: the rounding of x / scale alone, eps times 9e305, moves it by 1e-10 relative; this is R's value)
    expect(rel(dgamma(2.0675e306, 9.153352708527047e305, { ...o, log: true }), -8.4153190000542292e292)).toBeLessThan(1e-15);
  });

  it("pchisq and dchisq at df up to 1e308 (R 4.5.2; mpmath for dchisq(1e308, 1e308): 2.8209479177387814e-155)", () => {
    expect(pchisq(1e-300, 1e308)).toBe(0);
    expect(pchisq(1e-300, 1e308, { logP: true })).toBe(-Infinity);
    expect(pchisq(1e-300, 1e308, { lowerTail: false })).toBe(1);
    expect(pchisq(1e-320, 1e306)).toBe(0);
    expect(dchisq(0.21536010784896303, 5.286330057824879e306)).toBe(0);
    expect(dchisq(0.21536010784896303, 5.286330057824879e306, { log: true })).toBe(-Infinity);
    // (0: 2 pi x overflowed in the normalizing factor)
    expect(rel(dchisq(1e308, 1e308), 2.8209479177387811e-155)).toBeLessThan(4 * Number.EPSILON);
    expect(rel(dchisq(1e308, 1e308, { log: true }), -355.8636164445677)).toBeLessThan(4 * Number.EPSILON);
    expect(rel(dchisq(5.286330057824879e306, 5.286330057824879e306, { log: true }), -354.39359347868862)).toBeLessThan(4 * Number.EPSILON);
  });

  it("pinvgamma and dinvgamma at alpha above 1e304 (R 4.5.2 / extraDistr)", () => {
    expect(pinvgamma(5.059185917895126e280, 2.0242939794760302e304, { beta: 1 })).toBe(1);
    const o = { beta: 1.7968496566871956e-118 };
    expect(dinvgamma(1.1835200363587186e-257, 1.329253088279987e306, { ...o, log: true })).toBe(-Infinity);
    expect(dinvgamma(4.9194550701942195e270, 1.329253088279987e306, o)).toBe(0);
  });

  it("dweibull at a shape of 6.6e306 (R 4.5.2; mpmath 700.88513087879334)", () => {
    const o = { scale: 98.6446406954739 };
    expect(dweibull(1.9162046506434228e-255, 6.590415042316493e306, o)).toBe(0);
    expect(dweibull(1e-10, 6.590415042316493e306, { ...o, log: true })).toBe(-Infinity);
    expect(rel(dweibull(98.6446406954739, 6.590415042316493e306, { ...o, log: true }), 700.88513087879335)).toBeLessThan(4 * Number.EPSILON);
  });

  it("plnorm, dlnorm and qlnorm at an sdlog above 1e300 (R 4.5.2; mpmath for dlnorm: -132.60835706727899)", () => {
    expect(plnorm(2, { sdlog: 1e302 })).toBe(0.5);
    const o = { meanlog: -2.1424711721428453, sdlog: 1.292825240812572e305 };
    expect(plnorm(1.2035052020620526e-248, { ...o, logP: true })).toBe(-Math.LN2);
    expect(rel(dlnorm(1.2035052020620526e-248, { ...o, log: true }), -132.608357067279)).toBeLessThan(4 * Number.EPSILON);
    expect(qlnorm(5.06e-257, { ...o, lowerTail: false })).toBe(Infinity);
    expect(qlnorm(0.3, { meanlog: -2.14, sdlog: 1.29e305 })).toBe(0);
    // (NaN above sdlog = 1e300)
    expect(qlnorm(1e-30, { meanlog: -2.196297604130958, sdlog: 9.311905655416405e307 })).toBe(0);
    expect(qlnorm(1e-30, { sdlog: 9.311905655416405e307, lowerTail: false })).toBe(Infinity);
    expect(qlnorm(0.5, { meanlog: -2.196297604130958, sdlog: 9.311905655416405e307 })).toBe(Math.exp(-2.196297604130958));
  });
});

describe("gamma, chisq and invgamma with a subnormal parameter", () => {
  it("qchisq and qgamma at a subnormal df or shape are 0 (NaN; R 4.5.2: 0)", () => {
    expect(qchisq(0.5, 1e-310)).toBe(0);
    expect(qchisq(3.656211020028785e-160, 1.107e-321)).toBe(0);
    expect(qchisq(0.5, 5e-324)).toBe(0);
    expect(qgamma(9.443445113059914e-208, 3.2393711057909095e-307, { rate: 1.8038736175233981e-106 })).toBe(0);
    expect(qgamma(1.2343885600319219e-216, 4.7893788e-316, { scale: 2.0638560126343632 })).toBe(0);
    expect(qgamma(Math.log(1.2343885600319219e-216), 4.7893788e-316, { scale: 2.0638560126343632, logP: true })).toBe(0);
  });

  it("pgamma(Inf) is 1 at a subnormal rate, where 1/rate overflows (NaN; R 4.5.2 gives NaN too)", () => {
    const o = { rate: 2.7994597e-316 };
    expect(qgamma(1.0799480959477422e-229, 892.4483530128322, { ...o, lowerTail: false })).toBe(Infinity);
    expect(pgamma(Infinity, 892.4483530128322, o)).toBe(1);
    expect(pgamma(Infinity, 892.4483530128322, { ...o, lowerTail: false, logP: true })).toBe(-Infinity);
    // pgamma is 0 at every finite q there, so the quantile is Infinity (NaN for a quantile below the normal range before)
    expect(qgamma(3.305367973484006e-160, 0.5, { rate: 4.1869e-319 })).toBe(Infinity);
  });

  it("the log of an upper tail of the order of a subnormal shape (mpmath: log(shape) + log(E1(x)), to O(shape))", () => {
    // (5e-9 off, so that its differences did not match dgamma)
    const o = { scale: 2.0638560126343632, lowerTail: false, logP: true };
    expect(rel(pgamma(1, 4.7893788e-316, o), -726.59696706903367)).toBeLessThan(4 * Number.EPSILON);
    expect(rel(pgamma(1.1183229256009648e-36, 4.7893788e-316, o), -721.63250875171321)).toBeLessThan(4 * Number.EPSILON);
    expect(rel(pchisq(1, 4.3624e-319, { lowerTail: false, logP: true }), -734.32499188853328)).toBeLessThan(4 * Number.EPSILON);
    expect(rel(pinvgamma(1, 4.35e-322, { logP: true }), -741.4796670659051)).toBeLessThan(4 * Number.EPSILON);
    // The density is shape / x e^(-x/scale) to O(shape) (R 4.5.2: -643.26925549824171, less accurate)
    const d = dgamma(1.1183229256009648e-36, 4.7893788e-316, { scale: 2.0638560126343632, log: true });
    expect(rel(d, -643.26925549850858)).toBeLessThan(4 * Number.EPSILON);
    // Where q / scale is below the normal range, log Q from log(shape) (mpmath, from -expm1(shape log q - lgamma1p(shape)));
    // 3e-4 off before
    expect(rel(pgamma(1e-310, 5e-324, { lowerTail: false, logP: true }), -737.87027615604015)).toBeLessThan(4 * Number.EPSILON);
  });
});

describe("beta, F, noncentral F and Tukey at huge and subnormal parameters", () => {
  /** The call's value and its time in ms */
  const timed = (f: () => number): [number, number] => {
    const start = performance.now();
    const v = f();
    return [v, performance.now() - start];
  };

  it("pbeta far above the mass at a shape of 2.6e301 (NaN: the splitting of the continued fraction's divisors overflowed)", () => {
    const [x, a, b] = [1.4897613331026733e-236, 9220.54059054371, 2.5608778622012845e301];
    expect(pbeta(x, a, b)).toBe(1);
    expect(Math.abs(pbeta(x, a, b, { logP: true }))).toBe(0);
    expect(pbeta(x, a, b, { lowerTail: false })).toBe(0);
    // mpmath, from the gamma limit: -y + (a - 1) log y - lgamma(a), y = -b log1p(-x) (R 4.5.2: -3.8150968179061101e65)
    expect(rel(pbeta(x, a, b, { lowerTail: false, logP: true }), -3.8150968179061096e65)).toBeLessThan(1e-15);
  });

  it("pbeta and dbeta at a shape of 6.3e307 (NaN: the products in the continued fraction and the expansion for large a overflowed)", () => {
    const [a, b] = [55.11485820081626, 6.332054207061664e307];
    // mpmath, from the gamma limit P(a, -b log1p(-x)) (relative error of order a²/b)
    expect(rel(pbeta(1e-307, a, b), 1.4956825292090002e-32)).toBeLessThan(1e-14);
    expect(rel(pbeta(1e-305, a, b, { lowerTail: false, logP: true }), -448.81185571357994)).toBeLessThan(1e-14);
    // b log(1 - x) beyond the doubles
    expect(pbeta(0.9981707623107112, a, b)).toBe(1);
    expect(pbeta(0.9981707623107112, a, b, { lowerTail: false, logP: true })).toBe(-Infinity);
    expect(dbeta(0.9981707623107112, a, b)).toBe(0);
    expect(dbeta(0.9981707623107112, a, b, { log: true })).toBe(-Infinity);
  });

  it("pf with ncp = 3.7e307: the tails add up (both 0 before; 6 (a + 2λ) overflowed; R 4.5.2 gives NaN)", () => {
    const o = { ncp: 3.6563492032068665e307 };
    for (const q of [2.5e300, 1e303, 1e307]) {
      const lo = pf(q, 1827.512149376115, 0.16542329604093037, o);
      const up = pf(q, 1827.512149376115, 0.16542329604093037, { ...o, lowerTail: false });
      expect(lo).toBeGreaterThan(0);
      expect(Math.abs(lo + up - 1)).toBeLessThan(4 * Number.EPSILON);
      expect(rel(pf(q, 1827.512149376115, 0.16542329604093037, { ...o, logP: true }), Math.log(lo))).toBeLessThan(1e-13);
    }
  });

  it("qbeta at a mean of 3.6e-298 (0 after 800 ms; R 4.5.2: 3.0783547683664219e-298, 2.7961046762139912e-298)", () => {
    const [a, b] = [9220.54059054371, 2.5608778622012845e301];
    const [q, ms] = timed(() => qbeta(5.865506627317276e-49, a, b));
    expect(rel(q, 3.0783547683664219e-298)).toBeLessThan(1e-14);
    expect(ms).toBeLessThan(100);
    expect(rel(qbeta(-275.4002018147623, a, b, { logP: true }), 2.7961046762139912e-298)).toBeLessThan(1e-14);
  });

  it("qbeta(8.7e-285, 1.3e304, 5.9) is 1 (did not return; R 4.5.2 does not converge): 1 - x is about 5e-302", () => {
    const [q, ms] = timed(() => qbeta(8.695245994573303e-285, 1.326518545361005e304, 5.890954242396564));
    expect(q).toBe(1);
    expect(ms).toBeLessThan(100);
  });

  it("pbeta's upper tail beside a lower tail of 1.4e-305 is 1 (1 - 5.5e-14; R 4.5.2: 1 and 1.4255049416209152e-305)", () => {
    const [x, a, b] = [0.9999999999999395, 0.9668818597712154, 4.675035776702327e-307];
    expect(pbeta(x, a, b, { lowerTail: false })).toBe(1);
    // (mpmath: 1.4255049416209151e-305)
    expect(pbeta(x, a, b)).toBe(1.4255049416209152e-305);
  });

  it("the log of a beta tail of the order of a subnormal shape (mpmath at 400 digits)", () => {
    // (lost digits, so that dbeta did not match the differences of pbeta; R 4.5.2: -736.93128475074695)
    expect(rel(pbeta(0.972696723183617, 0.130360175608773, 8.15e-322, { logP: true }), -736.93155014878607)).toBeLessThan(1e-15);
    const upper = pbeta(4.972082704953929e-48, 6e-323, 433.58274113933624, { lowerTail: false, logP: true });
    expect(rel(upper, -737.3275283536092)).toBeLessThan(1e-15);
  });

  it("qbeta with a subnormal answer is found to its last digits (R 4.5.2: 9.5859307275097659e-309; 9.58593072751027e-309 before)", () => {
    expect(qbeta(3.830053778789327e-277, 27.945113448945182, 1.5106518374066408e299)).toBe(9.5859307275097659e-309);
  });

  it("noncentral densities at a tiny or subnormal ncp are the central ones (NaN)", () => {
    // mpmath: 9.3999238814456980e185, 1.0377814439791256e133, 0.24197072451914335, 1.3617011778446561e251 (R 4.5.2:
    // 9.3999238814454927e185, 1.0377814439791258e133, 0.24197072451914337, 1.3617011778446392e251)
    const x = 1.0522653871898304e-231;
    expect(dbeta(x, 0.1937170160875713, 141.08193369784416, { ncp: 1.3857699868036388e-303 })).toBe(dbeta(x, 0.1937170160875713, 141.08193369784416));
    expect(rel(dbeta(x, 0.1937170160875713, 141.08193369784416), 9.399923881445698e185)).toBeLessThan(1e-15);
    expect(dchisq(1.4777750489339286e-267, 1, { ncp: 1.1186442675478367e-308 })).toBe(dchisq(1.4777750489339286e-267, 1));
    expect(rel(dchisq(1.4777750489339286e-267, 1), 1.0377814439791256e133)).toBeLessThan(1e-15);
    expect(dchisq(1, 1, { ncp: 1e-310 })).toBe(0.24197072451914337);
    const q = 2.855286418252648e-257;
    expect(df(q, 0.02747085704007554, 3, { ncp: 5e-324 })).toBe(df(q, 0.02747085704007554, 3));
    expect(rel(df(q, 0.02747085704007554, 3), 1.3617011778446561e251)).toBeLessThan(1e-15);
    // Where the first terms of the mixture matter (λ/2 times the density ratio 2.5e279 at a shape of 1e-280)
    expect(rel(dbeta(0.5, 1e-280, 1, { ncp: 2e-290 }), 2e-280 * (1 + 1e-290 * (0.5 / 1e-280 - 1)))).toBeLessThan(1e-14);
  });

  it("qf at a df2 of 6e302 is the χ² limit (did not return; R 4.5.2: 4.6113445353195029e-287)", () => {
    // mpmath: the quantile of χ²_m / m, 4.6113445353197333e-287
    const [q, ms] = timed(() => qf(1.8948181757135773e-13, 0.08851774263240042, 6.009378697059168e302));
    expect(rel(q, 4.6113445353197333e-287)).toBeLessThan(1e-14);
    expect(ms).toBeLessThan(100);
  });

  it("pf and qf with df2 = Inf where q df1 is below the normal range (0; R 4.5.2 gives 0 too)", () => {
    // mpmath: P(0.0060430404814836891, 1.2e-325) = 0.010913891600212120
    expect(rel(pf(2e-323, 0.012086080962967378, Infinity), 0.01091389160021212)).toBeLessThan(1e-14);
    expect(qf(7.829924534587012e-37, 0.012086080962967378, Infinity)).toBe(0);
  });

  it("noncentral qf beyond the doubles is Infinity (did not return; R 4.5.2: Inf)", () => {
    // A subnormal df1 and λ = 1.7e243: F lies beyond the doubles but for the point mass e^(-λ/2) at 0
    const [q, ms] = timed(() => qf(5.390320876058269e-11, 3.69345607573e-313, 1249.223519976018, { ncp: 1.676553834669942e243 }));
    expect(q).toBe(Infinity);
    expect(ms).toBeLessThan(100);
  });

  it("noncentral qf at a df2 of 1.1e264 is the noncentral χ² limit (did not return; R 4.5.2: Inf)", () => {
    const [m, n, ncp] = [1.052878110723803, 1.1413991322004876e264, 1.6535148456194238e262];
    const [q, ms] = timed(() => qf(-385.7634988957127, m, n, { ncp, logP: true }));
    // (log W has a spread of 1.3e-132 there)
    expect(q).toBe(qchisq(-385.7634988957127, m, { ncp, logP: true }) / m);
    expect(ms).toBeLessThan(100);
  });

  it("qtukey and ptukey where 1 - W underflows with nranges = 2 (did not return; R 4.5.2: NaN, and -Inf on the log scale)", () => {
    const o = { nranges: 2, lowerTail: false };
    const [q, ms] = timed(() => qtukey(1.5199556825410626e-287, 3, 46673457704.69311, o));
    expect(rel(ptukey(q, 3, 46673457704.69311, o), 1.5199556825410626e-287)).toBeLessThan(1e-13);
    expect(ms).toBeLessThan(500);
    // log(1 - (1 - Wc)^2) is log 2 + log Wc to the double (-Infinity before)
    expect(ptukey(54.5, 3, Infinity, { ...o, logP: true })).toBe(Math.LN2 + ptukey(54.5, 3, Infinity, { lowerTail: false, logP: true }));
    // mpmath: log(1 - W) = -745.34197838962728 for k = 3 (with nranges = 2: -744.64883120906734)
    expect(rel(ptukey(54.5, 3, Infinity, { ...o, logP: true }), -744.64883120906734)).toBeLessThan(1e-14);
  });
});

describe("Cauchy, Kumaraswamy, Pareto, negative binomial and noncentral χ² at subnormal and huge arguments", () => {
  it("qcauchy with logP and a subnormal scale keeps its digits (scale / π lost bits; R 4.5.2: -1.7624822526054919e-76)", () => {
    // mpmath: location - scale / tan(π e^p) = -1.7624822526054919646e-76 (-1.762482252486489e-76 before)
    const q = qcauchy(-547.516758888431, { location: 3.5476859422264514e-180, scale: 9.11522704e-314, logP: true });
    expect(rel(q, -1.7624822526054919646e-76)).toBeLessThan(4 * Number.EPSILON);
    // e^(-p/2) overflowed from -p = 1420 on, where the quantile at the smallest scale is still finite (-Infinity before);
    // mpmath: -3.8079279709616671755e301
    expect(rel(qcauchy(-1440, { scale: 5e-324, logP: true }), -3.8079279709616671755e301)).toBeLessThan(4 * Number.EPSILON);
  });

  it("qkumar at a tiny a is 0: w^(1/a) underflows for every w <= 1/2 (NaN before; extraDistr gives 0)", () => {
    const [a, b] = [9.850037901e-314, 2.5311232825763126];
    expect(qkumar(4.809434689888833e-52, a, b)).toBe(0);
    expect(qkumar(0.5, a, b)).toBe(0);
    expect(qkumar(Math.log(0.5), a, b, { logP: true })).toBe(0);
    expect(qkumar(0.5, 1.436669495309376e-308, 2)).toBe(0);
  });

  it("the log of a Kumaraswamy or Pareto tail of the order of a subnormal shape (lost digits; extraDistr gives -Inf)", () => {
    // mpmath at 60 digits: log(-expm1(b log(1 - x^a))) = -729.64480824528978 (-729.6448080640358 before), and the log
    // density log(a b x^(a-1) (1 - x^a)^(b-1)) = -728.52883050130359 (extraDistr: -728.528830589584, off)
    const [x, a, b] = [0.20150301163084805, 0.4223756809729819, 1.8537887e-317];
    expect(rel(pkumar(x, a, b, { logP: true }), -729.64480824528978)).toBeLessThan(1e-15);
    expect(rel(dkumar(x, a, b, { log: true }), -728.52883050130359)).toBeLessThan(1e-15);
    // mpmath: log(-expm1(-a log x)) = -728.12787095479600 (-728.1278709160887 before), log(a x^-(a+1)) = -735.64381137839809
    expect(rel(ppareto(318.7041047333832, { a: 1.040734e-317, logP: true }), -728.127870954796)).toBeLessThan(1e-15);
    expect(rel(dpareto(318.7041047333832, { a: 1.040734e-317, log: true }), -735.64381137839809)).toBeLessThan(1e-15);
  });

  it("dnbinom(0) at a size of 2.4e301 is prob^size (NaN: the splitting of size in the product overflowed)", () => {
    // mpmath: size log(prob) = -5.5037505412224715e290 (R 4.5.2 too)
    const [n, prob] = [2.373385507516785e301, 0.9999999999768105];
    expect(rel(dnbinom(0, n, { prob, log: true }), -5.5037505412224715e290)).toBe(0);
    expect(Object.is(dnbinom(0, n, { prob }), 0)).toBe(true);
  });

  it("noncentral χ² at λ = 2.9e304 and a tiny x: e^(-λ/2) times the central parts (NaN)", () => {
    const [x, k, ncp] = [1.0051275796545665e-308, 294.3792308686567, 2.9075530479120456e304];
    // The log is -λ/2 plus terms of order 1e5, far below an ulp of it (R 4.5.2: -1.0243631212370614e307 for the
    // density, off)
    expect(dchisq(x, k, { ncp, log: true })).toBe(-ncp / 2);
    expect(rel(pchisq(x, k, { ncp, logP: true }), -ncp / 2)).toBeLessThan(4 * Number.EPSILON);
    expect(pchisq(x, k, { ncp })).toBe(0);
    expect(pchisq(x, k, { ncp, lowerTail: false })).toBe(1);
  });

  it("noncentral χ² at a subnormal x with an odd last bit: no step from the rounding of x/2 (mpmath at 60 digits)", () => {
    // P = e^(-λ/2) to double precision for a df of 1.2e-51 (1.3474793410715707e-43 before; R 4.5.2: 1.3474793410715195e-43)
    const tiny = pchisq(2.1396743e-317, 1.1880112027598556e-51, { ncp: 197.42584661272352 });
    expect(rel(tiny, 1.3474793410715195e-43)).toBeLessThan(4 * Number.EPSILON);
    // Σ_j Pois(j; λ/2) P(k/2 + j, x/2) and its density, at x/2 exactly (x/2 rounded was 0.8% off at x = 1.63e-322)
    expect(rel(pchisq(1.63e-322, 0.4879396427871575, { ncp: 1 }), 1.7579084577982178e-79)).toBeLessThan(1e-14);
    expect(rel(dchisq(1.63e-322, 0.4879396427871575, { ncp: 1 }), 2.6304725077516812e242)).toBeLessThan(1e-14);
    const o = { ncp: 24.327519525000625 };
    expect(rel(pchisq(7.022937096e-315, 0.5, o), 1.4008684938876251e-84)).toBeLessThan(1e-14);
    expect(rel(dchisq(7.022937096e-315, 0.5, o), 4.9867615030698938e229)).toBeLessThan(1e-14);
    const upper = pchisq(1.9283e-320, 1.3552501438938642, { ncp: 54.19031987702839, lowerTail: false, logP: true });
    expect(rel(upper, -2.6638446817959692e-229)).toBeLessThan(1e-14);
  });

  it("noncentral χ² at a huge x and a tiny ncp: the central values (NaN: the term ratio y / (a + j) overflowed its splitting)", () => {
    // mpmath: the central log density -1.4805333340327379e307
    const x = 2.961066668065476e307;
    expect(dchisq(x, 0.5, { ncp: 2.227e-320 })).toBe(0);
    expect(rel(dchisq(x, 0.5, { ncp: 2.227e-320, log: true }), -1.4805333340327379e307)).toBeLessThan(1e-15);
    expect(pchisq(4.2297265002286223e301, 0.01148621542883975, { ncp: 1.4912053330895896e-303 })).toBe(1);
    expect(pchisq(4.2297265002286223e301, 0.01148621542883975, { ncp: 1.4912053330895896e-303, lowerTail: false, logP: true })).toBe(
      pchisq(4.2297265002286223e301, 0.01148621542883975, { lowerTail: false, logP: true }),
    );
  });

  it("noncentral χ² where x + λ is beyond the doubles (0.55 at x = 1e308 for λ = 6.9e307, NaN or -Infinity beyond)", () => {
    const [k, ncp] = [3.2994201097489077e268, 6.93900544389044e307];
    // the mean is 6.94e307 and the standard deviation 1.7e154: the upper tail far out, the quantile at the mean
    for (const x of [1e308, 1.5e308, 1.7976931348623157e308]) {
      expect(pchisq(x, k, { ncp })).toBe(1);
      expect(pchisq(x, k, { ncp, lowerTail: false, logP: true })).toBeLessThan(-1e306);
      expect(dchisq(x, k, { ncp, log: true })).toBeLessThan(-1e306);
    }
    expect(rel(qchisq(-85.58095236813449, k, { ncp, logP: true }), ncp)).toBeLessThan(1e-14);
    // mpmath, from I_(1/2)(z) = sqrt(2 / (π z)) sinh z: -5.7091183974034792e306 (-Infinity before: 2πz overflowed)
    expect(rel(dchisq(1.79e308, 3, { ncp: 1e308, log: true }), -5.7091183974034792e306)).toBeLessThan(1e-14);
  });

  it("pchisq at x near 1e-307 and a tiny df: no step from the log Poisson weights (1.4e-15 above e^(-λ/2) before)", () => {
    const e = Math.exp(-376.01614454288807 / 2); // P = e^(-λ/2) (1 - O(df)) to the double
    for (const x of [1e-307, 3.773015050217397e-307, 3.612655063767058e-198]) {
      expect(rel(pchisq(x, 1.0815364379934587e-261, { ncp: 376.01614454288807 }), e)).toBeLessThan(4 * Number.EPSILON);
    }
  });

  it("pcauchy and dcauchy where q - location overflows (0 and -Infinity before)", () => {
    const o = { location: -1.1000747441814416e307, scale: 2.7035785439311993e296 };
    // mpmath: atan(scale / (q - location)) / π = 4.529328385253959e-13, log density -738.26109900198
    expect(rel(pcauchy(1.79e308, { ...o, lowerTail: false }), 4.529328385253959e-13)).toBeLessThan(4 * Number.EPSILON);
    expect(rel(pcauchy(1.79e308, { ...o, lowerTail: false, logP: true }), Math.log(4.529328385253959e-13))).toBeLessThan(1e-15);
    expect(rel(dcauchy(1.79e308, { ...o, log: true }), -738.26109900198)).toBeLessThan(1e-15);
  });

  it("dnorm at an sd whose reciprocal overflows (NaN before)", () => {
    // mpmath: φ(30) / sd = 8.7726264199125589e125 (sd = 1.7e-322 is 34 times 2^-1074, so x / sd = 30 exactly)
    const sd = 1.7e-322;
    expect(rel(dnorm(30 * sd, { sd }), 8.7726264199125589e125)).toBeLessThan(4 * Number.EPSILON);
    expect(dnorm(sd, { sd })).toBe(Infinity);
    expect(dnorm(4.84965e-319, { sd })).toBe(0);
  });

  it("qtriang with a subnormal width (the mode before: the share of the tail overflowed)", () => {
    // b - sqrt(p (b - a)(b - c)) and b (1 - sqrt(1 - p)) for c = a, to the subnormal grid
    expect(qtriang(1.551140155802517e-8, { a: 0, b: 1.02822077e-316, c: 8.726421e-317, lowerTail: false })).toBe(1.02817096e-316);
    expect(qtriang(-7.385706883968851, { a: 0, b: 7.36918471256e-313, c: 0, logP: true })).toBe(2.2849939e-316);
  });
});

describe("subnormal probabilities, shapes and scales: quantile searches, densities and tails", () => {
  it("qgamma at a subnormal p: the search's residual F / p overflowed (8.2e146, 1e21 times the mean, before)", () => {
    // mean + 38 sd rounds to the mean (R 4.5.2: 4.4838914172971214e125)
    const o = { scale: 0.13574289405428971, lowerTail: false };
    expect(rel(qgamma(7.228026e-317, 3.3032236777741095e126, o), 4.4838914172971214e125)).toBeLessThan(4 * Number.EPSILON);
    // mpmath: 1068.1884134409693566
    expect(rel(qgamma(1e-320, 100, { lowerTail: false }), 1068.1884134409693566)).toBeLessThan(1e-15);
  });

  it("pbeta at a subnormal x and a shape above 1e300 (NaN before: the splitting of a overflowed)", () => {
    // mpmath: a log x - log a - log B(a, b) = -1.0617460181147866708e307 (R 4.5.2: 0 for the probability)
    const [x, a, b] = [1.5e-323, 1.428342256921063e304, 0.5];
    expect(rel(pbeta(x, a, b, { logP: true }), -1.0617460181147866708e307)).toBeLessThan(4 * Number.EPSILON);
    expect(Object.is(pbeta(x, a, b), 0)).toBe(true);
    expect(pbeta(x, a, b, { lowerTail: false })).toBe(1);
    // where a log x overflows: 0 and 1 (NaN before)
    expect(pbeta(4.2200334418145e-310, 4.1497590175229216e307, 1113.067753031272)).toBe(0);
    expect(pbeta(4.2200334418145e-310, 4.1497590175229216e307, 1113.067753031272, { lowerTail: false })).toBe(1);
  });

  it("pf and qf at a subnormal df1 (pf 1 from x = 1e301, qf did not return)", () => {
    // mpmath: 1 - I_z(m/2, n/2) = 1.7736597835407333347e-311 (R 4.5.2: 1.7736597835471501e-311). The tail is of the
    // order of df1 / 2, and halving the subnormal df1 rounds it by 3.5e-12 relative (one ulp of 2.8e11), as in R
    expect(rel(pf(1e301, 1.404267690436e-312, 6.719470768117538, { lowerTail: false }), 1.7736597835407333347e-311)).toBeLessThan(1e-11);
    // the upper tail at the largest double is above p: Infinity (as R 4.5.2)
    expect(qf(1.1e-322, 1.404267690436e-312, 6.719470768117538, { lowerTail: false })).toBe(Infinity);
    expect(qf(7.4e-323, 5.19e-321, 6919.816403825189, { lowerTail: false })).toBe(Infinity);
    expect(qf(-744.4400719213812, 4.41e-321, 188.37652352362298, { lowerTail: false, logP: true })).toBe(Infinity);
    expect(qf(8.69116e-319, 8.85435e-319, 0.19301319994257646, { lowerTail: false })).toBe(Infinity);
    // a step of the search to Infinity, where pf was NaN, left it there (1 after 5 s before); the round trip
    const [m, n] = [1.2521637655121952e-305, 334518.7421552894];
    const q = qf(-735.1552736384871, m, n, { lowerTail: false, logP: true });
    expect(Math.abs(pf(q, m, n, { lowerTail: false, logP: true }) + 735.1552736384871)).toBeLessThan(1e-12);
  });

  it("lgamma and lbeta at a subnormal argument (Infinity and NaN before)", () => {
    // mpmath: 744.44007192138126231, 714.49452600871411041 (R 4.5.2: 744.44007192138122, 714.49452600871405)
    expect(rel(lgamma(5e-324), 744.44007192138126231)).toBeLessThan(4 * Number.EPSILON);
    // -log|x| to the double (R 4.5.2: lgamma(1e-310) is 713.80137882815416, lbeta(2.6e-321, 3460) 738.17477070864356)
    expect(rel(lgamma(-1e-310), 713.80137882815416)).toBeLessThan(4 * Number.EPSILON);
    expect(rel(lbeta(1e-310, 1e-310), 714.49452600871411041)).toBeLessThan(4 * Number.EPSILON);
    expect(rel(lbeta(2.6e-321, 3460), 738.17477070864356)).toBeLessThan(4 * Number.EPSILON);
    // B(a, a) > 2/a overflows (R 4.5.2 gives NaN)
    expect(beta(1e-310, 1e-310)).toBe(Infinity);
  });

  it("noncentral qf at a huge λ starts from the df1 = Inf limit (1 s before, through a 0.5 s integral far in the left tail)", () => {
    const [p, m, n, ncp] = [3.9676390269921496e-237, 364.44554111063366, 1.476228574471317, 194107871089.7223];
    const q = qf(p, m, n, { ncp });
    expect(rel(pf(q, m, n, { ncp }), p)).toBeLessThan(1e-12);
  });

  it("densities formed without a subnormal intermediate (exp(-|z|), π scale or size / (size + x) rounded there)", () => {
    // mpmath: e^(-|z|) / (2 σ) = 5.725311369130697478737989811e-153 (6e-4 off before; extraDistr: 5.7253113691307606e-153)
    const lap = dlaplace(9.486302497985611e-158, { mu: 9.486302498433996e-158, sigma: 6.044548486737205e-171 });
    expect(rel(lap, 5.725311369130697478737989811e-153)).toBeLessThan(4 * Number.EPSILON);
    // mpmath: log(e / (s (1 + e)^2)) = -7.1442419008923713678 (R 4.5.2 linear: log -7.1442431635500565)
    expect(rel(Math.log(dlogis(-3.5667197e-316, { scale: 4.81926e-319 })), -7.1442419008923713678)).toBeLessThan(1e-15);
    // mpmath with z = x / sd rounded to the double, as in the log density: 5.257663011252930427e-304 (3e-4 off before;
    // R 4.5.2: 0)
    expect(rel(dnorm(-1.59e-321, { sd: 3e-323 }), 5.257663011252930427e-304)).toBeLessThan(4 * Number.EPSILON);
    // mpmath: scale / (π (x² + scale²)) = 1.0713040120123239228e305 (R 4.5.2: 1.0713040120126725e305) and
    // 1.5726597949504820695e-304 (0 before: z overflowed; R 4.5.2: 0), whose log is -699.53309994734974888
    expect(rel(dcauchy(-2.16543841389836e-309, { scale: 1.57817263326e-312 }), 1.0713040120123239228e305)).toBeLessThan(4 * Number.EPSILON);
    expect(rel(dcauchy(1e-10, { scale: 5e-324 }), 1.5726597949504820695e-304)).toBeLessThan(4 * Number.EPSILON);
    expect(rel(dcauchy(1e-10, { scale: 5e-324, log: true }), -699.53309994734974888)).toBeLessThan(1e-15);
    // mpmath, from the series of the pmf: -735.57086038617797193 and -735.72132165919674871 (R 4.5.2:
    // -735.57086040999684, -735.721321651675)
    const o = { prob: 0.12459577713161707, log: true };
    expect(rel(dnbinom(57, 3.941094207e-315, o), -735.57086038617797193)).toBeLessThan(1e-15);
    expect(rel(dnbinom(58, 3.941094207e-315, o), -735.72132165919674871)).toBeLessThan(1e-15);
  });

  it("quantiles at a log p below the normal range (exp(p) was rounded on the subnormal grid)", () => {
    // mpmath: -log1p(-e^p) / rate = 1.488073648635756043e-56 (R 4.5.2: 1.4880736486358194e-56)
    expect(rel(qexp(-720.6156070081367, { rate: 7.378938265185878e-258, logP: true }), 1.488073648635756043e-56)).toBeLessThan(4 * Number.EPSILON);
    // mpmath: scale (-log1p(-e^p)) = 1.48806429415538799e-56 (R 4.5.2: 1.4880642941554512e-56)
    expect(rel(qweibull(-720.6156070081367, 1, { scale: 1.3552e257, logP: true }), 1.48806429415538799e-56)).toBeLessThan(4 * Number.EPSILON);
    // mpmath at 700 digits: (1 - (1 - e^p)^(1/b))^(1/a) = 1.0076418889538287057e-284 (extraDistr: 0)
    const k = qkumar(-744.2443613428673, 1.1349253174979674, 0.12411336352541393, { logP: true });
    expect(rel(k, 1.0076418889538287057e-284)).toBeLessThan(4 * Number.EPSILON);
  });

  it("gamma and Poisson tails of a few subnormal ulps (0 before, the factor x^a e^-x / Γ(a + 1) underflowed first)", () => {
    // mpmath: 9.8813129168228543e-324 and 2.7530007493947218e-323, i.e. 2 and 6 ulps of 2^-1074 (as R 4.5.2)
    expect(pchisq(150856.77415319227, 172464.33346354478)).toBe(2 * Number.MIN_VALUE);
    expect(ppois(248046, 229399.39745017525, { lowerTail: false })).toBe(6 * Number.MIN_VALUE);
  });

  it("ptriang and dtriang where a ratio of lengths is subnormal (extraDistr gives -Inf for ptriang)", () => {
    // mpmath: log(x² / (b c)) = -1484.8619589788330398, log(2 x / (b c)) = -1047.7980830038098432
    const o = { a: 0, b: 1.2412114100115105e133, c: 5.580977276459495e132 };
    expect(rel(ptriang(3.066199584564306e-190, { ...o, logP: true }), -1484.8619589788330398)).toBeLessThan(1e-15);
    expect(rel(dtriang(3.066199584564306e-190, { ...o, log: true }), -1047.7980830038098432)).toBeLessThan(1e-15);
    // mpmath at 700 digits: log(1 - (1 - x/b)²) = -735.59530309385156731 (the far tail for c = a)
    const t = ptriang(2.2847913320311623e-257, { a: 0, b: 1.3330842142984116e63, c: 0, logP: true });
    expect(rel(t, -735.59530309385156731)).toBeLessThan(1e-15);
  });

  it("pgeom at a subnormal prob from x = 1e290 (0 before: log(1 - prob) lost the subnormal prob)", () => {
    // 1 - (1 - p)^(x+1) = (x + 1) p to the double: 1e290 * 2^-1074
    expect(rel(pgeom(1e290, 5e-324), 1e290 * 5e-324)).toBeLessThan(4 * Number.EPSILON);
    expect(rel(pgeom(1.948811553346453e294, 5e-324, { lowerTail: false, logP: true }), -1.948811553346453e294 * 5e-324)).toBeLessThan(4 * Number.EPSILON);
  });

  it("ptukey at a subnormal q scales the lower tail from 2^-1000 (the integral lost 3e-11 there, and qtukey took 1.2 s)", () => {
    // the lower tail is c q^((k-1) r) to (1 + O(q²)): log P(1e-300) + log(q / 1e-300) for k = 2
    const o = { logP: true };
    const at = ptukey(1e-300, 2, 486.8681928207351, o) + Math.log(3.5335144e-316 * 1e300);
    expect(Math.abs(ptukey(3.5335144e-316, 2, 486.8681928207351, o) - at)).toBeLessThan(1e-12);
    const q = qtukey(-726.9274748544988, 2, 486.8681928207351, o);
    expect(Math.abs(ptukey(q, 2, 486.8681928207351, o) + 726.9274748544988)).toBeLessThan(1e-9);
  });
});

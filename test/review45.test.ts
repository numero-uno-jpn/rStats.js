// Fixes of the 45th review round (review_fix_log_20261031_45.md): distributions. Pareto's point mass at a = Infinity,
// pbeta/qbeta where a + b overflows, distSummary (huge beta shapes, small hypergeometric populations, point masses,
// the standard deviation where the variance overflows), and wilcox (log probabilities below 1e-612, mn beyond 2^53).
import { describe, expect, it } from "vitest";
import { distSummary, dwilcox, pbeta, ppareto, pwilcox, qbeta, qpareto, qwilcox } from "../src/index.js";

describe("review 45: distribution functions", () => {
  it("DIST-001: ppareto counts the point mass at b when a is infinite", () => {
    // qpareto gives b; ppareto(b) was 0 (the lower tail) and 1 (the upper)
    expect(ppareto(1, { a: Infinity, b: 1 })).toBe(1);
    expect(ppareto(1, { a: Infinity, b: 1, lowerTail: false })).toBe(0);
    expect(ppareto(1, { a: Infinity, b: 1, logP: true })).toBe(0);
    expect(ppareto(0.999, { a: Infinity, b: 1 })).toBe(0);
    expect(ppareto(1.001, { a: Infinity, b: 1 })).toBe(1);
    expect(qpareto(0.5, { a: Infinity, b: 1 })).toBe(1);
  });
  it("DIST-002: pbeta and qbeta where a + b overflows", () => {
    // R 4.5.2: pbeta 0.5, 1 and 0 next to 0.5; qbeta NaN with a warning. Here pbeta was NaN and qbeta 0.75
    expect(pbeta(0.5, 1e308, 1e308)).toBe(0.5);
    expect(pbeta(0.5, 9e307, 9e307)).toBe(0.5);
    expect(pbeta(0.5, 1e308, 1e308, { logP: true })).toBeCloseTo(-Math.LN2, 15);
    expect(pbeta(0.5000000000000001, 1e308, 1e308)).toBe(1);
    expect(pbeta(0.4999999999999999, 1e308, 1e308)).toBe(0);
    // log: -a log(1 - 4 d^2), about -4 a d^2 with d = 2^-53 (R gives -3.98e276)
    expect(pbeta(0.4999999999999999, 1e308, 1e308, { logP: true }) / (-1e308 * 2 ** -104)).toBeCloseTo(1, 10);
    expect(qbeta(0.5, 1e308, 1e308)).toBe(0.5);
    expect(qbeta(0.3, 1e308, 1e308)).toBe(0.5);
    expect(qbeta(0.5, 1e308, 5e307)).toBeCloseTo(2 / 3, 15);
    // a + b overflowing with a small b (the Temme expansion with m about b): as R
    expect(pbeta(1e-308, 1, 1.7e308)).toBeCloseTo(0.81731647594726518, 14);
    expect(pbeta(3e-308, 2, 1.7e308)).toBeCloseTo(0.96280984595035495, 14);
    // the median of Beta(1, b) is log 2 / b (R gives 5.56e-309)
    expect(qbeta(0.5, 1, 1.7e308) / (Math.LN2 / 1.7e308)).toBeCloseTo(1, 12);
  });
  it("DIST-008: wilcox with mn beyond 2^53 is NaN at once", () => {
    // the table loop ran m times for a table of one entry (about 50 minutes for m = 1e12)
    const t0 = performance.now();
    expect(dwilcox(0, 1e12, 1e12)).toBeNaN();
    expect(pwilcox(0, 1e12, 1e12)).toBeNaN();
    expect(qwilcox(0.5, 1e12, 1e12)).toBeNaN();
    expect(dwilcox(0, 2 ** 27, 2 ** 27)).toBeNaN();
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

describe("review 45: distSummary", () => {
  it("DIST-003: beta with shapes whose sum or product overflows", () => {
    const s = distSummary("beta", { shape1: 1e308, shape2: 1e308 });
    // was mean 0, variance 0, median 0.75, mode 0
    expect(s.mean).toBe(0.5);
    expect(s.median).toBe(0.5);
    expect(s.mode).toBe(0.5);
    expect(s.variance / (0.125 / 1e308)).toBeCloseTo(1, 12);
    expect(s.sd / Math.sqrt(0.125 / 1e308)).toBeCloseTo(1, 12);
    expect(s.skewness).toBe(0);
    expect(s.kurtosis / (-3 / 1e308)).toBeCloseTo(1, 12);
    const u = distSummary("beta", { shape1: 1e308, shape2: 5e307 });
    expect(u.mean).toBeCloseTo(2 / 3, 15);
    expect(u.median).toBeCloseTo(2 / 3, 15);
    // 2 (q - p) / sqrt(p q (a + b)): negative
    expect(u.skewness / ((2 * (1 / 3 - 2 / 3)) / Math.sqrt((2 / 9) * 1.5e308))).toBeCloseTo(1, 12);
    // 6 ((p - q)^2 - p q) / (p q (a + b)) (it was -0: (a + b + 2)(a + b + 3) overflowed)
    expect(u.kurtosis / (-3 / 1.5e308)).toBeCloseTo(1, 12);
    // a b overflows with a + b finite (kurtosis was NaN): -6 / (a + b) for equal shapes
    const w = distSummary("beta", { shape1: 1e200, shape2: 1e200 });
    expect(w.skewness).toBe(0);
    expect(w.kurtosis / (-6 / 2e200)).toBeCloseTo(1, 12);
  });
  it("DIST-004: hypergeometric with a population of 2 or 3", () => {
    // Bernoulli(1/2) and Bernoulli(1/3): the closed forms divide by N - 2 and N - 3
    const a = distSummary("hyper", { m: 1, n: 1, k: 1 });
    expect(a.skewness).toBe(0);
    expect(a.kurtosis).toBeCloseTo(-2, 14);
    const b = distSummary("hyper", { m: 1, n: 2, k: 1 });
    expect(b.skewness).toBeCloseTo(Math.SQRT1_2, 14);
    expect(b.kurtosis).toBeCloseTo(-1.5, 14);
    // N = 3, k = 2: 1 - Bernoulli(2/3) shifted, the same shape as k = 1 with the sign of the skewness changed
    const c = distSummary("hyper", { m: 1, n: 2, k: 2 });
    expect(c.skewness).toBeCloseTo(-Math.SQRT1_2, 14);
    expect(c.kurtosis).toBeCloseTo(-1.5, 14);
    // N = 4: the closed form, as before
    const d = distSummary("hyper", { m: 2, n: 2, k: 2 });
    expect(d.skewness).toBe(0);
    expect(d.kurtosis).toBe(0);
  });
  it("DIST-005: point masses have no skewness or kurtosis", () => {
    for (const [d, p] of [
      ["binom", { size: 10, prob: 0 }],
      ["binom", { size: 10, prob: 1 }],
      ["binom", { size: 0, prob: 0.3 }],
      ["geom", { prob: 1 }],
      ["nbinom", { size: 5, prob: 1 }],
      ["hyper", { m: 3, n: 0, k: 2 }],
      ["hyper", { m: 3, n: 4, k: 0 }],
      ["hyper", { m: 3, n: 4, k: 7 }],
    ] as const) {
      const s = distSummary(d, p);
      expect(s.variance, d).toBe(0);
      expect(s.sd, d).toBe(0);
      expect(s.skewness, `${d} ${JSON.stringify(p)}`).toBeNaN();
      expect(s.kurtosis, `${d} ${JSON.stringify(p)}`).toBeNaN();
    }
  });
  it("DIST-006: arcsine on (-1e308, 1e308)", () => {
    const s = distSummary("arcsine", { a: -1e308, b: 1e308 });
    expect(s.mean).toBe(0);
    expect(s.median).toBe(0);
    expect(s.variance).toBe(Infinity);
    expect(s.sd / (1e308 / Math.SQRT2)).toBeCloseTo(1, 14);
    // the median is the midpoint (it was 0.9999999999999998 on (-1, 3))
    expect(distSummary("arcsine", { a: -1, b: 3 }).median).toBe(1);
  });
  it("the standard deviation where the variance overflows or underflows", () => {
    const cases: [string, (c: number) => Record<string, number>][] = [
      ["norm", (c) => ({ mean: 0, sd: 2 * c })],
      ["unif", (c) => ({ min: -1.5 * c, max: 1.5 * c })],
      ["exp", (c) => ({ rate: 3 / c })],
      ["gamma", (c) => ({ shape: 2.5, scale: 0.5 * c })],
      ["logis", (c) => ({ location: 0, scale: 2 * c })],
      ["laplace", (c) => ({ mu: 0, sigma: 2 * c })],
      ["weibull", (c) => ({ shape: 1.7, scale: 3 * c })],
      ["invgamma", (c) => ({ alpha: 5.5, beta: 2 * c })],
      ["pareto", (c) => ({ a: 5, b: 2 * c })],
      ["triang", (c) => ({ a: -1 * c, b: 3 * c, c: 0.5 * c })],
      ["arcsine", (c) => ({ a: -1 * c, b: 1.5 * c })],
    ];
    for (const [d, f] of cases) {
      const ref = distSummary(d as "norm", f(1)).sd;
      for (const c of [1e200, 1e-200]) expect(distSummary(d as "norm", f(c)).sd / c / ref, `${d} ${c}`).toBeCloseTo(1, 14);
    }
    expect(distSummary("chisq", { df: 1e308 }).sd / Math.sqrt(1e308) / Math.SQRT2).toBeCloseTo(1, 14);
    expect(distSummary("geom", { prob: 1e-200 }).sd / 1e200).toBeCloseTo(1, 14);
  });
});

describe("review 45: wilcox below 1e-612", () => {
  // R 4.5.2: dwilcox(x, 1050, 1050, log = TRUE), and the log of the sums of its exponentials (R's pwilcox(log.p =
  // TRUE) is -Inf there: C(2100, 1050) overflows)
  const R: [number, number, number][] = [
    [0, -1451.5583224637703, -1451.5583224637703],
    [1, -1451.5583224637703, -1450.8651752832104],
    [2, -1450.8651752832104, -1450.1720281026505],
    [5, -1449.6124123147149, -1448.6138834846038],
    [100, -1432.4927960398429, -1430.3385373112117],
    [1000, -1379.3001579567831, -1376.0627855034434],
  ];
  it("DIST-007: the log probabilities of the lower tail of m = n = 1050", () => {
    // they were -Infinity (the table at the fixed scale 2^960 underflowed)
    for (const [x, d, p] of R) {
      expect(dwilcox(x, 1050, 1050, { log: true }) / d - 1, `${x}`).toBeCloseTo(0, 14);
      expect(pwilcox(x, 1050, 1050, { logP: true }) / p - 1, `${x}`).toBeCloseTo(0, 14);
      expect(pwilcox(2100 * 525 - x - 1, 1050, 1050, { lowerTail: false, logP: true }) / p - 1, `${x}`).toBeCloseTo(0, 14);
    }
    // the symmetric upper tail
    expect(dwilcox(1050 * 1050, 1050, 1050, { log: true }) / R[0]![1] - 1).toBeCloseTo(0, 14);
    // a table built further first, then the low values again (they come from the low table)
    expect(pwilcox(3000, 1050, 1050, { logP: true }) / -1317.2390290791723 - 1).toBeCloseTo(0, 14);
    for (const [x, d] of R) expect(dwilcox(x, 1050, 1050, { log: true }) / d - 1, `again ${x}`).toBeCloseTo(0, 14);
    expect(qwilcox(-1450, 1050, 1050, { logP: true })).toBe(3);
  });
  it("the log probabilities of m = n = 600 as R's densities", () => {
    // log(sum(exp(dwilcox(0:1000, 600, 600, log = TRUE)))) in R: -752.51004160777086 (R's pwilcox gives -Inf)
    expect(pwilcox(1000, 600, 600, { logP: true })).toBeCloseTo(-752.51004160777086, 11);
    expect(dwilcox(1000, 600, 600, { log: true })).toBeCloseTo(-755.74741406111389, 11);
  });
});

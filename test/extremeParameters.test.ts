// Calls at extreme parameters that did not return, took seconds or threw a TypeError (0.15.1), found by the property
// tests and the fuzz script (test/helpers/distributionKnown.ts). Each must now return quickly; the expected values come
// from closed forms, limiting distributions or other functions of the library (none from R).

import { describe, expect, it } from "vitest";
import {
  dbeta,
  dgamma,
  dpois,
  lgamma,
  pbeta,
  pchisq,
  pf,
  pgamma,
  pnbinom,
  pnorm,
  ppois,
  ptukey,
  qbeta,
  qchisq,
  qf,
  qgamma,
  qinvgamma,
  qnbinom,
  qnorm,
  qpois,
  qtukey,
} from "../src/index.js";
import { nextUp } from "./helpers/float.js";

/** Time bound per call (ms): every call here takes a few ms, at most about 150 for the first ptukey with a given nmeans */
const LIMIT = 1000;

/** Runs f, checks the time bound and returns its value */
function timed<T>(f: () => T): T {
  const t0 = performance.now();
  const v = f();
  expect(performance.now() - t0).toBeLessThan(LIMIT);
  return v;
}

const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);

describe("ptukey and qtukey at small and huge q", () => {
  // P[Q <= q] → C^r q^m E[s^m] as q → 0, with W(w) ≈ C w^(k-1), C = sqrt(k) (2π)^(-(k-1)/2) (W = k ∫ φ D^(k-1) and
  // D ≈ w φ), m = (k-1) r and E[s^m] = (2/df)^(m/2) Γ((df+m)/2) / Γ(df/2) for s^2 ~ χ²_df / df
  const smallQ = (q: number, k: number, df: number, r: number): number => {
    const m = (k - 1) * r;
    return (
      r * (0.5 * Math.log(k) - ((k - 1) / 2) * Math.log(2 * Math.PI)) +
      m * Math.log(q) +
      (m / 2) * Math.log(2 / df) +
      lgamma((df + m) / 2) -
      lgamma(df / 2)
    );
  };
  it.each([
    [1e-20, 200, 5, 1],
    [1e-12, 200, 5, 20],
    [1e-8, 200, 5, 1],
    [1.0491344840524078e-85, 28, 146.82232749321562, 1],
  ])("ptukey(%d, %d, %d, { nranges: %d }) (did not return, or took 1.2 s)", (q, k, df, r) => {
    const v = timed(() => ptukey(q, k, df, { nranges: r, logP: true }));
    expect(rel(v, smallQ(q, k, df, r))).toBeLessThan(1e-13);
  });

  // P[Q > q] → (a^a / Γ(a+1)) E[R^df] q^-df (a = df/2) as q → ∞: P[s < R/q], with P[s < x] ≈ (a x^2)^a / Γ(a+1).
  // For k = 2 the range is sqrt(2) |Z| and E[R^df] = 2^df Γ((df+1)/2) / sqrt(π)
  it.each([1e30, 1e100, 2.4654327013958976e118])("ptukey(%d, 2, 3, upper) (q above 1e30 did not return)", (q) => {
    const a = 1.5;
    const expected = a * Math.log(a) - lgamma(a + 1) + 3 * Math.LN2 + lgamma(2) - 0.5 * Math.log(Math.PI) - 3 * Math.log(q);
    expect(rel(timed(() => ptukey(q, 2, 3, { lowerTail: false, logP: true })), expected)).toBeLessThan(1e-13);
  });

  it("ptukey(2.4654327013958976e+118, 4, 3, { nranges: 2 }) (did not return)", () => {
    expect(timed(() => ptukey(2.4654327013958976e118, 4, 3, { nranges: 2 }))).toBe(1);
    // The same power law: log P + df log q is constant far out
    const l1 = timed(() => ptukey(2.4654327013958976e118, 4, 3, { nranges: 2, lowerTail: false, logP: true }));
    const l2 = timed(() => ptukey(1e200, 4, 3, { nranges: 2, lowerTail: false, logP: true }));
    expect(rel(l1 + 3 * Math.log(2.4654327013958976e118), l2 + 3 * Math.log(1e200))).toBeLessThan(1e-12);
  });

  it("qtukey for p below 1e-290 (stepped past the doubles and returned a far value)", () => {
    // k = 2: W(w) = 2 Φ(w / sqrt 2) - 1 ≈ w / sqrt(π). (log W is interpolated, so W has a relative error of about
    // ε |log W| = 1.5e-13 here)
    expect(rel(timed(() => qtukey(1e-300, 2, Infinity)), Math.sqrt(Math.PI) * 1e-300)).toBeLessThan(3e-13);
    const q = timed(() => qtukey(1.0559546753949724e-300, 2, 9.456139652464845));
    expect(rel(ptukey(q, 2, 9.456139652464845), 1.0559546753949724e-300)).toBeLessThan(1e-13);
    // Quantiles beyond the doubles end at the last double
    expect(timed(() => qtukey(-1e5, 2, 5, { logP: true }))).toBeLessThan(1e-300);
    expect(timed(() => qtukey(-1e5, 2, 5, { logP: true, lowerTail: false }))).toBeGreaterThan(1e300);
  });

  it("ptukey with huge df (0 and -Infinity: the outer integral lay within one ulp of log(df/2))", () => {
    // k = 2: 1 - W(w) = 2 Φc(w / sqrt 2)
    const q = 0.9538725524089403;
    const expected = 2 * pnorm(q / Math.SQRT2, { lowerTail: false });
    expect(rel(timed(() => ptukey(q, 2, 2.564607493752017e102, { lowerTail: false })), expected)).toBeLessThan(1e-14);
    // log E[exp(-q^2 s^2 / 4)] = -(df/2) log(1 + q^2 / (2 df)) for the leading exp(-w^2/4) of 1 - W; the rest of
    // log(1 - W) is a few dozen, below the rounding of 1.3e22
    const [q2, df] = [228773689574.03683, 4.828886441569433e27];
    const v = timed(() => ptukey(q2, 2, df, { lowerTail: false, logP: true }));
    expect(rel(v, -(df / 2) * Math.log1p((q2 * q2) / (2 * df)))).toBeLessThan(1e-14);
  });
});

describe("qpois and ppois at huge lambda", () => {
  const lambda = 32801123463837233000;
  it("qpois(5.678138243114416e-54, 3.28e19, upper) (did not return)", () => {
    const p = 5.678138243114416e-54;
    const q = timed(() => qpois(p, lambda, { lowerTail: false }));
    // The smallest q (on the grid of doubles, spacing 4096 here) with P[X > q] <= p
    expect(ppois(q, lambda, { lowerTail: false })).toBeLessThanOrEqual(p * (1 + 1e-13));
    expect(ppois(q - 4096, lambda, { lowerTail: false })).toBeGreaterThan(p);
    // Normal approximation with the skewness term: z + (z^2 - 1) / (6 sqrt(lambda)) standard deviations
    const z = qnorm(p, { lowerTail: false });
    expect(rel(q, lambda + Math.sqrt(lambda) * (z + (z * z - 1) / (6 * Math.sqrt(lambda))))).toBeLessThan(1e-15);
  });

  it("ppois 15 standard deviations out at lambda = 3.28e19 (0.15 s per call, short of convergence)", () => {
    const q = lambda + 1e11;
    const v = timed(() => ppois(q, lambda, { lowerTail: false, logP: true }));
    // The skewness changes the log by about z^3 / (6 sqrt(lambda)) = 1.5e-7 (q - lambda is exact; 1e11 itself is not
    // on the grid of doubles at 3e19, spacing 4096)
    expect(rel(v, pnorm((q - lambda) / Math.sqrt(lambda), { lowerTail: false, logP: true }))).toBeLessThan(1e-8);
  });

  it("Temme's expansion beyond 4.5 standard deviations agrees with the series and continued fraction", () => {
    // Where |x - a| / a crosses 1e-3 (a = 1e10: 100 standard deviations, log Q about -5000)
    const a = 1e10;
    for (const x of [a * (1 + 1e-3), a * (1 - 1e-3)]) {
      for (const lowerTail of [true, false]) {
        const v1 = pgamma(x, a, { lowerTail, logP: true });
        const v2 = pgamma(nextUp(x), a, { lowerTail, logP: true });
        // (the slope of log Q is about |x - a| / a = 1e-3 per unit of x)
        expect(Math.abs(v1 - v2)).toBeLessThan(1e-13 * Math.abs(v1) + 1.1e-3 * Math.abs(nextUp(x) - x));
      }
    }
  });

  it.each([
    [3.400935567303781e240, 5.54101330048476e241],
    [3.659041530914545e124, 8.102633530834808e125],
  ])("ppois(%d, %d) (NaN: the continued fraction overflowed)", (q, lam) => {
    expect(timed(() => ppois(q, lam))).toBe(0);
    // Far below the mean the terms fall geometrically with ratio q / lambda
    const expected = dpois(q, lam, { log: true }) - Math.log1p(-q / lam);
    expect(rel(timed(() => ppois(q, lam, { logP: true })), expected)).toBeLessThan(1e-14);
  });
});

describe("qnbinom and pnbinom at extreme size and prob", () => {
  it("qnbinom(2.7e-299, 6.0e178, { mu: 0.349 }) (did not return; pnbinom NaN) is the Poisson limit", () => {
    const mu = 0.34891747044274307;
    expect(timed(() => qnbinom(2.7310066097710254e-299, 6.0104102662856364e178, { mu }))).toBe(0);
    expect(timed(() => qnbinom(2.7310066097710254e-299, 6.0104102662856364e178, { mu, lowerTail: false }))).toBe(
      qpois(2.7310066097710254e-299, mu, { lowerTail: false }),
    );
    expect(rel(timed(() => pnbinom(206, 6.0104102662856364e178, { mu, logP: true, lowerTail: false })), ppois(206, mu, { logP: true, lowerTail: false }))).toBeLessThan(1e-13);
  });

  // For prob → 0, X (-log q) tends to Gamma(size): P[X > y] ≈ Q(size, y (-log q)), with relative error about prob
  it("qnbinom(1.6e-293, 2.8e-255, { mu: 53.6, upper }) (did not return; the quantile is 1.6e258)", () => {
    const [size, mu, p] = [2.7623800274362807e-255, 53.58082374975206, 1.5691356852884617e-293];
    const y = timed(() => qnbinom(p, size, { mu, lowerTail: false }));
    const v = timed(() => pnbinom(y, size, { mu, lowerTail: false, logP: true }));
    expect(rel(v, Math.log(p))).toBeLessThan(1e-14);
    expect(rel(v, pgamma(y * Math.log1p(size / mu), size, { lowerTail: false, logP: true }))).toBeLessThan(1e-13);
  });

  it.each([
    [5.5023375509081695e-255, 0.14024077000655166, 1.1716094551402839e-203],
    [Math.exp(-449.0189316005691), 44.366525002788876, 1.5519253959061461e-149],
    [9.17147178026164e-247, 0.02874348090763298, 1.7515318962765905e-213],
  ])("qnbinom(%d, %d, { prob: %d, upper }) (did not return)", (p, size, prob) => {
    const y = timed(() => qnbinom(p, size, { prob, lowerTail: false }));
    expect(rel(y, qgamma(p, size, { lowerTail: false }) / -Math.log1p(-prob))).toBeLessThan(1e-12);
  });

  it("pnbinom where 1 - prob rounds to 1 (NaN, -Infinity): the gamma limit", () => {
    const prob = 1.5519253959061461e-149;
    for (const u of [100, 300, 600, 1000]) {
      const v = timed(() => pnbinom(u / prob, 44.366525002788876, { prob, lowerTail: false, logP: true }));
      expect(rel(v, pgamma(u, 44.366525002788876, { lowerTail: false, logP: true }))).toBeLessThan(1e-13);
    }
    const prob2 = 1.1716094551402839e-203;
    const v = timed(() => pnbinom(580 / prob2, 0.14024077000655166, { prob: prob2, lowerTail: false, logP: true }));
    expect(rel(v, pgamma(580, 0.14024077000655166, { lowerTail: false, logP: true }))).toBeLessThan(1e-13);
    // (was -Infinity: u = 3.5e48)
    const [y, size, prob3] = [6.662294020361651e91, 3.3479193877814253, 5.311648844360781e-44];
    expect(timed(() => pnbinom(y, size, { prob: prob3 }))).toBe(1);
    const w = timed(() => pnbinom(y, size, { prob: prob3, lowerTail: false, logP: true }));
    expect(rel(w, pgamma(y * prob3, size, { lowerTail: false, logP: true }))).toBeLessThan(1e-13);
  });

  it.each([
    [-154.9753937513052, 1.9857850442471244e202, 0.9999994374946951],
    [-585.7216786418998, 4.852436415115509e259, 0.1564875333569944],
    [Math.log(3.4647501018063774e-258), 1.7577020671882853e124, 1.5373563253056731e-90],
  ])("qnbinom(%d, %d, { prob: %d, logP: true }) (TypeError) is the mean to double precision", (lp, size, prob) => {
    // The standard deviation over the mean, sqrt(1 / (size (1 - prob))), is below 1e-30
    expect(rel(timed(() => qnbinom(lp, size, { prob, logP: true })), (size * (1 - prob)) / prob)).toBeLessThan(1e-13);
  });

  it("qnbinom beyond the doubles is Infinity (TypeError)", () => {
    // mean 1.4e316
    expect(timed(() => qnbinom(2.16161210234558e-284, 2.679920847985288e37, { prob: 1.8529983206235488e-279 }))).toBe(Infinity);
  });
});

describe("qgamma, qchisq, qinvgamma, pgamma and dgamma at huge shape", () => {
  it("qgamma(-52.45, 1.19e17, { scale: 7.14, logP: true }) (did not return)", () => {
    const x = timed(() => qgamma(-52.45, 119226008529095940, { scale: 7.14, logP: true }));
    // log P changes by about 4e-7 per ulp of x here
    expect(Math.abs(pgamma(x, 119226008529095940, { scale: 7.14, logP: true }) + 52.45)).toBeLessThan(1e-5);
  });

  it("qchisq(-52.93, 2.43e18, { logP: true }) (did not return)", () => {
    const x = timed(() => qchisq(-52.93, 2428784754292026400, { logP: true }));
    expect(Math.abs(pchisq(x, 2428784754292026400, { logP: true }) + 52.93)).toBeLessThan(1e-5);
  });

  it("qchisq where the distribution function rises within an ulp (off by 5e-14)", () => {
    // The standard deviation is 1.8e-117 of the mean: the quantile is df to double precision
    const df = 6.347482804185997e234;
    expect(timed(() => qchisq(1.5321159345749122e-233, df))).toBe(df);
    expect(timed(() => qchisq(-63.422227632148974, df, { lowerTail: false, logP: true }))).toBe(df);
    expect(timed(() => qchisq(0.3, 1e160))).toBe(1e160);
  });

  it("qinvgamma(8.6e-10, 6.9e19, { beta: 3.6e-198, upper }) (did not return) is beta / qgamma", () => {
    const [p, alpha, beta] = [8.561849062297012e-10, 68795589720441740000, 3.5954869304357335e-198];
    expect(rel(timed(() => qinvgamma(p, alpha, { beta, lowerTail: false })), beta / qgamma(p, alpha))).toBeLessThan(1e-15);
  });

  it("pgamma far above the mean (NaN: the continued fraction overflowed)", () => {
    expect(timed(() => pgamma(4.083839400055824e172, 5.309225446733691e163, { rate: 0.0012716221973754155 }))).toBe(1);
    // Q(a, x) = x^a e^-x / Γ(a) / (x + 1 - a) (1 + O(a / x^2)) = x f(x) / (x + 1 - a)
    const [q, a, rate] = [7.966921701551204e58, 6.068554347228312e55, 90.7566361902348];
    const x = q * rate;
    const expected = dgamma(x, a, { log: true }) + Math.log(x) - Math.log(x + 1 - a);
    expect(rel(timed(() => pgamma(q, a, { rate, lowerTail: false, logP: true })), expected)).toBeLessThan(1e-14);
  });

  it.each([
    [9.278118145807404e281, 1.8654074662461455e183, 3.046991861217035e21],
    [9.784517804483671e262, 1.8242600559534272e212, 9.95069654231012e43],
  ])("dgamma(%d, %d, { rate: %d }) (TypeError)", (x, a, rate) => {
    const y = x * rate;
    const expected = (a - 1) * Math.log(y) - y - lgamma(a) + Math.log(rate);
    expect(rel(timed(() => dgamma(x, a, { rate, log: true })), expected)).toBeLessThan(1e-14);
  });
});

describe("qbeta, dbeta, pbeta, qf and pf at extreme shapes", () => {
  it("qbeta(8.8e-96, 5.38, 9.0e283) (4 s and 0.75) is qgamma(p, a) / b", () => {
    const [p, a, b] = [8.778764095654974e-96, 5.376836280643888, 9.006258581539712e283];
    expect(rel(timed(() => qbeta(p, a, b)), qgamma(p, a) / b)).toBeLessThan(1e-13);
    // I_x(b, a) ≈ x^b (1 - x)^(a - 1) / (b B(a, b)) for huge b: the log is b log x to double precision
    expect(rel(timed(() => pbeta(0.5, a, b, { lowerTail: false, logP: true })), b * Math.log(0.5))).toBeLessThan(1e-14);
  });

  it("qbeta with both shapes huge (0.0055: the search kept the first point with the smallest residual)", () => {
    // The standard deviation is 1e-97 of the mean a / (a + b)
    const [a, b] = [1.0352246639693515e190, 6.2918828463792074e193];
    expect(rel(timed(() => qbeta(3.0287176526349986e-15, a, b)), a / (a + b))).toBeLessThan(1e-15);
  });

  it("parameters around 1e300 (NaN and Infinity: the double-double products overflowed)", () => {
    // Beta(a, a) at a = 6e299: P[X <= 1/2] = 1/2 and the density at the mode sqrt(4a / π) (relative error 1/(8a))
    expect(timed(() => pbeta(0.5, 6e299, 6e299))).toBe(0.5);
    expect(rel(timed(() => dbeta(0.5, 6e299, 6e299, { log: true })), 0.5 * Math.log((4 * 6e299) / Math.PI))).toBeLessThan(1e-15);
    // log P(a, x) = -bd0(a, x) + O(log a): bd0 is homogeneous, so the log at a = 2^1000 is 2^400 times that at
    // a = 2^600 (the O(log a) terms, about 350, are below the rounding)
    for (const r of [0.8, 0.9, 0.99]) {
      const [a, b] = [2 ** 1000, 2 ** 600];
      expect(rel(timed(() => pgamma(r * a, a, { logP: true })), 2 ** 400 * pgamma(r * b, b, { logP: true }))).toBeLessThan(1e-15);
    }
    expect(timed(() => qgamma(0.3, 1e300))).toBe(1e300);
  });

  it("qbeta(9.3e-85, 4.0e204, 1) (TypeError): x = p^(1/a)", () => {
    const [p, a] = [9.334322569622605e-85, 3.999342658055056e204];
    expect(timed(() => qbeta(p, a, 1))).toBe(1);
    expect(rel(timed(() => qbeta(p, 1, a, { lowerTail: false })), -Math.expm1(Math.log(p) / a))).toBeLessThan(1e-14);
  });

  it("dbeta with tiny shapes (TypeError): f(x) ≈ a b / ((a + b) x)", () => {
    const [x, a, b] = [2.739884385782668e-289, 7.460679824918593e-126, 7.634632923335423e-180];
    expect(rel(timed(() => dbeta(x, a, b)), (b / x) * (a / (a + b)))).toBeLessThan(1e-14);
    // and a quantile search that reaches x = 0
    expect(timed(() => pbeta(5.834346481216897e-295, 2.817316153918943e-193, 3.461040177197939e-153))).toBeGreaterThan(0.99);
  });

  // df1 → ∞: F → df2 / χ²_df2
  it("qf(2.1e-207, 6.6e76, 3) (did not return)", () => {
    const p = 2.0518364426170894e-207;
    expect(rel(timed(() => qf(p, 6.591717355238955e76, 3)), 3 / qchisq(p, 3, { lowerTail: false }))).toBeLessThan(1e-13);
  });

  it.each([
    [2.496810009129591e-97, 1.6914000120615383e80, 2.67741530170955e-95],
    [0.99999999999999, 1.9650315763119397e288, 0.5370666120548222],
  ])("pf(%d, %d, %d) (did not return)", (x, m, n) => {
    expect(rel(timed(() => pf(x, m, n)), pchisq(n / x, n, { lowerTail: false }))).toBeLessThan(1e-13);
  });

  it("qf and pf with tiny df (TypeError)", () => {
    // df1 → 0: F → (χ²_df1 / df1) / 1 concentrates at 0, with P[F > x] ≈ Q(df1/2, df1 x/2) ≈ (df1/2) E1(df1 x / 2)
    expect(Number.isFinite(timed(() => qf(2.2628322624838734e-116, 3.3775767932829647e-279, 1, { lowerTail: false })))).toBe(true);
    const v = timed(() => pf(1.7976931348623151e308, 1.511996148841185e-70, 3.444131209067992e-51, { lowerTail: false }));
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });
});

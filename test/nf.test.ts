import { describe, expect, it } from "vitest";
import { df, pf, qchisq, qf, qnorm } from "../src/index.js";
import { bool, num, relativeError } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

// Noncentral F distribution (when ncp is given)
const opts = (a: Record<string, string | boolean>) => ({
  ncp: num(a.ncp),
  lowerTail: bool(a.lowerTail),
  logP: bool(a.logP),
});

fixtureSuite({
  name: "dnf",
  tolerance: 1e-14,
  density: true,
  // R's df(0, df1, Inf, ncp, log = TRUE) does not match the log of the log = FALSE value (ours does)
  knownDifference: (a, _e, x) => {
    if (!(a.log === true && num(a.x) === 0 && num(a.df2) === Infinity)) return undefined;
    const lin = df(0, num(a.df1), Infinity, { ncp: num(a.ncp) });
    return Math.abs(x - Math.log(lin)) <= 1e-15 * Math.max(1, Math.abs(x)) ? "R's log density at x = 0 with df2 = Inf" : undefined;
  },
  call: (a) => df(num(a.x), num(a.df1), num(a.df2), { ncp: num(a.ncp), log: bool(a.log) }),
});
fixtureSuite({
  name: "pnf",
  tolerance: 1e-14,
  call: (a) => pf(num(a.q), num(a.df1), num(a.df2), opts(a)),
});
// A huge noncentrality far from q: the far tail is below the double range (0), the near tail 1
fixtureSuite({
  name: "pnfHuge",
  tolerance: 1e-14,
  call: (a) => pf(num(a.q), num(a.df1), num(a.df2), opts(a)),
});
// Rows with df2 = Inf are excluded from the suite's boundary checks (which cover only rows with all-finite parameters), so check them here
const infDf2 = (a: Record<string, string | boolean>, e: number, x: number): string | undefined => {
  if (num(a.df2) !== Infinity || !a.logP || !a.lowerTail) return undefined;
  const p = num(a.p);
  // We return 0: if the CDF at the smallest positive number already exceeds p, the answer is too small to represent
  if (x === 0 && e > 0 && pf(Number.MIN_VALUE, num(a.df1), Infinity, opts(a)) >= p) return "df2 = Inf: the answer rounds to 0";
  // R returns Inf: we pass if the CDF at our answer gives back p (R rounds log p = -1e-300 to 1)
  if (e === Infinity && Number.isFinite(x) && Math.abs(pf(x, num(a.df1), Infinity, opts(a)) - p) <= 1e-12 * Math.abs(p))
    return "df2 = Inf: R returns Inf (answer checked via the CDF)";
  return undefined;
};

fixtureSuite({
  name: "qnf",
  tolerance: 1e-14,
  knownDifference: infDf2,
  call: (a) => qf(num(a.p), num(a.df1), num(a.df2), opts(a)),
  backward: (a, x) => pf(x, num(a.df1), num(a.df2), opts(a)),
});

describe("noncentral F at extreme parameters (regressions; these did not return)", () => {
  it("a huge df2: F is χ²(df1, λ)/df1", () => {
    const [p, m, n, ncp] = [9.423429403249297e-250, 1.8411616538629063, 3.908407098865747e188, 198.72404032716406];
    const ref = (qchisq(p, m, { ncp, lowerTail: false }) as number) / m;
    expect(relativeError(qf(p, m, n, { ncp, lowerTail: false }) as number, ref)).toBeLessThanOrEqual(1e-14);
  });

  it("a huge ncp: F is (λ/m) / (W/n), W ~ χ²(n)", () => {
    const [p, m, n, ncp] = [0.07404623872624663, 2, 0.38811687804355227, 6.39113448329404e269];
    const ref = ncp / m / ((qchisq(p, n) as number) / n);
    expect(relativeError(qf(p, m, n, { ncp, lowerTail: false }) as number, ref)).toBeLessThanOrEqual(1e-14);
  });

  it("a huge ncp and df2: the quantile of W/n moves F by its relative spread sqrt(2/n)", () => {
    const [p, m, n, ncp] = [7.48573219148339e-47, 3.2077830404612326e-234, 3.226003964094021e24, 3.664217781203523e36];
    // F = (Y/m)/(W/n) with Y nearly constant (relative spread 1e-18), W/n = 1 + sqrt(2/n) Z: the lower tail at W/n large
    const ref = ncp / m / (1 + Math.sqrt(2 / n) * (qnorm(p, { lowerTail: false }) as number));
    expect(relativeError(qf(p, m, n, { ncp }) as number, ref)).toBeLessThanOrEqual(1e-12);
  });
});

describe("noncentral F: regressions", () => {
  it("builds the larger tail as 1 - (smaller)", () => {
    const [q, m, n, ncp] = [2.473952189555483, 456.14174201689434, 771.5785513038477, 26.634566720706474];
    expect(pf(q, m, n, { ncp })).toBe(1 - (pf(q, m, n, { ncp, lowerTail: false }) as number));
  });

  it("gives the log of the upper tail at a q so small that x = m q/(n + m q) underflows", () => {
    // -0.0020873 before, against log1p(-lower) = -0.0020895
    const [q, m, n, ncp] = [7.327311511990816e-248, 1.1415699806958447e-218, 1, 12.343768528437282];
    const lower = pf(q, m, n, { ncp }) as number;
    expect(relativeError(pf(q, m, n, { ncp, lowerTail: false, logP: true }) as number, Math.log1p(-lower))).toBeLessThanOrEqual(1e-15);
  });

  it("forms x and k = (1 - x)/x where m q under- or overflows (NaN, -Infinity or 0 before)", () => {
    // m q underflows: with tiny df the mixture is e^(-λ/2) I_x(a, b), and I_x is 1 - 1e-43 or nearer
    for (const [q, m, n, ncp] of [
      [1.0208476654552434e-139, 7.766860695993578e-256, 8.555432859657381e-213, 0.6455815085231222],
      [2.761824159900403e-276, 6.517710508267247e-228, 2.7747659233827936e-203, 78.26653201573882],
    ] as const) {
      // (the Poisson weight e^(-λ/2), reached by the recurrence from j = 110 for λ = 78, carries 2e-14)
      expect(relativeError(pf(q, m, n, { ncp }) as number, Math.exp(-ncp / 2))).toBeLessThanOrEqual(1e-13);
      expect(df(q, m, n, { ncp })).toBeGreaterThan(0);
    }
    // m q beyond 1e308 (df1 huge, df2 = 2): P[F > q] = P(1, t) = 1 - e^-t with t = n (m + λ)/(2 m q), f(q) = t e^-t / q
    const [q, m, n, ncp] = [5.593801445714649e262, 1.4473324108589433e61, 2, 20.019724110171456];
    const lt = Math.log1p(ncp / m) - Math.log(q);
    expect(relativeError(pf(q, m, n, { ncp, lowerTail: false, logP: true }) as number, lt)).toBeLessThanOrEqual(1e-14);
    expect(relativeError(df(q, m, n, { ncp, log: true }) as number, lt - Math.log(q))).toBeLessThanOrEqual(1e-14);
    // q near the largest double: the upper tail falls as q^(-n/2) (0 before, from an overflow in the Chernoff bound)
    const [m2, n2, ncp2] = [0.5041150078765421, 1, 26.92685977354875];
    const p1 = pf(1.7e308, m2, n2, { ncp: ncp2, lowerTail: false }) as number;
    const p2 = pf(1.7976931348623151e308, m2, n2, { ncp: ncp2, lowerTail: false }) as number;
    expect(relativeError(p2 / p1, Math.sqrt(1.7e308 / 1.7976931348623151e308))).toBeLessThanOrEqual(1e-12);
  });

  it("gives the tails at a huge λ (the cumulant expansion and its log, the far left tail)", () => {
    // Y = χ²(m, λ) is constant to 1e-46: P[F <= q] = Q(n/2, n (m + λ)/(2 m q)) (mpmath); 2e-10 off before (1 - P with
    // P = 1 - 7.5e-8 at a tiny shape n/2)
    const [m, n, ncp] = [190.54026821574223, 3.3021588283347283e-9, 3.2516428961371296e92];
    expect(relativeError(pf(3.56e101, m, n, { ncp }) as number, 7.546811366819246e-8)).toBeLessThanOrEqual(1e-14);
    // the quantile where the iteration stalled 2e-8 away in log p
    const p = 6.389335467489892e-41;
    expect(relativeError(pf(qf(p, m, n, { ncp }) as number, m, n, { ncp }) as number, p)).toBeLessThanOrEqual(1e-12);
    // far in the tail of Q(b, t) (log Q about -t): log P is log Q(b, t0), t0 = (m/2 + λ/2) n/(m q) (it was taken from an
    // integral that gave -4.99e253 here)
    const [q2, m2, n2, ncp2] = [1.5482840755724838e155, 1297.9256468956266, 204.30365281952962, 7.500667311607752e266];
    const t0 = ((m2 / 2 + ncp2 / 2) * n2) / (m2 * q2);
    expect(relativeError(pf(q2, m2, n2, { ncp: ncp2, logP: true }) as number, -t0)).toBeLessThanOrEqual(1e-14);
    // the far left tail: e^(-λ/2) I_x(a, b) (NaN before)
    const [q3, m3, n3, ncp3] = [5.0095645311474e-298, 1.714176297130292, 7947.23964881496, 1.9945750744323082e27];
    expect(relativeError(pf(q3, m3, n3, { ncp: ncp3, logP: true }) as number, -ncp3 / 2)).toBeLessThanOrEqual(1e-15);
  });
});

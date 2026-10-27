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

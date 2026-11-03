// Issue #135: the noncentral F formed log(m/n), and decided on its tiny-q series from (m/n) q, with m/n = 0 where the
// ratio of finite degrees of freedom underflows (review_fix_log_issue135.md). pf and df then gave -Inf. References:
// with df2 = 1e200 the F is χ²(df1, ncp)/df1 to far below double precision, so R's
// dchisq(df1 q, df1, ncp = 1, log = TRUE) + log(df1) and pchisq(df1 q, df1, ncp = 1, log.p = TRUE).
import { describe, expect, it } from "vitest";
import { df, pf } from "../src/index.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #135", () => {
  const m = 1e-200;
  const n = 1e200;

  it("forms log(m/n) from the logs where m/n underflows", () => {
    // m q/n = 1e-300: not the tiny-q series (the j = 1 term of the density dominates)
    expect(rel(pf(1e100, m, n, { ncp: 1, logP: true }), -0.49999999999999964)).toBeLessThan(1e-14);
    expect(rel(pf(1e100, m, n, { ncp: 1, logP: true, lowerTail: false }), -0.93275212956718914)).toBeLessThan(1e-14);
    expect(rel(df(1e100, m, n, { ncp: 1, log: true }), -462.40331295992905)).toBeLessThan(1e-14);
    // m q/n = 1e-400: the tiny-q series with log m - log n
    expect(rel(pf(1e-100, m, n, { ncp: 1, logP: true }), -0.49999999999999964)).toBeLessThan(1e-14);
    expect(rel(df(1e-100, m, n, { ncp: 1, log: true }), -231.45165647996456)).toBeLessThan(1e-14);
    // m q/n = 1e-100: P is 1 to double precision; the upper tail is about -m q/2
    // (-0 since #202, from the noncentral chi-squared limit taken for such a df2, as for df2 = Inf)
    expect(Math.abs(pf(1e300, m, n, { ncp: 1, logP: true }) as number)).toBe(0);
    expect(rel(pf(1e300, m, n, { ncp: 1, logP: true, lowerTail: false }), -5e99)).toBeLessThan(1e-10);
    expect(rel(df(1e300, m, n, { ncp: 1, log: true }), -5e99)).toBeLessThan(1e-10);
    // ncp = 0 takes the same series (R's central pf: -1.151872204075315e-198)
    expect(rel(pf(1e100, m, n, { ncp: 0, logP: true }), pf(1e100, m, n, { logP: true }) as number)).toBeLessThan(1e-14);
  });

  it("keeps the values where m/n does not underflow to 0 as before", () => {
    expect(pf(1e-10, 1e-300, 1e10, { ncp: 1, logP: true })).toBe(-0.5);
    expect(df(1e-10, 1e-300, 1e10, { ncp: 1, log: true })).toBe(-668.9428241488332);
    expect(pf(1e100, 1e-300, 1e10, { ncp: 1, logP: true })).toBe(-0.500000000000006);
  });
});

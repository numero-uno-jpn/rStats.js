// Issue #202: pwrF2Test where u + v overflows, both degrees of freedom are huge, and the noncentral F with a huge df2
// (review_fix_log_issue202.md).
import { describe, expect, it } from "vitest";
import { pf, pwrF2Test } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #202", () => {
  it("forms the noncentrality from the halves and takes the normal approximation of F for huge degrees of freedom", () => {
    // ncp = 1e-308 (2e308 + 1) = 2, df1 = df2 = 1e308: the power is 0.05 + 1e-155 (was the limit 1; R: NaN)
    expect(rel(pwrF2Test({ u: 1e308, v: 1e308, f2: 1e-308 }).power, 0.05)).toBeLessThan(1e-14);
    // ncp = 2 sqrt(df1), df1 = df2 -> Inf: the power tends to pnorm(qnorm(0.95) - 1, upper) (R: 0x1.09bd41f038d84p-2);
    // was 0 for 1e32 and above, 0.302 for 1e28 (R: NaN or 1)
    for (const d of [1e24, 1e28, 1e100, 1e200]) {
      const p = pwrF2Test({ u: d, v: d, f2: (2 * Math.sqrt(d)) / (2 * d + 1) }).power;
      expect(rel(p, 0.25951102284144434)).toBeLessThan(1e-10);
    }
    expect(rel(pwrF2Test({ u: 1e100, v: 1e100, f2: 2e-50 / 2 }).power, 0.25951102284144434)).toBeLessThan(1e-14);
  });

  it("takes the noncentral chi-squared limit of pf for a huge df2", () => {
    // R's pwr.f2.test(u = 2, v = 1e308, f2 = 1e-308) 0x1.0fca4497d7c32p-3 (R's pnf uses the limit for df2 > 1e8); was
    // -0.817 from the series in x
    const p = pwrF2Test({ u: 2, v: 1e308, f2: 1e-308 }).power;
    expect(rel(p, 0.13271001423251644)).toBeLessThan(1e-14);
    // R's pf(3, 2, 1e308, ncp = 1, lower.tail = FALSE) = pchisq(6, 2, ncp = 1, lower.tail = FALSE)
    // 0x1.0ef4101415903p-3, and the lower tail 0x1.bc42fbfafa9c1p-1 (were -0.820 and 1.820)
    expect(rel(pf(3, 2, 1e308, { ncp: 1, lowerTail: false }) as number, 0.13230145036022387)).toBeLessThan(1e-14);
    expect(rel(pf(3, 2, 1e308, { ncp: 1 }) as number, 0.8676985496397763)).toBeLessThan(1e-14);
    // ncp = 0 given: pchisq(6, 2, upper) = e^-3 (was -2.0)
    expect(rel(pf(3, 2, 1e308, { ncp: 0, lowerTail: false }) as number, Math.exp(-3))).toBeLessThan(1e-14);
  });

  it("leaves the other cases as before", () => {
    expect(pwrF2Test({ u: 3, v: 60, f2: 0.15 }).power).toBe(0.7109605416866716);
    expect(pwrF2Test({ u: 3, f2: 0.15, power: 0.8 }).v).toBe(72.70582657950871);
    expect(pwrF2Test({ u: 1e30, v: 10, f2: 1e-30 }).power).toBe(0.050000000000000024);
    expect(pwrF2Test({ u: Infinity, v: 10, f2: 0.1 }).power).toBe(1);
    expect(pwrF2Test({ u: 3, v: 10, f2: 1e308 }).power).toBe(1);
    expect(pf(3, 2, 1e200, { ncp: 1, lowerTail: false })).toBe(0.13230145036022428);
    expect(pf(3, 2, 1e40, { ncp: 1, lowerTail: false })).toBe(0.13230145036022428);
    expect(pf(3, 2, 1e308, { lowerTail: false })).toBe(0.049787068367863944);
  });
});

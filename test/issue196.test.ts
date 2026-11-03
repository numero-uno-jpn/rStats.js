// Issue #196: predict(lm) standard errors where R^-T x overflows or underflows before sigma is applied
// (review_fix_log_issue196.md).
import { describe, expect, it } from "vitest";
import { lm, predict } from "../src/index.js";

describe("issue #196: predict(lm) se with the transformed predictor out of range", () => {
  it("gives the finite se where z overflows before the small sigma (was Infinity; R NaN)", () => {
    const fit = lm([1e-200, 2e-200, 3e-200], [1e-200, 2e-200, 4e-200], { intercept: false });
    expect(fit.sigma).toBe(4.225771273642581e-201);
    const p = predict(fit, [1e200, 1], { interval: "prediction" });
    // Rmpfr: sigma x0 / ||x|| = 1.1293848786315640130e199 for these doubles
    expect(Math.abs(p.seFit[0]! / 1.129384878631564013e199 - 1)).toBeLessThan(1e-15);
    expect(p.seFit[0]).toBe(1.1293848786315636e199);
    expect(p.seFit[1]).toBe(0.11293848786315636);
    expect(Number.isFinite(p.lwr![0]!) && Number.isFinite(p.upr![0]!)).toBe(true);
    expect(p.lwr![0]).toBeLessThan(p.fit[0]!);
    expect(p.upr![0]).toBeGreaterThan(p.fit[0]!);
  });

  it("gives the se where z underflows before the large sigma (was 0; R 0)", () => {
    const fit = lm([1e200, 2e200, 3e200], [1e100, 2e100, 4e100], { intercept: false });
    const se = predict(fit, [1e-200, 1]).seFit;
    expect(se[1]).toBe(1.129384878631563e-101);
    expect(se[0]).toBe(1.129384878631563e-301);
  });

  it("keeps zero, NaN and infinite rows as before", () => {
    const fit = lm([1e-200, 2e-200, 3e-200], [1e-200, 2e-200, 4e-200], { intercept: false });
    const se = predict(fit, [0, NaN, Infinity]).seFit;
    expect(se[0]).toBe(0);
    expect(se[1]).toBeNaN();
    expect(se[2]).toBe(Infinity);
  });
});

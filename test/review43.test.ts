// Fixes of the 43rd round (review_fix_log_20261031_43.md): coxph with covariates in very different units (No.33 of
// the first review). The variance, the standard errors, z, the Wald test and the check for infinite coefficients are
// computed in units of 2^e_j of each covariate.
import { describe, expect, it } from "vitest";
import { coxph } from "../src/index.js";

const time = [5, 3, 8, 1, 9, 4, 7, 2, 6, 10];
const status = [1, 1, 0, 1, 0, 1, 1, 1, 0, 1];
const x1 = [1.2, 0.3, -0.5, 2, 0.7, 0.1, -1.1, 1.5, 0.4, -0.2];
const x2 = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
const fit = (scale: number) => coxph(time, status, x1.map((v, i) => [v * scale, x2[i]!]));

describe("review 43", () => {
  it("coxph at scale 1 as R", () => {
    // R 4.5.2, survival: coxph(Surv(tm, st) ~ x1 + x2)
    const f = fit(1);
    expect(f.coefficients[0]).toBeCloseTo(1.070302313, 9);
    expect(f.se[0]).toBeCloseTo(0.6097669353, 9);
    expect(f.z[0]).toBeCloseTo(1.755264595, 9);
    expect(f.p[0]).toBeCloseTo(0.0792141, 6);
    expect(f.waldtest.statistic).toBeCloseTo(3.358342609, 9);
    expect(f.logtest.statistic).toBeCloseTo(3.701608784, 9);
  });
  it("the same tests whatever the units of a covariate", () => {
    // R: Wald 0.31 (x1 dropped) at 1e7 to 1e100, 3.08 (x2 dropped) at 1e-6 to 1e-150; se 6.0994e-161 at 1e160; se 0,
    // z Inf, p 0 at 1e200; an error at 1e-160. Here the same Wald as R before, se Inf, z 0, p 1 and a warning of an
    // infinite coefficient at 1e-160
    const ref = fit(1);
    for (const scale of [1e7, 1e8, 1e100, 1e160, 1e200, 1e300, 1e-6, 1e-100, 1e-160, 1e-200, 1e-300]) {
      const f = fit(scale);
      expect(f.waldtest.statistic, `${scale}`).toBeCloseTo(ref.waldtest.statistic, 9);
      expect(f.logtest.statistic, `${scale}`).toBeCloseTo(ref.logtest.statistic, 9);
      expect(f.z[0], `${scale}`).toBeCloseTo(ref.z[0]!, 9);
      expect(f.z[1], `${scale}`).toBeCloseTo(ref.z[1]!, 9);
      expect(f.p[0], `${scale}`).toBeCloseTo(ref.p[0]!, 9);
      expect((f.se[0]! * scale) / ref.se[0]! - 1, `${scale}`).toBeCloseTo(0, 9);
      expect((f.coefficients[0]! * scale) / ref.coefficients[0]! - 1, `${scale}`).toBeCloseTo(0, 9);
      expect(f.var[0]![1]! / ref.var[0]![1]! / (1 / scale) - 1, `${scale}`).toBeCloseTo(0, 9);
      expect(f.warnings, `${scale}`).toEqual([]);
    }
  });
});

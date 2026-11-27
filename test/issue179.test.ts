// Issue #179: glmConfint at a very small confidence level (cutoff below 2^-9, level below about 1.6e-3): the cutoff from
// the series of sqrt(2) erfinv(level) and the limits from the inverse profile interpolated through z = 0, +-2^-9,
// +-2^-8 (review_fix_log_issue179.md). Expected: Rmpfr (300 bits) from the closed forms of the profiles; R 4.5.2 gives
// [0, 0] at 1e-20 and is 1.6e-4 off at 1e-10.
import { describe, expect, it } from "vitest";
import { glm } from "../src/index.js";
import { glmConfint } from "../src/models/glmConfint.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);
// Within k units in the last place: Node's Math functions differ from Linux's in the last bit on macOS (its libm;
// experiments/tsmeta120-log.md 106), so exact equality only held on Linux.
const ulps = (a: number, b: number): number => { const d = new DataView(new ArrayBuffer(16)); d.setFloat64(0, a); d.setFloat64(8, b); return Math.abs(Number(d.getBigInt64(0) - d.getBigInt64(8))); };
// intercept-only binomial (estimate 0, se 1): the limits are +-2 acosh(exp(c^2 / 8))
const bin = glm([[], [], [], []], [0, 1, 0, 1], { family: "binomial" });
// intercept-only poisson (estimate log 2.5): the limits solve 20 (e^t - 1 - t) = c^2
const poi = glm([[], [], [], []], [1, 2, 3, 4], { family: "poisson" });

describe("issue #179", () => {
  it("gives the limits at level 1e-20 (was [0, 0], as R)", () => {
    const r = glmConfint(bin, { level: 1e-20 });
    expect(rel(r.upper[0]!, 1.2533141373155002e-20)).toBeLessThan(1e-10);
    expect(rel(r.lower[0]!, -1.2533141373155002e-20)).toBeLessThan(1e-10);
    // the score statistic's profile agrees with the likelihood ratio's to order b^2
    const s = glmConfint(bin, { level: 1e-20, test: "Rao" });
    expect(rel(s.upper[0]!, 1.2533141373155002e-20)).toBeLessThan(2e-10);
    expect(rel(s.lower[0]!, -1.2533141373155002e-20)).toBeLessThan(2e-10);
    // log 2.5 to the last bit
    const p = glmConfint(poi, { level: 1e-20 });
    expect(p.lower[0]).toBe(Math.log(2.5));
    expect(p.upper[0]).toBe(Math.log(2.5));
  });

  it("gives the limits at level 1e-10 (were [-7.2e-10, 1.5e-8]; R +-1.2535e-10)", () => {
    const r = glmConfint(bin, { level: 1e-10 });
    expect(rel(r.upper[0]!, 1.2533141373155003e-10)).toBeLessThan(1e-10);
    expect(rel(r.lower[0]!, -1.2533141373155003e-10)).toBeLessThan(1e-10);
    // were [0.9162907318068814, 0.9162907318918782] (width 7.9e-11); R [0.91628353079258176, 0.91628353087160104]
    const p = glmConfint(poi, { level: 1e-10 });
    expect(Math.abs(p.lower[0]! - 0.91629073183452179)).toBeLessThan(1e-15);
    expect(Math.abs(p.upper[0]! - 0.91629073191378834)).toBeLessThan(1e-15);
  });

  it("gives the limits at levels up to the switch (1e-5, 1.5e-3)", () => {
    expect(rel(glmConfint(bin, { level: 1e-5 }).upper[0]!, 1.253314137352413502e-5)).toBeLessThan(1e-10);
    expect(rel(glmConfint(bin, { level: 1.5e-3 }).upper[0]!, 0.0018799724517936234)).toBeLessThan(1e-10);
    const p = glmConfint(poi, { level: 1e-5 });
    expect(Math.abs(p.lower[0]! - 0.91628676854423936)).toBeLessThan(1e-14);
    expect(Math.abs(p.upper[0]! - 0.91629469519883478)).toBeLessThan(1e-14);
  });

  it("leaves the limits at level 1.6e-3 and above unchanged (to 8 ulp)", () => {
    const same = (r: { lower: number[]; upper: number[] }, lower: number, upper: number): void => {
      expect(ulps(r.lower[0]!, lower)).toBeLessThanOrEqual(8); expect(ulps(r.upper[0]!, upper)).toBeLessThanOrEqual(8);
    };
    same(glmConfint(bin, { level: 0.0016 }), -0.002005304131606309, 0.0020053041315946374);
    same(glmConfint(bin, { level: 0.01 }), -0.01253351052591734, 0.012533510525923663);
    same(glmConfint(bin, { level: 0.95 }), -2.119930271104542, 2.1199302711045425);
    same(glmConfint(poi, { level: 0.0016 }), 0.9156565320537257, 0.9169247976531394);
    same(glmConfint(poi, { level: 0.95 }), 0.2252943449805083, 1.4781522700693732);
  });
});

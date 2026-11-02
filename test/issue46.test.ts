// Issue #46: pearsonTest counts a value whose pnorm rounds to 1 in the last class (review_fix_log_issue46.md).
import { describe, expect, it } from "vitest";
import { pearsonTest } from "../src/index.js";

describe("issue #46", () => {
  it("keeps every observation (nortest drops the outlier: 1176.13)", () => {
    const x = [...Array<number>(99).fill(0), 1e6];
    // 13 classes of expected count e = 100 / 13: 99 in the 6th, the outlier in the 13th
    const e = 100 / 13;
    const r = pearsonTest(x);
    expect(r.statistic).toBeCloseTo(11 * e + (99 - e) ** 2 / e + (1 - e) ** 2 / e, 10);
    expect(r.statistic).toBeCloseTo(1174.26, 10);
    expect(r.pValue / 5.1329907383211708e-246).toBeCloseTo(1, 12);
    expect(pearsonTest(x, { adjust: false }).pValue / 6.0378018637818052e-244).toBeCloseTo(1, 12);
  });

  it("leaves data without such values as before (nortest)", () => {
    const y = [2.1, 3.4, 1.9, 5.6, 4.4, 3.3, 2.8, 4.9, 3.7, 3.1, 4.2, 2.5, 3.9, 4.6, 3.0, 2.2, 5.1, 3.6, 4.0, 2.9];
    const r = pearsonTest(y);
    expect(r.statistic).toBeCloseTo(0.3, 14);
    expect(r.pValue).toBeCloseTo(0.98981417288881666, 14);
  });
});

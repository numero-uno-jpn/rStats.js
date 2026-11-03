// Issue #269: pwrRTest where the square of the critical t overflows (review_fix_log_issue269.md).
import { describe, expect, it } from "vitest";
import { pwrRTest } from "../src/index.js";

describe("issue #269", () => {
  it("takes the critical correlation as 1 / sqrt(1 + ((n - 2) / t) / t) where t^2 overflows", () => {
    // t = 7.07e159 with 2 df; the critical correlation rounds to 1, and the power (pnorm about -368) underflows to 0;
    // was NaN, R too
    expect(pwrRTest({ n: 4, r: 0.5, sigLevel: 1e-320 }).power).toBe(0);
    expect(pwrRTest({ n: 4, r: 0.5, sigLevel: 1e-320, alternative: "greater" }).power).toBe(0);
    expect(pwrRTest({ n: 4, r: -0.99, sigLevel: 1e-320, alternative: "less" }).power).toBe(0);
  });

  it("leaves the other cases as before", () => {
    expect(pwrRTest({ n: 50, r: 0.3 }).power).toBe(0.571555841860208);
    expect(pwrRTest({ n: 4, r: 0.5, sigLevel: 1e-300 }).power).toBe(0);
    // an infinite t (sigLevel 0) is not taken up here
    expect(pwrRTest({ n: 4, r: 0.5, sigLevel: 0 }).power).toBeNaN();
  });
});

// Issue #197: powerTTest's noncentrality where sqrt(n / ts) * delta overflows before the division by sd
// (review_fix_log_issue197.md).
import { describe, expect, it } from "vitest";
import { powerTTest } from "../src/index.js";

describe("issue #197", () => {
  it("gives the power of the finite noncentrality", () => {
    // delta / sd = 1 exactly, so the noncentrality is that of delta = sd = 1 (R 4.5.2 gives 1 for the large values:
    // its noncentrality is Inf; 0.56198 for delta = sd = 1). Before the fix: 1, 1, 1, 1 and 0
    const cases: [object, object][] = [
      [{ n: 10, delta: 1e308, sd: 1e308 }, { n: 10, delta: 1, sd: 1 }],
      [{ n: 10, delta: 1e308, sd: 1e308, type: "one.sample" }, { n: 10, delta: 1, sd: 1, type: "one.sample" }],
      [{ n: 10, delta: 1e308, sd: 1e308, strict: true }, { n: 10, delta: 1, sd: 1, strict: true }],
      [
        { n: 10, delta: 1e308, sd: 1e308, alternative: "one.sided" },
        { n: 10, delta: 1, sd: 1, alternative: "one.sided" },
      ],
      [
        { n: 10, delta: -1e308, sd: 1e308, alternative: "one.sided" },
        { n: 10, delta: -1, sd: 1, alternative: "one.sided" },
      ],
    ];
    for (const [big, unit] of cases) expect(powerTTest(big).power).toBe(powerTTest(unit).power);
    expect(powerTTest({ n: 10, delta: 1e308, sd: 1e308 }).power).toBeCloseTo(0.561984615034271, 12);
  });

  it("keeps powers whose product does not overflow, and an infinite noncentrality", () => {
    // values before the fix
    expect(powerTTest({ n: 10, delta: 1, sd: 1 }).power).toBe(0.5619846150342211);
    expect(powerTTest({ n: 10, delta: 1e308, sd: 2e-308 }).power).toBe(1);
  });
});

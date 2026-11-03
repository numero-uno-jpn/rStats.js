// Issue #323: poissonTest's upper tail P[X >= x] as ppois(x - 1, upper) where x - 1 rounds (x beyond 2^53)
// (review_fix_log_issue323.md).
import { describe, expect, it } from "vitest";
import { dpois, poissonTest, ppois } from "../src/index.js";

describe("issue #323", () => {
  it("keeps the point mass at x in the upper tail", () => {
    // true values 1/2 + 1 / (3 sqrt(2 pi x)) to first order: 0.5000000014012 (x = 2^53 + 2), 0.5000000009908 (2^54 + 4)
    for (const x of [2 ** 53 + 2, 2 ** 54 + 4]) {
      const r = poissonTest(x, { r: x, T: 1, alternative: "greater" });
      expect(r.pValue, `${x}`).toBe(ppois(x, x, { lowerTail: false }) + dpois(x, x));
    }
    expect(poissonTest(2 ** 53 + 2, { r: 2 ** 53 + 2, alternative: "greater" }).pValue).toBeCloseTo(0.5000000014012, 12);
    expect(poissonTest(2 ** 54 + 4, { r: 2 ** 54 + 4, alternative: "greater" }).pValue).toBeCloseTo(0.5000000009908, 12);
  });

  it("keeps an exact x - 1 as before", () => {
    expect(poissonTest(2 ** 53, { r: 2 ** 53, alternative: "greater" }).pValue).toBe(0.50000000140118);
    expect(poissonTest(137, { T: 24.19893, alternative: "greater" }).pValue).toBe(ppois(136, 24.19893, { lowerTail: false }));
  });
});

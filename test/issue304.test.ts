// Issue #304: the nortest tests reject an infinite observation (review_fix_log_issue304.md).
import { describe, expect, it } from "vitest";
import { adTest, cvmTest, lillieTest, pearsonTest, sfTest } from "../src/index.js";

describe("issue #304: normality tests with an infinite value", () => {
  const tests = { adTest, cvmTest, lillieTest, sfTest, pearsonTest };
  for (const [name, f] of Object.entries(tests)) {
    it(`${name} throws for Infinity and -Infinity`, () => {
      expect(() => f([1, 2, 3, 4, 5, 6, 7, Infinity])).toThrow("'x' must be finite");
      expect(() => f([-Infinity, 1, 2, 3, 4, 5, 6, 7])).toThrow("'x' must be finite");
    });
  }

  it("NaN is still dropped", () => {
    expect(adTest([1, 2, 3, 4, 5, 6, 7, 8, NaN])).toEqual(adTest([1, 2, 3, 4, 5, 6, 7, 8]));
  });
});

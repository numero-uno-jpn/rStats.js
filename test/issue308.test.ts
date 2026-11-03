// Issue #308: the exact ansariTest has a size limit on its distribution (review_fix_log_issue308.md).
import { describe, expect, it } from "vitest";
import { ansariTest } from "../src/index.js";
import { checkAnsariExactSize } from "../src/htest/core/ansari.js";

describe("issue #308", () => {
  it("allows up to 2^24 doubles and 2^32 steps (boundary)", () => {
    // m = n = 202: 2 * 203 * 41007 = 16648842 doubles <= 2^24 (5.3 s on the development machine); 203: 16896504
    expect(() => checkAnsariExactSize(202, 202)).not.toThrow();
    expect(() => checkAnsariExactSize(203, 203)).toThrow(/m = 203 and n = 203.*use exact: false/);
    // m = 1: the steps decide, N (m + 1) (maxSum + 1) = 2047 * 2 * 1048577 <= 2^32 < 2048 * 2 * 1049601
    expect(() => checkAnsariExactSize(1, 2046)).not.toThrow();
    expect(() => checkAnsariExactSize(1, 2047)).toThrow(RangeError);
  });

  it("is a RangeError before the distribution is built (the issue's size)", () => {
    const x = Array.from({ length: 1000 }, (_, i) => 2 * i + 1);
    const y = Array.from({ length: 1000 }, (_, i) => 2 * i + 2);
    expect(() => ansariTest(x, y, { exact: true })).toThrow(/use exact: false/);
    expect(ansariTest(x, y, { exact: false }).pValue).toBeGreaterThan(0.9);
  });
});

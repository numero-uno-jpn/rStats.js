// Issue #384: sfTest with W above 1 by an ulp (review_fix_log_issue384.md).
import { describe, expect, it } from "vitest";
import { sfTest } from "../src/index.js";

describe("issue #384", () => {
  it("keeps W at most 1 for data almost affine in the normal scores", () => {
    // R 4.5.2 (nortest): sf.test of these values has W 1 and p 1; was W 1.0000000000000002 and p NaN here
    const x = [-1.598874458275358, -0.6738324234819416, 1.3552527156068805e-10, 0.6738324237529921, 1.5988744585464087];
    const r = sfTest(x);
    expect(r.statistic).toBe(1);
    expect(r.pValue).toBe(1);
  });
});

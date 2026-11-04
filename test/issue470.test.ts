// Issue #470: uniroot with a root at an endpoint reports estimPrec 0, as R 4.5.2 (review_fix_log_issue470.md).
import { describe, expect, it } from "vitest";
import { uniroot } from "../src/index.js";

describe("issue #470", () => {
  it("an endpoint root has estimPrec 0 as R", () => {
    // R 4.5.2: uniroot(function(x) x, c(0, 1)) and uniroot(function(x) x - 1, c(0, 1)): iter 0, estim.prec 0
    const lo = uniroot((x) => x, 0, 1);
    expect([lo.root, lo.iter, lo.estimPrec]).toEqual([0, 0, 0]);
    const hi = uniroot((x) => x - 1, 0, 1);
    expect([hi.root, hi.iter, hi.estimPrec]).toEqual([1, 0, 0]);
  });
});

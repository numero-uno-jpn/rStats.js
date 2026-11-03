// Issue #209: the exact ansariTest estimate where the two candidate ratios sum beyond the doubles
// (review_fix_log_issue209.md).
import { describe, expect, it } from "vitest";
import { ansariTest } from "../src/index.js";

describe("issue #209", () => {
  it("gives the finite midpoint of R's mean(c(sle, sgr))", () => {
    // R 4.5.2 with the same doubles (passed as hex): ansari.test(0x1.1ccf385ebc8ap+1023, c(1, 1.01), conf.int = TRUE,
    // exact = TRUE)$estimate is 0x1.1b66460816da7p+1023 (conf.int NA NA with a warning); was Infinity here
    const r = ansariTest([1e308], [1, 1.01], { confInt: true, exact: true });
    expect(r.estimate).toBe(0x11b66460816da7 * 2 ** (1023 - 52));
    expect(r.confInt).toEqual([NaN, NaN]);
    // R: ansari.test(.Machine$double.xmax, c(1, 1.01), ...)$estimate is 0x1.fd7720f353a4bp+1023
    const top = ansariTest([Number.MAX_VALUE], [1, 1.01], { confInt: true, exact: true });
    expect(top.estimate).toBe(0x1fd7720f353a4b * 2 ** (1023 - 52));
  });

  it("keeps the estimate where the sum does not overflow", () => {
    // before the fix: 9.950495049504952e+299 (the same bits as (1e300 + 1e300 / 1.01) / 2)
    const r = ansariTest([1e300], [1, 1.01], { confInt: true, exact: true });
    expect(r.estimate).toBe((1e300 + 1e300 / 1.01) / 2);
  });
});

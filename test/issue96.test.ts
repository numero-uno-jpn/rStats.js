// Issue #96: the noncentral beta log density at x = 1 with b = 1, log(a + ncp/2), where the sum overflows
// (review_fix_log_issue96.md). R 4.5.2: -Inf.
import { describe, expect, it } from "vitest";
import { dbeta } from "../src/index.js";

describe("issue #96", () => {
  it("takes the log of a + ncp/2 without forming the sum", () => {
    // log(2.25e308) = log(1.125e308) + log 2 = 710.0071388583824...
    const want = Math.log(1.125e308) + Math.LN2;
    const got = dbeta(1, 1.5e308, 1, { ncp: 1.5e308, log: true });
    expect(Math.abs(got - want) / want).toBeLessThan(4e-16);
    expect(dbeta(1, 1.5e308, 1, { ncp: 1.5e308 })).toBe(Infinity);
  });

  it("keeps the ordinary range", () => {
    // R: dbeta(1, 2, 1, ncp = 3, log = TRUE) = 1.252763
    expect(dbeta(1, 2, 1, { ncp: 3, log: true })).toBe(Math.log(3.5));
  });
});

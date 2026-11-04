// Issue #496: dwilcox at the endpoint of m = n = 9e7 builds a one-entry table in m passes, within the work limit
// 2^29 and about 2 s (review_fix_log_issue496.md).
import { describe, expect, it } from "vitest";
import { dwilcox } from "../src/index.js";

describe("issue #496", () => {
  it("dwilcox(0, 9e7, 9e7) is 0 and its log -lchoose(1.8e8, 9e7)", () => {
    // R 4.5.2: -lchoose(1.8e8, 9e7) = -0x1.dbf244b154371p+26 (-124766482.770765081; Rmpfr -124766482.77076509723);
    // exp of it underflows to 0
    expect(dwilcox(0, 9e7, 9e7)).toBe(0);
    expect(dwilcox(0, 9e7, 9e7, { log: true })).toBeCloseTo(-0x1dbf244b154371 * 2 ** -26, 6);
    expect(dwilcox(8.1e15, 9e7, 9e7)).toBe(0);
  }, 20000);
});

// Issue #476: ansariTest's normal approximation with ties centres on m (N + 2) / 4 as R 4.5.2's ansari.test
// (the centre m mean(a) is R trunk's; review_fix_log_issue476.md).
import { describe, expect, it } from "vitest";
import { ansariTest } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #476", () => {
  it("tied normal approximation as R 4.5.2", () => {
    // R 4.5.2: ansari.test(c(1, 1), c(1, 2), exact = FALSE): AB 4, p 0x1.8bc06ccf600b8p-2 (0.38647623077123283)
    const a = ansariTest([1, 1], [1, 2], { exact: false });
    expect(a.statistic).toBe(4);
    expect(rel(a.pValue, 0x18bc06ccf600b8 * 2 ** -54)).toBeLessThan(1e-15);
    // ansari.test(c(1, 2, 2, 3, 5), c(2, 3, 3, 4, 6, 7), exact = FALSE): AB 16, p 0x1.d716b34aa1c25p-1
    const b = ansariTest([1, 2, 2, 3, 5], [2, 3, 3, 4, 6, 7], { exact: false });
    expect(b.statistic).toBe(16);
    expect(rel(b.pValue, 0x1d716b34aa1c25 * 2 ** -53)).toBeLessThan(1e-15);
  });
});

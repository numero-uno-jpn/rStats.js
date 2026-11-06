// Issue #476: ansariTest's normal approximation with ties centred on m (N + 2) / 4 as R 4.5.2's ansari.test; since
// R 4.6 (as R trunk then, review_fix_log_issue476.md) it is centred on m mean(a), with the variance m n var(a) / N
import { describe, expect, it } from "vitest";
import { ansariTest } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #476", () => {
  it("tied normal approximation as R 4.6.2", () => {
    // R 4.6.2: ansari.test(c(1, 1), c(1, 2), exact = FALSE): AB 4, p 0x1.44ed0bb7cb20cp-2 (0.31731050786291415;
    // R 4.5.2: 0.38647623077123283)
    const a = ansariTest([1, 1], [1, 2], { exact: false });
    expect(a.statistic).toBe(4);
    expect(rel(a.pValue, 0x144ed0bb7cb20c * 2 ** -54)).toBeLessThan(1e-15);
    // ansari.test(c(1, 2, 2, 3, 5), c(2, 3, 3, 4, 6, 7), exact = FALSE): AB 16, p 0x1.5bbfe206a11cep-1
    // (0.67919832545208592; R 4.5.2: 0.9200950649836882)
    const b = ansariTest([1, 2, 2, 3, 5], [2, 3, 3, 4, 6, 7], { exact: false });
    expect(b.statistic).toBe(16);
    expect(rel(b.pValue, 0x15bbfe206a11ce * 2 ** -53)).toBeLessThan(1e-15);
  });
});

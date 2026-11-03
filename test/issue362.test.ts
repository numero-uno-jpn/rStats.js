// Issue #362: optim's L-BFGS-B takes lmm as R's as.integer (truncated; NaN and values beyond the integer range are
// NA, which lbfgsb rejects as "ERROR: M .LE. 0" with convergence 52, the latter with R's coercion warning).
// Reference: R 4.5.2.
import { describe, expect, it } from "vitest";
import { optim } from "../src/index.js";

const rosen = (x: number[]) => 100 * (x[1]! - x[0]! ** 2) ** 2 + (1 - x[0]!) ** 2;
const run = (lmm: number) => optim([-1.2, 1], rosen, { method: "L-BFGS-B", control: { lmm } });

describe("issue #362", () => {
  it("a fractional lmm is truncated", () => {
    // R: optim(0, function(x) (x - 2)^2, method = "L-BFGS-B", control = list(lmm = 1.5)): par 2, counts 4, 4, convergence 0
    const r = optim([0], (x) => (x[0]! - 2) ** 2, { method: "L-BFGS-B", control: { lmm: 1.5 } });
    expect(r.par).toEqual([2]);
    expect(r.counts).toEqual([4, 4]);
    expect(r.convergence).toBe(0);
    // R lmm = 2.7: the same as lmm = 2 (counts 86, 86)
    const r27 = run(2.7);
    expect(r27).toEqual(run(2));
    expect(r27.counts).toEqual([86, 86]);
    expect(run(1.5)).toEqual(run(1));
  });

  it("lmm below 1, NaN or beyond the integer range: ERROR: M .LE. 0 (code 52)", () => {
    for (const lmm of [0.5, -1, -1.5, NaN, 3e9, -3e9, Infinity]) {
      const r = run(lmm);
      expect(r.par).toEqual([-1.2, 1]);
      expect(r.counts).toEqual([0, 0]);
      expect(r.convergence).toBe(52);
      expect(r.message).toBe("ERROR: M .LE. 0");
      expect(r.warnings).toEqual(Math.abs(lmm) > 2147483647 ? ["NAs introduced by coercion to integer range"] : []);
    }
  });
});

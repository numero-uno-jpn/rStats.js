// Issue #154: pAdjust BY formed q n first, which overflows for n above about 2.5e305 (review_fix_log_issue154.md).
// Reference: H_n n p with H_n = log n + γ + 1/(2n) in Rmpfr (2000 bits), n the double 1e306:
// 3.483994088990754201e-15 for p = 2^-1074.
import { describe, expect, it } from "vitest";
import { pAdjust } from "../src/index.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #154", () => {
  it("keeps BY finite where q n overflows", () => {
    const [a] = pAdjust([Number.MIN_VALUE], { method: "BY", n: 1e306 });
    expect(rel(a!, 3.483994088990754201e-15)).toBeLessThan(1e-15);
    const b = pAdjust([Number.MIN_VALUE, 1e-310, 0, 0.5], { method: "BY", n: 1e306 });
    expect(rel(b[0]!, 1.741997044495377100e-15)).toBeLessThan(1e-15);
    expect(b[1]).toBe(0.023505608470702585);
    expect(b[2]).toBe(0); // was NaN (Infinity times 0)
    expect(b[3]).toBe(1);
  });

  it("keeps the other cases as before", () => {
    expect(pAdjust([0.01, 0.02, 0.03], { method: "BY", n: 1e7 })).toEqual([1, 1, 1]);
    expect(pAdjust([Number.MIN_VALUE], { method: "BH", n: 1e306 })).toEqual([4.9406564584124655e-18]);
    // q n finite: the value of the code before the fix
    expect(pAdjust([1e-305, 1e-306], { method: "BY", n: 1e300 })).toEqual([0.0034567637178155764, 0.0006913527435631153]);
  });
});

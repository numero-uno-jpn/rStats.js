// Issue #488: fisherTest's simulation with B = 0 ran no simulation and returned p = (1 + 0) / (0 + 1) = 1 (R 4.5.2 does
// the same). By K1 (no meaningful result) B must now be a positive integer.
import { describe, expect, it } from "vitest";
import { fisherTest, runif, setSeed } from "../src/index.js";

describe("issue #488: fisherTest with B = 0", () => {
  const t = [
    [2, 1, 1],
    [1, 2, 1],
  ];

  it("B = 0 and B < 0 are errors", () => {
    expect(() => fisherTest(t, { simulatePValue: true, B: 0 })).toThrow("'B' must be a positive integer");
    expect(() => fisherTest(t, { simulatePValue: true, B: -1 })).toThrow("'B' must be a positive integer");
  });

  it("B = 1 is unchanged", () => {
    // set.seed(1); fisher.test(t, simulate.p.value = TRUE, B = 1)$p.value: 0x1p+0; then runif(1): 0x1.254d093ap-1
    setSeed(1);
    const r = fisherTest(t, { simulatePValue: true, B: 1 });
    expect(r.pValue).toBe(1);
    expect(r.method).toBe("Fisher's Exact Test for Count Data with simulated p-value\n\t (based on 1 replicates)");
    expect(runif(1)[0]).toBe(0x1254d093a * 2 ** -33);
  });

  // R also ignores B there: fisher.test(matrix(c(3, 1, 1, 3), 2), simulate.p.value = TRUE, B = 0) gives p = 0.4857
  it("a 2 x 2 table ignores the simulation, as before", () => {
    expect(fisherTest([[3, 1], [1, 3]], { simulatePValue: true, B: 0 }).pValue).toBe(fisherTest([[3, 1], [1, 3]]).pValue);
  });
});

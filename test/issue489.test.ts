// Issue #489: chisqTest's simulation with B = 0 ran no simulation and returned p = (1 + 0) / (0 + 1) = 1, for goodness
// of fit and for tables (R 4.5.2 does the same). By K1 (no meaningful result) B must now be a positive integer.
// R values: set.seed(1); chisq.test(x, simulate.p.value = TRUE, B = 1), then runif(1), printed with sprintf("%a").
import { describe, expect, it } from "vitest";
import { chisqTest, runif, setSeed } from "../src/index.js";

describe("issue #489: chisqTest with B = 0", () => {
  const gof = [10, 20];
  const tab = [
    [10, 20],
    [20, 10],
  ];

  it("B = 0 and B < 0 are errors, for goodness of fit and for tables", () => {
    for (const x of [gof, tab]) {
      expect(() => chisqTest(x, { simulatePValue: true, B: 0 })).toThrow("'B' must be a positive integer");
      expect(() => chisqTest(x, { simulatePValue: true, B: -1 })).toThrow("'B' must be a positive integer");
    }
  });

  it("B = 1 is unchanged", () => {
    // goodness of fit: p 0x1p-1, next uniform 0x1.eda668e8p-2
    setSeed(1);
    expect(chisqTest(gof, { simulatePValue: true, B: 1 }).pValue).toBe(0.5);
    expect(runif(1)[0]).toBe(0x1eda668e8 * 2 ** -34);
    // table: p 0x1p-1, next uniform 0x1.7d0e0c2cp-2
    setSeed(1);
    expect(chisqTest(tab, { simulatePValue: true, B: 1 }).pValue).toBe(0.5);
    expect(runif(1)[0]).toBe(0x17d0e0c2c * 2 ** -34);
  });

  it("a table with a zero margin runs the ordinary test, as R (B is not used)", () => {
    // R: "cannot compute simulated p-value with zero marginals", Pearson's Chi-squared test with p NaN
    const r = chisqTest([[1, 3, 5], [0, 0, 0]], { simulatePValue: true, B: 0 });
    expect(r.method).toBe("Pearson's Chi-squared test");
    expect(r.pValue).toBeNaN();
  });
});

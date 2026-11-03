// Issue #285: the contingency-table simulation of chisqTest built its table of log factorials (total + 1 doubles) for
// any grand total (32 GB for a total of 4e9). The simulation now needs a total of at most 2^24, as r2dtable (#336).
import { describe, expect, it } from "vitest";
import { chisqTest, setSeed } from "../src/index.js";

const q = 2 ** 22;

describe("issue #285", () => {
  it("a total of 2^24 + 1 is an error", () => {
    expect(() => chisqTest([[q, q], [q, q + 1]], { simulatePValue: true, B: 1 })).toThrow("total count of at most 16777216 (2^24)");
  });

  // (before the fix this builds a 32 GB table: excluded from the stash check with -t)
  it("alloc: the issue's total of 4e9", () => {
    expect(() => chisqTest([[1e9, 1e9], [1e9, 1e9]], { simulatePValue: true, B: 1 })).toThrow("total count of at most 16777216 (2^24)");
  });

  it("a total of 2^24 and the ordinary test unchanged", () => {
    expect(chisqTest([[q, q], [q, q]], { simulatePValue: true, B: 1 }).pValue).toBeGreaterThan(0);
    expect(chisqTest([[1e9, 1e9], [1e9, 1e9]]).pValue).toBe(1);
    // R 4.5.2: set.seed(1); chisq.test(matrix(c(12, 5, 7, 9), 2), simulate.p.value = TRUE)$p.value
    setSeed(1);
    expect(chisqTest([[12, 7], [5, 9]], { simulatePValue: true }).pValue).toBe(0.17641179410294852);
  });
});

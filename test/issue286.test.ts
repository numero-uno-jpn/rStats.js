// Issue #286: the simulation of fisherTest built its table of log factorials (total + 1 doubles) for any grand total
// (48 GB for a total of 6e9). The simulation now needs a total of at most 2^24, as r2dtable (#336).
import { describe, expect, it } from "vitest";
import { fisherTest, setSeed } from "../src/index.js";

const q = 2 ** 22;

describe("issue #286", () => {
  it("a total of 2^24 + 1 is an error", () => {
    expect(() => fisherTest([[q, q], [q, q], [1, 0]], { simulatePValue: true, B: 1 })).toThrow("total count of at most 16777216 (2^24)");
  });

  // (before the fix this builds a 48 GB table: excluded from the stash check with -t)
  it("alloc: the issue's total of 6e9", () => {
    expect(() => fisherTest([[1e9, 1e9], [1e9, 1e9], [1e9, 1e9]], { simulatePValue: true, B: 1 })).toThrow(
      "total count of at most 16777216 (2^24)",
    );
  });

  it("a total of 2^24 and small tables unchanged", () => {
    expect(fisherTest([[q, q], [q, q - 1], [0, 1]], { simulatePValue: true, B: 1 }).pValue).toBeGreaterThan(0);
    // R 4.5.2: set.seed(1); fisher.test(matrix(c(12, 5, 3, 7, 9, 6), 3), simulate.p.value = TRUE)$p.value
    setSeed(1);
    expect(fisherTest([[12, 7], [5, 9], [3, 6]], { simulatePValue: true }).pValue).toBe(0.21639180409795103);
  });
});

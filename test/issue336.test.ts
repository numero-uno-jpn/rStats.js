// Issue #336: r2dtable built its table of log factorials (total + 1 doubles) for any grand total up to 2147483647
// (8 GB for r2dtable(1, [5e8, 5e8], [5e8, 5e8])). Generating tables now needs a total of at most 2^24 (as the
// simulations of chisqTest and fisherTest, #285 and #286, and the exact supports of #232); R allows 2147483647 (docs).
import { describe, expect, it } from "vitest";
import { r2dtable, setSeed } from "../src/index.js";

const h = 2 ** 23;

describe("issue #336", () => {
  it("a total of 2^24 + 1 is an error", () => {
    expect(() => r2dtable(1, [h, h + 1], [h, h + 1])).toThrow("the sum of 'r' must be at most 16777216 (2^24)");
  });

  // (before the fix this builds an 8 GB table: excluded from the stash check with -t)
  it("alloc: the issue's total of 1e9", () => {
    expect(() => r2dtable(1, [5e8, 5e8], [5e8, 5e8])).toThrow("the sum of 'r' must be at most 16777216 (2^24)");
  });

  it("no table asked for, and the integer range, as before", () => {
    expect(r2dtable(0, [5e8, 5e8], [5e8, 5e8])).toEqual([]);
    const m = 2147483647;
    expect(() => r2dtable(1, [m, m], [m, m])).toThrow("the sum of 'r' must be at most 2147483647");
  });

  it("a total of 2^24 and small tables unchanged", () => {
    const t = r2dtable(1, [h, h], [h, h])[0]!;
    expect(t[0]![0]! + t[0]![1]!).toBe(h);
    setSeed(1);
    // R: set.seed(1); r2dtable(1, c(3, 2), c(2, 3))
    expect(r2dtable(1, [3, 2], [2, 3])).toEqual([[[1, 2], [1, 1]]]);
  });
});

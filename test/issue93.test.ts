// Issue #93: r2dtable's n truncated before it is checked, as R's as.integer(n) (review_fix_log_issue93.md).
// R 4.5.2: n = -0.5, -0.999 and 0.5 give list() without drawing, 2.7 two tables, -1, -1.1 and NaN an error.
import { describe, expect, it } from "vitest";
import { r2dtable, runif, setSeed } from "../src/index.js";

describe("issue #93", () => {
  setSeed(1);
  const first = runif(1)[0];

  it("truncates n towards 0 first", () => {
    for (const n of [-0.5, -0.999, 0.5]) {
      setSeed(1);
      expect(r2dtable(n, [1, 1], [1, 1]), String(n)).toEqual([]);
      expect(runif(1)[0], String(n)).toBe(first);
    }
    setSeed(1);
    const two = r2dtable(2, [1, 1], [1, 1]);
    const next = runif(1)[0];
    setSeed(1);
    expect(r2dtable(2.7, [1, 1], [1, 1])).toEqual(two);
    expect(runif(1)[0]).toBe(next);
  });

  it("rejects what as.integer makes negative or NA", () => {
    for (const n of [-1, -1.1, NaN, Infinity, -Infinity, 2 ** 31]) {
      expect(() => r2dtable(n, [1, 1], [1, 1]), String(n)).toThrow("invalid argument 'n'");
    }
  });
});

// Revision of review 12 (and the out-of-scope note of issue 407): rwilcox without the array of m + n ranks beyond 2^24,
// and n at most 2^24 (review_fix_log_20261031_12_rev.md).
import { describe, expect, it } from "vitest";
import { rwilcox, runif, setSeed } from "../src/index.js";
import { unifIndex } from "../src/random/rng.js";

/** The array version (before the revision) */
function arrayRankSum(m: number, n: number): number {
  let k = m + n;
  const x = new Int32Array(k);
  for (let i = 0; i < k; i++) x[i] = i;
  let r = 0;
  for (let i = 0; i < n; i++) {
    const j = unifIndex(k);
    r += x[j]!;
    x[j] = x[--k]!;
  }
  return r - (n * (n - 1)) / 2;
}

describe("review 12 (revision)", () => {
  it("keeps the values and the stream beyond 2^24 ranks (the values before the revision)", () => {
    setSeed(42);
    expect(rwilcox(3, 2 ** 24, 1000)).toEqual([8412425064, 8471281579, 8239284703]);
    expect(runif(1)[0]).toBe(0.42369130183942616);
    setSeed(3);
    expect(rwilcox(2, 3e7, 5e5)).toEqual([7500131290734, 7505587576761]);
    expect(runif(1)[0]).toBe(0.6375575580168515);
    // within 2^24 ranks: the array as before
    setSeed(5);
    expect(rwilcox(4, 2 ** 24 - 10, 10)).toEqual([79794662, 105704251, 89347602, 89687622]);
    expect(runif(1)[0]).toBe(0.9394364822655916);
  });

  it("matches the array version where n is a large part of m + n", () => {
    // many slots swapped twice or more, and draws of the last slot
    const m = 2 ** 24 - 5000;
    const n = 30000;
    setSeed(9);
    const expected = [arrayRankSum(m, n), arrayRankSum(m, n)];
    const next = runif(1)[0];
    setSeed(9);
    expect(rwilcox(2, m, n)).toEqual(expected);
    expect(runif(1)[0]).toBe(next);
  });

  it("allocates nothing of the size of m + n", () => {
    // an Int32Array of 2e9 (8 GB) before
    setSeed(1);
    const t = performance.now();
    const v = rwilcox(5, 2e9, 10);
    expect(performance.now() - t).toBeLessThan(100);
    expect(v.every((w) => Number.isInteger(w) && w >= 0 && w <= 2e10)).toBe(true);
    expect(() => rwilcox(1, 2147483648, 5)).toThrow("m + n must be at most 2147483647");
  });

  it("rejects n beyond 2^24 at once, before drawing", () => {
    setSeed(11);
    const next = runif(1)[0];
    setSeed(11);
    const t = performance.now();
    // 3.4 s per value before
    expect(() => rwilcox(2, 10, 2 ** 24 + 5)).toThrow("n must be at most 2^24 (16777216)");
    expect(() => rwilcox(1, 1e9, 2 ** 24 + 1)).toThrow("n must be at most 2^24 (16777216)");
    expect(performance.now() - t).toBeLessThan(100);
    expect(runif(1)[0]).toBe(next);
  });
});

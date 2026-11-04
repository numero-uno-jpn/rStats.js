// Revision of reviews 45 and 46: a bound on the time of dwilcox, pwilcox and qwilcox (review_fix_log_20261031_45_rev.md).
// Only the rejections are run beyond the bound (they come before the table); inside it the values are unchanged.
import { describe, expect, it } from "vitest";
import { dwilcox, pwilcox, qwilcox, wilcoxTest } from "../src/index.js";

const quick = (f: () => unknown, message: string) => {
  const t = performance.now();
  expect(f).toThrow(message);
  expect(performance.now() - t).toBeLessThan(100);
};

describe("review 45 (revision)", () => {
  it("rejects tables of more than 2^29 steps at once", () => {
    // 3000 passes over 200001 entries (5 s before)
    quick(() => pwilcox(2e5, 3000, 3000, { logP: true }), "wilcox: m = 3000, n = 3000 needs 600003000 steps for a table of 200001 entries (at most 2^29)");
    // about 20 minutes before
    quick(() => pwilcox(1e6, 1e5, 1e5), "wilcox: m = 100000, n = 100000 needs 100000100000 steps for a table of 1000001 entries (at most 2^29)");
    quick(() => dwilcox(1e6, 1e5, 2e5), "(at most 2^29)");
    // the upper tail reads the table from the other end; m, n in either order
    quick(() => pwilcox(9e6 - 2e5 - 1, 3000, 3000, { lowerTail: false }), "(at most 2^29)");
    quick(() => pwilcox(2e5, 4000, 3000), "wilcox: m = 3000, n = 4000 needs");
    quick(() => qwilcox(0.5, 3000, 3000), "(at most 2^29)");
  });

  it("points wilcoxTest with exact: true to exact: false", () => {
    const x = Array.from({ length: 3000 }, (_, i) => 2 * i);
    const y = Array.from({ length: 3000 }, (_, i) => 2 * i + 1);
    quick(() => wilcoxTest(x, y, { exact: true }), "(at most 2^29): use exact: false");
    // W = 1498500 of 3e6 (x 6i, y 2j + 1)
    const x6 = Array.from({ length: 1000 }, (_, i) => 6 * i);
    quick(() => wilcoxTest(x6, y, { exact: true, alternative: "less" }), ": use exact: false");
  });

  it("keeps the values inside the bound", () => {
    // the values before the revision
    expect(pwilcox(9e4, 600, 600)).toBe(3.2209170573632217e-54);
    expect(dwilcox(5e4, 400, 700, { log: true })).toBe(-185.81796075499884);
  });
});

// Issue #305: pearsonTest allocated a count array of nClasses entries (2^31 passed the check). The class counts are now
// taken from the sorted class numbers and summed in the same order without the array; nClasses beyond R's integer
// range is R's tabulate error (R 4.5.2 nortest::pearson.test(1:8, n.classes = 2^31): "attempt to make a table with
// >= 2^31 elements").
import { describe, expect, it } from "vitest";
import { pearsonTest } from "../src/index.js";

const x = [1, 2, 3, 4, 5, 6, 7, 8];

describe("issue #305", () => {
  it("nClasses far beyond the integer range", () => {
    expect(() => pearsonTest(x, { nClasses: 1e300 })).toThrow("attempt to make a table with >= 2^31 elements");
  });

  // (before the fix this reaches the allocation: excluded from the stash check with -t)
  it("alloc: the issue's 2^31", () => {
    expect(() => pearsonTest(x, { nClasses: 2 ** 31 })).toThrow("attempt to make a table with >= 2^31 elements");
  });

  // values of the implementation before this change; the statistic for 1000 classes is R's 0x1.f000000000061p+9
  it("values unchanged", () => {
    const r1 = pearsonTest(x, { nClasses: 1000 });
    expect([r1.statistic, r1.pValue]).toEqual([992.000000000011, 0.5387252346120099]);
    const r2 = pearsonTest(x, { nClasses: 1e6 });
    expect(r2.statistic).toBe(999991.9999781048);
    // 0.50122241912501441829 (mpmath); 0.5012224191250144 until pgamma's Temme region took the smaller tail from the
    // double-double deviance (1.2.0), now one ulp from it (the upper tail is 1 minus the lower there)
    expect(Math.abs(r2.pValue - 0.50122241912501441829) / 0.5).toBeLessThanOrEqual(2 ** -52);
    const y = [2.1, 3.4, 1.9, 5.6, 4.4, 3.3, 2.8, 4.1, 3.9, 6.2];
    expect(pearsonTest(y).pValue).toBe(0.8494670333918255);
    expect(pearsonTest(y, { nClasses: 7, adjust: false }).statistic).toBe(2.6);
  });
});

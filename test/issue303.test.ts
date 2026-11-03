// Issue #303: chisqTest with rescaleP, where the total of the finite weights overflows, divided each weight by Inf
// (review_fix_log_issue303.md).
import { describe, expect, it } from "vitest";
import { chisqTest } from "../src/index.js";

describe("issue #303", () => {
  it("rescales weights whose total overflows", () => {
    const r = chisqTest([1, 1], { p: [1e308, 1e308], rescaleP: true });
    expect(r.statistic).toBe(0);
    expect(r.pValue).toBe(1);
    expect(r.expected).toEqual([1, 1]);
    // the same bits as the weights 1e300, 1.5e300 (R: statistic 0x1.8000000000002p-2, p 0x1.14a112307fdf9p-1)
    const a = chisqTest([1, 3], { p: [1e308, 1.5e308], rescaleP: true });
    const b = chisqTest([1, 3], { p: [1e300, 1.5e300], rescaleP: true });
    expect(a.statistic).toBe(b.statistic);
    expect(a.pValue).toBe(b.pValue);
    expect(b.statistic).toBe(0.3750000000000001);
    expect(b.pValue).toBe(0.5402913746074199);
  });
});

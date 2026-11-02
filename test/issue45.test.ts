// Issue #45: mcnemarTest writes mixed numeric and string labels as text, as R coerces them (review_fix_log_issue45.md).
import { describe, expect, it } from "vitest";
import { mcnemarTest } from "../src/index.js";

describe("issue #45", () => {
  it("makes 1 and \"1\" one level (R 4.5.2)", () => {
    // four levels each and df 6 before
    const r = mcnemarTest([1, 1, "1", "1", 2, 2, "2", "2", 1, 2], [1, "1", 2, "1", 2, "2", "1", 2, 2, 1]);
    expect([r.statistic, r.parameter, r.pValue]).toEqual([0, 1, 1]);
    const s = mcnemarTest([1, 2, 10, 1, 2, 10, 1, 2], ["a", 2, 10, "a", 10, 2, 2, "a"]);
    expect(s.statistic).toBeCloseTo(1 / 3, 15);
    expect(s.parameter).toBe(3);
    expect(s.pValue).toBeCloseTo(0.95364217309625516, 15);
    // the issue's example is a 2 x 2 table without discordant pairs (R: NaN; an error here, as for any such table)
    expect(() => mcnemarTest([1, 1, "1", "1", 2, 2, "2", "2"], [1, "1", 1, "1", 2, "2", "2", 2])).toThrow(
      "the table has no discordant pairs",
    );
  });

  it("orders string levels by code point (R 4.5.2)", () => {
    const A = "\u{10000}";
    const B = "";
    const r = mcnemarTest([A, A, A, B, B, A, B, A, A, B], ["a", "b", "b", "a", "a", "b", "b", "b", "a", "a"], { correct: false });
    expect(r.statistic).toBeCloseTo(1 / 3, 15);
    expect(r.pValue).toBeCloseTo(0.56370286165077301, 15);
  });

  it("leaves numeric labels as before (R 4.5.2)", () => {
    const r = mcnemarTest([1, 2, 10, 1, 2, 10, 1, 2, 10, 10], [2, 10, 1, 1, 10, 2, 2, 1, 10, 1]);
    expect(r.statistic).toBeCloseTo(2.66666666666666696, 14);
    expect(r.parameter).toBe(3);
    expect(r.pValue).toBeCloseTo(0.44592169836312268, 15);
  });
});

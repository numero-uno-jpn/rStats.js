// Issue #508: aovEz sets the scale of the response by the ids it keeps, so an id removed as incomplete with an extreme
// response no longer scales the others into the subnormals (review_fix_log_issue508.md).
import { describe, expect, it } from "vitest";
import { aovEz } from "../src/index.js";

describe("issue #508", () => {
  it("an incomplete id with response 1e308 does not change the analysis of the others", () => {
    const id = ["s1", "s1", "s2", "s2", "s3", "s3", "incomplete", "incomplete"];
    const W = ["a", "b", "a", "b", "a", "b", "a", "b"];
    const y = [1, 2, 2, 4, 3, 5, 1e308, null];
    const r = aovEz({ id, W, y }, { id: "id", dv: "y", within: "W" });
    expect(r.warnings).toContain("Missing values for 1 ID(s), which were removed before analysis:\nincomplete");
    // the same table as without the incomplete id
    const without = aovEz({ id: id.slice(0, 6), W: W.slice(0, 6), y: y.slice(0, 6) }, { id: "id", dv: "y", within: "W" });
    expect(r.anova.table).toEqual(without.anova.table);
    // afex aov_ez (R 4.5.2) on the data with the incomplete id: MSE 0.16667, F 25, ges 0.38462, p 0.03775
    const [, , mse, f, ges, p] = r.anova.table[0]!;
    expect(mse).toBeCloseTo(1 / 6, 12);
    expect(f).toBeCloseTo(25, 10);
    expect(ges).toBeCloseTo(5 / 13, 12);
    expect(p).toBeCloseTo(0.03774955135062373, 12);
  });
});

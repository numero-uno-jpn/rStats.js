import { describe, expect, it } from "vitest";
import { Anova, anova, lm } from "../src/index.js";

// #350: the response scale of anova and car's Anova came from every row, so a residual of 1e308 in a row of weight 0
// made the sums of squares of the other rows underflow
describe("anova and Anova leave rows of weight 0 out of the response scale (#350)", () => {
  const f5 = lm("y ~ x", { y: [1, 2, 4, 3, 1e308], x: [0, 1, 2, 3, 4] }, { weights: [1, 1, 1, 1, 0] });
  const f4 = lm("y ~ x", { y: [1, 2, 4, 3], x: [0, 1, 2, 3] });

  it("anova: the table of the first four rows (was SS 0, F NaN; R an error)", () => {
    expect(anova(f5).table).toEqual(anova(f4).table);
    expect(anova(f5).table[0]![1]).toBeCloseTo(3.2, 14);
  });

  it("Anova (type II): the table of the first four rows (was 'residual sum of squares is 0'; car NaN)", () => {
    expect(Anova(f5, { type: 2 }).table).toEqual(Anova(f4, { type: 2 }).table);
    expect(Anova(f5, { type: 3 }).table).toEqual(Anova(f4, { type: 3 }).table);
  });
});

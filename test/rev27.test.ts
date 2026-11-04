// Revision of review 27: lmerContest with NaN in L or rhs is an error, as the infinite values
// (review_fix_log_20261031_27_rev.md).
import { describe, expect, it } from "vitest";
import { lmer, lmerContest } from "../src/entries/mixed.js";

describe("review 27 revision: lmerContest NaN", () => {
  const d = { y: [1.1, 2.3, 2.9, 4.2, 5.1, 5.8, 7.2, 8.1], x: [1, 2, 3, 4, 5, 6, 7, 8], g: ["a", "a", "b", "b", "c", "c", "d", "d"] };
  const fit = lmer("y ~ x + (1 | g)", d);
  it("rejects NaN in L, jointly and per row (lmerTest: a row of NA)", () => {
    expect(() => lmerContest(fit, [NaN, 1])).toThrow("L must not contain NaN or infinite values");
    expect(() => lmerContest(fit, [[0, 1], [NaN, 0]])).toThrow("L must not contain NaN or infinite values");
    expect(() => lmerContest(fit, [NaN, 1], { joint: false })).toThrow("L must not contain NaN or infinite values");
  });
  it("rejects a NaN rhs (lmerTest: t or F and p NA)", () => {
    expect(() => lmerContest(fit, [0, 1], { rhs: NaN })).toThrow("rhs must not contain NaN or infinite values");
    expect(() => lmerContest(fit, [[1, 0], [0, 1]], { joint: false, rhs: [0, NaN] })).toThrow("rhs must not contain NaN or infinite values");
  });
  it("keeps finite contrasts", () => {
    expect(lmerContest(fit, [0, 1], { joint: false, level: 0.9 }).estimate[0]).toBeCloseTo(0.9894865131870085, 12);
  });
});

import { describe, expect, it } from "vitest";
import { propTrendTest } from "../src/index.js";

// #319: with no events or only events the pooled proportion is 0 or 1 and the weights infinite; propTrendTest returned
// NaN. R's prop.trend.test stops ("NA/NaN/Inf in 'x'"); so does propTrendTest now (review_fix_log_issue319.md).
describe("propTrendTest with all proportions 0 or all 1 (#319)", () => {
  const message = "all proportions are 0 or all are 1: the test for trend is not defined";

  it("is an error", () => {
    expect(() => propTrendTest([0, 0, 0], [10, 10, 10])).toThrow(message);
    expect(() => propTrendTest([10, 10, 10], [10, 10, 10])).toThrow(message);
    expect(() => propTrendTest([0, 0, 0], [10, 10, 10], [1, 2, 3])).toThrow(message);
    expect(() => propTrendTest([0, 0], [10, 10], [1, NaN])).toThrow(message);
  });

  it("keeps the value when only the groups with a score have no events (R: 0, p 1)", () => {
    const r = propTrendTest([0, 0, 3], [10, 10, 10], [1, 2, NaN]);
    expect([r.statistic, r.pValue]).toEqual([0, 1]);
  });
});

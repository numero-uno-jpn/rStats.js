// Issue #173: scoreStatistic's weighted centre with weights whose sum overflows. The helper is internal; through
// glmAnova's Rao test the smaller fit with an intercept has residuals of weighted mean 0, and huge weights give the
// statistic scaled as the weights (no NaN). A direct call whose weights' sum overflows forms the centre from the
// weights divided by a power of 2 (the guard of #172).
import { describe, expect, it } from "vitest";
import * as api from "../src/index.js";
import { glm, glmAnova } from "../src/index.js";
import { scoreStatistic } from "../src/models/glmConfint.js";

const rao = (x: number[], y: number[], w: number) => {
  const weights = y.map(() => w);
  const f0 = glm(y.map(() => []), y, { family: "gaussian", weights });
  const f1 = glm(x, y, { family: "gaussian", weights });
  return glmAnova([f0, f1], { test: "Rao" }).table[1]![4]!;
};

describe("issue #173", () => {
  it("scoreStatistic is not part of the public API", () => {
    expect("scoreStatistic" in api).toBe(false);
  });

  it("Rao statistics with weights 1e307 (sum 3e307) are those with weights 1, scaled", () => {
    const y = [0, 3, 3];
    // a column orthogonal to the centred residuals: 0
    expect(rao([2, 1, 3], y, 1e307)).toBe(0);
    // 4.5 with weights 1
    expect(rao([1, 2, 3], y, 1)).toBeCloseTo(4.5, 12);
    expect(rao([1, 2, 3], y, 1e307) / 1e307).toBeCloseTo(4.5, 12);
  });

  it("a direct call whose weights' sum overflows gives the statistic scaled as the weights", () => {
    const x = [[1], [2], [3]];
    const r = [1e-100, 3e-100, 2e-100];
    const w = 2 ** 1022; // sum 3 * 2^1022 overflows
    expect(scoreStatistic(x, r, [w, w, w], true) / w).toBe(scoreStatistic(x, r, [1, 1, 1], true));
    // the issue's call: the centre 1 (NaN before); the statistic is the rounding residue of an exact fit
    expect(Number.isFinite(scoreStatistic([[1], [1]], [1, 1], [1e308, 1e308], true))).toBe(true);
  });
});

// Issue #188: glmAnova's Cp where 2 * dispersion overflows and no parameter is fitted (review_fix_log_issue188.md).
import { describe, expect, it } from "vitest";
import { glm, glmAnova } from "../src/index.js";

describe("issue #188", () => {
  it("gives the residual deviance as Cp of a model without parameters", () => {
    // R 4.5.2: anova(glm(1e154 ~ 0, gaussian("log")), test = "Cp") gives Cp NaN (2 * 1e308 * 0); was NaN here
    const fit = glm([[]], [1e154], { family: "gaussian", link: "log", intercept: false });
    const t = glmAnova(fit, { test: "Cp" }).table;
    expect(t[0]![3]).toBe(1e308);
    expect(t[0]![4]).toBe(1e308);
  });

  it("keeps the values where 2 * dispersion does not overflow", () => {
    // values before the fix
    const cp = (f: ReturnType<typeof glm>) => glmAnova(f, { test: "Cp" }).table.map((r) => r[4]);
    expect(cp(glm([[1], [2], [3], [4]], [1, 3, 2, 5], { family: "poisson" }))).toEqual([5.203421521662885, 4.950895493471682]);
    expect(cp(glm([[1], [2], [3], [4]], [1, 3, 2, 5], { family: "Gamma" }))).toEqual([1.7871822603668452, 1.451601910333297]);
    expect(cp(glm([[1], [2], [3], [4], [5]], [1.3, 3.1, 2.2, 5.7, 4.1]))).toEqual([14.930666666666667, 11.489333333333338]);
  });
});

// Issue #189: the gaussian AIC where 2 pi deviance overflows (review_fix_log_issue189.md).
import { describe, expect, it } from "vitest";
import { glm } from "../src/index.js";

describe("issue #189", () => {
  it("gives the finite AIC where 2 pi deviance overflows", () => {
    // R 4.5.2: AIC(glm(y ~ 0, gaussian("log"))) with y = 1e154 is Inf; was Infinity here.
    // Rmpfr (200 bits) with the deviance's double: log(2 pi dev) + 3 = 714.03408570857541617
    const a = glm([[]], [1e154], { family: "gaussian", link: "log", intercept: false });
    expect(a.deviance).toBe(1e308);
    expect(a.aic).toBe(714.0340857085754);
    // two rows (deviance 1.01e308): 2 (log(2 pi dev / 2) + 1) + 2 = 1424.7017777177372778 (Rmpfr)
    const b = glm([[], []], [1e154, 1e153], { family: "gaussian", link: "log", intercept: false });
    expect(b.aic).toBe(1424.7017777177373);
  });

  it("keeps the AIC where 2 pi deviance is finite", () => {
    // values before the fix
    const x = [[1], [2], [3], [4], [5]];
    const y = [1.3, 3.1, 2.2, 5.7, 4.1];
    expect(glm(x, y, { family: "gaussian", link: "log" }).aic).toBe(20.69517852756981);
    expect(glm(x, y, { family: "gaussian", weights: [1, 2, 3, 0, 1] }).aic).toBe(13.951501536503502);
    expect(glm(x, y.map((v) => v * 1e200), { family: "gaussian" }).aic).toBe(4625.282987799578);
  });
});

import { describe, expect, it } from "vitest";
import { manova, summaryManova } from "../src/entries/multivariate.js";

describe("manova", () => {
  const data = {
    y1: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13],
    y2: [3, 2, 4, 5, 4, 6, 7, 8, 7, 9, 10, 8],
    group: ["a", "a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "b"],
  };
  it("fits sequential terms and returns all four multivariate summaries", () => {
    const fit = manova("cbind(y1, y2) ~ group", data);
    const s = summaryManova(fit);
    expect(s.Pillai.rows).toEqual(["group", "Residuals"]);
    expect(s.Pillai.cols).toEqual(["Df", "Pillai", "approx F", "num Df", "den Df", "Pr(>F)"]);
    expect(s.Wilks.values[0]![1]).toBeGreaterThan(0);
    expect(s["Hotelling-Lawley"].values[0]![1]).toBeGreaterThan(0);
    expect(s.Roy.values[0]![1]).toBeGreaterThan(0);
    expect(s.royFIsUpperBound).toBe(true);
    expect(s.SS.Residuals!.values).toHaveLength(2);
    expect(s.coef.rows).toContain("(Intercept)");
  });
  it("adds the sequential intercept row only when requested", () => {
    const fit = manova("cbind(y1, y2) ~ group", data);
    expect(summaryManova(fit).Pillai.rows).toEqual(["group", "Residuals"]);
    expect(summaryManova(fit, { intercept: true }).Pillai.rows).toEqual(["(Intercept)", "group", "Residuals"]);
  });
  it("rejects one response and residual SSP rank deficiency", () => {
    expect(() => manova("cbind(y1) ~ group", data)).toThrow(/need multiple responses/);
    const collinear = { ...data, y2: data.y1.map((v) => 2 * v) };
    expect(() => manova("cbind(y1, y2) ~ group", collinear)).toThrow(/residuals have rank/);
  });
  it("supports derived responses and extreme response scales", () => {
    const d = { ...data, y3: data.y1.map((v, i) => v + data.y2[i]!) };
    expect(() => manova("cbind(y1, y2, I(y1 + y2)) ~ group", d)).toThrow(/residuals have rank 2 < 3/);
    const scaled = { ...data, y1: data.y1.map((v) => v * 1e100), y2: data.y2.map((v) => v * 1e-100) };
    expect(() => manova("cbind(y1, y2) ~ group", scaled)).not.toThrow();
  });
});

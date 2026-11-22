import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { manova, manovaSummary } from "../src/entries/multivariate.js";

/** R's JSON (jsonlite, auto_unbox) has a scalar for a vector of one; rStats.js always returns arrays */
const boxed = <T>(v: T | T[] | null): T[] | null => (v === null ? null : Array.isArray(v) ? v : [v]);

const irisRows = JSON.parse(readFileSync(new URL("./fixtures/iris.json", import.meta.url), "utf8")) as [number, number, number, number, string][];
const irisData = {
  "Sepal.Length": irisRows.map((r) => r[0]),
  "Sepal.Width": irisRows.map((r) => r[1]),
  "Petal.Length": irisRows.map((r) => r[2]),
  "Petal.Width": irisRows.map((r) => r[3]),
  Species: irisRows.map((r) => r[4]),
};
const manovaFixture = JSON.parse(readFileSync(new URL("./fixtures/manova.json", import.meta.url), "utf8")) as Record<string, any>;
const mtRows = JSON.parse(readFileSync(new URL("./fixtures/mtcars.json", import.meta.url), "utf8")) as number[][];
const mtcarsData = {
  mpg: mtRows.map((r) => r[0]!),
  cyl: mtRows.map((r) => String(r[1]!)),
  disp: mtRows.map((r) => r[2]!),
  hp: mtRows.map((r) => r[3]!),
  drat: mtRows.map((r) => r[4]!),
  wt: mtRows.map((r) => r[5]!),
  qsec: mtRows.map((r) => r[6]!),
  vs: mtRows.map((r) => r[7]!),
  am: mtRows.map((r) => String(r[8]!)),
  gear: mtRows.map((r) => String(r[9]!)),
  carb: mtRows.map((r) => r[10]!),
};
function compareManovaSummary(actual: ReturnType<typeof manovaSummary>, expected: any): void {
  for (const key of ["Pillai", "Wilks", "Hotelling-Lawley", "Roy"] as const) compareTable(actual[key], expected[key].value);
  for (const key of Object.keys(expected.SS)) compareTable(actual.SS[key]!, expected.SS[key]);
  compareTable(actual.Eigenvalues, expected.Eigenvalues);
  compareTable(actual.coef, expected.coef);
}

function compareTable(actual: { rows: string[] | string; cols: string[] | string | null; values: number[][] }, expected: any): void {
  expect(actual.rows).toEqual(boxed(expected.rows));
  expect(actual.cols).toEqual(boxed(expected.cols));
  expect(actual.values.length).toBe(expected.values.length);
  for (let i = 0; i < expected.values.length; i++) {
    expect(actual.values[i]!.length).toBe(expected.values[i]!.length);
    for (let j = 0; j < expected.values[i]!.length; j++) {
      const e = expected.values[i]![j];
      const a = actual.values[i]![j]!;
      if (e === "NA" || e === "NaN" || e === null) expect(Number.isNaN(a)).toBe(true);
      // relative 1e-10: the (Intercept) row of manova_iris_intercept (F about 5e3) differs from R by 1.8e-11 relative; the
      // other rows agree to about 1e-14 (oracle/manova-behaviour.md)
      else expect(Math.abs(a - e)).toBeLessThanOrEqual(1e-10 + 1e-10 * Math.abs(e));
    }
  }
}

describe("manova", () => {
  const data = {
    y1: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13],
    y2: [3, 2, 4, 5, 4, 6, 7, 8, 7, 9, 10, 8],
    group: ["a", "a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "b"],
  };
  it("matches every Iris MANOVA summary, SSP, eigenvalue and coefficient entry", () => {
    const expected = manovaFixture.manova_iris.value;
    const fit = manova("cbind(Sepal.Length, Sepal.Width, Petal.Length, Petal.Width) ~ Species", irisData);
    const summary = manovaSummary(fit);
    compareManovaSummary(summary, expected);
    expect(summary.royFIsUpperBound).toBe(true);
  });

  it("fits sequential terms and returns all four multivariate summaries", () => {
    const fit = manova("cbind(y1, y2) ~ group", data);
    const s = manovaSummary(fit);
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
    expect(manovaSummary(fit).Pillai.rows).toEqual(["group", "Residuals"]);
    expect(manovaSummary(fit, { intercept: true }).Pillai.rows).toEqual(["(Intercept)", "group", "Residuals"]);
  });
  it("rejects one response and residual SSP rank deficiency", () => {
    expect(() => manova("cbind(y1) ~ group", data)).toThrow(/need multiple responses/);
    const collinear = { ...data, y2: data.y1.map((v) => 2 * v) };
    expect(() => manova("cbind(y1, y2) ~ group", collinear)).toThrow(/residuals have rank/);
  });
  it("matches the Iris MANOVA fixture with the sequential intercept row", () => {
    const fit = manova("cbind(Sepal.Length, Sepal.Width, Petal.Length, Petal.Width) ~ Species", irisData);
    compareManovaSummary(manovaSummary(fit, { intercept: true }), manovaFixture.manova_iris_intercept.value);
  });

  it("matches the full set of two-factor, interaction, covariate and df MANOVA fixtures", () => {
    const cases: Array<[string, string, Record<string, any>, { tol?: number }?]> = [
      ["manova_two_factors", "cbind(mpg, disp, hp) ~ cyl + am", mtcarsData],
      ["manova_two_factors_reversed", "cbind(mpg, disp, hp) ~ am + cyl", mtcarsData],
      ["manova_interaction", "cbind(mpg, qsec) ~ am * gear", mtcarsData],
      ["manova_covariate", "cbind(mpg, disp, hp) ~ wt + cyl", mtcarsData],
      ["manova_two_responses_two_groups", "cbind(mpg, hp) ~ am", mtcarsData],
      ["manova_p_gt_df", "cbind(mpg, disp, hp, drat, wt) ~ am", mtcarsData],

    ];
    for (const [key, formula, data, options] of cases) {
      const fit = manova(formula, data, options ?? {});
      compareManovaSummary(manovaSummary(fit), manovaFixture[key].value);
    }
    compareManovaSummary(manovaSummary(manova("cbind(mpg, disp, hp) ~ cyl", mtcarsData), { tol: 0.5 }), manovaFixture.manova_tol.value);
    const missing = { ...mtcarsData, mpg: mtcarsData.mpg.map((v, i) => i === 2 ? NaN : v) };
    compareManovaSummary(manovaSummary(manova("cbind(mpg, disp, hp) ~ cyl", missing)), manovaFixture.manova_na.value);
    compareManovaSummary(manovaSummary(manova("cbind(mpg * 1e100, disp, hp * 1e-100) ~ cyl", mtcarsData)), manovaFixture.manova_scale.value);
    expect(() => manova("cbind(mpg) ~ cyl", mtcarsData)).toThrow(/need multiple responses/);
    expect(() => manova("cbind(mpg, disp, hp, drat, wt, qsec) ~ cyl", Object.fromEntries(
      Object.entries(mtcarsData).map(([k, v]) => [k, v.slice(0, 8)]),
    ))).toThrow(/residuals have rank/);
    expect(() => manova("cbind(mpg, disp, I(mpg + disp)) ~ cyl", mtcarsData)).toThrow(/residuals have rank 2 < 3/);
  });

  it("handles 100,000 observations", () => {
    const n = 100_000;
    const d = {
      y1: Array.from({ length: n }, (_, i) => Math.sin(i * 0.01) + (i % 2)),
      y2: Array.from({ length: n }, (_, i) => Math.cos(i * 0.013) + (i % 2) * 0.7),
      group: Array.from({ length: n }, (_, i) => i % 2 ? "b" : "a"),
    };
    const start = performance.now();
    const fit = manova("cbind(y1, y2) ~ group", d);
    const s = manovaSummary(fit);
    expect(s.Pillai.values[0]![1]).toBeGreaterThan(0);
    console.info(`manova 100,000 rows: ${(performance.now() - start).toFixed(1)} ms`);
  });
  it("supports derived responses and extreme response scales", () => {
    const d = { ...data, y3: data.y1.map((v, i) => v + data.y2[i]!) };
    expect(() => manova("cbind(y1, y2, I(y1 + y2)) ~ group", d)).toThrow(/residuals have rank 2 < 3/);
    const scaled = { ...data, y1: data.y1.map((v) => v * 1e100), y2: data.y2.map((v) => v * 1e-100) };
    expect(() => manova("cbind(y1, y2) ~ group", scaled)).not.toThrow();
  });

  it("preserves MANOVA statistics at extreme response scales and tiny within-group residuals", () => {
    const base = manovaSummary(manova("cbind(y1, y2) ~ group", data));
    for (const exponent of [500, -500, 1000, -1000]) {
      const factor = 2 ** exponent;
      const scaled = {
        ...data,
        y1: data.y1.map((v) => v * factor),
        y2: data.y2.map((v) => v / factor),
      };
      const summary = manovaSummary(manova("cbind(y1, y2) ~ group", scaled));
      for (const key of ["Pillai", "Wilks", "Hotelling-Lawley", "Roy"] as const) {
        expect(summary[key].values[0]![1]).toBeCloseTo(base[key].values[0]![1]!, 8);
        expect(summary[key].values[0]![2]).toBeCloseTo(base[key].values[0]![2]!, 8);
      }
    }
    const tiny = {
      ...data,
      y1: data.y1.map((v) => v * 1e-310),
      y2: data.y2.map((v) => v * 1e-310),
    };
    const tinySummary = manovaSummary(manova("cbind(y1, y2) ~ group", tiny));
    expect(tinySummary.Pillai.values[0]![1]).toBeCloseTo(base.Pillai.values[0]![1]!, 8);
    expect(tinySummary.Pillai.values[0]![2]).toBeCloseTo(base.Pillai.values[0]![2]!, 8);
  });

  it("keeps Pillai and Wilks F approximations finite when roots dwarf residuals", () => {
    const pattern1 = Array.from({ length: 50 }, (_, i) => (i % 5 - 2) * 1e135);
    const pattern2 = Array.from({ length: 50 }, (_, i) => ([2, -1, 1, -2, 0][i % 5]!) * 1e135);
    const d = {
      y1: [...pattern1, ...pattern1.map((v) => 1e150 + v)],
      y2: [...pattern2, ...pattern2.map((v) => 1e150 + v)],
      group: [...Array(50).fill("a"), ...Array(50).fill("b")],
    };
    const summary = manovaSummary(manova("cbind(y1, y2) ~ group", d));
    expect(Number.isFinite(summary.Pillai.values[0]![2])).toBe(true);
    expect(summary.Pillai.values[0]![2]).toBeGreaterThan(1e28);
    expect(Number.isFinite(summary.Wilks.values[0]![2])).toBe(true);
    expect(summary.Wilks.values[0]![2]).toBeGreaterThan(1e28);
    expect(summary.Pillai.values[0]![5]).toBe(0);
  });
});

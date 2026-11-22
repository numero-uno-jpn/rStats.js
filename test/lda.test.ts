import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { lda, ldaPredict, type LdaFit } from "../src/entries/multivariate.js";

const x = [
  [1, 2], [1.2, 2.1], [0.8, 1.8], [1.1, 2.2], [0.9, 1.9], [1.3, 2.0],
  [4, 5], [4.2, 5.1], [3.8, 4.8], [4.1, 5.2], [3.9, 4.9], [4.3, 5.0],
];
const g = ["a", "a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "b"];

const irisRows = JSON.parse(readFileSync(new URL("./fixtures/iris.json", import.meta.url), "utf8")) as [number, number, number, number, string][];
const irisData = {
  "Sepal.Length": irisRows.map((r) => r[0]),
  "Sepal.Width": irisRows.map((r) => r[1]),
  "Petal.Length": irisRows.map((r) => r[2]),
  "Petal.Width": irisRows.map((r) => r[3]),
  Species: irisRows.map((r) => r[4]),
};
const ldaFixture = JSON.parse(readFileSync(new URL("./fixtures/lda.json", import.meta.url), "utf8")) as Record<string, any>;
const mtRows = JSON.parse(readFileSync(new URL("./fixtures/mtcars.json", import.meta.url), "utf8")) as number[][];
function compareLdaFit(actual: LdaFit, expected: any, warnings: any = []): void {
  expect(actual.prior.length).toBe(expected.prior.length);
  expected.prior.forEach((v: number, i: number) => expect(actual.prior[i]).toBeCloseTo(v, 9));
  expect(actual.counts).toEqual(expected.counts);
  expect(actual.means.rows).toEqual(expected.means.rows);
  expect(actual.means.cols).toEqual(expected.means.cols);
  expectMatrixClose(actual.means.values, expected.means.values, 1e-8);
  expect(actual.scaling.rows).toEqual(expected.scaling.rows);
  expect(actual.scaling.cols).toEqual(expected.scaling.cols);
  const signs = expected.scaling.values[0]!.map((_: number, j: number) => {
    const dot = actual.scaling.values.reduce((s, row, i) => s + row[j]! * expected.scaling.values[i]![j]!, 0);
    return dot < 0 ? -1 : 1;
  });
  expectMatrixClose(actual.scaling.values.map((row) => row.map((v, j) => v * signs[j]!)), expected.scaling.values, 1e-8);
  const svd = Array.isArray(actual.svd) ? actual.svd : [actual.svd];
  const expectedSvd = Array.isArray(expected.svd) ? expected.svd : [expected.svd];
  expect(svd).toHaveLength(expectedSvd.length);
  expectedSvd.forEach((v: number, i: number) => expect(svd[i]).toBeCloseTo(v, 8));
  expect(actual.N).toBe(expected.N);
  expect(actual.lev).toEqual(expected.lev);
  const expectedWarnings = Array.isArray(warnings) ? warnings : warnings ? [warnings] : [];
  expect(actual.warnings).toEqual(expectedWarnings);
}
function compareLdaPrediction(actual: ReturnType<typeof ldaPredict>, expected: any): void {
  expect(actual.class).toEqual(expected.class);
  expect(actual.posterior.cols).toEqual(expected.posterior.cols);
  expectMatrixClose(actual.posterior.values, expected.posterior.values, 1e-8);
  expect(actual.x.cols).toEqual(expected.x.cols);
  const signs = expected.x.values[0]!.map((_: number, j: number) => {
    const dot = actual.x.values.reduce((s, row, i) => s + row[j]! * expected.x.values[i]![j]!, 0);
    return dot < 0 ? -1 : 1;
  });
  expectMatrixClose(actual.x.values.map((row) => row.map((v, j) => v * signs[j]!)), expected.x.values, 1e-8);
}

function expectMatrixClose(actual: number[][], expected: number[][], tol = 1e-8): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]!.length).toBe(expected[i]!.length);
    for (let j = 0; j < expected[i]!.length; j++) {
      const e = expected[i]![j]!;
      expect(Math.abs(actual[i]![j]! - e)).toBeLessThanOrEqual(tol * Math.max(Math.abs(e), 1e-300));
    }
  }
}

describe("lda", () => {
  it("matches mtcars two-class, three-class and two-class CV fixtures", () => {
    const col = (j: number) => mtRows.map((r) => r[j]!);
    const x2 = mtRows.map((r) => [r[0]!, r[3]!, r[5]!]);
    const g2 = col(8).map(String);
    const fit2 = lda(x2, g2, { xNames: ["mpg", "hp", "wt"] });
    const e2 = ldaFixture.lda_two_classes.value;
    compareLdaFit(fit2, e2.fit, ldaFixture.lda_two_classes.warnings);
    compareLdaPrediction(ldaPredict(fit2), e2.pred);

    const x3 = mtRows.map((r) => [r[0]!, r[2]!, r[3]!, r[5]!]);
    const g3 = col(1).map(String);
    const fit3 = lda(x3, g3, { xNames: ["mpg", "disp", "hp", "wt"] });
    const e3 = ldaFixture.lda_three_cyl.value;
    compareLdaFit(fit3, e3.fit, ldaFixture.lda_three_cyl.warnings);
    compareLdaPrediction(ldaPredict(fit3), e3.pred);

    const cv = lda(x2, g2, { xNames: ["mpg", "hp", "wt"], CV: true });
    const ecv = ldaFixture.lda_cv_two_classes.value;
    expect(cv.class).toEqual(ecv.class);
    expect(cv.posterior.cols).toEqual(ecv.posterior.cols);
    expectMatrixClose(cv.posterior.values, ecv.posterior.values, 1e-8);
  });

  it("matches the complete Iris LDA fit fixture after per-column sign alignment", () => {
    const x = irisRows.map((r) => [r[0], r[1], r[2], r[3]]);
    const g = irisRows.map((r) => r[4]);
    const names = ["Sepal.Length", "Sepal.Width", "Petal.Length", "Petal.Width"];
    const fit = lda(x, g, { xNames: names });
    compareLdaFit(fit, ldaFixture.lda_iris.value.fit, ldaFixture.lda_iris.warnings);
    compareLdaPrediction(ldaPredict(fit), ldaFixture.lda_iris.value.pred);
    const formulaFit = lda("Species ~ .", irisData);
    compareLdaFit(formulaFit, ldaFixture.lda_iris_formula.value.fit, ldaFixture.lda_iris_formula.warnings);
    compareLdaPrediction(ldaPredict(formulaFit), ldaFixture.lda_iris_formula.value.pred);
  });

  it("matches Iris LDA predictions and leave-one-out CV fixture values", () => {
    const fit = lda("Species ~ .", irisData);
    const expected = ldaFixture.lda_iris_newdata.value;
    const newdata = [0, 50, 100, 149].map((i) => { const r = irisRows[i]!; return [r[0], r[1], r[2], r[3]]; });
    const pred = ldaPredict(fit, { newdata });
    expect(pred.class).toEqual(expected.class);
    expect(pred.posterior.cols).toEqual(expected.posterior.cols);
    expectMatrixClose(pred.posterior.values, expected.posterior.values, 1e-8);
    expect(pred.x.cols).toEqual(expected.x.cols);
    const expectedScores = expected.x.values as number[][];
    const signs = expectedScores[0]!.map((_, j) => {
      const dot = pred.x.values.reduce((s, row, i) => s + row[j]! * expectedScores[i]![j]!, 0);
      return dot < 0 ? -1 : 1;
    });
    expectMatrixClose(pred.x.values.map((row) => row.map((v, j) => v * signs[j]!)), expectedScores, 1e-8);

    const cvExpected = ldaFixture.lda_iris_cv.value;
    const cv = lda("Species ~ .", irisData, { CV: true });
    expect(cv.class).toEqual(cvExpected.class);
    expect(cv.posterior.cols).toEqual(cvExpected.posterior.cols);
    expectMatrixClose(cv.posterior.values, cvExpected.posterior.values, 1e-8);
  });

  it("matches LDA empty-level, collinear, singleton, missing and scale fixtures", () => {
    const names = ["Sepal.Length", "Sepal.Width", "Petal.Length", "Petal.Width"];
    const xx = irisRows.map((r) => [r[0], r[1], r[2], r[3]]);
    const gg = irisRows.map((r) => r[4]);
    const empty = lda(xx, gg, { xNames: names, groupLevels: ["setosa", "versicolor", "virginica", "none"] });
    compareLdaFit(empty, ldaFixture.lda_empty_level.value, ldaFixture.lda_empty_level.warnings);
    const collinearX = xx.map((r) => [...r, r[0]! + r[1]!]);
    const collinear = lda(collinearX, gg, { xNames: [...names, "s"] });
    compareLdaFit(collinear, ldaFixture.lda_collinear.value, ldaFixture.lda_collinear.warnings);
    const classOfOne = [...gg.slice(0, 149), "lone"];
    compareLdaFit(lda(xx, classOfOne, { xNames: names }), ldaFixture.lda_class_of_one.value, ldaFixture.lda_class_of_one.warnings);
    const missingData = { ...irisData, "Sepal.Width": irisData["Sepal.Width"].map((v, i) => i === 4 ? NaN : v) };
    compareLdaFit(lda("Species ~ .", missingData), ldaFixture.lda_na.value, ldaFixture.lda_na.warnings);
    const scaledX = xx.map((r) => [r[0]! * 1e100, r[1]!, r[2]!, r[3]!]);
    const scaled = lda(scaledX, gg, { xNames: names });
    compareLdaFit(scaled, ldaFixture.lda_scale.value.fit, ldaFixture.lda_scale.warnings);
    compareLdaPrediction(ldaPredict(scaled), ldaFixture.lda_scale.value.pred);
    const single = lda(xx.map((r) => [r[0]!]), gg, { xNames: ["Sepal.Length"] });
    compareLdaFit(single, ldaFixture.lda_single_variable.value.fit, ldaFixture.lda_single_variable.warnings);
    compareLdaPrediction(ldaPredict(single), ldaFixture.lda_single_variable.value.pred);
    const constantX = xx.map((r, i) => [r[0]!, ["setosa", "versicolor", "virginica"].indexOf(gg[i]!) + 1, r[2]!, r[3]!]);
    expect(() => lda(constantX, gg, { xNames: names })).toThrow("variable 2 appears to be constant within groups");
    expect(() => lda(xx, gg, { xNames: names, tol: 0.5 })).toThrow("variables 2 3 4 appear to be constant within groups");
  });

  it("fits moment LDA with metric-normalised directions and deterministic signs", () => {
    const fit = lda(x, g);
    expect(fit.lev).toEqual(["a", "b"]);
    expect(fit.counts).toEqual([6, 6]);
    expect(fit.scaling.cols).toBe("LD1");
    const v = fit.scaling.values.map((r) => r[0]!);
    const maxIndex = v.reduce((m, z, i) => Math.abs(z) > Math.abs(v[m]!) ? i : m, 0);
    expect(v[maxIndex]).toBeGreaterThan(0);
    expect(Number.isFinite(fit.svd)).toBe(true);
  });
  it("predicts classes, posterior probabilities and discriminant scores", () => {
    const fit = lda(x, g, { CV: false });
    const p = ldaPredict(fit, { newdata: [[1, 2], [4, 5]] });
    expect(p.class).toEqual(["a", "b"]);
    expect(p.posterior.values[0]!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(p.x.values).toHaveLength(2);
    const prior = ldaPredict(fit, { newdata: [[1, 2]], prior: [0.2, 0.8] });
    expect(prior.posterior.values[0]!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
  it("supports formula input and leave-one-out CV", () => {
    const data = { a: x.map((r) => r[0]!), b: x.map((r) => r[1]!), group: g };
    const fit = lda("group ~ a + b", data);
    expect(fit.lev).toEqual(["a", "b"]);
    const cv = lda("group ~ a + b", data, { CV: true }) as any;
    expect(cv.class).toHaveLength(12);
    expect(cv.posterior.values).toHaveLength(12);
  });
  it("accepts a singleton class and rejects constant within-class predictors", () => {
    const singleton = lda([...x, [8, 8]], [...g, "c"]);
    expect(singleton.counts).toEqual([6, 6, 1]);
    expect(() => lda([[1], [1], [2], [2]], ["a", "a", "b", "b"])).toThrow(/constant within groups/);
  });
  it("drops and warns about declared empty class levels", () => {
    const fit = lda(x, g, { groupLevels: ["a", "b", "none"] });
    expect(fit.lev).toEqual(["a", "b", "none"]);
    expect(fit.warnings).toEqual(["group none is empty"]);
    const formula = lda("group ~ a + b", { a: x.map((r) => r[0]!), b: x.map((r) => r[1]!), group: g },
      { levels: { group: ["a", "b", "none"] } });
    expect(formula.lev).toEqual(["a", "b", "none"]);
    expect(formula.warnings).toEqual(["group none is empty"]);
  });
  it("warns for exact collinearity and rejects variables lost only to a loose tolerance", () => {
    const xx = x.map((r) => [r[0]!, r[1]!, r[0]! + r[1]!]);
    const fit = lda(xx, g);
    expect(fit.warnings).toEqual(["variables are collinear"]);
    expect(fit.scaling.rows).toHaveLength(3);
    const nearly = x.map((r) => [r[0]!, r[0]! + 1e-6 * r[1]!]);
    expect(() => lda(nearly, g, { tol: 0.5 })).toThrow(/constant within groups/);
  });
  it("handles extreme scales and 100,000 observations", () => {
    const scaled = lda(x.map((r) => [r[0]! * 1e100, r[1]! * 1e-100]), g);
    expect((Array.isArray(scaled.svd) ? scaled.svd.every(Number.isFinite) : Number.isFinite(scaled.svd))).toBe(true);
    const xx = Array.from({ length: 100_000 }, (_, i) => [Math.sin(i * 0.01), Math.cos(i * 0.013)]);
    const gg = xx.map((_, i) => i % 2 ? "b" : "a");
    const start = performance.now();
    const fit = lda(xx, gg);
    expect(fit.N).toBe(100_000);
    console.info(`lda 100,000 rows: ${(performance.now() - start).toFixed(1)} ms`);
  });
});

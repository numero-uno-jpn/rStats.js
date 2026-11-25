import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { qcc, cusum, ewma, type QccStdDevMethod } from "../src/descriptive/qcc.js";
import { processCapability, mqcc, medianChart, ocCurves, paretoChart, qccGroups } from "../src/descriptive/qccTools.js";
import { btm, btAbilities, qvcalc, worstErrors } from "../src/models/bradleyterry.js";

// Edge cases of 1.18.0 (control charts, Bradley-Terry): scales, degenerate data, boundaries and errors.
const fq = JSON.parse(readFileSync(new URL("./fixtures/qcc.json", import.meta.url), "utf8")) as Record<string, any>;
const fb = JSON.parse(readFileSync(new URL("./fixtures/bradleyterry.json", import.meta.url), "utf8")) as Record<string, any>;
const bal = fq.data.mats.bal as number[][], x1 = fq.data.vecs.x1 as number[];
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Number.MIN_VALUE, Math.abs(b));

describe("control charts at extreme scales", () => {
  const methods: Record<"xbar" | "R" | "S", QccStdDevMethod[]> = {
    xbar: ["UWAVE-R", "UWAVE-SD", "MVLUE-R", "MVLUE-SD", "RMSDF"], R: ["UWAVE-R", "MVLUE-R"], S: ["UWAVE-SD", "MVLUE-SD", "RMSDF"],
  };
  it.each([1e150, 1e-150, 1e300, 1e-300])("scale %s: the same statistics, sigma and limits relative to the scale", (s) => {
    for (const type of ["xbar", "R", "S"] as const) for (const stdDev of methods[type]) {
      const a = qcc(bal, { type, stdDev }), b = qcc(bal.map((r) => r.map((v) => v * s)), { type, stdDev });
      b.statistics.forEach((v, i) => expect(rel(v / s, a.statistics[i]!)).toBeLessThan(1e-13));
      expect(rel((b.stdDev as number) / s, a.stdDev as number)).toBeLessThan(1e-13);
      expect(rel(b.limits.ucl[0]! / s, a.limits.ucl[0]!)).toBeLessThan(1e-13);
    }
    for (const stdDev of ["MR", "SD"] as const) {
      const a = qcc(x1, { type: "xbar.one", stdDev }), b = qcc(x1.map((v) => v * s), { type: "xbar.one", stdDev });
      expect(rel((b.stdDev as number) / s, a.stdDev as number)).toBeLessThan(1e-13);
    }
  });
  it("a common value of 1e8 keeps sigma", () => {
    for (const type of ["xbar", "R", "S"] as const) {
      const a = qcc(bal, { type }), b = qcc(bal.map((r) => r.map((v) => v + 1e8)), { type });
      expect(rel(b.stdDev as number, a.stdDev as number)).toBeLessThan(1e-7);
    }
  });
});

describe("control charts: degenerate data and boundaries", () => {
  it("constant data, p = 0 or 1, c = 0", () => {
    expect(qcc([[1, 1], [1, 1], [1, 1]], { type: "xbar" }).limits).toEqual({ lcl: [1], ucl: [1] });
    expect(qcc([[1, 1], [1, 1]], { type: "S", stdDev: "RMSDF" }).stdDev).toBe(0);
    expect(qcc([0, 0, 0], { type: "p", sizes: 10 }).limits).toEqual({ lcl: [0, 0, 0], ucl: [0, 0, 0] });
    expect(qcc([10, 10], { type: "p", sizes: 10 }).limits).toEqual({ lcl: [1, 1], ucl: [1, 1] });
    expect(qcc([0, 0, 0], { type: "c" }).limits).toEqual({ lcl: [0], ucl: [0] });
  });
  it("a g chart with mean below 1 gives NaN with R's warning", () => {
    const q = qcc([0, 1, 0, 1], { type: "g" });
    expect(q.stdDev).toBeNaN();
    expect(q.warnings).toContain("NaNs produced");
  });
  it("errors", () => {
    expect(() => qcc([[1, 2], [null, null], [3, 5]], { type: "xbar" })).toThrow("group sizes must be larger than one");
    expect(() => qcc([1, 2], { type: "p", sizes: [10] })).toThrow("one value per group");
    expect(() => qcc([1, 2], { type: "p" })).toThrow("sizes");
    expect(() => qcc([1, 2], { type: "xbar" })).toThrow("one row per group");
    expect(() => qcc([], { type: "c" })).toThrow("no data");
    expect(() => qcc(bal, { type: "xbar", confidenceLevel: 1 })).toThrow("(0, 1)");
    expect(() => qcc(bal, { type: "xbar", newdata: [1, 2] })).toThrow("form of data");
    expect(() => qcc([1, 2], { type: "p", sizes: [10, 12], newdata: [3] })).toThrow("newsizes");
    expect(() => ewma(x1, { lambda: 2 })).toThrow("[0, 1]");
    expect(() => cusum(x1, { headStart: 5 })).toThrow("head.start");
    expect(() => ocCurves(qcc(fq.data.mats.unb, { type: "xbar" }))).toThrow("equal sample sizes");
    expect(() => processCapability(qcc(bal, { type: "xbar" }), [4])).toThrow("[LSL, USL]");
  });
  it("runs, nsigmas 0, labels, decision interval at the boundary", () => {
    expect(qcc(x1.slice(0, 6), { type: "xbar.one", runLength: 1 }).violations.violatingRuns).toEqual([1, 2, 3, 4, 5, 6]);
    const z = qcc(x1.slice(0, 6), { type: "xbar.one", nsigmas: 0 });
    expect(z.limits.lcl[0]).toBe(z.limits.ucl[0]);
    expect(qcc(x1.slice(0, 3), { type: "xbar.one", labels: ["a", "b", "c"] }).labels).toEqual(["a", "b", "c"]);
    // pos reaches exactly h = 1.5 at the 3rd point: not a violation (strict, as qcc)
    expect(cusum([1, 1, 1, -1], { center: 0, stdDev: 1, decisionInterval: 1.5 }).violations.upper).toEqual([]);
  });
  it("NA statistics are left out of the violations (qcc puts NA into them)", () => {
    const v = qcc([1, NaN, 4, -4, 2], { type: "xbar.one", center: 0, stdDev: 1 }).violations;
    expect(v.beyondLimits).toEqual([3, 4]);
  });
  it("mqcc: a singular covariance matrix is an error", () => {
    expect(() => mqcc([[1, 2], [2, 4], [3, 6], [4, 8]], { type: "T2.single" })).toThrow("singular");
    expect(() => mqcc([[[1, 2], [3, 4]], [[1, 5], [2, 3]], [[4, 4], [2, 1]]], { type: "T2" })).toThrow("singular");
    expect(() => mqcc([], {})).toThrow("no data");
  });
  it("the median chart: the JIS factors, unequal sizes and sizes outside 2..10 are errors", () => {
    const m = medianChart([1, 2, 3, 2, 4, 6, 3, 3, 9], [1, 1, 1, 2, 2, 2, 3, 3, 3]);
    expect(m.medians).toEqual([2, 4, 3]);
    expect(m.ranges).toEqual([2, 4, 6]);
    expect(m.median.center).toBe(3);
    expect(m.median.ucl).toBeCloseTo(3 + 1.187 * 4, 14);
    expect(m.range.ucl).toBeCloseTo(2.574 * 4, 14);
    expect(m.range.lcl).toBe(0);
    expect(medianChart([1, 5, 2, 6], ["b", "a", "b", "a"]).groups).toEqual(["b", "a"]);
    expect(() => medianChart([1, 2, 3, 4, 5], ["a", "a", "b", "b", "b"])).toThrow("same size");
    expect(() => medianChart(Array.from({ length: 22 }, (_, i) => i), Array.from({ length: 22 }, (_, i) => (i < 11 ? "a" : "b")))).toThrow("between 2 and 10");
  });
  it("pareto and groups", () => {
    expect(paretoChart(Array.from({ length: 28 }, (_, i) => i)).names.slice(0, 3)).toEqual(["AB", "AA", "Z"]);
    expect(qccGroups([1, 2, 3], ["b", "a", "b"])).toEqual({ names: ["a", "b"], groups: [[2, NaN], [1, 3]] });
  });
});

describe("Bradley-Terry: edge cases", () => {
  const base = { outcome: ["win1", "win2"] as [string, string], player1: "player1", player2: "player2" };
  const D = fb.data;
  it("separation warns as glm; disconnected players give NaN (R's NA) with aligned standard errors", () => {
    const sep = btm({ player1: ["A", "A", "B"], player2: ["B", "C", "C"], win1: [5, 5, 3], win2: [0, 0, 2] }, base);
    expect(sep.warnings.some((w) => w.includes("separated"))).toBe(true);
    const dis = btm({ player1: ["A", "C"], player2: ["B", "D"], win1: [3, 4], win2: [2, 1] }, base);
    expect(dis.coefficients[2]).toBeNaN();
    expect(dis.stdError[2]).toBeNaN();
    expect(dis.stdError[0]).toBeGreaterThan(0);
  });
  it("a player without contests: NaN ability for that player only", () => {
    const f = btm(D.agg, { ...base, levels: [...D.levels, "F"] });
    const a = btAbilities(f);
    expect(a.ability[5]).toBeNaN();
    expect(a.ability.slice(0, 5).every(Number.isFinite)).toBe(true);
  });
  it("counts times 1e6 and covariates times 1e+-6 give the same fit", () => {
    const g = btm(D.agg, { ...base, levels: D.levels });
    const f = btm({ ...D.agg, win1: D.agg.win1.map((v: number) => v * 1e6), win2: D.agg.win2.map((v: number) => v * 1e6) }, { ...base, levels: D.levels });
    f.coefficients.forEach((v, i) => expect(rel(v, g.coefficients[i]!)).toBeLessThan(1e-9));
    const opts = { ...base, levels: D.levels3, formula: "~ x[..] + (1 | ..)" };
    const p0 = btm(D.cov3, { ...opts, predictors: D.preds });
    for (const s of [1e6, 1e-6]) {
      const p = btm(D.cov3, { ...opts, predictors: { x: D.preds.x.map((v: number) => v * s) } });
      expect(rel(p.coefficients[0]! * s, p0.coefficients[0]!)).toBeLessThan(1e-12);
      expect(rel(p.sigma!, p0.sigma!)).toBeLessThan(1e-12);
    }
  });
  it("errors", () => {
    expect(() => btm(D.agg, { ...base, refcat: "Z" })).toThrow("refcat");
    expect(() => btm(D.agg, { ...base, formula: "~ log(x)" })).toThrow("unsupported term");
    expect(() => btm(D.cov3, { ...base, formula: "~ x[..] + (1 | ..)" })).toThrow("predictors");
    expect(() => btm(D.cov3, { ...base, levels: D.levels3, formula: "~ x[..] + (1 | ..)", predictors: { x: D.levels3.map(() => 1) } })).toThrow("not identifiable");
    expect(() => qvcalc({ estimate: [0, 1], vcov: [[0, 0], [0, 1]] })).toThrow("3 levels");
    const dis = btm({ player1: ["A", "C", "A"], player2: ["B", "D", "B"], win1: [3, 4, 1], win2: [2, 1, 2] }, base);
    expect(() => qvcalc(btAbilities(dis))).toThrow("missing values");
  });
  it("three levels: quasi variances are exact", () => {
    const w = worstErrors(qvcalc({ estimate: [0, 1, 2], vcov: [[1, 0.2, 0.1], [0.2, 1, 0.3], [0.1, 0.3, 1]] }));
    expect(Math.abs(w[0])).toBeLessThan(1e-12);
    expect(Math.abs(w[1])).toBeLessThan(1e-12);
  });
});

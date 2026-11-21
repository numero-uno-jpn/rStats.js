import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rq, rqPredict, rqSummary, rqPredictInterval, rqAnova } from "../src/models/rq.js";


function solveSmall(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(m[i]![k]!) > Math.abs(m[pivot]![k]!)) pivot = i;
    [m[k], m[pivot]] = [m[pivot]!, m[k]!];
    const d = m[k]![k]!;
    if (Math.abs(d) < 1e-12) throw new RangeError("singular");
    for (let j = k; j <= n; j++) m[k]![j]! /= d;
    for (let i = 0; i < n; i++) if (i !== k) {
      const f = m[i]![k]!;
      for (let j = k; j <= n; j++) m[i]![j]! -= f * m[k]![j]!;
    }
  }
  return m.map((row) => row[n]!);
}

function bruteObjective(x: number[][], y: number[], weights: number[], tau: number): number {
  const p = x[0]!.length;
  let best = Infinity;
  const chosen: number[] = [];
  const visit = (start: number): void => {
    if (chosen.length === p) {
      try {
        const beta = solveSmall(chosen.map((i) => x[i]!), chosen.map((i) => y[i]!));
        let loss = 0;
        for (let i = 0; i < y.length; i++) {
          const residual = y[i]! - x[i]!.reduce((sum, value, j) => sum + value * beta[j]!, 0);
          loss += weights[i]! * residual * (tau - (residual < 0 ? 1 : 0));
        }
        best = Math.min(best, loss);
      } catch {
        // A singular subset is not a vertex.
      }
      return;
    }
    for (let i = start; i <= y.length - (p - chosen.length); i++) {
      chosen.push(i);
      visit(i + 1);
      chosen.pop();
    }
  };
  visit(0);
  return best;
}

const oracle = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/rq.json", import.meta.url)), "utf8")) as {
  data: { X: { values: number[][] }; y: number[] };
  br_0_25?: { value?: { coef: number[]; rho: number } };
};

describe("quantile regression", () => {
  it("matches the pinned R public-output cases for br", () => {
    const data = { x: oracle.data.X.values.map((row) => row[1]!), y: oracle.data.y };
    const expected = [
      { tau: 0.25, coef: [2, 0.8], rho: 8.05 },
      { tau: 0.5, coef: [4.2, 0.733333333333333], rho: 12.4333333333333 },
      { tau: 0.75, coef: [4.78571428571429, 0.928571428571428], rho: 8.03571428571429 },
    ];
    for (const item of expected) {
      const fit = rq("y ~ x", data, { tau: item.tau, method: "br", eps: 1e-10 });
      expect(fit.coefficients["(Intercept)"]).toBeCloseTo(item.coef[0]!, 7);
      expect(fit.coefficients.x).toBeCloseTo(item.coef[1]!, 7);
      expect(fit.rho).toBeCloseTo(item.rho, 7);
      expect(fit.converged).toBe(true);
    }
  });

  it("fits a one-column median and upper quantile", () => {
    const data = { y: [0, 0, 1] };
    const median = rq("y ~ 1", data, { tau: 0.5 });
    const upper = rq("y ~ 1", data, { tau: 0.75 });
    expect(median.coefficients["(Intercept)"]).toBeCloseTo(0, 8);
    expect(upper.coefficients["(Intercept)"]).toBeCloseTo(1, 8);
    expect(median.rho).toBeCloseTo(0.5, 8);
    expect(upper.rho).toBeCloseTo(0.5, 8);
    expect(median.converged).toBe(true);
    expect(upper.converged).toBe(true);
  });

  it("uses prior weights in the quantile objective", () => {
    const fit = rq("y ~ 1", { y: [0, 0, 1] }, { tau: 0.5, weights: [1, 1, 10] });
    expect(fit.coefficients["(Intercept)"]).toBeCloseTo(1, 8);
    expect(fit.rho).toBeCloseTo(1, 8);
  });

  it("fits several quantiles and predicts without a response column", () => {
    const fit = rq("y ~ x", { x: [0, 1, 2, 3, 4], y: [0, 1, 1, 3, 4] }, { tau: [0.25, 0.5, 0.75] });
    const predicted = rqPredict(fit, { x: [1, 2] });
    expect(Array.isArray(predicted[0])).toBe(true);
    expect((predicted as number[][]).length).toBe(3);
    expect((predicted as number[][])[0]!.length).toBe(2);
  });


  it("matches the fixture with the dual interior-point method", () => {
    const data = { x: oracle.data.X.values.map((row) => row[1]!), y: oracle.data.y };
    const fit = rq("y ~ x", data, { tau: 0.5, method: "fn", eps: 1e-12, maxit: 200 });
    expect(fit.coefficients["(Intercept)"]).toBeCloseTo(4.2, 7);
    expect(fit.coefficients.x).toBeCloseTo(0.733333333333333, 7);
    expect(fit.rho).toBeCloseTo(12.4333333333333, 8);
    expect(fit.converged).toBe(true);
  });

  it("agrees between vertex descent and the dual solver on a weighted two-predictor problem", () => {
    const data = {
      x: [0, 1, 2, 3, 4, 5, 6, 7],
      z: [0, 1, 0, 1, 0, 1, 0, 1],
      y: [2, 1, 5, 2, 7, 4, 9, 6],
    };
    const weights = [1, 2, 1, 3, 2, 1, 4, 2];
    for (const tau of [0.1, 0.5, 0.9]) {
      const br = rq("y ~ x + z", data, { tau, method: "br", weights, maxit: 500 });
      const fn = rq("y ~ x + z", data, { tau, method: "fn", weights, eps: 1e-12, maxit: 200 });
      expect(br.rho).toBeCloseTo(fn.rho as number, 9);
      expect(br.converged).toBe(true);
      expect(fn.converged).toBe(true);
    }
  });


  it("matches an independent vertex enumeration on a small tied weighted problem", () => {
    const data = {
      x: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      z: [0, 1, 0, 1, 1, 0, 1, 0, 1, 0],
      y: [1, 2, 2, 4, 3, 5, 5, 6, 7, 7],
    };
    const matrix = data.x.map((value, i) => [1, value, data.z[i]!]);
    const weights = [1, 2, 1, 3, 2, 1, 4, 2, 1, 3];
    for (const tau of [0.1, 0.5, 0.9]) {
      const expected = bruteObjective(matrix, data.y, weights, tau);
      for (const method of ["br", "fn"] as const) {
        const fit = rq("y ~ x + z", data, { tau, method, weights, maxit: 1000, eps: 1e-12 });
        expect(Math.abs((fit.rho as number) - expected) / Math.max(1, Math.abs(expected))).toBeLessThanOrEqual(1e-12);
      }
    }
  });

  it("agrees across random sizes, dimensions, quantiles, weights, and tied responses", () => {
    const cases = [
      { n: 20, p: 2, weighted: true, seed: 17 },
      { n: 200, p: 4, weighted: false, seed: 29 },
      { n: 2000, p: 8, weighted: true, seed: 43 },
    ];
    for (const item of cases) {
      let state = item.seed;
      const random = (): number => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const data: Record<string, number[]> = { y: [] };
      const predictors = Array.from({ length: item.p - 1 }, (_, j) => {
        const name = "x" + (j + 1);
        data[name] = [];
        return name;
      });
      const weights = new Array<number>(item.n);
      for (let i = 0; i < item.n; i++) {
        let response = 1.25;
        for (let j = 0; j < predictors.length; j++) {
          const value = random() * 2 - 1;
          data[predictors[j]!]!.push(value);
          response += (j + 1) * 0.12 * value;
        }
        data.y!.push(Math.round((response + (Math.floor(random() * 9) - 4) * 0.2) * 5) / 5);
        weights[i] = item.weighted ? 0.5 + random() * 2.5 : 1;
      }
      const formula = predictors.length === 0 ? "y ~ 1" : "y ~ " + predictors.join(" + ");
      for (const tau of [0.1, 0.5, 0.9]) {
        const br = rq(formula, data, { tau, method: "br", weights, maxit: 1000 });
        const fn = rq(formula, data, { tau, method: "fn", weights, maxit: 200, eps: 1e-12 });
        expect(Math.abs((br.rho as number) - (fn.rho as number)) /
          Math.max(1, Math.abs(br.rho as number), Math.abs(fn.rho as number))).toBeLessThanOrEqual(1e-12);
      }
    }
  });

  it("is equivariant to predictor columns scaled by 1e100 and 1e-100", () => {
    const data = { x: [0, 1, 2, 3, 4, 5], y: [0, 1, 1, 3, 4, 7] };
    const base = rq("y ~ x", data, { tau: 0.5, method: "fn" });
    for (const scale of [1e100, 1e-100]) {
      const fit = rq("y ~ x", { x: data.x.map((v) => v * scale), y: data.y }, { tau: 0.5, method: "fn" });
      expect(fit.coefficients["(Intercept)"]).toBeCloseTo(base.coefficients["(Intercept)"] as number, 8);
      expect((fit.coefficients.x as number) * scale).toBeCloseTo(base.coefficients.x as number, 8);
    }
  });

  it("fits 100000 rows with fn and records its elapsed time", () => {
    const n = 100000;
    const x1 = new Array<number>(n);
    const x2 = new Array<number>(n);
    const y = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      x1[i] = ((i * 37) % 1009) / 1009;
      x2[i] = ((i * 73) % 1013) / 1013;
      y[i] = 1.5 + 0.8 * x1[i]! - 0.4 * x2[i]! + 0.2 * (((i * 97) % 101) - 50) / 50;
    }
    const start = Date.now();
    const fit = rq("y ~ x1 + x2", { x1, x2, y }, { tau: 0.5, method: "fn", maxit: 200, eps: 1e-10 });
    const elapsed = Date.now() - start;
    console.log("rq fn 100000 x 3: " + elapsed + " ms");
    expect(fit.converged).toBe(true);
    expect(Number.isFinite(fit.rho as number)).toBe(true);
  });

  it("fits 10000 rows with br and records its elapsed time", () => {
    const n = 10000;
    const x1 = new Array<number>(n);
    const x2 = new Array<number>(n);
    const y = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      x1[i] = ((i * 37) % 1009) / 1009;
      x2[i] = ((i * 73) % 1013) / 1013;
      y[i] = 1.5 + 0.8 * x1[i]! - 0.4 * x2[i]! + 0.2 * (((i * 97) % 101) - 50) / 50;
    }
    const start = Date.now();
    const fit = rq("y ~ x1 + x2", { x1, x2, y }, { tau: 0.5, method: "br", maxit: 1000 });
    const elapsed = Date.now() - start;
    console.log("rq br 10000 x 3: " + elapsed + " ms");
    expect(fit.converged).toBe(true);
    expect(Number.isFinite(fit.rho as number)).toBe(true);
  });

  it("rejects tau outside the open unit interval and invalid weights", () => {
    expect(() => rq("y ~ 1", { y: [1, 2, 3] }, { tau: 1 })).toThrow(/tau/);
    expect(() => rq("y ~ 1", { y: [1, 2, 3] }, { weights: [1, -1, 1] })).toThrow(/weights/);
  });

  it("is equivariant to response scaling", () => {
    const data = { x: [0, 1, 2, 3, 4, 5], y: [0, 1, 1, 3, 4, 7] };
    const fit = rq("y ~ x", data, { tau: 0.5 });
    const scaled = rq("y ~ x", { x: data.x, y: data.y.map((v) => v * 1e100) }, { tau: 0.5 });
    for (const name of Object.keys(fit.coefficients)) {
      expect((scaled.coefficients[name] as number) / 1e100).toBeCloseTo(fit.coefficients[name] as number, 8);
    }
  });

  it("matches the Hall-Sheather nid covariance from the public oracle", () => {
    const data = { x: oracle.data.X.values.map((row) => row[1]!), y: oracle.data.y };
    const fit = rq("y ~ x", data, { tau: 0.5, method: "br" });

    const h = 0.385563455061825;
    const lowerFit = rq("y ~ x", data, { tau: 0.5 - h, method: "br" });
    const upperFit = rq("y ~ x", data, { tau: 0.5 + h, method: "br" });
    expect(lowerFit.coefficients["(Intercept)"]).toBeCloseTo(2, 13);
    expect(lowerFit.coefficients.x).toBeCloseTo(0.75, 13);
    expect(upperFit.coefficients["(Intercept)"]).toBeCloseTo(5, 13);
    expect(upperFit.coefficients.x).toBeCloseTo(1, 13);
    const summary = rqSummary(fit, { se: "nid", covariance: true });
    expect(summary.coefficients).toHaveLength(2);
    expect(summary.covariance![0]![0]![0]).toBeCloseTo(0.415407811808214, 11);
    expect(summary.covariance![0]![0]![1]).toBeCloseTo(-0.0376121265902385, 11);
    expect(summary.covariance![0]![1]![1]).toBeCloseTo(0.0200055184586616, 11);
  });

  it("returns none and direct confidence prediction intervals", () => {
    const data = { x: [0, 1, 2, 3, 4, 5, 6, 7], y: [2, 3, 3, 5, 5, 7, 8, 9] };
    const fit = rq("y ~ x", data, { tau: 0.5 });
    const none = rqPredictInterval(fit, { x: [1, 3, 5] }, { interval: "confidence", type: "none" });
    const direct = rqPredictInterval(fit, { x: [1, 3, 5] }, { interval: "confidence", type: "direct" });
    const fitted = none.fit as number[];
    const noneLower = none.lower as number[];
    const noneUpper = none.upper as number[];
    const directLower = direct.lower as number[];
    const directUpper = direct.upper as number[];
    expect(fitted).toHaveLength(3);
    expect(none.lower).toHaveLength(3);
    expect(none.upper).toHaveLength(3);
    expect(direct.lower).toHaveLength(3);
    expect(direct.upper).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(noneLower[i]!).toBeLessThanOrEqual(fitted[i]!);
      expect(noneUpper[i]!).toBeGreaterThanOrEqual(fitted[i]!);
      expect(directLower[i]!).toBeLessThanOrEqual(directUpper[i]!);
    }
  });

  it("summarises multiple tau fits with one nid covariance per tau", () => {
    const data = {
      x: Array.from({ length: 50 }, (_, i) => i / 10),
      y: Array.from({ length: 50 }, (_, i) => 1 + 0.8 * (i / 10) + ((i * 17) % 11 - 5) / 10),
    };
    const fit = rq("y ~ x", data, { tau: [0.25, 0.5, 0.75], method: "fn", eps: 1e-12 });
    const summary = rqSummary(fit, { se: "nid", covariance: true });
    expect(summary.coefficients).toHaveLength(6);
    expect(summary.covariance).toHaveLength(3);
    expect(summary.covariance![0]).toHaveLength(2);
    expect(summary.covariance![1]).toHaveLength(2);
    expect(summary.covariance![2]).toHaveLength(2);
    expect(() => rqSummary(rq("y ~ x", data, { tau: 0.5 }))).toThrow(/iid, rank, ker and boot remain unresolved/);
  });

  it("computes a Wald test for equality of slopes across quantiles", () => {
    const data = {
      x: Array.from({ length: 50 }, (_, i) => i / 10),
      y: Array.from({ length: 50 }, (_, i) => 1 + 0.8 * (i / 10) + ((i * 17) % 11 - 5) / 10),
    };
    const fit = rq("y ~ x", data, { tau: [0.25, 0.5, 0.75], method: "fn", eps: 1e-12 });
    const result = rqAnova(fit);
    expect(result.method).toBe("Wald");
    expect(result.df).toBe(2);
    expect(result.dfResidual).toBe(46);
    expect(result.pValue).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
    const single = rq("y ~ x", data, { tau: 0.5, method: "fn", eps: 1e-12 });
    const reduced = rq("y ~ 1", data, { tau: 0.5, method: "fn", eps: 1e-12 });
    const nested = rqAnova(single, reduced);
    expect(nested.method).toBe("Wald");
    expect(nested.df).toBe(1);
    expect(nested.dfResidual).toBe(48);
    expect(nested.pValue).toBeGreaterThanOrEqual(0);
    expect(nested.pValue).toBeLessThanOrEqual(1);
    const twoPredictorData = {
      x: Array.from({ length: 50 }, (_, i) => i / 10),
      z: Array.from({ length: 50 }, (_, i) => ((i * 13) % 37) / 10),
      y: Array.from({ length: 50 }, (_, i) => 1 + 0.5 * (i / 10) - 0.4 * (((i * 13) % 37) / 10) + ((i * 17) % 11 - 5) / 10),
    };
    const twoPredictorFit = rq("y ~ x + z", twoPredictorData, { tau: [0.25, 0.5, 0.75], method: "fn", eps: 1e-12 });
    const joint = rqAnova(twoPredictorFit, true);
    const separate = rqAnova(twoPredictorFit, false);
    expect(joint.df).toBe(4);
    expect(joint.dfResidual).toBe(176);
    if (!Array.isArray(separate)) throw new Error("joint=false must return separate Wald tests");
    expect(separate).toHaveLength(2);
    expect(separate[0]!.df).toBe(2);
    expect(separate[0]!.dfResidual).toBe(178);
    expect(separate[1]!.dfResidual).toBe(178);
  });

  it.todo("iid density estimator is unresolved pending the user's independent review");
  it.todo("rank interval endpoints are unresolved pending the user's independent review");
  it.todo("ker bandwidth and local density are unresolved pending R-output comparison");
  it.todo("bootstrap pwy, mcmb and wxy perturbation maps are unresolved pending the user's independent review");

});

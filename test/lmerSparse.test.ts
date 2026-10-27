// The sparse profiled deviance (src/models/mixedDeviance.ts) against the dense reference implementation
// (test/helpers/mixedDense.ts, the implementation of stages 1b and 1c), on data larger than the fixtures', built here
// with a seeded generator (oracle/lmer-behaviour.md "Sparse computation (stages S1 and S2)"): crossed (1 | s) + (1 | i),
// (x | s), a three-level nesting (1 | a/b/c), (x | s) + (1 | i) partially crossed, and a || model, at several θ (the
// initial θ, random values with negative off-diagonal elements, a diagonal element at 0), REML and ML. Tolerances:
// deviance relative 1e-13; beta, u, b and the gradient each element within 1e-11 × the largest absolute element of the
// dense result. Also compared, with the same tolerances: rss, ussq, prss (relative 1e-13), logDetL, logDetRX
// (absolute 1e-13 × max(1, |value|)) and (R_X'R_X)⁻¹ (1e-11 × its largest absolute element).
//
// Also full lmer fits on these data (models of moderate q, as the dense reference costs q³ per evaluation; REML and
// ML) against fits that minimise the criterion of the dense reference with its gradient (lmerWithCriterion), with the
// tolerances of the fixtures (test/lmer.test.ts): logLik, AIC, BIC, deviance, REMLcrit relative 1e-12; theta, fixef,
// stdError, tValue, vcov, varCorr sd, ranef values, fitted, residuals within 1e-9 × the largest absolute value of the
// dense fit's vector or matrix; sigma relative 1e-9; varCorr corr absolute 1e-9; elements of theta that are 0 in one
// fit exactly 0 in the other; singular and messages equal.
import { describe, expect, it } from "vitest";
import { lmer, lmerWithCriterion, type LmerResult, type MixedCriterion } from "../src/models/lmer.js";
import { profiledDeviance, type ProfiledDeviance } from "../src/models/mixedDeviance.js";
import { mixedModelStructure } from "../src/models/mixedStructure.js";
import { denseProfiledDeviance } from "./helpers/mixedDense.js";
import { generator } from "./helpers/properties.js";

const TOL_DEVIANCE = 1e-13;
const TOL_VECTOR = 1e-11;
const TOL_FIT_CRITERION = 1e-12;
const TOL_FIT = 1e-9;

interface Model {
  formula: string;
  data: Record<string, (number | string)[]>;
}

/** Crossed s × i, one row per pair (kept with probability `keep`), y ~ x + (x | s) + (1 | i) effects */
function crossed(formula: string, ns: number, ni: number, keep: number, seed: number): Model {
  const { unif, norm } = generator(seed);
  const se = Array.from({ length: ns }, () => [norm(), 0.5 * norm()]);
  const ie = Array.from({ length: ni }, () => 0.7 * norm());
  const data: Model["data"] = { y: [], x: [], s: [], i: [] };
  for (let s = 0; s < ns; s++) {
    for (let i = 0; i < ni; i++) {
      if (unif() > keep) continue;
      const x = unif() * 4 - 1;
      data.s!.push(`s${s}`);
      data.i!.push(`i${i}`);
      data.x!.push(x);
      data.y!.push(1 + 0.5 * x + se[s]![0]! + se[s]![1]! * x + ie[i]! + norm());
    }
  }
  return { formula, data };
}

/** Subjects with `per` rows each (unbalanced when `vary`), y ~ x + z + f + (x + z | s) effects */
function longitudinal(formula: string, ns: number, per: number, vary: boolean, seed: number): Model {
  const { unif, norm } = generator(seed);
  const data: Model["data"] = { y: [], x: [], z: [], f: [], s: [] };
  for (let s = 0; s < ns; s++) {
    const [b0, b1, b2] = [norm(), 0.4 * norm(), 0.3 * norm()];
    const rows = vary ? 2 + Math.floor(unif() * (2 * per - 3)) : per;
    for (let r = 0; r < rows; r++) {
      const x = r + unif();
      const z = norm();
      const f = ["a", "b", "c"][Math.floor(unif() * 3)]!;
      data.s!.push(`s${s}`);
      data.x!.push(x);
      data.z!.push(z);
      data.f!.push(f);
      data.y!.push(2 + 0.3 * x - 0.2 * z + (f === "b" ? 0.5 : 0) + b0 + b1 * x + b2 * z + 0.8 * norm());
    }
  }
  return { formula, data };
}

/** Three nested factors a / b / c with `rows` rows per c */
function nested(na: number, nb: number, nc: number, rows: number, seed: number): Model {
  const { unif, norm } = generator(seed);
  const data: Model["data"] = { y: [], x: [], a: [], b: [], c: [] };
  for (let a = 0; a < na; a++) {
    const ea = norm();
    for (let b = 0; b < nb; b++) {
      const eb = 0.6 * norm();
      for (let c = 0; c < nc; c++) {
        const ec = 0.4 * norm();
        const k = rows + Math.floor(unif() * 2);
        for (let r = 0; r < k; r++) {
          const x = norm();
          data.a!.push(`a${a}`);
          data.b!.push(`b${b}`);
          data.c!.push(`c${c}`);
          data.x!.push(x);
          data.y!.push(x + ea + eb + ec + norm());
        }
      }
    }
  }
  return { formula: "y ~ x + (1 | a/b/c)", data };
}

const MODELS: Model[] = [
  crossed("y ~ x + (1 | s) + (1 | i)", 60, 30, 1, 1),
  longitudinal("y ~ x + (x | s)", 300, 8, false, 2),
  nested(6, 5, 4, 3, 3),
  crossed("y ~ x + (x | s) + (1 | i)", 40, 25, 0.7, 4),
  longitudinal("y ~ x + z + f + (x + z || s)", 80, 6, true, 5),
  longitudinal("y ~ x + z + (x + z | s)", 60, 6, true, 6),
];

/** The values of θ to try: the initial θ, two random ones (off-diagonal elements of either sign), one with a 0 */
function thetasOf(initial: number[], lower: number[], seed: number): number[][] {
  const { unif } = generator(seed);
  const random = (): number[] => lower.map((b) => (b === 0 ? 0.1 + 2 * unif() : 2 * unif() - 1));
  const withZero = random();
  withZero[lower.lastIndexOf(0)] = 0;
  return [initial, random(), random(), withZero];
}

const relative = (a: number, e: number): number => (a === e ? 0 : Math.abs(a - e) / Math.abs(e));
const scaled = (a: readonly number[], e: readonly number[]): number => {
  const scale = Math.max(...e.map(Math.abs));
  return Math.max(0, ...a.map((v, k) => (v === e[k] ? 0 : Math.abs(v - e[k]!) / scale)));
};

describe("profiledDeviance (sparse) against the dense reference", () => {
  it("agrees on larger seeded data at several θ, REML and ML", () => {
    const failures: string[] = [];
    const worst = new Map<string, number>();
    const check = (where: string, field: string, err: number, tol: number): void => {
      worst.set(field, Math.max(worst.get(field) ?? 0, err));
      if (!(err <= tol)) failures.push(`${where} ${field}: error ${err.toExponential(2)}`);
    };
    let evaluations = 0;
    MODELS.forEach((m, index) => {
      const s = mixedModelStructure(m.formula, m.data);
      thetasOf(s.theta, s.lower, 100 + index).forEach((theta) => {
        for (const reml of [true, false]) {
          const where = `${m.formula} (n = ${s.y.length}, q = ${s.q}), REML = ${reml}, theta = ${theta.map((t) => t.toPrecision(3)).join(", ")}`;
          const options = { gradient: true, rxInverse: true };
          const sparse: ProfiledDeviance = profiledDeviance(s, theta, reml, options);
          const dense: ProfiledDeviance = denseProfiledDeviance(s, theta, reml, options);
          evaluations++;
          for (const f of ["deviance", "rss", "ussq", "prss"] as const) check(where, f, relative(sparse[f], dense[f]), TOL_DEVIANCE);
          for (const f of ["logDetL", "logDetRX"] as const) {
            check(where, f, Math.abs(sparse[f] - dense[f]) / Math.max(1, Math.abs(dense[f])), TOL_DEVIANCE);
          }
          for (const f of ["beta", "u", "b", "gradient"] as const) check(where, f, scaled(sparse[f]!, dense[f]!), TOL_VECTOR);
          check(where, "rxInverse", scaled(sparse.rxInverse!.flat(), dense.rxInverse!.flat()), TOL_VECTOR);
        }
      });
    });
    const summary = [...worst].map(([f, e]) => `${f} ${e.toExponential(1)}`).join(", ");
    console.log(`lmerSparse: ${MODELS.length} models, ${evaluations} evaluations; largest difference from the dense reference: ${summary}`);
    expect(failures, failures.slice(0, 20).join("\n")).toEqual([]);
  });
});

/** The criterion and its gradient from the dense reference */
const denseCriterion: MixedCriterion = (s, theta, reml) => {
  const r = denseProfiledDeviance(s, theta, reml, { gradient: true });
  return { f: r.deviance, g: r.gradient! };
};

/** The models fitted (q up to about 250) */
const FIT_MODELS: Model[] = [
  MODELS[0]!,
  longitudinal("y ~ x + (x | s)", 100, 8, false, 12),
  MODELS[2]!,
  MODELS[3]!,
  MODELS[4]!,
  MODELS[5]!,
];

/** The numeric vectors of a fit (one name per field, possibly several vectors) */
function fitVectors(r: LmerResult): Record<string, number[][]> {
  return {
    theta: [r.theta],
    fixef: [r.fixef],
    stdError: [r.coefTable.stdError],
    tValue: [r.coefTable.tValue],
    vcov: [r.vcov.flat()],
    sd: r.varCorr.map((v) => v.sd),
    ranef: r.ranef.map((g) => g.values.flat()),
    fitted: [r.fitted],
    residuals: [r.residuals],
  };
}

describe("lmer (sparse) against fits with the dense reference criterion", () => {
  it("agrees on larger seeded data, REML and ML", () => {
    const failures: string[] = [];
    const worst = new Map<string, number>();
    const check = (where: string, field: string, err: number, tol: number): void => {
      worst.set(field, Math.max(worst.get(field) ?? 0, Number.isNaN(err) ? Infinity : err));
      if (!(err <= tol)) failures.push(`${where} ${field}: error ${err.toExponential(2)}`);
    };
    let fits = 0;
    for (const m of FIT_MODELS) {
      for (const REML of [true, false]) {
        const where = `${m.formula} (n = ${m.data.y!.length}), REML = ${REML}`;
        const sparse = lmer(m.formula, m.data, { REML });
        const dense = lmerWithCriterion(m.formula, m.data, { REML }, denseCriterion);
        fits++;
        for (const f of ["logLik", "AIC", "BIC", "deviance", "REMLcrit"] as const) check(where, f, relative(sparse[f], dense[f]), TOL_FIT_CRITERION);
        check(where, "sigma", relative(sparse.sigma, dense.sigma), TOL_FIT);
        const a = fitVectors(sparse);
        const e = fitVectors(dense);
        for (const f of Object.keys(e)) {
          const scale = Math.max(...e[f]!.flat().map(Math.abs));
          const err = Math.max(0, ...e[f]!.flatMap((v, k) => v.map((x, i) => (a[f]![k]![i] === x ? 0 : Math.abs(a[f]![k]![i]! - x) / scale))));
          check(where, f, err, TOL_FIT);
        }
        const sparseCorr = sparse.varCorr.flatMap((v) => v.corr.flat());
        const corrErr = Math.max(0, ...dense.varCorr.flatMap((v) => v.corr.flat()).map((x, i) => (sparseCorr[i] === x ? 0 : Math.abs(sparseCorr[i]! - x))));
        check(where, "corr", corrErr, TOL_FIT);
        const zeros = sparse.theta.every((t, j) => (t === 0) === (dense.theta[j] === 0));
        check(where, "zeros of theta", zeros ? 0 : Infinity, 0);
        check(where, "singular", sparse.singular === dense.singular ? 0 : Infinity, 0);
        check(where, "messages", JSON.stringify(sparse.messages) === JSON.stringify(dense.messages) ? 0 : Infinity, 0);
      }
    }
    const summary = [...worst].map(([f, e]) => `${f} ${e.toExponential(1)}`).join(", ");
    console.log(`lmerSparse: ${fits} fits; largest difference from the fits with the dense reference: ${summary}`);
    expect(failures, failures.slice(0, 20).join("\n")).toEqual([]);
  });
});

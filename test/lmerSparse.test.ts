// The sparse profiled deviance (src/models/mixedDeviance.ts) against the dense reference implementation
// (test/helpers/mixedDense.ts, the implementation of stages 1b and 1c), on data larger than the fixtures', built here
// with a seeded generator (oracle/lmer-behaviour.md "Sparse computation (stages S1 and S2)"): crossed (1 | s) + (1 | i),
// (x | s), a three-level nesting (1 | a/b/c), (x | s) + (1 | i) partially crossed, and a || model, at several θ (the
// initial θ, random values with negative off-diagonal elements, a diagonal element at 0), REML and ML. Tolerances:
// deviance relative 1e-13; beta, u, b and the gradient each element within 1e-11 × the largest absolute element of the
// dense result. Also compared, with the same tolerances: rss, ussq, prss (relative 1e-13), logDetL, logDetRX
// (absolute 1e-13 × max(1, |value|)) and (R_X'R_X)⁻¹ (1e-11 × its largest absolute element).
import { describe, expect, it } from "vitest";
import { profiledDeviance, type ProfiledDeviance } from "../src/models/mixedDeviance.js";
import { mixedModelStructure } from "../src/models/mixedStructure.js";
import { denseProfiledDeviance } from "./helpers/mixedDense.js";

const TOL_DEVIANCE = 1e-13;
const TOL_VECTOR = 1e-11;

/** A seeded generator of uniform and normal numbers (mulberry32 and Box-Muller) */
function generator(seed: number): { unif: () => number; norm: () => number } {
  let a = seed >>> 0;
  const unif = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const norm = (): number => Math.sqrt(-2 * Math.log(1 - unif())) * Math.cos(2 * Math.PI * unif());
  return { unif, norm };
}

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

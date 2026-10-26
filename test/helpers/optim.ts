// Shared code of the optim tests (oracle/optim.R, oracle/optimsann.R): the test functions of oracle/_optimfns.R in
// TypeScript, evaluated as R evaluates them, and the comparison rules of oracle/optim-behaviour.md ("Accuracy"):
// par, value and hessian within a relative 1e-12 of R, or 1e-12 absolute where R's value is 0 or the value is a
// minimum of 0 (all test functions here have a minimum of 0 except cosine); counts, convergence, message exactly.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { optim, type OptimControl, type OptimMethod, type OptimOptions, type OptimResult } from "../../src/index.js";
import { num } from "./fixture.js";

/** R's sum() of doubles accumulates in extended precision; for these few terms that is the correctly rounded sum */
function rsum(terms: number[]): number {
  // Shewchuk's exact summation (as in Python's math.fsum), then rounding of the expansion
  const partials: number[] = [];
  for (let x of terms) {
    let i = 0;
    for (let y of partials) {
      if (Math.abs(x) < Math.abs(y)) [x, y] = [y, x];
      const hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) partials[i++] = lo;
      x = hi;
    }
    partials.length = i;
    partials.push(x);
  }
  let n = partials.length;
  if (n === 0) return 0;
  let hi = partials[--n]!;
  let lo = 0;
  while (n > 0) {
    const x = hi;
    const y = partials[--n]!;
    hi = x + y;
    const yr = hi - x;
    lo = y - yr;
    if (lo !== 0) break;
  }
  // half-way correction
  if (n > 0 && ((lo < 0 && partials[n - 1]! < 0) || (lo > 0 && partials[n - 1]! > 0))) {
    const y = lo * 2;
    const x = hi + y;
    if (y === x - hi) hi = x;
  }
  return hi;
}

/** x^3 correctly rounded, as the C library's pow (R's x^3) */
function cube(x: number): number {
  const split = (a: number): [number, number] => {
    const c = 134217729 * a;
    const h = c - (c - a);
    return [h, a - h];
  };
  const twoProd = (a: number, b: number): [number, number] => {
    const p = a * b;
    const [ah, al] = split(a);
    const [bh, bl] = split(b);
    return [p, ah * bh - p + ah * bl + al * bh + al * bl];
  };
  const [p, e] = twoProd(x, x);
  const [q, f] = twoProd(p, x);
  return q + (f + e * x);
}

const sq = (x: number): number => x * x;

// double-double arithmetic for the correctly rounded cosine and sine below
type DD = [number, number];
function twoSum(a: number, b: number): DD {
  const s = a + b;
  const bb = s - a;
  return [s, a - (s - bb) + (b - bb)];
}
function ddAdd(a: DD, b: DD): DD {
  const [s, e] = twoSum(a[0], b[0]);
  const [h, l] = twoSum(s, e + a[1] + b[1]);
  return [h, l];
}
function ddMul(a: DD, b: DD): DD {
  const split = (v: number): DD => {
    const c = 134217729 * v;
    const h = c - (c - v);
    return [h, v - h];
  };
  const p = a[0] * b[0];
  const [ah, al] = split(a[0]);
  const [bh, bl] = split(b[0]);
  const e = ah * bh - p + ah * bl + al * bh + al * bl;
  return twoSum(p, e + a[0] * b[1] + a[1] * b[0]);
}
function ddDiv(a: DD, n: number): DD {
  const q1 = a[0] / n;
  const p = ddMul([q1, 0], [n, 0]);
  const rem = ddAdd(a, [-p[0], -p[1]]);
  return twoSum(q1, rem[0] / n);
}
/** cos (c = true) or sin of x (|x| up to about 1e3) to about 100 bits, then rounded: the correctly rounded results of the C library */
function trig(x: number, c: boolean): number {
  // pi/2 in three parts
  const P: DD[] = [[1.5707963267948966, 0], [6.123233995736766e-17, 0], [-1.4973849048591698e-33, 0]];
  const k = Math.round(x / P[0]![0]);
  let r: DD = [x, 0];
  for (const p of P) {
    const kp = ddMul([k, 0], p);
    r = ddAdd(r, [-kp[0], -kp[1]]);
  }
  const r2 = ddMul(r, r);
  // Taylor series of cos and sin of r
  let cs: DD = [1, 0];
  let sn: DD = [1, 0];
  let tc: DD = [1, 0];
  let ts: DD = [1, 0];
  for (let i = 1; i < 25; i++) {
    tc = ddDiv(ddMul(tc, r2), -(2 * i - 1) * (2 * i));
    ts = ddDiv(ddMul(ts, r2), -(2 * i) * (2 * i + 1));
    cs = ddAdd(cs, tc);
    sn = ddAdd(sn, ts);
  }
  sn = ddMul(sn, r);
  const q = ((k % 4) + 4) % 4;
  const v = c ? [cs, sn, cs, sn][q]! : [sn, cs, sn, cs][q]!;
  const sign = c ? [1, -1, -1, 1][q]! : [1, 1, -1, -1][q]!;
  return sign * (v[0] + v[1]);
}

export interface TestFn {
  fn: (x: number[]) => number;
  gr?: (x: number[]) => number[];
}

export const OPT_FNS: Record<string, TestFn> = {
  rosenbrock: {
    fn: (x) => {
      const terms: number[] = [];
      for (let i = 0; i < x.length - 1; i++) terms.push(100 * sq(x[i + 1]! - sq(x[i]!)) + sq(1 - x[i]!));
      return rsum(terms);
    },
    gr: (x) => {
      const n = x.length;
      const g = new Array<number>(n).fill(0);
      for (let i = 0; i < n - 1; i++) g[i] = -400 * x[i]! * (x[i + 1]! - sq(x[i]!)) - 2 * (1 - x[i]!);
      for (let i = 1; i < n; i++) g[i] = g[i]! + 200 * (x[i]! - sq(x[i - 1]!));
      return g;
    },
  },
  quadratic: {
    fn: (x) => rsum(x.map((v, i) => sq(v - (i + 1)) * (i + 1))),
    gr: (x) => x.map((v, i) => 2 * (v - (i + 1)) * (i + 1)),
  },
  beale: {
    fn: ([x1, x2]) =>
      sq(1.5 - x1! + x1! * x2!) + sq(2.25 - x1! + x1! * sq(x2!)) + sq(2.625 - x1! + x1! * cube(x2!)),
    gr: ([x1, x2]) => {
      const a = 1.5 - x1! + x1! * x2!;
      const b = 2.25 - x1! + x1! * sq(x2!);
      const c = 2.625 - x1! + x1! * cube(x2!);
      return [
        2 * a * (x2! - 1) + 2 * b * (sq(x2!) - 1) + 2 * c * (cube(x2!) - 1),
        2 * a * x1! + 4 * b * x1! * x2! + 6 * c * x1! * sq(x2!),
      ];
    },
  },
  wood: {
    fn: ([x1, x2, x3, x4]) =>
      100 * sq(sq(x1!) - x2!) + sq(x1! - 1) + sq(x3! - 1) + 90 * sq(sq(x3!) - x4!) +
      10.1 * (sq(x2! - 1) + sq(x4! - 1)) + 19.8 * (x2! - 1) * (x4! - 1),
  },
  cosine: {
    fn: ([x]) => trig(x!, true) + 0.1 * sq(x!),
    gr: ([x]) => [-trig(x!, false) + 0.2 * x!],
  },
};

export interface OptimCase {
  args: Record<string, unknown>;
  expected: {
    par: string[];
    value: string;
    counts: string[];
    convergence: string;
    message: string;
    hessian: string[][] | Record<string, never>;
    warnings?: string[];
  };
}

export function loadOptimFixture(name: string): OptimCase[] {
  const path = fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url));
  return (JSON.parse(readFileSync(path, "utf8")) as { cases: OptimCase[] }).cases;
}

/** A numeric vector argument (R writes a length-1 vector as a single string) */
export const vecArg = (a: unknown): number[] => (typeof a === "string" ? [num(a)] : (a as string[]).map((v) => num(v)));

export const TOL = 1e-12;

/** Error of a value against R's: relative, or absolute where R's value is 0 or `absolute` (a minimum of 0) */
export function errorOf(actual: number, expected: number, absolute = false): number {
  if (Number.isNaN(expected)) return Number.isNaN(actual) ? 0 : Infinity;
  if (actual === expected) return 0;
  const d = Math.abs(actual - expected);
  if (absolute || expected === 0) return Math.min(d, d / Math.abs(expected));
  return d / Math.abs(expected);
}

/** Runs optim on a case of the fixtures */
export function runCase(a: OptimCase["args"]): OptimResult {
  const f = OPT_FNS[a.fn as string]!;
  const options: OptimOptions = { method: a.method as OptimMethod };
  if (a.gradient === true) options.gr = f.gr!;
  if (a.lower !== undefined) options.lower = vecArg(a.lower);
  if (a.upper !== undefined) options.upper = vecArg(a.upper);
  if (a.hessian !== undefined) options.hessian = a.hessian as boolean;
  if (a.control !== undefined) {
    const c: Record<string, number | number[]> = {};
    for (const [k, v] of Object.entries(a.control as Record<string, string | string[]>)) c[k] = Array.isArray(v) ? vecArg(v) : num(v);
    options.control = c as OptimControl;
  }
  return optim(vecArg(a.par), f.fn, options);
}

/** Compares a result with R's (par, value and hessian within `tol`); returns the failures and the largest error */
export function compare(c: OptimCase, r: OptimResult, tol = TOL): { failures: string[]; maxErr: number } {
  const e = c.expected;
  const failures: string[] = [];
  let maxErr = 0;
  const minimumZero = c.args.fn !== "cosine";
  const check = (what: string, actual: number, expected: number, absolute = false) => {
    const err = errorOf(actual, expected, absolute);
    maxErr = Math.max(maxErr, err);
    if (!(err <= tol)) failures.push(`${what}: ${actual} vs ${expected} (${err.toExponential(2)})`);
  };
  expect(r.par.length).toBe(e.par.length);
  r.par.forEach((p, i) => check(`par[${i}]`, p, num(e.par[i])));
  check("value", r.value, num(e.value), minimumZero);
  const counts = e.counts.map((v) => num(v));
  r.counts.forEach((v, i) => {
    if (!Object.is(v, counts[i]) && !(Number.isNaN(v) && Number.isNaN(counts[i]))) failures.push(`counts[${i}]: ${v} vs ${counts[i]}`);
  });
  if (r.convergence !== num(e.convergence)) failures.push(`convergence: ${r.convergence} vs ${e.convergence}`);
  const message = e.message === "NULL" ? null : e.message;
  if (r.message !== message) failures.push(`message: ${r.message} vs ${message}`);
  if (Array.isArray(e.hessian)) {
    const H = r.hessian!;
    e.hessian.forEach((row, i) => row.forEach((v, j) => check(`hessian[${i}][${j}]`, H[i]![j]!, num(v))));
  } else if (r.hessian !== undefined) failures.push("unexpected hessian");
  if (e.warnings !== undefined) expect(r.warnings).toEqual(e.warnings);
  return { failures, maxErr };
}

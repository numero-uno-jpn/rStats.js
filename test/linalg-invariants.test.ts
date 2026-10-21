// Backward error and orthogonality of the decompositions. Not compared with R; checks that each
// decomposition holds mathematically. Tolerances are "constant × dimension × ε" (relative to the matrix norm).

import { describe, expect, it } from "vitest";
import { chol, eigen, qr, qrQ, qrR, rnorm, setSeed, solve, svd } from "../src/index.js";

const EPS = Number.EPSILON;
type M = number[][];

function randomMatrix(n: number, p: number, scale = 1): M {
  const v = rnorm(n * p);
  return Array.from({ length: n }, (_, i) => Array.from({ length: p }, (_, j) => v[i + j * n]! * scale));
}
const mul = (a: M, b: M): M => a.map((r) => b[0]!.map((_, j) => r.reduce((s, v, k) => s + v * b[k]![j]!, 0)));
const t = (a: M): M => a[0]!.map((_, j) => a.map((r) => r[j]!));
const frob = (a: M) => Math.sqrt(a.flat().reduce((s, v) => s + v * v, 0));
const sub = (a: M, b: M): M => a.map((r, i) => r.map((v, j) => v - b[i]![j]!));
const eye = (n: number): M => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
const relErr = (a: M, b: M) => frob(sub(a, b)) / Math.max(frob(b), Number.MIN_VALUE);

const shapes: [number, number][] = [
  [1, 1],
  [5, 3],
  [3, 5],
  [8, 8],
  [40, 10],
  [10, 40],
  [60, 60],
];

describe("decomposition backward error and orthogonality", () => {
  setSeed(20261027);
  it("qr: Q R = X[, pivot], Q^T Q = I", () => {
    for (const [n, p] of shapes) {
      for (const lapack of [false, true]) {
        const x = randomMatrix(n, p);
        const q = qr(x, { lapack });
        const Q = qrQ(q);
        const R = qrR(q);
        const xp = x.map((r) => q.pivot.map((j) => r[j]!));
        expect(relErr(mul(Q, R), xp)).toBeLessThan(10 * Math.max(n, p) * EPS);
        expect(frob(sub(mul(t(Q), Q), eye(Q[0]!.length)))).toBeLessThan(10 * n * EPS);
      }
    }
  });

  it("chol: t(R) R = A", () => {
    for (const n of [1, 5, 30, 80]) {
      const z = randomMatrix(n + 3, n);
      const a = mul(t(z), z);
      const r = chol(a);
      expect(relErr(mul(t(r), r), a)).toBeLessThan(10 * n * EPS);
    }
  });

  it("svd: U D V^T = A, U^T U = I, V^T V = I", () => {
    for (const [n, p] of shapes) {
      for (const scale of [1, 1e150, 1e-150]) {
        const a = randomMatrix(n, p, scale);
        const { d, u, v } = svd(a);
        const ud = u!.map((r) => r.map((x, k) => x * d[k]!));
        expect(relErr(mul(ud, t(v!)), a)).toBeLessThan(10 * Math.max(n, p) * EPS);
        expect(frob(sub(mul(t(u!), u!), eye(d.length)))).toBeLessThan(10 * Math.max(n, p) * EPS);
        expect(frob(sub(mul(t(v!), v!), eye(d.length)))).toBeLessThan(10 * Math.max(n, p) * EPS);
        for (let k = 1; k < d.length; k++) expect(d[k]!).toBeLessThanOrEqual(d[k - 1]!);
      }
    }
  });

  it("eigen (symmetric): A V = V Λ, V^T V = I", () => {
    for (const n of [1, 2, 7, 30, 80]) {
      const z = randomMatrix(n, n);
      const a = z.map((r, i) => r.map((v, j) => (v + z[j]![i]!) / 2));
      const { values, vectors } = eigen(a, { symmetric: true });
      const vl = vectors!.map((r) => r.map((x, k) => x * values[k]!));
      expect(relErr(mul(a, vectors!), vl) * frob(vl) / frob(a)).toBeLessThan(10 * n * EPS);
      expect(frob(sub(mul(t(vectors!), vectors!), eye(n)))).toBeLessThan(10 * n * EPS);
    }
  });

  it("eigen (nonsymmetric): A v = λ v (including complex)", () => {
    for (const n of [1, 2, 7, 30, 80]) {
      const a = randomMatrix(n, n);
      const e = eigen(a, { symmetric: false });
      const vi = e.vectorsIm ?? e.vectors!.map((r) => r.map(() => 0));
      const li = e.valuesIm ?? e.values.map(() => 0);
      let res = 0;
      for (let k = 0; k < n; k++) {
        for (let i = 0; i < n; i++) {
          let sr = 0;
          let si = 0;
          for (let j = 0; j < n; j++) {
            sr += a[i]![j]! * e.vectors![j]![k]!;
            si += a[i]![j]! * vi[j]![k]!;
          }
          const vr = e.vectors![i]![k]!;
          const vim = vi[i]![k]!;
          res = Math.max(res, Math.hypot(sr - (e.values[k]! * vr - li[k]! * vim), si - (e.values[k]! * vim + li[k]! * vr)));
        }
      }
      expect(res / frob(a)).toBeLessThan(10 * n * EPS);
    }
  });

  it("solve: residual |A x - b| is of order |A| |x| ε", () => {
    for (const n of [1, 5, 30, 80]) {
      const a = randomMatrix(n, n);
      const b = rnorm(n);
      const x = solve(a, b);
      const r = a.map((row, i) => row.reduce((s, v, j) => s + v * x[j]!, 0) - b[i]!);
      const rn = Math.sqrt(r.reduce((s, v) => s + v * v, 0));
      const xn = Math.sqrt(x.reduce((s, v) => s + v * v, 0));
      expect(rn / (frob(a) * xn)).toBeLessThan(10 * n * EPS);
    }
  });
});

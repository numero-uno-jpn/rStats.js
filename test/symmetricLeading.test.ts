import { describe, expect, it } from "vitest";
import { eigen } from "../src/entries/linalg.js";
import { symmetricLeading } from "../src/linalg/symmetricLeading.js";

// symmetricLeading (all eigenvalues, k leading eigenvectors; used by cmdscale) against the full decomposition of
// eigen. Both are backward stable, so the eigenvalues agree to a small multiple of n eps times the largest one; the
// vectors are checked by their residual ||A v - lambda v|| and orthogonality, which do not depend on signs or on the
// basis chosen inside a repeated eigenvalue
let seed = 12345;
const rnd = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
function symmetric(n: number, entry: () => number): number[][] {
  const a = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { const v = entry(); a[i]![j] = v; a[j]![i] = v; }
  return a;
}
function withSpectrum(lambda: readonly number[]): number[][] {
  const n = lambda.length;
  const q = eigen(symmetric(n, rnd), { symmetric: true }).vectors!;
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
    let s = 0;
    for (let t = 0; t < n; t++) s += q[i]![t]! * lambda[t]! * q[j]![t]!;
    return s;
  }));
}

describe("symmetricLeading", () => {
  const cases: [string, number[][]][] = [
    ["random", symmetric(120, () => rnd() - 0.5)],
    ["clustered", withSpectrum(Array.from({ length: 80 }, (_, i) => i < 5 ? 10 + 1e-9 * i : i < 10 ? 5 : 1e-3 * rnd()))],
    ["graded", withSpectrum(Array.from({ length: 60 }, (_, i) => 10 ** (-12 * i / 60)))],
    ["scaled 2^900", symmetric(40, () => (rnd() - 0.5) * 2 ** 900)],
    ["scaled 2^-900", symmetric(40, () => (rnd() - 0.5) * 2 ** -900)],
  ];
  for (const [name, a] of cases) {
    it(`agrees with eigen and gives orthonormal eigenvectors: ${name}`, () => {
      const n = a.length, k = 6;
      const ref = eigen(a, { symmetric: true }).values;
      const got = symmetricLeading(a, k);
      const scale = Math.max(...ref.map(Math.abs));
      const bound = 4 * n * Number.EPSILON * scale;
      const mismatches: string[] = [];
      for (let i = 0; i < n; i++) if (!(Math.abs(ref[i]! - got.values[i]!) <= bound)) mismatches.push(`value ${i}`);
      for (let j = 0; j < k; j++) {
        const v = got.vectors[j]!;
        for (let i = 0; i < n; i++) {
          let s = 0;
          for (let t = 0; t < n; t++) s += a[i]![t]! * v[t]!;
          if (!(Math.abs(s - got.values[j]! * v[i]!) <= bound)) { mismatches.push(`residual ${j}`); break; }
        }
        for (let h = 0; h <= j; h++) {
          let d = 0;
          for (let i = 0; i < n; i++) d += v[i]! * got.vectors[h]![i]!;
          if (!(Math.abs(d - (h === j ? 1 : 0)) <= 4 * n * Number.EPSILON)) mismatches.push(`orthogonality ${j},${h}`);
        }
      }
      expect(mismatches).toEqual([]);
    });
  }
});

// Issue #56: kappa (exact) and ginv where the singular values overflow (review_fix_log_issue56.md).
import { describe, expect, it } from "vitest";
import { ginv, kappa, svd } from "../src/index.js";

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);
const a = 1.7e308;

describe("issue #56", () => {
  it("kappa: the ratio of singular values of about 2.4e308 (R 4.5.2: NaN)", () => {
    // Inf / Inf
    expect(rel(kappa([[a, a], [a, -a]], { exact: true }), 1)).toBeLessThan(1e-15);
    expect(rel(kappa([[a, 0], [0, a / 4]], { exact: true }), 4)).toBeLessThan(1e-15);
  });

  it("ginv: the inverse of a matrix around 1.7e308 (R 4.5.2: the zero matrix)", () => {
    // the cut-off tol * Inf dropped every component
    const g = ginv([[a, a], [a, -a]]);
    const h = 0.5 / a; // 1 / (2a), without forming 2a (it overflows)
    expect(rel(g[0]![0]!, h)).toBeLessThan(1e-14);
    expect(rel(g[0]![1]!, h)).toBeLessThan(1e-14);
    expect(rel(g[1]![0]!, h)).toBeLessThan(1e-14);
    expect(rel(g[1]![1]!, -h)).toBeLessThan(1e-14);
    const n = ginv([[-a, 0], [0, -a]]);
    expect(rel(n[0]![0]!, -1 / a)).toBeLessThan(1e-14);
    expect(n[0]![1]).toBe(0);
  });

  it("leaves other scales as before", () => {
    expect(rel(kappa([[1, 3], [2, 4]], { exact: true }), 14.933034373659265)).toBeLessThan(1e-14);
    expect(rel(kappa([[1e-300, 3e-300], [2e-300, 4e-300]], { exact: true }), 14.933034373659265)).toBeLessThan(1e-14);
    expect(ginv([[1e-160, 0], [0, 1e-170]])).toEqual([
      [1e160, 0],
      [0, 0],
    ]);
    expect(ginv([[2, 0], [0, 4]])).toEqual([
      [0.5, 0],
      [0, 0.25],
    ]);
    expect(svd([[a, a], [a, -a]]).d).toEqual([Infinity, Infinity]);
  });
});

// Issue #71: qrSolve keeps a NaN from the solve (review_fix_log_issue71.md).
import { describe, expect, it } from "vitest";
import { qr, qrSolve } from "../src/index.js";

describe("issue #71", () => {
  it("keeps the NaN of a coefficient the decomposition uses (R's qr.solve gives 0)", () => {
    expect(qrSolve([[1], [2], [3]], [NaN, 2, 3])).toEqual([NaN]); // R 4.5.2: 0
    // the NaN spreads through the Householder reflections to both coefficients (R: 0, 0)
    expect(qrSolve([[1, 0], [0, 1]], [NaN, 1])).toEqual([NaN, NaN]);
    // a matrix response: only the column with the NaN (R: 0 0 / 1 2)
    expect(qrSolve([[1, 0], [0, 1]], [[NaN, 1], [1, 2]])).toEqual([
      [NaN, 1],
      [NaN, 2],
    ]);
  });

  it("still gives 0 for the columns of a wide matrix that the decomposition leaves out", () => {
    // (+ 0 maps the -0 of a solved coefficient to 0, as R prints it)
    expect((qrSolve([[1, 3, 5], [2, 4, 6]], [1, 2]) as number[]).map((x) => x + 0)).toEqual([1, 0, 0]); // R 4.5.2: the same
    const q = qr([[1, 3, 5], [2, 4, 6]], { lapack: true });
    const v = qrSolve(q, [1, 2]) as number[];
    // R 4.5.2 (LAPACK = TRUE, pivot 3 1 2): 1 0 0; the unused second column is 0
    expect(v[0]).toBeCloseTo(1, 14);
    expect(v[1]).toBe(0);
    expect(Math.abs(v[2]!)).toBeLessThan(1e-15);
    expect((qrSolve([[1, 3, 5], [2, 4, 6]], [[1], [2]]) as number[][]).map((r) => r.map((x) => x + 0))).toEqual([[1], [0], [0]]);
  });
});

// Issue #99: isSymmetric and checkCovmat as R's isSymmetric (all.equal with countEQ = FALSE: the entries equal to their
// transposes are left out of the means), in the matrix's own units (review_fix_log_issue99.md). Expected: R 4.5.2.
import { describe, expect, it } from "vitest";
import { eigen } from "../src/index.js";
import { checkCovmat } from "../src/internal/covmat.js";
import { isSymmetric } from "../src/linalg/eigen.js";
import { toMat } from "../src/linalg/matrix.js";

const big = 1.5 * 2 ** 1023;
const ulp = 2 ** (1023 - 52);
// [matrix, R's isSymmetric]
const cases: [number[][], boolean][] = [
  [[[1e308, 1e-10], [0, 1]], false], // the issue's
  [[[1e6, 1e-10], [0, 1]], false],
  [[[4, 1], [1 + 1e-13, 4]], false],
  [[[4, 1], [1 + 1e-15, 4]], true],
  [[[1, 0.5], [0.5 + 1e-14, 1]], true],
  [[[1, 0.5], [0.5 + 2e-14, 1]], false],
  [[[1, 1e-300], [0, 1]], true], // all.equal's absolute difference
  [[[1, 1e-7], [0, 1]], false],
  [[[1, 1e-13], [0, 1]], false],
  [[[1, 2e-14], [0, 1]], true],
  [[[1, 0.3, 0.2], [0.3, 1, 0.4 + 1e-12], [0.2, 0.4, 1]], false],
  // sums that overflow
  [[[1, big], [big - ulp, 1]], true],
  [[[1, 2 ** 1023], [-(2 ** 1023), 1]], false],
  [[[big, big], [big - 2 ** 1000, big]], false],
  [[[big, 2 ** 1023], [2 ** 1023, big]], true],
];

describe("issue #99", () => {
  it("tests symmetry as R's isSymmetric", () => {
    for (const [m, want] of cases) expect(isSymmetric(toMat(m)), JSON.stringify(m)).toBe(want);
  });

  it("checks a covmat in its own units, as R's isSymmetric", () => {
    for (const [m, want] of cases) {
      if (m.some((r, i) => !(r[i]! > 0))) continue;
      if (want) expect(() => checkCovmat(m), JSON.stringify(m)).not.toThrow();
      else expect(() => checkCovmat(m), JSON.stringify(m)).toThrow("'covmat' must be symmetric");
    }
  });

  it("takes [[4, 1], [1 + 1e-13, 4]] for a nonsymmetric matrix in eigen, as R", () => {
    // R: eigen values 5.0000000000000497, 2.9999999999999503 (the general algorithm)
    const e = eigen([[4, 1], [1 + 1e-13, 4]]);
    expect(Math.abs(e.values[0]! - 5.0000000000000497)).toBeLessThan(4e-15);
    expect(Math.abs(e.values[1]! - 2.9999999999999503)).toBeLessThan(4e-15);
    expect(Math.abs(e.vectors![1]![0]! - 0.70710678118656523)).toBeLessThan(1e-15);
  });
});

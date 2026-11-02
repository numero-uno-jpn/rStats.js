// Issue #83: omega's minres fit with a uniqueness at the lower bound 0.005, where psych's gradient (that of the
// residual sum of squares with the diagonal) stops short of the minimum of the off-diagonal objective
// (review_fix_log_issue83.md). The minimum and its communalities are R's, from L-BFGS-B with the objective's own
// gradient over 30 starts (factr 1); the rotation of orthog leaves its communalities and LL' unchanged.
import { describe, expect, it } from "vitest";
import { omega } from "../src/index.js";

const cases = [
  {
    S: [
      [1, -0.17, -0.07, -0.76, 0.33, -0.07],
      [-0.17, 1, -0.21, 0.59, -0.21, 0.24],
      [-0.07, -0.21, 1, -0.01, -0.03, 0.04],
      [-0.76, 0.59, -0.01, 1, -0.56, -0.13],
      [0.33, -0.21, -0.03, -0.56, 1, 0.09],
      [-0.07, 0.24, 0.04, -0.13, 0.09, 1],
    ],
    psych: 0.0064348886030361649,
    best: 0.0063173655314622241,
    h2: [0.62952644425870128, 1.0034121215038305, 0.072849913781026459, 1.0520130722483392, 0.25978463907214913, 0.99685904818638207],
  },
  {
    S: [
      [1, 0.42, 0.37, 0.15, 0.59, 0.43, 0.22],
      [0.42, 1, 0.21, 0.06, 0.55, 0.08, 0.81],
      [0.37, 0.21, 1, 0.3, 0, -0.18, 0.52],
      [0.15, 0.06, 0.3, 1, -0.57, -0.4, 0.29],
      [0.59, 0.55, 0, -0.57, 1, 0.46, 0.26],
      [0.43, 0.08, -0.18, -0.4, 0.46, 1, -0.29],
      [0.22, 0.81, 0.52, 0.29, 0.26, -0.29, 1],
    ],
    psych: 0.03547761615677004,
    best: 0.03530976731637324,
    h2: [1.0353055292567168, 0.6918567403290429, 0.31790812689021175, 0.70550923624411581, 1.00012490013508, 0.46791822367983489, 1.051587483269889],
  },
  {
    S: [
      [1, 0.3, 0.01, 0.18, 0.18, 0.01],
      [0.3, 1, -0.56, 0.43, 0.48, 0.79],
      [0.01, -0.56, 1, -0.43, -0.43, -0.76],
      [0.18, 0.43, -0.43, 1, -0.18, 0.41],
      [0.18, 0.48, -0.43, -0.18, 1, 0.72],
      [0.01, 0.79, -0.76, 0.41, 0.72, 1],
    ],
    psych: 0.0020000371367404792,
    best: 0.0019335517668839799,
    h2: [0.99830339810308715, 0.65504785337446751, 0.58232874573300428, 0.80862169555876449, 0.90112860504600096, 1.0270150470919899],
  },
];

/** The off-diagonal objective at loadings L: the sum over i > j of (S_ij - (LL')_ij)^2 */
function offDiagonal(S: number[][], L: number[][]): number {
  let f = 0;
  for (let i = 0; i < S.length; i++) {
    for (let j = 0; j < i; j++) {
      const m = L[i]!.reduce((a, v, k) => a + v * L[j]![k]!, 0);
      f += (S[i]![j]! - m) ** 2;
    }
  }
  return f;
}

describe("issue #83", () => {
  cases.forEach((c, k) => {
    it(`reaches the minimum with uniquenesses at the lower bound (case ${k + 1})`, () => {
      const r = omega(null, { nfactors: 3, covmat: c.S });
      const f = offDiagonal(c.S, r.orthog);
      // psych stops 0.5% to 3.4% above the minimum
      expect((c.psych - c.best) / c.best).toBeGreaterThan(1e-3);
      expect(Math.abs(f - c.best) / c.best).toBeLessThan(1e-9);
      r.orthog.forEach((row, i) => {
        const h2 = row.reduce((a, v) => a + v * v, 0);
        expect(Math.abs(h2 - c.h2[i]!), `h2[${i}]`).toBeLessThan(1e-6);
      });
      expect(r.warnings.some((w) => w.startsWith("minres did not converge"))).toBe(false);
    });
  });
});

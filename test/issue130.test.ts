// Issue #130: QR's Householder products overflowed for finite columns near 1e308: qr(matrix(1e308, 2, 2)) had rank 2
// and -Inf in R (as in R), and lm on a predictor near 1e308 gave NaN coefficients. Where the result is not finite, the
// decomposition is made again with each column outside [2^-256, 2^256] divided by a power of 2 (LINPACK), or the whole
// matrix (LAPACK), and R scaled back (review_fix_log_issue130.md). References: the same fit of x / 2^1000.
import { describe, expect, it } from "vitest";
import { glm, lm, qr, qrR } from "../src/index.js";

const rel = (x: number, y: number) => Math.abs(x - y) / Math.abs(y);

describe("issue #130", () => {
  it("finds rank 1 for the issue's matrix", () => {
    const q = qr([[1e308, 1e308], [1e308, 1e308]]);
    expect(q.rank).toBe(1);
    expect(qrR(q)).toEqual([[-1.4142135623730951e308, -1.414213562373095e308], [0, 0]]);
    const l = qr([[1e308, 1e308], [1e308, 1e308]], { lapack: true });
    expect(qrR(l)).toEqual([[-1.4142135623730951e308, -1.414213562373095e308], [0, 0]]);
    expect(l.qraux.every(Number.isFinite)).toBe(true);
  });

  it("gives the LAPACK decomposition where the reflector overflowed", () => {
    // NaN in R before; the LINPACK decomposition of the same matrix was finite (and is unchanged)
    const m = [[1e308, 1], [1e307, 2], [5e307, 3]];
    expect(qrR(qr(m, { lapack: true }))).toEqual([[-1.1224972160321825e308, -2.4053511772118195], [0, -2.866057521105554]]);
    expect(qr(m).qr).toEqual([[-1.1224972160321825e308, -2.4053511772118195], [0.0890870806374748, -2.866057521105555], [0.44543540318737396, 0.7668359978845891]]);
  });

  it("fits lm and glm on a predictor near 1e308", () => {
    const x = [1e308, 5e307, 3e307, 8e307];
    const y = [1, 3, 2, 4];
    const ref = lm(x.map((v) => [v / 2 ** 1000]), y).coefficients;
    for (const c of [lm(x.map((v) => [v]), y).coefficients, glm(x.map((v) => [v]), y).coefficients]) {
      expect(c).toEqual([2.9482758620689657, -6.896551724137934e-309]);
      expect(rel(c[0]!, ref[0]!)).toBeLessThan(1e-15);
      expect(rel(c[1]!, ref[1]! * 2 ** -1000)).toBeLessThan(1e-14);
    }
  });

  it("keeps the bits where the decomposition was finite", () => {
    // values of the implementation before the fix
    expect(lm([[1e300], [5e299], [3e299], [8e299]], [1, 3, 2, 4]).coefficients).toEqual([2.948275862068965, -6.896551724137921e-301]);
  });
});

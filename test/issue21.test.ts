// Issue #21: varimax and factanal with a row of zero loadings (review_fix_log_issue21.md).
import { describe, expect, it } from "vitest";
import { factanal } from "../src/index.js";
import { varimax } from "../src/descriptive/factanal.js";

// a correlation matrix whose first variable is uncorrelated with the others (R: set.seed(1), two blocks of 3 and 2)
const v = [1, 0, 0, 0, 0, 0, 0, 1, 0.89875062415390001, -0.088538473624144558, -0.0605862550950045, -0.066000800825803605, 0, 0.89875062415390001, 1, -0.039588367161183463, -0.020287116624151209, -0.0050080142482852965, 0, -0.088538473624144558, -0.039588367161183463, 1, 0.95787847871703189, 0.95644244279883459, 0, -0.0605862550950045, -0.020287116624151209, 0.95787847871703189, 1, 0.93115805345878115, 0, -0.066000800825803605, -0.0050080142482852965, 0.95644244279883459, 0.93115805345878115, 1];
const S = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => v[i + 6 * j]!));

describe("issue #21", () => {
  it("rotates the other rows and keeps a zero row 0", () => {
    // the Kaiser normalisation divided the zero row by 0 and the SVD failed (R's varimax too); R's varimax of the
    // other four rows: loadings and rotation
    const r = varimax([[0, 0], [0.8, 0.1], [0.1, 0.7], [0.75, 0.12], [0.08, 0.72]]);
    const want = [[0.8000032671981337, 0.099973858944786], [0.1000228733232119, 0.699996732001063], [0.7500039207498728, 0.119975492746723], [0.0800235268589349, 0.719997385515432]];
    expect(r.loadings[0]).toEqual([0, 0]);
    want.forEach((row, i) => row.forEach((w, j) => expect(Math.abs(r.loadings[i + 1]![j]! - w)).toBeLessThan(1e-14)));
    expect(Math.abs(r.rotmat[0]![1]! - -0.000032676252283888)).toBeLessThan(1e-15);
  });

  it("factanal with an isolated variable returns finite rotated loadings", () => {
    // R's factanal(covmat = S, factors = 2) fails in varimax ("infinite or missing values in 'x'")
    for (const rotation of ["varimax", "promax"] as const) {
      const f = factanal(null, 2, { covmat: S, rotation });
      expect(f.loadings[0]).toEqual([0, 0]);
      expect(f.loadings.flat().every(Number.isFinite)).toBe(true);
    }
  });
});

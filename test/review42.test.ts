// Fixes of the 42nd round (review_fix_log_20261031_42.md): aovEz judges the rank of the error SSP matrix against the
// sum of squares of the data too (R13 of the 3rd round), on R PEP R' (M = R'R), whatever the contrasts (154, 38th).
import { describe, expect, it } from "vitest";
import { aovEz } from "../src/index.js";

// set.seed(1); rnorm(24) in R 4.5.2
const noise = [
  -0.62645381074233244, 0.18364332422208225, -0.83562861241004711, 1.5952808021377916, 0.32950777181536051, -0.82046838411801524,
  0.48742905242848531, 0.73832470512921731, 0.57578135165349229, -0.30538838715635603, 1.511781168450848, 0.38984323641143108,
  -0.62124058054180376, -2.2146998871774985, 1.1249309181431082, -0.044933609015230855, -0.016190263098946087, 0.94383621068529919,
  0.82122119509808851, 0.59390132121750883, 0.91897737160821826, 0.7821363007310671, 0.074564983365190596, -1.9893516958633729,
];

/** 6 subjects x 4 conditions: (offset + s_i + c_j + sd * noise) * scale, the subjects varying fastest (as expand.grid) */
function data(scale: number, offset = 0, sd = 0) {
  const s = [0.3, 1.7, 2.2, 0.9, 1.1, 2.9];
  const c = [0.1, 0.5, 0.2, 0.7];
  const d = { id: [] as string[], cond: [] as string[], y: [] as number[] };
  c.forEach((cj, j) =>
    s.forEach((si, i) => {
      d.id.push(String(i + 1));
      d.cond.push("abcd"[j]!);
      d.y.push((offset + si + cj + sd * noise[j * 6 + i]!) * scale);
    }),
  );
  return d;
}

describe("review 42", () => {
  it("an error SSP matrix made only of the rounding of additive data counts as 0", () => {
    // afex 1.x on R 4.5.2: no Mauchly test and no corrections, except W = Inf with p = 1 at 1e100 (car's absolute
    // threshold). Here the rounding gave W from 0.03 to 0.75 and GG from 0.50 to 0.86, different at each scale
    for (const [scale, offset] of [[1, 0], [3, 0], [0.1, 0], [1e-5, 0], [1e5, 0], [1e100, 0], [1e-100, 0], [1, 1e8], [0.1, 1e8]] as const) {
      const r = aovEz(data(scale, offset), { id: "id", dv: "y", within: "cond" });
      expect(r.sphericity, `${scale} ${offset}`).toBeUndefined();
      expect(r.corrections, `${scale} ${offset}`).toBeUndefined();
      expect(r.warnings.some((w) => w.includes("The error SSP matrix of cond is 0 (or at the rounding level of the data)"))).toBe(true);
    }
  });
  it("a genuine error SSP matrix gives the same test at any scale", () => {
    // afex on R 4.5.2 with sd 1 at scale 1. The additive part drops out of the error, so sd 1e-3 gives the same W and
    // epsilons (as afex at scale 1); at 1e-5 afex gives nothing, at 1e100 W = Inf
    for (const sd of [1, 1e-3]) {
      for (const scale of [1, 1e-5, 1e100, 1e-100]) {
        const r = aovEz(data(scale, 0, sd), { id: "id", dv: "y", within: "cond" });
        const [w, p] = r.sphericity!.table[0]!;
        expect(w).toBeCloseTo(0.615120093157913, 9);
        expect(p).toBeCloseTo(0.878972063493243, 9);
        const [gg, , hf] = r.corrections!.table[0]!;
        expect(gg).toBeCloseTo(0.739057849092167, 9);
        expect(hf).toBeCloseTo(1.35390420203854, 9);
        expect(r.warnings.some((w) => w.includes("error SSP matrix"))).toBe(false);
      }
    }
  });
});

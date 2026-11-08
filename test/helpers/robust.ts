// Fits and comparisons of the robust-covariance fixtures (oracle/_robust.R)
import { glm, lm, type GlmResult, type LmResult } from "../../src/index.js";
import { glmArgs } from "./glm.js";
import { num } from "./fixture.js";
import { arg, defined, type HTestCase } from "./htest.js";

export type Fit = LmResult | GlmResult;

/** The fit of a case (oracle/_robust.R: the matrix interface of lm or glm) */
export function robustFit(a: HTestCase["args"]): Fit {
  if (a.model === "lm") {
    return lm(arg.mat(a.x)!, arg.vec(a.y)!, defined({ weights: arg.vec(a.weights), intercept: arg.bool(a.intercept) }));
  }
  const { x, y, options } = glmArgs(a);
  return glm(x, y, options);
}

export const mat = (v: unknown): number[][] => (v as string[][]).map((r) => r.map(num));

/**
 * The largest error of the entries of V against E, relative to sqrt(d_i d_j) with d the diagonal of E (or `scale` when
 * given); NaN entries must match
 */
export function matrixError(V: number[][], E: number[][], scale?: readonly number[]): number {
  if (V.length !== E.length) return Infinity;
  let worst = 0;
  E.forEach((r, i) =>
    r.forEach((e, j) => {
      const v = V[i]![j]!;
      if (Number.isNaN(e) || Number.isNaN(v)) {
        if (!(Number.isNaN(e) && Number.isNaN(v))) worst = Infinity;
        return;
      }
      if (v === e) return;
      const d = scale ?? E.map((row, k) => row[k]!);
      const s = Math.sqrt(Math.abs(d[i]! * d[j]!));
      worst = Math.max(worst, Math.abs(v - e) / (s > 0 ? s : Math.abs(e)));
    }),
  );
  return worst;
}


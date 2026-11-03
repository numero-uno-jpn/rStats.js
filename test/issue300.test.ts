// Issue #300: lmerHypotheses' absolute cutoff 1e-8 on the type III hypothesis columns. lmerHypotheses is internal; its
// matrix is ginv(X_t) times the full-dummy matrix, which holds the same predictor columns, so it does not depend on the
// units of the predictors, and lmerAnova keeps both terms with x and z multiplied by 1e10.
import { describe, expect, it } from "vitest";
import * as api from "../src/index.js";
import * as mixed from "../src/entries/mixed.js";
import { lmer, lmerAnova } from "../src/entries/mixed.js";

const data = { y: [1, 2, 1, 3, 2, 4], x: [-3, -2, -1, 1, 2, 3], z: [1, -1, 0, 0, -1, 1], g: ["a", "a", "b", "b", "c", "c"] };

describe("issue #300", () => {
  it("lmerHypotheses and fixedEffectsDescription are not part of the public API", () => {
    for (const name of ["lmerHypotheses", "fixedEffectsDescription"]) {
      expect(name in api).toBe(false);
      expect(name in mixed).toBe(false);
    }
  });

  it("the type III table keeps both slopes with the predictors multiplied by 1e10", () => {
    const big = { ...data, x: data.x.map((v) => v * 1e10), z: data.z.map((v) => v * 1e10) };
    const one = lmerAnova(lmer("y ~ 0 + x + z + (1 | g)", data), { type: "III" });
    const scaled = lmerAnova(lmer("y ~ 0 + x + z + (1 | g)", big), { type: "III" });
    expect(scaled.terms).toEqual(["x", "z"]);
    // lmerTest (R 4.5.2) at both scales: F 23.2203 and 1.4822, DenDF 1.17784 and 0.98209
    for (const key of ["F", "denDF", "pValue"] as const) {
      (scaled[key] as number[]).forEach((v, i) => expect(Math.abs(v / (one[key] as number[])[i]! - 1)).toBeLessThan(1e-12));
    }
    expect(Math.abs(scaled.F[0]! / 23.2203 - 1)).toBeLessThan(1e-5);
    expect(Math.abs(scaled.F[1]! / 1.4822 - 1)).toBeLessThan(1e-4);
  });
});

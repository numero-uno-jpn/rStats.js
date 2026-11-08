// mcreg: x and y in very different units (Deming scales them separately), weighted Deming with data spanning more
// than 1e154 (weights beyond the double range), and rngSeed in a session whose generator was never seeded.
import { describe, expect, it } from "vitest";
import { mcreg, runif, setSeed, type McregResult } from "../src/index.js";

const rel = (a: number, b: number): number => (a === b ? 0 : Math.abs(a - b) / Math.abs(b));
const x = [1, 2, 3, 4, 5, 6, 7, 8.5, 9, 10.2];
const y = [1.2, 1.9, 3.2, 3.8, 5.1, 6.4, 6.6, 8.1, 9.4, 10];
const parts = (r: McregResult): number[] => [
  r.intercept.estimate,
  r.intercept.se,
  ...r.intercept.confInt,
  r.slope.estimate,
  r.slope.se,
  ...r.slope.confInt,
];

describe("mcreg: scaling", () => {
  // first in this file: nothing has drawn from the generator yet
  it("rngSeed in a session that was never seeded leaves the stream of set.seed(rngSeed) in place, as mcr", () => {
    const o = { methodReg: "Deming", methodCi: "bootstrap", nsamples: 30, rngSeed: 1 } as const;
    mcreg(x, y, o);
    const after = runif(1)[0];
    // the same draws from set.seed(1) on the global stream (without rngSeed the resamples continue it)
    setSeed(1);
    const { rngSeed: _, ...unseeded } = o;
    mcreg(x, y, unseeded);
    expect(after).toBe(runif(1)[0]);
    // with a state, it is restored
    setSeed(5);
    const next = runif(1)[0];
    setSeed(5);
    mcreg(x, y, o);
    expect(runif(1)[0]).toBe(next);
  });

  it("Deming with x and y in very different units", () => {
    for (const ciMethod of ["analytical", "jackknife"] as const) {
      // y in units 2^-400 or 2^400 with the error ratio in the same units: the fit of (x, y, λ) with y, the
      // intercept, the slope and their standard errors times c (it was 94% off at 2^-400 and an error at 2^400)
      const base = parts(mcreg(x, y, { methodReg: "Deming", methodCi: ciMethod, errorRatio: 2 }));
      for (const e of [-400, 400]) {
        const c = 2 ** e;
        const got = parts(mcreg(x, y.map((v) => v * c), { methodReg: "Deming", methodCi: ciMethod, errorRatio: 2 / (c * c) }));
        got.forEach((v, i) => expect(rel(v, base[i]! * c), `${ciMethod} 2^${e} [${i}]`).toBeLessThanOrEqual(1e-14));
      }
      // y in units 2^-600 with the error ratio 1: the ratio 2^-1200 of y's units is the least-squares limit, the fit of
      // (x, y) with the error ratio 1e-300 times 2^-600 (the standard errors were NaN)
      const ols = parts(mcreg(x, y, { methodReg: "Deming", methodCi: ciMethod, errorRatio: 1e-300 }));
      const tiny = parts(mcreg(x, y.map((v) => v * 2 ** -600), { methodReg: "Deming", methodCi: ciMethod }));
      tiny.forEach((v, i) => expect(rel(v, ols[i]! * 2 ** -600), `${ciMethod} 2^-600 [${i}]`).toBeLessThanOrEqual(1e-14));
    }
  });

  it("weighted Deming with data spanning more than 1e154 (the weights 1/m² overflowed)", () => {
    const fit = (e: number): McregResult => {
      const xe = [e, 2 * e, 1, 2, 3, 4];
      const ye = [1.1 * e, 1.9 * e, 1.05, 2.1, 2.9, 4.2];
      return mcreg(xe, ye, { methodReg: "WDeming", threshold: 0, iterMax: 200 });
    };
    // the two smallest points carry the weight: at 1e-150 and 1e-160 the fixed point is the same up to the units of
    // the intercept (1e-160 was a RangeError "the covariance of x and y is 0")
    const a = fit(1e-150);
    for (const e of [1e-160, 1e-200]) {
      const b = fit(e);
      expect(rel(b.slope.estimate, a.slope.estimate), `${e}`).toBeLessThanOrEqual(1e-14);
      expect(rel(b.intercept.estimate / e, a.intercept.estimate / 1e-150), `${e}`).toBeLessThanOrEqual(1e-13);
      // mcr's weights 1/m²: beyond the double range for the smallest points, the others as at 1e-150
      expect(b.weights!.slice(0, 2)).toEqual([Infinity, Infinity]);
      b.weights!.slice(2).forEach((w, i) => expect(rel(w, a.weights![i + 2]!)).toBeLessThanOrEqual(1e-13));
    }
  });
});

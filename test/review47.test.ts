// External review of src/special (SPEC-001..009, review_fix_log_20261031_47.md). Reference values from Rmpfr (200 bits).
import { describe, expect, it } from "vitest";
import { besselI, besselJ, besselK, besselY, erfc, erfcinv, gamma, lbeta } from "../src/index.js";
import { nextDown } from "./helpers/float.js";

const MIN = Number.MIN_VALUE;
const scaled = { exponScaled: true };

function relErr(got: number, want: number): number {
  return Math.abs(got / want - 1);
}

describe("review 47", () => {
  it("SPEC-001: Gamma is finite up to the largest double below its overflow", () => {
    // Gamma(171.6243769563027) = 1.79769313486222987e308 < DBL_MAX; Infinity before. The relative error of gamma
    // beyond 33 is about 1e-14 (R: 1e-13)
    expect(relErr(gamma(171.6243769563027), 1.7976931348622299e308)).toBeLessThan(3e-14);
    expect(gamma(171.62437695630274)).toBe(Infinity);
  });

  it("SPEC-002: Gamma of large negative arguments down to the subnormals", () => {
    // the denominator of the reflection formula overflowed: 0 before
    expect(Math.abs(gamma(-171.5) - 1.931626543171191e-310)).toBeLessThanOrEqual(MIN);
    expect(Math.abs(gamma(-172.5) - -1.119783503288764e-312)).toBeLessThanOrEqual(MIN);
    expect(gamma(-177.5)).toBe(MIN); // 6.73e-324
    expect(gamma(-182.5)).toBe(-0); // -3.5e-335
    // where the denominator is finite, as before
    expect(gamma(-170.5)).toBe(-3.312739521538645e-308);
  });

  it("SPEC-003: lbeta when a + b overflows", () => {
    expect(relErr(lbeta(1e308, 1e308), -1.3862943611198914641e308)).toBeLessThan(1e-15);
    expect(relErr(lbeta(1.7e308, 1e308), -1.7797117603220764265e308)).toBeLessThan(1e-15);
    expect(lbeta(1e308, 1)).toBe(-709.19620864216608);
  });

  it("SPEC-004: erfcinv of subnormal probabilities", () => {
    expect(erfcinv(MIN)).toBe(27.213293210812949); // Infinity before
    expect(relErr(erfcinv(3 * MIN), 27.19311412620397)).toBeLessThan(1e-15); // 3 MIN / 2 rounded
    expect(erfc(erfcinv(MIN))).toBe(MIN);
    // continuous across 2^-1021, where z / 2 becomes exact
    const z = 2 ** -1021;
    expect(relErr(erfcinv(nextDown(z)), erfcinv(z))).toBeLessThan(1e-15);
  });

  it("SPEC-005, SPEC-006: besselI for tiny x", () => {
    expect(besselI(1e-310, 0)).toBe(1); // NaN before
    expect(besselI(1e-310, 0, scaled)).toBe(1);
    expect(besselI(MIN, 0)).toBe(1);
    expect(relErr(besselI(1e-310, 0.5), 7.9788456080286423e-156)).toBeLessThan(1e-15); // Infinity before
    expect(relErr(besselI(MIN, 0.5, scaled), 1.773504888603628e-162)).toBeLessThan(1e-15);
    expect(relErr(besselI(MIN, 0.3), 9.2215966252391492e-98)).toBeLessThan(1e-15); // 0 before ((x/2)^v)
    // continuous across 2^-1000, where the series and sqrt(2x / pi) take over
    const t = 2 ** -1000;
    expect(relErr(besselI(nextDown(t), 0.5), besselI(t, 0.5))).toBeLessThan(1e-15);
    expect(relErr(besselI(nextDown(t), 0.3), besselI(t, 0.3))).toBeLessThan(1e-15);
    expect(besselI(nextDown(t), 0)).toBe(1);
  });

  it("SPEC-008: besselK for subnormal x", () => {
    // log(x / 2) was -Infinity: NaN before
    expect(relErr(besselK(MIN, 0), 744.55600343703964)).toBeLessThan(4e-16);
    expect(relErr(besselK(3 * MIN, 0), 743.45739114837158)).toBeLessThan(4e-16);
    // Temme's series takes exp(u log(x/2)) with log(x/2) = -745, which rounds to 1.6e-14 relative (R likewise)
    expect(relErr(besselK(MIN, 0.3), 1.807351518830335e97)).toBeLessThan(5e-14);
    expect(relErr(besselK(MIN, 0.7), 2.1743775086912542e226)).toBeLessThan(5e-14);
    expect(besselK(MIN, 1)).toBe(Infinity); // 1/x
    expect(relErr(besselI(MIN, -0.3), 9.3085148507228119e96)).toBeLessThan(5e-14);
    const z = 2 ** -1021;
    expect(relErr(besselK(nextDown(z), 0), besselK(z, 0))).toBeLessThan(1e-15);
  });

  it("SPEC-007 and the same causes in besselY and besselJ for tiny x", () => {
    expect(relErr(besselY(1e-310, 0), -454.49387560035387)).toBeLessThan(4e-16);
    expect(relErr(besselY(MIN, 0), -473.99907342300429)).toBeLessThan(4e-16); // NaN before
    expect(besselY(MIN, 1)).toBe(-Infinity); // NaN before
    expect(relErr(besselY(MIN, 0.3), -1.1505957125059705e97)).toBeLessThan(1e-15); // NaN before
    expect(relErr(besselJ(MIN, -0.3), 9.3085148507228119e96)).toBeLessThan(1e-15); // NaN before
    expect(relErr(besselJ(MIN, 0.3), 9.2215966252391492e-98)).toBeLessThan(1e-15); // 0 before
    // 2e-14 before; the correctly rounded value at the double 1e-310 (Rmpfr; the reference was 2.8 ulp off, #89)
    expect(relErr(besselY(1e-310, 0.5), -7.978845608028666e154)).toBeLessThan(4e-16);
  });
});

describe("review 47 large order", () => {
  it("SPEC-007: besselY for x below 1e-308 returns at once", () => {
    // the continued fraction ran 1e8 NaN steps (1.4 s)
    const t0 = performance.now();
    besselY(1e-310, 0);
    besselY(MIN, 2);
    expect(performance.now() - t0).toBeLessThan(200);
  });

  it("SPEC-009: results far out of range at large orders return at once", () => {
    const t0 = performance.now();
    expect(besselK(1, 1e12)).toBe(Infinity);
    expect(besselY(1, 1e12)).toBe(-Infinity);
    expect(besselY(10, 1e12)).toBe(-Infinity);
    expect(besselJ(1e7, 1e12)).toBe(0);
    expect(besselI(1e12, 1e12)).toBe(Infinity);
    expect(besselI(1e12, 1e12, scaled)).toBe(0);
    expect(besselK(1e12, 1e12)).toBe(0);
    expect(besselK(1e12, 1e12, scaled)).toBe(Infinity);
    // negative orders through the reflection formulas
    expect(besselI(1, -1e12 - 0.25)).toBe(Infinity);
    expect(besselY(1, -1e12 - 0.25)).toBe(-Infinity);
    expect(besselY(1, -1e12 - 0.5)).toBe(0); // cos(pi v) = 0: sin(pi v) J_v
    expect(besselJ(1, -1e12 - 0.25)).toBe(Infinity);
    // 4 to 6 s each before
    expect(besselK(1e8, 2e8)).toBe(Infinity);
    expect(besselY(10, 1e8)).toBe(-Infinity);
    expect(performance.now() - t0).toBeLessThan(500);
    // near the limits the bounds do not decide and the values are computed as before (R: -6.9607110114750608e194,
    // 1.1025714402933915e-144)
    expect(besselY(500, 1001)).toBe(-6.9607110114749359e194);
    expect(besselI(500, 1001)).toBe(1.1025714402933864e-144);
  });
});

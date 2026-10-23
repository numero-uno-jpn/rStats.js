import { describe, expect, it } from "vitest";
import { besselI, besselJ, besselK, besselY } from "../src/index.js";
import { bool, hasFixture, num } from "./helpers/fixture.js";
import { referenceSuite } from "./helpers/mpmath.js";
import { fixtureSuite } from "./helpers/suite.js";

const opt = (a: Record<string, string | boolean>) => ({ exponScaled: bool(a.exponScaled) });

// R fixtures from oracle/bessel.R (npm run oracle -- bessel); until they are generated only the mpmath values are used
if (hasFixture("besselI")) {
  fixtureSuite({ name: "besselI", tolerance: 1e-14, call: (a) => besselI(num(a.x), num(a.nu), opt(a)) });
  fixtureSuite({ name: "besselK", tolerance: 1e-14, call: (a) => besselK(num(a.x), num(a.nu), opt(a)) });
  fixtureSuite({ name: "besselJ", tolerance: 1e-14, call: (a) => besselJ(num(a.x), num(a.nu)) });
  fixtureSuite({ name: "besselY", tolerance: 1e-14, call: (a) => besselY(num(a.x), num(a.nu)) });
}

referenceSuite({ name: "besselI", tolerance: 1e-14, call: (a) => besselI(num(a.x), num(a.nu), opt(a)) });
referenceSuite({ name: "besselK", tolerance: 1e-14, call: (a) => besselK(num(a.x), num(a.nu), opt(a)) });
referenceSuite({ name: "besselJ", tolerance: 1e-14, call: (a) => besselJ(num(a.x), num(a.nu)) });
referenceSuite({ name: "besselY", tolerance: 1e-14, call: (a) => besselY(num(a.x), num(a.nu)) });

for (const f of ["besselI", "besselK"] as const) {
  const fn = f === "besselI" ? besselI : besselK;
  referenceSuite({ name: `${f}_random`, tolerance: 1e-14, call: (a) => fn(num(a.x), num(a.nu), opt(a)) });
}
referenceSuite({ name: "besselJ_random", tolerance: 1e-14, call: (a) => besselJ(num(a.x), num(a.nu)) });
referenceSuite({ name: "besselY_random", tolerance: 1e-14, call: (a) => besselY(num(a.x), num(a.nu)) });

// Special values and identities. x = 0 and infinite x follow the limits; to be confirmed against R by oracle/bessel.R
describe("Bessel functions: special values and identities", () => {
  it("x = 0, infinite x, NaN and negative x", () => {
    expect(besselJ(0, 0)).toBe(1);
    expect(besselJ(0, 2)).toBe(0);
    expect(besselY(0, 0)).toBe(-Infinity);
    expect(besselI(0, 0)).toBe(1);
    expect(besselI(0, 1)).toBe(0);
    expect(besselK(0, 1)).toBe(Infinity);
    expect(besselJ(Infinity, 1)).toBe(0);
    expect(besselI(Infinity, 1)).toBe(Infinity);
    expect(besselI(Infinity, 1, { exponScaled: true })).toBe(0);
    expect(besselK(Infinity, 1)).toBe(0);
    expect(besselJ(-1, 0)).toBeNaN();
    expect(besselK(-1, 0)).toBeNaN();
    expect(besselJ(1, NaN)).toBeNaN();
  });
  it("integer negative orders and the symmetry of K", () => {
    for (const x of [0.5, 3, 40]) {
      expect(besselJ(x, -3)).toBe(-besselJ(x, 3));
      expect(besselY(x, -3)).toBe(-besselY(x, 3));
      expect(besselI(x, -3)).toBe(besselI(x, 3));
      expect(besselK(x, -2.5)).toBe(besselK(x, 2.5));
    }
  });
  it("half-integer orders have closed forms", () => {
    const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(2e-15 * Math.abs(b));
    for (const x of [0.1, 1, 7.5]) {
      const r = Math.sqrt(2 / (Math.PI * x));
      close(besselJ(x, 0.5), r * Math.sin(x));
      close(besselY(x, 0.5), -r * Math.cos(x));
      close(besselJ(x, -0.5), r * Math.cos(x));
      close(besselI(x, 0.5), r * Math.sinh(x));
      close(besselK(x, 0.5), Math.sqrt(Math.PI / (2 * x)) * Math.exp(-x));
    }
  });
});

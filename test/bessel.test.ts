import { describe, expect, it } from "vitest";
import { besselI, besselJ, besselK, besselY } from "../src/index.js";
import { bool, hasFixture, num } from "./helpers/fixture.js";
import { loadReference, referenceSuite } from "./helpers/mpmath.js";
import { fixtureSuite } from "./helpers/suite.js";

const opt = (a: Record<string, string | boolean>) => ({ exponScaled: bool(a.exponScaled) });

/**
 * Where J and Y oscillate (and for negative orders, a sum of two terms) the result can be much smaller than the
 * terms that cancel in it. There the error is measured relative to the size of those terms, as recorded in the
 * mpmath fixture (`scale`), and R happens to be closer to the small result.
 */
function cancellation(name: string): (args: Record<string, string | boolean>, e: number, actual: number) => string | undefined {
  const cases = new Map(loadReference(name).cases.map((c) => [JSON.stringify(c.args), c]));
  return (args, _e, actual) => {
    const c = cases.get(JSON.stringify(args));
    if (c?.scale === undefined) return undefined;
    const t = num(c.expected);
    const err = Math.abs(actual - t) / Math.max(Math.abs(t), num(c.scale));
    return err <= 1e-14 ? "result much smaller than the cancelling terms; checked against mpmath relative to them" : undefined;
  };
}

// R fixtures from oracle/bessel.R (npm run oracle -- bessel). Where R is inaccurate, the cases pass by the
// mpmath values in <name>.ref.json
if (hasFixture("besselI")) {
  fixtureSuite({ name: "besselI", tolerance: 1e-14, call: (a) => besselI(num(a.x), num(a.nu), opt(a)) });
  fixtureSuite({ name: "besselK", tolerance: 1e-14, call: (a) => besselK(num(a.x), num(a.nu), opt(a)) });
  fixtureSuite({
    name: "besselJ",
    tolerance: 1e-14,
    call: (a) => besselJ(num(a.x), num(a.nu)),
    knownDifference: cancellation("besselJ"),
  });
  fixtureSuite({
    name: "besselY",
    tolerance: 1e-14,
    call: (a) => besselY(num(a.x), num(a.nu)),
    knownDifference: cancellation("besselY"),
  });
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

// Special values and identities. x = 0 and infinite x follow the limits (checked against R 4.5.2 by the R fixtures)
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

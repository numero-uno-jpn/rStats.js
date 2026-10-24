import { describe, expect, it } from "vitest";
import { choose, factorial, lchoose, lfactorial } from "../src/index.js";
import { hasFixture, num } from "./helpers/fixture.js";
import { referenceSuite } from "./helpers/mpmath.js";
import { fixtureSuite } from "./helpers/suite.js";

// R fixtures from oracle/choose.R (npm run oracle -- choose). Where R is inaccurate, the cases pass by the mpmath
// values in <name>.ref.json
if (hasFixture("choose")) {
  fixtureSuite({ name: "choose", tolerance: 1e-14, call: (a) => choose(num(a.n), num(a.k)) });
  fixtureSuite({ name: "lchoose", tolerance: 1e-14, call: (a) => lchoose(num(a.n), num(a.k)) });
  fixtureSuite({ name: "factorial", tolerance: 1e-14, call: (a) => factorial(num(a.x)) });
  fixtureSuite({ name: "lfactorial", tolerance: 1e-14, call: (a) => lfactorial(num(a.x)) });
}

// The mpmath values are the mathematical function, without R's rounding of n near an integer
const exact = { rCompatible: false };
referenceSuite({ name: "choose", tolerance: 1e-14, call: (a) => choose(num(a.n), num(a.k), exact) });
referenceSuite({ name: "lchoose", tolerance: 1e-14, call: (a) => lchoose(num(a.n), num(a.k), exact) });
referenceSuite({ name: "factorial", tolerance: 1e-14, call: (a) => factorial(num(a.x)) });
referenceSuite({ name: "lfactorial", tolerance: 1e-14, call: (a) => lfactorial(num(a.x)) });
// k - n not exact in double precision (scripts/mpmath/regions.py)
referenceSuite({ name: "choose_regions", tolerance: 1e-14, call: (a) => choose(num(a.n), num(a.k), exact) });

// Special values, checked against R 4.5.2
describe("choose and factorial special values", () => {
  it("handles k <= 0, NaN and infinite n", () => {
    expect(choose(5, -1)).toBe(0);
    expect(lchoose(5, -1)).toBe(-Infinity);
    expect(choose(5, 0)).toBe(1);
    expect(choose(NaN, 0)).toBeNaN();
    expect(choose(5, NaN)).toBeNaN();
    expect(choose(Infinity, 3)).toBe(Infinity);
    expect(choose(-Infinity, 3)).toBe(-Infinity);
    expect(choose(-Infinity, 28)).toBe(Infinity);
    expect(choose(Infinity, 30)).toBeNaN();
    expect(lchoose(Infinity, 1)).toBe(Infinity);
    expect(lchoose(-Infinity, 2)).toBeNaN();
    expect(choose(5, Infinity)).toBe(0);
    expect(choose(0.5, Infinity)).toBe(0);
    expect(choose(-0.5, Infinity)).toBeNaN();
    expect(choose(Infinity, Infinity)).toBeNaN();
    expect(lchoose(5, Infinity)).toBe(-Infinity);
    expect(lchoose(-3, Infinity)).toBeNaN();
    expect(choose(5, -Infinity)).toBe(0);
  });
  it("treats n within 1e-9 max(1, |n|) of an integer as an integer, as R does", () => {
    expect(choose(5 + 1e-9, 2)).toBe(10);
    expect(choose(5 + 1e-8, 2)).not.toBe(10);
    expect(choose(1e-10, 2)).toBe(0);
    expect(choose(1e-10, 1)).toBe(0);
    expect(choose(-1e-10, 1)).toBe(-0);
    expect(choose(-1e-10, 2)).toBe(0);
    expect(choose(3 - 1e-9, 2)).toBe(3);
    expect(choose(3 + 1e-9, 40)).toBe(0);
    expect(choose(50 + 1e-9, 40)).toBe(10272278170);
    expect(choose(-1e-10, 31)).toBe(-0);
    expect(choose(-1e-10, 40)).toBe(0);
    // R keeps n in the product for k < 30, so a large n is not rounded
    expect(choose(1e6 + 5e-8, 3)).toBeCloseTo(1.6666616666702496e17, -3);
    // for n < 0 and k >= 30 R tests k - 1 - n, so the tolerance is relative to it
    expect(choose(-3 + 1e-8, 30)).toBe(choose(-3, 30));
    expect(lchoose(-3 + 1e-9, 2)).toBeCloseTo(Math.log(6), 15);
    expect(lchoose(5 + 1e-9, 2)).toBeCloseTo(Math.log(10), 15);
    expect(lchoose(1e-10, 2)).toBe(-Infinity);
    // lchoose(n, 1) is log|n| without rounding
    expect(lchoose(1e-10, 1)).toBe(Math.log(1e-10));
  });
  it("rCompatible: false returns the mathematical values", () => {
    const exact = { rCompatible: false };
    expect(choose(1e-10, 2, exact)).toBeCloseTo(-4.9999999995e-11, 24);
    expect(choose(5 + 1e-9, 2, exact)).toBeCloseTo(10.0000000045, 12);
    expect(lchoose(1e-10, 2, exact)).toBeCloseTo(Math.log(4.9999999995e-11), 12);
    expect(choose(Infinity, 30, exact)).toBe(Infinity);
    expect(choose(-Infinity, 31, exact)).toBe(-Infinity);
    expect(lchoose(Infinity, 2, exact)).toBe(Infinity);
    expect(choose(5, Infinity, exact)).toBeNaN();
    expect(lchoose(5, Infinity, exact)).toBeNaN();
  });
  it("returns exact integers for integer n", () => {
    expect(choose(50, 25)).toBe(126410606437752);
    expect(choose(40, 31)).toBe(273438880);
    expect(choose(-40, 31)).toBe(-choose(70, 31));
    expect(choose(4, 7)).toBe(0);
    expect(choose(-4, 3)).toBe(-20);
  });
  it("rounds k to the nearest integer, ties to even", () => {
    expect(choose(5, 2.2)).toBe(10);
    expect(choose(5, 2.5)).toBe(10);
    expect(choose(5, 3.5)).toBe(5);
  });
  it("factorial is NaN at negative integers", () => {
    expect(factorial(-1)).toBeNaN();
    expect(factorial(171)).toBe(Infinity);
    expect(lfactorial(-1)).toBe(Infinity);
  });
});

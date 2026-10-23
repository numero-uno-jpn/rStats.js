import { describe, expect, it } from "vitest";
import { choose, factorial, lchoose, lfactorial } from "../src/index.js";
import { hasFixture, num } from "./helpers/fixture.js";
import { referenceSuite } from "./helpers/mpmath.js";
import { fixtureSuite } from "./helpers/suite.js";

// R fixtures from oracle/choose.R (npm run oracle -- choose); until they are generated only the mpmath values are used
if (hasFixture("choose")) {
  fixtureSuite({ name: "choose", tolerance: 1e-14, call: (a) => choose(num(a.n), num(a.k)) });
  fixtureSuite({ name: "lchoose", tolerance: 1e-14, call: (a) => lchoose(num(a.n), num(a.k)) });
  fixtureSuite({ name: "factorial", tolerance: 1e-14, call: (a) => factorial(num(a.x)) });
  fixtureSuite({ name: "lfactorial", tolerance: 1e-14, call: (a) => lfactorial(num(a.x)) });
}

referenceSuite({ name: "choose", tolerance: 1e-14, call: (a) => choose(num(a.n), num(a.k)) });
referenceSuite({ name: "lchoose", tolerance: 1e-14, call: (a) => lchoose(num(a.n), num(a.k)) });
referenceSuite({ name: "factorial", tolerance: 1e-14, call: (a) => factorial(num(a.x)) });
referenceSuite({ name: "lfactorial", tolerance: 1e-14, call: (a) => lfactorial(num(a.x)) });

// Special values, following R's documentation (?choose, ?factorial). To be confirmed against R by oracle/choose.R
describe("choose and factorial special values", () => {
  it("handles k <= 0, NaN and infinite n", () => {
    expect(choose(5, -1)).toBe(0);
    expect(lchoose(5, -1)).toBe(-Infinity);
    expect(choose(5, 0)).toBe(1);
    expect(choose(NaN, 0)).toBeNaN();
    expect(choose(5, NaN)).toBeNaN();
    expect(choose(Infinity, 3)).toBe(Infinity);
    expect(choose(-Infinity, 3)).toBe(-Infinity);
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

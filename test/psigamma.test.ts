import { describe, expect, it } from "vitest";
import { digamma, psigamma, trigamma } from "../src/index.js";
import { hasFixture, num } from "./helpers/fixture.js";
import { referenceSuite } from "./helpers/mpmath.js";
import { fixtureSuite } from "./helpers/suite.js";

// R fixtures from oracle/psigamma.R (npm run oracle -- psigamma); until they are generated only the mpmath values are used
if (hasFixture("digamma")) {
  fixtureSuite({ name: "digamma", tolerance: 1e-14, call: (a) => digamma(num(a.x)) });
  fixtureSuite({ name: "trigamma", tolerance: 1e-14, call: (a) => trigamma(num(a.x)) });
  fixtureSuite({ name: "psigamma", tolerance: 1e-14, call: (a) => psigamma(num(a.x), num(a.deriv)) });
}

referenceSuite({ name: "digamma", tolerance: 1e-14, call: (a) => digamma(num(a.x)) });
referenceSuite({ name: "trigamma", tolerance: 1e-14, call: (a) => trigamma(num(a.x)) });
// For x < 0 the reflection term is a polynomial of degree deriv + 1 in cot(pi x), which multiplies the relative
// error of cot by up to deriv + 1 (1.8e-14 at x = -100.3, deriv = 100)
referenceSuite({ name: "psigamma", tolerance: 2e-14, call: (a) => psigamma(num(a.x), num(a.deriv)) });

// Special values. Poles: psi^(n) tends to +Infinity from both sides for odd n and changes sign for even n.
// To be confirmed against R by oracle/psigamma.R
describe("digamma, trigamma and psigamma special values", () => {
  it("poles, infinities and NaN", () => {
    expect(digamma(0)).toBeNaN();
    expect(digamma(-3)).toBeNaN();
    expect(trigamma(0)).toBe(Infinity);
    expect(trigamma(-3)).toBe(Infinity);
    expect(psigamma(-2, 2)).toBeNaN();
    expect(psigamma(-2, 3)).toBe(Infinity);
    expect(digamma(Infinity)).toBe(Infinity);
    expect(digamma(-Infinity)).toBeNaN();
    expect(trigamma(Infinity)).toBe(0);
    expect(digamma(NaN)).toBeNaN();
    // near a pole the reflection term overflows to the infinity of the right sign
    expect(trigamma(-3.5e-242)).toBe(Infinity);
    expect(psigamma(-1e-200, 2)).toBe(Infinity);
    expect(psigamma(1e-200, 2)).toBe(-Infinity);
  });
  it("deriv is an integer from 0 to 100", () => {
    expect(psigamma(2.5)).toBe(digamma(2.5));
    expect(psigamma(2.5, 1)).toBe(trigamma(2.5));
    expect(psigamma(2.5, 0.9)).toBe(trigamma(2.5));
    expect(psigamma(2.5, -1)).toBeNaN();
    expect(psigamma(2.5, 101)).toBeNaN();
  });
});

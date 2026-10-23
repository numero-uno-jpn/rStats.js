import { describe, expect, it } from "vitest";
import { erf, erfc } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { referenceSuite } from "./helpers/mpmath.js";

// R has no erf or erfc, so these are checked against mpmath only (scripts/mpmath/erf.py)
referenceSuite({ name: "erf", tolerance: 1e-15, call: (a) => erf(num(a.x)) });
referenceSuite({ name: "erfc", tolerance: 2e-15, call: (a) => erfc(num(a.x)) });

describe("erf and erfc special values", () => {
  it("handles infinities, zero and NaN", () => {
    expect(erf(0)).toBe(0);
    expect(erf(Infinity)).toBe(1);
    expect(erf(-Infinity)).toBe(-1);
    expect(erfc(Infinity)).toBe(0);
    expect(erfc(-Infinity)).toBe(2);
    expect(erf(NaN)).toBeNaN();
    expect(erfc(NaN)).toBeNaN();
  });
});

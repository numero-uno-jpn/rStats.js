import { describe, expect, it } from "vitest";
import { pnorm } from "../src/index.js";
import { bool, checkFixture, formatMismatches, loadFixture, num } from "./helpers/fixture.js";

const TOLERANCE = 1e-14;

describe("pnorm", () => {
  const fixture = loadFixture("pnorm");

  it(`matches R (${fixture.r_version})`, () => {
    const result = checkFixture(
      fixture,
      (a) =>
        pnorm(num(a.q), {
          mean: num(a.mean),
          sd: num(a.sd),
          lowerTail: bool(a.lowerTail),
          logP: bool(a.logP),
        }),
      TOLERANCE,
    );
    console.log(`pnorm: ${result.total} cases, max relative error ${result.maxRelError.toExponential(2)}`);
    expect(result.mismatches, formatMismatches(result.mismatches)).toHaveLength(0);
  });

  it("returns arrays and Float64Array with the same type", () => {
    const arr = pnorm([-1, 0, 1]);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr[1]).toBe(0.5);
    const f64 = pnorm(new Float64Array([-1, 0, 1]));
    expect(f64).toBeInstanceOf(Float64Array);
    expect(f64[1]).toBe(0.5);
  });
});

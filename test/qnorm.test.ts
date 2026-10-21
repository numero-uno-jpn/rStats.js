import { describe, expect, it } from "vitest";
import { qnorm } from "../src/index.js";
import { bool, checkFixture, formatMismatches, loadFixture, num } from "./helpers/fixture.js";

const TOLERANCE = 1e-14;

describe("qnorm", () => {
  const fixture = loadFixture("qnorm");

  it(`matches R (${fixture.r_version})`, () => {
    const result = checkFixture(
      fixture,
      (a) =>
        qnorm(num(a.p), {
          mean: num(a.mean),
          sd: num(a.sd),
          lowerTail: bool(a.lowerTail),
          logP: bool(a.logP),
        }),
      TOLERANCE,
    );
    console.log(`qnorm: ${result.total} cases, max relative error ${result.maxRelError.toExponential(2)}`);
    expect(result.mismatches, formatMismatches(result.mismatches)).toHaveLength(0);
  });

  it("returns arrays and Float64Array with the same type", () => {
    const arr = qnorm([0.25, 0.5, 0.75]);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr[1]).toBe(0);
    const f64 = qnorm(new Float64Array([0.25, 0.5, 0.75]));
    expect(f64).toBeInstanceOf(Float64Array);
    expect(f64[1]).toBe(0);
  });
});

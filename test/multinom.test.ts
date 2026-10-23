import { describe, expect, it } from "vitest";
import { dmultinom } from "../src/index.js";
import { bool, hasFixture, num } from "./helpers/fixture.js";
import { referenceSuite } from "./helpers/mpmath.js";
import { fixtureSuite } from "./helpers/suite.js";

const vec = (v: string | boolean | string[] | undefined) => (v as unknown as string[]).map((s) => num(s));
const call = (a: Record<string, unknown>) =>
  dmultinom(vec(a.x as string[]), vec(a.prob as string[]), { log: bool(a.log as boolean) });

// R fixture from oracle/multinom.R (npm run oracle -- multinom); until it is generated only the mpmath values are used
if (hasFixture("dmultinom")) fixtureSuite({ name: "dmultinom", tolerance: 1e-14, density: true, call });

referenceSuite({ name: "dmultinom", tolerance: 1e-14, call });

describe("dmultinom arguments", () => {
  it("checks its arguments", () => {
    expect(() => dmultinom([1, 2], [0.5])).toThrow(RangeError);
    expect(() => dmultinom([1, -1], [0.5, 0.5])).toThrow(RangeError);
    expect(() => dmultinom([1, 1.5], [0.5, 0.5])).toThrow(RangeError);
    expect(() => dmultinom([1, 1], [0.5, -0.5])).toThrow(RangeError);
    expect(() => dmultinom([1, 1], [0, 0])).toThrow(RangeError);
    expect(() => dmultinom([1, 1], [0.5, 0.5], { size: 3 })).toThrow(RangeError);
    expect(dmultinom([1, 1], [0.5, 0.5], { size: 2 })).toBe(0.5);
  });
});

// Issue #327: pgeom's upper tail q^(x + 1) where x + 1 rounds (beyond 2^53) (review_fix_log_issue327.md).
import { describe, expect, it } from "vitest";
import { pgeom } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #327", () => {
  it("includes the factor q of the last failure", () => {
    // Rmpfr: (1 - p)^(2^54 + 1) for p = 1e-14 is 0x1.13bd80f2f26d1p-260 (log -0x1.6849b86a12bbbp+7); was 49 ulps off
    const u = 5.8138165687063048e-79;
    expect(rel(pgeom(2 ** 54, 1e-14, { lowerTail: false }), u)).toBeLessThan(4e-16);
    expect(rel(pgeom(2 ** 54, 1e-14, { logP: true }), -u)).toBeLessThan(4e-16);
    expect(pgeom(2 ** 54, 1e-14, { lowerTail: false, logP: true })).toBe(-180.14398509482075);
    // the issue's call: -(2^53 + 1) log 2
    expect(pgeom(2 ** 53, 0.5, { lowerTail: false, logP: true })).toBe(-6243314768165360);
  });

  it("keeps an exact x + 1 as before", () => {
    expect(pgeom(2 ** 53 - 2, 1e-14, { lowerTail: false })).toBe(7.624838731872616e-40);
    expect(pgeom(5, 0.3, { lowerTail: false })).toBe(0.117649);
  });
});

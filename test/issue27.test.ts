// Issue #27: pexp's log of the lower tail for a subnormal rate q (review_fix_log_issue27.md).
import { describe, expect, it } from "vitest";
import { pexp } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #27", () => {
  it("is log rate + log q where rate q is subnormal", () => {
    // the log of the rounded subnormal product: -736.8272408909739 for -736.8272297580946 (R too)
    expect(rel(pexp(1e-20, { rate: 1e-300, logP: true }), Math.log(1e-300) + Math.log(1e-20))).toBeLessThan(1e-15);
    expect(rel(pexp(1e-20, { rate: 1e-300, logP: true }), -736.8272297580946)).toBeLessThan(1e-15);
    const [q, rate] = [9.530984706928441e-97, 4.936871737348155e-227];
    expect(rel(pexp(q, { rate, logP: true }), Math.log(rate) + Math.log(q))).toBeLessThan(1e-15);
  });

  it("leaves a normal rate q as before", () => {
    expect(pexp(1e-10, { rate: 1e-200, logP: true })).toBe(Math.log(-Math.expm1(-1e-210)));
    expect(pexp(2, { rate: 0.5, logP: true })).toBeCloseTo(Math.log(-Math.expm1(-1)), 15);
  });
});

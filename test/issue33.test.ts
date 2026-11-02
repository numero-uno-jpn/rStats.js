// Issue #33: pnorm's log tail where z^2 overflows (review_fix_log_issue33.md).
import { describe, expect, it } from "vitest";
import { pnorm } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);
const tail = (z: number): number => -(z / 2) * z - Math.log(Math.abs(z)) - 0.5 * Math.log(2 * Math.PI);

describe("issue #33", () => {
  it("gives the finite log tail where z^2 overflows but z^2 / 2 does not", () => {
    // (a a) / 2 overflowed: -Infinity; R: -1.125e308
    for (const z of [-1.5e154, -1.8e154]) {
      expect(rel(pnorm(z, { logP: true }), tail(z))).toBeLessThan(1e-15);
      expect(rel(pnorm(-z, { lowerTail: false, logP: true }), tail(z))).toBeLessThan(1e-15);
    }
    expect(rel(pnorm(-1.5e154, { logP: true }), -1.125e308)).toBeLessThan(1e-15);
  });

  it("leaves ordinary z as before", () => {
    expect(pnorm(-40, { logP: true })).toBeCloseTo(-804.6084420137538, 10);
  });
});

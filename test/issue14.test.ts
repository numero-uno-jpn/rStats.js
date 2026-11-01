// Issue #14: barylag with nodes of a large or small scale (review_fix_log_issue14.md).
import { describe, expect, it } from "vitest";
import { barylag } from "../src/index.js";

describe("issue #14", () => {
  it("interpolates at any scale of the nodes", () => {
    // nodes of 1e200: the products of differences overflowed, every weight was 0 and the result NaN (pracma too)
    for (const c of [1e-200, 1e-100, 1, 1e100, 1e200]) {
      const r = barylag([0, c, 2 * c, 3 * c], [0, 1, 4, 9], [0.5 * c, 2.5 * c, c]);
      expect(Math.abs(r[0]! - 0.25)).toBeLessThan(1e-14);
      expect(Math.abs(r[1]! - 6.25)).toBeLessThan(1e-13);
      expect(r[2]).toBe(1); // at a node, its value
    }
    // ordinary nodes as before
    expect(barylag([0, 1, 2], [0, 1, 4], [0.5])).toEqual([0.25000000000000006]);
  });

  it("keeps many nodes of an ordinary scale finite", () => {
    // 200 Chebyshev nodes on [0, 1] (products of differences near 2^-190): as accurate as before
    const xi = Array.from({ length: 200 }, (_, i) => Math.cos((Math.PI * (i + 0.5)) / 200) / 2 + 0.5);
    const yi = xi.map((v) => Math.sin(3 * v));
    const r = barylag(xi, yi, [0.3, 0.71]);
    expect(Math.abs(r[0]! - Math.sin(0.9))).toBeLessThan(1e-12);
    expect(Math.abs(r[1]! - Math.sin(2.13))).toBeLessThan(1e-12);
  });
});

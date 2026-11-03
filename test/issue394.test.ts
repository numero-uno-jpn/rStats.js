// Issue #394: the rk4 fallback of #124 overflowed for large slopes (review_fix_log_issue394.md).
import { describe, expect, it } from "vitest";
import { ode } from "../src/index.js";

const last = (o: number[][]): number => o[o.length - 1]![1]!;

describe("issue #394", () => {
  it("gives the finite increment of a large constant slope", () => {
    // y' = 1e308 over h = 0.5: 5e307 (was Infinity, from h 2^60 times the quarter-weighted slope)
    expect(last(ode([0], [0, 0.5], () => [1e308], [], { method: "rk4" }))).toBe(5e307);
    expect(last(ode([0], [0, 0.5], () => [2 ** 1023], [], { method: "rk4" }))).toBe(2 ** 1022);
    // h 1.5 times the quarter-weighted slope 1.5 2^1023 overflows; the increment 1.5 2^1023 does not
    expect(last(ode([0], [0, 1.5], () => [2 ** 1023], [], { method: "rk4" }))).toBe(1.5 * 2 ** 1023);
  });

  it("keeps the values of #124 and increments that overflow", () => {
    expect(last(ode([0], [0, 1e-308], () => [1e308], [], { method: "rk4" }))).toBe(0.9999999999999999);
    expect(last(ode([0], [0, 2], () => [1e308], [], { method: "rk4" }))).toBe(Infinity);
    expect(last(ode([1], [0, 0.5], (_t, y) => [y[0]!], [], { method: "rk4" }))).toBe(1.6484375);
  });
});

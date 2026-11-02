// Issue #52: mulDD keeps the error term of a finite product of large operands (review_fix_log_issue52.md).
import { describe, expect, it } from "vitest";
import { locationScale, mulDD } from "../src/internal/ddexp.js";

/** x = m 2^e exactly (x finite) */
function exact(x: number): [bigint, number] {
  if (x === 0) return [0n, 0];
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const sign = bits >> 63n ? -1n : 1n;
  const biased = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & 0xfffffffffffffn;
  return biased === 0 ? [sign * frac, -1074] : [sign * (frac | (1n << 52n)), biased - 1075];
}

/** Whether p + e is exactly a b */
function isExactProduct(a: number, b: number, [p, e]: [number, number]): boolean {
  const [ma, ea] = exact(a);
  const [mb, eb] = exact(b);
  const [mp, ep] = exact(p);
  const [me, ee] = exact(e);
  const terms: [bigint, number][] = [
    [ma * mb, ea + eb],
    [-mp, ep],
    [-me, ee],
  ];
  const low = Math.min(...terms.map((t) => t[1]));
  return terms.reduce((s, [m, k]) => s + m * (1n << BigInt(k - low)), 0n) === 0n;
}

describe("issue #52", () => {
  it("keeps the product error where the product cancels the location", () => {
    // the error term was dropped above 1e300: -1.1102230246251565e-16
    expect(locationScale(-1, 1e308, 1e-308)).toBe(-7.969431103331108e-17);
    expect(locationScale(1, -1e308, 1e-308)).toBe(7.969431103331108e-17);
  });

  it("is the exact product below and above 1e300", () => {
    for (const [a, b] of [
      [1e300, 1.2345678901234567e-300],
      [1.0000000000000001e300, 1.2345678901234567e-300],
      [1e308, 1e-308],
      [-1.7976931348623157e308, 3.3e-309],
      [3, 1e305],
    ] as const) {
      const r = mulDD(a, b) as [number, number];
      expect(isExactProduct(a, b, r)).toBe(true);
    }
    expect(mulDD(1e308, 10)).toEqual([Infinity, 0]);
  });
});

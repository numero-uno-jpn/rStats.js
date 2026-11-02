// Issue #62: prodErrScaled scales the error back in one step (review_fix_log_issue62.md).
import { describe, expect, it } from "vitest";
import { ddMul, ddMulNum, twoProd } from "../src/special/dd.js";

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
function isExactProduct(a: number, b: number, [p, e]: readonly number[]): boolean {
  const [ma, ea] = exact(a);
  const [mb, eb] = exact(b);
  const [mp, ep] = exact(p!);
  const [me, ee] = exact(e!);
  const terms: [bigint, number][] = [
    [ma * mb, ea + eb],
    [-mp, ep],
    [-me, ee],
  ];
  const low = Math.min(...terms.map((t) => t[1]));
  return terms.reduce((s, [m, k]) => s + m * (1n << BigInt(k - low)), 0n) === 0n;
}

const PAIRS: [number, number][] = [
  [1e-320, 1e308],
  [1e-308, 1e308],
  [1.7e-308, 1.7976931348623157e308],
  [-3.3e-312, 4.4e305],
];

describe("issue #62", () => {
  it("keeps the error of a small times a huge operand in either order", () => {
    // 2^ka first underflowed the error to 0 when the small operand came first
    for (const [a, b] of PAIRS) {
      const ab = twoProd(a, b);
      const ba = twoProd(b, a);
      expect(ab).toEqual(ba);
      expect(isExactProduct(a, b, ab)).toBe(true);
    }
    expect(twoProd(1e-320, 1e308)[1]).toBe(2.524354896707238e-29);
    expect(twoProd(1e-308, 1e308)[1]).toBe(3.132799142920457e-17);
  });

  it("does the same in ddMul and ddMulNum", () => {
    for (const [a, b] of PAIRS) {
      expect(isExactProduct(a, b, ddMul([a, 0], [b, 0]))).toBe(true);
      expect(isExactProduct(a, b, ddMulNum([a, 0], b))).toBe(true);
      expect(ddMul([a, 0], [b, 0])).toEqual(ddMul([b, 0], [a, 0]));
    }
  });

  it("leaves ordinary products as before", () => {
    expect(twoProd(0.1, 0.3)).toEqual([0.03, 1.6653345369377347e-18]);
    expect(isExactProduct(0.1, 0.3, twoProd(0.1, 0.3))).toBe(true);
    expect(isExactProduct(1e300, 1.2345678901234567e-300, twoProd(1e300, 1.2345678901234567e-300))).toBe(true);
  });
});

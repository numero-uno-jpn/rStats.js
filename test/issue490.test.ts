// Issue #490: besselJ and besselY in the large-x asymptotic expansion. (1) The powers of mu = 4 nu^2 and of x overflow
// for large orders and the sums became NaN (besselJ(1e200, 1e50)); they are now formed as ratios r = nu / x where
// they are not finite. (2) For nu >= 2^52 the 1/4 of the phase pi (nu/2 + 1/4) rounded away (besselJ(1e40, 1e17) was
// 8.3 relative off); nu is reduced modulo 4 there. (3) Where the phase correction nu^2 / (2x) exceeds 2^26 double
// precision does not resolve the phase (the issue's besselJ(1e200, 1e154), 5e107 rad), and a RangeError is thrown
// before the computation (user decision E4, 2026-11-04). References: Rmpfr (1400 bits) of Debye's expansion with u1
// (DLMF 10.19.6, relative error about 1 / x^2), inputs passed as mantissa and power of 2, printed with sprintf("%a").
import { describe, expect, it } from "vitest";
import { besselJ, besselY } from "../src/index.js";

function fromHex(h: string): number {
  const m = /^(-?)0x1\.([0-9a-f]{1,13})p([+-]\d+)$/.exec(h)!;
  const v = Number.parseInt(`1${m[2]!.padEnd(13, "0")}`, 16) * 2 ** -52 * 2 ** Number(m[3]);
  return m[1] === "-" ? -v : v;
}

function rel(a: number, b: number): number {
  return Math.abs(a / b - 1);
}

describe("issue #490", () => {
  it("orders whose powers overflow give finite values (were NaN)", () => {
    for (const [x, nu, j, y] of [
      [1e200, 1e50, "0x1.e99e219923c0ep-337", "-0x1.64196065a1b39p-333"],
      [1e100, 1e45, "0x1.260451e7a8f2ep-168", "-0x1.60b3289c555f8p-167"],
      [1e200, 1e100, "0x1.8b27f153e95cp-334", "-0x1.29d5dee687139p-333"],
      [1e300, 1e150, "-0x1.058e460cf321bp-499", "-0x1.a06b022d189e2p-500"],
      [3e307, 1e153, "-0x1.cac644999c96cp-513", "-0x1.bc492178855c9p-512"],
    ] as [number, number, string, string][]) {
      expect(rel(besselJ(x, nu), fromHex(j))).toBeLessThan(1e-15);
      expect(rel(besselY(x, nu), fromHex(y))).toBeLessThan(1e-15);
    }
  });

  it("orders of 2^52 and above keep the quarter of the phase", () => {
    // were -6.085250558572357e-21 (8.3 relative off) and 5.1605913300854335e-21 (-0.35)
    expect(rel(besselJ(1e40, 1e17), fromHex("-0x1.8b37ba17f7a83p-71"))).toBeLessThan(1e-15);
    expect(rel(besselY(1e40, 1e17), fromHex("0x1.2c6b21c4601ddp-67"))).toBeLessThan(1e-15);
  });

  it("a phase correction nu^2 / (2x) beyond 2^26 is a RangeError", () => {
    const msg = /nu = 1e\+154 has a phase correction nu\^2 \/ \(2x\) of about 5\.00e\+107.*\(at most 2\^26\)/;
    expect(() => besselJ(1e200, 1e154)).toThrow(RangeError);
    expect(() => besselJ(1e200, 1e154)).toThrow(msg);
    expect(() => besselY(1e200, 1e154)).toThrow(msg);
    expect(() => besselJ(1e200, -1e154)).toThrow(RangeError);
    expect(() => besselJ(1e14, 1e12)).toThrow(/besselJ: x = 100000000000000, nu = 1000000000000 has a phase/);
    expect(() => besselY(1e22, 1e18)).toThrow(RangeError);
  });

  it("values below the bound are the ones before", () => {
    expect(besselJ(1e18, 1e13)).toBe(2.39611658978923e-10);
    expect(besselY(1e18, 1e13)).toBe(-7.610558621289115e-10);
    expect(besselJ(1e17, 1e9)).toBe(3.704639707960168e-11);
    expect(besselY(1e5, 100.5)).toBe(0.0025228589330957008);
  });
});

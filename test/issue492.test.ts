// Issue #492: besselI and besselK of large orders. (1) Beyond 2^28 steps of the recurrence of K they threw a RangeError,
// also where the value is finite (the issue's besselI(1e308, 1e154, scaled), 2.42e-155) or plainly Inf or 0. (2) The
// continued fraction of I_(v+1) / I_v stopped at 1e6 terms without notice for x above about 5e10, and besselI(x, nu,
// scaled) was low (1e12, 2e5: -25%; 1e16, 1e7: -99.8%). Both now use Debye's uniform expansion (DLMF 10.41.3/4, u1 to
// u4) for orders above 1000 (user decision E5, 2026-11-04). References: Rmpfr (2000 bits) of Debye's expansion with u0
// to u8 from the recurrence 10.41.9 in exact rationals, inputs passed as mantissa and power of 2, printed with "%a".
import { describe, expect, it } from "vitest";
import { besselI, besselK } from "../src/index.js";

function fromHex(h: string): number {
  const m = /^(-?)0x1\.([0-9a-f]{1,13})p([+-]\d+)$/.exec(h)!;
  const v = Number.parseInt(`1${m[2]!.padEnd(13, "0")}`, 16) * 2 ** -52 * 2 ** Number(m[3]);
  return m[1] === "-" ? -v : v;
}

function rel(a: number, b: number): number {
  return Math.abs(a / b - 1);
}

const scaled = { exponScaled: true };

describe("issue #492", () => {
  it("orders beyond 2^28 give Debye's values (were a RangeError)", () => {
    for (const [x, nu, i, k] of [
      [1e308, 1e154, "0x1.4c374c9bb9449p-514", "0x1.62a12a9f6cc76p-511"],
      [1e200, 1e100, "0x1.b18fe78411836p-335", "0x1.ced02ba6a830bp-332"],
      [1e60, 1e30, "0x1.3a1890b75b50cp-102", "0x1.4f4978dc1de0ap-99"],
      [1e20, 1e10, "0x1.a9aded2da7d1ap-36", "0x1.c6660bd17d412p-33"],
      [3e16, 1e9, "0x1.32dbb68072b2ep-53", "0x1.007d7807e6e5p-3"],
    ] as [number, number, string, string][]) {
      expect(rel(besselI(x, nu, scaled), fromHex(i))).toBeLessThan(2e-15);
      expect(rel(besselK(x, nu, scaled), fromHex(k))).toBeLessThan(2e-15);
    }
    // the exponent nu eta - x = -625 is formed in double: relative error about eps times it
    expect(rel(besselI(2e14, 5e8, scaled), fromHex("0x1.2d92385b321e1p-927"))).toBeLessThan(1e-12);
    expect(rel(besselK(2e14, 5e8, scaled), fromHex("0x1.31d80d7ed8cfp+878"))).toBeLessThan(1e-12);
    // results out of range are Infinity or 0 (were a RangeError)
    expect(besselI(1e308, 1e154)).toBe(Infinity);
    expect(besselK(1e308, 1e154)).toBe(0);
    expect(besselI(3e9, 3e8, scaled)).toBe(0);
    expect(besselK(3e9, 3e8, scaled)).toBe(Infinity);
  });

  it("scaled I where the continued fraction does not converge (was low without notice)", () => {
    for (const [x, nu, i] of [
      [1e11, 1e5, "0x1.42220c70fc47bp-20"], // was 1.2000315751371857e-6
      [1e12, 2e5, "0x1.a3e0ff4b7eff4p-22"], // was 2.9461275286960356e-7
      [1e13, 1e6, "0x1.01b4d6c0c8b95p-23"], // was 3.110282299053777e-8
      [1e16, 1e7, "0x1.10c8a172f279fp-28"], // was 8.327256817092183e-12
    ] as [number, number, string][]) {
      expect(rel(besselI(x, nu, scaled), fromHex(i))).toBeLessThan(2e-15);
    }
  });

  it("an exponent that double precision does not resolve is still a RangeError", () => {
    // near the Laplace limit x / nu = 0.6627 the terms of nu eta are about nu, and the result is in range
    const x = 0.6627434193491816 * 1e9;
    expect(() => besselI(x, 1e9)).toThrow(/besselI: x = 662743419.3491815, nu = 1000000000 has an exponent in Debye/);
    expect(() => besselK(x, 1e9)).toThrow(/at most 2\^26/);
    expect(besselI(x, 1e9, scaled)).toBe(0);
  });

  it("values elsewhere are the ones before", () => {
    expect(besselI(1e9, 1000, scaled)).toBe(0.000012609356357062971);
    expect(besselI(1e10, 1e4, scaled)).toBe(0.000003969525474818252);
    expect(besselK(1e12, 2e5, scaled)).toBe(0.000001278632762363543);
    expect(besselK(1e13, 1e6, scaled)).toBe(4.1665314334511657e-7);
  });
});

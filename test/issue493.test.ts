// Issue #493: df at x = Inf is 0 for every df1 (log -Inf); R gives NaN for df1 < 2, for df1 = Inf with df2 < 2 and for
// the noncentral F with a finite df2. For df1 = Inf (the density of df2 / chi2_df2) the linear density comes from its
// log where R's quotient dgamma(1/x) / x^2 is 0 / 0 (NaN) or silently 0. Ordinary values keep their bits.
// Reference values: Rmpfr (200 bits) of (n/2)^(n/2) / Gamma(n/2) x^(-n/2 - 1) exp(-n / (2x)), printed with sprintf("%a").
import { describe, expect, it } from "vitest";
import { df } from "../src/index.js";

function fromHex(h: string): number {
  const m = /^(-?)0x1\.([0-9a-f]{13})p([+-]\d+)$/.exec(h)!;
  const v = Number.parseInt(`1${m[2]}`, 16) * 2 ** -52 * 2 ** Number(m[3]);
  return m[1] === "-" ? -v : v;
}

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("issue #493: df at x = Inf and df1 = Inf at extreme x", () => {
  it("x = Inf: 0 for every df1 and df2 (R NaN for df1 < 2 and for df1 = Inf, df2 < 2)", () => {
    for (const [m, n] of [[Infinity, 1], [Infinity, 0.5], [1, 1], [1.5, 5], [0.5, 1e10], [2, 1], [Infinity, 3]] as const) {
      expect(df(Infinity, m, n)).toBe(0);
      expect(df(Infinity, m, n, { log: true })).toBe(-Infinity);
    }
  });

  it("noncentral F at x = Inf: 0 (R NaN)", () => {
    expect(df(Infinity, 1, 3, { ncp: 1 })).toBe(0);
    expect(df(Infinity, 3, 3, { ncp: 1, log: true })).toBe(-Infinity);
  });

  it("df1 = Inf: the linear density from the log where the quotient is 0 / 0 or 0", () => {
    // df(1e-300, Inf, 5): R NaN; exp(-2.5e300) is 0
    expect(df(1e-300, Infinity, 5)).toBe(0);
    // Rmpfr; the exp of a log of size 300 to 550 keeps about 13 to 14 digits
    expect(rel(df(1e160, Infinity, 1), fromHex("0x1.547fe3c2b78afp-799"))).toBeLessThan(1e-12); // R 0
    expect(rel(df(1e-100, Infinity, 1e-300), fromHex("0x1.87e92154ef7acp-666"))).toBeLessThan(1e-12); // was 0
    expect(rel(df(1e-170, Infinity, 1e-290), fromHex("0x1.4a8729fc3ddb8p-400"))).toBeLessThan(1e-12); // was NaN
    expect(rel(df(1e200, Infinity, 1), fromHex("0x1.1194b2f793d22p-998"))).toBeLessThan(1e-12); // R 0
  });

  it("ordinary values keep their bits", () => {
    expect(df(2, Infinity, 3)).toBe(0.17309961315613717);
    expect(df(2, Infinity, 3, { log: true })).toBe(-1.7538880516023714);
  });
});

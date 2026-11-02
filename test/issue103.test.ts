// Issue #103: pnbinom and qnbinom with mu where p = size / (size + mu) or q = mu / (size + mu) falls below the normal
// range (review_fix_log_issue103.md). The references are Rmpfr (3000 bits; the doubles passed as exact mantissas and
// exponents): the series I_z(A, B) = z^A (1 - z)^B / (A B(A, B)) sum (A + B)_k / (A + 1)_k z^k for the tiny z (p, or
// q for the upper tail), the other tail as 1 minus it.
import { describe, expect, it } from "vitest";
import { pnbinom, qnbinom } from "../src/index.js";

const MAX = Number.MAX_VALUE;
const MIN = Number.MIN_VALUE;

// [x, size, mu, log P[X <= x], log P[X > x]]
const refs: [number, number, number, number, number][] = [
  [0, 1e-300, MAX, -1.400558240791597737009e-297, -683.5309017186648173381],
  [10, 1e-300, MAX, -1.397629272537629482968e-297, -683.5329951947522734303],
  [1e300, 1e-300, MAX, -7.092054972284824815661e-298, -684.2113825727344966664],
  [1, 1e-300, 1e300, -1.380551055796427445034e-297, -683.5452898839732763688],
  [0, 1e-20, MAX, -7.558344147532648690124e-18, -39.42387953579568596433],
  [1e300, 1e-20, 1e300, -4.547448619497937838049e-19, -42.23455043416662962949],
  [1, 1e-20, 1e290, -7.128013788281541230673e-18, -39.48249904934325277488],
  [0, 1e-8, MAX, -7.282033936373363774193e-6, -11.83010398892720731698],
  [1e10, 1e-8, MAX, -7.046003270506690575184e-6, -11.86305353687988832432],
  [MAX, 1e-8, MAX, -1.784346509727550313312e-7, -15.53904349296833974385],
  [10, 0.5, MAX, -353.9295598958449997735, -1.951394851328286888168e-154],
  [MAX, 0.5, MAX, -0.3817151463021260722742, -1.147874464449318196354],
  [0, 1, MAX, -709.7827128933839967322, -5.562684646268004075308e-309],
  [1e10, 1, MAX, -686.756861963343539892, -5.562684646824272539934e-299],
  [MAX, 1, MAX, -0.4586751453870818910216, -1.0],
  [1e10, 3, MAX, -2058.766508492954345603, -7.745792064361682080861e-895],
  [MAX, 3, MAX, -0.5502424967772210739746, -0.8599338365037292291677],
  // q below the doubles (size much larger than mu)
  [0, MAX, MIN, -4.940656458412465441766e-324, -744.4400719213812623141],
  [3, MAX, MIN, 0, -2980.938341515872994876],
  [30, 1e300, MIN, 0, -23155.73445311613444237],
  [3, MAX, 1, -0.01917074698827376314355, -3.963939816469504860928],
  [30, MAX, 1, -4.618047461027192318141e-35, -79.06050626651340835353],
  [0, MAX, 3, -3.0, -0.05106918094270158653872],
  [30, MAX, 3, -4.125405198113943321915e-21, -46.93712270806674599887],
];

/** |a - b| relative, absolute below 1 (logs) */
const err = (a: number, b: number): number => (a === b ? 0 : Math.abs(a - b) / Math.max(1, Math.abs(b)));

describe("issue #103", () => {
  it("gives the distribution function where p or q is below the doubles", () => {
    for (const [x, size, mu, lo, up] of refs) {
      const label = `pnbinom(${x}, ${size}, { mu: ${mu} })`;
      expect(err(pnbinom(x, size, { mu, logP: true }), lo), label).toBeLessThan(4e-14);
      expect(err(pnbinom(x, size, { mu, lowerTail: false, logP: true }), up), label).toBeLessThan(4e-14);
      const lin = Math.exp(lo);
      if (lin > 1e-300) expect(Math.abs(pnbinom(x, size, { mu }) - lin) / lin, label).toBeLessThan(4e-14 * Math.max(1, Math.abs(lo)));
    }
  });

  it("gives the issue's values for size = MIN, mu = MAX", () => {
    // log P[X <= 0] = -7.1848e-321 (subnormal: its digits, and those of the upper tail made from it, are few)
    expect(pnbinom(0, MIN, { mu: MAX })).toBe(1);
    expect(Math.abs(pnbinom(0, MIN, { mu: MAX, lowerTail: false, logP: true }) - -737.1578450530067)).toBeLessThan(1e-2);
    expect(qnbinom(0.5, MIN, { mu: MAX })).toBe(0);
  });

  it("inverts the distribution function in qnbinom", () => {
    for (const [size, mu] of [[1, MAX], [0.5, MAX], [3, MAX], [1e-20, 1e300], [MAX, MIN], [MAX, 1], [MAX, 3], [1e295, 3]]) {
      const F = (y: number): number => (y < 0 ? 0 : pnbinom(y, size!, { mu: mu! }));
      for (const p of [1e-10, 0.01, 0.3, 0.5, 0.7, 0.99]) {
        const q = qnbinom(p, size!, { mu: mu! });
        const label = `qnbinom(${p}, ${size}, { mu: ${mu} }) = ${q}`;
        if (q === Infinity) expect(F(MAX), label).toBeLessThan(p);
        else {
          expect(F(q), label).toBeGreaterThanOrEqual(p * (1 - 1e-13));
          if (q > 0 && q - 1 !== q) expect(F(q - 1), label).toBeLessThan(p);
        }
      }
    }
    // the median of size 1, mu = MAX: about log 2 / p = log 2 MAX; at 0.7 beyond the doubles (F(MAX) = 1 - 1/e)
    expect(Math.abs(qnbinom(0.5, 1, { mu: MAX }) / (Math.LN2 * MAX) - 1)).toBeLessThan(1e-14);
    expect(qnbinom(0.7, 1, { mu: MAX })).toBe(Infinity);
  });
});

import { describe, expect, it } from "vitest";
import { dchisq, pchisq, pnorm, qchisq } from "../src/index.js";
import { bool, num, relativeError } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

// Noncentral χ² distribution (when ncp is given)
const opts = (a: Record<string, string | boolean>) => ({
  ncp: num(a.ncp),
  lowerTail: bool(a.lowerTail),
  logP: bool(a.logP),
});

fixtureSuite({
  name: "dnchisq",
  tolerance: 1e-14,
  density: true,
  call: (a) => dchisq(num(a.x), num(a.df), { ncp: num(a.ncp), log: bool(a.log) }),
});
fixtureSuite({
  name: "pnchisq",
  tolerance: 1e-14,
  call: (a) => pchisq(num(a.q), num(a.df), opts(a)),
});
// A huge noncentrality far from q: the far tail is below the double range (0), the near tail 1
fixtureSuite({
  name: "pnchisqHuge",
  tolerance: 1e-14,
  call: (a) => pchisq(num(a.q), num(a.df), opts(a)),
});
fixtureSuite({
  name: "qnchisq",
  tolerance: 1e-14,
  // df = 0 and ncp = 0 is a point mass at 0. R returns NaN (the answer is 0)
  knownDifference: (a, e, x) =>
    (Number.isNaN(e) || e === Infinity) && x === 0 && num(a.df) === 0 && num(a.ncp) === 0
      ? "point mass at 0: R returns NaN or Inf (the answer is 0)"
      : undefined,
  call: (a) => qchisq(num(a.p), num(a.df), opts(a)),
  backward: (a, x) => pchisq(x, num(a.df), opts(a)),
});

describe("noncentral χ² distribution function for x λ > 4e18", () => {
  const p = (x: number, df: number, ncp: number, lowerTail: boolean, logP: boolean) =>
    pchisq(x, df, { ncp, lowerTail, logP }) as number;
  const tails = [
    [true, false],
    [false, false],
    [true, true],
    [false, true],
  ] as const;

  /**
   * Exact for k = 1: X = (Z + sqrt(λ))², so P[X <= x] = Φ(a) - Φ(-sqrt(x) - sqrt(λ)) with a = sqrt(x) - sqrt(λ),
   * written a = (x - λ)/(sqrt(x) + sqrt(λ)) to avoid cancellation
   */
  function df1(x: number, ncp: number, lowerTail: boolean, logP: boolean): number {
    const a = (x - ncp) / (Math.sqrt(x) + Math.sqrt(ncp));
    const b = -Math.sqrt(x) - Math.sqrt(ncp);
    const pb = pnorm(b) as number;
    // Φ(b) is below the double range here, so the tails are those of the normal at a
    if (pb === 0) return pnorm(a, { lowerTail, logP }) as number;
    const v = lowerTail ? (pnorm(a) as number) - pb : (pnorm(a, { lowerTail: false }) as number) + pb;
    return logP ? Math.log(v) : v;
  }

  it("matches the exact distribution for df = 1 (relative 1e-15)", () => {
    for (const ncp of [5e9, 3e10, 1e12, 1e15]) {
      for (const z of [-40, -10, -3, -0.5, 0, 0.5, 3, 10, 40, 200]) {
        const x = (Math.sqrt(ncp) + z) ** 2;
        expect(ncp * x).toBeGreaterThan(4e18);
        for (const [lowerTail, logP] of tails) {
          const e = relativeError(p(x, 1, ncp, lowerTail, logP), df1(x, ncp, lowerTail, logP));
          expect(e, `ncp = ${ncp}, z = ${z}, lowerTail = ${lowerTail}, logP = ${logP}`).toBeLessThanOrEqual(1e-15);
        }
      }
    }
  });

  it("gives the reported cases", () => {
    // These were -21849.97, 21850.97 and 1.33e9
    expect(relativeError(p(3e9, 1, 3e9, true, false), df1(3e9, 3e9, true, false))).toBeLessThanOrEqual(1e-15);
    expect(relativeError(p(3e9, 1, 3e9, false, false), df1(3e9, 3e9, false, false))).toBeLessThanOrEqual(1e-15);
    expect(relativeError(p(1e10, 1, 1e10, true, false), df1(1e10, 1e10, true, false))).toBeLessThanOrEqual(1e-15);
    const q = qchisq(0.5, 1, { ncp: 3e9 }) as number;
    expect(Math.abs(q - 3e9)).toBeLessThan(1);
    expect(relativeError(p(q, 1, 3e9, true, false), 0.5)).toBeLessThanOrEqual(1e-13);
  });

  /** The neighbouring doubles of x */
  function nextDouble(x: number, up: boolean): number {
    const b = new Float64Array([x]);
    const i = new BigInt64Array(b.buffer);
    i[0]! += up ? 1n : -1n;
    return b[0]!;
  }

  it("is continuous where the Poisson mixture series hands over (λ x = 4e18)", () => {
    for (const df of [1, 5, 50]) {
      for (const z of [-3, 0, 3]) {
        // λ with x = (sqrt(λ) + z)² at the threshold, and the last x for the series
        let ncp = 2e9;
        for (let i = 0; i < 5; i++) ncp = 4e18 / (Math.sqrt(ncp) + z) ** 2;
        let below = 4e18 / ncp;
        while ((ncp / 2) * (below / 2) > 1e18) below = nextDouble(below, false);
        while ((ncp / 2) * (nextDouble(below, true) / 2) <= 1e18) below = nextDouble(below, true);
        const above = nextDouble(below, true);
        // The smaller tail, carried from below to above along the density (its second-order change is far below 1e-16)
        const lowerTail = z <= 0;
        const step = (dchisq(below, df, { ncp }) as number) * (above - below);
        const expected = p(below, df, ncp, lowerTail, false) + (lowerTail ? step : -step);
        expect(relativeError(p(above, df, ncp, lowerTail, false), expected), `df = ${df}, z = ${z}`).toBeLessThanOrEqual(
          1e-13,
        );
      }
    }
  });

  it("is consistent with the density and the quantile function (df = 2, 7)", () => {
    for (const df of [2, 7]) {
      for (const ncp of [5e9, 1e12]) {
        for (const z of [-5, -1, 0, 1, 5]) {
          const x = (Math.sqrt(ncp) + z) ** 2;
          const msg = `df = ${df}, ncp = ${ncp}, z = ${z}`;
          expect(Math.abs(p(x, df, ncp, true, false) + p(x, df, ncp, false, false) - 1), msg).toBeLessThanOrEqual(2e-16);
          // Central difference of the smaller tail (the scale of X is 2 sqrt(x))
          const h = 2e-4 * Math.sqrt(x);
          const lowerTail = z < 0;
          const diff = (p(x + h, df, ncp, lowerTail, false) - p(x - h, df, ncp, lowerTail, false)) / (2 * h);
          expect(relativeError(lowerTail ? diff : -diff, dchisq(x, df, { ncp }) as number), msg).toBeLessThanOrEqual(1e-6);
          for (const [lt, logP] of tails) {
            const q = qchisq(p(x, df, ncp, lt, logP), df, { ncp, lowerTail: lt, logP }) as number;
            expect(relativeError(q, x), `${msg}, lowerTail = ${lt}, logP = ${logP}`).toBeLessThanOrEqual(1e-13);
          }
        }
      }
    }
  });
});

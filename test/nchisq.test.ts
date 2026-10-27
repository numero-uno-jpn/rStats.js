import { describe, expect, it } from "vitest";
import { dchisq, dnorm, pchisq, pnorm, qchisq, qnorm } from "../src/index.js";
import { ddAdd, ddDiv, twoProd, twoSum, type DD } from "../src/special/dd.js";
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

describe("noncentral χ² density for x λ > 4e18", () => {
  /**
   * Exact log density for k = 1: f(x) = [φ(sqrt(x) - sqrt(λ)) + φ(sqrt(x) + sqrt(λ))] / (2 sqrt(x)), the second term
   * negligible here, with sqrt(x) - sqrt(λ) written (x - λ)/(sqrt(x) + sqrt(λ)) to avoid cancellation
   */
  function logDf1(x: number, ncp: number): number {
    const a = (x - ncp) / (Math.sqrt(x) + Math.sqrt(ncp));
    return (dnorm(a, { log: true }) as number) - Math.log(2 * Math.sqrt(x));
  }

  it("matches the exact density for df = 1 (relative 1e-14)", () => {
    for (const ncp of [5e9, 3e10, 1e15, 7.3e17]) {
      for (const z of [-200, -40, -5, -0.5, 0.5, 5, 40, 200]) {
        const x = (Math.sqrt(ncp) + z) ** 2;
        expect(ncp * x).toBeGreaterThan(4e18);
        const msg = `ncp = ${ncp}, z = ${z}`;
        const lf = logDf1(x, ncp);
        expect(relativeError(dchisq(x, 1, { ncp, log: true }) as number, lf), msg).toBeLessThanOrEqual(1e-14);
        // The linear density where it is a normal double
        const f = Math.exp(lf);
        if (f >= 2.2250738585072014e-308) {
          expect(relativeError(dchisq(x, 1, { ncp }) as number, f), msg).toBeLessThanOrEqual(1e-14);
        }
      }
    }
  });
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
   * written a = (x - λ)/(sqrt(x) + sqrt(λ)) to avoid cancellation, with the roots in double-double: their rounding
   * would put a relative error of 1e-16 into a, 1e-14 into the tail at a = 10. The tail at a = ah + al is that at ah
   * corrected by the first-order term φ(ah) al
   */
  function df1(x: number, ncp: number, lowerTail: boolean, logP: boolean): number {
    const root = (v: number): DD => {
      const r = Math.sqrt(v);
      const [p, e] = twoProd(r, r);
      return [r, (v - p - e) / (2 * r)];
    };
    const [ah, al] = ddDiv(twoSum(x, -ncp), ddAdd(root(x), root(ncp)));
    const lt = pnorm(ah, { lowerTail, logP: true }) as number;
    // (the correction relative to the tail, and the tail itself linear: its exp would lose |log| ulps)
    const rel = (lowerTail ? al : -al) * Math.exp((dnorm(ah, { log: true }) as number) - lt);
    const ta = (pnorm(ah, { lowerTail }) as number) * (1 + rel);
    const b = -Math.sqrt(x) - Math.sqrt(ncp);
    const pb = pnorm(b) as number;
    // Φ(b) is below the double range here, so the tails are those of the normal at a
    if (pb === 0) return logP ? lt + Math.log1p(rel) : ta;
    const v = lowerTail ? ta - pb : ta + pb;
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

  it("is continuous where the Poisson mixture series hands over to the large-argument expansion", () => {
    for (const df of [1, 5, 50]) {
      // The expansion is used for sqrt(λ x) > 1e4 where ν² <= sqrt(λ x)/100 (ν = df/2 - 1): from λ x = zs²
      const nu = df / 2 - 1;
      const zs = Math.max(1e4, 100 * nu * nu);
      const expansion = (x: number, ncp: number): boolean => {
        const zx = Math.sqrt(ncp) * Math.sqrt(x);
        return zx > 1e4 && nu * nu <= zx / 100;
      };
      for (const z of [-3, 0, 3]) {
        // λ with x = (sqrt(λ) + z)² at the threshold, and the last x for the series
        let ncp = zs;
        for (let i = 0; i < 20; i++) ncp = (zs * zs) / (Math.sqrt(ncp) + z) ** 2;
        let below = (zs * zs) / ncp;
        while (expansion(below, ncp)) below = nextDouble(below, false);
        while (!expansion(nextDouble(below, true), ncp)) below = nextDouble(below, true);
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

describe("noncentral χ² with a large df or extreme parameters (regressions)", () => {
  /** The neighbouring double of x */
  function nextDouble(x: number, up: boolean): number {
    const b = new Float64Array([x]);
    const i = new BigInt64Array(b.buffer);
    i[0]! += up ? 1n : -1n;
    return b[0]!;
  }

  it("gives the log density where the large-argument expansion fails (ν² >> sqrt(λ x)), against mpmath", () => {
    // These were NaN. References: the Poisson mixture summed at 80 digits by mpmath
    expect(relativeError(dchisq(2.0001e9, 1e6, { ncp: 2e9, log: true }) as number, -62.94381384181123)).toBeLessThanOrEqual(1e-14);
    expect(relativeError(dchisq(1.1e10, 1e10, { ncp: 1e9, log: true }) as number, -12.86959836686902)).toBeLessThanOrEqual(1e-14);
  });

  it("returns the distribution function for a large df (these did not return)", () => {
    for (const [x, df, ncp] of [
      [1.1e10, 1e10, 1e9],
      [2.0003e9, 3e5, 2e9],
    ] as const) {
      const lo = pchisq(x, df, { ncp }) as number;
      const hi = pchisq(x, df, { ncp, lowerTail: false }) as number;
      expect(Math.abs(lo + hi - 1)).toBeLessThanOrEqual(2e-16);
      // Near the centre: against the normal approximation (skewness below 1e-4), and the slope against the density
      const sd = Math.sqrt(2 * (df + 2 * ncp));
      expect(Math.abs(lo - (pnorm((x - df - ncp) / sd) as number))).toBeLessThan(1e-4);
      const h = 1e-3 * sd;
      const diff = ((pchisq(x + h, df, { ncp }) as number) - (pchisq(x - h, df, { ncp }) as number)) / (2 * h);
      expect(relativeError(diff, dchisq(x, df, { ncp }) as number)).toBeLessThanOrEqual(1e-6);
    }
  });

  it("returns at extreme parameters (these did not return)", () => {
    // λ = 3.6e30: X = (Z + sqrt(λ))² to far below the double resolution of sqrt(λ)
    const x = qchisq(-540.03, 12.208291652901835, { ncp: 3.6217639322648935e30, logP: true }) as number;
    const ref = (Math.sqrt(3.6217639322648935e30) + (qnorm(-540.03, { logP: true }) as number)) ** 2;
    expect(relativeError(x, ref)).toBeLessThanOrEqual(1e-14);
    // A tiny λ: the central density (it summed terms until an exponent of 1e34 lost its fraction)
    expect(dchisq(2.743545666032594e34, 2, { ncp: 2.546231756044769e-216, log: true })).toBe(dchisq(2.743545666032594e34, 2, { log: true }));
    // A relative spread below the double resolution: the distribution function steps at one double
    const [p, df] = [5.7285590455359545e-12, 5.345349749112763e64];
    const q = qchisq(p, df, { ncp: 1 }) as number;
    expect(pchisq(q, df, { ncp: 1 })).toBeGreaterThanOrEqual(p);
    expect(pchisq(nextDouble(q, false), df, { ncp: 1 })).toBeLessThan(p);
  });
});

describe("noncentral χ²: the larger tail", () => {
  it("is 1 - (smaller), so that it does not exceed 1 (1.0000000000000002 before)", () => {
    for (const x of [761.3707616472069, 763.6617468878705, 765.9527321285341]) {
      const lower = pchisq(x, 2, { ncp: 16.99599089257515 }) as number;
      expect(lower).toBeLessThanOrEqual(1);
      expect(lower).toBe(1 - (pchisq(x, 2, { ncp: 16.99599089257515, lowerTail: false }) as number));
    }
  });
});

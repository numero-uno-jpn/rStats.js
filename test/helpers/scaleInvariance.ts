// Metamorphic check that a statistic does not depend on the units of the data (see the rules in
// src/internal/summary.ts): run the computation on the data times c for several c far from 1, and compare with c = 1.
import { expect } from "vitest";

/** Factors far from 1: powers of 2 (exact) and powers of 10 (the data then carry their own rounding) */
export const SCALES = [2 ** -500, 1e-200, 1e200, 2 ** 500];

/** Which outputs of a result have no units, the units of the data, or their square */
export interface ScaleParts<T> {
  unitless?: (r: T) => number[];
  units?: (r: T) => number[];
  squared?: (r: T) => number[];
}

function same(actual: number, expected: number, tol: number, what: string): void {
  if (Number.isNaN(expected) || !Number.isFinite(expected)) {
    expect(actual, what).toBe(expected);
    return;
  }
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tol * Math.max(Math.abs(expected), 1e-300));
}

/**
 * `run(c)` computes the result for the data times c. The unitless outputs must equal those at c = 1; outputs with
 * units must equal those at c = 1 times c (or c^2), where that product is representable
 */
export function expectScaleInvariant<T>(name: string, run: (c: number) => T, parts: ScaleParts<T>, tol = 1e-9): void {
  const ref = run(1);
  for (const c of SCALES) {
    const r = run(c);
    const check = (pick: ((r: T) => number[]) | undefined, power: number, kind: string): void => {
      if (pick === undefined) return;
      const a = pick(r);
      const b = pick(ref);
      b.forEach((v, i) => {
        const want = v * c ** power;
        // products beyond the double range (or below it) are not representable: nothing to compare
        if (power > 0 && v !== 0 && (!Number.isFinite(want) || Math.abs(want) < 1e-290)) return;
        same(a[i]!, power === 0 ? v : want, tol, `${name} ${kind}[${i}] at scale ${c}`);
      });
    };
    check(parts.unitless, 0, "unitless");
    check(parts.units, 1, "units");
    check(parts.squared, 2, "squared");
  }
}

import { describe, expect, it, vi } from "vitest";
import { dsignrank, psignrank, qsignrank } from "../src/distributions/signrank.js";
import { dwilcox, pwilcox, qwilcox } from "../src/distributions/wilcox.js";
import { bool, num, relativeError } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

const tail = (a: Record<string, string | boolean>) => ({ lowerTail: bool(a.lowerTail), logP: bool(a.logP) });

/**
 * Cases where we intentionally differ from R (docs/differences-from-r.md)
 * - With log.p = TRUE and p = -Inf (probability 0) R returns NaN. We return the same answer as for p = 0
 * - When a linear-scale p is extremely close to 1, R compares 1 - p with a slack of about 1e-15 absolute,
 *   so its answer is off
 */
const knownDiff = (a: Record<string, string | boolean>, e: number, x: number): string | undefined => {
  const p = num(a.p);
  if (a.logP === true && p === -Infinity && Number.isNaN(e) && !Number.isNaN(x))
    return "R returns NaN for p = -Inf with log.p = TRUE (we return the answer for p = 0)";
  if (a.logP !== true && p > 0.5 && 1 - p < 1e-12) return "p is close to 1 and R's decision is determined by rounding";
  return undefined;
};

fixtureSuite({
  name: "dsignrank",
  tolerance: 1e-14,
  density: true,
  call: (a) => dsignrank(num(a.x), num(a.n), { log: bool(a.log) }),
});
fixtureSuite({
  name: "psignrank",
  tolerance: 1e-14,
  call: (a) => psignrank(num(a.q), num(a.n), tail(a)),
});
fixtureSuite({
  name: "qsignrank",
  tolerance: 0,
  discreteCdf: (a, y, lg) => psignrank(y, num(a.n), { lowerTail: bool(a.lowerTail), logP: lg ?? bool(a.logP) }),
  knownDifference: knownDiff,
  call: (a) => qsignrank(num(a.p), num(a.n), tail(a)),
});
fixtureSuite({
  name: "dwilcox",
  tolerance: 1e-14,
  density: true,
  call: (a) => dwilcox(num(a.x), num(a.m), num(a.n), { log: bool(a.log) }),
});
fixtureSuite({
  name: "pwilcox",
  tolerance: 1e-14,
  call: (a) => pwilcox(num(a.q), num(a.m), num(a.n), tail(a)),
});
fixtureSuite({
  name: "qwilcox",
  tolerance: 0,
  discreteCdf: (a, y, lg) =>
    pwilcox(y, num(a.m), num(a.n), { lowerTail: bool(a.lowerTail), logP: lg ?? bool(a.logP) }),
  knownDifference: knownDiff,
  call: (a) => qwilcox(num(a.p), num(a.m), num(a.n), tail(a)),
});

describe("signrank results do not depend on what was evaluated first", () => {
  // A table built out to the centre has been rescaled, and its low entries lost digits (c_n(0) = 1 underflowed to 0
  // for n = 2000). For n = 2000, s = 95000 is a normal number in that table but was off by 1e-7 relative.
  // Evaluated fresh, each small s is the last entry of the table built for it, which is exact
  it.each([
    [1000, [0, 1, 5, 50, 500]],
    [2000, [0, 1, 5, 50, 500, 95000]],
  ])("n = %i: small s fresh, after the centre, and again", async (n, small) => {
    // A fresh copy of the module, so that no table is cached yet (the fixtures above share this module state)
    vi.resetModules();
    const m = await import("../src/distributions/signrank.js");
    const values = () => small.flatMap((s) => [m.dsignrank(s, n, { log: true }), m.psignrank(s, n, { logP: true })]);
    const fresh = values();
    for (const v of fresh) expect(Number.isFinite(v)).toBe(true);
    const centre = (n * (n + 1)) / 4;
    expect(Number.isFinite(m.dsignrank(centre, n, { log: true }))).toBe(true);
    expect(Number.isFinite(m.psignrank(centre, n, { logP: true }))).toBe(true);
    expect(values()).toEqual(fresh);
    expect(values()).toEqual(fresh);
    // c_n(0) = c_n(1) = c_n(2) = 1, c_n(3) = 2, c_n(5) = 3, so P[V <= 5] = (1 + 1 + 1 + 2 + 2 + 3) / 2^n
    const l2 = n * Math.LN2;
    for (const [s, c] of [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 2],
      [5, 3],
    ]) {
      expect(relativeError(m.dsignrank(s!, n, { log: true }), Math.log(c!) - l2)).toBeLessThanOrEqual(1e-15);
    }
    expect(relativeError(m.psignrank(5, n, { logP: true }), Math.log(10) - l2)).toBeLessThanOrEqual(1e-15);
    // qsignrank reads the same values
    expect(m.qsignrank(m.psignrank(5, n, { logP: true }), n, { logP: true })).toBe(5);
  });
});

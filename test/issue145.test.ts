// Issues #145 (pgeom) and #146 (pnbinom), and the same rule in ppois, pbinom, phyper, pwilcox, psignrank and the exact
// Ansari-Bradley distribution: P[X <= q] for a non-integer q is P[X <= floor(q)]. R adds 1e-7 before the floor (psignrank:
// before rounding to the nearest integer), so q in [k - 1e-7, k) counted as k. A q within the densities' slack
// (1e-9 max(1, |q|)) of an integer is that integer, so computed integers such as 2.9999999999999996 still count.
import { describe, expect, it } from "vitest";
import {
  dgeom,
  dpois,
  pbinom,
  pgeom,
  phyper,
  pnbinom,
  ppois,
  psignrank,
  pwilcox,
  qbinom,
  qgeom,
  qhyper,
  qnbinom,
  qpois,
  qsignrank,
  qwilcox,
} from "../src/index.js";
import { pansariExact } from "../src/htest/core/ansari.js";

type P = (q: number, lowerTail: boolean) => number;
const opt = (lowerTail: boolean) => ({ lowerTail });

const cases: [string, P][] = [
  ["pgeom", (q, l) => pgeom(q, 0.5, opt(l))],
  ["pnbinom (prob)", (q, l) => pnbinom(q, 2, { prob: 0.4, ...opt(l) })],
  ["pnbinom (mu)", (q, l) => pnbinom(q, 2, { mu: 3, ...opt(l) })],
  ["ppois", (q, l) => ppois(q, 1, opt(l))],
  ["pbinom", (q, l) => pbinom(q, 5, 0.5, opt(l))],
  ["phyper", (q, l) => phyper(q, 5, 5, 5, opt(l))],
  ["pwilcox", (q, l) => pwilcox(q, 3, 3, opt(l))],
  ["psignrank", (q, l) => psignrank(q, 4, opt(l))],
  ["pansari (exact)", (q, l) => pansariExact(q, 4, 3, l)],
];

describe("issues #145, #146: q just below an integer", () => {
  it("the examples of the issues", () => {
    expect(pgeom(0.99999999, 0.5)).toBe(0.5);
    expect(pnbinom(0.99999999, 1, { prob: 0.5 })).toBe(0.5);
    expect(pnbinom(0.99999999, 1, { mu: 1 })).toBe(0.5);
  });

  it.each(cases)("%s: q in [k - 1e-7, k) is floor(q), as the density treats it", (_name, p) => {
    for (const k of [1, 2, 3, 5, 9]) {
      for (const q of [k - 1e-8, k - 5e-8, k - 1e-7]) {
        for (const l of [true, false]) expect(p(q, l)).toBe(p(k - 1, l));
      }
    }
    // the density is 0 there, and the distribution function does not step
    expect(dpois(1 - 1e-8, 1)).toBe(0);
    expect(dgeom(1 - 1e-8, 0.5)).toBe(0);
  });

  it.each(cases)("%s: a computed integer within 1e-9 relative is that integer", (_name, p) => {
    for (const k of [1, 2, 3, 5, 9]) {
      for (const q of [k * (1 - 2 ** -52), k * (1 + 2 ** -52), k - 1e-10, k + 1e-10]) {
        for (const l of [true, false]) expect(p(q, l)).toBe(p(k, l));
      }
    }
    expect(p(3 - 4.440892098500626e-16, true)).toBe(p(3, true));
    expect(p(0.1 * 30, true)).toBe(p(3, true));
  });

  it.each(cases)("%s: other non-integers are floor(q) (unchanged from before, except psignrank at fractions of 0.5 or more)", (_name, p) => {
    for (let k = 0; k <= 10; k++) {
      for (const f of [2e-7, 1e-3, 0.3, 0.7, 1 - 2e-7]) {
        for (const l of [true, false]) expect(p(k + f, l)).toBe(p(k, l));
      }
    }
  });

  it.each(cases)("%s: above q = 100 the slack stays at R's 1e-7", (_name, p) => {
    for (const k of [100, 101, 150]) {
      for (const l of [true, false]) {
        expect(p(k - 5e-7, l)).toBe(p(k - 1, l));
        expect(p(k - 2e-7, l)).toBe(p(k - 1, l));
        expect(p(k - 5e-8, l)).toBe(p(k, l));
      }
    }
  });

  it("ppois(1000 - 5e-7, 1000) is P[X <= 999], as in R (0.4958)", () => {
    expect(ppois(1000 - 5e-7, 1000)).toBe(ppois(999, 1000));
    expect(ppois(1000 - 5e-8, 1000)).toBe(ppois(1000, 1000));
  });

  it("psignrank takes the floor, not the nearest integer (R: psignrank(0.6, 4) = P[V <= 1])", () => {
    expect(psignrank(0.6, 4)).toBe(0.0625);
    expect(psignrank(0.6, 4)).toBe(psignrank(0, 4));
    expect(psignrank(3.6, 5)).toBe(psignrank(3, 5));
    expect(psignrank(2.5, 10, { lowerTail: false })).toBe(psignrank(2, 10, { lowerTail: false }));
  });

  it("the quantile functions invert the distribution functions as before", () => {
    const ps = [0.001, 0.05, 0.1875, 0.25, 0.5, 0.75, 0.9, 0.999];
    const check = (q: (p: number) => number, p: (x: number) => number) => {
      for (const v of ps) {
        const x = q(v);
        expect(p(x)).toBeGreaterThanOrEqual(v * (1 - 64 * Number.EPSILON));
        if (x > 0) expect(p(x - 1)).toBeLessThan(v);
      }
    };
    check((v) => qgeom(v, 0.3), (x) => pgeom(x, 0.3));
    check((v) => qnbinom(v, 2, { prob: 0.4 }), (x) => pnbinom(x, 2, { prob: 0.4 }));
    check((v) => qpois(v, 3), (x) => ppois(x, 3));
    check((v) => qbinom(v, 10, 0.3), (x) => pbinom(x, 10, 0.3));
    check((v) => qhyper(v, 6, 7, 5), (x) => phyper(x, 6, 7, 5));
    check((v) => qwilcox(v, 4, 5), (x) => pwilcox(x, 4, 5));
    check((v) => qsignrank(v, 8), (x) => psignrank(x, 8));
  });
});

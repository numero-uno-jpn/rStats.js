// Issue #111: dweibull's log(shape / scale) where shape and scale are within 2^-20 of each other
// (review_fix_log_issue111.md). The references are Rmpfr (400 bits, the doubles as exact mantissas and exponents):
// log(k / s) + (k - 1) log(x / s) - (x / s)^k.
import { describe, expect, it } from "vitest";
import { dweibull } from "../src/index.js";

// [x, shape, scale, log density]
const refs: [number, number, number, number][] = [
  [6.010721054399115e-10, 6.010721053811569e-10, 6.010721054399115e-10, -1.0000000000977498],
  [1.5013117227824624, 1.5013117227825037, 1.5013117227824624, -0.9999999999999725],
  [0.0003399312911204116, 0.00033993129117841013, 0.0003399312911204116, -0.9999999998293816],
  [9386911.716206579, 9386911.764731402, 9386911.764732413, -1.0011585575321598],
  [0.000002348515611045353, 0.0000025197345428558026, 0.0000025197345428682083, -0.9296299178656942],
  [576923.9007296057, 576923.9007296239, 576923.9007296057, -0.9999999999999685],
  [339.8593389903334, 339.8316532288867, 339.8316532288817, -1.0004682462455385],
  [1383.187519210842, 1383.1875192108323, 1383.187519210842, -1.000000000000007],
];

describe("issue #111", () => {
  it("takes log(shape / scale) from the exact difference", () => {
    // log(shape / scale) = 1.1102230246251566e-16; R 4.5.2: -0.99999999999999982 (an ulp off, as before)
    expect(dweibull(2 ** 52 - 0.5, 2 ** 52, { scale: 2 ** 52 - 0.5, log: true })).toBe(-0.9999999999999999);
    for (const [x, k, s, want] of refs) {
      expect(Math.abs(dweibull(x, k, { scale: s, log: true }) - want), `${x}, ${k}, ${s}`).toBeLessThanOrEqual(2.3e-16);
    }
  });

  it("keeps the other shapes as before", () => {
    // (values before the change)
    expect([0.5, 1.5, 2, 3].map((k) => dweibull(0.7, k, { log: true }))).toEqual([
      -1.3514697351246547, -0.35853438243505464, -0.1535277633787871, 0.04226240079064474,
    ]);
    expect(dweibull(2, 1.5, { scale: 3, log: true })).toBe(-1.4402107885658448);
    expect(dweibull(5, 2, { scale: 1.7, log: true })).toBe(-7.409190440272164);
  });
});

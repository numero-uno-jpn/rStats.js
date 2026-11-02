// Issue #112: dlnorm's z^2 / 2 for |z| above 1e150 keeps the low part of z (review_fix_log_issue112.md). The
// references are Rmpfr (800 bits, the doubles as exact mantissas and exponents) of
// -z^2 / 2 - log(sdlog) - log(x) - log(2 pi) / 2, z = (log x - meanlog) / sdlog, correctly rounded.
import { describe, expect, it } from "vitest";
import { dlnorm } from "../src/index.js";

// [x, meanlog, sdlog, log density]
const refs: [number, number, number, number][] = [
  [1, 1.0725839319986903e305, 7.295160993704339e154, -1.0808435033670651e300], // the issue's
  [0.34061638262198296, -9.067554463135202e237, 8.348313225585953e83, -5.898653417156089e307],
  [0.014698987522506453, 1.4204045569011574e271, 4.750256303438421e118, -4.470540486562591e304],
  [1.2716609003116877, -8.738921372747926e199, 5.922287521095017e48, -1.0886961617710749e302],
  [0.42448847939791456, 5.96762913413997e272, 4.706248924886399e119, -8.039404243072359e305],
  [2.5440738218368564, -1.9577382820052468e176, 7.045852232612728e22, -3.860221356346497e306],
  [0.3524560117264546, -3.108162828294487e197, 4.29620044344095e45, -2.617028532560831e303],
  [20.974967769325666, 4.597117954762707e221, 3.533568232754427e70, -8.462805018678059e301],
  [5.14228812200058, -4.959238582189648e182, 1.0565707937427027e29, -1.1015464253686304e307],
  [0.01980296435893441, 9.36672618543643e252, 6.08920953563385e98, -1.1831064345594901e308],
];

describe("issue #112", () => {
  it("rounds the log density correctly for |z| above 1e150", () => {
    for (const [x, meanlog, sdlog, want] of refs) {
      expect(dlnorm(x, { meanlog, sdlog, log: true }), `${x}, ${meanlog}, ${sdlog}`).toBe(want);
    }
  });

  it("keeps -Infinity where z^2 / 2 overflows, and smaller z as before", () => {
    expect(dlnorm(1, { meanlog: 1e308, sdlog: 1e150, log: true })).toBe(-Infinity);
    // (values before the change: |z| = 3e150, but z exact in double, and an ordinary z)
    expect(dlnorm(1, { meanlog: 3e160, sdlog: 1e10, log: true })).toBe(-4.4999999999999993e300);
    expect(dlnorm(2, { meanlog: 0.3, sdlog: 0.7, log: true })).toBe(-1.4131298571546962);
  });
});

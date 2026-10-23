import { describe, expect, it } from "vitest";
import { beta, dnorm, gamma, lbeta, lgamma } from "../src/index.js";
import { bool, num } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

fixtureSuite({
  name: "dnorm",
  tolerance: 1e-14,
  density: true,
  call: (a) => dnorm(num(a.x), { mean: num(a.mean), sd: num(a.sd), log: bool(a.log) }),
});
fixtureSuite({ name: "gamma", tolerance: 1e-14, call: (a) => gamma(num(a.x)) });
fixtureSuite({ name: "lgamma", tolerance: 1e-14, call: (a) => lgamma(num(a.x)) });
fixtureSuite({ name: "beta", tolerance: 1e-14, call: (a) => beta(num(a.a), num(a.b)) });
fixtureSuite({ name: "lbeta", tolerance: 1e-14, call: (a) => lbeta(num(a.a), num(a.b)) });

// Arguments beyond 2^52, outside the R fixture grid. lbeta used to be off by 20 at a = 1e17 (lbetaDD rounds a - 1/2).
// Reference values from mpmath (700 digits)
describe("beta and lbeta with huge arguments", () => {
  it("match the high-precision values", () => {
    const cases: [number, number, number, number][] = [
      [1e17, 31, -1138.8041076590319, 0],
      [1e100, 31, -7063.3555519327115, 0],
      [1e17, 2, -78.287893161797553, 9.9999999999999999e-35],
      [5e15, 3.5, -125.31777647335968, 3.7599424119464975e-55],
      [1e20, 1e15, -12512930464953578, 0],
      [1e300, 1e300, -1.3862943611198907e300, 0],
    ];
    for (const [a, b, l, v] of cases) {
      expect(Math.abs(lbeta(a, b) - l) / Math.abs(l), `lbeta(${a}, ${b})`).toBeLessThan(1e-14);
      expect(Math.abs(beta(a, b) - v), `beta(${a}, ${b})`).toBeLessThanOrEqual(2e-14 * v);
    }
  });
});

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

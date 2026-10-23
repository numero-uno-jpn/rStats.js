// Numerical core of the exact mantelhaen.test: the distribution of the summed (1, 1) cells of 2 x 2 x K tables,
// checked against exact rational arithmetic (scripts/mpmath/mantelhaen.py). The estimates use uniroot as R does,
// so they are compared with the exact roots only loosely (uniroot's tolerance is eps^0.25); their last digits are left
// to the R fixtures. The probabilities allow 2e-13: the weight psi^s is formed as exp(s log psi), whose exponent reaches
// 1500 for psi = 40, s = 400 (the same construction as fisher.test's 2 x 2 tables)
import {
  ConvolvedNoncentralHyper, conditionalMLE, lowerLimit, upperLimit, type Stratum,
} from "../../src/htest/core/mantelhaen.js";
import { bool, num } from "../helpers/fixture.js";
import { referenceSuite } from "../helpers/mpmath.js";

const strata = (a: Record<string, unknown>): Stratum[] => {
  const f = (a.strata as string[]).map(num);
  const out: Stratum[] = [];
  for (let i = 0; i < f.length; i += 4) out.push([[f[i]!, f[i + 1]!], [f[i + 2]!, f[i + 3]!]]);
  return out;
};
const dist = (a: Record<string, unknown>) => new ConvolvedNoncentralHyper(strata(a));

referenceSuite({
  name: "mh_density",
  tolerance: 2e-13,
  call: (a) => {
    const h = dist(a);
    const s = num(a.s);
    const d = h.density(num(a.psi));
    return s < h.lo || s > h.hi ? 0 : d[s - h.lo]!;
  },
});
referenceSuite({ name: "mh_cdf", tolerance: 2e-13, call: (a) => dist(a).cdf(num(a.s), num(a.psi), bool(a.upper)) });
referenceSuite({ name: "mh_mean", tolerance: 1e-14, call: (a) => dist(a).mean(num(a.psi)) });
referenceSuite({
  name: "mh_estimates",
  tolerance: 5e-3,
  call: (a) => {
    const st = strata(a);
    const h = new ConvolvedNoncentralHyper(st);
    const s = st.reduce((acc, t) => acc + t[0][0], 0);
    return a.what === "mle" ? conditionalMLE(h, s) : a.what === "upper" ? upperLimit(h, s, 0.025) : lowerLimit(h, s, 0.025);
  },
});

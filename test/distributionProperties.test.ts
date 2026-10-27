// Properties of the distribution functions that need no reference value (test/helpers/properties.ts): range,
// complement, log consistency, monotonicity, quantile round trip, density against the CDF, time and independence of
// call order, on parameter sets from fixed seeds. The comparisons with R only cover chosen grid points; these checks
// cover the whole parameter range. scripts/fuzz-distributions.mjs runs the same checks for much longer.
//
// Violations known today are listed in helpers/distributionKnown.ts with their reasons (shared with the fuzz script);
// an entry that no longer matches anything fails the test (it should then be removed). Calls that never return cannot
// be interrupted here, so they are excluded from execution by their entry and only the fuzz script (which runs them in a
// worker with a timeout) sees them.

import { describe, expect, it } from "vitest";
import * as dist from "../src/entries/distributions.js";
import { dmultinom, pbvnorm } from "../src/entries/distributions.js";
import { knownViolations, matchesKnown, type KnownViolation } from "./helpers/distributionKnown.js";
import {
  FamilyRunner,
  distributionFamilies,
  familySeed,
  generator,
  type Flags,
  type Kind,
  type Params,
  type Sizes,
} from "./helpers/properties.js";

const SEED = 20261027;
/** Evaluation points per parameter set */
const SIZES = { raw: 8, quantile: 8, central: 3 };
/**
 * Parameter sets per family: 40 by default, fewer for the families whose calls at extreme parameters take 10-20 ms
 * each (about 10 s in all)
 */
const PARAM_SETS: Record<string, number> = {
  "nbinom(prob)": 3,
  "nbinom(mu)": 6,
  "gamma(rate)": 15,
  "gamma(scale)": 8,
  nt: 6,
  f: 12,
  beta: 12,
  nbeta: 25,
  tukey: 15,
  t: 10,
  chisq: 10,
  pois: 15,
};

/**
 * Parameter sets run on every test besides the random ones: bugs fixed before these tests existed, which the random sets
 * may not reach. pchisq(3e9, 1, { ncp: 3e9 }) was -21849.97 (0.15.0); pchisq(763.66, 2, { ncp: 17.0 }) was
 * 1.0000000000000002 (0.15.1), and likewise pt, pf and pbeta below; signrank's low values changed once the table
 * for the centre of n had been built (read with the points in increasing order, without quantiles first)
 */
const REGRESSION: Record<string, { params: Params; x: number[]; sizes?: Omit<Sizes, "extra"> }[]> = {
  // The larger tail was summed or integrated itself and came out a few ulps above 1 (0.15.1)
  nchisq: [
    { params: { df: 1, ncp: 3e9 }, x: [3e9, 3.0001e9] },
    { params: { df: 2, ncp: 16.99599089257515 }, x: [763.6617468878705] },
  ],
  // and at a huge or tiny df the noncentral t was NaN, Infinity or not consistent; at a huge λ, pf and pbeta in the far
  // left tail were not monotone (0.15.1)
  nt: [
    { params: { df: 52.80813184100357, ncp: 3.6452526524836575 }, x: [3428773.6947873095] },
    { params: { df: 100100312298908620, ncp: 2.475805900718761 }, x: [-1.0440480647904281e26, -30.268742563306827, 2.3074923907795758e54] },
    { params: { df: 1e120, ncp: 1 }, x: [-3.5346299778784046e115] },
    { params: { df: 1.9146506048870366e-245, ncp: -1.8387038943733192 }, x: [-59193519471.86663] },
  ],
  nf: [
    { params: { df1: 456.14174201689434, df2: 771.5785513038477, ncp: 26.634566720706474 }, x: [2.473952189555483] },
    { params: { df1: 1297.9256468956266, df2: 204.30365281952962, ncp: 7.500667311607752e266 }, x: [3.495699996315728e104, 1.5482840755724838e155] },
  ],
  nbeta: [
    { params: { shape1: 0.5, shape2: 0.4399301350869252, ncp: 287.25848611940876 }, x: [9.867288258188533e-299] },
    { params: { shape1: 178.5166557908405, shape2: 461.69685003899446, ncp: 18428991667705106000 }, x: [0.055855858605355024, 0.12485740100964904] },
  ],
  signrank: [
    {
      params: { n: 1100 },
      x: [...Array.from({ length: 41 }, (_, i) => i), (1100 * 1101) / 4],
      sizes: { raw: 0, quantile: 0, central: 0 },
    },
  ],
};

describe("distribution properties", () => {
  for (const family of distributionFamilies) {
    it(family.name, () => {
      const mine = knownViolations.filter((k) => k.family === family.name);
      const used = new Set<KnownViolation>();
      const exclude = (kind: Kind, x: number, pr: Params, flags: Flags): boolean => {
        const k = mine.find((e) => e.exclude?.(kind, x, pr, flags));
        if (k !== undefined) used.add(k);
        return k !== undefined;
      };
      const runner = new FamilyRunner(dist, family, { exclude });
      const n = PARAM_SETS[family.name] ?? 40;
      for (let i = 0; i < n; i++) {
        const r = generator(familySeed(SEED, family.name, i));
        runner.runParamSet(family.params(r), r, SIZES);
      }
      REGRESSION[family.name]?.forEach(({ params, x, sizes }, i) =>
        runner.runParamSet(params, generator(familySeed(SEED, family.name, 900 + i)), { ...(sizes ?? SIZES), extra: x }),
      );
      mine.forEach((k, j) =>
        k.examples?.forEach(({ params, x }, i) =>
          runner.runParamSet(params, generator(familySeed(SEED, family.name, 1000 * (j + 1) + i)), { ...SIZES, extra: x ?? [] }),
        ),
      );
      runner.checkOrder();
      const unexpected = runner.violations.filter((v) => {
        const k = mine.find((e) => matchesKnown(e, v));
        if (k !== undefined) used.add(k);
        return k === undefined;
      });
      const unused = mine.filter((k) => !used.has(k)).map((k) => `${k.property}: ${k.reason}`);
      console.log(
        `${family.name}: ${n} parameter sets, ${runner.calls} calls (${runner.excluded} excluded, ` +
          `${runner.tableLimited} sets past the table limit), ${runner.violations.length - unexpected.length} known violations`,
      );
      expect(unexpected.slice(0, 30).map((v) => `${v.property}: ${v.call} ${v.detail}`)).toEqual([]);
      expect(unused, "known violations not needed").toEqual([]);
    });
  }

  it("dmultinom and pbvnorm are probabilities", () => {
    const r = generator(SEED);
    const bad: string[] = [];
    for (let i = 0; i < 200; i++) {
      const k = 1 + Math.floor(r.unif() * 5);
      const x = Array.from({ length: k }, () => Math.floor(-Math.log(1 - r.unif()) * 10));
      const prob = Array.from({ length: k }, () => r.unif());
      const d = dmultinom(x, prob);
      const ld = dmultinom(x, prob, { log: true });
      if (!(d >= 0 && d <= 1) || !(ld <= 0)) bad.push(`dmultinom(${JSON.stringify(x)}, ${JSON.stringify(prob)}) = ${d}, log ${ld}`);
      const lower = [r.norm() * 3, r.norm() * 3];
      const upper = lower.map((v) => v + -Math.log(1 - r.unif()) * 3);
      const rho = 2 * r.unif() - 1;
      const p = pbvnorm(lower, upper, rho);
      if (!(p >= 0 && p <= 1)) bad.push(`pbvnorm(${JSON.stringify(lower)}, ${JSON.stringify(upper)}, ${rho}) = ${p}`);
    }
    expect(bad).toEqual([]);
  });
});

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
 * may not reach. pchisq(3e9, 1, { ncp: 3e9 }) was -21849.97 (0.15.0); signrank's low values changed once the table
 * for the centre of n had been built (read with the points in increasing order, without quantiles first)
 */
const REGRESSION: Record<string, { params: Params; x: number[]; sizes?: Omit<Sizes, "extra"> }[]> = {
  nchisq: [{ params: { df: 1, ncp: 3e9 }, x: [3e9, 3.0001e9] }],
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

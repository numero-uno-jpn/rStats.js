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
    // Densities at a tiny or subnormal ncp were NaN (0.15.2)
    { params: { df: 1, ncp: 1.1186442675478367e-308 }, x: [1.4777750489339286e-267, 1] },
    { params: { df: 3, ncp: 5e-324 }, x: [1] },
    // NaN at λ = 2.9e304 and a tiny x; at a subnormal x with an odd last bit the rounding of x/2 showed (0.15.2)
    { params: { df: 294.3792308686567, ncp: 2.9075530479120456e304 }, x: [1.0051275796545665e-308] },
    { params: { df: 1.1880112027598556e-51, ncp: 197.42584661272352 }, x: [5.331474942214491e-296, 2.1396743e-317] },
    { params: { df: 0.5, ncp: 24.327519525000625 }, x: [7.02293709e-315, 1.63e-322] },
    { params: { df: 1.0815364379934587e-261, ncp: 376.01614454288807 }, x: [3.773015050217397e-307, 3.612655063767058e-198] },
    // NaN at a huge x and a tiny ncp, and where x + λ is beyond the doubles (0.15.2)
    { params: { df: 0.5, ncp: 2.227e-320 }, x: [2.961066668065476e307] },
    { params: { df: 3.2994201097489077e268, ncp: 6.93900544389044e307 }, x: [1e308, 1.7976931348623157e308] },
  ],
  // and at a huge or tiny df the noncentral t was NaN, Infinity or not consistent; at a huge λ, pf and pbeta in the far
  // left tail were not monotone (0.15.1)
  nt: [
    { params: { df: 52.80813184100357, ncp: 3.6452526524836575 }, x: [3428773.6947873095] },
    { params: { df: 100100312298908620, ncp: 2.475805900718761 }, x: [-1.0440480647904281e26, -30.268742563306827, 2.3074923907795758e54] },
    { params: { df: 1e120, ncp: 1 }, x: [-3.5346299778784046e115] },
    { params: { df: 1.9146506048870366e-245, ncp: -1.8387038943733192 }, x: [-59193519471.86663] },
    // NaN at a df near the largest double; at a subnormal df NaN (5e-324), and tails of order df that were 0 or lost
    // their digits (0.15.2)
    { params: { df: 3.586e307, ncp: 1 }, x: [-4.05e269, 1e146] },
    { params: { df: 5e-324, ncp: 1 }, x: [1e-300] },
    { params: { df: 2.64786573e-316, ncp: 51.602876797164654 }, x: [49.76970539722677, 51.6475084516575] },
    { params: { df: 8.99e-321, ncp: 44.354884551454724 }, x: [59754709620367.96] },
  ],
  // At a df above 1.34e300 dt and pt were NaN and qt off; at a subnormal df qt was finite and dt NaN (0.15.2)
  t: [
    { params: { df: 7.19e301 }, x: [-6.78e140, 1.48e-132, 36.727901113286414, 1e146] },
    { params: { df: 8.832105e-318 }, x: [4.246073934552899] },
    { params: { df: 5e-324 }, x: [1e-300, 3] },
  ],
  // From a shape (or sdlog) of about 1e301 on NaN; at a subnormal shape qgamma was NaN and the log of the upper tail lost
  // digits; pgamma(Inf) was NaN at a subnormal rate (0.15.2)
  "gamma(rate)": [
    { params: { shape: 4.169202345291529e301, rate: 0.0013796161711058558 }, x: [1.3913836039305888e-284] },
    { params: { shape: 9.153352708527047e305, rate: 0.44272583475376925 }, x: [1.327296847098002e27, 2.0675e306] },
    { params: { shape: 3.2393711057909095e-307, rate: 1.8038736175233981e-106 }, x: [1e-300] },
    { params: { shape: 892.4483530128322, rate: 2.7994597e-316 }, x: [Infinity] },
  ],
  // and qgamma at a subnormal p and a shape of 3.3e126 was 1e21 times the mean (0.15.2)
  "gamma(scale)": [
    { params: { shape: 4.7893788e-316, scale: 2.0638560126343632 }, x: [1.1183229256009648e-36, 2.0638560126343632] },
    { params: { shape: 3.3032236777741095e126, scale: 0.13574289405428971 }, x: [4.4838914172971214e125] },
  ],
  // and a lower tail of a few subnormal ulps was 0 (0.15.2)
  chisq: [
    { params: { df: 172464.33346354478 }, x: [150856.77415319227] },
    { params: { df: 5.286330057824879e306 }, x: [0.21536010784896303, 5.286330057824879e306] },
    { params: { df: 1e308 }, x: [1e-300, 1e308] },
    { params: { df: 1.107e-321 }, x: [1e-300, 1] },
    { params: { df: 4.3624e-319 }, x: [1e-30, 1] },
  ],
  invgamma: [
    { params: { alpha: 2.0242939794760302e304, beta: 1 }, x: [5.059185917895126e280] },
    { params: { alpha: 1.329253088279987e306, beta: 1.7968496566871956e-118 }, x: [1.1835200363587186e-257, 4.9194550701942195e270] },
    { params: { alpha: 4.35e-322, beta: 1 }, x: [1e-30, 1] },
  ],
  weibull: [{ params: { shape: 6.590415042316493e306, scale: 98.6446406954739 }, x: [1.9162046506434228e-255, 98.6446406954739] }],
  lnorm: [
    { params: { meanlog: -2.1424711721428453, sdlog: 1.292825240812572e305 }, x: [1.2035052020620526e-248, 2] },
    { params: { meanlog: -2.196297604130958, sdlog: 9.311905655416405e307 }, x: [1e-30] },
  ],
  nf: [
    { params: { df1: 456.14174201689434, df2: 771.5785513038477, ncp: 26.634566720706474 }, x: [2.473952189555483] },
    { params: { df1: 1297.9256468956266, df2: 204.30365281952962, ncp: 7.500667311607752e266 }, x: [3.495699996315728e104, 1.5482840755724838e155] },
    // At a subnormal ncp the density was NaN; qf with a subnormal df1 and λ = 1.7e243 did not return (0.15.2)
    { params: { df1: 0.02747085704007554, df2: 3, ncp: 5e-324 }, x: [2.855286418252648e-257] },
    { params: { df1: 3.69345607573e-313, df2: 1249.223519976018, ncp: 1.676553834669942e243 }, x: [1] },
    // Both tails 0 at ncp = 3.7e307 (0.15.2)
    { params: { df1: 1827.512149376115, df2: 0.16542329604093037, ncp: 3.6563492032068665e307 }, x: [2.5e300, 1e303] },
  ],
  nbeta: [
    { params: { shape1: 0.5, shape2: 0.4399301350869252, ncp: 287.25848611940876 }, x: [9.867288258188533e-299] },
    { params: { shape1: 178.5166557908405, shape2: 461.69685003899446, ncp: 18428991667705106000 }, x: [0.055855858605355024, 0.12485740100964904] },
    // A tiny ncp: the density was NaN (0.15.2)
    { params: { shape1: 0.1937170160875713, shape2: 141.08193369784416, ncp: 1.3857699868036388e-303 }, x: [1.0522653871898304e-231] },
  ],
  // At a shape of 1e299 and more pbeta was NaN far from the mass, qbeta 0 or did not return; at a subnormal shape the
  // log of a tail of its order lost digits, a tail near 1 was 5.5e-14 short of it, and a subnormal quantile was 5e-14 off
  // (0.15.2)
  beta: [
    { params: { shape1: 9220.54059054371, shape2: 2.5608778622012845e301 }, x: [3.6e-298, 1.4897613331026733e-236] },
    { params: { shape1: 1.326518545361005e304, shape2: 5.890954242396564 }, x: [0.5] },
    { params: { shape1: 0.9668818597712154, shape2: 4.675035776702327e-307 }, x: [0.9999999999999395] },
    { params: { shape1: 6e-323, shape2: 433.58274113933624 }, x: [4.972082704953929e-48] },
    { params: { shape1: 0.130360175608773, shape2: 8.15e-322 }, x: [0.972696723183617, 0.9999698176120555] },
    { params: { shape1: 27.945113448945182, shape2: 1.5106518374066408e299 }, x: [9.585930727509766e-309] },
    { params: { shape1: 55.11485820081626, shape2: 6.332054207061664e307 }, x: [1e-307, 1e-305, 0.9981707623107112] },
    // NaN at a subnormal x and a shape above 1e300 (0.15.2)
    { params: { shape1: 1.428342256921063e304, shape2: 0.5 }, x: [1.5e-323, 5e-324] },
  ],
  // qf at a df2 of 6e302 did not return; with df2 = Inf, pf was 0 where q df1 underflowed (0.15.2)
  f: [
    { params: { df1: 0.08851774263240042, df2: 6.009378697059168e302 }, x: [4.6e-287] },
    { params: { df1: 0.012086080962967378, df2: Infinity }, x: [2e-323, 1e-300] },
  ],
  // qtukey did not return where 1 - W underflowed with nranges = 2 (the log was -Infinity) (0.15.2)
  tukey: [{ params: { nmeans: 3, df: 46673457704.69311, nranges: 2 }, x: [51.3, 54.5] }],
  // The upper tail far out was NaN (the splitting in the continued fraction overflowed) (0.15.2)
  // and dnbinom(0) at a size of 2.4e301 was NaN (0.15.2)
  "nbinom(prob)": [
    { params: { size: 641.0457517358916, prob: 8.999877024359508e-300 }, x: [1e303] },
    { params: { size: 2.373385507516785e301, prob: 0.9999999999768105 }, x: [0, 1] },
    // dnbinom at a subnormal size lost digits (0.15.2)
    { params: { size: 3.941094207e-315, prob: 0.12459577713161707 }, x: [57, 58] },
  ],
  // qcauchy with logP lost digits at a subnormal scale; the tail where q - location overflows was 0 (0.15.2)
  cauchy: [
    { params: { location: 3.5476859422264514e-180, scale: 9.11522704e-314 }, x: [-1.7624822526054919e-76] },
    { params: { location: -1.1000747441814416e307, scale: 2.7035785439311993e296 }, x: [1.79e308] },
    // dcauchy at a subnormal scale lost digits or was 0 (0.15.2)
    { params: { location: 0, scale: 1.57817263326e-312 }, x: [-2.16543841389836e-309] },
    { params: { location: 0, scale: 5e-324 }, x: [1e-10] },
  ],
  // dnorm was NaN where 1 / sd overflows (0.15.2)
  // and lost digits where exp(700 - z²/2) was subnormal (0.15.2)
  norm: [
    { params: { mean: 0, sd: 1.7e-322 }, x: [4.84965e-319, 5.1e-321] },
    { params: { mean: 0, sd: 3e-323 }, x: [-1.59e-321] },
  ],
  // Densities through a subnormal exp(-|z|) lost digits (0.15.2)
  laplace: [{ params: { mu: 9.486302498433996e-158, sigma: 6.044548486737205e-171 }, x: [9.486302497985611e-158] }],
  logis: [{ params: { location: 0, scale: 4.81926e-319 }, x: [-3.5667197e-316] }],
  // pgeom at a subnormal prob was 0 from x = 1e290 (0.15.2)
  geom: [{ params: { prob: 5e-324 }, x: [2.7772312556802523e285, 1.948811553346453e294] }],
  // An upper tail of a few subnormal ulps was 0 (0.15.2)
  pois: [{ params: { lambda: 229399.39745017525 }, x: [248046] }],
  // qtriang returned the mode at a subnormal width (0.15.2)
  triang: [
    { params: { a: 0, b: 1.02822077e-316, c: 8.726421e-317 }, x: [1.02817096e-316] },
    { params: { a: 0, b: 7.36918471256e-313, c: 0 }, x: [2.2849939e-316] },
    // and lost digits in the log where a ratio of lengths was subnormal (0.15.2)
    { params: { a: 0, b: 1.2412114100115105e133, c: 5.580977276459495e132 }, x: [3.066199584564306e-190] },
    { params: { a: 0, b: 1.3330842142984116e63, c: 0 }, x: [2.2847913320311623e-257] },
  ],
  // At a subnormal shape qkumar was NaN and the log of a tail of the shape's order lost digits (0.15.2)
  kumar: [
    { params: { a: 9.850037901e-314, b: 2.5311232825763126 }, x: [0.5] },
    { params: { a: 0.4223756809729819, b: 1.8537887e-317 }, x: [0.20150301163084805] },
  ],
  pareto: [{ params: { a: 1.040734e-317, b: 1 }, x: [318.7041047333832] }],
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

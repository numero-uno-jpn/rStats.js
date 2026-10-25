// Dispatch of random-number fixture cases on R's function name (the fn of oracle/random.R and oracle/rngkind.R)
import {
  rbeta, rbinom, rcauchy, rchisq, rexp, rf, rgamma, rgeom, rlnorm, rlogis,
  rhyper, rmultinom, rnbinom, rnorm, rpois, rsignrank, rt, runif, rweibull, rwilcox, sampleInt,
} from "../../src/index.js";
import { rinvgamma, rkumar, rlaplace, rpareto, rtriang } from "../../src/random/extra.js";
import { num } from "./fixture.js";
import { nums, type RandomCase } from "./random.js";

export type Args = RandomCase["args"];
export const v = (a: Args, k: string): number => num(a[k] as string);
/** Optional parameters (passed if present in the fixture) */
const opt = (a: Args, ...keys: string[]): Record<string, number> => {
  const o: Record<string, number> = {};
  for (const k of keys) if (a[k] !== undefined) o[k] = v(a, k);
  return o;
};

/** Dispatch on the fixture's fn (the R function name) */
export function call(a: Args): number[] {
  const n = a.n !== undefined ? v(a, "n") : 0;
  switch (a.fn) {
    case "runif": return runif(n, opt(a, "min", "max"));
    case "rnorm": return rnorm(n, opt(a, "mean", "sd"));
    case "rexp": return rexp(n, opt(a, "rate"));
    case "rgamma": return rgamma(n, v(a, "shape"), opt(a, "scale"));
    case "rchisq": return rchisq(n, v(a, "df"), opt(a, "ncp"));
    case "rt": return rt(n, v(a, "df"), opt(a, "ncp"));
    case "rf": return rf(n, v(a, "df1"), v(a, "df2"), opt(a, "ncp"));
    case "rbeta": return rbeta(n, v(a, "shape1"), v(a, "shape2"), opt(a, "ncp"));
    case "rpois": return rpois(n, v(a, "lambda"));
    case "rbinom": return rbinom(n, v(a, "size"), v(a, "prob"));
    case "rgeom": return rgeom(n, v(a, "prob"));
    case "rnbinom": return rnbinom(n, v(a, "size"), opt(a, "prob", "mu"));
    case "rcauchy": return rcauchy(n, opt(a, "location", "scale"));
    case "rlogis": return rlogis(n, opt(a, "location", "scale"));
    case "rlnorm": return rlnorm(n, opt(a, "meanlog", "sdlog"));
    case "rweibull": return rweibull(n, v(a, "shape"), opt(a, "scale"));
    // In long-sequence cases n is the number of draws and the order statistic's n is nb
    case "rsignrank": return a.nb !== undefined ? rsignrank(n, v(a, "nb")) : rsignrank(v(a, "nn"), v(a, "n"));
    case "rwilcox": return a.nb !== undefined ? rwilcox(n, v(a, "m"), v(a, "nb")) : rwilcox(v(a, "nn"), v(a, "m"), v(a, "n"));
    case "sample.int":
      // sampleInt is 0-based; add 1 to compare with R
      return sampleInt(n, {
        ...(a.size !== undefined ? { size: v(a, "size") } : {}),
        replace: a.replace === true,
        ...(a.prob !== undefined ? { prob: nums(a.prob) } : {}),
      }).map((i) => i + 1);
    case "rhyper":
      // In long-sequence cases n is the number of draws and the number of black balls is nb
      return a.nb !== undefined ? rhyper(n, v(a, "m"), v(a, "nb"), v(a, "k")) : rhyper(v(a, "nn"), v(a, "m"), v(a, "n"), v(a, "k"));
    case "rmultinom": return rmultinom(n, v(a, "size"), nums(a.prob)).flat();
    // extraDistr (rextradist)
    case "rinvgamma": return rinvgamma(n, v(a, "alpha"), opt(a, "beta"));
    case "rkumar": return rkumar(n, v(a, "a"), v(a, "b"));
    case "rpareto": return rpareto(n, opt(a, "a", "b"));
    case "rtriang": return rtriang(n, opt(a, "a", "b", "c"));
    case "rlaplace": return rlaplace(n, opt(a, "mu", "sigma"));
  }
  if (a.script === "mixed") {
    return [
      ...rbinom(5, 10, 0.3), ...rbinom(5, 100, 0.5), ...rbinom(5, 10, 0.3),
      ...rpois(5, 3), ...rpois(5, 30), ...rpois(5, 3), ...rgamma(3, 2), ...rgamma(3, 0.5), ...rgamma(3, 2),
      ...rbeta(3, 2, 3), ...rbeta(3, 0.5, 0.5), ...rbeta(3, 2, 3), ...rbinom(5, 100, 0.7), ...rbinom(5, 100, 0.3),
    ];
  }
  throw new Error(`unknown case ${JSON.stringify(a)}`);
}


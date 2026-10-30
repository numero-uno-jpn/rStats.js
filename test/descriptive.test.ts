// Descriptive statistics against R (oracle/descriptive.R; e1071 and DescTools for the functions R lacks)
import { describe, expect, it } from "vitest";
import {
  cor, cov, cummax, cummin, cumprod, cumsum, cut, cv, diff, ecdf, findInterval, fivenum, geometricMean, hist, IQR,
  kurtosis, mad, mean, meanAD, median, modes, prod, quantile, range, rank, scale, sd, skewness, sum, table, tabulate,
  unique, variance, weightedMean,
} from "../src/index.js";
import { arg, defined, htestSuite, type HTestArg } from "./helpers/htest.js";

type A = Record<string, HTestArg>;
const x = (a: A): number[] => arg.vec(a.x) ?? [];
const naRm = (a: A) => defined({ naRm: arg.bool(a.naRm) });
const mat = (v: HTestArg | undefined): number[] | number[][] | undefined =>
  v === undefined ? undefined : Array.isArray(v) && Array.isArray(v[0]) ? arg.mat(v) : arg.vec(v);
const val = (value: unknown) => ({ value });

const suites: [string, (a: A) => object, number?][] = [
  ["sum", (a) => val(sum(x(a), naRm(a)))],
  ["prod", (a) => val(prod(x(a), naRm(a)))],
  ["mean", (a) => val(mean(x(a), defined({ trim: arg.num(a.trim), naRm: arg.bool(a.naRm) })))],
  ["var", (a) => val(variance(x(a), naRm(a)))],
  ["sd", (a) => val(sd(x(a), naRm(a)))],
  ["median", (a) => val(median(x(a), naRm(a)))],
  ["range", (a) => val(range(x(a), naRm(a)))],
  ["weightedMean", (a) => val(weightedMean(x(a), arg.vec(a.w)!, naRm(a)))],
  ["quantile", (a) => val(quantile(x(a), arg.vec(a.probs) ?? [], defined({ type: arg.num(a.type), naRm: arg.bool(a.naRm) })))],
  ["IQR", (a) => val(IQR(x(a), defined({ type: arg.num(a.type), naRm: arg.bool(a.naRm) })))],
  ["fivenum", (a) => val(fivenum(x(a)))],
  [
    "mad",
    (a) =>
      val(
        mad(
          x(a),
          defined({
            center: arg.num(a.center),
            constant: arg.num(a.constant),
            naRm: arg.bool(a.naRm),
            low: arg.bool(a.low),
            high: arg.bool(a.high),
          }),
        ),
      ),
  ],
  ["cumsum", (a) => val(cumsum(x(a)))],
  ["cumprod", (a) => val(cumprod(x(a)))],
  ["cummax", (a) => val(cummax(x(a)))],
  ["cummin", (a) => val(cummin(x(a)))],
  ["diff", (a) => val(diff(x(a), defined({ lag: arg.num(a.lag), differences: arg.num(a.differences) })))],
  [
    "rank",
    (a) =>
      val(rank(x(a), defined({ tiesMethod: arg.str<"average">(a.tiesMethod), naLast: arg.str<"keep">(a.naLast) }))),
  ],
  ["cov", (a) => val(cov(mat(a.x)!, mat(a.y), defined({ method: arg.str(a.method), use: arg.str(a.use) })))],
  ["corMatrix", (a) => val(cor(mat(a.x)!, mat(a.y), defined({ method: arg.str(a.method), use: arg.str(a.use) })))],
  [
    "scale",
    (a) => {
      const opt = (v: HTestArg | undefined) => (typeof v === "boolean" ? v : arg.vec(v));
      const r = scale(mat(a.x)!, defined({ center: opt(a.center), scale: opt(a.scale) }));
      return { value: r.scaled, center: r.center, scale: r.scale };
    },
  ],
  ["tabulate", (a) => val(tabulate(arg.vec(a.bin) ?? [], arg.num(a.nbins)))],
  ["table", (a) => table(x(a), defined({ useNA: arg.str<"no">(a.useNA) }))],
  ["unique", (a) => val(unique(x(a)))],
  [
    "cut",
    (a) => {
      const b = arg.vec(a.breaks)!;
      return val(cut(x(a), b.length === 1 ? b[0]! : b, defined({ right: arg.bool(a.right), includeLowest: arg.bool(a.includeLowest) })));
    },
  ],
  [
    "findInterval",
    (a) =>
      val(
        findInterval(
          x(a),
          arg.vec(a.vec) ?? [],
          defined({ rightmostClosed: arg.bool(a.rightmostClosed), allInside: arg.bool(a.allInside), leftOpen: arg.bool(a.leftOpen) }),
        ),
      ),
  ],
  [
    "hist",
    (a) => {
      const b = a.breaks;
      const breaks = typeof b === "string" && Number.isNaN(Number(b)) ? (b as "FD") : b === undefined ? undefined : arg.vec(b);
      const bb = Array.isArray(breaks) && breaks.length === 1 ? breaks[0] : breaks;
      return hist(x(a), defined({ breaks: bb, right: arg.bool(a.right) }));
    },
  ],
  ["ecdf", (a) => val((arg.vec(a.q) ?? []).map(ecdf(x(a))))],
  ["skewness", (a) => val(skewness(x(a), defined({ type: arg.num(a.type) as 1 | undefined })))],
  ["kurtosis", (a) => val(kurtosis(x(a), defined({ type: arg.num(a.type) as 1 | undefined })))],
  ["geometricMean", (a) => val(geometricMean(x(a), naRm(a)))],
  ["modes", (a) => modes(x(a))],
  ["meanAD", (a) => val(meanAD(x(a), defined({ center: arg.str<"median">(a.center) })))],
  ["cv", (a) => val(cv(x(a), defined({ unbiased: arg.bool(a.unbiased) })))],
];

/**
 * Data with a large mean and a small spread (1e8 + 1e-3 noise): R's var and e1071's moments subtract a mean rounded
 * to double and lose up to 1e-4 relative there; the values here agree with 60-digit computations
 */
function largeMean(a: A): string | undefined {
  const m = mat(a.x);
  if (m === undefined) return undefined;
  const cols = Array.isArray(m[0]) ? (m as number[][])[0]!.map((_, j) => (m as number[][]).map((r) => r[j]!)) : [m as number[]];
  const tiny = cols.some((c) => {
    const v = c.filter(Number.isFinite);
    return v.length > 1 && sd(v) / Math.abs(mean(v)) < 1e-6;
  });
  return tiny ? "R loses digits on data with a large mean and a small spread (the values here agree with 60-digit ones)" : undefined;
}

/** R tells NA from NaN; JavaScript has one NaN, so table and unique count them as one value */
function naAndNaN(a: A): string | undefined {
  const raw = a.x as unknown as string[];
  return raw.includes("NA") && raw.includes("NaN") ? "R tells NA from NaN; rStats.js has one NaN" : undefined;
}

/**
 * Values so large that R's sums overflow: R's weighted.mean returns Inf or NaN and e1071's moments NaN; rStats.js
 * rescales and returns the finite value (docs/differences-from-r.md)
 */
function overflow(limit: number): (a: A) => string | undefined {
  return (a) => {
    const m = mat(a.x);
    if (m === undefined) return undefined;
    const v = (Array.isArray(m[0]) ? (m as number[][]).flat() : (m as number[])).filter(Number.isFinite);
    return v.some((t) => Math.abs(t) > limit) ? "R's sums overflow; rStats.js rescales and returns the finite value" : undefined;
  };
}

const known: Record<string, (a: A) => string | undefined> = {
  weightedMean: overflow(1e300),
  var: largeMean,
  sd: largeMean,
  cov: largeMean,
  corMatrix: largeMean,
  skewness: (a) => largeMean(a) ?? overflow(1e75)(a),
  kurtosis: (a) => largeMean(a) ?? overflow(1e75)(a),
  cv: largeMean,
  table: naAndNaN,
  unique: naAndNaN,
};
// skewness and kurtosis near 0 come from cancellation (r - 3): measured absolutely
const floors: Record<string, Record<string, number>> = { skewness: { value: 1 }, kurtosis: { value: 1 } };

for (const [name, call, tolerance] of suites) {
  const k = known[name];
  htestSuite({
    name,
    call,
    tolerance: tolerance ?? 1e-14,
    ...(floors[name] === undefined ? {} : { floor: floors[name] }),
    ...(k === undefined ? {} : { knownDifference: (a: A) => k(a) }),
  });
}

describe("descriptive extras", () => {
  it("quantile with one probability returns a number", () => {
    expect(quantile([1, 2, 3, 4, 5, 6], 0.25)).toBe(2.25);
    expect(quantile([1, 2, 3, 4, 5, 6], 0.25, { type: 9 })).toBe(1.9375);
  });
});

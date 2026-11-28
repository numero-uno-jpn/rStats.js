// ppoints, qqnorm, qqline, boxplotStats, lowess, bwNrd0, bwNrd, density and lm's influence measures against R
// (test/fixtures/plotstats.json from oracle/plotstats.R; the behaviour in experiments/plot121-log.md, 1.21.0).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  boxplotStats, bwNrd, bwNrd0, density, lm, lmCooksDistance, lmHatvalues, lmRstandard, lmRstudent, lowess, ppoints,
  qnorm, qqline, qqnorm, type KernelDensityOptions,
} from "../src/index.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/plotstats.json", import.meta.url), "utf8")) as Record<string, any>;
const num = (v: unknown): number => (v === null ? NaN : Number(v));
const arr = (v: unknown): number[] => (v === undefined ? [] : Array.isArray(v) ? v.map(num) : [num(v)]);
/** The largest difference relative to max(|expected|, floor); NaN must match NaN */
function maxRel(a: readonly number[], e: readonly number[], floor = 0): number {
  expect(a.length).toBe(e.length);
  let m = 0;
  a.forEach((v, i) => {
    const t = e[i]!;
    if (Number.isNaN(t)) {
      expect(v, `index ${i}`).toBeNaN();
      return;
    }
    if (v === t) return;
    m = Math.max(m, Math.abs(v - t) / Math.max(Math.abs(t), floor));
  });
  return m;
}
const peakRel = (a: readonly number[], e: readonly number[]): number => {
  expect(a.length).toBe(e.length);
  const peak = Math.max(...e);
  return Math.max(0, ...a.map((v, i) => Math.abs(v - e[i]!))) / peak;
};
const samples: Record<string, number[]> = Object.fromEntries(
  Object.entries(fx.qqnorm as Record<string, any>).map(([k, v]) => [k, arr(v.y)]),
);
const edge = fx.edge as Record<string, { value?: any; error?: string; warnings: string[] | string }>;
const warningsOf = (k: string): string[] => {
  const w = edge[k]!.warnings;
  return Array.isArray(w) ? w : [w];
};

describe("ppoints", () => {
  for (const [k, v] of Object.entries(fx.ppoints as Record<string, any>)) {
    it(`n = ${k}`, () => {
      expect(maxRel(ppoints(v.n), arr(v.default))).toBeLessThan(1e-15);
      expect(maxRel(ppoints(v.n, { a: 0 }), arr(v.a0))).toBeLessThan(1e-15);
      expect(maxRel(ppoints(v.n, { a: 1 }), arr(v.a1))).toBeLessThan(1e-15);
    });
  }
  it("edge cases as R", () => {
    expect(maxRel(ppoints([9, 8, 7]), arr(edge.pp_vec!.value))).toBeLessThan(1e-15);
    expect(ppoints(0)).toEqual([]);
    expect(maxRel(ppoints(2.7), arr(edge.pp_frac!.value))).toBeLessThan(1e-15);
    expect(maxRel(ppoints(5, { a: 2 }), arr(edge.pp_a_bad!.value))).toBeLessThan(1e-15);
    expect(maxRel(ppoints(5, { a: -1 }), arr(edge.pp_a_neg!.value))).toBeLessThan(1e-15);
    expect(() => ppoints(-1)).toThrow(RangeError);
  });
});

describe("qqnorm and qqline", () => {
  for (const [k, v] of Object.entries(fx.qqnorm as Record<string, any>)) {
    it(k, () => {
      const r = qqnorm(arr(v.y));
      expect(maxRel(r.x, arr(v.x))).toBeLessThan(2e-15);
      expect(maxRel(r.y, arr(v.qy))).toBe(0);
      if (v.slope !== undefined) {
        const l = qqline(arr(v.y));
        expect(maxRel([l.slope, l.intercept], [num(v.slope), num(v.intercept)], 1e-300)).toBeLessThan(1e-14);
      }
    });
  }
  it("edge cases as R", () => {
    expect(() => qqnorm([])).toThrow("y is empty or has only NAs");
    expect(() => qqnorm([NaN, NaN])).toThrow("y is empty or has only NAs");
    expect(qqnorm([5]).x).toEqual([0]);
    expect(maxRel(qqnorm([1, -Infinity, 3, Infinity]).x, arr(edge.q_inf!.value.x))).toBeLessThan(2e-15);
    expect(maxRel(qqnorm([2, NaN, 1]).x, arr(edge.q_nan!.value.x))).toBeLessThan(2e-15);
    expect(maxRel(qqnorm([2, 1, 2, 1, 2]).x, arr(edge.q_ties!.value.x))).toBeLessThan(2e-15);
  });
  it("qqline's options", () => {
    const y = samples.precip!;
    const d = qqline(y, { datax: true });
    const l = qqline(y);
    expect(d.slope).toBeCloseTo(1 / l.slope, 12);
    const t = qqline(y, { probs: [0.1, 0.9], qtype: 6, distribution: (p) => qnorm(p, { mean: 1 }) });
    expect(Number.isFinite(t.slope)).toBe(true);
    expect(() => qqline(y, { probs: [0.1, 1.2] })).toThrow(RangeError);
  });
});

describe("boxplotStats", () => {
  for (const [k, v] of Object.entries(fx.boxplot as Record<string, any>)) {
    it(k, () => {
      const y = v.y ? arr(v.y) : samples[v.sample]!;
      const b = boxplotStats(y, { coef: num(v.coef) });
      expect(maxRel(b.stats, arr(v.stats), 1e-300)).toBe(0);
      expect(b.n).toBe(num(v.n));
      expect(maxRel(b.conf, arr(v.conf), 1e-300)).toBeLessThan(1e-15);
      expect(b.out).toEqual(arr(v.out));
    });
  }
  it("groups as boxplot(plot = FALSE)", () => {
    // InsectSprays' counts are not in the fixture: the group statistics are those of boxplot.stats per group, checked
    // through the outliers R reports (7 in group C, 12 in group D) and the counts
    const g = fx.boxplotGroups;
    expect(arr(g.n)).toEqual([12, 12, 12, 12, 12, 12]);
    expect(arr(g.out)).toEqual([7, 12]);
  });
  it("edge cases as R", () => {
    for (const k of ["b_empty", "b_allna"]) {
      const b = boxplotStats(k === "b_empty" ? [] : [NaN, NaN]);
      expect(b.stats.every(Number.isNaN)).toBe(true);
      expect([b.n, b.out]).toEqual([0, []]);
      expect(b.conf.every(Number.isNaN)).toBe(true);
    }
    // JSON has no Infinity: R's out is Inf / -Inf, written as null
    const bi = boxplotStats([1, 2, 3, 4, Infinity]);
    expect(bi.stats).toEqual(arr(edge.b_inf!.value.stats));
    expect(bi.out).toEqual([Infinity]);
    expect(maxRel(bi.conf, arr(edge.b_inf!.value.conf))).toBeLessThan(1e-15);
    expect(boxplotStats([-Infinity, 1, 2, 3, 4, 5, 6]).out).toEqual([-Infinity]);
    expect(boxplotStats([1, NaN, 2, 3]).stats).toEqual(arr(edge.b_nan!.value.stats));
    expect(() => boxplotStats([1, 2, 3, 40], { coef: -1 })).toThrow("'coef' must not be negative");
    const nc = boxplotStats([1, 2, 3, 40], { doConf: false, doOut: false });
    expect([nc.conf, nc.out, nc.stats]).toEqual([[], [], arr(edge.b_noconf!.value.stats)]);
    const big = boxplotStats([1, 2, 3, 4, 100].map((t) => t * 1e300));
    expect(maxRel(big.stats, arr(edge.b_big!.value.stats))).toBeLessThan(1e-15);
    expect(maxRel(big.conf, arr(edge.b_big!.value.conf))).toBeLessThan(1e-15);
    expect(big.out).toEqual(arr(edge.b_big!.value.out));
    const common = boxplotStats([1, 2, 3, 4, 100].map((t) => 1e15 + t));
    expect(common.stats).toEqual(arr(edge.b_common!.value.stats));
    expect(maxRel(common.conf, arr(edge.b_common!.value.conf))).toBeLessThan(1e-15);
  });
});

describe("lowess", () => {
  for (const [k, v] of Object.entries(fx.lowess as Record<string, any>)) {
    it(k, () => {
      const opts = v.delta !== undefined ? { f: num(v.f), iter: num(v.iter), delta: num(v.delta) } : { f: num(v.f), iter: num(v.iter) };
      const r = lowess(arr(v.x), arr(v.y), opts);
      expect(r.x).toEqual(arr(v.ox));
      expect(maxRel(r.y, arr(v.oy), 1e-300)).toBeLessThan(1e-12);
    });
  }
  const yy = [2, 4, 3, 6, 5, 8, 7, 10, 9, 12];
  const xx = Array.from({ length: 10 }, (_, i) => i + 1);
  const same = (k: string, r: { x: number[]; y: number[] }, tol = 1e-12) => {
    expect(maxRel(r.x, arr(edge[k]!.value.x), 1e-300)).toBeLessThan(1e-15);
    expect(maxRel(r.y, arr(edge[k]!.value.y), 1e-300)).toBeLessThan(tol);
  };
  it("small and degenerate inputs as R", () => {
    same("l_one", lowess([1], [2]));
    same("l_two", lowess([1, 2], [3, 5]));
    same("l_three", lowess([1, 2, 3], [3, 5, 4]));
    same("l_samex", lowess([2, 2, 2, 2, 2], [1, 2, 3, 4, 5]));
    same("l_ties", lowess([1, 1, 2, 2, 3, 3, 4, 4], [1, 2, 2, 4, 3, 5, 4, 7]));
    same("l_fbig", lowess(xx, yy, { f: 3 }));
    same("l_iterfrac", lowess(xx, yy, { iter: 1.7 }));
    same("l_deltabig", lowess(xx, yy, { delta: 100 }));
    same("l_outlier", lowess(Array.from({ length: 12 }, (_, i) => i + 1), [...Array.from({ length: 11 }, (_, i) => i + 1), 500]));
    // an exact line: R's own round-off is 1e-15 of the values
    same("l_exact", lowess(xx, xx.map((t) => 2 * t + 1)), 1e-14);
  });
  it("scales: the smooth at scale 1, scaled or shifted (R's differs there)", () => {
    const unit = lowess(xx, yy).y;
    for (const s of [1e300, 1e-300, 1e-150]) {
      const r = lowess(xx.map((t) => t * s), yy.map((t) => t * s));
      expect(maxRel(r.y, unit.map((t) => t * s))).toBeLessThan(1e-13);
    }
    // R gives values 1e14 off near 1e15 (and changes at 1e300 and 1e-300): the fixture records it
    expect(Math.abs(num(edge.l_common!.value.y[0]) - (1e15 + unit[0]!))).toBeGreaterThan(1e13);
    const c = lowess(xx.map((t) => 1e15 + t), yy.map((t) => 1e15 + t));
    c.y.forEach((v, i) => expect(Math.abs(v - (1e15 + unit[i]!))).toBeLessThanOrEqual(0.25));
    expect(Math.abs(num(edge.l_big!.value.y[0]) / 1e300 - unit[0]!)).toBeGreaterThan(1);
  });
  it("errors", () => {
    expect(() => lowess([], [])).toThrow("invalid input");
    expect(() => lowess([1, 2, 3, 4, 5], [1, 2, 3, 4])).toThrow("'x' and 'y' lengths differ");
    expect(() => lowess(xx, yy, { f: 0 })).toThrow("'f' must be finite and > 0");
    expect(() => lowess(xx, yy, { f: -1 })).toThrow("'f' must be finite and > 0");
    expect(() => lowess(xx, yy, { iter: -1 })).toThrow("'iter' must be finite and >= 0");
    expect(() => lowess(xx, yy, { delta: -1 })).toThrow("'delta' must be finite and > 0");
    expect(() => lowess([1, 2, NaN, 4, 5], [1, 3, 2, 5, 4])).toThrow(RangeError);
    expect(() => lowess([1, 2, 3, 4, Infinity], [1, 3, 2, 5, 4])).toThrow(RangeError);
    // R returns y unsmoothed when y has a missing value; rStats.js refuses
    expect(() => lowess([1, 2, 3, 4, 5], [1, 3, NaN, 5, 4])).toThrow("'y' contains missing values");
  });
});

describe("bwNrd0 and bwNrd", () => {
  for (const [k, v] of Object.entries(fx.bw as Record<string, any>)) {
    it(k, () => {
      const y = samples[k]!;
      if (typeof v.nrd0 === "string") {
        expect(() => bwNrd0(y)).toThrow(v.nrd0);
        expect(() => bwNrd(y)).toThrow(v.nrd);
        return;
      }
      expect(maxRel([bwNrd0(y)], [num(v.nrd0)])).toBeLessThan(1e-15);
      expect(maxRel([bwNrd(y)], [num(v.nrd)])).toBeLessThan(1e-15);
    });
  }
  it("edge cases as R", () => {
    expect(bwNrd0([1, 1])).toBeCloseTo(num(edge.bw_nrd0_two!.value), 15);
    expect(bwNrd0([0, 0, 0])).toBeCloseTo(num(edge.bw_nrd0_zero!.value), 15);
    expect(maxRel([bwNrd0([1, 2, 2, 2, 2, 2, 9])], [num(edge.bw_nrd0_iqr0!.value)])).toBeLessThan(1e-15);
    expect(bwNrd([1, 2, 2, 2, 2, 2, 9])).toBe(0);
    expect(maxRel([bwNrd0([3.1, 1.2, 5.5, 1.2, 9.0].map((t) => t * 1e300))], [num(edge.bw_nrd0_big!.value)])).toBeLessThan(1e-15);
    expect(() => bwNrd0([1, NaN, 3])).toThrow("missing values and NaN's not allowed if 'na.rm' is FALSE");
    expect(() => bwNrd0([1, 2, Infinity])).toThrow(RangeError);
  });
});

describe("density", () => {
  const TOL = 1e-11; // relative to the peak: FFT round-off (the rectangular kernel's jumps give the largest, 3e-12)
  for (const [k, v] of Object.entries(fx.density as Record<string, any>)) {
    it(k, () => {
      const d = v.d ?? v;
      const y = v.d && v.y ? arr(v.y) : samples[v.sample]!;
      const opts: KernelDensityOptions = { kernel: v.kernel };
      if (v.nout !== undefined) opts.n = num(v.nout);
      if (v.from !== undefined) Object.assign(opts, { from: num(v.from), to: num(v.to) });
      if (v.adjust !== undefined) opts.adjust = num(v.adjust);
      if (typeof v.bw === "number" && v.d) opts.bw = v.bw;
      if (v.cut !== undefined) opts.cut = num(v.cut);
      if (v.weights !== undefined) opts.weights = arr(v.weights);
      if (v.y && v.d) opts.naRm = true;
      if (v.bwName === "SJ") opts.bw = num(d.bw); // bw.SJ itself is not offered: its value from R
      const r = density(y, opts);
      expect(maxRel([r.bw], [num(d.bw)])).toBeLessThan(1e-15);
      expect(maxRel(r.x, arr(d.x), 1e-300)).toBeLessThan(1e-15);
      expect(peakRel(r.y, arr(d.y))).toBeLessThan(TOL);
    });
  }
  const x5 = [3.1, 1.2, 5.5, 1.2, 9.0];
  const same = (k: string, r: ReturnType<typeof density>, tol = TOL) => {
    const e = edge[k]!;
    expect(e.error, `R: ${e.error}`).toBeUndefined();
    expect(maxRel([r.bw], [num(e.value.bw)])).toBeLessThan(1e-15);
    expect(r.n).toBe(num(e.value.n));
    expect(maxRel(r.x, arr(e.value.x), 1e-300)).toBeLessThan(1e-15);
    expect(peakRel(r.y, arr(e.value.y))).toBeLessThan(tol);
    expect(r.warnings).toEqual(warningsOf(k));
  };
  it("edge cases as R", () => {
    same("d_one_bw", density([4], { bw: 0.5 }));
    same("d_nan_narm", density([1, NaN, 3, 4], { naRm: true }));
    same("d_inf", density([1, Infinity, 3, 4]));
    same("d_inf_bw", density([1, Infinity, 3, 4], { bw: 1 }));
    same("d_const", density([2.5, 2.5, 2.5, 2.5, 2.5, 2.5]));
    same("d_n1", density(x5, { n: 1 }));
    same("d_n2", density(x5, { n: 2 }));
    same("d_n513", density(x5, { n: 513 }));
    same("d_large_out", density(x5, { n: 5000 }));
    same("d_fromgt", density(x5, { from: 5, to: 1 }));
    same("d_fromeq", density(x5, { from: 2, to: 2 }));
    same("d_w_unnorm", density(x5, { weights: [1, 2, 3, 4, 5] }));
    same("d_w_zero", density(x5, { weights: [0, 0.25, 0.25, 0.25, 0.25] }));
    same("d_kernel_abbrev", density(x5, { kernel: "epan" }));
    same("d_cut0", density(x5, { cut: 0 }));
    same("d_bwname", density(x5, { bw: "nrd" }));
    same("d_bwname_case", density(x5, { bw: "NRD0" }));
  });
  it("weights with missing values removed as R", () => {
    same("d_w_na_x", density([3.1, NaN, 5.5, 1.2, 9.0], { weights: [0.2, 0.2, 0.2, 0.2, 0.2], naRm: true }));
    // experiment 3: weights summing to 2 are used as they are (R: equal to density of the rest with those weights)
    const a = density([3.1, NaN, 5.5, 1.2, 9.0], { weights: [0.2, 0.6, 0.4, 0.3, 0.5], naRm: true, bw: 1 });
    const b = density([3.1, 5.5, 1.2, 9.0], { weights: [0.2, 0.4, 0.3, 0.5], bw: 1 });
    expect(a.y).toEqual(b.y);
    expect(a.warnings).toEqual(["sum(weights) != 1  -- will not get true density"]);
    const c = density([3.1, NaN, 5.5, 1.2, 9.0], { weights: [0.1, 0.3, 0.2, 0.15, 0.25], naRm: true, bw: 1 });
    const e = density([3.1, 5.5, 1.2, 9.0], { weights: [0.1, 0.2, 0.15, 0.25].map((t) => t / 0.7), bw: 1 });
    expect(peakRel(c.y, e.y)).toBeLessThan(1e-14);
    expect(c.warnings).toEqual([]);
  });
  it("scales as R", () => {
    same("d_big", density(x5.map((t) => t * 1e300)));
    same("d_huge", density([1e306, 2e306, 3e306]));
    // at 1e-300 R's bandwidth differs (its standard deviation loses digits there): rStats.js gives the density at
    // scale 1, scaled
    const unit = density(x5);
    const tiny = density(x5.map((t) => t * 1e-300));
    expect(maxRel([tiny.bw], [unit.bw * 1e-300])).toBeLessThan(1e-14);
    expect(peakRel(tiny.y, unit.y.map((t) => t * 1e300))).toBeLessThan(1e-11);
    expect(Math.abs(num(edge.d_tiny!.value.bw) / 1e-300 - unit.bw)).toBeGreaterThan(0.05);
    // a grid finer than the precision of values near 1e15: R's approx merges equal grid points (and warns)
    same("d_common", density(x5.map((t) => 1e15 + t)), 1e-9);
  });
  it("errors as R", () => {
    for (const [k, f] of [
      ["d_one", () => density([4])],
      ["d_empty", () => density([], { bw: 1 })],
      ["d_na", () => density([1, NaN, 3])],
      ["d_bw0", () => density(x5, { bw: 0 })],
      ["d_bwneg", () => density(x5, { bw: -1 })],
      ["d_bwna", () => density(x5, { bw: NaN })],
      ["d_w_neg", () => density(x5, { weights: [0.5, -0.1, 0.2, 0.2, 0.2] })],
      ["d_w_na", () => density(x5, { weights: [NaN, 0.25, 0.25, 0.25, 0.25] })],
      ["d_w_len", () => density(x5, { weights: [0.5, 0.5] })],
      ["d_adjust0", () => density(x5, { adjust: 0 })],
    ] as [string, () => unknown][]) {
      expect(f, k).toThrow(edge[k]!.error!);
    }
    expect(() => density(x5, { kernel: "foo" })).toThrow("'arg' should be one of");
    expect(() => density(x5, { bw: "SJ" })).toThrow("not offered by rStats.js");
  });
});

describe("lm influence measures", () => {
  const fitOf = (c: any) => {
    const X = (c.X as number[][]).map((r) => r.map(num));
    const intercept = X.every((r) => r[0] === 1);
    const cols = intercept ? X.map((r) => r.slice(1)) : X;
    const y = arr(c.y);
    const opts = { intercept, ...(c.w ? { weights: arr(c.w) } : {}) };
    return lm(cols[0]!.length === 0 ? y.map(() => [] as number[]) : cols, y, opts);
  };
  const check = (c: any, tol = 1e-12, which = ["hat", "rstandard", "rstandardPred", "rstudent", "cooks"]) => {
    const fit = fitOf(c);
    const got: Record<string, number[]> = {
      hat: lmHatvalues(fit), rstandard: lmRstandard(fit), rstandardPred: lmRstandard(fit, { type: "predictive" }),
      rstudent: lmRstudent(fit), cooks: lmCooksDistance(fit),
    };
    for (const k of which) expect(maxRel(got[k]!, arr(c[k]), 1e-300), k).toBeLessThan(tol);
  };
  for (const [k, c] of Object.entries(fx.influence as Record<string, any>)) it(k, () => check(c));
  it("edge cases as R", () => {
    const v = (k: string) => ({ ...edge[k]!.value, X: (edge[k] as any).X, y: (edge[k] as any).y, w: (edge[k] as any).w });
    // leverage 1 and a single residual degree of freedom: the deleted fits are R's round-off (rstudent NaN or 0)
    check(v("i_lev1"), 1e-12, ["hat", "rstandard", "rstandardPred", "cooks"]);
    check(v("i_saturated"));
    check(v("i_two"), 1e-12, ["hat", "rstandard", "rstandardPred", "cooks"]);
    // an exact fit: the residuals are round-off, so only the leverages compare
    check(v("i_exact"), 1e-12, ["hat"]);
    check(v("i_w0"));
    check(v("i_na"));
    check(v("i_big"));
    check(v("i_noint"));
    check(v("i_rankdef"));
    expect(() => lmRstandard(fitOf(v("i_two")), { type: "foo" as "sd.1" })).toThrow(RangeError);
  });
});

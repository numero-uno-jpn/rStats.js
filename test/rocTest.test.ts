import { describe, expect, it } from "vitest";
import { ciAuc, roc, rocTest, runif, setSeed } from "../src/index.js";
import { arg, htestSuite, type HTestCase } from "./helpers/htest.js";
import { makeRoc, strOrNull } from "./helpers/roc.js";

/** The two curves of a rocTest fixture case: one response and two predictors, or two pairs of controls and cases */
function curves(a: HTestCase["args"]) {
  if (a.response !== undefined) {
    return [makeRoc({ ...a, direction: a.direction1 ?? [] }, "1"), makeRoc({ ...a, direction: a.direction2 ?? [] }, "2")] as const;
  }
  return [makeRoc(a, "1"), makeRoc(a, "2")] as const;
}

function options(a: HTestCase["args"]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (a.alternative !== undefined) o.alternative = arg.str(a.alternative);
  if (a.confLevel !== undefined) o.confLevel = arg.num(a.confLevel);
  if (a.paired !== undefined) o.paired = arg.bool(a.paired);
  if (a.method !== undefined) o.method = arg.str(a.method);
  if (a.bootN !== undefined) o.bootN = arg.num(a.bootN);
  if (a.bootStratified !== undefined) o.bootStratified = arg.bool(a.bootStratified);
  return o;
}

// ---- DeLong ----

htestSuite({
  name: "rocTest",
  call: (a) => {
    const [r1, r2] = curves(a);
    return rocTest(r1, r2, { method: "delong", ...options(a) });
  },
  // theta, S and the placements' covariances to a few ulps; the p-values of the normal and t distributions
  tolerance: 1e-13,
  substitute: (c) => {
    const a = c.args;
    const one = (x: unknown): boolean => typeof x === "string";
    if (c.expected.error === "missing value where TRUE/FALSE needed" || one(a.cases1) || one(a.cases2)) {
      return { expected: { error: "one" }, reason: "one case or one control is an error (pROC: an R error or NaN)" };
    }
    if (a.methodMissing === true) {
      return { expected: { error: "level" }, reason: "a level outside [0, 1] is an error also without 'method' (pROC: NaN limits)" };
    }
    if (c.expected.statistic === "NaN") {
      const alt = arg.str(a.alternative) ?? "two.sided";
      return {
        expected: { ...c.expected, statistic: "0", pValue: alt === "two.sided" ? "1" : "0.5" },
        reason: "unpaired curves with both variances 0 and equal AUCs: D = 0, p = 1 (pROC: NaN)",
      };
    }
    return undefined;
  },
});

describe("rocTest", () => {
  const y = [0, 0, 0, 0, 1, 1, 1, 1, 0, 1];
  const x1 = [1, 2, 3, 5, 4, 6, 7, 8, 2.5, 3.5];
  const x2 = [2, 1, 5, 4, 3, 7, 6, 8, 4, 2];

  it("takes a response and two predictors, dropping missing values from both", () => {
    const t = rocTest(y, x1, x2);
    const u = rocTest(roc(y, x1), roc(y, x2));
    expect(t.statistic).toBe(u.statistic);
    expect(t.confInt).toEqual(u.confInt);
    const p2 = [...x2];
    p2[2] = NaN;
    const keep = y.map((_, i) => i).filter((i) => i !== 2);
    const v = rocTest(y, x1, p2);
    const w = rocTest(keep.map((i) => y[i]!), keep.map((i) => x1[i]!), keep.map((i) => x2[i]!));
    expect(v.statistic).toBe(w.statistic);
    // the same pairing from two curves built apart: rebuilt on the observations where neither predictor is missing
    const z = rocTest(roc(y, x1), roc(y, p2));
    expect(z.method).toBe("DeLong's test for two correlated ROC curves");
    expect(z.statistic).toBe(w.statistic);
    expect(z.roc1.controls.length + z.roc1.cases.length).toBe(9);
  });

  it("does not pair curves from controls and cases", () => {
    const a = roc({ controls: [1, 2, 3], cases: [3, 4, 5] });
    const b = roc({ controls: [1, 3, 2], cases: [5, 4, 2] });
    expect(rocTest(a, b).method).toBe("DeLong's test for two ROC curves");
    expect(() => rocTest(a, b, { paired: true })).toThrow(RangeError);
  });

  it("does not depend on the scale of the predictors (powers of 2 up to 2^±1000)", () => {
    const ref = rocTest(y, x1, x2);
    for (const k of [-1000, -500, 500, 1000]) {
      const s = 2 ** k;
      const t = rocTest(y, x1.map((v) => v * s), x2.map((v) => v * s));
      expect(t.statistic).toBe(ref.statistic);
      expect(t.pValue).toBe(ref.pValue);
      expect(t.confInt).toEqual(ref.confInt);
    }
  });

  it("rejects input without a defined test", () => {
    expect(() => rocTest(y, x1, x2, { confLevel: 1.5 })).toThrow(RangeError);
    expect(() => rocTest(y, x1, x2, { method: "venkatraman" })).toThrow(RangeError);
    expect(() => rocTest(y, x1, x2.slice(1))).toThrow(TypeError);
    expect(() => rocTest(roc(y, x1), roc(y, x2), { direction: "<" })).toThrow(RangeError);
    // @ts-expect-error unknown option
    expect(() => rocTest(y, x1, x2, { conf: 0.9 })).toThrow(RangeError);
  });
});

// ---- bootstrap ----

htestSuite({
  name: "ciAucBoot",
  call: (a) => {
    const r = makeRoc(a);
    const o = options(a);
    setSeed(arg.num(a.seed)!);
    const ci = ciAuc(r, { ...o, method: "bootstrap" });
    const next = runif(1)[0]!;
    return { ci: ci.confInt, next, warnings: ci.warnings };
  },
  // the same draws as R; the AUCs of the resamples are U/(mn) (pROC's trapezoids differ by an ulp)
  tolerance: 1e-13,
  substitute: (c) => {
    const a = c.args;
    if (typeof a.cases === "string" && a.bootStratified !== false) {
      return { expected: { error: "one" }, reason: "a stratified bootstrap with one case is an error (pROC resamples 1:x for a single value x >= 1)" };
    }
    if (c.expected.error !== undefined) {
      return {
        expected: {
          warnings: [
            ...(makeRoc(a).auc === 1 ? ["ci.auc() of a ROC curve with AUC == 1 is always 1-1 and can be misleading."] : []),
            "NA value(s) produced during bootstrap were ignored.",
          ],
        },
        reason: "a non-stratified resample without controls is dropped with the warning (pROC: an R error)",
      };
    }
    const ci = c.expected.ci as string[];
    return { expected: { ...c.expected, ci: [ci[0]!, ci[2]!] }, reason: "the median of the bootstrap AUCs is not returned" };
  },
});

htestSuite({
  name: "rocTestBoot",
  call: (a) => {
    const [r1, r2] = curves(a);
    setSeed(arg.num(a.seed)!);
    const t = rocTest(r1, r2, options(a));
    const next = runif(1)[0]!;
    return {
      ...t,
      parameter: [t.parameter, t.bootStratified ? 1 : 0],
      parameterName: [t.parameterName, "boot.stratified"],
      next,
    };
  },
  tolerance: 1e-13,
  substitute: (c) =>
    strOrNull(c.args.method) === "venkatraman"
      ? { expected: { error: "venkatraman" }, reason: "Venkatraman's test is not implemented (rStats.js's choice)" }
      : undefined,
});

describe("bootstrap", () => {
  it("gives the bootstrap variance and keeps the AUC as the estimate", () => {
    const r = roc({ controls: [1, 2, 2, 3, 5, 7], cases: [2, 4, 5, 5, 8, 9, 10] });
    setSeed(1);
    const ci = ciAuc(r, { method: "boot", bootN: 50 });
    expect(ci.method).toBe("bootstrap");
    expect(ci.estimate).toBe(r.auc);
    expect(ci.variance).toBeGreaterThan(0);
    expect(() => ciAuc(r, { method: "bootstrap", bootN: 0 })).toThrow(RangeError);
    expect(() => ciAuc(r, { method: "bootstrap", bootN: 2.5 })).toThrow(RangeError);
  });

  it("drops non-stratified resamples without controls", () => {
    // two controls among eight: some of 300 resamples have none
    const r = roc([0, 1, 1, 1, 1, 1, 1, 0], [1, 2, 3, 4, 5, 6, 3.5, 2]);
    setSeed(3);
    const ci = ciAuc(r, { method: "bootstrap", bootN: 300, bootStratified: false });
    expect(ci.warnings).toEqual(["NA value(s) produced during bootstrap were ignored."]);
    expect(Number.isFinite(ci.confInt[0])).toBe(true);
  });
});

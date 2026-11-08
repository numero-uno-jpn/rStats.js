import { describe, expect, it } from "vitest";
import { auc, ciAuc, coords, roc, type CoordsResult } from "../src/index.js";
import { arg, htestSuite, loadHTestFixture, type HTestCase } from "./helpers/htest.js";
import { makeRoc, strOrNull, vecNA } from "./helpers/roc.js";

// ---- roc ----

htestSuite({
  name: "roc",
  call: (a) => makeRoc(a),
  // the curve is exact (counts divided once); the AUC is U/(mn) rounded once, pROC's trapezoid sum an ulp or two off
  tolerance: 1e-13,
  substitute: (c) => {
    if (c.expected.value !== undefined) {
      return {
        expected: { error: "undefined" },
        reason: "an infinite predictor value and missing values with naRm false are errors (pROC: NaN or NA)",
      };
    }
    if (c.expected.error !== undefined) return undefined;
    const { direction: _d, levels: _l, ...rest } = c.expected;
    return { expected: rest, reason: "direction and levels compared exactly below" };
  },
});

describe("roc", () => {
  it("chooses pROC's direction and levels", () => {
    let n = 0;
    for (const c of loadHTestFixture("roc").cases) {
      if (c.expected.direction === undefined) continue;
      const r = makeRoc(c.args);
      expect(r.direction).toBe(c.expected.direction);
      expect(r.levels).toEqual(c.expected.levels);
      n++;
    }
    expect(n).toBe(100);
  });

  it("takes a formula and a data frame", () => {
    const data = { y: ["neg", "pos", "pos", null, "neg"], x: [1, 4, 3, 2, NaN] };
    const r = roc("y ~ x", data);
    expect(r.levels).toEqual(["neg", "pos"]);
    expect(r.controls).toEqual([1]);
    expect(r.cases).toEqual([4, 3]);
    expect(r.auc).toBe(1);
    const b = roc("y ~ x", { y: [true, false, true, false], x: [3, 1, 4, 2] });
    expect(b.levels).toEqual(["FALSE", "TRUE"]);
    expect(b.auc).toBe(1);
    expect(() => roc("y ~ x + z", { y: [0, 1], x: [1, 2], z: [1, 2] })).toThrow(TypeError);
  });

  it("orders booleans false first and strings by code point", () => {
    expect(roc([true, false, true, false], [3, 1, 4, 2]).levels).toEqual(["FALSE", "TRUE"]);
    expect(roc(["b", "B", "b", "B"], [3, 1, 4, 2]).levels).toEqual(["B", "b"]);
    expect(roc([10, 2, 10, 2], [3, 1, 4, 2]).levels).toEqual(["2", "10"]);
  });

  it("rejects input without a curve", () => {
    expect(() => roc([0, 1, 0, 1], [1, Infinity, 3, 4])).toThrow(RangeError);
    expect(() => roc([0, 1, NaN, 1], [1, 2, 3, 4], { naRm: false })).toThrow(RangeError);
    expect(() => roc({ controls: [1, 2], cases: [] })).toThrow(Error);
    expect(() => roc({ controls: [1, 2], cases: [3] }, { levels: [0, 1] })).toThrow(RangeError);
    expect(() => roc([0, 1], [1, 2], { direction: "x" as "<" })).toThrow(RangeError);
    // @ts-expect-error unknown option
    expect(() => roc([0, 1], [1, 2], { dir: "<" })).toThrow(RangeError);
    // @ts-expect-error unknown key of the samples
    expect(() => roc({ controls: [1], cases: [2], case: [3] })).toThrow(RangeError);
  });

  it("does not depend on the scale of the predictor (powers of 2 up to 2^±1000)", () => {
    const controls = [1, 2, 2, 3, 5, 7];
    const cases = [2, 4, 5, 5, 8, 9, 10];
    const ref = roc({ controls, cases });
    const refCi = ciAuc(ref);
    const refCoords = coords(ref, "best");
    for (const k of [-1000, -500, 500, 1000]) {
      const s = 2 ** k;
      const r = roc({ controls: controls.map((v) => v * s), cases: cases.map((v) => v * s) });
      expect(r.thresholds).toEqual(ref.thresholds.map((t) => t * s));
      expect(r.sensitivities).toEqual(ref.sensitivities);
      expect(r.specificities).toEqual(ref.specificities);
      expect(r.auc).toBe(ref.auc);
      const ci = ciAuc(r);
      expect(ci.confInt).toEqual(refCi.confInt);
      expect(ci.variance).toBe(refCi.variance);
      const co = coords(r, "best");
      expect(co.threshold).toEqual(refCoords.threshold.map((t) => t * s));
      expect(co.youden).toEqual(refCoords.youden);
    }
  });
});

// ---- auc (partial AUC) ----

htestSuite({
  name: "rocAuc",
  call: (a) => {
    const r = makeRoc(a);
    const options: Record<string, unknown> = {};
    if (a.partialAuc !== undefined) options.partialAuc = vecNA(a.partialAuc);
    if (a.partialAucFocus !== undefined) options.focus = arg.str(a.partialAucFocus);
    if (a.partialAucCorrect !== undefined) options.correct = arg.bool(a.partialAucCorrect);
    return auc(r, options);
  },
  // a sum of a few trapezoids and one interpolation (pROC's order of the sums may differ)
  tolerance: 1e-13,
  substitute: (c) => {
    if (c.expected.warnings?.length) {
      return { expected: { error: "below" }, reason: "McClish's correction below the diagonal is an error (pROC: NA with a warning)" };
    }
    if (c.expected.auc === "NA") return { expected: { error: "range" }, reason: "limits outside [0, 1] are an error (pROC: NA)" };
    return undefined;
  },
});

describe("auc", () => {
  it("gives the full AUC for the limits 0 and 1 and checks its options", () => {
    const r = roc({ controls: [1, 2, 2, 3, 5, 7], cases: [2, 4, 5, 5, 8, 9, 10] });
    expect(auc(r, { partialAuc: [0, 1] }).auc).toBeCloseTo(r.auc, 15);
    expect(auc(r, { partialAuc: [0, 1], focus: "sens" }).auc).toBeCloseTo(r.auc, 15);
    expect(auc(r, { partialAuc: [0, 1], correct: true }).auc).toBeCloseTo(r.auc, 15);
    expect(auc(r, { partialAuc: [0.8, 1] }).partialAuc).toEqual([1, 0.8]);
    expect(() => auc(r, { partialAuc: [0.8] })).toThrow(TypeError);
    expect(() => auc(r, { partialAuc: [0.8, 1.2] })).toThrow(RangeError);
    expect(() => auc(r, { partialAuc: [0.8, 0.8] })).toThrow(RangeError);
    expect(() => auc(r, { focus: "x" })).toThrow(RangeError);
  });
});

// ---- ciAuc (DeLong) ----

const VAR_WARNING = "var() of a ROC curve with AUC == 1 is always 0 and can be misleading.";

htestSuite({
  name: "ciAuc",
  call: (a) => {
    const r = makeRoc(a);
    const options: Record<string, unknown> = {};
    if (a.confLevel !== undefined) options.confLevel = arg.num(a.confLevel);
    if (a.method !== undefined) options.method = arg.str(a.method);
    const ci = ciAuc(r, options);
    return { ci: [ci.confInt[0], ci.estimate, ci.confInt[1]], var: ci.variance, auc: r.auc, warnings: ci.warnings };
  },
  // AUC, theta and S to a few ulps (oracle/roc-behaviour.md, section 3); the limits are theta -+ z sqrt(S)
  tolerance: 1e-13,
  substitute: (c) => {
    if (Array.isArray(c.expected.ci) && c.expected.ci[0] === "NA") {
      return { expected: { error: "one" }, reason: "one case or one control is an error (pROC: NA)" };
    }
    const w = c.expected.warnings as string[] | undefined;
    if (w?.includes(VAR_WARNING)) {
      return { expected: { ...c.expected, warnings: w.filter((m) => m !== VAR_WARNING) }, reason: "var()'s warning belongs to a call of its own in R" };
    }
    return undefined;
  },
});

describe("ciAuc", () => {
  it("returns theta, the clipped interval and DeLong's variance", () => {
    const r = roc({ controls: [1, 2, 2, 3, 5, 7], cases: [2, 4, 5, 5, 8, 9, 10] });
    const ci = ciAuc(r, { confLevel: 0.9 });
    expect(ci.method).toBe("delong");
    expect(ci.confLevel).toBe(0.9);
    expect(ci.confInt[1]).toBe(1);
    expect(ci.estimate).toBe(r.auc);
    expect(() => ciAuc(r, { confLevel: 1.1 })).toThrow(RangeError);
    expect(() => ciAuc(r, { method: "foo" })).toThrow(RangeError);
    expect(() => ciAuc(roc({ controls: [1, 2, 3], cases: [2.5] }))).toThrow(Error);
    // @ts-expect-error unknown option
    expect(() => ciAuc(r, { conf: 0.9 })).toThrow(RangeError);
  });

  it("gives [theta, theta] when the variance is 0", () => {
    const r = roc({ controls: [1, 1, 1], cases: [1, 1] });
    const ci = ciAuc(r, { confLevel: 0.99 });
    expect(ci.confInt).toEqual([0.5, 0.5]);
    expect(ci.variance).toBe(0);
    // at level 1, R's qnorm gives -Inf and Inf before it looks at the sd
    expect(ciAuc(r, { confLevel: 1 }).confInt).toEqual([0, 1]);
  });
});

// ---- coords ----

const COLUMN: Record<string, keyof CoordsResult> = { lr_pos: "lrPos", lr_neg: "lrNeg", "closest.topleft": "closestTopleft" };

function coordsCall(a: HTestCase["args"]): object {
  const r = makeRoc(a);
  const x = typeof a.x === "string" && Number.isNaN(Number(a.x)) && a.x !== "NaN" ? a.x : vecNA(a.x)!;
  const options: Record<string, unknown> = {};
  if (a.bestMethod !== undefined) options.bestMethod = strOrNull(a.bestMethod);
  if (a.bestWeights !== undefined) options.bestWeights = vecNA(a.bestWeights);
  const co = coords(r, x, options);
  const out: Record<string, unknown> = {};
  for (const name of ["threshold", "sensitivity", "specificity", "accuracy", "tn", "tp", "fn", "fp", "npv", "ppv", "fpr", "lr_pos", "lr_neg", "youden", "closest.topleft", "warnings"]) {
    out[name] = co[COLUMN[name] ?? (name as keyof CoordsResult)];
  }
  return out;
}

htestSuite({
  name: "rocCoords",
  call: coordsCall,
  // every column from the integer counts, rounded once or twice (youden and closest.topleft: a sum)
  tolerance: 1e-13,
  substitute: (c) => {
    const w = vecNA(c.args.bestWeights);
    if (w !== undefined && w.length === 2 && w[1]! > 0 && w[1]! < 1 && !(w[0]! > 0)) {
      return { expected: { error: "cost" }, reason: "a cost (bestWeights[0]) that is not positive is an error (pROC: not checked)" };
    }
    const kind = c.reference?.refKind;
    if (kind === "ties" || (Array.isArray(kind) && (kind as string[]).includes("ties"))) {
      const { refKind: _k, ...ref } = c.reference!;
      return { expected: { ...ref, warnings: [] }, reason: "all rows tied for the best criterion (pROC loses ties to rounding): the reference" };
    }
    return undefined;
  },
});

describe("coords", () => {
  it("counts a value equal to the threshold as positive and gives all points by default", () => {
    const r = roc({ controls: [1, 2, 2, 3, 5, 7], cases: [2, 4, 5, 5, 8, 9, 10] });
    expect(coords(r).threshold).toEqual(r.thresholds);
    expect(coords(r).sensitivity).toEqual(r.sensitivities);
    expect(coords(r, 5).tp).toEqual([5]);
    expect(coords(r, [Infinity, -Infinity]).tp).toEqual([0, 7]);
    const g = roc({ controls: [1, 2, 2, 3, 5, 7], cases: [2, 4, 5, 5, 8, 9, 10] }, { direction: ">" });
    expect(coords(g, 5).tp).toEqual([4]);
    expect(coords(g, 5).tn).toEqual([1]);
    expect(() => coords(r, [])).toThrow(RangeError);
    expect(() => coords(r, [NaN])).toThrow(RangeError);
    expect(() => coords(r, "x")).toThrow(RangeError);
    expect(() => coords(r, "best", { bestWeights: [1] })).toThrow(TypeError);
    expect(() => coords(r, "best", { bestWeights: [1, 1] })).toThrow(RangeError);
    expect(() => coords(r, "best", { bestWeights: [0, 0.5] })).toThrow(RangeError);
  });

  it("returns every row tied exactly for the best criterion", () => {
    // pROC returns only 11 here; 11 and 12.5 both have se + sp = 4/3 (oracle/roc-behaviour.md, Easy to get wrong 5)
    const r = roc({ controls: [7, 10, 12, 6, 10, 6], cases: [5, 2, 3, 1, 12, 14, 12, 14, 3, 14, 8, 13] });
    expect(coords(r, "best").threshold).toEqual([11, 12.5]);
  });
});

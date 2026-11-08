import { describe, expect, it } from "vitest";
import { binomCI, diagnosticTests, type DiagnosticMeasure } from "../src/index.js";
import { arg, htestSuite, type HTestCase } from "./helpers/htest.js";

/** epiR's rows that diagnosticTests returns, by epiR's names */
const ROWS: Record<string, string> = {
  ap: "apparentPrevalence",
  tp: "prevalence",
  se: "sensitivity",
  sp: "specificity",
  "diag.ac": "accuracy",
  "diag.or": "diagnosticOR",
  "pv.pos": "ppv",
  "pv.neg": "npv",
  "lr.pos": "lrPos",
  "lr.neg": "lrNeg",
};

function call(a: HTestCase["args"]): object {
  const method = arg.str(a.method);
  const options: Record<string, unknown> = {};
  // epiR's "clopper-pearson" is its "exact" computed directly: one method here
  if (method !== undefined) options.method = method === "clopper-pearson" ? "exact" : method;
  if (a.confLevel !== undefined) options.confLevel = arg.num(a.confLevel);
  const r = diagnosticTests(arg.mat(a.table)!, options) as unknown as Record<string, DiagnosticMeasure>;
  const out: Record<string, unknown> = { warnings: (r as unknown as { warnings: string[] }).warnings };
  for (const [name, field] of Object.entries(ROWS)) out[name] = [r[field]!.estimate, ...r[field]!.confInt];
  return out;
}

/** The counts x of the proportion rows, of n, for the ends of Jeffreys' interval */
function proportionCounts(a: HTestCase["args"]): Record<string, [number, number]> {
  const [[A, B], [C, D]] = arg.mat(a.table)! as [[number, number], [number, number]];
  const T = A + B + C + D;
  return { ap: [A + B, T], tp: [A + C, T], se: [A, A + C], sp: [D, B + D], "diag.ac": [A + D, T], "pv.pos": [A, A + B], "pv.neg": [D, C + D] };
}

htestSuite({
  name: "epiTests",
  call,
  // qbeta and qnorm closed forms; the LRs and the odds ratio from the counts (epiR's 1 - d/M0 differs by an ulp)
  tolerance: 1e-13,
  substitute: (c, cases) => {
    const a = c.args;
    const method = arg.str(a.method);
    const level = arg.num(a.confLevel);
    const t = arg.mat(a.table)!.flat();
    const { nndx: _n, youden: _y, "p.rout": _1, "p.rin": _2, "p.tpdn": _3, "p.tndp": _4, "p.dntp": _5, "p.dptn": _6, ...rest } = c.expected;
    if (method === "agresti") return { expected: { error: "method" }, reason: "epiR's 'agresti' (adjusted estimates) is not offered" };
    if (level !== undefined && !(level > 0 && level < 1)) return { expected: { error: "level" }, reason: "a level outside (0, 1) is an error (epiR: NaN or [0, 1])" };
    if (t.some((v) => !Number.isInteger(v))) return { expected: { error: "counts" }, reason: "non-integer counts are an error (epiR: used)" };
    if (t[0]! + t[1]! === 0 || t[2]! + t[3]! === 0 || t[0]! + t[2]! === 0 || t[1]! + t[3]! === 0) {
      return { expected: { error: "margin" }, reason: "a zero row or column total is an error (epiR: NaN)" };
    }
    if (method === "exa") {
      const exact = cases.find((d) => arg.str(d.args.method) === "exact" && JSON.stringify(d.args.table) === JSON.stringify(a.table) && d.args.confLevel === undefined)!;
      const { nndx: _a, youden: _b, "p.rout": _c, "p.rin": _d, "p.tpdn": _e, "p.tndp": _f, "p.dntp": _g, "p.dptn": _h, ...ex } = exact.expected;
      return { expected: ex, reason: "abbreviations of the method are accepted (epiR: an error)" };
    }
    if (c.expected.error !== undefined) return undefined;
    return { expected: rest, reason: "Youden's index, the NND and epiR's p.* rows are not returned" };
  },
  // Jeffreys' interval as binomCI's: 0 at x = 0 and 1 at x = n (Brown, Cai and DasGupta's modification); epiR the
  // beta quantiles there
  knownDifference: (a, field, e, v) => {
    const [[, B], [, D]] = arg.mat(a.table)! as [[number, number], [number, number]];
    // epiR's 1 - d/M0 keeps 6 fewer digits at b/M0 = 5e-6; here b/M0 (the estimate is exact, checked below)
    if (field === "lr.pos" && B / (B + D) < 1e-4 && Math.abs(v - e) <= 1e-10 * Math.abs(e)) {
      return "LR+ from b/M0 where epiR's 1 - sp cancels";
    }
    // Wilson's lower limit at x = 0 is exactly 0 (binomCI); epiR's formula rounds to -2.8e-17
    if (arg.str(a.method) === "wilson" && v === 0 && Math.abs(e) < 1e-16) return "Wilson's limit exactly 0 at x = 0 (epiR: -2.8e-17)";
    if (arg.str(a.method) !== "jeffreys") return undefined;
    const xn = proportionCounts(a)[field];
    if (xn === undefined) return undefined;
    return (xn[0] === 0 && v === 0) || (xn[0] === xn[1] && v === 1) ? "Jeffreys' limit 0 at x = 0 and 1 at x = n, as binomCI (epiR: the beta quantile)" : undefined;
  },
});

describe("diagnosticTests", () => {
  const table = [
    [670, 202],
    [74, 640],
  ];

  it("gives the proportions as binomCI and the ratios from the counts", () => {
    const r = diagnosticTests(table, { method: "wilson", confLevel: 0.9 });
    expect(r.sensitivity).toEqual({ estimate: 670 / 744, confInt: binomCI(670, 744, { confLevel: 0.9 }).confInt });
    expect(r.method).toBe("wilson");
    expect(r.diagnosticOR.estimate).toBe((670 * 640) / (202 * 74));
    expect(r.ppvAtPrevalence).toBeUndefined();
  });

  it("gives the predictive values at a prevalence by Bayes' theorem", () => {
    const se = 670 / 744;
    const sp = 640 / 842;
    for (const p of [0.001, 0.1, 0.5, 0.9]) {
      const r = diagnosticTests(table, { prevalence: p });
      expect(r.ppvAtPrevalence).toBeCloseTo((se * p) / (se * p + (1 - sp) * (1 - p)), 14);
      expect(r.npvAtPrevalence).toBeCloseTo((sp * (1 - p)) / (sp * (1 - p) + (1 - se) * p), 14);
    }
    // the prevalence of the table gives its own predictive values
    const r = diagnosticTests(table, { prevalence: 744 / 1586 });
    expect(r.ppvAtPrevalence! / r.ppv.estimate - 1).toBeLessThan(4e-16);
    expect(r.npvAtPrevalence! / r.npv.estimate - 1).toBeLessThan(4e-16);
  });

  it("computes LR+ without the cancellation of 1 - sp", () => {
    // epiR: 180000.89999939842; exactly 0.9 / (10 / 2000010) = 180000.9
    expect(diagnosticTests([[900000, 10], [100000, 2000000]]).lrPos.estimate).toBe((900000 * 2000010) / (1000000 * 10));
  });

  it("rounds LR+ once, as LR-", () => {
    // (a M0)/(M1 b) = 5/3; se / (b / M0) rounded three times gave 1.6666666666666665
    expect(diagnosticTests([[1, 1], [2, 4]]).lrPos.estimate).toBe(5 / 3);
    expect(diagnosticTests([[1, 1], [2, 9]]).lrPos.estimate).toBe(10 / 3);
    // a zero cell: b = 0 gives Inf, and a = 0 gives 0
    expect(diagnosticTests([[0, 1], [2, 4]]).lrPos.estimate).toBe(0);
  });

  it("gives infinite ratios and NaN limits for zero cells, as epiR", () => {
    const r = diagnosticTests([
      [10, 0],
      [3, 20],
    ]);
    expect(r.lrPos.estimate).toBe(Infinity);
    expect(r.lrPos.confInt[0]).toBeNaN();
    expect(r.diagnosticOR.estimate).toBe(Infinity);
  });

  it("rejects input without a defined result", () => {
    expect(() => diagnosticTests([[1, 2], [3]])).toThrow(TypeError);
    expect(() => diagnosticTests([[1, 2], [3, 2.5]])).toThrow(RangeError);
    expect(() => diagnosticTests([[0, 0], [3, 4]])).toThrow(RangeError);
    expect(() => diagnosticTests(table, { confLevel: 1 })).toThrow(RangeError);
    expect(() => diagnosticTests(table, { method: "agresti" })).toThrow(RangeError);
    expect(() => diagnosticTests(table, { prevalence: 1 })).toThrow(RangeError);
    // @ts-expect-error unknown option
    expect(() => diagnosticTests(table, { conf: 0.9 })).toThrow(RangeError);
  });

  it("does not depend on the scale of the counts (powers of 2)", () => {
    const ref = diagnosticTests(table);
    for (const k of [10, 20, 30]) {
      const s = 2 ** k;
      const r = diagnosticTests(table.map((row) => row.map((v) => v * s)));
      for (const f of ["sensitivity", "specificity", "ppv", "npv", "accuracy", "prevalence", "apparentPrevalence", "lrPos", "lrNeg", "diagnosticOR"] as const) {
        expect(r[f].estimate).toBe(ref[f].estimate);
      }
    }
  });
});

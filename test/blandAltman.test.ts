import { describe, expect, it } from "vitest";
import { blandAltman, pt, type BlandAltmanResult } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { arg, loadHTestFixture, type HTestCase } from "./helpers/htest.js";
import { expectScaleInvariant } from "./helpers/scaleInvariance.js";

const fixture = loadHTestFixture("blandAltman");

type Named = Record<string, string>;

function run(a: HTestCase["args"], ciMethod: "package" | "exact", scale = 1): BlandAltmanResult {
  const x = arg.vec(a.x)!.map((v) => v * scale);
  const y = arg.vec(a.y)!.map((v) => v * scale);
  const mode = arg.num(a.mode);
  const two = arg.num(a.two);
  const confLevel = arg.num(a.confInt);
  return blandAltman(x, y, {
    ciMethod,
    ...(mode === undefined ? {} : { mode: mode as 1 | 2 }),
    ...(two === undefined ? {} : { two }),
    ...(confLevel === undefined ? {} : { confLevel }),
  });
}

/** The package's fields from a result (CI.lines in the package's order) */
function packageFields(r: BlandAltmanResult): Record<string, number[]> {
  return {
    basedOn: [r.n],
    means: r.means,
    diffs: r.diffs,
    lines: [r.lowerLimit, r.meanDiff, r.upperLimit],
    "CI.lines": [...r.lowerLimitConfInt, ...r.meanDiffConfInt, ...r.upperLimitConfInt],
    "critical.diff": [r.criticalDiff],
    two: [r.two],
  };
}

const LINES = ["lower.limit", "mean.diffs", "upper.limit"];
const CI_LINES = [
  "lower.limit.ci.lower",
  "lower.limit.ci.upper",
  "mean.diff.ci.lower",
  "mean.diff.ci.upper",
  "upper.limit.ci.lower",
  "upper.limit.ci.upper",
];
const EXACT = ["lower.limit.ci.lower", "lower.limit.ci.upper", "upper.limit.ci.lower", "upper.limit.ci.upper"];

/** The expected fields of a case as arrays of numbers (the package's named vectors in their order) */
function expectedFields(e: Record<string, unknown>): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === "warnings" || k === "refKind" || k === "exact") continue;
    if (k === "lines") out[k] = LINES.map((n) => num((v as Named)[n]));
    else if (k === "CI.lines") out[k] = CI_LINES.map((n) => num((v as Named)[n]));
    else out[k] = (Array.isArray(v) ? v : [v]).map((s) => num(s as string));
  }
  return out;
}

/**
 * Cases where R gives NA or NaN for input without a defined result (design rule 1, choice 1): fewer than 2 complete
 * pairs, infinite data, a level outside [0, 1]
 */
function expectsError(c: HTestCase): string | undefined {
  if (c.expected.error !== undefined) return "R's error";
  const x = arg.vec(c.args.x)!;
  const y = arg.vec(c.args.y)!;
  const complete = x.filter((v, i) => !Number.isNaN(v) && !Number.isNaN(y[i]!)).length;
  if (complete < 2) return "fewer than 2 complete pairs (R: NA limits with a warning)";
  if ([...x, ...y].some((v) => v === Infinity || v === -Infinity)) return "infinite data (R: NaN)";
  const level = arg.num(c.args.confInt);
  if (level !== undefined && !(level >= 0 && level <= 1)) return "a level outside [0, 1] (R: NaN or reversed limits)";
  return undefined;
}

/**
 * The error of a value: relative to max(|expected|, the critical difference), as the limits and intervals are
 * differences of terms of the size of the standard deviation (a limit near 0 keeps the absolute error of its terms)
 */
function errorOf(actual: number, expected: number, floor: number): number {
  if (Number.isNaN(expected) || Number.isNaN(actual)) return Number.isNaN(expected) && Number.isNaN(actual) ? 0 : Infinity;
  if (actual === expected) return 0;
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return Infinity;
  return Math.abs(actual - expected) / Math.max(Math.abs(expected), floor);
}

/**
 * The relative error of the tail probability of T(n - 1, two sqrt(n)) at an exact limit v (EXACT[i]) of the result r:
 * the limits are the quantiles (1 -+ confLevel)/2 (Carkeet 2015), those of the lower limit of agreement mirrored
 */
function exactRootError(r: BlandAltmanResult, i: number, v: number): number {
  const s = r.criticalDiff / r.two;
  const ncp = r.two * Math.sqrt(r.n);
  const q = ((v - r.meanDiff) / s) * Math.sqrt(r.n);
  // lower.limit.ci.lower, .upper, upper.limit.ci.lower, .upper: the upper tail at -q, the lower at -q, the lower at q,
  // the upper at q
  const p = pt(i < 2 ? -q : q, r.n - 1, { ncp, lowerTail: i === 1 || i === 2 });
  return Math.abs(p / ((1 - r.confLevel) / 2) - 1);
}

describe("blandAltman", () => {
  it(`matches BlandAltmanLeh (${fixture.r_version})`, () => {
    const failures: string[] = [];
    let errors = 0;
    let worst = 0;
    let worstExact = 0;
    const reasons = new Map<string, number>();
    fixture.cases.forEach((c, index) => {
      const why = expectsError(c);
      if (why !== undefined) {
        if (why !== "R's error") reasons.set(why, (reasons.get(why) ?? 0) + 1);
        expect(() => run(c.args, "package"), `#${index}`).toThrow();
        errors++;
        return;
      }
      const scale = arg.num(c.args.scale);
      const r = run(c.args, "package");
      const actual = packageFields(r);
      // where R's sd() over- or underflows, the reference (the unscaled data's results times the power of 2)
      const exp = expectedFields(c.reference ?? c.expected);
      const floor = Math.abs(r.criticalDiff);
      // Subnormal data (2^-1060): the reference was computed from the data before they were rounded to subnormal
      // numbers (relative 5e-6 for the data, up to 1e-4 for their differences); checked by scaling below
      const tol = scale === -1060 ? 1e-3 : 1e-14;
      if (scale === -1060) reasons.set("subnormal data compared with the unrounded data's results (1e-3)", 1);
      for (const [field, e] of Object.entries(exp)) {
        const a = actual[field]!;
        if (a.length !== e.length) {
          failures.push(`#${index} ${field}: length ${a.length} vs ${e.length}`);
          continue;
        }
        e.forEach((ev, i) => {
          const err = errorOf(a[i]!, ev, field === "means" || field === "diffs" ? 0 : floor);
          if (err > tol) failures.push(`#${index} ${field}[${i}]: R ${ev} / TS ${a[i]} (${err.toExponential(2)})`);
          else if (scale !== -1060) worst = Math.max(worst, err);
        });
      }
      const exact = c.expected.exact as unknown as Named | undefined;
      if (exact !== undefined) {
        const re = run(c.args, "exact");
        const a = [...re.lowerLimitConfInt, ...re.upperLimitConfInt];
        // R's qt(p, df, ncp) is accurate to about 1e-11 here, but to only 1e-7 at the level 0.999999: where the values
        // differ by more, rStats.js's must be the closer root of the noncentral t (relative error of the tail)
        EXACT.forEach((name, i) => {
          const ev = num(exact[name]);
          const err = errorOf(a[i]!, ev, floor);
          if (err <= (scale === -1060 ? 1e-3 : 2e-11)) {
            if (scale !== -1060) worstExact = Math.max(worstExact, err);
            return;
          }
          const mine = exactRootError(re, i, a[i]!);
          if (mine < 1e-9 && mine < exactRootError(re, i, ev)) {
            reasons.set("exact limits: R's qt(p, df, ncp) is less accurate (rStats.js's limits are the closer roots)", 1);
            return;
          }
          failures.push(`#${index} exact ${name}: R ${ev} / TS ${a[i]} (${err.toExponential(2)})`);
        });
      }
    });
    console.log(
      `blandAltman: ${fixture.cases.length} cases (${errors} errors), max error ${worst.toExponential(1)}, exact ${worstExact.toExponential(1)}\n` +
        [...reasons].map(([r, n]) => `  ${n}: ${r}`).join("\n"),
    );
    expect(failures, failures.slice(0, 20).join("\n")).toHaveLength(0);
  });

  it("gives the exact limits as the roots of the noncentral t (Carkeet 2015)", () => {
    const x = [10.1, 12.3, 9.8, 15.2, 11.1, 13.4, 14.8, 9.9, 12.0, 16.3];
    const y = [10.6, 12.0, 10.4, 15.9, 11.0, 14.1, 15.3, 10.3, 12.9, 16.8];
    for (const [confLevel, two] of [
      [0.95, 1.96],
      [0.9, 2],
      [0.999999, 3],
      [1 - 1e-12, 1.96],
    ] as const) {
      const r = blandAltman(x, y, { ciMethod: "exact", confLevel, two });
      const s = r.criticalDiff / two;
      const n = r.n;
      const tail = (1 - confLevel) / 2;
      const q = (v: number): number => ((v - r.meanDiff) / s) * Math.sqrt(n);
      const ncp = two * Math.sqrt(n);
      // the upper limit's interval at the lower and upper tail of T(n - 1, two sqrt(n)), and the lower limit mirrored
      const p1 = pt(q(r.upperLimitConfInt[0]), n - 1, { ncp });
      const p2 = pt(q(r.upperLimitConfInt[1]), n - 1, { ncp, lowerTail: false });
      const p3 = pt(-q(r.lowerLimitConfInt[1]), n - 1, { ncp });
      const p4 = pt(-q(r.lowerLimitConfInt[0]), n - 1, { ncp, lowerTail: false });
      for (const p of [p1, p2, p3, p4]) expect(Math.abs(p / tail - 1)).toBeLessThan(1e-9);
    }
  });

  it("does not depend on the units of the data", () => {
    const x = [10.1, 12.3, 9.8, 15.2, 11.1, 13.4, 14.8, 9.9, 12.0, 16.3];
    const y = [10.6, 12.0, 10.4, 15.9, 11.0, 14.1, 15.3, 10.3, 12.9, 16.8];
    for (const ciMethod of ["package", "exact"] as const) {
      expectScaleInvariant(
        `blandAltman ${ciMethod}`,
        (c) => blandAltman(x.map((v) => v * c), y.map((v) => v * c), { ciMethod }),
        {
          units: (r) => [r.meanDiff, r.lowerLimit, r.upperLimit, r.criticalDiff, ...r.meanDiffConfInt, ...r.lowerLimitConfInt, ...r.upperLimitConfInt],
        },
        1e-14,
      );
    }
    // powers of two beyond the range where R's sd over- or underflows: exactly the results times 2^e
    const base = blandAltman(x, y, { ciMethod: "exact" });
    for (const e of [-1060, -1000, -540, 540, 1000]) {
      const r = blandAltman(x.map((v) => v * 2 ** e), y.map((v) => v * 2 ** e), { ciMethod: "exact" });
      // (subnormal data are rounded when scaled down; compare the scaled data's own results there)
      if (e === -1060) {
        const xs = x.map((v) => v * 2 ** e);
        const ys = y.map((v) => v * 2 ** e);
        const up = blandAltman(xs.map((v) => v * 2 ** 530 * 2 ** 530), ys.map((v) => v * 2 ** 530 * 2 ** 530), { ciMethod: "exact" });
        expect(r.criticalDiff).toBe(up.criticalDiff * 2 ** -530 * 2 ** -530);
        continue;
      }
      const k = 2 ** e;
      expect(r.meanDiff).toBe(base.meanDiff * k);
      expect(r.criticalDiff).toBe(base.criticalDiff * k);
      expect(r.upperLimitConfInt).toEqual(base.upperLimitConfInt.map((v) => v * k));
      expect(r.lowerLimitConfInt).toEqual(base.lowerLimitConfInt.map((v) => v * k));
    }
  });

  it("drops incomplete pairs and returns the options in full", () => {
    const r = blandAltman([1, NaN, 3, 4], [1.5, 2, NaN, 4.6], { ciMethod: "ex", mode: 2, confLevel: 0.9 });
    expect(r.n).toBe(2);
    expect(r.diffs).toEqual([0.5, 4.6 - 4]);
    expect(r.ciMethod).toBe("exact");
    expect(r.mode).toBe(2);
    expect(r.confLevel).toBe(0.9);
    expect(r.warnings).toEqual([]);
  });

  it("gives points for identical methods, also at the level 1", () => {
    const x = [1, 2, 3, 4];
    for (const ciMethod of ["package", "exact"] as const) {
      const r = blandAltman(x, x.map((v) => v + 0.5), { ciMethod, confLevel: 1 });
      expect([...r.lowerLimitConfInt, ...r.meanDiffConfInt, ...r.upperLimitConfInt]).toEqual(Array(6).fill(-0.5));
    }
  });

  it("rejects input without a defined result", () => {
    expect(() => blandAltman([1, 2], [1])).toThrow(TypeError);
    expect(() => blandAltman([1, NaN], [1, 2])).toThrow(RangeError);
    expect(() => blandAltman([1, 2, Infinity], [1, 2, 3])).toThrow(RangeError);
    expect(() => blandAltman([1, 2, 3], [1, 2, 4], { two: 0 })).toThrow(RangeError);
    expect(() => blandAltman([1, 2, 3], [1, 2, 4], { two: Infinity })).toThrow(RangeError);
    // @ts-expect-error mode 3
    expect(() => blandAltman([1, 2, 3], [1, 2, 4], { mode: 3 })).toThrow(RangeError);
    expect(() => blandAltman([1, 2, 3], [1, 2, 4], { confLevel: 1.5 })).toThrow(RangeError);
    expect(() => blandAltman([1, 2, 3], [1, 2, 4], { ciMethod: "approx" })).toThrow(RangeError);
    // @ts-expect-error unknown option
    expect(() => blandAltman([1, 2, 3], [1, 2, 4], { conf: 0.9 })).toThrow(RangeError);
  });
});

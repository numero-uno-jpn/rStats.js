import { describe, expect, it } from "vitest";
import { mcreg, runif, setSeed, type McregOptions, type McregResult } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { arg, loadHTestFixture, type HTestCase } from "./helpers/htest.js";

const fixture = loadHTestFixture("mcreg");

function options(a: HTestCase["args"]): McregOptions {
  const alpha = arg.num(a.alpha);
  const o: McregOptions = {
    // mcr's defaults where the case leaves them out: PaBa with a bootstrap interval (rStats.js: analytical)
    methodCi: arg.str(a.methodCi) ?? "bootstrap",
  };
  const set = <K extends keyof McregOptions>(key: K, v: McregOptions[K] | undefined): void => {
    if (v !== undefined) o[key] = v;
  };
  set("methodReg", arg.str(a.methodReg));
  set("methodBootstrapCi", arg.str(a.methodBootstrapCi));
  set("errorRatio", arg.num(a.errorRatio));
  // mcr's alpha is 1 - confLevel
  set("confLevel", alpha === undefined ? undefined : 1 - alpha);
  set("slopeMeasure", arg.str(a.slopeMeasure));
  set("nsamples", arg.num(a.nsamples));
  set("nnested", arg.num(a.nnested));
  set("rngSeed", arg.num(a.rngSeed));
  set("iterMax", arg.num(a.iterMax));
  set("threshold", arg.num(a.threshold));
  set("naRm", arg.bool(a.naRm));
  return o;
}

const run = (a: HTestCase["args"]): McregResult => mcreg(arg.vec(a.x)!, arg.vec(a.y)!, options(a));

/** The fixture's fields from a result */
function fields(r: McregResult): Record<string, number[]> {
  const row = (c: McregResult["slope"]): number[] => [c.estimate, c.se, ...c.confInt];
  const out: Record<string, number[]> = { Intercept: row(r.intercept), Slope: row(r.slope), xmean: [r.xmean] };
  if (r.weights !== undefined) out.weight = r.weights;
  if (r.jackknife !== undefined) {
    out.B0jack = r.jackknife.intercept;
    out.B1jack = r.jackknife.slope;
  }
  if (r.bootstrap !== undefined) {
    const b = r.bootstrap;
    Object.assign(out, {
      B0: b.intercept,
      B1: b.slope,
      sigmaB0: b.sigmaIntercept,
      sigmaB1: b.sigmaSlope,
      "glob.sigma": b.globalSigma,
      nsamples: [b.nsamples],
    });
  }
  if (r.cusum !== undefined) Object.assign(out, { nPos: [r.cusum.nPos], nNeg: [r.cusum.nNeg], "max.cusum": [r.cusum.maxCusum] });
  return out;
}

type Raw = Record<string, unknown>;

/** The expected fields of a case (or of its reference) as arrays of numbers */
function expectedFields(e: Raw): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  const nums = (v: unknown): number[] => (Array.isArray(v) ? v : [v]).map((s) => num(s as string));
  for (const [key, v] of Object.entries(e)) {
    if (key === "warnings" || key === "refKind") continue;
    if (key === "para") {
      out.Intercept = nums((v as Raw).Intercept);
      out.Slope = nums((v as Raw).Slope);
    } else if (key === "cusum") {
      const c = v as Raw;
      out.nPos = nums(c.nPos);
      out.nNeg = nums(c.nNeg);
      out["max.cusum"] = nums(c["max.cusum"]);
    } else out[key] = nums(v);
  }
  return out;
}

/** Cases where rStats.js deliberately gives an error and mcr a result (design rule 1, choice 6) */
function expectsError(c: HTestCase): string | undefined {
  if (c.expected.error !== undefined && c.reference === undefined) return "mcr's error";
  if (arg.str(c.args.methodReg) === "PaBaLarge") return "PaBaLarge is not offered (choice 6)";
  const p = (c.reference?.para ?? c.expected.para) as unknown as Raw | undefined;
  if (p !== undefined && (p.Slope as string[])[0] === "NaN") return "a Deming covariance of 0 is an error (mcr: NaN)";
  return undefined;
}

/**
 * Tolerance 1e-13 (the counts of the CUSUM exactly): mcr's 1 - p²/(uq) in the analytical standard errors and its
 * jackknife pseudo-values n θ - (n - 1) θ_(i) cancel (up to 7e-14 off here; rStats.js forms (uq - p²)/(uq) in
 * double-double and (n - 1) sd(θ_(i))); Passing-Bablok's angles and tan are JavaScript's Math (not glibc's) and its
 * odd-position slopes dy/dx (mcr: tan(atan(dy/dx)), a few ulps off). The bootstrap values are the same resamples'
 */
const TOLERANCE = 1e-13;

/** Relative error, with a floor for values near 0 (the intercept and the limits are differences) */
function errorOf(actual: number, expected: number, floor: number): number {
  if (Number.isNaN(expected) || Number.isNaN(actual)) return Number.isNaN(expected) && Number.isNaN(actual) ? 0 : Infinity;
  if (actual === expected) return 0;
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return Infinity;
  return Math.abs(actual - expected) / Math.max(Math.abs(expected), floor);
}

describe("mcreg", () => {
  it(`matches mcr (${fixture.r_version})`, () => {
    const failures: string[] = [];
    const reasons = new Map<string, number>();
    const worst = new Map<string, number>();
    let errors = 0;
    let moreAccurate = 0;
    fixture.cases.forEach((c, index) => {
      const why = expectsError(c);
      if (why !== undefined) {
        if (why !== "mcr's error") reasons.set(why, (reasons.get(why) ?? 0) + 1);
        try {
          run(c.args);
          failures.push(`#${index}: no error (${why})`);
        } catch {
          errors++;
        }
        return;
      }
      let r: McregResult;
      try {
        r = run(c.args);
      } catch (e) {
        failures.push(`#${index}: ${String(e)}`);
        return;
      }
      const actual = fields(r);
      // where mcr fails (its check sd > 0 underflows), the reference only
      const failed = c.expected.error !== undefined;
      const exp = expectedFields((failed ? c.reference : c.expected) as unknown as Raw);
      const scale = arg.num(c.args.scale);
      if (scale !== undefined && exp.nPos !== undefined) {
        // the reference has no CUSUM; mcr's at 2^1020 comes from its overflowing intercept. Scale invariance: the
        // statistic of the unscaled data
        const u = fields(mcreg(arg.vec(c.args.x)!.map((v) => v * 2 ** -scale), arg.vec(c.args.y)!.map((v) => v * 2 ** -scale), options(c.args)));
        for (const f of ["nPos", "nNeg", "max.cusum"]) exp[f] = u[f]!;
        reasons.set("CUSUM of data scaled by 2^1020: that of the unscaled data (mcr's intercept overflows)", 1);
      }
      // a slope of exactly 1: mcr's tan(atan(1)) = 1 - 2^-53 can leave the residuals y - b0 - b x of the points on the
      // line positive where with dy/dx (choice 9) they are 0
      const slopeOne = arg.str(c.args.methodReg) === "PaBa" && exp.Slope![0] === 1 - 2 ** -53 && actual.Slope![0] === 1;
      const ref = c.reference === undefined || failed ? undefined : expectedFields(c.reference as unknown as Raw);
      // the scale of the intercept's values: its interval's width (R's values near 0 are differences of terms that size)
      const ic = actual.Intercept!;
      const floorOf = (field: string): number =>
        field === "Intercept" || field === "B0" || field === "B0jack" || field === "sigmaB0"
          ? Math.abs(ic[3]! - ic[2]!) || Math.abs(ic[0]!)
          : 0;
      let usedRef = false;
      for (const [field, e] of Object.entries(exp)) {
        const a = actual[field];
        if (a === undefined || a.length !== e.length) {
          failures.push(`#${index} ${field}: ${JSON.stringify(a)} vs ${e.length} values`);
          continue;
        }
        const tol = field === "nPos" || field === "nNeg" ? 0 : TOLERANCE;
        e.forEach((ev, i) => {
          const err = errorOf(a[i]!, ev, floorOf(field));
          if (err <= tol) {
            worst.set(field, Math.max(worst.get(field) ?? 0, err));
            return;
          }
          const rv = ref?.[field]?.[i];
          if (rv !== undefined && errorOf(a[i]!, rv, floorOf(field)) <= tol) {
            usedRef = true;
            return;
          }
          if (slopeOne && (field === "nPos" || field === "nNeg" || field === "max.cusum")) {
            reasons.set("CUSUM for a slope of exactly 1: residuals 0 where mcr's tan(atan(1)) leaves them positive (choice 9)", 1);
            return;
          }
          failures.push(`#${index} ${field}[${i}]: R ${ev} / TS ${a[i]} (${err.toExponential(2)})${rv === undefined ? "" : ` ref ${rv}`}`);
        });
      }
      if (usedRef) moreAccurate++;
      // R's warnings, and rStats.js's for an undefined Passing-Bablok interval (mcr gives none)
      const warn = [...((c.expected.warnings as string[] | undefined) ?? [])];
      if (r.intercept.confInt[0] === -Infinity && r.methodCi === "analytical") {
        warn.push("the Passing-Bablok interval is not defined for so few points: its limits are -Inf and Inf");
      }
      if (!failed && JSON.stringify(r.warnings) !== JSON.stringify(warn)) {
        failures.push(`#${index} warnings: ${JSON.stringify(warn)} / ${JSON.stringify(r.warnings)}`);
      }
    });
    console.log(
      `mcreg: ${fixture.cases.length} cases (${errors} errors), ${moreAccurate} closer to the reference than to R\n` +
        `  max error: ${[...worst].map(([f, v]) => `${f} ${v.toExponential(1)}`).join(", ")}\n` +
        [...reasons].map(([r, n]) => `  ${n}: ${r}`).join("\n"),
    );
    expect(failures, failures.slice(0, 30).join("\n")).toHaveLength(0);
  });

  it("iterates weighted Deming to the fixed point with threshold 0 (the reference 'converged')", () => {
    let checked = 0;
    for (const c of fixture.cases) {
      if (c.reference?.refKind !== "converged" || arg.str(c.args.methodCi) !== "jackknife") continue;
      const r = mcreg(arg.vec(c.args.x)!, arg.vec(c.args.y)!, { ...options(c.args), threshold: 0, iterMax: 1000 });
      const ref = expectedFields(c.reference as unknown as Raw);
      const got = fields(r);
      for (const f of ["Intercept", "Slope", "weight", "B0jack", "B1jack"]) {
        ref[f]!.forEach((v, i) => expect(Math.abs(got[f]![i]! - v), `${f}[${i}]`).toBeLessThanOrEqual(1e-12 * Math.max(Math.abs(v), 0.1)));
      }
      expect(r.warnings).toEqual(["no konvergence after 1000 iterations"]);
      checked++;
    }
    expect(checked).toBe(7);
  });

  it("does not depend on the units of the data", () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9.5, 11];
    const y = [1.1, 2.3, 2.9, 4.2, 4.8, 6.3, 6.8, 8.4, 9.1, 11.6];
    const cases: McregOptions[] = [
      { methodReg: "Deming" },
      { methodReg: "Deming", errorRatio: 1e-300 },
      { methodReg: "Deming", methodCi: "jackknife" },
      // (mcr's threshold is absolute, on the intercept in the units of the data: the number of iterations depends on
      // the units unless it is fixed)
      { methodReg: "WDeming", threshold: 0, iterMax: 40 },
      { methodReg: "PaBa" },
      { methodReg: "PaBa", slopeMeasure: "tangent" },
      { methodReg: "Deming", methodCi: "bootstrap", methodBootstrapCi: "tBoot", nsamples: 30, rngSeed: 3 },
      { methodReg: "PaBa", methodCi: "bootstrap", methodBootstrapCi: "BCa", nsamples: 30, rngSeed: 3 },
    ];
    for (const o of cases) {
      const base = mcreg(x, y, o);
      for (const e of [-1000, -540, -500, 500, 540, 1000]) {
        const f = (v: number): number => v * 2 ** (e / 2) * 2 ** (e / 2);
        const r = mcreg(x.map(f), y.map(f), o);
        const what = `${JSON.stringify(o)} at 2^${e}`;
        expect(r.slope, what).toEqual(base.slope);
        const ic = base.intercept;
        expect(r.intercept, what).toEqual({ estimate: f(ic.estimate), se: f(ic.se), confInt: ic.confInt.map(f) });
        expect(r.cusum, what).toEqual(base.cusum);
        expect(r.warnings, what).toEqual(base.warnings);
      }
    }
  });

  it("gives Deming's slope without cancellation for extreme error ratios", () => {
    // the root of λ p b² - (λq - u) b - p = 0 tends to p/u (least squares of y on x) as λ -> 0 and to q/p (of x on y)
    // as λ -> Infinity
    const x = [1, 2, 3, 4, 5, 6, 7];
    const y = [1.2, 1.9, 3.2, 3.8, 5.1, 6.4, 6.6];
    const mx = 4;
    const my = y.reduce((a, v) => a + v, 0) / 7;
    let u = 0;
    let q = 0;
    let p = 0;
    for (let i = 0; i < 7; i++) {
      u += (x[i]! - mx) ** 2;
      q += (y[i]! - my) ** 2;
      p += (x[i]! - mx) * (y[i]! - my);
    }
    expect(mcreg(x, y, { methodReg: "Deming", errorRatio: 1e-300 }).slope.estimate).toBeCloseTo(p / u, 14);
    expect(mcreg(x, y, { methodReg: "Deming", errorRatio: 1e300 }).slope.estimate).toBeCloseTo(q / p, 14);
  });

  it("warns where the Passing-Bablok interval is not defined", () => {
    const r = mcreg([1, 2, 3, 4], [1.1, 2.3, 2.9, 4.2]);
    expect(r.slope.confInt).toEqual([-Infinity, Infinity]);
    expect(r.intercept.confInt).toEqual([-Infinity, Infinity]);
    expect(r.warnings).toEqual(["the Passing-Bablok interval is not defined for so few points: its limits are -Inf and Inf"]);
  });

  it("returns the methods in full and the defaults of rStats.js", () => {
    const x = [1, 2, 3, 4, 5, 6, 7];
    const y = [1.2, 1.9, 3.2, 3.8, 5.1, 6.4, 6.6];
    const pb = mcreg(x, y);
    expect([pb.methodReg, pb.methodCi, pb.methodBootstrapCi, pb.errorRatio]).toEqual(["PaBa", "analytical", undefined, 1]);
    expect(Number.isNaN(pb.xmean) && Number.isNaN(pb.slope.se)).toBe(true);
    const w = mcreg(x, y, { methodReg: "WD" });
    expect([w.methodReg, w.methodCi]).toEqual(["WDeming", "jackknife"]);
    expect(w.weights).toHaveLength(7);
    const b = mcreg(x, y, { methodReg: "Dem", methodCi: "boot", methodBootstrapCi: "St", nsamples: 10, rngSeed: 1 });
    expect([b.methodReg, b.methodCi, b.methodBootstrapCi, b.bootstrap!.nsamples]).toEqual(["Deming", "bootstrap", "Student", 10]);
  });

  it("rejects input without a defined result", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [1.1, 2.3, 2.9, 4.2, 4.8];
    expect(() => mcreg(x, y.slice(1))).toThrow(TypeError);
    expect(() => mcreg([1, 2], [1, 2])).toThrow(RangeError);
    expect(() => mcreg([1, 2, NaN, 4], [1, 2, 3, 4])).toThrow(RangeError);
    expect(mcreg([1, 2, NaN, 4, 5], [1, 2.1, 3, 4.2, 4.9], { naRm: true, methodReg: "Deming" }).n).toBe(4);
    expect(() => mcreg([1, 2, Infinity, 4], [1, 2, 3, 4])).toThrow(RangeError);
    expect(() => mcreg([1, 1, 1, 1], [1, 2, 3, 4], { methodReg: "Deming" })).toThrow(RangeError);
    expect(() => mcreg([1, 2, 3, 4], [2, 2, 2, 2])).toThrow(RangeError);
    expect(() => mcreg([-1, 2, 3, 4], [1, 2, 3, 5])).toThrow(RangeError);
    expect(() => mcreg([0, 2, 3, 4], [1, 2, 3, 5], { methodReg: "WDeming" })).toThrow(RangeError);
    expect(() => mcreg(x, y, { methodReg: "WDeming", methodCi: "analytical" })).toThrow(RangeError);
    expect(() => mcreg(x, y, { methodCi: "bootstrap", methodBootstrapCi: "tBoot" })).toThrow(RangeError);
    expect(() => mcreg([1, 2, 3, 4, 5], [3, 1, 2, 1, 3], { methodReg: "Deming" })).toThrow(RangeError);
    for (const errorRatio of [0, -1, Infinity, NaN]) expect(() => mcreg(x, y, { methodReg: "Deming", errorRatio })).toThrow(RangeError);
    for (const confLevel of [0, 1, NaN]) expect(() => mcreg(x, y, { confLevel })).toThrow(RangeError);
    expect(() => mcreg(x, y, { methodReg: "PaBaLarge" })).toThrow(RangeError);
    expect(() => mcreg(x, y, { methodCi: "bootstrap", nsamples: 0 })).toThrow(RangeError);
    expect(() => mcreg(x, y, { methodCi: "bootstrap", nsamples: 2.5 })).toThrow(RangeError);
    expect(() => mcreg(x, y, { methodReg: "WDeming", threshold: -1 })).toThrow(RangeError);
    const big = Array.from({ length: 5794 }, (_, i) => i + 1);
    expect(() => mcreg(big, big)).toThrow(RangeError);
    // 2^27 slopes over all the fits (rule 4)
    const mid = big.slice(0, 600);
    expect(() => mcreg(mid, mid, { methodCi: "bootstrap" })).toThrow(/2\^27/);
    expect(() => mcreg(mid, mid, { methodCi: "nestedbootstrap", nsamples: 30 })).toThrow(/2\^27/);
    // @ts-expect-error unknown option
    expect(() => mcreg(x, y, { alpha: 0.05 })).toThrow(RangeError);
  });

  it("restores the random stream after rngSeed and uses the current one without it", () => {
    const x = [2.3, 8.1, 6.6, 26.1, 4.8, 1.8, 10.3, 4.1, 4.1, 13.8];
    const y = [2.2, 7.3, 6.6, 27.5, 4.4, 1.6, 11.2, 4.2, 4.3, 14.8];
    setSeed(1);
    const before = runif(1)[0];
    setSeed(1);
    const a = mcreg(x, y, { methodCi: "bootstrap", nsamples: 20, rngSeed: 5 });
    expect(runif(1)[0]).toBe(before);
    // without a seed: the stream of setSeed(5) (R's set.seed(5) draws the same resamples)
    setSeed(5);
    const b = mcreg(x, y, { methodCi: "bootstrap", nsamples: 20 });
    expect(b.bootstrap!.slope).toEqual(a.bootstrap!.slope);
    expect(b.slope.confInt).toEqual(a.slope.confInt);
  });
});

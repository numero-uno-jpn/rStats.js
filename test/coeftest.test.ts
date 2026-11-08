// coeftest and coefci (lmtest 0.9-40) against R (oracle/coeftest.R, oracle/robust-behaviour.md section 4): every
// value within 1e-12 of R's (the confidence limits relative to |lower| + |upper|, as they can cancel), the same names,
// column names, method, df, nobs and warnings; where R returns NaN for input without a defined result (a negative
// variance, a level above 1) an error.
import { describe, expect, it } from "vitest";
import { coefci, coeftest, vcovCL, vcovHC, type CoefciOptions, type RobustFit, type VcovArgument } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { arg, loadHTestFixture, type HTestArg, type HTestCase } from "./helpers/htest.js";
import { mat, robustFit } from "./helpers/robust.js";

const TOL = 1e-12;

/** The vcov argument of a case: a covariance function with its arguments, a matrix (with names: a result), or none */
function vcovOf(a: HTestCase["args"]): VcovArgument | undefined {
  if (a.vcovFun !== undefined) {
    const va = (a.vcovArgs ?? {}) as unknown as Record<string, HTestArg>;
    const type = arg.str(va.type) as never;
    if (a.vcovFun === "vcovHC") return (f: RobustFit) => vcovHC(f, type === undefined ? {} : { type });
    const cluster = (va.cluster as string[]).map(num);
    const cadjust = arg.bool(va.cadjust);
    return (f: RobustFit) => vcovCL(f, { cluster, ...(type === undefined ? {} : { type }), ...(cadjust === undefined ? {} : { cadjust }) });
  }
  if (a.vcov === undefined) return undefined;
  const V = mat(a.vcov);
  return a.vcovNames === undefined ? V : { vcov: V, names: a.vcovNames as string[], warnings: [] };
}

class Check {
  failures: string[] = [];
  worst = 0;
  numbers(index: number, what: string, a: readonly number[], e: readonly number[], scale?: readonly number[]): void {
    if (a.length !== e.length) {
      this.failures.push(`#${index} ${what}: length ${a.length} / R ${e.length}`);
      return;
    }
    a.forEach((v, i) => {
      const ev = e[i]!;
      if (Number.isNaN(ev) || Number.isNaN(v) || !Number.isFinite(ev)) {
        if (!Object.is(v, ev) && !(Number.isNaN(v) && Number.isNaN(ev))) this.failures.push(`#${index} ${what}[${i}]: TS ${v} / R ${ev}`);
        return;
      }
      const err = v === ev ? 0 : Math.abs(v - ev) / (scale?.[i] ?? Math.abs(ev));
      this.worst = Math.max(this.worst, err);
      if (!(err <= TOL)) this.failures.push(`#${index} ${what}[${i}]: TS ${v} / R ${ev} (error ${err.toExponential(2)})`);
    });
  }
  equal(index: number, what: string, a: unknown, e: unknown): void {
    if (JSON.stringify(a) !== JSON.stringify(e)) this.failures.push(`#${index} ${what}: TS ${JSON.stringify(a)} / R ${JSON.stringify(e)}`);
  }
}

const NEGATIVE_VARIANCE = "the variance of coefficient 2 in 'vcov' is negative";

describe("coeftest", () => {
  const fixture = loadHTestFixture("coeftest");
  it(`matches R (${fixture.r_version})`, () => {
    const check = new Check();
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const e = c.expected;
      const fit = robustFit(a);
      const df = arg.num(a.df);
      const vcov = vcovOf(a);
      const call = () => coeftest(fit, { ...(vcov === undefined ? {} : { vcov }), ...(df === undefined ? {} : { df }) });
      if ((e.warnings as string[]).includes("NaNs produced")) {
        // a negative variance: R's NaN standard error, an error here (rule 1)
        errors++;
        expect(call, `#${index}`).toThrow(NEGATIVE_VARIANCE);
        return;
      }
      const r = call();
      const table = mat(e.table);
      check.numbers(index, "estimate", r.estimate, table.map((row) => row[0]!));
      check.numbers(index, "stdError", r.stdError, table.map((row) => row[1]!));
      check.numbers(index, "statistic", r.statistic, table.map((row) => row[2]!));
      check.numbers(index, "pValue", r.pValue, table.map((row) => row[3]!));
      check.equal(index, "names", r.names, e.rowNames);
      check.equal(index, "colNames", ["Estimate", "Std. Error", r.statisticName, r.statisticName === "t value" ? "Pr(>|t|)" : "Pr(>|z|)"], e.colNames);
      check.equal(index, "method", r.method, e.method);
      check.numbers(index, "df", [r.df], [num(e.df as string)]);
      check.numbers(index, "nobs", [r.nobs], [num(e.nobs as string)]);
      check.equal(index, "warnings", r.warnings, e.warnings);
    });
    console.log(`coeftest: ${fixture.cases.length} cases, worst ${check.worst.toExponential(1)}, ${errors} errors`);
    expect(check.failures, check.failures.slice(0, 20).join("\n")).toEqual([]);
  });

  it("checks its arguments", () => {
    const fit = robustFit(fixture.cases[0]!.args);
    expect(() => coeftest(fit, { vcov: [[1, 0], [0, 1]] })).toThrow("'vcov' must be 3 x 3, one row per coefficient");
    expect(() => coeftest(fit, { vcov: [[1, 0, 0], [0, 1]] })).toThrow("'vcov' must be a square matrix");
    expect(() => coeftest(fit, { df: NaN })).toThrow("'df' must not be NaN");
    expect(() => coeftest({} as RobustFit)).toThrow("'fit' must be the result of lm or glm");
  });
});

describe("coefci", () => {
  const fixture = loadHTestFixture("coefci");
  it(`matches R (${fixture.r_version})`, () => {
    const check = new Check();
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const e = c.expected;
      const fit = robustFit(a);
      const options: CoefciOptions = {};
      const vcov = vcovOf(a);
      if (vcov !== undefined) options.vcov = vcov;
      const df = arg.num(a.df);
      if (df !== undefined) options.df = df;
      const level = arg.num(a.level);
      if (level !== undefined) options.level = level;
      if (a.parm !== undefined) {
        const p = (Array.isArray(a.parm) ? a.parm : [a.parm]) as string[];
        // R's 1-based indices are 0-based here
        options.parm = p.every((v) => /^\d+$/.test(v)) ? p.map((v) => Number(v) - 1) : p;
      }
      const call = () => coefci(fit, options);
      if (e.error !== undefined) {
        errors++;
        expect(call, `#${index}`).toThrow(e.error as string);
        return;
      }
      if (level !== undefined && level > 1) {
        // R's NaN limits for a level above 1: an error here (rule 1)
        errors++;
        expect(call, `#${index}`).toThrow("'level' must be between 0 and 1");
        return;
      }
      const r = call();
      const lower = (e.lower as string[]).map(num);
      const upper = (e.upper as string[]).map(num);
      const scale = lower.map((l, i) => Math.abs(l) + Math.abs(upper[i]!));
      check.numbers(index, "lower", r.lower, lower, scale);
      check.numbers(index, "upper", r.upper, upper, scale);
      check.equal(index, "names", r.names, e.rowNames);
      check.equal(index, "colNames", r.colNames, e.colNames);
      check.equal(index, "warnings", r.warnings, e.warnings);
    });
    console.log(`coefci: ${fixture.cases.length} cases, worst ${check.worst.toExponential(1)}, ${errors} errors`);
    expect(check.failures, check.failures.slice(0, 20).join("\n")).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { crr, cuminc, timepoints, predictCrr, pchisq } from "../src/index.js";

interface FixtureCase {
  args: Record<string, unknown>;
  expected: Record<string, any>;
  reference?: Record<string, any>;
}
type GroupLabel = string | number;
interface Fixture { r_version: string; cases: FixtureCase[] }

function fixture(name: string): Fixture {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)), "utf8")) as Fixture;
}
function number(v: unknown): number {
  if (v === "NA" || v === "NaN" || v === null) return NaN;
  if (v === "Inf") return Infinity;
  if (v === "-Inf") return -Infinity;
  return Number(v);
}
function vector(v: unknown): number[] {
  return (Array.isArray(v) ? v : [v]).map(number);
}
function matrix(v: unknown): number[][] | undefined {
  return v === undefined ? undefined : (v as unknown[][]).map((r) => r.map(number));
}
function labels(v: unknown): (GroupLabel | null)[] | undefined {
  if (v === undefined) return undefined;
  const a = v as unknown[];
  const numeric = a.every((x) => x === "NA" || x === null || (typeof x === "string" && x.trim() !== "" && Number.isFinite(Number(x))));
  return numeric ? a.map((x) => x === "NA" || x === null ? null : Number(x)) : a.map((x) => x === null ? null : String(x));
}
function code(v: unknown, character: boolean): GroupLabel {
  if (v === null || v === "NA") return NaN;
  return character ? String(v) : number(v);
}
function flatten(v: unknown): unknown[] {
  return Array.isArray(v) ? v.flatMap(flatten) : [v];
}
function close(actual: unknown, expected: unknown, tolerance = 1e-12): boolean {
  const a = Number(actual), e = number(expected);
  if (Number.isNaN(e)) return Number.isNaN(a);
  if (!Number.isFinite(e)) return a === e;
  return e === 0 ? Math.abs(a) <= tolerance : Math.abs(a - e) / Math.abs(e) <= tolerance;
}
function compare(mismatches: string[], index: number, field: string, actual: unknown, expected: unknown,
  tolerance = 1e-12, reference?: unknown): void {
  const a = flatten(actual), e = flatten(expected);
  if (a.length !== e.length) {
    mismatches.push(`#${index} ${field}: length ${a.length}, expected ${e.length}`);
    return;
  }
  const r = reference === undefined ? undefined : flatten(reference);
  for (let i = 0; i < e.length; i++) {
    if (close(a[i], e[i], tolerance)) continue;
    if (r !== undefined && r.length === e.length && close(a[i], r[i], tolerance)) continue;
    mismatches.push(`#${index} ${field}[${i}]: actual ${String(a[i])}, expected ${String(e[i])}`);
  }
}
function compareResiduals(mismatches: string[], index: number, actual: unknown, expected: unknown, tolerance = 1e-12): void {
  const a = flatten(actual), e = flatten(expected);
  if (a.length !== e.length) {
    mismatches.push(`#${index} res: length ${a.length}, expected ${e.length}`);
    return;
  }
  for (let i = 0; i < e.length; i++) {
    const av = Number(a[i]), ev = number(e[i]);
    if (Number.isNaN(ev) ? Number.isNaN(av) : Math.abs(av - ev) <= Math.max(1e-14, Math.abs(ev) * tolerance)) continue;
    mismatches.push(`#${index} res[${i}]: actual ${String(a[i])}, expected ${String(e[i])}`);
  }
}
function compareAbsolute(mismatches: string[], index: number, field: string, actual: number, expected: unknown,
  tolerance = 1e-14): void {
  const e = number(expected);
  if (!(Number.isNaN(e) ? Number.isNaN(actual) : Math.abs(actual - e) <= tolerance)) {
    mismatches.push(`#${index} ${field}: actual ${String(actual)}, expected ${String(e)} (absolute tolerance ${tolerance})`);
  }
}
function equal(mismatches: string[], index: number, field: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    mismatches.push(`#${index} ${field}: actual ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}
const cumincFixture = fixture("cuminc");
const crrFixture = fixture("crr");
const CUMINC_KNOWN_DIFFERENCES = new Map<number, readonly string[]>([
  [14, ["subset-not-supported"]],
  [31, ["gray-singular-covariance"]],
  [37, ["naFail-not-supported"]],
  [38, ["negative-time-rejected-by-design"]],
]);
const CRR_KNOWN_DIFFERENCES = new Map<number, readonly string[]>([
  [21, ["tiny-time-scale-invariance"]],
  [32, ["cengroup-variance-not-supported"]],
  [33, ["cengroup-variance-not-supported"]],
  [34, ["cengroup-variance-not-supported"]],
  [37, ["subset-not-supported"]],
]);
// Cases whose R values are not the converged fit to 1e-12, with the tolerance the fit is compared at
const CRR_TOLERANCE = new Map<number, number>([
  // gtol = 1e-12: rStats.js's coefficients after 4 Newton steps equal the root found by iterating 60 steps
  // (gtol 1e-300) to the last digit; R's are 1.4e-11 (relative) from that root, and everything formed from
  // the coefficients (var, inf, bfitj, res, se, limits) carries the same difference
  [17, 1e-10],
  // Monotone likelihood (R does not converge: the coefficient runs to 12.4 in 10 steps): the values are those of
  // the tenth Newton iterate, where the rounding of each step has been amplified (2e-12 in var)
  [25, 1e-11],
]);

describe("competing risks", () => {
  it(`cuminc and timepoints match R's fixture (${cumincFixture.r_version})`, () => {
    const mismatches: string[] = [];
    cumincFixture.cases.forEach((c, index) => {
      const a = c.args, e = c.expected;
      const known = CUMINC_KNOWN_DIFFERENCES.get(index) ?? [];
      // The agreed API deliberately has neither subset nor na.action = "fail".
      if (known.some((v) => v === "subset-not-supported" || v === "naFail-not-supported")) return;
      // The fixture's negative-time case is deliberately rejected by the selected non-negative survival-time API.
      if (known.includes("negative-time-rejected-by-design")) {
        let thrown = false;
        try { cuminc(vector(a.ftime), (a.fstatus as unknown[]).map((x) => code(x, a.fstatusType === "character"))); }
        catch { thrown = true; }
        if (!thrown) mismatches.push("#38 negative time: expected an exception");
        return;
      }
      const character = a.fstatusType === "character";
      const time = vector(a.ftime);
      const status = (Array.isArray(a.fstatus) ? a.fstatus : [a.fstatus]).map((x) => code(x, character));
      const group = labels(a.group);
      const strata = labels(a.strata);
      const options = {
        ...(group === undefined ? {} : { group }),
        ...(strata === undefined ? {} : { strata }),
        ...(a.rho === undefined ? {} : { rho: number(a.rho) }),
        ...(a.cencode === undefined ? {} : { cencode: code(a.cencode, character) }),
      };
      if (e.error !== undefined) {
        let thrown = false;
        try { cuminc(time, status, options); } catch { thrown = true; }
        if (!thrown) mismatches.push(`#${index} error: expected an exception`);
        return;
      }
      let actual;
      try { actual = cuminc(time, status, options); }
      catch (err) { mismatches.push(`#${index} exception: ${String(err)}`); return; }
      const expectedWarnings = [...e.warnings, ...(e.omitted > 0 ? [`${e.omitted} cases omitted due to missing values`] : [])];
      equal(mismatches, index, "warnings", actual.warnings, expectedWarnings);
      compare(mismatches, index, "curve count", actual.curves.length, e.curves.length);
      actual.curves.forEach((curve, j) => {
        const expected = e.curves[j];
        if (expected === undefined) return;
        equal(mismatches, index, `curves[${j}].name`, curve.name, expected.name);
        compare(mismatches, index, `curves[${j}].time`, curve.time, expected.time);
        compare(mismatches, index, `curves[${j}].est`, curve.est, expected.est, 1e-12, c.reference?.curves?.[j]?.est);
        compare(mismatches, index, `curves[${j}].var`, curve.var, expected.var, 1e-12, c.reference?.curves?.[j]?.var);
      });
      if (e.tests !== undefined && actual.tests !== undefined) {
        e.tests.forEach((expected: Record<string, string>, j: number) => {
          const got = actual.tests?.[j];
          if (got === undefined) { mismatches.push(`#${index} tests[${j}]: missing`); return; }
          equal(mismatches, index, `tests[${j}].cause`, got.cause, expected.cause);
          compare(mismatches, index, `tests[${j}].df`, got.df, expected.df);
          if (known.includes("gray-singular-covariance")) {
            if (!Number.isNaN(got.stat) || !Number.isNaN(got.pValue)) {
              mismatches.push(`#${index} tests[${j}]: singular contrast must return NaN statistic and p-value`);
            }
            return;
          }
          compare(mismatches, index, `tests[${j}].statistic`, got.stat, expected.stat);
          // Compare against the accurately evaluated upper tail from the fixture statistic, not R's
          // cancellation-prone pv = 1 - pchisq(stat, df). Keep a separate absolute check against R's pv.
          const directUpperTail = pchisq(number(expected.stat), number(expected.df), { lowerTail: false });
          compare(mismatches, index, `tests[${j}].pValue`, got.pValue, directUpperTail, 1e-12);
          compareAbsolute(mismatches, index, `tests[${j}].pValue vs R pv`, got.pValue, expected.pv);
        });
      } else if (e.tests !== undefined || actual.tests !== undefined) {
        mismatches.push(`#${index} tests: presence differs`);
      }
      if (e.timepoints !== undefined) {
        const got = timepoints(actual, vector(e.timepoints.times));
        compare(mismatches, index, "timepoints.times", got.times, e.timepoints.times);
        compare(mismatches, index, "timepoints.est", got.est, e.timepoints.est);
        compare(mismatches, index, "timepoints.var", got.var, e.timepoints.var);
      }
    });
    console.log(`cuminc: ${cumincFixture.cases.length} fixture cases`);
    expect(mismatches).toEqual([]);
  });

  it("Gray's tied-time variance matches R for the original demo and stratified three-group data", () => {
    // Original Stage 0 demo: group B has an event at time 6, tied with group A.
    const demoTime = [1, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 7];
    const demoStatus = [1, 0, 2, 1, 0, 1, 0, 1, 2, 0, 1, 0];
    const demoGroup = ["A", "A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "B"];
    const demo = cuminc(demoTime, demoStatus, { group: demoGroup });
    expect(demo.tests?.find((x) => x.cause === "1")?.stat).toBeCloseTo(0.7292720972825765, 12);
    expect(demo.tests?.find((x) => x.cause === "2")?.stat).toBeCloseTo(0.012310108268851854, 12);
    const rhoReferences = [
      [0.5, 0.70344737350172382],
      [1, 0.67587841160933393],
      [2, 0.62040089915750718],
    ] as const;
    for (const [rho, statistic] of rhoReferences) {
      const weighted = cuminc(demoTime, demoStatus, { group: demoGroup, rho });
      expect(weighted.tests?.find((x) => x.cause === "1")?.stat).toBeCloseTo(statistic, 12);
    }

    // R 4.6.2 / cmprsk 2.2.12 reference: three groups, three causes, two strata, rho = 0.7.
    const fit = cuminc(
      [1, 2, 2, 3, 4, 5, 1, 2, 3, 3, 4, 5, 1, 2, 3, 4, 4, 5],
      [2, 1, 2, 0, 3, 0, 0, 1, 3, 2, 0, 1, 1, 2, 0, 3, 1, 0],
      {
        group: ["A", "A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "B", "C", "C", "C", "C", "C", "C"],
        strata: ["s1", "s1", "s1", "s2", "s2", "s2", "s1", "s1", "s1", "s2", "s2", "s2", "s1", "s1", "s1", "s2", "s2", "s2"],
        rho: 0.7,
      },
    );
    const expected = [
      ["1", 0.65680026526631585],
      ["2", 0.74863411423063431],
      ["3", 0.78506394191122908],
    ] as const;
    for (const [cause, statistic] of expected) {
      expect(fit.tests?.find((x) => x.cause === cause)?.stat).toBeCloseTo(statistic, 12);
    }
  });

  it(`crr matches R's fixture (${crrFixture.r_version})`, () => {
    const mismatches: string[] = [];
    crrFixture.cases.forEach((c, index) => {
      const a = c.args, e = c.expected;
      const known = CRR_KNOWN_DIFFERENCES.get(index) ?? [];
      // cengroup variance is deliberately unsupported; subset is intentionally not part of the API.
      if (known.some((v) => ["cengroup-variance-not-supported", "subset-not-supported", "tiny-time-scale-invariance"].includes(v))) return;
      const character = a.fstatusType === "character";
      const time = vector(a.ftime);
      const status = (a.fstatus as unknown[]).map((x) => code(x, character));
      const cov1 = matrix(a.cov1);
      const cov2 = matrix(a.cov2);
      const tfName = a.tf;
      const tf = tfName === undefined ? undefined : (times: readonly number[]): number[][] => {
        if (tfName === "t") return times.map((t) => [t]);
        if (tfName === "logt") return times.map((t) => [Math.log(t)]);
        if (tfName === "t,t2") return times.map((t) => [t, t * t]);
        if (tfName === "t,logt") return times.map((t) => [t, Math.log(t)]);
        throw new RangeError(`unknown fixture tf: ${String(tfName)}`);
      };
      const options = {
        ...(cov2 === undefined ? {} : { cov2 }),
        ...(tf === undefined ? {} : { tf }),
        ...(a.failcode === undefined ? {} : { failcode: code(a.failcode, character) }),
        ...(a.cencode === undefined ? {} : { cencode: code(a.cencode, character) }),
        ...(a.gtol === undefined ? {} : { gtol: number(a.gtol) }),
        ...(a.maxiter === undefined ? {} : { maxiter: number(a.maxiter) }),
        ...(a.init === undefined ? {} : { init: vector(a.init) }),
        ...(a.variance === undefined ? {} : { variance: a.variance as boolean }),
        ...(a.confLevel === undefined ? {} : { confLevel: number(a.confLevel) }),
        ...(e.coefNames === undefined ? {} : { names: e.coefNames as string[] }),
      };
      if (e.error !== undefined) {
        let thrown = false;
        try { crr(time, status, cov1, options); } catch { thrown = true; }
        if (!thrown) mismatches.push(`#${index} error: expected an exception`);
        return;
      }
      const tol = CRR_TOLERANCE.get(index) ?? 1e-12;
      let got;
      try { got = crr(time, status, cov1, options); }
      catch (err) { mismatches.push(`#${index} exception: ${String(err)}`); return; }
      equal(mismatches, index, "names", got.names, e.coefNames);
      compare(mismatches, index, "coefficients", got.coefficients, e.coef, tol);
      compare(mismatches, index, "loglik", got.loglik, e.loglik, tol);
      compare(mismatches, index, "loglikNull", got.loglikNull, e.loglikNull, tol);
      compare(mismatches, index, "inf", got.inf, e.inf, tol);
      compare(mismatches, index, "var", got.var, e.var, tol);
      compare(mismatches, index, "invinf", got.invinf, e.invinf, tol);
      equal(mismatches, index, "converged", got.converged, e.converged);
      compare(mismatches, index, "n", got.n, e.n, tol);
      compare(mismatches, index, "nMissing", got.nMissing, e.nMissing, tol);
      compare(mismatches, index, "omitted/nMissing", got.nMissing, e.omitted, tol);
      compare(mismatches, index, "uftime", got.uftime, e.uftime, tol);
      compare(mismatches, index, "bfitj", got.bfitj, e.bfitj, tol);
      if (e.res !== undefined) {
        // R's NULL is serialized as an empty object by the oracle's JSON writer.
        const nullResiduals = e.res === null ||
          (typeof e.res === "object" && !Array.isArray(e.res) && Object.keys(e.res).length === 0);
        if (nullResiduals) equal(mismatches, index, "res", got.res, null);
        else compareResiduals(mismatches, index, got.res, e.res, tol);
      }
      compare(mismatches, index, "tfs", got.tfs, e.tfs, tol);
      if (e.se !== undefined) compare(mismatches, index, "se", got.se, e.se, tol);
      if (e.z !== undefined) compare(mismatches, index, "z", got.z, e.z, tol);
      if (e.pValue !== undefined) compare(mismatches, index, "pValue", got.pValue, e.pValue, tol);
      if (e.expCoef !== undefined) compare(mismatches, index, "expCoef", got.expCoef, e.expCoef, tol);
      if (e.lower !== undefined) compare(mismatches, index, "lower", got.lower, e.lower, tol);
      if (e.upper !== undefined) compare(mismatches, index, "upper", got.upper, e.upper, tol);
      if (e.logtest !== undefined) {
        // logtest = 2 (loglik - loglikNull) is a difference of log likelihoods (about -499 for cases 5 and 19, where
        // it is 0.55): its rounding is that of the log likelihoods, so its error is measured against 2 (|l| + |l0|)
        const logtestScale = 2 * (Math.abs(got.loglik) + Math.abs(got.loglikNull));
        const expectedStatistic = number((e.logtest as unknown[])[0]);
        if (!(Math.abs(got.logtest.statistic - expectedStatistic) <= tol * Math.max(logtestScale, Math.abs(expectedStatistic)))) {
          mismatches.push(`#${index} logtest: actual ${got.logtest.statistic}, expected ${expectedStatistic} (relative to 2 (|l| + |l0|))`);
        }
        compare(mismatches, index, "logtest.df", got.logtest.df, (e.logtest as unknown[])[1]);
      }
      equal(mismatches, index, "warnings", got.warnings, e.warnings);
      if (e.predict !== undefined) {
        const predicted = predictCrr(got, matrix(a.newCov1), matrix(a.newCov2));
        compare(mismatches, index, "predict", predicted, e.predict, tol);
      }
    });
    expect(mismatches).toEqual([]);
  });

  it("is invariant to a 2^-40 change of the time unit", () => {
    const base = crrFixture.cases[18]!;
    const tiny = crrFixture.cases[21]!;
    const parse = (c: FixtureCase) => ({
      time: vector(c.args.ftime),
      status: (c.args.fstatus as unknown[]).map((x) => number(x)),
      cov: matrix(c.args.cov1)!,
    });
    const a = parse(base), b = parse(tiny);
    const fitA = crr(a.time, a.status, a.cov);
    const fitB = crr(b.time, b.status, b.cov);
    const mismatches: string[] = [];
    compare(mismatches, 21, "coefficients", fitB.coefficients, fitA.coefficients);
    compare(mismatches, 21, "loglik", fitB.loglik, fitA.loglik);
    compare(mismatches, 21, "var", fitB.var, fitA.var);
    compare(mismatches, 21, "uftime scaled", fitB.uftime, fitA.uftime.map((v) => v * 2 ** -40));
    // bfitj is a jump in the dimensionless cumulative subdistribution hazard, so it is
    // invariant to a change of the time unit (only uftime is rescaled).
    compare(mismatches, 21, "bfitj", fitB.bfitj, fitA.bfitj);
    expect(mismatches).toEqual([]);
  });

  it("rejects invalid inputs and unsupported censoring groups", () => {
    expect(() => cuminc([1, 2], [1, 0], { unknown: true } as never)).toThrow(RangeError);
    expect(() => cuminc([-1, 2], [1, 0])).toThrow(RangeError);
    expect(cuminc([1, 2, 3], [1, 0, 1], { rho: NaN }).tests).toBeUndefined();
    expect(() => crr([1, 2], [1, 0], [[1], [2]], { cengroup: [1, 1] } as never)).toThrow(RangeError);
    expect(() => crr([-3, -2, -1, 0, 1, 2, 3, 4], [1, 0, 2, 1, 0, 2, 1, 0],
      [[0], [1], [2], [3], [4], [5], [6], [7]])).not.toThrow();
    expect(() => crr([1, 2], [1, 0], [[1], [2]], { maxiter: -1 })).toThrow(RangeError);
  });
});

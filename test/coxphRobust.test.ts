// The robust (Lin-Wei) variance of coxph against R's survival package (oracle/coxphrobust.R,
// oracle/robust-behaviour.md section 5): every value within a relative 1e-12 of R's, NaN matching NaN (R's NA
// included), the same iteration counts and warnings. The entries of the variance matrices (and the dfbeta residuals,
// whose cross-products make the robust variance) are compared within 1e-12 relative to sqrt(V_ii V_jj)
// (robust-behaviour.md, rStats.js's choices 14), the score residuals within 1e-12 relative to the largest residual of
// their column (the spec's own check of them, 5.2), since single entries can be near 0 by cancellation.
// Differences from the fixture, by the API:
// - case 16 (R's `cluster()` term of the formula) is the `cluster` option; case 17 gives the cluster both as the term
//   and as the argument: R ignores the term with a warning; rStats.js has no formula, so the argument is the cluster
//   option and there is no warning;
// - case 25 (a single cluster): R fails with "(subscript) logical subscript too long"; rStats.js throws "at least two
//   clusters are needed" (rStats.js's choices 13).
import { describe, expect, it } from "vitest";
import { coxph, type CoxphOptions } from "../src/index.js";
import { fitCoxph } from "../src/models/coxph.js";
import { Comparison, loadAnovaFixture } from "./helpers/anova.js";
import { num } from "./helpers/fixture.js";

const fixture = loadAnovaFixture("coxphRobust");
const TOL = 1e-12;

const label = (v: string | null): string | null => (v === "NA" ? null : v);

/** The arguments of a case */
function argsOf(a: Record<string, unknown>): [number[], number[], number[][], CoxphOptions] {
  const time = (a.time as string[]).map(num);
  const status = (a.status as string[]).map(num);
  const x = (a.x as string[][]).map((row) => row.map(num));
  // case 17: the argument is the cluster used (R ignores the formula term)
  const cluster = (a.clusterBoth ?? a.cluster) as (string | null)[] | undefined;
  const options: CoxphOptions = {
    ...(a.ties === undefined ? {} : { ties: a.ties as "efron" | "breslow" }),
    ...(a.weights === undefined ? {} : { weights: (a.weights as string[]).map(num) }),
    ...(a.strata === undefined ? {} : { strata: a.strata as string[] }),
    ...(a.init === undefined ? {} : { init: (a.init as string[]).map(num) }),
    ...(a.robust === undefined ? {} : { robust: a.robust as boolean }),
    ...(cluster === undefined ? {} : { cluster: cluster.map(label) }),
    control: a["iter.max"] === undefined ? {} : { iterMax: num(a["iter.max"] as string) },
  };
  return [time, status, x, options];
}

/** The failures of a matrix compared entry by entry relative to sqrt(V_ii V_jj) of R's matrix */
function compareCovariance(cmp: Comparison, index: number, field: string, expected: unknown, actual: number[][] | undefined): void {
  if (actual === undefined) return cmp.fail(index, field, "", "missing");
  const e = (expected as string[][]).map((row) => row.map(num));
  if (e.length !== actual.length) return cmp.fail(index, field, "", `dimension ${actual.length}, R ${e.length}`);
  e.forEach((row, i) =>
    row.forEach((v, j) => {
      const scale = Math.sqrt(Math.abs(e[i]![i]! * e[j]![j]!));
      const a = actual[i]![j]!;
      if (!(Math.abs(a - v) <= TOL * scale) && !(a === v)) cmp.fail(index, field, `[${i}][${j}]`, `${a} vs R ${v}`);
    }),
  );
}

/** Rows of residuals compared column by column relative to a scale per column */
function compareRows(
  cmp: Comparison,
  index: number,
  field: string,
  expected: unknown,
  actual: number[][] | undefined,
  scale: (column: number) => number,
): void {
  if (actual === undefined) return cmp.fail(index, field, "", "missing");
  const e = (expected as string[][]).map((row) => row.map(num));
  if (e.length !== actual.length) return cmp.fail(index, field, "", `${actual.length} rows, R ${e.length}`);
  e.forEach((row, r) =>
    row.forEach((v, j) => {
      const a = actual[r]![j]!;
      if (!(Math.abs(a - v) <= TOL * scale(j))) cmp.fail(index, field, `[${r}][${j}]`, `${a} vs R ${v}`);
    }),
  );
}

function compareCases(): void {
  const cmp = new Comparison([]);
  let nErrors = 0;
  fixture.cases.forEach((c, index) => {
    const e = c.expected;
    const [time, status, x, options] = argsOf(c.args);
    if (e.error !== undefined) {
      nErrors++;
      // case 25, a single cluster: R's error is unrelated to the cause
      expect(() => coxph(time, status, x, options), `#${index}`).toThrow("at least two clusters are needed");
      return;
    }
    let fit;
    try {
      fit = fitCoxph(time, status, x, options);
    } catch (err) {
      return cmp.fail(index, "(exception)", "result", (err as Error).message);
    }
    const r = fit.result;
    cmp.strings(index, "warnings", c.args.clusterBoth === undefined ? e.warnings : [], r.warnings);
    cmp.strings(index, "iter", e.iter, r.iter);
    cmp.strings(index, "n", e.n, r.n);
    cmp.strings(index, "nevent", e.nevent, r.nevent);
    cmp.numbers(index, "coefficients", e.coef, r.coefficients);
    compareCovariance(cmp, index, "var", e.var, r.var);
    cmp.numbers(index, "loglik", e.loglik, r.loglik);
    cmp.numbers(index, "score", e.score, r.score);
    cmp.numbers(index, "wald", e.wald, r.wald);
    cmp.numbers(index, "se", e.se, r.se);
    cmp.numbers(index, "z", e.z, r.z);
    cmp.numbers(index, "p", e.p, r.p);
    cmp.numbers(index, "lower", e.lower, r.lower);
    cmp.numbers(index, "upper", e.upper, r.upper);
    const test = (t: { statistic: number; df: number; pValue: number }) => [t.statistic, t.df, t.pValue];
    cmp.numbers(index, "logtest", e.logtest, test(r.logtest));
    cmp.numbers(index, "sctest", e.sctest, test(r.sctest));
    cmp.numbers(index, "waldtest", e.waldtest, test(r.waldtest));
    const robust = e["naive.var"] !== undefined;
    cmp.strings(index, "usedRobust", robust, r.usedRobust);
    if (!robust) {
      for (const f of ["naiveVar", "robustSe", "rscore", "robscore"] as const) {
        if (r[f] !== undefined) cmp.fail(index, f, "", "present without the robust variance");
      }
      return;
    }
    compareCovariance(cmp, index, "naiveVar", e["naive.var"], r.naiveVar);
    cmp.numbers(index, "robustSe", e.robustSe, r.robustSe);
    cmp.numbers(index, "rscore", e.rscore, r.rscore);
    cmp.numbers(index, "robscore", e.robscore, r.robscore === undefined ? undefined : test(r.robscore));
    if (e.scoreResid !== undefined) {
      const s = (e.scoreResid as string[][]).map((row) => row.map(num));
      const largest = (j: number) => Math.max(...s.map((row) => Math.abs(row[j]!)));
      compareRows(cmp, index, "scoreResiduals", e.scoreResid, fit.scoreResiduals, largest);
      const v = (e["naive.var"] as string[][]).map((row) => row.map(num));
      // a dfbeta residual is a row of s' V: compared relative to sqrt(V_jj) times the largest score residual
      const dfScale = (j: number) => Math.sqrt(v[j]![j]!) * Math.max(...s[0]!.map((_, i) => largest(i) * Math.sqrt(v[i]![i]!)));
      compareRows(cmp, index, "dfbeta", e.dfbeta, fit.dfbeta, dfScale);
    }
  });
  console.log(cmp.summary("coxph (robust)", fixture.cases.length, nErrors));
  expect(cmp.failures, cmp.failures.slice(0, 30).join("\n")).toEqual([]);
}

describe("coxph with the robust variance", () => {
  it(`matches R (${fixture.r_version})`, () => compareCases());

  const time = [5, 3, 8, 1, 9, 4, 6, 2, 7, 10];
  const status = [1, 1, 0, 1, 0, 1, 1, 0, 1, 1];
  const x = [[1.2], [0.3], [-0.5], [2], [0.7], [0.1], [-1.1], [0.4], [0.9], [-0.2]];

  it("uses the robust variance by default only with a cluster or non-integer weights", () => {
    expect(coxph(time, status, x).usedRobust).toBe(false);
    expect(coxph(time, status, x, { weights: [1, 2, 1, 3, 1, 1, 2, 1, 1, 1] }).usedRobust).toBe(false);
    expect(coxph(time, status, x, { weights: [1, 2.5, 1, 3, 1, 1, 2, 1, 1, 1] }).usedRobust).toBe(true);
    expect(coxph(time, status, x, { cluster: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5] }).usedRobust).toBe(true);
    const naive = coxph(time, status, x);
    const robust = coxph(time, status, x, { robust: true });
    expect(robust.naiveVar).toEqual(naive.var);
    expect(robust.se).toEqual(naive.se);
    expect(robust.robustSe![0]).toBeCloseTo(Math.sqrt(robust.var[0]![0]!), 15);
    expect(naive.naiveVar).toBeUndefined();
  });

  it("drops rows with a missing cluster label", () => {
    const cl = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
    const full = coxph(time, status, x, { cluster: cl });
    const withNA = coxph([...time, 3.5, 6.5], [...status, 1, 0], [...x, [0.2], [0.8]], { cluster: [...cl, null, NaN] });
    expect(withNA).toEqual(full);
  });

  it("warns that a cluster is ignored without the robust variance", () => {
    const r = coxph(time, status, x, { cluster: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5], robust: false });
    expect(r.usedRobust).toBe(false);
    expect(r.warnings).toEqual(["cluster specified with robust=FALSE, cluster ignored"]);
    const { warnings, ...rest } = r;
    const { warnings: none, ...plain } = coxph(time, status, x);
    expect(rest).toEqual(plain);
    expect(none).toEqual([]);
  });

  it("rejects invalid arguments", () => {
    expect(() => coxph(time, status, x, { cluster: new Array<number>(10).fill(1) })).toThrow(
      "at least two clusters are needed",
    );
    expect(() => coxph(time, status, x, { cluster: [1, 2] })).toThrow(RangeError);
    expect(() => coxph(time, status, x, { robust: "yes" as unknown as boolean })).toThrow(TypeError);
  });
});

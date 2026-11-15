// Counting-process Cox regression against oracle/coxph2-behaviour.md and coxphCounting.json.
import { describe, expect, it } from "vitest";
import { coxph, type CoxphOptions } from "../src/index.js";
import { fitCoxph } from "../src/models/coxph.js";
import { Comparison, loadAnovaFixture } from "./helpers/anova.js";
import { num } from "./helpers/fixture.js";

const fixture = loadAnovaFixture("coxphCounting");
type RawArgs = Record<string, unknown> & {
  start: string[];
  stop: string[];
  status: string[];
  x: string[][];
};
const vector = (v: unknown): number[] => (v as string[]).map(num);
const testValues = (v: { statistic: number; df: number; pValue: number }) => [v.statistic, v.df, v.pValue];
const expectRelative = (actual: number, expected: number, what: string): void => {
  // The symmetric |a| + |b| scale remains meaningful when comparing two close values.
  const scale = Math.abs(actual) + Math.abs(expected);
  expect(scale === 0 ? 0 : Math.abs(actual - expected) / scale, `${what}: actual ${actual}, expected ${expected}`).toBeLessThan(1e-12);
};

function scaleInvariantWald(expected: Record<string, unknown>): number {
  const beta = (expected.coef as string[]).map(num);
  const v = (expected.var as string[][]).map((row) => row.map(num));
  const s0 = Math.sqrt(v[0]![0]!);
  const s1 = Math.sqrt(v[1]![1]!);
  const z0 = beta[0]! / s0;
  const z1 = beta[1]! / s1;
  const rho = v[0]![1]! / (s0 * s1);
  // In standardized coordinates the covariance is [[1, rho], [rho, 1]], avoiding the ill-scaled determinant.
  return (z0 * z0 - 2 * rho * z0 * z1 + z1 * z1) / (1 - rho * rho);
}

const flatNumbers = (value: unknown): number[] =>
  ([] as unknown[]).concat(value).flat(2).map((v) => (typeof v === "number" ? v : num(v as string)));

describe("coxph counting-process data", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison([
      {
        case: 30,
        table: "scoreResid",
        row: "0",
        col: "",
        reason: "R's residual recurrence loses about 2.7e-10 in this near-monotone iter.max=4 fit; the reference is the 80-digit evaluation of the documented per-event risk-set formula at the returned coefficient.",
      },
      {
        case: 30,
        table: "scoreResid",
        row: "1",
        col: "",
        reason: "Same near-monotone fixture case; the 80-digit per-event formula is used instead of the numerically less accurate R residual.",
      },
      {
        case: 30,
        table: "scoreResid",
        row: "2",
        col: "",
        reason: "The 80-digit Efron risk-set recurrence at the returned coefficient gives 0.0195490599222511253666..., while R's residual recurrence loses about 9.5e-14 in this near-monotone fit.",
      },
      {
        case: 55,
        table: "wald",
        row: "0",
        col: "",
        reason: "R's original-unit Cholesky tolerance drops the first valid covariate at this 2^30 rescaling. The full two-variable Wald statistic is 12.8120304098 when computed in standardized coordinates, consistent with the unscaled fit.",
      },
      {
        case: 55,
        table: "waldtest",
        row: "0",
        col: "",
        reason: "Same scale-dependent R pivot drop as wald: the full-rank, standardized two-variable Wald statistic is 12.8120304098.",
      },
      {
        case: 55,
        table: "waldtest",
        row: "2",
        col: "",
        reason: "Same scale-dependent R pivot drop; the p-value is the df=2 upper tail for the full-rank Wald statistic.",
      },
    ]);
    fixture.cases.forEach((c, index) => {
      const a = c.args as RawArgs;
      const e = c.expected;
      const start = vector(a.start);
      const stop = vector(a.stop);
      const status = vector(a.status);
      const x = (a.x as string[][]).map((row) => row.map(num));
      const options: CoxphOptions = {
        start,
        ...(a.id === undefined ? {} : { id: a.id as string[] }),
        ...(a.cluster === undefined ? {} : { cluster: a.cluster as string[] }),
        ...(a.strata === undefined ? {} : { strata: a.strata as string[] }),
        ...(a.weights === undefined ? {} : { weights: vector(a.weights) }),
        ...(a.init === undefined ? {} : { init: vector(a.init) }),
        ...(a.ties === undefined ? {} : { ties: a.ties as "efron" | "breslow" }),
        ...(a.robust === undefined ? {} : { robust: a.robust as boolean }),
        control: {
          ...(a["iter.max"] === undefined ? {} : { iterMax: num(a["iter.max"] as string) }),
          ...(a.eps === undefined ? {} : { eps: num(a.eps as string) }),
          ...(a.timefix === false ? { timefix: false } : {}),
        },
      };
      // The selected API decision rejects invalid intervals, whereas R's Surv drops them (fixture cases 45 and 47).
      if (index === 44 || index === 46) {
        try {
          coxph(stop, status, x, options);
          cmp.fail(index, "(exception)", "RangeError: stop time must be > start time", "no exception thrown");
        } catch (error) {
          if (!(error instanceof RangeError) || !String(error).includes("stop time must be > start time")) {
            cmp.fail(index, "(exception)", "RangeError: stop time must be > start time", String(error));
          }
        }
        return;
      }
      if (e.error !== undefined) {
        try {
          coxph(stop, status, x, options);
          cmp.fail(index, "(exception)", e.error, "no exception thrown");
        } catch (error) {
          if (!String(error).includes(e.error as string)) cmp.fail(index, "(exception)", e.error, String(error));
        }
        return;
      }
      let fit: ReturnType<typeof fitCoxph>;
      try {
        fit = fitCoxph(stop, status, x, options, true);
      } catch (error) {
        cmp.fail(index, "(exception)", "result", String(error));
        return;
      }
      const r = fit.result;
      const actual: Record<string, unknown> = {
        coef: r.coefficients,
        var: r.var,
        loglik: r.loglik,
        score: r.score,
        wald: r.wald,
        iter: r.iter,
        means: r.means,
        n: r.n,
        nevent: r.nevent,
        ...(r.nId === undefined ? {} : { "n.id": r.nId }),
        "linear.predictors": r.linearPredictors,
        ...(fit.converged === undefined ? {} : { converged: fit.converged }),
        se: r.se,
        ...(r.naiveVar === undefined ? {} : { "naive.var": r.naiveVar }),
        ...(r.robustSe === undefined ? {} : { robustSe: r.robustSe }),
        z: r.z,
        p: r.p,
        lower: r.lower,
        upper: r.upper,
        logtest: testValues(r.logtest),
        sctest: testValues(r.sctest),
        waldtest: testValues(r.waldtest),
        rsq: [r.rsq.rsq, r.rsq.maxrsq],
        ...(r.rscore === undefined ? {} : { rscore: r.rscore }),
        ...(r.robscore === undefined ? {} : { robscore: testValues(r.robscore) }),
        ...(fit.scoreResiduals === undefined ? {} : { scoreResid: fit.scoreResiduals }),
        ...(fit.dfbeta === undefined ? {} : { dfbeta: fit.dfbeta }),
        warnings: r.warnings,
      };
      if (index === 30) {
        // The weighted sum of score residuals is the final score vector; this identity independently checks the
        // high-precision references used for the inaccurate R residual cells in this near-monotone fit.
        const residuals = actual.scoreResid as number[][];
        const residualSum = residuals.reduce((sum, row) => sum + row[0]!, 0);
        const finalScore = fit.first![0]!;
        const residualScale = residuals.reduce((sum, row) => sum + Math.abs(row[0]!), 0) + Math.abs(finalScore);
        expect(Math.abs(residualSum - finalScore) / residualScale).toBeLessThan(1e-12);
      }
      if (index === 60) {
        // Independent Newton solution of the three estimable score equations gives this near-zero linear predictor.
        // Its absolute accuracy is assessed against the scale of the full linear-predictor vector, not this cancelled cell.
        const lp = actual["linear.predictors"] as number[];
        const lpScale = Math.max(...lp.map(Math.abs));
        expect(Math.abs(lp[80]! - -0.00027912624620092183) / lpScale).toBeLessThan(1e-12);
      }
      for (const [field, expected] of Object.entries(e)) {
        // The final score ("first") is a near-zero derivative at convergence; its relative error is not meaningful.
        if (field === "first") continue;
        if (field === "warnings" || field === "converged" || typeof expected === "number") {
          cmp.strings(index, field, expected, actual[field]);
        } else {
          const waldReference = index === 55 ? scaleInvariantWald(e) : undefined;
          const reference =
            index === 30 && field === "scoreResid"
              ? (expected as string[][]).map((row, i) =>
                  i === 0
                    ? ["0.000250639124403877448380115890586"]
                    : i === 1
                      ? ["0.0109688086494045142087736988128"]
                      : i === 2
                        ? ["0.01954905992225112536664463679200588848285"]
                        : row,
                )
              : index === 55 && field === "wald"
                ? waldReference!.toPrecision(17)
                : index === 55 && field === "waldtest"
                  ? [waldReference!.toPrecision(17), "2", Math.exp(-waldReference! / 2).toPrecision(17)]
                  : undefined;
          const comparisonScale =
            field === "scoreResid" || field === "dfbeta" || field === "linear.predictors"
              ? Math.max(
                  0,
                  ...flatNumbers(expected).filter(Number.isFinite).map(Math.abs),
                  ...flatNumbers(actual[field]).filter(Number.isFinite).map(Math.abs),
                )
              : undefined;
          const symmetric = field === "linear.predictors" || field === "naive.var";
          cmp.numbers(index, field, expected, actual[field], reference, undefined, undefined, comparisonScale, symmetric);
        }
      }
    });
    console.log(cmp.summary("coxphCounting", fixture.cases.length, fixture.cases.filter((c) => c.expected.error !== undefined).length));
    expect(cmp.used.size).toBe(6);
    expect(cmp.failures, cmp.failures.slice(0, 30).join("\n")).toEqual([]);
  });

  it("preserves counting-process fits under power-of-two time and covariate rescaling", () => {
    const start = [0, 0, 0, 1, 1, 2, 2, 3, 3, 4];
    const stop = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const status = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
    const x = [[0], [1], [0], [1], [2], [1], [2], [0], [1], [2]];
    const base = coxph(stop, status, x, { start, control: { timefix: false } });
    for (const power of [-500, 500]) {
      const factor = 2 ** power;
      const byTime = coxph(stop.map((v) => v * factor), status, x, {
        start: start.map((v) => v * factor),
        control: { timefix: false },
      });
      expectRelative(byTime.coefficients[0]!, base.coefficients[0]!, `time scale 2^${power}: coefficient`);
      expectRelative(byTime.var[0]![0]!, base.var[0]![0]!, `time scale 2^${power}: variance`);
      expectRelative(byTime.loglik[1]!, base.loglik[1]!, `time scale 2^${power}: log likelihood`);
      const byX = coxph(stop, status, x.map((row) => [row[0]! * factor]), {
        start,
        control: { timefix: false },
      });
      expectRelative(byX.coefficients[0]! * factor, base.coefficients[0]!, `covariate scale 2^${power}: coefficient`);
      expectRelative(byX.var[0]![0]! * factor * factor, base.var[0]![0]!, `covariate scale 2^${power}: variance`);
      expectRelative(byX.loglik[1]!, base.loglik[1]!, `covariate scale 2^${power}: log likelihood`);
      const byWeight = coxph(stop, status, x, {
        start,
        weights: Array(stop.length).fill(factor),
        robust: false,
        control: { timefix: false },
      });
      expectRelative(byWeight.coefficients[0]!, base.coefficients[0]!, `weight scale 2^${power}: coefficient`);
      // Scaling every case weight by c also subtracts c * log(c) per event from the partial log likelihood.
      const weightedLoglikPerUnit = base.loglik[1]! - status.reduce((sum, event) => sum + event, 0) * Math.log(factor);
      expectRelative(byWeight.loglik[1]! / factor, weightedLoglikPerUnit, `weight scale 2^${power}: log likelihood`);
      expectRelative(byWeight.score / factor, base.score, `weight scale 2^${power}: score`);
      expectRelative(byWeight.var[0]![0]! * factor, base.var[0]![0]!, `weight scale 2^${power}: variance`);
    }
  });

  it("keeps the joint Wald test invariant when one covariate is rescaled by 2^30", () => {
    const a = fixture.cases[55]!.args as RawArgs;
    const start = vector(a.start);
    const stop = vector(a.stop);
    const status = vector(a.status);
    const scaledX = (a.x as string[][]).map((row) => row.map(num));
    const unscaledX = scaledX.map((row) => [row[0]! / 2 ** 30, row[1]!]);
    const base = coxph(stop, status, unscaledX, { start });
    const scaled = coxph(stop, status, scaledX, { start });
    expectRelative(scaled.coefficients[0]! * 2 ** 30, base.coefficients[0]!, "case 55 coefficient x1");
    expectRelative(scaled.var[0]![0]! * 2 ** 60, base.var[0]![0]!, "case 55 variance x1");
    expectRelative(scaled.var[0]![1]! * 2 ** 30, base.var[0]![1]!, "case 55 covariance x1,x2");
    expectRelative(scaled.wald, base.wald, "case 55 joint Wald statistic");
    expectRelative(scaled.waldtest.statistic, base.waldtest.statistic, "case 55 joint Wald test");
  });

  it("uses zero for aliased coefficients in counting-process linear predictors", () => {
    const x1 = [0.2, -0.7, 1.1, 0.5, -1.3, 0.9, -0.1, 0.4];
    const x = x1.map((v) => [v, 2 * v]);
    const fit = coxph(
      [1, 2, 3, 4, 5, 6, 7, 8],
      [1, 0, 1, 0, 1, 0, 1, 0],
      x,
      { start: Array(8).fill(0), init: [0.2, 0.3] },
    );
    expect(fit.coefficients.some(Number.isNaN)).toBe(true);
    const beta = fit.coefficients.map((v) => (Number.isNaN(v) ? 0 : v));
    const centre = beta.reduce((sum, v, j) => sum + v * fit.means[j]!, 0);
    fit.linearPredictors.forEach((value, i) => {
      const expected = x[i]!.reduce((sum, v, j) => sum + v * beta[j]!, 0) - centre;
      expect(value).toBeCloseTo(expected, 12);
    });
  });

  it("honors control.timefix for right-censored event times", () => {
    const time = [1, 1 + 1e-9, 2, 3];
    const status = [1, 1, 0, 1];
    const x = [[0], [1], [0], [2]];
    const merged = coxph(time, status, x);
    const separate = coxph(time, status, x, { control: { timefix: false } });
    expect(separate.loglik[1]).not.toBe(merged.loglik[1]);
  });

  it("validates interval ordering and option lengths", () => {
    expect(() => coxph([2], [1], [[1]], { start: [2] })).toThrow(RangeError);
    expect(() => coxph([2], [2], [[1]], { start: [2] })).toThrow(RangeError);
    expect(() => coxph([2], [1], [[1]], { start: [0, 1] })).toThrow(RangeError);
    expect(() => coxph([2], [1], [[1]], { start: [0], id: ["a", "b"] })).toThrow(RangeError);
    expect(() => coxph([2], [1], [[1]], { start: [0], control: { timefix: 1 as unknown as boolean } })).toThrow(TypeError);
    expect(() => coxph([2], [1], [[1]], { start: [0], control: { timefix: null as unknown as boolean } })).toThrow(TypeError);
    expect(() => coxph([2], [1], [[1]], { start: [0], unknownOption: true } as CoxphOptions)).toThrow(RangeError);
    expect(() => coxph([2], [1], [[1]], { start: [0], control: { unknownOption: true } as NonNullable<CoxphOptions["control"]> })).toThrow(RangeError);
  });
});

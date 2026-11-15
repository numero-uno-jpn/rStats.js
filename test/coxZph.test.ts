// Cox proportional-hazards diagnostics against oracle/coxzph.R and oracle/coxph2-behaviour.md, part A.
import { describe, expect, it } from "vitest";
import { coxph, coxZph, type CoxphOptions, type CoxZphOptions } from "../src/index.js";
import { Comparison, loadAnovaFixture } from "./helpers/anova.js";
import { num } from "./helpers/fixture.js";

const fixture = loadAnovaFixture("coxZph");

function expectRelative(actual: number, expected: number, what: string): void {
  const scale = Math.abs(actual) + Math.abs(expected);
  expect(scale === 0 ? 0 : Math.abs(actual - expected) / scale, `${what}: actual ${actual}, expected ${expected}`).toBeLessThan(1e-12);
}

const known = [
  ...["x1", "x2", "GLOBAL"].map((row) => ({
    case: 48,
    table: "chisq",
    row,
    col: "",
    reason: "R's identity transform overflows g^2 at times scaled by 2^600; the reference is the same score test after exact power-of-two scaling of g.",
  })),
  ...["x1", "x2", "GLOBAL"].map((row) => ({
    case: 48,
    table: "p",
    row,
    col: "",
    reason: "R's identity transform overflows g^2 at times scaled by 2^600; the reference is the same score test after exact power-of-two scaling of g.",
  })),
];

const functions: Record<string, (times: readonly number[]) => readonly number[]> = {
  sqrt: (times) => times.map(Math.sqrt),
  square: (times) => times.map((t) => t * t),
  constant: (times) => times.map(() => 1),
  exp1000: (times) => times.map((t) => Math.exp(1000 * t)),
};

/** The columns of x in the order of R's model: the terms of assign one after another (the given order without assign) */
function columnOrder(a: Record<string, unknown>, p: number): number[] {
  return a.assign === undefined ? Array.from({ length: p }, (_, j) => j) : (a.assign as string[][]).flat().map((v) => num(v) - 1);
}

function fixtureOptions(a: Record<string, unknown>): { fit: CoxphOptions; zph: CoxZphOptions } {
  const fit: CoxphOptions = {
    ...(a.start === undefined ? {} : { start: (a.start as string[]).map(num) }),
    ...(a.weights === undefined ? {} : { weights: (a.weights as string[]).map(num) }),
    ...(a.strata === undefined ? {} : { strata: a.strata as string[] }),
    ...(a.cluster === undefined ? {} : { cluster: a.cluster as string[] }),
    ...(a.ties === undefined ? {} : { ties: a.ties as "efron" | "breslow" }),
    ...(a.init === undefined ? {} : { init: (a.init as string[]).map(num) }),
    ...(a["iter.max"] === undefined ? {} : { control: { iterMax: num(a["iter.max"] as string) } }),
    ...(a.robust === undefined ? {} : { robust: a.robust as boolean }),
  };
  let terms: CoxZphOptions["terms"];
  let collapseTerms: boolean | undefined;
  if (a.assign !== undefined) {
    // R's oracle builds the model from the terms in order (assign = grp(c(1, 3), 2) gives the columns x1, x3, x2), so
    // the fit's columns are the given ones reordered term by term (see columnOrder) and each term is contiguous
    let next = 0;
    terms = (a.assign as string[][]).map((g) => g.map(() => next++));
    if (a.terms === false) collapseTerms = false;
  } else if (a.terms === false) {
    terms = false;
  }
  const transform = a.transformFn === undefined
    ? (a.transform as CoxZphOptions["transform"] | undefined)
    : functions[a.transformFn as string];
  const zph: CoxZphOptions = {
    ...(transform === undefined ? {} : { transform }),
    ...(terms === undefined ? {} : { terms }),
    ...(collapseTerms === undefined ? {} : { collapseTerms }),
    ...(a.global === undefined ? {} : { global: a.global as boolean }),
  };
  return { fit, zph };
}

describe("coxZph", () => {
  it("matches all fixture cases, references, and selected errors", () => {
    const cmp = new Comparison(known);
    fixture.cases.forEach((c, index) => {
      const a = c.args as Record<string, unknown>;
      const e = c.expected as Record<string, unknown>;
      const { fit: fitOptions, zph: zphOptions } = fixtureOptions(a);
      const time = (a.time as string[]).map(num);
      const status = (a.status as string[]).map(num);
      const x0 = (a.x as string[][]).map((row) => row.map(num));
      const order = columnOrder(a, x0[0]?.length ?? 0);
      const x = x0.map((row) => order.map((j) => row[j]!));
      const fit = coxph(time, status, x, fitOptions);
      cmp.numbers(index, "coef", e.coef, fit.coefficients);
      cmp.numbers(index, "nevent", [e.nevent], [fit.nevent]);

      if (index === 46 || index === 47 || index === 54 || index === 55 || index === 56 || index === 57 ||
          index === 58 || index === 59 || index === 61) {
        expect(() => coxZph(fit, zphOptions)).toThrow();
        return;
      }

      const zphResult = coxZph(fit, zphOptions);
      // Row names number the columns of the fit (x<k>); read them as the given columns R's oracle names
      const result = { ...zphResult, rowNames: zphResult.rowNames.map((n) => n.replace(/x(\d+)$/, (_, k: string) => `x${order[Number(k) - 1]! + 1}`)) };
      if (index === 51) {
        const ref = e.reference as Record<string, unknown>;
        cmp.strings(index, "rowNames", ref.rowNames, result.rowNames);
        cmp.numbers(index, "chisq", ref.chisq, result.chisq);
        cmp.numbers(index, "df", ref.df, result.df);
        cmp.numbers(index, "p", ref.p, result.p);
        return;
      }
      const ref = c.reference as Record<string, unknown> | undefined;
      cmp.strings(index, "rowNames", e.rowNames, result.rowNames);
      cmp.numbers(index, "chisq", e.chisq, result.chisq, ref?.chisq, e.rowNames as string[]);
      cmp.numbers(index, "df", e.df, result.df);
      cmp.numbers(index, "p", e.p, result.p, ref?.p, e.rowNames as string[]);
      cmp.numbers(index, "x", e.x, result.x);
      cmp.numbers(index, "time", e.time, result.time);
      cmp.strings(index, "strata", e.strata, result.strata);
      const expectedY = e.y as string[][];
      const actualY = result.y;
      const yColumns = expectedY[0]?.length ?? 0;
      const yScales = Array.from({ length: yColumns }, (_, j) =>
        Math.max(0, ...expectedY.map((row) => Math.abs(num(row[j]))).filter(Number.isFinite)),
      );
      cmp.numbers(index, "y", e.y, result.y, undefined, undefined, undefined, undefined, false, yScales);
      const expectedVar = e.var as string[][];
      const q = expectedVar.length;
      const varScales = Array.from({ length: q * q }, (_, cell) => {
        const i = Math.floor(cell / q);
        const j = cell % q;
        const vi = Math.abs(num(expectedVar[i]![i]!));
        const vj = Math.abs(num(expectedVar[j]![j]!));
        return Math.sqrt(vi) * Math.sqrt(vj);
      });
      cmp.numbers(index, "var", e.var, result.var, undefined, undefined, undefined, undefined, false, varScales);
      cmp.strings(index, "warnings", e.warnings, result.warnings);
    });
    console.log(cmp.summary("coxZph", fixture.cases.length, fixture.cases.filter((c, i) => c.expected.error !== undefined && i !== 51).length));
    expect(cmp.used.size).toBe(6);
    expect(cmp.failures, cmp.failures.slice(0, 40).join("\n")).toEqual([]);
  });

  it("keeps coxZph results invariant when a covariate is rescaled by 2^40", () => {
    const baseArgs = fixture.cases[0]!.args as Record<string, unknown>;
    const scaledArgs = fixture.cases[51]!.args as Record<string, unknown>;
    const makeFit = (a: Record<string, unknown>) => {
      const time = (a.time as string[]).map(num);
      const status = (a.status as string[]).map(num);
      const x0 = (a.x as string[][]).map((row) => row.map(num));
      const order = columnOrder(a, x0[0]?.length ?? 0);
      const x = x0.map((row) => order.map((j) => row[j]!));
      return coxph(time, status, x, fixtureOptions(a).fit);
    };
    const baseFit = makeFit(baseArgs);
    const scaledFit = makeFit(scaledArgs);
    const base = coxZph(baseFit, fixtureOptions(baseArgs).zph);
    const scaled = coxZph(scaledFit, fixtureOptions(scaledArgs).zph);
    const factor = 2 ** 40;
    expect(scaled.rowNames).toEqual(base.rowNames);
    expect(scaled.time).toEqual(base.time);
    expect(scaled.x).toEqual(base.x);
    scaled.chisq.forEach((v, i) => expectRelative(v, base.chisq[i]!, `2^40 covariate scale: chisq[${i}]`));
    scaled.p.forEach((v, i) => expectRelative(v, base.p[i]!, `2^40 covariate scale: p[${i}]`));
    const yScale0 = Math.max(...base.y.map((row) => Math.abs(row[0]!)));
    const yScale1 = Math.max(...base.y.map((row) => Math.abs(row[1]!)));
    scaled.y.forEach((row, i) => {
      expect(Math.abs(row[0]! - base.y[i]![0]!) / yScale0, `2^40 covariate scale: y[${i},0]`).toBeLessThan(1e-12);
      expect(Math.abs(row[1]! * factor - base.y[i]![1]!) / yScale1, `2^40 covariate scale: y[${i},1]`).toBeLessThan(1e-12);
    });
    const vScale01 = Math.sqrt(Math.abs(base.var[0]![0]!)) * Math.sqrt(Math.abs(base.var[1]![1]!));
    expectRelative(scaled.var[0]![0]!, base.var[0]![0]!, "2^40 covariate scale: var[0,0]");
    expect(Math.abs(scaled.var[0]![1]! * factor - base.var[0]![1]!) / vScale01, "2^40 covariate scale: var[0,1]").toBeLessThan(1e-12);
    expectRelative(scaled.var[1]![1]! * factor * factor, base.var[1]![1]!, "2^40 covariate scale: var[1,1]");
  });

  it("restores the case-weight scale in the Schoenfeld score tests", () => {
    const time = [1, 2, 3, 4, 5, 6, 7, 8];
    const status = [1, 0, 1, 0, 1, 0, 1, 0];
    const x = [[0], [1], [0], [1], [2], [1], [2], [0]];
    const baseFit = coxph(time, status, x);
    const base = coxZph(baseFit);

    // Large weights exercise weightExp restoration for chi-square and variance. At 2^70, however,
    // y - beta is smaller than one ulp of beta, so adding it to beta necessarily rounds it away.
    const multiplier = 2 ** 70;
    const weightedFit = coxph(time, status, x, {
      weights: Array(time.length).fill(multiplier),
      robust: false,
    });
    const weighted = coxZph(weightedFit);
    expectRelative(weighted.chisq[0]! / multiplier, base.chisq[0]!, "weighted coxZph term chi-square");
    expectRelative(weighted.chisq[1]! / multiplier, base.chisq[1]!, "weighted coxZph global chi-square");
    expectRelative(weighted.var[0]![0]! * multiplier, base.var[0]![0]!, "weighted coxZph variance");
    weighted.y.forEach((row, i) => {
      expectRelative(row[0]!, weightedFit.coefficients[0]!, `weighted coxZph y[${i}] rounds to beta at 2^70 weights`);
    });

    // A moderate multiplier keeps y - beta representable, so its inverse-weight scaling can be checked directly.
    const yMultiplier = 2 ** 5;
    const yFit = coxph(time, status, x, {
      weights: Array(time.length).fill(yMultiplier),
      robust: false,
    });
    const yWeighted = coxZph(yFit);
    const baseY = base.y.map((row) => row[0]! - baseFit.coefficients[0]!);
    const weightedY = yWeighted.y.map((row) => (row[0]! - yFit.coefficients[0]!) * yMultiplier);
    const yScale = Math.max(...baseY.map(Math.abs));
    baseY.forEach((v, i) => {
      expect(Math.abs(weightedY[i]! - v) / yScale, `moderately weighted coxZph y[${i}]`).toBeLessThan(1e-12);
    });
  });

  it("keeps the processed fit data non-enumerable", () => {
    const fit = coxph(
      [1, 2, 3, 4, 5, 6, 7, 8],
      [1, 0, 1, 0, 1, 0, 1, 0],
      [[0], [1], [0], [1], [2], [1], [2], [0]],
    );
    expect(Object.keys(fit)).not.toContain("coxZphData");
    expect(coxZph(fit).rowNames).toEqual(["x1", "GLOBAL"]);
  });

  it("calls a custom transform once with all used rows and rejects unsupported singledf", () => {
    const time = [1, 2, 3, 4, 5, 6, 7, 8];
    const fit = coxph(
      time,
      [1, 0, 1, 0, 1, 0, 1, 0],
      [[0], [1], [0], [1], [2], [1], [2], [0]],
    );
    const calls: number[][] = [];
    const result = coxZph(fit, {
      transform: (times) => {
        calls.push(Array.from(times));
        return times.map(Math.sqrt);
      },
    });
    expect(calls).toEqual([time]);
    expect(result.x).toHaveLength(4);
    expect(() => coxZph(fit, { singledf: true } as unknown as CoxZphOptions)).toThrow(RangeError);
    expect(() => coxZph(fit, { transform: () => Array(8).fill(0.1) })).toThrow("the transform is constant at the event times");
  });

  it("rejects a transform function with the wrong length", () => {
    const fit = coxph(
      [1, 2, 3, 4, 5, 6, 7, 8],
      [1, 0, 1, 0, 1, 0, 1, 0],
      [[0], [1], [0], [1], [2], [1], [2], [0]],
    );
    expect(() => coxZph(fit, { transform: (times) => times.slice(1) })).toThrow(RangeError);
  });
});

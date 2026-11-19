import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  nls,
  nlsAnova,
  nlsConfint,
  nlsPredict,
  nlsSummary,
  nlsVcov,
} from "../src/entries/regression.js";
import { qf } from "../src/distributions/f.js";
import type { DataFrame } from "../src/models/modelFrame.js";
import { evaluateNlsWithGradient, parseNlsFormula, evaluateNlsExpression } from "../src/models/nlsFormula.js";

interface PublicFit {
  coefficients: Record<string, number>;
  summary: { rows: string[]; cols: string[]; values: number[][] };
  sigma: number;
  deviance: number;
  dfResidual: number;
  fitted: number[];
  residuals: number[];
}
interface Case {
  id: string;
  formula: string;
  data: Record<string, number[]>;
  args: {
    start?: Record<string, number>;
    algorithm?: "plinear" | "port";
    lower?: number[];
    upper?: number[];
    weights?: string;
    control?: { maxiter?: number; tol?: number; minFactor?: number; warnOnly?: boolean; scaleOffset?: number };
  };
  fit: { value?: PublicFit; error?: string };
  fitTight?: { value?: PublicFit; error?: string };
  newdata?: Record<string, number[]>;
  predict?: { value?: number[] };
  confint?: Record<string, { value?: { rows?: string[]; cols?: string[] | null; values?: number[][] } }>;
}
interface Fixture {
  cases: Case[];
  anova?: { data: Record<string, number[]>; models: { formula: string; start: Record<string, number> }[]; result: { value: { table: Record<string, (string | number)[]> } } };
}

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("../test/fixtures/nls.json", import.meta.url)), "utf8")) as Fixture;
const stage3Fixture = JSON.parse(readFileSync(fileURLToPath(new URL("../test/fixtures/nls-stage3.json", import.meta.url)), "utf8")) as {
  thurber: { formula: string; data: Record<string, number[]>; start: Record<string, number>; certified: Record<string, number>; rss: number };
  roszman1: { formula: string; data: Record<string, number[]>; start: Record<string, number>; certified: Record<string, number>; rss: number };
  nelson: { formula: string; data: Record<string, number[]>; start: Record<string, number>; certified: Record<string, number>; rss: number };
  eckerle4: { formula: string; data: Record<string, number[]>; start: Record<string, number>; certified: Record<string, number>; rss: number };
  lanczos1: { formula: string; data: Record<string, number[]>; start: Record<string, number>; certified: Record<string, number>; rss: number };
  misra1a: { formula: string; data: Record<string, number[]>; start: Record<string, number>; certified: Record<string, number>; rss: number };
  gauss1: { formula: string; data: Record<string, number[]>; start: Record<string, number>; certified: Record<string, number>; rss: number };
};
const byId = (id: string): Case => {
  const found = fixture.cases.find(x => x.id === id);
  if (!found) throw new Error("missing nls fixture: " + id);
  return found;
};
const dataFrame = (data: Record<string, number[]>): DataFrame => data;

function fitCase(id: string) {
  const cs = byId(id);
  return nls(cs.formula, dataFrame(cs.data), {
    ...(cs.args.start === undefined ? {} : { start: cs.args.start }),
    ...(cs.args.algorithm === undefined ? {} : { algorithm: cs.args.algorithm }),
    ...(cs.args.lower === undefined ? {} : { lower: cs.args.lower }),
    ...(cs.args.upper === undefined ? {} : { upper: cs.args.upper }),
    ...(cs.args.weights === undefined ? {} : { weights: cs.args.weights }),
    ...(cs.args.control === undefined ? {} : { control: cs.args.control }),
  });
}

function compareCoefficients(actual: Record<string, number>, expected: Record<string, number>) {
  expect(Object.keys(actual)).toEqual(Object.keys(expected));
  for (const name of Object.keys(expected)) expect(actual[name]).toBeCloseTo(expected[name]!, 6);
}

describe("nonlinear least-squares regression", () => {
  it.each(["puromycin-default", "puromycin-port", "puromycin-weights"])("fits %s to the tight public reference", id => {
    const cs = byId(id);
    const fit = fitCase(id);
    const ref = cs.fitTight?.value ?? cs.fit.value!;
    compareCoefficients(fit.coefficients, ref.coefficients);
    expect(fit.deviance).toBeCloseTo(ref.deviance, 6);
    expect(fit.converged).toBe(true);
    expect(fit.dfResidual).toBe(ref.dfResidual);
    expect(fit.fitted.length).toBe(ref.fitted.length);
    for (let i = 0; i < ref.fitted.length; i++) expect(fit.fitted[i]).toBeCloseTo(ref.fitted[i]!, 6);
  });

  it("profiles the linear amplitude for the plinear algorithm", () => {
    const cs = byId("puromycin-plinear");
    const fit = fitCase(cs.id);
    const ref = cs.fitTight?.value ?? cs.fit.value!;
    compareCoefficients(fit.coefficients, ref.coefficients);
    expect(fit.deviance).toBeCloseTo(ref.deviance, 6);
    expect(fit.coefficients[".lin"]).toBeGreaterThan(0);
  });

  it("returns the complete summary and covariance dimensions", () => {
    const fit = fitCase("puromycin-default");
    const summary = nlsSummary(fit);
    expect(summary.coefficients.rows).toEqual(["Vm", "K"]);
    expect(summary.coefficients.cols).toEqual(["Estimate", "Std. Error", "t value", "Pr(>|t|)"]);
    expect(summary.coefficients.values).toHaveLength(2);
    expect(summary.coefficients.values[0]).toHaveLength(4);
    expect(nlsVcov(fit)).toHaveLength(2);
    expect(nlsVcov(fit)[0]).toHaveLength(2);
  });

  it("predicts new observations and applies the plinear coefficient", () => {
    const cs = byId("puromycin-default");
    const fit = fitCase(cs.id);
    const predicted = nlsPredict(fit, { newdata: cs.newdata! });
    const newConc = cs.newdata!.conc!;
    expect(predicted).toHaveLength(newConc.length);
    for (let i = 0; i < predicted.length; i++) {
      const expected = fit.coefficients.Vm! * newConc[i]! / (fit.coefficients.K! + newConc[i]!);
      expect(predicted[i]).toBeCloseTo(expected, 12);
    }

    const linear = fitCase("puromycin-plinear");
    const linearCase = byId("puromycin-plinear");
    const linearPredicted = nlsPredict(linear, { newdata: linearCase.newdata! });
    for (let i = 0; i < linearPredicted.length; i++) {
      const x = linearCase.newdata!.conc![i]!;
      const expected = linear.coefficients[".lin"]! * x / (linear.coefficients.K! + x);
      expect(linearPredicted[i]).toBeCloseTo(expected, 12);
    }
  });

  it("uses deterministic self-start values and converges for Michaelis-Menten", () => {
    const fit = fitCase("puromycin-SSmicmen");
    const ref = byId("puromycin-SSmicmen").fitTight?.value ?? byId("puromycin-SSmicmen").fit.value!;
    compareCoefficients(fit.coefficients, ref.coefficients);
  });


  it("fits every successful fixture case against the tight reference", () => {
    // fitTight is R refitted to its own solution, so the comparison is relative and strict: rStats.js agrees to
    // about 1e-8 in the coefficients and 5e-8 in the standard errors (oracle/nls-behaviour.md, choices 1 and 4).
    // R's default fit is further away (up to 4e-6), so its distance is no guide to the tolerance here.
    const cases = fixture.cases.filter(cs => cs.fitTight?.value !== undefined && cs.id !== "maxiter-warnOnly");
    const relative = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), Number.MIN_VALUE);
    const mismatches: string[] = [];
    for (const cs of cases) {
      try {
        const fit = fitCase(cs.id);
        const ref = cs.fitTight!.value!;
        for (const name of Object.keys(ref.coefficients)) {
          const actual = fit.coefficients[name];
          const expected = ref.coefficients[name]!;
          if (actual === undefined || relative(actual, expected) > 1e-7) {
            mismatches.push(`${cs.id}: coefficient ${name} (${actual} vs ${expected})`);
          }
        }
        if (fit.dfResidual !== ref.dfResidual) mismatches.push(`${cs.id}: residual df`);
        if (fit.fitted.length !== ref.fitted.length) mismatches.push(`${cs.id}: fitted length`);
        for (let i = 0; i < ref.fitted.length; i++) {
          if (relative(fit.fitted[i]!, ref.fitted[i]!) > 1e-7) mismatches.push(`${cs.id}: fitted[${i}]`);
        }
        // The data of exact-scaleOffset are exactly 2 exp(0.3 x): R's tight fit stops with a residual sum of squares
        // near 4e-23, which is rounding, so its deviance, sigma and standard errors are not compared (choice 6).
        if (cs.id === "exact-scaleOffset") continue;
        if (relative(fit.deviance, ref.deviance) > 1e-10) mismatches.push(`${cs.id}: deviance (${fit.deviance} vs ${ref.deviance})`);
        if (relative(fit.sigma, ref.sigma) > 1e-10) mismatches.push(`${cs.id}: sigma (${fit.sigma} vs ${ref.sigma})`);
        const actualSummary = nlsSummary(fit).coefficients;
        for (const name of Object.keys(ref.coefficients)) {
          const actualSe = actualSummary.values[actualSummary.rows.indexOf(name)]![1]!;
          const tightSe = ref.summary.values[ref.summary.rows.indexOf(name)]![1]!;
          if (relative(actualSe, tightSe) > 2e-7) mismatches.push(`${cs.id}: SE ${name} (${actualSe} vs ${tightSe})`);
        }
      } catch (error) {
        mismatches.push(`${cs.id}: threw ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("handles all documented error and exact-fit boundary cases", () => {
    const errorIds = [
      "error-no-start", "error-singular-start", "error-singular-gradient",
      "error-maxiter", "error-algorithm", "error-port-start-outside", "error-too-few-rows",
    ];
    for (const id of errorIds) {
      const cs = byId(id);
      expect(() => fitCase(id), id).toThrow();
    }
    const exact = fitCase("error-exact-fit");
    expect(exact.converged).toBe(true);
    expect(exact.exactFit).toBe(true);
    expect(exact.covariance.flat().every(Number.isNaN)).toBe(true);
    const warnOnly = fitCase("maxiter-warnOnly");
    expect(warnOnly.converged).toBe(false);
    expect(warnOnly.warnings.length).toBeGreaterThan(0);
    const na = fitCase("puromycin-na-row");
    expect(na.nobs).toBe(11);
  });

  it("finds the exact profile roots, which R's interpolated endpoints approximate", () => {
    // An endpoint c of theta_j is where the deviance minimised over the other parameters exceeds the minimum by
    // sigma^2 F(1, df). The constrained refit holds theta_j at c with equal port bounds; for plinear the linear
    // coefficient becomes an ordinary parameter. R interpolates a traced profile, so its endpoints are only
    // compared loosely (they are off by up to 4.7e-3; oracle/nls-behaviour.md, choice 5).
    const cases = fixture.cases.filter(cs => cs.confint?.profile95?.value !== undefined);
    expect(cases.length).toBe(9);
    const mismatches: string[] = [];
    for (const cs of cases) {
      const fit = fitCase(cs.id);
      const plinear = cs.args.algorithm === "plinear";
      const [lhs, rhs] = cs.formula.split("~").map(part => part.trim());
      const formula = plinear ? `${lhs} ~ linCoef * (${rhs})` : cs.formula;
      const estimate: Record<string, number> = { ...fit.coefficients };
      if (plinear) { estimate.linCoef = estimate[".lin"]!; delete estimate[".lin"]; }
      for (const level of ["profile95", "profile90"] as const) {
        const expected = cs.confint![level]!.value!;
        const probability = level === "profile95" ? 0.95 : 0.9;
        const conf = nlsConfint(fit, { method: "profile", level: probability });
        const target = fit.sigma * fit.sigma * qf(probability, 1, fit.dfResidual);
        for (let i = 0; i < conf.rows.length; i++) {
          const name = conf.rows[i]!;
          // R returns a named vector, not a matrix, for a single parameter.
          const rRow = expected.cols === null ? expected.values!.map(v => v[0]!) : expected.values![expected.rows!.indexOf(name)]!;
          for (const side of [0, 1]) {
            const endpoint = conf.values[i]![side]!;
            const label = `${cs.id} ${level} ${name} ${side ? "upper" : "lower"}`;
            if (!Number.isFinite(endpoint)) { mismatches.push(`${label}: not finite`); continue; }
            if (Math.abs(endpoint - rRow[side]!) > 1e-2 * Math.abs(rRow[side]!)) mismatches.push(`${label}: ${endpoint} vs R ${rRow[side]}`);
            const bound = (value: number) => Object.fromEntries(Object.keys(estimate).map(k => [k, k === name ? endpoint : value]));
            const refit = nls(formula, dataFrame(cs.data), {
              start: { ...estimate, [name]: endpoint }, algorithm: "port", lower: bound(-Infinity), upper: bound(Infinity),
              ...(cs.args.weights === undefined ? {} : { weights: cs.args.weights }),
            });
            const excess = (refit.deviance - fit.deviance) / target;
            if (Math.abs(excess - 1) > 1e-6) mismatches.push(`${label}: deviance excess ${excess} of the target`);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("matches the nested-model ANOVA fixture", () => {
    const oracle = fixture.anova!;
    const fits = oracle.models.map(model => nls(model.formula, dataFrame(oracle.data), { start: model.start }));
    const result = nlsAnova(...fits);
    const expected = oracle.result.value.table;
    for (const key of Object.keys(expected)) {
      const actual = result.table[key as keyof typeof result.table];
      expect(actual.length).toBe(expected[key]!.length);
      for (let i = 0; i < actual.length; i++) {
        const e = expected[key]![i]!;
        if (typeof e === "number" && typeof actual[i] === "number") expect(actual[i]).toBeCloseTo(e, 6);
        else expect(actual[i]).toBe(e);
      }
    }
  });

  it("rejects missing starts for an ordinary formula and an invalid algorithm", () => {
    const cs = byId("error-no-start");
    expect(() => nls(cs.formula, dataFrame(cs.data))).toThrow(/start must be supplied/);
    const valid = byId("puromycin-default");
    expect(() => nls(valid.formula, dataFrame(valid.data), { start: valid.args.start!, algorithm: "bogus" as "default" })).toThrow(/unsupported algorithm/);
  });
});


describe("nonlinear expression derivatives and constants", () => {
  it("differentiates constant powers with negative bases without evaluating log(base)", () => {
    const expression = parseNlsFormula("y ~ a + b*x^2 + c*x").expression;
    const result = evaluateNlsWithGradient(expression, { x: -2 }, { a: 1, b: 2, c: 3 }, ["a", "b", "c"]);
    expect(result.value).toBe(3);
    expect(result.gradient).toEqual([1, 4, -2]);
  });

  it("supports atan, asin and acos with analytic derivatives", () => {
    const atan = parseNlsFormula("y ~ atan(b/(x-c))").expression;
    const asin = parseNlsFormula("y ~ asin(b*x)").expression;
    const acos = parseNlsFormula("y ~ acos(b*x)").expression;
    for (const [expression, data, parameters] of [
      [atan, { x: -2 }, { b: 1, c: 0 }],
      [asin, { x: 0.25 }, { b: 1 }],
      [acos, { x: 0.25 }, { b: 1 }],
    ] as const) {
      const result = evaluateNlsWithGradient(expression, data, parameters, Object.keys(parameters));
      expect(Number.isFinite(result.value)).toBe(true);
      expect(result.gradient.every(Number.isFinite)).toBe(true);
    }
  });

  it("uses the mathematical constant pi unless a data column shadows it", () => {
    const expression = parseNlsFormula("y ~ x/pi").expression;
    expect(evaluateNlsExpression(expression, { x: 1 }, {})).toBeCloseTo(1 / Math.PI, 15);
    expect(evaluateNlsExpression(expression, { x: 1, pi: 2 }, {})).toBe(0.5);
    expect(evaluateNlsExpression(expression, { x: 1, pi: 2 }, { pi: 3 })).toBe(0.5);
    const fit = nls("y ~ a*x/pi", { y: [2, 4], x: [1, 2], pi: [2, 2] }, { start: { a: 4, pi: 3 } });
    expect(fit.coefficients.a).toBe(4);
    expect(fit.fitted).toEqual([2, 4]);
  });
});


describe("NIST StRD nonlinear regression edge cases", () => {
  it("fits Thurber from Start 2 to at least seven certified digits", () => {
    const cs = stage3Fixture.thurber;
    const fit = nls(cs.formula, dataFrame(cs.data), { start: cs.start });
    const lre: Record<string, number> = {};
    for (const [name, expected] of Object.entries(cs.certified)) {
      const relativeError = Math.abs(fit.coefficients[name]! - expected) / Math.abs(expected);
      lre[name] = relativeError === 0 ? Infinity : -Math.log10(relativeError);
      expect(lre[name], "Thurber " + name + " LRE").toBeGreaterThanOrEqual(7);
    }
    console.log("NIST Thurber Start 2 LRE", JSON.stringify(lre));
    expect(fit.deviance).toBeCloseTo(cs.rss, 5);
    expect(fit.converged).toBe(true);
  });

  it("fits Roszman1 with atan and pi to at least seven certified digits", () => {
    const cs = stage3Fixture.roszman1;
    const fit = nls(cs.formula, dataFrame(cs.data), { start: cs.start });
    for (const [name, expected] of Object.entries(cs.certified)) {
      const relativeError = Math.abs(fit.coefficients[name]! - expected) / Math.abs(expected);
      const lre = relativeError === 0 ? Infinity : -Math.log10(relativeError);
      expect(lre, "Roszman1 " + name + " LRE").toBeGreaterThanOrEqual(7);
    }
    console.log("NIST Roszman1 Start 1 LRE", JSON.stringify(Object.fromEntries(Object.entries(cs.certified).map(([name, expected]) => [name, -Math.log10(Math.abs(fit.coefficients[name]! - expected) / Math.abs(expected))]))));
    expect(fit.deviance).toBeCloseTo(cs.rss, 7);
    expect(fit.converged).toBe(true);
  });
});


describe("near-zero residual convergence", () => {
  it("treats scaleOffset and the ordinary exact-fit case identically", () => {
    const offsetFit = fitCase("exact-scaleOffset");
    const exactFit = fitCase("error-exact-fit");
    expect(offsetFit.converged).toBe(true);
    expect(exactFit.converged).toBe(true);
    expect(offsetFit.exactFit).toBe(true);
    expect(exactFit.exactFit).toBe(true);
    expect(offsetFit.coefficients).toEqual(exactFit.coefficients);
    expect(offsetFit.covariance.flat().every(Number.isNaN)).toBe(true);
    expect(exactFit.covariance.flat().every(Number.isNaN)).toBe(true);
  });
});


describe("nonlinear response expressions", () => {
  it("fits log(y) without transforming the returned prediction back", () => {
    const x1 = Array.from({ length: 12 }, (_, i) => 1 + (i % 4));
    const x2 = Array.from({ length: 12 }, (_, i) => 0.2 + 0.3 * Math.floor(i / 4));
    const y = x1.map((value, i) => Math.exp(2.5 - 0.4 * value * Math.exp(0.5 * x2[i]!)));
    const data = { y, x1, x2 };
    const fit = nls("log(y) ~ b1 - b2*x1*exp(-b3*x2)", data, {
      start: { b1: 2.4, b2: 0.3, b3: -0.4 },
    });
    expect(fit.response).toBe("log(y)");
    expect(fit.converged).toBe(true);
    expect(fit.coefficients.b1).toBeCloseTo(2.5, 7);
    expect(fit.coefficients.b2).toBeCloseTo(0.4, 7);
    expect(fit.coefficients.b3).toBeCloseTo(-0.5, 7);
    const predicted = nlsPredict(fit, { newdata: { x1, x2 } });
    for (let i = 0; i < y.length; i++) expect(predicted[i]).toBeCloseTo(Math.log(y[i]!), 10);
  });

  it("fits NIST Nelson on the log response scale to at least seven certified digits", () => {
    const cs = stage3Fixture.nelson;
    const fit = nls(cs.formula, dataFrame(cs.data), { start: cs.start });
    for (const [name, expected] of Object.entries(cs.certified)) {
      const relativeError = Math.abs(fit.coefficients[name]! - expected) / Math.abs(expected);
      const lre = relativeError === 0 ? Infinity : -Math.log10(relativeError);
      expect(lre, "Nelson " + name + " LRE").toBeGreaterThanOrEqual(7);
    }
    console.log("NIST Nelson Start 2 LRE", JSON.stringify(Object.fromEntries(Object.entries(cs.certified).map(([name, expected]) => [name, -Math.log10(Math.abs(fit.coefficients[name]! - expected) / Math.abs(expected))]))));
    expect(fit.deviance).toBeCloseTo(cs.rss, 6);
    expect(fit.converged).toBe(true);
    const predicted = nlsPredict(fit, { newdata: { x1: cs.data.x1!, x2: cs.data.x2! } });
    for (let i = 0; i < predicted.length; i++) expect(predicted[i]).toBeCloseTo(Math.log(cs.data.y![i]!), 6);
  });

  it("rejects parameters in the response expression", () => {
    expect(() => nls("log(y + a) ~ b*x", { y: [1, 2, 3], x: [1, 2, 3] }, {
      start: { a: 1, b: 1 },
    })).toThrow(/response expression must not contain parameters/);
    expect(() => nls("log(y + a) ~ b*x", { y: [1, 2, 3], a: [1, 1, 1], x: [1, 2, 3] }, {
      start: { a: 1, b: 1 },
    })).toThrow(/response expression must not contain parameters/);
  });
});


describe("NIST StRD additional nonlinear cases", () => {
  it.each([
    ["Gauss1", stage3Fixture.gauss1, 7],
    ["Eckerle4", stage3Fixture.eckerle4, 7],
    ["Lanczos1", stage3Fixture.lanczos1, 9],
    ["Misra1a", stage3Fixture.misra1a, 7],
  ] as const)("fits %s from Start 2 to the certified values", (label, cs, minimumLre) => {
    const fit = nls(cs.formula, dataFrame(cs.data), { start: cs.start });
    const lreValues: Record<string, number> = {};
    for (const [name, expected] of Object.entries(cs.certified)) {
      const relativeError = Math.abs(fit.coefficients[name]! - expected) / Math.abs(expected);
      const lre = relativeError === 0 ? Infinity : -Math.log10(relativeError);
      lreValues[name] = lre;
      expect(lre, label + " " + name + " LRE").toBeGreaterThanOrEqual(minimumLre);
    }
    console.log("NIST " + label + " Start 2 LRE", JSON.stringify(lreValues));
    const rssRelativeError = Math.abs(fit.deviance - cs.rss) / Math.max(Math.abs(cs.rss), Number.MIN_VALUE);
    expect(rssRelativeError, label + " RSS").toBeLessThanOrEqual(1e-5);
    expect(fit.converged, label + " converged").toBe(true);
  });
});


describe("nonlinear regression scale equivariance", () => {
  it("scales x and y with the corresponding coefficients and standard errors", () => {
    const conc = [0.02, 0.02, 0.06, 0.06, 0.11, 0.11, 0.22, 0.22, 0.56, 0.56, 1.1, 1.1];
    const rate = [76, 47, 97, 107, 123, 139, 159, 152, 191, 201, 207, 200];
    const base = nls("rate ~ Vm*conc/(K+conc)", { rate, conc }, { start: { Vm: 200, K: 0.05 } });
    const baseSe = nlsSummary(base).coefficients;
    const relative = (actual: number, expected: number) =>
      Math.abs(actual - expected) / Math.max(Math.abs(expected), Number.MIN_VALUE);
    for (const factor of [1e-20, 1e20]) {
      const xFit = nls("rate ~ Vm*conc/(K+conc)", {
        rate, conc: conc.map(value => value * factor),
      }, { start: { Vm: 200, K: 0.05 * factor } });
      expect(relative(xFit.coefficients.Vm, base.coefficients.Vm)).toBeLessThanOrEqual(1e-8);
      expect(relative(xFit.coefficients.K / factor, base.coefficients.K)).toBeLessThanOrEqual(1e-8);
      const xSe = nlsSummary(xFit).coefficients;
      expect(relative(xSe.values[0]![1]!, baseSe.values[0]![1]!)).toBeLessThanOrEqual(1e-8);
      expect(relative(xSe.values[1]![1]! / factor, baseSe.values[1]![1]!)).toBeLessThanOrEqual(1e-8);

      const yFit = nls("rate ~ Vm*conc/(K+conc)", {
        rate: rate.map(value => value * factor), conc,
      }, { start: { Vm: 200 * factor, K: 0.05 } });
      expect(relative(yFit.coefficients.Vm / factor, base.coefficients.Vm)).toBeLessThanOrEqual(1e-8);
      expect(relative(yFit.coefficients.K, base.coefficients.K)).toBeLessThanOrEqual(1e-8);
      const ySe = nlsSummary(yFit).coefficients;
      expect(relative(ySe.values[0]![1]! / factor, baseSe.values[0]![1]!)).toBeLessThanOrEqual(1e-8);
      expect(relative(ySe.values[1]![1]!, baseSe.values[1]![1]!)).toBeLessThanOrEqual(1e-8);
    }
  });
});

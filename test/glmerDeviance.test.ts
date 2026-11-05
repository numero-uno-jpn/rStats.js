// The Laplace deviance of a generalised linear mixed model against the exact conditional mode of oracle/glmerdev.R
// (oracle/glmer-behaviour.md, stage 2a, "Accuracy required"): against the 200-bit reference, deviance, devResid,
// pdev, aic relative 1e-10; ldL2 and ussq absolute 1e-10 × max(1, |value|); u, b, mu, beta each element within
// 1e-9 × the largest absolute element of the reference vector. Against lme4's own (early-stopped) values only a guard
// against gross errors (deviance 1e-4 relative, vectors 1e-3), with the largest differences printed. Also: the
// result does not depend on an earlier evaluation at other parameters.
import { describe, expect, it } from "vitest";
import { glmerDeviance, type GlmerDeviance } from "../src/models/glmerDeviance.js";
import { glmerStructure } from "../src/models/glmerStructure.js";
import { parseFormula } from "../src/models/formula.js";
import { mixedModelStructure } from "../src/models/mixedStructure.js";
import type { GlmFamilyName, GlmLinkName } from "../src/models/glmFamily.js";
import { num } from "./helpers/fixture.js";
import { dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const fixture = loadAnovaFixture("glmerDeviance");

const scaledError = (actual: number, expected: number, scale: number): number => (actual === expected ? 0 : Math.abs(actual - expected) / scale);

const RELATIVE = ["deviance", "devResid", "pdev", "aic"] as const;
const ABSOLUTE = ["ldL2", "ussq"] as const;
const VECTORS = ["u", "b", "mu", "beta"] as const;
type Field = (typeof RELATIVE)[number] | (typeof ABSOLUTE)[number] | (typeof VECTORS)[number];

/** Tolerances against the reference, and the guard against lme4's values */
const TOL_SCALAR = 1e-10;
const TOL_VECTOR = 1e-9;
const GUARD_SCALAR = 1e-4;
const GUARD_VECTOR = 1e-3;

describe("glmerDeviance (glmerDeviance)", () => {
  it(`matches the exact conditional mode (${fixture.r_version})`, () => {
    const failures: string[] = [];
    const worst = new Map<Field, { r: number; ref: number }>();
    const note = (field: Field, r: number, ref: number): void => {
      const w = worst.get(field) ?? { r: 0, ref: 0 };
      worst.set(field, { r: Math.max(w.r, r), ref: Math.max(w.ref, ref) });
    };
    let cells = 0;
    let maxIterations = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const nAGQ = num(a.nAGQ as string) as 0 | 1;
      const s = glmerStructure(a.formula as string, dataFrameOf(a.data, a.dataTypes), {
        family: a.family as GlmFamilyName,
        link: a.link as GlmLinkName,
        nAGQ,
        ...(a.weights === undefined ? {} : { weights: (a.weights as string[]).map((v) => num(v)) }),
        ...(a.offset === undefined ? {} : { offset: (a.offset as string[]).map((v) => num(v)) }),
      });
      const theta = (a.theta as string[]).map((v) => num(v));
      const beta = a.beta === undefined ? undefined : (a.beta as string[]).map((v) => num(v));
      const result: GlmerDeviance = glmerDeviance(s, theta, beta, nAGQ);
      maxIterations = Math.max(maxIterations, result.iterations);
      const e = c.expected;
      const ref = c.reference!;
      const where = `case ${index} (${String(a.formula)}, ${String(a.family)} ${String(a.link)}, nAGQ = ${nAGQ}, theta = ${theta.join(", ")})`;
      const scalar = (f: Field, value: number, absolute: boolean): void => {
        const r = num(e[f] as string);
        const x = num(ref[f] as string);
        const errR = scaledError(value, r, absolute ? Math.max(1, Math.abs(r)) : Math.abs(r));
        const errRef = scaledError(value, x, absolute ? Math.max(1, Math.abs(x)) : Math.abs(x));
        note(f, errR, errRef);
        cells++;
        if (!(errRef <= TOL_SCALAR)) failures.push(`${where} ${f}: reference ${x}, got ${value} (error ${errRef.toExponential(1)})`);
        // (the guard as the document gives it: the deviance only; lme4's ussq and devResid differ by more, 1.4e-4 and
        // 2.6e-5, through its early stop)
        if (f === "deviance" && !(errR <= GUARD_SCALAR)) failures.push(`${where} ${f}: lme4 ${r}, got ${value}`);
      };
      for (const f of RELATIVE) scalar(f, result[f], false);
      for (const f of ABSOLUTE) scalar(f, result[f], true);
      for (const f of VECTORS) {
        const r = (e[f] as string[]).map((v) => num(v));
        const x = (ref[f] as string[]).map((v) => num(v));
        const got = result[f];
        if (got.length !== x.length || r.length !== x.length) {
          failures.push(`${where} ${f}: length ${got.length}, expected ${x.length}`);
          continue;
        }
        const scale = Math.max(...x.map(Math.abs));
        got.forEach((v, k) => {
          const errR = scaledError(v, r[k]!, scale);
          const errRef = scaledError(v, x[k]!, scale);
          note(f, errR, errRef);
          cells++;
          if (!(errRef <= TOL_VECTOR)) failures.push(`${where} ${f}[${k}]: reference ${x[k]}, got ${v} (error ${errRef.toExponential(1)})`);
          if (!(errR <= GUARD_VECTOR)) failures.push(`${where} ${f}[${k}]: lme4 ${r[k]}, got ${v}`);
        });
      }
    });
    const summary = [...worst].map(([f, w]) => `${f} ${w.r.toExponential(1)}/${w.ref.toExponential(1)}`).join(", ");
    console.log(
      `glmerDeviance: ${fixture.cases.length} cases, ${cells} values, at most ${maxIterations} iterations; largest error against lme4/reference: ${summary}`,
    );
    expect(failures, failures.slice(0, 20).join("\n")).toEqual([]);
  });
});

// a small data set: 4 groups of 5
const g = Array.from({ length: 20 }, (_, i) => `g${Math.floor(i / 5) + 1}`);
const h = Array.from({ length: 20 }, (_, i) => `h${(i % 4) + 1}`);
const x = Array.from({ length: 20 }, (_, i) => Math.sin(i + 1));
const s = [1, 0, 2, 3, 1, 4, 2, 0, 1, 3, 2, 2, 5, 1, 0, 3, 1, 2, 4, 2];
const f = [3, 4, 2, 1, 3, 1, 3, 4, 3, 2, 2, 3, 0, 4, 4, 2, 3, 3, 1, 2];
const yn = s.map((v) => (v >= 2 ? "yes" : "no"));
const data = { g, h, x, s, f, yn, cnt: s, pos: s.map((v) => v + 0.5), flag: s.map((v) => v >= 2) };

describe("glmerDeviance: evaluations and the forms of the response", () => {
  it("does not depend on an earlier evaluation", () => {
    for (const nAGQ of [0, 1] as const) {
      const st = glmerStructure("cnt ~ x + (1 | g)", data, { family: "poisson" });
      const first = glmerDeviance(st, [0.8], [0.3, 0.2], nAGQ);
      glmerDeviance(st, [3], [-2, 1], nAGQ);
      expect(glmerDeviance(st, [0.8], [0.3, 0.2], nAGQ)).toEqual(first);
    }
  });

  it("cbind(s, f) is the proportion s/(s + f) with weights s + f (same deviance)", () => {
    const two = glmerStructure("cbind(s, f) ~ x + (1 | g)", data, { family: "binomial" });
    const size = s.map((v, i) => v + f[i]!);
    const prop = glmerStructure("p ~ x + (1 | g)", { ...data, p: s.map((v, i) => v / size[i]!) }, { family: "binomial", weights: size });
    expect(two.y).toEqual(prop.y);
    expect(two.weights).toEqual(prop.weights);
    const a = glmerDeviance(two, [0.7], [-0.4, 0.5]);
    const b = glmerDeviance(prop, [0.7], [-0.4, 0.5]);
    expect(a.deviance).toBeCloseTo(b.deviance, 10);
    expect(a.u).toEqual(b.u);
    // (a binomial with some size above 1: the aic term's binomial coefficients from the sizes)
    expect(two.size).toEqual(size);
  });

  it("cbind() only on the left-hand side with two column names, binomial only; other function calls stay errors", () => {
    expect(() => glmerStructure("cbind(s, f + 1) ~ x + (1 | g)", data, { family: "binomial" })).toThrow(SyntaxError);
    expect(() => glmerStructure("cbind(s) ~ x + (1 | g)", data, { family: "binomial" })).toThrow(SyntaxError);
    expect(() => glmerStructure("s ~ log(x) + (1 | g)", data, { family: "poisson" })).toThrow(/function calls are not supported \(log\)/);
    expect(() => glmerStructure("s ~ cbind(x, x) + (1 | g)", data, { family: "poisson" })).toThrow(SyntaxError);
    expect(() => glmerStructure("cbind(s, f) ~ x + (1 | g)", data, { family: "poisson" })).toThrow(
      new TypeError("can't handle matrix-valued responses: consider using refit()"),
    );
    expect(() => glmerStructure("cbind(s, yn) ~ x + (1 | g)", data, { family: "binomial" })).toThrow(new TypeError("response must be numeric or factor"));
    expect(() => mixedModelStructure("cbind(s, f) ~ x + (1 | g)", data)).toThrow(SyntaxError);
    expect(() => parseFormula("cbind(s, f) ~ x")).toThrow(SyntaxError);
    // `.` stands for the columns other than both of cbind()
    const dot = glmerStructure("cbind(s, f) ~ . + (1 | g)", { s, f, g, x }, { family: "binomial" });
    expect(dot.xColNames).toEqual(["(Intercept)", "gg2", "gg3", "gg4", "x"]);
    // a missing value in the second column drops the row
    const missing = glmerStructure("cbind(s, f) ~ x + (1 | g)", { ...data, f: f.map((v, i) => (i === 3 ? null : v)) }, { family: "binomial" });
    expect(missing.rows).toHaveLength(19);
    expect(missing.rows).not.toContain(3);
  });

  it("strings and factors: the first level is failure (G2), logical TRUE is 1", () => {
    const st = glmerStructure("yn ~ x + (1 | g)", data, { family: "binomial" });
    expect(st.y).toEqual(yn.map((v) => (v === "yes" ? 1 : 0)));
    const rev = glmerStructure("yn ~ x + (1 | g)", data, { family: "binomial", levels: { yn: ["yes", "no"] } });
    expect(rev.y).toEqual(yn.map((v) => (v === "yes" ? 0 : 1)));
    expect(glmerStructure("flag ~ x + (1 | g)", data, { family: "binomial" }).y).toEqual(st.y);
    expect(glmerStructure("flag ~ x + (1 | g)", data, { family: "poisson" }).y).toEqual(st.y);
    expect(() => glmerStructure("yn ~ x + (1 | g)", data, { family: "poisson" })).toThrow(new TypeError("response must be numeric"));
  });

  it("the family and nAGQ: errors first of all", () => {
    expect(() => glmerStructure("cnt ~ x + (1 | g)", data, { family: "quasipoisson" })).toThrow(new RangeError('"quasi" families cannot be used in glmer'));
    expect(() => glmerStructure("cnt ~ x + (1 | g)", data, { family: "quasi" })).toThrow(new RangeError('"quasi" families cannot be used in glmer'));
    // gaussian with the identity link, also the default family (G3)
    expect(() => glmerStructure("x ~ s + (1 | g)", data)).toThrow(/use lmer/);
    expect(() => glmerStructure("x ~ s + (1 | g)", data, { family: "gaussian" })).toThrow(RangeError);
    expect(glmerStructure("pos ~ x + (1 | g)", data, { family: "gaussian", link: "log" }).family.link).toBe("log");
    // a quasi family is reported before an error of the formula
    expect(() => glmerStructure("cnt ~ nothing + (1 | g)", data, { family: "quasibinomial" })).toThrow(/quasi/);
    expect(() => glmerStructure("cnt ~ x + (1 | g)", data, { family: "poisson", nAGQ: -1 })).toThrow(RangeError);
    expect(() => glmerStructure("cnt ~ x + (1 | g)", data, { family: "poisson", nAGQ: 101 })).toThrow(new RangeError("nAGQ <= 100L is not TRUE"));
    expect(glmerStructure("cnt ~ x + (1 | g)", data, { family: "poisson", nAGQ: 7.9 }).nAGQ).toBe(7);
    expect(() => glmerStructure("cnt ~ x + (x | g)", data, { family: "poisson", nAGQ: 2 })).toThrow(
      new RangeError("nAGQ > 1 is only available for models with a single, scalar random-effects term"),
    );
    expect(() => glmerStructure("cnt ~ x + (1 | g) + (1 | h)", data, { family: "poisson", nAGQ: 2 })).toThrow(RangeError);
    // R's second message: several terms of one grouping factor, the first one scalar
    const agq = new RangeError("AGQ only defined for a single scalar random-effects term");
    expect(() => glmerStructure("cnt ~ x + (x || g)", data, { family: "poisson", nAGQ: 2 })).toThrow(agq);
    expect(() => glmerStructure("cnt ~ x + (1 | g) + (x | g)", data, { family: "poisson", nAGQ: 2 })).toThrow(agq);
    expect(() => glmerStructure("cnt ~ x + (x | g) + (1 | g)", data, { family: "poisson", nAGQ: 2 })).toThrow(/only available/);
  });

  it("glmer's checks of the structure", () => {
    // no row left: the first grouping factor in the order of the terms as written
    const none = { ...data, x: x.map(() => null) };
    expect(() => glmerStructure("cnt ~ x + (1 | h) + (1 | g)", none, { family: "poisson" })).toThrow(new RangeError("Invalid grouping factor specification, h"));
    expect(() => glmerStructure("cnt ~ x + (1 | g/h)", none, { family: "poisson" })).toThrow(new RangeError("Invalid grouping factor specification, h:g"));
    // as many levels as rows, and as many random effects as rows, are accepted
    const id = Array.from({ length: 20 }, (_, i) => `r${i}`);
    expect(glmerStructure("cnt ~ x + (1 | id)", { ...data, id }, { family: "poisson" }).q).toBe(20);
    const g10 = Array.from({ length: 20 }, (_, i) => `k${i % 10}`);
    expect(glmerStructure("cnt ~ x + (x | g10)", { ...data, g10 }, { family: "poisson" }).q).toBe(20);
    const g11 = Array.from({ length: 20 }, (_, i) => `k${i % 11}`);
    expect(() => glmerStructure("cnt ~ x + (x | g11)", { ...data, g11 }, { family: "poisson" })).toThrow(
      new RangeError(
        "number of observations (=20) < number of random effects (=22) for term (x | g11); the random-effects parameters are probably unidentifiable",
      ),
    );
  });

  it("the response, the prior weights and the offset", () => {
    expect(() => glmerStructure("cnt ~ x + (1 | g)", data, { family: "poisson", weights: s.map((_, i) => (i === 0 ? -1 : 1)) })).toThrow(
      new RangeError("all(weights >= 0) is not TRUE"),
    );
    expect(() => glmerStructure("cnt ~ x + (1 | g)", data, { family: "poisson", weights: [1, 2] })).toThrow(
      new RangeError("variable lengths differ (found for '(weights)')"),
    );
    expect(() => glmerStructure("cnt ~ x + (1 | g)", data, { family: "poisson", offset: [1, 2] })).toThrow(
      new RangeError("variable lengths differ (found for '(offset)')"),
    );
    // a missing weight or offset drops the row; the offset by column name
    const st = glmerStructure("cnt ~ x + (1 | g)", { ...data, o: x.map((v, i) => (i === 5 ? null : v)) }, {
      family: "poisson",
      weights: s.map((_, i) => (i === 2 ? null : 1)),
      offset: "o",
    });
    expect(st.rows).toEqual(Array.from({ length: 20 }, (_, i) => i).filter((i) => i !== 2 && i !== 5));
    expect(st.offset).toEqual(st.rows.map((i) => x[i]!));
    expect(() => glmerStructure("cnt ~ x + (1 | g)", { ...data, cnt: s.map(() => 2) }, { family: "poisson" })).toThrow(new RangeError("Response is constant"));
    expect(() => glmerStructure("cnt ~ x + (1 | g)", { ...data, cnt: s.map((v, i) => (i === 0 ? Infinity : v)) }, { family: "poisson" })).toThrow(
      new RangeError("NA/NaN/Inf in 'y'"),
    );
    expect(() => glmerStructure("cnt ~ x + (1 | g)", data, { family: "binomial" })).toThrow(new RangeError("y values must be 0 <= y <= 1"));
    expect(() => glmerStructure("x ~ s + (1 | g)", data, { family: "poisson" })).toThrow(new RangeError("negative values not allowed for the 'Poisson' family"));
    expect(glmerStructure("p ~ x + (1 | g)", { ...data, p: s.map((v) => v / 5) }, { family: "binomial" }).warnings).toEqual([
      "non-integer #successes in a binomial glm!",
    ]);
    // Gamma's starting means are the mean of y (lme4)
    const gamma = glmerStructure("pos ~ x + (1 | g)", data, { family: "Gamma", link: "log" });
    const mean = data.pos.reduce((a, b) => a + b, 0) / 20;
    expect(gamma.mustart).toEqual(data.pos.map(() => mean));
    // poisson's aic term warns for non-integer counts (each value's message once)
    const pois = glmerStructure("pos ~ x + (1 | g)", data, { family: "poisson" });
    expect(glmerDeviance(pois, [0.5], [0.4, 0.1]).warnings).toEqual(["non-integer x = 1.500000", "non-integer x = 0.500000", "non-integer x = 2.500000", "non-integer x = 3.500000", "non-integer x = 4.500000", "non-integer x = 5.500000"]);
  });

  it("theta with zeros: the corresponding u are 0 and ldL2 is 0 when Λ = 0", () => {
    const st = glmerStructure("cnt ~ x + (1 | g)", data, { family: "poisson" });
    const r = glmerDeviance(st, [0], [0.3, 0.2]);
    expect(r.u).toEqual([0, 0, 0, 0]);
    expect(r.ldL2).toBe(0);
    expect(() => glmerDeviance(st, [0.5, 1], [0.3, 0.2])).toThrow(RangeError);
    expect(() => glmerDeviance(st, [0.5], [0.3])).toThrow(RangeError);
  });
});

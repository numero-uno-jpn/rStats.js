// lmerTest's Satterthwaite tests (src/models/lmerTest.ts, src/models/mixedDerivatives.ts; oracle/lmertest-behaviour.md
// sections 1 and 2; src/models/lmerAnova.ts) against the fixture lmerTest (oracle/lmertest.R): the summary's
// coefficient table, varpar, vcovVarpar, the contests and the Type III, II and I ANOVA tables (their terms exactly,
// their numbers as the F rows of the contests; the hypothesis matrices are tested in test/lmerHypotheses.test.ts).
//
// Against the reference (the fixture's `reference`, at the exact optimum with exact derivatives; the comparison is on
// as soon as a case has one), as in "Accuracy": df, t, F (and DenDF) and p-values relative 1e-9 (p-values below 1e-300
// absolute); estimates, standard errors and the interval limits within 1e-9 × the largest absolute value of the
// reference vector (as `fixef` and `stdError` in the fixture lmer), sumSq and meanSq relative 1e-9, NumDF equal;
// varpar within 1e-9 × its largest absolute value (as θ and σ in the fixture lmer); vcovVarpar and the Hessian within
// 1e-9 × the largest absolute element of the reference matrix; the Hessian's warnings equal (up to the numbers) to
// those that the rules give with the reference's eigenvalues. Against lmerTest's own values (`expected`), then:
// |library − expected| ≤ 2 |reference − expected| + 1e-8 |expected| for the same numbers.
//
// Until the references are there, lmerTest's values are compared at the point where lmerTest computed them: the
// Satterthwaite quantities are evaluated at lme4's optimum (the fixture's varpar: θ_lme4, with σ from the penalised
// residual sum of squares there, which is lmerTest's σ to rounding), so that the only difference left is lmerTest's
// numerical differentiation (Richardson extrapolation), measured at 2e-8 relative at most for df on these cases:
// df, t, F, DenDF, sumSq and meanSq relative 1e-7, p-values relative 1e-6 (a p-value of 1e-17 moves 30 times as much
// as its df), the estimates and standard errors within 1e-12 × the largest absolute value of the vector (they do not
// involve derivatives), σ relative 1e-12, vcovVarpar within 1e-8 × its largest absolute element, or 2e-5 when an
// element of θ is 0 (where the deviance is even in that element, lmerTest's numerical Hessian is less accurate: about
// 1e-5 on the Hessian's diagonal; that element does not enter the degrees of freedom, as the covariance of β̂ does not
// depend on it there). At the fit's own (exact) optimum the largest relative difference from lmerTest of each field is
// printed, not checked (lme4's optimum is 1e-9 to 1e-5 from the exact one). Names, messages and warnings are compared
// exactly with lmerTest's, except where lmerTest stopped at another local minimum (the criterion at lmerTest's θ, the
// fixture's varpar without σ, computed with the library's own criterion function, above the criterion at the
// reference's θ by more than 1e-6 relative; oracle/report-0.14.0-behaviour.md, section 1): there the messages are
// lmerTest's without the singular-fit message, then that message if the reference is singular (a diagonal element of
// its θ below 1e-4), as in test/lmer.test.ts, and the numbers are the reference's (the comparison with lmerTest's
// values holds trivially there).
//
// Independently of the fixture, the analytic derivatives are checked against Richardson-extrapolated central
// differences of the analytic first derivatives (of d and of the covariance of β̂), within 1e-9 × the largest absolute
// element, on the fixture's models and on larger seeded data (crossed, partially crossed with random slopes, nested,
// random slopes, a || model), at the fit and at a θ away from it.
import { describe, expect, it } from "vitest";
import { lmer, lmerInternals, type LmerOptions, type LmerResult } from "../src/models/lmer.js";
import { varparDerivatives } from "../src/models/mixedDerivatives.js";
import { profiledDeviance } from "../src/models/mixedDeviance.js";
import type { MixedModelStructure } from "../src/models/mixedStructure.js";
import {
  hessianWarnings,
  fTestOf,
  lmerContest,
  lmerSatterthwaite,
  lmerSummary,
  satterthwaiteAt,
  tTestOf,
  type LmerSatterthwaite,
} from "../src/models/lmerTest.js";
import { Warnings } from "../src/models/glmFamily.js";
import { anovaHypotheses, anovaRowsOf, lmerAnova } from "../src/models/lmerAnova.js";
import { num } from "./helpers/fixture.js";
import { dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";
import { generator } from "./helpers/properties.js";

const TOL_REF = 1e-9;
const TOL_EXPECTED = 1e-8;
// at lme4's optimum, against lmerTest (see the header)
const TOL_AT_DF = 1e-7;
const TOL_AT_P = 1e-6;
const TOL_AT_EXACT = 1e-12;
const TOL_AT_VCOV_VARPAR = 1e-8;
const TOL_AT_VCOV_VARPAR_BOUNDARY = 2e-5;
/** lmerTest's criterion above the reference's by more than this (relative): lmerTest stopped at another local minimum */
const TOL_LOCAL = 1e-6;
const SINGULAR_MESSAGE = "boundary (singular) fit: see help('isSingular')";

const fixture = loadAnovaFixture("lmerTest");

type Strings = string[];
interface ContestSpec {
  L: Strings | Strings[];
  rhs?: string;
  joint?: boolean;
  confint?: boolean;
  level?: string;
}
type Rows = Record<string, Strings>;

const nums = (v: unknown): number[] => (v as Strings).map((x) => num(x));
const maxAbs = (v: readonly number[]): number => Math.max(0, ...v.map(Math.abs));
const relative = (a: number, e: number): number => (a === e || (Number.isNaN(a) && Number.isNaN(e)) ? 0 : Math.abs(a - e) / Math.abs(e));
/** The warning texts with the numbers left out */
const withoutNumbers = (w: readonly string[]): string[] => w.map((s) => s.replace(/-?\d\.\de[+-]\d\d/g, "#"));

function optionsOf(a: Record<string, unknown>): LmerOptions {
  const o: LmerOptions = { REML: a.REML === true };
  if (a.contrasts !== undefined) o.contrasts = a.contrasts as NonNullable<LmerOptions["contrasts"]>;
  if (a.levels !== undefined) o.levels = a.levels as NonNullable<LmerOptions["levels"]>;
  return o;
}
function contrastOf(spec: ContestSpec): number[] | number[][] {
  return Array.isArray(spec.L[0]) ? (spec.L as Strings[]).map(nums) : nums(spec.L);
}
function contestOptionsOf(spec: ContestSpec): Parameters<typeof lmerContest>[2] {
  const o: NonNullable<Parameters<typeof lmerContest>[2]> = {};
  if (spec.rhs !== undefined) o.rhs = num(spec.rhs);
  if (spec.joint !== undefined) o.joint = spec.joint;
  if (spec.confint !== undefined) o.confint = spec.confint;
  if (spec.level !== undefined) o.level = num(spec.level);
  return o;
}
const unit = (p: number, i: number): number[] => Array.from({ length: p }, (_, j) => (j === i ? 1 : 0));

/** The rows of a contest as the fixture writes them, computed from given Satterthwaite quantities */
function contestRowsAt(s: LmerSatterthwaite, spec: ContestSpec, p: number): Record<string, number[]> {
  const L = contrastOf(spec);
  const rows = Array.isArray(L[0]) ? (L as number[][]) : [L as number[]];
  const rhs = spec.rhs === undefined ? 0 : num(spec.rhs);
  if (p === 0) return {};
  if (spec.joint === false) {
    const t = rows.map((row) => tTestOf(s, row, rhs));
    return {
      estimate: t.map((r) => r.estimate),
      stdError: t.map((r) => r.stdError),
      df: t.map((r) => r.df),
      tValue: t.map((r) => r.tValue),
      pValue: t.map((r) => r.pValue),
    };
  }
  const f = fTestOf(s, rows, new Array<number>(rows.length).fill(rhs), new Warnings());
  if (f === undefined) return {};
  return { sumSq: [f.sumSq], meanSq: [f.meanSq], numDF: [f.numDF], denDF: [f.denDF], F: [f.F], pValue: [f.pValue] };
}

/** The tolerance kind of each field of the tables */
const SCALED = new Set(["estimate", "stdError", "lower", "upper"]);
const EXACT = new Set(["numDF"]);
/** Fields of the fixture's tables that are not numbers (the ANOVA terms are compared on their own; the hypothesis
 * matrices are tested in test/lmerHypotheses.test.ts) */
const NOT_NUMERIC = new Set(["names", "type", "terms", "hypotheses"]);
const ANOVA_TYPES = ["III", "II", "I"] as const;

describe("lmerTest: Satterthwaite's tests", () => {
  it(`summary, varpar, vcovVarpar, contests and ANOVA tables against lmerTest (${fixture.r_version})`, () => {
    const failures: string[] = [];
    const worstExpected = new Map<string, number>();
    const worstAt = new Map<string, number>();
    const worstRef = new Map<string, number>();
    const note = (map: Map<string, number>, field: string, err: number): void => {
      map.set(field, Math.max(map.get(field) ?? 0, Number.isNaN(err) ? Infinity : err));
    };
    let withReference = 0;

    fixture.cases.forEach((c, ci) => {
      const a = c.args;
      const where = `case ${ci + 1} ${String(a.formula)} REML=${String(a.REML)}${a.contrasts ? ` ${JSON.stringify(a.contrasts)}` : ""}`;
      const data = dataFrameOf(a.data, a.dataTypes);
      const fit = lmer(a.formula as string, data, optionsOf(a));
      const e = c.expected as Record<string, unknown>;
      const ref = c.reference;
      const p = fit.fixefNames.length;
      const summary = lmerSummary(fit);
      const s = lmerSatterthwaite(fit);
      const specs = (a.contests ?? []) as ContestSpec[];
      const contests = specs.map((spec) => lmerContest(fit, contrastOf(spec), contestOptionsOf(spec)) as unknown as Record<string, number[]>);
      const anovas = ANOVA_TYPES.map((type) => lmerAnova(fit, { type }));

      // names, messages, warnings
      const es = e.summary as Rows;
      if (JSON.stringify(summary.names) !== JSON.stringify(es.names)) failures.push(`${where}: names ${JSON.stringify(summary.names)}`);
      const results = [summary, ...contests, ...anovas] as unknown as { messages: string[]; warnings: string[] }[];
      const ours = new Set([...fit.messages, ...results.flatMap((r) => r.messages)]);
      let theirs = e.messages as Strings;
      // where lmerTest stopped at another local minimum (its criterion clearly above the reference's; see the header),
      // its messages without the singular-fit message, then that message if the reference is singular
      if (ref !== undefined) {
        const { structure, reml } = lmerInternals(fit);
        const thetaRef = nums(ref.varpar).slice(0, -1);
        const fRef = profiledDeviance(structure, thetaRef, reml).deviance;
        const fLmerTest = profiledDeviance(structure, nums(e.varpar).slice(0, -1), reml).deviance;
        if (fLmerTest > fRef + TOL_LOCAL * Math.abs(fRef)) {
          theirs = theirs.filter((m) => m !== SINGULAR_MESSAGE);
          if (thetaRef.some((v, j) => structure.lower[j] === 0 && v < 1e-4)) theirs.push(SINGULAR_MESSAGE);
        }
      }
      if (JSON.stringify([...ours]) !== JSON.stringify(theirs)) failures.push(`${where}: messages ${JSON.stringify([...ours])}, lmerTest ${JSON.stringify(theirs)}`);
      const ourWarnings = [...new Set([...fit.warnings, ...results.flatMap((r) => r.warnings)])];
      if (JSON.stringify(withoutNumbers(ourWarnings)) !== JSON.stringify(withoutNumbers(e.warnings as Strings))) {
        failures.push(`${where}: warnings ${JSON.stringify(ourWarnings)}, lmerTest ${JSON.stringify(e.warnings)}`);
      }

      // the tables computed here, the reference's and lmerTest's: [label, ours, reference, lmerTest, kind]
      const tables: [string, Record<string, number[]>, Rows | undefined, Rows][] = [
        ["summary", summary as unknown as Record<string, number[]>, ref?.summary as Rows | undefined, es],
        ...specs.map((_, k): [string, Record<string, number[]>, Rows | undefined, Rows] => [
          `contest ${k + 1}`,
          contests[k]!,
          (ref?.contests as Rows[] | undefined)?.[k],
          (e.contests as Rows[])[k]!,
        ]),
        ...ANOVA_TYPES.map((type, k): [string, Record<string, number[]>, Rows | undefined, Rows] => {
          const theirsTable = (e.anova as Rows[]).find((t) => (t.type as unknown as string) === type)!;
          const refTable = (ref?.anova as Rows[] | undefined)?.find((t) => (t.type as unknown as string) === type);
          if (JSON.stringify(anovas[k]!.terms) !== JSON.stringify(theirsTable.terms)) {
            failures.push(`${where} anova ${type}: terms ${JSON.stringify(anovas[k]!.terms)}, lmerTest ${JSON.stringify(theirsTable.terms)}`);
          }
          if (refTable !== undefined && JSON.stringify(anovas[k]!.terms) !== JSON.stringify(refTable.terms)) {
            failures.push(`${where} anova ${type}: terms ${JSON.stringify(anovas[k]!.terms)}, reference ${JSON.stringify(refTable.terms)}`);
          }
          return [`anova ${type}`, anovas[k] as unknown as Record<string, number[]>, refTable, theirsTable];
        }),
      ];

      // against lmerTest at lme4's optimum
      const varparLme4 = nums(e.varpar);
      const thetaLme4 = varparLme4.slice(0, -1);
      const at = satterthwaiteAt(lmerInternals(fit).structure, thetaLme4, fit.REML, lmerInternals(fit).beta0);
      const atTables: Record<string, number[]>[] = [
        (() => {
          const t = Array.from({ length: p }, (_, i) => tTestOf(at, unit(p, i), 0));
          return {
            estimate: t.map((r) => r.estimate),
            stdError: t.map((r) => r.stdError),
            df: t.map((r) => r.df),
            tValue: t.map((r) => r.tValue),
            pValue: t.map((r) => r.pValue),
          };
        })(),
        ...specs.map((spec) => contestRowsAt(at, spec, p)),
        ...ANOVA_TYPES.map((type) => {
          const { hypotheses, termLabels } = anovaHypotheses(fit, type);
          const { rows } = anovaRowsOf(at, hypotheses, termLabels, new Warnings());
          const column = (k: keyof (typeof rows)[number]): number[] => rows.map((r) => r[k]);
          return {
            sumSq: column("sumSq"),
            meanSq: column("meanSq"),
            numDF: column("numDF"),
            denDF: column("denDF"),
            F: column("F"),
            pValue: column("pValue"),
          };
        }),
      ];
      const sigmaErr = relative(at.sigma, varparLme4[varparLme4.length - 1]!);
      note(worstAt, "sigma", sigmaErr);
      if (!(sigmaErr <= TOL_AT_EXACT)) failures.push(`${where}: sigma at lme4's optimum ${at.sigma}, lmerTest ${varparLme4.at(-1)}`);
      const vvLme4 = (e.vcovVarpar as Strings[]).map(nums);
      const vvScale = maxAbs(vvLme4.flat());
      const vvTol = thetaLme4.some((t) => t === 0) ? TOL_AT_VCOV_VARPAR_BOUNDARY : TOL_AT_VCOV_VARPAR;
      at.vcovVarpar.forEach((row, i) =>
        row.forEach((v, j) => {
          const err = Math.abs(v - vvLme4[i]![j]!) / vvScale;
          note(worstAt, "vcovVarpar", err);
          if (!(err <= vvTol)) failures.push(`${where}: vcovVarpar[${i}][${j}] at lme4's optimum ${v}, lmerTest ${vvLme4[i]![j]}`);
        }),
      );
      tables.forEach(([label, , , theirsTable], k) => {
        const mine = atTables[k]!;
        for (const [field, values] of Object.entries(theirsTable)) {
          if (NOT_NUMERIC.has(field) || field === "lower" || field === "upper") continue; // (the intervals: with the fit below)
          const want = nums(values);
          const got = mine[field];
          if (got === undefined || got.length !== want.length) {
            failures.push(`${where} ${label} ${field}: ${JSON.stringify(got)} at lme4's optimum, lmerTest ${JSON.stringify(values)}`);
            continue;
          }
          const tol = field === "estimate" || field === "stdError" ? TOL_AT_EXACT : field === "pValue" ? TOL_AT_P : EXACT.has(field) ? 0 : TOL_AT_DF;
          got.forEach((v, i) => {
            const err = SCALED.has(field) ? (v === want[i] ? 0 : Math.abs(v - want[i]!) / maxAbs(want)) : relative(v, want[i]!);
            note(worstAt, field, err);
            if (!(err <= tol)) failures.push(`${where} ${label} ${field}[${i}] at lme4's optimum: ${v}, lmerTest ${want[i]}`);
          });
        }
      });

      // our fit's tables: the reference (when there) and lmerTest
      if (ref !== undefined) withReference++;
      for (const [label, mine, refTable, theirsTable] of tables) {
        for (const [field, values] of Object.entries(theirsTable)) {
          if (NOT_NUMERIC.has(field)) continue;
          const want = nums(values);
          const got = mine[field];
          if (got === undefined || got.length !== want.length) {
            failures.push(`${where} ${label} ${field}: ${JSON.stringify(got)}, lmerTest ${JSON.stringify(values)}`);
            continue;
          }
          const refValues = refTable?.[field] === undefined ? undefined : nums(refTable[field]);
          got.forEach((v, i) => {
            note(worstExpected, field, relative(v, want[i]!));
            if (refValues === undefined) return;
            const r = refValues[i]!;
            const scale = SCALED.has(field) ? maxAbs(refValues) : Math.abs(r);
            const err = EXACT.has(field) ? (Object.is(v, r) ? 0 : Infinity) : field === "pValue" && r < 1e-300 ? Math.abs(v - r) : v === r ? 0 : Math.abs(v - r) / scale;
            note(worstRef, field, err);
            if (!(err <= TOL_REF)) failures.push(`${where} ${label} ${field}[${i}]: reference ${r}, got ${v}`);
            const bound = 2 * Math.abs(r - want[i]!) + TOL_EXPECTED * Math.abs(want[i]!);
            if (!(Math.abs(v - want[i]!) <= bound)) failures.push(`${where} ${label} ${field}[${i}]: lmerTest ${want[i]}, reference ${r}, got ${v}`);
          });
        }
      }
      const varparRows: [string, number[], number[] | undefined, number[]][] = [
        ["varpar", s.varpar, ref === undefined ? undefined : nums(ref.varpar), varparLme4],
        ["vcovVarpar", s.vcovVarpar.flat(), ref === undefined ? undefined : (ref.vcovVarpar as Strings[]).flatMap(nums), vvLme4.flat()],
        ["hessian", s.hessian.flat(), ref === undefined ? undefined : (ref.hessian as Strings[]).flatMap(nums), s.hessian.flat()],
      ];
      for (const [field, got, refValues, want] of varparRows) {
        got.forEach((v, i) => {
          if (field !== "hessian") note(worstExpected, field, Math.abs(v - want[i]!) / maxAbs(want));
          if (refValues === undefined) return;
          const err = v === refValues[i] ? 0 : Math.abs(v - refValues[i]!) / maxAbs(refValues);
          note(worstRef, field, err);
          if (!(err <= TOL_REF)) failures.push(`${where} ${field}[${i}]: reference ${refValues[i]}, got ${v}`);
          if (field === "hessian") return;
          const bound = 2 * Math.abs(refValues[i]! - want[i]!) + TOL_EXPECTED * maxAbs(want);
          if (!(Math.abs(v - want[i]!) <= bound)) failures.push(`${where} ${field}[${i}]: lmerTest ${want[i]}, reference ${refValues[i]}, got ${v}`);
        });
      }
      if (ref !== undefined) {
        const fromReference = hessianWarnings(nums(ref.hessianEigenvalues));
        if (JSON.stringify(withoutNumbers(fromReference)) !== JSON.stringify(withoutNumbers(s.warnings))) {
          failures.push(`${where}: Hessian warnings ${JSON.stringify(s.warnings)}, from the reference's eigenvalues ${JSON.stringify(fromReference)}`);
        }
      }
    });

    const show = (m: Map<string, number>): string => [...m].map(([k, v]) => `${k} ${v.toExponential(1)}`).join(", ");
    console.log(`lmerTest: ${fixture.cases.length} cases, ${withReference} with references`);
    console.log(`  at lme4's optimum, largest relative difference from lmerTest: ${show(worstAt)}`);
    console.log(`  at the exact optimum, largest relative difference from lmerTest: ${show(worstExpected)}`);
    if (withReference > 0) console.log(`  largest error against the reference: ${show(worstRef)}`);
    expect(failures).toEqual([]);
  });
});

// ---- the derivatives against differences of the first derivatives ----

interface Model {
  formula: string;
  data: Record<string, (number | string)[]>;
}
/** Crossed s × i (kept with probability `keep`) with random slopes for s */
function crossed(formula: string, ns: number, ni: number, keep: number, seed: number): Model {
  const { unif, norm } = generator(seed);
  const se = Array.from({ length: ns }, () => [norm(), 0.5 * norm()]);
  const ie = Array.from({ length: ni }, () => 0.7 * norm());
  const data: Model["data"] = { y: [], x: [], s: [], i: [] };
  for (let s = 0; s < ns; s++) {
    for (let i = 0; i < ni; i++) {
      if (unif() > keep) continue;
      const x = unif() * 4 - 1;
      data.s!.push(`s${s}`);
      data.i!.push(`i${i}`);
      data.x!.push(x);
      data.y!.push(1 + 0.5 * x + se[s]![0]! + se[s]![1]! * x + ie[i]! + norm());
    }
  }
  return { formula, data };
}
/** Subjects with a varying number of rows, y ~ x + z + (x + z | s) effects */
function longitudinal(formula: string, ns: number, per: number, seed: number): Model {
  const { unif, norm } = generator(seed);
  const data: Model["data"] = { y: [], x: [], z: [], f: [], s: [] };
  for (let s = 0; s < ns; s++) {
    const [b0, b1, b2] = [norm(), 0.4 * norm(), 0.3 * norm()];
    const rows = 2 + Math.floor(unif() * (2 * per - 3));
    for (let r = 0; r < rows; r++) {
      const x = r + unif();
      const z = norm();
      const f = ["a", "b", "c"][Math.floor(unif() * 3)]!;
      data.s!.push(`s${s}`);
      data.x!.push(x);
      data.z!.push(z);
      data.f!.push(f);
      data.y!.push(2 + 0.3 * x - 0.2 * z + (f === "b" ? 0.5 : 0) + b0 + b1 * x + b2 * z + 0.8 * norm());
    }
  }
  return { formula, data };
}
/** a / b nested, two rows per b */
function nested(na: number, nb: number, seed: number): Model {
  const { norm } = generator(seed);
  const data: Model["data"] = { y: [], x: [], a: [], b: [] };
  for (let a = 0; a < na; a++) {
    const ea = norm();
    for (let b = 0; b < nb; b++) {
      const eb = 0.6 * norm();
      for (let r = 0; r < 3; r++) {
        const x = norm();
        data.a!.push(`a${a}`);
        data.b!.push(`b${b}`);
        data.x!.push(x);
        data.y!.push(x + ea + eb + norm());
      }
    }
  }
  return { formula: "y ~ x + (1 | a/b)", data };
}

/** The gradient of d(θ, σ) at any (θ, σ), from the analytic first derivatives of Φ and r² at θ */
function gradientAt(s: MixedModelStructure, vp: readonly number[], reml: boolean): number[] {
  const theta = vp.slice(0, -1);
  const sigma = vp[vp.length - 1]!;
  const d = varparDerivatives(s, theta, reml);
  const nu = reml ? s.y.length - s.xColNames.length : s.y.length;
  return [...d.phiGradient.map((g, k) => g + d.prssGradient[k]! / (sigma * sigma)), (-2 * d.prss) / sigma ** 3 + (2 * nu) / sigma];
}
/** C(θ, σ) = σ² (R_X'R_X)⁻¹, flattened */
function vcovAt(s: MixedModelStructure, vp: readonly number[], reml: boolean): number[] {
  const r = profiledDeviance(s, vp.slice(0, -1), reml, { rxInverse: true });
  const s2 = vp[vp.length - 1]! ** 2;
  return r.rxInverse!.flat().map((v) => v * s2);
}
/** The derivative of f along coordinate k at vp by central differences with two Richardson extrapolations */
function richardson(f: (vp: number[]) => number[], vp: readonly number[], k: number, h: number): number[] {
  const central = (step: number): number[] => {
    const plus = vp.slice();
    plus[k]! += step;
    const minus = vp.slice();
    minus[k]! -= step;
    const fp = f(plus);
    const fm = f(minus);
    return fp.map((v, i) => (v - fm[i]!) / (2 * step));
  };
  const d1 = central(h);
  const d2 = central(h / 2);
  const d3 = central(h / 4);
  return d1.map((v, i) => {
    const r1 = (4 * d2[i]! - v) / 3;
    const r2 = (4 * d3[i]! - d2[i]!) / 3;
    return (16 * r2 - r1) / 15;
  });
}

describe("lmerTest: the analytic derivatives", () => {
  const models: Model[] = [
    crossed("y ~ x + (1 | s) + (1 | i)", 30, 20, 1, 11),
    crossed("y ~ x + (x | s) + (1 | i)", 25, 15, 0.7, 12),
    longitudinal("y ~ x + z + f + (x + z | s)", 40, 5, 13),
    longitudinal("y ~ x + z + (x + z || s)", 40, 5, 14),
    nested(8, 4, 15),
  ];
  const fixtureModels = fixture.cases.map((c) => ({ formula: c.args.formula as string, data: dataFrameOf(c.args.data, c.args.dataTypes), options: optionsOf(c.args) }));

  it("the Hessian of d(θ, σ) and the Jacobians of C agree with Richardson-extrapolated differences, at and away from the fit", () => {
    const failures: string[] = [];
    let worstH = 0;
    let worstJ = 0;
    const all = [
      ...fixtureModels,
      ...models.flatMap((m) => [true, false].map((REML) => ({ formula: m.formula, data: m.data, options: { REML } }))),
    ];
    for (const m of all) {
      const fit: LmerResult = lmer(m.formula, m.data, m.options);
      const { structure: s, reml } = lmerInternals(fit);
      for (const away of [false, true]) {
        // away from the fit: θ moved (σ = σ̂(θ), so the gradient of d in θ is not 0 there)
        const theta = away ? fit.theta.map((t, i) => (t === 0 ? 0 : t * (1 + 0.03 * (i + 1)))) : fit.theta;
        const d = varparDerivatives(s, theta, reml);
        const vp = d.varpar;
        const { hessian, jacobian } = d;
        const scaleH = maxAbs(hessian.flat());
        const scaleJ = Math.max(maxAbs(vcovAt(s, vp, reml)), ...jacobian.map((j) => maxAbs(j.flat())));
        for (let k = 0; k < vp.length; k++) {
          const h = 4e-3 * Math.max(1, Math.abs(vp[k]!));
          const column = richardson((v) => gradientAt(s, v, reml), vp, k, h);
          column.forEach((v, i) => {
            const err = Math.abs(v - hessian[i]![k]!) / scaleH;
            worstH = Math.max(worstH, err);
            if (!(err <= 1e-9)) failures.push(`${m.formula} REML=${reml} away=${away}: H[${i}][${k}] ${hessian[i]![k]}, differences ${v}`);
          });
          const dc = richardson((v) => vcovAt(s, v, reml), vp, k, h);
          jacobian[k]!.flat().forEach((v, i) => {
            const err = Math.abs(v - dc[i]!) / scaleJ;
            worstJ = Math.max(worstJ, err);
            if (!(err <= 1e-9)) failures.push(`${m.formula} REML=${reml} away=${away}: J[${k}][${i}] ${v}, differences ${dc[i]}`);
          });
        }
      }
    }
    console.log(`analytic derivatives against differences: Hessian ${worstH.toExponential(1)}, Jacobians ${worstJ.toExponential(1)} (relative to the largest element)`);
    expect(failures).toEqual([]);
  });

  it("the derivative of d in θ at σ̂ is the gradient of the profiled criterion, and vanishes at the fit", () => {
    for (const m of fixtureModels.slice(0, 12)) {
      const fit = lmer(m.formula, m.data, m.options);
      const { structure: s, reml, beta0 } = lmerInternals(fit);
      const theta = fit.theta.map((t, i) => t + 0.1 * (i + 1));
      const d = varparDerivatives(s, theta, reml);
      const g = profiledDeviance(s, theta, reml, { gradient: true }).gradient!;
      const scale = Math.max(1, maxAbs(g));
      g.forEach((v, i) => expect(Math.abs(d.gradient[i]! - v) / scale).toBeLessThan(1e-12));
      expect(Math.abs(d.gradient.at(-1)!)).toBeLessThan(1e-12 * Math.max(1, ...d.varpar));
      const atFit = varparDerivatives(s, fit.theta, reml);
      atFit.gradient.forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-9 * Math.max(1, Math.abs(atFit.deviance))));
      expect(atFit.vcov.flat()).toEqual(fit.vcov.flat());
      expect(atFit.beta.map((b, k) => b + beta0[k]!)).toEqual(fit.fixef);
    }
  });
});

describe("lmerTest: behaviour", () => {
  const data = {
    y: [3.1, 4.0, 5.2, 6.8, 7.1, 8.3, 2.2, 3.5, 3.9, 5.9, 6.1, 7.4],
    x: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3],
    g: ["a", "a", "a", "b", "b", "b", "c", "c", "c", "d", "d", "d"],
  };

  it("the warnings of the Hessian's eigenvalues", () => {
    expect(hessianWarnings([3, 1, -3.2e-4])).toEqual(["Model failed to converge with 1 negative eigenvalue: -3.2e-04"]);
    expect(hessianWarnings([3, -2e-7, -1.25e-3])).toEqual(["Model failed to converge with 2 negative eigenvalues: -2.0e-07 -1.3e-03"]);
    expect(hessianWarnings([3, 5e-9, -5e-9, -1])).toEqual([
      "Model failed to converge with 1 negative eigenvalue: -1.0e+00",
      "Model may not have converged with 2 eigenvalues close to zero: 5.0e-09 -5.0e-09",
    ]);
    expect(hessianWarnings([3, 0])).toEqual(["Model may not have converged with 1 eigenvalue close to zero: 0.0e+00"]);
    expect(hessianWarnings([3, 1e-8])).toEqual([]);
  });

  it("summary with ddf lme4, contrasts that are NaN, empty or of the wrong length, and fits that are not lmer's", () => {
    const fit = lmer("y ~ x + (1 | g)", data);
    const lme4 = lmerSummary(fit, { ddf: "lme4" });
    expect(lme4.estimate).toEqual(fit.coefTable.estimate);
    expect(lme4.tValue).toEqual(fit.coefTable.tValue);
    expect(lme4.df).toBeUndefined();
    expect(lme4.pValue).toBeUndefined();
    const s = lmerSummary(fit);
    s.stdError.forEach((v, i) => expect(v).toBeCloseTo(fit.coefTable.stdError[i]!, 12));
    expect(() => lmerSummary(fit, { ddf: "Kenward-Roger" as "lme4" })).toThrow(RangeError);
    expect(() => lmerSummary({ ...fit })).toThrow(TypeError);
    const nan = lmerContest(fit, [NaN, 1], { joint: false });
    expect([nan.estimate[0], nan.df[0], nan.pValue[0], nan.lower![0]]).toEqual([NaN, NaN, NaN, NaN]);
    expect(lmerContest(fit, [[NaN, 1]]).F).toEqual([NaN]);
    expect(() => lmerContest(fit, [1, 0, 0])).toThrow(TypeError);
    expect(() => lmerContest(fit, [[1, 0], [1]])).toThrow(TypeError);
    expect(lmerContest(fit, [0, 1], { joint: false, confint: false }).lower).toBeUndefined();
    const none = lmer("y ~ 0 + (1 | g)", data);
    expect(lmerSummary(none).names).toEqual([]);
    expect(lmerContest(none, []).F).toEqual([]);
    expect(lmerContest(none, [], { joint: false }).tValue).toEqual([]);
  });

  it("joint tests: one row is the t-test squared, dependent rows count once, a right-hand side", () => {
    const fit = lmer("y ~ x + (1 | g)", data);
    const t = lmerContest(fit, [0, 1], { joint: false, rhs: 0.5 });
    const f1 = lmerContest(fit, [0, 1], { rhs: 0.5 });
    expect(f1.F[0]).toBeCloseTo(t.tValue[0]! ** 2, 12);
    expect(f1.denDF).toEqual(t.df);
    expect(f1.numDF).toEqual([1]);
    // two proportional rows: rank 1, the test of the normalised row
    const dep = lmerContest(fit, [[0, 1], [0, 2]]);
    const one = lmerContest(fit, [0, 1]);
    expect(dep.numDF).toEqual([1]);
    expect(dep.F[0]! / one.F[0]!).toBeCloseTo(1, 12);
    expect(dep.denDF[0]! / one.denDF[0]!).toBeCloseTo(1, 12);
    expect(dep.warnings).toEqual([]);
    // the same with a non-zero right-hand side: β̂ − ginv(L) rhs, and the warning
    const depRhs = lmerContest(fit, [[0, 1], [0, 2]], { rhs: [0.5, 1] });
    expect(depRhs.warnings).toEqual(["Contrast is rank deficient and test may be affected"]);
    expect(depRhs.F[0]! / f1.F[0]!).toBeCloseTo(1, 12);
    // full rank with a right-hand side: the F statistic of (L β̂ − rhs)' (L V L')⁻¹ (L β̂ − rhs) / r
    const L = [[1, 0], [0, 1]];
    const rhs = [3, 0.5];
    const both = lmerContest(fit, L, { rhs });
    const dlt = fit.fixef.map((b, i) => b - rhs[i]!);
    const v = fit.vcov;
    const det = v[0]![0]! * v[1]![1]! - v[0]![1]! ** 2;
    const quad = (dlt[0]! ** 2 * v[1]![1]! - 2 * dlt[0]! * dlt[1]! * v[0]![1]! + dlt[1]! ** 2 * v[0]![0]!) / det;
    expect(both.F[0]! / (quad / 2)).toBeCloseTo(1, 10);
    expect(both.sumSq[0]! / (both.F[0]! * fit.sigma ** 2 * 2)).toBeCloseTo(1, 12);
    expect(lmerContest(fit, [[0, 0], [0, 0]]).F).toEqual([]);
    expect(() => lmerContest(fit, L, { rhs: [1, 2, 3] })).toThrow(TypeError);
  });
});

// vcovHC and vcovCL (sandwich 3.1-3) against R (oracle/vcovhc.R, oracle/vcovcl.R, oracle/robust-behaviour.md): every
// entry (i, j) within 1e-12 of R's relative to sqrt(V_ii V_jj) (off-diagonal entries can be near 0), against the
// fixture's `reference` where rStats.js returns the right value instead of R's (choices 3 to 9 of
// robust-behaviour.md), and the cases without a fixture value checked by the identities they must satisfy.
import { describe, expect, it } from "vitest";
import { glmSummary, vcovCL, vcovHC, type GlmResult, type LmResult, type VcovResult } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { arg, defined, loadHTestFixture, type HTestArg, type HTestCase } from "./helpers/htest.js";
import { mat, matrixError, robustFit } from "./helpers/robust.js";

/** Comparison of the cases of a fixture: a list of failures and the worst errors */
class Check {
  failures: string[] = [];
  worst = new Map<string, number>();
  matrix(index: number, what: string, V: number[][], E: number[][], tol: number, scale?: number[]): void {
    const err = matrixError(V, E, scale);
    this.worst.set(what, Math.max(this.worst.get(what) ?? 0, err));
    if (!(err <= tol)) this.failures.push(`#${index} ${what}: error ${err.toExponential(2)} (tolerance ${tol})\n  TS ${JSON.stringify(V)}\n  R  ${JSON.stringify(E)}`);
  }
  equal(index: number, what: string, a: unknown, e: unknown): void {
    if (JSON.stringify(a) !== JSON.stringify(e)) this.failures.push(`#${index} ${what}: TS ${JSON.stringify(a)} / R ${JSON.stringify(e)}`);
  }
  summary(name: string): string {
    return `${name}: worst ${[...this.worst].map(([k, v]) => `${k} ${v.toExponential(1)}`).join(", ")}`;
  }
}

const TOL = 1e-12;
// Model matrices with condition number about 2e12 (refKind "exact"): the fit's own residuals carry its rounding (R's are
// up to 8e-3 off the exact value in single entries), so the values are compared with the exact reference to the
// precision the double QR of such a matrix gives: kappa eps is about 4e-4 (robust-behaviour.md, choice 7)
const EXACT_TOL = 2e-3;

describe("vcovHC", () => {
  const fixture = loadHTestFixture("vcovHC");
  it(`matches R (${fixture.r_version}) or the reference`, () => {
    const check = new Check();
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const e = c.expected;
      const fit = robustFit(a);
      const options = defined({
        type: arg.str(a.type) as never,
        omega: arg.vec(a.omega),
        sandwich: arg.bool(a.sandwich),
      });
      const call = (): VcovResult => vcovHC(fit, options);
      if (e.error !== undefined) {
        errors++;
        expect(call, `#${index}`).toThrow(e.error as string);
        return;
      }
      const type = a.type ?? "HC3";
      const allNaN = (e.vcov as string[][]).every((r) => r.every((v) => v === "NaN"));
      if (allNaN) {
        // a hat value of 1 with HC2 to HC5: R's matrix of NaN, an error here (choice 6), with R's warning's numbers
        errors++;
        const obs = (e.warnings as string[])[0]!.replace(/.*as for observation\(s\) /, "");
        expect(call, `#${index}`).toThrow(`${type} covariances are undefined for hat values of 1 as for observation(s) ${obs}`);
        return;
      }
      const r = call();
      check.equal(index, "names", r.names, e.names);
      if (type === "const" && (a.weights !== undefined || a.model === "glm") && a.refKind !== "vcov") {
        // the model-based covariance (choice 5) where R's const is something else and the fixture has no vcov(fit):
        // its diagonal is the squared standard errors of the fit (the meat of a glm: the test below)
        if (a.sandwich === false) return;
        const se = a.model === "lm" ? (fit as LmResult).coefTable.stdError : glmSummary(fit as GlmResult).stdError;
        const diag = (v: number[]) => v.map((d, i) => v.map((_, j) => (i === j ? d : 0)));
        check.matrix(index, "const", diag(r.vcov.map((row, i) => row[i]!)), diag(se.map((s) => s * s)), TOL);
        check.equal(index, "warnings", r.warnings, []);
        return;
      }
      const ref = c.reference?.vcov;
      switch (a.refKind) {
        case "subset":
          // zero prior weights left out (choice 3): R on the fit without those rows
          check.matrix(index, "subset", r.vcov, mat(ref), TOL);
          check.equal(index, "warnings", r.warnings, []);
          return;
        case "scaled":
        case "vcov":
          check.matrix(index, String(a.refKind), r.vcov, mat(ref), TOL);
          break;
        case "exact":
          check.matrix(index, "exact", r.vcov, mat(ref), EXACT_TOL);
          break;
        default:
          check.matrix(index, "R", r.vcov, mat(e.vcov), TOL);
      }
      check.equal(index, "warnings", r.warnings, e.warnings);
    });
    console.log(`${check.summary("vcovHC")} (${fixture.cases.length} cases, ${errors} errors)`);
    expect(check.failures, check.failures.slice(0, 20).join("\n")).toEqual([]);
  });

  it("type const with sandwich: false is the meat of the model-based covariance", () => {
    // R's const meat uses the unweighted X'X and sum res^2 / (n - k); here omega_i = dispersion W_i / phi_s^2, so
    // that the sandwich is the dispersion times (X'WX)^-1 (choice 5)
    const c = fixture.cases.find((c) => c.args.family === "quasipoisson" && c.args.type === "const" && c.args.sandwich === false)!;
    const fit = robustFit(c.args) as GlmResult;
    const W = fit.weights;
    const wz = W.map((w, i) => w * fit.residuals[i]!);
    const phiS = wz.reduce((s, v) => s + v * v, 0) / W.reduce((s, v) => s + v, 0);
    const d = glmSummary(fit).dispersion;
    const viaOmega = vcovHC(fit, { omega: W.map((w) => (d * w) / phiS ** 2), sandwich: false }).vcov;
    expect(matrixError(vcovHC(fit, { type: "const", sandwich: false }).vcov, viaOmega)).toBeLessThan(TOL);
    expect(matrixError(vcovHC(fit, { type: "const" }).vcov, glmSummary(fit).covScaled)).toBeLessThan(TOL);
  });
});

/** The cluster argument of a case: one-way (an array of labels) or multi-way (an array of arrays) */
function clusterOf(a: HTestCase["args"]): (number | string)[] | (number | string)[][] | undefined {
  const cl = a.cluster as HTestArg | undefined;
  if (cl === undefined) return undefined;
  const label = (v: string): number | string => (v === "NA" ? NaN : /\d/.test(v) && Number.isFinite(Number(v)) ? num(v) : v);
  if (Array.isArray(cl) && Array.isArray(cl[0])) return (cl as string[][]).map((d) => d.map(label));
  return (Array.isArray(cl) ? (cl as string[]) : [cl as string]).map(label);
}

describe("vcovCL", () => {
  const fixture = loadHTestFixture("vcovCL");
  it(`matches R (${fixture.r_version}) or the reference`, () => {
    const check = new Check();
    let errors = 0;
    let derived = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const e = c.expected;
      const fit = robustFit(a);
      const cluster = clusterOf(a);
      const options = defined({
        cluster,
        type: arg.str(a.type) as never,
        cadjust: arg.bool(a.cadjust),
        multi0: arg.bool(a.multi0),
        fix: arg.bool(a.fix),
        sandwich: arg.bool(a.sandwich),
      });
      const call = (): VcovResult => vcovCL(fit, options);
      if (e.error !== undefined) {
        errors++;
        // a single cluster: R fails with "non-conformable arrays"; here an error of its own (choice 9)
        expect(call, `#${index}`).toThrow(e.error === "non-conformable arrays" ? "at least two clusters are needed" : (e.error as string));
        return;
      }
      const E = mat(e.vcov);
      if (E.every((r) => r.every(Number.isNaN)) || a.cluster !== undefined && (a.x as string[][])[0]!.length > 30 && (a.type === "HC2" || a.type === "HC3")) {
        // cluster fixed effects with HC2/HC3: singular blocks I - H_gg (R: NaN for HC2, meaningless numbers for HC3);
        // an error here (choice 8)
        errors++;
        expect(call, `#${index}`).toThrow("is singular");
        return;
      }
      const r = call();
      check.equal(index, "names", r.names, e.names);
      check.equal(index, "warnings", r.warnings, e.warnings);
      if (a.refKind === "subset" && (a.type === "HC2" || a.type === "HC3")) {
        // zero prior weights left out (choice 3), with the symmetric adjustment of a weighted fit (choice 8): R's
        // reference (sandwich on the fit without those rows) transposes it, so the value is that of the same
        // computation on the fit without those rows
        derived++;
        const keep = arg.vec(a.weights)!.map((w) => w > 0);
        const sub = { ...a } as HTestCase["args"];
        sub.x = (a.x as string[][]).filter((_, i) => keep[i]);
        sub.y = (a.y as string[]).filter((_, i) => keep[i]);
        sub.weights = (a.weights as string[]).filter((_, i) => keep[i]);
        const V = vcovCL(robustFit(sub), { ...options, cluster: (cluster as (number | string)[]).filter((_, i) => keep[i]) }).vcov;
        check.matrix(index, "subset natural", r.vcov, V, TOL);
        return;
      }
      if (a.sandwich === false && a.model === "glm" && (a.type === "HC2" || a.type === "HC3")) {
        // the meat of the symmetric adjustment (choice 8): its sandwich n A M A (phi_s = 1 for poisson) is the
        // reference of the same case with sandwich = TRUE
        derived++;
        const same = fixture.cases.find(
          (o) => o.args.refKind === "natural" && o.args.family === a.family && o.args.type === a.type && o.args.cadjust === true && o.args.weights === undefined,
        )!;
        const A = glmSummary(fit as GlmResult).covUnscaled;
        const n = (fit as GlmResult).priorWeights.length;
        const k = A.length;
        const AM = A.map((row) => row.map((_, j) => row.reduce((s, v, l) => s + v * r.vcov[l]![j]!, 0)));
        const V = AM.map((row) => A.map((_, j) => n * row.reduce((s, v, l) => s + v * A[l]![j]!, 0)));
        expect(k).toBe(r.vcov.length);
        check.matrix(index, "meat natural", V, mat(same.reference!.vcov), TOL);
        return;
      }
      if (c.reference !== undefined) {
        check.matrix(index, String(a.refKind), r.vcov, mat(c.reference.vcov), TOL);
        if (c.reference.jackknife !== undefined) check.matrix(index, "jackknife", r.vcov, mat(c.reference.jackknife), TOL);
        return;
      }
      if (a.clusterLevels !== undefined) {
        // a factor with unused levels: R counts them in G (15 levels, 12 used); here G = 12 (choice 9)
        derived++;
        const f = 12 / 11 / (15 / 14);
        check.matrix(index, "unused levels", r.vcov, E.map((row) => row.map((v) => v * f)), TOL);
        return;
      }
      const multi = Array.isArray(cluster?.[0]);
      if (multi && (cluster as string[][]).some((d) => d.some((v) => String(v).includes("_")))) {
        // R pastes the labels with "_", so ("a_b", "c") and ("a", "b_c") are one intersection cluster; here the
        // intersections are tuples (choice 9): V(c1) + V(c2) - V(c1 x c2), each one-way (HC1 is linear in the meat)
        derived++;
        const [c1, c2] = cluster as string[][];
        const tuple = c1!.map((v, i) => JSON.stringify([v, c2![i]]));
        const V1 = vcovCL(fit, { cluster: c1! }).vcov;
        const V2 = vcovCL(fit, { cluster: c2! }).vcov;
        const V12 = vcovCL(fit, { cluster: tuple }).vcov;
        check.matrix(index, "tuples", r.vcov, V1.map((row, i) => row.map((v, j) => v + V2[i]![j]! - V12[i]![j]!)), TOL);
        expect(matrixError(r.vcov, E), `#${index} differs from R's merged clusters`).toBeGreaterThan(1e-6);
        return;
      }
      // cluster fixed effects: the cluster sums of the estimating functions are 0 in the directions of the unit dummies,
      // so their variances are rounding residue (about 1e-29 against 0.18) and so are their covariances (about
      // sqrt(V_ii V_jj), 1e-15); the entries of those coefficients (variance below eps times the largest) are compared
      // relative to sqrt(V_max V_jj) instead
      const vmax = Math.max(...E.map((row, i) => row[i]!));
      const fe = (a.x as string[][])[0]!.length > 30 ? E.map((row, i) => (row[i]! < 2 ** -52 * vmax ? vmax : row[i]!)) : undefined;
      check.matrix(index, "R", r.vcov, E, TOL, fe);
    });
    console.log(`${check.summary("vcovCL")} (${fixture.cases.length} cases, ${errors} errors, ${derived} derived)`);
    expect(check.failures, check.failures.slice(0, 20).join("\n")).toEqual([]);
  });
});

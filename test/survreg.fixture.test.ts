import { describe, expect, it } from "vitest";
import { pchisq, pnorm, survreg, type SurvregOptions } from "../src/index.js";
import { loadAnovaFixture } from "./helpers/anova.js";

const fixture = loadAnovaFixture("survreg");
type Raw = Record<string, unknown>;
const numberValue = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (v === "NA" || v === "NaN") return NaN;
  if (v === "Inf") return Infinity;
  if (v === "-Inf") return -Infinity;
  return Number(v);
};
const vector = (v: unknown): number[] | undefined =>
  v === undefined ? undefined : (v as unknown[]).map(numberValue);
const matrix = (v: unknown): number[][] | undefined =>
  v === undefined ? undefined : (v as unknown[][]).map((r) => r.map(numberValue));

function optionsOf(a: Raw): SurvregOptions {
  const options: Record<string, unknown> = {};
  for (const key of ["type", "dist", "intercept"] as const) if (a[key] !== undefined) options[key] = a[key];
  for (const key of ["time2", "weights", "offset", "init"] as const) {
    const v = vector(a[key]);
    if (v !== undefined) options[key] = v;
  }
  if (a.strata !== undefined) options.strata = a.strata as (string | number | boolean)[];
  if (a.scale !== undefined) options.scale = numberValue(a.scale);
  if (a.parms !== undefined) options.df = numberValue(a.parms);
  const control: Record<string, number> = {};
  if (a.maxiter !== undefined) control.maxiter = numberValue(a.maxiter);
  if (a["rel.tolerance"] !== undefined) control.relTolerance = numberValue(a["rel.tolerance"]);
  if (a["toler.chol"] !== undefined) control.tolerChol = numberValue(a["toler.chol"]);
  if (Object.keys(control).length) options.control = control;
  return options as SurvregOptions;
}
function compareNumbers(actual: unknown, expected: unknown, label: string, absoluteTolerance = 1e-12): void {
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), label).toBe(true);
    expect((actual as unknown[]).length, label + " length").toBe(expected.length);
    expected.forEach((v, i) => compareNumbers((actual as unknown[])[i], v, label + "[" + i + "]", absoluteTolerance));
    return;
  }
  const e = numberValue(expected), a = actual as number;
  if (Number.isNaN(e)) { expect(Number.isNaN(a), label).toBe(true); return; }
  if (!Number.isFinite(e)) { expect(a, label).toBe(e); return; }
  const tolerance = Math.max(absoluteTolerance, absoluteTolerance * Math.abs(e));
  expect(Math.abs(a - e), label).toBeLessThanOrEqual(tolerance);
}

const LOG2PI = Math.log(2 * Math.PI);
function gaussianRightLoglik(time:number[],event:number[],eta:number[],scale:number):number {
  let ll=0;
  for(let i=0;i<time.length;i++){
    const z=(time[i]!-eta[i]!)/scale;
    ll+=event[i]===1?-0.5*z*z-0.5*LOG2PI-Math.log(scale):pnorm(z,{lowerTail:false,logP:true});
  }
  return ll;
}
describe("survreg: R 4.6.2 fixture", () => {
  fixture.cases.forEach((c, index) => {
    it("case " + index, () => {
      const a = c.args as Raw, e = c.expected as Raw;
      // The selected API rejects negative iteration limits; R silently returns the initial iterate.
      if (a.maxiter !== undefined && numberValue(a.maxiter) < 0) {
        expect(() => survreg(vector(a.time) ?? [], vector(a.event), matrix(a.x) ?? [], optionsOf(a))).toThrow("invalid control");
        return;
      }
      if (e.error !== undefined) {
        expect(() => survreg(vector(a.time) ?? [], vector(a.event), matrix(a.x) ?? [], optionsOf(a))).toThrow(String(e.error));
        return;
      }
      const fit = survreg(vector(a.time) ?? [], vector(a.event), matrix(a.x) ?? [], optionsOf(a));
      if ([0, 1, 2, 14, 50, 51, 53, 57, 58, 60, 72].includes(index)) console.log("SURVREG DEBUG", index, JSON.stringify({ coefficients: fit.coefficients, scale: fit.scale, iter: fit.iter, icoef: fit.icoef, loglik: fit.loglik, varDiag: fit.var.map((r, i) => r[i]), score: fit.score }));
      if (c.reference?.refKind === "logDomain") {
        const time=vector(a.time)!,event=vector(a.event)!,x=matrix(a.x)!;
        const eta=(beta:number[])=>x.map(r=>beta[0]!+r.reduce((s,v,j)=>s+v*beta[j+1]!,0));
        const fullLL=gaussianRightLoglik(time,event,eta(fit.coefficients),fit.scale[0]!);
        const nullLL=gaussianRightLoglik(time,event,time.map(()=>fit.icoef[0]!),fit.scale[0]!);
        compareNumbers(fit.loglik[1],fullLL,"#"+index+" independent log-domain full likelihood",1e-8);
        compareNumbers(fit.loglik[0],nullLL,"#"+index+" independent log-domain null likelihood",1e-8);
        expect(fit.coefficients.every(Number.isFinite),"#"+index+" finite coefficients").toBe(true);
        expect(fit.var.every((r,i)=>Number.isFinite(r[i]!)&&r[i]!>0),"#"+index+" positive finite information").toBe(true);
        const h=1e-4,fd=fit.coefficients.map((_,j)=>{const plus=fit.coefficients.slice(),minus=fit.coefficients.slice();plus[j]!+=h;minus[j]!-=h;return (gaussianRightLoglik(time,event,eta(plus),fit.scale[0]!)-gaussianRightLoglik(time,event,eta(minus),fit.scale[0]!))/(2*h);});
        fd.forEach((v,j)=>expect(Math.abs(v-fit.score![j]!),"#"+index+" finite-difference score "+j).toBeLessThan(5e-3));
        expect(fit.warnings).not.toContain("Ran out of iterations and did not converge");
        return;
      }
      const fields: [string, unknown, unknown][] = [
        ["coefficients", fit.coefficients, e.coefficients], ["scale", fit.scale, e.scale],
        ["icoef", fit.icoef, e.icoef], ["var", fit.var, e.var], ["loglik", fit.loglik, e.loglik],
        ["linear.predictors", fit.linearPredictors, e["linear.predictors"]], ["means", fit.means, e.means], ["score", fit.score, e.score],
        ["value", fit.value, e.value], ["se", fit.se, e.se], ["z", fit.z, e.z], ["p", fit.p, e.p],
        ["chi", fit.chi, e.chi], ["chiDf", fit.chiDf, e.chiDf], ["chiP", fit.chiP, e.chiP],
      ];
      for (const [name, actual, expected] of fields) {
        if (expected === undefined) continue;
        if (c.reference?.refKind === "nullIter" && (name === "icoef" || name === "chi" || name === "chiP")) continue;
        if (name === "loglik" && c.reference?.refKind === "nullIter") {
          const expectedLoglik = (expected as unknown[]).slice();
          expectedLoglik[0] = c.reference.loglik1;
          compareNumbers(actual, expectedLoglik, "#" + index + " " + name);
        } else if (name === "score") {
          compareNumbers(actual, expected, "#" + index + " score", 1e-8);
        } else compareNumbers(actual, expected, "#" + index + " " + name);
      }
      expect(fit.coefNames, "#" + index + " coefNames").toEqual(e.coefNames);
      expect(fit.tableRowNames, "#" + index + " tableRowNames").toEqual(e.tableRowNames);
      if (c.reference?.refKind !== "nullIter") expect(fit.iter, "#" + index + " iter").toBe(numberValue(e.iter));
      expect(fit.df, "#" + index + " df").toBe(numberValue(e.df));
      expect(fit.idf, "#" + index + " idf").toBe(numberValue(e.idf));
      expect(fit.dfResidual, "#" + index + " df.residual").toBe(numberValue(e["df.residual"]));
      expect(fit.n, "#" + index + " n").toBe(numberValue(e.n));
      if (c.reference?.refKind === "nullIter") {
        const refNull = numberValue(c.reference.loglik1);
        const chi = 2 * (fit.loglik[1]! - refNull);
        compareNumbers(fit.chi, chi, "#" + index + " reference chi");
        compareNumbers(fit.chiP, pchisq(chi, fit.chiDf, { lowerTail: false }), "#" + index + " reference chiP");
      }
      expect(fit.warnings, "#" + index + " warnings").toEqual(e.warnings);
    });
  });
});

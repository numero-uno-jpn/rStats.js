import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { survreg, survregPredict, survregResiduals, type SurvregOptions, type SurvregPredictionResult } from "../src/index.js";

type Raw = Record<string, unknown>;
type Fixture = { cases: { args: Raw; expected: Raw }[] };
const num = (v: unknown): number => typeof v === "number" ? v : v === "NA" || v === "NaN" ? NaN : v === "Inf" ? Infinity : v === "-Inf" ? -Infinity : Number(v);
const vec = (v: unknown): number[] | undefined => v === undefined ? undefined : (v as unknown[]).map(num);
const mat = (v: unknown): number[][] | undefined => v === undefined ? undefined : (v as unknown[][]).map(r => r.map(num));
function fitOptions(a: Raw): SurvregOptions {
  const o: Record<string, unknown> = {};
  for (const k of ["type", "dist", "intercept"] as const) if (a[k] !== undefined) o[k] = a[k];
  for (const k of ["time2", "weights", "offset", "init"] as const) { const v=vec(a[k]); if(v!==undefined)o[k]=v; }
  if(a.strata!==undefined)o.strata=a.strata;
  for(const k of ["scale","parms"] as const)if(a[k]!==undefined)o[k]=num(a[k]);
  const control:Record<string,number>={};
  if(a.maxiter!==undefined)control.maxiter=num(a.maxiter);
  if(a["rel.tolerance"]!==undefined)control.relTolerance=num(a["rel.tolerance"]);
  if(a["toler.chol"]!==undefined)control.tolerChol=num(a["toler.chol"]);
  if(Object.keys(control).length)o.control=control;
  return o as SurvregOptions;
}
function compare(actual: unknown, expected: unknown, label: string): void {
  if(Array.isArray(expected)){expect(Array.isArray(actual),label).toBe(true);expect((actual as unknown[]).length,label+" length").toBe(expected.length);expected.forEach((v,i)=>compare((actual as unknown[])[i],v,label+"["+i+"]"));return;}
  const e=num(expected),a=actual as number;
  if(Number.isNaN(e)){expect(Number.isNaN(a),label).toBe(true);return;}
  if(!Number.isFinite(e)){expect(a,label).toBe(e);return;}
  const tolerance=e===0?1e-12:1e-12*Math.abs(e);
  expect(Math.abs(a-e),label).toBeLessThanOrEqual(tolerance);
}
function load(name:string):Fixture {
  const path=fileURLToPath(new URL("../fixtures/"+name+".json",import.meta.url));
  return JSON.parse(readFileSync(path,"utf8")) as Fixture;
}

describe("survregPredict: R 4.6.2 fixture",()=>{
  const fixture=load("survregPredict");
  fixture.cases.forEach((c,index)=>it("case "+index,()=>{
    const a=c.args,e=c.expected;
    const fit=survreg(vec(a.time)??[],vec(a.event),mat(a.x)??[],fitOptions(a));
    const p=vec(a.p);
    const result=survregPredict(fit,{
      type:(a.predType as "lp"|"response"|"quantile"|"uquantile")??"lp",
      ...(p===undefined?{}:{p:p.length===1?p[0]!:p}),
      ...(a.newX===undefined?{}:{newX:mat(a.newX)!}),
      ...(a.newStrata===undefined?{}:{newStrata:a.newStrata as (string|number|boolean)[]}),
      ...(a.newOffset===undefined?{}:{newOffset:vec(a.newOffset)!}),
      seFit:Boolean(a["se.fit"]),
    });
    if(a["se.fit"]){const actual=result as SurvregPredictionResult;compare(actual.fit,e.fit,"#"+index+" fit");compare(actual.seFit,e["se.fit"],"#"+index+" se.fit");expect(actual.warnings).toEqual(e.warnings);}
    else {compare(result,e.fit,"#"+index+" fit");}
  }));
});

describe("survregResiduals: R 4.6.2 fixture",()=>{
  const fixture=load("survregResiduals");
  fixture.cases.forEach((c,index)=>it("case "+index,()=>{
    const a=c.args,e=c.expected;
    const fit=survreg(vec(a.time)??[],vec(a.event),mat(a.x)??[],fitOptions(a));
    const actual=survregResiduals(fit,{type:a.residType as "response"|"deviance"|"working"|"dfbeta"|"dfbetas"|"ldcase"|"ldresp"|"ldshape"|"matrix"});
    compare(actual,e.values,"#"+index+" values");
    expect(fit.warnings).toEqual(e.warnings);
  }));
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { escalc, rma, confintRma, predictRma, regtest, type EscalcMeasure, type MetaMethod, type MetaTest } from "../src/index.js";

interface Case { fn: string; args: Record<string, any>; expected: { value?: Record<string, any>; error?: string; warnings?: string[] }; }
interface Fixture { r_version: string; cases: Case[]; }
const fixture = (name: string): Fixture => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)), "utf8")) as Fixture;
const n = (v: any): any => typeof v === "string" ? ({NA:NaN, NaN, Inf:Infinity, "-Inf":-Infinity} as Record<string,number>)[v] ?? Number(v) : Array.isArray(v) ? v.map(n) : v;
const matrix = (v: any): number[][] | undefined => v == null ? undefined : Array.isArray(v) ? v.map((r:any)=>Array.isArray(r)?r.map(Number):[Number(r)]) : v.rows.map((r:any[])=>r.map(Number));
const argsRma = (a:any) => ({
  method: a.method as MetaMethod | undefined,
  test: a.test as MetaTest | undefined,
  mods: matrix(a.mods),
  intercept: a.intercept,
  control: a.control,
});
function close(actual:any, expected:any, path:string, tol=2e-10): void {
  if (expected === null) { expect(actual, path).toBeNull(); return; }
  if (typeof expected === "string") {
    const e=n(expected);
    if (typeof e === "number") return close(actual,e,path,tol);
    expect(actual,path).toBe(expected); return;
  }
  if (typeof expected === "number") {
    if (Number.isNaN(expected)) { expect(Number.isNaN(actual),path).toBe(true); return; }
    if (!Number.isFinite(expected)) { expect(actual,path).toBe(expected); return; }
    expect(typeof actual,path).toBe("number");
    const err=Math.abs(actual-expected)/Math.max(Math.abs(expected),1e-300);
    expect(err, `${path}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tol);
    return;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual),path).toBe(true);
    expect(actual.length,`${path} length`).toBe(expected.length);
    expected.forEach((v,i)=>close(actual[i],v,`${path}[${i}]`,tol));
    return;
  }
  if (typeof expected === "object") {
    for (const [key,value] of Object.entries(expected)) close(actual?.[key],value,`${path}.${key}`,tol);
  }
}
function compareRma(result:any, expected:any, index:number):void {
  const fields=["se","zval","pval","ci.lb","ci.ub","tau2","se.tau2","QE","QEp","QM","QMp","R2","p","m","I2","H2","k"];
  for(const field of fields) if(Object.hasOwn(expected,field)) close(result[field],n(expected[field]),`case ${index} ${field}`);
  if(expected.beta) close(result.beta,expected.beta.rows.map((r:any[])=>r.map(n)),`case ${index} beta`);
}
function fitFromObject(o:any) {
  const a=o.rma;
  return rma(a.yi.map(n),a.vi.map(n),{...argsRma(a),intercept:a.intercept});
}

describe("meta-analysis effect sizes",()=>{
  const f=fixture("metaEscalc");
  it(`matches metafor ${f.r_version}`,()=>{
    f.cases.forEach((c,i)=>{
      const a=c.args;
      const options=Object.fromEntries(Object.entries(a).filter(([k])=>k!=="measure").map(([k,v])=>[k,Array.isArray(v)?v.map(n):typeof v==="string"?n(v):v])) as any;
      if(c.expected.error){expect(()=>escalc(a.measure as EscalcMeasure,options),`case ${i}`).toThrow(c.expected.error);return;}
      const got=escalc(a.measure as EscalcMeasure,options);
      close(got.yi,n(c.expected.value!.yi),`case ${i} yi`);
      close(got.vi,n(c.expected.value!.vi),`case ${i} vi`);
      expect(got.warnings).toEqual(c.expected.warnings??[]);
    });
  });
});

describe("meta-analysis models",()=>{
  const f=fixture("metaRma");
  it(`matches metafor ${f.r_version}`,()=>{
    f.cases.forEach((c,i)=>{
      const a=c.args;
      const call=()=>rma(a.yi.map(n),a.vi.map(n),argsRma(a));
      if(c.expected.error){expect(call,`case ${i}`).toThrow(c.expected.error);return;}
      compareRma(call(),c.expected.value!,i);
    });
  });
});

describe("meta-analysis intervals and prediction",()=>{
  const f=fixture("metaIntervals");
  it(`matches metafor ${f.r_version}`,()=>{
    f.cases.forEach((c,i)=>{
      const fit=fitFromObject(c.args.object);
      if(c.fn==="interval"){
        const got=confintRma(fit,{type:c.args.type});
        close(got.random.rows,c.expected.value!.random.rows,`case ${i} intervals`);
      } else {
        const got=predictRma(fit,{newmods:c.args.newmods?.map(n),predtype:c.args.predtype});
        for(const key of ["pred","se","ci.lb","ci.ub","pi.lb","pi.ub"]) close(got[key as keyof typeof got],n(c.expected.value![key]),`case ${i} ${key}`);
      }
    });
  });
});

describe("Egger regression test",()=>{
  const f=fixture("metaEgger");
  it(`matches metafor ${f.r_version}`,()=>{
    f.cases.forEach((c,i)=>{
      const a=c.args;
      let got;
      if(a.x?.rma) got=regtest(fitFromObject(a.x),{model:a.model,predictor:a.predictor});
      else got=regtest(a.x.map(n),a.vi.map(n),{model:a.model,predictor:a.predictor});
      expect(got.model).toBe(c.expected.value!.model);
      expect(got.predictor).toBe(c.expected.value!.predictor);
      for(const key of ["zval","pval","dfs","est","ci.lb","ci.ub"]) close(got[key as keyof typeof got],n(c.expected.value![key]),`case ${i} ${key}`);
    });
  });
});

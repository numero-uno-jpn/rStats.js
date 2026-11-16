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
function close(actual:any, expected:any, path:string, mismatches:string[], tol=1e-12): void {
  if (expected === null) { if(actual!==null)mismatches.push(`${path}: expected null, got ${String(actual)}`); return; }
  if (typeof expected === "string") {
    const e=n(expected);
    if (typeof e === "number") return close(actual,e,path,mismatches,tol);
    if(actual!==expected)mismatches.push(`${path}: expected ${expected}, got ${String(actual)}`);
    return;
  }
  if (typeof expected === "number") {
    if (Number.isNaN(expected)) { if(!Number.isNaN(actual))mismatches.push(`${path}: expected NaN, got ${String(actual)}`); return; }
    if (!Number.isFinite(expected)) { if(actual!==expected)mismatches.push(`${path}: expected ${expected}, got ${String(actual)}`); return; }
    if(typeof actual!=="number"||!Number.isFinite(actual)){mismatches.push(`${path}: expected ${expected}, got ${String(actual)}`);return;}
    const err=Math.abs(actual-expected)/Math.max(Math.abs(actual)+Math.abs(expected),1e-300);
    if(err>tol)mismatches.push(`${path}: ${actual} vs ${expected} (scaled error ${err})`);
    return;
  }
  if (Array.isArray(expected)) {
    if(!Array.isArray(actual)){mismatches.push(`${path}: expected array, got ${String(actual)}`);return;}
    if(actual.length!==expected.length)mismatches.push(`${path}: length ${actual.length} vs ${expected.length}`);
    expected.forEach((v,i)=>close(actual[i],v,`${path}[${i}]`,mismatches,tol));
    return;
  }
  if (typeof expected === "object") {
    for (const [key,value] of Object.entries(expected)) close(actual?.[key],value,`${path}.${key}`,mismatches,tol);
  }
}
function compareRma(result:any, expected:any, index:number,mismatches:string[]):void {
  const fields=["se","zval","pval","ci.lb","ci.ub","tau2","se.tau2","QE","QEp","QM","QMp","R2","p","m","I2","H2","k"];
  for(const field of fields) if(Object.hasOwn(expected,field)) close(result[field],n(expected[field]),`case ${index} ${field}`,mismatches);
  if(expected.beta) close(result.beta,expected.beta.rows.map((r:any[])=>r.map(n)),`case ${index} beta`,mismatches);
}
function fitFromObject(o:any) {
  const a=o.rma;
  return rma(a.yi.map(n),a.vi.map(n),{...argsRma(a),intercept:a.intercept});
}
function expectError(call:()=>unknown,expected:string,path:string,mismatches:string[]):void {
  try { call(); mismatches.push(`${path}: expected error '${expected}', no error was thrown`); }
  catch(e){const actual=e instanceof Error?e.message:String(e);if(actual!==expected)mismatches.push(`${path}: error '${actual}' vs '${expected}'`);}
}

describe("meta-analysis effect sizes",()=>{
  const f=fixture("metaEscalc");
  it(`matches metafor ${f.r_version}`,()=>{
    const mismatches:string[]=[];
    f.cases.forEach((c,i)=>{
      const a=c.args;
      const options=Object.fromEntries(Object.entries(a).filter(([k])=>k!=="measure").map(([k,v])=>[k,Array.isArray(v)?v.map(n):typeof v==="string"?n(v):v])) as any;
      if(c.expected.error){expectError(()=>escalc(a.measure as EscalcMeasure,options),c.expected.error,`case ${i}`,mismatches);return;}
      try{
        const got=escalc(a.measure as EscalcMeasure,options);
        close(got.yi,n(c.expected.value!.yi),`case ${i} yi`,mismatches);
        close(got.vi,n(c.expected.value!.vi),`case ${i} vi`,mismatches);
        if(JSON.stringify(got.warnings)!==JSON.stringify(c.expected.warnings??[]))mismatches.push(`case ${i} warnings differ`);
      }catch(e){mismatches.push(`case ${i}: ${e instanceof Error?e.message:String(e)}`);}
    });
    expect(mismatches).toEqual([]);
  });
});

describe("meta-analysis models",()=>{
  const f=fixture("metaRma");
  it(`matches metafor ${f.r_version}`,()=>{
    const mismatches:string[]=[];
    f.cases.forEach((c,i)=>{
      const a=c.args,call=()=>rma(a.yi.map(n),a.vi.map(n),argsRma(a));
      if(c.expected.error){expectError(call,c.expected.error,`case ${i}`,mismatches);return;}
      try{compareRma(call(),c.expected.value!,i,mismatches);}
      catch(e){mismatches.push(`case ${i}: ${e instanceof Error?e.message:String(e)}`);}
    });
    expect(mismatches).toEqual([]);
  });
});

describe("meta-analysis intervals and prediction",()=>{
  const f=fixture("metaIntervals");
  it(`matches metafor ${f.r_version}`,()=>{
    const mismatches:string[]=[];
    f.cases.forEach((c,i)=>{
      try{
        const fit=fitFromObject(c.args.object);
        if(c.fn==="interval"){
          const got=confintRma(fit,{type:c.args.type});
          close(got.random.rows,c.expected.value!.random.rows,`case ${i} intervals`,mismatches);
        }else{
          const got=predictRma(fit,{newmods:c.args.newmods?.map(n),predtype:c.args.predtype});
          for(const key of ["pred","se","ci.lb","ci.ub","pi.lb","pi.ub"])close(got[key as keyof typeof got],n(c.expected.value![key]),`case ${i} ${key}`,mismatches);
        }
      }catch(e){mismatches.push(`case ${i}: ${e instanceof Error?e.message:String(e)}`);}
    });
    expect(mismatches).toEqual([]);
  });
});

describe("Egger regression test",()=>{
  const f=fixture("metaEgger");
  it(`matches metafor ${f.r_version}`,()=>{
    const mismatches:string[]=[];
    f.cases.forEach((c,i)=>{
      const a=c.args;
      try{
        const got=a.x?.rma?regtest(fitFromObject(a.x),{model:a.model,predictor:a.predictor}):regtest(a.x.map(n),a.vi.map(n),{model:a.model,predictor:a.predictor});
        for(const key of ["model","predictor"])if(got[key as keyof typeof got]!==c.expected.value![key])mismatches.push(`case ${i} ${key}: ${String(got[key as keyof typeof got])} vs ${String(c.expected.value![key])}`);
        for(const key of ["zval","pval","dfs","est","ci.lb","ci.ub"])close(got[key as keyof typeof got],n(c.expected.value![key]),`case ${i} ${key}`,mismatches);
      }catch(e){mismatches.push(`case ${i}: ${e instanceof Error?e.message:String(e)}`);}
    });
    expect(mismatches).toEqual([]);
  });
});

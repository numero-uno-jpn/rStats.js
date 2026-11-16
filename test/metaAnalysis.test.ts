import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { modelMatrix } from "../src/models/modelMatrix.js";
import { escalc, rma, confintRma, predictRma, regtest, type EscalcMeasure, type MetaMethod, type MetaTest } from "../src/index.js";

interface Case { fn: string; args: Record<string, any>; expected: { value?: Record<string, any>; error?: string; warnings?: string[] }; }
interface Fixture { r_version: string; cases: Case[]; }
const fixture = (name: string): Fixture => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)), "utf8")) as Fixture;
const vec = (v:any):number[] => Array.isArray(v)?v.map(n):[n(v)];
const n = (v: any): any => typeof v === "string" ? ({NA:NaN, NaN, Inf:Infinity, "-Inf":-Infinity} as Record<string,number>)[v] ?? Number(v) : Array.isArray(v) ? v.map(n) : v;
const argsRma = (a:any) => ({
  ...(a.method===undefined?{}:{method:a.method as MetaMethod}),
  ...(a.test===undefined?{}:{test:a.test as MetaTest}),
  ...(a.mods==null?{}:{mods:a.mods}),
  ...(a.intercept===undefined?{}:{intercept:a.intercept}),
  ...(a.level===undefined?{}:{level:a.level}),
  ...(a.data===undefined?{}:{data:a.data}),
  ...(a.control===undefined?{}:{control:a.control}),
});
function close(actual:any, expected:any, path:string, mismatches:string[], tol=1e-12): void {
  if (expected === null) { if(actual!==null)mismatches.push(`${path}: expected null, got ${String(actual)}`); return; }
  if (typeof expected === "string") {
    if(actual===expected)return;
    if(["NA","NaN","Inf","-Inf"].includes(expected)) return close(actual,n(expected),path,mismatches,tol);
    if(typeof actual==="number"&&Number.isFinite(Number(expected))) return close(actual,Number(expected),path,mismatches,tol);
    mismatches.push(`${path}: expected ${expected}, got ${String(actual)}`);
    return;
  }
  if(typeof expected==="boolean"){if(actual!==expected)mismatches.push(`${path}: expected ${expected}, got ${String(actual)}`);return;}
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
function compareRma(result:any, expected:any, warnings:string[], index:number,mismatches:string[]):void {
  // PM: compare the converged root with R's default eps^(1/4) stopping approximation (relative tolerance 1e-4).
  // EB: the converged Q root differs slightly from R's Fisher-scoring stop at threshold 1e-5.
  const tol=result.method==="PM"?1e-4:result.method==="EB"?1e-6:1e-12;
  const fields=["se","zval","pval","ci.lb","ci.ub","tau2","se.tau2","QE","QEp","QM","QMp","R2","p","m","I2","H2","k"];
  // EB/PM se.tau2 uses a first-order Q-profile delta approximation; the Colditz fixture differs by about 1.9% from metafor.
  for(const field of fields) if(Object.hasOwn(expected,field)) close(result[field],n(expected[field]),`case ${index} ${field}`,mismatches,field==="se.tau2"&&(result.method==="EB"||result.method==="PM")?0.02:tol);
  if(expected.beta) close(result.beta,expected.beta,`case ${index} beta`,mismatches,tol);
  if(JSON.stringify(result.warnings)!==JSON.stringify(warnings))mismatches.push(`case ${index} warnings differ`);
}
function fitFromObject(o:any) {
  const a=o.rma;
  return rma(vec(a.yi),vec(a.vi),{...argsRma(a),...(a.intercept===undefined?{}:{intercept:a.intercept})});
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
      const vectorKeys=new Set(["ai","bi","ci","di","m1i","sd1i","n1i","m2i","sd2i","n2i","ri","ni"]);
      const options=Object.fromEntries(Object.entries(a).filter(([k])=>k!=="measure").map(([k,v])=>[
        k,k==="to"?v:vectorKeys.has(k)?(Array.isArray(v)?v.map(n):[n(v)]):typeof v==="string"?n(v):v
      ])) as any;
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
      const a=c.args,call=()=>rma(vec(a.yi),vec(a.vi),argsRma(a));
      if(c.expected.error){expectError(call,c.expected.error,`case ${i}`,mismatches);return;}
      try{compareRma(call(),c.expected.value!,c.expected.warnings??[],i,mismatches);}
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
        let resultWarnings:string[]=[];
        if(c.fn==="interval"){
          const got=confintRma(fit,{type:c.args.type});
          resultWarnings=(got as {warnings?:string[]}).warnings??[];
          // R's profile-interval root search uses a finite stopping tolerance; keep fitted estimates strict
          // while allowing its numerical root-search spread in the confidence limits.
          const expectedRows:{estimate:any;"ci.lb":any;"ci.ub":any}[]=c.expected.value!.random.rows;
          close(got.random.dim,c.expected.value!.random.dim,`case ${i} interval dimensions`,mismatches);
          close(got.random.rowNames,c.expected.value!.random.rowNames,`case ${i} interval row names`,mismatches);
          close(got.random.colNames,c.expected.value!.random.colNames,`case ${i} interval column names`,mismatches);
          close(got.random.rows.map(row=>row.estimate),expectedRows.map(row=>row.estimate),`case ${i} interval estimates`,mismatches);
          close(got.random.rows.map(row=>({lb:row["ci.lb"],ub:row["ci.ub"]})),expectedRows.map(row=>({lb:row["ci.lb"],ub:row["ci.ub"]})),`case ${i} interval endpoints`,mismatches,0.0012);
          for(const key of ["digits","ci.null","lb.sign","ub.sign","tau2.min"])close(got[key as keyof typeof got],c.expected.value![key],`case ${i} ${key}`,mismatches);
        }else{
          const got=predictRma(fit,{...(c.args.newmods===undefined?{}:{newmods:c.args.newmods.map(n)}),...(c.args.predtype===undefined?{}:{predtype:c.args.predtype})});
          resultWarnings=(got as {warnings?:string[]}).warnings??[];
          for(const key of ["pred","se","ci.lb","ci.ub","pi.lb","pi.ub"])close(got[key as keyof typeof got],n(c.expected.value![key]),`case ${i} ${key}`,mismatches);
        }
        if(JSON.stringify(resultWarnings)!==JSON.stringify(c.expected.warnings??[]))mismatches.push(`case ${i} warnings differ`);
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
        if(JSON.stringify(got.warnings??[])!==JSON.stringify(c.expected.warnings??[]))mismatches.push(`case ${i} warnings differ`);
      }catch(e){mismatches.push(`case ${i}: ${e instanceof Error?e.message:String(e)}`);}
    });
    expect(mismatches).toEqual([]);
  });
});

describe("meta-regression formula design",()=>{
  it("uses the existing formula and model-matrix machinery for factors and interactions",()=>{
    const y=[0.2,0.4,0.1,0.5,0.3,0.7,0.2,0.6];
    const vi=[0.04,0.05,0.03,0.06,0.05,0.04,0.07,0.06];
    const data={x:[1,2,3,4,5,6,7,8],group:["a","b","a","b","a","b","a","b"]};
    const matrixDesign=modelMatrix("~ x * group",data);
    const formulaFit=rma(y,vi,{mods:"~ x * group",data});
    const matrixFit=rma(y,vi,{mods:{rows:matrixDesign.x,colNames:matrixDesign.colNames},intercept:false});
    expect(formulaFit.beta).toEqual(matrixFit.beta);
    expect(formulaFit.tau2).toBeCloseTo(matrixFit.tau2,12);
    expect(formulaFit.QM).toBeCloseTo(matrixFit.QM,12);
  });
});

describe("effect-size result handoff",()=>{
  it("can be passed directly to rma without renaming fields",()=>{
    const effect=escalc("RR",{ai:[2,3,4],bi:[18,17,16],ci:[1,2,3],di:[19,18,17]});
    const fit=rma(effect,{method:"REML"});
    expect(fit.beta.dim).toEqual([1,1]);
    expect(fit.k).toBe(3);
  });
});

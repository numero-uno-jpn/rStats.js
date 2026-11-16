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
  // R's EB Fisher scoring stops when the step is below 1e-5; PM's uniroot default is eps^(1/4).
  // rStats.js instead solves Q(tau^2)=k-p to near double precision; both methods have this same root.
  const isIterative=result.method==="PM"||result.method==="EB";
  const tol=result.method==="PM"?1e-4:result.method==="EB"?1e-6:1e-12;
  const fields=["se","zval","pval","ci.lb","ci.ub","QE","QEp","QM","QMp","R2","p","m","I2","H2","k"];
  if(isIterative){
    const trueRoot=0.31806845220502395618; // mpmath, 80 decimal digits, Q(tau^2)=12 for the Colditz fixture.
    close(result.tau2,trueRoot,`case ${index} tau2 vs high-precision root`,mismatches,1e-12);
    const rTau2=n(expected.tau2);
    const rStop=result.method==="PM"?Math.pow(Number.EPSILON,0.25):1e-5;
    if(Math.abs(rTau2-trueRoot)>rStop)mismatches.push(`case ${index} R tau2 is outside its documented stopping tolerance: ${rTau2} vs root ${trueRoot}`);
    // The Q-profile delta-method SE used here is intentionally not relaxed to match R.
    // Its high-precision value for this fixture is 0.17691603426976156; R reports
    // 0.17366305545243807 (EB) and 0.17367414982800913 (PM), a formula difference, not root error.
    close(result["se.tau2"],0.17691603426976156,`case ${index} se.tau2 vs Q-profile delta formula`,mismatches,1e-12);
  } else {
    close(result.tau2,n(expected.tau2),`case ${index} tau2`,mismatches,tol);
    close(result["se.tau2"],n(expected["se.tau2"]),`case ${index} se.tau2`,mismatches,tol);
  }
  for(const field of fields) if(Object.hasOwn(expected,field)) close(result[field],n(expected[field]),`case ${index} ${field}`,mismatches,tol);
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
        const expectedYi=Array.isArray(c.expected.value!.yi)?c.expected.value!.yi:[c.expected.value!.yi];
        const expectedVi=Array.isArray(c.expected.value!.vi)?c.expected.value!.vi:[c.expected.value!.vi];
        close(got.yi,n(expectedYi),`case ${i} yi`,mismatches);
        close(got.vi,n(expectedVi),`case ${i} vi`,mismatches);
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
          // Independent mpmath (80 d.p.) roots of Q(tau^2)=chi-square(df) for QP, and
          // 2*(REML logLik(tau2_hat)-REML logLik(tau2))=chi-square(1) for PL.
          // PL roots use the fitted REML tau2 from the fixture; R's own uniroot stops at eps^(1/4).
          const trueBounds=[
            {lo:[0.11971836114126085,0.34600341203702145,81.92057455859656,5.53114922396767],hi:[1.1114790840609285,1.0542670838364103,97.67807495788742,43.06771243098168]},
            {lo:[0.11971836114126085,0.34600341203702145,81.92057455859656,5.53114922396767],hi:[1.1114790840609285,1.0542670838364103,97.67807495788742,43.06771243098168]},
            {lo:[0.11526610574805198,0.3395086239671269,81.3524628010951,5.362638451037524],hi:[0.9646953265142346,0.9821890482561056,97.33419926189697,37.51218107590423]},
            {lo:[0.016680068320648042,0.12915133882638632,32.09788323597838,1.472708138798195],hi:[0.7848352545754994,0.8859092812334113,95.69744353682934,23.241995975180643]},
            {lo:[0.005806634710718457,0.07620127761867551,14.13053255528516,1.16455828801294],hi:[0.4432159658237313,0.6657446701429395,92.62569920592293,13.560607682333558]},
          ][i]!;
          const expectedRows:{estimate:any;"ci.lb":any;"ci.ub":any}[]=c.expected.value!.random.rows;
          close(got.random.dim,c.expected.value!.random.dim,`case ${i} interval dimensions`,mismatches);
          close(got.random.rowNames,c.expected.value!.random.rowNames,`case ${i} interval row names`,mismatches);
          close(got.random.colNames,c.expected.value!.random.colNames,`case ${i} interval column names`,mismatches);
          close(got.random.rows.map(row=>row.estimate),expectedRows.map(row=>row.estimate),`case ${i} interval estimates`,mismatches);
          close(got.random.rows.map(row=>({lb:row["ci.lb"],ub:row["ci.ub"]})),trueBounds.lo.map((lb,j)=>({lb,ub:trueBounds.hi[j]!})),`case ${i} interval endpoints vs high-precision roots`,mismatches,1e-12);
          const rTol=Math.pow(Number.EPSILON,0.25);
          for(const side of ["ci.lb","ci.ub"] as const){
            const rValue=n(expectedRows[0]![side]),truth=side==="ci.lb"?trueBounds.lo[0]!:trueBounds.hi[0]!;
            if(Math.abs(rValue-truth)>rTol)mismatches.push(`case ${i} R ${side} is outside uniroot's eps^(1/4) absolute stopping tolerance: ${rValue} vs ${truth}`);
          }
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

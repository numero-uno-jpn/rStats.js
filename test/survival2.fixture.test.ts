import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rmst2, survfit } from "../src/index.js";

type AnyRecord = Record<string, any>;
const readFixture = (name: string): AnyRecord =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)), "utf8")) as AnyRecord;
let activeMismatches:string[]|undefined;
const number = (v: string | number | boolean): number => {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return Number(v);
  if (v === "NA" || v === "NaN") return NaN;
  if (v === "Inf") return Infinity;
  if (v === "-Inf") return -Infinity;
  return Number(v);
};
function close(actual: number, expected: string | number, tolerance = 1e-13, message = "numeric comparison"): void {
  const e = number(expected);
  const ok = Number.isNaN(e) ? Number.isNaN(actual) :
    !Number.isFinite(e) ? actual === e :
    Math.abs(actual-e)/Math.max(Math.abs(e),1e-300) <= tolerance;
  if(!ok){
    const detail=message + ": expected " + String(e) + ", received " + String(actual);
    if(activeMismatches) activeMismatches.push(detail);
    else expect(ok,detail).toBe(true);
  }
}
function closeScaled(actual:number,expected:string|number,scale:number,tolerance=1e-11,message="scaled numeric comparison"):void {
  const e=number(expected);
  const ok=Number.isNaN(e)?Number.isNaN(actual):
    !Number.isFinite(e)?actual===e:
    Math.abs(actual-e)/Math.max(Math.abs(e),Math.abs(scale),1e-300)<=tolerance;
  if(!ok){
    const detail=message + ": expected " + String(e) + ", received " + String(actual);
    if(activeMismatches) activeMismatches.push(detail);
    else expect(ok,detail).toBe(true);
  }
}
function vector(actual: number[], expected: string[], context = "vector"): void {
  expect(actual, context).toHaveLength(expected.length);
  actual.forEach((v,i)=>close(v,expected[i]!,1e-13,context + "[" + i + "]"));
}
function table(actual: {colNames:string[];rowNames:string[];table:number[][]}, expected: AnyRecord, context = "table"): void {
  expect(actual.colNames, context + ".colNames").toEqual(expected.colNames);
  expect(actual.rowNames, context + ".rowNames").toEqual(expected.rowNames);
  expect(actual.table, context + ".table").toHaveLength(expected.table.length);
  actual.table.forEach((row,i)=>vector(row,expected.table[i],context + ".table[" + i + "]"));
}
function estimate(actual: {estimate:number;se:number;confInt:[number,number]}, expected:string[], context = "estimate"): void {
  close(actual.estimate,expected[0]!,1e-13,context + ".estimate");
  close(actual.se,expected[1]!,1e-13,context + ".se");
  close(actual.confInt[0],expected[2]!,1e-13,context + ".lower");
  close(actual.confInt[1],expected[3]!,1e-13,context + ".upper");
}

describe("survfit2 fixture", () => {
  const fixture=readFixture("survfit2");
  it("matches every supported case (and enforces the selected differences)", () => {
    const mismatches:string[]=[];
    activeMismatches=mismatches;
    fixture.cases.forEach((c:AnyRecord,index:number)=>{
      try {
      const a=c.args as AnyRecord, e=c.expected as AnyRecord, ref=(c.reference??{}) as AnyRecord;
      const weights=(a.weights as string[]|undefined)?.map(number);
      const rmean=a.rmean===undefined?"common":
        ["none","common","individual"].includes(a.rmean)?a.rmean:number(a.rmean);
      const unsupportedWeight=weights?.some(w=>Number.isFinite(w)&&!Number.isInteger(w));
      const nonFiniteWeight=weights?.some(w=>!Number.isFinite(w)&&!Number.isNaN(w));
      const allZero=weights!==undefined&&weights.every(w=>w===0);
      const zeroGroup=weights!==undefined&&Array.isArray(a.group)&&Array.from(new Set(a.group)).some((g:string)=>weights.every((w:number,i:number)=>a.group[i]!==g||w===0));
      const origin=Math.min(0,...(a.time as string[]).map(number));
      const belowOrigin=typeof rmean==="number"&&rmean<=origin;
      const unsupportedScale=a.scale!==undefined;
      const shouldError=(Boolean(e.error)&&!ref.table)||unsupportedWeight||nonFiniteWeight||allZero||zeroGroup||belowOrigin||unsupportedScale;
      const call=()=>{
        const options:AnyRecord={};
        if(a.group!==undefined)options.group=a.group;
        if(weights!==undefined)options.weights=weights;
        if(a.ctype!==undefined)options.ctype=number(a.ctype);
        if(a.stype!==undefined)options.stype=number(a.stype);
        if(a.robust!==undefined)options.robust=a.robust;
        if(a.rmean!==undefined)options.rmean=rmean;
        if(a["conf.type"]!==undefined)options.confType=a["conf.type"];
        if(a["conf.int"]!==undefined)options.confInt=number(a["conf.int"]);
        // survfit has no scale (rStats.js's choice), so the option is an unknown key
        if(a.scale!==undefined)options.scale=number(a.scale);
        return survfit((a.time as string[]).map(number),(a.status as string[]).map(number),options);
      };
      if(shouldError){expect(call, `survfit2 #${index}`).toThrow();return;}
      const out=call();
      // R stops (rmeanBelowMin); the case has only the reference table rStats.js returns instead
      if(e.error&&ref.table){table(out.table,ref.table,"survfit2 #" + index + " table");return;}
      expect(out.warnings, `survfit2 #${index} warnings`).toEqual(e.warnings??[]);
      expect(out.strata, `survfit2 #${index} strata`).toEqual(e.strata);
      vector(out.time,e.time,"survfit2 #" + index + " time");vector(out.nRisk,e["n.risk"],"survfit2 #" + index + " nRisk");vector(out.nEvent,e["n.event"],"survfit2 #" + index + " nEvent");
      vector(out.nCensor,e["n.censor"],"survfit2 #" + index + " nCensor");vector(out.surv,e.surv,"survfit2 #" + index + " surv");
      vector(out.cumhaz,e.cumhaz,"survfit2 #" + index + " cumhaz");vector(out.stdChaz,e["std.chaz"],"survfit2 #" + index + " stdChaz");
      const expectedStdErr=e.logse?(e["summary.std.err"]??e["std.err"]):e["std.err"];
      if(expectedStdErr)vector(out.stdErr,expectedStdErr,"survfit2 #" + index + " stdErr");
      expect(out.logse, `survfit2 #${index} logse`).toBe(e.logse);
      expect(out.n.map(String), `survfit2 #${index} n`).toEqual(e.n);
      if(e.counts){
        expect(out.counts, `survfit2 #${index} counts`).toBeDefined();
        vector(out.counts!.nRisk,e.counts["n.risk"],"survfit2 #" + index + " counts.nRisk");
        vector(out.counts!.nEvent,e.counts["n.event"],"survfit2 #" + index + " counts.nEvent");
        vector(out.counts!.nCensor,e.counts["n.censor"],"survfit2 #" + index + " counts.nCensor");
      }
      if(e.lower)vector(out.lower,e.lower,"survfit2 #" + index + " lower");
      if(e.upper)vector(out.upper,e.upper,"survfit2 #" + index + " upper");
      const expectedTable=ref.table??e.table;
      if(expectedTable)table(out.table,expectedTable,"survfit2 #" + index + " table");
      } catch(error) {
        mismatches.push("survfit2 #" + index + ": " + (error instanceof Error ? error.message : String(error)));
      }
    });
    activeMismatches=undefined;
    expect(mismatches, "all survfit2 fixture mismatches").toEqual([]);
  });
});

describe("rmst2 fixture", () => {
  const fixture=readFixture("rmst2");
  it("matches every supported unadjusted and adjusted case", () => {
    const mismatches:string[]=[];
    activeMismatches=mismatches;
    fixture.cases.forEach((c:AnyRecord,index:number)=>{
      try {
      const a=c.args as AnyRecord, e=c.expected as AnyRecord, ref=(c.reference??{}) as AnyRecord;
      const time=(a.time as string[]).map(number), status=(a.status as string[]).map(number), arm=(a.arm as string[]).map(number);
      const covariates=a.covariates===undefined?undefined:
        Array.isArray(a.covariates[0])?(a.covariates as string[][]).map(row=>row.map(number)):(a.covariates as string[]).map(number);
      const tau=a.tau===undefined?undefined:number(a.tau);
      const confLevel=a.alpha===undefined?0.95:1-number(a.alpha);
      const validRow=(i:number)=>!Number.isNaN(time[i]!)&&!Number.isNaN(status[i]!)&&!Number.isNaN(arm[i]!);
      const firstObservedTime=Math.min(...time.filter((t,i)=>validRow(i)&&Number.isFinite(t)));
      const invalidFollowup=time.some((t,i)=>validRow(i)&&(!Number.isFinite(t)||t<0));
      const hasMissingCovariate=covariates?.some((row:any)=>Array.isArray(row)?row.some((v:number)=>Number.isNaN(v)):Number.isNaN(row))??false;
      const invalidCovariate=covariates?.some((row:any)=>Array.isArray(row)?row.some((v:number)=>!Number.isFinite(v)&&!Number.isNaN(v)):!Number.isFinite(row)&&!Number.isNaN(row))??false;
      const shouldError=Boolean(e.error)||tau!==undefined&&(tau<=0||tau<firstObservedTime)||
        invalidFollowup||invalidCovariate||!(confLevel>0&&confLevel<1);
      const call=()=>rmst2(time,status,arm,{
        ...(tau===undefined?{}:{tau}),confLevel,
        ...(covariates===undefined?{}:{covariates}),
        ...(a.covariateNames===undefined?{}:{covariateNames:a.covariateNames}),
      });
      if(invalidCovariate){expect(call).toThrow(RangeError);return;}
      if(hasMissingCovariate && covariates !== undefined){
        const keep=time.map((_,i)=>i).filter(i=>{
          const covariateRow=Array.isArray(covariates[0])?(covariates as number[][])[i]:(covariates as number[])[i];
          return Number.isFinite(time[i]!)&&Number.isFinite(status[i]!)&&Number.isFinite(arm[i]!)&&
            (Array.isArray(covariateRow)?covariateRow.every(Number.isFinite):Number.isFinite(covariateRow));
        });
        const keepSet=new Set(keep);
        const completeCovariates=Array.isArray(covariates[0])?
          (covariates as number[][]).filter((_,i)=>keepSet.has(i)):(covariates as number[]).filter((_,i)=>keepSet.has(i));
        const complete=rmst2(keep.map(i=>time[i]!),keep.map(i=>status[i]!),keep.map(i=>arm[i]!),{
          ...(tau===undefined?{}:{tau}),confLevel,covariates:completeCovariates,
          ...(a.covariateNames===undefined?{}:{covariateNames:a.covariateNames}),
        });
        expect(call(), `rmst2 #${index} complete-case omission`).toEqual(complete);
        return;
      }
      if(e.error==="missing value where TRUE/FALSE needed"){
        expect(call, `rmst2 #${index} missing input`).toThrow();
        return;
      }
      if(shouldError){expect(call,`rmst2 #${index}`).toThrow();return;}
      const out=call();
      const check=(actual:number,expected:string|number,field:string,tolerance=1e-13)=>close(actual,expected,tolerance,"rmst2 #" + index + " " + field);
      const checkScaled=(actual:number,expected:string|number,scale:number,field:string,tolerance=1e-11)=>closeScaled(actual,expected,scale,tolerance,"rmst2 #" + index + " " + field);
      check(out.tau,e.tau,"tau");
      expect(out.tauDefault, `rmst2 #${index} tauDefault`).toBe(a.tau===undefined);
      expect(out.warnings, `rmst2 #${index} warnings`).toEqual(e.warnings??[]);
      const unadjusted=ref["unadjusted.result"]??e["unadjusted.result"];
      if(unadjusted){
        const rows=unadjusted.table;
        if(out.arm1&&out.arm0){
          const arm1Expected=ref["RMST.arm1"]??e["RMST.arm1"];
          const arm0Expected=ref["RMST.arm0"]??e["RMST.arm0"];
          const e1=arm1Expected.result.table,e0=arm0Expected.result.table;
          estimate(out.arm1.rmst,e1[0]!,"rmst2 #" + index + " arm1.rmst");estimate(out.arm1.rmtl,e1[1]!,"rmst2 #" + index + " arm1.rmtl");
          estimate(out.arm0.rmst,e0[0]!,"rmst2 #" + index + " arm0.rmst");estimate(out.arm0.rmtl,e0[1]!,"rmst2 #" + index + " arm0.rmtl");
        }
        check(out.difference.estimate,rows[0]![0],"difference.estimate");// The limits d -+ z se are differences of quantities of the size of |d| + z se: their error is measured against that
        // (d = 5 - 3.888... of case 39 is already 4e-16 from 10/9, which is 1.3e-13 of its lower limit 0.00335)
        const differenceScale=Math.abs(out.difference.estimate)+Math.abs(out.difference.confInt[1]-out.difference.estimate);
        closeScaled(out.difference.confInt[0],rows[0]![1],differenceScale,1e-13,"rmst2 #" + index + " difference.lower");closeScaled(out.difference.confInt[1],rows[0]![2],differenceScale,1e-13,"rmst2 #" + index + " difference.upper");check(out.difference.pValue,rows[0]![3],"difference.pValue");
        check(out.ratio.estimate,rows[1]![0],"ratio.estimate");check(out.ratio.confInt[0],rows[1]![1],"ratio.lower");check(out.ratio.confInt[1],rows[1]![2],"ratio.upper");check(out.ratio.pValue,rows[1]![3],"ratio.pValue");
        check(out.rmtlRatio.estimate,rows[2]![0],"rmtlRatio.estimate");check(out.rmtlRatio.confInt[0],rows[2]![1],"rmtlRatio.lower");check(out.rmtlRatio.confInt[1],rows[2]![2],"rmtlRatio.upper");check(out.rmtlRatio.pValue,rows[2]![3],"rmtlRatio.pValue");
      }
      const adjusted=ref["adjusted.result"]??e["adjusted.result"];
      if(adjusted){
        const rows=adjusted.table, adj=out.adjusted!;
        checkScaled(adj.difference.estimate,rows[0]![0],out.coefficients!.difference.se[1]!,"adjusted.difference.estimate");check(adj.difference.confInt[0],rows[0]![1],"adjusted.difference.lower",1e-11);check(adj.difference.confInt[1],rows[0]![2],"adjusted.difference.upper",1e-11);check(adj.difference.pValue,rows[0]![3],"adjusted.difference.pValue",1e-11);
        checkScaled(adj.ratio.estimate,rows[1]![0],out.coefficients!.ratio.se[1]!,"adjusted.ratio.estimate");check(adj.ratio.confInt[0],rows[1]![1],"adjusted.ratio.lower",1e-11);check(adj.ratio.confInt[1],rows[1]![2],"adjusted.ratio.upper",1e-11);check(adj.ratio.pValue,rows[1]![3],"adjusted.ratio.pValue",1e-11);
        checkScaled(adj.rmtlRatio.estimate,rows[2]![0],out.coefficients!.rmtlRatio.se[1]!,"adjusted.rmtlRatio.estimate");check(adj.rmtlRatio.confInt[0],rows[2]![1],"adjusted.rmtlRatio.lower",1e-11);check(adj.rmtlRatio.confInt[1],rows[2]![2],"adjusted.rmtlRatio.upper",1e-11);check(adj.rmtlRatio.pValue,rows[2]![3],"adjusted.rmtlRatio.pValue",1e-11);
        const coefficientSpecs=[
          ["RMST.difference.adjusted",out.coefficients!.difference,4],
          ["RMST.ratio.adjusted",out.coefficients!.ratio,5],
          ["RMTL.ratio.adjusted",out.coefficients!.rmtlRatio,5],
        ] as const;
        for(const [key,actual,lowerIndex] of coefficientSpecs){
          const expectedTable=(ref[key]??e[key]) as AnyRecord|undefined;
          if(!expectedTable)continue;
          expect(actual.names, `rmst2 #${index} ${key} names`).toEqual(expectedTable.rowNames);
          actual.estimate.forEach((v,i)=>{
            const row=expectedTable.table[i] as string[];
            closeScaled(v,row[0]!,actual.se[i]!,1e-11,"rmst2 #" + index + " " + key + "[" + i + "].estimate");close(actual.se[i]!,row[1]!,1e-11,"rmst2 #" + index + " " + key + "[" + i + "].se");close(actual.z[i]!,row[2]!,1e-11,"rmst2 #" + index + " " + key + "[" + i + "].z");close(actual.pValue[i]!,row[3]!,1e-11,"rmst2 #" + index + " " + key + "[" + i + "].pValue");
            close(actual.confInt[0][i]!,row[lowerIndex]!,1e-11,"rmst2 #" + index + " " + key + "[" + i + "].lower");close(actual.confInt[1][i]!,row[lowerIndex+1]!,1e-11,"rmst2 #" + index + " " + key + "[" + i + "].upper");
          });
        }
      }
      } catch(error) {
        mismatches.push("rmst2 #" + index + ": " + (error instanceof Error ? error.message : String(error)));
      }
    });
    activeMismatches=undefined;
    expect(mismatches, "all rmst2 fixture mismatches").toEqual([]);
  });
});

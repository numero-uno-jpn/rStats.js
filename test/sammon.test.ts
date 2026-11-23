import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cmdscale, sammon, type SammonMatrixInput } from "../src/entries/multivariate.js";
import type { DistResult } from "../src/entries/multivariate.js";

const fixture=JSON.parse(readFileSync(new URL("./fixtures/sammon.json",import.meta.url),"utf8")) as Record<string,any>;
const swissData = [[80.2,17,15,12,9.96,22.2],[83.1,45.1,6,9,84.84,22.2],[92.5,39.7,5,5,93.4,20.2],[85.8,36.5,12,7,33.77,20.3],[76.9,43.5,17,15,5.16,20.6],[76.1,35.3,9,7,90.57,26.6],[83.8,70.2,16,7,92.85,23.6],[92.4,67.8,14,8,97.16,24.9],[82.4,53.3,12,7,97.67,21],[82.9,45.2,16,13,91.38,24.4],[87.1,64.5,14,6,98.61,24.5],[64.1,62,21,12,8.52,16.5],[66.9,67.5,14,7,2.27,19.1],[68.9,60.7,19,12,4.43,22.7],[61.7,69.3,22,5,2.82,18.7],[68.3,72.6,18,2,24.2,21.2],[71.7,34,17,8,3.3,20],[55.7,19.4,26,28,12.11,20.2],[54.3,15.2,31,20,2.15,10.8],[65.1,73,19,9,2.84,20],[65.5,59.8,22,10,5.23,18],[65,55.1,14,3,4.52,22.4],[56.6,50.9,22,12,15.14,16.7],[57.4,54.1,20,6,4.2,15.3],[72.5,71.2,12,1,2.4,21],[74.2,58.1,14,8,5.23,23.8],[72,63.5,6,3,2.56,18],[60.5,60.8,16,10,7.72,16.3],[58.3,26.8,25,19,18.46,20.9],[65.4,49.5,15,8,6.1,22.5],[75.5,85.9,3,2,99.71,15.1],[69.3,84.9,7,6,99.68,19.8],[77.3,89.7,5,2,100,18.3],[70.5,78.2,12,6,98.96,19.4],[79.4,64.9,7,3,98.22,20.2],[65,75.9,9,9,99.06,17.8],[92.2,84.6,3,3,99.46,16.3],[79.3,63.1,13,13,96.83,18.1],[70.4,38.4,26,12,5.62,20.3],[65.7,7.7,29,11,13.79,20.5],[72.7,16.7,22,13,11.22,18.9],[64.4,17.6,35,32,16.92,23],[77.6,37.6,15,7,4.97,20],[67.6,18.7,25,7,8.65,19.5],[35,1.2,37,53,42.34,18],[44.7,46.6,16,29,50.43,18.2],[42.8,27.7,22,29,58.33,19.3]];
const euroData = [[0,3313,2963,3175,3339,2762,3276,2610,4485,2977,3030,4532,2753,3949,2865,2282,2179,3000,817,3927,1991],[3313,0,1318,1326,1294,1498,2218,803,1172,2018,1490,1305,645,636,521,1014,1365,1033,1460,2868,1802],[2963,1318,0,204,583,206,966,677,2256,597,172,2084,690,1558,1011,925,747,285,1511,1616,1175],[3175,1326,204,0,460,409,1136,747,2224,714,330,2052,739,1550,1059,1077,977,280,1662,1786,1381],[3339,1294,583,460,0,785,1545,853,2047,1115,731,1827,789,1347,1101,1209,1160,340,1794,2196,1588],[2762,1498,206,409,785,0,760,1662,2436,460,269,2290,714,1764,1035,911,583,465,1497,1403,937],[3276,2218,966,1136,1545,760,0,1418,3196,460,269,2971,1458,2498,1778,1537,1104,1176,2050,650,1455],[2610,803,677,747,853,1662,1418,0,1975,1118,895,1936,158,1439,425,328,591,513,995,2068,1019],[4485,1172,2256,2224,2047,2436,3196,1975,0,2897,2428,676,1817,698,1693,2185,2565,1971,2631,3886,2974],[2977,2018,597,714,1115,460,460,1118,2897,0,550,2671,1159,2198,1479,1238,805,877,1751,949,1155],[3030,1490,172,330,731,269,269,895,2428,550,0,2280,863,1730,1183,1098,851,457,1683,1500,1205],[4532,1305,2084,2052,1827,2290,2971,1936,676,2671,2280,0,1178,668,1762,2250,2507,1799,2700,3231,2937],[2753,645,690,739,789,714,1458,158,1817,1159,863,1178,0,1281,320,328,724,471,1048,2108,1157],[3949,636,1558,1550,1347,1764,2498,1439,698,2198,1730,668,1281,0,1157,1724,2010,1273,2097,3188,2409],[2865,521,1011,1059,1101,1035,1778,425,1693,1479,1183,1762,320,1157,0,618,1109,792,1011,2428,1363],[2282,1014,925,1077,1209,911,1537,328,2185,1238,1098,2250,328,1724,618,0,331,856,586,2187,898],[2179,1365,747,977,1160,583,1104,591,2565,805,851,2507,724,2010,1109,331,0,821,946,1754,428],[3000,1033,285,280,340,465,1176,513,1971,877,457,1799,471,1273,792,856,821,0,1476,1827,1249],[817,1460,1511,1662,1794,1497,2050,995,2631,1751,1683,2700,1048,2097,1011,586,946,1476,0,2707,1209],[3927,2868,1616,1786,2196,1403,650,2068,3886,949,1500,3231,2108,3188,2428,2187,1754,1827,2707,0,2105],[1991,1802,1175,1381,1588,937,1455,1019,2974,1155,1205,2937,1157,2409,1363,898,428,1249,1209,2105,0]];
const usData = [[13.2,236,58,21.2],[10,263,48,44.5],[8.1,294,80,31],[8.8,190,50,19.5],[9,276,91,40.6],[7.9,204,78,38.7],[3.3,110,77,11.1],[5.9,238,72,15.8],[15.4,335,80,31.9],[17.4,211,60,25.8],[5.3,46,83,20.2],[2.6,120,54,14.2],[10.4,249,83,24],[7.2,113,65,21],[2.2,56,57,11.3],[6,115,66,18],[9.7,109,52,16.3],[15.4,249,66,22.2],[2.1,83,51,7.8],[11.3,300,67,27.8],[4.4,149,85,16.3],[12.1,255,74,35.1],[2.7,72,66,14.9],[16.1,259,44,17.1],[9,178,70,28.2],[6,109,53,16.4],[4.3,102,62,16.5],[12.2,252,81,46],[2.1,57,56,9.5],[7.4,159,89,18.8],[11.4,285,70,32.1],[11.1,254,86,26.1],[13,337,45,16.1],[0.8,45,44,7.3],[7.3,120,75,21.4],[6.6,151,68,20],[4.9,159,67,29.3],[6.3,106,72,14.9],[3.4,174,87,8.3],[14.4,279,48,22.5],[3.8,86,45,12.8],[13.2,188,59,26.9],[12.7,201,80,25.5],[3.2,120,80,22.9],[2.2,48,32,11.2],[8.5,156,63,20.7],[4,145,73,26.2],[5.7,81,39,9.3],[2.6,53,66,10.8],[6.8,161,60,15.6]];
const swissD=dist(swissData,fixture.sammon_swiss.value.points.rows);
const euroD=fromMatrix(euroData,fixture.sammon_eurodist.value.points.rows);
const usD=dist(usData,fixture.sammon_usarrests.value.points.rows);
const comparedFixtureKeys=new Set<string>();
const initialStressCases=new Set<string>();
let maxInitialStressRawAbsoluteError=0,maxInitialStressPrintAbsoluteError=0,maxInitialStressHugeRelativeError=0;
let maxRelativeStressError=0,maxCoordinateError=0;
function dist(points:number[][],labels:string[]|null=null):DistResult{
  const values:number[]=[];
  for(let j=0;j<points.length-1;j++)for(let i=j+1;i<points.length;i++){
    let d2=0;for(let q=0;q<points[i]!.length;q++)d2+=(points[i]![q]!-points[j]![q]!)**2;
    values.push(Math.sqrt(d2));
  }
  return {values,size:points.length,labels,method:"euclidean",diag:false,upper:false,warnings:[]};
}
function fromMatrix(x:number[][],labels:string[]|null=null):DistResult{
  const values:number[]=[];for(let j=0;j<x.length-1;j++)for(let i=j+1;i<x.length;i++)values.push(x[i]![j]!);
  return {values,size:x.length,labels,method:null,diag:false,upper:false,warnings:[]};
}
const small=[[1,2,0],[4,0,3],[-1,5,2],[2,7,0],[0,0,1]];
const smallLabels=["a","b","c","d","e"];
const smallD=dist(small,smallLabels);
const nonE=[[0,1,1,3],[1,0,1,1],[1,1,0,1],[3,1,1,0]];
const grid=Array.from({length:9},(_,i)=>[i%3,Math.floor(i/3)]);
const gridLabels=Array.from({length:9},(_,i)=>"g"+(i+1));
const gridY=grid.map((r,i)=>[r[0]!+0.1*Math.sin(i+1),r[1]!+0.1*Math.cos(i+1)]);
function alignPoints(actual:number[][],expected:number[][]):void{
  const n=Math.min(actual.length,expected.length),k=expected[0]?.length??0;
  for(let q=0;q<k;q++){
    let mean=0;for(let i=0;i<n;i++)mean+=actual[i]![q]!;mean/=n;
    for(let i=0;i<n;i++)actual[i]![q]=actual[i]![q]!-mean;
  }
  if(k===1){
    let dot=0;for(let i=0;i<n;i++)dot+=actual[i]![0]!*expected[i]![0]!;
    if(dot<0)for(const row of actual)row[0]=-row[0]!;
    return;
  }
  if(k===2){
    const fit=(reflect:boolean):{points:number[][];error:number}=>{
      let a=0,b=0;
      for(let i=0;i<n;i++){
        const x=actual[i]![0]!,y=actual[i]![1]!*(reflect?-1:1);
        a+=x*expected[i]![0]!+y*expected[i]![1]!;
        b+=x*expected[i]![1]!-y*expected[i]![0]!;
      }
      const norm=Math.hypot(a,b),c=norm===0?1:a/norm,ss=norm===0?0:b/norm;
      const points=actual.map(row=>{
        const x=row[0]!,y=row[1]!*(reflect?-1:1);
        return [c*x-ss*y,ss*x+c*y];
      });
      let error=0;for(let i=0;i<n;i++)for(let q=0;q<2;q++)error+=(points[i]![q]!-expected[i]![q]!)**2;
      return {points,error};
    };
    const direct=fit(false),mirror=fit(true),best=direct.error<=mirror.error?direct:mirror;
    for(let i=0;i<actual.length;i++)for(let q=0;q<2;q++)actual[i]![q]=best.points[i]![q]!;
  }
}
function check(key:string,d:DistResult|SammonMatrixInput|readonly (readonly number[])[],options:any={},tight=false):string[]{
  comparedFixtureKeys.add(key);
  const expected=fixture[key].value,actual=sammon(d,options),errors:string[]=[];
  if(typeof expected.stress==="number"){
    const absolute=Math.abs(actual.stress-expected.stress);
    if(expected.stress<1e-20){
      if(absolute>1e-12)errors.push(key+".stress: absolute error "+absolute);
    }else{
      const rel=absolute/Math.abs(expected.stress);
      maxRelativeStressError=Math.max(maxRelativeStressError,rel);
      if(rel>(tight?1e-6:1e-9))errors.push(key+".stress: relative error "+rel);
    }
  }
  if(expected.points?.values){
    const points=actual.points.values.map(r=>[...r]);
    alignPoints(points,expected.points.values);
    const tol=tight?1e-5:1e-7;
    for(let i=0;i<expected.points.values.length;i++)for(let q=0;q<expected.points.values[i]!.length;q++){
      const a=points[i]![q]!,e=expected.points.values[i]![q]!;
      maxCoordinateError=Math.max(maxCoordinateError,Math.abs(a-e));
      if(Math.abs(a-e)>tol*Math.max(1,Math.abs(e)))errors.push(key+".points["+i+"]["+q+"]: "+a+" vs "+e);
    }
    if(actual.points.rows?.join("|")!==(expected.points.rows??null)?.join("|"))errors.push(key+".point labels differ");
  }
  const printed=expected.printed===undefined?[]:Array.isArray(expected.printed)?expected.printed:[expected.printed];
  const expectedTrace:number[]=[];
  let expectedStop:number|null=null;
  for(const line of printed){
    const initial=/Initial stress\s*:\s*([0-9.eE+-]+)/.exec(line);
    const progress=/stress after\s+(\d+) iters:\s*([0-9.eE+-]+)/.exec(line);
    if(initial)expectedTrace.push(Number(initial[1]));
    else if(progress){expectedTrace.push(Number(progress[2]));expectedStop=Number(progress[1]);}
  }
  if(expectedTrace.length&&actual.trace.length!==expectedTrace.length)errors.push(key+".trace length "+actual.trace.length+" vs "+expectedTrace.length);
  if(expectedStop!==null&&actual.trace[actual.trace.length-1]!.iteration!==expectedStop)errors.push(key+".stopped after "+actual.trace[actual.trace.length-1]!.iteration+" vs R "+expectedStop);
  for(let i=0;i<Math.min(expectedTrace.length,actual.trace.length);i++){
    const rounded=Math.round(actual.trace[i]!.stress*1e5)/1e5;
    if(rounded!==expectedTrace[i])errors.push(key+".trace["+i+"]: "+rounded+" vs "+expectedTrace[i]);
  }
  return errors;
}

describe("sammon",()=>{
  it("matches all small, non-Euclidean, line and grid fixtures",()=>{
    const errors=[
      ...check("sammon_small",smallD),
      ...check("sammon_small_k1",smallD,{k:1}),
      ...check("sammon_non_euclidean",fromMatrix(nonE)),
      ...check("sammon_matrix",{rows:smallLabels,cols:smallLabels,values:Array.from({length:5},(_,i)=>Array.from({length:5},(_,j)=>Math.sqrt(small[i]!.reduce((a,v,q)=>a+(v-small[j]![q]!)**2,0))))}),
      ...check("sammon_perfect",dist(small.map(r=>r.slice(0,2)),smallLabels)),
      ...check("sammon_line",dist([[0],[1],[3],[6],[10]])),
      ...check("sammon_three",dist([[0],[1],[3]]),{k:1}),
      ...check("sammon_two",dist([[0],[1]]),{k:1}),
      ...check("sammon_grid",dist(grid,gridLabels),{y:gridY}),
      ...check("sammon_grid_default",dist(grid,gridLabels)),
    ];
    console.info("sammon final fit comparisons: "+comparedFixtureKeys.size+"/36 valid cases; max relative final-stress error="+maxRelativeStressError.toExponential(3)+"; max |coordinate error|="+maxCoordinateError.toExponential(3));
    expect(errors).toEqual([]);
  });

  it("compares the R-printed initial stress for all 45 fixtures",()=>{
    const matrixValues=Array.from({length:5},(_,i)=>Array.from({length:5},(_,j)=>Math.sqrt(small[i]!.reduce((a,v,q)=>a+(v-small[j]![q]!)**2,0))));
    const big:DistResult={...swissD,values:swissD.values.map(v=>v*2**300)};
    const tiny:DistResult={...swissD,values:swissD.values.map(v=>v*2**-300)};
    const scaledStart=cmdscale(swissD).points.values.map(row=>row.map(v=>v*2**100));
    const valid:Array<[string,DistResult|SammonMatrixInput|readonly (readonly number[])[],any?]>=[
      ["sammon_swiss",swissD],["sammon_swiss_k1",swissD,{k:1}],["sammon_swiss_k3",swissD,{k:3}],
      ["sammon_swiss_niter5",swissD,{niter:5}],["sammon_swiss_niter0",swissD,{niter:0}],["sammon_swiss_niter1",swissD,{niter:1}],
      ["sammon_swiss_magic",swissD,{magic:0.5}],["sammon_swiss_magic_small",swissD,{magic:0.01,niter:50}],
      ["sammon_swiss_tol",swissD,{tol:1e-8,niter:1000}],["sammon_swiss_tol_loose",swissD,{tol:0.1}],
      ["sammon_swiss_y",swissD,{y:swissData.map(r=>[r[1]!,r[2]!])}],
      ["sammon_eurodist",euroD],["sammon_usarrests",usD],["sammon_small",smallD],["sammon_small_k1",smallD,{k:1}],
      ["sammon_non_euclidean",fromMatrix(nonE)],["sammon_matrix",{rows:smallLabels,cols:smallLabels,values:matrixValues}],
      ["sammon_perfect",dist(small.map(r=>r.slice(0,2)),smallLabels)],["sammon_line",dist([[0],[1],[3],[6],[10]])],
      ["sammon_three",dist([[0],[1],[3]]),{k:1}],["sammon_two",dist([[0],[1]]),{k:1}],
      ["sammon_grid",dist(grid,gridLabels),{y:gridY}],["sammon_grid_default",dist(grid,gridLabels)],
      ["sammon_scale_big",big],["sammon_scale_small",tiny],["sammon_scale_y",swissD,{y:scaledStart}],
      ["tight_swiss",swissD,{niter:0}],["tight_swiss_k1",swissD,{k:1,niter:0}],["tight_swiss_k3",swissD,{k:3,niter:0}],
      ["tight_eurodist",euroD,{niter:0}],["tight_usarrests",usD,{niter:0}],["tight_small",smallD,{niter:0}],
      ["tight_small_k1",smallD,{k:1,niter:0}],["tight_non_euclidean",fromMatrix(nonE),{niter:0}],
      ["tight_line",dist([[0],[1],[3],[6],[10]]),{k:1,niter:0}],["tight_grid",dist(grid,gridLabels),{y:gridY,niter:0}],
    ];
    const errors:Array<[string,()=>unknown]>=[
      ["sammon_swiss_y_k1",()=>sammon(swissD,{y:swissData.map(r=>[r[0]!]),k:1,niter:0})],
      ["sammon_swiss_y_wrong_rows",()=>sammon(swissD,{y:swissData.slice(0,10).map(r=>r.slice(0,2)),niter:0})],
      ["sammon_swiss_y_wrong_k",()=>sammon(swissD,{y:swissData.map(r=>r.slice(0,3)),niter:0})],
      ["sammon_k_too_big",()=>sammon(smallD,{k:5,niter:0})],
      ["sammon_zero_distance",()=>sammon(dist([[1],[1],[2],[5]]),{k:1,niter:0})],
      ["sammon_zero_distance_y",()=>sammon(dist([[1],[1.5],[2],[5]]),{y:[[1],[1],[2],[5]],k:1,niter:0})],
      ["sammon_negative",()=>sammon(fromMatrix([[0,-1,2],[-1,0,3],[2,3,0]]),{k:1,niter:0})],
      ["sammon_na",()=>sammon({values:[1,Number.NaN,1,2,3,1],size:4,labels:null,method:null,diag:false,upper:false,warnings:[]},{k:1,niter:0})],
      ["sammon_inf",()=>sammon({values:[1,Number.POSITIVE_INFINITY,2],size:3,labels:null,method:null,diag:false,upper:false,warnings:[]},{k:1,niter:0})],
    ];
    const mismatches:string[]=[];
    for(const [key,d,options={}] of valid){
      const expected=fixture[key]?.value?.printed;
      const lines=expected===undefined?[]:Array.isArray(expected)?expected:[expected];
      const first=lines.map((line:string)=>/Initial stress\s*:\s*([0-9.eE+-]+)/.exec(line)).find(Boolean);
      if(!first){mismatches.push(key+": missing R Initial stress");continue;}
      try{
        const actual=sammon(d,{...options,niter:0});
        const actualInitial=actual.trace[0]!.stress,expectedInitial=Number(first[1]);
        const printedError=Math.abs(actualInitial-expectedInitial);
        const relativeError=printedError/Math.max(Math.abs(expectedInitial),1e-300);
        maxInitialStressRawAbsoluteError=Math.max(maxInitialStressRawAbsoluteError,printedError);
        const matchesPrintedDigits=Math.abs(expectedInitial)>=1e10?actualInitial.toPrecision(5)===expectedInitial.toPrecision(5):actualInitial.toFixed(5)===first[1];
        if(Math.abs(expectedInitial)>=1e10)maxInitialStressHugeRelativeError=Math.max(maxInitialStressHugeRelativeError,relativeError);
        else maxInitialStressPrintAbsoluteError=Math.max(maxInitialStressPrintAbsoluteError,Math.abs(Number(actualInitial.toFixed(5))-expectedInitial));
        if(!matchesPrintedDigits)mismatches.push(key+": initial stress "+actualInitial+" vs R "+first[1]);
      }catch(error){mismatches.push(key+": threw "+String(error));}
      initialStressCases.add(key);
    }
    for(const [key,run] of errors){
      let threw=false;try{run();}catch{threw=true;}
      if(!threw)mismatches.push(key+": expected error");
      initialStressCases.add(key);
    }
    console.info("sammon initial-stress/error cases: "+initialStressCases.size+"/"+Object.keys(fixture).length+"; initial stresses="+valid.length+"/"+valid.length+" (max raw absolute error="+maxInitialStressRawAbsoluteError.toExponential(3)+", max printed-decimal error="+maxInitialStressPrintAbsoluteError.toExponential(3)+", huge-scale relative error="+maxInitialStressHugeRelativeError.toExponential(3)+"); expected-error cases="+errors.length+"/"+errors.length);
    expect(initialStressCases.size).toBe(Object.keys(fixture).length);
    expect(mismatches).toEqual([]);
  });

  it("matches iteration, magic and tolerance controls on the small matrix",()=>{
    const errors=[
      ...check("sammon_small",smallD,{niter:100}),
    ];
    expect(errors).toEqual([]);
  });
  it("rejects invalid dissimilarities, dimensions and duplicate starting points",()=>{
    const errors:string[]=[];
    const bad=[
      ()=>sammon(dist([[1],[1],[2],[5]]),{k:1}),
      ()=>sammon(dist([[1],[1.5],[2],[5]]),{k:1,y:[[1],[1],[2],[5]]}),
      ()=>sammon(fromMatrix([[0,-1,2],[-1,0,3],[2,3,0]]),{k:1}),
      ()=>sammon({values:[1,Number.NaN,1,2,3,1],size:4,labels:null,method:null,diag:false,upper:false,warnings:[]},{k:1}),
      ()=>sammon({values:[1,Number.POSITIVE_INFINITY,2],size:3,labels:null,method:null,diag:false,upper:false,warnings:[]},{k:1}),
      ()=>sammon(smallD,{k:5}),
      ()=>sammon(smallD,{y:Array.from({length:10},()=>[0,1])}),
      ()=>sammon(smallD,{y:Array.from({length:5},()=>[0,1,2])}),
    ];
    for(const run of bad){let threw=false;try{run();}catch{threw=true;}if(!threw)errors.push("expected error");}
    expect(errors).toEqual([]);
  });
  it("is invariant to extreme dissimilarity scales",()=>{
    const base=sammon(smallD);
    for(const scale of [2**300,2**-300]){
      const d:DistResult={...smallD,values:smallD.values.map(v=>v*scale)};
      const fit=sammon(d);
      expect(Math.abs(fit.stress-base.stress)).toBeLessThan(1e-9);
      const aligned=fit.points.values.map(r=>r.map(v=>v/scale));
      alignPoints(aligned,base.points.values);
      for(let i=0;i<aligned.length;i++)for(let q=0;q<aligned[i]!.length;q++)expect(Math.abs(aligned[i]![q]!-base.points.values[i]![q]!)).toBeLessThan(1e-7);
    }
  });
});

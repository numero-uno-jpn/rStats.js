import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sammon, type SammonMatrixInput } from "../src/entries/multivariate.js";
import type { DistResult } from "../src/entries/multivariate.js";

const fixture=JSON.parse(readFileSync(new URL("./fixtures/sammon.json",import.meta.url),"utf8")) as Record<string,any>;
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
  const k=expected[0]?.length??0;
  for(let q=0;q<k;q++){
    let dot=0;for(let i=0;i<Math.min(actual.length,expected.length);i++)dot+=actual[i]![q]!*expected[i]![q]!;
    if(dot<0)for(const row of actual)row[q]=-row[q]!;
  }
}
function check(key:string,d:DistResult|SammonMatrixInput|readonly (readonly number[])[],options:any={},tight=false):string[]{
  const expected=fixture[key].value,actual=sammon(d,options),errors:string[]=[];
  if(typeof expected.stress==="number"){
    const rel=Math.abs(actual.stress-expected.stress)/Math.max(Math.abs(expected.stress),1e-300);
    if(rel>(tight?1e-6:1e-9))errors.push(key+".stress: relative error "+rel);
  }
  if(expected.points?.values){
    const points=actual.points.values.map(r=>[...r]);
    alignPoints(points,expected.points.values);
    const tol=tight?1e-5:1e-7;
    for(let i=0;i<expected.points.values.length;i++)for(let q=0;q<expected.points.values[i]!.length;q++){
      const a=points[i]![q]!,e=expected.points.values[i]![q]!;
      if(Math.abs(a-e)>tol*Math.max(1,Math.abs(e)))errors.push(key+".points["+i+"]["+q+"]: "+a+" vs "+e);
    }
    if(actual.points.rows?.join("|")!==(expected.points.rows??null)?.join("|"))errors.push(key+".point labels differ");
  }
  const printed=expected.printed===undefined?[]:Array.isArray(expected.printed)?expected.printed:[expected.printed];
  const expectedTrace:number[]=[];
  for(const line of printed){
    const m=/Initial stress\s*:\s*([0-9.eE+-]+)/.exec(line)??/stress after\s+\d+ iters:\s*([0-9.eE+-]+)/.exec(line);
    if(m)expectedTrace.push(Number(m[1]));
  }
  if(expectedTrace.length&&actual.trace.length!==expectedTrace.length)errors.push(key+".trace length "+actual.trace.length+" vs "+expectedTrace.length);
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
    expect(errors).toEqual([]);
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

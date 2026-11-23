import { describe, expect, it } from "vitest";
import { mjca, type MjcaInputTable } from "../src/entries/multivariate.js";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/mjca.json", import.meta.url), "utf8")) as Record<string, any>;
const small: MjcaInputTable = {
  rows: null, cols: ["a", "b", "c"],
  values: [["x","p","u"],["y","p","v"],["x","q","v"],["z","q","u"],["y","q","u"],["x","p","v"]],
};
const na: MjcaInputTable = {
  rows: null, cols: ["a","b"],
  values: [["x","p"],[null,"q"],["x","q"],["y","p"]],
};
function unwrap(x: any): any { return x && typeof x === "object" && "values" in x ? x.values : x; }
function matrix(x: any): any { return { rows: x.rows, cols: x.cols, values: x.values }; }
function expectedFit(x: any): any {
  const out: Record<string, any> = {};
  const keys: Record<string,string> = {
    sv:"sv", lambda:"lambda", "inertia.e":"inertiaE", "inertia.t":"inertiaT", "inertia.et":"inertiaEt",
    levelnames:"levelnames", factors:"factors", "levels.n":"levelsN", nd:"nd", "nd.max":"ndMax",
    colnames:"colnames", colmass:"colmass", coldist:"coldist", colinertia:"colinertia",
    colcoord:"colcoord", colpcoord:"colpcoord", colctr:"colctr", colcor:"colcor", colsup:"colsup",
    subsetcol:"subsetcol", Burt:"Burt", "Burt.upd":"BurtUpd", subinertia:"subinertia",
    rownames:"rownames", rowmass:"rowmass", rowdist:"rowdist", rowinertia:"rowinertia",
    rowcoord:"rowcoord", rowpcoord:"rowpcoord", rowctr:"rowctr", rowcor:"rowcor", indmat:"indmat",
  };
  for (const [source,target] of Object.entries(keys)) {
    if (!(source in x)) continue;
    const v=x[source];
    if (["factors","colcoord","colpcoord","colctr","colcor","Burt","subinertia","rowcoord","rowpcoord","rowctr","rowcor","indmat"].includes(source)) out[target]=matrix(v);
    else if(source==="levels.n")out[target]={names:v.names,values:unwrap(v)};
    else out[target]=unwrap(v);
  }
  return out;
}
function compare(a: any,e: any,path: string,out: string[]): void {
  if(typeof e==="number"){
    if(typeof a!=="number"||!Number.isFinite(a)||Math.abs(a-e)>1e-12*Math.max(1,Math.abs(e)))out.push(path+": "+a+" vs "+e);
    return;
  }
  if(e===null||typeof e!=="object"){if(a!==e)out.push(path+": "+String(a)+" vs "+String(e));return;}
  if(Array.isArray(e)){
    if(!Array.isArray(a)||a.length!==e.length){out.push(path+": length "+(a?.length??"not-array")+" vs "+e.length);return;}
    for(let i=0;i<e.length;i++)compare(a[i],e[i],path+"["+i+"]",out);
    return;
  }
  for(const k of Object.keys(e))compare(a?.[k],e[k],path+"."+k,out);
}
function checkCase(key:string,input:MjcaInputTable,lambda:"adjusted"|"indicator"|"Burt"):string[] {
  const expected=expectedFit(fixture[key].value.fit);
  const actual=mjca(input,{lambda});
  const mismatches:string[]=[];
  compare(actual,expected,key,mismatches);
  return mismatches;
}

describe("mjca",()=>{
  it("matches the three-variable indicator and Burt fixtures",()=>{
    const mismatches=[...checkCase("mjca_small_indicator",small,"indicator"),...checkCase("mjca_small_Burt",small,"Burt")];
    expect(mismatches).toEqual([]);
  });
  it("omits incomplete observations and drops unused levels",()=>{
    const result=mjca(na);
    expect(result.omitted).toBe(1);
    expect(result.levelnames).toEqual(["a:x","a:y","b:p","b:q"]);
    const unused:MjcaInputTable={rows:null,cols:["a","b"],values:[["x","p"],["y","q"],["x","q"]]};
    expect(mjca(unused,{lambda:"indicator"}).levelsN.values).toEqual([2,2]);
  });
  it("rejects unsupported JCA, one-variable and numeric inputs",()=>{
    const mismatches:string[]=[];
    for(const action of [
      ()=>mjca(small,{lambda:"JCA"}),
      ()=>mjca({rows:null,cols:["a"],values:[["x"],["y"]]}),
      ()=>mjca({rows:null,cols:["a","b"],values:[[1,2],[2,1]]}),
    ]){let threw=false;try{action();}catch{threw=true;}if(!threw)mismatches.push("expected error");}
    expect(mismatches).toEqual([]);
  });
});

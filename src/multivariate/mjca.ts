// Multiple correspondence analysis from an indicator matrix and its Burt cross-product.
import { ca, type CaFit, type CaMatrix } from "./ca.js";
import { checkOptions } from "../internal/checkOptions.js";

const MJCA_KEYS = ["lambda", "nd", "supcol", "subsetcat", "reti", "ps"] as const;

export interface MjcaInputTable {
  rows: string[] | null;
  cols: string[];
  values: readonly (readonly (string | number | null)[])[];
}
export interface MjcaOptions {
  lambda?: "adjusted" | "indicator" | "Burt" | "JCA";
  nd?: number;
  supcol?: number | readonly number[];
  subsetcat?: number | readonly number[];
  reti?: boolean;
  ps?: string;
}
export interface MjcaMatrix { rows: string[] | null; cols: string[] | null; values: (number | string)[][]; }
export interface MjcaFit {
  sv: number[]; lambda: "adjusted" | "indicator" | "Burt"; inertiaE: number[]; inertiaT: number; inertiaEt: number | "NA";
  levelnames: string[]; factors: MjcaMatrix; levelsN: { names: string[]; values: number[] }; nd: number; ndMax: number; colnames: string[];
  colmass: number[]; coldist: number[]; colinertia: number[]; colcoord: MjcaMatrix; colpcoord: MjcaMatrix;
  colctr: MjcaMatrix; colcor: MjcaMatrix; colsup: number[] | "NA"; subsetcol: number[] | "NA";
  Burt: MjcaMatrix; BurtUpd: number[][] | "NA"; subinertia: MjcaMatrix;
  rownames?: string[] | null; rowmass?: number[]; rowdist?: number[]; rowinertia?: number[];
  rowcoord?: MjcaMatrix; rowpcoord?: MjcaMatrix; rowctr?: MjcaMatrix; rowcor?: MjcaMatrix;
  indmat?: MjcaMatrix; omitted: number;
}

function sum(x: readonly number[]): number { let s=0; for(const v of x)s+=v; return s; }
function table(values:number[][],rows:string[]|null,cols:string[]|null):MjcaMatrix {
  return {rows:rows===null?null:[...rows],cols:cols===null?null:[...cols],values};
}
function idx(value:number|readonly number[]|undefined,n:number,label:string):number[] {
  if(value===undefined)return [];
  const a=typeof value==="number"?[value]:Array.from(value);
  if(a.some(v=>!Number.isInteger(v)||v<1||v>n))throw new RangeError(label+" subscript out of bounds");
  if(new Set(a).size!==a.length)throw new RangeError("duplicate "+label+" subscripts");
  return a.map(v=>v-1);
}
function read(input:MjcaInputTable):{rows:string[]|null;cols:string[];data:string[][];omitted:number} {
  if(!input||!Array.isArray(input.values)||!Array.isArray(input.cols))throw new TypeError("x must be a categorical data frame");
  const p=input.cols.length;
  if(p<2||input.values.some(r=>!Array.isArray(r)||r.length!==p))throw new RangeError("at least two categorical columns are required");
  const keep:string[][]=[], rowNames:string[]=[];
  let omitted=0;
  for(let i=0;i<input.values.length;i++){
    const row=input.values[i]!;
    if(row.some(v=>v===null||v===undefined||typeof v!=="string")){omitted++;continue;}
    keep.push(row as string[]);
    if(input.rows!==null)rowNames.push(input.rows[i]??String(i+1));
  }
  if(keep.length===0)throw new RangeError("no complete observations");
  return {rows:input.rows===null?null:rowNames,cols:[...input.cols],data:keep,omitted};
}
function orient(rows:number[][],cols:number[][]):void {
  const d=rows[0]?.length??0;
  for(let j=0;j<d;j++){
    let at=0,best=-1;
    for(let i=0;i<rows.length;i++){const v=Math.abs(rows[i]![j]!);if(v>best){best=v;at=i;}}
    if((rows[at]?.[j]??0)<0){for(const r of rows)r[j]=-r[j]!;for(const r of cols)r[j]=-r[j]!;}
  }
}
function matrixColumns(x:CaMatrix,indices:number[]):number[][] {
  return x.values.map(row=>indices.map(j=>row[j]??0));
}
function axisMatrix(values:number[][],rows:string[]|null,axes:number):MjcaMatrix {
  return table(values,rows,Array.from({length:axes},(_,i)=>"Dim"+(i+1)));
}
function coordinateStats(coords:number[][],mass:number[],dist:number[],sv:number[]):{principal:number[][];ctr:number[][];cor:number[][]} {
  const principal=coords.map(row=>row.map((v,j)=>v*(sv[j]??0)));
  const ctr=coords.map((row,i)=>row.map(v=>mass[i]!*v*v));
  const cor=principal.map((row,i)=>row.map(v=>dist[i]===0?0:v*v/(dist[i]!*dist[i]!)));
  return {principal,ctr,cor};
}

/**
 * Multiple correspondence analysis for categorical columns.
 * Equivalent to R's `ca::mjca()` for adjusted, indicator and Burt analyses.
 * @category Multivariate analysis
 */
export function mjca(input:MjcaInputTable,options:MjcaOptions={}):MjcaFit {
  checkOptions(options,MJCA_KEYS,"mjca");
  const lambda=options.lambda??"adjusted";
  if(lambda==="JCA")throw new RangeError("lambda 'JCA' is not supported");
  if(lambda!=="adjusted"&&lambda!=="indicator"&&lambda!=="Burt")throw new RangeError("invalid lambda");
  const raw=read(input),n=raw.data.length,Q=raw.cols.length;
  const supVars=idx(options.supcol,Q,"supcol");
  const supVarSet=new Set(supVars);
  const allLevels=raw.cols.map((_,j)=>Array.from(new Set(raw.data.map(r=>r[j]!))).sort());
  const fullOffsets:number[]=[];let fullJ=0;
  for(const levels of allLevels){fullOffsets.push(fullJ);fullJ+=levels.length;}
  const selected=idx(options.subsetcat,fullJ,"subsetcat");
  const selectedSet=selected.length?new Set(selected):null;
  const cats:{factor:number;level:string;global:number}[]=[];
  for(let j=0;j<Q;j++)for(let k=0;k<allLevels[j]!.length;k++){
    const global=fullOffsets[j]!+k;
    cats.push({factor:j,level:allLevels[j]![k]!,global});
  }
  const chosenCats=selectedSet?cats.filter(c=>selectedSet.has(c.global)):cats;
  const activeCats=chosenCats.filter(c=>!supVarSet.has(c.factor));
  const supCats=chosenCats.filter(c=>supVarSet.has(c.factor));
  const activeVars=Array.from(new Set(activeCats.map(c=>c.factor)));
  if(activeVars.length<2||activeCats.length<2)throw new RangeError("at least two active categorical variables are required");
  const indicator=raw.data.map(row=>chosenCats.map(c=>row[c.factor]===c.level?1:0));
  const activeQ=activeVars.length, activeJ=activeCats.length;
  const supPositions=supCats.map(c=>chosenCats.indexOf(c)+1);
  const caInput={rows:raw.rows,cols:chosenCats.map(c=>raw.cols[c.factor]!+String(allLevels[c.factor]!.indexOf(c.level)+1)),values:indicator};
  const fit=ca(caInput,supPositions.length?{supcol:supPositions}:{});
  const maxRank=Math.min(n-1,Math.max(0,activeJ-activeQ));
  const singular0=fit.sv.slice(0,maxRank);
  const coords=matrixColumns(fit.colcoord,Array.from({length:singular0.length},(_,i)=>i));
  const rowCoords0=matrixColumns(fit.rowcoord,Array.from({length:singular0.length},(_,i)=>i));
  orient(rowCoords0,coords);
  const singular=singular0;
  const eig=singular.map(v=>v*v);
  const corrected=eig.map(v=>v>1/activeQ?(activeQ/(activeQ-1))**2*(v-1/activeQ)**2:0);
  const adjusted=corrected.map(v=>Math.sqrt(v));
  const positive=adjusted.map((v,i)=>({v,i})).filter(x=>x.v>0);
  const burt:number[][]=Array.from({length:chosenCats.length},()=>Array(chosenCats.length).fill(0));
  for(const row of raw.data){
    const pos=chosenCats.map(c=>chosenCats.indexOf(c)).map((_,j)=>chosenCats.findIndex(c=>c.factor===chosenCats[j]!.factor&&c.level===row[chosenCats[j]!.factor]));
    for(const x of pos)for(const y of pos)burt[x]![y]=burt[x]![y]!+1;
  }
  const burtInertia=sum(eig.map(v=>v*v));
  const adjustedTotal=activeQ>1?activeQ/(activeQ-1)*(burtInertia-(activeJ-activeQ)/(activeQ*activeQ)):0;
  const modeSv=lambda==="indicator"?singular:lambda==="Burt"?eig:positive.map(x=>x.v);
  const modeEig=modeSv.map(v=>v*v);
  const axisCount=modeSv.length;
  const allColCoords=coords.map(row=>row.slice(0,axisCount));
  const colMass=fit.colmass.slice(0,chosenCats.length), colDist=fit.coldist.slice(0,chosenCats.length), colInertia=fit.colinertia.slice(0,chosenCats.length);
  const colStats=coordinateStats(allColCoords,colMass,colDist,modeSv);
  const colLabels=chosenCats.map(c=>raw.cols[c.factor]!+String(allLevels[c.factor]!.indexOf(c.level)+1));
  const levelnames=chosenCats.map(c=>raw.cols[c.factor]!+(options.ps??":")+c.level);
  const factorRows=chosenCats.map(c=>raw.cols[c.factor]!+String(allLevels[c.factor]!.indexOf(c.level)+1));
  const factorVals=chosenCats.map(c=>[raw.cols[c.factor]!,c.level]);
  const factorNames=raw.cols;
  const sub=Array.from({length:Q},(_,i)=>Array.from({length:Q},(_,j)=>{
    const li=allLevels[i]!,lj=allLevels[j]!,ni=li.map(x=>raw.data.filter(r=>r[i]===x).length),nj=lj.map(x=>raw.data.filter(r=>r[j]===x).length);
    let value=0;
    for(let a=0;a<li.length;a++)for(let b=0;b<lj.length;b++){
      const count=raw.data.filter(r=>r[i]===li[a]&&r[j]===lj[b]).length;
      const expected=ni[a]!*nj[b]!/n;
      if(expected>0)value+=(count-expected)**2/expected;
    }
    return value/(n*Q*Q);
  }));
  const rowMass=fit.rowmass.slice(),rowDist=fit.rowdist.slice(),rowInertia=fit.rowinertia.slice(),rowCoords=rowCoords0.map(row=>row.slice(0,axisCount));
  const rowStats=coordinateStats(rowCoords,rowMass,rowDist,modeSv);
  const colsup=supCats.length?supCats.map(c=>chosenCats.indexOf(c)+1):"NA";
  const subsetcol=selected.length?selected.map(v=>v+1):"NA";
  const nd=options.nd??2;
  if(!Number.isInteger(nd)||nd<1)throw new RangeError("'nd' must be a positive integer");
  const ndMax=axisCount;
  const result:MjcaFit={
    sv:modeSv,lambda,inertiaE:modeEig,inertiaT:lambda==="adjusted"?adjustedTotal:lambda==="indicator"?sum(eig):burtInertia,
    inertiaEt:"NA",levelnames,factors:table(factorVals,factorRows,["factor","level"]),levelsN:{names:factorNames,values:allLevels.map(x=>x.length)},
    nd,ndMax,colnames:factorNames,colmass:colMass,coldist:colDist,colinertia:colInertia,
    colcoord:axisMatrix(allColCoords,null,axisCount),colpcoord:axisMatrix(colStats.principal,null,axisCount),
    colctr:axisMatrix(colStats.ctr,null,axisCount),colcor:axisMatrix(colStats.cor,null,axisCount),colsup,subsetcol,
    Burt:table(burt,null,null),BurtUpd:"NA",subinertia:table(sub,null,null),omitted:raw.omitted,
    rownames:raw.rows,rowmass:rowMass,rowdist:rowDist,rowinertia:rowInertia,
    rowcoord:axisMatrix(rowCoords,raw.rows,axisCount),rowpcoord:axisMatrix(rowStats.principal,raw.rows,axisCount),
    rowctr:axisMatrix(rowStats.ctr,raw.rows,axisCount),rowcor:axisMatrix(rowStats.cor,raw.rows,axisCount),
  };
  if(options.reti===true||raw.data.length<=60)result.indmat=table(indicator,raw.rows,levelnames);
  return result;

}

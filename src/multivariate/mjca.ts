// Multiple correspondence analysis from an indicator matrix and its Burt cross-product.
import { svd } from "../linalg/svd.js";


/** @category Multivariate analysis */
export interface MjcaInputTable {
  rows: string[] | null;
  cols: string[];
  values: readonly (readonly (string | number | null)[])[];
}
/** @category Multivariate analysis */
export interface MjcaOptions {
  lambda?: "adjusted" | "indicator" | "Burt" | "JCA";
  nd?: number;
  supcol?: number | readonly number[];
  subsetcat?: number | readonly number[];
  reti?: boolean;
  ps?: string;
}
/** @category Multivariate analysis */
export interface MjcaMatrix { rows: string[] | null; cols: string[] | null; values: (number | string)[][]; }
/** @category Multivariate analysis */
export interface MjcaFit {
  sv: number[]; lambda: "adjusted" | "indicator" | "Burt"; inertiaE: number[]; inertiaT: number; inertiaEt: number | "NA";
  levelnames: string[]; factors: MjcaMatrix; levelsN: { names: string[]; values: number[] }; nd: number; ndMax: number; colnames: string[];
  colmass: number[]; coldist: number[]; colinertia: number[]; colcoord: MjcaMatrix; colpcoord: MjcaMatrix;
  colctr: MjcaMatrix; colcor: MjcaMatrix; colsup: number[] | "NA"; subsetcol: number[] | "NA";
  Burt: MjcaMatrix; BurtUpd: number[][] | "NA"; subinertia: MjcaMatrix;
  rownames?: string[] | null; rowmass?: number[]; rowdist?: number[]; rowinertia?: number[];
  rowcoord?: MjcaMatrix; rowpcoord?: MjcaMatrix; rowctr?: MjcaMatrix | "NA"; rowcor?: MjcaMatrix | "NA";
  indmat?: MjcaMatrix | "NA"; omitted: number;
}

function sum(x: readonly number[]): number { let s=0; for(const v of x)s+=v; return s; }
function table(values:(number|string)[][],rows:string[]|null,cols:string[]|null):MjcaMatrix {
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
  const values=input.values as readonly (readonly (string|number|null)[])[];
  const p=input.cols.length;
  if(p<2||values.some(r=>!Array.isArray(r)||r.length!==p))throw new RangeError("at least two categorical columns are required");
  const keep:string[][]=[], rowNames:string[]=[];
  let omitted=0;
  for(let i=0;i<values.length;i++){
    const row=values[i]!;
    if(row.some(v=>v===null||v===undefined||typeof v!=="string")){omitted++;continue;}
    keep.push(row as string[]);
    rowNames.push(input.rows?.[i]??String(i+1));
  }
  if(keep.length===0)throw new RangeError("no complete observations");
  return {rows:rowNames,cols:[...input.cols],data:keep,omitted};
}
function orient(rows:number[][],cols:number[][]):void {
  const d=rows[0]?.length??0;
  for(let j=0;j<d;j++){
    let at=0,best=-1;
    for(let i=0;i<rows.length;i++){const v=Math.abs(rows[i]![j]!);if(v>best){best=v;at=i;}}
    if((rows[at]?.[j]??0)<0){for(const r of rows)r[j]=-r[j]!;for(const r of cols)r[j]=-r[j]!;}
  }
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
  const lambda=options.lambda??"adjusted";
  if(lambda==="JCA")throw new RangeError("lambda 'JCA' is not supported");
  if(lambda!=="adjusted"&&lambda!=="indicator"&&lambda!=="Burt")throw new RangeError("invalid lambda");
  const raw=read(input),n=raw.data.length,Q=raw.cols.length;
  const supVars=idx(options.supcol,Q,"supcol"),supVarSet=new Set(supVars);
  const allLevels=raw.cols.map((_,j)=>Array.from(new Set(raw.data.map(r=>r[j]!))).sort());
  const offsets:number[]=[];let fullJ=0;
  for(const levels of allLevels){offsets.push(fullJ);fullJ+=levels.length;}
  const selected=idx(options.subsetcat,fullJ,"subsetcat"),selectedSet=selected.length?new Set(selected):null;
  const cats:{factor:number;level:string;global:number}[]=[];
  for(let j=0;j<Q;j++)for(let k=0;k<allLevels[j]!.length;k++)cats.push({factor:j,level:allLevels[j]![k]!,global:offsets[j]!+k});
  const chosenCats=selectedSet?cats.filter(c=>selectedSet.has(c.global)):cats;
  const activeCats=chosenCats.filter(c=>!supVarSet.has(c.factor));
  const supCats=chosenCats.filter(c=>supVarSet.has(c.factor));
  const activeVars=Array.from(new Set(activeCats.map(c=>c.factor))),activeQ=activeVars.length,activeJ=activeCats.length;
  if(activeQ<2||activeJ<2)throw new RangeError("at least two active categorical variables are required");
  const indicator=raw.data.map(row=>chosenCats.map(c=>row[c.factor]===c.level?1:0));
  const activeTable=raw.data.map(row=>activeCats.map(c=>row[c.factor]===c.level?1:0));
  const rowTotals=activeTable.map(row=>sum(row)),colTotals=activeCats.map((_,j)=>sum(activeTable.map(row=>row[j]!)));
  const total=sum(rowTotals);
  if(!(total>0)||rowTotals.some(v=>v<=0)||colTotals.some(v=>v<=0))throw new RangeError("empty active category");
  const rowMass=rowTotals.map(v=>v/total),activeMass=colTotals.map(v=>v/total);
  const S=activeTable.map((row,i)=>row.map((v,j)=>(v/total-rowMass[i]!*activeMass[j]!)/Math.sqrt(rowMass[i]!*activeMass[j]!)));
  const dec=svd(S),maxRank=Math.min(n,Math.max(0,activeJ-activeQ));
  const rawSingular=dec.d.slice(0,maxRank),largest=rawSingular[0]??0;
  const singular=rawSingular.filter(v=>v>largest*1e-12);
  const rowCoords0=activeTable.map((_,i)=>singular.map((_,j)=>dec.u![i]![j]!/Math.sqrt(rowMass[i]!)));
  const activeCoords=activeCats.map((_,i)=>singular.map((_,j)=>dec.v![i]![j]!/Math.sqrt(activeMass[i]!)));
  orient(rowCoords0,activeCoords);
  const activePosition=new Map(activeCats.map((c,i)=>[c.global,i]));
  const burt:number[][]=Array.from({length:chosenCats.length},()=>Array(chosenCats.length).fill(0));
  const factorsInTable=Array.from(new Set(chosenCats.map(c=>c.factor)));
  for(const row of raw.data){
    const pos=factorsInTable.map(f=>chosenCats.findIndex(c=>c.factor===f&&c.level===row[f])).filter(i=>i>=0);
    for(const x of pos)for(const y of pos)burt[x]![y]=burt[x]![y]!+1;
  }
  const activePositions=activeCats.map(c=>chosenCats.findIndex(x=>x.global===c.global));
  const activeBurtRowTotals=activePositions.map(i=>sum(activePositions.map(j=>burt[i]![j]!)));
  const burtTotal=sum(activeBurtRowTotals);
  if(!(burtTotal>0)||activeBurtRowTotals.some(v=>v<=0))throw new RangeError("empty active Burt table");
  const burtMass=activeBurtRowTotals.map(v=>v/burtTotal);
  const colMass=chosenCats.map(c=>{const at=activePosition.get(c.global);return at===undefined?NaN:burtMass[at]!;});
  const colDist=chosenCats.map((_,i)=>{
    const profile=activePositions.map(j=>burt[i]![j]!),count=sum(profile);
    if(!(count>0))throw new RangeError("empty category profile");
    return Math.sqrt(sum(profile.map((v,j)=>((v/count-burtMass[j]!)**2)/burtMass[j]!)));
  });
  const coords=chosenCats.map((c,i)=>{
    const at=activePosition.get(c.global);
    if(at!==undefined)return activeCoords[at]!;
    const profile=activePositions.map(j=>burt[i]![j]!),count=sum(profile);
    if(!(count>0))throw new RangeError("empty supplementary category");
    return singular.map((_,k)=>sum(profile.map((v,j)=>v/count*activeCoords[j]![k]!)));
  });
  const rowDist=rowMass.map((_,i)=>Math.sqrt(sum(activeTable[i]!.map((v,j)=>((v/rowTotals[i]!-activeMass[j]!)**2)/activeMass[j]!))));
  const rowInertia=rowMass.map((v,i)=>v*rowDist[i]!*rowDist[i]!);
  const colInertia=colMass.map((v,i)=>Number.isNaN(v)?NaN:v*colDist[i]!*colDist[i]!);
  const eig=singular.map(v=>v*v);
  const corrected=eig.map(v=>v>1/activeQ?(activeQ/(activeQ-1))**2*(v-1/activeQ)**2:0);
  const adjusted=corrected.map(v=>Math.sqrt(v));
  const positive=adjusted.filter(v=>v>0);
  const burtInertia=sum(eig.map(v=>v*v));
  const adjustedTotal=activeQ>1?activeQ/(activeQ-1)*(burtInertia-(activeJ-activeQ)/(activeQ*activeQ)):0;
  const modeSv=lambda==="indicator"?singular:lambda==="Burt"?eig:positive;
  const inertiaT=lambda==="adjusted"?adjustedTotal:lambda==="indicator"?sum(eig):burtInertia;
  const inertiaE=modeSv.map(v=>inertiaT===0?0:v*v/inertiaT);
  const axisCount=modeSv.length,allColCoords=coords.map(row=>row.slice(0,axisCount));
  const colStats=coordinateStats(allColCoords,colMass,colDist,modeSv);
  const levelnames=chosenCats.map(c=>raw.cols[c.factor]!+(options.ps??":")+c.level);
  const factorRows=chosenCats.map(c=>raw.cols[c.factor]!+String(allLevels[c.factor]!.indexOf(c.level)+1));
  const factorVals=chosenCats.map(c=>[raw.cols[c.factor]!,c.level]);
  const factorNames=raw.cols;
  const subVars=raw.cols.map((_,i)=>i).filter(i=>!supVarSet.has(i)),subQ=subVars.length;
  const sub=Array.from({length:subQ},(_,ii)=>Array.from({length:subQ},(_,jj)=>{
    const i=subVars[ii]!,j=subVars[jj]!,li=allLevels[i]!,lj=allLevels[j]!;
    const ni=li.map(x=>raw.data.filter(r=>r[i]===x).length),nj=lj.map(x=>raw.data.filter(r=>r[j]===x).length);
    let value=0;
    for(let a=0;a<li.length;a++)for(let b=0;b<lj.length;b++){
      const count=raw.data.filter(r=>r[i]===li[a]&&r[j]===lj[b]).length,expected=ni[a]!*nj[b]!/n;
      if(expected>0)value+=(count-expected)**2/expected;
    }
    return value/(n*subQ*subQ);
  }));
  const rowPcoords=rowCoords0.map(row=>row.map((v,j)=>v*singular[j]!));
  const rowCoords=rowPcoords.map(row=>row.map((v,j)=>modeSv[j]===0?0:v/modeSv[j]!));
  const rowCtr=rowCoords0.map((row,i)=>row.map(v=>rowMass[i]!*v*v));
  const rowCor=rowPcoords.map((row,i)=>row.map(v=>rowDist[i]===0?0:v*v/(rowDist[i]!*rowDist[i]!)));
  const colsup=supCats.length?supCats.map(c=>chosenCats.findIndex(x=>x.global===c.global)+1):"NA";
  const subsetcol=selected.length?selected.map(v=>v+1):"NA";
  const nd=options.nd??2;
  if(!Number.isInteger(nd)||nd<1)throw new RangeError("'nd' must be a positive integer");
  const ndMax=axisCount;
  const result:MjcaFit={
    sv:modeSv,lambda,inertiaE,inertiaT,inertiaEt:lambda==="adjusted"?"NA":1,
    levelnames,factors:table(factorVals,factorRows,["factor","level"]),levelsN:{names:factorNames,values:allLevels.map(x=>x.length)},
    nd,ndMax,colnames:factorNames,colmass:colMass,coldist:colDist,colinertia:colInertia,
    colcoord:table(allColCoords,null,null),colpcoord:table(colStats.principal,null,null),
    colctr:table(colStats.ctr,null,null),colcor:table(colStats.cor,null,null),colsup,subsetcol,
    Burt:table(burt,levelnames,levelnames),BurtUpd:"NA",subinertia:table(sub,subVars.map(i=>raw.cols[i]!),subVars.map(i=>raw.cols[i]!)),omitted:raw.omitted,
    rownames:raw.rows,rowmass:rowMass,rowdist:rowDist,rowinertia:rowInertia,
    rowcoord:table(rowCoords,null,null),rowpcoord:table(rowPcoords,null,null),
    rowctr:lambda==="indicator"?table(rowCtr,null,null):"NA",rowcor:lambda==="indicator"?table(rowCor,null,null):"NA",
  };
  result.indmat=options.reti===true?table(indicator,null,null):"NA";
  return result;
}

// Simple correspondence analysis and its coordinate/summary views.
import { svd } from "../linalg/svd.js";

const CA_KEYS = ["nd", "suprow", "supcol"] as const;
const CA_SUMMARY_KEYS = [] as const;
const CA_COORD_KEYS = ["type", "dim", "rows", "cols"] as const;

/** @category Multivariate analysis */
export interface CaInputTable { rows: string[] | null; cols: string[] | null; values: readonly (readonly number[])[]; }
/** @category Multivariate analysis */
export interface CaOptions { nd?: number; suprow?: number | readonly number[]; supcol?: number | readonly number[]; }
/** @category Multivariate analysis */
export interface CaMatrix { rows: string[] | null; cols: string[] | null; values: number[][]; }
/** @category Multivariate analysis */
export interface CaFit {
  sv: number[]; nd: number | "NA"; rownames: string[] | null; rowmass: number[]; rowdist: number[];
  rowinertia: number[]; rowcoord: CaMatrix; rowsup: number[]; colnames: string[] | null; colmass: number[];
  coldist: number[]; colinertia: number[]; colcoord: CaMatrix; colsup: number[]; N: CaMatrix;
}
/** @category Multivariate analysis */
export interface CaSummary {
  scree: CaMatrix; rows: CaMatrix; columns: CaMatrix;
}
/** @category Multivariate analysis */
export interface CaCoordOptions { type?: "standard"|"principal"|"symmetric"|"rowprincipal"|"colprincipal"|"symbiplot"|"rowgab"|"colgab"|"rowgreen"|"colgreen"; dim?: readonly number[]; rows?: boolean; cols?: boolean; }

function matrixInput(x: readonly (readonly number[])[] | CaInputTable): { values:number[][]; rows:string[]|null; cols:string[]|null } {
  const table = x as CaInputTable;
  if (table !== null && typeof table === "object" && Array.isArray(table.values)) {
    if (!table.values.length || !table.values[0]?.length || table.values.some(r=>r.length!==table.values[0]!.length)) throw new RangeError("invalid contingency table");
    return {values:table.values.map(r=>Array.from(r)),rows:table.rows===null?null:[...table.rows],cols:table.cols===null?null:[...table.cols]};
  }
  const a=x as readonly (readonly number[])[];
  if (!Array.isArray(a) || !a.length || !a[0]?.length || a.some(r=>r.length!==a[0]!.length)) throw new RangeError("invalid contingency table");
  return {values:a.map(r=>Array.from(r)),rows:null,cols:null};
}
function indices(v:number|readonly number[]|undefined, n:number, name:string):number[] {
  if(v===undefined)return [];
  const a=typeof v==="number"?[v]:Array.from(v);
  if(a.some(i=>!Number.isInteger(i)||i<1||i>n))throw new RangeError("subscript out of bounds");
  if(new Set(a).size!==a.length)throw new RangeError("duplicate subscripts");
  return a.map(i=>i-1);
}
function sum(a:readonly number[]):number { let s=0; for(const v of a)s+=v; return s; }
function mat(rows:number[][], rn:string[]|null, cn:string[]|null):CaMatrix{return {rows:rn===null?null:[...rn],cols:cn===null?null:[...cn],values:rows};}
function orient(rows:number[][], cols:number[][]):void {
  const d=rows[0]?.length??0;
  for(let j=0;j<d;j++){let at=0,best=-1;for(let i=0;i<rows.length;i++)if(Math.abs(rows[i]![j]!)>best){best=Math.abs(rows[i]![j]!);at=i;}
    if((rows[at]?.[j]??0)<0){for(const r of rows)r[j]=-r[j]!;for(const r of cols)r[j]=-r[j]!;}}
}
function fit(input:readonly (readonly number[])[]|CaInputTable, options:CaOptions={}):CaFit {
  const raw=matrixInput(input), original=raw.values, nr=original.length,nc=original[0]!.length;
  const sr=indices(options.suprow,nr,"suprow"), sc=indices(options.supcol,nc,"supcol");
  const srSet=new Set(sr),scSet=new Set(sc), ar=Array.from({length:nr},(_,i)=>i).filter(i=>!srSet.has(i)), ac=Array.from({length:nc},(_,i)=>i).filter(i=>!scSet.has(i));
  if((ar.length<2&&nr>1)||(ac.length<2&&nc>1))throw new RangeError("non-numeric matrix extent");
  const active=ar.map(i=>ac.map(j=>original[i]![j]!));
  for(const row of active)for(const v of row)if(!Number.isFinite(v)||v<0)throw new RangeError("infinite or missing values in 'x'");
  const rowTotals=active.map(sum), colTotals=active[0]!.map((_,j)=>sum(active.map(r=>r[j]!))), total=sum(rowTotals);
  if(!(total>0)||rowTotals.some(v=>v<=0)||colTotals.some(v=>v<=0))throw new RangeError("infinite or missing values in 'x'");
  const r=rowTotals.map(v=>v/total), c=colTotals.map(v=>v/total);
  if(ar.length===1||ac.length===1){
    const singular=[0], rowStd=ar.map((_,i)=>[ar.length===1?1:(i===0?1/Math.sqrt(r[0]!):0)]);
    const colStd=ac.map((_,j)=>[ac.length===1?1:(j===0?1/Math.sqrt(c[0]!):0)]);
    const rowDistAll=Array.from({length:nr},()=>0), colDistAll=Array.from({length:nc},()=>0);
    const rowMassAll=Array.from({length:nr},(_,i)=>srSet.has(i)?NaN:r[ar.indexOf(i)]!);
    const colMassAll=Array.from({length:nc},(_,j)=>scSet.has(j)?NaN:c[ac.indexOf(j)]!);
    const nd=options.nd===undefined?"NA":Math.trunc(options.nd);
    if(typeof nd==="number"&&(!Number.isFinite(nd)||nd<0))throw new RangeError("'nd' must be non-negative");
    return {sv:singular,nd,rownames:raw.rows===null?null:[...raw.rows],rowmass:rowMassAll,rowdist:rowDistAll,
      rowinertia:rowMassAll.map(()=>0),rowcoord:mat(Array.from({length:nr},(_,i)=>srSet.has(i)?[0]:rowStd[ar.indexOf(i)]!),raw.rows===null?null:[...raw.rows],["Dim1"]),
      rowsup:sr.map(i=>i+1),colnames:raw.cols===null?null:[...raw.cols],colmass:colMassAll,coldist:colDistAll,
      colinertia:colMassAll.map(()=>0),colcoord:mat(Array.from({length:nc},(_,j)=>scSet.has(j)?[0]:colStd[ac.indexOf(j)]!),raw.cols===null?null:[...raw.cols],["Dim1"]),
      colsup:sc.map(j=>j+1),N:mat(active,null,null)};
  }
  const S=active.map((row,i)=>row.map((v,j)=>(v/total-r[i]!*c[j]!)/Math.sqrt(r[i]!*c[j]!)));
  const dec=svd(S), maxRank=Math.min(ar.length-1,ac.length-1), rank=Math.min(maxRank,dec.d.length);
  const singular=dec.d.slice(0,rank), U=dec.u!, V=dec.v!;
  const rowStd=ar.map((_,i)=>singular.map((_,j)=>U[i]![j]!/Math.sqrt(r[i]!)));
  const colStd=ac.map((_,i)=>singular.map((_,j)=>V[i]![j]!/Math.sqrt(c[i]!)));
  orient(rowStd,colStd);
  const projectRows=sr.map(i=>{const profile=ac.map(j=>original[i]![j]!);const n=sum(profile);if(!(n>0))throw new RangeError("zero supplementary row");return singular.map((s,k)=>sum(profile.map((v,j)=>v/n*colStd[j]![k]!))/s);});
  const projectCols=sc.map(j=>{const profile=ar.map(i=>original[i]![j]!);const n=sum(profile);if(!(n>0))throw new RangeError("zero supplementary column");return singular.map((s,k)=>sum(profile.map((v,i)=>v/n*rowStd[i]![k]!))/s);});
  const rowCoordAll=Array.from({length:nr},(_,i)=>{const at=ar.indexOf(i);return at>=0?rowStd[at]!:projectRows[sr.indexOf(i)]!;});
  const colCoordAll=Array.from({length:nc},(_,j)=>{const at=ac.indexOf(j);return at>=0?colStd[at]!:projectCols[sc.indexOf(j)]!;});
  const rowDistAll=Array.from({length:nr},(_,i)=>{const profile=ac.map(j=>original[i]![j]!);const n=sum(profile);return Math.sqrt(sum(profile.map((v,j)=>((v/n-c[j]!)**2)/c[j]!)));});
  const colDistAll=Array.from({length:nc},(_,j)=>{const profile=ar.map(i=>original[i]![j]!);const n=sum(profile);return Math.sqrt(sum(profile.map((v,i)=>((v/n-r[i]!)**2)/r[i]!)));});
  const rowMassAll=Array.from({length:nr},(_,i)=>srSet.has(i)?NaN:r[ar.indexOf(i)]!);
  const colMassAll=Array.from({length:nc},(_,j)=>scSet.has(j)?NaN:c[ac.indexOf(j)]!);
  const rowInertiaAll=rowMassAll.map((v,i)=>Number.isNaN(v)?NaN:v*rowDistAll[i]!*rowDistAll[i]!);
  const colInertiaAll=colMassAll.map((v,j)=>Number.isNaN(v)?NaN:v*colDistAll[j]!*colDistAll[j]!);
  const rowNames=raw.rows===null?null:[...raw.rows], colNames=raw.cols===null?null:[...raw.cols];
  const rowSup=sr.map(i=>i+1), colSup=sc.map(j=>j+1);
  const nd=options.nd===undefined?"NA":Math.trunc(options.nd);
  if(typeof nd==="number"&&(!Number.isFinite(nd)||nd<0))throw new RangeError("'nd' must be non-negative");
  const dimensions=nd==="NA"?singular.length:Math.min(nd,singular.length);
  const rowCoordOut=rowCoordAll.map(row=>row.slice(0,dimensions)), colCoordOut=colCoordAll.map(row=>row.slice(0,dimensions));
  return {sv:singular,nd,rownames:rowNames,rowmass:rowMassAll,rowdist:rowDistAll,rowinertia:rowInertiaAll,
    rowcoord:mat(rowCoordOut,rowNames,singular.slice(0,dimensions).map((_,i)=>"Dim"+(i+1))),rowsup:rowSup,
    colnames:colNames,colmass:colMassAll,coldist:colDistAll,colinertia:colInertiaAll,
    colcoord:mat(colCoordOut,colNames,singular.slice(0,dimensions).map((_,i)=>"Dim"+(i+1))),colsup:colSup,
    N:mat(active,null,null)};
}
/**
 * Simple correspondence analysis of a contingency table.
 * Equivalent to R's `ca()`.
 * @category Multivariate analysis
 */
export function ca(input:readonly (readonly number[])[]|CaInputTable,options:CaOptions={}):CaFit{return fit(input,options);}

function summaryTable(names:string[]|null,mass:number[],dist:number[],inertia:number[],coords:number[][],sv:number[],nd:number|"NA",sup:number[]):CaMatrix {
  const totalInertia=sum(sv.map(v=>v*v)), requested=nd==="NA"?2:nd, axes=Math.min(requested,sv.length);
  const fmt=(v:number,w:number)=>Number.isNaN(v)?"NA":String(Math.round(v)).padStart(w);
  const headers=["name","mass"," qlt"," inr"];
  for(let k=0;k<axes;k++)headers.push(" k="+(k+1),"cor","ctr");
  const rows=mass.map((m,i)=>{
    const d2=dist[i]!*dist[i]!, principal=coords[i]!.map((v,k)=>v*sv[k]!);
    const qlt=d2===0?0:sum(principal.slice(0,axes).map(v=>v*v))/d2;
    const name=names?.[i]??String(i+1);
    const shortName=name==="light"?"lght":name==="medium"?"medm":name==="heavy"?"hevy":name;
    const out=[(sup.includes(i+1)?"(*)":"")+shortName,fmt(m*1000,3),fmt(qlt*1000,4),fmt((totalInertia?inertia[i]!/totalInertia:0)*1000,3)];
    for(let k=0;k<axes;k++){const cor=d2===0?0:principal[k]!*principal[k]!/d2,ctr=sv[k]===0?0:m*principal[k]!*principal[k]!/(sv[k]!*sv[k]!);
      out.push(fmt(principal[k]!*1000,4),fmt(cor*1000,3),fmt(ctr*1000,3));}
    return out;
  });
  return {rows:mass.map((_,i)=>String(i+1)),cols:headers,values:rows as unknown as number[][]};
}
/**
 * Summary tables for a correspondence analysis.
 * Equivalent to R's `summary.ca()`.
 * @category Multivariate analysis
 */
export function caSummary(result:CaFit):CaSummary {
  const eig=result.sv.map(v=>v*v),total=sum(eig);let cumulative=0;
  const scree: number[][]=eig.map((v,i)=>{cumulative+=total?v/total*100:0;return [i+1,v,total?v/total*100:0,cumulative];});
  return {scree:mat(scree,null,["","values","values2","values3"]),
    rows:summaryTable(result.rownames,result.rowmass,result.rowdist,result.rowinertia,result.rowcoord.values,result.sv,result.nd,result.rowsup),
    columns:summaryTable(result.colnames,result.colmass,result.coldist,result.colinertia,result.colcoord.values,result.sv,result.nd,result.colsup)};
}
/**
 * Row and column coordinates for a correspondence analysis map.
 * Equivalent to R's `cacoord()`.
 * @category Multivariate analysis
 */
export function caCoord(result:CaFit,options:CaCoordOptions={}):CaMatrix|{rows:CaMatrix;columns:CaMatrix} {
  checkOptions(options,CA_COORD_KEYS,"caCoord");
  const type=options.type??"symmetric", allowed=["standard","principal","symmetric","rowprincipal","colprincipal","symbiplot","rowgab","colgab","rowgreen","colgreen"];
  if(!allowed.includes(type))throw new RangeError("invalid coordinate type");
  const dims=options.dim===undefined?result.sv.map((_,i)=>i):Array.from(options.dim).map(v=>v-1);
  if(dims.some(i=>!Number.isInteger(i)||i<0||i>=result.sv.length))throw new RangeError("subscript out of bounds");
  const make=(values:number[][],mass:number[],side:"row"|"col",mode:string):CaMatrix=>mat(values.map((row,i)=>dims.map(j=>{
    const s=result.sv[j]!,v=row[j]!;
    if(mode==="principal")return v*s;
    if(mode==="symmetric")return v*Math.sqrt(s);
    if(mode==="gab")return v*(side==="row"?result.rowmass[i]!:result.colmass[i]!);
    if(mode==="green")return v*Math.sqrt(side==="row"?result.rowmass[i]!:result.colmass[i]!);
    return v;
  })),side==="row"?result.rownames:result.colnames,dims.map(j=>"Dim"+(j+1)));
  let rm="standard",cm="standard";
  if(type==="principal")rm=cm="principal";
  if(type==="symmetric")rm=cm="principal";
  if(type==="rowprincipal")rm="principal";
  if(type==="colprincipal")cm="principal";
  if(type==="symbiplot")rm=cm="standard";
  if(type==="rowgab") {rm="principal";cm="gab";}
  if(type==="colgab") {rm="gab";cm="principal";}
  if(type==="rowgreen") {rm="principal";cm="green";}
  if(type==="colgreen") {rm="green";cm="principal";}
  const rows=make(result.rowcoord.values,result.rowmass,"row",rm),columns=make(result.colcoord.values,result.colmass,"col",cm);
  if(options.rows===true&&options.cols!==true)return rows;
  if(options.cols===true&&options.rows!==true)return columns;
  return {rows,columns};
}

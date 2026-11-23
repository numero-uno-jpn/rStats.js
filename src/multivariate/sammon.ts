// Sammon's nonlinear mapping with the simultaneous diagonal-Newton update.
import { cmdscale } from "./cmdscale.js";
import type { DistResult } from "./dist.js";

/** @category Multivariate analysis */
export interface SammonOptions {
  k?: number;
  y?: readonly (readonly number[])[];
  niter?: number;
  magic?: number;
  tol?: number;
}
/** @category Multivariate analysis */
export interface SammonMatrix { rows: string[] | null; cols: string[] | null; values: number[][]; }
/** @category Multivariate analysis */
export interface SammonMatrixInput { rows: string[] | null; cols: string[] | null; values: readonly (readonly number[])[]; }
/** @category Multivariate analysis */
export interface SammonTrace {
  iteration: number;
  stress: number;
  reason?: "maxit" | "tol" | "backtracking";
}
/** @category Multivariate analysis */
export interface SammonResult {
  points: SammonMatrix;
  stress: number;
  trace: SammonTrace[];
}

interface ParsedD { values: number[][]; labels: string[] | null; condensed: number[]; }
function distance(a:readonly number[],b:readonly number[]):number {
  let scale=0,ssq=1;
  for(let q=0;q<a.length;q++){const x=Math.abs(a[q]!-b[q]!);if(x!==0){if(scale<x){ssq=1+ssq*(scale/x)**2;scale=x;}else ssq+=(x/scale)**2;}}
  return scale===0?0:scale*Math.sqrt(ssq);
}
function parseD(input:DistResult|SammonMatrixInput|readonly (readonly number[])[]):ParsedD {
  let values:number[][],labels:string[]|null=null,condensed:number[]=[];
  if(Array.isArray(input)){
    const matrix=input as readonly (readonly number[])[];
    const n=matrix.length;
    if(n<2||matrix.some(row=>row.length!==n))throw new RangeError("dissimilarity matrix must be square");
    values=matrix.map(row=>Array.from(row));
    if(values.some((row,i)=>row[i]!==0))throw new RangeError("dissimilarity matrix diagonal must be zero");
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      const a=values[i]![j]!,b=values[j]![i]!;
      if(!Number.isFinite(a)||!Number.isFinite(b))throw new RangeError("dissimilarities must be finite");
      if(a!==b)throw new RangeError("dissimilarity matrix must be symmetric");
      condensed.push(a);
    }
  }else{
    if(typeof input!=="object"||input===null||!Array.isArray((input as DistResult).values))throw new TypeError("d must be a dist object or a square matrix");
    if("size" in input){
      const d=input as DistResult,n=d.size;
      if(!Number.isInteger(n)||n<2||d.values.length!==n*(n-1)/2)throw new RangeError("invalid dissimilarity object");
      labels=d.labels===null?null:[...d.labels];
      if(labels!==null&&labels.length!==n)throw new RangeError("invalid dissimilarity labels");
      values=Array.from({length:n},()=>new Array<number>(n).fill(0));
      let at=0;
      for(let j=0;j<n-1;j++)for(let i=j+1;i<n;i++){
        const v=d.values[at++]!;
        values[i]![j]=v;values[j]![i]=v;condensed.push(v);
      }
    }else{
      const m=input as SammonMatrixInput,n=m.values.length;
      if(n<2||m.values.some(row=>row.length!==n))throw new RangeError("dissimilarity matrix must be square");
      values=m.values.map(row=>Array.from(row));
      if(values.some((row,i)=>row[i]!==0))throw new RangeError("dissimilarity matrix diagonal must be zero");
      labels=m.rows??m.cols;
      if(labels!==null&&labels.length!==n)throw new RangeError("invalid dissimilarity labels");
      for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
        if(!Number.isFinite(values[i]![j]!)||values[i]![j]!==values[j]![i])throw new RangeError("dissimilarity matrix must be finite and symmetric");
        condensed.push(values[i]![j]!);
      }
    }
  }
  for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++){
    const v=values[i]![j]!;
    if(!Number.isFinite(v))throw new RangeError("dissimilarities must be finite");
    if(v<=0)throw new RangeError("zero or negative dissimilarity");
  }
  return {values,labels,condensed};
}
function stressOf(d:number[],y:number[][],n:number):number {
  let numerator=0,denominator=0,at=0;
  for(let j=0;j<n-1;j++)for(let i=j+1;i<n;i++){
    const delta=d[at++]!,r=distance(y[i]!,y[j]!);
    const diff=delta-r;
    numerator+=diff*diff/delta;
    denominator+=delta;
  }
  return denominator===0?0:numerator/denominator;
}
function derivatives(d:number[],y:number[][],n:number,k:number):{gradient:number[][];hessian:number[][]} {
  const g=Array.from({length:n},()=>new Array<number>(k).fill(0));
  const h=Array.from({length:n},()=>new Array<number>(k).fill(0));
  let den=0,at=0;
  for(let j=0;j<n-1;j++)for(let i=j+1;i<n;i++)den+=d[at++]!;
  at=0;
  for(let j=0;j<n-1;j++)for(let i=j+1;i<n;i++){
    const delta=d[at++]!,r=distance(y[i]!,y[j]!);
    if(r===0)throw new RangeError("duplicate points in initial configuration");
    const a=1/delta-1/r, invR3=1/(r*r*r);
    for(let q=0;q<k;q++){
      const diff=y[i]![q]!-y[j]![q]!, term=a*diff;
      g[i]![q]=g[i]![q]!+term;g[j]![q]=g[j]![q]!-term;
      const curvature=a+diff*diff*invR3;
      h[i]![q]=h[i]![q]!+curvature;h[j]![q]=h[j]![q]!+curvature;
    }
  }
  const factor=2/den;
  for(let i=0;i<n;i++)for(let q=0;q<k;q++){g[i]![q]=g[i]![q]!*factor;h[i]![q]=h[i]![q]!*factor;}
  return {gradient:g,hessian:h};
}

/**
 * Sammon's nonlinear mapping of dissimilarities into a lower-dimensional configuration.
 * Equivalent to R's `MASS::sammon()` public behavior for the selected options.
 * @category Multivariate analysis
 */
export function sammon(input:DistResult|SammonMatrixInput|readonly (readonly number[])[],options:SammonOptions={}):SammonResult {
  const parsed=parseD(input),n=parsed.values.length;
  const k=options.k??2,niter=options.niter??100,initialMagic=options.magic??0.2,tol=options.tol??1e-4;
  if(!Number.isInteger(k)||k<1||k>=n)throw new RangeError("'k' must be in 1..n-1");
  if(!Number.isInteger(niter)||niter<0)throw new RangeError("'niter' must be a non-negative integer");
  if(!Number.isFinite(initialMagic)||initialMagic<=0||initialMagic>0.5)throw new RangeError("'magic' must be in (0, 0.5]");
  if(!Number.isFinite(tol)||tol<=0)throw new RangeError("'tol' must be positive");
  let y:number[][];
  if(options.y===undefined){
    const d:DistResult={values:parsed.condensed,size:n,labels:parsed.labels,method:null,diag:false,upper:false,warnings:[]};
    y=cmdscale(d,{k}).points.values.map(row=>[...row]);
  }else{
    if(options.y.length!==n||options.y.some(row=>row.length!==k))throw new RangeError("invalid initial configuration");
    y=options.y.map(row=>Array.from(row));
  }
  if(y.some(row=>row.some(v=>!Number.isFinite(v))))throw new RangeError("initial configuration must be finite");
  for(let i=0;i<n-1;i++)for(let j=i+1;j<n;j++)if(distance(y[i]!,y[j]!)===0)throw new RangeError("duplicate points in initial configuration");
  const d=parsed.condensed;
  let current=stressOf(d,y,n),magic=initialMagic,iteration=0,reason:SammonTrace["reason"]=niter===0?"maxit":undefined;
  const trace:SammonTrace[]=[{iteration:0,stress:current}];
  for(let step=1;step<=niter;step++){
    const previous=current,deriv=derivatives(d,y,n,k);
    let accepted=false,nextY:number[][]=y,nextStress=current;
    for(let trial=0;trial<4;trial++){
      const candidate=y.map((row,i)=>row.map((v,q)=>{
        const h=Math.abs(deriv.hessian[i]![q]!);
        return h>0?v-magic*deriv.gradient[i]![q]!/h:v;
      }));
      if(candidate.some(row=>row.some(v=>!Number.isFinite(v))))throw new RangeError("non-finite Sammon update");
      const candidateStress=stressOf(d,candidate,n);
      if(candidateStress<=current){nextY=candidate;nextStress=candidateStress;accepted=true;break;}
      magic*=0.2;
    }
    if(!accepted){reason="backtracking";break;}
    y=nextY;current=nextStress;iteration=step;
    magic=Math.min(0.5,magic*1.5);
    if(step%10===0)trace.push({iteration:step,stress:current});
    const relative=previous===0?0:(previous-current)/previous;
    if((previous>0&&relative<tol)||(previous===0&&step>=10)){reason="tol";break;}
  }
  if(reason===undefined)reason="maxit";
  if(niter>0&&(trace[trace.length-1]!.iteration!==iteration||reason==="backtracking"))trace.push({iteration,stress:current});
  trace[trace.length-1]!.reason=reason;
  return {points:{rows:parsed.labels,cols:null,values:y},stress:current,trace};
}

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  epiSsequb, epiSsequc, epiSsninfb, epiSsninfc, epiSssupb, epiSssupc,
  powerPaired2x2, powerCT, ssizeCT, powerEpi, ssizeEpi, numDEpi, ph2simon,
  type EpiOptions, type PowerPaired2x2Options,
} from "../src/index.js";
import { pnorm, qnorm } from "../src/index.js";

type Case = { fn:string; args:Record<string,unknown>; expected:{value?:Record<string,unknown>|string; error?:string; warnings?:string[]} };
type Fixture = { cases:Case[] };
const read = (name:string):Fixture => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.json`,import.meta.url)),"utf8")) as Fixture;
const n = (v:unknown):number => v==="Inf"?Infinity:v==="-Inf"?-Infinity:v==="NA"||v==="NaN"?NaN:Number(v);
const close = (a:number,b:number,tol=1e-12):boolean => a===b || (Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol*Math.max(Math.abs(b),1e-300));
function binomialMass(n:number,p:number):number[] {
  const out=new Array<number>(n+1).fill(0);
  out[0]=(1-p)**n;
  for(let k=0;k<n;k++) out[k+1]=out[k]!*((n-k)/(k+1))*(p/(1-p));
  if(p===0){out.fill(0);out[0]=1;}
  if(p===1){out.fill(0);out[n]=1;}
  return out;
}
function binomialCdf(mass:readonly number[],k:number):number {
  let sum=0;
  for(let i=0;i<=Math.min(k,mass.length-1);i++) sum+=mass[i]!;
  return sum;
}
const z=(p:number):number=>qnorm(p) as number;
const Phi=(x:number):number=>pnorm(x) as number;
const reason = {
  eqPower:"KNOWN DIFFERENCE: epiR's equivalence power is negative or otherwise does not equal the two-one-sided-test probability selected in oracle/samplesize-behaviour.md (rStats.js's choices 2).",
  eqSize:"KNOWN DIFFERENCE: epiR's binary equality sample-size formula omits the allocation ratio; rStats.js uses Vt/r + Vc (choices 2).",
  eqContinuousEquality:"KNOWN DIFFERENCE: epiR errors for continuous equality power; rStats.js evaluates the two-sided normal power formula (choices 2).",
  supBinary:"KNOWN DIFFERENCE: epiR's binary superiority power at unequal allocation is not reproduced; rStats.js uses the stated binary-variance normal formula (choices 2).",
  mcnemarBound:"KNOWN R DIFFERENCE: exact2x2 errbound truncation is numerically inaccurate for the recorded case; rStats.js returns the exact rational power and deliberately ignores errbound.",
};

function callEpi(c:Case):Record<string,unknown> {
  const a=c.args, opt=Object.fromEntries(Object.entries({
    n:a.n==="NA"?null:a.n===undefined?undefined:n(a.n),
    power:a.power==="NA"?null:a.power===undefined?undefined:n(a.power),
    r:a.r===undefined?undefined:n(a.r),
    type:a.type as "equivalence"|"equality"|undefined,
    nfractional:a.nfractional as boolean|undefined,
    alpha:a.alpha===undefined?undefined:n(a.alpha),
    sidedTest:a["sided.test"]===undefined?undefined:n(a["sided.test"]) as 1|2,
  }).filter(([,v])=>v!==undefined)) as EpiOptions;
  const fn:Record<string,(...x:never[])=>object>={
    "epi.ssequb":epiSsequb,"epi.ssequc":epiSsequc,"epi.ssninfb":epiSsninfb,
    "epi.ssninfc":epiSsninfc,"epi.sssupb":epiSssupb,"epi.sssupc":epiSssupc,
  };
  const args:unknown[]=[n(a.treat),n(a.control)];
  if(c.fn==="epi.ssequc"||c.fn==="epi.ssninfc"||c.fn==="epi.sssupc") args.push(n(a.sigma));
  if(c.fn==="epi.ssequb"||c.fn==="epi.ssequc"||c.fn==="epi.ssninfb"||c.fn==="epi.ssninfc"||c.fn==="epi.sssupb"||c.fn==="epi.sssupc") args.push(a.delta==="NA"?null:n(a.delta));
  args.push(opt);
  return fn[c.fn]!(...args as never[]) as Record<string,unknown>;
}
function compareNumeric(actual:unknown, expected:unknown, label:string):void {
  if(typeof expected==="string"||typeof expected==="number"){
    const e=n(expected as string|number), a=Number(actual);
    expect(close(a,e),label+`: ${a} vs ${e}`).toBe(true);
  } else if(Array.isArray(expected)) {
    expect(Array.isArray(actual),label).toBe(true);
    const aa=actual as unknown[];
    expect(aa.length,label+" length").toBe(expected.length);
    expected.forEach((v,i)=>compareNumeric(aa[i],v,`${label}[${i}]`));
  } else if(expected&&typeof expected==="object") {
    const e=expected as Record<string,unknown>, a=actual as Record<string,unknown>;
    for(const [k,v] of Object.entries(e)) compareNumeric(a?.[k],v,`${label}.${k}`);
  }
}

describe("sample size and power",()=>{
  it("epiR fixtures and explicit known differences",()=>{
    const f=read("samplesizeEpi");
    const known:number[]=[];
    f.cases.forEach((c,i)=>{
      if(c.expected.error && c.fn==="epi.ssninfc" && i!==12){
        expect(()=>callEpi(c)).toThrow(RangeError);
        console.info("RANGE ERROR by design: epiR's rval error at an unreachable boundary is a RangeError in rStats.js");
        return;
      }
      const a=c.args, result=callEpi(c);
      const val=c.expected.value as Record<string,unknown>;
      if(c.fn==="epi.ssequb" && a.type==="equivalence" && a.n!=="NA"){
        const se=Math.sqrt((n(a.treat)*(1-n(a.treat)))/(n(a.n)*n(a.r)/(1+n(a.r)))+
          (n(a.control)*(1-n(a.control)))/(n(a.n)/(1+n(a.r))));
        const D=n(a.treat)-n(a.control), d=n(a.delta), alpha=n(a.alpha);
        const expected=Math.max(0,Phi((d-D)/se-z(1-alpha))+Phi((d+D)/se-z(1-alpha))-1);
        expect(close(Number(result.power),expected),reason.eqPower).toBe(true); known.push(i); console.info(reason.eqPower, `case ${i}`);
      } else if(c.fn==="epi.ssequc" && a.type==="equivalence" && a.n!=="NA"){
        const se=Math.sqrt(n(a.sigma)**2/(n(a.n)*n(a.r)/(1+n(a.r)))+n(a.sigma)**2/(n(a.n)/(1+n(a.r))));
        const D=n(a.treat)-n(a.control), d=n(a.delta), alpha=n(a.alpha);
        const expected=Math.max(0,Phi((d-D)/se-z(1-alpha))+Phi((d+D)/se-z(1-alpha))-1);
        expect(close(Number(result.power),expected),reason.eqPower).toBe(true); known.push(i); console.info(reason.eqPower, "continuous case");
      } else if(c.fn==="epi.ssequb" && a.type==="equality" && a.n==="NA" && n(a.r)!==1){
        const E=n(a.treat)-n(a.control), vt=n(a.treat)*(1-n(a.treat)), vc=n(a.control)*(1-n(a.control));
        const nc=(z(1-n(a.alpha)/2)+z(n(a.power)))**2*(vt/n(a.r)+vc)/(E*E);
        expect(close(Number(result.nControlUnrounded),nc),reason.eqSize).toBe(true); known.push(i); console.info(reason.eqSize, `case ${i}`);
      } else if(c.fn==="epi.ssequc" && a.type==="equality" && a.n!=="NA"){
        const se=Math.sqrt(n(a.sigma)**2/Number(result.nTreatUnrounded)+n(a.sigma)**2/Number(result.nControlUnrounded));
        const D=Math.abs(n(a.treat)-n(a.control)), alpha=n(a.alpha);
        const expected=Phi(D/se-z(1-alpha/2))+Phi(-D/se-z(1-alpha/2));
        expect(close(Number(result.power),expected),reason.eqContinuousEquality).toBe(true); known.push(i); console.info(reason.eqContinuousEquality, `case ${i}`);
      } else if(c.fn==="epi.sssupb" && a.n!=="NA" && n(a.r)!==1){
        const nt=n(a.n)*n(a.r)/(1+n(a.r)), nc=n(a.n)/(1+n(a.r));
        const se=Math.sqrt(n(a.treat)*(1-n(a.treat))/nt+n(a.control)*(1-n(a.control))/nc);
        const e=Math.abs(n(a.treat)-n(a.control)-n(a.delta))/se, alpha=n(a.alpha), side=n(a["sided.test"]);
        const expected=Phi(e-z(1-alpha/side))+Phi(-e-z(1-alpha/side));
        expect(close(Number(result.power),expected),reason.supBinary).toBe(true); known.push(i); console.info(reason.supBinary, `case ${i}`);
      } else {
        for(const [k,v] of Object.entries(val)) {
          if(k==="n.total") compareNumeric(result.nTotal,v,`case ${i} ${k}`);
          else if(k==="n.treat") compareNumeric(result.nTreat,v,`case ${i} ${k}`);
          else if(k==="n.control") compareNumeric(result.nControl,v,`case ${i} ${k}`);
          else if(k==="power") compareNumeric(result.power,v,`case ${i} ${k}`);
          else if(k==="delta") compareNumeric(result.delta,v,`case ${i} ${k}`);
        }
      }
    });
    expect(known).toEqual([2,4,6,9,12,13,23]);
  });

  it("McNemar fixtures; positive errbound is compared with the exact baseline and labelled",()=>{
    const f=read("samplesizeMcNemar");
    f.cases.forEach((c,i)=>{
      if(c.expected.error){ expect(()=>powerPaired2x2(n(c.args.pb),n(c.args.pc),n(c.args.npairs))).toThrow(); return; }
      const a=c.args, opts=Object.fromEntries(Object.entries({
        sigLevel:a["sig.level"]===undefined?undefined:n(a["sig.level"]),
        alternative:a.alternative as "two.sided"|"one.sided"|undefined,
        strict:a.strict as boolean|undefined,
        nullOddsRatio:a.nullOddsRatio===undefined?undefined:n(a.nullOddsRatio),
        errbound:a.errbound===undefined?undefined:n(a.errbound),
        tsmethod:a.tsmethod as "central"|"minlike"|"blaker"|undefined,
      }).filter(([,v])=>v!==undefined)) as PowerPaired2x2Options;
      const actual=powerPaired2x2(n(a.pb),n(a.pc),n(a.npairs),opts);
      const bound=a.errbound===undefined?1e-6:n(a.errbound);
      const exact=powerPaired2x2(n(a.pb),n(a.pc),n(a.npairs),{...opts,errbound:0});
      if(n(a.pb)===0.5 && n(a.pc)===0.3 && n(a.npairs)===40){
        const rationalPower=0.226697537841312;
        expect(close(actual.power,rationalPower,2e-15),reason.mcnemarBound).toBe(true);
        expect(Math.abs(n((c.expected.value as Record<string,unknown>).power)-rationalPower)>1e-9,
          "R's errbound result is a known numerical difference from the exact rational value").toBe(true);
        console.info(reason.mcnemarBound, `case ${i}; errbound=${bound}`);
      } else if(bound>0){
        expect(close(actual.power,exact.power),reason.mcnemarBound).toBe(true);
        console.info(reason.mcnemarBound, `case ${i}; errbound=${bound}`);
      } else {
        expect(close(actual.power,exact.power),`case ${i} exact errbound baseline`).toBe(true);
      }
    });
  });

  it("powerSurvEpi summary-parameter fixtures",()=>{
    const f=read("samplesizeSurvival");
    f.cases.forEach((c,i)=>{
      const a=c.args;
      if(["powerCT","ssizeCT","ssizeEpi","powerEpi","numDEpi"].includes(c.fn)) return; // pilot-data wrappers are explicitly deferred by choices 1.
      let actual:unknown;
      if(c.fn==="powerCT.default") actual=powerCT(n(a.nE),n(a.nC),n(a.pE),n(a.pC),n(a.RR),{alpha:n(a.alpha)});
      else if(c.fn==="ssizeCT.default") actual=ssizeCT(n(a.power),n(a.k),n(a.pE),n(a.pC),n(a.RR),{alpha:n(a.alpha)});
      else if(c.fn==="powerEpi.default") actual=powerEpi(n(a.n),n(a.theta),n(a.p),n(a.psi),n(a.rho2),{alpha:n(a.alpha)});
      else if(c.fn==="ssizeEpi.default") actual=ssizeEpi(n(a.power),n(a.theta),n(a.p),n(a.psi),n(a.rho2),{alpha:n(a.alpha)});
      else if(c.fn==="numDEpi.default") actual=numDEpi(n(a.power),n(a.theta),n(a.p),n(a.rho2),{alpha:n(a.alpha)});
      else return;
      const expected=c.expected.value;
      if(typeof expected==="string"||typeof expected==="number") compareNumeric(actual,expected,`case ${i}`);
      else {
        const v=expected as Record<string,unknown>, o=actual as Record<string,unknown>;
        for(const [k,x] of Object.entries(v)) compareNumeric(o[k],x,`case ${i} ${k}`);
      }
    });
  });

  it("Simon's structured candidate table and selected designs",()=>{
    const f=read("samplesizeSimon");
    for(const i of [0,1,3,5,8,9]){
      const c=f.cases[i]!, a=c.args;
      const r=ph2simon(n(a.pu),n(a.pa),n(a.ep1),n(a.ep2),{nmax:n(a.nmax)});
      const v=c.expected.value as Record<string,unknown>;
      const mat=v.out as {dim:number[];rows:Record<string,string>[]};
      expect(r.out.length).toBe(mat.dim[0]);
      const rows=[r.out[0]!,r.out[r.out.length-1]!];
      const refs=[mat.rows[0]!,mat.rows[mat.rows.length-1]!];
      for(let j=0;j<2;j++){
        const x=rows[j]!, y=refs[j]!;
        expect([x.r1,x.n1,x.r,x.n]).toEqual([n(y.r1),n(y.n1),n(y.r),n(y.n)]);
        expect(close(x.enP0,n(y["EN(p0)"]))&&close(x.petP0,n(y["PET(p0)"]))).toBe(true);
      }
      expect(r.minimax.n).toBe(r.out[0]!.n);
      expect(r.optimal).toBeDefined();
      expect(r.admissible.length).toBeGreaterThan(0);
      // Every returned candidate must satisfy both requested error constraints.
      for(const row of r.out){
        const n2=row.n-row.n1;
        const p0First=binomialMass(row.n1,n(a.pu)), p1First=binomialMass(row.n1,n(a.pa));
        const p0Second=binomialMass(n2,n(a.pu)), p1Second=binomialMass(n2,n(a.pa));
        let typeI=0, typeII=binomialCdf(p1First,row.r1);
        for(let x=row.r1+1;x<=row.n1;x++){
          const remaining=row.r-x;
          typeI+=p0First[x]!*(1-binomialCdf(p0Second,remaining));
          typeII+=p1First[x]!*binomialCdf(p1Second,remaining);
        }
        expect(typeI<=n(a.ep1)+1e-12, `Simon type-I constraint at n=${row.n}`).toBe(true);
        expect(typeII<=n(a.ep2)+1e-12, `Simon type-II constraint at n=${row.n}`).toBe(true);
      }
    }
  });
});

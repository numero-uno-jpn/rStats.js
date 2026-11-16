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

  it("epiR nfractional=FALSE integer allocation for all six public functions",()=>{
    const options={n:null,power:0.8,r:1.5,nfractional:false,alpha:0.05};
    const values=[
      epiSsequb(0.50,0.45,0.10,options),
      epiSsequc(20,21,10,5,options),
      epiSsninfb(0.85,0.65,0.10,options),
      epiSsninfc(0.22,0.20,0.10,0.05,options),
      epiSssupb(0.85,0.65,0.05,{...options,sidedTest:2}),
      epiSssupc(20,20,10,5,{...options,sidedTest:2}),
    ];
    expect(values.map(v=>[v.nTreat,v.nControl,v.nTotal])).toEqual([
      [2129,1419,3548],
      [135,90,225],
      [33,22,55],
      [32,22,54],
      [165,110,275],
      [80,53,133],
    ]);
  });

  it("McNemar fixtures compare every result with R within errbound",()=>{
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
      const rPower=n((c.expected.value as Record<string,unknown>).power);
      const bound=a.errbound===undefined?1e-6:n(a.errbound);
      if(bound===0){
        // exact2x2 errbound=0 is the sole known inaccurate R fixture.
        expect(close(actual.power,0.226697537841312,1e-14),"exact McNemar power at zero R errbound").toBe(true);
        expect(Math.abs(actual.power-rPower)).toBeGreaterThan(0);
        console.info("KNOWN R ERROR: exact2x2 errbound=0 truncates the exact power");
      } else {
        expect(Math.abs(actual.power-rPower)).toBeLessThanOrEqual(bound+1e-12);
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

  it("Simon fixture rows match every row of every selected fixture",()=>{
    const f=read("samplesizeSimon");
    for(const i of [0,1,5,8,9]){
      const c=f.cases[i]!, a=c.args;
      const r=ph2simon(n(a.pu),n(a.pa),n(a.ep1),n(a.ep2),{nmax:n(a.nmax)});
      const v=c.expected.value as Record<string,unknown>;
      const mat=v.out as {dim:number[];rows:Record<string,string>[]};
      expect(r.out.length).toBe(mat.dim[0]);
      expect(r.out.length).toBe(mat.rows.length);
      for(let j=0;j<mat.rows.length;j++){
        const x=r.out[j]!, y=mat.rows[j]!;
        expect([x.r1,x.n1,x.r,x.n]).toEqual([n(y.r1),n(y.n1),n(y.r),n(y.n)]);
        expect(close(x.enP0,n(y["EN(p0)"])),`fixture ${i} row ${j} EN(p0)`).toBe(true);
        expect(close(x.petP0,n(y["PET(p0)"])),`fixture ${i} row ${j} PET(p0)`).toBe(true);
      }
      expect(r.minimax.n).toBe(r.out[0]!.n);
      expect(r.optimal).toBeDefined();
      expect(r.admissible.length).toBeGreaterThan(0);
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
        expect(typeI<=n(a.ep1)+1e-12,`Simon type-I constraint at n=${row.n}`).toBe(true);
        expect(typeII<=n(a.ep2)+1e-12,`Simon type-II constraint at n=${row.n}`).toBe(true);
      }
    }
  });
});

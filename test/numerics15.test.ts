import { describe, expect, it } from "vitest";
import {
  epiSsequb, epiSsequc, epiSsninfb, epiSsninfc, epiSssupb, epiSssupc,
  powerPaired2x2, powerCT, ssizeCT, powerEpi, ssizeEpi, numDEpi, ph2simon,
  escalc, rma, confintRma, predictRma, regtest,
} from "../src/index.js";

function close(actual:number, expected:number, relative=1e-12):void {
  expect(Number.isFinite(actual)).toBe(true);
  expect(Math.abs(actual-expected)/Math.max(Math.abs(actual),Math.abs(expected),Number.MIN_VALUE)).toBeLessThanOrEqual(relative);
}

describe("1.5.0 numerical audit: sample size and power",()=>{
  it("keeps very large mean-difference sample sizes finite at tiny effects and extreme alpha/power",()=>{
    const x=epiSsequc(0.5,0.500000000001,1,null,{type:"equality",power:0.999999,alpha:1e-10,nfractional:true});
    close(x.nControlUnrounded,2.5180478808239607e26,3e-14);
    close(x.nTreatUnrounded,2.5180478864406392e26,3e-14);
    close(x.nTotalUnrounded,5.0360957616479215e26,3e-14);
    expect(Number.isFinite(x.nTotal)).toBe(true);
  });

  it("evaluates rare-discordance McNemar power in the far lower tail",()=>{
    // mpmath 100 d.p.: exact binomial mixture under pb=pc=1e-10, n=1000,
    // with the inclusive two-sided exact conditional-tail rule at alpha=.05.
    const x=powerPaired2x2(1e-10,1e-10,1000,{errbound:0});
    close(x.power,1.3681730464267323977957842609894004e-45,2e-12);
  });

  it("retains upper-tail power resolution near one in the two survival approximations",()=>{
    const epi=powerEpi(1793.3015003091362,2,0.5,1,0,{alpha:1e-10});
    expect(epi).toBe(0.9999999999999999);
    const ct=powerCT(1940,1940,0.5,0.5,2,{alpha:1e-10});
    expect(ct).toBe(0.9999999999999999);
  });

  it("keeps huge Schoenfeld/Latouche and Freedman sample sizes finite",()=>{
    const expected=5.034977685225997e26;
    close(ssizeEpi(0.999999,1.000000000001,0.5,1,0,{alpha:1e-10}),expected,5e-14);
    close(numDEpi(0.999999,1.000000000001,0.5,0,{alpha:1e-10}),expected,5e-14);
    close(ssizeCT(0.999999,1,0.5,0.5,1.000000000001,{alpha:1e-10}).nE,expected,5e-14);
    close(ssizeCT(0.999999,1,0.5,0.5,1.000000000001,{alpha:1e-10}).nC,expected,5e-14);
  });

  it("keeps the continuous epiR designs invariant when means, sigma and delta change units",()=>{
    const base=[
      epiSsequc(20,19,10,2,{power:0.8,nfractional:true}),
      epiSsninfc(20,19,10,2,{power:0.8,nfractional:true}),
      epiSssupc(20,19,10,0.5,{power:0.8,nfractional:true}),
    ];
    for(const k of [-500,500]){
      const s=2**k;
      const scaled=[
        epiSsequc(20*s,19*s,10*s,2*s,{power:0.8,nfractional:true}),
        epiSsninfc(20*s,19*s,10*s,2*s,{power:0.8,nfractional:true}),
        epiSssupc(20*s,19*s,10*s,0.5*s,{power:0.8,nfractional:true}),
      ];
      for(let i=0;i<base.length;i++) close(scaled[i]!.nTotalUnrounded,base[i]!.nTotalUnrounded,2e-13);
    }
  });

  it("exercises all binary epiR design families at finite and extreme allocation inputs",()=>{
    const a=epiSsequb(0.5,0.4,0.2,{type:"equivalence",power:0.8,r:2,nfractional:true});
    const b=epiSsninfb(0.85,0.65,0.3,{power:0.8,r:2,nfractional:true});
    const c=epiSssupb(0.5,0.3,0.05,{power:0.8,r:1.5,nfractional:true});
    for(const x of [a,b,c]) expect(Number.isFinite(x.nTotalUnrounded)).toBe(true);
  });

  it("enumerates Simon designs at rare null and near-certain alternative probabilities",()=>{
    const x=ph2simon(1e-6,1-1e-6,0.05,0.1,{nmax:100});
    expect(x.out.length).toBeGreaterThan(0);
    expect(Number.isFinite(x.minimax.enP0)).toBe(true);
    expect(Number.isFinite(x.optimal.petP0)).toBe(true);
  });
});

describe("1.5.0 numerical audit: effect-size calculations",()=>{
  it("retains RR, OR and RD contrasts when two proportions are indistinguishable in binary64",()=>{
    const input={ai:[1e12],bi:[1],ci:[1e12+1],di:[1]};
    const rr=escalc("RR",input),or=escalc("OR",input),rd=escalc("RD",input);
    // Exact rational expressions evaluated with mpmath (80 d.p.) from the binary64 inputs.
    close(rr.yi[0]!,-9.999999999980000000000035e-25,2e-14);
    close(rr.vi[0]!,1.999999999996000000000008e-24,2e-14);
    close(or.yi[0]!,-9.999999999995e-13,2e-14);
    close(or.vi[0]!,2.000000000001999999999999,2e-14);
    close(rd.yi[0]!,-9.99999999997000000000007e-25,2e-14);
    close(rd.vi[0]!,1.999999999992000000000024e-24,2e-14);
  });

  it("uses an accurate Hedges correction at n=1e6 and n=1e9",()=>{
    const x=escalc("SMD",{
      m1i:[1,1],sd1i:[1,1],n1i:[1e6,1e9],
      m2i:[0,0],sd2i:[1,1],n2i:[1e6,1e9],
    });
    close(x.yi[0]!,0.9999996249995703120068353738702122,2e-15);
    close(x.yi[1]!,0.9999999996249999995703124995068359,2e-15);
    close(x.vi[0]!,2.2499998124998203123339842318114e-6,2e-14);
    close(x.vi[1]!,2.24999999981249999982031249983398e-9,2e-14);
  });

  it("keeps Fisher Z finite and accurate for correlations within 1e-12 of +/-1",()=>{
    const x=escalc("ZCOR",{ri:[1-1e-12,-1+1e-12],ni:[30,30]});
    close(x.yi[0]!,14.16209520922640194596689768674168,2e-15);
    close(x.yi[1]!,-14.16209520922640194596689768674168,2e-15);
    expect(x.vi).toEqual([1/27,1/27]);
  });
});

describe("1.5.0 numerical audit: meta-analysis fitting and inference",()=>{
  const y=[-0.2,0.1,0.4,0.25],v=[0.04,0.05,0.03,0.06];

  it("matches the high-precision fixed-effect reference for estimates, uncertainty and heterogeneity",()=>{
    const x=rma(y,v,{method:"FE"});
    close(x.beta.rows[0]![0]!,0.1526315789473684334817731155952287,2e-14);
    close(Number(x.se),0.1025978352085154094270149251536231,2e-14);
    close(Number(x.zval),1.487668610523473561276927739155587,2e-14);
    close(Number(x.pval),0.136838309563315071149411724393655,2e-13);
    close(x.QE,5.361842105263158458521971797725484,2e-14);
    close(x.I2,44.04907975460123287697315055048284,2e-13);
    close(x.H2,1.787280701754386152840657265908495,2e-13);
  });

  it("is invariant under effect and variance unit changes by 2^+/-500",()=>{
    const base=rma(y,v,{method:"FE"});
    for(const k of [-500,500]){
      const s=2**k;
      const x=rma(y.map(z=>z*s),v.map(z=>z*s*s),{method:"FE"});
      close(x.beta.rows[0]![0]!/s,base.beta.rows[0]![0]!,3e-13);
      close(Number(x.se)/s,Number(base.se),3e-13);
      close(Number(x.zval),Number(base.zval),3e-13);
      close(Number(x.pval),Number(base.pval),3e-13);
      close(x.I2,base.I2,3e-13);
      close(x.H2,base.H2,3e-13);
    }
  });

  it("does not lose the fit when the inverse variances or their squares overflow",()=>{
    const x=rma([0.1,0.2,0.3],[1e-308,1e-308,1e-308],{method:"REML"});
    close(x.beta.rows[0]![0]!,0.2,2e-13);
    close(Number(x.se),Math.sqrt(0.01/3),2e-12);
    close(x.tau2,0.01,2e-12);
    expect(x.I2).toBe(100);
  });

  it("keeps the random-effects fit finite for 1e150 effects and subnormal sampling variances",()=>{
    const x=rma([-1e150,0,1e150],[5e-324,5e-324,5e-324],{method:"REML"});
    close(x.beta.rows[0]![0]!,0,0);
    close(Number(x.se)/1e150,1/Math.sqrt(3),2e-12);
    close(x.tau2/1e300,1,2e-12);
    expect(x.I2).toBe(100);
    expect(x.QE).toBe(Infinity); // the mathematical Q is about 2e600, outside binary64.
    expect(x.H2).toBe(Infinity); // the mathematical H^2 is also outside binary64.
  });

  it("handles one, two and 3000 identical studies with tau^2 on its zero boundary",()=>{
    const one=rma([0.1],[0.04],{method:"REML"});
    close(one.beta.rows[0]![0]!,0.1,2e-14);
    close(Number(one.se),0.2,2e-14);
    expect(one.tau2).toBe(0);
    const two=rma([0.1,0.1],[0.04,0.04],{method:"REML"});
    expect(two.tau2).toBe(0);
    expect(two.QE).toBe(0);
    const many=rma(Array(3000).fill(0.1),Array(3000).fill(0.04),{method:"REML"});
    expect(many.tau2).toBe(0);
    expect(many.QE).toBe(0);
    expect(many.I2).toBe(0);
    expect(many.H2).toBe(1);
  });

  it("evaluates very small and near-one two-sided p-values without upper-tail subtraction",()=>{
    const tiny=rma([37.06578788077213],[1],{method:"FE"});
    close(Number(tiny.pval),1.0000000000001075e-300,3e-13);
    const nearOne=rma([1.4e-16],[1],{method:"FE"});
    expect(Number(nearOne.pval)).toBe(0.9999999999999999);
  });

  it("drops a nearly collinear moderator and keeps QP/PL intervals, prediction and Egger inference finite",()=>{
    const near=rma([0.1,0.2,0.3,0.4,0.5],Array(5).fill(0.04),{
      mods:[[1,1],[2,2+1e-14],[3,3],[4,4-1e-14],[5,5]],
      method:"REML",
    });
    expect(near.beta.dim[0]).toBe(2);
    expect(near.warnings).toContain("Redundant predictors dropped from the model.");
    const fit=rma([-0.2,0.1,0.4,0.25,0.3],[0.04,0.05,0.03,0.06,0.04],{method:"REML"});
    const qp=confintRma(fit,{type:"QP"});
    const pl=confintRma(fit,{type:"PL"});
    const pred=predictRma(fit);
    const egger=regtest(fit);
    for(const [label,result] of [["QP lower",qp.random.rows[0]!["ci.lb"]],["QP upper",qp.random.rows[0]!["ci.ub"]],["PL lower",pl.random.rows[0]!["ci.lb"]],["PL upper",pl.random.rows[0]!["ci.ub"]],["prediction",Number(pred.pred)],["Egger p",Number(egger.pval)]] as const) {
      expect(Number.isFinite(result),label).toBe(true);
    }
  });
});

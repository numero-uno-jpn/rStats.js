import { describe, expect, it } from "vitest";
import { rmst2, survfit } from "../src/index.js";

function close(actual: number, expected: number, tolerance = 1e-13, message = "numeric comparison"): void {
  if (Number.isNaN(expected)) expect(Number.isNaN(actual), message).toBe(true);
  else if (!Number.isFinite(expected)) expect(actual, message).toBe(expected);
  else expect(Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-300), message).toBeLessThanOrEqual(tolerance);
}

describe("survfit continued", () => {
  it("returns Nelson-Aalen, Greenwood, and the restricted mean", () => {
    const r = survfit([1,2,2,2,3,4,4,5,6,6,7,8], [1,1,1,0,1,1,0,1,1,1,0,1]);
    close(r.cumhaz[0]!, 1/12);
    close(r.stdChaz[0]!, 1/12);
    close(r.surv[5]!, 0.225);
    close(r.rmean[0]!, 4.7854166666666664);
    close(r.seRmean[0]!, 0.70500132875991139);
    expect(r.table.colNames).toEqual(["records","n.max","n.start","events","rmean","se(rmean)","median","0.95LCL","0.95UCL"]);
  });

  it("keeps restricted-mean variance scaling finite near Number.MAX_VALUE", () => {
    const max=Number.MAX_VALUE;
    const r=survfit([max/2,max],[1,0]);
    close(r.rmean[0]!,max*0.75);
    close(r.seRmean[0]!,max*Math.sqrt(1/32));
  });

  it("uses the Fleming-Harrington tied-event increment", () => {
    const r = survfit([2,2,2], [1,1,1], { ctype: 2, stype: 2 });
    close(r.cumhaz[0]!, 1/3 + 1/2 + 1);
    close(r.stdChaz[0]!, Math.sqrt(1/9 + 1/4 + 1));
    close(r.surv[0]!, Math.exp(-(1/3 + 1/2 + 1)));
  });

  it("keeps integer case weights as weighted counts", () => {
    const r = survfit([1,2,2,2,3,4,4,5,6,6,7,8], [1,1,1,0,1,1,0,1,1,1,0,1],
      { weights: [2,1,3,1,1,2,1,1,1,2,1,1] });
    close(r.nRisk[0]!, 17);
    close(r.nEvent[1]!, 4);
    expect(r.counts?.nRisk[0]).toBe(12);
    expect(r.records[0]).toBe(12);
  });

  it("rejects fractional, unsafe, and overflowing case weights", () => {
    expect(() => survfit([1,2], [1,0], { weights: [0.5,1] })).toThrow(RangeError);
    expect(() => survfit([1,2], [1,0], { weights: [Number.MAX_SAFE_INTEGER+1,1] })).toThrow(RangeError);
    expect(() => survfit([1,2], [1,0], { weights: [Number.MAX_SAFE_INTEGER,1] })).toThrow("total case weight per group must be a safe integer");
    expect(() => survfit([1,2], [1,0], { weights: [0,0] })).toThrow("no positive weight");
  });

  it("uses the standard error of survival for robust stype 2 limits", () => {
    const time=[1,2,2,2,3,4,4,5,6,6,7,8], status=[1,1,1,0,1,1,0,1,1,1,0,1];
    const weights=[2,1,3,1,1,2,1,1,1,2,1,1];
    const na=survfit(time,status,{weights,stype:2,robust:true});
    close(na.surv[1]!,0.6809177724048942);
    close(na.stdChaz[1]!,0.19375054046372117);
    close(na.stdErr[1]!,0.13192818641480134);
    expect(na.logse).toBe(false);
    close(na.lower[1]!,0.4657725720570077);
    close(na.upper[1]!,0.9954407807424424);
    const fh=survfit(time,status,{weights,ctype:2,stype:2,robust:true});
    close(fh.surv[1]!,0.6670925106862218);
    close(fh.stdChaz[1]!,0.21750111880854076);
    close(fh.stdErr[1]!,0.14509336742305168);
    close(fh.lower[1]!,0.43556079012369725);
    close(fh.upper[1]!,1);
    const fhRobust=survfit(time,status,{weights,ctype:2,robust:true});
    close(fhRobust.stdChaz[0]!,0.10942137232416538);
    close(fhRobust.stdErr[0]!,0.09654826969779298);
    close(fhRobust.lower[1]!,0.46960415767315605);
    close(fhRobust.upper[1]!,0.89157030291599482);
    expect(fhRobust.logse).toBe(true);
  });

  it("omits confidence columns for confType none", () => {
    const r = survfit([1,2,3], [1,0,1], { confType: "none" });
    expect(r.lower.every(Number.isNaN)).toBe(true);
    expect(r.table.colNames).toEqual(["records","n.max","n.start","events","rmean","se(rmean)","median"]);
  });

  it("accepts an unambiguous confidence-type prefix", () => {
    const plain=survfit([1,2,3], [1,0,1], { confType: "p" });
    const full=survfit([1,2,3], [1,0,1], { confType: "plain" });
    expect(plain.lower).toEqual(full.lower);
    expect(plain.upper).toEqual(full.upper);
    expect(survfit([1,2,3],[1,0,1],{confType:"log-"}).lower)
      .toEqual(survfit([1,2,3],[1,0,1],{confType:"log-log"}).lower);
    expect(survfit([1,2,3],[1,0,1],{confType:"logi"}).lower)
      .toEqual(survfit([1,2,3],[1,0,1],{confType:"logit"}).lower);
  });
});

describe("survfit input validation", () => {
  const time=[1,2,3,4],status=[1,0,1,0];
  it("distinguishes type, range, and unknown-option errors", () => {
    expect(()=>survfit(time,status,{ctype:"1" as any})).toThrow(TypeError);
    expect(()=>survfit(time,status,{ctype:3 as any})).toThrow(RangeError);
    expect(()=>survfit(time,status,{stype:"2" as any})).toThrow(TypeError);
    expect(()=>survfit(time,status,{stype:0 as any})).toThrow(RangeError);
    expect(()=>survfit(time,status,{confType:1 as any})).toThrow(TypeError);
    expect(()=>survfit(time,status,{confType:"lo" as any})).toThrow(RangeError);
    expect(()=>survfit(time,status,{confInt:1})).toThrow(RangeError);
    expect(()=>survfit(time,status,{confInt:"0.95" as any})).toThrow(TypeError);
    expect(()=>survfit(time,status,{robust:1 as any})).toThrow(TypeError);
    expect(()=>survfit(time,status,{rmean:"median" as any})).toThrow(RangeError);
    expect(()=>survfit(time,status,{rmean:0})).toThrow(RangeError);
    expect(()=>survfit(time,status,{unknownOption:true} as any)).toThrow(RangeError);
  });

  it("validates integer case weights and observation arrays", () => {
    expect(()=>survfit(time,status,{weights:"1,1,1,1" as any})).toThrow(TypeError);
    expect(()=>survfit(time,status,{weights:[1,0.5,1,1]})).toThrow(RangeError);
    expect(()=>survfit(time,status,{weights:[1,-1,1,1]})).toThrow(RangeError);
    expect(()=>survfit(time,status,{weights:[1,Infinity,1,1]})).toThrow(RangeError);
    expect(()=>survfit(time,status,{weights:[1,1]})).toThrow(RangeError);
    expect(()=>survfit(time,status,{weights:[1,"x",1,1] as any})).toThrow(TypeError);
    expect(()=>survfit(time,[1,0])).toThrow(RangeError);
    expect(()=>survfit(["1",2,3,4] as any,status)).toThrow(TypeError);
    expect(()=>survfit(time,["1",0,1,0] as any)).toThrow(TypeError);
  });
});

describe("rmst2", () => {
  const time = [1,2,3,4,5,6,1.5,2.5,3.5,4.5,7,8];
  const status = [1,0,1,1,0,1,1,1,0,1,1,0];
  const arm = [1,1,1,1,1,1,0,0,0,0,0,0];

  it("matches the independently integrated unadjusted example", () => {
    const r = rmst2(time, status, arm);
    expect(r.tau,"independent example tau").toBe(8);
    expect(r.tauDefault,"independent example tauDefault").toBe(true);
    close(r.arm1!.rmst.estimate, 4.125,1e-13,"independent example arm1 RMST");
    close(r.arm1!.rmst.se, 0.7864410870073697,1e-13,"independent example arm1 RMST SE");
    close(r.arm0!.rmst.estimate, 5,1e-13,"independent example arm0 RMST");
    close(r.arm0!.rmst.se, 1.0415740699584821,1e-13,"independent example arm0 RMST SE");
    close(r.difference.estimate, -0.875,1e-13,"independent example difference");
    close(r.difference.pValue, 0.50258311547786794,1e-13,"independent example difference p-value");
    close(r.ratio.estimate, 0.825,1e-13,"independent example RMST ratio");
    close(r.rmtlRatio.estimate, 1.2916666666666665,1e-13,"independent example RMTL ratio");
  });

  it("handles arm-specific 1/2 and 0/1 status coding", () => {
    const mixedStatus=[2,0,1,1,0,1,1,1,0,1,1,0];
    const r=rmst2(time,mixedStatus,arm);
    expect(r.tau).toBe(8);
    expect(r.warnings).toEqual(["Invalid status value, converted to NA"]);
    close(r.arm1!.rmst.estimate,6.25);
    close(r.arm0!.rmst.estimate,5);
  });

  it("ignores an additional arm level only when its observations are after tau", () => {
    const extraArm=arm.slice();
    extraArm[11]=2;
    const r=rmst2(time,status,extraArm);
    expect(r.tau).toBe(7);
    close(r.arm1!.rmst.estimate,4.125);
    close(r.arm0!.rmst.estimate,4.25);
    const withinTau=arm.slice();
    withinTau[0]=2;
    expect(()=>rmst2(time,status,withinTau)).toThrow(RangeError);
    const missingArm=arm.slice();
    missingArm[2]=NaN;
    expect(()=>rmst2(time,status,missingArm)).toThrow();
  });

  it("accepts an explicit confidence level and restriction time", () => {
    const r = rmst2(time, status, arm, { tau: 5, confLevel: 0.9 });
    expect(r.tau).toBe(5);
    expect(r.tauDefault).toBe(false);
    expect(rmst2(time,status,arm,{tau:8}).tauDefault).toBe(false);
    close(r.arm1!.rmst.estimate, 3.7083333333333335);
    close(r.arm0!.rmst.estimate, 3.8888888888888893);
  });

  it("rejects a restriction time outside the defined domain", () => {
    expect(() => rmst2(time, status, arm, { tau: 0 })).toThrow(RangeError);
    expect(() => rmst2(time, status, arm, { tau: 9 })).toThrow(RangeError);
  });

  it("keeps RMST and its variance finite near Number.MAX_VALUE", () => {
    const max=Number.MAX_VALUE;
    const r=rmst2([max/2,max,max/2,max],[1,0,1,0],[1,1,0,0]);
    expect(r.tau,"Number.MAX_VALUE tau").toBe(max);
    close(r.arm1!.rmst.estimate,max*0.75,1e-13,"Number.MAX_VALUE arm1 RMST");
    close(r.arm0!.rmst.estimate,max*0.75,1e-13,"Number.MAX_VALUE arm0 RMST");
    close(r.arm1!.rmst.se,max*Math.sqrt(1/32),1e-13,"Number.MAX_VALUE arm1 RMST SE");
    close(r.arm0!.rmst.se,max*Math.sqrt(1/32),1e-13,"Number.MAX_VALUE arm0 RMST SE");
  });

  it("computes a tiny positive RMTL directly without subtractive cancellation", () => {
    const t=1-Number.EPSILON/2;
    const r=rmst2([t,1,0.5,1],[1,0,1,0],[1,1,0,0],{tau:1});
    const expected=(1-t)/2;
    expect(expected).toBeGreaterThan(0);
    expect(r.arm1!.rmtl.estimate,"tiny RMTL arm1 estimate").toBe(expected);
    expect(r.arm0!.rmtl.estimate,"tiny RMTL arm0 estimate").toBe(0.25);
    close(r.rmtlRatio.estimate,expected/0.25);
  });

  it("validates tau, confidence, arms, covariates, and option names", () => {
    const boolArm=[true,true,true,true,true,true,false,false,false,false,false,false];
    const invalidArm=[1,2,1,1,1,1,0,0,0,0,0,0];
    const oneArm=new Array(12).fill(1);
    const negativeTimes=time.slice();negativeTimes[0]=-1;
    const validCovariates=Array.from({length:time.length},(_,i)=>i+1);
    const raggedCovariates=validCovariates.map(v=>[v]);raggedCovariates[1]=[1,2];
    const nonNumericCovariates=validCovariates.slice() as any[];
    nonNumericCovariates[1]="x";
    const infiniteCovariates=validCovariates.slice();infiniteCovariates[1]=Infinity;
    expect(()=>rmst2(time,status,arm,{tau:"2" as any})).toThrow(TypeError);
    expect(()=>rmst2(time,status,arm,{tau:0})).toThrow(RangeError);
    expect(()=>rmst2(time,status,arm,{tau:0.5})).toThrow(RangeError);
    expect(()=>rmst2(time,status,arm,{tau:9})).toThrow(RangeError);
    expect(()=>rmst2(time,status,arm,{confLevel:1})).toThrow(RangeError);
    expect(()=>rmst2(time,status,arm,{confLevel:"0.95" as any})).toThrow(TypeError);
    expect(()=>rmst2(time,status,arm,{unknownOption:true} as any)).toThrow(RangeError);
    expect(()=>rmst2(time,status,invalidArm)).toThrow(RangeError);
    expect(()=>rmst2(time,status,boolArm)).not.toThrow();
    expect(()=>rmst2(time,status,arm,{covariates:[1,2]})).toThrow(RangeError);
    expect(()=>rmst2(time,status,arm,{covariates:raggedCovariates})).toThrow(RangeError);
    expect(()=>rmst2(time,status,arm,{covariates:nonNumericCovariates})).toThrow(TypeError);
    expect(()=>rmst2(time,status,arm,{covariates:infiniteCovariates})).toThrow(RangeError);
    expect(()=>rmst2(time,status,arm,{covariates:validCovariates,covariateNames:["x","y"]})).toThrow(RangeError);
    expect(()=>rmst2(time,status,arm,{covariates:validCovariates,covariateNames:[1] as any})).toThrow(TypeError);
    expect(()=>rmst2(time,status,arm,{covariates:validCovariates,covariateNames:"x" as any})).toThrow(TypeError);
    expect(()=>rmst2(time,status,arm,{covariates:validCovariates,alpha:0.05} as any)).toThrow(RangeError);
    expect(()=>rmst2(time,status,oneArm)).toThrow(Error);
    expect(()=>rmst2(negativeTimes,status,arm)).toThrow(Error);
    expect(()=>rmst2(time.slice(1),status,arm)).toThrow(RangeError);
    expect(()=>rmst2(time,status.slice(1),arm)).toThrow(RangeError);
    expect(()=>rmst2(time,status,arm.slice(1))).toThrow(RangeError);
    expect(()=>rmst2(time.map(String) as any,status,arm)).toThrow(TypeError);
    expect(()=>rmst2(time,status.map(String) as any,arm)).toThrow(TypeError);
    expect(()=>rmst2(time,status,arm.map(String) as any)).toThrow(TypeError);
  });

  it("returns the boundary RMTL ratios when one arm has zero RMTL", () => {
    const zero=[1,2,3,4,5,6,1.5,2.5,3.5,4.5,7,8];
    const zeroStatus=[0,0,0,0,0,0,1,1,0,1,1,0];
    const zeroArm=[1,1,1,1,1,1,0,0,0,0,0,0];
    const r0=rmst2(zero,zeroStatus,zeroArm,{tau:5});
    // 80-digit evaluation of the RMST/Greenwood formula gives this lower limit.
    // The R fixture value (0.0033509029284710667) is about 2.95e-14 relatively
    // from that value, so the high-precision formula is the accuracy reference here.
    // The limit is d - z se with d and z se near 1.1: its error is measured against |d| + z se (2.2), not against the
    // limit itself (d = 5 - 3.888... is already 4e-16 from 10/9)
    const scale=Math.abs(r0.difference.estimate)+Math.abs(r0.difference.confInt[1]-r0.difference.estimate);
    expect(Math.abs(r0.difference.confInt[0]-0.0033509029284711655)/scale,"high-precision RMST difference lower limit").toBeLessThanOrEqual(1e-15);
    expect(r0.rmtlRatio.estimate,"zero numerator RMTL ratio").toBe(0);
    expect(r0.rmtlRatio.confInt,"zero numerator RMTL ratio CI").toEqual([NaN,NaN]);
    expect(r0.rmtlRatio.pValue,"zero numerator RMTL ratio p-value").toBeNaN();

    const infiniteTime=[1,2,2,2,3,3,4];
    const infiniteStatus=[1,1,0,1,1,0,1];
    const infiniteArm=[1,1,1,0,0,0,0];
    const rInf=rmst2(infiniteTime,infiniteStatus,infiniteArm);
    expect(rInf.rmtlRatio.estimate,"zero denominator RMTL ratio").toBe(Infinity);
    expect(rInf.rmtlRatio.confInt,"zero denominator RMTL ratio CI").toEqual([NaN,NaN]);
    expect(rInf.rmtlRatio.pValue,"zero denominator RMTL ratio p-value").toBeNaN();
  });

  it("returns NaN for an adjusted RMST ratio when an arm has zero RMST", () => {
    const t=[0,0,0,1,2,3],d=[1,1,1,1,0,1],a=[1,1,1,0,0,0],x=[0,1,2,1,0,2];
    const r=rmst2(t,d,a,{tau:3,covariates:x});
    expect(Number.isFinite(r.adjusted!.difference.estimate)).toBe(true);
    expect(r.adjusted!.ratio.estimate).toBeNaN();
    expect(r.coefficients!.ratio.estimate.every(Number.isNaN)).toBe(true);
    expect(Number.isFinite(r.adjusted!.rmtlRatio.estimate)).toBe(true);
  });

  it("returns NaN for an adjusted RMTL ratio when an arm has zero RMTL", () => {
    const t=[2,3,4,2,3,4],d=[1,0,1,1,0,1],a=[1,1,1,0,0,0],x=[0,1,2,1,0,2];
    const r=rmst2(t,d,a,{tau:2,covariates:x});
    expect(r.arm1).toBeUndefined();
    expect(Number.isFinite(r.adjusted!.difference.estimate)).toBe(true);
    expect(Number.isFinite(r.adjusted!.ratio.estimate)).toBe(true);
    expect(r.adjusted!.rmtlRatio.estimate).toBeNaN();
    expect(r.adjusted!.rmtlRatio.confInt.every(Number.isNaN)).toBe(true);
    expect(r.adjusted!.rmtlRatio.pValue).toBeNaN();
    expect(r.coefficients!.rmtlRatio.estimate.every(Number.isNaN)).toBe(true);
  });

  it("drops a row with a missing covariate", () => {
    const t=[1,2,3,4,5,6,1.5,2.5,3.5,4.5,7,8];
    const d=[1,0,1,1,0,1,1,1,0,1,1,0];
    const a=[1,1,1,1,1,1,0,0,0,0,0,0];
    const x=[0.2,0.1,NaN,-0.3,0.4,0.5,-0.2,0.3,0.6,-0.1,0.8,0.9];
    const withMissing=rmst2(t,d,a,{covariates:x});
    const keep=t.map((_,i)=>i).filter(i=>i!==2);
    const withoutRow=rmst2(keep.map(i=>t[i]!),keep.map(i=>d[i]!),keep.map(i=>a[i]!),{covariates:keep.map(i=>x[i]!)});
    close(withMissing.adjusted!.difference.estimate,withoutRow.adjusted!.difference.estimate);
    close(withMissing.adjusted!.ratio.estimate,withoutRow.adjusted!.ratio.estimate);

    const t2=[1,2,3,4,1,2,3,4,5],d2=[1,0,1,0,1,1,0,1,0],a2=[1,1,1,1,0,0,0,0,1];
    const x2=[0,1,0.5,2,1,0,2,1,NaN];
    const withMissingLast=rmst2(t2,d2,a2,{covariates:x2});
    const complete=rmst2(t2.slice(0,8),d2.slice(0,8),a2.slice(0,8),{covariates:x2.slice(0,8)});
    expect(withMissingLast.tau).toBe(4);
    expect(withMissingLast).toEqual(complete);
  });
});

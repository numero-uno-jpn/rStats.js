// Sample-size and power calculations: epiR parallel designs, exact McNemar power, Freedman/Schoenfeld and Simon designs.
// Written for rStats.js from the published formulae and public package documentation (no R or GPL package source ported).

import { pnorm, qnorm } from "../distributions/normal.js";
import { dbinom1, pbinom1 } from "../distributions/binomial.js";
import { reported } from "../internal/warnings.js";
import { checkOptions } from "../internal/checkOptions.js";

const EPI_KEYS = ["n", "power", "r", "type", "nfractional", "alpha", "sidedTest"] as const;
const SURVIVAL_KEYS = ["alpha"] as const;
const MCNEMAR_KEYS = ["sigLevel", "alternative", "strict", "nullOddsRatio", "errbound", "tsmethod"] as const;
const SIMON_KEYS = ["nmax"] as const;
const DEFAULT_ALPHA = 0.05;
const z = (p: number): number => qnorm(p) as number;
const phi = (x: number): number => pnorm(x) as number;
const finite = (x: number): boolean => Number.isFinite(x);
const prob = (x: number): boolean => finite(x) && x >= 0 && x <= 1;
const positive = (x: number): boolean => finite(x) && x > 0;

function checkNumber(x: number, name: string, test: (v: number) => boolean, message: string): void {
  if (typeof x !== "number") throw new TypeError(`'${name}' must be numeric`);
  if (!test(x)) throw new RangeError(message);
}
function checkAlpha(alpha: number): void {
  checkNumber(alpha, "alpha", prob, "'alpha' must be a probability in [0, 1]");
}
function splitN(n: number, r: number): [number, number] {
  return [n * r / (1 + r), n / (1 + r)];
}
function normalPower(effect: number, se: number, critical: number): number {
  return phi(effect / se - critical);
}

export interface EpiOptions {
  /** Total sample size; null/omitted when solving for sample size. */
  n?: number | null;
  /** Target power; null/omitted when solving for power. */
  power?: number | null;
  /** Treatment/control allocation ratio. Default 1. */
  r?: number;
  /** Equivalence or equality. Default "equivalence". */
  type?: "equivalence" | "equality" | (string & {});
  /** Round each group size up separately. Default false. */
  nfractional?: boolean;
  /** Significance level. Default 0.05. */
  alpha?: number;
  /** Number of tails for superiority: 1 or 2. Default 1. */
  sidedTest?: 1 | 2;
}
export interface EpiResult {
  nTotal: number;
  nTreat: number;
  nControl: number;
  nTotalExact: number;
  nTreatExact: number;
  nControlExact: number;
  power: number;
  delta?: number;
  warnings: string[];
}
type EpiKind = "equivalence" | "noninferiority" | "superiority";
type EpiMeasure = "binary" | "continuous";

function epi(
  kind: EpiKind,
  measure: EpiMeasure,
  treat: number,
  control: number,
  sigma: number | undefined,
  delta: number | undefined,
  options: EpiOptions = {},
): EpiResult {
  checkOptions(options, EPI_KEYS, `epi${kind}${measure}`);
  const { n, power } = options;
  const r = options.r ?? 1;
  const alpha = options.alpha ?? DEFAULT_ALPHA;
  const nfractional = options.nfractional ?? false;
  const type = kind === "equivalence" ? (options.type ?? "equivalence") : "equivalence";
  const sides = options.sidedTest ?? 1;
  if (kind === "equivalence" && type !== "equivalence" && type !== "equality") {
    throw new RangeError("'type' should be one of “equivalence”, “equality”");
  }
  checkNumber(treat, "treat", finite, "'treat' must be finite");
  checkNumber(control, "control", finite, "'control' must be finite");
  if (measure === "binary") {
    checkNumber(treat, "treat", prob, "'treat' must be a probability in [0, 1]");
    checkNumber(control, "control", prob, "'control' must be a probability in [0, 1]");
  } else {
    checkNumber(sigma!, "sigma", positive, "'sigma' must be positive and finite");
  }
  checkNumber(r, "r", positive, "'r' must be positive and finite");
  checkAlpha(alpha);
  if (kind !== "equivalence" || type !== "equality") checkNumber(delta!, "delta", (v) => finite(v) && v >= 0, "'delta' must be nonnegative and finite");
  if (kind === "superiority" && sides !== 1 && sides !== 2) throw new RangeError("'sidedTest' must be 1 or 2");
  if (typeof nfractional !== "boolean") throw new TypeError("'nfractional' must be logical");
  if ((n === null || n === undefined) === (power === null || power === undefined)) {
    throw new RangeError("exactly one of 'n' and 'power' must be null or omitted");
  }
  if (power !== null && power !== undefined) {
    checkNumber(power, "power", (v) => prob(v) && v > 0 && v < 1, "'power' must be strictly between 0 and 1");
  }
  if (n !== null && n !== undefined) checkNumber(n, "n", (v) => finite(v) && v > 0, "'n' must be positive and finite");
  const D = treat - control;
  const vt = measure === "binary" ? treat * (1 - treat) : sigma! * sigma!;
  const vc = measure === "binary" ? control * (1 - control) : sigma! * sigma!;
  const equality = kind === "equivalence" && type === "equality";
  const E = kind === "noninferiority" ? D + delta! : kind === "superiority" ? D - delta! : equality ? D : delta! - Math.abs(D);
  const critical = kind === "superiority" ? z(1 - alpha / sides) : equality ? z(1 - alpha / 2) : z(1 - alpha);
  const zPower = equality || kind !== "equivalence" ? z(power ?? 0.8) : z(1 - (1 - (power ?? 0.8)) / 2);
  let nTreat: number;
  let nControl: number;
  let actualPower: number;
  if (n === null || n === undefined) {
    if (E === 0) {
      nTreat = Infinity;
      nControl = Infinity;
    } else {
      nControl = ((critical + zPower) ** 2 * (vt / r + vc)) / (E * E);
      nTreat = r * nControl;
    }
    actualPower = power!;
  } else {
    [nTreat, nControl] = splitN(n, r);
    const se = Math.sqrt(vt / nTreat + vc / nControl);
    if (kind === "equivalence" && !equality) {
      // User-selected TOST probability: the intersection of the two one-sided rejection events.
      actualPower = Math.max(0, phi((delta! - D) / se - z(1 - alpha)) + phi((delta! + D) / se - z(1 - alpha)) - 1);
    } else if (equality) {
      actualPower = phi(Math.abs(D) / se - z(1 - alpha / 2)) + phi(-Math.abs(D) / se - z(1 - alpha / 2));
    } else if (kind === "noninferiority") {
      actualPower = normalPower(D + delta!, se, z(1 - alpha));
    } else {
      const e = (D - delta!) / se;
      actualPower = sides === 1 ? phi(e - critical) : phi(e - critical) + phi(-e - critical);
    }
  }
  const nTreatExact = nTreat;
  const nControlExact = nControl;
  if (!nfractional) {
    nTreat = Math.ceil(nTreat);
    nControl = Math.ceil(nControl);
  }
  const result: EpiResult = {
    nTotal: nTreat + nControl,
    nTreat,
    nControl,
    nTotalExact: nTreatExact + nControlExact,
    nTreatExact,
    nControlExact,
    power: actualPower,
    ...(delta === undefined ? {} : { delta }),
    warnings: [],
  };
  return result;
}

/** Equivalence/equality sample size or power for two proportions. Equivalent to `epiR::epi.ssequb()`. */
export function epiSsequb(treat: number, control: number, options: EpiOptions = {}): EpiResult {
  return reported("epiSsequb", epi("equivalence", "binary", treat, control, undefined, options.type === "equality" ? undefined : 0, options));
}
/** Equivalence/equality sample size or power for two means. Equivalent to `epiR::epi.ssequc()`. */
export function epiSsequc(treat: number, control: number, sigma: number, options: EpiOptions & { delta?: number } = {}): EpiResult {
  const { delta, ...rest } = options;
  const opts = { ...rest, delta };
  const out = epi("equivalence", "continuous", treat, control, sigma, delta, opts as EpiOptions);
  return reported("epiSsequc", out);
}
/** Non-inferiority sample size or power for two proportions. Equivalent to `epiR::epi.ssninfb()`. */
export function epiSsninfb(treat: number, control: number, delta: number, options: EpiOptions = {}): EpiResult {
  return reported("epiSsninfb", epi("noninferiority", "binary", treat, control, undefined, delta, options));
}
/** Non-inferiority sample size or power for two means. Equivalent to `epiR::epi.ssninfc()`. */
export function epiSsninfc(treat: number, control: number, sigma: number, delta: number, options: EpiOptions = {}): EpiResult {
  return reported("epiSsninfc", epi("noninferiority", "continuous", treat, control, sigma, delta, options));
}
/** Superiority sample size or power for two proportions. Equivalent to `epiR::epi.sssupb()`. */
export function epiSssupb(treat: number, control: number, delta: number, options: EpiOptions = {}): EpiResult {
  return reported("epiSssupb", epi("superiority", "binary", treat, control, undefined, delta, options));
}
/** Superiority sample size or power for two means. Equivalent to `epiR::epi.sssupc()`. */
export function epiSssupc(treat: number, control: number, sigma: number, delta: number, options: EpiOptions = {}): EpiResult {
  return reported("epiSssupc", epi("superiority", "continuous", treat, control, sigma, delta, options));
}

export interface PowerPaired2x2Options {
  sigLevel?: number;
  alternative?: "two.sided" | "one.sided" | (string & {});
  strict?: boolean;
  nullOddsRatio?: number;
  errbound?: number;
  tsmethod?: "central" | "minlike" | "blaker" | (string & {});
}
export interface PowerPaired2x2Result {
  power: number;
  npairs: number;
  pb: number;
  pc: number;
  sigLevel: number;
  alternative: "two.sided" | "one.sided";
  nullOddsRatio: number;
  note: string;
  method: string;
  warnings: string[];
}
function binomialMasses(n: number, p: number): number[] {
  const out = new Array<number>(n + 1).fill(0);
  if (p === 0) { out[0] = 1; return out; }
  if (p === 1) { out[n] = 1; return out; }
  const mode = Math.floor((n + 1) * p);
  out[mode] = Math.exp((n * Math.log1p(-p)) + mode * Math.log(p / (1 - p)) +
    Array.from({ length: mode }, (_, i) => Math.log(n - i) - Math.log(i + 1)).reduce((a, b) => a + b, 0));
  for (let k = mode; k > 0; k--) out[k - 1] = out[k]! * (k / (n - k + 1)) * ((1 - p) / p);
  for (let k = mode; k < n; k++) out[k + 1] = out[k]! * ((n - k) / (k + 1)) * (p / (1 - p));
  return out;
}
/** Exact conditional-binomial enumeration of the paired 2x2 rejection probability. */
export function powerPaired2x2(pb: number, pc: number, npairs: number, options: PowerPaired2x2Options = {}): PowerPaired2x2Result {
  checkOptions(options, MCNEMAR_KEYS, "powerPaired2x2");
  const sigLevel = options.sigLevel ?? DEFAULT_ALPHA;
  const alternative = options.alternative ?? "two.sided";
  const strict = options.strict ?? false;
  const nullOddsRatio = options.nullOddsRatio ?? 1;
  const errbound = options.errbound ?? 1e-6;
  const tsmethod = options.tsmethod ?? "central";
  checkNumber(pb, "pb", prob, "'pb' must be in [0, 1]");
  checkNumber(pc, "pc", prob, "'pc' must be in [0, 1]");
  checkNumber(npairs, "npairs", (v) => Number.isSafeInteger(v) && v >= 0 && v <= 100000, "'npairs' must be a nonnegative safe integer");
  checkAlpha(sigLevel);
  checkNumber(nullOddsRatio, "nullOddsRatio", positive, "'nullOddsRatio' must be positive and finite");
  checkNumber(errbound, "errbound", (v) => finite(v) && v >= 0, "'errbound' must be nonnegative and finite");
  if (pb + pc > 1) throw new RangeError("probabilities must be finite, non-negative and not all 0");
  if (alternative !== "two.sided" && alternative !== "one.sided") throw new RangeError("'alternative' should be one of “two.sided”, “one.sided”");
  if (!["central", "minlike", "blaker"].includes(tsmethod)) throw new RangeError("'tsmethod' should be one of “central”, “minlike”, “blaker”");
  const q = pb + pc;
  const pAlt = q === 0 ? 0.5 : pb / q;
  const pNull = nullOddsRatio / (1 + nullOddsRatio);
  const direction = pAlt >= pNull ? 1 : -1;
  const useBoth = alternative === "two.sided" && strict && tsmethod !== "blaker";
  const useOne = alternative === "one.sided";
  const massM = binomialMasses(npairs, q);
  let power = 0;
  for (let m = 0; m <= npairs; m++) {
    const wm = massM[m]!;
    if (wm === 0) continue;
    const alt = binomialMasses(m, pAlt);
    const nul = binomialMasses(m, pNull);
    let lower = 0;
    const lowerTail = new Array<number>(m + 1);
    for (let x = 0; x <= m; x++) { lower += nul[x]!; lowerTail[x] = lower; }
    for (let x = 0; x <= m; x++) {
      const lo = lowerTail[x]!;
      const hi = 1 - (x === 0 ? 0 : lowerTail[x - 1]!);
      let reject: boolean;
      if (useOne) reject = direction > 0 ? hi <= sigLevel : lo <= sigLevel;
      else if (useBoth) reject = (lo <= sigLevel / 2 || hi <= sigLevel / 2);
      else reject = direction > 0 ? hi <= sigLevel / 2 : lo <= sigLevel / 2;
      if (reject) power += wm * alt[x]!;
    }
  }
  const note = `errbound= ${errbound}${pb + pc === 1 ? "  no non-informative pairs: pa+pd=0" : ""}`;
  const method = "Power for McNemar's Exact Test" +
    (useBoth ? ", including power to reject in the wrong direction" : "") +
    (tsmethod === "central" && options.tsmethod !== undefined ? `, using (tsmethod=${tsmethod})` :
      tsmethod === "minlike" ? `, using (tsmethod=${tsmethod})` :
      tsmethod === "blaker" ? `, using (tsmethod=${tsmethod})` : "");
  return reported("powerPaired2x2", { power, npairs, pb, pc, sigLevel, alternative, nullOddsRatio, note, method, warnings: [] });
}

export interface SurvivalOptions { alpha?: number; }
/** Freedman clinical-trial sample size with equal or unequal allocation. Equivalent to `powerSurvEpi::ssizeCT()`. */
export interface SSizeCTResult { nE: number; nC: number; }
/** Freedman clinical-trial power. Equivalent to `powerSurvEpi::powerCT()`. */
export function powerCT(nE: number, nC: number, pE: number, pC: number, RR: number, options: SurvivalOptions = {}): number {
  checkOptions(options, SURVIVAL_KEYS, "powerCT");
  const alpha = options.alpha ?? DEFAULT_ALPHA; checkAlpha(alpha);
  for (const [v, name] of [[nE,"nE"],[nC,"nC"]] as const) checkNumber(v,name,positive,`'${name}' must be positive and finite`);
  for (const [v, name] of [[pE,"pE"],[pC,"pC"]] as const) checkNumber(v,name,prob,`'${name}' must be in [0, 1]`);
  checkNumber(RR,"RR",positive,"'RR' must be positive and finite");
  const k = nE / nC;
  const m = nE * pE + nC * pC;
  return phi(Math.sqrt(k * m) * Math.abs(RR - 1) / (k * RR + 1) - z(1 - alpha / 2));
}
/** Freedman clinical-trial sample size. Equivalent to `powerSurvEpi::ssizeCT()`. */
export function ssizeCT(power: number, k: number, pE: number, pC: number, RR: number, options: SurvivalOptions = {}): SSizeCTResult {
  checkOptions(options, SURVIVAL_KEYS, "ssizeCT");
  const alpha = options.alpha ?? DEFAULT_ALPHA; checkAlpha(alpha);
  checkNumber(power,"power",(v)=>prob(v)&&v>0&&v<1,"'power' must be strictly between 0 and 1");
  checkNumber(k,"k",positive,"'k' must be positive and finite");
  checkNumber(pE,"pE",prob,"'pE' must be in [0, 1]"); checkNumber(pC,"pC",prob,"'pC' must be in [0, 1]");
  checkNumber(RR,"RR",positive,"'RR' must be positive and finite");
  const zz = z(1-alpha/2)+z(power);
  const m = (1/k)*(((k*RR+1)/(RR-1))**2)*(zz*zz);
  const den = k*pE+pC;
  return { nE: Math.ceil(m*k/den), nC: Math.ceil(m/den) };
}
/** Schoenfeld/Latouche Cox-model power. Equivalent to `powerSurvEpi::powerEpi()`. */
export function powerEpi(n: number, theta: number, p: number, psi: number, rho2: number, options: SurvivalOptions = {}): number {
  checkOptions(options, SURVIVAL_KEYS, "powerEpi");
  const alpha=options.alpha??DEFAULT_ALPHA; checkAlpha(alpha);
  checkNumber(n,"n",positive,"'n' must be positive and finite"); checkNumber(theta,"theta",positive,"'theta' must be positive and finite");
  checkNumber(p,"p",prob,"'p' must be in [0, 1]"); checkNumber(psi,"psi",prob,"'psi' must be in [0, 1]");
  checkNumber(rho2,"rho2",prob,"'rho2' must be in [0, 1]");
  const info = n * Math.log(theta)**2 * p*(1-p)*psi*(1-rho2);
  return phi(Math.sqrt(info)-z(1-alpha/2));
}
/** Schoenfeld/Latouche total sample size. Equivalent to `powerSurvEpi::ssizeEpi()`. */
export function ssizeEpi(power: number, theta: number, p: number, psi: number, rho2: number, options: SurvivalOptions = {}): number {
  checkOptions(options, SURVIVAL_KEYS, "ssizeEpi");
  const alpha=options.alpha??DEFAULT_ALPHA; checkAlpha(alpha);
  checkNumber(power,"power",(v)=>prob(v)&&v>0&&v<1,"'power' must be strictly between 0 and 1");
  checkNumber(theta,"theta",positive,"'theta' must be positive and finite");
  checkNumber(p,"p",prob,"'p' must be in [0, 1]"); checkNumber(psi,"psi",prob,"'psi' must be in [0, 1]");
  checkNumber(rho2,"rho2",prob,"'rho2' must be in [0, 1]");
  const den = Math.log(theta)**2*p*(1-p)*psi*(1-rho2);
  return Math.ceil((z(1-alpha/2)+z(power))**2/den);
}
/** Schoenfeld/Latouche required event count. Equivalent to `powerSurvEpi::numDEpi()`. */
export function numDEpi(power: number, theta: number, p: number, rho2: number, options: SurvivalOptions = {}): number {
  checkOptions(options, SURVIVAL_KEYS, "numDEpi");
  const alpha=options.alpha??DEFAULT_ALPHA; checkAlpha(alpha);
  checkNumber(power,"power",(v)=>prob(v)&&v>0&&v<1,"'power' must be strictly between 0 and 1");
  checkNumber(theta,"theta",positive,"'theta' must be positive and finite");
  checkNumber(p,"p",prob,"'p' must be in [0, 1]"); checkNumber(rho2,"rho2",prob,"'rho2' must be in [0, 1]");
  const den = Math.log(theta)**2*p*(1-p)*(1-rho2);
  return Math.ceil((z(1-alpha/2)+z(power))**2/den);
}

export interface SimonRow { r1:number; n1:number; r:number; n:number; expectedN:number; pet:number; qLo:number; qHi:number; }
export interface SimonDesignResult { out: SimonRow[]; minimax: SimonRow; optimal: SimonRow; admissible: SimonRow[]; pu:number; pa:number; alpha:number; beta:number; nmax:number; warnings:string[]; }
function cdfBinom(k:number,n:number,p:number):number { return pbinom1(k,n,p,true,false); }
function pmfBinom(k:number,n:number,p:number):number { return dbinom1(k,n,p,false); }
function designProb(n1:number,n2:number,r1:number,r:number,p:number):[number,number] {
  let alpha=0,beta=0;
  for(let x=r1+1;x<=Math.min(n1,r);x++){
    const px=pmfBinom(x,n1,p);
    alpha += px*(1-cdfBinom(r-x,n2,p));
    beta += px*cdfBinom(r-x,n2,p);
  }
  return [alpha,beta];
}
/** Enumerates Simon's two-stage Phase II designs. Equivalent to `clinfun::ph2simon()`. */
export function ph2simon(pu:number,pa:number,ep1:number,ep2:number,options: {nmax?:number} = {}):SimonDesignResult {
  checkOptions(options,SIMON_KEYS,"ph2simon");
  const nmax=options.nmax??100;
  for(const [v,name] of [[pu,"pu"],[pa,"pa"],[ep1,"ep1"],[ep2,"ep2"]] as const) checkNumber(v,name,prob,`'${name}' must be in [0, 1]`);
  checkNumber(nmax,"nmax",(v)=>Number.isInteger(v)&&v>=2&&v<=1000,"nmax cannot exceed 1000");
  if(pa<=pu) throw new Error("No feasible solution found");
  const out:SimonRow[]=[];
  for(let n=2;n<=nmax;n++){
    let best:SimonRow|undefined;
    for(let n1=1;n1<n;n1++){
      const n2=n-n1;
      for(let r1=0;r1<n1;r1++){
        const pet=cdfBinom(r1,n1,pu);
        const en=n1+n2*(1-pet);
        let rFound=-1;
        for(let r=r1+1;r<n;r++){
          const [a,b]=designProb(n1,n2,r1,r,pu);
          if(a<=ep1){
            const [,bAlt]=designProb(n1,n2,r1,r,pa);
            if(bAlt<=ep2){rFound=r;break;}
          }
        }
        if(rFound>=0 && (best===undefined || en<best.expectedN-1e-12)){
          best={r1,n1,r:rFound,n,expectedN:en,pet,qLo:0,qHi:1};
        }
      }
    }
    if(best) out.push(best);
  }
  if(out.length===0) throw new Error(`No feasible solution found. Increase maximum sample size. Current nmax value = ${nmax}.`);
  const minimax=out[0]!;
  const optimal=out.reduce((a,b)=>b.expectedN<a.expectedN?b:a);
  const admissible=out.filter((r,i)=>!out.some((s,j)=>j!==i&&s.n<=r.n&&s.expectedN<=r.expectedN&&(s.n<r.n||s.expectedN<r.expectedN)));
  const warnings:string[]=[];
  if(optimal.n>=nmax-1) warnings.push(`Optimal sample size too close to nmax. Try increasing nmax (current value = ${nmax})`);
  return reported("ph2simon",{out,minimax,optimal,admissible,pu,pa,alpha:ep1,beta:ep2,nmax,warnings});
}

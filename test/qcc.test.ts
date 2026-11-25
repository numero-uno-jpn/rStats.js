import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { qcc, cusum, ewma, ewmaSmooth, type QccData, type QccOptions } from "../src/descriptive/qcc.js";
import {
  ocCurves, processCapability, mqcc, qccOverdispersionTest, paretoChart, qccGroups,
} from "../src/descriptive/qccTools.js";

// R fixture from oracle/qcc.R (npm run oracle -- qcc): qcc 2.7
const fx = JSON.parse(readFileSync(new URL("./fixtures/qcc.json", import.meta.url), "utf8")) as Record<string, any>;
const near = (a: number, b: number | null, tol = 1e-12): boolean =>
  b === null ? Number.isNaN(a) : Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const arr = (v: unknown): any[] => (v === null || v === undefined ? [] : Array.isArray(v) ? v : [v]);
const rows = (m: unknown): number[][] => (Array.isArray(m) && Array.isArray(m[0]) ? (m as number[][]) : arr(m).length ? [arr(m)] : []);
const mats = fx.data.mats as Record<string, (number | null)[][]>;
const vecs = fx.data.vecs as Record<string, number[]>;

function compare(bad: string[], key: string, ours: readonly number[], theirs: unknown, tol = 1e-12): void {
  const t = arr(theirs);
  if (ours.length !== t.length) { bad.push(`${key} length ${ours.length} ${t.length}`); return; }
  ours.forEach((v, i) => { if (!near(v, t[i], tol)) bad.push(`${key}[${i}] ${v} ${t[i]}`); });
}

function chartArgs(c: Record<string, any>): [QccData, QccOptions] {
  const d: QccData = mats[c.data] ?? vecs[c.data]!;
  const sizes = c.sizes ? vecs[c.sizes] : c.size;
  const o: QccOptions = { type: c.type };
  if (c.std) o.stdDev = c.std;
  if (c.stdnum !== undefined) o.stdDev = c.stdnum;
  if (c.center !== undefined) o.center = c.center;
  if (c.nsigmas !== undefined) o.nsigmas = c.nsigmas;
  if (c.conf !== undefined) o.confidenceLevel = c.conf;
  if (c.limits) o.limits = c.limits;
  if (c.runlen) o.runLength = c.runlen;
  if (c.split) {
    const k = c.split as number;
    const sl = (v: any) => (Array.isArray(v) ? v.slice(0, k) : v), rest = (v: any) => (Array.isArray(v) ? v.slice(k) : v);
    o.newdata = (d as any[]).slice(k);
    if (sizes !== undefined) { o.sizes = sl(sizes); o.newsizes = rest(sizes); }
    return [(d as any[]).slice(0, k) as QccData, o];
  }
  if (sizes !== undefined) o.sizes = sizes;
  return [d, o];
}

describe("qcc against qcc::qcc", () => {
  it("gives R's statistics, centers, standard deviations, limits and violations", () => {
    const bad: string[] = [];
    for (const c of fx.qcc as Record<string, any>[]) {
      const key = JSON.stringify({ ...c, result: undefined, warnings: undefined });
      const [d, o] = chartArgs(c);
      if (c.error) { expect(() => qcc(d, o), key).toThrow(c.error); continue; }
      const q = qcc(d, o), r = c.result;
      compare(bad, `${key} statistics`, q.statistics, r.statistics);
      compare(bad, `${key} center`, arr(q.center), r.center);
      compare(bad, `${key} sd`, arr(q.stdDev), r.std_dev === null ? [null] : r.std_dev);
      const L = rows(r.limits);
      // R's qtukey (the R chart's probability limits) stops its search early: up to 2.5e-7 here (qccbt118-log.md 19)
      const tol = c.type === "R" && c.conf ? 1e-6 : 1e-11;
      compare(bad, `${key} lcl`, q.limits.lcl, L.map((x) => x[0]), tol);
      compare(bad, `${key} ucl`, q.limits.ucl, L.map((x) => x[1]), tol);
      compare(bad, `${key} beyond`, q.violations.beyondLimits, arr(r.beyond).filter((v) => v !== null));
      compare(bad, `${key} runs`, q.violations.violatingRuns, r.runs);
      compare(bad, `${key} newstats`, q.newstatistics, r.newstats);
      if (JSON.stringify(q.warnings) !== JSON.stringify(arr(c.warnings))) bad.push(`${key} warnings ${q.warnings}`);
    }
    expect(bad).toEqual([]);
  });
  it("gives R's errors", () => {
    const e = fx.qcc_errors as Record<string, any>[];
    expect(() => qcc([[1, 2], [3, null], [2, 5]], { type: "xbar" })).toThrow(e[0]!.error);
    expect(() => qcc(mats.bal!, { type: "R", stdDev: "UWAVE-SD" })).toThrow(e[1]!.error);
    expect(() => qcc(mats.bal!, { type: "S", stdDev: "UWAVE-R" })).toThrow(e[2]!.error);
    expect(() => qcc(vecs.cnt!, { type: "c", sizes: vecs.usz! })).toThrow(e[3]!.error);
  });
});

describe("cusum, ewma and ewmaSmooth against qcc", () => {
  const dataOf = (c: any) => (mats[c.data] ?? vecs[c.data]) as any[];
  it("cusum", () => {
    const bad: string[] = [];
    for (const c of fx.cusum as Record<string, any>[]) {
      const d = dataOf(c);
      const o: Record<string, any> = {};
      if (c.h) o.decisionInterval = c.h;
      if (c.shift) o.seShift = c.shift;
      if (c.head !== undefined) o.headStart = c.head;
      if (c.std) o.stdDev = c.std;
      if (c.stdnum !== undefined) o.stdDev = c.stdnum;
      if (c.center !== undefined) o.center = c.center;
      if (c.error) { expect(() => cusum(d, o)).toThrow(c.error); continue; }
      const q = c.split ? cusum(d.slice(0, c.split), { ...o, newdata: d.slice(c.split) }) : cusum(d, o);
      const key = JSON.stringify({ ...c, result: undefined }), r = c.result;
      compare(bad, `${key} stats`, q.statistics, r.statistics);
      compare(bad, `${key} pos`, q.pos, r.pos, 1e-11);
      compare(bad, `${key} neg`, q.neg, r.neg, 1e-11);
      compare(bad, `${key} lower`, q.violations.lower, r.lower);
      compare(bad, `${key} upper`, q.violations.upper, r.upper);
    }
    expect(bad).toEqual([]);
  });
  it("ewma", () => {
    const bad: string[] = [];
    for (const c of fx.ewma as Record<string, any>[]) {
      const d = dataOf(c);
      const o: Record<string, any> = {};
      if (c.lambda !== undefined) o.lambda = c.lambda;
      if (c.nsigmas !== undefined) o.nsigmas = c.nsigmas;
      if (c.stdnum !== undefined) o.stdDev = c.stdnum;
      if (c.center !== undefined) o.center = c.center;
      const q = c.split ? ewma(d.slice(0, c.split), { ...o, newdata: d.slice(c.split) }) : ewma(d, o);
      const key = JSON.stringify({ ...c, result: undefined }), r = c.result;
      compare(bad, `${key} y`, q.y, r.y);
      compare(bad, `${key} sigma`, q.sigma, r.sigma);
      const L = rows(r.limits);
      compare(bad, `${key} lcl`, q.limits.lcl, L.map((x) => x[0]));
      compare(bad, `${key} ucl`, q.limits.ucl, L.map((x) => x[1]));
      compare(bad, `${key} violations`, q.violations, r.violations);
    }
    expect(bad).toEqual([]);
  });
  it("ewmaSmooth", () => {
    const e = fx.ewmaSmooth;
    for (const [r, o] of [[e.def, {}], [e.start, { lambda: 0.4, start: 0 }]] as const) {
      const s = ewmaSmooth(e.x, e.y, o);
      expect(s.x).toEqual(r.x);
      s.y.forEach((v, i) => expect(near(v, r.y[i])).toBe(true));
      expect(s.start).toBe(r.start);
    }
  });
});

describe("ocCurves against qcc::oc.curves", () => {
  const bal = mats.bal!;
  it("xbar, R and S", () => {
    const bad: string[] = [];
    // R's ptukey with df = Inf is accurate to about 1e-8 (qccbt118-log.md 19)
    const check = (key: string, m: { beta: number[][] }, r: any) => {
      const R = r.value as number[][];
      m.beta.forEach((row, i) => compare(bad, `${key}[${i}]`, row, R[i], key.startsWith("R") ? 1e-7 : 1e-10));
    };
    check("xbar", ocCurves(qcc(bal, { type: "xbar" })) as any, fx.oc.xbar);
    check("xbar2", ocCurves(qcc(bal, { type: "xbar" }), { n: [2, 7], c: [0, 0.5, 1.5], nsigmas: 2 }) as any, fx.oc.xbar2);
    check("xbarConf", ocCurves(qcc(bal, { type: "xbar", confidenceLevel: 0.99 }), { n: [5, 3], c: [0, 1] }) as any, fx.oc.xbar_conf);
    check("R", ocCurves(qcc(bal, { type: "R" })) as any, fx.oc.R);
    check("R2", ocCurves(qcc(bal, { type: "R" }), { n: [3, 5], c: [1, 1.5, 3] }) as any, fx.oc.R2);
    check("S", ocCurves(qcc(bal, { type: "S" })) as any, fx.oc.S);
    check("S2", ocCurves(qcc(bal, { type: "S" }), { n: [3, 5], c: [1, 1.5, 3] }) as any, fx.oc.S2);
    expect(bad).toEqual([]);
    const o = ocCurves(qcc(bal, { type: "xbar" })) as any;
    expect(o.n).toEqual([5, 1, 10, 15, 20]);
  });
  it("p, np, c, u", () => {
    const bad: string[] = [];
    const v = (q: any, r: any, key: string) => {
      const o = ocCurves(q) as any;
      compare(bad, key, o.beta, r.value, 1e-10);
      compare(bad, `${key} grid`, o.grid, r.names.map(Number));
      return o;
    };
    const op = v(qcc(vecs.Dc!, { type: "p", sizes: 50 }), fx.oc.p, "p");
    v(qcc(vecs.Dc!, { type: "np", sizes: 50 }), fx.oc.np, "np");
    const oc = v(qcc(vecs.cnt!, { type: "c" }), fx.oc.c, "c");
    v(qcc(vecs.cnt!, { type: "u", sizes: 2 }), fx.oc.u, "u");
    expect(bad).toEqual([]);
    expect(op.warnings).toEqual(arr(fx.oc.p_warning));
    expect(oc.warnings).toEqual(arr(fx.oc.c_warning));
    expect(() => ocCurves(qcc(vecs.x1!, { type: "xbar.one" }))).toThrow(fx.oc.xbar_one_error);
  });
});

describe("processCapability against qcc::process.capability", () => {
  it("gives R's indices, confidence limits and fractions", () => {
    const bad: string[] = [];
    const qx = qcc(mats.bal!, { type: "xbar" }), qo = qcc(vecs.x1!, { type: "xbar.one" });
    for (const c of fx.capability as Record<string, any>[]) {
      const q = c.chart === "xbar" ? qx : qo;
      const o: Record<string, any> = {};
      if (c.target !== undefined) o.target = c.target;
      if (c.stdnum !== undefined) o.stdDev = c.stdnum;
      if (c.nsigmas !== undefined) o.nsigmas = c.nsigmas;
      if (c.conf !== undefined) o.confidenceLevel = c.conf;
      const p = processCapability(q, c.spec.map((v: number | null) => v ?? NaN), o);
      const key = JSON.stringify(c.spec) + JSON.stringify(o), r = c.result;
      if (p.nobs !== r.nobs) bad.push(`${key} nobs`);
      compare(bad, `${key} target`, [p.target], [r.target]);
      const I = r.indices as (number | null)[][];
      compare(bad, `${key} value`, p.indices.value, I.map((x) => x[0]), 1e-11);
      compare(bad, `${key} lower`, p.indices.lower, I.map((x) => x[1]), 1e-11);
      compare(bad, `${key} upper`, p.indices.upper, I.map((x) => x[2]), 1e-11);
      compare(bad, `${key} exp`, p.exp, r.exp, 1e-11);
      compare(bad, `${key} obs`, p.obs, r.obs);
      if (JSON.stringify(p.warnings) !== JSON.stringify(arr(c.warnings))) bad.push(`${key} warnings ${p.warnings}`);
    }
    expect(bad).toEqual([]);
    expect(() => processCapability(qcc(mats.bal!, { type: "R" }), [4, 16])).toThrow(fx.capability_error);
  });
});

describe("mqcc against qcc::mqcc", () => {
  it("T2 and T2.single", () => {
    const m = fx.mqcc, bad: string[] = [];
    const X = m.data.X as number[][][], Xs = m.data.Xs as number[][];
    const chk = (key: string, q: any, r: any) => {
      compare(bad, `${key} stats`, q.statistics, r.statistics, 1e-10);
      compare(bad, `${key} center`, q.center, r.center);
      compare(bad, `${key} cov`, q.cov.flat(), (r.cov as number[][]).flat(), 1e-11);
      compare(bad, `${key} limits`, [q.limits.lcl, q.limits.ucl], r.limits, 1e-11);
      if (r.pred) compare(bad, `${key} pred`, [q.predLimits.lcl, q.predLimits.ucl], r.pred, 1e-11);
      if (!near(q.confidenceLevel, r.conf)) bad.push(`${key} conf`);
      compare(bad, `${key} beyond`, q.violations.beyondLimits, r.beyond);
      compare(bad, `${key} newstats`, q.newstatistics, r.newstats, 1e-10);
    };
    chk("T2", mqcc(X, { type: "T2", predLimits: true }), m.T2);
    chk("T2conf", mqcc(X, { type: "T2", confidenceLevel: 0.99 }), m.T2_conf);
    chk("single", mqcc(Xs, { type: "T2.single", predLimits: true }), m.single);
    chk("singleNew", mqcc(Xs.slice(0, 20), { type: "T2.single", newdata: Xs.slice(20), predLimits: true }), m.single_new);
    chk("singleGiven", mqcc(Xs.slice(0, 20), { type: "T2.single", center: [10, 25, 30], cov: [[1, 0, 0], [0, 4, 0], [0, 0, 9]] }), m.single_given);
    expect(bad).toEqual([]);
  });
});

describe("qccOverdispersionTest, paretoChart, qccGroups", () => {
  it("overdispersion", () => {
    const o = fx.overdispersion;
    const chk = (t: any, r: number[]) => {
      expect(near(t.ratio, r[0]!)).toBe(true);
      expect(near(t.statistic, r[1]!)).toBe(true);
      expect(Number(t.pValue.toPrecision(5))).toBe(r[2]); // R rounds the p-value to 5 significant digits
    };
    chk(qccOverdispersionTest(o.xb, { size: new Array(30).fill(50) }), o.binom);
    chk(qccOverdispersionTest(o.xpz), o.pois);
    chk(qccOverdispersionTest(o.xb, { size: o.szv }), o.binom_var);
    chk(qccOverdispersionTest(o.xb, { size: o.szv, type: "poisson" }), o.pois_typed);
  });
  it("pareto", () => {
    const p = fx.pareto;
    const a = paretoChart(p.data);
    expect(a.names).toEqual(p.rows);
    const cols = [a.frequency, a.cumFrequency, a.percentage, a.cumPercentage];
    cols.forEach((col, j) => col.forEach((v, i) => expect(near(v, p.value[i][j])).toBe(true)));
    const b = paretoChart([3, 1, 2]);
    expect(b.names).toEqual(p.rows2);
  });
  it("groups", () => {
    const g = qccGroups(fx.groups.data, fx.groups.sample);
    expect(g.names).toEqual(fx.groups.rows);
    expect(g.groups.map((r) => r.map((v) => (Number.isNaN(v) ? null : v)))).toEqual(fx.groups.value);
  });
});

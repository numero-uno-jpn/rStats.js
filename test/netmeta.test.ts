// netmeta's functions against R (test/fixtures/netmeta.json from oracle/netmeta.R; behaviour in
// oracle/tsmeta-behaviour.md "netmeta", experiments/tsmeta120-log.md items 71-74, 77, 101).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { decompDesign, discomb, netcomb, netconnection, netleague, netmeasures, netmeta, netposet, netrank, netsplit, pairwise, type NetmetaResult } from "../src/meta/netmeta.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/netmeta.json", import.meta.url), "utf8")) as Record<string, any>;
const num = (v: unknown): number => (v === null || v === "NA" ? NaN : Number(v));
const vec = (v: unknown): number[] => (Array.isArray(v) ? v.map(num) : [num(v)]);
const close = (a: readonly number[], e: readonly number[], tol = 1e-9): boolean =>
  a.length === e.length && a.every((x, i) => (Number.isNaN(x) && Number.isNaN(e[i]!)) || Math.abs(x - e[i]!) <= tol * Math.max(1, Math.abs(e[i]!)));
const fitOf = (d: any[], ref = "A"): NetmetaResult => netmeta(d.map((r) => num(r.TE)), d.map((r) => num(r.seTE)), d.map((r) => r.t1), d.map((r) => r.t2), d.map((r) => r.stud), { referenceGroup: ref });

describe("netmeta", () => {
  for (const [key, ref] of [["net1", "A"], ["net2", "A"]] as const) {
    it(`${key}: fit and P-scores`, () => {
      const fit = fitOf(fx[key].data, ref); const R = fx[key].fit; const bad: string[] = [];
      expect(fit.trts).toEqual(R.trts);
      for (const [f, e] of Object.entries(R as Record<string, any>)) {
        if (f === "trts" || f.startsWith("Pscore")) continue;
        const mine = (fit as any)[f];
        if (e && typeof e === "object" && !Array.isArray(e)) { if (!close(mine.values.flat(), (e.values as any[]).flat().map(num))) bad.push(f); }
        else if (!close(Array.isArray(mine) ? mine : [mine], vec(e))) bad.push(f);
      }
      expect(bad).toEqual([]);
      for (const [k, o] of [["Pscore.random", {}], ["Pscore.common", { random: false }], ["Pscore.common.undesirable", { random: false, smallValues: "undesirable" }]] as const) {
        const p = netrank(fit, o); expect(close(fit.trts.map((t) => p[t]!), fit.trts.map((t) => num(R[k][t]))), k).toBe(true);
      }
    });
  }
  it("common-effect fit with another reference", () => {
    const fit = fitOf(fx.net1.data, "B"); const R = fx.net1.common_only;
    for (const f of ["TE.common", "seTE.common", "lower.common", "upper.common"]) expect(close((fit as any)[f].values.flat(), (R[f].values as any[]).flat().map(num)), f).toBe(true);
  });
  it("netsplit", () => {
    const s = netsplit(fitOf(fx.net1.data)) as any; const R = fx.net1.netsplit;
    for (const part of Object.keys(R)) {
      if (part.startsWith("prop")) { expect(close(s[part], vec(R[part])), part).toBe(true); continue; }
      expect(s[part].comparison, part).toEqual(R[part].comparison);
      for (const f of ["TE", "seTE", "lower", "upper", "z", "p"]) if (R[part][f] !== null) expect(close(s[part][f], vec(R[part][f])), `${part} ${f}`).toBe(true);
    }
  });
  it("decomp.design and netmeasures' proportion", () => {
    const fit = fitOf(fx.net1.data); const d = decompDesign(fit); const R = fx.net1.decomp;
    expect(close(d["Q.decomp"].Q, vec(R.Q)) && close(d["Q.decomp"].df, vec(R.df)) && close(d["Q.decomp"].pval, vec(R.pval))).toBe(true);
    expect(d["Q.het.design"].design).toEqual(R.het_design);
    expect(close(d["Q.het.design"].Q, vec(R.het_Q)) && close(d["Q.het.design"].df, vec(R.het_df)) && close(d["Q.het.design"].pval, vec(R.het_p))).toBe(true);
    const me = netmeasures(fit); const RP = fx.net1.netmeasures.proportion;
    expect(close(Object.keys(RP).map((c) => me.proportion[c]!), Object.values(RP).map(num))).toBe(true);
  });
  it("netleague", () => {
    const fit = fitOf(fx.net1.data);
    expect(netleague(fit, { digits: 4 })).toEqual(fx.net1.league.random);
    expect(netleague(fit, { digits: 4, random: false })).toEqual(fx.net1.league.common);
  });
  it("pairwise", () => {
    const P = fx.pairwise;
    for (const sm of ["OR", "RR", "RD", "MD"] as const) {
      const p = pairwise({ treat: P.treat, studlab: P.studlab, n: vec(P.n), ...(sm === "MD" ? { mean: vec(P.mean), sd: vec(P.sd) } : { event: vec(P.event) }) }, { sm });
      expect(close(p.TE, vec(P[sm].TE)) && close(p.seTE, vec(P[sm].seTE)), sm).toBe(true);
      expect([p.treat1, p.treat2, p.studlab]).toEqual([P[sm].treat1, P[sm].treat2, P[sm].studlab]);
    }
  });
  it("netconnection", () => {
    const N = fx.netconnection; const nc = netconnection(N.t1, N.t2);
    expect([nc["n.subnets"], nc.n]).toEqual([num(N["n.subnets"]), num(N.n)]);
    const D = (N.D.rows as string[]).map((a) => (N.D.cols as string[]).map((b) => { const v = nc.D.values[nc.D.rows.indexOf(a)]![nc.D.cols.indexOf(b)]!; return Number.isFinite(v) ? v : NaN; }));
    expect(close(D.flat(), (N.D.values as any[]).flat().map(num))).toBe(true);
  });
  it("netcomb and discomb", () => {
    const C = fx.cnma;
    const cb = netcomb(fitOf(C.data, "P"), { inactive: "P" }); const db = discomb(C.data_dis.map((r: any) => num(r.TE)), C.data_dis.map((r: any) => num(r.seTE)), C.data_dis.map((r: any) => r.t1), C.data_dis.map((r: any) => r.t2), C.data_dis.map((r: any) => r.stud), { inactive: "P" });
    for (const [mine, R] of [[cb, C.netcomb], [db, C.discomb]] as const) {
      expect(mine.comps).toEqual(R.comps);
      for (const f of ["Comp.common", "seComp.common", "Comp.random", "seComp.random"]) expect(close((mine as any)[f], vec(R[f])), f).toBe(true);
      for (const f of ["Comb.common", "seComb.common", "Comb.random"]) expect(close((mine as any)[f], Array.isArray(R[f]) ? vec(R[f]) : Object.values(R[f]).map(num)), f).toBe(true);
      expect(close([mine["Q.additive"], mine["df.Q.additive"], mine.tau2], [R["Q.additive"], R["df.Q.additive"], R.tau2].map(num))).toBe(true);
    }
  });
  it("netposet", () => {
    const f2 = fitOf(fx.net2.data), f3 = fitOf(fx.net2.data3); const N = fx.net2.poset;
    for (const [random, PM, M0] of [[true, N.P, N.M0], [false, N.Pc, N.M0c]] as const) {
      const a = netrank(f2, { random }), b = netrank(f3, { random }); const P = f2.trts.map((t) => [a[t]!, b[t]!]);
      expect(close(P.flat(), (PM.values as any[]).flat().map(num))).toBe(true);
      expect(netposet(P)).toEqual((M0.values as any[]).map((r: any[]) => r.map(num)));
    }
  });
});

// The 1.20.0 edge-case review of the meta functions (oracle/tsmeta-behaviour.md "Edge-case plan"): degenerate inputs
// against R (experiments/tsmeta120-metaedge.json, log 102), scale invariance (where R's REML stopping rule does not
// apply), and clear errors for invalid input.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { confintRma, rma } from "../src/models/metaAnalysis.js";
import { metabin } from "../src/meta/metabin.js";
import { metagen, pWeightedChisq } from "../src/meta/metagen.js";
import { metareg, metabias, trimfill, baujat } from "../src/meta/metaextra.js";
import { pchisq } from "../src/distributions/chisq.js";
import { metacont, metacor, metainc, metamean, metaprop, metarate } from "../src/meta/metaother.js";
import { netmeta, netrank, netsplit, decompDesign, netmeasures } from "../src/meta/netmeta.js";

const R = JSON.parse(readFileSync(new URL("../experiments/tsmeta120-metaedge.json", import.meta.url), "utf8")) as Record<string, any>;
const num = (v: unknown): number => (v === null ? NaN : Number(v));
const TE = [0.3, 0.1, 0.25, 0.4, 0.2, -0.1, 0.5], se = [0.15, 0.2, 0.1, 0.3, 0.12, 0.25, 0.18];

describe("meta: degenerate inputs as R", () => {
  const cases: Record<string, [number[], number[]]> = { k1: [[0.3], [0.1]], k2: [[0.3, 0.1], [0.1, 0.2]], sameTE: [[0.2, 0.2, 0.2], [0.1, 0.2, 0.3]], sameAll: [[0.2, 0.2], [0.1, 0.1]] };
  for (const [name, [t, s]] of Object.entries(cases)) for (const ci of ["classic", "HK"] as const) {
    it(`${name} ${ci}`, () => {
      const m = metagen(t, s, { methodRandomCi: ci }) as unknown as Record<string, number>; const r = R[`${name} ${ci}`];
      // with Q = 0 and HK, R's seTE.random is rounding noise (2e-17): its statistic and p-value are not compared
      const noise = ci === "HK" && name.startsWith("same");
      for (const [f, e] of Object.entries(r)) {
        if (noise && (f === "pval.random" || f === "seTE.random")) continue;
        // the tau2 interval: R's root tolerance (as test/meta.test.ts)
        const tol = f.endsWith("tau2") || f.endsWith("tau") ? 1.3e-4 : 1e-12 + 1e-9 * Math.abs(num(e));
        const x = num(e), y = m[f]!;
        if (Number.isNaN(x)) { expect(Number.isNaN(y), `${f}: ${y}`).toBe(true); continue; }
        expect(Math.abs(y - x), f).toBeLessThan(tol);
      }
    });
  }
  for (const sm of ["RR", "OR", "RD"] as const) {
    it(`metabin with every study double-zero, ${sm}`, () => {
      const m = metabin([0, 0], [10, 12], [0, 0], [11, 9], { sm }) as unknown as Record<string, number>; const r = R[`allzero ${sm}`];
      for (const [f, e] of Object.entries(r)) {
        const x = num(e), y = m[f]!;
        if (Number.isNaN(x)) { expect(Number.isNaN(y), `${f}: ${y}`).toBe(true); continue; }
        expect(Math.abs(y - x), f).toBeLessThan(1e-12 + 1e-9 * Math.abs(x));
      }
    });
  }
});

describe("meta: scale", () => {
  it("rma's tau2 interval at any scale (1.20.0 fix: the root search had an absolute tolerance and a start at 1e-8)", () => {
    const ref = confintRma(rma(TE, se.map((x) => x * x), { method: "REML" })).random.rows[0]!["ci.ub"];
    for (const c of [1e-8, 1e-6, 1e-4, 1e4, 1e150, 1e-150]) {
      const ub = confintRma(rma(TE.map((x) => x * c), se.map((x) => (x * c) ** 2), { method: "REML" })).random.rows[0]!["ci.ub"];
      expect(Math.abs(ub / c / c / ref - 1), String(c)).toBeLessThan(1e-12);
    }
  });
  it("metagen: invariant statistics and equivariant estimates from 1e-300 to 2^1000", () => {
    for (const mt of ["DL", "SJ", "HE", "HS"] as const) {
      const base = metagen(TE, se, { methodTau: mt }) as unknown as Record<string, number>;
      for (const c of [1e-300, 1e-150, 1e-8, 1e8, 1e150, 1e300, 2 ** 1000]) {
        const m = metagen(TE.map((x) => x * c), se.map((x) => x * c), { methodTau: mt }) as unknown as Record<string, number>;
        for (const f of ["Q", "I2", "H", "lower.I2", "upper.I2", "statistic.common", "pval.common", "statistic.random", "pval.random"]) expect(Math.abs(m[f]! - base[f]!), `${mt} ${c} ${f}`).toBeLessThan(1e-9 * Math.max(1, Math.abs(base[f]!)));
        for (const f of ["TE.common", "seTE.common", "TE.random", "seTE.random", "upper.random", "lower.predict", "tau", "upper.tau"]) expect(base[f] === 0 ? m[f] : Math.abs(m[f]! / c / base[f]! - 1), `${mt} ${c} ${f}`).toBeLessThan(1e-9);
      }
    }
  });
  it("metabin's MH estimates with counts up to 1e12", () => {
    const e1 = [12, 30, 5], n1 = [100, 250, 60], e2 = [18, 40, 9], n2 = [110, 240, 58];
    const base = metabin(e1, n1, e2, n2, { sm: "OR" });
    for (const c of [1e3, 1e6, 1e9, 1e12]) {
      const m = metabin(e1.map((x) => x * c), n1.map((x) => x * c), e2.map((x) => x * c), n2.map((x) => x * c), { sm: "OR" });
      expect(Math.abs(m["TE.common"] / base["TE.common"] - 1)).toBeLessThan(1e-12);
      expect(Math.abs(m["seTE.common"] * Math.sqrt(c) / base["seTE.common"] - 1)).toBeLessThan(1e-12);
    }
  });
});

describe("meta: invalid input", () => {
  const throws: [string, () => unknown, RegExp][] = [
    ["NaN TE", () => metagen([NaN, 1], [1, 1]), /finite/], ["negative se", () => metagen([1, 2], [-1, 1]), /positive/], ["lengths", () => metagen([1, 2], [1]), /same length/],
    ["unknown option", () => metagen([1, 2], [1, 1], { foo: 1 } as never), /unknown option/], ["metabin events > n", () => metabin([5], [3], [1], [3]), /0\.\.n/],
    ["metaprop events > n", () => metaprop([5], [3]), /0\.\.n/], ["metaprop n = 0", () => metaprop([0], [0]), /n must be finite and positive/], ["metainc negative time", () => metainc([1], [-5], [1], [5]), /time/],
    ["metacont negative sd", () => metacont([10], [1], [-1], [10], [1], [1]), /sd/], ["metacor r > 1", () => metacor([1.2], [20]), /cor/], ["metacor n <= 3", () => metacor([0.2], [3]), /exceed/],
    ["metamean n = 0", () => metamean([0], [1], [1]), /n/], ["metarate time 0", () => metarate([1], [0]), /time/],
    ["netmeta disconnected", () => netmeta([1, 1], [1, 1], ["A", "C"], ["B", "D"], ["s1", "s2"]), /not connected/],
  ];
  for (const [name, f, re] of throws) it(name, () => expect(f).toThrow(re));
});

// netmeta's fine axes (log 109; R on the same inputs: experiments/tsmeta120-netedge.json)
describe("netmeta: special networks and scale as R (log 109)", () => {
  const RN = JSON.parse(readFileSync(new URL("../experiments/tsmeta120-netedge.json", import.meta.url), "utf8")).netmeta as Record<string, any>;
  const rowsOf = (d: any): any[] => (Array.isArray(d) ? d : d.stud.map((_: unknown, i: number) => ({ stud: d.stud[i], t1: d.t1[i], t2: d.t2[i], TE: d.TE[i], seTE: d.seTE[i] })));
  const fitOf = (d: any, c = 1) => { const r = rowsOf(d); const trts = [...new Set(r.flatMap((x) => [x.t1, x.t2]))].sort() as string[];
    return { trts, nm: netmeta(r.map((x) => x.TE * c), r.map((x) => x.seTE * c), r.map((x) => x.t1), r.map((x) => x.t2), r.map((x) => x.stud), { referenceGroup: trts[0]! }) }; };
  const col = (nm: any, key: string, trts: string[]) => trts.map((t) => nm[key].values[nm[key].rows.indexOf(t)][nm[key].cols.indexOf(trts[0])]);
  for (const name of ["base", "one", "star", "consistent", "equalse", "tied", "large"]) {
    it(name, () => {
      const r = name === "base" ? RN.base : RN[name].fit; const { trts, nm } = fitOf(name === "base" ? RN.data : RN[name].data);
      for (const key of ["TE.common", "seTE.common", "TE.random", "seTE.random"]) col(nm, key, trts).forEach((v, i) => expect(Math.abs(v - r[key][i]), `${key} ${i}`).toBeLessThan(1e-12));
      if (r.tau2 === null) expect(Number.isNaN(nm.tau2)).toBe(true); else expect(Math.abs(nm.tau2 - r.tau2)).toBeLessThan(1e-12);
      const pr = netrank(nm); trts.forEach((t, i) => expect(Math.abs(pr[t]! - r["Pscore.random"][i]), t).toBeLessThan(1e-12));
    });
  }
  it("TE and seTE times 1e-150 .. 1e150: equivariant (R fails from 1e+-10 on: a singular system)", () => {
    const { trts, nm: b } = fitOf(RN.data);
    for (const c of [1e-150, 1e-10, 1e10, 1e150]) {
      const { nm } = fitOf(RN.data, c);
      for (const key of ["TE.random", "seTE.random"]) col(nm, key, trts).forEach((v, i) => { const w = col(b, key, trts)[i]!; if (w) expect(Math.abs(v / c / w - 1), `${c} ${key}`).toBeLessThan(1e-13); });
      expect(Math.abs(nm.tau2 / c / c / b.tau2 - 1)).toBeLessThan(1e-13); expect(Math.abs(nm.Q - b.Q)).toBeLessThan(1e-12 * b.Q);
    }
  });
});

// The function x axis matrix (log 110): the meta functions not covered by the first round.
describe("meta: the rest of the function x axis matrix (log 110)", () => {
  const te = [0.12, -0.35, 0.08, -0.51, -0.22, 0.31, -0.18, -0.44], se = [0.21, 0.18, 0.25, 0.3, 0.15, 0.27, 0.19, 0.22];
  const EXT = [1e-300, 1e-150, 1e150, 1e300];
  const close = (a: readonly number[], b: readonly number[], tol: number, what: string): void => a.forEach((v, i) => expect(Math.abs(v / b[i]! - 1), `${what} ${i}`).toBeLessThan(tol));
  it("metacont and metainc's IRD at 1e+-300 (hypot instead of the squares)", () => {
    const n1 = [30, 25, 40], m1 = [5.1, 4.8, 6.0], s1 = [1.2, 1.1, 1.5], n2 = [32, 24, 41], m2 = [5.6, 5.5, 6.3], s2 = [1.3, 1.0, 1.4];
    for (const sm of ["MD", "SMD", "ROM"] as const) {
      const f = (c: number) => { const r = metacont(n1, m1.map((v) => v * c), s1.map((v) => v * c), n2, m2.map((v) => v * c), s2.map((v) => v * c), { sm }); return [r["TE.random"], r["seTE.random"]]; };
      const b = f(1); for (const c of EXT) close(f(c), b.map((v) => (sm === "MD" ? v * c : v)), 1e-13, `${sm} ${c}`);
    }
    const g = (c: number) => { const r = metainc([5, 8, 3], [1000, 1500, 800].map((v) => v * c), [10, 12, 9], [1100, 1400, 900].map((v) => v * c), { sm: "IRD" }); return [r["TE.common"], r["TE.random"], r["seTE.random"]]; };
    const bg = g(1); for (const c of EXT) close(g(c), bg.map((v) => v / c), 1e-13, `IRD ${c}`);
  });
  it("metareg: moderators times 1e+-300 or plus 1e15 (X'WX was singular to the solver), effects at 1e+-300", () => {
    const m = metagen(te, se); const x = [1, 2, 3, 4, 5, 6, 7, 8]; const b = metareg(m, x.map((v) => [v]));
    const slope = (r: any) => [r.beta.rows[1][0], r.se[1], r.QM];
    for (const c of [1e-300, 1e300]) { const r = metareg(m, x.map((v) => [v * c])); close([r.beta.rows[1]![0]! * c, (r.se as number[])[1]! * c, r.QM], slope(b), 1e-12, `mods x ${c}`); }
    for (const s of [1e8, 1e15]) close(slope(metareg(m, x.map((v) => [v + s]))), slope(b), 1e-12, `mods + ${s}`);
    // effects beyond 2^+-200: the standardised fit (at ordinary scales R's REML stopping rule, absolute 1e-5, is kept)
    const e1 = metareg(metagen(te.map((v) => v * 1e-150), se.map((v) => v * 1e-150)), x.map((v) => [v]));
    // (the standardised series differ by factors that are not powers of two, so REML's absolute stopping rule stops
    // at points 7e-7 apart)
    for (const c of [1e-300, 1e300]) { const r = metareg(metagen(te.map((v) => v * c), se.map((v) => v * c)), x.map((v) => [v])); expect(Math.abs(r.beta.rows[1]![0]! / c / (e1.beta.rows[1]![0]! / 1e-150) - 1)).toBeLessThan(1e-5); }
  });
  it("metabias, trimfill, baujat and the subgroups' common tau2 at 1e+-300", () => {
    for (const c of EXT) {
      const m = metagen(te.map((v) => v * c), se.map((v) => v * c));
      for (const method of ["Egger", "Begg", "Thompson"] as const) expect(Number.isFinite(metabias(m, { method }).statistic), `${method} ${c}`).toBe(true);
      expect(trimfill(m).meta["TE.random"] / c).toBeCloseTo(trimfill(metagen(te, se)).meta["TE.random"], 3);
      expect(baujat(m).x.every(Number.isFinite)).toBe(true);
    }
  });
  it("netmeta and its functions at 1e+-300", () => {
    const TE = [0.25, 0.4, 0.15, 0.3, 0.55, 0.2, 0.1], s0 = [0.1, 0.12, 0.11, 0.14, 0.13, 0.1, 0.15], t1 = ["A", "A", "B", "A", "C", "B", "A"], t2 = ["B", "C", "C", "D", "D", "D", "B"], st = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"];
    const f = (c: number) => { const n = netmeta(TE.map((v) => v * c), s0.map((v) => v * c), t1, t2, st, { referenceGroup: "A" }); const sp = netsplit(n);
      return { te: [...sp["indirect.random"].TE, ...sp["direct.common"].seTE].map((v) => v / c), inv: [...sp["compare.random"].z, ...decompDesign(n)["Q.decomp"].Q, ...Object.values(netmeasures(n).proportion), ...Object.values(netrank(n))] }; };
    const b = f(1); for (const c of [1e-300, 1e300]) { const r = f(c); close(r.te, b.te, 1e-12, `te ${c}`); close(r.inv, b.inv, 1e-12, `inv ${c}`); }
  });
  it("pWeightedChisq: weights and q scaled together (1e+-300); equal weights give pchisq", () => {
    const b = pWeightedChisq(3, [1, 0.5, 0.2]);
    for (const c of EXT) expect(Math.abs(pWeightedChisq(3 * c, [1, 0.5, 0.2].map((v) => v * c)) / b - 1)).toBeLessThan(1e-13);
    for (const [q, k] of [[1e-6, 3], [0.5, 5], [8, 4]] as const) expect(Math.abs(pWeightedChisq(q, new Array<number>(k).fill(0.5)) / (pchisq(q / 0.5, k) as number) - 1)).toBeLessThan(1e-13);
  });
  it("metaprop near 0 and 1 against R (zero cells, all events, rare events, large counts)", () => {
    // from 1.21.0 against R iterated to the maximum (experiments/plot121-reml2.R, the sets of tsmeta120-propedge.R)
    const RP = JSON.parse(readFileSync(new URL("../experiments/plot121-reml2.json", import.meta.url), "utf8")).propedge as Record<string, any>;
    for (const nm of Object.keys(RP.sets)) for (const sm of ["PLOGIT", "PFT", "PAS", "PRAW", "PLN"] as const) {
      const r = RP[nm][sm]; const j = metaprop(RP.sets[nm].e, RP.sets[nm].n, { sm });
      close([j["TE.random"], j["seTE.random"]], [r["TE.random"], r["seTE.random"]], 1e-9, `${nm} ${sm}`);
    }
  });
});

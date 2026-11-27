// The 1.20.0 edge-case review of the meta functions (oracle/tsmeta-behaviour.md "Edge-case plan"): degenerate inputs
// against R (experiments/tsmeta120-metaedge.json, log 102), scale invariance (where R's REML stopping rule does not
// apply), and clear errors for invalid input.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { confintRma, rma } from "../src/models/metaAnalysis.js";
import { metabin } from "../src/meta/metabin.js";
import { metagen } from "../src/meta/metagen.js";
import { metacont, metacor, metainc, metamean, metaprop, metarate } from "../src/meta/metaother.js";
import { netmeta } from "../src/meta/netmeta.js";

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

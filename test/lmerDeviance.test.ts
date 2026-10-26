// The profiled deviance of a linear mixed model against lme4's deviance function (oracle/lmerdev.R,
// oracle/lmer-behaviour.md stage 1b). Each value must be within the tolerance of R's value or of the 200-bit
// reference: deviance, rss, ussq, prss relative 1e-12; logDetL, logDetRX absolute 1e-12 × max(1, |value|); beta, u,
// b each element within 1e-12 × the largest absolute element of the reference vector.
import { describe, expect, it } from "vitest";
import { profiledDeviance, type ProfiledDeviance } from "../src/models/mixedDeviance.js";
import { mixedModelStructure } from "../src/models/mixedStructure.js";
import { num } from "./helpers/fixture.js";
import { dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const fixture = loadAnovaFixture("lmerDeviance");
const TOL = 1e-12;

/** |actual − expected| / scale, 0 when the two are equal (also when the scale is 0) */
const scaledError = (actual: number, expected: number, scale: number): number => (actual === expected ? 0 : Math.abs(actual - expected) / scale);

const SCALARS = ["deviance", "rss", "ussq", "prss"] as const;
const LOGDETS = ["logDetL", "logDetRX"] as const;
const VECTORS = ["beta", "u", "b"] as const;
type Field = (typeof SCALARS)[number] | (typeof LOGDETS)[number] | (typeof VECTORS)[number];

describe("profiledDeviance (lmerDeviance)", () => {
  it(`matches lme4's deviance function (${fixture.r_version})`, () => {
    const failures: string[] = [];
    // the largest error of each field (in units of its tolerance's scale) against R and against the reference
    const worst = new Map<Field, { r: number; ref: number }>();
    const note = (field: Field, r: number, ref: number): void => {
      const w = worst.get(field) ?? { r: 0, ref: 0 };
      worst.set(field, { r: Math.max(w.r, r), ref: Math.max(w.ref, ref) });
    };
    let cells = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const s = mixedModelStructure(a.formula as string, dataFrameOf(a.data, a.dataTypes));
      const theta = (a.theta as string[]).map((t) => num(t));
      const result: ProfiledDeviance = profiledDeviance(s, theta, a.REML as boolean);
      const e = c.expected;
      const ref = c.reference!;
      const where = `case ${index} (${String(a.formula)}, REML = ${String(a.REML)}, theta = ${theta.join(", ")})`;
      for (const f of SCALARS) {
        const r = num(e[f] as string);
        const x = num(ref[f] as string);
        const errR = scaledError(result[f], r, Math.abs(r));
        const errRef = scaledError(result[f], x, Math.abs(x));
        note(f, errR, errRef);
        cells++;
        if (!(errR <= TOL || errRef <= TOL)) failures.push(`${where} ${f}: R ${r}, reference ${x}, got ${result[f]}`);
      }
      for (const f of LOGDETS) {
        const r = num(e[f] as string);
        const x = num(ref[f] as string);
        const errR = scaledError(result[f], r, Math.max(1, Math.abs(r)));
        const errRef = scaledError(result[f], x, Math.max(1, Math.abs(x)));
        note(f, errR, errRef);
        cells++;
        if (!(errR <= TOL || errRef <= TOL)) failures.push(`${where} ${f}: R ${r}, reference ${x}, got ${result[f]}`);
      }
      for (const f of VECTORS) {
        const r = (e[f] as string[]).map((v) => num(v));
        const x = (ref[f] as string[]).map((v) => num(v));
        const got = result[f];
        if (got.length !== x.length || r.length !== x.length) {
          failures.push(`${where} ${f}: length ${got.length}, expected ${x.length}`);
          continue;
        }
        const scale = Math.max(...x.map(Math.abs));
        got.forEach((v, k) => {
          const errR = scaledError(v, r[k]!, scale);
          const errRef = scaledError(v, x[k]!, scale);
          note(f, errR, errRef);
          cells++;
          if (!(errR <= TOL || errRef <= TOL)) failures.push(`${where} ${f}[${k}]: R ${r[k]}, reference ${x[k]}, got ${v}`);
        });
      }
    });
    const summary = [...worst].map(([f, w]) => `${f} ${w.r.toExponential(1)}/${w.ref.toExponential(1)}`).join(", ");
    console.log(`lmerDeviance: ${fixture.cases.length} cases, ${cells} values; largest error against R/reference: ${summary}`);
    expect(failures, failures.slice(0, 20).join("\n")).toEqual([]);
  });
});

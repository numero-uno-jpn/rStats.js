// Time of one fit by lmer (src/models/lmer.ts) and of one evaluation of its profiled deviance
// (src/models/mixedDeviance.ts) on the four data sets of the speed table in oracle/lmer-behaviour.md ("Sparse
// computation (stages S1 and S2)"), built here with a seeded generator; for information also one evaluation by the
// dense reference (test/helpers/mixedDense.ts) where its q × q arrays are small enough.
//
//   node scripts/lmer-timing.mjs            (no build needed: the TypeScript sources are bundled with esbuild)
//
// For each data set: n, q, the time of the whole fit (lmer from the data: the structure, the minimisation and the
// results; the median of 3 fits) against the target of the speed table, the number of evaluations of the criterion
// with its gradient in a fit, the time to build the structure, the first evaluation (which also forms the
// cross-products and the pattern of the factor, once per structure), the median of 5 further evaluations at other
// values of θ, one with the gradient, and one dense evaluation (its first, which also forms its own cross-products).
// Then the time of lmerSummary (src/models/lmerTest.ts) on a fresh fit: the analytic Hessian of the deviance in (θ, σ),
// the Jacobians of the covariance of β̂ and the Satterthwaite degrees of freedom (the median of 3).
// Stop other heavy work while measuring.

import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), "lmer-timing-"));
const entry = path.join(dir, "entry.ts");
writeFileSync(
  entry,
  [
    `export { mixedModelStructure } from ${JSON.stringify(path.join(root, "src/models/mixedStructure.ts"))};`,
    `export { lmer, lmerWithCriterion } from ${JSON.stringify(path.join(root, "src/models/lmer.ts"))};`,
    `export { lmerSummary } from ${JSON.stringify(path.join(root, "src/models/lmerTest.ts"))};`,
    `export { profiledDeviance } from ${JSON.stringify(path.join(root, "src/models/mixedDeviance.ts"))};`,
    `export { denseProfiledDeviance } from ${JSON.stringify(path.join(root, "test/helpers/mixedDense.ts"))};`,
  ].join("\n"),
);
const outfile = path.join(dir, "bundle.mjs");
await build({ entryPoints: [entry], outfile, bundle: true, format: "esm", platform: "node", target: "es2022", logLevel: "error" });
const { lmer, lmerSummary, lmerWithCriterion, mixedModelStructure, profiledDeviance, denseProfiledDeviance } = await import(pathToFileURL(outfile).href);
rmSync(dir, { recursive: true, force: true });

/** A seeded generator of uniform and normal numbers (mulberry32 and Box-Muller) */
function generator(seed) {
  let a = seed >>> 0;
  const unif = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const norm = () => Math.sqrt(-2 * Math.log(1 - unif())) * Math.cos(2 * Math.PI * unif());
  return { unif, norm };
}

/** y ~ x + (1 | s) + (1 | i), one row per pair */
function crossed(ns, ni, seed) {
  const { unif, norm } = generator(seed);
  const se = Array.from({ length: ns }, () => norm());
  const ie = Array.from({ length: ni }, () => 0.7 * norm());
  const data = { y: [], x: [], s: [], i: [] };
  for (let s = 0; s < ns; s++) {
    for (let i = 0; i < ni; i++) {
      const x = unif() * 4 - 1;
      data.s.push(`s${s}`);
      data.i.push(`i${i}`);
      data.x.push(x);
      data.y.push(1 + 0.5 * x + se[s] + ie[i] + norm());
    }
  }
  return { formula: "y ~ x + (1 | s) + (1 | i)", data, label: `crossed ${ns} × ${ni}`, target: ns === 200 ? 0.5 : 6 };
}

/** y ~ x + (x | s), `per` rows per subject */
function slopes(ns, per, seed) {
  const { unif, norm } = generator(seed);
  const data = { y: [], x: [], s: [] };
  for (let s = 0; s < ns; s++) {
    const [b0, b1] = [norm(), 0.4 * norm()];
    for (let r = 0; r < per; r++) {
      const x = r + unif();
      data.s.push(`s${s}`);
      data.x.push(x);
      data.y.push(2 + 0.3 * x + b0 + b1 * x + 0.8 * norm());
    }
  }
  return { formula: "y ~ x + (x | s)", data, label: `${ns} subjects × ${per}`, target: ns === 1000 ? 0.5 : 3 };
}

const DENSE_MAX_Q = 2000;
const FITS = 3;
const seconds = (ms) => `${(ms / 1000).toFixed(3)} s`;
const time = (f) => {
  const t0 = performance.now();
  const value = f();
  return { ms: performance.now() - t0, value };
};
const median = (v) => v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)];

const rows = [];
for (const m of [crossed(200, 100, 1), crossed(500, 200, 2), slopes(1000, 10, 3), slopes(5000, 10, 4)]) {
  const fits = [];
  for (let k = 0; k < FITS; k++) fits.push(time(() => lmer(m.formula, m.data)).ms);
  const summaries = [];
  for (let k = 0; k < FITS; k++) {
    const fit = lmer(m.formula, m.data);
    summaries.push(time(() => lmerSummary(fit)).ms);
  }
  let evaluations = 0;
  lmerWithCriterion(m.formula, m.data, {}, (s, theta, reml) => {
    evaluations++;
    const r = profiledDeviance(s, theta, reml, { gradient: true });
    return { f: r.deviance, g: r.gradient };
  });
  const { ms: structureMs, value: s } = time(() => mixedModelStructure(m.formula, m.data));
  const thetaAt = (k) => s.theta.map((t, j) => (s.lower[j] === 0 ? 0.5 + 0.1 * k + 0.05 * j : -0.2 + 0.05 * k));
  const first = time(() => profiledDeviance(s, s.theta, true));
  const later = [];
  for (let k = 0; k < 5; k++) later.push(time(() => profiledDeviance(s, thetaAt(k), true)).ms);
  const gradient = time(() => profiledDeviance(s, thetaAt(0), true, { gradient: true }));
  let dense;
  if (s.q <= DENSE_MAX_Q) {
    dense = time(() => denseProfiledDeviance(s, thetaAt(0), true));
    const sparse = profiledDeviance(s, thetaAt(0), true);
    dense.relative = Math.abs(sparse.deviance - dense.value.deviance) / Math.abs(dense.value.deviance);
  }
  rows.push([
    `\`${m.formula.replaceAll("|", "\\|")}\`, ${m.label}`,
    s.y.length,
    s.q,
    `${seconds(median(fits))} (≤ ${m.target} s)`,
    evaluations,
    seconds(structureMs),
    seconds(first.ms),
    seconds(median(later)),
    seconds(gradient.ms),
    dense === undefined ? "–" : `${seconds(dense.ms)} (difference ${dense.relative.toExponential(1)})`,
    seconds(median(summaries)),
  ]);
}
const header = [
  "Model",
  "n",
  "q",
  "fit (target)",
  "evaluations in a fit",
  "structure",
  "first evaluation",
  "evaluation (median)",
  "with gradient",
  "dense reference (first call)",
  "lmerSummary (Satterthwaite)",
];
const line = (c) => `| ${c.join(" | ")} |`;
console.log(`Node ${process.version} (${process.arch})`);
console.log([line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n"));

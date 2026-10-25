// Speed benchmark (docs/performance.md). Times a one-call-per-element loop over the same
// inputs with double-double (the default) and with plain double precision (the switch in
// src/special/dd.ts).
//
//   npm run bench                    build, then measure dist/
//   node scripts/bench.mjs <dir>     measure another build (e.g. main before a change); dd only if it has no switch
//
// Inputs come from the library's own setSeed and runif, so they are identical for every build.
// Reports the minimum of 5 runs in µs per call. Stop other heavy work while measuring.
// Each mode runs in a separate process: switching within one process leaves V8's type feedback
// from the first mode in place, which makes the later mode appear up to 2x slower.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const modeAt = args.indexOf("--mode");
const modeArg = modeAt >= 0 ? args[modeAt + 1] : undefined;
const dir = path.resolve(args.find((a, i) => !a.startsWith("--") && !(modeAt >= 0 && i === modeAt + 1)) ?? "dist");
const ddPath = path.join(dir, "special", "dd.js");
const dd = existsSync(ddPath) ? await import(pathToFileURL(ddPath).href) : {};
const modes = typeof dd.setDoubleDouble === "function" ? ["dd", "double"] : ["dd"];

if (modeArg === undefined) {
  // Parent: measure each mode in a child process and tabulate
  const self = fileURLToPath(import.meta.url);
  const results = modes.map((m) =>
    JSON.parse(execFileSync(process.execPath, [self, dir, "--mode", m], { encoding: "utf8" })),
  );
  const fmt = (v) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2));
  const line = (c) => `| ${c.join(" | ")} |`;
  const header = ["function", "calls", ...modes.map((m) => `${m} µs/call`), ...(modes.length > 1 ? ["dd / double"] : [])];
  const rows = results[0].map(([name, n], i) => {
    const us = results.map((r) => r[i][2]);
    return [name, n, ...us.map(fmt), ...(us.length > 1 ? [`${(us[0] / us[1]).toFixed(1)}x`] : [])];
  });
  console.log(`Measured: ${dir} (${process.version}, ${process.arch})`);
  console.log([line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n"));
  process.exit(0);
}

// Child: measure everything in one mode and print an array of [name, calls, µs/call] as JSON
const lib = await import(pathToFileURL(path.join(dir, "index.js")).href);
dd.setDoubleDouble?.(modeArg === "dd");

const { setSeed, runif, rnorm } = lib;
setSeed(20261020);
const logUnif = (n, lo, hi) => runif(n).map((u) => Math.exp(Math.log(lo) + u * (Math.log(hi) - Math.log(lo))));

// A typical set (same ranges as docs/performance.md: shapes log-uniform on 0.5 to 50, p uniform on 0 to 1) and a tail set
const N = 2000;
const a = logUnif(N, 0.5, 50);
const b = logUnif(N, 0.5, 50);
const u = runif(N);
const ta = logUnif(N, 0.1, 1e4);
const tb = logUnif(N, 0.1, 1e4);
const tp = runif(N).map((v) => 10 ** -(5 + 295 * v));
const df = logUnif(N, 0.5, 1e3);
const tq = rnorm(N, { sd: 3 });
const shape = logUnif(N, 0.1, 1e3);
const gq = shape.map((s, i) => s * 2 * u[i]);
const size = logUnif(N, 0.1, 1e3);
const prob = runif(N);
const nq = size.map((s, i) => Math.floor(((s * (1 - prob[i])) / prob[i]) * 2 * u[i]));
const samples = Array.from({ length: 200 }, () => [rnorm(30), rnorm(25, { mean: 0.3 })]);
// Binomial: size log-uniform on 1 to 1e4, x around the mean (within 3 standard deviations)
const bn = logUnif(N, 1, 1e4).map(Math.round);
const bx = bn.map((n, i) => Math.max(0, Math.min(n, Math.round(n * prob[i] + 3 * (2 * u[i] - 1) * Math.sqrt(n * prob[i] * (1 - prob[i]))))));

// Binomial with x near 0: mean 10, x within 3 standard deviations
const bx1 = u.map((v) => Math.max(0, Math.round(10 + 3 * Math.sqrt(10) * (2 * v - 1))));

const cases = [
  ["qbeta (typical)", N, (i) => lib.qbeta(u[i], a[i], b[i])],
  ["qbeta (tail)", N, (i) => lib.qbeta(tp[i], ta[i], tb[i])],
  ["pbeta", N, (i) => lib.pbeta(u[i], a[i], b[i])],
  ["dbeta", N, (i) => lib.dbeta(u[i], a[i], b[i])],
  ["pt", N, (i) => lib.pt(tq[i], df[i])],
  ["pgamma", N, (i) => lib.pgamma(gq[i], shape[i])],
  ["qgamma", N, (i) => lib.qgamma(u[i], shape[i])],
  ["qgamma (tail)", N, (i) => lib.qgamma(tp[i], ta[i])],
  ["qchisq", N, (i) => lib.qchisq(u[i], 2 * a[i])],
  ["qt (typical)", N, (i) => lib.qt(u[i], a[i])],
  ["qt (tail)", N, (i) => lib.qt(tp[i], ta[i])],
  ["qf", N, (i) => lib.qf(u[i], 2 * a[i], 2 * b[i])],
  ["pnbinom", N, (i) => lib.pnbinom(nq[i], size[i], { prob: prob[i] })],
  ["dbinom", N, (i) => lib.dbinom(bx[i], bn[i], prob[i])],
  ["pbinom", N, (i) => lib.pbinom(bx[i], bn[i], prob[i])],
  ["dgamma", N, (i) => lib.dgamma(gq[i], shape[i])],
  ["dt", N, (i) => lib.dt(tq[i], df[i])],
  ["pf", N, (i) => lib.pf(u[i] * 3, a[i], b[i])],
  ["pchisq", N, (i) => lib.pchisq(gq[i] * 2, shape[i] * 2)],
  ["tTest (Welch, 30 and 25)", samples.length, (i) => lib.tTest(samples[i][0], samples[i][1])],
  // Large parameters (docs/performance.md, "Large parameters"): the centre of the incomplete beta function
  ...[10, 1e3, 1e5, 1e6].map((s) => [`pbeta(0.5, a, a), a = ${s}`, 200, () => lib.pbeta(0.5, s, s)]),
  ...[1e3, 1e4, 1e5, 1e6].map((n) => [`pbinom(n/2, n, 0.5), n = ${n}`, 200, () => lib.pbinom(n / 2, n, 0.5)]),
  // One large and one small parameter: pt with large degrees of freedom (t ~ N(0, 3^2))
  ["pt, df = 1e6", N, (i) => lib.pt(tq[i], 1e6)],
  // ... and single points in the bulk (docs/performance.md, "Large parameters"), where the continued fraction was
  // slowest, and the quantile functions over p uniform on 0 to 1
  ["pt(1.5, 1e6)", 200, () => lib.pt(1.5, 1e6)],
  ["pt(2.5, 1e6)", 200, () => lib.pt(2.5, 1e6)],
  ["pt(4, 1e6)", 200, () => lib.pt(4, 1e6)],
  ["pbeta(1 - 3b/(a+b), 1e6, 0.5)", 200, () => lib.pbeta(1 - 1.5 / (1e6 + 0.5), 1e6, 0.5)],
  ["pbeta(1 - b/(a+b), 1e6, 2.5)", 200, () => lib.pbeta(1 - 2.5 / (1e6 + 2.5), 1e6, 2.5)],
  ["pbeta(1 - b/(a+b), 1e6, 10)", 200, () => lib.pbeta(1 - 10 / (1e6 + 10), 1e6, 10)],
  ["pbeta(1 - b/(a+b), 1e10, 0.5)", 200, () => lib.pbeta(1 - 0.5 / (1e10 + 0.5), 1e10, 0.5)],
  ["pf(1.5, 5, 1e5)", 200, () => lib.pf(1.5, 5, 1e5)],
  ["pf(3, 1, 1e5)", 200, () => lib.pf(3, 1, 1e5)],
  ["pbinom(x, 1e6, 1e-5), x ~ mean", N, (i) => lib.pbinom(bx1[i], 1e6, 1e-5)],
  ["qt, df = 1e6", N, (i) => lib.qt(u[i], 1e6)],
  ["qbeta(p, 1e6, 2.5)", N, (i) => lib.qbeta(u[i], 1e6, 2.5)],
  ["qf(p, 5, 1e5)", N, (i) => lib.qf(u[i], 5, 1e5)],
  ["qbinom(p, 1e6, 1e-5)", N, (i) => lib.qbinom(u[i], 1e6, 1e-5)],
];

function time(n, f) {
  let best = Infinity;
  let sink = 0;
  // Taking the minimum of 5 runs keeps JIT warm-up of the first run out of the result
  for (let r = 0; r < 5; r++) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      const v = f(i);
      sink += typeof v === "number" ? v : v.pValue;
    }
    best = Math.min(best, performance.now() - t0);
  }
  globalThis.benchSink = sink; // use the result so the optimizer cannot drop the computation
  return (best * 1000) / n;
}

console.log(JSON.stringify(cases.map(([name, n, f]) => [name, n, time(n, f)])));

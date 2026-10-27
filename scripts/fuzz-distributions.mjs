// Long-running exploration of the distribution functions' properties (test/helpers/properties.ts) against the built
// output in dist/. The CI test (test/distributionProperties.test.ts) runs the same checks on a few seeds; this script
// runs many more parameter sets and, unlike the test, survives calls that never return.
//
// Usage (after `npm run build`; needs Node with type stripping, 22.18 or later, to load the helper):
//
//   node scripts/fuzz-distributions.mjs <seed> <iterations> [family regex] [output.json] [--sizes=12,12,4] [--time=1000] [--known]
//
//   node scripts/fuzz-distributions.mjs 1 2000                  # every family, 2000 parameter sets each
//   node scripts/fuzz-distributions.mjs 7 500 '^nchisq$' v.json  # one family, violations written to v.json
//
// --sizes sets the evaluation points per parameter set (raw log-uniform, quantiles q(p), around the mean); with the
// seed and sizes of test/distributionProperties.test.ts it makes the same calls as the test, timeouts included.
// --time sets the duration (ms) above which a call is reported as slow (default 1000; lower it to find the calls that
// could pass 1 s on a slower machine). --known applies the allow-list of the test (test/helpers/distributionKnown.ts):
// its excluded calls are not made, and violations it lists are counted per entry instead of written out.
// Each family runs in its own worker thread (as many at once as there are CPUs). A call that has not returned after
// 5 s is reported as a "time" violation with its call text; the worker is then terminated and restarted with the next
// parameter set. Calls over 1 s are reported too. The violations are written as a JSON array of { family, property,
// call, detail, params, x } to stdout (or the file given), and a count per family and property goes to stderr.
// Parameter set i of a family always gets the same parameters for a given seed, so a range of iterations can be rerun.

import { availableParallelism } from "node:os";
import { writeFileSync } from "node:fs";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { FamilyRunner, distributionFamilies, familySeed, generator } from "../test/helpers/properties.ts";
import { knownViolations, matchesKnown } from "../test/helpers/distributionKnown.ts";

const HANG_MS = 5000;
const DEFAULT_SIZES = "12,12,4";
const TEXT_BYTES = 4096;

if (isMainThread) {
  const args = process.argv.slice(2);
  const sizesArg = args.find((a) => a.startsWith("--sizes="))?.slice(8) ?? DEFAULT_SIZES;
  const [seedArg, iterArg, filter, out] = args.filter((a) => !a.startsWith("--"));
  const [raw, quantile, central] = sizesArg.split(",").map(Number);
  const sizes = { raw, quantile, central };
  const timeLimitMs = Number(args.find((a) => a.startsWith("--time="))?.slice(7) ?? 1000);
  const useKnown = args.includes("--known");
  if (seedArg === undefined || iterArg === undefined) {
    console.error("usage: node scripts/fuzz-distributions.mjs <seed> <iterations> [family regex] [output.json]");
    process.exit(2);
  }
  const seed = Number(seedArg);
  const iterations = Number(iterArg);
  const re = new RegExp(filter ?? "");
  const families = distributionFamilies.filter((f) => re.test(f.name)).map((f) => f.name);
  const violations = [];
  const t0 = Date.now();

  /** Runs parameter sets [from, iterations) of one family; restarts after a hang */
  const runFamily = (name, from) =>
    new Promise((resolve) => {
      const shared = new SharedArrayBuffer(8 + TEXT_BYTES);
      const state = new Int32Array(shared, 0, 2);
      const worker = new Worker(new URL(import.meta.url), { workerData: { name, seed, from, to: iterations, sizes, timeLimitMs, useKnown, shared } });
      let next = from;
      let last = Atomics.load(state, 0);
      let since = Date.now();
      const watchdog = setInterval(() => {
        const now = Atomics.load(state, 0);
        if (now !== last) {
          last = now;
          since = Date.now();
          return;
        }
        if (Date.now() - since < HANG_MS) return;
        clearInterval(watchdog);
        const len = Atomics.load(state, 1);
        const call = new TextDecoder().decode(new Uint8Array(shared, 8, len).slice());
        violations.push({ family: name, property: "time", call, detail: `no result after ${HANG_MS / 1000} s (parameter set ${next})` });
        console.error(`${name}: hang at parameter set ${next}: ${call}`);
        worker.terminate().then(() => resolve(next + 1 < iterations ? runFamily(name, next + 1) : undefined));
      }, 250);
      worker.on("message", (m) => {
        if (m.type === "done") {
          violations.push(...m.violations);
          next = m.index + 1;
        } else if (m.type === "finished") {
          clearInterval(watchdog);
          violations.push(...m.violations);
          for (const line of m.known) console.error(line);
          console.error(`${name}: ${m.calls} calls, ${m.tableLimited} parameter sets past the table limit (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
          resolve(undefined);
        }
      });
      worker.on("error", (e) => {
        clearInterval(watchdog);
        violations.push({ family: name, property: "throws", call: "(worker)", detail: String(e) });
        resolve(next + 1 < iterations ? runFamily(name, next + 1) : undefined);
      });
    });

  const queue = [...families];
  const lanes = Array.from({ length: Math.min(availableParallelism(), queue.length) }, async () => {
    while (queue.length > 0) await runFamily(queue.shift(), 0);
  });
  await Promise.all(lanes);

  const counts = new Map();
  for (const v of violations) {
    const k = `${v.family} ${v.property}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const [k, n] of [...counts].sort()) console.error(`${n}\t${k}`);
  const json = JSON.stringify(violations, null, 1);
  if (out === undefined) console.log(json);
  else writeFileSync(out, json);
} else {
  const { name, seed, from, to, sizes, timeLimitMs, useKnown, shared } = workerData;
  const state = new Int32Array(shared, 0, 2);
  const text = new Uint8Array(shared, 8, TEXT_BYTES);
  const encoder = new TextEncoder();
  const family = distributionFamilies.find((f) => f.name === name);
  const mine = knownViolations.filter((k) => k.family === name);
  const exclude = (kind, x, pr, flags) => mine.some((k) => k.exclude?.(kind, x, pr, flags));
  // With --known, listed violations are counted by the index of their entry instead of being sent
  const known = new Map();
  const unknown = (vs) =>
    useKnown
      ? vs.filter((v) => {
          const i = mine.findIndex((k) => matchesKnown(k, v));
          if (i >= 0) known.set(i, (known.get(i) ?? 0) + 1);
          return i < 0;
        })
      : vs;
  const dist = await import("../dist/entries/distributions.js");
  // Before each call: its text into the shared buffer and a tick of the counter the watchdog reads
  const onCall = (call) => {
    const { written } = encoder.encodeInto(call, text);
    Atomics.store(state, 1, written);
    Atomics.add(state, 0, 1);
  };
  const runner = new FamilyRunner(dist, family, { onCall, timeLimitMs, ...(useKnown ? { exclude } : {}) });
  let reported = 0;
  for (let i = from; i < to; i++) {
    const r = generator(familySeed(seed, name, i));
    runner.runParamSet(family.params(r), r, sizes);
    parentPort.postMessage({ type: "done", index: i, violations: unknown(runner.violations.slice(reported)) });
    reported = runner.violations.length;
  }
  runner.checkOrder();
  parentPort.postMessage({
    type: "finished",
    calls: runner.calls,
    tableLimited: runner.tableLimited,
    violations: unknown(runner.violations.slice(reported)),
    known: [...known].map(([i, n]) => `${n}\t${name} known: ${mine[i].reason.slice(0, 80)}`),
  });
}

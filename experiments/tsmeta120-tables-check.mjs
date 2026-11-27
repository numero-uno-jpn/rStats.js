// tsmeta120-tables-check.mjs: candidate tables for tseries' adf.test and pp.test p-values against
// tsmeta120-tables.json (log 94). The candidates are Fuller's (1976) Tables 8.5.1 (n(rho - 1), with a trend) and 8.5.2
// (tau_tau), rows n = 25, 50, 100, 250, 500, infinity; columns p = 0.01, 0.025, 0.05, 0.10, 0.90, 0.95, 0.975, 0.99.
// p = interpolation over n (at N = n - 1; "infinity" coded as INF below), then over the statistic, clamped.
//   node experiments/tsmeta120-tables-check.mjs experiments/tsmeta120-tables.json
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); const col = (k) => d.cols.indexOf(k);
const P = [0.01, 0.025, 0.05, 0.1, 0.9, 0.95, 0.975, 0.99];
const TAU = [[-4.38, -3.95, -3.6, -3.24, -1.14, -0.8, -0.5, -0.15], [-4.15, -3.8, -3.5, -3.18, -1.19, -0.87, -0.58, -0.24], [-4.04, -3.73, -3.45, -3.15, -1.22, -0.9, -0.62, -0.28],
  [-3.99, -3.69, -3.43, -3.13, -1.23, -0.92, -0.64, -0.31], [-3.98, -3.68, -3.42, -3.13, -1.24, -0.93, -0.65, -0.32], [-3.96, -3.66, -3.41, -3.12, -1.25, -0.94, -0.66, -0.33]];
const RHO = [[-22.5, -19.9, -17.9, -15.6, -3.66, -2.51, -1.53, -0.43], [-25.7, -22.4, -19.8, -16.8, -3.71, -2.6, -1.66, -0.65], [-27.4, -23.6, -20.7, -17.5, -3.74, -2.62, -1.73, -0.75],
  [-28.4, -24.4, -21.3, -18, -3.75, -2.64, -1.78, -0.82], [-28.9, -24.8, -21.5, -18.1, -3.76, -2.65, -1.78, -0.84], [-29.5, -25.1, -21.8, -18.3, -3.77, -2.66, -1.79, -0.87]];
const approx = (xs, ys, x) => { if (x <= xs[0]) return ys[0]; if (x >= xs[xs.length - 1]) return ys[ys.length - 1]; let i = 0; while (xs[i + 1] < x) i++; return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]); };
const pOf = (tab, INF, N, stat) => { const ns = [25, 50, 100, 250, 500, INF]; const crit = P.map((_, j) => approx(ns, tab.map((r) => r[j]), N)); return approx(crit, P, stat); };
for (const INF of [1e4, 1e5, 1e6, 1e300]) for (const [s, p, tab, flip] of [["adf", "adf_p", TAU, false], ["adf", "adf_px", TAU, true], ["ppa", "ppa_p", RHO, false], ["ppt", "ppt_p", TAU, false]]) {
  const byN = {};
  for (const r of d.rows) { const N = r[0]; let v = pOf(tab, INF, N, r[col(s)]); if (flip) v = 1 - v; const e = Math.abs(v - r[col(p)]); byN[N] = Math.max(byN[N] ?? 0, e); }
  console.log(`INF=${INF} ${p}`, Object.entries(byN).map(([N, e]) => `${N}:${e.toExponential(1)}`).join(" "));
}

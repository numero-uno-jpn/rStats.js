// tsmeta120-tables-knots.mjs: the knots of tseries' piecewise linear p-values from tsmeta120-tables.json (log 94).
// For each N and test: sort the (statistic, p) pairs strictly inside R's p range, group consecutive pairs of equal
// slope into lines, and intersect neighbouring lines; prints each knot's statistic and p.
//   node experiments/tsmeta120-tables-knots.mjs experiments/tsmeta120-tables.json
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const col = (k) => d.cols.indexOf(k);
for (const [s, p] of [["adf", "adf_p"], ["adf", "adf_px"], ["ppt", "ppt_p"], ["ppa", "ppa_p"]]) {
  for (const N of [...new Set(d.rows.map((r) => r[0]))]) {
    const pts = d.rows.filter((r) => r[0] === N).map((r) => [r[col(s)], r[col(p)]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    const lo = Math.min(...pts.map((x) => x[1])), hi = Math.max(...pts.map((x) => x[1]));
    const q = pts.filter(([, b]) => b > lo + 1e-12 && b < hi - 1e-12).sort((a, b) => a[0] - b[0]);
    const lines = []; let cur = null;
    for (let i = 1; i < q.length; i++) {
      const ds = q[i][0] - q[i - 1][0]; if (ds < 1e-9) continue;
      const slope = (q[i][1] - q[i - 1][1]) / ds;
      if (cur && Math.abs(slope - cur.slope) <= 1e-6 * Math.abs(cur.slope)) { cur.n++; continue; }
      cur = { slope, a: q[i][1] - slope * q[i][0], n: 1 }; lines.push(cur);
    }
    const good = lines.filter((l) => l.n >= 2);
    const knots = [];
    for (let i = 1; i < good.length; i++) { const x = (good[i].a - good[i - 1].a) / (good[i - 1].slope - good[i].slope); knots.push(`${x.toFixed(4)}@${(good[i].a + good[i].slope * x).toFixed(4)}`); }
    console.log(`${p} N=${N} range=[${lo.toFixed(3)},${hi.toFixed(3)}] lines=${good.length} knots: ${knots.join(" ")}`);
  }
}

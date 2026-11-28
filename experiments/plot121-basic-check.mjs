// plot121-basic-check.mjs: candidate formulas (from the help pages) against R's output in plot121-basic.json.
//   node experiments/plot121-basic-check.mjs
// Prints the largest relative difference of each candidate. Uses the built rStats.js 1.20.0 (dist/) for qnorm,
// quantile, fivenum and sd.
import { readFileSync } from "node:fs";
import { qnorm, quantile, fivenum, sd, IQR, median } from "../dist/rstats.js";

const R = JSON.parse(readFileSync(new URL("./plot121-basic.json", import.meta.url), "utf8"));
const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
function rel(a, b) {
  a = arr(a); b = arr(b);
  if (a.length !== b.length) return `length ${a.length} vs ${b.length}`;
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] == null || b[i] == null) { if (a[i] !== b[i] && !(Number.isNaN(a[i]) && b[i] == null)) return `NA at ${i}`; continue; }
    const d = Math.abs(a[i] - b[i]) / Math.max(Math.abs(b[i]), 1e-300);
    if (!(a[i] === b[i])) m = Math.max(m, d);
  }
  return m;
}
const report = (label, v) => console.log(`${label.padEnd(44)} ${typeof v === "number" ? v.toExponential(2) : v}`);

// ppoints
const ppoints = (n, a = n <= 10 ? 3 / 8 : 1 / 2) => Array.from({ length: n }, (_, i) => (i + 1 - a) / (n + 1 - 2 * a));
for (const [k, v] of Object.entries(R.ppoints)) {
  report(`ppoints ${k} default`, rel(ppoints(v.n), v.default));
  report(`ppoints ${k} a=0`, rel(ppoints(v.n, 0), v.a0));
  report(`ppoints ${k} a=1`, v.n === 1 ? `R gives ${JSON.stringify(v.a1)}` : rel(ppoints(v.n, 1), v.a1));
}

// qqnorm: x = qnorm(ppoints(n))[rank by order, ties by first occurrence]
for (const [k, v] of Object.entries(R.qqnorm)) {
  const y = arr(v.y);
  const idx = y.map((_, i) => i).filter((i) => y[i] != null);
  const n = idx.length;
  const p = ppoints(n).map((q) => qnorm(q));
  const ord = [...idx].sort((i, j) => y[i] - y[j] || i - j);
  const x = new Array(y.length).fill(null);
  ord.forEach((i, r) => { x[i] = p[r]; });
  report(`qqnorm ${k} x`, rel(x, v.x));
  if (v.slope != null) {
    const yq = quantile(y, [0.25, 0.75]);
    const xq = [qnorm(0.25), qnorm(0.75)];
    const slope = (yq[1] - yq[0]) / (xq[1] - xq[0]);
    report(`qqline ${k} slope`, rel(slope, v.slope));
    report(`qqline ${k} intercept`, rel(yq[0] - slope * xq[0], v.intercept));
  }
}

// boxplot.stats
const samples = Object.fromEntries(Object.entries(R.qqnorm).map(([k, v]) => [k, arr(v.y)]));
for (const [k, v] of Object.entries(R.boxplot)) {
  const y = (v.y ? arr(v.y) : samples[v.sample]).filter((t) => t != null);
  const f = fivenum(y);
  const iqr = f[3] - f[1];
  const n = y.length;
  let stats = [...f], out = [];
  if (v.coef > 0) {
    const lo = f[1] - v.coef * iqr, hi = f[3] + v.coef * iqr;
    const inside = y.filter((t) => t >= lo && t <= hi);
    out = y.filter((t) => t < lo || t > hi);
    stats[0] = Math.min(...inside); stats[4] = Math.max(...inside);
  }
  const conf = [f[2] - 1.58 * iqr / Math.sqrt(n), f[2] + 1.58 * iqr / Math.sqrt(n)];
  report(`boxplot ${k} stats`, rel(stats, v.stats));
  report(`boxplot ${k} conf`, rel(conf, v.conf));
  report(`boxplot ${k} out`, rel(out, v.out));
  if (n !== v.n) report(`boxplot ${k} n`, `${n} vs ${v.n}`);
}

// bandwidths: nrd0 = 0.9 * min(sd, IQR/1.34) * n^-0.2, nrd = 1.06 * min(sd, IQR/1.34) * n^-0.2
for (const [k, v] of Object.entries(R.bw)) {
  const y = samples[k];
  const n = y.length;
  const s = n > 1 ? sd(y) : NaN;
  const h = IQR(y) / 1.34;
  let lo = Math.min(s, h);
  // candidate fall-backs (the help page only says "unless the quartiles coincide when a positive result will be
  // guaranteed"): sd, then |x[1]|, then 1
  if (!(lo > 0)) lo = (s > 0 ? s : null) ?? (Math.abs(y[0]) || 1);
  report(`bw.nrd0 ${k}`, typeof v.nrd0 === "string" ? `R: ${v.nrd0}` : rel(0.9 * lo * n ** -0.2, v.nrd0));
  const nrd = 1.06 * Math.min(s, h) * n ** -0.2;
  report(`bw.nrd ${k}`, typeof v.nrd === "string" ? `R: ${v.nrd}` : rel(nrd, v.nrd));
}

// boxplot(count ~ spray, plot = FALSE): the same stats per group
{
  const g = R.boxplotGroups;
  console.log("boxplot groups: names", g.names.join(","), "n", g.n.join(","), "out", g.out.join(","), "group", g.group.join(","));
}

// lowess (Cleveland 1979, JASA 74, 829-836; Cleveland 1981, The American Statistician 35, 54): candidate.
// Variants: the neighbour count ns from f n by floor or round; ties at the window's edge distance included.
function lowessCand(x0, y0, { f = 2 / 3, iter = 3, delta, nsRule = "floor" } = {}) {
  const ord = x0.map((_, i) => i).sort((i, j) => x0[i] - x0[j] || i - j);
  const x = ord.map((i) => x0[i]), y = ord.map((i) => y0[i]);
  const n = x.length;
  delta ??= 0.01 * (x[n - 1] - x[0]);
  const raw = f * n;
  let ns = nsRule === "floor" ? Math.floor(raw + 1e-5) : Math.round(raw);
  ns = Math.max(2, Math.min(n, ns));
  const ys = new Array(n).fill(0), rw = new Array(n).fill(1), res = new Array(n);
  const range = x[n - 1] - x[0];
  function fitAt(xs, nleft, nright, useRw) {
    const h = Math.max(xs - x[nleft], x[nright] - xs);
    const h9 = 0.999 * h, h1 = 0.001 * h;
    const w = new Array(n).fill(0);
    let a = 0, j = nleft;
    for (; j < n; j++) {
      const r = Math.abs(x[j] - xs);
      if (r <= h9) {
        w[j] = r <= h1 ? 1 : (1 - (r / h) ** 3) ** 3;
        if (useRw) w[j] *= rw[j];
        a += w[j];
      } else if (x[j] > xs) break;
    }
    const nrt = j - 1;
    if (a <= 0) return null;
    for (let k = nleft; k <= nrt; k++) w[k] /= a;
    if (h > 0) {
      let b = 0;
      for (let k = nleft; k <= nrt; k++) b += w[k] * x[k];
      let c = 0;
      for (let k = nleft; k <= nrt; k++) c += w[k] * (x[k] - b) ** 2;
      if (Math.sqrt(c) > 0.001 * range) {
        const bb = (xs - b) / c;
        for (let k = nleft; k <= nrt; k++) w[k] *= bb * (x[k] - b) + 1;
      }
    }
    let s = 0;
    for (let k = nleft; k <= nrt; k++) s += w[k] * y[k];
    return s;
  }
  for (let it = 0; it <= iter; it++) {
    let nleft = 0, nright = ns - 1, last = -1, i = 0;
    for (;;) {
      while (nright < n - 1) {
        const d1 = x[i] - x[nleft], d2 = x[nright + 1] - x[i];
        if (d1 <= d2) break;
        nleft++; nright++;
      }
      const v = fitAt(x[i], nleft, nright, it > 0);
      ys[i] = v ?? y[i];
      if (last < i - 1) {
        const den = x[i] - x[last];
        for (let j = last + 1; j < i; j++) {
          const alpha = (x[j] - x[last]) / den;
          ys[j] = alpha * ys[i] + (1 - alpha) * ys[last];
        }
      }
      last = i;
      const cut = x[last] + delta;
      for (i = last + 1; i < n; i++) {
        if (x[i] > cut) break;
        if (x[i] === x[last]) { ys[i] = ys[last]; last = i; }
      }
      i = Math.max(last + 1, i - 1);
      if (last >= n - 1) break;
    }
    for (let k = 0; k < n; k++) res[k] = y[k] - ys[k];
    if (it === iter) break;
    const ar = res.map(Math.abs);
    const cmad = 6 * median(ar);
    const meanAr = ar.reduce((s, t) => s + t, 0) / n;
    if (cmad < 1e-7 * meanAr) break;
    const c9 = 0.999 * cmad, c1 = 0.001 * cmad;
    for (let k = 0; k < n; k++) {
      const r = ar[k];
      rw[k] = r <= c1 ? 1 : r > c9 ? 0 : (1 - (r / cmad) ** 2) ** 2;
    }
  }
  return { x, y: ys };
}
for (const rule of ["floor", "round"]) {
  for (const [k, v] of Object.entries(R.lowess)) {
    const c = lowessCand(v.x, v.y, { f: v.f, iter: v.iter, delta: v.delta, nsRule: rule });
    report(`lowess[${rule}] ${k}`, Math.max(rel(c.x, v.ox), rel(c.y, v.oy)));
  }
}

// density: kernels with bw = the kernel's standard deviation (?density), candidate A = the exact sum at R's x,
// candidate B = linear binning of the mass on a grid over [lo, up] = [from - k bw, to + k bw] (k = 4, 3) with 2 m
// cells (m = max(n, 512) rounded up to a power of 2), circular convolution by FFT with the kernel evaluated at the
// grid's lags, then linear interpolation at R's x.
const KERNELS = {
  gaussian: (bw) => (t) => Math.exp(-0.5 * (t / bw) ** 2) / (bw * Math.sqrt(2 * Math.PI)),
  rectangular: (bw) => { const a = bw * Math.sqrt(3); return (t) => (Math.abs(t) < a ? 0.5 / a : 0); },
  triangular: (bw) => { const a = bw * Math.sqrt(6); return (t) => (Math.abs(t) < a ? (1 - Math.abs(t) / a) / a : 0); },
  epanechnikov: (bw) => { const a = bw * Math.sqrt(5); return (t) => (Math.abs(t) < a ? 0.75 * (1 - (t / a) ** 2) / a : 0); },
  biweight: (bw) => { const a = bw * Math.sqrt(7); return (t) => (Math.abs(t) < a ? 15 / 16 * (1 - (t / a) ** 2) ** 2 / a : 0); },
  cosine: (bw) => { const a = bw / Math.sqrt(1 / 3 - 2 / Math.PI ** 2); return (t) => (Math.abs(t) < a ? (1 + Math.cos(Math.PI * t / a)) / (2 * a) : 0); },
  optcosine: (bw) => { const a = bw / Math.sqrt(1 - 8 / Math.PI ** 2); return (t) => (Math.abs(t) < a ? Math.PI / 4 * Math.cos(Math.PI * t / (2 * a)) / a : 0); },
};
function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI / len) * (inverse ? 1 : -1);
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
    }
  }
}
function approxLin(gx, gy, xs) {
  const step = gx[1] - gx[0];
  return xs.map((t) => {
    const p = (t - gx[0]) / step, i = Math.min(Math.max(Math.floor(p), 0), gx.length - 2), u = p - i;
    return gy[i] * (1 - u) + gy[i + 1] * u;
  });
}
function densityB(xs, w, bw, kernel, from, to, nout, k4) {
  let m = Math.max(nout, 512);
  if (m > 512) m = 2 ** Math.ceil(Math.log2(m));
  const lo = from - k4 * bw, up = to + k4 * bw;
  const M = 2 * m;
  const y = new Array(M).fill(0);
  const xdelta = (up - lo) / (m - 1);
  for (let i = 0; i < xs.length; i++) {
    const p = (xs[i] - lo) / xdelta, ix = Math.floor(p), fx = p - ix;
    if (ix >= 0 && ix <= M - 2) { y[ix] += w[i] * (1 - fx); y[ix + 1] += w[i] * fx; }
    else if (ix === -1) y[0] += w[i] * fx;
    else if (ix === M - 1) y[ix] += w[i] * (1 - fx);
  }
  const K = KERNELS[kernel](bw);
  const kord = Array.from({ length: M }, (_, j) => K((j <= m ? j : j - M) * xdelta));
  const yr = [...y], yi = new Array(M).fill(0), kr = [...kord], ki = new Array(M).fill(0);
  fft(yr, yi, false); fft(kr, ki, false);
  const pr = yr.map((a, j) => a * kr[j] + yi[j] * ki[j]), pi = yr.map((a, j) => yi[j] * kr[j] - a * ki[j]);
  fft(pr, pi, true);
  const dens = pr.slice(0, m).map((v) => Math.max(0, v / M));
  const gx = Array.from({ length: m }, (_, j) => lo + j * xdelta);
  return approxLin(gx, dens, Array.from({ length: nout }, (_, j) => from + j * (to - from) / (nout - 1)));
}
// relative to the peak: the tails are 1e-300-small and FFT round-off there is absolute
const relPeak = (a, b) => Math.max(...a.map((t, i) => Math.abs(t - b[i]))) / Math.max(...b);
for (const [k, v] of Object.entries(R.density)) {
  const d = v.d ?? v;
  const xs = (v.d && v.y ? arr(v.y) : samples[v.sample]).filter((t) => t != null);
  const n = xs.length;
  const w = v.weights ?? new Array(n).fill(1 / n);
  const K = KERNELS[v.kernel](d.bw);
  const A = d.x.map((t) => xs.reduce((s, xi, i) => s + w[i] * K(t - xi), 0));
  const from = d.x[0], to = d.x[d.x.length - 1];
  const out = [`A ${relPeak(A, d.y).toExponential(1)}`];
  for (const k4 of [4, 3]) {
    const B = densityB(xs, w, d.bw, v.kernel, from, to, d.x.length, k4);
    out.push(`B${k4} ${relPeak(B, d.y).toExponential(1)}`);
  }
  console.log(`density ${k}`.padEnd(30), out.join("  "));
}

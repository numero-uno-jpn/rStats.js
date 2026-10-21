// Minimal hand-written SVG plots: line/step curves, bars, histograms. Colours come from CSS classes.

const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
}

/** "Nice" tick values covering [lo, hi]. */
export function niceTicks(lo, hi, count = 5) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return ticks;
}

function tickLabel(v) {
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(0).replace("e+", "e");
  return String(Number(v.toPrecision(6)));
}

/**
 * Draws a plot. series: [{ type: "line" | "step" | "bars" | "points", points: [[x, y]], className, width (bars) }].
 * Points with non-finite y break lines. Returns an <svg> element.
 */
export function plot({ series, xDomain, yDomain, title, xLabel, yLabel, markers = [], width = 520, height = 260, ariaLabel, testid }) {
  const m = { top: title ? 26 : 12, right: 14, bottom: xLabel ? 40 : 28, left: 52 };
  const W = width - m.left - m.right;
  const H = height - m.top - m.bottom;
  let [x0, x1] = xDomain;
  if (!(x1 > x0)) [x0, x1] = [x0 - 1, x0 + 1];
  let [y0, y1] = yDomain;
  if (!(y1 > y0)) [y0, y1] = [y0 - 0.5, y0 + 0.5];
  const sx = (x) => m.left + ((x - x0) / (x1 - x0)) * W;
  const sy = (y) => m.top + H - ((y - y0) / (y1 - y0)) * H;
  const clampY = (y) => Math.max(m.top - 2, Math.min(m.top + H + 2, sy(y)));

  const svg = el("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "plot",
    role: "img",
    "aria-label": ariaLabel ?? title ?? "plot",
    "data-testid": testid,
    preserveAspectRatio: "xMidYMid meet",
  });
  const clipId = `clip-${Math.random().toString(36).slice(2, 9)}`;
  const defs = el("defs");
  const clip = el("clipPath", { id: clipId });
  clip.append(el("rect", { x: m.left, y: m.top - 1, width: W, height: H + 2 }));
  defs.append(clip);
  svg.append(defs);

  if (title) svg.append(el("text", { x: m.left, y: 16, class: "plot-title" }, title));

  // grid and axes
  const gx = el("g", { class: "axis" });
  for (const v of niceTicks(x0, x1, Math.max(3, Math.round(W / 90)))) {
    const x = sx(v);
    gx.append(el("line", { x1: x, x2: x, y1: m.top, y2: m.top + H, class: "grid" }));
    gx.append(el("text", { x, y: m.top + H + 16, "text-anchor": "middle", class: "tick" }, tickLabel(v)));
  }
  for (const v of niceTicks(y0, y1, Math.max(3, Math.round(H / 50)))) {
    const y = sy(v);
    gx.append(el("line", { x1: m.left, x2: m.left + W, y1: y, y2: y, class: "grid" }));
    gx.append(el("text", { x: m.left - 6, y: y + 4, "text-anchor": "end", class: "tick" }, tickLabel(v)));
  }
  gx.append(el("rect", { x: m.left, y: m.top, width: W, height: H, class: "frame" }));
  if (xLabel) gx.append(el("text", { x: m.left + W / 2, y: height - 6, "text-anchor": "middle", class: "axis-label" }, xLabel));
  if (yLabel)
    gx.append(el("text", { x: 12, y: m.top + H / 2, "text-anchor": "middle", class: "axis-label", transform: `rotate(-90 12 ${m.top + H / 2})` }, yLabel));
  svg.append(gx);

  const g = el("g", { "clip-path": `url(#${clipId})` });
  for (const s of series) {
    const cls = s.className ?? "series-1";
    if (s.type === "bars") {
      const bw = Math.max(1, ((s.width ?? 1) / (x1 - x0)) * W);
      for (const [x, y] of s.points) {
        if (!Number.isFinite(y) || y <= y0) continue;
        const top = clampY(y);
        g.append(el("rect", { x: sx(x) - bw / 2, y: top, width: bw, height: Math.max(0, sy(y0) - top), class: `bar ${cls}` }));
      }
    } else if (s.type === "points") {
      for (const [x, y] of s.points) if (Number.isFinite(y)) g.append(el("circle", { cx: sx(x), cy: clampY(y), r: 3, class: `dot ${cls}` }));
    } else {
      let d = "";
      let pen = false;
      let prevY;
      for (const [x, y] of s.points) {
        if (!Number.isFinite(y)) {
          pen = false;
          continue;
        }
        const px = sx(x).toFixed(2);
        const py = clampY(y).toFixed(2);
        if (!pen) d += `M${px},${py}`;
        else if (s.type === "step") d += `H${px}V${py}`;
        else d += `L${px},${py}`;
        pen = true;
        prevY = py;
      }
      if (s.type === "step" && pen && prevY != null) d += `H${(m.left + W).toFixed(2)}`;
      if (d) g.append(el("path", { d, class: `curve ${cls}` }));
    }
  }
  for (const x of markers) {
    if (!Number.isFinite(x) || x < x0 || x > x1) continue;
    g.append(el("line", { x1: sx(x), x2: sx(x), y1: m.top, y2: m.top + H, class: "marker" }));
  }
  svg.append(g);
  return svg;
}

/** Bins values into a histogram over [lo, hi]. Returns { edges, counts, outside }. */
export function histogram(values, lo, hi, bins) {
  const counts = new Array(bins).fill(0);
  const w = (hi - lo) / bins;
  let outside = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < lo || v > hi) {
      outside++;
      continue;
    }
    counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++;
  }
  return { edges: Array.from({ length: bins + 1 }, (_, i) => lo + i * w), counts, outside, width: w };
}

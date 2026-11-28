// Loads the plotting libraries of the Plots tab from jsDelivr, once and only when needed: d3 and Observable Plot
// (UMD builds, which set window.d3 and window.Plot) when the tab opens, Plotly.js (about 1.4 MB gzipped) when it is
// first chosen. The versions are fixed; test/browser/demo.mjs answers these URLs with the files of node_modules.

export const LIBS = {
  d3: "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js",
  plot: "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.19/dist/plot.umd.min.js",
  plotly: "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@4.3.0/plotly.min.js",
};

const pending = new Map();

/** Adds a classic script once; resolves when it has run */
function loadScript(url) {
  if (!pending.has(url)) {
    pending.set(
      url,
      new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = url;
        s.async = true;
        s.crossOrigin = "anonymous";
        s.onload = () => resolve();
        s.onerror = () => {
          pending.delete(url);
          s.remove();
          reject(new Error(`could not load ${url}`));
        };
        document.head.append(s);
      }),
    );
  }
  return pending.get(url);
}

/** Observable Plot (with d3), or an error */
export async function loadObservablePlot() {
  if (window.Plot?.plot) return window.Plot;
  await loadScript(LIBS.d3);
  await loadScript(LIBS.plot);
  if (!window.Plot?.plot) throw new Error("Observable Plot did not load");
  return window.Plot;
}

/** Plotly.js, or an error */
export async function loadPlotly() {
  if (window.Plotly?.newPlot) return window.Plotly;
  await loadScript(LIBS.plotly);
  if (!window.Plotly?.newPlot) throw new Error("Plotly.js did not load");
  return window.Plotly;
}

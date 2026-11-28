// The demo's Plots tab (demo/plotFigures.js): every figure's plot data from every example dataset, and the values it
// shows against R (demo/plot-data.json from oracle/demoplots.R), computed with the sources as in the browser.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as main from "../src/index.js";
import * as mixed from "../src/entries/mixed.js";
import * as regression from "../src/entries/regression.js";
import * as multivariate from "../src/entries/multivariate.js";
import * as timeseries from "../src/entries/timeseries.js";
import * as causal from "../src/entries/causal.js";
import * as plot from "../src/entries/plot.js";
// @ts-expect-error: the demo's plain ES module has no types
import { FIGURES, exampleInput, runChecks } from "../demo/plotFigures.js";

const L = { ...main, ...mixed, ...regression, ...multivariate, ...timeseries, ...causal, ...plot };
const data = JSON.parse(readFileSync(new URL("../demo/plot-data.json", import.meta.url), "utf8"));

describe("demo plots against R", () => {
  for (const fig of FIGURES as any[]) {
    for (const ds of Object.keys(fig.datasets)) {
      it(`${fig.id} / ${ds}`, () => {
        const input = exampleInput(fig, data, ds);
        const pd = fig.compute(L, input);
        expect(Object.keys(pd.layers).length).toBeGreaterThan(0);
        const checks = runChecks(L, fig, pd, input, data, ds);
        expect(checks.length, "R values for this dataset").toBeGreaterThan(0);
        for (const c of checks) expect(c.ok, `${c.label}: worst ${c.worst}\n js ${c.js.slice(0, 8)}\n R  ${c.r.slice(0, 8)}`).toBe(true);
        const code = fig.code(input);
        for (const k of ["setup", "observable", "plotly"]) expect(typeof code[k]).toBe("string");
        // the code the tab shows parses (as in demo/plots.js, after the import lines)
        const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
        expect(() => new AsyncFunction(`${code.setup}\ndocument.body.append(${code.observable});`), "Observable Plot code").not.toThrow();
        expect(() => new AsyncFunction(`${code.setup}\n${code.plotly}`), "Plotly code").not.toThrow();
      });
    }
  }
  it("the example CSV of every figure gives plot data", () => {
    for (const fig of FIGURES as any[]) {
      const rows = main.toRows(parseCsv(fig.csv.example));
      const pd = fig.compute(L, fig.fromCsv(rows));
      expect(Object.keys(pd.layers).length, fig.id).toBeGreaterThan(0);
    }
  });
});

/** The CSV parser of the demo (demo/plots.js) for the test: header, commas, no quotes */
function parseCsv(text: string) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head!.split(",").map((c) => c.trim());
  const out: Record<string, (string | number)[]> = Object.fromEntries(cols.map((c) => [c, []]));
  for (const l of lines) {
    const v = l.split(",").map((c) => c.trim());
    cols.forEach((c, i) => {
      const t = v[i] ?? "";
      out[c]!.push(t !== "" && !Number.isNaN(Number(t)) ? Number(t) : t);
    });
  }
  return out;
}

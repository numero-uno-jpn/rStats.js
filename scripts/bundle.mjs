// Bundles the built dist/ for loading from a CDN with <script type="module">:
// - dist/rstats.js: everything in one minified ES module (one request instead of one per module)
// - dist/{distributions,tests,linalg,descriptive,numerics,special,mixed}.js: one minified module per area, sharing code
//   through dist/chunks/ (esbuild code splitting), so that a page loads only the areas it imports
//
//   npm run build   (runs tsc, then this script)

import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const { version } = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

const common = {
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2022",
  legalComments: "none",
  banner: {
    js: `/*! rStats.js ${version} | MIT License | includes code ported from SciPy, Boost.Math, statsmodels, LAPACK and others: see THIRD_PARTY_NOTICES.md at https://github.com/numero-uno-jpn/rStats.js */`,
  },
};

await build({
  ...common,
  entryPoints: [fileURLToPath(new URL("dist/index.js", root))],
  outfile: fileURLToPath(new URL("dist/rstats.js", root)),
});

/** The areas, as in src/entries/ (also the package's subpath exports) */
export const AREAS = ["distributions", "tests", "linalg", "descriptive", "numerics", "special", "mixed"];

await build({
  ...common,
  entryPoints: Object.fromEntries(AREAS.map((a) => [a, fileURLToPath(new URL(`dist/entries/${a}.js`, root))])),
  outdir: fileURLToPath(new URL("dist", root)),
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
});

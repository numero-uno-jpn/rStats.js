// Bundles the built dist/ into a single minified ES module, dist/rstats.js, for loading from a CDN
// with <script type="module"> (one request instead of one per module).
//
//   npm run build   (runs tsc, then this script)

import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const { version } = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

await build({
  entryPoints: [fileURLToPath(new URL("dist/index.js", root))],
  outfile: fileURLToPath(new URL("dist/rstats.js", root)),
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2022",
  legalComments: "none",
  banner: {
    js: `/*! rStats.js ${version} | MIT License | includes code ported from SciPy, Boost.Math, statsmodels, LAPACK and others: see THIRD_PARTY_NOTICES.md at https://github.com/numero-uno-jpn/rStats.js */`,
  },
});

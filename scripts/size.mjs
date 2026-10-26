// Measures the bundled size (minified and gzipped) for a set of representative imports, to check that tree-shaking
// works (only the functions used are included), and the size of each area (subpath export) on its own.
//
//   npm run build && node scripts/size.mjs

import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const cases = [
  ["pnorm", "pnorm"],
  ["pt, qt", "pt, qt"],
  ["qbeta", "qbeta"],
  ["setSeed, rnorm", "setSeed, rnorm"],
  ["tTest", "tTest"],
  ["fisherTest", "fisherTest"],
  ["wilcoxTest", "wilcoxTest"],
  ["solve", "solve"],
  ["svd", "svd"],
  ["eigen", "eigen"],
  ["glm, glmSummary", "glm, glmSummary"],
  ["glm with all its methods", "glm, glmSummary, glmResiduals, glmHatvalues, glmRstandard, glmCooksDistance, glmPredict, glmConfint, glmAnova"],
  ["everything", "*"],
];

const areas = ["distributions", "tests", "linalg", "descriptive", "numerics", "special", "mixed"];
for (const a of areas) cases.push([`rStats.js/${a} (all of it)`, "*", fileURLToPath(new URL(`../dist/entries/${a}.js`, import.meta.url))]);
const mixedEntry = fileURLToPath(new URL("../dist/entries/mixed.js", import.meta.url));
cases.push(["lmer (from /mixed)", "lmer", mixedEntry]);
cases.push(["lmer, lmerSummary, lmerContest, lmerAnova (from /mixed)", "lmer, lmerSummary, lmerContest, lmerAnova", mixedEntry]);

const rows = [];
for (const [label, names, from = dist] of cases) {
  const contents = names === "*" ? `export * from ${JSON.stringify(from)};` : `export { ${names} } from ${JSON.stringify(from)};`;
  const result = await build({
    stdin: { contents, resolveDir: process.cwd(), loader: "js" },
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    target: "es2022",
  });
  const code = result.outputFiles[0].contents;
  rows.push([label, code.length, gzipSync(code).length]);
}
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log("| import | minified | gzip |");
console.log("|---|---|---|");
for (const [label, min, gz] of rows) console.log(`| \`${label}\` | ${kb(min)} | ${kb(gz)} |`);

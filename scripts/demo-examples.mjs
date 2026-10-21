// Writes demo/examples.R (the R side of every demo example) from demo/examples.json.
// R's results for the demo (demo/r-results.json) are then produced by oracle/demo.R.
//
//   node scripts/demo-examples.mjs           write demo/examples.R
//   node scripts/demo-examples.mjs --check   exit 1 if demo/examples.R is out of date

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const jsonPath = fileURLToPath(new URL("../demo/examples.json", import.meta.url));
const rPath = fileURLToPath(new URL("../demo/examples.R", import.meta.url));

/** The R script for a list of examples (JSON string literals are valid R string literals here). */
export function renderR(examples) {
  const items = examples.map(
    (e) => `  list(id = ${JSON.stringify(e.id)}, title = ${JSON.stringify(e.title.en)},\n       value = function() ${e.r})`,
  );
  return `# rStats.js demo examples in R.
# Generated from demo/examples.json by scripts/demo-examples.mjs; do not edit by hand.
#
#   source("examples.R")
#
# prints every example's id, title and value with 17 significant digits. Each entry of
# \`examples\` is list(id, title, value), where value() computes the example's numbers.

examples <- list(
${items.join(",\n")}
)

if (!exists(".rstats_oracle")) {
  for (ex in examples) {
    cat(sprintf("%s: %s\\n", ex$id, ex$title))
    cat(" ", sprintf("%.17g", ex$value()), "\\n")
  }
}
`;
}

// Run only when invoked as a script (not when imported for renderR)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const expected = renderR(JSON.parse(readFileSync(jsonPath, "utf8")).examples);
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(rPath, "utf8");
    } catch {}
    if (current !== expected) {
      console.error("demo/examples.R is out of date; run node scripts/demo-examples.mjs");
      process.exit(1);
    }
  } else {
    writeFileSync(rPath, expected);
    console.log(`demo/examples.R: ${expected.match(/^ {2}list\(id/gm).length} examples`);
  }
}

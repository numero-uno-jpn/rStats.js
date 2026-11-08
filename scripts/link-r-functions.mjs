// Links the rStats.js names of the "R function -> rStats.js function" tables (docs/r-functions.html and
// docs/ja/r-functions.html, the Jekyll renders of the Markdown made by scripts/r-index.mjs) to their pages of the API
// reference, as post-processing of the finished Pages site:
//
//   node scripts/link-r-functions.mjs <siteDir>
//
// Why here and not in the generator: the API reference is built from the latest release tag, so it describes the
// version on npm, while the tables come from main. Only a function that exists in the published API gets a link (a
// function added since the release stays plain text until it is released), and the file names are taken from the pages
// themselves (the <h1> "Function <name>" of <siteDir>/api/functions/*.html), because TypeDoc's file names are not the
// function names (Anova is Anova-1.html, as anova takes Anova.html on case-insensitive file systems).
//
// Only the second cell of a table row, when it holds exactly one <code> element, is changed; running it twice changes
// nothing. The Japanese table links to the Japanese page (<siteDir>/ja/api/functions/) when it exists, otherwise to the
// English one. Exits with 1 if an input file is missing.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const siteDir = process.argv[2];
if (!siteDir) {
  console.error("usage: node scripts/link-r-functions.mjs <siteDir>");
  process.exit(1);
}

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

function fail(path) {
  console.error(`missing: ${path}`);
  process.exit(1);
}

// name -> file name, from the <h1> of every page of the directory
function functionPages(dir) {
  if (!existsSync(dir)) fail(dir);
  const map = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".html"))) {
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(readFileSync(join(dir, file), "utf8"));
    if (!h1) continue;
    const text = decode(h1[1].replace(/<[^>]*>/g, "")).trim();
    const m = /^Function\s+([^\s<(]+)/.exec(text); // "Function name" or "Function name<T>"
    if (m && !map.has(m[1])) map.set(m[1], file);
  }
  return map;
}

const pages = functionPages(join(siteDir, "api", "functions"));
const jaDir = join(siteDir, "ja", "api", "functions");

function link(path, hrefFor) {
  if (!existsSync(path)) fail(path);
  const html = readFileSync(path, "utf8");
  const missing = [];
  let linked = 0;
  // a row's first cell, then its second cell if that is exactly one <code> (an already wrapped cell starts with <a>)
  const out = html.replace(
    /(<tr>\s*<td>(?:(?!<\/td>)[\s\S])*<\/td>\s*)<td>(<code[^>]*>([^<]*)<\/code>)<\/td>/g,
    (all, head, code, rawName) => {
      const name = decode(rawName).trim();
      const file = pages.get(name);
      if (!file) {
        missing.push(name);
        return all;
      }
      linked++;
      return `${head}<td><a href="${hrefFor(file)}">${code}</a></td>`;
    },
  );
  if (out !== html) writeFileSync(path, out);
  const list = missing.length ? ` (${missing.join(", ")})` : "";
  console.log(`${path}: linked ${linked}, no page for ${missing.length}${list}`);
}

link(join(siteDir, "docs", "r-functions.html"), (file) => `../api/functions/${file}`);
link(join(siteDir, "docs", "ja", "r-functions.html"), (file) =>
  existsSync(join(jaDir, file)) ? `../../ja/api/functions/${file}` : `../../api/functions/${file}`,
);

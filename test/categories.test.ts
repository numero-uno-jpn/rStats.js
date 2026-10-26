// Every exported function, interface and type alias has exactly one `@category` tag from a fixed list, so that the
// TypeDoc API reference groups the exports by subject. A function carries it on the doc comment of its first
// overload (TypeDoc takes it from there); an option or result type carries the category of its function.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectFunctions } from "./helpers/docComments.js";

const root = fileURLToPath(new URL("..", import.meta.url));

/** The categories of the API reference, in no particular order (TypeDoc sorts them). */
const CATEGORIES = [
  "Special functions",
  "Distributions",
  "Random numbers",
  "Descriptive statistics",
  "Data frames",
  "Hypothesis tests",
  "Multiple comparisons",
  "Effect sizes and power",
  "Linear models and ANOVA",
  "Generalized linear models",
  "Mixed models",
  "Survival analysis",
  "Agreement, reliability and factor analysis",
  "Linear algebra",
  "Numerical methods",
];

/** The values of the `@category` tags of a doc comment (as returned by the helpers: no leading ` * `). */
function categories(comment: string): string[] {
  return [...comment.matchAll(/^@category[ \t]+(.*?)\s*$/gm)].map((m) => m[1]!);
}

/** The text of the doc comment directly above the first match of `decl` in `source`, or undefined. */
function commentAbove(source: string, decl: RegExp): string | undefined {
  const m = decl.exec(source);
  if (m === null) return undefined;
  const before = source.slice(0, m.index).trimEnd();
  if (!before.endsWith("*/")) return "";
  return before
    .slice(before.lastIndexOf("/**"))
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, ""))
    .join("\n")
    .trim();
}

/**
 * The doc comment of the declaration of the exported type `name` in `file`, following a re-export
 * (`import { type X } from "..."; export type { X };` or `export type { X } from "..."`) to the module that declares it.
 */
function typeComment(file: string, name: string, depth = 0): string {
  const source = readFileSync(file, "utf8");
  const comment = commentAbove(source, new RegExp(`^export (?:interface ${name}\\b|type ${name}\\b\\s*[<=])`, "m"));
  if (comment !== undefined) return comment;
  const imp = new RegExp(`^(?:import|export)\\s*(?:type\\s*)?\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*"([^"]+)"`, "m").exec(source);
  if (imp === null || depth > 3) throw new Error(`no declaration of type ${name} in ${file}`);
  return typeComment(resolve(file, "..", imp[1]!.replace(/\.js$/, ".ts")), name, depth + 1);
}

/** Every interface and type alias exported from src/entries/*.ts, with its doc comment. */
function collectTypes(): { name: string; comment: string }[] {
  const entriesDir = join(root, "src", "entries");
  const out: { name: string; comment: string }[] = [];
  for (const f of readdirSync(entriesDir).filter((f) => f.endsWith(".ts"))) {
    const text = readFileSync(join(entriesDir, f), "utf8");
    const re = /export\s+(type\s+)?\{([^}]*)\}\s*from\s*"([^"]+)"/g;
    for (let m = re.exec(text); m !== null; m = re.exec(text)) {
      const file = resolve(entriesDir, m[3]!.replace(/\.js$/, ".ts"));
      for (const raw of m[2]!.split(",")) {
        const item = raw.trim();
        if (item === "") continue;
        const isType = m[1] !== undefined || item.startsWith("type ");
        if (!isType) continue;
        const name = item.replace(/^type\s+/, "");
        out.push({ name, comment: typeComment(file, name) });
      }
    }
  }
  return out;
}

describe("@category in the doc comments", () => {
  const functions = collectFunctions(root);
  const types = collectTypes();

  it("every exported function has exactly one category from the list, on its first overload", () => {
    const problems: string[] = [];
    for (const f of functions) {
      const all = f.comments.flatMap(categories);
      if (all.length !== 1) problems.push(`${f.name}: ${all.length} @category tags`);
      else if (categories(f.comments[0] ?? "").length !== 1) problems.push(`${f.name}: @category not on the first overload`);
      for (const c of all) if (!CATEGORIES.includes(c)) problems.push(`${f.name}: unknown category "${c}"`);
    }
    expect(problems).toEqual([]);
    expect(functions.length).toBeGreaterThan(300);
  });

  it("every exported interface and type alias has exactly one category from the list", () => {
    const problems: string[] = [];
    for (const t of types) {
      const all = categories(t.comment);
      if (all.length !== 1) problems.push(`${t.name}: ${all.length} @category tags`);
      for (const c of all) if (!CATEGORIES.includes(c)) problems.push(`${t.name}: unknown category "${c}"`);
    }
    expect(problems).toEqual([]);
    expect(types.length).toBeGreaterThan(250);
  });

  it("every category has functions", () => {
    const used = new Set(functions.flatMap((f) => f.comments.flatMap(categories)));
    expect(CATEGORIES.filter((c) => !used.has(c))).toEqual([]);
  });

  it("finds missing, repeated and unknown tags", () => {
    expect(categories("Student's t-test.\n\n@category Hypothesis tests")).toEqual(["Hypothesis tests"]);
    expect(categories("A test.\n@param x A sample.")).toEqual([]);
    expect(categories("@category Distributions\n@category Random numbers")).toHaveLength(2);
    expect(CATEGORIES.includes(categories("@category Statistics")[0]!)).toBe(false);
  });
});

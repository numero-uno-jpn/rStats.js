// Builds the Japanese translation skeleton of the API reference (docs/ja/api/*.json) from the TSDoc comments in src/:
//
//   node scripts/api-ja-extract.mjs
//
// Runs TypeDoc 0.28.20 (the version of the "docs" script in package.json) with --json into a temporary directory and
// reads the categories of typedoc.json. Every comment of a category's reflections, and of their descendants (members,
// signatures, parameters, type literal members), goes into docs/ja/api/<slug>.json, one file per category (slug: the
// category name in lowercase, runs of other characters → "-"). Reflections outside every category go to other.json.
//
// File format: one object per file, keys sorted, 2-space indent, UTF-8.
//   "<qualified path>#<part>": { "hash": "<12 hex>", "en": "<English, code blocks as placeholders>", "ja": "", "stale": true }
// - qualified path: names joined with "." from the top-level reflection (TTestOptions.alternative). The signatures of a
//   function have the path of the function; with several signatures, (0), (1), ... are appended (pnorm(1)).
// - part: "summary" for the comment text, "@param <name>" and "@typeParam <name>" for parameters and type parameters,
//   and the block tag name ("@returns", "@example", ...). A block tag that occurs more than once gets [0], [1], ...
// - hash: first 12 hex characters of the SHA-256 of "en". "ja" is never written by this script except as kept from
//   the previous run. "stale" is set when "en" changed while "ja" was not empty.
// - Entries with empty text are not written. Inline code spans stay as they are. Fenced code blocks are replaced
//   with ⟦code1⟧, ⟦code2⟧, ... (numbered per entry).
// - Not collected: inherited members (TypeDoc's inheritedFrom; their comment is the parent's, so the translation of
//   the parent is reused when the skeleton is filled in), and the @category block tag (a category name, not prose).
//
// Re-running is idempotent: an existing entry with the same hash is kept as it is; keys that no longer exist are
// removed. Duplicate keys stop the script with the key in the message.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs", "ja", "api");
const FENCED_CODE = /```[\s\S]*?```/g;
const PLACEHOLDER = /⟦code\d+⟧/g;

const tmp = mkdtempSync(join(tmpdir(), "rstats-ja-api-"));
try {
  main(tmp);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

function main(tmpDir) {
  const project = runTypeDoc(tmpDir);
  const symbols = project.symbolIdMap;
  const byId = new Map(project.children.map((r) => [r.id, r]));

  const groups = project.categories.map((c) => ({
    slug: slugOf(c.title),
    reflections: c.children.map((id) => {
      const r = byId.get(id);
      if (!r) throw new Error(`category "${c.title}" refers to unknown reflection ${id}`);
      return r;
    }),
  }));
  const categorized = new Set(groups.flatMap((g) => g.reflections.map((r) => r.id)));
  const other = project.children.filter((r) => !categorized.has(r.id));
  if (other.length > 0) groups.push({ slug: "other", reflections: other });

  const slugs = new Set();
  for (const g of groups) {
    if (slugs.has(g.slug)) throw new Error(`two categories have the slug "${g.slug}"`);
    slugs.add(g.slug);
  }

  // Collect every comment of every group. All keys are checked against one map, so a collision in any file stops.
  const collected = new Map(); // key -> { group, text }
  for (const g of groups) {
    const ctx = {
      symbols,
      add(key, text) {
        if (collected.has(key)) throw new Error(`duplicate key: ${key}`);
        collected.set(key, { group: g.slug, text });
      },
    };
    for (const r of g.reflections) walkNode(r, r.name, ctx);
  }

  mkdirSync(outDir, { recursive: true });
  const rows = [];
  for (const g of groups) {
    const next = new Map();
    for (const [key, { group, text }] of collected) {
      if (group !== g.slug || text === "") continue;
      const { en, placeholders } = placeholderize(text);
      next.set(key, { en, placeholders, hash: hashOf(en) });
    }
    const file = join(outDir, `${g.slug}.json`);
    const previous = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
    const merged = mergeEntries(previous, next);
    if (Object.keys(merged).length === 0 && !existsSync(file)) continue;
    const body = JSON.stringify(merged, null, 2) + "\n";
    if (!existsSync(file) || readFileSync(file, "utf8") !== body) writeFileSync(file, body, "utf8");
    rows.push({ slug: g.slug, entries: merged });
  }

  console.log(`${"file".padEnd(48)} ${"entries".padStart(8)} ${"untranslated".padStart(13)} ${"stale".padStart(7)} ${"placeholders".padStart(13)}`);
  const total = { entries: 0, untranslated: 0, stale: 0, placeholders: 0 };
  for (const { slug, entries } of rows) {
    const c = countOf(entries);
    for (const k of Object.keys(total)) total[k] += c[k];
    console.log(`${(slug + ".json").padEnd(48)} ${String(c.entries).padStart(8)} ${String(c.untranslated).padStart(13)} ${String(c.stale).padStart(7)} ${String(c.placeholders).padStart(13)}`);
  }
  console.log(`${"total".padEnd(48)} ${String(total.entries).padStart(8)} ${String(total.untranslated).padStart(13)} ${String(total.stale).padStart(7)} ${String(total.placeholders).padStart(13)}`);
}

function runTypeDoc(tmpDir) {
  const json = join(tmpDir, "api.json");
  const site = join(tmpDir, "site");
  const r = spawnSync("npx", ["--yes", "typedoc@0.28.20", "--json", json, "--out", site], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`typedoc failed (exit ${r.status})\n${r.stdout}${r.stderr}`);
  return JSON.parse(readFileSync(json, "utf8"));
}

function slugOf(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function hashOf(text) {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12);
}

// Replaces each fenced code block with a numbered placeholder.
function placeholderize(text) {
  let n = 0;
  const en = text.replace(FENCED_CODE, () => `⟦code${++n}⟧`);
  return { en, placeholders: n };
}

// Keeps ja and the stale flag of entries whose hash did not change; takes the new en when it did.
function mergeEntries(previous, next) {
  const out = {};
  for (const key of [...next.keys()].sort()) {
    const { en, hash } = next.get(key);
    const old = previous[key];
    if (!old) {
      out[key] = { hash, en, ja: "" };
    } else if (old.hash === hash) {
      out[key] = { hash, en: old.en, ja: old.ja, ...(old.stale === true ? { stale: true } : {}) };
    } else {
      const ja = old.ja ?? "";
      out[key] = { hash, en, ja, ...(ja !== "" ? { stale: true } : {}) };
    }
  }
  return out;
}

function countOf(entries) {
  const c = { entries: 0, untranslated: 0, stale: 0, placeholders: 0 };
  for (const e of Object.values(entries)) {
    c.entries++;
    if (e.ja === "") c.untranslated++;
    if (e.stale === true) c.stale++;
    c.placeholders += (e.en.match(PLACEHOLDER) ?? []).length;
  }
  return c;
}

// A reflection and its descendants. The comment of the reflection is keyed by its own path.
function walkNode(node, path, ctx) {
  if (node.inheritedFrom) return;
  emitComment(ctx, path, "summary", node.comment);
  walkMembers(node, path, ctx);
}

function walkMembers(node, path, ctx) {
  for (const child of node.children ?? []) walkNode(child, `${path}.${child.name}`, ctx);
  const sigs = node.signatures ?? [];
  sigs.forEach((sig, i) => walkSignature(sig, sigs.length > 1 ? `${path}(${i})` : path, ctx));
  for (const sig of [node.getSignature, node.setSignature]) if (sig) walkSignature(sig, path, ctx);
  if (node.type?.type === "reflection" && node.type.declaration) walkNode(node.type.declaration, path, ctx);
}

function walkSignature(sig, path, ctx) {
  emitComment(ctx, path, "summary", sig.comment);
  for (const tp of sig.typeParameters ?? []) emitComment(ctx, path, `@typeParam ${tp.name}`, tp.comment);
  for (const p of sig.parameters ?? []) {
    emitComment(ctx, path, `@param ${p.name}`, p.comment);
    walkMembers(p, `${path}.${p.name}`, ctx);
  }
  if (sig.type?.type === "reflection" && sig.type.declaration) walkNode(sig.type.declaration, path, ctx);
}

function emitComment(ctx, base, summaryPart, comment) {
  if (!comment) return;
  const parts = [[summaryPart, render(comment.summary, ctx.symbols)]];
  const tags = (comment.blockTags ?? []).filter((t) => t.tag !== "@category");
  const count = new Map();
  for (const t of tags) count.set(t.tag, (count.get(t.tag) ?? 0) + 1);
  const seen = new Map();
  for (const t of tags) {
    let part = t.tag;
    if (count.get(t.tag) > 1) {
      const n = seen.get(t.tag) ?? 0;
      seen.set(t.tag, n + 1);
      part = `${t.tag}[${n}]`;
    }
    parts.push([part, render(t.content, ctx.symbols)]);
  }
  for (const [part, text] of parts) ctx.add(`${base}#${part}`, text);
}

// Joins the display parts back into TSDoc text. {@link X} and {@link X | text} are rebuilt from the target's name.
function render(parts, symbols) {
  return (parts ?? [])
    .map((p) => {
      if (p.kind !== "inline-tag") return p.text;
      const target = p.target !== undefined ? symbols[p.target]?.qualifiedName : undefined;
      if (p.tag === "@link" && target !== undefined) {
        return p.text === target ? `{@link ${target}}` : `{@link ${target} | ${p.text}}`;
      }
      return p.text ? `{${p.tag} ${p.text}}` : `{${p.tag}}`;
    })
    .join("")
    .trim();
}

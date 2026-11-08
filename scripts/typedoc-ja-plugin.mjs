// TypeDoc plugin that builds the Japanese API reference: it replaces the English TSDoc comments with the translations
// in docs/ja/api/*.json (made by api-ja-extract.mjs) and renames the categories. No dependencies; the TypeDoc event
// names are written as strings, so the plugin also works when TypeDoc comes from npx and not from node_modules.
//
//   RSTATS_JA_DIR=docs/ja/api npx --yes typedoc@0.28.20 --plugin ./scripts/typedoc-ja-plugin.mjs --lang ja \
//     --readme docs/ja/api-reference.md --out <dir>
//
// RSTATS_JA_DIR (required) is the directory with the translation files. Other TypeDoc options come from typedoc.json
// of the working directory, so run it from the repository (or the release worktree), as for the English build.
//
// How it works. After TypeDoc has converted the project and resolved its links (Converter "resolveEnd", priority below
// the link resolver at -300), the project is serialized and walked with api-ja-keys.mjs, which gives every comment its
// key and the English text as it is now. A translation replaces the comment only if its stored hash equals the hash of
// that English, its "ja" is not empty and it is not marked stale; otherwise the English stays and the key is reported.
// Members that TypeDoc inherits (inheritedFrom) are filled from the parent's key, except those whose source is not a
// reflection of the project (e.g. a non-exported interface): api-ja-keys.mjs gives them their own key and they are
// replaced like any other comment, with no parent lookup. The display parts of a comment are
// rebuilt from "ja": ⟦codeN⟧ becomes the original fenced code block, each {@link ...} reuses the original inline tag
// part (so its resolved target stays), the rest is text. Because the translations keep the English line breaks, a
// single line break inside prose is removed between two Japanese characters and becomes a space otherwise; code, inline
// code spans, paragraph breaks and the start of Markdown blocks (list items, headings, tables, quotes) are untouched.
//
// The category titles are renamed last (CATEGORY_NAMES); their order is the one of typedoc.json's categoryOrder.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FENCED_CODE, hashOf, placeholderize, walkNode } from "./api-ja-keys.mjs";

const CATEGORY_NAMES = {
  "Distributions": "分布",
  "Random numbers": "乱数",
  "Descriptive statistics": "記述統計",
  "Data frames": "データフレーム",
  "Hypothesis tests": "仮説検定",
  "Multiple comparisons": "多重比較",
  "Effect sizes and power": "効果量と検出力",
  "Linear models and ANOVA": "線形モデルと分散分析",
  "Generalized linear models": "一般化線形モデル",
  "Mixed models": "混合モデル",
  "Survival analysis": "生存時間解析",
  "Agreement, reliability and factor analysis": "一致度・信頼性・因子分析",
  "Linear algebra": "線形代数",
  "Numerical methods": "数値計算",
  "Special functions": "特殊関数",
};

export function load(app) {
  const dir = process.env.RSTATS_JA_DIR;
  if (!dir) throw new Error("typedoc-ja-plugin: set RSTATS_JA_DIR to the directory with the translations (docs/ja/api)");
  const translations = readTranslations(dir);
  // -400: after the link resolver (-300) and the category plugin (-200).
  app.converter.on("resolveEnd", (context) => translate(app, context.project, translations), -400);
}

function readTranslations(dir) {
  const all = new Map();
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const entries = JSON.parse(readFileSync(join(dir, name), "utf8"));
    for (const [key, entry] of Object.entries(entries)) {
      if (all.has(key)) throw new Error(`typedoc-ja-plugin: duplicate key ${key} (${name})`);
      all.set(key, entry);
    }
  }
  return all;
}

function translate(app, project, translations) {
  const json = app.serializer.projectToObject(project, process.cwd());
  const own = new Map();
  const inherited = [];
  const ctx = {
    symbols: json.symbolIdMap,
    add(key, text, loc, isInherited) {
      if (text === "") return;
      if (isInherited) {
        inherited.push({ key, text, loc });
        return;
      }
      if (own.has(key)) throw new Error(`typedoc-ja-plugin: duplicate key ${key}`);
      own.set(key, { text, loc });
    },
  };
  for (const r of json.children ?? []) walkNode(r, r.name, ctx);

  // Decide first, mutate afterwards: inherited comments may share their parts with the parent's.
  const jobs = [];
  const kept = [];
  const keptInherited = [];
  const consider = (key, text, loc, list, isInherited) => {
    const { en } = placeholderize(text);
    const entry = translations.get(key);
    if (!entry || entry.hash !== hashOf(en) || !entry.ja || entry.stale === true) {
      list.push(key);
      return;
    }
    const comment = project.getReflectionById(loc.id)?.comment;
    const target = comment === undefined ? undefined : loc.tagIndex === undefined ? comment.summary : comment.blockTags[loc.tagIndex]?.content;
    if (target === undefined) {
      list.push(`${key} (no comment)`);
      return;
    }
    const parts = buildParts(entry.ja, [...target]);
    if (typeof parts === "string") {
      list.push(`${key} (${parts})`);
      return;
    }
    jobs.push({ comment, tagIndex: loc.tagIndex, parts, isInherited });
  };
  for (const [key, { text, loc }] of own) consider(key, text, loc, kept, false);
  for (const { key, text, loc } of inherited) consider(key, text, loc, keptInherited, true);

  let replaced = 0;
  let filled = 0;
  for (const { comment, tagIndex, parts, isInherited } of jobs) {
    if (tagIndex === undefined) comment.summary = parts;
    else comment.blockTags[tagIndex].content = parts;
    if (isInherited) filled++;
    else replaced++;
  }

  app.logger.info(`typedoc-ja-plugin: replaced ${replaced}, inherited filled ${filled}, kept English ${kept.length} (inherited: ${keptInherited.length})`);
  for (const [label, list] of [["kept English", kept], ["kept English (inherited)", keptInherited]]) {
    if (list.length > 0) app.logger.info(`typedoc-ja-plugin: ${label}: ${list.slice(0, 10).join(", ")}${list.length > 10 ? ", ..." : ""}`);
  }

  renameCategories(project);
}

function renameCategories(project) {
  const seen = new Set();
  const rename = (cats) => {
    for (const c of cats ?? []) {
      if (seen.has(c)) continue;
      seen.add(c);
      c.title = CATEGORY_NAMES[c.title] ?? c.title;
    }
  };
  rename(project.categories);
  for (const r of Object.values(project.reflections)) {
    rename(r.categories);
    for (const g of r.groups ?? []) rename(g.categories);
  }
}

const INLINE_PARTS = /⟦code(\d+)⟧|(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\2(?!`)|\{@[A-Za-z]+[^}]*\}/g;

// The display parts for a translated text, or a string saying why they cannot be built.
function buildParts(ja, original) {
  const blocks = original.map((p) => (p.kind === "inline-tag" ? "" : p.text)).join("").match(FENCED_CODE) ?? [];
  const tags = original.filter((p) => p.kind === "inline-tag");
  const parts = [];
  const pushText = (text) => {
    if (text !== "") parts.push({ kind: "text", text });
  };
  const joined = joinLines(ja);
  let last = 0;
  let tagIndex = 0;
  for (const m of joined.matchAll(INLINE_PARTS)) {
    pushText(m.input.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1] !== undefined) {
      const block = blocks[Number(m[1]) - 1];
      if (block === undefined) return `code block ${m[1]} missing`;
      parts.push({ kind: "code", text: block });
    } else if (m[2] !== undefined) {
      parts.push({ kind: "code", text: m[0] });
    } else {
      const tag = tags[tagIndex++];
      if (tag === undefined || !m[0].startsWith(`{${tag.tag}`)) return "inline tags differ";
      parts.push(tag);
    }
  }
  pushText(joined.slice(last));
  if (tagIndex !== tags.length) return "inline tags differ";
  return parts;
}

const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;
// No space after fullwidth sentence punctuation or a closing bracket, even before Latin text or an inline code span.
const AFTER_PUNCT = /[。、，．！？：；）」』】〕]/;
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s/;
const BLOCK_START = /^\s*(#|>|\||⟦code)/;

// Removes the line breaks the translation inherited from the English: a single "\n" between two CJK characters goes,
// any other single "\n" becomes a space. Kept as they are: paragraph breaks, breaks around fenced code placeholders,
// headings, table rows, quotes and list items, and hard breaks (two trailing spaces). An indented continuation line
// (of a list item, or of a tag such as @throws) is joined to the line before it, without its indentation.
function joinLines(ja) {
  // Same text with code spans, placeholders and inline tags masked, so that their content is not looked at.
  const masked = ja.replace(INLINE_PARTS, (s) => s.replace(/[^\n]/g, "a"));
  // Offsets of the line breaks inside a masked span (an inline code span may run over lines): those stay.
  const inside = new Set();
  for (const m of ja.matchAll(INLINE_PARTS)) {
    for (let k = m.index; k < m.index + m[0].length; k++) if (ja[k] === "\n") inside.add(k);
  }
  const lines = ja.split("\n");
  const mlines = masked.split("\n");
  let out = lines[0];
  let offset = lines[0].length; // offset in ja of the line break before line i
  for (let i = 1; i < lines.length; i++) {
    const cur = lines[i - 1];
    const next = lines[i];
    const mcur = mlines[i - 1];
    const mnext = mlines[i];
    const blank = cur.trim() === "" || next.trim() === "";
    const isItem = LIST_ITEM.test(next);
    const keep =
      inside.has(offset) ||
      blank ||
      isItem ||
      BLOCK_START.test(next) ||
      /^\s*(#|\|)/.test(cur) ||
      /⟦code\d+⟧\s*$/.test(cur) ||
      / {2,}$/.test(cur);
    if (keep) {
      out += "\n" + next;
    } else {
      const left = mcur.trimEnd().slice(-1);
      const right = mnext.trimStart()[0];
      const glue = (CJK.test(left) && CJK.test(right)) || AFTER_PUNCT.test(left) ? "" : " ";
      out = out.trimEnd() + glue + next.trimStart();
    }
    offset += 1 + next.length;
  }
  return out;
}

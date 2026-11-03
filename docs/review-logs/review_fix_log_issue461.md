# Issue #461 log: Unicode names in formulas

GitHub Issue #461. Session 13, group A4 (model formulas and lm); decided by the user in group B.

## Plan

- User decision (2026-11-03): option a. A name starts with `[\p{L}\p{Nl}.]` or a non-ASCII `\p{Nd}`, and goes on with `[\p{L}\p{Nl}\p{Nd}\p{M}._]` (regex with the `u` flag). The rejection of a leading `_` and the rule "`.` followed by a digit is a number" stay. It is wider than R on Windows, so the docs say so.
- Intent: the formula tokenizer read names as ASCII `[A-Za-z.][A-Za-z0-9._]*` and has no backquotes, so a column such as `転帰` could not be named in a formula (`lm("転帰 ~ 年齢", ...)` was "invalid formula: unexpected '転'"). R accepts such names unquoted.
- Why this option: R's own classes are not a Unicode property and differ between platforms (below). Option a accepts every name Windows R accepts, also names in scripts with combining marks (as R on Linux), and no symbol or punctuation joins a name, so the tokens around a name do not change. The alternatives were Windows R's classes exactly (no marks, BMP only: Hindi or Thai column names unusable) and backquoted names (a larger change).

## Check (main `df27eab`, R 4.5.2 on Windows, locale Japanese_Japan.utf8)

- `lm(転帰 ~ 年齢, d)` with 転帰 0 1 0 1, 年齢 20 30 40 50: coefficients `-0x1.99999999999a4p-3 0x1.47ae147ae147dp-6` (−0.2, 0.02). rStats.js before: "invalid formula: unexpected '転'"; after: the same coefficients.
- `lm(y ~ ١a + Ⅰb, d2)` (y 1 3 2 5, ١a 1 2 3 4, Ⅰb 2 1 4 3): `0x1.cp-1 0x1.9fffffffffffep+0 -0x1.bfffffffffffdp-1`; after: the same to 1e-13.
- Which characters R takes in a name, as the first character (`parse(text = "<c>x")` gives the one symbol) and after the first (`x<c>`); `make.names` agrees with the parser in every row:

| character | category | first | after | rStats.js now |
|---|---|---|---|---|
| 転 U+8EE2, あ U+3042, ア U+30A2, α, é U+00E9, À, ß, ǅ, ẞ, ª, µ, א, ا, 가, ᄀ U+1100, ก U+0E01, Ⰰ U+2C00 | L (BMP) | yes | yes | yes, yes |
| ー U+30FC, 々 U+3005, ʰ U+02B0 | Lm | yes | yes | yes, yes |
| Ⅰ U+2160, 〇 U+3007, ᛮ U+16EE | Nl | yes | yes | yes, yes |
| ١ U+0661, १ U+0966, １ U+FF11 | Nd (not ASCII) | yes | yes | yes, yes |
| U+0301, U+0300, U+0345 (combining), ั U+0E31, U+064B, ः U+0903 | Mn / Mc | no | no | no, **yes** |
| ₁, ², ½, ⁰ | No | no | no | no, no |
| 𝐀 U+1D400 (Lu), 𠀀 U+20000 (Lo) | L outside the BMP | no | no | **yes, yes** |
| ・ U+30FB, ＿ U+FF3F, ·, ℃, ℘, ℮, ゛ U+309B, emoji, U+200D, U+FE0F, U+E000 | other | no | no | no, no |
| `_a` | | parse error | | error (unchanged) |

- Why R's classes are not a Unicode property: on Windows (and macOS) R uses its own tables for `iswalpha`/`iswalnum` (wchar_t is 16 bits on Windows, so characters outside the BMP never match); on Linux it uses glibc's, whose `alpha` class includes the combining marks of Indic and other scripts and the non-ASCII digits. So `नमस्ते` (with U+094D, U+0947) is a name in R on Linux but a parse error in R on Windows. (The Linux side is from the R and glibc sources, not run here.)

## Fix

- `src/models/formula.ts`: the tokenizer reads a name with `NAME` (the classes above). The number check (an ASCII digit, or `.` and an ASCII digit) runs first, as before.
- `docs/differences-from-r.md` and `docs/ja/`: the formula item states the name rule and that it is wider than R on Windows.

## Tests

- `test/issue461.test.ts`: the two R fits above, combining marks and characters outside the BMP (`modelMatrix` column names), and the errors kept (`_a`, `・`, `²`). With `src/` stashed, the three new-name tests fail.
- `formulaTests`, `modelMatrix`, `lmerTerms`, `lm`, `aovStrata`, `glm`, `issue453`, `issue457`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- Backquoted names (option c of the pending decision).
- Two other name patterns stay ASCII: the left-hand side of `aggregate`'s formula (`src/data/grouping.ts`, `aggregateFormula`: `y` or `cbind(...)`; its right-hand side goes through `parseFormula` and takes the new names) and `Pair(a, b)` of the two-sample tests' formulas (`src/htest/testFormula.ts`, `PAIR`). Not changed here (beyond the formula tokenizer of the decision); a candidate to share `NAME`.
- The error for a character outside the BMP that is not a name character (an emoji) shows only its first UTF-16 unit (a lone surrogate).

## close comment

Fixed in <commit of #461, see git log --grep='#461'>. Formula names may now use Unicode: a name starts with a letter, a letter number, `.` or a non-ASCII digit, and goes on with letters, numbers (not symbols such as ²), combining marks, `.` and `_`. `lm("転帰 ~ 年齢", ...)` now gives coefficients −0.2, 0.02 (R 4.5.2: the same). A leading `_` and `.` followed by an ASCII digit (a number) are unchanged. The rule is a little wider than R on Windows, which takes no combining marks and no characters outside the BMP (R on Linux takes both); this is recorded in the docs. Backquoted names are still not supported. A test has been added. (Not pushed yet.)

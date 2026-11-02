# Issue #44 対応ログ: 数値と文字列が混ざった群のラベル

GitHub Issue #44 (と、そのコメントの pairwise の `byLevel`)。計画は承認済み。

## 再現 (main `3b068e1`、R 4.5.2)

`x = [1, 2, 10, 11, 20, 21, 30, 31]`、`g = [2, 2, "2", "2", 10, 10, "10", "10"]`。R では `c(2, 2, "2", ...)` が文字列に強制され、`factor` の水準は "10", "2" の 2 つ。

| | 修正前 | 修正後 | R 4.5.2 |
|---|---|---|---|
| 群のラベル | "2", "10", "10", "2" (4 群) | "10", "2" | "10", "2" |
| onewayTest の F、df、p | 392.29、(3, 2.222)、0.00145 | 24.934426229508198、(1, 5.936011816838997)、0.0025455036130638074 | 24.9344262295081975、(1, 5.936011816838997)、0.0025455036130638060 |
| kruskalTest | 6.667、df 3 | 5.333333333333336、df 1 | 5.3333333333333357、df 1 |
| pairwiseTTest | 3×3 の表 (行名 "10", "10", "2") | 1×1、p 0.002468422812278048 | 1×1、p 0.0024684228122780487 |
| ラベル `[1e15, "1e+15", "a"]` (混ざったもの) | 別の群 | "1e+15", "a" | "1e+15", "a" (kruskal 3.428571428571427) |
| ラベル U+10000 と U+E000 | U+10000 が先 (UTF-16 の順) | U+E000 が先 | (C ロケールのコードポイントの順) |

R に合わせる修正で、docs は変更しない。

## 原因と修正

`labelledGroups` (`src/htest/groups.ts`) と `byLevel` (`src/htest/pairwise.ts`) は、ラベルを元の型のまま Map のキーにしていた。並べ替えも `String(a) < String(b)` で、UTF-16 のコード単位の順 (#42 と同じ)。

groups.ts に 2 つの関数を置き、両方で使うようにした。
- `factorLabels`: `numberLevels` (15 桁の文字が同じ数値を 1 つにする) のあと、文字列のラベルが 1 つでもあれば、NaN 以外の数値を `levelText` (R の as.character と同じ 15 桁) で文字列にする。NaN は今と同じく欠測のまま (R の `c(NaN, "a")` では "NaN" という水準になるが、ライブラリでは NaN を欠測として扱う)
- `compareLabels`: どちらも数値なら数値の順、そうでなければ `compareCodePoints` (`src/models/modelFrame.ts`)

ラベルがすべて数値か、すべて文字列 (U+E000 未満の BMP だけ) なら、群と順は今と同じ。

## テスト

- `test/issue44.test.ts`: 上の表の値 (R の値を期待値に)、1e15 と "1e+15"、コードポイントの順 (labelledGroups と pairwise)、数値だけのラベルと NaN のラベルは今と同じ
- stash で、修正前に 3 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2343 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外 (記録だけ)

群のラベルを `numberLevels` で扱うほかの箇所 (`src/descriptive/table.ts`、`src/htest/mcnemarTest.ts`、`src/htest/polycor.ts`、`src/data/grouping.ts`、`src/htest/agreement.ts`) で、混ざった型が同じように扱われるかは、今回は見ていない。

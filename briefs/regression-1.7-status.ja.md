# 現状の要約: 回帰 (1.7.0)、Issue #540

更新 2026-11-19 (夜)。新しい会話はこの文書と指示書 (main の `briefs/regression-1.7.ja.md`) を読んで始める。

## クリーンルームの規則 (最重要。毎回守る)

- 照合先の MASS (`polr`・`rlm`・`lqs`) と R の stats (`nls`・自己開始モデル・`profile`) は GPL。**ソースを読まない・思い出して
  書かない・写さない。** 関数の本体の表示、CRAN・GitHub のミラー、解説記事や検索結果に引用されたソースも対象。記憶に
  あるコードの構造や変数名をなぞった実装もしない。PORT のライブラリ (netlib の Fortran) も写さない
- 当てはめの中のコードも見ない: `rlm` の `$psi`、`nls` の `$m`、`unclass(fit)`、呼ばずに表示した `SSlogis` など
- 検索は論文名・著者名・方法の名前で行い、「rlm」「MASS」「nls」などの関数名・パッケージ名を検索語に入れない。
  これまでに 2 回、検索結果に MASS のソースの抜粋が出た (ユーザーはそのまま進めると判断)。抜粋が見えたら使わずに
  報告する
- 使ってよいもの: 論文と教科書、R のヘルプの文書、こちらが返す R の実行結果、rStats.js の既存の関数を呼ぶこと
- **あなたは R を実行しない。** 足りない実験は `experiments/<名前>.R` をまとめて push し、Issue #540 に「実験の依頼」と
  書いて止まる。こちらが手元で流す

## 進め方 (2026-11-19 から。前より往復を減らす)

- **CI の結果は自分で読む。** draft の PR #541 (`work/regression` → main、マージしない) で、push のたびに CI が型チェックと
  全テストを流す。push したら PR #541 の Checks で結果を確かめ、型エラーとテストの失敗は自分で直してから報告する。
  CI は (Mac だけで落ちる `test/issue179.test.ts`・`test/issue513.test.ts` を除き) 全部通る状態にしてある
  (`0383203f` 以降)。新しい関数やオプションを足すと、次の 3 つが落ちる。こちらがスクリプトで作り直すので、その 3 件だけは
  直さなくてよい: `test/unknownOptions.test.ts` (生成のブロック。**手で `import { checkOptions }` や `*_KEYS` の定数を
  書かない**。前回、生成のブロックと二重になってファイルが読み込めなくなった)、`test/rIndexDoc.test.ts` の 2 件
  (`docs/r-functions.md` の英・日)
- **区切りは大きめでよい。** 依頼にある項目は、1 回の返答でまとめて片付けてよい。ただし長い作業の途中では、区切りごとに
  push して Issue #540 に数行の途中経過を書く (表示が崩れるのを防ぐ)
- **こちらがすること:** R の実行、fixture の生成、数値の点検 (テストが正しい物差しで比べているか、R とどちらが正しいか)。
  CI が通ったことの確かめだけのために往復しない
- 依頼文は短くなる。規則はこの文書の「クリーンルームの規則」が正本

## 進み具合 (2026-11-19 夜、`754b03f3`)

| 関数 | 段階 1 (仕様書・oracle) | 段階 2 (実装・テスト) |
| --- | --- | --- |
| `polr` | 済み | **済み** (`polr`・`polrSummary`・`polrVcov`・`polrPredict`・`polrConfint`・`polrAnova`、テスト 55 件が通る)。触らない |
| `rlm` | 済み (`oracle/rlm-behaviour.md`、`oracle/rlm.R`、`test/fixtures/rlm.json`、choices 11 項目) | 区切り 1 (M 推定・psi・`rlmSummary`・`rlmVcov`) の途中。区切り 2 (決定的な LTS と MM)・3 (エラーと境界) はこれから |
| `nls` | 未着手 | 未着手 |

## polr で分かったこと (rlm・nls でも同じことに気をつける)

- **R の既定の当てはめは、真の解の手前で止まる。** fixture には厳しい止め方の当て直し `fitTight` を入れ、推定値は
  `fitTight` と厳しく比べる。R の既定の当てはめとは、その case の「既定と `fitTight` の差」から決めた許容誤差で比べる
- **rStats.js は既定で真の解まで反復する** (R の止め方を真似ない)。最適の近くでは、値の減り (Armijo) は丸めに
  埋もれるので、勾配のノルムで一歩を受け入れる
- R のヘッセ行列は数値微分 (標準誤差に 1e-5 ほどの誤差)
- MASS 自身の不具合が見つかったら、統計学的に正しい値にして R との既知の違いにする (polr の choices 12 cauchit・
  13 newdata の offset)。どちらが正しいかは、独立の計算 (厳密解、手計算、別の当てはめ方) で確かめてから決める

## rlm で決まったこと・分かったこと

- **choices** (`oracle/rlm-behaviour.md` の末尾、11 項目)。主なもの:
  - MM の S 推定と `init = "lts"` は**決定的** (乱数を使わない。R との既知の違い)。テストは、目的関数が R の参照
    (`sReferences`・`ltsReferences`) 以下であることと、M の段の推定方程式で確かめる
  - 共分散は **Huber (1981) の式で R と全桁一致** (choices 2、仕様書 §7.1。重みつきも確かめ済み)
  - 重みは R と同じ `weights` と `wtMethod`
  - MM とケースの重みはエラー (MASS は当てはめる。既知の違い)
- **MAD の尺度は `median|r| / 0.6745`** (丸めた定数。`754b03f3` で直した。R の `fitTight` の `s` と一致)
- **収束:** 推定方程式の残りと尺度の不動点の残りで判定する (`5941989d`)。`stackloss-huber-default` で、rStats.js の
  推定方程式の残りは 4e-9、`s` は R の `fitTight` と相対 1e-11 で一致する (こちらで確かめた)
- psi の微分の区間の端は、内側の区間に含める (Hampel: $|u|=2$ で 1、$|u|=4$ で 0)。R の Huber の微分は論理値
- `stackloss-bisquare-lts` は R の `fitTight` (`maxit = 2000`) でも収束しない (振動。仕様書 §6.6)

## 手元の結果 (`754b03f3`、こちらで実行)

- 型チェック: **`test/rlm.test.ts` に 2 件のエラー。** `test/rlm.test.ts(147,13)` と `(187,13)`: TS2451 `Cannot
  redeclare block-scoped variable 'tightExpected'`。同じ範囲で `tightExpected` を 2 回宣言している。このため
  `test/rlm.test.ts` はコンパイルできず、テストは 1 件も動いていない
- 実装 (`src/models/rlm.ts`) は型チェックを通る
- 全テストのうち、こちらが最後に作る生成物 (`test/unknownOptions.test.ts`、`docs/r-functions.md` の 2 件) と、Mac
  だけで落ちる `test/issue179.test.ts`・`test/issue513.test.ts` は気にしない

## 次にやること (この順。1 回の返答で 1 項目、push したら Issue #540 に数行で報告して止まる)

1. `test/rlm.test.ts` の二重の宣言を直す。こちらがテストを流して結果を返す
2. rlm の区切り 1 の残りの失敗を直す (こちらの結果を見て)
3. rlm の区切り 2: 決定的な LTS の初期値 (choices 11) と、決定的な S 推定による MM (choices 1)
4. rlm の区切り 3: エラーと境界 (共線はエラー、MM とケースの重みはエラー、収束しないときは `converged = false` と警告、
   完全に当てはまるデータ)
5. rlm の段階 2 の報告を Issue #540 に書いて止まる
6. その後に `nls` の段階 1 (`oracle/nls-behaviour.md`・`oracle/nls.R`)。R の出力は `experiments/regression-nls.R`・
   `.json` にある

## テストの書き方 (指示書 4 節の要点)

- 表は全行・全列を比べる。不一致はラベル付きで集め、最後に `expect(mismatches).toEqual([])`
- 許容誤差を広げて通さない。広い許容誤差が要る所は、理由をコメントに書いて報告で挙げる
- strict の型 (`exactOptionalPropertyTypes`・配列の添字は `undefined` になりうる) で通るように書く。`describe` の中で
  `await` しない
- R と違えた所だけ、独立に計算した参照値と比べ、既知の違いとしてラベルを付ける
- 触らない: `test/fixtures/` (こちらが作る)、`test/helpers/`、`docs/`、`CHANGELOG.md`、`ROADMAP*.md`、`.github/`、
  `scripts/`、`package.json`、`demo/`、既存の関数

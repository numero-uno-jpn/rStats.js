# 現状の要約: 対応分析・自己相関・非計量 MDS (1.11.0: ca・mjca、acf・pacf・ccf、isoMDS・sammon)、Issue #ISSUE

更新 2026-11-23。新しい会話はこの文書と指示書 (`briefs/ca-acf-mds-1.11.ja.md`) を読んで始める。

## 書き込んでよい場所 (最重要。これ以外には書かない)

- **リポジトリ:** `numero-uno-jpn/rStats.js` の**ブランチ `work/ca-acf-mds-1.11` だけ。** main・ほかのブランチ・タグには
  push もコミットも PR のマージもしない (2026-11-22 に main へ直接 push する事故があった)。新しいブランチも作らない
- **ファイル (このブランチの中):**
  - `src/timeseries/` の `acf.ts` (pacf・ccf も) と、それだけが使う補助の新しいファイル
  - `src/multivariate/` の `ca.ts`・`mjca.ts`・`sammon.ts`・`isoMDS.ts` (と、それだけが使う補助の新しいファイル)
  - `src/entries/timeseries.ts`・`src/entries/multivariate.ts` (export の行を足すだけ)
  - `test/` の新しいテスト (`acf.test.ts`・`ca.test.ts`・`mjca.test.ts`・`sammon.test.ts`) と `test/isoMDS.test.ts`、
    `test/demo.test.ts` の `NOT_IN_DEMO_YET`
  - `oracle/` の 1.11.0 の仕様書 (`acf-behaviour.md`・`ca-behaviour.md`・`mjca-behaviour.md`・`sammon-behaviour.md`) と
    `isomds-behaviour.md` (どれも「rStats.js's choices」の節を除く)、補助ファイル `_ca111cases.R`・`_acf111cases.R`・
    `_sammon111cases.R`、oracle `acf.R`・`ca.R`・`mjca.R`・`sammon.R`
  - `experiments/` の新しい R の実験 (`ca111-*.R`・`acf111-*.R`・`sammon111-*.R`・`isomds111-*.R`)
- **GitHub:** Issue #ISSUE へのコメントだけ。PR #PR は読むだけ (Checks を見る)
- **それ以外は書かない:** `HANDOFF.md`、`test/fixtures/`、`test/helpers/`、生成のブロック (`*_KEYS`・`checkOptions` の
  import)、`docs/`、`scripts/`、`.github/`、`package.json`、`typedoc.json`、`CHANGELOG.md`、`ROADMAP*.md`、`demo/`、
  既存の関数のファイル (`cmdscale.ts` などは呼ぶだけ)、こちらの実験 (`experiments/ca111.R`・`acf111.R`・`sammon111.R`
  と `.json`)
- **push の後に毎回確かめる:** `work/ca-acf-mds-1.11` の HEAD が自分のコミットで、変更したファイルが入っていること
  (2026-11-22 に、中身の無いコミットだけが届き、直しは main に行っていた)

## クリーンルームの規則 (最重要。毎回守る)

- 照合先の R 自身 (stats の `acf`・`pacf`・`ccf`)、MASS (`isoMDS`・`sammon`)、ca パッケージ (`ca`・`mjca`・
  `cacoord`) は GPL。**ソースを読まない・思い出して書かない・写さない。** 関数の本体の表示、CRAN・GitHub のミラー、
  解説記事に引用されたソース (C の `filter.c`・`eureka` などの Fortran、MASS の `sammon.c`・`VR_mds` も) も対象。記憶に
  あるコードの構造や変数名をなぞった実装もしない
- **ウェブ検索を使わない** (1.8.0 で検索結果にソースの抜粋が 5 回出た)。方法は知っている範囲の論文・教科書と、R や
  パッケージのヘルプ・実行結果で決める。論文を確かめたいときは、題名を Issue に書いて止まらずに先へ進む
- 結果の中のコードも見ない: `unclass(fit)` を表示しない、関数を呼ばずに名前だけ書かない。値は公開の関数とヘルプに
  書かれた戻り値の要素 (`$acf`・`$lag`・`$n.used`・`$sv`・`$rowcoord`・`$points`・`$stress` など) で取る
- 使ってよいもの: 論文と教科書 (Box, Jenkins & Reinsel "Time Series Analysis"、Brockwell & Davis "Time Series: Theory
  and Methods" (Durbin-Levinson)、Venables & Ripley "Modern Applied Statistics with S" (文章)、Greenacre
  "Correspondence Analysis in Practice"・"Theory and Applications of Correspondence Analysis"、Nenadić & Greenacre 2007
  (J. Statistical Software 20(3)、ca パッケージの論文)、Greenacre 1988 (JCA)、Benzécri 1979 (調整)、Sammon 1969
  (IEEE Trans. Computers C-18)、Kruskal 1964 (Psychometrika 29 の 2 本)、Cox & Cox "Multidimensional Scaling"、
  Borg & Groenen "Modern Multidimensional Scaling")、R とパッケージのヘルプ (文書。例の節も)、R の実行結果、
  rStats.js の既存の関数を呼ぶこと
- **仕様書の「rStats.js's choices」の節は変えない。** ユーザーの決定と根拠の記録で、こちらだけが書く。choices は仕様書の
  ほかの節よりいつも優先する。食い違いに気づいたら、ほかの節を choices に合わせて直す。choices を直すべきだと思ったら、
  Issue に提案を書いて止まる
- 報告の最後に、クリーンルームの確認 (ソースを使っていないこと、参照した文献、流した実験の一覧) を書く

## 進め方

- **作業ブランチ `work/ca-acf-mds-1.11` にだけ push する。main には push しない。`HANDOFF.md` は触らない**
- **CI は自分で読む。** draft の PR #PR (`work/ca-acf-mds-1.11` → main、マージしない) で、push のたびに型チェックと
  全テストが流れる。push したら PR の Checks を見て、型エラーとテストの失敗は自分で直してから報告する。Checks が見えない
  ときは、Issue に「CI の確認の依頼」と書いて次の作業へ進む
- **「手元の環境がない」で止まらない。** GitHub への直接の push、Actions の R (指示書 3 節)、PR の CI を使う
- **push のたびに、そのファイルを GitHub 上で開き直して中身を確かめる** (1.7.0 で改行が文字どおりの `\n` になった)
- 新しい関数やオプションを足すと、`test/unknownOptions.test.ts` (生成のブロック) と `test/rIndexDoc.test.ts` の 2 件
  (`docs/r-functions.md` の英・日) が落ちる。こちらがスクリプトで作り直すので、その 3 件だけは直さなくてよい。**手で
  `import { checkOptions }` や `*_KEYS` の定数を書かない**
- `/timeseries` の配線は済んでいる (入口は空)。新しい関数は入口に export を足し、テストはそこから import
- **会話はよく途中で切れる。** 区切りごとに push し、Issue に数行の途中経過 (何をしたか、次に何をするか、コミット) を
  書く
- **R の実験はあなたが流す** (指示書 3 節。`# issue: ISSUE` を先頭 5 行に)
- こちらがすること: fixture と生成物の作成、数値の点検 (独立の計算)、ユーザーへの Decisions の確認、取り込みと公開
- 判断に迷ったら、推測で進めず Issue に質問を書いて止まる。小さな判断は推奨を書いて進めてよい

## 進み具合

| 対象 | 状態 |
| --- | --- |
| acf・pacf・ccf | 段階 1 から |
| ca | 段階 1 から |
| mjca | 段階 1 から |
| sammon | 段階 1 から |
| isoMDS | 1.10.0 の実装を取り込み済み (`work/isomds-next` から)。合格 (choices 7) に届かなかった理由の調べから |

## テストの書き方 (要点)

- R と比べる。**返す値の全要素** (全行・全列・ラベル・文字列・警告の文)。不一致はラベル付きで集め、最後に
  `expect(mismatches).toEqual([])`。**テストが例外で途中で止まっていないこと**を、比べた case の数で確かめる
- **許容誤差を広げて通さない。期待値を実装に合わせて書き換えない。** 許容は根拠のある最小に
- **戻り値はいつも配列** (長さ 1 でも)。ca・mjca・isoMDS・sammon の座標は列の符号を R にそろえてから比べる
- 警告は R の出力の `warnings` (value の横) から読む
- strict の型 (`exactOptionalPropertyTypes`・配列の添字は `undefined` になりうる) で通るように。`describe` の中で
  `await` しない
- 端の入力 (尺度 2^±300・ずらし 1e8、大きな入力、NaN・Infinity、縮退) は指示書 5 節が合格の条件
- 配列を関数の引数に展開しない (`Math.max(...列)`)

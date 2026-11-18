# 現状の要約: 回帰 (1.7.0)、Issue #540

更新 2026-11-19。新しい会話はこの文書と指示書 (main の `briefs/regression-1.7.ja.md`) を読んで始める。

## クリーンルームの規則 (最重要。毎回守る)

- 照合先の MASS (`polr`・`rlm`) と R の stats (`nls`・自己開始モデル・`profile`) は GPL。**ソースを読まない・思い出して
  書かない・写さない。** 関数の本体の表示、CRAN・GitHub のミラー、解説記事や検索結果に引用されたソースも対象。記憶に
  あるコードの構造や変数名をなぞった実装もしない。PORT のライブラリ (netlib の Fortran) も写さない
- 当てはめの中のコードも見ない: `rlm` の `$psi`、`nls` の `$m`、`unclass(fit)`、呼ばずに表示した `SSlogis` など
- 検索は論文・教科書・ヘルプを探す語で行い、関数名だけで検索しない。以前、検索結果に MASS のソースの抜粋が出た
  (ユーザーはそのまま進めると判断)。抜粋が見えたら使わずに報告する
- 使ってよいもの: 論文と教科書、R のヘルプの文書、こちらが返す R の実行結果、rStats.js の既存の関数を呼ぶこと
- **あなたは R を実行しない。** 足りない実験は `experiments/<名前>.R` をまとめて push し、Issue #540 に「実験の依頼」と
  書いて止まる。こちらが手元で流す

## 進み具合

| 関数 | 段階 1 (仕様書・oracle) | 段階 2 (実装・テスト) |
| --- | --- | --- |
| `polr` | 済み (`oracle/polr-behaviour.md`、`oracle/polr.R`、`test/fixtures/polr.json`) | 当てはめ・`polrSummary`・`polrVcov` は実装済み、テストの最初の区切りまで。予測・区間・anova はこれから |
| `rlm` | 未着手 | 未着手 |
| `nls` | 未着手 | 未着手 |

## polr で決まったこと・分かったこと

- **choices:** `oracle/polr-behaviour.md` の末尾「rStats.js's choices」の 12 項目 (ユーザーの決定)。主なもの:
  - 空の応答の水準はエラー
  - 入れ子でない anova はエラー
  - `Hess` のオプションはない
  - 区間は傾きだけ
  - **cauchit は標準コーシー** (12 番。MASS 7.3-66 の cauchit は標準コーシーのモデルになっておらず、R との既知の
    違い。証拠は `experiments/regression-polr-cauchit.R`・`.out.txt`)
- **R の既定の当てはめは、真の最適の手前で止まる** (推定値で相対 5e-7〜1.6e-4)。そのため fixture には、同じ引数に
  `control = list(reltol = 1e-15, maxit = 2000)` を足した当て直し `fitTight` がある。推定値は `fitTight` と比べ、R の
  既定の当てはめとは R の止め方の範囲で比べる
- **rStats.js の精度 (`84f8bfa5`):** 推定値は `fitTight` と 4e-9〜8e-8 で一致する。逸脱度は 1e-12 以内。標準誤差は
  `fitTight` と最大 1.2e-5 違うが、これは R のヘッセ行列が数値微分であるためと考えられる (rStats.js は解析的)。
  切片だけのモデルは、5 リンクとも厳密解 ($F^{-1}$ (累積割合)) と 10 桁一致する
- 実装: `src/models/polr.ts`。解析的なスコアとヘッセ行列、BFGS の後に Newton の仕上げ。`__polrDerivativesForTest`
  がテスト用

## 手元の結果 (`84f8bfa5`、こちらで実行)

- 型チェック: 通過
- `test/polr.test.ts`: 11 件中 9 件が通過。**落ちる 2 件は同じ原因:** fixture の `fit.start` は名前付きの
  オブジェクト (`{"InflMedium": "...", ...}`、傾きの後にカットポイント) なのに、`prepareFit` (65 行目) が配列として
  `.map` を呼ぶ。`Object.values` で値を取り出す形にする
- 全テスト: 上の 2 件のほかに落ちるのは、`test/unknownOptions.test.ts` (オプションの型から生成されるブロック。最後に
  こちらがスクリプトで作り直すので気にしない) と、`test/issue179.test.ts`・`test/issue513.test.ts` (Mac の浮動小数点
  だけで落ちる以前からのもの。CI では通る) だけ
- **`src/entries/regression.ts` がまだない。** 新しく作り、`polr` などをここから export する (ルートの `src/index.ts`
  には入れない。package.json・bundle・size・デモの配線はこちらがする)。`test/demo.test.ts` の `NOT_IN_DEMO_YET` に
  新しい関数を足す

## 次にやること (この順。1 回の返答で 1 項目、push したら Issue #540 に数行で報告して止まる)

1. 上の `start` の扱いを直し、`src/entries/regression.ts` を作る
2. `polrPredict` (class と probs、`newdata`、未知の水準はエラー、欠測は欠測の行) とテスト
3. `polrConfint` (profile と Wald、傾きだけ、`level`・`parm`) とテスト。profile の端は、真の根を高精度で求めて比べる
4. `polrAnova` (入れ子だけ、尤度比の χ²) とテスト。choices で R と違えた所 (空の水準・入れ子でない anova) のテスト
5. polr の段階 2 の報告を Issue #540 に書いて止まる。こちらが手元で全テストを流す
6. その後に `rlm` の段階 1 (`oracle/rlm-behaviour.md`・`oracle/rlm.R`)。R の出力は `experiments/regression-rlm.R`・
   `.json` にある (MM 推定は乱数の種で係数が変わる)

## テストの書き方 (指示書 4 節の要点)

- 表は全行・全列を比べる。不一致はラベル付きで集め、最後に `expect(mismatches).toEqual([])`
- 許容誤差を広げて通さない。広い許容誤差が要る所は、理由をコメントに書いて報告で挙げる
- strict の型 (`exactOptionalPropertyTypes`・配列の添字は `undefined` になりうる) で通るように書く。`describe` の中で
  `await` しない
- R と違えた所だけ、独立に計算した参照値と比べ、既知の違いとしてラベルを付ける
- 触らない: `test/fixtures/` (こちらが作る)、`test/helpers/`、`docs/`、`CHANGELOG.md`、`ROADMAP*.md`、`.github/`、
  `scripts/`、`package.json`、`demo/`、既存の関数

# 指示書: 試験デザインのサンプルサイズと検出力 (ROADMAP の 1 番)

作成 2026-11-16。基準のコミットは依頼の文で指定します (この文書の版ではなく、依頼の指定に従う)。

あなた (ChatGPT) には、rStats.js (R の数値計算を TypeScript に移したライブラリ) に、試験デザインのサンプルサイズと
検出力の関数を足す作業を頼みます。今回は**仕様書と fixture の生成スクリプトから**お願いします (1.4.0 では
こちらが書いていた部分です)。テストは実行できませんが、R は 3 節の仕組みで自分で実行できます。

## 0. 範囲と照合先 (ユーザーが決定済み)

| 分野 | 照合先 (版) | 関数 |
|---|---|---|
| 平均と比率の同等性・非劣性・優越性 | epiR 3.0.0 | `epi.ssequb`・`epi.ssequc` (同等性・`type = "equality"`)、`epi.ssninfb`・`epi.ssninfc`、`epi.sssupb`・`epi.sssupc` |
| McNemar 検定 (正確法) | exact2x2 1.7.0 | `powerPaired2x2` |
| 生存時間 (Freedman・Schoenfeld) | powerSurvEpi 0.1.5 | `ssizeCT.default`・`powerCT.default` (Freedman)、`ssizeEpi.default`・`powerEpi.default`・`numDEpi.default` (Schoenfeld / Latouche) |
| Simon の 2 段階デザイン | clinfun 1.1.6 | `ph2simon` (minimax・optimal・admissible は `print` の表示の中身) |

- どのパッケージも GPL です。rStats.js は MIT なので、1 節の規則を守ってください
- 既にある近い関数: `powerTTest`・`powerPropTest`・`powerAnovaTest` (`src/htest/power.ts`、R の `power.*.test`)、
  `pwr*` (`src/htest/pwr.ts`)。名前・引数・結果の形の決まりはこれらに合わせる。名前は R の名前の camelCase
  (`epi.ssequb` → `epiSsequb`、`ssizeCT.default` の扱いは仕様書で提案)
- 仕様書の段で、上の表のほかに入れるべきもの・外すべきもの (例: McNemar のサンプルサイズは exact2x2 にない。
  `ss2x2` は `paired = TRUE` を受け付けない。powerSurvEpi の試験データから推定する `ssizeCT` は入れるか) を
  「Decisions for the user」に挙げる

## 1. クリーンルームの規則 (最重要)

- 照合先のパッケージと R の**ソースを読まない・思い出して書かない・写さない**。R のコード (関数の本体を表示する、
  `deparse`・`body`・`getAnywhere` を使う、など) も、CRAN・GitHub のミラー、解説記事に引用されたソースも対象。
  記憶にあるコードの構造や変数名をなぞった実装もしない
- R の実行で使ってよいのは、**公開の関数を呼ぶことと、ヘルプに書かれた戻り値**だけ。内部の関数 (`pkg:::...`) は使わない
- 使ってよいもの: 論文と教科書 (Chow, Shao & Wang "Sample Size Calculations in Clinical Research"、Freedman 1982、
  Schoenfeld 1983、Latouche et al. 2004、Simon 1989、Jung et al. 2001・2004、McNemar の正確な検出力の文献)、
  R のヘルプ (文書。例の節も含む)、こちらが返す R の実行結果、この指示書の 4 節
- こちらの作業者 (Mac のセッション) は、これらのパッケージのソースを見ていません
- 報告の最後に、クリーンルームの確認 (ソースを使っていないこと、参照した文献、実行した実験のスクリプトの一覧) を書く

## 2. 読むファイル

- 規則: `CONTRIBUTING.md`、`README.md` の「Versioning」、`llms.txt`
- 手本: `src/htest/power.ts`・`src/htest/pwr.ts` とそのテスト `test/powerStats.test.ts`、fixture を作る
  `oracle/power.R`・`oracle/_power.R`、`test/helpers/fixture.ts`
- 仕様書の手本: `oracle/survival-behaviour.md`、`oracle/competing-behaviour.md` (章立てと「Decisions for the user」・
  「rStats.js's choices」の書き方)
- 書き方の決まり: `briefs/survival-1.4.ja.md` の 8 節 (今回も守る)
- 公開の入口: `src/entries/tests.ts`。オプションの検査: `src/internal/checkOptions.ts`、警告: `src/internal/warnings.ts`
- 精度: `docs/accuracy.md`。R と違う扱いの記録: `docs/differences-from-r.md` (書式を見るため先頭だけ)

## 3. R の実験の仕組み (GitHub Actions の `R experiments`)

- 作業ブランチ (`work/samplesize`) に `experiments/<名前>.R` を push すると、push で追加・変更されたスクリプトが
  実行され、出力が Issue にコメントされます (ジョブの要約にも残る)
- スクリプトの先頭 5 行以内に `# issue: <この作業の Issue の番号>` と書く。名前は英数字と `.`・`_`・`-` だけ
- 環境: R 4.6.2 (x86_64、fixture と同じ CRAN の日付)、`Rscript --vanilla`、ネットワークなし、メモリ 2 GB、
  1 本 120 秒まで。使えるパッケージ: epiR・exact2x2・clinfun・powerSurvEpi・survival・jsonlite (と stats・utils・base)
- 出力は 17 桁 (`sprintf("%.17g", x)` か `jsonlite::toJSON(x, digits = NA)`)
- 実行の前に、クリーンルームの検査 (`scripts/r-experiment-check.mjs`) が通ります。関数を呼ばずに名前だけ書く、
  `deparse`・`body`・`:::`・`get`・`eval`・`parse` など、文字列で関数名を渡す、許可外のパッケージ、を含むと実行されず、
  理由が Issue に書かれます。検査は機械的なので、無害な書き方でも止まることがあります (変数名の `file`・`get`・
  `methods` など)。書き直して push し直す
- 同じスクリプトをもう一度実行したいときは、内容を変えるか別の名前で push する
- 当てはめや仮説の検証は、あなたの側で Python などを使って行う

## 4. こちらで既に確かめたこと (R 4.6.2、arm64。式は文献の式で、出力と照合しただけ)

記号: D = treat − control、δ = delta、r = n.treat / n.control、z_p = qnorm(p)。連続は V_t = V_c = σ²、
2 値は V_t = treat(1 − treat)、V_c = control(1 − control)。

- **n を解く (`n = NA`、`nfractional = TRUE`):** n.control = (z_A + z_B)² (V_t / r + V_c) / E²、n.treat = r · n.control。
  1,224 通りの格子で相対 1e-12 で一致 (下の例外を除く)
  - 非劣性: z_A = z_{1−α}、z_B = z_{power}、E = D + δ
  - 優越性: z_A = z_{1−α/s} (s = `sided.test`)、z_B = z_{power}、E = D − δ (E = 0 では Inf)
  - 同等性: z_A = z_{1−α}、z_B = z_{1−(1−power)/2}、E = δ − |D|
  - equality: z_A = z_{1−α/2}、z_B = z_{power}、E = D
  - **例外:** `epi.ssequb(type = "equality")` で r ≠ 1 のとき、n.treat は r = 1 の 1 群の n のままで、
    n.control = n.treat / r (r を分散に使っていないように見える)
- **`nfractional = FALSE`:** 例 (`epi.ssninfc(0.22, 0.20, sigma = 0.1, delta = 0.05, r = 2)`) で n.treat 37.85 → 38、
  n.control 18.93 → 19、n.total 57 (各群を切り上げて足す)。他の場合は未確認
- **検出力を解く (`power = NA`):** n.treat = n·r/(1 + r)、n.control = n/(1 + r)、se = √(V_t/n.treat + V_c/n.control)
  - 非劣性 (連続・2 値): Φ((D + δ)/se − z_{1−α})。一致
  - 優越性 連続: Φ((D − δ)/se − z) + Φ(−(D − δ)/se − z)、z = z_{1−α/s}。一致。2 値は r = 1 だけ同じ式で一致、
    r ≠ 1 は合わない (例: treat 0.5、control 0.3、δ 0.05、n 101、α 0.05、s = 1、r = 0.5 で R は 0.3023368、
    上の式は 0.4279172)
  - 同等性 連続: 2[Φ(a − z_{1−α}) + Φ(−a − z_{1−α})] − 1、a = (δ − |D|)/se。全部一致。**R は負の検出力を返す**
    (例: D = 0、δ = 0.05、σ = 0.25、n = 40 で −0.6658845)。2 値は一部だけ一致 (未解明)
  - `epi.ssequc(type = "equality", power = NA)` は R がエラー (`object 'n.treat' not found`)
- **エラー:** 非劣性で D + δ < 0 (n も power も) は `Target power is not reachable. Check the exact specification of
  the hypotheses.`。警告の有無は未確認
- powerSurvEpi・exact2x2・clinfun はまだ何も確かめていない。ヘルプの例はそのまま動く

## 5. 進め方 (3 段階。各段階の終わりで止まって報告する)

### 段階 1: 仕様書と fixture の生成スクリプト

- `oracle/samplesize-behaviour.md` (英語): 4 節の続きを実験で詰め、全関数の式・丸め・探索の仕方 (exact2x2 の
  `errbound`・`strict`、`ph2simon` の探索の範囲と同点のとき)・エラーと警告・境界 (power が 0・1 に近い、
  確率が 0・1、`nmax` の上限など) を書く。章立ては `oracle/survival-behaviour.md` に合わせ、末尾に
  「Decisions for the user」(選択肢と推奨) と、空の「rStats.js's choices」を置く。特に決めてほしいこと:
  API の形 (R の各関数の引数のままか、`powerTTest` のように解く量を未指定にする方式に揃えるか)、R の明らかな誤り
  (負の検出力、r の無視、equality の検出力のエラー) を写すか直すか
- `oracle/samplesize.R` (必要なら分野ごとに分ける): `oracle/power.R` の形で、ケースの一覧と R の結果を JSON に書く。
  境界・エラーの case も入れる。こちらで `npm run oracle -- <name>` を実行して `test/fixtures/<name>.json` を作り、
  ブランチに push します
- **段階 1 の報告:** 仕様書の要点、未解明の所 (無理に近似を足さない)、Decisions for the user。ここで止まり、
  こちらの「進めてよい」を待つ (ユーザーが Decisions に答えて「rStats.js's choices」をこちらで書きます)

### 段階 2: 実装

- 新しいファイル (例: `src/htest/sampleSize.ts`) に実装し、`src/entries/tests.ts` から export する。既存の
  `matchChoice`・`isUnknown`・`checkExactlyOne`・`solveFor` (`src/htest/power.ts`) を使う
- テスト `test/sampleSize.test.ts`: fixture を `briefs/survival-1.4.ja.md` の 8 節の 5 の形で比べる。許容誤差は既存の
  検出力のテストに合わせ、勝手に広げない
- `briefs/survival-1.4.ja.md` の 8 節を守る (オプションの検査の生成、TSDoc の 1 文目、`NOT_IN_DEMO_YET` など)

### 段階 3: 数値の点検

極端な入力 (power 0.999999、α 1e-10、確率 1e-12 や 1 − 1e-12、ハザード比 1 ± 1e-10、大きな n) で、rStats.js と
R がどうなるかを確かめ、違いを報告する

## 6. 書くもの・触らないもの

- 書く: `oracle/samplesize-behaviour.md`、`oracle/samplesize*.R`、`src/htest/` の新しいファイル、`src/entries/tests.ts`
  の export、`test/` の新しいテスト、`test/demo.test.ts` の `NOT_IN_DEMO_YET`
- 実験のスクリプト `experiments/*.R` は作業ブランチにだけ置く (main には取り込みません)
- 触らない: 既存の関数、`test/fixtures/` (こちらが作る)、`test/helpers/`、`docs/`、`CHANGELOG.md`、`.github/`、
  `scripts/`。文書 (`docs/differences-from-r.md`、CHANGELOG、API の説明) は、報告に案を書いてもらえれば、こちらで直します

## 7. Issue とブランチ

- Issue は 1 つ。タイトルは `ROADMAP 1: 試験デザインのサンプルサイズと検出力`
- ブランチ `work/samplesize` を依頼で指定する基準のコミットから作り、そこに push する。段階 2 で PR を作り、CI の
  結果を読む
- 報告 (各段階の最初のコメント): 何をしたか、仕様書で決まっていなかったことと決め方、R と違う所と根拠、自信のない所、
  確かめられなかった所、クリーンルームの確認
- 判断に迷ったら、推測で進めず Issue に質問を書いて止まる

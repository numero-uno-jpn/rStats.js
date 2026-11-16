# 指示書: 同時刻の失敗がある場合の Gray の検定の分散 (rStats.js 1.4.1)

作成 2026-11-16。基準のコミットとブランチ名は、依頼の文で指定します (この文書の版ではなく、依頼の指定に従う)。

あなた (ChatGPT) には、rStats.js の `cuminc` が返す Gray の検定 (cmprsk の `cuminc()$Tests`) を、同時刻の失敗 (tie)
があるデータでも R と同じ値にする作業を頼みます。あなたはブランチに push でき、PR の CI の結果を読めますが、テストは
実行できません。R は、ブランチに push したスクリプトを GitHub Actions が実行し、出力を Issue に書きます (3 節)。

## 0. 背景

- `cuminc` は 1.4.0 で公開済み。Gray の検定の統計量は、同時刻の失敗がないデータでは R と 1e-14 で一致する
- 同じ原因の失敗が同じ時刻に 2 件以上あると、R の分散は現在の式より小さく、統計量が R と 1〜50% ずれる。今は近似
  (`oracle/competing-behaviour.md` の判断 5 の (b)) を使い、`docs/differences-from-r.md` に差として書いてある。
  fixture の 7 件 (`test/fixtures/cuminc.json` の case 17〜22・32) はテストの比較から外している
  (`test/competingRisks.test.ts` の `CUMINC_KNOWN_DIFFERENCES` の `gray-tied-time-variance`)
- これまでに分かっていることは仕様書の 1.6 節にある。スコア z は同時刻があっても変わらない。全群の `S_r(t−)` が等しい
  ときは超幾何の補正で説明できるが、等しくないときに合う式は見つかっていない
- 実際の例 (1.4.0 のデモで見つかった):
  ```r
  time <- c(1, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 7); status <- c(1, 0, 2, 1, 0, 1, 0, 1, 2, 0, 1, 0)
  group <- rep(c("A", "B"), each = 6)
  cmprsk::cuminc(time, status, group)$Tests
  #         stat        pv df
  # 1 0.72927210 0.3931192  1     (R; 原因 1 の stat は 0.7292720972825765)
  # 2 0.01231011 0.9116553  1
  ```
  rStats.js は原因 1 で 0.697305213647051 を返す (原因 2 は R と一致)

## 1. クリーンルームの規則 (最重要)

cmprsk は GPL、rStats.js は MIT です。

- cmprsk の**ソースを読まない・思い出して書かない・写さない**。R のコード (`cuminc` の本体を表示する、`deparse`・
  `body`・`getAnywhere` を使う、など) も、Fortran のコード (`crstm` など) も対象。CRAN・GitHub のミラー、解説記事に
  引用されたソースも読まない。記憶にあるコードの構造や変数名をなぞった実装もしない
- R の実行で使ってよいのは、**公開の関数 (`cmprsk::cuminc`、`cmprsk::timepoints`) と、ヘルプに書かれた戻り値**
  (`$Tests` の `stat`・`pv`・`df`、各曲線の `time`・`est`・`var`) だけ。`.Fortran` などで内部のルーチンを直接
  呼ばない。内部のオブジェクト (`cmprsk:::...`) も使わない
- 使ってよいもの: 仕様書 `oracle/competing-behaviour.md` (ソースを読まずに論文・ヘルプ・R の実行結果から書いたもの)、
  Gray (1988) "A class of K-sample tests for comparing the cumulative incidence of a competing risk", Annals of
  Statistics 16, 1141-1154 などの論文と教科書、R のヘルプ、fixture の値、こちらが返す R の実行結果
- **こちらの作業者 (Mac のセッション) は cmprsk のソースを見てしまっています。** そのため、式についての質問には
  答えず、手がかりも出しません。こちらがするのは、R の実行の仕組み (3 節) の面倒を見ることと、テストの実行だけです
- 報告の最後に、クリーンルームの確認 (ソースを使っていないこと、参照した論文と、実行を頼んだ R のスクリプトの一覧) を
  書く

## 2. 読むファイル

- `oracle/competing-behaviour.md`: 全部。特に 1.5 節 (Gray の検定と分散の式、二次形式からの当てはめ)、1.6 節、
  末尾の「Decisions for the user」の 5 と「rStats.js's choices」
- `src/models/competingRisks.ts`: `grayTests` (分散の計算と、今の同順位の補正)
- `test/competingRisks.test.ts`、`test/fixtures/cuminc.json`、それを作った `oracle/cuminc.R` (fixture の欄の意味)
- 書き方の決まり: `briefs/survival-1.4.ja.md` の 8 節 (今回も守る。特に 6・8・9・10)

## 3. 進め方 (3 段階。各段階の終わりで止まって報告する)

### 段階 1: 実験で式を突き止める

- 2 群なら `stat = z² / V` なので、z を仕様書の式で計算すれば、R の `stat` から分散 V が求まります。3 群以上では
  二次形式から求めます (1.5 節の方法)。時刻を 1 つずつ足した小さなデータを作れば、各時刻の寄与を切り分けられます
- **R の実行は自分でできます (GitHub Actions の `R experiments`):** `work/gray-ties` に `experiments/<名前>.R` を
  push すると、push で追加・変更されたスクリプトが実行され、出力が Issue にコメントされます (ジョブの要約にも残る)。
  - スクリプトの先頭 5 行以内に `# issue: 525` と書く (出力を書く Issue)。名前は英数字と `.`・`_`・`-` だけ
  - 環境: R 4.6.2・cmprsk 2.2.12・survival 3.8.12 (x86_64、fixture と同じ CRAN の日付)、`Rscript --vanilla`、
    ネットワークなし、メモリ 2 GB、1 本 120 秒まで。使えるパッケージは cmprsk・survival・jsonlite (と stats・utils・base)
  - 出力は `cat()` や `jsonlite::toJSON(..., digits = NA)` で、**17 桁** (`format(x, digits = 17)` か `sprintf("%.17g")`)
  - **実行の前にクリーンルームの検査** (`scripts/r-experiment-check.mjs`) が通ります。1 節に反する書き方 (cmprsk の関数を
    呼ばずに名前だけ書く、`deparse`・`body`・`:::`・`get`・`eval`・`parse`・`.Fortran` など、文字列で関数名を渡す、
    許可外のパッケージ) を含むと、どのスクリプトも実行されず、理由が Issue に書かれます。書き直して push し直してください。
    検査は機械的なので、無害な書き方でも止まることがあります (例: 変数名に `file`・`get`・`methods` を使う)
  - 同じスクリプトをもう一度実行したいときは、内容を変える (コメントを足すなど) か、別の名前で push する
  - 検査で止まらなくても、1 節の規則はそのまま守ってください。人が後でスクリプトを読みます
- こちらから実験の提案はしません。ワークフローが動かないなど、仕組みの問題は Issue に書いてください
- 当てはめや仮説の検証は、あなたの側で Python などを使って行ってください
- **段階 1 の報告:** 見つけた式 (数式で)、それが合うことを確かめたデータの一覧と誤差。ここで止まり、こちらの「進めて
  よい」を待つ。見つからないときも、試した仮説と結果を書いて止まる (無理に近似を足さない)

### 段階 2: 実装

- `grayTests` の分散の計算を直す。同時刻がないデータの結果は変えない (今の fixture のテストがすべてそのまま通ること)
- `test/competingRisks.test.ts` の `CUMINC_KNOWN_DIFFERENCES` から `gray-tied-time-variance` を外し、case 17〜22・32 の
  `stat` と `pv` を他の case と同じ許容誤差 (`compare` の既定の 1e-12) で比べる。比べられない値があれば、理由を書いて
  報告する (許容誤差を勝手に広げない)
- 0 節のデモのデータを、R の値 0.7292720972825765 (原因 1)・0.01231011 前後 (原因 2。段階 1 で 17 桁を取る) と比べる
  テストを足す。ρ ≠ 0、層、3 群、3 つの原因の同時刻のデータも、段階 1 で R の値を取ってテストに入れる
- コードのコメントは英語。式の出所 (論文の式と、実験で決めた部分) をコメントに書く。ファイル先頭の出典の書き方は
  既存に合わせる (自分で書いたものは `Written for rStats.js (no ported code).`)

### 段階 3: 数値の点検

`briefs/survival-1.4.ja.md` の 7 節と同じ。時刻を 2^±1000 倍、同時刻の件数が多い場合 (数千)、`S_r(t−)` が 0 に
近い場合、分母が 0 になりうる場合 (残り 1 人など) を確かめ、R がどうなるかもスクリプトで確かめる

## 4. 書くもの・触らないもの

- 変えてよい: `src/models/competingRisks.ts` (`grayTests` とその周りのコメント)、`test/competingRisks.test.ts`
  (と、新しいテストのファイル)
- 実験のスクリプト: `experiments/*.R` (作業ブランチにだけ置く。main には取り込みません)
- 触らない: `test/fixtures/`、`oracle/`、`test/helpers/`、`docs/`、`CHANGELOG.md`、`.github/`、`scripts/`、ほかの関数。文書は、報告に案を
  書いてもらえれば、こちらで直します: `oracle/competing-behaviour.md` 1.6 節の書き換え (英語)、
  `docs/differences-from-r.md` から消す・直す項目、CHANGELOG の Fixed の 1 項目 (英語)

## 5. Issue とブランチ

- Issue は 1 つ。タイトルは `1.4.1: Gray の検定の分散 (同時刻の失敗)`
- ブランチは `work/gray-ties` を依頼で指定する基準のコミットから作り、そこに push する。段階 2 で PR を作り、CI の
  結果を読む
- 報告 (各段階の最初のコメント): 何をしたか、仕様書で決まっていなかったことと決め方、R と違う所と根拠、自信のない所、
  確かめられなかった所、クリーンルームの確認
- 判断に迷ったら、推測で進めず Issue に質問を書いて止まる (ただし、1 節のとおり式についての質問には答えません)

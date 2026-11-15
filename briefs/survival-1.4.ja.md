# 指示書: 生存時間解析の続き (rStats.js 1.4.0)

作成 2026-11-15。基準のコミットは `b1241960` (main)。

あなた (ChatGPT) には、rStats.js (R の数値計算を TypeScript に移したライブラリ) に新しい機能を足す作業を頼みます。
あなたはリポジトリに push できず、テストも実行できません。成果物は GitHub の Issue に貼ってもらいます。こちらで
適用してテストを流し、点検します。

## 0. 進め方

作業は 4 つ (A〜D) に分けます。**1 つの Issue で 1 つの作業**だけをし、こちらが取り込んで次を頼むまで、次の作業には
進まないでください。順番は A → B → C → D です。B 以降の基準のコミットは、依頼するときにこちらから伝えます。

| 作業 | 内容 | 仕様 (必ず全部読む) | 参照値 |
|---|---|---|---|
| A | `survfit` の続き (累積ハザード、`ctype`・`stype`、重み、robust、`rmean`、`confType` の追加) と `rmst2` (survRM2) | `oracle/survfit2-behaviour.md` | `survfit2.json`・`rmst2.json` |
| B | `coxZph` (cox.zph) と、(start, stop] データの `coxph` と `survfit` | `oracle/coxph2-behaviour.md` | `coxZph.json`・`coxphCounting.json`・`survfitCounting.json` |
| C | 競合リスク: `cuminc` (Gray の検定を含む) と `crr` (Fine-Gray) | `oracle/competing-behaviour.md` | `cuminc.json`・`crr.json` |
| D | `survreg` (全分布、打ち切りの型、`predict`、`residuals`) | `oracle/survreg-behaviour.md` | `survreg.json`・`survregPredict.json`・`survregResiduals.json` |

各仕様書の末尾の「rStats.js's choices」は、ユーザーが決めたことで、**拘束力があります**。仕様書の
「Decisions for the user」の各項目は、推奨の選択肢が採用されています (choices に別の答えがある項目はそちらに従う)。

## 1. クリーンルームの規則 (最重要)

R の survival は LGPL、cmprsk と survRM2 は GPL です。rStats.js は MIT なので、これらのソースを写してはいけません。

- R とパッケージの**ソースコードを読まない・思い出して書かない・写さない**。C・Fortran・R のコードの構造や変数名を
  なぞった実装もしない
- 使ってよいもの: 仕様書 (oracle/*-behaviour.md。ソースを読まずに、論文・ヘルプ・R の実行結果から書いたもの)、
  論文、R のヘルプ (文書)、fixture の値
- 仕様書の「Permissively licensed sources」に挙げたもの (MIT・BSD などのコード) は、仕様書に書いた範囲で参照してよい
- 移したコードの出典は、ファイルの先頭のコメントに書く (既存のファイルの書き方に合わせる)。自分で書いたものは
  `Written for rStats.js (no ported code).`

## 2. 読むファイル

1 MB を超えるファイルは読まなくてよいです。`test/fixtures/survregPredict.json` (1.2 MB) だけは、読むための写しを
`briefs/fixtures-split/survregPredict.part1.json`・`part2.json` に分けてあります (テストは元のファイルを読む)。

すべての作業で読むもの (括弧内はおおよその KB):

- 規則: `CONTRIBUTING.md`、`README.md` の「Versioning」と名前の規則、`llms.txt`
- 生存時間解析の今の実装: `src/models/survival.ts` (16、survfit・survdiff)、`src/models/coxph.ts` (48)、
  `src/models/tiedTimes.ts`
- 公開の入口: `src/entries/tests.ts`
- 警告: `src/internal/warnings.ts` の先頭の規則。オプションの検査: `src/internal/checkOptions.ts`
- テストの手本: `test/coxph.test.ts`、`test/helpers/fixture.ts`、`test/helpers/htest.ts`
- 精度の考え方: `docs/accuracy.md`
- R と違う扱いの記録: `docs/differences-from-r.md` と `docs/ja/differences-from-r.md` (どちらも 200 KB 余り。
  書式を見るため、先頭と survival・coxph の節を読む)
- 変更履歴: `CHANGELOG.md` の先頭と書き方
- その作業の仕様書と、参照値の fixture、それを作った `oracle/*.R` (fixture の欄の意味は oracle スクリプトの
  先頭のコメントにある)

## 3. 設計で守ること

- **検証済みの関数を使う (一から書かない):** rStats.js の公開・内部の関数は、R との照合と極端な尺度の点検を
  済ませてあります。同じ計算を自前で書き直さず、それを呼んでください。たとえば次のものです
  - Kaplan-Meier 曲線・累積ハザード (打ち切りの分布の KM も): `survfit` (src/models/survival.ts)
  - 重み付き最小二乗・一般化線形モデル: `lm`・`glm` (src/models/lm.ts・glm.ts)。対数リンクの推定方程式は
    `glm(family: "poisson", weights)` で解ける
  - 頑健な共分散: `vcovHC`・`vcovCL` (src/models/sandwich.ts)。Cox 回帰: `coxph`
  - 行列の分解・逆行列・連立方程式: `src/linalg/` (`chol`・`qr`・`solve` など)。逆行列を `solve` の列ごとの呼び出しで
    作らない
  - 分布関数・分位点: `src/distributions/`。総和や尺度の調整は `src/internal/` と `src/numerics/` の既存の道具
  - 自前で書くのは、既存の関数では計算できない固有の部分 (rmst2 の打ち切りの補正項を含む B 行列など) だけ。
    その部分と、既存の関数を使わなかった理由を報告に書く
  - 既存の関数の結果を R に合わせるために後から補正する、といった回り道が要るときは、Issue で質問して止まる
- **互換性を壊さない:** 1.x の間は、既存の関数の結果やオプションの意味を変えない (README の Versioning)。
  オプションや結果の欄を足すのは構わない
- **R が誤る所は正しい値を返す:** 仕様書の「Where R is wrong or inaccurate」に従う。正しい値を返す所は、
  `docs/differences-from-r.md` と `docs/ja/differences-from-r.md` の両方に理由を書く。テストは fixture でなく、
  仕様書にある参照 (高精度の値など) と照合する
- **引数の誤り:** 型の誤りは `TypeError`、範囲の誤りは `RangeError` (知らないオプションのキーも RangeError)。
  結果が定義されない入力は `Error`。仕様書がエラーと決めた所は、そのとおりに
- **警告:** 結果に `warnings: string[]` を持たせ、`reported(...)` で渡す (src/internal/warnings.ts の規則)
- **数値:** 極端な入力 (2^±500 倍の尺度、非正規化数の近く、大きな時間) で溢れたり桁が落ちたりしないように書く。
  少なくとも尺度を変えたときの不変性 (時間や共変量を 2 の冪倍したときの結果の変わり方) をテストに入れる
- **新しい依存パッケージは入れない**
- **テストの許容誤差:** 仕様書の「Accuracy」に従う。書いていなければ相対 1e-12。Node 22 では Math.pow などの
  最後のビットが違うので、値をビット単位で固定するテスト (`toBe`) は使わず相対 4e-15 程度にする
- **時間のかかる計算:** テスト 1 件が 1 秒を超えないようにする。時間を測るテストを書くときは、実行機の速さで
  なく設計上の上限で決める

## 4. 書くもの

1. `src/models/` の実装 (新しいファイルにするか既存に足すかはあなたの判断。理由を報告に書く)
2. `src/entries/tests.ts` からの export
3. TSDoc: 既存の関数と同じ形 (説明、`@param`、`@returns`、`@example`、`@category`)。`@example` の値は、
   rStats.js が実際に返す値を fixture などから求めて書く
4. テスト `test/<名前>.test.ts`: fixture の全件、引数の誤り、尺度の不変性、仕様書の境界の場合
5. `CHANGELOG.md` の `## Unreleased` (Added・Changed・Fixed)
6. R と違う所があれば differences-from-r (en・ja)

README・ROADMAP・llms.txt・デモ・`docs/ja/api/`・`docs/r-functions.md` はこちらで直します。触らないでください。

## 5. こちらで実行すること (あなたはしなくてよい)

- `node scripts/option-keys.mjs --write` (新しいオプションのキーの検査の生成)。生成されるファイルは手で書かない
- `npx vitest run`、Node 22 での確認、型の検査、ブラウザのテスト
- テストが落ちたら、その出力を Issue に貼るので、直したパッチを同じ Issue に追加してください

## 6. Issue への成果物の入れ方

- 作業ごとに 1 つの Issue。タイトルは `1.4.0 作業 A: survfit の続きと rmst2` のように
- **パッチ:** 基準のコミットに `git apply` できる unified diff (`git diff` の形、`a/`・`b/` の接頭辞付き)。改行は LF
  - 1 コメントに入らないときは、ファイルごとにコメントを分け、各コメントの先頭に `パッチ k/N: <ファイル名>` と
    書く。どのパッチも単独で `git apply` できるようにする
  - 新しいファイルは diff の代わりにファイル全体をコードブロックで貼ってもよい (先頭にパスを書く)
- **報告 (最初のコメント):**
  - 作ったものと API (関数・オプション・結果の型)
  - 仕様書で決まっていなかったことと、その決め方・理由
  - R と違う所と、その根拠
  - 自信のない所、確かめられなかった所 (テストを実行していないので、予想される失敗も)
  - クリーンルームの確認: R・GPL・LGPL のソースを使っていないこと。参照した論文と許容的なライセンスのコード
- 仕様書が曖昧で判断に迷ったら、推測で進めず、Issue に質問を書いて止まってください

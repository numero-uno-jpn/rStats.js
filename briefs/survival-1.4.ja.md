# 指示書: 生存時間解析の続き (rStats.js 1.4.0)

作成 2026-11-15。基準のコミットとブランチは、作業ごとに依頼の文で指定します (この文書の版ではなく、依頼の指定に従う)。

あなた (ChatGPT) には、rStats.js (R の数値計算を TypeScript に移したライブラリ) に新しい機能を足す作業を頼みます。
あなたはリポジトリに push できず、テストも実行できません。成果物は GitHub の Issue に貼ってもらいます。こちらで
適用してテストを流し、点検します。

## 0. 進め方

作業は 4 つ (A〜D) に分けます。**1 つの Issue と 1 つのブランチで 1 つの作業**だけをし、こちらが頼むまで、次の作業には
進まないでください。基準のコミットとブランチ名は、依頼するときにこちらから伝えます。

- B は A と同じ `survfit` (src/models/survival.ts) を変えるので、A を取り込んだ後に行います
- C と D は A と重ならないので、A を待たずに main から始められます。C・D では `src/models/survival.ts` と
  `src/models/coxph.ts` を変えないでください (既存の関数を呼ぶのは構いません)。どうしても変える必要があれば、
  Issue で質問して止まってください
- 作業のブランチは `work/survival-1.4-<作業の文字>` の形で作り、そこに push します (例: `work/survival-1.4-c`)。
  Issue にはパッチを貼る代わりに、ブランチ名と最後のコミットを書けば足ります

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

## 7. 数値の点検 (fixture と一致した後の別の依頼)

fixture との一致は、普通のデータで R と同じ値を返すことしか確かめません。このライブラリは、極端な入力でも正しい値
を返すことを重視しています (`docs/accuracy.md`)。fixture と一致して main に取り込んだ作業ごとに、次の点検を頼みます。

1. **洗い出し:** 対象の関数のコードを読み、次の観点で弱点を探して、Issue に一覧にする (場所、起きる入力の例、
   起きること、直し方の案)
   - **尺度:** 時間・共変量・重みを 2^±500 倍、2^±1000 倍したとき。結果が倍率どおりに変わる (係数は割られ、
     確率は変わらない、など) か。途中の積・二乗・和が溢れない (Infinity) か、0 に潰れないか
   - **桁落ち:** 1 に近い確率の 1 − p、近い値どうしの差 (区間の限界、対数尤度の差)、分散の E[x²] − x̄² の形
   - **溢れ・潰れ:** exp・log・積の溢れ、非正規化数の近く (1e-310 など)、Number.MAX_VALUE の近く
   - **端の場合:** 全員が打ち切り、全員に事象、1 時点に全員の事象、群・層・原因が 1 つだけ、事象が 1 件だけ、
     同順位ばかり、n = 1・2、重み 0 の行、共変量が定数・完全に分離、分散が 0
2. **確かめ:** 一覧の各項目を、実際の入力で確かめる。正しい値は、高精度の計算 (Python の mpmath・fractions、
   BigInt での厳密な有理数) で求める。R の値は、R が正しいときだけ参照にする
3. **修正とテスト:** 誤りがあった項目を直し、テストを足す (正しい値と、その求め方をテストのコメントに書く)。
   直さないもの (直すと遅くなりすぎる、など) は理由を報告に書く。R と違う値を返すようになった所は
   differences-from-r (en・ja) に書く
4. **普通のデータの値を変えない:** 修正の前後で fixture のテストがすべて通ること。尺度の調整などは、必要な
   ときだけ働くようにする (普通のデータではビット単位で同じ値が望ましい)
5. **時間:** 修正で普通の入力が遅くならないこと。極端な入力だけ遅い経路に入るのは構わない

ブランチと Issue は、依頼のときに指定します。

## 8. これまでの作業で何度も直しが入った点 (必ず守る)

作業 A〜C の検証で、同じ種類の誤りが何度も見つかりました。最初から守ってください。

1. **オプションの検査は生成スクリプトの形のまま:** 手で import や `checkOptions` の呼び出しを別に書かない。
   定数の名前は関数名を大文字のスネークケースにしたもの (`coxZph` → `COX_ZPH_KEYS`、`survreg` → `SURVREG_KEYS`)。
   配列の形 (`[...] as const` か `new Set([...])`) と前後の空行も、スクリプトが書くとおりにする
   ```ts
   // Generated by `node scripts/option-keys.mjs --write` from the option types; do not edit (begin)
   import { checkOptions } from "../internal/checkOptions.js";
   const SURVREG_KEYS = ["dist", "weights"] as const;
   // Generated by `node scripts/option-keys.mjs --write` (end)
   ```
   呼び出しは関数の先頭の 1 行: `checkOptions(options, SURVREG_KEYS, "survreg"); // generated: option-keys.mjs`
2. **TSDoc:** export する interface と type には `@category` を 1 つ (既存の生存時間解析の型と同じもの)。公開の関数の
   TSDoc の 1 文目は「<説明>. Equivalent to R's `pkg::fun()`.」の決まった形 (`test/rNames.test.ts` が検査する。
   既存の関数の書き方に合わせる)
3. **新しい公開の関数**は `test/demo.test.ts` の `NOT_IN_DEMO_YET` に足す
4. **触らないもの:** `test/fixtures/`、`oracle/`、共有のテスト用の道具 (`test/helpers/`)、既存の関数の結果・エラーの文言。
   既存の関数を変えるときは、その関数の既存のテストがすべてそのまま通ること
5. **fixture のテスト:** 不一致を case の番号と欄の名前のラベル付きで全部集め、最後に `expect(mismatches).toEqual([])`。
   R がエラーの case は期待されるエラーとして、`reference` のある case はそれとだけ比べる。fixture の欄の意味と並び
   (列の順など) は、fixture を作った `oracle/*.R` を読んで確かめる
6. **誤差の尺度:** 差の形の値 (区間の限界、対数尤度の差) は |a| + |b| の尺度で測る。収束した点の勾配 (0 に近い残り) は
   相対誤差で比べない。R が丸めの残り (±2e-16 など) を返し rStats.js が 0 を返す所は、その量の大きさに対して測る。
   反復の値が R と少しずれるときは、反復を続けた値 (真の根) と比べてから決める。根拠はテストのコメントに書く
7. **尺度を変えても変わらない検定:** Wald 検定などは、共変量の単位を変えても値が変わらないこと (R の coxph は、単位の
   大きな共変量で列を黙って落とす。therneau/survival#353)。分散を分解するときは、許容誤差を当てる前に尺度を揃える
8. **型:** tsconfig の strict (`exactOptionalPropertyTypes` を含む) を前提にする。変数は使う前に宣言する
9. **実際に動かして確かめる:** 静的な照合だけでは見つからない誤り (未定義の変数、列の順の取り違え) が何度もあった。
   Python などで同じ手順を書いて fixture と照合し、その結果を報告に書く
10. **時間:** テスト 1 件が 1 秒を超えないようにする

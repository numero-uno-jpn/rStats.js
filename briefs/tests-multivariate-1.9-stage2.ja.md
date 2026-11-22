# 段階 2 の指示: 実装 (1.9.0、Issue #549)

作成 2026-11-22 (Claude)。段階 1 は完了です。**Decisions はユーザーが全部推奨どおりに決めました** (2026-11-22)。各仕様書の
末尾の「rStats.js's choices」に書いてあります。choices はほかの節よりいつも優先します。クリーンルームの規則 (入口の文書) と
指示書の 4・5 節はそのまま守る。ウェブ検索は使わない。

## 0. こちらでしたこと

- **oracle を直しました。** `scripts/oracle.sh` は `oracle/` しかマウントせず、出力は `/out/<名前>.json` に書く決まりです。
  あなたの oracle は `experiments/` を `sys.source` で読み、標準出力に出していたので動きませんでした。実験のケースを補助
  ファイル `oracle/_tests19cases.R`・`oracle/_multivariate19cases.R` (名前が `_` で始まるものは oracle の一覧から外れる) に
  移し、6 つの oracle はそこから自分の分を選んで `/out` に書く形にしました。**oracle にケースを足すときは補助ファイルに
  足す** (`experiments/` の同じ名前のスクリプトとそろえる)
- **fixture を作りました:** `test/fixtures/{tamhane,page,grubbs,manova,lda,cancor}.json` (17・95・106・15・21・11 case。
  実験の JSON と全件同じ)。形は実験と同じ (`{ value, warnings, messages }` か `{ error, ... }`、行列は `{ rows, cols, values }`)
- choices の要点 (詳しくは各仕様書):
  - T2: T2 と T2' の両方。Welch の自由度は溢れない計算 (`t2_large_scale` は R が NaN、rStats.js は通常の値)。**群の順は
    R の `factor()` の順** (既存の `labelledGroups`。2026-11-22 にユーザーが「初出の順」から変更)
  - Page: **NA を含むブロックはエラー** (R は NA を最後の順位にする)。ベクトルの形の処理・ブロックの順も R の `factor()` の順
  - **Grubbs: 1.9.0 は type 10 だけ。** type 11・20 は名前を出す既知の未対応のエラー。`pgrubbs`・`qgrubbs` も type 10 だけ、
    q・p はベクトルで受ける。定数の x は p = NaN (R は 0)
  - MANOVA: 4 統計量、Roy は上界、型 I、`intercept`、階数不足はエラー
  - lda・cancor の**符号**: 列ごとに絶対値最大の成分を正にする決まった規則 (cancor は x の列で決め、y は相関が正になる向き)。
    R と列の符号が違いうる。**テストは列 (cancor は組) の符号を R にそろえてから全成分を比べる**。階数不足の lda は得点で比べる

## 1. 実装の順と置き場所

T2 → Page → Grubbs → manova → lda → cancor。1 つが CI 緑になったら Issue に短い報告 (コミット、テストの件数、10 万件の
時間) を書き、**止まらずに次へ進む**。6 つが済んだら段階 2 の報告をして止まる。

- T2: `src/htest/multipleComparisons.ts` (手本は `gamesHowellTest`)、`test/tamhaneT2Test.test.ts`
- Page: `src/htest/rankTests.ts` の隣、`test/pageTest.test.ts`
- Grubbs: `src/htest/grubbs.ts`、`test/grubbsTest.test.ts`。3 つとも `src/entries/tests.ts` から export
- manova・lda・cancor: `src/multivariate/` と入口 `src/entries/multivariate.ts`、`test/manova.test.ts` など。**manova が
  できたら Issue に「配線の依頼」と書く** (`package.json`・`scripts/`・`typedoc.json` はこちら)。配線までは
  `src/entries/multivariate.ts` から直接 import してテストしてよい

## 2. テスト (指示書 4・5 節が合格の条件)

- fixture の**全 case の全要素** (表は全行・全列、ラベル、`method`・`alternative` などの文字列、警告とエラーの文)。不一致は
  ラベル付きで集め、最後に `expect(mismatches).toEqual([])`。許容は相対 1e-12 から始め、広げるときは case 名と理由を書く
- choices で R と違うことにしたもの (T2 の溢れ、Page の NA、Grubbs の type 11・20 と定数、符号) は、R の値ではなく choices
  どおりの値を確かめるテストにし、どの choice のテストかをコメントに書く
- 端の入力: 尺度 1e±100・ずらし 1e8、10 万件 (指示書 5 節の大きさ)、NaN・Infinity、縮退
- `checkOptions` の行と生成のブロックは手で書かない (入口の文書)。`test/unknownOptions.test.ts`・`test/rIndexDoc.test.ts`
  の落ちはこちらが直す

# 段階 2 の指示: 実装 (1.11.0、Issue #560)

作成 2026-11-23 (Claude)。段階 1 は完了です (追加の調べを含む)。**Decisions はユーザーが決めました** (2026-11-23)。
各仕様書の末尾の「rStats.js's choices」に書いてあります。choices はほかの節よりいつも優先します。クリーンルームの規則
(入口の文書) と指示書の 4・5 節はそのまま守る。ウェブ検索は使わない。書き込んでよい場所は入口のとおり。

## 0. こちらでしたこと

- **oracle の直し:** `oracle/{acf,ca,mjca,sammon}.R` の `source("_...cases.R")` を `source("/oracle/_...cases.R")` に
  (コンテナの中では作業ディレクトリが `oracle/` ではない。1.10.0 の oracle と同じ形)
- **fixture:** `test/fixtures/{acf,ca,mjca,sammon}.json` (91・32・27・45 case、x86_64 の R・17 桁)。acf はこちらの実験の
  JSON と同じ。`auto_unbox = TRUE` なので、長さ 1 のベクトルはスカラーで入っている → テストの比較の側で配列に直す
- **isoMDS の結論の訂正:** あなたの表で、R の stress はどの case も「固定の順」の評価と一致し、primary は grid・
  eurodist・non-Euclidean で R より低い。つまり **R は primary を使っていない**。primary を続けると choices 7 (厳しく
  収束させた R と同じ解) に届かない。ユーザーの決定で **choices 8 = R と同じ固定の順** (安定な並べ替え、同点は
  下三角の列順のまま) に変えた
- choices の要点 (詳しくは各仕様書):
  - acf: `naAction` は `"fail"` と `"pass"` だけ。ccf は同じ長さだけ、ラグは整数。`clim` を返す
  - ca: `caSummary`・`caCoord` (10 種類) を入れる。R の summary が落ちる case も値を返す。符号は軸ごとに行と列で共通
  - **mjca: JCA は外す** (`lambda: "JCA"` はエラー)。adjusted・indicator・Burt
  - **sammon: R に合わせる** (4 回失敗で打ち切りも)。合格は既定の設定で R の途中の stress と最終の座標
  - **isoMDS: choices 8 (固定の順)・9 (再尺度なしの Stress-1) を先に直し、R の終点から始める試験をやり直す。最適化は
    自由 (choices 10)。届かなければ isoMDS は 1.11.0 から外す**

## 1. 実装の順と置き場所

acf・pacf・ccf (`src/timeseries/acf.ts`、export は `src/entries/timeseries.ts`) → ca・caSummary・caCoord
(`src/multivariate/ca.ts`) → mjca (`src/multivariate/mjca.ts`) → sammon (`src/multivariate/sammon.ts`) → isoMDS
(`src/multivariate/isoMDS.ts`、取り込んだ 1.10.0 の実装を直す)。ca・mjca・sammon・isoMDS の export は
`src/entries/multivariate.ts`。

1 つが CI 緑になったら Issue に短い報告 (コミット、R と比べた case の数と最大の誤差、指示書 5 節の大きな入力の時間) を
書き、**止まらずに次へ進む**。全部済んだら段階 2 の報告をして止まる。**isoMDS は最後**。sammon・isoMDS が届かない
ときは、そこで時間を使い切らずに根拠を報告する (外すかどうかはこちらが決める)。

## 2. テスト

- `test/<名前>.test.ts` (`acf`・`ca`・`mjca`・`sammon`、isoMDS は `test/isoMDS.test.ts` を直す)。fixture の**全 case・
  返す値の全要素**を R と比べる。不一致はラベル付きで集め、最後に `expect(mismatches).toEqual([])`。テストは**入口から
  import** する。**比べた case の数を数えて、fixture の case の数と等しいことも確かめる** (例外で途中で止まって不一致が
  出ないのを防ぐ)
- 許容は各仕様書の choices の値 (acf の相関は絶対 1e-13 など)。根拠のある最小に。広げて通さない、期待値を書き換えない
- ca・mjca・sammon・isoMDS の座標は列 (軸) の符号を R にそろえてから比べる (ca は行と列を同じに反転)。isoMDS の
  厳しい case は choices 7 の Procrustes
- R のエラーの case は、エラーになること (文は rStats.js のもの) を確かめる。警告は R の出力の `warnings` (value の横)
  から読み、文と数を比べる。R が落ちて rStats.js が値を返す case (ca の summary、mjca の小さな表) は、仕様書の独立の
  式と比べる
- 指示書 5 節の端の入力 (尺度・ずらし・大きさ・NaN と Infinity・縮退) もこの段階で入れる
- `test/demo.test.ts` の `NOT_IN_DEMO_YET` に新しい関数を足す。`test/unknownOptions.test.ts` の生成のブロックと
  `test/rIndexDoc.test.ts` の 2 件は、こちらがスクリプトで作り直すので落ちたままでよい

## 3. 報告

1 つずつの短い報告と、最後の段階 2 の報告 (関数ごとの比べた case の数・最大の誤差・大きな入力の時間、sammon と
isoMDS で R と合わなかったものの一覧) を Issue #560 に。最後にクリーンルームの確認 (ソースを使っていないこと、参照した
文献、流した実験の一覧)。

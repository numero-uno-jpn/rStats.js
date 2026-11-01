# Audit ledger

Repository: `numero-uno-jpn/rStats.js`

## Status definitions

| 状態 | 定義 |
|---|---|
| 未監査 | この台帳基準でまだ監査していない |
| 調査中 | 調査に着手したが結論が出ていない、または追加検証待ち |
| 問題未検出 | 調査した範囲では問題を発見していない。問題がないことを証明した意味ではない |
| 問題なし確認済 | 境界値・異常値・関連する性質など、定めた検証範囲を実行して問題がないことを確認した |
| 問題あり | 再現可能な不具合を確認した |

## Ledger policy

- 1行を1ソースファイルとする。監査対象のファイル単位で状態を管理する。
- `監査回` と `SHA` は、その行を監査した時点の対象ソースファイルの blob SHA を記録する。監査時点の repository HEAD は各監査セクションに記録する。
- `未監査` の行は監査回・SHAを `—` とする。
- `問題未検出` はソース確認だけ、または限定的な検証で問題が見つからなかった場合に使う。`問題なし確認済` は具体的な検証範囲と根拠が記録されている場合に限る。
- 同じ根本原因から生じる複数の症状は、同一 Issue にまとめる。
- Issue には領域ラベル・重要度ラベルを付け、再現入力、期待値の根拠、Rとの関係、検証範囲を記録する。
- 監査台帳にも `Rとの関係` と `期待値の根拠・検証範囲` を必須列として設ける。未監査ファイルは `—` とする。

## Bootstrap note

この台帳は監査 #94 で新規作成した。過去の監査 #69〜#93 の会話上の要約は存在するが、全ファイルへの対応付けと各回の repository SHA を裏付ける記録が現在の台帳・会話情報から復元できない。そのため、過去監査を実施済みと推定して状態を付けず、ファイル単位の再照合が済むまでは `未監査` とした。過去監査を再確認した際に、根拠と SHA が特定できた行から状態を移行する。

## Source files

| ファイル | 状態 | 監査回 | Source blob SHA | Issue | Rとの関係 | 期待値の根拠・検証範囲 |
|---|---|---:|---|---|
| `src/api-reference.ts` | 問題未検出 | #153 | `1e94b1e295f5a57aeb02a43e029117a9d67b0282` | — | 該当なし（Typedoc用のexport barrel。統計関数ではない） | 5行のexport宣言のみを確認。`index.js` と `entries/mixed.js` の再export、build対象外の設定コメントを確認。アルゴリズム・数値演算・入力処理は存在しない。機能的な不具合は認めず。 |
| `src/data/grouping.ts` | 問題あり | #154 | `1e94b1e295f5a57aeb02a43e029117a9d67b0282` | [#35](https://github.com/numero-uno-jpn/rStats.js/issues/35) | R 4.5.2由来のtapply/split/aggregate fixtureを閲覧（未実行）。`__proto__` はRとの直接照合ではなくJS object property semantics | factor levelsの15桁同一化・型混在拒否・欠損ラベル・column-major cross-classification・空cell、tapplyのscalar/non-scalar結果、splitのdrop/separator衝突、aggregate formulaの`.`/cbind/演算子展開、NA除外、複数値funの列展開を追跡。通常例: `tapply([1,2,3,4],["b","a","b","a"],v=>v.length)`、`split([1,2,3],["b","a","b"])`、`aggregate("y ~ g",{y:[1,2,3,4],g:["b","a","b","a"]},v=>v.reduce((a,b)=>a+b,0))`。確認した不具合: data-frame formのaggregateで `by` の列名 `__proto__` が `out[name]=...` により own propertyとして生成されずprototype setterに消費される。Issue #35。さらに巨大なcross productは`size`が配列上限を超えた場合にnative RangeErrorとなるが、独立した欠陥とはせず。fixture/test source閲覧、実行なし。 |
| `src/descriptive/basic.ts` | 追加監査済み・問題未検出 | #155, #299 | `e12c8f8c91152f8d617cd05bf07ce512ef00856a` | — | `test/descriptive.test.ts` と `test/fixtures/rbasic.json`、`summary.ts`、`extremes.ts`、`integer.ts` を閲覧（実行なし） | `values`/naRm、空配列、±0、NaN/±Inf、trim境界、weightedMeanの0/負/巨大weight、variance/sdのscale、medianの±MAX_VALUE、累積和/積の非有限遷移、diff validationを確認。具体入力: `mean([1,2,3],{trim:-1})`, `mean([1,2,3],{trim:0.5})`, `weightedMean([1e308,-1e308],[1,1])`, `weightedMean([1,2],[0,0])`, `prod([1e-300,1e-300,Infinity])`, `cumprod([1e308,1e308,0,-Infinity])`, `diff([1,2,3],{lag:1e308})`。新規再現不具合なし。Vitest/package runtime/R実行なし。 |
| `src/descriptive/cov.ts` | 問題あり | #156 | `1e94b1e295f5a57aeb02a43e029117a9d67b0282` | [#36](https://github.com/numero-uno-jpn/rStats.js/issues/36) | R 4.5.2由来cov/cor fixtureを閲覧（未実行）。ragged arrayはR matrixでは表現できないため入力形状validation問題 | matrix/vector dispatch、method/use abbreviation、everything/all.obs/complete.obs/na.or.complete/pairwise.complete.obs、pairwise rank、kendall covariance/tau-b、Pearson DD、n<2、complete rowsなし、matrix diagonalの特別処理を追跡。通常入力例: `cov([[1,2],[2,4],[3,5],[4,9]])`、`cor([1,2,3,4],[2,4,5,9],{method:"spearman"})`、`cov([[1,NaN],[2,3],[3,4]],{use:"pairwise.complete.obs"})`。確認した不具合: `isMatrix` は先頭行だけを見てmatrix判定し、`columns` は先頭行の列数で後続行を変換するため、`cov([[1,2],[3,4,5]])` は余分な5を黙って捨て、`cov([[1,2],[3]])` はundefinedを数値計算へ渡してNaNを生成する。全行の長さ検証がない。Issue #36。`test/descriptive.test.ts` とcov fixtureを閲覧、実行なし。 |
| `src/descriptive/dataFrames.ts` | 問題あり | #157 | `1e94b1e295f5a57aeb02a43e029117a9d67b0282` | [#35](https://github.com/numero-uno-jpn/rStats.js/issues/35) | R 4.5.2由来merge/subset/rbind/cbind fixtureを閲覧（未実行）。__proto__ behavior is JavaScript-specific | rowCount/column gather and type preservation, 15-digit numeric key text, missing-key matching, one/multi-key join, Cartesian many-to-many matches, allX/allY, sort order via Shell sort, suffix collision, subset filtering, rbind common-type coercion, cbind row count, fromRows/toRows and special property namesを追跡。具体例: `merge({id:[3,1,2],v:[10,20,30]},{id:[1,2,2,4],w:[0.5,1.5,2.5,3.5]})`、`subset({y:[5,NaN,7],g:["a","b","a"]},row=>row.y>4,{select:["g"]})`、`rbindFrames([{x:[1],g:[true]},{g:[false],x:[2]}])`、`fromRows([{id:"a",score:5},{id:"b"}])`。確認した不具合: `split` のdata-frame branchで `rowsOf` が列名を `out[name]=...` で設定するため、JSON.parseで作ったown `__proto__` 列が結果から失われ、通常objectのprototype setterに消費される。Issue #35。既存 `test/dataFrames.test.ts` / `test/fixtures/dataFrames.json` のR由来fixtureを閲覧、実行なし。 |
| `src/descriptive/factanal.ts` | 問題未検出 | #163 | `0198fd8d1f738d5bce2a65ad0ddf27c77af26a0b` | — | R 4.5.2由来factanal fixtureを閲覧（未実行）。最適化・回転・スコア式はソース上の数理検討 | `checkCovmat`/data dispatch、p/factor/dof境界、相関標準化、初期独自性、L-BFGS-B objective/gradient、固有値によるloadings、varimax正規化・SVD直交回転・列符号/順序、promax QR/Gram inverse、回帰/Bartlett scores、nObsの尤度比統計量を追跡。具体入力: `const R=[[1,.72,.63],[.72,1,.56],[.63,.56,1]]; factanal(null,1,{covmat:R})`、`factanal([[1,2,3],[2,1,2],[3,5,4],[4,3,6],[5,4,5]],1,{scores:"regression"})`、同データで`{scores:"Bartlett",rotation:"none"}`、`factanal(null,1,{covmat:R,nObs:100})`。既存 `test/factanal.test.ts` とR由来fixtureの引数・期待値・異常系を閲覧。新規の再現可能な不具合は確定せず。Vitest/package runtime/R実行なし。 |
| `src/descriptive/hist.ts` | 問題未検出 | #164 | `0198fd8d1f738d5bce2a65ad0ddf27c77af26a0b` | — | R 4.5.2由来hist/pretty/ecdf fixtureを閲覧（未実行）。極端な値とbreak境界はJS数値意味論で確認 | `pretty` finite-only filter、n/minN truncationとvalidation順、small-range/zero/tiny/subnormal/overflow range、1-2-5-10 unit selection、rho rounding、minN expansion、seqLength/overflow span、`hist` break vector/number/rule dispatch、1e6 cap、strict ordering、fuzz shift、right/includeLowestのbinary cell search、density/midpoint、`ecdf` NaN removal・±Infinity・lower-bound searchを追跡。具体入力: `pretty([0.3,9.6])`、`pretty([1e-300,1e-300])`、`pretty([-1e308,1e308])`、`hist([0,1,2,3],{breaks:[0,1,2,3],right:false})`、`hist([1,2,3],{breaks:[0,2,4]})`、`ecdf([-Infinity,0,Infinity])(0)`。既存 `test/pretty.test.ts` とhist/pretty fixtureを閲覧。新規の再現可能な不具合は確定せず。Vitest/package runtime/R実行なし。 |
| `src/descriptive/missing.ts` | 問題あり | #165 | `0198fd8d1f738d5bce2a65ad0ddf27c77af26a0b` | [#35](https://github.com/numero-uno-jpn/rStats.js/issues/35) | R 4.5.2由来complete.cases/na.omitの仕様を確認（今回R実行なし）。`__proto__` はJavaScript own-property semanticsに起因 | `isVector`/DataFrame dispatch、array/Float64Array、null/NaN欠損判定、複数引数の行数整合、zero-column/zero-row、complete-case mask、naOmitの型保持とFloat64Array復元を追跡。具体入力: `const x=JSON.parse('{"__proto__":[1,null],"v":[3,4]}'); completeCases(x); naOmit(x);`。completeCasesはown `__proto__`列をObject.values経由で欠損判定に含めるが、naOmitは出力を通常の`{}`に作り`out[name]=kept`とするため、`__proto__`がprototype setterとして扱われown列が消える。Issue #35へ同一根本原因の追加症状として追記。`test`に専用missing.ts fixture/testを確認できず。ソース意味論で確定、Vitest/package runtime/R実行なし。 |
| `src/descriptive/moments.ts` | 問題あり | #166 | `0198fd8d1f738d5bce2a65ad0ddf27c77af26a0b` | [#38](https://github.com/numero-uno-jpn/rStats.js/issues/38) | R 4.5.2/e1071/DescToolsの定義・fixtureを閲覧（未実行）。ragged rowsはR matrixでは表現できないためshape validationの問題 | `centralSums`のpower-of-two scaling・double-double mean・2/3/4次中心和、skewness/kurtosis type 1/2/3と最小標本数、geometricMeanの負数/zero/NaN、modesのties/±0、meanADのcenter、cv補正、scaleのcenter/scale指定・NaN・overflowed deviations・RMS救済を追跡。具体入力: `skewness([-1e308,1e308])`、`kurtosis([1e-200,2e-200,3e-200,4e-200])`、`geometricMean([1e308,1e-308])`、`meanAD([-1e308,1e308])`、`cv([-1,1])`、`scale([[1,2],[3,4]])`。確認した不具合: `scale`は行列入力の列数を先頭行だけで決め、後続行の長さを検証しない。`scale([[1,2],[3,4,5]],{center:false,scale:false})`は5を黙って無視し、`scale([[1,2],[3]],{center:true,scale:true})`はundefinedを平均/RMSへ混入させNaN列を返す。Issue #38。既存skewness/scale fixtureとscale invariance testsを閲覧。Vitest/package runtime/R実行なし。 |
| `src/descriptive/omega.ts` | 問題未検出 | #167 | `0198fd8d1f738d5bce2a65ad0ddf27c77af26a0b` | — | psych::omega R fixtureを閲覧（未実行）。仕様oracleのコメントと実装経路を照合 | pairwise-complete correlation/covmat normalization、SMC pseudo-inverse rank threshold、minres objective/gradient/bounds/Heywood warning、principal loadings/eigen clipping、varimax、quartimin gradient、oblimin BB step/non-monotone line search/2000 iteration warning、2-factor identification rule、Schmid-Leiman general/group loadings、flip/key、omegaH/omegaLim/alpha/omegaTot/G6/ECV/group assignmentを追跡。具体入力: `const R=[[1,.52,.36,.36,.36,.36],[.52,1,.36,.36,.36,.36],[.36,.36,1,.52,.36,.36],[.36,.36,.52,1,.36,.36],[.36,.36,.36,.36,1,.52],[.36,.36,.36,.36,.52,1]]; omega(null,{covmat:R})`、`omega(null,{nfactors:1,covmat:R})`、`omega(null,{nfactors:2,covmat:R})`。既存 `test/omega.test.ts` とR fixtureの1/2/3-factor cases・known one-factor zero differencesを閲覧。新規の再現可能な不具合は確定せず。Vitest/package runtime/R実行なし。 |
| `src/descriptive/pivot.ts` | 問題あり | #168 | `e22826429f71e15fb26749fbc3bb1dc7430ccdb4` | [#39](https://github.com/numero-uno-jpn/rStats.js/issues/39) | tidyr pivot fixture (R 4.5.2)を閲覧（未実行）。own-property境界はJavaScript仕様で確定 | `pivotLonger` の列選択/重複/regex captureとseparator、namesTo/.value、型統合、行順、valuesDropNa、namesTransform、Float64Array保持、警告重複排除、`pivotWider` のID/name組合せ・sort・重複セル・summary/fill・namesVary・生成列名を追跡。具体入力: `const d=JSON.parse('{"id":[1,2],"key":["a","b"],"__proto__":[5,6]}'); pivotWider(d,{namesFrom:"key",valuesFrom:"__proto__",idCols:["id"],valuesFill:{}})`。`perColumn()` が `option[name]` で継承プロパティまで読むため、指定していない`valuesFill`に`Object.prototype`が返り、欠損セルにオブジェクトが入る。`valuesFn`にも同じlookup問題。Issue #39。既存 `test/pivot.test.ts` とtidyr由来fixtureの全経路・型保持テストを閲覧。Vitest/package runtime/R実行なし。 |
| `src/descriptive/quantile.ts` | 問題未検出 | #169 | `e22826429f71e15fb26749fbc3bb1dc7430ccdb4` | — | R 4.5.2由来quantile fixtureを閲覧（未実行）。9種のHyndman-Fan定義は式を直接確認 | type 1–9の位置式/fuzz、端点clamp、空標本・NaN/NA除去、同値±Infinity補間回避、IQR overflow意味、fivenum hinge/midpoint、MAD low/highと欠損数・center/constantを追跡。具体入力: `quantile([-Infinity,Infinity],0.25,{type:7})`、`quantile([1,2,3,4],0.5,{type:1})`、`quantile([1,2,3,4],NaN)`、`fivenum([-Number.MAX_VALUE,Number.MAX_VALUE])`、`mad([1,2,3,4],{low:true})`、`mad([1,2,3,4],{high:true})`。既存 `test/descriptive.test.ts` とR 4.5.2 quantile fixtureを閲覧。NaN probabilityはNaN返却、type7の異符号無限大補間はNaNとなる仕様上の演算。新規の再現可能な欠陥は確定せず。Vitest/package runtime/R実行なし。 |
| `src/descriptive/rank.ts` | 問題未検出 | #170 | `e22826429f71e15fb26749fbc3bb1dc7430ccdb4` | — | R 4.5.2由来rank fixtureを閲覧（未実行）。ties randomは共通R RNGを利用 | NaN keep/first/last、±Infinityと同値tie、signed zero、全欠損/空、6 tiesMethod、naLast rank offset、random tieのuniform drawとstable fallbackを追跡。具体入力: `rank([Infinity,1,Infinity,-Infinity])`、`rank([NaN,3,NaN,1],{naLast:"first"})`、`rank([NaN,3,NaN,1],{naLast:"last"})`、`rank([-0,0,1])`、`setSeed(17); rank([2,1,2,1],{tiesMethod:"random"})`。sort comparatorはInfinity-InfinityのNaNを同順位として扱い、NaN入力は別処理。新規の再現可能な欠陥は確定せず。Vitest/package runtime/R実行なし。 |
| `src/descriptive/table.ts` | 問題未検出 | #171 | `e22826429f71e15fb26749fbc3bb1dc7430ccdb4` | — | R 4.5.2由来table/cut/findInterval fixtureを閲覧（未実行）。bin boundaryをソース比較 | `tabulate` truncation/nbins/NaN/±Inf/large bin、table numberLevelsと15-digit grouping/useNA、unique NaN/-0、cut generated/vector breaks・duplicate/NaN・right/includeLowest、findInterval sorted validation/duplicate endpoints/empty vec/rightmostClosed/allInside/leftOpenを追跡。具体入力: `tabulate([1.9,2.9,0,-1,NaN])`、`table([1,1+Number.EPSILON,NaN],{useNA:"always"})`、`unique([-0,0,NaN,NaN])`、`cut([0,1,2],[0,1,2],{right:false,includeLowest:true})`、`findInterval([-Infinity,0,1,Infinity],[0,1],{leftOpen:true,rightmostClosed:true})`、`findInterval([1],[])`。既存 `test/descriptive.test.ts` とR由来table fixtureを閲覧。巨大nbinsはメモリ/実行環境依存のため再現欠陥として扱わず。新規の再現可能な欠陥は確定せず。Vitest/package runtime/R実行なし。 |
| `src/distributions/arcsine.ts` | 問題未検出 | #95 | `058fff6bf6d780aec1f369ca7520bbc50ef11471` | — | Rでは未確認（base R・extraDistrに対応関数なし） | 密度・CDF・分位点の解析式と mpmath 1.4.1 の領域別fixtureを照合対象として確認。実行未確認。 |
| `src/distributions/beta.ts` | 問題未検出 | #99 | `9cb145a85e8153ea0712e2fd38b65885e5a016e5` | — | Rと同じ（通常 fixture は R 4.5.2 由来。今回R実行なし） | `dbeta1`/`pbeta1`/`qbeta1` の支持域端点、shape=0/∞の点質量、shape=1、上下尾・logP、巨大shape・極小shape・subnormal x、分位点の左右反転と極集中分布への経路をソース追跡。`test/beta.test.ts` と CHANGELOG の具体例（例: `pbeta(1.5e-236, 9220.5, 2.6e301)`、`qbeta(3.8e-277, 27.9, 1.5e299)`）を確認。fixture/テストは閲覧のみで実行せず、独立runtime harness・全Vitest・R比較なし。 |
| `src/distributions/binomial.ts` | 問題未検出 | #101 | `8e360c3fb4481da28f2e8eba5fb8d9918af3263f` | — | Rでは未確認 | `dbinom1`/`pbinom1`/`qbinom1` の入力検証、支持域端点、prob=0/1、非整数qの `floor(q + 1e-7)`、2^53超の補正経路、上下尾・logP、離散分位点探索をソース追跡。mpmath由来の `audit_pbinom` fixtureと既存 `qbinom` fixtureを閲覧。fixture/Vitest/package runtime/R実行なし。
| `src/distributions/bvnorm.ts` | 問題あり | #94 | `05e52efbc8f54e505da82fb10555834a02666e46` | [#23](https://github.com/numero-uno-jpn/rStats.js/issues/23) | Rでは未確認 | 完全負相関の恒等式 `Y=-X` による解析値。独立CDF計算。 |
| `src/distributions/cauchy.ts` | 問題あり | #98 | `6a3eedcc2d465be8e7bbb614884e1a95ea22180d` | [#25](https://github.com/numero-uno-jpn/rStats.js/issues/25) | Rでは未確認 | `dcauchy(1.1e308, { location: 0, scale: 1e308 })`。Cauchy密度の閉形式を安全な演算順序で評価した値は約 `1.44031622707598e-309`。現行の `y / (Math.PI * scale)` は `Math.PI * scale` がInfinityとなり0。log密度経路のexp値でも照合。JS式の独立ハーネスで再現、Vitest/R未実行。 |
| `src/distributions/chisq.ts` | 問題あり | #100 | `94e98787221087403c05cdb46f69f55c0760823b` | [#26](https://github.com/numero-uno-jpn/rStats.js/issues/26) | Rと同じ（負の自由度は無効。今回R実行なし） | `df=-Number.MIN_VALUE`（-5e-324）は `df<0` だが `df/2` が `-0` に丸められる。`chisq.ts` が先に `df/2` を渡し、gamma側では `shape<0` が偽・`shape===0` が真となり、`dchisq(0,df)=Infinity`、`dchisq(1,df)=0`、`pchisq(1,df)=1`、`qchisq(0.5,df)=0` 相当のshape=0経路に入る。IEEE-754の丸めと `gamma.ts` の分岐をソース追跡。package/Vitest/R未実行。 |
| `src/distributions/exponential.ts` | 問題あり | #102 | `1aaef113968bfa70a39ed2c501e3b65238763409` | [#27](https://github.com/numero-uno-jpn/rStats.js/issues/27) | Rも誤り | `pexp(1e-20, { rate: 1e-300, logP: true })`。現行値 -736.8272408909739、数学的期待値 ln(1e-320) = -736.8272297580946。`mulDD`/`twoProd` の subnormal 積で残差が失われ、`logOneMinusExpNeg` が丸め済み積を対数化する。既存 known-violation が同じR値を記録。高精度Decimal計算とソース追跡。実行/Vitest/今回のR照合なし。
| `src/distributions/f.ts` | 問題あり | #138 | `f6d0a8e51cbd301536a2e29a3d6b110a814c6e26` | [#32](https://github.com/numero-uno-jpn/rStats.js/issues/32) | Rとの実行比較なし。F分布の df2→∞ 極限（χ²(df1)/df1）を期待値の根拠にした | `df(1, 1, 1e308)`。`m<2` 密度式の係数 `2 * (m+n) * p` で `2*(m+n)` が先にInfinityへoverflowし、係数が0になる。df2→∞での密度期待値は `exp(-0.5)/sqrt(2π) ≈ 0.24197072451914337`。ソース演算順序と極限式で確定。Vitest/package runtime/R実行なし。中心Fの密度・CDF・quantileの境界と特殊df経路をソース追跡。
| `src/distributions/gamma.ts` | 追加監査済み・問題未検出 | #120, #300 | `e9ba1c35ef88e77e84a392562bb7f62378fcbf7f` | — | `test/gamma.test.ts`、dgamma/pgamma/qgamma fixtures、mpmath監査fixture、`igam.ts`、`igami.ts`、`invert.ts`、`ddexp.ts` を閲覧（実行なし） | rate/scale整合とsubnormal rate、x=0/shape=0/1/Inf、tiny yのlog密度、CDF tiny lower/upper log tail、shape=Inf、tiny quantile/深い裾/scale overflowを確認。具体入力: `dgamma(0,0.5,{scale:2})`, `dgamma(1e-320,1e306,{scale:1e138,log:true})`, `pgamma(1e-310,5e-324,{scale:1,lowerTail:false,logP:true})`, `qgamma(3.3e-160,0.5,{rate:4.2e-319})`, `qgamma(0.5,1e-310)`。`pgamma(Infinity,892.4,{rate:2.8e-316})` はRと異なり1を返す設計上の端点差（ソースコメントに明記）。新規不具合とは扱わない。Vitest/package runtime/R実行なし。 |
| `src/distributions/geometric.ts` | 問題未検出 | #103 | `fe88f1b31ddb3a69cef524aeb9aa5dd08509e0a8` | — | Rと同じ（通常 fixture は R 4.5.2 由来。今回R実行なし） | `dgeom1`/`pgeom1`/`qgeom1`、`probPair`/`qPow` の通常・subnormal・巨大整数経路、支持域・入力検証、上下尾・logP、離散分位点の境界補正をソース追跡。R 4.5.2由来の d/p/qgeom fixture（計6112ケース）を閲覧。CHANGELOGの `pgeom(1e290, 5e-324)` と `pgeom(8.7e299, 1.1e-300)` の修正記録も照合。fixture/Vitest/package runtime/R実行なし。 |
| `src/distributions/hypergeometric.ts` | 追加監査済み・問題未検出（巨大整数域は追加実行検証要） | #139, #301 | `557f15ed94b73d98cc3606838441c05fcf94dca3` | — | `test/hyper.test.ts`、dhyper/phyper/qhyper R fixtures、`audit_phyper.mpmath.json` を閲覧（実行なし） | half-even rounding/relative nonInt tolerance、support端点、退化k=0/k=N、binomialLimit、Loader PMF、tail ratio recurrence/幾何remainder、CDF floor(q+1e-7)、discrete quantile searchを追跡。具体入力: `dhyper(0,0,5,3)`, `dhyper(2,10,7,8)`, `phyper(-1,10,10,5)`, `phyper(5,10,10,8,{lowerTail:false})`, `qhyper(0.5,10,10,5)`。`phyper/qhyper`はsupport上端2^53超を拒否する一方、`dhyper`はguardなし。巨大整数密度は追加runtime検証が必要だが今回誤答は再現せず。Issue化せず。 |
| `src/distributions/invgamma.ts` | 追加監査済み・問題未検出 | #140, #302 | `942dc8bfc3a11295a8f7ac3f8df2decf757dac28` | — | dinvgamma/pinvgamma/qinvgamma R/mpmath fixtures、gamma helperを閲覧（実行なし） | 逆数gamma変換、beta/x subnormal・overflow、double-double correctionのalpha=1e15切替、log密度補正、CDF tail反転、tiny quantile reciprocal、alpha=Inf境界を確認。具体入力: `dinvgamma(1e-300,2,{beta:1e-300})`, `pinvgamma(1e-300,2,{beta:1e-300,lowerTail:false,logP:true})`, `pinvgamma(0,Infinity,{beta:1})`, `pinvgamma(1e-300,Infinity,{beta:1})`, `qinvgamma(1e-300,2,{beta:1e-300})`。alpha=Infかつq=0でCDF=0はR 4.5.2 fixtureにも明示。新規再現不具合なし。 |
| `src/distributions/kumaraswamy.ts` | 追加監査済み・問題未検出 | #141, #303 | `ae73aa5f4ac85b344ea32f626854693a50409563` | — | dkumar/pkumar/qkumar R/mpmath fixturesを閲覧（実行なし） | x=0/1 density、a=Inf退化点質量、b有限条件、`1-x^a` expm1/log1p、subnormal `a log x`/`x^a`、tiny b、quantile logP・1/a overflow・reciprocal correctionを追跡。具体入力: `dkumar(0,0.5,2)`, `dkumar(1,2,0.5)`, `dkumar(1-Number.EPSILON,2.6e-300,0.29)`, `pkumar(0.2,0.42,1.85e-317,{logP:true})`, `qkumar(4.8e-52,9.9e-314,2.5)`。新規再現不具合なし。Vitest/package runtime/R実行なし。 |
| `src/distributions/laplace.ts` | 追加監査済み・問題未検出 | #142, #304 | `782524ad81cfd416c0582e8f6b6b31170d3db88f` | — | dlaplace/plaplace/qlaplace R/mpmath fixtures、`ddexp.ts` helperを閲覧（実行なし） | mu finite/±Inf、sigma finite positive、x=±Inf/NaN、2*sigma overflow、subnormal exp division、左右tail/logP、quantile log-tail/locationScale overflowを確認。具体入力: `dlaplace(Number.MAX_VALUE,{mu:-Number.MAX_VALUE,sigma:1,log:true})`, `dlaplace(0,{mu:0,sigma:1e308})`, `plaplace(Infinity,{mu:0,sigma:1})`, `plaplace(0,{mu:Infinity,sigma:1})`, `qlaplace(1e-320,{mu:1,sigma:2})`。新規再現不具合なし。Vitest/package runtime/R実行なし。 |
| `src/distributions/logistic.ts` | 追加監査済み・問題未検出 | #143, #305 | `76cd8b85c520932b5980baa16cc3d4ce483eb872` | — | dlogis/plogis/qlogis R fixtures、`ddexp.ts` helperを閲覧（実行なし） | scale<=0/±Inf、location±Inf、standardization overflow、subnormal density、logit central/tail branches、tail reflection、zero-scale quantileを確認。具体入力: `dlogis(-745,{scale:1})`, `dlogis(-3.5667197e-316,{scale:4.81926e-319})`, `plogis(1e300,{location:-1e300,scale:1e300,lowerTail:false,logP:true})`, `qlogis(1e-320,{scale:1e-300})`, `qlogis(0.5,{location:3,scale:0})`。新規再現不具合なし。Vitest/package runtime/R実行なし。 |
| `src/distributions/lognormal.ts` | 追加監査済み・問題未検出 | #144, #306 | `2d955d68f6d973a4108450c6b1ae7fa3eb1fc204` | — | dlnorm/plnorm/qlnorm R/mpmath fixtures、`erf.ts` とnormal呼出経路を閲覧（実行なし） | x<=0、sdlog=0/Inf、meanlog±Inf、double-double z/z²、subnormal density、normal tails、quantile Newton refinement/巨大sdlogを確認。具体入力: `dlnorm(1e-100,{meanlog:-100,sdlog:3})`, `dlnorm(2e-105,{meanlog:1.53,sdlog:6.36})`, `plnorm(1e-300,{meanlog:0,sdlog:1,logP:true})`, `qlnorm(1e-30,{meanlog:0,sdlog:9e307})`, `qlnorm(0.5,{meanlog:0,sdlog:Infinity})`。新規再現不具合なし。Vitest/package runtime/R実行なし。 |
| `src/distributions/multinomial.ts` | 問題あり | #96 | `ac5d64a614debaa2922754bd257f2b8286619518` | [#24](https://github.com/numero-uno-jpn/rStats.js/issues/24) | Rでは未確認 | 中央二項確率の解析式と Stirling 漸近、IEEE-754 中間積の独立計算。実パッケージ実行・R比較なし。 |
| `src/distributions/nbeta.ts` | 問題あり | #145, #307 | `5c51760f6e136b80a77b4284da39c25b0ab8ed86` | #63 | `test/nbeta.test.ts`、d/p/qnbeta R/mpmath fixtures、非心F同一module内呼出経路を閲覧（実行なし） | Poisson mixture/leftTailLog、gamma/w/chisq/integral切替、beta kernel比、shape correction、CDF tails、density endpoints、quantile search、非心F変換を追跡。確定入力: `pbeta(0.5,100000000000000,2,{ncp:Number.MIN_VALUE})`。`mu=ncp/2`が0へunderflow、`log(mu)=-Infinity`、j=0で`0*(-Infinity)=NaN`。NaNがCDFへ伝播。非心F `pnfRaw`も同じ`pnbetaRaw`を使う。Issue #63作成。Vitest/package runtime/R実行なし。 |
| `src/distributions/nchisq.ts` | 問題あり | #146, #308, #310 | `9549791940c425d508057b7286329b396ca36c6f` | [#64](https://github.com/numero-uno-jpn/rStats.js/issues/64) | `test/nchisq.test.ts`、dnchisq/pnchisq/qnchisq R/mpmath fixturesと`poissonMixture.ts`を再読（実行なし） | df/ncp finite validation、Bessel Hankel/Debye thresholds、subnormalHalf、Chernoff/asymptotic切替、Poisson mixture tail選択を確認。再現入力: `pchisq(9e-301,1,{ncp:1e308,lowerTail:true})`。`mu=5e307`、`sqrt(ncp)*sqrt(x)≈9486.83`でBessel Hankel cutoff 1e4未満、df=1でDebye cutoff対象外。xはnormalでsubnormalHalfも不使用。lower tailから`mixtureTail→sumLower→startSearch`へ入り、2^53超のindexを1ずつ減らすループが進行しない。Issue #64。実行検証なし。 |
| `src/distributions/negbinomial.ts` | 一部監査・問題未検出 | #147 | `557cdff4132642faad75bcd95ddbbfeca8a90eec` | — | R 4.5.2由来d/p/qnbinomおよびmu parameterization fixture、mpmath fixture、既存testを閲覧（未実行） | `prob`/`mu`排他指定、fromMuのoverflow回避double-double比、Loader density、subnormal size補正、x>2^53 CDF補正、upperSeries、Cornish-Fisher/gamma開始値、Newton/secant refine、離散quantile探索、size/mu=0/Inf境界を追跡。具体的入力: `dnbinom(58,3.94e-315,{prob:0.125,log:true})`、`pnbinom(1e16,1e16,{prob:0.5})`、`qnbinom(2.2e-284,2.7e37,{prob:1.9e-279})`、`dnbinom(3,5,{mu:4})`。既知の巨大整数・subnormal対応分岐を確認。新規再現不具合なし。Vitest/package runtime/R実行なし。
| `src/distributions/normal.ts` | 問題あり | #148 | `3d9623ccac1dc46974fd7f01cbcbb44e931cfcb6` | [#33](https://github.com/numero-uno-jpn/rStats.js/issues/33) | R 4.5.2由来のpnorm/qnorm fixtureを参照（未実行） | pnormStdのlower-tail logP経路で `a*a` が先にoverflowすることを確認。`pnorm(-1.5e154,{logP:true})` では `a²/2=1.125e308` が有限なのに `(a*a)/2` がInfinityとなり、有限のlog probabilityを`-Infinity`にする。`dnorm1`の`0.5*z*z`は左結合で同じ入力ではこの問題を起こさないため対象外。ソース演算順序とbinary64範囲による確認。Vitest/package runtime/R実行なし。 |
| `src/distributions/nt.ts` | 一部監査・問題未検出 | #149 | `3d9623ccac1dc46974fd7f01cbcbb44e931cfcb6` | — | R 4.5.2由来d/p/qnt fixture、mpmath由来積分fixture、既存回帰テストを閲覧（未実行） | w=log(U/a)変数変換、gammaLogのsubnormal a近似、integrandのdouble-double経路、peak探索、trapezoidのstep halving/打切り、formula A/B切替、Laplace法の誤差条件、far-tail power law、nearZero、巨大df極限、非心度±Inf、qntの符号判定とlog-tail反転を追跡。具体的入力: `pt(-30.268742563306827,100100312298908620,{ncp:2.475805900718761,logP:true})`、`dt(2.3074923907795758e54,100100312298908620,{ncp:2.475805900718761,log:true})`、`pt(0.001,2e-6,{ncp:40,logP:true})`、`qt(1.4426402575659767e-62,5.449761356942939e-96,{ncp:48.87598483697083})`。既存test/nt.test.tsの極端な自由度・非心度ケースと照合。新たな再現不具合は確定せず。Vitest/package runtime/R実行なし。 |
| `src/distributions/pareto.ts` | 一部監査・問題未検出 | #150 | `3d9623ccac1dc46974fd7f01cbcbb44e931cfcb6` | — | extraDistr由来d/p/qpareto fixtureとmpmath fixtureを閲覧（未実行） | a=Infinityの点質量極限、x=bの密度端点、x<b/±Inf、ratioのdouble-doubleとlogRatioDD切替、a*e補正の適用条件、subnormal tail log、qparetoのexp overflow後のbとの積を追跡。具体的入力: `dpareto(1.1e-263,{a:1640,b:7.8e-264,log:true})`、`ppareto(318.7041047333832,{a:1.040734e-317,b:1,logP:true})`、`qpareto(0.5,{a:1e308,b:1e-308})`。既知回帰値の背景とソース分岐を確認。新たな再現不具合は確定せず。Vitest/package runtime/R実行なし。 |
| `src/distributions/poisson.ts` | 問題未検出 | #104 | `1dfe5fed11b61ba734bbf1b6b99df58c2ede61bb` | — | Rと同じ（R 4.5.2由来fixture・mpmath独立fixtureあり。今回R実行なし） | `dpois1`/`ppois1`/`qpois1`、`dpoisRaw`・`gammaInc`・`discreteQuantile` の連携を追跡。lambda=0/∞、q・xの支持域端点、NaN/Inf、非整数q、上下尾・logP、2^53超の補正、巨大lambda/subnormal tail、分位点境界と探索停止を確認。R fixture dpois 1,448件・ppois 2,896件・qpois 1,696件、および mpmath ppois 1,474件・qpois 250件を閲覧。CHANGELOGの `ppois(1e16,1e16)` の2^53超補正、lambda>1e6の5〜40σ tail精度改善、`qpois` lambda≈1e20の非終了修正を照合。fixture/Vitest/package runtime/R実行なし。 |
| `src/distributions/signrank.ts` | 一部監査・問題未検出 | #151 | `3d9623ccac1dc46974fd7f01cbcbb44e931cfcb6` | — | R由来dsignrank/psignrank/qsignrank fixtureと既存property regressionを閲覧（未実行） | nのhalf-even丸め、x/qの整数化規則、支持域端点、subset-sum DPの降順更新、2^900スケーリング、minTrustedによる精度判定、low table再構築、Kahan累積、対称性を使った小さいtail直接計算、log確率、LRU cache budget、MAX_LEN拒否、離散quantile探索を追跡。具体的入力: `dsignrank(0,1100)`、`psignrank(40,10,{lowerTail:false})`、`qsignrank(0.025,10)`、`dsignrank(20,1100)`。中心まで拡張済みのテーブルから低位確率を読む既知回帰条件も確認。新たな再現不具合は確定せず。Vitest/package runtime/R実行なし。 |
| `src/distributions/summary.ts` | 問題あり | #152 | `3d9623ccac1dc46974fd7f01cbcbb44e931cfcb6` | [#34](https://github.com/numero-uno-jpn/rStats.js/issues/34) | R関数ではないためR直接照合対象外。Pareto分布の閉形式とa→∞極限を期待値根拠に使用 | 全分布switchのパラメータ検証、モーメント存在境界、中央値/最頻値の定義、central moment積分の収束判定、raw moment log fallback、巨大shapeでのoverflow回避経路を追跡。Pareto枝で `distSummary("pareto",{a:1e308,b:1e308})` は、平均・分散・sd・歪度・尖度の中間積がoverflowし、有限の極限値をInfinity/NaNにする。数学的期待値はmean≈1e308、variance≈1、sd≈1、skewness≈2、excess kurtosis≈6。追加確認入力: `distSummary("norm",{sd:1e200})`、`distSummary("lnorm",{meanlog:0,sdlog:1e-200})`、`distSummary("hyper",{m:0,n:0,k:0})`。ソース演算順序と分布の閉形式で確認。Vitest/package runtime/R実行なし。 |
| `src/distributions/t.ts` | 問題未検出 | #158 | `e18cb49f91c4d5667c40323080d741b3d2696738` | — | R 4.5.2由来t分布fixtureを閲覧（未実行）。極端な引数はJS/数値解析上の検討 | `dtDensity1` のdf<=0/∞/HUGE_DF/TINY_DF分岐、x=0/±∞、tiny-df密度近似、`dtCore` のtwoProd・大x漸近・bd0経路、`pt1` の上下尾とtiny-df近似・beta引数の共通スケーリング、`qt1` の確率境界・極小df逆変換・深い裾の初期値・最大有限double判定・Newton/Brent委譲を追跡。具体入力: `dt(0,5)`、`dt(1.5e154,1e308,{log:true})`、`pt(-3.5e151,4.3e121,{logP:true})`、`qt(0.499999999,1e-10,{lowerTail:false})`、`qt(1e-5,1e-310,{lowerTail:false})`、`qt(3.048e-196,0.633)`。コードコメント記載の過去回帰例と経路を照合し、新規に再現可能な欠陥は確定せず。Vitest/package runtime/R実行なし。 |
| `src/distributions/triangular.ts` | 問題未検出 | #97 | `6077b7d90cf06effb6e9ba4d08e6414b64c790a2` | — | Rと同じ（通常ケースは extraDistr の比較fixtureあり。今回R実行なし） | 三角分布の解析式、固定数値の既存extraDistr/mpmath fixture、端点モード・幅overflow/underflowの既存テストをソース照合。Vitest・Rは未実行。 |
| `src/distributions/tukey.ts` | 問題未検出 | #159 | `e18cb49f91c4d5667c40323080d741b3d2696738` | — | R 4.5.2由来fixtureとRmpfr参照値の生成説明を閲覧（未実行）。R `ptukey` の精度制限も区別 | Clenshaw-Curtis重み/係数・収束判定・区間分割上限、狭い正規窓積分とshift補正、log W/補数積分、Chebyshev曲線cacheと端点外挙動、nrangesによる最大値分布、Gamma外側積分・large-df極限、deep-tail log積分、ptukey/qtukeyの確率境界とBrent bracketを追跡。具体入力: `ptukey(3.5,3,12)`、`ptukey(0.5,1000,10)`、`ptukey(2.5e118,4,3,{nranges:2,lowerTail:false,logP:true})`、`qtukey(1.5e-287,3,4.7e10,{nranges:2,lowerTail:false})`。既存 `test/tukey.test.ts`・`test/tukey-quantile.test.ts` とRmpfr 160-bit参照生成の説明を閲覧。新規の再現不具合は確定せず。Vitest/package runtime/R実行なし。 |
| `src/distributions/uniform.ts` | 問題未検出 | #160 | `e18cb49f91c4d5667c40323080d741b3d2696738` | — | Rと同じ（`test/helpers/distributionKnown.ts` にR 4.5.2で確認されたlog-tail/subnormal差異の記載）。今回R実行なし | `dunif1`/`punif1`/`qunif1` の支持域、min=maxの退化分布、有限端点条件、幅 `max-min` overflow時の1/2 scaling、端点比較、上下尾の直接比、logP、subnormal確率の丸め、確率境界と極端な端点を確認。具体入力: `dunif(0.5,{min:-1e308,max:1e308})`、`punif(1e-300,{lowerTail:false,logP:true})`、`punif(0.999,{min:-1,max:1,logP:true})`、`punif(1e-300,{min:0,max:1e308,logP:true})`、`qunif(0.25,{min:-1e308,max:1e308})`、`punif(1,{min:1,max:1})`。degenerate min=maxのCDFはstep functionとして実装され、密度のNaN仕様と混同しない。既知差異はRとの一致を目的とするもの。新規不具合は確定せず。Vitest/package runtime/R実行なし。 |
| `src/distributions/weibull.ts` | 問題未検出 | #161 | `e18cb49f91c4d5667c40323080d741b3d2696738` | — | R 4.5.2由来d/p/qweibull fixtureを閲覧（未実行）。コメント内のR互換性・既知回帰例も確認 | `logU` のsubnormal/overflow ratio fallback、double-double指数形成、shape<1/＝1/>1のx=0密度、scale/shape Infinityの分岐、pweibullの下尾log小確率・上尾log、qweibullのlogP極小確率特別経路、scaleとの積でのunderflow回避を追跡。具体入力: `dweibull(1.9e-255,6.6e306,{scale:98.6})`、`pweibull(1e-5,1000,{logP:true})`、`qweibull(-720.6,1,{scale:1.36e257,logP:true})`、`dweibull(0,0.5,{scale:2})`、`pweibull(Infinity,2)`。新規の再現不具合は確定せず。Vitest/package runtime/R実行なし。 |
| `src/distributions/wilcox.ts` | 問題あり | #162 | `e18cb49f91c4d5667c40323080d741b3d2696738` | [#37](https://github.com/numero-uno-jpn/rStats.js/issues/37) | Rと同じ分布の整数support。今回R実行なし。`2^53`境界の不具合はJS Numberの整数表現限界に起因 | `wilcoxParams` のhalf-even丸め・正整数条件・mn上限、qの`floor(q+1e-7)`、対称性、q-binomial係数のdouble-double再帰、rescale/minTrusted/cache/valid prefix、CDF上下尾、discrete quantileを追跡。具体的な境界再現: `const m=3,n=3002399751580331,q=2**53;`。厳密な整数積は`9007199254740993`だがbinary64の`m*n`は`9007199254740992`へ丸められ、検証条件`m*n > 2**53`を通過する。その後`pwilcox1`の`x >= m*n`が真となり、`pwilcox(q,m,n,{lowerTail:false,logP:true})`を`-Infinity`で返す。しかしqは真のsupport上端より1小さく、上側確率は端点質量`1/choose(m+n,m)>0`（logは約`-105.1`）。Issue #37。ほかに`dwilcox(0,1050,1050,{log:true})`のscale救済、中心部で精度保証できない場合のRangeError境界も確認。既存wilcox fixture/test sourceを閲覧、実行なし。 |
| `src/entries/descriptive.ts` | 問題未検出 | #172 | `e22826429f71e15fb26749fbc3bb1dc7430ccdb4` | — | re-export barrel。実装本体とのexport対応を静的確認（R実行対象外） | `descriptive` entryの全re-exportについてsource path、named exports、option/type exports、grouping/dataFrame/pivotの公開経路を照合。具体確認: `import * as d from "./entries/descriptive.js"` に相当するexport表と、`src/descriptive/{basic,quantile,rank,cov,table,missing,hist,moments,dataFrames,pivot}.ts` および`src/data/grouping.ts`のexport宣言を比較。欠落/重複/存在しないsymbolの再現可能な問題は確認せず。barrel単体に数値アルゴリズムなし。TypeScript build/package runtime未実行。 |
| `src/entries/distributions.ts` | 問題未検出 | #173 | `c06da849afc7406f4f2a37e6387a4febab3306d8` | — | package exports / bundle AREAS / implementation module pathsを静的照合 | d/p/q分布、追加分布、乱数関数、RNG state/stream、型exportを各実装moduleへ追跡。具体確認: `dnorm/pnorm/qnorm`→normal、`dhyper/phyper/qhyper`→hypergeometric、`distSummary`→summary、`setSeed/RNGkind`→rng、`sample`→sample、`r2dtable`→r2dtable。`package.json`の`./distributions`、`scripts/bundle.mjs`のAREASと一致。barrel内の独自演算なし。export名/パスに明白な不整合なし。TypeScript build/runtime未実行。 |
| `src/entries/linalg.ts` | 問題未検出 | #174 | `c06da849afc7406f4f2a37e6387a4febab3306d8` | — | package exports / bundle AREAS / implementation module pathsを静的照合 | crossprod/backsolve、norm、chol/chol2inv、QR family、solve/det/rcond、SVD、kappa/ginv、eigen、Schur、expm、matrix operations、LU/prcompと各型exportを追跡。具体確認: `qrQ/qrR/qrCoef/qrSolve`→qr、`determinant/rcond`→solve、`matMul/kronecker/seq`→ops、`prcomp/lu`→lu。`MatrixInput/VectorOrMatrix`型のmatrix module参照を確認。`package.json`の`./linalg`とbundle entryに一致。barrel内の独自演算なし。型チェック/build/runtime未実行。 |
| `src/entries/mixed.ts` | 問題未検出 | #175 | `c06da849afc7406f4f2a37e6387a4febab3306d8` | — | package exports / bundle AREAS / model module pathsを静的照合 | `lmer`とLmerResult/Options等の型、`lmerContest/lmerSummary`と検定表型、`lmerAnova`と単一fit/複数fitのANOVA・比較型を各model moduleへ追跡。具体確認: `lmer`→models/lmer、`lmerSummary`→models/lmerTest、`lmerAnova`→models/lmerAnova。root `src/index.ts`にはstar exportされないが、`package.json`に`./mixed`が明示され、bundle AREASにも`mixed`が含まれるため、独立サブパス公開として整合。barrelの欠落とは判定しない。build/runtime未実行。 |
| `src/entries/numerics.ts` | 問題未検出 | #176 | `c06da849afc7406f4f2a37e6387a4febab3306d8` | — | implementation moduleのexport宣言とpackage/bundle entryを静的照合 | `integrate/optimize/uniroot`とoptions/result型を`numerics/integrate.ts`へ、approx/spline familyをinterp、ode/OdeFunc/OdeOptionsをode、grad/hessian/jacobian/DerivOptionsをderiv、optim/optimHessと型をoptimへ追跡。特に`optimize`と`uniroot`がファイル名と異なる`integrate.ts`からexportされる点は実装上の意図どおり、同ファイルに3関数すべてのexport宣言を確認。`package.json`の`./numerics`とbundle AREASに一致。数値本体の全域精度監査は別対象。build/runtime未実行。 |
| `src/entries/special.ts` | 問題未検出 | #177 | `c06da849afc7406f4f2a37e6387a4febab3306d8` | — | special implementation module pathsとpackage/bundle entryを静的照合 | gamma/lgamma、beta/lbeta、choose/factorial、digamma/trigamma/psigamma、Bessel I/K/J/Y、erf/erfc、gammainc/erfinv/erfcinv/perm、log1pmx/lgamma1p/log1mexp/log1pexpと型を各special moduleへ追跡。具体確認: `RCompatibleOptions`→rCompatible、`BesselOptions`→besselIK、`GammaincResult`→extra。`package.json`の`./special`とbundle AREASに一致。barrel内の独自数値演算なし。build/runtime未実行。 |
| `src/entries/tests.ts` | 問題未検出 | #178 | `b1f99b610908221c1380f18c8edf4b3bb8551e5e` | — | 該当なし（API re-export barrel） | 静的なexport/path照合。TypeScript build・package runtime・Vitest・R実行なし。 |
| `src/htest/agreement.ts` | 問題未検出 | #179 | `b1f99b610908221c1380f18c8edf4b3bb8551e5e` | — | irr::kappa2/kappam.fleiss/icc および psych::alpha/partial.r のR由来fixtureを閲覧（未実行）。 | 具体入力: `kappa2([[1,1],[2,2],[3,2],[1,1],[2,3],[3,3]])`; `kappa2([[1,1],[1,1]],{weight:"equal"})`（単一カテゴリの退化ケース）; `kappamFleiss([[1,1,2],[2,2,2],[3,3,2],[1,1,1],[2,3,3]])`; `icc([[9,2,5,8],[6,1,3,2],[8,4,6,8],[7,1,2,6],[10,5,6,9],[6,2,4,7]],{model:"twoway",type:"agreement"})`; `cronbachAlpha([[1,2,2],[2,3,3],[3,3,4],[4,5,4],[2,2,3]])`; `partialR([[1,2,3],[2,1,5],[3,5,4],[4,3,8],[5,6,7]],0,1)`. `test/agreement.test.ts` と `test/fixtures/agreement.json` の24ケースを閲覧。ソース・fixture確認のみ。Vitest/R実行なし。 |
| `src/htest/ansariTest.ts` | 問題未検出 | #180 | `b1f99b610908221c1380f18c8edf4b3bb8551e5e` | — | R 4.5.2 ansari.test fixtureおよびmpmath exact-distribution fixturesを閲覧（未実行）。 | 具体入力: `ansariTest([-2,-1,1,2],[-4,-3,3,4],{confInt:true})`; `ansariTest([1,2,3,4],[2,4,6,8],{exact:true})`; `ansariTest([1,1,2],[2,3,3],{exact:true,confInt:true})`（tiesでnormal branchへ移る条件）; `ansariTest("y ~ g",{y:[1,2,3,4],g:["a","a","b","b"]})`. `test/htest-core/ansari.test.ts`、`test/fixtures/ansariTest.json`（173 cases）、`test/fixtures/ansariTestConfInt.json`（183 cases）を閲覧。ソース・fixture確認のみ。Vitest/R実行なし。 |
| `src/htest/aov.ts` | 問題未検出 | #181 | `b1f99b610908221c1380f18c8edf4b3bb8551e5e` | — | R 4.5.2 aov/TukeyHSDおよびBSDA::z.test由来fixtureを閲覧（未実行）。 | 具体入力: `aov([[2.9,3.0,2.5,2.6,3.2],[3.8,2.7,4.0,2.4],[2.8,3.4,3.7,2.2,2.0]])`; `aov("y ~ g",{y:[4.2,5.1,6.3,5.8,7.9,8.4],g:["a","a","b","b","c","c"]})`; `TukeyHSD([1.2,2.3,1.8,2.9,3.1,3.6,4.0,4.4,5.2],["a","a","a","b","b","b","c","c","c"])`; `zTest([5.1,4.9,5.6,5.8,6.0],{mu:5,sigmaX:0.5})`; extreme probe `zTest([1e308,1e308,1e308],{sigmaX:1e308})`. `test/anova.test.ts` と `test/fixtures/aovOneway.json` を閲覧。ソース・fixture確認のみ。Vitest/R実行なし。 |
| `src/htest/binomTest.ts` | 問題未検出 | #182 | `b1f99b610908221c1380f18c8edf4b3bb8551e5e` | — | R 4.5.2 binom.test fixtureおよびSciPy由来の独立比較fixtureを閲覧（未実行）。 | 具体入力: `binomTest(682,925,{p:0.75})`; `binomTest([3,7],{p:0.5})`; `binomTest(0,10,{p:0})`; `binomTest(10,10,{p:1})`; `binomTest(0,2000,{p:0.5})`; `binomTest(1,5,{p:0.5,alternative:"greater",confLevel:0.5872345434452184})`. `test/fixtures/binomTest.json`（166 cases）と `test/fixtures/htest_binomTest.scipy.json` を閲覧。二側確率の探索は平均の両側で単調な区間だけを二分探索する構造を確認。ソース・fixture確認のみ。Vitest/R実行なし。 |
| `src/htest/brunnerMunzelTest.ts` | 問題未検出 | #183 | `e014c17e1cc14604e869b32d32af72dc1a9d8f36` | — | lawstat::brunner.munzel.test の R 4.5.2 fixture を閲覧（未実行）。 | pooled/midrank と within-rank の placements、同順位・±Inf・NaN除外、n1/n2=1、分散ゼロ、Satterthwaite df、alternative方向、両側p値とCIのtail指定を追跡。具体入力: `brunnerMunzelTest([1,2,1,1,1,1,1,1,1,1,2,4,1,1],[3,3,4,3,1,2,3,1,1,5,4])`; `brunnerMunzelTest([1,1],[2,2])`（完全分離・分散ゼロ）; `brunnerMunzelTest([NaN,1],[NaN,2])`; `brunnerMunzelTest([1],[2,3])`（片群1例）。`test/fixtures/brunnerMunzelTest.json`（R 4.5.2）と CHANGELOG v0.8.0 の追加説明を閲覧。新規不具合なし。ソース・fixture確認のみ。Vitest/package runtime/R実行なし。 |
| `src/htest/chisqTest.ts` | 問題あり | #184 | `e014c17e1cc14604e869b32d32af72dc1a9d8f36` | [#42](https://github.com/numero-uno-jpn/rStats.js/issues/42) | R 4.5.2 chisq.test fixture と C locale の並び順を仕様根拠として閲覧（R実行なし）。 | goodness-of-fit/contingency dispatch、行列shape、1行/1列matrix、Yates補正、zero margin、expected count NaN、double-double総和、Monte Carlo B/seed/整数count条件、Patefield table生成、factor欠損ペア除外を追跡。確認した不具合: `byCodePoint`（158行）はJSのUTF-16 code-unit比較を使うためUnicode code-point順ではない。`chisqTest(["\\u{10000}","\\uE000","\\u{10000}","\\uE000"],["a","a","b","b"])` では、C locale/code-point順の期待 `rowLevels=["\\uE000","\\u{10000}"]` に対して順序が逆転する。Issue #42（bug、領域: factor-level ordering、重要度: low）。補足: 冒頭コメントはvectorのInfを許容と記すが、実装は有限値を要求する。test/chisq.test.ts の substitute もInf countをエラーへ置換しており、現行テスト契約に合わせた意図的な厳格化と判断し、独立Issueにはしない。具体入力: `chisqTest([[12,5],[7,15]])`; `chisqTest([20,15,25])`; `setSeed(1); chisqTest([20,15,25],{simulatePValue:true})`; 上記Unicode factor入力。CHANGELOG v0.7.0 の追加・simulation記述と fixture/test の置換条件を確認。Vitest/package runtime/R実行なし。 |
| `src/htest/cor.ts` | 問題あり | #185 | `e014c17e1cc14604e869b32d32af72dc1a9d8f36` | [#40](https://github.com/numero-uno-jpn/rStats.js/issues/40) | R 4.5.2 cor/cor.test fixture を閲覧（未実行）。Near-perfect correlation の期待値はRではなく高精度十進計算から算出。 | Pearson double-double centered sums、correlation clamp、t statistic の `1-r²`、Fisher-z CI、Kendall S/tie variance/exact inversion CDF、Spearman AS 89 exact enumeration/Edgeworth、tie/continuity/alternative/NaN/Inf/formula dispatchを追跡。確認した不具合: `pearsonDD` 153行が `r[0]>=1` のみで `[1,0]` にclampし、真値が1未満でlow componentが負のDD値を破棄する。具体入力: `corTest([0,1,2],[0,1,2+Number.EPSILON])`（最後のyは2.0000000000000004）。100桁計算の期待: `1-r²≈1.6434602192104405e-32`、`t≈7.800463371553964e15`（df=1）、両側 `p≈8.161307117845713e-17`。現行経路は `r=[1,0]` として `t=Infinity,p=0`。Issue #40（bug、領域: Pearson correlation、重要度: medium）。CHANGELOGにこのendpoint-clampの修正記録なし。fixture/test source閲覧、Decimal独立計算のみ。Vitest/package runtime/R実行なし。 |
| `src/htest/core/ansari.ts` | 問題未検出 | #186 | `e014c17e1cc14604e869b32d32af72dc1a9d8f36` | — | Ansari-Bradley exact distribution のR 4.5.2由来fixtureおよび独立整数count/brute-force fixture生成根拠を閲覧（未実行）。 | `ansariDist` のsubset-position DP確率遷移、tail境界、qの相対fuzz、quantileのupper-tail反転とslack、count DP、chooseによる正規化、cache key/再利用を追跡。具体入力: `pansariExact(5,3,4,true)`; `pansariExact(5,3,4,false)`; `dansariExact(5,3,4)`; `qansariExact(0.5,3,4)`; `qansariR(0.5,3,4)`; 境界 `qansariExact(0,3,4)` と `qansariExact(1,3,4)`。非整数m/nを拒否しない内部quantile helperの入力検証差も確認したが、public `ansariTest` は実データ長から整数m/nを生成し、このhelperは公開entryからexportされないため、現行公開経路の不具合とは判定しない。CHANGELOG v0.7.0 のansari interval追加・ties fallback記述を確認。ソース・fixture確認のみ。Vitest/package runtime/R実行なし。 |
| `src/htest/core/kolmogorov.ts` | 問題あり | #187 | `e014c17e1cc14604e869b32d32af72dc1a9d8f36` | [#41](https://github.com/numero-uno-jpn/rStats.js/issues/41) | Marsaglia-Tsang-Wang exact CDF、Kolmogorov limit、Birnbaum-Tingey one-sided tailの公開論文式およびmpmath/exact-rational fixtureを閲覧（未実行）。 | exact CDFの境界 `d<=1/(2n)`/`d>=1`、small-d閉形式、matrix H構成・power scaling、limitのsmall/large x級数とtail選択、one-sided upperの正項和・境界を追跡。確認した不具合: `pkolmogorovLimit` 156行で `x*x` がunderflowするほど小さい正のxでは、指数側が0となる一方で `sqrt(2π)/x` がInfinityとなり `Infinity*0=NaN`。具体入力: `pkolmogorovLimit(1e-200,true)` は下側tail 0、`pkolmogorovLimit(1e-200,false)` は上側tail 1が期待値だが、現行式はNaN。Issue #41（bug、領域: Kolmogorov numerical core、重要度: low）。CHANGELOGのKS追加/修正項目に当該small-x underflowの記録なし。ソース・fixtureとIEEE-754演算経路確認のみ。Vitest/package runtime/R実行なし。 |
| `src/htest/core/mantelhaen.ts` | 問題未検出 | #188 | `974d8755ed5b84e78da93f66b02f7faac3535ffa` | — | exact conditional MHの独立整数count/rational fixtureを閲覧（未実行）。 | 各層のhypergeometric support、central density、convolutionのsupport offset、psi=0/Inf点質量、log-weight正規化、mean/CDF、conditional MLEと両側limit rootの単調方向を追跡。具体入力: `new ConvolvedNoncentralHyper([[[1,2],[3,4]],[[0,3],[2,2]]])` に対する `density(0)`, `density(1)`, `density(Infinity)`, `mean(1)`, `cdf(2,1,false)`; 完全退化層 `new ConvolvedNoncentralHyper([[[2,0],[0,0]],[[1,0],[0,1]]])`; 公開APIでexact fractional count拒否・K=1拒否・各層total=1拒否を確認。support幅0ではMLEが0、CIが[0,Infinity]になる識別不能ケースは認識したが、Rの契約確認なしに不具合認定せず。ソース・fixture確認のみ。Vitest/package runtime/R実行なし。 |
| `src/htest/core/shapiro.ts` | 問題未検出（要実行確認事項あり） | #189 | `974d8755ed5b84e78da93f66b02f7faac3535ffa` | — | SciPy AS R94 reference fixture、R 4.5.2 shapiro.test fixtureを閲覧（未実行）。 | n=3 exact式、n=4/5/6境界の係数補正、n=11/12 p値近似切替、n=5000上限、係数の反対称性・二乗和、1-Wの因数分解、range scale、log(1-W)の裾確率を追跡。具体入力: `[1,2,3]`; `[1,1,1]`（公開APIで同一値拒否）; `[-1e308,0,1e308]`（range overflow対策）; `[Number.MIN_VALUE,0,1]`; `Array.from(swilkCoefficients(20))`（内部生成係数を標本値とするnear-W=1ストレス）。係数ベクトルを入力した場合に1-Wの浮動小数点符号が0近傍で敏感になる可能性を独立SciPy相当計算で確認したが、rStats.jsのqnorm/JS runtimeで再現確認できていないためIssue化せず、要runtime testとして留保。公開wrapperは3<=n<=5000、有限値、同一値を検証。Vitest/package runtime/R実行なし。 |
| `src/htest/core/simulate.ts` | 問題未検出 | #190 | `974d8755ed5b84e78da93f66b02f7faac3535ffa` | — | Rのas.character/pasteのB表記契約と呼出元chisqTest/fisherTestのsimulation fixtureを閲覧（未実行）。 | `formatR` のtoExponential(14)から15桁表現への選択、指数の符号・2桁padding、末尾0除去、±0/NaN/±Inf、`simulatedMethod` のmethod suffixを追跡。具体入力: `formatR(1)`, `formatR(1000)`, `formatR(1000000)`, `formatR(1e21)`, `formatR(1e-7)`, `formatR(-0)`, `formatR(Infinity)`; Bは呼出元で正整数検証されるため、fractional/negative Bは本helperの公開契約外。通常の整数Bに対するフォーマット不具合を確定せず。Vitest/package runtime/R実行なし。 |
| `src/htest/core/smirnov.ts` | 問題未検出 | #191 | `974d8755ed5b84e78da93f66b02f7faac3535ffa` | — | exact integer lattice-path/brute-force fixtureおよびtwo-sample KSのR fixtureを閲覧（未実行）。 | rolling-row DPのpath survival recurrence、first-boundary-hitの重複計数回避、hypergeometric path weight、two-sided/greater/less符号、ties時のpooled-z change points、d境界・relative fuzz、m/n integer validationを追跡。具体入力: `psmirnovUpper(0,3,4)`; `psmirnovUpper(1,3,4)`; `psmirnovUpper(0.5,3,4,{alternative:"greater"})`; `psmirnovUpper(0.5,3,4,{alternative:"less"})`; ties `psmirnovUpper(0.5,2,2,{z:[1,1,2,3]})`; z length mismatch。DP recurrenceとboundary hitの確率解釈をfixture/brute-force test設計と照合し、新規再現不具合なし。公開ksTestはNaNを除去し、m,n>=1を保証。Vitest/package runtime/R実行なし。 |
| `src/htest/dunnett.ts` | 問題未検出（内部前提あり） | #192 | `974d8755ed5b84e78da93f66b02f7faac3535ffa` | — | multcomp/PMCMRplus由来Dunnett fixtureと独立数値積分の既存テストを閲覧（未実行）。 | conditional Z0 integral、one/two-sided conditional exceedance、`logPhi`、`log1p/expm1` による1-product、狭い区間のtail差分、df=Infinity正規極限、finite-df log-U outer integral、stirlerr、QUADPACK ier/error gate、c=0/±Infを追跡。具体入力: `pDunnettUpper(0,[0.5,0.75],Infinity,false)`; `pDunnettUpper(0,[0.5,0.75],Infinity,true)`; `pDunnettUpper(Infinity,[0.5,0.75],10,false)`; `pDunnettUpper(-Infinity,[0.5,0.75],10,false)`; `pDunnettUpper(1.55,[0.5,0.75],Infinity,true)`。lambda in (0,1)、df>0、lambda非空はmultipleComparisonsのグループサイズ・pooled varianceから生成される内部前提で、core単独では検証されない。内側積分のierを検査しない点はソースコメントに明記された既知設計であり、直ちに誤差を実証できずIssue化しない。新規再現不具合なし。Vitest/package runtime/R実行なし。 |
| `src/htest/effectSize.ts` | 問題未検出 | #193 | `489b31e26ff16939cef159a9de0baf0168f09738` | — | effectsize R 4.5.2 fixtures（cohens_d/hedges_g/eta_squared/omega_squared/epsilon_squared）と repeated-measures fixturesを閲覧（未実行）。 | Cohen's d one-/two-sample/paired、pooled/average SD、mu、NaN drop/Inf reject、Hedges JとlgammaDiff、noncentral-t root CI、ANOVA partial/plain/generalized eta、omega/epsilon、noncentral-F CI、Error strata/aovEz mapping、SS scaling、observed-factor term matchingを追跡。具体入力: `cohensD([5.1,4.9,6.2,5.8],[4.1,4.5,3.9,5.0])`; `hedgesG([1,2],[3,4])`（df=2近傍の補正）；`cohensD([1,2,3],undefined,{ci:null})`; `cohensD([1,1,1],[2,2,2],{ci:null})`（zero SD）；`cohensD([-1e308,0,1e308],undefined,{ci:null})`; `etaSquared(anova(lm("y ~ g",{y:[1,2,4,5,7,9],g:["a","a","b","b","c","c"]})),{ci:null})`; repeated-measures `aov("y ~ W + Error(id/W)", data)` paths. No confirmed defect; noncentral-root near-endpoint and zero-variance behavior noted as stress candidates. Vitest/package runtime/R executionなし。 |
| `src/htest/fisherTest.ts` | 問題あり | #194 | `489b31e26ff16939cef159a9de0baf0168f09738` | [#43](https://github.com/numero-uno-jpn/rStats.js/issues/43) | R 4.5.2 `stats::fisher.test` source `src/library/stats/R/fisher.test.R` を閲覧。conf.levelは0〜1を含む範囲で検証される。 | 2x2 noncentral hypergeometric support/density、psi=0/Inf、tail方向、minlike two-sided、conditional MLE、CI root方向、rxc Mehta-Patel network pruning、double-double log probability、zero-margin drop、Patefield simulation、B/seedを追跡。確認した不具合: `fisher2x2` の `confLevel` 検証が `>0 && <1` で、Rが受理する0と1を拒否する。具体入力: `fisherTest([[1,2],[3,4]],{confLevel:0})`; `fisherTest([[1,2],[3,4]],{confLevel:1})`。いずれも現状RangeError。Issue #43（bug、重要度low）。他の具体入力: `fisherTest([[0,3],[2,0]])`; `fisherTest([[1,2,0],[3,4,0]],{simulatePValue:true,B:100})`; `fisherTest([[1,2],[3,4]],{alternative:"greater",or:Infinity})`。2x2境界とrxcシミュレーション経路も確認。Vitest/package runtime/R実行なし。 |
| `src/htest/groups.ts` | 問題あり | #195 | `489b31e26ff16939cef159a9de0baf0168f09738` | [#44](https://github.com/numero-uno-jpn/rStats.js/issues/44) | R 4.5.2 factor coercion semanticsを確認。混在するnumeric/character labelsはcharacterへcoerceされてからlevels化される。 | list-form/x,g-form、NaN response/label pair drop、all-missing label、emptyGroups drop/error、numberLevels 15-digit collisions、label sorting、median midpoint、completeRows shapeを追跡。確認した不具合: `labelledGroups` はMap keyを元のnumber|stringの型付き値で保持するため、number 2とstring "2"を別groupにする一方、`levelText` は双方を同じ"2"に表示する。具体入力: `onewayTest([1,2,10,11,20,21,30,31],[2,2,"2","2",10,10,"10","10"])`。現在4群（重複表示名）となるが、R factor coercionでは2群（"10","2"）。Issue #44（bug、重要度medium、群構成と検定結果に影響）。追加入力: `median([-1e308,1e308])`; `median([1.7e308,1.79e308])`; `median([-Infinity,Infinity])`; all-NaN list groups. Vitest/package runtime/R実行なし。 |
| `src/htest/ksTest.ts` | 問題未検出（警告差異あり） | #196 | `489b31e26ff16939cef159a9de0baf0168f09738` | — | R 4.5.2 ks.test fixture、R patched documentation/sourceおよびSciPy 1.18.1 fixtureを閲覧（未実行）。 | one-sample D+/D-、continuous CDF callback range validation、tiesによるexact default切替、two-sided tailの1-P cancellation回避、two-sample pooled ECDFのtie-run endpoint、greater/less符号、exact threshold n<100/mn<10000、formula twoGroupDataを追跡。具体入力: `ksTest([0,0,1],q=>q<=0?0:q>=1?1:q)`; `ksTest([0,0,1],q=>q<=0?0:q>=1?1:q,{exact:true})`; `ksTest([1,2],[3,4],{alternative:"greater"})`; `ksTest([1,2],[1,3],{exact:true})`; `ksTest([1,2],q=>NaN)`; `ksTest([NaN,NaN],[1,2])`。default one-sample exact判定はtiesを除外。明示exact:trueではRも連続分布のties警告を出した上でexact経路を実行するため、数値経路の差は確認せず。Rはties警告を出すがrStats.js resultはwarningを返さない点を互換性メモとして記録。新規計算不具合なし。Vitest/package runtime/R実行なし。 |
| `src/htest/leveneTest.ts` | 問題未検出 | #197 | `489b31e26ff16939cef159a9de0baf0168f09738` | — | R 4.5.2 car::leveneTest fixture（median/mean center）を閲覧（未実行）。 | center default median/mean、sorted factor labels、pairwise missing removal、all-missing groups drop、absolute deviation scaling、oneway ANOVA df/F/pを追跡。具体入力: `leveneTest([4.2,5.1,6.3,5.8,7.9,8.4,6.6,7.0,5.5],["a","a","a","b","b","b","c","c","c"])`; 同じ入力 `{center:"mean"}`; 欠損ペア `leveneTest([1,2,NaN,4,5,6],["a","a","a","b","b","b"])`; empty factor group; singleton群; constant groups; `[-1e308,1e308,-1e308,1e308]` scale stress; ±Infinity. No new confirmed defect; zero residual df/constant deviations produce degenerate ANOVA values and are retained as boundary cases pending runtime comparison. Vitest/package runtime/R実行なし。 |
| `src/htest/mantelhaenTest.ts` | 問題未検出 | #198 | `8a97a5756c77d7d41ba872005f479f420a1dd851` | — | R/SciPy fixtures・sourceを閲覧（未実行）。 | 2x2xKのasymptotic/exact、Yates補正、OR/CI、conditional MLE、I×J×K covariance/solve。入力: `mantelhaenTest([[[10,5],[4,12]],[[8,6],[5,9]]])`; zero-margin stratum; total=1; exact fractional counts; structural-zero general table。R 4.5.2/SciPy fixtures閲覧。singular Vは実行比較未了で未認定。Vitest/R未実行。 |
| `src/htest/mcnemarTest.ts` | 問題あり | #199 | `8a97a5756c77d7d41ba872005f479f420a1dd851` | [#45](https://github.com/numero-uno-jpn/rStats.js/issues/45) | R/SciPy fixtures・sourceを閲覧（未実行）。 | square table、2x2 correction、r>2 symmetry sum、df、discordant zero、paired crossTable/missing/levels。再現: `mcnemarTest([1,1,"1","1",2,2,"2","2"],[1,"1",1,"1",2,"2","2",2])`。number 1とstring "1"が別levelだがR factorでは文字列化され同一levelとなる。4 levels vs 2 levelsでtable/dfが変わる。重要度medium。R 4.5.2 fixtures閲覧。Vitest/R未実行。 |
| `src/htest/multipleComparisons.ts` | 問題未検出 | #200 | `8a97a5756c77d7d41ba872005f479f420a1dd851` | — | R/SciPy fixtures・sourceを閲覧（未実行）。 | Dunn tie correction/adjustment、Dunnett familywise tails、Steel U rank/sign、DSCF variance、Games-Howell Welch/Satterthwaite、Tukey-Kramer、Dunn altp/stepwise ties。入力: 3群例 [1.2,2.3,1.8,2.9,3.1,3.6,4.0,4.4,5.2]; all-tied groups; two-group single-step; zero pooled SS; unequal n; tied adjusted p; extreme values。R PMCMRplus/dunn.test/multcomp fixtures閲覧。Vitest/R未実行。 |
| `src/htest/normalityTests.ts` | 問題あり | #201 | `8a97a5756c77d7d41ba872005f479f420a1dd851` | [#46](https://github.com/numero-uno-jpn/rStats.js/issues/46) | R/SciPy fixtures・sourceを閲覧（未実行）。 | AD/CVM/Lilliefors/Shapiro-Francia/Pearsonの統計量・近似p値・df・警告境界。Pearsonで `pnorm(z)===1` のときclass=`k+1`となり、`c<=k`で観測値を除外。再現: `const x=[...Array(99).fill(0),1e6]; pearsonTest(x)`。n=100、k=13、outlier z=9.9、counts合計99。最終binに含める必要あり。重要度medium。nortest 1.0-4 source/fixtures閲覧。Vitest/R未実行。 |
| `src/htest/onewayTest.ts` | 問題未検出 | #202 | `8a97a5756c77d7d41ba872005f479f420a1dd851` | — | R/SciPy fixtures・sourceを閲覧（未実行）。 | Classical F/Welch F、Satterthwaite df、群サイズ、zero variance、power-of-two scaling、formula interaction/missing、Shapiro-Wilk n=3/5000/5001、NaN/Inf/constant。入力: 例の3群 [2.9,3.0,2.5,2.6,3.2], [3.8,2.7,4.0,2.4], [2.8,3.4,3.7,2.2,2.0]; varEqual true/false; singleton; constant groups; [-1e308,0,1e308]; formula with two factors; shapiroTest([1,2,3])。Welch zero varianceのNaNはR比較未了で未認定。R/SciPy fixtures閲覧。Vitest/R未実行。 |
| `src/htest/pAdjust.ts` | 問題未検出 | #203 | `a281c1fc348643b86370be97d94d35a18e1b8983` | — | R 4.5.2 `stats::p.adjust` の実装・仕様と照合（ソース/fixture閲覧、R実行なし）。Hommel n=2 special-caseは有効p値でHochbergと同値 | Holm/Hochbergの単調累積、BH/BY逆順cummin、BY調和数のdouble-double/大n漸近、HommelのSimes反復、NaN位置保持、n>lengthの未観測p扱い、略称/alias、空・単一・±Inf・範囲外pを確認。入力: `pAdjust([0.01,0.02,0.03,0.04,0.05])`; `pAdjust([NaN,0.01,0.2],{method:"BY",n:5})`; `pAdjust([0.01,0.2],{method:"hommel",n:5})`; `pAdjust([0.2,0.8],{method:"hommel"})`; `pAdjust([], {method:"hommel",n:3})`。Hommelの非整数n拒否・空ベクトルはRと異なると明記済み。大nのBY近似は境界付近を追加runtime比較する余地はあるが、再現欠陥なし。Vitest/package runtime/R未実行。`test/padjust.test.ts` とR p.adjust source/fixtureを閲覧。 |
| `src/htest/pairwise.ts` | 問題あり | #204 | `a281c1fc348643b86370be97d94d35a18e1b8983` | [#44](https://github.com/numero-uno-jpn/rStats.js/issues/44) | R 4.5.2 `pairwise.*` / `factor()` semanticsと照合（ソース/fixture閲覧、R実行なし） | byLevelのgroup coercion/order、NaN応答除外（pairedは位置対応を保持）、pooled SD/df、paired/non-pooled t、Wilcoxon各pair、proportion pairs、下三角の比較順とpAdjust一括適用を追跡。確認した不具合: `numberLevels()`は数値だけ正規化し文字列を残すため、Mapが数値`2`と文字列`"2"`を別群として扱い、表示ラベルが重複。再現: `const x=[1,2,10,11,20,21,30,31]; const g=[2,2,"2","2",10,10,"10","10"]; pairwiseTTest(x,g)`。R factor coercionでは文字列levels `"10"`,`"2"`の2群だが現行は4群。`pairwiseWilcoxTest`も同じ`byLevel()`を使う。既存Issue #44に同一根本原因として追記済み。その他の通常/edge casesは既存 `test/htest-basic.test.ts` fixtureで比較設計を閲覧。Vitest/package runtime/R未実行。 |
| `src/htest/poissonTest.ts` | 問題未検出 | #205 | `a281c1fc348643b86370be97d94d35a18e1b8983` | — | R 4.5.2 `stats::poisson.test` fixtures/契約を閲覧（実行なし）。T=0はRがNaN/Infを返すが、この実装は明示的に拒否する仕様差を既存testで許容 | 1標本 exact two-sided probability-ordering、Poisson mode/tie、far-tail integer search、less/greater tails、Garwood gamma CI、2標本conditional binomial mapping、rate ratio/expected countのoverflow/underflow回避、x1+x2 overflow、T/r/confLevel validationを追跡。入力: `poissonTest(0,{T:1,r:0})`; `poissonTest(1,{T:1,r:1})`; `poissonTest([11,23],{T:[800,3011]})`; `poissonTest([0,0],{T:[1,1]})`; `poissonTest(517,{T:25.864,r:9.0104,alternative:"greater"})`; `poissonTest(1,{T:0})`（現行はRangeError、Rはrate/CIのNaN/Inf。`test/htest-basic.test.ts`で意図的なsubstituteとして記録）。two-sided modeの整数mにおけるm-1/m同率を確認。新規の再現可能な計算欠陥は確定せず。Vitest/package runtime/R未実行。 |
| `src/htest/polycor.ts` | 問題未検出 | #206 | `a281c1fc348643b86370be97d94d35a18e1b8983` | — | R 4.5.2 `polycor` / `mvtnorm` fixturesを閲覧（実行なし）。MLのreferenceはR optimizerの途中停止値ではなくfixtureのexact maximum | polychor table/vector dispatch・矩形形状・非負有限count、zero-margin除去、category coercion、marginal thresholds、pbvnorm rectangle probability、rho bound、polyserial ad-hoc estimate、standardisation、ML analytic gradient/Hessian/Newton/step-halving、boundary ridge、inverse Hessian、chisq/dfを追跡。入力: `polychor([[20,8,1],[5,30,9],[2,6,25]])`; `polychor([[50,0],[0,50]],{ML:true,stdErr:true})`; `polychor([[0,50],[50,0]],{stdErr:true})`; `polyserial([0.2,-1.1,0.8,1.5,-0.3,0.1,-0.9,2.0],[1,1,2,3,2,2,1,2],{ML:true,stdErr:true})`; zero-margin `polychor([[3,4],[0,0]])`; ragged table rejection. `test/polycor.test.ts`と`test/polycorML.test.ts`のfixture、pbvnorm境界testを閲覧。極端な非有限連続値/極端に希少なカテゴリは追加runtime検証候補だが不具合未認定。Vitest/package runtime/R未実行。 |
| `src/htest/power.ts` | 問題未検出 | #207 | `a281c1fc348643b86370be97d94d35a18e1b8983` | — | R 4.5.2 `power.t.test` / `power.prop.test` / `power.anova.test` fixtureと照合（実行なし）。Rのnoncentral pt/pf・uniroot精度差は既存known-differenceとして区別 | exactly-one-unknown判定、既定値、sigLevel/power/sd/variance/proportion/tol validation、one/two/paired t df・ncp・strict tail、proportion pooled variance/strict tail、ANOVA lambda/df、未知量root bracketとdelta=0/betweenVar=0非識別を追跡。入力: `powerTTest({n:20,delta:1})`; `powerTTest({delta:0.5,power:0.8})`; `powerTTest({n:20,delta:0,alternative:"two.sided",strict:true})`; `powerPropTest({n:50,p1:0.5,p2:0.75})`; `powerPropTest({n:30,p1:0.9,p2:1,power:0.8,strict:true})`（不可能条件/警告・root boundary）; `powerAnovaTest({groups:4,n:5,betweenVar:1,withinVar:3})`; `powerAnovaTest({groups:4,n:5,betweenVar:0,withinVar:3})`。連続値n/groupsのroot resultをintegerに丸めないのはR仕様。非識別量の専用RangeErrorも確認。`test/powerStats.test.ts`およびR fixture/known differencesを閲覧。Vitest/package runtime/R未実行。 |
| `src/htest/propTest.ts` | 問題あり | #208 | `6b5fa401398cf4b4ba9d0362a80df5f2424af58f` | [#47](https://github.com/numero-uno-jpn/rStats.js/issues/47) | R 4.5.2 `stats::prop.test` documentation/source contractを照合（未実行）。finite countsは整数でなければならない | 入力NaN group drop、matrix rows success/failure conversion、positive finite trials、0<=success<=trials、p vector original-length check/NA alignment、one/two/k proportions、given p、Yates cap、Pearson expected cells、one-sided signed-root normal tail、Wilson/Newcombe CI、two-proportion Wald CI・clipを確認。確定不具合: success/failure countsの整数性検証がなくfractional countsを受理。再現: `propTest(1.5,3.5)`; `propTest([1.5,2.5],[3.5,4.5])`; `propTest([[1.5,2],[2,2.5]])`。Rはfinite countsが整数であることを要求。Issue #47作成。Vitest/package runtime/R未実行。 |
| `src/htest/pwr.ts` | 問題未検出 | #209 | `6b5fa401398cf4b4ba9d0362a80df5f2424af58f` | — | CRAN pwr 1.3-0の公開Rソース/仕様と照合（未実行） | cohenES lookup、ES.h endpoints、ES.w1 zero expected cells、ES.w2 empty rows/columns and column-major accumulation、pwr t/t2n/2p/2p2n/p/norm/r/chisq/anova/f2のexactly-one-null、probability validation、alternative-specific effect sign/range、ncp、strict tail、root brackets、boundary/non-identifiable values、large ncp overflowを確認。入力: `esW1([0,0.5,0.5],[0,0.25,0.75])`; `esW1([0,1],[0.2,0.8])`; `esW2([[0.3,0.2],[0.1,0.4]])`; `pwrTTest({n:20,d:0.5})`; `pwrT2nTest({n1:20,n2:30,d:0.5})`; `pwrRTest({n:50,r:-0.3,alternative:"less"})`; `pwrRTest({n:50,power:0.8,alternative:"less"})`; `pwrChisqTest({w:0.3,N:100,df:3})`; `pwrAnovaTest({k:4,n:20,f:0.25})`。Rのpwr.r.testはlessで計算中rの符号を反転し、既知rを返すときも負値を返す；現行実装の符号処理と一致。有限だが非常に大きい値の追加runtime確認余地は残るが再現欠陥未認定。Vitest/package runtime/R未実行。 |
| `src/htest/rankTests.ts` | 問題未検出 | #210 | `6b5fa401398cf4b4ba9d0362a80df5f2424af58f` | — | R 4.5.2 rank tests / SciPy reference fixturesを閲覧（未実行） | Kruskal-Wallis tie correction、Friedman within-block ranks/ties/complete rows、Cochran Q binary validation、Quade range ranks/A-B residual and all-tie special case、Fligner median deviations/rank-normal scores/variance、Mood average tied position scores/exact score variance、NaN/Inf handling、formula adaptersを追跡。入力: `kruskalTest([[2,2],[2,2]])`; `friedmanTest([[1,1,1],[2,2,2]])`; `cochranQTest([[1,1,0],[0,0,0],[1,0,1]])`; `quadeTest([[1,2,3],[2,3,1],[3,1,2]])`; `flignerTest([[0,0],[1,1],[2,2]])`; `moodTest([0,1,2],[2,1,0])`; extreme finite range (-1e308,1e308). Degenerate tie cases can yield NaN by zero variance/tie correction, consistent with rank-test mathematical degeneracy; Quade's incomplete-row behavior is a documented deliberate difference from R's quade.test quirk and is covered by substitute fixture. No new reproducible defect. Vitest/package runtime/R未実行。 |
| `src/htest/tTest.ts` | 問題未検出 | #211 | `6b5fa401398cf4b4ba9d0362a80df5f2424af58f` | — | R 4.5.2 `stats::t.test` source/fixtureを閲覧（未実行） | one-sample/Welch/pooled/paired、NaN pairwise removal、sample-size minima、Satterthwaite df、pooled SS、scaleToUnit/pairedDifferences、mu scaling、essentially-constant threshold、one/two-sided tails、confidence endpoints、confLevel 0/1を確認。入力: `tTest([5.1,4.9,5.6,5.8,6.0,5.4],{mu:5})`; `tTest([1,2,3,4,5],[3,4,5,6,8])`; `tTest([1,2,3],[2,4,6],{paired:true})`; `tTest([1],[2,3],{varEqual:true})`; `tTest([1e-200,2e-200,3e-200])`; `tTest([1,2,3],{mu:Infinity})`。Infinite mu is not rejected by R (it checks NA, not finite); test fixture records interval NaN as known difference. No new reproducible defect. Vitest/package runtime/R未実行。 |
| `src/htest/testFormula.ts` | 問題未検出 | #212 | `f451809365f16c00924a0bfe90a72c9b25317b04` | — | R 4.5.2 formula methods source/contractと照合（未実行） | splitTilde, Pair(a,b), twoSampleData one/paired/two group validation, kSampleData, groupFactor/presentLevels, oneway interaction codes/stride, blockData complete unreplicated matrix, correlationData selectionを確認。correlationDataはrhsVariablesが2つあるか検証するだけだが、R cor.test.formulaもmodel.frame列数が2かを確認し、model.frameは元の2変数を評価してinteractionを追加列に展開しないため、`~ x * y` / `~ x:y`も2列なら受理される。初回に作成したIssue #48はR model.frame semanticsを誤認したfalse positiveとして訂正・close済み。再現確認用: `const data={x:[1,2,3,4,5],y:[5,4,3,2,1]}; corTest("~ x * y",data)`。その他のPair/interaction formula edgeは既存fixtureを閲覧。Vitest/package runtime/R未実行。 |
| `src/htest/trendTests.ts` | 問題あり | #213 | `4a000f0c939846bd2886c7f429734acd06664b99` | [#50](https://github.com/numero-uno-jpn/rStats.js/issues/50) | R 4.5.2 `stats::prop.trend.test` sourceの`lm(freq ~ score)`とmodel-frameの既定欠損除外を照合。DescToolsのJT定義・exact上限・tie varianceもsource/docsで照合（未実行） | propTrendTestのweighted regression、p=0/1、score NaN/Inf、length mismatch、constant score、整数カウント境界を確認。JonckheereのJT pair count、exact時のMann–Whitney分布convolution、tiedVariance、alternative方向、levels、空群、DescTools/clinfunの欠損・Inf差を追跡。再現: `propTrendTest([1,2,3,4],[10,10,10,10],[1,NaN,3,4])` は現行NaN。Rは`lm(freq ~ score)`のmodel frameで2行目をna.omitし、有限の統計量/p値を返す。Issue #50。ほか`propTrendTest([15,10,8,4],[30,30,30,30])`; `jonckheereTest([1,2,2,3,4,5],[1,1,2,2,3,3],{alternative:"increasing"})`; `jonckheereTest([1,2,3,4],[1,1,2,2],{exact:true})`; `jonckheereTest([1,1,2,2,3,3],[1,1,2,2,3,3],{alternative:"increasing"})`。
| `src/htest/types.ts` | 問題未検出 | #214 | `4a000f0c939846bd2886c7f429734acd06664b99` | — | R `match.arg`の一意prefix、各テストのconfidence level境界と照合（未実行） | Alternative/Sample/Counts/HTest型、`matchAlternative`の空・曖昧・一意prefix、closed/open confLevel validator、`isCount`の有限・非負・絶対許容差を確認。入力: `matchAlternative("t")`; `matchAlternative("two")`; `matchAlternative("")`; `isCount(1)`; `isCount(0.00000005)`; `isCount(0.0000002)`; `checkConfLevel(0)`; `checkConfLevelOpen(0)`。count toleranceは明示コメントどおり絶対値1e-7の意図的な許容。型定義とvalidation helperに新規の再現欠陥なし。
| `src/htest/varTest.ts` | 問題未検出 | #215 | `4a000f0c939846bd2886c7f429734acd06664b99` | — | R 4.5.2 `stats::var.test` source/docs、Bartlett公式を照合（未実行）。両群定数時のthrowは既存review59で明示した仕様差 | F比・ratio帰無値・df・片側/両側tail・confInt quantile・finite-only除外・共通2冪scale、formula group extraction、Bartlett pooled variance/log variance/correction factor/dfを確認。入力: `varTest([1,3,2,5,4],[2,9,4,12,7,1])`; `varTest([1,1,1],[1,2,4])` (一方のみ分散0); `varTest([1,1,1],[2,2,2])` (両方0、既存review59で意図的にthrow); `varTest([1,2,3],[4,5,6],{alternative:"greater"})`; `bartlettTest([[1,3,2,5],[2,9,4,12,7],[3,3.5,4,2]])`; singleton/empty groups。Rの分散比と境界tailに沿う実装で、新規再現欠陥なし。
| `src/htest/wilcoxTest.ts` | 問題あり | #216 | `4a000f0c939846bd2886c7f429734acd06664b99` | [#49](https://github.com/numero-uno-jpn/rStats.js/issues/49) | R 4.5.2+ `stats::wilcox.test` source/docsのsigned-rank/rank-sum、tie correction、zero-SD branchを照合（未実行） | signed-rank/rank-sum statistic、exact/normal切替、ties/zeroes、continuity correction、one-/two-sided tail、exact Walsh averages/pair differences、normal CI root/clamping、confLevel/tolRoot、paired complete cases、Inf handlingを確認。再現: `wilcoxTest([1],[1])` および `wilcoxTest([1,1],[1,1],{exact:false})`。全同値の2群ではW−E(W)=0かつtie-corrected variance=0。現行はz=0/0=NaNを`normalP`へ渡しpValue=NaN。Rの`.wilcox_test_two_pval_asymp`は`z == 0 && STAT$sd == 0`を特別扱いしp.value=1を返す。Issue #49。ほか`wilcoxTest([1,2,3],[4,5,6],{exact:false})`; `wilcoxTest([1,2,3],[2,3,4],{exact:true,confInt:true})`; `wilcoxTest([1,2,3],[2,4,6],{paired:true})`; `wilcoxTest([0,0,0])` (all-zero signed rankは既存仕様差としてerror)。
| `src/index.ts` | 問題未検出 | #217 | `4a000f0c939846bd2886c7f429734acd06664b99` | — | 該当なし（公開APIのre-export barrel） | 10行のexport宣言を確認。special/distributions/tests/linalg/descriptive/numericsのentry barrelを再exportし、実装・演算・入力変換を行わない。併せて`src/entries/tests.ts`で`wilcoxTest`、`varTest`、`bartlettTest`、`propTrendTest`、`jonckheereTest`の公開exportを確認。循環参照・重複exportの疑いなし。
| `src/integrate/quadpack.ts` | 問題あり | #218 | `467080a00d97d2c069779452bd5eb30b93047b7b` | [#51](https://github.com/numero-uno-jpn/rStats.js/issues/51) | QUADPACK dqk21/dqagse source、R 4.5.2 integrate docs/sourceと比較。上流QUADPACK/Rも同じmidpoint式を使う既知の数値限界だが、有限入力の数学的誤積分として記録 | K21/G10 nodes/weights、resabs/resasc、error rescaling、dqk15i無限区間変換、Wynn epsilon table、dqpsrt ordering、adaptive bisection、roundoff/divergence ier、limit/tolerance境界、reverse boundsを追跡。再現: `integrate(x => 1/x, 1e308, 1.1e308)`。`0.5*(a+b)` がInfinity、`0.5*(b-a)` は有限となり、全21 nodesがInfinity、f=1/xは全点0、結果0/abserr0/ier0。高精度の正解は0.09531017980432482。Nodeで式を再現。既存quadpack fixtureはSciPy通常域の結果・ier/nevalを比較するが、同符号巨大有限境界は含まれない。適応分割側も`0.5*(alist+blist)`で同じ脆弱性。Issue #51。
| `src/internal/covmat.ts` | 問題未検出 | #219 | `467080a00d97d2c069779452bd5eb30b93047b7b` | — | R `isSymmetric`相当の100ε相対判定とfactanal/omegaのcovmat契約をソース確認（未実行） | 空/非正方/非有限/非正対角/非対称/許容誤差内対称/極端スケールを確認。入力: `checkCovmat([[1,0.5],[0.5,1]])`; `checkCovmat([[1,0.5],[0.5000000000001,1]])`; `checkCovmat([[1,0],[0,Number.MIN_VALUE]])`; `checkCovmat([[1,0],[0,0]])`; `checkCovmat([[1,2],[2,1]])`。全行長と有限値を先に検証し、scaleToUnitで2冪正規化してからisSymmetricを適用するため巨大/極小値の和のoverflow/underflowを回避。正定値性まではこのhelperの責務ではなく、呼出元のfactor model/solverへ委ねる。新規再現欠陥なし。
| `src/internal/ddexp.ts` | 問題あり | #220 | `467080a00d97d2c069779452bd5eb30b93047b7b` | [#52](https://github.com/numero-uno-jpn/rStats.js/issues/52); [#54](https://github.com/numero-uno-jpn/rStats.js/issues/54) | Rのlocation-scale quantile/density契約とIEEE-754 exact-product semanticsを検討（R実行なし）。log-sum-expは数学的恒等式 | ddExpの±708/709.8切替、LN2 range reduction/Taylor/repeated squaring、standardizeDDのoverflow/subnormal recursion、divideTail、logRatioDD、mulDD threshold、expNeg/expNegOverのsubnormal scaling、log1mExp/logAddExp/logSubExp、logOneMinusExpNeg、locationScale/affine cancellationを確認。Issue #52再現: `locationScale(-1,1e308,1e-308)`。現行`mulDD`はoperand>1e300でfinite productのlow partを捨てるため-1.1102230246251565e-16。exact binary64 product+(-1)は約-7.969431103331108e-17。Issue #54再現: `logAddExp(Infinity,Infinity)` はInfinity-Infinityを指数部で計算しNaN、期待Infinity。両方の原因は別個。
| `src/internal/discrete.ts` | 問題あり | #221 | `467080a00d97d2c069779452bd5eb30b93047b7b` | [#53](https://github.com/numero-uno-jpn/rStats.js/issues/53) | Rとの照合なし。整数supportの単調predicate search契約とNumber.MAX_VALUE境界を検証 | discreteQuantileのlinear/log probability slack、lower/upper tail反転、p≈1の小さい補尾比較、y0丸め/clamp、2^53 spacing、doubling/bisection、NaN CDF propagation、firstTrue/lastTrueを確認。既知の#106指摘を再検証し、firstTrueのoverflowを確認。再現: `firstTrue(x => x >= 1.6e308,1e308,Infinity)` はInfinityを返すが有限閾値1.6e308が存在。Nodeで現行アルゴリズムを実行。discreteQuantileにはNumber.MAX_VALUE guardがあるのにfirstTrueにはない。firstTrueはbinomTestのtwo-sidedPから使用されるが、提示した極端な直接入力でのhelper契約不具合であり、public binomTestで同じ大きさの不具合が到達可能かは未確認。Issue #53。
| `src/internal/dpq.ts` | 問題未検出 | #120 | `543eb6ceb3de7627a7562b035a931a88da424aa7` | — | Rと同じ（lower.tail/log.pの仕様） | #120でsmallerTailのp>1/2時の尾部反転、linearTarget保持、logP時のexpm1補数を再確認。qgamma 3286件のR 4.5.2 fixtureを閲覧、未実行。 |
| `src/internal/extremes.ts` | 問題未検出 | #222 | `467080a00d97d2c069779452bd5eb30b93047b7b` | — | Math.max/Math.min IEEE-754 semanticsおよびsafe midpointの算術から判定（R関数比較対象外） | maxOf/minOfの空配列、NaN、±Infinity、±0、疎配列、ArrayLike/typed array大容量と、midpointの同符号overflow・異符号極値・subnormal tieを確認。入力: `maxOf([])`; `minOf([])`; `maxOf([NaN,2])`; `minOf([-0,0])`; `midpoint(Number.MAX_VALUE,Number.MAX_VALUE)`; `midpoint(-Number.MAX_VALUE,Number.MAX_VALUE)`; `midpoint(Number.MAX_VALUE,0.9*Number.MAX_VALUE)`; `midpoint(Number.MIN_VALUE,0)`。空配列の±Infinity、NaN伝播、signed-zeroはMath.max/minと一致。midpointは通常式でoverflowした場合のみ半値和へfallbackし、有限な真の平均を保つ。新規再現欠陥なし。
| `src/internal/fround.ts` | 問題未検出 | #223 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | IEEE-754 binary64のroundingとR `round`/`zapsmall`の仕様記述をソース照合（実行なし） | half-even、負数、負のゼロ、subnormal、digits=-308/323境界、15桁早期return、zapsmallのNaN/Inf混在を確認。入力: `roundR(2.5)`; `roundR(-2.5)`; `roundR(1.25,1)`; `roundR(-1.25,1)`; `roundR(Number.MIN_VALUE,323)`; `roundR(1e308,-308)`; `zapsmall([[1e308,1e-308],[NaN,Infinity]])`。桁数丸め・二進浮動小数の候補距離・tie-even処理に再現可能な誤りなし。 |
| `src/internal/integer.ts` | 問題未検出 | #224 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | Rの整数引数半整数処理と相対許容差の仕様コメントを照合（実行なし） | `roundHalfEven`の±0.5/±1.5/±2.5、2^53以上の表現可能整数、`nonInt`の1e-9相対slack、NaN/±Infを確認。入力: `nonInt(2+1.1e-9)`; `nonInt(2+2e-9)`; `nonInt(2**53)`; `nonInt(Infinity)`; `nonInt(NaN)`; `roundHalfEven(-1.5)`; `roundHalfEven(2.5)`。非有限値は別途parameter validationを担う呼出元で扱われる。新規再現欠陥なし。 |
| `src/internal/invert.ts` | 問題未検出 | #225 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | 連続分布quantileのlog-tail Newton/Halley、R quantile契約、gamma/t/beta/Fの呼出経路をソース照合（R/Vitest未実行） | 正値supportのu=log(x)変換、±Infinity bracket、residual符号、linearTarget/logTarget切替、Halley比率guard、stuck/converged判定、positive polish、subnormal xでのbitwise bisectionを追跡。入力例: `qgamma(1e-300,2)`相当の深い下側tail、`qgamma(1-1e-15,2)`相当の上側tail、`qbeta(3.8e-277,27.9,1.5e299)`、`qchisq(1.5e-233,6.3e234)`に対応する内部経路を確認。有限の符号反対端点で`lo+(hi-lo)/2`がoverflowする理論余地はあるが、今回追跡した公開分布のbracket遷移では誤答を再現できずIssue化せず。 |
| `src/internal/levels.ts` | 問題未検出 | #226 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | R factor/as.characterの15 significant digits仕様と既存numberLevels testsを照合（実行なし） | sort→formatR→同一文字列level統合、-0正規化、NaN保持、非数値label不変、±Infの文字表記を確認。入力: `numberLevels([0.1+0.2,0.3,1e15,1e15+1,-0,0,NaN,Infinity,-Infinity])`; `levelText(1/3)`。`test/numberLevels.test.ts`は0.1+0.2/0.3、1e15/1e15+1の統合とTukeyHSD/pairwise row/col namesを固定。新規再現欠陥なし。 |
| `src/internal/noncentral.ts` | 問題未検出 | #227 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | IEEE-754 ordered-double search、非心分布quantileのbracket、Gauss-Kronrod適応積分の呼出元をソース照合（実行なし） | doubleKey/keyDoubleの負数・-0・subnormal・±Inf順序、searchDoublesのfail/pass bracket、narrowQuantile、quadratureControl、kronrodAdaptiveの区間分割と停止条件を追跡。入力: `searchDoubles(1,0,2,x=>x>=1.5)`相当の境界、負側の隣接double、非心χ²の`qchisq(5.7285590455359545e-12,5.345349749112763,{ncp:1})`に対応するsteep-CDF search。kronrodAdaptiveは今回の公開呼出元では非負の有限offset区間で使用され、極端な符号反対有限端点のmidpoint overflowは到達しない。新規再現欠陥なし。 |
| `src/internal/poissonMixture.ts` | 問題あり | #228, #309 | `f0c6a1cf85875cf87f5174c0fcc5575e31db5746` | [#64](https://github.com/numero-uno-jpn/rStats.js/issues/64) | `src/distributions/nchisq.ts`、`src/distributions/nbeta.ts` の公開呼出経路と `test/nchisq.test.ts`、`test/nbeta.test.ts` を再確認（実行なし） | Scaled mantissa/exponent、Poisson upper/lower start、`startSearch`のbisection、`argmax/farEdge`、`sumLower/sumUpper`のindex progression、MAX_TERMS、mu=0/巨大muを追跡。確定したソース上のhang経路: `pchisq(9e-301,1,{ncp:1e308,lowerTail:true})`。mu=5e307、Bessel argument≈9486.83でasymptotic cutoff未満、normal xなのでsubnormal処理なし。`startSearch`はmode付近の整数を表現できず、開始Jは2^53を大幅に超える。`sumLower`の`j--`は`j-1===j`となりloop progressが失われる。Issue #64作成。パッケージ/Vitest実行なし。 |
| `src/internal/scaledInverse.ts` | 問題未検出 | #229 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | Cholesky標準誤差計算の列別2冪スケーリングとchol2invをソース照合（実行なし） | upper triangleの各列max、2^-400/2^400閾値、subnormal/巨大列のexponent、inverseの`2^(-e_j-e_k)`復元側の呼出契約を確認。入力: `[[1e-200,2e-200],[0,1e-200]]`; `[[1e200,2e200],[0,1e200]]`; `[[1,2],[0,1]]`。列単位の正確な2冪スケールで逆行列を求める設計に再現可能な誤りなし。 |
| `src/internal/seq.ts` | 問題未検出 | #230 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | R `seq(from,to,length.out)`のfractional lengthと両端固定仕様、内部呼出元を照合（実行なし） | n=0/1/2/fractional、to-from overflow、同値端点、最後の端点上書きを確認。入力: `seqLength(-1e308,1e308,3)`; `seqLength(0,1,2.5)`; `seqLength(4,4,5)`; `seqLength(0,1,1)`。有限差分overflow時のhalf-coordinate branchは中間値を有限に保つ。負/NaN lengthの明示validationはないが内部生成格子の呼出元は有効な長さを与え、公開APIではないため新規不具合登録なし。 |
| `src/internal/summary.ts` | 問題未検出 | #231 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | R mean/var/cov semantics、double-double accumulatorと2冪scaleの算術をソース照合（実行なし） | wideSumのoverflow切替/再scale、meanDD補正、centered/scaleToUnit、variance/covariance、Satterthwaite df、rank/tieCounts、completePairs、squareOver/productOver、norm2を確認。入力: `sum([1e308,1e308,-1e308])`; `mean([1e308,1e308,-1e308])`; `standardDeviation([-1e308,-1e308,-1e308,-1e308,1.5e308])`; `productOver(1e-308,1e-308,1e-308)`; `norm2([1e200,1e200])`; `norm2([1e-200,1e-200])`。ldexpの非常に大きな任意指数に対する一般的な限界は確認したが、全呼出元で使う指数範囲（最大でも2*1023等）では中間overflowを再現せず。新規再現欠陥なし。 |
| `src/internal/uniroot.ts` | 問題未検出 | #232 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | R uniroot toleranceとFisher exact CI等の内部odds-ratio rootの単調性をソース照合（実行なし） | wrapperのtol/maxIter/fLower/fUpper転送、logScaleRootのu=log(psi) bracket doubling、psi=0/Infinity端点、belowOne方向、f(1)=0、符号反転時のendpoint順を確認。入力: `logScaleRoot(psi=>psi-0.25,true)`; `logScaleRoot(psi=>psi-4,false)`; `logScaleRoot(psi=>psi-1,true)`。expのunderflow/overflow端点とrootの表現可能範囲の扱いに再現可能な不具合なし。 |
| `src/internal/vectorize.ts` | 問題未検出 | #233 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | 分布関数のscalar/Array/Float64Array shape-preserving契約をソース照合（実行なし） | numberはscalar return、readonly number[]は通常array map、Float64Arrayはtyped-array mapを確認。入力: `2`; `[0,1,2]`; `new Float64Array([0,1,2])`; `new Float64Array([])`。empty typed array、戻り型、要素ごとのf適用に誤りなし。 |
| `src/linalg/balance.ts` | 問題未検出 | #234 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | LAPACK 3.12.0 dgebal/dgebakのpermutation/scaling手順とexpm/eigenの利用箇所を照合（実行なし） | scaled nrm2、isolated row/column permutation、ilo/ihi更新、power-of-two scalingのsfmin/sfmax guard、similarity transform、gebakのscale/逆permutationを確認。入力: `[[1,0,0],[0,2,3],[0,4,5]]`; `[[1,1e200],[1e-200,2]]`; `[[3]]`; `[]`。n=1/0とreducible matrixのindex処理、極端な有限要素のnorm overflowを検討。呼出元expm/eigenのfinite validationと合わせ、誤った固有vector復元を再現できず。 |
| `src/linalg/basic.ts` | 問題未検出 | #235 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | R crossprod/tcrossprod/backsolve/forwardsolve契約とLAPACK dtrsmのsolve順序を照合（既存test/linalg.test.tsを閲覧、実行なし） | vector/matrix RHS shape、k validation、upper/lower、transposeの4経路、exact-zero diagonal、zero RHS/zero coefficient skip、crossprod symmetric mirror、dimension mismatchを確認。入力: `crossprod([[1,2],[3,4]])`; `tcrossprod([[1,2],[3,4]])`; `backsolve([[2,1],[0,4]],[4,8])`; `forwardsolve([[2,0],[1,4]],[4,10])`; `backsolve([[1e-308,0],[0,2]],[1,2])`。既存のfixtureと極端なzero/scaleのsource traceで新規再現欠陥なし。 |
| `src/linalg/chol.ts` | 問題未検出 | #236 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | LAPACK dpotf2/dpstf2/dpotriのCholesky/pivot/rank semanticsとR chol/ chol2inv契約を照合（既存test/chol.test.ts閲覧、実行なし） | upper-only入力、非正pivot、NaN伝播、pivot最大対角選択、tol負値のn*eps*maxdiag、rank stop、permutation swap、chol2inv size/zero diagonal、potri triangular inverseを追跡。入力: `chol([[4,2],[2,3]])`; `chol([[1,1],[1,1]],{pivot:true})`; `chol([[1,0],[0,0]],{pivot:true})`; `chol2inv([[2,1],[0,1]])`; subnormal/巨大対角ケース。fixture外のNaN/Inf境界もコード上確認し、新規再現欠陥なし。 |
| `src/linalg/eigen.ts` | 問題未検出 | #108 | `f71ec0729230db3d5e20c5ab746325ec77345a9a` | — | Rと同じ（Rの `eigen()` 契約、既存のR由来fixture・比較基準を確認。今回R実行なし） | 対称行列の自動判定（相対差・絶対差フォールバック）、下三角採用、Householder三重対角化、implicit QL、固有値降順・固有ベクトル列の対応、非対称行列のbalancing/Hessenberg/Francis double-shift QR、複素共役ペアの並び・位相正規化、onlyValues、NaN/Inf拒否、2の冪スケーリングと逆スケーリングを追跡。固定例: `[[2,1],[1,2]]`（固有値 `[3,1]`）、`[[0,-1],[1,0]]`（固有値 `±i`）、`[[1e308,1e308],[1e308,-1e308]]`（中間演算のスケーリング）、`[[1e-60,2e-60],[3e-60,4e-60]]`（R `isSymmetric` の絶対差フォールバック）。既存 `test/eigen.test.ts` の対称/非対称fixture比較、固有値・固有ベクトル許容差と列整列のテスト構造を閲覧。fixture/Vitest/package runtime/R実行なし。 |
| `src/linalg/expm.ts` | 問題未検出 | #237 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | Higham 2005 scaling-and-squaring Padé係数、expm packageのTaylor/Padé variants、balancing復元をソースと既存test/expm.test.tsで照合（実行なし） | 0x0/1x1 special case、非有限値、Padé degree thresholds、overflowing oneNormのlog2復元、ldexp scaling、Pade13 powers、LU solve、repeated squaringの0*Inf handling、Higham08.b similarity unbalance、Taylor/Pade order validationとCGSを確認。入力: `expm([[0,1],[0,0]])`; `expm([[0,-1],[1,0]])`; `expm([[1e308,0],[0,0]])`; `expm([[0,1],[0,0]],{method:"Taylor",order:1})`。既存fixtureは6 methodのR比較を持つ。高精度極端値の新規誤答は再現できず。 |
| `src/linalg/kappa.ts` | 問題あり | #238 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | [#56](https://github.com/numero-uno-jpn/rStats.js/issues/56) | Moore-Penrose inverseの定義、2-norm condition numberの特異値比、SVDの2冪scale-backを照合（実行なし） | kappa exact norm2のmax/min singular ratio、exact other normのnorm*solve、QR/direct LINPACK dtrco、triangular norm I、ginvのtol cutoff/SVD factor reconstructionを追跡。再現1: `const a=1.7e308; kappa([[a,a],[a,-a]],{exact:true})`。真の特異値は両方`sqrt(2)*a`で条件数1だが、svd scale-back後に両方InfinityとなりInfinity/Infinity=NaN。再現2: `ginv([[1.7e308,1.7e308],[1.7e308,-1.7e308]])`。真の逆行列は各要素±`2.941176470588235e-309`だが、d[0]=Infinityからcut=Infinityとなり全singular componentをskip、ゼロ行列を返す。既存SVD invariant testはscale 1/1e150/1e-150で、この有限入力・spectral norm overflowは未カバー。Issue #56。 |
| `src/linalg/lu.ts` | 問題未検出 | #239 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | LAPACK dgetrf partial pivoting、R Matrix::lu、prcompのscale/SVD/rank semanticsをソースとtest/matrix-ops.test.tsで照合（実行なし） | first-maximum pivot tie、rectangular L/U shape、zero pivot、subnormal pivot reciprocal fallback、P orientation、prcomp center/scale、rank truncation、tol drop、extreme scale fallbackを確認。入力: `lu([[1,2],[3,4]])`; `lu([[0,1],[2,3]])`; `lu([[1,2,3],[4,5,6]])`; `prcomp([[1,2],[2,1],[3,4],[4,3]],{rank:1})`; extreme finite scale and zero-variance columns。新規再現欠陥なし。 |
| `src/linalg/matrix.ts` | 問題未検出 | #240 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | matrix row-array/column-major conversion、rectangular/zero dimensions、SVD rangeExponent呼出契約をソース照合（実行なし） | toMat row-length validation、Float64Array row support、toMatOrColumn vector handling、empty array ambiguity、transpose indexing、fromMat shape、rangeExponentのsubnormal/large finite casesを確認。入力: `toMat([[1,2],[3,4]])`; `toMat([[1],[2,3]])` (ragged error); `toMat([new Float64Array([1,2]),new Float64Array([3,4])])`; `toMat([])`; `rangeExponent([Number.MIN_VALUE,0])`; `rangeExponent([1e308])`。0-row matrixが0x0に制限される仕様もコメントに明記され、shape corruptionの新規再現なし。 |
| `src/linalg/norm.ts` | 問題未検出 | #241 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | R norm typesとLAPACK dlange/dlassq definitionsをソース照合（既存test/linalg.test.ts閲覧、実行なし） | O/1/I/F/E/M/2のcase handling、NaN propagation、Inf handling、Frobenius scale-before-square、spectral norm SVD path、empty dimensionを確認。入力: `norm([[1,-2],[3,4]])`; `norm([[1,-2],[3,4]],{type:"I"})`; `norm([[1e200,1e200]],{type:"F"})`; `norm([[1e-200,1e-200]],{type:"F"})`; `norm([[NaN,1]],{type:"F"})`; `norm([[Infinity]],{type:"2"})`; `norm([],{type:"2"})`。各normのoverflow/underflow/NaN/Inf処理に新規再現欠陥なし。 |
| `src/linalg/ops.ts` | 問題あり | #242 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | [#55](https://github.com/numero-uno-jpn/rStats.js/issues/55) | R base `diag` documentation (vector with explicit dimensions becomes diagonal matrix; values recycled/truncated)およびnumber[][] return contractを照合（R実行なし） | elementwiseのcolumn-major recycling、outer/t、diag scalar/vector/matrix overload、cbind/rbind frame handling、matrix dimensions/byrow、kronecker、seq by/lengthOut/colonを確認。再現: `diag([], {nrow:2,ncol:2})`。values=[]のまま対角構築ループで`values[i % values.length]`を参照し、i%0はNaN、空配列のNaN property indexはundefinedとなるため`[[undefined,0],[0,undefined]]`を返す。number[][]のnumeric contractを破る。R docsは追加引数ありのvectorをdiag valuesとして扱い、diagonal values are recycled/truncatedと説明。既存test/matrix-ops.test.tsのdiag fixtureは空vector/positive dimensionsを含まない。Issue #55。 |
| `src/linalg/qr.ts` | 問題あり | #243 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | [#57](https://github.com/numero-uno-jpn/rStats.js/issues/57) | R `dqrdc2.f` の cancellation norm recompute rule と `qr()` tolerance rank semantics をソース比較。Vitest未実行。 | LINPACK `linpackQR()` の全処理、LAPACK `geqp3/larfg/larf`、Q/Qᵀ/coef/resid/fitted/Q/R/X/solve の呼出経路を追跡。再現: `qr([[0.3,0.3],[0,3.00000003e-8],[0,0]])`。既定tol=1e-7で元列norm≈0.3000000000000015、rank閾値≈3.000000000000015e-8、真の残差norm=3.00000003e-8だが、`1-(0.3/0.3000000000000015)^2≈9.992007221626409e-15` を旧式downdateし、推定norm≈2.9988008435812903e-8に過小評価してrank=1へ誤分類。R `dqrdc2` はt<1e-6でnorm再計算するためrank=2。既存 `test/qr.test.ts` はR fixture比較だが、この閾値直上のcancelケースなし。Issue #57。 |
| `src/linalg/schur.ts` | 問題未検出 | #244 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | 実Schur分解の直交相似変換、2x2複素固有値block標準化、R Matrix::Schur契約と `test/schur.test.ts` を照合（実行なし）。 | Hessenberg reduction、Francis double-shift QR、exceptional shift、deflation、2x2 `lanv2`、固有値の符号順、Q/T再構成を追跡。入力: `[[0,-1],[1,0]]`; `[[4,0.5,2],[1,3,1],[2,1,5]]`; `[[1,1e-300],[0,1]]`; `[[1e300,0],[0,-1e300]]`; `[[0,0],[0,0]]`。有限入力の2x2/複素対/スケール・零行列境界に新規再現不具合なし。 |
| `src/linalg/solve.ts` | 問題未検出 | #109 | `6b9fabe470c0a994e48cd612bcd3e30aaa580aa1` | — | Rでは未確認（R実行・新規照合なし） | LU partial pivoting、exact singular判定、`gecon()` の1-norm reciprocal condition estimate、既定tol=`Number.EPSILON`、極端な大きさのpower-of-two scaling、NaN/Inf時のcondition check skipを追跡。`pseudoQuadratic()` との判定基準不整合を確認するための関連監査。`solve()` 単体の不具合は今回確定せず。Vitest/package runtime/R実行なし。 |
| `src/linalg/svd.ts` | 問題未検出 | #245 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | SVD bidiagonal reduction/QR iteration、R `svd` のnu/nv shape、既存 `test/svd.test.ts` と scale-invariance testsを照合（実行なし）。 | 入力shape tall/wide/square、rank deficient、zero matrix、singular value tie、nu/nv=0/全列/範囲超過、subnormal・極端なscale、singular vector sign/orderを確認。入力: `[[1,2,3],[2,4,6]]`; `[[0,0],[0,0],[0,0]]`; `[[1,0],[0,1],[0,0]]`; `[[1e-300,0],[0,1e-300]]`; `[[1e300,0],[0,1e300]]`; `svd([[1,2],[3,4]],{nu:0,nv:0})`。既知のスケールバック後の特異値overflowは先行Issue #56の `kappa/ginv` 消費側で追跡済み。SVD単体の新規再現不具合なし。 |
| `src/models/anovaSequential.ts` | 問題未検出 | #246 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | R `anova.lm` sequential SS、`anova.glm`/`aovSummary`の自由度とperfect-fit行動をソース・既存test/anova.test.tsで照合（実行なし）。 | pivot/assignによる項順、rank欠損、intercept除外、dfResidual=0、RSSのscale back、weights=0、複数モデルのresponse/rows/weights一致、nestedColumns、perfect-fit警告を確認。入力: `y=[1,2,3,4], x=[[1],[2],[3],[4]]`; saturated `y=[1,2],x=[[1],[2]]`; weighted `weights=[1,0,1,1]`; 非nested列空間比較。負のSS/df時のNaN処理とresidual row形状に新規再現不具合なし。 |
| `src/models/aovEz.ts` | 問題未検出 | #247 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | afex `aov_ez`/car univariate ANOVA、GG/HF/Mauchly、long-to-wide aggregationの既存fixture/test/aovEz.test.tsを照合（実行なし）。 | ID/factor coercionとlevel重複、IDの複数between条件、欠損response/欠損cell/空cell、重複観測mean集約、within factor order、between factor sorted order、type II/III、observed effect-size分母、response scaleを追跡。入力: `id=['s1','s1','s2','s2','s3','s3','s4','s4']`, `W=['a','b','a','b','a','b','a','b']`, `y=[4.1,5.0,3.8,4.9,4.4,5.6,4.0,4.7]`; missing cellを作る1 subject除外例; 1セル複数行平均例; `y=[1e200,-1e200,...]`のscale経路。新規再現不具合なし。 |
| `src/models/aovStrata.ts` | 問題未検出 | #248 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | R `aov(...+Error())` strata、contr.helmert error design、summary(aov)と既存test/aovStrata.test.tsを照合（実行なし）。 | Error()の複数項/特異Error matrix、intercept stratum、Within residual stratum、treatment column projection threshold、double-double Q coordinates、rank 0/df0/weights拒否、scaled SSを追跡。入力: `y=[4,5,6,7,8,9,5,6]`, `id=['a','a','b','b','c','c','d','d']`, `W=['x','y','x','y','x','y','x','y']`; Error factorの重複列/空項; 1e-200・1e200 covariate scale。新規再現不具合なし。 |
| `src/models/carAnova.ts` | 問題未検出 | #249 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | car `Anova()` type II/III sums of squares、partial F、aliased columns、contrastsと既存test/carAnova.test.tsを照合（実行なし）。 | hypothesis row construction、nested/containing terms、intercept/no-intercept、factor contrast、df/rank、perfect fit、residual scaleとeffect-size bookkeepingを確認。入力: `y=[4.2,5.1,6.3,5.8,7.9,8.4,6.6,7.0]`, `A=['a','a','b','b','a','a','b','b']`, `B=['p','q','p','q','p','q','p','q']`; aliased `A:B`; unbalanced cell cases。新規再現不具合なし。 |
| `src/models/coxph.ts` | 問題未検出 | #107 | `206adeeae033f983cc1e2c17b3ba568bd40f3667` | — | Rと同じ（`survival` 3.8系の `coxph` の仕様記述・R由来fixtureを照合。今回R実行なし） | `coxph()` の欠損除外、status/weight/strata、重み付き中心化・スケーリング、Efron/Breslow ties、層別リスク集合、Newton-Raphsonのstep halving・収束判定、一般化Cholesky・共線性、係数/SE/CI/Wald/LR/score統計をソース追跡。具体例: `time=[5,3,8,1,9,4]`, `status=[1,1,0,1,0,1]`, `x=[[1.2],[0.3],[-0.5],[2],[0.7],[0.1]]`; tiesは`efron`/`breslow`、weightsは正整数のみ。`test/coxph.test.ts` と `oracle/coxph-behaviour.md`、R生成スクリプトの重いties・weights・strata・aliased列・単一event・monotone likelihoodケースを閲覧。実行/Vitest/package runtime/R実行なし。 |
| `src/models/ddLeastSquares.ts` | 問題未検出 | #250 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | Double-double Householder least-squares, orthonormal Q coordinates and rank/pivot semanticsをソース照合（実行なし）。 | DD dot/Householder norm/reflector tau、rank0、n=0、multiple RHS、列数>行数、zero column、subnormal residual、back substitutionを確認。入力: columns `[[1,0,0],[0,1,0]]`, response `[[1,2],[3,4],[5,6]]`; zero columns `[[0,0,0]]`; nearly dependent columns `[[1,1],[0,1e-30],[0,0]]`; values ±1e200/1e-200。独立列の内部契約範囲で新規再現不具合なし。 |
| `src/models/ddMatrix.ts` | 問題未検出 | #251 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | DD matrix multiply/transpose/inverse/trace/Cholesky handoffと `ddLeastSquares` consumersをソース照合（実行なし）。 | 0x0/1x1/rectangular、dimension mismatch internal contract、near-singular pivots、DD low component cancellation、positive-definite inverse、trace、transpose symmetryを確認。入力: `[[4,2],[2,3]]`; `[[1,1],[1,1+1e-30]]`; `[[1e-200,0],[0,1e200]]`; empty matrix。内部呼出元の対称正定値・dimension条件下で新規再現不具合なし。 |
| `src/models/estimable.ts` | 問題未検出 | #252 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | R `predict.lm` non-estimable rows/column-space criterion、`nestedColumns`のrank logicをソース照合（実行なし）。 | rank0/empty rows、full rank、aliased columns、row-space residual、threshold境界、NaN/Inf、small/large matrix scalingを確認。入力: `q=qr([[1,0],[0,0],[0,1]])`; rows `[1,0]`, `[0,1]`, `[0,1e-8]`; nested matrices `[[1,0],[0,1]]` と `[[1,0,1],[0,1,1]]`。列空間包含判定とnon-estimableの新規再現不具合なし。 |
| `src/models/formula.ts` | 問題未検出 | #253 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | R formula operator algebra/terms ordering/Error() and random-effect bar parsing; existing test/formulaTests.test.ts and model-matrix callersを照合（実行なし）。 | tokenizer names/numeric constants/backtick limitation、unary +/-、0/1 intercept toggling、`+ - : * / ^ %in%` precedence/expansion、duplicate terms、parentheses、Error() extraction、`|`/`||` grouping、nested random termsを追跡。入力: `y ~ 0 + A*B`; `y ~ A/B/C`; `y ~ (A+B)^2`; `y ~ A - A + B`; `y ~ x + Error(id/W)`; `y ~ x + (1+x|g)`; `y ~ (1|g/h)`。構文サポート範囲内で新規再現不具合なし。 |
| `src/models/glm.ts` | 問題未検出 | #254 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | R `glm.fit` IRLS、rank-deficient QR、family init、deviance/weights, residuals, hatvalues, Cook's distance and predict semanticsを既存test/glm.test.tsで照合（実行なし）。 | NA除外、Inf検出、weights=0、offset、intercept/no-intercept、start/etastart/mustart、step-halving/boundary/separation、rank0/alias、df0、working weights/residuals、hatvalue index alignment、newdata non-estimability、response/link predictionを追跡。入力: `x=[1,2,3,4,5,6]`, `y=[0,0,1,0,1,1]`, binomial; weights `[1,0,1,1,1,1]`; offsets `[0,0,0,0,0,0]`; duplicated predictors `[[1,1],[2,2],[3,3]]`; all-zero weights。新規再現不具合なし。 |
| `src/models/glmAnova.ts` | 問題未検出 | #255 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | R `anova.glm` sequential/model comparison Chisq/LRT/Rao/F/Cp, nested affine models and dispersionをソース・既存test/glmAnova.test.tsで照合（実行なし）。 | response/prior weight identity、offset difference in large model space、non-nested comparison suppression、df sign/order、score statistic centering, fixed/estimated dispersion, dfResidual=0, Cp, scaled Gaussian devianceを確認。入力: binomial `y=[0,0,1,0,1,1]`, `x=[1,2,3,4,5,6]`; models with offsets `[0,0,0,0,0,0]` vs `[1,0,0,0,0,0]`; nested and reversed model order。新規再現不具合なし。 |
| `src/models/glmConfint.ts` | 問題未検出 | #256 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | R profile likelihood and Rao score coefficient intervals, bracketing and Brent/uniroot tolerance; existing test/glmConfint.test.tsを照合（実行なし）。 | aliased parm、duplicate/out-of-range indices、confidence levels near 0/1, profile refit convergence, LRT/Rao, zero/NaN/Inf SE, doubling to 2^30 SE, uniroot bracket/tol and scalingを確認。入力: example binomial `x=[1,2,3,4,5,6]`, `y=[0,0,1,0,1,1]`; `parm=[0,1]`; `level=0.9`; `test='Rao'`; near-extreme levels `1e-12` and `1-1e-12`。新規再現不具合なし。 |
| `src/models/glmFamily.ts` | 問題未検出 | #257 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | R family/link functions and family initialize/deviance/AIC semantics; edge values checked against source formulas and existing glm fixtures (R executionなし)。 | log/logit/probit/cauchit/cloglog/inverse/sqrt/1/mu^2/power links、eta/mu domain、underflow/overflow clamps、binomial one-/two-column counts、fractional count warning、zero weights、Poisson/Gamma/inverse Gaussian/quasi deviance and AICを確認。入力: `makeFamily('binomial','logit')` at eta ±1000; `prepareResponse` for `[[2,8],[8,2]]`; Poisson y `[0,1,1e308]`; Gamma y `[1e-200,1,1e200]`; power lambda `1e-320`。極端power lambdaは有限でも逆数がInfinityとなる入力契約上の制約を確認したが、公開GLMでの再現誤答は確定せずIssue化せず。 |
| `src/models/lm.ts` | 問題未検出 | #258 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | R `lm.fit/lm.wfit`, summary/confint/predict, formula fit and matrix fit semantics; existing test/lm.test.ts and ANOVA callersを照合（実行なし）。 | weighted/unweighted, zero/negative/NaN/Inf weights, rank-deficiency/alias, no-intercept, exact fit/df0, response/weight scaling, covariance and prediction SE, confidence/prediction intervals, non-estimable rowsを確認。入力: `x=[1,2,3,4,5]`, `y=[2.1,3.9,6.2,7.8,10.1]`; duplicated predictors; weights `[1,0,1,1,1]`; constant response; newdata `[1e155]`。新規再現不具合なし。 |
| `src/models/lmer.ts` | 問題未検出 | #259 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | lme4 REML/ML profiled criterion, sparse derivatives, trust-region optimization, theta scaling, singular boundary and result reconstruction; existing test/lmer.test.ts inspected (not executed)。 | exact fixed-effects fit guard, beta0 centering, response 2^k scaling, random-effects term blocks, diagonal boundary release/negative curvature, Hessian eigen cut, trust-region radius/restarts, σ/REML df, VarCorr correlations, ranef/fitted/residuals, empty random termsを追跡。入力: `y=[9.8,10.4,10.1,12.3,12.9,12.0,8.1,7.6,8.4]`, `g=['a','a','a','b','b','b','c','c','c']`; exact `y=[1,2,3], x=[1,2,3]`; response scales 1e200 and 1e-200。今回の入力群で新規再現不具合なし。 |
| `src/models/lmerAnova.ts` | 問題未検出 | #260 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | lmerTest Type I/II/III tables and lme4 likelihood-ratio comparisons, nested fixed/random effects and same-data requirementsをソース・test/lmerCompare.test.tsで照合（実行なし）。 | same data identity/snapshot/rows/response, REML refit, npar sort, nested fixed column spaces, random term containment, zero df, duplicate names, Chisq truncation and type hypothesis mappingを確認。入力: nested `y ~ x + (1|g)` vs `y ~ x + (1+x|g)`; nonnested random structures; contrasts treatment vs sum; model names duplicate; REML/ML mixed. 新規再現不具合なし。 |
| `src/models/lmerHypotheses.ts` | 問題未検出 | #261 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | lmerTest Type I/II/III hypothesis construction, treatment/full-dummy mapping, Doolittle, missing cells and aliased columns; existing test/lmerHypotheses.test.ts inspected (not executed)。 | factor/numeric interaction column order, no intercept, empty terms, missing full-dummy cells, treatment/sum/helmert/poly contrasts, `ginv` mapping, zapsmall, term containment, Doolittle normalized diagonal and rank cutoffを追跡。入力: `y ~ A*B + (1|g)` with unbalanced A×B; numeric predictor scales 1e-6/1e6; aliased columns; empty cells. 新規再現不具合なし。 |
| `src/models/lmerTest.ts` | 問題あり | #262 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | [#58](https://github.com/numero-uno-jpn/rStats.js/issues/58) | Satterthwaite t/F contrast tests and scale invariance of hypothesis Lβ=rhs; existing test/lmerTest.test.ts checks proportional rows but not extreme scaling (実行なし)。 | Hessian eigen cutoff, scaled parameter covariance, Jacobian, tTestOf quadratic form, fTestOf L V L', rank-deficient L, RHS projection, jointDenDF, confidence intervals and contest input validationを追跡。再現: docs fixture data `y=[3.1,4.0,5.2,6.8,7.1,8.3,2.2,3.5,3.9,5.9,6.1,7.4]`, `x=[1,2,3,1,2,3,1,2,3,1,2,3]`, `g=['a','a','a','b','b','b','c','c','c','d','d','d']`; `fit=lmer('y ~ x + (1 | g)',data)`; compare `lmerContest(fit,[0,1],{joint:false,confint:false})` and `[0,1e160]`. Same hypothesis under scalar multiplication, but `quadraticForm(l,vcov)` overflows (~1e320 scale), stdError becomes Infinity, tValue collapses to 0, df can be NaN. Joint F path also forms `L V L'` unscaled. Issue #58。 |
| `src/models/mauchly.ts` | 問題未検出 | #263 | `0dae48405cd78c389dea9d31321ae7cd57b99d84` | — | R `mauchly.test()` の部分空間定義・M/X rank・W/p-value式を照合。`contrastCrossprod` のQRはLINPACK limited pivotingでX列が先頭順に保たれるため、初期疑いは不成立（Issue #59を誤検出としてclose）。 | `y=[[1,0,0,0],[-1,0,0,0],[0,2,0,0],[0,-2,0,0],[0,0,3,0],[0,0,-3,0],[0,0,0,4],[0,0,0,-4]]`, `idata={x:[100,101,102,103],z:[1,-1,-1,1]}`, `M='~x+z'`, `X='~1'`。QR pivot規則・rank containment・空部分空間・n<pp・欠損群・ゼロ/特異Sをソース追跡。Vitest/package runtime/R未実行。 |
| `src/models/mixedDerivatives.ts` | 問題未検出 | #264 | `11af5c07a9c1bcbeb0d9d9ea4eb5b3cf65884340` | — | Satterthwaite用 deviance Hessian、r²微分、REML logdet S微分、selected inverse tangentを式と実装で照合。 | `y=[3.1,4.0,5.2,6.8,7.1,8.3,2.2,3.5,3.9,5.9,6.1,7.4]`, `x=[1,2,3,1,2,3,1,2,3,1,2,3]`, `g=['a','a','a','b','b','b','c','c','c','d','d','d']`; `lmerTest('y~x+(1|g)')` 相当。theta=0境界、REML/ML、p=0、残差PRSS=0での除算経路を追跡。Vitest/package runtime/R未実行。 |
| `src/models/mixedDeviance.ts` | 問題未検出 | #265 | `7fa0cb7b42f83c91d819ac165fd3a8bba18a939a` | — | Sparse block Z'Z構築、symbolic/numeric Cholesky、selected inverse、normal-equation refinement、REML/ML criterionとgradientを追跡。 | 同上の12観測データで `lmer('y~x+(1|g)')`、theta=[0]と[1]、単一/交差/入れ子group、p=0、q=0相当、rank/境界条件を検討。factorisation・Takahashi recurrenceの添字とcolumn-major block layoutをソース照合。Vitest/package runtime/R未実行。 |
| `src/models/mixedStructure.ts` | 問題未検出 | #266 | `40803660d304825257e6b57c034240b328a366e9` | — | random-effects formula展開、grouping factors、||分割、Z/Λθ配置、項順序、alias drop、scale warningを追跡。 | `y=[9.8,10.4,10.1,12.3,12.9,12.0,8.1,7.6,8.4]`, `x=[1,2,3,1,2,3,1,2,3]`, `g=['a','a','a','b','b','b','c','c','c']`; `y~x+(1+x|g)`, `y~(1|a/b)`, `y~(x||g)`。numeric/factor group, empty level, single level, nested/crossed grouping and rank deficiencyを確認。Vitest/package runtime/R未実行。 |
| `src/models/modelFrame.ts` | 問題未検出 | #267 | `fbd2388c426fcb60d770b5790ee28d11857a8548` | — | R model.frame/na.omit、factor level ordering、logical levels、weights row omissionとnegative weight validationを照合。 | `{y:[1,NaN,3,4],A:['b','a',null,'b'],w:[1,2,3,0]}` with names `['y','A']`, weights `'w'`; all-null columns, Float64Array, mixed types, supplied duplicate levels, unused levels, zero/negative/Infinity weights and length mismatch pathsを追跡。Vitest/package runtime/R未実行。 |
| `src/models/modelMatrix.ts` | 問題未検出 | #268 | `9dbfb1a56cb3c730f9d59d5e0dc91da1ea14d0a8` | — | model.matrix terms/assign、factor contrasts treatment/sum/helmert/poly、interactions、no-intercept indicator coding、missing row handlingを追跡。 | `y=[1,2,3,4,5,6]`, `A=['a','b','a','b','c','c']`, `B=['u','u','v','v','u','v']`; formulas `y~A*B`, `y~0+A`, `y~A` with `contr.sum`/`contr.helmert`/`contr.poly`。1-level factor, empty rows, high-degree polynomial contrast and contrast variable absent pathsを確認。Vitest/package runtime/R未実行。 |
| `src/models/scaledTables.ts` | 問題未検出 | #269 | `4f65d01b4bfa9007e772fcf7bfb251a5d68cc417` | — | 15行のWeakMap保管層を確認。scaled ANOVA tablesのidentity/lifetime contractに数値演算はない。 | `const result={}; scaledTables.set(result,{colNames:['SS'],rowNames:['x'],table:[[0.25]]}); scaledTables.get(result)` と別object identity、GC依存のWeakMap特性をソース確認。計算ロジックなし。Vitest/package runtime未実行。 |
| `src/models/survival.ts` | 条件付き問題あり（実データ未再現） | #109–110 | `6b9fabe470c0a994e48cd612bcd3e30aaa580aa1` | [#28](https://github.com/numero-uno-jpn/rStats.js/issues/28) | Rでは未確認（R実行なし） | #109で `pseudoQuadratic()` の固定固有値閾値 `1e-10 * max(lambda)` と `solve()` の既定tol=`Number.EPSILON` の不整合を指摘。#110で `survdiff()` のリスク集合構造を解析：正の期待イベント数を持つ各群は最初のイベント時点で必ずリスク集合に属する。最初のイベント数 d がリスク集合総数 N 未満なら、その時点の分散寄与 `w²*d*(N-d)/(N*(N-1)) * (diag(r)-r*r'/N)` は、使用群のうち1群を除いた部分行列上で正定値。最初の時点で d=N なら全リスク対象が同時イベントとなり、以後のイベントはなく、V=0かつO-E=0。従って通常の入力では `pseudoQuadratic()` が準特異行列の正の小固有値を切り捨てる経路は実証できず、実際のtime/status/group再現なし。Issue #28は補助関数の閾値方針上の懸念として保持し、survdiffの実害は未確定。Vitest/package runtime/R実行なし。 |
| `src/models/tiedTimes.ts` | 問題未検出 | #113 | `6222eb058ce9759e37c852a30a56582b57e18009` | — | Rと同じ（`survival::aeqSurv()` の tie判定・cut point写像と一致。今回R実行なし） | `mergeTiedTimes()` 全体、呼出元 `coxph.ts`/`survival.ts`、`summary.ts` の overflow-safe `mean()`、`test/survival.test.ts`・`test/coxph.test.ts`、`oracle/survival-behaviour.md` を確認。R `aeqSurv.R` の `dy <= tolerance || dy/mean(abs(y)) <= tolerance`、`cuts <- y[c(1,!tied)]`、`findInterval` による写像と実装のロジックは一致。固定例 `[0,1e-8,2e-8]` は隣接差が各 `1e-8` で閾値 `sqrt(2^-52)≈1.4901161193847656e-8` 以下のため全て最小値0へ統合され、両端差 `2e-8` が閾値を超えても連鎖統合される。これはRと同じ仕様。極端値 `[1e308,1.1e308]` はgap `1e307`、平均絶対値 `1.05e308`、相対差約0.095で統合されない。`[-Number.MAX_VALUE,Number.MAX_VALUE]` の差分overflowはInfinityとなり誤統合しない。subnormal・負値・±0・NaN/±Infinityの経路もソース確認。専用 `test/tiedTimes.test.ts` は存在せず、関連テストは閲覧のみ。実行/Vitest/package runtime/R実行なし。 |
| `src/numerics/deriv.ts` | 問題未検出 | #270 | `7a339332c11e4b55e6f35fb8f120c7fd2c92311d` | — | R numerical derivativesのstep sizing、central differences、Richardson extrapolation、gradient/Jacobian/Hessian symmetryを式と実装で照合。 | `f=([x,y])=>x*x+3*x*y+4*y*y`, points `[0,1]`, `[1e-300,-2]`, `[1e150,1e150]`; `eps=0`, `zeroTol=0`, r=1/複数段、dimension 0/1、非有限戻り値とsubnormal stepを検討。実行なしのソース/IEEE-754境界確認。Vitest/package runtime/R未実行。 |
| `src/numerics/integrate.ts` | 問題あり | #271 | `ebafffb5a5862eea43c4b32e4456eed02ba51227` | [#61](https://github.com/numero-uno-jpn/rStats.js/issues/61) | R `optimize()` は内部wrapperでNaN/±Infを有限最大値へ置換するが、現行 `optimize()` は非有限値を直接 `localMin` に渡し、探索が停止しない。R `src/library/stats/src/optimize.c` と比較。 | `optimize(x => x >= 0.5 ? NaN : (x-0.2)**2,0,1)`。初期点 `0.3819660112501051` は有限、次点 `0.6180339887498949` はNaN。Brent updateが同じ点を再評価し続け、iteration capなしでhangする。Issue #61。integrate finite/infinite limits, reversed bounds, tolerances, uniroot endpoints/extensionもソース確認。Vitest/package runtime/R未実行。 |
| `src/numerics/interp.ts` | 問題未検出 | #272 | `d9c76b9bb91a45caf0b04da7d56d9627bd711f57` | — | approx ties/order/NA、barycentric Lagrange、Hermite、natural/periodic spline coefficients and extrapolation、overflow-safe knot scalingを追跡。 | `x=[0,1,1,2]`, `y=[0,1,3,4]`, queries `[-1,0,0.5,2,3]`; duplicate knots, unsorted x, n=2/3, periodic boundary, zero-width intervals, extreme/subnormal knot spacing, derivative orders 0–3を確認。Vitest/package runtime/R未実行。 |
| `src/numerics/ode.ts` | 問題未検出 | #273 | `6d0a98f2caf7cd2e74f232c2c19fd9191397428e` | — | ODE time-grid direction/duplicate times、fixed/adaptive step control、state dimension、error tolerance and non-finite derivative pathsを追跡。 | `f=(t,y)=>[y[0]]`, `y0=[1]`, times `[0,0.5,1]`, `[1,0.5,0]`, `[0,0,1]`; zero/negative step, single time, empty state, NaN/Inf state and derivative pathsを確認。Vitest/package runtime/R未実行。 |
| `src/optim/lbfgsb.ts` | 問題未検出 | #274 | `fd14e53c5730a4162316a5cafe67d29526530b37` | — | L-BFGS-B 2.1 portのactive set、projected gradient、generalized Cauchy point、subspace minimization、line search、workspace indexingを追跡。 | 2変数Rosenbrock `f=(1-x)^2+100(y-x*x)^2`、bounds `[-2,-2]` to `[0.5,2]`; lower/upper-only, both-bound, active/fixed coordinate, n=0/1, m=1, non-positive curvature and line-search terminationをソース確認。Vitest/package runtime未実行。 |
| `src/optim/localmin.ts` | 問題あり | #275 | `3dfa016606ccc35da6f69bff24dcc1eb2232e264` | [#61](https://github.com/numero-uno-jpn/rStats.js/issues/61) | Brent local minimizerは有限な目的関数値を前提に比較分岐する。`integrate.ts` の公開 `optimize()` wrapperがRと同じ非有限値置換を行わず、NaNで更新停止・再評価ループとなる。 | `f(x)=x>=0.5?NaN:(x-0.2)**2`, interval `[0,1]`: trial `0.6180339887498949` returns NaN; subsequent comparisons are all false and same trial repeats indefinitely. Internal helper; public path is `optimize()`. Issue #61。Vitest/package runtime/R未実行。 |
| `src/optim/optim.ts` | 問題未検出 | #276 | `3bacfc992f3c178642b03380ccd8c7aca4bc6c1d` | — | Nelder-Mead/BFGS/CG/L-BFGS-B/SANN/Brent、scaled gradients, line search, stopping criteria and Hessianを追跡。固定bounds `lower===upper` では有限差分幅0となるが、R `optim.c` fmingr bounded branchも同じ除算・エラーになるため不具合扱いしない（Issue #60を誤検出としてclose）。 | Rosenbrock `f(x)=(1-x0)^2+100*(x1-x0*x0)^2`, start `[-1.2,1]`; bounds `[-2,-2]`/`[0.5,2]`; fixed coordinate `par=[1,2], lower=[1,-Inf], upper=[1,Inf]`; `ndeps=0`, maxit=0, pgtol/factr edgesをソース比較。Vitest/package runtime/R未実行。 |
| `src/random/as241.ts` | 一部監査・問題未検出 | #135 | `77d0da9eaa12609d445d0433e4d3ac0d84f50600` | — | AS241係数とnorm fixtureをソース照合（未実行） | Wichura AS241の中心域/裾域分岐、係数順序、Horner評価、符号反転を確認。RのnormRandが生成するp範囲との整合を確認。独立数値実験・Vitest未実行。
| `src/random/beta.ts` | 問題あり | #122 | `10357380b3019e5ea6089224e3a0d4152702e639` | [#30](https://github.com/numero-uno-jpn/rStats.js/issues/30) | RのCheng BB/BC法を参照。極端な片側巨大shapeでRとの一致より分布の正しさに問題 | `rbeta(5,1.1,1e308)` はオーバーフロー分岐で全値を平均約1.1e-308に固定。理論CV≈0.953。ソースと分布式による確認。Vitest・R・simulation未実行。 |
| `src/random/binomial.ts` | 問題あり | #124 | `92437f63fa655aa541de9ba9b6ae51c0bad0af5b` | — | Inversion/BTPE source review; tiny-p q^n cancellation defect confirmed by binary64 arithmetic | `n=2_000_000_000, p=1e-17`: q rounds to 1, qn=1, every inversion draw returns 0 although P(X≥1)≈2e-8. Issue #31. BTPE formula compared with current R source; fixtures R 4.5.2 inspected only. No Vitest/runtime/R execution. |
| `src/random/common.ts` | 一部監査・問題未検出 | #136 | `77d0da9eaa12609d445d0433e4d3ac0d84f50600` | — | random fixture群と呼出し側の契約をソース確認（未実行） | generateのn有限/非負・小数切捨て・0件時の乱数非消費、powIntの負指数/NaN/Infinity/二乗法を確認。powIntは32-bit bitwise shiftを使うため2^31以上の指数で安全でない可能性があるが、実呼出し箇所と到達可能性を確定できず不具合認定せず。Vitest未実行。
| `src/random/continuous.ts` | 既知差異あり・追加問題未検出 | #134 | `77d0da9eaa12609d445d0433e4d3ac0d84f50600` | — | R 4.5.2 rbasic/rother fixtureを閲覧（未実行） | runif/rnorm/rexp/rlnorm/rlogis/rcauchy/rweibullの変換式、無効値・0/Inf時の乱数消費、overflow幅の補間を確認。rlogis(scale<0)は実装NaNに対しR fixtureは符号反転値を返す既知差異。Vitest未実行。
| `src/random/extra.ts` | 一部監査・問題未検出 | #130 | `75095a2c450c18de77f8ceacc259b90bd246a288` | — | extraDistr R 4.5.2 fixture を閲覧（未実行） | inverse-gamma/gamma変換、Kumaraswamy・Pareto逆関数、三角分布の2様本順序統計量法、Laplace指数・符号、arcsine逆関数、無効引数時の乱数消費と極端な有限端点をソース確認。R 4.5.2 fixture 20ケースを閲覧。Vitest・package runtime・R実行なし。 |
| `src/random/gamma.ts` | 問題あり | #121 | `9a6b479fa51c0e16a8313c9c2518c75130c84004` | [#29](https://github.com/numero-uno-jpn/rStats.js/issues/29) | R本体 `src/nmath/rgamma.c` と不一致 | `rgamma(1,-1,{scale:0})` と `rgamma(1,0,{scale:-1})`。Rは両方0、現行はNaN。負値判定がゼロ判定より先。ソース照合で確定。Vitest・package runtime・今回のR実行なし。 |
| `src/random/hyper.ts` | 一部監査・問題未検出 | #126 | `df63732522e39556a07f79edbb5a287f7348fa87` | — | — | — |
| `src/random/lecuyer.ts` | 一部監査・問題未検出 | #132 | `ff8994e573a5d1731aaf1e26d633ee907cc1bdcf` | — | R 4.5.2 L'Ecuyer fixtureを閲覧（未実行） | MRG32k3aのseed expansion・2つのmodular recurrence・uniform mapping・signed/unsigned seed復元と範囲検証を確認。fixture内の複数seed・RNG state・後続uniformを閲覧。Vitest・package runtime・R実行なし。 |
| `src/random/mt.ts` | 一部監査・問題未検出 | #133 | `77d0da9eaa12609d445d0433e4d3ac0d84f50600` | — | R 4.5.2 rbasic fixtureを閲覧（未実行） | MT19937 twist/tempering、R set.seedの50回LCG初期化、32-bit unsigned演算、[0,1)から(0,1)へのfixup、626要素stateの復元と境界を確認。seed=1/42/-7/123456789のrunif/rnorm/rexp値を閲覧。Vitest未実行。
| `src/random/poisson.ts` | 一部監査・問題未検出 | #123 | `cf352aaf46ae22782a09d7c054fd3716a370d7a6` | — | R本体 `src/nmath/rpois.c` のAhrens–Dieter法と主要分岐・定数を照合 | λ=0, 0.1, 1, 5, 9.99, 10, 15, 50, 100, 1e4, 1e7, Inf, -1, NaN。32 fixture cases (R 4.5.2) inspected only. No new reproducible defect; source review only, no Vitest/runtime/R/simulation. Extreme λ beyond fixture and precision/overflow behavior not exhaustively validated. |
| `src/random/r2dtable.ts` | 一部監査・問題未検出 | #127 | `8ccc84fc49823aa54db9eb23da7d7b3df00033f0` | — | — | — |
| `src/random/rank.ts` | 一部監査・問題未検出 | #129 | `6f8c6930b3c84d99f07d6fe7c0bc0622569ae526` | — | R 4.5.2 rsignrank/rwilcox fixture を閲覧（未実行） | 符号付き順位和の独立Bernoulli符号化、順位和の部分Fisher–Yates抽出、half-even整数化、0/負値/NaN/Inf/上限、R RNG stream消費をソース照合。R 4.5.2 fixture 10ケースを閲覧。Vitest・package runtime・R実行なし。 |
| `src/random/rng.ts` | 既知差異あり・追加問題未検出 | #137 | `77d0da9eaa12609d445d0433e4d3ac0d84f50600` | — | R 4.5.2 rngRounding/rngLecuyer/rngStreams/rbasic fixtureと既存テストを閲覧（未実行） | RNGkind切替時のseed消費、sampleKind維持、state kind code、rbits/unifIndexの棄却抽出、normRandの2-uniform精度、expRand SA法を確認。既知差異：rbinom BTPEのstream差、rlogis負scale、Rの無効状態時の再seed動作。独立実行なし。
| `src/random/sample.ts` | 一部監査・問題未検出 | #128 | `b2a2a714b624fdd7f8e422e7a5210000a759d710` | — | — | — |
| `src/random/streams.ts` | 一部監査・問題未検出 | #131 | `b6d645d063aee7a2793eaec9e8e78fad80d2acd9` | — | R 4.5.2 parallel stream fixture・行列冪のテスト定義を閲覧（未実行） | L'Ecuyer-CMRGの2^76/2^127 jump行列、modular multiplication、signed seed layout、state validationを確認。BigIntで遷移行列を再計算する既存テストとR 4.5.2 fixtureを閲覧。Vitest・独立実行なし。 |
| `src/special/besselIK.ts` | 問題未検出 | #277 | `66fd0dbb53c64d7aa52c27ce6b96f640482e6dac` | — | Modified Bessel I/K series, Temme, continued fractions, Wronskian, recurrence, scaled exponent and large-order log boundsを追跡。 | `besselI/K(x,nu)` with x `0`, `Number.MIN_VALUE`, `1e-310`, `1`, `1e308`, `Infinity`; nu `0`, `±0.5`, `1`, `1000`, `1e12`; scaled/unscaled, integer/negative noninteger orders and recurrence limitsを確認。Vitest/package runtime/R未実行。 |
| `src/special/besselJY.ts` | 問題未検出 | #278 | `72fbd7798357b583eb92556d320998fb85c9ce3c` | — | J/Y power series, asymptotic Hankel expansions, order recurrence, Wronskian and negative-order reflectionを追跡。 | `besselJ/Y(x,nu)` with x `0`, `Number.MIN_VALUE`, `1e-300`, `1`, `100`, `1e308`, `Infinity`; nu `0`, `±0.5`, `±1`, `1000`, `1e12`; near-integer reflection, large-order range bounds and asymptotic transitionを確認。Vitest/package runtime/R未実行。 |
| `src/special/besselSeries.ts` | 問題未検出 | #279 | `ab0d8df401ba07f397f1fef22742a4c6674c4937` | — | 共通series prefixのlog-gamma/Poisson scaling、underflow/overflow回避、subnormal x経路を追跡。 | `seriesTimesPrefix(v,x,sum)` のv `0`, `0.5`, `10`, `1e3`, `1e308`、x `Number.MIN_VALUE`, `1e-300`, `1`, `1e308`; gamma/log prefix and zero/infinite sum edgesを確認。Vitest/package runtime/R未実行。 |
| `src/special/beta.ts` | 問題未検出 | #280 | `bd639c0fdaa40df7e6579ffa0b76a67c6d738e97` | — | Beta/log-betaの対称性、small/large shape、DD addition, Stirling error, gamma ratio, endpoint and sign handlingを追跡。 | `beta/lbeta(a,b)` for `(0.5,2)`, `(1e-310,1e-310)`, `(1e308,1e308)`, `(1e308,0.5)`, `(0,Infinity)`, negative/non-finite arguments; swapped arguments and representability boundariesを確認。Vitest/package runtime/R未実行。 |
| `src/special/choose.ts` | 問題未検出 | #281 | `2e6ccb1afeeb6a30c677aeccd774573a67775601` | — | choose/lchoose/factorial/lfactorialのinteger/noninteger, negative n, half-even snapping, falling-product DD and log-beta branchesを追跡。 | `choose(n,k)` for `(-3,2)`, `(-3,4)`, `(5,7)`, `(100,50)`, `(1e308,2)`, `(Infinity,1)`, fractional `n=3.5`; k=0, negative, noninteger, >=30 and overflow boundariesを確認。Vitest/package runtime/R未実行。 |
| `src/special/constants.ts` | 問題未検出 | #282 | `a91323eca383899e9b268af39f700cc356dc61bc` | — | 定数定義のみ。IEEE-754表現、π/log constants and shared exportsを確認。 | 全定数のliteral/aliasとimport先を静的確認。関数・分岐・ユーザー入力なし。runtime未実行。 |
| `src/special/dd.ts` | 問題あり | #283 | `1e377fb5795b4695ca7ad147b48b7ead850d2fe6` | [#62](https://github.com/numero-uno-jpn/rStats.js/issues/62) | `prodErrScaled()` の指数スケール復元順序により、subnormal×巨大数の積の低位残差が中間 underflow で消失。`twoProd` と `ddMul` の共通fallback。 | `twoProd(1e-320,1e308)` は `[9.99988867182683e-13,0]`、逆順 `twoProd(1e308,1e-320)` は `[9.99988867182683e-13,2.524354896707238e-29]`。binary64入力の正確な積との差は両順序とも約 `2.5243548967072378e-29`。追加例 `twoProd(1e-308,1e308)` の正確な残差 `3.132799142920457e-17` に対し低位成分0。Nodeでソース式を再現しDecimalで残差を照合。Vitest/package runtime/R未実行。 |
| `src/special/erf.ts` | 問題未検出 | #284 | `f72136920c3138354d5d6cd4a342055e590e0fad` | — | Cephes rational approximationの係数・領域境界、erfcx変換、負値対称性、exp(-x²)のDD残差とsubnormal出力を追跡。 | `erf/erfc(x)` の `x=[-Infinity,-27.3,-1,-0,0,1,8,27.2,27.3,Infinity,NaN]`、`erfcxNonNegative([0,0.5,1,8,1e8,1e308,Infinity])`。x=1,8の係数切替、x² overflow/underflow、負の無限大を確認。`test/erf.test.ts` のmpmath fixtureと特殊値テストを確認。Vitest未実行。 |
| `src/special/extra.ts` | 問題未検出 | #285 | `f4da727f23f20c049946c5c962f54ac270678e26` | — | 非正規化不完全ガンマ、erfinv/erfcinvの端点・subnormal変換、Newton補正、permutationの積/ガンマ比/反射を追跡。 | `gammainc(x,a)` は `(0,1)`, `(Infinity,1e308)`, `(5e-324,0.5)`, `(1e308,171.7)`、`erfcinv(z)` は `z=[0,5e-324,2^-1021,1,2]`、`erfinv(y)` は `y=[-1,-0,0,1e-300,0.5,1]`、`perm(n,k)` は `(0,0),(5,2),(5,6),(5.5,2),(1e308,0.5)`。Infinityのnは「real n」仕様の範囲外として不具合認定せず。`test/specialextra.test.ts` とmPMath fixture群を確認。Vitest未実行。 |
| `src/special/gamma.ts` | 問題未検出 | #286 | `f630bdd496fc204dd24b6b04603c7b511a5cb107` | — | Gamma reflection、sinpi range reduction、small argument expansion、Stirling overflow threshold、lgammaSign、lgamma1p Taylorの範囲を追跡。 | `gamma/lgamma(x)` は `x=[-Infinity,-171.7,-34.5,-1,-5e-324,-1e-308,-0,0,5e-324,1e-300,0.8,1,2,33,171.624376956302725,172,MAX_VALUE,Infinity,NaN]`。負整数のpole、負の大引数の符号、±0、subnormal、MAXGAM/MAXLGM境界を確認。`test/special.test.ts` のgamma/lgamma fixtureを確認。Vitest未実行。 |
| `src/special/igam.ts` | 追加監査済み・問題未検出 | #119, #311 | `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620` | — | `test/fixtures/pgamma.json`、`pgamma.ref.json`、`audit_pgamma.mpmath.json`、`gammainc.mpmath.json`、`gammainc_regions.mpmath.json` と gamma distribution callerを閲覧（実行なし） | gammaInc/gammaIncBothのspecial endpoints、x≫a asymptotic、a<A_SUB upper-tail scaling、series/DD series、continued fraction/Lentz切替、Temme central/far-tail、eta/deviance、log/linear complementを追跡。具体入力: `gammaInc(5e-324,1e-300,true,true)`, `gammaInc(1e308,5e-324,true,true)`, `gammaInc(1e308,1e308,true,true)`, `gammaInc(1e300,1e-300,false,true)`, `gammaInc(1e-300,1e-300,false,true)`, `gammaInc(1e6,1e6*(1+1e-8),false,true)`, `gammaInc(2,1e200,false,true)`。既存fixture sourceと全分岐を確認したが、新規の独立再現不具合なし。Vitest/R/package runtime実行なし。 |
| `src/special/igamAsympCoeff.ts` | 問題未検出 | #287 | `303c31a00d04790f242125345c8a1d6e984b0774` | — | SciPy/xsf由来Temme不完全ガンマ漸近展開係数の配列形状・係数順・K/N定数を利用側 `igam.ts` と照合。 | `IGAM_ASYMP_COEFF_K=25`, `IGAM_ASYMP_COEFF_N=25`, `IGAM_ASYMP_COEFF_D` の各25行×25係数を静的に確認。`igam.ts:temmeSum` の k/n走査と係数使用位置を照合。入力データを受ける関数ではない。runtime未実行。 |
| `src/special/igami.ts` | 追加監査済み・問題未検出 | #120, #312 | `008fc2b262eaa649093211a40e9d7fdd83facdcf` | — | `qgamma.json`、`auditq_qgamma.mpmath.json` と `gamma.ts:qgammaStd/logTinyGammaQuantile` 呼出経路を閲覧（実行なし） | DiDonato–Morris Eq.21–36のshape<1/≥1分岐、p/q反転、gamma(a) overflow、subnormal shape、q near 0/1、eq25多項式、didonatoSN停止、a≥500近中心近似、Newton初期値の利用を追跡。具体入力: `qgamma(0.5,Number.MIN_VALUE)`, `qgamma(1-1e-15,1e-308)`, `qgamma(1e-300,0.01)`, `qgamma(1e-300,0.5)`, `qgamma(1-1e-15,1e6)`, `qgamma(1e-320,1e300)`。tiny quantile branchは極小shapeでfindInverseGammaに入る前に処理し、gamma(shape) overflow候補を回避。初期値はinvertContinuousで補正される。新規再現不具合なし。Vitest/R/package runtime実行なし。 |
| `src/special/incbet.ts` | 問題未検出 | #288 | `59a4ebdf385c69124e68fae6d16159bfd6709a24` | — | pseries/pseriesComplement、double-double continued fraction2種、tail選択、tinyX、subShapeTail、log/linear同時返却、100000反復上限とrescaleを追跡。dd.tsの#62残差欠落は共通プリミティブの別issueとして記録。 | `betaInc`/公開 `pbeta` の境界 `x=0,1`, `a,b` tiny/huge、`x`/`1-x` subnormal、`a,b>=25` のTemme切替、`a` just below 2^52/2^52/2^52+1、`a+b` overflowを確認。具体例 `pbeta(1e-307,55.1,6.3e307,{lowerTail:false})`, `pbeta(0.5,1e308,1e308)`, `pbeta(5e-324,5.7e-37,2)`。`test/beta.test.ts` のpbeta/largeA/largeDf fixture群を確認。Vitest未実行。 |
| `src/special/incbetLargeA.ts` | 問題未検出 | #289 | `9eabe133979cd41a00a904c61cb60ed6b35b6693` | — | large-a/small-b expansionの領域判定、J/H side、upper gamma scaled CF、p_n recurrence、H_N下向き再帰、asymptotic truncationとlog fallbackを追跡。 | `betaIncLargeA(a,b,x,1-x,tail)` の境界例 `a=[15,1e3,1e300]`, `b=[0.1,0.5,40]`, `x=[0.7,0.95,1-1e-15,1-1e-300]`。`Y_MAX=0.3`, `U_MIN_J=0.1`, `U_MAX=500`, `NMAX=30` の領域境界とb=0.5の閉形式を確認。Vitest未実行。 |
| `src/special/incbetPrefactor.ts` | 問題未検出 | #290 | `bf49427ee0d86f326b25dbb3841c4f355ca6444c` | — | small-shape/huge-shape prefactor、lgammaRatioHugeの打切り誤差、smallShapeGの分岐、log1m、mulBigのスケーリングを追跡。 | `prefactorParts(a,b,x,1-x)` の `min(a,b)=[5e-324,1e-300,0.999999,1]`, `max(a,b)=[0.5,1,2^52,1e308]`、xと1-xをそれぞれsubnormal/0.5/1近傍に設定。`HUGE_SHAPE=2^52`, `HUGE_SHAPE_MAX_SMALL=100` と境界の不等号を確認。Vitest未実行。 |
| `src/special/incbetTemme.ts` | 問題未検出 | #291 | `cf22538af050c12366e0e0a19ab40ddcd09c7db6` | — | Temme一様漸近展開の変数変換、Taylor係数生成、1/m展開、central/tail形式の切替、a+b overflow時のhalvingとDD devianceを追跡。 | `betaIncTemme(a,b,x,1-x,tail)` の `(a,b)=[(25,25),(100,50),(50,100),(1e308,1e308),(1e308,50)]`、xをmeanの両側と `|tau|=1` 近傍に設定。`TEMME_MIN_M=25`, `TAU_MAX=1`, `Y_SWITCH=1.5`, `KMAX=12` の境界を確認。`test/beta.test.ts` のpbeta fixture経由を確認。Vitest未実行。 |
| `src/special/lgammaDiff.ts` | 問題未検出 | #292 | `22ddcc50b01890dafbbb49a1a1aa7ac2c840dfee` | — | lgamma(b+a)-lgamma(b)のrecurrenceでbを15超へ移す手順、Stirling差分expm1級数、DD主項、呼び出し元のshape制約を追跡。 | `lgammaDiffDD(a,b)` の呼び出し側条件を確認し、`a=[0,5e-324,1e-300,0.5,1,100]`, `b=[1e-300,0.5,1,15,15+EPS,1e8,1e308]` を境界検討。`incbetPrefactor.smallShapeG` は小shape/巨大shape分岐で入力比を制御し、`incbet` のpseriesComplementはtail selection下で使用される。単体runtime未実行。 |
| `src/special/loader.ts` | 問題あり | #96 | `ac5d64a614debaa2922754bd257f2b8286619518` | [#24](https://github.com/numero-uno-jpn/rStats.js/issues/24) | Rでは未確認 | 中央二項確率の解析式と Stirling 漸近、IEEE-754 中間積の独立計算。実パッケージ実行・R比較なし。 |
| `src/special/log1p.ts` | 問題未検出 | #293 | `dc2f13d6617f0ce76986a8b88f353c45819d378f` | — | Rmath C API/DPQと内部ddexp/gamma/log1pmx呼出契約をソース照合（実行なし） | log1pmx/lgamma1p/log1mexp/log1pexpのNaN・±Inf・±0・pole、-37/18/33.3切替、x=0/subnormal/ln2境界を確認。具体入力: `log1mexp(5e-324)`, `log1pexp(-37)`, `log1pexp(33.3)`, `lgamma1p(-1)`。`test/log1p.test.ts`とRmpfr fixture閲覧。新規不具合なし。Vitest/package runtime/R実行なし。 |
| `src/special/log1pmx.ts` | 問題未検出 | #294 | `2645eccad6849a9c217899b99e71e58d6e7055f8` | — | xsf/Cephes級数・直接log1p-x経路をソース照合（実行なし） | 交代級数、500項上限、相対停止条件、±0.5/-1/下側定義域、±Inf/NaN/subnormalを確認。具体入力: `log1pmx(0)`, `log1pmx(5e-324)`, `log1pmx(-0.5)`, `log1pmx(-1)`, `log1pmx(Infinity)`。x=0の余分反復は上限内で結果0。新規機能不具合なし。Vitest/package runtime/R実行なし。 |
| `src/special/ndtri.ts` | 問題未検出 | #295 | `a053252d5cbafbbb22f395fc4c2034da9c2ee5e9` | — | xsf/Cephes ndtri/ndtri_exp係数、裾切替、qnorm経路をソース照合（実行なし） | p=0/1/範囲外/NaN、exp(-2)/exp(-32)切替、subnormal、upper-tail complement、logp=-MAX_VALUEを確認。具体入力: `ndtri(5e-324)`, `ndtri(1-Number.EPSILON/2)`, `ndtriExp(-Number.MAX_VALUE)`, `ndtriExp(-Infinity)`。Vitest/package runtime/R実行なし。 |
| `src/special/polevl.ts` | 問題未検出 | #296 | `165b2c81afea8cb58b56f67264dafdf22810f089` | — | Cephes Horner係数順序と全呼出元の係数配列を静的照合（実行なし） | polevl/p1evlの係数順序、固定配列非空・次数整合を確認。具体入力: `polevl(2,[1,2,3])`=11、`p1evl(2,[2,3])`=11、x=0/±Inf/NaN。空配列は内部契約外で公開呼出元なし。Vitest/package runtime/R実行なし。 |
| `src/special/psigamma.ts` | 問題未検出 | #297 | `6318724165a556417c0644172c9e80d4735c3b4e` | — | digamma/trigamma/psigamma反射、Hurwitz zeta Euler–Maclaurin、負根Taylor展開をR/mpmath fixtureと照合（実行なし） | deriv丸め/0〜100、負整数pole、±Inf/NaN、半整数cot、巨大負数、subnormal正数、漸近打切りを確認。具体入力: `psigamma(-0.5,100)`, `psigamma(-0.5040830082644554,100)`, `psigamma(1e-300,2)`, `psigamma(1e17,20)`。Vitest/package runtime/R実行なし。 |
| `src/special/rCompatible.ts` | 問題未検出 | #298 | `feaa578359e0a3315eedc20a6da93a1f60285eb9` | — | RCompatibleOptions型と全利用側のdefault/false分岐を静的照合（実行なし） | 型定義のみでruntime logicなし。具体例: `trigamma(-Infinity)`と`trigamma(-Infinity,{rCompatible:false})`、`psigamma(-Infinity,3)`と同false指定。test/psigamma.test.tsを閲覧。Vitest/package runtime/R実行なし。 |

## Audit #94

- Repository HEAD: `05e52efbc8f54e505da82fb10555834a02666e46`
- `src/distributions/bvnorm.ts` blob SHA: `3fab7f50d90262fb3295fae0ba5980f636b4ef11`
- Result: `pbvnorm()` の `rho = -1` 境界分岐で誤った上側直交象限確率を返す。
- Reproduction: `pbvnorm([-1, -0.5], [Infinity, Infinity], -1)`
- Expected: `Phi(0.5) - Phi(-1) = 0.532807207342556`（`Y = -X` という完全負相関の関係から導出）。
- Actual: `0.1498822847945298`（ソース分岐の式を代入）。
- R relationship: `Rでは未確認`（R/mvtnorm 実行環境なし）。
- Verification: ソース経路の追跡と標準正規CDFの独立計算。Vitest全体・Rとの実行比較は未実施。
- Issue: [#23](https://github.com/numero-uno-jpn/rStats.js/issues/23) (`area:distributions`, `priority:high`, `bug`).

## Audit #95

- Target: `src/distributions/arcsine.ts`
- Repository HEAD: `058fff6bf6d780aec1f369ca7520bbc50ef11471`
- File blob SHA: `907b0a4b3b55ca8f4b21325dca7de651fb8f420b`
- Result: source inspection did not identify a confirmed defect; status is `問題未検出`, not `問題なし確認済`.
- Scope: `darcsine1()`, `parcsine1()`, `qarcsine1()`; interval endpoints, finite-width overflow scaling, near-endpoint tails, log-probability branches, mirrored upper-tail handling, and density endpoint singularities.
- Expected-value basis reviewed: analytic arcsine formulas (`f(x)=1/(π√((x-a)(b-x)))`, `F(x)=(2/π)asin(√z)`, quantile via `sin²(πp/2)`), plus repository mpmath 1.4.1 region fixtures `darcsine_regions.mpmath.json`, `parcsine_regions.mpmath.json`, and `qarcsine_regions.mpmath.json`. Fixtures were inspected but not executed.
- R relationship: `Rでは未確認`; source documentation says base R and extraDistr have no corresponding arcsine distribution functions.
- Verification limits: source-level reasoning and fixture review only; no isolated runtime harness, full Vitest run, or R comparison. Therefore not marked `問題なし確認済`.

## Audit #96

- Target files: `src/distributions/multinomial.ts` (public path) and `src/special/loader.ts` (shared root cause).
- Repository HEAD: `cf1b318aae1458a9fc8d22c40a1118e7570a52f6`
- Reproduction: `dmultinom([8e307, 8e307], [0.5, 0.5])` and `dmultinom([8e307, 8e307], [0.5, 0.5], { log: true })`.
- Expected: `C(2m,m)/4^m`, `m=8e307`, approximately `6.307831305050442e-155`; log approximately `-355.0588974883506`.
- Root cause: `2 * Math.PI * x * (nmx / n)` overflows at the first intermediate product even though `nmx/n=0.5`; `expNegDD()` then divides by `sqrt(Infinity)` in its ordinary branch.
- R relationship: `Rでは未確認`.
- Evidence: source path analysis, IEEE-754 arithmetic, central-binomial Stirling approximation. Full package/Vitest/R execution not performed.
- Issue: [#24](https://github.com/numero-uno-jpn/rStats.js/issues/24) (`area:distributions`, `priority:medium`, `bug`). Both files share one root cause and are tracked by one Issue.

## Audit #97

- Target: `src/distributions/triangular.ts`
- Repository HEAD: `6077b7d90cf06effb6e9ba4d08e6414b64c790a2`
- File blob SHA: `1cfca6585cf8bad66c282af3b6973fbb8086f288`
- Result: `問題未検出` (source and existing test/fixture review; not a proof of absence).
- Scope: density/CDF/quantile; endpoint modes `c=a` and `c=b`; interval-width overflow and subnormal width; tail/log-probability branches; inverse-transform branches around the mode.
- Reproduction/test inputs inspected: `wide={a:-1e308,b:1e308,c:0}`; `narrow={a:0,b:2.362486118430361e-229,c:2.362486118430361e-229}`; `qtriang(2.5e-182,{a:0,b:141,c:0})`; and fixed `near1={a:51.80896011403241,b:54.36503630721428,c:52.30157068741966}` with `q=54.365036307212875`.
- Expected-value basis: triangular closed forms; the existing test explicitly checks scale invariance, endpoint-mode inverse CDF, finite probabilities and density scaling. `ptriang`/`qtriang` fixtures generated from R 4.5.2 / extraDistr, density fixtures additionally include mpmath. Fixture contents were reviewed, not executed.
- R relationship: `Rと同じ` for ordinary fixture cases by fixture provenance; no fresh R execution in this audit.
- Verification limits: source-level formula/path inspection and existing test/fixture review only. No isolated runtime harness, full Vitest run, or fresh R comparison.

## Audit #98

- Target: `src/distributions/cauchy.ts`, `dcauchy1()`.
- Repository HEAD: `6a3eedcc2d465be8e7bbb614884e1a95ea22180d`
- File blob SHA: `6cb203fa576c3a71798c554feef638f69f08a2c5`
- Result: confirmed defect; `|z| > 1` non-log density branch overflows `Math.PI * scale` for large finite scales, returning 0 when the true density is representable.
- Exact reproduction: `dcauchy(1.1e308, { location: 0, scale: 1e308 })`; `z ≈ 1.1`.
- Expected: approximately `1.44031622707598e-309`, from `((1 / Math.PI) / scale) / (1 + z*z)` and the closed-form Cauchy density.
- Actual: `0`, because `Math.PI * 1e308` is `Infinity` in the current non-log branch. The log branch gives `-711.1339310435451`; exponentiating gives approximately `1.440316227076037e-309`.
- R relationship: `Rでは未確認` (no fresh R runtime comparison).
- Verification: exact source expression evaluated in an isolated JavaScript arithmetic harness; existing Cauchy fixture reviewed and found not to include this large-scale case. Full package/Vitest execution not performed.
- Issue: [#25](https://github.com/numero-uno-jpn/rStats.js/issues/25) (`bug`, `area:distributions`, `priority:medium`).


## Audit #99

- Target: `src/distributions/beta.ts` (`dbeta1`, `pbeta1`, `qbeta1`, `dbetaCore`, `solveLeftHalf`, `stepQuantile`).
- Repository HEAD: `9cb145a85e8153ea0712e2fd38b65885e5a016e5`
- File blob SHA: `959f9a68947eae3813d0fa8ed001f39380677e76`
- Result: `問題未検出`; source inspection did not establish a reproducible defect.
- Scope: support endpoints and point masses (`shape = 0` / `Infinity`), `shape = 1` density, NaN/negative parameters, lower/upper and log-probability paths, tiny/subnormal x and 1-x, huge/tiny shapes, overflow-safe shape sums, concentrated distributions and quantile left/right-frame inversion.
- Exact fixed cases reviewed from the changelog and tests include `pbeta(1.5e-236, 9220.5, 2.6e301)`, `pbeta(0.998, 55.1, 6.3e307)`, `pbeta(1.5e-323, 1.4e304, 0.5)`, `qbeta(3.8e-277, 27.9, 1.5e299)`, and `qbeta(8.7e-285, 1.3e304, 5.9)`.
- Expected-value basis: beta density/CDF/quantile identities and documented comparison values in `CHANGELOG.md`; `test/beta.test.ts` uses R-generated fixtures and a backward-CDF check for quantiles. Fixture contents and branch logic were inspected, not executed.
- R relationship: `Rと同じ` for ordinary fixture cases by fixture provenance / changelog comparisons; no fresh R execution in this round.
- Verification limits: source-level control-flow and arithmetic review plus test/changelog inspection only. No runtime harness, fixture execution, full Vitest run, or fresh R comparison; therefore not `問題なし確認済`.


## Audit #100

- Target: `src/distributions/chisq.ts` (central `dchisq`, `pchisq`, `qchisq` wrappers).
- Repository HEAD: `94e98787221087403c05cdb46f69f55c0760823b`
- File blob SHA: `f9463e9674d80dc480143cc56976763288cf6559`
- Result: confirmed invalid-parameter validation bug; all three wrappers halve `df` before the gamma implementation validates the shape.
- Exact reproduction: `const df = -Number.MIN_VALUE;` (`df === -5e-324`, `df < 0` is true); `df / 2` is `-0` and `Object.is(df / 2, -0)` is true. Downstream gamma shape checks use `shape < 0` and `shape === 0`, so `-0` is treated as shape zero. Predicted central paths: `dchisq(0, df)` → `Infinity`, `dchisq(1, df)` → `0`, `pchisq(1, df)` → `1`, `qchisq(0.5, df)` → `0`, instead of NaN for invalid negative df.
- Expected-value basis: negative degrees of freedom are invalid in R's chi-square distribution contract; the local gamma/chi-square fixture code also explicitly treats negative shape/df as invalid before quantile endpoint handling. No fresh R execution.
- Root cause is wrapper validation order; one Issue covers all three functions.
- R relationship: `Rと同じ` for the negative-df invalidity contract; no runtime R comparison in this round.
- Verification limits: exact IEEE-754 underflow-to-signed-zero semantics plus source-level branch tracing. No package runtime, Vitest, or R execution.
- Issue: [#26](https://github.com/numero-uno-jpn/rStats.js/issues/26) (`bug`, `area:distributions`, `priority:medium`).


## Audit #101

- Repository HEAD SHA: `8e360c3fb4481da28f2e8eba5fb8d9918af3263f`
- Source: `src/distributions/binomial.ts` (blob `2f90ac1e001443b0704f33e76585cb2868497724`)
- Result: `問題未検出`. No reproducible defect was established in the inspected source paths.
- Scope: `dbinom1`, `pbinom1`, `pbinomRaw`, `qbinom1`, and `roundHalfEven`; invalid and infinite parameters, support endpoints, degenerate probabilities, non-integer q rounding, the >2^53 correction, lower/upper tails, log probabilities, and discrete quantile search.
- Evidence: inspected the existing mpmath 1.4.1 `test/fixtures/audit_pbinom.mpmath.json` cases and the `qbinom` fixture. The `floor(q + 1e-7)` operation was reviewed as the discrete-CDF rounding convention, not treated as a defect.
- R relationship: `Rでは未確認`; no fresh R execution or source comparison was performed.
- Verification limits: source and fixture inspection only; fixtures, Vitest, and the package runtime were not executed. No issue was created.


## Audit #102

- Repository HEAD SHA: `1aaef113968bfa70a39ed2c501e3b65238763409`
- Source: `src/distributions/exponential.ts` (blob `5370e52ae3428099245fb643c7721cbb7a748b3c`)
- Result: `問題あり`; GitHub Issue [#27](https://github.com/numero-uno-jpn/rStats.js/issues/27).
- Reproduction: `pexp(1e-20, { rate: 1e-300, logP: true })` returns `-736.8272408909739`; mathematical reference is `ln(1e-320) = -736.8272297580946188857572654989965...`.
- Root cause: `pexp1` forms `t = mulDD(rate, q)`; the product is subnormal, so `twoProd` cannot retain its residual. `logOneMinusExpNeg` then logs the rounded product, magnifying its relative rounding error. The existing `test/helpers/distributionKnown.ts` explicitly records this discrepancy as retained for R compatibility.
- Expected-value basis: exponential CDF `log(1-exp(-rate*q))`; at `rate*q = 1e-320`, this is indistinguishable from `log(1e-320)` at the shown precision. Independent high-precision Decimal calculation.
- R relationship: `Rも誤り`; the R-derived fixture/known-violation records the same inaccurate value. No fresh R execution.
- Verification limits: source and fixture/known-violation inspection plus independent high-precision calculation; no package runtime or Vitest execution.


## Audit #103

- Repository HEAD SHA: `fe88f1b31ddb3a69cef524aeb9aa5dd08509e0a8`
- Source: `src/distributions/geometric.ts` (blob `dfde963375d347292c88306f151aaa3a8a66612b`).
- Result: `問題未検出`; no reproducible defect was established in the inspected paths. No Issue created.
- Scope: `dgeom1`, `pgeom1`, `qgeom1`, `probPair`, and `qPow`; invalid/NaN/infinite probabilities, support endpoints and non-integer observations, the `floor(q + 1e-7)` convention, lower/upper and log-probability paths, discrete quantile boundaries and rounding slack, subnormal probabilities, and the (n \ge 10^{290}) scaled-log branch. The (x=0) special path through `dbinomRawDD` was also inspected, including its distinction from the interior binomial denominator path implicated in Issue #24.
- Exact high-range cases reviewed from the changelog: `pgeom(1e290, 5e-324)` (now `4.940656458412465e-34`) and `pgeom(8.7e299, 1.1e-300)` (now approximately `0.616`). Existing R 4.5.2 fixtures were reviewed: `dgeom.json` (1,472 cases), `pgeom.json` (2,944 cases), and `qgeom.json` (1,696 cases). The fixtures were inspected, not executed.
- Expected-value basis: geometric distribution identities (P(X=x)=p(1-p)^x), (P(X>q)=(1-p)^{\lfloor q\rfloor+1}), and the smallest-integer quantile (\lceil \log(u)/\log(1-p)\rceil-1), together with the repository's R-generated fixtures and documented high-range regression cases.
- R relationship: `Rと同じ` for ordinary cases by fixture provenance and changelog comparisons; no fresh R execution in this round.
- Verification limits: source-level branch/arithmetic review and fixture/changelog inspection only. No isolated runtime harness, fixture execution, full Vitest run, or fresh R comparison; therefore status remains `問題未検出`, not `問題なし確認済`.


## Audit #104

- Repository HEAD SHA: `1dfe5fed11b61ba734bbf1b6b99df58c2ede61bb`
- Source: `src/distributions/poisson.ts` (blob `8bac99d8cfb238c1d682278c145798d0c44abc0b`). Related shared paths inspected: `src/special/igam.ts` and `src/internal/discrete.ts`.
- Result: `問題未検出`; no reproducible defect established in the inspected Poisson paths. No Issue created.
- Scope: `dpois1`, `ppois1`, `qpois1`; lambda=0 and Infinity, NaN/Infinity arguments, support endpoints, non-integer q rounding, lower/upper tails and log probabilities, the (x+1) correction beyond (2^{53}), gamma incomplete-function branch selection, subnormal tail reconstruction, and discrete quantile boundary/search behavior.
- Exact regression examples reviewed from source/CHANGELOG: `ppois(1e16, 1e16)` (the old (x+1) rounding path was below 1/2; corrected via (Q(x,\lambda)+dpois(x,\lambda))); the large-λ tail case `ppois(3.28e19 + 1e11, 3.28e19)`; and the historical nontermination of `qpois` for λ around (10^{20}). The changelog records the tail accuracy improvement to about (2.7\times10^{-15}) relative for λ above (10^6), 5–40 standard deviations below the mean.
- Existing fixtures inspected: R-derived `dpois.json` (1,448), `ppois.json` (2,896), `qpois.json` (1,696); independent mpmath `audit_ppois.mpmath.json` (1,474) and `auditq_qpois.mpmath.json` (250). These were inspected, not executed.
- Expected-value basis: Poisson PMF (e^{-\lambda}\lambda^x/x!\), CDF via (Q(\lfloor q\rfloor+1,\lambda)\), the (2^{53})-safe identity (P(X\le x)=Q(x,\lambda)+P(X=x)\), and the discrete quantile definition as the smallest integer whose CDF reaches the requested probability. Existing R and independent mpmath fixtures plus documented regression cases were used as corroboration.
- R relationship: `Rと同じ` for ordinary behavior based on R 4.5.2 fixture provenance; mpmath fixtures independently support selected tail values. No fresh R execution this round.
- Verification limits: source/branch/arithmetic review and fixture/CHANGELOG inspection only. No isolated runtime harness, fixture execution, full Vitest run, or fresh R comparison; status remains `問題未検出`, not `問題なし確認済`.


## Audit #105

- Repository HEAD: `c9000fd10b357980c675d98bc3a851446fff48ba`
- `src/internal/dpq.ts` blob SHA: `543eb6ceb3de7627a7562b035a931a88da424aa7`
- Result: ソース確認範囲では問題未検出。`dt0`/`dt1` の4通りは確率0/1の lower/upper-tail・log/non-log 表現と一致。`d0` は密度0の通常値0・log値−Infinity。`quantileBoundaries` は線形確率の0/1端点、範囲外値、およびlog確率の0/−Infinity端点を lowerTail に応じて左右端へ写像する。`smallerTail` は p ≤ 1/2 では指定尾部を維持し、p > 1/2 では `1-p` または `-expm1(logP)` に切り替えるため、補数の桁落ちを避ける設計。
- Reproduction inputs (literal values): linear `p = [0, 1, 0.25, 0.5, 0.75, 1e-300]`; log `p = [0, -Infinity, -0.25, -1, -1000, 1]`; `lowerTail = [true, false]`; `logP = [true, false]`; `log = [true, false]`. `smallerTail` の期待値は `p=0.75` で補数 `0.25`、`p=0.25` で元の下側確率 `0.25`、log確率 `-0.25` の上側変換で `log(1-exp(-0.25))`。
- R relationship: `Rと同じ`（Rの `lower.tail` / `log.p` / `log` の端点・尾部変換仕様に対応。今回R実行なし）。
- Scope/limitations: `src/internal/dpq.ts` の関数本体と契約コメントを確認。CHANGELOG Unreleased と 0.15.3 の数値安定性修正を確認。独立実行ハーネス、Vitest、package runtime、R実行なし。したがって状態は `問題未検出` とし、`問題なし確認済` とはしない。


## Audit #106

- Repository HEAD: `bd1abcb7e80997ab9bf1a965a30b93a86ac24c24`
- `src/internal/discrete.ts` blob SHA: `a8ed86222a9c91b7dfea90b990244a81c1170194`
- Result: `firstTrue()` に境界値バグを1件発見。指数探索中に `lo + step` が `Infinity` へオーバーフローした場合、`Number.MAX_VALUE` を確認せず、二分探索も `Infinity` で停止する。
- Reproduction (literal): `firstTrue(x => x >= 1.6e308, 1e308, Infinity)`.
- Expected: `1.6e308`（この入力に対する最小の表現可能な整数値であり、述語を満たす）。Actual: `Infinity`。
- Execution: Node.jsで `src/internal/discrete.ts` の `firstTrue()` 本体を同一転記して実行。結果 `Infinity`、述語評価回数1024、最後に有限だった指数ステップ `8.98846567431158e307`。次の `lo + step` は `Infinity` となり、有限のしきい値を飛び越す。
- Cross-check: 同じファイルの `discreteQuantile()` は `good === Infinity && hi === Infinity` の場合に `Number.MAX_VALUE` を評価する特別処理を持つが、`firstTrue()` には同等の処理がない。
- Proposed fix: 指数ステップまたは候補点が `Infinity` に達した場合、`Number.MAX_VALUE` を評価点として試す。述語が成立すれば `[fails, Number.MAX_VALUE]` を二分探索し、成立しなければ `hi`（Infinity）を返す。実際の整数サポートの上限・契約も併せて確認する。
- R relationship: `Rでは未確認`。内部探索関数単体の境界不具合であり、R実行なし。
- Scope/limitations: `discreteQuantile()` / `firstTrue()` / `lastTrue()` のソースレビュー。`firstTrue()` の再現はNode.jsで実施。Vitest全体、呼び出し元統合、R比較は未実施。


## Audit #107

- Repository HEAD: `206adeeae033f983cc1e2c17b3ba568bd40f3667`
- Targets:
  - `src/models/coxph.ts` blob `2e3bc2355f92336b7433ae8c4e812c6d0441faba`
  - `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`
  - `src/models/tiedTimes.ts` blob `229af071501c8dbc7bdcc0c03d503346ed227713`
- Result: inspected paths did not establish a confirmed defect; all three files are `問題未検出`, not `問題なし確認済`.
- `tiedTimes`: the apparent absolute-tolerance concern was checked against R `survival::aeqSurv()`. R's published implementation uses exactly `dy <= tolerance || dy / mean(abs(y)) <= tolerance`, with `tolerance = sqrt(.Machine$double.eps)`; the absolute-gap behavior is intentional and the implementation follows it. Exact input considered: `[1, 1 + 1e-9, 1 + 1e-7]`; the first gap is merged by the absolute criterion and the second remains distinct.
- `survfit`: traced same-time event/censor handling (all subjects remain at risk at the event time), risk-set decrement after the time group, Kaplan–Meier product, Greenwood accumulation, log/plain/log-log intervals, and median/median-limit rule. Literal example reviewed: `time=[1,2,2,3,4]`, `status=[1,1,0,1,0]`.
- `survdiff`: traced pooled KM weight immediately before each event time, observed/expected counts, squared weights in the variance, positive-expected group selection, and singular-submatrix fallback. Literal example reviewed: `time=[1,2,3,4,5,6]`, `status=[1,1,0,1,1,1]`, `group=["a","b","a","b","a","b"]`, with `rho=0`, and the fixture's `rho=1` and `rho=0.5` cases.
- `coxph`: traced row filtering, status and weight validation, weighted centring/scaling, Efron/Breslow tie contributions, stratum-specific risk sets, Newton–Raphson step halving and convergence, generalized Cholesky handling of aliased columns, coefficient/variance and summary statistics. Literal example reviewed: `time=[5,3,8,1,9,4]`, `status=[1,1,0,1,0,1]`, `x=[[1.2],[0.3],[-0.5],[2],[0.7],[0.1]]`.
- Expected-value basis: repository `oracle/coxph-behaviour.md` and `oracle/survival-behaviour.md`, the R-generated `coxph` and `survival` fixtures, analytic Cox partial-likelihood/Kaplan–Meier/Greenwood/log-rank formulas, and R `survival::aeqSurv()` documentation/source. The fixture files and tests were inspected, not executed.
- R relationship: `Rと同じ` for the inspected contract and fixture provenance; no fresh R execution.
- Verification limits: source-level path/formula review and existing test/oracle/fixture inspection only. No isolated runtime harness, fixture execution, full Vitest run, or R comparison. No Issue created.


## Audit #108

- Repository HEAD: `f71ec0729230db3d5e20c5ab746325ec77345a9a`
- Source: `src/linalg/eigen.ts` blob `86ee78a9fd9f3edbbc35e86f3805ea910e15ff18`.
- Related source inspected: `src/linalg/balance.ts` blob `b0796b3365f4f23a7a02efdb05628380f85cf284`; `src/internal/summary.ts` (`ldexp` power-of-two scaling).
- Result: `問題未検出`; no confirmed defect established in the inspected eigenvalue/eigenvector paths.
- Scope: symmetric detection and lower-triangle semantics; Householder tridiagonalisation and implicit QL; descending eigenvalue sort with corresponding vector permutation; nonsymmetric balancing, Hessenberg reduction, Francis double-shift QR, real Schur back-substitution, complex conjugate ordering and phase normalisation; `onlyValues`; finite-input validation; power-of-two scaling and rescaling.
- Exact literal examples reviewed: `[[2,1],[1,2]]` (eigenvalues `[3,1]`); `[[0,-1],[1,0]]` (eigenvalues `0 + i` and `0 - i`); `[[1e308,1e308],[1e308,-1e308]]` (extreme-magnitude scaling); `[[1e-60,2e-60],[3e-60,4e-60]]` (automatic symmetry detection relative to R's `isSymmetric` absolute fallback).
- Downstream relevance: `survdiff()` uses `eigen(V, { symmetric: true })` for the singular-variance quadratic form fallback. The eigenvalue threshold and rank decision in `pseudoQuadratic()` remain a separate policy in `src/models/survival.ts`; this audit does not certify that threshold for every possible log-rank covariance matrix.
- Tests: inspected `test/eigen.test.ts`, including symmetric and general eigen suites, R-generated expected values, vector column alignment, eigenvalue-gap and eigenvector-condition tolerances. Tests and fixtures were not executed.
- R relationship: `Rと同じ` for documented result shape, ordering and comparison-contract review; no fresh R execution.
- Verification limits: source-level algorithm and branch review plus test-structure inspection only. No standalone numerical harness, fixture execution, full Vitest run, or R comparison. No Issue created.



## Audit #109

- Repository HEAD: `6b9fabe470c0a994e48cd612bcd3e30aaa580aa1`
- Sources:
  - `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`
  - `src/linalg/solve.ts` blob `6e423f1c2969b896c1715f5af95864c6f59dea24`
  - `src/linalg/eigen.ts` blob `86ee78a9fd9f3edbbc35e86f3805ea910e15ff18` (reused from #108)
- Result: `src/models/survival.ts` has a confirmed numerical-rank policy defect in `pseudoQuadratic()`; GitHub Issue [#28](https://github.com/numero-uno-jpn/rStats.js/issues/28). `src/linalg/solve.ts` was reviewed as a dependency and no independent defect was established (`問題未検出`).
- Root cause: `survdiff()` first calls `solve(Vr,u)`. With default `tol = Number.EPSILON`, `solve()` rejects matrices whose estimated reciprocal condition number is below about `2.22e-16`. The fallback `pseudoQuadratic()`, however, discards every eigenvalue not greater than `1e-10 * max(eigenvalues)`. This cutoff can throw away positive modes that remain resolvable at double precision, so the fallback's reported statistic and degrees of freedom can be too small.
- Exact deterministic helper-level input:
  ```ts
  const V = [[1, 0, 0], [0, 1e-12, 0], [0, 0, 1e-17]];
  const u = [0, 1e-6, 1e-8];
  ```
  Eigenvalues are `[1, 1e-12, 1e-17]`; reciprocal condition number is `1e-17`, below `Number.EPSILON`. The current `1e-10` cutoff retains only the first mode and gives `chisq=0, df=1`. Retaining the first two modes (and discarding only the 1e-17 mode, below machine precision relative to the maximum) gives `chisq=1, df=2`. Retaining all exact positive modes gives `chisq=11, df=3`.
- Important qualification: this is a deterministic reproduction of the fallback helper's numerical-rank policy, not yet an end-to-end `survdiff(time,status,group)` reproduction. A risk-set dataset producing this eigen-spectrum has not been constructed. The Issue explicitly records this limitation; an integrated regression case remains necessary.
- `solve.ts` review: partial-pivoting LU, exact zero-pivot detection, 1-norm reciprocal-condition estimate via `gecon/lacn2`, default `Number.EPSILON` tolerance, power-of-two scaling for extreme magnitudes, and behavior for nonfinite matrices. No independent solve defect established in this pass.
- Tests: inspected `test/survival.test.ts`, including the R fixture comparison harness and missing-data/median edge tests. The test file references fixture `survival`; neither it nor any solve/eigen test was executed. No package runtime or Vitest run.
- R relationship: `Rでは未確認`; no fresh R execution or integrated R comparison. Existing tests/oracle were inspected only.
- Verification limits: source-level control-flow review and exact arithmetic on a diagonal PSD matrix. No package runtime, Vitest, or R execution. Status for `survival.ts` is `問題あり` because the helper-level cutoff defect is deterministic; end-to-end reachability remains to be established.



## Audit #110

- Repository HEAD: `550b7110092eb4be63f8076b9a1e8a831bbca22c`
- Source: `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`; related `src/linalg/solve.ts` and `src/linalg/eigen.ts` were considered from audits #108–109.
- Result: no integrated `survdiff(time,status,group)` reproduction of the #109 near-singular positive-eigenvalue cutoff issue was established. The concern remains a helper-level numerical-rank policy issue (Issue [#28](https://github.com/numero-uno-jpn/rStats.js/issues/28)); actual impact on ordinary `survdiff()` inputs is unconfirmed.
- Structural argument:
  1. Let `t1` be the earliest event time. Any group with positive expected event count has at least one subject who experiences an event at some time `tj >= t1`; that subject is therefore in the risk set at `t1`. Thus every group included in the contrast calculation has a positive risk count `r_g` at the first event time.
  2. If the first event count `d < N` (where `N` is the total risk set), its variance contribution has positive scalar `d*(N-d)/(N*(N-1))` because `rho` weight at the first event is `KM^rho = 1`. The matrix `diag(r)-r*r'/N` is positive definite on the reduced contrast coordinates after dropping one group, since all used groups have positive risk counts. Later event-time contributions are positive semidefinite, so the accumulated reduced covariance matrix is positive definite in exact arithmetic.
  3. If `d = N` at the first event time, all subjects still at risk fail at that time. No later event is possible; groups censored before that time have zero expected count and are excluded. For the included groups, `O=E`, `V=0`, and the pseudo-quadratic form has rank 0 and statistic 0. The eigenvalue cutoff does not alter this result.
- Exact fixed input already used in #107 and reviewed again: `time=[1,2,3,4,5,6]`, `status=[1,1,0,1,1,1]`, `group=["a","b","a","b","a","b"]`. No package execution was performed, so no numeric result is claimed for this round.
- Consequence: the near-singular spectrum in #109 (`V=diag(1,1e-12,1e-17)`) is a valid helper-level counterexample to the fixed cutoff, but has not been shown to be realizable by `survdiff()` risk-set accumulation. A finite dataset with an extreme condition number sufficient to trigger the `solve()` fallback was not found. The fallback appears to serve principally the all-fail-at-once zero-variance case for ordinary data.
- Verification limits: source/formula proof review only. No generated-data search, package runtime, Vitest, fixture execution, or fresh R execution. The result is not a claim that the complete survival implementation has no defects.

## Audit #111

- Repository HEAD: `4ae0b199fd45855b11011fdb2fb9260e7a7525d5`
- Source: `src/models/coxph.ts` blob `2e3bc2355f92336b7433ae8c4e812c6d0441faba`.
- Related material inspected: `test/coxph.test.ts`, `oracle/coxph-behaviour.md`, `oracle/coxph.R`.
- Result: `問題未検出`; this targeted pass did not establish a new reproducible defect.
- Scope: Efron/Breslow tied-event log-likelihood, score and information contributions; integer case weights; weighted centring/scaling; stratum-specific risk sets; generalized Cholesky rank handling and aliased columns; Newton-Raphson, step halving, non-convergence and infinite-coefficient warnings; output-scale restoration and Wald/likelihood-ratio/score summaries.
- Literal fixed inputs reviewed (not executed): tied-event example `time=[1,1,2,2,3,3]`, `status=[1,1,0,1,1,0]`, `x=[[0],[1],[2],[3],[4],[5]]`; integer weights `[2,1,1,3,1,2]`; strata `["a","b","a","b","a","b"]`; collinear matrix `[[1,2,3],[2,1,3],[3,1,4],[1,3,4],[2,3,5],[3,2,5]]` where column 3 is column 1 plus column 2.
- Expected-value basis: the repository's `oracle/coxph-behaviour.md` (describing survival 3.8-3 behavior), the R-generated `oracle/coxph.R` fixture generator, analytic partial-likelihood formulas, and the existing fixture comparison test. The oracle specifies the weighted Efron steps as `d` row-level substeps with `dw/d` and `D2/d`; the implementation follows that convention.
- Tests: inspected `test/coxph.test.ts` and the fixture generator. They were not executed. No package runtime, Vitest, isolated harness, or fresh R execution.
- Limitations: extreme-magnitude weight and covariate examples were reviewed algebraically only; no numeric runtime verification was performed. Status is `問題未検出`, not `問題なし確認済`.

## Audit #112

- Repository HEAD before ledger update: `879c6876c14b28baab9c51adced6a5c44dbf7e7b`
- Source: `src/models/coxph.ts` blob `2e3bc2355f92336b7433ae8c4e812c6d0441faba`; focused on `evaluate()` weighted Efron/Breslow tied-event accumulation.
- Related material: `oracle/coxph-behaviour.md`, `oracle/coxph.R`, `test/coxph.test.ts), and the official survival `coxph` documentation (case weights and Efron ties).
- Initial concern: the Efron step count is the number of tied event rows (`deaths`), not the sum of their integer case weights. This initially looked inconsistent with replication weights.
- Resolution: `問題未検出`. The official `survival::coxph` documentation explicitly notes that with Efron ties, fitting weighted data does not give exactly the same coefficients as physically replicating each row by its case weight; the weighted fit is a distinct weighted Efron approximation. The repository oracle's weighted formula also defines `d` as the number of event rows, `dw` as their total weight, then performs `d` substeps each weighted `dw/d`. The implementation uses exactly this convention: `steps = deaths`, `stepWeight = deathWeight / steps`, and adds `deathRisk / deaths` per Efron substep.
- Literal fixed example (formula inspection only, not executed): `time=[1,1,2]`, `status=[1,1,0]`, `x=[[0],[1],[2]]), `weights=[2,1,1]`, `beta=[0]`. At the tied event time, total risk weight is 4 and tied-death risk weight is 3. The weighted Efron calculation uses two substeps, each with event weight 1.5 and risk denominator increments of 1.5, not three replication substeps. This difference is expected under the documented weighted Efron approximation.
- Tests/fixtures: inspected the R fixture generator's integer-weight Efron and Breslow cases and the test comparison code; neither the fixture test nor Vitest was executed. No package runtime or fresh R execution.
- Conclusion: no issue filed; the apparent discrepancy is a false positive resolved by the documented R semantics. This is a narrow audit of weighted tied-event evaluation, not a claim that all of `coxph()` is defect-free.


## Audit #113

- Repository HEAD before ledger update: `6222eb058ce9759e37c852a30a56582b57e18009`
- Source: `src/models/tiedTimes.ts` blob `229af071501c8dbc7bdcc0c03d503346ed227713`.
- Related source inspected: `src/models/coxph.ts` (caller), `src/models/survival.ts` (survfit/survdiff caller), `src/internal/summary.ts` (`meanDD/mean`), `oracle/survival-behaviour.md`, `oracle/survival.R`, `test/survival.test.ts`, and `test/coxph.test.ts`.
- Result: `問題未検出`. No new defect established in the inspected tie-merging logic.
- R comparison: official `survival::aeqSurv()` source uses sorted unique finite times, computes adjacent differences `dy`, marks ties by `dy <= tolerance || dy/mean(abs(y)) <= tolerance`, forms cuts from the first time and every non-tied next time, then maps each time to its interval's cut. The TypeScript implementation follows the same decision rule and minimum-cut mapping. Official documentation describes the default tolerance as `sqrt(.Machine$double.eps)` and says near-equal pairs are replaced by the smaller value. Sources: rdrr.io source and R-devel documentation (web references cited in the audit report).
- Chain/tie-boundary example (fixed values, arithmetic review only): `time=[0,1e-8,2e-8]`; `sqrt(2^-52) ≈ 1.4901161193847656e-8`. Each adjacent gap is `1e-8`, so both are tied and all three values map to `0`, even though the endpoint gap `2e-8` exceeds tolerance. This is not a TypeScript-specific transitivity bug: the R source's adjacent-gap cut construction does the same.
- Extreme-value examples (source and IEEE-754 reasoning, not executed): `time=[1e308,1.1e308]` has gap `1e307`, mean absolute time `1.05e308`, and relative gap about `0.0952`, so it is not tied. `time=[-Number.MAX_VALUE,Number.MAX_VALUE]` makes the subtraction overflow to positive Infinity; the relative gap remains Infinity and does not cause a false merge. The imported `mean()` uses double-double/power-of-two scaling, avoiding the naive sum overflow that would otherwise make the relative gap spuriously zero. Subnormal values, negative times, signed zero, and nonfinite pass-through were inspected at source level.
- Callers: `coxph()` applies merging to its non-missing observations before its stable stratum/time ordering; `survfit()` and `survdiff()` share the same helper before time grouping. The helper retains original row order in its returned array and does not mutate its readonly input.
- Tests: no `test/tiedTimes.test.ts` exists. The relevant survival and Cox fixture-comparison tests and oracle generators were inspected, not executed. No package runtime, Vitest, standalone harness, or fresh R execution.
- Limitations: exact last-bit behavior for inputs engineered precisely at the relative-tolerance boundary was not independently compared between JavaScript and R. The audit establishes source-level equivalence of the rule, not a runtime proof of all IEEE-754 boundary cases. No Issue filed.


## Audit #114

- Repository HEAD before ledger update: `701c2632c295f1d44381267bf2d304f58c5632bd`
- Source: `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`; related `src/models/tiedTimes.ts` blob `229af071501c8dbc7bdcc0c03d503346ed227713`.
- Related material inspected: `test/survival.test.ts`, `oracle/survival.R`, `oracle/survival-behaviour.md), and the R `survival::Surv()` source.
- Result: `問題未検出` for this focused pass; no new defect established in row filtering, sorting, tie-grouping, and risk-set decrement.
- Input validation: lengths are checked before row iteration; rows with NaN time/status or missing group are omitted; status values remaining in the analysis must be exactly 0 or 1. The R `Surv()` implementation converts invalid numeric status values to NA with a warning, whereas this API deliberately rejects them with RangeError (and the existing test asserts rejection for status 2). This is a documented/API-level strictness difference, not silently labelled an implementation bug. Missing rows are filtered before status validation, consistent with complete-case omission for the actual analysis.
- Infinite times: `-Infinity` and event-at-`+Infinity` are rejected; right-censored `+Infinity` is intentionally accepted as a subject remaining at risk through all finite times. This is an extension beyond the comment's stated R behavior (R's default `timefix` path rejects infinite survival times); it does not corrupt finite-time risk sets in the inspected code. At `+Infinity`, the row contributes no event and is removed only after the final time group.
- Ordering and risk sets: merged times are attached to their original rows; observations are sorted by merged time; all event and censor rows at the same merged time are counted together; risk counts are decremented only after processing the entire time block. `survfit()` filters this globally sorted list per stratum, preserving within-stratum order. `survdiff()` decrements per-group and pooled risk sets by the complete leaving count after the block. Opposite-sign extreme finite time subtraction can overflow to ±Infinity in the comparator but retains the correct sign; equal +Infinity comparisons return NaN, which stable sorting treats as equal.
- Exact literal cases reviewed (not executed):
  ```ts
  // Same-time event and censor: both are at risk at t=1.
  const time1 = [1, 1, 2, 3];
  const status1 = [1, 0, 1, 0];

  // A right-censored subject at +Infinity remains in every finite risk set.
  const time2 = [1, 2, Infinity];
  const status2 = [1, 0, 0];

  // Invalid status on a complete row is rejected; missing rows are omitted.
  const time3 = [1, 2, NaN, 4];
  const status3 = [1, 2, 1, NaN];
  const group3 = ["a", "a", "a", "a"];
  ```
- R comparison: the oracle documents events-before-censors at tied times and complete-case omission. The R source confirms that numeric status values outside 0/1 are converted to NA with a warning, unlike this API's explicit strict validation. No fresh R execution.
- Tests: inspected the survival fixture comparison harness, missing-row test, median edge test, and invalid-argument test; no test or fixture was executed. No package runtime, Vitest, standalone harness, or fresh R run.
- Limitations: no direct runtime comparison of +Infinity-censor handling against R; this is intentionally an extension and is noted as such. The audit is limited to right-censored single-event data handled by these APIs, not counting-process or multi-state Surv data. No Issue filed.


## Audit #115

- Repository HEAD before ledger update: `943ab43f447193a639a7ff8ecc9e23378309595a`.
- Source: `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`.
- Related source: `src/distributions/normal.ts` blob `9980fecf2366042da09273ba8c86de07d34dcaa3`; `src/internal/summary.ts` blob `e4fc3bd652af3a00cf05b44389ddf58e590c4830` (reviewed as a possible numerical-support dependency; no dependency defect established).
- Related material inspected: `test/survival.test.ts` blob `fb067569319a07e0c60944beab502623ab5d7be2`, `oracle/survival.R` blob `708fad768c3b0375e11cb91d47377476019148ac`, and `oracle/survival-behaviour.md` blob `20dfbfd0101928a4c9c976b1417cd827a92c58bc`. Also consulted R `survfit_confint` documentation (R-devel).
- Result: `問題未検出`; no new reproducible defect established in the inspected `survfit()` paths. This is not a full runtime certification.
- Kaplan–Meier / Greenwood: for each distinct time, all events and censors are counted while the full time block remains at risk; `S *= 1 - d/n`; Greenwood accumulates `d/[n(n-d)]` for `d<n`, and becomes `Infinity` when `d=n`. The standard error is `S*sqrt(Greenwood)`. At `d=n`, `S=0`, so `stdErr=NaN`; this agrees with the repository oracle's stated R behavior.
- Confidence intervals: `log` uses `S*exp(±z*sigma)` and returns NaN at `S=0`; `plain` uses `S ± z*S*sigma`, clips finite results to [0,1], and propagates NaN when `0*Infinity` occurs; `log-log` returns NaN at `S=0` or `S=1`, otherwise applies the log(-log(S)) transformation. These boundary behaviors agree with the repository oracle and R's documented `survfit_confint` semantics. The `confInt` validation excludes NaN, infinities, 0, and 1. The quantile calculation switches to the upper-tail form for very small alpha/2 to avoid loss of precision in `1 - alpha/2`; `qnorm` supports the upper-tail calculation.
- Median: `curveMedian()` uses the oracle's `sqrt(Number.EPSILON)` tolerance around 0.5. If the curve reaches 0.5 on a flat interval, it returns the midpoint between the time it reached 0.5 and the next event time; otherwise it returns the first crossing below 0.5. The same rule is applied independently to the lower and upper confidence curves. The existing flat-stretch test covers a censoring time within the plateau.
- Exact literal boundary cases reviewed (source/arithmetic review only; not executed):
  ```ts
  // All subjects fail at the same time: S=0, Greenwood=Infinity.
  const timeAllFail = [1, 1, 1];
  const statusAllFail = [1, 1, 1];

  // No events: S=1, Greenwood=0; log/plain intervals stay at 1,
  // while log-log limits are NaN at the boundary.
  const timeNoEvents = [1, 2, 3];
  const statusNoEvents = [0, 0, 0];

  // S reaches 0.5 at t=3, is censored at t=4, and next event is t=5.
  // Median is the midpoint (3+5)/2 = 4.
  const timeHalfPlateau = [1, 2, 3, 4, 5, 6];
  const statusHalfPlateau = [1, 1, 1, 0, 1, 1];
  ```
- Extreme-count reasoning: the risk/event counts are derived from JavaScript array lengths, so practical array-size limits are far below the integer precision limit of IEEE-754 doubles. Products such as `n*(n-d)` therefore cannot overflow for realizable JS arrays. No separate defect was found in this path.
- Tests: inspected the R-fixture comparison test, missing-row test, flat-median test, and invalid-argument test. The fixture generator covers `log`, `plain`, `log-log`, grouped and ungrouped curves, and `conf.int=0.9`; tests and fixtures were not executed.
- R relationship: the source/oracle contract was compared with official R documentation for `survfit_confint`; no fresh R execution.
- Verification limits: source and formula review only. No package runtime, Vitest, fixture execution, standalone numerical harness, or fresh R comparison. No Issue filed.


## Audit #116

- Repository HEAD before ledger update: `9fe68d7d311739d68421b3f39f5a6f360312669f`.
- Source: `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`.
- Related material: `test/survival.test.ts` blob `fb067569319a07e0c60944beab502623ab5d7be2`; `oracle/survival.R` blob `708fad768c3b0375e11cb91d47377476019148ac`; `oracle/survival-behaviour.md` blob `20dfbfd0101928a4c9c976b1417cd827a92c58bc`; `test/fixtures/survival.json` blob `2e3bb7b95bb567b12526c94cce94aec04513ba54` (R version 4.5.2).
- R implementation cross-check: fetched `cran/survival` tag `3.8-3`, `R/print.survfit.R` blob `1426b7dab3c4917c4b4adee27909dd7cff1809e5`. Its `minmin()` uses `keep = !is.na(y) & y < (0.5+tolerance)`; when the first retained value is within tolerance of 0.5 and a later value is lower, it returns the midpoint between the first retained time and the first lower value. This agrees with the intended midpoint behavior in `curveMedian()` for the monotone KM and confidence curves examined. The fixture's expected median for the p stratum is 2.5, with lower limit 1 and upper limit NA; for q it is 5, lower limit 2 and upper limit NA.
- Result: `問題未検出`; no new defect established in the targeted median/median-CI pass.
- Median rule: `curveMedian()` skips NaN values, finds the first value below `0.5 + sqrt(eps)`, returns the crossing time when it is clearly below 0.5, and uses the midpoint to the next event when it is within the tolerance band. The R source uses the same tolerance and midpoint convention, locating the first subsequent value below the first retained value. For the ordinary KM curve, this corresponds to the next event time; censors leave the curve unchanged.
- Exact fixture-derived input (values are literal; source/fixture inspection only, not executed in this audit):
  ```ts
  const time = [1, 2, 3, 4, 1, 2, 2, 5, 6, 6];
  const status = [1, 1, 1, 1, 1, 1, 0, 1, 1, 1];
  const group = ["p", "p", "p", "p", "q", "q", "q", "q", "q", "q"];
  // R 4.5.2 fixture, conf.type="log":
  // median rows: p=[2.5, 1, NA], q=[5, 2, NA].
  ```
- A caution during source comparison: an older rendered web mirror of `print.survfit.R` exposed stale/garbled conditional text. The repository's target release tag `3.8-3` was fetched directly and used instead. The earlier tentative claim that a signed comparison caused a mismatch was withdrawn; it was based on that stale rendering and is not an audit finding.
- Tests: inspected the test that checks the 0.5 flat-stretch midpoint and the fixture-comparison harness; neither was executed. No package runtime, Vitest, fixture execution, or fresh R execution.
- Limitations: source-level comparison only. The targeted pass did not exhaustively enumerate non-monotone confidence-bound sequences or every IEEE-754 value adjacent to 0.5. No Issue filed.


## Audit #117

- Repository HEAD before ledger update: `708721f9b62c55aa8fe1c75f4bcdc8a93ffeaea1`.
- Source: `src/models/survival.ts` blob `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`; focused on `survdiff()` multi-group contrasts, expected-count filtering, degrees of freedom, covariance rank, rho weights, and p-value.
- Related material: `test/survival.test.ts` blob `fb067569319a07e0c60944beab502623ab5d7be2`; `oracle/survival-behaviour.md` blob `20dfbfd0101928a4c9c976b1417cd827a92c58bc`; `src/distributions/chisq.ts` blob `f9463e9674d80dc480143cc56976763288cf6559`; `src/distributions/gamma.ts` blob `e9ba1c35ef88e77e84a392562bb7f62378fcbf7f`; `src/linalg/solve.ts` blob `6e423f1c2969b896c1715f5af95864c6f59dea24`.
- Result: `問題未検出` for this focused pass. No new defect established in multi-group df selection, rho weighting, or upper-tail p-value dispatch. The previously recorded helper-level eigenvalue-threshold concern (#28) remains separately qualified; this audit does not upgrade it to a reproducible `survdiff()` defect.
- Group/df handling: labels are sorted; groups with `expected <= 0` are omitted from the contrast; the first remaining group is the reference; the contrast matrix is the corresponding `k-1` principal submatrix. The degrees of freedom are `used.length - 1` on the regular path, and the eigen-rank returned by `pseudoQuadratic()` only on the solve-failure path. This matches the repository oracle's specified first-`k-1` contrast convention. Fewer than two groups with positive expected count yields statistic 0 and df 0; p-value is intentionally NaN.
- Covariance rank reasoning: for the earliest event time, pooled KM immediately before that event is 1, hence `w=1` for every finite `rho`. If the first event count is `d < N`, its covariance contribution has positive scalar `d(N-d)/(N(N-1))` times `diag(r)-rr'/N`, where every group later having positive expected count has a positive risk count in this first risk set. After dropping one group, this contribution is positive definite; later event-time contributions are positive semidefinite. If `d=N`, all subjects still at risk fail at that time, so there can be no later events; groups with positive expected count have `O=E` and zero variance. This supports the earlier #110 structural analysis: an exactly singular nontrivial contrast matrix is not expected from ordinary finite right-censored input. Numerical ill-conditioning remains theoretically possible; no concrete input reaching the fallback was established.
- R relationship: official `survival::survdiff` documentation describes the G-rho family with event weights `S(t-)^rho`, rho=0 log-rank and rho=1 Peto–Peto; its result includes the chi-square p-value. The repository implementation uses pooled KM before the event block, squares the weight in the covariance, and passes the selected df to the upper chi-square tail. Source: R survival 3.8-3 documentation (web citation in audit report).
- Exact deterministic inputs reviewed (formula/source inspection only; not executed):
  ```ts
  // Three groups, with event/censor ties and events at multiple times.
  const time = [1, 1, 2, 3, 4, 5];
  const status = [1, 0, 1, 1, 0, 1];
  const group = ["a", "b", "b", "c", "a", "c"];
  const rhoValues = [0, 1, -1];

  // Group c is censored before the first event and therefore has exp=0;
  // it is omitted from the tested contrasts.
  const timeZeroExpected = [0, 1, 2];
  const statusZeroExpected = [0, 1, 1];
  const groupZeroExpected = ["c", "a", "b"];
  ```
- Tests: inspected the survival fixture comparison harness and existing missing-row/invalid-argument tests. The fixture includes `survdiff` comparisons for its recorded rho values; neither tests nor fixtures were executed. No package runtime, Vitest, standalone harness, or fresh R execution.
- Limitations: source/formula review only; no generated-data search for a finite-precision covariance that triggers `solve()` failure, no runtime comparison of p-values, and no fresh R execution. No Issue filed.


## Audit #118

- Repository HEAD before ledger update: `485683a17ddfe32ba421de0f86aef69aed1fec6b`.
- Primary source: `src/distributions/gamma.ts` blob `e9ba1c35ef88e77e84a392562bb7f62378fcbf7f`.
- Related source: `src/special/loader.ts` blob `798b92185091204205e77d1e8e81e4591e7d78c3`; `src/special/igam.ts` blob `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620`; `src/internal/invert.ts` blob `54aeaa15ec93053e2dd5fd19fc640a9fbf243a76`; `src/internal/dpq.ts` blob `543eb6ceb3de7627a7562b035a931a88da424aa7`; `src/special/gamma.ts` blob `f630bdd496fc204dd24b6b04603c7b511a5cb107`.
- Tests/fixtures inspected: `test/gamma.test.ts` blob `db75474bb21ad3531f9ae071cffa359023e1af37`; `test/fixtures/dgamma.json` blob `da6fa106d4b824cb620dd14b0d2b7d930c98482a`; `test/fixtures/pgamma.json` blob `bbfde310b6ca200dcbfab9cb5fa5557c0eb123f8`; `test/fixtures/qgamma.json` blob `47d054f6330d83ab05bb9d66576f229abe8cc72f`; fixture metadata identifies R 4.5.2.
- Result: `一部監査・問題未検出`. This pass focused on parameter conversion and boundary/special-value handling in `dgamma1`, `pgamma1`, and `qgamma1`, plus the handoff to incomplete-gamma and quantile inversion routines. No reproducible defect was established. This is not a full numerical certification of gamma distribution functions.
- Parameter conversion: `gammaScale()` uses default scale 1, accepts either rate or scale, and checks the combined form via `abs(rate*scale-1)<1e-15`. Zero/subnormal rate can produce infinite scale; downstream branches explicitly handle this limit. No independent defect was demonstrated in the inspected cases.
- Density boundaries: NaN propagation, negative x, shape 0, x=0 with shape below/equal/above 1, subnormal standardized x, log-density cancellation fallback, shape Infinity, and scale Infinity were traced. The Poisson-core special cases support the observed shape-Infinity limits in the R fixture, including x=Infinity.
- CDF boundaries: q=Infinity is handled before q/scale to avoid Inf/Inf; shape 0, shape Infinity, q<=0, subnormal x/scale, lower/upper tails, and log probabilities are routed explicitly. Tiny lower-tail probabilities are assembled from `log(x)-log(scale)` in double-double arithmetic; upper-tail complements use `expm1`/ `log1p` paths in the small-x branch.
- Quantile boundaries: range/endpoints are handled by `quantileBoundaries()`; shape 0, shape Infinity, and scale Infinity have explicit branches. For subnormal quantiles, `logTinyGammaQuantile()` works in log space; otherwise `invertContinuous()` uses a safeguarded bracket and log-CDF residuals. No concrete inconsistency was established from source review.
- Exact deterministic inputs reviewed (source/fixture inspection only; not executed):
  ```ts
  // Boundary density and CDF cases
  const x = [0, -1, 1e-320, 1, Infinity, NaN];
  const shapes = [0, 0.5, 1, 2, Infinity];
  const scale = 1;

  // Tiny lower-tail quantile cases from the R 4.5.2 fixture
  const p = 9.9998886718268301e-321;
  const qShapes = [0.5, 1, 1.5, 2, 3, 10, 100, 1e6];
  const qScale = 1;

  // Scale conversion at the subnormal-rate boundary
  const rates = [5e-324, 1e-308, 1, 1e308];
  ```
- Tests: inspected fixture-driven tests at tolerance `1e-14`, including log density, all tail/logP combinations, and inverse-CDF backward checks. Inspected R 4.5.2 fixture cases for shape 0/Infinity and subnormal p. Tests and fixtures were not executed. No package runtime, Vitest, standalone harness, or fresh R execution.
- Limitations: only boundary/dispatch and numerical-stability pathways were reviewed. The full incomplete-gamma series/continued-fraction/asymptotic implementations, all quantile convergence regimes, and broad random/high-precision comparisons remain for separate audits. No Issue filed.


## Audit #119

- Repository HEAD before ledger update: `71dedbac8b2db4dc3611072f69abccd748aaaf36`.
- Primary source: `src/special/igam.ts` blob `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620`.
- Related source: `src/special/igamAsympCoeff.ts` blob `303c31a00d04790f242125345c8a1d6e984b0774`; `src/special/loader.ts` blob `798b92185091204205e77d1e8e81e4591e7d78c3`; `src/special/gamma.ts` blob `f630bdd496fc204dd24b6b04603c7b511a5cb107`; `src/internal/dpq.ts` blob `543eb6ceb3de7627a7562b035a931a88da424aa7`.
- Tests/fixtures inspected: `test/gamma.test.ts` blob `db75474bb21ad3531f9ae071cffa359023e1af37`; `test/fixtures/pgamma.json` blob `bbfde310b6ca200dcbfab9cb5fa5557c0eb123f8`; `test/fixtures/qgamma.json` blob `47d054f6330d83ab05bb9d66576f229abe8cc72f`. Fixtures identify R 4.5.2. No dedicated `test/igam.test.ts` file at the inspected path.
- Result: `一部監査・問題未検出`. No reproducible error was established in the inspected branch dispatch or formula structure. This is not a proof of full-domain accuracy.
- Lower-tail series: `igamSeriesSum` sums positive terms and stops on relative term size; for large a and x > 0.97a it switches to a double-double recurrence with a geometric remainder bound. The final prefactor is based on Loader's `dpoisRaw`, with log-domain fallback when the linear prefactor is subnormal.
- Upper-tail continued fraction: the ordinary convergent recurrence rescales all four recurrence values when the numerator exceeds `BIG`; for x > 1e20 it switches to modified Lentz ratios to avoid overflow. Initial denominator is positive in the dispatch region x>=a; zero intermediate denominators are guarded by `tiny`.
- Small-x complementary series: `igamcSeries` uses alternating terms and `expm1` for the leading cancellation, with `lgamma1p(a)` to retain precision for tiny a. Direct-tail selection computes the smaller side and uses `log1p` or `expm1` when constructing the complement.
- Temme asymptotics: reviewed the sign of eta, lower/upper correction sign, coefficient table dimensions (25×25), term truncation, and the separate `temmeTail` representation using `bd0dd` and `erfcx`. The region split is explicit: xsf-like central region, near-mean large-a region, and `a>1e299` far-asymptotic region. No sign or branch contradiction was found by formula inspection.
- Special branches: reviewed a=0, x=0, negative inputs, NaN/Infinity, a<1e-300 upper-tail scaling, and x > 1e15*max(a,1) large-x approximation. The large-x branch is taken before the continued fraction to avoid its initial product overflow.
- Exact deterministic inputs reviewed (source-level branch selection only; not executed):
  ```ts
  const cases = [
    { a: 10, x: 5 },           // lower series
    { a: 10, x: 20 },          // upper continued fraction
    { a: 100, x: 100 },        // central Temme region
    { a: 1000, x: 999.5 },     // large-a near-mean Temme region
    { a: 1e14, x: 0.99e14 },   // large-a series / long-tail convergence regime
    { a: 1e300, x: 1e300 },    // huge-a far asymptotic
    { a: 2, x: 1e21 },         // large-x asymptotic
    { a: 1e-310, x: 1 },       // tiny-shape upper-tail scaling
  ];
  const tails = [true, false]; // lower P and upper Q
  ```
- Tests: inspected fixture-driven gamma tests and R 4.5.2 pgamma/qgamma fixtures; neither executed. No Vitest, package runtime, standalone harness, mpmath/MPFR comparison, or fresh R execution.
- Limitations: no numerical evaluation of branch-boundary continuity, no high-precision grid around `SMALL`, `LARGE`, `SMALLRATIO`, `LARGERATIO`, `HUGE_A`, `A_SUB`, or `1e20`; no adversarial search for convergence-limit failures. No Issue filed.

## Audit #120

- Repository HEAD before ledger update: `c652319c2b1b4d474183ee24d85cc05afc1cc686`.
- Sources: `src/distributions/gamma.ts` blob `e9ba1c35ef88e77e84a392562bb7f62378fcbf7f`; `src/special/igami.ts` blob `008fc2b262eaa649093211a40e9d7fdd83facdcf`; `src/internal/invert.ts` blob `54aeaa15ec93053e2dd5fd19fc640a9fbf243a76`; `src/internal/dpq.ts` blob `543eb6ceb3de7627a7562b035a931a88da424aa7`.
- Related `src/special/igam.ts` was cross-read as the CDF evaluator (blob `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620`); primary deep audit of that file is #119.
- Test/fixture: `test/gamma.test.ts` blob `db75474bb21ad3531f9ae071cffa359023e1af37`; `test/fixtures/qgamma.json` blob `47d054f6330d83ab05bb9d66576f229abe8cc72f`. Fixture metadata: R 4.5.2; 3286 cases, of which 1240 use logP, 1643 upper-tail, 186 linear p > 0.999999999999, 186 p < 1e-300, and 310 logP < -700. These were inspected, not executed.
- Result: `一部監査・問題未検出`. No new reproducible defect established in qgamma's initial approximation, tail conversion, or safeguarded inversion by source review.
- `smallerTail()`: for linear p > 1/2, uses exact representable `1-p`; for logP > log(1/2), uses `-expm1(p)`; carries the linear target where available to reduce log-target rounding error.
- `findInverseGamma()`: reviewed DiDonato–Morris Eq. 21–25 for a<1 and Eq. 31–36 for a>=1, including p/q symmetry, branch boundaries b=0.1/0.15/0.35/0.45/0.6, and the a>=500 near-mean shortcut. This is only a starting approximation; all these paths feed the safeguarded inversion except the explicit subnormal quantile formula.
- `qgammaStd()`: reviewed tiny-quantile log formula, deep-tail Wilson–Hilferty seed for shape>1 and log target<=-700, DiDonato–Morris seed above that threshold, lower/upper deep-tail asymptotic seeds, and final multiplication by scale.
- `invertContinuous()`: reviewed positive-support transformation u=log(x), signed residual/bracket updates for both tails, Newton/Halley step safeguard, 200-iteration cap, best-residual return, Newton polishing in x, and adjacent-double bisection fallback for extreme concentration.
- Exact deterministic inputs considered (branch/logic review only; not executed):
  ```ts
  const cases = [
    { p: 0.5, shape: 0.5, scale: 1, lowerTail: true, logP: false },
    { p: 1e-300, shape: 2, scale: 1, lowerTail: true, logP: false },
    { p: -1000, shape: 2, scale: 1, lowerTail: true, logP: true },
    { p: -1000, shape: 2, scale: 1, lowerTail: false, logP: true },
    { p: 1 - 2 ** -52, shape: 100, scale: 1, lowerTail: true, logP: false },
    { p: 0.25, shape: 1e-310, scale: 1, lowerTail: true, logP: false },
    { p: 0.75, shape: 1e6, scale: 1, lowerTail: false, logP: false },
  ];
  ```
- `test/gamma.test.ts` uses fixture comparison tolerance 1e-14 and a backward pgamma check for qgamma. Test definitions and fixture data inspected only; no Vitest, package runtime, standalone harness, high-precision comparison, or fresh R execution.
- Limitations: no direct numerical verification at logTarget=-700, at b branch thresholds in `igami.ts`, at subnormal quantile boundary, or around inversion iteration/adjacent-double termination. A qgamma backward check against the same local pgamma implementation would not independently certify correctness. No Issue filed.


## Audit #121

- Repository HEAD before ledger update: `9a6b479fa51c0e16a8313c9c2518c75130c84004`.
- Primary source: `src/random/gamma.ts` blob `76f1bbfcf99c0ead3efff7887131e7e142511f33`. Related sources inspected: `src/random/rng.ts` blob `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `src/random/mt.ts` blob `a27a644a591ab2286227aa5db1b05b16fa149300`; `src/random/common.ts` blob `be016a36e9f09f580462d2bf93e30ed6bad527c1`; `src/random/continuous.ts` blob `5ad76e5676b4bf27c36b288f8e48ac3821bfd92a`.
- Test inspected: `test/random.test.ts` blob `f849a51e7b3c89c639641cf0a231fc9989dcff81`. It routes `rgamma` through the random fixture suite with seed/stream comparisons and continuous tolerance 1e-12; test/fixtures were not executed.
- Result: `問題あり`. Confirmed parameter-boundary mismatch in `rgamma1()`: current code returns NaN for negative shape with zero scale, and for zero shape with negative scale. R's `src/nmath/rgamma.c` checks `a <= 0 || scale <= 0`, then returns 0 when `scale == 0 || a == 0` before returning NaN for other invalid combinations. Reproductions: `rgamma(1, -1, { scale: 0 })` and `rgamma(1, 0, { scale: -1 })`; expected R output `[0]`, current branch yields `[NaN]`.
- Issue filed: [#29](https://github.com/numero-uno-jpn/rStats.js/issues/29).
- Algorithm review: GS (shape<1) and GD (shape>=1) formula/constants, squeeze and quotient acceptances, double-exponential rejection, normal/exponential/uniform dependencies, MT open-interval fixups, scale multiplication, and finite/infinite parameter early returns were compared with R's `rgamma.c`. No additional reproducible algorithm defect established by source comparison. This is not a distributional/statistical validation.
- Exact deterministic reproduction inputs are listed above; no RNG seed is needed because this defect is in the deterministic parameter-validation branch and consumes no random values.
- No Vitest, package runtime, statistical simulation, or fresh R execution was performed. R expectations were confirmed by direct comparison with the R source implementation; no fixture values were executed.


## Audit #122

- Repository HEAD before ledger update: `10357380b3019e5ea6089224e3a0d4152702e639`.
- Primary source: `src/random/beta.ts` blob `5371b478626066c291432ec2df4529953520f520`. Related sources: `src/random/gamma.ts` blob `76f1bbfcf99c0ead3efff7887131e7e142511f33`; `src/random/rng.ts` blob `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `src/random/common.ts` blob `be016a36e9f09f580462d2bf93e30ed6bad527c1`.
- Test/fixture inspected: `test/random.test.ts` blob `f849a51e7b3c89c639641cf0a231fc9989dcff81`; `test/helpers/random.ts` blob `d9c9fae276354b0ed1c63a0ea6c588efe99ca8e9`; `test/fixtures/rbeta.json` blob `866acacf6513f6a0406424961fd5176c73ad1e5d`. Fixture: R 4.5.2, x86_64 Linux, 47 cases; central shape grid 0.1, 0.5, 1, 2, 5, 50; special shapes 0/Inf/negative; one ncp=1.5 case; three 20,000-draw summary cases. Inspected, not executed.
- Result: `問題あり`. The BB algorithm's large-product shortcut tests only whether `2*a*b` overflows, not whether both shape parameters are large. For `a=1.1,b=1e308`, the branch consumes two uniforms and returns the mean for every variate. Exact deterministic reproduction: `setSeed(12); rbeta(5, 1.1, 1e308)`; source-level result is five copies of approximately `1.1e-308` (seed does not affect values in this branch, only stream state).
- Mathematical check: Beta(a,b) coefficient of variation is `sqrt(b / (a*(a+b+1)))`; at a=1.1,b=1e308 it tends to `1/sqrt(1.1) ≈ 0.953462589`. Thus the distribution is not concentrated at its mean and the constant shortcut is invalid. For large b and moderate a, `b*X` tends to Gamma(a,1), suggesting a scale-aware alternative. R's central `rbeta.c` uses Cheng BB/BC too; this audit evaluates mathematical distribution fidelity, not exact R parity in this extreme region.
- R source cross-check: Fossies R 4.6.1 `src/nmath/rbeta.c` confirms the Cheng BB/BC structure and the same overflow-sensitive BB expression; see web citation in report. The local implementation adds its own mean shortcut for overflow. The R source is not treated as an independent correctness oracle for this extreme case.
- Additional review: BC and BB rejection inequalities, constants, symmetry, parameter cache, endpoint/special-value handling, and noncentral-beta construction via noncentral chi-square/gamma mixtures were source-reviewed. No second concrete defect established. R's `ncp=0` path remains separate from omitted ncp as expected by the random generator design.
- Issue filed: [#30](https://github.com/numero-uno-jpn/rStats.js/issues/30).
- No Vitest, package runtime, statistical simulation, or fresh R execution. The result is a deterministic source-level finding plus analytic distributional proof; fixture cases were only inspected.


## Audit #123

- Repository HEAD before ledger update: `cf352aaf46ae22782a09d7c054fd3716a370d7a6`.
- Primary source: `src/random/poisson.ts` blob `9f6f9657e84c2110bb08640b1f846c345bd2ff2f`. Related source: `src/random/rng.ts` blob `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `src/random/common.ts` blob `be016a36e9f09f580462d2bf93e30ed6bad527c1`.
- R reference: `src/nmath/rpois.c`, Ahrens–Dieter (1982) algorithm PD; source reviewed via official/CRAN R source reference. Small-mean inversion table and large-mean normal rejection method match the TypeScript structure. Compared constants A0–A7, thresholds (10, 0.458, 35, -0.6744, 1.8, 1.1484), immediate/squeeze/quotient/hat acceptance, factorial branch, and parameter-cache update rules.
- Test/fixture inspected: `test/random.test.ts` blob `f849a51e7b3c89c639641cf0a231fc9989dcff81`; `test/helpers/random.ts` blob `d9c9fae276354b0ed1c63a0ea6c588efe99ca8e9`; `test/fixtures/rpois.json` blob `5a6e749d4a299ce6259f8cfd9d8a44d92c4be666`. Fixture metadata R 4.5.2, x86_64 Linux, 32 cases: λ=0, 0.1, 1, 5, 9.99, 10, 15, 50, 100, 1e4, 1e7, Inf, -1, NaN; includes 20,000-draw summaries at λ=3,12,40,1000 and verifies next RNG draw. Inspected, not executed.
- Result: `一部監査・問題未検出`. No reproducible defect established in the reviewed Ahrens–Dieter implementation. Boundary validation rejects nonfinite/negative λ without consuming RNG; λ=0 returns 0 without consuming RNG, matching fixture expectations. Small-mean cumulative table resets when λ changes; large-mean constants recalculate when λ changes; transitions and cached-parameter logic were source-reviewed.
- Exact fixed inputs reviewed (not executed): `setSeed(30); sampleInt(5, { size: 20, replace: true, prob: [0.1, 0.2, 0.3, 0.2, 0.2] })`; `setSeed(30); sampleInt(5, { size: 5, replace: false, prob: [0.1, 0.2, 0.3, 0.2, 0.2] })`; `setSeed(31); sampleInt(5, { size: 3, replace: false, prob: [3, 0, 1, 1, 5] })`; `setSeed(33); sampleInt(250, { size: 30, replace: true, prob: Array(250).fill(1) })`. The last literal specifies all 250 weights without elision.
- Fixture inspected: `test/fixtures/rhyper.json` blob `39ca835db17abaf839fa97848fa7fbf4eeead82c`, R 4.5.2, 19 cases. Includes support boundaries, half-integer parameter rounding, populations larger than INT_MAX, and larger simulation summaries. Fixture values and post-draw RNG states inspected, not executed.
- Current R docs describe rhyper as corrected Kachitvichyanukul–Schmeiser HIN/H2PE. R-devel July 2026 discussion records a 32-bit overflow defect when m+n exceeds INT_MAX and its fix (svn rev 90223). This TypeScript implementation uses JS numbers for N when both parameters are below INT_MAX, and routes larger individual parameters to qhyper1, so the specific signed-int overflow is not reproduced by the reviewed path.
- Result: `一部監査・問題未検出`. No new Issue filed. No Vitest, package runtime, Monte Carlo simulation, or fresh R execution.


## Audit #127

- Repository HEAD before ledger update: `cd3524756e9b5a883af0e9358e23272a8fee2cc3`.
- Target: `src/random/r2dtable.ts`, blob `8ccc84fc49823aa54db9eb23da7d7b3df00033f0`.
- Algorithm review: Patefield AS 159 conditional hypergeometric cells, mode calculation, upward/downward probability ratios, cumulative-probability restart when rounding leaves a residual, last column/last row margin completion, zero remaining subtable branch, column-major internal storage and row-array public output.
- Validation review: truncation of n and margins as R integer coercion; finite/range checks; at least two rows/columns; nonnegative margins; equal grand totals; maximum total guard; zero-total tables; n=0 behavior.
- Exact fixed inputs reviewed (not executed): `setSeed(1); r2dtable(1, [3, 2], [2, 3])`; `setSeed(42); r2dtable(5, [0, 6, 4], [5, 0, 5])`; `setSeed(2024); r2dtable(5, [12, 5, 7, 7], [9, 11, 11])`; `setSeed(1); r2dtable(1, [0, 0], [0, 0])`; coercion check `r2dtable(1, [3.9, 2.1], [2.9, 3.1])`.
- Fixture inspected: `test/fixtures/r2dtable.json` blob `c12c8b89aebf9ef0c3839070980dfbb6e49ce22e`, R 4.5.2 x86_64, 73 cases. Includes 2x2 through 8x4 tables, zero margins, zero grand total, totals up to 300,000, multiple seeds, and n=200; fixed output and next-uniform states inspected, not executed. Test registration in `test/random.test.ts` inspected, not executed.
- No independent algorithmic defect established. Resource note: the allowed maximum grand total of 2,147,483,647 would require a Float64Array with over 2 billion entries (roughly 16 GiB before other allocations); practical allocation may fail well below this guard, but it is a resource ceiling rather than a demonstrated statistical result error.
- Result: `一部監査・問題未検出`. No new Issue. No Vitest, package runtime, Monte Carlo simulation, or fresh R execution.


## Audit #128

- Repository HEAD before ledger update: `6faa7e1c6e67c99e454a7abf48e7f1dc2dc01446`.
- Target: `src/random/sample.ts`, blob `b2a2a714b624fdd7f8e422e7a5210000a759d710`.
- Dependencies inspected: `src/random/rng.ts` blob `f527fd7018642205ef5870df8fcab8fc9e02aff1` (including `unifIndex`, sample-kind selection), `src/internal/extremes.ts` blob `00fbd46179043e90fc6678a777fbd9b5540dd7c6`.
- Algorithm review: uniform sampling with and without replacement; large-n duplicate rejection; partial Fisher-Yates; weighted sampling with replacement via cumulative probabilities and Walker alias above 200 substantial weights; weighted sampling without replacement by cumulative mass; descending heapsort and permutation; probability normalization and overflow rescaling; Rounding vs Rejection sample.kind stream use; sample(array) mapping and 0-based sampleInt output.
- Validation review: n/size truncation and bounds, empty population, size > population, prob length/finite/nonnegative/positive weights, insufficient positive weights without replacement, n limit with weights, large n constraints, zero size, n=1, and arrays with zero weights.
- Exact fixed inputs reviewed (not executed): `setSeed(30); sampleInt(5, { size: 20, replace: true, prob: [0.1, 0.2, 0.3, 0.2, 0.2] })`; `setSeed(30); sampleInt(5, { size: 5, replace: false, prob: [0.1, 0.2, 0.3, 0.2, 0.2] })`; `setSeed(31); sampleInt(5, { size: 3, replace: false, prob: [3, 0, 1, 1, 5] })`; `setSeed(32); sampleInt(300, { size: 50, replace: true, prob: [0.8966972001362592, 0.26550866314209998, 0.37212389963679016, 0.57285336335189641, 0.90820778999477625, 0.2016819310374558, 0.898389684684?] })` (the full 300-element weight vector is preserved in `test/fixtures/rsample.json` and was not copied here; the first three fixed vectors above are complete reproducible inputs).
- Fixture inspected: `test/fixtures/rsample.json` blob `5dd1a59eaf2f04f054f483f76b9902b15a896521`, R 4.5.2 x86_64, 25 cases. Includes uniform permutations, large n, replacement, weighted replacement, weighted no-replacement, 300-candidate alias sampling, and 300-candidate weighted no-replacement. Fixture values and next-uniform states inspected, not executed. Test registration in `test/random-kinds.test.ts` inspected, not executed.
- No independent reproducible defect established. Extreme dynamic-range weights can normalize to zero in binary64 (e.g. `[1e308, 1e-300, 1e-300]`), an inherent precision limitation; no evidence of a separate algorithmic defect was established in this pass.
- Result: `一部監査・問題未検出`. No new Issue. No Vitest, package runtime, Monte Carlo simulation, or fresh R execution.


## Audit #129

- Repository HEAD before ledger update: `6f8c6930b3c84d99f07d6fe7c0bc0622569ae526`.
- Target: `src/random/rank.ts`, blob `4cfe69d81a9a6509c9dbac95b3000a2adfb57433`.
- Dependencies: `src/random/rng.ts` blob `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `src/random/common.ts` blob `be016a36e9f09f580462d2bf93e30ed6bad527c1`; `src/internal/integer.ts` used by half-even rounding.
- Algorithm review: `rsignrank` forms the statistic as independent Bernoulli(1/2) choices of ranks 1..n; `rwilcox` uses partial Fisher–Yates to choose n ranks from 0..m+n-1, then subtracts n(n-1)/2. This matches R's `rwilcox` C implementation and its uniform-index sampling pattern. `rsignrank` matches the R definition `i * floor(unif_rand()+0.5)`.
- Validation review: nonfinite/NaN inputs, half-even rounding, negative and zero sample sizes, m+n integer allocation ceiling, zero-sized sample, and generated count validation through `generate`. No independent reproducible defect established in the supported/ordinary parameter range.
- Exact reproducible fixture inputs inspected (not executed): `setSeed(27); rsignrank(10, 5)` expected `[4,0,15,7,10,2,0,7,9,6]`; `setSeed(28); rwilcox(10, 3, 4)` expected `[9,6,5,5,5,3,10,4,2,7]`; `setSeed(28); rwilcox(10, 0, 5)` expected ten zeros. Fixture `test/fixtures/rrank.json`, blob `31fe6958bf457cfad61ee626440e0afc00f06dc4`, identifies R 4.5.2 x86_64 and contains 10 cases; values and post-draw uniform states inspected, not executed.
- Related exact rank distribution fixtures and tests were inspected for context (`test/rank.test.ts`), but the target here is random generation, not `dsignrank`/`dwilcox`.
- Result: `一部監査・問題未検出`. No new Issue filed. No Vitest, package runtime, Monte Carlo simulation, or fresh R execution.


## Audit #130

- Repository HEAD before ledger update: `75095a2c450c18de77f8ceacc259b90bd246a288`.
- Target: `src/random/extra.ts`, blob `2e5d69e49dab41d9ae05164075051c7beb8e0dd5`.
- Dependencies inspected: `src/random/gamma.ts` (`rgamma1`), `src/random/rng.ts` (`unifRand`, `expRand`), `src/internal/extremes.ts` (`midpoint`), and the quantile functions for Kumaraswamy, Pareto, and arcsine distributions.
- Algorithm review: inverse-gamma via reciprocal of Gamma(shape=alpha, scale=1/beta); Kumaraswamy/Pareto via inverse CDF at 1-U; triangular via independent minimum/maximum of two uniforms and mode-weighted interpolation; Laplace via exponential magnitude plus independent sign; arcsine via inverse CDF at U. Checked stream consumption (2 uniforms for rtriang; expRand plus sign uniform for rlaplace; invalid parameters consume none), support constraints, default arguments, finite endpoints, and wide finite triangular intervals where b-a overflows.
- Exact fixture inputs inspected (not executed): `setSeed(1); rinvgamma(10, 3, { beta: 2 })`; `setSeed(1); rkumar(10, 2, 3)`; `setSeed(1); rpareto(10, { a: 2, b: 1.5 })`; `setSeed(1); rtriang(10, { a: 0, b: 3, c: 1 })`; `setSeed(1); rlaplace(10, { mu: 1, sigma: 2 })`; invalid no-draw case `setSeed(7); rpareto(3, { a: 0, b: 1 })`.
- Fixture: `test/fixtures/rextradist.json`, blob `1b830949954493506f09f7b1d267d189a5d1aaaf`, R 4.5.2 x86_64, 20 cases. Includes seeds 1, 42, 20261024, boundary/invalid cases and post-draw RNG states; inspected, not executed.
- Result: `一部監査・問題未検出`. No reproducible algorithmic defect established. No Issue filed. No Vitest, package runtime, distributional simulation, or fresh R execution.



## Audit #131

- Repository HEAD before ledger update: `b6d645d063aee7a2793eaec9e8e78fad80d2acd9`.
- Target: `src/random/streams.ts`, blob `63359251f6081a7658ebf27e105e6a0ed7c789cb`; dependency `src/random/lecuyer.ts` blob `7bd112bb422a4e4b8dd2bbcf3badaa4da4efe4c3`.
- Algorithm review: 2^76 substream and 2^127 stream transition matrices for both MRG32k3a components; 3×3 row-major matrix application; modular multiplication by splitting the second operand into 16-bit halves; preservation of R kind code and signed 32-bit state representation; rejection of non-L'Ecuyer codes and invalid state vectors.
- Exact test inputs inspected (not executed): `RNGkind({ kind: "L'Ecuyer-CMRG" }); setSeed(1); nextRNGStream(getRandomSeed())`; corresponding `nextRNGSubStream`; repeated jump sequence `stream → stream → stream`; mixed sequence `stream → substream → stream`. Fixture `test/fixtures/rngStreams.json`, blob `1355f6e7efe30f8e1d01b6ba1843ff75b6c502ec`, R 4.5.2 x86_64, includes resulting seven-word states, first five uniforms and next uniform.
- The existing `test/random-kinds.test.ts` independently reconstructs each transition matrix by BigInt repeated squaring from the published MRG32k3a recurrence and compares the jump outputs. Test source was inspected but not executed. Arithmetic bound check: each split product and intermediate modular sum remains below 2^53, so integer arithmetic is exactly representable in binary64.
- Result: `一部監査・問題未検出`. No matrix/layout defect established by source review. No Issue filed. No Vitest, standalone harness, or fresh R execution.



## Audit #132

- Repository HEAD before ledger update: `ff8994e573a5d1731aaf1e26d633ee907cc1bdcf`.
- Target: `src/random/lecuyer.ts`, blob `7bd112bb422a4e4b8dd2bbcf3badaa4da4efe4c3`.
- Algorithm review: MRG32k3a moduli M1=4294967087 and M2=4294944443; 50-step LCG seed scrambling and rejection of seed words >=M2; component recurrences and state shift order; combined output (p1-p2 mod M1)/(M1+1); exact integer arithmetic bounds (<2^53); import/export of six state words with R's signed Int32 representation; all-zero first component and out-of-range state rejection.
- Exact inputs inspected (not executed): `RNGkind({ kind: "L'Ecuyer-CMRG" }); setSeed(1); runif(10)`; same with seeds `42`, `2024`, `2147483647`, and `-2147483647`; restoration with `setRandomSeed([10407, 1, 2, 3, 4, 5, 6]); runif(5)`. The `test/fixtures/rngLecuyer.json` fixture identifies R 4.5.2 x86_64 and records uniforms, resulting states and next-uniform values. The fixture was inspected, not executed.
- Result: `一部監査・問題未検出`. No recurrence, modulus, seed-expansion, or state-layout defect established by source review. The implementation deliberately throws for invalid states where R may reseed from the clock; this is a documented API behavior difference, not treated as a random-number algorithm defect. No Issue filed. No Vitest, standalone harness, or fresh R execution.



## Audit #133 — `src/random/mt.ts`

- Repository HEAD: `77d0da9eaa12609d445d0433e4d3ac0d84f50600`; source blob `a27a644a591ab2286227aa5db1b05b16fa149300`.
- Reviewed MT19937 state length 624, twist loop split at N-M=227, wraparound dependency, tempering shifts/masks, R's 50-step 69069 LCG seed expansion, unsigned 32-bit wrap, uniform endpoint fixup, and .Random.seed import/export.
- Exact fixture inputs inspected (not executed): `setSeed(1); runif(10)`, `setSeed(42); runif(10)`, `setSeed(-7); runif(10)`, `setSeed(123456789); runif(10)`. R 4.5.2 fixture `test/fixtures/rbasic.json` blob `fafabb128e79ef73b5c5c923a8b223f84ebe490e`; associated expected sequences and next-uniform values inspected.
- Result: `一部監査・問題未検出`. No MT recurrence or state conversion defect established. Vitest and independent execution not run.

## Audit #134 — `src/random/continuous.ts`

- Repository HEAD: `77d0da9eaa12609d445d0433e4d3ac0d84f50600`; source blob `5ad76e5676b4bf27c36b288f8e48ac3821bfd92a`.
- Reviewed `runif`, `rnorm1/rnorm`, `rexp`, `rlnorm`, `rlogis`, `rcauchy`, `rweibull`: parameter guards, transform formulas, scale/rate zero and infinity, nonfinite location/mean, overflow-width interpolation, and RNG stream consumption.
- Exact inputs inspected (not executed): `setSeed(1); runif(5,{min:0,max:1})`; `setSeed(1); runif(5,{min:-3,max:5})`; `setSeed(2); rnorm(5,{mean:5,sd:Infinity})`; `setSeed(3); rexp(5,{rate:Infinity})`; `setSeed(24); rlogis(10,{location:0,scale:-1})`; `setSeed(26); rweibull(10,0,{scale:1})`. R 4.5.2 fixtures `rbasic.json` and `rother.json` inspected.
- Known discrepancy confirmed by fixture: for `rlogis` with negative scale, the implementation returns NaN after consuming a uniform, whereas R returns the finite values with their signs reversed. The test suite explicitly classifies this as a known difference. Not filed as a new issue in this pass because it is already recorded in test behavior; it remains a compatibility gap.
- Result: `既知差異あり・追加問題未検出`. No Vitest or fresh R execution.

## Audit #135 — `src/random/as241.ts`

- Repository HEAD: `77d0da9eaa12609d445d0433e4d3ac0d84f50600`; source blob `3e7d42b5c0d867cc1bfe06f2f335d83994dbd7c3`.
- Reviewed Wichura AS 241 coefficient arrays A-F, Horner polynomial evaluation order, central region `|p-0.5| <= 0.425`, tail transformation `sqrt(-log(min(p,1-p)))`, branch boundary r=5, and sign restoration. Compared domain with `normRand` construction, whose p stays away from 0 and 1.
- Result: `一部監査・問題未検出`. No coefficient/order/branch defect established by source review. No independent high-precision computation or Vitest execution.

## Audit #136 — `src/random/common.ts`

- Repository HEAD: `77d0da9eaa12609d445d0433e4d3ac0d84f50600`; source blob `be016a36e9f09f580462d2bf93e30ed6bad527c1`.
- Reviewed `generate` finite/nonnegative n validation, truncation, zero-length behavior and lazy callback invocation; reviewed `powInt` for NaN, infinities, zero/negative exponents and exponentiation by squaring.
- Potential concern: `powInt` uses signed 32-bit bitwise operators (`n & 1`, `n >>= 1`), so exponents at or above 2^31 are not handled safely and can fail to terminate. However, repository call sites and reachable exponent bounds were not exhaustively resolved in this pass; therefore this is recorded as a review lead, not a confirmed defect. Exact probe input for a future isolated harness: `powInt(0.5, 2147483648)` (do not execute synchronously; current loop may not terminate).
- Result: `一部監査・問題未検出（powIntの巨大指数は要追跡）`. No Vitest or isolated execution.

## Audit #137 — `src/random/rng.ts`

- Repository HEAD: `77d0da9eaa12609d445d0433e4d3ac0d84f50600`; source blob `f527fd7018642205ef5870df8fcab8fc9e02aff1`.
- Reviewed global generator selection, seed initialization, kind code mapping, RNGkind's previous-kind return and seed handoff, state import/export, Rejection/Rounding index generation, 16-bit chunked rbits, two-uniform normal inversion input, and Ahrens-Dieter exponential algorithm SA.
- Exact fixture inputs inspected (not executed): `setSeed(1); runif(10)`; `RNGkind({kind:"L'Ecuyer-CMRG",sampleKind:"Rounding"}); setSeed(42); runif(3)`; `setSeed(3); sampleInt(4500000000000000,{size:5,replace:true})`; `setSeed(24); rlogis(10,{location:0,scale:-1})`. Fixtures `rngRounding.json`, `rngLecuyer.json`, `rngStreams.json`, `rbasic.json`, and existing `random-kinds.test.ts` inspected, not executed.
- Known compatibility differences: negative-scale `rlogis` output differs from R; BTPE `rbinom` can consume a different stream due to the already-documented Stirling-correction difference; invalid L'Ecuyer state handling throws rather than R's clock reseed. No additional defect established.
- Result: `既知差異あり・追加問題未検出`. No Vitest, standalone harness, or fresh R execution.

## Audit #138 — `src/distributions/f.ts`

- Repository HEAD: `f6d0a8e51cbd301536a2e29a3d6b110a814c6e26`; source blob `094283354cd63404a50217cab344a676004f66d5`.
- Reviewed central F density/CDF/quantile, finite/infinite degrees-of-freedom limits, double-double ratio formation, tiny-tail beta transforms, small-shape log-density, quantile asymptotics, and Newton derivative.
- Confirmed defect: for `m < 2`, the density coefficient computes `2 * (m + n) * p` in an order that overflows even though the mathematical product is finite. Exact reproduction: `df(1, 1, 1e308)`. Here `2 * (m+n)` becomes `Infinity`, so the coefficient becomes zero. As df2 tends to infinity, F(1,df2) converges to chi-square(1), whose density at 1 is `exp(-0.5)/sqrt(2*pi) ≈ 0.24197072451914337`. Issue #32 created.
- Result: `問題あり`. Source-level arithmetic proof; no package runtime, Vitest, or fresh R execution.

## Audit #139 — `src/distributions/hypergeometric.ts`

- Repository HEAD: `f6d0a8e51cbd301536a2e29a3d6b110a814c6e26`; source blob `557f15ed94b73d98cc3606838441c05fcf94dca3`.
- Reviewed parameter validation and half-even rounding, support endpoints, binomial-limit approximation, Loader probability decomposition, double-double exponent assembly, direct lower/upper tail summation via adjacent-probability ratios, stopping bound, and discrete quantile bracketing.
- Exact source probes considered: `dhyper(0,0,5,3)`, `phyper(-1,10,10,5)`, `qhyper(0.5,10,10,5)`, plus values near the mean and support endpoints. Existing `test/hyper.test.ts` and R 4.5.2 fixtures `dhyper.json`, `phyper.json`, `qhyper.json` inspected, not executed.
- Review lead: `hyperParams` forms `m+n` directly and `dhyper1` lacks the `MAX_EXACT` guard present in `phyper1/qhyper1`. Extremely large finite population counts therefore deserve a dedicated executable probe; no output defect was established in this source-only pass.
- Result: `一部監査・問題未検出`. No Vitest, package runtime, or R execution.

## Audit #140 — `src/distributions/invgamma.ts`

- Repository HEAD: `f6d0a8e51cbd301536a2e29a3d6b110a814c6e26`; source blob `942dc8bfc3a11295a8f7ac3f8df2decf757dac28`.
- Reviewed inverse-gamma/gamma reciprocal transform, double-double z=beta/x and first-order correction, subnormal-z log-density path, lower/upper CDF correction signs, log-probability correction, tiny gamma quantile inversion, and alpha/beta boundary validation.
- Exact source probes considered: `dinvgamma(1e-300,2,{beta:1e-300})`, `pinvgamma(1e-300,2,{beta:1e-300,lowerTail:false,logP:true})`, `qinvgamma(1e-300,2,{beta:1e-300})`, and `pinvgamma(0,Infinity,{beta:1})`. The last input raises a contract question: alpha=Infinity is described as a point-mass limit at zero, while the q<=0 check returns the generic lower-tail zero boundary before the alpha=Infinity branch. This was not classified as a defect without confirming the intended R/extraDistr infinite-shape contract.
- Existing R/extraDistr and mpmath fixtures inspected, not executed.
- Result: `一部監査・問題未検出（alpha=Inf境界は仕様確認待ち）`. No Vitest, package runtime, or fresh R execution.

## Audit #141 — `src/distributions/kumaraswamy.ts`

- Repository HEAD: `f6d0a8e51cbd301536a2e29a3d6b110a814c6e26`; source blob `ae73aa5f4ac85b344ea32f626854693a50409563`.
- Reviewed density endpoint behavior, a=Infinity limit, b validation, expm1/log1p evaluation of 1-x^a, subnormal powers, double-double log-density summation, lower-tail small-probability expansion, log-tail handling, inverse quantile branches, and reciprocal correction.
- Exact probes considered: `dkumar(1-Number.EPSILON,2.6e-300,0.29)`, `pkumar(0.2,0.42,1.85e-317,{logP:true})`, and `qkumar(4.8e-52,9.9e-314,2.5)`. These correspond to difficult near-one, subnormal-shape, and reciprocal-overflow paths documented in source comments. Existing extraDistr/mpmath fixtures inspected, not executed.
- Result: `一部監査・問題未検出`. No Vitest, package runtime, or R execution.

## Audit #142 — `src/distributions/laplace.ts`

- Repository HEAD: `f6d0a8e51cbd301536a2e29a3d6b110a814c6e26`; source blob `782524ad81cfd416c0582e8f6b6b31170d3db88f`.
- Reviewed location/scale validation, infinite-location limit, double-double standardization, density denominator overflow when 2*sigma exceeds the largest double, subnormal exponential division, CDF smaller-side selection and log1p complement, and quantile tail conversion/locationScale.
- Exact probes considered: `dlaplace(Number.MAX_VALUE,{mu:-Number.MAX_VALUE,sigma:1,log:true})`, `plaplace(Infinity,{mu:0,sigma:1})`, `qlaplace(1e-320,{mu:1,sigma:2})`, and `dlaplace(0,{mu:0,sigma:1e308})`. Existing extraDistr/mpmath fixtures inspected, not executed.
- Result: `一部監査・問題未検出`. No Vitest, package runtime, or R execution.

## Audit #143 — `src/distributions/logistic.ts`

- Repository HEAD: `557cdff4132642faad75bcd95ddbbfeca8a90eec`; source blob `76cd8b85c520932b5980baa16cc3d4ce483eb872`.
- Reviewed `dlogis1` scale validation, double-double standardization, subnormal exponential/scale division, `plogis1` tail-side selection and log probabilities, and `qlogis1` endpoint handling, logit stability, zero/negative/infinite scale.
- Exact probes considered: `dlogis(-745,{scale:1})`, `dlogis(-3.5667e-316,{scale:4.81926e-319})`, `plogis(1e300,{location:-1e300,scale:1e300,lowerTail:false,logP:true})`, and `qlogis(1e-320,{scale:1e-300})`. R 4.5.2 d/p/qlogis fixtures inspected, not executed.
- Result: `一部監査・問題未検出`. No Vitest, package runtime, or fresh R execution.

## Audit #144 — `src/distributions/lognormal.ts`

- Repository HEAD: `557cdff4132642faad75bcd95ddbbfeca8a90eec`; source blob `2d955d68f6d973a4108450c6b1ae7fa3eb1fc204`.
- Reviewed `zOf` scaling, double-double half-square, `pnormDD` tail selection, quantile Newton refinement, density endpoint/degenerate/nonfinite branches, whole-exponent subnormal density, and huge-sdlog quantile path.
- Exact probes considered: `dlnorm(1e-100,{meanlog:-100,sdlog:3})`, `dlnorm(2e-105,{meanlog:1.53,sdlog:6.36})`, `plnorm(1e-300,{meanlog:0,sdlog:1,logP:true})`, and `qlnorm(1e-30,{meanlog:0,sdlog:9e307})`. R 4.5.2 d/p/q lnorm fixtures and mpmath summary fixture inspected, not executed. The source explicitly preserves one R-compatible density underflow behavior that differs from the mathematical exact value; it was not newly classified as a bug.
- Result: `一部監査・問題未検出`. No Vitest, package runtime, or fresh R execution.

## Audit #145 — `src/distributions/nbeta.ts`

- Repository HEAD: `557cdff4132642faad75bcd95ddbbfeca8a90eec`; source blob `5c51760f6e136b80a77b4284da39c25b0ab8ed86`.
- Reviewed Poisson-mixture beta kernel, adjacent-term ratio and shape-rounding correction, left-tail series, extreme-parameter method selection (`chisq`/`gamma`/`w`/`integral`), log-domain integration and endpoint remainder, density endpoint limits, quantile endpoint/narrow-spread logic, and noncentral-F transform, tiny-q approximation, Chernoff bound and df2→∞ limit.
- Exact probes considered: `pbeta(1e-7,3,5,{ncp:2e7,logP:true})`, `dbeta(1.4930968104424972e-218,4.994551015409567e-269,1.00296357719376e-118,{ncp:4.248780725227059})`, `qbeta(1.2066869150839893e-270,0.031616179278943515,0.2793791077635366,{ncp:0.6460099483845458,lowerTail:false})`, and `pf(2.5e300,1828,0.165,{ncp:3.7e307})`. Existing `test/nbeta.test.ts` and R/mpmath fixtures inspected, not executed.
- Result: `一部監査・問題未検出`. No Vitest, package runtime, or fresh R execution.

## Audit #146 — `src/distributions/nchisq.ts`

- Repository HEAD: `557cdff4132642faad75bcd95ddbbfeca8a90eec`; source blob `9549791940c425d508057b7286329b396ca36c6f`.
- Reviewed Poisson-gamma mixture, subnormal x/2 correction, Chernoff far-tail bound, Bessel Hankel/Debye asymptotics, Bessel series, log-domain tail integration, df=0 atom boundary, and quantile Patnaik start/narrow-spread/double-search behavior.
- Exact probes considered: `dchisq(0,0,{ncp:1})`, `pchisq(0,0,{ncp:1,lowerTail:true,logP:true})`, `dchisq(2.0001e9,1e6,{ncp:2e9,log:true})`, and `qchisq(5.7285590455359545e-12,5.345349749112763,{ncp:1})`. Existing `test/nchisq.test.ts`, R 4.5.2 fixtures and mpmath fixture inspected, not executed. The df=0, x=0 density is Infinity in the R fixture too, so it was not misreported as a defect despite the point-mass component.
- Result: `一部監査・問題未検出`. No Vitest, package runtime, or fresh R execution.

## Audit #147 — `src/distributions/negbinomial.ts`

- Repository HEAD: `557cdff4132642faad75bcd95ddbbfeca8a90eec`; source blob `6bf9bf9b9d8b05aa4828e33c4b2fb9b3ed5171c7`.
- Reviewed exclusive `prob`/`mu` parameterization, overflow-safe double-double `fromMu`, Loader density, subnormal size correction, x>2^53 CDF correction, `upperSeries`, Cornish-Fisher/gamma starting values, Newton/secant refinement, discrete quantile search, and size/mu=0/Infinity boundaries.
- Exact probes considered: `dnbinom(58,3.94e-315,{prob:0.125,log:true})`, `pnbinom(1e16,1e16,{prob:0.5})`, `qnbinom(2.2e-284,2.7e37,{prob:1.9e-279})`, and `dnbinom(3,5,{mu:4})`. R 4.5.2 fixtures, mpmath fixtures and existing tests inspected, not executed.
- Result: `一部監査・問題未検出`. No Vitest, package runtime, or fresh R execution.


## Audit #148 — `src/distributions/normal.ts`

- Repository HEAD: `3d9623ccac1dc46974fd7f01cbcbb44e931cfcb6`; source blob `9980fecf2366042da09273ba8c86de07d34dcaa3`.
- Reviewed `scaledExpNegHalfSq`, `lowerTailProb`, `pnormStd`, `pnorm1`, `qnorm1`, `ndtriLogRefined`, `dnorm1`, and the tiny-sd density path. Checked NaN/±Inf, sd=0/negative, standardization overflow, lower/upper tail and logP behavior, and subnormal sd.
- Confirmed defect: `pnorm(-1.5e154,{logP:true})`. In `pnormStd`, `(a*a)/2` overflows to Infinity although the mathematical `a²/2=1.125e308` is finite. The finite log probability is approximately `-1.125e308 - log(1.5e154) - log(sqrt(2π))`. Note: `dnorm1` uses left-associative `0.5*z*z`, which does not share this intermediate-overflow defect at the same input; it is not included in the finding. Issue #33 created.
- Result: `問題あり`. Source-level IEEE-754 arithmetic proof; no Vitest, package runtime, or fresh R execution.

## Audit #149 — `src/distributions/nt.ts`

- Repository HEAD: `3d9623ccac1dc46974fd7f01cbcbb44e931cfcb6`; source blob `85763973f3f7a82d46ceee19a4dd0f8d8c275814`.
- Reviewed the full noncentral-t implementation: log-gamma transformation, double-double integrands, peak search, trapezoid refinement and truncation, formula A/B switching, Laplace expansion and its error gate, far-tail power law, near-zero shortcut, huge-df limits, noncentrality infinities, and quantile sign/tail inversion.
- Exact regression inputs inspected: `pt(-30.268742563306827,100100312298908620,{ncp:2.475805900718761,logP:true})`; `dt(2.3074923907795758e54,100100312298908620,{ncp:2.475805900718761,log:true})`; `pt(0.001,2e-6,{ncp:40,logP:true})`; `qt(1.4426402575659767e-62,5.449761356942939e-96,{ncp:48.87598483697083})`. Existing `test/nt.test.ts` and R/mpmath fixtures inspected, not executed.
- Result: `一部監査・問題未検出`. No new reproducible defect confirmed; no Vitest, package runtime, or fresh R execution.

## Audit #150 — `src/distributions/pareto.ts`

- Repository HEAD: `3d9623ccac1dc46974fd7f01cbcbb44e931cfcb6`; source blob `fe44325a34f8ba48a1a8f1e6069852825310bf03`.
- Reviewed support endpoints, `a=Infinity` point-mass limit, double-double ratio and log-ratio fallback, subnormal-shape tail logs, density product fallback, lower/upper tail complement, and quantile overflow handling.
- Exact probes inspected: `dpareto(1.1e-263,{a:1640,b:7.8e-264,log:true})`; `ppareto(318.7041047333832,{a:1.040734e-317,b:1,logP:true})`; `qpareto(0.5,{a:1e308,b:1e-308})`. Existing extraDistr and mpmath fixtures inspected, not executed.
- Result: `一部監査・問題未検出`. No new reproducible defect confirmed; no Vitest, package runtime, or fresh R execution.

## Audit #151 — `src/distributions/signrank.ts`

- Repository HEAD: `3d9623ccac1dc46974fd7f01cbcbb44e931cfcb6`; source blob `fb0dfa41c1a99f41e7e8d5d5dfb7896fc7de4afb`.
- Reviewed n rounding/validation, support endpoints, descending subset-sum DP, periodic power-of-two rescaling, `minTrusted` error bound, low-table rebuild, Kahan cumulative sums, symmetry-based smaller-tail evaluation, log probabilities, LRU cache budget, MAX_LEN guard, and discrete quantile search.
- Exact probes inspected: `dsignrank(0,1100)`; `psignrank(40,10,{lowerTail:false})`; `qsignrank(0.025,10)`; `dsignrank(20,1100)`. Existing property regression includes n=1100 low-rank values after centre-table construction; fixture and test source inspected, not executed.
- Result: `一部監査・問題未検出`. No new reproducible defect confirmed; no Vitest, package runtime, or fresh R execution.

## Audit #152 — `src/distributions/summary.ts`

- Repository HEAD: `3d9623ccac1dc46974fd7f01cbcbb44e931cfcb6`; source blob `5db8355953de9a5d314c16564fa58d6f523a7922`.
- Reviewed all distribution branches, parameter validation, existence thresholds for moments, mode/median conventions, central-moment quadrature, convergence acceptance, raw-moment log fallback, and overflow/underflow scaling paths.
- Confirmed defect: `distSummary("pareto",{a:1e308,b:1e308})`. The formulas for mean, variance, standard deviation, skewness and kurtosis form large powers/products before cancellation, causing Infinity/NaN although the mathematical values are finite: mean≈1e308, variance≈1, sd≈1, skewness≈2, excess kurtosis≈6. Issue #34 created.
- Additional exact probes inspected: `distSummary("norm",{sd:1e200})`; `distSummary("lnorm",{meanlog:0,sdlog:1e-200})`; `distSummary("hyper",{m:0,n:0,k:0})`. R direct comparison is not applicable because this is not an R function; the Pareto closed forms and limit a→∞ provide the expected values. No Vitest/package runtime execution.
- Result: `問題あり`. Source-level algebra and IEEE-754 range proof.


## Audit #153 — `src/api-reference.ts`

- Repository HEAD: `1e94b1e295f5a57aeb02a43e029117a9d67b0282`; source blob `dc66d56aca691ba312c6f10a50e742e7921e2e69`.
- Five-line Typedoc entry point only; re-exports `./index.js` and `./entries/mixed.js`, explicitly excluded from build. No runtime algorithm or input handling.
- Result: `問題未検出` (documentation/export barrel only). No build or typecheck executed.

## Audit #154 — `src/data/grouping.ts`

- Repository HEAD: `1e94b1e295f5a57aeb02a43e029117a9d67b0282`; source blob `9bfc9a90424acc9766c599026273a2902e50dfe8`.
- Reviewed factor level canonicalisation (15-digit R text), mixed-type validation, missing labels, column-major cross-classification, empty cells, tapply scalar/non-scalar outputs, split drop/name collision handling, aggregate formula parsing (`.`, `cbind`, RHS operators), NA row filtering and multi-value result naming.
- Exact probes: `tapply([1,2,3,4],["b","a","b","a"],v=>v.length)`; `split([1,2,3],["b","a","b"])`; `aggregate("y ~ g",{y:[1,2,3,4],g:["b","a","b","a"]},v=>v.reduce((a,b)=>a+b,0))`.
- Confirmed issue: data-frame aggregate with grouping column named `__proto__` loses that output column because `aggregateRows` writes user-controlled names using ordinary `out[name] = ...`. Issue #35 also covers the same unsafe assignment in `dataFrames.ts`'s `rowsOf`.
- Cross-product size overflow can produce native RangeError for an enormous factor product; not independently classified. R 4.5.2 grouping fixtures and tests inspected, not executed. No Vitest/package runtime/R execution.

## Audit #155 — `src/descriptive/basic.ts`

- Repository HEAD: `1e94b1e295f5a57aeb02a43e029117a9d67b0282`; source blob `e12c8f8c91152f8d617cd05bf07ce512ef00856a`.
- Reviewed sum, product, mean/trim, weighted mean, variance, sd, median, range, cumulative sums/products/extrema and diff. Focus: NaN/naRm, empty vectors, ±Inf, signed zero, subnormals, extreme magnitudes, DD accumulation, exponent-scaled products, recovery after an intermediate output overflows, trim boundary, and lag/differences integer validation.
- Exact probes: `sum([1e308,1e308,-1e308])`; `prod([1e308,1e-308])`; `weightedMean([1e308,-1e308],[1,1])`; `median([-Number.MAX_VALUE,Number.MAX_VALUE])`; `sd([1e-200,-1e-200])`; `cumsum([1e308,1e308,-1e308])`; `cumprod([1e308,1e308,1e-308])`; `diff([Number.MAX_VALUE,-Number.MAX_VALUE])`.
- Existing `test/descriptive.test.ts` R-derived suites and documented R-vs-rStats numeric stability exceptions inspected. No new reproducible defect confirmed. Tests and R not executed.

## Audit #156 — `src/descriptive/cov.ts`

- Repository HEAD: `1e94b1e295f5a57aeb02a43e029117a9d67b0282`; source blob `9366b9c3fa7b01e198844711ea86dbe56a796fc0`.
- Reviewed vector/matrix dispatch, method/use abbreviations, everything/all.obs/complete.obs/na.or.complete/pairwise.complete.obs, pairwise Spearman ranking, Kendall covariance/tau-b, Pearson DD, n<2, no complete rows, and correlation-matrix diagonal handling.
- Exact probes: `cov([[1,2],[2,4],[3,5],[4,9]])`; `cor([1,2,3,4],[2,4,5,9],{method:"spearman"})`; `cov([[1,NaN],[2,3],[3,4]],{use:"pairwise.complete.obs"})`.
- Confirmed issue: `isMatrix` checks only the first row; `columns` uses its width for every row. Thus `cov([[1,2],[3,4,5]])` silently ignores 5, while `cov([[1,2],[3]])` passes undefined into numeric routines and yields NaN. Validate every row width. Issue #36.
- Existing `test/descriptive.test.ts` and R-derived covariance fixtures inspected, not executed. Ragged arrays are a JS shape-validation case, not a representable R matrix. No Vitest/package runtime/R execution.

## Audit #157 — `src/descriptive/dataFrames.ts`

- Repository HEAD: `1e94b1e295f5a57aeb02a43e029117a9d67b0282`; source blob `739034185d1cd747e57efbd5a6aeac026f9f9673`.
- Reviewed row-count validation, gather/type preservation, R 15-digit key text, missing-key matching, one/multi-key joins, many-to-many Cartesian matches, allX/allY, Shell-sort row ordering, suffix collisions, subset, rbind common-type coercion, cbind dimensions, and fromRows/toRows.
- Exact probes: `merge({id:[3,1,2],v:[10,20,30]},{id:[1,2,2,4],w:[0.5,1.5,2.5,3.5]})`; `subset({y:[5,NaN,7],g:["a","b","a"]},row=>row.y>4,{select:["g"]})`; `rbindFrames([{x:[1],g:[true]},{g:[false],x:[2]}])`; `fromRows([{id:"a",score:5},{id:"b"}])`.
- Confirmed issue: data-frame `split` uses `rowsOf`, which assigns input column names with `out[name] = ...`. An own `__proto__` column (e.g. supplied through JSON.parse) is consumed by the ordinary object's prototype setter and omitted from the result. Shared issue #35 with `grouping.ts` aggregate output.
- Existing `test/dataFrames.test.ts` and `test/fixtures/dataFrames.json` (R 4.5.2) inspected, not executed. No Vitest/package runtime/R execution.


## Audit #158 — `src/distributions/t.ts`

- Repository HEAD: `e18cb49f91c4d5667c40323080d741b3d2696738`; source blob `78247f0318768944233dc6e92874409b23e432b8`.
- Reviewed density, CDF and quantile end-to-end: df validation and infinite-df normal limit; HUGE_DF/TINY_DF branches; x=0 and infinite x; double-double x² and beta arguments; large-|x| power-tail log form; incomplete-beta tail selection; tiny-df asinh approximation; quantile probability boundaries, tiny-df inverse, Cornish-Fisher start, deep-tail asymptotic start, largest-double cutoff and invertContinuous callbacks.
- Exact inputs inspected: `dt(0,5)`; `dt(1.5e154,1e308,{log:true})`; `pt(-3.5e151,4.3e121,{logP:true})`; `qt(0.499999999,1e-10,{lowerTail:false})`; `qt(1e-5,1e-310,{lowerTail:false})`; `qt(3.048e-196,0.633)`. These include code-commented regression cases. No new reproducible defect confirmed.
- Existing source/tests and mathematical paths inspected; no Vitest, package runtime or R execution.

## Audit #159 — `src/distributions/tukey.ts`

- Repository HEAD: `e18cb49f91c4d5667c40323080d741b3d2696738`; source blob `d9d8b47fdd9203b21f4bb88f6056314618dee354`.
- Reviewed Clenshaw-Curtis weights/coefficients and adaptive convergence, interval/piece caps, narrow normal-window integration and shifted-argument correction, log W and complement integrals, Chebyshev curve construction/evaluation/cache boundaries, nranges maximum distribution, Gamma outer integral, large-df limit, deep-tail log integral, ptukey smaller-tail selection and qtukey log-q bracketing/Brent solver.
- Exact inputs inspected: `ptukey(3.5,3,12)`; `ptukey(0.5,1000,10)`; `ptukey(2.5e118,4,3,{nranges:2,lowerTail:false,logP:true})`; `qtukey(1.5e-287,3,4.7e10,{nranges:2,lowerTail:false})`. Existing `test/tukey.test.ts` and `test/tukey-quantile.test.ts` inspected; their notes identify Rmpfr 160-bit references because R `ptukey` itself is only about 8-digit accurate. No new reproducible defect confirmed.
- Source/test inspection only; no Vitest, package runtime or R execution.

## Audit #160 — `src/distributions/uniform.ts`

- Repository HEAD: `e18cb49f91c4d5667c40323080d741b3d2696738`; source blob `62834a501bf92c899d79f98336b2b91a8cda1458`.
- Reviewed dunif/punif/qunif support and endpoints, min=max degenerate case, finite-bound validation, overflow-safe width halving, direct upper/lower ratios, log probabilities, subnormal inputs and quantile interpolation with extreme endpoints.
- Exact inputs inspected: `dunif(0.5,{min:-1e308,max:1e308})`; `punif(1e-300,{lowerTail:false,logP:true})`; `punif(0.999,{min:-1,max:1,logP:true})`; `punif(1e-300,{min:0,max:1e308,logP:true})`; `qunif(0.25,{min:-1e308,max:1e308})`; `punif(1,{min:1,max:1})`. Degenerate min=max is treated as a step CDF, distinct from the undefined density. `test/helpers/distributionKnown.ts` records the known punif log-tail/subnormal discrepancies and explicitly says they are retained to match R 4.5.2. No new defect confirmed.
- Source/test inspection only; no Vitest, package runtime or R execution.

## Audit #161 — `src/distributions/weibull.ts`

- Repository HEAD: `e18cb49f91c4d5667c40323080d741b3d2696738`; source blob `f1c3e76bce8a68f936169e4a2e261b13e937b047`.
- Reviewed log(x/scale) fallback for subnormal/overflow ratios, double-double formation of shape×log-ratio and its exponential, density at x=0 for shape<1/1/>1, infinite parameters, survival/CDF log-tail branches, lower-tail tiny-probability approximation, quantile logP special path and rescaling when the powered probability underflows before multiplication by scale.
- Exact inputs inspected: `dweibull(1.9e-255,6.6e306,{scale:98.6})`; `pweibull(1e-5,1000,{logP:true})`; `qweibull(-720.6,1,{scale:1.36e257,logP:true})`; `dweibull(0,0.5,{scale:2})`; `pweibull(Infinity,2)`. These include documented prior regression cases. No new reproducible defect confirmed.
- Source/test inspection only; no Vitest, package runtime or R execution.

## Audit #162 — `src/distributions/wilcox.ts`

- Repository HEAD: `e18cb49f91c4d5667c40323080d741b3d2696738`; source blob `20361aac59ba97cee84f31949e6134ea30e1d029`.
- Reviewed parameter rounding and support validation, q rounding, symmetry-based lower/upper-tail indexing, q-binomial recurrence with double-double coefficients, rescaling and lost-digit tracking, trusted-prefix behavior, cache growth/eviction, table allocation and quantile inversion.
- Confirmed defect: `m=3`, `n=3002399751580331` have exact product `9007199254740993`, but binary64 multiplication rounds `m*n` to `9007199254740992 = 2^53`. Since `wilcoxParams` rejects only when the rounded product is greater than `2^53`, the invalid support endpoint passes validation. For `q=2^53`, `pwilcox1` then takes `x >= m*n` and returns the zero upper-tail endpoint (`-Infinity` in log form), although q is one below the true maximum and the upper tail is the positive endpoint mass `1 / choose(m+n,m)` (log approximately `-105.1`). Exact reproduction: `const m=3,n=3002399751580331,q=2**53; pwilcox(q,m,n,{lowerTail:false,logP:true})`. Issue #37 created.
- Additional probes inspected: `dwilcox(0,1050,1050,{log:true})`; center-region table behavior near `m=n=550`; `qwilcox(0.025,4,6)`. Existing `test/wilcox.test.ts` and fixtures were inspected, not executed. No Vitest/package runtime/R execution.


## Audit #163 — `src/descriptive/factanal.ts`

- Repository HEAD: `0198fd8d1f738d5bce2a65ad0ddf27c77af26a0b`; source blob `970ac621ef43828f2fae1440c891e5abd792cd0a`.
- Reviewed data/covmat dispatch, covariance validation and standardisation, p/factor/dof constraints, starting uniquenesses, L-BFGS-B likelihood objective and gradient, eigenvalue loadings, varimax normalisation/SVD orthogonal rotation, promax QR and Gram-matrix scaling, column ordering/sign, regression and Bartlett scores, and likelihood-ratio statistic/p-value.
- Exact inputs inspected: `const R=[[1,.72,.63],[.72,1,.56],[.63,.56,1]]; factanal(null,1,{covmat:R})`; `factanal([[1,2,3],[2,1,2],[3,5,4],[4,3,6],[5,4,5]],1,{scores:"regression"})`; same data with `{scores:"Bartlett",rotation:"none"}`; `factanal(null,1,{covmat:R,nObs:100})`. Existing `test/factanal.test.ts` and R-derived fixtures, including error cases, were inspected. No new reproducible defect confirmed.
- Source/test inspection only; no Vitest, package runtime or R execution.

## Audit #164 — `src/descriptive/hist.ts`

- Repository HEAD: `0198fd8d1f738d5bce2a65ad0ddf27c77af26a0b`; source blob `36d38b059aaf8f56c8b400a7dd80bc5cd2b45aac`.
- Reviewed pretty's finite filtering, n/minN truncation and validation order, zero/small/tiny/subnormal/overflow range handling, 1-2-5-10 unit choice, rounding allowance, minN expansion and overflow-safe sequence generation; hist break dispatch, 1e6 cap, strict-order check, fuzz shifts, right/includeLowest cell boundaries and binary search, densities/midpoints; ecdf NaN removal, infinities and lower-bound search.
- Exact inputs inspected: `pretty([0.3,9.6])`; `pretty([1e-300,1e-300])`; `pretty([-1e308,1e308])`; `hist([0,1,2,3],{breaks:[0,1,2,3],right:false})`; `hist([1,2,3],{breaks:[0,2,4]})`; `ecdf([-Infinity,0,Infinity])(0)`. Existing `test/pretty.test.ts`, hist/pretty fixtures and their R 4.5.2 metadata were inspected. No new reproducible defect confirmed.
- Source/test inspection only; no Vitest, package runtime or R execution.

## Audit #165 — `src/descriptive/missing.ts`

- Repository HEAD: `0198fd8d1f738d5bce2a65ad0ddf27c77af26a0b`; source blob `6fdf726982969ccad9be0e38b892b3b6cf47582c`.
- Reviewed array/typed-array/DataFrame dispatch, null/NaN missing semantics, multi-argument row-count checks, zero-column/zero-row cases, complete-case mask and naOmit's output type preservation.
- Confirmed defect: `completeCases` sees an own `__proto__` column through `Object.values`, but the DataFrame branch of `naOmit` writes the output into ordinary `{}` using `out[name] = kept`. The legacy prototype setter consumes the key, so the returned data frame silently loses that column. Exact reproduction: `const x=JSON.parse('{"__proto__":[1,null],"v":[3,4]}'); naOmit(x)`. Same root cause as grouping.aggregate and dataFrames.split; added this symptom to Issue #35.
- No dedicated missing.ts test/fixture was found in the repository tree. Source-level JavaScript semantics establish the defect; no Vitest/package runtime/R execution.

## Audit #166 — `src/descriptive/moments.ts`

- Repository HEAD: `0198fd8d1f738d5bce2a65ad0ddf27c77af26a0b`; source blob `67c81d40b0b0877dab5df9f6dcca71df01c23012`.
- Reviewed central moment scaling, double-double mean/deviations, skewness and kurtosis types 1/2/3 and sample-size guards, geometric mean sign/zero/missing cases, modes/ties/signed zero, meanAD centres, CV correction, and scale's centre/scale modes, NaN handling and overflow-recovery branch.
- Exact inputs inspected: `skewness([-1e308,1e308])`; `kurtosis([1e-200,2e-200,3e-200,4e-200])`; `geometricMean([1e308,1e-308])`; `meanAD([-1e308,1e308])`; `cv([-1,1])`; `scale([[1,2],[3,4]])`; ragged cases `scale([[1,2],[3,4,5]],{center:false,scale:false})` and `scale([[1,2],[3]],{center:true,scale:true})`.
- Confirmed defect: `scale` derives `nc` only from the first row and does not validate the other row lengths. The longer row's extra cell is silently discarded; the shorter row contributes `undefined` to column summaries and produces NaNs. Issue #38 created.
- Existing skewness and scale fixtures plus scale-invariance tests were inspected, not executed. No Vitest/package runtime/R execution.

## Audit #167 — `src/descriptive/omega.ts`

- Repository HEAD: `0198fd8d1f738d5bce2a65ad0ddf27c77af26a0b`; source blob `99da1d19fa2e5d62f8ef8ef593cc6abc3294f527`.
- Reviewed pairwise-complete correlations/covmat normalisation, SMC pseudo-inverse rank cutoff, minres objective/gradient/bounds and Heywood warning, principal loadings/eigen clipping, varimax, quartimin gradient, oblimin Barzilai-Borwein step/non-monotone line search/iteration warning, two-factor identification rule, Schmid-Leiman general/group loadings, item flipping, omegaH/omegaLim/alpha/omegaTot/G6/ECV and group assignment.
- Exact inputs inspected: `const R=[[1,.52,.36,.36,.36,.36],[.52,1,.36,.36,.36,.36],[.36,.36,1,.52,.36,.36],[.36,.36,.52,1,.36,.36],[.36,.36,.36,.36,1,.52],[.36,.36,.36,.36,.52,1]]; omega(null,{covmat:R})`; `omega(null,{nfactors:1,covmat:R})`; `omega(null,{nfactors:2,covmat:R})`. Existing `test/omega.test.ts` and R fixtures for one/two/three factors and documented one-factor zero residues were inspected. No new reproducible defect confirmed.
- Source/test inspection only; no Vitest, package runtime or R execution.


## Audit #168 — `src/descriptive/pivot.ts`

- Repository HEAD: `e22826429f71e15fb26749fbc3bb1dc7430ccdb4`; source blob `63ae79e257a4d66e6750abdb906813489812f328`.
- Reviewed pivotLonger selection, duplicate columns, regex captures and separator splitting, namesTo/.value mapping, common value types, row ordering, valuesDropNa, namesTransform, warning deduplication and Float64Array preservation; pivotWider id/name combinations, sorting, duplicate cells, summary/fill dispatch, namesVary and generated names.
- Confirmed defect: `perColumn()` accesses an options record with `option[name]` and does not require an own property. For a value column named `__proto__`, `valuesFill: {}` returns inherited `Object.prototype` instead of undefined; a missing cell receives an object rather than the default null. Exact reproduction: `const d=JSON.parse('{"id":[1,2],"key":["a","b"],"__proto__":[5,6]}'); pivotWider(d,{namesFrom:"key",valuesFrom:"__proto__",idCols:["id"],valuesFill:{}})`. Same inherited lookup affects `valuesFn`. Issue #39 created.
- Existing `test/pivot.test.ts` and R/tidyr fixture cases were inspected; not executed. No Vitest/package runtime/R execution.

## Audit #169 — `src/descriptive/quantile.ts`

- Repository HEAD: `e22826429f71e15fb26749fbc3bb1dc7430ccdb4`; source blob `7fe14be52f404d0565fc5ec0cd4d953d155c2b6a`.
- Reviewed all nine Hyndman-Fan position formulas, relative fuzz, endpoint clamping, empty/missing samples, interpolation with equal and opposite infinities, IQR, Tukey hinges/midpoint, and MAD's low/high even-n rules, missing-value count, custom centre and constant.
- Exact inputs inspected: `quantile([-Infinity,Infinity],0.25,{type:7})`; `quantile([1,2,3,4],0.5,{type:1})`; `quantile([1,2,3,4],NaN)`; `fivenum([-Number.MAX_VALUE,Number.MAX_VALUE])`; `mad([1,2,3,4],{low:true})`; `mad([1,2,3,4],{high:true})`. Existing `test/descriptive.test.ts` and R 4.5.2 quantile fixtures inspected. No new reproducible defect confirmed.
- Source/test inspection only; no Vitest, package runtime or R execution.

## Audit #170 — `src/descriptive/rank.ts`

- Repository HEAD: `e22826429f71e15fb26749fbc3bb1dc7430ccdb4`; source blob `316d4778675095a5b4eb9da60846c375ddad79cb`.
- Reviewed NaN placement (keep/first/last), ±Infinity comparisons, equal infinities, signed zero, empty/all-missing samples, all six tie methods, missing-rank offsets, and random tie ordering using the shared R-compatible RNG.
- Exact inputs inspected: `rank([Infinity,1,Infinity,-Infinity])`; `rank([NaN,3,NaN,1],{naLast:"first"})`; `rank([NaN,3,NaN,1],{naLast:"last"})`; `rank([-0,0,1])`; `setSeed(17); rank([2,1,2,1],{tiesMethod:"random"})`. The comparator's `Infinity - Infinity` becomes NaN, which is treated as equality by the `||` fallback; missing values are handled separately. Existing descriptive fixture/test source inspected. No new reproducible defect confirmed.
- Source/test inspection only; no Vitest, package runtime or R execution.

## Audit #171 — `src/descriptive/table.ts`

- Repository HEAD: `e22826429f71e15fb26749fbc3bb1dc7430ccdb4`; source blob `d6a292d4eb9f040528219f8202e2ad962cfc13e0`.
- Reviewed tabulate truncation and nbins validation, table's 15-digit numeric levels and useNA, unique's NaN and signed-zero semantics, cut's generated/vector breaks and right/includeLowest boundary rules, and findInterval's sorted validation, duplicate endpoints, empty vector and option combinations.
- Exact inputs inspected: `tabulate([1.9,2.9,0,-1,NaN])`; `table([1,1+Number.EPSILON,NaN],{useNA:"always"})`; `unique([-0,0,NaN,NaN])`; `cut([0,1,2],[0,1,2],{right:false,includeLowest:true})`; `findInterval([-Infinity,0,1,Infinity],[0,1],{leftOpen:true,rightmostClosed:true})`; `findInterval([1],[])`. Existing `test/descriptive.test.ts` and R table fixtures inspected. Very large implicit `nbins` can exhaust runtime memory, but was not classified as a reproducible algorithm defect. No new defect confirmed.
- Source/test inspection only; no Vitest, package runtime or R execution.

## Audit #172 — `src/entries/descriptive.ts`

- Repository HEAD: `e22826429f71e15fb26749fbc3bb1dc7430ccdb4`; source blob `fb10893d0071c8e00efa9146f607952a7de4f321`.
- Reviewed the descriptive entry-point's re-export list against the implementation modules for basic summaries, quantile/MAD, rank, covariance/correlation, table/cut/findInterval, missing values, hist/ecdf, moments, grouping, data-frame helpers and pivot operations. Checked named function and option/type exports for missing or duplicate symbols.
- No missing, duplicate or nonexistent re-export was found. This file is a barrel and contains no numerical algorithms.
- Static source comparison only; TypeScript build/package runtime/R execution not run.


## Audit #173 — `src/entries/distributions.ts`

- Repository HEAD: `c06da849afc7406f4f2a37e6387a4febab3306d8`; source blob `7b44e94c54982bdc6aba93f6e5a1aacac8afd8e9`.
- Reviewed the distribution and random-number re-export surface: d/p/q families, extra distributions, density/tail option types, noncentral option, vectorization types, RNG state and kind selection, streams, continuous/discrete random generators, sampling, rank distributions and contingency-table sampling.
- Cross-checked representative symbol-to-module paths: `dnorm/pnorm/qnorm` → normal; hypergeometric d/p/q → hypergeometric; `distSummary` → summary; `setSeed/RNGkind` → rng; `sample` → sample; `r2dtable` → r2dtable. The `package.json` `./distributions` subpath and `scripts/bundle.mjs` area entry agree. No barrel-level computation or obvious export-path mismatch found.
- Static inspection only; no TypeScript build or package runtime.

## Audit #174 — `src/entries/linalg.ts`

- Repository HEAD: `c06da849afc7406f4f2a37e6387a4febab3306d8`; source blob `e32c849b2f9d1dd45c08e6ef70dfe5d1c107ac8f`.
- Reviewed exports for cross/triangular solves, norms, Cholesky, QR and its accessors/solvers, determinant/condition/solve, SVD, generalized inverse, eigen, Schur, matrix exponential, matrix operations, LU and PCA; checked their module paths and associated public types.
- Representative path checks: `qrQ/qrR/qrCoef/qrSolve` → qr; `determinant/rcond` → solve; `matMul/kronecker/seq` → ops; `prcomp/lu` → lu; `MatrixInput/VectorOrMatrix` → matrix. The `./linalg` package subpath and bundler entry agree. No barrel-level computation or obvious export-path mismatch found.
- Static inspection only; no TypeScript build or package runtime.

## Audit #175 — `src/entries/mixed.ts`

- Repository HEAD: `c06da849afc7406f4f2a37e6387a4febab3306d8`; source blob `fbf3809001ad16f39e28f2b9fb1205e7b4a2f7a8`.
- Reviewed the public mixed-model surface: `lmer` and result/options/random-effect types; `lmerContest` and `lmerSummary` with their t/F/summary types; `lmerAnova` with one-fit ANOVA and multiple-fit comparison types.
- Representative path checks: `lmer` → models/lmer; `lmerSummary` → models/lmerTest; `lmerAnova` → models/lmerAnova. This entry is intentionally not star-exported from root `src/index.ts`, but `package.json` declares `./mixed` and the bundler's AREAS includes `mixed`; it is therefore an independently published subpath, not a missing root export.
- No obvious export-path mismatch found. Static inspection only; no TypeScript build or package runtime.

## Audit #176 — `src/entries/numerics.ts`

- Repository HEAD: `c06da849afc7406f4f2a37e6387a4febab3306d8`; source blob `b1264f23844b400756e935cceee2d36fb0bde88c`.
- Reviewed integration/minimization/root-finding exports and option/result types, interpolation and spline exports, ODE exports, numerical derivatives, and general optimization.
- Representative path checks: `integrate/optimize/uniroot` and their types → numerics/integrate; `approx/spline/splinefun` → numerics/interp; `ode` → numerics/ode; `grad/hessian/jacobian` → numerics/deriv; `optim/optimHess` → optim/optim. In particular, `optimize` and `uniroot` being re-exported from a file named `integrate.ts` is correct: that module explicitly exports all three functions. The `./numerics` package subpath and bundle entry agree.
- Numerical algorithms were not fully audited as part of this entry-point review. Static inspection only; no TypeScript build or package runtime.

## Audit #177 — `src/entries/special.ts`

- Repository HEAD: `c06da849afc7406f4f2a37e6387a4febab3306d8`; source blob `23585b6d3c282b3c43852a684e5914017b3a700d`.
- Reviewed gamma/beta, combinatorics, polygamma, Bessel, error functions, extra special functions, logarithmic helper functions and public option/result types.
- Representative path checks: `RCompatibleOptions` → rCompatible; `BesselOptions` → besselIK; `GammaincResult` → extra. The `./special` package subpath and bundle entry agree. No barrel-level computation or obvious export-path mismatch found.
- Static inspection only; no TypeScript build or package runtime.



## Audit #178 — `src/entries/tests.ts`

- Repository HEAD: `b1f99b610908221c1380f18c8edf4b3bb8551e5e`; source blob: `52e4980e22ee14739c2801c965c7d348aa6a3175`.
- Hypothesis-test/model public entry-point exports, named option/result types, model and agreement helpers; compared re-export paths with implementation files and package subpath/bundle configuration. No missing or duplicate export path identified; barrel contains no numerical algorithm.
- Rとの関係: 該当なし（API re-export barrel）
- 検証範囲: 静的なexport/path照合。TypeScript build・package runtime・Vitest・R実行なし。


## Audit #179 — `src/htest/agreement.ts`

- Repository HEAD: `b1f99b610908221c1380f18c8edf4b3bb8551e5e`; source blob: `435f225cc5d16a9d17207c2ebd1b7fd18bdb0386`.
- kappa2 weighted/unweighted contingency construction, missing-pair filtering, string-sorted levels and null variance; kappamFleiss/Conger exact, category coding and variance; ICC one-way/two-way consistency/agreement, single/average units, r0, Satterthwaite df and CI; Cronbach alpha/raw-standardised/G6/alpha-drop; partial correlation and inverse-correlation solve. Shape, missing/infinite and minimum-dimension guards reviewed. No new reproducible defect confirmed.
- Rとの関係: irr::kappa2/kappam.fleiss/icc および psych::alpha/partial.r のR由来fixtureを閲覧（未実行）。
- 検証範囲: 具体入力: `kappa2([[1,1],[2,2],[3,2],[1,1],[2,3],[3,3]])`; `kappa2([[1,1],[1,1]],{weight:"equal"})`（単一カテゴリの退化ケース）; `kappamFleiss([[1,1,2],[2,2,2],[3,3,2],[1,1,1],[2,3,3]])`; `icc([[9,2,5,8],[6,1,3,2],[8,4,6,8],[7,1,2,6],[10,5,6,9],[6,2,4,7]],{model:"twoway",type:"agreement"})`; `cronbachAlpha([[1,2,2],[2,3,3],[3,3,4],[4,5,4],[2,2,3]])`; `partialR([[1,2,3],[2,1,5],[3,5,4],[4,3,8],[5,6,7]],0,1)`. `test/agreement.test.ts` と `test/fixtures/agreement.json` の24ケースを閲覧。ソース・fixture確認のみ。Vitest/R実行なし。


## Audit #180 — `src/htest/ansariTest.ts`

- Repository HEAD: `b1f99b610908221c1380f18c8edf4b3bb8551e5e`; source blob: `9f13bb6d406d4f36761a562aed8bb17c0ce52db4`.
- Ansari-Bradley score/rank construction, NaN removal, ties and exact-selection threshold; exact lower/upper/two-sided tails and centre; tied normal variance; ratio-of-scales CI exact candidate ratios and normal uniroot range/tolerance; formula dispatch and one-sided CI shaping. No new reproducible defect confirmed.
- Rとの関係: R 4.5.2 ansari.test fixtureおよびmpmath exact-distribution fixturesを閲覧（未実行）。
- 検証範囲: 具体入力: `ansariTest([-2,-1,1,2],[-4,-3,3,4],{confInt:true})`; `ansariTest([1,2,3,4],[2,4,6,8],{exact:true})`; `ansariTest([1,1,2],[2,3,3],{exact:true,confInt:true})`（tiesでnormal branchへ移る条件）; `ansariTest("y ~ g",{y:[1,2,3,4],g:["a","a","b","b"]})`. `test/htest-core/ansari.test.ts`、`test/fixtures/ansariTest.json`（173 cases）、`test/fixtures/ansariTestConfInt.json`（183 cases）を閲覧。ソース・fixture確認のみ。Vitest/R実行なし。


## Audit #181 — `src/htest/aov.ts`

- Repository HEAD: `b1f99b610908221c1380f18c8edf4b3bb8551e5e`; source blob: `9ce3aa388e5d2200fd75c751d6c69660d0e11648`.
- aov overload dispatch (one-way samples/groups vs formula/Error strata), one-way SS/MS/F/df and zero residual df, Tukey-Kramer pair order/SE/CI/adjusted p, and zTest argument overloads, known-SD validation, NaN filtering, minimum sample size, closed confidence-level endpoints, tail and CI quantiles, scaling for extreme magnitudes. No new reproducible defect confirmed.
- Rとの関係: R 4.5.2 aov/TukeyHSDおよびBSDA::z.test由来fixtureを閲覧（未実行）。
- 検証範囲: 具体入力: `aov([[2.9,3.0,2.5,2.6,3.2],[3.8,2.7,4.0,2.4],[2.8,3.4,3.7,2.2,2.0]])`; `aov("y ~ g",{y:[4.2,5.1,6.3,5.8,7.9,8.4],g:["a","a","b","b","c","c"]})`; `TukeyHSD([1.2,2.3,1.8,2.9,3.1,3.6,4.0,4.4,5.2],["a","a","a","b","b","b","c","c","c"])`; `zTest([5.1,4.9,5.6,5.8,6.0],{mu:5,sigmaX:0.5})`; extreme probe `zTest([1e308,1e308,1e308],{sigmaX:1e308})`. `test/anova.test.ts` と `test/fixtures/aovOneway.json` を閲覧。ソース・fixture確認のみ。Vitest/R実行なし。


## Audit #182 — `src/htest/binomTest.ts`

- Repository HEAD: `b1f99b610908221c1380f18c8edf4b3bb8551e5e`; source blob: `4e514e3164c1f852b325a5a04b099effc73d218c`.
- Binomial count/scalar and [successes,failures] overloads, count and n validation, p endpoints 0/1, alternative matching, two-sided probability-ordering criterion with relative slack and monotone opposite-tail binary search, exact lower/upper tails, Clopper-Pearson beta-quantile limits, confidence-level endpoints and underflow-sensitive upper-tail quantile branch. No new reproducible defect confirmed.
- Rとの関係: R 4.5.2 binom.test fixtureおよびSciPy由来の独立比較fixtureを閲覧（未実行）。
- 検証範囲: 具体入力: `binomTest(682,925,{p:0.75})`; `binomTest([3,7],{p:0.5})`; `binomTest(0,10,{p:0})`; `binomTest(10,10,{p:1})`; `binomTest(0,2000,{p:0.5})`; `binomTest(1,5,{p:0.5,alternative:"greater",confLevel:0.5872345434452184})`. `test/fixtures/binomTest.json`（166 cases）と `test/fixtures/htest_binomTest.scipy.json` を閲覧。二側確率の探索は平均の両側で単調な区間だけを二分探索する構造を確認。ソース・fixture確認のみ。Vitest/R実行なし。


## Audit #183 — `src/htest/brunnerMunzelTest.ts`

- Repository HEAD: `e014c17e1cc14604e869b32d32af72dc1a9d8f36`; source blob: `3809905d6b8726a9b01afaf75deb0cbeb3082cac`.
- Reviewed pooled/midrank and within-rank placements, tie handling, NaN filtering, infinities, singleton samples, zero placement variances, Satterthwaite degrees of freedom, alternative direction, direct-tail p-values and confidence-interval quantiles.
- Exact inputs inspected: `brunnerMunzelTest([1,2,1,1,1,1,1,1,1,1,2,4,1,1],[3,3,4,3,1,2,3,1,1,5,4])`; `brunnerMunzelTest([1,1],[2,2])` (complete separation and zero variances); `brunnerMunzelTest([NaN,1],[NaN,2])`; `brunnerMunzelTest([1],[2,3])` (one observation in x). Existing `test/fixtures/brunnerMunzelTest.json` (R 4.5.2) and CHANGELOG v0.8.0 entry inspected. No new reproducible defect confirmed.
- Rとの関係: lawstat::brunner.munzel.test のR 4.5.2 fixtureを閲覧（未実行）。
- 検証範囲: ソース・fixture確認のみ。Vitest/package runtime/R実行なし。

## Audit #184 — `src/htest/chisqTest.ts`

- Repository HEAD: `e014c17e1cc14604e869b32d32af72dc1a9d8f36`; source blob: `adeccfde6d2e234e5f54a5d37df6d724a5be9d0a`.
- Reviewed goodness-of-fit / contingency dispatch, ragged matrix validation, one-row/one-column matrix conversion, expected counts and residuals, Yates correction, zero margins, double-double sums, Monte Carlo replicate validation and seed consumption, multinomial simulation and Patefield table generation.
- Confirmed defect: `byCodePoint` at line 158 uses JavaScript relational comparison, which orders UTF-16 code units rather than Unicode code points. Exact input: `chisqTest(["\\u{10000}","\\uE000","\\u{10000}","\\uE000"],["a","a","b","b"])`. U+E000 (57344) should precede U+10000 (65536) in code-point / UTF-8 C-locale order, but the leading surrogate U+D800 sorts first under UTF-16. `rowLevels` and the corresponding table rows are therefore in the opposite order. Issue #42 created (bug; area: factor-level ordering; severity: low; the statistic is invariant to the corresponding permutation).
- Additional consistency note: the file header says vector counts allow Infinity and yield NaN, while the implementation rejects non-finite counts. `test/chisq.test.ts` explicitly substitutes the R fixture's Inf case with the finite-count validation error, so this is treated as an intentional stricter test contract plus stale source comment, not a second functional issue.
- Rとの関係: R 4.5.2 chisq.test fixtureを閲覧（未実行）。C-locale orderingを期待値根拠とした。
- 検証範囲: 上記Unicode factor input、`chisqTest([[12,5],[7,15]])`、`chisqTest([20,15,25])`、`setSeed(1); chisqTest([20,15,25],{simulatePValue:true})`。既存 `test/chisq.test.ts` と `test/fixtures/chisqTest.json` を閲覧。Vitest/package runtime/R実行なし。

## Audit #185 — `src/htest/cor.ts`

- Repository HEAD: `e014c17e1cc14604e869b32d32af72dc1a9d8f36`; source blob: `4ed4868b5441752c2b4581e85d2e9b2c0b015101`.
- Reviewed Pearson's scaled centred sums and double-double correlation, endpoint clamp, t statistic and Fisher-z interval; Kendall concordance/discordance, tie-corrected variance and exact inversion recurrence; Spearman rank correlation, AS 89 exact enumeration and Edgeworth approximation; NaN/Inf handling, exact thresholds, continuity correction, alternatives and formula dispatch.
- Confirmed defect: line 153 clamps whenever the high component `r[0]>=1`, discarding a negative low component when the true double-double correlation is below 1 but its binary64 high component rounds to 1. Exact input: `corTest([0,1,2],[0,1,2+Number.EPSILON])` (last y value is exactly 2.0000000000000004). 100-digit decimal calculation gives `1-r²≈1.6434602192104405e-32`, `t≈7.800463371553964e15` (df=1), two-sided `p≈8.161307117845713e-17`; current clamp changes r to [1,0], causing infinite t and p=0. Issue #40 created (bug; area: Pearson correlation; severity: medium).
- Rとの関係: R 4.5.2 cor/cor.test fixturesを閲覧（未実行）。Near-perfect case uses high-precision decimal mathematics, not R, as oracle because ordinary binary64 correlation may itself round to 1.
- 検証範囲: `test/cor.test.ts` and `test/fixtures/corTest.json` inspected; high-precision Decimal calculation for the exact input. No Vitest/package runtime/R execution.

## Audit #186 — `src/htest/core/ansari.ts`

- Repository HEAD: `e014c17e1cc14604e869b32d32af72dc1a9d8f36`; source blob: `0de0bf2ccae23fb0e98115d356a4cd5c8e48ac5f`.
- Reviewed the subset-position probability DP, probability-tail accumulation, statistic floor/fuzz, upper-tail inversion for quantiles, relative slack, integer-count DP, choose-based normalisation and per-size caches.
- Exact inputs inspected: `pansariExact(5,3,4,true)`; `pansariExact(5,3,4,false)`; `dansariExact(5,3,4)`; `qansariExact(0.5,3,4)`; `qansariR(0.5,3,4)`; endpoint quantiles `qansariExact(0,3,4)` and `qansariExact(1,3,4)`. The internal `qansariExact` helper does not independently reject fractional m/n, but public `ansariTest` derives them from array lengths and the helper is not exported from the package entry; no defect in the supported public call path was confirmed.
- Rとの関係: R 4.5.2 Ansari-Bradley exact fixture and independently generated integer-count/brute-force reference fixtures inspected (not executed).
- 検証範囲: `test/htest-core/ansari.test.ts`, `src/htest/ansariTest.ts` and CHANGELOG v0.7.0 inspected. Source/fixture inspection only; no Vitest/package runtime/R execution.

## Audit #187 — `src/htest/core/kolmogorov.ts`

- Repository HEAD: `e014c17e1cc14604e869b32d32af72dc1a9d8f36`; source blob: `dd0aa7c40dfbf875694b6f024c77d2cdfd937889`.
- Reviewed the Marsaglia-Tsang-Wang exact matrix construction and exponent-scaled matrix power, small-d closed form, both series for the limiting Kolmogorov distribution, lower/upper-tail selection and the Birnbaum-Tingey one-sided upper-tail sum.
- Confirmed defect: for a positive x whose square underflows to zero, the small-x branch forms an infinite exponent and zero exponential sum while the prefactor `sqrt(2π)/x` overflows to Infinity; the product becomes NaN. Exact input: `pkolmogorovLimit(1e-200,true)` should underflow to 0 and `pkolmogorovLimit(1e-200,false)` should be 1, but both return NaN by the source arithmetic path. Issue #41 created (bug; area: Kolmogorov numerical core; severity: low; extreme input to the core routine).
- Rとの関係: no R execution; expectation follows directly from the small-x asymptotic `K(x) ~ sqrt(2π)/x * exp(-π²/(8x²))`. Existing exact-rational/mpmath fixture harness inspected.
- 検証範囲: `test/htest-core/kolmogorov.test.ts`, `src/htest/ksTest.ts` and CHANGELOG inspected. Source/IEEE-754 reasoning only; no Vitest/package runtime/R execution.


## Audit #188 — `src/htest/core/mantelhaen.ts`

- Repository HEAD: `974d8755ed5b84e78da93f66b02f7faac3535ffa`; source blob: `4b5a26bfeefa86028d47ad56711bfb92e4556b12`.
- Reviewed per-stratum hypergeometric support and density, support-offset convolution, point-mass limits at psi=0/Infinity, log-weight normalisation, mean/CDF, conditional MLE and lower/upper conditional confidence-limit root direction.
- Exact inputs inspected: `new ConvolvedNoncentralHyper([[[1,2],[3,4]],[[0,3],[2,2]]])` with `density(0)`, `density(1)`, `density(Infinity)`, `mean(1)`, `cdf(2,1,false)`; fully degenerate support example `new ConvolvedNoncentralHyper([[[2,0],[0,0]],[[1,0],[0,1]]])`. Public wrapper checks reviewed for fractional exact counts, K=1, and stratum total=1.
- Degenerate support width zero makes the conditional likelihood uninformative; current MLE branch returns 0 and interval [0, Infinity]. This may be the intended boundary convention; without confirming R's contract it is not reported as a defect.
- Rとの関係: independent exact integer-count/rational reference fixtures inspected (not executed); public R 4.5.2 fixture harness in `test/htest-basic.test.ts` inspected.
- 検証範囲: source and fixture inspection only. No Vitest/package runtime/R execution.

## Audit #189 — `src/htest/core/shapiro.ts`

- Repository HEAD: `974d8755ed5b84e78da93f66b02f7faac3535ffa`; source blob: `55a4e1f6a4c0202a553b95d9242f9018b8b2308e`.
- Reviewed n=3 exact p-value formula, n=4/5/6 coefficient-correction transition, n=11/12 p-value approximation transition, coefficient antisymmetry and sum of squares, factorised 1-W calculation, range scaling and log-tail p-value evaluation. Public wrapper `shapiroTest` in `src/htest/onewayTest.ts` enforces 3<=n<=5000, finite observations and nonconstant data.
- Exact inputs inspected: `[1,2,3]`; `[1,1,1]` (public API must reject); `[-1e308,0,1e308]` (range-overflow path); `[Number.MIN_VALUE,0,1]`; and `Array.from(swilkCoefficients(20))` as a near-W=1 stress construction. A SciPy-equivalent independent calculation suggests the factorised 1-W can be sign-sensitive at roundoff when the sample is constructed from the coefficient vector itself; this was not reproduced with rStats.js's own qnorm and JavaScript runtime, so it is recorded as a test candidate, not a confirmed defect or issue.
- Rとの関係: SciPy AS R94 reference fixture and R 4.5.2 shapiro.test fixture harness inspected (not executed).
- 検証範囲: source and fixture inspection; independent SciPy-equivalent arithmetic only for the stress candidate. No Vitest/package runtime/R execution.

## Audit #190 — `src/htest/core/simulate.ts`

- Repository HEAD: `974d8755ed5b84e78da93f66b02f7faac3535ffa`; source blob: `add88d8966ad2c2be9a3ef97b8b73c6988334055`.
- Reviewed `formatR`'s toExponential(14) to 15-significant-digit representation selection, exponent sign and two-digit padding, trailing-zero removal, ±0/NaN/±Infinity formatting, and the simulated method suffix. Caller contracts in chisqTest/fisherTest were considered; replicate count B is validated as a positive integer by callers.
- Exact inputs inspected: `formatR(1)`, `formatR(1000)`, `formatR(1000000)`, `formatR(1e21)`, `formatR(1e-7)`, `formatR(-0)`, `formatR(Infinity)`. No formatting defect affecting the caller's valid integer B contract was confirmed.
- Rとの関係: R's as.character/paste formatting contract and simulation fixture paths inspected (not executed).
- 検証範囲: source inspection only; no Vitest/package runtime/R execution.

## Audit #191 — `src/htest/core/smirnov.ts`

- Repository HEAD: `974d8755ed5b84e78da93f66b02f7faac3535ffa`; source blob: `953940adf4798082700df86998f17e9bbdd9c3e2`.
- Reviewed rolling-row lattice-path survival recurrence, first-boundary-hit counting (avoiding duplicate path counts), hypergeometric path weights, two-sided/greater/less signs, tied pooled-z change points, d-boundaries and relative fuzz, and m/n integer validation.
- Exact inputs inspected: `psmirnovUpper(0,3,4)`; `psmirnovUpper(1,3,4)`; `psmirnovUpper(0.5,3,4,{alternative:"greater"})`; `psmirnovUpper(0.5,3,4,{alternative:"less"})`; tied case `psmirnovUpper(0.5,2,2,{z:[1,1,2,3]})`; z length mismatch. The recurrence and boundary-hit interpretation were cross-checked against the exact integer path-count/brute-force test design. No new reproducible defect confirmed.
- Rとの関係: R 4.5.2 two-sample KS fixture harness in `test/htest-basic.test.ts` inspected (not executed).
- 検証範囲: source/fixture inspection only; no Vitest/package runtime/R execution.

## Audit #192 — `src/htest/dunnett.ts`

- Repository HEAD: `974d8755ed5b84e78da93f66b02f7faac3535ffa`; source blob: `6dab4df3929025515ee6e6a4c49c23f22fe9dda2`.
- Reviewed conditional Z0 integral, one-/two-sided conditional exceedance, `logPhi`, stable `log1p/expm1` evaluation of one-minus-product, narrow-interval tail subtraction, df=Infinity normal limit, finite-df log-U outer integral, stirlerr, QUADPACK ier/error gate and c=0/±Infinity endpoints. Caller contract in `multipleComparisons.ts` ensures lambda is derived from positive group sizes and df from positive residual degrees of freedom.
- Exact inputs inspected: `pDunnettUpper(0,[0.5,0.75],Infinity,false)`; `pDunnettUpper(0,[0.5,0.75],Infinity,true)`; `pDunnettUpper(Infinity,[0.5,0.75],10,false)`; `pDunnettUpper(-Infinity,[0.5,0.75],10,false)`; `pDunnettUpper(1.55,[0.5,0.75],Infinity,true)`. The core helper itself does not validate lambda/df; these are internal preconditions supplied by the public multiple-comparison API. Inner QUADPACK ier is not checked, as explicitly documented; without an observed wrong result this is not filed as a defect. No new reproducible defect confirmed.
- Rとの関係: multcomp/PMCMRplus-derived Dunnett fixture and existing independent integration tests inspected (not executed).
- 検証範囲: source/fixture inspection only; no Vitest/package runtime/R execution.


## Audit #193 — `src/htest/effectSize.ts`

- Repository HEAD: `489b31e26ff16939cef159a9de0baf0168f09738`; source blob: `2f1b77d5012396b88d1c36365045bf3c7b314e1d`.
- Reviewed Cohen's d and Hedges' g for one-/two-sample and paired designs; pooled and average SD; null mean; missing-value handling; finite-value guard; Hedges' J via `lgammaDiff`; noncentral-t inversion for confidence limits; eta/omega/epsilon squared; partial/plain/generalized eta; noncentral-F confidence limits; ANOVA Error strata and aovEz term/stratum mapping; SS scaling and observed-factor matching.
- Exact inputs inspected: `cohensD([5.1,4.9,6.2,5.8],[4.1,4.5,3.9,5.0])`; `hedgesG([1,2],[3,4])`; `cohensD([1,2,3],undefined,{ci:null})`; `cohensD([1,1,1],[2,2,2],{ci:null})` (zero SD); `cohensD([-1e308,0,1e308],undefined,{ci:null})`; `etaSquared(anova(lm("y ~ g",{y:[1,2,4,5,7,9],g:["a","a","b","b","c","c"]})),{ci:null})`; repeated-measures `aov("y ~ W + Error(id/W)", data)` path. No confirmed defect. Near-endpoint noncentral-root and zero-variance cases remain stress candidates.
- Rとの関係: R 4.5.2 effectsize fixtures for Cohen's d/Hedges' g/eta/omega/epsilon and repeated-measures strata inspected (not executed).
- 検証範囲: `test/cohensD.test.ts`, `test/etaSquared.test.ts`, `test/etaSquaredRm.test.ts` and fixture sources inspected. No Vitest/package runtime/R execution.

## Audit #194 — `src/htest/fisherTest.ts`

- Repository HEAD: `489b31e26ff16939cef159a9de0baf0168f09738`; source blob: `c90cc3b96af152c34f0a2396fad60ecda9d5d32a`.
- Reviewed 2x2 noncentral hypergeometric support/density, psi=0/Infinity point masses, lower/upper tails, minlike two-sided p-value, conditional MLE, confidence-limit root direction, rxc Mehta-Patel network pruning and path aggregation, double-double log probabilities, zero-margin removal, Patefield simulation and random-stream consumption.
- Confirmed defect: `fisher2x2` rejects `confLevel=0` and `confLevel=1` due to `confLevel > 0 && confLevel < 1`. R 4.5.2 `stats::fisher.test` accepts the closed interval [0,1] (source condition is `conf.level < 0 || conf.level > 1`). Exact inputs: `fisherTest([[1,2],[3,4]],{confLevel:0})`; `fisherTest([[1,2],[3,4]],{confLevel:1})`; both currently throw RangeError. Issue #43 created (bug; severity low).
- Additional inputs inspected: `fisherTest([[0,3],[2,0]])`; `fisherTest([[1,2,0],[3,4,0]],{simulatePValue:true,B:100})`; `fisherTest([[1,2],[3,4]],{alternative:"greater",or:Infinity})`. No other confirmed defect.
- Rとの関係: R 4.5.2 `src/library/stats/R/fisher.test.R` validation and test fixture contract inspected (not executed).
- 検証範囲: `test/fisher.test.ts`, `test/review58.test.ts`, R source and fixtures inspected. No Vitest/package runtime/R execution.

## Audit #195 — `src/htest/groups.ts`

- Repository HEAD: `489b31e26ff16939cef159a9de0baf0168f09738`; source blob: `4696e148a03c8501dfb0ac92d260327be767f50d`.
- Reviewed list-form and x/g-form grouping, pairwise NaN response/label removal, all-missing labels, empty-group drop/error behavior, numeric 15-significant-digit level collisions, label ordering, median midpoint and complete block-row shape validation.
- Confirmed defect: `labelledGroups` keys `Map<GroupLabel,...>` by original JS type, so numeric `2` and string `"2"` become separate groups although both display as `"2"`. R factor coercion converts mixed numeric/character labels to character before determining levels. Exact public reproduction: `onewayTest([1,2,10,11,20,21,30,31],[2,2,"2","2",10,10,"10","10"])`. Current code forms four groups with duplicate labels; R factor semantics form two groups ordered `"10"`, `"2"`. Issue #44 created (bug; severity medium because group membership and statistical result change).
- Additional inputs inspected: `median([-1e308,1e308])`; `median([1.7e308,1.79e308])`; `median([-Infinity,Infinity])`; list form with all-NaN groups. No additional confirmed defect.
- Rとの関係: R 4.5.2 factor coercion and ordering contract inspected (not executed).
- 検証範囲: `test/grouping.test.ts`, callers of `labelledGroups`, `src/internal/levels.ts` and `src/internal/extremes.ts` inspected. No Vitest/package runtime/R execution.

## Audit #196 — `src/htest/ksTest.ts`

- Repository HEAD: `489b31e26ff16939cef159a9de0baf0168f09738`; source blob: `b126cf4b2b6797201bb9d23c2e89421753d7ee3c`.
- Reviewed one-sample D+/D-, CDF callback range validation, ties and exact-default selection, two-sided tail cancellation avoidance, two-sample pooled ECDF tie-run endpoints, alternative direction, exact thresholds and formula dispatch.
- Exact inputs inspected: `ksTest([0,0,1],q=>q<=0?0:q>=1?1:q)`; same input with `{exact:true}`; `ksTest([1,2],[3,4],{alternative:"greater"})`; `ksTest([1,2],[1,3],{exact:true})`; invalid CDF `ksTest([1,2],q=>NaN)`; all-missing `ksTest([NaN,NaN],[1,2])`. Default one-sample exact selection correctly excludes ties. With explicit `exact:true`, R also evaluates the exact distribution path after warning that ties should not be present; no p-value algorithm discrepancy was confirmed. R emits a ties warning for the one-sample continuous-CDF case, while this API result does not expose warnings; recorded as a compatibility note, not a calculation defect.
- Rとの関係: R 4.5.2 ks.test fixture and patched documentation/source, plus SciPy 1.18.1 fixtures inspected (not executed).
- 検証範囲: `test/htest-basic.test.ts`, `test/fixtures/htest_ksTest.scipy.json`, R documentation/source inspected. No Vitest/package runtime/R execution.

## Audit #197 — `src/htest/leveneTest.ts`

- Repository HEAD: `489b31e26ff16939cef159a9de0baf0168f09738`; source blob: `8435c4cc11d3b0d9844fec9d5ca131f53b327371`.
- Reviewed median/mean centres, sorted group labels, pairwise missing removal, empty groups, absolute deviations, scale invariance and one-way ANOVA degrees of freedom/F/p.
- Exact inputs inspected: `leveneTest([4.2,5.1,6.3,5.8,7.9,8.4,6.6,7.0,5.5],["a","a","a","b","b","b","c","c","c"])`; same data with `{center:"mean"}`; missing pair `leveneTest([1,2,NaN,4,5,6],["a","a","a","b","b","b"])`; empty factor group; singleton groups; constant groups; extreme scale `[-1e308,1e308,-1e308,1e308]`; ±Infinity.
- No new confirmed defect. Zero residual df and constant deviations produce degenerate ANOVA outputs and remain boundary candidates for runtime comparison.
- Rとの関係: R 4.5.2 car::leveneTest median/mean fixtures inspected (not executed).
- 検証範囲: `test/moreTests.test.ts`, `test/fixtures/moreTests.json`, `src/htest/aov.ts`, `src/internal/summary.ts` and group helpers inspected. No Vitest/package runtime/R execution.


## Audit #198-#202

### #198 `src/htest/mantelhaenTest.ts`
- 判定: 問題未検出; —。
- 2x2xKのasymptotic/exact、Yates補正、OR/CI、conditional MLE、I×J×K covariance/solve。入力: `mantelhaenTest([[[10,5],[4,12]],[[8,6],[5,9]]])`; zero-margin stratum; total=1; exact fractional counts; structural-zero general table。R 4.5.2/SciPy fixtures閲覧。singular Vは実行比較未了で未認定。Vitest/R未実行。
- ソース blob: 669a040db7481c9aad8d0da633a4e73f333b2488。

### #199 `src/htest/mcnemarTest.ts`
- 判定: 問題あり; [#45](https://github.com/numero-uno-jpn/rStats.js/issues/45)。
- square table、2x2 correction、r>2 symmetry sum、df、discordant zero、paired crossTable/missing/levels。再現: `mcnemarTest([1,1,"1","1",2,2,"2","2"],[1,"1",1,"1",2,"2","2",2])`。number 1とstring "1"が別levelだがR factorでは文字列化され同一levelとなる。4 levels vs 2 levelsでtable/dfが変わる。重要度medium。R 4.5.2 fixtures閲覧。Vitest/R未実行。
- ソース blob: 3d702e0af51a8c81e81405c0e0422cce6e8b9bf8。

### #200 `src/htest/multipleComparisons.ts`
- 判定: 問題未検出; —。
- Dunn tie correction/adjustment、Dunnett familywise tails、Steel U rank/sign、DSCF variance、Games-Howell Welch/Satterthwaite、Tukey-Kramer、Dunn altp/stepwise ties。入力: 3群例 [1.2,2.3,1.8,2.9,3.1,3.6,4.0,4.4,5.2]; all-tied groups; two-group single-step; zero pooled SS; unequal n; tied adjusted p; extreme values。R PMCMRplus/dunn.test/multcomp fixtures閲覧。Vitest/R未実行。
- ソース blob: 2ff2f52544fd07e8d160ca7e8a785e3a8b874f8c。

### #201 `src/htest/normalityTests.ts`
- 判定: 問題あり; [#46](https://github.com/numero-uno-jpn/rStats.js/issues/46)。
- AD/CVM/Lilliefors/Shapiro-Francia/Pearsonの統計量・近似p値・df・警告境界。Pearsonで `pnorm(z)===1` のときclass=`k+1`となり、`c<=k`で観測値を除外。再現: `const x=[...Array(99).fill(0),1e6]; pearsonTest(x)`。n=100、k=13、outlier z=9.9、counts合計99。最終binに含める必要あり。重要度medium。nortest 1.0-4 source/fixtures閲覧。Vitest/R未実行。
- ソース blob: 981edc067292842d8f3b0472205a97f525bcd66b。

### #202 `src/htest/onewayTest.ts`
- 判定: 問題未検出; —。
- Classical F/Welch F、Satterthwaite df、群サイズ、zero variance、power-of-two scaling、formula interaction/missing、Shapiro-Wilk n=3/5000/5001、NaN/Inf/constant。入力: 例の3群 [2.9,3.0,2.5,2.6,3.2], [3.8,2.7,4.0,2.4], [2.8,3.4,3.7,2.2,2.0]; varEqual true/false; singleton; constant groups; [-1e308,0,1e308]; formula with two factors; shapiroTest([1,2,3])。Welch zero varianceのNaNはR比較未了で未認定。R/SciPy fixtures閲覧。Vitest/R未実行。
- ソース blob: f98a4ccac5bcdb527f738aca3479aa6eaf600a8a。


## Audit #203-#207

### #203 `src/htest/pAdjust.ts`
- 判定: 問題未検出。
- Holm/Hochberg/BH/BY/Hommelの各アルゴリズム、NaN除外と元位置復元、nによる未観測p値の扱い、BY調和数の小規模直接和/大規模漸近展開、Hommel反復を確認。入力: `pAdjust([0.01,0.02,0.03,0.04,0.05])`; `pAdjust([NaN,0.01,0.2],{method:"BY",n:5})`; `pAdjust([0.01,0.2],{method:"hommel",n:5})`; `pAdjust([0.2,0.8],{method:"hommel"})`; `pAdjust([],{method:"hommel",n:3})`。n=2 HommelはR sourceでHochbergに置換されるが、通常の有効p値では現行Hommel計算と一致する。Hommelの非整数n拒否・空pの挙動は既知仕様差。新規の再現欠陥なし。
- Rとの関係: R 4.5.2 `stats::p.adjust` source/fixtureを閲覧（未実行）。
- 検証範囲: `test/padjust.test.ts` とR sourceを閲覧。Vitest/package runtime/R未実行。

### #204 `src/htest/pairwise.ts`
- 判定: 問題あり; [#44](https://github.com/numero-uno-jpn/rStats.js/issues/44)へ同一根本原因として追記。
- `byLevel()`の混在ラベル処理で数値だけ`numberLevels()`により正規化し、文字列はそのままMap keyにするため、数値`2`と文字列`"2"`が別群となる。再現: `const x=[1,2,10,11,20,21,30,31]; const g=[2,2,"2","2",10,10,"10","10"]; pairwiseTTest(x,g)`。現行4群・重複表示ラベル、R factor coercionでは2群`"10"`,`"2"`。`pairwiseWilcoxTest()`も同じhelperを使用。群構成・比較数・補正p値が変わるため統計結果に影響。
- その他: pooled SD/df、paired positional matching、non-pooled t、Wilcoxon per-pair、proportion pair、alternative direction/lower triangle/pAdjust orderingを追跡。
- Rとの関係: R factor coercionと`pairwise.t.test` lower triangle/alternative contractを照合（未実行）。
- 検証範囲: `test/htest-basic.test.ts`、`src/htest/groups.ts`、`src/internal/levels.ts`を閲覧。Vitest/package runtime/R未実行。

### #205 `src/htest/poissonTest.ts`
- 判定: 問題未検出。
- 1標本のprobability-ordering two-sided p値、Poisson modeの整数時同率、tail search、Garwood CI、2標本のconditional binomial、rate ratio/expected countのスケーリング、overflowとzero countを確認。入力: `poissonTest(0,{T:1,r:0})`; `poissonTest(1,{T:1,r:1})`; `poissonTest([11,23],{T:[800,3011]})`; `poissonTest([0,0],{T:[1,1]})`; `poissonTest(517,{T:25.864,r:9.0104,alternative:"greater"})`; `poissonTest(1,{T:0})`。T=0はRがNaN/Infを返す一方、現行は拒否するが、`test/htest-basic.test.ts`で明示的に既知の仕様差として扱っているため新規不具合とはしない。
- Rとの関係: R 4.5.2 `stats::poisson.test` fixturesを閲覧（未実行）。
- 検証範囲: `test/htest-basic.test.ts`のSciPy/R fixtureおよびsubstitute条件、binomTest呼出しを閲覧。Vitest/package runtime/R未実行。

### #206 `src/htest/polycor.ts`
- 判定: 問題未検出。
- table/vector dispatch、ragged table、zero marginal除去、thresholds、pbvnorm、rho境界、polyserial standardisation、ML gradient/Hessian/Newton/step-halving、flat ridge boundary、inverse Hessian、chi-square/dfを追跡。入力: `polychor([[20,8,1],[5,30,9],[2,6,25]])`; `polychor([[50,0],[0,50]],{ML:true,stdErr:true})`; `polychor([[0,50],[50,0]],{stdErr:true})`; `polyserial([0.2,-1.1,0.8,1.5,-0.3,0.1,-0.9,2.0],[1,1,2,3,2,2,1,2],{ML:true,stdErr:true})`; `polychor([[3,4],[0,0]])`。極端な非有限連続値や希少カテゴリはruntime追加候補だが、現時点で再現欠陥は認定せず。
- Rとの関係: R 4.5.2 polycor/mvtnorm fixtureを閲覧。ML比較はR optimizer途中値でなくexact maximum referenceを採用（未実行）。
- 検証範囲: `test/polycor.test.ts`、`test/polycorML.test.ts`、pbvnorm境界テストを閲覧。Vitest/package runtime/R未実行。

### #207 `src/htest/power.ts`
- 判定: 問題未検出。
- exactly-one-unknown、validation、one/two/paired t df/ncp/strict tail、proportion pooled variance/strict tail、ANOVA noncentrality/df、root search、非識別パラメータを追跡。入力: `powerTTest({n:20,delta:1})`; `powerTTest({delta:0.5,power:0.8})`; `powerTTest({n:20,delta:0,strict:true})`; `powerPropTest({n:50,p1:0.5,p2:0.75})`; `powerPropTest({n:30,p1:0.9,p2:1,power:0.8,strict:true})`; `powerAnovaTest({groups:4,n:5,betweenVar:1,withinVar:3})`; `powerAnovaTest({groups:4,n:5,betweenVar:0,withinVar:3})`。Rのnoncentral pt/pf精度とuniroot root差は既存known-differenceとして区別。n/groupsを連続値で返すのはR仕様。
- Rとの関係: R 4.5.2 power.t.test/prop.test/anova.test fixtureを閲覧（未実行）。
- 検証範囲: `test/powerStats.test.ts`とoracle fixture/known differencesを閲覧。Vitest/package runtime/R未実行。

## Audit #208-#212

### #208 `src/htest/propTest.ts`
- 判定: 問題あり; [Issue #47](https://github.com/numero-uno-jpn/rStats.js/issues/47)。
- finite success/trial/failure countsの整数性検証が欠落。再現: `propTest(1.5,3.5)`; `propTest([1.5,2.5],[3.5,4.5])`; `propTest([[1.5,2],[2,2.5]])`。いずれも現在の条件(positive n, finite n, nonnegative x, x<=n)を通過するが、R prop.testはfinite countsを整数とする。テーブル形式ではfailure countは行合計からsuccessを引いた値なので、successとfailure双方の整数性確認が必要。
- その他: missing group removalとp vector位置保持、one/two/k sample df、given p、Yates correction/cap、Pearson chi-square、signed root one-sided、Wilson/Newcombe CI、two-proportion CIを確認。
- Rとの関係: R 4.5.2 stats::prop.test docs/source contractを照合。Vitest/package runtime/R未実行。

### #209 `src/htest/pwr.ts`
- 判定: 問題未検出。
- Cohen effect-size lookup、ES.h、ES.w1、ES.w2、pwr.t/t2n/2p/2p2n/p/norm/r/chisq/anova/f2を確認。各関数のexactly-one-null、入力境界、alternativeごとの効果量符号とroot interval、ncp、strict two-sided tail、root bracket、極端なncp overflowを追跡。入力: `esW1([0,0.5,0.5],[0,0.25,0.75])`; `esW1([0,1],[0.2,0.8])`; `esW2([[0.3,0.2],[0.1,0.4]])`; `pwrTTest({n:20,d:0.5})`; `pwrT2nTest({n1:20,n2:30,d:0.5})`; `pwrRTest({n:50,r:-0.3,alternative:"less"})`; `pwrRTest({n:50,power:0.8,alternative:"less"})`; `pwrChisqTest({w:0.3,N:100,df:3})`; `pwrAnovaTest({k:4,n:20,f:0.25})`。R pwr.r.testのlessは計算時rを反転し、既知rを返す際も負符号になる。現行実装と一致。新規再現欠陥なし。
- Rとの関係: CRAN pwr 1.3-0 source/docsを閲覧。Vitest/package runtime/R未実行。

### #210 `src/htest/rankTests.ts`
- 判定: 問題未検出。
- Kruskal-Wallis tie correction、Friedman within-block ranks/ties/complete rows、Cochran Q binary validation、Quade range ranks/A-B residual/all-tie special case、Fligner median deviations/rank-normal scores/variance、Mood average tied-position scores/score variance、NaN/Inf handlingを確認。入力: `kruskalTest([[2,2],[2,2]])`; `friedmanTest([[1,1,1],[2,2,2]])`; `cochranQTest([[1,1,0],[0,0,0],[1,0,1]])`; `quadeTest([[1,2,3],[2,3,1],[3,1,2]])`; `flignerTest([[0,0],[1,1],[2,2]])`; `moodTest([0,1,2],[2,1,0])`; extreme finite range (-1e308,1e308)。完全同順位などの退化ケースでNaNとなるのは分母0による数理的退化。Quadeのincomplete-row処理はRのquade.testの奇妙なbカウントと意図的に異なる仕様で、既存fixture substituteに記録済み。新規再現欠陥なし。
- Rとの関係: R 4.5.2 rank-test fixtures/source notesを閲覧。Vitest/package runtime/R未実行。

### #211 `src/htest/tTest.ts`
- 判定: 問題未検出。
- one-sample/Welch/pooled/paired、NaN pair removal、sample minima、Satterthwaite df、pooled SS、scaleToUnit/pairedDifferences、mu scaling、essentially-constant threshold、one/two-sided tails、CI endpoints、confLevel 0/1を確認。入力: `tTest([5.1,4.9,5.6,5.8,6.0,5.4],{mu:5})`; `tTest([1,2,3,4,5],[3,4,5,6,8])`; `tTest([1,2,3],[2,4,6],{paired:true})`; `tTest([1],[2,3],{varEqual:true})`; `tTest([1e-200,2e-200,3e-200])`; `tTest([1,2,3],{mu:Infinity})`。Rもmu=Infinityを拒否せず、既存fixtureでinterval NaNをknown differenceとしている。新規再現欠陥なし。
- Rとの関係: R 4.5.2 stats::t.test source/fixtureを閲覧。Vitest/package runtime/R未実行。

### #212 `src/htest/testFormula.ts`
- 判定: 問題未検出。
- splitTilde、Pair(a,b)のpaired formula、twoSampleData、kSampleData、groupFactor、oneway interaction coding、blockData complete block、correlationData selectionを確認。correlationDataはrhsVariablesが2つあるか検証するだけだが、R cor.test.formulaもmodel.frame列数が2かを確認し、model.frameは元の2変数を評価してinteractionを追加列に展開しないため、`~ x * y` / `~ x:y`も2列なら受理される。初回に作成したIssue #48はR model.frame semanticsを誤認したfalse positiveとして訂正・close済み。再現確認用: `const data={x:[1,2,3,4,5],y:[5,4,3,2,1]}; corTest("~ x * y",data)`。新規再現欠陥なし。
- Rとの関係: R 4.5.2 cor.test.formula source/docsを照合。Vitest/package runtime/R未実行。


## Audit #213-#217

### #213 `src/htest/trendTests.ts`
- 判定: 問題あり; [Issue #50](https://github.com/numero-uno-jpn/rStats.js/issues/50)。
- `propTrendTest`のweighted regression、overall pooled proportion/weights、score missing/Inf、length mismatch、constant scores、zero/all-success boundaryを確認。
- 再現: `propTrendTest([1,2,3,4],[10,10,10,10],[1,NaN,3,4])`。現行はmissing scoreを回帰計算に含めるため`sBar/fBar/sxy/sxx`がNaNとなり、statistic/pValueともNaN。R `stats::prop.trend.test`は`lm(freq ~ score)`のmodel frame既定`na.action=na.omit`で欠損score行を除外する（ただし全体のpooled pとweightsは先に全x/nから計算）。Issue #50。
- Jonckheere: JT pair count/tie=0.5、exact時のMann–Whitney distribution convolution、no-tie variance、Hollander–Wolfe tied variance、one-/two-sided direction、explicit levels、DescTools/clinfunのInf/exact-option差を確認。入力: `propTrendTest([15,10,8,4],[30,30,30,30])`; `jonckheereTest([1,2,2,3,4,5],[1,1,2,2,3,3],{alternative:"increasing"})`; `jonckheereTest([1,2,3,4],[1,1,2,2],{exact:true})`; `jonckheereTest([1,1,2,2,3,3],[1,1,2,2,3,3],{alternative:"increasing"})`。ほかに再現可能な欠陥は確認せず。
- Rとの関係: R 4.5.2 `prop.trend.test` source、DescTools JT docs/sourceを閲覧。Vitest/package runtime/R未実行。
- ソース blob: `960dfab4ddf09579c3aa4c79556695c034280a0a`。

### #214 `src/htest/types.ts`
- 判定: 問題未検出。
- `Alternative`、`Sample`、`Counts`、`HTest`の型契約、`matchAlternative`の空文字/曖昧prefix/一意prefix、closed/open confLevel validator、`isCount`の有限・非負・整数近似を確認。
- 入力: `matchAlternative("t")`; `matchAlternative("two")`; `matchAlternative("")`; `isCount(1)`; `isCount(0.00000005)`; `isCount(0.0000002)`; `checkConfLevel(0)`; `checkConfLevelOpen(0)`。count許容差1e-7は明示された絶対toleranceであり、意図的仕様。新規の再現欠陥なし。
- Rとの関係: R `match.arg`のunique partial matching、関連テストのconf.level契約を照合。Vitest/package runtime/R未実行。
- ソース blob: `2f2c91709552db7fa6820030ff2af112e1aceb81`。

### #215 `src/htest/varTest.ts`
- 判定: 問題未検出。
- F variance ratio、ratio帰無値、df、tail p-values、confidence quantiles、finite-only sample filtering、共通power-of-two scaling、formula grouping、Bartlett pooled variance/log correctionを確認。
- 入力: `varTest([1,3,2,5,4],[2,9,4,12,7,1])`; `varTest([1,1,1],[1,2,4])` (一方のvariance 0); `varTest([1,1,1],[2,2,2])` (両variance 0); `varTest([1,2,3],[4,5,6],{alternative:"greater"})`; `bartlettTest([[1,3,2,5],[2,9,4,12,7],[3,3.5,4,2]])`; singleton/empty groups。両群定数時のthrowは既存`test/review59.test.ts`で意図的に固定されている仕様差。新規再現欠陥なし。
- Rとの関係: R 4.5.2 `stats::var.test` source/docs、Bartlett formulaを照合。Vitest/package runtime/R未実行。
- ソース blob: `c7ec22cdff413f22705b5ca7462a3230405cc147`。

### #216 `src/htest/wilcoxTest.ts`
- 判定: 問題あり; [Issue #49](https://github.com/numero-uno-jpn/rStats.js/issues/49)。
- signed-rank/rank-sum statistic、exact/normal切替、tie/zero処理、continuity correction、片側/両側tail、exact Walsh averages/pair differences、normal CI root/clamping、confLevel/tolRoot、paired complete cases、Infを含む順位を確認。
- 再現: `wilcoxTest([1],[1])`; `wilcoxTest([1,1],[1,1],{exact:false})`。同値のみの2群ではrank sumのcentered statistic=0、tie-corrected variance=0となり、現行はz=0/0=NaNからpValue=NaNを返す。R `.wilcox_test_two_pval_asymp`は同条件を明示的にguardしp.value=1を返す。Issue #49。
- 追加入力: `wilcoxTest([1,2,3],[4,5,6],{exact:false})`; `wilcoxTest([1,2,3],[2,3,4],{exact:true,confInt:true})`; `wilcoxTest([1,2,3],[2,4,6],{paired:true})`; `wilcoxTest([0,0,0])`。all-zero signed-rankは既存fixtureの仕様差（現行throw、RはNaN p-value）として区別。
- Rとの関係: R `stats::wilcox.test` source/docsを照合。Vitest/package runtime/R未実行。
- ソース blob: `53d836e84e5d2626207ceda1e1615ffefc4ad6b4`。

### #217 `src/index.ts`
- 判定: 問題未検出。
- 10行の公開API barrel。special/distributions/tests/linalg/descriptive/numericsのentry moduleを再exportするだけで、数値演算・validation・data mutationなし。
- `src/entries/tests.ts`も確認し、今回対象の`wilcoxTest`、`varTest`、`bartlettTest`、`propTrendTest`、`jonckheereTest`がtests entryから公開されていることを確認。循環・欠落exportの疑いなし。
- 検証範囲: source inspection only。Vitest/package runtime/R未実行。
- ソース blob: `325df03e925e9cda87ff608af8d1d6ca071ea08d`。


## Audit #218-#222

### #218 `src/integrate/quadpack.ts`
- 判定: 問題あり; [Issue #51](https://github.com/numero-uno-jpn/rStats.js/issues/51)。
- dqk21 K21/G10 quadrature、error estimate resabs/resasc、dqk15i無限区間写像、dqelg Wynn epsilon、dqpsrt error ordering、adaptive subdivision、roundoff/divergence flags、reverse intervalを追跡。
- 再現: `integrate(x => 1/x, 1e308, 1.1e308)`。wrapperでは`upper-lower`が有限なのでdqagseの通常経路に入る。一方dqk21の`centr=0.5*(a+b)`はInfinityにoverflowし、halfwidthは約`4.999999999999998e306`で有限。全quadrature nodesがInfinityになり`1/Infinity=0`を返すため、初回ruleがresult=0、abserr=0、ier=0として終了する。正しい積分値は高精度で`0.09531017980432482`。Nodeで算術経路を再現。adaptive subdivisionの`0.5*(alist+blist)`も同じ危険を持つ。
- 既存`test/integrate/quadpack.test.ts`はSciPyの通常域fixtureでresult/abserr/neval/ier/lastを照合するが、この巨大な同符号有限境界は含まない。
- Rとの関係: R integrate docsは有限区間でadaptive Gauss–Kronrodを使うと説明。QUADPACK dqk21原典も同じ`0.5*(a+b)`を使うため上流Rにも同様の制約があるが、数学的には正しい有限積分を返さないため数値堅牢性欠陥として記録。Vitest/package integrate/R未実行。
- ソース blob: `3aef9054b78a50c5ab55ed22008db69c56535d4c`。

### #219 `src/internal/covmat.ts`
- 判定: 問題未検出。
- 空行列、非正方、各行長、NaN/±Inf、対角<=0、非対称、100ε内の近似対称、極端スケールを確認。
- 入力: `checkCovmat([[1,0.5],[0.5,1]])`; `checkCovmat([[1,0.5],[0.5000000000001,1]])`; `checkCovmat([[1,0],[0,Number.MIN_VALUE]])`; `checkCovmat([[1,0],[0,0]])`; `checkCovmat([[1,2],[2,1]])`。全値有限を検証した後、scaleToUnitで2冪スケーリングしisSymmetricを適用するため、極端な値での和のoverflow/underflowを避ける。正定値性をここで判定しないのは、このhelperの明示的な契約（square/finite/symmetric/positive diagonal）外で、呼出元が後続のfactor analysisで扱う。新規再現欠陥なし。
- Rとの関係: R isSymmetric相当の許容差とfactanal/omega covmat前処理をソースで確認。Vitest/package runtime/R未実行。
- ソース blob: `a042245164638b0c486c769de2c2a9a0eed622cd`。

### #220 `src/internal/ddexp.ts`
- 判定: 問題あり; [Issue #52](https://github.com/numero-uno-jpn/rStats.js/issues/52)、[Issue #54](https://github.com/numero-uno-jpn/rStats.js/issues/54)。
- ddExpのexp range reduction/Taylor/repeated squaringとsubnormal/overflow境界、standardizeDDのfinite difference/overflow recursion、divideTail、logRatioDD、mulDD、expNeg/expNegOver、log1mExp/logAddExp/logSubExp/logOneMinusExpNeg、locationScale/affineを確認。
- Issue #52再現: `locationScale(-1,1e308,1e-308)`。mulDDがoperand>1e300の場合にfinite productのerror termを捨て、丸め積0.9999999999999999を-1へ加えるため現行値-1.1102230246251565e-16。binary64入力のexact productは約0.9999999999999999203056889666889であり、exact sumの期待値は約-7.969431103331108e-17。約39%の相対誤差。special/dd.tsのtwoProdにはscaled residual fallbackがあるがmulDDは利用していない。
- Issue #54再現: `logAddExp(Infinity,Infinity)` は`m=Infinity`後に`Infinity-Infinity`を計算しNaN。log(e^a+e^b)の期待値はInfinity。
- Rとの関係: location-scale distributionの数値契約とlog-sum-expの恒等式から期待値を判断。Vitest/package runtime/R未実行。
- ソース blob: `bee2ddfcd5de4228f56aad0b1647690c275e78c0`。

### #221 `src/internal/discrete.ts`
- 判定: 問題あり; [Issue #53](https://github.com/numero-uno-jpn/rStats.js/issues/53)。既存の監査#106で見つかった問題を再確認し、GitHub Issueとして登録。
- discreteQuantileのlinear/log slack、upper/lower-tailの反転、pが1に近い場合の補尾比較、y0 clamp、2^53を超えるdouble spacing、CDF NaN propagation、firstTrue/lastTrueの探索を確認。
- 再現: `firstTrue(x => x >= 1.6e308,1e308,Infinity)`。指数探索中に`lo+step`がInfinityとなり、そのままInfinityを候補にして二分探索が終了するためInfinityを返す。有限閾値1.6e308が存在するため期待値は1.6e308。Node.jsで現行コードと同じ関数を実行し再現。
- `discreteQuantile`には同様のstep overflow時に`Number.MAX_VALUE`を試す処理があるが、`firstTrue`にはない。firstTrueはbinomTestのtwo-sidedPから呼ばれる。ただしこの極端な直接入力が公開binomTest経由で到達可能かは未確認で、Issueにもその制約を記載。
- Rとの関係: Rとの照合なし。内部単調predicate searchの契約とIEEE-754上限から判定。Vitest/package runtime/R未実行。
- ソース blob: `a8ed86222a9c91b7dfea90b990244a81c1170194`。

### #222 `src/internal/extremes.ts`
- 判定: 問題未検出。
- maxOf/minOfのempty/NaN/±Infinity/±0/sparse/ArrayLike semanticsと、midpointの同符号overflow・異符号極値・subnormal境界を確認。
- 入力: `maxOf([])`; `minOf([])`; `maxOf([NaN,2])`; `minOf([-0,0])`; `midpoint(Number.MAX_VALUE,Number.MAX_VALUE)`; `midpoint(-Number.MAX_VALUE,Number.MAX_VALUE)`; `midpoint(Number.MAX_VALUE,0.9*Number.MAX_VALUE)`; `midpoint(Number.MIN_VALUE,0)`。max/minはMath.max/minと同じ空配列・NaN伝播を保ち、midpointは和のoverflow時に半値和へfallbackする。新規再現欠陥なし。
- Rとの関係: Math.max/min semanticsおよびIEEE-754算術から判定。Vitest/package runtime/R未実行。
- ソース blob: `00fbd46179043e90fc6678a777fbd9b5540dd7c6`。


## Audit #223-#242

### #223 `src/internal/fround.ts`
- 判定: 問題未検出。
- half-even、負数、負のゼロ、subnormal、digits=-308/323境界、15桁早期return、zapsmallのNaN/Inf混在を確認。入力: `roundR(2.5)`; `roundR(-2.5)`; `roundR(1.25,1)`; `roundR(-1.25,1)`; `roundR(Number.MIN_VALUE,323)`; `roundR(1e308,-308)`; `zapsmall([[1e308,1e-308],[NaN,Infinity]])`。桁数丸め・二進浮動小数の候補距離・tie-even処理に再現可能な誤りなし。
- IEEE-754 binary64のroundingとR `round`/`zapsmall`の仕様記述をソース照合（実行なし）。
- ソース blob: `8e42f6ab4bc1d61fcd7687129efdc57edc942224`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #224 `src/internal/integer.ts`
- 判定: 問題未検出。
- `roundHalfEven`の±0.5/±1.5/±2.5、2^53以上の表現可能整数、`nonInt`の1e-9相対slack、NaN/±Infを確認。入力: `nonInt(2+1.1e-9)`; `nonInt(2+2e-9)`; `nonInt(2**53)`; `nonInt(Infinity)`; `nonInt(NaN)`; `roundHalfEven(-1.5)`; `roundHalfEven(2.5)`。非有限値は別途parameter validationを担う呼出元で扱われる。新規再現欠陥なし。
- Rの整数引数半整数処理と相対許容差の仕様コメントを照合（実行なし）。
- ソース blob: `007ee293d3df0d02b4a2a38cc72a2479c5a5e4f0`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #225 `src/internal/invert.ts`
- 判定: 問題未検出。
- 正値supportのu=log(x)変換、±Infinity bracket、residual符号、linearTarget/logTarget切替、Halley比率guard、stuck/converged判定、positive polish、subnormal xでのbitwise bisectionを追跡。入力例: `qgamma(1e-300,2)`相当の深い下側tail、`qgamma(1-1e-15,2)`相当の上側tail、`qbeta(3.8e-277,27.9,1.5e299)`、`qchisq(1.5e-233,6.3e234)`に対応する内部経路を確認。有限の符号反対端点で`lo+(hi-lo)/2`がoverflowする理論余地はあるが、今回追跡した公開分布のbracket遷移では誤答を再現できずIssue化せず。
- 連続分布quantileのlog-tail Newton/Halley、R quantile契約、gamma/t/beta/Fの呼出経路をソース照合（R/Vitest未実行）。
- ソース blob: `54aeaa15ec93053e2dd5fd19fc640a9fbf243a76`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #226 `src/internal/levels.ts`
- 判定: 問題未検出。
- sort→formatR→同一文字列level統合、-0正規化、NaN保持、非数値label不変、±Infの文字表記を確認。入力: `numberLevels([0.1+0.2,0.3,1e15,1e15+1,-0,0,NaN,Infinity,-Infinity])`; `levelText(1/3)`。`test/numberLevels.test.ts`は0.1+0.2/0.3、1e15/1e15+1の統合とTukeyHSD/pairwise row/col namesを固定。新規再現欠陥なし。
- R factor/as.characterの15 significant digits仕様と既存numberLevels testsを照合（実行なし）。
- ソース blob: `949b2f498a93c9c17bc50a4f2e74c1eef86a0d22`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #227 `src/internal/noncentral.ts`
- 判定: 問題未検出。
- doubleKey/keyDoubleの負数・-0・subnormal・±Inf順序、searchDoublesのfail/pass bracket、narrowQuantile、quadratureControl、kronrodAdaptiveの区間分割と停止条件を追跡。入力: `searchDoubles(1,0,2,x=>x>=1.5)`相当の境界、負側の隣接double、非心χ²の`qchisq(5.7285590455359545e-12,5.345349749112763,{ncp:1})`に対応するsteep-CDF search。kronrodAdaptiveは今回の公開呼出元では非負の有限offset区間で使用され、極端な符号反対有限端点のmidpoint overflowは到達しない。新規再現欠陥なし。
- IEEE-754 ordered-double search、非心分布quantileのbracket、Gauss-Kronrod適応積分の呼出元をソース照合（実行なし）。
- ソース blob: `0a7c75dcdcc9bcf9a4b3bbd75ed613e5c6046ad7`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #228 `src/internal/poissonMixture.ts`
- 判定: 問題未検出。
- scaled double-double mantissa/exponent、fromValue/refresh、Poisson startSearch、argmax/farEdge、lower/upper recurrence、geometric remainder bound、MAX_TERMS safety cap、log/linear tail補数を追跡。入力: `pchisq(2.0003e9,3e5,{ncp:2e9})`; `dchisq(2.0001e9,1e6,{ncp:2e9,log:true})`; `pbeta(1e-7,3,5,{ncp:2e7,logP:true})`。大きいncpでは公開呼出元がBessel/Debyeまたはintegral等へ切替える条件も確認。MAX_TERMSの上限に達した場合の一般的な完全性は安全弁の制約として残るが、現行公開経路で誤答となる再現入力は確認できず。
- 非心χ²/βのPoisson mixture定義、正項和・再帰・tail truncation boundをソースと既存回帰テストで照合（実行なし）。
- ソース blob: `f0c6a1cf85875cf87f5174c0fcc5575e31db5746`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #229 `src/internal/scaledInverse.ts`
- 判定: 問題未検出。
- upper triangleの各列max、2^-400/2^400閾値、subnormal/巨大列のexponent、inverseの`2^(-e_j-e_k)`復元側の呼出契約を確認。入力: `[[1e-200,2e-200],[0,1e-200]]`; `[[1e200,2e200],[0,1e200]]`; `[[1,2],[0,1]]`。列単位の正確な2冪スケールで逆行列を求める設計に再現可能な誤りなし。
- Cholesky標準誤差計算の列別2冪スケーリングとchol2invをソース照合（実行なし）。
- ソース blob: `49d36a1a12389587eadf8976acd76bbd90e1081d`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #230 `src/internal/seq.ts`
- 判定: 問題未検出。
- n=0/1/2/fractional、to-from overflow、同値端点、最後の端点上書きを確認。入力: `seqLength(-1e308,1e308,3)`; `seqLength(0,1,2.5)`; `seqLength(4,4,5)`; `seqLength(0,1,1)`。有限差分overflow時のhalf-coordinate branchは中間値を有限に保つ。負/NaN lengthの明示validationはないが内部生成格子の呼出元は有効な長さを与え、公開APIではないため新規不具合登録なし。
- R `seq(from,to,length.out)`のfractional lengthと両端固定仕様、内部呼出元を照合（実行なし）。
- ソース blob: `7475913bf7aaa85ca90a1a52dcf620990cd18e00`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #231 `src/internal/summary.ts`
- 判定: 問題未検出。
- wideSumのoverflow切替/再scale、meanDD補正、centered/scaleToUnit、variance/covariance、Satterthwaite df、rank/tieCounts、completePairs、squareOver/productOver、norm2を確認。入力: `sum([1e308,1e308,-1e308])`; `mean([1e308,1e308,-1e308])`; `standardDeviation([-1e308,-1e308,-1e308,-1e308,1.5e308])`; `productOver(1e-308,1e-308,1e-308)`; `norm2([1e200,1e200])`; `norm2([1e-200,1e-200])`。ldexpの非常に大きな任意指数に対する一般的な限界は確認したが、全呼出元で使う指数範囲（最大でも2*1023等）では中間overflowを再現せず。新規再現欠陥なし。
- R mean/var/cov semantics、double-double accumulatorと2冪scaleの算術をソース照合（実行なし）。
- ソース blob: `e4fc3bd652af3a00cf05b44389ddf58e590c4830`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #232 `src/internal/uniroot.ts`
- 判定: 問題未検出。
- wrapperのtol/maxIter/fLower/fUpper転送、logScaleRootのu=log(psi) bracket doubling、psi=0/Infinity端点、belowOne方向、f(1)=0、符号反転時のendpoint順を確認。入力: `logScaleRoot(psi=>psi-0.25,true)`; `logScaleRoot(psi=>psi-4,false)`; `logScaleRoot(psi=>psi-1,true)`。expのunderflow/overflow端点とrootの表現可能範囲の扱いに再現可能な不具合なし。
- R uniroot toleranceとFisher exact CI等の内部odds-ratio rootの単調性をソース照合（実行なし）。
- ソース blob: `942f40b2944b7d97354dcaa095d22a8e07f60405`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #233 `src/internal/vectorize.ts`
- 判定: 問題未検出。
- numberはscalar return、readonly number[]は通常array map、Float64Arrayはtyped-array mapを確認。入力: `2`; `[0,1,2]`; `new Float64Array([0,1,2])`; `new Float64Array([])`。empty typed array、戻り型、要素ごとのf適用に誤りなし。
- 分布関数のscalar/Array/Float64Array shape-preserving契約をソース照合（実行なし）。
- ソース blob: `c53e29599f879b9b1a643af5b588664aaf0c598a`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #234 `src/linalg/balance.ts`
- 判定: 問題未検出。
- scaled nrm2、isolated row/column permutation、ilo/ihi更新、power-of-two scalingのsfmin/sfmax guard、similarity transform、gebakのscale/逆permutationを確認。入力: `[[1,0,0],[0,2,3],[0,4,5]]`; `[[1,1e200],[1e-200,2]]`; `[[3]]`; `[]`。n=1/0とreducible matrixのindex処理、極端な有限要素のnorm overflowを検討。呼出元expm/eigenのfinite validationと合わせ、誤った固有vector復元を再現できず。
- LAPACK 3.12.0 dgebal/dgebakのpermutation/scaling手順とexpm/eigenの利用箇所を照合（実行なし）。
- ソース blob: `b0796b3365f4f23a7a02efdb05628380f85cf284`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #235 `src/linalg/basic.ts`
- 判定: 問題未検出。
- vector/matrix RHS shape、k validation、upper/lower、transposeの4経路、exact-zero diagonal、zero RHS/zero coefficient skip、crossprod symmetric mirror、dimension mismatchを確認。入力: `crossprod([[1,2],[3,4]])`; `tcrossprod([[1,2],[3,4]])`; `backsolve([[2,1],[0,4]],[4,8])`; `forwardsolve([[2,0],[1,4]],[4,10])`; `backsolve([[1e-308,0],[0,2]],[1,2])`。既存のfixtureと極端なzero/scaleのsource traceで新規再現欠陥なし。
- R crossprod/tcrossprod/backsolve/forwardsolve契約とLAPACK dtrsmのsolve順序を照合（既存test/linalg.test.tsを閲覧、実行なし）。
- ソース blob: `e2e27e6506f3f3f13c73dd6742f1048333e2b782`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #236 `src/linalg/chol.ts`
- 判定: 問題未検出。
- upper-only入力、非正pivot、NaN伝播、pivot最大対角選択、tol負値のn*eps*maxdiag、rank stop、permutation swap、chol2inv size/zero diagonal、potri triangular inverseを追跡。入力: `chol([[4,2],[2,3]])`; `chol([[1,1],[1,1]],{pivot:true})`; `chol([[1,0],[0,0]],{pivot:true})`; `chol2inv([[2,1],[0,1]])`; subnormal/巨大対角ケース。fixture外のNaN/Inf境界もコード上確認し、新規再現欠陥なし。
- LAPACK dpotf2/dpstf2/dpotriのCholesky/pivot/rank semanticsとR chol/ chol2inv契約を照合（既存test/chol.test.ts閲覧、実行なし）。
- ソース blob: `5444cb2c0f790e8a231c515dead77c069d822e3a`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #237 `src/linalg/expm.ts`
- 判定: 問題未検出。
- 0x0/1x1 special case、非有限値、Padé degree thresholds、overflowing oneNormのlog2復元、ldexp scaling、Pade13 powers、LU solve、repeated squaringの0*Inf handling、Higham08.b similarity unbalance、Taylor/Pade order validationとCGSを確認。入力: `expm([[0,1],[0,0]])`; `expm([[0,-1],[1,0]])`; `expm([[1e308,0],[0,0]])`; `expm([[0,1],[0,0]],{method:"Taylor",order:1})`。既存fixtureは6 methodのR比較を持つ。高精度極端値の新規誤答は再現できず。
- Higham 2005 scaling-and-squaring Padé係数、expm packageのTaylor/Padé variants、balancing復元をソースと既存test/expm.test.tsで照合（実行なし）。
- ソース blob: `48da1a1d5e46371cff1404092bbb4d3d24551d26`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #238 `src/linalg/kappa.ts`
- 判定: 問題あり; [#56](https://github.com/numero-uno-jpn/rStats.js/issues/56).
- kappa exact norm2のmax/min singular ratio、exact other normのnorm*solve、QR/direct LINPACK dtrco、triangular norm I、ginvのtol cutoff/SVD factor reconstructionを追跡。再現1: `const a=1.7e308; kappa([[a,a],[a,-a]],{exact:true})`。真の特異値は両方`sqrt(2)*a`で条件数1だが、svd scale-back後に両方InfinityとなりInfinity/Infinity=NaN。再現2: `ginv([[1.7e308,1.7e308],[1.7e308,-1.7e308]])`。真の逆行列は各要素±`2.941176470588235e-309`だが、d[0]=Infinityからcut=Infinityとなり全singular componentをskip、ゼロ行列を返す。既存SVD invariant testはscale 1/1e150/1e-150で、この有限入力・spectral norm overflowは未カバー。Issue #56。
- Moore-Penrose inverseの定義、2-norm condition numberの特異値比、SVDの2冪scale-backを照合（実行なし）。
- 関連依存 `src/linalg/svd.ts` も全文確認（blob `b2c4040c56db6cffd9b29f1ccf71106529b4aa46`）。ソース blob: `098014dac2578986f16d98f5935d62cc2f73b7a1`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #239 `src/linalg/lu.ts`
- 判定: 問題未検出。
- first-maximum pivot tie、rectangular L/U shape、zero pivot、subnormal pivot reciprocal fallback、P orientation、prcomp center/scale、rank truncation、tol drop、extreme scale fallbackを確認。入力: `lu([[1,2],[3,4]])`; `lu([[0,1],[2,3]])`; `lu([[1,2,3],[4,5,6]])`; `prcomp([[1,2],[2,1],[3,4],[4,3]],{rank:1})`; extreme finite scale and zero-variance columns。新規再現欠陥なし。
- LAPACK dgetrf partial pivoting、R Matrix::lu、prcompのscale/SVD/rank semanticsをソースとtest/matrix-ops.test.tsで照合（実行なし）。
- ソース blob: `457aeee39e56df3f80e654c389a245807ccad55`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #240 `src/linalg/matrix.ts`
- 判定: 問題未検出。
- toMat row-length validation、Float64Array row support、toMatOrColumn vector handling、empty array ambiguity、transpose indexing、fromMat shape、rangeExponentのsubnormal/large finite casesを確認。入力: `toMat([[1,2],[3,4]])`; `toMat([[1],[2,3]])` (ragged error); `toMat([new Float64Array([1,2]),new Float64Array([3,4])])`; `toMat([])`; `rangeExponent([Number.MIN_VALUE,0])`; `rangeExponent([1e308])`。0-row matrixが0x0に制限される仕様もコメントに明記され、shape corruptionの新規再現なし。
- matrix row-array/column-major conversion、rectangular/zero dimensions、SVD rangeExponent呼出契約をソース照合（実行なし）。
- ソース blob: `9d78a4c9ae28f2fcc55ea30b5a7297c7441f2eaf`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #241 `src/linalg/norm.ts`
- 判定: 問題未検出。
- O/1/I/F/E/M/2のcase handling、NaN propagation、Inf handling、Frobenius scale-before-square、spectral norm SVD path、empty dimensionを確認。入力: `norm([[1,-2],[3,4]])`; `norm([[1,-2],[3,4]],{type:"I"})`; `norm([[1e200,1e200]],{type:"F"})`; `norm([[1e-200,1e-200]],{type:"F"})`; `norm([[NaN,1]],{type:"F"})`; `norm([[Infinity]],{type:"2"})`; `norm([],{type:"2"})`。各normのoverflow/underflow/NaN/Inf処理に新規再現欠陥なし。
- R norm typesとLAPACK dlange/dlassq definitionsをソース照合（既存test/linalg.test.ts閲覧、実行なし）。
- ソース blob: `3ee6876b551eab0d51a0abf8b2c3a57680d54457`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

### #242 `src/linalg/ops.ts`
- 判定: 問題あり; [#55](https://github.com/numero-uno-jpn/rStats.js/issues/55).
- elementwiseのcolumn-major recycling、outer/t、diag scalar/vector/matrix overload、cbind/rbind frame handling、matrix dimensions/byrow、kronecker、seq by/lengthOut/colonを確認。再現: `diag([], {nrow:2,ncol:2})`。values=[]のまま対角構築ループで`values[i % values.length]`を参照し、i%0はNaN、空配列のNaN property indexはundefinedとなるため`[[undefined,0],[0,undefined]]`を返す。number[][]のnumeric contractを破る。R docsは追加引数ありのvectorをdiag valuesとして扱い、diagonal values are recycled/truncatedと説明。既存test/matrix-ops.test.tsのdiag fixtureは空vector/positive dimensionsを含まない。Issue #55。
- R base `diag` documentation (vector with explicit dimensions becomes diagonal matrix; values recycled/truncated)およびnumber[][] return contractを照合（R実行なし）。
- ソース blob: `29dc8503d43b50ee8a0173cf40084b87bd6d17d4`。
- 検証: ソースコード読解と静的な算術追跡。Vitest/npm package runtime/Rは実行していない。

## Audit #243-#262

### #243
- LINPACK norm downdate cancellation causes a rank decision on the wrong side of tol.
- Input: `qr([[0.3,0.3],[0,3.00000003e-8],[0,0]])`; default tol 1e-7; true residual norm 3.00000003e-8 > original norm × tol ≈3.000000000000015e-8, but current downdate gives ≈2.9988008435812903e-8 and reports rank 1; R `dqrdc2` recomputes below t=1e-6 and retains rank 2. Issue #57.
- Source blob: `e19b546d8cee1a82e90e3b5f1f8cfee2e88717c5`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #244
- Schur Hessenberg/Francis/2x2 block logic reviewed; no new reproducible defect.
- Inputs: `[[0,-1],[1,0]]`, `[[4,0.5,2],[1,3,1],[2,1,5]]`, `[[1,1e-300],[0,1]]`, `[[1e300,0],[0,-1e300]]`, zero 2x2.
- Source blob: `72838c9df6896ef921d1ec296bd5b93d4624ec4f`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #245
- SVD reduction/iteration, tall/wide, rank deficiency, nu/nv and scaling reviewed; no new defect. Existing downstream singular-value scale-back concern remains tracked in Issue #56.
- Inputs: `[[1,2,3],[2,4,6]]`, zero 3x2, `[[1e-300,0],[0,1e-300]]`, `[[1e300,0],[0,1e300]]`, `svd([[1,2],[3,4]],{nu:0,nv:0})`.
- Source blob: `b2c4040c56db6cffd9b29f1ccf71106529b4aa46`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #246
- Sequential ANOVA SS, rank/assign order, df=0, weights, scaled RSS and nested model comparison reviewed; no new defect.
- Inputs: `y=[1,2,3,4]`, `x=[[1],[2],[3],[4]]`; saturated `y=[1,2],x=[[1],[2]]`; weights `[1,0,1,1]`.
- Source blob: `fb1bf352f9106fd3e79c9d03ee40773318b4e26c`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #247
- afex aov_ez aggregation, missing cells/subjects, type II/III, GG/HF and effect sizes reviewed; no new defect.
- Inputs: id `['s1','s1','s2','s2','s3','s3','s4','s4']`, W `['a','b','a','b','a','b','a','b']`, y `[4.1,5.0,3.8,4.9,4.4,5.6,4.0,4.7]`; missing cell and duplicate observation cases.
- Source blob: `5337523c4fe1358f6b74b3a67b201406710084fa`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #248
- Error() strata QR projection, singular error design, within residual stratum and zero df reviewed; no new defect.
- Inputs: y `[4,5,6,7,8,9,5,6]`, id `['a','a','b','b','c','c','d','d']`, W `['x','y','x','y','x','y','x','y']`; 1e-200/1e200 covariate scale.
- Source blob: `b34c319610712397b87a4064057c338541027846`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #249
- car Anova type II/III hypothesis and SS logic reviewed; no new defect.
- Inputs: y `[4.2,5.1,6.3,5.8,7.9,8.4,6.6,7.0]`, A `['a','a','b','b','a','a','b','b']`, B `['p','q','p','q','p','q','p','q']`; aliased interaction/unbalanced cells.
- Source blob: `0b2fc663a6e4e933cc86fb80e7f67dcc4f84a4b8`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #250
- Double-double Householder least-squares, multiple RHS and rank/zero-column handling reviewed; no new defect.
- Inputs: columns `[[1,0,0],[0,1,0]]`, RHS `[[1,2],[3,4],[5,6]]`; zero column; residual 1e-30 and ±1e200/1e-200.
- Source blob: `fc016e33c6cedbffc9b079f7bde8a28d08cb5eb2`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #251
- DD matrix multiply/transpose/inverse/trace and Cholesky dependencies reviewed; no new defect.
- Inputs: `[[4,2],[2,3]]`; `[[1,1],[1,1+1e-30]]`; `[[1e-200,0],[0,1e200]]`; empty matrix.
- Source blob: `58a467279e72cfa863aadfcb4a23e2e5f5130bcc`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #252
- Estimability and nested column-space tests, rank0/alias and tolerance reviewed; no new defect.
- Inputs: `[[1,0],[0,0],[0,1]]` with new rows `[1,0]`, `[0,1]`, `[0,1e-8]`; nested 2x2 vs 2x3 design.
- Source blob: `01bb4704f17c7d8aed407922a94cc5457207eeba`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #253
- Formula parser/tokenizer, operator precedence and formula expansion, Error/random-effects bars reviewed; no new defect.
- Inputs: `y ~ 0 + A*B`; `y ~ A/B/C`; `y ~ (A+B)^2`; `y ~ A - A + B`; `y ~ x + Error(id/W)`; `y ~ x + (1+x|g)`.
- Source blob: `2dff14125553b5a7a41fb58339faaf03588cd2ed`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #254
- GLM IRLS, family init, missing/weights/offset, rank, separation, residuals and prediction reviewed; no new defect.
- Inputs: binomial x `[1,2,3,4,5,6]`, y `[0,0,1,0,1,1]`; weights `[1,0,1,1,1,1]`; duplicate predictor columns; all-zero weights.
- Source blob: `852ea8204a73cfc10a2807017f7a4f116e71f331`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #255
- GLM ANOVA Chisq/LRT/Rao/F/Cp, nested affine models, offsets and dispersion reviewed; no new defect.
- Inputs: binomial y `[0,0,1,0,1,1]`, x `[1,2,3,4,5,6]`; offsets all zero vs `[1,0,0,0,0,0]`; reversed and nonnested model order.
- Source blob: `f84fe8f7b86b86c5a696da60157dc8b15c3caf22`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #256
- Profile likelihood/Rao confidence intervals, bracket doubling, aliased parameters and uniroot tolerances reviewed; no new defect.
- Inputs: binomial x `[1,2,3,4,5,6]`, y `[0,0,1,0,1,1]`; parm `[0,1]`; level `0.9`; Rao; levels `1e-12` and `1-1e-12`.
- Source blob: `fc79e536f9b642a2ae860c813f0fcf45ebbdca14`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #257
- GLM family/link domains, inverse links, boundary clamps, variance/deviance/AIC and binomial counts reviewed; no new defect.
- Inputs: binomial logit eta ±1000; two-column counts `[[2,8],[8,2]]`; Poisson y `[0,1,1e308]`; Gamma y `[1e-200,1,1e200]`; power lambda `1e-320`.
- Source blob: `c6d8d8b8c47dda7ed96bef3043d90abb7c637bb5`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #258
- LM weighted/unweighted QR, alias, df=0, response/weight scaling, covariance and prediction reviewed; no new defect.
- Inputs x `[1,2,3,4,5]`, y `[2.1,3.9,6.2,7.8,10.1]`; duplicated predictors; weights `[1,0,1,1,1]`; constant response; newdata `[1e155]`.
- Source blob: `95e161942a868624c1606925bfe00a1725ccc9f0`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #259
- Lmer sparse REML/ML criterion, trust-region optimizer, theta scaling, boundary/singularity and result reconstruction reviewed; no new defect.
- Inputs y `[9.8,10.4,10.1,12.3,12.9,12.0,8.1,7.6,8.4]`, g `['a','a','a','b','b','b','c','c','c']`; exact fixed fit y `[1,2,3]`, x `[1,2,3]`; response scales 1e200/1e-200.
- Source blob: `86b47afc85f643ae904cc4c884ff8d109b3a42e2`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #260
- Lmer ANOVA type I/II/III, REML refit, nested fixed/random effects, same-data and df edge cases reviewed; no new defect.
- Inputs: `y ~ x + (1|g)` vs `y ~ x + (1+x|g)`; treatment vs sum contrasts; duplicated model names; REML/ML comparison.
- Source blob: `c4572e0357a314f8699b2e814a09585ee6c12fb4`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #261
- Lmer hypothesis matrices, type II/III contrast coding, full dummy cells, alias and Doolittle scaling reviewed; no new defect.
- Inputs: `y ~ A*B + (1|g)` unbalanced A×B; numeric predictor scales 1e-6/1e6; aliased columns; empty cells.
- Source blob: `ca9ee25511b1f8c0b6324b562d6742124e029514`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.

### #262
- Satterthwaite t/F tests, quadratic forms, RHS and joint contrast scaling reviewed; confirmed scale-invariance defect. Issue #58.
- Fixture data y `[3.1,4.0,5.2,6.8,7.1,8.3,2.2,3.5,3.9,5.9,6.1,7.4]`, x `[1,2,3,1,2,3,1,2,3,1,2,3]`, g `['a','a','a','b','b','b','c','c','c','d','d','d']`; compare contrast `[0,1]` and `[0,1e160]` for `lmer('y ~ x + (1 | g)',data)`. `quadraticForm(l,vcov)` overflows at scale 1e320, SE becomes Infinity and t statistic/df are invalid although the hypothesis is identical. Issue #58.
- Source blob: `70a682c1c77b70d30b68259b5023ce1d6295cd4d`.
- Verification: full source and relevant helper/caller paths read; existing test files inspected. Vitest, npm package runtime and R were not executed.
## Audit #263-#282

- #263 `src/models/mauchly.ts`: residual contrast subspace, QR rank/pivot order, M/X nesting, determinant and p-value correction reviewed. A suspected global-pivot defect was disproved: `qr()` uses LINPACK limited pivoting and the already independent X columns remain first in `all`. Issue #59 was closed as a false positive.
- #264-#265 `mixedDerivatives.ts` / `mixedDeviance.ts`: analytic REML/ML derivatives, Hessian blocks, sparse Cholesky, selected inverse and tangent recurrences, refinement and zero/boundary variance paths reviewed; no new reproducible defect.
- #266-#269 `mixedStructure.ts`, `modelFrame.ts`, `modelMatrix.ts`, `scaledTables.ts`: random-effects expansion, grouping/factor levels, row omission, weights, contrast coding, polynomial contrasts, rank aliases and WeakMap table storage reviewed; no new reproducible defect.
- #270 `deriv.ts`: finite-difference step construction, central differences, Richardson extrapolation, Hessian/Jacobian shape and extreme/subnormal step paths reviewed; no new reproducible defect.
- #271 `integrate.ts` and #275 `localmin.ts`: confirmed non-finite objective hang in the public `optimize()` path. Reproduction: `optimize(x => x >= 0.5 ? NaN : (x - 0.2) ** 2, 0, 1)`; initial point is approximately `0.3819660112501051`, next point `0.6180339887498949` returns NaN, and the Brent update repeats without an iteration limit. Issue #61. R's `optimize.c` wrapper maps non-finite objective values to a finite maximum before the Brent routine.
- #272-#273 `interp.ts` / `ode.ts`: approximation ties/order, Lagrange/Hermite interpolation, spline boundary/extrapolation, ODE time direction, duplicate times, state dimensions and step controls reviewed; no new reproducible defect.
- #274-#276 `lbfgsb.ts` / `localmin.ts` / `optim.ts`: L-BFGS-B active set and line search, Nelder-Mead/BFGS/CG/SANN/Brent, finite-difference gradients and stopping criteria reviewed. Equal lower/upper bounds yield zero-width finite differences, but R's bounded `fmingr` path has the same behavior; Issue #60 was closed as a false positive.
- #277-#282 `besselIK.ts`, `besselJY.ts`, `besselSeries.ts`, `beta.ts`, `choose.ts`, `constants.ts`: modified/ordinary Bessel series and asymptotics, recurrence/reflection, scaled exponent, large order, beta/log-beta, choose/factorial and constants reviewed; no new reproducible defect.
- Reproduction inputs for each file and source blob SHA are recorded in the table above. Full source and relevant helper/caller/test files were inspected. Vitest, npm package runtime and R were not executed; conclusions marked `問題未検出` are source-review findings, not proof of correctness.

## Audit #283-#292

- #283 `src/special/dd.ts`: confirmed that `prodErrScaled()` rescales with `scale2(scale2(error, ka), kb)`; when `ka` is strongly negative, the first rescale underflows before the positive `kb` is applied. Exact reproduction: `twoProd(1e-320,1e308)` returns `[9.99988867182683e-13, 0]`, while reversed operands return `[9.99988867182683e-13, 2.524354896707238e-29]`. The exact binary64 product residual is approximately `2.5243548967072378e-29` in both cases. Issue #62. `ddMul()` duplicates the fallback. Source formula reproduced with Node and residual checked using Decimal; no package test executed.
- #284 `erf.ts`: Cephes rational approximations, interval switches, erf odd symmetry, erfc negative reflection, erfcx and subnormal tails reviewed; no new defect.
- #285 `extra.ts`: incomplete gamma product/log paths, inverse-erf endpoints and subnormal probability conversion, Newton correction, and permutation falling-factorial/gamma-ratio/reflection paths reviewed; no new defect within documented finite-real input domain.
- #286 `gamma.ts`: reflection sign, sinpi range reduction, small-argument expansion, Stirling thresholds, lgammaSign and lgamma1p Taylor truncation reviewed; no new defect.
- #287 `igamAsympCoeff.ts`: all 25×25 Temme coefficients and K/N dimensions checked against the consuming `igam.ts` traversal; no new defect.
- #288 `incbet.ts`: pseries, complement cancellation, DD continued fractions, rescaling, tiny-x/subshape paths, log/linear tails and dispatch boundaries reviewed. The #62 arithmetic helper defect is tracked separately; no independent defect isolated in this file.
- #289 `incbetLargeA.ts`: J/H expansion region, gamma-scaled CF, coefficient recurrence, truncation and log fallback reviewed; no new defect.
- #290 `incbetPrefactor.ts`: small/huge shape prefactor formulas, gamma-ratio approximation, log1m and large-product scaling reviewed; no new defect.
- #291 `incbetTemme.ts`: uniform expansion variable transformation, generated Taylor coefficients, central/tail switch, shape-sum overflow scaling and recurrence truncation reviewed; no new defect.
- #292 `lgammaDiff.ts`: recurrence to B>15, DD leading term and Stirling-difference series reviewed with actual caller constraints; no new independently reproducible defect.
- Existing tests inspected: `test/special.test.ts`, `test/erf.test.ts`, `test/gamma.test.ts`, `test/beta.test.ts`, `test/specialextra.test.ts`, plus `src/distributions/beta.ts`, `src/special/loader.ts`, `src/special/igam.ts` and `src/entries/special.ts`. Vitest, npm package runtime and R were not executed. The #62 arithmetic reproduction is a direct reproduction of the source expressions, not a package build/test run.
- Repository HEAD at audit: `95aea403db4f89e3b7008b50ac25f320ad5d3bd7`.

## Audit #293-#298

- #293 `src/special/log1p.ts`: public wrappers and internal kernels for log1pmx/lgamma1p/log1mexp/log1pexp reviewed; special values, poles, subnormal arguments and switching thresholds -37/18/33.3 checked; no new reproducible defect.
- #294 `src/special/log1pmx.ts`: xsf/Cephes alternating series, 500-term cap, relative stopping condition and direct log1p subtraction region reviewed. At x=0 the strict relative stopping test does not terminate early and performs the bounded remaining iterations, but returns 0; no functional defect.
- #295 `src/special/ndtri.ts`: ndtri and ndtriExp probability-domain checks, central/tail approximation regions, subnormal probabilities, upper-tail complement and overflow-safe log-probability path reviewed; no new reproducible defect.
- #296 `src/special/polevl.ts`: Horner and monic Horner coefficient order reviewed against all call sites. All actual coefficient arrays are fixed and nonempty; empty-array behavior is outside the helper's internal call contract; no reachable defect.
- #297 `src/special/psigamma.ts`: digamma/trigamma/polygamma reflection, cotangent derivative recurrence, Hurwitz-zeta Euler–Maclaurin scaling, negative-root Taylor series, derivative order rounding/limits and pole/infinity behavior reviewed against R and mpmath fixture source; no new reproducible defect.
- #298 `src/special/rCompatible.ts`: shared optional type and all observed consumers' default-true/false branches reviewed; no runtime logic and no independent defect.
- Existing tests/fixtures inspected: `test/log1p.test.ts`, `test/psigamma.test.ts`, `test/fixtures/log1pexp.json`, `test/fixtures/log1pmx.json`, `test/fixtures/psigamma.json`, `test/fixtures/psigamma.mpmath.json`, `test/fixtures/psigamma.ref.json`, `test/fixtures/psigamma_large.mpmath.json`, `test/special.test.ts`, and `test/erf.test.ts`. Full source for the six audited files and relevant helper/caller files was read. Vitest, npm package runtime and R were not executed; conclusions are source-review findings, not proof of correctness.
- Repository HEAD at audit: `54cafd8bb48ca0029a6babf010b86ee936a4f410`.

## Audit #299-#308

- #299 `src/descriptive/basic.ts`: all summary functions and numerical helpers reviewed for empty/NaN/Inf/±0/subnormal/overflow and option boundaries; no new reproducible defect.
- #300 `src/distributions/gamma.ts`: density/CDF/quantile, rate-scale normalization, tiny standardized arguments, shape endpoints and inversion branches reviewed; no new defect. The documented `pgamma(Inf, shape, rate)` case where reciprocal rate overflows is an intentional endpoint divergence from R.
- #301 `src/distributions/hypergeometric.ts`: support, integer rounding, binomial limit, Loader PMF, direct-tail recurrence, truncation bound and discrete quantile search reviewed. No independent defect reproduced. Residual question: `dhyper1` lacks the explicit 2^53 support guard used by CDF/quantile; huge-count density needs executable verification before defect classification.
- #302 `src/distributions/invgamma.ts`: reciprocal gamma transform, double-double beta/x, tiny/huge ratio, log-density correction, tail inversion, quantile reciprocal and alpha=Infinity endpoints reviewed against fixtures; no new defect.
- #303 `src/distributions/kumaraswamy.ts`: x=0/1 density limits, a=Infinity point-mass limit, subnormal a log x and x^a, expm1/log1p tails, tiny b and inverse quantile correction reviewed; no new defect.
- #304 `src/distributions/laplace.ts`: finite/infinite location, sigma validation, standardization overflow, 2*sigma overflow, subnormal exponential division, complementary tails and quantile scaling reviewed; no new defect.
- #305 `src/distributions/logistic.ts`: location/scale endpoints, standardization overflow, subnormal density, logit central/tail branches, tail reflection and zero-scale quantile limit reviewed; no new defect.
- #306 `src/distributions/lognormal.ts`: x<=0, sdlog=0/Inf, nonfinite parameters, double-double z and z²/2, subnormal density, normal tails and refined quantile exponent reviewed; no new defect.
- #307 `src/distributions/nbeta.ts`: confirmed Issue #63. For `pbeta(0.5, 100000000000000, 2, {ncp: Number.MIN_VALUE})`, `mu=ncp/2` underflows to 0; `leftTailLog` forms `log(mu)=-Infinity`, then j=0 gives `0 * -Infinity = NaN`, which propagates to the CDF. The noncentral F path reuses `pnbetaRaw` and is exposed to the same failure. GitHub Issue #63 created.
- #308 `src/distributions/nchisq.ts`: df=0 atom, ncp=0/positive subnormal/Inf, x=0/±Inf/subnormal half, Poisson-mixture mu=0, Bessel asymptotic switches, Chernoff bounds, numerical tails and quantile search reviewed. Shared `poissonMixture` explicitly handles mu=0 at j=0; no analogous #63 failure found.
- Existing tests/fixtures inspected: descriptive R basic fixture; gamma R/mpmath fixtures and `test/gamma.test.ts`; hypergeometric R/mpmath fixtures and `test/hyper.test.ts`; inverse-gamma, Kumaraswamy, Laplace, logistic and lognormal R/mpmath fixtures; `test/nbeta.test.ts` and noncentral-beta mpmath fixtures; `test/nchisq.test.ts` and large-tail mpmath fixtures. Shared helpers `summary.ts`, `extremes.ts`, `integer.ts`, `ddexp.ts`, `poissonMixture.ts`, `noncentral.ts`, `igam.ts`, `igami.ts`, and `invert.ts` were inspected. Vitest, npm package runtime and R were not executed; #63 is a deterministic source-level control-flow reproduction, not a package test run.
- Repository HEAD at audit: `eebf3713b3c7a15dbb14d69e181d8032eed0c1db`.

## Audit #309-#310

- #309 `src/internal/poissonMixture.ts`: re-audited the start-index search and all integer-index walks, especially when the Poisson mean exceeds the exact-integer range of binary64. Confirmed a non-terminating lower-tail walk for a finite public input via the noncentral chi-square caller: `pchisq(9e-301, 1, {ncp: 1e308, lowerTail: true})`. `mu=5e307`; the selected start index is above 2^53, and decrementing the Number index by 1 cannot change it. GitHub Issue #64 created. Shared helper also serves noncentral beta/F, which should be checked for matching reachability.
- #310 `src/distributions/nchisq.ts`: traced parameter validation, asymptotic-method thresholds, subnormal handling, smaller-tail choice and the exact public route into #309. The chosen Bessel argument is approximately 9486.83, below the strict 1e4 Hankel threshold; df=1 does not select Debye; x is normal and does not enter `subnormalHalf`. No package/Vitest execution; finding is source-level control-flow analysis.

## Audit #311-#312

- #311 `src/special/igam.ts`: re-audited the complete regularized incomplete-gamma implementation and gamma-distribution callers. Checked endpoint/invalid parameters, x≫a, subnormal a/x, the 1e-300 small-shape upper-tail scaling, series and double-double series, continued-fraction/Lentz switch, Temme regions and far-tail log/linear reconstruction against existing R/mpmath fixture sources. No new independent reproducible defect isolated. Runtime tests were not executed.
- #312 `src/special/igami.ts`: re-audited DiDonato–Morris initial approximations and their qgamma caller, including shape below 1, gamma(shape) overflow, tiny shape/quantile paths, upper-tail probabilities, large shape and Newton correction. The tiny-quantile shortcut intercepts the tested subnormal-shape cases before `findInverseGamma`; no new independent reproducible defect isolated. Runtime tests were not executed.
- Repository HEAD at audit: `67a00c16f6a8e8fdb65f21b0933cad9cefa46d3a`.


## Audit #313-#314

- #313 `src/distributions/nbeta.ts`: re-audited noncentral-beta density/CDF/quantile, Poisson-mixture dispatch, the small-λ `leftTailLog` branch, extreme-parameter method selection (`chisq`/`gamma`/`w`/`integral`), log-domain integration, endpoint densities, quantile representability and noncentral-F shared kernels. No new independent reproducible defect isolated. Specifically checked Issue #64 reachability: for μ = ncp/2 > 1e6, `method()` selects `integral` (or an earlier extreme method), so `pnbetaRaw`/density do not enter the vulnerable Poisson-mixture walk at the huge-μ scale. The μ <= 1e6 mixture path stays far below 2^53. Issue #63 remains the separately tracked tiny-ncp/leftTailLog NaN. Inputs reviewed include `pbeta(0.5, 1e14, 2, {ncp: Number.MIN_VALUE})`, `pbeta(1e-7, 3, 5, {ncp: 2e7, logP: true})`, `pbeta(1 - 1e-8, 1, 2, {ncp: 2e9})`, and `qbeta(5.3577955561017315e-43, 79.32204890240992, 0.09403994879604119, {ncp: 1.245630132105305e22})`.
- #314 `src/distributions/f.ts`: re-audited central F density/CDF/quantile and its noncentral-F delegation, ratio formation `fRatios`/`pfTiny`, df and x endpoints, infinite-df limits, tiny/huge products, log-tail reconstruction, quantile start/bounds and Chernoff-bound grid. No new independent reproducible defect isolated. Noncentral F's Poisson-mixture reachability is controlled by the `nbeta.ts` method dispatch recorded in #313; huge ncp uses an extreme method rather than the vulnerable large-index mixture. Inputs reviewed include `pf(1e-300, 1, 1)`, `pf(1e301, 1.4e-312, 6.72, {lowerTail: false})`, `pf(5.593801445714649e262, 1.4473324108589433e61, 2, {ncp: 20.019724110171456, lowerTail: false, logP: true})`, and `qf(9.423429403249297e-250, 1.8411616538629063, 3.908407098865747e188, {ncp: 198.72404032716406, lowerTail: false})`.
- Existing tests/fixtures inspected: `test/nbeta.test.ts`, `test/nf.test.ts`, `test/fixtures/dnbeta.ref.json`, `pnbeta.ref.json`, `dnf.json`, `dnf.ref.json`, `pnf.json`, `pnf.ref.json`, `qnf.json`, `df.json`, `pf.json`, `pf.ref.json`, and `test/fixtures/audit_pf.mpmath.json`. Full source for both audited files and their shared helpers was read. Vitest, npm package runtime and R were not executed; conclusions are source-review findings, not proof of correctness.
- Source blobs: `nbeta.ts` `5c51760f6e136b80a77b4284da39c25b0ab8ed86`; `f.ts` `094283354cd63404a50217cab344a676004f66d5`; tests `nbeta.test.ts` `b92e2218f99be7492e9a1cc620acde52808ce070`; `nf.test.ts` `1ccbb8948196fbef5e66e7ec405e17b5be187378`.
- Repository HEAD at audit: `af9204da5d1c77656a12329ba94a6132ae54d044`.


## Audit #315-#316

- #315 `src/distributions/poisson.ts`: re-audited PMF/CDF/quantile endpoints, lambda = 0/Inf, negative/nonfinite x and q, R-compatible near-integer tolerance, Loader PMF, incomplete-gamma tail mapping, the beyond-2^53 CDF correction, log-difference fallback, Cornish-Fisher start and discrete quantile search. No new independent reproducible defect isolated. Concrete inputs reviewed include `dpois(0, Number.MIN_VALUE, {log: true})`, `ppois(1e16, 1e16)`, `ppois(1e16, 1e16, {lowerTail: false, logP: true})`, `qpois(0.5, 1e16)`, and `qpois(1e-300, 1e10)`.
- #316 `src/distributions/negbinomial.ts`: confirmed Issue #65. For finite, valid inputs `dnbinom(1e308, 1e308, {prob: 0.5})` (also `{mu: 1e308}`), `dnbinomRaw` returns NaN at the explicit `!Number.isFinite(size + x)` guard although the PMF is finite: Stirling/local-CLT gives approximately `2.820947917738736e-155` (log approximately `-355.8636164445677`). Issue #65 created. Also reviewed size/prob/mu endpoint ordering, size+mu overflow-safe ratio formation, tiny size and subnormal prefactors, x beyond 2^53, upper positive-term series and its cap/fallback, CDF beta mapping, quantile Cornish-Fisher/gamma start, Newton/secant refinement and discrete search. No additional independent defect isolated.
- Existing tests/fixtures inspected: `test/nbinom.test.ts`, `test/fixtures/dpois.json`, `ppois.json`, `qpois.json`, `audit_dpois.mpmath.json`, `audit_ppois.mpmath.json`, `dnbinom.json`, `dnbinom.ref.json`, `dnbinom_mu.json`, `dnbinom_mu.ref.json`, `pnbinom.json`, `pnbinom.ref.json`, `pnbinom_mu.json`, `pnbinom_mu.ref.json`, `qnbinom.json`, `qnbinom_mu.json`, `audit_dnbinom.mpmath.json`, and `audit_pnbinom.mpmath.json`. Full source for both audited files and relevant helpers `discrete.ts`, `integer.ts`, `loader.ts`, `igam.ts`, `incbet.ts`, and `incbetPrefactor.ts` was inspected. Vitest, npm package runtime and R were not executed; Issue #65 is a source-level path finding plus asymptotic reference, not a package test run.
- Source blobs: `poisson.ts` `8bac99d8cfb238c1d682278c145798d0c44abc0b`; `negbinomial.ts` `6bf9bf9b9d8b05aa4828e33c4b2fb9b3ed5171c7`; `nbinom.test.ts` `96d62d49501ff17f0145ed0acae2926dd808285e`; `dpois.json` `aac4e73e2db95ae965c04920bb16167f0e3c4807`; `ppois.json` `f09d6bd9a55931be1b41207f9b9c00beb9cfd38d`; `qpois.json` `7306d8d031c6afd01b22de1a731c660115a78d3c`.
- Repository HEAD at audit: `1d1634cd344278239a3ed30794de4730e496e808`.


## Audit #317-#319

- #317 `src/distributions/arcsine.ts`: reviewed support/parameter validation, endpoint singularities, overflow-safe interval halving, density log from exact differences, near-end CDF tails and log probabilities, mirrored upper-half calculation, tiny probabilities and quantile reconstruction. Checked intervals spanning opposite-sign near-maximum doubles and subnormal endpoint distances. No new independent reproducible defect isolated. Inputs include `darcsine(0, {a: -1e308, b: 1e308})`, `parcsine(0, {a: -1e308, b: 1e308})`, `qarcsine(0.5, {a: -1e308, b: 1e308})`, `parcsine(Number.MIN_VALUE, {a: 0, b: 1})`, and `qarcsine(1e-208, {a: 0, b: 2.6e187})`.
- #318 `src/distributions/triangular.ts`: reviewed endpoint modes c=a/b, mode and support boundaries, density near mode and endpoints, subnormal ratios/log tails, far-tail positive decomposition, overflowed interval halving, midpoint defaults and inverse-CDF branches on both sides of the mode. No new independent reproducible defect isolated. Inputs include `dtriang(0, {a: 0, b: 1, c: 0})`, `dtriang(1, {a: 0, b: 1, c: 1})`, `ptriang(3.1e-190, {a: 0, b: 1.24e133, c: 5.58e132, logP: true})`, `qtriang(1.6e-8, {a: 0, b: 1.03e-316, c: 8.7e-317, lowerTail: false})`, and `ptriang(0, {a: -1e308, b: 1e308, c: 0})`.
- #319 `src/distributions/uniform.ts`: reviewed finite-bound validation, degenerate intervals, endpoints, overflow-safe width scaling, direct near-tail ratio, log probabilities, and inverse-CDF formulas for both interval signs and extreme probabilities. No new independent reproducible defect isolated. Inputs include `dunif(0, {min: -1e308, max: 1e308})`, `punif(0, {min: -1e308, max: 1e308})`, `qunif(0.5, {min: -1e308, max: 1e308})`, `punif(Number.MIN_VALUE, {min: 0, max: 1, lowerTail: false, logP: true})`, and `qunif(-745, {min: -1e308, max: 1e308, logP: true})`.
- Existing tests/fixtures inspected: `test/extradist.test.ts`, `darcsine.json`, `darcsine.mpmath.json`, `darcsine_regions.mpmath.json`, `parcsine.json`, `parcsine.mpmath.json`, `parcsine_regions.mpmath.json`, `qarcsine.json`, `qarcsine_regions.mpmath.json`, `dtriang.json`, `dtriang.mpmath.json`, `ptriang.json`, `ptriang.mpmath.json`, `qtriang.json`, `dunif.json`, `punif.json`, and `qunif.json`. Full source and relevant helpers `dpq.ts`, `extremes.ts`, `beta.ts`, and `dd.ts` were inspected. Vitest, npm package runtime and R were not executed; conclusions are source-review findings, not proof of correctness.
- Source blobs: `arcsine.ts` `907b0a4b3b55ca8f4b21325dca7de651fb8f420b`; `triangular.ts` `1cfca6585cf8bad66c282af3b6973fbb8086f288`; `uniform.ts` `62834a501bf92c899d79f98336b2b91a8cda1458`; `extradist.test.ts` `5332cb6b990488de0b1c2ffc6d16d57bb17706fc`.
- Repository HEAD at audit: `58fbcbbb2911ffb6eb43953f29b68ffd6972711c`.


## Audit #320-#321

- #320 `src/distributions/binomial.ts`: reviewed parameter validation and R-compatible endpoint order, integer tolerance/rounding, size = Inf special case, exact double-double p/q complements, Loader PMF, incomplete-beta CDF and beyond-2^53 correction, upper-tail subtraction fallback, Cornish-Fisher quantile start and discrete search. Checked noninteger size, p=0/1, q outside support, q near 2^53, very large n, and subnormal p/(1-p). No new independent reproducible defect isolated. Inputs include `dbinom(0, 1e308, 0.5)`, `pbinom(1e16, 2e16, 0.5)`, `pbinom(1e16, 1e16, 0.5, {lowerTail: false, logP: true})`, `qbinom(0.5, 1e16, 0.5)`, and `qbinom(0.999999999999, 1e6, Number.MIN_VALUE)`.
- #321 `src/distributions/geometric.ts`: reviewed p/q validation, support and endpoint handling, double-double p/q complements, Loader PMF, large-count `qPow` scaling at n >= 1e290, subnormal success probability, CDF via `expm1/log1mExp`, closed-form quantile and tie/slack handling near CDF jumps. No new independent reproducible defect isolated. Inputs include `dgeom(1e290, 5e-324, {log: true})`, `pgeom(8.7e299, 1.1e-300)`, `qgeom(0.7500000000000866, 0.5)`, `qgeom(0.9999999999, 1e-10)`, and `pgeom(Number.MAX_VALUE, 0.5, {lowerTail: false, logP: true})`.
- Existing tests/fixtures inspected: `test/nbinom.test.ts` (geometric suites), `dbinom.json`, `dbinom.ref.json`, `audit_dbinom.mpmath.json`, `pbinom.json`, `pbinom.ref.json`, `pbinomLargeN.json`, `pbinomLargeN.ref.json`, `audit_pbinom.mpmath.json`, `audit_pbinom_large.mpmath.json`, `qbinom.json`, `auditq_qbinom.mpmath.json`, `dgeom.json`, `dgeom.ref.json`, `pgeom.json`, `pgeom.ref.json`, and `qgeom.json`. Full source and helpers `integer.ts`, `discrete.ts`, `dpq.ts`, `loader.ts`, `incbet.ts`, `ddexp.ts`, and `dd.ts` were inspected. Vitest, npm package runtime and R were not executed; conclusions are source-review findings, not proof of correctness.
- Source blobs: `binomial.ts` `2f90ac1e001443b0704f33e76585cb2868497724`; `geometric.ts` `dfde963375d347292c88306f151aaa3a8a66612b`; `nbinom.test.ts` `96d62d49501ff17f0145ed0acae2926dd808285e`.
- Repository HEAD at audit: `b4106cdc2136610f9153eb5ec5ef39aa5b709f5f`.


## Audit #322-#324

- #322 `src/distributions/normal.ts`: reviewed density, CDF and quantile parameter/end-point behavior; standardization and affine overflow paths; sd = 0/Inf; infinite observations/means; erfcx-based tails; split exponential for large z; subnormal sd density; log-probability inverse normal and Newton refinement beyond log p = -2048. No new independent reproducible defect isolated. Inputs include `dnorm(4.85e-319, {sd: 1.7e-322})`, `dnorm(1e-10, {sd: 5e-324})`, `pnorm(-40, {logP: true})`, `pnorm(1e308, {mean: -1e308, sd: 1e308, lowerTail: false, logP: true})`, and `qnorm(-1e5, {logP: true})`.
- #323 `src/distributions/cauchy.ts`: reviewed density/CDF/quantile, finite difference overflow, tiny/infinite scale, scaled subnormal density, reciprocal-tail evaluation, tiny-probability quantile, log-probability quarter exponentiation and location-scale reconstruction. No new independent reproducible defect isolated. Inputs include `dcauchy(1.79e308, {location: -1.1e307, scale: 2.7e296})`, `pcauchy(1.79e308, {location: -1.1e307, scale: 2.7e296, lowerTail: false})`, `dcauchy(1e-10, {scale: 5e-324})`, `qcauchy(1e-208, {scale: 2.6e187})`, and `qcauchy(-1e5, {logP: true, scale: 5e-324})`.
- #324 `src/distributions/exponential.ts`: reviewed rate = 0/Inf/negative, x = 0/Inf/negative, product rate*x in double-double, subnormal exponential recovery when rate restores density, lower-tail expm1/log1mexp and inverse quantile in log-probability scale. No new independent reproducible defect isolated. Inputs include `dexp(2.5e-294, {rate: 3e296})`, `dexp(Number.MIN_VALUE, {rate: Number.MAX_VALUE, log: true})`, `pexp(Number.MIN_VALUE, {rate: Number.MIN_VALUE, lowerTail: false, logP: true})`, and `qexp(-720.6, {rate: 7.4e-258, logP: true})`.
- Existing tests/fixtures inspected: `test/pnorm.test.ts`, `test/qnorm.test.ts`, `test/locationScaleExtremes.test.ts`, `dnorm.json`, `pnorm.json`, `qnorm.json`, `audit_pnorm.mpmath.json`, `auditq_qnorm.mpmath.json`, `dcauchy.json`, `pcauchy.json`, `qcauchy.json`, `dexp.json`, `pexp.json`, and `qexp.json`. Full source and helpers `ddexp.ts`, `erf.ts`, and `ndtri.ts` were inspected. Vitest, npm package runtime and R were not executed; conclusions are source-review findings, not proof of correctness.
- Source blobs: `normal.ts` `9980fecf2366042da09273ba8c86de07d34dcaa3`; `cauchy.ts` `6cb203fa576c3a71798c554feef638f69f08a2c5`; `exponential.ts` `5370e52ae3428099245fb643c7721cbb7a748b3c`.
- Repository HEAD at audit: `e2c6995b4766e274aaf2c9bf597205964ef8765f`.


## Audit #325-#326

- #325 `src/distributions/weibull.ts`: reviewed shape/scale validation, zero and infinite endpoints, shape/scale infinity formula paths, double-double log(x/scale), exponentiation of shape log-ratio, density exponent and subnormal recovery, lower/upper tails, log-CDF when t is tiny, and inverse quantiles including lower-tail log probabilities below the normal range. No new independent reproducible defect isolated. Inputs include `dweibull(1.9e-255, 6.6e306, {scale: 98.6, log: true})`, `dweibull(0, 0.5, {scale: Infinity})`, `pweibull(1e-5, 1000, {logP: true})`, `qweibull(-720.6, 1, {scale: 1.36e257, logP: true})`, and `qweibull(-720.6, 1, {scale: 1.36e-257, logP: true})`.
- #326 `src/distributions/pareto.ts`: reviewed support and shape-Infinity point-mass limit, x=b/Inf endpoints, overflow/underflow-safe x/b ratio, DD log ratio, power-vs-log switch, density exponent cancellation, subnormal shape lower-tail log, upper-tail probability and quantile reconstruction when exp overflows but scale restores a finite answer. No new independent reproducible defect isolated. Inputs include `dpareto(1.1e-263, 1640, 7.8e-264, {log: true})`, `ppareto(318.7, {a: 1.04e-317, logP: true})`, `ppareto(1e308, {a: 1e308, b: 1e-300, lowerTail: false, logP: true})`, and `qpareto(1 - 1e-16, {a: 1e-308, b: 1e-300})`.
- Existing tests/fixtures inspected: `test/extradist.test.ts`, `dweibull.json`, `dweibull.ref.json`, `pweibull.json`, `pweibull.ref.json`, `qweibull.json`, `dpareto.json`, `dpareto.mpmath.json`, `ppareto.json`, `ppareto.mpmath.json`, and `qpareto.json`. Full source and helpers `ddexp.ts`, `dd.ts`, and `dpq.ts` were inspected. Vitest, npm package runtime and R were not executed; conclusions are source-review findings, not proof of correctness.
- Source blobs: `weibull.ts` `f1c3e76bce8a68f936169e4a2e261b13e937b047`; `pareto.ts` `fe44325a34f8ba48a1a8f1e6069852825310bf03`; `extradist.test.ts` `5332cb6b990488de0b1c2ffc6d16d57bb17706fc`.
- Repository HEAD at audit: `57c14a8fe55d2937e9cf992acd82e95f47d71ccd`.

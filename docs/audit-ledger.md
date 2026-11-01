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
- `監査回` と `SHA` は、その行の状態を最後に判断した監査回と、その時点の repository HEAD SHA を記録する。
- `未監査` の行は監査回・SHAを `—` とする。
- `問題未検出` はソース確認だけ、または限定的な検証で問題が見つからなかった場合に使う。`問題なし確認済` は具体的な検証範囲と根拠が記録されている場合に限る。
- 同じ根本原因から生じる複数の症状は、同一 Issue にまとめる。
- Issue には領域ラベル・重要度ラベルを付け、再現入力、期待値の根拠、Rとの関係、検証範囲を記録する。
- 監査台帳にも `Rとの関係` と `期待値の根拠・検証範囲` を必須列として設ける。未監査ファイルは `—` とする。

## Bootstrap note

この台帳は監査 #94 で新規作成した。過去の監査 #69〜#93 の会話上の要約は存在するが、全ファイルへの対応付けと各回の repository SHA を裏付ける記録が現在の台帳・会話情報から復元できない。そのため、過去監査を実施済みと推定して状態を付けず、ファイル単位の再照合が済むまでは `未監査` とした。過去監査を再確認した際に、根拠と SHA が特定できた行から状態を移行する。

## Source files

| ファイル | 状態 | 監査回 | Repository HEAD SHA | Issue | Rとの関係 | 期待値の根拠・検証範囲 |
|---|---|---:|---|---|
| `src/api-reference.ts` | 問題未検出 | #153 | `1e94b1e295f5a57aeb02a43e029117a9d67b0282` | — | 該当なし（Typedoc用のexport barrel。統計関数ではない） | 5行のexport宣言のみを確認。`index.js` と `entries/mixed.js` の再export、build対象外の設定コメントを確認。アルゴリズム・数値演算・入力処理は存在しない。機能的な不具合は認めず。 |
| `src/data/grouping.ts` | 問題あり | #154 | `1e94b1e295f5a57aeb02a43e029117a9d67b0282` | [#35](https://github.com/numero-uno-jpn/rStats.js/issues/35) | R 4.5.2由来のtapply/split/aggregate fixtureを閲覧（未実行）。`__proto__` はRとの直接照合ではなくJS object property semantics | factor levelsの15桁同一化・型混在拒否・欠損ラベル・column-major cross-classification・空cell、tapplyのscalar/non-scalar結果、splitのdrop/separator衝突、aggregate formulaの`.`/cbind/演算子展開、NA除外、複数値funの列展開を追跡。通常例: `tapply([1,2,3,4],["b","a","b","a"],v=>v.length)`、`split([1,2,3],["b","a","b"])`、`aggregate("y ~ g",{y:[1,2,3,4],g:["b","a","b","a"]},v=>v.reduce((a,b)=>a+b,0))`。確認した不具合: data-frame formのaggregateで `by` の列名 `__proto__` が `out[name]=...` により own propertyとして生成されずprototype setterに消費される。Issue #35。さらに巨大なcross productは`size`が配列上限を超えた場合にnative RangeErrorとなるが、独立した欠陥とはせず。fixture/test source閲覧、実行なし。 |
| `src/descriptive/basic.ts` | 一部監査・問題未検出 | #155 | `1e94b1e295f5a57aeb02a43e029117a9d67b0282` | — | R 4.5.2由来descriptive fixturesを閲覧（未実行）。文書化された数値安定化差異は既知仕様として区別 | sum/prod/mean(trim)/weightedMean/variance/sd/median/range/cumsum/cumprod/cummax/cummin/diffを追跡。naRm、空配列、NaN/±Inf、±0、subnormal、巨大値と小さいspread、積のmantissa/exponent分離、累積演算後のoverflowからの回復、trim境界、lag/differences整数条件を確認。具体入力: `sum([1e308,1e308,-1e308])`、`prod([1e308,1e-308])`、`weightedMean([1e308,-1e308],[1,1])`、`median([-Number.MAX_VALUE,Number.MAX_VALUE])`、`sd([1e-200,-1e-200])`、`cumsum([1e308,1e308,-1e308])`、`cumprod([1e308,1e308,1e-308])`、`diff([Number.MAX_VALUE,-Number.MAX_VALUE])`。`test/descriptive.test.ts` のR fixture suitesと既知差異除外条件を閲覧。ソース上で新規の再現不具合は確定せず。Vitest/package runtime/R実行なし。 |
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
| `src/distributions/gamma.ts` | 一部監査・問題未検出 | #120 | `e9ba1c35ef88e77e84a392562bb7f62378fcbf7f` | — | R 4.5.2 qgamma fixtureを閲覧（未実行） | #120でqgammaの初期値選択、tiny quantileの対数計算、Wilson–Hilferty/DiDonato–Morris分岐、invertContinuousとの接続を確認。3286件のqgamma fixtureを閲覧、未実行。 |
| `src/distributions/geometric.ts` | 問題未検出 | #103 | `fe88f1b31ddb3a69cef524aeb9aa5dd08509e0a8` | — | Rと同じ（通常 fixture は R 4.5.2 由来。今回R実行なし） | `dgeom1`/`pgeom1`/`qgeom1`、`probPair`/`qPow` の通常・subnormal・巨大整数経路、支持域・入力検証、上下尾・logP、離散分位点の境界補正をソース追跡。R 4.5.2由来の d/p/qgeom fixture（計6112ケース）を閲覧。CHANGELOGの `pgeom(1e290, 5e-324)` と `pgeom(8.7e299, 1.1e-300)` の修正記録も照合。fixture/Vitest/package runtime/R実行なし。 |
| `src/distributions/hypergeometric.ts` | 一部監査・問題未検出 | #139 | `f6d0a8e51cbd301536a2e29a3d6b110a814c6e26` | — | R 4.5.2由来の dhyper/phyper/qhyper fixture と既存テストを閲覧（未実行） | `support=[max(0,k-n),min(k,m)]`、half-even丸め、整数外x/q、退化支持、`binomialLimit`、Loader式の確率質量、左右tail比の単調性・打切り条件、2^53超のCDF/quantile拒否を追跡。具体的な端点入力: `dhyper(0,0,5,3)`、`phyper(-1,10,10,5)`、`qhyper(0.5,10,10,5)`。`m+n` overflow時の `hyperParams` 検証と、`dhyper` 側に `MAX_EXACT` guardがない点は極端な整数領域で追加実行検証が必要。再現不具合は確定せず。Vitest/package runtime/R実行なし。
| `src/distributions/invgamma.ts` | 一部監査・問題未検出 | #140 | `f6d0a8e51cbd301536a2e29a3d6b110a814c6e26` | — | R 4.5.2/extraDistr由来fixtureとmpmath fixtureを閲覧（未実行） | `X=1/Y` の変換、z=beta/xのdouble-double補正、subnormal zの対数密度、CDF上下尾符号、logP補正、tiny gamma quantile経路、alpha/betaのNaN/0/Inf境界を追跡。具体的入力: `dinvgamma(1e-300,2,{beta:1e-300})`、`pinvgamma(1e-300,2,{beta:1e-300,lowerTail:false,logP:true})`、`qinvgamma(1e-300,2,{beta:1e-300})`。alpha=Infinityは点質量0の極限として特別扱いされるが、`pinvgamma(0,Infinity)`の境界値はその極限解釈と不整合の可能性があり、R/extraDistrの契約確認を要するため不具合認定せず。Vitest/package runtime/R実行なし。
| `src/distributions/kumaraswamy.ts` | 一部監査・問題未検出 | #141 | `f6d0a8e51cbd301536a2e29a3d6b110a814c6e26` | — | extraDistr由来fixture・mpmath fixtureを閲覧（未実行） | 密度のx=0/1端点、a=Infinityの退化極限、b有限条件、`1-x^a`のexpm1/log1p、subnormal `x^a`、`b*log(1-x^a)`、下側log確率の小確率展開、逆関数のlogP/極小a経路とreciprocal補正を追跡。具体的入力: `dkumar(1-Number.EPSILON,2.6e-300,0.29)`、`pkumar(0.2,0.42,1.85e-317,{logP:true})`、`qkumar(4.8e-52,9.9e-314,2.5)`。既知の安定化分岐が各ケースをカバーすることを確認。Vitest/package runtime/R実行なし。
| `src/distributions/laplace.ts` | 一部監査・問題未検出 | #142 | `f6d0a8e51cbd301536a2e29a3d6b110a814c6e26` | — | extraDistr由来fixture・mpmath fixtureを閲覧（未実行） | `standardizeDD`による差分overflow回避、mu/sigmaのNaN/Inf/0境界、密度の2*sigma overflow、subnormal expの除算、CDFの左右tail/log1p、分位点のlog-tailとlocationScaleを追跡。具体的入力: `dlaplace(Number.MAX_VALUE,{mu:-Number.MAX_VALUE,sigma:1,log:true})`、`plaplace(Infinity,{mu:0,sigma:1})`、`qlaplace(1e-320,{mu:1,sigma:2})`、`dlaplace(0,{mu:0,sigma:1e308})`。ソース上の演算経路で新規不具合を確定せず。Vitest/package runtime/R実行なし。
| `src/distributions/logistic.ts` | 一部監査・問題未検出 | #143 | `557cdff4132642faad75bcd95ddbbfeca8a90eec` | — | R 4.5.2由来のd/p/qlogis fixtureを閲覧（未実行） | `dlogis1`のscale・subnormal density・log density、`plogis1`の符号と小さい側のtail選択、`qlogis1`のlogit・上下尾反転・scale=0/負/Inf、`standardizeDD`/`locationScale`接続を追跡。具体的入力: `dlogis(-745,{scale:1})`、`dlogis(-3.5667e-316,{scale:4.81926e-319})`、`plogis(1e300,{location:-1e300,scale:1e300,lowerTail:false,logP:true})`、`qlogis(1e-320,{scale:1e-300})`。再現不具合を確定せず。Vitest/package runtime/R実行なし。
| `src/distributions/lognormal.ts` | 一部監査・問題未検出 | #144 | `557cdff4132642faad75bcd95ddbbfeca8a90eec` | — | R 4.5.2由来のd/pl/q lnorm fixtureとmpmath由来の分布要約fixtureを閲覧（未実行） | `dlnorm1`のx<=0、sdlog=0、NaN/Inf、subnormal density、whole-exponent補正、`zOf`/`halfSquare`、`plnorm1`のnormal tail、`qlnorm1`のquantile refinement・巨大sdlog branchを追跡。具体的入力: `dlnorm(1e-100,{meanlog:-100,sdlog:3})`、`dlnorm(2e-105,{meanlog:1.53,sdlog:6.36})`、`plnorm(1e-300,{meanlog:0,sdlog:1,logP:true})`、`qlnorm(1e-30,{meanlog:0,sdlog:9e307})`。Rとの既知丸め差を新規不具合と誤認しないよう区別。新規再現不具合なし。Vitest/package runtime/R実行なし。
| `src/distributions/multinomial.ts` | 問題あり | #96 | `ac5d64a614debaa2922754bd257f2b8286619518` | [#24](https://github.com/numero-uno-jpn/rStats.js/issues/24) | Rでは未確認 | 中央二項確率の解析式と Stirling 漸近、IEEE-754 中間積の独立計算。実パッケージ実行・R比較なし。 |
| `src/distributions/nbeta.ts` | 一部監査・問題未検出 | #145 | `557cdff4132642faad75bcd95ddbbfeca8a90eec` | — | R 4.5.2由来d/p/qnbeta fixture、mpmath tail fixture、既存regression testを閲覧（未実行） | Poisson混合のbeta kernel/隣接項比/shape丸め補正、leftTailLog、極端shape用chisq/gamma/w/integral method、数値積分のmode探索・tail remainder、density端点、quantile端点・narrow quantile、noncentral F変換fPair/fOdds・tiny q・Chernoff bound・df2→∞極限を追跡。具体的入力: `pbeta(1e-7,3,5,{ncp:2e7,logP:true})`、`dbeta(1.4930968104424972e-218,4.994551015409567e-269,1.00296357719376e-118,{ncp:4.248780725227059})`、`qbeta(1.2066869150839893e-270,0.031616179278943515,0.2793791077635366,{ncp:0.6460099483845458,lowerTail:false})`、`pf(2.5e300,1828,0.165,{ncp:3.7e307})`。既存test/nbeta.test.tsの特殊ケースを照合。ソースレビュー上の新規再現不具合なし。Vitest/package runtime/R実行なし。
| `src/distributions/nchisq.ts` | 一部監査・問題未検出 | #146 | `557cdff4132642faad75bcd95ddbbfeca8a90eec` | — | R 4.5.2由来dnchisq/pnchisq/qnchisq fixture、mpmath由来巨大tail fixture、既存regression testを閲覧（未実行） | Poisson-gamma mixture、subnormal x/2補正、Chernoff far-tail bound、Bessel Hankel/Debye asymptotic、Bessel series、log-domain tail integration、df=0 atom境界、quantile Patnaik開始値・narrow spread・double searchを追跡。具体的入力: `dchisq(0,0,{ncp:1})`、`pchisq(0,0,{ncp:1,lowerTail:true,logP:true})`、`dchisq(2.0001e9,1e6,{ncp:2e9,log:true})`、`qchisq(5.7285590455359545e-12,5.345349749112763,{ncp:1})`。df=0のx=0密度はR fixtureもInfinityであることを照合。新規再現不具合なし。Vitest/package runtime/R実行なし。
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
| `src/htest/testFormula.ts` | 問題あり | #212 | `6b5fa401398cf4b4ba9d0362a80df5f2424af58f` | [#48](https://github.com/numero-uno-jpn/rStats.js/issues/48) | R 4.5.2 formula methods source/contractと照合（未実行） | splitTilde, Pair(a,b), twoSampleData one/paired/two group validation, kSampleData, groupFactor/presentLevels, oneway interaction codes/stride, blockData complete unreplicated matrix, correlationData selectionを確認。確定不具合: `correlationData()` はrhsVariablesが2つあることしか検証せず、展開後のterms.terms数/モデルフレーム列数を検証しないため、`~ x * y` と `~ x:y` を受け入れて単純なx,y列の相関に黙って置き換える。再現: `const data={x:[1,2,3,4,5],y:[5,4,3,2,1]}; corTest("~ x * y",data); corTest("~ x:y",data)`。R cor.test.formulaはmodel.frameを構築し、列数が2でなければinvalid formulaで停止。Issue #48作成。その他のPair/interaction formula edgeは既存fixtureを閲覧。Vitest/package runtime/R未実行。 |
| `src/htest/trendTests.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/types.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/varTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/htest/wilcoxTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/index.ts` | 未監査 | — | `—` | — | — | — |
| `src/integrate/quadpack.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/covmat.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/ddexp.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/discrete.ts` | 問題あり | #106 | `a8ed86222a9c91b7dfea90b990244a81c1170194` | — | Rでは未確認 | `firstTrue()` の指数探索で `lo + step` が Infinity にオーバーフローすると、`Number.MAX_VALUE` を評価せず Infinity を返す。再現: `firstTrue(x => x >= 1.6e308, 1e308, Infinity)`。期待: `1.6e308`（有限かつ述語成立する最小の表現可能整数値）。実測: `Infinity`。Node.jsでソース関数を同一転記して実行、評価回数1024。原因: stepが 8.98846567431158e307 の時点で `lo+step` が Infinity となり、その後の二分探索も Infinity で停止。`discreteQuantile()` には同様の overflow 時 `Number.MAX_VALUE` を試すガードがあるが、`firstTrue()` にはない。修正案: step/j のオーバーフロー時に `Number.MAX_VALUE` を上限候補として評価し、述語成立なら有限区間を二分探索する。 |
| `src/internal/dpq.ts` | 問題未検出 | #120 | `543eb6ceb3de7627a7562b035a931a88da424aa7` | — | Rと同じ（lower.tail/log.pの仕様） | #120でsmallerTailのp>1/2時の尾部反転、linearTarget保持、logP時のexpm1補数を再確認。qgamma 3286件のR 4.5.2 fixtureを閲覧、未実行。 |
| `src/internal/extremes.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/fround.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/integer.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/invert.ts` | 一部監査・問題未検出 | #120 | `54aeaa15ec93053e2dd5fd19fc640a9fbf243a76` | — | R 4.5.2 qgamma fixtureを閲覧（未実行） | 正値領域log変換、上下尾残差の符号、bracket付きNewton/Halley、収束・stuck判定、polish/bisectXをgamma quantile呼出し条件でソース追跡。実行・高精度比較なし。 |
| `src/internal/levels.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/noncentral.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/poissonMixture.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/scaledInverse.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/seq.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/summary.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/uniroot.ts` | 未監査 | — | `—` | — | — | — |
| `src/internal/vectorize.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/balance.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/basic.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/chol.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/eigen.ts` | 問題未検出 | #108 | `f71ec0729230db3d5e20c5ab746325ec77345a9a` | — | Rと同じ（Rの `eigen()` 契約、既存のR由来fixture・比較基準を確認。今回R実行なし） | 対称行列の自動判定（相対差・絶対差フォールバック）、下三角採用、Householder三重対角化、implicit QL、固有値降順・固有ベクトル列の対応、非対称行列のbalancing/Hessenberg/Francis double-shift QR、複素共役ペアの並び・位相正規化、onlyValues、NaN/Inf拒否、2の冪スケーリングと逆スケーリングを追跡。固定例: `[[2,1],[1,2]]`（固有値 `[3,1]`）、`[[0,-1],[1,0]]`（固有値 `±i`）、`[[1e308,1e308],[1e308,-1e308]]`（中間演算のスケーリング）、`[[1e-60,2e-60],[3e-60,4e-60]]`（R `isSymmetric` の絶対差フォールバック）。既存 `test/eigen.test.ts` の対称/非対称fixture比較、固有値・固有ベクトル許容差と列整列のテスト構造を閲覧。fixture/Vitest/package runtime/R実行なし。 |
| `src/linalg/expm.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/kappa.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/lu.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/matrix.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/norm.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/ops.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/qr.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/schur.ts` | 未監査 | — | `—` | — | — | — |
| `src/linalg/solve.ts` | 問題未検出 | #109 | `6b9fabe470c0a994e48cd612bcd3e30aaa580aa1` | — | Rでは未確認（R実行・新規照合なし） | LU partial pivoting、exact singular判定、`gecon()` の1-norm reciprocal condition estimate、既定tol=`Number.EPSILON`、極端な大きさのpower-of-two scaling、NaN/Inf時のcondition check skipを追跡。`pseudoQuadratic()` との判定基準不整合を確認するための関連監査。`solve()` 単体の不具合は今回確定せず。Vitest/package runtime/R実行なし。 |
| `src/linalg/svd.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/anovaSequential.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/aovEz.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/aovStrata.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/carAnova.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/coxph.ts` | 問題未検出 | #107 | `206adeeae033f983cc1e2c17b3ba568bd40f3667` | — | Rと同じ（`survival` 3.8系の `coxph` の仕様記述・R由来fixtureを照合。今回R実行なし） | `coxph()` の欠損除外、status/weight/strata、重み付き中心化・スケーリング、Efron/Breslow ties、層別リスク集合、Newton-Raphsonのstep halving・収束判定、一般化Cholesky・共線性、係数/SE/CI/Wald/LR/score統計をソース追跡。具体例: `time=[5,3,8,1,9,4]`, `status=[1,1,0,1,0,1]`, `x=[[1.2],[0.3],[-0.5],[2],[0.7],[0.1]]`; tiesは`efron`/`breslow`、weightsは正整数のみ。`test/coxph.test.ts` と `oracle/coxph-behaviour.md`、R生成スクリプトの重いties・weights・strata・aliased列・単一event・monotone likelihoodケースを閲覧。実行/Vitest/package runtime/R実行なし。 |
| `src/models/ddLeastSquares.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/ddMatrix.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/estimable.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/formula.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/glm.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/glmAnova.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/glmConfint.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/glmFamily.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/lm.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/lmer.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/lmerAnova.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/lmerHypotheses.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/lmerTest.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/mauchly.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/mixedDerivatives.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/mixedDeviance.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/mixedStructure.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/modelFrame.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/modelMatrix.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/scaledTables.ts` | 未監査 | — | `—` | — | — | — |
| `src/models/survival.ts` | 条件付き問題あり（実データ未再現） | #109–110 | `6b9fabe470c0a994e48cd612bcd3e30aaa580aa1` | [#28](https://github.com/numero-uno-jpn/rStats.js/issues/28) | Rでは未確認（R実行なし） | #109で `pseudoQuadratic()` の固定固有値閾値 `1e-10 * max(lambda)` と `solve()` の既定tol=`Number.EPSILON` の不整合を指摘。#110で `survdiff()` のリスク集合構造を解析：正の期待イベント数を持つ各群は最初のイベント時点で必ずリスク集合に属する。最初のイベント数 d がリスク集合総数 N 未満なら、その時点の分散寄与 `w²*d*(N-d)/(N*(N-1)) * (diag(r)-r*r'/N)` は、使用群のうち1群を除いた部分行列上で正定値。最初の時点で d=N なら全リスク対象が同時イベントとなり、以後のイベントはなく、V=0かつO-E=0。従って通常の入力では `pseudoQuadratic()` が準特異行列の正の小固有値を切り捨てる経路は実証できず、実際のtime/status/group再現なし。Issue #28は補助関数の閾値方針上の懸念として保持し、survdiffの実害は未確定。Vitest/package runtime/R実行なし。 |
| `src/models/tiedTimes.ts` | 問題未検出 | #113 | `6222eb058ce9759e37c852a30a56582b57e18009` | — | Rと同じ（`survival::aeqSurv()` の tie判定・cut point写像と一致。今回R実行なし） | `mergeTiedTimes()` 全体、呼出元 `coxph.ts`/`survival.ts`、`summary.ts` の overflow-safe `mean()`、`test/survival.test.ts`・`test/coxph.test.ts`、`oracle/survival-behaviour.md` を確認。R `aeqSurv.R` の `dy <= tolerance || dy/mean(abs(y)) <= tolerance`、`cuts <- y[c(1,!tied)]`、`findInterval` による写像と実装のロジックは一致。固定例 `[0,1e-8,2e-8]` は隣接差が各 `1e-8` で閾値 `sqrt(2^-52)≈1.4901161193847656e-8` 以下のため全て最小値0へ統合され、両端差 `2e-8` が閾値を超えても連鎖統合される。これはRと同じ仕様。極端値 `[1e308,1.1e308]` はgap `1e307`、平均絶対値 `1.05e308`、相対差約0.095で統合されない。`[-Number.MAX_VALUE,Number.MAX_VALUE]` の差分overflowはInfinityとなり誤統合しない。subnormal・負値・±0・NaN/±Infinityの経路もソース確認。専用 `test/tiedTimes.test.ts` は存在せず、関連テストは閲覧のみ。実行/Vitest/package runtime/R実行なし。 |
| `src/numerics/deriv.ts` | 未監査 | — | `—` | — | — | — |
| `src/numerics/integrate.ts` | 未監査 | — | `—` | — | — | — |
| `src/numerics/interp.ts` | 未監査 | — | `—` | — | — | — |
| `src/numerics/ode.ts` | 未監査 | — | `—` | — | — | — |
| `src/optim/lbfgsb.ts` | 未監査 | — | `—` | — | — | — |
| `src/optim/localmin.ts` | 未監査 | — | `—` | — | — | — |
| `src/optim/optim.ts` | 未監査 | — | `—` | — | — | — |
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
| `src/special/besselIK.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/besselJY.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/besselSeries.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/beta.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/choose.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/constants.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/dd.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/erf.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/extra.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/gamma.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/igam.ts` | 一部監査・問題未検出 | #119 | `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620` | — | R 4.5.2由来pgamma fixtureを閲覧（未実行） | #119で下側級数、上側連分数/Lentz、Temme漸近、巨大x・極小shapeの特別経路をソース追跡。境界と分岐点の固定入力を整理。fixture/Vitest/独立数値計算は未実行。全域精度は未認証。 |
| `src/special/igamAsympCoeff.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/igami.ts` | 一部監査・問題未検出 | #120 | `008fc2b262eaa649093211a40e9d7fdd83facdcf` | — | R 4.5.2 qgamma fixtureを閲覧（未実行） | DiDonato–Morris Eq. 21–36のshape<1/≥1分岐、p/q反転、近似初期値の補正、級数補助を確認。初期値を最終解と誤認せずNewton反復へ渡す構成。実行なし。 |
| `src/special/incbet.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/incbetLargeA.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/incbetPrefactor.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/incbetTemme.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/lgammaDiff.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/loader.ts` | 問題あり | #96 | `ac5d64a614debaa2922754bd257f2b8286619518` | [#24](https://github.com/numero-uno-jpn/rStats.js/issues/24) | Rでは未確認 | 中央二項確率の解析式と Stirling 漸近、IEEE-754 中間積の独立計算。実パッケージ実行・R比較なし。 |
| `src/special/log1p.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/log1pmx.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/ndtri.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/polevl.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/psigamma.ts` | 未監査 | — | `—` | — | — | — |
| `src/special/rCompatible.ts` | 未監査 | — | `—` | — | — | — |

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
- 判定: 問題あり; [Issue #48](https://github.com/numero-uno-jpn/rStats.js/issues/48)。
- `correlationData()` はrhsVariablesが2つあることしか検証せず、formula expansionのterms.terms/モデルフレーム列数を確認しない。したがって `~ x * y` と `~ x:y` を受け入れ、展開式を無視して単純なx,yの相関に置き換える。再現: `const data={x:[1,2,3,4,5],y:[5,4,3,2,1]}; corTest("~ x * y",data); corTest("~ x:y",data)`。R cor.test.formulaはmodel.frameを構築し、列数が2でなければinvalid formulaで停止。
- その他: splitTilde、Pair(a,b)のpaired formula、twoSampleData、kSampleData、groupFactor、oneway interaction coding、blockData complete blockを確認。
- Rとの関係: R 4.5.2 cor.test.formula source/docsを照合。Vitest/package runtime/R未実行。

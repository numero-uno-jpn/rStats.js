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
| `src/api-reference.ts` | 問題未検出 | #153 | `dc66d56aca691ba312c6f10a50e742e7921e2e69` | — | 該当なし（Typedoc用のexport barrel。統計関数ではない） | Typedoc入口を再監査。`index.js`と`entries/mixed.js`を再exportし、tsconfig.build.jsonでは除外。package.jsonの`./mixed` subpathはdist/entries/mixed.jsを指し、build includeと整合。新規不具合なし。 |
| `src/data/grouping.ts` | 問題あり・追加監査済み | #154, #852 | `95467a588c46297bf2ae8e90995c818d284bf6c5` | [#35](https://github.com/numero-uno-jpn/rStats.js/issues/35); [#363](https://github.com/numero-uno-jpn/rStats.js/issues/363) (open) | R 4.5.2由来のtapply/split/aggregate fixtureを閲覧（未実行）。`__proto__` はRとの直接照合ではなくJS object property semantics | factor levelsの15桁同一化・型混在拒否・欠損ラベル・column-major cross-classification・空cell、tapplyのscalar/non-scalar結果、splitのdrop/separator衝突、aggregate formulaの`.`/cbind/演算子展開、NA除外、複数値funの列展開を追跡。#35: data-frame aggregateで`by`列名`__proto__`がown propertyとして生成されない。#852: 2 factorそれぞれ65,536 levels、n=65,536の疎データで`size=2^32`となり、`rowsByCell()`の`Array.from({length:g.size})`がJS Array length上限超過でnative RangeError。以前は巨大cross productを独立Issue化しなかったが、今回具体的な2^32境界再現を確定しIssue #363を登録。fixture/source閲覧・静的allocation解析のみ。実行なし。 |
| `src/descriptive/basic.ts` | 問題あり・追加監査済み | #155, #299, #853, #873 | `9384210dad0ec3273f1f4c6084c6e601c7a20d54` | [#364](https://github.com/numero-uno-jpn/rStats.js/issues/364) (open); [#387](https://github.com/numero-uno-jpn/rStats.js/issues/387) (closed/duplicate) | `test/descriptive.test.ts` と `test/fixtures/rbasic.json`、`summary.ts`、`extremes.ts`、`integer.ts` を閲覧（実行なし） | `values`/naRm、空配列、±0、NaN/±Inf、trim境界、weightedMeanの0/負/巨大weight、variance/sdのscale、medianの±MAX_VALUE、累積和/積の非有限遷移、diff validationを確認。具体入力: `mean([1,2,3],{trim:-1})`, `mean([1,2,3],{trim:0.5})`, `weightedMean([1e308,-1e308],[1,1])`, `weightedMean([1,2],[0,0])`, `prod([1e-300,1e-300,Infinity])`, `cumprod([1e308,1e308,0,-Infinity])`, `diff([1,2,3],{lag:1e308})`。新規再現不具合なし。Vitest/package runtime/R実行なし。 #853: `weightedMean([1e-200],[1e-200])`。`x*w`が0へunderflowし、finite denominatorで割った結果も0となるが、1要素のweighted meanは1e-200。#334はoverflow fallback内の小weight消失であり、本件はfallback前の積underflow。静的IEEE-754解析のみ。 | #873: weightedMeanのzero-weight NaNがoverflow fallbackを止めるという候補は既存Issueとの重複としてclose。
| `src/descriptive/cov.ts` | 問題あり | #156 | `1e94b1e295f5a57aeb02a43e029117a9d67b0282` | [#36](https://github.com/numero-uno-jpn/rStats.js/issues/36) | R 4.5.2由来cov/cor fixtureを閲覧（未実行）。ragged arrayはR matrixでは表現できないため入力形状validation問題 | matrix/vector dispatch、method/use abbreviation、everything/all.obs/complete.obs/na.or.complete/pairwise.complete.obs、pairwise rank、kendall covariance/tau-b、Pearson DD、n<2、complete rowsなし、matrix diagonalの特別処理を追跡。通常入力例: `cov([[1,2],[2,4],[3,5],[4,9]])`、`cor([1,2,3,4],[2,4,5,9],{method:"spearman"})`、`cov([[1,NaN],[2,3],[3,4]],{use:"pairwise.complete.obs"})`。確認した不具合: `isMatrix` は先頭行だけを見てmatrix判定し、`columns` は先頭行の列数で後続行を変換するため、`cov([[1,2],[3,4,5]])` は余分な5を黙って捨て、`cov([[1,2],[3]])` はundefinedを数値計算へ渡してNaNを生成する。全行の長さ検証がない。Issue #36。`test/descriptive.test.ts` とcov fixtureを閲覧、実行なし。 |
| `src/descriptive/dataFrames.ts` | 問題あり | #157 | `1e94b1e295f5a57aeb02a43e029117a9d67b0282` | [#35](https://github.com/numero-uno-jpn/rStats.js/issues/35) | R 4.5.2由来merge/subset/rbind/cbind fixtureを閲覧（未実行）。__proto__ behavior is JavaScript-specific | rowCount/column gather and type preservation, 15-digit numeric key text, missing-key matching, one/multi-key join, Cartesian many-to-many matches, allX/allY, sort order via Shell sort, suffix collision, subset filtering, rbind common-type coercion, cbind row count, fromRows/toRows and special property namesを追跡。具体例: `merge({id:[3,1,2],v:[10,20,30]},{id:[1,2,2,4],w:[0.5,1.5,2.5,3.5]})`、`subset({y:[5,NaN,7],g:["a","b","a"]},row=>row.y>4,{select:["g"]})`、`rbindFrames([{x:[1],g:[true]},{g:[false],x:[2]}])`、`fromRows([{id:"a",score:5},{id:"b"}])`。確認した不具合: `split` のdata-frame branchで `rowsOf` が列名を `out[name]=...` で設定するため、JSON.parseで作ったown `__proto__` 列が結果から失われ、通常objectのprototype setterに消費される。Issue #35。既存 `test/dataFrames.test.ts` / `test/fixtures/dataFrames.json` のR由来fixtureを閲覧、実行なし。 |
| `src/descriptive/factanal.ts` | 問題未検出 | #163 | `0198fd8d1f738d5bce2a65ad0ddf27c77af26a0b` | — | R 4.5.2由来factanal fixtureを閲覧（未実行）。最適化・回転・スコア式はソース上の数理検討 | `checkCovmat`/data dispatch、p/factor/dof境界、相関標準化、初期独自性、L-BFGS-B objective/gradient、固有値によるloadings、varimax正規化・SVD直交回転・列符号/順序、promax QR/Gram inverse、回帰/Bartlett scores、nObsの尤度比統計量を追跡。具体入力: `const R=[[1,.72,.63],[.72,1,.56],[.63,.56,1]]; factanal(null,1,{covmat:R})`、`factanal([[1,2,3],[2,1,2],[3,5,4],[4,3,6],[5,4,5]],1,{scores:"regression"})`、同データで`{scores:"Bartlett",rotation:"none"}`、`factanal(null,1,{covmat:R,nObs:100})`。既存 `test/factanal.test.ts` とR由来fixtureの引数・期待値・異常系を閲覧。新規の再現可能な不具合は確定せず。Vitest/package runtime/R実行なし。 |
| `src/descriptive/hist.ts` | 問題あり・追加監査済み | #164, #718, #719, #720, #721 | `7e5ab4c0db2d80ac9ab1bf1e94423cf800f829b5` | [#228](https://github.com/numero-uno-jpn/rStats.js/issues/228) (open); [#229](https://github.com/numero-uno-jpn/rStats.js/issues/229) (open); [#230](https://github.com/numero-uno-jpn/rStats.js/issues/230) (open); [#231](https://github.com/numero-uno-jpn/rStats.js/issues/231) (open) | `hist`のdensity denominator、explicit breaks finite validation、Scott/FD class-countの極端値演算を追加監査。 | #718: `hist([-1e308,1e308],{breaks:[-1e308,1e308]})`。幅差がInfinityとなりdensity=0だが、真のdensity約5e-309は表現可能なsubnormal。Issue #228。#719: `hist([0,1],{breaks:[-Infinity,Infinity]})`は非有限breaksを受け入れる。R hist.defaultは非有限breakpointsを拒否する。Issue #229。#720: `hist([-1e308,1e308],{breaks:"Scott"})`でrangeとScott widthがInfinityとなりInfinity/Infinity=NaN、break count validationでRangeError。scale-free比は有限で約0.51。Issue #230。#721: 同データのFD ruleでもrangeと2*IQRがInfinityとなりNaN、数学的bin数は2。Issue #231。いずれも静的式・IEEE-754/API契約解析のみ。 |
| `src/descriptive/missing.ts` | 問題あり | #165 | `0198fd8d1f738d5bce2a65ad0ddf27c77af26a0b` | [#35](https://github.com/numero-uno-jpn/rStats.js/issues/35) | R 4.5.2由来complete.cases/na.omitの仕様を確認（今回R実行なし）。`__proto__` はJavaScript own-property semanticsに起因 | `isVector`/DataFrame dispatch、array/Float64Array、null/NaN欠損判定、複数引数の行数整合、zero-column/zero-row、complete-case mask、naOmitの型保持とFloat64Array復元を追跡。具体入力: `const x=JSON.parse('{"__proto__":[1,null],"v":[3,4]}'); completeCases(x); naOmit(x);`。completeCasesはown `__proto__`列をObject.values経由で欠損判定に含めるが、naOmitは出力を通常の`{}`に作り`out[name]=kept`とするため、`__proto__`がprototype setterとして扱われown列が消える。Issue #35へ同一根本原因の追加症状として追記。`test`に専用missing.ts fixture/testを確認できず。ソース意味論で確定、Vitest/package runtime/R実行なし。 |
| `src/descriptive/moments.ts` | 問題あり | #166, #595 | `740c02eaceadd6f1454ecd7564bcd6f09f563b5b` | [#38](https://github.com/numero-uno-jpn/rStats.js/issues/38) | R 4.5.2/e1071/DescToolsの定義・fixtureを閲覧（未実行）。ragged rowsはR matrixでは表現できないためshape validationの問題 | `centralSums`のpower-of-two scaling・double-double mean・2/3/4次中心和、skewness/kurtosis type 1/2/3と最小標本数、geometricMeanの負数/zero/NaN、modesのties/±0、meanADのcenter、cv補正、scaleのcenter/scale指定・NaN・overflowed deviations・RMS救済を追跡。具体入力: `skewness([-1e308,1e308])`、`kurtosis([1e-200,2e-200,3e-200,4e-200])`、`geometricMean([1e308,1e-308])`、`meanAD([-1e308,1e308])`、`cv([-1,1])`、`scale([[1,2],[3,4]])`。確認した不具合: `scale`は行列入力の列数を先頭行だけで決め、後続行の長さを検証しない。`scale([[1,2],[3,4,5]],{center:false,scale:false})`は5を黙って無視し、`scale([[1,2],[3]],{center:true,scale:true})`はundefinedを平均/RMSへ混入させNaN列を返す。Issue #38。既存skewness/scale fixtureとscale invariance testsを閲覧。Vitest/package runtime/R実行なし。 |
| `src/descriptive/omega.ts` | 問題未検出 | #167 | `0198fd8d1f738d5bce2a65ad0ddf27c77af26a0b` | — | psych::omega R fixtureを閲覧（未実行）。仕様oracleのコメントと実装経路を照合 | pairwise-complete correlation/covmat normalization、SMC pseudo-inverse rank threshold、minres objective/gradient/bounds/Heywood warning、principal loadings/eigen clipping、varimax、quartimin gradient、oblimin BB step/non-monotone line search/2000 iteration warning、2-factor identification rule、Schmid-Leiman general/group loadings、flip/key、omegaH/omegaLim/alpha/omegaTot/G6/ECV/group assignmentを追跡。具体入力: `const R=[[1,.52,.36,.36,.36,.36],[.52,1,.36,.36,.36,.36],[.36,.36,1,.52,.36,.36],[.36,.36,.52,1,.36,.36],[.36,.36,.36,.36,1,.52],[.36,.36,.36,.36,.52,1]]; omega(null,{covmat:R})`、`omega(null,{nfactors:1,covmat:R})`、`omega(null,{nfactors:2,covmat:R})`。既存 `test/omega.test.ts` とR fixtureの1/2/3-factor cases・known one-factor zero differencesを閲覧。新規の再現可能な不具合は確定せず。Vitest/package runtime/R実行なし。 |
| `src/descriptive/pivot.ts` | 問題あり | #168 | `e22826429f71e15fb26749fbc3bb1dc7430ccdb4` | [#39](https://github.com/numero-uno-jpn/rStats.js/issues/39) | tidyr pivot fixture (R 4.5.2)を閲覧（未実行）。own-property境界はJavaScript仕様で確定 | `pivotLonger` の列選択/重複/regex captureとseparator、namesTo/.value、型統合、行順、valuesDropNa、namesTransform、Float64Array保持、警告重複排除、`pivotWider` のID/name組合せ・sort・重複セル・summary/fill・namesVary・生成列名を追跡。具体入力: `const d=JSON.parse('{"id":[1,2],"key":["a","b"],"__proto__":[5,6]}'); pivotWider(d,{namesFrom:"key",valuesFrom:"__proto__",idCols:["id"],valuesFill:{}})`。`perColumn()` が `option[name]` で継承プロパティまで読むため、指定していない`valuesFill`に`Object.prototype`が返り、欠損セルにオブジェクトが入る。`valuesFn`にも同じlookup問題。Issue #39。既存 `test/pivot.test.ts` とtidyr由来fixtureの全経路・型保持テストを閲覧。Vitest/package runtime/R実行なし。 |
| `src/descriptive/quantile.ts` | 問題未検出 | #169 | `e22826429f71e15fb26749fbc3bb1dc7430ccdb4` | — | R 4.5.2由来quantile fixtureを閲覧（未実行）。9種のHyndman-Fan定義は式を直接確認 | type 1–9の位置式/fuzz、端点clamp、空標本・NaN/NA除去、同値±Infinity補間回避、IQR overflow意味、fivenum hinge/midpoint、MAD low/highと欠損数・center/constantを追跡。具体入力: `quantile([-Infinity,Infinity],0.25,{type:7})`、`quantile([1,2,3,4],0.5,{type:1})`、`quantile([1,2,3,4],NaN)`、`fivenum([-Number.MAX_VALUE,Number.MAX_VALUE])`、`mad([1,2,3,4],{low:true})`、`mad([1,2,3,4],{high:true})`。既存 `test/descriptive.test.ts` とR 4.5.2 quantile fixtureを閲覧。NaN probabilityはNaN返却、type7の異符号無限大補間はNaNとなる仕様上の演算。新規の再現可能な欠陥は確定せず。Vitest/package runtime/R実行なし。 |
| `src/descriptive/rank.ts` | 問題未検出 | #170 | `e22826429f71e15fb26749fbc3bb1dc7430ccdb4` | — | R 4.5.2由来rank fixtureを閲覧（未実行）。ties randomは共通R RNGを利用 | NaN keep/first/last、±Infinityと同値tie、signed zero、全欠損/空、6 tiesMethod、naLast rank offset、random tieのuniform drawとstable fallbackを追跡。具体入力: `rank([Infinity,1,Infinity,-Infinity])`、`rank([NaN,3,NaN,1],{naLast:"first"})`、`rank([NaN,3,NaN,1],{naLast:"last"})`、`rank([-0,0,1])`、`setSeed(17); rank([2,1,2,1],{tiesMethod:"random"})`。sort comparatorはInfinity-InfinityのNaNを同順位として扱い、NaN入力は別処理。新規の再現可能な欠陥は確定せず。Vitest/package runtime/R実行なし。 |
| `src/descriptive/table.ts` | 問題あり・追加監査済み | #171, #715, #717 | `d6a292d4eb9f040528219f8202e2ad962cfc13e0` | [#225](https://github.com/numero-uno-jpn/rStats.js/issues/225) (open); [#227](https://github.com/numero-uno-jpn/rStats.js/issues/227) (open) | `tabulate`の非有限binからのnbins推定と`cut`の明示break vectorの最小長を再監査。 | #715: `tabulate([1,Infinity])`でnbins省略時、Math.trunc(Infinity)がInfinityとして残り、maxOfがInfinityを返すため出力配列長がInfinityとなりRangeError。有限bin 1と非count値Infinityから期待される`[1]`を生成できない。Issue #225。#717: `cut([0,1],[])`はbreak数の検証をせず`binCode()`へ進み`[NaN,NaN]`を返す。R cutは2つ以上のunique breakを要求する。Issue #227。静的control-flow/API契約確認のみ。 |
| `src/distributions/arcsine.ts` | 問題未検出・追加監査済み | #95, #571, #575 | `907b0a4b3b55ca8f4b21325dca7de651fb8f420b` | — | darcsine/parcsine/qarcsineのwidth overflow、subnormal endpoint、sqrt/log tail、upper quantile mirrorを再監査。 | 入力: `darcsine(Number.MIN_VALUE,{a:0,b:Number.MAX_VALUE})`, `darcsine(0,{a:-Number.MAX_VALUE,b:Number.MAX_VALUE,log:true})`, `parcsine(Number.MIN_VALUE,{a:0,b:Number.MAX_VALUE,logP:true})`, `parcsine(Number.MAX_VALUE/2,{a:-MAX,b:MAX})`, `qarcsine(Number.MIN_VALUE,{a:0,b:Number.MAX_VALUE})`, `qarcsine(1-Number.EPSILON/2,{a:-MAX,b:MAX})`, `qarcsine(-744,{a:0,b:1e308,logP:true})`, `qarcsine(0.5,{a:-1e308,b:1e308})`。b-a overflow時のhalf scale、z<1e-20 direct sqrt、DD log distance、near endpoint log quantileとupper-tail mirrorを追跡。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/distributions/beta.ts` | 問題未検出・追加監査済み | #99, #560 | `959f9a68947eae3813d0fa8ed001f39380677e76` | — | dbeta/pbeta/qbetaのpoint mass、direct log density、Loader binomial identity、集中分布step quantile、left/right reflectionを再監査。 | 入力: `dbeta(0.5,1,1)`, `dbeta(0.5,1,2,{log:true})`, `dbeta(2.7e-289,7.5e-126,7.6e-180,{log:true})`, `dbeta(0.5,1e308,1e308)`, `pbeta(-1,0,2)`, `pbeta(-1,0,0)`, `pbeta(0,0,2)`, `qbeta(0.3,1.3e32,1.3e32)`, `qbeta(1.47e-15,1.69e160,1.62e175,{lowerTail:false})`, `qbeta(8.7e-285,1.3e304,5.9)`。pbeta(q<0, shape 0/Inf)のR差はtest/beta.test.tsでdeliberate knownDifferenceとして明記され、支持域を優先する設計。pair()の補数DD、sum overflow、direct log、quantile concentration/reflectionを追跡。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/distributions/binomial.ts` | 問題あり・追加監査済み | #101, #320, #526, #567 | `09ccfb35cb3ef73351b6cd3b32ccb42e5d85eb85` | [#117](https://github.com/numero-uno-jpn/rStats.js/issues/117) (open) | dbinom/pbinom/qbinomのlarge-n、x+1/n-x exactness、tail complement、logP差し引き、Cornish-Fisher初期値とdiscreteQuantileを再監査。 | #117: `pbinom(1,1e16,1-2**-53,{logP:true})`。x+1-x=1の高速branchに入りn-xを通常減算し、9999999999999999が1e16へ丸められる。x=1の厳密tailはq^(n-1)*(q+n*p)。80桁Decimal logは-367368005696770940.4129709667910、rounded b=nでは-367368005696770977.1497715364681、誤差約-36.7368005696771。Issue #117。その他2^53超の補正、logSubExp fallback、p=0/1、noninteger size/q、roundHalfEven endpointsを追跡。Vitest/package runtime/R実行なし。 |
| `src/distributions/bvnorm.ts` | 問題あり・追加監査済み | #94, #572 | `64ee087010121cef571a4dc5b227e8430dc4fe11` | [#23](https://github.com/numero-uno-jpn/rStats.js/issues/23) (closed/fixed); [#119](https://github.com/numero-uno-jpn/rStats.js/issues/119) (open) | perfect ±correlationの退化分布、Sheppard quadrature、near-|rho|=1漸近、orthant inclusion-exclusion、巨大有限boundsのoverflowを再監査。 | #23修正確認: `rho=-1`で`Y=-X`の区間確率を正しいnormal tail差で計算。新規#119: `pbvnorm([-1e200,-1e200],[Infinity,Infinity],0.5)`。真の矩形確率は1に丸められるが、upperOrthantの`h*k`と`(h*h+k*k)/2`が共にInfinity、quadrature exponentでInfinity-Infinity→NaN、inclusion-exclusionもNaN。Issue #119。その他rho=±1、±0.925/0.3/0.75境界、反射、無限端点を追跡。Vitest/package runtime/mvtnorm/R実行なし。 |
| `src/distributions/cauchy.ts` | 問題未検出・追加監査済み | #98, #555 | `b6ab3814c5f8dd494d51b095a2eb9f2bad56e370` | [#25](https://github.com/numero-uno-jpn/rStats.js/issues/25) (closed/fixed) | dcauchy/pcauchy/qcauchyのtiny scale、巨大差分、subnormal tail、quantile極端確率を再監査。 | #25修正確認: `dcauchy(1.1e308,{location:0,scale:1e308})`で`overPiScale`がπ*scale overflow時に`y/π/scale`とし、subnormal密度を保持。入力: `dcauchy(1.1e308,{location:0,scale:1e308})`, `dcauchy(1e-10,{scale:5e-324})`, `dcauchy(-2.165e-309,{scale:1.578e-312})`, `dcauchy(1.79e308,{location:-1.1e307,scale:2.7e296})`, `pcauchy(1.79e308,{location:-1.1e307,scale:2.7e296,lowerTail:false})`, `qcauchy(5e-324,{scale:1e-300})`, `qcauchy(-1000,{scale:5e-324,logP:true})`, `qcauchy(0.5,{scale:Infinity})`。frexp/halfDistance/tinyTail scaling、log tail fallback、scale=Infinityの意図的limit extensionを確認。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/distributions/chisq.ts` | 問題未検出・追加監査済み | #100, #566 | `e63963bec9ce7f38341e362e691b1a9630f04fe5` | [#26](https://github.com/numero-uno-jpn/rStats.js/issues/26) (closed/fixed) | d/p/qchisqのdf sign/half rounding、ncp delegation、vectorization、shape=0/Inf境界を再監査。 | #26修正確認: `df=-Number.MIN_VALUE`は`df<0`でNaNにしてから半分化。追加境界: `df=Number.MIN_VALUE`は`df/2`が+0に丸まりgamma shape=0経路となるが、Rのdouble演算でも同じhalf rounding。log upper-tailなどの数学的極限とは異なるが既知のR-compatible underflow behaviorとして新規Issueにしない。入力: `dchisq(1,±Number.MIN_VALUE,{log:true})`, `pchisq(1,Number.MIN_VALUE,{lowerTail:false,logP:true})`, `qchisq(Number.MIN_VALUE,Number.MIN_VALUE,{lowerTail:false})`, `dchisq(0,0)`, `pchisq(1,Infinity)`, `qchisq(0.5,Infinity)`。ncp optionはnchisqに正しく委譲。Vitest/package runtime/R実行なし。 |
| `src/distributions/exponential.ts` | 問題あり・追加監査済み | #102, #557 | `8c7f0f25039c237c39fbd5bf72e7329d874a2399` | [#27](https://github.com/numero-uno-jpn/rStats.js/issues/27) (closed; known R defect) | dexp/pexp/qexpのrate=0/Inf、rate*x overflow/subnormal、log-tail、expNegOverの極小rate経路を再監査。 | #27の既知R欠陥を再確認: `pexp(1e-20,{rate:1e-300,logP:true})`は丸め済みsubnormal積をlog化し数学値から約1.1131e-5ずれる。現在の特別経路はt[0]>0のsubnormal積のみ。追加境界: `pexp(1e-200,{rate:1e-200,logP:true})`（積underflow-to-zero）、`pexp(Infinity,{rate:0})`, `pexp(0,{rate:Infinity})`, `dexp(0,{rate:0})`, `dexp(0,{rate:Number.MAX_VALUE})`, `dexp(1e-300,{rate:1e300})`, `qexp(-720.6,{rate:7.4e-258,logP:true})`, `qexp(-Infinity,{rate:Number.MIN_VALUE,logP:true})`。underflow-to-zeroは#27と同系統でR互換挙動、独立Issue化せず。新規独立バグなし。Vitest/package runtime/R実行なし。 |
| `src/distributions/f.ts` | 問題あり・追加監査済み | #138, #565 | `12d20ccd20e09d1b4e4bdf1015553503d03b3872` | [#32](https://github.com/numero-uno-jpn/rStats.js/issues/32) (closed/fixed); [#116](https://github.com/numero-uno-jpn/rStats.js/issues/116) (open) | dfDensity1/fDensityのsmall-shape・巨大積fallback、fRatios、pfTiny、qf endpoint/limit/quantile inversionを再監査。 | #32修正確認: m<2はLoader binomial形式でなく`fLogDensity`へ分岐。新規#116: `df(1e150,1e150,1e308,{log:true})`, `pf(1e150,1e150,1e308,{logP:true})`。mx=1e300がfRatiosの1e290 cutoffを超えundefined。fallbackはq=n/m/x=1e8としてp=1-q<0を生成するが、実際p=mx/(n+mx)≈1e-8,q≈1。dbinomRawDD/betaIncに不正な負のpを渡しNaN。Issue #116。その他fRatiosのsmall/large scaling、pfTiny、df2→Inf gamma limit、qf asymptotic endpointsを追跡。Vitest/package runtime/R実行なし。 |
| `src/distributions/gamma.ts` | 問題あり・追加監査済み | #120, #300, #559, #712, #857 | `e9ba1c35ef88e77e84a392562bb7f62378fcbf7f` | [#113](https://github.com/numero-uno-jpn/rStats.js/issues/113) (open); [#222](https://github.com/numero-uno-jpn/rStats.js/issues/222) (open); [#368](https://github.com/numero-uno-jpn/rStats.js/issues/368) (open) | dgamma/pgamma/qgammaのshape/rate/scale境界、tiny-y、Poisson density変換、logOfLinear cancellation、rate/scale consistency toleranceを再監査。 | #712: `gammaScale({rate:1,scale:1+4*Number.EPSILON})`は積誤差が1e-15未満というだけで受理されるが、`1/rate`は厳密に1でありscaleは不一致。公開契約のrate/scale関係と検証許容差を明確化すべき。Issue #222。静的算術・validation traceのみ。 #857: `qgamma(-1e308,1e308,{scale:1e-308,lowerTail:false,logP:true})`。標準化quantileは約3.146e308でbinary64上限超過だが、scale適用後の正しいquantileは約3.146。標準化quantileを先にbinary64へ戻すため、最大有限値に制約された約1.798へ誤って収束する。large-deviation式・制御フロー解析のみ。 |
| `src/distributions/geometric.ts` | 問題あり・追加監査済み | #103, #569, #626 | `dfde963375d347292c88306f151aaa3a8a66612b` | [#145](https://github.com/numero-uno-jpn/rStats.js/issues/145) (open) | dgeom/pgeom/qgeomのq^n巨大整数、probPair、subnormal prob、closed-form quantileとjump-boundary slackを再監査。 | 入力: `dgeom(0,Number.MIN_VALUE,{log:true})`, `pgeom(1e290,5e-324,{logP:true})`, `pgeom(8.7e299,1.1e-300)`, `qgeom(0.7500000000000866,0.5)`, `qgeom(0.9999999999,1e-10)`, `qgeom(0.5,Number.MIN_VALUE)`, `qgeom(-720.6,7.4e-258,{logP:true})`, `pgeom(-1,1)`, `qgeom(0.5,1)`. qPow's two-term log1p expansion only applies when p<2^-54; omitted relative correction is <~p²/3, far below binary64 rounding. DD log ratio, tie tolerance and endpoint ordering checked. 新規確定バグ #145: `pgeom(0.99999999,0.5)`。`Math.floor(q+1e-7)`によりq=0.99999999が1へ繰り上がり、真値0.5に対して0.75を返す。幾何分布CDFは非整数qに対しfloor(q)を使うべき。Issue #145。 Vitest/package runtime/R execution none. |
| `src/distributions/hypergeometric.ts` | 問題あり・追加監査済み | #139, #301, #571 | `557f15ed94b73d98cc3606838441c05fcf94dca3` | [#118](https://github.com/numero-uno-jpn/rStats.js/issues/118) (open) | dhyper/phyper/qhyperのtotal population、binomialLimit、hyperFormのp/q、tail ratio recurrence、support/quantile boundsを再監査。 | #118: `dhyper(1,1,1e16,1e16)`, `dhyper(0,1,1e16,1e16)`, `phyper(0,1,1e16,1e16)`。m+n=10000000000000001が1e16へ丸められN-k=0,p=1,q=0となるが真の質量はP(X=0)=1/N≈1e-16、P(X=1)=1-1/N≈1。80桁Decimal log P0≈-36.8413614879047310443、log P1≈-1e-16。overflow再現`dhyper(5e307,1e308,1e308,1e308,{log:true})`でもN=Infinity,p=0,q=NaNだが真の密度は約1.13e-154。Issue #118。`phyper/qhyper`のhi>2^53 guardとbinomialLimitの小k経路も追跡。Vitest/package runtime/R実行なし。 |
| `src/distributions/invgamma.ts` | 追加監査済み・問題未検出 | #140, #302 | `942dc8bfc3a11295a8f7ac3f8df2decf757dac28` | — | dinvgamma/pinvgamma/qinvgamma R/mpmath fixtures、gamma helperを閲覧（実行なし） | 逆数gamma変換、beta/x subnormal・overflow、double-double correctionのalpha=1e15切替、log密度補正、CDF tail反転、tiny quantile reciprocal、alpha=Inf境界を確認。具体入力: `dinvgamma(1e-300,2,{beta:1e-300})`, `pinvgamma(1e-300,2,{beta:1e-300,lowerTail:false,logP:true})`, `pinvgamma(0,Infinity,{beta:1})`, `pinvgamma(1e-300,Infinity,{beta:1})`, `qinvgamma(1e-300,2,{beta:1e-300})`。alpha=Infかつq=0でCDF=0はR 4.5.2 fixtureにも明示。新規再現不具合なし。 |
| `src/distributions/kumaraswamy.ts` | 追加監査済み・問題未検出 | #141, #303, #501 | `ae73aa5f4ac85b344ea32f626854693a50409563` | — | dkumar/pkumar/qkumar R/mpmath fixturesを閲覧（実行なし） | x=0/1 density、a=Inf退化点質量、b有限条件、`1-x^a` expm1/log1p、subnormal `a log x`/`x^a`、tiny b、quantile logP・1/a overflow・reciprocal correctionを追跡。#501でa/bの±0・NaN・±Inf、p/q端点、上下尾・logPを追加確認。`valid(a,b)` は b を有限正値に制限し、a=Infのみ明示的な極限対応。extraDistr C++がb=+Infを算術的に通すケースは有限実数の分布パラメータ領域外として扱い、追加不具合とは判定せず。具体入力: `dkumar(0,0.5,2)`, `dkumar(1,2,0.5)`, `pkumar(0.2,0.42,1.85e-317,{logP:true})`, `qkumar(4.8e-52,9.9e-314,2.5)`, `qkumar(0.5,2,Infinity)`。新規再現不具合なし。Vitest/package runtime/R実行なし。 |
| `src/distributions/laplace.ts` | 問題あり・追加監査済み | #142, #304, #554 | `782524ad81cfd416c0582e8f6b6b31170d3db88f` | [#110](https://github.com/numero-uno-jpn/rStats.js/issues/110) (open) | dlaplace巨大sigmaの2*sigma overflow branchとsubnormal最終丸めを再監査。 | 入力: `sigma=1.4471514602179774e308`, `x=7.2357573010898871e307`（x=sigma/2）, `z=0.5`, `e=exp(-0.5)`。現行`(e/sigma)/2`は`2.095601864718686e-309`、binary64入力の厳密有理値を一度だけ丸めた結果は`2.09560186471869e-309`。subnormal grid上で1 ULPのdouble rounding。Issue #110。Vitest/package runtime/R実行なし。 |
| `src/distributions/logistic.ts` | 問題あり・追加監査済み | #143, #305, #554, #573 | `76cd8b85c520932b5980baa16cc3d4ce483eb872` | [#109](https://github.com/numero-uno-jpn/rStats.js/issues/109) (open); #108 related | dlogis/plogis/qlogisのstandardizeDD sign, expNeg subnormal, log density cancellation, lower/upper tail switch and locationScale boundariesを再監査。 | #109現行再現確認: `dlogis(6.41493903021196e307,{scale:1.282987806042392e308})`はe normalだが`scale*(1+e)^2` overflowし0、log密度は約-710.8935541918609でexpは1.831690925625393e-309。#108関連: `qlogis(0.5,{location:3,scale:Infinity})`は共通locationScale median special caseで3。Rは`location+scale*0`でNaN。追加入力: `plogis(±Infinity,{scale:1})`, `plogis(0,{scale:Number.MIN_VALUE,logP:true})`, `qlogis(±Number.MIN_VALUE,{scale:Number.MAX_VALUE,logP:true})`, `dlogis(744*Number.MIN_VALUE,{scale:Number.MIN_VALUE,log:true})`, `plogis(1e308,{location:-1e308,scale:1e308,lowerTail:false,logP:true})`。sign/expNeg/scale boundary追跡。#109以外の新規独立バグなし。Vitest/package runtime/R実行なし。 |
| `src/distributions/lognormal.ts` | 問題あり・追加監査済み | #144, #306, #558 | `2d955d68f6d973a4108450c6b1ae7fa3eb1fc204` | [#112](https://github.com/numero-uno-jpn/rStats.js/issues/112) (open); #108 related | zOf、halfSquare、pnormDD、smallTail、refineStdQuantile、dlnorm/plnorm/qlnormの極端値を再監査。 | #112: `dlnorm(1,{meanlog:1.0725839319986903e305,sdlog:7.295160993704339e154,log:true})`。|z|≈1.4702676649964559e150。halfSquareの巨大z shortcutがDD lowを捨て、h=1.0808435033670653e300。100桁Decimalによる正しい丸めは1.0808435033670651e300。log densityは1 ULP差。Issue #112。#108関連: `qlnorm(0.5,{meanlog:3,sdlog:Infinity})`はqnorm中央値特例経由でexp(3)を返すがRのqnorm scale=InfはNaN。Vitest/package runtime/R実行なし。 |
| `src/distributions/multinomial.ts` | 問題あり・追加監査済み | #96, #330, #506 | `5062beb4a7b75d3f2afae82fb732aefee2937b76` | [#24](https://github.com/numero-uno-jpn/rStats.js/issues/24), [#68](https://github.com/numero-uno-jpn/rStats.js/issues/68) | `dmultinom` の逐次二項分解、double-double suffix weight、overflow weight rescaling、zero-probability categories、size/count validationをR 4.5.x wrapperと照合。 | 既知Issue #24（巨大count linear denominator overflow）と #68（sum overflow回避の共通scaleで正のsubnormal weightが0になりlog確率を失う）が現行ソースにも残存。追加でK=0/1、prob=0/−0、all-zero weights、finite weight sum overflow、subnormal weight ratio、x=0/N、log/linear、size一致/不一致を確認。`dmultinom([0,1],[Number.MAX_VALUE,Number.MIN_VALUE],{log:true})` はスケーリング分岐を通らず、比がdoubleで0になる点でRの `prob/sum(prob)` と同じ結果。新規独立Issueなし。fixture閲覧・ソース追跡のみ、Vitest/package runtime/R実行なし。 |
| `src/distributions/nbeta.ts` | 問題あり・追加監査済み | #145, #307, #313, #508, #561 | `5c51760f6e136b80a77b4284da39c25b0ab8ed86` | [#63](https://github.com/numero-uno-jpn/rStats.js/issues/63) (closed); [#96](https://github.com/numero-uno-jpn/rStats.js/issues/96); [#114](https://github.com/numero-uno-jpn/rStats.js/issues/114) (open) | Noncentral beta/F Poisson mixture, beta kernel increment log, extreme method dispatch, density endpoints, quantile inversion and transformed F oddsを再監査。 | #114: `dbeta(0.5,0.75,Number.MIN_VALUE,{ncp:0.1,log:true})`。mu=0.05, method=mixture, jStar=0.25→j0=0。j=0 incrementでs=0.75,b=MIN_VALUEとなり`Math.log1p(s/b)`のs/bがInfinity、incLogDD=-Infinityでdominant j=0をdrop。b→0の漸近密度logは約-743.5986379456813。j>=1のみでは約3.70 log units低下。Issue #114。既存#63はclosed。#508のx=1,b=1 log densityでMath.log(a+mu) overflowも確認。Vitest/package runtime/R実行なし。 |
| `src/distributions/nchisq.ts` | 問題あり・追加監査済み | #146, #308, #310, #562 | `9549791940c425d508057b7286329b396ca36c6f` | [#64](https://github.com/numero-uno-jpn/rStats.js/issues/64); [#115](https://github.com/numero-uno-jpn/rStats.js/issues/115) (open) | dn/pn/qnchisqのsubnormalHalf、Poisson mixture、Bessel Hankel/Debye、Chernoff bound、quantile searchを再監査。 | #115: `x=5*Number.MIN_VALUE`, `df=8000`, `ncp=1`。x/2は2*MINに丸まりx2=4*MIN、lt=ln(1.25)。`(df/2-1)*lt≈892.36`なのでexp=Infinity。x2でdensity/CDF linear=0のため`0*Infinity=NaN`。log経路はlog空間で補正しfinite。Issue #115はdnchisq/pnchisq両方を含む。#64のstartSearch 2^53 index停滞は既知。Vitest/package runtime/R実行なし。 |
| `src/distributions/negbinomial.ts` | 問題あり・追加監査済み |  #147, #507, #570, #627 | `6bf9bf9b9d8b05aa4828e33c4b2fb9b3ed5171c7` | [#95](https://github.com/numero-uno-jpn/rStats.js/issues/95) (open); [#146](https://github.com/numero-uno-jpn/rStats.js/issues/146) (open) | d/p/qnbinomのprob/mu parameterization、fromMu ratio underflow、beta CDF、upperSeries、quantile refinementを再監査。 | #95拡張: 元の`dnbinom(1,1e-200,{mu:1e200})`はp=size/(size+mu)がunderflowしmassを喪失。対称ケース`dnbinom(1,Number.MAX_VALUE,{mu:Number.MIN_VALUE})`ではq=mu/(size+mu)≈2.75e-632がunderflowし、`dbinomRawDD`がq[0]===0で0/-Infを返すが真のmass≈mu=MIN_VALUE、log≈-744.4400719213812。`pnbinom(0,Number.MAX_VALUE,{mu:Number.MIN_VALUE,lowerTail:false,logP:true})`も同じq=0でlog upper tailを-Infinityとするが真値はlog(mu)。Issue #95本文に追記。`pnbinom1()`と`pnbinomMu1()`の`Math.floor(q+1e-7)`も誤り。`pnbinom(0.99999999,1,{prob:0.5})`および`pnbinom(0.99999999,1,{mu:1})`は正値0.5に対し0.75を返す。Issue #146。`dnbinomRaw`のsize+x overflow、pnbinom large-x correction、upperSeries term ratios、mu=0/InfとPoisson limitも追跡。Vitest/package runtime/R実行なし。 |
| `src/distributions/normal.ts` | 問題あり・追加監査済み | #148, #550 | `8a6db705befe4a4ea30785bdb4806cf18a59cbc6` | [#33](https://github.com/numero-uno-jpn/rStats.js/issues/33) (closed/fixed); [#108](https://github.com/numero-uno-jpn/rStats.js/issues/108) (open) | pnorm/qnorm/dnormのtail、logP、location-scale overflow/underflow、R boundary orderingを再監査。 | `pnorm(-1.5e154,{logP:true})`の旧#33は現行`(a/2)*a`で修正済み。新規: `qnorm(0.5,{mean:3,sd:Infinity})`は`affine()`の`t===0 && scale===Infinity`により3を返すが、R qnorm.cの`mu+sigma*val`では`Infinity*0`となりNaN。`qnorm(0.5,{sd:Infinity,lowerTail:false})`も確認。Issue #108。sd=0/negative、NaN、±Inf、p endpoint orderingはR sourceと照合。Vitest/package runtime/R実行なし。 |
| `src/distributions/nt.ts` | 問題あり・追加監査済み | #149, #328, #509, #564, #616 | `85763973f3f7a82d46ceee19a4dd0f8d8c275814` | [#66](https://github.com/numero-uno-jpn/rStats.js/issues/66); [#138](https://github.com/numero-uno-jpn/rStats.js/issues/138) | integral A/B、Laplace、nearZero、farLimit/farTails、巨大df正規極限、tiny df half処理、quantile sign/sideStart、far-tail quantile exponent overflow cutoffを再監査。 | #138: `qt(-1419.565225786768,2,{ncp:0,lowerTail:false,logP:true})`。`qnt1` は `ly > 709.78` でInfinityを返すが、`log(Number.MAX_VALUE)=709.782712893384`。df=2,ncp=0の上側tail式 `1-t/sqrt(t²+2)` から対象分位点は約 `1.7975133745369981e308` と有限であり、709.78の早すぎる打切りで誤ってInfinityとなる。Issue #138。Vitest/package runtime/R実行なし。
| `src/distributions/pareto.ts` | 問題未検出・追加監査済み | #150, #501, #574 | `fe44325a34f8ba48a1a8f1e6069852825310bf03` | — | d/p/qparetoのratio DD, powNeg subnormal, a*e correction, lower-tail log, quantile log overflowを再監査。 | 入力: `dpareto(1.1e-263,{a:1640,b:7.8e-264,log:true})`, `dpareto(Number.MIN_VALUE,{a:1e308,b:Number.MIN_VALUE,log:true})`, `ppareto(318.7041047333832,{a:1.040734e-317,b:1,logP:true})`, `ppareto(1e308,{a:1e-308,b:1,lowerTail:false,logP:true})`, `qpareto(0.5,{a:1e308,b:1e-308})`, `qpareto(-1000,{a:1e-308,b:1e-308,logP:true})`, `qpareto(0.5,{a:Infinity,b:1})`。ratio high=1 low residual、powNeg fallback、log tail a*log(r) underflow、exp(t) overflow時log b救済を追跡。`b=Infinity`はvalid()で拒否し、extraDistrの有限scale parameter contract外。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/distributions/poisson.ts` | 問題未検出・追加監査済み | #104, #568 | `8bac99d8cfb238c1d682278c145798d0c44abc0b` | — | dpois/ppois/qpoisの2^53超補正、gammaInc差分、lambda=0/Inf、q rounding、discreteQuantile停止を再監査。 | 入力: `dpois(0,0)`, `dpois(1,0)`, `dpois(1e16,1e16,{log:true})`, `ppois(1e16,1e16)`, `ppois(1e16,1e16,{lowerTail:false,logP:true})`, `ppois(1,1e16,{lowerTail:false,logP:true})`, `ppois(1e16+2,1e16)`, `qpois(0.5,1e16)`, `qpois(1e-300,1e-300)`, `qpois(0.5,Number.MIN_VALUE)`, `ppois(-1,Infinity)`, `ppois(Infinity,Infinity)`。x+1 rounding correction identity and upper-tail logSubExp fallback verified; no analogous n-x subtraction exists. lambda=Infinity q invalidity matches wrapper guard. New reproducible defect none. Vitest/package runtime/R execution none. |
| `src/distributions/signrank.ts` | 追加監査済み・問題未検出 | #151, #628 | `3d9623ccac1dc46974fd7f01cbcbb44e931cfcb6` | — | R由来dsignrank/psignrank/qsignrank fixtureと既存property regressionを閲覧（未実行） | nのhalf-even丸め、x/qの整数化規則、支持域端点、subset-sum DPの降順更新、2^900スケーリング、minTrustedによる精度判定、low table再構築、Kahan累積、対称性を使った小さいtail直接計算、log確率、LRU cache budget、MAX_LEN拒否、離散quantile探索を追跡。具体的入力: `dsignrank(0,1100)`、`psignrank(40,10,{lowerTail:false})`、`qsignrank(0.025,10)`、`dsignrank(20,1100)`。中心まで拡張済みのテーブルから低位確率を読む既知回帰条件も確認。#628追加監査: n half-even境界と2^27上限、qのR互換`roundHalfEven(q+1e-7)`（geometric/negative-binomialのfloorバグとは異なりR signrank仕様に一致）、support反射、DPの降順更新、rescale trustLog2/minTrusted、cache growth/eviction、low-table rebuild、Kahan累積、subnormal probabilityのlog復元、discrete quantile比較のtail切替を再追跡。追加入力: `psignrank(0.99999999,1)`, `psignrank(0.99999999,2)`, `psignrank(1.00000001,2)`, `psignrank(-0.00000001,2)`, `psignrank(3.6,5)`, `dsignrank(0.5,5)`, `dsignrank(1e-8,5)`, `qsignrank(-1000,1100,{logP:true})`, `psignrank(605549,1100,{lowerTail:false,logP:true})`。R force-integerの挙動と一致する境界で、新たな再現不具合は確定せず。Vitest/package runtime/R実行なし。 |
| `src/distributions/summary.ts` | 問題あり・追加監査済み | #871, #872 | `ce6ccc1d988363476d4953c2868e4d9c8fcaba94` | [#385](https://github.com/numero-uno-jpn/rStats.js/issues/385) (open); [#386](https://github.com/numero-uno-jpn/rStats.js/issues/386) (open) | 分布summaryの巨大・微小パラメータ域、parameterization contract、central moment scalingを追加監査。 | #733 triangular: a=1e308,b=1.0000000000000004e308,c=1.0000000000000002e308。対称triangleでskewness=0、sd≈8.15e291 finite、varianceはtrue overflowでInfinityだがraw qはInfinity-InfinityでNaN。Issue #243。#734 hyper: m=n=k=1e150でN=2e150、mean=5e149、variance≈1.25e149、excess kurtosis≈-1e-150だが高次積がoverflowしてNaN。Issue #244。#735 gamma: distSummary('gamma',{shape:2,rate:2,scale:1})がgammaScale()を通さず不一致rateを無視。Issue #245。#739 Kumaraswamy: a=b=1e308で集中幅O(1e-308)をquadrature/raw momentsが解像できず、sd≈1.28255e-308、skewness≈-1.13955、excess kurtosis≈2.4を失う。Issue #249。静的代数・漸近・IEEE-754解析のみ。Vitest/package runtime/R/QUADPACK未実施。 | #385: beta kurtosisの中間積overflow。#386: central()でv**1.5/v²がunderflowし、Kumaraswamyのskewness/kurtosisがInfinity。
| `src/distributions/t.ts` | 問題未検出・追加監査済み | #158, #563 | `78247f0318768944233dc6e92874409b23e432b8` | — | dt/pt/qtのtiny-df近似、巨大df正規極限、betaArgs scaling、subnormal x/tail、deep quantile初期値を再監査。 | 入力: `dt(0,5)`, `dt(1.5e154,1e308,{log:true})`, `dt(5*Number.MIN_VALUE,1e-20)`, `pt(-3.5e151,4.3e121,{logP:true})`, `pt(5*Number.MIN_VALUE,8000,{logP:true})`, `qt(0.499999999,1e-10,{lowerTail:false})`, `qt(1e-5,1e-310,{lowerTail:false})`, `qt(3.048e-196,0.633)`, `qt(0.5,Number.MIN_VALUE)`。dtCoreのx²/n overflow、dtTinyDfのu overflow、betaArgs共通スケーリング、pt upper-tail complement、qt tiny-df逆変換と最大有限double判定を追跡。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/distributions/triangular.ts` | 問題あり・追加監査済み | #97, #576 | `1cfca6585cf8bad66c282af3b6973fbb8086f288` | [#121](https://github.com/numero-uno-jpn/rStats.js/issues/121) (open) | dtriang/ptriang/qtriangのendpoint mode、wide interval scaling、subnormal tails、logP quantile factorizationを再監査。 | #121: `qtriang(-1000,{a:0,b:1e308,c:0,logP:true})`、`qtriang(-1000,{a:-1e308,b:0,c:0,lowerTail:false,logP:true})`。`exp(-1000)=0`だが、modeがendpointなら距離は`w*exp(-1000)/2≈2.5379794487747284e-127`でfinite。`sqrtP=exp(p/2)`は復元するが、endpoint-mode near-peak branchはunderflow済みlower/upper=0を使用し端点に戻る。Issue #121。density endpoints、c=a/b、tails positive sum/logFar、width overflow、quantile sqrt-tail pathも確認。Vitest/package runtime/R実行なし。 |
| `src/distributions/tukey.ts` | 追加監査済み・問題未検出 | #159, #617 | `e18cb49f91c4d5667c40323080d741b3d2696738` | — | studentized rangeのClenshaw–Curtis適応積分、内側range CDF/補数、outer gamma積分、log-tail、small-q漸近、quantile bracket/Brentを追加監査。 | `ptukey(2**-1000,2,2)`, `ptukey(Number.MIN_VALUE,2,2,{logP:true})`, `ptukey(60,3,2,{lowerTail:false,logP:true})`, `ptukey(100,3,2,{lowerTail:false,logP:true})`, `ptukey(1e150,3,2,{lowerTail:false,logP:true})`, `qtukey(-745,2,2,{logP:true})`, `qtukey(-1e6,2,2,{logP:true})`, `qtukey(1-Number.EPSILON,2,2)`, `ptukey(3,2,Infinity)`, `qtukey(0.95,2,Infinity)`。CC node nesting/weights, adaptive piece caps, Gaussian window correction, upper-tail complement, df→∞ branch, outer gamma log transform, solver overflow bracket and Brent update were source-traced. 新規確定バグなし。Vitest/package runtime/R実行なし。
| `src/distributions/uniform.ts` | 問題未検出・追加監査済み | #572 | `a7f20c47baf7ce5f91bcd1941b62a3d24d7e3e1f` | — | dunif/punif/qunifの幅overflow、finite endpoint guard、logP subnormal quantile、upper-tail cancellationを再監査。 | 入力: `dunif(0,{min:-Number.MAX_VALUE,max:Number.MAX_VALUE})`, `dunif(0,{min:-Infinity,max:Infinity})`, `punif(1,{min:-Infinity,max:1})`, `punif(2,{min:-Infinity,max:1})`, `qunif(0.25,{min:-MAX,max:MAX})`, `qunif(-1000,{min:0,max:MAX,logP:true})`, `qunif(-1000,{min:-MAX,max:MAX,logP:true})`, `punif(1e-300,{lowerTail:false,logP:true})`, `dunif(0,{min:1,max:1})`。R punif.c finite endpoint guardの順序と一致。`qunif` logP<-708でexp(p)がunderflowして広い区間が回復できないR互換制約を確認。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/distributions/weibull.ts` | 問題あり・追加監査済み | #161, #556 | `f1c3e76bce8a68f936169e4a2e261b13e937b047` | [#111](https://github.com/numero-uno-jpn/rStats.js/issues/111) (open) | d/p/qweibullの既存極端値経路に加え、logRatioのnear-equal巨大shape/scale精度を再監査。 | 入力: `shape=2**52` (=4503599627370496), `scale=shape-0.5` (=4503599627370495.5), `x=scale`, `dweibull(x,shape,{scale,log:true})`。u=1、log density=`log(shape/scale)-1`。現在のshape/scale除算が`1+2^-52`に丸まり、Math.log後の値は約2.2204460492503128e-16。100桁Decimalでの真のlog ratioは約1.11022302462515660205e-16。現行log density -0.9999999999999998、正しい丸め -0.9999999999999999。Issue #111。その他logU/ddExp/pweibull/qweibullの境界は再確認。Vitest/package runtime/R実行なし。 |
| `src/distributions/wilcox.ts` | 問題あり | #162 | `e18cb49f91c4d5667c40323080d741b3d2696738` | [#37](https://github.com/numero-uno-jpn/rStats.js/issues/37) | Rと同じ分布の整数support。今回R実行なし。`2^53`境界の不具合はJS Numberの整数表現限界に起因 | `wilcoxParams` のhalf-even丸め・正整数条件・mn上限、qの`floor(q+1e-7)`、対称性、q-binomial係数のdouble-double再帰、rescale/minTrusted/cache/valid prefix、CDF上下尾、discrete quantileを追跡。具体的な境界再現: `const m=3,n=3002399751580331,q=2**53;`。厳密な整数積は`9007199254740993`だがbinary64の`m*n`は`9007199254740992`へ丸められ、検証条件`m*n > 2**53`を通過する。その後`pwilcox1`の`x >= m*n`が真となり、`pwilcox(q,m,n,{lowerTail:false,logP:true})`を`-Infinity`で返す。しかしqは真のsupport上端より1小さく、上側確率は端点質量`1/choose(m+n,m)>0`（logは約`-105.1`）。Issue #37。ほかに`dwilcox(0,1050,1050,{log:true})`のscale救済、中心部で精度保証できない場合のRangeError境界も確認。既存wilcox fixture/test sourceを閲覧、実行なし。 |
| `src/entries/descriptive.ts` | 問題未検出 | #172 | `e22826429f71e15fb26749fbc3bb1dc7430ccdb4` | — | re-export barrel。実装本体とのexport対応を静的確認（R実行対象外） | `descriptive` entryの全re-exportについてsource path、named exports、option/type exports、grouping/dataFrame/pivotの公開経路を照合。具体確認: `import * as d from "./entries/descriptive.js"` に相当するexport表と、`src/descriptive/{basic,quantile,rank,cov,table,missing,hist,moments,dataFrames,pivot}.ts` および`src/data/grouping.ts`のexport宣言を比較。欠落/重複/存在しないsymbolの再現可能な問題は確認せず。barrel単体に数値アルゴリズムなし。TypeScript build/package runtime未実行。 |
| `src/entries/distributions.ts` | 問題未検出 | #173 | `c06da849afc7406f4f2a37e6387a4febab3306d8` | — | package exports / bundle AREAS / implementation module pathsを静的照合 | d/p/q分布、追加分布、乱数関数、RNG state/stream、型exportを各実装moduleへ追跡。具体確認: `dnorm/pnorm/qnorm`→normal、`dhyper/phyper/qhyper`→hypergeometric、`distSummary`→summary、`setSeed/RNGkind`→rng、`sample`→sample、`r2dtable`→r2dtable。`package.json`の`./distributions`、`scripts/bundle.mjs`のAREASと一致。barrel内の独自演算なし。export名/パスに明白な不整合なし。TypeScript build/runtime未実行。 |
| `src/entries/linalg.ts` | 問題未検出 | #174 | `c06da849afc7406f4f2a37e6387a4febab3306d8` | — | package exports / bundle AREAS / implementation module pathsを静的照合 | crossprod/backsolve、norm、chol/chol2inv、QR family、solve/det/rcond、SVD、kappa/ginv、eigen、Schur、expm、matrix operations、LU/prcompと各型exportを追跡。具体確認: `qrQ/qrR/qrCoef/qrSolve`→qr、`determinant/rcond`→solve、`matMul/kronecker/seq`→ops、`prcomp/lu`→lu。`MatrixInput/VectorOrMatrix`型のmatrix module参照を確認。`package.json`の`./linalg`とbundle entryに一致。barrel内の独自演算なし。型チェック/build/runtime未実行。 |
| `src/entries/mixed.ts` | 問題未検出 | #175 | `c06da849afc7406f4f2a37e6387a4febab3306d8` | — | package exports / bundle AREAS / model module pathsを静的照合 | `lmer`とLmerResult/Options等の型、`lmerContest/lmerSummary`と検定表型、`lmerAnova`と単一fit/複数fitのANOVA・比較型を各model moduleへ追跡。具体確認: `lmer`→models/lmer、`lmerSummary`→models/lmerTest、`lmerAnova`→models/lmerAnova。root `src/index.ts`にはstar exportされないが、`package.json`に`./mixed`が明示され、bundle AREASにも`mixed`が含まれるため、独立サブパス公開として整合。barrelの欠落とは判定しない。build/runtime未実行。 |
| `src/entries/numerics.ts` | 問題未検出 | #176 | `c06da849afc7406f4f2a37e6387a4febab3306d8` | — | implementation moduleのexport宣言とpackage/bundle entryを静的照合 | `integrate/optimize/uniroot`とoptions/result型を`numerics/integrate.ts`へ、approx/spline familyをinterp、ode/OdeFunc/OdeOptionsをode、grad/hessian/jacobian/DerivOptionsをderiv、optim/optimHessと型をoptimへ追跡。特に`optimize`と`uniroot`がファイル名と異なる`integrate.ts`からexportされる点は実装上の意図どおり、同ファイルに3関数すべてのexport宣言を確認。`package.json`の`./numerics`とbundle AREASに一致。数値本体の全域精度監査は別対象。build/runtime未実行。 |
| `src/entries/special.ts` | 問題未検出 | #177 | `c06da849afc7406f4f2a37e6387a4febab3306d8` | — | special implementation module pathsとpackage/bundle entryを静的照合 | gamma/lgamma、beta/lbeta、choose/factorial、digamma/trigamma/psigamma、Bessel I/K/J/Y、erf/erfc、gammainc/erfinv/erfcinv/perm、log1pmx/lgamma1p/log1mexp/log1pexpと型を各special moduleへ追跡。具体確認: `RCompatibleOptions`→rCompatible、`BesselOptions`→besselIK、`GammaincResult`→extra。`package.json`の`./special`とbundle AREASに一致。barrel内の独自数値演算なし。build/runtime未実行。 |
| `src/entries/tests.ts` | 問題未検出 | #178 | `b1f99b610908221c1380f18c8edf4b3bb8551e5e` | — | 該当なし（API re-export barrel） | 静的なexport/path照合。TypeScript build・package runtime・Vitest・R実行なし。 |
| `src/htest/agreement.ts` | 問題あり・追加監査済み | #179, #618, #878 | `435f225cc5d16a9d17207c2ebd1b7fd18bdb0386` | [#392](https://github.com/numero-uno-jpn/rStats.js/issues/392) (open) | kappa2/kappamFleiss/ICC/Cronbach alpha/partialRの退化データ、定数列、カテゴリ符号化、df/variance境界、信頼区間係数、Schur complementを再監査。 | 入力: `kappa2([[1,1],[1,1]],{weight:'equal'})`; `kappa2([[1,1],[1,1]])`; `kappamFleiss([[1,1],[1,1]])`; `kappamFleiss([[1,1],[1,1]],{exact:true})`; `icc([[1,2],[2,3],[3,4]],{model:'twoway',type:'agreement'})`; `icc([[1,1],[2,2],[3,3]],{model:'twoway',type:'agreement'})`; `cronbachAlpha([[1,2],[2,4],[3,6]])`; `partialR([[1,2],[2,4],[3,6]],0,1)`。c=1重みの0/0は退化kappaで係数自体が未定義、ICC perfect/additive dataの分散0と信頼区間、alphaの1項目drop、partial correlationのsingular correlationを追跡。新規の独立した確定バグなし。Vitest/package runtime/R実行なし。 #878: two-way ICCのMSEを独立丸めしたSST/MSR/MSCの差で求めると小さなinteraction残差がcancelし、ICC=1/F=Infinityとなる。
| `src/htest/ansariTest.ts` | 問題未検出 | #180, #599 | `9f13bb6d406d4f36761a562aed8bb17c0ce52db4` | — | R 4.5.2 ansari.test fixtureおよびmpmath exact-distribution fixturesを閲覧（未実行）。 | Exact/normal branch、tiesによる切替、片側・両側tail、中心値、奇数/偶数Nの分散式、NaN除外、Infのrank、confidence intervalのcandidate ratio・root範囲・non-finite endpointsを再監査。具体入力: `ansariTest([-2,-1,1,2],[-4,-3,3,4],{confInt:true})`; `ansariTest([1,2,3,4],[2,4,6,8],{exact:true})`; `ansariTest([1,1,2],[2,3,3],{exact:true,confInt:true})`; `ansariTest([1,2],[3,4],{exact:false})`; `ansariTest([1e308],[1e-308],{exact:true,confInt:true})`; `ansariTest([1,Infinity],[2,3],{exact:false})`; `ansariTest([NaN,1,2],[3,4])`。通常近似のvarianceはtie score平方和から計算され、観測されたrank scoreの平方和を用いる式と整合。N=2ではvarianceが0となる退化ケースがあり、正常近似p値はNaNとなるが、Ansari scoreが全員同一で検定情報がないため別途明示的に仕様確認が必要であり、ここでは不具合と断定しない。exact intervalのratioがInfinity/NaNとなる境界も追跡し、確定的な誤結果を確認できず。`test/htest-core/ansari.test.ts` SHA `e9b5106af7a0d088e8bcda580b393d273992b4f2`、`src/htest/core/ansari.ts` SHA `0de0bf2ccae23fb0e98115d356a4cd5c8e48ac5f` 閲覧。fixtureに追加の回帰ケースなし。Vitest/R未実行。 |
| `src/htest/aov.ts` | 問題未検出 | #181 | `b1f99b610908221c1380f18c8edf4b3bb8551e5e` | — | R 4.5.2 aov/TukeyHSDおよびBSDA::z.test由来fixtureを閲覧（未実行）。 | 具体入力: `aov([[2.9,3.0,2.5,2.6,3.2],[3.8,2.7,4.0,2.4],[2.8,3.4,3.7,2.2,2.0]])`; `aov("y ~ g",{y:[4.2,5.1,6.3,5.8,7.9,8.4],g:["a","a","b","b","c","c"]})`; `TukeyHSD([1.2,2.3,1.8,2.9,3.1,3.6,4.0,4.4,5.2],["a","a","a","b","b","b","c","c","c"])`; `zTest([5.1,4.9,5.6,5.8,6.0],{mu:5,sigmaX:0.5})`; extreme probe `zTest([1e308,1e308,1e308],{sigmaX:1e308})`. `test/anova.test.ts` と `test/fixtures/aovOneway.json` を閲覧。ソース・fixture確認のみ。Vitest/R実行なし。 |
| `src/htest/binomTest.ts` | 問題未検出 | #182, #525 | `4e514e3164c1f852b325a5a04b099effc73d218c` | — | Rの現行 `binom.test.R` のminlike実装と照合。Rはlog PMF比較、JSはlinear PMF比較。 | 具体入力: `binomTest(682,925,{p:0.75})`; `binomTest([3,7],{p:0.5})`; `binomTest(0,10,{p:0})`; `binomTest(10,10,{p:1})`; `binomTest(0,2000,{p:0.5})`; `binomTest(1,5,{p:0.5,alternative:"greater",confLevel:0.5872345434452184})`. `test/fixtures/binomTest.json`（166 cases）と `test/fixtures/htest_binomTest.scipy.json` を閲覧。二側確率の探索は平均の両側で単調な区間だけを二分探索する構造を確認。ソース・fixture確認のみ。Vitest/R実行なし。 |
| `src/htest/brunnerMunzelTest.ts` | 問題未検出 | #183, #600 | `3809905d6b8726a9b01afaf75deb0cbeb3082cac` | — | lawstat::brunner.munzel.test の R 4.5.2 fixture を閲覧（未実行）。 | #600追加監査: statisticの符号とalternativeのtail対応（greaterはxが大きい方向なので負のWにlower-tail、lessは正のWにupper-tail）、両側の小さいtail直接計算、CIのqt上側分位点、estimateのrelative effect定義を式から再確認。`rank()` comparatorの有限値差overflowおよび±Infinity同士のNaN comparatorは、差の符号またはindex fallbackで順序・tie groupingを維持する。具体入力: `brunnerMunzelTest([1,2],[3,4],{alternative:"greater"})`; `brunnerMunzelTest([3,4],[1,2],{alternative:"less"})`; `brunnerMunzelTest([1,2],[1.5,3])`; `brunnerMunzelTest([-Infinity,0,Infinity],[1,2,Infinity])`; `brunnerMunzelTest([1e308,-1e308],[0,1])`; `brunnerMunzelTest([1,2],[3,4],{confLevel:0.5})`; `brunnerMunzelTest([1],[2,3])`。既存 #183 で扱った完全分離・1例群の退化挙動と重複するIssueは作成せず。fixture SHA `169f6f8ac826faa69ab9617e6236c25bce32dc55`（R 4.5.2）閲覧。テスト実行なし。|
| `src/htest/chisqTest.ts` | 問題あり・追加監査済み | #184, #621 | `e014c17e1cc14604e869b32d32af72dc1a9d8f36`; current audit SHA `314812b169de5e663b293c4f7a3fa07415adb130` | [#42](https://github.com/numero-uno-jpn/rStats.js/issues/42), [#141](https://github.com/numero-uno-jpn/rStats.js/issues/141) | R 4.5.2 chisq.test fixture と C locale の並び順を仕様根拠として閲覧（R実行なし）。今回の期待度数overflowの期待値はPearson goodness-of-fitの定義と等確率入力から導出。 | #184: goodness-of-fit/contingency dispatch、行列shape、1行/1列matrix、Yates補正、zero margin、expected count NaN、double-double総和、Monte Carlo B/seed/整数count条件、Patefield table生成、factor欠損ペア除外を追跡。`byCodePoint`（158行）はJS UTF-16 code-unit比較のためUnicode code-point順と異なる。`chisqTest(["\\u{10000}","\\uE000","\\u{10000}","\\uE000"],["a","a","b","b"])`でrowLevels順が逆転。Issue #42。今回#621ではgoodness-of-fitの総数・期待度数・Pearson寄与・residual/stdres、p/rescaleP、zero-probability category、contingency margins/`productOver`、Yates、Monte Carlo dispatchを追加確認。`chisqTest([1e308,1e308])`は数学的総数2e308、各期待度数1e308でχ²=0, df=1, p=1が期待されるが、`ddSum`がInfinityを返し期待度数がInfinity、統計量NaNとなる。Issue #141。既存行の#184監査情報を保持。Vitest/package runtime/R未実施。 |
| `src/htest/cor.ts` | 問題あり | #185, #598 | `4ed4868b5441752c2b4581e85d2e9b2c0b015101` | [#40](https://github.com/numero-uno-jpn/rStats.js/issues/40), [#134](https://github.com/numero-uno-jpn/rStats.js/issues/134) | R 4.5.2 cor/cor.test fixture を閲覧（未実行）。Near-perfect correlation の期待値はRではなく高精度十進計算から算出。 | Pearson DDの端点clamp不具合は#40。追加監査でKendall normal approximationのn=2境界不具合を確認: `corTest([1,2],[1,2],{method:"kendall",exact:false})` では tie correction第2項が `0/(9*2*1*0)` となりvarS/z/pValueがNaN。tie補正項はn=2では0とすべきで、基本分散は1、z=1、両側p≈0.3173105079。Issue #134。`test/cor.test.ts` SHA `95ed4edf2429544c6f7b949e5e8516ad5bf64c52` はfixture駆動suiteのみでこの明示的n=2 exact:falseケースなし。静的追跡のみ、Vitest/R未実行。 |
| `src/htest/core/ansari.ts` | 問題未検出 | #186 | `e014c17e1cc14604e869b32d32af72dc1a9d8f36` | — | Ansari-Bradley exact distribution のR 4.5.2由来fixtureおよび独立整数count/brute-force fixture生成根拠を閲覧（未実行）。 | `ansariDist` のsubset-position DP確率遷移、tail境界、qの相対fuzz、quantileのupper-tail反転とslack、count DP、chooseによる正規化、cache key/再利用を追跡。具体入力: `pansariExact(5,3,4,true)`; `pansariExact(5,3,4,false)`; `dansariExact(5,3,4)`; `qansariExact(0.5,3,4)`; `qansariR(0.5,3,4)`; 境界 `qansariExact(0,3,4)` と `qansariExact(1,3,4)`。非整数m/nを拒否しない内部quantile helperの入力検証差も確認したが、public `ansariTest` は実データ長から整数m/nを生成し、このhelperは公開entryからexportされないため、現行公開経路の不具合とは判定しない。CHANGELOG v0.7.0 のansari interval追加・ties fallback記述を確認。ソース・fixture確認のみ。Vitest/package runtime/R実行なし。 |
| `src/htest/core/kolmogorov.ts` | 問題あり | #187 | `e014c17e1cc14604e869b32d32af72dc1a9d8f36` | [#41](https://github.com/numero-uno-jpn/rStats.js/issues/41) | Marsaglia-Tsang-Wang exact CDF、Kolmogorov limit、Birnbaum-Tingey one-sided tailの公開論文式およびmpmath/exact-rational fixtureを閲覧（未実行）。 | exact CDFの境界 `d<=1/(2n)`/`d>=1`、small-d閉形式、matrix H構成・power scaling、limitのsmall/large x級数とtail選択、one-sided upperの正項和・境界を追跡。確認した不具合: `pkolmogorovLimit` 156行で `x*x` がunderflowするほど小さい正のxでは、指数側が0となる一方で `sqrt(2π)/x` がInfinityとなり `Infinity*0=NaN`。具体入力: `pkolmogorovLimit(1e-200,true)` は下側tail 0、`pkolmogorovLimit(1e-200,false)` は上側tail 1が期待値だが、現行式はNaN。Issue #41（bug、領域: Kolmogorov numerical core、重要度: low）。CHANGELOGのKS追加/修正項目に当該small-x underflowの記録なし。ソース・fixtureとIEEE-754演算経路確認のみ。Vitest/package runtime/R実行なし。 |
| `src/htest/core/mantelhaen.ts` | 問題あり・追加監査済み | #188, #722 | `4b5a26bfeefa86028d47ad56711bfb92e4556b12` | [#232](https://github.com/numero-uno-jpn/rStats.js/issues/232) (open) | Exact conditional MHのsupport幅、convolution配列、allocation上限を再監査。 | #722: 2×2各セル1e9の層をexact:trueで渡すと、各層のhypergeometric supportは0..2,000,000,000。`stratumDensity()`が2,000,000,001個のFloat64（約16GB）を即時確保しようとする。入力は有限・非負・整数条件を通過する。OOM回避のため実行せず、静的allocation traceでIssue #232を登録。 |
| `src/htest/core/shapiro.ts` | 問題未検出（要実行確認事項あり） | #189 | `974d8755ed5b84e78da93f66b02f7faac3535ffa` | — | SciPy AS R94 reference fixture、R 4.5.2 shapiro.test fixtureを閲覧（未実行）。 | n=3 exact式、n=4/5/6境界の係数補正、n=11/12 p値近似切替、n=5000上限、係数の反対称性・二乗和、1-Wの因数分解、range scale、log(1-W)の裾確率を追跡。具体入力: `[1,2,3]`; `[1,1,1]`（公開APIで同一値拒否）; `[-1e308,0,1e308]`（range overflow対策）; `[Number.MIN_VALUE,0,1]`; `Array.from(swilkCoefficients(20))`（内部生成係数を標本値とするnear-W=1ストレス）。係数ベクトルを入力した場合に1-Wの浮動小数点符号が0近傍で敏感になる可能性を独立SciPy相当計算で確認したが、rStats.jsのqnorm/JS runtimeで再現確認できていないためIssue化せず、要runtime testとして留保。公開wrapperは3<=n<=5000、有限値、同一値を検証。Vitest/package runtime/R実行なし。 |
| `src/htest/core/simulate.ts` | 問題未検出 | #190 | `974d8755ed5b84e78da93f66b02f7faac3535ffa` | — | Rのas.character/pasteのB表記契約と呼出元chisqTest/fisherTestのsimulation fixtureを閲覧（未実行）。 | `formatR` のtoExponential(14)から15桁表現への選択、指数の符号・2桁padding、末尾0除去、±0/NaN/±Inf、`simulatedMethod` のmethod suffixを追跡。具体入力: `formatR(1)`, `formatR(1000)`, `formatR(1000000)`, `formatR(1e21)`, `formatR(1e-7)`, `formatR(-0)`, `formatR(Infinity)`; Bは呼出元で正整数検証されるため、fractional/negative Bは本helperの公開契約外。通常の整数Bに対するフォーマット不具合を確定せず。Vitest/package runtime/R実行なし。 |
| `src/htest/core/smirnov.ts` | 問題未検出 | #191 | `974d8755ed5b84e78da93f66b02f7faac3535ffa` | — | exact integer lattice-path/brute-force fixtureおよびtwo-sample KSのR fixtureを閲覧（未実行）。 | rolling-row DPのpath survival recurrence、first-boundary-hitの重複計数回避、hypergeometric path weight、two-sided/greater/less符号、ties時のpooled-z change points、d境界・relative fuzz、m/n integer validationを追跡。具体入力: `psmirnovUpper(0,3,4)`; `psmirnovUpper(1,3,4)`; `psmirnovUpper(0.5,3,4,{alternative:"greater"})`; `psmirnovUpper(0.5,3,4,{alternative:"less"})`; ties `psmirnovUpper(0.5,2,2,{z:[1,1,2,3]})`; z length mismatch。DP recurrenceとboundary hitの確率解釈をfixture/brute-force test設計と照合し、新規再現不具合なし。公開ksTestはNaNを除去し、m,n>=1を保証。Vitest/package runtime/R実行なし。 |
| `src/htest/dunnett.ts` | 問題未検出（内部前提あり） | #192 | `974d8755ed5b84e78da93f66b02f7faac3535ffa` | — | multcomp/PMCMRplus由来Dunnett fixtureと独立数値積分の既存テストを閲覧（未実行）。 | conditional Z0 integral、one/two-sided conditional exceedance、`logPhi`、`log1p/expm1` による1-product、狭い区間のtail差分、df=Infinity正規極限、finite-df log-U outer integral、stirlerr、QUADPACK ier/error gate、c=0/±Infを追跡。具体入力: `pDunnettUpper(0,[0.5,0.75],Infinity,false)`; `pDunnettUpper(0,[0.5,0.75],Infinity,true)`; `pDunnettUpper(Infinity,[0.5,0.75],10,false)`; `pDunnettUpper(-Infinity,[0.5,0.75],10,false)`; `pDunnettUpper(1.55,[0.5,0.75],Infinity,true)`。lambda in (0,1)、df>0、lambda非空はmultipleComparisonsのグループサイズ・pooled varianceから生成される内部前提で、core単独では検証されない。内側積分のierを検査しない点はソースコメントに明記された既知設計であり、直ちに誤差を実証できずIssue化しない。新規再現不具合なし。Vitest/package runtime/R実行なし。 |
| `src/htest/effectSize.ts` | 問題あり | #193, #624 | `2f1b77d5012396b88d1c36365045bf3c7b314e1d` | [#143](https://github.com/numero-uno-jpn/rStats.js/issues/143) | effectsize R 4.5.2 fixtures（cohens_d/hedges_g/eta_squared/omega_squared/epsilon_squared）と repeated-measures fixturesを閲覧（未実行）。 | Cohen's d one-/two-sample/paired、pooled/average SD、mu、NaN drop/Inf reject、Hedges JとlgammaDiff、noncentral-t root CI、ANOVA partial/plain/generalized eta、omega/epsilon、noncentral-F CI、Error strata/aovEz mapping、SS scaling、observed-factor term matchingを追跡。具体入力: `cohensD([5.1,4.9,6.2,5.8],[4.1,4.5,3.9,5.0])`; `hedgesG([1,2],[3,4])`（df=2近傍の補正）；`cohensD([1,2,3],undefined,{ci:null})`; `cohensD([1,1,1],[2,2,2],{ci:null})`（zero SD）；`cohensD([-1e308,0,1e308],undefined,{ci:null})`; `etaSquared(anova(lm("y ~ g",{y:[1,2,4,5,7,9],g:["a","a","b","b","c","c"]})),{ci:null})`; repeated-measures `aov("y ~ W + Error(id/W)", data)` paths. 新規確定バグ #143: `cohensD([1,1+Number.EPSILON],undefined,{mu:-1})` は有限・非定数の2標本だが、t=2^54となり `ncpOfT()` の `t-1` と `t+1` がともにtへ丸められる。`uniroot()` の初期 `lower < upper` 検証でRangeError。`hedgesG()`も同じhelperを通る。`ci:null`ではroot searchを通らない。具体的な丸め: `const t=2/(Number.EPSILON/2); t===2**54; t-1===t; t+1===t`。Issue #143。Vitest/package runtime/R executionなし。 |
| `src/htest/fisherTest.ts` | 問題あり | #194 | `489b31e26ff16939cef159a9de0baf0168f09738` | [#43](https://github.com/numero-uno-jpn/rStats.js/issues/43) | R 4.5.2 `stats::fisher.test` source `src/library/stats/R/fisher.test.R` を閲覧。conf.levelは0〜1を含む範囲で検証される。 | 2x2 noncentral hypergeometric support/density、psi=0/Inf、tail方向、minlike two-sided、conditional MLE、CI root方向、rxc Mehta-Patel network pruning、double-double log probability、zero-margin drop、Patefield simulation、B/seedを追跡。確認した不具合: `fisher2x2` の `confLevel` 検証が `>0 && <1` で、Rが受理する0と1を拒否する。具体入力: `fisherTest([[1,2],[3,4]],{confLevel:0})`; `fisherTest([[1,2],[3,4]],{confLevel:1})`。いずれも現状RangeError。Issue #43（bug、重要度low）。他の具体入力: `fisherTest([[0,3],[2,0]])`; `fisherTest([[1,2,0],[3,4,0]],{simulatePValue:true,B:100})`; `fisherTest([[1,2],[3,4]],{alternative:"greater",or:Infinity})`。2x2境界とrxcシミュレーション経路も確認。Vitest/package runtime/R実行なし。 |
| `src/htest/groups.ts` | 問題あり | #195 | `489b31e26ff16939cef159a9de0baf0168f09738` | [#44](https://github.com/numero-uno-jpn/rStats.js/issues/44) | R 4.5.2 factor coercion semanticsを確認。混在するnumeric/character labelsはcharacterへcoerceされてからlevels化される。 | list-form/x,g-form、NaN response/label pair drop、all-missing label、emptyGroups drop/error、numberLevels 15-digit collisions、label sorting、median midpoint、completeRows shapeを追跡。確認した不具合: `labelledGroups` はMap keyを元のnumber|stringの型付き値で保持するため、number 2とstring "2"を別groupにする一方、`levelText` は双方を同じ"2"に表示する。具体入力: `onewayTest([1,2,10,11,20,21,30,31],[2,2,"2","2",10,10,"10","10"])`。現在4群（重複表示名）となるが、R factor coercionでは2群（"10","2"）。Issue #44（bug、重要度medium、群構成と検定結果に影響）。追加入力: `median([-1e308,1e308])`; `median([1.7e308,1.79e308])`; `median([-Infinity,Infinity])`; all-NaN list groups. Vitest/package runtime/R実行なし。 |
| `src/htest/ksTest.ts` | 問題未検出（警告差異あり） | #196 | `489b31e26ff16939cef159a9de0baf0168f09738` | — | R 4.5.2 ks.test fixture、R patched documentation/sourceおよびSciPy 1.18.1 fixtureを閲覧（未実行）。 | one-sample D+/D-、continuous CDF callback range validation、tiesによるexact default切替、two-sided tailの1-P cancellation回避、two-sample pooled ECDFのtie-run endpoint、greater/less符号、exact threshold n<100/mn<10000、formula twoGroupDataを追跡。具体入力: `ksTest([0,0,1],q=>q<=0?0:q>=1?1:q)`; `ksTest([0,0,1],q=>q<=0?0:q>=1?1:q,{exact:true})`; `ksTest([1,2],[3,4],{alternative:"greater"})`; `ksTest([1,2],[1,3],{exact:true})`; `ksTest([1,2],q=>NaN)`; `ksTest([NaN,NaN],[1,2])`。default one-sample exact判定はtiesを除外。明示exact:trueではRも連続分布のties警告を出した上でexact経路を実行するため、数値経路の差は確認せず。Rはties警告を出すがrStats.js resultはwarningを返さない点を互換性メモとして記録。新規計算不具合なし。Vitest/package runtime/R実行なし。 |
| `src/htest/leveneTest.ts` | 問題あり・追加監査済み | #197, #879 | `8435c4cc11d3b0d9844fec9d5ca131f53b327371` | [#393](https://github.com/numero-uno-jpn/rStats.js/issues/393) (open) | R 4.5.2 car::leveneTest fixture（median/mean center）を閲覧（未実行）。 | center default median/mean、sorted factor labels、pairwise missing removal、all-missing groups drop、absolute deviation scaling、oneway ANOVA df/F/pを追跡。具体入力: `leveneTest([4.2,5.1,6.3,5.8,7.9,8.4,6.6,7.0,5.5],["a","a","a","b","b","b","c","c","c"])`; 同じ入力 `{center:"mean"}`; 欠損ペア `leveneTest([1,2,NaN,4,5,6],["a","a","a","b","b","b"])`; empty factor group; singleton群; constant groups; `[-1e308,1e308,-1e308,1e308]` scale stress; ±Infinity. No new confirmed defect; zero residual df/constant deviations produce degenerate ANOVA values and are retained as boundary cases pending runtime comparison. Vitest/package runtime/R実行なし。 | #879: 共通scaleが小群の値を0にし、Levene deviation/ANOVAの分散差を消失。
| `src/htest/mantelhaenTest.ts` | 問題あり・追加監査済み | #198, #714, #716 | `669a040db7481c9aad8d0da633a4e73f333b2488` | [#224](https://github.com/numero-uno-jpn/rStats.js/issues/224) (open); [#226](https://github.com/numero-uno-jpn/rStats.js/issues/226) (open) | 2x2xK asymptotic/exactとI×J×K general covariance matrixのwide-count scalingを再監査。 | #714: 3×3の各セル1e103の同一stratumを2層渡すと、general()の`t*t*(t-1)`がInfinity、`f=0`、`vr*vc=Infinity`となり、共分散行列にNaN。均衡表の統計量は数学的に0。Issue #224。#716: `[[1e308,1e308],[1e308,1e308]]`を2層渡すと各層合計4e308がInfinityとなり、2x2xK branchのmargins/expected/varianceがNaN。均衡表の統計量は0。Issue #226。静的数式・IEEE-754解析のみ。 |
| `src/htest/mcnemarTest.ts` | 問題あり | #199 | `8a97a5756c77d7d41ba872005f479f420a1dd851` | [#45](https://github.com/numero-uno-jpn/rStats.js/issues/45) | R/SciPy fixtures・sourceを閲覧（未実行）。 | square table、2x2 correction、r>2 symmetry sum、df、discordant zero、paired crossTable/missing/levels。再現: `mcnemarTest([1,1,"1","1",2,2,"2","2"],[1,"1",1,"1",2,"2","2",2])`。number 1とstring "1"が別levelだがR factorでは文字列化され同一levelとなる。4 levels vs 2 levelsでtable/dfが変わる。重要度medium。R 4.5.2 fixtures閲覧。Vitest/R未実行。 |
| `src/htest/multipleComparisons.ts` | 問題未検出 | #200 | `8a97a5756c77d7d41ba872005f479f420a1dd851` | — | R/SciPy fixtures・sourceを閲覧（未実行）。 | Dunn tie correction/adjustment、Dunnett familywise tails、Steel U rank/sign、DSCF variance、Games-Howell Welch/Satterthwaite、Tukey-Kramer、Dunn altp/stepwise ties。入力: 3群例 [1.2,2.3,1.8,2.9,3.1,3.6,4.0,4.4,5.2]; all-tied groups; two-group single-step; zero pooled SS; unequal n; tied adjusted p; extreme values。R PMCMRplus/dunn.test/multcomp fixtures閲覧。Vitest/R未実行。 |
| `src/htest/normalityTests.ts` | 問題あり | #871 | `5af37c355b8fd52a9168fe5edac16ac9a8bca83f` | [#384](https://github.com/numero-uno-jpn/rStats.js/issues/384) (open) | R/SciPy fixtures・sourceを閲覧（未実行）。 | AD/CVM/Lilliefors/Shapiro-Francia/Pearsonの統計量・近似p値・df・警告境界。Pearsonで `pnorm(z)===1` のときclass=`k+1`となり、`c<=k`で観測値を除外。再現: `const x=[...Array(99).fill(0),1e6]; pearsonTest(x)`。n=100、k=13、outlier z=9.9、counts合計99。最終binに含める必要あり。重要度medium。nortest 1.0-4 source/fixtures閲覧。Vitest/R未実行。 | #384: sfTestの独立丸めでWが1を超え、log(1-W)がNaNとなる有限通常値の再現。
| `src/htest/onewayTest.ts` | 問題あり・追加監査済み | #202, #879 | `f98a4ccac5bcdb527f738aca3479aa6eaf600a8a` | [#393](https://github.com/numero-uno-jpn/rStats.js/issues/393) (open) | R/SciPy fixtures・sourceを閲覧（未実行）。 | Classical F/Welch F、Satterthwaite df、群サイズ、zero variance、power-of-two scaling、formula interaction/missing、Shapiro-Wilk n=3/5000/5001、NaN/Inf/constant。入力: 例の3群 [2.9,3.0,2.5,2.6,3.2], [3.8,2.7,4.0,2.4], [2.8,3.4,3.7,2.2,2.0]; varEqual true/false; singleton; constant groups; [-1e308,0,1e308]; formula with two factors; shapiroTest([1,2,3])。Welch zero varianceのNaNはR比較未了で未認定。R/SciPy fixtures閲覧。Vitest/R未実行。 | #879: 共通scaleで小群varianceがunderflowし、Welch重みがInfinity/InfinityとなってNaN。
| `src/htest/pAdjust.ts` | 問題あり・追加監査済み | #203, #877 | `a9d8482a48313bc1c4874b7e2e8e3324fe3d36b3` | [#391](https://github.com/numero-uno-jpn/rStats.js/issues/391) (open) | R 4.5.2 `stats::p.adjust` の実装・仕様と照合（ソース/fixture閲覧、R実行なし）。Hommel n=2 special-caseは有効p値でHochbergと同値 | Holm/Hochbergの単調累積、BH/BY逆順cummin、BY調和数のdouble-double/大n漸近、HommelのSimes反復、NaN位置保持、n>lengthの未観測p扱い、略称/alias、空・単一・±Inf・範囲外pを確認。入力: `pAdjust([0.01,0.02,0.03,0.04,0.05])`; `pAdjust([NaN,0.01,0.2],{method:"BY",n:5})`; `pAdjust([0.01,0.2],{method:"hommel",n:5})`; `pAdjust([0.2,0.8],{method:"hommel"})`; `pAdjust([], {method:"hommel",n:3})`。Hommelの非整数n拒否・空ベクトルはRと異なると明記済み。大nのBY近似は境界付近を追加runtime比較する余地はあるが、再現欠陥なし。Vitest/package runtime/R未実行。`test/padjust.test.ts` とR p.adjust source/fixtureを閲覧。 | #877: Hommel法はaccepted n=100,000で約50億回の同期loopとなり、event loopを長時間block。
| `src/htest/pairwise.ts` | 問題あり | #204 | `a281c1fc348643b86370be97d94d35a18e1b8983` | [#44](https://github.com/numero-uno-jpn/rStats.js/issues/44) | R 4.5.2 `pairwise.*` / `factor()` semanticsと照合（ソース/fixture閲覧、R実行なし） | byLevelのgroup coercion/order、NaN応答除外（pairedは位置対応を保持）、pooled SD/df、paired/non-pooled t、Wilcoxon各pair、proportion pairs、下三角の比較順とpAdjust一括適用を追跡。確認した不具合: `numberLevels()`は数値だけ正規化し文字列を残すため、Mapが数値`2`と文字列`"2"`を別群として扱い、表示ラベルが重複。再現: `const x=[1,2,10,11,20,21,30,31]; const g=[2,2,"2","2",10,10,"10","10"]; pairwiseTTest(x,g)`。R factor coercionでは文字列levels `"10"`,`"2"`の2群だが現行は4群。`pairwiseWilcoxTest`も同じ`byLevel()`を使う。既存Issue #44に同一根本原因として追記済み。その他の通常/edge casesは既存 `test/htest-basic.test.ts` fixtureで比較設計を閲覧。Vitest/package runtime/R未実行。 |
| `src/htest/poissonTest.ts` | 問題あり・追加監査済み | #205, #713 | `61c2c6a882fc0672e73fe45b5a547b2494b4e444` | [#223](https://github.com/numero-uno-jpn/rStats.js/issues/223) (open) | R 4.5.2 `stats::poisson.test` fixtures/契約と2標本expected countのoverflow-safe式を再監査。 | #713: `poissonTest([1e308,0],{r:2,T:[1,1e308]}).parameter`。n*r*T1はInfinity、T1+r*T2もInfinity。fallback `(n*r)/(1+r*(T2/T1))` もInfinity/InfinityとなりNaNだが、数学的なexpected countは約1。Issue #223。1標本exact two-sided、mode/tie、far-tail search、Garwood CI、2標本conditional binomial、rate ratio、T/r/confLevel validationも再確認。静的IEEE-754解析のみ。 |
| `src/htest/polycor.ts` | 問題未検出 | #206 | `a281c1fc348643b86370be97d94d35a18e1b8983` | — | R 4.5.2 `polycor` / `mvtnorm` fixturesを閲覧（実行なし）。MLのreferenceはR optimizerの途中停止値ではなくfixtureのexact maximum | polychor table/vector dispatch・矩形形状・非負有限count、zero-margin除去、category coercion、marginal thresholds、pbvnorm rectangle probability、rho bound、polyserial ad-hoc estimate、standardisation、ML analytic gradient/Hessian/Newton/step-halving、boundary ridge、inverse Hessian、chisq/dfを追跡。入力: `polychor([[20,8,1],[5,30,9],[2,6,25]])`; `polychor([[50,0],[0,50]],{ML:true,stdErr:true})`; `polychor([[0,50],[50,0]],{stdErr:true})`; `polyserial([0.2,-1.1,0.8,1.5,-0.3,0.1,-0.9,2.0],[1,1,2,3,2,2,1,2],{ML:true,stdErr:true})`; zero-margin `polychor([[3,4],[0,0]])`; ragged table rejection. `test/polycor.test.ts`と`test/polycorML.test.ts`のfixture、pbvnorm境界testを閲覧。極端な非有限連続値/極端に希少なカテゴリは追加runtime検証候補だが不具合未認定。Vitest/package runtime/R未実行。 |
| `src/htest/power.ts` | 問題未検出 | #207 | `a281c1fc348643b86370be97d94d35a18e1b8983` | — | R 4.5.2 `power.t.test` / `power.prop.test` / `power.anova.test` fixtureと照合（実行なし）。Rのnoncentral pt/pf・uniroot精度差は既存known-differenceとして区別 | exactly-one-unknown判定、既定値、sigLevel/power/sd/variance/proportion/tol validation、one/two/paired t df・ncp・strict tail、proportion pooled variance/strict tail、ANOVA lambda/df、未知量root bracketとdelta=0/betweenVar=0非識別を追跡。入力: `powerTTest({n:20,delta:1})`; `powerTTest({delta:0.5,power:0.8})`; `powerTTest({n:20,delta:0,alternative:"two.sided",strict:true})`; `powerPropTest({n:50,p1:0.5,p2:0.75})`; `powerPropTest({n:30,p1:0.9,p2:1,power:0.8,strict:true})`（不可能条件/警告・root boundary）; `powerAnovaTest({groups:4,n:5,betweenVar:1,withinVar:3})`; `powerAnovaTest({groups:4,n:5,betweenVar:0,withinVar:3})`。連続値n/groupsのroot resultをintegerに丸めないのはR仕様。非識別量の専用RangeErrorも確認。`test/powerStats.test.ts`およびR fixture/known differencesを閲覧。Vitest/package runtime/R未実行。 |
| `src/htest/propTest.ts` | 問題あり・追加監査済み | #208, #619 | `dc71b22c88d12984b50c59b89fdec3e9748e4a19` | [#47](https://github.com/numero-uno-jpn/rStats.js/issues/47); [#139](https://github.com/numero-uno-jpn/rStats.js/issues/139) (open) | R 4.5.2 prop.test仕様・existing fixtureを再確認。 | #619: no-p equality pathのpooled proportion `sum(x)/sum(n)`で有限の群別count合計がoverflowする。再現: `propTest([5e307,5e307],[1e308,1e308],{correct:false})`。各群の比率は0.5で一致するため期待statistic=0,p=1だが、分母sum(n)=Infinityとなりpooled=0、期待成功数0、`squareOver(5e307,0)=Infinity`となる。既存#47（fractional count validation）とは独立。`test/fixtures/propTest.json`（R 4.5.2）を閲覧。Vitest/package runtime/R実行なし。 |
| `src/htest/mcnemarTest.ts` | 問題あり・追加監査済み | #199, #620 | `eef3749c5d76de672246eb7feff2d0bc976e12a8` | [#140](https://github.com/numero-uno-jpn/rStats.js/issues/140) | R 4.5.2のMcNemar検定式に対応する対称性統計量を確認。今回の不具合はR実行比較ではなく、有限な数学的χ²寄与とIEEE-754演算の乖離。 | 2×2 continuity correction有無、一般r×rの各非対角ペア、discordant pair=0、全ペア一致、有限・非負validation、squareOverのoverflow fallbackを追加監査。`mcnemarTest([[0,1e308],[8e307,0]],{correct:false})` では数学的寄与 `(2e307)^2/(1.8e308) ≈ 2.222222222222222e306` は有限だが、`1e308+8e307` がInfinityとなり `squareOver(2e307,Infinity)` が0を返す。同じ原因はdefault `correct:true` の2×2 branchにもある（`abs(1e308-8e307)-1` は2e307に丸められる）。Issue #140。Vitest/package runtime/R未実施。
| `src/htest/pwr.ts` | 問題未検出 | #209 | `6b5fa401398cf4b4ba9d0362a80df5f2424af58f` | — | CRAN pwr 1.3-0の公開Rソース/仕様と照合（未実行） | cohenES lookup、ES.h endpoints、ES.w1 zero expected cells、ES.w2 empty rows/columns and column-major accumulation、pwr t/t2n/2p/2p2n/p/norm/r/chisq/anova/f2のexactly-one-null、probability validation、alternative-specific effect sign/range、ncp、strict tail、root brackets、boundary/non-identifiable values、large ncp overflowを確認。入力: `esW1([0,0.5,0.5],[0,0.25,0.75])`; `esW1([0,1],[0.2,0.8])`; `esW2([[0.3,0.2],[0.1,0.4]])`; `pwrTTest({n:20,d:0.5})`; `pwrT2nTest({n1:20,n2:30,d:0.5})`; `pwrRTest({n:50,r:-0.3,alternative:"less"})`; `pwrRTest({n:50,power:0.8,alternative:"less"})`; `pwrChisqTest({w:0.3,N:100,df:3})`; `pwrAnovaTest({k:4,n:20,f:0.25})`。Rのpwr.r.testはlessで計算中rの符号を反転し、既知rを返すときも負値を返す；現行実装の符号処理と一致。有限だが非常に大きい値の追加runtime確認余地は残るが再現欠陥未認定。Vitest/package runtime/R未実行。 |
| `src/htest/rankTests.ts` | 問題未検出 | #210 | `6b5fa401398cf4b4ba9d0362a80df5f2424af58f` | — | R 4.5.2 rank tests / SciPy reference fixturesを閲覧（未実行） | Kruskal-Wallis tie correction、Friedman within-block ranks/ties/complete rows、Cochran Q binary validation、Quade range ranks/A-B residual and all-tie special case、Fligner median deviations/rank-normal scores/variance、Mood average tied position scores/exact score variance、NaN/Inf handling、formula adaptersを追跡。入力: `kruskalTest([[2,2],[2,2]])`; `friedmanTest([[1,1,1],[2,2,2]])`; `cochranQTest([[1,1,0],[0,0,0],[1,0,1]])`; `quadeTest([[1,2,3],[2,3,1],[3,1,2]])`; `flignerTest([[0,0],[1,1],[2,2]])`; `moodTest([0,1,2],[2,1,0])`; extreme finite range (-1e308,1e308). Degenerate tie cases can yield NaN by zero variance/tie correction, consistent with rank-test mathematical degeneracy; Quade's incomplete-row behavior is a documented deliberate difference from R's quade.test quirk and is covered by substitute fixture. No new reproducible defect. Vitest/package runtime/R未実行。 |
| `src/htest/tTest.ts` | 問題未検出 | #211 | `6b5fa401398cf4b4ba9d0362a80df5f2424af58f` | — | R 4.5.2 `stats::t.test` source/fixtureを閲覧（未実行） | one-sample/Welch/pooled/paired、NaN pairwise removal、sample-size minima、Satterthwaite df、pooled SS、scaleToUnit/pairedDifferences、mu scaling、essentially-constant threshold、one/two-sided tails、confidence endpoints、confLevel 0/1を確認。入力: `tTest([5.1,4.9,5.6,5.8,6.0,5.4],{mu:5})`; `tTest([1,2,3,4,5],[3,4,5,6,8])`; `tTest([1,2,3],[2,4,6],{paired:true})`; `tTest([1],[2,3],{varEqual:true})`; `tTest([1e-200,2e-200,3e-200])`; `tTest([1,2,3],{mu:Infinity})`。Infinite mu is not rejected by R (it checks NA, not finite); test fixture records interval NaN as known difference. No new reproducible defect. Vitest/package runtime/R未実行。 |
| `src/htest/testFormula.ts` | 問題未検出 | #212 | `f451809365f16c00924a0bfe90a72c9b25317b04` | — | R 4.5.2 formula methods source/contractと照合（未実行） | splitTilde, Pair(a,b), twoSampleData one/paired/two group validation, kSampleData, groupFactor/presentLevels, oneway interaction codes/stride, blockData complete unreplicated matrix, correlationData selectionを確認。correlationDataはrhsVariablesが2つあるか検証するだけだが、R cor.test.formulaもmodel.frame列数が2かを確認し、model.frameは元の2変数を評価してinteractionを追加列に展開しないため、`~ x * y` / `~ x:y`も2列なら受理される。初回に作成したIssue #48はR model.frame semanticsを誤認したfalse positiveとして訂正・close済み。再現確認用: `const data={x:[1,2,3,4,5],y:[5,4,3,2,1]}; corTest("~ x * y",data)`。その他のPair/interaction formula edgeは既存fixtureを閲覧。Vitest/package runtime/R未実行。 |
| `src/htest/trendTests.ts` | 問題あり | #213, #623, #875, #876 | `c32a6bd2ce87b0b0ba19286c0a2a807b1cf4ddf8` | [#50](https://github.com/numero-uno-jpn/rStats.js/issues/50); [#142](https://github.com/numero-uno-jpn/rStats.js/issues/142); [#389](https://github.com/numero-uno-jpn/rStats.js/issues/389) (open); [#390](https://github.com/numero-uno-jpn/rStats.js/issues/390) (closed/duplicate) | R 4.5.2 `stats::prop.trend.test` sourceの`lm(freq ~ score)`とmodel-frameの既定欠損除外を照合。DescToolsのJT定義・exact上限・tie varianceもsource/docsで照合（未実行） | propTrendTestのweighted regression、p=0/1、score NaN/Inf、length mismatch、constant score、整数カウント境界を確認。JonckheereのJT pair count、exact時のMann–Whitney分布convolution、tiedVariance、alternative方向、levels、空群、DescTools/clinfunの欠損・Inf差を追跡。再現: `propTrendTest([1,2,3,4],[10,10,10,10],[1,NaN,3,4])` は現行NaN。Rは`lm(freq ~ score)`のmodel frameで2行目をna.omitし、有限の統計量/p値を返す。Issue #50。#623追加監査: Jonckheere exact distributionのgroup-pair Mann–Whitney convolutionが独立性を誤仮定。具体例 `jonckheereTest([1,2,3],[1,2,3],{alternative:"two.sided",exact:true})`。3群各1例の真のJT分布はJT=0,1,2,3に確率1/6,2/6,2/6,1/6、観測JT=3の二側p=1/3。現行の独立Bernoulli 3個の畳込みはBinomial(3,1/2)となりp=1/4。Issue #142。normal-approximation varianceは本Issueの対象外。ほか`propTrendTest([15,10,8,4],[30,30,30,30])`; `jonckheereTest([1,2,2,3,4,5],[1,1,2,2,3,3],{alternative:"increasing"})`; `jonckheereTest([1,2,3,4],[1,1,2,2],{exact:true})`; `jonckheereTest([1,1,2,2,3,3],[1,1,2,2,3,3],{alternative:"increasing"})`。 #875: propTrendTestの有限巨大scoreで回帰平方和がoverflow。#876: Jonckheere upper-tail候補は既存Issueとの重複としてclose。
| `src/htest/types.ts` | 問題未検出 | #214 | `4a000f0c939846bd2886c7f429734acd06664b99` | — | R `match.arg`の一意prefix、各テストのconfidence level境界と照合（未実行） | Alternative/Sample/Counts/HTest型、`matchAlternative`の空・曖昧・一意prefix、closed/open confLevel validator、`isCount`の有限・非負・絶対許容差を確認。入力: `matchAlternative("t")`; `matchAlternative("two")`; `matchAlternative("")`; `isCount(1)`; `isCount(0.00000005)`; `isCount(0.0000002)`; `checkConfLevel(0)`; `checkConfLevelOpen(0)`。count toleranceは明示コメントどおり絶対値1e-7の意図的な許容。型定義とvalidation helperに新規の再現欠陥なし。
| `src/htest/varTest.ts` | 問題あり・追加監査済み | #215, #879 | `59bc0e8aa6156f995e26b29e45a3c5ab3632d2db` | [#393](https://github.com/numero-uno-jpn/rStats.js/issues/393) (open) | R 4.5.2 `stats::var.test` source/docs、Bartlett公式を照合（未実行）。両群定数時のthrowは既存review59で明示した仕様差 | F比・ratio帰無値・df・片側/両側tail・confInt quantile・finite-only除外・共通2冪scale、formula group extraction、Bartlett pooled variance/log variance/correction factor/dfを確認。入力: `varTest([1,3,2,5,4],[2,9,4,12,7,1])`; `varTest([1,1,1],[1,2,4])` (一方のみ分散0); `varTest([1,1,1],[2,2,2])` (両方0、既存review59で意図的にthrow); `varTest([1,2,3],[4,5,6],{alternative:"greater"})`; `bartlettTest([[1,3,2,5],[2,9,4,12,7],[3,3.5,4,2]])`; singleton/empty groups。Rの分散比と境界tailに沿う実装で、新規再現欠陥なし。 #879: 大きな定数群の共通scaleが他群の正のvarianceを0にし、両群定数として誤throw。
| `src/htest/wilcoxTest.ts` | 問題あり | #216, #601 | `e40880f46edb938f5ad4814187de0f2d27058eb0` | [#49](https://github.com/numero-uno-jpn/rStats.js/issues/49) | R 4.5.2+ `stats::wilcox.test` source/docsのsigned-rank/rank-sum、tie correction、zero-SD branchを照合（未実行） | #601追加監査: paired差分の生成とNaN除外、muの有限値検証、signed-rankのzero/tie分岐、rank-sumのmu適用範囲、exact CIのWalsh/pairwise difference順序統計、normal CIのroot endpoint/clampingとtolRoot検証を追跡。具体入力: `wilcoxTest([1,2,4],{mu:1,exact:false,confInt:true})`; `wilcoxTest([1,2,4],[0,1,2],{paired:true,mu:0.5,exact:false,confInt:true})`; `wilcoxTest([1,2],[3,4],{exact:true,confInt:true,alternative:"greater"})`; `wilcoxTest([1,2],[3,4],{exact:true,confInt:true,alternative:"less"})`; `wilcoxTest([1e308,-1e308],[0,1],{exact:false,confInt:true})`; `wilcoxTest([1,2,3],[1,2,3],{exact:false,confInt:true})`; `wilcoxTest([1,2,3],[1,2,3],{exact:false})`; `wilcoxTest([1,2,3],{mu:1e16,exact:false,confInt:true})`。Extreme finite pair differences can overflow to ±Infinity; normal CI explicitly rejects non-finite bounds rather than returning a misleading interval. Large mu can erase low-order variation in x-mu; this is inherent to the same IEEE-754 subtraction used for the null-shift statistic and needs R differential runtime testing before calling it an implementation defect. Existing all-tied two-sample zero-variance defect remains Issue #49; no distinct new reproducible defect found. `test/wilcox.test.ts` SHA `398e3898565215140422c24d2b60947c9827ccb8` fixture harness閲覧。Vitest/R未実行。
| `src/index.ts` | 問題未検出 | #217 | `325df03e925e9cda87ff608af8d1d6ca071ea08d` | — | 該当なし（公開APIのre-export barrel） | 公開APIのre-export構成を再監査。entries/special, distributions, tests, linalg, descriptive, numericsの6 barrelを再exportし、各subpathのpackage exportsと一致。`./mixed`は独立subpathとして定義され、root barrelから除外される設計。export衝突・到達不能な公開領域・build path不整合を確認できず。 
| `src/integrate/quadpack.ts` | 問題あり・追加監査済み | #218, #385, #388, #510, #578, #858 | `3aef9054b78a50c5ab55ed22008db69c56535d4c` | [#51](https://github.com/numero-uno-jpn/rStats.js/issues/51) (closed/fixed); [#122](https://github.com/numero-uno-jpn/rStats.js/issues/122) (open); [#369](https://github.com/numero-uno-jpn/rStats.js/issues/369) (open) | dqk21/dqk15i、adaptive/dqelg/dqpsrt、dqagse/dqagie、integrate wrapperのwide-interval scalingとtolerance rescalingを再監査。 | #51修正確認: `integrate.ts`が`2*max(|a|,|b|)` overflow時にx=2uで積分し、結果/errorを2倍するため、dqk21 midpoint overflowを回避。新規#122: `integrate(x=>1e-308,-1e308,1e308,{absTol:Number.MIN_VALUE,relTol:0})`。scale branchで`absTol*0.5`が0にunderflowし、dqagseの`epsabs<=0 && epsrel<max(...)` validationがier=6、wrapperがRangeError。正しい積分は2。Gauss/Kronrod重み、error rescaling、epsilon table、iord、infinite transformとJacobian、subdivision limitを確認。Vitest/package runtime/R実行なし。 #858: `adaptive()`はlimit+1長のFloat64Array×4とInt32Arrayを直接確保する。`subdivisions=2**32`はtyped-array length上限を超える。allocation前の明示上限が必要。巨大確保は未実行。 |
| `src/internal/covmat.ts` | 問題あり・追加監査済み | #219, #369, #587 | `a042245164638b0c486c769de2c2a9a0eed622cd` | [#99](https://github.com/numero-uno-jpn/rStats.js/issues/99) (open) | R 4.5.x `isSymmetric()`/`all.equal.numeric()`の比較対象選別と相対誤差スケールを照合（R実行なし）。 | 既存#99を再検証。元の`Number.MIN_VALUE`例はRのabsolute-tolerance fallbackでも受理されるため単独では仕様差を示さない。一方、`S=[[1e308,1e-10],[0,1]]`では`scaleToUnit`のk=1023により非対称成分が約`1.112537e-318`へ縮小。JS `isSymmetric`は等しい巨大対角要素も分母`size`へ加えるため相対差約`2e-318`として受理する。R `all.equal`は一致要素を除外し、差分要素`c(0,1e-10)`対`c(1e-10,0)`のmean absolute difference=`1e-10`、mean absolute target=`5e-11`、relative difference=2となり拒否する。既存Issue #99をこの正確な再現例・根拠へ更新。`eigen.ts`と`summary.ts`の関連処理も追跡。Vitest/package runtime/R実行なし。 |
| `src/internal/ddexp.ts` | 問題あり・追加監査済み | #220, #553 | `14e46651c7ff1d1a6269ab50eded32183465172d` | [#52](https://github.com/numero-uno-jpn/rStats.js/issues/52) (closed/fixed); [#54](https://github.com/numero-uno-jpn/rStats.js/issues/54) (closed/fixed); [#108](https://github.com/numero-uno-jpn/rStats.js/issues/108) (open) | ddExp、standardizeDD/divideTail、expNeg/expNegOver、log-sum-exp、locationScale/affineを最新HEADで再監査。 | #52修正確認: `twoProd(1e308,1e308)`以外のfinite productではVeltkamp分割、splitter overflow時は`prodErrScaled`で両指数を合算してrescale。`locationScale(-1,1e308,1e-308)`の積誤差保持経路を確認。#54修正確認: `logAddExp(±Infinity,±Infinity)`の明示guard。#108関連: `affine(3,Infinity,0)`および`locationScale(3,Infinity,0)`は3を返す意図的中央値極限だが、R qnormはsigma>0時にmu+sigma*valを返し、median val=0ではNaN。Issue #108として互換性差を記録。`expNegOver`のt=2000 cutoff、s=MIN_VALUE〜MAX_VALUE scaling、subnormal final rounding、`standardizeDD`のoverflow/subnormal recursion、log1mExp/logSubExp境界を追跡。追加の独立再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/internal/discrete.ts` | 問題未検出・修正確認済み | #221, #575 | `6319e35f7decd8ece94884a858eaf89789656788` | [#53](https://github.com/numero-uno-jpn/rStats.js/issues/53) (closed/fixed) | discreteQuantile/firstTrue/lastTrueの2^53 spacing、doubling overflow、finite top fallback、bisection progressを再監査。 | #53修正確認: `firstTrue(x=>x>=1.6e308,1e308,Infinity)`ではdoubling overflow後に`Number.MAX_VALUE`を上限候補に採用し、有限区間をbisectする。`pred(Number.MAX_VALUE)`がfalseならhi+1 sentinelを返す。`j===Number.MAX_VALUE`での終了guardも確認。`discreteQuantile`側は同じMAX_VALUE probeを既に持つ。`lastTrue`のfinite support範囲、NaN propagation、step doublingとmidpoint stagnationを追跡。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/internal/dpq.ts` | 問題未検出 | #120 | `543eb6ceb3de7627a7562b035a931a88da424aa7` | — | Rと同じ（lower.tail/log.pの仕様） | #120でsmallerTailのp>1/2時の尾部反転、linearTarget保持、logP時のexpm1補数を再確認。qgamma 3286件のR 4.5.2 fixtureを閲覧、未実行。 |
| `src/internal/extremes.ts` | 問題未検出 | #222 | `467080a00d97d2c069779452bd5eb30b93047b7b` | — | Math.max/Math.min IEEE-754 semanticsおよびsafe midpointの算術から判定（R関数比較対象外） | maxOf/minOfの空配列、NaN、±Infinity、±0、疎配列、ArrayLike/typed array大容量と、midpointの同符号overflow・異符号極値・subnormal tieを確認。入力: `maxOf([])`; `minOf([])`; `maxOf([NaN,2])`; `minOf([-0,0])`; `midpoint(Number.MAX_VALUE,Number.MAX_VALUE)`; `midpoint(-Number.MAX_VALUE,Number.MAX_VALUE)`; `midpoint(Number.MAX_VALUE,0.9*Number.MAX_VALUE)`; `midpoint(Number.MIN_VALUE,0)`。空配列の±Infinity、NaN伝播、signed-zeroはMath.max/minと一致。midpointは通常式でoverflowした場合のみ半値和へfallbackし、有限な真の平均を保つ。新規再現欠陥なし。
| `src/internal/fround.ts` | 問題未検出 | #223 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | IEEE-754 binary64のroundingとR `round`/`zapsmall`の仕様記述をソース照合（実行なし） | half-even、負数、負のゼロ、subnormal、digits=-308/323境界、15桁早期return、zapsmallのNaN/Inf混在を確認。入力: `roundR(2.5)`; `roundR(-2.5)`; `roundR(1.25,1)`; `roundR(-1.25,1)`; `roundR(Number.MIN_VALUE,323)`; `roundR(1e308,-308)`; `zapsmall([[1e308,1e-308],[NaN,Infinity]])`。桁数丸め・二進浮動小数の候補距離・tie-even処理に再現可能な誤りなし。 |
| `src/internal/integer.ts` | 問題未検出 | #224 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | Rの整数引数半整数処理と相対許容差の仕様コメントを照合（実行なし） | `roundHalfEven`の±0.5/±1.5/±2.5、2^53以上の表現可能整数、`nonInt`の1e-9相対slack、NaN/±Infを確認。入力: `nonInt(2+1.1e-9)`; `nonInt(2+2e-9)`; `nonInt(2**53)`; `nonInt(Infinity)`; `nonInt(NaN)`; `roundHalfEven(-1.5)`; `roundHalfEven(2.5)`。非有限値は別途parameter validationを担う呼出元で扱われる。新規再現欠陥なし。 |
| `src/internal/invert.ts` | 問題あり・追加監査済み | #225, #574, #857 | `54aeaa15ec93053e2dd5fd19fc640a9fbf243a76` | [#368](https://github.com/numero-uno-jpn/rStats.js/issues/368) (open) | invertContinuousの全呼出元を再確認し、positive log-coordinate Newton/Halley、bracket、polish、bitwise bisectionを監査。 | 呼出元: `src/distributions/t.ts`, `f.ts`, `beta.ts`, `gamma.ts`。すべてpositive supportで`positive:true`を指定。したがって非positiveのfinite opposite-sign bracketで`lo+(hi-lo)/2`がoverflowする懸念は公開呼出経路に到達しない。入力相当: `qgamma(1e-300,2)`, `qgamma(1-1e-15,2)`, `qbeta(3.8e-277,27.9,1.5e299)`, `qchisq(1.5e-233,6.3e234)`, `qt(1e-300,0.633)`。linearTarget residual、cdfBoth、Halley ratio guard、stuck、log x convergence、polish/bisectXのsubnormal/overflow範囲を追跡。新規再現バグなし。Vitest/package runtime/R実行なし。 #857: positive log-coordinate inversionでも`toX=Math.exp`で標準化quantileをbinary64へ戻すため、scaleで有限域へ戻る解を表現できない。`qgamma`のscale込み座標で解く必要。静的解析のみ。 |
| `src/internal/levels.ts` | 問題未検出 | #226 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | R factor/as.characterの15 significant digits仕様と既存numberLevels testsを照合（実行なし） | sort→formatR→同一文字列level統合、-0正規化、NaN保持、非数値label不変、±Infの文字表記を確認。入力: `numberLevels([0.1+0.2,0.3,1e15,1e15+1,-0,0,NaN,Infinity,-Infinity])`; `levelText(1/3)`。`test/numberLevels.test.ts`は0.1+0.2/0.3、1e15/1e15+1の統合とTukeyHSD/pairwise row/col namesを固定。新規再現欠陥なし。 |
| `src/internal/noncentral.ts` | 問題未検出・追加監査済み | #227, #577 | `0a7c75dcdcc9bcf9a4b3bbd75ed613e5c6046ad7` | — | ordered-double key、searchDoubles/narrowQuantile、Gauss-Kronrod適応積分と全呼出元の区間範囲、negligibleNcpを再監査。 | 入力相当: `searchDoubles(1,0,2,x=>x>=1.5)`, `searchDoubles(-1,-2,0,x=>x>=-0.5)`, `searchDoubles(Number.MIN_VALUE,0,1,x=>x>=2*Number.MIN_VALUE)`, `narrowQuantile(1e200,Number.MAX_VALUE,x=>x>=1e200)`, `quadratureControl(1e-15,4000)`, `negligibleNcp(1e-30,1)`。doubleKeyは±Infinity/±0を含むordered keyでsearch bracketの順序を保持。全kronrodAdaptive呼出元（nchisq bessel/debye tails、nbeta integral）を確認し、区間は非負offsetまたはlog-coordinateの有限範囲で、`(a+b)/2`の同符号巨大値overflowは到達しない。depth 40/maxBisections停止、NaN/Infinity integrandの扱いを確認。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/internal/poissonMixture.ts` | 問題あり・追加監査済み | #228, #309, #576 | `f0c6a1cf85875cf87f5174c0fcc5575e31db5746` | [#64](https://github.com/numero-uno-jpn/rStats.js/issues/64) (closed/not reproducible) | Scaled mantissa/exponent、startSearchの2^53超、argmax/farEdgeのピーク移動、sumLower/Upperのindex progress、MAX_TERMS、density mixtureを再監査。 | #64の再確認: `pchisq(9e-301,1,{ncp:1e308,lowerTail:true})`は`pnchisq1`のChernoff negligibleTailでmixtureに入らず0/log -5e307。mixtureへ入る場合も`sumLower`の`J>LONG_WALK`が`argmax`でピーク（j≈z/2）へ移動し、z<=1e6の経路ではindexは2^53未満。`mu>1e8`のnchisq upper tailはlower sumから補完。nbeta/noncentral-Fは`method()`が大muをintegral等へdispatchしmixtureを避ける。`sumUpper`のj++、`sumLower`のj--は一般内部契約として巨大indexなら停滞し得るが、現行公開呼出経路のdispatch/preflightで再現可能なhangなし。Issue #64はclosed/not reproducible（コメントで3400件sweep報告）。新規不具合なし。Vitest/package runtime/Rは未実行。 |
| `src/internal/scaledInverse.ts` | 問題未検出 | #229 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | Cholesky標準誤差計算の列別2冪スケーリングとchol2invをソース照合（実行なし） | upper triangleの各列max、2^-400/2^400閾値、subnormal/巨大列のexponent、inverseの`2^(-e_j-e_k)`復元側の呼出契約を確認。入力: `[[1e-200,2e-200],[0,1e-200]]`; `[[1e200,2e200],[0,1e200]]`; `[[1,2],[0,1]]`。列単位の正確な2冪スケールで逆行列を求める設計に再現可能な誤りなし。 |
| `src/internal/seq.ts` | 問題未検出 | #230 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | R `seq(from,to,length.out)`のfractional lengthと両端固定仕様、内部呼出元を照合（実行なし） | n=0/1/2/fractional、to-from overflow、同値端点、最後の端点上書きを確認。入力: `seqLength(-1e308,1e308,3)`; `seqLength(0,1,2.5)`; `seqLength(4,4,5)`; `seqLength(0,1,1)`。有限差分overflow時のhalf-coordinate branchは中間値を有限に保つ。負/NaN lengthの明示validationはないが内部生成格子の呼出元は有効な長さを与え、公開APIではないため新規不具合登録なし。 |
| `src/internal/summary.ts` | 問題あり・追加監査済み | #231, #596, #855, #879 | `e4fc3bd652af3a00cf05b44389ddf58e590c4830` | [#374](https://github.com/numero-uno-jpn/rStats.js/issues/374) (open); [#393](https://github.com/numero-uno-jpn/rStats.js/issues/393) (open) | R mean/var/cov semantics、double-double accumulatorと2冪scaleの算術をソース照合（実行なし） | wideSumのoverflow切替/再scale、meanDD補正、centered/scaleToUnit、variance/covariance、Satterthwaite df、rank/tieCounts、completePairs、squareOver/productOver、norm2を確認。入力: `sum([1e308,1e308,-1e308])`; `mean([1e308,1e308,-1e308])`; `standardDeviation([-1e308,-1e308,-1e308,-1e308,1.5e308])`; `productOver(1e-308,1e-308,1e-308)`; `norm2([1e200,1e200])`; `norm2([1e-200,1e-200])`。ldexpの非常に大きな任意指数に対する一般的な限界は確認したが、全呼出元で使う指数範囲（最大でも2*1023等）では中間overflowを再現せず。新規再現欠陥なし。 #855: `sum([1e308,1e308,1e100,1,-1e308,-1e308,-1e100])`。DD accumulatorがhigh/lowの2 magnitude bandsを保持した後、third smaller bandの1をlow component加算時に失い、後続cancellation後0（厳密残差1）。#366の元再現はddAddが単一small termを保持するため撤回しclosed、3-band再現に差し替え。静的DD演算追跡のみ。 | #879: groupMoments/scaleToUnitの共通スケーリングで小群のwithin-group varianceがunderflowする複数API共通原因。
| `src/internal/uniroot.ts` | 問題未検出 | #232 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | R uniroot toleranceとFisher exact CI等の内部odds-ratio rootの単調性をソース照合（実行なし） | wrapperのtol/maxIter/fLower/fUpper転送、logScaleRootのu=log(psi) bracket doubling、psi=0/Infinity端点、belowOne方向、f(1)=0、符号反転時のendpoint順を確認。入力: `logScaleRoot(psi=>psi-0.25,true)`; `logScaleRoot(psi=>psi-4,false)`; `logScaleRoot(psi=>psi-1,true)`。expのunderflow/overflow端点とrootの表現可能範囲の扱いに再現可能な不具合なし。 |
| `src/internal/vectorize.ts` | 問題未検出・追加監査済み | #233, #552 | `c53e29599f879b9b1a643af5b588664aaf0c598a` | — | scalar/readonly array/Float64Arrayのshape保持、empty array、typed-array map、runtime種別判定を再監査。 | 入力: `2`, `[]`, `[0,1,2]`, `new Float64Array([])`, `new Float64Array([0,1,2])`, frozen readonly array、Float64Array subclass。numberはscalar、ArrayはArray.map、Float64Arrayはtyped-array mapを確認。別realmのFloat64Arrayもinstanceofがfalseでもtyped-array自身のmapを通る。契約外のFloat32Array/BigInt typed arrayは対象外。新規再現バグなし。runtime/Vitest未実行。 |
| `src/linalg/balance.ts` | 問題未検出・追加監査済み | #234, #592 | `b0796b3365f4f23a7a02efdb05628380f85cf284` | — | LAPACK dgebal/dgebakのpermutation/scaling手順とexpm/eigenの利用箇所を再監査（実行なし）。 | #592: isolated row/columnの移動、動的なk/l境界、scale factorの反復2倍/半減、sfmin/sfmax guard、行列への逆数scale適用、gebakのscaleと逆permutationを追跡。入力: `[[1,0,0],[0,2,3],[0,4,5]]`; `[[1,1e200],[1e-200,2]]`; `[[3]]`; `[]`。呼出元の有限値validation、n=0/1、極端な有限比率の経路を確認。新規再現不具合なし。Vitest/package runtime/R実行なし。
| `src/linalg/basic.ts` | 問題未検出 | #235 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | R crossprod/tcrossprod/backsolve/forwardsolve契約とLAPACK dtrsmのsolve順序を照合（既存test/linalg.test.tsを閲覧、実行なし） | vector/matrix RHS shape、k validation、upper/lower、transposeの4経路、exact-zero diagonal、zero RHS/zero coefficient skip、crossprod symmetric mirror、dimension mismatchを確認。入力: `crossprod([[1,2],[3,4]])`; `tcrossprod([[1,2],[3,4]])`; `backsolve([[2,1],[0,4]],[4,8])`; `forwardsolve([[2,0],[1,4]],[4,10])`; `backsolve([[1e-308,0],[0,2]],[1,2])`。既存のfixtureと極端なzero/scaleのsource traceで新規再現欠陥なし。 |
| `src/linalg/chol.ts` | 問題未検出・追加監査済み | #236, #592 | `5444cb2c0f790e8a231c515dead77c069d822e3a` | — | LAPACK dpotf2/dpstf2/dpotriとR chol/chol2invを再監査。既存test/chol.test.tsを閲覧（実行なし）。 | #592: unpivotedのleading minor更新、pivotedの残差対角/work累積・pivot swap・tol stop・rank、chol2invのsize境界とpotri逆三角/対称復元を追跡。入力: `chol([[4,2],[2,3]])`; `chol([[1,1],[1,1]],{pivot:true})`; `chol([[1,0],[0,0]],{pivot:true})`; `chol2inv([[2,1],[0,1]])`; `chol2inv([[1e-154,0],[0,1e-154]])`; `chol([[1e308,0],[0,1e308]])`。有限SPDのscale、rank-deficient PSD、tol/zero diagonal、NaN/Inf伝播を検討。新規再現不具合なし。Vitest/package runtime/R実行なし。
| `src/linalg/eigen.ts` | 問題あり・追加監査済み | #108, #588 | `86ee78a9fd9f3edbbc35e86f3805ea910e15ff18` | [#129](https://github.com/numero-uno-jpn/rStats.js/issues/129) (open); #99 (shared symmetry predicate) | R eigen契約、LAPACK dgebal/dgebakの逆変換後に行う固有ベクトル正規化をソース追跡。 | 既存#379の通常スケール検査では見落とす動的範囲を追加確認。入力 `eigen([[1,1e200],[0,2]])`。最大要素による全体2冪scale後も行列は有限。`gebal("B")`は対角要素が約`1e-200`の一方で上三角要素が約1のため、行/列の相似スケーリングを反復し、`gebak()`で固有値2の固有ベクトルを元座標へ戻すと成分比は約`[1e200,1]`。`normalizeVectors()`の`ss += m*m`は`1e400`でInfinityとなり、`norm=Infinity`、`cr=1e200/1e200/Infinity=0`となって列全体をゼロ化する。真の単位固有ベクトルは約`[1,1e-200]`。既存Issueとの重複なし、#129を新規作成。Vitest/package runtime/R実行なし。 |
| `src/linalg/expm.ts` | 問題あり | #237, #589 | `48da1a1d5e46371cff1404092bbb4d3d24551d26` | [#72](https://github.com/numero-uno-jpn/rStats.js/issues/72) (open) | Higham 2005のPadé係数・theta境界、R `expm` 6 methodsのfixture、LAPACK `dgebal`のsimilarity変換を照合。R実行なし | 0x0/1x1、非有限値、oneNorm overflow/log2復元、ldexp scaling、Pade13 powers、LU solve、squaring、balancing復元、Taylor/Padé Horner、CGSを再確認。既知#72再現: `expm([[0,1],[0,0]],{method:"Taylor",order:1e16})` および `{method:"Pade",order:1e16}` は `j--` がbinary64で不変となり非終了。既存Issue #72はopenのまま、重複Issueを作成せず。追加でdegree 3/9選択の丸め閾値とHighamのtheta値を比較したが、これだけで許容誤差を超える具体的誤答は立証できず。既存 `test/expm.test.ts` の6 method R fixtureを閲覧（実行なし）。新規不具合なし。 |
| `src/linalg/kappa.ts` | 問題あり・追加監査済み | #238, #584 | `4afa8f4710940950c959fbab31eef3c4aa989154` | [#56](https://github.com/numero-uno-jpn/rStats.js/issues/56) (closed/fixed); [#127](https://github.com/numero-uno-jpn/rStats.js/issues/127) (open) | exact kappaとginvのsvdScaled移行後の極端スケール、tol cutoff、逆特異値の最終スケーリングを再監査。 | #56修正確認: `kappa([[1.7e308,1.7e308],[1.7e308,-1.7e308]],{exact:true})`はscaled singular value比で1。新規#127: `ginv([[1e308,0],[0,1e-15]],{tol:0})`。rangeExponent=1023、scaled singular values約`[1.1125369292536007,1e-323]`。2つ目は正でcut=0を通るが`1/d`がInfinityへoverflowし、0*InfinityでNaNも生じる。真の逆行列は`[[1e-308,0],[0,1e15]]`で全要素有限。Issue #127。source SHAは現行。Vitest/package runtime/R実行なし。 |
| `src/linalg/lu.ts` | 問題未検出 | #239 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | LAPACK dgetrf partial pivoting、R Matrix::lu、prcompのscale/SVD/rank semanticsをソースとtest/matrix-ops.test.tsで照合（実行なし） | first-maximum pivot tie、rectangular L/U shape、zero pivot、subnormal pivot reciprocal fallback、P orientation、prcomp center/scale、rank truncation、tol drop、extreme scale fallbackを確認。入力: `lu([[1,2],[3,4]])`; `lu([[0,1],[2,3]])`; `lu([[1,2,3],[4,5,6]])`; `prcomp([[1,2],[2,1],[3,4],[4,3]],{rank:1})`; extreme finite scale and zero-variance columns。新規再現欠陥なし。 |
| `src/linalg/matrix.ts` | 問題未検出 | #240 | `7475ea2b46bae71fe7fec11a2c20dfeee89590a0` | — | matrix row-array/column-major conversion、rectangular/zero dimensions、SVD rangeExponent呼出契約をソース照合（実行なし） | toMat row-length validation、Float64Array row support、toMatOrColumn vector handling、empty array ambiguity、transpose indexing、fromMat shape、rangeExponentのsubnormal/large finite casesを確認。入力: `toMat([[1,2],[3,4]])`; `toMat([[1],[2,3]])` (ragged error); `toMat([new Float64Array([1,2]),new Float64Array([3,4])])`; `toMat([])`; `rangeExponent([Number.MIN_VALUE,0])`; `rangeExponent([1e308])`。0-row matrixが0x0に制限される仕様もコメントに明記され、shape corruptionの新規再現なし。 |
| `src/linalg/norm.ts` | 問題未検出・追加監査済み | #241, #592 | `3ee6876b551eab0d51a0abf8b2c3a57680d54457` | — | R norm typesとLAPACK dlange/dlassq定義を再監査。`test/linalg.test.ts`を閲覧（実行なし）。 | #592: one/infinity normの非負和、Frobeniusのmax-scale後の二乗和、NaN優先伝播、Inf、spectral normからsvdValuesへの接続、空次元を追跡。入力: `norm([[1e308,1e308]],{type:"O"})`; `norm([[1e200,1e200]],{type:"F"})`; `norm([[1e-200,1e-200]],{type:"F"})`; `norm([[NaN,Infinity]],{type:"F"})`; `norm([[Infinity]],{type:"2"})`; `norm([[1,2],[3,4]],{type:"2"})`。各出力のoverflowは数学的なノルム自体が表現範囲外の場合に限られ、新規再現不具合なし。SVD小特異値消失は別途#131に記録。Vitest/package runtime/R実行なし。
| `src/linalg/ops.ts` | 問題あり・追加監査済み | #242, #585, #594 | `fa5626725f1f8b3d6cd1d6d2a82e54629f00f540` | [#55](https://github.com/numero-uno-jpn/rStats.js/issues/55) (closed/fixed); [#70](https://github.com/numero-uno-jpn/rStats.js/issues/70) (open); [#133](https://github.com/numero-uno-jpn/rStats.js/issues/133) (open) | matMulのshape dispatch/rescaledDot、elementwise recycling、diag/cbind/rbind/matrix/kronecker/seqを再監査。 | #55修正確認。#70継続確認: `seq(-1e308,1e308,{lengthOut:3})`は差分overflow。新規#133: `matMul([1e308,1e308,1],[1e308,-1e308,1])`。通常dotは`+Infinity-Infinity+1`でNaNとなり`rescaledDot()`へ進むが、両ベクトルを`2^-1023`倍した後の最後の積は約`1.24e-616`で0にunderflow。大きな正負の積が相殺された後に残る厳密な値1を失い、0を返す経路を確認。既存#70とは別件。Vitest/package runtime/R実行なし。 |
| `src/linalg/qr.ts` | 問題あり | #243, #590 | `b04cbd9b8fbc3fdf1cc48b07b0ca44ef9eeb2f2f` | [#57](https://github.com/numero-uno-jpn/rStats.js/issues/57), [#71](https://github.com/numero-uno-jpn/rStats.js/issues/71), [#130](https://github.com/numero-uno-jpn/rStats.js/issues/130) (open) | QR Householderの極端スケールを監査。 | #590: `qr([[1e308,1e308],[1e308,1e308]])` で内積が`-Infinity`へoverflowし、第2列を汚染。正しいrankは1だがrank 2となり得る。期待R対角は有限の`-sqrt(2)*1e308`。Issue #130。既存#57/#71は別件。 |
| `src/linalg/schur.ts` | 問題あり・追加監査済み | #244, #593 | `72838c9df6896ef921d1ec296bd5b93d4624ec4f` | [#132](https://github.com/numero-uno-jpn/rStats.js/issues/132) (open) | 実Schur分解の直交相似変換、2x2複素固有値block標準化、R Matrix::Schur契約と `test/schur.test.ts` を照合（実行なし）。 | 既存の2x2/複素block/再構成検査に加え、極端な混合スケールの厳密対角行列を確認。入力 `[[1e308,0],[0,1e-308]]`。`rangeExponent=1023` により全要素を `2^-1023` 倍する前処理で、第二対角成分 `ldexp(1e-308,-1023)` が0へunderflow。`orthes`/`hqr2`へ渡る前に固有値が消失し、逆scaleしても復元不能。真の固有値は `[1e308,1e-308]`、対角行列なのでSchur formは入力のまま保てる。Issue #132を新規作成。ソースとIEEE-754経路を静的追跡。Vitest/package runtime/R実行なし。 |
| `src/linalg/solve.ts` | 問題あり・追加監査済み | #109, #586, #740, #741 | `d8df21ba08caaa996d1db3f2659e9a71a431d668` | [#128](https://github.com/numero-uno-jpn/rStats.js/issues/128) (open); [#250](https://github.com/numero-uno-jpn/rStats.js/issues/250) (open); [#251](https://github.com/numero-uno-jpn/rStats.js/issues/251) (open) | LU/condition estimateに加え、triangular rcond()のuplo validationとmatrix dimension contractを追加監査。 | #128: LU trailing update overflow（従来記録）。#740: rcond([[1,100],[0,1]],{triangular:true,uplo:'X' as any})はinvalid uploをlower branchとして扱い、identity相当のrcond=1。Issue #250。#741: rcond([[1,0,100],[0,1,0]],{triangular:true,uplo:'U'})は2×3 matrixをrejectせず、trcon()がnrow=2として先頭2列だけ処理し第3列を無視。Issue #251。静的branch・index解析のみ。Vitest/package runtime/R実行なし。 |
| `src/linalg/svd.ts` | 問題あり・追加監査済み | #245, #584, #591 | `6192d8d18210f1e92f69cae227d58ab4469b5fe7` | [#127](https://github.com/numero-uno-jpn/rStats.js/issues/127) (consumer: ginv); [#131](https://github.com/numero-uno-jpn/rStats.js/issues/131) | svdScaled/svdValuesの共通2冪スケーリングが、極端な指数幅を持つ行列の小要素を入力段階で消失させる問題を追加確認。#127のginv reciprocal overflowとは別原因。 | #591: `svd([[1e308,0],[0,1e-308]])`。`rangeExponent`は最大要素から`s=1023`を選び、`ldexp(1e-308,-1023)`が0へunderflowするため、対角行列の本来有限な特異値`1e-308`を分解前に失う。`svdValues()`も同じscale経路。期待値は降順`[1e308,1e-308]`。`src/linalg/svd.ts`、`matrix.ts`、`summary.ts`、Householder helper、`test/svd.test.ts`を閲覧。Vitest/package runtime/R実行なし。
| `src/models/anovaSequential.ts` | 問題あり | #839 | `fb1bf352f9106fd3e79c9d03ee40773318b4e26c` | [#350](https://github.com/numero-uno-jpn/rStats.js/issues/350) | R `anova.lm` and `car::Anova` exclude zero-weight rows from fitting and inferential sums; such rows must not set the numerical response scale. R実行なし。 | `responseScale()` が`fittedValues`/`residuals`を全行から取得しzero-weight行を除外しないことを確認。再現: `lm('y ~ x',{y:[1,2,4,3,1e308],x:[0,1,2,3,4]},{weights:[1,1,1,1,0]})` 後に`anova(fit)`。最終行はfitから除外されるが巨大残差でk≈1023となり、正weight行のeffects/RSSの二乗がunderflowしANOVA SS/Fが失われる。共有helperのためcarAnovaも影響。ソース解析のみ。Vitest/package runtime/R実行なし。 |
| `src/models/aovEz.ts` | 問題未検出 | #247 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | afex `aov_ez`/car univariate ANOVA、GG/HF/Mauchly、long-to-wide aggregationの既存fixture/test/aovEz.test.tsを照合（実行なし）。 | ID/factor coercionとlevel重複、IDの複数between条件、欠損response/欠損cell/空cell、重複観測mean集約、within factor order、between factor sorted order、type II/III、observed effect-size分母、response scaleを追跡。入力: `id=['s1','s1','s2','s2','s3','s3','s4','s4']`, `W=['a','b','a','b','a','b','a','b']`, `y=[4.1,5.0,3.8,4.9,4.4,5.6,4.0,4.7]`; missing cellを作る1 subject除外例; 1セル複数行平均例; `y=[1e200,-1e200,...]`のscale経路。新規再現不具合なし。 |
| `src/models/aovStrata.ts` | 問題あり | #842 | `b34c319610712397b87a4064057c338541027846` | [#353](https://github.com/numero-uno-jpn/rStats.js/issues/353) | R `aov()` model frame omits rows with missing values in any formula variable, including variables inside `Error()`. R実行なし。 | `aovStrataFit()` のtreatment design `dt` とerror design `de` のrow alignmentを確認。再現: `aov('y ~ treatment + Error(subject)',{y:[1,2,3,4,5,6],treatment:['A','A','B','B','A','B'],subject:['s1','s1',null,null,'s2','s2']})`。`dt`は6行を保持する一方`de`はsubject欠損行を除外して短くなり、長さ不一致のerror columnsを`dt.y`の長さでddLeastSquaresMultiへ渡す。共通model frameで全formula variablesをdropすべき。ソース/行対応解析のみ。Vitest/package runtime/R実行なし。 |
| `src/models/carAnova.ts` | 問題あり | #836 | `0b2fc663a6e4e933cc86fb80e7f67dcc4f84a4b8` | [#347](https://github.com/numero-uno-jpn/rStats.js/issues/347) | R `car::Anova()` weighted Type II/III tests use a finite weighted response mean/TSS where the mathematical sums are representable; R実行なし。 | `Anova()` のweighted TSS計算を確認。再現: `lm([0,1,2,3,4],[1e-154,2e-154,1e-154,3e-154,1e-154],{weights:Array(5).fill(1e308)})` 後に`Anova(fit,{type:2})`。重み付きRSS/TSS自体は有限に保てるが、`sw` と `swy` の直接加算がInfinityとなり`my`/`tss`がNaN、誤った残差SSエラーとなる。ソース/IEEE-754解析のみ。Vitest/package runtime/R実行なし。 |
| `src/models/coxph.ts` | 問題あり・追加監査済み | #834, #856 | `77ddd4a9619494a8aaab02950668a3cc082dc0fd` | [#345](https://github.com/numero-uno-jpn/rStats.js/issues/345); [#367](https://github.com/numero-uno-jpn/rStats.js/issues/367) (open) | R `survival::coxph()` の整数case weightsはreplication weightsとして扱われ、Efron tiesは複製後のevent countで計算される。R実行なし。 | `evaluate()` のEfron tied-death step数を確認。再現: weighted `time=[1,1,2], status=[1,1,0], x=[[0],[1],[2]], weights=[2,1,1]` と expanded `time=[1,1,1,2], status=[1,1,1,0], x=[[0],[0],[1],[2]]` は同じ部分尤度/係数になるべきだが、実装はevent row数2をstepsに使い、total event weight 3を使わない。Breslow経路とは別問題。ソース解析のみ。Vitest/package runtime/R実行なし。 #856: `coxph([1,2],[1,0],[[0],[1]],{init:[1000],iterMax:0})`。risk-setの`exp(eta)`がInfinityとなるが、部分尤度は`-log(1+exp(1000))`で有限（約-1000）。log-sum-exp/scaled risk sumsが必要。静的解析のみ。 |
| `src/models/ddLeastSquares.ts` | 問題未検出 | #250 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | Double-double Householder least-squares, orthonormal Q coordinates and rank/pivot semanticsをソース照合（実行なし）。 | DD dot/Householder norm/reflector tau、rank0、n=0、multiple RHS、列数>行数、zero column、subnormal residual、back substitutionを確認。入力: columns `[[1,0,0],[0,1,0]]`, response `[[1,2],[3,4],[5,6]]`; zero columns `[[0,0,0]]`; nearly dependent columns `[[1,1],[0,1e-30],[0,0]]`; values ±1e200/1e-200。独立列の内部契約範囲で新規再現不具合なし。 |
| `src/models/ddMatrix.ts` | 問題未検出 | #251 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | DD matrix multiply/transpose/inverse/trace/Cholesky handoffと `ddLeastSquares` consumersをソース照合（実行なし）。 | 0x0/1x1/rectangular、dimension mismatch internal contract、near-singular pivots、DD low component cancellation、positive-definite inverse、trace、transpose symmetryを確認。入力: `[[4,2],[2,3]]`; `[[1,1],[1,1+1e-30]]`; `[[1e-200,0],[0,1e200]]`; empty matrix。内部呼出元の対称正定値・dimension条件下で新規再現不具合なし。 |
| `src/models/estimable.ts` | 問題未検出 | #252 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | R `predict.lm` non-estimable rows/column-space criterion、`nestedColumns`のrank logicをソース照合（実行なし）。 | rank0/empty rows、full rank、aliased columns、row-space residual、threshold境界、NaN/Inf、small/large matrix scalingを確認。入力: `q=qr([[1,0],[0,0],[0,1]])`; rows `[1,0]`, `[0,1]`, `[0,1e-8]`; nested matrices `[[1,0],[0,1]]` と `[[1,0,1],[0,1,1]]`。列空間包含判定とnon-estimableの新規再現不具合なし。 |
| `src/models/formula.ts` | 問題未検出 | #253 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | R formula operator algebra/terms ordering/Error() and random-effect bar parsing; existing test/formulaTests.test.ts and model-matrix callersを照合（実行なし）。 | tokenizer names/numeric constants/backtick limitation、unary +/-、0/1 intercept toggling、`+ - : * / ^ %in%` precedence/expansion、duplicate terms、parentheses、Error() extraction、`|`/`||` grouping、nested random termsを追跡。入力: `y ~ 0 + A*B`; `y ~ A/B/C`; `y ~ (A+B)^2`; `y ~ A - A + B`; `y ~ x + Error(id/W)`; `y ~ x + (1+x|g)`; `y ~ (1|g/h)`。構文サポート範囲内で新規再現不具合なし。 |
| `src/models/glm.ts` | 問題あり | #838 | `4c39ee7305f3a2745885b9ded57699ea19bfd60c` | [#349](https://github.com/numero-uno-jpn/rStats.js/issues/349) | R `summary.glm` custom dispersion is specified in original response units; scaling must preserve finite final dispersion/SE. R実行なし。 | `glmSummary()` とcustom dispersionを使う関連consumerを確認。再現: Gaussian identityで`glm([0,1,2,3],[1e308,1e308,1e308,1e308],{family:'gaussian'})`、続けて`glmSummary(fit,{dispersion:Number.MIN_VALUE})`。内部response scaleへの`ldexp(d,-2*k)`が0へunderflowし、dispersionとSEを0と誤報するが、元単位のdispersionとその平方根は表現可能。`glmPredict`/`glmRstandard`/`glmCooksDistance`/`glmAnova`にも同型変換あり。ソース解析のみ。Vitest/package runtime/R実行なし。 |
| `src/models/glmAnova.ts` | 問題未検出 | #255 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | R `anova.glm` sequential/model comparison Chisq/LRT/Rao/F/Cp, nested affine models and dispersionをソース・既存test/glmAnova.test.tsで照合（実行なし）。 | response/prior weight identity、offset difference in large model space、non-nested comparison suppression、df sign/order、score statistic centering, fixed/estimated dispersion, dfResidual=0, Cp, scaled Gaussian devianceを確認。入力: binomial `y=[0,0,1,0,1,1]`, `x=[1,2,3,4,5,6]`; models with offsets `[0,0,0,0,0,0]` vs `[1,0,0,0,0,0]`; nested and reversed model order。新規再現不具合なし。 |
| `src/models/glmConfint.ts` | 問題未検出 | #256 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | R profile likelihood and Rao score coefficient intervals, bracketing and Brent/uniroot tolerance; existing test/glmConfint.test.tsを照合（実行なし）。 | aliased parm、duplicate/out-of-range indices、confidence levels near 0/1, profile refit convergence, LRT/Rao, zero/NaN/Inf SE, doubling to 2^30 SE, uniroot bracket/tol and scalingを確認。入力: example binomial `x=[1,2,3,4,5,6]`, `y=[0,0,1,0,1,1]`; `parm=[0,1]`; `level=0.9`; `test='Rao'`; near-extreme levels `1e-12` and `1-1e-12`。新規再現不具合なし。 |
| `src/models/glmFamily.ts` | 問題あり・追加監査済み | #835, #854, #859, #860, #861, #862 | `6d7dc129d990b8724501ac59d4015562abe3e20c` | [#346](https://github.com/numero-uno-jpn/rStats.js/issues/346); [#370](https://github.com/numero-uno-jpn/rStats.js/issues/370) (open); [#371](https://github.com/numero-uno-jpn/rStats.js/issues/371) (open); [#372](https://github.com/numero-uno-jpn/rStats.js/issues/372) (open); [#373](https://github.com/numero-uno-jpn/rStats.js/issues/373) (open); [#375](https://github.com/numero-uno-jpn/rStats.js/issues/375) (open) | R Gamma family AIC uses `phi = dev / sum(weights)`; expected finite result based on exact/extended-range sum. R実行なし。 | `familyAic()` Gamma branchのweight合計を確認。再現: `w=1e308`, `t=1e-5`, `y=[40000,40000*(1+t)]`, `mu=[40000,40000]`, `dev=-2*w*(log1p(t)-t)`。数学的weight合計2e308はdouble上限超過だが、phiは有限正値でGamma densityの加重和もdouble範囲にできる。実装の`sw += wi`はInfinityとなりdispersion 0、shape Infinity、scale 0を生成して非有限AICとなる。ソース/IEEE-754解析のみ。Vitest/package runtime/R実行なし。 #859: Gaussian/quasi constant `w*(y-mu)^2`で`y=1e200,mu=0,w=1e-300`は中間square overflowするが真値1e100。#860: Poisson `y=1e308,mu=1e-308,w=1e-320`でy/mu overflow、真のweighted deviance約2.8e-9。#861: Gamma/quasi mu²同条件で`Inf-Inf`→NaNだが真値は約1e296。#862: `mu=1e-300`, `y=mu*(1+2**-52)`, `w=1e308`のbinomial near-mean devianceはunweighted bd0がunderflowして0となるがweighted値は約4.93e-24。すべて静的数式・IEEE-754解析のみ。 #854: Poisson near-mean `2*w*bd0(y,mu)`で`mu=1e-300`, `y=mu*(1+2**-52)`, `w=1e308`はbd0≈2.465e-332が先にunderflowし0となるが、weighted devianceは約4.93e-24。#371はfar-from-mean ratio overflowであり別経路。静的式解析のみ。 |
| `src/models/lm.ts` | 問題あり | #833, #837, #874 | `3e18b34cfe16cf31be30295b45cd64e58db6b3a9` | [#344](https://github.com/numero-uno-jpn/rStats.js/issues/344); [#348](https://github.com/numero-uno-jpn/rStats.js/issues/348); [#388](https://github.com/numero-uno-jpn/rStats.js/issues/388) (open) | R `lm.wfit` weighted-fit invariance under common positive weight scaling and rejection of non-finite weighted least-squares inputs; R runtime not executed. | `fitLmUnit()` のweight exponent変換とMSS/RSSの単位、R²/Fの不変性、matrix/formula両経路、zero-column no-interceptでの+Infinity weightを確認。再現: `lm([1,2,3,4,5],[2,3,5,4,7],{weights:[4,4,4,4,4]})` は無重みfitとR²/Fが一致すべきだがMSSだけweight scaleが戻らず不一致。`lm([[],[],[]],[1,2,3],{intercept:false,weights:[Infinity,1,1]})` は非有限weightを拒否せずNaN/Infinityを伝播する。ソース解析のみ。Vitest/package runtime/R実行なし。 | #874: 共通weight scalingでpositive subnormal weightが0となり、RSS/sigmaから寄与が消失。
| `src/models/lmer.ts` | 問題未検出 | #259 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | lme4 REML/ML profiled criterion, sparse derivatives, trust-region optimization, theta scaling, singular boundary and result reconstruction; existing test/lmer.test.ts inspected (not executed)。 | exact fixed-effects fit guard, beta0 centering, response 2^k scaling, random-effects term blocks, diagonal boundary release/negative curvature, Hessian eigen cut, trust-region radius/restarts, σ/REML df, VarCorr correlations, ranef/fitted/residuals, empty random termsを追跡。入力: `y=[9.8,10.4,10.1,12.3,12.9,12.0,8.1,7.6,8.4]`, `g=['a','a','a','b','b','b','c','c','c']`; exact `y=[1,2,3], x=[1,2,3]`; response scales 1e200 and 1e-200。今回の入力群で新規再現不具合なし。 |
| `src/models/lmerAnova.ts` | 問題未検出 | #260 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | lmerTest Type I/II/III tables and lme4 likelihood-ratio comparisons, nested fixed/random effects and same-data requirementsをソース・test/lmerCompare.test.tsで照合（実行なし）。 | same data identity/snapshot/rows/response, REML refit, npar sort, nested fixed column spaces, random term containment, zero df, duplicate names, Chisq truncation and type hypothesis mappingを確認。入力: nested `y ~ x + (1|g)` vs `y ~ x + (1+x|g)`; nonnested random structures; contrasts treatment vs sum; model names duplicate; REML/ML mixed. 新規再現不具合なし。 |
| `src/models/lmerHypotheses.ts` | 問題未検出 | #261 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | — | lmerTest Type I/II/III hypothesis construction, treatment/full-dummy mapping, Doolittle, missing cells and aliased columns; existing test/lmerHypotheses.test.ts inspected (not executed)。 | factor/numeric interaction column order, no intercept, empty terms, missing full-dummy cells, treatment/sum/helmert/poly contrasts, `ginv` mapping, zapsmall, term containment, Doolittle normalized diagonal and rank cutoffを追跡。入力: `y ~ A*B + (1|g)` with unbalanced A×B; numeric predictor scales 1e-6/1e6; aliased columns; empty cells. 新規再現不具合なし。 |
| `src/models/lmerTest.ts` | 問題あり | #262 | `bd7e28abd7a5cc22350f41be4dd9595bad98f78b` | [#58](https://github.com/numero-uno-jpn/rStats.js/issues/58) | Satterthwaite t/F contrast tests and scale invariance of hypothesis Lβ=rhs; existing test/lmerTest.test.ts checks proportional rows but not extreme scaling (実行なし)。 | Hessian eigen cutoff, scaled parameter covariance, Jacobian, tTestOf quadratic form, fTestOf L V L', rank-deficient L, RHS projection, jointDenDF, confidence intervals and contest input validationを追跡。再現: docs fixture data `y=[3.1,4.0,5.2,6.8,7.1,8.3,2.2,3.5,3.9,5.9,6.1,7.4]`, `x=[1,2,3,1,2,3,1,2,3,1,2,3]`, `g=['a','a','a','b','b','b','c','c','c','d','d','d']`; `fit=lmer('y ~ x + (1 | g)',data)`; compare `lmerContest(fit,[0,1],{joint:false,confint:false})` and `[0,1e160]`. Same hypothesis under scalar multiplication, but `quadraticForm(l,vcov)` overflows (~1e320 scale), stdError becomes Infinity, tValue collapses to 0, df can be NaN. Joint F path also forms `L V L'` unscaled. Issue #58。 |
| `src/models/mauchly.ts` | 問題未検出 | #263 | `0dae48405cd78c389dea9d31321ae7cd57b99d84` | — | R `mauchly.test()` の部分空間定義・M/X rank・W/p-value式を照合。`contrastCrossprod` のQRはLINPACK limited pivotingでX列が先頭順に保たれるため、初期疑いは不成立（Issue #59を誤検出としてclose）。 | `y=[[1,0,0,0],[-1,0,0,0],[0,2,0,0],[0,-2,0,0],[0,0,3,0],[0,0,-3,0],[0,0,0,4],[0,0,0,-4]]`, `idata={x:[100,101,102,103],z:[1,-1,-1,1]}`, `M='~x+z'`, `X='~1'`。QR pivot規則・rank containment・空部分空間・n<pp・欠損群・ゼロ/特異Sをソース追跡。Vitest/package runtime/R未実行。 |
| `src/models/mixedDerivatives.ts` | 問題未検出 | #264 | `11af5c07a9c1bcbeb0d9d9ea4eb5b3cf65884340` | — | Satterthwaite用 deviance Hessian、r²微分、REML logdet S微分、selected inverse tangentを式と実装で照合。 | `y=[3.1,4.0,5.2,6.8,7.1,8.3,2.2,3.5,3.9,5.9,6.1,7.4]`, `x=[1,2,3,1,2,3,1,2,3,1,2,3]`, `g=['a','a','a','b','b','b','c','c','c','d','d','d']`; `lmerTest('y~x+(1|g)')` 相当。theta=0境界、REML/ML、p=0、残差PRSS=0での除算経路を追跡。Vitest/package runtime/R未実行。 |
| `src/models/mixedDeviance.ts` | 問題未検出 | #265 | `7fa0cb7b42f83c91d819ac165fd3a8bba18a939a` | — | Sparse block Z'Z構築、symbolic/numeric Cholesky、selected inverse、normal-equation refinement、REML/ML criterionとgradientを追跡。 | 同上の12観測データで `lmer('y~x+(1|g)')`、theta=[0]と[1]、単一/交差/入れ子group、p=0、q=0相当、rank/境界条件を検討。factorisation・Takahashi recurrenceの添字とcolumn-major block layoutをソース照合。Vitest/package runtime/R未実行。 |
| `src/models/mixedStructure.ts` | 問題未検出 | #266 | `40803660d304825257e6b57c034240b328a366e9` | — | random-effects formula展開、grouping factors、||分割、Z/Λθ配置、項順序、alias drop、scale warningを追跡。 | `y=[9.8,10.4,10.1,12.3,12.9,12.0,8.1,7.6,8.4]`, `x=[1,2,3,1,2,3,1,2,3]`, `g=['a','a','a','b','b','b','c','c','c']`; `y~x+(1+x|g)`, `y~(1|a/b)`, `y~(x||g)`。numeric/factor group, empty level, single level, nested/crossed grouping and rank deficiencyを確認。Vitest/package runtime/R未実行。 |
| `src/models/modelFrame.ts` | 問題未検出 | #267 | `fbd2388c426fcb60d770b5790ee28d11857a8548` | — | R model.frame/na.omit、factor level ordering、logical levels、weights row omissionとnegative weight validationを照合。 | `{y:[1,NaN,3,4],A:['b','a',null,'b'],w:[1,2,3,0]}` with names `['y','A']`, weights `'w'`; all-null columns, Float64Array, mixed types, supplied duplicate levels, unused levels, zero/negative/Infinity weights and length mismatch pathsを追跡。Vitest/package runtime/R未実行。 |
| `src/models/modelMatrix.ts` | 問題あり | #840 | `9dbfb1a56cb3c730f9d5d5e0dc91da1ea14d0a8` | [#351](https://github.com/numero-uno-jpn/rStats.js/issues/351) | R `contr.poly` returns orthogonal polynomial contrasts in degree order (`.L`, `.Q`, `.C`, ...); R実行なし。 | `polyContrasts()` がVandermonde行列に既定LINPACK QRを適用し、pivot順の`qrQ()`を元degree順へ戻さず名前を割り当てる経路を解析。24-level factorでは高次power列が既定tolで末尾へ移動し、移動列の順序が逆転するため高次contrastのdegree labelとQ列がずれる。再現: `contrastMatrix(Array.from({length:24},(_,i)=>'L'+(i+1)),'contr.poly')`。QR pivot順とdegree labelの対応が不整合。ソース/QR pivot解析のみ。Vitest/package runtime/R実行なし。 |
| `src/models/scaledTables.ts` | 問題未検出 | #269 | `4f65d01b4bfa9007e772fcf7bfb251a5d68cc417` | — | 15行のWeakMap保管層を確認。scaled ANOVA tablesのidentity/lifetime contractに数値演算はない。 | `const result={}; scaledTables.set(result,{colNames:['SS'],rowNames:['x'],table:[[0.25]]}); scaledTables.get(result)` と別object identity、GC依存のWeakMap特性をソース確認。計算ロジックなし。Vitest/package runtime未実行。 |
| `src/models/survival.ts` | 条件付き問題あり（実データ未再現） | #109–110 | `6b9fabe470c0a994e48cd612bcd3e30aaa580aa1` | [#28](https://github.com/numero-uno-jpn/rStats.js/issues/28) | Rでは未確認（R実行なし） | #109で `pseudoQuadratic()` の固定固有値閾値 `1e-10 * max(lambda)` と `solve()` の既定tol=`Number.EPSILON` の不整合を指摘。#110で `survdiff()` のリスク集合構造を解析：正の期待イベント数を持つ各群は最初のイベント時点で必ずリスク集合に属する。最初のイベント数 d がリスク集合総数 N 未満なら、その時点の分散寄与 `w²*d*(N-d)/(N*(N-1)) * (diag(r)-r*r'/N)` は、使用群のうち1群を除いた部分行列上で正定値。最初の時点で d=N なら全リスク対象が同時イベントとなり、以後のイベントはなく、V=0かつO-E=0。従って通常の入力では `pseudoQuadratic()` が準特異行列の正の小固有値を切り捨てる経路は実証できず、実際のtime/status/group再現なし。Issue #28は補助関数の閾値方針上の懸念として保持し、survdiffの実害は未確定。Vitest/package runtime/R実行なし。 |
| `src/models/tiedTimes.ts` | 問題あり | #841 | `229af071501c8dbc7bdcc0c03d503346ed227713` | [#352](https://github.com/numero-uno-jpn/rStats.js/issues/352) | R `survival::aeqSurv()` tie-cut lookup is a binary search over array indices; implementation must preserve safe integer indices. R実行なし。 | `mergeTiedTimes()` cut-point二分探索のmidpoint `(lo+hi+1)>>1` を確認。distinct finite timesが2^31+1件の配列で`>>`がsigned int32変換を行いmidが負値へwrapするため、誤ったcutを返す。巨大配列は未確保、JS演算規則と制御フローの静的解析のみ。Vitest/package runtime/R実行なし。 |
| `src/numerics/deriv.ts` | 問題あり・追加監査済み | #270, #579, #703, #704, #736, #845–848 | `7a339332c11e4b55e6f35fb8f120c7fd2c92311d` | [#123](https://github.com/numero-uno-jpn/rStats.js/issues/123) (open); [#213](https://github.com/numero-uno-jpn/rStats.js/issues/213) (open); [#214](https://github.com/numero-uno-jpn/rStats.js/issues/214) (open); [#246](https://github.com/numero-uno-jpn/rStats.js/issues/246) (open); [#356](https://github.com/numero-uno-jpn/rStats.js/issues/356) (open); [#357](https://github.com/numero-uno-jpn/rStats.js/issues/357) (open); [#358](https://github.com/numero-uno-jpn/rStats.js/issues/358) (open); [#359](https://github.com/numero-uno-jpn/rStats.js/issues/359) (open) | grad/jacobian/hessianのRichardson step sizing、浮動小数点格子、extrapolation、zeroTol境界、step/denominator overflowを追加監査。 | #736: `grad(x=>x[0]*x[0],[0],{zeroTol:0})`でh0=0、Issue #246。#845: `jacobian(x=>x[0]===1?[1]:[],[1])`はperturbed callback length 0を検出せずNaN matrixを返し、extra componentも無視する。#846: `jacobian(()=>[NaN],[0])`、`hessian(()=>NaN,[0])`、`grad(()=>NaN,[0],{method:'simple'})`がNaN結果を返し、Richardson gradだけがNaNをthrowする。#847: `grad(x=>x[0],[1],{r:513})`で`4**512`がInfinityとなりRichardson更新がNaN化。#848: `grad(x=>x[0],[2],{d:1e308})`はdとxが有限でもh0=Infinityとなり、±Infinity評価後にcallback由来と誤認したNaN error。すべて静的ソース/IEEE-754解析のみ。Vitest/package runtime未実施。 |
| `src/numerics/integrate.ts` | 問題あり・追加監査済み | #271, #737, #858 | `6df1afbeed34b40ab91e3f064f5af8aba7d02b56` | [#61](https://github.com/numero-uno-jpn/rStats.js/issues/61) (open); [#247](https://github.com/numero-uno-jpn/rStats.js/issues/247) (open); [#369](https://github.com/numero-uno-jpn/rStats.js/issues/369) (open) | integrate/optimize/unirootのlimits・tolerance・interval extension・option validationを追加監査。 | #61: optimize()が非有限値をfinite sentinelに置換せずNaN pointで停止しない既知Issue。#737: uniroot(x=>x*x-2,0,2,{extendInt:'bogus' as any})は有効bracketでrootを返しunsupported enumを無視。same-sign endpointsでは'no'扱い。extendIntをno/yes/downX/upXに検証すべき。静的option/control-flow解析のみ。Vitest/package runtime/R実行なし。 #858: `integrate(x=>x,0,1,{subdivisions:2**32})`は有限正整数としてvalidationを通過し、QUADPACKのtyped-array確保でnative RangeError。public APIで上限を検証すべき。巨大確保は未実行。 |
| `src/numerics/interp.ts` | 問題あり・追加監査済み | #272, #581, #705, #706, #707, #708, #711, #850 | `a88cdba04295b2e3fe72c39b2f2facaf1cceb059` | [#125](https://github.com/numero-uno-jpn/rStats.js/issues/125) (open); [#215](https://github.com/numero-uno-jpn/rStats.js/issues/215) (open); [#216](https://github.com/numero-uno-jpn/rStats.js/issues/216) (open); [#221](https://github.com/numero-uno-jpn/rStats.js/issues/221) (open); [#361](https://github.com/numero-uno-jpn/rStats.js/issues/361) (open) | approx、FMM/natural/periodic/Hyman、monoH.FC、splinefunH、barylag、global Hermiteのties・境界・wide knot scaling・option validationを再監査。 | #705/#706/#707/#708/#711の既存記録を保持。#850: `spline([0],[5],{method:'periodic',xout:[0]})`。1 knotを許しperiod=0のままperiodic wrapping `(u-x[0]) % period`を行うため、 knot自身の評価もNaNとなる。最低distinct knot数を検証するかconstant caseを定義すべき。静的制御フロー/IEEE-754解析のみ。Vitest/R実行なし。 |
| `src/numerics/ode.ts` | 問題あり・追加監査済み | #273, #580, #701, #849, #880 | `a9f499eade2fd6368e57e8d087220d6bcfdd23f2` | [#124](https://github.com/numero-uno-jpn/rStats.js/issues/124) (open); [#211](https://github.com/numero-uno-jpn/rStats.js/issues/211) (open); [#360](https://github.com/numero-uno-jpn/rStats.js/issues/360) (open); [#394](https://github.com/numero-uno-jpn/rStats.js/issues/394) (open) | Euler/Heun/RK4のstage時刻、step差分、state dimension、subnormal/overflow update、mutable callback契約を再監査。 | #211は有限時刻差のoverflow。追加#849: `ode([0],[0,Infinity],()=>[0],[],{method:'euler'})`。times自体の非有限値を検証せずh=Infinityとなり、zero derivativeでも`0 + Infinity*0`がNaNとなる。#211の有限両端点overflowとは異なり、無効な非有限time入力のvalidation欠落。静的IEEE-754解析のみ。Vitest/deSolve実行なし。 | #880: RK4 overflow fallbackの追加経路を監査。h=0.5、定数微分1e308ではquarter weighted slope=1.5e308は有限だが、h*2^60*quarterがoverflowし、厳密解5e307をInfinityにする。既存#124のsubnormal step/weighted-sum overflow修正fallbackで生じる別の積順序障害。静的IEEE-754解析、runtime/Vitest/deSolve未実行。
| `src/optim/lbfgsb.ts` | 問題あり・追加監査済み | #274, #583, #851 | `fd14e53c5730a4162316a5cafe67d29526530b37` | [#362](https://github.com/numero-uno-jpn/rStats.js/issues/362) (open) | L-BFGS-B 2.1 portのworkspace indexing、1-based offsets、active set、Cauchy point、subspace solve、line search、memory updateを再監査。 | 既存の1D quadratic/fixed-variable/lower-only/upper-only/memory wrap/index offsetsの確認を保持。#851: `optim([0],x=>(x[0]-2)**2,{method:'L-BFGS-B',control:{lmm:1.5}})`。wrapperはlmmをinteger validationせず渡し、lbfgsbのM/K leading dimensionsとworkspace lengthsにfractional mが入り、Float64Arrayのfractional property readsはundefinedとなってNaN arithmeticを誘発する。m<=0のみのvalidationでは不十分。静的workspace/index解析。Vitest/package runtime/R実行なし。 |
| `src/optim/localmin.ts` | 問題あり・追加監査済み | #275, #582, #702, #710 | `e91b4a827cb9589a4539b326cd48155ec3ce6988` | [#61](https://github.com/numero-uno-jpn/rStats.js/issues/61) (closed/fixed); [#126](https://github.com/numero-uno-jpn/rStats.js/issues/126) (open); [#212](https://github.com/numero-uno-jpn/rStats.js/issues/212) (open); [#220](https://github.com/numero-uno-jpn/rStats.js/issues/220) (open) | Brent localminのparabolic/golden step、stagnation、tol境界、非有限objective wrapper、極端な有限bracketを再監査。 | #702: `localMin(x=>(x/1e308-1.1)**2,1e308,1.7e308)`。`0.5*(a+b)`がInfinityとなり、探索中点が右側に固定され、左側にある真の最小値を見落とす。Issue #212。#710: `localMin(x=>x*x,-1,1,NaN)`はNaN trial/endpointを作りloopが進まない。`tol=Infinity`は初期点で即時終了する。正の有限tol検証が必要。Issue #220。静的制御フロー・IEEE-754解析のみ。 |
| `src/optim/optim.ts` | 問題あり・追加監査済み | #276, #738, #742, #843, #844 | `b0adf40e7b8433cd39111a835580a9a5b3b2108c` | [#248](https://github.com/numero-uno-jpn/rStats.js/issues/248) (open); [#252](https://github.com/numero-uno-jpn/rStats.js/issues/252) (open); [#354](https://github.com/numero-uno-jpn/rStats.js/issues/354) (open); [#355](https://github.com/numero-uno-jpn/rStats.js/issues/355) (open) | Nelder-Mead/BFGS/CG/L-BFGS-B/SANN/Brentのcontrol validation、scaled problem、Brent iteration capを追加監査。 | #738/#742は既存記録を保持。#843: `optim([Infinity],()=>0,{method:'Nelder-Mead'})`。simplex初期stepがInfinity、`Infinity+Infinity===Infinity`のため初期vertex構築loopが停止しない。#844: `optim([0],x=>x[0]**2,{method:'BFGS',gr:()=>[Infinity]})`。analytic gradientが有限性検証されず、backtrackでstepが0になっても`0*(-Infinity)=NaN`、`unchanged()`がfalseのまま非終了。NaN gradientは誤ってconvergence 0を返す経路もある。静的call graph・control-flow・IEEE-754解析のみ。Vitest/package runtime未実施。 |
| `src/random/as241.ts` | 追加監査済み・実装問題未検出（コメントの範囲表記に不正確さ） | #135, #494 | `3e7d42b5c0d867cc1bfe06f2f335d83994dbd7c3` | — | Wichura AS241の係数・中心域/裾域分岐・Horner評価・符号反転を再確認。`normRand()`からの入力範囲を`mt.ts`のuniform生成まで追跡。 | `normRand`は`p=(trunc(2^27*u1)+u2)/2^27`で、MTの最小正uniformは2^-32。従ってpは理論上2^-59程度まで下がり得て、コメントの「p > 2^-54」は厳密には保証されない。ただしAS241のr=sqrt(-ln(p))は約6.4以下で、実装の適用域r<=27に十分収まるため機能的不具合ではない。p∈(0,1)、q=±0.425境界、r=5境界、裾の符号・係数を確認。数値fixtureとR RNG経路を閲覧、実行なし。 |
| `src/random/beta.ts` | 問題あり・既知Issueの再確認 | #122, #401, #406, #505 | `5371b478626066c291432ec2df4529953520f520` | [#30](https://github.com/numero-uno-jpn/rStats.js/issues/30) | Cheng BB/BCをR 4.5.x `rbeta.c` と比較。極端な片側巨大shapeのmean shortcut、BC/BB acceptance、shape cache、ncp chi-square mixtureを再確認。 | 既知Issue #30の条件が現行ソースにも残存。`setSeed(12); rbeta(5,1.1,1e308)` は `2*a*b` overflow shortcutにより5値とも約`1.1e-308`。理論CV≈0.95346で分布は平均に集中しない。追加の独立バグは確定せず。既存fixture 47ケース（中心shape最大50、ncp=1.5含む）を閲覧。Vitest/package runtime/R/Monte Carlo未実行。 |
| `src/random/binomial.ts` | 問題あり | #124 | `92437f63fa655aa541de9ba9b6ae51c0bad0af5b` | — | Inversion/BTPE source review; tiny-p q^n cancellation defect confirmed by binary64 arithmetic | `n=2_000_000_000, p=1e-17`: q rounds to 1, qn=1, every inversion draw returns 0 although P(X≥1)≈2e-8. Issue #31. BTPE formula compared with current R source; fixtures R 4.5.2 inspected only. No Vitest/runtime/R execution. |
| `src/random/common.ts` | 追加監査済み・問題未検出 | #136, #491 | `be016a36e9f09f580462d2bf93e30ed6bad527c1` | — | `powInt` の唯一の呼出し元 `src/random/binomial.ts:rbinom1` を追跡。`rn >= INT_MAX` は `qbinom` 経路へ分岐するため、`powInt(q,n)` に渡る指数は整数 `0 <= n <= 2147483646`。32-bit shift はこの到達可能域で安全。RNG/`sample` 呼出し経路も確認。 | `generate(0, f)` は callback を呼ばず、負/NaN/±Infのnを拒否し、有限非負小数は `Math.trunc`。`powInt` は負指数・NaN・±Infの基礎値を確認し、実呼出しの上限でbitwise shiftを検証。具体例: `rbinom(1, 2147483646, 1e-8)` はBTPEではなく平均約21.47のinversion候補、`rbinom(1, 2147483647, 1e-8)` は`qbinom`経路で`powInt`を呼ばない。ソース上の呼出し制約から新規不具合なし。Vitest/package runtime/Rは未実行。 |
| `src/random/continuous.ts` | 問題あり・既知差異あり | #134, #499 | `5ad76e5676b4bf27c36b288f8e48ac3821bfd92a` | [#91](https://github.com/numero-uno-jpn/rStats.js/issues/91) | runif/rnorm/rexp/rlnorm/rlogis/rcauchy/rweibullの式・端値・乱数消費を追加確認。R 4.5.x `src/nmath/rweibull.c` と比較。 | `rweibull()`はshapeの妥当性を先に判定するため、`scale===0`でもshape<=0/NaNではNaNを返す。R 4.5.xは不正引数分岐内で先に`scale==0`を判定し0を返す。具体例 `setSeed(26); rweibull(1,-1,{scale:0})` および shape=NaN, scale=0。両者ともuniform消費なし。既存rother fixtureはshape=2,scale=0のみでこの組合せを未カバー。既知差異 `rlogis(scale<0)` も維持。Issue #91。fixture閲覧・ソース追跡のみ、Vitest/R実行なし。 |
| `src/random/extra.ts` | 問題あり | #130, #500 | `2e5d69e49dab41d9ae05164075051c7beb8e0dd5` | [#92](https://github.com/numero-uno-jpn/rStats.js/issues/92) | extraDistrのR/C++実装と正の無限大パラメータの処理を比較。rinvgammaのR wrapper→base R rgamma、rkumar/rparetoのC++ RNG関数まで追跡。 | `Number.isFinite` による前段rejectで、extraDistrが受理する`+Inf`をNaNとして乱数消費なしにする。`rkumar(1,2,Infinity)`はRで0・1 uniform消費、JSでNaN・0消費。`rpareto(1,{a:2,b:Infinity})`はRで+Inf・1 uniform消費、JSでNaN・0消費。`rinvgamma(1,3,{beta:Infinity})`はRで+Inf、JSでNaN。`rinvgamma(1,Infinity,{beta:1})`はRで0、JSでNaN。既存fixtureは有限パラメータ中心。Issue #92。fixture閲覧・ソース追跡のみ、Vitest/R実行なし。 |
| `src/random/gamma.ts` | 問題あり | #121 | `9a6b479fa51c0e16a8313c9c2518c75130c84004` | [#29](https://github.com/numero-uno-jpn/rStats.js/issues/29) | R本体 `src/nmath/rgamma.c` と不一致 | `rgamma(1,-1,{scale:0})` と `rgamma(1,0,{scale:-1})`。Rは両方0、現行はNaN。負値判定がゼロ判定より先。ソース照合で確定。Vitest・package runtime・今回のR実行なし。 |
| `src/random/hyper.ts` | 追加監査済み・問題未検出 | #126, #492 | `df63732522e39556a07f79edbb5a287f7348fa87` | — | HIN/H2PEと大規模パラメータ時の`qhyper1`/Bernoulli切替を確認。R 4.5.2のrhyper fixtureを閲覧。R側で報告された`m+n`がINT_MAXを超える場合の整数overflow経路と比較し、JS側のNおよび中間計算はNumberで保持されるため同じint32 wrapは生じない。 | `m=n=1073741824, k=20`（N=2147483648）では通常H2PE経路、mode=10、variance≈4.9999999558、d=3.5、xl=7、xr=14となり、全setup値が有限。`m=n=1073741824, k=18`ではmode=9でHIN経路。support端点・全成功/全失敗・k=1のBernoulli・個別引数>=INT_MAXのqhyper経路、HINのscale、H2PE 3領域・accept recurrence/squeeze・cache再構築を確認。新規の独立再現不具合なし。Vitest/package runtime/R未実行。 |
| `src/random/lecuyer.ts` | 追加監査済み・問題未検出（R文書と実装の端状態差異を記録） | #132, #496 | `7bd112bb422a4e4b8dd2bbcf3badaa4da4efe4c3` | — | MRG32k3aのseed expansion・2つのmodular recurrence・uniform mapping・signed/unsigned seed復元と範囲検証を再監査。R 4.5.2 `RNG.c` の `RNG_Init` / `FixupSeeds` と比較。 | 50回LCG scramble後、6個のstate wordを`x < M2`まで再抽出する処理はRと一致。再帰式の最大整数積（`1403580*(M1-1)=6028329902567880`、`1370589*(M2-1)=5886603607816338`等）は2^53未満で、JS Numberでも整数精度を維持。具体fixture: seed 1/42/0/-7/±2147483647のL'Ecuyer runif/rnorm/rexp、`[10407,1,2,3,0,0,0]`のstate復元。最後の3語が全ゼロの状態はRマニュアルの注意事項に反するが、R 4.5.2 `FixupSeeds` は`notallzero`を第1組からリセットせず実際に受理し、fixtureもこの挙動を記録するため、JS側の受理はR互換。fixture閲覧のみ、実行なし。 |
| `src/random/mt.ts` | 問題あり | #133, #498 | `a27a644a591ab2286227aa5db1b05b16fa149300` | [#90](https://github.com/numero-uno-jpn/rStats.js/issues/90) | R 4.5.2 `RNG.c::FixupSeeds` と照合。MTのtwist/tempering・seed初期化は既存範囲を再確認。Rはmti<=0を624に補正するが、JSは0をそのまま使う。 | `setRandomSeed([10403,0,...Array(624).fill(1)])` はJSで受理され、次の`runif(1)`はmt[0]=1を直接読み`2^-32`。Rは`mti<=0`を624に補正してtwistし、同じall-ones stateから最初のuniformは約`0.4630094114691019`。さらに`mti=4294967296`もJSで受理されるが、`getRandomSeed()`のInt32Arrayで0にwrapし、snapshot/restore後のstreamが変わる。`mti=2147483648`はsnapshotで-2147483648となり復元不能。正のmti=625等はRも次回drawでtwistするため許容。Issue #90。source-level再現、Vitest/package runtime/R実行なし。 |
| `src/random/poisson.ts` | 追加監査済み・問題未検出 | #123, #493 | `9f6f9657e84c2110bb08640b1f846c345bd2ff2f` | — | R 4.5.2 `rpois` fixture 32ケースを再確認。R本体 `src/nmath/rpois.c` とCase A/B、Step U/T/C/N/I/S/P/F/Q/E/Hの条件・乱数消費順序を逐次照合。 | 小λ側の`pp[36]`累積表とキャッシュ、λ=10境界、μ変更・再訪時の`muprev/muprev2/newBigMu`、大λ側の`bigL`即時受理、squeeze/quotient/hat受理、指数乱数と符号付き一様乱数を確認。具体入力: `rpois(1, Number.MIN_VALUE)`、`rpois(1, 9.999999999999998)`、`rpois(1, 10)`、`rpois(1, 10.000000000000002)`、`rpois(1, 2**53)`、`rpois(1, 1e154)`、`rpois(1, Number.MAX_VALUE)`、および同一seedでλ=5→0→5、λ=20→10→20のキャッシュ遷移。全分岐はR C実装と一致し、JS Number演算で新規の整数wrap経路なし。新規再現不具合なし。Vitest/package runtime/R/Monte Carlo未実行。 |
| `src/random/r2dtable.ts` | 問題あり・追加監査済み | #127, #502, #709 | `3e5a15a95b5a73e04ec337d441a2976ecbf88583` | [#93](https://github.com/numero-uno-jpn/rStats.js/issues/93) (open); [#219](https://github.com/numero-uno-jpn/rStats.js/issues/219) (open) | R 4.5.x `r2dtable.R` の整数変換、Patefield AS 159、zero-count allocationとgrand-total capを再監査。 | #709: `r2dtable(0,[1_000_000_000,1_000_000_000],[1_000_000_000,1_000_000_000])`は空配列を返すべきだが、count=0でも2,000,000,001要素のFloat64 factorial table（約16 GB）を確保しようとする。実行せず静的allocation traceで確認。Issue #219。 |
| `src/random/rank.ts` | 追加監査済み・問題未検出 | #129, #504 | `4cfe69d81a9a6509c9dbac95b3000a2adfb57433` | — | R 4.5.x `signrank.c` / `wilcox.c` と `nmath.h::R_forceint` を再照合。`R_unif_index` を通じた乱数消費も `RNG.c` と確認。 | `rsignrank` の各rank独立符号付け、`rwilcox` のpartial Fisher–Yatesと最小順位和補正、half-to-even、NaN/負数/ゼロ/Inf、`m+n` allocation ceilingを確認。具体例: `setSeed(27); rsignrank(10,5)`、`setSeed(28); rwilcox(10,3,4)`、`setSeed(28); rwilcox(10,0,5)`。R 4.5.2 fixture 10ケースを閲覧。Rの `R_forceint` とJS `roundHalfEven` はtie-to-evenで一致し、RNG draw順も一致。追加の独立再現不具合なし。Vitest/package runtime/R実行なし。 |
| `src/random/rng.ts` | 既知差異あり・追加監査済み・追加問題未検出 | #137, #392, #395, #495 | `f527fd7018642205ef5870df8fcab8fc9e02aff1` | — | R 4.5.2 rngRounding/rngLecuyer/rngStreams/rbasic fixtureと既存テストを閲覧（未実行）。RNGkind切替・seed/state復元・`rbits`/`unifIndex`に加え、`normRand`の2-uniform合成、`expRand`のAhrens–Dieter SA法をR 4.5.2 `snorm.c`/`sexp.c`と再照合。 | 既知差異：rbinom BTPEのstream差、rlogis負scale、Rの無効状態時の再seed動作。`normRand`は2回のuniformを順番どおり消費し、`trunc(2^27*u1)+u2` を `2^27` で割る処理がRのInversion分岐と一致。`expRand`のdoubling・Q判定・追加uniform最小値抽出・draw順もRのSA法と一致。Q表16値はJS binary64でRの16定数と全件一致し、最終値は厳密に1。MT/L'Ecuyerのuniform端点はともに(0,1)内。具体fixture: `setSeed(1); rnorm(20); runif(1)` next=`0.82094629411585629`; `setSeed(1); rexp(20); runif(1)` next=`0.10794362588785589`; `setSeed(3); rexp(5,{rate:1}); runif(1)` next=`0.60439405404031277`。fixture閲覧のみ、実行なし。 |
| `src/random/sample.ts` | 問題あり・追加監査済み | #128, #396, #399, #503, #723, #724 | `b7ec2fba79900308f7d4c1f745bf45e06be11821` | [#94](https://github.com/numero-uno-jpn/rStats.js/issues/94); [#233](https://github.com/numero-uno-jpn/rStats.js/issues/233) (open); [#234](https://github.com/numero-uno-jpn/rStats.js/issues/234) (open) | R `sample.kind` の weighted replacement alias table constructionと累積確率選択を追加監査。 | #723: `walkerSample()` queue overrun。`const prob=[...Array(199).fill(0.5/201),50.75/201,50.75/201]`で199個のsmall massを消費後、固定loopがlarge entry同士を誤pairし、residual massを1.0/1.0から1.25/0.75へ再配分。Issue #233。#724: `probSampleReplace()` と `probSampleNoReplace()` は降順weightの累積和を作るため、`const prob=[0.5,0.5,1e-16]`は累積配列`[0.5,1,1]`となり、第3カテゴリが到達不能。置換あり/なし双方で正のweightがゼロ確率化する。Issue #234。静的制御フロー・binary64算術traceのみ。Vitest/package runtime/R/Monte Carlo未実施。 |
| `src/random/streams.ts` | 追加監査済み・問題未検出 | #131, #497 | `63359251f6081a7658ebf27e105e6a0ed7c789cb` | — | 2^76/2^127 jump行列、`mulMod`のbinary64安全性、state validation、stream/substreamの連続適用を再監査。BigIntによる独立行列累乗で4行列定数を照合。 | `A1^2^76`, `A1^2^127`, `A2^2^76`, `A2^2^127`を漸化式行列から独立計算し、実装定数と全36要素が一致。`mulMod(a,b,m)`では`a,b<m<2^32`、`hi<=65535`のため各積・和は2^49未満、行列内の累積も2m未満でbinary64整数精度内。`t|0`はInt32Arrayの符号付きstate格納と一致。R 4.5.2 `rngStreams.json`のseed 1/42/123456789、stream/substreamの混在・反復fixtureを閲覧（未実行）。無効kind code、短いstate、無効なmodulus word、first component all-zeroを検証する既存テストも確認。新規不具合なし。Vitest/R実行なし。 |
| `src/special/besselIK.ts` | 問題未検出 | #277 | `66fd0dbb53c64d7aa52c27ce6b96f640482e6dac` | — | Modified Bessel I/K series, Temme, continued fractions, Wronskian, recurrence, scaled exponent and large-order log boundsを追跡。 | `besselI/K(x,nu)` with x `0`, `Number.MIN_VALUE`, `1e-310`, `1`, `1e308`, `Infinity`; nu `0`, `±0.5`, `1`, `1000`, `1e12`; scaled/unscaled, integer/negative noninteger orders and recurrence limitsを確認。Vitest/package runtime/R未実行。 |
| `src/special/besselJY.ts` | 問題未検出 | #278 | `72fbd7798357b583eb92556d320998fb85c9ce3c` | — | J/Y power series, asymptotic Hankel expansions, order recurrence, Wronskian and negative-order reflectionを追跡。 | `besselJ/Y(x,nu)` with x `0`, `Number.MIN_VALUE`, `1e-300`, `1`, `100`, `1e308`, `Infinity`; nu `0`, `±0.5`, `±1`, `1000`, `1e12`; near-integer reflection, large-order range bounds and asymptotic transitionを確認。Vitest/package runtime/R未実行。 |
| `src/special/besselSeries.ts` | 問題未検出 | #279 | `ab0d8df401ba07f397f1fef22742a4c6674c4937` | — | 共通series prefixのlog-gamma/Poisson scaling、underflow/overflow回避、subnormal x経路を追跡。 | `seriesTimesPrefix(v,x,sum)` のv `0`, `0.5`, `10`, `1e3`, `1e308`、x `Number.MIN_VALUE`, `1e-300`, `1`, `1e308`; gamma/log prefix and zero/infinite sum edgesを確認。Vitest/package runtime/R未実行。 |
| `src/special/beta.ts` | 問題未検出・追加監査済み | #280, #541 | `bd639c0fdaa40df7e6579ffa0b76a67c6d738e97` | — | beta/lbetaのspecial-case順序、large-shape DD/huge式、small-shape lgamma ratio、asymptotic branch到達可能性、符号・overflow・underflowを再監査。 | 入力: `beta(1e308,1e308)`, `lbeta(1e308,1e308)`, `beta(1e308,1)`, `beta(1e308,0.5)`, `beta(1e308,1e-308)`, `beta(1e308,1e-320)`, `lbeta(1e-310,1e-310)`, `lbeta(1e-320,1e-20)`, `beta(0,Infinity)`, `beta(Infinity,0)`, `beta(Infinity,1)`, `lbeta(Infinity,1)`および引数交換。positive finite large-shapeではearly DD/huge branchが`lbetaAsymp`より先に処理するため、古いasymp branchは実質zero-shape fallbackのみ。`lbetaHuge`のa+b=Infinity時はstirlerr(Infinity)=0、sumTermを分割して有限に保つ。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/special/choose.ts` | 問題あり・追加監査済み | #281, #547 | `2e6ccb1afeeb6a30c677aeccd774573a67775601` | [#107](https://github.com/numero-uno-jpn/rStats.js/issues/107) (open) | 小kのDD falling product、scaled overflow、large-k beta/reflection、R snap、lchoose log fallbackを再監査。 | `lchoose(Number.MIN_VALUE,2,{rCompatible:false})`でDD係数がunderflowして0となり、exact nonzero coefficientのlogを`-Infinity`と誤判定。期待値は`-1075*Math.LN2`。Issue #107。Vitest/package runtime/R実行なし。 |
| `src/special/constants.ts` | 問題未検出 | #282 | `a91323eca383899e9b268af39f700cc356dc61bc` | — | 定数定義のみ。IEEE-754表現、π/log constants and shared exportsを確認。 | 全定数のliteral/aliasとimport先を静的確認。関数・分岐・ユーザー入力なし。runtime未実行。 |
| `src/special/dd.ts` | 問題あり・追加監査済み | #283, #535, #538, #855 | `e1713eb700507dfb0f36df8b9a7c591b679742a1` | [#62](https://github.com/numero-uno-jpn/rStats.js/issues/62) (closed/fixed); [#105](https://github.com/numero-uno-jpn/rStats.js/issues/105) (open); [#374](https://github.com/numero-uno-jpn/rStats.js/issues/374) (open) | IEEE-754 binary64の演算とdouble-double表現を独立照合。Issue #62修正後のprodErrScaledとIssue #105の除算欠陥を再確認 | 現行`prodErrScaled`は`scale2(error,ka+kb)`に変更され、旧逐次スケーリングの中間underflowを解消。Issue #62 close後の`twoProd(1e-320,1e308)`と逆順、`twoProd(1e-308,1e308)`の経路をソース確認。`ddDiv`/`ddDivNum`のsubnormal divisor問題は現行コードにも残存。再現: `ddDiv([Number.MIN_VALUE,0],[3*Number.MIN_VALUE,0])`, `ddDivNum([Number.MIN_VALUE,0],3*Number.MIN_VALUE)`。#105 open。Vitest/package runtime/R実行なし。 #855: `ddAdd()`は2 componentのerror-free additionだが、wideSumのoverflow rescaling後に3つ以上の離れたexponent bandを保持できず、後続cancellationで第三項が消失。具体例はAudit #855。静的解析のみ。 |
| `src/special/erf.ts` | 問題未検出・追加監査済み | #284, #543 | `f72136920c3138354d5d6cd4a342055e590e0fad` | — | Cephes erf/erfc/erfcx rational regions, exp(-x²) DD residual, subnormal tail, infinities and large-x asymptoteを再監査。 | 入力: `erf(±0)`, `erf(±1)`, `erf(±Infinity)`, `erfc(±1)`, `erfc(27.2)`, `erfc(27.3)`, `erfc(±Infinity)`, `erfcxNonNegative(0.9999999999999999)`, `erfcxNonNegative(1)`, `erfcxNonNegative(7.999999999999999)`, `erfcxNonNegative(8)`, `erfcxNonNegative(1e8)`, `erfcxNonNegative(1e8+1)`, `erfcxNonNegative(1e308)`, NaN。`erfc`のhi=700境界、MAXLOG+40 cutoff、x² overflow、twoProd nonfinite pathを確認。x>1e8で省略するerfcx補正は最大約5e-17でbinary64丸め未満。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/special/extra.ts` | 問題未検出・追加監査済み | #285, #549 | `f4da727f23f20c049946c5c962f54ac270678e26` | — | gammaincの非正規化tail、erfinv/erfcinvのlog-tail変換・Newton、permのfalling product/gamma ratio/reflectionを再監査。 | 入力: `gammainc(0,0.5)`, `gammainc(Infinity,1e308)`, `gammainc(5e-324,0.5)`, `gammainc(1e308,171.7)`, `erfcinv(0)`, `erfcinv(5e-324)`, `erfcinv(2**-1021)`, `erfcinv(2)`, `erfinv(±0)`, `erfinv(±1)`, `erfinv(1e-300)`, `erfinv(0.5±Number.EPSILON)`, `perm(1.5e154,2)`, `perm(5.5,6)`, `perm(5,5)`, `perm(5,6)`, `perm(1e308,0.5)`, `perm(1e308,1e308)`。smallTailの正規/ subnormal切替、erfcinvの2^-1021境界、erfinv Newton 3回、gammaRatioの巨大n近似と反射を追跡。Infinity引数はreal finite n/kの仕様外。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/special/gamma.ts` | 問題未検出・追加監査済み | #286, #542 | `f630bdd496fc204dd24b6b04603c7b511a5cb107` | — | gamma/lgammaの反射公式、sinpi、負の大引数の符号、MAXGAM/MAXLGM、subnormal近傍、lgamma1p Taylorを再監査。 | 入力: `gamma(-34.00000000000001)`, `gamma(-34.5)`, `gamma(-34.99999999999999)`, `gamma(-171.5)`, `gamma(-172.5)`, `gamma(33)`, `gamma(33.00000000000001)`, `gamma(MAXGAM)`, `gamma(MAXGAM+2**-44)`, `lgammaSign(-34.00000000000001)`, `lgammaSign(-1e100)`, `lgamma(0.8)`, `lgamma(1.2)`, `lgamma(1.8)`, `lgamma(2.2)`, `lgamma1p(±0.2)`, `lgamma1p(1±0.2)`, `gamma(±5e-324)`。負の大引数のq*sinpi(q)因子と符号を反射公式から照合。MAXGAM付近のstirfと10項recurrence fallback、Taylor切替端を追跡。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/special/igam.ts` | 追加監査済み・問題未検出 | #119, #311 | `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620` | — | `test/fixtures/pgamma.json`、`pgamma.ref.json`、`audit_pgamma.mpmath.json`、`gammainc.mpmath.json`、`gammainc_regions.mpmath.json` と gamma distribution callerを閲覧（実行なし） | gammaInc/gammaIncBothのspecial endpoints、x≫a asymptotic、a<A_SUB upper-tail scaling、series/DD series、continued fraction/Lentz切替、Temme central/far-tail、eta/deviance、log/linear complementを追跡。具体入力: `gammaInc(5e-324,1e-300,true,true)`, `gammaInc(1e308,5e-324,true,true)`, `gammaInc(1e308,1e308,true,true)`, `gammaInc(1e300,1e-300,false,true)`, `gammaInc(1e-300,1e-300,false,true)`, `gammaInc(1e6,1e6*(1+1e-8),false,true)`, `gammaInc(2,1e200,false,true)`。既存fixture sourceと全分岐を確認したが、新規の独立再現不具合なし。Vitest/R/package runtime実行なし。 |
| `src/special/igamAsympCoeff.ts` | 問題未検出・追加監査済み | #287, #544 | `303c31a00d04790f242125345c8a1d6e984b0774` | — | Temme不完全ガンマ漸近展開係数表の全要素数・有限性・利用側index/打切りを再監査。 | JSで静的検査: `D`は25行×25係数、全625要素が有限数値。`K=N=25`と`temmeSum`のk=0..24/n=0..24を照合。入力: eta=0, ±Number.MIN_VALUE, ±0.1, ±0.3, ±1, ±4.5/sqrt(a)を係数多項式評価の想定域として境界追跡。eta=0では各行のn=0係数のみを使用、etaが大きい場合は外側のfarAsymptoticでc0閉形式に切替。配列範囲外アクセス・非有限係数なし。元のSciPy生成スクリプトと照合実行は未実施。Vitest/package runtime/R実行なし。 |
| `src/special/igami.ts` | 追加監査済み・問題未検出 | #120, #312 | `008fc2b262eaa649093211a40e9d7fdd83facdcf` | — | `qgamma.json`、`auditq_qgamma.mpmath.json` と `gamma.ts:qgammaStd/logTinyGammaQuantile` 呼出経路を閲覧（実行なし） | DiDonato–Morris Eq.21–36のshape<1/≥1分岐、p/q反転、gamma(a) overflow、subnormal shape、q near 0/1、eq25多項式、didonatoSN停止、a≥500近中心近似、Newton初期値の利用を追跡。具体入力: `qgamma(0.5,Number.MIN_VALUE)`, `qgamma(1-1e-15,1e-308)`, `qgamma(1e-300,0.01)`, `qgamma(1e-300,0.5)`, `qgamma(1-1e-15,1e6)`, `qgamma(1e-320,1e300)`。tiny quantile branchは極小shapeでfindInverseGammaに入る前に処理し、gamma(shape) overflow候補を回避。初期値はinvertContinuousで補正される。新規再現不具合なし。Vitest/R/package runtime実行なし。 |
| `src/special/incbet.ts` | 問題未検出・追加監査済み | #288, #536 | `59a4ebdf385c69124e68fae6d16159bfd6709a24` | — | pseries/pseriesComplement、double-double continued fraction2種、tail選択、tinyX、subShapeTail、log/linear同時返却、100000反復上限とrescaleを追跡。Audit #535のsubnormal divisor除算欠陥が公開pbeta経路へ到達する条件も追加検証。 | `betaIncUncapped`の先行分岐順を追跡。`a<SUB_SHAPE`かつ`b>SUB_OTHER`は`subShapeTail`、`x`/`1-x` subnormalは`betaIncTinyX`、両shapeが小さい領域は小さい側のframeで`pseriesOk`となり、subnormal shapeを分母に持つcontinued fractionを回避する。large/small shapeは`betaIncLargeA`へ委譲。`ddDiv`/`sDiv`がsubnormal denominatorを受ける一般的な内部helper欠陥（#105）は残るが、この分岐構造から新たな公開pbeta再現を確定できず。具体例: `pbeta(0.5,5e-324,5e-324)`, `pbeta(0.99,5e-324,5e-324)`, `pbeta(0.5,5e-324,1e-250)`, `pbeta(1e-320,5e-324,2)`, `pbeta(1-1e-15,1e-300,1e-300)`。既存`test/beta.test.ts`のR fixtureSuiteとlargeA/largeDf fixture dispatchを閲覧。ソース追跡のみ、Vitest/package runtime/R実行なし。 |
| `src/special/incbetLargeA.ts` | 問題未検出・追加監査済み | #289, #538 | `9eabe133979cd41a00a904c61cb60ed6b35b6693` | — | large-a/small-b expansionの領域判定、J/H side、upper gamma scaled CF、p_n recurrence、H_N下向き再帰、asymptotic truncation、巨大aのDD scalingとlog fallbackを追跡。 | `LARGE_A_MIN=15`, `SMALL_B_MAX=40`, `Y_MAX=0.3`, `U_MIN_J=0.1`, `U_MAX=500`, `NMAX=30`, `EPS=2^-56`の境界と分岐を追加確認。J CFの最大反復約1010、H級数の収束条件、巨大Tでの`4*T*T` overflow時にH側はN=0/J側補正は真のO(T^-2)以下となる条件を追跡。巨大aでxのhiが1に丸まるケースも確認。入力: `betaIncLargeA(15,0.1,[0.7,0],[1-0.7,0],true,true)`, `betaIncLargeA(15,40,[0.7,0],[1-0.7,0],false,true)`, `betaIncLargeA(1e300,0.1,[1,-1e-300],[1e-300,0],true,true)`, `betaIncLargeA(1e308,0.5,[1,-1e-300],[1e-300,0],false,true)`, `betaIncLargeA(1e308,0.5,[1,-Number.MIN_VALUE],[Number.MIN_VALUE,0],true,true)`。`scripts/mpmath/smallb.py`のseed 20261025、gamma quantile参照法と既存fixture生成方針を確認。新規再現バグなし。Vitest/package runtime/mpmath実行なし。 |
| `src/special/incbetPrefactor.ts` | 問題未検出・追加監査済み | #290, #537 | `bf49427ee0d86f326b25dbb3841c4f355ca6444c` | — | small-shape/huge-shape prefactor、lgammaRatioHugeの打切り誤差、smallShapeGの分岐、log1m、mulBigのスケーリングを追跡。Audit #535のsubnormal DD除算/乗算欠陥がこのprefactor経路に与える影響も検討。 | `prefactorParts`のsmall/huge shape切替、c=s/(1+s/l)と1/Gamma(s)、`smallShapeG`のl<1/≥1/huge分岐、`lgammaRatioHuge`の省略項、`log1m`の1e-15境界、`mulBig`の1e290 scalingとoverflowを追加確認。具体入力: `prefactorParts(Number.MIN_VALUE,0.5,[0.5,0],[0.5,0])`, `prefactorParts(1e-300,1e308,[0.5,0],[0.5,0])`, `prefactorParts(100,2**52,[0.5,0],[0.5,0])`, `smallShapeG(Number.MIN_VALUE,1e-20)`, `lgammaRatioHuge(100,2**52)`, `mulBig([Math.log(Number.MIN_VALUE),0],1e308)`。subnormal shapeでは低位誤差の絶対量がshape自体よりさらに小さく、prefactorのbinary64出力に影響する独立再現は確定せず。Vitest/package runtime/R実行なし。 |
| `src/special/incbetTemme.ts` | 問題未検出・追加監査済み | #291, #539 | `cf22538af050c12366e0e0a19ab40ddcd09c7db6` | — | Temme一様漸近展開の変数変換、Taylor係数生成、1/m展開、central/tail形式の切替、a+b overflow時のhalvingとDD devianceを追加監査。 | `TEMME_MIN_M=25`, `TAU_MAX=1`, `Y_SWITCH=1.5`, `NMAX=30`, `KMAX=12`の境界、gCoefficients再帰、central correction、tailのerfcx-leading cancellation、`erfcxMinusLeading`のCF、a+b overflow/巨大rのmulLargeを追跡。入力: `betaIncTemme(50,50,[0.5,0],[0.5,0],true,true)`, `betaIncTemme(1e308,1e308,[0.5,0],[0.5,0],false,true)`, `betaIncTemme(1e308,50,[1,-5e-307],[5e-307,0],true,true)`, `betaIncTemme(25,25,[0.5,0],[0.5,0],true,true)` (m<25でundefined確認), E=2.25近傍と|tau|=1近傍はlargebeta.pyのfixture生成ロジックで境界を確認。`TWO_PI*m` overflowはm>MAX/TWO_PIで生じるが、失われる補正項はO(m^-3/2)でbinary64出力に影響しない範囲。新規再現バグなし。Vitest/package runtime/mpmath実行なし。 |
| `src/special/lgammaDiff.ts` | 問題未検出・追加監査済み | #292, #540 | `22ddcc50b01890dafbbb49a1a1aa7ac2c840dfee` | — | lgamma(b+a)-lgamma(b)のrecurrence、Stirling差分expm1級数、DD主項、全呼び出し元のshape制約を追加監査。 | 実呼び出し元`beta/lbeta`と`incbetPrefactor.smallShapeG`ではa=min(shape)<1かつb>1、またはb≥1に制限され、a/Bのoverflowは到達不能。`B=15`のrecurrence境界、`a/B` underflow、`B²` overflow、S[0..6]打切り、lead0=2/DD切替、`B+a`丸めを確認。入力: `lgammaDiffDD(0.5,15)`, `lgammaDiffDD(0.5,15+Number.EPSILON*16)`, `lgammaDiffDD(0.5,1e8)`, `lgammaDiffDD(1e-16,1e308)`, `lgammaDiffDD(5e-324,1e308)`, `lgammaDiffDD(1e-300,15)`, `lbeta(1e-8,1e308)`, `beta(0.5,1e308)`。a/Bがsubnormal化する境界で中間項の相対誤差はa未満となり、最終beta/lbetaの1e-14許容精度を破る再現は確認せず。Vitest/package runtime/R実行なし。 |
| `src/special/loader.ts` | 問題あり・追加監査済み | #96, #534, #854 | `10f87090b292397f0a429f85c5edfeef79fe435b` | [#24](https://github.com/numero-uno-jpn/rStats.js/issues/24); [#375](https://github.com/numero-uno-jpn/rStats.js/issues/375) (open) | Rとの実行比較なし。Loader (2000) の deviance/Stirling 式と IEEE-754 の範囲・丸めをソース照合 | `stirlerr` の半整数表・n<1式・15/35/80/500切替と再帰、`bd0dd` の近接級数/遠距離式/2^-64 scaling、`bd0Prod` の極小np対数経路、`dbinomRawDD` の端点・DD確率・分母、`dpoisRawCore` のlambda/x極端比と巨大x分母を追加確認。具体入力: `stirlerr(0.5)`, `stirlerr(15)`, `stirlerr(15+Number.EPSILON*4)`, `stirlerr(500)`, `stirlerr(500+Number.EPSILON*256)`, `bd0dd(0,[1e308,0])`, `bd0dd(1e308,[1e308,0])`, `bd0dd(1e-300,[1e-320,0])`, `dbinomRawDD(8e307,8e307,[0.5,0],[0.5,0],false)`, `dpoisRaw(1e308,1e308,true)`, `dpoisRaw(1e308,1e308,false)`, `dpoisRaw(0,Number.MIN_VALUE,true)`。既知Issue #24の分母 `2*Math.PI*x` overflowは現行ソースにも残存し、独立Issue化せず。新規の再現可能な不具合は確定せず。数式・分岐のソース追跡のみ。Vitest/package runtime/R実行なし。 #854: `bd0()` returns a binary64 number after `bd0dd()`; for `mu=1e-300` and a one-ulp increment, the unweighted bd0 term (~2.465e-332) is below the subnormal range and is rounded to zero before the caller applies a large prior weight. Static IEEE-754 trace only. |
| `src/special/log1p.ts` | 問題未検出・追加監査済み | #293, #546 | `dc2f13d6617f0ce76986a8b88f353c45819d378f` | — | log1pmx/lgamma1p/log1mexp/log1pexpの境界・特殊値・切替式とlog1pmxの呼出経路を再監査。 | `log1mexp(±0)`, `log1mexp(±Infinity)`, `log1pexp(±37)`, `log1pexp(18)`, `log1pexp(33.3)`, `lgamma1p(-1)`, `lgamma1p(-2)`, `lgamma1p(-1±Number.EPSILON)`, NaNを追跡。log1pexpの-37/18/33.3の近似省略誤差は切替点でbinary64 rounding以下。log1pmx(0)の遅延は#106で記録。その他新規数値誤りなし。Vitest/package runtime/R実行なし。 |
| `src/special/log1pmx.ts` | 問題あり・追加監査済み | #294, #546 | `2645eccad6849a9c217899b99e71e58d6e7055f8` | [#106](https://github.com/numero-uno-jpn/rStats.js/issues/106) (open) | xsf/Cephes級数、直接log1p-x経路、subnormalでの収束判定を再監査。 | 入力: `log1pmx(0)`, `log1pmx(Number.MIN_VALUE)`, `log1pmx(1e-200)`, `log1pmx(-1e-200)`, `log1pmx(±0.5)`, `log1pmx(-1)`, `log1pmx(Infinity)`, NaN。x=0およびx² underflow時、term=res=0で`0<0`がfalseとなりn=2..499の498反復を全実行。`igam.ts:temmeEta`でx=aならsigma=0となり到達可能。非zero極小xの符号付きゼロも+0に丸まる。Issue #106。Vitest/package runtime/R実行なし。 |
| `src/special/ndtri.ts` | 問題未検出・追加監査済み | #295, #551 | `a053252d5cbafbbb22f395fc4c2034da9c2ee5e9` | — | ndtri/ndtriExpのcentral/tail境界、upper-tail complement、log確率の極端値とsqrt overflow回避を再監査。 | 入力: `ndtri(0)`, `ndtri(1)`, `ndtri(0.5)`, `ndtri(2**-1022)`, `ndtri(Number.MIN_VALUE)`, `ndtri(1-Number.EPSILON/2)`, `ndtri(EXP_M2)`, `ndtri(1-EXP_M2)`, `ndtriExp(0)`, `ndtriExp(-Math.LN2)`, `ndtriExp(-2048)`, `ndtriExp(-Number.MAX_VALUE)`, `ndtriExp(-Infinity)`, `ndtriExp(Infinity)`, NaN。exp(-2)/1-exp(-2)境界、exp(-32) tail近似境界、y=-MAX/2のsqrt切替、upper-tail exact subtractionを確認。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/special/polevl.ts` | 問題未検出・追加監査済み | #296, #545 | `165b2c81afea8cb58b56f67264dafdf22810f089` | — | Horner評価の係数順序、空/単項配列、非有限x、係数配列の内部呼び出し契約を再監査。 | 入力: `polevl(2,[1,2,3])`, `polevl(0,[1,2,3])`, `polevl(-2,[1,2,3])`, `p1evl(2,[2,3])`, `p1evl(0,[2,3])`, `polevl(±Infinity,[1,2])`, `p1evl(NaN,[1])`。両関数はCephes定義通りのHorner順序。実呼び出し元の係数配列は非空固定配列。空配列は内部契約外で、利用側で発生しない。新規再現バグなし。Vitest/package runtime/R実行なし。 |
| `src/special/psigamma.ts` | 問題未検出・追加監査済み | #297, #548 | `6318724165a556417c0644172c9e80d4735c3b4e` | — | digamma近負根Taylor、Hurwitz zeta Euler–Maclaurin、正のxのscaled polygamma、負x反射とcot導関数多項式を再監査。 | 入力: `digamma(NEGROOT)`, `digamma(-0.5)`, `digamma(-34.5)`, `trigamma(±0.5)`, `psigamma(0.5,100)`, `psigamma(1e308,100)`, `psigamma(1e-154,1)`, `psigamma(-0.5,100)`, `psigamma(-1.5,100)`, `psigamma(-Infinity,1,{rCompatible:false})`, deriv=-0.5/100.5/101。cotDerivPoly(100)の最大係数は約1e168で有限、π^101を掛けても係数自体はoverflowしない。Hurwitz zetaのq<=1e8直接和・EM切替、q>1e8漸近項、subnormal/overflowを追跡。新規再現バグなし。Vitest/package runtime/R実行なし。 |
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


## Audit #327-#328

- #327 `src/distributions/t.ts`: reviewed central t density, CDF and quantile; finite/tiny/huge/infinite df branches; Loader/Stirling density formula; x² overflow; tiny-df asymptotics; beta argument scaling; far-tail incomplete-beta approximation; quantile asymptotic/normal start and inversion. No new independent reproducible defect isolated. Inputs include `dt(1e154, 1e200, {log: true})`, `dt(1e100, 1e-80)`, `pt(-5.05, 2.4e-242)`, `pt(-3.5e151, 4.3e121)`, `qt(1.6e-243, 1e120)`, and `qt(1e-300, 1e-310, {lowerTail: false})`.
- #328 `src/distributions/nt.ts`: confirmed Issue #66 in the noncentral-t near-zero/integral dispatch. Reproduction candidate: `pt(Number.MIN_VALUE, 1e4, {ncp: 1.7e308, logP: true})`. With a = df/2 = 5000, `abs(t)/sqrt(a)` underflows to 0 while `Math.SQRT2 * ncp` overflows to Infinity; `nearZero` therefore evaluates `0 * Infinity` as NaN and fails its shortcut. `farLimit(a,ncp)` also overflows to Infinity, leaving the log integral with an unrepresentable -Infinity peak; the source path can then form `-Infinity - (-Infinity)` as NaN. The mathematical limiting value is `log Φ(-ncp) = -Infinity` (linear CDF 0). GitHub Issue #66 created. This is source-level control-flow analysis; package runtime/Vitest were not executed.
- Existing tests/fixtures inspected: `test/nt.test.ts`, `dt.json`, `pt.json`, `qt.json`, `ptLargeDf.json`, `dnt.json`, `pnt.json`, and `qnt.json`; also reviewed the large-df/tiny-df regression cases in `nt.test.ts`. Full source and helpers `dpq.ts`, `invert.ts`, `dd.ts`, `incbet.ts`, `igam.ts`, `loader.ts`, and `normal.ts` were inspected. Vitest, npm package runtime and R were not executed.
- Source blobs: `t.ts` `78247f0318768944233dc6e92874409b23e432b8`; `nt.ts` `85763973f3f7a82d46ceee19a4dd0f8d8c275814`; `nt.test.ts` `256fd766b66bbb636d57a89a0549d3f6ccb1e297`.
- Repository HEAD at audit: `8e3870db29f38c34eae5657195e6061a703b956c`.


## Audit #329-#330

- #329 `src/distributions/bvnorm.ts`: confirmed Issue #67. The exact `rho = -1` branch in `upperOrthant(h,k,r)` uses `max(0, Φ(-h) - Φ(-k))`, but since Y = -X the intersection is `h < X < -k`, whose probability is `max(0, Φ(-k) - Φ(h))`. Reproduction: `pbvnorm([1, -2], [2, 0], -1)`; the true intersection is X in [1,2], probability `Φ(2)-Φ(1) ≈ 0.13590512198327787`, while the current orthant branch yields zero and the rectangle is clipped to zero. Issue #67 created. Also reviewed rho = +1, infinite bounds, reflection, rectangle inclusion-exclusion, Gauss-Legendre nodes/weights, |rho|→1 singular expansion and input validation. Existing `pbvnorm.json` fixture covers rho values through ±0.999 but not exact ±1, explaining the missing degenerate-correlation case. No additional independent defect isolated.
- #330 `src/distributions/multinomial.ts`: confirmed Issue #68. When the finite weight sum overflows, the code scales each weight by `2^-ceil(log2(K))`; a positive subnormal weight can become exactly zero, and the subsequent `w[k] === 0 && x[k] > 0` check mistakes it for an exact zero probability. Reproduction: `dmultinom([1, 0, 0], [Number.MIN_VALUE, 1.7e308, 1.7e308], {log: true})`. The exact log probability is approximately `-1454.8600559951694` (linear probability correctly underflows to zero), but the source returns `-Infinity`. Issue #68 created and its numerical value corrected after recomputing the log expression. Also reviewed vector length, nonnegative integer counts, size validation, suffix sums in double-double, exact-zero categories, all-mass-in-one-category shortcut, product/log accumulation and the large-weight overflow scaling. No additional independent defect isolated.
- Existing tests/fixtures inspected: `test/multinom.test.ts`, `pbvnorm.json`, `dmultinom.json`, and `dmultinom.mpmath.json`. Full source and helpers `normal.ts`, `loader.ts`, `dd.ts`, `summary.ts` were inspected. No Vitest/npm runtime/R execution was performed; both issues are source-level findings with algebraic/numerical reproductions.
- Source blobs: `bvnorm.ts` `3fab7f50d90262fb3295fae0ba5980f636b4ef11`; `multinomial.ts` `5062beb4a7b75d3f2afae82fb732aefee2937b76`; `multinom.test.ts` `b792acb9ede0f96c7b140c598e5d145ec6a0a426`; `pbvnorm.json` `cbcb1c7a579c1a4a5cbcaf3ff9a72f24cec404f6`; `dmultinom.json` `d15dc877b1851ba458e2a2f274b4989dca02ea90`; `dmultinom.mpmath.json` `f6c3e7c301f1170550ec819a648b56f9c9b92f77`.
- Repository HEAD at audit: `5d3312655f583667a996609d880b47ba28049b50`.


## Audit #329-#330

- #329 `src/distributions/bvnorm.ts`: confirmed Issue #67. The exact `rho = -1` branch in `upperOrthant(h,k,r)` uses `max(0, Φ(-h) - Φ(-k))`, but since Y = -X the intersection is `h < X < -k`, whose probability is `max(0, Φ(-k) - Φ(h))`. Reproduction: `pbvnorm([1, -2], [2, 0], -1)`; the true intersection is X in [1,2], probability `Φ(2)-Φ(1) ≈ 0.13590512198327787`, while the current orthant branch yields zero and the rectangle is clipped to zero. Issue #67 created. Also reviewed rho = +1, infinite bounds, reflection, rectangle inclusion-exclusion, Gauss-Legendre nodes/weights, |rho|→1 singular expansion and input validation. Existing `pbvnorm.json` fixture covers rho values through ±0.999 but not exact ±1, explaining the missing degenerate-correlation case. No additional independent defect isolated.
- #330 `src/distributions/multinomial.ts`: confirmed Issue #68. When the finite weight sum overflows, the code scales each weight by `2^-ceil(log2(K))`; a positive subnormal weight can become exactly zero, and the subsequent `w[k] === 0 && x[k] > 0` check mistakes it for an exact zero probability. Reproduction: `dmultinom([1, 0, 0], [Number.MIN_VALUE, 1.7e308, 1.7e308], {log: true})`. The exact log probability is approximately `-1454.8600559951694` (linear probability correctly underflows to zero), but the source returns `-Infinity`. Issue #68 created and its numerical value corrected after recomputing the log expression. Also reviewed vector length, nonnegative integer counts, size validation, suffix sums in double-double, exact-zero categories, all-mass-in-one-category shortcut, product/log accumulation and the large-weight overflow scaling. No additional independent defect isolated.
- Existing tests/fixtures inspected: `test/multinom.test.ts`, `pbvnorm.json`, `dmultinom.json`, and `dmultinom.mpmath.json`. Full source and helpers `normal.ts`, `loader.ts`, `dd.ts`, `summary.ts` were inspected. No Vitest/npm runtime/R execution was performed; both issues are source-level findings with algebraic/numerical reproductions.
- Source blobs: `bvnorm.ts` `3fab7f50d90262fb3295fae0ba5980f636b4ef11`; `multinomial.ts` `5062beb4a7b75d3f2afae82fb732aefee2937b76`; `multinom.test.ts` `b792acb9ede0f96c7b140c598e5d145ec6a0a426`; `pbvnorm.json` `cbcb1c7a579c1a4a5cbcaf3ff9a72f24cec404f6`; `dmultinom.json` `d15dc877b1851ba458e2a2f274b4989dca02ea90`; `dmultinom.mpmath.json` `[not re-fetched in this update]`.
- Repository HEAD at audit: `e3553b4eb84523918466b0d2fc26ccc1e63b350c`.


## Audit #331-#333

- #331 `src/distributions/signrank.ts`: reviewed n rounding/validation, support calculation and symmetry, coefficient DP update order, periodic rescaling and minTrusted logic, low-table rebuild/cache eviction, Kahan cumulative sums, log probability reconstruction, R's q+1e-7 convention, and discrete quantile bracketing beyond 2^53. No new independent reproducible defect isolated. Inputs reviewed include `dsignrank(0, 2000, {log:true})`, `dsignrank(95000, 2000, {log:true})`, `psignrank(95000, 2000, {lowerTail:false, logP:true})`, `qsignrank(0.5, 2000)`, `qsignrank(-745, 1000, {logP:true})`, and `psignrank(3.6, 5)`.
- #332 `src/distributions/wilcox.ts`: confirmed duplicate of Issue #37. `wilcoxParams` checks `m*n > 2**53` using an already-rounded Number product. For `m=3, n=3002399751580331`, the exact integer product is `9007199254740993 = 2^53 + 1`, but binary64 multiplication rounds it to `9007199254740992`, so the unsupported support range bypasses the guard. Reproduction: `dwilcox(0, 3, 3002399751580331, {log:true})`. Issue #69 was closed as a duplicate of #37. Also reviewed m/n rounding, symmetric table normalization, double-double q-binomial recurrence, cancellation/overflow cutoff, minTrusted and low-table fallback, cache, cumulative sums, log probability, q+1e-7 CDF convention and discrete quantile. No additional independent defect isolated.
- #333 `src/distributions/tukey.ts`: reviewed Clenshaw-Curtis weights/transform and convergence test, adaptive subdivision limits, inner range-CDF lower/upper integrands, narrow-window normal differences, Chebyshev interpolation and cache, small-w asymptotics, large-w scaled complement, outer Gamma log-density and tail edges, df→Infinity approximation, log-integral path, small-tail selection, tiny-q power scaling, quantile residual and Brent bracketing. No new independent reproducible defect isolated. Inputs include `ptukey(0.5, 1000, 10)`, `ptukey(2.5e118, 4, 3, {nranges:2, lowerTail:false})`, `ptukey(2**-1000, 2, 486.9, {logP:true})`, `qtukey(-726.9, 2, 486.9, {logP:true})`, `qtukey(0.95, 4, 20)`, and `ptukey(3.5, 3, Infinity)`.
- Existing tests/fixtures inspected: `test/tukey.test.ts`; `dwilcox.json`, `pwilcox.json`, `qwilcox.json`; `dsignrank.json`, `psignrank.json`, and `qsignrank.json`. Full source for the three distributions and `src/internal/discrete.ts` was inspected. Vitest, npm package runtime and R were not executed; Issue #37 is the canonical source-level validation finding based on binary64 product rounding.
- Source blobs: `signrank.ts` `fb0dfa41c1a99f41e7e8d5d5dfb7896fc7de4afb`; `wilcox.ts` `20361aac59ba97cee84f31949e6134ea30e1d029`; `tukey.ts` `d9d8b47fdd9203b21f4bb88f6056314618dee354`; `tukey.test.ts` `40920f07133a8b207a4ab35c5465cccb73b2b368`; `dwilcox.json` `a86e2808e72386c657e93a93b89ebeee21a80221`; `pwilcox.json` `feb249802419f587a43422fbc877aa3672fdeb1c`; `qwilcox.json` `e1766d7ca2c65afd7a55129b759bfdf86e5ac7b6`; `dsignrank.json` `d81714ad3be469059bc64c48c817dbe3e0bf40d2`; `psignrank.json` `e722306776e074f2ae0f7e2663e66ab749cf43e1`; `qsignrank.json` `d5d0b69adf7a120931a488cfcc368fb1bf864805`.
- Repository HEAD at audit: `71d3e1101e58b4208bfd068f63d57ca7e348e274`.


## Audit #334-#337

- #334 `src/special/besselIK.ts`: reviewed I/K special values and negative-order reflection, Temme series near x <= 2, Steed continued fraction, I ratio continued fraction, Wronskian normalization, forward K recurrence with binary exponent scaling, small-x series, large-x asymptotics, scaled/unscaled resolution, exp splitting and large-order log bounds. Checked subnormal x, half-integer orders, x near overflow, order near/above LARGE_ORDER, and negative noninteger cancellation. No new independent reproducible defect isolated. Inputs include `besselI(Number.MIN_VALUE, 0.5)`, `besselI(1e-310, 0)`, `besselK(1e-300, 0.5, {exponScaled:true})`, `besselI(1e308, 0, {exponScaled:true})`, `besselI(1000, 2, {exponScaled:true})`, and `besselK(1, 1e12)`.
- #335 `src/special/besselJY.ts`: reviewed J/Y special values, integer and noninteger negative-order reflection, small-z series, Temme expansion, forward/backward recurrences, Wronskian normalization, Hankel asymptotic dispatch, CF1/CF2, power-of-two rescaling and large-order bounds. Checked x subnormal, x=0/Infinity, half-integer closed forms, near turning point and large x/order. No new independent reproducible defect isolated. Inputs include `besselJ(Number.MIN_VALUE, -0.5)`, `besselY(Number.MIN_VALUE, -0.5)`, `besselJ(1e-300, 100)`, `besselY(5, 500)`, `besselJ(2211, 575)`, and `besselY(1e5, 1000)`.
- #336 `src/special/besselSeries.ts`: reviewed log(x/2) and (x/2)^v for subnormal x, Loader-Poisson prefix switch, log-domain reconstruction, positive-series bounds and certainRange overflow/underflow decisions. No new independent reproducible defect isolated. Inputs include `seriesTimesPrefix(32, 1e-200, 1)`, `seriesTimesPrefix(500, 1e-300, 1)`, `logISeriesBounds(1e308, 1e308)`, and `certainRange({lo:-1000,hi:-999,size:1})`.
- #337 `src/special/psigamma.ts`: reviewed digamma reflection and recurrence, rational approximation [1,2], asymptotic branch, negative-root Taylor cache, Hurwitz-zeta Euler-Maclaurin summation, polygamma scaling, derivative 0..100 rounding, cot(pi x) reduction and high-order reflection polynomial. Checked negative poles, half-integers, values near poles/root, large positive x and deriv=100. No new independent reproducible defect isolated. Inputs include `digamma(-0.5040830082644554)`, `digamma(-1e-300)`, `trigamma(-3.5e-242)`, `psigamma(-100.3, 100)`, `psigamma(1e308, 100)`, and `psigamma(1e8, 100)`.
- Existing tests inspected: `test/bessel.test.ts` (R and mpmath reference suites, random/region cases, special values and identities) and `test/psigamma.test.ts` (R/mpmath fixtures, derivative endpoints, poles and infinities). Full source of the four audited modules and Bessel test harness was inspected. Vitest/npm runtime/R were not executed; this batch produced no new issue.
- Source blobs: `besselIK.ts` `66fd0dbb53c64d7aa52c27ce6b96f640482e6dac`; `besselJY.ts` `72fbd7798357b583eb92556d320998fb85c9ce3c`; `besselSeries.ts` `ab0d8df401ba07f397f1fef22742a4c6674c4937`; `psigamma.ts` `6318724165a556417c0644172c9e80d4735c3b4e`; `bessel.test.ts` `3317e484cd6e2545ab30927c48deb4ca372a4241`; `psigamma.test.ts` `eeeb4bb3aece8c27cc5527c16b5cadb0540d8b98`.
- Repository HEAD at audit: `0dadf36b144eb9108d8bd454a19c62a6b2366d08`.


## Audit #338-#342

- #338 `src/special/beta.ts`: reviewed beta/lbeta endpoint conventions, zero/infinity combinations, sign handling, large-argument asymptotic, double-double log-beta, huge-a+b overflow split, small-shape gamma overflow and large-parameter cancellation. Checked equal huge shapes, one subnormal shape, extreme imbalance and sum overflow. No new independent reproducible defect isolated. Inputs include `beta(1e-310, 1e-310)`, `lbeta(1e-310, 1e-310)`, `beta(1e308, 1e308)`, `lbeta(1e308, 1e308)`, `lbeta(1e308, 1e-300)`, and `beta(1e300, 1e-300)`.
- #339 `src/special/gamma.ts`: reviewed gamma and signed log-gamma reflection, negative poles, subnormal arguments, recurrence, Stirling threshold/MAXGAM, large positive x asymptotic, lgamma1p Taylor truncation/branch joins and sinpi reduction for large arguments. Checked values around 0, 1, 2, -34, -177.5, MAXGAM and large finite x. No new independent reproducible defect isolated. Inputs include `gamma(Number.MIN_VALUE)`, `lgamma(Number.MIN_VALUE)`, `gamma(-177.5)`, `lgamma(-1e308)`, `gamma(171.6243769563027)`, and `lgamma1p(0.2)`.
- #340 `src/special/choose.ts`: reviewed small-k double-double falling product and scaled fallback, large-k beta identities for positive/fractional/negative n, R-compatible snapping, sign and exact-zero cases, k rounding, infinite arguments and log result. Checked n near integer snap thresholds, k around 29/30, large n where n-j loses low bits, and k close to n. No new independent reproducible defect isolated. Inputs include `choose(1.5e154, 2)`, `choose(1e15 + 0.125, 2)`, `choose(-1e-10, 40)`, `choose(191.38, 503, {rCompatible:false})`, `lchoose(1e-10, 1)`, and `choose(5, 2.5)`.
- #341 `src/special/lgammaDiff.ts`: reviewed recurrence to B>15, log1p ratio, double-double leading term, Stirling-error difference via expm1, small/large a/b ratios and overflow boundaries. No new independent defect isolated for the documented precondition a>=0,b>0 and its current beta/incomplete-beta call paths. Inputs include `lgammaDiff(1e-300, 1e308)`, `lgammaDiff(0.5, 1e15)`, `lgammaDiff(1e100, 1e200)`, and `lgammaDiff(1e308, 1e308)`.
- #342 `src/special/extra.ts`: reviewed nonregularized incomplete-gamma product/log outputs, exact zero tails, small-tail DD exponent, erfcinv subnormal probability split, erfinv endpoint/small-y/Newton branches and permutation integer/fractional/reflection/overflow paths. No new independent reproducible defect isolated. Inputs include `gammainc(Number.MIN_VALUE, 1e-300)`, `gammainc(1e308, 1e308)`, `gammainc(Infinity, 1e308)`, `erfcinv(Number.MIN_VALUE)`, `erfinv(1e-300)`, `perm(1e6, 2.5)`, and `perm(1e308, 2)`.
- Existing tests inspected: `test/beta.test.ts` (beta, incomplete beta and connected distribution suites), `test/choose.test.ts` (choose/factorial R and mpmath references plus boundary tests), and `test/gamma.test.ts` (gamma/chi-square/Poisson distribution suites). Full source of the five audited modules was inspected. Vitest/npm runtime/R were not executed; no issue was opened in this batch.
- Source blobs: `beta.ts` `bd639c0fdaa40df7e6579ffa0b76a67c6d738e97`; `gamma.ts` `f630bdd496fc204dd24b6b04603c7b511a5cb107`; `choose.ts` `2e6ccb1afeeb6a30c677aeccd774573a67775601`; `lgammaDiff.ts` `22ddcc50b01890dafbbb49a1a1aa7ac2c840dfee`; `extra.ts` `f4da727f23f20c049946c5c962f54ac270678e26`; `beta.test.ts` `319ce81d026f279b528f948d146d4c0c858c7321`; `choose.test.ts` `2c6ee078f9b03288385586a4b062d86ee9cd827e`; `gamma.test.ts` `db75474bb21ad3531f9ae071cffa359023e1af37`.
- Repository HEAD at audit: `ae3545d59ef29ef9bc821a1b42ca941234d92888`.


## Audit #343-#347

- #343 `src/special/erf.ts`: reviewed erf/erfc symmetry, rational approximation region joins at |x|=1 and x=8, scaled erfcx, exact square split via twoProd, exp(-x²) subnormal reconstruction, overflow/underflow cutoffs and erfcx large-x asymptotic. No new independent reproducible defect isolated. Inputs include `erf(Number.MIN_VALUE)`, `erf(-Infinity)`, `erfc(27)`, `erfc(27.2)`, `erfc(-Infinity)`, and `erfcxNonNegative(1e308)`.
- #344 `src/special/log1p.ts`: reviewed domains and exact endpoints for log1pmx, lgamma1p, log1mexp and log1pexp; branch joins around -37, 18 and 33.3; signed infinities; subnormal inputs; and consistency with internal kernels. No new independent reproducible defect isolated. Inputs include `log1pmx(-1)`, `log1pmx(Number.MIN_VALUE)`, `lgamma1p(-1)`, `lgamma1p(-Infinity)`, `log1mexp(Number.MIN_VALUE)`, `log1pexp(-Infinity)`, and `log1pexp(Infinity)`.
- #345 `src/special/log1pmx.ts`: reviewed alternating power series for |x|<0.5, termination threshold and direct log1p(x)-x branch at/above boundary, including x near -1 and large positive x. No new independent reproducible defect isolated. Inputs include `log1pmx(-0.49999999999999994)`, `log1pmx(-0.5)`, `log1pmx(0.5)`, `log1pmx(1e-16)`, and `log1pmx(1e308)`.
- #346 `src/special/polevl.ts`: reviewed Horner evaluation order and monic/non-monic polynomial conventions against all callers' coefficient layout. No new independent reproducible defect isolated; generic polynomial overflow is inherent in unscaled evaluation and callers use bounded domains.
- #347 `src/special/rCompatible.ts`: type-only option contract; no runtime logic or independent defect.
- Existing tests inspected: `test/erf.test.ts`, `test/log1p.test.ts`, `erf.mpmath.json`, `erfc.mpmath.json`, `erfcinv.json`, `erfinv.json`, `log1pexp.json`, and `log1pmx.json`. Vitest/npm runtime/R were not executed; no issue was opened in this batch.
- Source blobs: `erf.ts` `f72136920c3138354d5d6cd4a342055e590e0fad`; `log1p.ts` `dc2f13d6617f0ce76986a8b88f353c45819d378f`; `log1pmx.ts` `2645eccad6849a9c217899b99e71e58d6e7055f8`; `polevl.ts` `165b2c81afea8cb58b56f67264dafdf22810f089`; `rCompatible.ts` `feaa578359e0a3315eedc20a6da93a1f60285eb9`; `erf.test.ts` `10c82052f3e6fd1e555766fd2bed8010a066923a`; `log1p.test.ts` `5f9b894a7f29d575e9696a8206f3e48dd96963f7`.
- Repository HEAD at audit: `08e1fd5e938cedfa15bc4bfab4e865e35d9915fa`.


## Audit #348-#355

- #348 `src/special/incbet.ts`: reviewed regularized incomplete-beta dispatch and both-tail selection, endpoint handling, p-series and complement cancellation tests, double-double continued fractions (including coefficient stepping across binades and 2^52), rescaling, tiny-x/subnormal path, sub-shape scaling, and direct log reconstruction. No new independent reproducible defect isolated. Inputs include `betaInc(2, 3, 0.4, 0.6, true, false)`, `betaInc(0.01, 1e4, 1e-4, 1 - 1e-4, false, true)`, `betaInc(1e8, 0.01, 1 - 1e-6, 1e-6, false, true)`, `betaIncTinyX(1.4e304, 0.5, Number.MIN_VALUE, [-744.4400719213812, 0], true, true)`, and shape values around (2^{52}).
- #349 `src/special/incbetLargeA.ts`: reviewed large-a/small-b asymptotic region filters, J/H tail selection, upper incomplete-gamma continued fraction, lower-series recurrence, Miller coefficients, asymptotic truncation before term growth, double-double (u=T(-\log x)), prefactor reconstruction, and x-rounded-to-one/log-tail fallback. No new independent reproducible defect isolated. Inputs include `betaIncLargeA(1e200, 2, [1, 0], [2e-200, 0], false, true)`, `betaIncLargeA(1e200, 2, [1, 0], [1e-200, 0], true, true)`, and cases around (u=0.1, 500), (y=0.3), and (b=40).
- #350 `src/special/incbetPrefactor.ts`: reviewed small-shape and huge-shape prefactor identities, gamma-ratio asymptotics, cancellation in (s\log l), double-double logarithms of x and 1-x, overflow scaling in `mulBig`, and underflow/Infinity propagation. No new independent reproducible defect isolated. Inputs include `prefactorParts(1e-300, 1e308, [1e-308, 0], [1, 0])`, `prefactorParts(0.5, 1e300, [1, 0], [1e-300, 0])`, and `lgammaRatioHuge(1e-100, 1e308)`.
- #351 `src/special/incbetTemme.ts`: reviewed Temme change-of-variable coefficient recurrence, in-place expansion order, Gauss-Legendre half-erfc correction, tail continued fraction, overflow-safe (a+b)/(ab)/(rx), deviance and τ dispatch, central-vs-tail formula switch, and direct log-tail computation. No new independent reproducible defect isolated. Inputs include `betaIncTemme(1e308, 1e308, [0.5, 0], [0.5, 0], true, true)`, `betaIncTemme(1e6, 1e6, [0.5, 0], [0.5, 0], true, true)`, and τ-boundary cases around 0.5, 0.75 and 1.
- #352 `src/special/igam.ts`: reviewed lower series and double-double variant, upper continued fraction and Lentz fallback, small-x upper series, Temme central expansion, far-tail expansion, (a\to0) scaling, huge-a dispatch, and paired log/linear results. No new independent reproducible defect isolated. Inputs include `gammaInc(1e6, 1e6, true, true)`, `gammaInc(1e300, 1e300, false, true)`, `gammaInc(1e-310, 1, false, true)`, `gammaInc(2, 1e308, false, true)`, and values at the (x=1.1), (a=20,200), and (a=1e299) dispatch boundaries.
- #353 `src/special/igami.ts`: reviewed DiDonato-Morris starting approximations for (a<1), Eq. 25 extreme-tail expansion, normal-deviate starting value, large-a central approximation, upper-tail logarithmic branch, lower-tail series corrections and branch thresholds. The function is a starting-value generator; final inversion is performed by `src/internal/invert.ts`. No new independent reproducible defect isolated. Inputs include (a=0.01, 0.29, 0.3, 0.5, 1, 500, 1e6), probabilities near 0.1/0.5/0.9, and log-tail probabilities near -700.
- #354 `src/special/igamAsympCoeff.ts`: checked coefficient table dimensions (25×25), ordering and correspondence to `temmeSum`'s Horner evaluation and truncation. No executable logic or independent defect identified.
- #355 `src/special/ndtri.ts`: reviewed inverse-normal central and two tail rational approximations, reflection around 1-exp(-2), endpoints, subnormal probabilities, log-probability path `ndtriExp`, and overflow-safe square-root scaling. No new independent reproducible defect isolated. Inputs include `ndtri(Number.MIN_VALUE)`, `ndtri(1 - Number.EPSILON / 2)`, `ndtriExp(-745)`, `ndtriExp(-Number.MAX_VALUE)`, `ndtriExp(-0)`, and `ndtriExp(NaN)`.
- Existing tests/fixtures inspected: `test/beta.test.ts`, `audit_pbeta.mpmath.json`, `audit_pbeta_large.mpmath.json`, and `audit_pbeta_smallb.mpmath.json`. The large/small-b fixture fetches returned empty content through the GitHub contents endpoint, so those fixture contents were not independently inspected in this batch. Full source for the eight audited modules was fetched; Vitest/npm runtime/R were not executed. No issue was opened.
- Source blobs: `incbet.ts` `59a4ebdf385c69124e68fae6d16159bfd6709a24`; `incbetLargeA.ts` `9eabe133979cd41a00a904c61cb60ed6b35b6693`; `incbetPrefactor.ts` `bf49427ee0d86f326b25dbb3841c4f355ca6444c`; `incbetTemme.ts` `cf22538af050c12366e0e0a19ab40ddcd09c7db6`; `igam.ts` `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620`; `igami.ts` `008fc2b262eaa649093211a40e9d7fdd83facdcf`; `igamAsympCoeff.ts` `303c31a00d04790f242125345c8a1d6e984b0774`; `ndtri.ts` `a053252d5cbafbbb22f395fc4c2034da9c2ee5e9`; `beta.test.ts` `319ce81d026f279b528f948d146d4c0c858c7321`; `audit_pbeta.mpmath.json` `f01ba661f4287fd2eee1ed44adcd1d519d47dc60`.
- Repository HEAD at audit: `39a0cc142d09af54f4151c25844414776485e34a`.


## Audit #356-#360

- #356 `src/special/loader.ts`: reviewed Loader's `stirlerr` half-integer table and Stirling branches, `bd0dd` close/far formulas and scaling, double-double deviance tail, `bd0Prod` small-product fallback, binomial exponent and endpoint branches, and Poisson density's zero/small/large-rate branches and log/linear reconstruction. Traced the Poisson and binomial helpers through their public distribution wrappers to confirm NaN/domain checks. No new independent public-API defect isolated. Inputs include `stirlerr(0.5)`, `stirlerr(15)`, `stirlerr(15.25)`, `bd0(1e-300, 1e-300)`, `bd0(1e308, 1e308)`, `dpois(0, 0)`, `dpois(1, Number.MIN_VALUE)`, `dpois(1e308, 1e308)`, `dbinom(1e308, 1e308, 0.5)`, and `dbinom(0, 1e308, Number.MIN_VALUE)`.
- #357 `src/special/dd.ts`: reviewed error-free `twoSum`/`twoProd`, scaled product-error recovery, expanded add/subtract/multiply/divide kernels, double-double mode switch, subnormal and near-overflow scaling, and table-reduced `ddLog` including nonpositive/NaN/infinite inputs. Compared the expanded operations with their documented algebraic forms and inspected the direct ddLog edge tests. No new independent reproducible defect isolated. Inputs include `twoProd(Number.MAX_VALUE, 0.5)`, `twoProd(1e300, 1e-300)`, `ddDiv([1, 1e-30], [3, 1e-30])`, `ddLog([Number.MIN_VALUE, 0])`, `ddLog([Number.MAX_VALUE, 0])`, and `ddLog([NaN, 0])`.
- #358 `src/internal/integer.ts`: reviewed half-to-even rounding for positive/negative ties, relative integer slack, values around 2^53, signed zero, NaN and infinities. No new independent defect isolated in its current callers, which perform their own NaN/finite checks where required. Inputs include `roundHalfEven(-2.5)`, `roundHalfEven(2.5)`, `roundHalfEven(3.5)`, `nonInt(1 + 1e-9)`, `nonInt(1 + 1.1e-9)`, and `nonInt(Number.MAX_VALUE)`.
- #359 `src/internal/dpq.ts`: reviewed endpoint mapping for linear/log probabilities, invalid probability handling, upper/lower-tail inversion, and smaller-tail conversion including probabilities adjacent to 1 and subnormal p. No new independent defect isolated. Inputs include `quantileBoundaries(-1, 0, 1, true, false)`, `quantileBoundaries(0, 0, 1, false, true)`, `smallerTail(Number.MIN_VALUE, true, false)`, `smallerTail(1 - Number.EPSILON / 2, true, false)`, and `smallerTail(-745, false, true)`.
- #360 `src/internal/invert.ts`: reviewed monotonic bracket updates for both tails, log/linear residual selection, safeguarded Newton and optional Halley steps, positive-support log-coordinate transform, stuck/converged handling, post-solve x-space polishing, and bitwise midpoint bisection when adjacent doubles matter. No new independent reproducible defect isolated. Inputs include positive-support inversion with `x0=0), a subnormal target, an infinite upper bracket, a Newton step outside the bracket, a step rounded back to the current x, and a residual plateau at adjacent representable x values.
- Supporting callers/tests inspected: `src/distributions/poisson.ts`, `src/distributions/gamma.ts`, `src/distributions/binomial.ts`, `test/special.test.ts`, and `test/gamma.test.ts`. Vitest/npm runtime/R were not executed; the listed reproductions are source-derived test candidates, not claimed runtime outputs. No issue was opened.
- Source blobs: `loader.ts` `798b92185091204205e77d1e8e81e4591e7d78c3`; `dd.ts` `1e377fb5795b4695ca7ad147b48b7ead850d2fe6`; `integer.ts` `007ee293d3df0d02b4a2a38cc72a2479c5a5e4f0`; `dpq.ts` `543eb6ceb3de7627a7562b035a931a88da424aa7`; `invert.ts` `54aeaa15ec93053e2dd5fd19fc640a9fbf243a76`; `poisson.ts` `8bac99d8cfb238c1d682278c145798d0c44abc0b`; `gamma.ts` `e9ba1c35ef88e77e84a392562bb7f62378fcbf7f`; `binomial.ts` `2f90ac1e001443b0704f33e76585cb2868497724`; `special.test.ts` `4f55e4edb8c4cb27a3e51e1604e3cc24d975a354`; `gamma.test.ts` `db75474bb21ad3531f9ae071cffa359023e1af37`.
- Repository HEAD at audit: `983c7e3932b09cfa37046b3c348d05ecaf09acc6`.


## Audit #361-#369

- #361 `src/internal/discrete.ts`: reviewed lower/upper-tail predicate construction, linear/log probability slack, complementary-tail comparisons near 1, starting-value clamping, exponential bracketing, overflow-to-`Number.MAX_VALUE` handling, bisection beyond 2^53, NaN propagation, and `firstTrue`/`lastTrue` integer searches. No new independent defect isolated for the repository's current discrete-distribution/test callers. Inputs include `discreteQuantile` with targets `Number.MIN_VALUE`, `1 - Number.EPSILON / 2), `p=-745` in log mode, a starting value above 2^53, and an infinite upper support; also `firstTrue(i => i >= 1000000, 0, Infinity)` and `lastTrue(i => i <= 1000000, 0, 2000000)`.
- #362 `src/internal/uniroot.ts`: reviewed log-odds bracketing by doubling, sign-change handling, representable endpoints 0/Infinity, and handoff to Brent with cached endpoint values. No new independent defect isolated. Inputs include roots at ψ=1, near `Number.MIN_VALUE), near `Number.MAX_VALUE), and functions whose sign does not change within finite representable ψ.
- #363 `src/internal/scaledInverse.ts`: reviewed per-column exponent selection, upper-triangular scaling, exact power-of-two rescaling, and the mapping of inverse-(R'R) back to original column units. No new independent defect isolated. Inputs include diagonal columns with scales (10^{-200}), (10^{200}), subnormal values, and mixed column magnitudes.
- #364 `src/internal/seq.ts`: reviewed length rounding by ceil, n=0/1 behavior, exact final endpoint assignment, finite-span interpolation, and overflow-safe half-coordinate interpolation when `to - from` overflows. No new independent defect isolated. Inputs include `seqLength(-1e308, 1e308, 3)`, `seqLength(1, 10, 1)`, `seqLength(1, 10, 0)`, and fractional lengths.
- #365 `src/internal/vectorize.ts`: reviewed scalar, ordinary-array and Float64Array paths, output-shape preservation, typed-array mapping and empty inputs. No new independent defect isolated. Inputs include scalar NaN, `[]`, `new Float64Array([1, NaN])`, and a readonly number array.
- #366 `src/internal/summary.ts`: reviewed overflow-aware wide sums, recursive scaled means, nonfinite propagation, centered scaling, variance/covariance and standard deviation, group moments, paired differences, Satterthwaite df, rank/tie handling, missing-value helpers, expected-count products, and scaled Euclidean norm. No new independent reproducible defect isolated. Inputs include `mean([1e308, 1e308])`, `mean([1e308, -1e308])`, `variance([-1e308, -1e308, -1e308, -1e308, 1.5e308])`, `covariance([1e308, 1e308], [1e-308, -1e-308])`, `productOver(1e308, 1e308, 1e308)`, `norm2([1e200, 1e200])), and arrays containing both NaN and infinities.
- #367 `src/internal/extremes.ts`: reviewed empty-array identities, NaN propagation via Math.min/Math.max, overflow-safe midpoint for finite endpoints, and infinities. No new independent defect isolated. Inputs include `maxOf([])`, `minOf([])`, `maxOf([1, NaN])`, and `midpoint(-1e308, 1e308)`.
- #368 `src/internal/levels.ts`: reviewed -0 normalization, NaN exclusion from level maps, sorted unique numeric values, 15-significant-digit collisions and preservation of nonnumeric labels. No new independent defect isolated. Inputs include `numberLevels([0.1 + 0.2, 0.3, -0, 0, 1e15, 1e15 + 1, NaN])` and `levelText(Infinity)`.
- #369 `src/internal/covmat.ts`: reviewed square/finite/positive-diagonal checks and symmetry validation after common power-of-two scaling. No new independent defect isolated. Inputs include a symmetric positive-definite matrix with entries near (10^{308}), a matrix with entries near (10^{-320}), a one-ulp asymmetry, and matrices with zero diagonal, NaN, or ragged rows.
- No independent issue was opened in this batch. The review was source-level; Vitest/npm/R were not executed. The listed cases are concrete reproduction candidates, not claimed runtime results.
- Source blobs: `discrete.ts` `a8ed86222a9c91b7dfea90b990244a81c1170194`; `uniroot.ts` `942f40b2944b7d97354dcaa095d22a8e07f60405`; `scaledInverse.ts` `49d36a1a12389587eadf8976acd76bbd90e1081d`; `seq.ts` `7475913bf7aaa85ca90a1a52dcf620990cd18e00`; `vectorize.ts` `c53e29599f879b9b1a643af5b588664aaf0c598a`; `summary.ts` `e4fc3bd652af3a00cf05b44389ddf58e590c4830`; `extremes.ts` `00fbd46179043e90fc6678a777fbd9b5540dd7c6`; `levels.ts` `949b2f498a93c9c17bc50a4f2e74c1eef86a0d22`; `covmat.ts` `a042245164638b0c486c769de2c2a9a0eed622cd`.
- Repository HEAD at audit: `b918843329805142e3774740b657ff1e89977149`.


## Audit #370-#374

- #370 `src/linalg/ops.ts`: reviewed matrix multiplication dimension inference for vector/matrix combinations, overflow-rescaled dot products, R-style element recycling, outer/transpose/diag/bind operations, matrix construction, Kronecker products, and sequence generation. **Confirmed Issue #70**: the `seq()` `lengthOut` path computes `step = (b - a) / (len - 1)` directly. With finite endpoints whose difference overflows, it emits an infinite interior value. Exact reproduction: `seq(-1e308, 1e308, { lengthOut: 3 })`; expected `[-1e308, 0, 1e308]`, but source computes `b-a === Infinity` and the middle value becomes `Infinity`. The `by` path also computes `del = b - a` directly and rejects `seq(-1e308, 1e308, { by: 1e308 })` although the finite sequence is representable. GitHub Issue #70 opened. Other inspected branches yielded no additional independent issue.
- #371 `src/linalg/matrix.ts`: reviewed row-major input to column-major conversion, empty matrix conventions, vector-vs-matrix discrimination, transpose, extraction, finite checks, square validation and range exponent. No new independent defect isolated. Inputs include `toMat([])`, `toMat([[], []])`, `toMat([[1, 2], [3]])`, `toMatOrColumn([])`, and range exponents at (2^{-256}), (2^{256}), subnormal and maximum finite values.
- #372 `src/linalg/basic.ts`: reviewed crossprod/tcrossprod dimension handling and symmetric mirroring, vector/matrix right-hand-side shapes, k bounds, zero diagonal checks, upper/lower and transposed triangular solve order, and zero-coefficient skips that avoid `0 * Infinity` contamination. No new independent defect isolated. Inputs include `crossprod([], [])`, `tcrossprod([])`, `backsolve([[1e-308, 0], [0, 2]], [1, 2])`, `forwardsolve([[2, 0], [1, 4]], [4, 10])`, and all four upper/lower × transposed/nontransposed solve branches.
- #373 `src/linalg/norm.ts`: reviewed one/infinity/max/Frobenius/spectral norm dispatch, NaN and Infinity handling, empty dimensions, scaling for Frobenius norm and SVD-based spectral norm. No new independent defect isolated. Inputs include `norm([], {type:"F"})`, `norm([[1e308, 1e308]], {type:"F"})`, `norm([[1e-308, 1e-308]], {type:"F"})`, matrices containing NaN/Infinity, and spectral norm of rectangular matrices.
- #374 `src/linalg/chol.ts`: reviewed unpivoted Cholesky updates and failure index, NaN propagation, pivot selection and swaps, residual diagonal updates, tolerance/rank behavior, triangular inverse and (U U^T) reconstruction in `chol2inv`. No new independent defect isolated. Inputs include `chol([[4,2],[2,3]])`, `chol([[1,1],[1,1]], {pivot:true})`, `chol([[1,0],[0,0]], {pivot:true,tol:0})`, `chol2inv([[2,1],[0,1]])`, and factors with diagonal scales (10^{-200}) and (10^{200}).
- Existing tests inspected: `test/linalg.test.ts`, `test/matrix-ops.test.ts`, `test/chol.test.ts`, and `test/linalg-invariants.test.ts` (fixed-seed decomposition residual and orthogonality checks; seed `20261027`). Vitest/npm runtime was not executed. Issue #70 is a direct source-level arithmetic finding; its reproduction was not executed in Vitest.
- Source blobs: `matrix.ts` `9d78a4c9ae28f2fcc55ea30b5a7297c7441f2eaf`; `basic.ts` `e2e27e6506f3f3f13c73dd6742f1048333e2b782`; `ops.ts` `29dc8503d43b50ee8a0173cf40084b87bd6d17d4`; `norm.ts` `3ee6876b551eab0d51a0abf8b2c3a57680d54457`; `chol.ts` `5444cb2c0f790e8a231c515dead77c069d822e3a`; `linalg.test.ts` `fc2c5088dcba12ed28cd150c8c9550af78b905ab`; `matrix-ops.test.ts` `5749b11736824ea780660ea7a79aba6abbba3f86`; `chol.test.ts` `5a4b5c1b54d94fec8115a019f1359090fbcec1d0`.
- GitHub Issue: #70 — https://github.com/numero-uno-jpn/rStats.js/issues/70
- Repository HEAD at audit: `36c24793ce4ed3110bde3ac3b36c71855d264277`.


## Audit #375-#379

- #375 `src/linalg/lu.ts`: reviewed partial-pivot LU row swaps and permutation orientation (`A = P L U)), subnormal pivot division fallback, zero pivots, rectangular factor dimensions, and `prcomp` centring/scaling, overflow-rescaled fallback, component rank/tolerance truncation, and score reconstruction. No new independent defect isolated. Inputs include `lu([[0,1,2],[1,0,3],[0,2,4]])`, `lu([[Number.MIN_VALUE,1],[2*Number.MIN_VALUE,3]])`, `prcomp([[1,2],[2,3],[3,4]], {rank:1})), a one-row matrix, and columns with magnitudes (10^{308})/(10^{-308}).
- #376 `src/linalg/solve.ts`: reviewed LU factorization/solve, row pivot application, zero-coefficient skips, reciprocal condition estimation (`lacn2`, `gecon`, `trcon`), exact power-of-two scaling, determinant sign/modulus accumulation, and rectangular/triangular `rcond` paths. No new independent reproducible defect isolated. Inputs include `solve([[1e-308,0],[0,2]],[1,2])`, `solve([[1,2],[2,4]],[3,6],{tol:0})`, `determinant([[1,2],[2,4]])), `determinant([[1e308,0],[0,1e-308]],{logarithm:false})), and `rcond([[1,2,3],[4,5,6]],{triangular:true})`.
- #377 `src/linalg/qr.ts`: reviewed LINPACK limited-pivot QR, LAPACK column-pivoted QR, subnormal Householder rescaling, reflector application order, compact-factor reconstruction, rank handling, coefficient backsolve, residual/fitted projections, and least-squares solve. **Confirmed Issue #71**: `qrSolve` applies `Number.isNaN(v) ? 0 : v` to every coefficient to zero-pad unused columns, thereby converting NaN values in used coefficients (e.g. propagated from a NaN response) into zero. Exact reproduction: `qrSolve([[1],[2],[3]],[NaN,2,3])`; expected `[NaN]`, source returns `[0]`. GitHub Issue #71 opened. Inputs also include rank-deficient matrices, wide/full-row-rank matrices, `tol=0), `tol=Infinity), both `lapack` modes, and subnormal columns.
- #378 `src/linalg/svd.ts`: reviewed wide/tall transposition and U/V request mapping, empty dimensions, Householder bidiagonalisation, subnormal `larfg` scaling, implicit QR shift and rotations, convergence guard, singular-value ordering, and exact power-of-two rescaling. No new independent defect isolated. Inputs include zero, rank-one and rectangular matrices; `[[1e308,1e308],[1e308,-1e308]]`; `[[Number.MIN_VALUE,0],[0,2*Number.MIN_VALUE]]`; and `nu/nv) at 0, dimension limits, above dimensions and Infinity.
- #379 `src/linalg/eigen.ts`: reviewed symmetric tridiagonalisation/QL, automatic symmetry detection and lower-triangle convention, nonsymmetric balancing/Hessenberg reduction/real-Schur QR, complex eigenvalue pair layout, eigenvector back substitution and phase/length normalisation, eigenvalue ordering, and extreme-scale recovery. No new independent reproducible defect isolated. Inputs include `[[2,1],[1,2]]`, `[[0,-1],[1,0]]`, repeated eigenvalues, defective Jordan blocks, asymmetric matrices near the auto-symmetry tolerance, and finite matrices scaled near (10^{308}) and (10^{-320}).
- Existing tests inspected: `test/qr.test.ts`, `test/svd.test.ts`, `test/eigen.test.ts`, `test/solve.test.ts`, and `test/linalg-invariants.test.ts`; fixed-seed invariants use seed `20261027` and check (QR), orthogonality, SVD reconstruction, and eigen residuals. Vitest/npm runtime was not executed. Reproduction inputs above are source-derived candidates, not claimed runtime outputs.
- GitHub Issue #71 — https://github.com/numero-uno-jpn/rStats.js/issues/71
- Source blobs: `lu.ts` `457aeee39e56df3f80e654c389a245807ccad55d`; `solve.ts` `6e423f1c2969b896c1715f5af95864c6f59dea24`; `qr.ts` `e19b546d8cee1a82e90e3b5f1f8cfee2e88717c5`; `svd.ts` `b2c4040c56db6cffd9b29f1ccf71106529b4aa46`; `eigen.ts` `86ee78a9fd9f3edbbc35e86f3805ea910e15ff18`; `qr.test.ts` `6119d120084b50c0e7884ec8f55dace89bf4994c`; `svd.test.ts` `cdec55566abe49d35ead92967097f3de7c2bba0e`; `eigen.test.ts` `5c4198e2efd364447d590a0a869b8cd6167e137e`; `solve.test.ts` `f7bb229445baee448b3f5cb75784474ab7140c87`; `linalg-invariants.test.ts` `a2feb9cef91f7426205f8b8f6c9ec422c65431ef`.
- Repository HEAD at audit: `50808b57e7031ce8eac7583011461c338572ae8c`.


## Audit #380-#383

- #380 `src/linalg/balance.ts`: reviewed LAPACK `gebal` permutation of isolated rows/columns, active-submatrix bounds, power-of-two row/column scaling safeguards, zero/underflow guards, and inverse transformation `gebak`. No new independent defect isolated. Inputs include diagonal matrices, matrices with isolated eigenvalues at both ends, a 2×2 active block with row/column norms separated by more than (2^{500}), and one-dimensional active subblocks.
- #381 `src/linalg/expm.ts`: reviewed Higham Padé degree selection and scaling/squaring, balancing and undo transforms, log-norm recovery when column sums overflow, Taylor and Padé Horner recurrences, scaling exponent construction, scaled-pair representation above exponent 1000, CGS solve, and Infinity-aware squaring. **Confirmed Issue #72**: `order` validation accepts large values for which decrement-by-one no longer changes the binary64 number. Exact reproduction: `expm([[0,1],[0,0]],{method:"Taylor",order:1e16})`; the `for (let j=order; j>=1; j--)` loop in `taylorScaled` does not progress because `1e16 - 1 === 1e16). `padeHorner` has the same loop. GitHub Issue #72 opened. Other inspected branches yielded no additional independent issue.
- #382 `src/linalg/kappa.ts`: reviewed exact SVD and norm-based condition numbers, QR/direct estimates, triangular LINPACK `trco`, norm choice/triangle semantics, and Moore-Penrose inverse thresholding. **Confirmed Issue #73**: direct triangular `kappa` sends the unscaled matrix to `trco`; its ordinary sum of absolute column entries can overflow, producing `tnorm=Infinity` and `kappa=Infinity` for a finite matrix. Reproduction pair: `kappa([[1,1],[0,1]],{method:"direct",triangular:true})` versus `kappa([[1e308,1e308],[0,1e308]],{method:"direct",triangular:true})`. The second matrix is (10^{308}) times the first and has the same finite condition number; the estimator need not equal exact 4, but the estimate must be scale-invariant. GitHub Issue #73 opened.
- #383 `src/linalg/schur.ts`: reviewed Schur block detection from conjugate-pair signs, cleanup of entries below quasi-triangular blocks, 2×2 standardisation via `lanv2`, similarity rotations applied to T and Q, eigenvalue extraction, and power-of-two scale recovery. No new independent defect isolated. Inputs include `[[0,-1],[1,0]]`, repeated real eigenvalues, two adjacent complex blocks, a triangular matrix with real spectrum, and extreme finite scales near (10^{308})/(10^{-320}).
- Existing tests/fixtures inspected: `test/expm.test.ts`, `test/schur.test.ts`, `test/svd.test.ts`, `test/eigen.test.ts`, `test/fixtures/expm.json`, `test/fixtures/kappa.json`, and `test/fixtures/schur.json`. The Schur tests check orthogonality, reconstruction, quasi-triangular structure and eigenvalues. Vitest/npm runtime was not executed. The reproductions are source-derived; no runtime results are claimed.
- GitHub Issues: #72 — https://github.com/numero-uno-jpn/rStats.js/issues/72; #73 — https://github.com/numero-uno-jpn/rStats.js/issues/73
- Source blobs: `balance.ts` `b0796b3365f4f23a7a02efdb05628380f85cf284`; `expm.ts` `48da1a1d5e46371cff1404092bbb4d3d24551d26`; `kappa.ts` `098014dac2578986f16d98f5935d62cc2f73b7a1`; `schur.ts` `72838c9df6896ef921d1ec296bd5b93d4624ec4f`; `expm.test.ts` `5b674c5be09bf09dc519d62cb9c2e5bcac68ec76`; `schur.test.ts` `196e4e2284af726d85bad5f83126da7a0951b2df`; `svd.test.ts` `cdec55566abe49d35ead92967097f3de7c2bba0e`; `eigen.test.ts` `5c4198e2efd364447d590a0a869b8cd6167e137e`; `expm.json` `c78032fc9633b22bc9390beb2ae9861921ef0381`; `kappa.json` `2a52afe6cea3cc9f2571ee87da67d51f6a1c4297`; `schur.json` `13401cd1a80e28d6936d1eb63837bee133043bd2`.
- Repository HEAD at audit: `989c1ab5f65bd3ae8babb765721c93eb20195d8a`.


## Audit #384-#390

- #384 `src/numerics/deriv.ts`: reviewed simple and Richardson gradient/Jacobian differences, step selection near zero, extrapolation order, Hessian diagonal and mixed-difference formulas, signed steps, NaN handling and r iteration controls. No new independent defect opened in this pass. Inputs include `grad(x => x[0] ** 2, [0])`, `jacobian(x => [x[0] * x[1], x[0] + x[1]], [2,3])`, `hessian(x => x[0] ** 2 + 3*x[0]*x[1] + x[1] ** 2, [1,2])), and (r=1,4), negative (d), and zeroTol boundaries.
- #385 `src/numerics/integrate.ts`: reviewed finite/infinite and reversed integration bounds, sign handling, overflow-safe interval transformation, tolerance and subdivision validation, optimize scaling, Brent root bracketing/extension and finite-value replacement. **Confirmed duplicate of existing Issue #51**: finite same-sign endpoints can have a finite difference but overflowing sum; the wrapper calls `dqagse`, whose midpoint `0.5*(a+b)` becomes Infinity. Reproduction: `integrate(x => 1/(1+(x/1e308)**2), 1e308, 1.1e308)`; expected (10^{308}(\arctan(1.1)-\arctan(1))\approx4.7583\times10^{306}), while quadrature nodes are evaluated at Infinity. Issue #75 was closed as a duplicate of #51.
- #386 `src/numerics/interp.ts`: reviewed NA-pair dropping, stable knot sorting/tie merging, linear/constant interpolation and extrapolation, overflow-safe linear interpolation, FMM/natural/periodic/Hyman spline systems, monotonicity limiting, derivatives, Hermite interpolation, and barycentric weights. No additional independent defect isolated in this pass. Inputs include tied knots with mean/min/max, (x=[-10^{308},10^{308}]), (y=[0,1]), monotone and nonmonotone data for Hyman, periodic endpoints, repeated barycentric nodes, and Hermite data with coincident doubled nodes.
- #387 `src/numerics/ode.ts`: reviewed Euler, Heun/RK2 and classical RK4 stages, nonuniform/reversed time steps, parameter copying, derivative dimension checks and output row layout. No new independent defect isolated. Inputs include `ode([1],[0,0.5,1],(t,y,p)=>[-p[0]*y[0]],[0.7],{method:"rk4"})`, repeated times, descending times, zero state dimension and derivative-length mismatch.
- #388 `src/integrate/quadpack.ts`: reviewed Gauss-Kronrod 21/15 rules, transformed infinite-range mapping, absolute/ascendant error estimates, Wynn epsilon table, interval error ordering, adaptive subdivision and final ier mapping. No separate kernel defect isolated; the finite-interval midpoint overflow is covered by canonical Issue #51 (the duplicate wrapper report #75 is closed).
- #389 `src/optim/localmin.ts`: reviewed Brent parabolic/golden-section steps, endpoint protection, stopping tolerance and bracket updates. **Confirmed Issue #74**: `optimize()` accepts `tol:0`, but for `f(x)=x*x) the algorithm can reach a subnormal plateau where `eps*abs(x)` underflows to zero. With a positive-width adjacent-double bracket, the golden step rounds to zero, `u===x`, the bracket does not shrink and the unbounded loop repeats. Reproduction: `optimize(x => x*x, -1, 1, {tol:0})`. This is distinct from Issue #61's non-finite-objective stall. GitHub Issue #74 opened and its description was refined to reflect the subnormal trace.
- #390 `src/optim/optim.ts`: reviewed scaled objective/gradient mapping, finite-difference gradients and bounds, Nelder-Mead simplex updates, BFGS inverse-Hessian updates and backtracking, CG restarts, SANN temperature/acceptance schedule, Brent dispatch, L-BFGS-B handoff, Hessian rescaling and result counts. **Confirmed Issue #76**: `control.maxit` is not validated as finite; SANN's `while (evals < maxit)` never terminates for `maxit:Infinity`. Reproduction: `optim([0], x => x[0]*x[0], {method:"SANN", control:{maxit:Infinity}})`. GitHub Issue #76 opened.
- Existing tests/fixtures inspected: `test/numerics.test.ts`, `test/integrate/quadpack.test.ts`, `test/optim/localmin.test.ts`, `test/optim.test.ts`, `integrate.json`, `approx.json`, `spline.json`, and `ode.json`. The source-derived reproductions were not run under Vitest/npm; no runtime results are claimed.
- GitHub Issues: #74 — https://github.com/numero-uno-jpn/rStats.js/issues/74; #51 — https://github.com/numero-uno-jpn/rStats.js/issues/51 (canonical midpoint-overflow report); #76 — https://github.com/numero-uno-jpn/rStats.js/issues/76
- Source blobs: `deriv.ts` `7a339332c11e4b55e6f35fb8f120c7fd2c92311d`; `integrate.ts` `ebafffb5a5862eea43c4b32e4456eed02ba51227`; `interp.ts` `d9c76b9bb91a45caf0b04da7d56d9627bd711f57`; `ode.ts` `6d0a98f2caf7cd2e74f232c2c19fd9191397428e`; `quadpack.ts` `3aef9054b78a50c5ab55ed22008db69c56535d4c`; `localmin.ts` `3dfa016606ccc35da6f69bff24dcc1eb2232e264`; `optim.ts` `3bacfc992f3c178642b03380ccd8c7aca4bc6c1d`; `numerics.test.ts` `adf6305a82952caee7673c4237d5c24322d750a7`; `quadpack.test.ts` `3f37685e28b6db47c8b940ba25a03b47bcbf2bbf`; `localmin.test.ts` `de3420983b0afd25fb1a8cf0fc019e4cdc2b8ef8`; `optim.test.ts` `4cdb89236c87abbece16a06fe17e04e4b780d532`; `integrate.json` `606121207119a70620ea105b67c267f907168afd`; `approx.json` `2502eedbc72c96ab36c1f09861a759d726d5fc92`; `spline.json` `c702ebcc4e75edfc51d9db3440ff3b1abc277467`; `ode.json` `6070594bb9e69eb5427d7ffe63c42cd99e6cbf70`.
- Repository HEAD at audit: `c9836af358c6f940ff149d7b790c3b823010b9e2`.


## Audit #391-#406

- #391 `src/random/common.ts`: reviewed sample-count truncation/range checks, scalar generator invocation and output allocation. No new defect isolated. Inputs include `generate(-0.5,...)`, `generate(0,...)`, `generate(1.9,...)`, `generate(Infinity,...)`, and values near the supported integer-count boundary.
- #392 `src/random/rng.ts`: reviewed MT/L'Ecuyer dispatch, seed/state round trips, kind-code decoding, RNG-kind transitions, open-interval uniforms, integer-bit extraction, rounding/rejection sampling kinds and state mutation on invalid options. No new defect isolated. Inputs include seed 0, -1, 2147483647; MT indices 0, 624, 625; all-zero/invalid L'Ecuyer states; and `unifIndex(1)`, `unifIndex(65536)`, `unifIndex(2**32)`, `unifIndex(2**52)`.
- #393 `src/random/as241.ts`: reviewed AS 241 central/tail rational branches, polynomial coefficient order and the supported open-probability range. No new defect isolated. Inputs include probabilities adjacent to 0 and 1, 0.5, and the branch thresholds 0.075/0.925.
- #394 `src/random/mt.ts`: reviewed MT19937 seeding, twist boundaries, tempering, 32-bit unsigned arithmetic, imported state and regeneration when the state index is at/past N. No new defect isolated. Inputs include seeds 0, 1, -1, all-zero state, indices 0/623/624/625 and words 0/0xffffffff.
- #395 `src/random/lecuyer.ts`: reviewed the 69069 LCG seed scramble, rejection of seeds outside M2, MRG32k3a recurrences, exactness of integer products below 2^53, normalization and state validity constraints. No new defect isolated. Inputs include seed 0, 1, 2147483647, component states at 0, M1-1, M2-1 and invalid all-zero first component.
- #396 `src/random/sample.ts`: reviewed replacement and nonreplacement sampling, rejection and rounding sample kinds, probability validation/normalization, cumulative and Walker alias sampling, alias-table partitioning, and large-n/no-replacement Set paths. No new independent reproducible defect isolated. Inputs include `sampleInt(1,{size:1})`, `sampleInt(2**32,{size:10})`, equal/zero/subnormal probabilities, more than 200 positive categories, and size at/above n.
- #397 `src/random/binomial.ts`: reviewed R BTPE/inversion branches, parameter caching, complement symmetry, acceptance/rejection tests, exact-integer trial validation, and the large-n quantile fallback. No new defect isolated. Inputs include n=0/1/29/30/INT_MAX, p=0/0.5/1, p adjacent to 0 and 1, and fractional n=2.5. R 4.5.2 source confirms `R_forceint(nin)` followed by exact equality check and the same upper-tail qbinom fallback at `INT_MAX`.
- #398 `src/random/gamma.ts`: reviewed Ahrens-Dieter GS and Marsaglia-Tsang gamma generation, cached constants, shape<1 and shape>=1 acceptance tests, chi-square/noncentral chi-square, F/t and inverse-gamma transformations. No new independent defect isolated. Inputs include shape=0, 0.5, 1, just above 1, 1e308, scale=0/Infinity, and noncentrality 0/Number.MAX_VALUE.
- #399 `src/random/poisson.ts`: reviewed small-mean inversion table, large-mean normal proposal/squeeze and exact log acceptance, parameter caching, geometric/negative-binomial and Poisson-mixture branches. No new independent defect isolated. Inputs include mu=0, Number.MIN_VALUE, values around 10, 9.999999999, 1e308, and negative-binomial size/probability limits.
- #400 `src/random/hyper.ts`: reviewed support bounds, HIN inversion and H2PE rejection, log-factorial/Stirling acceptance, large-parameter quantile fallback, and the k=1 Bernoulli special case. No new source defect isolated. The apparent concern about `lowerTail=false` in the large-parameter fallback was a false positive: R's own `src/nmath/rhyper.c` uses `qhyper(unif_rand(), ..., lower_tail=false, log_p=false)` and comments that it is equivalent under (U\leftrightarrow1-U). GitHub Issue #77 was closed as not a defect after checking R's implementation. Inputs include m/n at INT_MAX-1/INT_MAX/INT_MAX+1, k=0/1/2, degenerate supports and central H2PE cases.
- #401 `src/random/beta.ts`: reviewed Cheng BB/BC algorithms, shape ordering/reflection, cached constants, overflowed shape products, degenerate 0/Infinity shapes, and noncentral-beta chi-square mixture. No new defect isolated. Inputs include shapes 0/1/Number.MIN_VALUE/1e308/Infinity and noncentrality 0/Number.MAX_VALUE.
- #402 `src/random/rank.ts`: reviewed signed-rank Bernoulli construction, half-to-even sample-size conversion, rank-sum sampling without replacement, safe rank-array size and sum offset. No new independent defect isolated. Inputs include n=0, 1, 10, fractional ties, Infinity, m+n=INT_MAX and one beyond.
- #403 `src/random/r2dtable.ts`: reviewed Patefield AS159 mode and probability recurrences, row/column residual invariants, zero remaining totals, factorial table construction, margin truncation and total caps. No new independent defect isolated. Inputs include 2×2 and 3×3 margins, zero rows/columns, total 0, equal sums, unequal sums and total=INT_MAX.
- #404 `src/random/streams.ts`: reviewed 2^76/2^127 jump matrices, modular multiplication split into 16-bit pieces to remain exact below 2^53, signed state serialization and RNG kind-code checks. No new defect isolated. Inputs include known stream/substream fixtures, states near each modulus and invalid MT state codes.
- #405 `src/random/continuous.ts`: reviewed runif overflow-safe affine mapping, normal inversion, exponential, lognormal, logistic, Cauchy, Weibull, uniform, triangular and Pareto transformations, endpoint/invalid parameter handling and draw consumption. No new independent defect isolated. Inputs include bounds ([-10^{308},10^{308}]), uniform endpoints, zero/negative/infinite scales, and extreme shape/rate values.
- #406 `src/random/extra.ts`: reviewed Laplace, inverse-gamma, Kumaraswamy, arcsine and related transformations, including reciprocal overflow, endpoints and random-uniform consumption. No new independent defect isolated. Inputs include scale=0/negative/Infinity, shape near 0 and Infinity, and uniforms adjacent to 0/1.
- Existing tests/fixtures inspected: `test/random.test.ts`, `test/random-kinds.test.ts`, `test/hyper.test.ts`, `test/gamma.test.ts`, `test/nbinom.test.ts`, `rhyper.json`, `rsample.json`, `rngLecuyer.json`, `rngStreams.json`, `rngRounding.json`, `rbinom.json`, `rgamma.json`, and `rnbinom.json`. Fixed-seed comparisons and stream-state fixtures were reviewed; Vitest/npm/R runtime was not executed in this batch.
- Issue #77 was closed as a false positive; do not count it as a defect. R source reference: https://github.com/wch/r-source/blob/trunk/src/nmath/rhyper.c
- Source blobs: `as241.ts` `3e7d42b5c0d867cc1bfe06f2f335d83994dbd7c3`; `beta.ts` `5371b478626066c291432ec2df4529953520f520`; `binomial.ts` `61b55752b90870ca08cb302b2a90fbfc2462979c`; `common.ts` `be016a36e9f09f580462d2bf93e30ed6bad527c1`; `continuous.ts` `5ad76e5676b4bf27c36b288f8e48ac3821bfd92a`; `extra.ts` `2e5d69e49dab41d9ae05164075051c7beb8e0dd5`; `gamma.ts` `76f1bbfcf99c0ead3efff7887131e7e142511f33`; `hyper.ts` `df63732522e39556a07f79edbb5a287f7348fa87`; `lecuyer.ts` `7bd112bb422a4e4b8dd2bbcf3badaa4da4efe4c3`; `mt.ts` `a27a644a591ab2286227aa5db1b05b16fa149300`; `poisson.ts` `9f6f9657e84c2110bb08640b1f846c345bd2ff2f`; `r2dtable.ts` `8ccc84fc49823aa54db9eb23da7d7b3df00033f0`; `rank.ts` `4cfe69d81a9a6509c9dbac95b3000a2adfb57433`; `rng.ts` `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `sample.ts` `b2a2a714b624fdd7f8e422e7a5210000a759d710`; `streams.ts` `63359251f6081a7658ebf27e105e6a0ed7c789cb`; `random.test.ts` `f849a51e7b3c89c639641cf0a231fc9989dcff81`; `random-kinds.test.ts` `7023ddbb5e24cab4f85e53fea68895be8dbe29a9`; `hyper.test.ts` `29b396ee4155cf89c8cd9e2c7ff34b700fdbba94`; `gamma.test.ts` `db75474bb21ad3531f9ae071cffa359023e1af37`; `rhyper.json` `39ca835db17abaf839fa97848fa7fbf4eeead82c`; `rsample.json` `5dd1a59eaf2f04f054f483f76b9902b15a896521`; `rngLecuyer.json` `c75def82ee749d6ba12196390f47596c610635bb`; `rngStreams.json` `1355f6e7efe30f8e1d01b6ba1843ff75b6c502ec`; `rngRounding.json` `9a28737c6d0b02116666c07a6f6bc151843da199`; `rbinom.json` `2284fd5c788e718a8f452d6f368a452e9130ceab`; `rgamma.json` `1b5220369e263d7d221cf885246f69490ba76d3a`; `rnbinom.json` `54800f87f309496ad567a7c0fb3039275a7acbfa`.
- Repository HEAD at audit: `22560dd4c055b790e0555007a108683df73768ec`.


## Audit #407-#412

- #407 `src/descriptive/basic.ts`: reviewed sum/prod/mean (including trim), weighted mean, variance/SD, median/range, cumulative sums/products/extrema and lagged differences; checked double-double/exponent accumulators, signed zero, NaN/Infinity, empty vectors and overflow/underflow transitions. No new independent defect isolated. Inputs include `sum([Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE])`, `prod([1e308,1e308,1e-308])`, `weightedMean([NaN,2],[0,1])`, `mean([1,2,3,4],{trim:0.5})`, `median([-Infinity,Infinity])`, and `diff([1,2,3],{lag:1e308})`.
- #408 `src/descriptive/moments.ts`: reviewed skewness/kurtosis types 1-3, central sums and power-of-two scaling, geometric mean, modes, mean absolute deviation, coefficient of variation and R-compatible column scaling. **Confirmed Issue #80**: `scale()` infers `ncol` from the first row but never checks subsequent row lengths, so longer rows are silently truncated and shorter rows feed `undefined` into calculations. Reproduction: `scale([[1,2],[3,4,5]])` and `scale([[1,2],[3]])`. GitHub Issue #80 opened.
- #409 `src/descriptive/quantile.ts`: reviewed Hyndman-Fan quantile types 1-9, endpoint clamping/fuzz, interpolation of equal and infinite neighbours, fivenum hinges, IQR and MAD low/high handling with missing values. No new independent defect isolated. Inputs include each type at p=0/0.5/1, probabilities adjacent to 0 and 1, equal infinities, `fivenum([-Infinity,Infinity])`, and MAD with even/odd counts and missing observations.
- #410 `src/descriptive/rank.ts`: reviewed all tie methods, random tie-breaking draw count/order, missing-value placement (first/last/keep), signed zero and infinite ties. No new independent defect isolated. Inputs include `rank([Infinity,Infinity,1])` for all tie methods, `rank([NaN,2,NaN,2],{naLast:"first"})`, and fixed-seed random ties.
- #411 `src/descriptive/missing.ts`: reviewed vectors and data-frame columns, null/NaN missing semantics, row-count consistency, complete-case intersection and typed-array preservation in `naOmit`. No new independent defect isolated. Inputs include empty vectors/data frames, mixed string/numeric columns, null and NaN, unequal column lengths, and Float64Array columns.
- #412 `src/descriptive/cov.ts`: reviewed Pearson double-double covariance/correlation, Kendall and Spearman methods, complete/na.or.complete/pairwise use modes, rank-before/after-pairwise filtering and dimension handling. **Confirmed Issue #78**: the final diagonal rewrite forces all self-correlations to 1 even when the column is constant (zero variance) or contains NaN under `use:"everything"`; both should yield NaN. Reproductions: `cor([[1,2],[1,3],[1,4]])` and `cor([[1,2],[NaN,3],[4,4]])`; expected `[[NaN,NaN],[NaN,1]]`. **Confirmed Issue #79**: `columns()` uses only the first row's length and silently accepts ragged matrices, truncating longer rows and passing undefined for shorter rows. Reproductions: `cov([[1,2],[3,4,5]])` and `cor([[1,2],[3]])`. GitHub Issue #78 opened; ragged-matrix report #79 was closed as a duplicate of existing #36.
- Existing tests/fixtures inspected: `test/descriptive.test.ts`, `test/rank.test.ts`, `cov.json`, `quantile.json`, `rank.json`, `rbasic.json`, `rrank.json`, and `scale.json`. Fixture contents were inspected for ordinary, tie, missing and edge-value cases. Vitest/npm/R runtime was not executed; reproductions above are source-derived candidates, not claimed runtime results.
- GitHub Issues: #78 — https://github.com/numero-uno-jpn/rStats.js/issues/78; #36 — https://github.com/numero-uno-jpn/rStats.js/issues/36 (canonical cov/cor ragged-matrix report); #38 — https://github.com/numero-uno-jpn/rStats.js/issues/38 (canonical scale ragged-matrix report)
- Source blobs: `basic.ts` `e12c8f8c91152f8d617cd05bf07ce512ef00856a`; `moments.ts` `67c81d40b0b0877dab5df9f6dcca71df01c23012`; `quantile.ts` `7fe14be52f404d0565fc5ec0cd4d953d155c2b6a`; `rank.ts` `316d4778675095a5b4eb9da60846c375ddad79cb`; `missing.ts` `6fdf726982969ccad9be0e38b892b3b6cf47582c`; `cov.ts` `9366b9c3fa7b01e198844711ea86dbe56a796fc0`; `descriptive.test.ts` `7d03139bf88440d444e4e7c8aa4217daff69592d`; `rank.test.ts` `78830d9e82aa9b6f50208143ddd261b0f0e7f943`; `cov.json` `b4252581c1cc39ea583621ed1bb028a78c7fe778`; `quantile.json` `b1996d5e5934c41f5c3ab4dcd56e9387edb40a53`; `rank.json` `d74cd9b691d856815c8f031463986dee4a2cdb87`; `rbasic.json` `fafabb128e79ef73b5c5c923a8b223f84ebe490e`; `rrank.json` `31fe6958bf457cfad61ee626440e0afc00f06dc4`; `scale.json` `bfde098a37a1263110406014db63d4958c7bbcbb`.
- Repository HEAD at audit: `1c2b00cfad06c067f1998c746367088f1844b6f3`.


## Audit #413-#418

- #413 `src/descriptive/dataFrames.ts`: reviewed frame construction, row/column extraction, row/column binding, subset semantics, key normalization, stable ordering, all.x/all.y joins, cross joins and duplicate-column checks. **Confirmed Issue #82**: single-key `merge()` uses raw JavaScript Map keys, so numeric `1` and character `"1"` do not match, unlike R `match()`, which coerces both vectors to a common type. Reproduction: `merge({id:[1],x:[10]},{id:["1"],y:[20]})`; expected a matched row. R reference: base `match` documentation states that atomic vectors are coerced to a common type before matching. GitHub Issue #82 opened.
- #414 `src/descriptive/factanal.ts`: reviewed covariance/correlation standardisation, uniqueness bounds, likelihood objective and gradient, L-BFGS-B parameterisation, degrees of freedom, loadings extraction, varimax/pro-max rotation and factor-score paths. No new independent defect isolated. Inputs include 3- and 4-variable positive-definite correlation matrices, one-factor/two-factor fits, near-singular matrices, lower-bound uniquenesses and custom starts. R's implementation was checked for covariance-matrix scaling semantics.
- #415 `src/descriptive/hist.ts`: reviewed Sturges/Scott/Freedman-Diaconis class counts, R-style pretty breaks, constant and extreme ranges, custom breaks, fuzz, right/left closure, includeLowest, densities and empty/nonfinite observations. **Confirmed Issue #81**: in the overflowing finite-span branch, `pretty()` computes each point as `L + i*step`; the product can overflow even when the final interpolated point is finite. Reproduction: `pretty([-1e308,1e308],{n:20})`; at i=18, `18*1e307` overflows although the correct point is (8\times10^{307}). GitHub Issue #81 opened; issue body was corrected to record the exact 20-interval construction.
- #416 `src/descriptive/omega.ts`: reviewed SMC pseudo-inverse, principal-factor loadings, minres objective/gradient, varimax and oblimin rotations, Schmid-Leiman transformation, group assignment, omegaH/omegaTot/omegaLim/alpha/G6/ECV and degenerate factor cases. **Confirmed Issue #83**: the analytic gradient supplied to L-BFGS-B is not the derivative of the off-diagonal residual sum-of-squares objective. Reproduction data (S=[[1,.5,.3],[.5,1,.4],[.3,.4,1]]), (psi=[.5,.5,.5]), q=1: central finite-difference gradient with step (10^{-6}) is approximately ([-0.01497745,0.02649663,-0.06830126]), while the source formula returns ([-0.05879072,0.00437314,-0.14000139]). The comparison was computed independently; the TypeScript runtime was not run. GitHub Issue #83 opened.
- #417 `src/descriptive/pivot.ts`: reviewed pivot_longer/wider id/name/value combinations, .value handling, names_sep/pattern capture, type promotion, missing-value dropping/fill, duplicate output names, names/column ordering and aggregation callbacks. No new independent defect isolated. Inputs include empty selections, multiple `.value` groups, missing names, regexes with 0/1/multiple captures, duplicate id/name combinations and mixed value types.
- #418 `src/descriptive/table.ts`: reviewed tabulate truncation and bounds, table levels/NA counting, unique NaN/-0 semantics, cut numeric/vector breaks, interval closure, findInterval duplicate break points, allInside and n=0/1 behavior. No new independent defect isolated. Inputs include empty vectors, all-NaN vectors, infinite endpoints, duplicate breakpoints, repeated vec values, rightmostClosed/leftOpen combinations and values exactly on each boundary.
- Existing tests/fixtures inspected: `test/dataFrames.test.ts`, `test/factanal.test.ts`, `test/omega.test.ts`, `test/pivot.test.ts`, `dataFrames.json`, `factanal.json`, `hist.json`, `omega.json`, `pivot.json`, `table.json`. Fixture and source review only; Vitest/npm/R runtime was not executed.
- GitHub Issues: #81 — https://github.com/numero-uno-jpn/rStats.js/issues/81; #82 — https://github.com/numero-uno-jpn/rStats.js/issues/82; #83 — https://github.com/numero-uno-jpn/rStats.js/issues/83
- R reference for #82: https://search.r-project.org/R/refmans/base/html/match.html
- Source blobs: `dataFrames.ts` `739034185d1cd747e57efbd5a6aeac026f9f9673`; `factanal.ts` `970ac621ef43828f2fae1440c891e5abd792cd0a`; `hist.ts` `36d38b059aaf8f56c8b400a7dd80bc5cd2b45aac`; `omega.ts` `99da1d19fa2e5d62f8ef8ef593cc6abc3294f527`; `pivot.ts` `63ae79e257a4d66e6750abdb906813489812f328`; `table.ts` `d6a292d4eb9f040528219f8202e2ad962cfc13e0`; `dataFrames.test.ts` `b90d2751b73caeb0dc933cbf645e2066d4227b43`; `factanal.test.ts` `4b98a9ca8a35f4d5bc90dfa23ae4f680742688fe`; `omega.test.ts` `33164d02c8bd6a27f29c06b8358ab60f909ed8fa`; `pivot.test.ts` `00295573929e0cff248b1e9d389a16a53cfb3681`; `dataFrames.json` `6492d7e35b7219084ec2bf69959a1a1f488e52ae`; `factanal.json` `37fd6e1b3fd7b5f86523a5737cc11068d8ba8f82`; `hist.json` `d3b99f477a5c2985147c1e90e4d335b39746bc23`; `omega.json` `0ff50c2b7d136ed59ca49dbf13ff8d2768a8c033`; `pivot.json` `a22c90cd1314aa6c265ce2b6f433f5d1cee34710`; `table.json` `b71e34907092bb39f2ebc91879d9303a6f2f1edd`.
- Repository HEAD at audit: `0d0ac9f6aedf302710c57f9f39db69a301eb32dc`.


## Audit #375-#379

- #375 `src/linalg/lu.ts`: reviewed partial-pivot selection and tie ordering, zero/subnormal pivots, rectangular factor dimensions, permutation convention (P L U = A), non-finite propagation, and the scaled PCA fallback in `prcomp`. Checked rank truncation and tolerance filtering, centering/scaling vectors, zero-variance columns, and reconstruction of scores/units after power-of-two rescaling. No new independent defect isolated. Inputs include `lu([[1,2],[3,4]])`, `lu([[0,1],[Number.MIN_VALUE,2]])`, `lu([[1,2,3],[4,5,6]])`, `prcomp([[1,2],[2,1],[3,4]], {rank:1})`, and data columns near (10^{308}) and (10^{-308}).
- #376 `src/linalg/solve.ts`: reviewed DGETRF/DGETRS pivot application, lower/upper triangular substitution, zero-coefficient skips, reciprocal condition estimation, power-of-two scaled condition checks, determinant sign/log/product accumulation, triangular rcond, rectangular QR rcond, and vector/matrix RHS shape preservation. No new independent defect isolated. Inputs include `solve([[2,1],[1,3]],[3,5])`, `solve([[1e-308,0],[0,2]],[1,2])`, `solve([[1,2],[2,4]],[3,6])`, `determinant([[1e308,0],[0,1e-308]],{logarithm:false})`, and `rcond([[1,2,3],[4,5,6]])`.
- #377 `src/linalg/qr.ts`: reviewed LINPACK-style limited pivoting, LAPACK-style column pivoting, norm downdates/recomputation, rank/tolerance decisions, Householder application order, Q/R/X reconstruction, response vector/matrix shapes, least-squares coefficients, and fitted/residual projection. **Confirmed Issue #71**: `qrSolve` applies a blanket `Number.isNaN(v) ? 0 : v` conversion to every coefficient returned by `qrCoef`. This is meant to zero unused coefficients of a wide matrix, but it also erases NaN values in genuinely used coefficients when the response contains NaN. Exact reproduction: `qrSolve([[1],[2],[3]],[NaN,2,3])`; the sole coefficient is used and should remain NaN, but the final conversion returns 0. The same corruption applies to matrix-response columns. GitHub Issue #71 opened. Other reviewed branches yielded no additional independent defect.
- #378 `src/linalg/svd.ts`: reviewed tall/wide transpose-and-swap handling, requested vector counts and output shapes, exact power-of-two scaling, bidiagonal Householder reduction, left/right reflector accumulation, Golub-Reinsch implicit QR shifts, split/cancellation paths, nonnegative singular values, convergence guard, and paired singular-vector permutations. No new independent defect isolated. Inputs include `svd([[3,0],[0,4]])`, tall and wide rank-deficient matrices, zero-row/zero-column shapes, `nu=0`/`nv=0`, and scales (10^{308}), (10^{-308}), and `Number.MIN_VALUE`.
- #379 `src/linalg/eigen.ts`: reviewed normalized symmetry detection, symmetric Householder tridiagonalisation and QL iteration, general balancing/Hessenberg reduction/double-shift QR, exceptional shifts and convergence guard, real/complex conjugate-pair representation, eigenvalue ordering, back-substitution, eigenvector phase normalization, and power-of-two restoration of eigenvalues. No new independent defect isolated. Inputs include symmetric and nonsymmetric 1×1/2×2 matrices, `[[0,-1],[1,0]]` (pure imaginary conjugate pair), zero matrices, matrices scaled near (10^{308}) and (10^{-308}), and near-symmetric pairs differing by one ulp.
- Existing tests inspected: `test/qr.test.ts`, `test/svd.test.ts`, `test/eigen.test.ts`, `test/solve.test.ts`, and `test/linalg-invariants.test.ts`. The invariant suite uses fixed seed `20261027` and checks QR/SVD/eigen reconstruction and orthogonality plus solve residuals. Vitest/npm runtime was not executed; reproductions above are source-derived candidates, not claimed runtime results.
- Source blobs: `lu.ts` `457aeee39e56df3f80e654c389a245807ccad55d`; `solve.ts` `6e423f1c2969b896c1715f5af95864c6f59dea24`; `qr.ts` `e19b546d8cee1a82e90e3b5f1f8cfee2e88717c5`; `svd.ts` `b2c4040c56db6cffd9b29f1ccf71106529b4aa46`; `eigen.ts` `86ee78a9fd9f3edbbc35e86f3805ea910e15ff18`; `qr.test.ts` `6119d120084b50c0e7884ec8f55dace89bf4994c`; `svd.test.ts` `cdec55566abe49d35ead92967097f3de7c2bba0e`; `eigen.test.ts` `5c4198e2efd364447d590a0a869b8cd6167e137e`; `solve.test.ts` `f7bb229445baee448b3f5cb75784474ab7140c87`; `linalg-invariants.test.ts` `a2feb9cef91f7426205f8b8f6c9ec422c65431ef`.
- GitHub Issue: #71 — https://github.com/numero-uno-jpn/rStats.js/issues/71
- Repository HEAD at audit: `a2bda0dbba56d43baa25aab26569c38efcb14a3b`.


## Audit #380-#386

- #380 `src/linalg/balance.ts`: reviewed dgebal permutation isolation, fixed-bound permutation passes, power-of-two row/column scaling, overflow/underflow guards, scaled Euclidean norms, and dgebak inverse permutation/scaling order. No new independent defect isolated in current public callers: `eigen` and `expm` reject non-finite matrices before calling the balancing routines. Inputs include matrices with isolated leading/trailing eigenvalues, zero rows/columns, highly unbalanced off-diagonal magnitudes, and finite entries near (10^{308})/(10^{-308}).
- #381 `src/linalg/schur.ts`: reviewed Hessenberg/Schur iteration reuse, 1×1 and 2×2 block detection, exact zeroing below the block diagonal, standardisation through `lanv2`, complex-pair ordering, eigenvalue recovery, orthogonal similarity updates, and extreme-scale restoration. No new independent defect isolated. Inputs include `[[0,-1],[1,0]]`, triangular and repeated-eigenvalue matrices, matrices with real and complex 2×2 blocks, and scales near (10^{308}) and (10^{-308}). Existing `test/schur.test.ts` checks orthogonality, reconstruction, block structure and eigenvalues against R.
- #382 `src/linalg/expm.ts`: reviewed all six methods, Padé degree thresholds, 1-norm overflow logarithm, scaling-and-squaring, balancing undo, Taylor/Padé Horner recurrences, conjugate-gradient-squared quotient, and overflow-safe squaring. **Confirmed duplicate of existing Issue #72**: `order` is validated with `Number.isInteger` but not `Number.isSafeInteger`; the polynomial loops decrement `j` by 1. At `order = 2 ** 54`, binary64 subtraction satisfies `j - 1 === j`, so the `Taylor`/ `Pade` (and `*O`) loops do not progress and the call hangs. Exact reproduction: `expm([[0,1],[0,0]], {method:"Taylor", order:2**54})`. GitHub Issue #84 opened. A practical upper bound is also advisable because safe-but-enormous orders are computationally infeasible.
- #383 `src/linalg/kappa.ts`: reviewed exact 2-norm singular-value ratio, exact alternate norms through inverse, direct rcond route, QR triangular estimate for tall/wide matrices, infinity-norm transpose convention, triangular estimator scaling, and Moore-Penrose inverse cutoff. No new independent defect isolated. Inputs include `kappa([[1,2],[3,4]])`, exact 2/1/I/F/M norms, direct and QR methods, wide matrices, singular matrices, and `ginv([[1,1],[1,1]])`.
- #384 `src/internal/ddexp.ts`: reviewed double-double exponentiation range reduction, subnormal fallback, standardisation with overflowing differences, division-tail rescaling, log-ratio, exponential tail helpers, log-sum/difference, affine location-scale reconstruction, and zero/infinite scale limits. No new independent issue promoted in this pass; the isolated `logAddExp(+Infinity,+Infinity)` edge is mathematically indeterminate in its current max-subtraction form and requires call-site/API impact analysis before issue creation. Inputs include `ddExp([709.78,0])`, `ddExp([-745,1e-16])`, `standardizeDD(1e308,-1e308,1e308)`, `expNeg([710,1e-15])`, `expNegOver([1200,0],Number.MIN_VALUE)`, `logAddExp(-Infinity,-Infinity)`, `logSubExp(0,-Infinity)`, and `locationScale(1e308,1e308,2)`.
- #385 `src/internal/fround.ts`: reviewed binary exponent extraction including subnormals, half-even ties, decimal power construction, positive/negative digits, large digits early returns, negative zero, NaN/Infinity, and matrix-wide zapsmall digit selection. No new independent defect isolated. Inputs include `roundR(2.5)`, `roundR(3.5)`, `roundR(-2.5)`, `roundR(Number.MIN_VALUE,323)`, `roundR(1.25,1)`, `roundR(125,-1)`, `roundR(1.2345,1e308)`, and `zapsmall([[1e200,1e-200]])`.
- #386 `src/internal/noncentral.ts`: reviewed signed-double key ordering and exact-double bisection, narrow-quantile bracketing, Gauss-Kronrod 7/15 nodes and weights, global bisection budget, stopping conditions, and negligible-noncentrality bound. No new independent public-path defect isolated in the reviewed functions. Inputs include `searchDoubles(1,0,2,x=>x>=1)`, negative and positive adjacent-double intervals, `narrowQuantile(1,2,x=>x>=1)`, and `negligibleNcp(1e-21,1)`. The midpoint formula in `kronrodAdaptive` can overflow for same-sign endpoints near the largest finite doubles, but the current noncentral call sites must be traced to determine whether such intervals are reachable before treating this as a public defect.
- Existing tests/fixtures inspected: `test/expm.test.ts`, `test/schur.test.ts`, `test/fixtures/expm.json`, `test/fixtures/schur.json`, `test/fixtures/kappa.json`, and `test/fixtures/rngRounding.json`. The expm fixture compares six methods with R 4.5.2; Schur tests reconstruction, orthogonality and block structure. Vitest/npm runtime/R were not executed; reproductions are source-derived candidates, not claimed runtime results.
- Source blobs: `balance.ts` `b0796b3365f4f23a7a02efdb05628380f85cf284`; `schur.ts` `72838c9df6896ef921d1ec296bd5b93d4624ec4f`; `expm.ts` `48da1a1d5e46371cff1404092bbb4d3d24551d26`; `kappa.ts` `098014dac2578986f16d98f5935d62cc2f73b7a1`; `ddexp.ts` `bee2ddfcd5de4228f56aad0b1647690c275e78c0`; `fround.ts` `8e42f6ab4bc1d61fcd7687129efdc57edc942224`; `noncentral.ts` `0a7c75dcdcc9bcf9a4b3bbd75ed613e5c6046ad7`; `expm.test.ts` `5b674c5be09bf09dc519d62cb9c2e5bcac68ec76`; `schur.test.ts` `196e4e2284af726d85bad5f83126da7a0951b2df`; `expm.json` `c78032fc9633b22bc9390beb2ae9861921ef0381`; `schur.json` `13401cd1a80e28d6936d1eb63837bee133043bd2`; `kappa.json` `2a52afe6cea3cc9f2571ee87da67d51f6a1c4297`; `rngRounding.json` `9a28737c6d0b02116666c07a6f6bc151843da199`.
- Canonical GitHub Issue: #72 — https://github.com/numero-uno-jpn/rStats.js/issues/72 (new duplicate #84 closed)
- Repository HEAD at audit: `f37c3ac0c398dc2af92dbc7089ffe593f4d40fc1`.


## Audit #387-#394

- #387 `src/integrate/quadpack.ts`: reviewed the 21-point finite Gauss-Kronrod and 15-point infinite-range rules, resabs/resasc error scaling, Wynn epsilon extrapolation table, descending error-interval ordering, adaptive subdivision and stopping codes. **Confirmed duplicate of existing Issue #51**: `dqk21` computes `centr = 0.5 * (a + b)`, and adaptive subdivision uses the same midpoint formula. With large same-sign finite bounds, `a+b` overflows even though the interval width is finite. Exact public reproduction: `integrate(x => 1e308 / x, 1e308, 1.1e308)`. The quadrature samples Infinity, obtains zero-valued integrand evaluations and can return zero with zero estimated error; expected integral is (10^{308}\log(1.1)\approx9.53101798043249\times10^{306}). Issue #85 opened.
- #388 `src/numerics/integrate.ts`: reviewed finite/infinite interval dispatch, sign reversal, full-line integration, scaling when endpoint difference overflows, tolerance/subdivision validation, stopOnError behavior, Brent optimization wrapper and uniroot interval extension/termination. The finite-width overflow case is already handled by halving the interval, but same-sign midpoint-sum overflow was missed in the QUADPACK core and is tracked in #85. No additional independent issue isolated. Inputs include `integrate(x=>Math.exp(-x*x/2),-Infinity,Infinity)`, reversed and equal infinite endpoints, `optimize((x)=>(x/1e308-1.05)**2,1e308,1.1e308)`, and `uniroot(x=>x*x-2,0,2,{tol:1e-12})`.
- #389 `src/numerics/deriv.ts`: reviewed simple forward differences, Richardson central differences and extrapolation, step selection near zero, negative steps, Hessian diagonal and mixed partial construction, and vector-output Jacobian handling. No new independent reproducible defect isolated. Inputs include `grad(x=>x[0]**2,[0])`, `jacobian(x=>[x[0]*x[1],x[0]+2*x[1]],[2,3])`, `hessian(x=>x[0]**2*x[1]**2,[1,2])), negative `eps`, and r at 1 and 2.
- #390 `src/numerics/interp.ts`: reviewed NaN-pair dropping, stable x sorting, ties aggregation, approx interval/extrapolation rules, overflow-safe linear interpolation, FMM/natural/periodic/Hyman spline coefficients, monotone Hermite slopes, periodic wrapping, derivatives, barycentric weight rescaling and global Hermite divided differences. No new independent defect isolated. Inputs include duplicate x with mean/min/max ties, x values around (pm10^{308}), constant/monotone data, periodic endpoint mismatch, exact knots, repeated interpolation nodes, and query points at and outside the domain. The documented third-derivative difference for Hermite splines is already explicitly tested and described; not a new defect.
- #391 `src/numerics/ode.ts`: reviewed Euler, Heun/RK2 and classical RK4 stage times, state updates, parameter copying, derivative-vector length checks, empty/singleton time arrays, and forward/backward/zero steps. No new independent defect isolated. Inputs include (y'=-0.7y) with times `[0,0.5,1]`, decreasing times, repeated times, zero-dimensional state and a derivative callback returning the wrong length.
- #392 `src/optim/optim.ts`: reviewed parameter/objective scaling, numerical gradients with bound clipping, recycled controls, Nelder-Mead/BFGS/CG/SANN/Brent/L-BFGS-B dispatch, convergence and evaluation accounting, finite-value errors, and Hessian-at-solution path. No new independent defect isolated in this pass. Inputs include scaled Rosenbrock, one-dimensional and empty parameter vectors, mismatched recycled controls, finite-difference steps at bounds, and each supported method.
- #393 `src/optim/localmin.ts`: reviewed Brent's golden-section/parabolic step acceptance, bracket updates, tolerance and adjacent-double stopping. The previously reported non-finite objective handling / non-progress issue is already tracked as Issue #61; no duplicate issue was opened. Inputs include `localMin(x=> (x-1/3)**2,0,1)`, flat quartic, endpoint minimum, and an objective returning NaN at an interior trial.
- #394 `src/optim/lbfgsb.ts`: reviewed the 1-based workspace layout, bound projection and active-set transitions, compact limited-memory matrices, Cholesky/triangular solves, line-search state transitions, stopping criteria, callback evaluation counts, and invalid-bound handling. No new independent reproducible defect isolated. Inputs include bounded Rosenbrock, fixed variables, lower-only/upper-only/two-sided bounds, zero-length input, and line-search abnormal termination cases.
- Existing tests/fixtures inspected: `test/integrate/quadpack.test.ts`, `test/numerics.test.ts`, `test/optim/localmin.test.ts`, `test/optim.test.ts`, `test/fixtures/integrate.json`, `test/fixtures/ode.json`, and `test/fixtures/optim.json`. QUADPACK fixtures compare against SciPy; numerical-method fixtures compare against R; localmin has a separate reference suite. Vitest/npm runtime/R were not executed; the reproductions above are source-derived candidates, not claimed runtime results.
- Source blobs: `quadpack.ts` `3aef9054b78a50c5ab55ed22008db69c56535d4c`; `integrate.ts` `ebafffb5a5862eea43c4b32e4456eed02ba51227`; `deriv.ts` `7a339332c11e4b55e6f35fb8f120c7fd2c92311d`; `interp.ts` `d9c76b9bb91a45caf0b04da7d56d9627bd711f57`; `ode.ts` `6d0a98f2caf7cd2e74f232c2c19fd9191397428e`; `optim.ts` `3bacfc992f3c178642b03380ccd8c7aca4bc6c1d`; `localmin.ts` `3dfa016606ccc35da6f69bff24dcc1eb2232e264`; `lbfgsb.ts` `fd14e53c5730a4162316a5cafe67d29526530b37`; `quadpack.test.ts` `3f37685e28b6db47c8b940ba25a03b47bcbf2bbf`; `numerics.test.ts` `adf6305a82952caee7673c4237d5c24322d750a7`; `localmin.test.ts` `de3420983b0afd25fb1a8cf0fc019e4cdc2b8ef8`; `optim.test.ts` `4cdb89236c87abbece16a06fe17e04e4b780d532`; `integrate.json` `606121207119a70620ea105b67c267f907168afd`; `ode.json` `6070594bb9e69eb5427d7ffe63c42cd99e6cbf70`; `optim.json` `56cc21548932289321239c61c92af3a3ad408476`.
- Canonical GitHub Issue: #51 — https://github.com/numero-uno-jpn/rStats.js/issues/51 (new duplicate #85 closed; related duplicate #75)
- Repository HEAD at audit: `4171bb275943e092d90bf86a0b498ae1a4196600`.


## Audit #395-#410

- #395 `src/random/rng.ts`: reviewed RNG kind switching and seeding, sample-kind state, .Random.seed save/restore, kind-code validation, rejection-bit construction, uniform-index boundaries, inversion-normal and Ahrens-Dieter exponential draws. No new independent defect isolated. Inputs include `setSeed(-7)`, `setSeed(2147483647)`, `setRandomSeed([10403,624,...626 state words])`, `unifIndex(2 ** 52)`, and state switches between MT and L'Ecuyer.
- #396 `src/random/mt.ts`: reviewed R-compatible 50-step seed scrambling, MT19937 twist and tempering, 0/1 uniform fixup, .Random.seed word conversion and restoration index. No new independent defect isolated. Inputs include seeds 1, 42, -7, the all-zero state, and mti values 0, 624 and 625.
- #397 `src/random/lecuyer.ts`: checked MRG32k3a recurrence constants, exactness of intermediate products below (2^{53}), modulo correction, normalization, and state validation. No new independent defect isolated. Inputs include seed 1, first-component and second-component boundary states, all-zero first triplet, and words at (M_1-1)/(M_2-1).
- #398 `src/random/streams.ts`: reviewed 2^76/2^127 jump matrices, 16-bit split modular multiplication, matrix-vector accumulation and RNG-kind code preservation. No new independent defect isolated. Inputs include the seed-1 L'Ecuyer state, next stream, next substream, and invalid MT-kind state.
- #399 `src/random/sample.ts`: reviewed sample size/population validation, R's rejection and rounding index methods, without-replacement swap removal, weighted probability normalization including overflowed sums, heapsort tie order, cumulative selection and Walker alias construction. No new independent defect isolated. Inputs include n=0/1, n=2^52, size>n, probabilities [Number.MIN_VALUE, 1e308, 1e308], all-zero weights, and >200 candidates with replacement.
- #400 `src/random/common.ts`: reviewed finite/truncated sample-count allocation and integer-power recurrence. `powInt` uses bitwise shifts, but its only production caller is the binomial inversion path, whose trial count is strictly below INT_MAX; no public-path defect from the 32-bit exponent conversion was isolated. Inputs include `generate(2.9,()=>1)`, `generate(0,()=>1)`, `powInt(0.5,10)`, and `powInt(2,-3)`.
- #401 `src/random/continuous.ts`: reviewed uniform interval overflow fallback, normal location/scale, exponential reciprocal-rate overflow, lognormal, logistic, Cauchy and Weibull parameter endpoints and uniform-consumption rules. No new independent defect isolated. Inputs include `runif(3,{min:-1e308,max:1e308})`, `rnorm(2,{mean:Infinity,sd:0})`, `rexp(2,{rate:Number.MIN_VALUE})`, zero/negative scales, and infinite locations.
- #402 `src/random/extra.ts`: reviewed inverse-gamma, Kumaraswamy, Pareto, triangular, Laplace and arcsine generators, including support endpoints and wide-interval scaling. No new independent defect isolated. Inputs include `rtriang(3,{a:-1e308,b:1e308,c:0})`, zero/invalid scales, and parameters near subnormal limits.
- #403 `src/random/poisson.ts`: reviewed Ahrens-Dieter Case B inversion table caching, Case A normal/rejection constants, squeeze/hat acceptance, large-rate arithmetic, geometric inversion and gamma-Poisson negative-binomial mixtures. No new independent defect isolated. Inputs include `rpois(5,0)`, rates just below/at 10, `rpois(2,1e308)`, `rgeom(2,1e-309)`, and negative-binomial `size=Infinity).
- #404 `src/random/binomial.ts`: reviewed BINV recurrence and table reuse, BTPE region construction and rejection tests, Stirling log-ratio, extreme probabilities, large-n quantile fallback and multinomial conditional decomposition. The known BTPE stream difference caused by R's opposite-sign Stirling corrections is already documented in code/tests; no additional independent defect isolated. Inputs include `rbinom(5,10,0.5)`, mean around 30, p near 0/1, n=INT_MAX and multinomial weights [0.5,0.5,1e-16].
- #405 `src/random/gamma.ts`: reviewed Ahrens-Dieter GS/GD acceptance paths, shape/scale limits, cached parameter constants, chi-square/t/F generators and noncentral chi-square Poisson mixture. No new independent defect isolated. Inputs include shapes below/at/above 1, 3.686, 13.022, infinite shape/scale, zero df, and very large finite shape.
- #406 `src/random/beta.ts`: reviewed Cheng BC/BB acceptance regions, extreme shape ratios, overflow-capped exponentials, noncentral beta gamma-mixture branches and overflow-safe ratio reconstruction. No new independent defect isolated. Inputs include (0,0), (0,Infinity), (1e308,1e308), very small shapes, and noncentral shapes whose doubled values overflow.
- #407 `src/random/hyper.ts`: reviewed hypergeometric support bounds, HIN recurrence, H2PE proposal regions and squeeze/Stirling acceptance, swapped colour/sample complements, and large-parameter quantile fallback. **Confirmed Issue #86**: the large-parameter fallback runs before deterministic-support detection; for `rhyper(1,0,3000000000,2)` or `rhyper(1,3000000000,0,2)`, `qhyper1(unifRand(),...)` consumes a uniform although the result is fixed. The ordinary branch avoids a draw when `minjx===maxjx`. This breaks reproducible stream alignment. GitHub Issue #86 opened.
- #408 `src/random/r2dtable.ts`: reviewed margin truncation/range checks, grand-total cap, log-factorial table, conditional hypergeometric mode and probability recurrence, exhausted-block handling, and exact margin reconstruction. No new independent defect isolated. Inputs include 2×2 and 3×3 tables, zero margins, all-zero margins, grand total at INT_MAX boundary, and mismatched sums.
- #409 `src/random/rank.ts`: reviewed signed-rank Bernoulli signs, half-even parameter conversion, rank-sum partial Fisher-Yates sampling, empty-sample limits and Int32 allocation bound. No new independent defect isolated. Inputs include `rsignrank(5,10)`, half-integer n, zero sample sizes, and m+n near INT_MAX.
- #410 `src/random/as241.ts`: checked Wichura AS 241 polynomial coefficient ordering, central/tail split at |q|=0.425, secondary split at r=5, and sign reflection. No new independent defect isolated for the actual uniform input range, which is strictly inside (0,1) and bounded away from 0/1 by the two-uniform generator. Inputs include values near 0.075, 0.5, 0.925 and the attainable endpoints of normRand's combined uniform.
- Existing tests/fixtures inspected: `test/random.test.ts`, `test/random-kinds.test.ts`, `test/hyper.test.ts`, `test/gamma.test.ts`, `test/fixtures/r2dtable.json`, `test/fixtures/rhyper.json`, and `test/fixtures/rsample.json`. Random fixtures use R 4.5.2 and verify generated values plus the next uniform/state; the RNG-kind tests recompute the L'Ecuyer jump matrices using BigInt. Vitest/npm/R were not executed; the listed reproductions are source-derived candidates, not claimed runtime results.
- Source blobs: `rng.ts` `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `mt.ts` `a27a644a591ab2286227aa5db1b05b16fa149300`; `lecuyer.ts` `7bd112bb422a4e4b8dd2bbcf3badaa4da4efe4c3`; `streams.ts` `63359251f6081a7658ebf27e105e6a0ed7c789cb`; `sample.ts` `b2a2a714b624fdd7f8e422e7a5210000a759d710`; `common.ts` `be016a36e9f09f580462d2bf93e30ed6bad527c1`; `continuous.ts` `5ad76e5676b4bf27c36b288f8e48ac3821bfd92a`; `extra.ts` `2e5d69e49dab41d9ae05164075051c7beb8e0dd5`; `poisson.ts` `9f6f9657e84c2110bb08640b1f846c345bd2ff2f`; `binomial.ts` `61b55752b90870ca08cb302b2a90fbfc2462979c`; `gamma.ts` `76f1bbfcf99c0ead3efff7887131e7e142511f33`; `beta.ts` `5371b478626066c291432ec2df4529953520f520`; `hyper.ts` `df63732522e39556a07f79edbb5a287f7348fa87`; `r2dtable.ts` `8ccc84fc49823aa54db9eb23da7d7b3df00033f0`; `rank.ts` `4cfe69d81a9a6509c9dbac95b3000a2adfb57433`; `as241.ts` `3e7d42b5c0d867cc1bfe06f2f335d83994dbd7c3`; `random.test.ts` `f849a51e7b3c89c639641cf0a231fc9989dcff81`; `random-kinds.test.ts` `7023ddbb5e24cab4f85e53fea68895be8dbe29a9`; `hyper.test.ts` `29b396ee4155cf89c8cd9e2c7ff34b700fdbba94`; `gamma.test.ts` `db75474bb21ad3531f9ae071cffa359023e1af37`; `r2dtable.json` `c12c8b89aebf9ef0c3839070980dfbb6e49ce22e`; `rhyper.json` `39ca835db17abaf839fa97848fa7fbf4eeead82c`; `rsample.json` `5dd1a59eaf2f04f054f483f76b9902b15a896521`.
- GitHub Issue: #86 — https://github.com/numero-uno-jpn/rStats.js/issues/86
- Repository HEAD at audit: `970202766ff9a2f7b8027409e7209e24a543ebdf`.


## Audit #411-#423

- #411 `src/data/grouping.ts`: reviewed single/multiple grouping-factor parsing, mixed-type rejection, 15-digit numeric levels, missing-label codes, column-major cross-classification, empty cells, drop behavior, formula expansion and aggregate result naming. No new independent defect isolated. Inputs include labels `[2,1,2,null,NaN]`, crossed factors `["b","a","b"]` × `[2,1,1]`, zero-row data and groups with empty cross-cells.
- #412 `src/descriptive/basic.ts`: reviewed NaN propagation/removal, double-double sum/product, weighted mean with zero/negative/overflowing weights, trimmed mean, variance/SD, median, range, cumulative operations and lagged differences. No new independent defect isolated. Inputs include `sum([1e308,1e308])`, `prod([1e308,1e-308])`, `weightedMean([NaN,2],[0,1])`, `weightedMean([1e308,1e308],[1e308,1e308])`, empty vectors, infinities and negative weights.
- #413 `src/descriptive/cov.ts`: reviewed matrix/vector interpretation, Pearson double-double covariance, Spearman ranks, Kendall tau-b and covariance, complete/pairwise missing-data masks, one-observation cases, method abbreviations and correlation diagonal handling. No new independent defect isolated. Inputs include a constant column, one-row/zero-column matrices, pairwise missingness with Spearman, and methods/use abbreviations.
- #414 `src/descriptive/dataFrames.ts`: reviewed row-count consistency, missing-value gathering, Float64Array preservation, safe own-property column names (including `__proto__`), merge key matching/suffixes/order, subset selection, row/column binding type coercion, and fromRows/toRows round trips. No new independent defect isolated. Inputs include duplicate join keys, missing join keys, cartesian joins, zero-row frames, mixed logical/numeric/text columns, and a column named `__proto__`.
- #415 `src/descriptive/factanal.ts`: reviewed covariance input checks, factor-count bounds, uniqueness objective and bounds, L-BFGS-B convergence reporting, eigenvalue/loadings construction, varimax and promax rotations, score methods and likelihood test degrees of freedom. No new independent defect isolated. Inputs include 3-variable one-factor covariance matrix `[[1,.72,.63],[.72,1,.56],[.63,.56,1]]`, one-factor and multi-factor data, Heywood boundary uniquenesses and scores regression/Bartlett.
- #416 `src/descriptive/hist.ts`: reviewed Sturges/Scott/FD class counts, 5-significant-digit rounding for FD, pretty breaks, custom-break validation, boundary fuzz and right/left-closed cell lookup, density and midpoint calculation, and ECDF sorting/search. No new independent defect isolated. Inputs include empty/all-nonfinite data, constant data, exact breakpoints with both `right` values, custom breaks not spanning the data, and finite data near (pm10^{308}).
- #417 `src/descriptive/missing.ts`: reviewed vector/data-frame discrimination, NaN/null/undefined missingness, complete-case length agreement, Float64Array-preserving omission, and empty data-frame behavior. No new independent defect isolated. Inputs include `completeCases([1,NaN],[2,3])`, zero columns, zero rows, and numeric/string columns with NaN/null.
- #418 `src/descriptive/moments.ts`: reviewed central moment scaling, double-double centering, skewness/kurtosis types 1–3, geometric mean sign/zero rules, modes/ties, mean absolute deviation, coefficient-of-variation correction, and scale() center/RMS branches including overflowing deviations. No new independent defect isolated. Inputs include constant and singleton vectors, negative/zero geometric-mean values, large-offset tiny-spread columns, and values near (10^{308})/(10^{-308}).
- #419 `src/descriptive/omega.ts`: reviewed correlation matrix construction, minres uniqueness optimisation, principal loadings, varimax/oblimin rotation, Schmid-Leiman transformation, factor sign flips, omegaH/omegaTot/G6 and warning/message branches. No new independent defect isolated. Inputs include one-, two- and three-factor correlation matrices, singular/near-singular matrices, and items with negative general loadings.
- #420 `src/descriptive/pivot.ts`: reviewed pivot_longer selection and name parsing (prefix/separator/capture groups), `.value` expansion, name transforms, value type coercion, missing-row dropping and warnings; pivot_wider id/name combinations, name sorting/varying, duplicate-cell detection, valuesFn/fill and Float64Array preservation. No new independent defect isolated. Inputs include names with unmatched regex groups, multiple namesFrom/value columns, missing keys, duplicate cells, and name collisions.
- #421 `src/descriptive/quantile.ts`: reviewed Hyndman-Fan types 1–9, relative position fuzz, endpoint clamping, interpolation of opposite-sign/large finite values, equal infinities, empty and missing data, IQR/fivenum/MAD. No new independent defect isolated. Inputs include `quantile([1,2,3,4,5,6],0.25,{type:9})`, p at 0/1, p adjacent to 0/1, duplicate and infinite order statistics, and ([-10^{308},10^{308}]).
- #422 `src/descriptive/rank.ts`: reviewed average/first/last/random/max/min tie handling, NaN placement, infinities, stable ordering and random-stream consumption. No new independent defect isolated. Inputs include `rank([Infinity,1,Infinity,NaN],{tiesMethod:"average"})`, all-tied vectors, and missing values under first/last/keep.
- #423 `src/descriptive/table.ts`: reviewed tabulate truncation/range checks, factor-like table levels and NA counts, unique's NaN/-0 semantics, cut's generated/custom breaks and closure options, and findInterval's rightmostClosed/allInside/leftOpen search. No new independent defect isolated. Inputs include `tabulate([1,2,2,5],3)`, `table([3,NaN,1,3],{useNA:"always"})`, `unique([-0,0,NaN,NaN])`, cut at exact endpoints, and unsorted/duplicate breaks.
- Existing tests/fixtures inspected: `test/dataFrames.test.ts`, `test/descriptive.test.ts`, `test/factanal.test.ts`, `test/grouping.test.ts`, `test/omega.test.ts`, `test/pivot.test.ts`, `test/rank.test.ts`, `test/fixtures/hist.json`, and `test/fixtures/quantile.json`. Fixtures compare with R 4.5.2 and, for pivot operations, tidyr; factor-analysis and omega suites check numerical agreement. Vitest/npm/R were not executed; listed inputs are source-derived review cases, not claimed runtime results. No issue was opened.
- Source blobs: `grouping.ts` `9bfc9a90424acc9766c599026273a2902e50dfe8`; `basic.ts` `e12c8f8c91152f8d617cd05bf07ce512ef00856a`; `cov.ts` `9366b9c3fa7b01e198844711ea86dbe56a796fc0`; `dataFrames.ts` `739034185d1cd747e57efbd5a6aeac026f9f9673`; `factanal.ts` `970ac621ef43828f2fae1440c891e5abd792cd0a`; `hist.ts` `36d38b059aaf8f56c8b400a7dd80bc5cd2b45aac`; `missing.ts` `6fdf726982969ccad9be0e38b892b3b6cf47582c`; `moments.ts` `67c81d40b0b0877dab5df9f6dcca71df01c23012`; `omega.ts` `99da1d19fa2e5d62f8ef8ef593cc6abc3294f527`; `pivot.ts` `63ae79e257a4d66e6750abdb906813489812f328`; `quantile.ts` `7fe14be52f404d0565fc5ec0cd4d953d155c2b6a`; `rank.ts` `316d4778675095a5b4eb9da60846c375ddad79cb`; `table.ts` `d6a292d4eb9f040528219f8202e2ad962cfc13e0`; `dataFrames.test.ts` `b90d2751b73caeb0dc933cbf645e2066d4227b43`; `descriptive.test.ts` `7d03139bf88440d444e4e7c8aa4217daff69592d`; `factanal.test.ts` `4b98a9ca8a35f4d5bc90dfa23ae4f680742688fe`; `grouping.test.ts` `e4d9f65aef100b10275d787e7ccba8073f44126d`; `omega.test.ts` `33164d02c8bd6a27f29c06b8358ab60f909ed8fa`; `pivot.test.ts` `00295573929e0cff248b1e9d389a16a53cfb3681`; `rank.test.ts` `78830d9e82aa9b6f50208143ddd261b0f0e7f943`; `hist.json` `d3b99f477a5c2985147c1e90e4d335b39746bc23`; `quantile.json` `b1996d5e5934c41f5c3ab4dcd56e9387edb40a53`.
- Repository HEAD at audit: `72ce893f9fea76be5e58191565385d03b347f3ce`.


## Audit #424-#433

- #424 `src/models/formula.ts`: reviewed tokenization, unary/binary precedence, right-associative powers, Error/random-effect term splitting, variable collection, dot expansion, intercept toggling, interaction/nesting operators, stable degree ordering, factor coding and response-term removal. No new independent defect isolated. Inputs include `y ~ -1 + a*b`, `y ~ a/(b+c)`, `y ~ (a+b)^2`, `y ~ a:b:c`, `y ~ a + Error(id) - 1`, and nested parentheses/unary signs.
- #425 `src/models/modelFrame.ts`: reviewed equal-length validation, variable lookup, numeric/factor/logical conversion, explicit level ordering, unused-level dropping, missing rows and weight omission, and negative-weight rejection. No new independent defect isolated. Inputs include explicit levels with absent labels, unused factor levels after NA omission, boolean columns with only one observed value, NaN/null weights, zero weights, and infinite/negative weights.
- #426 `src/models/modelMatrix.ts`: reviewed treatment/sum/Helmert/polynomial contrasts, no-intercept indicator coding, interaction column order, terms attributes, contrast warnings/errors, response extraction and zero-row matrices. No new independent defect isolated. Inputs include `y ~ A*B`, `y ~ A + x - 1`, factors with explicit unused levels, two-factor interactions and `contr.poly` with 2/3/5 levels.
- #427 `src/models/ddMatrix.ts`: reviewed double-double matrix multiplication, transpose, column scaling, triangular solves and covariance reconstruction, including empty and rectangular dimensions. No new independent defect isolated. Inputs include 1×1, 0×n, n×0, rectangular products, and entries near (10^{308})/(10^{-308}).
- #428 `src/models/ddLeastSquares.ts`: reviewed double-double Householder/orthogonal transformations, pivot-selected column ordering, coefficient back-substitution, Q'y and residual reconstruction, and rank-zero/rank-deficient paths. No new independent defect isolated. Inputs include duplicate columns, exact linear dependence, one observation, zero columns and nearly collinear columns.
- #429 `src/models/lm.ts`: reviewed vector/matrix input interpretation, missing/zero/negative weights, response and predictor scaling, weighted QR pivoting, aliased coefficients, double-double precise fit, RSS/MSS/df, standard errors, t/F statistics, formula fit and ANOVA attachment. No new independent defect isolated. Inputs include intercept/no-intercept fits, rank-deficient design, all-zero weights, very large/small response and weights, and one-observation/saturated models.
- #430 `src/models/glmFamily.ts`: reviewed family/link matching and abbreviations, variance and derivative functions, link/link-inverse limits, initialization, deviance contributions, AIC, quasi families and warning deduplication. No new independent defect isolated. Inputs include binomial grouped responses, Poisson zero means, Gamma/inverse-Gaussian domain edges, power links near zero, and quasi variance powers.
- #431 `src/models/glm.ts`: reviewed response/weights/offset validation, binomial two-column response conversion, starting values, scaled Gaussian identity fits, IRLS working weights/responses, QR rank and aliases, step halving, convergence/boundary state, null deviance/AIC, refits, summaries, residuals, hat values, Cook's distance and predictions/non-estimable rows. No new independent reproducible defect isolated. Inputs include complete and separated binomial data, zero prior weights, offsets, Gaussian responses near (10^{308}), and predictions with aliased columns.
- #432 `src/models/glmAnova.ts`: reviewed sequential term refits, nested-model checks, deviance differences, Rao score statistics, dispersion selection, Chisq/LRT/F/Cp columns, family/link matching and response-scale restoration. No new independent defect isolated. Inputs include intercept-only versus one-predictor fits, nonnested models, quasi and fixed-dispersion families, and fits sharing a scaled Gaussian response.
- #433 `src/models/glmConfint.ts`: reviewed profile restriction through offsets, LRT/Rao signed-root statistics, convergence-to-coefficient-change criteria, bracket expansion up to (2^{30}) standard errors, aliased parameter handling, level/test/parm validation and scale restoration. No new independent defect isolated. Inputs include a regular binomial fit, aliased coefficients, a profile that never reaches the target, extreme confidence levels and nonconvergent restricted fits.
- Existing tests inspected: `test/formulaTests.test.ts`, `test/modelMatrix.test.ts`, `test/lm.test.ts`, `test/glm.test.ts`, `test/glmAnova.test.ts`, and `test/glmConfint.test.ts`. The fixtures are generated against R and cover model terms, contrasts, weighted fits, family/link combinations, GLM convergence, analysis of deviance and profile confidence intervals. Vitest/npm/R were not executed; listed inputs are source-derived review cases, not claimed runtime results. No issue was opened.
- Source blobs: `formula.ts` `2dff14125553b5a7a41fb58339faaf03588cd2ed`; `modelFrame.ts` `fbd2388c426fcb60d770b5790ee28d11857a8548`; `modelMatrix.ts` `9dbfb1a56cb3c730f9d59d5e0dc91da1ea14d0a8`; `ddMatrix.ts` `58a467279e72cfa863aadfcb4a23e2e5f5130bcc`; `ddLeastSquares.ts` `fc016e33c6cedbffc9b079f7bde8a28d08cb5eb2`; `lm.ts` `95e161942a868624c1606925bfe00a1725ccc9f0`; `glmFamily.ts` `c6d8d8b8c47dda7ed96bef3043d90abb7c637bb5`; `glm.ts` `852ea8204a73cfc10a2807017f7a4f116e71f331`; `glmAnova.ts` `f84fe8f7b86b86c5a696da60157dc8b15c3caf22`; `glmConfint.ts` `fc79e536f9b642a2ae860c813f0fcf45ebbdca14`; `formulaTests.test.ts` `169117e6e449b8a9a7bade1d318bc30ab8f2dc57`; `modelMatrix.test.ts` `da8602c2bb9a4d94c3000be900af9b30e493d646`; `lm.test.ts` `4350af21ca60228b59abcbf593b974a1dfa0c4b3`; `glm.test.ts` `63aaa9ade1f6d9239ccf4c8f625978db208385fa`; `glmAnova.test.ts` `8e0787c897b4a408549128689511c35d888b1d7e`; `glmConfint.test.ts` `44a371b512327f6e43353aa0f084bdc11c192069`.
- Repository HEAD at audit: `362f666da8c454a14d381d95cdcf931d3b898f1d`.


## Audit #434-#440

- #434 `src/models/anovaSequential.ts`: reviewed response rescaling, sequential sums of squares from pivoted QR effects, term assignment/order, weighted residual sums of squares, perfect-fit warning, nested-model comparison and scaled effect-size side data. No new independent defect isolated. Inputs include balanced/unbalanced factor designs, aliased terms, zero-weight rows, saturated fits and responses near (10^{308})/(10^{-308}).
- #435 `src/models/aovEz.ts`: reviewed long-to-wide subject aggregation, between/within factor levels and ordering, cell averaging/missing-cell warnings, within-term contrast bases, type II/III hypothesis spaces, SSP trace calculations, Greenhouse-Geisser/Huynh-Feldt corrections, Mauchly tests and generalized/partial eta squared. No new independent defect isolated. Inputs include 2×2 and 2×3 within designs, unbalanced between groups, duplicate subject-cell observations, missing cells, singular SSP and no within-subject factors.
- #436 `src/models/aovStrata.ts`: reviewed Error() term expansion, Helmert-coded error model, orthogonal stratum projections, treatment-column relevance threshold, within residual stratum, aliased terms, weighted response scaling and per-stratum table construction. No new independent defect isolated. Inputs include one-/two-factor repeated measures, singular Error() structures, covariates varying within and between subjects, and zero residual df.
- #437 `src/models/carAnova.ts`: reviewed type II marginality (dropping containing terms), type III contrast-dependent hypotheses, QR rank/pivoting, weighted double-double added sums of squares, intercept row, aliased coefficients and residual-df/perfect-fit errors. No new independent defect isolated. Inputs include `y ~ A*B` under treatment and sum contrasts, aliased interactions, no-intercept models, and type II/III with an intercept-only model.
- #438 `src/models/coxph.ts`: reviewed Efron/Breslow tied-death accumulation, integer case-weight handling, risk sets by stratum, time merging, covariate centring/scaling, Newton steps and halving, generalized Cholesky, aliased coefficients, infinite-coefficient warnings, variance and global tests. **Confirmed Issue #87**: the weighted mean and absolute-deviation sum used to centre/scale a covariate are accumulated without rescaling. Exact reproduction: `coxph([1,2,3],[1,0,1],[[1e308],[-1e308],[0]])`. The weighted mean is 0, but the absolute-deviation sum is (2\times10^{308}=\infty), so the scale factor is 0 and the finite varying covariate is erased. A same-sign large covariate can also overflow the mean sum. GitHub Issue #87 opened. The public survival documentation states that coxph internally centres/scales covariates to avoid overflow; this implementation's unscaled sums bypass that protection.
- #439 `src/models/survival.ts`: reviewed G-rho weighted log-rank observed/expected counts, covariance matrix, singular generalized inverse fallback, strata/group ordering, Kaplan-Meier risk/event/censor counts, Greenwood standard errors, three confidence transforms, median and flat-plateau interpolation. No new independent defect isolated. Inputs include all-censored groups, simultaneous events/censoring, infinite censoring times, rho=0/1/negative values, survival reaching zero and a median plateau.
- #440 `src/models/tiedTimes.ts`: reviewed finite-time filtering, absolute/relative sqrt-epsilon tie criteria, mean-absolute-time scaling, overflowed opposite-sign gaps, smallest-time representative and binary search mapping. No new independent defect isolated. Inputs include times `[1,1+1e-9,2]`, ([10^{308},10^{308}+10^{292}]), opposite-sign extreme times, infinities and duplicate signed zeros.
- Existing tests/fixtures inspected: `test/anova.test.ts`, `test/anovaLm.test.ts`, `test/aovEz.test.ts`, `test/aovStrata.test.ts`, `test/carAnova.test.ts`, `test/coxph.test.ts`, `test/survival.test.ts`, and `test/mauchlyTest.test.ts`. Tests compare ANOVA and survival results with R/afex/car references; Cox tests compare coefficients, covariance, likelihood, score/Wald tests, warnings and iteration counts with survival 3.8-3. Vitest/npm/R were not executed; listed inputs are source-derived review cases, not claimed runtime results.
- Source blobs: `anovaSequential.ts` `fb1bf352f9106fd3e79c9d03ee40773318b4e26c`; `aovEz.ts` `5337523c4fe1358f6b74b3a67b201406710084fa`; `aovStrata.ts` `b34c319610712397b87a4064057c338541027846`; `carAnova.ts` `0b2fc663a6e4e933cc86fb80e7f67dcc4f84a4b8`; `coxph.ts` `2e3bc2355f92336b7433ae8c4e812c6d0441faba`; `survival.ts` `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de`; `tiedTimes.ts` `229af071501c8dbc7bdcc0c03d503346ed227713`; `anova.test.ts` `3f1039e52c6097c3ac8e04b5f9e19ce20d409257`; `anovaLm.test.ts` `defa0765f0f73cabe3966e325901d1b948453d5a`; `aovEz.test.ts` `c00ec336f097da2db4ccbfc8c1d4d8fa2647b95b`; `aovStrata.test.ts` `2cfee16067bf205503f1e5a40173edce27505af0`; `carAnova.test.ts` `e10ac79f9cb66db5747680f8c73c2c485275f62e`; `coxph.test.ts` `d2093f7fe15fa24069e1af7588baab4240ea3cf8`; `survival.test.ts` `fb067569319a07e0c60944beab502623ab5d7be2`; `mauchlyTest.test.ts` `a8764c687f50d72903a8236b67ba2e956aa6287f`.
- GitHub Issue: #87 — https://github.com/numero-uno-jpn/rStats.js/issues/87
- Repository HEAD at audit: `088526f632e4e5cc7ebeb5432aed37a5a608a9f3`.


## Audit #441-#448

- #441 `src/models/lmer.ts`: reviewed model/option validation, fixed-effect QR projection and response residualisation, response power-of-two scaling, exact-fit detection, trust-region Newton/Hessian construction, negative-curvature escape, boundary release, whole-term restart search, convergence thresholds, REML/ML criterion reconstruction, covariance/VarCorr/ranef/fitted/residual restoration and fit-internals snapshots. **Confirmed Issue #88**: the exact-fit guard compares `max|y-Xβ₀|` with (10^{-12}\max|y|), which can reject a response with nonzero, representable residual variation when it has a large common offset. Reproduction: `lmer("y ~ 1 + (1 | g)", {g:["a","a","b","b","c","c"], y:[1e12,1e12+0.5,1e12-0.5,1e12+0.25,1e12+0.75,1e12-0.25]})`. Here the threshold is about 1 and the residuals after the fixed intercept are at most 0.625, so the source classifies the data as an exact fit although within-group residual variation remains. GitHub Issue #88 opened.
- #442 `src/models/mixedStructure.ts`: reviewed fixed/random formula splitting, grouping-expression expansion (including nesting and interactions), level/code construction, treatment contrasts, `||` splitting, grouping-term ordering, sparse Z column construction, lower-triangular Λ parameter indexing, rank-deficient fixed-effect handling and scale warnings. No additional independent defect isolated. Inputs include `y ~ x + (1|g)`, `y ~ x + (x|g)`, `y ~ x + (1|a/b/c)`, crossed factors, `(x+z||g)`, unused levels and missing grouping labels.
- #443 `src/models/mixedDeviance.ts`: reviewed sparse block pattern/elimination tree construction, numeric Cholesky factorisation, selected inverse, sparse triangular solves, penalised least-squares solution, refinement of W/β/u, log determinants, REML/ML profiled deviance and analytic gradient. Existing dense-reference tests compare sparse and dense results on crossed/nested designs. No new independent defect isolated. Inputs include random-intercept and random-slope models, crossed and nested groupings, diagonal θ at zero, negative off-diagonal θ and fixed-seed random θ vectors.
- #444 `src/models/mixedDerivatives.ts`: reviewed analytic Hessian and covariance Jacobians, tangent Cholesky factorisation, selected-inverse derivatives, sparse trace sums, REML logdet derivatives, response scaling and derivative symmetry. No new independent defect isolated. Inputs include REML/ML, random-intercept/slope blocks, zero boundary parameters and finite-difference comparison at the exact optimum.
- #445 `src/models/lmerAnova.ts`: reviewed type I/II/III hypothesis extraction, nested-model and model-comparison checks, REML refit behavior, likelihood-ratio tests, Wald/F tests, denominator df and Satterthwaite result caching. No new independent defect isolated. Inputs include nested and nonnested fits, same-data identity versus copied data, REML/ML combinations, duplicate model names and singular fits.
- #446 `src/models/lmerHypotheses.ts`: reviewed fixed-effects design reconstruction from snapshots, Type I sequential hypotheses, Type II marginality/containment, Type III full-dummy mapping through generalized inverse, treatment/sum/poly contrasts, aliased columns, missing cells and zapsmall cleanup. No new independent defect isolated. Inputs include balanced/unbalanced factorial designs, missing factor combinations, no-intercept models and non-treatment contrasts.
- #447 `src/models/lmerTest.ts`: reviewed Satterthwaite covariance of variance parameters, Hessian eigenvalue truncation/warnings, contrast covariance and Jacobians, t-tests, joint F-tests, contrast rank and df aggregation, confidence intervals and coefficient table mapping. No new independent defect isolated. Inputs include single and joint contrasts, singular Hessians, rank-deficient fixed effects, near-zero eigenvalues and response scales near (10^{308})/(10^{-308}).
- #448 `src/models/mauchly.ts`: reviewed orthogonal contrast-space construction, inclusion (span(X)\subseteq span(M)), double-double residual SSP, sphericity W determinant normalization, finite-sample chi-square correction and p-value tail. No new independent defect isolated. Inputs include identity M, intercept-only X, group-adjusted X, rank-deficient M/X and p=1/2/3 contrast dimensions.
- Existing tests inspected: `test/lmer.test.ts`, `test/lmerSparse.test.ts`, `test/lmerDeviance.test.ts`, `test/lmerTerms.test.ts`, `test/lmerHypotheses.test.ts`, `test/lmerTest.test.ts`, and `test/mauchlyTest.test.ts`. The sparse tests use fixed generator seeds 1–6 and theta seeds 100–105 and compare sparse calculations with an independent dense reference; fixture suites compare against lme4/lmerTest. Vitest/npm/R/lme4 were not executed; the listed reproductions are source-derived candidates, not claimed runtime results.
- Source blobs: `lmer.ts` `86b47afc85f643ae904cc4c884ff8d109b3a42e2`; `mixedStructure.ts` `40803660d304825257e6b57c034240b328a366e9`; `mixedDeviance.ts` `7fa0cb7b42f83c91d819ac165fd3a8bba18a939a`; `mixedDerivatives.ts` `11af5c07a9c1bcbeb0d9d9ea4eb5b3cf65884340`; `lmerAnova.ts` `c4572e0357a314f8699b2e814a09585ee6c12fb4`; `lmerHypotheses.ts` `ca9ee25511b1f8c0b6324b562d6742124e029514`; `lmerTest.ts` `70a682c1c77b70d30b68259b5023ce1d6295cd4d`; `mauchly.ts` `0dae48405cd78c389dea9d31321ae7cd57b99d84`; `lmer.test.ts` `fe30efc88ccf69e8be5ffcc80727bede26604300`; `lmerSparse.test.ts` `9e2a49a1c4345569557cadf297d771e831656426`; `lmerDeviance.test.ts` `f04de990add610ff517d3b75cbbde9b2ec333fbb`; `lmerTerms.test.ts` `0bb02091a03ea34b459714a821d26dbbf4bc2398`; `lmerHypotheses.test.ts` `1ae101f323a6bb9dc6b41a14d9e207f713b9f3c1`; `lmerTest.test.ts` `882b5f8503a486356632d85bc3ef219f43787378`; `mauchlyTest.test.ts` `a8764c687f50d72903a8236b67ba2e956aa6287f`.
- GitHub Issue: #88 — https://github.com/numero-uno-jpn/rStats.js/issues/88
- Repository HEAD at audit: `4ebbf2d10b1635ff70cd1cf674bb6bfd26325880`.


## Audit #449-#458

- #449 `src/index.ts`: checked the root barrel's six subpath aggregations (special, distributions, tests, linalg, descriptive, numerics) against package exports; the mixed-model area is intentionally a separate `/mixed` subpath and is added only to the API-reference entry. No accidental omission or duplicate root export identified.
- #450 `src/api-reference.ts`: checked that TypeDoc includes the root API plus the separately packaged mixed-model entry, while the build excludes this documentation-only file. No issue identified.
- #451 `src/entries/descriptive.ts`: checked public exports for descriptive summaries, quantiles, ranks, covariance/correlation, tables, missing values, histograms, moments, grouping, data frames and pivots against their implementation modules. No missing intended public symbol identified.
- #452 `src/entries/distributions.ts`: checked density/CDF/quantile triplets, extra distributions, summary helpers, option types and random-number/RNG stream exports against implementation modules. No missing intended public symbol identified.
- #453 `src/entries/linalg.ts`: checked matrix operations, decompositions, solves, norms, matrix input types, sequence generation and result/options types. No missing intended public symbol identified.
- #454 `src/entries/mixed.ts`: checked lmer, lmerTest summary/contest and lmerAnova/compare public exports; internal structure/deviance/derivative helpers remain unexported. No accidental exposure or missing intended symbol identified.
- #455 `src/entries/numerics.ts`: checked integration/optimization/root finding, interpolation, ODE and numerical derivative exports and their option/result types. No missing intended public symbol identified.
- #456 `src/entries/special.ts`: checked gamma/beta/choose, polygamma, Bessel, erf/inverse-erf and log1p-related public exports. No missing intended public symbol identified.
- #457 `src/entries/tests.ts`: checked hypothesis tests, pairwise/multiple comparisons, power/effect sizes, linear/GLM/ANOVA, repeated-measures, survival/Cox, reliability/factor-analysis and polychoric/polyserial exports. No missing intended public symbol identified.
- #458 package/build/docs metadata: checked `package.json` export maps, ESM/type paths, prepack build, Node engine, `tsconfig.build.json` include/exclude and TypeDoc entry points/validation. The root package export intentionally does not re-export mixed models; `./mixed` is separately exported and TypeDoc adds it via `api-reference.ts`. No path mismatch or missing entrypoint identified. Build/typecheck/TypeDoc were not executed.
- Source blobs: `index.ts` `325df03e925e9cda87ff608af8d1d6ca071ea08d`; `api-reference.ts` `dc66d56aca691ba312c6f10a50e742e7921e2e69`; `entries/descriptive.ts` `fb10893d0071c8e00efa9146f607952a7de4f321`; `entries/distributions.ts` `7b44e94c54982bdc6aba93f6e5a1aacac8afd8e9`; `entries/linalg.ts` `e32c849b2f9d1dd45c08e6ef70dfe5d1c107ac8f`; `entries/mixed.ts` `fbf3809001ad16f39e28f2b9fb1205e7b4a2f7a8`; `entries/numerics.ts` `b1264f23844b400756e935cceee2d36fb0bde88c`; `entries/special.ts` `23585b6d3c282b3c43852a684e5914017b3a700d`; `entries/tests.ts` `52e4980e22ee14739c2801c965c7d348aa6a3175`; `package.json` `42d30cf41e1acc619d3d7502ddf5289ab0979744`; `tsconfig.build.json` `1010b27d1ebaed90fadba227c8b0822cbcdd06d6`; `typedoc.json` `720f09a070d899bfd5139e9c4941c1474ce27a1a`.
- Repository HEAD at audit: `60db1a6459812550dbbe26f0aeb458bcfb2b5d99`.


## Audit #459-#469

- #459 `test/helpers/fixture.ts`: reviewed JSON fixture loading and optional Rmpfr reference joins by serialized arguments, NA/NaN/Inf conversion, special-value relative error, subnormal tolerance, error floors, mismatch ordering and write paths. No test-harness defect isolated. Inputs include duplicate/ordered argument objects, NaN/Inf/zero, and subnormal expected values.
- #460 `test/helpers/htest.ts`: reviewed argument decoders, recursive flattening, string/logical exact fields, numeric field tolerances/floors/scales, reference comparisons, known differences, substitutions, error cases and precision-report aggregation. No test-harness defect isolated. Inputs include scalar/vector/matrix fixtures, unequal result lengths, nested numeric tables and NaN references.
- #461 `test/helpers/anova.ts`: reviewed fixture data-frame reconstruction, table row/column alignment, exact labels/warnings, scaled-column error rules, known-difference accounting and use of reference values. No test-harness defect isolated. Inputs include zero-reference coefficients, perfect-fit F cells, NaN cells, zero-row tables and multiple ANOVA tables.
- #462 `test/helpers/linalg.ts`: reviewed QR/SVD/eigen column alignment, sign/phase normalization for comparison, condition-scaled tolerances, max-absolute error and residual helpers. No test-harness defect isolated. Inputs include repeated singular/eigenvalues, complex conjugate pairs, empty vectors and zero-scale references.
- #463 `test/helpers/properties.ts`: reviewed deterministic seeded generator, boundary/log-uniform parameter selection, distribution support/moment construction, finite-difference point selection around kinks, and seed handling. No production-code defect identified; generator edge loops are bounded in practice by its parameter ranges but were not executed.
- #464 `test/helpers/precision.ts`: reviewed environment-gated precision reporting, per-function summaries, reference-vs-R error accounting and output aggregation. No test-harness defect isolated.
- #465 `test/helpers/mixedDense.ts`: reviewed the independent dense reference's cross-product construction, Cholesky/triangular solves, penalised least-squares refinement, log determinants and gradient; checked its separation from the sparse production implementation and its fixture/reference role. No new issue isolated. It is not an independent implementation of the model-structure builder; it intentionally consumes the same `MixedModelStructure`.
- #466 `vitest.config.ts`: checked test discovery, precision setup file and timeout. No missing test glob or timeout mismatch identified.
- #467 `tsconfig.json`: checked strictness, NodeNext ESM resolution, exact optional properties, unchecked indexed access, test inclusion and browser-test exclusion. No configuration inconsistency identified.
- #468 `scripts/bundle.mjs`: checked root bundle, per-area split bundles, shared chunks, package version banner and area list against package exports; the `mixed` area is included. No entrypoint mismatch identified.
- #469 `scripts/oracle.sh`: checked oracle discovery, named-function filtering, container isolation/network disablement, memory cap override, x86_64 random oracle selection and read-only/write mount boundaries. No script defect isolated. Docker/R oracle generation was not run.
- Source blobs: `fixture.ts` `94f2bcf765ea40c62aa71bb461afef7b30721cc2`; `htest.ts` `0fc4837503fba30c6e65626b444f19005b820856`; `anova.ts` `4c9c1e029c9cea9e5b9fdedfd2c81a866fcedf0f`; `linalg.ts` `bf005fcc20ab0533d4b01f3c16b29d3ddbf897b7`; `properties.ts` `9993a08e6d5ddf264c19627b264ce5d5c7694299`; `precision.ts` `1114ac1d951b03ed2c5d4867dbb38d726801663b`; `mixedDense.ts` `6c21c9fbfbdffcfaa22bf2162b7fb5196a4752ca`; `vitest.config.ts` `dc30b99912fc5bedf837d78e644745d96fef4bc1`; `tsconfig.json` `1da7b7a2735329908e9e21a702274bae299d069c`; `bundle.mjs` `17a23ceae3974e6f0590f5b4afd6ef499e4c0e6f`; `oracle.sh` `4866d5828987bb55135bdb94c0f7379152406895`.
- Repository HEAD at audit: `4b046186599fad8a1c7a0727a74fb0198b5823fc`.


## Audit #470-#481

- #470 `oracle/_common.R`: reviewed round-trip-safe number serialization, NA/NaN/Inf encoding, fixture row expansion, tail/log grids, optional Rmpfr registration, incomplete-gamma/beta reference formulas and asymptotic fallback guards. No independent oracle defect isolated. Inputs include zero-row grids, singleton logical/numeric columns, subnormal probabilities and parameter values beyond the reference implementation's supported range.
- #471 `oracle/_htest.R`: reviewed vector/matrix argument encoding (including length-one arrays), htest field extraction, warning/error capture, optional reference field generation and NA serialization. No independent oracle defect isolated. Inputs include 1×1 matrices, empty vectors, scalar vectors and tests without an alternative/parameter/estimate.
- #472 `oracle/_anova.R`: reviewed data-frame type metadata, formula serialization, warning capture, exact rational Gram-Schmidt references, aliased-column detection, sequential sums of squares and repeated-measures synthetic-data construction. No independent oracle defect isolated. Exact references use rational arithmetic on the exact binary inputs; p-values still use R's distribution routines as documented.
- #473 `oracle/_glm.R`: reviewed family/link construction, matrix interface, NA row removal, two-column binomial response, prior weights/offset/start handling and reference calculations. No independent oracle defect isolated. Inputs include p=0 predictor matrices, grouped binomial response and quasi families.
- #474 `oracle/_linalg.R`: reviewed exact/reference helpers for matrices, pivot/rank alignment, determinant, condition number, residual and orthogonality calculations. No independent oracle defect isolated. Inputs include empty and singular matrices, rectangular dimensions and rank-deficient pivots.
- #475 `oracle/_noncentral.R`: reviewed high-precision Poisson-mixture references, log-term window selection, asymptotic far-tail fallbacks, truncation caps, gamma/beta tail complements and Rmpfr range setup. No independent oracle defect isolated in the supported reference domain. Inputs include large ncp/df, deep lower/upper tails, df=0, subnormal x and mixture windows exceeding the 2e6 cap (which deliberately return NULL/NA rather than fabricate a reference).
- #476 `oracle/_optimfns.R`: checked analytic gradients for Rosenbrock, quadratic, Beale, Wood and cosine test functions against their objective definitions; checked the output schema for par/value/counts/convergence/message/Hessian. No discrepancy identified by algebraic inspection.
- #477 `oracle/_power.R`: reviewed high-precision noncentral t/F/chi-square power references, Poisson mixture truncation, direct integral fallback for cancellation-prone t tails, conventional Cohen effect-size mapping, and root-solved power references. No independent oracle defect isolated in the declared parameter region. Inputs include extreme ncp/df cases deliberately delegated to R when the reference series is too costly.
- #478 `oracle/_random.R`: reviewed x86_64 platform pinning, JSON escaping, seed/value/next-uniform fixture format and case-list reset. No oracle defect isolated; next-uniform values explicitly test random-consumption alignment.
- #479 `oracle/_reference.R`: reviewed mismatch input decoding, reference function registration, finite scalar filtering, merge with existing references and write-back. No independent defect isolated. Reference values are intentionally omitted when the high-precision function fails or returns nonfinite values.
- #480 `scripts/oracle.sh`: rechecked named-oracle validation, default oracle discovery, per-oracle memory overrides, amd64 selection, network isolation and container mounts. No new issue beyond the earlier script audit.
- #481 `oracle/Dockerfile`: reviewed pinned R/package installation, locale, architecture-sensitive dependencies and reference toolchain setup. No build-script defect isolated from source inspection; Docker build was not run.
- Source blobs: `_common.R` `5f68193f87c150926ddd1bf7a7d0ab42cbba6bca`; `_htest.R` `46c0441824e1881250736d1244efca68f356c1e9`; `_anova.R` `40fc6292520330ee07c67562fe4f73f175ee0ab9`; `_glm.R` `cf261c0397b881d30ec16b84292cca0e63382568`; `_linalg.R` `7023295df3616a17912b5e70dc905b0736351bbd`; `_noncentral.R` `2e56e874be4a0d79e43da0a566aa3153ab028be2`; `_optimfns.R` `d2ab1ecb5bdbca3052a92449caa6a232bff8cc0e`; `_power.R` `ee10655aadbf09c2acb30d7e6db320df3db4b320`; `_random.R` `ed930e498aae97df7e59d50617ecd30813d62666`; `_reference.R` `4a1c5d499b1e82b11bdb21fd52e11035ea0dff5d`; `oracle.sh` `4866d5828987bb55135bdb94c0f7379152406895`; `Dockerfile` `2bbb6438c04f6cc22f476cbd990361ded1ef116d`.
- Repository HEAD at audit: `5e519dc12f47b7b98ada78eba5c6089d3081b0ac`.


## Audit #482-#483 — duplicate-issue reconciliation

- #482 `expm()` unsafe `order`: a repository-wide open-issue cross-check found that new Issue #84 duplicated existing Issue #72 (same `Number.isInteger` acceptance of unsafe integer orders and non-progressing `j--` loops). Closed #84 with GitHub state reason `duplicate`; #72 remains canonical. The audit #380-#386 entry now points to #72.
- #483 finite-interval integration midpoint overflow: cross-check found that new Issue #85 duplicated existing Issue #51 and overlapped wrapper-level Issue #75. Closed #85 with state reason `duplicate`; #51 remains canonical for the QUADPACK midpoint and #75 records the wrapper-level manifestation. The audit #387-#394 entry now points to #51.
- This correction is intentional: the source findings remain valid, but the new duplicate issues are not counted as independent discoveries. The current distinct issue additions from this continuation are #70, #71, #86, #87 and #88; issues #72 and #51 were already present.


## Audit #484 — cross-reference of pre-existing open issues

The open-issue list was cross-checked against the recently re-audited source files. The following are pre-existing findings and remain open; “no new issue” in the corresponding audit row means no *additional* defect beyond these known reports:

- #383 `kappa.ts`: existing #56 (exact kappa/ginv scale invariance under singular-value overflow) and #73 (direct triangular condition estimate overflow).
- #377 `qr.ts`: existing #57 (LINPACK QR norm downdate near rank tolerance); new, separate response-NaN corruption is #71.
- #357 `dd.ts` / #384 `ddexp.ts`: existing #52 (double-double product error lost for large operands), #54 (logAddExp(+Inf,+Inf)) and #62 (scaled product residual underflow).
- #360 `invert.ts` / #361 `discrete.ts`: existing #53 (firstTrue can return Infinity below a finite threshold).
- #388 `integrate.ts` / #387 `quadpack.ts`: existing #51 and #75 cover the finite-interval midpoint overflow; the newly opened #85 was closed as a duplicate of #51.
- #392 `optim.ts` / #393 `localmin.ts`: existing #61 (non-finite objective stalls localMin), #74 (zero tolerance can stall optimize) and #76 (infinite maxit can stall SANN).
- #411 `grouping.ts`: existing #44 (mixed numeric/string labels are not coerced as R factor labels).
- #414 `dataFrames.ts`: existing #82 (merge key type coercion differs from R).
- #416 `hist.ts`: existing #81 (pretty break construction overflow for wide finite ranges/large n).
- #418 `moments.ts`: existing #38 (canonical scale ragged-matrix report; duplicate #80 closed).
- #419 `omega.ts`: existing #83 (minres objective and gradient mismatch).
- #420 `pivot.ts`: existing #39 (pivotWider reads inherited valuesFill/valuesFn properties).
- #413 `cov.ts`: existing #78 (cor diagonal overwritten to 1 when undefined) and #36 (canonical ragged cov/cor report; duplicate #79 closed).
- #447 `lmerTest.ts`: existing #58 (lmerContest contrast-rescaling invariance/variance overflow).
- These existing issues were not re-opened or duplicated. The new distinct issues from this continuation remain #70, #71, #86, #87 and #88; #72 and #51 were already open before this continuation.


## Audit #485 — reconciliation of earlier duplicate issues

- #69 was confirmed to duplicate #37 (same Wilcoxon support product (m\times n) rounding down to (2^{53})); #69 has been closed with reason `duplicate`. #37 remains canonical.
- #79 was confirmed to duplicate #36 (same ragged-matrix acceptance in `cov()/cor())); #79 has been closed with reason `duplicate`. #36 remains canonical.
- #80 was confirmed to duplicate #38 (same ragged-matrix acceptance in `scale())); #80 has been closed with reason `duplicate`. #38 remains canonical.
- #75 was confirmed to duplicate #51 (same finite-interval midpoint overflow); #75 has been closed with reason `duplicate`. #51 remains canonical.
- Earlier audit rows and the cross-reference section were corrected so they no longer treat closed duplicate reports as independent open defects.


## Audit #490 — CI regression and Bessel reference validation

- Inspected GitHub Actions CI runs 41391671801, 41391762016 and 41391887874. All three show the same sole Vitest failure in `test/review47.test.ts:80`: expected `4.440892098500626e-16 < 4e-16` for `besselY(1e-310,0.5)`. The test shards report 2,301 passing, 1 failing and 34 skipped; the other test shard passes. `npm run typecheck` passed, and the browser job passed in the completed runs.
- Recomputed the reference using 100-decimal-digit mpmath with the *exact binary64 value* of JavaScript's `1e-310` (not the decimal real (10^{-310})). Exact input: `9.999999999999969449327502897691969360577315247038115033484093633830613278269072129706249093585174034e-311`. High-precision (Y_{1/2}(x)): `-7.9788456080286657467538749900419960196720176367417900358749714491336331839763167e154`; correctly rounded binary64: `-7.978845608028666e154`. The CI error against the test's current expected value is exactly the reported (2^{-51}); the correctly rounded value agrees with the exact-binary64 high-precision result to below half an ulp. This is a test-reference/input-representation mismatch, not a Bessel implementation defect for this input.
- **Confirmed Issue #89**: update the reference in `test/review47.test.ts` to the exact-binary64 reference (or construct the input from the same decimal value used to generate the reference). No source-code modification was made.
- Source blobs: `test/review47.test.ts` `9e5eef21c5d508b3852bc1450475ab7c2de91b70`; `src/special/besselJY.ts` `72fbd7798357b583eb92556d320998fb85c9ce3c`; `src/special/besselSeries.ts` `ab0d8df401ba07f397f1fef22742a4c6674c4937`.
- CI runs: https://github.com/numero-uno-jpn/rStats.js/actions/runs/41391671801 ; https://github.com/numero-uno-jpn/rStats.js/actions/runs/41391762016 ; https://github.com/numero-uno-jpn/rStats.js/actions/runs/41391887874
- GitHub Issue: #89 — https://github.com/numero-uno-jpn/rStats.js/issues/89


## Audit #491 — `src/random/common.ts` call-site and integer-bound re-audit

- Re-audited `generate()` and `powInt()` and closed the unresolved reachability question from #136. Repository-wide search of the random source modules found exactly one `powInt` call site: `src/random/binomial.ts:rbinom1`, in the small-mean inversion branch.
- `rbinom1` validates `nin` as finite and exactly integral, then routes every `rn >= INT_MAX` to `qbinom()` before calculating `powInt(q, n)`. Therefore the exponent reaching `powInt` is an integer in `[0, 2147483646]`; the signed 32-bit `n >>= 1` loop cannot overflow or become negative. The previously noted `2^31` concern is unreachable through the only production call site.
- `generate()` rejects negative and non-finite counts, truncates finite nonnegative fractions, allocates the resulting array, and invokes the callback exactly once per element (zero times for a zero-length result). No independent defect isolated.
- Concrete boundary inputs reviewed: `rbinom(1, 2147483646, 1e-8)` reaches the inversion/powInt-eligible side when its mean is below 30; `rbinom(1, 2147483647, 1e-8)` takes the `qbinom` branch and never calls `powInt`. Also reviewed `generate(0, f)`, `generate(2.9, f)`, `generate(-1, f)`, `generate(NaN, f)`, and `generate(Infinity, f)` as source-derived cases. These are not claimed runtime results.
- Cross-check: `src/random/rng.ts:rbits()` uses the same `for (n = 0; n <= bits; n += 16)` chunk loop as R 4.6.1 `src/main/RNG.c`; this apparent extra chunk at exact multiples of 16 is intentional R-compatible behavior, not an rStats.js defect.
- Source blobs: `common.ts` `be016a36e9f09f580462d2bf93e30ed6bad527c1`; `binomial.ts` `61b55752b90870ca08cb302b2a90fbfc2462979c`; `rng.ts` `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `mt.ts` `a27a644a591ab2286227aa5db1b05b16fa149300`; `random.test.ts` `f849a51e7b3c89c639641cf0a231fc9989dcff81`.
- GitHub Issue: none. No source code changed. Vitest/npm package runtime/R were not executed.
- Repository HEAD at audit: `89041fb3f2bb91834633d31c6ddbd077baa2c7d9`.


## Audit #492 — `src/random/hyper.ts` HIN/H2PE boundary and large-total re-audit

- Re-read `rhyper1()`, HIN inversion, H2PE setup and three proposal regions, the acceptance recurrence/squeeze/final Stirling test, cache invalidation, and the large-parameter Bernoulli/`qhyper1` fallback. Reviewed `test/hyper.test.ts` and the R 4.5.2 `rhyper` fixture (including ordinary HIN/H2PE cases, degenerate endpoints, invalid `k`, half-even parameter rounding, and individual parameters above `INT_MAX`).
- Investigated the important boundary where the *total* population exceeds `INT_MAX` while each individual population and the draw count remain below it. Concrete case: `m=1073741824`, `n=1073741824`, `k=20`, so `N=2147483648`. The JS implementation does not take the large-parameter fallback, but it also does not use 32-bit integer arithmetic for `N`; the setup gives `mode=10`, variance approximately `4.999999955762178`, `d=3.5`, `xl=7`, `xr=14`, all finite and within support. For `m=n=1073741824`, `k=18`, mode is 9 and the HIN branch is selected. This is materially different from the known R C implementation's 32-bit-total overflow concern; no corresponding JS integer-wrap path was found.
- Checked support degeneracy (`minjx === maxjx`), `k=1` Bernoulli fallback, individual-parameter `>= INT_MAX` fallback, HIN's scaled starting mass and recurrence, H2PE's central/left/right regions, tail support guards, acceptance ratio recurrence, squeeze bounds, and the 10,000-try guard. No independent reproducible defect isolated.
- Source-derived boundary inputs (not claimed runtime results): `rhyper(1, 1073741824, 1073741824, 20)`, `rhyper(1, 1073741824, 1073741824, 18)`, `rhyper(1, 3000000000, 2000000000, 7)`, `rhyper(1, 3000000000, 2000000000, 1)`, `rhyper(1, 0, 5, 2)`, `rhyper(1, 5, 0, 2)`, `rhyper(1, 5, 5, 0)`, `rhyper(1, 5, 5, 10)`, and invalid `rhyper(1, 5, 5, 11)`.
- Source blobs: `hyper.ts` `df63732522e39556a07f79edbb5a287f7348fa87`; `hyper.test.ts` `29b396ee4155cf89c8cd9e2c7ff34b700fdbba94`; `rhyper.json` `39ca835db17abaf839fa97848fa7fbf4eeead82c`; `binomial.ts` `61b55752b90870ca08cb302b2a90fbfc2462979c`; `common.ts` `be016a36e9f09f580462d2bf93e30ed6bad527c1`.
- R reference cross-check: R's `rhyper` large-parameter branch uses `qhyper(unif_rand(), ...)` when an individual parameter reaches `INT_MAX`; see the documented source lines 98–112. The reviewed JS branch matches that dispatch. The separate total-population overflow concern in R does not transfer directly because the JS implementation keeps `N` as a Number rather than a 32-bit int.
- GitHub Issue: none. No source code changed. Vitest/npm package runtime/R were not executed.
- Repository HEAD at audit: `b982e64eb4f65de894ae2d8af28e19523582cdde`.


## Audit #493 — `src/random/poisson.ts` extreme-parameter and cache-transition re-audit

- Re-read the full `rpois1()` implementation and compared it step-by-step with R's `src/nmath/rpois.c`: Case B inversion (U/T/C) for `mu < 10`, Case A modified-normal rejection (N/I/S/P/F/Q/E/H) for `mu >= 10`, including constants, branch inequalities, and random-consumption order. The R manual identifies Ahrens–Dieter (1982) as the algorithm used by `rpois`; source comparison confirms the implementation structure and constants.
- Case B: checked `p0`, `pbase`, `qbase`, `pp[36]`, `l`, and `m` initialization/extension, the `u <= 0.458` lookup shortcut, table saturation at 35, and repeated draws after table exhaustion. The JS conditional `u > 0.458 ? min(l,m) : 1` is equivalent to R's `(u <= 0.458) ? 1 : min(l,m)`, including equality.
- Case A: checked `s=sqrt(mu)`, `d=6*mu*mu`, `bigL=floor(mu-1.1484)`, immediate acceptance, cubic squeeze, parameter-cache rebuild (`newBigMu`, `muprev2`), polynomial/log Step F, quotient acceptance, double-exponential hat proposal, `t > -0.6744`, and acceptance inequality. The JS `u >= 0 ? e : -e` matches the sign convention of R's `fsign(E,u)` for the uniform-derived signed value, including +0.
- Cache transitions checked from source: same-parameter reuse; small→large and large→small transitions; changing from one large mean to another; early returns at Step I/S before Step P; and zero/invalid mean calls which return before mutating the cached positive-mean state. No stale-parameter path found.
- Extreme source-derived inputs (not runtime results): `rpois(1, Number.MIN_VALUE)`, `rpois(1, 9.999999999999998)`, `rpois(1, 10)`, `rpois(1, 10.000000000000002)`, `rpois(1, 2**53)`, `rpois(1, 1e154)`, `rpois(1, Number.MAX_VALUE)`, and cache sequences `setSeed(1); rpois(1,5); rpois(1,0); rpois(1,5)` and `setSeed(1); rpois(1,20); rpois(1,10); rpois(1,20)`. These were traced analytically only; no sample values are claimed.
- For `mu >= 2^53`, consecutive integer outputs are not representable as distinct JS Numbers; R also returns doubles once the integer range is exceeded. For very large finite means, `d` can overflow to `Infinity`, but the squeeze's RHS scales as `O(mu^(3/2))` while finite `u*d` is effectively unbounded; this is consistent with the asymptotic squeeze and does not by itself establish a defect. No int32 bitwise operations occur in this implementation.
- Reviewed R 4.5.2 `test/fixtures/rpois.json` (32 cases; small means, the 9.99/10 switch, moderate/large means through 1e7, invalid means, and long-run summaries) and the `rpois` registration in `test/random.test.ts`. Fixtures inspected, not executed.
- Source blobs: `poisson.ts` `9f6f9657e84c2110bb08640b1f846c345bd2ff2f`; `rpois.json` `5a6e749d4a299ce6259f8cfd9d8a44d92c4be666`; `random.test.ts` `f849a51e7b3c89c639641cf0a231fc9989dcff81`; `common.ts` `be016a36e9f09f580462d2bf93e30ed6bad527c1`.
- External reference: R's Poisson documentation specifies invalid lambda→NaN, lambda=0 as a point mass at zero, and Ahrens–Dieter as the `rpois` algorithm. R source `src/nmath/rpois.c` was checked for direct branch comparison.
- GitHub Issue: none. No source code changed. Vitest/npm package runtime/R/Monte Carlo were not executed.
- Repository HEAD at audit: `d20bc6cd37f6f835942f403c88986b0d45fd7768`.


## Audit #494 — `src/random/as241.ts` inverse-normal domain and coefficient re-audit

- Re-read the Wichura AS 241 PPND16 coefficients, Horner evaluation, central region `abs(q) <= 0.425`, tail transform `sqrt(-log(r))`, split at `r <= 5`, and sign restoration. The polynomial arrays and evaluation order match the AS 241/R `norm_rand` implementation.
- Traced the actual input path through `rng.ts:normRand()` and `mt.ts:nextDouble()`. `normRand` forms `p = (trunc(2^27*u1) + u2)/2^27` from two uniforms. The Mersenne-Twister uniform's minimum positive value is `2^-32`; therefore the smallest representable `p` can be about `2^-59` when the first uniform falls in the first `2^-27` bin. The comment in `as241.ts` saying the generated p exceeds `2^-54` is therefore not a strict lower-bound guarantee. This is a documentation precision issue only: even at `p≈2^-59`, `r=sqrt(-ln(p))≈6.4`, comfortably inside the stated AS 241 domain `r<=27`; no output-path failure follows.
- Source-derived boundary inputs (not runtime results): `ppnd16(0.5)`, `ppnd16(0.5 ± 0.425)`, tail cases with `r=5` (`p=exp(-25)`), and the lowest plausible `normRand` probability around `2^-59`. `ppnd16` is an internal helper; the production caller supplies `p` strictly inside `(0,1)`, so direct p=0/1 endpoint behavior is outside its caller contract.
- Source blobs: `as241.ts` `3e7d42b5c0d867cc1bfe06f2f335d83994dbd7c3`; `rng.ts` `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `mt.ts` `a27a644a591ab2286227aa5db1b05b16fa149300`; `rbasic.json` `fafabb128e79ef73b5c5c923a8b223f84ebe490e`.
- Reviewed R 4.5.2 `rbasic` normal fixtures for seeds 1, 2, 42, 2024, -7, 99, and 123456789, including the next-uniform state. Fixture contents were inspected, not executed.
- External reference: R documentation and source identify `rnorm`'s inversion path and AS 241/normal quantile usage; the direct R source comparison was used for coefficient/branch ordering.
- GitHub Issue: none. No source code changed. Vitest/npm package runtime/R/numerical sweep were not executed.
- Repository HEAD at audit: `83da7d4ffac68325c0f5bcdc5e3a53c9b1351a96`.


## Audit #495 — `src/random/rng.ts` normal/exponential variates and uniform-boundary re-audit

- Re-audited `normRand()`, `expRand()`, and their uniform-generator inputs across Mersenne-Twister and L'Ecuyer-CMRG. This is a focused follow-up to #137/#392/#395, not a claim that the entire RNG subsystem is newly audited.
- `normRand()`: the implementation consumes exactly two uniforms in order, computes `trunc(2^27*u1)+u2`, divides by `2^27`, and passes the result to AS241. This matches R 4.5.2 `src/nmath/snorm.c`'s Inversion branch: `(int)(BIG*u1)+unif_rand()`, followed by `qnorm(...)`. Since each supported generator returns an open-interval uniform, the constructed probability remains strictly inside (0,1); the integer cast is safe because `BIG*u1` is in [0, 2^27). Exactly two uniforms are consumed per standard-normal variate. The downstream AS241 domain and coefficient check is recorded in #494.
- `expRand()`: compared the complete Ahrens–Dieter SA flow against R 4.5.2 `src/nmath/sexp.c`: invalid-endpoint retry, repeated doubling and `a += q[0]`, first-region early return, initial `ustar`, minimum-uniform loop, and its strict `u > q[i]` continuation condition. The JS Q table is generated by the recurrence `term *= ln(2)/i; sum += term`; a separate JS binary64 comparison against all 16 R source literals found every entry bit-for-bit equal, including `Q[15] === 1`. Thus for any supported open-interval u<1, the Q loop terminates by index 15 and does not read beyond the table. No off-by-one or random-draw-order discrepancy found.
- Uniform endpoints: MT `nextDouble()` applies the same R `fixup` constants for raw zero/one; L'Ecuyer returns integer difference times `1/(M1+1)`, with minimum `1/(4294967088)` and maximum `4294967086/(4294967088)`, both strictly inside (0,1). This supports the endpoint assumptions in both normal and exponential transforms.
- Concrete fixture inputs inspected (not executed): `setSeed(1); rnorm(20); runif(1)` with fixture next-uniform `0.82094629411585629`; `setSeed(1); rexp(20); runif(1)` with next-uniform `0.10794362588785589`; `setSeed(3); rexp(5,{rate:1})` with next-uniform `0.60439405404031277`; and L'Ecuyer seed 1 runif fixture values from `rngLecuyer.json`. Also source-traced the limiting uniform inputs `2^{-32}`, `1-2^{-32}` (MT raw-word scale), and the L'Ecuyer integer endpoints above.
- Reviewed `test/fixtures/rbasic.json` (R 4.5.2) and `test/random.test.ts`; fixture contents were inspected, not executed. No Vitest, package runtime, R process, or Monte Carlo run was performed. The fixture's `next` values are recorded test oracles, not newly observed results in this audit.
- Source blobs: `rng.ts` `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `mt.ts` `a27a644a591ab2286227aa5db1b05b16fa149300`; `lecuyer.ts` `7bd112bb422a4e4b8dd2bbcf3badaa4da4efe4c3`; `as241.ts` `3e7d42b5c0d867cc1bfe06f2f335d83994dbd7c3`; `continuous.ts` `5ad76e5676b4bf27c36b288f8e48ac3821bfd92a`; `random.test.ts` `f849a51e7b3c89c639641cf0a231fc9989dcff81`; `rbasic.json` `fafabb128e79ef73b5c5c923a8b223f84ebe490e`.
- R source references: `src/nmath/snorm.c` Inversion branch and `src/nmath/sexp.c` Ahrens–Dieter SA implementation. Both branch structure and draw order match the reviewed TypeScript.
- GitHub Issue: none. No source code changed.
- Repository HEAD at audit: `add20ab752efbf6d76244e612def36b06ab4a83c`.


## Audit #496 — `src/random/lecuyer.ts` MRG32k3a arithmetic and state-validation re-audit

- Re-read the full MRG32k3a implementation: 50-step LCG seed scrambling, rejection of seed words `>= M2`, both order-3 recurrences, state shift order, modular reduction, output combination, and `.Random.seed` signed/unsigned conversion.
- Compared seed initialization and recurrence constants with R 4.5.2 `src/main/RNG.c`. The six seed words are generated by the same `69069*x+1 mod 2^32` recurrence, rejecting each word while it is `>= 4294944443`. The two state recurrences and the output scaling constant `2.328306549295727688e-10` match R's MRG32k3a branch.
- Numeric exactness: all integer products in the recurrence fit below 2^53. Largest relevant products are `1403580*(4294967086)=6028329902567880`, `810728*(4294967086)=3482050075698608`, `527612*(4294944442)=2266064226932504`, and `1370589*(4294944442)=5886603607816338`; each is an exactly representable integer in binary64. The signed differences also remain within 2^53, so JS remainder and correction by the modulus preserve the intended integer recurrence. State updates of component 1 do not alter the component-2 operands before they are read.
- Checked state restoration: length must be exactly 7; each word must be an integer representable as signed/unsigned 32-bit input; conversion with `>>> 0` restores unsigned words; the first triple must not be all zero and each triple must be below its modulus. The caller `setRandomSeed()` checks the kind code before calling `checkState()`; `nextRNGStream/SubStream` likewise validate the kind code before state validation. No acceptance of NaN, fractional words, out-of-range words, or short/long vectors was found.
- Compatibility edge: R's public RNG documentation says neither three-word component should be all zero. However, R 4.5.2 `FixupSeeds()` uses one `notallzero` flag for both loops without resetting it before checking the second triple; when the first triple is nonzero, an all-zero second triple is therefore accepted. The R 4.5.2 fixture explicitly includes `[10407,1,2,3,0,0,0]` and expects five uniform values `[0.0010094978404174444,0.59500378387998498,0.35783453761357442,0.22234082670111491,0.46682759725957651]`, with the second component remaining zero. rStats.js accepts the same state and follows the same recurrence, so this is an R documentation/implementation inconsistency rather than an rStats.js compatibility defect. It is a degenerate stream and should not be recommended as a user-created seed.
- Other concrete fixture inputs inspected (not executed): L'Ecuyer seeds `1`, `42`, `0`, `-7`, `2147483647`, and `-2147483647`; state values at `M1-1=4294967086`, `M1=4294967087`, `M2-1=4294944442`, `M2=4294944443`; and invalid state words `-2147483649`, `4294967296`, `1.5`, `NaN`. The last four are source-derived validation boundaries, not observed runtime results.
- Reviewed `test/random-kinds.test.ts`, `test/fixtures/rngLecuyer.json` (R 4.5.2), and `test/fixtures/rngStreams.json`; fixture contents and test assertions were inspected, not executed. No Vitest, package runtime, R process, or statistical simulation was performed.
- Source blobs: `lecuyer.ts` `7bd112bb422a4e4b8dd2bbcf3badaa4da4efe4c3`; `rng.ts` `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `streams.ts` `63359251f6081a7658ebf27e105e6a0ed7c789cb`; `random-kinds.test.ts` `7023ddbb5e24cab4f85e53fea68895be8dbe29a9`; `rngLecuyer.json` `c75def82ee749d6ba12196390f47596c610635bb`; `rngStreams.json` `1355f6e7efe30f8e1d01b6ba1843ff75b6c502ec`.
- External reference: R 4.5.2 `src/main/RNG.c` for `RNG_Init`, `FixupSeeds`, and `unif_rand`; R RNG documentation for the stated component seed restrictions.
- GitHub Issue: none. No source code changed.
- Repository HEAD at audit: `a7e725be8f838d04e31e806fde3dada4395017f6`.


## Audit #497 — `src/random/streams.ts` jump-ahead matrix and modular arithmetic re-audit

- Re-read `nextRNGStream()`, `nextRNGSubStream()`, the shared `jump()` state handling, and `mulMod()`. The stream and substream steps are respectively 2^127 and 2^76 transitions of the two MRG32k3a component matrices.
- Independently recomputed all four 3×3 jump matrices using exact integer arithmetic (Python arbitrary-precision integers): the transition matrices were repeatedly squared modulo `M1=4294967087` and `M2=4294944443` for 76 and 127 squarings. Every one of the 36 resulting entries exactly matches `A1P76`, `A2P76`, `A1P127`, and `A2P127` in the TypeScript source.
- Checked `mulMod(a,b,m)`: with `a,b < 2^32`, splitting `b=hi*65536+lo` gives `hi<=65535`; `a*hi`, `a*lo`, and the reconstructed intermediate are below 2^49. All are exact binary64 integers. The three-term matrix-vector accumulation is reduced modulo m after each addition and remains below 2m, also exactly representable. The final `t | 0` converts the unsigned residue to the signed 32-bit representation required by `Int32Array` and R's `.Random.seed`.
- State flow: `jump()` accepts only kind codes 10407 and 407, delegates word-count/range checks to `checkState()`, returns a fresh 7-word `Int32Array`, preserves the kind code (including sample-kind Rounding), and does not mutate the input. Repeated and mixed stream/substream jumps use the output of one jump as the next input. The previously documented R-compatible all-zero-second-component quirk remains unchanged; no new state-validation mismatch was found.
- Concrete fixture inputs inspected (not executed): seed 1, 42, and 123456789 with `steps: "stream"`, `"substream"`, `"stream stream stream"`, `"substream substream"`, `"stream substream stream"`, and `"substream stream"`. Also source-derived invalid cases: kind code 10403, state length 6 or 8, first triple `[0,0,0]`, a first-component word `4294967087`, and a second-component word `4294944443`.
- Reviewed `test/random-kinds.test.ts` and `test/fixtures/rngStreams.json` (R 4.5.2). The test independently reconstructs the transition matrices with BigInt and compares the jump functions; fixture values include the returned state and subsequent five uniforms. Files were inspected, not executed. No Vitest, package runtime, or R process was run in this audit.
- Source blobs: `streams.ts` `63359251f6081a7658ebf27e105e6a0ed7c789cb`; `lecuyer.ts` `7bd112bb422a4e4b8dd2bbcf3badaa4da4efe4c3`; `random-kinds.test.ts` `7023ddbb5e24cab4f85e53fea68895be8dbe29a9`; `rngStreams.json` `1355f6e7efe30f8e1d01b6ba1843ff75b6c502ec`.
- R reference: `parallel::nextRNGStream()` and `parallel::nextRNGSubStream()` use the 2^127 and 2^76 jumps respectively; the source matrices agree with the L'Ecuyer transition recurrences.
- GitHub Issue: none. No source code changed.
- Repository HEAD at audit: `4a8773713aa8782ff0432533c2d346702083f5ad`.


## Audit #498 — `src/random/mt.ts` state-position normalization and serialization bounds

- Re-read MT19937 state initialization, twist/tempering, `getRandomSeed()`, and `setRandomSeed()`. The main newly confirmed defect is in the MT position word (`mti`), not in the generator recurrence.
- R 4.5.2 `src/main/RNG.c::FixupSeeds()` sets the Mersenne-Twister position to 624 whenever `I1 <= 0`. The TypeScript rejects negative positions but accepts zero and uses it directly. Therefore a state that R normalizes to a fresh-block position instead reads the first supplied MT word without twisting. The source comment claiming that R takes a negative one as given is inaccurate against the current R implementation.
- Concrete reproduction A (source-derived, not package-runtime executed):
  ```js
  const state = [10403, 0, ...Array(624).fill(1)];
  setRandomSeed(state);
  runif(1);
  ```
  JS accepts `mti=0`, reads `mt[0]=1`, tempers it to 1, and returns exactly `2^-32 = 2.3283064365386963e-10`. R changes the position to 624 and twists the all-ones state first; the first twisted word is 419999967, which tempers to 1988610280, giving `0.4630094114691019`. This is an R-compatibility defect.
- A second manifestation is the unbounded upper position check. `setRandomSeed()` accepts any non-negative integer, but `getRandomSeed()` serializes `mti` into an `Int32Array`. Concrete reproduction B:
  ```js
  const state = [10403, 4294967296, ...Array(624).fill(1)];
  setRandomSeed(state);             // accepted: mti = 2^32
  const snapshot = getRandomSeed();
  snapshot[1];                      // 0: Int32Array wrap
  setRandomSeed(snapshot);
  runif(1);                         // reads mt[0] without twisting
  ```
  The accepted original position is >=624 and would twist before drawing, whereas the round-tripped position is 0 and does not. For `mti=2147483648`, the snapshot instead contains `-2147483648` and cannot be restored by the current validator. These are manifestations of the same missing signed-32-bit bound on the position field.
- Expected validation/compatibility: normalize `mti <= 0` to 624 as R does (or document an intentional divergence), and reject `mti > 2147483647` before changing generator state. Keep positive `mti > 624` within signed 32-bit range valid; R preserves such positions and the next draw regenerates the block.
- Existing test/fixture context: `test/random.test.ts` checks ordinary seed-state round trips and R seed initialization, but does not cover MT positions 0 or above INT32_MAX. `test/random-kinds.test.ts` checks invalid L'Ecuyer state, not these MT boundaries. No Vitest, package runtime, or R process was run.
- Source blobs: `mt.ts` `a27a644a591ab2286227aa5db1b05b16fa149300`; `rng.ts` `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `random.test.ts` `f849a51e7b3c89c639641cf0a231fc9989dcff81`; `random-kinds.test.ts` `7023ddbb5e24cab4f85e53fea68895be8dbe29a9`; `rbasic.json` `fafabb128e79ef73b5c5c923a8b223f84ebe490e`.
- R source reference: R 4.5.2 `src/main/RNG.c::FixupSeeds()` MT branch (`if (I1 <= 0) I1 = 624`) and `MT_genrand()` twist path.
- GitHub Issue: [#90](https://github.com/numero-uno-jpn/rStats.js/issues/90).
- No source code changed.
- Repository HEAD at audit: `18236c5928d1f7c97e4298e6bc463eace49b578b`.


## Audit #499 — `src/random/continuous.ts` Weibull zero-scale invalid-shape boundary

- Focused follow-up to #134, checking parameter-validation order and RNG consumption in the continuous variate generators. A concrete R compatibility defect was found in `rweibull()`.
- Current TypeScript first evaluates `if (!(shape > 0) || !(scale >= 0)) return NaN;`. Consequently, invalid shapes short-circuit before the later `scale === 0` point-mass return.
- R 4.5.x `src/nmath/rweibull.c` checks `!R_FINITE(shape) || !R_FINITE(scale) || shape <= 0. || scale <= 0.`; inside that invalid-parameter branch it returns 0 whenever `scale == 0.`, before returning NaN. Thus invalid shape combined with zero scale returns 0 in R, including negative, zero, NaN, or infinite shape (subject to the source's scale check).
- Concrete reproductions (source-derived; package runtime not executed):
  ```js
  setSeed(26);
  rweibull(1, -1, { scale: 0 }); // rStats.js: NaN; R 4.5.x: 0

  setSeed(26);
  rweibull(1, NaN, { scale: 0 }); // rStats.js: NaN; R 4.5.x: 0
  ```
  The same ordering mismatch applies to `shape = 0` and `scale = -0`. Neither R nor the current JS branch consumes a uniform for these zero-scale cases, so this defect does not advance the RNG stream.
- Existing `test/fixtures/rother.json` includes `shape=2, scale=0` (expected zeros and unchanged next-uniform) but has no invalid-shape/zero-scale combination; this explains why the boundary is not represented by the current fixture.
- R source: `wch/r-source`, branch `R-4-5-branch`, `src/nmath/rweibull.c`, blob `0fdd4dbe504369252f59aaf59f607cb65d9c5451`. Current implementation blob: `continuous.ts` `5ad76e5676b4bf27c36b288f8e48ac3821bfd92a`; fixture `rother.json` `3837f01bab08c0722d4d4a43f256af2af64b7cda`; test harness `random.test.ts` `f849a51e7b3c89c639641cf0a231fc9989dcff81`.
- Other continuous transforms reviewed at the boundary level: `runif` equal endpoints and overflow-width weighted interpolation; `rnorm1` zero SD and non-finite mean; `rexp` reciprocal-rate zero/infinity handling; `rlnorm` non-finite meanlog; `rlogis` and `rcauchy` zero/non-finite scale/location. No additional new defect confirmed in this focused pass. Existing known difference: negative logistic scale returns NaN while consuming the same uniform as R.
- Reviewed fixture text only; no Vitest, package runtime, or R process was executed.
- GitHub Issue: [#91](https://github.com/numero-uno-jpn/rStats.js/issues/91).
- No source code changed.
- Repository HEAD at audit: `ef82574614d280de2e22387766ff370135ddc0ea`.


## Audit #500 — `src/random/extra.ts` positive-infinity parameter handling

- Re-audited the random wrappers against the CRAN extraDistr source, including the C++ RNG functions and R wrapper for inverse gamma. Found a compatibility difference for positive infinite parameters.
- `rkumar()` and `rpareto()` require `Number.isFinite(a/b)` before calling the quantile helpers. The underlying `qkumar1/qpareto1` also reject infinite `b`. In contrast, extraDistr's `rng_kumar()` and `rng_pareto()` reject NaN and non-positive parameters but do not reject positive infinity:
  - `rng_kumar(2, +Inf)` consumes one uniform and evaluates `pow(1 - pow(u, 0), 1/2) = 0`; rStats.js returns NaN and consumes no uniform.
  - `rng_pareto(2, +Inf)` consumes one uniform and evaluates `+Inf / pow(u, 1/2) = +Inf`; rStats.js returns NaN and consumes no uniform.
- `rinvgamma()` similarly requires finite `alpha` and `beta`. extraDistr's R wrapper is `1 / rgamma(n, alpha, beta)`, where the third positional argument is the gamma rate. R 4.5.x `rgamma()` returns 0 for scale=0 (beta=+Inf), so the inverse-gamma draw is +Inf; for alpha=+Inf and finite beta, `rgamma()` returns +Inf and the inverse is 0. rStats.js rejects both inputs and returns NaN. These cases consume no uniforms in either implementation.
- Concrete reproductions (source-derived; not package-runtime executed):
  ```js
  setSeed(1);
  rkumar(1, 2, Infinity);                  // JS NaN, 0 uniforms; extraDistr 0, 1 uniform
  setSeed(1);
  rpareto(1, { a: 2, b: Infinity });       // JS NaN, 0 uniforms; extraDistr +Inf, 1 uniform
  setSeed(1);
  rinvgamma(1, 3, { beta: Infinity });     // JS NaN; extraDistr +Inf
  setSeed(1);
  rinvgamma(1, Infinity, { beta: 1 });     // JS NaN; extraDistr 0
  ```
- Reviewed `test/fixtures/rextradist.json`: current cases cover finite parameter values, valid shape with zero triangular scale, and invalid zero/negative Pareto/Laplace parameters; they do not cover positive infinite parameters for these functions.
- Source blobs: `extra.ts` `2e5d69e49dab41d9ae05164075051c7beb8e0dd5`; `gamma.ts` `76f1bbfcf99c0ead3efff7887131e7e142511f33`; `kumaraswamy.ts` `ae73aa5f4ac85b344ea32f626854693a50409563`; `pareto.ts` `fe44325a34f8ba48a1a8f1e6069852825310bf03`; `rextradist.json` `1b830949954493506f09f7b1d267d189a5d1aaaf`.
- Reference source blobs: CRAN extraDistr `kumaraswamy-distribution.cpp` `0e20af5f1e69c87cb6f3a2618903e05d4452b218`; `pareto-distribution.cpp` `fd21d1d94cb934a19ce4fefa6ef685e90b4d2f4d`; `inverse-gamma-distribution.R` wrapper `rinvgamma <- function(n, alpha, beta = 1) 1/rgamma(n, alpha, beta)`; R 4.5.x `src/nmath/rgamma.c` source for zero-scale and infinite-shape branches.
- Other reviewed algorithms: inverse-gamma reciprocal gamma scaling, Kumaraswamy/Pareto inverse transforms, triangular two-uniform min/max interpolation including overflow-width halving, Laplace exponential-plus-sign ordering, and arcsine inverse transform. No additional confirmed defect in this pass.
- Reviewed fixtures and source only; no Vitest, package runtime, or R process was executed.
- GitHub Issue: [#92](https://github.com/numero-uno-jpn/rStats.js/issues/92).
- No source code changed.
- Repository HEAD at audit: `02eff2d04ebd455944138775d77b4e4548f97a9f`.


## Audit #501 — `src/distributions/kumaraswamy.ts` and `src/distributions/pareto.ts` finite-parameter and endpoint follow-up

- Follow-up to #500: checked whether the positive-infinity handling difference also affected the d/p/q distribution functions. Both implementations use `valid(a, b) = a > 0 && b > 0 && Number.isFinite(b)`; `a = +Infinity` is explicitly treated as a limiting point mass, while `b) is required to be finite.
- The CRAN extraDistr C++ source for `dkumar/pkumar/qkumar` and `dpareto/ppareto/qpareto` only checks `a <= 0 || b <= 0` in the d/p/q parameter guards, so IEEE `+Inf` may flow into raw arithmetic. For example, `ppareto(2, a=2, b=+Inf)` follows the source's `x < b` branch and returns 0, while the corresponding JS call returns NaN; `qpareto(0.5, a=2, b=+Inf)` yields +Inf in the C++ formula but NaN in JS. `pkumar(0.5, a=2, b=+Inf)` and interior `qkumar` similarly flow through C++ arithmetic. These are not treated as confirmed defects: the documented parameter domain is positive real-valued parameters, and +Inf is not a finite real parameter; the JS code deliberately constrains the scale/location parameter b to finite values. The earlier #500 RNG observation remains a separate implementation-compatibility finding, not evidence that b=+Inf is a supported mathematical parameter for d/p/q.
- The explicitly supported `a=+Infinity` limiting cases were cross-checked against existing fixture coverage: `qkumar(0, Infinity, 1)` and `qpareto(0, Infinity, 1)` both have fixture expectation 1, and the JS quantile-boundary / point-mass branches are consistent with those expected values. The quantile endpoint order (`quantileBoundaries` before the a=Infinity branch) was reviewed; no new mismatch was isolated for supported finite b.
- Other reviewed conditions: `a,b = 0,-0,-Infinity,NaN`; support boundaries and ±Infinity x/q; p=0/1 and log-probability endpoints; lower/upper tails; tiny/subnormal positive shapes and scales; overflow in Pareto x/b and q reconstruction; Kumaraswamy `1-x^a` cancellation and reciprocal-shape overflow paths. Existing test source `test/extradist.test.ts` and fixtures `dkumar.json`, `pkumar.json`, `qkumar.json`, `dpareto.json`, `ppareto.json`, `qpareto.json` were inspected. Fixture inputs were not executed.
- Source blobs: `kumaraswamy.ts` `ae73aa5f4ac85b344ea32f626854693a50409563`; `pareto.ts` `fe44325a34f8ba48a1a8f1e6069852825310bf03`; `dpq.ts` `543eb6ceb3de7627a7562b035a931a88da424aa7`; `extradist.test.ts` `5332cb6b990488de0b1c2ffc6d16d57bb17706fc`; fixtures `dkumar.json` `c895606e0de9b1c4d6b2dc6a17ea1bf6b0a5da32`, `pkumar.json` `0614adc4d4e370a67efd4e690fca799c4d9dbb23`, `qkumar.json` `82eeef51e164c257b261dc9dcbd4d1d5681fe0cb`, `dpareto.json` `838236bf89572216c03bebcb034d0ded672e02b6`, `ppareto.json` `d4451044b62927c8774e9f3eb39ef2d15e6a8dd2`, `qpareto.json` `3def1cb9a655e0ddeb4f72d59e70d1dea3a8a91f`.
- Reference source blobs: CRAN extraDistr `kumaraswamy-distribution.cpp` `0e20af5f1e69c87cb6f3a2618903e05d4452b218`; `pareto-distribution.cpp` `fd21d1d94cb934a19ce4fefa6ef685e90b4d2f4d`.
- Source and fixture review only. No Vitest, package runtime, or R process was executed. No source code changed.
- No new GitHub Issue created.
- Repository HEAD at audit: `d451081f7c9380386bfee2fbcdeeb8284049da23`.


## Audit #502 — `src/random/r2dtable.ts` integer coercion and Patefield recurrence

- Rechecked the Patefield AS 159 cell-generation loop against R 4.5.x `src/library/stats/src/rcont.c::rcont2`: mode rounding, conditional probability at the mode, upward/downward probability ratios, alternating search order, underflow error, retry-uniform scaling, zero-remaining-block shortcut, last-column completion, and last-row completion. The JS loop follows the same recurrence and uniform-draw order in the reviewed paths; no independent recurrence defect was isolated.
- Confirmed one input-conversion defect: JS checks the original `n` against `0 <= n <= INT_MAX` before `Math.trunc(n)`. R 4.5.x first applies `as.integer(n)`, then checks the converted value. `IntegerFromReal` in R's `src/main/coerce.c` rejects values only when `x >= INT_MAX+1` or `x <= INT_MIN`, otherwise returns `(int)x` (truncation toward zero).
- Concrete reproduction:
  ```js
  r2dtable(-0.5, [1, 1], [1, 1]);
  // rStats.js: RangeError("invalid argument 'n'")
  // R 4.5.x: as.integer(-0.5) == 0; returns list()
  ```
  The same validation-order defect rejects `n=2147483647.5`, which R converts to `INT_MAX`; that upper-bound example is not practically allocatable but confirms the conversion boundary. `n=-1.1` and `n=2147483648` are outside R's integer conversion range and should remain invalid.
- Row/column margins already use `Math.trunc` before validation, matching R's conversion order; the inconsistency is isolated to `n`.
- Existing `test/fixtures/r2dtable.json` blob `c12c8b89aebf9ef0c3839070980dfbb6e49ce22e` contains integer `n) cases (0, 1, 5, 200) but no fractional `n). Existing `test/random.test.ts` blob `f849a51e7b3c89c639641cf0a231fc9989dcff81` invokes the fixture suite.
- Source blobs: rStats.js `r2dtable.ts` `8ccc84fc49823aa54db9eb23da7d7b3df00033f0`; test fixture `r2dtable.json` `c12c8b89aebf9ef0c3839070980dfbb6e49ce22e`; test harness `random.test.ts` `f849a51e7b3c89c639641cf0a231fc9989dcff81`.
- R source blobs: `src/library/stats/R/r2dtable.R` `a54e74da227a968f70b15788374ed24d05d60c0a`; `src/main/coerce.c` `ca7c584759d8d371360bbeb5c62af2c49bef4508`; `src/library/stats/src/rcont.c` `69e428fd97c4e7a88556773847ccc1cfd8cd3ebc`.
- Confirmed defect filed as GitHub Issue [#93](https://github.com/numero-uno-jpn/rStats.js/issues/93).
- Source and fixture review only; no Vitest, package runtime, or R process was executed. No source code changed.
- Repository HEAD at audit: `48b90d0d76de00abe5f5e18221892240c048b836`.


## Audit #503 — `src/random/sample.ts` size coercion and weighted-sampling boundary

- Continued the earlier partial audit of `sampleInt()` / `sample()`, checking argument conversion order against R 4.5.x and rechecking the shared sampling branches. Found one confirmed R-compatibility defect in `size` conversion.
- In `sampleInt1()`, the code rejects `size < 0` before `const k = Math.trunc(size)`. R 4.5.x `src/main/random.c::do_sample` converts size first: uniform sampling uses `asVecSize(sk)`, then checks `k < 0`; weighted sampling uses `asInteger(sk)`, then checks `k < 0`. Both conversion paths truncate toward zero.
- Concrete reproductions:
  ```js
  sampleInt(5, { size: -0.5 });
  // rStats.js: RangeError("size must be a non-negative number")
  // R 4.5.x: sample.int(5, size = -0.5) returns integer(0)

  sampleInt(5, { size: -0.5, prob: [1, 1, 1, 1, 1] });
  // rStats.js: RangeError("size must be a non-negative number")
  // R 4.5.x: weighted path converts asInteger(-0.5) to 0 and returns integer(0)
  ```
  The same applies to `size=-0.1` and `size=-0.9`; `size=-1.1` converts to -1 and is rejected in R. `sample()` inherits the same defect because it calls `sampleInt1(x.length, options)`.
- R source: `src/main/random.c` blob `9a86fad9f7715b3b4dee587037c365b2e82d1013`; `src/main/builtin.c::asVecSize` blob `3176bcc595a2705b0d810a5f23e1d477296ed2fe`; `src/main/coerce.c::IntegerFromReal` blob `ca7c584759d8d371360bbeb5c62af2c49bef4508`; `src/library/base/R/sample.R` blob `3b7346203bfffc9dc98595beaa6b44c6db203738`; `src/main/sort.c::revsort` blob `f69412b6854c885794e64f3b01a7198b16d9dfda` (heapsort/tie order rechecked).
- Existing `test/fixtures/rsample.json` blob `5dd1a59eaf2f04f054f483f76b9902b15a896521` contains integer sizes and no negative fractional size. Test dispatcher `test/helpers/randomCall.ts` blob `15a91dd9519ed393179422d1853107307a8b228e` passes fixture sizes directly to `sampleInt`.
- The replacement/no-replacement, rejection/rounding index, weighted cumulative selection, Walker alias threshold/partition, heapsort order, probability normalization, and large-n Set sampling paths were reviewed against R source and prior audit coverage (#396/#399); no additional independent defect was isolated in this pass.
- Confirmed defect filed as GitHub Issue [#94](https://github.com/numero-uno-jpn/rStats.js/issues/94).
- Source and fixture review only; no Vitest, package runtime, or R process was executed. No source code changed.
- Repository HEAD at audit: `f75245031c41aa5a58eeaac8bc809ee8dbce5a37`.


## Audit #504 — `src/random/rank.ts` Wilcoxon random statistics

- Additional review of the previously partially audited `rsignrank()` and `rwilcox()`, with the exact R 4.5.x C implementation and integer-rounding helper in view.
- `rsignrank`: R rounds `n) with `R_forceint` (normally `nearbyint`, ties to even), returns NaN for negative n and 0 for n=0, then adds rank i when `floor(unif_rand()+0.5)` is 1. JS `roundHalfEven`, negative/zero branches, one-uniform-per-rank loop and accumulation order match.
- `rwilcox`: R applies `R_forceint` to m/n, returns NaN for negative values, 0 if either is zero, then creates ranks 0..m+n-1, draws n indices by partial Fisher–Yates using `R_unif_index(k)`, and subtracts n(n-1)/2. JS follows the same selection/update/draw order. Its explicit `m+n <= 2147483647` guard is a safety boundary before typed-array allocation; R's C implementation casts m+n to int and allocates an int array, so out-of-range inputs do not have a reliable R result to match.
- Concrete fixture inputs inspected (not executed): `setSeed(27); rsignrank(10, 5)` expected `[4,0,15,7,10,2,0,7,9,6]`; `setSeed(28); rwilcox(10, 3, 4)` expected `[9,6,5,5,5,3,10,4,2,7]`; `setSeed(28); rwilcox(10, 0, 5)` expected ten zeros. Fixture `test/fixtures/rrank.json` blob `31fe6958bf457cfad61ee626440e0afc00f06dc4`, R 4.5.2 x86_64, contains 10 cases and post-draw uniform states.
- Source blobs: rStats.js `rank.ts` `4cfe69d81a9a6509c9dbac95b3000a2adfb57433`; `integer.ts` `007ee293d3df0d02b4a2a38cc72a2479c5a5e4f0`; `rng.ts` `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `common.ts` `be016a36e9f09f580462d2bf93e30ed6bad527c1`.
- R source blobs: `src/nmath/signrank.c` `2cb5f5ba66549ec0940867d1cd4883b5e4fe0f35`; `src/nmath/wilcox.c` `472e034b1c05198acb615f37e6cee4fb98b4516a`; `src/nmath/nmath.h` `acf7033dab03875b60f0c4e546439b7db8ea1947`; `src/main/RNG.c` was previously reviewed for `R_unif_index` in #495.
- Result: no new independent reproducible defect. No new Issue filed.
- Source and fixture review only; no Vitest, package runtime, Monte Carlo, or R process was executed. No source code changed.
- Repository HEAD at audit: `d9db3765f4fc9315238a12ecd215fce42b983b1c`.


## Audit #505 — `src/random/beta.ts` extreme-shape and noncentral-mixture follow-up

- Re-read the current implementation (blob `5371b478626066c291432ec2df4529953520f520`) against R 4.5.x `src/nmath/rbeta.c` (blob `045451e5213d0b0ad783f17000699525ea2f89ad`) and the R-level noncentral wrapper `src/library/stats/R/distn.R` (blob `2d49a95b0079e2e41a85a48cbdf8e2ece9d72192`).
- Reconfirmed the already-filed defect in Issue #30: the BB shortcut condition is `!(2*a*b < Infinity)`, which does not establish that both shapes are large. For `a=1.1,b=1e308), it consumes two uniforms and returns the beta mean for every draw. Exact source-derived reproduction: `setSeed(12); rbeta(5, 1.1, 1e308)` yields five copies of approximately `1.1e-308`; the seed affects only the consumed stream, not the returned values. The theoretical coefficient of variation is `sqrt(b / (a*(a+b+1)))`, approximately `1/sqrt(1.1)=0.953462589`, so replacing the random variate with its mean is not a valid approximation. This is the same defect already recorded in #30, not a new issue; the current source still contains the shortcut.
- Rechecked BC branch for `a<=1), including `a=Number.MIN_VALUE`, `a=1e-300`, `a=0.5), `b=1), `b=1e308), uniform values near 0/0.5/1, the `v_w_from__u1_bet` overflow cap, `k1/k2) setup, and rejection inequalities. No additional independent defect established by source analysis.
- Rechecked BB branch around the transition `a=1), just-above-one binary64 values, symmetric and highly asymmetric shapes, `alpha) and `2ab) overflow, cached constants after shape changes and swaps, and the two-uniform consumption in the overflow shortcut. No separate reproducible defect beyond #30 established.
- Rechecked noncentral beta path: R's wrapper explicitly constructs `X <- rchisq(n, 2*shape1, ncp=ncp)` and `Y <- rchisq(n, 2*shape2)`, then returns `X/(X+Y)`; JS uses the same chi-square mixture in ordinary ranges and a half-scaled gamma route when doubling a finite shape overflows. This special route is an intentional numerical extension for a region where R's degrees-of-freedom argument becomes infinite; not classified as a bug. Checked ncp=0, positive finite ncp, Poisson-zero mixture, zero shapes, both-zero case, and overflow-safe final ratio. The documented JS comment already notes the degenerate both-zero stream difference from R.
- Existing fixture `test/fixtures/rbeta.json` blob `866acacf6513f6a0406424961fd5176c73ad1e5d` has 47 R 4.5.2 cases: central shape grid up to 50, degenerate zero/infinite/negative shapes, one ncp=1.5 case, and three 20,000-draw summaries. Fixture inspected, not executed. Test harness `test/random.test.ts` blob `f849a51e7b3c89c639641cf0a231fc9989dcff81` applies continuous tolerance and checks the next uniform / summary.
- Related source blobs: `gamma.ts` `76f1bbfcf99c0ead3efff7887131e7e142511f33`; `rng.ts` `f527fd7018642205ef5870df8fcab8fc9e02aff1`; `common.ts` `be016a36e9f09f580462d2bf93e30ed6bad527c1`.
- Result: no new independent defect. Existing Issue [#30](https://github.com/numero-uno-jpn/rStats.js/issues/30) remains the applicable report; no duplicate Issue filed.
- Source and fixture review only. No Vitest, package runtime, R process, or Monte Carlo simulation was executed. No source code changed.
- Repository HEAD at audit: `d9db3765f4fc9315238a12ecd215fce42b983b1c`.


## Audit #506 — `src/distributions/multinomial.ts` weight normalization and support boundaries

- Rechecked `dmultinom()`'s sequential binomial factorization against R 4.5.x `src/library/stats/R/distn.R` (blob `2d49a95b0079e2e41a85a48cbdf8e2ece9d72192`). JS forms suffix weights in double-double, then evaluates each conditional binomial with Loader's `dbinomRawDD`; R normalizes `prob <- prob / sum(prob)` in ordinary double precision and uses the multinomial log-factorial formula.
- Reconfirmed existing Issue #24 remains in the current implementation: for `dmultinom([8e307,8e307],[0.5,0.5])`, the Loader denominator expression `2 * Math.PI * x * (nmx / n)` overflows in its left-to-right intermediate even though the final denominator is representable. The linear probability path therefore returns 0 instead of about `6.307831305050442e-155`. This is the same defect, not a new issue.
- Reconfirmed existing Issue #68 remains in the current implementation: for `dmultinom([1,0,0],[Number.MIN_VALUE,1.7e308,1.7e308],{log:true})`, the finite weight sum overflows, the common `2^-ceil(log2(K)) = 1/4` scaling turns the positive first weight into 0, and the subsequent zero-weight guard returns `-Infinity`. The mathematically finite log probability is approximately `-1454.8600559951694`. This is the same defect, not a new issue.
- Additional boundary review: K=0 and K=1; all-zero weights; `+0/-0` weights; one or more zero-weight categories with zero/positive counts; `x=[0,...,0]`; final positive-weight category; exact and mismatched `options.size`; finite probability weights whose sum overflows and is scaled by `2^-ceil(log2(K))`; weights near `Number.MIN_VALUE` and `Number.MAX_VALUE`; linear and log output; count sums approaching and exceeding the safe-integer range.
- Concrete inputs reviewed (not executed): `dmultinom([1,2,1],[0.2,0.5,0.3])`; `dmultinom([5,0,2],[0.5,0,0.5])`; `dmultinom([5,1,2],[0.5,0,0.5],{log:true})`; `dmultinom([1,1],[Number.MAX_VALUE,Number.MAX_VALUE],{log:true})`; `dmultinom([0,1],[Number.MAX_VALUE,Number.MIN_VALUE],{log:true})`; `dmultinom([8e307,8e307],[0.5,0.5])`; and the Issue #68 input above. The `[Number.MAX_VALUE,Number.MIN_VALUE]` pair does not overflow its sum; the ratio itself underflows to zero in ordinary binary64 division, as does R's `prob/sum(prob)` normalization, so it is not a separate JS/R discrepancy.
- Strict integer-count validation differs from R's internal `as.integer(x+0.5)` coercion for fractional counts, but the JS public contract explicitly requires non-negative integer counts; no defect filed for rejecting fractional inputs. JS also accepts count-valued Numbers beyond R's 32-bit integer-vector range; not treated as a defect in this pass.
- Test fixture `test/fixtures/dmultinom.json` blob `d15dc877b1851ba458e2a2f274b4989dca02ea90` (R 4.5.2, 31 cases) and `test/fixtures/rmultinom.json` blob `bc0d8f9fff0fe01792f2a6c5e5908b3a99bd26e4` (R 4.5.2, 2 cases) were inspected. Neither fixture was executed.
- Source blobs: `multinomial.ts` `5062beb4a7b75d3f2afae82fb732aefee2937b76`; `loader.ts` `798b92185091204205e77d1e8e81e4591e7d78c3`; `dd.ts` `1e377fb5795b4695ca7ad147b48b7ead850d2fe6`.
- Result: no new independent defect. Existing Issues [#24](https://github.com/numero-uno-jpn/rStats.js/issues/24) and [#68](https://github.com/numero-uno-jpn/rStats.js/issues/68) remain the applicable reports.
- Source and fixture review only; no Vitest, package runtime, or R process was executed. No source code changed.
- Repository HEAD at audit: `df48b4dfdad6fcf8572a64c8d32f528fe5d91094`.


## Audit #507 — `src/distributions/negbinomial.ts` underflow in the `mu` parameterization

- Reviewed `dnbinom1/dnbinomMu1`, `pnbinom1/pnbinomMu1`, `qnbinom1/qnbinomMu1`, the `fromProb/fromMu` constructors, Loader's `dbinomRawDD`, incomplete-beta CDF, upper-tail series, and discrete quantile refinement. Compared the relevant R 4.5.x sources: `src/nmath/dnbinom.c` blob `5eef498081a2d2db031d2084e215b114703ad743`; `pnbinom.c` blob `a6bc0a6d97b6d10977535437dcb01ec2f55bcb15`; `qnbinom.c` blob `2ba5554729b9eb39bcf0d9ffae303c0b59a89599`; `qnbinom_mu.c` blob `d1b8ca55fc698615f913d9db5d81391997ea7ab8`.
- Confirmed one mathematical accuracy defect in `fromMu()`: for finite positive parameters where `size/(size+mu)` is below the binary64 subnormal range, `ddDiv([size,0], sum)` returns a zero high part. `dnbinomRaw()` passes that into `dbinomRawDD()`, whose `p[0]===0` branch returns zero / `-Infinity` for a positive first count. The later size/(size+x) multiplier cannot restore the lost mass.
- Exact reproduction: `dnbinom(1, 1e-200, { mu: 1e200 })` and `dnbinom(1, 1e-200, { mu: 1e200, log: true })`. Here `size/(size+mu) ≈ 1e-400` underflows to zero. But for x=1, `P(X=1) = size * (size/(size+mu))^size * (mu/(size+mu))` is approximately `1e-200`, representable. High-precision mpmath evaluation: log probability `-460.51701859880913680359829093687284...`, probability `1.0000000000000000000000000000000000000000000000000000000000000000000000000000004214e-200`. Source-derived current result is 0 / `-Infinity`.
- This is not claimed as an R-output discrepancy: R 4.5.x `dnbinom_mu()` also forms `size/(size+mu)` in binary64 in its general branch and may have the same extreme-ratio limitation. It is a mathematical correctness finding for valid finite positive parameters; the JS code's double-double quotient cannot preserve a ratio below binary64 range even though the final PMF can be represented because the exponent `size` is tiny.
- Existing `test/nbinom.test.ts` blob `96d62d49501ff17f0145ed0acae2926dd808285e` and R 4.5.2 fixtures `dnbinom.json` `58bee7b6b5b188eb08e6d7de7a905b7f324e73ec`, `pnbinom.json` `9f098cf36c8aad7f8847ee5b1ece1ce612ab09c2`, `qnbinom.json` `fd73386f8a7085c9670120a4d87751fb392d0131` were inspected. The tests cover subnormal sizes and large counts but not the `mu/size) ratio in this reproduction. Fixtures were not executed.
- Related rStats.js source blobs: `negbinomial.ts` `6bf9bf9b9d8b05aa4828e33c4b2fb9b3ed5171c7`; `loader.ts` `798b92185091204205e77d1e8e81e4591e7d78c3`; `dd.ts` `1e377fb5795b4695ca7ad147b48b7ead850d2fe6`.
- Confirmed finding filed as GitHub Issue [#95](https://github.com/numero-uno-jpn/rStats.js/issues/95).
- Source and fixture review plus independent high-precision formula evaluation only. No Vitest, package runtime, or R process was executed. No source code changed.
- Repository HEAD at audit: `4620cc0b558345d6229b4064b164cf41f3eabf3d`.


## Audit #508 — `src/distributions/nbeta.ts` endpoint log-density overflow

- Continued the prior deep audit (#145/#307/#313), focusing on endpoint density formulas and the finite-parameter / overflowing-intermediate boundary.
- Confirmed an independent numerical defect in `dnbeta1()` at `x===1`, `b===1`: the mathematical density is `a + ncp/2`, but log mode evaluates `Math.log(a + mu)` after forming the sum in binary64. The sum may overflow although its logarithm is finite.
- Exact reproduction: `dnbeta1(1, 1.5e308, 1, 1.5e308, true)`. Inputs satisfy `validBeta`: all are finite and positive. `mu=7.5e307`; the mathematical endpoint density is `2.25e308`, beyond `Number.MAX_VALUE`, so linear mode should return `Infinity`; however, `log(2.25e308)` is finite (approximately `710.0071388583824`). Current source line 603 computes `Math.log(a + mu)`; `a+mu` becomes `Infinity`, so log mode incorrectly returns `Infinity`.
- Source: `src/distributions/nbeta.ts` blob `5c51760f6e136b80a77b4284da39c25b0ab8ed86`; endpoint branch lines 599–603. Existing `test/nbeta.test.ts` blob `b92e2218f99be7492e9a1cc620acde52808ce070` covers ordinary endpoint behavior but no finite-shape sum overflow case.
- The issue is specific to the log endpoint expression; the linear-mode `a+mu` returning Infinity is correct when the mathematical density is out of range. A scaled sum or log-sum-exp avoids the premature overflow.
- Confirmed finding filed as GitHub Issue [#96](https://github.com/numero-uno-jpn/rStats.js/issues/96).
- This is distinct from existing Issue #63 (`ncp=Number.MIN_VALUE` causing `mu=0` and `0 * -Infinity` in `leftTailLog`). Existing extreme-method dispatch and quantile paths were rechecked at source level; no additional independent finding isolated in this pass.
- Source and test inspection only; no Vitest, package runtime, or R process was executed. No source code changed.
- Repository HEAD at audit: `4620cc0b558345d6229b4064b164cf41f3eabf3d`.


## Audit #509 — `src/distributions/nt.ts` (追加境界監査)

- Repository HEAD: `4620cc0b558345d6229b4064b164cf41f3eabf3d`; source blob: `85763973f3f7a82d46ceee19a4dd0f8d8c275814`.
- #149 の全体監査と #328 の既存 Issue #66 を前提に、今回は未検査だった極端な有限値の演算順序と、分位点初期値のoverflow後のfallbackを追加確認した。
- `nearZero` は `(|t|/sqrt(a)) * hypot(...) * (|δ|+2)` の順で評価する。比がsubnormal域で0に丸められる場合、後続因子が大きくても積が0になる可能性はある。ただし検討した有限入力域では、そのときの正規CDFのlog値もbinary64で `-Infinity` となる領域と重なり、独立した有限出力の誤りを確定できなかった。
- `farLimit(a,δ)` は大きな有限値でInfinityになり得る。これは #328 の `pt(Number.MIN_VALUE, 1e4, {ncp:1.7e308, logP:true})` で既に問題化した経路であり、Issue #66 と重複するため再起票しない。
- `qnt1` の正規近似初期値は `ncp*ncp` がoverflowし得るが、非有限または符号不一致なら `sideStart()` に切り替わる。`qt(0.975,1e180,{ncp:1e160})` はそのfallback経路の境界確認用入力として特定した（runtime未実行）。
- 追加確認した端点・極限入力: `pt(0, Number.MIN_VALUE, {ncp:1e308, logP:true})`（q=0の厳密な正規CDF分岐）、`dt(1e308,1e180,{ncp:-1e308,log:true})`（正規化引数が有限範囲外となる密度極限）。
- 結果: 既存 Issue #66 以外の新規欠陥は確定せず。これはソース制御フローとIEEE-754演算範囲の追加レビューであり、実行再現ではない。Vitest、package runtime、R実行なし。ソース変更なし。


## Audit #510 — `src/integrate/quadpack.ts` (追加数値境界監査)

- Repository HEAD: `3091a616603418d12948afb2aa9f09582ad5c20c`; source blob: `3aef9054b78a50c5ab55ed22008db69c56535d4c`; test blob: `3f37685e28b6db47c8b940ba25a03b47bcbf2bbf`.
- #218/#385/#388で確認済みの有限区間midpoint overflow（Issue #51）を重複起票せず、今回はQUADPACK内部のrule/error estimate、無限区間変換、extrapolation table、error orderingと小さいlimitを追加レビューした。
- `dqk21` のK21節点は奇数indexをGauss 10点、全11節点をKronrod 21点に用い、`dqk15i` はK15I/G7の偶数index対応を保持している。重みと節点の配列index、中央点の重み、左右対称点の加算、`resabs`/`resasc`の区間長スケーリングを照合した。
- `dqk15i` は `x=boun+dinf*(1-t)/t` の変換に対し、`f(x)/t²`（両側無限区間では `f(x)+f(-x)`）を積分する。実装の逐次除算 `/t/t` は、`t*t` の先行underflowを避ける演算順序で、Jacobianの符号は積分方向ではなく `inf` の写像側に含まれる。`inf=-1,1,2` の向きと両側neval係数を追跡した。
- `dqelg` の `epstab` sentinel、even/odd shift、`limexp=49` の縮小、`res3la` の初回3回のOFLOW error estimateはQUADPACKの制御フローに沿う。`dqpsrt` は `last<=2` の特別処理と、limit/2を境にした保持可能な誤差順位の上限を追跡した。
- `limit=1` は初回ruleを返してier=1、`limit=2` は最初の二分割後にier=1となる。`dqagse` の逆向き区間は `hlgth<0` により積分符号を反転し、error estimateは絶対値で保つ。public `integrate()` は `upper-lower` がoverflowする有限区間を2で割った変数に写してから呼ぶが、同符号大端点での `0.5*(a+b)` overflowは既知Issue #51の範囲に残る。
- 具体的な境界入力（ソース経路の検討用で、実行していない）: `dqagse(x=>x*x,0,1,1e-10,1e-10,1)`、`dqagse(x=>x*x,1,0,1e-10,1e-10,2)`、`dqagie(x=>Math.exp(-x),0,1,1e-10,1e-10,100)`、`dqagie(x=>Math.exp(-x*x),0,2,1e-10,1e-10,100)`、`dqagie(x=>Math.exp(x),0,-1,1e-10,1e-10,100)`。
- 結果: Issue #51以外の新しい独立した不具合は確定せず。既存 `test/integrate/quadpack.test.ts` とSciPy比較fixtureのテスト設計を閲覧したが、fixture/Vitest/package runtime/Rは実行していない。ソース変更なし。


## Audit #511 — `src/special/igam.ts` incomplete-gamma series, continued fractions, and Temme expansion

- Repository HEAD: `11c0929e4cb26fd8c5b9ace3198c507f65df836e`; source blob: `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620`.
- Reviewed both public internal paths `gammaInc()` and `gammaIncBoth()`, including their shared regime boundaries and the log/linear complement construction.
- Series review: checked `igamSeriesSum()` ratio and stopping rule; the large-`a`, `x > 0.97a` double-double recurrence in `igamSeriesSumDD()`; recovery of the low part of `a+i`; the `2^-64` omitted-tail bound; and `igamcSeries()` cancellation for small `a)/small (x). The `A_SUB=1e-300` upper-tail rescaling branch avoids the most severe subnormal-`a` cancellation.
- Continued-fraction review: checked the Cephes numerator/denominator recurrence, simultaneous rescaling by `BIGINV`, zero-denominator handling, and the switch to modified Lentz for `x > 1e20`. In the region where the recurrence is retained, the asymptotic/Temme dispatch prevents the near-`x=a` huge-parameter case from entering the unstable continued fraction. The Lentz initialization and update equations match the standard incomplete-gamma continued fraction.
- Temme review: checked `xsfAsymptotic()` and `farAsymptotic()` dispatch regions, signed `eta), the `log1pmx` small-relative-difference path, coefficient-power reuse and least-term truncation in `temmeSum()`, the `bd0dd(a,x)` exponent, and the erfcx-based small-tail reconstruction in `temmeTail()`. At `x=a), the correction sign is consistent with (P(a,a)>1/2); on either side the sign convention selects the smaller tail.
- Complement/log review: checked that the directly computed smaller tail is selected, that the opposite log tail uses `log1p(-v)` when the linear complement is available, and that the `-exp(log(v))` fallback is used when the linear value underflows. `gammaIncBoth()` follows the same branch decisions and returns both representations from one direct-tail evaluation.
- Concrete boundary inputs inspected at source level: `gammaInc(0.5, 5e-324, true, true)`; `gammaInc(1e-310, 1, false, true)`; `gammaInc(1e-300, 1.1, false, true)`; `gammaInc(1000, 970, true, true)`; `gammaInc(1e12, 1.0011e12, false, true)`; `gammaInc(1e20, 1e20 + 4.5e10, false, true)`; `gammaInc(1e300, 1e300, true, true)`; `gammaInc(1e300, 1.001e300, false, true)`; and `gammaInc(1, 1e20, false, true)`. These are targeted control-flow/binary64 boundary probes, not claimed runtime outputs.
- Reviewed `test/gamma.test.ts` blob `db75474bb21ad3531f9ae071cffa359023e1af37`; R 4.5.2 fixture `test/fixtures/pgamma.json` blob `bbfde310b6ca200dcbfab9cb5fa5557c0eb123f8`; mpmath 1.4.1 fixtures `gammainc.mpmath.json` blob `bc2959d57f125847faab1509253ac64a3a4e07e4`, `gammainc_regions.mpmath.json` blob `31984062322f6d4308bfb8352c44afc07cb3c389`, and `audit_pgamma.mpmath.json` blob `76adf21a0ff81ed17732d5adcfb1a67e0ea62d4c`. Fixture contents were inspected, not executed.
- Related source blobs: `src/special/log1pmx.ts` `2645eccad6849a9c217899b99e71e58d6e7055f8`; `src/special/loader.ts` `798b92185091204205e77d1e8e81e4591e7d78c3`; `src/special/igamAsympCoeff.ts` `303c31a00d04790f242125345c8a1d6e984b0774`.
- Result: no new independent defect established in this pass; no Issue filed. In particular, the large-`x) continued-fraction overflow path and the small-`a) upper-tail cancellation safeguards are explicitly present in the current source.
- Source and fixture inspection only. No Vitest, package runtime, R process, or independent high-precision execution was performed. No source code changed.


## Audit #512 — `src/special/igami.ts` inverse-gamma starting values and safeguarded quantile inversion

- Repository HEAD before this audit: `636b501bc3f14320c57cac9efb12e393879c5ee4` (Audit #511 ledger commit); source blobs: `igami.ts` `008fc2b262eaa649093211a40e9d7fdd83facdcf`, `invert.ts` `54aeaa15ec93053e2dd5fd19fc640a9fbf243a76`.
- Reviewed DiDonato–Morris starting-value branches for (a<1), (a=1), and (a>1): Eqs. 21–25, 31–36; the (b=q\Gamma(a)) transition thresholds; the (p>0.5) upper-tail correction; and the large-(a) normal/central approximation shortcut.
- Checked the small-shape interaction with `logTinyGammaQuantile()`: positive subnormal and very small shapes are intercepted in log space before `findInverseGamma()` can rely on an overflowing `gamma(a)). For the remaining (a<1) domain, the `b) thresholds and alternate `exp(-q/a-EULER)` path avoid the problematic direct product when (q) is small.
- Reviewed `invertContinuous()` residual selection with linear and log targets, `cdfBoth` reuse, monotonic bracket updates for both tails, Newton/Halley step safeguards, convergence/stuck handling, log-coordinate polishing, and `bisectX()` bit-pattern bisection. Checked the positive-support transformations and the subnormal-density fallback used during polishing.
- Concrete boundary inputs traced through the source (not executed): `qgamma(0.9, 1e200)`; `qgamma(0.75, 1e145)` (also referenced in the inversion comments as a prior precision case); `qgamma(0.5, Number.MIN_VALUE)`; `qgamma(2e-5, 1e-310, { lowerTail: false })`; `qgamma(1e-300, 0.5, { logP: true })`; and `qgamma(1 - 1e-12, 500, { lowerTail: false })`. These were used to trace initialization, branch selection, and representability boundaries; no numerical output is claimed.
- Reviewed `test/gamma.test.ts` blob `db75474bb21ad3531f9ae071cffa359023e1af37`, R 4.5.2 fixture `test/fixtures/qgamma.json` blob `47d054f6330d83ab05bb9d66576f229abe8cc72f`, and mpmath 1.4.1 fixture `test/fixtures/auditq_qgamma.mpmath.json` blob `b203789176ebf35698003fec38bdfdf53dfacc8b`. Fixture contents were inspected, not executed.
- Result: no new independent defect established; no Issue filed. The review found no confirmed failure in the inverse-starting-value branch selection or the safeguarded inversion path. Extreme-shape quantiles where the distribution width is below one ulp remain intrinsically limited by binary64 representability; this pass did not establish a source defect there.
- Source and fixture inspection only. No Vitest, package runtime, R process, or independent high-precision execution was performed. No source code changed.


## Audit #513 — `src/htest/pwr.ts` effect-size helpers and power/root boundary follow-up

- Repository HEAD before this audit: `321716056fe0956eba23a1f241174827bd7f335a`; source blob: `a9f7c6f320272cfb00ed2704084507bc16861367`; test source: `test/pwr.test.ts`.
- Rechecked `cohenES` choice validation and lookup, `esH` arcsine endpoints, `esW1` zero expected cells, `esW2` empty rows/columns and column-major accumulation, and the shared probability/unknown/effect-size validation.
- Re-traced all power calculations: one-/two-sample/paired t; two-proportion, one-proportion and normal tests; unequal-size two-proportion; correlation; chi-square; balanced ANOVA; and general linear-model F. Checked rejection-tail orientation for less/greater/two-sided alternatives, noncentrality formation, df construction, and the explicit noncentrality-overflow limits in chi-square/ANOVA/F2.
- Rechecked each exactly-one-unknown path and its solve interval, including minimum sample sizes/df, zero effect sizes, zero significance/power endpoints, and the upper/lower effect-size intervals for one-sided alternatives. The root intervals are intentionally finite and do not claim solutions outside the pwr package's documented search intervals.
- Concrete source-trace inputs: `esH(0,1)`; `esW1([0,0],[0,0])`; `esW1([0,1],[0.2,0.8])`; `esW2([[0,0],[0,0]])`; `pwrTTest({n:2,d:0,sigLevel:0.05})`; `pwrTTest({n:20,d:0.5,alternative:"less"})`; `pwrT2nTest({n1:2,n2:2,d:0})`; `pwr2pTest({n:1,h:0})`; `pwrRTest({n:4,r:0})`; `pwrChisqTest({df:1,w:0,N:1})`; `pwrAnovaTest({k:2,n:2,f:0})`; and `pwrF2Test({u:1,v:1,f2:0})`. These are branch/contract probes traced against the current source; no numerical runtime output is claimed.
- Reviewed the existing `test/pwr.test.ts` R-oracle comparison harness and its explicit known-difference annotations for R's noncentral-t/noncentral-F precision. No new independent defect was established and no duplicate Issue was filed.
- Source and test inspection only. No Vitest, package runtime, or R process was executed. No source code changed.


## Audit #514 — `src/data/grouping.ts` unsafe output-column assignment for `__proto__`

- Repository HEAD before this audit: `95758791dd47786fc0bf4f8a0c9e62c56231f0cd`; source blob: `9bfc9a90424acc9766c599026273a2902e50dfe8`; test blob: `e4d9f65aef100b10275d787e7ccba8073f44126d`.
- Confirmed defect: output data frames are initialized as ordinary `{}` objects and populated by assignment using caller-controlled column names. The special own-property name `"__proto__"` invokes the legacy prototype setter rather than defining an own enumerable property, losing the column and changing the returned frame's prototype.
- Affected code paths: `rowsOf()` lines 191–196 (`split(dataFrame, ...)`); grouping-column construction in `aggregateRows()` lines 323–329; and summary `setColumn()` lines 331–354. The latter has an `Object.hasOwn` duplicate check but still uses unsafe assignment for the new column.
- Concrete reproduction data:
  ```ts
  const data: Record<string, number[]> = {};
  Object.defineProperty(data, "__proto__", { value: [10, 20], enumerable: true, configurable: true });
  const result = split(data, ["a", "b"]);
  // Each result frame should own "__proto__"; rowsOf() instead changes its prototype.

  const by: Record<string, string[]> = {};
  Object.defineProperty(by, "__proto__", { value: ["a", "b"], enumerable: true, configurable: true });
  const aggregated = aggregate({ y: [1, 2] }, by, (v) => v.length);
  // The grouping column "__proto__" is absent as an own property.
  ```
- Classification: reproducible correctness/data-loss bug for valid JavaScript data-frame column names; not described as a JSON-only remote prototype-pollution vulnerability. The repository already uses `Object.defineProperty` in `addColumn()` in `src/descriptive/dataFrames.ts` to handle this property safely.
- Filed non-duplicate Issue #97: https://github.com/numero-uno-jpn/rStats.js/issues/97
- Suggested remediation: use a safe own-property definition helper consistently for all data-frame output columns (or a null-prototype output object if compatible with the public API), and add regression tests for split and aggregate.
- Source/test inspection and language-semantics trace only; no package runtime or Vitest execution was performed. No source code changed.


## Audit #515 — `src/internal/seq.ts` invalid `length.out` values silently become empty sequences

- Source blob: `7475913bf7aaa85ca90a1a52dcf620990cd18e00`.
- Confirmed defect: `seqLength()` applies `Math.ceil(n)` and passes the result to `Array.from({ length: len })` without validating it. ECMAScript's array-like length conversion maps negative values and `NaN` to zero, so invalid length requests silently return `[]`.
- Concrete reproductions:
  ```ts
  seqLength(0, 10, -1);   // actual: []
  seqLength(0, 10, -0.1); // actual: []
  seqLength(0, 10, NaN);  // actual: []
  seqLength(0, 10, 0);    // valid empty result, if zero length is supported
  seqLength(0, 10, 2.1);  // documented ceil behavior: length 3
  ```
- This loses the distinction between invalid negative/NaN length requests and a legitimate zero-length sequence. The function explicitly claims compatibility with R's `seq(from, to, length.out = n)`; negative and NaN `length.out` are invalid in R.
- Filed non-duplicate Issue #98: https://github.com/numero-uno-jpn/rStats.js/issues/98
- Suggested remediation: validate `n` before allocation, reject non-finite and negative values deliberately, preserve documented positive fractional rounding, and test negative, NaN, zero, and positive fractional lengths.
- Static source and ECMAScript length-coercion analysis only; no R runtime, package runtime, or Vitest execution was performed. No source code changed.


## Audit #516 — covariance-matrix symmetry check can lose subnormal entries

- Reviewed `src/internal/covmat.ts` (blob `a042245164638b0c486c769de2c2a9a0eed622cd`), `src/linalg/eigen.ts` (`86ee78a9fd9f3edbbc35e86f3805ea910e15ff18`), `src/linalg/matrix.ts` (`9d78a4c9ae28f2fcc55ea30b5a7297c7441f2eaf`), and `src/internal/summary.ts` (`e4fc3bd652af3a00cf05b44389ddf58e590c4830`).
- Confirmed defect: `checkCovmat()` applies `scaleToUnit(S)` to the entire matrix before `isSymmetric()`. For a matrix with a sufficiently wide dynamic range, a nonzero subnormal off-diagonal entry underflows to zero, erasing asymmetry before validation.
- Exact reproduction data:
  ```ts
  const S = [
    [1e308, Number.MIN_VALUE],
    [0,     1]
  ];
  checkCovmat(S); // currently does not throw
  ```
  `Number.MIN_VALUE` is `5e-324`. The maximum magnitude is about `1e308`, so the scaling exponent is `1023`. Scaling the upper-right entry by `2^-1023` produces zero. `isSymmetric()` therefore receives a matrix whose off-diagonal entries are both zero, although the original matrix is asymmetric.
- This violates the documented finite/symmetric/positive-diagonal validation contract and can let downstream consumers accept a matrix whose triangles disagree.
- Filed non-duplicate Issue #99: https://github.com/numero-uno-jpn/rStats.js/issues/99
- Suggested direction: use a scale-safe pairwise comparison that cannot erase a small transposed entry through global scaling; add regression tests for the exact matrix and its transpose.
- Static source and IEEE-754 path analysis only. No Vitest, package runtime, R process, or independent numerical execution was performed. No source code changed.


## Audit #517 — `src/internal/fround.ts` `zapsmall()` produces NaNs for `digits = Infinity` with infinite matrix entries

- Source blob: `src/internal/fround.ts` `8e42f6ab4bc1d61fcd7687129efdc57edc942224`.
- Confirmed defect: `zapsmall()` calculates `d = Math.max(0, digits - Math.log10(mx))` when `mx > 0`. For `digits === Infinity` and `mx === Infinity`, this is `NaN`. It then calls `roundR(v, NaN)` for every matrix entry; `roundR()` explicitly returns `NaN` when `digits` is NaN, so the entire result becomes NaN.
- Exact reproduction:
  ```ts
  zapsmall([[1, Infinity]], Infinity);
  // current result: [[NaN, NaN]]
  ```
- R's R 4.6.0/4.6.1 NEWS documents this exact border case (`zapsmall(x, digits=Inf)` with an `Inf` entry) as fixed to return `x`, not all NaNs. This establishes a compatibility defect against current R; no claim is made about older R versions' behaviour.
- Filed non-duplicate Issue #100: https://github.com/numero-uno-jpn/rStats.js/issues/100
- Suggested remediation: special-case positive infinite `digits` before the shared-precision calculation (return a copy of the input matrix); add tests for finite and infinite entries, including `-Infinity` and NaN.
- Static source analysis and R NEWS comparison only. No Vitest, package runtime, or R process was executed. No source code changed.


## Audit #518 — `src/internal/fround.ts`

- Repository HEAD: `144d85bcade194c1c6c4cf2dae30a1e6304bb135`; source blob: `8e42f6ab4bc1d61fcd7687129efdc57edc942224`.
- Reviewed `roundR` validation/early returns, fractional and negative digit handling, half-even integer rounding, binary exponent estimation, the 15-significant-digit shortcut, positive/negative decimal scaling, the >308 digit branch, candidate-distance comparison and `zapsmall` matrix-wide precision selection. Also checked R Core source: `src/nmath/fround.c` and `src/main/arithmetic.c`.
- Confirmed defect: `powerOf10(k)` uses repeated multiplication, while R's `fround` calls `R_pow_di(10., dig)`, whose implementation uses exponentiation by squaring. For (k=100), the binary64 results differ: current JS `1.0000000000000006e+100`, R algorithm `1.0000000000000002e+100`. This changes an actual rounded value. Exact reproduction: `roundR(4.202163187357369e-87, 100)` currently returns `4.202163187357397e-87`; following R's `R_pow_di` path returns `4.202163187357399e-87`. Input binary64 hex: `0x1.0b7fa925827cbp-287`; the significant-digit shortcut does not trigger (`log10(|x|)+100 ≈ 13.7549062)).
- Issue: [#101](https://github.com/numero-uno-jpn/rStats.js/issues/101).
- Rとの関係: R Coreの現行Cソースとのアルゴリズム照合。R側の出力は公開C実装をbinary64で追跡して算出し、この監査ではR実行ファイルによる直接照合は未実施。
- 検証範囲: ソース静的解析と独立binary64計算のみ。Vitest/package runtime/R実行なし。ソース変更なし。


## Audit #519 — `roundR()` negative-digit scaling (same root cause as #518)

- Revisited `src/internal/fround.ts` (blob `8e42f6ab4bc1d61fcd7687129efdc57edc942224`) after Audit #518, focusing on negative decimal places and reciprocal scaling.
- Confirmed a second exact manifestation of the same `powerOf10` mismatch: for negative `dig`, JS computes `1 / powerOf10(-dig)`, where the positive power is built by repeated multiplication. R's `R_pow_di(10., dig)` computes the positive integer power by exponentiation by squaring and then takes its reciprocal.
- Exact reproduction:
  ```ts
  roundR(3.720925911927848e25, -25);
  // current: 3.9999999999999995e25
  // R R_pow_di path: 4e25

  roundR(-3.720925911927848e25, -25);
  // current: -3.9999999999999995e25
  // R path: -4e25
  ```
  Input binary64: `0x1.ec75dfa8b17cbp+84`. For (10^{25}), repeated multiplication gives `0x1.08b2a2c280290p+83`, while the R squaring algorithm gives `0x1.08b2a2c280291p+83`; their reciprocals lead to different sides of the integer boundary after scaling.
- This is **not a separate issue**: it is the negative-digit manifestation of Audit #518's root cause and is recorded in the existing Issue #101 discussion: https://github.com/numero-uno-jpn/rStats.js/issues/101.
- Rとの関係: `src/nmath/fround.c` and `src/main/arithmetic.c` current R Core source inspected; the R path was simulated with binary64 operations, not run in an R executable.
- 検証範囲: exact binary64 reproduction and static C/TypeScript algorithm comparison. No Vitest, package runtime, or R execution. No source changes.


## Audit #520 — `src/internal/fround.ts` candidate-distance comparison and half-even boundary follow-up

- Repository HEAD before this audit: `d706236ca31d172032e783695b9adbd129a7e1a2`; source blob: `8e42f6ab4bc1d61fcd7687129efdc57edc942224`.
- Re-reviewed the complete `roundR()` candidate construction and tie decision, focusing on `xd`, `xu`, `du = xu - ax`, `dd = ax - xd`, and `i10 % 2`. Also checked the current R Core `src/nmath/fround.c` and `src/main/arithmetic.c` source. R's `fround()` uses the same candidate formulas, the same binary64 distance subtraction/comparison order, and the same exact-tie parity rule (expressed as `fmod(i10, 2.) == 1`). `R_pow_di()` uses exponentiation by squaring, consistent with the already-filed #101 discrepancy.
- Boundary probes traced at source level: `roundR(1.25, 1)` (decimal midpoint with even lower candidate); `roundR(1.35, 1)` (decimal midpoint whose binary64 distance subtractions need not be exactly equal); `roundR(-1.25, 1)` (sign symmetry); `roundR(2.5, 0)` and `roundR(-3.5, 0)` (integer half-even); `roundR(1.234567890123456, 0)` (large-magnitude integer rounding); and `roundR(1.234567890123456e-308, 323)` (the high-digit scaling branch). These are branch probes, not claimed runtime outputs.
- The `i10` parity test is not exposed to the >2^53 integer-parity failure in the active rounding region: the preceding `l10x + dig > DBL_DIG` shortcut bounds the scaled magnitude to approximately 15 decimal digits, well below the binary64 consecutive-integer limit. The exponent-derived `l10x` is coarse, but its maximum slack does not raise this bound near 2^53.
- Result: no new independent defect established in candidate-distance comparison or half-even tie handling. Decimal midpoints can have unequal computed `du` and `dd` because the source values and subtractions are binary64; this is not a JS/R divergence because R uses the same arithmetic sequence. The distinct scaling mismatch from repeated multiplication remains covered by Issue #101 and is not duplicated.
- Rとの関係: current R Core C source inspected directly; the relevant candidate comparison is algorithmically identical. No R executable was run.
- 検証範囲: complete `fround.ts` static review, R C source comparison, and binary64 range reasoning. No Vitest, package runtime, or R execution. No source code changed.


## Audit #521 — `src/internal/integer.ts` R-compatible integer tolerance and half-even coercion

- Source blob: `src/internal/integer.ts` `007ee293d3df0d02b4a2a38cc72a2479c5a5e4f0`.
- Reviewed `nonInt()` and `roundHalfEven()` for exact positive/negative half-integers, signed zero, subnormal inputs, values around the binary64 integer-precision boundary, NaN, and infinities. Traced their use in `dhyper`, `dnbinom`, and `dpois` callers to check whether non-finite values are subsequently rejected.
- Compared the tolerance expression against current R Core `src/nmath/nmath.h`: R defines `R_nonint(x)` as `fabs(x - R_forceint(x)) > 1e-9 * fmax2(1., fabs(x))`, and `R_forceint` uses `nearbyint(x)` when available. The TypeScript `nonInt()` uses the same tolerance and a half-even implementation. The R comment records this tolerance as introduced in R 4.4.0.
- Compared the half-even implementation with `nearbyint`: the `Math.round` adjustment corrects only exact half cases whose rounded result is odd; negative halves and negative zero are handled consistently with ties-to-even. For magnitudes where binary64 cannot represent fractional parts, both implementations naturally receive integral values.
- Concrete boundary inputs traced: `nonInt(2 + 1.1e-9)`; `nonInt(2 + 2e-9)`; `nonInt(1e9 + 0.5)`; `nonInt(1e12 + 100)`; `nonInt(Number.MIN_VALUE)`; `nonInt(-0.5)`; `roundHalfEven(4.5)`; `roundHalfEven(5.5)`; `roundHalfEven(-4.5)`; `roundHalfEven(-5.5)`; `roundHalfEven(-0.5)`; `roundHalfEven(Number.MAX_VALUE)`; `roundHalfEven(Infinity)`; and `roundHalfEven(NaN)`. These are source-level edge probes, not claimed runtime outputs.
- The apparently large tolerance for large-magnitude values (e.g. `1e9 + 0.5`) is not a TypeScript divergence: it follows the same relative tolerance explicitly used by R 4.4.0 and later. Call sites reviewed either reject non-finite inputs explicitly or pass through the same integer-parameter validation path.
- Result: no new independent defect established. No Issue filed.
- Rとの関係: direct comparison with current R Core `nmath.h` and `dhyper.c`; no R executable was run.
- 検証範囲: complete source file, principal distribution call sites, and R C macro comparison. No Vitest, package runtime, or R execution. No source code changed.


## Audit #522 — `src/internal/levels.ts` numeric factor-level canonicalization

- Source blob: `src/internal/levels.ts` `949b2f498a93c9c17bc50a4f2e74c1eef86a0d22`; formatter dependency `src/htest/core/simulate.ts` blob `add88d8966ad2c2be9a3ef97b8b73c6988334055`.
- Reviewed numeric deduplication and ordering, signed-zero normalization, NaN filtering, infinities, 15-significant-digit text collisions, Map key semantics, and the assumption that equal formatted values are contiguous after numeric sorting. Reviewed `formatR()`'s fixed/scientific selection and its 15-digit conversion.
- Concrete inputs traced: `numberLevels([0.1 + 0.2, 0.3])`; `numberLevels([1e15, 1e15 + 1])`; `numberLevels([-0, 0])`; `numberLevels([NaN, NaN, Infinity, -Infinity])`; `numberLevels([1e-4, 1.2e-4, 1.2345678901234567])`; and `numberLevels([Number.MIN_VALUE, 2 * Number.MIN_VALUE])`. These are static branch probes, not claimed runtime outputs.
- The numeric sort comparator can return NaN for equal infinities (`Infinity - Infinity)); ECMAScript sort treats a NaN comparator result as +0, which is the required equality ordering for those equal values. NaNs are removed before sorting and signed zero is normalized before Set/Map handling.
- `formatR(Infinity)` returns JavaScript's `"Infinity"` internally rather than R's `"Inf"`; this does not create a numeric-level collision defect because all positive infinities share the same internal key and `levelText()` separately emits R's `"Inf"` for label text. No observable failure was established from this distinction in the reviewed paths.
- Result: no new independent defect established. No Issue filed.
- Rとの関係: implementation intent is R `factor()`/numeric `as.character()` compatibility; reviewed the local 15-digit formatter and documented examples. No R executable or independent R formatter comparison was run in this pass.
- 検証範囲: complete `levels.ts` and `formatR()` source review, ECMAScript sorting/Map semantics, and explicit edge-input tracing. No Vitest, package runtime, or R execution. No source code changed.


## Audit #523 — `src/internal/discrete.ts` initial bracketing overflow bypasses the finite-maximum guard

- Source blob: `src/internal/discrete.ts` `a8ed86222a9c91b7dfea90b990244a81c1170194`.
- Confirmed control-flow defect in `discreteQuantile()`: when the initial `good = y + step0` overflows directly to `Infinity`, and the monotone predicate is true at `Infinity`, the `while (good <= hi && !ok(good))` body is skipped. The `Number.MAX_VALUE` fallback is located inside that body, so it is bypassed. `bisect(y, Infinity, ...)` cannot form a finite midpoint and returns `Infinity` even when the predicate first becomes true at the largest finite double.
- Exact deterministic reproduction data:
  ```ts
  const M = Number.MAX_VALUE; // 1.7976931348623157e+308
  const ulp = 2 ** 971;       // 1.99584030953472e+292
  const y0 = M - ulp;         // 1.7976931348623155e+308
  const step0 = Math.max(1, Math.abs(y0) * Number.EPSILON);
  // step0 = 3.9916806190694387e+292; y0 + step0 === Infinity

  discreteQuantile({
    p: 0.5,
    lowerTail: true,
    logP: false,
    cdf: (y) => y >= M ? 1 : 0,
    y0,
    lo: 0,
    hi: Infinity
  });
  // Current control flow: Infinity
  // Expected first representable satisfying point: Number.MAX_VALUE
  ```
- This is the same overflow/bracketing family as existing Issue #53 (`firstTrue()` can return Infinity with a finite threshold); no duplicate Issue was created. Issue #53's current description says `discreteQuantile()` has an overflow guard, but this audit finds that the guard does not cover an initial `good` that is already Infinity. An attempt to add a detailed comment to #53 was blocked by the GitHub write tool, so this additional reproduction is preserved here in the ledger.
- Affected public path likely includes `qpois1()` and `qnbinom1()`, both of which call `discreteQuantile()` with `hi: Infinity`; exact public-distribution runtime reachability was not established in this pass. The helper-level monotone-predicate contract reproduction is deterministic.
- Suggested remediation: when the initial upper candidate is `Infinity` and `hi === Infinity`, test `Number.MAX_VALUE` before bisection, mirroring the existing later-overflow branch; if it satisfies the predicate, use it as the finite good endpoint.
- Rとの関係: R's `qDiscrete_search.h` uses a coarse stepping search and returns the previous finite point when the next increment overflows to a satisfying endpoint. The R source was inspected; no R executable was run and no exact public qpois output is claimed.
- 検証範囲: complete `discrete.ts` source review, direct IEEE-754 arithmetic for the exact values above, and R Core search-source comparison. No Vitest, package runtime, or R execution. No source code changed.


## Audit #524 — `firstTrue()` cannot represent its documented `hi + 1` sentinel above the safe-integer range

- Source blob: `src/internal/discrete.ts` `a8ed86222a9c91b7dfea90b990244a81c1170194`.
- Follow-up review of `firstTrue()` and `lastTrue()` call sites in `src/htest/binomTest.ts`. `lastTrue()` is called with the finite nonnegative interval `[0, floor(n*p)]`; its midpoint arithmetic does not encounter the negative-to-positive overflow scenario. `firstTrue()` is called with `[ceil(n*p), n]`.
- Distinct helper-contract edge case: the documented no-match return is `hi + 1`, but for sufficiently large finite `hi`, adding one is not representable. Exact input:
  ```ts
  const hi = 2 ** 54; // 18014398509481984
  hi + 1 === hi;      // true in binary64

  firstTrue(() => false, 0, hi);
  // Current result: 18014398509481984 (hi)
  // Documented no-match sentinel: hi + 1, but that value collapses to hi.
  ```
- This is a representability limitation in the helper's sentinel contract, separate from the finite-threshold-to-Infinity overflow path already recorded under Audit #523 and existing Issue #53. The helper comment already warns that neighbouring integers are not representable beyond 2^53; the sentinel return contract should likewise state that no distinct `hi + 1` can be returned in this range, or use a nonnumeric result for no match.
- The binomial-test caller's monotone predicate is expected to qualify at the upper endpoint in its relevant branch, so this pass did not establish a separate incorrect `binomTest()` result from this sentinel limitation. No duplicate Issue was filed.
- Concrete call-site probes reviewed: `binomTest(0, 1, { p: 0.5 })` (small lower endpoint); `binomTest(1, 2, { p: 0.5 })` (mean boundary); and helper probe `firstTrue(() => false, 0, 2 ** 54)`. These are static input traces, not claimed runtime outputs.
- Rとの関係: R's binomial-test search uses finite integer increments but its double representation has the same fundamental limitation beyond 2^53; no R executable was run.
- 検証範囲: complete `firstTrue()`/`lastTrue()` review, `binomTest.ts` caller analysis, and binary64 integer-spacing reasoning. No Vitest, package runtime, or R execution. No source code changed.


## Audit #525 — `src/htest/binomTest.ts` two-sided minlike probability ordering and tail search

- Repository HEAD for this pass was not independently verified; current `binomTest.ts` source blob: `4e514e3164c1f852b325a5a04b099effc73d218c`; supporting `src/distributions/binomial.ts` blob: `2f90ac1e001443b0704f33e76585cb2868497724`.
- Reviewed the complete `twoSidedP()` control flow, probability-ordering threshold, monotone-tail boundary searches, and the relevant `dbinom1()`/`pbinom1()` implementations. Compared with current R Core `src/library/stats/R/binom.test.R`, including its minlike fast path (for `n >= 1234`) and direct-sum path.
- The JS search partition is mathematically consistent with the binomial mode. The mode is `floor((n + 1) * p)`; for noninteger `n*p`, it is either `floor(n*p)` or `ceil(n*p)`, and for integer `n*p` it equals `n*p`. Therefore searching the right-side boundary from `ceil(n*p)` and the left-side boundary through `floor(n*p)` keeps each searched side monotone, including the case where the mode is one integer above the mean. The `x === mean` early return is also valid: when `n*p` is an integer, that point is a mode and has the maximum PMF.
- The tail arithmetic maps correctly to R's minlike construction: for `x < n*p`, the observed lower tail is `P(X <= x)` and the qualifying opposite tail is `P(X >= j)`; for `x > n*p`, the qualifying lower tail is `P(X <= j)` and the observed upper tail is `P(X >= x)`. The `j-1`/inclusive-tail arguments in `pbinom1()` match those boundaries.
- One implementation difference deserves continued watch but did not yield a concrete defect in this pass: R compares log PMFs (`log(dbinom(x)) + log(1+1e-7)`), while JS computes linear PMFs and multiplies by `1+1e-7`. This can lose relative distinctions when PMFs are subnormal or underflow to zero. However, no deterministic input was established where the JS-selected qualifying tail changes the returned representable p-value; an underflowed observed mass also places the relevant extreme tail at or below the representable range in the examined cases. Do not treat this as a confirmed bug or open a speculative Issue.
- Exact deterministic edge probes traced: `binomTest(0, 10, { p: 0.5 })`; `binomTest(5, 10, { p: 0.5 })` (integer mean/mode); `binomTest(2, 10, { p: 0.25 })` (integer mean); `binomTest(3, 10, { p: 0.25 })` (mode above mean); `binomTest(2, 10, { p: 0.2 })` (mode/mean boundary); `binomTest(0, 1500, { p: 0.5 })`; and `dbinom1(75, 1500, 0.5, false)` (subnormal PMF region). These were source/IEEE-754 probes, not package-runtime outputs.
- Result: no new independent, reproducible defect established; no Issue filed. Existing Issue #101 and earlier binomial-distribution audits are not duplicated.
- Rとの関係: current R Core minlike algorithm inspected directly. No R executable was run.
- 検証範囲: complete `binomTest.ts`, relevant `dbinom1()`/`pbinom1()` paths, R minlike source, monotonicity/mode derivation, and deterministic binary64 edge analysis. No Vitest, package runtime, or R execution. No source code changed.


## Audit #526 — `src/distributions/binomial.ts` CDF incomplete-beta mapping and upper-tail subtraction

- Source blob: `src/distributions/binomial.ts` `2f90ac1e001443b0704f33e76585cb2868497724`; supporting `src/special/incbet.ts` `59a4ebdf385c69124e68fae6d16159bfd6709a24`, `src/special/loader.ts` (current file fetched during this audit), and `src/internal/ddexp.ts` `bee2ddfcd5de4228f56aad0b1647690c275e78c0`.
- Reviewed `pbinom1()` input/endpoint handling and `pbinomRaw()` for both ordinary and beyond-2^53 paths, lower/upper tails, linear/log probabilities, cancellation fallback, and the incomplete-beta frame selection. Also reviewed the relevant `betaIncUncapped()`/core path for direct-tail selection and log construction.
- Compared with current R Core `src/nmath/pbinom.c`: R validates finite `n,p`, forces integer `n`, handles `x<0`, applies `floor(x + 1e-7)`, handles `n<=x`, and delegates to `pbeta(p, x+1, n-x, !lower_tail, log_p)`. The JS ordinary path uses the same beta identity. The JS additional correction for cases where `x+1` is not representable is algebraically consistent with `I_p(x+1,b)=I_p(x,b)-(b/n) dbinom(x;n,p)`; if the upper-tail subtraction loses positivity or its log is unresolved, it recomputes the direct `I_p(x+1,b)) tail.
- The `x+1-x === 1` branch deliberately uses the ordinary beta parameters; when `x+1` is not a distinct double, the correction branch computes `b=n-x` with `twoSum` and returns NaN if the difference has a nonzero low component. This avoids silently passing a rounded shape parameter into the beta function. At very large n with x small, the ordinary branch can still round `n-x` to n, as R's direct implementation does; the omitted unit is below the relative resolution of that shape parameter in this regime. No incorrect representable result was isolated from this distinction.
- Exact deterministic probes traced:
  ```ts
  pbinom1(-1, 10, 0.5, true, false);
  pbinom1(10, 10, 0.5, true, false);
  pbinom1(0, 10, 0.5, true, false); // P(X <= 0)
  pbinom1(0, 10, 0.5, false, false); // P(X > 0)
  pbinom1(0, 10, 0.5, false, true); // log P(X > 0)
  pbinom1(1, 1e308, 1e-308, true, false);
  pbinom1(2 ** 53, 2 ** 53 + 2, 0.5, false, true);
  pbinom1(1e16, 2e16, 0.5, true, false);
  pbinom1(1e16, 2e16, 0.5, false, true);
  ```
  These are deterministic source-level edge probes; no runtime outputs are asserted.
- Result: no new independent, reproducible defect established; no Issue filed. Existing binomial and incomplete-beta audit records are not duplicated.
- Rとの関係: direct comparison with current R Core `pbinom.c` and `pbeta.c`; R's ordinary CDF mapping is the same. R executable was not run.
- 検証範囲: complete `pbinom1()`/`pbinomRaw()` review, relevant incomplete-beta tail-selection and log paths, Loader PMF correction identity, R Core source comparison, and deterministic boundary analysis. No Vitest, package runtime, or R execution. No source code changed.


## Audit #527 — `src/distributions/binomial.ts` `qbinom1()` rejects non-integer `size` instead of applying R's `R_forceint()`

- Source blob: `src/distributions/binomial.ts` `2f90ac1e001443b0704f33e76585cb2868497724`; shared validation helper `badParams()` is in the same file. R comparison: current `wch/r-source/src/nmath/qbinom.c`.
- Confirmed R-compatibility defect. TypeScript's `qbinom1()` checks raw `size < 0` before endpoint handling, then calls `badParams(size, prob)`, which rejects `nonInteger(size)`. R Core instead executes `n = R_forceint(n)` (round-to-nearest, ties-to-even) before checking `n < 0`. Thus R accepts non-integer finite `size` by rounding it, while the TypeScript function returns NaN.
- Exact deterministic reproductions:
  ```ts
  qbinom1(0.5, 10.2, 0.3, true, false);
  // Current TypeScript: NaN (badParams rejects non-integer size)
  // R: equivalent to qbinom(0.5, size = 10, prob = 0.3)

  qbinom1(0.5, -0.1, 0.3, true, false);
  // Current TypeScript: NaN (raw size < 0 and non-integer)
  // R: R_forceint(-0.1) is -0; accepted as size 0, result 0

  // Tie-to-even contrast:
  // R_forceint(10.5) = 10; R_forceint(11.5) = 12.
  ```
- The endpoint handling does not resolve the mismatch: for interior probabilities the later `badParams()` rejects non-integer `size`; for negative values between -0.5 and 0, the initial raw-sign check also rejects values R rounds to negative zero.
- Existing-issue search for `qbinom non-integer size rounding`, `binomial size noninteger`, and `qbinom` found no matching issue. Created GitHub Issue #102: https://github.com/numero-uno-jpn/rStats.js/issues/102.
- Suggested remediation: apply R-compatible half-even integer coercion to `size` before sign validation and before subsequent calculations, or change the documented compatibility contract consistently. Do not use ordinary `Math.round()` without the tie-to-even correction.
- Rとの関係: directly compared with current R Core `qbinom.c`, which calls `R_forceint(n)` before the negative-size check; `R_forceint`/nearbyint semantics were also reviewed in Audit #521. No R executable was run.
- 検証範囲: complete `qbinom1()` control flow, `badParams()`, endpoint handling, `discreteQuantile()` interaction, current R Core source comparison, and deterministic concrete inputs above. No Vitest, package runtime, or R execution. No source code changed.


## Audit #528 — qbinom Cornish–Fisher seed and bounded search

- Sources: `src/distributions/binomial.ts` blob `2f90ac1e001443b0704f33e76585cb2868497724`; `src/internal/discrete.ts` blob `a8ed86222a9c91b7dfea90b990244a81c1170194`; `src/internal/dpq.ts` blob `543eb6ceb3de7627a7562b035a931a88da424aa7`; `src/distributions/normal.ts` blob `9980fecf2366042da09273ba8c86de07d34dcaa3`. Compared with current R Core `qbinom.c` and `qDiscrete_search.h`.
- Reviewed `mu=n*prob`, `sigma=sqrt(n*prob*(1-prob))`, skewness `(1-2*prob)/sigma`, qnorm tail selection, Cornish–Fisher seed, fallback, and lower/upper-tail search predicate. Formula and operation order match R's `q_DISCRETE_BODY()`.
- For finite n, the search is bounded by [0,n], clamps the rounded seed to support, and uses the corresponding binomial CDF predicate. The #523 overflow defect concerns an infinite upper bound and does not apply to qbinom's finite `hi:n`.
- Extreme arithmetic: variance can underflow to zero for tiny `prob`, and `z*z` can overflow for extreme finite log probabilities. In either case the resulting nonfinite seed is replaced by finite `mu`; this affects search efficiency, not the bounded predicate's correctness. The callback returns the exact support endpoint probability for `y>=n`.
- Concrete source-level probes (not runtime outputs): `qbinom1(0.5,10,Number.MIN_VALUE,true,false)`; `qbinom1(0.5,10,1-Number.EPSILON/2,true,false)`; `qbinom1(-10000,100,0.5,true,true)`; `qbinom1(-10000,100,0.5,false,true)`; `qbinom1(0.5,Number.MAX_VALUE,0.5,true,false)`; `qbinom1(0.5,2**53,0.5,true,false)`; `qbinom1(0.5,100,0.5,true,false)`.
- Inspected existing `test/fixtures/auditq_qbinom.mpmath.json` cases covering both tails, linear/log probabilities, tiny probabilities, skewness, and large n; tests were not executed.
- Result: no new independent reproducible defect in the Cornish–Fisher seed or finite-support search. #102 (size coercion) and #523 (unbounded search) are not duplicated.
- R comparison: current R Core source inspected directly; no R executable was run. No Vitest or package runtime was run; no source code changed.


## Audit #529 — `src/distributions/negbinomial.ts` PMF overflow guard (existing Issue #65)

- Source blob: `src/distributions/negbinomial.ts` `6bf9bf9b9d8b05aa4828e33c4b2fb9b3ed5171c7`; compared with current R Core `src/nmath/dnbinom.c`.
- Reconfirmed existing defect already tracked by Issue #65; no duplicate issue created. `dnbinomRaw()` immediately returns NaN when `size + x` overflows, although both operands and the mathematical PMF can be finite. Both prob and mu parameterizations reach this guard.
- Exact inputs:
  ```ts
  dnbinom(1e308, 1e308, { prob: 0.5 });
  dnbinom(1e308, 1e308, { mu: 1e308 });
  dnbinom(1e308, 1e308, { prob: 0.5, log: true });
  dnbinom(1e308, 1e308, { mu: 1e308, log: true });
  ```
  In each case `size + x === Infinity`, so current source returns NaN. At the mean for size=x=1e308, prob=0.5, a local normal approximation gives variance approximately 2e308, PMF approximately `2.8209479177387814e-155`, and log PMF approximately `-355.8636164445677`. This is an asymptotic reference, not an executed result.
- Rとの関係: current R Core `dnbinom.c` inspected. It has a small-x/large-size expansion and Loader density path rather than the TypeScript early rejection. R source explicitly comments on this overflow regime.
- Related issue: existing [#65](https://github.com/numero-uno-jpn/rStats.js/issues/65). Added a comment with R-source comparison, both parameterizations, and corrected the asymptotic log estimate in the issue body (the prior estimate there was numerically inconsistent).
- 検証範囲: complete `dnbinomRaw()` entry and both public parameterization paths, R Core source comparison, deterministic IEEE-754 overflow trace, and local normal approximation. No package runtime, Vitest, or R executable was run. No source code changed.


## Audit #530 — `src/distributions/negbinomial.ts` CDF tail identity and small-shape upper-series

- Source blob: `src/distributions/negbinomial.ts` `6bf9bf9b9d8b05aa4828e33c4b2fb9b3ed5171c7`; compared with current R Core `src/nmath/pnbinom.c` and `pbeta` parameterization.
- Reviewed the ordinary mapping `P[X <= x] = I_prob(size, floor(x+1e-7)+1)`, the complementary upper tail, log/linear modes, and the beyond-2^53 correction `I_p(size,x+1)=I_p(size,x)+P(X=x)`. The subtraction identity for the upper tail and the `logSubExp` branch have the correct sign and inclusivity.
- Reviewed `upperSeries()` for `size<=1`, `q>=0.95`: positive-term recurrence, double-double term/sum, prefactor construction via `prefactorParts`, stopping bound using `term < 1e-18 * sum * p`, and fallback when the series is not usable or exceeds 1/2. The ratio `(A+B+k)/(A+1+k)*q` increases toward q for B<=1; bounding the remaining geometric tail by `term/p` is conservative. The 1e6 iteration cap routes to the incomplete-beta fallback.
- Exact deterministic inputs traced:
  ```ts
  pnbinom1(0, 0.5, 0.5, true, false);
  pnbinom1(0, 5.6e-245, 0.125, false, true);
  pnbinomMu1(1545, 5.6e-245, 4.6e-241, false, false);
  pnbinomMu1(1545, 5.6e-245, 4.6e-241, false, true);
  pnbinom1(1e16, 1e16, 0.5, true, false);
  pnbinom1(1e16, 1e16, 0.5, false, true);
  pnbinom1(-1, 2, 0.5, true, false);
  pnbinom1(Infinity, 2, 0.5, false, true);
  ```
  The tiny-shape/mu case is also explicitly documented in source comments as the motivation for the specialized series and its prefactor path. Existing `audit_pnbinom.mpmath.json` fixture cases were inspected for lower/upper and log/linear outputs; no tests were executed.
- Result: no new independent reproducible defect established in CDF tail mapping or the small-shape series. Existing #65 concerns PMF overflow and is not duplicated.
- Rとの関係: current R Core `pnbinom.c` uses the same incomplete-beta identity and endpoint ordering; no R executable was run.
- 検証範囲: complete `pnbinomRaw()` and `upperSeries()` control flow, relevant double-double identities, tail/log arithmetic, R Core source comparison, and existing fixture inspection. No Vitest, package runtime, or R execution. No source code changed.


## Audit #531 — `src/distributions/negbinomial.ts` `fromMu()` underflow erases success probability

- Source blob: `src/distributions/negbinomial.ts` `6bf9bf9b9d8b05aa4828e33c4b2fb9b3ed5171c7`; support: `src/special/dd.ts` `ddDiv()`, `src/special/incbet.ts` `betaIncDD()`, `src/internal/discrete.ts` `discreteQuantile()`. Compared quantile logic with R Core `src/nmath/qnbinom_mu.c` and `qDiscrete_search.h`.
- New defect: `fromMu()` forms `pd = size/(size+mu)` using double-double division, but double-double still cannot represent values below the least positive binary64 subnormal. If the exact ratio is below `Number.MIN_VALUE`, it becomes `[0,0]`, and the pair `(pd,qd)` no longer represents the input distribution. The CDF/PMF then use an artificial success probability of zero; the quantile's gamma starting-value path and integer search inherit the corrupted CDF.
- Exact reproduction:
  ```ts
  const size = Number.MIN_VALUE; // 5e-324
  const mu = Number.MAX_VALUE;   // 1.7976931348623157e+308
  pnbinom(0, size, { mu });      // should round to 1
  qnbinom(0.5, size, { mu });    // should be 0
  dnbinom(0, size, { mu });      // should round to 1
  ```
  The exact log mass at zero is approximately `size * (log(size)-log(mu)) ≈ -7.19e-321`; hence the mass rounds to 1 and the median is 0. The exact success probability is about `2.75e-632`, below `Number.MIN_VALUE`, so `ddDiv` necessarily returns a zero high/low pair. Source-level control-flow finding; no runtime output is claimed.
- Rとの関係: R Core `qnbinom_mu.c` forms `Q=1+mu/size`, `P=mu/size` rather than forming the underflowing success probability. R's shared discrete search also starts from the Cornish-Fisher value. This avoids this particular parameter-loss route, though no R executable was run.
- Issue: created [new GitHub issue](issue URL returned by GitHub) with deterministic inputs, mathematical reference, source trace, and remediation direction.
- 検証範囲: complete `fromMu()`, qnbinom small-probability gamma seed and discrete search, CDF/PMF dispatch, double-double division limits, and R Core source comparison. No package runtime, Vitest, or R execution. No source code changed.


## Audit #532 — `src/distributions/negbinomial.ts` quantile seed, continuous refinement, and integer search

- Source blob: `src/distributions/negbinomial.ts` `6bf9bf9b9d8b05aa4828e33c4b2fb9b3ed5171c7`; dependencies: `src/internal/discrete.ts`, `src/distributions/gamma.ts`, `src/distributions/normal.ts`. Compared with current R Core `src/nmath/qnbinom.c` and `qDiscrete_search.h`.
- Reviewed the small-`prob` gamma-limit seed `qgamma(p,size)/(-log(q))`, Cornish-Fisher seed for larger `prob`, `refineContinuous()` Newton/secant steps, switch to smaller tail, and final monotone discrete search. The `y0=Infinity` early return is consistent with a quantile exceeding finite binary64 range when a positive finite gamma quantile is divided by a subnormal `-log(q)`; the zero-gamma case is not incorrectly classified as overflow.
- Reviewed cases where `prob` rounds close to 1 while `qd` retains the small complement, where `1/prob` overflows for subnormal `prob`, and where the `mu` parameterization feeds the same seed. The gamma branch is selected for small `prob`, avoiding the unused infinite Cornish-Fisher moments. `refineContinuous()` operates on the real extension of the beta CDF and density before the final integer search; the final result remains determined by the discrete CDF.
- Exact deterministic inputs traced:
  ```ts
  qnbinom(0.5, 1, { prob: Number.MIN_VALUE });
  qnbinom(-1000, 1, { prob: Number.MIN_VALUE, lowerTail: false, logP: true });
  qnbinom(-1000, 1, { prob: Number.MIN_VALUE, lowerTail: true, logP: true });
  qnbinom(0.5, 0.5, { prob: 0.01 });
  qnbinom(0.5, 1e300, { prob: 0.5 });
  qnbinom(0.5, 1e300, { mu: 1e300 });
  qnbinom(0.5, Number.MIN_VALUE, { mu: Number.MAX_VALUE });
  ```
  The final input is already tracked by new Issue #103 (parameter conversion underflow), not duplicated here.
- Result: no additional independent reproducible quantile-seed/refinement/search defect established. Existing #103 is a parameter conversion defect rather than a separate quantile algorithm defect. No new issue.
- Rとの関係: R Core uses Cornish-Fisher plus `q_DISCRETE_BODY()`; the TypeScript implementation adds a gamma-limit seed and continuous refinement but preserves the final monotone discrete search contract. Source comparison only; no R executable was run.
- 検証範囲: complete `quantileRaw()`, `refineContinuous()`, public `qnbinom1()`/`qnbinomMu1()` boundary ordering, gamma/normal seed calls, discrete search, and R Core source comparison. No package runtime, Vitest, or R execution. No source code changed.


## Audit #533 — `dnbinomMu1()` size-zero boundary differs from R

- Reviewed the complete boundary ordering for `dnbinom1()`, `pnbinom1()`, `qnbinom1()`, and their `mu)-parameterized counterparts. Compared against R Core `src/nmath/dnbinom.c`, `pnbinom.c`, `qnbinom.c`, and `qnbinom_mu.c`.
- Found a compatibility defect in `dnbinomMu1()`: when `size === 0` and the observation is positive, it returns `d0(log)` for every `mu > 0`. R Core's `dnbinom_mu()` returns NaN for positive integer observations at `size = 0`, including finite positive `mu`; only the `x == 0 && size == 0` case takes the point-mass shortcut.
- Exact reproduction:
  ```ts
  dnbinom(1, 0, { mu: 1 });        // current: 0; R: NaN
  dnbinom(2, 0, { mu: 1 });        // current: 0; R: NaN
  dnbinom(1, 0, { mu: Infinity }); // current: 0; R source formula: NaN
  ```
  For the finite case, R's positive-`x` path evaluates the size-zero limiting arithmetic and produces NaN. This is a source-level comparison; no R runtime was executed.
- Created Issue #104: https://github.com/numero-uno-jpn/rStats.js/issues/104
- Other boundary paths reviewed: `pnbinom` size-zero point mass, `qnbinom` size-zero return 0, `size = Infinity` Poisson limit for the `mu) parameterization, `prob = 1), `mu = 0), and NaN/Infinity argument ordering. No additional independent defect established.
- Validation: source inspection and deterministic input tracing only. No package runtime, Vitest, or R execution. No source code changed.


## Audit #534 — `src/special/loader.ts` Loader deviance, Stirling error, and Poisson/binomial density edge paths

- Source blob: `src/special/loader.ts` `798b92185091204205e77d1e8e81e4591e7d78c3`; related double-double primitives in `src/special/dd.ts`. Repository HEAD at audit start: `ac7a0ab9623a3c09ddbf3c9a4f9d1744f3bcf432`.
- Reviewed the complete `stirlerr()`/Stirling-series selection, half-integer lookup table, recurrence for fractional arguments up to 15, `bd0dd()` generated double-double near-mean series, `bd0ddOps()` fallback, `farDeviance()`/2^-64 scaling, `bd0Prod()` small-product logarithmic path, `dbinomRawDD()` endpoint and denominator paths, and `dpoisRawCore()` extreme-ratio and large-x paths.
- The Stirling truncation thresholds (15, 35, 80, 500) retain enough terms for the absolute error in the probability exponent to remain below binary64 output resolution at each transition. The half-integer table covers exactly k/2 for k=1..30; non-half-integers in (0,1) use the lgamma1p identity, and fractional values in [1,15] use the recurrence to the asymptotic region.
- The near-mean deviance uses v=(x-M)/(x+M) and the positive odd-power series; the `TAIL_IN_DOUBLE` condition bounds the omitted low-part effect before summing the tail in ordinary double precision. The large-argument scaling is homogeneous and the far branch avoids forming an overflowing quotient by subtracting logarithms when the ratio is outside the normal safe interval. No sign or endpoint inconsistency was found for the positive internal-domain inputs.
- The Poisson endpoint shortcuts were traced for lambda=0, x=0, x<0, x=Infinity, lambda=Infinity, tiny lambda, and x/lambda ratios beyond the normal range. The large-x denominator branch algebraically preserves 1/sqrt(2*pi*x) without forming the overflowing product 2*pi*x.
- Existing defect retained: `dbinomRawDD(8e307,8e307,[0.5,0],[0.5,0],false)` reaches the already-tracked `2 * Math.PI * x * (nmx / n)` denominator ordering and returns zero although the central-binomial probability is representable. This is Issue [#24](https://github.com/numero-uno-jpn/rStats.js/issues/24); it was not duplicated.
- Exact deterministic source-level probes (not runtime outputs):
  ```ts
  stirlerr(0.5);
  stirlerr(15);
  stirlerr(15 + Number.EPSILON * 4);
  stirlerr(500);
  stirlerr(500 + Number.EPSILON * 256);
  bd0dd(0, [1e308, 0]);
  bd0dd(1e308, [1e308, 0]);
  bd0dd(1e-300, [1e-320, 0]);
  dbinomRawDD(8e307, 8e307, [0.5, 0], [0.5, 0], false);
  dpoisRaw(1e308, 1e308, true);
  dpoisRaw(1e308, 1e308, false);
  dpoisRaw(0, Number.MIN_VALUE, true);
  ```
- Result: no new independent, reproducible defect established; no new Issue filed. Existing Issue #24 remains the known Loader denominator overflow.
- Rとの関係: Loader (2000) formulas and current Rmath-style deviance/Stirling identities were assessed mathematically; no R executable or independent R source/runtime comparison was performed in this pass.
- 検証範囲: complete `loader.ts` source review, formula/branch analysis, deterministic binary64 edge-input tracing, and consistency check against existing Issue #24. No Vitest, package runtime, or R execution. No source code changed.


## Audit #535 — `src/special/dd.ts` division correction and logarithm normalization

- Source blob: `src/special/dd.ts` `1e377fb5795b4695ca7ad147b48b7ead850d2fe6`. Repository HEAD at audit start: `0070240de760a13d1d34ce6e44ebb1145ae7bf3f`.
- Reviewed `twoSum`, `twoProd`, `ddAdd`, `ddSub`, `ddMul`, `ddMulNum`, `ddDiv`, `ddDivNum`, `ddLog`, the `prodErrScaled()` fallback, and the `ddEnabled=false` branches. Rechecked the existing Issue #62 product-residual loss without duplicating it.
- New helper-level defect: `ddDiv()` and `ddDivNum()` lose a representable quotient low component when the divisor is subnormal. For the exact binary64 inputs `a=Number.MIN_VALUE` and `b=3*Number.MIN_VALUE`, the exact quotient is 1/3. The nearest high component is `0.3333333333333333`; the residual low component is `1.8503717077085942e-17`. The current residual path forms `b*q1` at the subnormal scale, where the product residual underflows to zero before the second quotient correction.
- Exact deterministic reproductions:
  ```ts
  ddDiv([Number.MIN_VALUE, 0], [3 * Number.MIN_VALUE, 0]);
  // current source-level result: [0.3333333333333333, 0]
  ddDivNum([Number.MIN_VALUE, 0], 3 * Number.MIN_VALUE);
  // same low-component loss
  ```
- The exact quotient and low component were independently calculated from the exact binary64 inputs using high-precision Decimal arithmetic. The source arithmetic was traced with IEEE-754 binary64 operations; no package runtime output is claimed.
- This differs from Issue #62: #62 loses a product residual during `prodErrScaled()` exponent restoration; #105 loses a quotient residual because the correction product itself is subnormal. The helper is internal and is used by numerical kernels including the incomplete-beta continued fraction; a public distribution output difference has not yet been demonstrated.
- `ddLog()` subnormal normalization by exact power-of-two scaling, mantissa range reduction, table index bounds, and exponent reconstruction were reviewed. `ddAdd()`/`ddSub()` nonfinite-sum guards and multiplication overflow/fallback paths were also checked. No additional independent defect was established in those paths.
- Created Issue [#105](https://github.com/numero-uno-jpn/rStats.js/issues/105), with both deterministic inputs, exact DD reference, root cause, and a scaling-based remediation direction.
- Rとの関係: no direct R analogue for these internal helpers; expected quotient follows from exact binary64 inputs and high-precision arithmetic. No R executable was run.
- 検証範囲: complete `dd.ts` source review, deterministic subnormal-division reproductions, high-precision Decimal reference, and regression check against existing Issue #62. No Vitest, package runtime, or R execution. No source code changed.


## Audit #536 — `src/special/incbet.ts` reachability of subnormal double-double division

- Source blob: `src/special/incbet.ts` `59a4ebdf385c69124e68fae6d16159bfd6709a24`; related `src/special/dd.ts` `1e377fb5795b4695ca7ad147b48b7ead850d2fe6`. Repository HEAD at audit start: `a4de30b73b7b3137032da721d3841482c04cf1af`.
- Followed the exact public `pbeta()` path through `betaInc()` → `betaIncDD()` → `betaIncCore()` → `betaIncUncapped()`, including the order of special-case dispatch, both pseries frames, large-a expansion, continued fractions, and the generated scalar `sDiv()` implementation.
- Audit #535 established that `ddDiv()`/`ddDivNum()` lose the low component for a subnormal divisor. `incbet.ts` also contains an inline generated divider (`sDiv`) with the same residual-correction pattern. This pass checked whether valid beta-distribution inputs can route subnormal shape denominators into that continued-fraction path.
- The dispatch guards prevent the obvious subnormal-shape cases from entering the continued fraction: (1) a shape below `SUB_SHAPE=1e-300` with the other above `SUB_OTHER=1e-280` is handled by `subShapeTail()`; (2) subnormal x or 1-x is handled by `betaIncTinyX()`; (3) when both shapes are tiny, the smaller x-frame has `b*x<=1` and `x<=0.95`, so `pseriesOk()` selects the series; (4) large/small shape combinations meeting the threshold are delegated to `betaIncLargeA()` before the continued-fraction fallback. The ordinary continued-fraction path therefore does not begin with a subnormal shape coefficient in the examined cases.
- Reviewed the generated `sDiv()` quotient correction and the continued-fraction recurrence scaling (`BIG`/`BIGINV`) for small convergents. The recurrence rescales small numerator/denominator pairs after each pair of steps; no deterministic public pbeta input was established where a subnormal intermediate denominator is divided before that scaling and changes the representable output.
- Exact deterministic edge inputs traced (source-level only): `pbeta(0.5,5e-324,5e-324)`, `pbeta(0.99,5e-324,5e-324)`, `pbeta(0.5,5e-324,1e-250)`, `pbeta(1e-320,5e-324,2)`, and `pbeta(1-1e-15,1e-300,1e-300)`. Existing `test/beta.test.ts` fixture dispatch and largeA/largeDf suite wiring were inspected; fixtures were not executed.
- Result: no new public `pbeta()` defect established in this integration pass. Issue [#105](https://github.com/numero-uno-jpn/rStats.js/issues/105) remains a confirmed internal-helper precision defect; this pass does not close it and does not claim that all possible continued-fraction intermediate states are excluded.
- Rとの関係: beta distribution identities and the existing R-derived fixture-suite wiring were reviewed; no R executable or fixture comparison was run.
- 検証範囲: complete top-level `betaIncUncapped()` dispatch, continued-fraction entry conditions, pseries/tinyX/subShape/largeA bypasses, generated `sDiv()` and recurrence scaling. No Vitest, package runtime, or R execution. No source code changed.


## Audit #537 — `src/special/incbetPrefactor.ts` small/huge-shape prefactor and extreme scaling

- Source blob: `src/special/incbetPrefactor.ts` `bf49427ee0d86f326b25dbb3841c4f355ca6444c`; dependencies `src/special/dd.ts` and `src/special/lgammaDiff.ts`. Repository HEAD at audit start: `80ff9135d2f567aa59a5e3aaa2bd4a501cc49c63`.
- Reviewed `prefactorParts()` dispatch at `SMALL_SHAPE=1`, `HUGE_SHAPE=2^52`, and `HUGE_SHAPE_MAX_SMALL=100`; the small-shape coefficient `s/(1+s/l)` and `smallShapeG()`; the huge-shape coefficient `1/gamma(s)` and `lgammaRatioHuge()`; `log1m()` near zero; and `mulBig()` scaling above `1e290`.
- The small-shape coefficient avoids forming `a*b` before division, so two small positive shapes do not lose their product to underflow. When `l<1`, `smallShapeG()` uses the log-gamma difference around 1; when `l>=1`, it uses the double-double gamma difference or the huge-shape ratio. The cross term lost if `1+l` rounds to 1 is of order `s*l`, below output resolution in the corresponding tiny-shape regime.
- For the huge-shape approximation, the omitted terms are of order `s^3/l^2`; at the worst dispatch boundary `l=2^52`, `s<=100`, this is below approximately `5.0e-26`. The retained `s(s-1)/(2l)` correction and `s log(l)` term are formed without first adding the disparate shapes.
- `log1m()` uses the `-(y+y^2/2)` expansion below `1e-15`; the next term is below `1e-30` relative. `mulBig()` uses a power-of-two split for huge multipliers and returns an infinite high part with zero low part when the true product overflows, avoiding a NaN low component beside Infinity.
- Deterministic source-level probes (not runtime outputs): `prefactorParts(Number.MIN_VALUE,0.5,[0.5,0],[0.5,0])`; `prefactorParts(1e-300,1e308,[0.5,0],[0.5,0])`; `prefactorParts(100,2**52,[0.5,0],[0.5,0])`; `smallShapeG(Number.MIN_VALUE,1e-20)`; `lgammaRatioHuge(100,2**52)`; `mulBig([Math.log(Number.MIN_VALUE),0],1e308)`; and `log1m([Number.MIN_VALUE,0])` versus `log1m([1e-15,0])` at the branch boundary.
- Issue #105's subnormal-denominator DD division defect was considered in this call graph. For subnormal shapes, the prefactor's omitted/rounded DD correction is smaller in absolute magnitude than the shape itself and no separate representable public prefactor error was established. This does not close Issue #105.
- Result: no new independent, reproducible defect established; no new Issue filed. Existing prefactor boundaries and approximations remain as documented in source.
- Rとの関係: gamma-ratio identities and Stirling expansion were assessed analytically; no R executable or independent R runtime comparison was performed.
- 検証範囲: complete `incbetPrefactor.ts` source review, all dispatch thresholds, extreme shape/argument scaling, and the related DD helper call path. No Vitest, package runtime, or R execution. No source code changed.


## Audit #538 — `src/special/incbetLargeA.ts` large-a / small-b asymptotic expansion

- Source blob: `src/special/incbetLargeA.ts` `9eabe133979cd41a00a904c61cb60ed6b35b6693`. Repository HEAD at audit start: `0adf3b2812a956505aa5de268110eeb995c7c491`. Related sources reviewed: `dd.ts` (`2edeba6b0c0f5e7714d3d1416e4d6f9da5b17c2f`), `incbetPrefactor.ts`, `igam.ts`, and `erf.ts`.
- Re-read the full region filter and both J/H expansions: `LARGE_A_MIN=15`, `SMALL_B_MAX=40`, `Y_MAX=0.3`, `U_MIN_J=0.1`, `U_MAX=500`, `NMAX=30`, and `EPS=2^-56`; the `b=0.5` upper-gamma closed form; the backwards continued fraction for J0; p_n recurrence and least-term truncation; H_N construction and downward recurrence; the u-low correction; the prefactor correction; and the log fallback when the linear smaller tail is below `1e-290`.
- J0 continued-fraction length is bounded by `ceil(100/u + b/2)+10`; because the J branch additionally requires `u>=0.1`, the maximum is about 1010 terms. At the other end, for large u the fixed backwards fraction converges rapidly. The denominator remains away from zero on the selected J branch (`u` is at or above the Gamma(b,1) median), and the final double-double divisions do not encounter the subnormal-divisor regime from Issue #105.
- The H expansion is used only on the lower-u side. Since `l=-log(1-y)<=-log(0.7)<0.357`, its positive series converges well inside its `l<2π` domain. The N-selection uses the bound `H_n/H_0 <= (l/2)^(2n)` and stops when the coefficient-weighted bound is below `2^-56`; the maximum 30 terms is conservative for `b<=40`. For extremely large T, l is correspondingly tiny whenever u remains within the admitted region, so N=0 before `4*T*T` could overflow; when J-side `4*T*T` overflows, the omitted J corrections are of order T^-2 and below binary64 resolution.
- The large-a scaling of `u=T*l` above `1e299` was traced: both factors are scaled by reciprocal powers of two before the double-double product, retaining a finite u when `x`'s high component rounds to 1 but y is separately represented. For `y<1e-15`, `l=y+y²/2` preserves the meaningful increment; when y is subnormal, the omitted y² term is far below representable relative significance. The `small<1e-290` branch uses logarithms before exponentiation and avoids losing a representable log-tail when the linear value underflows.
- The asymptotic J-series stops before the terms grow, while the H-side positive series uses its explicit coefficient bound. The `b=1/2` closed form is equivalent to `sqrt(pi/u)*erfcx(sqrt(u))`; for sqrt(u)<1 it reconstructs erfcx using `exp(u)*erfc`, and for larger arguments it uses the scaled erfc approximation.
- Exact deterministic source-level probes (not runtime outputs): `betaIncLargeA(15,0.1,[0.7,0],[1-0.7,0],true,true)`; `betaIncLargeA(15,40,[0.7,0],[1-0.7,0],false,true)`; `betaIncLargeA(1e300,0.1,[1,-1e-300],[1e-300,0],true,true)`; `betaIncLargeA(1e308,0.5,[1,-1e-300],[1e-300,0],false,true)`; `betaIncLargeA(1e308,0.5,[1,-Number.MIN_VALUE],[Number.MIN_VALUE,0],true,true)`. The final case intentionally exercises the U_MIN_J rejection/fallback for a tiny u.
- Reviewed `scripts/mpmath/smallb.py` (`SEED=20261025`): its reference uses the positive-term hypergeometric series at 60 and 90 decimal digits, retains only results agreeing to 1e-28, samples gamma quantiles from 1e-12 to 1-1e-12 and random quantiles, and mirrors the parameters. Existing generator covers a=15..1e10 and b=0.1..40; this pass did not run the generator or compare new mpmath outputs.
- Result: no new independent, reproducible defect established; no new Issue filed. No source code changed.
- Related fix status refresh: Issue #62 is closed as completed; current `dd.ts` now rescales `prodErrScaled` with the combined exponent `ka+kb`, fixing the previously reported sequential-rescaling underflow. Issue #105 remains open and its `ddDiv`/`ddDivNum` subnormal-divisor precision loss remains present in current source.
- Rとの関係: reviewed the mathematical expansion and existing mpmath oracle methodology; no R executable, Vitest, package runtime, or mpmath generator was run.
- 検証範囲: complete `incbetLargeA.ts` source, its `igamSeriesSumDD` and erfcx dependencies, all selection thresholds, recurrence/truncation bounds, large-number scaling, and the current issue/fix state. No runtime execution. No source code changed.


## Audit #539 — `src/special/incbetTemme.ts` uniform asymptotic expansion and extreme-shape arithmetic

- Source blob: `src/special/incbetTemme.ts` `cf22538af050c12366e0e0a19ab40ddcd09c7db6`. Repository HEAD at audit start: `ff6d69b135827f08a964d619acbdddbc50825f7e`. Related sources reviewed: current `loader.ts` `c85075fbce1fb3ff6933cbdb5c50477de3d25abf`, `dd.ts` `2edeba6b0c0f5e7714d3d1416e4d6f9da5b17c2f`, and `erf.ts` `f72136920c3138354d5d6cd4a342055e590e0fad`.
- Reviewed the homogeneous scaling for `a+b` overflow, computation of `m=ab/(a+b)`, `p`, `q`, `pq`, the cheap `|x-p|` filter, double-double `r*x-a` and Loader deviance, the `|tau|<=1` admission check, and both central and tail forms. Checked `gCoefficients()` recurrence against the differential equation, `expansionSum()` coefficient shifts/differentiation, and the `KMAX=12` truncation.
- Central form: `halfErfc()` uses direct erfc outside [0.5,1), and positive 8-point Gauss-Legendre integration inside it. The central correction R has `E<2.25`, so its exponential is normal and safe. At x=p, `d=0` chooses the upper tail as the complement side; the log is still formed through `log1p` from the opposite tail, and both central values remain near 1/2, so the tie does not create a cancellation problem.
- Tail form: `erfcxMinusLeading(y)` evaluates the negative remainder of erfcx's leading asymptote by a backwards continued fraction; `n=ceil(4+120/y²)` is at most 58 at the switch y=1.5 and drops to 4 for large y. The explicit positive leading term plus the higher expansion terms reconstructs the scaled tail factor without subtracting two nearly equal leading terms. The switch is continuous in the underlying identity at E=2.25.
- For `a+b` overflow, halving both shapes keeps r finite; m is computed as `ah*(bh/r)` when `ah*bh` overflows, and the deviance and `r*x-a` are doubled back. `mulLarge()` uses exact powers of two above 1e299, and the current `bd0dd()` also has homogeneous scaling for huge operands. The omitted `stirlerr(a+b)` when the sum overflows is below approximately 1e-309 and below binary64 relative resolution.
- A representational overflow was noted in `sqrt(TWO_PI*m)` for `m > Number.MAX_VALUE/TWO_PI`; this makes the corresponding central correction or higher-order tail term zero. Their magnitudes are respectively O(m^-1/2) and O(m^-3/2), below the spacing of the returned probability (or below the already dominant tail term) at this m, so no output-affecting defect was established. `sqrt(m/TWO_PI)` itself remains safe.
- Deterministic source-level probes (not runtime outputs): `betaIncTemme(50,50,[0.5,0],[0.5,0],true,true)` (m=25 threshold); `betaIncTemme(1e308,1e308,[0.5,0],[0.5,0],false,true)` (a+b overflow and symmetry); `betaIncTemme(1e308,50,[1,-5e-307],[5e-307,0],true,true)` (large r, x high part rounded to 1); and `betaIncTemme(25,25,[0.5,0],[0.5,0],true,true)` (m=12.5 must return undefined). E=2.25 and |tau|=1 boundaries were traced against `scripts/mpmath/largebeta.py`'s `ES`/`TAUS` generation and dispatch.
- Reviewed `scripts/mpmath/largebeta.py` (`SEED=20261025`): 50/80-digit continued-fraction references, two-sided tails and log tails, E grid including 2.2/2.3, tau grid including 0.99/1.01, and numerical-integration self-checks. The oracle generator and test suite were not run in this pass.
- Result: no new independent, reproducible defect established; no new Issue filed. No source code changed.
- Rとの関係: mathematical Temme expansion and existing mpmath oracle construction reviewed; no R executable, Vitest, package runtime, or mpmath generator was run.
- 検証範囲: complete `incbetTemme.ts`, `halfErfc`, `erfcxMinusLeading`, Loader deviance and huge-operand scaling, central/tail switch, coefficient recurrences, and extreme-shape arithmetic. No runtime execution. No source code changed.


## Audit #540 — `src/special/lgammaDiff.ts` gamma-ratio recurrence and Stirling difference

- Source blob: `src/special/lgammaDiff.ts` `22ddcc50b01890dafbbb49a1a1aa7ac2c840dfee`. Repository HEAD at audit start: `22e419dcb8ce21d520e6ad6eff4da4d3a82217e7`. Call sites reviewed in `src/special/beta.ts` and `src/special/incbetPrefactor.ts`.
- Followed `lgammaDiffDD(a,b)` end-to-end: recurrence while B<=15, accumulated `-log1p(a/B)`, double-double leading term `a*log(B+a)`, the `(B-1/2)log1p(a/B)-a` remainder, seven Stirling-series difference terms using `expm1`, and inverse-power recurrence.
- The actual call sites constrain the smaller parameter to `a<1` and the larger parameter to `b>15` in `beta()`/`lbeta()`; `smallShapeG()` uses `a<1` and either `b=1+l>1` or `b>=1`. Thus the apparent generic `a/B` overflow for a large a and tiny b is not reachable from the package's current internal call graph. `a=0` returns exactly `[0,0]`.
- At B=15 the loop advances once to B=16, so the asymptotic series is used only where the Stirling terms decrease rapidly. For B near Number.MAX_VALUE, `B*B` overflows and `inv2` becomes zero; all subsequent inverse-power terms are then below binary64 significance. For `a/B` below the subnormal grid, the omitted `(B-1/2)log1p(a/B)` term is at most O(a); that case requires a itself below roughly B*Number.MIN_VALUE, so the induced relative error in the final beta value remains below binary64 tolerance.
- The DD leading term is selected only when `|a log(B+a)|>2`, the product is finite, and `a<1e300`. In the actual call graph `a<1`, so `ddLog(twoSum(B,a))` safely preserves the small addend when it matters; when the product is small, ordinary-double rounding of the leading term is below the scale of the final output.
- Deterministic source-level probes (not runtime outputs): `lgammaDiffDD(0.5,15)`; `lgammaDiffDD(0.5,15+Number.EPSILON*16)`; `lgammaDiffDD(0.5,1e8)`; `lgammaDiffDD(1e-16,1e308)`; `lgammaDiffDD(5e-324,1e308)`; `lgammaDiffDD(1e-300,15)`; `lbeta(1e-8,1e308)`; and `beta(0.5,1e308)`. The subnormal-ratio cases were assessed with binary64 operation bounds; no runtime output is claimed.
- Result: no new independent, reproducible defect established; no new Issue filed. No source code changed.
- Rとの関係: the recurrence and Stirling expansion identities were checked analytically; no R executable or package runtime was run.
- 検証範囲: complete `lgammaDiff.ts`, all current internal call sites, recurrence boundary, subnormal ratio, large-B inverse powers, DD leading-term switch, and Stirling truncation. No Vitest, package runtime, or R execution.


## Audit #541 — `src/special/beta.ts` beta / log-beta integration and extreme arguments

- Source blob: `src/special/beta.ts` `bd639c0fdaa40df7e6579ffa0b76a67c6d738e97`. Dependencies rechecked: `lgammaDiff.ts` `22ddcc50b01890dafbbb49a1a1aa7ac2c840dfee`, `dd.ts` `2edeba6b0c0f5e7714d3d1416e4d6f9da5b17c2f`, `loader.ts` `c85075fbce1fb3ff6933cbdb5c50477de3d25abf`, and `gamma.ts` `f630bdd496fc204dd24b6b04603c7b511a5cb107`.
- Traced exact order of NaN/negative/infinity/zero guards, large-positive dispatch, small-shape gamma-ratio path, `lbetaHuge`, `lbetaDD`, ordinary gamma-product path, and `lbetaAsymp`. Confirmed positive finite large arguments are intercepted by the `a>0 && b>0 && max>15` branch before the older `lbetaAsymp` condition; the latter is effectively only reachable for zero-shape cases after nonnegative validation, where the intended beta result is +Infinity. `lbeta()` checks zero before its asymptotic branch.
- `lbetaHuge(a,b)` was checked for `a+b` overflow. Its `sumTerm` switches from `(a+b-0.5)*log1p(b/a)` to `a*L+(b-0.5)*L`; for a=b=1e308 each product remains finite. `stirlerr(Infinity)` returns zero through the `n>15` series path (`1/Infinity=0`), consistent with the vanishing Stirling correction. The leading `b*log(b/a)` is double-double, and the `-0.5 log b` and sum term retain the correct sign and scale.
- For `lo<1`, the `beta()` route computes `Gamma(lo)*exp(-lgammaDiffDD(lo,hi)[0])*(1-lowCorrection)`; with lo subnormal the gamma factor may overflow only when the true beta also exceeds binary64 range. For representable cases such as lo=1e-308 and hi=1e308, the gamma factor is finite and the ratio exponent is negligible. The corresponding `lbeta()` route subtracts `lgammaDiff()` rather than subtracting two large lgamma values.
- The `min(a,b)<1e-300` fallback in `lbeta()` occurs only outside the positive-large branch. For two tiny positive shapes, `a+b` cannot underflow to zero because it is at least twice `Number.MIN_VALUE`; when one shape is much smaller than the other, rounding `a+b` to the larger value discards a log-gamma difference of order `a*|psi(b)|`, below binary64 output resolution in the checked range.
- Checked `beta()`'s product ordering heuristic (`ga*y*gb` vs `gb*y*ga`) against large/small gamma factors, `1/min(a,b)` overflow shortcut, and the exact endpoint/infinity semantics. `beta(1e308,1e308)` underflows to zero consistently with its log value; `beta(1e308,1)` and `beta(1e308,0.5)` remain representable; `beta(1e308,1e-320)` overflows as expected.
- Deterministic source-level edge probes (not runtime outputs): `beta(1e308,1e308)`, `lbeta(1e308,1e308)`, `beta(1e308,1)`, `beta(1e308,0.5)`, `beta(1e308,1e-308)`, `beta(1e308,1e-320)`, `lbeta(1e-310,1e-310)`, `lbeta(1e-320,1e-20)`, `beta(0,Infinity)`, `beta(Infinity,0)`, `beta(Infinity,1)`, `lbeta(Infinity,1)`, and swapped argument order. These are path/IEEE-754 analyses, not claimed runtime results.
- Result: no new independent, reproducible defect established; no new Issue filed. No source code changed.
- Rとの関係: checked beta/gamma identities and consistency with documented R semantics; no R executable, Vitest, or package runtime was run.
- 検証範囲: complete `beta.ts`, actual `gamma`/`lgamma`/`lgammaDiffDD`/`stirlerr` helper behavior, all dispatch boundaries, extreme finite and nonfinite arguments, symmetry, and representability. No runtime execution. No source code changed.


## Audit #542 — `src/special/gamma.ts` gamma reflection, Stirling threshold, and log-gamma Taylor

- Source blob: `src/special/gamma.ts` `f630bdd496fc204dd24b6b04603c7b511a5cb107`. Related sources: `constants.ts` (`MAXGAM=171.624376956302725`, `MACHEP`), `polevl.ts`, `dd.ts`, and `loader.ts` (`stirlerr`).
- Re-derived the negative-argument reflection formulas. For q=-x, `Gamma(-q)=-pi/[q*sin(pi*q)*Gamma(q)]`; the code's `z=q*sinpi(frac(q))` is therefore required, not an erroneous extra factor. The sign is determined by floor(q) parity and remains unchanged when the fractional part is reflected from >0.5 to <0.5. Checked intervals around -34 and half-integers.
- `sinpi()` reduction to x mod 2 was checked in all four half-periods, including negative arguments, exact integers, half-integers, and signed zero. For |x|>2^53 all representable doubles are integers, so the negative gamma pole branch correctly detects them before relying on fractional reduction.
- The negative-gamma fallback for an overflowing `|sin(pi*q)|*Gamma(q)` denominator rewrites Gamma(q) as Gamma(q-10) times ten factors. For q up to the range where the result can remain subnormal, q-10 is still below MAXGAM and each factor is finite; beyond that range the true reflected value underflows to zero. The multiplication order preserves cases where the direct denominator overflows but the final reciprocal is subnormal.
- Positive `gamma()` switches at x>33 to `stirf(x)`, with n=x-1>=32 and a seven-term Stirling correction. The correction truncation is far below binary64 error at n>=32. At MAXGAM the direct exponential/product path remains within the finite range; above MAXGAM the function returns Infinity. `lgammaSign()` switches to the large-x formula at 1000 and returns Infinity above MAXLGM; its leading expression is the log-gamma Stirling form.
- `lgammaSign()` near zero returns `-log|x|` for |x|<1e-300, avoiding reciprocal overflow; the omitted `-Euler*x` term is far below the ulp of the log result. For larger small arguments the recurrence and sign tracking were checked against the gamma recurrence. Negative integer poles return +Infinity for log-absolute-gamma.
- `lgamma()` special windows around 1 and 2, `lgamma1p()` windows around 0 and 1, and the 41-term zeta Taylor were checked at both inclusive endpoints. The Taylor recurrence generates (-1)^n*zeta(n)*x^n/n; at |x|<=0.2 the omitted tail is far below binary64 precision. The near-1/near-2 transformations preserve relative accuracy where lgamma itself approaches zero.
- Deterministic source-level probes (not runtime outputs): `gamma(-34.00000000000001)`, `gamma(-34.5)`, `gamma(-34.99999999999999)`, `gamma(-171.5)`, `gamma(-172.5)`, `gamma(33)`, `gamma(33.00000000000001)`, `gamma(MAXGAM)`, `gamma(MAXGAM+2**-44)`, `lgammaSign(-34.00000000000001)`, `lgammaSign(-1e100)`, `lgamma(0.8)`, `lgamma(1.2)`, `lgamma(1.8)`, `lgamma(2.2)`, `lgamma1p(±0.2)`, `lgamma1p(1±0.2)`, and `gamma(±5e-324)`. No runtime result is claimed.
- Result: no new independent, reproducible defect established; no new Issue filed. No source code changed.
- Rとの関係: reflection, recurrence, and log-gamma identities were checked against R-compatible semantics and the source's existing fixture suite; no R executable, Vitest, or package runtime was run.
- 検証範囲: complete `gamma.ts`, `sinpi`, `stirf`, `lgammaSign`, `lgamma`, `lgamma1p`, `lgam1pTaylor`, all threshold transitions, negative poles, subnormal values, and overflow/underflow paths. No runtime execution.


## Audit #543 — `src/special/erf.ts` erf / erfc / erfcx rational regions and subnormal tails

- Source blob: `src/special/erf.ts` `f72136920c3138354d5d6cd4a342055e590e0fad`. Related helpers: `polevl.ts`, `dd.ts` (`twoProd`), and `constants.ts`.
- Re-derived the three rational regions: `erf` uses T/U for 0<=x<=1; `erfcx` uses P/Q for 1<=x<8 and R/S for x>=8. The boundary choices are consistent with the Cephes approximants; the two erfcx branches both approximate exp(x²)*erfc(x), so erfc applies exp(-x²) only once.
- `erf(x)` negative symmetry, NaN, infinities, and the x=1 transition were traced. For x>1, `1-erfc(x)` is expected to round to 1 in the far tail; small x uses the direct rational formula and avoids subtracting two nearly equal normal CDF values.
- `erfc(a)` uses `1-erf(a)` for |a|<1 and `2-erfc(|a|)` for negative a outside that interval. For positive a it uses `twoProd(x,x)` to retain the low part of x²; `1-lo` is the first-order exp(-lo) correction. The `hi<700` and `hi>=700` paths preserve the subnormal tail by applying exp(-700) last. The `hi>MAXLOG+40` cutoff is beyond the point where erfc is representably nonzero.
- `twoProd(Infinity,Infinity)` is guarded by the nonfinite product return `[Infinity,0]`; `erfc(Infinity)` therefore exits through the large-hi cutoff without consuming a NaN residual. The same gives erfc(-Infinity)=2 and erf(±Infinity)=±1.
- `erfcxNonNegative(x)` switches to `1/(sqrt(pi)*x)` only for x>1e8. The first omitted relative correction is 1/(2x²), at most 5e-17 at the switch and smaller thereafter, below half an ulp of the returned binary64 value. At x=1e8 the rational polynomial is still safely below overflow.
- Deterministic source-level probes (not runtime outputs): `erf(±0)`, `erf(±1)`, `erf(±Infinity)`, `erfc(±1)`, `erfc(27.2)`, `erfc(27.3)`, `erfc(±Infinity)`, `erfcxNonNegative(0.9999999999999999)`, `erfcxNonNegative(1)`, `erfcxNonNegative(7.999999999999999)`, `erfcxNonNegative(8)`, `erfcxNonNegative(1e8)`, `erfcxNonNegative(1e8+1)`, `erfcxNonNegative(1e308)`, and NaN. The hi=700 and MAXLOG+40 cutoffs and x² overflow were checked analytically.
- Result: no new independent, reproducible defect established; no new Issue filed. No source code changed.
- Rとの関係: erf/erfc are not directly exported as R base functions in the same form; the normal-tail identities and existing mpmath fixture strategy were reviewed. No R executable, Vitest, or package runtime was run.
- 検証範囲: complete `erf.ts`, all rational coefficient regions, symmetry, infinities, NaN, `twoProd` interaction, subnormal output scaling, and large-x asymptote. No runtime execution.


## Audit #544 — `src/special/igamAsympCoeff.ts` Temme coefficient matrix integrity and indexing

- Source blob: `src/special/igamAsympCoeff.ts` `303c31a00d04790f242125345c8a1d6e984b0774`; consumer: `src/special/igam.ts`.
- Parsed the source matrix programmatically: exactly 25 row arrays, each containing exactly 25 numeric entries (625 total). All entries are finite decimal literals. Constants `IGAM_ASYMP_COEFF_K=25` and `IGAM_ASYMP_COEFF_N=25` match the matrix dimensions.
- Traced the consumer `temmeSum()`: outer k loop is 0..24; each row begins at n=0 and the inner loop is n=1..24; `etapow` is grown monotonically only when a new n is required. All indexed reads `D[k]`, `dk[n]`, and `etapow[n]` are within bounds for the declared dimensions.
- The inner coefficient series stops when the next eta term is below machine epsilon relative to the accumulated coefficient; the outer 1/a series stops before a term grows or after it falls below machine epsilon relative to the sum. For eta=0 only n=0 contributes; for small eta the higher powers decay quickly. The far-asymptotic path switches to the closed c0 expression when a>1e299 and |eta|>0.1, so this table is not evaluated at extreme eta where its polynomial terms could grow.
- Static deterministic boundary probes for consumer indexing: eta=0, ±Number.MIN_VALUE, ±0.1, ±0.3, ±1, and ±4.5/sqrt(a), with k/n loop limits fixed by the exported constants. These are index/path analyses, not claimed numerical runtime outputs.
- Result: no malformed row, missing coefficient, nonfinite literal, or out-of-range consumer access established; no new Issue filed. No source code changed.
- Provenance limitation: the file identifies SciPy's `_precomp/gammainc.py` as the generator, but the generator was not fetched or executed and no independent 625-value numerical comparison was performed. This audit establishes matrix integrity and consumer indexing, not independent correctness of every table coefficient.
- Rとの関係: no direct R code is involved; this is the coefficient table for Temme's incomplete-gamma expansion. No R executable, Vitest, or package runtime was run.
- 検証範囲: complete coefficient file, all 625 literals, exported dimensions, `temmeSum()` indexing and truncation conditions, and the far-asymptotic bypass. No runtime execution.


## Audit #545 — `src/special/polevl.ts` Horner evaluators and call-site contracts

- Source blob: `src/special/polevl.ts` `165b2c81afea8cb58b56f67264dafdf22810f089`. Rechecked consumers in gamma, erf, and other special-function coefficient evaluators.
- `polevl()` evaluates coefficients in descending degree using `ans=coef[0]` followed by `ans=ans*x+coef[i]`; `p1evl()` evaluates the monic polynomial with initial `ans=x+coef[0]`. These operation orders match the Cephes definitions and the documented coefficient conventions.
- The generic functions do not validate empty arrays (`polevl([],...)` returns undefined at runtime despite the declared number return type; `p1evl` behaves similarly). However, they are internal numerical helpers and the reviewed call sites all pass fixed, nonempty coefficient arrays. No reachable public API path supplies an empty coefficient list.
- Horner evaluation naturally propagates NaN and infinities; no unexpected finite-range guarantee is implied. For finite x, overflow in intermediate polynomial terms is intrinsic to the represented polynomial and the callers restrict x to the approximation region where the selected coefficient set is valid.
- Deterministic source-level probes: `polevl(2,[1,2,3])`, `polevl(0,[1,2,3])`, `polevl(-2,[1,2,3])`, `p1evl(2,[2,3])`, `p1evl(0,[2,3])`, `polevl(±Infinity,[1,2])`, and `p1evl(NaN,[1])`. These are operation-order/path checks, not claimed runtime outputs.
- Result: no new independent, reachable, reproducible defect established; no new Issue filed. No source code changed.
- Rとの関係: none; these are generic polynomial evaluation helpers. No R executable, Vitest, or package runtime was run.
- 検証範囲: complete `polevl.ts`, Horner coefficient ordering, empty/single-element array behavior, nonfinite x propagation, and internal call-site contracts. No runtime execution.


## Audit #546 — `src/special/log1p.ts` and `src/special/log1pmx.ts` elementary log kernels

- Source blobs: `log1p.ts` `dc2f13d6617f0ce76986a8b88f353c45819d378f`; `log1pmx.ts` `2645eccad6849a9c217899b99e71e58d6e7055f8`; callers reviewed in `igam.ts` and `gamma.ts`.
- Rechecked special-value guards for `log1pmx`, `lgamma1p`, `log1mexp`, and `log1pexp`, including NaN, ±Infinity, signed zero, poles, and the -37/18/33.3 switching thresholds. The `log1pexp` approximations omit terms below half an ulp at their switch points; no output-affecting defect established.
- New issue: `log1pmxKernel()` loops n=2..499 (498 iterations) for x=0 and for nonzero x whose square underflows. The first and all later terms are signed zero, while the convergence test compares 0<0 and never breaks. Exact zero is reachable through `igam.ts:temmeEta()` when x=a, where sigma=(x-a)/a=0. The nonzero tiny inputs also lose the negative-zero sign of the mathematically negative result.
- Deterministic inputs: `log1pmx(0)`, `log1pmx(Number.MIN_VALUE)`, `log1pmx(1e-200)`, `log1pmx(-1e-200)`, `log1pmx(±0.5)`, `log1pmx(-1)`, `log1pmx(Infinity)`, and NaN. The loop count and signed-zero behavior are derived directly from the source operations; no runtime benchmark or execution was performed.
- Created [Issue #106](https://github.com/numero-uno-jpn/rStats.js/issues/106) for the 498 unnecessary iterations and signed-zero loss. This is primarily a performance/edge-semantics defect, not a nonzero numerical-value error.
- Result: Issue #106 is the only new finding in this pass. No source code changed.
- Rとの関係: the kernels follow Rmath/DPQ conventions; signed-zero and performance behavior were not compared against an R executable.
- 検証範囲: complete `log1p.ts` and `log1pmx.ts`, internal `log1mExp` and `lgamma1p` call paths, exact branch boundaries, and the incomplete-gamma `temmeEta` reachability. No Vitest, package runtime, or R execution.


## Audit #547 — choose.ts

`lchoose(Number.MIN_VALUE,2,{rCompatible:false})` は、係数がDD中間計算でunderflowして0になるため、有限であるべき対数を`-Infinity`と返す。`Number.MIN_VALUE=2^-1074`なので期待値は`-1075*ln(2)≈-745.1332191019411`。同じ問題は負の最小subnormalでも起きる。Issue [#107](https://github.com/numero-uno-jpn/rStats.js/issues/107)を作成。ソース追跡のみでruntime/Vitest/R未実行。


## Audit #548 — psigamma.ts

Digamma、trigamma、任意次数polygammaを再監査。負根近傍Taylor、Hurwitz zetaのEuler–Maclaurin補正、正の引数のスケーリング、負引数の反射式、cot導関数多項式の次数100までを追跡した。今回、新規の再現可能な数値不具合は確定せず。ソース追跡のみでVitest/package runtime/R実行なし。


## Audit #549 — extra.ts

`gammainc()`の非正規化下側・上側tail、極小shapeと巨大shape、`erfcinv()`のsubnormal log確率経路、`erfinv()`の小値展開とNewton補正、`perm()`のfalling factorial・巨大n gamma ratio・反射経路を再監査した。今回、新規の再現可能な不具合は確定せず。ソース追跡のみでVitest/package runtime/R実行なし。


## Audit #550 — distributions/normal.ts

最新ソースでpnorm/qnorm/dnormを再監査。既存Issue #33の中間overflowは`(a / 2) * a`への変更で修正済み。新規Issue #108: `qnorm(0.5,{mean:3,sd:Infinity})`が3を返すが、Rのqnorm.cでは`mean + Infinity*0`となりNaN。`affine()`の中央値特例が原因。pnorm/dnormの無限sd処理、確率端点、負sd、NaN/Infの順序も確認。Rソース参照あり、R実行/Vitest/package runtimeは未実施。


## Audit #551 — ndtri.ts

標準正規分布の逆CDFとlog確率版を再監査。中央有理近似と裾近似の切替、upper-tailの1-y補数、subnormal確率、`ndtriExp`のy=-MAX/2での平方根オーバーフロー回避、±Infinity/NaNを追跡した。新規の再現可能な不具合は確定せず。ソース追跡のみでVitest/package runtime/R実行なし。


## Audit #552 — internal/vectorize.ts

分布関数のscalar/Array/Float64Array入力について、戻り形状、空配列、readonly配列、typed-array mapとinstanceof分岐を再監査した。宣言された入力契約内で新規の再現可能な不具合は確認せず。ソース追跡のみでruntime/Vitest未実行。


## Audit #553 — `src/internal/ddexp.ts` cross-path IEEE-754 audit

最新ソースSHA `14e46651c7ff1d1a6269ab50eded32183465172d` を全体再監査。`ddExp`の±708/709.8境界とrange reduction、`standardizeDD`の差分overflowとsubnormal再スケーリング、`divideTail`の残差計算、`expNeg`/`expNegOver`のsubnormal final scaling、log-sum-expとlocation-scale変換を追跡。

既存Issue #52/#54はclose済み。#52は`twoProd()`のVeltkamp splitter overflow時に`prodErrScaled()`へfallbackする修正を確認。#54は`logAddExp()`の両端Infinity guardを確認。両方とも現行コードで原因が解消。

Issue #108の関連箇所として`affine()`と`locationScale()`の`scale===Infinity && t===0`特例を再確認。中央値の極限をlocationとする設計は数学的には自然だが、R `qnorm.c` はsigma>0なら標準化quantileを計算して`mu + sigma * val`を返し、p=0.5で`Infinity*0`がNaNとなるためR互換性差は残る。Rソースの該当箇所（sigma==0特例後にquantile計算し、最後にmu+sigma*val）を参照。<https://fossies.org/linux/R/src/nmath/qnorm.c>。

`expNegOver`はt<2000の範囲でsを2冪正規化し、最終指数を2段階で適用する。s=Number.MIN_VALUE、1、Number.MAX_VALUEとtが0/約700/約744/1999/2000の境界を追跡し、2000 cutoff後の最小sでも結果はsubnormal下限未満となる。`logAddExp`, `logSubExp`, `log1mExp`, `logOneMinusExpNeg`の±Infinity、同値、ゼロ、NaNを確認。

結果: #108の既知互換性差以外に新規の再現可能な不具合なし。Issue追加なし。ソース静的監査のみ。Vitest/package runtime/R実行なし。


## Audit #554 — Laplace and logistic density overflow / subnormal rounding

`src/distributions/logistic.ts` と `src/distributions/laplace.ts` の大scale density経路を横断監査。

- Issue #109: `dlogis(6.41493903021196e307,{scale:1.282987806042392e308})`。標準化値z=0.5、e=exp(-0.5)は正常だが、非log経路の`scale*(1+e)*(1+e)`がInfinityにoverflowしdensity=0。log経路は約-710.8935541918609で、expした値は約1.831690925625393e-309とsubnormalながら表現可能。巨大有限scaleの分母形成順序が原因。Issue [#109](https://github.com/numero-uno-jpn/rStats.js/issues/109)。
- Issue #110: `dlaplace(7.2357573010898871e307,{sigma:1.4471514602179774e308})`。z=0.5で、`2*sigma` overflow branchが`(e/sigma)/2`と2回に分けてsubnormal丸めを行う。binary64入力値からの厳密有理値を一度だけ丸めた結果との差は1 subnormal ULP。Issue [#110](https://github.com/numero-uno-jpn/rStats.js/issues/110)。
- いずれも deterministic finite inputs。数値参照はbinary64演算と厳密有理値の比較。package runtime/Vitest/Rは未実行。


## Audit #555 — `src/distributions/cauchy.ts` extreme-scale and tail paths

`dcauchy`, `pcauchy`, `qcauchy`を最新ソースで再監査。既存Issue #25はclose済みで、`overPiScale()`のπ*scale overflow時の順序変更を確認。tiny scale densityのfrexp、巨大なx-location差のhalfDistance、subnormal tailのlog fallback、極端なquantileのtinyTail 4分割指数計算を追跡した。`scale=Infinity`のquantileはRと異なるlimit extensionとしてコードコメントに明記されているため、追加Issueにはしない。新規再現バグなし。Vitest/package runtime/R実行なし。


## Audit #556 — `src/distributions/weibull.ts` logRatio cancellation near unity

`logRatio(a,b)`がnormal finiteなa/bに対して`Math.log(a/b)`を使うため、a,bが近接する大きなbinary64値では除算時の相対差の丸めがlogに増幅される。再現: `shape=2**52`, `scale=shape-0.5`, `x=scale`, `dweibull(x,shape,{scale,log:true})`。u=1なので厳密なlog densityは`log(shape/scale)-1`。100桁Decimalではlog ratio≈1.11022302462515660205e-16だが、除算は`1+2^-52`に丸まりMath.logは≈2.2204460492503128e-16となる。log densityは現行-0.9999999999999998、正しく丸めた値-0.9999999999999999。Issue [#111](https://github.com/numero-uno-jpn/rStats.js/issues/111)。logU/exp/dd/p/q各経路も静的に再確認。Vitest/package runtime/R実行なし。


## Audit #557 — `src/distributions/exponential.ts` rate and tail boundary audit

`dexp/pexp/qexp`を最新ソースで再監査。rate=0/Infinity、x/q=0/Infinity、rate*xのnormal/subnormal/overflow、lower-tail logP、upper-tail logP、qexpの極小確率と`expNegOver`経路を追跡した。既存Issue #27はclosed。`pexp(1e-20,{rate:1e-300,logP:true})`のsubnormal product residual喪失を再確認し、`pexp(1e-200,{rate:1e-200,logP:true})`のようなunderflow-to-zeroも同じR互換系の極限挙動と判断。独立した新規Issueは作成しない。追加の再現可能な独立不具合なし。Vitest/package runtime/R実行なし。


## Audit #558 — `src/distributions/lognormal.ts` double-double square and quantile boundary

`zOf`, `halfSquare`, `pnormDD/smallTail`, `refineStdQuantile`, `dlnorm`, `plnorm`, `qlnorm`を再監査。新規Issue #112: `halfSquare()`は|z[0]|>1e150でDD低位成分を捨てる。`dlnorm(1,{meanlog:1.0725839319986903e305,sdlog:7.295160993704339e154,log:true})`で厳密なbinary64入力から100桁Decimalで求めたz²/2は1.0808435033670651e300だが、現行shortcutは1.0808435033670653e300となりlog densityで1 ULP差。Issue [#112](https://github.com/numero-uno-jpn/rStats.js/issues/112)。

また`qlnorm()`の`sdlog=Infinity`, p=0.5は`qnorm()`のlocation-scale中央値特例を継承し、Rとは異なる有限値となる。これはIssue #108の共通locationScale挙動に関連する。tail refinementと巨大sdlogの分岐も静的追跡。Vitest/package runtime/R実行なし。


## Audit #559 — `src/distributions/gamma.ts` shape/rate/scale and near-unity log density

`dgamma/pgamma/qgamma`を最新ソースで再監査。shape=0/1/Inf、scale/rate整合、subnormal rateからscale=Inf、tiny yのlog density/CDF、lower/upper log tail、tiny quantile、deep-tail初期値、scale overflowを追跡。

新規Issue #113: `scale=0.36787944117144228`（binary64のnextDown(exp(-1)))、`x=scale`、`shape=1`で、log densityの厳密値は`-1-log(scale)≈1.1711009840963589e-16`。`logOfLinear()`が`f/scale`を`1+2^-52`に丸めてからMath.logするため、約`2.2204460492503128e-16`を返す。近1の比の相対差が除算で失われる。Issue [#113](https://github.com/numero-uno-jpn/rStats.js/issues/113)。

既存の`pgamma(Infinity,892.4,{rate:2.8e-316})`のR差はソースコメントに記載された仕様差として扱い、別Issueにはしない。Vitest/package runtime/R実行なし。


## Audit #560 — `src/distributions/beta.ts` density, tails, and quantile inversion

`dbeta/pbeta/qbeta`の支持域端点、shape=0/Infの点質量、shape=1の閉形式、Loader binomial density identity、a+b overflow、tiny `(a+b)*min(x,1-x)` direct-log fallback、double-double complement pair、quantileのleft/right reflection、concentrated-distribution step bisection、gamma-based initial guessを再監査した。

`pbeta(q<0, shape=0/Inf)`はRと異なるが、`test/beta.test.ts`でknownDifferenceとして明示されている。実装はq<0の支持域外を0とする設計を選択しており、意図的な互換性差としてIssue化しない。既知の極端値ケースと巨大shape/極小shapeを追跡し、新規の再現可能な不具合は確定せず。Vitest/package runtime/R実行なし。


## Audit #561 — `src/distributions/nbeta.ts` noncentral beta mixture and endpoint audit

Noncentral beta/FのPoisson mixture、`betaKernel` ratio/increment、subnormal log increment、extreme method dispatch（chisq/gamma/w/integral）、left-tail log、density endpoints、quantile search、F変換のoddsを再監査。

新規Issue #114: `dbeta(0.5,0.75,Number.MIN_VALUE,{ncp:0.1,log:true})`。`method`はmixture、jStar=0.25でj0=0。j=0 incrementの`s=0.75,b=Number.MIN_VALUE`では`s/b`がInfinityとなり、`Math.log1p(s/b)`もInfinity。`betaKernelIncLog`は-e^?ではなく`-Infinity`を返し、Poisson mixtureの支配的j=0項が消える。b→0+の漸近密度は`b*x^(a-1)/(1-x)*exp(-mu*(1-x))`でlog≈-743.5986379456813。j>=1項のみでは約3.70 log units低くなる。Issue [#114](https://github.com/numero-uno-jpn/rStats.js/issues/114)。

既存Issue #63はclosedであることを確認。#508のx=1,b=1 endpoint log densityにおける`Math.log(a+mu)` overflowも既知項目として再確認。ソース追跡のみでVitest/package runtime/R実行なし。


## Audit #562 — `src/distributions/nchisq.ts` subnormal correction and asymptotic dispatch

Noncentral chi-squareのmixture、subnormalHalf、Bessel Hankel/Debye asymptotic、Chernoff tail bound、quantile searchを再監査。

新規Issue #115: `dnchisq(5*Number.MIN_VALUE,8000,1)` と `pnchisq(5*Number.MIN_VALUE,8000,1)` のlinear経路。x/2のsubnormal丸め補正でx2=4*MIN、lt=ln(1.25)、df/2=4000のため`exp((a-1)*lt)`または`expm1((df/2)*lt)`がInfinity。x2でのlinear density/CDFは0なので`0*Infinity`がNaN。正しいlinear値は0、log経路はlog空間補正で有限。Issue [#115](https://github.com/numero-uno-jpn/rStats.js/issues/115)。

既存#64の巨大Poisson index停滞と、subnormal x/2をMIN_VALUEに近似する仕様も再確認。Vitest/package runtime/R実行なし。


## Audit #563 — `src/distributions/t.ts` central Student t numerical boundaries

`dt/pt/qt`のtiny-df近似、huge-df正規極限、`dtCore`のtwoProd/bd0/大x対数式、`betaArgs`の共通2冪スケーリング、subnormal xの裾確率、deep-tail quantile初期値と最大有限double判定を再監査。tiny-dfの`asinh`とoverflow時log変換、ptの小さいtailの直接評価、qtのlower/upper signも追跡。新規の再現可能な不具合なし。Vitest/package runtime/R実行なし。


## Audit #564 — `src/distributions/nt.ts` noncentral t integral and extreme limits

Noncentral tのformula A/B integral、double-double node/normal argument、Laplace methodのfallback、nearZero、farLimit/farTails、tiny df、huge df normal limit、qnt sign selection/sideStartを再監査。既存Issue #66の`pt(Number.MIN_VALUE,1e4,{ncp:1.7e308,logP:true})`を重複起票せず確認。追加の巨大delta/巨大dfでfarLimit overflowする組合せも追跡したが、Laplace/normal limitまたは通常積分へ退避し、新規の独立した再現バグは確定せず。Vitest/package runtime/R実行なし。


## Audit #565 — `src/distributions/f.ts` F ratios, density, CDF and quantile

`dfDensity1/fDensity`, `fRatios`, `pfTiny/pfRaw`, `qChisqLimit`, `fQuantileGuess`, `qf1`の極端値経路を再監査。既存Issue #32はclosedで、m<2の大きなdf2で中間係数がoverflowする経路が`fLogDensity`へ切り替わっていることを確認。

新規Issue #116: `df(1e150,1e150,1e308,{log:true})` と `pf(1e150,1e150,1e308,{logP:true})`。mx=1e300がfRatiosの絶対cutoff1e290を超えてundefinedとなり、caller fallbackは`q=n/m/x=1e8`, `p=1-q<0`を作る。しかし実際のbeta coordinateはp≈1e-8,q≈1。invalid pをdbinomRawDD/betaIncへ渡すためNaN。Issue [#116](https://github.com/numero-uno-jpn/rStats.js/issues/116)。

その他のscaled ratio、極小/巨大x、df2=Infinityのχ² limit、qfの上下端quantile判定を静的に追跡。Vitest/package runtime/R実行なし。


## Audit #566 — `src/distributions/chisq.ts` central chi-square parameter forwarding

`dchisq/pchisq/qchisq`の薄いwrapperを再監査。負のsubnormal dfをdf/2で-0に丸める既存Issue #26はclose済みで、現行`df<0 ? NaN : df/2` guardを確認。正の`Number.MIN_VALUE`ではdf/2が+0となるが、これはR側のdouble演算でも同じshape=0 underflow behavior。数学的な極小shape tailを保持する拡張余地はあるが、今回のR互換監査では独立バグとして起票しない。Infinity/NaN/±0とncp委譲を確認。新規不具合なし。Vitest/package runtime/R実行なし。


## Audit #567 — `src/distributions/binomial.ts` large-n exact integer subtraction and tail accuracy

`dbinom/pbinom/qbinom`を再監査。size integer validation、x floor tolerance、prob=0/1、2^53超の`x+1`補正、`n-x`のtwoSum検査、upper-tail logSubExp fallback、Cornish-Fisher初期値、half-even endpoint roundingを確認。

新規Issue #117: `pbinom(1,1e16,1-2**-53,{logP:true})`。`x+1-x===1` branchでは`n-x`のexactnessを確認せず、9999999999999999が1e16へ丸められる。x=1のtail identity`q^(n-1)*(q+n*p)`で80桁Decimal referenceを計算するとlog=-367368005696770940.4129709667910。b=nと誤った場合は-367368005696770977.1497715364681で約-36.7368ずれる。Issue [#117](https://github.com/numero-uno-jpn/rStats.js/issues/117)。Vitest/package runtime/R実行なし。


## Audit #568 — `src/distributions/poisson.ts` large-lambda tails and discrete quantile

`dpois/ppois/qpois`を再監査。lambda=0/Infinity、q<0/Infinity、非整数q、2^53超のx+1 rounding correction、gammaIncとpmfの上下尾identity、logSubExp fallback、Cornish-Fisher start、discreteQuantileの境界/停止を確認。`ppois(1e16,1e16)`の既存補正を追跡し、binomialの`n-x` roundingに相当するshape差分はPoisson側にはない。新規の再現可能な不具合なし。Vitest/package runtime/R実行なし。


## Audit #569 — `src/distributions/geometric.ts` large exponent and closed-form quantile

`dgeom/pgeom/qgeom`を再監査。`probPair`のexact complement、qPowのLoader経路とn≥1e290のscaled log積、subnormal p、上下tail/logP、`log1mExp`、quantileのDD log比、discrete jump境界のslackを確認。`qPow`の`qd[0]===1`二項展開はp<約2^-54でのみ使い、未採用のp³以降の相対影響はp²/3未満でbinary64精度より十分小さい。新規の再現可能な不具合なし。Vitest/package runtime/R実行なし。


## Audit #570 — `src/distributions/negbinomial.ts` probability parameterization and small-shape series

`d/p/qnbinom`のprob/mu parameterization、`fromMu` double-double ratios、`dnbinomRaw`、`pnbinomRaw` large-x correction、small-size upperSeries、Cornish-Fisher/gamma quantile starts、continuous Newton refinement、Poisson limitを再監査。

既存Issue #95を拡張。`fromMu`でsize/(size+mu)がunderflowする元の例に加え、逆方向のq=mu/(size+mu) underflowも確認: `dnbinom(1,Number.MAX_VALUE,{mu:Number.MIN_VALUE})`および`pnbinom(0,Number.MAX_VALUE,{mu:Number.MIN_VALUE,lowerTail:false,logP:true})`。q≈2.75e-632はDD componentに表現できず0となるが、PMFとupper-tailは約Number.MIN_VALUE、log≈-744.4400719213812で表現可能。`dbinomRawDD`/`betaIncDD`のq=0 endpoint処理で消失。Issue [#95](https://github.com/numero-uno-jpn/rStats.js/issues/95)本文更新。追加の独立Issueなし。Vitest/package runtime/R実行なし。


## Audit #571 — `src/distributions/hypergeometric.ts` total-population rounding and overflow

`dhyper/phyper/qhyper`のsupport、binomialLimit、hyperForm、three-binomial decomposition、directTail ratio recurrence、CDF/quantileの2^53 guardを再監査。

新規Issue #118: `m+n`を単一doubleで形成するため、(1) `m=1,n=1e16,k=1e16`では正確なN=10000000000000001が1e16に丸まりq=(N-k)/N=0、p=1となり、P(X=0)≈1e-16とP(X=1)≈1の両質量を失う。(2) `m=n=k=1e308`ではN=Infinity、p=0,q=NaNとなるが、平均x=5e307のPMFは約1.13e-154で有限。Issue [#118](https://github.com/numero-uno-jpn/rStats.js/issues/118)。Vitest/package runtime/R実行なし。


## Audit #571 — `src/distributions/arcsine.ts`

`darcsine`, `parcsine`, `qarcsine`を再監査。分布端点の密度特異性、a/b有限制約、b-a overflow時の1/2 scaling、x-a/b-x直接距離、sqrt factorization、CDF near-endpointのlog tail、quantileのp<e^-40漸近距離と上下端mirrorを確認。double-double logを経由するtiny tailではsubnormalへの変換・符号・補数を追跡。近端tailの`Math.exp(l[0])`はlow成分を落とすが、対象はsubnormal域でその相対寄与はsubnormal ULPより十分小さい。新規の再現可能な不具合なし。base R/extraDistrに対応関数がなくR比較対象外。Vitest/package runtime未実行。


## Audit #572 — `src/distributions/uniform.ts` overflowed interval and endpoint order

`dunif/punif/qunif`を再監査。区間幅max-min overflow時のhalf scaling、区間端点、max<=min、±Infinity endpoints、CDFの有限endpoint guard、upper/lower logP、quantileのupper-tail小確率、wide intervalの線形再構成を追跡。Rの`punif.c`でも有限endpoint guardがq境界より先であることを確認し、非有限endpointでNaNとなる現行順序は一致。`qunif`のlogP<-708における`exp(p)` underflowはRと共通の既知制約。新規の再現可能な不具合なし。Vitest/package runtime/R実行なし。


## Audit #573 — `src/distributions/logistic.ts` tail symmetry and scale extremes

`dlogis/plogis/qlogis`を再監査。`standardizeDD`の符号・低位成分、`expNeg/expNegOver`のsubnormal確率、log densityのscale cancellation、lower/upper large/small tail切替、`logit()`のp≈0.5/1、`locationScale`境界を追跡。

既存Issue #109の巨大scale density overflowは現行ソースでも再現条件が残るためopenとして保持。Issue #108の中央値・scale=Infinity共通特例も再確認。追加の独立した新規バグは確定せず。Vitest/package runtime/R実行なし。


## Audit #574 — `src/distributions/pareto.ts` ratio residual, power scaling and log tails

`dpareto/ppareto/qpareto`を再監査。`standardizeDD` ratio low residual、ratio overflow時の`logRatioDD`、`powNeg`のnormal/subnormal/overflow分岐、densityのa*e補正、極小shapeでのlog CDF、quantileのexp overflow後のlog(b)+t救済、a=Infinityの点質量極限を追跡。`b=Infinity`はvalid()で拒否し、extraDistrの有限scale parameter契約外として扱う。新規の再現可能な不具合なし。Vitest/package runtime/R実行なし。


## Audit #572 — `src/distributions/bvnorm.ts` bivariate normal orthant overflow

`pbvnorm`の完全相関の退化分布、Sheppard Gauss-Legendre quadrature、|rho|→1漸近式、orthant inclusion-exclusionを監査。既存Issue #23はclose済みで、rho=-1のY=-X区間確率のtail差修正を確認。

新規Issue [#119](https://github.com/numero-uno-jpn/rStats.js/issues/119): `pbvnorm([-1e200,-1e200],[Infinity,Infinity],0.5)`は理論上1だがNaN。`h*k`と`(h*h+k*k)/2`が共にInfinityになり、Sheppard積分の指数でInfinity-InfinityがNaNとなる。有限巨大boundsの早期極限処理またはscaled quadratic formが必要。rho境界・無限端点・反射条件も追跡。ソース静的監査のみ、Vitest/package runtime/mvtnorm/R未実行。


## Audit #575 — `src/distributions/arcsine.ts` endpoint singularity and interval scaling

`darcsine/parcsine/qarcsine`を再監査。a/b端点での密度特異性、b-a overflow時のhalf scale、near-endpoint `sqrt(d)/sqrt(w)`、subnormal CDFのlog-distance fallback、upper-tail mirror、tiny-probability quantileのlog-space distance、qbeta delegationを追跡した。double-double補数・log endpointの低位成分の影響も検討し、出力を変える再現可能な誤りは確定せず。Vitest/package runtime/R実行なし。


## Audit #573 — `src/distributions/summary.ts` moment summaries and tiny lognormal spread

全分布のsummary計算を横断確認。既存Issue #34はclose済みで、Paretoのmean/variance/skewness/kurtosisにdimensionless ratio fallbackが入ったことを現行ソースで確認。

新規Issue [#120](https://github.com/numero-uno-jpn/rStats.js/issues/120): `distSummary("lnorm",{meanlog:0,sdlog:1e-200})`。`sdlog*sdlog`が0へunderflowし、`expm1(s2)`も0になるため、真の標準偏差≈1e-200と歪度≈3e-200をともに0とする。分散≈1e-400は0への丸めが正しいが、sd/skewnessは表現可能。`sdDirect`もunderflow済み`em1`からsqrtするため回復できない。

他にuniform幅overflow、normal巨大/極小sd、beta巨大shape、Pareto修正回帰、triangularのpower-of-two scaling、exponential小rateを確認。新規独立バグなし。ソース静的監査のみ。Vitest/package runtime/R実行なし。


## Audit #576 — `src/distributions/triangular.ts` endpoint mode and log-quantile underflow

`dtriang/ptriang/qtriang`のmode=a/b、端点密度、wide interval half scaling、CDF near/far tail decomposition、subnormal log tail、quantile sqrt factorizationとnear-mode補正を再監査。

新規Issue #121: `qtriang(-1000,{a:0,b:1e308,c:0,logP:true})`および対称なc=b/upper-tail入力。`exp(-1000)`は0へunderflowするが、端点modeのquantile距離は`w*exp(-1000)/2≈2.5379794487747284e-127`で表現可能。`sqrtP=exp(p/2)`は保持されるものの、c=a/bのnear-mode branchはunderflow済みlinear tailを使い、quantileを端点に戻してしまう。Issue [#121](https://github.com/numero-uno-jpn/rStats.js/issues/121)。Vitest/package runtime/R実行なし。


## Audit #574 — `src/internal/invert.ts` continuous quantile solver

`invertContinuous()`の全公開呼出元（central t、F、beta、gamma）を確認し、いずれもpositive support上の`u=log(x)`変換を使用することを確認。linear/log target residual、cdfBoth一括評価、bracket更新、Newton/Halley切替、stuck判定、log座標収束後のx空間polish、subnormal xでのordered-bit bisectionを再監査。コメントにある非positive有限反対符号bracketのmidpoint overflowはこの公開呼出経路では到達しない。今回、新規の再現可能な不具合なし。Vitest/package runtime/R実行なし。


## Audit #575 — `src/internal/discrete.ts` discrete quantile and predicate searches

既存Issue #53はclosedで、`firstTrue()`に`Number.MAX_VALUE`の上限候補fallbackが反映されていることを確認。`firstTrue(x=>x>=1.6e308,1e308,Infinity)`の元のoverflow経路は、doubling overflow時にMAX_VALUEを候補として評価し有限区間を二分探索する。`discreteQuantile()`の既存guard、2^53超のspacing、bisectの停滞検知、NaN CDF propagation、`lastTrue()`のfinite supportも再監査。新規の再現可能な不具合なし。Vitest/package runtime/R実行なし。


## Audit #576 — `src/internal/poissonMixture.ts` scaled Poisson mixture and index safety

`Scaled`/`ScaledSum`の指数整列、fromValue/log rebuild、weightUp/down、startSearch、argmax/farEdge、sumLower/Upper、mixtureDensityの停止条件を再監査。Issue #64の候補`pchisq(9e-301,1,{ncp:1e308})`は現行`pnchisq1`のChernoff negligible-tail判定でmixtureに到達しない。その他、nchisqではz>1e6/ν>1e4でHankel/Debyeへ切替、z<=1e6でmixtureに入る場合はJ>LONG_WALKからargmaxでピークj≈z/2へ移動し、indexは2^53未満。大mu upper tailはlower mixtureの補数を使用。noncentral beta/Fは大muでintegral系へdispatchする。一般helperのj±1は2^53超で進まない潜在性を持つが、現行公開API呼出経路では再現可能な停止不具合を確定せず。Issue #64はnot reproducibleでclose。新規Issueなし。Vitest/package runtime/R実行なし。


## Audit #577 — `src/internal/noncentral.ts` ordered-double search and adaptive quadrature

`doubleKey/keyDouble`、`searchDoubles`のfail/pass方向探索、`narrowQuantile`、Gauss–Kronrod 7/15、`quadratureControl`のglobal bisection budget、`negligibleNcp`を再監査。searchDoublesのordered integer mappingは±0を同一視し、負数・正数・±Infinityの順序を保つ。quadratureの`(a+b)/2`は一般の巨大同符号端点ではoverflowし得るが、現行全呼出元（nchisq besselTails/debyeTails、nbeta integral）の区間は非負のoffsetまたはlog-coordinateの限定範囲で到達しない。再帰depth 40とglobal bisection capで停止。新規の再現可能な不具合なし。Vitest/package runtime/R実行なし。


## Audit #578 — `src/integrate/quadpack.ts` and `src/numerics/integrate.ts`

QUADPACK dqk21/dqk15iの節点・重み、resabs/resasc/error estimate、dqelg epsilon table、dqpsrt error ordering、adaptive subdivision、dqagieの無限区間変換と1/t² Jacobian、limit/ier/nevalを再監査。既存Issue #51はclosed/fixedで、`integrate.ts`が`2*max(|lower|,|upper|)` overflow時にx=2uへ2冪スケーリングし、積分値と誤差を2倍する修正を確認。`quadpack.ts`自体のmidpoint式はそのままだが、公開`integrate()`のwrapperが範囲をスケールするため既知入力を回避する。

新規Issue [#122](https://github.com/numero-uno-jpn/rStats.js/issues/122): `integrate(x=>1e-308,-1e308,1e308,{absTol:Number.MIN_VALUE,relTol:0})`。幅overflow回避branchで`absTol*0.5`が0にunderflowし、dqagseの入力validationがier=6となりRangeError。元のpositive subnormal absTolはwrapper validationを通過している。厳密な積分値は2。ソース静的追跡のみ、Vitest/package runtime/R未実行。


## Audit #579 — `src/numerics/deriv.ts` Richardson finite differences

`grad`, `jacobian`, `hessian`のstep construction、central/forward stencil、Richardson table、dimension/option validationを再監査。新規Issue [#123](https://github.com/numero-uno-jpn/rStats.js/issues/123): `grad(x=>x[0],[1],{r:41})`。初期h=1e-4を40回半減した9.094947017729283e-17はx=1のULP未満で、x+hは1、x-hは前隣接doubleに丸められる。最終central differenceは約0.6103515625となり、全段のextrapolation結果は約0.32944898034578934（真値1）。rに上限もstencil representability checkもなく、jacobian/hessianにも同じ問題がある。ソースとIEEE-754 binary64算術の追跡のみ、Vitest/package runtime/R未実行。


## Audit #580 — `src/numerics/ode.ts` fixed-step Euler / Heun / RK4

時間刻み、stage時刻、state dimension、各法の演算順序を再監査。新規Issue [#124](https://github.com/numero-uno-jpn/rStats.js/issues/124): RK4の`(h/6)*(k1+2k2+2k3+k4)`は2種類の範囲障害を起こす。A: `ode([0],[0,Number.MIN_VALUE],()=>[1],[],{method:"rk4"})`ではh/6が0にunderflowし、表現可能な増分MIN_VALUEを失う。B: `ode([0],[0,1e-308],()=>[1e308],[],{method:"rk4"})`では`2*k2`/`2*k3`がoverflowするが、厳密増分は1。両者は定数微分なのでRK4が厳密に積分できるケースである。Issue #124に統合記録。Euler/Heun、逆方向/重複times、空/単一time、derivative dimension mismatchも追跡。ソース静的監査のみ、Vitest/package runtime/R未実行。


## Audit #581 — `src/numerics/interp.ts` interpolation and spline variants

`approx`のties/NA/constant/linear、FMM/natural/periodic/Hyman cubic coefficients、monoH.FC Fritsch–Carlson limiter、`splinefunH`、barycentric Lagrange weights、global Hermite divided differencesを再監査。

新規Issue [#125](https://github.com/numero-uno-jpn/rStats.js/issues/125): `splinefun([-1e308,1e308],[0,1])([0])`および`splinefunH([-1e308,1e308],[0,1],[0,0])([0])`が0を返すが、正しい線形補間値は0.5。有限ノット差がInfinityへoverflowし、傾きが0になる。`spline()`には2冪座標scaleが実装済みだがfunction variantsには適用されていない。Issue本文に両APIの再現を記載。その他の補間契約と端点・単調性を追跡。Vitest/package runtime/R実行なし。


## Audit #582 — `src/optim/localmin.ts` Brent optimizer

Brent parabolic interpolation/golden section、bracket update、tol/eps stopping criterion、nonfinite objective handlingを再監査。既存Issue #61のR互換修正を確認: `optimize()` wrapperは探索用関数値のNaN/+InfをMAX_VALUE、-Infを-MAX_VALUEへ置換する。Issue commentでは元のhang自体は再現せず、Rとの非有限値挙動差を修正したと記録。

新規Issue [#126](https://github.com/numero-uno-jpn/rStats.js/issues/126): `optimize(x=>x*x,-1,1,{tol:0})`は最小点0に収束する過程でxがNumber.MIN_VALUE、bracketが[MIN_VALUE,2*MIN_VALUE]となり、`tol1=sqrt(EPSILON)*abs(x)+tol/3`が0。`d=0`, `u=x`, `fu=fx`となってa/x/bが不変のまま無限ループする。公開wrapperは`tol>=0`を許容する。ソースとbinary64 terminal stateの追跡のみ、Vitest/package runtime/R未実行。


## Audit #583 — `src/optim/lbfgsb.ts` limited-memory bound-constrained optimizer

L-BFGS-B 2.1 portの1-based配列offset、column-major WS/WY/SY/SS/WT/WN/SND、head/itail循環、active set、generalized Cauchy point、free-variable transition、subspace solve、dcsrch/dcstep line search、curvature updateとrestartを静的に再監査。m=1、n=1、fixed/lower-only/upper-only/both-bound、projected-gradient zero、uphill direction、line-search warning、invalid NBD等の経路を追跡。`dtrsl`のjob=11はupper-triangular transpose solve、job=1はupper solveとなりCholesky two-stageと整合。workspace最大offsetも配列長内。新規の再現可能なバグなし。gradient/scale validationは公開wrapper `optim.ts` の別監査で扱う。Vitest/package runtime/R実行なし。


## Audit #584 — `src/linalg/kappa.ts` / `svd.ts` scaled singular-value consumers

現行source SHA: `kappa.ts` `4afa8f4710940950c959fbab31eef3c4aa989154`; `svd.ts` `6192d8d18210f1e92f69cae227d58ab4469b5fe7`; `matrix.ts` `9d78a4c9ae28f2fcc55ea30b5a7297c7441f2eaf`。

既存Issue #56の修正を確認。`kappa(exact, norm=2)`は`svdScaled()`のscaled singular valuesの比を使い、元単位へscale-backしたInfinity/Infinityを避ける。`ginv()`もscaled SVDを利用し、最後に逆scaleするため、同じ巨大等方行列の逆行列subnormal成分を保持する方向へ修正済み。

ただし`ginv()`には残存欠陥。`ginv([[1e308,0],[0,1e-15]],{tol:0})`では`rangeExponent=1023`、scaled singular valuesは約`1.1125369292536007`と`1e-323`。tol=0は正の特異値を全て採用するが、現行は先に`1/1e-323`を計算してInfinityにし、その後`0*Infinity`でNaNを作る。真の逆行列は`[[1e-308,0],[0,1e15]]`で有限。Issue [#127](https://github.com/numero-uno-jpn/rStats.js/issues/127)。

SVD本体は対角入力の長さ1 Householder identity pathで小特異値を保持し、欠陥はSVD後段の逆数とscale順序に限定。ソース静的追跡のみ、Vitest/package runtime/R実行なし。


## Audit #585 — `src/linalg/ops.ts` matrix operations and sequence constructors

現行SHA `fa5626725f1f8b3d6cd1d6d2a82e54629f00f540` を再監査。`matMul`のvector/matrix shape dispatch、ragged row rejection、finite-product overflow後の`rescaledDot` fallback、column-major recycling、`diag` overload、empty vector、`cbind/rbind`の空vector filtering、`matrix`の次元丸め、`kronecker`、`seq`の3経路を追跡。

既存Issue #55はclose済み。`diag([], {nrow:2,ncol:2})`は明示的なpositive-length guardでRangeErrorとなり、`undefined`を返す不具合は解消。

既存Issue #70は現行ソースにも残存。`seq(-1e308,1e308,{lengthOut:3})`は`b-a=Infinity`をstepに使い中間値を誤る。`seq(-1e308,1e308,{by:1e308})`も`del/by=Infinity`として不当にreject。R 4.5.x `seq.default`では有限でない差分に`to/by-from/by`を使い、length.outではfrom/toを1/4にscaleして補間する。Issue [#70](https://github.com/numero-uno-jpn/rStats.js/issues/70)で既報のため重複Issueは作成せず。

他のmatrix operation経路で今回新規の独立再現不具合は確定せず。既存テストsource閲覧とRソース比較のみ、Vitest/package runtime/R実行なし。


## Audit #586 — `src/linalg/solve.ts` LU factorization scale safety

現行SHA `6e423f1c2969b896c1715f5af95864c6f59dea24` を再監査。`getrf` partial pivot/update、`getrs` forward/back substitution、`gecon/lacn2`、`trsv/trcon`、`scaledCopy`による条件推定、determinantのbinary exponent保持を追跡。

新規Issue #128: `solve([[1e308,1e308],[1e308,-1e308]],[1,0])`。行列は`1e308 * [[1,1],[1,-1]]`でcondition number=1。期待解は`[5e-309,5e-309]`。しかしunscaled `getrf`のtrailing update `-1e308 - 1e308`が`-Infinity`へoverflow。condition estimateはscaled copyで正常値を返すため検査を通過し、`getrs`は-Infinity対角で除算して誤った有限値を返す。`solve(A)`の逆行列も同じLUを使うため影響する。Issue [#128](https://github.com/numero-uno-jpn/rStats.js/issues/128)。

既存のコメントにあるtriangular substitutionのoverflow制約より前段のfactorization overflowであり、別の根本原因。静的なIEEE-754演算追跡のみ。Vitest/package runtime/R実行なし。


## Audit #587 — `src/internal/covmat.ts` R-compatible symmetry tolerance under extreme scale

- Repository HEAD: `198f542991970905a4f635d5b50e8a60f9ec540e` (`main`).
- Source blobs: `covmat.ts` `a042245164638b0c486c769de2c2a9a0eed622cd`; `eigen.ts` `86ee78a9fd9f3edbbc35e86f3805ea910e15ff18`; `summary.ts` `e4fc3bd652af3a00cf05b44389ddf58e590c4830`; `matrix.ts` `9d78a4c9ae28f2fcc55ea30b5a7297c7441f2eaf`.
- Reconfirmed existing Issue #99 and corrected its reproduction. `S = [[1e308, 1e-10], [0, 1]]` has finite entries and positive diagonal, but is asymmetric. `scaleToUnit` uses `k=1023`; the upper-right entry becomes approximately `1.112537e-318`. `isSymmetric` includes the equal large diagonal entries in `size`, so its normalized asymmetry is approximately `2e-318` and passes the `100*EPSILON` threshold.
- R 4.5.x `all.equal.numeric` removes exactly equal elements before computing the scale. For `S` vs `t(S)`, the differing target values are `c(0, 1e-10)` and current values `c(1e-10, 0)`: mean absolute difference `1e-10`, mean absolute target `5e-11`, relative difference 2. R therefore rejects this input. Official R reference: https://stat.ethz.ch/R-manual/R-devel/library/base/help/all.equal.html. The earlier `Number.MIN_VALUE` reproduction is not a valid R-difference example because R's absolute-tolerance fallback accepts that tiny difference.
- Result: confirmed R-compatibility defect; updated existing Issue #99 rather than opening a duplicate. No source code changed.
- Validation: exact binary64 scale and ratio traced; full `checkCovmat`, `scaleToUnit`, and `isSymmetric` paths reviewed. Vitest, package runtime, and R were not executed.


## Audit #588 — `src/linalg/eigen.ts` overflow in eigenvector normalization after balancing

- Reviewed current source blobs: `eigen.ts` `86ee78a9fd9f3edbbc35e86f3805ea910e15ff18`; `balance.ts` `b0796b3365f4f23a7a02efdb05628380f85cf284`; `matrix.ts` `9d78a4c9ae28f2fcc55ea30b5a7297c7441f2eaf`; `summary.ts` `e4fc3bd652af3a00cf05b44389ddf58e590c4830`; test `eigen.test.ts` `5c4198e2efd364447d590a0a869b8cd6167e137e`.
- Confirmed new defect in `normalizeVectors()`: direct accumulation `ss += m*m` overflows for finite eigenvector components above `sqrt(Number.MAX_VALUE)`. The subsequent `norm=Infinity` makes the phase/normalization coefficient zero and can zero the whole vector.
- Exact reproduction input: `eigen([[1,1e200],[0,2]])`. The finite triangular matrix has distinct eigenvalues 1 and 2. The eigenvector for 2 is proportional to `[1e200,1]`; a valid unit vector is approximately `[1,1e-200]`. The public path globally scales the matrix, `gebal("B")` applies a diagonal similarity transform to balance the very small first diagonal against the large off-diagonal, and `gebak()` restores the eigenvector to the original coordinates before normalization. The restored component ratio remains about `1e200:1`, so the square sum overflows although the normalized vector is representable.
- Opened new GitHub Issue #129. No source code changed. Existing #99 concerns symmetry tolerance and is a separate root cause; existing #379 did not cover this post-`gebak` large-component norm path.
- Validation: source-level trace of `eigen()` -> `generalEigen()` -> `gebal()` -> `hqr2()` -> `gebak()` -> `normalizeVectors()`. Test fixtures reviewed. No Vitest, package runtime, or R execution.


## Audit #589 — `src/linalg/expm.ts` scaling-and-squaring / alternate methods re-audit

- Reviewed current source blob: `48da1a1d5e46371cff1404092bbb4d3d24551d26`; existing test source: `test/expm.test.ts`.
- Re-traced all six method paths: `Higham08.b`, `Higham08`, `Pade`, `PadeO`, `Taylor`, and `TaylorO`; including 1-norm overflow recovery, power-of-two scaling, Padé 3/5/7/9/13 coefficient construction, LU quotient, Taylor/Padé Horner recurrence, CGS solve, repeated squaring with `0 * Infinity` handling, and balancing similarity-transform restoration.
- Reconfirmed the known non-termination defect in open Issue #72; no duplicate issue created. Exact reproductions: `expm([[0,1],[0,0]],{method:"Taylor",order:1e16})` and `expm([[0,1],[0,0]],{method:"Pade",order:1e16})`. In both Horner loops, `j--` does not change the binary64 value at this magnitude, so the loop condition remains true indefinitely.
- Examined the rounded Padé degree thresholds against Higham's tabulated bounds. The slight upward rounding at degree 3/9 boundaries is a potential accuracy-margin concern, but no concrete input with error beyond the project's tolerance was established; it is not filed as a confirmed defect.
- Reviewed `test/expm.test.ts`: its fixture compares all six methods against R with relative tolerance `1e-12`; tests were read but not executed.
- No new issue and no source change. Vitest, package runtime, and R were not executed.


## Audit #590 — QR Householder overflow

Confirmed finite-input overflow in `src/linalg/qr.ts`: `qr([[1e308,1e308],[1e308,1e308]])`. The first column norm is finite, but the unscaled Householder dot product overflows to `-Infinity`, corrupting the second column and potentially reporting rank 2 for an exact rank-one matrix. Expected first R diagonal is `-sqrt(2)*1e308`, finite. Scaling the input by `1e-308` avoids the overflow. Opened Issue #130. Existing Issues #57 and #71 are distinct. Reviewed `test/qr.test.ts`; no tests were executed. Source blob `b04cbd9b8fbc3fdf1cc48b07b0ca44ef9eeb2f2f`.


## Audit #591 — SVD scaling loses representable small singular values

- Reviewed source blob `6192d8d18210f1e92f69cae227d58ab4469b5fe7` in `src/linalg/svd.ts`, plus `src/linalg/matrix.ts`, `src/internal/summary.ts`, `src/linalg/qr.ts`, and `test/svd.test.ts`.
- Exact reproduction: `svd([[1e308,0],[0,1e-308]])`. The exact singular values are the diagonal magnitudes, approximately `[1e308,1e-308]`.
- `rangeExponent()` chooses `s=1023` from the largest entry. `svdScaled()` and `svdValues()` scale every entry by `2^-s`; `ldexp(1e-308,-1023)` underflows to zero before `decompose()` receives the matrix. The second singular value is therefore irretrievably lost. This differs from Issue #127, where the SVD retains the small singular value but `ginv` overflows while taking its reciprocal.
- Opened Issue #131. No source code changed. `test/svd.test.ts` was inspected but not run; no Vitest, package runtime, or R execution.


## Audit #592 — Cholesky, matrix norms, and balancing re-audit

- Reviewed `src/linalg/chol.ts` (blob `5444cb2c0f790e8a231c515dead77c069d822e3a`), `src/linalg/norm.ts` (`3ee6876b551eab0d51a0abf8b2c3a57680d54457`), and `src/linalg/balance.ts` (`b0796b3365f4f23a7a02efdb05628380f85cf284`). Read `test/chol.test.ts` and `test/linalg.test.ts`; no test execution.
- Cholesky: traced unpivoted leading-minor updates, pivoted residual diagonal/work accumulation and symmetric swaps, stopping tolerance/rank, and `chol2inv` size/zero-diagonal/triangular inversion. Reviewed ordinary SPD, rank-deficient PSD, very large and very small diagonal scales, and NaN/Inf paths. No new reproducible defect established.
- Norms: traced O/1/I/F/E/M/2 dispatch, nonnegative row/column sums, scaled Frobenius accumulation, NaN/Inf propagation, empty dimensions, and spectral norm's `svdValues` dependency. Confirmed overflow for nonnegative sums or Frobenius output only when the mathematical norm exceeds binary64 range; no new independent defect. The SVD global-scaling loss is separately tracked in Issue #131.
- Balancing: traced isolated row/column permutation, changing `ilo`/`ihi` loop bounds, power-of-two scaling iterations and safe-range guards, similarity transforms, and `gebak` inverse permutation/scaling. No new reproducible defect established.
- No new issue and no source code changes. Vitest, package runtime, and R were not executed.


## Audit #593 — `src/linalg/schur.ts` mixed-scale diagonal eigenvalue loss

- Reviewed source blobs: `schur.ts` `72838c9df6896ef921d1ec296bd5b93d4624ec4f`; `eigen.ts` `86ee78a9fd9f3edbbc35e86f3805ea910e15ff18`; `matrix.ts` `9d78a4c9ae28f2fcc55ea30b5a7297c7441f2eaf`; `summary.ts` `e4fc3bd652af3a00cf05b44389ddf58e590c4830`; test `schur.test.ts` `196e4e2284af726d85bad5f83126da7a0951b2df`.
- Re-audited Hessenberg reduction, Francis double-shift QR iteration, deflation and 1x1/2x2 block detection, `lanv2` standardisation, the paired rotations applied to T and Q, and eigenvalue recovery from standardised blocks. Existing test source checks Q orthogonality, reconstruction, block structure and R eigenvalue fixtures; it was read but not executed.
- Confirmed new dynamic-range defect. Exact input: `schur([[1e308,0],[0,1e-308]])`. Since the input is already diagonal, its exact Schur form can remain unchanged with Q=I and eigenvalues `[1e308,1e-308]`. The public function chooses `k=1023` from the largest entry and scales every element by `2^-1023`; `ldexp(1e-308,-1023)` underflows to zero before `orthes()`/`hqr2()` run. The lost second eigenvalue cannot be recovered by the final scale-back. Opened Issue [#132](https://github.com/numero-uno-jpn/rStats.js/issues/132).
- Prior audits #383/#381 covered ordinary and extreme uniform scales, but not a diagonal matrix with this mixed exponent range. No source code changed. Vitest, package runtime, and R were not executed.


## Audit #594 — src/linalg/ops.ts rescaled dot-product cancellation

- Reviewed source blobs: ops.ts `fa5626725f1f8b3d6cd1d6d2a82e54629f00f540`; matrix-ops.test.ts `5749b11736824ea780660ea7a79aba6abbba3f86`.
- Re-audited vector/matrix shape dispatch in matMul, conformability checks, finite and non-finite dot-product paths, independent power-of-two scaling in rescaledDot, and the adjacent elementwise recycling, diag, cbind/rbind, matrix, kronecker, and seq paths. Existing #70 (seq endpoint-difference overflow) remains separate.
- Confirmed a new rescaledDot cancellation defect. Exact reproduction: `matMul([1e308,1e308,1],[1e308,-1e308,1])`. The exact dot product of the supplied binary64 values is 1: the first two equal-magnitude products cancel and the final product is 1. Ordinary accumulation overflows the first two products to opposite infinities, so it dispatches to rescaledDot. That routine scales both vectors by `2^-1023`; the final factors become approximately `1.1125e-308`, whose product (~`1.24e-616`) underflows to zero. The scaled large products cancel, leaving zero, which is scaled back to zero instead of 1. Opened Issue [#133](https://github.com/numero-uno-jpn/rStats.js/issues/133).
- test/matrix-ops.test.ts was read; its R-oracle fixtures do not include this mixed-dynamic-range cancellation case. No source code changed. Vitest, package runtime, and R were not executed.


## Audit #595 — `src/descriptive/moments.ts` numerical stability re-audit

- Reviewed current source blob: `740c02eaceadd6f1454ecd7564bcd6f09f563b5b`; related helpers `src/internal/summary.ts` (`e4fc3bd652af3a00cf05b44389ddf58e590c4830`), `src/descriptive/basic.ts` (`e12c8f8c91152f8d617cd05bf07ce512ef00856a`), and `test/descriptive.test.ts` (`7d03139bf88440d444e4e7c8aa4217daff69592d`).
- Re-audited central second/third/fourth moments, type 1/2/3 bias corrections and minimum sample sizes, geometric mean sign/zero/NaN behavior, mode ties and signed zero, mean absolute deviation with named/numeric centres, coefficient-of-variation correction, and `scale()` centering/scaling including overflowed deviations and RMS fallback.
- Existing Issue #38 remains the confirmed ragged-matrix defect in `scale()`: it derives the column count from the first row and does not validate later row lengths. Exact inputs: `scale([[1,2],[3,4,5]],{center:false,scale:false})` silently omits 5; `scale([[1,2],[3]],{center:true,scale:true})` lets the missing second-column value enter the mean/RMS path. This is already tracked; no duplicate issue opened.
- Checked additional deterministic edge inputs: `skewness([1,1,1])`, `kurtosis([1,1,1,1])`, `skewness([1,2],{type:2})`, `kurtosis([1,2,3],{type:2})`, `geometricMean([-1,2])`, `geometricMean([0,2])`, `meanAD([-1e308,1e308])`, `cv([-1,1])`, and `scale([[1e308],[-1e308]])`. The constant-sample moment ratios are undefined (NaN), type-2 minimum-size guards are explicit, negative geometric-mean inputs return NaN, zero-containing inputs return the documented zero, and the extreme-scale paths are handled by the existing power-of-two scaling. No additional independent, reproducible defect was established.
- No source code changed. Source/test files were inspected; Vitest, package runtime, and R were not executed.


## Audit #596 — `src/internal/summary.ts` wide arithmetic and shared statistics helpers

- Reviewed current source blob: `e4fc3bd652af3a00cf05b44389ddf58e590c4830`; cross-checked public descriptive tests `test/descriptive.test.ts` (`7d03139bf88440d444e4e7c8aa4217daff69592d`).
- Re-audited `wideSumAdd/wideSumValue` overflow transition, `meanDD` rescaling and correction, `ldexp` split exponent multiplication, `centered/scaleToUnit`, covariance/variance and standard deviation, `satterthwaiteDf`, rank/tie sorting, `squareOver`, `productOver`, and `norm2` non-finite fallbacks.
- Deterministic edge inputs traced: `sum([1e308,1e308,-1e308])`; `mean([1e308,1e308,-1e308])`; `mean([Number.MAX_VALUE,Number.MAX_VALUE])`; `mean([Number.MAX_VALUE,-Number.MAX_VALUE])`; `rank([-Infinity,0,Infinity,Infinity])`; `tieCounts([-Infinity,0,Infinity,Infinity])`; `norm2([NaN,Infinity])`; `norm2([Number.MIN_VALUE,Number.MIN_VALUE])`; `productOver(Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE)`; `squareOver(Number.MIN_VALUE,Number.MIN_VALUE)`; `satterthwaiteDf([0,0],[1,2])`.
- Checked the potentially delicate `Math.floor(Math.log2(m))` exponent estimate at `m=Number.MAX_VALUE`: even if `Math.log2` rounds to 1024 rather than the exact logarithm just below 1024, the resulting scale differs by exactly one power of two; the paired scale-back restores the same values and does not create an overflow/underflow in the reviewed callers. The rank comparator's `Infinity-Infinity` NaN falls through to original index ordering, preserving equal-value ties; finite subtraction overflow preserves comparison sign.
- No new independent, reproducible defect established. No source code changed. Source and existing test harness were inspected; Vitest, package runtime, and R were not executed.


## Audit #597 — 公開API export surface

- 対象: `src/index.ts`, `src/api-reference.ts`, `src/entries/{special,distributions,tests,linalg,descriptive,numerics,mixed}.ts`, `package.json`, `tsconfig.build.json`。
- ソースSHA: `src/index.ts` `325df03e925e9cda87ff608af8d1d6ca071ea08d`; `src/api-reference.ts` `dc66d56aca691ba312c6f10a50e742e7921e2e69`; `package.json` `42d30cf41e1acc619d3d7502ddf5289ab0979744`; `tsconfig.build.json` `1010b27d1ebaed90fadba227c8b0822cbcdd06d6`。
- 確認: root barrelの6領域、各subpath exportのtypes/import対応、`./mixed`の独立公開、Typedoc入口のbuild除外、dist相対パスの整合を静的に照合。
- 結果: 新規の再現可能な不具合なし。実行時のpackage import/type resolutionは未実行。
- テスト: Vitest、TypeScript build、Node package importは実行していない。ソース・設定の静的監査のみ。
- ソースコード変更なし。

## Audit #598 — Kendall cor.test small-sample variance

- 対象: `src/htest/cor.ts`（SHA `4ed4868b5441752c2b4581e85d2e9b2c0b015101`）、`test/cor.test.ts`（SHA `95ed4edf2429544c6f7b949e5e8516ad5bf64c52`）。
- 再現入力: `corTest([1, 2], [1, 2], { method: "kendall", exact: false })`。乱数なし。
- 原因: n=2でKendall tie-correction varianceの第2項の分母 `9*n*(n-1)*(n-2)` が0となり、タイがないため分子も0。`0/0` がNaNとなり、varS、z、pValueへ伝播する。
- 期待: tie correction項は0。基本分散1、S=1、z=1、両側正規近似p≈0.3173105079。
- Issue: [#134](https://github.com/numero-uno-jpn/rStats.js/issues/134) を作成し、openを確認。既存Issue #40（Pearson DD clamp）とは別件。
- テスト: `test/cor.test.ts` のfixture駆動suiteを確認したが、この境界入力は含まれない。Vitest/R実行なし。
- ソースコード変更なし。

## Audit #599 — Ansari-Bradley rank test

- 対象: `src/htest/ansariTest.ts`（SHA `9f13bb6d406d4f36761a562aed8bb17c0ce52db4`）、`src/htest/core/ansari.ts`（SHA `0de0bf2ccae23fb0e98115d356a4cd5c8e48ac5f`）、`test/htest-core/ansari.test.ts`（SHA `e9b5106af7a0d088e8bcda580b393d273992b4f2`）。
- 確認: exact/normal切替、tie score、奇数/偶数N分散式、tail方向、中心値、NaN/Inf、信頼区間candidate ratioとroot範囲を静的追跡。
- 決定的な新規不具合は確認できず。N=2で全スコアが同一となるnormal branchの0分散は検定の情報量がない退化ケースであり、Rとの挙動確認なしにバグとは断定しない。
- 再現入力: `ansariTest([-2,-1,1,2],[-4,-3,3,4],{confInt:true})`; `ansariTest([1,2,3,4],[2,4,6,8],{exact:true})`; `ansariTest([1,1,2],[2,3,3],{exact:true,confInt:true})`; `ansariTest([1,2],[3,4],{exact:false})`; `ansariTest([1e308],[1e-308],{exact:true,confInt:true})`; `ansariTest([1,Infinity],[2,3],{exact:false})`; `ansariTest([NaN,1,2],[3,4])`。乱数なし。
- テスト: exact distribution fixture suiteを閲覧。Vitest/R未実行。ソース・fixture静的監査のみ。
- ソースコード変更なし。

## Audit #600 — Brunner-Munzel directional tails and numeric boundaries

- 対象: `src/htest/brunnerMunzelTest.ts` SHA `3809905d6b8726a9b01afaf75deb0cbeb3082cac`、`src/distributions/t.ts`、`src/internal/summary.ts`、`test/fixtures/brunnerMunzelTest.json` SHA `169f6f8ac826faa69ab9617e6236c25bce32dc55`。既存監査 #183 の追加監査。
- alternativeとWの符号、片側tail、両側小tail、CIの上側t分位点、relative-effect estimate、rank comparatorのoverflow/±Infinity挙動を再追跡。新規の確定的不具合なし。
- 再現入力: `brunnerMunzelTest([1,2],[3,4],{alternative:"greater"})`; `brunnerMunzelTest([3,4],[1,2],{alternative:"less"})`; `brunnerMunzelTest([1,2],[1.5,3])`; `brunnerMunzelTest([-Infinity,0,Infinity],[1,2,Infinity])`; `brunnerMunzelTest([1e308,-1e308],[0,1])`; `brunnerMunzelTest([1,2],[3,4],{confLevel:0.5})`; `brunnerMunzelTest([1],[2,3])`。乱数なし。
- R 4.5.2 fixtureを閲覧。Vitest/R実行なし。ソース・fixture静的監査のみ。ソースコード変更なし。

## Audit #601 — Wilcoxon confidence-interval and shift-boundary follow-up

- 対象: `src/htest/wilcoxTest.ts` SHA `e40880f46edb938f5ad4814187de0f2d27058eb0`、`test/wilcox.test.ts` SHA `398e3898565215140422c24d2b60947c9827ccb8`。既存Issue #49（全同値rank-sumの0分散）に対する追加の別観点監査。
- paired差分、mu、zero/tie分岐、exact Walsh/pairwise CI、片側CI、normal CIのroot端点・clamping、非有限差分を追跡。既存 #49 と別の確定的不具合は確認できず。
- 再現入力: `wilcoxTest([1,2,4],{mu:1,exact:false,confInt:true})`; `wilcoxTest([1,2,4],[0,1,2],{paired:true,mu:0.5,exact:false,confInt:true})`; `wilcoxTest([1,2],[3,4],{exact:true,confInt:true,alternative:"greater"})`; `wilcoxTest([1,2],[3,4],{exact:true,confInt:true,alternative:"less"})`; `wilcoxTest([1e308,-1e308],[0,1],{exact:false,confInt:true})`; `wilcoxTest([1,2,3],[1,2,3],{exact:false,confInt:true})`; `wilcoxTest([1,2,3],[1,2,3],{exact:false})`; `wilcoxTest([1,2,3],{mu:1e16,exact:false,confInt:true})`。乱数なし。
- 大きなmuで差分の低位桁が失われる現象はIEEE-754の減算由来であり、Rとのruntime differentialなしに新規不具合とは断定しない。既存 #49 の全同値群p値NaNは引き続き記録。Vitest/R未実行。ソースコード変更なし。

## Audit #602 — Kruskal-Wallis, Friedman, Quade, Fligner-Killeen, Cochran Q and Mood rank-test edge audit

- 対象: `src/htest/rankTests.ts` SHA `e40c83f8cb535b12f41e0161875114ce1021807c`、`src/htest/groups.ts` SHA `d301964444f718a185397404de28343cc08138c5`、`src/internal/summary.ts` SHA `e4fc3bd652af3a00cf05b44389ddf58e590c4830`。
- Kruskal-Wallis: average-rank/tie correction、全同値時の補正分母、群サイズ1、NaN除外、±Infinityを含む順位付けを追跡。Friedman/Cochran Q: complete-case block削除、行長検証、k/n境界、各行tie補正を追跡。Quade: block-range順位、有限値のrange overflow時の共通2冪scale、A/B/Fと退化A=B分岐、自由度を追跡。Fligner-Killeen: median/deviation overflow回避、rank score、群内スコア平均、variance denominatorを追跡。Mood: finite値フィルタ、tie position score平均、線形rank statisticの期待値・分散、片側tailを追跡。
- 決定的な新規不具合は確認できず。特に、順位比較で有限値差が±Infinityにoverflowしても比較符号は保たれ、同値はindex tie-break後の明示的等値判定でまとめられる。Quade/Flignerの有限データで生じる差・range overflowは共通2冪scale経路で回避される。全同値など分散ゼロとなる退化入力についてはR 4.5.2との実行時照合なしに新規不具合とは断定しない。
- 再現入力（すべて決定的・乱数なし）: `kruskalTest([[1,1],[1,1]])`; `kruskalTest([[1],[2],[3]])`; `kruskalTest([1e308,-1e308,0,1], ["a","a","b","b"])`; `friedmanTest([[1,1,1],[2,2,2],[3,3,3]])`; `friedmanTest([[1,2,3],[2,3,1],[3,1,2],[NaN,2,3]])`; `cochranQTest([[1,1,0],[1,0,0],[0,0,1]])`; `quadeTest([[-1e308,1e308,0],[ -9e307,9e307,1],[0,1,2]])`; `flignerTest([[-1e308,1e308,0],[ -9e307,9e307,1]])`; `moodTest([-1e308,0,1e308],[1,2,3],{alternative:"greater"})`。
- Test suite path was not located from the repository's current tree/search in this pass; no test files were claimed as executed. Vitest, package runtime, and R 4.5.2 were not executed. Static source audit only. No source code changed and no Issue opened.


## Audit #603 — Noncentral beta CDF/quantile, extreme-tail integration and inversion audit

- 対象: `src/distributions/nbeta.ts` SHA `5c51760f6e136b80a77b4284da39c25b0ab8ed86`、`src/internal/noncentral.ts` SHA `0a7c75dcdcc9bcf9a4b3bbd75ed613e5c6046ad7`、`src/internal/invert.ts`（取得時の内容を静的確認）、`test/nbeta.test.ts` SHA `b92e2218f99be7492e9a1cc620acde52808ce070`、`oracle/nbeta.R` SHA `92667593121461c49c6f9f5be4698cdb62cb5a64`。
- 対象範囲: `pnbeta1` の支持域端点・不正パラメータ検査・central fallback、`qnbeta1` のlog-tail変換・0/1非表現端点判定・初期値・narrow quantile・Newton/bisection・double lattice探索、`integralLog` のmode探索・積分端点・左裾power-law補正、`gammaExpansion` / `wExpansion` の適用条件と相対補正、`searchDoubles` の符号付きdouble順序を追跡。
- 既存Issue「dnbeta log density overflows at x=1 when a + ncp/2 exceeds Number.MAX_VALUE」および「Noncentral beta density drops the dominant j=0 term when a shape is subnormal」は既知の別件として除外し、重複Issueは作成していない。
- 新規の確定的不具合は確認できず。CDFの端点処理とquantileの端点判定はlower/upper tailの不等号が整合。qnbetaの探索はlog確率を直接解き、極端に狭い分布ではdouble latticeへフォールバックする構造を確認。漸近展開は相対補正が1e-3未満の場合のみ採用し、積分経路ではlog-domainと小さいy側のpower-law尾を明示的に扱う。
- 再現入力（すべて決定的・乱数なし）: `pbeta(0.5, 2, 3, {ncp: 0})`; `pbeta(0, 0, 2, {ncp: 1})`; `pbeta(1, -1, 2, {ncp: 1})`; `pbeta(1e-300, 0.5, 3, {ncp: 1000, lowerTail: false, logP: true})`; `qbeta(1e-300, 0.5, 3, {ncp: 1000})`; `qbeta(Math.log(1e-300), 0.5, 3, {ncp: 1000, logP: true})`; `qbeta(1e-100, 79.32204890240992, 0.09403994879604119, {ncp: 1.245630132105305e22})`; `qbeta(1e-43, 79.32204890240992, 0.09403994879604119, {ncp: 1.245630132105305e22, lowerTail: false})`。
- 既存の `test/nbeta.test.ts` と `oracle/nbeta.R` のテスト設計・fixture生成条件を閲覧。Vitest、R 4.5.2、実際の関数実行は未実施。したがって数値差の実行時検証は未完了。静的ソース監査のみ。ソースコード変更なし。監査台帳のみ更新。


## Audit #604 — Noncentral F extreme degrees-of-freedom and tiny-ratio audit

- 対象: `src/distributions/nbeta.ts` SHA `5c51760f6e136b80a77b4284da39c25b0ab8ed86`（`pnfTiny`, `pnf1`, `pnfRaw`, `dnfCore`, `dnf1`, `qnf1`, `qnfRaw`, `fPair`, `fOdds`, `fChernoffLog`）、`src/internal/noncentral.ts`（`negligibleNcp`, `searchDoubles`）、既存 `test/nbeta.test.ts` SHA `b92e2218f99be7492e9a1cc620acde52808ce070` と `oracle/nbeta.R` SHA `92667593121461c49c6f9f5be4698cdb62cb5a64`。
- 監査範囲: df1/df2の0・Infinity・subnormal近傍、ncp=0/正値、qの0・Infinity・極小・極大、Fからbetaへの変換、tiny-ratio近似、Chernoff tail bound、df2→Infinityの非心χ²極限、Patnaik初期値、log-tail quantile inversionを追跡。
- **新規不具合を1件確認し Issue #135 を作成**: `pnfTiny()` と `dnfCore()` が `Math.log(m / n)` を使用。m,nが正の有限値でも比がアンダーフローして0になるとlogが-∞となり、有限であるべきlog CDF/log densityを-∞にする。再現入力 `m=1e-200, n=1e200, q=1e100, ncp=1`。このとき `m/n` は0に丸められる一方、数学的な比は1e-400で、`log(m)-log(n)` は有限。変換beta引数は約1e-300、a=m/2=5e-201であり、a log(x)は約-3.45e-198。非心混合のj=0成分だけでも重みexp(-0.5)で、CDFは0ではない。dnfCoreも `negligibleNcp` がfalseとなりtiny-ratio分岐へ入る（`n/m` がInfinityとなり判定積がInfinity）。修正案はlog比を `Math.log(m) - Math.log(n)` として計算すること。
- Issue: https://github.com/numero-uno-jpn/rStats.js/issues/135 （open）。
- 再現入力（すべて決定的・乱数なし）: `const m=1e-200, n=1e200, q=1e100, ncp=1; m/n === 0; Math.log(m/n) === -Infinity`; public APIで `pf(q,m,n,{ncp,logP:true})` と `df(q,m,n,{ncp,log:true})`。内部経路は `pnf1(q,m,n,ncp,true,true)` と `dnfCore(q,m,n,ncp,true)`。
- その他の端点・極限・Chernoff bound・quantile初期値経路では静的に確定できる別の新規不具合は確認できず。既存Issue「F density and CDF use an invalid p≈1 fallback when n exceeds a large m*x」は重複回避のため別件として扱い、今回のIssueに混ぜていない。
- テスト設計とoracle fixtureは閲覧したが、Vitest・R 4.5.2・実際の関数実行は未実施。Issue #135はソース上のIEEE-754中間値と数式からの静的確定。ソースコード変更なし。監査台帳のみ更新。


## Audit #605 — Noncentral chi-square mixture, asymptotic tails and quantile audit

- 対象: `src/distributions/nchisq.ts` SHA `9549791940c425d508057b7286329b396ca36c6f`、`src/internal/invert.ts`（取得内容を静的確認）、`src/internal/noncentral.ts`（`negligibleNcp`, `searchDoubles`, quadrature関連）、`src/internal/poissonMixture.ts`（呼出契約を確認）、`test/nchisq.test.ts` SHA `764a104ca667e8b0d4309574cce3f72ab6806ed6`、`oracle/nchisq.R` と `oracle/_noncentral.R`。
- 監査範囲: Poisson混合の重み・gamma increment recurrence・density mixture peak、df=0の点質量、subnormal x/2補正、tiny shapeのlog密度、Bessel Hankel/Debye漸近、二重精度平方根差、Chernoff tail bound、log-tail CDF、Patnaik初期値、quantile bracketingとdouble lattice探索。
- 新規の確定的不具合は確認できず。既存Issue「pnchisq and dnchisq return NaN when subnormal correction multiplies zero by infinity」は既知の別件として扱い、重複Issueは作成していない。特にsubnormalHalfの `expm1((df/2)*lt)` と上下裾補正、`gammaKernel` のtiny shape経路、`chisqTailBound` の境界式、`invertContinuous` の無限上端からの探索を数式・分岐条件で確認。
- df=0かつncp>0のx=0密度は、点質量と連続成分の区別が必要で、oracle側もx=0の一般ケースをNAとしているため、Rとの仕様差を確定できず不具合認定から除外。df=0,ncp=0の点質量は既存テストで明示的に扱われている。
- 再現・境界入力（決定的、乱数なし）: `pnchisq1(0, 0, 1, true, false)`（df=0の原点質量 exp(-1/2)）；`pnchisq1(Number.MIN_VALUE, 0.5, 24.3, true, true)`（subnormal x補正経路）；`dnchisq1(3e307, 0.5, 2.2e-320, true)`（gammaKernel huge-y scalingの既知回帰条件）；`dnchisq1(1.79e308, 3, 1e308, true)`（Hankel漸近・平方根差）；`pnchisq1(1e308, 3.3e268, 6.9e307, true, false)`（Debye漸近とオーバーフロー回避）；`qnchisq1(Math.log(1e-300), 1e6, 2e9, true, true)`（log-tail quantile）。
- 既存のfixture生成コードとテスト群を閲覧したが、Vitest・R 4.5.2・関数の実行は未実施。したがって数値fixtureとの実測比較は未完了。静的監査のみ。ソースコード変更なし。監査台帳のみ更新。


## Audit #606/#607 — Noncentral t extreme-scale follow-up

- Rechecked `src/distributions/nt.ts` (SHA `85763973f3f7a82d46ceee19a4dd0f8d8c275814`), `test/nt.test.ts` (SHA `256fd766b66bbb636d57a89a0549d3f6ccb1e297`) and `src/internal/invert.ts`.
- Confirmed statically that finite `t=1e308`, `df=2`, `ncp=1e308` can overflow `farLimit`, then overflow the curvature in `logIntegrand`, yielding `sigma=0` in `findPeak`; `trapezoid` consequently receives a zero Jacobian. Analytic df=2 limiting values: CDF tends to `exp(-1)` and density to `2*exp(-1)/t`, both nonzero.
- Quantile follow-up: `qnt1` can also enter the far-tail branch with `T0=Infinity` when `farLimit` overflows; `farTailLog(s*T0, ...)` then does not satisfy `abs(t)>T0` (`Infinity > Infinity` is false) and falls through to `pntBoth` with an infinite argument. This is a further unvalidated risk, not separately reported as a confirmed bug pending exact reachable probability/side conditions.
- Existing tests include huge-df, tiny-df and tail cases, but no fixture for the above `1e308`/`df=2` configuration. Vitest and R execution not performed. Static source analysis only; no source changes.
- Issue creation and ledger write were blocked by GitHub connector safety checks in the prior attempt; this entry records the finding and the limitation.


## Audit #608 — Noncentral t quantile with overflowing farLimit

- 対象: `src/distributions/nt.ts` SHA `85763973f3f7a82d46ceee19a4dd0f8d8c275814`、`test/nt.test.ts` SHA `256fd766b66bbb636d57a89a0549d3f6ccb1e297`、`src/internal/invert.ts`。
- 新規不具合候補をIssue #136として登録: `Noncentral t quantile fails when farLimit overflows for large finite ncp`。
- 決定的入力: `qt(0.9, 2, { ncp: 1e299 })`。df=2では `S=sqrt(V/2)` の生存関数が `exp(-s²)`。大きな正の非心度で `T=(Z+ncp)/S` のCDFは正のtで `exp(-ncp²/t²)` に近づき、90%分位点は `ncp/sqrt(-log(0.9)) ≈ 3.0805e299`。有限かつbinary64で表現可能。
- 原因経路: `farLimit(1,1e299)=1e10*(1e299+10)*sqrt(2)` がInfinity。`qnt1` は `T0=Infinity` で `farTailLog(s*T0,...)` を呼ぶ。`farTailLog` 内の `Infinity > Infinity` はfalseとなり、`pntBoth(Infinity,...)` にフォールスルーする。通常の有限境界での裾評価・べき乗則による逆算ができない。
- #606で見つけた `farLimit` overflow→`findPeak` のsigma=0とは別の、分位点関数 `qnt1` の独立した障害経路。
- テストコードを確認したが、Vitest・R・実関数の実行は未実施。上記分位点は解析的極限による期待値であり、実測値ではない。静的ソース監査のみ。ソースコード変更なし。
- GitHub Issue: https://github.com/numero-uno-jpn/rStats.js/issues/136


## Audit #610 — Noncentral t far-tail switch continuity review

- 対象: `src/distributions/nt.ts` SHA `85763973f3f7a82d46ceee19a4dd0f8d8c275814`; `test/nt.test.ts` の既存回帰テストも確認。
- `farLimit(a, delta)` の前後で、CDFの `pntBoth` → `farTails`、密度の `integrate(pdf)` → `T0) での密度×べき乗外挿、分位点の `hi=T0` / べき乗直接解の切替を追跡。
- `farTails` は境界の far tail を `f0) とし、`k=2a(log|t|-log T0)` で `f0 exp(-k)` に接続する。反対側のtailも `n0 + f0(1-exp(-k))` として接続する。境界で `k→0` としたとき、CDF両側の値は `pntBoth(T0)` の値に一致する。密度外挿も境界で倍率1となる。分位点の直接解は対象tailが境界値より小さい場合に限って使用し、その他は `hi=T0` で数値反転する。
- 今回確認した有限範囲では、切替式そのものに独立した不連続・符号誤りは確認できなかった。#606/#609の積分器の極端値不安定性、および#608/#136のfarLimitオーバーフロー分岐は既知事項として除外し、重複Issueは作成しない。
- 再現・境界確認用の値: `a=1`, `delta=0`, `T0=1e10*10*Math.SQRT2`; 境界の直前・一致・直後の `t` を `T0` とその隣接浮動小数点数で比較する想定。今回は実行していない。
- Vitest/Rは未実施。静的な式の追跡のみ。ソースコード変更なし。


## Audit #611 — Noncentral t Laplace overflow at huge finite noncentrality

- 対象: `src/distributions/nt.ts` SHA `85763973f3f7a82d46ceee19a4dd0f8d8c275814`。Laplace法の大自由度領域における微分・補正項を監査。
- 確定的な入力候補: `const df=200002, ncp=1e200, a=df/2;` `const T0=1e10*(Math.abs(ncp)+10)*Math.sqrt(a+1);`（有限値、約 `3.1623e217`）。`dt(T0,df,{ncp,log:true})` および `pt(T0,df,{ncp,lowerTail:false,logP:true})`。
- `T0` ちょうどではfar-tail外挿の厳密な `>` 条件に入らず、Laplace法が試行される。`laplace()` の密度微分は `v=t*exp(w/2)` の `v*v`、`u*v` を計算する。密度ピーク付近では `v` が約 `1e200`、`u=v-delta` はほぼ0となり、v自体は有限でもv²がInfinityになる。曲率・高階微分と `r3/r4` の比が不定値となり、補正 `c1` とLaplace結果がNaNとなって通常積分へフォールバックする。
- フォールバックの `logIntegrand()` も `tS*tS` を計算し、曲率が `-Infinity` となると `sigma=0`、台形積分のヤコビアン消失に至る。既存#606/#609と広い意味で同じ極端値の二乗オーバーフローだが、大自由度Laplace入口を通る別の実行経路としてIssue #137を作成。
- Issue: https://github.com/numero-uno-jpn/rStats.js/issues/137
- Vitest/R未実施。静的ソース追跡のみであり、実行時の戻り値は未確認。ソースコード変更なし。


## Audit #612 — Huge-df t/noncentral-t limit helpers and switch boundaries

- 対象: `src/distributions/nt.ts` SHA `85763973f3f7a82d46ceee19a4dd0f8d8c275814`（`HUGE_DF`, `hugeDfRatio`, `hugeDfTailLog`, `hugeDfTailQuantile`, `hugeDfTail`, `hugeDfCentral`, `dnt1`, `pnt1`, `qnt1`）、`src/distributions/t.ts` SHA `78247f0318768944233dc6e92874409b23e432b8`（中央t側の共有呼出し経路）、`test/nt.test.ts` SHA `256fd766b66bbb636d57a89a0549d3f6ccb1e297`。
- 監査範囲: `df > 1e200` の正規近似と中心裾近似の切替、`t/sqrt(df)` のoverflow/underflow、`log1p(y)/y` の小y級数、巨大yでの対数表現、裾確率のlower/upper符号、分位点の `expm1` と巨大指数経路、`hugeDfCentral` の非心度許容条件、密度/CDF/quantileの各分岐を静的追跡。
- 新規の確定的不具合は確認できず。特に `hugeDfTailLog` は `t²` を先に形成せず `0.5*|t| * (|t|*g)` と演算順序を分け、`u>1e8` では `log(u)` を使う。小さい `y` では `log1p(y)/y` の級数を用いる。`hugeDfTailQuantile` は小さい `r` で `expm1(r)` を使い、`r>=700` では対数域の指数に切り替える。これらの経路で、今回静的に確定できる中間値の不正なoverflow/underflowは見つからなかった。
- 境界・再現確認用の決定的入力（乱数なし）: `hugeDfRatio(1e92, 1e200)`（比の切替近傍）、`hugeDfRatio(1e154, 1e308)`（t²が単独overflowし得るが比は有限）、`hugeDfTailLog(1e154, 1e308)`（大きな有限log裾の演算順序）、`hugeDfTailLog(1e160, 1e308)`（裾logがbinary64下限を超える領域）、`hugeDfTailQuantile(-Math.LN2, 1e308)`（最も中央寄りのtail）、`hugeDfTailQuantile(-1e308, 1e200)`（量子点が最大doubleを超える領域）、`pt(-4.05e269, 3.586e307, {ncp:1, logP:true})`（非心度が中心裾近似許容条件に入らない既知の巨大df回帰周辺）。
- `test/nt.test.ts` には巨大dfのLaplace回帰ケースがあるが、今回のhelper境界値を直接網羅する専用テストは確認できなかった。Vitest/Rは未実施。静的ソース監査のみ。実行時の戻り値を確認したとは主張しない。
- Issue追加なし。既知の#606/#609/#608/#136/#137の極端値問題とは別に、今回の共有巨大df helper自体の新規独立不具合は確定できなかった。ソースコード変更なし。


## Audit #613 — Noncentral t tiny-df, subnormal-shape and formula-B audit

- 対象: `src/distributions/nt.ts` SHA `85763973f3f7a82d46ceee19a4dd0f8d8c275814`（`A_TINY`, `A_SUB`, `halvable`, `nearZero`, `shapeTimesExp`, `gammaLog`, `integrate`, `pntBoth`, `qnt1`, `dntRaw`）、`src/special/igam.ts` SHA `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620`、`src/special/gamma.ts` SHA `f630bdd496fc204dd24b6b04603c7b511a5cb107`、`test/nt.test.ts` SHA `256fd766b66bbb636d57a89a0549d3f6ccb1e297`。
- 監査範囲: `df/2` のsubnormal丸め、`A_TINY=1e-5` のformula-B切替、`A_SUB=1e-300` 未満の上側不完全ガンマ関数スケーリング、`gammaLog` の `x <= 1e-300` 漸近式、`shapeTimesExp` のw境界、`nearZero` の巨大delta/極小t、formula-Bの符号・補完・log差、`qnt1` のgamma quantile初期値と最大double超え判定、密度log積分を追跡。
- 新規の確定的不具合は確認できず。`halvable(Number.MIN_VALUE)` が最小正subnormalの半減で0になることを避ける。極小shapeのQ(a,x)は `Q(A_SUB,x)*(a/A_SUB)` としてlog域で補正し、`gammaLog` はxがdouble範囲未満の領域で `a*(log(x)-lgamma1p(a)/a)` を用いる。formula Bは小自由度でP側積分の誤差を避け、Q側の小補正を加減する構造。今回の静的追跡で独立した符号誤り・不正な端点処理は確認できなかった。
- 決定的な再現・境界入力（乱数なし）: `dt(-1e-150,1e-300,{ncp:-3,log:true})`; `dt(7.46357687432739e-94,2.830371717661936e-187,{ncp:38.166735104830046,log:true})`; `pt(0.001,2e-6,{ncp:40,logP:true})`; `pt(-59193519471.86663,1.9146506048870366e-245,{ncp:-1.8387038943733192})`; `qt(1.4426402575659767e-62,5.449761356942939e-96,{ncp:48.87598483697083})`; 追加境界候補 `dt(Number.MIN_VALUE,Number.MIN_VALUE,{ncp:1e200,log:true})`, `pt(Number.MIN_VALUE,Number.MIN_VALUE,{ncp:1e200,logP:true})`, `pt(1e-300,2e-300,{ncp:1e150,logP:true})`, `dt(1e-300,2e-300,{ncp:-1e150,log:true})`。
- 既存 `test/nt.test.ts` は tiny-df fixture、subnormal近傍のdf、極小t・大ncp、density log値、最大doubleを超えるquantileを明示的に含む。Vitest/Rは未実施。静的ソース監査のみで、追加候補の実行時戻り値は未確認。
- Issue追加なし。ソースコード変更なし。監査台帳のみ更新。


## Audit #614 — Noncentral t symmetry, complementary tails and quantile sign audit

- 対象: `src/distributions/nt.ts` SHA `85763973f3f7a82d46ceee19a4dd0f8d8c275814`（`farTails`, `nearZero`, `pntBoth`, `pntRaw`, `dntRaw`, `dnt1`, `pnt1`, `qnt1`）、`test/nt.test.ts` SHA `256fd766b66bbb636d57a89a0549d3f6ccb1e297`。
- 監査範囲: CDFの `lowerTail` / `upperTail` の積分選択、`side=t<delta` の中央値側判定、`v.lin>0.5` による積分側反転、`1-v` / `log1p(-v)` 補完、`farTails` の正負t別裾と反対裾の増分、`nearZero` の `Φ(±delta)`、密度の `z=tS-delta`、far-tail密度外挿、`qnt1` の `smallerTail`・符号決定・反転CDF callbackを追跡。
- 恒等式 `F(t;df,delta)=1-F(-t;df,-delta)` と `f(t;df,delta)=f(-t;df,-delta)` に照らし、通常積分、formula-B、nearZero、far-tail、巨大df近似の分岐を静的に確認。新規の確定的不具合は確認できず。等号 `t===delta` でも両方の反転呼出しが同じ分岐ラベルを選ぶが、各呼出しで `tail(false)` が反転後の下側積分を表し、補完関係は保たれる。farTailsも符号反転時に `s` と `farLower` が同時に反転し、基準点の裾を同じ確率に対応させる。
- 分位点は `P[T<=0]=Φ(-delta)` と対象tailの比較で符号を決め、`cdfY` で負側のとき上下tailを入れ替える。これらのcallback変換は分布の反転対称性と整合する。far-tailのべき乗外挿と巨大dfの対称裾近似にも今回新規の符号不整合を確認できなかった。
- 決定的な確認入力（乱数なし）: `pt(2.5,7, {ncp:1.2})` と `1-pt(-2.5,7,{ncp:-1.2})`; `pt(0,0.25,{ncp:3,logP:true})` と `pt(0,0.25,{ncp:-3,lowerTail:false,logP:true})`; `dt(1e12,0.2,{ncp:4,log:true})` と `dt(-1e12,0.2,{ncp:-4,log:true})`; `qt(0.9,5,{ncp:2})` と `-qt(0.1,5,{ncp:-2})`; `qt(0.9,5,{ncp:2,lowerTail:false})` と `-qt(0.9,5,{ncp:-2,lowerTail:false})`; 境界 `t=delta) の `pt(2,8,{ncp:2})` と `1-pt(-2,8,{ncp:-2})`; far-limit前後の `T0=1e10*(Math.abs(1.2)+10)*Math.sqrt(7/2+1)` と `T0*(1-Number.EPSILON)`, `T0`, `T0*(1+Number.EPSILON)`。
- 上記はソースから導いた再現・回帰候補であり、Vitest/Rおよび実関数の実行は未実施。数値差の実測を行ったとは主張しない。既存 `test/nt.test.ts` はfixtureと一部の上下裾補完回帰を含むが、正負非心度の対称性を直接比較する専用テストは確認できなかった。
- Issue追加なし。ソースコード変更なし。監査台帳のみ更新。


## Audit #615 — Noncentral t trapezoidal integrator convergence and truncation audit

- 対象: `src/distributions/nt.ts` SHA `85763973f3f7a82d46ceee19a4dd0f8d8c275814`（`trapezoid`, `integrateCore`, `integrate`, `findPeak`, `integrand`, `logIntegrand`）、`test/nt.test.ts` SHA `256fd766b66bbb636d57a89a0549d3f6ccb1e297`。
- 監査範囲: 変数変換 `w=w*+(sigma/2)(z+1-exp(-z))` とJacobian、左右別のnode列、`z=±40` 打切り、3点連続の相対寄与停止、100000 node上限、初期h=0.5から最大6回の半減、台形和の再利用 `s2=s/2+odd`、線形/log積分の切替、収束許容差、ピーク幅推定を追跡。
- 台形則の半減更新式は複合台形則の標準的なネスト更新と一致する。odd列は新規追加点のみを加え、既存偶数点の和を半分にする。左右の積分は同じ変換・Jacobianを使う。停止判定は各側で3点連続の寄与が現在の累積和の1e-19以下となった場合で、log積分時もピークoffsetを引いた線形和で比較する。今回の静的追跡で独立した確定的不具合は確認できなかった。
- 境界・再現確認用の決定的入力（乱数なし）: `dt(0,1, {ncp:0})`; `pt(0,1,{ncp:0})`; `pt(12,5,{ncp:0,logP:true})`; `pt(-12,5,{ncp:0,lowerTail:false,logP:true})`; `dt(1e4,3,{ncp:-8,log:true})`; `pt(1e6,0.2,{ncp:4,logP:true})`; `pt(-1e6,0.2,{ncp:-4,lowerTail:false,logP:true})`; 左右端打切りが異なる形状の候補 `dt(0.1,0.02,{ncp:30,log:true})` と `dt(0.1,0.02,{ncp:-30,log:true})`。これらは実行済み結果ではなく静的監査からの回帰候補。
- `test/nt.test.ts` は巨大dfのLaplace法およびtiny-df formula-Bのfixtureを持つが、trapezoidの刻み半減ごとの収束、左右打切り、`z=40`端点を直接検証する専用テストは見当たらない。Vitest/R未実施。静的ソース監査のみ。
- Issue追加なし。ソースコード変更なし。監査台帳のみ更新。


## Audit #616 — Noncentral t far-tail quantile finite-range cutoff

- 対象: `src/distributions/nt.ts` SHA `85763973f3f7a82d46ceee19a4dd0f8d8c275814`（`qnt1` のfar-tail direct inversion branch）、`test/nt.test.ts` SHA `256fd766b66bbb636d57a89a0549d3f6ccb1e297`。
- 監査範囲: `ly = log(T0) + (lT0 - logTarget) / df` から有限binary64量子点へ戻す際のoverflow判定を監査。現行の固定閾値 `709.78` とbinary64の正確な有限上限 `log(Number.MAX_VALUE) ≈ 709.782712893384` の間に、有限だがInfinityへ誤分類される区間があることを確認。
- **新規不具合を1件確認し Issue #138 を作成**: `qt(-1419.565225786768, 2, { ncp: 0, lowerTail: false, logP: true })`。df=2,ncp=0の中央t上側tailは `1 - t / sqrt(t*t + 2)` で、対象量子点は約 `1.7975133745369981e308`。これは `Number.MAX_VALUE = 1.7976931348623157e308` より小さい有限値だが、`ly > 709.78` の判定で `Infinity` を返す。
- Issue: https://github.com/numero-uno-jpn/rStats.js/issues/138 （open）。
- 期待値の根拠: df=2の中央t survival式を高精度域の漸近 `P(T>t) ~ 1/t²` と照合。再現値のlog量子点は約 `709.782612893384` で、誤った閾値より大きく、`log(Number.MAX_VALUE)` より小さい。乱数なし。
- Vitest・package runtime・R 4.5.2の実行は未実施。期待値は解析式とbinary64範囲からの静的導出であり、実関数の実測値とは主張しない。ソースコード変更なし。監査台帳のみ更新。


## Audit #617 — Studentized range integration, tails and quantile solver

- 対象: `src/distributions/tukey.ts` SHA `e18cb49f91c4d5667c40323080d741b3d2696738`（`CCPiece`, `integrate`, `rangeWindow`, `rangeCdf`, `rangeCdfC`, `logRangeCdfC`, `rangeMaxCdf`, `tukeyIntegral`, `logTukeyIntegral`, `outerEdges`, `ptukeyRaw`, `smallTail`, `qtukey1`, `solveMonotone`, `brent`）、`test/tukey.test.ts` SHA `e18cb49f91c4d5667c40323080d741b3d2696738`。
- 監査範囲: Clenshaw–Curtis重みとnested node再利用、Chebyshev末尾係数による誤差推定、interval分割上限256、40 round上限、inner range probabilityのnarrow-window Gauss-Legendreとshift correction、W/1-Wの別積分、large-w漸近、nrangesによる最大分布、df→∞近似条件、outer gamma積分のv=log(t/a)変換とtail edges、deep log積分、q<2^-1000の小qスケーリング、small-tail選択、log quantile inversionとbracket/Brent更新を追跡。
- CC weightsのcos-table indexはN=16,32,64,128で整数刻みとなり、nested node cacheのindexは各倍増段階で整合する。adaptive integrationはpiece数とround数に上限があり、未収束時も停止する。upper-tailは1-Wを直接積分し、Wcが小さい領域ではexpm1/log1pを使う。w>100のpair exceedance近似、q tinyのpower-law scaling、outer gamma densityの対数変数化も各々の適用領域と整合していることを静的に確認。
- Quantile solverではy=log(q)で単調関数を解き、exp(y)が0/Infinityになる領域を非有限残差としてbracket端に扱う。Brent更新の逐次代入は一時変数を使わない形だが、代入順により標準的な入替（旧bをaとc、旧cをbへ）となる。今回の静的追跡で独立した確定的不具合は確認できなかった。
- 決定的な境界・再現候補（乱数なし）: `ptukey(2**-1000,2,2)`; `ptukey(Number.MIN_VALUE,2,2,{logP:true})`; `ptukey(60,3,2,{lowerTail:false,logP:true})`; `ptukey(100,3,2,{lowerTail:false,logP:true})`; `ptukey(1e150,3,2,{lowerTail:false,logP:true})`; `qtukey(-745,2,2,{logP:true})`; `qtukey(-1e6,2,2,{logP:true})`; `qtukey(1-Number.EPSILON,2,2)`; `ptukey(3,2,Infinity)`; `qtukey(0.95,2,Infinity)`. これらはソース監査で選定した決定的入力であり、実行結果ではない。
- `test/tukey.test.ts` はRmpfr由来のptukey fixtureを持つが、今回列挙したsubnormal q、large-w log upper tail、quantile solverのoverflow bracketを個別に直接検証するケースはこの監査では確認していない。Vitest/package runtime/R実行なし。Issue追加なし。ソースコード変更なし。


## Audit #618 — Agreement/reliability estimators: degenerate samples and variance boundaries

- 対象: `src/htest/agreement.ts` SHA `b1f99b610908221c1380f18c8edf4b3bb8551e5e`、`test/agreement.test.ts`（R fixture comparisonとinvalid-input tests）。
- 監査範囲: Cohen weighted/unweighted kappaの単一カテゴリと観測・期待一致率1の退化、Fleiss/Congerのm=2・単一カテゴリ・完全一致、ICC one-way/two-way consistency/agreementのMSR/MSC/MSW/MSE、r0境界、Satterthwaite df、完全一致時の0分散、Cronbach alphaのk=2 item-drop、singular correlation matrix、partial correlationのSchur complementとindex validation。
- kappa2のweighted weightはc=1でd/(c-1)が0/0となるが、同一カテゴリのみではPo=Pe=1でkappa自体が0/0となり推定対象が定義されない。Fleiss/Congerも全一致・単一カテゴリでは1-Pe=0で同様に退化する。これらを有限係数を返すべき通常ケースとは判定しなかった。
- ICCでは完全な加法構造/完全一致によりMSEまたはMSWが0となる。ICC=1等の境界ではF値や信頼区間が極限・未定義になり得る。現在のAPIは退化分散に対する別の境界規約を定義しておらず、Rのfixtureもこの極限ケースを直接規定していないため、NaN/Infinityを確定的なR互換バグとは認定しない。r0=-1近傍、r0→1、confLevel→0/1では係数・quantileの符号と分母を追跡し、独立した有限入力の誤式は確認できなかった。
- Cronbach alphaでk=2の場合のalphaDropは1項目尺度のalphaとなり、k/(k-1)の分母が0。1項目alphaは定義されないため、NaNは妥当な退化出力。partialRで2列のみの場合は通常相関、他列がある場合は相関行列のSchur complementを形成する。完全共線・定数列は相関行列が特異または未定義であり、通常の有限partial correlationは定義されない。
- 決定的境界入力（乱数なし）: `kappa2([[1,1],[1,1]],{weight:"equal"})`; `kappa2([[1,1],[1,1]])`; `kappamFleiss([[1,1],[1,1]])`; `kappamFleiss([[1,1],[1,1]],{exact:true})`; `icc([[1,2],[2,3],[3,4]],{model:"twoway",type:"agreement"})`; `icc([[1,1],[2,2],[3,3]],{model:"twoway",type:"agreement"})`; `cronbachAlpha([[1,2],[2,4],[3,6]])`; `partialR([[1,2],[2,4],[3,6]],0,1)`.
- 既存 `test/agreement.test.ts` はR由来fixture比較とinvalid argument testsを持つが、完全一致ICC、単一カテゴリkappa、完全共線partialRの境界期待値は明示的に規定していない。今回の確認は静的ソース・式追跡であり、Vitest/package runtime/R 4.5.2は未実行。Issue追加なし。ソースコード変更なし。監査台帳のみ更新。


## Audit #619 — `propTest()` pooled-proportion overflow

- 対象: `src/htest/propTest.ts` SHA `dc71b22c88d12984b50c59b89fdec3e9748e4a19`、`test/fixtures/propTest.json` SHA `dcb93316e987e2032cf14949a82301a3386a9b0f`、`test/htest-basic.test.ts` SHA `5a48b4b7cc73c2a36a86debf1c0ed75a09399254`。
- **確定バグ Issue #139**: no-`p` equality-of-proportions path computes pooled proportion as raw `sum(xs)/sum(ns)`. Each group count is validated finite, but the sum across groups can overflow. Reproduction (no randomness): `propTest([5e307,5e307],[1e308,1e308],{correct:false})`. Each group has exact observed proportion 0.5, so the pooled proportion is 0.5, Pearson statistic is 0, df=1, and p-value is 1. In source, `sum(xs)=1e308` remains finite while `sum(ns)=Infinity`, so pooled becomes 0. Expected success count becomes 0 and `squareOver(5e307,0)` is Infinity; the returned statistic is corrupted. This is distinct from #47 (fractional-count validation).
- 監査範囲: matrix rows [success,failure] parsing, missing-group removal and p alignment, finite/positive trial validation, success bounds, given-p vs equality branch, pooled expected counts, Yates cap, Pearson terms, one-sided signed-root normal tail, Wilson/Newcombe and Wald intervals, confidence-level tail handling.
- Existing `test/fixtures/propTest.json` contains R 4.5.2 cases and missing/invalid-input examples, but does not include finite per-group counts whose cross-group total overflows. `squareOver` handles numerator-square overflow but cannot repair a pooled proportion already corrupted by `sum(ns)`.
- Vitest/package runtime/R 4.5.2 execution not performed. This finding is established by static evaluation of the exact IEEE-754 operations and the mathematical equality of the group proportions; no runtime return value is claimed. Issue #139 opened. No source changes; audit ledger only.


## Audit #620 — McNemar statistic loses finite terms when discordant counts overflow

- 対象: `src/htest/mcnemarTest.ts` SHA `eef3749c5d76de672246eb7feff2d0bc976e12a8`、`src/internal/summary.ts` SHA `e4fc3bd652af3a00cf05b44389ddf58e590c4830`、`test/htest-basic.test.ts` SHA `5a48b4b7cc73c2a36a86debf1c0ed75a09399254`。
- **確定バグ Issue #140**: McNemar statistic forms the discordant-pair denominator as `a+b` before calling `squareOver`. For finite nonnegative cells whose sum exceeds `Number.MAX_VALUE`, this denominator becomes Infinity. `squareOver` then falls back to `(d/sqrt(e))^2`; with `e=Infinity` this becomes zero even when the mathematical quotient is finite.
- 再現入力（乱数なし）: `mcnemarTest([[0,1e308],[8e307,0]],{correct:false})`。唯一のdiscordant pairの数学的寄与は `(2e307)^2/(1.8e308) ≈ 2.222222222222222e306`。ところが `1e308+8e307 === Infinity` となり、現行の `squareOver(2e307,Infinity)` は0を返す。defaultの `correct:true` でも同じ分母overflowが起こり、補正後の分子はこのスケールでは同じ2e307に丸められる。
- 監査範囲: 2×2 continuity correction branch、一般r×rのpairwise sum、zero discordant pairのskip、all-zero discordanceのthrow、matrix shape/finite/nonnegative validation、`squareOver` overflow fallback、p-valueへの統計量受け渡し。既存fixture suiteは通常規模のR/SciPyケースとpaired-code cross-tabulationを含むが、有限セル合計のoverflowケースは確認できなかった。
- 静的IEEE-754演算追跡のみ。Vitest/package runtime/R 4.5.2は未実施。Issue #140 open。ソース変更なし。監査台帳のみ更新。


## Audit #621 — goodness-of-fit expected counts lost when total overflows

- 対象: `src/htest/chisqTest.ts` SHA `314812b169de5e663b293c4f7a3fa07415adb130`、`src/internal/summary.ts` SHA `e4fc3bd652af3a00cf05b44389ddf58e590c4830`、`test/htest-basic.test.ts` SHA `5a48b4b7cc73c2a36a86debf1c0ed75a09399254`。
- **確定バグ Issue #141**: goodness-of-fit path computes `n=ddSum(x)` and then `E[i]=n*p[i]`. For finite counts with an unrepresentable total, `ddSum` returns Infinity and expected counts become Infinity even if each mathematical expected count is finite.
- 再現入力（乱数なし）: `chisqTest([1e308,1e308])`。デフォルトの等確率では総数は数学的に2e308、期待度数は各1e308。観測値と期待度数が一致するため期待結果はstatistic=0, df=1, pValue=1。現行実装では`ddSum`のplain sumがInfinityとなり、`E=[Infinity,Infinity]`、差分は-Infinity、`squareOver(-Infinity,Infinity)`はNaNとなる。
- 監査範囲: goodness-of-fitの総数・期待度数・Pearson寄与・residual/stdres、p/rescaleP validation、zero-probability category、contingencyのrow/column marginsと`productOver`、Yates補正、Monte Carlo分岐とdf処理。今回は独立した期待度数overflow経路を確定。その他の全境界分岐について実行検証はしていない。
- 静的IEEE-754演算追跡のみ。Vitest/package runtime/R 4.5.2は未実施。Issue #141 open。ソース変更なし。監査台帳のみ更新。


## Audit #622 — Normality-test formulas, tail calculations and class boundaries

- 対象: `src/htest/normalityTests.ts` SHA `5af37c355b8fd52a9168fe5edac16ac9a8bca83f`、`src/htest/core/shapiro.ts` SHA `55a4e1f6a4c0202a553b95d9242f9018b8b2308e`、`src/internal/summary.ts` SHA `e4fc3bd652af3a00cf05b44389ddf58e590c4830`。
- 監査範囲: ADの両端log-CDF重みと有限標本補正、CVMのmidpoint empirical CDFとpiecewise近似の境界、LillieforsのD+/D-とn>100変換・kk別近似、Shapiro-FranciaのBlom plotting positions・scale invariantな相関二乗W・log(1-W)近似、Pearson equal-probability class assignment・期待度数・adjustによるdfを追跡。共通のNaN除外、定数標本、非有限値の処理も確認。
- ADの和は標準的なAnderson-Darlingの順序統計量式と一致し、端点確率は `pnorm(...,{logP:true})` と反対裾のlog確率で直接計算する。CVMは `1/(12n)+Σ(F(z_i)-(2i-1)/(2n))²` の形で正しい。LillieforsのD+ / D- はECDFの右・左端を各観測点で比較し、n>100のスケーリング後は近似式のnを100に固定する。Shapiro-Franciaは共分散/分散比でWを形成し、データを2冪scaleして単位依存を除く。Pearsonは `floor(1+k*Φ(z))` を1..kにclampし、丸めでΦ(z)=1となる右端も最終classに収める。
- 追加した決定的な確認入力（乱数なし）: `adTest([-3,-2,-1,0,1,2,3,4])`; `cvmTest([-3,-2,-1,0,1,2,3,4])`; `lillieTest([-2,-1,0,0,1,2])`; `sfTest([-1.179761,-0.4972,0,0.4972,1.179761])`; `sfTest([1e308,1.0000000000000002e308,1.0000000000000004e308,1.0000000000000006e308,1.0000000000000008e308])`; `pearsonTest([1,2,3,4,5,6,7,8,9,10],{nClasses:4,adjust:false})`. これらは監査時に選定した入力であり、実関数の実行結果ではない。
- Shapiro-Franciaの `log(1-W)` はWがbinary64で1に丸められる極端な標本ではp値の分解能を失う可能性がある。ただし、現行のnortest互換近似もWから同じ変換を行い、今回の静的監査だけではRとの実測差または数学的に誤った有限値を確定できないためIssue化しない。AD/CVM/Lillieforsの近似式は既知の近似範囲・下限を持つため、近似の飽和自体は実装バグとしない。
- 既存 #201 のPearson class k+1問題とは別の追加監査。新規の確定バグなし。Issue追加なし。ソース変更なし。静的ソース監査のみで、Vitest/package runtime/R 4.5.2は未実施。


## Audit #623 — Jonckheere–Terpstra exact null distribution

- 対象: `src/htest/trendTests.ts` SHA `5dcd1d74fbe03a551c66a352b68b004d73cd52fb`。既存Audit #213の追加監査。
- 確定バグ: exact pathは各ordered group iと全後続観測のMann–Whitney U分布を個別に作り、これらを独立としてconvolutionする。しかし各成分は同じ観測値・group assignmentを共有し、独立ではない。3群以上で真のJT null distributionを再現しない。Issue #142。
- 再現入力（乱数なし）: `jonckheereTest([1,2,3],[1,2,3],{alternative:"two.sided",exact:true})`。3群各1例、tiesなし、観測JT=3。帰無仮説下の6 permutationはJT=0,1,2,3にそれぞれ1,2,2,1通りを与えるため、確率は1/6,2/6,2/6,1/6。真のupper tail=1/6、lower tail=1/6、two-sided p=1/3。現行実装は3個のBernoulli(1/2)のconvolutionでBinomial(3,1/2)を作り、upper/lower tail=1/8、two-sided p=1/4となる。
- 影響範囲: 3群以上の非空ordered groupsでexact path。2群の場合は単一Mann–Whitney分布なのでこの依存性バグはない。normal-approximation varianceは別計算であり、本監査では不具合を主張しない。
- 監査範囲: ordered group extraction、tie detection、JT pair count、exact selection threshold、Mann–Whitney distribution convolution、normal approximationのmean/variance式、alternative tail selection、two-sided capを静的に追跡。
- Issue: [#142](https://github.com/numero-uno-jpn/rStats.js/issues/142)。ソース変更なし。静的ソース監査と手計算による全6 permutation列挙のみ。Vitest/package runtime/R 4.5.2実行なし。


## Audit #624 — Cohen's d / Hedges' g noncentral-t CI bracket at large finite t

- 対象: `src/htest/effectSize.ts` SHA `2f1b77d5012396b88d1c36365045bf3c7b314e1d`、`src/numerics/integrate.ts` SHA `ac94e6aeb15bb89418a51f7a5332c28a107280bf`。
- 確定バグ: `ncpOfT(t,df,p)` は `uniroot(...,t-1,t+1,{extendInt:"downX"})` を呼ぶ。binary64のULPが2以上になる大きな有限tでは、±1の加算が同じtに丸められる場合がある。unirootはbracket extensionより前に `lower < upper` を検査するため、区間がゼロ幅ならRangeErrorでCI計算が失敗する。Issue #143。
- 再現入力（乱数なし）: `cohensD([1,1+Number.EPSILON],undefined,{mu:-1})`。2観測の標本分散は非ゼロ。標本平均は1に丸められ、標準誤差は `Number.EPSILON/2`。t統計量は `2/(Number.EPSILON/2)=2**54`。この値ではULP=4で、ties-to-evenにより `t-1===t` かつ `t+1===t`。よって `uniroot` は `RangeError("lower < upper is not fulfilled")` をthrowする。Hedges' gも同じ `ncpOfT` helperを使用。CIなしの `ci:null` はroot searchを通らない。
- 検証範囲: one-sample Cohen's d/Hedges' gのデータscale、平均・標準誤差・t statistic、noncentral-t rootの初期bracket、unirootの初期区間validationとextendInt実行順を静的追跡。
- Issue: [#143](https://github.com/numero-uno-jpn/rStats.js/issues/143)。ソース変更なし。静的ソース追跡とIEEE-754の2^54境界計算のみ。Vitest/package runtime/R 4.5.2実行なし。


## Audit #625 — Triangular distribution skewness overflows for wide finite support

- 対象: `src/distributions/summary.ts` SHA `cc61631c4213139f10157e3961e8a3b6f12f35b5`。既存Audit #152/#573の追加監査。
- 確定バグ: `triang` branchはvarianceのraw qがoverflow/underflowする場合にpower-of-two scaled `as,bs,cs,qs` を作り、sdDirectを計算する。一方skewnessは未scaleの `a+b-2c`, `2a-b-c`, `a-2b+c`, `q**1.5` を使用し、有限な真のskewnessをNaNにする。Issue #144。
- 再現入力（乱数なし）: `distSummary("triang",{a:-1e308,b:1e308,c:0})`。対称三角分布なので真のskewness=0。binary64で `a+b-2c=0`、`2a-b-c=-Infinity`、`a-2b+c=-Infinity`、`q=Infinity`。式はNaNになる。分散は数学的にbinary64上Infinityでよいが、sdはscaled pathで有限値を保持できる。
- 監査範囲: triangular mean/mode、q-based variance、scaled standard deviation、skewness、fixed excess kurtosis=-0.6、finite endpoint validationを追跡。既存lnorm small-sd (#120)、unif/triang wide interval、gamma/beta/pareto/Weibull momentsの追加stress範囲は既存台帳行を保持。
- Issue: [#144](https://github.com/numero-uno-jpn/rStats.js/issues/144)。ソース変更なし。静的演算追跡のみ。Vitest/package runtime/R 4.5.2実行なし。


## Audit #626 — Geometric CDF non-integer support boundary

- 対象: `src/distributions/geometric.ts` SHA `dfde963375d347292c88306f151aaa3a8a66612b`。既存Audit #103/#569の追加監査。
- 確定バグ: `pgeom1()` はlower-tail CDFの整数support indexを `Math.floor(q + 1e-7)` で決めている。これは本来の `floor(q)` と異なり、各正整数kの直前1e-7区間の実数qをkへ切り上げる。Issue #145。
- 再現入力（乱数なし）: `pgeom(0.99999999,0.5)`。正しいsupport indexはfloor(0.99999999)=0で、P(X≤0)=0.5。現行ではfloor(0.99999999+1e-7)=1となり、P(X≤1)=0.75を返す。値は意図的に1未満であり、丸め境界の曖昧さではない。
- 監査範囲: `probPair`、Loader binomial probabilityを使うqPowのn<1e290/巨大n branch、subnormal pのlog q、dgeomのinteger support、pgeom upper/lower/log-tail、qgeomのlog-ratioとjump slack、prob=1/0・NaN・Infinityを確認。既存qPowのlarge-n DD scalingとquantile slackは今回の不具合と独立。
- Issue: [#145](https://github.com/numero-uno-jpn/rStats.js/issues/145)。ソース変更なし。CDF定義とfloor式の静的追跡・手計算のみ。Vitest/package runtime/R 4.5.2実行なし。


## Audit #627 — Negative-binomial CDF non-integer support boundary

- 対象: `src/distributions/negbinomial.ts` SHA `6bf9bf9b9d8b05aa4828e33c4b2fb9b3ed5171c7`。既存Audit #147/#507/#570の追加監査。
- 確定バグ: `pnbinom1()`と`pnbinomMu1()`の双方が `Math.floor(q + 1e-7)` を使用する。実数qのCDF support indexはfloor(q)であり、整数直前の1e-7範囲を次の整数に切り上げてしまう。upper/lower tail両方で同じ誤ったsupport indexが使われる。Issue #146。
- 再現入力（乱数なし）: `pnbinom(0.99999999,1,{prob:0.5})` および `pnbinom(0.99999999,1,{mu:1})`。size=1, prob=0.5は幾何分布と同一（mu=1も等価）。floor(q)=0なので正しいP(X≤q)=P(X≤0)=0.5。現行floor(q+1e-7)=1によりP(X≤1)=0.75を返す。q=0.99999999は意図的に1未満の実数で、丸め境界の曖昧さではない。
- 監査範囲: fromMu overflow ratio、fromProbのDD pair、dnbinomRawのsize+x overflowとsubnormal prefactor、pnbinom large-x x+1 correction、upperSeriesの正項比・停止条件、prob/mu両parameterization、Poisson limit、quantile Cornish–Fisher/gamma startとrefineContinuous/discreteQuantileを静的追跡。既知Issue #95のunderflowケースは台帳既存記録を保持。
- Issue: [#146](https://github.com/numero-uno-jpn/rStats.js/issues/146)。ソース変更なし。CDFのsupport定義と実装floor式の静的追跡・手計算のみ。Vitest/package runtime/R 4.5.2実行なし。


## Audit #628 — Signed-rank distribution integer boundaries and subset-sum cache

- 対象: `src/distributions/signrank.ts` SHA `5af960306c0d9ed5a3dd5f65039b42b0298df355`、`src/internal/integer.ts` SHA `007ee293d3df0d02b4a2a38cc72a2479c5a5e4f0`、`src/internal/discrete.ts` SHA `6319e35f7decd8ece94884a858eaf89789656788`。既存Audit #151の追加監査。
- 監査範囲: nのhalf-even丸めとn<2^27制約、x/qのR force-integer tolerance、q+1e-7の丸め、support endpoint、symmetry index、subset-sum DP descending update、2^900 rescaling、trustLog2/minTrustedの誤差保証、main/low tableのLRU cache、low-table rebuild、Kahan累積、subnormal probabilityのlog reconstruction、discreteQuantile tail switchingとbisect stopping。
- 追加入力（乱数なし）: `psignrank(0.99999999,1)`; `psignrank(0.99999999,2)`; `psignrank(1.00000001,2)`; `psignrank(-0.00000001,2)`; `psignrank(3.6,5)`; `dsignrank(0.5,5)`; `dsignrank(1e-8,5)`; `qsignrank(-1000,1100,{logP:true})`; `psignrank(605549,1100,{lowerTail:false,logP:true})`。`psignrank`のq+1e-7はRのsigned-rank実装でのinteger rounding仕様に一致し、geometric/negative-binomial CDFの誤ったfloor補正とは区別される。DP更新は降順のため各rankを一度だけ使用し、対称性index `total-x-1` は `P(V>x)=P(V≤total-x-1)` と一致する。
- 追加監査で新規確定バグなし。Issue追加なし。ソース変更なし。ソース・fixture静的閲覧のみで、Vitest/package runtime/R 4.5.2実行なし。


## Audit #629 — Noncentral chi-square zero-df subnormal density scaling

- 対象: `src/distributions/nchisq.ts` SHA `9549791940c425d508057b7286329b396ca36c6f`（`dnchisq1`、`dnchisqRaw`、`subnormalHalf`、`gammaKernel`）、`src/internal/noncentral.ts`（`negligibleNcp`）、`test/nchisq.test.ts` SHA `764a104ca667e8b0d4309574cce3f72ab6806ed6`。
- **確定バグ Issue #147**: 非心カイ二乗分布で df=0 の連続密度に、subnormal補正の指数 `df/2 - 1 = -1` を適用している。df=0ではj=0項はx=0のatomであり、x>0の連続密度の先頭項はj=1（自由度2の中央カイ二乗）なので、x→0+で密度は有限定数に近づき、x^-1には比例しない。
- 再現入力（乱数なし）: `const x = 3 * Number.MIN_VALUE; const df = 0; const ncp = 1;`。IEEE-754で `x/2` は `2 * Number.MIN_VALUE` に丸められ、`x2 = 2*(x/2) = 4*Number.MIN_VALUE`。現行subnormal補正は `lt=log(x/x2)=log(3/4)` とし、`exp((df/2-1)*lt)=4/3` を掛ける。一方、Poisson mixtureの連続密度は `exp(-1/2)*(1/2)*f_2(0)=exp(-1/2)/4` に近づき、x=3MINと4MINの差で4/3倍には変化しない。したがって `dnchisq(3*Number.MIN_VALUE,0,{ncp:1})` は隣接subnormal点に対して誤った倍率となる。
- 既存Issue #115は大dfでの `0 * Infinity` によるNaNであり、本件はdf=0での指数そのものの誤り。別経路・別条件。
- 監査範囲: densityのdf=0/df<2/df=2境界、Poisson mixtureのj=0 atomとj≥1連続項、tiny-shape gamma kernel、subnormalHalfによるCDF/density scaling、asymptotic branch選択、Chernoff negligible-tail判定、quantile初期値とnarrow-spread/searchDoublesへの分岐を静的追跡。今回、独立して確定できた不具合は上記1件。
- Issue: https://github.com/numero-uno-jpn/rStats.js/issues/147 （open）。
- 静的IEEE-754演算追跡とPoisson mixtureの極限式による検証。Vitest/package runtime/R 4.5.2は未実施。ソースコード変更なし。監査台帳のみ更新。


## Audit #630 — Central and noncentral F distribution limits and extreme ratios

- 対象: `src/distributions/f.ts` SHA `12d20ccd20e09d1b4e4bdf1015553503d03b3872`（`fLogDensity`、`fRatios`、`fDensity`、`pfTiny`、`pfRaw`、`qf1`、`pChisqLimit`、`qChisqLimit`）、`src/distributions/nbeta.ts` SHA `5c51760f6e136b80a77b4284da39c25b0ab8ed86`（`dnbetaCore`、`pnbetaRaw`、`extremeTail`、`extremeDensityLog`、`integralLog`、`dnf1`、`pnf1`、`qnf1`）、`test/nf.test.ts` SHA `1ccbb8948196fbef5e66e7ec405e17b5be187378`、dnf/pnf/qnf fixtures。
- 監査範囲: m*xのoverflow/underflowと2^600 scaling、p/qがDBL_MIN以下になるときのlog-ratio経路、small-shape beta prefactor、m/nのoverflow/underflow、df1/df2=Infinityの極限、x=0/InfinityのR互換境界、central Fのbeta変換、df2=Infinityのchi-square/gamma極限、quantileのtail近似・最大/最小double境界、noncentral Fのmixture/chisq/gamma/w/integral method selection、Chernoff bound、tiny-tail近似、quantileの端点確認を静的追跡。
- 既知不具合との照合: Issue #116（fRatiosがundefinedのときのp≈1仮定の誤用）、#135（noncentral Fのm/n underflow）は別条件として再確認。いずれも今回新規発見として重複登録しない。
- 境界仕様の照合: `dnf1(m=Infinity,n<Infinity,ncp>0)` のx>0でcentral reciprocal-gamma limitを使う経路、x=0でNaNとなる経路はdnf fixtureと整合。pnf/qnfのm=Infinity時のNaNもfixture上のR互換仕様と整合。df2=Infinityではnoncentral chi-square limitを使用し、既存fixturesにあるtiny-tail quantileもその経路で扱う。
- 数値順序の確認: `qf1` のupper-tail early-Infinity判定は近似log quantileだけで決めず、`pfRaw(Number.MAX_VALUE,...)` とtargetを比較してから返すため、709.78とlog(Number.MAX_VALUE)の差だけで有限quantileをInfinityにする構造ではない。
- **今回の追加監査で新規確定バグなし。Issue追加なし。ソース変更なし。** ソース・fixture静的閲覧のみ。Vitest/package runtime/R 4.5.2は未実施。


## Audit #631 — Noncentral beta Poisson mixture, subnormal shapes, and tail/quantile paths

- 対象: `src/distributions/nbeta.ts` SHA `5c51760f6e136b80a77b4284da39c25b0ab8ed86`（`betaKernel`、`betaKernelIncLog`、`pnbetaRaw`、`leftTailLog`、`densitySum`、`method`、`integralLog`、`dnbeta1`、`pnbeta1`、`qnbeta1`）、`src/internal/poissonMixture.ts` SHA `f0c6a1cf85875cf87f5174c0fcc5575e31db5746`、`src/internal/noncentral.ts`、`src/special/incbet.ts`、`src/distributions/beta.ts`、`test/nbeta.test.ts` SHA `b92e2218f99be7492e9a1cc620acde52808ce070`。
- 監査範囲: Poisson mixtureの上下tail開始点・再帰方向・正項加算・打切り条件、density peakからの上下方向加算、scaled mantissa/exponentとrefresh、beta incrementの比率とdouble-double補正、subnormal x/1-x/shapeのlog経路、left-tailの別系列、chisq/gamma/w/integral method選択、integralのmode探索・両側積分・左端power tail補正、CDF tail補完、quantileの端点・初期値・narrow search・double searchを追跡。
- 既知Issueとの照合: open Issue「Noncentral beta density drops the dominant j=0 term when a shape is subnormal」は `betaKernelIncLog()` 内の `Math.log1p(s / b)` が `s / b` のoverflowでj=0 incrementを消す問題。今回も該当経路を確認したが、同じ原因・再現条件であり重複Issueは作成しない。別途、`negligibleNcp()` の `mu * max(1,r)` がoverflow/underflowする境界、`mu=ncp/2` が0へunderflowするsubnormal ncp、shapeの和・比のoverflow、xと1-xがsubnormalとなる領域を追跡した。
- 追加の決定的入力（乱数なし）: `dbeta(0.5, 0.75, Number.MIN_VALUE, { ncp: 0.1, log: true })`（既知Issueのj=0欠落経路の再確認）、`pbeta(1 - 2 ** -53, 79.32204890240992, 0.09403994879604119, { ncp: 1.245630132105305e22, logP: true })`（巨大ncp・右端近傍の既存回帰ケース）、`pbeta(1e-7, 3, 5, { ncp: 2e7, logP: true })`（left-tail log seriesの既存参照ケース）。これらのコードパスと既存テストの期待値を確認し、今回の新規Issueとはしなかった。
- Poisson mixtureの開始点と再帰は、lower tailで `P_j=P_{j+1}+d_j` を加算し、upper tailで `Q_{j+1}=Q_j+d_j` を加算する向きになっている。densityはjStarから上下に走査する。subnormal incrementはlog経由のScaled表現へ退避し、指数差を別保持するため、単純なlinear underflowだけで項を失う構造ではない。ただし既知Issueの `betaKernelIncLog` overflowはこの退避経路自体で発生する。
- **今回の追加監査で新規確定バグなし。Issue追加なし。ソース変更なし。** GitHub上のソース・テストの静的追跡のみ。Vitest/package runtime/R 4.5.2は未実施。


## Audit #632 — Incomplete beta function: both shapes positive-subnormal

- 対象: `src/special/incbet.ts` SHA `59a4ebdf385c69124e68fae6d16159bfd6709a24`、`src/special/incbetPrefactor.ts` SHA `bf49427ee0d86f326b25dbb3841c4f355ca6444c`、`src/special/incbetTemme.ts` SHA `cf22538af050c12366e0e0a19ab40ddcd09c7db6`、`src/special/incbetLargeA.ts` SHA `9eabe133979cd41a00a904c61cb60ed6b35b6693`、`src/distributions/beta.ts` SHA `bd639c0fdaa40df7e6579ffa0b76a67c6d738e97`、`test/beta.test.ts` SHA `319ce81d026f279b528f948d146d4c0c858c7321`、`test/nbeta.test.ts` SHA `b92e2218f99be7492e9a1cc620acde52808ce070`。
- 監査範囲: incomplete betaのseries / complement series / continued fraction / opposite-frame tail、double-double係数、continued-fraction rescalingと停止条件、Loader・small-shape・huge-shape prefactor、subnormal x専用series、両shape tinyの場合の分岐、Temme一様漸近展開、large-a/small-b漸近展開とgamma-tail再帰、CDFの線形値/log値・上下tail補完、beta quantileのat-half判定と左右探索を追跡。
- **新規Issue #148**: `pbeta(0.5, Number.MIN_VALUE, Number.MIN_VALUE)` がNaNとなるソース経路を確認。対称性により正しい値は厳密に0.5。両shapeが `SUB_SHAPE` 未満かつ `SUB_OTHER` 以下なので `subShapeTail` の近似分岐を通らず、p-seriesへ入る。`1/a` がInfinityとなって級数本体がスキップされ、`prefactorParts` の係数 `s/(1+s/l)` は半最小subnormalとして0へ丸められる。linear pathの `Infinity * 0` がNaNとなり、log pathでも `log(Infinity) + log(0)` がNaNとなる。Issue: https://github.com/numero-uno-jpn/rStats.js/issues/148
- 追加の決定的入力: `pbeta(0.5, Number.MIN_VALUE, Number.MIN_VALUE)`（対称性の厳密な不変条件）、`pbeta(0.5, Number.MIN_VALUE, Number.MIN_VALUE, { logP: true })`（同じlog経路）、既存テスト中の巨大非心度・subnormal形状・tiny tail回帰ケースを再読。乱数なし。
- Rとの関係: 期待値0.5はRとの比較に依存しない数学的対称性から導出。R実行は未実施。
- その他の監査経路では、p-seriesの項比が最終的にx以下へ収束する領域条件、continued fractionのdouble-double係数と最大反復数、Temme展開の適用域 `m >= 25, |tau| <= 1`、large-a展開の `y/u/b` 適用域と正項再帰を静的に確認。今回、Issue #148以外の新規確定バグは見つからなかった。
- **検証制限**: GitHub上のソースと既存テストの静的追跡のみ。package runtime、Vitest、R 4.5.2での実測は未実施。Issue #148の再現はソース経路からの確定的推論であり、実行結果を取得したとは主張しない。


## Audit #633 — Gamma差分ヘルパーの到達可能性とdigamma/polygamma境界

- 対象: `src/special/lgammaDiff.ts` SHA `22ddcc50b01890dafbbb49a1a1aa7ac2c840dfee`、`src/special/incbetPrefactor.ts`、`src/special/gamma.ts` SHA `f630bdd496fc204dd24b6b04603c7b511a5cb107`、`src/special/psigamma.ts` SHA `6318724165a556417c0644172c9e80d4735c3b4e`、`src/special/constants.ts`、`test/gamma.test.ts` SHA `db75474bb21ad3531f9ae071cffa359023e1af37`、`test/psigamma.test.ts` SHA `eeeb4bb3aece8c27cc5527c16b5cadb0540d8b98`。
- 前回の候補 `lgammaDiff(a,b)` における `a/b` overflowをcall siteまで追跡。実際の呼び出し元は `incbetPrefactor.ts` の `smallShapeG` のみ。`l < 1` の枝では `b=1+l`、`l >= 1` の枝では `b=l)、いずれも `a=s<1` なので `a/b <= 1`。従って `b` がsubnormalとなる入力は公開APIからこの関数へ到達しない。前回の「極端な引数比でoverflowする可能性」は到達不能な仮定であり、バグとして扱わない。
- gammaの正負大引数、負整数pole、MAXGAM近傍、MAXLGM、subnormal近傍のlgamma、lgamma1pのTaylor切替、Stirling補正とdouble-double指数合成を確認。polygammaは正引数のHurwitz zeta scaled sum、q>1e8の漸近分岐、直接項の停止条件、Euler-Maclaurin補正、負引数のreflection/cot導関数、deriv=0..100とpole/infinity処理を確認。
- 決定的境界入力として `gamma(Number.MIN_VALUE)`、`lgamma(Number.MIN_VALUE)`、`lgamma(-Number.MIN_VALUE)`、`psigamma(Number.MIN_VALUE, 100)`、`psigamma(1e8, 100)`、`psigamma(1e8 + 2, 100)`、`psigamma(-0.5, 100)`、`psigamma(-Infinity, 3)` を検討。これらのうちsubnormal gamma/lgammaとpole/infinityの期待動作は実装コメント・既存テストの仕様と整合。psigammaの高次・大q境界については漸近式とスケーリングを静的確認し、追加の確定バグを特定できず。
- **新規確定バグなし。Issue追加なし。ソース変更なし。** GitHubソース・既存テストの静的監査のみ。Vitest/package runtime/R実行は未実施。


## Audit #634 — `perm()` with infinite n and finite large k

- 対象: `src/special/extra.ts` SHA `f4da727f23f20c049946c5c962f54ac270678e26`、`src/special/erf.ts` SHA `f72136920c3138354d5d6cd4a342055e590e0fad`、`test/specialextra.test.ts` SHA `8958d99a306c3c729b08a43496166b0982853614`。
- **新規Issue #149**: `perm(Infinity, 1001)` がNaNになる。有限の正のkを固定すると `Gamma(n+1)/Gamma(n-k+1) ~ n^k` なのでn→+Infinityで期待値は+Infinity。現在は `perm()` の非有限値分岐から `permLgamma()` に入り、両方の `lgammaSign(Infinity)` がInfinityとなって差が `Infinity-Infinity=NaN`。有限非整数k>1000でも同経路。Issue: https://github.com/numero-uno-jpn/rStats.js/issues/149
- 決定的再現入力: `perm(Infinity, 1001)`、`perm(Infinity, 1000.5)`。境界対照として `perm(Infinity, 0)` はk<=1000のfalling factorial経路で1、`perm(Infinity, 1)` はInfinityとなる。乱数なし。
- 推奨修正方向: `n===Infinity` かつ有限 `k>0` をlog-gamma比より前に処理してInfinityとする。k=0は1を維持し、n=k=Infinityは別途未定義扱い。
- 併せて `gammainc` のgamma overflow領域とsmall-tail経路、`erfinv/erfcinv` の端点・subnormal確率、`erf/erfc/erfcx` のx=0,1,8,27付近・大引数切替を確認。今回それ以外に新規確定バグなし。
- **検証制限**: ソースと既存テストの静的追跡のみ。Vitest/package runtime/R実行は未実施。


## Audit #635 — Regularized incomplete gamma: series, continued fraction, Temme and extreme tails

- 対象: `src/special/igam.ts` SHA `b06dd71a2f60ebe59d92e8759b0b6af7aebc2620`、`src/special/extra.ts` SHA `f4da727f23f20c049946c5c962f54ac270678e26`、`src/special/erf.ts` SHA `f72136920c3138354d5d6cd4a342055e590e0fad`、`test/gamma.test.ts` SHA `db75474bb21ad3531f9ae071cffa359023e1af37`、`test/specialextra.test.ts` SHA `8958d99a306c3c729b08a43496166b0982853614`。
- 監査範囲: lower seriesとdouble-double seriesの項比・停止条件、upper continued fractionの収束判定・rescaling、large-x用Lentz法、small-x upper-tail series、Temme central/near-central asymptotic、far-tail asymptotic、subnormal shapeのA_SUB近似、log/linear両tailの補完、gammaincの非正則化積とsmall-tail直接計算、erf/erfc/erfcxのrational近似・大引数cutoff、erfinv/erfcinvの端点とsubnormal確率。
- 境界検討入力: `gammaInc(Number.MIN_VALUE, Number.MIN_VALUE, false, true)`（subnormal shapeのupper-tail scaling）、`gammaInc(1e299, 1e298, true, true)`（極大shapeでx≪a）、`gammaInc(1e299, 1e308, false, true)`（極大shapeでx≫a）、`gammaInc(1e6, 1e6, true, true)`（Temme近傍）、`erfcinv(Number.MIN_VALUE)`、`erfinv(1 - 2 ** -52)`、`erfcxNonNegative(1e8)`。いずれも実行結果ではなく、ソースの分岐・漸近式と既存のmpmath/R fixture coverageを静的に照合。
- upper tailの `a < A_SUB` は `Q(a,x) ≈ (a/A_SUB)Q(A_SUB,x)` に切り替え、subnormal aで直接級数が小さい積を失う経路を回避する。continued fractionはx>aの呼び出し条件で初期b=x+1-aが正かつ1以上となり、Lentzの初期逆数がpoleになる条件は公開経路では生じない。Temmeの適用域もa>20かつ近中心域、far-tailはa>200の狭域またはa>1e299に限定される。
- **新規確定バグなし。Issue追加なし。ソース変更なし。** #149は前項Audit #634で登録済み。
- **検証制限**: GitHubソース・既存fixture/testの静的追跡のみ。Vitest/package runtime/R実行は未実施。


## Audit #636 — Loader基盤: bd0 / stirlerr / dpoisRaw / dbinomRaw

- 対象: `src/special/loader.ts` SHA `c85075fbce1fb3ff6933cbdb5c50477de3d25abf`、`src/special/dd.ts`、`src/special/log1pmx.ts` SHA `2645eccad6849a9c217899b99e71e58d6e7055f8`。関連するgamma・beta・Poisson・binomial分布から呼び出される共通数値基盤を追跡。
- 監査範囲: stirlerrのhalf-integer table/series/recurrence、bd0ddの近接v-series・far logarithmic branch・2^-64 scaling・double-double disabled branch、bd0Prodのtiny product fallback、farDeviance/scaleUp、expNegDDのsubnormal終端処理、dbinomRawDDのx=0/n-x=0/p=0/q=0・exactBinomialExponent・巨大nのdeviance、dpoisRawCoreのlambda=0・lambda/x極端比・subnormal・巨大x/lambdaを確認。
- 既知Issue: `log1pmx(0)` またはx² underflowでシリーズを498回走る問題はopen Issueとして既に存在。重複登録しない。
- 決定的境界入力として `bd0(0, Number.MIN_VALUE)`、`bd0(1e300, 1e300 * (1 + 2 ** -52))`、`stirlerr(Number.MIN_VALUE)`、`stirlerr(Infinity)`、`dpoisRaw(Number.MIN_VALUE, Number.MIN_VALUE, true)`、`dpoisRaw(1e308, 1, true)`、`dbinomRawDD(0, 1e308, [Number.MIN_VALUE, 0], [1, 0], true)`、`dbinomRawDD(1e308, 1e308, [0.5, 0], [0.5, 0], true)` を検討。いずれもソース上のdomain・scaled演算・log/linear分岐と照合し、新規の確定不具合は確認できなかった。
- **新規確定バグなし。Issue追加なし。ソース変更なし。** #149はAudit #634で登録済み。
- **検証制限**: GitHubソースの静的追跡のみ。Vitest/package runtime/R実行は未実施。


## Audit #637 — Double-double primitives and exponential building blocks

- 対象: `src/special/dd.ts` SHA `2edeba6b0c0f5e7714d3d1416e4d6f9da5b17c2f`、`src/internal/ddexp.ts` SHA `14e46651c7ff1d1a6269ab50eded32183465172d`、`src/special/log1pmx.ts` SHA `2645eccad6849a9c217899b99e71e58d6e7055f8`、`test/helpers/precision.ts` SHA `1114ac1d951b03ed2c5d4867dbb38d726801663b`。
- 監査範囲: `twoSum/twoProd` と `prodErrScaled` のVeltkamp分割・subnormal/overflow復元、`ddAdd/ddSub/ddMul/ddMulNum` の正規化と誤差項、`ddDiv/ddDivNum` の商残差2段補正、`ddLog` のsubnormal正規化・128点テーブルindex・atanh多項式、`ddExp` のln2 range reduction・Taylor・再二乗・overflow/underflow、`standardizeDD/divideTail` の極小/極大スケーリング、`expNeg/expNegOver` のsubnormal終端処理、`log1mExp/logAddExp/logSubExp` の端点処理を確認。
- 既知のopen Issue「ddDiv loses the double-double quotient remainder for subnormal divisors」を確認。決定的再現は `ddDiv([Number.MIN_VALUE, 0], [3 * Number.MIN_VALUE, 0])` および `ddDivNum([Number.MIN_VALUE, 0], 3 * Number.MIN_VALUE)`。厳密商は1/3で、loは約 `1.8503717077085942e-17` が必要だが、商残差がsubnormal格子未満にunderflowしてlo=0となる。これは既存Issueで報告済みのため重複登録しない。Issue本文のとおり、公開分布関数での差分影響は未立証。
- 追加の決定的境界入力: `ddLog([Number.MIN_VALUE, 0])`、`ddLog([Number.MAX_VALUE, 0])`、`twoProd(Number.MIN_VALUE, 1.2345678901234567e308)`、`ddExp([709.78, 0])`、`ddExp([-708.1, 0])`、`standardizeDD(1e308, -1e308, 1e308)`、`expNegOver([745, 0], Number.MIN_VALUE)`。スケーリング・端点分岐を静的追跡し、別の確定バグは特定できず。
- **新規確定バグなし。Issue追加なし。ソース変更なし。** 既知ddDiv問題は重複回避。
- **検証制限**: GitHubソースと既存Issue本文の静的確認のみ。TypeScript runtime/Vitest/MPFR/Rは未実施。


## Audit #638 — ddDiv既知不具合の公開分布への到達性

- 対象: `src/special/incbet.ts` SHA `59a4ebdf385c69124e68fae6d16159bfd6709a24`、`src/special/incbetLargeA.ts` SHA `9eabe133979cd41a00a904c61cb60ed6b35b6693`、`src/special/loader.ts` SHA `c85075fbce1fb3ff6933cbdb5c50477de3d25abf`、`src/distributions/gamma.ts`。
- Audit #637で確認した `ddDiv/ddDivNum` のsubnormal除数時の低位商喪失について、実際の呼び出し元を追跡。
- incomplete betaのcontinued fractionは、subnormal shapeでは `pseries` または `subShapeTail` が先に適用される。continued fractionに到達するには両frameのseries条件を満たさず、かつlarge-A展開にも入らない必要があり、係数分母 `a(a+1)`、`(a+1)(a+2)` はsubnormalにはならない。二つ目のframe変換 `x/(1-x)` も `x<1` のbinary64入力で `1-x` が最小でも約 `2^-53` であり、subnormal divisorではない。
- Loaderの `bd0dd` 近接分岐は `ddDiv(d, x+M)` を使うが、x,Mがsubnormalのときdevience自体がsubnormal未満となり、低位商誤差が残差に及ぼす影響はbinary64出力に現れない。Gamma密度のtiny-x経路は `x/scale < DBL_MIN` でLoaderを迂回する。
- `incbetLargeA.ts` の `upperGammaScaled` は `u>=0.3` の適用域であり、分母はnormal。large-A展開の `ddDiv` も大きいshape/normal scaleに限定される。
- 以上から、既知ddDiv問題の公開分布関数への影響は、この呼び出し経路調査では確認できず。元Issueの「公開出力差分は未立証」という状態を維持する。Issue重複なし。
- **新規確定バグなし。ソース変更なし。** 既知IssueはAudit #637で記録済み。
- **検証制限**: ソースの分岐条件と式による静的到達性確認のみ。Vitest/package runtime/Rは未実施。


## Audit #639 — Poisson mixture loop progress beyond the binary64 integer limit

- 対象: `src/internal/poissonMixture.ts` SHA `f0c6a1cf85875cf87f5174c0fcc5575e31db5746`、`src/distributions/nchisq.ts` SHA `9549791940c425d508057b7286329b396ca36c6f`、`src/special/igam.ts`、`src/special/loader.ts`。
- **新規Issue #150**: [pchisq can hang when the Poisson mixture index exceeds 2^53](https://github.com/numero-uno-jpn/rStats.js/issues/150)。`pchisq(2 ** -1030, 2, { ncp: 1e308 })` で、`mu=ncp/2=5e307`。Chernoff境界は分母が約0.0087となりsがInfinityへoverflowして適用不能、Bessel引数は約0.0932で漸近法の閾値未満、入力qは2の冪なのでsubnormalHalfも適用されない。従ってPoisson mixtureのlower sumに到達する。
- `upperStart(mu)` は `startSearch(mu, 1)` を経てPoisson mode近傍のindexを返す。indexは5e307近傍で2^53を大幅に超え、binary64では `j - 1 === j`。そのため `sumLower()` の `for (let j = J; j >= 0; j--)` が進捗せず、同関数にはMAX_TERMSの上限もない。Issue本文に再現式、分岐経路、IEEE-754の直接判定を記載。
- 対照となる整数精度境界: `const j = 5e307; j - 1 === j` はtrue。再現呼び出し自体はnon-terminatingの疑いがあるため実行していない。TypeScript/Vitest実行なし。
- 推奨方向: 単位刻みできないPoisson indexの領域を混合和へ入れる前に検出し、漸近/積分法などへ振り分ける。単なるiteration capはhang防止のみで正しい確率値を保証しない。
- 併せて `startSearch` のbracketing/bisectionと `sumUpper` のbounded loop、`sumLower` のtermination条件、`mixtureDensity` の上下walkを確認。新たな別件の確定バグは今回追加していない。
- **検証制限**: GitHubソースの静的追跡とPythonでのIEEE-754数値確認のみ。TypeScript runtime/Vitest/R実行は未実施。


## Audit #640 — 非心Beta / 非心Fの混合・極端値・積分経路

- 対象: `src/distributions/nbeta.ts` SHA `5c51760f6e136b80a77b4284da39c25b0ab8ed86`、`src/distributions/nchisq.ts` SHA `9549791940c425d508057b7286329b396ca36c6f`、`src/internal/noncentral.ts` SHA `0a7c75dcdcc9bcf9a4b3bbd75ed613e5c6046ad7`、`test/nbeta.test.ts` SHA `b92e2218f99be7492e9a1cc620acde52808ce070`、`test/nf.test.ts` SHA `1ccbb8948196fbef5e66e7ec405e17b5be187378`。
- 監査範囲: 非心Beta/Fのmethod選択（mixture/chisq/gamma/w/integral）、Poisson mixtureから積分法への閾値 `MU_MIXTURE=1e6`、farLeftLogの主項近似、leftTailLogの1000項上限、gamma/w cumulant expansionの適用判定、log-y積分のmode search・両側積分・power-law端点補正、fPair/fOddsのunderflow/overflow分岐、非心FのChernoff boundとquantile極端域を確認。
- 既知open Issueを再確認: (1) 非心Beta密度でshapeがsubnormalの際にdominant j=0項を落とす問題、(2) 非心F tiny-tailで有限m/nがunderflowし `-Infinity` になる問題。いずれも既存Issueであり、重複登録しない。
- 決定的境界入力として `dbeta(0.5, 1e-320, 2, { ncp: 1 })`、`pbeta(1e-100, 2, 3, { ncp: 2e7, logP: true })`、`pf(1e-250, 1e-220, 1e100, { ncp: 1e3, logP: true })`、`pf(1e300, 1e200, 2, { ncp: 20, lowerTail: false, logP: true })`、`qbeta(1e-250, 2, 3, { ncp: 1e20 })`、`qf(1e-200, 2, 3, { ncp: 1e20 })` を式・分岐上で検討。実行結果ではない。
- mixture経路は `mu>1e6` で積分法へ切り替わり、Poisson indexが2^53を超える経路を避ける。既知Issue #150のsumLower hangは、非心χ²の別経路（Audit #639）であり、非心Beta/Fではmethod切替で到達しない。far-left seriesは最大1000項でbounded、積分のgolden-section/左右区間も各300/200反復、adaptive quadratureはdepth 40と全体300 bisectでbounded。
- `fPair` の tiny/huge m q分岐、`fOdds` のk underflow、`pnfTiny` のfirst-term approximationは既存テストの回帰入力と整合。open Issueのfinite m/n ratio underflow問題以外に、新しい確定バグは特定できず。
- **新規確定バグなし。Issue追加なし。ソース変更なし。** 既知Issueは重複回避。
- **検証制限**: GitHubソース・既存テストの静的追跡のみ。Vitest/package runtime/R/高精度数値計算は未実施。


## Audit #641 — 非心t分布の積分・Laplace・極端quantile

- 対象: `src/distributions/nt.ts` SHA `85763973f3f7a82d46ceee19a4dd0f8d8c275814`、`src/internal/noncentral.ts` SHA `0a7c75dcdcc9bcf9a4b3bbd75ed613e5c6046ad7`、`test/nt.test.ts` SHA `256fd766b66bbb636d57a89a0549d3f6ccb1e297`。
- 監査範囲: formula A/Bの切替、`gammaLog` のsubnormal shape近似、`findPeak` のNewton/bracket、double-double `ddExp/expm1mx/logPhiDD`、trapezoidの左右tail停止・step halving、adaptive Kronrodの深さ/総bisect上限、Laplaceの導関数・補正誤差条件、farLimit/farTailsのpower-law、nearZero、huge-df正規/Student-t極限、qnt1の符号判定・far-tail直接反転・invertContinuousを確認。
- 既存open Issueを照合し、今回の候補を新規登録しないことを確認: (1) `farLimit` overflow時の非心t quantile、(2) 巨大有限ncpでLaplaceの二乗スケールがoverflow、(3) representableなquantileを709.78 cutoffでInfinityと誤判定、(4) cohensD/hedgesGの初期bracketが大きなtでcollapse。これらは既存Issueで報告済み。
- 決定的境界入力として `pt(0, 1e-320, { ncp: 40, logP: true })`、`dt(1e200, 2e5, { ncp: 1e200, log: true })`、`qt(-1419.565225786768, 2, { lowerTail: false, logP: true })`、`pt(1e308, 2, { ncp: 1e300, lowerTail: false, logP: true })`、`qt(0.9, 2, { ncp: 1e299 })`、`qt(0.5, 1e201, { ncp: 1e100 })` を検討。実行結果ではなく、既存Issueの再現条件・分岐・式との静的照合。
- trapezoidの各方向は100000 nodeか|z|>40でbounded、refinementは6段階、Laplace/peak searchは300〜400反復、Kronrodはdepth 40とglobal bisection budgetでbounded。新たなnon-terminating loopは認めず。
- **新規確定バグなし。Issue追加なし。ソース変更なし。** 既知4件は重複回避。
- **検証制限**: GitHubソース・既存テストの静的追跡のみ。Vitest/package runtime/R/mpmathは未実施。


## Audit #642 — Central Student-t density / CDF / quantile and normal-limit branches

- 対象: `src/distributions/t.ts` SHA `78247f0318768944233dc6e92874409b23e432b8`、`src/distributions/normal.ts` SHA `8a6db705befe4a4ea30785bdb4806cf18a59cbc6`、`src/distributions/nt.ts`、`test/pnorm.test.ts` SHA `4132f9b4faf248f2a0e566d02c344a36ea4ff0f3`、`test/qnorm.test.ts` SHA `3e4f2d567782d5522658f4ff3cf7f8db5f531ead`、`test/locationScaleExtremes.test.ts` SHA `40cfbea8db0116924cadfe5f25530f48ca367cac`。
- 監査範囲: `dtCore` のLoader表現とlarge-x log1p分岐、tiny-df密度/尾部近似、`betaArgs` の共通スケーリング、upper-tail incomplete beta first-term近似、small/large df normal limit、`qt1` tail asymptotic start/Cornish-Fisher fallback/Newton反転、normalのstandardize/affine、pnormのerfcx tail、qnormのndtriExp + Newton correction、極小sd density scalingを確認。
- 既知open Issue「location-scale quantiles return finite median limits for infinite scale instead of R's NaN」を確認。今回のt/normal計算に重複する新規報告はなし。非心tの709.78 cutoff問題はAudit #641で既存Issueとして記録済み。
- 決定的境界入力として `dt(0, Number.MIN_VALUE)`、`dt(1e300, 1e-20, { log: true })`、`pt(1e308, 1e-300, { lowerTail: false, logP: true })`、`qt(-1e-300, 1e-300, { logP: true })`、`qt(-1419.565225786768, 2, { lowerTail: false, logP: true })`、`pnorm(-1.5e154, { logP: true })`、`dnorm(4.85e-319, { sd: 1.7e-322 })`、`qnorm(-1e308, { logP: true })` を検討。式・分岐の静的追跡であり、実行結果ではない。
- `dtTinyDf` の `u>=1e150` 分岐で先に `sqrt(n)/|x|` がunderflowする場合、最終密度もbinary64で0となる範囲に限られる。central t upper-tailの `x<=1e-250` はlog-domainのfirst-termへ移り、`betaArgs` の積スケーリングは通常経路でのsquare overflowを避ける。新規の確定バグを特定できず。
- **新規確定バグなし。Issue追加なし。ソース変更なし。**
- **検証制限**: GitHubソース・既存テストの静的追跡のみ。Vitest/package runtime/R実行は未実施。


## Audit #643 — Normal CDF/quantile, inverse-normal and error-function tails

- 対象: `src/special/ndtri.ts` SHA `a053252d5cbafbbb22f395fc4c2034da9c2ee5e9`、`src/special/erf.ts` SHA `f72136920c3138354d5d6cd4a342055e590e0fad`、`src/special/polevl.ts` SHA `165b2c81afea8cb58b56f67264dafdf22810f089`、`src/distributions/normal.ts` SHA `8a6db705befe4a4ea30785bdb4806cf18a59cbc6`、`src/internal/ddexp.ts` SHA `14e46651c7ff1d1a6269ab50eded32183465172d`、`test/erf.test.ts` SHA `10c82052f3e6fd1e555766fd2bed8010a066923a`、`test/qnorm.test.ts` SHA `3e4f2d567782d5522658f4ff3cf7f8db5f531ead`、`test/extremeAccuracy.test.ts` SHA `ac9e40428d3cb917d50c17e835869572de01729b`。
- 監査範囲: `ndtri` の中央/2段tail rational approximation、`tailFromZ` のz→0/Infinity、`ndtriExp` のlog probability経路（-2、-2048、-DBL_MAX、-0、-Infinity近傍）、`erf/erfc/erfcx` のx=1/8/1e8切替とsubnormal exp、Horner評価、`pnormStd` のlower/upper tailとlog1p、`ndtriLogRefined` のNewton補正、`standardizeValue/standardizeDD/affine/locationScale` のoverflow/subnormal scaling、`ddExp/expNegOver` の指数範囲を確認。
- 決定的境界入力として `qnorm(-5e-324, { logP: true })`、`qnorm(-Number.MAX_VALUE, { logP: true })`、`pnorm(-1.5e154, { logP: true })`、`erfc(27)`、`erfc(27.3)`、`erfcx(1e8)`、`erfcx(1e8 + 2)`、`dnorm(4.85e-319, { sd: 1.7e-322 })`、`qnorm(0.9, { mean: -1e308, sd: 1.7e308 })` を検討。既存テストのfixture/mpmath比較と式を静的に照合したもので、今回の実行結果ではない。
- `ndtriExp` の `y<-2` では `sqrt(-2y)` のoverflowを `sqrt(2)*sqrt(-y)` に分解し、`y	o-infty) は正しく負Infinityへ向かう。erfcのsubnormal結果は `exp(-700)` を最後に掛ける。erfcxのx>1e8漸近打切り誤差は先頭補正 `1/(2x²)) 以下で約5e-17。standardize/affineのscaled branchesは既存の極端値回帰と整合。
- open Issue「location-scale quantiles return finite median limits for infinite scale instead of R's NaN」を確認。これはRとの仕様差として既知であり、今回の数値誤差バグとして重複登録しない。
- **新規確定バグなし。Issue追加なし。ソース変更なし。**
- **検証制限**: GitHubソース・既存fixture/testの静的追跡のみ。Vitest/package runtime/R/mpmath実行は未実施。


## Audit #644 — Binomial / Poisson / Negative-binomial discrete tails and large counts

- 対象: `src/distributions/binomial.ts` SHA `09ccfb35cb3ef73351b6cd3b32ccb42e5d85eb85`、`src/distributions/poisson.ts` SHA `8bac99d8cfb238c1d682278c145798d0c44abc0b`、`src/distributions/negbinomial.ts` SHA `6bf9bf9b9d8b05aa4828e33c4b2fb9b3ed5171c7`、`test/dbinomHuge.test.ts` SHA `7540dcb12b538a96e225ea291d06a8c6e0af9f61`。
- **新規Issue #151**: [dnbinom returns NaN when finite size + x overflows](https://github.com/numero-uno-jpn/rStats.js/issues/151)。再現入力 `dnbinom(1e308, 1e308, { prob: 0.5 })`、同log版、`dnbinom(1e308, 1e308, { mu: 1e308 }))。`dnbinomRaw()` が `size + x` のoverflowを検出してNaNを返すが、確率質量は有限で表現可能。size=x=N, prob=1/2では `P[X=N] = N/(2N) P[Binomial(2N,1/2)=N] ~ 1/(2 sqrt(pi N)))。N=1e308で期待値は約 `2.820947917738782e-155)、logは約 `-355.8636164445677`。決定的入力・閉形式漸近式で確認。実行は未実施。
- binomial/Poissonでは、x+1が2^53超で表現できないときのincomplete beta/gamma補正、upper-tail差分のcancel fallback、Loaderのlarge-count処理、離散quantile探索を確認。negative-binomialでは `fromMu` のsize+mu overflow比率、`upperSeries` の条件・最大100万項、`pnbinomRaw` の2^53超補正、`refineContinuous` の8反復、prob/mu各parameterizationの端点を確認。
- 追加の境界検討: `pbinom(1e16, 2e16, 0.5)`、`ppois(1e16, 1e16)`、`qpois(0.5, 1e16)`、`pnbinom(1e16, 1e16, { prob: 0.5 })`、`dnbinom(1e308, 1e308, { mu: 1e308, log: true })`。このうち最後の密度overflowはIssue #151。その他に新規確定バグなし。
- **新規Issue #151、ソース変更なし。** Vitest/package runtime/R実行は未実施。Issue #151の期待値は中心二項分布の漸近式で算出。


## Audit #645 — Geometric / Hypergeometric / Multinomial / Rank-sum discrete distributions

- 対象: `src/distributions/geometric.ts` SHA `dfde963375d347292c88306f151aaa3a8a66612b`、`src/distributions/hypergeometric.ts` SHA `557f15ed94b73d98cc3606838441c05fcf94dca3`、`src/distributions/multinomial.ts` SHA `5062beb4a7b75d3f2afae82fb732aefee2937b76`、`src/distributions/signrank.ts` SHA `5af960306c0d9ed5a3dd5f65039b42b0298df355`、`src/distributions/wilcox.ts` SHA `9211337d654f8c583d245e6b72b574f58ac8b2bd`。
- **新規Issue #152**: [dmultinom returns NaN when the finite category counts have an overflowing total](https://github.com/numero-uno-jpn/rStats.js/issues/152)。再現 `dmultinom([1e308, 1e308], [0.5, 0.5])` とlog版。N=2e308はbinary64でInfinityになるが、等確率2カテゴリの中心多項確率は中心二項質量で `1/sqrt(pi*1e308) ≈ 5.641895835477564e-155`、logは約 `-355.17046926400775`。実装は総数Nとsuffix countを通常加算し、`dbinomRawDD` の二項試行総数もoverflowするためNaN。決定的入力・中心二項漸近式で確認、runtime未実施。
- Hypergeometricの `m+n` overflow/丸め問題は既存Issue #118に同一の追加overflow再現が明記されているため重複登録しない。#118は `dhyper(5e307, 1e308, 1e308, 1e308, { log: true })` も扱う。phyper/qhyperの `MAX_EXACT=2^53` 制限、binomialLimit近似、tailSumの整数walkを追跡。
- Geometricの `qPow` 大引数分岐（2^64スケーリングとsubnormal pのlog1p近似）、CDFのupper-tail直接計算、quantileのDD log比とjump slackを確認。Signrank/Wilcoxのtable recurrence、rescaling、minTrusted、cache budget、MAX_LEN、MAX_EXACT/support制約を確認。反復/配列長は上限付きで、追加の確定バグは特定できず。
- **新規Issue #152、ソース変更なし。** #118は既知重複。検証はソース静的追跡と中心二項漸近式のみ。Vitest/package runtime/R実行は未実施。


## Audit #646 — Logistic / Laplace / Weibullのclose済みIssue再検証

- 対象: `src/distributions/logistic.ts` SHA `76cd8b85c520932b5980baa16cc3d4ce483eb872`、`src/distributions/laplace.ts` SHA `782524ad81cfd416c0582e8f6b6b31170d3db88f`、`src/distributions/weibull.ts` SHA `f1c3e76bce8a68f936169e4a2e261b13e937b047`。前回予告したCauchyは#555で監査済み、Paretoは#574/#645で監査済み。
- 重要: close済みIssue #109/#110/#111をdefault branchの現行ソースで再確認したところ、いずれも報告された式が残存し、再現条件も成立する。各Issueを**再open**し、現行source SHAと再検証結果を本文末尾へ追記。
  - #109 logistic: `dlogis(6.41493903021196e307,{scale:1.282987806042392e308})`。z=0.5、e=0.6065306597126334。現行式 `e/(scale*(1+e)*(1+e))` は分母overflowで0。log density -710.8935541918609をexpすると1.831690925625393e-309。Python binary64演算で現行式とlog値の差を再確認。
  - #110 Laplace: `dlaplace(7.2357573010898871e307,{sigma:1.4471514602179774e308})`。現行 `(e/sigma)/2` は2.095601864718686e-309。Fractionによるbinary64入力の厳密有理値を一度だけ丸めた値は2.09560186471869e-309。1 subnormal ULP差。
  - #111 Weibull: `shape=2**52`, `scale=shape-0.5`, `x=scale`。現行 `Math.log(shape/scale)-1` は-0.9999999999999998。Decimal 100桁でexact binary64 operandsから評価し、正しい丸めは-0.9999999999999999。
- 各ソースの最終変更commitはIssue作成日より前で、現在の該当コードにも修正は見つからなかった。issue close状態だけでは修正済みと見なさず、現行blobと再現式を必ず照合する必要があることを確認。
- **新規Issueなし。既存Issue #109/#110/#111を再open。** Cauchy/Paretoに新しい問題なし。
- **検証**: source-level path確認、Python binary64 arithmetic、Fraction exact rational、Decimal 100-digit。Vitest/package runtime/Rは未実施。


## Audit #647 — Studentized range (Tukey) upper-tail log overflow

- 対象: `src/distributions/tukey.ts` SHA `d9d8b47fdd9203b21f4bb88f6056314618dee354`、`test/tukey.test.ts` SHA `40920f07133a8b207a4ab35c5465cccb73b2b368`、`test/tukey-quantile.test.ts` SHA `b06c8b7d842bfb3812b5859bd16abbc3c713de61`。
- **新規Issue #153**: [ptukey upper-tail log approximation overflows for huge finite nmeans](https://github.com/numero-uno-jpn/rStats.js/issues/153)。決定的再現 `ptukey(101, 1e200, Infinity, { lowerTail: false, logP: true })`。`validParams` は有限kを受理。q=101では線形upper-tailはrangeCdfC(w>60)で0となりlog fallbackへ進む。w>100の`logRangeCdfC`は `Math.log(k * (k - 1)) + logPhiC(w / sqrt(2))` を計算するが、k=1e200で積がInfinityとなりlog tailが+Infinity。結果として公開ptukeyは上側log確率に正Infinity、linear probabilityにInfinity、lower log tailにNaNを返す経路。正しい漸近log upper tailは `log(k)+log(k-1)+logPhiC(101/sqrt(2))`。mpmath 50桁で約 `-1634.4036442253523511699617027852`（有限・負）を確認。線形確率は0へunderflow、lower tailは1へ丸められる。
- Tukeyのinner/outer integral、log-domain fallback、Chebyshev cache range、df=Infinity limit、small-tail selection、quantileのlog-q Brent inversionを確認。Clenshaw-Curtis pieces、peak search、golden-section、Brent、cache subdivisionは上限付き。既存Issue重複なし。fixture testはRmpfr 160-bit oracleとの比較で、Rのptukey約8桁精度をそのままoracleにしていない。実行は未実施。
- **新規Issue #153、ソース変更なし。** Python mpmathによる漸近log-tail確認とソース制御フロー追跡。Vitest/package runtime/R/本体ptukey実行は未実施。


## Audit #648 — Bivariate normal rectangle probabilities

- 対象: `src/distributions/bvnorm.ts` SHA `64ee087010121cef571a4dc5b227e8430dc4fe11`。Gauss-Legendre rule生成、Sheppard積分（|rho|<0.925）、近完全相関の特異項除去・Taylor remainder、rho=±1の退化分布、無限bound、矩形の反射と4 orthant inclusion-exclusionを確認。
- 既存Issue #119に同一根因の逆向きtail再現を追記: `pbvnorm([1e200, 1e200], [Infinity, Infinity], 0.5)`。期待値0。h=k=1e200で `hk=h*k` と `hs=(h*h+k*k)/2` がともにInfinityとなり、Sheppard integrandの `sn*hk-hs` がInfinity-Infinity=NaN。quadrature sumと最終矩形確率へ伝播。既存#119は `[-1e200,-1e200]` lower-boundで期待値1となる逆方向ケースを報告済み。
- quadrature nodesは固定6/12/20点、Newton root iterationは最大100回。近完全相関の `a=sqrt((1-r)(1+r))` は相関端点を先に分岐し、rho=±1の退化式も確認。追加の独立した確定バグなし。
- **Issue #119へ追加再現をコメント。新規Issueなし。ソース変更なし。** 検証はIEEE-754/source pathと数学的境界の静的追跡のみ。Vitest/package runtime/mvtnorm/Rは未実施。


## Audit #649 — Arcsine / Lognormal / Inverse-gamma / Kumaraswamy / Triangular / Uniform

- 対象: `src/distributions/arcsine.ts` SHA `907b0a4b3b55ca8f4b21325dca7de651fb8f420b`、`lognormal.ts` SHA `2d955d68f6d973a4108450c6b1ae7fa3eb1fc204`、`invgamma.ts` SHA `942dc8bfc3a11295a8f7ac3f8df2decf757dac28`、`kumaraswamy.ts` SHA `ae73aa5f4ac85b344ea32f626854693a50409563`、`triangular.ts` SHA `1cfca6585cf8bad66c282af3b6973fbb8086f288`、`uniform.ts` SHA `62834a501bf92c899d79f98336b2b91a8cda1458`。
- 監査範囲: support/endpointと退化parameter、有限端点間の幅overflow時のhalving、subnormalなtail・density、log-domain式、quantileの反対側tail利用、double-double補正、shape/scaleの極端値、probability境界とlogP変換を確認。
- Arcsine: `b-a` overflow時のhalving、近端tailの `sqrt(d/w)`、qbetaへの対称反転を確認。Lognormal: `zOf` の巨大sdlog scaling、`halfSquare` の巨大z、tail erfcx、quantileのNewton補正と巨大指数のexp境界を確認。Inverse-gamma: beta/x subnormal時のgamma upper-tailへの変換、alpha→Infinity limit、density Jacobian、tiny gamma quantile逆変換を確認。Kumaraswamy: `x^a` underflow、`1-x^a` cancellation、a/b極小・巨大時のdensity/CDF/quantile分岐を確認。Triangular: endpoint/mode、width overflow、ratio-based tails、subnormal log tail、quantileの両側式を確認。Uniform: width overflow時のhalving、両側直接比、log probability、degenerate/invalid supportを確認。
- 既存open Issue #120（lognormal distSummaryのtiny sdlogによるvariance underflow）はdistribution本体ではなくsummary moment計算の問題で、重複なし。#119のbivariate normal逆向きtail追加再現はAudit #648でコメント済み。
- 検討した決定的境界値: `darcsine(0, { a: -1e308, b: 1e308 })`、`parcsine(-1e308, { a: -1e308, b: 1e308, lowerTail: false, logP: true })`、`qlnorm(-1000, { logP: true, sdlog: 1e300 })`、`dinvgamma(1e308, 1e-300, { beta: 1e-300, log: true })`、`pkumar(0.2, 1e-300, 1e308, { logP: true })`、`qkumar(-1000, 1e-300, 1e308, { logP: true })`、`dtriang(3.1e-190, { a: 0, b: 1.24e133, c: 5.58e132, log: true })`、`qunif(0.5, { min: -1e308, max: 1e308 })`。これは式と分岐の静的検討用入力で、実行結果ではない。
- **新規確定バグなし。Issue追加なし。ソース変更なし。**
- **検証制限**: GitHubソースと既存Issueの静的追跡のみ。Vitest/package runtime/R/extraDistrは未実施。


## Audit #650 — Descriptive summaries, moments, ranks, quantiles and shared accumulators

- 対象: `src/descriptive/basic.ts` SHA `e12c8f8c91152f8d617cd05bf07ce512ef00856a`、`moments.ts` SHA `740c02eaceadd6f1454ecd7564bcd6f09f563b5b`、`cov.ts` SHA `5f3a3fb7563fef50743ad1edc519d6b802c258fb`、`quantile.ts` SHA `7fe14be52f404d0565fc5ec0cd4d953d155c2b6a`、`missing.ts` SHA `b8f76310ab34fa96c85876f0d5c6e7e0795950f8`、`rank.ts` SHA `316d4778675095a5b4eb9da60846c375ddad79cb`、`src/internal/summary.ts` SHA `e4fc3bd652af3a00cf05b44389ddf58e590c4830`。
- 監査範囲: sum/prod/mean/trimmed mean/weighted mean/variance/sd/median/range/cumsum/cumprod/cummin/cummax/diff、skewness/kurtosisのtype 1–3補正、geometric mean/modes/meanAD/cv/scale、Pearson/Spearman/Kendall cov/corとuse別NA行選択、quantile type 1–9、fivenum/mad、completeCases/naOmit、rank tie/NA policy、WideSum/meanDD/centered/crossSum/groupMoments/pairedDifferences/satterthwaiteDf/squareOver/productOver/norm2を確認。
- 決定的境界入力として `weightedMean([1e308, -1e308], [1, 1])`、`weightedMean([1e308, 1e308], [1, -1])`、`scale([[-1e308], [1e308]])`、`quantile([-Infinity, Infinity], [0, 0.5, 1])`、`mad([-1e308, 1e308], { center: 0 })`、`rank([Infinity, Infinity, -Infinity, -Infinity])`、`cov([[1, NaN], [2, 3]], { use: "na.or.complete" })`、`diff([Number.MAX_VALUE, -Number.MAX_VALUE])` を静的に検討。実行結果ではない。
- Issue #120（lognormal distSummaryのtiny sdlogによるvariance underflow）はdistribution summaryの別問題として確認。現監査対象の記述統計コードとの重複はない。各種配列の空/単一要素、定数列、NaN、±Infinity、符号付きゼロ、n=2/3/4補正境界も確認。
- `weightedMean` は有限入力の積/和overflow後にscaled retryし、zero weightsはnumeratorから除外。`meanDD` はoverflow sumをpower-of-two scale後に平均。quantileの9種のindex formulaは整数位置fuzzとequal-infinity neighborを扱う。cov/corはpairwise missing rowsとSpearman再rankを別処理。追加の確定バグは特定できず。
- **新規確定バグなし。Issue追加なし。ソース変更なし。**
- **検証制限**: GitHubソースの静的追跡のみ。Vitest/package runtime/Rとの実値照合は未実施。


## Audit #651 — Hypothesis tests, effect sizes and p-value adjustments

- 対象: `src/htest/effectSize.ts` SHA `2f1b77d5012396b88d1c36365045bf3c7b314e1d`、`cor.ts` SHA `4ed4868b5441752c2b4581e85d2e9b2c0b015101`、`tTest.ts` SHA `0442511bfdd24bede27433c5e32d520d2f073d83`、`pAdjust.ts` SHA `4469db93ce6c2d245832708b8b375080fc041843`。
- **新規Issue #154**: [pAdjust BY overflows q*n before multiplying by tiny p-values](https://github.com/numero-uno-jpn/rStats.js/issues/154)。決定的再現 `pAdjust([Number.MIN_VALUE], { method: "BY", n: 1e306 })`。BYの調整式は `min(1, H_n*n*p))。harmonic asymptoticは `H_n≈705.1682541210796`。現行演算順 `((q*n)/i)*p[j]` はq*nがInfinityになるが、同じ積を `q*(n*p)` の順で計算すれば約 `3.4839940889907547e-15`。有限で表現可能な調整済みp値を1と誤る。乱数なし。IEEE-754の決定的な中間overflow。
- pAdjustのHolm/Hochberg/BH/BY/Bonferroni/none/Hommel、NaN除外、n>observed count、harmonic sumのlarge-n漸近、Hommel O(n²)のループ境界を確認。今回のBY積順序以外に確定バグなし。
- tTestのone/two/paired、Welch/pooled、dfとSE、CI tail選択、mu scaling、formula row selectionを確認。effectSizeのCohen's d/Hedges g、J correction、noncentral-t CI、ANOVA eta/omega/epsilon squaredのSS normalization、F inversion、strata model mappingを確認。corのPearson/Spearman/Kendall、tie correction、exact/approximation branch、small-n conditionsを確認。既知のKendall n=2 exact:false Issueを重複回避。
- **新規Issue #154、ソース変更なし。** 検証はソース追跡とIEEE-754 arithmeticのみ。Vitest/package runtime/R実行は未実施。


## Audit #652 — Power calculations (power.* / pwr.*)

- 対象: `src/htest/power.ts` SHA `5950a5e498272e8ae0b5a581e849477eb287c349`、`src/htest/pwr.ts` SHA `a9f7c6f320272cfb00ed2704084507bc16861367`、`test/pwr.test.ts` SHA `5f3eb608f9a928dd8954d2d0d134469ed3fd7dd4`、`test/powerStats.test.ts` SHA `4c16fb0818a7b41e327794a179d2dae61c710260`。
- **新規Issue #155**: [pwr2p2nTest overflows n1*n2 when computing effective sample size](https://github.com/numero-uno-jpn/rStats.js/issues/155)。再現 `pwr2p2nTest({ n1: 1e200, n2: 1e200, h: 1e-100 })`。現行のeffective n式 `(n1*n2)/(n1+n2)` は積がInfinityになり、normal shiftもInfinity、power=1へ。真のeffective nは `5e199`、shiftは `0.7071067811865476`。two-sided alpha=.05の正規近似powerは約 `0.10895461755061553`。各入力は有限で現行validationを通る。乱数なし、実行未実施。
- power.t.test / power.prop.test / power.anova.test と pwr.t/t2n/2p/2p2n/p/norm/r/chisq/anova/f2、Cohen effect-size helpersを確認。特にtwo-sided/one-sidedの符号、strict two-sided追加tail、unknown quantity root interval、df/ncp式、p1/p2境界、r=±1、chisq df、ANOVA lambdaのoverflow fallbackを追跡。今回以外の独立した確定バグは未確認。
- 多重比較側のGames-Howell/Tukey/Dunn/Steel/Dunnettのグループ数・df・tail/adjustment経路も確認。Steelは対象パッケージの既知エラー挙動を再現する設計。Issue #154のBY積overflowとは別問題。
- **新規Issue #155、ソース変更なし。** 期待powerは式からの決定的計算。Vitest/package runtime/R実行は未実施。


## Audit #653 — GLM family/link functions and IRLS-facing numerical contracts

- 対象: `src/models/glmFamily.ts` SHA `c6d8d8b8c47dda7ed96bef3043d90abb7c637bb5`、`src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331`、`test/glm.test.ts` SHA `63aaa9ade1f6d9239ccf4c8f625978db208385fa`。
- **新規Issue #156**: [power-link muEta returns NaN when reciprocal exponent overflows](https://github.com/numero-uno-jpn/rStats.js/issues/156)。再現 `makeFamily({ family: "quasi", link: { power: Number.MIN_VALUE } }).muEta(0.5)`。lambdaは有限正数として受理されるが、`1/lambda` がInfinity、`0.5**Infinity` が0、積がInfinity*0=NaNとなる。導関数はbinary64で表現できないほど小さい正値なので、power linkの他のlink derivative同様の正値floor `Number.MIN_VALUE` が期待される。静的IEEE-754追跡。
- Named linksのdomain、inverse/1-mu²のsingularity、logit/probit/cauchit/cloglogの端点clamp、sqrt、power(lambda)、quasi variance/deviance、binomial two-column response、zero prior weights、starting means、AICを確認。GLM IRLSのworking weights/residuals、deviance, step halving, boundary/convergence state、profile CIとanova経路も部分確認。
- 二列binomialで `size=s+f` がoverflowする極端な有限カウント、prior*sizeのoverflow、quasi devianceのlog domain等を境界検討。別個の公開入力で期待値が確定する追加バグは現時点で特定せず。
- **新規Issue #156、ソース変更なし。** Vitest/package runtime/R実行は未実施。


## Audit #654 — Noncentral chi-square density, CDF and quantile extreme-scale paths

- 対象: `src/distributions/nchisq.ts` SHA `9549791940c425d508057b7286329b396ca36c6f`、`src/internal/poissonMixture.ts`（現行実装の混合和・開始index・反復制御）。
- **新規Issue #157**: [qchisq noncentral quantile fails when finite df + ncp overflows](https://github.com/numero-uno-jpn/rStats.js/issues/157)。決定的再現 `qchisq(0.5, 1e308, { ncp: 1e308 })`。df/ncpはいずれも有限・非負でvalidationを通るが、Patnaik初期値の `df + 2*ncp` と `df+ncp` がoverflowし、`c`/ `nu` がNaN。fallbackの `x0=df+ncp` とbracketの `hi` はInfinityとなる。内部predicateは公開 `pnchisq1` のInfinity endpoint処理を通らず `pnchisqBoth(Infinity,...)` からDebye積分へ進み、非有限中間値となる。分布平均は2e308、標準偏差は約2.45e154で、中央値は有限double上限を約4e153標準偏差超えるため、返すべきquantileはInfinity。ソース制御フローとモーメント式の静的確認。
- 既存Issue #147（df=0 densityのsubnormal scaling exponent誤り）と#150（巨大Poisson indexでCDF lower sumが停止しない）を再確認。#64は#150と同じ根因の既存報告。重複登録なし。#147のCDF側subnormalHalfも点質量を含むためdensityとは異なる漸近構造だが、今回の静的確認でdouble上の独立再現可能な誤差は確定できず、Issue追加せず。
- `gammaKernel` のsmall/huge-y ratio scaling、tiny-shape gamma increment、Poisson mixture density peak、Bessel Hankel/Debye切替、double-double root差、subnormal-half変換、Chernoff tail bound、quantileのnarrow-spread/double-searchを追跡。sumLowerの巨大index進行不能は既知#150。sumUpperのMAX_TERMS上限とpeak restartも確認。新規の独立確定バグは#157以外に特定せず。
- **新規Issue #157、ソース変更なし。** Vitest/package runtime/R比較は未実施。数値根拠はIEEE-754 overflow条件と非心カイ二乗の平均・分散式による決定的導出。


## Audit #655 — Noncentral beta / noncentral F transformations and extreme-tail paths

- 対象: `src/distributions/nbeta.ts` SHA `5c51760f6e136b80a77b4284da39c25b0ab8ed86`。非心betaのPoisson mixture、left-tail log series、extreme-parameter method selection、gamma/w expansions、integral tails、density、quantile、非心Fの `fPair`/`fOdds`/Chernoff bound/quantile経路を確認。
- **新規Issue #158**: [pnf1 fPair loses the beta transform when large m*q is comparable to n](https://github.com/numero-uno-jpn/rStats.js/issues/158)。決定的再現 `pf(1e200, 1e100, 1e300, { ncp: 1e300 })`。m*q=n=1e300で、正しいbeta変換はx=1/2、1-x=1/2。ところが `fPair()` の `mq >= 1e290` fallbackは `zc=n/m/q` をそのまま1-xとして返し、x=0、1-x=1を生成する。fallbackは `mq >> n` を保証しないため、非心Fの分布中心付近の入力でも変換が壊れる。平均・分散から、分子χ²(m,λ)と分母χ²(n)はともに相対変動約2e-150/1.4e-150で、q=λ/m=1e200の下側確率は約0.5。ソース制御フローと変換式の静的確認。Vitest/runtime/R未実施。
- 既存Issue #63（正のsubnormal ncp/2が0になるleftTailLogのNaN）、#96（dnbeta endpoint log densityのa+mu overflow）、#114（subnormal shapeでj=0密度成分を落とす）を確認し、#158とは根因が異なる。非心F側の `dnfCore`/`pnfTiny` の比率対数問題は既存Issue #135と重複するため新規登録しない。
- 非心betaのshape端点・a/b極小/巨大、`mu*rho` とshape sum overflow、`Math.log(s/b)` の比率形成、density peak・Poisson mixture、F変換のunderflow/overflow、Chernoff gridとqF quantileの有限端点判定を確認。独立した確定バグは#158以外に追加特定せず。
- **新規Issue #158、ソース変更なし。** `docs/audit-ledger.md` 追記。Vitest/package runtime/R/高精度数値照合は未実施。


## Audit #656 — GLM power-link derivative and Gamma inverse-link IRLS scaling

- 対象: `src/models/glmFamily.ts` SHA `c6d8d8b8c47dda7ed96bef3043d90abb7c637bb5`、`src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331`。
- 既存Issue **#156**へ追加再現をコメント: `makeFamily({ family: "quasi", link: { power: Number.MAX_VALUE } }).muEta(Number.MIN_VALUE)`。現行式では `inv=1/Number.MAX_VALUE≈5.562684646268003e-309`、`inv-1` は-1へ丸められ、`Number.MIN_VALUE ** -1` がInfinityへoverflowして結果Infinity。解析的な導関数 `inv * eta ** (inv-1) ≈ inv/eta` は約1.125899906842624e15で有限。元の#156は逆にlambda=Number.MIN_VALUEでinvがInfinityとなりNaNを生じるため、両端の異なる中間値overflowとして同Issueに追記。Issue comment ID 6580163912。
- **新規Issue #159**: [Gamma GLM inverse-link IRLS weight becomes NaN for large finite means](https://github.com/numero-uno-jpn/rStats.js/issues/159)。決定的再現 `glm([[], []], [1e308, 1e308], { family: "Gamma" })`。intercept-only、正の有限response、default inverse link。初期 `eta=1e-308`、`mu=1e308`。inverse linkの `muEta=-1/(eta*eta)` はeta² underflowで-Infinity、Gamma variance `mu²` はInfinity。IRLSの `sqrt((w*muEta²)/variance)` はInfinity/InfinityでNaN。一方、式を整理すれば `sqrt(w*mu^4/mu²)=mu*sqrt(w)=1e308` で有限。working response×sqrt weightも1となり、定数応答の正確なfitはmean 1e308、deviance 0。IEEE-754演算順序と解析式で確認。Vitest/package runtime/R未実施。
- IRLSのstarting mean、offset、zero prior weights、deviance step halving、separation判定、QR rank/alias、null deviance、AIC、dispersion、summary covariance、residuals、hatvalues、Cook's distance、prediction SEのコード経路を追加確認。今回以外の独立確定バグは追加特定せず。#159はfamily/link-specific weight ratioを共通IRLSで直接形成する数値不安定性で、#156のpower-link単体導関数とは別根因。
- **新規Issue #159、既存Issue #156へ追加再現。ソース変更なし。** docs/audit-ledger.md追記。GitHubソース静的追跡・IEEE-754演算解析のみ。Vitest/package runtime/R照合未実施。


## Audit #657 — GLM zero-column IRLS branch and extreme finite Gamma means

- 対象: `src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331`、`src/models/glmFamily.ts` SHA `c6d8d8b8c47dda7ed96bef3043d90abb7c637bb5`。Audit #656で確認したIRLS通常経路に加え、`irls()` の `p === 0`（説明変数なし・offsetのみ）専用経路を追跡。
- 既存Issue **#159**へ追加再現をコメント: `glm([[]], [1e308], { family: "Gamma", intercept: false, offset: [1e-308] })`。Gamma既定inverse linkで `eta=1e-308`、`mu=y=1e308`。`muEta=-1/(eta*eta)=-Infinity`、`variance(mu)=mu*mu=Infinity`。p=0分岐の `sqrt((w*me**2)/variance)**2` はNaNを返すが、代数的に整理した平方根working weightは `sqrt(w)/eta=1e308`（有限）、その二乗working weightはInfinity（NaNではない）。適合平均は応答と一致しdeviance=0。通常のQR経路とは別の分岐でも同一の不安定な比率式が使われるため、#159に集約し新規Issueは作成しない。
- 重複確認: "empty model" + Gamma working weights、Gamma offset + NaN、working weights + Gamma overflowのIssue検索で該当なし。#159が根因を包含するため追記コメントのみ。
- GLMの入力前処理、二列binomial responseのsize/比例値/初期平均、p=0分岐、通常IRLS、null deviance、AIC、summary/diagnosticの主要呼び出し経路を再確認。有限の二列カウント合計がbinary64上限を超える場合は内部size/weightがInfinity化する境界を確認したが、有限表現不能な総試行数に対する期待API契約・スケーリング方針が未確定のため、独立バグとして登録しない。
- **既存Issue #159へ追加再現、ソース変更なし。** ソース静的追跡とIEEE-754演算解析のみ。Vitest/package runtime/R照合未実施。


## Audit #658 — Two-column binomial GLM count-total overflow

- 対象: `src/models/glmFamily.ts` SHA `c6d8d8b8c47dda7ed96bef3043d90abb7c637bb5` の `prepareResponse()`、呼び出し元 `src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331`。
- 決定的再現: `glm([0, 1], [[1e308, 1e308], [1e308, 1e308]], { family: "binomial" })`。乱数なし。各成功数・失敗数は有限・非負で、各観測の成功率は厳密に0.5。
- 根因: `prepareResponse()` が `size = success + failure` を直接計算しInfinityにする。続く `yy = success / size` は0、`weights = prior * size` はInfinity、`mustart = (size * yy + 0.5) / (size + 1)` は `Infinity * 0` によりNaN。IRLSは有効な開始値を得られずfitを開始できない。少なくとも成功率と初期平均は0.5を維持すべき。総試行数がbinary64で表現できない場合の尤度重みのスケーリングまたは明示的な範囲エラーは別途設計が必要だが、比率自体を0に壊すのは誤り。
- 既存Issue検索: "two-column binomial glm overflow"、"prepareResponse binomial counts"、"binomial GLM size overflow"で重複なし。#152はmultinomial密度の総カウントoverflowであり、GLM初期化のこの不具合とは別。
- **新規Issueを登録。** ソース変更なし。ソース静的追跡とIEEE-754演算解析のみ。Vitest/package runtime/R照合未実施。


## Audit #659 — Binomial deviance cancellation near a perfect fit

- 対象: `src/models/glmFamily.ts` SHA `c6d8d8b8c47dda7ed96bef3043d90abb7c637bb5` の `binomialDev()`。binomialのdeviance・残差・IRLS deviance比較で使われる二項逸脱度寄与を確認。
- 決定的再現: `makeFamily("binomial").devContribution(0.5, 0.5 + 2 ** -52, 1)`。乱数なし。観測比率と予測確率は隣接するbinary64近傍。
- 現行式 `2*w*(y*log(y/mu)+(1-y)*log((1-y)/(1-mu)))` は、ほぼ等大反対符号の二項を直接加算するため、真の小さな正の逸脱度が丸め誤差に埋もれ、約 `-1.9721522630525295e-31` の負値を返す。y=1/2、mu=1/2+dの正確な式は `-log(4*mu*(1-mu)) = -log(1-4*d*d) ≈ 4*d*d`。d=2^-52で期待値は約 `+1.9721522630525295e-31`。
- 負の寄与はtotal devianceとIRLSのdeviance比較を汚染する。deviance residual側では負値を0にclampするため、診断出力では問題が隠れる。相殺に強いbd0型計算式が必要。
- 既存Issue検索: "binomial deviance cancellation close probabilities"、"binomialDev negative deviance"、"glm deviance precision close y mu"で重複なし。
- **新規Issueを登録。ソース変更なし。** 静的ソース追跡とbinary64数値解析のみ。Vitest/package runtime/R照合未実施。


## Audit #660 — Poisson deviance cancellation near a perfect fit

- 対象: `src/models/glmFamily.ts` SHA `c6d8d8b8c47dda7ed96bef3043d90abb7c637bb5` のPoisson/quasipoisson deviance、およびquasi variance `"mu"` の同型式。
- **新規Issue #162**: [Poisson deviance becomes negative near an exact fit because of cancellation](https://github.com/numero-uno-jpn/rStats.js/issues/162)。
- 決定的再現: `makeFamily("poisson").devContribution(1, 1 + 2 ** -52, 1)`。現行式 `2*(y*log(y/mu)-(y-mu))` は一次項同士の相殺で約 `-9.860761315262648e-32` を返す。一方、正確な式 `2*(d-log1p(d))`（d=2^-52）は約 `+4.930380657631323e-32`。逸脱度が負となり、総devianceとIRLSのdeviance比較を破壊する。quasi variance `"mu"` にも同根因がある。
- 既存Issue検索: Poisson deviance cancellation / small difference / near perfect fitで重複なし。
- **新規Issue #162登録。** ソース変更なし。IEEE-754決定的演算の静的解析のみ。Vitest/package runtime/R照合未実施。


## Audit #661 — Gamma deviance cancellation near a perfect fit

- 対象: `src/models/glmFamily.ts` SHA `c6d8d8b8c47dda7ed96bef3043d90abb7c637bb5` のGamma devianceとquasi variance `"mu^2"`。
- **新規Issue #163**: [Gamma deviance loses relative accuracy near a perfect fit](https://github.com/numero-uno-jpn/rStats.js/issues/163)。
- 決定的再現: `makeFamily("Gamma").devContribution(1, 1 + 2 ** -52, 1)`。現行式 `-2*(log(y/mu)-(y-mu)/mu)` は約 `1.9721522630525295e-31`。正確な式 `2*(log1p(d)-d/(1+d))` は約 `4.930380657631322e-32`。小さな逸脱度の相対誤差が大きく、quasi `"mu^2"` でも同じ相殺式が使われる。
- 既存Issue検索: Gamma deviance cancellation / close mean / small differenceで重複なし。
- **新規Issue #163登録。** ソース変更なし。IEEE-754決定的演算の静的解析のみ。Vitest/package runtime/R照合未実施。


## Audit #662 — Inverse-Gaussian deviance overflow

- 対象: `src/models/glmFamily.ts` SHA `c6d8d8b8c47dda7ed96bef3043d90abb7c637bb5` の `inverseGaussianDev()`。inverse.gaussianおよびquasi variance `"mu^3"` で共有。
- **新規Issue #164**: [Inverse-Gaussian deviance overflows for a finite, representable result](https://github.com/numero-uno-jpn/rStats.js/issues/164)。
- 決定的再現: `makeFamily("inverse.gaussian").devContribution(1e-308, 1e308, 1)`。y, muは有限正数。現行の `(y-mu)**2` はInfinityにoverflowするが、分母 `y*mu*mu` は左から評価すると約 `1e308`。解析的な比は約 `1e308` で有限。大きな差を先に二乗する演算順序が原因。
- 既存Issue検索: inverse Gaussian deviance overflow / numerical stabilityで重複なし。
- **新規Issue #164登録。** ソース変更なし。静的なIEEE-754範囲解析のみ。Vitest/package runtime/R照合未実施。


## Audit #663 — Inverse-Gaussian working-weight overflow at large finite means

- 対象: `src/models/glmFamily.ts` のinverse-Gaussian `variance(mu)=mu^3`、`src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331` の `irls()` p=0経路と通常IRLS。
- **新規Issue #165**: [Inverse-Gaussian GLM working weight becomes NaN when a finite large mean overflows V(mu)](https://github.com/numero-uno-jpn/rStats.js/issues/165)。
- 決定的再現: `glm([[]], [1e200], { family: "inverse.gaussian", link: "log", intercept: false, offset: [Math.log(1e200)] })`。有限の正応答・offsetでmu≈1e200、devianceは0。log linkでは導関数mu、数学的working weightは `mu^2/mu^3=1/mu≈1e-200`。しかしmu³とmu²の中間値がInfinityとなり、p=0分岐でInfinity/Infinity→NaN。通常IRLSにも同じ比率形成がある。
- 既存Issue検索: inverse Gaussian variance overflow / working weight large meanで重複なし。
- **新規Issue #165登録。** ソース変更なし。静的な式・IEEE-754範囲解析のみ。Vitest/package runtime/R照合未実施。


## Audit #664 — Inverse-Gaussian working-weight underflow at small finite means

- 対象: `src/models/glmFamily.ts` のinverse-Gaussian `variance(mu)=mu^3`、`src/models/glm.ts` のIRLS variance validation。
- **新規Issue #166**: [Inverse-Gaussian GLM rejects small finite means when V(mu) underflows](https://github.com/numero-uno-jpn/rStats.js/issues/166)。
- 決定的再現: `glm([[0], [1]], [1e-200, 1e-200], { family: "inverse.gaussian", link: "log" })`。初期muは有限正数1e-200、etaも有限。mu³はbinary64で0へunderflowするためIRLSが `"0s in V(mu)"` をthrowする。一方、log linkのworking weightは `mu²/mu³=1/mu=1e200` で有限。分散そのものをbinary64で表現できないこととworking weightが計算不能であることを混同している。
- 既存Issue検索: inverse Gaussian small mean / variance underflowで重複なし。
- **新規Issue #166登録。** ソース変更なし。静的な式・IEEE-754範囲解析のみ。Vitest/package runtime/R照合未実施。


## Audit #665 — Poisson working-weight underflow at subnormal means

- 対象: `src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331` の `irls()` p=0 working-weight式。Poisson familyの `variance(mu)=mu` とlog-link derivative `mu` を追跡。
- **新規Issue #167**: [Poisson GLM loses a representable subnormal working weight for tiny means](https://github.com/numero-uno-jpn/rStats.js/issues/167)。
- 決定的再現: `glm([[]], [0], { family: "poisson", intercept: false, offset: [Math.log(1e-320)] })`。mu≈1e-320は正のsubnormalで、数学的working weight `mu²/mu=mu` も約1e-320として表現可能。現行式はmu²を先に計算して0へunderflowさせ、その後0/mu=0を返す。正しいworking weightをゼロに失う。
- 既存Issue検索: Poisson tiny mean / subnormal working weightで重複なし。
- **新規Issue #167登録。** ソース変更なし。静的な式・IEEE-754範囲解析のみ。Vitest/package runtime/R照合未実施。


## Audit #666 — Poisson null-deviance weighted-mean overflow

- 対象: `src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331` のintercept付きnull deviance算出。
- **新規Issue #168**: [Poisson null deviance becomes NaN when the finite weighted mean sum overflows](https://github.com/numero-uno-jpn/rStats.js/issues/168)。
- 決定的再現: `glm([[], []], [1e308, 1e308], { family: "poisson" })`。各responseは有限かつ同一で、full fitの平均は1e308、devianceは0となるべき。null mean計算は重みをpower-of-twoでscaleするが、`swy += wi * yy[i]` のresponse側はscaleしないためswyがInfinity、mもInfinityとなる。Poisson devianceにInfinity/Infinity相当の不定演算が入りnullDevianceがNaNとなる。
- 既存Issue検索: GLM null deviance / weighted mean / overflowで重複なし。
- **新規Issue #168登録。** ソース変更なし。静的な制御フローとIEEE-754範囲解析のみ。Vitest/package runtime/R照合未実施。


## Audit #667 — Cook's distance intermediate-square overflow

- 対象: `src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331` の `glmCooksDistance()`。
- **新規Issue #169**: [glmCooksDistance overflows an intermediate square although Cook's distance is finite](https://github.com/numero-uno-jpn/rStats.js/issues/169)。
- 決定的再現データ: `glm([[], []], [0, 1e308], { family: "poisson" })` に対し `glmCooksDistance(fit, { dispersion: 1e308 })`。intercept-only Poisson fitの平均は約5e307、各hat valueは約0.5、Pearson residual絶対値は約7.07e153。Cook式の数学的値は約1だが、実装は先に `(v/(1-h))**2` を計算し、約2e308へoverflow。その後の小さい因子との積はInfinityとなり、最終的にNaNへ変換される。因子の順序またはスケーリングが必要。
- 既存Issue検索: Cook distance overflow / finite dispersionで重複なし。
- **新規Issue #169登録。** ソース変更なし。式の静的追跡とIEEE-754範囲解析のみ。GLM runtime/Vitest/R照合未実施。


## Audit #668 — Deviance residuals for zero residual degrees of freedom

- 対象: `src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331` の `residualsOf()` と `oracle/glm-behaviour.md` のResiduals仕様。
- **新規Issue #170**: [Deviance residuals should be zero when residual degrees of freedom are zero](https://github.com/numero-uno-jpn/rStats.js/issues/170)。
- 決定的再現: `glm([0, 1], [1, 10], { family: "poisson", maxit: 1 })`。2観測・2列（interceptとpredictor）でrank=2、dfResidual=0。初期平均y+0.1からの1回のIRLS更新後、平均は約1.0044107879と10.0004934197で、devianceは正。現行 `residualsOf(fit,"deviance")` は行ごとの逸脱度平方根を返す（第1行は約-0.0044043）。一方、リポジトリのR互換仕様はdf.residual=0なら未収束fitも含め全deviance residualsを0と明記している。
- 既存Issue検索: saturated GLM / df.residual zero / deviance residualsで重複なし。
- **新規Issue #170登録。** ソース変更なし。仕様と実装の静的比較、決定的IRLS式の解析のみ。Vitest/package runtime/R照合未実施。


## Audit #669 — Supplied dispersion incorrectly changes GLM coefficient tests to z tests

- 対象: `src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331` の `glmSummary()`、`oracle/glm-behaviour.md` のsummary.glm仕様。
- **新規Issue #171**: [glmSummary uses normal z tests for supplied dispersion in non-fixed-dispersion families](https://github.com/numero-uno-jpn/rStats.js/issues/171)。
- 決定的再現: `const fit = glm([0,1,2,3], [1,2,3,4], { family: "Gamma", link: "log" }); glmSummary(fit, { dispersion: 1 })`。現行コードは `estimated = options.dispersion === undefined && !fam.fixedDispersion`、続いて `zTest = !estimated` とするため、dispersionを指定したGamma fitをz検定に切り替え、`pnorm` と `"z value"` を返す。リポジトリ仕様ではbinomial/Poisson以外はdfResidual自由度のStudent t検定（`pt`）であり、dispersion引数は標準誤差の分散値を置き換えるだけで参照分布を変更しない。
- 既存Issue検索: glmSummary dispersion argument / t statistic / z statisticで重複なし。
- **新規Issue #171登録。** ソース変更なし。実装とリポジトリ内仕様の静的比較のみ。Vitest/package runtime/R照合未実施。


## Audit #670 — Gamma IRLS small-mean variance underflow (additional reproduction)

- 対象: `src/models/glmFamily.ts` のGamma `variance(mu)=mu^2`、`src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331` の通常IRLS variance validation/working-weight式。
- 既存Issue **#159**へ追加コメント: `glm([[0], [1]], [1e-200, 1e-200], { family: "Gamma", link: "log" })`。有限正responseと有限starting eta/muだが、`mu*mu` が0へunderflowしIRLSが `"0s in V(mu)"` をthrowする。一方log linkの導関数もmuなので、working weight `w*mu^2/mu^2` は厳密にw=1で有限。#159の大平均側overflow再現に対し、小平均側underflow再現を同じGamma working-weight安定性Issueに追加した。Comment ID 6581620399。
- **既存Issue #159へ追加再現。新規Issueは作成せず。** ソース変更なし。静的ソース追跡とIEEE-754範囲解析のみ。Vitest/package runtime/R照合未実施。


## Audit #671 — scoreStatistic residual-square scaling
- 対象: `src/models/glmConfint.ts` SHA `fc79e536f9b642a2ae860c813f0fcf45ebbdca14`。
- Issue [#172](https://github.com/numero-uno-jpn/rStats.js/issues/172)。再現: `scoreStatistic([[0],[0]],[1e200,-1e200],[1e-200,1e-200],false)`。期待値0、重み付き平方和2e200。実装はr²を先に計算してInfinityとなり、sqrt(weight)でscaleするQR残差側との不整合で統計量がInfinity。静的IEEE-754解析のみ。


## Audit #672 — scoreStatistic weighted-center overflow
- 対象: `src/models/glmConfint.ts` SHA `fc79e536f9b642a2ae860c813f0fcf45ebbdca14`。
- Issue [#173](https://github.com/numero-uno-jpn/rStats.js/issues/173)。再現: `scoreStatistic([[1],[1]],[1,1],[1e308,1e308],true)`。定数残差をinterceptに回帰するscoreは0だが、sw/swrの直接加算がInfinityとなりcentreがNaN。静的IEEE-754解析のみ。


## Audit #673 — glmPredict dot-product cancellation
- 対象: `src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331`。
- Issue [#174](https://github.com/numero-uno-jpn/rStats.js/issues/174)。再現: `glm([[1,0],[0,1],[1,1]],[2,-2,0],{family:"gaussian"})` の後 `glmPredict(fit,{newdata:[[1e308,1e308]]})`。係数(0,2,-2)の正確なdot productは0だが、個別積が+Infinity/-InfinityとなりNaN。静的解析のみ。


## Audit #674 — glmPredict standard-error norm scaling
- 対象: `src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331`。
- Issue [#175](https://github.com/numero-uno-jpn/rStats.js/issues/175)。再現: `glm([[0,0],[1,0],[0,1],[1,1]],[0,1,1,2],{family:"gaussian"})` の後 `glmPredict(fit,{newdata:[[1e308,1e308]],dispersion:1e-300})`。R^-T xのnormは未scaleでoverflowするが、sqrt(dispersion)を掛けた最終SEは約1e158で有限。実装fallbackはdispersionを掛ける前にnormをoverflow。静的解析のみ。


## Audit #675 — Gamma dispersion accumulator overflow
- 対象: `src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331`。
- Issue [#176](https://github.com/numero-uno-jpn/rStats.js/issues/176)。再現: `y=Array(99).fill(1e-6).concat([5000])`、100行の空x、Gamma/log、weights全て2e304、start `[Math.log(50.00000099)])。working residual平方和×weightは約1.98e308だが、dfResidual=99で割ったdispersionは約2e306で有限。dispersionOfは合計後に除算するためInfinity。静的IRLS/IEEE-754解析のみ。


## Audit #676 — Gaussian AIC zero-weight contract
- 対象: `src/models/glmFamily.ts` SHA `c6d8d8b8c47dda7ed96bef3043d90abb7c637bb5`、oracle SHA `ce89d80649fd61cfc6100484757e8d8d67e60db7`。
- Issue [#177](https://github.com/numero-uno-jpn/rStats.js/issues/177)。再現: `glm([[],[],[]],[1,2,100],{family:"gaussian",weights:[1,1,0]})`。oracleはGaussian AICで全行のlog(weight)を含め、zero weightなら+Infinityと規定。実装はzero weightをskipして有限値を返す。静的ソース/oracle比較のみ。


## Audit #677 — glmAnova reduced-model start mismatch
- 対象: `src/models/glmAnova.ts` SHA `f84fe8f7b86b86c5a696da60157dc8b15c3caf22`、`src/models/glm.ts` SHA `852ea8204a73cfc10a2807017f7a4f116e71f331`。
- Issue [#178](https://github.com/numero-uno-jpn/rStats.js/issues/178)。再現: `glm([[0,0],[1,0],[0,1],[1,1]],[1,2,3,4],{family:"poisson",start:[0,0,0]})` の後 `glmAnova(fit)`。2項のsequential ANOVAで2列のreduced modelをrefitする際、rowOfが元の3係数startをそのまま渡し、IRLSのstart長validationで失敗。静的制御フロー解析のみ。


## Audit #678 — glmConfint tiny confidence level
- 対象: `src/models/glmConfint.ts` SHA `fc79e536f9b642a2ae860c813f0fcf45ebbdca14`。
- Issue [#179](https://github.com/numero-uno-jpn/rStats.js/issues/179)。再現: `glm([[],[],[],[]],[0,1,0,1],{family:"binomial"})` の後 `glmConfint(fit,{level:1e-20})`。1-levelが1へ丸められa2=0.5、qnorm cutoffが0となり、非zeroの極小CIをestimateへcollapse。静的binary64解析のみ。


## Audit #679 — glmAnova Cp zero-rank intermediate overflow
- 対象: `src/models/glmAnova.ts` SHA `f84fe8f7b86b86c5a696da60157dc8b15c3caf22`。
- Issue [#188](https://github.com/numero-uno-jpn/rStats.js/issues/188)。再現: `glm([[]],[1e154],{family:"gaussian",link:"log",intercept:false})` の後 `glmAnova(fit,{test:"Cp"})`。n=1、dfResidual=1、rank=0、dispersion約1e308。Cp penaltyは0だが、実装は2*dispersionを先にoverflowさせInfinity*0=NaN。静的解析のみ。


## Audit #680 — Gaussian AIC logarithm intermediate overflow
- 対象: `src/models/glmFamily.ts` SHA `c6d8d8b8c47dda7ed96bef3043d90abb7c637bb5`。
- Issue [#189](https://github.com/numero-uno-jpn/rStats.js/issues/189)。再現: `glm([[]],[1e154],{family:"gaussian",link:"log",intercept:false})`。deviance約1e308は有限だが、Gaussian AICの `2*pi*dev` がlogより前にInfinityとなる。log(2*pi*dev)+3自体は約714で有限。静的IEEE-754解析のみ。


- 重複整理: 初回登録で作成された正規Issueは #172〜#179、#188、#189。後続の再試行で重複した #180〜#187 はすべてGitHubで `closed / duplicate` とした。ソース変更なし。今回の10件すべてpackage runtime/Vitest/Rとの実行照合は未実施。


## Audit #681 — rcond inverse-norm overflow for a nonsingular matrix
- 対象: `src/linalg/solve.ts` SHA `d8df21ba08caaa996d1db3f2659e9a71a431d668`。
- Issue [#191](https://github.com/numero-uno-jpn/rStats.js/issues/191)。再現: `rcond([[1, 0], [0, 1e-310]])`。行列は非特異で、1-norm reciprocal condition numberは約1e-310として表現可能。逆行列ノルム自体は1e310でoverflowし、`gecon()` が非有限の `ainvnm` を0へ変換するため、非特異行列を特異行列同様に報告する。静的制御フロー・IEEE-754解析のみ。


## Audit #682 — zTest sample-estimate underflow under sigma-dominated scaling
- 対象: `src/htest/aov.ts` SHA `9ce3aa388e5d2200fd75c751d6c69660d0e11648` の `zTest()`。
- Issue [#192](https://github.com/numero-uno-jpn/rStats.js/issues/192)。再現: `zTest([1e-308, 2e-308, 3e-308], { sigmaX: 1e308 }).estimate`。既知sigmaを含む共通scaleにより標本値が0へunderflowし、平均2e-308を0として返す。検定統計量のscaleと単位付き推定値のscaleを分離すべき。静的IEEE-754解析のみ。


## Audit #683 — lm zero-weight row response overflow during active-response scaling
- 対象: `src/models/lm.ts` SHA `95e161942a868624c1606925bfe00a1725ccc9f0` の `fitLm()` / `fitLmUnit()`。
- Issue [#193](https://github.com/numero-uno-jpn/rStats.js/issues/193)。再現: `lm([[], []], [1e-308, 1e308], { weights: [1, 0] })`。scale exponentは正weight行の1e-308だけから決まり、zero-weight行の有限response 1e308にも同じ倍率を適用してInfinity化する。zero-weight行の残差は約1e308として有限であるべきだが、戻り値がInfinityとなる。matrix/formula両経路に影響。静的IEEE-754解析のみ。


## Audit #684 — lm formula WLS positive-weight underflow before square root
- 対象: `src/models/lm.ts` SHA `95e161942a868624c1606925bfe00a1725ccc9f0`、`src/internal/summary.ts` の `ldexp()` / `ddSqrtWeights()` 呼び出し経路。
- Issue [#194](https://github.com/numero-uno-jpn/rStats.js/issues/194)。再現: `lm("y ~ 0 + a + b", { y:[1,2], a:[1,0], b:[0,1], w:[1e308,1e-308] }, { weights:"w" })`。identity designで両weightは正なので係数[1,2]・rank2が必要。formulaのprecise pathはweight自体を約2^-1022倍してから平方根を取るため、第二weightが0へunderflowし、その列の情報を失う。sqrt(weight)を先にscaleする必要。静的IEEE-754解析のみ。


## Audit #685 — lm prediction dot-product overflow and cancellation
- 対象: `src/models/lm.ts` SHA `95e161942a868624c1606925bfe00a1725ccc9f0` の `predict()`。
- Issue [#195](https://github.com/numero-uno-jpn/rStats.js/issues/195)。再現: `const fit = lm([[1,0],[0,1],[1,1]],[2,-2,0],{intercept:false}); predict(fit,[[1e308,1e308]]).fit`。係数2,-2による数学的内積は0だが、個々の積が±Infinityとなり和がNaN。scale/compensated dot productが必要。静的IEEE-754解析のみ。


## Audit #686 — lm prediction standard-error triangular-solve overflow
- 対象: `src/models/lm.ts` SHA `95e161942a868624c1606925bfe00a1725ccc9f0`、`src/internal/summary.ts` の `norm2()`。
- Issue [#196](https://github.com/numero-uno-jpn/rStats.js/issues/196)。再現: `const fit = lm([1e-200,2e-200,3e-200],[1e-200,2e-200,4e-200],{intercept:false}); predict(fit,[1e200]).seFit`。R^-T xの成分は約1e400で先にInfinityとなるが、残差標準誤差は約1e-200で、最終SEは約1e200として有限。norm2の後にsigmaを掛けるだけでは途中overflowを回復できない。scaled triangular solveが必要。静的IEEE-754解析のみ。


## Audit #687 — powerTTest noncentrality intermediate overflow
- 対象: `src/htest/power.ts` SHA `5950a5e498272e8ae0b5a581e849477eb287c349` の `powerTTest()`。
- Issue [#197](https://github.com/numero-uno-jpn/rStats.js/issues/197)。再現: `powerTTest({ n:10, delta:1e308, sd:1e308 })`。true ncpはsqrt(10/2)=sqrt(5)で有限だが、`sqrt(n/ts)*delta` を先に形成してInfinityとなり、後からsdで割っても回復しない。powerを1へ誤飽和させる。比率を先に取る等のscaled productが必要。静的IEEE-754解析のみ。


## Audit #688 — pwr2p2nTest harmonic sample-size product overflow
- 対象: `src/htest/pwr.ts` SHA `a9f7c6f320272cfb00ed2704084507bc16861367` の `pwr2p2nTest()`。
- Issue [#198](https://github.com/numero-uno-jpn/rStats.js/issues/198)。再現: `pwr2p2nTest({ h:1e-100, n1:1e200, n2:1e200 })`。`n1*n2` がInfinityとなるが、`sqrt(n1*n2/(n1+n2))` の数学的値は約7.071e99で有限、hを掛けた効果は約0.707。現行実装はpowerを1へ誤飽和させる。積を作らない比率式が必要。静的IEEE-754解析のみ。


## Audit #689 — lm weighted QR overflow under a common weight multiplier
- 対象: `src/models/lm.ts` SHA `95e161942a868624c1606925bfe00a1725ccc9f0`、`src/linalg/qr.ts` の `nrm2()`。
- Issue [#199](https://github.com/numero-uno-jpn/rStats.js/issues/199)。再現: `lm([0.7e308,0.8e308,0.9e308],[1,2,3],{weights:[2,2,2]})`。有限な設計列のunweighted normは約1.39e308だが、共通weightのsqrt(2)を掛けると約1.97e308へoverflowする。全weightへの同一正定数乗算はWLS係数を変えないため、weightの共通scaleをさらに正規化してQR前のoverflowを防ぐべき。静的IEEE-754解析のみ。


## Audit #690 — pwrAnovaTest noncentrality product overflow
- 対象: `src/htest/pwr.ts` SHA `a9f7c6f320272cfb00ed2704084507bc16861367` の `pwrAnovaTest()`。
- Issue [#200](https://github.com/numero-uno-jpn/rStats.js/issues/200)。再現: `pwrAnovaTest({ k:1e160, n:1e160, f:1e-160 })`。現行の左結合 `k*n*f**2` は先にk*nがInfinityとなるが、数学的なnoncentralityは1。中間値overflowを理由にpower=1と短絡するため、有限の数学的効果を無限大と誤認する。dfの極端域も含め、noncentrality計算をscaled productで扱う必要。静的IEEE-754解析のみ。


- Issue登録結果: 新規の正規Issue #191〜#200を10件登録。#190は同じrcond所見の登録重複として `closed / duplicate` に整理。ソース変更なし。今回の10件はすべて静的ソース追跡・IEEE-754解析のみで、package runtime/Vitest/R照合は未実施。


## Audit #691 — weightedMean denominator overflow bypasses its recovery path
- 対象: `src/descriptive/basic.ts` SHA `e12c8f8c91152f8d617cd05bf07ce512ef00856a` の `weightedMean()`。
- Issue [#201](https://github.com/numero-uno-jpn/rStats.js/issues/201)。再現データ: `weightedMean([1e-308, 2e-308, 1e308], [1e308, 1e308, 0])`。正weightの積和は3、weight合計は2e308でInfinityだが、正しい加重平均は1.5e-308。現在は3/Infinity=0が有限値となり、非有限quotientだけを条件にしたscaled fallbackに入らず0を返す。静的ソース・IEEE-754解析のみ。


## Audit #692 — pwrF2Test finite noncentrality lost to df-sum overflow
- 対象: `src/htest/pwr.ts` SHA `a9f7c6f320272cfb00ed2704084507bc16861367` の `pwrF2Test()`。
- Issue [#202](https://github.com/numero-uno-jpn/rStats.js/issues/202)。再現: `pwrF2Test({u:1e308,v:1e308,f2:1e-308})`。u,vはそれぞれ有限だがu+vがInfinityとなり、真のncpは約2なのにInfinityとしてpower=1へ短絡される。静的IEEE-754解析のみ。


## Audit #693 — TukeyHSD confidence-level validation missing
- 対象: `src/htest/aov.ts` SHA `9ce3aa388e5d2200fd75c751d6c69660d0e11648` の `TukeyHSD()`。
- Issue [#203](https://github.com/numero-uno-jpn/rStats.js/issues/203)。再現: `TukeyHSD([[1,2,3],[2,3,4]], {confLevel:1.2})` および `confLevel:NaN`。open-interval検証なしでqtukeyへ渡し、NaNの信頼限界・調整p値を含む結果を正常返却する。他の検定関数と同様、計算前にconfLevelを検証すべき。静的ソース追跡のみ。


## Audit #694 — ES.w1 / ES.w2 zero-over-zero reference behavior mismatch
- 対象: `src/htest/pwr.ts` SHA `a9f7c6f320272cfb00ed2704084507bc16861367` の `esW1()` / `esW2()`。
- Issue [#204](https://github.com/numero-uno-jpn/rStats.js/issues/204)。再現: `esW1([0,1],[0,1])`、`esW2([[0,0],[0,1]])`。現実装はnull/alternativeとも0のセルをskipして0を返すが、CRAN pwrの参照式は該当セルで0/0を評価し、sumをNaNにする。R互換を掲げるeffect-size関数の結果不一致。参照式: pwr `ES.w1` / `ES.w2`。静的ソース比較のみ。


## Audit #695 — eigen global scaling underflows representable eigenvalues
- 対象: `src/linalg/eigen.ts` SHA `3e4a152063336048ae11876326e5b44d12023577`。
- Issue [#205](https://github.com/numero-uno-jpn/rStats.js/issues/205)。再現: `eigen([[1e308,0],[0,1e-308]], {symmetric:true,onlyValues:true}).values`。最大要素に合わせた共通2冪scaleで小さい対角要素が0へunderflowし、scale backしても小さい固有値1e-308を復元できない。対角行列で明確に再現する。静的IEEE-754解析のみ。


## Audit #696 — crossprod / tcrossprod lack the matMul rescaled-dot fallback
- 対象: `src/linalg/ops.ts` SHA `29ffd657b2cb314c736daff3303cb24640a324c4`。
- Issue [#206](https://github.com/numero-uno-jpn/rStats.js/issues/206)。再現: `crossprod([[1e200,1e200],[1e200,-1e200]])` および `tcrossprod([[1e200,1e200],[1e200,-1e200]])`。対角の平方和はoverflowしてよいが、非対角の厳密な内積は1e400-1e400=0。現行は中間積±Infinityの和NaNを返す。matMulにあるrescaledDot相当の保護が両関数にない。静的IEEE-754解析のみ。


## Audit #697 — unbalanced expm scaling erases a small but essential matrix entry
- 対象: `src/linalg/expm.ts` SHA `ee5694d507b2da8245c9a391a0983f328f416f26`。
- Issue [#207](https://github.com/numero-uno-jpn/rStats.js/issues/207)。再現: `expm([[0,1e308],[1e-308,0]], {method:"Higham08"})`。A²=Iなのでexp(A)=cosh(1)I+sinh(1)Aで、全成分が有限。unbalanced Higham08の共通scale(約2^-1021)で下左要素1e-308が0へunderflowし、Padé近似が別のnilpotent行列に対して実行される。静的IEEE-754解析のみ。


## Audit #698 — matMul rescaledDot loses a tiny residual after dominant cancellation
- 対象: `src/linalg/ops.ts` SHA `29ffd657b2cb314c736daff3303cb24640a324c4` の `rescaledDot()`。
- Issue [#208](https://github.com/numero-uno-jpn/rStats.js/issues/208)。再現データ: `matMul([[1e308,1e308,1e-308]], [[1e308],[-1e308],[1e308]])`。厳密な積和は+1e616-1e616+1=1。overflow fallbackは各ベクトルを最大指数で一括scaleするため、最後の1e-308要素が0へunderflowし、支配項の相殺後に残る1を失って0を返す。指数ビン分割等の加算が必要。静的IEEE-754解析のみ。


## Audit #699 — ansariTest exact estimate midpoint overflows
- 対象: `src/htest/ansariTest.ts` SHA `9f13bb6d406d4f36761a562aed8bb17c0ce52db4` の `exactInterval()`。
- Issue [#209](https://github.com/numero-uno-jpn/rStats.js/issues/209)。再現: `ansariTest([1e308], [1,1.01], {confInt:true,exact:true})`。exact candidate ratiosは約9.90e307と1e308で、平均は有限だが和がNumber.MAX_VALUEを超える。`(above+below)/2` のためestimateがInfinityになり得る。安定midpoint関数を使うべき。静的IEEE-754解析のみ。


## Audit #700 — wilcoxTest null-location subtraction manufactures ties
- 対象: `src/htest/wilcoxTest.ts` SHA `e40880f46edb938f5ad4814187de0f2d27058eb0` のone-sample signed-rank経路。
- Issue [#210](https://github.com/numero-uno-jpn/rStats.js/issues/210)。再現: `wilcoxTest([1e308,1.1e308,1.2e308], {mu:-1e308})`。真の正差は順に約2e308,2.1e308,2.2e308で順位は1,2,3、signed-rank sum=6、exact two-sided p=0.25。現行の直接減算で全てInfinityとなり人工的な同順位が発生し、exact branchが無効化される。静的IEEE-754解析のみ。


- Issue登録結果: 正規の新規Issue #201〜#210を10件登録。今回の監査対象にソース変更なし。全件静的ソース追跡・IEEE-754解析または参照式比較であり、package runtime/Vitest/R実行照合は未実施。


## Audit #701 — ode finite time-step subtraction overflow
- 対象: `src/numerics/ode.ts` SHA `8683b9df7e690f62a2090ce8e91fe87074b317ee`。
- Issue [#211](https://github.com/numero-uno-jpn/rStats.js/issues/211)。再現: `ode([1],[-1e308,1e308],()=>[0],[],{method:"euler"})`。両時刻は有限だが差分hがInfinityとなり、`1 + Infinity * 0`で不変であるべきstateがNaNになる。RK2/RK4にも同じstep生成が影響。Issue #124のRK4 weighted-increment scalingとは別の原因。静的IEEE-754解析のみ。

## Audit #702 — localMin same-sign finite bracket midpoint overflow
- 対象: `src/optim/localmin.ts` SHA `e91b4a827cb9589a4539b326cd48155ec3ce6988`。
- Issue [#212](https://github.com/numero-uno-jpn/rStats.js/issues/212)。再現: `localMin(x=>(x/1e308-1.1)**2,1e308,1.7e308)`。a,bは有限で真の最小点1.1e308も区間内だが、`0.5*(a+b)`がInfinityとなり、Brentのgolden stepが区間右側へ偏って左側の最小点を探索しない。静的制御フロー・IEEE-754解析のみ。

## Audit #703 — Richardson relative step product overflow
- 対象: `src/numerics/deriv.ts` SHA `7a339332c11e4b55e6f35fb8f120c7fd2c92311d`。
- Issue [#213](https://github.com/numero-uno-jpn/rStats.js/issues/213)。再現: `grad(x=>x[0]/1e308,[1e308],{d:2})`。dと座標は有限だが`d*x`がInfinityとなり、±Infinityでcentral differenceを評価して有限な導関数1e-308を失う。共通steps()を使うRichardson jacobian/hessianにも影響。静的IEEE-754解析のみ。

## Audit #704 — Hessian finite-difference denominator overflow
- 対象: `src/numerics/deriv.ts` SHA `7a339332c11e4b55e6f35fb8f120c7fd2c92311d`。
- Issue [#214](https://github.com/numero-uno-jpn/rStats.js/issues/214)。再現: `hessian(x=>x[0]*x[0]/1e200,[1e100],{d:2e54,r:1})`。step h=2e154は有限、関数値も有限で真の二階微分2e-200は表現可能だが、`h**2`がInfinityとなり結果0。mixed partialの`2*hi*hj`にも同型の問題。静的式・IEEE-754解析のみ。

## Audit #705 — barylag finite node-difference overflow
- 対象: `src/numerics/interp.ts` SHA `db6d98b09bf7483749d759fcf39b7fce38e05a1d` の`barylag()`。
- Issue [#215](https://github.com/numero-uno-jpn/rStats.js/issues/215)。再現: `barylag([-1e308,1e308],[-1,1],[0])`。単一の有限節点差がInfinityとなるため、積の2^500 rescalingに到達する前にweight生成が破綻する。既存Issue #14の「有限差分の積がoverflowする」ケースとは別に、差分そのもののoverflowを扱う必要。静的IEEE-754解析のみ。

## Audit #706 — global Hermite divided differences overflow finite node spacing
- 対象: `src/numerics/interp.ts` SHA `db6d98b09bf7483749d759fcf39b7fce38e05a1d` の`hermiteInterp()`。
- Issue [#216](https://github.com/numero-uno-jpn/rStats.js/issues/216)。再現: `hermiteInterp([-1e308,1e308],[-1,1],[0,0],[0])`。節点は異なる有限値だが、divided-difference denominatorの差がInfinityとなる。Hermite条件から中央の値は0だが、現行tableは差分を失い誤値を返す。既存Issue #125のsplinefun/splinefunHとは別のglobal Hermite経路。静的数式解析のみ。

## Audit #707 — barylag repeated-node input review (not planned)
- 対象: `src/numerics/interp.ts` SHA `db6d98b09bf7483749d759fcf39b7fce38e05a1d` の`barylag()`。
- 候補Issue #217は登録後に再評価し、重複節点では一意なLagrange補間多項式が定まらないため、有効入力に対する数値バグではないと判断。Issue #217を`closed / not_planned`。追加の有効入力バグとしては計上しない。

## Audit #708 — hermiteInterp repeated-node input review (not planned)
- 対象: `src/numerics/interp.ts` SHA `db6d98b09bf7483749d759fcf39b7fce38e05a1d` の`hermiteInterp()`。
- 候補Issue #218は登録後に再評価し、同一節点に複数の値・導関数条件を与える入力は一意な補間問題を定義しないため、有効入力に対する数値バグではないと判断。Issue #218を`closed / not_planned`。追加の有効入力バグとしては計上しない。

## Audit #709 — r2dtable zero-count allocation
- 対象: `src/random/r2dtable.ts` SHA `3e5a15a95b5a73e04ec337d441a2976ecbf88583`。
- Issue [#219](https://github.com/numero-uno-jpn/rStats.js/issues/219)。再現: `r2dtable(0,[1_000_000_000,1_000_000_000],[1_000_000_000,1_000_000_000])`。count=0で結果は空配列だが、関数は2,000,000,001要素のFloat64 factorial table（約16 GB）を先に確保する。大規模allocationを避けるため再現実行はしていない。静的allocation/control-flow解析のみ。

## Audit #710 — localMin invalid tolerance nontermination
- 対象: `src/optim/localmin.ts` SHA `e91b4a827cb9589a4539b326cd48155ec3ce6988`。
- Issue [#220](https://github.com/numero-uno-jpn/rStats.js/issues/220)。再現: `localMin(x=>x*x,-1,1,NaN)`ではtol1/t2がNaNとなり、NaN trialがbracket endpointへ入り、その後の反復もNaNとなって終了条件を満たさない。`tol=Infinity`は初期点で直ちに終了し、目的関数の最小点を探索しない。有限正tolの検証が必要。静的制御フロー解析のみ。

## Audit #711 — approx invalid method/rule silently changes semantics
- 対象: `src/numerics/interp.ts` SHA `db6d98b09bf7483749d759fcf39b7fce38e05a1d` の`approx()`。
- Issue [#221](https://github.com/numero-uno-jpn/rStats.js/issues/221)。再現: `approx([0,1],[0,1],{xout:[0.5],method:"linera"})`はlinearでなくstepAtへfall throughする。`rule:3`もrule=2相当として扱われる。R APIで定義されていないoption値を明示的に拒否せず、黙って異なる補間結果を返す。静的dispatch・API contract確認のみ。

## Audit #712 — gammaScale reciprocal consistency tolerance
- 対象: `src/distributions/gamma.ts` SHA `e9ba1c35ef88e77e84a392562bb7f62378fcbf7f` の`gammaScale()`。
- Issue [#222](https://github.com/numero-uno-jpn/rStats.js/issues/222)。再現: `gammaScale({rate:1,scale:1+4*Number.EPSILON})`。積と1との差が1e-15未満というだけで、rate=1に対する厳密な逆数1ではないscaleを受理する。APIに記載されたrate/scale関係と許容差の方針を明確化する必要。静的算術・validation traceのみ。

- Issue登録結果: 新規Issue #211〜#216、#219〜#222の計10件をopenで登録。候補#217/#218は重複節点という数学的に未定義な入力だったため、not_plannedでclose。今回もソースコード変更なし。すべて静的ソース追跡・IEEE-754/制御フロー解析であり、package runtime/Vitest/R実行照合は未実施。


## Audit #713 — poissonTest expected-count fallback overflow
- 対象: `src/htest/poissonTest.ts` SHA `61c2c6a882fc0672e73fe45b5a547b2494b4e444`。
- Issue [#223](https://github.com/numero-uno-jpn/rStats.js/issues/223)。再現: `poissonTest([1e308,0],{r:2,T:[1,1e308]}).parameter`。真の期待countは約1だが、直接式・fallbackともInfinity/InfinityとなりNaN。静的IEEE-754解析のみ。

## Audit #714 — mantelhaenTest general covariance overflow
- 対象: `src/htest/mantelhaenTest.ts` SHA `669a040db7481c9aad8d0da633a4e73f333b2488`。
- Issue [#224](https://github.com/numero-uno-jpn/rStats.js/issues/224)。再現: 3×3各セル1e103の同一表を2 strataで渡す。general()のt³ denominatorがInfinity、f=0となる一方vr*vcがInfinityとなり共分散行列にNaN。均衡表の統計量は0。静的数式解析のみ。

## Audit #715 — tabulate inferred nbins with positive Infinity
- 対象: `src/descriptive/table.ts` SHA `d6a292d4eb9f040528219f8202e2ad962cfc13e0`。
- Issue [#225](https://github.com/numero-uno-jpn/rStats.js/issues/225)。再現: `tabulate([1,Infinity])`。InfinityがMath.trunc後も残り、nbins推定と配列長に伝播する。有限bin 1を数えた`[1]`が返らずRangeError。静的control-flow解析のみ。

## Audit #716 — mantelhaenTest 2×2×K margin overflow
- 対象: `src/htest/mantelhaenTest.ts` SHA `669a040db7481c9aad8d0da633a4e73f333b2488`。
- Issue [#226](https://github.com/numero-uno-jpn/rStats.js/issues/226)。再現: `const tab=[[1e308,1e308],[1e308,1e308]]; mantelhaenTest([tab,tab]).statistic`。各cellは有限だが層合計4e308がInfinityになり、2×2×K asymptotic pathのmargin/expected/varianceがNaN。均衡表の統計量は0。静的IEEE-754解析のみ。

## Audit #717 — cut empty explicit break vector
- 対象: `src/descriptive/table.ts` SHA `d6a292d4eb9f040528219f8202e2ad962cfc13e0`。
- Issue [#227](https://github.com/numero-uno-jpn/rStats.js/issues/227)。再現: `cut([0,1],[])`。明示breakの最小長を検証せずbinCodeへ進み、全観測をNaN codeにする。R cutの2個以上のunique break要求と不一致。静的API contract解析のみ。

## Audit #718 — hist density loses a representable subnormal
- 対象: `src/descriptive/hist.ts` SHA `7e5ab4c0db2d80ac9ab1bf1e94423cf800f829b5`。
- Issue [#228](https://github.com/numero-uno-jpn/rStats.js/issues/228)。再現: `hist([-1e308,1e308],{breaks:[-1e308,1e308]}).density`。有限端点差がInfinityとなりdensity=0だが、理論値約5e-309はsubnormalとして表現可能。静的式解析のみ。

## Audit #719 — hist accepts non-finite explicit breakpoints
- 対象: `src/descriptive/hist.ts` SHA `7e5ab4c0db2d80ac9ab1bf1e94423cf800f829b5`。
- Issue [#229](https://github.com/numero-uno-jpn/rStats.js/issues/229)。再現: `hist([0,1],{breaks:[-Infinity,Infinity]})`。strict-order checkは通過し、無限幅のbinとして受理する。R hist.defaultのfinite-break requirementと不一致。静的API contract解析のみ。

## Audit #720 — hist Scott class-count overflow
- 対象: `src/descriptive/hist.ts` SHA `7e5ab4c0db2d80ac9ab1bf1e94423cf800f829b5`。
- Issue [#230](https://github.com/numero-uno-jpn/rStats.js/issues/230)。再現: `hist([-1e308,1e308],{breaks:"Scott"})`。rangeとScott widthがInfinityになり、比がNaN。scale-freeな比は有限で約0.51、suggested intervalは1。静的式解析のみ。

## Audit #721 — hist Freedman-Diaconis class-count overflow
- 対象: `src/descriptive/hist.ts` SHA `7e5ab4c0db2d80ac9ab1bf1e94423cf800f829b5`。
- Issue [#231](https://github.com/numero-uno-jpn/rStats.js/issues/231)。再現: `hist([-1e308,1e308],{breaks:"FD"})`。rangeと2*IQRがInfinityになり、比がNaN。scale-freeなFD countは約1.26、ceilingで2。静的式解析のみ。

## Audit #722 — exact Mantel-Haenszel support allocation
- 対象: `src/htest/core/mantelhaen.ts` SHA `4b5a26bfeefa86028d47ad56711bfb92e4556b12`。
- Issue [#232](https://github.com/numero-uno-jpn/rStats.js/issues/232)。再現: 各cell=1e9の2×2 tableを2 strataでexact:true。各層のsupport 0..2,000,000,000のFloat64Array（約16GB）を無制限に確保しようとする。OOM回避のため実行せず、静的allocation traceのみ。

- Issue登録結果: 新規Issue #223〜#232の10件をOpenで登録。ソースコード変更なし。今回の再現検証は静的ソース追跡・IEEE-754/数式・allocation解析であり、package runtime/Vitest/R実行照合は未実施。


## Audit #723 — Walker alias queue overrun
- 対象: `src/random/sample.ts` SHA `b7ec2fba79900308f7d4c1f745bf45e06be11821` の `walkerSample()`。
- Issue [#233](https://github.com/numero-uno-jpn/rStats.js/issues/233)。再現: `const prob=[...Array(199).fill(0.5/201),50.75/201,50.75/201]`。n=201で全候補がalias methodの条件を満たす。199個のsmall mass=0.5と2個のlarge mass=50.75。small queueを消費した後も固定loopが1回余分に実行され、large entry同士をpairし、residual massを1.0/1.0から1.25/0.75へ誤再配分する。Walker alias tableの確率が入力weightsと一致しない。静的queue/control-flow・算術traceのみ。Vitest/package runtime/R実行なし。


## Audit #724 — weighted cumulative probability loses trailing mass
- 対象: `src/random/sample.ts` SHA `b7ec2fba79900308f7d4c1f745bf45e06be11821` の `probSampleReplace()`。
- Issue [#234](https://github.com/numero-uno-jpn/rStats.js/issues/234)。再現: `const prob=[0.5,0.5,1e-16]`。正規化後の降順累積和はbinary64で`[0.5,1,1]`となり、`probSampleReplace()`の`rU<1`選択と`probSampleNoReplace()`の`rT<1`選択で第3カテゴリの区間がなくなる。置換あり/なし双方で入力weightが正でもカテゴリが到達不能。静的binary64/control-flow解析のみ。Vitest/package runtime/R/Monte Carlo未実施。


## Audit #725 — F distribution summary moment overflow
- 対象: `src/distributions/summary.ts` SHA `21cc121671a9a9fac5b2e38a05772bb65d32515c` の `distSummary()` case `"f"`。
- Issue [#235](https://github.com/numero-uno-jpn/rStats.js/issues/235)。再現: `distSummary("f",{df1:1e308,df2:1e308})`。df1=df2=Dのvarianceは `4*D*(D-1)/((D-2)^2*(D-4))` と整理でき、D=1e308で約4e-308、sd約2e-154、skewness約4.24e-154と表現可能。現行の直接積では分子・分母・sd/skewness中間値がInfinity/InfinityとなりNaN。静的代数簡約・IEEE-754 range解析のみ。Vitest/package runtime/R実行なし。


## Audit #726 — negative-binomial summary parameter ratio overflow
- 対象: `src/distributions/summary.ts` SHA `21cc121671a9a9fac5b2e38a05772bb65d32515c` の `distSummary()` case `"nbinom"`。
- Issue [#236](https://github.com/numero-uno-jpn/rStats.js/issues/236)。再現: `distSummary("nbinom",{size:1e308,mu:1e308})`。有限のsizeとmuの和がInfinityとなり、p=size/(size+mu)=0として不正入力扱いになる。正しいp=0.5、mean=1e308。静的IEEE-754 range解析のみ。Vitest/package runtime/R実行なし。


## Audit #727 — hypergeometric summary product overflow
- 対象: `src/distributions/summary.ts` SHA `21cc121671a9a9fac5b2e38a05772bb65d32515c` の `distSummary()` case `"hyper"`。
- Issue [#237](https://github.com/numero-uno-jpn/rStats.js/issues/237)。再現: `distSummary("hyper",{m:1e200,n:1e200,k:1e200})`。M=N=K=1e200、population total 2e200は有限。真のmean=5e199、variance≈1.25e199、skewness=0。現行mode numerator `(k+1)*(m+1)`とmean numerator `k*m`がInfinityへoverflowし、mean/modeがInfinity。静的式・IEEE-754 range解析のみ。Vitest/package runtime/R実行なし。


## Audit #728 — inverse-gamma summary moment overflow
- 対象: `src/distributions/summary.ts` SHA `21cc121671a9a9fac5b2e38a05772bb65d32515c` の `distSummary()` case `"invgamma"`。
- Issue [#238](https://github.com/numero-uno-jpn/rStats.js/issues/238)。再現: `distSummary("invgamma",{alpha:1e308,beta:1e308})`。mean≈1、variance≈1e-308、sd≈1e-154、skewness≈4e-154、excess kurtosis≈3e-307と有限だが、variance/kurtosis raw productsがInfinity/InfinityとなりNaN。静的代数・IEEE-754 range解析のみ。Vitest/package runtime/R実行なし。


## Audit #729 — Kumaraswamy summary mode product overflow
- 対象: `src/distributions/summary.ts` SHA `21cc121671a9a9fac5b2e38a05772bb65d32515c` の `distSummary()` case `"kumar"`。
- Issue [#239](https://github.com/numero-uno-jpn/rStats.js/issues/239)。再現: `distSummary("kumar",{a:1e200,b:1e200}).mode`。a*bがInfinityとなりmode ratioが0、mode=0。log mode≈-log(b)/a≈-4.6e-198なので真のmodeはbinary64で1。静的代数・IEEE-754解析のみ。

## Audit #730 — Weibull summary narrow-shape concentration
- 対象: `src/distributions/summary.ts` SHA `21cc121671a9a9fac5b2e38a05772bb65d32515c` の `distSummary()` case `"weibull"`。
- Issue [#240](https://github.com/numero-uno-jpn/rStats.js/issues/240)。再現: `distSummary("weibull",{shape:1e308,scale:1})`。Y=k(X−1)は反射Gumbelへ収束し、sd≈π/(√6 k)=1.28255e-308、skewness≈−1.13955、excess kurtosis≈2.4。分布幅1e-308はx≈1のbinary64格子で分解不能で、central integration/raw momentsがspreadを失う。漸近式・IEEE-754解析のみ。QUADPACK/runtime未実行。

## Audit #731 — beta summary standard-deviation underflow
- 対象: `src/distributions/summary.ts` SHA `21cc121671a9a9fac5b2e38a05772bb65d32515c` の `distSummary()` case `"beta"`。
- Issue [#241](https://github.com/numero-uno-jpn/rStats.js/issues/241)。再現: `distSummary("beta",{shape1:1e-308,shape2:1e154})`。a/s≈1e-462は0へunderflowするが、sd≈√a/b≈1e-308はsubnormalとして表現可能。現行sdDirectはunderflow済みpaのsqrtから0を返す。静的漸近式・IEEE-754解析のみ。

## Audit #732 — triangular summary skewness underflow
- 対象: `src/distributions/summary.ts` SHA `21cc121671a9a9fac5b2e38a05772bb65d32515c` の `distSummary()` case `"triang"`。
- Issue [#242](https://github.com/numero-uno-jpn/rStats.js/issues/242)。再現: `distSummary("triang",{a:0,b:1e-200,c:5e-201})`。対称分布でskewness=0だが、q=7.5e-401が0へunderflowし、現行skewness式が0/0でNaN。sdDirectはscaled qsを使うためsd≈2.041e-201を保持できる。静的代数・IEEE-754解析のみ。

## Audit #733 — triangular summary large-offset overflow
- 対象: `src/distributions/summary.ts` SHA `21cc121671a9a9fac5b2e38a05772bb65d32515c`。
- Issue [#243](https://github.com/numero-uno-jpn/rStats.js/issues/243)。再現: `distSummary("triang",{a:1e308,b:1.0000000000000004e308,c:1.0000000000000002e308})`。cはa,bの中点。対称triangleなのでskewness=0、sd≈8.15e291 finite、varianceはtrue overflowでInfinity。raw qはInfinity-InfinityでNaN、skewness numeratorもInfinity演算でNaN。scaled qsはsdのみに利用。

## Audit #734 — hypergeometric summary kurtosis overflow
- 対象: `src/distributions/summary.ts` SHA `21cc121671a9a9fac5b2e38a05772bb65d32515c`。
- Issue [#244](https://github.com/numero-uno-jpn/rStats.js/issues/244)。再現: `distSummary("hyper",{m:1e150,n:1e150,k:1e150})`。N=2e150、mean=5e149、variance≈1.25e149、balanced caseのexcess kurtosis≈-1e-150。k*m*n*(N-k)と高次積がInfinityとなりkurtosis NaN。

## Audit #735 — gamma summary inconsistent rate/scale
- 対象: `src/distributions/summary.ts` SHA `21cc121671a9a9fac5b2e38a05772bb65d32515c`。
- Issue [#245](https://github.com/numero-uno-jpn/rStats.js/issues/245)。再現: `distSummary("gamma",{shape:2,rate:2,scale:1})`。GammaParams契約は両方指定時scale=1/rate。gammaScale()を使うdensity/CDF/quantile/random pathは不一致をthrowするがsummaryはscaleが存在することだけを見てrateを無視し、shape2/scale1のmomentsを返す。

## Audit #736 — derivative zero step at exact zero with zeroTol=0
- 対象: `src/numerics/deriv.ts` SHA `7a339332c11e4b55e6f35fb8f120c7fd2c92311d`。
- Issue [#246](https://github.com/numero-uno-jpn/rStats.js/issues/246)。再現: `grad(x=>x[0]*x[0],[0],{zeroTol:0})`。h0=abs(d*0)+(abs(0)<0?eps:0)=0、中央差分は0/0でNaNとなりRangeError。jacobian/hessianも共有steps()を使う。

## Audit #737 — uniroot extendInt enum is not validated
- 対象: `src/numerics/integrate.ts` SHA `6df1afbeed34b40ab91e3f064f5af8aba7d02b56`。
- Issue [#247](https://github.com/numero-uno-jpn/rStats.js/issues/247)。再現: `uniroot(x=>x*x-2,0,2,{extendInt:"bogus" as any})`。有効bracketでrootを返しunsupported optionを黙って無視する。same-sign endpointsではno扱いとなる。

## Audit #738 — optim scaled controls lack validation
- 対象: `src/optim/optim.ts` SHA `b0adf40e7b8433cd39111a835580a9a5b3b2108c`。
- Issue [#248](https://github.com/numero-uno-jpn/rStats.js/issues/248)。再現: `optim([1],x=>x[0]*x[0],{method:"BFGS",control:{parscale:0}})`でscaled coordinate=Infinity。fnscale=0はobjective division by zero、ndeps=0はzero-width finite difference。optim()/optimHess()のScaled構築前にcontrolsを検証しない。

## Audit #739 — Kumaraswamy summary loses spread at huge shapes
- 対象: `src/distributions/summary.ts` SHA `21cc121671a9a9fac5b2e38a05772bb65d32515c`。
- Issue [#249](https://github.com/numero-uno-jpn/rStats.js/issues/249)。再現: `distSummary("kumar",{a:1e308,b:1e308})`。Xは1からO(1e-308)内に集中。Y=-A log(X)-log(A)はGumbelへ収束し、sd(X)≈π/(√6 A)=1.28255e-308、skewness≈-1.13955、excess kurtosis≈2.4。x座標quadratureが幅を解像せず、raw momentsも1+r/aが1に丸まってspreadを失う。

## Audit #740 — rcond triangular invalid uplo falls through to lower
- 対象: `src/linalg/solve.ts` SHA `d8df21ba08caaa996d1db3f2659e9a71a431d668`。
- Issue [#250](https://github.com/numero-uno-jpn/rStats.js/issues/250)。再現: `rcond([[1,100],[0,1]],{triangular:true,uplo:"X" as any})`。uploがUでない場合にlower branchとして計算し、identity相当のrcond=1を返す。

## Audit #741 — rcond triangular mode ignores rectangular columns
- 対象: `src/linalg/solve.ts` SHA `d8df21ba08caaa996d1db3f2659e9a71a431d668`。
- Issue [#251](https://github.com/numero-uno-jpn/rStats.js/issues/251)。再現: `rcond([[1,0,100],[0,1,0]],{triangular:true,uplo:"U"})`。2×3 matrixをrejectせず、trcon()はnrow=2をdimensionとして先頭2列のみ処理し、3列目を無視。

## Audit #742 — optim Brent ignores maxit
- 対象: `src/optim/optim.ts` SHA `b0adf40e7b8433cd39111a835580a9a5b3b2108c`。
- Issue [#252](https://github.com/numero-uno-jpn/rStats.js/issues/252)。再現: `optim([0],x=>(x[0]-0.123456789)**2,{method:"Brent",lower:-1,upper:1,control:{maxit:1}})`。Brent branchはmaxitをoptimize()に渡さず、localMin()にiteration capがないため、指定maxitを無視してtoleranceまで続行する。


## Audit #743 — survfit log-log interval at survival 1 with zero standard error
- 対象: `src/models/survival.ts` SHA `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de` の `survfit()`。
- Issue [#253](https://github.com/numero-uno-jpn/rStats.js/issues/253)。再現: `survfit([1,2],[0,0],{confType:"log-log"})`。イベントなしでS=1、Greenwood SE=0なのに境界分岐がlower/upperをNaNにする。survival::survfit_confintはse=0ならpを返す。静的ソース解析。package/Vitest/R実行なし。

## Audit #744 — survfit median tolerance creates a false 0.5 crossing
- 対象: `src/models/survival.ts` SHA `03183bdcb6437634a6ddfae1e1f3d98ff2cbc4de` の `curveMedian()`。
- Issue [#254](https://github.com/numero-uno-jpn/rStats.js/issues/254)。再現: `survfit([1,2,3],[1,0,1],{confType:"plain",confInt:0.45970860108863704})`。時刻1のlower CIは約0.50000001で真の0.5 crossingではないが、sqrt(eps)≈1.49e-8 toleranceでexact plateauとみなされ、次のevent時刻3との中点2を返す。真の最初のcrossingは時刻3。静的計算・ソース解析。実行テストなし。

## Audit #745 — pivotLonger single namesTo does not validate regex captures
- 対象: `src/descriptive/pivot.ts` SHA `7b7839d4c44daf2bc7c564493c376efb907ad8c1` の `nameParts()`。
- Issue [#255](https://github.com/numero-uno-jpn/rStats.js/issues/255)。再現: `pivotLonger({id:[1],x1:[10],x2:[20]},{cols:["x1","x2"],namesTo:"time",namesPattern:"x[0-9]+"})`。単一namesToではregexのcapture group数を検証せず、capture groupなしなら全parsed namesがnull、複数なら先頭以外を黙って捨てる。multi-field pathはgroup数を検証する。静的ソース解析。実行テストなし。

## Audit #746 — pivot ordering options silently accept unsupported values
- 対象: `src/descriptive/pivot.ts` SHA `7b7839d4c44daf2bc7c564493c376efb907ad8c1` の `pivotLonger()` / `pivotWider()`。
- Issue [#256](https://github.com/numero-uno-jpn/rStats.js/issues/256)。再現: `pivotLonger({id:[1],a:[10],b:[20]},{cols:["a","b"],colsVary:"slwest" as any})`、および `pivotWider({id:[1,1],time:["a","b"],value:[10,20]},{namesFrom:"time",valuesFrom:"value",namesVary:"slwest" as any})`。有効値はfastest/slowestだが、slowest以外をfastestとして処理し不正値を黙って受け入れる。静的ソース解析。実行テストなし。

## Audit #747 — quantile clamps probabilities just outside [0,1]
- 対象: `src/descriptive/quantile.ts` SHA `7fe14be52f404d0565fc5ec0cd4d953d155c2b6a` の `quantile()`。
- Issue [#257](https://github.com/numero-uno-jpn/rStats.js/issues/257)。再現: `quantile([1,2,3],-1e-14)` または `quantile([1,2,3],1+1e-14)`。100*Number.EPSILON以内の範囲外確率を許容し、0/1にclampして端点を返す。確率契約[0,1]から外れる入力は拒否すべき。静的ソース解析。R/Vitest実行なし。

## Audit #748 — histogram fuzz width overflows for finite opposite-sign data
- 対象: `src/descriptive/hist.ts` SHA `7e5ab4c0db2d80ac9ab1bf1e94423cf800f829b5` の `fuzzScale()` / `hist()`。
- Issue [#258](https://github.com/numero-uno-jpn/rStats.js/issues/258)。再現: `hist([-1e308,1e308],{breaks:[-1e308,0,1e308]})`。br.length<=3でdataRange=hi-lo=Infinity、fuzz tauもInfinityとなり中間breakがInfinityに移動、期待counts [1,1]が[2,0]になる。有限入力のrange差を直接減算する問題。静的IEEE-754解析。実行テストなし。

## Audit #749 — histogram density denominator overflows for finite bin width
- 対象: `src/descriptive/hist.ts` SHA `7e5ab4c0db2d80ac9ab1bf1e94423cf800f829b5` のdensity計算。
- Issue [#259](https://github.com/numero-uno-jpn/rStats.js/issues/259)。再現: `hist([0,1e308],{breaks:[0,1e308]}).density`。count=2,n=2,width=1e308なので真のdensity=1e-308は表現可能だが、n*widthがInfinityとなり現行式count/(n*width)は0を返す。count/n/width等の順序なら保持可能。静的IEEE-754解析。実行テストなし。

## Audit #750 — estimability test compares overflowed dot product and norms
- 対象: `src/models/estimable.ts` SHA `01bb4704f17c7d8aed407922a94cc5457207eeba` の `nonEstimableRows()`。
- Issue [#260](https://github.com/numero-uno-jpn/rStats.js/issues/260)。再現:
  ```ts
  const q = qr([[1,0,0,-1],[0,1,0,-1],[0,0,1,-1],[1,1,1,-3]]);
  nonEstimableRows(q,3,[[1e308,1e308,1e308,1e308]]);
  ```
  null方向は[1,1,1,1]に比例し予測行は非直交だが、dotとnorm(x)がInfinityになりInfinity > Infinityがfalse、非estimableを見逃す。正規化してから内積・ノルム比較する必要がある。静的線形代数/IEEE-754解析。実行テストなし。

## Audit #751 — omega accepts one item and returns undefined reliability statistics
- 対象: `src/descriptive/omega.ts` SHA `0a402dc583bb209e94f6d151ae1c5f8e9e10813d` の `omega()`。
- Issue [#261](https://github.com/numero-uno-jpn/rStats.js/issues/261)。再現: `omega([[1],[2],[3]],{nfactors:1})`。p=1,q=1を通し、alphaでp-1=0、omegaLimでVt-U=0となりNaN/Infinityを返す。単一項目ではinternal consistency reliabilityを定義できないため、少なくとも明示的に拒否する必要がある。静的ソース・数式解析。実行テストなし。

## Audit #752 — tabulate skips the 2^31 size guard for inferred nbins
- 対象: `src/descriptive/table.ts` SHA `d6a292d4eb9f040528219f8202e2ad962cfc13e0` の `tabulate()`。
- Issue [#262](https://github.com/numero-uno-jpn/rStats.js/issues/262)。再現: `tabulate([2 ** 31])`。2^31以上を拒否するguardは明示的nbinsの分岐にしかなく、nbinsをbin最大値から推定した場合は巨大なArray.fill割当てへ進み、RangeErrorやメモリ枯渇を起こし得る。巨大割当ては実行していない。静的ソース解析。


## Audit #753 — normal-power upper critical value loses tiny alpha
- 対象: `src/htest/pwr.ts` SHA `c6ca40a25ff10fcdedd005a115fc5e7a65943b34` の共有関数 `normalPower()`。
- Issue [#263](https://github.com/numero-uno-jpn/rStats.js/issues/263)。再現: `pwrNormTest({d:0.3,n:50,sigLevel:1e-20})`。二側検定で `1 - sig/2` が1に丸まり、`qnorm(1)` がInfinity。上側棄却確率が0と評価され、powerを過小評価する。pwrPTest/pwr2pTest/pwr2p2nTestも共有関数を使う。静的IEEE-754解析。実行テストなし。

## Audit #754 — esW1 squared difference underflows before division
- 対象: `src/htest/pwr.ts` SHA `c6ca40a25ff10fcdedd005a115fc5e7a65943b34` の `esW1()`。
- Issue [#264](https://github.com/numero-uno-jpn/rStats.js/issues/264)。再現: `esW1([1e-320,1],[1e-200,1])`。第一項の真の寄与は約1e-80、wは約1e-40だが、`(p1-p0)**2` が0へunderflowし結果0。差をsqrt(p0)で割ってから二乗するなどのスケーリングが必要。静的IEEE-754解析。実行テストなし。

## Audit #755 — esW2 independence probability underflows to zero
- 対象: `src/htest/pwr.ts` SHA `c6ca40a25ff10fcdedd005a115fc5e7a65943b34` の `esW2()`。
- Issue [#265](https://github.com/numero-uno-jpn/rStats.js/issues/265)。再現: `esW2([[1e-200,0],[0,1]])`。周辺確率の積p00≈1e-400が0へunderflowし、実際の寄与は約1なのに `(p-p0)**2` も0となって0/0→NaN。期待wは約1。積・差・除算のスケーリングが必要。静的IEEE-754解析。実行テストなし。

## Audit #756 — polychor grand total overflow corrupts thresholds
- 対象: `src/htest/polycor.ts` SHA `6b98f70d655559b787ddc77f955964e37bf93ea3` の `thresholds()`。
- Issue [#266](https://github.com/numero-uno-jpn/rStats.js/issues/266)。再現: `polychor([[8e307,8e307],[8e307,8e307]])`。各row/column sum=1.6e308は有限だがgrand total=3.2e308はInfinity。累積比1.6e308/Infinity=0となり、本来0のthresholdがqnorm(0)=-Infinityに変わる。全セル等確率のテーブルのrho=0を壊す。静的IEEE-754解析。実行テストなし。

## Audit #757 — gebal norm-reduction test compares Infinity with Infinity
- 対象: `src/linalg/balance.ts` SHA `b0796b3365f4f23a7a02efdb05628380f85cf284` の `gebal()`。
- Issue [#267](https://github.com/numero-uno-jpn/rStats.js/issues/267)。再現:
  ```ts
  const A = toMat([[0,1.6e308],[6e307,0]]);
  gebal("S", A);
  ```
  index0のc=6e307,r=1.6e308。f=2候補ではc=1.2e308,r=8e307となり、真の和は2.2e308から2.0e308へ9.1%減少する。しかし両和がInfinityとなり、`c+r >= 0.95*s` がInfinity>=Infinityでtrueとなってscaleを棄却する。静的IEEE-754/アルゴリズム解析。実行/LAPACK比較なし。

## Audit #758 — McNemar continuity correction squares a negative corrected difference
- 対象: `src/htest/mcnemarTest.ts` SHA `335b11309ae373f295ef383f92e66f02f99f1d48`。
- Issue [#268](https://github.com/numero-uno-jpn/rStats.js/issues/268)。再現: `mcnemarTest([[0,1.5],[1,0]],{correct:true})`。b-c=0.5のため補正後の絶対差はmax(0,0.5-1)=0であるべきだが、現行は-0.5を二乗しstatistic=0.1を返す。table validationは非負有限値のみを要求し小数頻度を受け入れる。静的数式/ソース解析。実行/R比較なし。

## Audit #759 — pwrRTest critical t square overflows at tiny alpha
- 対象: `src/htest/pwr.ts` SHA `c6ca40a25ff10fcdedd005a115fc5e7a65943b34` の `pwrRTest()` 内 `upper()`。
- Issue [#269](https://github.com/numero-uno-jpn/rStats.js/issues/269)。再現: `pwrRTest({n:4,r:0.5,sigLevel:1e-320})`。df=2の有限なcritical tは約1e160で、その二乗がInfinity。現行 `t**2/(t**2+df)` はInfinity/Infinity=NaNとなりcritical correlationとpowerがNaN。critical Fisher-zは `asinh(t/sqrt(df))` 等で直接安定計算できる。静的漸近/IEEE-754解析。実行テストなし。

## Audit #760 — Bartlett test loses a group's variance before taking its logarithm
- 対象: `src/htest/varTest.ts` SHA `c7ec22cdff413f22705b5ca7462a3230405cc147` の `bartlettTest()`。共通スケーリングは `src/internal/summary.ts` の `groupMoments()`。
- Issue [#270](https://github.com/numero-uno-jpn/rStats.js/issues/270)。再現: `bartlettTest([[1e200,1.000000000000001e200],[0,1e-100]])`。共通スケールで第二群の偏差は約1e-300となり、二乗が0へunderflow。Bartlett統計は分散のlogを使うため、元の分散比がdouble範囲外でも統計量は有限に保てるが、現行はlog(0)=-Infinityからstatistic Infinity/p=0となる。静的スケール/数式解析。実行テストなし。

## Audit #761 — propTrendTest pooled proportion overflows on finite counts
- 対象: `src/htest/trendTests.ts` SHA `5dcd1d74fbe03a551c66a352b68b004d73cd52fb` の `propTrendTest()`。
- Issue [#271](https://github.com/numero-uno-jpn/rStats.js/issues/271)。再現: `propTrendTest([5e307,5e307],[1e308,1e308])`。個々のイベント数・試行数は検証を通るが、native reduceで両総和がInfinityとなりpooled proportion=Infinity/Infinity=NaN。両群とも比率0.5なので正しいtrend statisticは0、p-valueは1。安定和または共通スケールが必要。静的IEEE-754解析。実行テストなし。

## Audit #762 — powerAnovaTest overflow fallback still overflows before applying the variance ratio
- 対象: `src/htest/power.ts` SHA `5950a5e498272e8ae0b5a581e849477eb287c349` の `powerAnovaTest()`。
- Issue [#272](https://github.com/numero-uno-jpn/rStats.js/issues/272)。再現:
  ```ts
  powerAnovaTest({groups:1e200,n:1e200,betweenVar:1e8,withinVar:1e308});
  ```
  direct noncentrality expressionはInfinityになる。fallbackも `(groups-1)*n` を先に計算してInfinityとし、その後1e-300を掛けるためInfinityのまま。完全な数式上のnoncentralityは約1e100で有限なのに、関数はInfinity-ncpの極限power=1を返す。ratioを先に適用してもgroup*nが先にoverflowするため、指数スケーリング等が必要。静的算術解析。極端な自由度での分布評価は未実施。


## Audit #763 — SVD accepts fractional or infinite vector counts after dimension clamping
- 対象: `src/linalg/svd.ts` SHA `b3904ba3e70b5fac104e22a04bacb0f68af3c6bf`。
- Issue [#273](https://github.com/numero-uno-jpn/rStats.js/issues/273)。再現: `svd([[1,0],[0,1]],{nu:2.5})` および `svd([[1,0],[0,1]],{nv:Infinity})`。行列次元で `Math.min` した後に整数検証するため、不正な指定が2へ切り詰められて受理される。元の指定値を先に有限非負整数として検証すべき。静的ソース解析。実行テストなし。

## Audit #764 — seq accepts an infinite step and silently returns the starting value
- 対象: `src/linalg/ops.ts` SHA `29ffd657b2cb314c736daff3303cb24640a324c4` の `seq()`。
- Issue [#274](https://github.com/numero-uno-jpn/rStats.js/issues/274)。再現: `seq(1,10,{by:Infinity})` および `seq(1,10,{by:-Infinity})`。byの有限性を検証せず、`n=del/(by*f)` が0となり、`k=0`から開始値だけを返す。有限ステップを検証すべき。静的算術解析。実行テストなし。

## Audit #765 — qansariExact accepts fractional sample sizes
- 対象: `src/htest/core/ansari.ts` SHA `50932adf99cd27e98433c2a4ff7e40ced9055d14` の `qansariExact()`。
- Issue [#275](https://github.com/numero-uno-jpn/rStats.js/issues/275)。再現: `qansariExact(0.5,1.5,2)`。`pansariExact()` と `dansariExact()` はm,nの整数性を検証するが、qansariExactはm,n>=1しか検証しない。分数sample sizeが配列長の暗黙変換と位置選択再帰へ流れ、無効な帰無分布を構築する。静的ソース解析。実行テストなし。

## Audit #767 — pearsonTest clamps CDF-one observations into the last class
- 対象: `src/htest/normalityTests.ts` SHA `5af37c355b8fd52a9168fe5edac16ac9a8bca83f` の `pearsonTest()`。
- Issue [#276](https://github.com/numero-uno-jpn/rStats.js/issues/276)。再現: `const x=[...Array(99).fill(0),1e6]; pearsonTest(x)`。標準化外れ値は約9.95で `pnorm(z)` が1に丸められる。現行 `Math.min(k, floor(1+k*p))` はk+1を最終クラスkへ押し込み、nortest/Rの `findInterval` + `tabulate(...,nbins=k)` が落とす観測を加算する。静的ソース解析。実行/R比較なし。
## Audit #766 — qansariR returns the maximum quantile for NaN probability
- 対象: `src/htest/core/ansari.ts` SHA `50932adf99cd27e98433c2a4ff7e40ced9055d14` の `qansariR()`。
- Issue [#277](https://github.com/numero-uno-jpn/rStats.js/issues/277)。再現: `qansariR(NaN,2,2)`。pの検証がなく、比較 `s >= NaN` は常にfalseとなるため、累積確率の探索が一度も成立せず、最後のfallbackで最大統計量を返す。確率範囲を検証し、NaNを返すか一貫した例外にすべき。静的ソース解析。実行テストなし。


## Audit #768 — fisherTest truncates fractional Monte Carlo B but reports the untruncated value
- 対象: `src/htest/fisherTest.ts` SHA `c90cc3b96af152c34f0a2396fad60ecda9d5d32a`。
- Issue [#278](https://github.com/numero-uno-jpn/rStats.js/issues/278)。再現: `fisherTest([[8,2,1],[1,7,3],[2,1,9]],{simulatePValue:true,B:2.5})`。検証はBの整数性を確認せず、実際の反復回数は `Math.trunc(B)=2`、p値分母は3だが、method文字列は2.5 replicatesと報告する。chisqTestのB検証と同様に整数を要求すべき。静的ソース解析。実行テストなし。

## Audit #769 — poissonTest rejects zero exposure despite documenting it as supported
- 対象: `src/htest/poissonTest.ts` SHA `61c2c6a882fc0672e73fe45b5a547b2494b4e444`。
- Issue [#279](https://github.com/numero-uno-jpn/rStats.js/issues/279)。再現: `poissonTest(0,{T:0})` および `poissonTest(1,{T:0})`。OptionsのTはnonnegativeと記載され、実装コメントもRがT=0を受け入れると説明する一方、検証は `t>0` を要求し、rate計算前に拒否する。静的ソース/契約整合性監査。実行/R比較なし。

## Audit #770 — jonckheereTest loses upper-tail p-values by subtracting the lower tail from one
- 対象: `src/htest/trendTests.ts` SHA `5dcd1d74fbe03a551c66a352b68b004d73cd52fb` の `jonckheereTest()`。
- Issue [#280](https://github.com/numero-uno-jpn/rStats.js/issues/280)。再現: `x=Array.from({length:101},(_,i)=>i+1)`、`g=[...Array(34).fill(1),...Array(34).fill(2),...Array(33).fill(3)]`、`jonckheereTest(x,g,{alternative:"increasing"})`。101観測でnormal approximationとなり、完全な順序付けでzが大きく正になる。現行 `upper=1-pnorm(z)` は下側確率が1に丸まると0を返す。上側確率を直接 `pnorm(z,{lowerTail:false})` で計算すべき。静的数値解析。実行テストなし。

## Audit #771 — cohensD and hedgesG ignore paired=true when y is missing
- 対象: `src/htest/effectSize.ts` SHA `cfdbd3c1ccf7623b616ace1fe94c54f49e110df3` の `standardizedDifference()`。
- Issue [#281](https://github.com/numero-uno-jpn/rStats.js/issues/281)。再現: `cohensD([1,2,3],undefined,{paired:true})` および `hedgesG([1,2,3],undefined,{paired:true})`。`ys===undefined || paired` の分岐内で、yがない場合はone-sample経路を選び、paired指定を無視してxをmuと比較する。paired=trueなら第二標本を要求すべき。静的ソース解析。実行テストなし。

## Audit #772 — exact mantelhaenTest accepts unsafe counts and attempts impossible support allocation
- 対象: `src/htest/mantelhaenTest.ts` SHA `669a040db7481c9aad8d0da633a4e73f333b2488`、`src/htest/core/mantelhaen.ts` SHA `4b5a26bfeefa86028d47ad56711bfb92e4556b12`。
- Issue [#282](https://github.com/numero-uno-jpn/rStats.js/issues/282)。再現: `mantelhaenTest([[[1e20,1e20],[1e20,1e20]],[[1,1],[1,1]]],{exact:true})`。`Number.isInteger(1e20)` はtrueでexact分岐を通過するが、最初の層の超幾何分布support長は約1e20となり、`stratumDensity()` の `new Float64Array(hi-lo+1)` で割当不能となる。safe-integerとsupport長の事前制限が必要。静的ソース/配列長解析。実行テストなし。


## Audit #773 — pivoted Cholesky ignores the tolerance at the first pivot
- 対象: `src/linalg/chol.ts` SHA `5444cb2c0f790e8a231c515dead77c069d822e3a` の `pstf2()`。
- Issue [#283](https://github.com/numero-uno-jpn/rStats.js/issues/283)。再現: `chol([[1]],{pivot:true,tol:2})`。最大pivot=1はtol=2以下だが、`ajj <= dstop` 判定が `j>0` の分岐内にあるため最初のpivotを因数分解し、rank=1を返す。初回pivotにも停止条件を適用すべき。静的ソース解析。実行/LAPACK比較なし。

## Audit #774 — Quade test uses complete-row count instead of original block count
- 対象: `src/htest/rankTests.ts` SHA `e40c83f8cb535b12f41e0161875114ce1021807c` の `quadeTest()`。
- Issue [#284](https://github.com/numero-uno-jpn/rStats.js/issues/284)。再現:
  ```ts
  quadeTest([[1,2,3],[2,4,3],[NaN,NaN,NaN]]);
  ```
  現行はcompleteRows後の2行をbとするが、Rのmatrix版は欠損行除去前のblock level数3をBの分母、F倍率、分母自由度に使う。Rの `quade.test` ソースと静的比較。実行/Rランタイム比較なし。

## Audit #775 — chisqTest contingency simulation omits the grand-total allocation limit
- 対象: `src/htest/chisqTest.ts` SHA `8b0426c29232aa6d013befd6564e281fc705cc8d`、`src/random/r2dtable.ts` SHA `3e5a15a95b5a73e04ec337d441a2976ecbf88583`。
- Issue [#285](https://github.com/numero-uno-jpn/rStats.js/issues/285)。再現: `chisqTest([[1e9,1e9],[1e9,1e9]],{simulatePValue:true,B:1})`。各marginは2e9だがgrand totalは4e9。chisqTestの `simulateTables()` は上限検証なしで `logFactorialTable(total)` を呼び、32GB超のFloat64Array確保を試みる。公開 `r2dtable()` はtotal>2147483647を拒否する。静的ソース/メモリ量解析。実行なし。

## Audit #776 — fisherTest simulation omits the grand-total allocation limit
- 対象: `src/htest/fisherTest.ts` SHA `c90cc3b96af152c34f0a2396fad60ecda9d5d32a`、`src/random/r2dtable.ts` SHA `3e5a15a95b5a73e04ec337d441a2976ecbf88583`。
- Issue [#286](https://github.com/numero-uno-jpn/rStats.js/issues/286)。再現: `fisherTest([[1e9,1e9],[1e9,1e9],[1e9,1e9]],{simulatePValue:true,B:1})`。個々のcellは32-bit上限内だがgrand totalは6e9。 `fisherSimulated()` が無制限に `logFactorialTable(total)` を作成しようとする。r2dtableの上限チェックを適用すべき。静的ソース/メモリ量解析。実行なし。

## Audit #777 — chisqTest goodness-of-fit simulation materializes all B×n draws
- 対象: `src/htest/chisqTest.ts` SHA `8b0426c29232aa6d013befd6564e281fc705cc8d`。
- Issue [#287](https://github.com/numero-uno-jpn/rStats.js/issues/287)。再現: `chisqTest([1e9,1e9],{simulatePValue:true,B:1})`。 `simulateGoodnessOfFit()` は `sampleInt` に `size=Math.trunc(B*n)` を渡し、20億件のdraw配列を一括materializeする。実行可能なallocation上限またはstreaming方式が必要。静的allocation経路解析。実行なし。

## Audit #778 — chisqTest factor overload rejects a single-level factor
- 対象: `src/htest/chisqTest.ts` SHA `8b0426c29232aa6d013befd6564e281fc705cc8d` の `chisqFactors()`。
- Issue [#288](https://github.com/numero-uno-jpn/rStats.js/issues/288)。再現: `chisqTest(["a","a","a","a"],["u","u","v","v"])`。factor vector版はrow/column level数が2未満だと拒否する一方、matrix版は1行/1列をgoodness-of-fitへ渡す。Rもfactor vectorからtableを作成後に同じ1次元処理へ進む。静的ソース/R実装比較。実行テストなし。

## Audit #779 — binomTest rejects the zero-total two-count input
- 対象: `src/htest/binomTest.ts` SHA `4e514e3164c1f852b325a5a04b099effc73d218c`。
- Issue [#289](https://github.com/numero-uno-jpn/rStats.js/issues/289)。再現: `binomTest([0,0])`。tuple形式は成功数と失敗数からnを計算するが、ns===0で例外にする。Rの `binom.test(c(0,0))` は処理を続けp=1、CI=[0,1]、estimate=NaNを返す。scalar x,n形式のn>0制約とは分けるべき。Rソース静的比較。実行テストなし。

## Audit #780 — binomTest rejects confidence levels at 0 and 1
- 対象: `src/htest/binomTest.ts` SHA `4e514e3164c1f852b325a5a04b099effc73d218c` の `binomTestCounts()`。
- Issue [#290](https://github.com/numero-uno-jpn/rStats.js/issues/290)。再現: `binomTest(3,10,{confLevel:0})` および `binomTest(3,10,{confLevel:1})`。 `checkConfLevelOpen()` は開区間を要求するが、Rの `binom.test()` は0と1を許容する閉区間検証。静的ソース比較。実行テストなし。

## Audit #781 — chisqTest goodness-of-fit rejects Infinity contrary to its documented behavior
- 対象: `src/htest/chisqTest.ts` SHA `8b0426c29232aa6d013befd6564e281fc705cc8d`。
- Issue [#291](https://github.com/numero-uno-jpn/rStats.js/issues/291)。再現: `chisqTest([Infinity,1])`、`chisqTest([[Infinity,1]])`、`chisqTest([[1],[Infinity]])`。ファイル先頭コメントではvector/1行1列matrixのInfを許容しNaN統計量になると記載するが、`goodnessOfFit()` のguardが `v<Infinity` を要求して例外にする。多次元contingency tableの有限値検証とは分離すべき。Rソース静的比較。実行テストなし。

## Audit #782 — fisherTest rejects confidence levels at 0 and 1
- 対象: `src/htest/fisherTest.ts` SHA `c90cc3b96af152c34f0a2396fad60ecda9d5d32a`。
- Issue [#292](https://github.com/numero-uno-jpn/rStats.js/issues/292)。再現: `fisherTest([[3,1],[1,3]],{confLevel:0})` および `fisherTest([[3,1],[1,3]],{confLevel:1})`。2×2 branchは `0<confLevel<1` を要求するが、Rの `fisher.test()` は0と1を許容する。端点alphaのodds-ratio CIも極限値を返すべき。Rソース静的比較。実行テストなし。



## Audit #783 — formula expansion rejects the valid degree-one power
- 対象: `src/models/formula.ts` SHA `2dff14125553b5a7a41fb58339faaf03588cd2ed` の `expandRhs()`。
- Issue [#293](https://github.com/numero-uno-jpn/rStats.js/issues/293)。再現: `termsOf(parseFormula("y ~ (a + b)^1"), ["y", "a", "b"])`。Rのformula powerは次数1なら主効果a,bを展開するが、現行は `p=Math.trunc(1)` の後に `p>=2` を要求して例外。静的ソース/式展開仕様の監査。実行/R比較なし。

## Audit #784 — infinite formula power causes a non-terminating expansion loop
- 対象: `src/models/formula.ts` SHA `2dff14125553b5a7a41fb58339faaf03588cd2ed` の `expandRhs()`。
- Issue [#294](https://github.com/numero-uno-jpn/rStats.js/issues/294)。再現: `termsOf(parseFormula("y ~ (a + b)^1e999"), ["y", "a", "b"])`。数値トークン1e999はInfinityとなり、`Math.trunc(Infinity)` もInfinity。 `p>=2` を通過し、`for (k=1; k<p; k++)` が終了しない。指数の有限性と展開可能な上限をループ前に検証すべき。静的ソース解析。実行なし（非停止入力）。

## Audit #785 — aovEz overwrites a between factor named y_
- 対象: `src/models/aovEz.ts` SHA `5337523c4fe1358f6b74b3a67b201406710084fa` の `betweenOnly()`。
- Issue [#295](https://github.com/numero-uno-jpn/rStats.js/issues/295)。再現: `aovEz(data,{id:"id",dv:"score",between:["y","y_"]})`（yとy_をそれぞれ2水準とする8 subjectの完全要因配置）。内部応答名がy_に固定され、`{...bdata,[dvName]:...}` で元のy_因子列を上書きする。要求された二因子モデルではなく、y_の因子情報を失った式をfitする。衝突しない内部名を選ぶべき。静的ソース解析。実行テストなし。

## Audit #786 — aovEz silently collapses duplicate between-factor names
- 対象: `src/models/aovEz.ts` SHA `5337523c4fe1358f6b74b3a67b201406710084fa` の `aovEz()` 入力処理と `betweenOnly()`。
- Issue [#296](https://github.com/numero-uno-jpn/rStats.js/issues/296)。再現: `aovEz(data,{id:"id",dv:"score",between:["A","A"]})`。between配列の一意性を検証せず、式 `A * A` はterm deduplicationによりAだけになるため、二重指定が一因子モデルとして黙ってfitされる。between/within双方で重複変数名を拒否すべき。静的ソース解析。実行テストなし。

## Audit #787 — lmer misclassifies an infinite response as an exact fixed-effects fit
- 対象: `src/models/lmer.ts` SHA `86b47afc85f643ae904cc4c884ff8d109b3a42e2` の `lmerWithCriterion()`。
- Issue [#297](https://github.com/numero-uno-jpn/rStats.js/issues/297)。再現: `lmer("y ~ 0 + (1 | g)",{y:[Infinity,1,2,3,4,5,6,7],g:["a","a","b","b","c","c","d","d"]})`。固定効果列が0本なので `yc=original.y`。 `ycMax=Infinity` と `maxAbs(original.y)=Infinity` から `Infinity <= EXACT_FIT * Infinity` がtrueとなり、非有限応答を「fixed effectsの列空間にある完全適合」と誤分類してEXACT_FIT_ERRORを投げる。有限性検証をexact-fit判定より前に行うべき。静的IEEE-754/制御フロー解析。実行テストなし。

## Audit #788 — lmer does not validate infinite random-effect-only covariates
- 対象: `src/models/mixedStructure.ts` SHA `40803660d304825257e6b57c034240b328a366e9` のrandom-effects `lhsDesign` 構築。
- Issue [#298](https://github.com/numero-uno-jpn/rStats.js/issues/298)。再現: `lmer("y ~ 1 + (x | g)",{y:[1,2,3,4,5,6],x:[1,2,Infinity,4,5,6],g:["a","a","b","b","c","c"]})`。xはrandom-effect LHSにのみ現れ、固定効果QRのfinite checkを通らない。 `lhsDesign.x` にInfinityが残り、Z/sparse factorizationへ流れる。random-effect designも疎行列構築前に有限性検証すべき。静的ソース解析。実行テストなし。

## Audit #789 — aov Error-strata path passes an infinite response into double-double least squares
- 対象: `src/models/aovStrata.ts` SHA `b34c319610712397b87a4064057c338541027846`。
- Issue [#299](https://github.com/numero-uno-jpn/rStats.js/issues/299)。再現: `aov("y ~ A + Error(id)",{id:["s1","s1","s2","s2","s3","s3","s4","s4"],A:["a","b","a","b","a","b","a","b"],y:[1,2,3,4,5,6,Infinity,8]})`。Error strata経路はmodel frameから取得したyをfinite checkせず `scaleToUnit([y])` と `ddLeastSquaresMulti()` に渡す。通常lm経路のようにNA/NaN/Inf in yを明示的に拒否すべき。静的ソース解析。実行テストなし。

## Audit #790 — lmerHypotheses absolute ROW_ZERO threshold drops rescaled Type III terms
- 対象: `src/models/lmerHypotheses.ts` SHA `ca9ee25511b1f8c0b6324b562d6742124e029514` のType III列選択。
- Issue [#300](https://github.com/numero-uno-jpn/rStats.js/issues/300)。再現: `y ~ 0 + x + z + (1 | g)` でx,zをそれぞれ1e10倍した固定効果設計。 `L1=zapsmall(...)` は行列全体の最大値に対して相対的に丸めるため約1e-10の有効係数を保持するが、その後の `sum(abs(L1[,j])) > ROW_ZERO`（ROW_ZERO=1e-8）の絶対閾値で全列を落とし、Type III仮説が空になる。予測変数の単位変更だけで有効な効果検定が消えるため、相対閾値またはzapsmall結果のみを用いるべき。静的数値/ソース解析。実行テストなし。

## Audit #791 — jointDenDF overflows the mean of equal large finite dfs
- 対象: `src/models/lmerTest.ts` SHA `19b8d37ae6c5f9a042722c005d840e9ecf460d43` の `jointDenDF()`。
- Issue [#301](https://github.com/numero-uno-jpn/rStats.js/issues/301)。再現: `jointDenDF([1e308,1e308])`。equal-df fast pathがreduceで先に加算しInfinityとなり、平均もInfinityを返す。正しい平均は有限の1e308。等値ケースなら共通値を返すか、各値を先にlengthで割って加算すべき。Issue #58のcontrast quadratic-form overflowとは別に、有限な入力dfだけで発生する平均演算のoverflow。静的IEEE-754解析。実行テストなし。

## Audit #792 — lm accepts positive infinite weights in a zero-column model
- 対象: `src/models/lm.ts` SHA `95e161942a868624c1606925bfe00a1725ccc9f0` のmatrix/formula weight validationと`fitLmUnit()`。
- Issue [#302](https://github.com/numero-uno-jpn/rStats.js/issues/302)。再現: `lm([[],[],[]],[1,2,3],{intercept:false,weights:[Infinity,1,1]})`。weight検証は負値とNaNのみを扱い、+Infinityを保持する。列0本のモデルではQRのX finite checkを通り、無限重みがweighted residual/RSS/標準誤差へ流れ得る。保持する全weightにNumber.isFiniteを要求すべき。静的ソース解析。実行テストなし。


## Audit #793 — chisqTest rescaleP overflows while normalizing finite probability weights
- 対象: `src/htest/chisqTest.ts` SHA `8b0426c29232aa6d013befd6564e281fc705cc8d` の `goodnessOfFit()` / `ddSum()`。
- Issue [#303](https://github.com/numero-uno-jpn/rStats.js/issues/303)。再現: `chisqTest([1,1],{p:[1e308,1e308],rescaleP:true})`。有限の重み合計がInfinityとなり、正規化で全確率が0になる。本来は[0.5,0.5]、期待度数[1,1]、統計量0、p=1。最大値で先にスケーリングしてから正規化すべき。静的IEEE-754/ソース解析。実行テストなし。

## Audit #794 — normality tests return finite floor p-values for non-finite observations
- 対象: `src/htest/normalityTests.ts` SHA `5af37c355b8fd52a9168fe5edac16ac9a8bca83f` の `standardized()` と `adTest()` / `cvmTest()` / `pearsonTest()`。
- Issue [#304](https://github.com/numero-uno-jpn/rStats.js/issues/304)。再現: `const x=[1,2,3,4,5,6,7,Infinity]; adTest(x); cvmTest(x); pearsonTest(x);`。非有限値があると標準化結果を全NaNにするが、AD/CvMの区分的p値計算が比較をすべてfalseとして固定下限p値(3.7e-24 / 7.37e-10)を返す。Pearsonは全クラス0件のまま統計量8、有限p値を計算する。NaN欠損を除外した後にInfinityを明示的に拒否すべき。静的ソース/IEEE-754解析。実行テストなし。


## Audit #795 — pearsonTest allocates an unbounded class array
- 対象: `src/htest/normalityTests.ts` SHA `5af37c355b8fd52a9168fe5edac16ac9a8bca83f` の `pearsonTest()`。
- Issue [#305](https://github.com/numero-uno-jpn/rStats.js/issues/305)。再現: `pearsonTest([1,2,3,4,5,6,7,8],{nClasses:2**31})`。整数/自由度の検証は通過し、2,147,483,648要素の配列をfillしようとする。巨大なクラス数に対する割当上限を設け、割当前に拒否すべき。静的ソース解析。巨大割当・実行テストなし。

## Audit #796 — pAdjust Hommel performs quadratic work for an empty p-value vector
- 対象: `src/htest/pAdjust.ts` SHA `a9d8482a48313bc1c4874b7e2e8e3324fe3d36b3` の `pAdjust()` / `hommel()`。
- Issue [#306](https://github.com/numero-uno-jpn/rStats.js/issues/306)。再現: `pAdjust([],{method:"hommel",n:2**32})`。非NaN p値が0件でも明示的nを受け入れ、Hommel経路がn個の1を配列確保しようとしてJSの配列長上限で失敗する。n=1e6でも出力が空なのにO(n²)ループを行う。非NaN p値が0件なら補正処理前に空結果を返すべき。静的ソース解析。巨大割当・実行テストなし。


## Audit #797 — ksTest exact override bypasses the default matrix-size limit
- 対象: `src/htest/ksTest.ts` SHA `b126cf4b2b6797201bb9d23c2e89421753d7ee3c` と `src/htest/core/kolmogorov.ts` SHA `7493b4af3b90843b8ad78eae718a6a1ac65f4ff3`。
- Issue [#307](https://github.com/numero-uno-jpn/rStats.js/issues/307)。再現: `const x=Array.from({length:10000},(_,i)=>i+1); ksTest(x,()=>0.5,{exact:true})`。D=0.5でexactルーチンのm=10001となり、100,020,001要素(約800MB)の密行列を確保して行列累乗する。既定のn<100閾値は明示exact指定で迂回できるが、計算量/メモリの上限がない。実行可能性を事前評価し、上限超過を拒否または近似法へ切り替えるべき。静的ソース解析。巨大割当・実行テストなし。

## Audit #798 — ansariTest exact override permits unbounded dynamic-programming storage
- 対象: `src/htest/ansariTest.ts` SHA `9f13bb6d406d4f36761a562aed8bb17c0ce52db4` と `src/htest/core/ansari.ts` SHA `50932adf99cd27e98433c2a4ff7e40ced9055d14`。
- Issue [#308](https://github.com/numero-uno-jpn/rStats.js/issues/308)。再現: `const x=Array.from({length:1000},(_,i)=>2*i+1); const y=Array.from({length:1000},(_,i)=>2*i+2); ansariTest(x,y,{exact:true})`。同順位がないためexact経路に入り、N=2000、maxSum≈1,001,000、P/Q各々が約1001×1,001,001個のFloat64要素(約8GB)を確保する。既定のm,n<50閾値をexact指定で迂回できるが、DP状態のメモリ/計算量上限がない。割当前に安全な状態数上限を設けるべき。静的ソース解析。巨大割当・実行テストなし。


## Audit #799 — kappa2 accepts a single complete rating pair
- 対象: `src/htest/agreement.ts` SHA `435f225cc5d16a9d17207c2ebd1b7fd18bdb0386` の `kappa2()`。
- Issue [#309](https://github.com/numero-uno-jpn/rStats.js/issues/309)。再現: `kappa2([[1,2]])`。n=1でunweighted kappaの点推定値は0だが、分散式は0となり、z統計量とp値がNaNになる。兄弟関数kappamFleiss/iccは2 subjects以上を要求する。2組以上の完全ペアを要求すべき。静的ソース/数式解析。実行テストなし。

## Audit #800 — cronbachAlpha accepts a one-subject matrix
- 対象: `src/htest/agreement.ts` SHA `435f225cc5d16a9d17207c2ebd1b7fd18bdb0386` の `cronbachAlpha()`。
- Issue [#310](https://github.com/numero-uno-jpn/rStats.js/issues/310)。再現: `cronbachAlpha([[1,2]])`。項目数k>=2だけを検証し、被験者数nは検証しない。n=1では標本共分散/相関が分母n-1=0で未定義のままcov/cor/solveへ進む。完全データ2 subjects以上を先に要求すべき。静的ソース解析。実行テストなし。

## Audit #801 — zero effect leaves power-versus-sample-size curves flat without a precheck
- 対象: `src/htest/power.ts` SHA `5950a5e498272e8ae0b5a581e849477eb287c349` の `powerTTest()` / `powerPropTest()` / `powerAnovaTest()`。
- Issue [#311](https://github.com/numero-uno-jpn/rStats.js/issues/311)。再現: `powerTTest({delta:0,sd:1,power:0.8})`; `powerPropTest({p1:0.5,p2:0.5,power:0.8})`; `powerAnovaTest({groups:3,betweenVar:0,withinVar:1,power:0.8})`。それぞれ効果差0によりnを変えてもpowerが一定で、指定powerへ達するrootが存在しないのにunirootを呼び、一般的なbracketing errorとなる。root探索前に効果0/識別不能を検出して説明的なエラーにすべき。静的ソース/数式解析。実行テストなし。

## Audit #802 — powerPropTest sends zero-width endpoint intervals to uniroot
- 対象: `src/htest/power.ts` SHA `5950a5e498272e8ae0b5a581e849477eb287c349` の `powerPropTest()` と `src/numerics/integrate.ts` の `uniroot()`。
- Issue [#312](https://github.com/numero-uno-jpn/rStats.js/issues/312)。再現: `powerPropTest({n:50,p2:0,power:0.8})`; `powerPropTest({n:50,p1:1,power:0.8})`。確率0/1は入力検証を通るが、p1探索区間[0,p2]またはp2探索区間[p1,1]が一点となり、unirootのlower<upper検証で即時失敗する。解なしを事前判定し、対象の説明的な警告/エラーを返すべき。静的ソース解析。実行テストなし。


## Audit #803 — onewayTest Welch path propagates a zero-variance group's infinite weight
- 対象: `src/htest/onewayTest.ts` SHA `f98a4ccac5bcdb527f738aca3479aa6eaf600a8a` の `onewayTest()` Welch branch。
- Issue [#313](https://github.com/numero-uno-jpn/rStats.js/issues/313)。再現: `onewayTest([[1,1,1],[2,3,4]])`。第一群の標本分散0から重みni/vi=Infinityとなり、重み正規化Infinity/InfinityがNaN。第二群は分散1なので全群定数のケースではない。Welch統計量の零分散極限を処理するか、明示的に入力/解析不可を通知すべき。静的ソース/数式解析。実行テストなし。

## Audit #804 — tTest constant-data guard misses an exactly zero-valued sample
- 対象: `src/htest/tTest.ts` SHA `0442511bfdd24bede27433c5e32d520d2f073d83` の `tTest()`。
- Issue [#314](https://github.com/numero-uno-jpn/rStats.js/issues/314)。再現: `tTest([0,0])`; `tTest([0,0],[0,0])`; `tTest([1,1],[1,1],{paired:true})`。標準誤差0かつ平均0のときガードは `0 < 10*EPSILON*0` となりfalse。t=0/0でNaN統計量/p値を返す。SE===0を平均相対閾値と独立に扱うべき。静的ソース/数式解析。実行テストなし。

## Audit #805 — TukeyHSD does not guard insufficient residual degrees of freedom
- 対象: `src/htest/aov.ts` SHA `9ce3aa388e5d2200fd75c751d6c69660d0e11648` と `src/distributions/tukey.ts` SHA `dba1a8367d48376d11b39693737a9df82c185611`。
- Issue [#315](https://github.com/numero-uno-jpn/rStats.js/issues/315)。再現: `TukeyHSD([[1],[2]])` (df=0)、`TukeyHSD([[1,2],[3]])` (df=1)。TukeyHSDは2群以上だけを確認し、df=N-kを検査せずqtukeyへ渡す。qtukeyのvalidParamsはdf>=2を要求するため、比較結果のCI/pAdjがNaNになる。残差自由度2以上を事前検証すべき。静的ソース解析。実行テストなし。

## Audit #806 — corTest exact Kendall override has unbounded inversion-table allocation and work
- 対象: `src/htest/cor.ts` SHA `7ba191007daff12c1e981c2dca1be6f006293e9c` の `corTestSamples()` / `kendallCdf()`。
- Issue [#316](https://github.com/numero-uno-jpn/rStats.js/issues/316)。再現: `const n=10000; const x=Array.from({length:n},(_,i)=>i); const y=[...Array.from({length:n/2},(_,i)=>i+n/2),...Array.from({length:n/2},(_,i)=>i)]; corTest(x,y,{method:"kendall",exact:true})`。無同順位のためexactに入り、観測反転数の小さい側c≈24,995,000でFloat64Array(c+1)≈200MB、さらにn反復のDP更新。既定n<50をexact:trueで迂回でき、計算量/割当上限がない。事前に状態数と仕事量を評価すべき。静的ソース解析。巨大割当・実行テストなし。

## Audit #807 — propTrendTest retains infinite scores in weighted regression
- 対象: `src/htest/trendTests.ts` SHA `5dcd1d74fbe03a551c66a352b68b004d73cd52fb` の `propTrendTest()`。
- Issue [#317](https://github.com/numero-uno-jpn/rStats.js/issues/317)。再現: `propTrendTest([1,2,3],[10,10,10],[1,Infinity,3])`。rows抽出はscoreのNaNのみを除外しInfinityを保持する。加重score平均がInfinity、中心化したInfinity-InfinityがNaNとなり統計量/p値へ伝播。非欠損scoreは有限値を要求すべき。静的ソース解析。実行テストなし。

## Audit #808 — propTrendTest divides by zero when all retained scores are identical
- 対象: `src/htest/trendTests.ts` SHA `5dcd1d74fbe03a551c66a352b68b004d73cd52fb` の `propTrendTest()`。
- Issue [#318](https://github.com/numero-uno-jpn/rStats.js/issues/318)。再現: `propTrendTest([1,2,3],[10,10,10],[5,5,5])`。全scoreが5なので中心化scoreは全て0、sxx=0かつsxy=0、検定統計量0/0=NaN。少なくとも2つの異なる有限scoreがあることを検証すべき。静的ソース/数式解析。実行テストなし。

## Audit #809 — propTrendTest creates infinite weights when the pooled proportion is 0 or 1
- 対象: `src/htest/trendTests.ts` SHA `5dcd1d74fbe03a551c66a352b68b004d73cd52fb` の `propTrendTest()`。
- Issue [#319](https://github.com/numero-uno-jpn/rStats.js/issues/319)。再現: `propTrendTest([0,0,0],[10,10,10])`; `propTrendTest([10,10,10],[10,10,10])`。pooled p=0または1で各重みni/(p(1-p))がInfinity。重み和もInfinityとなり、加重平均Infinity/InfinityからNaNが返る。境界比例を重み計算前に検出し、退化ケースとして明示的に扱うべき。静的ソース/数式解析。実行テストなし。

## Audit #810 — brunnerMunzelTest accepts a singleton group despite its n−1 variance denominator
- 対象: `src/htest/brunnerMunzelTest.ts` SHA `3809905d6b8726a9b01afaf75deb0cbeb3082cac` の `brunnerMunzelTest()`。
- Issue [#320](https://github.com/numero-uno-jpn/rStats.js/issues/320)。再現: `brunnerMunzelTest([1],[2,3])`。各群最低1件のみを要求するが、placement variance helperは分散和をr.length-1で除す。n1=1で0除算となりNaNが統計量/自由度/p値へ伝播。各群2件以上を要求すべき。静的ソース/数式解析。実行テストなし。

## Audit #811 — jonckheereTest exact override allows unbounded distribution convolution work
- 対象: `src/htest/trendTests.ts` SHA `5dcd1d74fbe03a551c66a352b68b004d73cd52fb` の `jonckheereTest()` exact branch。
- Issue [#321](https://github.com/numero-uno-jpn/rStats.js/issues/321)。再現: 3群各200件、値は `0..199`, `1000..1199`, `2000..2199`、群ラベル各200件のa/b/cとして `jonckheereTest(x,g,{exact:true})`。nTotal=600でもexact:trueが既定n<=100の制限を迂回する。最初の2つのMann-Whitney分布の長さは80,001と40,001で、畳み込みの二重ループだけで約32億回の演算。割当・計算量を事前見積もりして実行可能性を制限すべき。静的ソース解析。大規模計算は実行していない。注: 既存Issue #142は3群以上のexact分布が依存するMW統計量を独立として畳み込む数学的誤りを扱う。本Issueは同じexact経路の別問題である資源上限欠如。

## Audit #812 — jonckheereTest returns a finite p-value when only one ordered group remains
- 対象: `src/htest/trendTests.ts` SHA `5dcd1d74fbe03a551c66a352b68b004d73cd52fb` の `orderedGroups()` / `jonckheereTest()`。
- Issue [#322](https://github.com/numero-uno-jpn/rStats.js/issues/322)。再現: `jonckheereTest([1,2,3],["a","a","a"])`。orderedGroupsが1群を返すが群数検証がなく、群間比較が0回でJT=0。exact分布dist=[1]のまま両側tailが1となり、比較不能な1群設計にp=1を返す。欠損処理後に2群以上を要求すべき。静的ソース解析。実行テストなし。


## Audit #813 — poissonTest greater-tail boundary loses the observed mass above 2^53
- 対象: `src/htest/poissonTest.ts` SHA `61c2c6a882fc0672e73fe45b5a547b2494b4e444` の1標本 `poissonTest()`。
- Issue [#323](https://github.com/numero-uno-jpn/rStats.js/issues/323)。再現: `const x = 2 ** 53; poissonTest(x, { r: x, T: 1, alternative: "greater" })`。`x - 1` がbinary64でxに丸められ、`P[X >= x]` の代わりに `P[X > x]` を計算し、観測点の確率質量を欠落させる。二側検定の上側tailでも同じ境界式を使う。静的ソース/IEEE-754解析。実行テストなし。

## Audit #814 — binomTest greater-tail boundary loses the observed mass above 2^53
- 対象: `src/htest/binomTest.ts` SHA `4e514e3164c1f852b325a5a04b099effc73d218c` と `src/distributions/binomial.ts` SHA `51f90bf317b121ff2a105d7deadb8ab2b4f553dc`。
- Issue [#324](https://github.com/numero-uno-jpn/rStats.js/issues/324)。再現: `const x = 2 ** 53; binomTest(x, 2 ** 54, { p: 0.5, alternative: "greater" })`。`xs - 1` がxsに丸められ、`P[X >= xs]` ではなく `P[X > xs]` を返す。平均点の確率質量(約3.3e-9)が欠落する。静的ソース/IEEE-754解析。実行テストなし。

## Audit #815 — poissonTest rate-ratio fallback forms 0 × Infinity
- 対象: `src/htest/poissonTest.ts` SHA `61c2c6a882fc0672e73fe45b5a547b2494b4e444` の `rateRatio()`。
- Issue [#325](https://github.com/numero-uno-jpn/rStats.js/issues/325)。再現: `poissonTest([0, 1], { T: [Number.MIN_VALUE, 1e308] })`。第2群rateがsubnormalでfallbackに入り、`(x1/x2) * (T2/T1)` が `0 * Infinity` となってNaNを返すが、真のrate ratioは厳密に0。静的ソース/IEEE-754解析。実行テストなし。

## Audit #816 — poissonTest expected-count fallback forms 0 × Infinity
- 対象: `src/htest/poissonTest.ts` SHA `61c2c6a882fc0672e73fe45b5a547b2494b4e444` の `expectedCount1()`。
- Issue [#326](https://github.com/numero-uno-jpn/rStats.js/issues/326)。再現: `poissonTest([1, 0], { r: 0, T: [Number.MIN_VALUE, 1e308] })`。直接計算の分母がsubnormalのためfallbackに入り、`1 + r * (T2/T1)` が `1 + 0 * Infinity = NaN`。帰無仮説rate ratioが0なので期待count1は0であるべきだが、parameterがNaNになる。静的ソース/IEEE-754解析。実行テストなし。

## Audit #817 — pgeom loses one trial when q + 1 is not representable
- 対象: `src/distributions/geometric.ts` SHA `852ad0a4361468ca591d281f6ac104e769eeb1be` の `pgeom1()` / `upper()`。
- Issue [#327](https://github.com/numero-uno-jpn/rStats.js/issues/327)。再現: `pgeom(2 ** 53, 0.5, { lowerTail: false, logP: true })`。`x+1` がxに丸められ、上側tailの指数が本来の `q^(x+1)` ではなく `q^x` となる。log確率でln(2)の差(確率2倍)が現れる。静的ソース/IEEE-754解析。実行テストなし。

## Audit #818 — ppois gives the wrong side of 0.5 at a large Poisson mean
- 対象: `src/distributions/poisson.ts` SHA `3c470e0755b167bd5a63a03f1f43072a04d90139` の `ppois1()` / `qpois1()`。
- Issue [#328](https://github.com/numero-uno-jpn/rStats.js/issues/328)。再現: `ppois(1e16, 1e16)`; `qpois(0.5, 1e16)`。`ppois` は約0.4999999987を返すが、Rでは約0.5000000027で0.5の反対側になる。結果として中央値のqpoisもずれる。差は現行ソースコメントにも記録されている。静的ソース確認。今回の実行/R比較なし。

## Audit #819 — flignerTest ranks a NaN deviation created by infinite observations
- 対象: `src/htest/rankTests.ts` SHA `e40c83f8cb535b12f41e0161875114ce1021807c`、`src/htest/groups.ts` SHA `d301964444f718a185397404de28343cc08138c5`、`src/internal/summary.ts` SHA `e4fc3bd652af3a00cf05b44389ddf58e590c4830`。
- Issue [#329](https://github.com/numero-uno-jpn/rStats.js/issues/329)。再現: `flignerTest([1, Infinity, 2, 3], ["a", "a", "b", "b"])`。第1群のmedianがInfinityとなり、`Infinity - Infinity` 由来のNaN偏差が発生する。flignerTestはそのままrank()へ渡すが、rank()の前提はNaNを含まない入力であり、NaNが通常の順位として扱われ、誤った有限統計量/p値を作る。静的ソース/JS比較意味解析。実行テストなし。

## Audit #820 — pretty can loop forever when shrinkSml is zero
- 対象: `src/descriptive/hist.ts` SHA `7e5ab4c0db2d80ac9ab1bf1e94423cf800f829b5` の `pretty()`。
- Issue [#330](https://github.com/numero-uno-jpn/rStats.js/issues/330)。再現: `pretty([0, 0], { shrinkSml: 0 })`。小range分岐でcが0、unit uも0、s=floor(0/0+rho)=NaNとなる。`while (!Number.isFinite(s*u)) s++` はNaNを増分してもNaNのため永久に終了しない。非正のshrinkSmlを事前拒否し、NaN状態のループを防ぐべき。静的制御フロー解析。非終了呼び出しは実行していない。

## Audit #821 — ecdf binary search overflows a signed 32-bit midpoint
- 対象: `src/descriptive/hist.ts` SHA `7e5ab4c0db2d80ac9ab1bf1e94423cf800f829b5` の `ecdf()`。
- Issue [#332](https://github.com/numero-uno-jpn/rStats.js/issues/332)。再現条件: 長さ `2**31 + 1` のFloat64Arrayを作成し、`ecdf(x)(0)` を評価する。`(lo + hi) >> 1` はsigned 32-bitへ変換されるためmidが負値となり、二分探索が誤った境界で終了する。通常の算術midpointへ変更するか、長さ上限を設けるべき。静的制御フロー解析。巨大配列は確保していない。

## Audit #822 — hist cellOf binary search overflows a signed 32-bit midpoint
- 対象: `src/descriptive/hist.ts` SHA `7e5ab4c0db2d80ac9ab1bf1e94423cf800f829b5` の `hist()` / `cellOf()`。
- Issue [#333](https://github.com/numero-uno-jpn/rStats.js/issues/333)。再現条件: 2^31を超える長さの厳密増加break配列を明示してhist()へ渡す。`(a + b) >> 1` がsigned 32-bitへ変換され、midが負値となり、cell searchが正しいbinを返さない。通常の算術midpointへ変更するか、明示break配列にも安全な長さ上限を設けるべき。静的制御フロー解析。巨大配列は確保していない。


## Audit #823 — weightedMean loses a representable residual signed weight in overflow fallback
- 対象: `src/descriptive/basic.ts` SHA `e12c8f8c91152f8d617cd05bf07ce512ef00856a` の `weightedMean()`。
- Issue [#334](https://github.com/numero-uno-jpn/rStats.js/issues/334)。再現: `weightedMean([1e308, 1e308, 1e308], [1e308, -1e308, 1e-308])`。全xが同一なので数学的な加重平均は1e308、重み合計は1e-308。しかし積の合計がInfinity−InfinityでNaNとなりfallbackへ入り、最大重み1e308で割ると第3重み1e-616が0へunderflow。scaled numerator/denominatorがともに0となりNaNを返す。符号付き重みの相殺残差を保持するスケーリングが必要。静的IEEE-754解析。実行なし。

## Audit #824 — phyper upper tail includes the observed mass when x + 1 rounds to x
- 対象: `src/distributions/hypergeometric.ts` SHA `803e35e8c2ccc11ce9ce702fa1328b060230fb4d` の `phyperRaw()` / `directTail()`。
- Issue [#335](https://github.com/numero-uno-jpn/rStats.js/issues/335)。再現: `const x = 2 ** 53; phyper(x, 2 ** 54, 2 ** 54, 2 ** 54, { lowerTail: false })`。`x+1` がxに丸められ、上側tailの開始点が本来のx+1ではなくxとなり、観測点の確率質量を誤って含める。母集団合計2^55、平均xは正確に表現可能で、欠落/余分な点質量も約8e-9と無視できない。静的IEEE-754解析。実行なし。

## Audit #825 — r2dtable permits a grand total requiring a multi-gigabyte factorial table
- 対象: `src/random/r2dtable.ts` SHA `3e5a15a95b5a73e04ec337d441a2976ecbf88583` の `r2dtable()` / `logFactorialTable()`。
- Issue [#336](https://github.com/numero-uno-jpn/rStats.js/issues/336)。再現: `r2dtable(1, [500_000_000, 500_000_000], [500_000_000, 500_000_000])`。合計10億は現行上限2^31−1以下だが、`logFactorialTable(total)` が約10億要素のFloat64Array、約8GBを割り当てる。実用的なメモリ上限を設定し、確保前に拒否すべき。静的割当解析。巨大確保は実行していない。

## Audit #826 — dmultinom silently rounds a finite total count above 2^53
- 対象: `src/distributions/multinomial.ts` SHA `2e02ad50cbde5e22cbd0146701533dc94fa344f7` の `dmultinom()`。
- Issue [#337](https://github.com/numero-uno-jpn/rStats.js/issues/337)。再現: `dmultinom([2 ** 53, 1], [0.5, 0.5], { size: 2 ** 53, log: true })`。厳密な度数合計は2^53+1だが、通常のnumber加算では2^53に丸められ、size検証を通過する。逐次二項分解でも後続カテゴリが合計から失われ、正しい対数確率 `log(N)-N*log(2)` に対して `log(N)` の項を欠く。有限だが整数として正確に表現できない合計を検出する必要。静的IEEE-754解析。実行なし。

## Audit #827 — plaplace ignores infinite quantile endpoints when location is infinite
- 対象: `src/distributions/laplace.ts` SHA `0d909d47a5569de221eca2f6ad4be46257a6c913` の `plaplace1()`。
- Issue [#338](https://github.com/numero-uno-jpn/rStats.js/issues/338)。再現: `plaplace(-Infinity, { mu: -Infinity })` は現在1、`plaplace(Infinity, { mu: Infinity })` は現在0。有限のlocationに対してCDFの端点は常にF(−Inf)=0、F(+Inf)=1だが、無限locationの分岐がqを見ずに固定値を返すため端点条件を破る。qの端点処理を無限location分岐より先に行うべき。静的制御フロー解析。実行なし。

## Audit #828 — tabulate skips the 2^31 bin limit when nbins is inferred
- 対象: `src/descriptive/table.ts` SHA `d6a292d4eb9f040528219f8202e2ad962cfc13e0` の `tabulate()`。
- Issue [#339](https://github.com/numero-uno-jpn/rStats.js/issues/339)。再現: `tabulate([2 ** 31])`。明示nbinsでは2^31以上を拒否するが、省略時は最大bin値からnbを推定した後に同じ上限検査を行わず、20億超の要素を持つ配列を割り当てようとする。推定後にも上限検査を適用すべき。静的割当解析。巨大確保は実行していない。

## Audit #829 — cut and findInterval use signed 32-bit binary-search midpoints
- 対象: `src/descriptive/table.ts` SHA `d6a292d4eb9f040528219f8202e2ad962cfc13e0` の `binCode()` / `findInterval()`。
- Issue [#340](https://github.com/numero-uno-jpn/rStats.js/issues/340)。再現条件: 長さ2^31+1の厳密増加Float64Arrayをbreakpointとして `findInterval([0], vec)` に渡す。`(lo+hi)>>1` のsigned 32-bit変換によりmidが負値となり、二分探索の不変条件が崩れる。同じ式を使うcut()も影響する。算術midpointへ変更するか長さ上限を設けるべき。静的制御フロー解析。巨大配列は未確保。

## Audit #830 — varimax overflows Kaiser row norms for finite large loadings
- 対象: `src/descriptive/factanal.ts` SHA `78015f198496bfd2c28321c541ff970a5cea7b96` のexport関数 `varimax()`。
- Issue [#341](https://github.com/numero-uno-jpn/rStats.js/issues/341)。再現: `varimax([[1e308, 0], [0, 1e308]])`。Kaiser行ノルム計算で有限値の二乗がInfinityとなり、正規化行がゼロになる。最後に0×Infinityを計算してNaN loadingsを返す。スケール付きsum-of-squaresでノルムを計算すべき。静的IEEE-754解析。実行なし。

## Audit #831 — mauchlyTest accepts a one-dimensional contrast space
- 対象: `src/models/mauchly.ts` SHA `0dae48405cd78c389dea9d31321ae7cd57b99d84` の `mauchlyTest()` / `mauchlyPValue()`。
- Issue [#342](https://github.com/numero-uno-jpn/rStats.js/issues/342)。再現: `mauchlyTest([[1], [2], [4], [8]])`。既定Mが1次元のためpp=1、Wはデータによらず1、カイ二乗自由度はpp(pp+1)/2−1=0。それでも検定結果オブジェクトを返してしまい、意味のある球面性検定にならない。pp>=2を要求すべき。静的自由度解析。実行なし。

## Audit #832 — lu returns non-finite factors instead of rejecting an infinite matrix
- 対象: `src/linalg/lu.ts` SHA `457aeee39e56df3f80e654c389a245807ccad55d` の `lu()`。
- Issue [#343](https://github.com/numero-uno-jpn/rStats.js/issues/343)。再現: `lu([[1, Infinity], [0, 1]])`。第1列の消去係数は0だが、後続更新で `1 - 0 * Infinity` がNaNとなり、分解成功のようにNaNを含む因子を返す。svd等と同様、非有限入力を消去前に拒否すべき。静的IEEE-754解析。実行なし。

## Audit #833 — lm scales weighted RSS back but leaves MSS on the scaled-weight scale
- 対象: `src/models/lm.ts` SHA `95e161942a868624c1606925bfe00a1725ccc9f0` の `fitLmUnit()`。
- Issue [#344](https://github.com/numero-uno-jpn/rStats.js/issues/344)。再現: `lm([1,2,3,4,5],[2,3,5,4,7],{weights:[4,4,4,4,4]})`。共通重み倍率はR²/Fを変えないが、MSSはscaleW後、RSSは2^kwでscale backされるため異なる単位で比を計算する。matrix/formula両経路に影響。ソース解析・IEEE-754単位追跡。Vitest/package runtime/R実行なし。

## Audit #834 — coxph Efron steps count event rows instead of integer case-weight replications
- 対象: `src/models/coxph.ts` SHA `77ddd4a9619494a8aaab02950668a3cc082dc0fd` の `evaluate()`。
- Issue [#345](https://github.com/numero-uno-jpn/rStats.js/issues/345)。再現: weighted `time=[1,1,2], status=[1,1,0], x=[[0],[1],[2]], weights=[2,1,1]` と、同じイベントを複製した `time=[1,1,1,2], status=[1,1,1,0], x=[[0],[0],[1],[2]]`。Efronのstep数はtotal event weight 3であるべきだが、実装はevent row数2を使う。R survivalの整数case-weight replication semanticsと不一致。ソース数式解析。Vitest/package runtime/R実行なし。

## Audit #835 — Gamma family AIC overflows the sum of finite prior weights
- 対象: `src/models/glmFamily.ts` SHA `6d7dc129d990b8724501ac59d4015562abe3e20c` の `familyAic()` Gamma branch。
- Issue [#346](https://github.com/numero-uno-jpn/rStats.js/issues/346)。再現: `w=1e308, t=1e-5, y=[40000,40000*(1+t)], mu=[40000,40000], dev=-2*w*(Math.log1p(t)-t)`。数学的weight合計2e308はdouble範囲外だが、dev/true weight sumは有限正値で、Gamma densityの加重和も有限にできる。通常加算のswはInfinity、dispersion=0となりshape Infinity/scale 0から非有限AICを生む。ソース/IEEE-754解析。Vitest/package runtime/R実行なし。

## Audit #836 — car Anova weighted TSS overflows although individual weights and sums of squares are finite
- 対象: `src/models/carAnova.ts` SHA `0b2fc663a6e4e933cc86fb80e7f67dcc4f84a4b8` の `Anova()` weighted TSS calculation。
- Issue [#347](https://github.com/numero-uno-jpn/rStats.js/issues/347)。再現: `lm([0,1,2,3,4],[1e-154,2e-154,1e-154,3e-154,1e-154],{weights:[1e308,1e308,1e308,1e308,1e308]})` 後に `Anova(fit,{type:2})`。各weightは有限でweighted RSS/TSSもdouble範囲内にできるが、sw/swy直接加算がInfinityとなりweighted meanとTSSがNaN、誤った残差SSエラーとなる。ソース/IEEE-754解析。Vitest/package runtime/R実行なし。

## Audit #837 — lm accepts a positive infinite weight in a zero-column model
- 対象: `src/models/lm.ts` SHA `95e161942a868624c1606925bfe00a1725ccc9f0` の `lmMatrix()` / `fitLmUnit()`。
- Issue [#348](https://github.com/numero-uno-jpn/rStats.js/issues/348)。再現: `lm([[],[],[]],[1,2,3],{intercept:false,weights:[Infinity,1,1]})`。入力検査は負weightのみを拒否し、zero-column時にはXwのfinite checkも発火しないため、sqrt(Infinity)*yが後段へ流れてNaN/Infinityを含むfitを返し得る。正の非有限weightをfit前に拒否すべき。ソース制御フロー解析。Vitest/package runtime/R実行なし。

## Audit #838 — glmSummary loses a finite user dispersion during response rescaling
- 対象: `src/models/glm.ts` SHA `4c39ee7305f3a2745885b9ded57699ea19bfd60c` の `glmSummary()` と同型のdispersion conversion consumers。
- Issue [#349](https://github.com/numero-uno-jpn/rStats.js/issues/349)。再現: `glm([0,1,2,3],[1e308,1e308,1e308,1e308],{family:'gaussian'})` の後に `glmSummary(fit,{dispersion:Number.MIN_VALUE})`。original-unit dispersionは有限だが、内部scaleへのldexp(d,-2*k)が0へunderflowし、dispersion/SEを0と返す。glmPredict、glmRstandard、glmCooksDistance、glmAnovaにも同じ変換形式がある。指数を分離して最終値を計算すべき。ソース/IEEE-754解析。Vitest/package runtime/R実行なし。

## Audit #839 — ANOVA response scale includes residuals from zero-weight rows
- 対象: `src/models/anovaSequential.ts` SHA `fb1bf352f9106fd3e79c9d03ee40773318b4e26c` の `responseScale()`。共有helperは`src/models/carAnova.ts`でも利用。
- Issue [#350](https://github.com/numero-uno-jpn/rStats.js/issues/350)。再現: `lm('y ~ x',{y:[1,2,4,3,1e308],x:[0,1,2,3,4]},{weights:[1,1,1,1,0]})` 後に `anova(fit)`。zero-weight最終行の巨大residualがk≈1023を選び、positive-weight effects/RSSの二乗がunderflowする。後段scaledRssはzero-weight行をskipするが、scale選択はskipしない。fit/ANOVAから除外される行はscale決定からも除外すべき。ソース/IEEE-754解析。Vitest/package runtime/R実行なし。

## Audit #840 — contr.poly fails to restore polynomial degree order after QR pivoting
- 対象: `src/models/modelMatrix.ts` SHA `9dbfb1a56cb3c730f9d5d5e0dc91da1ea14d0a8` の `polyContrasts()`。
- Issue [#351](https://github.com/numero-uno-jpn/rStats.js/issues/351)。再現: `contrastMatrix(Array.from({length:24},(_,i)=>'L'+(i+1)),'contr.poly')`。Vandermonde高次列がdefault QR toleranceで末尾へ移動すると、qrQはpivot orderを返すが、degree orderへ戻さず.L/.Q/.C/^4...を割り当てるため高次contrast名と実際の多項式次数がずれる。安定な直交多項式recurrenceかpivot restorationが必要。QR制御フロー/数値解析。Vitest/package runtime/R実行なし。

## Audit #841 — mergeTiedTimes binary-search midpoint wraps at 2^31 indices
- 対象: `src/models/tiedTimes.ts` SHA `229af071501c8dbc7bdcc0c03d503346ed227713` のcut-point二分探索。
- Issue [#352](https://github.com/numero-uno-jpn/rStats.js/issues/352)。再現条件: distinct finite timeが2^31+1件の配列。midpoint `(lo+hi+1)>>1` はsigned int32へ変換され、midが負値へwrapする。safe arithmetic midpointへ変更すべき。巨大配列は確保せず、JS演算規則と制御フローの静的解析。Vitest/package runtime/R実行なし。

## Audit #842 — aov Error() missing values produce misaligned model frames
- 対象: `src/models/aovStrata.ts` SHA `b34c319610712397b87a4064057c338541027846` の `aovStrataFit()`。
- Issue [#353](https://github.com/numero-uno-jpn/rStats.js/issues/353)。再現: `aov('y ~ treatment + Error(subject)',{y:[1,2,3,4,5,6],treatment:['A','A','B','B','A','B'],subject:['s1','s1',null,null,'s2','s2']})`。dtはtreatment/responseのみで6行を保持するが、deはError(subject)欠損2行を除外して4行となる。長さ不一致のerror columnsをdt.yの6行とddLeastSquaresMultiへ渡すため、undefined access/誤計算となる。全formula variablesを含む共通model frameでrow alignmentを保証すべき。ソース行対応解析。Vitest/package runtime/R実行なし。

## Audit #843 — Nelder-Mead loops forever when the initial parameter is infinite
- 対象: `src/optim/optim.ts` SHA `b0adf40e7b8433cd39111a835580a9a5b3b2108c` の `simplexSearch()` / `optim()`。
- Issue [#354](https://github.com/numero-uno-jpn/rStats.js/issues/354)。再現: `optim([Infinity],()=>0,{method:"Nelder-Mead"})`。finite objectiveでもinitialStep=Infinity、`Infinity+Infinity`はInfinityのままなので初期simplex vertexのwhile loopが終了しない。有限初期parameterのvalidationが必要。静的制御フロー解析。hang実行なし。

## Audit #844 — BFGS backtracking does not terminate for an infinite analytic gradient
- 対象: `src/optim/optim.ts` SHA `b0adf40e7b8433cd39111a835580a9a5b3b2108c` の `Scaled.g()` / `variableMetric()` / `backtrack()`。
- Issue [#355](https://github.com/numero-uno-jpn/rStats.js/issues/355)。再現: `optim([0],x=>x[0]**2,{method:"BFGS",gr:()=>[Infinity]})`。analytic gradientは有限性検証なし。方向-Infinity、line-search stepが0まで縮むと`0 * -Infinity = NaN`、`unchanged()`がfalseで無限loop。NaN gradientは逆にdescent判定をskipしconvergence=0で初期点を返す。静的call graph/IEEE-754解析。hang実行なし。

## Audit #845 — jacobian silently accepts callback output-dimension changes
- 対象: `src/numerics/deriv.ts` SHA `7a339332c11e4b55e6f35fb8f120c7fd2c92311d` の `jacobian()`。
- Issue [#356](https://github.com/numero-uno-jpn/rStats.js/issues/356)。再現: `jacobian(x=>x[0]===1?[1]:[],[1])`。基準点の出力は1要素、perturbed pointsは0要素だが長さ検査なしでundefined差分を計算しNaN matrixを返す。逆にperturbed resultの追加要素も黙って無視する。各callback結果のdimension一致を検証すべき。静的制御フロー解析。実行なし。

## Audit #846 — derivative APIs inconsistently propagate NaN callback results
- 対象: `src/numerics/deriv.ts` SHA `7a339332c11e4b55e6f35fb8f120c7fd2c92311d` のsimple `grad()`、`jacobian()`、`hessian()`。
- Issue [#357](https://github.com/numero-uno-jpn/rStats.js/issues/357)。再現: `jacobian(()=>[NaN],[0])`、`hessian(()=>NaN,[0])`、`grad(()=>NaN,[0],{method:"simple"})`。これらはNaNを結果配列へ直接格納する。一方Richardson `grad()`のみはNaN差分を検出してRangeErrorをthrowするためAPI間で挙動が不整合。NaN callback/difference quotientを共通に検出すべき。静的実装比較。実行なし。

## Audit #847 — Richardson extrapolation factor overflows for accepted iteration counts
- 対象: `src/numerics/deriv.ts` SHA `7a339332c11e4b55e6f35fb8f120c7fd2c92311d` の `extrapolate()`。
- Issue [#358](https://github.com/numero-uno-jpn/rStats.js/issues/358)。再現: `grad(x=>x[0],[1],{r:513})`。rは正整数のみ検査され513も受理。extrapolation factor `4**512`がInfinityとなり、更新式のInfinity/Infinityで結果NaN。比率形式などoverflowしない等価式、または安全なr上限が必要。静的binary64解析。実行なし。

## Audit #848 — finite d and x can produce an infinite Richardson step
- 対象: `src/numerics/deriv.ts` SHA `7a339332c11e4b55e6f35fb8f120c7fd2c92311d` の `steps()`。
- Issue [#359](https://github.com/numero-uno-jpn/rStats.js/issues/359)。再現: `grad(x=>x[0],[2],{d:1e308})`。dとxはそれぞれfiniteだが積がInfinity、h0=Infinityとなりcallbackを±Infinityで評価。有限なcallback `f(x)=x`でも差分Infinity/Infinity→NaNとなり「func returned NaN」と誤報。computed h0がfiniteかつpositiveか事前検証すべき。静的IEEE-754解析。実行なし。

## Audit #849 — ode accepts an infinite time and turns a zero derivative into NaN
- 対象: `src/numerics/ode.ts` SHA `8683b9df7e690f62a2090ce8e91fe87074b317ee` の `ode()`。
- Issue [#360](https://github.com/numero-uno-jpn/rStats.js/issues/360)。再現: `ode([0],[0,Infinity],()=>[0],[],{method:"euler"})`。time vectorのfinite validationなし、h=Infinity、state updateは`0+Infinity*0=NaN`。既存#211は有限time endpoints間の差分overflowであり、今回の再現は非有限time入力自体の未検証。非有限time/stepをstate update前に拒否すべき。静的IEEE-754解析。実行/deSolve比較なし。

## Audit #850 — periodic spline with one knot evaluates modulo a zero period
- 対象: `src/numerics/interp.ts` SHA `a88cdba04295b2e3fe72c39b2f2facaf1cceb059` の `cubicSpline()` / `evalCubic()`。
- Issue [#361](https://github.com/numero-uno-jpn/rStats.js/issues/361)。再現: `spline([0],[5],{method:"periodic",xout:[0]})`。1点入力は許され、periodicCoefはn<3でzero coefficientsを返すが、evalCubicのperiod=x[n-1]-x[0]=0、`(u-x[0])%period`がNaN。knotそのものもNaNになる。periodic methodの最低distinct knot数を検証するかconstant caseを定義すべき。静的制御フロー/IEEE-754解析。R/Vitest実行なし。

## Audit #851 — L-BFGS-B accepts fractional memory size and uses fractional workspace indices
- 対象: `src/optim/optim.ts` SHA `b0adf40e7b8433cd39111a835580a9a5b3b2108c`、`src/optim/lbfgsb.ts` SHA `fd14e53c5730a4162316a5cafe67d29526530b37`。
- Issue [#362](https://github.com/numero-uno-jpn/rStats.js/issues/362)。再現: `optim([0],x=>(x[0]-2)**2,{method:"L-BFGS-B",control:{lmm:1.5}})`。wrapperはlmmをinteger checkせず渡し、lbfgsbのM/K index関数はm/m2をleading dimensionに使うためfractional typed-array indexとなりundefined read/NaN arithmeticを誘発。m<=0だけでなくpositive integer validationが必要。静的workspace index解析。実行なし。

## Audit #852 — grouping cross-product exceeds the JavaScript Array length limit
- 対象: `src/data/grouping.ts` SHA `95467a588c46297bf2ae8e90995c818d284bf6c5` の `groupingOf()` / `rowsByCell()`。
- Issue [#363](https://github.com/numero-uno-jpn/rStats.js/issues/363)。再現: `n=65536`、`a=Array.from({length:n},(_,i)=>"a"+i)`、`b=Array.from({length:n},(_,i)=>"b"+i)`、`tapply(Array(n).fill(1),[a,b],v=>v.length)`。factorごとのlevels数は65,536、cross-productは2^32。sizeに上限検査がなく、`Array.from({length:g.size})`がJavaScript Array length上限超過でnative RangeError。配列上限/実用上限をallocation前に検査しdomain-specific errorを返すべき。静的dimension/allocation解析。巨大allocation未実行。


## Audit #853 — weightedMean loses a finite result when x*w underflows
- 対象: `src/descriptive/basic.ts` SHA `e12c8f8c91152f8d617cd05bf07ce512ef00856a` の `weightedMean()`。
- Issue [#364](https://github.com/numero-uno-jpn/rStats.js/issues/364)。再現: `weightedMean([1e-200],[1e-200])`。唯一のweightを持つ1点のweighted meanは1e-200だが、積1e-400が0へunderflowし、finite quotient 0を返すためfallbackへ入らない。weighted productをscale/exponent-separatedに形成すべき。静的IEEE-754解析。Vitest/package runtime/R実行なし。

## Audit #854 — Poisson near-mean deviance underflows before applying its weight
- 対象: `src/models/glmFamily.ts` SHA `6d7dc129d990b8724501ac59d4015562abe3e20c` の `poissonDev()`、`src/special/loader.ts` SHA `10f87090b292397f0a429f85c5edfeef79fe435b` の `bd0()`。
- Issue [#375](https://github.com/numero-uno-jpn/rStats.js/issues/375)。再現: `mu=1e-300`、`y=mu*(1+2**-52)`、`w=1e308`として`makeFamily("poisson").devContribution(y,mu,w)`。nearMean branchがbd0≈2.465e-332をbinary64へ返してからweightを掛けるため、先に0へunderflowする。weighted devianceは約4.93e-24で表現可能。#371はfar-from-mean branchのy/mu overflowで別経路。静的式/IEEE-754解析のみ。Vitest/package runtime/R実行なし。
- 同じ回に `geometricMean([0,Infinity])` も確認。DescTools公開仕様は「いずれかの値が0なら幾何平均は0」と明記しており（[DescTools Gmean](https://andrisignorell.github.io/DescTools/reference/Gmean.html)）、実装は仕様どおり。Issue [#365](https://github.com/numero-uno-jpn/rStats.js/issues/365) は誤検出としてwithdrawn/closed。

## Audit #855 — wideSum loses a third exponent band before later cancellation
- 対象: `src/internal/summary.ts` SHA `e4fc3bd652af3a00cf05b44389ddf58e590c4830` の `wideSumAdd()` / `sum()`、`src/special/dd.ts` SHA `e1713eb700507dfb0f36df8b9a7c591b679742a1` の `ddAdd()`。
- Issue [#374](https://github.com/numero-uno-jpn/rStats.js/issues/374)。再現: `sum([1e308,1e308,1e100,1,-1e308,-1e308,-1e100])`。2^−35 scaling後のDD accumulatorはhigh≈5.82e297、low≈2.91e88を保持するが、次の1（scaled≈2.91e−11）はlow componentに加える際に失われる。その後highとlowの両bandがcancelし、厳密残差1ではなく0となる。Issue #366の先行再現はddAddが単一小項を保持するため撤回し、#366をclosed/not_plannedとした。multi-component/binned accumulatorが必要。静的DD演算追跡。実行なし。

## Audit #856 — Cox risk-set exponentials overflow for finite linear predictors
- 対象: `src/models/coxph.ts` SHA `77ddd4a9619494a8aaab02950668a3cc082dc0fd` の `evaluate()`。
- Issue [#367](https://github.com/numero-uno-jpn/rStats.js/issues/367)。再現: `coxph([1,2],[1,0],[[0],[1]],{init:[1000],iterMax:0})`。risk-set predictors 0と1000の部分尤度は `-log(1+exp(1000))≈-1000` と有限だが、`Math.exp(1000)`とriskSumがInfinityとなりloglik=-Infinity。log-sum-exp/scaled risk-set momentsが必要。静的control-flow/IEEE-754解析。実行/R比較なし。

## Audit #857 — qgamma cannot scale back a standardized quantile beyond binary64 range
- 対象: `src/distributions/gamma.ts` SHA `e9ba1c35ef88e77e84a392562bb7f62378fcbf7f` の `qgammaStd()`、`src/internal/invert.ts` SHA `54aeaa15ec93053e2dd5fd19fc640a9fbf243a76` の `invertContinuous()`。
- Issue [#368](https://github.com/numero-uno-jpn/rStats.js/issues/368)。再現: `qgamma(-1e308,1e308,{scale:1e-308,lowerTail:false,logP:true})`。Gamma large-deviation exponent `a(r−1−log r)≈1e308` より標準化quantileは約3.146e308でNumber.MAX_VALUE超過、scale適用後の正しいquantileは約3.146。positive log-coordinateでも`Math.exp(u)`で標準化quantileをbinary64へ戻すため、最大有限値に制約された約1.798へ誤って収束する。scale込みlog-coordinateで解くべき。静的漸近式・制御フロー解析。実行/R比較なし。

## Audit #858 — integrate passes unbounded subdivisions to typed-array allocation
- 対象: `src/numerics/integrate.ts` SHA `6df1afbeed34b40ab91e3f064f5af8aba7d02b56` の `integrate()`、`src/integrate/quadpack.ts` SHA `3aef9054b78a50c5ab55ed22008db69c56535d4c` の `adaptive()`。
- Issue [#369](https://github.com/numero-uno-jpn/rStats.js/issues/369)。再現: `integrate(x=>x,0,1,{subdivisions:2**32})`。public wrapperは有限正整数として通すが、adaptiveはlimit+1要素のFloat64Array×4とInt32Arrayを確保し、typed-array length制限でnative RangeErrorとなる。allocation前に文書化された上限を検証すべき。巨大確保は未実行。

## Audit #859 — Gaussian deviance squares residual before applying prior weight
- 対象: `src/models/glmFamily.ts` SHA `6d7dc129d990b8724501ac59d4015562abe3e20c` のGaussian / quasi-constant `devContribution`。
- Issue [#370](https://github.com/numero-uno-jpn/rStats.js/issues/370)。再現: `makeFamily("gaussian").devContribution(1e200,0,1e-300)`。residual squareはInfinityとなりweightを掛けてもInfinityだが、数学的weighted devianceは1e100。weighted squareを指数分離して計算すべき。静的IEEE-754解析。実行なし。

## Audit #860 — Poisson deviance overflows the ratio before applying its weight
- 対象: `src/models/glmFamily.ts` SHA `6d7dc129d990b8724501ac59d4015562abe3e20c` の `poissonDev()`（Poisson/quasi-mu）。
- Issue [#371](https://github.com/numero-uno-jpn/rStats.js/issues/371)。再現: `makeFamily("poisson").devContribution(1e308,1e-308,1e-320)`。y/muがInfinityとなり`y*log(y/mu)`もInfinity、最終devianceはInfinity。しかし数学的weighted devianceは約2.8e-9。ratio/productを先にdoubleへ丸めない安定式が必要。静的式解析。実行なし。

## Audit #861 — Gamma deviance becomes NaN when y/mu overflows
- 対象: `src/models/glmFamily.ts` SHA `6d7dc129d990b8724501ac59d4015562abe3e20c` のGamma / quasi-mu² `devContribution`。
- Issue [#372](https://github.com/numero-uno-jpn/rStats.js/issues/372)。再現: `makeFamily("Gamma").devContribution(1e308,1e-308,1e-320)`。y/muと(y-mu)/muが共にInfinityとなり、差がNaN。数学的weighted devianceはorder 1e296で有限。log-ratioとweighted ratioをscaled/log coordinatesで計算すべき。静的式解析。実行なし。

## Audit #862 — Binomial near-mean deviance underflows before weighting
- 対象: `src/models/glmFamily.ts` SHA `6d7dc129d990b8724501ac59d4015562abe3e20c` の `binomialDev()`。
- Issue [#373](https://github.com/numero-uno-jpn/rStats.js/issues/373)。再現: `mu=1e-300`、`y=mu*(1+2**-52)`、`w=1e308`として`makeFamily("binomial").devContribution(y,mu,w)`。near-mean bd0は約4.93e-332でbinary64下限未満となり、weight適用前に0へunderflowするが、weighted devianceは約4.93e-24で表現可能。weightを含めたscaled near-mean formulaが必要。静的式/IEEE-754解析。実行なし。

## Audit #863 — distribution summaries square widths/scales before applying constants
- 対象: `src/distributions/summary.ts` SHA `ea70fb8834a59bf1c1f8239c8306f14d703b2856` の `distSummary("unif")` / `distSummary("arcsine")` / `distSummary("logis")`。
- Issue [#376](https://github.com/numero-uno-jpn/rStats.js/issues/376)。再現: `distSummary("unif", { min: 0, max: 2e154 })`、`distSummary("arcsine", { a: 0, b: 2e154 })`、`distSummary("logis", { location: 0, scale: 1e-162 })`。uniform/arcsineの実際のbinary64幅は `0x1.7dddf6b095ff1p+512`。幅²はoverflowするが、分散はそれぞれ約 `3.33333333333333358e307` (`0x1.7bbef5d3a60d6p+1021`)、約 `5.00000000000000037e307` (`0x1.1ccf385ebc8a0p+1022`) で有限。logisのscaleは `0x1.ccb0536608d61p-539`、scale²は0へunderflowするが、π²scale²/3は約 `3.28986813369645257e-324` で、正しく丸めると最小正subnormal `5e-324` (`0x0.0000000000001p-1022`)。3分岐ともsdDirectは有限。公開APIで再現可能。Fraction厳密計算 (unif/arcsine)・mpmath高精度計算 (logis)・IEEE-754解析。package runtime/Vitest/R未実行。Rでは未確認。極端な有限幅/極小scaleのみ。sdDirectまたは指数分離で通常入力の挙動を保てる見込み。過去のreview report / fix summaryのdistSummary No.80/81はunif平均・beta分散・triang skewness等で、本件のvariance式は扱っていない。

## Audit #864 — exponential summary squares the rate before taking its reciprocal
- 対象: `src/distributions/summary.ts` SHA `ea70fb8834a59bf1c1f8239c8306f14d703b2856` の `distSummary("exp")`。
- Issue [#377](https://github.com/numero-uno-jpn/rStats.js/issues/377)。再現: `distSummary("exp", { rate: 1e155 })`。実際のrateは `0x1.dd55745cbb7edp+514`。`rate * rate` がInfinityとなり、実装の `1 / (rate * rate)` は0。しかし厳密な逆二乗は約 `9.99999999999999985647536918179663546e-311`、正しく丸めたdoubleは `1e-310` (`0x0.012688b70e62bp-1022`) で表現可能。sdDirectの `1/rate` は有限で、varianceとの不整合も生じる。公開 `distSummary` APIで再現。Fraction厳密計算/IEEE-754解析。package runtime/Vitest/R未実行。Rでは未確認。rateが約1e155の極端な範囲のみ。逆数を先に計算して二乗すれば通常入力の挙動を保てる見込み。review reportとfix summaryを `distSummary` / `exp` で検索し、既知のNo.80/81 (unif平均・beta分散・triang skewness等) とは別件であることを確認。
## Audit #865 — negative-binomial summary variance loses a finite result when prob² underflows
- 対象: `src/distributions/summary.ts` SHA `ea70fb8834a59bf1c1f8239c8306f14d703b2856` の `distSummary("nbinom")`。
- Issue [#378](https://github.com/numero-uno-jpn/rStats.js/issues/378)。再現: `distSummary("nbinom", { size: 1e-300, prob: 1e-200 })`。実際のbinary64 `size`=`0x1.56e1fc2f8f359p-997`、`prob`=`0x1.87e92154ef7acp-665`。`prob * prob` は0へunderflowするため `size*q/(prob*prob)` はInfinity。一方、厳密な分散は約 `1.00000000000000006085856703704324235e100`、正しく丸めたdoubleは `1e100` (`0x1.249ad2594c37dp+332`)。`sdDirect` は約1e50で有限。公開 `distSummary` APIで再現可能。Fraction厳密計算/IEEE-754解析。package runtime/Vitest/R未実行。Rでは未確認。極小size/probの組合せのみ。sqrt表現または指数分離で通常入力の挙動を保てる見込み。review report / fix summaryの `distSummary` と `nbinom` を検索し、No.80/81等の既知判定に本件は含まれないことを確認。
## Audit #866 — distribution summaries exclude valid zero-boundary point masses
- 対象: `src/distributions/summary.ts` SHA `ea70fb8834a59bf1c1f8239c8306f14d703b2856` の `distSummary("pois")` / `distSummary("nbinom")`。公開Poisson関数のsource SHA `3c470e0755b167bd5a63a03f1f43072a04d90139`。
- Issue [#379](https://github.com/numero-uno-jpn/rStats.js/issues/379)。再現: `distSummary("pois", { lambda: 0 })`、`distSummary("nbinom", { size: 0, prob: 0.5 })`。両summary branchは正値を要求して全NaNを返すが、基礎分布APIはlambda=0/size=0をpoint mass at zeroとして実装。期待値はmean/variance/sd/median/mode=0、skewness/kurtosis=NaN。R未実行。R 4.5.0 `stats::Poisson` docsはlambda non-negative、lambda=0 point mass at 0と明記: https://stat.ethz.ch/R-manual/R-patched/library/stats/help/dpois.html。R `stats::NegBinomial` docsはsize==0がzeroに集中と記載: https://stat.ethz.ch/R-manual/R-patched/library/stats/html/NegBinomial.html。R C sourceでもsize<0のみinvalid、size=0はpoint mass: https://fossies.org/linux/R/src/nmath/dnbinom.c。package runtime/Vitest未実行。0境界のみ。明示的なpoint-mass branchを追加すれば正のパラメータの結果は変わらない。

## Audit #867 — log-normal summary variance remains broken after the earlier sd/skewness fix

- 対象: `src/distributions/summary.ts` の `distSummary("lnorm")`。既存Issue [#120](https://github.com/numero-uno-jpn/rStats.js/issues/120) を再オープン（新規Issueには分割せず、同じ `sdlog²` underflow root causeに統合）。

- 追加再現: `distSummary("lnorm", { meanlog: 400, sdlog: 1e-200 })`。実際のsdlogは `0x1.87e92154ef7acp-665`。`s2=sdlog*sdlog` と `em1` が0、`exp(800)`がInfinityとなりvarianceが `0*Infinity = NaN`。しかし厳密なvarianceは約 `2.726374572112566469762000661111350367111081579393150662797607001716198660572407808587475026859131981e-53`、正しく丸めたdoubleは `2.7263745721125664e-53` (`0x1.4e40a71d38483p-175`)。sdDirectは約 `5.2214696897641445e-27` で有限。既存 `review_fix_log_issue120.md` はmeanlog=0, sdlog=1e-200の分散は0で正しいと判断していたが、meanlog=400ではvarianceは有限である新しいケース。Rでは未確認。

## Audit #868 — interpolation paths overflow finite ordinate differences before dividing by knot spacing
- 対象: `src/numerics/interp.ts` SHA `a88cdba04295b2e3fe72c39b2f2facaf1cceb059` の `fmmCoef()` / `evalHermite()` / `hermiteInterp()`。
- Issue [#380](https://github.com/numero-uno-jpn/rStats.js/issues/380)。再現: `spline([0,2],[-1e308,1e308],{xout:[1]})`、`splinefunH([0,2],[-1e308,1e308],[0,0])([1],1)`、`hermiteInterp([0,2],[-1e308,1e308],[1e308,1e308],[1])`。ordinate doubleは±`0x1.1ccf385ebc8ap+1023`、y差はoverflowするが、spacing2で割ったsecantは1e308 (`0x1.1ccf385ebc8ap+1023`)、spline/Hermite値は0。splinefunHのmidpoint derivativeは1.5e308 (`0x1.ab36d48e1acf0p+1023`) で有限。公開API。source-level IEEE-754 trace。package runtime/Vitest/R未実行。Rでは未確認。極端な有限ordinateのみ。half-coordinate / scaled difference quotientをoverflow-risk pathで使えば通常値は変わらない。review report / differences-from-r / issue #125 logを照合し、既知のknot-range overflow (x座標) と本件のordinate-difference overflow (y座標) は別件と確認。

## Audit #869 — Fisher 2×2 exact path has no support-size allocation bound
- 対象: `src/htest/fisherTest.ts` SHA `c90cc3b96af152c34f0a2396fad60ecda9d5d32a` の `fisherTest()` / `fisher2x2()` / `OddsRatioDistribution`。
- Issue [#381](https://github.com/numero-uno-jpn/rStats.js/issues/381)。大きな再現入力（実行せず）: `fisherTest([[1e9, 1e9], [1e9, 1e9]], { confInt: false })`。各countは許容上限2^31−1未満だが、support=[0,2e9]、`Float64Array(2,000,000,001)` ≈16GBとなり、その後もsupport全体を走査する。メモリ枯渇を避けるため実行していない。小さい同型経路は `fisherTest([[100,100],[100,100]], {confInt:false})` でsupport 201。公開API。source-level allocation/work analysis。R未実行・R挙動未確認。通常の小さな2×2表には影響せず、巨大countでresource exhaustion。support/work limitをallocation前に検査すれば通常表の値は変わらない。過去review reportとdifferences-from-rのfisherTest記録はfractional B / r×c FEXACT等で、本件の2×2 support allocationは未記録。
## Audit #870 — chi-square standardized residuals lose small complementary margins
- 対象: `src/htest/chisqTest.ts` SHA `8b0426c29232aa6d013befd6564e281fc705cc8d` の `contingency()`。
- Issue [#382](https://github.com/numero-uno-jpn/rStats.js/issues/382)。再現: `chisqTest([[2 ** 52, 0], [0, 0.1]]).stdres`。N=2^52はexact integer double (`0x1.0000000000000p+52`)、0.1は `0x1.999999999999ap-4`。合計N+0.1はNへ丸められ、支配的な行/列のmargin/totalが1となり、`1 - ratio` が0。off-diagonalのVは本来約 `2.22044604925031317945487648880810508e-18` (`0x1.47ae147ae147bp-59`) で、標準化残差は約 `-67108864.000000000745058...` (`-0x1.0000000000000p+26`) だが、実装はV=0として `-Infinity`。Fraction厳密計算/IEEE-754解析。公開 `chisqTest` API。package runtime/Vitest/R未実行、Rでは未確認。極端な不均衡marginのみ。補集合を他marginの合計から計算すれば通常表の値は変わらない。review report / fix summary / differences-from-rのchisqTest記録を検索し、fractional B・rescaleP・2^53 count policy等の既知事項とは異なり、本件のstdres補集合キャンセルは未記録と確認。
## Audit #871 — Weibull summary squares scale before multiplying by a small finite standardized variance
- 対象: `src/distributions/summary.ts` SHA `ea70fb8834a59bf1c1f8239c8306f14d703b2856` の `distSummary("weibull")`。
- Issue [#383](https://github.com/numero-uno-jpn/rStats.js/issues/383)。再現: `distSummary("weibull", { shape: 10, scale: 1e155 })`。実際のscaleは `0x1.dd55745cbb7edp+514`。scale²はInfinityだが、shape=10の標準化分散は約 `0.0131004550734683091471545816875052950`。実際のscale doubleから計算した分散は約 `1.31004550734683093351783794845051282399e308`、正しく丸めたdoubleは `1.310045507346831e308` (`0x1.751d04363908cp+1023`) で有限。sdDirectは約 `1.14457219403008e154` で有限。公開 `distSummary` API。mpmath高精度gamma計算/IEEE-754 source trace。package runtime/Vitest/R未実行、Rでは未確認。scale=1e155の極端な範囲のみ。sdDirect²またはscale*standardizedVariance*scaleの順で計算すれば通常scaleの結果は変わらない見込み。既存のWeibull巨大shape issueは中心モーメント積分/生モーメントのshape解像度問題で、本件のscale² overflowとは別根拠。review report/fix summaryに本件のscale二乗は記録なし。

## Audit #871 — 追加確認: Shapiro–FranciaとBeta summaryの数値境界

- Issue [#384](https://github.com/numero-uno-jpn/rStats.js/issues/384): `src/htest/normalityTests.ts` の `sfTest()`。通常スケールのほぼ完全な正規スコア線形データで、独立丸めされた共分散・分散から `W=1.0000000000000002` となり、`log(1-W)` がNaN。入力・binary64表現・高精度相関はIssue本文に記録。package runtime/Vitest/R未実行、R挙動未確認。
- Issue [#385](https://github.com/numero-uno-jpn/rStats.js/issues/385): `src/distributions/summary.ts` のBeta excess kurtosis。shape1=1e-3, shape2=1e155で中間二乗・分母積がoverflowするが、真のexcess kurtosisは有限の6000。高精度Decimal/IEEE-754解析、package runtime/Vitest/R未実行。

## Audit #872 — central moment normalisation underflows for tiny-variance distributions

- 対象: `src/distributions/summary.ts` の `central()` / `shape()`。
- Issue [#386](https://github.com/numero-uno-jpn/rStats.js/issues/386)。再現: `distSummary("kumar", { a: 1e-220, b: 1 })`。variance自体は約5e-221で表現可能だが、`v ** 1.5` と `v * v` が0へunderflowし、skewness/kurtosisがInfinity。厳密なKumaraswamy momentsを高精度Decimalで評価。package runtime/Vitest/R未実行、R対象外。

## Audit #873 — weightedMean overflow fallback候補（重複として除外）

- 対象: `src/descriptive/basic.ts` の `weightedMean()`。
- Issue [#387](https://github.com/numero-uno-jpn/rStats.js/issues/387) は `weightedMean([1e308, NaN], [1e308, 0])` のfallback阻害を主張したが、GitHub上でduplicateとしてclose。新規確定Issueとしては数えない。

## Audit #874 — lm drops positive subnormal weights during common weight scaling

- 対象: `src/models/lm.ts` の `fitLmUnit()`。
- Issue [#388](https://github.com/numero-uno-jpn/rStats.js/issues/388)。再現: `lm([[1],[0]],[0,1],{intercept:false,weights:[1e308,Number.MIN_VALUE]})`。共通2冪scaleで正のsubnormal weightが0となり、観測行/残差dfは残る一方RSS寄与が消失。具体値・期待RSS/sigmaはIssue本文参照。静的IEEE-754解析、package runtime/Vitest/R未実行。

## Audit #875 — propTrendTest finite-score overflow

- 対象: `src/htest/trendTests.ts` の `propTrendTest()`。
- Issue [#389](https://github.com/numero-uno-jpn/rStats.js/issues/389)。再現: `propTrendTest([0,1],[1,1],[0,1e200])`。スコアを定数倍しても不変のはずのtrend statisticが、weighted regressionの `sxx` / `sxy²` overflowでNaN。score [0,1] ではF=2, df=1, p≈0.15729920705。式とIEEE-754経路を静的確認、package runtime/Vitest/R未実行。

## Audit #876 — Jonckheere upper-tail候補（重複として除外）

- 対象: `src/htest/trendTests.ts` の `jonckheereTest()` normal approximation。
- Issue [#390](https://github.com/numero-uno-jpn/rStats.js/issues/390) は `1 - pnorm(z)` のcancellationを主張したが、GitHub上でduplicateとしてclose。新規確定Issueとしては数えない。

## Audit #877 — Hommel p-value adjustment has unbounded quadratic work

- 対象: `src/htest/pAdjust.ts` の `pAdjust()` / `hommel()`。
- Issue [#391](https://github.com/numero-uno-jpn/rStats.js/issues/391)。再現（未実行）: `pAdjust([0.01], { method: "hommel", n: 100_000 })`。入力は検証を通過するが、Hommelの二重loopは厳密に4,999,950,000回実行される。小ベクトルと大きなaccepted nでevent loopを長時間blockするresource-exhaustion問題。静的loop count、package runtime/Vitest/R未実行。

## Audit #878 — ICC two-way residual mean square cancellation

- 対象: `src/htest/agreement.ts` の `icc()` two-way path。
- Issue [#392](https://github.com/numero-uno-jpn/rStats.js/issues/392)。3×3の整数rating matrixで、subject/rater effectsが約1e8〜6e8、nonzero interactionが±1。正確な残差MSEは1.5だが、共通scale後に丸めたSST/MSR/MSCを減算するためMSE=0となり、ICC=1/F=Infinity。Fraction厳密計算とbinary64 rounding解析。package runtime/Vitest/R未実行。

## Audit #879 — common group scaling underflows positive within-group variation

- 対象: `src/htest/onewayTest.ts`, `src/htest/varTest.ts`, `src/htest/leveneTest.ts` と `src/internal/summary.ts` の `groupMoments()` / `scaleToUnit()`。
- Issue [#393](https://github.com/numero-uno-jpn/rStats.js/issues/393)。共通scaleが極端に小さい群の正のwithin-group variationを0にし、Welch one-wayでは無限重みからNaN、variance-ratio testでは両群定数と誤認してthrow、Leveneでは偏差をすべて0と誤認する。具体入力はIssue本文に記録。静的control-flow/IEEE-754解析。package runtime/Vitest/R未実行、R挙動未確認。


## Audit #880 — RK4 fallback overflows a finite increment for large slopes and subunit steps

- 対象: `src/numerics/ode.ts` SHA `a9f499eade2fd6368e57e8d087220d6bcfdd23f2` の `ode()` RK4 update。
- 新規Issue [#394](https://github.com/numero-uno-jpn/rStats.js/issues/394)。再現: `ode([0], [0, 0.5], () => [1e308], [], { method: "rk4" })`。4段の微分値はすべて有限の1e308、厳密解は5e307（有限）。通常式の重み付き和がoverflowするためfallbackへ進むが、fallbackは `h * 2^60 * quarter` の順で計算し、quarter=1.5e308自体が有限でも中間積がInfinityとなる。既存#124が扱ったsubnormal h/6と2*kのoverflowとは異なり、その修正fallback自身の積順序が原因。静的control-flow/IEEE-754解析。package runtime、Vitest、deSolve比較は未実行。


## Audit #881 — dot products silently lose representable subnormal sums when each product underflows

- 対象: `src/linalg/basic.ts` SHA `27289d14624add617991541dffba05f791655d72` の `crossprod()` / `tcrossprod()`、および共通fallbackを使う `matMul()`。`src/linalg/dot.ts` SHA `eb7bb9b571c9d4879d33e4b661183a13fd410428`。
- 新規Issue [#395](https://github.com/numero-uno-jpn/rStats.js/issues/395)。再現: `const x = Array(100).fill(1e-162); crossprod(x, x)`。入力doubleは `1e-162 = 0x1.ccb0536608d61p-539`。各積は個別に0へunderflowし、通常和は有限の0なので `Number.isFinite(s)` がtrueとなり、exact BigInt fallbackが呼ばれない。しかし実際のbinary64入力の積を厳密に合計して最後に丸めると `1e-322 = 0x0.0000000000014p-1022` となり、正のsubnormalとして表現可能。#208のfallback内で小さい残差を失う問題とは異なり、本件はfallbackに入らない問題。Python Fractionによる正確な有理数計算とsource control-flowで確認。package runtime、Vitest、R/BLAS比較は未実行。Rとの不一致は主張しない。


## Audit #882 — rnorm finite affine result lost to intermediate overflow

- 対象: `src/random/continuous.ts` SHA `5ad76e5676b4bf27c36b288f8e48ac3821bfd92a` の `rnorm1()` と、`src/random/rng.ts` / `src/random/mt.ts` / `src/random/as241.ts` の標準正規乱数生成経路。
- 新規Issue [#396](https://github.com/numero-uno-jpn/rStats.js/issues/396)。再現: `setSeed(7); rnorm(1, { mean: -1e308, sd: 1e308 })`。seed 7のuniform列から `normRand()` は約2.287247161340524を生成するため、`sd * Z` がInfinityにoverflowする。一方、実際のbinary64入力値を厳密に計算した `mean + sd * Z` は有限で、正しく丸めると `1.2872471613405238e308`（`0x1.6e9ec2dfbf524p+1023`）。有限な平均が積のoverflowを相殺するケースで、計算順序によりInfinityを返す。Rとの互換性差異は主張せず、数値安定性の問題として登録。MT seed展開・`normRand()`・AS241のsource式を追跡し、正確有理数計算で期待値を確認。package runtime/Vitest未実行。


## Audit #883 — monoH.FC slope-ratio overflow bypasses the monotonicity limiter

- 対象: `src/numerics/interp.ts` SHA `aecc2664337b329edc1005fc6e2d9fbf0c706ed3` の `fritschCarlsonSlopes()` / `evalHermite()`。
- 新規Issue [#397](https://github.com/numero-uno-jpn/rStats.js/issues/397)。再現: `const f = splinefun([0, 1, 2], [0, 1e-200, 1e200], { method: "monoH.FC" }); f([0.5])`。有限かつ単調増加のデータだが、secantsは `[1e-200, 1e200]`、中央初期傾きは約 `5e199`。第1区間で `alpha=1`、`beta≈5e399` がInfinityとなり、`a` / `b` もInfinity。limiter条件 `alpha * (a + b) < a * a` は `Infinity < Infinity` でfalseとなり、制限されない巨大な右端傾きがHermite基底の負係数に掛かるため、x=0.5で約 `-6.25e198` の大幅な範囲外overshootを生む。dimensionlessな判定・正規化の中間overflowが原因。
- 既存Issue #125は有限knot間隔の差がoverflowする問題。本件は通常のknot `[0,1,2]` で、有限ordinate secant間の比がoverflowする別経路。
- IEEE-754算術とソース制御フローによる静的検証。package runtime、Vitest、R比較は未実行。Rとの互換性差異は主張しない。


## Audit #884 — Hyman limiter loses adjacent-slope sign agreement when the product underflows

- 対象: `src/numerics/interp.ts` SHA `aecc2664337b329edc1005fc6e2d9fbf0c706ed3` の `hymanCoef()` / `fmmCoef()` / `evalCubic()`。
- 新規Issue [#398](https://github.com/numero-uno-jpn/rStats.js/issues/398)。再現: `const f = splinefun([0, 1, 5], [0, 2e-199, 4e-199], { method: "hyman" }); f([5], 1)`。secantは `[2e-199, 5e-200]`。終点では隣接secantがともに `5e-200` で正だが、その積 `2.5e-399` はbinary64で0へunderflowする。Hyman limiterの `sm * sp > 0` がfalseとなり、FMM由来の負の終点傾き約 `-1.3e-199` を符号反転せず残す。厳密増加データに対し、終点微分が負になる。
- #397はmonoH.FCのdimensionless ratio overflow、本件は別のhyman limiterにおける隣接secant符号判定のunderflow。#125/#380とも原因が異なる。
- FMM係数の数値追跡とIEEE-754積のunderflowを確認。package runtime、Vitest、R比較は未実行。Rとの互換性差異は主張しない。


## Audit #885 — splinefunH third derivative loses a representable result when h squared overflows

- 対象: `src/numerics/interp.ts` SHA `aecc2664337b329edc1005fc6e2d9fbf0c706ed3` の `evalHermite()` 第3微分経路。
- 新規Issue [#399](https://github.com/numero-uno-jpn/rStats.js/issues/399)。再現: `const f = splinefunH([0, 1e200], [0, 0], [1e200, 1e200]); f([5e199], 3)`。h=1e200は有限、分子 `-12*delta+6*m0+6*m1=1.2e201` も有限。正確な商は約 `1.2e-199` でnormal doubleとして表現可能だが、実装は `h*h` を先に計算してInfinityとし、結果を0にする。有限な最終結果を中間二乗のoverflowで失う。
- #380のordinate差分overflow、#125のknot差overflowとは異なり、本件ではordinate差分は0、knot間隔も有限で、第三微分の分母二乗のみがoverflow。
- ソース制御フローとIEEE-754範囲計算による静的検証。package runtime、Vitest、R比較は未実行。Rとの互換性差異は主張しない。


## Audit #886 — splinefunH value overflows h times endpoint slope before basis weighting

- 対象: `src/numerics/interp.ts` SHA `aecc2664337b329edc1005fc6e2d9fbf0c706ed3` の `evalHermite()` 第0微分経路。
- 新規Issue [#400](https://github.com/numero-uno-jpn/rStats.js/issues/400)。再現: `const f = splinefunH([0, 1e200], [0, 0], [1e200, 1e200]); f([1e100])`。t=1e-100、h=1e200、両傾き1e200。各 `h*m_i` は1e400でInfinityになるが、Hermite基底を掛けた各項は約1e300と-1e200で、最終値は約1e300と有限。実装は先に `h*m_i` を計算してから小さい基底係数を掛けるため、Infinityと-Infinityの和でNaNとなる。
- #399は第三微分の `h*h`、本件は第0微分の `h*m_i` と基底係数の積順序の問題。#380/#125とも異なる。
- ソース制御フローとIEEE-754範囲計算による静的検証。package runtime、Vitest、R比較は未実行。Rとの互換性差異は主張しない。


## Audit #887 — splinefunH first derivative overflows a finite secant before basis weighting

- 対象: `src/numerics/interp.ts` SHA `aecc2664337b329edc1005fc6e2d9fbf0c706ed3` の `evalHermite()` 第1微分経路。
- 新規Issue [#401](https://github.com/numero-uno-jpn/rStats.js/issues/401)。再現: `const f = splinefunH([0, 1e-200], [0, 1e200], [0, 0]); f([1e-300], 1)`。座標・値・傾きは有限。t=1e-100、有限な差分1e200をh=1e-200で割ったsecantは1e400でInfinityとなるが、Hermite基底係数を掛けた微分は `(1e200/1e-200)*(6t-6t²)≈6e300` で有限。実装はsecantを先に作り、後から小さい基底係数を掛けるため+Infinityを返す。
- #380はordinate subtraction自体のoverflow。本件は差分は有限で、その商だけがoverflowする。#399の第3微分分母、#400の値計算のh*m積とも別経路。
- Hermite多項式の直接微分とIEEE-754範囲計算による静的検証。package runtime、Vitest、R比較は未実行。Rとの互換性差異は主張しない。

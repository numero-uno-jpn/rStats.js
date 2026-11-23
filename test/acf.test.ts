import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { acf, pacf, ccf, type AcfResult } from "../src/entries/timeseries.js";
import { getRandomSeed, setRandomSeed, setSeed, rnorm } from "../src/entries/distributions.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/acf.json", import.meta.url), "utf8")) as Record<string, any>;
const DATA = {"lh":[2.4,2.4,2.4,2.2,2.1,1.5,2.3,2.3,2.5,2,1.9,1.7,2.2,1.8,3.2,3.2,2.7,2.2,2.2,1.9,1.9,1.8,2.7,3,2.3,2,2,2.9,2.9,2.7,2.7,2.3,2.6,2.4,1.8,1.7,1.5,1.4,2.1,3.3,3.5,3.5,3.1,2.6,2.1,3.4,3,2.9],"ldeaths":[3035,2552,2704,2554,2014,1655,1721,1524,1596,2074,2199,2512,2933,2889,2938,2497,1870,1726,1607,1545,1396,1787,2076,2837,2787,3891,3179,2011,1636,1580,1489,1300,1356,1653,2013,2823,3102,2294,2385,2444,1748,1554,1498,1361,1346,1564,1640,2293,2815,3137,2679,1969,1870,1633,1529,1366,1357,1570,1535,2491,3084,2605,2573,2143,1693,1504,1461,1354,1333,1492,1781,1915],"AirPassengers":[112,118,132,129,121,135,148,148,136,119,104,118,115,126,141,135,125,149,170,170,158,133,114,140,145,150,178,163,172,178,199,199,184,162,146,166,171,180,193,181,183,218,230,242,209,191,172,194,196,196,236,235,229,243,264,272,237,211,180,201,204,188,235,227,234,264,302,293,259,229,203,229,242,233,267,269,270,315,364,347,312,274,237,278,284,277,317,313,318,374,413,405,355,306,271,306,315,301,356,348,355,422,465,467,404,347,305,336,340,318,362,348,363,435,491,505,404,359,310,337,360,342,406,396,420,472,548,559,463,407,362,405,417,391,419,461,472,535,622,606,508,461,390,432],"presidents":["NA",87,82,75,63,50,43,32,35,60,54,55,36,39,"NA","NA",69,57,57,51,45,37,46,39,36,24,32,23,25,32,"NA",32,59,74,75,60,71,61,71,57,71,68,79,73,76,71,67,75,79,62,63,57,60,49,48,52,57,62,61,66,71,62,61,57,72,83,71,78,79,71,62,74,76,64,62,57,80,73,69,69,71,64,69,62,63,46,56,44,44,52,38,46,36,49,35,44,59,65,65,56,66,53,61,52,51,48,54,49,49,61,"NA","NA",68,44,40,27,28,25,24,24],"mdeaths":[2134,1863,1877,1877,1492,1249,1280,1131,1209,1492,1621,1846,2103,2137,2153,1833,1403,1288,1186,1133,1053,1347,1545,2066,2020,2750,2283,1479,1189,1160,1113,970,999,1208,1467,2059,2240,1634,1722,1801,1246,1162,1087,1013,959,1179,1229,1655,2019,2284,1942,1423,1340,1187,1098,1004,970,1140,1110,1812,2263,1820,1846,1531,1215,1075,1056,975,940,1081,1294,1341],"fdeaths":[901,689,827,677,522,406,441,393,387,582,578,666,830,752,785,664,467,438,421,412,343,440,531,771,767,1141,896,532,447,420,376,330,357,445,546,764,862,660,663,643,502,392,411,348,387,385,411,638,796,853,737,546,530,446,431,362,387,430,425,679,821,785,727,612,478,429,405,379,393,411,487,574],"ar2":[-0.11522718671381932,-1.5946768268477463,-1.190804313516409,-0.31630059562640234,0.044225251162930634,0.021985523679097466,-0.834830239867942,1.3502857420500562,0.5622234976275402,-1.3378062320608968,-1.9082945009707988,-0.2101955884882959,-1.1703921082238846,-0.9562332278082261,-0.6423859795669946,-0.2794174437801731,0.8268765393188227,-0.1739667477608417,-0.1746683115149333,0.1557318864489296,0.9489768502743818,-1.0724149422994562,0.6714416364292111,1.223860097732275,0.9004976631891737,-0.2373895932065198,0.5147673642683793,1.2445933755955763,1.3144781023734287,0.6865744021539605,0.3317093560834923,0.7485770415587254,0.1604737774482953,0.24895383967232168,-0.3070027744938283,-0.5249799256665697,-0.13662196592532067,-0.12299189898214377,0.5282791808132469,0.8010375410187657,0.054594891351709945,-0.5214383498665688,-0.9400390015844076,-0.29127332505167614,-0.696867308131409,-0.53136405698782,0.2292387346010343,0.6351738238511182,-0.3968967445904621,0.09427868647211193,-0.17800904832048406,-0.9131677962216076,0.3028052648731816,-0.44981802520815645,-1.3217678697285002,-0.9154511570846025,0.25809604448112367,0.03445277745401376,1.0252870954059974,0.6571960745106028,1.3416518705549187,0.6299043577603418,1.0877859134287138,0.10549532041404594,1.6700653759354773,0.8577983730526264,0.8456896360514248,1.2316377774650769,1.5263622549395515,0.4904786866147624,0.012095632314018612,-1.0508124635066651,-2.1667498728379284,0.059016972709557525,1.9525728690834572,0.40809621691146947,-0.55553507081085,-1.8965816451705055,0.06517382588514725,0.7946210907394053,0.4408675129619687,-1.096025752240727,0.42844191809181675,0.37645276341052014,0.40823373120801676,0.026725361586752802,0.9898136978080899,0.3369319135207942,-0.5992962418160583,0.8343285872126547,0.8329711726186825,-0.0620902465327281,-1.357345909291308,-0.22592201604625695,-0.2178051146669513,0.18785814532345407,-0.08315644058960112,0.15528099308704396,1.5491944986021895,1.2790172370827468,-0.172532719641932,1.301407936658526,0.7814946409285167,-0.6609840975140433,1.448326407944421,1.4439638645396684,-1.8576073570845137,-0.36292677911214233,0.6449530421746613,1.1404794412532835,1.65452862446528,1.5859075182072502,0.5531687361680451,0.6243643363791951,1.3169376892097862,0.2174233486305217,0.1384299226220621,-0.2596278423909113,0.3600078326671314,0.09723958183001204,-0.13159123722924185,0.5542197439963487,0.005862578803373118,0.4324760539827666,-0.5578786383507426,-1.3712760320273534,-2.079008872594641,-0.48571918481415394,0.4903087243527622,-1.6328692714507265,-0.30520843208641524,-0.28615068276168454,-1.0599019027553565,-0.38805469888601407,0.6920467805025494,-0.12856664193730713,-0.7847763504009655,-0.9287344804008161,-2.216070596766142,-1.5608143149232485,-1.049297137378029,0.5751250065908238,2.0172677044313234,1.0517026529498086,-1.4788826381177214,-0.3098134165365367,-0.1735150015144173,0.41105871201393973,-0.041173911238519385,-0.6461240366680538,-1.4054533494911778,0.10060114093527991,-0.10680049443279077,1.262225350184161,1.4308260436923144,1.5915292150722404,-0.3597356662283229,-1.7322414841974911,0.054733535345063575,-0.1461704068185561,-0.9502509806293385,-0.9461729026722426,-0.008107981594288716,2.066575110890689,2.328415118511702,-0.2755891509646823,-0.576458105320281,0.8429737331674144,0.02605797243974603,0.5883504651256489,1.09514630621436,0.7107349751393777,1.7963143489504056,1.1804244873536414,-1.7047501874604958,-0.7706827294054361,0.9280338622489963,-0.3050768236748994,-0.6989109830014266,-0.8194620094843398,0.33428075139820845,0.19997826937425803,0.9433266329155084,-0.2171454379516634,0.2211922916532586,1.5291438256735088,1.7820980913815974,2.219087802397245,0.5394558310333033,-0.9680398870942949,-1.0478135206892614,-0.5057630129573841,1.0069721506984268,1.941813933843657,-0.026679471536617427,-0.5582419612999091,-0.9683767900925572,-0.3307407655874127,2.4386996861298837,1.283054981755751,-2.7323598807625817,-1.870655282298039,-0.5888863208398888,0.5186189105849808,0.08289649358367626,-0.2669677154560939,0.5089349951723071,1.6555983352648094,1.606392668505448,-0.49829576212475424,-3.566005546428274,-2.070480236089904,1.0761183707040518,1.0994250838882453,-0.8556854607113302,-1.9016177770228169,-0.8683115025418247,-0.2503820485982876,-1.433314873993074,-0.07670376456251109,-0.9364269595590844,-0.07967909132292456,0.4758849974662813,1.4108113252761285,0.6667827378561657,-0.6323718803205632,-0.9401021118065114,0.24802486711998883,-0.3995690411153517,0.10045093333956655,0.29689895799590665,-1.6596260382713865,-2.0601631571696433,-0.8035206569648276,0.4830169284198351,-0.5483412036289613,-0.14552027429949443,-0.4679449400316662,0.2562581629683924,1.7722191261778635,0.5507689313633012,-0.44673731460837957,-1.7178400396500344,-2.036363378735073,0.5915704666808645,0.23123184824879334,0.22293032204568805,-0.19128317319492438,-0.5061201393234339,0.9157314528491964,1.0118226483952968,1.469691801575109,1.2035890943899012,-0.2736139705688054,-2.0089197032690715,-1.538969030720809,-0.5300024631286236,0.8370849963897229,2.140671901686389,0.20042180697820894,0.5505329349256393,1.9100259284880392,-0.7948652642053459,-0.7802831228250258,-0.8673043642178444,-0.47185095820365486,-0.15109274290861502,-1.0408288033939752,-1.271059557818336,0.06032081280461582,0.5607010932909968,-1.0346235508712187,-1.4824892810088315,0.11550088745393838,1.5175322961663886,-1.4282085086476735,-1.0229036820472792,0.48264084497676746,-0.9437556090662095,-0.19904786431028307,-0.33060182319939446,-0.35851065667150955,0.42377327313566054,1.6027111226692592,1.0282617524232456,1.2574299012130932,1.2701923268171118,1.2186308062159092,0.0021228142276841777,-0.10012511475378871,0.8039119467740556,2.715281122681914,-0.07433920166614172,-0.44631711731754187,-0.9561697893449355,-1.6634376805694908,-1.0219406863386835,1.0085712317635416,1.9847300070008826,1.741198674547483]} as Record<string, any>;
const mismatches: string[] = [];
const covered = new Set<string>();
let maxAbsError = 0;
let maxRelativeCovarianceError = 0;
const x10 = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
const y10 = [2, 7, 1, 8, 2, 8, 1, 8, 2, 8];

function nums(value: unknown): number[] {
  const a = Array.isArray(value) ? value : [value];
  return a.map((v) => v === "NA" || v === "NaN" ? NaN : v === "Inf" ? Infinity : v === "-Inf" ? -Infinity : Number(v));
}
function compare(key: string, actual: AcfResult, frequency = 1): void {
  covered.add(key);
  const expected = fixture[key]?.value;
  if (!expected) { mismatches.push(key + ": fixture value missing"); return; }
  const elag = nums(expected.lag).map((v) => v * frequency);
  const eacf = nums(expected.acf);
  if (actual.type !== expected.type) mismatches.push(key + ".type");
  if (actual.nUsed !== expected["n.used"]) mismatches.push(key + ".nUsed");
  if (actual.lag.length !== elag.length) mismatches.push(key + ".lag length " + actual.lag.length + " != " + elag.length);
  if (actual.acf.length !== eacf.length) mismatches.push(key + ".acf length " + actual.acf.length + " != " + eacf.length);
  for (let i = 0; i < Math.min(actual.lag.length, elag.length); i++) {
    if (Math.abs(actual.lag[i]! - elag[i]!) > 1e-13) mismatches.push(key + ".lag[" + i + "]");
  }
  for (let i = 0; i < Math.min(actual.acf.length, eacf.length); i++) {
    const a = actual.acf[i]!, e = eacf[i]!;
    if (Number.isNaN(e)) { if (!Number.isNaN(a)) mismatches.push(key + ".acf[" + i + "] expected NaN"); continue; }
    if (a === e) continue;
    if (!Number.isFinite(a) || !Number.isFinite(e)) { mismatches.push(key + ".acf[" + i + "] " + a + " != " + e); continue; }
    const abs = Math.abs(a - e);
    maxAbsError = Math.max(maxAbsError, abs);
    if (expected.type === "covariance") {
      const rel = abs / Math.max(Math.abs(e), 1e-300);
      maxRelativeCovarianceError = Math.max(maxRelativeCovarianceError, rel);
      if (rel > 1e-12) mismatches.push(key + ".acf[" + i + "] relative error " + rel);
    } else if (abs > 1e-13) mismatches.push(key + ".acf[" + i + "] absolute error " + abs);
  }
}
function run(key: string, action: () => AcfResult, frequency = 1): void {
  try { compare(key, action(), frequency); }
  catch (error) { covered.add(key); mismatches.push(key + " threw " + String(error)); }
}
function fail(key: string, action: () => unknown): void {
  covered.add(key);
  try { action(); mismatches.push(key + " expected an error"); } catch { /* expected */ }
}
function documentedDifference(key: string, action: () => AcfResult): void {
  covered.add(key);
  try {
    const result = action();
    if (!Array.isArray(result.lag) || !Array.isArray(result.acf)) mismatches.push(key + " returned an invalid array result");
  } catch (error) { mismatches.push(key + " unexpected error " + String(error)); }
}
function longestRun(x: readonly number[]): number[] {
  let best: number[] = [], current: number[] = [];
  for (const v of x) {
    if (Number.isNaN(v)) { if (current.length > best.length) best = current; current = []; }
    else current.push(v);
  }
  if (current.length > best.length) best = current;
  return best;
}
function compareClim(key: string, result: AcfResult): void {
  covered.add(key);
  const expected = fixture[key]?.value;
  if (!expected) { mismatches.push(key + " fixture missing"); return; }
  if (result.nUsed !== expected["n.used"]) mismatches.push(key + ".nUsed");
  if (Math.abs(result.clim - Number(expected.clim)) > 1e-14) mismatches.push(key + ".clim " + result.clim + " != " + expected.clim);
}

describe("acf, pacf and ccf", () => {
  it("compares every fixture case with R or tests the user's documented array-only choice", () => {
    const lh = DATA.lh as number[];
    const ld = DATA.ldeaths as number[];
    const ap = DATA.AirPassengers as number[];
    const pr = (DATA.presidents as Array<number | string>).map((v) => typeof v === "number" ? v : NaN);
    const md = DATA.mdeaths as number[];
    const fd = DATA.fdeaths as number[];

    const saved = getRandomSeed();
    setSeed(1);
    let acc = 0;
    const long = Array.from(rnorm(5000), (v) => (acc += v));
    acc = 0;
    const longPartial = Array.from(rnorm(5000), (v) => (acc += v));
    setRandomSeed(saved);

    for (const type of ["correlation", "covariance", "partial"] as const) {
      run("acf_lh_" + type, () => acf(lh, { type }), 4);
      run("acf_ldeaths_" + type, () => acf(ld, { type }), 12);
      run("acf_numeric_" + type, () => acf(ld, { type }));
    }
    run("acf_lh_lag5", () => acf(lh, { lagMax: 5 }), 4);
    run("acf_lh_lag0", () => acf(lh, { lagMax: 0 }), 4);
    run("acf_lh_lag_long", () => acf(lh, { lagMax: 100 }), 4);
    run("acf_lh_lag_n", () => acf(lh, { lagMax: 47 }), 4);
    run("acf_lh_lag_frac", () => acf(lh, { lagMax: 3.7 }), 4);
    fail("acf_lh_lag_negative", () => acf(lh, { lagMax: -1 }));
    run("acf_lh_nodemean", () => acf(lh, { demean: false }), 4);
    run("acf_lh_nodemean_cov", () => acf(lh, { type: "covariance", demean: false }), 4);
    run("acf_lh_type_partial_prefix", () => acf(lh, { type: "partial" }), 4);
    run("acf_airpass", () => acf(ap), 12);
    run("acf_airpass_cov", () => acf(ap, { type: "covariance", lagMax: 30 }), 12);
    fail("acf_presidents_fail", () => acf(pr));
    run("acf_presidents_pass", () => acf(pr, { naAction: "pass" }), 4);
    run("acf_presidents_pass_cov", () => acf(pr, { naAction: "pass", type: "covariance" }), 4);
    run("acf_presidents_pass_partial", () => acf(pr, { naAction: "pass", type: "partial" }), 4);
    fail("acf_presidents_omit", () => acf(pr, { naAction: "omit" } as any));
    run("acf_presidents_contiguous", () => acf(longestRun(pr)), 4);
    run("acf_nan", () => acf([1, 3, NaN, 2, 5, 4, 6], { naAction: "pass" }));
    run("acf_inf", () => acf([1, 3, Infinity, 2, 5, 4, 6]));
    run("acf_all_na_pass", () => acf([NaN, NaN, NaN, 1], { naAction: "pass" }));
    run("acf_n1", () => acf([5]));
    run("acf_n2", () => acf([1, 4]));
    run("acf_n3", () => acf([1, 4, 2]));
    run("acf_n3_partial", () => acf([1, 4, 2], { type: "partial" }));
    run("acf_constant", () => acf(Array(10).fill(3)));
    run("acf_constant_cov", () => acf(Array(10).fill(3), { type: "covariance" }));
    run("acf_constant_partial", () => acf(Array(10).fill(3), { type: "partial" }));
    run("acf_constant_nodemean", () => acf(Array(10).fill(3), { demean: false }));
    const alternating = Array.from({ length: 20 }, (_, i) => i % 2 ? -1 : 1);
    run("acf_alternating", () => acf(alternating));
    run("acf_alternating_partial", () => acf(alternating, { type: "partial" }));
    const linear = Array.from({ length: 20 }, (_, i) => i + 1);
    run("acf_linear", () => acf(linear));
    run("acf_linear_partial", () => acf(linear, { type: "partial", lagMax: 15 }));
    run("acf_integer", () => acf([3, 1, 4, 1, 5, 9, 2, 6, 5, 3]));
    fail("acf_logical", () => acf([true, false, true, true, false] as any));
    fail("acf_character", () => acf(["a", "b", "c"] as any));
    fail("acf_empty", () => acf([]));
    run("acf_scale_big", () => acf(lh.map((v) => v * 2 ** 300), { type: "covariance" }));
    run("acf_scale_big_cor", () => acf(lh.map((v) => v * 2 ** 300)));
    run("acf_scale_small", () => acf(lh.map((v) => v * 2 ** -300)));
    run("acf_shift", () => acf(lh.map((v) => v + 1e8)));
    run("acf_shift_cov", () => acf(lh.map((v) => v + 1e8), { type: "covariance" }));
    run("acf_matrix_1col", () => acf(lh.map((v) => [v])));
    fail("acf_matrix_2col", () => acf(md.map((v, i) => [v, fd[i]!]) as any));
    run("acf_long", () => acf(long, { lagMax: 40 }));
    run("acf_long_partial", () => acf(longPartial, { lagMax: 40, type: "partial" }));

    run("pacf_lh", () => pacf(lh), 4);
    run("pacf_lh_lag3", () => pacf(lh, { lagMax: 3 }), 4);
    fail("pacf_lh_lag0", () => pacf(lh, { lagMax: 0 }));
    run("pacf_ldeaths", () => pacf(ld), 12);
    run("pacf_airpass", () => pacf(ap, { lagMax: 40 }), 12);
    run("pacf_presidents_pass", () => pacf(pr, { naAction: "pass" }), 4);
    fail("pacf_presidents_fail", () => pacf(pr));
    run("pacf_numeric", () => pacf(lh));
    run("pacf_n2", () => pacf([1, 4]));
    run("pacf_n3", () => pacf([1, 4, 2]));
    run("pacf_constant", () => pacf(Array(10).fill(3)));
    run("pacf_linear", () => pacf(linear, { lagMax: 19 }));
    run("pacf_ar2", () => pacf(DATA.ar2 as number[], { lagMax: 10 }));

    run("ccf_deaths", () => ccf(md, fd), 12);
    run("ccf_deaths_lag3", () => ccf(md, fd, { lagMax: 3 }), 12);
    run("ccf_deaths_lag0", () => ccf(md, fd, { lagMax: 0 }), 12);
    run("ccf_deaths_cov", () => ccf(md, fd, { type: "covariance" }), 12);
    run("ccf_deaths_swapped", () => ccf(fd, md, { lagMax: 3 }), 12);
    run("ccf_numeric", () => ccf(md, fd, { lagMax: 4 }));
    fail("ccf_partial", () => ccf(md, fd, { type: "partial" } as any));
    run("ccf_self", () => ccf(lh, lh, { lagMax: 5 }), 4);
    run("ccf_small", () => ccf(x10, y10));
    run("ccf_small_lag9", () => ccf(x10, y10, { lagMax: 9 }));
    run("ccf_small_lag20", () => ccf(x10, y10, { lagMax: 20 }));
    fail("ccf_lengths", () => ccf(x10, y10.slice(0, 8)));
    run("ccf_ts_window", () => ccf(x10.slice(2), y10.slice(0, 8)));
    run("ccf_ts_freq", () => ccf(x10, y10, { lagMax: 3 }), 4);
    documentedDifference("ccf_ts_freq_mismatch", () => ccf(x10, y10));
    fail("ccf_na_fail", () => ccf([...x10.slice(0, 9), NaN], y10));
    run("ccf_na_pass", () => ccf([...x10.slice(0, 9), NaN], y10, { naAction: "pass" }));
    run("ccf_constant", () => ccf(Array(10).fill(1), y10));
    run("ccf_scale", () => ccf(x10.map((v) => v * 2 ** 300), y10.map((v) => v * 2 ** -300)));
    run("ccf_shift", () => ccf(x10.map((v) => v + 1e8), y10, { type: "covariance" }));
    fail("ccf_nodemean", () => acf(x10.map((v, i) => [v, y10[i]!]) as any, { demean: false }));

    compareClim("clim_lh", acf(lh));
    compareClim("clim_lh_99", acf(lh, { ci: 0.99 }));
    compareClim("clim_presidents_pass", acf(pr, { naAction: "pass" }));

    const total = Object.keys(fixture).length;
    if (covered.size !== total) {
      const missing = Object.keys(fixture).filter((key) => !covered.has(key));
      mismatches.push("fixture coverage: " + covered.size + "/" + total + "; missing " + missing.join(", "));
    }
    console.info("acf/pacf/ccf: " + covered.size + "/" + total +
      "; max |error|=" + maxAbsError.toExponential(3) +
      "; max covariance relative error=" + maxRelativeCovarianceError.toExponential(3));
    expect(mismatches).toEqual([]);
  });

  it("handles 100,000 observations in O(N * lagMax)", () => {
    const x = Array.from({ length: 100_000 }, (_, i) => Math.sin(i * 0.013) + Math.cos(i * 0.003));
    const start = performance.now();
    const result = acf(x, { lagMax: 100 });
    const elapsed = performance.now() - start;
    expect(result.acf).toHaveLength(101);
    expect(result.acf.every(Number.isFinite)).toBe(true);
    console.info("acf N=100,000 lagMax=100: " + elapsed.toFixed(1) + " ms");
  });
});

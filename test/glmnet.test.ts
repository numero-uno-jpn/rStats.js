import { describe, expect, it } from "vitest";
import { cvGlmnet, glmnet, glmnetCoef, glmnetPredict } from "../src/models/glmnet.js";

const x = [
  [-2,1,2],[1,0,-1],[0,2,1],[2,-1,0],[-1,3,-2],[3,-2,3],
  [1,2,-3],[-3,1,2],[2,-3,1],[0,4,-1],[4,0,4],[-2,-1,0],
];
const y = [4,2,5,1,7,0,6,3,8,2,9,1];

describe("elastic-net generalized linear models", () => {
  it("matches the tight Gaussian lasso path and returns original-scale coefficients", () => {
    const fit = glmnet(x, y, { nlambda: 8, lambdaMinRatio: 0.01, thresh: 1e-12 });
    const expectedLambda = [
      0.647290715250188,0.335262586973981,0.173648408012529,0.0899407532389702,
      0.0465845854032229,0.0241283680538477,0.0124972271386075,0.00647290715250188,
    ];
    const expectedA0 = [4,3.88271173667072,3.75615476998144,3.64374026443544,
      3.58319834566978,3.55184082187821,3.53559926168872,3.52718699685476];
    const expectedBeta = [
      [0,0.184142045470072,0.319196192530147,0.384448641336019,0.418013681075416,0.435398595147185,0.444403078447611,0.449066916696125],
      [0,0.0811248221001654,0.221693632928668,0.324238056770425,0.37882152783322,0.407092036696673,0.421733611762455,0.429319239778872],
      [0,0,0,0.0679075465786879,0.106438680348254,0.126396248651913,0.136731683765038,0.142085953612111],
    ];
    for (let k = 0; k < expectedLambda.length; k++) {
      expect(fit.lambda[k]).toBeCloseTo(expectedLambda[k]!, 11);
      expect(fit.a0[k]).toBeCloseTo(expectedA0[k]!, 8);
      for (let j = 0; j < 3; j++) expect(fit.beta[k]![j]).toBeCloseTo(expectedBeta[j]![k]!, 7);
    }
    expect(fit.converged.every(Boolean)).toBe(true);
    expect(glmnetCoef(fit, fit.lambda[2])[0]![0]).toBeCloseTo(fit.a0[2]!, 12);
  });

  it("predicts on the response scale and interpolates coefficients on log lambda", () => {
    const fit = glmnet(x, y, { nlambda: 8, lambdaMinRatio: 0.01 });
    const s = fit.lambda[2]!;
    const link = glmnetPredict(fit, x.slice(0, 3), { s, type: "link" });
    const response = glmnetPredict(fit, x.slice(0, 3), { s, type: "response" });
    expect(response).toEqual(link);
    expect(glmnetCoef(fit, [0.75, 0.3])).toHaveLength(2);
    expect(link[0]).toHaveLength(3);
  });

  it("fits binomial and Poisson paths with finite coefficients", () => {
    const binomial = glmnet(x, [0,0,1,0,1,0,1,0,1,1,1,1], { family: "binomial", nlambda: 6 });
    const poisson = glmnet(x, [1,2,1,3,2,4,1,3,2,5,4,6], {
      family: "poisson", offset: Array.from({length: 12}, (_, i) => Math.log(1 + i / 11)), nlambda: 6,
    });
    expect(binomial.beta.flat().every(Number.isFinite)).toBe(true);
    expect(poisson.beta.flat().every(Number.isFinite)).toBe(true);
  });

  it("uses fixed folds for cross-validation and returns both lambda selections", () => {
    const cv = cvGlmnet(x, y, { foldid: [1,2,3,1,2,3,1,2,3,1,2,3], nlambda: 6, keep: true });
    expect(cv.lambdaMin).toBeGreaterThan(0);
    expect(cv.lambda1se).toBeGreaterThan(0);
    expect(cv.cvm.every(Number.isFinite)).toBe(true);
    expect(cv.cvsd.every(Number.isFinite)).toBe(true);
    expect(cv.fitPreval).toHaveLength(12);
  });

  it("rejects non-finite designs and one-column predictors", () => {
    expect(() => glmnet([[1],[2],[3]], [1,2,3])).toThrow();
    expect(() => glmnet([[1,2],[2,3],[NaN,4]], [1,2,3])).toThrow();
  });
});

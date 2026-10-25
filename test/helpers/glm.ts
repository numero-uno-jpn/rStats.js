// The glm fits of the fixture cases (oracle/_glm.R's arguments), shared by the glm tests
import { glm, type GlmOptions } from "../../src/index.js";
import { arg, defined, type HTestArg } from "./htest.js";

/** The fit of a case (oracle/_glm.R's arguments) */
export function fitCase(a: Record<string, HTestArg>): ReturnType<typeof glm> {
  const y = Array.isArray(a.y) && Array.isArray(a.y[0]) ? arg.mat(a.y)! : arg.vec(a.y)!;
  const lp = arg.num(a.linkPower);
  const opts: GlmOptions = defined({
    family: { family: arg.str(a.family) as never, ...defined({ variance: arg.str(a.variance) as never }) },
    link: lp !== undefined ? { power: lp } : (arg.str(a.link) as never),
    weights: arg.vec(a.weights),
    offset: arg.vec(a.offset),
    start: arg.vec(a.start),
    epsilon: arg.num(a.epsilon),
    maxit: arg.num(a.maxit),
    intercept: arg.bool(a.intercept),
  });
  return glm(arg.mat(a.x)!, y, opts);
}

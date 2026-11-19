import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  evaluateNlsWithGradient,
  parseNlsFormula,
} from "../src/models/nlsFormula.js";

interface ModelReference {
  args: Record<string, number>;
  result: {
    value: number[];
    gradient: { cols: string[]; values: number[][] };
  };
}
interface NlsFixture {
  models: {
    x: number[];
    SSasymp: ModelReference;
    SSasympOff: ModelReference;
    SSasympOrig: ModelReference;
    SSbiexp: ModelReference;
    SSfol: ModelReference;
    SSfpl: ModelReference;
    SSgompertz: ModelReference;
    SSlogis: ModelReference;
    SSmicmen: ModelReference;
    SSweibull: ModelReference;
  };
}

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("../test/fixtures/nls.json", import.meta.url)), "utf8")) as NlsFixture;

const formulas: Record<keyof Omit<NlsFixture["models"], "x">, string> = {
  SSasymp: "y ~ SSasymp(x, Asym, R0, lrc)",
  SSasympOff: "y ~ SSasympOff(x, Asym, lrc, c0)",
  SSasympOrig: "y ~ SSasympOrig(x, Asym, lrc)",
  SSbiexp: "y ~ SSbiexp(x, A1, lrc1, A2, lrc2)",
  SSfol: "y ~ SSfol(Dose, x, lKe, lKa, lCl)",
  SSfpl: "y ~ SSfpl(x, A, B, xmid, scal)",
  SSgompertz: "y ~ SSgompertz(x, Asym, b2, b3)",
  SSlogis: "y ~ SSlogis(x, Asym, xmid, scal)",
  SSmicmen: "y ~ SSmicmen(x, Vm, K)",
  SSweibull: "y ~ SSweibull(x, Asym, Drop, lrc, pwr)",
};

describe("nonlinear formula parser and symbolic derivatives", () => {
  it("parses arithmetic precedence, unary operators, and supported functions", () => {
    const parsed = parseNlsFormula("y ~ -a * x^2 + exp(b) / sqrt(x)");
    const result = evaluateNlsWithGradient(parsed.expression, { x: 2 }, { a: 3, b: 0 }, ["a", "b"]);
    expect(result.value).toBeCloseTo(-10 + 1 / Math.sqrt(2), 14);
    expect(result.gradient[0]).toBeCloseTo(-4, 14);
    expect(result.gradient[1]).toBeCloseTo(1 / Math.sqrt(2), 14);
  });

  it("rejects unsupported functions, operators, and malformed formulae", () => {
    expect(() => parseNlsFormula("y ~ unknown(x)")).toThrow(/unsupported nonlinear function/);
    expect(() => parseNlsFormula("y ~ x % x")).toThrow(/unexpected character/);
    expect(() => parseNlsFormula("y + x")).toThrow(/response ~ expression/);
    expect(() => parseNlsFormula("y ~ exp(x")).toThrow(/unbalanced parentheses/);
  });

  it.each(Object.keys(formulas) as (keyof typeof formulas)[])("matches the public value and gradient oracle for %s", name => {
    const model = fixture.models[name];
    const parsed = parseNlsFormula(formulas[name]);
    const names = model.result.gradient.cols;
    for (let i = 0; i < fixture.models.x.length; i++) {
      const x = fixture.models.x[i]!;
      const data: Record<string, number> = { x, Dose: model.args.Dose ?? 4 };
      const got = evaluateNlsWithGradient(parsed.expression, data, model.args, names);
      expect(got.value).toBeCloseTo(model.result.value[i]!, 12);
      const expectedGradient = model.result.gradient.values[i]!;
      for (let j = 0; j < names.length; j++) {
        expect(got.gradient[j]).toBeCloseTo(expectedGradient[j]!, 11);
      }
    }
  });
});

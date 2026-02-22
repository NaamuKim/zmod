import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { j } from "../src/jscodeshift";

const fixturesRoot = join(__dirname, "../../../fixtures/react");

const fixtures = existsSync(fixturesRoot)
  ? readdirSync(fixturesRoot).filter((name) => {
      const dir = join(fixturesRoot, name);
      return (
        existsSync(join(dir, "input.tsx")) &&
        existsSync(join(dir, "expected-output.tsx")) &&
        existsSync(join(dir, "transform.ts"))
      );
    })
  : [];

describe("jscodeshift-style fixtures", () => {
  for (const fixture of fixtures) {
    it(`fixture: ${fixture}`, async () => {
      const dir = join(fixturesRoot, fixture);
      const input = readFileSync(join(dir, "input.tsx"), "utf-8");
      const expected = readFileSync(join(dir, "expected-output.tsx"), "utf-8");
      const mod = await import(join(dir, "transform.ts"));
      const transform = mod.default;

      const result = transform(
        { source: input, path: join(dir, "input.tsx") },
        { j, report: console.log },
      );

      expect(result).toBe(expected);
    });
  }
});

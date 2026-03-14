import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { z } from "../src/jscodeshift.js";

interface FixtureDir {
  label: string;
  root: string;
  ext: string;
}

const fixtureDirs: FixtureDir[] = [
  { label: "react", root: join(__dirname, "../../../fixtures/react"), ext: "tsx" },
  { label: "custom-parser", root: join(__dirname, "../../../fixtures/custom-parser"), ext: "ts" },
];

function collectFixtures(dir: string, ext: string) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => {
    const d = join(dir, name);
    return (
      existsSync(join(d, `input.${ext}`)) &&
      existsSync(join(d, `expected-output.${ext}`)) &&
      existsSync(join(d, "transform.ts"))
    );
  });
}

describe("jscodeshift-style fixtures", () => {
  for (const { label, root, ext } of fixtureDirs) {
    const fixtures = collectFixtures(root, ext);

    for (const fixture of fixtures) {
      it(`fixture: ${label}/${fixture}`, async () => {
        const dir = join(root, fixture);
        const input = readFileSync(join(dir, `input.${ext}`), "utf-8");
        const expected = readFileSync(join(dir, `expected-output.${ext}`), "utf-8");
        const mod = await import(join(dir, "transform.ts"));
        const transform = mod.default;

        const activeZ = mod.parser ? z.withParser(mod.parser) : z;

        const result = transform(
          { source: input, path: join(dir, `input.${ext}`) },
          { z: activeZ, report: console.log },
        );

        expect(result).toBe(expected);
      });
    }
  }
});

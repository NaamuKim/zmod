import { describe, expect, it } from "vitest";
import { transformFile } from "../src/transform.js";

describe("transformFile — basic jscodeshift migration", () => {
  it("returns null for non-jscodeshift files", () => {
    const source = `export default function transform(file, api) { return file.source; }`;
    expect(transformFile(source)).toBeNull();
  });

  it("removes jscodeshift import", () => {
    const source = `import j from "jscodeshift";\nexport default function transform(file) { return file.source; }`;
    const result = transformFile(source);
    expect(result).not.toBeNull();
    expect(result).not.toContain(`from "jscodeshift"`);
  });

  it("adds import type { Transform } from 'zmod'", () => {
    const source = `import j from "jscodeshift";\nexport default function transform(file) { return file.source; }`;
    const result = transformFile(source)!;
    expect(result).toContain(`import type { Transform } from "zmod"`);
  });

  it("removes const j = api.jscodeshift", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export default function transform(file, api) {`,
      `  const j = api.jscodeshift;`,
      `  return file.source;`,
      `}`,
    ].join("\n");
    const result = transformFile(source)!;
    expect(result).not.toContain("api.jscodeshift");
  });

  it("renames { j } → { z } in transform params", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export default function transform(file, { j }) {`,
      `  return file.source;`,
      `}`,
    ].join("\n");
    const result = transformFile(source)!;
    expect(result).toContain("{ z }");
    expect(result).not.toContain("{ j }");
  });

  it("renames j.CallExpression → z.CallExpression (member expression)", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export default function transform(file, { j }) {`,
      `  return j(file.source).find(j.CallExpression).toSource();`,
      `}`,
    ].join("\n");
    const result = transformFile(source)!;
    expect(result).toContain("z.CallExpression");
    expect(result).not.toContain("j.CallExpression");
  });

  it("renames j(source) → z(source) (call expression)", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export default function transform(file, { j }) {`,
      `  const root = j(file.source);`,
      `  return root.toSource();`,
      `}`,
    ].join("\n");
    const result = transformFile(source)!;
    expect(result).toContain("z(file.source)");
    expect(result).not.toMatch(/\bj\(file\.source\)/);
  });
});

describe("transformFile — string parser conversion", () => {
  it("converts export const parser = 'ts' to Parser object", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export const parser = 'ts';`,
      `export default function transform(file, { j }) { return file.source; }`,
    ].join("\n");
    const result = transformFile(source)!;
    expect(result).toContain("export const parser: Parser = {");
    expect(result).toContain(`plugins: ["typescript"]`);
    expect(result).toContain(`sourceType: "module"`);
    expect(result).not.toContain(`= 'ts'`);
  });

  it("converts export const parser = 'tsx' to Parser object with typescript+jsx", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export const parser = 'tsx';`,
      `export default function transform(file, { j }) { return file.source; }`,
    ].join("\n");
    const result = transformFile(source)!;
    expect(result).toContain(`plugins: ["typescript", "jsx"]`);
  });

  it("converts export const parser = 'babel' to Parser object with jsx", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export const parser = 'babel';`,
      `export default function transform(file, { j }) { return file.source; }`,
    ].join("\n");
    const result = transformFile(source)!;
    expect(result).toContain(`plugins: ["jsx"]`);
  });

  it("converts export const parser = 'babylon' to Parser object with jsx", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export const parser = 'babylon';`,
      `export default function transform(file, { j }) { return file.source; }`,
    ].join("\n");
    const result = transformFile(source)!;
    expect(result).toContain(`plugins: ["jsx"]`);
  });

  it("converts export const parser = 'flow' to Parser object with jsx+flow", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export const parser = 'flow';`,
      `export default function transform(file, { j }) { return file.source; }`,
    ].join("\n");
    const result = transformFile(source)!;
    expect(result).toContain(`plugins: ["jsx", "flow"]`);
  });

  it("adds Parser type import when parser is converted", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export const parser = 'ts';`,
      `export default function transform(file, { j }) { return file.source; }`,
    ].join("\n");
    const result = transformFile(source)!;
    expect(result).toContain(`import type { Transform, Parser } from "zmod"`);
  });

  it("adds @babel/parser import when parser is converted", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export const parser = 'ts';`,
      `export default function transform(file, { j }) { return file.source; }`,
    ].join("\n");
    const result = transformFile(source)!;
    expect(result).toContain(`import { parse } from "@babel/parser"`);
  });

  it("does not add Parser or @babel/parser when no string parser export", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export default function transform(file, { j }) { return file.source; }`,
    ].join("\n");
    const result = transformFile(source)!;
    expect(result).not.toContain(`Parser`);
    expect(result).not.toContain(`@babel/parser`);
  });

  it("generates parser with options passthrough (...options)", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export const parser = 'ts';`,
      `export default function transform(file, { j }) { return file.source; }`,
    ].join("\n");
    const result = transformFile(source)!;
    expect(result).toContain("...options");
  });

  it("ignores non-exported const parser = '...'", () => {
    const source = [
      `import j from "jscodeshift";`,
      `const parser = 'ts';`,
      `export default function transform(file, { j }) { return file.source; }`,
    ].join("\n");
    const result = transformFile(source)!;
    // No Parser type, no @babel/parser — string was not an export
    expect(result).not.toContain("Parser");
    expect(result).not.toContain("@babel/parser");
  });

  it("ignores unknown parser alias", () => {
    const source = [
      `import j from "jscodeshift";`,
      `export const parser = 'esprima';`,
      `export default function transform(file, { j }) { return file.source; }`,
    ].join("\n");
    const result = transformFile(source)!;
    // Should not crash, and should not convert unknown alias
    expect(result).not.toContain("Parser = {");
    expect(result).not.toContain("@babel/parser");
  });
});

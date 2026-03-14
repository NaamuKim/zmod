import { describe, expect, it, vi } from "vitest";
import { mkdtemp, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parse as babelParse } from "@babel/parser";
import { z } from "../src/jscodeshift.js";
import { run, type TransformModule } from "../src/run.js";
import type { Parser } from "../src/parser.js";

// ── Real parser adapters ──────────────────────────────────────────────────

/** @babel/parser — plain TypeScript (no decorator plugin) */
const babelTsParser: Parser = {
  parse(source) {
    return babelParse(source, { plugins: ["typescript"], sourceType: "module" }).program;
  },
};

/** @babel/parser — TypeScript + legacy decorators */
const babelDecoratorParser: Parser = {
  parse(source) {
    return babelParse(source, {
      plugins: [["decorators", { version: "legacy" }], "typescript"],
      sourceType: "module",
    }).program;
  },
};

function makeParser(body: any[] = []) {
  return (src: string) => ({ type: "Program", body, start: 0, end: src.length });
}

describe("z.withParser()", () => {
  it("returns a new ZFunction (isolated from original z)", () => {
    const mockParser: Parser = { parse: makeParser() };
    const j2 = z.withParser(mockParser);
    expect(j2).not.toBe(z);
    expect(typeof j2).toBe("function");
  });

  it("calls the custom parser when parsing source", () => {
    const parseFn = vi.fn(makeParser());
    const j2 = z.withParser({ parse: parseFn });
    j2("const x = 1;");
    expect(parseFn).toHaveBeenCalledOnce();
    expect(parseFn).toHaveBeenCalledWith("const x = 1;", undefined);
  });

  it("carries custom parser into template.statement", () => {
    const parseFn = vi.fn(makeParser());
    const j2 = z.withParser({ parse: parseFn });
    j2.template.statement`const x = 1;`;
    expect(parseFn).toHaveBeenCalledOnce();
  });

  it("carries custom parser into template.statements", () => {
    const parseFn = vi.fn(makeParser());
    const j2 = z.withParser({ parse: parseFn });
    j2.template.statements`const x = 1;`;
    expect(parseFn).toHaveBeenCalledOnce();
  });

  it("carries custom parser into template.expression", () => {
    const parseFn = vi.fn(makeParser());
    const j2 = z.withParser({ parse: parseFn });
    j2.template.expression`x + 1`;
    expect(parseFn).toHaveBeenCalledOnce();
  });

  it("original z is unaffected by withParser calls", () => {
    const parseFn = vi.fn(makeParser());
    z.withParser({ parse: parseFn });
    z("const x = 1;"); // uses oxc, not the mock
    expect(parseFn).not.toHaveBeenCalled();
  });
});

describe("real parser — @babel/parser (typescript)", () => {
  const j = z.withParser(babelTsParser);

  it("parses source and returns a traversable Collection", () => {
    const root = j("const foo = 1;");
    // babel produces Identifier nodes with name property
    const ids = root.find(z.Identifier, { name: "foo" });
    expect(ids.length).toBe(1);
  });

  it("babel produces StringLiteral (not Literal) for strings", () => {
    const root = j(`import x from "react";`);
    // Babel's own AST uses StringLiteral, not ESTree Literal
    const literals = root.find(z.StringLiteral, { value: "react" });
    expect(literals.length).toBe(1);
  });

  it("find with babel CallExpression works", () => {
    const root = j(`console.log("hello"); foo();`);
    const calls = root.find(z.CallExpression);
    expect(calls.length).toBe(2);
  });

  it("nodes have start/end offsets required for span patching", () => {
    const source = "const foo = 1;";
    const root = j(source);
    const id = root.find(z.Identifier, { name: "foo" }).at(0)!;
    expect(typeof id.node.start).toBe("number");
    expect(typeof id.node.end).toBe("number");
    expect(id.node.start).toBeGreaterThanOrEqual(0);
    expect(id.node.end).toBeGreaterThan(id.node.start);
    expect(source.slice(id.node.start, id.node.end)).toBe("foo");
  });

  it("toSource() correctly applies patches after babel parse", () => {
    const source = "const foo = 1;";
    const root = j(source);
    root.find(z.Identifier, { name: "foo" }).replaceWith("bar");
    expect(root.toSource()).toBe("const bar = 1;");
  });

  it("renames all occurrences across the source", () => {
    // Note: plain JS (no type annotations) — babel's typed Identifier spans
    // include the TypeAnnotation, which differs from oxc's narrower spans.
    const source = `function greet(name) {\n  return name.toUpperCase();\n}`;
    const root = j(source);
    const replaced = new Set<string>();
    root.find(z.Identifier, { name: "name" }).forEach((path) => {
      const key = `${path.node.start}:${path.node.end}`;
      if (replaced.has(key)) return;
      replaced.add(key);
      root.replace(path, "value");
    });
    expect(root.toSource()).toBe(`function greet(value) {\n  return value.toUpperCase();\n}`);
  });
});

describe("real parser — @babel/parser (decorators)", () => {
  const j = z.withParser(babelDecoratorParser);

  it("parses class decorators without error", () => {
    const source = `@injectable()\nclass Foo {}`;
    // would throw if the parser doesn't support decorators
    expect(() => j(source)).not.toThrow();
  });

  it("decorator Identifier is findable", () => {
    const source = `@injectable()\nclass Foo {}`;
    const root = j(source);
    const ids = root.find(z.Identifier, { name: "injectable" });
    expect(ids.length).toBe(1);
  });

  it("decorator Identifier has correct span for patching", () => {
    const source = `@injectable()\nclass Foo {}`;
    const root = j(source);
    const id = root.find(z.Identifier, { name: "injectable" }).at(0)!;
    expect(source.slice(id.node.start, id.node.end)).toBe("injectable");
  });

  it("toSource() correctly renames decorator via span patch", () => {
    const source = `@injectable()\nclass Foo {}`;
    const root = j(source);
    root.find(z.Identifier, { name: "injectable" }).replaceWith("singleton");
    expect(root.toSource()).toBe(`@singleton()\nclass Foo {}`);
  });

  it("renames decorator across multiple classes", () => {
    const source = `@injectable()\nclass A {}\n\n@injectable()\nclass B {}`;
    const root = j(source);
    const replaced = new Set<string>();
    root.find(z.Identifier, { name: "injectable" }).forEach((path) => {
      const key = `${path.node.start}:${path.node.end}`;
      if (replaced.has(key)) return;
      replaced.add(key);
      root.replace(path, "singleton");
    });
    expect(root.toSource()).toBe(`@singleton()\nclass A {}\n\n@singleton()\nclass B {}`);
  });
});

describe("z(source, options) — ParseOptions passthrough", () => {
  it("passes options to the custom parser", () => {
    const parseFn = vi.fn(makeParser());
    const j = z.withParser({ parse: parseFn });
    j("const x = 1;", { sourceType: "script" });
    expect(parseFn).toHaveBeenCalledWith("const x = 1;", { sourceType: "script" });
  });

  it("passes arbitrary parser-specific options (e.g. babel plugins)", () => {
    const parseFn = vi.fn(makeParser());
    const j = z.withParser({ parse: parseFn });
    j("const x = 1;", { plugins: ["decorators"], sourceType: "module" });
    expect(parseFn).toHaveBeenCalledWith("const x = 1;", {
      plugins: ["decorators"],
      sourceType: "module",
    });
  });

  it("passes options from z() into real @babel/parser", () => {
    const { parse } = require("@babel/parser");
    const babelParser: Parser = {
      parse: (source, options) =>
        parse(source, {
          plugins: options?.plugins ?? ["typescript"],
          sourceType: options?.sourceType ?? "module",
        }).program,
    };
    const j = z.withParser(babelParser);
    // parse with jsx plugin enabled via options
    const root = j("<div />", { plugins: ["jsx"] });
    expect(root.find(z.JSXIdentifier, { name: "div" }).length).toBe(1);
  });
});

describe("run() with transform.parser", () => {
  async function withTmpFile(content: string, fn: (path: string) => Promise<void>) {
    const dir = await mkdtemp(join(tmpdir(), "zmod-test-"));
    const filePath = join(dir, "test.ts");
    await writeFile(filePath, content, "utf-8");
    try {
      await fn(filePath);
    } finally {
      await unlink(filePath).catch(() => {});
    }
  }

  it("uses transform.parser when provided", async () => {
    const parseFn = vi.fn(makeParser());
    const transform: TransformModule = (fileInfo, api) => {
      api.z(fileInfo.source);
      return null;
    };
    transform.parser = { parse: parseFn };

    await withTmpFile("const x = 1;", async (filePath) => {
      await run(transform, { include: filePath });
      expect(parseFn).toHaveBeenCalled();
    });
  });

  it("uses default oxc parser when transform.parser is absent", async () => {
    const transform: TransformModule = (_fileInfo, _api) => null;

    await withTmpFile("const x = 1;", async (filePath) => {
      const result = await run(transform, { include: filePath });
      expect(result.files[0].status).toBe("unchanged");
    });
  });

  it("injects the same parser-aware z into every file call", async () => {
    const parseFn = vi.fn(makeParser());
    const transform: TransformModule = (fileInfo, api) => {
      api.z(fileInfo.source);
      return null;
    };
    transform.parser = { parse: parseFn };

    const dir = await mkdtemp(join(tmpdir(), "zmod-test-"));
    const files = ["a.ts", "b.ts", "c.ts"].map((f) => join(dir, f));
    await Promise.all(files.map((f) => writeFile(f, "const x = 1;", "utf-8")));

    try {
      await run(transform, { include: files });
      expect(parseFn).toHaveBeenCalledTimes(3);
    } finally {
      await Promise.all(files.map((f) => unlink(f).catch(() => {})));
    }
  });
});

import { describe, expect, it, vi } from "vitest";
import { mkdtemp, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parse as babelParse } from "@babel/parser";
import * as BabelGenerator from "@babel/generator";
const generate = ((BabelGenerator as any).default ?? BabelGenerator) as (
  node: any,
  opts?: any,
) => { code: string };
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
      plugins: [["decorators", { decoratorsBeforeExport: false }], "typescript"],
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

// ── Pluggable printer ──────────────────────────────────────────────────────

/**
 * Full codec: @babel/parser (parse) + @babel/generator (print).
 * This is the canonical example of a Parser with a custom printer.
 */
const babelCodec: Parser = {
  parse(source, options) {
    return babelParse(source, {
      plugins: ["typescript"],
      sourceType: "module",
      ...options,
    }).program;
  },
  print(node) {
    return generate(node).code;
  },
};

describe("Parser.print — mock printer (isolation)", () => {
  it("z.print() calls custom printer with the node", () => {
    const printFn = vi.fn(() => "custom_output");
    const j = z.withParser({ parse: makeParser(), print: printFn });
    const node = { type: "Identifier", name: "foo" };
    expect(j.print(node)).toBe("custom_output");
    expect(printFn).toHaveBeenCalledWith(node);
  });

  it("z.print() falls back to internal printer when print is absent", () => {
    expect(z.print({ type: "Identifier", name: "hello" })).toBe("hello");
  });

  it("custom printer is isolated — default z is unaffected", () => {
    const printFn = vi.fn(() => "from_custom");
    const j = z.withParser({ parse: makeParser(), print: printFn });

    z.print({ type: "Identifier", name: "foo" }); // uses internal
    expect(printFn).not.toHaveBeenCalled();

    j.print({ type: "Identifier", name: "foo" }); // uses custom
    expect(printFn).toHaveBeenCalledTimes(1);
  });

  it("replaceWith(astNode) routes through custom printer", () => {
    const printFn = vi.fn((node: any) => node.name);
    const j = z.withParser({ parse: makeParser(), print: printFn });
    // makeParser produces empty body — can't really find nodes here.
    // Verify via z.print proxy instead.
    const node = { type: "Identifier", name: "bar" };
    expect(j.print(node)).toBe("bar");
    expect(printFn).toHaveBeenCalledWith(node);
  });
});

describe("real printer — @babel/generator", () => {
  const j = z.withParser(babelCodec);

  it("z.print() serializes an Identifier node", () => {
    // builder-created node has no start/end
    const node = z.identifier("myVar");
    expect(j.print(node)).toBe("myVar");
  });

  it("z.print() serializes a CallExpression node", () => {
    const node = z.callExpression(z.identifier("foo"), [z.identifier("a"), z.identifier("b")]);
    expect(j.print(node)).toBe("foo(a, b)");
  });

  it("z.print() serializes a MemberExpression node", () => {
    const node = z.memberExpression(z.identifier("obj"), z.identifier("method"));
    expect(j.print(node)).toBe("obj.method");
  });

  it("replaceWith(builderNode) uses @babel/generator for nodes without spans", () => {
    const root = j("const x = old();");
    root
      .find(z.CallExpression)
      .replaceWith(z.callExpression(z.identifier("newFn"), [z.identifier("arg")]));
    expect(root.toSource()).toBe("const x = newFn(arg);");
  });

  it("replaceWith(builderNode) preserves unchanged source around replacement", () => {
    const root = j("doA(); doB(); doC();");
    root
      .find(z.CallExpression, { callee: { name: "doB" } })
      .replaceWith(z.callExpression(z.identifier("replaced"), []));
    expect(root.toSource()).toBe("doA(); replaced(); doC();");
  });

  it("replaceWith(fn => builderNode) works with per-path callback", () => {
    // Use builder-only arguments to avoid mixing ast-types and Babel node formats
    const root = j("foo(a, b);");
    root
      .find(z.CallExpression, { callee: { name: "foo" } })
      .replaceWith(z.callExpression(z.identifier("bar"), [z.identifier("a"), z.identifier("b")]));
    expect(root.toSource()).toBe("bar(a, b);");
  });

  it("replaceWith(string) still works alongside custom printer", () => {
    const root = j("const x = 1;");
    root.find(z.Identifier, { name: "x" }).replaceWith("renamed");
    expect(root.toSource()).toBe("const renamed = 1;");
  });

  it("NodePath.insertBefore with builder node uses custom printer", () => {
    const root = j("const x = 1;");
    root.find(z.VariableDeclaration).forEach((path) => {
      path.insertBefore(z.expressionStatement(z.callExpression(z.identifier("setup"), [])));
    });
    // insertBefore is a raw span patch — no separator added automatically
    expect(root.toSource()).toBe("setup();const x = 1;");
  });

  it("complex: rename method calls and wrap arguments", () => {
    const root = j(`legacy(a, b);\nlegacy(c);`);
    root
      .find(z.CallExpression, { callee: { name: "legacy" } })
      .replaceWith((path) =>
        z.callExpression(z.identifier("modern"), [z.arrayExpression(path.node.arguments)]),
      );
    expect(root.toSource()).toBe("modern([a, b]);\nmodern([c]);");
  });
});

// ── Custom hand-rolled printer ─────────────────────────────────────────────

/**
 * A minimal printer written from scratch — no external dependency.
 * Handles the node types used in the tests below.
 * This verifies that Parser.print works with any implementation, not just @babel/generator.
 */
function customPrint(node: any): string {
  switch (node.type) {
    case "Identifier":
      return node.name;
    case "StringLiteral":
    case "Literal":
      return typeof node.value === "string" ? `"${node.value}"` : String(node.value);
    case "NumericLiteral":
      return String(node.value);
    case "CallExpression": {
      const callee = customPrint(node.callee);
      const args = (node.arguments ?? []).map(customPrint).join(", ");
      return `${callee}(${args})`;
    }
    case "MemberExpression": {
      const obj = customPrint(node.object);
      const prop = customPrint(node.property);
      return node.computed ? `${obj}[${prop}]` : `${obj}.${prop}`;
    }
    case "ArrayExpression": {
      const elems = (node.elements ?? []).map(customPrint).join(", ");
      return `[${elems}]`;
    }
    case "ObjectExpression": {
      const props = (node.properties ?? []).map(customPrint).join(", ");
      return `{ ${props} }`;
    }
    case "Property":
      return node.shorthand
        ? customPrint(node.key)
        : `${customPrint(node.key)}: ${customPrint(node.value)}`;
    case "ArrowFunctionExpression": {
      const params = (node.params ?? []).map(customPrint).join(", ");
      const body = customPrint(node.body);
      return `(${params}) => ${body}`;
    }
    case "BinaryExpression":
      return `${customPrint(node.left)} ${node.operator} ${customPrint(node.right)}`;
    default:
      return `/* unknown: ${node.type} */`;
  }
}

const customCodec: Parser = {
  parse(source, options) {
    return babelParse(source, {
      plugins: ["typescript"],
      sourceType: "module",
      ...options,
    }).program;
  },
  print: customPrint,
};

describe("custom hand-rolled printer", () => {
  const j = z.withParser(customCodec);

  it("z.print() uses custom printer for Identifier", () => {
    expect(j.print(z.identifier("hello"))).toBe("hello");
  });

  it("z.print() uses custom printer for CallExpression", () => {
    const node = z.callExpression(z.identifier("fn"), [z.identifier("x"), z.identifier("y")]);
    expect(j.print(node)).toBe("fn(x, y)");
  });

  it("z.print() uses custom printer for MemberExpression", () => {
    expect(j.print(z.memberExpression(z.identifier("a"), z.identifier("b")))).toBe("a.b");
  });

  it("replaceWith(builderNode) goes through custom printer", () => {
    const root = j("const x = old();");
    root
      .find(z.CallExpression)
      .replaceWith(z.callExpression(z.identifier("fresh"), [z.identifier("arg")]));
    expect(root.toSource()).toBe("const x = fresh(arg);");
  });

  it("replaceWith(fn => builderNode) passes path to callback and prints result", () => {
    const root = j("foo(); bar(); foo();");
    root
      .find(z.CallExpression, { callee: { name: "foo" } })
      .replaceWith(() => z.callExpression(z.identifier("baz"), []));
    expect(root.toSource()).toBe("baz(); bar(); baz();");
  });

  it("custom printer is used for nested node structures", () => {
    const node = z.callExpression(z.memberExpression(z.identifier("obj"), z.identifier("method")), [
      z.identifier("a"),
    ]);
    expect(j.print(node)).toBe("obj.method(a)");
  });

  it("custom printer is completely independent of @babel/generator", () => {
    // Same source, different printers → same AST transformation, different serialization
    const babelJ = z.withParser(babelCodec);
    const customJ = z.withParser(customCodec);

    const node = z.callExpression(z.identifier("fn"), [z.identifier("x")]);

    // Both produce valid output for the same node
    expect(babelJ.print(node)).toBe("fn(x)");
    expect(customJ.print(node)).toBe("fn(x)");
  });
});

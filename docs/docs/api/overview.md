# API Overview

## `z(source)`

Parse source code and return a `Collection`.

```ts
import { z } from "zmod";

const root = z(source);
```

## Collection

### `.find(type, filter?)`

Find all nodes of a given type with an optional filter.

```ts
root.find(z.CallExpression, { callee: { name: "useState" } });
```

### `.replaceWith(node | fn)`

Replace each matched node.

```ts
root.find(z.Identifier, { name: "foo" }).replaceWith(z.identifier("bar"));
```

### `.remove()`

Remove each matched node.

```ts
root.find(z.ImportDeclaration).remove();
```

### `.forEach(fn)`

Iterate over matched nodes.

```ts
root.find(z.Identifier).forEach((path) => {
  console.log(path.node.name);
});
```

### `.filter(fn)`

Filter matched nodes.

```ts
root.find(z.Identifier).filter((path) => path.node.name.startsWith("use"));
```

### `.closest(type)`

Traverse up to find the closest ancestor of a given type.

```ts
root.find(z.Identifier).closest(z.FunctionDeclaration);
```

### `.toSource()`

Apply all patches and return the modified source.

```ts
return root.toSource();
```

## `z.withParser(parser)`

Return a new `z` function that uses a custom parser instead of the default oxc.

```ts
import { z } from "zmod";
import { parse } from "@babel/parser";

const j = z.withParser({
  parse(source) {
    return parse(source, { plugins: ["typescript"], sourceType: "module" }).program;
  },
});

const root = j(source);
```

The original `z` is unaffected — `withParser` always returns a new, isolated instance.

## `z.print(node)`

Serialize an AST node to source code using the active printer.

```ts
const code = z.print(z.identifier("foo")); // "foo"
const code = z.print(z.callExpression(z.identifier("fn"), [])); // "fn()"
```

Falls back to zmod's internal printer when no custom `print` is provided via `withParser`.

## `Parser` interface

Any object with a `parse` method that returns an ESTree-compatible `Program` node. Optionally provides a `print` method to enable AST node serialization.

```ts
import type { Parser } from "zmod";

const myParser: Parser = {
  parse(source: string) {
    // Must return an ESTree Program where every node has
    // numeric `start` and `end` byte-offset properties.
    return myAstLibrary.parse(source);
  },
};
```

### `Parser.print` — pluggable printer

Adding `print` to your parser enables:

- **`replaceWith(astNode)`** — replace with a builder-created node instead of a string
- **`z.print(node)`** — manually serialize any AST node

```ts
import { parse as babelParse } from "@babel/parser";
import generate from "@babel/generator";
import type { Parser } from "zmod";

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

const j = z.withParser(babelCodec);

// Now builder nodes work in replaceWith:
root
  .find(z.CallExpression, { callee: { name: "legacy" } })
  .replaceWith((path) =>
    z.callExpression(
      z.memberExpression(z.identifier("api"), z.identifier("call")),
      path.node.arguments,
    ),
  );
```

Without `print`, zmod falls back to its internal printer which handles common ESTree node types. The internal printer is sufficient for simple identifier/string replacements.

**Requirements for custom parsers:**

- Returns an ESTree-compatible AST
- Every node must have `start` and `end` as numeric byte offsets (used for span-based patching)
- `Program.body` must be an array

Compatible parsers: `@babel/parser`, `acorn`, SWC (ESTree mode).

## `export const parser` in transforms

A transform file can export a `parser` to override the parser used by `run()` — identical to jscodeshift's pattern:

```ts
import { parse } from "@babel/parser";
import type { Parser, Transform } from "zmod";

// run() picks this up automatically
export const parser: Parser = {
  parse(source) {
    return parse(source, {
      plugins: [["decorators", { version: "legacy" }], "typescript"],
      sourceType: "module",
    }).program;
  },
};

const transform: Transform = ({ source }, { z }) => {
  return z(source).find(z.Identifier, { name: "injectable" }).replaceWith("singleton").toSource();
};

export default transform;
```

## `oxcParser`

The default parser used by `z`. Can be imported directly if needed:

```ts
import { oxcParser } from "zmod";
```

## `run(transform, options)`

Batch-run a transform over files matching a glob pattern.

```ts
import { run } from "zmod";

await run(transform, { include: "src/**/*.tsx" });
```

If the transform exports a `parser`, `run()` automatically uses it for all files.

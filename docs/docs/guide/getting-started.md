# Getting Started

## Installation

```bash
npm install zmod
# or
pnpm add zmod
```

## Basic Usage

### Simple API

No AST traversal needed for common transformations.

```ts
import { transform } from "zmod";

transform(source, {
  renames: { foo: "bar" },
  imports: {
    replaceSource: { "react-dom/test-utils": "react" },
    removeSpecifier: ["act"],
  },
});
```

### jscodeshift-compatible API

Full AST traversal for complex transformations. Drop-in replacement for jscodeshift.

```ts
import type { Transform } from "zmod";

const transform: Transform = ({ source }, { z }) => {
  return z(source)
    .find(z.CallExpression, {
      callee: { name: "React.forwardRef" },
    })
    .replaceWith((path) => path.node.arguments[0])
    .toSource();
};

export default transform;
```

## Running a Transform

```ts
import { run } from "zmod";
import transform from "./my-transform";

await run(transform, { include: "src/**/*.tsx" });
```

## Custom Parsers

By default zmod uses [oxc](https://oxc.rs/) to parse source files. You can swap in any ESTree-compatible parser using `z.withParser()`.

### Inline override

```ts
import { z } from "zmod";
import { parse } from "@babel/parser";

const j = z.withParser({
  parse(source) {
    return parse(source, {
      plugins: [["decorators", { version: "legacy" }], "typescript"],
      sourceType: "module",
    }).program;
  },
});

export default function transform({ source }) {
  return j(source).find(j.Identifier, { name: "injectable" }).replaceWith("singleton").toSource();
}
```

### Per-transform parser export

Export a `parser` from your transform file and `run()` will pick it up automatically:

```ts
import type { Parser, Transform } from "zmod";
import { parse } from "@babel/parser";

export const parser: Parser = {
  parse(source) {
    return parse(source, { plugins: ["typescript"], sourceType: "module" }).program;
  },
};

const transform: Transform = ({ source }, { z }) => {
  // z here already uses the exported parser
  return z(source).find(z.Identifier, { name: "foo" }).replaceWith("bar").toSource();
};

export default transform;
```

This is compatible with jscodeshift's `module.exports.parser` pattern.

## Migration from jscodeshift

Already have jscodeshift codemods? Migrate automatically:

```bash
npx @zmod/migrate "codemods/**/*.ts"
```

See the [Migration Guide](/guide/migration) for details.

# zmod

<p align="center">
  <br>
  <br>
  <a href="https://oxc.rs" target="_blank" rel="noopener noreferrer">
    <picture>
      <source srcset="https://i.imgur.com/IDTb2TV.png">
      <img alt="zmod logo" src="https://oxc.rs/oxc-dark.svg" width="200">
    </picture>
  </a>
  <br>
  <br>
  <br>
</p>

**Blazing fast codemods with a super simple API.**

[![jscodeshift compat](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/anthropics/zmod/main/.github/badges/compat.json)](./scripts/compat-check.ts)
[![vs jscodeshift](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/anthropics/zmod/main/.github/badges/benchmark.json)](./benchmark/jscodeshift-compat.bench.ts)

## Before / After

React's [rename-unsafe-lifecycles](https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles) renames 3 methods. That's it.

**jscodeshift** — 63 lines, 5 AST node types, 2 handler functions:

```js
export default (file, api, options) => {
  const j = api.jscodeshift;
  const printOptions = options.printOptions || { quote: "single", trailingComma: true };
  const root = j(file.source);
  let hasModifications = false;

  const renameDeprecatedApis = (path) => {
    const name = path.node.key.name;
    if (DEPRECATED_APIS[name]) {
      path.value.key.name = DEPRECATED_APIS[name];
      hasModifications = true;
    }
  };

  const renameDeprecatedCallExpressions = (path) => {
    const name = path.node.property.name;
    if (DEPRECATED_APIS[name]) {
      path.node.property.name = DEPRECATED_APIS[name];
      hasModifications = true;
    }
  };

  root.find(j.MethodDefinition).forEach(renameDeprecatedApis);
  root.find(j.ClassMethod).forEach(renameDeprecatedApis);
  root.find(j.ClassProperty).forEach(renameDeprecatedApis);
  root.find(j.Property).forEach(renameDeprecatedApis);
  root.find(j.MemberExpression).forEach(renameDeprecatedCallExpressions);

  return hasModifications ? root.toSource(printOptions) : null;
};
```

**zmod** — 3 lines:

```ts
import { zmod } from "zmod";

await zmod({
  include: "src/**/*.tsx",
  renames: {
    componentWillMount: "UNSAFE_componentWillMount",
    componentWillReceiveProps: "UNSAFE_componentWillReceiveProps",
    componentWillUpdate: "UNSAFE_componentWillUpdate",
  },
});
```

Full source in [`fixtures/rename-unsafe-lifecycles/`](./fixtures/rename-unsafe-lifecycles/).

## Install

```bash
npm install zmod
```

## API

### Simple API — `zmod(options)`

Top-level API: glob files and batch-rename identifiers.

```ts
import { zmod } from "zmod";

const result = await zmod({
  include: "src/**/*.tsx",
  renames: {
    componentWillMount: "UNSAFE_componentWillMount",
    componentWillReceiveProps: "UNSAFE_componentWillReceiveProps",
    componentWillUpdate: "UNSAFE_componentWillUpdate",
  },
});

result.files; // Array<{ path, success, modified }>
```

### jscodeshift-compatible API — `j(source)`

Drop-in replacement for jscodeshift's `j(source).find().replaceWith()` workflow. 100% API compatible.

```ts
import { j } from "zmod";

const source = `import React from 'react';
const App = () => <div>Hello</div>;`;

const root = j(source);

root.find(j.Identifier, { name: "React" }).replaceWith(j.identifier("R"));

console.log(root.toSource());
```

#### Writing transforms

```ts
import type { Transform } from "zmod";

const transform: Transform = (fileInfo, { j }) => {
  const root = j(fileInfo.source);

  root.find(j.CallExpression, { callee: { name: "oldFn" } }).replaceWith((path) => ({
    ...path.node,
    callee: j.identifier("newFn"),
  }));

  return root.toSource();
};

export default transform;
```

#### Batch runner

```ts
import { run } from "zmod";

await run(transform, { include: ["src/**/*.tsx"] });
```

### `transformFile(path, options)`

Batch-rename identifiers in a single file.

```ts
import { transformFile } from "zmod";

const result = await transformFile("./src/app.ts", {
  renames: { useState: "useSignal" },
});

result.modified; // boolean
```

### `transform(code, options)`

Batch-rename identifiers in a code string.

```ts
import { transform } from "zmod";

const result = transform("const foo = 1;", {
  renames: { foo: "bar" },
});

result.output; // "const bar = 1;"
```

## Benchmark

Benchmarks run automatically on every push to `main`.

| Scenario                  | Speedup |
| ------------------------- | ------- |
| parse + toSource (small)  | ~11x    |
| parse + toSource (medium) | ~8x     |
| parse + toSource (large)  | ~5x     |
| find CallExpression       | ~11x    |
| find + filter             | ~11x    |
| find + replaceWith        | ~8x     |
| find + remove             | ~7x     |
| findJSXElements           | ~10x    |
| complex transform (large) | ~6x     |

**Average: ~8x faster** than jscodeshift, thanks to Rust-powered oxc parsing and span-based patching (no AST re-printing).

## License

MIT

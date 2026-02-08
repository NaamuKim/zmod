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

### `zmod(options)`

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

## License

MIT

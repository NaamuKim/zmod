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

**zmod** — 10 lines:

```ts
import { transformFile } from "zmod";

const renames = {
  componentWillMount: "UNSAFE_componentWillMount",
  componentWillReceiveProps: "UNSAFE_componentWillReceiveProps",
  componentWillUpdate: "UNSAFE_componentWillUpdate",
};

for (const [from, to] of Object.entries(renames)) {
  await transformFile("./src/App.tsx", { from, to });
}
```

Full source in [`fixtures/rename-unsafe-lifecycles/`](./fixtures/rename-unsafe-lifecycles/).

## Install

```bash
npm install zmod
```

## API

### `transformFile(path, options)`

Find and rename identifiers in a file.

```ts
import { transformFile } from "zmod";

const result = await transformFile("./src/app.ts", {
  from: "useState",
  to: "useSignal",
});

result.modified; // boolean
```

## License

MIT

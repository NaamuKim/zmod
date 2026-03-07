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

## Migration from jscodeshift

Already have jscodeshift codemods? Migrate automatically:

```bash
npx @zmod/migrate "codemods/**/*.ts"
```

See the [Migration Guide](/guide/migration) for details.

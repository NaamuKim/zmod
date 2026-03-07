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

## `run(transform, options)`

Batch-run a transform over files matching a glob pattern.

```ts
import { run } from "zmod";

await run(transform, { include: "src/**/*.tsx" });
```

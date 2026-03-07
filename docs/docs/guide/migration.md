# Migration from jscodeshift

zmod is 100% API compatible with jscodeshift. In most cases, all you need to do is swap the import.

## Changing the Import

```ts
// before
import jscodeshift from "jscodeshift";

const transform = ({ source }, { j }) => {
  return j(source).find(j.Identifier, { name: "foo" }).replaceWith(j.identifier("bar")).toSource();
};
```

```ts
// after
import type { Transform } from "zmod";

const transform: Transform = ({ source }, { z }) => {
  return z(source).find(z.Identifier, { name: "foo" }).replaceWith(z.identifier("bar")).toSource();
};
```

The API object is passed as `z` instead of `j` — everything else is the same.

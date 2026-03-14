# Migration from jscodeshift

zmod is 100% API compatible with jscodeshift. In most cases, all you need to do is swap the import.

## Automated Migration

Run `@zmod/migrate` to automatically convert your jscodeshift codemods to zmod:

```bash
npx @zmod/migrate "codemods/**/*.ts"
```

This handles:

- Removing `import j from 'jscodeshift'`
- Adding `import type { Transform } from 'zmod'`
- Removing `const j = api.jscodeshift`
- Renaming `{ j }` → `{ z }` in transform params
- Renaming `j.` / `j(` → `z.` / `z(`
- Converting `export const parser = 'ts'` (and other string aliases) to a proper `Parser` object

Use `--dry-run` to preview changes without writing files:

```bash
npx @zmod/migrate --dry-run "codemods/**/*.ts"
```

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

## Custom Parser

If your jscodeshift codemod exports a custom parser, the same pattern works in zmod.

### String parser aliases (jscodeshift → zmod)

jscodeshift lets you export a string alias to select a built-in parser:

```ts
// jscodeshift — string alias
export const parser = "ts";
```

zmod uses the `Parser` interface instead. `@zmod/migrate` converts string aliases automatically. For example, `'ts'` becomes:

```ts
import type { Parser } from "zmod";
import { parse } from "@babel/parser";

export const parser: Parser = {
  parse(source, options) {
    return parse(source, { plugins: ["typescript"], sourceType: "module", ...options }).program;
  },
};
```

Supported aliases and their babel plugins:

| Alias     | Plugins                 |
| --------- | ----------------------- |
| `babel`   | `["jsx"]`               |
| `babylon` | `["jsx"]`               |
| `flow`    | `["jsx", "flow"]`       |
| `ts`      | `["typescript"]`        |
| `tsx`     | `["typescript", "jsx"]` |

### Object parser (no change needed)

```ts
// jscodeshift
module.exports.parser = {
  parse(source) {
    return myParser.parse(source);
  },
};
```

```ts
// zmod
import type { Parser } from "zmod";

export const parser: Parser = {
  parse(source) {
    return myParser.parse(source);
  },
};
```

The `parser` export is picked up automatically by `run()`. You can also call `z.withParser(parser)` directly to get a parser-specific `z` instance.

See [Custom Parsers](/guide/getting-started#custom-parsers) for full documentation.

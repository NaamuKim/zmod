# zmod

<p align="center">
  <br>
  <a href="https://naamukim.github.io/zmod" target="_blank" rel="noopener noreferrer">
    <picture>
      <source srcset="https://i.imgur.com/IDTb2TV.png">
      <img alt="zmod logo" src="https://i.imgur.com/IDTb2TV.png" width="200">
    </picture>
  </a>
  <br>
  <br>
</p>

**The next generation of codemod — fast, flexible, and unopinionated.**

Start with jscodeshift compatibility. Go further with pluggable parsers, pluggable printers, and a modern TypeScript API.

[![jscodeshift compat](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/NaamuKim/zmod/main/.github/badges/compat.json)](./scripts/compat-check.ts)
[![vs jscodeshift](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/NaamuKim/zmod/main/.github/badges/benchmark.json)](./benchmark/jscodeshift-compat.bench.ts)

## Usage

### jscodeshift-compatible API

Drop-in replacement for jscodeshift. Swap the import, everything works.

```ts
import type { Transform } from "zmod";

const transform: Transform = ({ source }, { z }) => {
  const root = z(source);

  root
    .find(z.CallExpression, { callee: { name: "oldFn" } })
    .replaceWith((path) => z.callExpression(z.identifier("newFn"), path.node.arguments));

  return root.toSource();
};

export default transform;
```

```ts
import { run } from "zmod";
await run(transform, { include: "src/**/*.tsx" });
```

### Custom parser + printer

Plug in any parser and printer — not locked to any specific implementation.

```ts
import { parse } from "@babel/parser";
import generate from "@babel/generator";
import type { Parser } from "zmod";

export const parser: Parser = {
  parse(source, options) {
    return parse(source, { plugins: ["typescript"], sourceType: "module", ...options }).program;
  },
  print(node) {
    return generate(node).code;
  },
};
```

`run()` picks up `export const parser` automatically — same pattern as jscodeshift.

## Install & Migrate from jscodeshift

```bash
npm install zmod
```

Run the migration tool from your project root — no glob needed:

```bash
npx @zmod/migrate
```

Automatically scans `**/*.{ts,tsx,js,jsx}` (excluding `node_modules`) and converts jscodeshift imports, renames, and string parser aliases.

## Benchmark

Average **~8x faster** than jscodeshift across 9 scenarios (Rust-powered oxc parsing, no AST re-printing).

| Scenario           | Speedup |
| ------------------ | ------- |
| parse + toSource   | ~8–11x  |
| find + replaceWith | ~8x     |
| complex transform  | ~6x     |

## License

MIT

---
"zmod": patch
---

Add pluggable printer support via `Parser.print`

- `Parser` interface now accepts an optional `print?(node: any): string` method
- `z.withParser(codec)` threads the printer through to all `Collection` instances
- `replaceWith(astNode)` now serializes builder-created nodes via the active printer
- `z.print(node)` exposes the active printer for manual serialization
- Falls back to the internal printer when `print` is not provided (no breaking change)

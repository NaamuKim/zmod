---
"zmod": patch
---

Replace SWC backend with oxc for ~2.7x faster transforms

- Switched parser and visitor
  from SWC to oxc with
  span-based patching
- Preserves original
  formatting (no codegen
  reformatting)
- Removed SWC dependency
  entirely
- Updated NAPI config to fix
  deprecation warnings

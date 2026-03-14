---
"@zmod/migrate": patch
---

Default to scanning all JS/TS files when no pattern is provided

- `npx @zmod/migrate` now works from the project root without arguments
- Defaults to `**/*.{ts,tsx,js,jsx}` with `node_modules` excluded
- Removes the interactive prompt for glob input

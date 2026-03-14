# @zmod/migrate

## 0.1.1

### Patch Changes

- [`dac58e7`](https://github.com/NaamuKim/zmod/commit/dac58e70b9fdd9c5f68995e87667f32328bea859) Thanks [@NaamuKim](https://github.com/NaamuKim)! - Default to scanning all JS/TS files when no pattern is provided

  - `npx @zmod/migrate` now works from the project root without arguments
  - Defaults to `**/*.{ts,tsx,js,jsx}` with `node_modules` excluded
  - Removes the interactive prompt for glob input

- [#8](https://github.com/NaamuKim/zmod/pull/8) [`fa5e131`](https://github.com/NaamuKim/zmod/commit/fa5e131b8503061f560404fcb850c7112446909f) Thanks [@NaamuKim](https://github.com/NaamuKim)! - support custom parser

- Updated dependencies [[`44acafa`](https://github.com/NaamuKim/zmod/commit/44acafa06981230e2cf1679f9b0c98793d560175), [`fa5e131`](https://github.com/NaamuKim/zmod/commit/fa5e131b8503061f560404fcb850c7112446909f)]:
  - zmod@0.3.1

## 0.1.0

### Minor Changes

- [#6](https://github.com/NaamuKim/zmod/pull/6) [`ed68f55`](https://github.com/NaamuKim/zmod/commit/ed68f5534c7c8848ccf923c191342ba88854c80e) Thanks [@NaamuKim](https://github.com/NaamuKim)! - initialize package and add migrate jscodeshift to zmod

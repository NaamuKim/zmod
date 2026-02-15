# zmod

## 0.2.0

### Minor Changes

- [`d0d8c90`](https://github.com/NaamuKim/zmod/commit/d0d8c90eaeaab783a9c016b26c69293d7c4785f9) Thanks [@NaamuKim](https://github.com/NaamuKim)! - ### New 3-tier API with batch renames

  **`zmod({ include, renames })`** — top-level API with glob support

  ```ts
  await zmod({
    include: "src/**/*.tsx",
    renames: { componentWillMount: "UNSAFE_componentWillMount" },
  });
  ```

  **`transformFile(path, { renames })`** — file-level batch rename

  **`transform(code, { renames })`** — string-level batch rename

  ### Breaking Changes

  - `{ from, to }` options replaced with `{ renames: Record<string, string> }`
  - `CodeMod` class removed

  ### Other

  - Rust NAPI binding updated to accept `HashMap<String, String>`
  - Fixed SWC parser syntax error in native binding
  - Added `tinyglobby` dependency for glob support

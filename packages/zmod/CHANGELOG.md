# zmod

## 0.3.0

### Minor Changes

- [`7732879`](https://github.com/NaamuKim/zmod/commit/7732879e80bc5aa492c83109cee7f021b178998a) Thanks [@NaamuKim](https://github.com/NaamuKim)! - adds a jscodeshift-compatible `z()` API that runs ~8x faster than jscodeshift, with no jscodeshift dependency.

  - Collection API: find, replaceWith, remove, insertBefore,insertAfter, forEach, filter, closest
  - NodePath with parent, parentKey, scope traversal
  - `run(transform, { include })` for batch file execution
  - 21 react-codemod fixtures passing as integration tests

  | Scenario                     | zmod (ms) | jscodeshift (ms) | Speedup |
  | ---------------------------- | --------- | ---------------- | ------- |
  | parse + toSource (small)     | 0.02      | 0.19             | 10.8x   |
  | parse + toSource (medium)    | 0.12      | 0.98             | 7.9x    |
  | parse + toSource (large)     | 2.51      | 17.34            | 6.9x    |
  | find CallExpression (medium) | 0.11      | 0.6              | 5.2x    |
  | find + filter (medium)       | 0.11      | 0.55             | 5.1x    |
  | find + replaceWith (medium)  | 0.11      | 1.14             | 10x     |
  | find + remove (medium)       | 0.11      | 1.06             | 9.5x    |
  | findJSXElements (medium)     | 0.11      | 0.52             | 4.7x    |
  | complex transform (large)    | 2.55      | 30.31            | 11.9x   |

  Average speedup: **7.9x**

## 0.2.1

### Patch Changes

- [`14fd3da`](https://github.com/NaamuKim/zmod/commit/14fd3dadf978bc8faa0c1b55065c1a0ba9d68960) Thanks [@NaamuKim](https://github.com/NaamuKim)! - Replace SWC backend with oxc for ~2.7x faster transforms

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

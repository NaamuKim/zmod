---
"zmod": minor
---

adds a jscodeshift-compatible `z()` API that runs ~8x faster than jscodeshift, with no jscodeshift dependency.

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

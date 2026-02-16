# Benchmark Results

rename-unsafe-lifecycles codemod (3 identifiers renamed across 50 React components, ~2,500 LOC)

## Rust (Criterion, parse → rename → output)

|                                  | time   | vs oxc      |
| -------------------------------- | ------ | ----------- |
| oxc (parse + visit + span patch) | 387 µs | baseline    |
| SWC (parse + VisitMut + codegen) | 974 µs | 2.5x slower |

Parse only: oxc 270µs vs SWC 657µs (2.4x).

## JS (vitest bench, 500 files)

|                                | mean     | vs jscodeshift |
| ------------------------------ | -------- | -------------- |
| regex (string replace)         | 0.71 ms  | 2,222x         |
| zmod native (SWC NAPI)         | 17.0 ms  | 93x            |
| oxc-parser (NAPI + JS visitor) | 91.3 ms  | 17x            |
| jscodeshift (babel)            | 1,583 ms | baseline       |

oxc-parser NAPI is slower than SWC NAPI despite faster parsing because AST serialization to JS objects costs 3–20x more than parsing itself ([oxc-project/oxc#2409](https://github.com/oxc-project/oxc/issues/2409)).

## Takeaway

Fastest path for codemods: **oxc in Rust, return result string to JS**. Serializing AST to JS negates parser speed gains.

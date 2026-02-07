# Contributing

## Prerequisites

Install [mise](https://mise.jdx.dev) to manage Node.js, pnpm, and Rust toolchains:

```bash
curl https://mise.run | sh
```

## Setup

```bash
git clone https://github.com/aspect-build/zmod.git
cd zmod
mise install
pnpm install
```

`mise install` reads `.mise.toml` and installs the exact versions of Node.js 24, pnpm 10, and Rust stable.

## Build

```bash
# Build the native NAPI binding
cd packages/zmod
./node_modules/.bin/napi build --platform --release --cargo-cwd ../../crates/zmod-napi

# Build TypeScript
pnpm --filter zmod build
```

## Test

```bash
pnpm test
```

## Format

```bash
pnpm fmt          # fix
pnpm fmt --check  # check only
```

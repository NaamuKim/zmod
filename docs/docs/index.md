---
pageType: home

hero:
  name: zmod
  text: The next generation of jscodeshift.
  tagline: Fast by default. Extensible by design. Pluggable parser, pluggable printer, full jscodeshift compatibility.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/NaamuKim/zmod

features:
  - title: jscodeshift Compatible
    details: Drop-in replacement. Swap the import and your existing codemods just work. Migrate automatically with @zmod/migrate.
  - title: 8x Faster
    details: Rust-powered oxc parsing and span-based patching — no AST re-printing, format always preserved.
  - title: Pluggable Parser & Printer
    details: Bring any parser and any printer. Not locked to recast or any specific implementation.
---

import { defineConfig } from "rspress/config";

export default defineConfig({
  root: "docs",
  title: "zmod",
  description: "jscodeshift-compatible codemod toolkit, 8x faster, powered by Rust",
  base: "/zmod/",
  icon: "/favicon.svg",
  themeConfig: {
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content: "https://github.com/NaamuKim/zmod",
      },
    ],
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/overview" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Migration from jscodeshift", link: "/guide/migration" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API",
          items: [{ text: "Overview", link: "/api/overview" }],
        },
      ],
    },
  },
});

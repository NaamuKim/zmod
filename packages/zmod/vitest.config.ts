import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks", // native bindings need forks, not worker threads (ref: Rolldown)
    testTimeout: 10000,
  },
});

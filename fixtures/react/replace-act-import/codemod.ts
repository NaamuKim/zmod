import type { TransformOptions } from "zmod";

export const options: TransformOptions = {
  imports: {
    replaceSource: { "react-dom/test-utils": "react" },
  },
};

import type { TransformOptions } from "zmod";

export const options: TransformOptions = {
  renames: { useContext: "use" },
  imports: {
    renameSpecifier: { useContext: "use" },
  },
};

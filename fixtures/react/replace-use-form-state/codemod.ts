import type { TransformOptions } from "zmod";

export const options: TransformOptions = {
  renames: { useFormState: "useActionState" },
  imports: {
    renameSpecifier: { useFormState: "useActionState" },
  },
};

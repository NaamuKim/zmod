import type { TransformOptions } from "zmod";

export const options: TransformOptions = {
  imports: {
    addImport: [{ from: "prop-types", defaultName: "PropTypes" }],
  },
  replaceText: [{ matchText: "React.PropTypes", replace: "PropTypes" }],
};

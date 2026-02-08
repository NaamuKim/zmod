import { zmod } from "zmod";

await zmod({
  include: "src/**/*.tsx",
  renames: {
    componentWillMount: "UNSAFE_componentWillMount",
    componentWillReceiveProps: "UNSAFE_componentWillReceiveProps",
    componentWillUpdate: "UNSAFE_componentWillUpdate",
  },
});

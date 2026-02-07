import { transformFile } from "zmod";

const renames = {
  componentWillMount: "UNSAFE_componentWillMount",
  componentWillReceiveProps: "UNSAFE_componentWillReceiveProps",
  componentWillUpdate: "UNSAFE_componentWillUpdate",
};

const files = ["./src/App.tsx"];

for (const file of files) {
  for (const [from, to] of Object.entries(renames)) {
    await transformFile(file, { from, to });
  }
}

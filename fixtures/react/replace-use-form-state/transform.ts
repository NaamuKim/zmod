import type { Transform } from "zmod";

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  const replaced = new Set<string>();
  let isDirty = false;

  // Rename all useFormState identifiers to useActionState,
  // deduplicating by span to avoid overlapping patches
  root.find(j.Identifier, { name: "useFormState" }).forEach((path) => {
    const key = `${path.node.start}:${path.node.end}`;
    if (replaced.has(key)) return;
    replaced.add(key);
    root.replace(path, "useActionState");
    isDirty = true;
  });

  return isDirty ? root.toSource() : undefined;
};

export default transform;

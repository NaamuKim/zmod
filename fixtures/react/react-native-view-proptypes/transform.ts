import type { Transform } from "zmod";

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;
  let needsViewPropTypes = false;

  // Replace View.propTypes.xxx with ViewPropTypes.xxx
  root
    .find(j.MemberExpression, {
      object: {
        type: "MemberExpression",
        object: { name: "View" },
        property: { name: "propTypes" },
      },
    })
    .forEach((path) => {
      const prop = path.node.property;
      const propName = source.slice(prop.start, prop.end);
      root.replace(path, `ViewPropTypes.${propName}`);
      isDirty = true;
      needsViewPropTypes = true;
    });

  // Add ViewPropTypes to destructuring if needed
  if (needsViewPropTypes) {
    // Find destructuring from react-native: var { View, ... } = React;
    root.find(j.VariableDeclarator).forEach((path) => {
      const id = path.node.id;
      if (id?.type !== "ObjectPattern") return;
      const init = path.node.init;
      if (!init || init.name !== "React") return;

      // Check if ViewPropTypes already exists
      const hasViewPropTypes = id.properties?.some(
        (p: any) => p.key?.name === "ViewPropTypes" || p.value?.name === "ViewPropTypes",
      );
      if (hasViewPropTypes) return;

      // Add ViewPropTypes to the destructuring
      const lastProp = id.properties[id.properties.length - 1];
      const insertPos = lastProp.end;
      root._addPatch(insertPos, insertPos, ", ViewPropTypes");
    });
  }

  return isDirty ? root.toSource() : undefined;
};

export default transform;

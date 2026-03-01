import type { Transform } from "zmod";

// Default sort order (simplified from eslint-plugin-react/sort-comp)
const LIFECYCLE_ORDER = [
  "static-methods",
  "constructor",
  "getChildContext",
  "componentDidMount",
  "shouldComponentUpdate",
  "componentDidUpdate",
  "componentWillUnmount",
  "componentDidCatch",
  // event handlers and other methods
  "everything-else",
  "render",
];

function getMethodPriority(name: string, isStatic: boolean): number {
  if (isStatic) return LIFECYCLE_ORDER.indexOf("static-methods");
  const idx = LIFECYCLE_ORDER.indexOf(name);
  if (idx !== -1) return idx;
  // everything-else
  return LIFECYCLE_ORDER.indexOf("everything-else");
}

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  root.find(j.ClassDeclaration).forEach((classPath) => {
    const body = classPath.node.body;
    if (!body?.body) return;

    const members = body.body;
    if (members.length <= 1) return;

    // Create sortable entries
    const entries = members.map((m: any) => {
      const name = m.key?.name || "";
      const isStatic = m.static === true;
      const priority = getMethodPriority(name, isStatic);
      return { node: m, priority, name };
    });

    // Check if already sorted
    let sorted = true;
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].priority < entries[i - 1].priority) {
        sorted = false;
        break;
      }
    }
    if (sorted) return;

    // Sort by priority (stable sort preserves relative order within same group)
    const sortedEntries = [...entries].sort((a, b) => a.priority - b.priority);

    // Get the text of each member from original source
    const memberTexts = sortedEntries.map((e) => {
      return source.slice(e.node.start, e.node.end);
    });

    // Replace entire class body contents
    const bodyStart = body.start + 1; // after '{'
    const bodyEnd = body.end - 1; // before '}'

    // Detect indent from first member
    const firstMember = members[0];
    const lineStart = source.lastIndexOf("\n", firstMember.start);
    const indent = source.slice(lineStart + 1, firstMember.start);

    const newBody = "\n" + memberTexts.map((t) => indent + t).join("\n\n") + "\n";
    root._addPatch(bodyStart, bodyEnd, newBody);
    isDirty = true;
  });

  return isDirty ? root.toSource() : undefined;
};

export default transform;

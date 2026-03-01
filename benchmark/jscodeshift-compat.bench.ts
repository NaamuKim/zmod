import { j as zmod } from "../packages/zmod/src/jscodeshift.js";
import jscodeshiftBase from "jscodeshift";

const jscodeshift = jscodeshiftBase.withParser("tsx");

// ── Test sources ──

const SMALL = `
import React from 'react';
const App = () => <div className="app">Hello</div>;
export default App;
`;

const MEDIUM = `
import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from './theme';

interface Props {
  title: string;
  count: number;
  onIncrement: () => void;
}

const Counter: React.FC<Props> = ({ title, count, onIncrement }) => {
  const [local, setLocal] = useState(0);
  const theme = useContext(ThemeContext);

  useEffect(() => {
    console.log('count changed:', count);
    document.title = title;
    return () => { console.log('cleanup'); };
  }, [count, title]);

  const handleClick = () => {
    setLocal(prev => prev + 1);
    onIncrement();
  };

  return (
    <div className={theme.container}>
      <h1>{title}</h1>
      <p>Global: {count}</p>
      <p>Local: {local}</p>
      <button onClick={handleClick}>Increment</button>
      <span className="info">Info text</span>
    </div>
  );
};

export default Counter;
`;

// Generate a large file by repeating components
const LARGE =
  `import React from 'react';\n` +
  Array.from(
    { length: 50 },
    (_, i) => `
const Component${i} = ({ name, value }) => {
  const [state${i}, setState${i}] = React.useState(value);
  const handleChange${i} = (e) => {
    setState${i}(e.target.value);
    console.log('changed:', name, e.target.value);
  };
  return (
    <div className="component-${i}">
      <label>{name}</label>
      <input value={state${i}} onChange={handleChange${i}} />
      <span>{state${i}}</span>
    </div>
  );
};
`,
  ).join("\n");

// ── Benchmark harness ──

function bench(
  name: string,
  fn: () => void,
  warmup = 5,
  iterations = 50,
): { name: string; median: number; p95: number; min: number } {
  // Warmup
  for (let i = 0; i < warmup; i++) fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  return {
    name,
    median: times[Math.floor(times.length / 2)],
    p95: times[Math.floor(times.length * 0.95)],
    min: times[0],
  };
}

// ── Scenarios ──

type Scenario = {
  name: string;
  source: string;
  zmod: (source: string) => string;
  jscs: (source: string) => string;
};

const scenarios: Scenario[] = [
  {
    name: "parse + toSource (small)",
    source: SMALL,
    zmod: (s) => zmod(s).toSource(),
    jscs: (s) => jscodeshift(s).toSource(),
  },
  {
    name: "parse + toSource (medium)",
    source: MEDIUM,
    zmod: (s) => zmod(s).toSource(),
    jscs: (s) => jscodeshift(s).toSource(),
  },
  {
    name: "parse + toSource (large)",
    source: LARGE,
    zmod: (s) => zmod(s).toSource(),
    jscs: (s) => jscodeshift(s).toSource(),
  },
  {
    name: "find CallExpression (medium)",
    source: MEDIUM,
    zmod: (s) => {
      zmod(s).find(zmod.CallExpression);
      return "";
    },
    jscs: (s) => {
      jscodeshift(s).find(jscodeshift.CallExpression);
      return "";
    },
  },
  {
    name: "find + filter (medium)",
    source: MEDIUM,
    zmod: (s) => {
      zmod(s)
        .find(zmod.CallExpression)
        .filter((p) => p.node.callee?.name === "useState");
      return "";
    },
    jscs: (s) => {
      jscodeshift(s)
        .find(jscodeshift.CallExpression)
        .filter((p) => p.node.callee?.name === "useState");
      return "";
    },
  },
  {
    name: "find + replaceWith (medium)",
    source: MEDIUM,
    zmod: (s) => {
      const root = zmod(s);
      root.find(zmod.CallExpression, { callee: { name: "useState" } }).replaceWith((p) => ({
        ...p.node,
        callee: { type: "Identifier", name: "useNewState", start: -1, end: -1 },
      }));
      return root.toSource();
    },
    jscs: (s) => {
      const root = jscodeshift(s);
      root
        .find(jscodeshift.CallExpression, { callee: { name: "useState" } })
        .replaceWith((p) =>
          jscodeshift.callExpression(jscodeshift.identifier("useNewState"), p.node.arguments),
        );
      return root.toSource();
    },
  },
  {
    name: "find + remove (medium)",
    source: MEDIUM,
    zmod: (s) => {
      const root = zmod(s);
      root
        .find(zmod.CallExpression, {
          callee: { object: { name: "console" }, property: { name: "log" } },
        })
        .remove();
      return root.toSource();
    },
    jscs: (s) => {
      const root = jscodeshift(s);
      root
        .find(jscodeshift.CallExpression, {
          callee: { object: { name: "console" }, property: { name: "log" } },
        })
        .closest(jscodeshift.ExpressionStatement)
        .remove();
      return root.toSource();
    },
  },
  {
    name: "findJSXElements (medium)",
    source: MEDIUM,
    zmod: (s) => {
      zmod(s).findJSXElements("button");
      return "";
    },
    jscs: (s) => {
      jscodeshift(s).findJSXElements("button");
      return "";
    },
  },
  {
    name: "complex transform (large)",
    source: LARGE,
    zmod: (s) => {
      const root = zmod(s);
      root
        .find(zmod.Identifier, { name: "React" })
        .filter((p) => p.parentKey !== "object")
        .replaceWith(zmod.identifier("R"));
      root
        .find(zmod.CallExpression, { callee: { property: { name: "useState" } } })
        .forEach((p) => {
          // just iterate, don't modify
        });
      return root.toSource();
    },
    jscs: (s) => {
      const root = jscodeshift(s);
      root
        .find(jscodeshift.Identifier, { name: "React" })
        .filter((p) => p.name !== "object")
        .replaceWith(jscodeshift.identifier("R"));
      root
        .find(jscodeshift.CallExpression, { callee: { property: { name: "useState" } } })
        .forEach((p) => {
          // just iterate, don't modify
        });
      return root.toSource();
    },
  },
];

// ── Run ──

const jsonMode = process.argv.includes("--json");

interface Result {
  scenario: string;
  zmod_ms: number;
  jscodeshift_ms: number;
  speedup: number;
}

const results: Result[] = [];

for (const s of scenarios) {
  const z = bench(`zmod: ${s.name}`, () => s.zmod(s.source));
  const j = bench(`jscs: ${s.name}`, () => s.jscs(s.source));
  const speedup = j.median / z.median;
  results.push({
    scenario: s.name,
    zmod_ms: Number(z.median.toFixed(2)),
    jscodeshift_ms: Number(j.median.toFixed(2)),
    speedup: Number(speedup.toFixed(1)),
  });
}

if (jsonMode) {
  const avgSpeedup = results.reduce((a, r) => a + r.speedup, 0) / results.length;
  console.log(JSON.stringify({ results, avgSpeedup: Number(avgSpeedup.toFixed(1)) }, null, 2));
} else {
  console.log(
    `Source sizes: small=${SMALL.length}B  medium=${MEDIUM.length}B  large=${LARGE.length}B`,
  );
  console.log("");
  console.log("| Scenario | zmod (ms) | jscodeshift (ms) | Speedup |");
  console.log("|----------|-----------|-------------------|---------|");
  for (const r of results) {
    console.log(`| ${r.scenario} | ${r.zmod_ms} | ${r.jscodeshift_ms} | ${r.speedup}x |`);
  }
  const avgSpeedup = results.reduce((a, r) => a + r.speedup, 0) / results.length;
  console.log("");
  console.log(`Average speedup: **${avgSpeedup.toFixed(1)}x**`);
}

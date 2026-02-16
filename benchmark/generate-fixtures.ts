/**
 * Generate N React component files with deprecated lifecycle methods
 * for benchmarking rename-unsafe-lifecycles codemod.
 */
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const DIR = join(import.meta.dirname, "fixtures");
const FILE_COUNT = Number(process.argv[2]) || 500;

const template = (i: number) => `import React, { Component } from "react";

interface Props${i} {
  name: string;
  value: number;
}

interface State${i} {
  count: number;
  data: string | null;
  loading: boolean;
}

export class Component${i} extends Component<Props${i}, State${i}> {
  state: State${i} = {
    count: 0,
    data: null,
    loading: false,
  };

  componentWillMount() {
    console.log("Component${i} will mount");
    this.setState({ loading: true });
    fetch("/api/data/${i}")
      .then((res) => res.json())
      .then((data) => this.setState({ data, loading: false }));
  }

  componentWillReceiveProps(nextProps: Props${i}) {
    if (nextProps.name !== this.props.name) {
      console.log("Props changed for Component${i}:", nextProps.name);
      this.setState({ loading: true });
    }
    if (nextProps.value !== this.props.value) {
      this.setState({ count: nextProps.value });
    }
  }

  componentWillUpdate(nextProps: Props${i}, nextState: State${i}) {
    if (nextState.count !== this.state.count) {
      console.log("Component${i} count will update:", nextState.count);
    }
    if (nextState.loading !== this.state.loading) {
      console.log("Component${i} loading state changed");
    }
  }

  handleClick = () => {
    this.setState({ count: this.state.count + 1 });
  };

  render() {
    return (
      <div className="component-${i}">
        <h1>Hello, {this.props.name}!</h1>
        <p>Count: {this.state.count}</p>
        <p>Data: {this.state.data ?? "No data"}</p>
        {this.state.loading && <span>Loading...</span>}
        <button onClick={this.handleClick}>Increment</button>
      </div>
    );
  }
}
`;

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

for (let i = 0; i < FILE_COUNT; i++) {
  writeFileSync(join(DIR, `Component${i}.tsx`), template(i));
}

console.log(`Generated ${FILE_COUNT} files in ${DIR}`);

import React, { Component } from "react";
interface AppProps {
  name: string;
}
interface AppState {
  count: number;
  data: string | null;
}
export class App extends Component<AppProps, AppState> {
  state: AppState = {
    count: 0,
    data: null,
  };
  UNSAFE_componentWillMount() {
    console.log("Component will mount");
    this.setState({
      data: "loading...",
    });
  }
  UNSAFE_componentWillReceiveProps(nextProps: AppProps) {
    if (nextProps.name !== this.props.name) {
      console.log("Props changed:", nextProps.name);
    }
  }
  UNSAFE_componentWillUpdate(nextProps: AppProps, nextState: AppState) {
    if (nextState.count !== this.state.count) {
      console.log("Count will update:", nextState.count);
    }
  }
  render() {
    return (
      <div>
        <h1>Hello, {this.props.name}!</h1>
        <p>Count: {this.state.count}</p>
        <button
          onClick={() =>
            this.setState({
              count: this.state.count + 1,
            })
          }
        >
          Increment
        </button>
      </div>
    );
  }
}

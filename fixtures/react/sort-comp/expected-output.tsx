import React from "react";

class MyComponent extends React.Component {
  componentDidMount() {
    this.setup();
  }

  componentWillUnmount() {
    this.cleanup();
  }

  handleClick() {
    console.log("clicked");
  }

  setup() {
    console.log("setup");
  }

  cleanup() {
    console.log("cleanup");
  }

  render() {
    return <button onClick={this.handleClick}>Click</button>;
  }
}

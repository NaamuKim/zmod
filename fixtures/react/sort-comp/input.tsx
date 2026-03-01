import React from "react";

class MyComponent extends React.Component {
  handleClick() {
    console.log("clicked");
  }

  componentDidMount() {
    this.setup();
  }

  setup() {
    console.log("setup");
  }

  render() {
    return <button onClick={this.handleClick}>Click</button>;
  }

  componentWillUnmount() {
    this.cleanup();
  }

  cleanup() {
    console.log("cleanup");
  }
}

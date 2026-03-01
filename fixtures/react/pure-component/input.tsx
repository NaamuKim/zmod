import React from "react";

class MyComponent extends React.Component {
  render() {
    return <div>{this.props.name}</div>;
  }
}

class ComplexComponent extends React.Component {
  handleClick() {
    console.log("clicked");
  }

  render() {
    return <button onClick={this.handleClick}>Click</button>;
  }
}

import React, { Component, PureComponent } from "react";

class MyComponent extends Component {
  render() {
    return <div ref="myDiv">hello</div>;
  }
}

class MyPure extends React.PureComponent {
  render() {
    return <input ref="myInput" />;
  }
}

const Functional = () => {
  return <div ref="shouldNotChange" />;
};

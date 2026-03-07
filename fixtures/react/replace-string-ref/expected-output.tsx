import React, { Component, PureComponent } from "react";

class MyComponent extends Component {
  render() {
    return <div ref={(ref) => {
this.refs.myDiv = ref;
}}>hello</div>;
  }
}

class MyPure extends React.PureComponent {
  render() {
    return <input ref={(ref) => {
this.refs.myInput = ref;
}} />;
  }
}

const Functional = () => {
  return <div ref="shouldNotChange" />;
};

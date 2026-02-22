import React from "react";

class MyComponent extends React.Component {
  UNSAFE_componentWillMount() {
    this.init();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.id !== this.props.id) {
      this.load(nextProps.id);
    }
  }

  UNSAFE_componentWillUpdate(nextProps, nextState) {
    if (nextProps.visible) {
      this.prepare();
    }
  }

  render() {
    return <div>{this.props.children}</div>;
  }
}

const mixin = {
  UNSAFE_componentWillMount() {
    console.log("mounting");
  },
};

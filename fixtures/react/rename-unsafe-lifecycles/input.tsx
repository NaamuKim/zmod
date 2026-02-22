import React from "react";

class MyComponent extends React.Component {
  componentWillMount() {
    this.init();
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.id !== this.props.id) {
      this.load(nextProps.id);
    }
  }

  componentWillUpdate(nextProps, nextState) {
    if (nextProps.visible) {
      this.prepare();
    }
  }

  render() {
    return <div>{this.props.children}</div>;
  }
}

const mixin = {
  componentWillMount() {
    console.log("mounting");
  },
};

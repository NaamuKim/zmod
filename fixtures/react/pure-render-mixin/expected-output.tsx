var React = require("react");

var MyComponent = React.createClass({
  shouldComponentUpdate: function (nextProps, nextState) {
    return (
      !shallowEqual(this.props, nextProps) || !shallowEqual(this.state, nextState)
    );
  },

  render: function () {
    return <div>{this.props.name}</div>;
  },
});

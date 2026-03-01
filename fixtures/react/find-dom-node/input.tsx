var React = require("react");

var Foo = React.createClass({
  componentDidMount: function () {
    var node = this.getDOMNode();
    var child = this.refs.child.getDOMNode();
  },
  render: function () {
    return <div ref="child">Hello</div>;
  },
});

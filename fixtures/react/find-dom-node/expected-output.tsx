var React = require("react");

var Foo = React.createClass({
  componentDidMount: function () {
    var node = React.findDOMNode(this);
    var child = React.findDOMNode(this.refs.child);
  },
  render: function () {
    return <div ref="child">Hello</div>;
  },
});

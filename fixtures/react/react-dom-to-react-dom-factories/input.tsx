var React = require("react");

var MyComponent = React.createClass({
  render: function () {
    return React.DOM.div(
      { className: "container" },
      React.DOM.h1(null, "Hello"),
    );
  },
});

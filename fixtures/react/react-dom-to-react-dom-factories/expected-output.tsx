var React = require("react");

var MyComponent = React.createClass({
  render: function () {
    return React.createElement(
      "div", { className: "container" },
      React.createElement("h1", null, "Hello"),
    );
  },
});

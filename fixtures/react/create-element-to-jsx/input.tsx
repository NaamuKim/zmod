var React = require("react");

var el1 = React.createElement("div", { className: "container" }, "Hello");
var el2 = React.createElement("span", null, "World");
var el3 = React.createElement(MyComponent, { name: "test", count: 5 });
var el4 = React.createElement("div", null,
  React.createElement("h1", null, "Title"),
  React.createElement("p", null, "Body"),
);

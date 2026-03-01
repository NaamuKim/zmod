var React = require("react");
var PureRenderMixin = require("react-addons-pure-render-mixin");

var MyComponent = React.createClass({
  mixins: [PureRenderMixin],

  render: function () {
    return <div>{this.props.name}</div>;
  },
});

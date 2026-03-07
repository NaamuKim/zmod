var React = require("react");

var MyComponent = React.createClass({
  propTypes: {
    name: React.PropTypes.string,
  },

  getDefaultProps: function () {
    return { name: "World" };
  },

  getInitialState: function () {
    return { count: 0 };
  },

  handleClick: function () {
    this.setState({ count: this.state.count + 1 });
  },

  render: function () {
    return (
      <div>
        <h1>Hello {this.props.name}</h1>
        <p>Count: {this.state.count}</p>
        <button onClick={this.handleClick}>Increment</button>
      </div>
    );
  },
});

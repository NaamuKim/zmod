var React = require("react");

class MyComponent extends React.Component {
  static propTypes = {
    name: React.PropTypes.string,
  };

  static defaultProps = { name: "World" };

  state = { count: 0 };

  handleClick() {
    this.setState({ count: this.state.count + 1 });
  }

  render() {
    return (
      <div>
        <h1>Hello {this.props.name}</h1>
        <p>Count: {this.state.count}</p>
        <button onClick={this.handleClick}>Increment</button>
      </div>
    );
  }
}

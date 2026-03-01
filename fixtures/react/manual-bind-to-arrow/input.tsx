import React from "react";

class MyComponent extends React.Component {
  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  handleClick() {
    console.log("clicked");
  }

  handleChange(e) {
    console.log(e.target.value);
  }

  render() {
    return (
      <div>
        <button onClick={this.handleClick}>Click</button>
        <input onChange={this.handleChange} />
      </div>
    );
  }
}

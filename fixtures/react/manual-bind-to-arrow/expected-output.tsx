import React from "react";

class MyComponent extends React.Component {
  constructor(props) {
    super(props);
  }

  handleClick = () => {
    console.log("clicked");
  };

  handleChange = (e) => {
    console.log(e.target.value);
  };

  render() {
    return (
      <div>
        <button onClick={this.handleClick}>Click</button>
        <input onChange={this.handleChange} />
      </div>
    );
  }
}

import React from "react";

class ErrorBoundary extends React.Component {
  componentDidCatch(error) {
    this.setState({ error });
  }

  render() {
    if (this.state.error) {
      return <div>Error occurred</div>;
    }
    return this.props.children;
  }
}

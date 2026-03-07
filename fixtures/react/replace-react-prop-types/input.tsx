import React from "react";

const MyComponent = ({ name }: { name: string }) => {
  return <div>{name}</div>;
};

MyComponent.propTypes = {
  name: React.PropTypes.string.isRequired,
};

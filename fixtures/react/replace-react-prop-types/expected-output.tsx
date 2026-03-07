import PropTypes from "prop-types";
import React from "react";

const MyComponent = ({ name }: { name: string }) => {
  return <div>{name}</div>;
};

MyComponent.propTypes = {
  name: PropTypes.string.isRequired,
};

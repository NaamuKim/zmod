import React from "react";

const MyButton = (props, ref) => {
  return <button ref={ref}>{props.label}</button>;
};

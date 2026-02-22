import React from "react";

const MyButton = React.forwardRef((props, ref) => {
  return <button ref={ref}>{props.label}</button>;
});

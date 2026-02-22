import { useContext } from "react";
import { ThemeContext } from "./theme";

function App() {
  const theme = useContext(ThemeContext);
  return <div className={theme.className}>Hello</div>;
}

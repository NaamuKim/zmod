import { use } from "react";
import { ThemeContext } from "./theme";

function App() {
  const theme = use(ThemeContext);
  return <div className={theme.className}>Hello</div>;
}

import { createContext } from "react";

const ThemeContext = createContext("light");

function App() {
  return (
    <ThemeContext value="dark">
      <Child />
    </ThemeContext>
  );
}

import { act } from "react-dom/test-utils";

test("renders correctly", () => {
  act(() => {
    render(<App />);
  });
});

import { useFormState } from "react-dom";

function Form() {
  const [state, formAction] = useFormState(submitAction, initialState);
  return (
    <form action={formAction}>
      <p>{state.message}</p>
      <button type="submit">Submit</button>
    </form>
  );
}

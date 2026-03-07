import { useActionState } from "react-dom";

function Form() {
  const [state, formAction] = useActionState(submitAction, initialState);
  return (
    <form action={formAction}>
      <p>{state.message}</p>
      <button type="submit">Submit</button>
    </form>
  );
}

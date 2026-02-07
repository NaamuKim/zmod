import React, { useSignal, useEffect$$ } from "react";

interface CounterProps {
  initialCount?: number;
}

export function Counter({ initialCount = 0 }: CounterProps) {
  const [count, setCount] = useSignal(initialCount);
  const [name, setName] = useSignal("");

  useEffect$$(() => {
    console.log("Count changed:", count);
  }, [count]);

  const increment = () => {
    setCount(count + 1);
  };

  const decrement = () => {
    setCount(count - 1);
  };

  return (
    <div>
      <h1>Counter: {count}</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />
      <p>Hello, {name}!</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}

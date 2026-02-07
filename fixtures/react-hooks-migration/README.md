# React Hooks Migration Example

This fixture demonstrates how to use **zmod** to perform real-world React codemods.

## 🎯 What This Does

Transforms modern React code:

**Before:**

```tsx
import React, { useState, useEffect } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log("Count:", count);
  }, [count]);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

**After:**

```tsx
import React, { useSignal, useEffect$ } from "react";

function Counter() {
  const count = useSignal(0);

  useEffect$(() => {
    console.log("Count:", count.value);
  }, [count]);

  return <button onClick={() => (count.value = count.value + 1)}>{count.value}</button>;
}
```

## 🚀 Run the Codemod

```bash
# Install dependencies
npm install

# Run the transformation
npm run codemod

# Or run directly
tsx codemod.ts
```

## 📝 How It Works

The `codemod.ts` script uses zmod's API:

1. **Find files**: Glob pattern to find all `.tsx` files
2. **Transform**: Replace `useState` with `useSignal`
3. **Transform**: Replace `useEffect` with `useEffect$`
4. **Save**: Automatically save the transformed files

## 🔍 Codemod Source

See [codemod.ts](./codemod.ts) for the complete implementation.

## 🧪 Expected Output

```
🚀 React Hooks Migration Codemod

📁 Found 1 files

🔄 Processing: src/Counter.tsx
  ✅ useState -> useSignal
  ✅ useEffect -> useEffect$

✨ Migration complete!

📝 Summary:
   - Processed 1 files
   - useState → useSignal
   - useEffect → useEffect$
```

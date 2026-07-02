# IST Demos JavaScript Guide

For demos, we optimize for speed, low tooling overhead, and approachability. JavaScript avoids type maintenance and compile-time friction, keeps examples concise, and leverages Next.js’s first‑class JS support. TypeScript is widely supported, but we intentionally choose JS here to minimize cognitive overhead and maximize iteration velocity.

## Functions

### Prefer ternaries over simple `if/else` blocks

#### Why

Keeps code cleaner and easier to read. Use ternaries only for simple, side‑effect‑free expressions; prefer `if/else` when conditions or branches are non‑trivial.

#### Prefer

```js
return isBlah ? a : b;
```

#### Avoid

```js
if (isBlah) {
  return a;
} else {
  return b;
}
```

---

### Prefer `if/else` blocks over complex ternaries

#### Why

Keeps code easier to read.

#### Prefer

```js
if (isBlah) {
  return "a";
} else if (isFoo) {
  return "b";
} else {
  return "c";
}
```

#### Avoid

```js
return isBlah ? "a" : isFoo ? "b" : "c";
```

---

### All new (exported) functions should have a JSDoc comment explaining functionality

#### Why

Documenting functions with JSDoc (TSDoc‑compatible) helps reviewers understand intent and documents usage for other engineers. Better yet, [VS Code automatically shows inline descriptions of a function](https://code.visualstudio.com/docs/languages/javascript#_jsdoc-support) when a user invokes that function in the editor.

JSDoc comments should clearly state any major assumptions about inputs and outputs that may not be obvious to someone unfamiliar with this part of the codebase.

#### Prefer

```js
/**
 * Get the next applicable instance for upgrade. The function handles regions and cloud providers
 * but does NOT work for Serverless clusters
 * @param clusterDescription the backbone cluster description model
 * @param providerOptionsModel the backbone provider options model
 * @returns the next upgrade instance for this cluster
 */
export const getNextUpgradeInstance = (
  clusterDescription,
  providerOptionsModel
) => {
  // ...
};
```

#### Avoid

```js
export const getNextUpgradeInstance = (
  clusterDescription,
  providerOptionsModel
) => {
  // ...
};
```

---

### Prefer defining functions at the highest reasonable scope and pass in required data

#### Why

Define pure helpers at module scope for reuse/testability and to avoid re‑creation on render. Define inside components when they need props, state, or hooks.

---

### Prefer Next.js Server Actions over API Routes for internal data operations

#### Why

- Keeps credentials and logic on the server; avoids exposing broad, destructive endpoints.
- Simpler data flow (no extra HTTP hop) and built‑in React integration.

Use API Routes only when you must expose an HTTP endpoint (e.g., webhooks, cross‑origin/public access, non‑React clients, or specialized streaming).

---

### Variables

#### Use UPPER_CASE for truly immutable constants

---

#### Use camelCase for most JavaScript functions and variables

---

#### Use PascalCase for components/classes/etc.

---

#### Prefix boolean variables with “to be” verbs

(e.g. `shouldX`, `isY`, `canZ`, `doesX`, `hasY`, `willZ`)

---

### Avoid inline declaration of static values; prefer top‑level constants or a shared module

---

### Prefer const to let whenever possible

#### Why

"const until you can'tst"

---

## React

### Prefer components to be UI‑only

#### Why

Provides better separation of concerns. By splitting UI (JSX + Tailwind CSS) from React logic (hooks), code is more maintainable. Simple derived values and conditional rendering in components are fine; move non‑trivial state/effects and complex handlers into hooks. When editing with AI assistance, it's safer to focus on logic and UI separately.

---

### Prefer component‑specific hooks in the component folder; reusable hooks in the general hooks folder

#### Why

In a simple demo, most hooks are used by a single component; colocate them with that component. For hooks reused across components, place them in `src/lib/hooks/`.

---

### Prefer factoring out complex (i.e., more than one line) event handlers into their own functions

#### Why

Minimizes inline JavaScript logic and creates a named function that appears in stack traces. Helps with debugging.

#### Prefer

```js
const handleClick = (e) => {
  e.preventDefault();
  setState((curr) => !curr);
};

<button onClick={handleClick} />;
```

#### Avoid

```js
<button
  onClick={(e) => {
    e.preventDefault();
    setState((curr) => !curr);
  }}
/>
```

---

### Prefer prefixing event handlers with `handle`

#### Why

Standardizes how we name and search for functions that handle events.

#### Prefer

```js
const handleClick = () => {};
return <button onClick={handleClick} />;
```

#### Avoid

```js
const onClick = () => {};
return <button onClick={onClick} />;
```

---

### Prefer using fragments over `div` whenever possible

#### Why

Use fragments when no wrapper attributes/styling/semantics are needed; reduces unnecessary DOM nesting. Fragments can’t carry attributes—use semantic elements (e.g., `section`, `header`) or `div` when appropriate.

#### Prefer

```js
return <></>;
```

#### Avoid

```js
return <div></div>;
```

---

## References

- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [DHH On Writing Software Well](https://www.youtube.com/watch?v=H5i1gdwe1Ls)
- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
- [Atlas Growth Style Guide](https://github.com/10gen/atlas-growth-style-guide/blob/main/README.md#Functions)

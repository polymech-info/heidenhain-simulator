// R3F 8 does `import create from 'zustand'` (Zustand 3).
// Drei / tunnel-rat do `import { create } from 'zustand'` (Zustand 5).
// v5 dropped `store.destroy()`, which R3F calls when tearing down a portal.
import { create as createV5, useStore } from "../node_modules/zustand/esm/react.mjs";
import { createStore } from "../node_modules/zustand/esm/vanilla.mjs";

function create(initializer) {
  const store = createV5(initializer);
  if (typeof store.destroy === "function") return store;

  const unsubs = new Set();
  const origSubscribe = store.subscribe.bind(store);
  store.subscribe = (listener, ...rest) => {
    const unsub = origSubscribe(listener, ...rest);
    unsubs.add(unsub);
    return () => {
      unsubs.delete(unsub);
      unsub();
    };
  };
  store.destroy = () => {
    unsubs.forEach((unsub) => unsub());
    unsubs.clear();
  };
  return store;
}

export { create, createStore, useStore };
export default create;

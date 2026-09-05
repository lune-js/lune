---
"@lune-js/context": patch
"lune-js": patch
---

Stop bundling `@lune-js/core` into `@lune-js/context`.

- `@lune-js/core` owns the reactive graph, so inlining it gave every consumer a second copy:
  effects registered through a context never observed writes made through the `reactive` export,
  and `lune-js` shipped two independent reactive systems.
- `@lune-js/core` moves to `dependencies`, since the built module now imports it instead of carrying its own copy.
- Drops the `lune-js` ESM bundle from ~157kb to ~115kb (~41kb to ~31kb gzipped).
- The `import.meta.env.DEV` define is now scoped to the CJS output, which is the one that needed it,
  so development warnings survive in the published ESM module.

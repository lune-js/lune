---
"@lune-js/core": patch
---

Refactors dirty and mutable checks in `system.ts`.

- Removes `checkDirty` function that existed only to walk down through `Mutable` nodes.
- Refactors `propagate`'s descent, traversal stacks, and labeled loop.
- Patches dirty checks in `effect.ts` and removes unlink/subscriptions.

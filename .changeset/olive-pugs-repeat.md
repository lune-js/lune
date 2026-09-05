---
"lune-js": patch
---

Fix directive bugs and re-export `allowGlobals` in browser builds.

- A `lu-scope` expression that fails no longer aborts the mount.
  The scope falls back to an empty object, so the failure stays local to that region and every sibling region still renders.
- Event modifiers, system modifiers, and listener options no longer filter keyboard events. `@keyup.stop` and `@keydown.ctrl`
  were silently dropped because any modifier made the handler require the pressed key to be listed; key filtering now applies only
  to modifiers that name a key.

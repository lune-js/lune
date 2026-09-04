# Lune.js

Simple, declarative, and functional library for building reactive user interfaces.

## Expressions

Template bindings are run by a small expression engine rather than a `Function` constructor,
so Lune needs no `unsafe-eval` in a Content Security Policy. Sources are tokenized,
parsed and compiled to a closure tree once, then cached and reused on every update.

The supported subset covers what bindings need: literals, template literals, arrays and objects
(including spreads), member and optional chaining, calls, `new`, the arithmetic, comparison,
logical, bitwise and assignment operators, arrow functions, and the `if`, `return`, `throw` and
`let`/`const`/`var` statements. Loops, `function`, `class` and `async`/`await` are not supported.

Identifiers resolve in this order: local bindings (arrow parameters and declarations), the scope,
the `$el` and `$data` aliases, and finally an allow list of globals such as `Math`, `JSON` and
`console`. Everything else raises a reference error. `window`, `document`, `fetch`, `eval`,
`Function` and friends are rejected outright, as is access to `constructor`, `prototype` and
`__proto__`.

### Application globals

To reach an application global from a template, register it first:

```js
import { allowGlobals } from "lune-js";

allowGlobals({ dayjs });
```

`allowGlobals` writes to the expression engine, not to an app:

- **The registry is engine wide.** Every app created from the same copy of Lune resolves the same
  registered names, whichever app registered them. There is no per-app registry, and no way to
  unregister a name. A bundle that ships its own copy of Lune gets its own registry.
- **Registration may happen at any time.** Names are resolved when a binding runs, not when it is
  compiled, so `allowGlobals` works before or after `mount()`. Bindings that already ran pick a
  newly registered name up the next time they evaluate.
- **The scope always wins.** Globals are the last step of the resolution order, so a property of the
  same name in app data or on a `lu-scope` shadows a registered global.
- **Blocked names stay blocked.** Registering `window`, `document`, `fetch`, `Function` or any other
  permanently rejected name throws, so the allow list cannot be widened past them.
- Registering a name a second time replaces the value bound to it.

Reach for app data when the value belongs to one app, and for `allowGlobals` when it is shared
across every app on the page: a date library, a formatter, an app-wide constant. The two differ in
more than reach. Values passed to `createApp` join the reactive scope, where plain objects and
arrays are read back as reactive proxies and top-level functions are bound to the scope, which
leaves a library function without the static properties it shipped with (`dayjs.extend` and friends).
Registered globals are handed to the expression untouched.

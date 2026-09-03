---
"@lune-js/context": major
"@lune-js/core": major
"@lune-js/utils": major
"lune-js": major
---

Replace the `Function` constructor in `evaluate` and `execute` with a self contained expression engine.

- Expressions are parsed and compiled into a closure tree, so no dynamic code is created and Lune works under a CSP without `unsafe-eval`.
- Removes the deprecated `with` block, which was also what made repeated evaluation slow. Cached expressions run roughly 1.7x faster.
- Identifiers resolve against the scope, then `$el`/`$data`, then an allow list of globals. Names such as `window`, `document`, `fetch` and `Function` are rejected, as are `constructor`, `prototype` and `__proto__` property access, closing the classic route back to dynamic code.
- Arrow function parameters and `let`/`const` declarations now shadow scope properties of the same name, which `with` did not allow.
- New `allowGlobals` export registers extra bindings for applications that reference their own globals from templates.

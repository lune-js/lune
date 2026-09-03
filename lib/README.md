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

To reach an application global from a template, register it first:

```js
import { allowGlobals } from "lune-js";

allowGlobals({ dayjs });
```

# @lune-js/context

Optimized context library to manage state and behavior in Lune.js.

## NOTE

This package is published only for typing and building custom renderers in Lune.js.
**It is NOT recommended to install as a standalone package**.

## Expressions

The expression engine lives here. `evaluate` runs a single expression and `execute` runs a statement
list, both against a scope and an optional element. Sources go through this package's own lexer,
parser and compiler rather than the `Function` constructor, so a renderer built on it inherits the
CSP compatibility described in [`lune-js`](../../lib/README.md#expressions), which also documents the
supported language subset and the identifier resolution order.

Two pieces of state belong to the module rather than to a `Context`:

- **The compiled expression cache**, keyed by source text. A source compiled while rendering one
  context is reused by every other context in the same copy of the package.
- **The registry written by `allowGlobals`**, which adds identifiers the engine resolves last, after
  locals, the scope and the `$el`/`$data` aliases. It is engine wide because identifier resolution
  runs with a scope and an element in hand and never a context, so a registration has no app or
  context to be scoped to. A value that should reach one app only belongs in that app's scope
  instead. See [Application globals](../../lib/README.md#application-globals) for the full semantics.

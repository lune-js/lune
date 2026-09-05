# @lune-js/core

## [1.0.0] - 2026-09-05

### Changed

- Lune.js is now CSP-Friendly! 🌙
  - Replace the `Function` constructor in `evaluate` and `execute` with a self contained **"expression engine"**.
  - Expressions are parsed and compiled into a closure tree, so no dynamic code is created and Lune works under a CSP without `unsafe-eval`.
  - Removes the deprecated `with` block, which was also what made repeated evaluation slow. Cached expressions run roughly 1.7x faster.
  - Identifiers resolve against the scope, then `$el`/`$data`, then an allow list of globals.
    Names such as `window`, `document`, `fetch` and `Function` are rejected, as are `constructor`, `prototype` and `__proto__` property access,
    closing the classic route back to dynamic code.
  - Arrow function parameters and `let`/`const` declarations now shadow scope properties of the same name, which `with` did not allow.
  - New `allowGlobals` export registers extra bindings for applications that reference their own globals from templates.

### Fixed

- Refactors dirty and mutable checks in `system.ts`.
  - Removes `checkDirty` function that existed only to walk down through `Mutable` nodes.
  - Refactors `propagate`'s descent, traversal stacks, and labeled loop.
  - Patches dirty checks in `effect.ts` and removes unlink/subscriptions.

## [0.3.0] - 2026-08-05

### Added

- Set internal packages as `devDependencies`.
  - The bundlers, tsdown, have been inlining dependencies for a while.
  - Reduces `node_modules` for users.

### Fixed

- Removes unsupported Ref and Collections types.

## [0.2.1] - 2026-08-02

### Fixed

- Update repo info in package.json.

## [0.2.0] - 2026-07-31

### Added

- Better browser and bundler support; adds types for attributes in JSX.

### Fixed

- Updates es-toolkit to latest.

## [0.1.2] - 2026-07-24

### Fixed

- - Fixes missing types.
  - Fixes package exports.
  - Removes `clean-package`.
  - Replaces `vite` with `tsdown` as bundler.

- - Fixes bind directives that update existing attributes.
  - Fixes reactivity edge case to prevent triggering updates when property assignments fail on protected or read-only properties.

## [0.1.1] - 2026-07-06

### Fixed

- Fixes Bun Workspaces issue by removing `"workspace:*"` and `"catalog:"` throughout the monorepo.
  ```bash
  error: Workspace dependency "*" not found
  Searched in "./*"
  Workspace documentation: https://bun.com/docs/install/workspaces
  ```

## [0.1.0] - 2026-07-06

### Added

- Initial release of Lune.js 🌙
  Lune.js is a fork of [`petite-vue`](https://github.com/vuejs/petite-vue), an alternative distribution of Vue optimized for progressive enhancement.
  This project has been created because `petite-vue` has not been updated for nearly **5 years**. Lune.js attempts to modernize and add features missing in `petite-vue` including:
  - Utilize [Alien Signals](https://github.com/stackblitz/alien-signals) to perform reactive rendering and optimized updates to the DOM.
  - Build with [custom directives](https://vuejs.org/guide/reusability/custom-directives.html) and [plugins](https://vuejs.org/guide/reusability/plugins.html) to enhance development experience.
  - Exposes global variables such as [`$root`](https://vuejs.org/api/component-instance.html#root), [`$refs`](https://vuejs.org/api/component-instance.html#refs), and [`$el`](https://vuejs.org/api/component-instance.html#el).
    A big difference from `petite-vue`: [directives](https://vuejs.org/api/built-in-directives.html) start with `lu-` instead of `v-`.

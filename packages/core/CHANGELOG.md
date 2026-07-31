# @lune-js/core

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
